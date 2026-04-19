'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { resolveContextDocsDir, resolveWorkflowArtifactDir } = require('../crg/artifact-paths');
const { compileBootstrapArtifacts } = require('./orchestrator');
const {
  buildWorkspaceRegistry,
  buildWorkspaceRouting,
  discoverChildGitRepos,
} = require('./workspace-registry');
const { detectGitRoot } = require('../context-routing/entry-resolver');
const { evaluateContextForRepo } = require('../context-routing/evaluator');
const { recordWorkflowTelemetry } = require('../context-routing/telemetry');
const {
  buildOwnershipRegistrySample,
  buildReviewQueueSample,
  serializeInjectionIndex,
} = require('./sample-generator');
const {
  createBatchBackup,
  createBootstrapBackup,
  removeBatchBackup,
  removeBootstrapBackup,
  restoreBatchBackup,
  restoreBootstrapBackup,
} = require('./rollback');

const DEFAULT_CONTEXT_DOCS = {
  '00-summary.md': '# summary\n',
  'README.md': '# readme\n',
  'architecture/module-map.md': '# module map\n',
  'code-facts/public-entrypoints.md': '# public entrypoints\n',
  'code-facts/test-map.md': '# test map\n',
  'code-facts/high-risk-modules.md': '# high risk modules\n',
  'pitfalls/index.md': '# pitfalls\n',
  'context-packs/review-change.md': '# review change\n',
};

const DEFAULT_BOOTSTRAP_ASSETS = [
  'fact-inventory.json',
  'risk-signals.json',
  'test-surface.json',
  'database-routing.json',
  'context-routing.json',
  'artifact-manifest.json',
  'freshness.json',
  'lint-report.json',
  'contradictions.json',
  'verification-profile.json',
  'ownership.json',
  'review-queue.json',
  'minimal-context/review.json',
  'minimal-context/plan.json',
  'minimal-context/work.json',
  ...Object.keys(DEFAULT_CONTEXT_DOCS),
  'injection-index.yaml',
];

