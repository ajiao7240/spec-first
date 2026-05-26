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
  getGlobalDeveloperPath,
  getProjectDeveloperPath,
  readDeveloperFile,
  readGitUserName,
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
  planRetiredRuntimeAssetPrune,
  readStateFileRaw,
  readState,
  summarizeOperationPlan,
} = require('../state');
const { planRuntimeUntrack } = require('../runtime-untrack');
const { getAdapter } = require('../adapters');
const { applyManagedBlock, buildManagedBlock } = require('../lang-policy');
const {
  applyManagedCodingGuidelinesBlock,
  buildCodingGuidelinesBlock,
  inspectCodingGuidelinesBlock,
} = require('../coding-guidelines');
const { buildInitialChangelog, formatChangelogTimestamp } = require('../changelog');
const { applySpecFirstGitignoreBlock } = require('../gitignore-policy');
const {
  applyManagedBootstrapBlock,
  buildBootstrapBlock,
  inspectInstructionBootstrap,
} = require('../instruction-bootstrap');
const { normalizeGitNexusInstructionBlock } = require('../gitnexus-instruction-block');
const { removeManagedRuntimeToolsBlock } = require('../runtime-tools-index');
const {
  getClaudeSettingsPath,
  inspectManagedSessionStartHook,
  renderManagedSessionStartHookUpsert,
  validateClaudeSettingsFile,
} = require('../claude-settings');
const {
  PromptCancelled,
  checkbox,
  confirm,
  requireTty,
  select,
  textInput,
} = require('../prompts');

const INIT_PLATFORM_CHOICES = [
  {
    id: 'claude',
    flag: 'claude',
    label: 'Claude Code',
    defaultChecked: false,
    defaultForYes: true,
  },
  {
    id: 'codex',
    flag: 'codex',
    label: 'Codex',
    defaultChecked: false,
    defaultForYes: true,
  },
];

async function runInit(argv, promptOverrides = {}) {
  const args = [...argv];
  const promptApi = {
    checkbox,
    confirm,
    requireTty,
    select,
    textInput,
    ...promptOverrides,
  };

  const parsed = parseInitArgs(args);
  if (parsed.help) {
    printHelp();
    return 0;
  }

  if (parsed.error) {
    console.error(parsed.error);
    console.error('Usage: spec-first init [--claude] [--codex] [-y] [-u <name>] [--lang <zh|en>]');
    return 2;
  }

  if (!parsed.yes) {
    const tty = promptApi.requireTty();
    if (!tty.ok) {
      console.error('spec-first init requires an interactive terminal unless `-y/--yes` is used with defaults or explicit host flags.');
      console.error('spec-first init 需要交互式终端；如需跳过引导，请使用 `-y/--yes` 并按需指定 `--claude` / `--codex`。');
      return 2;
    }
  }

  if (parsed.yes && parsed.platforms.length === 0 && defaultInitPlatforms().length === 0) {
    console.error('spec-first init -y requires at least one default host runtime.');
    return 2;
  }

  try {
    const interactiveInput = await collectInitInput({
      workspaceRoot: process.cwd(),
      promptApi,
      parsed,
    });
    if (!interactiveInput) {
      console.log('已取消。');
      return 0;
    }

    const plans = buildInitPlans(interactiveInput);
    for (const plan of plans) {
      printInitDiagnostics(plan);
    }
    const errors = plans.flatMap((plan) => collectInitErrors(plan));
    if (errors.length > 0) {
      for (const error of errors) {
        console.error(error.message || String(error));
      }
      return 1;
    }

    if (!parsed.yes) {
      printInitPreviews(plans);
      const confirmed = await promptApi.confirm('Apply these changes?', { default: true });
      if (!confirmed) {
        console.log('已取消。');
        return 0;
      }
    }

    const results = [];
    for (const [index, plan] of plans.entries()) {
      const result = applyInitPlan(plan.mode === 'all-repos' ? plan.workspaceRoot : plan.projectRoot, plan);
      results.push(result);
      if (plan.mode === 'all-repos') {
        printWorkspaceInitApplySuccess(plan, result);
      } else {
        printInitApplySuccess(plan, result, {
          showNextSteps: plans.length === 1,
          suppressChangelogCreated: plans.length > 1 && index > 0,
        });
      }
    }

    if (plans.length > 1) {
      console.log('');
      printInitNextStepsForPlatforms(interactiveInput.platforms, interactiveInput.lang);
    }

    return results.some((result) => result.exit_code !== 0) ? 1 : 0;
  } catch (error) {
    if (error instanceof PromptCancelled || error.code === 'prompt_cancelled') {
      console.log('已取消。');
      return 0;
    }
    throw error;
  }
}

function parseInitArgs(args) {
  const parsed = {
    help: false,
    yes: false,
    platforms: [],
    name: '',
    lang: '',
    error: '',
  };
  const platforms = new Set();

  const readValue = (index, optionName) => {
    const value = args[index + 1];
    if (!value || value.startsWith('-')) {
      parsed.error = `init: missing value for ${optionName}`;
      return '';
    }
    return value;
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '-h' || arg === '--help') {
      parsed.help = true;
      continue;
    }
    if (arg === '-y' || arg === '--yes') {
      parsed.yes = true;
      continue;
    }
    if (arg === '-u' || arg === '--user') {
      const value = readValue(index, arg);
      if (parsed.error) break;
      parsed.name = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--user=')) {
      parsed.name = arg.slice('--user='.length);
      if (!parsed.name) parsed.error = 'init: missing value for --user';
      if (parsed.error) break;
      continue;
    }
    if (arg === '--lang') {
      const value = readValue(index, arg);
      if (parsed.error) break;
      parsed.lang = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--lang=')) {
      parsed.lang = arg.slice('--lang='.length);
      if (!parsed.lang) parsed.error = 'init: missing value for --lang';
      if (parsed.error) break;
      continue;
    }
    const platformChoice = INIT_PLATFORM_CHOICES.find((choice) => arg === `--${choice.flag}`);
    if (platformChoice) {
      platforms.add(platformChoice.id);
      continue;
    }
    parsed.error = `init: unknown option ${arg}`;
    break;
  }

  if (!parsed.error && parsed.lang && parsed.lang !== 'zh' && parsed.lang !== 'en') {
    parsed.error = 'init: --lang must be zh or en';
  }

  parsed.platforms = [...platforms];
  return parsed;
}

async function collectInitInput({
  workspaceRoot,
  promptApi,
  parsed,
}) {
  const root = canonicalizeExistingPath(workspaceRoot);
  const platforms = parsed.platforms.length > 0
    ? parsed.platforms
    : parsed.yes
      ? defaultInitPlatforms()
      : await promptApi.checkbox('Select host runtimes to initialize:', INIT_PLATFORM_CHOICES.map((choice) => ({
        label: choice.label,
        value: choice.id,
        checked: choice.defaultChecked,
      })), { minSelected: 1 });

  if (!Array.isArray(platforms) || platforms.length === 0) {
    return null;
  }

  const adapters = platforms.map((platform) => getAdapter(platform));
  const defaults = resolveDeveloperDefaults(root, adapters);
  const name = parsed.name || (parsed.yes
    ? defaults.name
    : await promptApi.textInput('Developer name:', {
      default: defaults.name,
      validate: (value) => (String(value || '').trim().length > 0 ? true : 'Developer name is required.'),
    }));
  const lang = parsed.lang || (parsed.yes
    ? defaults.lang
    : await promptApi.select('Default response language:', [
      { label: 'Chinese / 中文 (zh)', value: 'zh' },
      { label: 'English (en)', value: 'en' },
    ], {
      defaultIndex: defaults.lang === 'en' ? 1 : 0,
    }));
  const target = parsed.yes
    ? collectDefaultInitTarget(root)
    : await collectInteractiveInitTarget(root, promptApi);
  if (!target) {
    return null;
  }

  return {
    projectRoot: target.projectRoot || root,
    workspaceRoot: target.workspaceRoot || root,
    platforms,
    name,
    lang,
    target,
  };
}

