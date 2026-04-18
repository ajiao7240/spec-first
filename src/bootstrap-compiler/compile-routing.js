'use strict';

const path = require('node:path');
const { resolveGitCommit, sha256File } = require('./derive-bootstrap-facts');

function buildContextRouting({ generatedAt = '2026-04-15T00:00:00.000Z' } = {}) {
  return {
    schema_version: 'v1',
    generated_at: generatedAt,
    always: [
      '00-summary.md',
      'README.md',
      'freshness.json',
    ],
    stages: {
      plan: [
        'architecture/module-map.md',
      ],
      work: [
        'code-facts/test-map.md',
        'context-packs/review-change.md',
        'lint-report.json',
      ],
      review: [
        'minimal-context/review.json',
        'code-facts/high-risk-modules.md',
        'pitfalls/index.md',
        'context-packs/review-change.md',
        'code-facts/test-map.md',
        'lint-report.json',
        'contradictions.json',
      ],
      unknown: [
        'README.md',
      ],
    },
    selection_rules: [
      {
        condition: 'output_exists.code_facts_public_entrypoints',
        inject: ['code-facts/public-entrypoints.md'],
      },
      {
        condition: 'output_exists.code_facts_high_risk_modules',
        inject: ['code-facts/high-risk-modules.md'],
      },
      {
        condition: 'output_exists.context_packs_review_change',
        inject: ['context-packs/review-change.md'],
      },
    ],
    advice: {
      review: '优先 machine context 与 risk signals，再回读 narrative summary。',
      work: '优先 test-map 与 review-change，定位改动风险和验证面。',
      plan: '优先 module-map 与 public-entrypoints，先建立模块边界与入口心智。',
    },
  };
}

function buildInjectionIndex() {
  return {
    always: [
      '00-summary.md',
      'README.md',
    ],
    stages: {
      plan: [
        'architecture/module-map.md',
        '00-summary.md',
      ],
      work: [
        'code-facts/test-map.md',
        'context-packs/review-change.md',
        'code-facts/high-risk-modules.md',
      ],
      review: [
        'code-facts/high-risk-modules.md',
        'pitfalls/index.md',
        'code-facts/test-map.md',
        'context-packs/review-change.md',
      ],
      unknown: [
        'README.md',
      ],
    },
    selection_rules: [
      {
        condition: 'output_exists.code_facts_public_entrypoints',
        inject: ['code-facts/public-entrypoints.md'],
      },
      {
        condition: 'output_exists.code_facts_high_risk_modules',
        inject: ['code-facts/high-risk-modules.md'],
      },
      {
        condition: 'output_exists.context_packs_review_change',
        inject: ['context-packs/review-change.md'],
      },
    ],
    advice: {
      review: '优先 code-facts 与 risk signals，再回读 narrative summary。',
      work: '优先 test-map 与 review-change，定位改动风险和验证面。',
      plan: '优先 module-map 与 public-entrypoints，先建立模块边界与入口心智。',
    },
  };
}

