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

function runInit(argv) {
  const args = [...argv];
  const parsed = parseInitArgs(args);

  if (parsed.help) {
    printHelp();
    return 0;
  }

  const platformSelected = parsed.claude || parsed.codex;
  if (!platformSelected || parsed.unknown.length > 0) {
    console.error('Usage: spec-first init (--claude|--codex) [-u <name>] [--lang <zh|en>] [--dry-run] [--repo <child>|--all-repos]');
    return 2;
  }

  if (parsed.claude && parsed.codex) {
    console.error('Error: Cannot specify both --claude and --codex');
    return 2;
  }

  const platform = parsed.claude ? 'claude' : 'codex';
  const adapter = getAdapter(platform);
  const target = resolveInitTarget(parsed, process.cwd());
  if (!target.ok) {
    console.error(target.message);
    return 2;
  }

  if (target.mode === 'all-repos') {
    return runInitForWorkspace({
      parsed,
      platform,
      adapter,
      workspaceRoot: target.workspaceRoot,
      candidates: target.candidates,
      selectionSource: target.selectionSource,
    });
  }

  const result = runInitForProject({
    parsed,
    platform,
    adapter,
    projectRoot: target.projectRoot,
  });
  return getInitExitCode(result);
}

function runInitForProject({
  parsed,
  platform,
  adapter,
  projectRoot,
}) {
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
        plan: mergeOperationPlans(hardResetPlan, postResetPreSyncPlan, initWritePlan.plan),
        untrackDiagnostic: initWritePlan.untrackDiagnostic,
        legacyStateDetected,
      });
      return buildProjectInitResult(0, initWritePlan.untrackDiagnostic);
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
          plan: mergeOperationPlans(hardResetPlan, postResetPreSyncPlan, initWritePlan.plan),
          untrackDiagnostic: initWritePlan.untrackDiagnostic,
          destructiveResetReason: 'current_runtime_drift',
        });
        return buildProjectInitResult(0, initWritePlan.untrackDiagnostic);
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
      plan: mergeOperationPlans(preSyncPlan, initWritePlan.plan),
      untrackDiagnostic: initWritePlan.untrackDiagnostic,
      legacyStateDetected,
    });
    return buildProjectInitResult(0, initWritePlan.untrackDiagnostic);
  }

  const changelogCreated = !fs.existsSync(path.join(projectRoot, 'CHANGELOG.md'));
  let untrackApplyResult = null;
  if (destructiveResetPlan) {
    const destructiveBackup = createRuntimeRollbackBackup({
      projectRoot,
      plans: [destructiveResetPlan, preSyncPlan, initWritePlan.plan],
    });
    try {
      applyOperationPlan(projectRoot, destructiveResetPlan);
      applyOperationPlan(projectRoot, preSyncPlan);
      untrackApplyResult = applyOperationPlan(projectRoot, initWritePlan.plan);
      removeRuntimeRollbackBackup(destructiveBackup);
    } catch (error) {
      restoreRuntimeRollbackBackup(projectRoot, destructiveBackup);
      removeRuntimeRollbackBackup(destructiveBackup);
      throw error;
    }
  } else {
    applyOperationPlan(projectRoot, preSyncPlan);
    untrackApplyResult = applyOperationPlan(projectRoot, initWritePlan.plan);
  }
  if (platform === 'claude') {
    console.log('🪝 Installed Claude SessionStart matcher in .claude/settings.json');
  }
  const synced = assetSync.syncedAssets;
  const written = synced.commands.map((command) => command.filename);
  const skillNames = adapter.workflowsRoot === adapter.skillsRoot
    ? mergeStringArrays(synced.skills, synced.workflowSkills, synced.internalSkills)
    : mergeStringArrays(synced.skills, synced.internalSkills);
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
  const gitignoreOperation = initWritePlan.plan.operations.find((operation) => operation.reason === 'managed_gitignore_policy');
  if (gitignoreOperation) {
    const action = gitignoreOperation.gitignoreStatus === 'added' ? 'Added' : 'Updated';
    console.log(`🧹 ${action} .gitignore spec-first managed block`);
  }
  const runtimeUntrack = buildRuntimeUntrackSummary(initWritePlan.untrackDiagnostic, untrackApplyResult);
  printRuntimeUntrackApplySummary(runtimeUntrack);
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
  printInitNextSteps(platform, developer.lang);
  return {
    exit_code: 0,
    runtime_untrack: runtimeUntrack,
  };
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
    writeJsonFileAtomic(summaryPath, summary);
    console.log(`🧭 Wrote parent advisory summary: ${path.relative(workspaceRoot, summaryPath)}`);
  }

  return actionRequiredCount === 0 ? 0 : 1;
}

