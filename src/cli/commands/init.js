const fs = require('node:fs');
const path = require('node:path');
const {
  buildFilteredAssetSet,
  listBundledAgentSupportFiles,
  listBundledAgents,
  listBundledSkills,
  loadPluginManifest,
  planBundledAssetSync,
} = require('../plugin');
const {
  formatDeveloperContents,
  resolveDeveloperIdentity,
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
} = require('../state');
const { getAdapter } = require('../adapters');
const { applyManagedBlock, buildManagedBlock } = require('../lang-policy');
const { buildInitialChangelog, formatChangelogTimestamp } = require('../changelog');
const { applyManagedBootstrapBlock, buildBootstrapBlock } = require('../instruction-bootstrap');
const {
  getClaudeSettingsPath,
  renderManagedSessionStartHookUpsert,
  validateClaudeSettingsFile,
} = require('../claude-settings');

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
  const assetSync = planBundledAssetSync(projectRoot, adapter, filteredAssetSet);
  const runtimeSyncPlan = adapter.planRuntimeFilesSync(projectRoot, { manifest, filteredAssetSet });
  const previewState = buildState(manifest.version, {
    ...assetSync.syncedAssets,
    platform,
    developer: {
      path: adapter.developerFile,
      name: developer.name,
      lang: developer.lang,
      initializedAt: developer.initializedAt,
      version: developer.version,
    },
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
      const hardResetPlan = planHardResetManagedAssets(projectRoot, legacyResetState, adapter);
      const initWritePlan = buildInitWritePlan({
        projectRoot,
        adapter,
        developer,
        nextState: previewState,
        platform,
        assetPlan: assetSync.plan,
        runtimePlan: runtimeSyncPlan,
      });
      printInitDryRun({
        platform,
        plan: mergeOperationPlans(hardResetPlan, initWritePlan),
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
  const initWritePlan = buildInitWritePlan({
    projectRoot,
    adapter,
    developer,
    nextState: previewState,
    platform,
    assetPlan: assetSync.plan,
    runtimePlan: runtimeSyncPlan,
  });

  if (parsed.dryRun) {
    printInitDryRun({
      platform,
      plan: mergeOperationPlans(preSyncPlan, initWritePlan),
      legacyStateDetected,
    });
    return 0;
  }

  const changelogCreated = !fs.existsSync(path.join(projectRoot, 'CHANGELOG.md'));
  applyOperationPlan(projectRoot, preSyncPlan);
  applyOperationPlan(projectRoot, initWritePlan);
  if (platform === 'claude') {
    console.log('🪝 Installed Claude SessionStart matcher in .claude/settings.json');
  }
  const synced = assetSync.syncedAssets;
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

function buildInitWritePlan({
  projectRoot,
  adapter,
  developer,
  nextState,
  platform,
  assetPlan,
  runtimePlan,
}) {
  return mergeOperationPlans(
    assetPlan,
    runtimePlan || buildInitRuntimePreviewPlan(projectRoot, adapter),
    buildInitMetadataPlan({ projectRoot, adapter, developer, nextState, platform }),
  );
}

function buildInitRuntimePreviewPlan(projectRoot, adapter) {
  return adapter.planRuntimeFilesSync(projectRoot);
}

function buildInitMetadataPlan({ projectRoot, adapter, developer, nextState, platform }) {
  const operations = [];
  const instructionPath = path.join(projectRoot, adapter.instructionFile);
  const existingInstruction = fs.existsSync(instructionPath)
    ? fs.readFileSync(instructionPath, 'utf8')
    : '';
  const instructionWithLang = applyManagedBlock(existingInstruction, buildManagedBlock(developer.lang));
  const finalInstruction = applyManagedBootstrapBlock(
    instructionWithLang,
    buildBootstrapBlock(adapter, developer.lang),
  );
  operations.push(buildPlanFileOperation(
    projectRoot,
    adapter.instructionFile,
    finalInstruction,
    'managed_instruction_file',
  ));

  operations.push(buildPlanFileOperation(
    projectRoot,
    adapter.developerFile,
    formatDeveloperContents(developer),
    'managed_developer_profile',
  ));

  operations.push(buildPlanFileOperation(
    projectRoot,
    adapter.stateFile,
    `${JSON.stringify(nextState, null, 2)}\n`,
    'managed_state_file',
  ));

  const changelogPath = path.join(projectRoot, 'CHANGELOG.md');
  if (!fs.existsSync(changelogPath)) {
    operations.push(buildPlanFileOperation(
      projectRoot,
      'CHANGELOG.md',
      buildInitialChangelog(formatChangelogTimestamp(new Date()), developer.name, developer.version),
      'bootstrap_changelog',
    ));
  }

  if (platform === 'claude') {
    const rendered = renderManagedSessionStartHookUpsert(projectRoot);
    operations.push(buildPlanFileOperation(
      projectRoot,
      path.relative(projectRoot, getClaudeSettingsPath(projectRoot)),
      rendered.contents,
      'managed_session_start_matcher',
    ));
  }

  return {
    operations,
    summary: summarizePlanOperations(operations),
  };
}

function buildPlanFileOperation(projectRoot, relativePath, contents, reason) {
  const absolutePath = path.join(projectRoot, relativePath);
  return {
    kind: fs.existsSync(absolutePath) ? 'update_file' : 'write_file',
    path: normalizePlanPath(relativePath),
    reason,
    contents,
  };
}

function summarizePlanOperations(operations) {
  return operations.reduce((summary, operation) => {
    summary[operation.kind] = (summary[operation.kind] || 0) + 1;
    return summary;
  }, {});
}

function normalizePlanPath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function printInitDryRun({ platform, plan, legacyStateDetected }) {
  console.log(`Dry run: spec-first init (${platform})`);
  if (legacyStateDetected) {
    console.log('Would perform a managed hard reset before regenerating runtime assets.');
  }

  const pruneCount = plan.summary.prune_command || 0;
  const removeCount = (plan.summary.remove_file || 0) + (plan.summary.remove_dir || 0);
  const ensureCount = plan.summary.ensure_dir || 0;
  const writeCount = (plan.summary.write_file || 0) + (plan.summary.update_file || 0);

  console.log(`Would remove ${removeCount} managed obsolete path(s).`);
  if (pruneCount > 0) {
    console.log(`Would prune ${pruneCount} unmanaged command file(s):`);
    for (const operation of plan.operations.filter((entry) => entry.kind === 'prune_command')) {
      console.log(`  - ${operation.path}`);
    }
  }

  if (ensureCount > 0) {
    console.log(`Would ensure ${ensureCount} managed directorie(s):`);
    for (const operation of plan.operations.filter((entry) => entry.kind === 'ensure_dir')) {
      console.log(`  - ${operation.path}`);
    }
  }

  if (writeCount > 0) {
    console.log(`Would write/update ${writeCount} managed file(s):`);
    for (const operation of plan.operations.filter((entry) =>
      entry.kind === 'write_file' || entry.kind === 'update_file'
    )) {
      console.log(`  - ${operation.path}`);
    }
  }
  console.log('No files were changed.');
}

module.exports = {
  runInit,
};