function defaultInitPlatforms() {
  return INIT_PLATFORM_CHOICES
    .filter((choice) => choice.defaultForYes)
    .map((choice) => choice.id);
}

function buildInitPlans(input) {
  return input.platforms.map((platform) => buildInitPlan({
    ...input,
    platform,
    adapter: getAdapter(platform),
  }));
}

function collectDefaultInitTarget(workspaceRoot) {
  const cwdGitRoot = findGitRoot(workspaceRoot);
  if (cwdGitRoot) {
    return {
      mode: 'single-repo',
      projectRoot: cwdGitRoot,
      selectionSource: 'cwd-git-or-monorepo',
    };
  }

  return {
    mode: 'single-repo',
    projectRoot: workspaceRoot,
    selectionSource: 'cwd-directory-non-interactive',
  };
}

async function collectInteractiveInitTarget(workspaceRoot, promptApi) {
  const cwdGitRoot = findGitRoot(workspaceRoot);
  if (cwdGitRoot) {
    return {
      mode: 'single-repo',
      projectRoot: cwdGitRoot,
      selectionSource: 'cwd-git-or-monorepo',
    };
  }

  const candidates = discoverChildGitRepos(workspaceRoot);
  if (candidates.length === 0) {
    return {
      mode: 'single-repo',
      projectRoot: workspaceRoot,
      selectionSource: 'cwd-directory',
    };
  }

  return promptApi.select('Select workspace target:', [
    {
      label: `All child repos (${candidates.length})`,
      value: {
        mode: 'all-repos',
        workspaceRoot,
        candidates,
        selectionSource: 'workspace-interactive-all-repos',
      },
    },
    ...candidates.map((candidate) => ({
      label: candidate.workspace_relative_path,
      value: {
        mode: 'single-repo',
        projectRoot: candidate.git_root,
        selectionSource: 'workspace-interactive-single-repo',
      },
    })),
    {
      label: 'Cancel',
      value: null,
    },
  ], { requireExplicit: true });
}

function resolveDeveloperDefaults(projectRoot, adapters) {
  const adapterList = Array.isArray(adapters) ? adapters : [adapters];
  const projectDevelopers = adapterList
    .map((adapter) => readDeveloperFile(getProjectDeveloperPath(projectRoot, adapter)))
    .filter(Boolean);
  const globalDeveloper = readDeveloperFile(getGlobalDeveloperPath());
  const gitUserName = readGitUserName(projectRoot);
  const name =
    firstTruthy(projectDevelopers.map((developer) => developer.name)) ||
    (globalDeveloper && globalDeveloper.name) ||
    gitUserName ||
    '';
  const lang =
    firstTruthy(projectDevelopers.map((developer) => normalizeSupportedLang(developer.lang))) ||
    normalizeSupportedLang(globalDeveloper && globalDeveloper.lang) ||
    'zh';

  return {
    name,
    lang,
  };
}

function firstTruthy(values) {
  return (Array.isArray(values) ? values : []).find(Boolean) || '';
}

function normalizeSupportedLang(value) {
  return value === 'zh' || value === 'en' ? value : '';
}

function printInitPreview(plan) {
  if (plan.mode === 'all-repos') {
    console.log(`Workspace preview: spec-first init (${plan.platform})`);
    console.log(`  workspace_root: ${plan.workspaceRoot}`);
    console.log(`  selection_source: ${plan.selectionSource}`);
    console.log(`  child_repos: ${plan.childPlans.length}`);
    console.log('');
    console.log('Parent runtime assets:');
    printInitDryRun({
      platform: plan.platform,
      plan: plan.parentPlan.operationPlan,
      untrackDiagnostic: plan.parentPlan.untrackDiagnostic,
      legacyStateDetected: plan.parentPlan.legacyStateDetected,
      destructiveResetReason: plan.parentPlan.destructiveResetReason,
      showPathSamples: false,
    });
    plan.childPlans.forEach((entry, index) => {
      console.log('');
      console.log(`Child ${index + 1}/${plan.childPlans.length}: ${entry.candidate.workspace_relative_path}`);
      printInitDryRun({
        platform: plan.platform,
        plan: entry.plan.operationPlan,
        untrackDiagnostic: entry.plan.untrackDiagnostic,
        legacyStateDetected: entry.plan.legacyStateDetected,
        destructiveResetReason: entry.plan.destructiveResetReason,
        showPathSamples: false,
      });
    });
    return;
  }

  printInitDryRun({
    platform: plan.platform,
    plan: plan.operationPlan,
    untrackDiagnostic: plan.untrackDiagnostic,
    legacyStateDetected: plan.legacyStateDetected,
    destructiveResetReason: plan.destructiveResetReason,
    showPathSamples: false,
  });
}

function printInitPreviews(plans) {
  if (plans.length === 1) {
    printInitPreview(plans[0]);
    return;
  }

  console.log(`Selected host runtimes: ${plans.map((plan) => initPlatformLabel(plan.platform)).join(', ')}`);
  plans.forEach((plan, index) => {
    console.log('');
    console.log(`Host runtime ${index + 1}/${plans.length}: ${initPlatformLabel(plan.platform)}`);
    printInitPreview(plan);
  });
}

function printWorkspaceInitApplySuccess(plan, result) {
  const summary = result.workspace_summary || {};
  const counts = summary.counts || {};
  console.log(`Workspace init summary: ${summary.overall_status || 'unknown'} (${counts.ready || 0}/${counts.total || 0} ready)`);
  if (result.exit_code === 0) {
    console.log('🧭 Wrote parent advisory summary: .spec-first/workspace/init-summary.json');
  }
}

function runInitForProject({
  parsed,
  platform,
  adapter,
  projectRoot,
  gitRootTopology = 'single-repo',
}) {
  const plan = buildInitPlan({
    projectRoot,
    platform,
    adapter,
    name: parsed.user,
    lang: parsed.lang,
    gitRootTopology,
    dryRun: parsed.dryRun,
  });

  printInitDiagnostics(plan);
  if (Array.isArray(plan.errors) && plan.errors.length > 0) {
    for (const error of plan.errors) {
      console.error(error.message || String(error));
    }
    return buildProjectInitResult(1, plan.untrackDiagnostic);
  }

  if (parsed.dryRun) {
    printInitDryRun({
      platform,
      plan: plan.operationPlan,
      untrackDiagnostic: plan.untrackDiagnostic,
      legacyStateDetected: plan.legacyStateDetected,
      destructiveResetReason: plan.destructiveResetReason,
    });
    return buildProjectInitResult(0, plan.untrackDiagnostic);
  }

  const result = applyInitPlan(projectRoot, plan);
  printInitApplySuccess(plan, result);
  return result;
}