function detectSlug(repoRoot) {
  return path.basename(repoRoot);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function writeControlPlaneArtifacts(controlPlaneDir, artifacts) {
  writeJson(path.join(controlPlaneDir, 'fact-inventory.json'), artifacts.machine_artifacts.fact_inventory);
  writeJson(path.join(controlPlaneDir, 'risk-signals.json'), artifacts.machine_artifacts.risk_signals);
  writeJson(path.join(controlPlaneDir, 'test-surface.json'), artifacts.machine_artifacts.test_surface);
  writeJson(path.join(controlPlaneDir, 'database-routing.json'), artifacts.routing.database_routing);
  writeJson(path.join(controlPlaneDir, 'context-routing.json'), artifacts.routing.context_routing);
  writeJson(path.join(controlPlaneDir, 'artifact-manifest.json'), artifacts.routing.artifact_manifest);
  writeJson(path.join(controlPlaneDir, 'freshness.json'), artifacts.machine_artifacts.freshness);
  writeJson(path.join(controlPlaneDir, 'lint-report.json'), artifacts.machine_artifacts.lint_report);
  writeJson(path.join(controlPlaneDir, 'contradictions.json'), artifacts.machine_artifacts.contradictions);
  writeJson(
    path.join(controlPlaneDir, 'verification-profile.json'),
    artifacts.machine_artifacts.verification_profile
  );
  writeJson(path.join(controlPlaneDir, 'ownership.json'), buildOwnershipRegistrySample());
  writeJson(
    path.join(controlPlaneDir, 'review-queue.json'),
    buildReviewQueueSample({ generatedAt: artifacts.machine_artifacts.freshness.generated_at })
  );
  writeJson(
    path.join(controlPlaneDir, 'minimal-context', 'review.json'),
    artifacts.machine_artifacts.minimal_context.review
  );
  writeJson(
    path.join(controlPlaneDir, 'minimal-context', 'plan.json'),
    artifacts.machine_artifacts.minimal_context.plan
  );
  writeJson(
    path.join(controlPlaneDir, 'minimal-context', 'work.json'),
    artifacts.machine_artifacts.minimal_context.work
  );
}

function writeContextArtifacts(contextDir, { generatedDocs = {}, contextDocs = {}, injectionIndex }) {
  const mergedDocs = { ...DEFAULT_CONTEXT_DOCS, ...generatedDocs, ...contextDocs };

  for (const [relativePath, content] of Object.entries(mergedDocs)) {
    writeText(path.join(contextDir, relativePath), content);
  }

  writeText(
    path.join(contextDir, 'injection-index.yaml'),
    serializeInjectionIndex(injectionIndex)
  );
}

function writeWorkspaceControlPlaneArtifacts(controlPlaneDir, { registry, routing, generatedAt }) {
  writeJson(path.join(controlPlaneDir, 'workspace-registry.json'), registry);
  writeJson(path.join(controlPlaneDir, 'workspace-routing.json'), routing);
  writeJson(path.join(controlPlaneDir, 'artifact-manifest.json'), {
    schema_version: 'v1',
    generated_at: generatedAt,
    updated_at: generatedAt,
    status: 'complete',
    outputs: {
      'workspace-registry.json': { depends_on: [] },
      'workspace-routing.json': { depends_on: [] },
      'workspace-readiness-summary.json': { depends_on: [] },
      'workspace/routing-overview.md': { depends_on: [] },
      '00-summary.md': { depends_on: [] },
    },
  });
}

function buildWorkspaceReadinessSummary({
  workspaceRoot,
  registry,
  generatedAt,
  stage = 'plan',
} = {}) {
  const children = (Array.isArray(registry && registry.children) ? registry.children : []).map((child) => {
    const evaluation = evaluateContextForRepo({
      repoRoot: child.repoRoot,
      slug: child.childSlug,
      stage,
      artifactAnchorRoot: workspaceRoot,
    });
    return {
      childSlug: child.childSlug,
      topology_kind: child.topology_kind || 'single_repo',
      build_system: child.build_system || 'unknown',
      module_count: Number.isInteger(child.module_count) ? child.module_count : 0,
      data_quality: evaluation.data_quality || 'unknown',
      freshness_status: evaluation.freshness_status || 'unknown',
      fallback_reason: evaluation.fallback_reason || null,
      observed_at: generatedAt,
      source: 'bootstrap-summary',
    };
  });

  return {
    schema_version: 'v1',
    generated_at: generatedAt,
    workspaceSlug: registry.workspaceSlug,
    workspaceRoot: registry.workspaceRoot,
    children,
  };
}

function writeWorkspaceOverviewArtifacts(contextDir, { workspaceSlug, registry }) {
  writeText(path.join(contextDir, '00-summary.md'), `# ${workspaceSlug}\n`);
  writeText(path.join(contextDir, 'README.md'), `# ${workspaceSlug} workspace overview\n`);
  writeText(
    path.join(contextDir, 'workspace', 'routing-overview.md'),
    ['# routing overview', '', ...registry.children.map((child) => `- ${child.childSlug}: ${child.relativePath}`), ''].join('\n')
  );
  writeText(
    path.join(contextDir, 'workspace', 'repo-registry.md'),
    ['# repo registry', '', ...registry.children.map((child) => `- ${child.childSlug}: ${child.repoRoot}`), ''].join('\n')
  );
}

function unique(array) {
  return [...new Set(array)];
}

/**
 * 解析 workspace 内 child 的产物目录（context + control-plane）
 *
 * 所有 child 产物都锚定在 workspaceRoot 下，`child.repoRoot` 仅作占位
 * 传给 resolveContextDocsDir/resolveWorkflowArtifactDir（其实际路径由 artifactAnchorRoot 决定）。
 *
 * @param {{ childSlug: string, repoRoot?: string }} child
 * @param {string} anchorRoot  workspaceRoot 绝对路径
 * @returns {{ contextDir: string, controlPlaneDir: string }}
 */
function resolveChildArtifactDirs(child, anchorRoot) {
  const repoRoot = child.repoRoot || anchorRoot;
  return {
    contextDir: resolveContextDocsDir(repoRoot, child.childSlug, { artifactAnchorRoot: anchorRoot }),
    controlPlaneDir: resolveWorkflowArtifactDir(repoRoot, 'bootstrap', child.childSlug, { artifactAnchorRoot: anchorRoot }),
  };
}

function buildSingleRepoBootstrapTelemetryEvaluation({
  repoRoot,
  slug,
  stage = 'plan',
  artifactAnchorRoot = repoRoot,
} = {}) {
  const evaluation = evaluateContextForRepo({
    repoRoot,
    slug,
    stage,
    artifactAnchorRoot,
  });

  return {
    ...evaluation,
    mode: 'single-repo',
    workspace_slug: null,
    matched_child_slugs: [],
    selected_context_count: Array.isArray(evaluation.selected_assets) ? evaluation.selected_assets.length : 0,
  };
}

function buildWorkspaceBootstrapTelemetryEvaluation({
  workspaceRoot,
  workspaceSlug,
  registry,
  routing,
  stage = 'plan',
} = {}) {
  const workspaceOverviewAssets = Array.isArray(routing && routing.workspaceOverviewAssets)
    ? routing.workspaceOverviewAssets
    : [];
  const selectedAssets = workspaceOverviewAssets.map((assetPath) => `${workspaceSlug}:${assetPath}`);
  const matchedChildSlugs = [];
  const skippedRules = [];
  let freshnessStatus = 'unknown';
  let sawFreshChild = false;
  let hasDegradedChild = false;

  for (const child of Array.isArray(registry && registry.children) ? registry.children : []) {
    matchedChildSlugs.push(child.childSlug);
    const evaluation = evaluateContextForRepo({
      repoRoot: child.repoRoot,
      slug: child.childSlug,
      stage,
      artifactAnchorRoot: workspaceRoot,
    });

    if (evaluation.level !== 'L0') hasDegradedChild = true;
    if (evaluation.freshness_status === 'stale') {
      freshnessStatus = 'stale';
    } else if (evaluation.freshness_status === 'healthy' && freshnessStatus !== 'stale') {
      sawFreshChild = true;
    }

    for (const assetPath of evaluation.selected_assets) {
      selectedAssets.push(`${child.childSlug}:${assetPath}`);
    }
    skippedRules.push(...(Array.isArray(evaluation.skipped_rules) ? evaluation.skipped_rules : []));
  }

  if (freshnessStatus !== 'stale' && sawFreshChild) {
    freshnessStatus = 'healthy';
  }

  let fallbackReason = null;
  if (hasDegradedChild) {
    fallbackReason = 'workspace_child_partial_degraded';
  } else if (freshnessStatus === 'stale') {
    fallbackReason = 'freshness_stale';
  }

  return {
    stage,
    mode: 'workspace',
    workspace_slug: workspaceSlug,
    matched_child_slugs: matchedChildSlugs,
    selected_assets: selectedAssets,
    selected_context_count: selectedAssets.length,
    skipped_rules: unique(skippedRules),
    fallback_reason: fallbackReason,
    freshness_status: freshnessStatus,
  };
}

/**
 * 执行 workspace 级 bootstrap：为每个 child repo 跑一次 runBootstrap，
 * 发布 workspace overview 与 control plane，并清理上次 registry 中已被移除的 child 产物。
 *
 * @param {object} options
 * @param {string} options.workspaceRoot  workspace 绝对路径
 * @param {string[]} [options.repoRoots]  显式给定的 child repo 列表
 * @param {string} [options.generatedAt]  ISO 时间戳
 * @param {boolean} [options.discoverChildGit]  为 true 时自动发现 .git 子仓
 * @param {object} [options.hooks]  lifecycle hooks（beforeWorkspacePublish / afterControlPlaneWrite / afterContextWrite）
 *
 * @returns {{
 *   status: 'complete',
 *   mode: 'workspace',
 *   slug: string,
 *   controlPlaneDir: string,
 *   contextDir: string,
 *   registry: object,
 *   routing: object,
 *   prunedChildSlugs: string[],       // 成功 prune 的已移除 child slug（不含 failedPrunes 内的）
 *   failedPrunes: Array<{ childSlug: string, error: string }>,  // prune 中 rm 失败的 child（bootstrap 主产出仍成功）
 * }}
 *
 * 失败时抛出，错误捕获后调用 restoreBatchBackup 回滚所有产物。
 * 单 child prune 失败不触发整体回滚，只记入 failedPrunes 返回。
 */
function runWorkspaceBootstrap({
  workspaceRoot,
  repoRoots = [],
  generatedAt = new Date().toISOString(),
  discoverChildGit = false,
  hooks = {},
} = {}) {
  const normalizedWorkspaceRoot = path.resolve(workspaceRoot);
  const discoveredRepoRoots = repoRoots.length > 0
    ? repoRoots
    : (discoverChildGit ? discoverChildGitRepos(normalizedWorkspaceRoot) : []);
  const registry = buildWorkspaceRegistry({
    workspaceRoot: normalizedWorkspaceRoot,
    repoRoots: discoveredRepoRoots,
    generatedAt,
  });
  const routing = buildWorkspaceRouting({
    workspaceSlug: registry.workspaceSlug,
    generatedAt,
  });
  const readinessSummary = buildWorkspaceReadinessSummary({
    workspaceRoot: normalizedWorkspaceRoot,
    registry,
    generatedAt,
  });
  const workspaceSlug = registry.workspaceSlug;
  const controlPlaneDir = resolveWorkflowArtifactDir(normalizedWorkspaceRoot, 'bootstrap', workspaceSlug, {
    artifactAnchorRoot: normalizedWorkspaceRoot,
  });
  const contextDir = resolveContextDocsDir(normalizedWorkspaceRoot, workspaceSlug, {
    artifactAnchorRoot: normalizedWorkspaceRoot,
  });

  let batchBackup = null;

  // 计算被移除的 child：读取上次 workspace-registry.json，与当前 registry.children 取差集。
  // rerun 时如果旧 registry 里有但新 registry 里不再存在的 child，它们的 control-plane
  // 与 context 产物应被 prune，否则会长期残留、与当前 workspace 视图不一致。
  const previousRegistryPath = path.join(controlPlaneDir, 'workspace-registry.json');
  const currentChildSlugs = new Set(registry.children.map((child) => child.childSlug));
  let removedChildren = [];
  if (fs.existsSync(previousRegistryPath)) {
    try {
      const previous = JSON.parse(fs.readFileSync(previousRegistryPath, 'utf8'));
      if (previous && Array.isArray(previous.children)) {
        removedChildren = previous.children.filter(
          (child) => child && child.childSlug && !currentChildSlugs.has(child.childSlug)
        );
      }
    } catch (_error) {
      // 旧 registry 损坏时静默跳过 prune（不阻塞主流程）
    }
  }

  try {
    batchBackup = createBatchBackup({
      backupRoot: fs.mkdtempSync(path.join(os.tmpdir(), `spec-first-workspace-backup-${generatedAt.replace(/[:.]/g, '-')}-`)),
      entries: [
        { key: 'workspace-context', sourceDir: contextDir },
        { key: 'workspace-control-plane', sourceDir: controlPlaneDir },
        ...registry.children.flatMap((child) => {
          const dirs = resolveChildArtifactDirs(child, normalizedWorkspaceRoot);
          return [
            { key: `child-context-${child.childSlug}`, sourceDir: dirs.contextDir },
            { key: `child-control-plane-${child.childSlug}`, sourceDir: dirs.controlPlaneDir },
          ];
        }),
        // 被移除的 child 纳入 backup：rollback 时可恢复；否则只是 rm
        ...removedChildren.flatMap((child) => {
          const dirs = resolveChildArtifactDirs(child, normalizedWorkspaceRoot);
          return [
            { key: `removed-child-context-${child.childSlug}`, sourceDir: dirs.contextDir },
            { key: `removed-child-control-plane-${child.childSlug}`, sourceDir: dirs.controlPlaneDir },
          ];
        }),
      ],
    });

    for (const child of registry.children) {
      runBootstrap({
        repoRoot: child.repoRoot,
        slug: child.childSlug,
        generatedAt,
        artifactAnchorRoot: normalizedWorkspaceRoot,
        hooks,
      });
    }

    if (hooks.beforeWorkspacePublish) {
      hooks.beforeWorkspacePublish({ workspaceRoot: normalizedWorkspaceRoot, registry, routing, generatedAt });
    }

    writeWorkspaceControlPlaneArtifacts(controlPlaneDir, { registry, routing, generatedAt });
    writeJson(path.join(controlPlaneDir, 'workspace-readiness-summary.json'), readinessSummary);
    writeWorkspaceOverviewArtifacts(contextDir, { workspaceSlug, registry });

    recordWorkflowTelemetry({
      repoRoot: normalizedWorkspaceRoot,
      artifactAnchorRoot: normalizedWorkspaceRoot,
      workflow: 'bootstrap',
      slug: workspaceSlug,
      evaluation: buildWorkspaceBootstrapTelemetryEvaluation({
        workspaceRoot: normalizedWorkspaceRoot,
        workspaceSlug,
        registry,
        routing,
      }),
      generatedAt,
    });

    // Prune 被移除的 child 产物（已在 batchBackup 中备份，失败可 restoreBatchBackup 恢复）
    // 单 child rm 失败不再抛出整体 rollback：failedPrunes 收集后继续处理剩余 child，
    // 最终随返回值返还调用方。这样个别 child 路径被外部占用（Windows EBUSY、权限问题）
    // 不会拖累其他 child 的 prune 与本次 bootstrap 的成功产出。
    const failedPrunes = [];
    for (const child of removedChildren) {
      const { contextDir: removedContextDir, controlPlaneDir: removedControlPlaneDir } =
        resolveChildArtifactDirs(child, normalizedWorkspaceRoot);
      try {
        fs.rmSync(removedContextDir, { recursive: true, force: true });
        fs.rmSync(removedControlPlaneDir, { recursive: true, force: true });
      } catch (error) {
        failedPrunes.push({
          childSlug: child.childSlug,
          error: error && error.message ? error.message : String(error),
        });
      }
    }

    removeBatchBackup(batchBackup);

    return {
      status: 'complete',
      mode: 'workspace',
      slug: workspaceSlug,
      controlPlaneDir,
      contextDir,
      registry,
      routing,
      prunedChildSlugs: removedChildren
        .map((child) => child.childSlug)
        .filter((slug) => !failedPrunes.some((failure) => failure.childSlug === slug)),
      failedPrunes,
    };
  } catch (error) {
    restoreBatchBackup(batchBackup);
    throw error;
  }
}

function resolveWorkspaceRepoRoots({ repoRoot, repoRoots = [] } = {}) {
  if (Array.isArray(repoRoots) && repoRoots.length > 0) {
    return repoRoots;
  }

  const normalizedRepoRoot = path.resolve(repoRoot);
  if (detectGitRoot(normalizedRepoRoot)) {
    return [];
  }

  return discoverChildGitRepos(normalizedRepoRoot);
}

function runBootstrap({
  repoRoot,
  repoRoots = [],
  slug = detectSlug(repoRoot),
  generatedAt = new Date().toISOString(),
  factInventory,
  riskSignals,
  testSurface,
  actualAssets = DEFAULT_BOOTSTRAP_ASSETS,
  contextAssets = [...Object.keys(DEFAULT_CONTEXT_DOCS), 'injection-index.yaml'],
  contradictionAssets = [],
  contextDocs = {},
  compilers = {},
  hooks = {},
  artifactAnchorRoot = repoRoot,
} = {}) {
  const controlPlaneDir = resolveWorkflowArtifactDir(repoRoot, 'bootstrap', slug, { artifactAnchorRoot });
  const contextDir = resolveContextDocsDir(repoRoot, slug, { artifactAnchorRoot });
  let backupDir = null;

  const workspaceRepoRoots = resolveWorkspaceRepoRoots({ repoRoot, repoRoots });
  if (!detectGitRoot(repoRoot) && repoRoot === artifactAnchorRoot && workspaceRepoRoots.length > 0) {
    return runWorkspaceBootstrap({
      workspaceRoot: repoRoot,
      repoRoots: workspaceRepoRoots,
      generatedAt,
      hooks,
    });
  }

  try {
    backupDir = createBootstrapBackup({ contextDir, controlPlaneDir, generatedAt });

    const artifacts = compileBootstrapArtifacts({
      generatedAt,
      repoRoot,
      factInventory,
      riskSignals,
      testSurface,
      actualAssets,
      contextAssets,
      contradictionAssets,
      compilers,
    });

    if (artifacts.status !== 'complete') {
      throw new Error(artifacts.error ? artifacts.error.message : 'bootstrap compile failed');
    }

    writeControlPlaneArtifacts(controlPlaneDir, artifacts);
    if (hooks.afterControlPlaneWrite) {
      hooks.afterControlPlaneWrite({ controlPlaneDir, contextDir, slug, artifacts });
    }

    writeContextArtifacts(contextDir, {
      generatedDocs: artifacts.human_assets.context_docs,
      contextDocs,
      injectionIndex: artifacts.routing.injection_index,
    });
    if (hooks.afterContextWrite) {
      hooks.afterContextWrite({ controlPlaneDir, contextDir, slug, artifacts });
    }

    recordWorkflowTelemetry({
      repoRoot,
      artifactAnchorRoot,
      workflow: 'bootstrap',
      slug,
      evaluation: buildSingleRepoBootstrapTelemetryEvaluation({
        repoRoot,
        slug,
        artifactAnchorRoot,
      }),
      generatedAt,
    });

    removeBootstrapBackup(backupDir);

    return {
      status: 'complete',
      slug,
      controlPlaneDir,
      contextDir,
      artifacts,
    };
  } catch (error) {
    restoreBootstrapBackup({ backupDir, contextDir });
    throw error;
  }
}

module.exports = {
  DEFAULT_CONTEXT_DOCS,
  detectSlug,
  runBootstrap,
  writeContextArtifacts,
  writeControlPlaneArtifacts,
};
