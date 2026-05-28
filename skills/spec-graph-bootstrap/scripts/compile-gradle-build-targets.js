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
  const settingsFiles = findSettingsFiles(workspaceRoot, scanDepth);
  const groovySettings = settingsFiles.find(file => path.basename(file) === 'settings.gradle');
  const ktsSettings = settingsFiles.find(file => path.basename(file) === 'settings.gradle.kts');

  if (!groovySettings) {
    const reasonCode = ktsSettings ? 'kts-or-composite-not-supported' : 'no-gradle-settings';
    return skippedPayload(workspaceRoot, null, childRepoPaths.length, reasonCode);
  }

  const content = fs.readFileSync(groovySettings, 'utf8');
  if (/^\s*includeBuild\s*(?:\(|['"]|\s)/m.test(content)) {
    return skippedPayload(workspaceRoot, groovySettings, childRepoPaths.length, 'kts-or-composite-not-supported');
  }

  const modulePaths = parseGradleIncludes(content);
  if (modulePaths.length === 0) {
    return skippedPayload(workspaceRoot, groovySettings, childRepoPaths.length, 'no-gradle-includes');
  }

  const manifest = toPosixPath(path.relative(workspaceRoot, groovySettings));
  const modules = modulePaths.map((modulePath) => {
    const coveredByChildRepo = childRepoPaths.some(childPath => modulePath === childPath || modulePath.startsWith(`${childPath}/`));
    return {
      path: modulePath,
      kind: 'gradle-module',
      manifest,
      in_settings_gradle: true,
      covered_by_child_repo: coveredByChildRepo,
      graph_coverage: coveredByChildRepo ? 'covered-by-child-repo' : 'uncovered-non-git-build-module',
    };
  });
  const uncoveredCount = modules.filter(item => !item.covered_by_child_repo).length;
  const coverageSummary = defaultCoverageSummary(childRepoPaths.length, uncoveredCount);

  return {
    coverage_inference: 'computed',
    reason_code: null,
    ecosystem: 'gradle',
    manifest,
    non_git_build_modules: modules,
    coverage_summary: coverageSummary,
    graph_coverage_class: classifyCoverage(coverageSummary),
  };
}

function skippedPayload(workspaceRoot, manifestPath, childRepoCount, reasonCode) {
  const coverageSummary = defaultCoverageSummary(childRepoCount, 0);
  return {
    coverage_inference: 'skipped',
    reason_code: reasonCode,
    ecosystem: 'gradle',
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

function writeJson(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  compileGradleBuildTargets,
  parseGradleIncludes,
};