function buildInitPlan(input = {}) {
  const platform = normalizeInitPlatform(input.platform);
  const adapter = input.adapter || getAdapter(platform);
  const target = input.target && typeof input.target === 'object'
    ? input.target
    : {
      mode: 'single-repo',
      projectRoot: input.projectRoot || process.cwd(),
    };

  if (target.mode === 'all-repos') {
    const workspaceRoot = canonicalizeExistingPath(target.workspaceRoot || input.projectRoot || process.cwd());
    const candidates = Array.isArray(target.candidates) && target.candidates.length > 0
      ? target.candidates
      : discoverChildGitRepos(workspaceRoot);
    return buildWorkspaceInitPlan({
      ...input,
      platform,
      adapter,
      workspaceRoot,
      candidates,
      selectionSource: target.selectionSource || input.selectionSource || 'programmatic-all-repos',
    });
  }

  return buildProjectInitPlan({
    ...input,
    platform,
    adapter,
    projectRoot: target.projectRoot || input.projectRoot || process.cwd(),
    gitRootTopology: input.gitRootTopology || target.gitRootTopology || 'single-repo',
  });
}

function applyInitPlan(projectRoot, plan) {
  if (!plan || typeof plan !== 'object') {
    throw new Error('applyInitPlan requires an init plan object.');
  }

  if (plan.mode === 'all-repos') {
    return applyWorkspaceInitPlan(projectRoot || plan.workspaceRoot, plan);
  }

  return applyProjectInitPlan(projectRoot || plan.projectRoot, plan);
}

function buildProjectInitPlan({
  projectRoot,
  platform,
  adapter,
  name = '',
  user = '',
  lang = '',
  gitRootTopology = 'single-repo',
  dryRun = false,
}) {
  const normalizedRoot = canonicalizeExistingPath(projectRoot);
  const errors = [];
  const diagnostics = [];
  const bundledAgentPaths = listBundledAgents();
  const bundledAgentSupportFiles = listBundledAgentSupportFiles();

  if (platform === 'claude') {
    const duplicateBareNames = findDuplicateClaudeAgentNames(bundledAgentPaths);
    if (duplicateBareNames.length > 0) {
      errors.push({
        code: 'duplicate_claude_agent_names',
        message: `Error: Claude runtime requires unique bare agent names, but found duplicates: ${duplicateBareNames.join(', ')}`,
      });
      return buildErroredProjectInitPlan({
        projectRoot: normalizedRoot,
        platform,
        adapter,
        dryRun,
        gitRootTopology,
        errors,
        diagnostics,
      });
    }
  }

  const commandDir = adapter.hasCommands ? path.join(normalizedRoot, adapter.commandRoot) : '';
  let previousState = null;
  let legacyStateDetected = false;
  let rawManagedState = null;
  let destructiveResetPlan = null;
  let destructiveResetReason = '';
  try {
    previousState = readState(normalizedRoot, adapter);
  } catch (error) {
    rawManagedState = tryReadRawManagedState(normalizedRoot, adapter);
    if (isLegacyManagedState(rawManagedState)) {
      legacyStateDetected = true;
    } else {
      diagnostics.push({
        level: 'warn',
        code: 'managed_state_unreadable',
        message: `Warning: could not read existing spec-first state; continuing with a fresh sync. (${error instanceof Error ? error.message : String(error)})`,
      });
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
    developer = resolveDeveloperIdentity(normalizedRoot, {
      user: user || name,
      lang,
    }, adapter);
  } catch (error) {
    errors.push({
      code: 'developer_identity_unresolved',
      message: error instanceof Error ? error.message : String(error),
    });
    return buildErroredProjectInitPlan({
      projectRoot: normalizedRoot,
      platform,
      adapter,
      dryRun,
      gitRootTopology,
      errors,
      diagnostics,
    });
  }

  const commandSkillNames = new Set(manifest.commands.map((cmd) => cmd.skill));
  const assetSync = planBundledAssetSync(normalizedRoot, adapter, filteredAssetSet);
  const runtimeSyncPlan = adapter.planRuntimeFilesSync(normalizedRoot, { manifest, filteredAssetSet });
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
      validateClaudeSettingsFile(normalizedRoot);
    } catch (error) {
      errors.push({
        code: 'invalid_claude_settings_json',
        message: `Could not read Claude settings before init. ${error instanceof Error ? error.message : String(error)}`,
      });
      errors.push({
        code: 'invalid_claude_settings_fix',
        message: 'Fix `.claude/settings.json` so it contains valid JSON, then rerun `spec-first init` and choose Claude Code when prompted.',
      });
      return buildErroredProjectInitPlan({
        projectRoot: normalizedRoot,
        platform,
        adapter,
        dryRun,
        gitRootTopology,
        errors,
        diagnostics,
      });
    }
  }

  if (legacyStateDetected) {
    diagnostics.push({
      level: 'warn',
      code: 'legacy_state_detected',
      message: 'Detected legacy spec-first state; performing managed hard reset before re-init.',
    });
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
    destructiveResetPlan = planHardResetManagedAssets(normalizedRoot, legacyResetState, adapter);
    destructiveResetReason = 'legacy_state_detected';
    previousState = null;
  } else if (previousState) {
    const currentRuntimeDrift = inspectCurrentRuntimeDrift(normalizedRoot, adapter);
    if (currentRuntimeDrift.detected) {
      diagnostics.push({
        level: 'warn',
        code: 'current_runtime_drift',
        message: `Detected current spec-first runtime drift; performing managed hard reset before re-init. (${currentRuntimeDrift.reasons.join(', ')})`,
        reasons: currentRuntimeDrift.reasons,
      });
      destructiveResetPlan = planHardResetManagedAssets(normalizedRoot, previousState, adapter);
      destructiveResetReason = 'current_runtime_drift';
      previousState = null;
    }
  }

  const preSyncPlan = mergeOperationPlans(
    planObsoleteManagedAssetRemoval(normalizedRoot, previousState, previewState, adapter),
    planCommandNamespacePrune(normalizedRoot, previewState.commands, adapter),
    planRetiredRuntimeAssetPrune(normalizedRoot, adapter),
  );
  const initWritePlan = buildInitWritePlan({
    projectRoot: normalizedRoot,
    adapter,
    developer,
    nextState: previewState,
    platform,
    assetPlan: assetSync.plan,
    runtimePlan: runtimeSyncPlan,
    gitRootTopology,
  });

  const operationPlan = mergeOperationPlans(destructiveResetPlan, preSyncPlan, initWritePlan.plan);
  return {
    schema_version: 'spec-first-init-plan.v1',
    mode: 'single-repo',
    projectRoot: normalizedRoot,
    platform,
    gitRootTopology,
    dryRun: Boolean(dryRun),
    adapterId: adapter.id,
    commandDir,
    developer,
    previousState,
    previewState,
    destructiveResetPlan,
    destructiveResetReason,
    legacyStateDetected,
    preSyncPlan,
    writePlan: initWritePlan.plan,
    operationPlan,
    untrackDiagnostic: initWritePlan.untrackDiagnostic,
    syncedAssets: assetSync.syncedAssets,
    changelogCreated: !fs.existsSync(path.join(normalizedRoot, 'CHANGELOG.md')),
    diagnostics,
    errors,
    summary: operationPlan.summary,
  };
}

