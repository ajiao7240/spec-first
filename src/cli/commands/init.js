const fs = require('node:fs');
const path = require('node:path');
const {
  listBundledAgents,
  listBundledSkills,
  loadPluginManifest,
  syncBundledAssets,
} = require('../plugin');
const {
  resolveDeveloperIdentity,
  writeDeveloperFile,
} = require('../developer');
const {
  buildState,
  pruneCommandNamespace,
  readState,
  removeObsoleteManagedAssets,
  writeState,
} = require('../state');

function runInit(argv) {
  const args = [...argv];
  const parsed = parseInitArgs(args);

  if (parsed.help) {
    printHelp();
    return 0;
  }

  if (!parsed.claude || parsed.unknown.length > 0) {
    console.error('Usage: spec-first init --claude [-u <name>] [--lang <zh|en>]');
    return 1;
  }

  const projectRoot = process.cwd();
  const commandDir = path.join(projectRoot, '.claude', 'commands', 'spec');
  fs.mkdirSync(commandDir, { recursive: true });
  let previousState = null;
  try {
    previousState = readState(projectRoot);
  } catch (error) {
    console.warn(
      `Warning: could not read existing spec-first state; continuing with a fresh sync. (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  const manifest = loadPluginManifest();
  let developer;
  try {
    developer = resolveDeveloperIdentity(projectRoot, {
      user: parsed.user,
      lang: parsed.lang,
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  const previewState = buildState(manifest.version, {
    commands: manifest.commands,
    skills: listBundledSkills(),
    agents: listBundledAgents(),
    developer,
  });
  removeObsoleteManagedAssets(projectRoot, previousState, previewState);
  pruneCommandNamespace(projectRoot, previewState.commands);

  const synced = syncBundledAssets(projectRoot);
  const nextState = buildState(manifest.version, {
    ...synced,
    developer: {
      path: path.join('.claude', 'spec-first', '.developer'),
      name: developer.name,
      lang: developer.lang,
      initializedAt: developer.initializedAt,
      version: developer.version,
    },
  });
  writeDeveloperFile(projectRoot, developer);
  writeState(projectRoot, nextState);
  const written = synced.commands.map((command) => command.filename);
  const skillNames = synced.skills;
  const agentPaths = synced.agents;

  console.log(`📦 Generated ${written.length} command file(s) in ${path.relative(projectRoot, commandDir)}`);
  console.log(`🧩 Generated ${skillNames.length} skill directory(ies) in .claude/skills`);
  console.log(`🤖 Generated ${agentPaths.length} agent file(s) in .claude/agents`);
  console.log('🪪 Wrote project developer profile:');
  console.log(`  📍 path: .claude/spec-first/.developer`);
  console.log(`  👤 name: ${developer.name}`);
  console.log(`  🈯 lang: ${developer.lang}`);
  console.log(`  ⏱ initialized_at: ${developer.initializedAt}`);
  console.log(`  🔖 version: ${developer.version}`);

  console.log('');
  console.log('🔁 Restart Claude Code after generation so it can pick up the new /spec:* commands.');
  return 0;
}

function printHelp() {
  console.log('Usage: spec-first init --claude [-u <name>] [--lang <zh|en>]');
}

function parseInitArgs(argv) {
  const parsed = {
    help: false,
    claude: false,
    force: false,
    user: '',
    lang: '',
    unknown: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '-h' || arg === '--help') {
      parsed.help = true;
      continue;
    }

    if (arg === '--claude') {
      parsed.claude = true;
      continue;
    }

    if (arg === '--force') {
      parsed.force = true;
      continue;
    }

    if (arg === '-u' || arg === '--user') {
      const next = argv[index + 1];
      if (!next || next.startsWith('-')) {
        parsed.unknown.push(arg);
        continue;
      }
      parsed.user = next;
      index += 1;
      continue;
    }

    if (arg.startsWith('--user=')) {
      parsed.user = arg.slice('--user='.length);
      continue;
    }

    if (arg === '--lang') {
      const next = argv[index + 1];
      if (!next || next.startsWith('-')) {
        parsed.unknown.push(arg);
        continue;
      }
      parsed.lang = next;
      index += 1;
      continue;
    }

    if (arg.startsWith('--lang=')) {
      parsed.lang = arg.slice('--lang='.length);
      continue;
    }

    parsed.unknown.push(arg);
  }

  return parsed;
}

module.exports = {
  runInit,
};
