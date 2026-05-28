'use strict';

const {
  DETECT_CHANGE_SCOPES,
  FACT_KINDS,
  LIMITS,
  OPERATIONS,
  READINESS,
  REDACTION_STATUSES,
  TIERS,
  WORKFLOWS,
} = require('./constants');
const {
  isValidLineWindow,
  normalizeNonEmptyString,
} = require('./budget');
const { currentRepoSnapshot } = require('./readiness');
const {
  normalizeProviderSourcePath,
  validateDurableFactStrings,
} = require('./normalize');

function validateProviderResults(results) {
  if (!results || results.schema_version !== 'review-pre-facts-provider-results.v1') {
    return { ok: false, reason_code: 'provider_results_schema_invalid', message: 'provider results schema_version is invalid' };
  }
  if (!WORKFLOWS.has(results.workflow)) {
    return { ok: false, reason_code: 'provider_results_schema_invalid', message: 'provider results workflow is invalid' };
  }
  if (results.source !== 'live-mcp' || !results.query_plan_id) {
    return { ok: false, reason_code: 'provider_results_schema_invalid', message: 'provider results source/query_plan_id is invalid' };
  }
  if (!READINESS.has(results.readiness) || !TIERS.has(results.tier)) {
    return { ok: false, reason_code: 'provider_results_schema_invalid', message: 'provider results readiness/tier is invalid' };
  }
  if (!Array.isArray(results.facts)) {
    return { ok: false, reason_code: 'provider_results_schema_invalid', message: 'provider results lacks facts[]' };
  }
  if (results.facts.length === 0) {
    return { ok: false, reason_code: 'provider_result_no_usable_facts', message: 'provider results contains no facts' };
  }
  for (const fact of results.facts) {
    const common = validateProviderFactCommon(fact, results);
    if (!common.ok) return common;
    const kind = fact.fact_kind || 'query_symbol';
    if (kind === 'query_symbol') {
      const queryValidation = validateQuerySymbolFact(fact, results);
      if (!queryValidation.ok) return queryValidation;
      continue;
    }
    if (kind === 'context_symbol') {
      const contextValidation = validateContextSymbolFact(fact, results);
      if (!contextValidation.ok) return contextValidation;
      continue;
    }
    if (kind === 'impact_summary') {
      const impactValidation = validateImpactSummaryFact(fact, results);
      if (!impactValidation.ok) return impactValidation;
      continue;
    }
    if (kind === 'detect_changes_summary') {
      const changesValidation = validateDetectChangesSummaryFact(fact, results);
      if (!changesValidation.ok) return changesValidation;
      continue;
    }
    return { ok: false, reason_code: 'provider_results_schema_invalid', message: 'provider fact_kind is invalid' };
  }
  return { ok: true };
}

function validateProviderFactCommon(fact, results) {
  const expectedSource = results.source || 'live-mcp';
  const kind = fact.fact_kind || 'query_symbol';
  if (!fact || typeof fact !== 'object' || !fact.provider || !(fact.query_id || fact.target) || !fact.reason_code) {
    return { ok: false, reason_code: 'provider_results_schema_invalid', message: 'provider fact lacks required contract fields' };
  }
  if (!FACT_KINDS.has(kind)) {
    return { ok: false, reason_code: 'provider_results_schema_invalid', message: 'provider fact_kind is invalid' };
  }
  if (!READINESS.has(fact.readiness) || !TIERS.has(fact.tier)) {
    return { ok: false, reason_code: 'provider_results_schema_invalid', message: 'provider fact readiness/tier is invalid' };
  }
  if (!fact.provenance || typeof fact.provenance !== 'object') {
    return { ok: false, reason_code: 'provider_result_missing_provenance', message: 'provider fact lacks provenance' };
  }
  if (typeof fact.excerpt === 'string' && fact.excerpt.length > LIMITS.perExcerptChars) {
    return { ok: false, reason_code: 'provider_results_schema_invalid', message: 'provider fact excerpt exceeds limit' };
  }
  if (!fact.provenance.source || !fact.provenance.query_plan_id || !fact.provenance.tool_name) {
    return { ok: false, reason_code: 'provider_result_missing_provenance', message: 'provider fact lacks provenance source/query_plan_id/tool_name' };
  }
  if (fact.provenance.source !== expectedSource || fact.provenance.query_plan_id !== results.query_plan_id) {
    return { ok: false, reason_code: 'provider_result_missing_provenance', message: 'provider fact provenance does not match provider-results envelope' };
  }
  const safe = validateDurableFactStrings(fact);
  if (!safe.ok) return safe;
  if (!OPERATIONS.has(fact.operation) || fact.provenance.operation !== fact.operation) {
    return { ok: false, reason_code: 'provider_results_schema_invalid', message: 'provider operation metadata is invalid' };
  }
  if (!Array.isArray(fact.target_refs) || !Array.isArray(fact.limitations) || !REDACTION_STATUSES.has(fact.redaction_status)) {
    return { ok: false, reason_code: 'provider_results_schema_invalid', message: 'provider fact lacks common operation fields' };
  }
  return { ok: true };
}

