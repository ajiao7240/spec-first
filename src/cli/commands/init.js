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
const { getAdapter } = require('../adapters');
const { writeLangPolicy } = require('../lang-policy');
const { bootstrapChangelog } = require('../changelog');

function runInit(argv) {
  const args = [...argv];
  const parsed = parseInitArgs(args);

  if (parsed.help) {
    printHelp();
    return 0;
  }

  const platformSelected = parsed.claude || parsed.codex;
  if (!platformSelected || parsed.unknown.length > 0) {
    console.error('Usage: spec-first init (--claude|--codex) [-u <name>] [--lang <zh|en>]');
    return 1;
  }

  if (parsed.claude && parsed.codex) {
    console.error('Error: Cannot specify both --claude and --codex');
    return 1;
  }

  const platform = parsed.claude ? 'claude' : 'codex';
  const adapter = getAdapter(platform);
  const bundledAgentPaths = listBundledAgents();

  if (platform === 'claude') {
    const duplicateBareNames = findDuplicateClaudeAgentNames(bundledAgentPaths);
    if (duplicateBareNames.length > 0) {
      console.error(
        `Error: Claude runtime requires unique bare agent names, but found duplicates: ${duplicateBareNames.join(', ')}`,
      );
      return 1;
    }
  }

  const projectRoot = process.cwd();
  const commandDir = adapter.hasCommands ? path.join(projectRoot, adapter.commandRoot) : '';
  if (adapter.hasCommands) {
    fs.mkdirSync(commandDir, { recursive: true });
  }
  let previousState = null;
  try {
    previousState = readState(projectRoot, adapter);
  } catch (error) {
    console.warn(
      `Warning: could not read existing spec-first state; continuing with a fresh sync. (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  const manifest = loadPluginManifest();
  const runtimeCommands = adapter.hasCommands
    ? manifest.commands.map((command) => ({
      ...command,
      filename: adapter.commandFilename(command),
    }))
    : [];
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
    commands: runtimeCommands,
    skills: listBundledSkills(),
    agents: bundledAgentPaths,
    developer,
  });
  removeObsoleteManagedAssets(projectRoot, previousState, previewState, adapter);
  pruneCommandNamespace(projectRoot, previewState.commands, adapter);

  const synced = syncBundledAssets(projectRoot, adapter);
  const nextState = buildState(manifest.version, {
    ...synced,
    platform,
    developer: {
      path: adapter.developerFile,
      name: developer.name,
      lang: developer.lang,
      initializedAt: developer.initializedAt,
      version: developer.version,
    },
  });
  writeDeveloperFile(projectRoot, developer, adapter);
  writeState(projectRoot, nextState, adapter);
  adapter.syncRuntimeFiles(projectRoot, { manifest, synced });
  writeLangPolicy(projectRoot, developer, adapter);
  const changelogCreated = bootstrapChangelog(projectRoot, developer);
  const written = synced.commands.map((command) => command.filename);
  const skillNames = synced.skills;
  const agentPaths = synced.agents;

  if (adapter.hasCommands) {
    console.log(`📦 Generated ${written.length} command file(s) in ${path.relative(projectRoot, commandDir)}`);
  }
  console.log(`🧩 Generated ${skillNames.length} skill directory(ies) in ${adapter.skillsRoot}`);
  console.log(`🤖 Generated ${agentPaths.length} agent file(s) in ${adapter.agentsRoot}`);
  console.log('🪪 Wrote project developer profile:');
  console.log(`  📍 path: ${adapter.developerFile}`);
  console.log(`  👤 name: ${developer.name}`);
  console.log(`  🈯 lang: ${developer.lang}`);
  console.log(`  ⏱ initialized_at: ${developer.initializedAt}`);
  console.log(`  🔖 version: ${developer.version}`);
  if (changelogCreated) {
    console.log('📝 Bootstrapped CHANGELOG.md');
  }

  console.log('');
  if (adapter.hasCommands) {
    console.log(`🔁 Restart ${platform === 'claude' ? 'Claude Code' : 'Codex'} after generation so it can pick up the new /spec:* commands.`);
  } else {
    console.log(`🔁 Restart Codex after generation so it can pick up the new $spec-* skills.`);
  }
  return 0;
}

function printHelp() {
  console.log('Usage: spec-first init (--claude|--codex) [-u <name>] [--lang <zh|en>]');
}

function parseInitArgs(argv) {
  const parsed = {
    help: false,
    claude: false,
    codex: false,
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

    if (arg === '--codex') {
      parsed.codex = true;
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

function findDuplicateClaudeAgentNames(agentPaths) {
  const seen = new Set();
  const duplicates = new Set();

  for (const agentPath of agentPaths) {
    const bareName = path.basename(agentPath, '.md');
    if (seen.has(bareName)) {
      duplicates.add(bareName);
      continue;
    }
    seen.add(bareName);
  }

  return [...duplicates].sort();
}

module.exports = {
  runInit,
};
