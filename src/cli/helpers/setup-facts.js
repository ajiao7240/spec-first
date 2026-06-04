'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SETUP_FACTS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const READY_CONFIGURED_STATUSES = new Set(['ready', 'not-applicable', 'not-required', 'fallback-active']);
const ACTION_CONFIGURED_STATUSES = new Set(['action-required', 'precedence-blocked']);
const DEGRADED_CONFIGURED_STATUSES = new Set(['registry-args-drift']);

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function loadHelperRegistry(repoRoot = path.join(__dirname, '..', '..', '..')) {
  const registryPath = path.join(repoRoot, 'skills', 'spec-mcp-setup', 'helper-tools.json');
  return {
    path: registryPath,
    registry: readJsonFile(registryPath),
  };
}

function helperById(registry) {
  const entries = Array.isArray(registry && registry.helpers) ? registry.helpers : [];
  return new Map(entries.map((entry) => [entry.id, entry]));
}

function normalizeSetupFactsFile(factsPath, options = {}) {
  if (!factsPath) {
    return buildUnavailableProjection({
      status: 'missing',
      reasonCode: 'setup-facts-missing',
      artifactRefs: [],
    });
  }

  if (!fs.existsSync(factsPath)) {
    return buildUnavailableProjection({
      status: 'missing',
      reasonCode: 'setup-facts-missing',
      artifactRefs: [factsPath],
    });
  }

  let facts;
  try {
    facts = readJsonFile(factsPath);
  } catch (_error) {
    return buildUnavailableProjection({
      status: 'error',
      reasonCode: 'setup-facts-unreadable',
      artifactRefs: [factsPath],
    });
  }

  return normalizeSetupFacts(facts, {
    ...options,
    factsPath,
  });
}

function normalizeSetupFacts(facts, options = {}) {
  if (!facts || typeof facts !== 'object' || Array.isArray(facts)) {
    return buildUnavailableProjection({
      status: 'error',
      reasonCode: 'setup-facts-invalid',
      artifactRefs: options.factsPath ? [options.factsPath] : [],
    });
  }

  const schemaVersion = String(facts.schema_version || '');
  if (!['tool-facts.v1', 'tool-facts.v2'].includes(schemaVersion)) {
    return buildUnavailableProjection({
      status: 'error',
      reasonCode: 'setup-facts-schema-unsupported',
      artifactRefs: options.factsPath ? [options.factsPath] : [],
      schemaVersions: { tool_facts: schemaVersion || 'unknown' },
    });
  }

  const items = schemaVersion === 'tool-facts.v2'
    ? normalizeItemsArray(facts.items, facts)
    : normalizeLegacyItems(facts);
  const configuredDependencies = normalizeConfiguredDependencies(facts.configured_dependencies);
  const providerReadiness = normalizeProviderReadiness(facts.provider_readiness);
  const generatedAt = typeof facts.generated_at === 'string' ? facts.generated_at : null;
  const freshness = computeFreshness(generatedAt, options.now || new Date(), options.maxAgeMs || SETUP_FACTS_MAX_AGE_MS);

  const counts = computeCounts(items);
  const configuredDependencyCounts = computeConfiguredDependencyCounts(configuredDependencies);
  const providerCounts = computeProviderCounts(providerReadiness);
  const artifactRefs = options.factsPath ? [options.factsPath] : [];

  return {
    status: 'ready',
    reason_code: 'setup-facts-normalized',
    schema_versions: {
      tool_facts: schemaVersion,
    },
    artifact_refs: artifactRefs,
    generated_at: generatedAt,
    freshness,
    profile: normalizeProfile(facts.profile),
    repo_root: typeof facts.repo_root === 'string' ? facts.repo_root : null,
    host: facts.host || null,
    platform: facts.platform || null,
    items,
    configured_dependencies: configuredDependencies,
    provider_readiness: providerReadiness,
    counts,
    configured_dependency_counts: configuredDependencyCounts,
    provider_counts: providerCounts,
    raw: facts,
  };
}

