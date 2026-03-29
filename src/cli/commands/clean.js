const fs = require('node:fs');
const path = require('node:path');
const { clearState, readState, removeManagedAssets } = require('../state');

function runClean(argv) {
  const args = [...argv];

  if (args.includes('-h') || args.includes('--help')) {
    printHelp();
    return 0;
  }

  if (args.length !== 1 || args[0] !== '--claude') {
    console.error('Usage: spec-first clean --claude');
    return 1;
  }

  const projectRoot = process.cwd();
  let state;
  try {
    state = readState(projectRoot);
  } catch (error) {
    console.error(
      `Could not read spec-first managed asset state. ${error instanceof Error ? error.message : String(error)}`,
    );
    console.error('Run `spec-first init --claude` to regenerate the state file, then retry `spec-first clean --claude`.');
    return 1;
  }

  if (!state) {
    console.log('No spec-first managed project assets found.');
    return 0;
  }

  removeManagedAssets(projectRoot, state);
  clearState(projectRoot);
  removeEmptyManagedRoots(projectRoot);

  console.log('Removed spec-first managed Claude assets from the current project.');
  console.log('Custom assets outside the spec-first managed set were left untouched.');
  return 0;
}

function removeEmptyManagedRoots(projectRoot) {
  for (const relativePath of [
    path.join('.claude', 'commands', 'spec'),
    path.join('.claude', 'skills'),
    path.join('.claude', 'agents'),
  ]) {
    const absolutePath = path.join(projectRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    if (fs.readdirSync(absolutePath).length === 0) {
      fs.rmdirSync(absolutePath);
    }
  }
}

function printHelp() {
  console.log('Usage: spec-first clean --claude');
}

module.exports = {
  runClean,
};
