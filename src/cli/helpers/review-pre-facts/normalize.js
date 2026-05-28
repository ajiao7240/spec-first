'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  isExactRepoRelativePath,
  isSecretDeniedPath,
} = require('../secret-deny-patterns');
const { LIMITS } = require('./constants');
const {
  isInsidePath,
  safeLstat,
  safeRealpath,
} = require('./io');
const {
  coerceLineWindow,
  normalizeNonEmptyString,
  normalizeReadiness,
  normalizeTier,
} = require('./budget');
const { normalizeMaybeRepoPath, normalizeTargetPath } = require('./targets');

function normalizeRawFacts(raw, queryPlan, workflow) {
  const facts = [];
  const omitted = [];
  const queryById = new Map(queryPlan.queries.map((query) => [query.query_id, query]));
  for (const result of raw.raw_results) {
    if (result.status && result.status !== 'ok') {
      omitted.push({ query_id: result.query_id, reason_code: 'provider_query_failed' });
      continue;
    }
    const query = queryById.get(result.query_id);
    const operationFacts = normalizeOperationResult({
      raw,
      query,
      result,
      queryPlan,
    });
    for (const fact of operationFacts.facts) {
      const safe = validateDurableFactStrings(fact);
      if (safe.ok) {
        facts.push(fact);
      } else {
        omitted.push({ query_id: fact.query_id || result.query_id, reason_code: safe.reason_code });
      }
    }
    omitted.push(...operationFacts.omitted);
  }

  const limit = LIMITS.maxFacts[workflow] || LIMITS.maxFacts['doc-review'];
  let reasonCode = 'provider_results_normalized';
  let finalFacts = facts;
  if (facts.length > limit) {
    finalFacts = facts.slice(0, limit);
    reasonCode = 'provider_fact_budget_truncated';
    omitted.push({ count: facts.length - limit, reason_code: 'provider_fact_budget_truncated' });
  }
  const emptyReason = omitted.find((item) => item.reason_code === 'provider_fact_redaction_failed')
    ? 'provider_fact_redaction_failed'
    : 'provider_result_no_usable_facts';

  return {
    facts: finalFacts,
    omitted_facts: omitted,
    reason_code: finalFacts.length > 0 ? reasonCode : emptyReason,
  };
}

function normalizeOperationResult({ raw, query, result, queryPlan }) {
  if (!query) {
    return { facts: [], omitted: [{ query_id: result.query_id, reason_code: 'provider_raw_result_query_mismatch' }] };
  }
  if (query.operation === 'query') {
    return normalizeQueryResult({ raw, query, result, queryPlan });
  }
  if (query.operation === 'context') {
    return normalizeContextResult({ raw, query, result, queryPlan });
  }
  if (query.operation === 'impact') {
    return normalizeImpactResult({ raw, query, result, queryPlan });
  }
  if (query.operation === 'detect_changes') {
    return normalizeDetectChangesResult({ raw, query, result, queryPlan });
  }
  return { facts: [], omitted: [{ query_id: result.query_id, reason_code: 'operation_not_allowed' }] };
}

function normalizeQueryResult({ raw, query, result, queryPlan }) {
  const facts = [];
  const omitted = [];
  const response = result.response || {};
  if (Array.isArray(response.facts)) {
    for (const fact of response.facts) {
      const normalized = normalizeProviderFact(fact, query, result, queryPlan, raw.source);
      if (normalized.fact) {
        facts.push(normalized.fact);
      } else {
        omitted.push({ query_id: result.query_id, reason_code: normalized.reason_code });
      }
    }
  }
  const graphItems = []
    .concat(Array.isArray(response.process_symbols) ? response.process_symbols : [])
    .concat(Array.isArray(response.definitions) ? response.definitions : []);
  for (const item of graphItems) {
    const sourcePath = normalizeProviderSourcePath(item.filePath || item.source_path, queryPlan.target_repo);
    if (!sourcePath) continue;
    const lineWindow = coerceLineWindow({
      start: item.startLine ?? item.start ?? 1,
      end: item.endLine ?? item.end ?? item.startLine ?? item.start ?? 1,
    });
    if (!lineWindow) continue;
    facts.push(buildQuerySymbolFact({
      query,
      result,
      raw,
      queryPlan,
      sourcePath,
      line_window: lineWindow,
      reason_code: 'provider_graph_symbol',
      summary: querySymbolSummary({
        name: item.name,
        kind: item.kind,
        module: item.module,
        sourcePath,
        lineWindow,
      }),
    }));
  }
  return { facts, omitted };
}

