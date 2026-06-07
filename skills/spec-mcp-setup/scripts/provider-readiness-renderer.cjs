#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const providerRegistryPath = path.join(repoRoot, 'skills', 'spec-mcp-setup', 'provider-tools.json');

function readJson(filePath, fallback = null) {
  if (!filePath) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_error) {
    return fallback;
  }
}

function parseArgs(argv) {
  const args = {
    source: 'helper',
    repoRoot: process.cwd(),
    factsFile: '',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--source') {
      args.source = argv[index + 1] || args.source;
      index += 1;
    } else if (arg === '--repo-root') {
      args.repoRoot = argv[index + 1] || args.repoRoot;
      index += 1;
    } else if (arg === '--facts-file') {
      args.factsFile = argv[index + 1] || '';
      index += 1;
    }
  }
  return args;
}

function commandExists(command) {
  if (!command) return false;
  if (process.platform === 'win32') {
    const result = spawnSync('where.exe', [command], { stdio: 'ignore' });
    return result.status === 0;
  }
  const result = spawnSync('/bin/sh', ['-lc', `command -v ${shellQuote(command)} >/dev/null 2>&1`], { stdio: 'ignore' });
  return result.status === 0;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function envFlag(name) {
  return ['1', 'true', 'yes', 'ready'].includes(String(process.env[name] || '').toLowerCase());
}

function selfReportedStatus(providerId) {
  const envName = `SPEC_FIRST_PROVIDER_${providerId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_SELF_REPORTED_STATUS`;
  const value = String(process.env[envName] || '').toLowerCase();
  if (value === 'stale') return 'stale';
  if (value === 'fresh') return 'unknown';
  if (value === 'degraded') return 'degraded';
  return 'unknown';
}

function artifactExists(repoDir, artifactPaths = []) {
  return artifactPaths.some((candidate) => (
    typeof candidate === 'string'
    && candidate.length > 0
    && fs.existsSync(path.join(repoDir, candidate))
  ));
}

function fallbackFor(provider) {
  return provider.fallback || {
    available: true,
    methods: ['rg', 'direct-source-read'],
    reason_code: 'provider-unavailable',
  };
}

function providerEntry(provider, options = {}) {
  const installed = Boolean(options.installed);
  const configured = Boolean(options.configured);
  const indexed = Boolean(options.indexed);
  const artifact = Boolean(options.artifactExists);
  const serverReachable = Boolean(options.serverReachable);
  const queryVerified = Boolean(options.queryVerified);
  const readinessStatus = options.readinessStatus || (installed ? 'unknown' : 'not-run');
  const nextActions = Array.isArray(options.nextActions) ? options.nextActions.filter(Boolean) : [];

  return {
    schema_version: 'provider-readiness.v1',
    provider: provider.id,
    kind: provider.kind || 'generic',
    profile: provider.profile || 'minimal',
    readiness_status: readinessStatus,
    lifecycle: {
      installed,
      configured,
      initialized: false,
      indexed,
      server_reachable: serverReachable,
      artifact_exists: artifact,
      query_verified: queryVerified,
      fallback_used: false,
    },
    repo_aligned: options.repoAligned || 'unknown',
    capabilities: provider.capabilities || [provider.capability_class].filter(Boolean),
    limitations: options.limitations || [
      'provider readiness is advisory; fresh self-reports map to unknown until confirmed by source/test/log evidence',
    ],
    source_read_required: true,
    fallback: fallbackFor(provider),
    next_actions: nextActions,
  };
}

function helperProviderEntries(registry, repoDir) {
  return (registry.providers || [])
    .filter((provider) => provider.install_route === 'install-helpers')
    .map((provider) => {
      const command = provider.detection && provider.detection.command;
      const installed = commandExists(command);
      const artifact = artifactExists(repoDir, provider.detection && provider.detection.artifact_paths);
      const readinessStatus = installed ? selfReportedStatus(provider.id) : 'not-run';
      const nextActions = [];
      if (!installed) {
        nextActions.push(provider.installation && provider.installation.next_action);
      }
      if (installed && !artifact) {
        nextActions.push('Generate run-scoped project-graph artifacts for the current requirement workspace before using this provider as architecture navigation.');
      }
      return providerEntry(provider, {
        installed,
        configured: false,
        indexed: artifact,
        artifactExists: artifact,
        serverReachable: false,
        queryVerified: false,
        readinessStatus,
        repoAligned: artifact ? 'unknown' : 'unknown',
        nextActions,
      });
    });
}

function normalizeToolStatus(value) {
  return typeof value === 'string' && value.length > 0 ? value : 'unknown';
}

function mcpProviderEntries(facts) {
  const tools = facts && facts.tools && typeof facts.tools === 'object' ? facts.tools : {};
  const codegraph = tools.codegraph;
  if (!codegraph || typeof codegraph !== 'object') return [];

  const metadata = {
    id: 'codegraph',
    kind: 'code-structure',
    profile: 'recommended',
    capability_class: 'code-graph',
    capabilities: ['code-graph', 'impact-candidates', 'affected-tests-candidates'],
    fallback: {
      available: true,
      methods: ['rg', 'ast-grep', 'direct-source-read'],
      reason_code: 'code-graph-provider-unavailable',
    },
  };
  const dependencyStatus = normalizeToolStatus(codegraph.dependency_status || codegraph.status);
  const hostStatus = normalizeToolStatus(codegraph.host_config_status || codegraph.configured_status);
  const projectStatus = normalizeToolStatus(codegraph.project_status);
  const optionalNotSelected = codegraph.reason_code === 'optional-capability-not-selected';
  const installed = !optionalNotSelected && (
    dependencyStatus === 'ready'
    || dependencyStatus === 'ok'
    || codegraph.installed === true
  );
  const configured = codegraph.configured === true
    || hostStatus === 'ready'
    || hostStatus === 'fallback-active'
    || hostStatus === 'registry-args-drift';
  const indexed = projectStatus === 'ready';
  let readinessStatus = installed ? selfReportedStatus('codegraph') : 'not-run';
  if (projectStatus === 'failed') readinessStatus = 'degraded';
  const nextActions = [];
  if (codegraph.next_action) nextActions.push(codegraph.next_action);
  if (installed && !indexed) nextActions.push('Run CodeGraph project bootstrap before relying on code-graph candidates.');
  const serverReachable = envFlag('SPEC_FIRST_PROVIDER_CODEGRAPH_SERVER_REACHABLE');
  const queryVerified = envFlag('SPEC_FIRST_PROVIDER_CODEGRAPH_QUERY_VERIFIED');
  if (installed && configured && indexed && !serverReachable) {
    nextActions.push('Run CodeGraph server/probe verification before treating server_reachable as true.');
  }
  if (serverReachable && !queryVerified) {
    nextActions.push('Run a CodeGraph query probe before treating query_verified as true.');
  }

  return [providerEntry(metadata, {
    installed,
    configured,
    indexed,
    artifactExists: indexed,
    serverReachable,
    queryVerified,
    readinessStatus,
    repoAligned: indexed ? 'unknown' : 'unknown',
    nextActions,
  })];
}

function uniqueByProvider(entries) {
  const byProvider = new Map();
  for (const entry of entries) {
    if (!entry || !entry.provider) continue;
    byProvider.set(entry.provider, entry);
  }
  return Array.from(byProvider.values());
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const registry = readJson(providerRegistryPath, { providers: [] });
  const facts = readJson(args.factsFile, {});
  const repoDir = path.resolve(args.repoRoot || process.cwd());
  const entries = [];

  if (args.source === 'helper' || args.source === 'all') {
    entries.push(...helperProviderEntries(registry, repoDir));
  }
  if (args.source === 'mcp' || args.source === 'all') {
    entries.push(...mcpProviderEntries(facts));
  }

  process.stdout.write(`${JSON.stringify(uniqueByProvider(entries), null, 2)}\n`);
}

main();