function buildUnavailableProjection({ status, reasonCode, artifactRefs = [], schemaVersions = {} }) {
  return {
    status,
    reason_code: reasonCode,
    schema_versions: schemaVersions,
    artifact_refs: artifactRefs,
    generated_at: null,
    freshness: {
      status: 'missing',
      generated_at: null,
      age_ms: null,
      max_age_ms: SETUP_FACTS_MAX_AGE_MS,
      reason_code: reasonCode,
    },
    profile: 'minimal',
    repo_root: null,
    host: null,
    platform: null,
    items: [],
    configured_dependencies: [],
    provider_readiness: [],
    counts: {
      required_action: 0,
      degraded: 0,
      skipped: 0,
      ready: 0,
      total: 0,
    },
    configured_dependency_counts: {
      action_required: 0,
      undeclared: 0,
      total: 0,
    },
    provider_counts: {
      missing: 0,
      stale: 0,
      fresh: 0,
      degraded: 0,
      unknown: 0,
      total: 0,
    },
    raw: null,
  };
}

function normalizeLegacyItems(facts) {
  const tools = facts.tools && typeof facts.tools === 'object' ? facts.tools : {};
  const helpers = facts.helper_tools && typeof facts.helper_tools === 'object' ? facts.helper_tools : {};
  return [
    ...Object.entries(tools).map(([id, value]) => normalizeItem(id, value, 'mcp', facts)),
    ...Object.entries(helpers).map(([id, value]) => normalizeItem(id, value, value.type || 'helper', facts)),
  ];
}

function normalizeItemsArray(items, facts) {
  if (!Array.isArray(items)) {
    return normalizeLegacyItems(facts);
  }
  return items.map((item) => normalizeItem(item.id, item, item.kind || item.type || 'tool', facts));
}

function normalizeItem(id, value, kind, facts) {
  const source = value && typeof value === 'object' ? value : {};
  const dependencyStatus = source.dependency_status || source.status || 'unknown';
  const configuredStatus = source.configured_status || source.host_config_status || source.project_status || 'not-checked';
  const projectStatus = source.project_status || 'not-applicable';
  const required = toBoolean(source.required, true);
  const baselineBlocking = toBoolean(source.baseline_blocking, required);
  const result = inferItemResult({
    source,
    dependencyStatus,
    configuredStatus,
    projectStatus,
  });
  const installed = dependencyStatus === 'ready' || dependencyStatus === 'ok' || source.installed === true;
  return {
    ...source,
    id: id || source.id || 'unknown',
    kind,
    profile: normalizeProfile(source.profile || facts.profile),
    required,
    baseline_blocking: baselineBlocking,
    dependency_status: dependencyStatus,
    configured_status: configuredStatus,
    result,
    reason_code: inferReasonCode({
      sourceReasonCode: source.reason_code,
      dependencyStatus,
      configuredStatus,
      projectStatus,
      result,
      baselineBlocking,
    }),
    installed,
    missing_dependency_reason: installed ? null : (source.missing_dependency_reason || 'missing_dependency'),
    next_action: source.next_action || '',
  };
}

function inferItemResult({ source, dependencyStatus, configuredStatus, projectStatus }) {
  const sourceResult = typeof source.result === 'string' ? source.result : null;
  if (sourceResult === 'skipped') return 'skipped';
  if (ACTION_CONFIGURED_STATUSES.has(configuredStatus)) return 'action-required';
  if (dependencyStatus !== 'ready' && dependencyStatus !== 'ok') {
    if (sourceResult === 'degraded') return 'degraded';
    if (sourceResult && sourceResult !== 'ready') return sourceResult;
    return 'action-required';
  }
  if (DEGRADED_CONFIGURED_STATUSES.has(configuredStatus)) return 'degraded';
  if (projectStatus === 'pending' || projectStatus === 'failed') return 'action-required';
  if (sourceResult && sourceResult !== 'ready') return sourceResult;
  if (source.status === 'ready' || source.status === 'ok') return 'ready';
  if (sourceResult === 'ready') return 'ready';
  if (READY_CONFIGURED_STATUSES.has(configuredStatus)) return 'ready';
  if (source.status === 'missing') return 'action-required';
  return source.status || 'unknown';
}

