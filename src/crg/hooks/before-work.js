'use strict';

const path = require('node:path');
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
  const taskPack = options.taskPack ? parseTaskPack(options.taskPack) : null;
  const plannedSurface = loadPlannedSurface({
    ...options,
    plan: options.plan || (taskPack && taskPack.metadata && taskPack.metadata.source_plan
      ? path.resolve(path.dirname(options.taskPack), taskPack.metadata.source_plan)
      : null),
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
    } : null,
    policy: 'planned surface is structured input only; do not infer planned surface from markdown prose.',
  };
}

module.exports = {
  runHook,
};
