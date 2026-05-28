'use strict';

const path = require('node:path');
const { LIMITS, WORKFLOWS } = require('./constants');
const {
  atomicWriteNoClobber,
  errorPayload,
  safeFileSize,
  safeReadJsonFile,
  writeJson,
} = require('./io');
const { validateInvocationBoundary } = require('./boundary');
const { computeReadiness, currentRepoSnapshot } = require('./readiness');
const {
  directReadFact,
  normalizeReadiness,
} = require('./budget');
const {
  extractTargets,
  hasOperationIntent,
  resolveTargets,
} = require('./targets');
const {
  buildQueryPlan,
  fallbackReasonForReadiness,
  validateQueryPlan,
} = require('./query-plan');
const { validateRawResult } = require('./raw-result');
const { normalizeRawFacts } = require('./normalize');
const {
  validateProviderResults,
  validateProviderResultsSnapshot,
} = require('./validate-results');
const { graphCapabilityUsage, renderFactsBlock } = require('./render');
const {
  recordFinalSummary,
  recordInvocationEvent,
  recordNormalizationFailure,
} = require('./run-summary');

function runReviewPreFacts(argv, env = {}) {
  const io = {
    cwd: env.cwd || process.cwd(),
    stdout: env.stdout || process.stdout,
    stderr: env.stderr || process.stderr,
  };
  const parsed = parseArgs(argv);
  if (parsed.error) {
    writeJson(io.stdout, errorPayload(parsed.error.code, parsed.error.message));
    return 2;
  }

  const options = parsed.options;
  options.repoRoot = path.resolve(io.cwd, options.repo || '.');
  options.workflow = options.workflow || 'doc-review';
  options.mode = options.mode || 'one-shot';

  if (!WORKFLOWS.has(options.workflow)) {
    writeJson(io.stdout, errorPayload('invalid_workflow', `unsupported workflow: ${options.workflow}`));
    return 2;
  }

  if (!['prepare', 'normalize-provider-results', 'render', 'one-shot'].includes(options.mode)) {
    writeJson(io.stdout, errorPayload('invalid_mode', `unsupported mode: ${options.mode}`));
    return 2;
  }

  const boundary = validateInvocationBoundary(options);
  if (!boundary.ok) {
    writeJson(io.stdout, errorPayload(boundary.reason_code, boundary.message));
    return 2;
  }

  try {
    if (options.mode === 'prepare') {
      return runPrepare(options, io);
    }
    if (options.mode === 'normalize-provider-results') {
      return runNormalizeProviderResults(options, io);
    }
    if (options.mode === 'render') {
      return runRender(options, io);
    }
    return runOneShot(options, io);
  } catch (error) {
    const reasonCode = error && error.reason_code ? error.reason_code : 'review_pre_facts_internal_error';
    recordInvocationEvent(options, {
      mode: options.mode,
      status: 'failed',
      reason_code: reasonCode,
      message: error instanceof Error ? error.message : String(error),
    });
    writeJson(io.stdout, errorPayload(
      reasonCode,
      error instanceof Error ? error.message : String(error),
    ));
    return 1;
  }
}

function runPrepare(options, io) {
  const missing = requireFlags(options, ['output', 'runId', 'summaryDir']);
  if (missing) {
    writeJson(io.stdout, errorPayload('missing_required_option', missing));
    return 2;
  }

  const targets = extractTargets(options);
  const operationIntent = hasOperationIntent(options);
  const readiness = targets.length === 0 && !operationIntent
    ? {
      readiness: 'no-targets',
      reason_code: 'no_extraction_targets',
      snapshot: currentRepoSnapshot(options.repoRoot),
      target_provider: null,
      normalized_artifact_inventory: [],
    }
    : computeReadiness(options.repoRoot);
  const targetPlan = resolveTargets(options.repoRoot, targets).slice(0, LIMITS.maxDirectReadTargets);
  const queryPlan = buildQueryPlan({
    options,
    readiness,
    targets: targetPlan,
  });

  atomicWriteNoClobber(options.output, `${JSON.stringify(queryPlan, null, 2)}\n`);
  recordInvocationEvent(options, {
    mode: 'prepare',
    status: 'completed',
    reason_code: queryPlan.reason_code,
    temp_artifacts: [options.output],
    readiness: queryPlan.readiness,
  });

  writeJson(io.stdout, {
    ok: true,
    mode: 'prepare',
    output: options.output,
    schema_version: queryPlan.schema_version,
    readiness: queryPlan.readiness,
    tier: queryPlan.tier,
    reason_code: queryPlan.reason_code,
    query_count: queryPlan.queries.length,
    direct_read_candidate_count: queryPlan.direct_read_candidates.length,
  });
  return 0;
}