function normalizeContextResult({ raw, query, result, queryPlan }) {
  const response = result.response || {};
  const symbol = response.symbol || response.target || {};
  const candidates = Array.isArray(response.candidates) ? response.candidates : [];
  if (!symbol.name && candidates.length !== 1) {
    return { facts: [], omitted: [{ query_id: result.query_id, reason_code: 'context_target_ambiguous' }] };
  }
  const selected = symbol.name ? symbol : candidates[0];
  const sourcePath = normalizeProviderSourcePath(selected.filePath || selected.file_path || query.arguments.file_path, queryPlan.target_repo);
  if (!sourcePath) {
    return { facts: [], omitted: [{ query_id: result.query_id, reason_code: 'provider_result_no_usable_facts' }] };
  }
  const relationships = {
    incoming_calls: countRelationshipItems(response.incoming && response.incoming.calls),
    outgoing_calls: countRelationshipItems(response.outgoing && response.outgoing.calls),
    incoming_imports: countRelationshipItems(response.incoming && response.incoming.imports),
    outgoing_imports: countRelationshipItems(response.outgoing && response.outgoing.imports),
    processes: Array.isArray(response.processes) ? response.processes.length : 0,
  };
  return {
    facts: [compactOperationFact({
      query,
      result,
      raw,
      queryPlan,
      fact_kind: 'context_symbol',
      reason_code: 'provider_context_symbol',
      target_refs: query.target_refs,
      source_reads_required: uniqueRepoPaths([sourcePath]),
      redaction_status: 'none-required',
      summary: compactSummary([
        `context ${selected.name || query.arguments.name}`,
        `${relationships.incoming_calls} incoming calls`,
        `${relationships.outgoing_calls} outgoing calls`,
      ]),
      extra: {
        symbol: {
          uid: normalizeNonEmptyString(selected.uid),
          name: normalizeNonEmptyString(selected.name || query.arguments.name),
          kind: normalizeNonEmptyString(selected.kind || query.arguments.kind),
          file_path: sourcePath,
          line_window: coerceLineWindow({
            start: selected.startLine ?? selected.start ?? 1,
            end: selected.endLine ?? selected.end ?? selected.startLine ?? selected.start ?? 1,
          }) || undefined,
        },
        disambiguation_status: candidates.length > 1 ? 'ambiguous' : 'resolved',
        relationships,
      },
    })],
    omitted: [],
  };
}