function applyProjectInitPlan(projectRoot, plan) {
  const normalizedRoot = canonicalizeExistingPath(projectRoot || plan.projectRoot);
  if (Array.isArray(plan.errors) && plan.errors.length > 0) {
    return {
      exit_code: 1,
      runtime_untrack: buildRuntimeUntrackSummary(plan.untrackDiagnostic),
    };
  }

  let untrackApplyResult = null;
  if (plan.destructiveResetPlan) {
    const destructiveBackup = createRuntimeRollbackBackup({
      projectRoot: normalizedRoot,
      plans: [plan.destructiveResetPlan, plan.preSyncPlan, plan.writePlan],
    });
    try {
      applyOperationPlan(normalizedRoot, plan.destructiveResetPlan);
      applyOperationPlan(normalizedRoot, plan.preSyncPlan);
      untrackApplyResult = applyOperationPlan(normalizedRoot, plan.writePlan);
      removeRuntimeRollbackBackup(destructiveBackup);
    } catch (error) {
      restoreRuntimeRollbackBackup(normalizedRoot, destructiveBackup);
      removeRuntimeRollbackBackup(destructiveBackup);
      throw error;
    }
  } else {
    applyOperationPlan(normalizedRoot, plan.preSyncPlan);
    untrackApplyResult = applyOperationPlan(normalizedRoot, plan.writePlan);
  }

  return {
    exit_code: 0,
    runtime_untrack: buildRuntimeUntrackSummary(plan.untrackDiagnostic, untrackApplyResult),
  };
}

function printInitApplySuccess(plan, result, options = {}) {
  const adapter = getAdapter(plan.platform);
  if (plan.platform === 'claude') {
    console.log('🪝 Installed Claude SessionStart matcher in .claude/settings.json');
  }
  const synced = plan.syncedAssets || {
    commands: [],
    skills: [],
    workflowSkills: [],
    internalSkills: [],
    agents: [],
    agentSupportFiles: [],
  };
  const written = synced.commands.map((command) => command.filename);
  const skillNames = adapter.workflowsRoot === adapter.skillsRoot
    ? mergeStringArrays(synced.skills, synced.workflowSkills, synced.internalSkills)
    : mergeStringArrays(synced.skills, synced.internalSkills);
  const agentPaths = synced.agents;
  const agentSupportFiles = synced.agentSupportFiles || [];

  if (adapter.hasCommands) {
    console.log(`📦 Generated ${written.length} command file(s) in ${path.relative(plan.projectRoot, plan.commandDir)}`);
  }
  console.log(`🧩 Generated ${skillNames.length} skill directory(ies) in ${adapter.skillsRoot}`);
  console.log(`🤖 Generated ${agentPaths.length} agent file(s) in ${adapter.agentsRoot}`);
  if (agentSupportFiles.length > 0) {
    console.log(`🧰 Generated ${agentSupportFiles.length} agent support file(s) in ${adapter.agentsRoot}`);
  }
  const gitignoreOperation = plan.writePlan.operations.find((operation) => operation.reason === 'managed_gitignore_policy');
  if (gitignoreOperation) {
    const action = gitignoreOperation.gitignoreStatus === 'added' ? 'Added' : 'Updated';
    console.log(`🧹 ${action} .gitignore spec-first managed block`);
  }
  const runtimeUntrack = result.runtime_untrack;
  printRuntimeUntrackApplySummary(runtimeUntrack);
  console.log('🪪 Wrote project developer profile:');
  console.log(`  📍 path: ${adapter.developerFile}`);
  console.log(`  👤 name: ${plan.developer.name}`);
  console.log(`  🈯 lang: ${plan.developer.lang}`);
  console.log(`  ⏱ initialized_at: ${plan.developer.initializedAt}`);
  console.log(`  🔖 version: ${plan.developer.version}`);
  if (plan.changelogCreated && !options.suppressChangelogCreated) {
    console.log('📝 Bootstrapped CHANGELOG.md');
  }

  if (options.showNextSteps !== false) {
    console.log('');
    printInitNextSteps(plan.platform, plan.developer.lang);
  }
}

function runInitForWorkspace({
  parsed,
  platform,
  adapter,
  workspaceRoot,
  candidates,
  selectionSource,
}) {
  const results = [];
  console.log(`Workspace init: spec-first init (${platform})`);
  console.log(`  workspace_root: ${workspaceRoot}`);
  console.log(`  selection_source: ${selectionSource}`);
  console.log(`  child_repos: ${candidates.length}`);

  console.log('');
  console.log('▶ Refresh parent host runtime assets');
  let parentRuntime = {
    exit_code: 0,
    overall_status: 'ready',
    reason_code: null,
    diagnostic: '',
    runtime_untrack: buildRuntimeUntrackSummary(),
  };
  try {
    const projectResult = normalizeProjectInitResult(runInitForProject({
      parsed,
      platform,
      adapter,
      projectRoot: workspaceRoot,
      gitRootTopology: 'multi-repo-workspace',
    }));
    parentRuntime = {
      exit_code: projectResult.exit_code,
      overall_status: projectResult.exit_code === 0 ? 'ready' : 'action-required',
      reason_code: projectResult.exit_code === 0 ? null : 'parent-runtime-init-failed',
      diagnostic: '',
      runtime_untrack: projectResult.runtime_untrack,
    };
  } catch (error) {
    parentRuntime = {
      exit_code: 1,
      overall_status: 'action-required',
      reason_code: 'parent-runtime-init-exception',
      diagnostic: error instanceof Error ? error.message : String(error),
      runtime_untrack: buildRuntimeUntrackSummary(),
    };
    console.error(`Parent runtime init failed: ${parentRuntime.diagnostic}`);
  }

  candidates.forEach((candidate, index) => {
    console.log('');
    console.log(`▶ Init child ${index + 1}/${candidates.length}: ${candidate.workspace_relative_path}`);
    let exitCode = 0;
    let reasonCode = null;
    let diagnostic = '';
    try {
      const projectResult = normalizeProjectInitResult(runInitForProject({
        parsed,
        platform,
        adapter,
        projectRoot: candidate.git_root,
      }));
      exitCode = projectResult.exit_code;
      if (exitCode !== 0) {
        reasonCode = 'init-failed';
      }
      results.push({
        repo_label: candidate.repo_label,
        workspace_relative_path: candidate.workspace_relative_path,
        git_root: candidate.git_root,
        exit_code: exitCode,
        overall_status: exitCode === 0 ? 'ready' : 'action-required',
        reason_code: reasonCode,
        diagnostic,
        runtime_untrack: projectResult.runtime_untrack,
      });
      return;
    } catch (error) {
      exitCode = 1;
      reasonCode = 'init-exception';
      diagnostic = error instanceof Error ? error.message : String(error);
      console.error(`Child init failed for ${candidate.workspace_relative_path}: ${diagnostic}`);
    }
    results.push({
      repo_label: candidate.repo_label,
      workspace_relative_path: candidate.workspace_relative_path,
      git_root: candidate.git_root,
      exit_code: exitCode,
      overall_status: exitCode === 0 ? 'ready' : 'action-required',
      reason_code: reasonCode,
      diagnostic,
      runtime_untrack: buildRuntimeUntrackSummary(),
    });
  });

  const readyCount = results.filter((result) => result.overall_status === 'ready').length;
  const childActionRequiredCount = results.length - readyCount;
  const parentActionRequiredCount = parentRuntime.overall_status === 'ready' ? 0 : 1;
  const actionRequiredCount = childActionRequiredCount + parentActionRequiredCount;
  const overallStatus = actionRequiredCount === 0
    ? 'ready'
    : readyCount > 0
      ? 'partial'
      : 'action-required';
  const summary = {
    schema_version: 'workspace-init-summary.v1',
    generated_at: new Date().toISOString(),
    advisory: true,
    workflow_mode: 'all-repos',
    selection_source: selectionSource,
    workspace_root: workspaceRoot,
    parent_writes_repo_local_artifacts: false,
    parent_writes_host_runtime_assets: true,
    parent_host_runtime: parentRuntime,
    dry_run: parsed.dryRun,
    platform,
    results,
    counts: {
      total: results.length,
      ready: readyCount,
      action_required: childActionRequiredCount,
      parent_runtime_ready: parentRuntime.overall_status === 'ready' ? 1 : 0,
      parent_runtime_action_required: parentActionRequiredCount,
      runtime_untrack_total: results.reduce((total, result) => (
        total + (result.runtime_untrack && Number.isFinite(result.runtime_untrack.count)
          ? result.runtime_untrack.count
          : 0)
      ), 0),
    },
    overall_status: overallStatus,
    reason_code: actionRequiredCount === 0 ? null : 'all-repos-partial-or-action-required',
    next_action: actionRequiredCount === 0
      ? 'Parent host runtime and all child repos completed init.'
      : 'Inspect per-child reason_code and rerun init for action-required repos.',
  };

  console.log('');
  console.log(`Workspace init summary: ${overallStatus} (${readyCount}/${results.length} ready)`);
  if (parsed.dryRun) {
    console.log('Dry run: no parent advisory summary was written.');
  } else {
    const summaryPath = path.join(workspaceRoot, '.spec-first', 'workspace', 'init-summary.json');
    const summaryPathGuard = validateContainedWorkspaceWritePath(workspaceRoot, summaryPath);
    if (!summaryPathGuard.ok) {
      console.error(`Error: workspace init summary path is unsafe (${summaryPathGuard.reason_code}).`);
      return 1;
    }
    writeJsonFileAtomic(summaryPath, summary);
    console.log(`🧭 Wrote parent advisory summary: ${path.relative(workspaceRoot, summaryPath)}`);
  }

  return actionRequiredCount === 0 ? 0 : 1;
}