function runNormalizeProviderResults(options, io) {
  const missing = requireFlags(options, ['queryPlan', 'rawResult', 'source', 'output', 'runId', 'summaryDir']);
  if (missing) {
    writeJson(io.stdout, errorPayload('missing_required_option', missing));
    return 2;
  }

  if (options.source !== 'live-mcp') {
    recordNormalizationFailure(options, 'provider_raw_result_unsupported_source');
    writeJson(io.stdout, errorPayload('provider_raw_result_unsupported_source', 'only --source live-mcp is supported in v1'));
    return 1;
  }

  const sizeResult = safeFileSize(options.rawResult);
  if (!sizeResult.ok) {
    recordNormalizationFailure(options, 'provider_raw_result_invalid');
    writeJson(io.stdout, errorPayload('provider_raw_result_invalid', 'raw live MCP result is not readable'));
    return 1;
  }
  const size = sizeResult.size;
  if (size > LIMITS.rawArtifactTotalBytes) {
    recordNormalizationFailure(options, 'provider_raw_result_too_large');
    writeJson(io.stdout, errorPayload('provider_raw_result_too_large', 'raw live MCP result exceeds v1 raw artifact limit'));
    return 1;
  }

  const queryPlanResult = safeReadJsonFile(options.queryPlan);
  if (!queryPlanResult.ok) {
    recordNormalizationFailure(options, 'query_plan_schema_invalid');
    writeJson(io.stdout, errorPayload('query_plan_schema_invalid', 'query plan JSON is invalid or unreadable'));
    return 1;
  }
  const rawResult = safeReadJsonFile(options.rawResult);
  if (!rawResult.ok) {
    recordNormalizationFailure(options, 'provider_raw_result_invalid');
    writeJson(io.stdout, errorPayload('provider_raw_result_invalid', 'raw live MCP result JSON is invalid or unreadable'));
    return 1;
  }
  const queryPlan = queryPlanResult.value;
  const raw = rawResult.value;
  const planValidation = validateQueryPlan(queryPlan);
  if (!planValidation.ok) {
    recordNormalizationFailure(options, planValidation.reason_code);
    writeJson(io.stdout, errorPayload(planValidation.reason_code, planValidation.message));
    return 1;
  }

  const rawValidation = validateRawResult(raw, queryPlan);
  if (!rawValidation.ok) {
    recordNormalizationFailure(options, rawValidation.reason_code);
    writeJson(io.stdout, errorPayload(rawValidation.reason_code, rawValidation.message));
    return 1;
  }

  const normalization = normalizeRawFacts(raw, queryPlan, options.workflow);
  if (normalization.facts.length === 0) {
    recordNormalizationFailure(options, normalization.reason_code || 'provider_result_no_usable_facts');
    writeJson(io.stdout, errorPayload(
      normalization.reason_code || 'provider_result_no_usable_facts',
      'raw live MCP result contained no usable facts satisfying the pre-facts fact contract',
    ));
    return 1;
  }

  const providerResults = {
    schema_version: 'review-pre-facts-provider-results.v1',
    workflow: queryPlan.workflow,
    target_repo: queryPlan.target_repo,
    source: 'live-mcp',
    query_plan_id: queryPlan.query_plan_id,
    readiness: queryPlan.readiness,
    tier: 'graph-fresh',
    snapshot: queryPlan.snapshot || null,
    recorded_snapshot: queryPlan.recorded_snapshot || null,
    reason_code: normalization.reason_code || 'provider_results_normalized',
    facts: normalization.facts,
    omitted_facts: normalization.omitted_facts,
    graph_capability_usage: graphCapabilityUsage(normalization.facts, normalization.omitted_facts),
  };

  atomicWriteNoClobber(options.output, `${JSON.stringify(providerResults, null, 2)}\n`);
  recordInvocationEvent(options, {
    mode: 'normalize-provider-results',
    status: 'completed',
    reason_code: providerResults.reason_code,
    temp_artifacts: [options.output],
    normalization_result: {
      source: 'live-mcp',
      status: 'completed',
      reason_code: providerResults.reason_code,
      facts: providerResults.facts.length,
    },
    graph_capability_usage: providerResults.graph_capability_usage,
  });

  writeJson(io.stdout, {
    ok: true,
    mode: 'normalize-provider-results',
    output: options.output,
    fact_count: providerResults.facts.length,
    reason_code: providerResults.reason_code,
    capabilities_used: providerResults.graph_capability_usage.capabilities_used,
  });
  return 0;
}

