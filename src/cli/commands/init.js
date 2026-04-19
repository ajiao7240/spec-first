const fs = require('node:fs');
const path = require('node:path');
const {
  buildFilteredAssetSet,
  listBundledAgentSupportFiles,
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
  applyOperationPlan,
  buildState,
  hardResetManagedAssets,
  isLegacyManagedState,
  mergeOperationPlans,
  planCommandNamespacePrune,
  planHardResetManagedAssets,
  planObsoleteManagedAssetRemoval,
  readStateFileRaw,
  readState,
  writeState,
} = require('../state');
const { getAdapter } = require('../adapters');
const { writeLangPolicy } = require('../lang-policy');
const { bootstrapChangelog } = require('../changelog');
const { writeInstructionBootstrap } = require('../instruction-bootstrap');
const { upsertManagedSessionStartHook, validateClaudeSettingsFile } = require('../claude-settings');

function runInit(argv) {
  const args = [...argv];
  const parsed = parseInitArgs(args);

  if (parsed.help) {
    printHelp();
    return 0;
  }

  const platformSelected = parsed.claude || parsed.codex;
  if (!platformSelected || parsed.unknown.length > 0) {
    console.error('Usage: spec-first init (--claude|--codex) [-u <name>] [--lang <zh|en>] [--dry-run]');
    return 1;
  }

  if (parsed.claude && parsed.codex) {
    console.error('Error: Cannot specify both --claude and --codex');
    return 1;
  }

  const platform = parsed.claude ? 'claude' : 'codex';
  const adapter = getAdapter(platform);
  const bundledAgentPaths = listBundledAgents();
  const bundledAgentSupportFiles = listBundledAgentSupportFiles();

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
  let previousState = null;
  let legacyStateDetected = false;
  let rawManagedState = null;
  try {
    previousState = readState(projectRoot, adapter);
  } catch (error) {
    rawManagedState = tryReadRawManagedState(projectRoot, adapter);
    if (isLegacyManagedState(rawManagedState)) {
      legacyStateDetected = true;
    } else {
      console.warn(
        `Warning: could not read existing spec-first state; continuing with a fresh sync. (${error instanceof Error ? error.message : String(error)})`,
      );
    }
  }
  const manifest = loadPluginManifest();
  const filteredAssetSet = buildFilteredAssetSet(adapter.id);
  const runtimeCommands = adapter.hasCommands
    ? filteredAssetSet.commands.map((command) => ({
      ...command,
      filename: adapter.commandFilename(command),
    }))
    : [];
  let developer;
  try {
    developer = resolveDeveloperIdentity(projectRoot, {
      user: parsed.user,
      lang: parsed.lang,
    }, adapter);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  const commandSkillNames = new Set(manifest.commands.map((cmd) => cmd.skill));
  const previewState = buildState(manifest.version, {
    commands: runtimeCommands,
    skills: filteredAssetSet.skills,
    workflowSkills: filteredAssetSet.workflowSkills,
    agents: bundledAgentPaths,
    agentSupportFiles: bundledAgentSupportFiles,
    developer,
  });

  if (platform === 'claude') {
    try {
      validateClaudeSettingsFile(projectRoot);
    } catch (error) {
      console.error(
        `Could not read Claude settings before init. ${error instanceof Error ? error.message : String(error)}`,
      );
      console.error(
        'Fix `.claude/settings.json` so it contains valid JSON, then rerun `spec-first init --claude`.',
      );
      return 1;
    }
  }

  if (legacyStateDetected) {
    console.warn('Detected legacy spec-first state; performing managed hard reset before re-init.');
    const legacyResetState = buildLegacyHardResetState({
      adapter,
      rawManagedState,
      runtimeCommands,
      bundledSkillNames: listBundledSkills(),
      commandSkillNames: [...commandSkillNames],
      bundledAgentPaths,
      bundledAgentSupportFiles,
      developer,
    });

    if (parsed.dryRun) {
      printInitDryRun({
        platform,
        plan: planHardResetManagedAssets(projectRoot, legacyResetState, adapter),
        writeSummary: buildInitWriteSummary({
          adapter,
          runtimeCommands,
          filteredAssetSet,
          bundledAgentPaths,
          bundledAgentSupportFiles,
        }),
        legacyStateDetected,
      });
      return 0;
    }

    hardResetManagedAssets(projectRoot, legacyResetState, adapter);
    previousState = null;
  }

  const preSyncPlan = mergeOperationPlans(
    planObsoleteManagedAssetRemoval(projectRoot, previousState, previewState, adapter),
    planCommandNamespacePrune(projectRoot, previewState.commands, adapter),
  );

  if (parsed.dryRun) {
    printInitDryRun({
      platform,
      plan: preSyncPlan,
      writeSummary: buildInitWriteSummary({
        adapter,
        runtimeCommands,
        filteredAssetSet,
        bundledAgentPaths,
        bundledAgentSupportFiles,
      }),
      legacyStateDetected,
    });
    return 0;
  }

  applyOperationPlan(projectRoot, preSyncPlan);

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
  adapter.syncRuntimeFiles(projectRoot, { manifest, synced });
  writeLangPolicy(projectRoot, developer, adapter);
  writeInstructionBootstrap(projectRoot, adapter, developer.lang);
  if (platform === 'claude') {
    upsertManagedSessionStartHook(projectRoot);
    console.log('🪝 Installed Claude SessionStart matcher in .claude/settings.json');
  }
  const changelogCreated = bootstrapChangelog(projectRoot, developer);
  writeDeveloperFile(projectRoot, developer, adapter);
  writeState(projectRoot, nextState, adapter);
  const written = synced.commands.map((command) => command.filename);
  const skillNames = synced.skills;
  const agentPaths = synced.agents;
  const agentSupportFiles = synced.agentSupportFiles || [];

  if (adapter.hasCommands) {
    console.log(`📦 Generated ${written.length} command file(s) in ${path.relative(projectRoot, commandDir)}`);
  }
  console.log(`🧩 Generated ${skillNames.length} skill directory(ies) in ${adapter.skillsRoot}`);
  console.log(`🤖 Generated ${agentPaths.length} agent file(s) in ${adapter.agentsRoot}`);
  if (agentSupportFiles.length > 0) {
    console.log(`🧰 Generated ${agentSupportFiles.length} agent support file(s) in ${adapter.agentsRoot}`);
  }
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
  console.log('Usage: spec-first init (--claude|--codex) [-u <name>] [--lang <zh|en>] [--dry-run]');
}

function parseInitArgs(argv) {
  const parsed = {
    help: false,
    claude: false,
    codex: false,
    force: false,
    dryRun: false,
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

    if (arg === '--dry-run') {
      parsed.dryRun = true;
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

function tryReadRawManagedState(projectRoot, adapter) {
  try {
    return readStateFileRaw(projectRoot, adapter);
  } catch (_error) {
    return null;
  }
}

function buildLegacyHardResetState({
  adapter,
  rawManagedState,
  runtimeCommands,
  bundledSkillNames,
  commandSkillNames,
  bundledAgentPaths,
  bundledAgentSupportFiles,
  developer,
}) {
  const rawState = rawManagedState && typeof rawManagedState === 'object' ? rawManagedState : {};
  const legacyTrackedSkills = mergeStringArrays(rawState.skills, rawState.workflowSkills);

  return {
    commands: mergeStringArrays(
      rawState.commands,
      runtimeCommands.map((command) => command.filename),
    ),
    skills: adapter.workflowsRoot === adapter.skillsRoot
      ? mergeStringArrays(bundledSkillNames, legacyTrackedSkills)
      : mergeStringArrays(bundledSkillNames, rawState.skills),
    workflowSkills: adapter.workflowsRoot === adapter.skillsRoot
      ? []
      : mergeStringArrays(commandSkillNames, rawState.workflowSkills),
    agents: mergeStringArrays(rawState.agents, bundledAgentPaths),
    agentSupportFiles: mergeStringArrays(rawState.agentSupportFiles, bundledAgentSupportFiles),
    developer: rawState.developer && typeof rawState.developer === 'object' ? rawState.developer : developer,
  };
}

function mergeStringArrays(...values) {
  return [...new Set(values.flatMap((value) => (
    Array.isArray(value)
      ? value.filter((entry) => typeof entry === 'string' && entry.length > 0)
      : []
  )))].sort((a, b) => a.localeCompare(b));
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

function buildInitWriteSummary({
  adapter,
  runtimeCommands,
  filteredAssetSet,
  bundledAgentPaths,
  bundledAgentSupportFiles,
}) {
  const writes = [];

  if (adapter.hasCommands) {
    writes.push({
      label: 'command file(s)',
      count: runtimeCommands.length,
      target: adapter.commandRoot,
    });
  }

  writes.push({
    label: 'standalone skill directorie(s)',
    count: filteredAssetSet.skills.length,
    target: adapter.skillsRoot,
  });

  writes.push({
    label: 'workflow skill directorie(s)',
    count: filteredAssetSet.workflowSkills.length,
    target: adapter.workflowsRoot,
  });

  writes.push({
    label: 'agent file(s)',
    count: bundledAgentPaths.length,
    target: adapter.agentsRoot,
  });

  if (bundledAgentSupportFiles.length > 0) {
    writes.push({
      label: 'agent support file(s)',
      count: bundledAgentSupportFiles.length,
      target: adapter.agentsRoot,
    });
  }

  writes.push(
    { label: 'developer profile', count: 1, target: adapter.developerFile },
    { label: 'instruction bootstrap', count: 1, target: adapter.instructionFile },
    { label: 'managed state file', count: 1, target: adapter.stateFile },
  );

  if (adapter.id === 'claude') {
    writes.push({ label: 'runtime hook file', count: 1, target: '.claude/hooks/session-start' });
    writes.push({ label: 'Claude settings matcher update', count: 1, target: '.claude/settings.json' });
  }

  return writes;
}

function printInitDryRun({ platform, plan, writeSummary, legacyStateDetected }) {
  console.log(`Dry run: spec-first init (${platform})`);
  if (legacyStateDetected) {
    console.log('Would perform a managed hard reset before regenerating runtime assets.');
  }

  const pruneCount = plan.summary.prune_command || 0;
  const removeCount = (plan.summary.remove_file || 0) + (plan.summary.remove_dir || 0);

  console.log(`Would remove ${removeCount} managed obsolete path(s).`);
  if (pruneCount > 0) {
    console.log(`Would prune ${pruneCount} unmanaged command file(s):`);
    for (const operation of plan.operations.filter((entry) => entry.kind === 'prune_command')) {
      console.log(`  - ${operation.path}`);
    }
  }

  console.log('Would write:');
  for (const entry of writeSummary) {
    console.log(`  - ${entry.count} ${entry.label} -> ${entry.target}`);
  }
  console.log('No files were changed.');
}

module.exports = {
  runInit,
};