function buildWorkspaceInitPlan({
  platform,
  adapter,
  workspaceRoot,
  candidates,
  selectionSource = 'programmatic-all-repos',
  name = '',
  user = '',
  lang = '',
  dryRun = false,
}) {
  const normalizedWorkspaceRoot = canonicalizeExistingPath(workspaceRoot);
  const parentPlan = buildProjectInitPlan({
    projectRoot: normalizedWorkspaceRoot,
    platform,
    adapter,
    name,
    user,
    lang,
    dryRun,
    gitRootTopology: 'multi-repo-workspace',
  });
  const childPlans = candidates.map((candidate) => ({
    candidate,
    plan: buildProjectInitPlan({
      projectRoot: candidate.git_root,
      platform,
      adapter,
      name,
      user,
      lang,
      dryRun,
      gitRootTopology: 'single-repo',
    }),
  }));

  return {
    schema_version: 'spec-first-init-plan.v1',
    mode: 'all-repos',
    workspaceRoot: normalizedWorkspaceRoot,
    platform,
    adapterId: adapter.id,
    dryRun: Boolean(dryRun),
    selectionSource,
    candidates,
    parentPlan,
    childPlans,
    errors: [
      ...(parentPlan.errors || []),
      ...childPlans.flatMap((entry) => entry.plan.errors || []),
    ],
    diagnostics: [
      ...(parentPlan.diagnostics || []),
      ...childPlans.flatMap((entry) => entry.plan.diagnostics || []),
    ],
    summary: {
      parent: parentPlan.summary || {},
      children: childPlans.map((entry) => ({
        repo_label: entry.candidate.repo_label,
        summary: entry.plan.summary || {},
      })),
    },
  };
}

function applyWorkspaceInitPlan(workspaceRoot, plan) {
  const normalizedWorkspaceRoot = canonicalizeExistingPath(workspaceRoot || plan.workspaceRoot);
  let parentRuntime = {
    exit_code: 0,
    overall_status: 'ready',
    reason_code: null,
    diagnostic: '',
    runtime_untrack: buildRuntimeUntrackSummary(),
  };

  try {
    const parentResult = normalizeProjectInitResult(applyProjectInitPlan(
      plan.parentPlan.projectRoot,
      plan.parentPlan,
    ));
    parentRuntime = {
      exit_code: parentResult.exit_code,
      overall_status: parentResult.exit_code === 0 ? 'ready' : 'action-required',
      reason_code: parentResult.exit_code === 0 ? null : 'parent-runtime-init-failed',
      diagnostic: collectPlanErrorMessages(plan.parentPlan),
      runtime_untrack: parentResult.runtime_untrack,
    };
  } catch (error) {
    parentRuntime = {
      exit_code: 1,
      overall_status: 'action-required',
      reason_code: 'parent-runtime-init-exception',
      diagnostic: error instanceof Error ? error.message : String(error),
      runtime_untrack: buildRuntimeUntrackSummary(),
    };
  }

  const results = [];
  for (const entry of plan.childPlans) {
    const { candidate } = entry;
    try {
      const projectResult = normalizeProjectInitResult(applyProjectInitPlan(
        entry.plan.projectRoot,
        entry.plan,
      ));
      results.push({
        repo_label: candidate.repo_label,
        workspace_relative_path: candidate.workspace_relative_path,
        git_root: candidate.git_root,
        exit_code: projectResult.exit_code,
        overall_status: projectResult.exit_code === 0 ? 'ready' : 'action-required',
        reason_code: projectResult.exit_code === 0 ? null : 'init-failed',
        diagnostic: collectPlanErrorMessages(entry.plan),
        runtime_untrack: projectResult.runtime_untrack,
      });
    } catch (error) {
      results.push({
        repo_label: candidate.repo_label,
        workspace_relative_path: candidate.workspace_relative_path,
        git_root: candidate.git_root,
        exit_code: 1,
        overall_status: 'action-required',
        reason_code: 'init-exception',
        diagnostic: error instanceof Error ? error.message : String(error),
        runtime_untrack: buildRuntimeUntrackSummary(),
      });
    }
  }

  const summary = buildWorkspaceInitSummary({
    workspaceRoot: normalizedWorkspaceRoot,
    plan,
    parentRuntime,
    results,
  });

  if (!plan.dryRun) {
    const summaryPath = path.join(normalizedWorkspaceRoot, '.spec-first', 'workspace', 'init-summary.json');
    const summaryPathGuard = validateContainedWorkspaceWritePath(normalizedWorkspaceRoot, summaryPath);
    if (!summaryPathGuard.ok) {
      return {
        exit_code: 1,
        workspace_summary: summary,
        runtime_untrack: buildRuntimeUntrackSummary(),
        error: `workspace init summary path is unsafe (${summaryPathGuard.reason_code})`,
      };
    }
    writeJsonFileAtomic(summaryPath, summary);
  }

  const actionRequiredCount = summary.counts.action_required + summary.counts.parent_runtime_action_required;
  return {
    exit_code: actionRequiredCount === 0 ? 0 : 1,
    workspace_summary: summary,
    runtime_untrack: parentRuntime.runtime_untrack,
  };
}

function buildWorkspaceInitSummary({
  workspaceRoot,
  plan,
  parentRuntime,
  results,
}) {
  const readyCount = results.filter((result) => result.overall_status === 'ready').length;
  const childActionRequiredCount = results.length - readyCount;
  const parentActionRequiredCount = parentRuntime.overall_status === 'ready' ? 0 : 1;
  const actionRequiredCount = childActionRequiredCount + parentActionRequiredCount;
  const overallStatus = actionRequiredCount === 0
    ? 'ready'
    : readyCount > 0
      ? 'partial'
      : 'action-required';

  return {
    schema_version: 'workspace-init-summary.v1',
    generated_at: new Date().toISOString(),
    advisory: true,
    workflow_mode: 'all-repos',
    selection_source: plan.selectionSource,
    workspace_root: workspaceRoot,
    parent_writes_repo_local_artifacts: false,
    parent_writes_host_runtime_assets: true,
    parent_host_runtime: parentRuntime,
    dry_run: Boolean(plan.dryRun),
    platform: plan.platform,
    results,
    counts: {
      total: results.length,
      ready: readyCount,
      action_required: childActionRequiredCount,
      parent_runtime_ready: parentRuntime.overall_status === 'ready' ? 1 : 0,
      parent_runtime_action_required: parentActionRequiredCount,
      runtime_untrack_total: results.reduce((total, result) => (
        total + (result.runtime_untrack && Number.isFinite(result.runtime_untrack.count)
          ? result.runtime_untrack.count
          : 0)
      ), 0),
    },
    overall_status: overallStatus,
    reason_code: actionRequiredCount === 0 ? null : 'all-repos-partial-or-action-required',
    next_action: actionRequiredCount === 0
      ? 'Parent host runtime and all child repos completed init.'
      : 'Inspect per-child reason_code and rerun init for action-required repos.',
  };
}

