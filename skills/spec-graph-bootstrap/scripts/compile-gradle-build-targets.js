#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const IGNORED_DIRS = new Set([
  '.git',
  '.spec-first',
  '.gitnexus',
  '.code-review-graph',
  '.agents',
  '.codex',
  '.claude',
  'node_modules',
  'vendor',
  'build',
  'dist',
  'coverage',
]);

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.error) {
    writeJson({
      coverage_inference: 'skipped',
      reason_code: options.error,
      non_git_build_modules: [],
      coverage_summary: defaultCoverageSummary(0, 0),
      graph_coverage_class: 'none',
    });
    return options.error === 'help' ? 0 : 2;
  }

  try {
    const payload = compileGradleBuildTargets(options);
    writeJson(payload);
    return 0;
  } catch (error) {
    writeJson({
      coverage_inference: 'skipped',
      reason_code: 'gradle-parse-error',
      diagnostic: error instanceof Error ? error.message : String(error),
      non_git_build_modules: [],
      coverage_summary: defaultCoverageSummary(0, 0),
      graph_coverage_class: 'none',
    });
    return 0;
  }
}

function compileGradleBuildTargets(options) {
  const workspaceRoot = path.resolve(options.workspaceRoot || process.cwd());
  const scanDepth = Number.isFinite(Number(options.scanDepth)) ? Number(options.scanDepth) : 3;
  const targets = readTargets(options.targetsPath);
  const childRepoPaths = collectChildRepoPaths(workspaceRoot, targets);
  const buildTargets = [];
  const manifests = [];

  const gradleResult = collectGradleBuildTargets(workspaceRoot, scanDepth, childRepoPaths);
  if (gradleResult.modules.length > 0) {
    buildTargets.push(...gradleResult.modules);
    if (gradleResult.manifest) manifests.push(gradleResult.manifest);
  }

  const npmResult = collectNpmWorkspaceTargets(workspaceRoot, scanDepth, childRepoPaths);
  if (npmResult.modules.length > 0) {
    buildTargets.push(...npmResult.modules);
    manifests.push(...npmResult.manifests);
  }

  if (buildTargets.length > 0) {
    const modules = uniqueModules(buildTargets);
    const uncoveredCount = modules.filter(item => !item.covered_by_child_repo).length;
    const coverageSummary = defaultCoverageSummary(childRepoPaths.length, uncoveredCount);
    const ecosystems = unique(
      modules.map(item => item.ecosystem || (item.kind === 'gradle-module' ? 'gradle' : 'npm')),
    );

    return {
      coverage_inference: 'computed',
      reason_code: null,
      ecosystem: ecosystems.length === 1 ? ecosystems[0] : 'mixed',
      ecosystems,
      manifest: manifests[0] || null,
      manifests: unique(manifests),
      non_git_build_modules: modules,
      coverage_summary: coverageSummary,
      graph_coverage_class: classifyCoverage(coverageSummary),
    };
  }

  const reasonCode = chooseSkippedReason(gradleResult.reasonCode, npmResult.reasonCode);
  return skippedPayload(workspaceRoot, gradleResult.manifestPath, childRepoPaths.length, reasonCode);
}

