#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  DEFAULT_OUTPUT_PATH,
  buildRuntimeCapabilityCatalog,
} = require('./generate-runtime-capability-catalog');

const REPO_ROOT = path.resolve(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');
const GOVERNANCE_PATH = path.join(
  REPO_ROOT,
  'src',
  'cli',
  'contracts',
  'dual-host-governance',
  'skills-governance.json',
);
const REQUIRED_STANDALONE_SUMMARIES = ['using-spec-first', 'spec-write-tasks'];
const REQUIRED_GRAPH_CONTRACT_FILES = [
  'docs/contracts/gitnexus-capability-catalog.md',
  'docs/contracts/graph-evidence-policy.md',
  'docs/contracts/graph-provider-consumption.md',
  'docs/contracts/workspace-gitnexus-consumption.md',
];

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(read(filePath));
}

function repoPath(...segments) {
  return path.join(REPO_ROOT, ...segments);
}

function hasContractSummary(skillName) {
  const skillPath = repoPath('skills', skillName, 'SKILL.md');
  if (!fs.existsSync(skillPath)) return false;
  const firstHundredTwentyLines = read(skillPath).split(/\r?\n/).slice(0, 120).join('\n');
  return /## (Workflow )?Contract Summary/.test(firstHundredTwentyLines);
}

function guard({ guardId, classification, artifactPath, checkedSources, ok, passReason, failReason }) {
  return {
    guard_id: guardId,
    result: ok ? 'pass' : 'fail',
    reason_code: ok ? passReason : failReason,
    classification,
    artifact_path: artifactPath,
    checked_sources: checkedSources,
  };
}

function checkRuntimeCatalogFresh() {
  const actual = read(DEFAULT_OUTPUT_PATH);
  const expected = buildRuntimeCapabilityCatalog();
  return guard({
    guardId: 'runtime-capability-catalog-fresh',
    classification: 'blocking',
    artifactPath: path.relative(REPO_ROOT, DEFAULT_OUTPUT_PATH),
    checkedSources: [
      'scripts/generate-runtime-capability-catalog.js',
      'src/cli/plugin.js',
      'src/cli/contracts/dual-host-governance/skills-governance.json',
      'docs/contracts/workflows/*.schema.json',
      'docs/catalog/runtime-capabilities.md',
    ],
    ok: actual === expected,
    passReason: 'runtime-catalog-current',
    failReason: 'runtime-catalog-stale',
  });
}

function checkPublicWorkflowSummaries() {
  const governance = readJson(GOVERNANCE_PATH);
  const workflowSkills = governance.skills
    .filter((skill) => skill.entry_surface === 'workflow_command')
    .map((skill) => skill.skill_name)
    .sort((a, b) => a.localeCompare(b));
  const coveredSkills = [...workflowSkills, ...REQUIRED_STANDALONE_SUMMARIES];
  const missing = coveredSkills.filter((skillName) => !hasContractSummary(skillName));

  return guard({
    guardId: 'public-workflow-contract-summary-coverage',
    classification: 'blocking',
    artifactPath: 'src/cli/contracts/dual-host-governance/skills-governance.json',
    checkedSources: [
      'src/cli/contracts/dual-host-governance/skills-governance.json',
      ...coveredSkills.map((skillName) => `skills/${skillName}/SKILL.md`),
    ],
    ok: missing.length === 0,
    passReason: 'public-workflow-summaries-current',
    failReason: `public-workflow-summaries-missing:${missing.join(',')}`,
  });
}