function printInitNextSteps(platform, lang = 'zh') {
  const hostDisplay = platform === 'claude' ? 'Claude Code' : 'Codex';
  const entryKind = platform === 'claude' ? '/spec:* commands' : '$spec-* skills';
  const mcpSetupCommand = platform === 'claude' ? '/spec:mcp-setup' : '$spec-mcp-setup';
  const graphBootstrapCommand = platform === 'claude' ? '/spec:graph-bootstrap' : '$spec-graph-bootstrap';
  const standardsCommand = platform === 'claude' ? '/spec:standards' : '$spec-standards';

  if (lang === 'en') {
    console.log('Next steps:');
    console.log(`  1. Restart ${hostDisplay} or open a new session so the host loads the generated ${entryKind}.`);
    console.log(`  2. For lightweight docs, small fixes, first trials, or lightweight plan/work/review, start the matching ${entryKind} in the new session.`);
    console.log(`  3. For enhanced readiness, run ${mcpSetupCommand} to install and verify the required MCP/helper runtime.`);
    console.log(`  4. If ${mcpSetupCommand} shows graph bootstrap is still pending, run ${graphBootstrapCommand} when prompted.`);
    console.log(`  5. After graph readiness is ready, run ${standardsCommand} to compile project standards and glue baseline before graph-heavy or standards-aware downstream workflows. In a parent workspace this batches child-local baselines for every discovered child repo; use ${standardsCommand} --repo <child> to narrow or ${standardsCommand} --workspace for parent advisory artifacts.`);
    return;
  }

  console.log('下一步:');
  console.log(`  1. 重启 ${hostDisplay} 或新开会话，让宿主加载刚生成的 ${entryKind}。`);
  console.log(`  2. 对 docs、小修复、首次试用或轻量 plan/work/review，可直接在新会话启动匹配的 ${entryKind}。`);
  console.log(`  3. 需要增强 readiness 时，运行 ${mcpSetupCommand} 安装并验证必装 MCP/helper runtime。`);
  console.log(`  4. 如果 ${mcpSetupCommand} 显示 graph bootstrap 仍 pending，再按提示运行 ${graphBootstrapCommand}。`);
  console.log(`  5. graph readiness 就绪后，运行 ${standardsCommand} 编译项目规范与胶水基线，再进入 graph-heavy 或 standards-aware 下游 workflow。父 workspace 下会为所有 discovered child repo 批量生成 child-local baselines；使用 ${standardsCommand} --repo <child> 收窄到单个 child，或用 ${standardsCommand} --workspace 写父级 advisory artifacts。`);
}

function printHelp() {
  console.log([
    '🚀 spec-first init',
    '',
    '📘 Usage:',
    '  spec-first init (--claude|--codex) [-u <name>] [--lang <zh|en>] [--dry-run] [--repo <child>|--all-repos]',
    '',
    'Workspace targeting:',
    '  In a parent workspace with child Git repos, init refreshes parent host runtime assets, runs all child repos, and writes only a parent advisory summary.',
    '  Use --repo <child> to initialize one child repo, or --all-repos to make the batch intent explicit.',
    '',
    '➡️ After successful init:',
    '  Claude: restart Claude Code. For lightweight work, start the matching /spec:* workflow; for enhanced readiness, run /spec:mcp-setup, then /spec:graph-bootstrap if prompted, then /spec:standards after graph readiness is ready.',
    '  Codex: restart Codex. For lightweight work, start the matching $spec-* workflow; for enhanced readiness, run $spec-mcp-setup, then $spec-graph-bootstrap if prompted, then $spec-standards after graph readiness is ready.',
    '',
    '🔗 Repository:',
    '  https://github.com/sunrain520/spec-first',
  ].join('\n'));
}