function buildOutputMap() {
  return {
    'fact-inventory.json': {
      plane: 'control',
      status: 'required',
      depends_on: ['filesystem-scan'],
    },
    'risk-signals.json': {
      plane: 'control',
      status: 'required',
      depends_on: ['filesystem-scan'],
    },
    'test-surface.json': {
      plane: 'control',
      status: 'required',
      depends_on: ['filesystem-scan'],
    },
    'context-routing.json': {
      depends_on: [
        'schema:fact_inventory@v1',
        'schema:risk_signals@v1',
        'schema:test_surface@v1',
      ],
    },
    'minimal-context/review.json': {
      depends_on: [
        'schema:risk_signals@v1',
        'schema:test_surface@v1',
        'schema:fact_inventory@v1',
      ],
    },
    'minimal-context/plan.json': {
      depends_on: ['schema:fact_inventory@v1'],
    },
    'minimal-context/work.json': {
      depends_on: [
        'schema:risk_signals@v1',
        'schema:test_surface@v1',
        'schema:fact_inventory@v1',
      ],
    },
    'verification-profile.json': {
      plane: 'control',
      status: 'required',
      depends_on: [
        'schema:fact_inventory@v1',
        'schema:test_surface@v1',
      ],
    },
    'freshness.json': {
      plane: 'control',
      status: 'required',
      depends_on: [
        'schema:fact_inventory@v1',
        'schema:risk_signals@v1',
        'schema:test_surface@v1',
      ],
    },
    'lint-report.json': {
      plane: 'control',
      status: 'required',
      depends_on: [
        'schema:fact_inventory@v1',
        'schema:risk_signals@v1',
        'schema:test_surface@v1',
      ],
    },
    'contradictions.json': {
      plane: 'control',
      status: 'required',
      depends_on: [
        'schema:fact_inventory@v1',
        'schema:risk_signals@v1',
        'schema:test_surface@v1',
      ],
    },
    'ownership.json': {
      plane: 'control',
      status: 'optional',
      depends_on: [
        'schema:fact_inventory@v1',
        'schema:risk_signals@v1',
      ],
    },
    'review-queue.json': {
      plane: 'control',
      status: 'optional',
      depends_on: [
        'ownership.json',
        'freshness.json',
        'contradictions.json',
      ],
    },
    '00-summary.md': {
      depends_on: ['schema:fact_inventory@v1'],
    },
    'README.md': {
      depends_on: [
        'schema:fact_inventory@v1',
        'schema:risk_signals@v1',
        'schema:test_surface@v1',
      ],
    },
    'architecture/module-map.md': {
      depends_on: [
        'schema:fact_inventory@v1',
      ],
    },
    'pitfalls/index.md': {
      depends_on: [
        'schema:risk_signals@v1',
      ],
    },
    'code-facts/public-entrypoints.md': {
      depends_on: [
        'schema:fact_inventory@v1',
      ],
    },
    'code-facts/test-map.md': {
      depends_on: [
        'schema:fact_inventory@v1',
        'schema:test_surface@v1',
      ],
    },
    'code-facts/high-risk-modules.md': {
      depends_on: ['schema:risk_signals@v1'],
    },
    'context-packs/review-change.md': {
      depends_on: [
        'schema:risk_signals@v1',
        'schema:test_surface@v1',
        'schema:fact_inventory@v1',
      ],
    },
    'injection-index.yaml': {
      depends_on: [
        'schema:fact_inventory@v1',
        'schema:risk_signals@v1',
        'schema:test_surface@v1',
      ],
    },
  };
}

function buildArtifactManifest({
  generatedAt = '2026-04-15T00:00:00.000Z',
  repoRoot,
  factInventory,
  riskSignals,
  testSurface,
} = {}) {
  const pkgPath = repoRoot ? path.join(repoRoot, 'package.json') : null;
  const packageSha = pkgPath ? sha256File(pkgPath) : null;
  const modules = Array.isArray(factInventory && factInventory.modules) ? factInventory.modules : [];
  const entrypoints = Array.isArray(factInventory && factInventory.entrypoints) ? factInventory.entrypoints : [];
  const signals = Array.isArray(riskSignals && riskSignals.signals) ? riskSignals.signals : [];
  const testFiles = Array.isArray(testSurface && testSurface.test_files) ? testSurface.test_files : [];

  const dataQuality =
    modules.length > 0 && entrypoints.length > 0 ? 'fact-backed' :
    modules.length > 0 || entrypoints.length > 0 ? 'partial'     : 'empty';

  return {
    schema_version: 'v1',
    generated_at: generatedAt,
    updated_at: generatedAt,
    status: 'complete',
    data_quality: dataQuality,
    inputs: {
      crg: {
        graph_last_built: generatedAt,
        node_count: modules.length + entrypoints.length + signals.length + testFiles.length,
        edge_count: 0,
        last_build_commit: repoRoot ? resolveGitCommit(repoRoot) : null,
      },
      files: packageSha ? { 'package.json': packageSha } : {},
      analyzer_versions: {
        fact_inventory: 'v1',
        risk_signals: 'v1',
        test_surface: 'v1',
        routing: 'v1',
      },
      schema_versions: {
        fact_inventory: 'v1',
        risk_signals: 'v1',
        test_surface: 'v1',
      },
    },
    outputs: buildOutputMap(),
  };
}

function compileRouting({
  generatedAt = '2026-04-15T00:00:00.000Z',
  repoRoot,
  factInventory,
  riskSignals,
  testSurface,
} = {}) {
  return {
    context_routing: buildContextRouting({ generatedAt }),
    artifact_manifest: buildArtifactManifest({
      generatedAt,
      repoRoot,
      factInventory,
      riskSignals,
      testSurface,
    }),
    injection_index: buildInjectionIndex(),
  };
}

module.exports = {
  buildArtifactManifest,
  buildContextRouting,
  buildInjectionIndex,
  compileRouting,
};