function normalizeImpactResult({ raw, query, result, queryPlan }) {
  const response = result.response || {};
  if (!hasUsableImpactEvidence(response)) {
    return { facts: [], omitted: [{ query_id: result.query_id, reason_code: 'provider_result_no_usable_facts' }] };
  }
  const impactSummary = response.summary && typeof response.summary === 'object' ? response.summary : {};
  const byDepth = response.byDepth && typeof response.byDepth === 'object' ? response.byDepth : {};
  const byDepthCounts = {};
  const sourceCandidates = [];
  for (const [depth, items] of Object.entries(byDepth)) {
    if (Array.isArray(items)) {
      byDepthCounts[depth] = items.length;
      for (const item of items.slice(0, LIMITS.maxSummaryItems)) {
        sourceCandidates.push(item.filePath || item.path || item.file);
      }
    }
  }
  const affectedProcesses = normalizeNamedFileList(response.affected_processes, queryPlan.target_repo);
  const affectedModules = normalizeNamedList(response.affected_modules);
  const targetPath = response.target && (response.target.filePath || response.target.file_path);
  const directCount = ownNumber(impactSummary, 'direct');
  const processCount = ownNumber(impactSummary, 'processes_affected');
  const noImpactStatus = isNoImpactStatus(response.status);
  const sourceReads = uniqueRepoPaths([
    query.arguments.file_path,
    targetPath,
    ...affectedProcesses.map((item) => item.file_path),
    ...sourceCandidates,
  ], queryPlan.target_repo);
  return {
    facts: [compactOperationFact({
      query,
      result,
      raw,
      queryPlan,
      fact_kind: 'impact_summary',
      reason_code: 'provider_impact_summary',
      target_refs: query.target_refs,
      source_reads_required: sourceReads,
      redaction_status: 'redacted',
      limitations: ['impact_detail_summary_only'],
      summary: compactSummary([
        normalizeNonEmptyString(response.risk)
          ? `impact risk ${response.risk}`
          : normalizeNonEmptyString(response.status)
            ? `impact status ${response.status}`
            : 'impact risk unknown',
        directCount !== undefined ? `${directCount} direct` : noImpactStatus ? '0 direct' : undefined,
        processCount !== undefined
          ? `${processCount} processes`
          : affectedProcesses.length > 0
            ? `${affectedProcesses.length} processes`
            : noImpactStatus
              ? '0 processes'
              : undefined,
      ]),
      extra: {
        risk: normalizeNonEmptyString(response.risk) || 'unknown',
        affected_modules: affectedModules,
        affected_processes: affectedProcesses,
        by_depth_counts: byDepthCounts,
        omitted_detail_reason: 'impact_detail_summary_only',
      },
    })],
    omitted: [],
  };
}

function normalizeDetectChangesResult({ raw, query, result, queryPlan }) {
  const response = result.response || {};
  if (!hasUsableDetectChangesEvidence(response)) {
    return { facts: [], omitted: [{ query_id: result.query_id, reason_code: 'provider_result_no_usable_facts' }] };
  }
  const changedSymbolsRaw = Array.isArray(response.changed_symbols)
    ? response.changed_symbols
    : Array.isArray(response.changedSymbols)
      ? response.changedSymbols
      : undefined;
  const affectedProcessesRaw = Array.isArray(response.affected_processes)
    ? response.affected_processes
    : Array.isArray(response.affectedProcesses)
      ? response.affectedProcesses
      : undefined;
  const changedSymbols = normalizeNamedFileList(changedSymbolsRaw, queryPlan.target_repo);
  const affectedProcesses = normalizeNamedFileList(affectedProcessesRaw, queryPlan.target_repo);
  const summary = response.summary && typeof response.summary === 'object' ? response.summary : {};
  const changedCount = ownNumber(summary, 'changed_count');
  const affectedCount = ownNumber(summary, 'affected_count');
  const noChangesStatus = isNoChangesStatus(response.status);
  const sourceReads = uniqueRepoPaths([
    ...changedSymbols.map((item) => item.file_path),
    ...affectedProcesses.map((item) => item.file_path),
  ], queryPlan.target_repo);
  return {
    facts: [compactOperationFact({
      query,
      result,
      raw,
      queryPlan,
      fact_kind: 'detect_changes_summary',
      reason_code: 'provider_detect_changes_summary',
      target_refs: query.target_refs,
      source_reads_required: sourceReads,
      redaction_status: 'redacted',
      limitations: ['raw_diff_omitted'],
      summary: compactSummary([
        `detect_changes ${query.arguments.scope}`,
        changedCount !== undefined
          ? `${changedCount} changed symbols`
          : Array.isArray(changedSymbolsRaw)
            ? `${changedSymbols.length} changed symbols`
            : noChangesStatus
              ? '0 changed symbols'
              : undefined,
        affectedCount !== undefined
          ? `${affectedCount} affected processes`
          : Array.isArray(affectedProcessesRaw)
            ? `${affectedProcesses.length} affected processes`
            : noChangesStatus
              ? '0 affected processes'
              : undefined,
      ]),
      extra: {
        scope: {
          type: query.arguments.scope,
          base_ref: query.arguments.base_ref || undefined,
          worktree: path.basename(queryPlan.target_repo || query.arguments.repo || ''),
        },
        changed_symbols: changedSymbols,
        affected_processes: affectedProcesses,
        risk: normalizeNonEmptyString(summary.risk_level || response.risk) || 'unknown',
        raw_diff_status: 'omitted',
      },
    })],
    omitted: [],
  };
}

