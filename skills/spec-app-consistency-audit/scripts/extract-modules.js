#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  evidence,
  listSourceTextFiles,
  makeArtifact,
  parseCommonArgs,
  readText,
  relativeTo,
  slugify,
  sourceInputFromFiles,
  unique,
  writeJsonOutput,
} = require('./lib/audit-utils');

function extractModules(options = {}) {
  const scan = listSourceTextFiles(options);
  const { sourceRoot, repoRoot, files } = scan;
  const settingsFiles = files.filter((filePath) => /settings\.gradle(\.kts)?$/.test(filePath));
  const buildFiles = files.filter((filePath) => /build\.gradle(\.kts)?$/.test(filePath));
  const modules = detectModules(sourceRoot, repoRoot, settingsFiles, buildFiles);
  const dependencies = detectModuleDependencies(repoRoot, buildFiles);

  return makeArtifact({
    schemaVersion: 'module-contract.v1',
    artifactId: 'module-contract',
    sourceInputs: [sourceInputFromFiles('code', [...settingsFiles, ...buildFiles], repoRoot, scan.truncated ? scan : {})],
    body: {
      modules,
      dependencies,
      module_count: modules.length,
      dependency_count: dependencies.length,
      boundary_candidates: detectModuleBoundaryCandidates(dependencies),
      extraction_notes: [
        'Module graph is a static candidate derived from Gradle settings and project dependencies.',
      ],
      degraded_modes: [
        ...scan.degraded_modes,
        ...(settingsFiles.length === 0 ? [{
          code: 'gradle_settings_missing',
          severity: 'info',
          summary: 'settings.gradle(.kts) was not found; module graph may be incomplete.',
          path: null,
        }] : []),
      ],
    },
  });
}

function detectModules(sourceRoot, repoRoot, settingsFiles, buildFiles) {
  const names = [];
  for (const filePath of settingsFiles) {
    const text = readText(filePath);
    const matches = text.matchAll(/include\s*\(([^)]*)\)|include\s+([^\n]+)/g);
    for (const match of matches) {
      const raw = match[1] || match[2] || '';
      const moduleMatches = raw.match(/["'](:[^"']+)["']/g) || [];
      for (const moduleMatch of moduleMatches) names.push(moduleMatch.replace(/["']/g, ''));
    }
  }
  for (const filePath of buildFiles) {
    const rel = relativeTo(repoRoot, filePath);
    const parts = rel.split('/');
    if (parts.length > 1) names.push(`:${parts.slice(0, -1).join(':')}`);
  }
  return unique(names).map((name) => {
    const dir = moduleNameToDir(sourceRoot, name);
    return {
      id: slugify(name),
      name,
      path: fs.existsSync(dir) ? relativeTo(repoRoot, dir) : null,
      kind: classifyModule(name),
      status: 'candidate',
      evidence: [evidence('code', settingsFiles[0] ? relativeTo(repoRoot, settingsFiles[0]) : null, `Gradle module candidate: ${name}`)],
    };
  });
}

function detectModuleDependencies(repoRoot, buildFiles) {
  const dependencies = [];
  for (const filePath of buildFiles) {
    const rel = relativeTo(repoRoot, filePath);
    const from = `:${rel.split('/').slice(0, -1).join(':')}`;
    const text = readText(filePath);
    const matches = text.matchAll(/project\s*\(\s*["'](:[^"']+)["']\s*\)/g);
    for (const match of matches) {
      dependencies.push({
        from,
        to: match[1],
        status: 'candidate',
        evidence: [evidence('code', rel, `${from} depends on ${match[1]}`)],
      });
    }
  }
  return dependencies;
}

function detectModuleBoundaryCandidates(dependencies) {
  const candidates = [];
  for (const dependency of dependencies) {
    const fromKind = classifyModule(dependency.from);
    const toKind = classifyModule(dependency.to);
    if (fromKind === 'core' && toKind === 'feature') {
      candidates.push(boundaryCandidate('core_depends_on_feature', dependency));
    }
    if (fromKind === 'feature' && toKind === 'feature') {
      candidates.push(boundaryCandidate('feature_depends_on_feature', dependency));
    }
  }
  return candidates;
}

function classifyModule(name) {
  const lower = String(name || '').toLowerCase();
  if (/design|uikit|component/.test(lower)) return 'design-system';
  if (/analytics|tracking|telemetry/.test(lower)) return 'analytics';
  if (/i18n|l10n|locale|string/.test(lower)) return 'i18n';
  if (/core|common|shared/.test(lower)) return 'core';
  if (/feature/.test(lower)) return 'feature';
  if (/app|android|ios/.test(lower)) return 'app';
  return 'module';
}

function moduleNameToDir(sourceRoot, name) {
  return path.join(sourceRoot, String(name).replace(/^:/, '').replace(/:/g, '/'));
}

function boundaryCandidate(type, dependency) {
  return {
    type,
    from: dependency.from,
    to: dependency.to,
    status: 'candidate',
    needs_semantic_review: true,
    evidence: dependency.evidence,
  };
}

if (require.main === module) {
  try {
    const options = parseCommonArgs(process.argv.slice(2));
    writeJsonOutput(extractModules(options), options.output);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  detectModuleBoundaryCandidates,
  extractModules,
};
