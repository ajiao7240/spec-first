'use strict';

const { makeEnvelope } = require('../cli/envelope');
const { buildWorkflowContext, parseWorkflowContextArgs } = require('../workflow-context/stage');

function run(argv) {
  const options = parseWorkflowContextArgs(argv);
  try {
    const data = buildWorkflowContext(options);
    process.stdout.write(JSON.stringify(makeEnvelope(options.repoRoot, data)) + '\n');
  } catch (error) {
    if (error.isUserError) {
      process.stderr.write(`error: ${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
}

module.exports = {
  run,
};
