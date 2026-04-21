'use strict';

const FACT_INVENTORY_SAMPLE = {
  analyzer_mode: 'full',
  graph_support_state: 'local-available',
  project_identity: {
    name: 'spec-first',
    primary_language: 'JavaScript',
    primary_frameworks: [
      'Node.js CLI',
      'Jest',
      'tree-sitter',
      'better-sqlite3',
    ],
    repo_shape: 'single-package CLI repository with bundled workflow assets and embedded CRG runtime',
  },
  topology: {
    schema_version: 'v1',
    kind: 'single_repo',
    container_kind: 'git_repo',
    selection_granularity: 'project',
    root_path: '.',
    units: [
      {
        id: 'spec-first',
        kind: 'project',
        path: '.',
        git_root: '.',
        build_system: 'npm',
        signals: ['git-root'],
      },
    ],
  },
  entrypoints: [
    { path: 'src/cli/index.js' },
    { path: 'src/crg/cli/router.js' },
    { path: 'src/crg/cli/postprocess.js' },
    { path: 'src/crg/commands/review-context.js' },
  ],
  modules: [
    { path: 'src/crg/' },
    { path: 'src/cli/' },
    { path: 'skills/' },
    { path: 'tests/' },
  ],
  integrations: [
    { symbol: 'better-sqlite3' },
    { symbol: 'tree-sitter' },
    { symbol: 'simple-git' },
  ],
  database: [
    {
      present: true,
      connection_name: 'primary',
      config_source: '.env.example',
      db_type: 'mysql',
      database_name_guess: null,
      credential_keys: ['DB_HOST', 'DB_NAME', 'DB_PASSWORD', 'DB_USER'],
      static_access_hints: ['cli'],
      confidence: 'high',
      inference_reason: 'database-config-pattern',
      evidence: [
        '.env.example:DB_HOST',
        '.env.example:DB_USER',
        'config/database.yml:adapter=mysql2',
      ],
    },
  ],
  testing_surface: [
    {
      target_path: 'docs/contracts/crg-cli-v1.schema.json',
      source_test: 'tests/contracts/crg-cli-v1.test.js',
    },
  ],
};

const RISK_SIGNALS_SAMPLE = {
  signals: [
    {
      path: 'src/crg/communities.js',
      kind: 'large-module',
      severity: 'high',
      summary: '社区检测逻辑较大且承担多阶段切分职责',
      line_count: 286,
    },
    {
      path: 'src/crg/cli/build.js',
      kind: 'large-module',
      severity: 'high',
      summary: 'build 主链聚合增量、生成与 promote/rollback 语义',
      line_count: 241,
    },
    {
      path: 'src/crg/input-convergence.js',
      kind: 'hotspot',
      severity: 'medium',
      summary: '输入收敛启发式直接影响 review-context 推荐质量',
      line_count: 168,
    },
  ],
  crg_metrics: {
    source: 'fixture',
    signal_count: 3,
  },
};

const TEST_SURFACE_SAMPLE = {
  test_files: [
    {
      path: 'tests/contracts/crg-cli-v1.test.js',
      kind: 'contract',
      target_path: 'docs/contracts/crg-cli-v1.schema.json',
    },
    {
      path: 'tests/unit/crg-router.test.js',
      kind: 'unit',
      target_path: 'src/crg/cli/router.js',
    },
    {
      path: 'tests/unit/crg-build-cli.test.js',
      kind: 'unit',
      target_path: 'src/crg/cli/build.js',
    },
    {
      path: 'tests/unit/crg-input-convergence.test.js',
      kind: 'unit',
      target_path: 'src/crg/input-convergence.js',
    },
    {
      path: 'tests/unit/crg-incremental.test.js',
      kind: 'unit',
      target_path: 'src/crg/incremental.js',
    },
  ],
  coverage_gaps: [],
};