function hasUsableImpactEvidence(response) {
  if (!response || typeof response !== 'object' || Array.isArray(response)) return false;
  if (normalizeNonEmptyString(response.risk)) return true;
  if (hasAnyOwnNumber(response.summary, [
    'direct',
    'indirect',
    'processes_affected',
    'modules_affected',
    'affected_count',
    'changed_count',
    'total',
  ])) return true;
  if (hasAnyItems(response.affected_processes) || hasAnyItems(response.affectedProcesses)) return true;
  if (hasAnyItems(response.affected_modules) || hasAnyItems(response.affectedModules)) return true;
  const byDepth = response.byDepth && typeof response.byDepth === 'object' ? response.byDepth : {};
  if (Object.values(byDepth).some((items) => Array.isArray(items) && items.length > 0)) return true;
  return isNoImpactStatus(response.status);
}

function hasUsableDetectChangesEvidence(response) {
  if (!response || typeof response !== 'object' || Array.isArray(response)) return false;
  if (hasAnyItems(response.changed_symbols) || hasAnyItems(response.changedSymbols)) return true;
  if (hasAnyItems(response.affected_processes) || hasAnyItems(response.affectedProcesses)) return true;
  if (hasAnyOwnNumber(response.summary, ['changed_count', 'affected_count', 'risk_count', 'total'])) return true;
  return isNoChangesStatus(response.status);
}

function hasAnyOwnNumber(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return keys.some((key) => ownNumber(value, key) !== undefined);
}

function ownNumber(value, key) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  if (!Object.prototype.hasOwnProperty.call(value, key)) return undefined;
  const raw = value[key];
  if (raw === null || typeof raw === 'boolean') return undefined;
  if (typeof raw === 'string' && raw.trim() === '') return undefined;
  if (typeof raw !== 'number' && typeof raw !== 'string') return undefined;
  const numberValue = Number(raw);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function hasAnyItems(value) {
  return Array.isArray(value) && value.length > 0;
}

function isNoImpactStatus(value) {
  return ['no_impact', 'no-impact', 'clean', 'none'].includes(String(value || '').toLowerCase());
}

function isNoChangesStatus(value) {
  return ['no_changes', 'no-changes', 'unchanged', 'clean'].includes(String(value || '').toLowerCase());
}

function compactOperationFact({ query, result, raw, queryPlan, fact_kind, reason_code, target_refs, source_reads_required, redaction_status, limitations = [], summary, extra }) {
  return {
    provider: query.provider,
    query_id: query.query_id,
    operation: query.operation,
    fact_kind,
    repo_scope: path.basename(queryPlan.target_repo || ''),
    target_refs: Array.isArray(target_refs) ? target_refs.filter(Boolean) : [],
    readiness: queryPlan.readiness,
    tier: 'graph-fresh',
    reason_code,
    provenance: operationProvenance(raw, queryPlan, result),
    limitations,
    redaction_status,
    summary,
    source_reads_required,
    ...extra,
  };
}

function operationProvenance(raw, queryPlan, result) {
  return {
    source: raw.source,
    query_plan_id: raw.query_plan_id || queryPlan.query_plan_id,
    tool_name: result.tool_name,
    operation: result.operation,
  };
}

function countRelationshipItems(value) {
  return Array.isArray(value) ? value.length : 0;
}

function compactSummary(items) {
  return items
    .map((item) => normalizeNonEmptyString(item))
    .filter(Boolean)
    .slice(0, LIMITS.maxSummaryItems);
}