function buildErroredProjectInitPlan({
  projectRoot,
  platform,
  adapter,
  dryRun = false,
  gitRootTopology = 'single-repo',
  errors = [],
  diagnostics = [],
}) {
  const emptyPlan = mergeOperationPlans();
  return {
    schema_version: 'spec-first-init-plan.v1',
    mode: 'single-repo',
    projectRoot,
    platform,
    gitRootTopology,
    dryRun: Boolean(dryRun),
    adapterId: adapter.id,
    commandDir: adapter.hasCommands ? path.join(projectRoot, adapter.commandRoot) : '',
    developer: null,
    previousState: null,
    previewState: null,
    destructiveResetPlan: null,
    destructiveResetReason: '',
    legacyStateDetected: false,
    preSyncPlan: emptyPlan,
    writePlan: emptyPlan,
    operationPlan: emptyPlan,
    untrackDiagnostic: buildRuntimeUntrackSummary(),
    syncedAssets: {
      commands: [],
      skills: [],
      workflowSkills: [],
      internalSkills: [],
      agents: [],
      agentSupportFiles: [],
    },
    changelogCreated: false,
    diagnostics,
    errors,
    summary: emptyPlan.summary,
  };
}

function normalizeInitPlatform(platform) {
  if (platform === 'claude' || platform === 'codex') {
    return platform;
  }
  throw new Error(`Unknown init platform: ${platform || ''}`);
}

function initPlatformLabel(platform) {
  const choice = INIT_PLATFORM_CHOICES.find((entry) => entry.id === platform);
  return choice ? choice.label : platform;
}

function printInitDiagnostics(plan) {
  const diagnostics = collectInitDiagnostics(plan);
  for (const diagnostic of diagnostics) {
    const message = diagnostic && diagnostic.message ? diagnostic.message : String(diagnostic);
    if (diagnostic.level === 'warn') {
      console.warn(message);
    } else {
      console.log(message);
    }
  }
}

function collectInitDiagnostics(plan) {
  if (!plan || typeof plan !== 'object') {
    return [];
  }
  if (plan.mode === 'all-repos') {
    return [
      ...(plan.parentPlan ? collectInitDiagnostics(plan.parentPlan) : []),
      ...(Array.isArray(plan.childPlans)
        ? plan.childPlans.flatMap((entry) => collectInitDiagnostics(entry.plan))
        : []),
    ];
  }
  return Array.isArray(plan.diagnostics) ? plan.diagnostics : [];
}

function collectInitErrors(plan) {
  if (!plan || typeof plan !== 'object') {
    return [];
  }
  if (plan.mode === 'all-repos') {
    return [
      ...(plan.parentPlan ? collectInitErrors(plan.parentPlan) : []),
      ...(Array.isArray(plan.childPlans)
        ? plan.childPlans.flatMap((entry) => collectInitErrors(entry.plan))
        : []),
    ];
  }
  return Array.isArray(plan.errors) ? plan.errors : [];
}

function collectPlanErrorMessages(plan) {
  return (Array.isArray(plan.errors) ? plan.errors : [])
    .map((error) => error.message || String(error))
    .filter(Boolean)
    .join('\n');
}

function printInitNextSteps(platform, lang = 'zh') {
  const hostDisplay = platform === 'claude' ? 'Claude Code' : 'Codex';
  const entryKind = platform === 'claude' ? '/spec:* commands' : '$spec-* skills';
  const mcpSetupCommand = platform === 'claude' ? '/spec:mcp-setup' : '$spec-mcp-setup';
  const graphBootstrapCommand = platform === 'claude' ? '/spec:graph-bootstrap' : '$spec-graph-bootstrap';

  if (lang === 'en') {
    console.log('Next steps:');
    console.log(`  1. Restart ${hostDisplay} or open a new session so the host loads the generated ${entryKind}.`);
    console.log(`  2. For lightweight docs, small fixes, first trials, or lightweight plan/work/review, start the matching ${entryKind} in the new session.`);
    console.log(`  3. For enhanced readiness, run ${mcpSetupCommand} to install and verify the required MCP/helper runtime.`);
    console.log(`  4. If ${mcpSetupCommand} shows graph bootstrap is still pending, run ${graphBootstrapCommand} when prompted.`);
    console.log('  5. After graph readiness is ready, choose the next workflow by user intent: brainstorm/plan/work/review/debug. Project guidance comes from AGENTS.md, CLAUDE.md, docs/contracts, direct source evidence, tests, and graph facts.');
    return;
  }

  console.log('下一步:');
  console.log(`  1. 重启 ${hostDisplay} 或新开会话，让宿主加载刚生成的 ${entryKind}。`);
  console.log(`  2. 对 docs、小修复、首次试用或轻量 plan/work/review，可直接在新会话启动匹配的 ${entryKind}。`);
  console.log(`  3. 需要增强 readiness 时，运行 ${mcpSetupCommand} 安装并验证必装 MCP/helper runtime。`);
  console.log(`  4. 如果 ${mcpSetupCommand} 显示 graph bootstrap 仍 pending，再按提示运行 ${graphBootstrapCommand}。`);
  console.log('  5. graph readiness 就绪后，按用户意图进入 brainstorm/plan/work/review/debug 等 workflow；项目指导来自 AGENTS.md、CLAUDE.md、docs/contracts、直接源码证据、测试和 graph facts。');
}

function printInitNextStepsForPlatforms(platforms, lang = 'zh') {
  const uniquePlatforms = [...new Set(platforms)];
  if (uniquePlatforms.length === 1) {
    printInitNextSteps(uniquePlatforms[0], lang);
    return;
  }

  if (lang === 'en') {
    console.log('Next steps:');
    console.log('  1. Restart Claude Code and Codex or open new sessions so each host loads the generated entrypoints.');
    console.log('  2. For lightweight docs, small fixes, first trials, or lightweight plan/work/review, start the matching /spec:* command or $spec-* skill in that host.');
    console.log('  3. For enhanced readiness, run /spec:mcp-setup or $spec-mcp-setup in the host you plan to use.');
    console.log('  4. If setup shows graph bootstrap is still pending, run /spec:graph-bootstrap or $spec-graph-bootstrap when prompted.');
    console.log('  5. After graph readiness is ready, choose the next workflow by user intent: brainstorm/plan/work/review/debug.');
    return;
  }

  console.log('下一步:');
  console.log('  1. 重启 Claude Code 和 Codex 或分别新开会话，让宿主加载刚生成的入口。');
  console.log('  2. 对 docs、小修复、首次试用或轻量 plan/work/review，可在对应宿主启动 /spec:* command 或 $spec-* skill。');
  console.log('  3. 需要增强 readiness 时，在计划使用的宿主里运行 /spec:mcp-setup 或 $spec-mcp-setup。');
  console.log('  4. 如果 setup 显示 graph bootstrap 仍 pending，再按提示运行 /spec:graph-bootstrap 或 $spec-graph-bootstrap。');
  console.log('  5. graph readiness 就绪后，按用户意图进入 brainstorm/plan/work/review/debug 等 workflow。');
}

