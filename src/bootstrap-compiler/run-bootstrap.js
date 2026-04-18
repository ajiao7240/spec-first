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
  writeJson(path.join(controlPlaneDir, 'context-routing.json'), artifacts.routing.context_routing);
  writeJson(path.join(controlPlaneDir, 'artifact-manifest.json'), artifacts.routing.artifact_manifest);
  writeJson(path.join(controlPlaneDir, 'freshness.json'), artifacts.machine_artifacts.freshness);
  writeJson(path.join(controlPlaneDir, 'lint-report.json'), artifacts.machine_artifacts.lint_report);
  writeJson(path.join(controlPlaneDir, 'contradictions.json'), artifacts.machine_artifacts.contradictions);
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

function writeContextArtifacts(contextDir, { contextDocs = {}, injectionIndex }) {
  const mergedDocs = { ...DEFAULT_CONTEXT_DOCS, ...contextDocs };

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
      'workspace/routing-overview.md': { depends_on: [] },
      '00-summary.md': { depends_on: [] },
    },
  });
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
    } else if (evaluation.freshness_status === 'fresh' && freshnessStatus !== 'stale') {
      sawFreshChild = true;
    }

    for (const assetPath of evaluation.selected_assets) {
      selectedAssets.push(`${child.childSlug}:${assetPath}`);
    }
    skippedRules.push(...(Array.isArray(evaluation.skipped_rules) ? evaluation.skipped_rules : []));
  }

  if (freshnessStatus !== 'stale' && sawFreshChild) {
    freshnessStatus = 'fresh';
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
  const workspaceSlug = registry.workspaceSlug;
  const controlPlaneDir = resolveWorkflowArtifactDir(normalizedWorkspaceRoot, 'bootstrap', workspaceSlug, {
    artifactAnchorRoot: normalizedWorkspaceRoot,
  });
  const contextDir = resolveContextDocsDir(normalizedWorkspaceRoot, workspaceSlug, {
    artifactAnchorRoot: normalizedWorkspaceRoot,
  });

  let batchBackup = null;

  try {
    batchBackup = createBatchBackup({
      backupRoot: fs.mkdtempSync(path.join(os.tmpdir(), `spec-first-workspace-backup-${generatedAt.replace(/[:.]/g, '-')}-`)),
      entries: [
        { key: 'workspace-context', sourceDir: contextDir },
        { key: 'workspace-control-plane', sourceDir: controlPlaneDir },
        ...registry.children.flatMap((child) => ([
          {
            key: `child-context-${child.childSlug}`,
            sourceDir: resolveContextDocsDir(child.repoRoot, child.childSlug, {
              artifactAnchorRoot: normalizedWorkspaceRoot,
            }),
          },
          {
            key: `child-control-plane-${child.childSlug}`,
            sourceDir: resolveWorkflowArtifactDir(child.repoRoot, 'bootstrap', child.childSlug, {
              artifactAnchorRoot: normalizedWorkspaceRoot,
            }),
          },
        ])),
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

    removeBatchBackup(batchBackup);

    return {
      status: 'complete',
      mode: 'workspace',
      slug: workspaceSlug,
      controlPlaneDir,
      contextDir,
      registry,
      routing,
    };
  } catch (error) {
    restoreBatchBackup(batchBackup);
    throw error;
  }
}

function repoRootsOrDiscoverRequested(options) {
  return Boolean(
    options && (
      (Array.isArray(options.repoRoots) && options.repoRoots.length > 0) ||
      process.env.SPEC_BOOTSTRAP_DISCOVER_CHILD_GIT === '1'
    )
  );
}

function runBootstrap({
  repoRoot,
  repoRoots = [],
  slug = detectSlug(repoRoot),
  generatedAt = new Date().toISOString(),
  factInventory,
  riskSignals,
  testSurface,
  actualAssets,
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

  if (!detectGitRoot(repoRoot) && repoRoot === artifactAnchorRoot && repoRootsOrDiscoverRequested({ repoRoots })) {
    return runWorkspaceBootstrap({
      workspaceRoot: repoRoot,
      repoRoots,
      generatedAt,
      discoverChildGit: process.env.SPEC_BOOTSTRAP_DISCOVER_CHILD_GIT === '1',
      hooks,
    });
  }

  try {
    backupDir = createBootstrapBackup({ contextDir, controlPlaneDir, generatedAt });

    const artifacts = compileBootstrapArtifacts({
      generatedAt,
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
