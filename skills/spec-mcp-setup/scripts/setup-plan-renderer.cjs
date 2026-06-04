#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { loadHelperRegistry } = require('../../../src/cli/helpers/setup-facts');

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
  if (helper.safety.review_required || flags.includes('unpinned-npx') || flags.includes('global-install') || flags.includes('global-npm-install') || pinStatus === 'latest' || pinStatus === 'unpinned') {
    return { safety_result: 'review-required', reason_code: flags.includes('unpinned-npx') ? 'unpinned-npx' : 'global-install' };
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
      install_commands: helper.installation.commands,
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