function validateQuerySymbolFact(fact, results) {
  const anchor = normalizeNonEmptyString(fact.anchor);
  const lineWindowPresent = Object.prototype.hasOwnProperty.call(fact, 'line_window');
  const lineWindowValid = lineWindowPresent && isValidLineWindow(fact.line_window);
  const hasAnchor = anchor || lineWindowValid;
  const sourcePath = normalizeProviderSourcePath(fact.source_path, results.target_repo || process.cwd());
  const targetPath = fact.target ? normalizeProviderSourcePath(fact.target, results.target_repo || process.cwd()) : undefined;
  if (lineWindowPresent && !lineWindowValid) {
    return { ok: false, reason_code: 'provider_results_schema_invalid', message: 'provider fact line_window is invalid' };
  }
  if (!sourcePath || (fact.target && !targetPath) || !hasAnchor) {
    return { ok: false, reason_code: 'provider_results_schema_invalid', message: 'provider fact lacks required query_symbol fields' };
  }
  if (!Array.isArray(fact.summary) || fact.summary.length === 0 || !Array.isArray(fact.source_reads_required)) {
    return { ok: false, reason_code: 'provider_results_schema_invalid', message: 'query_symbol lacks summary or source reads' };
  }
  return validateSourceReadsRequired(fact.source_reads_required, results);
}

function validateContextSymbolFact(fact, results) {
  if (!fact.symbol || typeof fact.symbol !== 'object' || !fact.symbol.name || !fact.symbol.file_path) {
    return { ok: false, reason_code: 'provider_results_schema_invalid', message: 'context_symbol lacks symbol identity' };
  }
  if (!normalizeProviderSourcePath(fact.symbol.file_path, results.target_repo || process.cwd())) {
    return { ok: false, reason_code: 'provider_results_schema_invalid', message: 'context_symbol symbol path is invalid' };
  }
  if (!['resolved', 'ambiguous', 'degraded'].includes(fact.disambiguation_status)) {
    return { ok: false, reason_code: 'provider_results_schema_invalid', message: 'context_symbol disambiguation status is invalid' };
  }
  if (!fact.relationships || typeof fact.relationships !== 'object' || !Array.isArray(fact.source_reads_required)) {
    return { ok: false, reason_code: 'provider_results_schema_invalid', message: 'context_symbol lacks relationship summary or source reads' };
  }
  return validateSourceReadsRequired(fact.source_reads_required, results);
}

function validateImpactSummaryFact(fact, results) {
  if (!fact.risk || !Array.isArray(fact.affected_modules) || !Array.isArray(fact.affected_processes) || !fact.by_depth_counts) {
    return { ok: false, reason_code: 'provider_results_schema_invalid', message: 'impact_summary lacks summary fields' };
  }
  const listValidation = validateNamedFileListPaths(fact.affected_processes, results);
  if (!listValidation.ok) return listValidation;
  if (!Array.isArray(fact.source_reads_required)) {
    return { ok: false, reason_code: 'provider_results_schema_invalid', message: 'impact_summary lacks source reads' };
  }
  return validateSourceReadsRequired(fact.source_reads_required, results);
}

function validateDetectChangesSummaryFact(fact, results) {
  if (!fact.scope || typeof fact.scope !== 'object' || !DETECT_CHANGE_SCOPES.has(fact.scope.type)) {
    return { ok: false, reason_code: 'provider_results_schema_invalid', message: 'detect_changes_summary scope is invalid' };
  }
  if (fact.scope.type === 'compare' && !fact.scope.base_ref) {
    return { ok: false, reason_code: 'provider_results_schema_invalid', message: 'detect_changes_summary compare scope lacks base_ref' };
  }
  if (!normalizeNonEmptyString(fact.scope.worktree)) {
    return { ok: false, reason_code: 'provider_results_schema_invalid', message: 'detect_changes_summary scope lacks worktree' };
  }
  if (!Array.isArray(fact.changed_symbols) || !Array.isArray(fact.affected_processes) || fact.raw_diff_status !== 'omitted') {
    return { ok: false, reason_code: 'provider_results_schema_invalid', message: 'detect_changes_summary lacks safe summary fields' };
  }
  const changedValidation = validateNamedFileListPaths(fact.changed_symbols, results);
  if (!changedValidation.ok) return changedValidation;
  const processValidation = validateNamedFileListPaths(fact.affected_processes, results);
  if (!processValidation.ok) return processValidation;
  if (!Array.isArray(fact.source_reads_required)) {
    return { ok: false, reason_code: 'provider_results_schema_invalid', message: 'detect_changes_summary lacks source reads' };
  }
  return validateSourceReadsRequired(fact.source_reads_required, results);
}

function validateSourceReadsRequired(paths, results) {
  for (const sourcePath of paths) {
    if (!normalizeProviderSourcePath(sourcePath, results.target_repo || process.cwd())) {
      return { ok: false, reason_code: 'provider_results_schema_invalid', message: 'source_reads_required path is invalid' };
    }
  }
  return { ok: true };
}

function validateNamedFileListPaths(items, results) {
  for (const item of Array.isArray(items) ? items : []) {
    if (item && item.file_path && !normalizeProviderSourcePath(item.file_path, results.target_repo || process.cwd())) {
      return { ok: false, reason_code: 'provider_results_schema_invalid', message: 'summary file_path is invalid' };
    }
  }
  return { ok: true };
}

function validateProviderResultsSnapshot(results) {
  const snapshot = results.snapshot;
  if (!snapshot || typeof snapshot !== 'object') {
    return { ok: false, reason_code: 'provider_results_snapshot_missing', message: 'provider results lacks prepare snapshot' };
  }
  const current = currentRepoSnapshot(results.target_repo || process.cwd());
  if (!current.source_revision) {
    return { ok: false, reason_code: 'provider_results_snapshot_unavailable', message: 'current repo snapshot is unavailable' };
  }
  if (
    snapshot.source_revision === current.source_revision
    && snapshot.worktree_dirty === current.worktree_dirty
    && snapshot.worktree_status_hash === current.worktree_status_hash
  ) {
    return { ok: true };
  }
  return { ok: false, reason_code: 'snapshot_mismatch', message: 'provider results snapshot does not match current repo snapshot' };
}

module.exports = {
  validateProviderResults,
  validateProviderResultsSnapshot,
};
