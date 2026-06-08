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

function envValue(providerId, suffix) {
  const envName = `SPEC_FIRST_PROVIDER_${providerId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_${suffix}`;
  return process.env[envName];
}

function envFirstGenerationOverrides(providerId) {
  const status = envValue(providerId, 'FIRST_GENERATION_STATUS');
  const requirementWorkspacePath = envValue(providerId, 'REQUIREMENT_WORKSPACE_PATH');
  const artifactRoot = envValue(providerId, 'ARTIFACT_ROOT');
  const artifactRef = envValue(providerId, 'ARTIFACT_REF');
  const nextAction = envValue(providerId, 'FIRST_GENERATION_NEXT_ACTION');
  const overrides = {};
  if (status) overrides.firstGenerationStatus = status;
  if (requirementWorkspacePath) overrides.requirementWorkspacePath = requirementWorkspacePath;
  if (artifactRoot) overrides.artifactRoot = artifactRoot;
  if (artifactRef) overrides.artifactRefs = [artifactRef];
  if (nextAction) overrides.firstGenerationNextAction = nextAction;
  return overrides;
}

function artifactExists(repoDir, artifactPaths = []) {
  return artifactPaths.some((candidate) => (
    typeof candidate === 'string'
    && candidate.length > 0
    && fs.existsSync(path.join(repoDir, candidate))
  ));
}

function existingArtifactRefs(repoDir, artifactPaths = []) {
  return artifactPaths.filter((candidate) => (
    typeof candidate === 'string'
    && candidate.length > 0
    && fs.existsSync(path.join(repoDir, candidate))
  ));
}

function stringList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.length > 0) : [];
}

function firstGenerationFor(provider, options = {}) {
  const source = provider.first_generation && typeof provider.first_generation === 'object'
    ? provider.first_generation
    : {};
  return {
    owner: source.owner || 'unknown',
    status: options.firstGenerationStatus || source.status || 'unknown',
    scope: source.scope || 'unknown',
    requires_explicit_gate: source.requires_explicit_gate !== undefined
      ? Boolean(source.requires_explicit_gate)
      : false,
    requirement_workspace_path: options.requirementWorkspacePath !== undefined
      ? options.requirementWorkspacePath
      : (source.requirement_workspace_path || null),
    artifact_root: options.artifactRoot !== undefined
      ? options.artifactRoot
      : (source.artifact_root || null),
    artifact_refs: stringList(options.artifactRefs || source.artifact_refs),
    next_action: options.firstGenerationNextAction || source.next_action || null,
  };
}

function steadyStateFor(provider) {
  const source = provider.steady_state && typeof provider.steady_state === 'object'
    ? provider.steady_state
    : {};
  return {
    refresh_owner: source.refresh_owner || 'unknown',
    refresh_mode: source.refresh_mode || 'unknown',
    hook_default: source.hook_default !== undefined ? Boolean(source.hook_default) : false,
    usage_owner: source.usage_owner || 'unknown',
  };
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
    schema_version: 'provider-readiness.v2',
    provider: provider.id,
    kind: provider.kind || 'generic',
    profile: provider.profile || 'optional',
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
    native_interfaces: stringList(provider.native_interfaces),
    first_generation: firstGenerationFor(provider, options),
    steady_state: steadyStateFor(provider),
    usage_note: provider.usage_note || 'Use provider-native interfaces for advisory candidates; confirm conclusions from source/test/log/contract/user evidence.',
  };
}

function helperProviderEntries(registry, repoDir) {
  return (registry.providers || [])
    .filter((provider) => provider.install_route === 'install-helpers')
    .map((provider) => {
      const command = provider.detection && provider.detection.command;
      const installed = commandExists(command);
      const artifactPaths = provider.detection && provider.detection.artifact_paths;
      const artifact = artifactExists(repoDir, artifactPaths);
      const artifactRefs = existingArtifactRefs(repoDir, artifactPaths);
      const readinessStatus = installed ? selfReportedStatus(provider.id) : 'not-run';
      const nextActions = [];
      if (!installed) {
        nextActions.push(provider.installation && provider.installation.next_action);
      }
      if (installed && !artifact) {
        nextActions.push('Generate run-scoped project-graph artifacts for the project workspace or an explicit scoped workspace before using this provider as architecture navigation.');
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
        firstGenerationStatus: artifact ? 'completed' : 'not-run',
        artifactRefs,
        firstGenerationNextAction: installed && !artifact ? 'graphify-first-generation-required' : null,
        ...envFirstGenerationOverrides(provider.id),
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
    profile: 'optional',
    capability_class: 'code-graph',
    capabilities: ['code-graph', 'impact-candidates', 'affected-tests-candidates'],
    native_interfaces: ['mcp', 'cli'],
    first_generation: {
      owner: 'runtime-setup',
      status: 'not-run',
      scope: 'project',
      requires_explicit_gate: true,
      requirement_workspace_path: null,
      artifact_root: '.codegraph',
    },
    steady_state: {
      refresh_owner: 'provider-native',
      refresh_mode: 'watcher',
      hook_default: false,
      usage_owner: 'downstream-skill',
    },
    usage_note: 'Use CodeGraph MCP tools for impact/call graph candidates; confirm conclusions from source/test/log/contract/user evidence.',
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
    firstGenerationStatus: projectStatus === 'failed' ? 'failed' : (indexed ? 'completed' : 'not-run'),
    artifactRefs: indexed ? ['.codegraph/codegraph.db'] : [],
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
