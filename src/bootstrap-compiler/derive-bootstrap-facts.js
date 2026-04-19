'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const LANGUAGE_LABELS = {
  '.js': 'JavaScript',
  '.cjs': 'JavaScript',
  '.mjs': 'JavaScript',
  '.jsx': 'JavaScript',
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.py': 'Python',
  '.rb': 'Ruby',
  '.go': 'Go',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.kts': 'Kotlin',
  '.swift': 'Swift',
  '.rs': 'Rust',
};

const SKIP_ROOTS = new Set([
  '.git',
  'node_modules',
  '.spec-first',
  '.claude',
  '.codex',
  '.agents',
  '.playwright-mcp',
  'docs/contexts',
]);

const RUNTIME_EXTENSION_RE = /\.(cjs|go|java|js|jsx|kt|kts|mjs|py|rb|rs|swift|ts|tsx)$/i;
const TEST_FILE_RE = /(^|\/)(tests?|__tests__)\/|(\.test\.|\.(spec)\.)/i;

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function listRepoFiles(repoRoot, currentDir = repoRoot, results = []) {
  if (!fs.existsSync(currentDir)) return results;

  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = normalizePath(path.relative(repoRoot, absolutePath));
    if (!relativePath) continue;

    if (entry.isDirectory()) {
      if (SKIP_ROOTS.has(relativePath) || entry.name === 'node_modules') continue;
      listRepoFiles(repoRoot, absolutePath, results);
      continue;
    }

    results.push(relativePath);
  }

  return results;
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_error) {
    return null;
  }
}

function countLines(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content) return 0;
  return content.split(/\r?\n/).length;
}

function detectPrimaryLanguage(files) {
  const counts = new Map();
  for (const filePath of files) {
    if (!RUNTIME_EXTENSION_RE.test(filePath) || TEST_FILE_RE.test(filePath)) continue;
    const extension = path.extname(filePath).toLowerCase();
    const label = LANGUAGE_LABELS[extension];
    if (!label) continue;
    counts.set(label, (counts.get(label) || 0) + 1);
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return ranked.length > 0 ? ranked[0][0] : 'Unknown';
}

function detectPrimaryFrameworks({ pkg, files }) {
  const frameworks = [];
  const deps = {
    ...(pkg && pkg.dependencies ? pkg.dependencies : {}),
    ...(pkg && pkg.devDependencies ? pkg.devDependencies : {}),
  };
  const scripts = pkg && pkg.scripts ? pkg.scripts : {};

  if ((pkg && pkg.bin) || files.some((filePath) => filePath.startsWith('bin/'))) {
    frameworks.push('Node.js CLI');
  }
  if (Object.prototype.hasOwnProperty.call(deps, 'jest') || Object.keys(scripts).some((key) => key.includes('test'))) {
    frameworks.push('Jest');
  }
  if (Object.prototype.hasOwnProperty.call(deps, 'tree-sitter')) {
    frameworks.push('tree-sitter');
  }
  if (Object.prototype.hasOwnProperty.call(deps, 'better-sqlite3')) {
    frameworks.push('better-sqlite3');
  }
  if (Object.prototype.hasOwnProperty.call(deps, 'simple-git')) {
    frameworks.push('simple-git');
  }

  return unique(frameworks);
}

function detectRepoShape({ repoRoot, pkg, files }) {
  if (pkg && Array.isArray(pkg.workspaces) && pkg.workspaces.length > 0) {
    return 'workspace repository with managed CLI and shared workflow assets';
  }

  const hasCli = files.some((filePath) => filePath.startsWith('bin/') || filePath.startsWith('src/cli/'));
  const hasWorkflowAssets = files.some((filePath) => filePath.startsWith('skills/') || filePath.startsWith('agents/'));
  const hasEmbeddedCrg = files.some((filePath) => filePath.startsWith('src/crg/'));

  if (hasCli && hasWorkflowAssets && hasEmbeddedCrg) {
    return 'single-package CLI repository with bundled workflow assets and embedded CRG runtime';
  }
  if (hasCli) {
    return 'single-package CLI repository';
  }
  return `${path.basename(repoRoot)} source repository`;
}

function collectEntrypoints({ repoRoot, pkg, files }) {
  const entrypoints = [];

  if (pkg && pkg.bin && typeof pkg.bin === 'object') {
    for (const filePath of Object.values(pkg.bin)) {
      const normalized = normalizePath(filePath);
      if (files.includes(normalized)) {
        entrypoints.push({ path: normalized });
      }
    }
  }

  for (const candidate of [
    'src/cli/index.js',
    'src/crg/cli/router.js',
    'src/cli/commands/stage0-context.js',
  ]) {
    if (files.includes(candidate)) {
      entrypoints.push({ path: candidate });
    }
  }

  return unique(entrypoints.map((item) => item.path)).map((filePath) => ({ path: filePath }));
}

function collectModules(files) {
  const modules = new Set();

  for (const filePath of files) {
    if (filePath.startsWith('src/')) {
      const parts = filePath.split('/');
      if (parts[1]) modules.add(`src/${parts[1]}/`);
      continue;
    }

    if (filePath.startsWith('docs/contracts/')) {
      modules.add('docs/contracts/');
      continue;
    }

    const topLevel = filePath.split('/')[0];
    if (['agents', 'benchmarks', 'bin', 'docs', 'scripts', 'skills', 'templates', 'tests', 'vendor'].includes(topLevel)) {
      modules.add(`${topLevel}/`);
    }
  }

  return [...modules].sort().map((modulePath) => ({ path: modulePath }));
}

function collectIntegrations(pkg) {
  const deps = {
    ...(pkg && pkg.dependencies ? pkg.dependencies : {}),
    ...(pkg && pkg.devDependencies ? pkg.devDependencies : {}),
  };
  const priority = [
    'better-sqlite3',
    'tree-sitter',
    'simple-git',
    'jest',
    'ignore',
  ];
  const seen = new Set();
  const result = [];

  for (const dep of priority) {
    if (Object.prototype.hasOwnProperty.call(deps, dep)) {
      seen.add(dep);
      result.push({ symbol: dep });
    }
  }

  for (const dep of Object.keys(deps).sort()) {
    if (seen.has(dep) || dep.startsWith('tree-sitter-')) continue;
    result.push({ symbol: dep });
    if (result.length >= 8) break;
  }

  return result;
}

function inferTestKind(filePath) {
  if (filePath.includes('/contracts/')) return 'contract';
  if (filePath.includes('/integration/')) return 'integration';
  if (filePath.includes('/smoke/')) return 'smoke';
  if (filePath.includes('/e2e/')) return 'e2e';
  return 'unit';
}

function inferTargetPath(testFilePath, runtimeFiles) {
  const basename = path.basename(testFilePath)
    .replace(/\.test\.[^.]+$/i, '')
    .replace(/\.spec\.[^.]+$/i, '');

  if (testFilePath.startsWith('tests/contracts/')) {
    const contractCandidate = `docs/contracts/${basename}.schema.json`;
    if (runtimeFiles.includes(contractCandidate)) return contractCandidate;
  }

  const candidates = runtimeFiles.filter((filePath) => path.basename(filePath, path.extname(filePath)) === basename);
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    return candidates.sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
  }

  return null;
}

