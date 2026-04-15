'use strict';

const DEFAULT_GENERATED_AT = '2026-04-15T00:00:00.000Z';
const DEFAULT_GRAPH_LAST_BUILT = '2026-04-13T17:58:32.435Z';
const DEFAULT_LAST_BUILD_COMMIT = 'aa4b9037e1d5fe7b3447dfc64ed24e7dd1a53e4d';
const DEFAULT_PACKAGE_SHA = 'd6f65ef419fef51e66bc7144e3582b6636e136271174592761f49386195310f2';

function buildContextRoutingSample({ generatedAt = DEFAULT_GENERATED_AT } = {}) {
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

function buildArtifactManifestSample({
  generatedAt = DEFAULT_GENERATED_AT,
  updatedAt = DEFAULT_GENERATED_AT,
  graphLastBuilt = DEFAULT_GRAPH_LAST_BUILT,
  lastBuildCommit = DEFAULT_LAST_BUILD_COMMIT,
  packageSha = DEFAULT_PACKAGE_SHA,
} = {}) {
  return {
    schema_version: 'v1',
    generated_at: generatedAt,
    updated_at: updatedAt,
    status: 'complete',
    inputs: {
      crg: {
        graph_last_built: graphLastBuilt,
        node_count: 528,
        edge_count: 1307,
        last_build_commit: lastBuildCommit,
      },
      files: {
        'package.json': packageSha,
      },
      analyzer_versions: {
        crg: 'v1',
        entrypoints: 'v1',
        module_structure: 'v1',
        test_surface: 'v1',
        risk_signals: 'v1',
      },
      schema_versions: {
        fact_inventory: 'v1',
        risk_signals: 'v1',
        test_surface: 'v1',
      },
    },
    outputs: {
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
        depends_on: [
          'schema:fact_inventory@v1',
        ],
      },
      'minimal-context/work.json': {
        depends_on: [
          'schema:risk_signals@v1',
          'schema:test_surface@v1',
          'schema:fact_inventory@v1',
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
      'architecture/module-map.md': {
        depends_on: [
          'schema:fact_inventory@v1',
          'analyzer:module_structure@v1',
          'analyzer:data_shapes@v1',
        ],
      },
      'pitfalls/index.md': {
        depends_on: [
          'schema:risk_signals@v1',
          'schema:fact_inventory@v1',
        ],
      },
      'code-facts/public-entrypoints.md': {
        depends_on: [
          'schema:fact_inventory@v1',
          'analyzer:entrypoints@v1',
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
      'README.md': {
        depends_on: [
          'schema:fact_inventory@v1',
          'schema:risk_signals@v1',
          'schema:test_surface@v1',
        ],
      },
      'injection-index.yaml': {
        depends_on: [
          'schema:fact_inventory@v1',
          'schema:risk_signals@v1',
          'schema:test_surface@v1',
        ],
      },
    },
  };
}

function buildInjectionIndexSample() {
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
        'context-packs/review-change.md',
        'code-facts/test-map.md',
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

function buildOwnershipRegistrySample() {
  return {
    schema_version: 'v1',
    entries: {
      'README.md': {
        owner: 'spec-platform',
        reviewer: 'spec-review',
        last_verified: '2026-04-15',
      },
      'architecture/module-map.md': {
        owner: 'spec-graph-bootstrap',
        reviewer: 'spec-plan',
        last_verified: '2026-04-15',
      },
    },
  };
}

function buildReviewQueueSample({ generatedAt = DEFAULT_GENERATED_AT } = {}) {
  return {
    schema_version: 'v1',
    generated_at: generatedAt,
    items: [
      {
        id: 'review-queue-1',
        status: 'open',
        type: 'stale_context',
        reasons: ['graph_stale'],
      },
    ],
  };
}

function serializeInjectionIndex(sample = buildInjectionIndexSample()) {
  const lines = [];
  lines.push('always:');
  sample.always.forEach((item) => lines.push(`  - ${item}`));
  lines.push('');
  lines.push('stages:');
  for (const stage of ['plan', 'work', 'review', 'unknown']) {
    lines.push(`  ${stage}:`);
    sample.stages[stage].forEach((item) => lines.push(`    - ${item}`));
  }
  lines.push('');
  lines.push('selection_rules:');
  sample.selection_rules.forEach((rule) => {
    lines.push(`  - condition: "${rule.condition}"`);
    lines.push('    inject:');
    rule.inject.forEach((item) => lines.push(`      - ${item}`));
  });
  lines.push('');
  lines.push('advice:');
  for (const stage of ['review', 'work', 'plan']) {
    lines.push(`  ${stage}: "${sample.advice[stage]}"`);
  }
  lines.push('');
  return lines.join('\n');
}

function generateStage0Samples(options = {}) {
  return {
    contextRouting: buildContextRoutingSample(options),
    artifactManifest: buildArtifactManifestSample(options),
    injectionIndex: buildInjectionIndexSample(options),
    ownership: buildOwnershipRegistrySample(options),
    reviewQueue: buildReviewQueueSample(options),
  };
}

module.exports = {
  DEFAULT_GENERATED_AT,
  buildArtifactManifestSample,
  buildContextRoutingSample,
  buildInjectionIndexSample,
  buildOwnershipRegistrySample,
  buildReviewQueueSample,
  generateStage0Samples,
  serializeInjectionIndex,
};