function resolveInitTarget(parsed, cwd) {
  const workspaceRoot = canonicalizeExistingPath(cwd);
  if (parsed.repo && parsed.allRepos) {
    return {
      ok: false,
      message: 'Error: Cannot combine --repo and --all-repos.',
    };
  }

  const cwdGitRoot = findGitRoot(workspaceRoot);
  if (parsed.repo) {
    return resolveExplicitRepoTarget({
      repoArg: parsed.repo,
      cwd: workspaceRoot,
      cwdGitRoot,
    });
  }

  const candidates = cwdGitRoot ? [] : discoverChildGitRepos(workspaceRoot);
  if (parsed.allRepos) {
    if (cwdGitRoot) {
      return {
        ok: false,
        message: 'Error: --all-repos must be run from a parent workspace, not inside a Git repo.',
      };
    }
    if (candidates.length === 0) {
      return {
        ok: false,
        message: 'Error: --all-repos found no child Git repos in the current workspace.',
      };
    }
    return {
      ok: true,
      mode: 'all-repos',
      workspaceRoot,
      selectionSource: 'explicit-all-repos',
      candidates,
    };
  }

  if (!cwdGitRoot && candidates.length > 0) {
    return {
      ok: true,
      mode: 'all-repos',
      workspaceRoot,
      selectionSource: 'workspace-default-all-repos',
      candidates,
    };
  }

  return {
    ok: true,
    mode: 'single-repo',
    projectRoot: workspaceRoot,
    selectionSource: cwdGitRoot ? 'cwd-git-or-monorepo' : 'cwd-directory',
  };
}

function resolveExplicitRepoTarget({
  repoArg,
  cwd,
  cwdGitRoot,
}) {
  const targetPath = path.resolve(cwd, repoArg);
  if (!fs.existsSync(targetPath)) {
    return {
      ok: false,
      message: `Error: --repo target does not exist: ${repoArg}`,
    };
  }

  const selectedRepoRoot = findGitRoot(targetPath);
  if (!selectedRepoRoot) {
    return {
      ok: false,
      message: `Error: --repo target is not inside a Git repo: ${repoArg}`,
    };
  }

  const boundaryRoot = cwdGitRoot || canonicalizeExistingPath(cwd);
  if (!isPathWithin(selectedRepoRoot, boundaryRoot)) {
    return {
      ok: false,
      message: 'Error: --repo target must be inside the current workspace.',
    };
  }

  if (cwdGitRoot && selectedRepoRoot !== cwdGitRoot) {
    return {
      ok: false,
      message: 'Error: --repo cannot select a sibling repo when init is invoked inside a Git repo. Run from the parent workspace.',
    };
  }

  return {
    ok: true,
    mode: 'single-repo',
    projectRoot: selectedRepoRoot,
    selectionSource: 'explicit-repo',
  };
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
    '.serena',
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

function parseInitArgs(argv) {
  const parsed = {
    help: false,
    claude: false,
    codex: false,
    dryRun: false,
    user: '',
    lang: '',
    repo: '',
    allRepos: false,
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

    if (arg === '--dry-run') {
      parsed.dryRun = true;
      continue;
    }

    if (arg === '--all-repos') {
      parsed.allRepos = true;
      continue;
    }

    if (arg === '--repo') {
      const next = argv[index + 1];
      if (!next || next.startsWith('-')) {
        parsed.unknown.push(arg);
        continue;
      }
      parsed.repo = next;
      index += 1;
      continue;
    }

    if (arg.startsWith('--repo=')) {
      const repoValue = arg.slice('--repo='.length);
      if (!repoValue) {
        parsed.unknown.push(arg);
        continue;
      }
      parsed.repo = repoValue;
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
  const untrackPlan = buildInitUntrackPlan(projectRoot);
  const plan = mergeOperationPlans(
    assetPlan,
    runtimePlan || buildInitRuntimePreviewPlan(projectRoot, adapter),
    buildInitGitignorePlan(projectRoot),
    buildInitMetadataPlan({ projectRoot, adapter, developer, nextState, platform }),
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

function buildInitMetadataPlan({ projectRoot, adapter, developer, nextState, platform }) {
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
    defaultRepoName: path.basename(projectRoot),
    lang: developer.lang,
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

function printInitDryRun({ platform, plan, untrackDiagnostic, legacyStateDetected, destructiveResetReason = '' }) {
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
  printRuntimeUntrackDryRunSummary(untrackDiagnostic);
  console.log('No files were changed.');
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
  buildInitWritePlan,
  runInit,
};
