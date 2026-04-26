'use strict';

const { resolveDiffBase } = require('../diff-base');
const { readWorkRun } = require('../work-runs');
const { buildWorkflowContext } = require('../workflow-context/stage');

function runHook(options) {
  const workRun = options.workRun ? readWorkRun(options.repoRoot, options.workRun) : null;
  const diffBase = resolveDiffBase(options.repoRoot, {
    since: options.since,
    workStartRef: options.workStartRef || (workRun && workRun.work_start_ref),
    autoBase: options.autoBase,
  });
  const workflowContext = buildWorkflowContext({
    repoRoot: options.repoRoot,
    stage: 'review',
    since: diffBase.base,
    workRun: options.workRun,
    detailProfile: options.detailProfile,
  });

  return {
    hook_id: 'before_review',
    stage: 'review',
    workflow_context: workflowContext,
    work_run: workRun,
    diff_base: diffBase,
    review_context_command: diffBase.base
      ? `spec-first crg review-context --repo=${options.repoRoot} --since=${diffBase.base}`
      : null,
    priority_order: [
      'hunk_hit_nodes',
      'high_risk_graph_expansion',
      'affected_flows',
      'coverage_gaps',
      'candidate_tests_missing_or_stale',
    ],
  };
}

module.exports = {
  runHook,
};
