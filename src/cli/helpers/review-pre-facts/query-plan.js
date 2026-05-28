'use strict';

const path = require('node:path');
const {
  OPERATIONS,
  OPERATION_TOOL_NAMES,
  IMPACT_DIRECTIONS,
  DETECT_CHANGE_SCOPES,
} = require('./constants');
const { normalizeNonEmptyString } = require('./budget');
const {
  extractSymbolTargets,
  normalizeMaybeRepoPath,
} = require('./targets');

function buildQueryPlan({ options, readiness, targets }) {
  const queryPlanId = `qplan-${options.runId}`;
  const targetProviderName = 'gitnexus';
  const availableOperations = gitNexusOperationsFromInventory(readiness.normalized_artifact_inventory, targetProviderName);
  const hasQuerySurface = availableOperations.size > 0;
  const limitations = [];
  const queries = [];
  const nextQueryId = () => `q${queries.length + 1}`;

  if (readiness.readiness === 'graph-fresh' && hasQuerySurface) {
    if (availableOperations.has('query')) {
      for (const target of targets.filter((item) => item.status === 'readable').slice(0, 6)) {
        queries.push(buildOperationQuery({
          queryId: nextQueryId(),
          operation: 'query',
          args: {
            repo: path.basename(options.repoRoot),
            query: `review pre-facts for ${target.path}`,
            goal: 'collect bounded semantic facts for review prompt pre-injection',
            limit: 3,
            max_symbols: 8,
            include_content: false,
          },
          targetRefs: [target.path],
          reasonCode: 'provider_query_surface_available',
          fallbackReasonCode: 'provider_query_unavailable',
        }));
      }
    }

    const symbolTargets = extractSymbolTargets(options);
    for (const symbolTarget of symbolTargets) {
      if (availableOperations.has('context')) {
        const contextEntry = buildContextQueryEntry(nextQueryId(), options, symbolTarget);
        if (contextEntry.ok) {
          queries.push(contextEntry.query);
        } else {
          limitations.push(contextEntry.limitation);
        }
      }
      if (availableOperations.has('impact')) {
        const impactEntry = buildImpactQueryEntry(nextQueryId(), options, {
          target: symbolTarget.name,
          file_path: symbolTarget.file_path,
          kind: symbolTarget.kind,
          direction: symbolTarget.impact_direction,
          target_refs: [symbolTarget.file_path || symbolTarget.name],
        });
        if (impactEntry.ok) {
          queries.push(impactEntry.query);
        } else if (symbolTarget.impact_direction || options.impactDirection) {
          limitations.push(impactEntry.limitation);
        }
      }
    }

    if (availableOperations.has('impact')) {
      const explicitImpactEntries = impactTargetsFromOptions(options, targets);
      for (const impactTarget of explicitImpactEntries) {
        const impactEntry = buildImpactQueryEntry(nextQueryId(), options, impactTarget);
        if (impactEntry.ok) {
          queries.push(impactEntry.query);
        } else {
          limitations.push(impactEntry.limitation);
        }
      }
    }

    if (availableOperations.has('detect_changes')) {
      const detectChangesEntry = buildDetectChangesQueryEntry(nextQueryId(), options);
      if (detectChangesEntry.ok) {
        queries.push(detectChangesEntry.query);
      } else if (detectChangesEntry.limitation) {
        limitations.push(detectChangesEntry.limitation);
      }
    }
  }

  const tier = queries.length > 0 ? 'graph-fresh' : fallbackTierForReadiness(readiness);
  const reasonCode = queries.length > 0
    ? 'provider_query_plan_rendered'
    : readiness.readiness === 'graph-fresh' && !hasQuerySurface
      ? 'provider_query_unavailable'
    : fallbackReasonForReadiness(readiness);

  return {
    schema_version: 'review-pre-facts-query-plan.v1',
    workflow: options.workflow,
    target_repo: options.repoRoot,
    query_plan_id: queryPlanId,
    readiness: readiness.readiness,
    tier,
    reason_code: reasonCode,
    snapshot: readiness.snapshot,
    recorded_snapshot: readiness.recorded_snapshot || null,
    target_provider: readiness.target_provider ? readiness.target_provider.provider : null,
    normalized_artifact_inventory: readiness.normalized_artifact_inventory,
    workflow_profile: options.workflow,
    operation_profiles: Object.keys(OPERATION_TOOL_NAMES),
    limitations,
    targets: targets.map((target) => ({
      path: target.path || target.original,
      status: target.status,
      reason_code: target.reason_code || null,
    })),
    queries,
    direct_read_candidates: targets.map((target) => ({
      path: target.path || target.original,
      status: target.status,
      reason_code: target.reason_code || null,
    })),
  };
}