function inferReasonCode({ sourceReasonCode, dependencyStatus, configuredStatus, projectStatus, result, baselineBlocking }) {
  if (result === 'ready') return 'ready';
  if (result === 'skipped') return sourceReasonCode && sourceReasonCode !== 'ready' ? sourceReasonCode : 'optional-skipped';
  if (DEGRADED_CONFIGURED_STATUSES.has(configuredStatus)) return 'host-config-version-drift';
  if (dependencyStatus === 'missing') return 'missing_dependency';
  if (configuredStatus === 'action-required') return 'host-config-action-required';
  if (configuredStatus === 'precedence-blocked') return 'host-config-precedence-blocked';
  if (projectStatus === 'pending') return 'project-bootstrap-pending';
  if (projectStatus === 'failed') return 'project-bootstrap-failed';
  if (result === 'degraded') {
    return sourceReasonCode && sourceReasonCode !== 'ready'
      ? sourceReasonCode
      : (baselineBlocking ? 'baseline-degraded' : 'optional-capability-degraded');
  }
  if (result === 'action-required') return 'required-runtime-action-required';
  return sourceReasonCode || 'unknown';
}

function normalizeConfiguredDependencies(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => ({
    id: entry.id || `${entry.kind || 'configured'}:${entry.command || 'unknown'}`,
    kind: entry.kind || 'configured',
    source_path: entry.source_path || '',
    command: entry.command || '',
    args_shape: entry.args_shape || 'unknown',
    declared_tool_id: entry.declared_tool_id || null,
    declared_status: entry.declared_status || 'unknown',
    dependency_status: entry.dependency_status || 'unknown',
    configured_status: entry.configured_status || 'unknown',
    result: entry.result || 'unknown',
    reason_code: entry.reason_code || 'unknown',
  }));
}

function normalizeProviderReadiness(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => ({
    schema_version: 'provider-readiness.v1',
    provider: entry.provider || 'unknown',
    kind: entry.kind || 'generic',
    profile: normalizeProfile(entry.profile),
    readiness_status: normalizeProviderStatus(entry.readiness_status),
    lifecycle: {
      installed: Boolean(entry.lifecycle && entry.lifecycle.installed),
      configured: Boolean(entry.lifecycle && entry.lifecycle.configured),
      initialized: Boolean(entry.lifecycle && entry.lifecycle.initialized),
      indexed: Boolean(entry.lifecycle && entry.lifecycle.indexed),
      server_reachable: Boolean(entry.lifecycle && entry.lifecycle.server_reachable),
      artifact_exists: Boolean(entry.lifecycle && entry.lifecycle.artifact_exists),
      query_verified: Boolean(entry.lifecycle && entry.lifecycle.query_verified),
      fallback_used: Boolean(entry.lifecycle && entry.lifecycle.fallback_used),
    },
    repo_aligned: entry.repo_aligned || 'unknown',
    fallback: entry.fallback || { available: true, methods: ['rg', 'direct-source-read'], reason_code: 'provider-not-run' },
  }));
}

function normalizeProfile(value) {
  return ['minimal', 'recommended', 'platform'].includes(value) ? value : 'minimal';
}

function normalizeProviderStatus(value) {
  return ['fresh', 'stale', 'degraded', 'not-run', 'unknown'].includes(value) ? value : 'unknown';
}

function computeFreshness(generatedAt, now, maxAgeMs) {
  if (!generatedAt) {
    return {
      status: 'missing',
      generated_at: null,
      age_ms: null,
      max_age_ms: maxAgeMs,
      reason_code: 'setup-facts-generated-at-missing',
    };
  }
  const generatedTime = Date.parse(generatedAt);
  if (!Number.isFinite(generatedTime)) {
    return {
      status: 'unknown',
      generated_at: generatedAt,
      age_ms: null,
      max_age_ms: maxAgeMs,
      reason_code: 'setup-facts-generated-at-invalid',
    };
  }
  const nowTime = now instanceof Date ? now.getTime() : Date.parse(now);
  const ageMs = Math.max(0, nowTime - generatedTime);
  if (ageMs > maxAgeMs) {
    return {
      status: 'stale',
      generated_at: generatedAt,
      age_ms: ageMs,
      max_age_ms: maxAgeMs,
      reason_code: 'setup-facts-stale',
    };
  }
  return {
    status: 'fresh',
    generated_at: generatedAt,
    age_ms: ageMs,
    max_age_ms: maxAgeMs,
    reason_code: 'setup-facts-fresh',
  };
}

