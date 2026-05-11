'use strict';

function runExampleWorkflow(input) {
  if (!input || !input.name) {
    return { ok: false, reason: 'missing-name' };
  }
  return { ok: true, name: input.name };
}

module.exports = {
  runExampleWorkflow,
};
