'use strict';

const { makeEnvelope } = require('../cli/envelope');
const { parseHookArgs } = require('../hooks/shared');

const HOOKS = {
  'before-plan': '../hooks/before-plan',
  'before-work': '../hooks/before-work',
  'after-work': '../hooks/after-work',
  'before-review': '../hooks/before-review',
};

function run(argv) {
  const hookName = argv[0];
  if (!hookName || hookName === '--help' || hookName === '-h') {
    process.stdout.write([
      'Usage: spec-first crg hook <hook> [options]',
      '',
      'Hooks:',
      '  before-plan',
      '  before-work',
      '  after-work',
      '  before-review',
      '',
    ].join('\n'));
    return;
  }
  if (!HOOKS[hookName]) {
    process.stderr.write(`error: unknown CRG hook '${hookName}'\n`);
    process.exit(1);
  }

  const options = parseHookArgs(argv.slice(1));
  const { runHook } = require(HOOKS[hookName]);
  const data = runHook(options);
  process.stdout.write(JSON.stringify(makeEnvelope(options.repoRoot, data)) + '\n');
}

module.exports = {
  run,
};
