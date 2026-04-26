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
    stage: 'work',
    since: diffBase.base,
    workRun: options.workRun,
    detailProfile: options.detailProfile,
  });

  return {
    hook_id: 'after_work',
    stage: 'work',
    workflow_context: workflowContext,
    work_run: workRun,
    diff_base: diffBase,
    review_context_command: diffBase.base
      ? `spec-first crg review-context --repo=${options.repoRoot} --since=${diffBase.base}`
      : null,
    policy: 'LLM compares actual blast radius against planned surface; hook does not decide whether expansion is acceptable.',
  };
}

module.exports = {
  runHook,
};