function runRender(options, io) {
  const missing = requireFlags(options, ['providerResults', 'output', 'runId', 'summaryDir']);
  if (missing) {
    writeJson(io.stdout, errorPayload('missing_required_option', missing));
    return 2;
  }

  const providerResultsResult = safeReadJsonFile(options.providerResults);
  const providerResults = providerResultsResult.ok
    && providerResultsResult.value
    && typeof providerResultsResult.value === 'object'
    ? providerResultsResult.value
    : {};
  const validation = providerResultsResult.ok
    ? validateProviderResults(providerResults)
    : { ok: false, reason_code: 'provider_results_schema_invalid', message: 'provider results JSON is invalid or unreadable' };
  let renderInput;
  const snapshotValidation = validation.ok
    ? validateProviderResultsSnapshot(providerResults)
    : validation;
  const providerResultsValid = validation.ok && snapshotValidation.ok;
  if (providerResultsValid) {
    renderInput = {
      workflow: providerResults.workflow || options.workflow,
      target_repo: providerResults.target_repo || options.repoRoot,
      readiness: normalizeReadiness(providerResults.readiness, 'graph-fresh'),
      tier: 'graph-fresh',
      reason_code: providerResults.reason_code || 'provider_results_rendered',
      facts: providerResults.facts,
      omitted_targets: [],
    };
  } else {
    const reasonCode = validation.ok ? snapshotValidation.reason_code : validation.reason_code;
    renderInput = {
      workflow: options.workflow,
      target_repo: providerResults.target_repo || options.repoRoot,
      readiness: validation.ok ? 'graph-stale' : normalizeReadiness(providerResults.readiness, 'graph-stale'),
      tier: 'unavailable',
      reason_code: reasonCode,
      facts: [],
      omitted_targets: [],
    };
  }

  const rendered = renderFactsBlock(renderInput);
  atomicWriteNoClobber(options.output, rendered.block);
  recordFinalSummary(options, {
    mode: 'render',
    selected_tier: rendered.tier,
    reason_code: rendered.reason_code,
    targets_read: rendered.targets_read,
    targets_omitted: rendered.targets_omitted,
    normalization_result: providerResultsValid
      ? { source: providerResults.source || 'live-mcp', status: 'completed', reason_code: rendered.reason_code }
      : { source: providerResults.source || 'unknown', status: 'failed', reason_code: rendered.reason_code },
    placeholder_rendered: false,
    temp_artifacts: [options.output, options.providerResults],
    graph_capability_usage: providerResults.graph_capability_usage || graphCapabilityUsage(providerResults.facts || [], providerResults.omitted_facts || []),
  });

  writeJson(io.stdout, {
    ok: true,
    mode: 'render',
    output: options.output,
    readiness: rendered.readiness,
    tier: rendered.tier,
    reason_code: rendered.reason_code,
    provider_results_valid: providerResultsValid,
  });
  return 0;
}

