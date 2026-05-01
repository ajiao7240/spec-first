#!/usr/bin/env node
'use strict';

const path = require('node:path');

const { createFinding } = require('./lib/finding');

const TRUSTED_REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function auditRuntimeDrift(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || process.cwd());
  const trustedRepoRoot = assertTrustedSpecFirstRepo(repoRoot, 'runtime drift audit');
  const report = {
    schema_version: 'spec-first.runtime-drift-report.v1',
    generated_at: new Date().toISOString(),
    runtime_checked: true,
    hosts: [],
    findings: [],
  };

  const plugin = require(path.join(trustedRepoRoot, 'src', 'cli', 'plugin'));
  const ClaudeAdapter = require(path.join(trustedRepoRoot, 'src', 'cli', 'adapters', 'claude'));
  const CodexAdapter = require(path.join(trustedRepoRoot, 'src', 'cli', 'adapters', 'codex'));

  for (const adapter of [new ClaudeAdapter(), new CodexAdapter()]) {
    const status = inspectHostRuntime({ repoRoot, adapter, inspectInstalledAssets: plugin.inspectInstalledAssets });
    report.hosts.push(status.host);
    report.findings.push(...status.findings);
  }

  report.summary = {
    finding_count: report.findings.length,
    p0_count: report.findings.filter((finding) => finding.severity === 'P0').length,
    p1_count: report.findings.filter((finding) => finding.severity === 'P1').length,
  };

  return report;
}

function assertTrustedSpecFirstRepo(repoRoot, featureName) {
  const realRepoRoot = require('node:fs').realpathSync(repoRoot);
  const realTrustedRoot = require('node:fs').realpathSync(TRUSTED_REPO_ROOT);
  if (realRepoRoot !== realTrustedRoot) {
    throw new Error(`${featureName} only supports the trusted spec-first source checkout; refusing to load code from ${repoRoot}`);
  }
  return realTrustedRoot;
}

function inspectHostRuntime({ repoRoot, adapter, inspectInstalledAssets }) {
  const runtimeRoot = path.join(repoRoot, adapter.runtimeRoot);
  const runtimeExists = require('node:fs').existsSync(runtimeRoot);
  const host = {
    host: adapter.id,
    runtime_root: adapter.runtimeRoot,
    status: runtimeExists ? 'checked' : 'not_initialized',
    missing: {},
    drifted: {},
  };
  const findings = [];

  if (!runtimeExists) {
    return { host, findings };
  }

  const inspected = inspectInstalledAssets(repoRoot, adapter);
  for (const area of ['commands', 'skills', 'agents', 'agentSupportFiles']) {
    const status = inspected[area] || { missing: [], drifted: [] };
    host.missing[area] = normalizeMissing(status.missing);
    host.drifted[area] = normalizeDrifted(status.drifted);

    for (const missing of host.missing[area]) {
      findings.push(createFinding({
        severity: area === 'commands' || area === 'skills' ? 'P1' : 'P2',
        category: 'runtime_missing_asset',
        title: `Runtime ${area} asset is missing`,
        evidence: [{ file: missing.runtime_path || missing.name || missing }],
        reason: `${adapter.id} runtime does not contain a managed asset expected by plugin.js inspection.`,
        recommendation: `Run spec-first init --${adapter.id}. Do not edit generated runtime assets directly.`,
        confidence: 'high',
        fix_mode: 'runtime-init-only',
      }));
    }

    for (const drifted of host.drifted[area]) {
      findings.push(createFinding({
        severity: area === 'commands' || area === 'skills' ? 'P1' : 'P2',
        category: 'runtime_drift',
        title: `Runtime ${area} asset has drifted`,
        evidence: [{ file: drifted.runtime_path || drifted.path || drifted.name || area }],
        reason: `${adapter.id} runtime content differs from the source transform inspected by plugin.js.`,
        recommendation: `Run spec-first init --${adapter.id}. Do not edit generated runtime assets directly.`,
        confidence: 'high',
        fix_mode: 'runtime-init-only',
      }));
    }
  }

  return { host, findings };
}

function normalizeMissing(values) {
  return (values || []).map((value) => {
    if (typeof value === 'string') return { name: value };
    if (value && typeof value === 'object') {
      return {
        name: value.name || value.skillName || value.filename || value.path || null,
        runtime_path: value.path || value.filename || null,
      };
    }
    return { name: String(value) };
  });
}

function normalizeDrifted(values) {
  return (values || []).map((value) => {
    if (typeof value === 'string') return { name: value };
    if (value && typeof value === 'object') {
      return {
        name: value.name || value.skillName || value.filename || value.path || null,
        runtime_path: value.runtimePath || value.path || value.filename || null,
        reason: value.reason || null,
      };
    }
    return { name: String(value) };
  });
}

function main(argv = process.argv.slice(2)) {
  const repoFlagIndex = argv.indexOf('--repo');
  const repoRoot = repoFlagIndex === -1 ? process.cwd() : argv[repoFlagIndex + 1];
  process.stdout.write(`${JSON.stringify(auditRuntimeDrift({ repoRoot }), null, 2)}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  assertTrustedSpecFirstRepo,
  auditRuntimeDrift,
  inspectHostRuntime,
  normalizeDrifted,
  normalizeMissing,
};
