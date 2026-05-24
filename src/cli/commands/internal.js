'use strict';

const { runContextBundle } = require('../helpers/context-bundle');
const { runWorkspaceGitNexusReadiness } = require('../helpers/compile-workspace-gitnexus-readiness');
const { runReviewPreFacts } = require('../helpers/review-pre-facts');
const { runCli: runSecretDenyPatternsCli } = require('../helpers/secret-deny-patterns');
const { runCli: runSpecWorkRunArtifactCli } = require('../helpers/spec-work-run-artifact');

function runInternal(argv) {
  const args = Array.isArray(argv) ? [...argv] : [];
  const subcommand = args[0];

  if (subcommand === 'context-bundle') {
    return runContextBundle(args.slice(1));
  }

  if (subcommand === 'review-pre-facts') {
    return runReviewPreFacts(args.slice(1));
  }

  if (subcommand === 'workspace-gitnexus-readiness') {
    return runWorkspaceGitNexusReadiness(args.slice(1));
  }

  if (subcommand === 'secret-deny') {
    return runSecretDenyPatternsCli(args.slice(1));
  }

  if (subcommand === 'spec-work-run-artifact') {
    return runSpecWorkRunArtifactCli(args.slice(1));
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