function checkPackageDeliverySurface() {
  const pkg = readJson(PACKAGE_JSON_PATH);
  const requiredFiles = [
    'docs/contracts/workflows/',
    ...REQUIRED_GRAPH_CONTRACT_FILES,
    'scripts/check-release-continuity.cjs',
    'scripts/check-website-sync.cjs',
    'scripts/generate-runtime-capability-catalog.js',
    'scripts/run-test-suite.cjs',
    'src/',
    'skills/',
    'templates/',
  ];
  const declaredFiles = Array.isArray(pkg.files) ? pkg.files : [];
  const missing = requiredFiles.filter((entry) => !declaredFiles.includes(entry));

  return guard({
    guardId: 'package-delivery-surface',
    classification: 'blocking',
    artifactPath: 'package.json',
    checkedSources: [
      'package.json',
      'skills/spec-plan/references/graph-evidence-posture.md',
      ...REQUIRED_GRAPH_CONTRACT_FILES,
    ],
    ok: declaredFiles.length > 0 && missing.length === 0,
    passReason: 'package-delivery-surface-current',
    failReason: declaredFiles.length === 0
      ? 'package-delivery-surface-missing-files-field'
      : `package-delivery-surface-missing:${missing.join(',')}`,
  });
}

function checkWebsiteGatePreserved() {
  const pkg = readJson(PACKAGE_JSON_PATH);
  const publisher = read(repoPath('scripts', 'release-publish.cjs'));
  const scripts = pkg.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {};
  const ok = (
    scripts['test:release:website'] === 'node scripts/check-website-sync.cjs --required'
    && publisher.includes("runNpmChecked(['run', 'test:release:website'])")
  );

  return guard({
    guardId: 'website-sync-release-gate-preserved',
    classification: 'blocking',
    artifactPath: 'docs/contracts/website-sync-contract.md',
    checkedSources: [
      'package.json',
      'scripts/release-publish.cjs',
      'scripts/check-website-sync.cjs',
      'docs/contracts/website-sync-contract.md',
    ],
    ok,
    passReason: 'website-sync-release-gate-preserved',
    failReason: 'website-sync-release-gate-missing',
  });
}

function checkReadmeBoundaryLinks() {
  const readme = read(repoPath('README.md'));
  const readmeZh = read(repoPath('README.zh-CN.md'));
  const target = 'docs/contracts/source-runtime-customization-boundary.md';
  const ok = readme.includes(target) && readmeZh.includes(target);

  return guard({
    guardId: 'readme-source-runtime-boundary-links',
    classification: 'docs-only-no-impact',
    artifactPath: 'docs/contracts/source-runtime-customization-boundary.md',
    checkedSources: ['README.md', 'README.zh-CN.md', target],
    ok,
    passReason: 'readme-boundary-links-current',
    failReason: 'readme-boundary-links-missing',
  });
}

function runChecks() {
  const guards = [
    checkRuntimeCatalogFresh(),
    checkPublicWorkflowSummaries(),
    checkPackageDeliverySurface(),
    checkWebsiteGatePreserved(),
    checkReadmeBoundaryLinks(),
  ];
  const blockingFailures = guards.filter((entry) => (
    entry.result === 'fail' && entry.classification === 'blocking'
  ));
  const advisoryFailures = guards.filter((entry) => (
    entry.result === 'fail' && entry.classification !== 'blocking'
  ));

  return {
    schema_version: 'release-continuity-guard/v1',
    status: blockingFailures.length === 0 ? 'passed' : 'failed',
    generated_at: new Date().toISOString(),
    guards,
    blocking_failures: blockingFailures,
    advisory_failures: advisoryFailures,
  };
}

function renderText(result) {
  const lines = [
    `release continuity guard: ${result.status}`,
    ...result.guards.map((entry) => (
      `- ${entry.guard_id}: ${entry.result} ${entry.classification} ${entry.reason_code} (${entry.artifact_path})`
    )),
  ];
  return `${lines.join('\n')}\n`;
}

function main(argv = process.argv.slice(2)) {
  const json = argv.includes('--json');
  const result = runChecks();
  process.stdout.write(json ? `${JSON.stringify(result, null, 2)}\n` : renderText(result));
  return result.status === 'passed' ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  main,
  runChecks,
};
