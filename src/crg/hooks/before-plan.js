'use strict';

const { buildWorkflowContext } = require('../workflow-context/stage');

function runHook(options) {
  const workflowContext = buildWorkflowContext({
    repoRoot: options.repoRoot,
    stage: 'plan',
    task: options.task,
    detailProfile: options.detailProfile,
  });
  return {
    hook_id: 'before_plan',
    stage: 'plan',
    task: options.task || null,
    workflow_context: workflowContext,
    candidate_surface_policy: 'LLM selects candidate change surface from query evidence; hook output is advisory.',
  };
}

module.exports = {
  runHook,
};
