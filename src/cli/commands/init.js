const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const {
  buildFilteredAssetSet,
  inspectInstalledAssets,
  listBundledAgentSupportFiles,
  listBundledAgents,
  listBundledSkills,
  loadPluginManifest,
  planBundledAssetSync,
} = require('../plugin');
const {
  formatDeveloperContents,
  resolveChangelogAuthor,
  resolveDeveloperIdentity,
} = require('../developer');
const {
  applyOperationPlan,
  buildState,
  buildFileWriteOperation,
  isLegacyManagedState,
  mergeOperationPlans,
  planCommandNamespacePrune,
  planHardResetManagedAssets,
  planObsoleteManagedAssetRemoval,
  readStateFileRaw,
  readState,
  summarizeOperationPlan,
} = require('../state');
const { getAdapter } = require('../adapters');
const { applyManagedBlock, buildManagedBlock } = require('../lang-policy');
const {
  applyManagedCodingGuidelinesBlock,
  buildCodingGuidelinesBlock,
  inspectCodingGuidelinesBlock,
} = require('../coding-guidelines');
const { buildInitialChangelog, formatChangelogTimestamp } = require('../changelog');
const {
  applyManagedBootstrapBlock,
  buildBootstrapBlock,
  inspectInstructionBootstrap,
} = require('../instruction-bootstrap');
const {
  getClaudeSettingsPath,
  inspectManagedSessionStartHook,
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
  let destructiveResetPlan = null;
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
      const postResetPreSyncPlan = mergeOperationPlans(
        planObsoleteManagedAssetRemoval(projectRoot, null, previewState, adapter),
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
      printInitDryRun({
        platform,
        plan: mergeOperationPlans(hardResetPlan, postResetPreSyncPlan, initWritePlan),
        legacyStateDetected,
      });
      return 0;
    }

    destructiveResetPlan = planHardResetManagedAssets(projectRoot, legacyResetState, adapter);
    previousState = null;
  } else if (previousState) {
    const currentRuntimeDrift = inspectCurrentRuntimeDrift(projectRoot, adapter);
    if (currentRuntimeDrift.detected) {
      console.warn(
        `Detected current spec-first runtime drift; performing managed hard reset before re-init. (${currentRuntimeDrift.reasons.join(', ')})`,
      );

      if (parsed.dryRun) {
        const hardResetPlan = planHardResetManagedAssets(projectRoot, previousState, adapter);
        const postResetPreSyncPlan = mergeOperationPlans(
          planObsoleteManagedAssetRemoval(projectRoot, null, previewState, adapter),
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
        printInitDryRun({
          platform,
          plan: mergeOperationPlans(hardResetPlan, postResetPreSyncPlan, initWritePlan),
          destructiveResetReason: 'current_runtime_drift',
        });
        return 0;
      }

      destructiveResetPlan = planHardResetManagedAssets(projectRoot, previousState, adapter);
      previousState = null;
    }
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
  if (destructiveResetPlan) {
    const destructiveBackup = createRuntimeRollbackBackup({
      projectRoot,
      plans: [destructiveResetPlan, preSyncPlan, initWritePlan],
    });
    try {
      applyOperationPlan(projectRoot, destructiveResetPlan);
      applyOperationPlan(projectRoot, preSyncPlan);
      applyOperationPlan(projectRoot, initWritePlan);
      removeRuntimeRollbackBackup(destructiveBackup);
    } catch (error) {
      restoreRuntimeRollbackBackup(projectRoot, destructiveBackup);
      removeRuntimeRollbackBackup(destructiveBackup);
      throw error;
    }
  } else {
    applyOperationPlan(projectRoot, preSyncPlan);
    applyOperationPlan(projectRoot, initWritePlan);
  }
  if (platform === 'claude') {
    console.log('🪝 Installed Claude SessionStart matcher in .claude/settings.json');
  }
  const synced = assetSync.syncedAssets;
  const written = synced.commands.map((command) => command.filename);
  const skillNames = adapter.workflowsRoot === adapter.skillsRoot
    ? mergeStringArrays(synced.skills, synced.workflowSkills)
    : synced.skills;
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
  console.log([
    '🚀 spec-first init',
    '',
    '📘 Usage:',
    '  spec-first init (--claude|--codex) [-u <name>] [--lang <zh|en>] [--dry-run]',
    '',
    '🔗 Repository:',
    '  https://github.com/sunrain520/spec-first',
  ].join('\n'));
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

function inspectCurrentRuntimeDrift(projectRoot, adapter) {
  const reasons = [];
  const installedAssets = inspectInstalledAssets(projectRoot, adapter);
  for (const key of ['commands', 'skills', 'agents', 'agentSupportFiles']) {
    const status = installedAssets[key] || {};
    if (Array.isArray(status.missing) && status.missing.length > 0) {
      reasons.push(`${key}_missing`);
    }
    if (Array.isArray(status.drifted) && status.drifted.length > 0) {
      reasons.push(`${key}_drifted`);
    }
  }

  const bootstrapStatus = inspectInstructionBootstrap(projectRoot, adapter);
  if (bootstrapStatus.status !== 'installed') {
    reasons.push(`bootstrap_${bootstrapStatus.status}`);
  }

  const codingGuidelinesStatus = inspectCodingGuidelinesBlock(projectRoot, adapter);
  if (codingGuidelinesStatus.status !== 'installed') {
    reasons.push(`coding_guidelines_${codingGuidelinesStatus.status}`);
  }

  for (const check of adapter.inspectRuntimeFiles(projectRoot)) {
    if (check.level !== 'PASS') {
      reasons.push(`runtime_file_${String(check.name || 'unknown').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`);
    }
  }

  if (adapter.id === 'claude') {
    const sessionStartStatus = inspectManagedSessionStartHook(projectRoot);
    if (sessionStartStatus.status !== 'installed') {
      reasons.push(`session_start_${sessionStartStatus.status}`);
    }
  }

  return {
    detected: reasons.length > 0,
    reasons: [...new Set(reasons)],
  };
}

function createRuntimeRollbackBackup({ projectRoot, plans = [] } = {}) {
  const pathKinds = new Map();

  for (const plan of plans) {
    if (!plan || !Array.isArray(plan.operations)) continue;
    for (const operation of plan.operations) {
      if (!operation || !operation.path) continue;
      if (!['remove_file', 'remove_dir', 'prune_command', 'write_file', 'update_file'].includes(operation.kind)) {
        continue;
      }

      const kinds = pathKinds.get(operation.path) || new Set();
      kinds.add(operation.kind);
      pathKinds.set(operation.path, kinds);
    }
  }

  const orderedPaths = [...pathKinds.keys()]
    .sort((left, right) => left.length - right.length || left.localeCompare(right));
  const selectedEntries = [];

  for (const relativePath of orderedPaths) {
    const kinds = pathKinds.get(relativePath);
    const absolutePath = path.join(projectRoot, relativePath);
    const stats = fs.existsSync(absolutePath) ? fs.lstatSync(absolutePath) : null;
    const isDirectory = kinds.has('remove_dir') || Boolean(stats && stats.isDirectory());

    if (selectedEntries.some((entry) => entry.isDirectory && isNestedPath(relativePath, entry.relativePath))) {
      continue;
    }

    selectedEntries.push({
      relativePath,
      absolutePath,
      isDirectory,
      existed: Boolean(stats),
      mode: stats ? (stats.mode & 0o777) : null,
    });
  }

  if (selectedEntries.length === 0) {
    return null;
  }

  const backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-init-backup-'));
  for (const entry of selectedEntries) {
    if (!entry.existed) continue;
    const backupPath = path.join(backupRoot, entry.relativePath);
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.cpSync(entry.absolutePath, backupPath, { recursive: entry.isDirectory });
  }

  return {
    backupRoot,
    entries: selectedEntries.map((entry) => ({
      relativePath: entry.relativePath,
      isDirectory: entry.isDirectory,
      existed: entry.existed,
      mode: entry.mode,
    })),
  };
}

function restoreRuntimeRollbackBackup(projectRoot, backup) {
  if (!backup || !backup.backupRoot || !Array.isArray(backup.entries)) {
    return false;
  }

  const restoreEntries = [...backup.entries]
    .sort((left, right) => right.relativePath.length - left.relativePath.length || right.relativePath.localeCompare(left.relativePath));

  for (const entry of restoreEntries) {
    const targetPath = path.join(projectRoot, entry.relativePath);
    fs.rmSync(targetPath, { recursive: true, force: true });
    if (!entry.existed) continue;

    const backupPath = path.join(backup.backupRoot, entry.relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.cpSync(backupPath, targetPath, { recursive: entry.isDirectory });
    if (typeof entry.mode === 'number' && !entry.isDirectory) {
      fs.chmodSync(targetPath, entry.mode);
    }
  }

  return true;
}

function removeRuntimeRollbackBackup(backup) {
  if (!backup || !backup.backupRoot || !fs.existsSync(backup.backupRoot)) {
    return false;
  }

  fs.rmSync(backup.backupRoot, { recursive: true, force: true });
  return true;
}

function isNestedPath(childPath, parentPath) {
  return childPath === parentPath || childPath.startsWith(`${parentPath}/`);
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
  const instructionWithBootstrap = applyManagedBootstrapBlock(
    instructionWithLang,
    buildBootstrapBlock(adapter, developer.lang),
  );
  const finalInstruction = applyManagedCodingGuidelinesBlock(
    instructionWithBootstrap,
    buildCodingGuidelinesBlock(developer.lang),
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
    const changelogAuthor = resolveChangelogAuthor(projectRoot, {
      fallbackName: developer.name,
    });
    operations.push(buildPlanFileOperation(
      projectRoot,
      'CHANGELOG.md',
      buildInitialChangelog(formatChangelogTimestamp(new Date()), changelogAuthor.name, developer.version),
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
    summary: summarizeOperationPlan(operations),
  };
}

function buildPlanFileOperation(projectRoot, relativePath, contents, reason) {
  const absolutePath = path.join(projectRoot, relativePath);
  return buildFileWriteOperation(projectRoot, absolutePath, contents, reason);
}

function printInitDryRun({ platform, plan, legacyStateDetected, destructiveResetReason = '' }) {
  console.log(`Dry run: spec-first init (${platform})`);
  if (legacyStateDetected) {
    console.log('Would perform a managed hard reset before regenerating runtime assets.');
  } else if (destructiveResetReason === 'current_runtime_drift') {
    console.log('Would perform a managed hard reset before regenerating runtime assets (current runtime drift detected).');
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
