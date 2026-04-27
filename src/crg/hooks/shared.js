'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { validateTaskPack } = require('../../cli/task-pack');

function parseHookArgs(argv) {
  const result = {
    repoRoot: process.cwd(),
    task: null,
    plan: null,
    taskPack: null,
    plannedSurface: null,
    since: null,
    workRun: null,
    workStartRef: null,
    autoBase: false,
    detailProfile: 'minimal',
  };

  for (const arg of Array.isArray(argv) ? argv : []) {
    if (arg.startsWith('--repo=')) result.repoRoot = path.resolve(arg.slice('--repo='.length));
    else if (arg.startsWith('--task=')) result.task = arg.slice('--task='.length);
    else if (arg.startsWith('--plan=')) result.plan = path.resolve(arg.slice('--plan='.length));
    else if (arg.startsWith('--task-pack=')) result.taskPack = path.resolve(arg.slice('--task-pack='.length));
    else if (arg.startsWith('--planned-surface=')) result.plannedSurface = path.resolve(arg.slice('--planned-surface='.length));
    else if (arg.startsWith('--since=')) result.since = arg.slice('--since='.length);
    else if (arg.startsWith('--work-run=')) result.workRun = arg.slice('--work-run='.length);
    else if (arg.startsWith('--work-start-ref=')) result.workStartRef = arg.slice('--work-start-ref='.length);
    else if (arg === '--auto-base') result.autoBase = true;
    else if (arg.startsWith('--detail=')) result.detailProfile = arg.slice('--detail='.length);
  }

  return result;
}

function readJsonFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return { value: null, limitation: 'file-missing' };
  try {
    return { value: JSON.parse(fs.readFileSync(filePath, 'utf8')), limitation: null };
  } catch (_) {
    return { value: null, limitation: 'json-invalid' };
  }
}

function parsePlannedSurfaceFromPlan(planPath) {
  if (!planPath || !fs.existsSync(planPath)) {
    return {
      value: null,
      limitations: [{ code: 'planned-surface-plan-missing', message: 'Plan file is missing.' }],
    };
  }
  const text = fs.readFileSync(planPath, 'utf8');
  const matches = [...text.matchAll(/<!--\s*spec-first:planned_change_surface:start\s*-->\s*```json\s*([\s\S]*?)\s*```\s*<!--\s*spec-first:planned_change_surface:end\s*-->/g)];
  if (matches.length === 0) {
    return {
      value: null,
      limitations: [{ code: 'planned-surface-missing', message: 'No planned_change_surface sentinel block found.' }],
    };
  }
  if (matches.length > 1) {
    return {
      value: null,
      limitations: [{ code: 'planned-surface-ambiguous', message: 'Multiple planned_change_surface sentinel blocks found.' }],
    };
  }
  try {
    return { value: JSON.parse(matches[0][1]), limitations: [] };
  } catch (_) {
    return {
      value: null,
      limitations: [{ code: 'planned-surface-invalid', message: 'planned_change_surface JSON is invalid.' }],
    };
  }
}

function parseTaskPack(taskPackPath, options = {}) {
  if (!taskPackPath || !fs.existsSync(taskPackPath)) {
    return {
      metadata: null,
      execution_focus: [],
      limitations: [{ code: 'task-pack-missing', message: 'Task pack file is missing.' }],
      validation: null,
      source_plan_path: null,
    };
  }
  const validation = validateTaskPack(taskPackPath, { repoRoot: options.repoRoot || process.cwd() });
  const metadata = validation.task_pack.metadata || {};
  const executionFocus = validation.deterministic_handoff
    ? validation.task_pack.execution_focus
    : [];
  const limitations = validation.errors.map((error) => ({
    code: error.code,
    message: error.message,
  })).concat(validation.limitations.map((limitation) => ({
    code: limitation.code,
    message: limitation.message,
  })));

  return {
    metadata,
    execution_focus: executionFocus,
    limitations,
    validation,
    source_plan_path: validation.deterministic_handoff ? validation.source_plan.absolute_path : null,
  };
}

function loadPlannedSurface(options) {
  if (options.plannedSurface) {
    const { value, limitation } = readJsonFile(options.plannedSurface);
    return {
      source: 'sidecar',
      value,
      limitations: limitation ? [{ code: `planned-surface-${limitation}`, message: 'Could not read planned surface sidecar.' }] : [],
    };
  }
  if (options.plan) {
    return {
      source: 'plan',
      ...parsePlannedSurfaceFromPlan(options.plan),
    };
  }
  return {
    source: 'none',
    value: null,
    limitations: [{ code: 'planned-surface-not-provided', message: 'No --plan or --planned-surface was provided.' }],
  };
}

module.exports = {
  loadPlannedSurface,
  parseHookArgs,
  parseTaskPack,
};