function collectGradleBuildTargets(workspaceRoot, scanDepth, childRepoPaths) {
  const settingsFiles = findSettingsFiles(workspaceRoot, scanDepth);
  const groovySettings = settingsFiles.find(file => path.basename(file) === 'settings.gradle');
  const ktsSettings = settingsFiles.find(file => path.basename(file) === 'settings.gradle.kts');

  if (!groovySettings) {
    const reasonCode = ktsSettings ? 'kts-or-composite-not-supported' : 'no-gradle-settings';
    return {
      modules: [],
      manifest: null,
      manifestPath: null,
      reasonCode,
    };
  }

  const content = fs.readFileSync(groovySettings, 'utf8');
  if (/^\s*includeBuild\s*(?:\(|['"]|\s)/m.test(content)) {
    return {
      modules: [],
      manifest: toPosixPath(path.relative(workspaceRoot, groovySettings)),
      manifestPath: groovySettings,
      reasonCode: 'kts-or-composite-not-supported',
    };
  }

  const modulePaths = parseGradleIncludes(content);
  if (modulePaths.length === 0) {
    return {
      modules: [],
      manifest: toPosixPath(path.relative(workspaceRoot, groovySettings)),
      manifestPath: groovySettings,
      reasonCode: 'no-gradle-includes',
    };
  }

  const manifest = toPosixPath(path.relative(workspaceRoot, groovySettings));
  const modules = modulePaths.map((modulePath) => {
    const coveredByChildRepo = childRepoPaths.some(childPath => modulePath === childPath || modulePath.startsWith(`${childPath}/`));
    return {
      path: modulePath,
      kind: 'gradle-module',
      ecosystem: 'gradle',
      manifest,
      in_settings_gradle: true,
      covered_by_child_repo: coveredByChildRepo,
      graph_coverage: coveredByChildRepo ? 'covered-by-child-repo' : 'uncovered-non-git-build-module',
    };
  });

  return {
    modules,
    manifest,
    manifestPath: groovySettings,
    reasonCode: null,
  };
}

function skippedPayload(workspaceRoot, manifestPath, childRepoCount, reasonCode) {
  const coverageSummary = defaultCoverageSummary(childRepoCount, 0);
  const ecosystem = reasonCode === 'npm-parse-error' || reasonCode === 'no-npm-workspaces' ? 'npm' : 'gradle';
  return {
    coverage_inference: 'skipped',
    reason_code: reasonCode,
    ecosystem,
    manifest: manifestPath ? toPosixPath(path.relative(workspaceRoot, manifestPath)) : null,
    non_git_build_modules: [],
    coverage_summary: coverageSummary,
    graph_coverage_class: childRepoCount > 0 ? 'git-roots-only' : 'none',
  };
}

function defaultCoverageSummary(childRepoCount, uncoveredBuildModules) {
  const coveredByGitChildren = Math.max(0, Number(childRepoCount) || 0);
  const uncovered = Math.max(0, Number(uncoveredBuildModules) || 0);
  const totalBuildTargets = coveredByGitChildren + uncovered;
  return {
    total_build_targets: totalBuildTargets,
    covered_by_git_children: coveredByGitChildren,
    uncovered_build_modules: uncovered,
    coverage_ratio: totalBuildTargets === 0 ? null : Number((coveredByGitChildren / totalBuildTargets).toFixed(6)),
  };
}

function classifyCoverage(summary) {
  if (!summary || Number(summary.total_build_targets || 0) === 0) return 'none';
  if (Number(summary.uncovered_build_modules || 0) === 0) return 'full';
  if (Number(summary.covered_by_git_children || 0) > 0) return 'partial-build-targets';
  return 'none';
}

function collectNpmWorkspaceTargets(workspaceRoot, scanDepth, childRepoPaths) {
  const workspaceManifests = findNpmWorkspaceManifests(workspaceRoot, scanDepth);
  const patterns = [];
  const manifests = [];
  let parseFailed = false;

  for (const manifestPath of workspaceManifests) {
    try {
      const manifest = toPosixPath(path.relative(workspaceRoot, manifestPath));
      const manifestPatterns = readWorkspacePatterns(workspaceRoot, manifestPath);
      if (manifestPatterns.length === 0) continue;
      manifests.push(manifest);
      for (const pattern of manifestPatterns) {
        patterns.push({ pattern, manifest, packageManager: inferPackageManager(manifestPath) });
      }
    } catch {
      parseFailed = true;
    }
  }

  if (parseFailed && patterns.length === 0) {
    return { modules: [], manifests: [], reasonCode: 'npm-parse-error' };
  }
  if (patterns.length === 0) {
    return { modules: [], manifests: [], reasonCode: 'no-npm-workspaces' };
  }

  const modulesByPath = new Map();
  for (const item of patterns) {
    for (const packagePath of expandWorkspacePattern(workspaceRoot, item.pattern)) {
      if (!packagePath || packagePath === '.') continue;
      if (modulesByPath.has(packagePath)) continue;
      const coveredByChildRepo = childRepoPaths.some(childPath => packagePath === childPath || packagePath.startsWith(`${childPath}/`));
      modulesByPath.set(packagePath, {
        path: packagePath,
        kind: 'npm-workspace',
        ecosystem: 'npm',
        manifest: item.manifest,
        package_manager: item.packageManager,
        workspace_pattern: item.pattern,
        in_settings_gradle: false,
        in_package_workspace: true,
        covered_by_child_repo: coveredByChildRepo,
        graph_coverage: coveredByChildRepo ? 'covered-by-child-repo' : 'uncovered-non-git-build-module',
      });
    }
  }

  return {
    modules: Array.from(modulesByPath.values()).sort((left, right) => left.path.localeCompare(right.path)),
    manifests,
    reasonCode: modulesByPath.size > 0 ? null : 'no-npm-workspace-packages',
  };
}

function findNpmWorkspaceManifests(workspaceRoot, scanDepth) {
  const results = [];

  function walk(currentDir, depth) {
    if (depth > scanDepth) return;
    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    const hasPackageJson = entries.some(entry => entry.isFile() && entry.name === 'package.json');
    const hasPnpmWorkspace = entries.some(entry => entry.isFile() && entry.name === 'pnpm-workspace.yaml');
    if (hasPackageJson) results.push(path.join(currentDir, 'package.json'));
    if (hasPnpmWorkspace) results.push(path.join(currentDir, 'pnpm-workspace.yaml'));

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (IGNORED_DIRS.has(entry.name)) continue;
      walk(path.join(currentDir, entry.name), depth + 1);
    }
  }

  walk(workspaceRoot, 0);
  return results.sort((left, right) => toPosixPath(left).localeCompare(toPosixPath(right)));
}

function readWorkspacePatterns(workspaceRoot, manifestPath) {
  const fileName = path.basename(manifestPath);
  if (fileName === 'package.json') {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const workspaces = parsed.workspaces;
    if (Array.isArray(workspaces)) return normalizeWorkspacePatterns(workspaces);
    if (workspaces && Array.isArray(workspaces.packages)) return normalizeWorkspacePatterns(workspaces.packages);
    return [];
  }
  if (fileName === 'pnpm-workspace.yaml') {
    return normalizeWorkspacePatterns(parsePnpmWorkspacePackages(fs.readFileSync(manifestPath, 'utf8')));
  }
  return [];
}

function parsePnpmWorkspacePackages(content) {
  const patterns = [];
  const lines = String(content || '').split(/\r?\n/);
  let inPackages = false;
  let baseIndent = 0;

  for (const rawLine of lines) {
    const withoutComment = rawLine.replace(/\s+#.*$/, '');
    if (!withoutComment.trim()) continue;
    const packagesMatch = withoutComment.match(/^(\s*)packages\s*:\s*(.*)$/);
    if (packagesMatch) {
      inPackages = true;
      baseIndent = packagesMatch[1].length;
      const inline = packagesMatch[2].trim();
      if (inline.startsWith('[') && inline.endsWith(']')) {
        patterns.push(...parseInlineYamlList(inline));
      }
      continue;
    }

    if (!inPackages) continue;
    const indent = withoutComment.match(/^(\s*)/)[1].length;
    if (indent <= baseIndent) {
      inPackages = false;
      continue;
    }
    const itemMatch = withoutComment.match(/^\s*-\s*(.+)$/);
    if (itemMatch) patterns.push(stripQuotes(itemMatch[1].trim()));
  }

  return patterns;
}

function parseInlineYamlList(value) {
  const body = value.replace(/^\[/, '').replace(/\]$/, '');
  return body
    .split(',')
    .map(item => stripQuotes(item.trim()))
    .filter(Boolean);
}

function normalizeWorkspacePatterns(patterns) {
  return unique(
    (Array.isArray(patterns) ? patterns : [])
      .map(pattern => toPosixPath(stripQuotes(pattern)).trim())
      .filter(pattern => pattern && !pattern.startsWith('!'))
      .filter(pattern => !path.posix.isAbsolute(pattern))
      .filter(pattern => !pattern.split('/').includes('..')),
  );
}

function expandWorkspacePattern(workspaceRoot, pattern) {
  const normalized = toPosixPath(String(pattern || '').replace(/^\.\//, ''));
  if (!normalized || normalized === '.' || normalized.startsWith('!')) return [];
  const segments = normalized.split('/').filter(Boolean);
  const results = new Set();

  function walk(currentDir, index) {
    if (index >= segments.length) {
      if (fs.existsSync(path.join(currentDir, 'package.json'))) {
        const relative = toPosixPath(path.relative(workspaceRoot, currentDir));
        if (relative && relative !== '.') results.add(relative);
      }
      return;
    }

    const segment = segments[index];
    if (segment === '**') {
      walk(currentDir, index + 1);
      for (const entry of readDirectoryEntries(currentDir)) {
        if (!entry.isDirectory() || IGNORED_DIRS.has(entry.name)) continue;
        walk(path.join(currentDir, entry.name), index);
      }
      return;
    }

    if (segment.includes('*')) {
      const matcher = wildcardMatcher(segment);
      for (const entry of readDirectoryEntries(currentDir)) {
        if (!entry.isDirectory() || IGNORED_DIRS.has(entry.name)) continue;
        if (matcher.test(entry.name)) walk(path.join(currentDir, entry.name), index + 1);
      }
      return;
    }

    const nextDir = path.join(currentDir, segment);
    if (isPlainDirectory(nextDir)) {
      walk(nextDir, index + 1);
    }
  }

  walk(workspaceRoot, 0);
  return Array.from(results).sort();
}

function readDirectoryEntries(directory) {
  try {
    return fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}

function isPlainDirectory(directory) {
  try {
    const stat = fs.lstatSync(directory);
    return stat.isDirectory() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}

function wildcardMatcher(segment) {
  const escaped = segment.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  return new RegExp(`^${escaped}$`);
}

function inferPackageManager(manifestPath) {
  return path.basename(manifestPath) === 'pnpm-workspace.yaml' ? 'pnpm' : 'npm';
}

function chooseSkippedReason(gradleReason, npmReason) {
  if (npmReason === 'npm-parse-error') return npmReason;
  if (gradleReason && gradleReason !== 'no-gradle-settings') return gradleReason;
  return gradleReason || npmReason || 'no-build-targets';
}

function uniqueModules(modules) {
  const byKey = new Map();
  for (const module of modules) {
    byKey.set(`${module.kind}:${module.path}`, module);
  }
  return Array.from(byKey.values()).sort((left, right) => {
    const pathCompare = left.path.localeCompare(right.path);
    if (pathCompare !== 0) return pathCompare;
    return left.kind.localeCompare(right.kind);
  });
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function findSettingsFiles(workspaceRoot, scanDepth) {
  const results = [];

  function walk(currentDir, depth) {
    if (depth > scanDepth) return;
    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const absolute = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        walk(absolute, depth + 1);
        continue;
      }
      if (entry.isFile() && (entry.name === 'settings.gradle' || entry.name === 'settings.gradle.kts')) {
        results.push(absolute);
      }
    }
  }

  walk(workspaceRoot, 0);
  return results.sort((left, right) => toPosixPath(left).localeCompare(toPosixPath(right)));
}

function parseGradleIncludes(content) {
  const modules = new Set();
  const includePattern = /^\s*include\s*(?:\(([^)]*)\)|(.+))$/gm;
  let match;
  while ((match = includePattern.exec(content)) !== null) {
    const body = match[1] || match[2] || '';
    for (const valueMatch of body.matchAll(/['"](:?[^'"]+)['"]/g)) {
      const modulePath = normalizeGradleModulePath(valueMatch[1]);
      if (modulePath) modules.add(modulePath);
    }
  }
  return Array.from(modules).sort();
}

function normalizeGradleModulePath(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed || trimmed.startsWith('$')) return null;
  const modulePath = trimmed.replace(/^:/, '').replace(/:/g, '/');
  if (!modulePath || modulePath.startsWith('/') || modulePath.includes('..')) return null;
  return toPosixPath(modulePath);
}

function collectChildRepoPaths(workspaceRoot, targets) {
  const paths = new Set();
  for (const target of Array.isArray(targets) ? targets : []) {
    if (!target || target.target_kind === 'non-git-folder') continue;
    const relative = target.workspace_relative_path
      || (target.git_root ? path.relative(workspaceRoot, target.git_root) : null)
      || target.repo_label
      || null;
    if (!relative || relative === '.') continue;
    paths.add(toPosixPath(relative));
  }
  return Array.from(paths).sort();
}

function readTargets(targetsPath) {
  if (!targetsPath) return [];
  const parsed = JSON.parse(fs.readFileSync(targetsPath, 'utf8'));
  return Array.isArray(parsed) ? parsed : [];
}

function parseArgs(argv) {
  const options = {
    workspaceRoot: process.cwd(),
    scanDepth: 3,
    targetsPath: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      return { error: 'help' };
    }
    if (arg === '--workspace-root') {
      options.workspaceRoot = argv[++i];
    } else if (arg === '--scan-depth') {
      options.scanDepth = Number(argv[++i]);
    } else if (arg === '--targets') {
      options.targetsPath = argv[++i];
    } else {
      return { error: 'unknown-argument' };
    }
  }
  if (!options.targetsPath) return { error: 'missing-targets' };
  return options;
}

function toPosixPath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function stripQuotes(value) {
  return String(value || '').trim().replace(/^['"]|['"]$/g, '');
}

function writeJson(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  compileGradleBuildTargets,
  parseGradleIncludes,
  parsePnpmWorkspacePackages,
};
