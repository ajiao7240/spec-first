'use strict';

const { runReviewPreFacts } = require('../helpers/review-pre-facts');

function runInternal(argv) {
  const args = Array.isArray(argv) ? [...argv] : [];
  const subcommand = args[0];

  if (subcommand === 'review-pre-facts') {
    return runReviewPreFacts(args.slice(1));
  }

  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify({
      ok: false,
      error: {
        code: 'internal-subcommand-unknown',
        message: `Unknown internal subcommand: ${subcommand || '<missing>'}`,
      },
    }, null, 2)}\n`);
  } else {
    console.error(`Unknown internal subcommand: ${subcommand || '<missing>'}`);
  }
  return 2;
}

module.exports = {
  runInternal,
};