function runOneShot(options, io) {
  const missing = requireFlags(options, ['output', 'runId', 'summaryDir']);
  if (missing) {
    writeJson(io.stdout, errorPayload('missing_required_option', missing));
    return 2;
  }

  const readiness = computeReadiness(options.repoRoot);
  const extractedTargets = extractTargets(options);
  if (extractedTargets.length === 0) {
    const rendered = renderFactsBlock({
      workflow: options.workflow,
      target_repo: options.repoRoot,
      readiness: 'no-targets',
      tier: 'no-targets',
      reason_code: 'no_extraction_targets',
      facts: [],
      omitted_targets: [],
    });
    atomicWriteNoClobber(options.output, rendered.block);
    recordFinalSummary(options, {
      mode: 'one-shot',
      selected_tier: 'no-targets',
      reason_code: 'no_extraction_targets',
      targets_read: [],
      targets_omitted: [],
      normalization_result: null,
      placeholder_rendered: false,
      temp_artifacts: [options.output],
    });
    writeJson(io.stdout, {
      ok: true,
      mode: 'one-shot',
      output: options.output,
      readiness: 'no-targets',
      tier: 'no-targets',
      reason_code: 'no_extraction_targets',
    });
    return 0;
  }

  const resolvedTargets = resolveTargets(options.repoRoot, extractedTargets);
  const readable = resolvedTargets
    .filter((target) => target.status === 'readable')
    .slice(0, LIMITS.maxDirectReadTargets);
  const omitted = [
    ...resolvedTargets.filter((target) => target.status !== 'readable'),
    ...resolvedTargets
      .filter((target) => target.status === 'readable')
      .slice(LIMITS.maxDirectReadTargets)
      .map((target) => ({ ...target, reason_code: 'target_budget_omitted' })),
  ];
  const facts = readable.map((target) => directReadFact(options.repoRoot, target, readiness.readiness));
  const tier = facts.length > 0 ? 'bounded-reads' : 'unavailable';
  const reason = facts.length > 0
    ? fallbackReasonForReadiness(readiness)
    : 'all_pre_reads_failed';

  const rendered = renderFactsBlock({
    workflow: options.workflow,
    target_repo: options.repoRoot,
    readiness: readiness.readiness,
    tier,
    reason_code: reason,
    facts,
    omitted_targets: omitted.map((target) => ({
      path: target.original || target.path,
      reason_code: target.reason_code,
    })),
  });
  atomicWriteNoClobber(options.output, rendered.block);
  recordFinalSummary(options, {
    mode: 'one-shot',
    selected_tier: rendered.tier,
    reason_code: rendered.reason_code,
    targets_read: facts.map((fact) => fact.source_path),
    targets_omitted: rendered.targets_omitted,
    normalization_result: null,
    placeholder_rendered: false,
    temp_artifacts: [options.output],
  });
  writeJson(io.stdout, {
    ok: true,
    mode: 'one-shot',
    output: options.output,
    readiness: rendered.readiness,
    tier: rendered.tier,
    reason_code: rendered.reason_code,
    targets_read: facts.length,
    targets_omitted: rendered.targets_omitted.length,
  });
  return 0;
}

function parseArgs(argv) {
  const options = {};
  const valueFlags = new Set([
    '--mode',
    '--workflow',
    '--document',
    '--repo',
    '--run-id',
    '--summary-dir',
    '--output',
    '--query-plan',
    '--raw-result',
    '--source',
    '--provider-results',
    '--changed-files',
    '--change-scope',
    '--base-ref',
    '--symbol',
    '--symbol-file',
    '--symbol-kind',
    '--impact-target',
    '--impact-direction',
  ]);
  const aliases = {
    '--run-id': 'runId',
    '--summary-dir': 'summaryDir',
    '--query-plan': 'queryPlan',
    '--raw-result': 'rawResult',
    '--provider-results': 'providerResults',
    '--changed-files': 'changedFiles',
    '--change-scope': 'changeScope',
    '--base-ref': 'baseRef',
    '--symbol-file': 'symbolFile',
    '--symbol-kind': 'symbolKind',
    '--impact-target': 'impactTarget',
    '--impact-direction': 'impactDirection',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      return { options: { help: true } };
    }
    const [flag, inlineValue] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : [arg, null];
    if (!valueFlags.has(flag)) {
      return { error: { code: 'unknown_option', message: `unknown option: ${arg}` } };
    }
    const value = inlineValue !== null ? inlineValue : argv[index + 1];
    if (!value || value.startsWith('--')) {
      return { error: { code: 'missing_option_value', message: `${flag} requires a value` } };
    }
    if (inlineValue === null) index += 1;
    const key = aliases[flag] || flag.slice(2).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
    options[key] = value;
  }

  return { options };
}

function requireFlags(options, flags) {
  for (const flag of flags) {
    if (!options[flag]) {
      return `${flag} is required for --mode ${options.mode}`;
    }
  }
  return '';
}

module.exports = {
  runReviewPreFacts,
};
