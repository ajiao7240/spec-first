const fs = require('node:fs');
const path = require('node:path');
const {
  clearState,
  isLegacyManagedState,
  readState,
  readStateFileRaw,
  removeManagedAssets,
} = require('../state');
const { getAdapter } = require('../adapters');

function runClean(argv) {
  const args = [...argv];
  const parsed = parseCleanArgs(args);

  if (parsed.help) {
    printHelp();
    return 0;
  }

  const platformSelected = parsed.claude || parsed.codex;
  if (!platformSelected || parsed.unknown.length > 0) {
    console.error('Usage: spec-first clean (--claude|--codex)');
    return 1;
  }

  if (parsed.claude && parsed.codex) {
    console.error('Error: Cannot specify both --claude and --codex');
    return 1;
  }

  const platform = parsed.claude ? 'claude' : 'codex';
  const adapter = getAdapter(platform);
  const projectRoot = process.cwd();
  let state;
  try {
    state = readState(projectRoot, adapter);
  } catch (error) {
    const rawState = tryReadRawManagedState(projectRoot, adapter);
    if (isLegacyManagedState(rawState)) {
      console.error('Detected legacy spec-first managed state. `clean` does not migrate legacy installs.');
      console.error(
        `Run \`spec-first init --${adapter.id}\` first so spec-first can perform a managed hard reset and rebuild the current runtime.`,
      );
      console.error(
        `If you still want to remove current managed assets afterward, rerun \`spec-first clean --${adapter.id}\`.`,
      );
      return 1;
    }

    console.error(
      `Could not read spec-first managed asset state. ${error instanceof Error ? error.message : String(error)}`,
    );
    console.error(
      `Run \`spec-first init --${adapter.id}\` to regenerate the state file, then retry \`spec-first clean --${adapter.id}\`.`,
    );
    return 1;
  }

  if (!state) {
    console.log('No spec-first managed project assets found.');
    return 0;
  }

  removeManagedAssets(projectRoot, state, adapter);
  adapter.removeRuntimeFiles(projectRoot);
  clearState(projectRoot, adapter);
  removeEmptyManagedRoots(projectRoot, adapter);

  console.log(`Removed spec-first managed ${platform === 'claude' ? 'Claude Code' : 'Codex'} assets from the current project.`);
  console.log('Custom assets outside the spec-first managed set were left untouched.');
  return 0;
}

function tryReadRawManagedState(projectRoot, adapter) {
  try {
    return readStateFileRaw(projectRoot, adapter);
  } catch (_error) {
    return null;
  }
}

function removeEmptyManagedRoots(projectRoot, adapter) {
  const relativePaths = [adapter.skillsRoot, adapter.agentsRoot];
  if (adapter.hasCommands) {
    relativePaths.unshift(adapter.commandRoot);
  }

  for (const relativePath of relativePaths) {
    const absolutePath = path.join(projectRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    if (fs.readdirSync(absolutePath).length === 0) {
      fs.rmdirSync(absolutePath);
    }
  }
}

function parseCleanArgs(argv) {
  const parsed = {
    help: false,
    claude: false,
    codex: false,
    unknown: [],
  };

  for (const arg of argv) {
    if (arg === '-h' || arg === '--help') {
      parsed.help = true;
    } else if (arg === '--claude') {
      parsed.claude = true;
    } else if (arg === '--codex') {
      parsed.codex = true;
    } else {
      parsed.unknown.push(arg);
    }
  }

  return parsed;
}

function printHelp() {
  console.log('Usage: spec-first clean (--claude|--codex)');
}

module.exports = {
  runClean,
};