function gitNexusOperationsFromInventory(inventory, providerName) {
  const operations = new Set();
  for (const artifact of Array.isArray(inventory) ? inventory : []) {
    if (artifact.provider !== providerName) continue;
    for (const surface of Array.isArray(artifact.available_query_surfaces) ? artifact.available_query_surfaces : []) {
      if (OPERATIONS.has(surface)) operations.add(surface);
    }
  }
  return operations;
}

function buildOperationQuery({ queryId, operation, args, targetRefs, reasonCode, fallbackReasonCode, maxResults = 3 }) {
  return {
    query_id: queryId,
    provider: 'gitnexus',
    tool_name: OPERATION_TOOL_NAMES[operation],
    operation,
    arguments: args,
    target_refs: targetRefs,
    max_results: maxResults,
    reason_code: reasonCode,
    fallback_reason_code: fallbackReasonCode,
  };
}

function buildContextQueryEntry(queryId, options, symbolTarget) {
  const args = {
    repo: path.basename(options.repoRoot),
    include_content: false,
  };
  if (symbolTarget.uid) {
    args.uid = symbolTarget.uid;
  } else if (symbolTarget.name && symbolTarget.file_path) {
    args.name = symbolTarget.name;
    args.file_path = symbolTarget.file_path;
    if (symbolTarget.kind) args.kind = symbolTarget.kind;
  } else {
    return {
      ok: false,
      limitation: {
        operation: 'context',
        reason_code: 'context_target_ambiguous',
        target: symbolTarget.name || '<unknown-symbol>',
      },
    };
  }
  return {
    ok: true,
    query: buildOperationQuery({
      queryId,
      operation: 'context',
      args,
      targetRefs: [symbolTarget.file_path || symbolTarget.uid || symbolTarget.name],
      reasonCode: 'provider_context_surface_available',
      fallbackReasonCode: 'context_target_ambiguous',
      maxResults: 1,
    }),
  };
}

function buildImpactQueryEntry(queryId, options, impactTarget) {
  const direction = impactTarget.direction || options.impactDirection;
  if (!impactTarget.target || !IMPACT_DIRECTIONS.has(direction)) {
    return {
      ok: false,
      limitation: {
        operation: 'impact',
        reason_code: !impactTarget.target ? 'impact_target_unavailable' : 'operation_arguments_invalid',
        target: impactTarget.target || '<missing-target>',
      },
    };
  }
  const args = {
    repo: path.basename(options.repoRoot),
    target: impactTarget.target,
    direction,
    maxDepth: 2,
    includeTests: true,
    relationTypes: ['CALLS', 'IMPORTS'],
    timeoutMs: 10000,
  };
  if (impactTarget.file_path) args.file_path = impactTarget.file_path;
  if (impactTarget.kind) args.kind = impactTarget.kind;
  return {
    ok: true,
    query: buildOperationQuery({
      queryId,
      operation: 'impact',
      args,
      targetRefs: impactTarget.target_refs || [impactTarget.file_path || impactTarget.target],
      reasonCode: 'provider_impact_surface_available',
      fallbackReasonCode: 'impact_target_unavailable',
      maxResults: 1,
    }),
  };
}

