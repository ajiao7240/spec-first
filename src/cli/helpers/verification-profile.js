'use strict';

const { loadVerificationProfile } = require('../../verification/profile-loader');

function runCli(argv) {
  const args = Array.isArray(argv) ? [...argv] : [];
  const subcommand = args[0];

  if (subcommand !== 'load') {
    writeJson({
      status: 'rejected',
      reason_code: 'invalid-command',
      errors: ['Usage: verification-profile load --target-repo <repo> [--json]'],
    });
    return 2;
  }

  const parsed = parseArgs(args.slice(1));
  if (parsed.errors.length > 0) {
    writeJson({ status: 'rejected', reason_code: 'invalid-arguments', errors: parsed.errors });
    return 2;
  }

  const output = loadVerificationProfile({ targetRepo: parsed.targetRepo });
  writeJson(output);
  return output.status === 'configured' || output.status === 'not-configured' ? 0 : 1;
}

function parseArgs(args) {
  const parsed = {
    targetRepo: '',
    errors: [],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') continue;
    if (arg === '--target-repo') {
      parsed.targetRepo = args[index + 1] || '';
      index += 1;
      continue;
    }
    parsed.errors.push(`unknown argument: ${arg}`);
  }

  if (!parsed.targetRepo) parsed.errors.push('--target-repo is required');
  return parsed;
}

function writeJson(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

module.exports = {
  runCli,
};
