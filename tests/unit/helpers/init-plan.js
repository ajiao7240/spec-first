'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { applyInitPlan, buildInitPlan } = require('../../../src/cli/init-plan');
const {
  printInitApplySuccess,
  printInitDryRun,
  printInitPreview,
  printWorkspaceInitApplySuccess,
} = require('../../../src/cli/commands/init');

// 非 dryRun 的 applyInitPlan 会写全局 developer profile(~/.spec-first/.developer)。
// 在 jest 套件里注册该隔离,把 HOME 钉到临时目录,避免污染运行机器的真实 profile。
// 用法:在测试文件顶层 describe 外或内调用 useIsolatedDeveloperHome()。
function useIsolatedDeveloperHome() {
  let isolatedHome = null;
  let homedirSpy = null;

  beforeEach(() => {
    isolatedHome = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-init-home-'));
    homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue(isolatedHome);
  });

  afterEach(() => {
    if (homedirSpy) {
      homedirSpy.mockRestore();
      homedirSpy = null;
    }
    if (isolatedHome) {
      fs.rmSync(isolatedHome, { recursive: true, force: true });
      isolatedHome = null;
    }
  });
}

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
  useIsolatedDeveloperHome,
};
