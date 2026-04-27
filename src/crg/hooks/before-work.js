'use strict';

const { resolveHead } = require('../diff-base');
const { writeWorkRun } = require('../work-runs');
const { buildWorkflowContext } = require('../workflow-context/stage');
const { loadPlannedSurface, parseTaskPack } = require('./shared');

function runHook(options) {
  const workflowContext = buildWorkflowContext({
    repoRoot: options.repoRoot,
    stage: 'work',
    task: options.task,
    detailProfile: options.detailProfile,
  });
  const taskPack = options.taskPack ? parseTaskPack(options.taskPack, { repoRoot: options.repoRoot }) : null;
  if (taskPack && !(taskPack.validation && taskPack.validation.deterministic_handoff)) {
    return {
      hook_id: 'before_work',
      stage: 'work',
      workflow_context: workflowContext,
      work_run_id: null,
      work_start_ref: null,
      planned_surface: {
        source: 'none',
        value: null,
        limitations: [{
          code: 'task-pack-invalid',
          message: 'Task pack validation failed; before-work did not create a work-run or load source plan planned surface.',
        }],
      },
      task_pack: {
        metadata: taskPack.metadata,
        execution_focus: taskPack.execution_focus,
        limitations: taskPack.limitations,
        validation: taskPack.validation,
      },
      policy: 'planned surface is structured input only; do not infer planned surface from markdown prose.',
    };
  }
  const plannedSurface = loadPlannedSurface({
    ...options,
    plan: options.plan || (taskPack && taskPack.source_plan_path ? taskPack.source_plan_path : null),
  });
  const workStartRef = resolveHead(options.repoRoot);
  const workRun = writeWorkRun(options.repoRoot, {
    work_start_ref: workStartRef,
    plan: options.plan || null,
    task_pack: options.taskPack || null,
    planned_surface_source: plannedSurface.source,
  });

  return {
    hook_id: 'before_work',
    stage: 'work',
    workflow_context: workflowContext,
    work_run_id: workRun.run_id,
    work_start_ref: workStartRef,
    planned_surface: {
      source: plannedSurface.source,
      value: plannedSurface.value,
      limitations: plannedSurface.limitations,
    },
    task_pack: taskPack ? {
      metadata: taskPack.metadata,
      execution_focus: taskPack.execution_focus,
      limitations: taskPack.limitations,
      validation: taskPack.validation,
    } : null,
    policy: 'planned surface is structured input only; do not infer planned surface from markdown prose.',
  };
}

module.exports = {
  runHook,
};
