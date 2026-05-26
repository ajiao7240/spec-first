'use strict';

const { applyInitPlan, buildInitPlan } = require('../../../src/cli/init-plan');
const {
  printInitApplySuccess,
  printInitDryRun,
  printInitPreview,
  printWorkspaceInitApplySuccess,
} = require('../../../src/cli/commands/init');

function runProgrammaticInit({
  projectRoot,
  platform = 'codex',
  name = 'reviewer',
  lang = 'zh',
  target = null,
  dryRun = false,
  gitRootTopology = 'single-repo',
  print = false,
}) {
  const plan = buildInitPlan({
    projectRoot,
    workspaceRoot: projectRoot,
    platform,
    name,
    lang,
    target: target || {
      mode: 'single-repo',
      projectRoot,
    },
    dryRun,
    gitRootTopology,
  });

  if (Array.isArray(plan.errors) && plan.errors.length > 0) {
    for (const error of plan.errors) {
      console.error(error.message || String(error));
    }
    return 1;
  }

  if (dryRun) {
    if (print) {
      if (plan.mode === 'all-repos') {
        printInitPreview(plan);
      } else {
        printInitDryRun({
          platform: plan.platform,
          plan: plan.operationPlan,
          untrackDiagnostic: plan.untrackDiagnostic,
          legacyStateDetected: plan.legacyStateDetected,
          destructiveResetReason: plan.destructiveResetReason,
        });
      }
    }
    return 0;
  }

  const result = applyInitPlan(projectRoot, plan);
  if (result.error) {
    console.error(result.error);
  }
  if (print) {
    if (plan.mode === 'all-repos') {
      printWorkspaceInitApplySuccess(plan, result);
    } else {
      printInitApplySuccess(plan, result);
    }
  }
  return result.exit_code;
}

function captureProgrammaticInit(projectRoot, options) {
  const logs = [];
  const errors = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (message = '') => logs.push(String(message));
  console.error = (message = '') => errors.push(String(message));
  try {
    const exitCode = runProgrammaticInit({
      projectRoot,
      print: true,
      ...options,
    });
    return {
      exitCode,
      stdout: logs.join('\n'),
      stderr: errors.join('\n'),
    };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

module.exports = {
  captureProgrammaticInit,
  runProgrammaticInit,
};