function normalizeNamedFileList(value, targetRepo) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, LIMITS.maxSummaryItems).map((item) => {
    const rawPath = item.filePath || item.file_path || item.path || item.file;
    const filePath = targetRepo
      ? normalizeProviderSourcePath(rawPath, targetRepo)
      : normalizeMaybeRepoPath(rawPath);
    return {
      name: normalizeNonEmptyString(item.name),
      kind: normalizeNonEmptyString(item.kind || item.type),
      file_path: filePath || undefined,
      step: Number.isInteger(item.earliest_broken_step) ? item.earliest_broken_step : undefined,
      count: Number.isInteger(item.affected_process_count)
        ? item.affected_process_count
        : Number.isInteger(item.total_hits)
          ? item.total_hits
          : undefined,
    };
  }).filter((item) => item.name || item.file_path);
}

function normalizeNamedList(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, LIMITS.maxSummaryItems).map((item) => ({
    name: normalizeNonEmptyString(item.name),
    hits: Number.isInteger(item.hits) ? item.hits : undefined,
    impact: normalizeNonEmptyString(item.impact),
  })).filter((item) => item.name);
}

function uniqueRepoPaths(paths, targetRepo) {
  const unique = [];
  const seen = new Set();
  for (const candidate of paths) {
    const normalized = targetRepo
      ? normalizeProviderSourcePath(candidate, targetRepo)
      : normalizeMaybeRepoPath(candidate);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }
  return unique.slice(0, LIMITS.maxSummaryItems);
}

function normalizeProviderFact(fact, query, result, queryPlan, source) {
  const sourcePath = normalizeProviderSourcePath(fact.source_path || fact.path, queryPlan.target_repo);
  const targetPath = fact.target ? normalizeProviderSourcePath(fact.target, queryPlan.target_repo) : undefined;
  const provenance = fact.provenance;
  const anchor = normalizeNonEmptyString(fact.anchor);
  const lineWindow = fact.line_window ? coerceLineWindow(fact.line_window) : undefined;
  if (!sourcePath || !provenance || typeof provenance !== 'object') {
    return { fact: null, reason_code: 'provider_result_no_usable_facts' };
  }
  if (fact.target && !targetPath) {
    return { fact: null, reason_code: 'provider_result_no_usable_facts' };
  }
  if (!anchor && !lineWindow) {
    return { fact: null, reason_code: 'provider_result_no_usable_facts' };
  }
  if (typeof fact.excerpt === 'string' && fact.excerpt.length > 0) {
    const excerptSafe = validateDurableFactStrings({ excerpt: fact.excerpt });
    if (!excerptSafe.ok) {
      return { fact: null, reason_code: excerptSafe.reason_code };
    }
  }
  const normalizedFact = buildQuerySymbolFact({
    query,
    result,
    raw: { source: source || 'live-mcp', query_plan_id: queryPlan.query_plan_id },
    queryPlan,
    sourcePath,
    targetPath,
    anchor,
    line_window: lineWindow || undefined,
    readiness: normalizeReadiness(fact.readiness, 'graph-fresh'),
    tier: normalizeTier(fact.tier, 'graph-fresh'),
    reason_code: fact.reason_code || 'provider_fact',
    summary: querySymbolSummary({
      name: fact.name || fact.symbol,
      kind: fact.kind || fact.type,
      sourcePath,
      anchor,
      lineWindow,
    }),
  });
  const safe = validateDurableFactStrings(normalizedFact);
  if (!safe.ok) {
    return { fact: null, reason_code: safe.reason_code };
  }
  return { fact: normalizedFact, reason_code: null };
}

function buildQuerySymbolFact({
  query,
  result,
  raw,
  queryPlan,
  sourcePath,
  targetPath,
  anchor,
  line_window: lineWindow,
  readiness,
  tier,
  reason_code: reasonCode,
  summary,
}) {
  return {
    provider: query.provider,
    query_id: query.query_id,
    operation: 'query',
    fact_kind: 'query_symbol',
    repo_scope: path.basename(queryPlan.target_repo || ''),
    target_refs: Array.isArray(query.target_refs) ? query.target_refs.filter(Boolean) : [],
    target: targetPath,
    source_path: sourcePath,
    anchor,
    line_window: lineWindow,
    readiness: normalizeReadiness(readiness, queryPlan.readiness),
    tier: normalizeTier(tier, 'graph-fresh'),
    reason_code: reasonCode,
    limitations: [],
    redaction_status: 'none-required',
    summary: compactSummary(summary),
    source_reads_required: uniqueRepoPaths([sourcePath], queryPlan.target_repo),
    provenance: operationProvenance(raw, queryPlan, result),
  };
}

