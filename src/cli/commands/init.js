const fs = require('node:fs');
const path = require('node:path');
const {
  listBundledAgents,
  listBundledSkills,
  loadPluginManifest,
  syncBundledAssets,
} = require('../plugin');
const {
  buildState,
  pruneCommandNamespace,
  readState,
  removeObsoleteManagedAssets,
  writeState,
} = require('../state');

function runInit(argv) {
  const args = [...argv];

  if (args.includes('-h') || args.includes('--help')) {
    printHelp();
    return 0;
  }

  const allowed = new Set(['--claude', '--force']);
  const unknown = args.filter((arg) => !allowed.has(arg));
  if (unknown.length > 0 || !args.includes('--claude')) {
    console.error('Usage: spec-first init --claude');
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
  const previewState = buildState(manifest.version, {
    commands: manifest.commands,
    skills: listBundledSkills(),
    agents: listBundledAgents(),
  });
  removeObsoleteManagedAssets(projectRoot, previousState, previewState);
  pruneCommandNamespace(projectRoot, previewState.commands);

  const synced = syncBundledAssets(projectRoot);
  const nextState = buildState(manifest.version, synced);
  writeState(projectRoot, nextState);
  const written = synced.commands.map((command) => command.filename);
  const skillNames = synced.skills;
  const agentPaths = synced.agents;

  console.log(`Generated ${written.length} command file(s) in ${path.relative(projectRoot, commandDir)}`);
  for (const file of written) {
    console.log(`  - ${file}`);
  }

  console.log(`Generated ${skillNames.length} skill directory(ies) in .claude/skills`);
  for (const skillName of skillNames) {
    console.log(`  - ${skillName}`);
  }

  console.log(`Generated ${agentPaths.length} agent file(s) in .claude/agents`);
  for (const agentPath of agentPaths) {
    console.log(`  - ${agentPath}`);
  }

  console.log('');
  console.log('Restart Claude Code after generation so it can pick up the new /spec:* commands.');
  return 0;
}

function printHelp() {
  console.log('Usage: spec-first init --claude');
}

module.exports = {
  runInit,
};