function printHelp() {
  console.log([
    '🚀 spec-first init',
    '',
    '📘 Usage:',
    '  spec-first init [--claude] [--codex] [-y] [-u <name>] [--lang <zh|en>]',
    '',
    'Host selection:',
    '  spec-first init                         Select one or more host runtimes interactively',
    '  spec-first init --codex                 Initialize only Codex after the remaining prompts',
    '  spec-first init --claude --codex        Initialize both selected hosts',
    '  spec-first init -y                      Skip prompts and initialize default hosts',
    '  spec-first init --codex -y -u <name> --lang zh',
    '',
    'Interactive steps:',
    '  1. Select Claude Code and/or Codex',
    '  2. Confirm developer name',
    '  3. Choose response language',
    '  4. Choose workspace target when child Git repos are detected',
    '  5. Preview write/reset operations',
    '  6. Confirm or cancel',
    '',
    'Workspace targeting:',
    '  In a parent workspace with child Git repos, init asks whether to initialize all child repos or one selected child.',
    '  Parent workspace runs write only parent advisory summary assets; child repo truth stays in each child repo.',
    '',
    'Non-interactive usage:',
    '  Use -y/--yes to skip prompts. Without -y, init requires an interactive terminal and exits 2 in CI/non-TTY environments.',
    '  Explicit --claude/--codex flags override the default host set.',
    '  CI callers that need dry-run evidence or custom target selection should use require("spec-first/src/cli/init-plan").',
    '',
    '➡️ After successful init:',
    '  Claude: restart Claude Code. For lightweight work, start the matching /spec:* workflow; for enhanced readiness, run /spec:mcp-setup, then /spec:graph-bootstrap if prompted, then route by user intent.',
    '  Codex: restart Codex. For lightweight work, start the matching $spec-* workflow; for enhanced readiness, run $spec-mcp-setup, then $spec-graph-bootstrap if prompted, then route by user intent.',
    '',
    '🔗 Repository:',
    '  https://github.com/sunrain520/spec-first',
  ].join('\n'));
}