function querySymbolSummary({ name, kind, module, sourcePath, anchor, lineWindow }) {
  const identity = normalizeNonEmptyString(name)
    || normalizeNonEmptyString(anchor)
    || path.basename(sourcePath || 'unknown');
  const type = normalizeNonEmptyString(kind || module);
  const location = lineWindow
    ? `${sourcePath}:${lineWindow.start}-${lineWindow.end}`
    : sourcePath;
  return [
    `query pointer ${identity}`,
    type ? `kind ${type}` : undefined,
    location ? `source ${location}` : undefined,
  ];
}

function normalizeProviderSourcePath(value, targetRepo) {
  const raw = String(value || '').trim();
  if (!raw || /^https?:\/\//i.test(raw)) return null;
  const repoReal = safeRealpath(targetRepo) || path.resolve(targetRepo || '.');
  let candidate;
  if (path.isAbsolute(raw)) {
    candidate = path.resolve(raw);
  } else {
    const normalized = normalizeTargetPath(raw);
    if (!normalized.ok) return null;
    candidate = path.resolve(targetRepo || process.cwd(), normalized.path);
  }

  const lstat = safeLstat(candidate);
  if (!lstat || !lstat.isFile()) return null;
  const sourceReal = safeRealpath(candidate);
  if (!sourceReal || (!isInsidePath(repoReal, sourceReal) && sourceReal !== repoReal)) return null;
  try {
    fs.accessSync(sourceReal, fs.constants.R_OK);
  } catch (_error) {
    return null;
  }
  const rel = path.relative(repoReal, sourceReal).split(path.sep).join('/');
  const normalized = normalizeTargetPath(rel);
  return normalized.ok ? normalized.path : null;
}

function validateDurableFactStrings(fact) {
  const strings = [];
  collectStrings(fact, strings);
  for (const { value, field } of strings) {
    if (containsRawDiffHunk(value) || containsCredentialLikeText(value) || containsAbsoluteLocalPath(value)) {
      return { ok: false, reason_code: 'provider_fact_redaction_failed', message: 'provider fact contains unsafe durable text' };
    }
    if (!isPathPointerField(field) && looksLikeRepoPath(value) && isExactRepoRelativePath(value) && isSecretDeniedPath(value)) {
      return { ok: false, reason_code: 'provider_fact_redaction_failed', message: 'provider fact contains secret-denied path' };
    }
  }
  return { ok: true };
}

function collectStrings(value, output, field) {
  if (typeof value === 'string') {
    output.push({ value, field });
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, output, field);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) collectStrings(item, output, key);
  }
}

function isPathPointerField(field) {
  return [
    'source_path',
    'source_reads_required',
    'target',
    'target_refs',
    'file_path',
  ].includes(field);
}

function looksLikeRepoPath(value) {
  const text = String(value || '').trim();
  return Boolean(text && !/\s/.test(text) && (text.includes('/') || text.startsWith('.') || /\.[A-Za-z0-9]+$/.test(text)));
}

function containsRawDiffHunk(value) {
  return /(^|\n)(@@\s+-\d+|\+\+\+\s|---\s|diff --git\s|\+[^\n]*\n-[^\n]*|-[^\n]*\n\+[^\n]*)/.test(value);
}

function containsCredentialLikeText(value) {
  return /https?:\/\/[^/\s:@]+:[^@\s]+@/i.test(value)
    || /\b(token|api[_-]?key|secret|password|cookie)\s*[:=]\s*[^,\s]+/i.test(value)
    || /-----BEGIN [A-Z ]*PRIVATE KEY-----/i.test(value);
}

function containsAbsoluteLocalPath(value) {
  return /(^|\s)(\/Users\/|\/home\/|\/private\/|[A-Za-z]:[\\/])/.test(value);
}

module.exports = {
  normalizeRawFacts,
  normalizeProviderSourcePath,
  validateDurableFactStrings,
  compactSummary,
  uniqueRepoPaths,
};