function buildDetectChangesQueryEntry(queryId, options) {
  const scope = options.changeScope;
  if (!scope) return { ok: false, limitation: null };
  if (!DETECT_CHANGE_SCOPES.has(scope)) {
    return {
      ok: false,
      limitation: { operation: 'detect_changes', reason_code: 'detect_changes_scope_missing', scope },
    };
  }
  if (scope === 'compare' && !options.baseRef) {
    return {
      ok: false,
      limitation: { operation: 'detect_changes', reason_code: 'detect_changes_scope_missing', scope },
    };
  }
  const args = {
    repo: path.basename(options.repoRoot),
    scope,
  };
  if (options.baseRef) args.base_ref = options.baseRef;
  return {
    ok: true,
    query: buildOperationQuery({
      queryId,
      operation: 'detect_changes',
      args,
      targetRefs: options.baseRef ? [`compare:${options.baseRef}`] : [`scope:${scope}`],
      reasonCode: 'provider_detect_changes_surface_available',
      fallbackReasonCode: 'detect_changes_scope_missing',
      maxResults: 1,
    }),
  };
}

function impactTargetsFromOptions(options, targets) {
  if (options.impactTarget) {
    return [{
      target: options.impactTarget,
      direction: options.impactDirection,
      target_refs: [options.impactTarget],
    }];
  }
  if (options.workflow !== 'code-review' || !options.impactDirection) return [];
  return targets
    .filter((target) => target.status === 'readable')
    .slice(0, 3)
    .map((target) => ({
      target: target.path,
      direction: options.impactDirection,
      target_refs: [target.path],
    }));
}

function fallbackTierForReadiness(readiness) {
  if (readiness.readiness === 'no-targets') return 'no-targets';
  return 'bounded-reads';
}

function fallbackReasonForReadiness(readiness) {
  if (typeof readiness === 'string') return readiness;
  if (readiness.readiness === 'graph-fresh') return 'provider_query_not_executed';
  if (readiness.readiness === 'graph-stale') return 'graph_stale_bounded_reads';
  if (readiness.readiness === 'provider-unavailable') return readiness.reason_code || 'provider_unavailable_bounded_reads';
  return readiness.reason_code || 'bounded_reads';
}

function validateQueryPlan(plan) {
  if (!plan || plan.schema_version !== 'review-pre-facts-query-plan.v1') {
    return { ok: false, reason_code: 'query_plan_schema_invalid', message: 'query plan schema_version is invalid' };
  }
  if (!plan.query_plan_id || !Array.isArray(plan.queries)) {
    return { ok: false, reason_code: 'query_plan_schema_invalid', message: 'query plan lacks query_plan_id or queries[]' };
  }
  for (const query of plan.queries) {
    for (const field of ['query_id', 'provider', 'tool_name', 'operation', 'arguments', 'target_refs', 'max_results', 'reason_code', 'fallback_reason_code']) {
      if (query[field] === undefined || query[field] === null) {
        return { ok: false, reason_code: 'query_plan_schema_invalid', message: `query is missing ${field}` };
      }
    }
    if (!Array.isArray(query.target_refs)) {
      return { ok: false, reason_code: 'query_plan_schema_invalid', message: 'query target_refs must be an array' };
    }
    if (!OPERATIONS.has(query.operation)) {
      return { ok: false, reason_code: 'operation_not_allowed', message: `operation is not allowed: ${query.operation}` };
    }
    if (query.tool_name !== OPERATION_TOOL_NAMES[query.operation]) {
      return { ok: false, reason_code: 'operation_arguments_invalid', message: 'query tool_name does not match operation' };
    }
    const argsValidation = validateOperationArguments(query.operation, query.arguments);
    if (!argsValidation.ok) return argsValidation;
  }
  return { ok: true };
}