function discoverChildGitRepos(workspaceRoot, maxDepth = 3) {
  const candidates = [];
  const queue = [{ dir: workspaceRoot, depth: 0 }];
  const skipNames = new Set([
    '.agents',
    '.cache',
    '.claude',
    '.codex',
    '.direnv',
    '.git',
    '.gitnexus',
    '.spec-first',
    '.venv',
    '.worktrees',
    'coverage',
    'dist',
    'node_modules',
    'temp',
    'tmp',
    'vendor',
  ]);

  while (queue.length > 0) {
    const current = queue.shift();
    let entries = [];
    try {
      entries = fs.readdirSync(current.dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .sort((left, right) => left.name.localeCompare(right.name));
    } catch (_error) {
      continue;
    }

    for (const entry of entries) {
      if (skipNames.has(entry.name)) continue;
      const childPath = path.join(current.dir, entry.name);
      if (hasGitMarker(childPath)) {
        addChildRepoCandidate(candidates, childPath, workspaceRoot);
        continue;
      }
      if (current.depth < maxDepth) {
        queue.push({ dir: childPath, depth: current.depth + 1 });
      }
    }
  }

  return candidates.sort((left, right) =>
    left.workspace_relative_path.localeCompare(right.workspace_relative_path)
  );
}

function addChildRepoCandidate(candidates, candidateRoot, workspaceRoot) {
  const gitRoot = canonicalizeExistingPath(candidateRoot);
  if (!isPathWithin(gitRoot, workspaceRoot)) return;
  if (candidates.some((candidate) => (
    gitRoot === candidate.git_root || isPathWithin(gitRoot, candidate.git_root)
  ))) {
    return;
  }

  const workspaceRelativePath = toWorkspaceRelativePath(gitRoot, workspaceRoot);
  candidates.push({
    repo_label: workspaceRelativePath,
    git_root: gitRoot,
    workspace_relative_path: workspaceRelativePath,
    relationship: 'child_git_repo',
  });
}

function findGitRoot(startPath) {
  let current = canonicalizeExistingPath(startPath);
  try {
    const stat = fs.statSync(current);
    if (!stat.isDirectory()) {
      current = path.dirname(current);
    }
  } catch (_error) {
    return '';
  }

  while (true) {
    if (hasGitMarker(current)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return '';
    }
    current = parent;
  }
}

function hasGitMarker(dirPath) {
  return fs.existsSync(path.join(dirPath, '.git'));
}

function canonicalizeExistingPath(targetPath) {
  const resolved = path.resolve(targetPath);
  try {
    return fs.realpathSync.native(resolved);
  } catch (_error) {
    return resolved;
  }
}

function isPathWithin(childPath, parentPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function toWorkspaceRelativePath(childPath, workspaceRoot) {
  const relative = path.relative(workspaceRoot, childPath);
  return relative === '' ? '.' : relative.split(path.sep).join('/');
}

function writeJsonFileAtomic(filePath, payload) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function validateContainedWorkspaceWritePath(workspaceRoot, filePath) {
  const rootReal = fs.realpathSync.native(path.resolve(workspaceRoot));
  const nearest = nearestExistingPath(filePath);
  const nearestReal = fs.realpathSync.native(nearest);
  if (!isPathWithin(nearestReal, rootReal)) {
    return {
      ok: false,
      reason_code: 'workspace-summary-symlink-escape',
    };
  }
  return { ok: true, reason_code: null };
}

function nearestExistingPath(targetPath) {
  let current = path.resolve(targetPath);
  while (true) {
    if (fs.existsSync(current)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return current;
    }
    current = parent;
  }
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
  gitRootTopology = 'single-repo',
}) {
  const untrackPlan = buildInitUntrackPlan(projectRoot);
  const plan = mergeOperationPlans(
    assetPlan,
    runtimePlan || buildInitRuntimePreviewPlan(projectRoot, adapter),
    buildInitGitignorePlan(projectRoot),
    buildInitMetadataPlan({ projectRoot, adapter, developer, nextState, platform, gitRootTopology }),
    untrackPlan.plan,
  );
  return {
    plan,
    untrackDiagnostic: untrackPlan.diagnostic,
  };
}

function buildInitRuntimePreviewPlan(projectRoot, adapter) {
  return adapter.planRuntimeFilesSync(projectRoot);
}

function buildInitGitignorePlan(projectRoot) {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  const existingGitignore = fs.existsSync(gitignorePath)
    ? fs.readFileSync(gitignorePath, 'utf8')
    : '';
  const gitignoreResult = applySpecFirstGitignoreBlock(existingGitignore);

  if (gitignoreResult.status === 'already-current') {
    return {
      operations: [],
      summary: summarizeOperationPlan([]),
    };
  }

  const operation = buildFileWriteOperation(
    projectRoot,
    gitignorePath,
    gitignoreResult.content,
    'managed_gitignore_policy',
  );
  operation.gitignoreStatus = gitignoreResult.status;

  return {
    operations: [operation],
    summary: summarizeOperationPlan([operation]),
  };
}

function buildInitUntrackPlan(projectRoot) {
  const diagnostic = planRuntimeUntrack({ projectRoot });
  const plan = {
    operations: diagnostic.operations,
    summary: summarizeOperationPlan(diagnostic.operations),
  };
  return {
    plan,
    diagnostic: {
      count: diagnostic.count,
      reason_code: diagnostic.reason_code,
      sample_paths: diagnostic.sample_paths,
      diagnostic: diagnostic.diagnostic,
    },
  };
}

function buildInitMetadataPlan({
  projectRoot,
  adapter,
  developer,
  nextState,
  platform,
  gitRootTopology = 'single-repo',
}) {
  const operations = [];
  const instructionPath = path.join(projectRoot, adapter.instructionFile);
  const existingInstruction = fs.existsSync(instructionPath)
    ? fs.readFileSync(instructionPath, 'utf8')
    : '';
  const instructionWithoutLegacyRuntimeTools = removeManagedRuntimeToolsBlock(existingInstruction);
  const instructionWithLang = applyManagedBlock(instructionWithoutLegacyRuntimeTools, buildManagedBlock(developer.lang));
  const instructionWithBootstrap = applyManagedBootstrapBlock(
    instructionWithLang,
    buildBootstrapBlock(adapter, developer.lang),
  );
  const finalInstruction = applyManagedCodingGuidelinesBlock(
    instructionWithBootstrap,
    buildCodingGuidelinesBlock(developer.lang),
  );
  const normalizedGitNexusInstruction = normalizeGitNexusInstructionBlock(finalInstruction, {
    createMissing: true,
    defaultRepoName: path.basename(projectRoot),
    lang: developer.lang,
    gitRootTopology,
  }).content;
  operations.push(buildPlanFileOperation(
    projectRoot,
    adapter.instructionFile,
    normalizedGitNexusInstruction,
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
      platform,
    });
    operations.push(buildPlanFileOperation(
      projectRoot,
      'CHANGELOG.md',
      buildInitialChangelog(formatChangelogTimestamp(new Date()), changelogAuthor.name || developer.name, developer.version),
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

function printInitDryRun({
  platform,
  plan,
  untrackDiagnostic,
  legacyStateDetected,
  destructiveResetReason = '',
  maxEntries = Infinity,
  showPathSamples = true,
}) {
  console.log(`Dry run: spec-first init (${platform})`);
  if (legacyStateDetected) {
    console.log('Would perform a managed hard reset before regenerating runtime assets.');
    console.log('Destructive preview: managed runtime reset/removal/prune operations are included.');
  } else if (destructiveResetReason === 'current_runtime_drift') {
    console.log('Would perform a managed hard reset before regenerating runtime assets (current runtime drift detected).');
    console.log('Destructive preview: managed runtime reset/removal/prune operations are included.');
  }

  const pruneCount = plan.summary.prune_command || 0;
  const removeCount = (plan.summary.remove_file || 0) + (plan.summary.remove_dir || 0);
  const ensureCount = plan.summary.ensure_dir || 0;
  const writeCount = (plan.summary.write_file || 0) + (plan.summary.update_file || 0);

  console.log(`Would remove ${removeCount} managed obsolete path(s).`);
  if (pruneCount > 0) {
    console.log(`Would prune ${pruneCount} unmanaged command file(s)${showPathSamples ? ':' : '.'}`);
    if (showPathSamples) {
      printOperationPathSample(plan.operations.filter((entry) => entry.kind === 'prune_command'), maxEntries);
    }
  }

  if (ensureCount > 0) {
    console.log(`Would ensure ${ensureCount} managed directorie(s)${showPathSamples ? ':' : '.'}`);
    if (showPathSamples) {
      printOperationPathSample(plan.operations.filter((entry) => entry.kind === 'ensure_dir'), maxEntries);
    }
  }

  if (writeCount > 0) {
    console.log(`Would write/update ${writeCount} managed file(s)${showPathSamples ? ':' : '.'}`);
    if (showPathSamples) {
      printOperationPathSample(
        plan.operations.filter((entry) => entry.kind === 'write_file' || entry.kind === 'update_file'),
        maxEntries,
      );
    }
  }
  printRuntimeUntrackDryRunSummary(untrackDiagnostic);
  console.log('No files were changed.');
}

function printOperationPathSample(operations, maxEntries = Infinity) {
  const limit = Number.isFinite(maxEntries) && maxEntries >= 0 ? Math.floor(maxEntries) : operations.length;
  for (const operation of operations.slice(0, limit)) {
    console.log(`  - ${operation.path}`);
  }
  const omitted = operations.length - Math.min(limit, operations.length);
  if (omitted > 0) {
    console.log(`  ... ${omitted} more path(s) omitted from preview`);
  }
}

function printRuntimeUntrackDryRunSummary(untrackDiagnostic = buildRuntimeUntrackSummary()) {
  const summary = buildRuntimeUntrackSummary(untrackDiagnostic);
  if (summary.count > 0) {
    console.log(`Would untrack ${summary.count} managed runtime path(s):`);
    for (const samplePath of summary.sample_paths) {
      console.log(`  - ${samplePath}`);
    }
    return;
  }

  if (summary.reason_code === 'none-tracked') {
    console.log('No managed runtime paths require untracking.');
    return;
  }

  console.log(`Runtime untrack check: ${summary.reason_code}`);
  if (summary.diagnostic) {
    console.log(`  ${summary.diagnostic}`);
  }
}

function printRuntimeUntrackApplySummary(summary = buildRuntimeUntrackSummary()) {
  if (summary.count > 0) {
    console.log(`🧯 Untracked ${summary.count} managed runtime path(s) from git index (work tree files preserved).`);
    return;
  }

  if (summary.reason_code === 'none-tracked') {
    console.log('🧯 No managed runtime paths require untracking.');
    return;
  }

  console.log(`🧯 Runtime untrack skipped: ${summary.reason_code}`);
}

function buildRuntimeUntrackSummary(untrackDiagnostic = {}, applyResult = null) {
  const plannedReason = untrackDiagnostic.reason_code || 'none-tracked';
  const applied = applyResult && applyResult.runtime_untrack ? applyResult.runtime_untrack : null;
  const count = applied && plannedReason === 'untracked-runtime'
    ? applied.applied_count
    : Number(untrackDiagnostic.count || 0);
  const reasonCode = applied && plannedReason === 'untracked-runtime'
    ? applied.reason_code
    : plannedReason;

  return {
    count,
    reason_code: reasonCode || 'none-tracked',
    sample_paths: Array.isArray(untrackDiagnostic.sample_paths) ? untrackDiagnostic.sample_paths : [],
    diagnostic: applied && applied.diagnostic ? applied.diagnostic : (untrackDiagnostic.diagnostic || ''),
  };
}

function buildProjectInitResult(exitCode, untrackDiagnostic = {}) {
  return {
    exit_code: exitCode,
    runtime_untrack: buildRuntimeUntrackSummary(untrackDiagnostic),
  };
}

function normalizeProjectInitResult(result) {
  if (typeof result === 'number') {
    return buildProjectInitResult(result);
  }
  if (result && typeof result === 'object') {
    return {
      exit_code: Number.isFinite(result.exit_code) ? result.exit_code : 1,
      runtime_untrack: buildRuntimeUntrackSummary(result.runtime_untrack),
    };
  }
  return buildProjectInitResult(1);
}

function getInitExitCode(result) {
  return normalizeProjectInitResult(result).exit_code;
}

module.exports = {
  applyInitPlan,
  buildInitPlan,
  buildInitWritePlan,
  printInitApplySuccess,
  printInitDryRun,
  printInitPreview,
  printWorkspaceInitApplySuccess,
  runInit,
};