const PLAN_MINIMAL_CONTEXT_SAMPLE = {
  provenance: 'fact-inventory',
  confidence: 'medium',
  coverage_gaps: [
    {
      field: 'test_files',
      reason: 'empty',
      impact: 'work and review context cannot suggest repository-specific tests',
    },
  ],
  schema_version: 'v1',
  generated_at: '2026-04-15T00:00:00.000Z',
  stage: 'plan',
  profile: 'plan-default',
  selected_assets: [
    'minimal-context/plan.json',
    'architecture/module-map.md',
    'code-facts/public-entrypoints.md',
    '00-summary.md',
  ],
  priority_assets: [
    'architecture/module-map.md',
    'code-facts/public-entrypoints.md',
    '00-summary.md',
  ],
  platform_focus: ['cli'],
  entrypoint_focus: [
    'src/cli/index.js',
    'src/crg/cli/router.js',
    'src/crg/cli/postprocess.js',
    'src/crg/commands/review-context.js',
  ],
  module_focus: [
    'src/crg/',
    'src/cli/',
    'skills/',
    'tests/',
  ],
  integration_focus: [
    'better-sqlite3',
    'tree-sitter',
    'simple-git',
  ],
  required_verifications: [
    'unit-tests',
    'smoke-tests',
    'integration-tests',
  ],
  fallback_reason: null,
  advice: '优先 plan card、module-map、public-entrypoints、summary 与 verification summary，先建立模块边界、入口链路和默认验证矩阵。',
};

const WORK_MINIMAL_CONTEXT_SAMPLE = {
  provenance: 'fact-inventory',
  confidence: 'high',
  coverage_gaps: [],
  schema_version: 'v1',
  generated_at: '2026-04-15T00:00:00.000Z',
  stage: 'work',
  profile: 'work-default',
  selected_assets: [
    'minimal-context/work.json',
    'code-facts/test-map.md',
    'context-packs/review-change.md',
    'code-facts/high-risk-modules.md',
  ],
  priority_assets: [
    'code-facts/test-map.md',
    'context-packs/review-change.md',
    'code-facts/high-risk-modules.md',
  ],
  platform_focus: ['cli'],
  impacted_modules: [
    'src/crg/',
    'src/cli/',
    'skills/',
    'src/crg/communities.js',
    'src/crg/cli/build.js',
  ],
  candidate_tests: [
    'tests/contracts/crg-cli-v1.test.js',
    'tests/unit/crg-router.test.js',
    'tests/unit/crg-build-cli.test.js',
    'tests/unit/crg-input-convergence.test.js',
    'tests/unit/crg-incremental.test.js',
    'docs/contracts/crg-cli-v1.schema.json',
  ],
  required_verifications: [
    'unit-tests',
    'smoke-tests',
    'integration-tests',
  ],
  optional_verifications: [
    'crg-e2e-tests',
    'release-tests',
  ],
  fallback_reason: null,
  advice: '优先 work card、test-map、review-change、high-risk-modules 与 verification summary，先收敛改动面、必跑验证和补充证据。',
};

const REVIEW_MINIMAL_CONTEXT_SAMPLE = {
  provenance: 'empty-fallback',
  confidence: 'low',
  coverage_gaps: [
    {
      field: 'modules',
      reason: 'empty',
      impact: 'stage context cannot ground module boundaries from extracted facts',
    },
    {
      field: 'entrypoints',
      reason: 'empty',
      impact: 'plan context may miss public API and CLI boundaries',
    },
  ],
  schema_version: 'v1',
  generated_at: '2026-04-15T00:00:00.000Z',
  stage: 'review',
  profile: 'review-default',
  selected_assets: [
    'minimal-context/review.json',
    'code-facts/high-risk-modules.md',
    'code-facts/test-map.md',
    'context-packs/review-change.md',
  ],
  priority_assets: [
    'code-facts/high-risk-modules.md',
    'code-facts/test-map.md',
    'context-packs/review-change.md',
  ],
  platform_focus: ['cli'],
  risk_focus: [
    'src/crg/communities.js',
    'src/crg/cli/build.js',
    'src/crg/input-convergence.js',
  ],
  candidate_tests: [
    'tests/contracts/crg-cli-v1.test.js',
    'tests/unit/crg-router.test.js',
    'tests/unit/crg-build-cli.test.js',
    'tests/unit/crg-input-convergence.test.js',
    'tests/unit/crg-incremental.test.js',
  ],
  verification_gaps_to_check: [
    'confirm unit-tests',
    'confirm smoke-tests',
    'confirm integration-tests',
  ],
  fallback_reason: null,
  advice: '优先 review card、high-risk-modules、test-map、review-change 与 verification summary，先建立风险面，再检查必需验证是否缺失。',
};

module.exports = {
  FACT_INVENTORY_SAMPLE,
  PLAN_MINIMAL_CONTEXT_SAMPLE,
  REVIEW_MINIMAL_CONTEXT_SAMPLE,
  RISK_SIGNALS_SAMPLE,
  TEST_SURFACE_SAMPLE,
  WORK_MINIMAL_CONTEXT_SAMPLE,
};
