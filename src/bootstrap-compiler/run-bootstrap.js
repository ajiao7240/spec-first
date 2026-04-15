'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { resolveContextDocsDir, resolveWorkflowArtifactDir } = require('../crg/artifact-paths');
const { compileBootstrapArtifacts } = require('./orchestrator');
const {
  buildOwnershipRegistrySample,
  buildReviewQueueSample,
  serializeInjectionIndex,
} = require('./sample-generator');
const {
  createBootstrapBackup,
  removeBootstrapBackup,
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

function runBootstrap({
  repoRoot,
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
} = {}) {
  const controlPlaneDir = resolveWorkflowArtifactDir(repoRoot, 'bootstrap', slug);
  const contextDir = resolveContextDocsDir(repoRoot, slug);
  let backupDir = null;

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