function collectTestSurface(files) {
  const runtimeFiles = files.filter((filePath) => RUNTIME_EXTENSION_RE.test(filePath) && !TEST_FILE_RE.test(filePath));
  const testFiles = files
    .filter((filePath) => TEST_FILE_RE.test(filePath))
    .sort()
    .map((filePath) => ({
      path: filePath,
      kind: inferTestKind(filePath),
      target_path: inferTargetPath(filePath, runtimeFiles),
    }));

  return {
    test_files: testFiles,
    coverage_gaps: [],
  };
}

function collectTestingSurface(testSurface) {
  const testFiles = Array.isArray(testSurface && testSurface.test_files) ? testSurface.test_files : [];
  return testFiles
    .filter((item) => item && item.target_path)
    .slice(0, 8)
    .map((item) => ({
      target_path: item.target_path,
      source_test: item.path,
    }));
}

function collectRiskSignals({ repoRoot, files }) {
  const runtimeFiles = files.filter((filePath) => filePath.startsWith('src/') && RUNTIME_EXTENSION_RE.test(filePath));
  const signals = runtimeFiles
    .map((filePath) => {
      const absolutePath = path.join(repoRoot, filePath);
      const lineCount = countLines(absolutePath);
      return {
        path: filePath,
        kind: lineCount >= 220 ? 'large-module' : 'hotspot',
        severity: lineCount >= 220 ? 'high' : 'medium',
        summary: `文件约 ${lineCount} 行，属于当前仓库较大的运行时模块`,
        line_count: lineCount,
      };
    })
    .sort((a, b) => b.line_count - a.line_count || a.path.localeCompare(b.path))
    .slice(0, 5);

  return {
    signals,
    crg_metrics: {
      source: 'filesystem-inference',
      signal_count: signals.length,
    },
  };
}

function deriveBootstrapInputs({ repoRoot, factInventory, riskSignals, testSurface } = {}) {
  if (!repoRoot) {
    return {
      factInventory: factInventory || {},
      riskSignals: riskSignals || { signals: [], crg_metrics: { source: 'missing-repo-root', signal_count: 0 } },
      testSurface: testSurface || { test_files: [], coverage_gaps: [] },
      repoFiles: [],
      packageJson: null,
    };
  }

  const repoFiles = listRepoFiles(repoRoot).sort();
  const packageJson = readJsonIfExists(path.join(repoRoot, 'package.json'));

  const effectiveTestSurface = testSurface || collectTestSurface(repoFiles);
  const effectiveFactInventory = factInventory || {
    project_identity: {
      name: packageJson && packageJson.name ? packageJson.name : path.basename(repoRoot),
      primary_language: detectPrimaryLanguage(repoFiles),
      primary_frameworks: detectPrimaryFrameworks({ pkg: packageJson, files: repoFiles }),
      repo_shape: detectRepoShape({ repoRoot, pkg: packageJson, files: repoFiles }),
    },
    entrypoints: collectEntrypoints({ repoRoot, pkg: packageJson, files: repoFiles }),
    modules: collectModules(repoFiles),
    integrations: collectIntegrations(packageJson),
    testing_surface: collectTestingSurface(effectiveTestSurface),
  };
  const effectiveRiskSignals = riskSignals || collectRiskSignals({ repoRoot, files: repoFiles });

  return {
    factInventory: effectiveFactInventory,
    riskSignals: effectiveRiskSignals,
    testSurface: effectiveTestSurface,
    repoFiles,
    packageJson,
  };
}

function sha256File(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function resolveGitCommit(repoRoot) {
  try {
    return execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (_error) {
    return null;
  }
}

module.exports = {
  deriveBootstrapInputs,
  resolveGitCommit,
  sha256File,
};