function validateOperationArguments(operation, args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return { ok: false, reason_code: 'operation_arguments_invalid', message: 'operation arguments must be an object' };
  }
  if (!normalizeNonEmptyString(args.repo)) {
    return { ok: false, reason_code: 'operation_arguments_invalid', message: 'operation arguments require repo' };
  }
  if (operation === 'query') {
    if (!normalizeNonEmptyString(args.query)) {
      return { ok: false, reason_code: 'operation_arguments_invalid', message: 'query operation requires query text' };
    }
    if (args.limit !== undefined && (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 5)) {
      return { ok: false, reason_code: 'operation_arguments_invalid', message: 'query limit is out of bounds' };
    }
    if (args.max_symbols !== undefined && (!Number.isInteger(args.max_symbols) || args.max_symbols < 1 || args.max_symbols > 12)) {
      return { ok: false, reason_code: 'operation_arguments_invalid', message: 'query max_symbols is out of bounds' };
    }
    if (args.include_content !== undefined && args.include_content !== false) {
      return { ok: false, reason_code: 'operation_arguments_invalid', message: 'query include_content must be false' };
    }
    return { ok: true };
  }
  if (operation === 'context') {
    const hasUid = normalizeNonEmptyString(args.uid);
    const hasNameFile = normalizeNonEmptyString(args.name) && normalizeNonEmptyString(args.file_path);
    if (!hasUid && !hasNameFile) {
      return { ok: false, reason_code: 'operation_arguments_invalid', message: 'context requires uid or name plus file_path' };
    }
    if (args.include_content !== undefined && args.include_content !== false) {
      return { ok: false, reason_code: 'operation_arguments_invalid', message: 'context include_content must be false' };
    }
    if (args.file_path && !normalizeMaybeRepoPath(args.file_path)) {
      return { ok: false, reason_code: 'operation_arguments_invalid', message: 'context file_path must be repo-relative' };
    }
    return { ok: true };
  }
  if (operation === 'impact') {
    if (!normalizeNonEmptyString(args.target) || !IMPACT_DIRECTIONS.has(args.direction)) {
      return { ok: false, reason_code: 'operation_arguments_invalid', message: 'impact requires target and valid direction' };
    }
    if (args.maxDepth !== undefined && (!Number.isInteger(args.maxDepth) || args.maxDepth < 1 || args.maxDepth > 3)) {
      return { ok: false, reason_code: 'operation_arguments_invalid', message: 'impact maxDepth is out of bounds' };
    }
    if (args.timeoutMs !== undefined && (!Number.isInteger(args.timeoutMs) || args.timeoutMs < 1 || args.timeoutMs > 30000)) {
      return { ok: false, reason_code: 'operation_arguments_invalid', message: 'impact timeoutMs is out of bounds' };
    }
    if (Object.prototype.hasOwnProperty.call(args, 'summaryOnly')) {
      return { ok: false, reason_code: 'operation_arguments_invalid', message: 'impact summaryOnly is not proven by the current executable schema' };
    }
    if (args.file_path && !normalizeMaybeRepoPath(args.file_path)) {
      return { ok: false, reason_code: 'operation_arguments_invalid', message: 'impact file_path must be repo-relative' };
    }
    return { ok: true };
  }
  if (operation === 'detect_changes') {
    if (!DETECT_CHANGE_SCOPES.has(args.scope)) {
      return { ok: false, reason_code: 'operation_arguments_invalid', message: 'detect_changes requires explicit valid scope' };
    }
    if (args.scope === 'compare' && !normalizeNonEmptyString(args.base_ref)) {
      return { ok: false, reason_code: 'operation_arguments_invalid', message: 'detect_changes compare requires base_ref' };
    }
    return { ok: true };
  }
  return { ok: false, reason_code: 'operation_not_allowed', message: `operation is not allowed: ${operation}` };
}

module.exports = {
  buildQueryPlan,
  validateQueryPlan,
  fallbackTierForReadiness,
  fallbackReasonForReadiness,
};
