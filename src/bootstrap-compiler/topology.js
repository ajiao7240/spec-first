'use strict';

const fs = require('node:fs');
const path = require('node:path');

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function fileExists(repoRoot, relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function detectBuildSystem({ repoRoot, files = [] } = {}) {
  const normalizedFiles = new Set((files || []).map(normalizePath));
  if (normalizedFiles.has('pom.xml') || fileExists(repoRoot, 'pom.xml')) {
    return 'maven';
  }
  if (
    normalizedFiles.has('build.gradle')
    || normalizedFiles.has('build.gradle.kts')
    || normalizedFiles.has('settings.gradle')
    || normalizedFiles.has('settings.gradle.kts')
    || fileExists(repoRoot, 'build.gradle')
    || fileExists(repoRoot, 'build.gradle.kts')
  ) {
    return 'gradle';
  }
  if (normalizedFiles.has('package.json') || fileExists(repoRoot, 'package.json')) {
    return 'npm';
  }
  return 'unknown';
}

function readPomModules(repoRoot) {
  const pomPath = path.join(repoRoot, 'pom.xml');
  if (!fs.existsSync(pomPath)) return [];

  try {
    const content = fs.readFileSync(pomPath, 'utf8');
    const modulesBlock = content.match(/<modules>([\s\S]*?)<\/modules>/i);
    if (!modulesBlock) return [];

    return unique((modulesBlock[1].match(/<module>([^<]+)<\/module>/gi) || [])
      .map((entry) => entry.replace(/<\/?module>/gi, '').trim())
      .map(normalizePath)
      .filter(Boolean)
      .filter((modulePath) => fs.existsSync(path.join(repoRoot, modulePath, 'pom.xml'))));
  } catch (_error) {
    return [];
  }
}

function buildSingleRepoTopology({ repoRoot, buildSystem }) {
  const repoName = path.basename(repoRoot);
  return {
    schema_version: 'v1',
    kind: 'single_repo',
    container_kind: 'git_repo',
    selection_granularity: 'project',
    root_path: '.',
    units: [
      {
        id: repoName,
        kind: 'project',
        path: '.',
        git_root: '.',
        build_system: buildSystem,
        signals: ['git-root'],
      },
    ],
  };
}

function buildMonorepoTopology({ modulePaths, buildSystem }) {
  return {
    schema_version: 'v1',
    kind: 'monorepo_multi_module',
    container_kind: 'git_repo',
    selection_granularity: 'module',
    root_path: '.',
    units: modulePaths.map((modulePath) => ({
      id: modulePath,
      kind: 'module',
      path: modulePath,
      git_root: '.',
      build_system: buildSystem,
      signals: ['maven-root-module'],
    })),
  };
}

function buildRepoTopology({ repoRoot, files = [] } = {}) {
  const buildSystem = detectBuildSystem({ repoRoot, files });
  const mavenModules = buildSystem === 'maven' ? readPomModules(repoRoot) : [];

  if (mavenModules.length > 0) {
    return buildMonorepoTopology({
      modulePaths: mavenModules,
      buildSystem,
    });
  }

  return buildSingleRepoTopology({ repoRoot, buildSystem });
}

function summarizeRepoTopology({ repoRoot, files = [] } = {}) {
  const topology = buildRepoTopology({ repoRoot, files });
  return {
    topology,
    topologyKind: topology.kind,
    buildSystem: detectBuildSystem({ repoRoot, files }),
    moduleCount: Array.isArray(topology.units) ? topology.units.filter((item) => item.kind === 'module').length : 0,
  };
}

function matchTopologyUnitsForFiles(topology, changedFiles = []) {
  const units = Array.isArray(topology && topology.units) ? topology.units : [];
  const moduleUnits = units.filter((item) => item && item.kind === 'module' && item.path);
  if (moduleUnits.length === 0) return [];

  const matched = new Set();
  for (const changedFile of changedFiles) {
    const normalized = normalizePath(changedFile);
    if (!normalized) continue;
    for (const unit of moduleUnits) {
      const prefix = normalizePath(unit.path).replace(/\/+$/g, '');
      if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
        matched.add(unit.id);
      }
    }
  }

  return [...matched];
}

module.exports = {
  buildRepoTopology,
  detectBuildSystem,
  matchTopologyUnitsForFiles,
  normalizePath,
  readPomModules,
  summarizeRepoTopology,
};
