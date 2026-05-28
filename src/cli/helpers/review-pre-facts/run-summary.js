'use strict';

const path = require('node:path');
const {
  atomicWriteAllowReplace,
  tryReadJson,
} = require('./io');

function recordNormalizationFailure(options, reasonCode) {
  recordInvocationEvent(options, {
    mode: 'normalize-provider-results',
    status: 'failed',
    reason_code: reasonCode,
    normalization_result: {
      source: options.source || 'unknown',
      status: 'failed',
      reason_code: reasonCode,
    },
  });
}

function recordInvocationEvent(options, event) {
  if (!options.summaryDir || !options.runId) return;
  const summary = readRunSummary(options);
  const normalizedEvent = {
    mode: event.mode,
    status: event.status,
    reason_code: event.reason_code || null,
    message: event.message || null,
  };
  summary.invocation_events.push(normalizedEvent);
  summary.modes_attempted = [...new Set(summary.invocation_events.map((item) => item.mode))];
  if (event.normalization_result) {
    summary.normalization_result = event.normalization_result;
  }
  if (event.graph_capability_usage) {
    summary.graph_capability_usage = event.graph_capability_usage;
  }
  if (Array.isArray(event.temp_artifacts)) {
    summary.temp_artifacts = [...new Set([...(summary.temp_artifacts || []), ...event.temp_artifacts])];
  }
  atomicWriteAllowReplace(summaryPath(options), `${JSON.stringify(summary, null, 2)}\n`);
}

function recordFinalSummary(options, finalFields) {
  recordInvocationEvent(options, {
    mode: finalFields.mode,
    status: 'completed',
    reason_code: finalFields.reason_code,
    temp_artifacts: finalFields.temp_artifacts,
  });
  const summary = readRunSummary(options);
  summary.selected_tier = finalFields.selected_tier;
  summary.reason_code = finalFields.reason_code;
  summary.targets_read = finalFields.targets_read || [];
  summary.targets_omitted = finalFields.targets_omitted || [];
  if (finalFields.normalization_result !== undefined && finalFields.normalization_result !== null) {
    summary.normalization_result = finalFields.normalization_result;
  }
  if (finalFields.graph_capability_usage) {
    summary.graph_capability_usage = finalFields.graph_capability_usage;
  }
  summary.placeholder_rendered = finalFields.placeholder_rendered === true;
  summary.temp_artifacts = [...new Set([...(summary.temp_artifacts || []), ...(finalFields.temp_artifacts || [])])];
  atomicWriteAllowReplace(summaryPath(options), `${JSON.stringify(summary, null, 2)}\n`);
}

function readRunSummary(options) {
  const existing = tryReadJson(summaryPath(options));
  if (existing.ok && existing.value.schema_version === 'review-pre-facts-run-summary.v1') {
    return existing.value;
  }
  return {
    schema_version: 'review-pre-facts-run-summary.v1',
    workflow: options.workflow,
    target_repo: options.repoRoot,
    run_id: options.runId,
    modes_attempted: [],
    invocation_events: [],
    selected_tier: null,
    reason_code: null,
    targets_read: [],
    targets_omitted: [],
    normalization_result: null,
    graph_capability_usage: null,
    placeholder_rendered: false,
    temp_artifacts: [],
  };
}

function summaryPath(options) {
  return path.join(options.summaryDir, 'run-summary.json');
}

module.exports = {
  recordNormalizationFailure,
  recordInvocationEvent,
  recordFinalSummary,
};