function computeCounts(items) {
  const counts = {
    required_action: 0,
    degraded: 0,
    skipped: 0,
    ready: 0,
    total: items.length,
  };
  for (const item of items) {
    if (item.result === 'ready') counts.ready += 1;
    if (item.result === 'degraded') counts.degraded += 1;
    if (item.result === 'skipped') counts.skipped += 1;
    if (isRequiredAction(item)) counts.required_action += 1;
  }
  return counts;
}

function computeConfiguredDependencyCounts(entries) {
  return {
    action_required: entries.filter((entry) => entry.result === 'action-required').length,
    undeclared: entries.filter((entry) => entry.reason_code === 'configured-dependency-undeclared').length,
    total: entries.length,
  };
}

function computeProviderCounts(entries) {
  return {
    missing: entries.filter((entry) => entry.readiness_status === 'not-run').length,
    stale: entries.filter((entry) => entry.readiness_status === 'stale').length,
    fresh: entries.filter((entry) => entry.readiness_status === 'fresh').length,
    degraded: entries.filter((entry) => entry.readiness_status === 'degraded').length,
    unknown: entries.filter((entry) => entry.readiness_status === 'unknown').length,
    total: entries.length,
  };
}

function isRequiredAction(item) {
  if (item.result !== 'action-required') return false;
  return item.baseline_blocking !== false || item.required === true;
}

function computeDecisionInputHealth({ projectRoot, platforms = [], factsPath, now } = {}) {
  if (!Array.isArray(platforms) || platforms.length === 0) {
    const projection = buildUnavailableProjection({
      status: 'not_checked',
      reasonCode: 'no-host-selected',
      artifactRefs: [],
    });
    return buildDecisionResult('not_checked', 'no-host-selected', projection);
  }

  const resolvedFactsPath = factsPath || path.join(projectRoot, '.spec-first', 'config', 'tool-facts.json');
  const projection = normalizeSetupFactsFile(resolvedFactsPath, { now });
  if (projection.status === 'missing') {
    return buildDecisionResult('missing', 'setup-facts-missing', projection);
  }
  if (projection.status === 'error') {
    const reasonCode = projection.reason_code === 'setup-facts-unreadable'
      ? 'setup-facts-invalid'
      : projection.reason_code;
    return buildDecisionResult('error', reasonCode, projection);
  }
  if (projection.host && !platforms.map(String).includes(String(projection.host))) {
    return buildDecisionResult('missing', 'setup-facts-host-mismatch', projection, { requestedPlatforms: platforms });
  }
  if (projection.freshness.status === 'stale') {
    return buildDecisionResult('stale', 'setup-facts-stale', projection);
  }
  if (projection.counts.required_action > 0 || projection.configured_dependency_counts.action_required > 0) {
    return buildDecisionResult('error', 'required-runtime-action-required', projection);
  }
  if (
    projection.counts.degraded > 0
    || projection.counts.skipped > 0
    || projection.provider_counts.missing > 0
    || projection.provider_counts.stale > 0
    || projection.provider_counts.degraded > 0
  ) {
    return buildDecisionResult('warn', 'optional-capability-degraded', projection);
  }
  return buildDecisionResult('pass', 'setup-facts-ready', projection);
}

function buildDecisionResult(status, reasonCode, projection, options = {}) {
  return {
    status,
    basis: {
      reason_code: reasonCode,
      artifact_refs: projection.artifact_refs,
      schema_versions: projection.schema_versions,
      facts_host: projection.host,
      facts_platform: projection.platform,
      requested_platforms: Array.isArray(options.requestedPlatforms) ? options.requestedPlatforms : undefined,
      freshness: projection.freshness,
      required_action_count: projection.counts.required_action,
      degraded_count: projection.counts.degraded,
      skipped_count: projection.counts.skipped,
      configured_dependency_counts: projection.configured_dependency_counts,
      provider_counts: projection.provider_counts,
    },
    normalized: projection,
  };
}

function toBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

module.exports = {
  SETUP_FACTS_MAX_AGE_MS,
  computeDecisionInputHealth,
  helperById,
  loadHelperRegistry,
  normalizeSetupFacts,
  normalizeSetupFactsFile,
};
