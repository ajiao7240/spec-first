#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { loadHelperRegistry } = require('../../../src/cli/helpers/setup-facts');

const REVIEW_RISK_FLAGS = [
  'unpinned-npx',
  'global-npm-install',
  'global-cargo-install',
  'global-install',
  'browser-runtime-install',
  'unpinned-latest',
];

function safetyResult(helper) {
  const flags = helper.safety && Array.isArray(helper.safety.risk_flags) ? helper.safety.risk_flags : [];
  const source = helper.safety && helper.safety.source;
  const pinStatus = helper.safety && helper.safety.version_policy && helper.safety.version_policy.pin_status;
  if (!source || !pinStatus) {
    return { safety_result: 'blocked', reason_code: 'missing-install-safety-metadata' };
  }
  if (flags.includes('installer-script') || flags.includes('unknown-source')) {
    return { safety_result: 'blocked', reason_code: flags.includes('installer-script') ? 'installer-script' : 'unknown-source' };
  }
  if (helper.installation && helper.installation.strategy === 'manual') {
    return { safety_result: 'unsupported', reason_code: 'manual-install-only' };
  }
  // review-required 由 registry 显式 review_required 或具体高风险 flag 决定,
  // reason_code 取命中的真实 flag(机械事实),不兜底成与来源不符的 global-install。
  // pin_status 的风险已由各 helper 的 unpinned-* flag 显式编码,不在此处用 latest 一刀切。
  const matchedFlag = REVIEW_RISK_FLAGS.find((flag) => flags.includes(flag));
  if (helper.safety.review_required) {
    return { safety_result: 'review-required', reason_code: matchedFlag || 'review-required-by-registry' };
  }
  if (matchedFlag) {
    return { safety_result: 'review-required', reason_code: matchedFlag };
  }
  return { safety_result: 'safe', reason_code: 'install-safety-ready' };
}

function main() {
  const { registry } = loadHelperRegistry(path.resolve(__dirname, '..', '..', '..'));
  const planned_operations = registry.helpers.map((helper) => {
    const safety = safetyResult(helper);
    return {
      id: helper.id,
      kind: helper.kind,
      // 展示/审批用近似命令(来自 registry 静态串)。执行真相源是 install-helpers.sh
      // 的 run_install_command(环境感知:包管理器探测、brew upgrade 包装、mirror fallback)。
      // 字段名显式标注 display,避免消费端把它当成实际执行命令。
      install_commands_display: helper.installation.commands,
      risk_flags: helper.safety.risk_flags,
      source: helper.safety.source,
      pin_status: helper.safety.version_policy.pin_status,
      review_required: helper.safety.review_required,
      install_effect: helper.safety.install_effect,
      ...safety,
    };
  });
  process.stdout.write(`${JSON.stringify({
    schema_version: 'setup-install-plan.v1',
    planned_operations,
  }, null, 2)}\n`);
}

main();
