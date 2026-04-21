'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ClaudeAdapter = require('../../src/cli/adapters/claude');
const CodexAdapter = require('../../src/cli/adapters/codex');

const {
  loadBootstrapSchemas,
  validateAgainstSchema,
} = require('../../src/bootstrap-compiler/schema-loader');
const {
  buildArtifactManifestSample,
  buildContextRoutingSample,
  buildDatabaseRoutingSample,
  buildOwnershipRegistrySample,
  buildReviewQueueSample,
  buildVerificationProfileSample,
  serializeInjectionIndex,
} = require('../../src/bootstrap-compiler/sample-generator');
const {
  buildPlanMinimalContext,
  buildReviewMinimalContext,
  buildWorkMinimalContext,
} = require('../../src/bootstrap-compiler/compile-minimal-context');
const {
  FACT_INVENTORY_SAMPLE,
  PLAN_MINIMAL_CONTEXT_SAMPLE,
  REVIEW_MINIMAL_CONTEXT_SAMPLE,
  RISK_SIGNALS_SAMPLE,
  TEST_SURFACE_SAMPLE,
  WORK_MINIMAL_CONTEXT_SAMPLE,
} = require('../fixtures/bootstrap/spec-first-bootstrap-sample');

const REPO_ROOT = path.join(__dirname, '..', '..');
const GITIGNORE_PATH = path.join(REPO_ROOT, '.gitignore');
const GRAPH_BOOTSTRAP_SKILL_PATH = path.join(
  REPO_ROOT,
  'skills/spec-graph-bootstrap/SKILL.md'
);
const PROMPT_MIRROR_SKILL_PATH = path.join(
  REPO_ROOT,
  'docs/10-prompt/skills/spec-graph-bootstrap/SKILL.md'
);
const GRAPH_BOOTSTRAP_SCHEMAS_PATH = path.join(
  REPO_ROOT,
  'skills/spec-graph-bootstrap/references/artifact-schemas.md'
);
const SAMPLE_INJECTION_INDEX_PATH = path.join(
  REPO_ROOT,
  'docs/contexts/spec-first/injection-index.yaml'
);
describe('spec-graph-bootstrap contracts', () => {
  test('.gitignore keeps .spec-first runtime ignored while allowing docs/contexts samples', () => {
    const gitignore = fs.readFileSync(GITIGNORE_PATH, 'utf8');

    expect(gitignore).toContain('.spec-first/');
    expect(gitignore).not.toContain('\ndocs/contexts/\n');
  });

  test('source skill points contract truth to docs/contracts/spec-graph-bootstrap', () => {
    const skill = fs.readFileSync(GRAPH_BOOTSTRAP_SKILL_PATH, 'utf8');

    expect(skill).toContain('docs/contracts/spec-graph-bootstrap/');
    expect(skill).toContain('orchestrator.js');
    expect(skill).toContain('database-routing.json');
  });

  test('source skill and prompt mirror use repo-registry.md consistently in workspace docs contract', () => {
    const sourceSkill = fs.readFileSync(GRAPH_BOOTSTRAP_SKILL_PATH, 'utf8');
    const promptMirror = fs.readFileSync(PROMPT_MIRROR_SKILL_PATH, 'utf8');

    expect(sourceSkill).toContain('workspace/repo-registry.md');
    expect(promptMirror).toContain('workspace/repo-registry.md');
    expect(sourceSkill).not.toContain('workspace/repo-registry.yaml');
    expect(promptMirror).not.toContain('workspace/repo-registry.yaml');
  });

  test('runtime transforms preserve host-specific bootstrap init guidance without contradictory inline labels', () => {
    const sourceSkill = fs.readFileSync(GRAPH_BOOTSTRAP_SKILL_PATH, 'utf8');
    const claude = new ClaudeAdapter();
    const codex = new CodexAdapter();
    const claudeRuntime = claude.transformSkillContent(sourceSkill);
    const codexRuntime = codex.transformSkillContent(sourceSkill, { skillName: 'spec-graph-bootstrap' });

    expect(claudeRuntime).toContain('spec-first init --claude   # Claude 运行时');
    expect(codexRuntime).toContain('spec-first init --codex   # Codex 运行时');
    expect(codexRuntime).not.toContain('spec-first init --codex   # Claude 运行时');
    expect((codexRuntime.match(/spec-first init --codex\s+#\s*Codex 运行时/g) || [])).toHaveLength(1);
  });

  test('source skill schema doc keeps database candidates static and routes runtime decisions into database-routing.json', () => {
    // 字段定义已移至 references/artifact-schemas.md（SKILL.md 重构为流程骨架 + references 按需加载）
    const schemas = fs.readFileSync(GRAPH_BOOTSTRAP_SCHEMAS_PATH, 'utf8');

    expect(schemas).toContain(
      'layers: { frontend: { present, confidence, inference_reason, evidence, updated_at }, ... }'
    );
    expect(schemas).toContain(
      'signals: [{ path, symbol, kind, summary, severity, confidence, inference_reason, evidence, updated_at }]'
    );
    expect(schemas).toContain(
      'top_hubs: [{ id, name, file_path, kind, in_degree, confidence, inference_reason, evidence, updated_at }]'
    );
    expect(schemas).toContain('database: [{ present, connection_name, config_source, db_type, database_name_guess, credential_keys, static_access_hints, confidence, inference_reason, evidence }]');
    expect(schemas).toContain('## database-routing.json');
    expect(schemas).toContain('route_decisions');
  });

  test('checked-in sample injection index avoids duplicate public-entrypoints injection in plan/work', () => {
    const yaml = fs.readFileSync(SAMPLE_INJECTION_INDEX_PATH, 'utf8');
    const planBlock = yaml.match(/plan:\n([\s\S]*?)\n  work:/);
    const workBlock = yaml.match(/work:\n([\s\S]*?)\n  review:/);

    expect(planBlock && planBlock[1]).not.toContain('code-facts/public-entrypoints.md');
    expect(workBlock && workBlock[1]).not.toContain('code-facts/public-entrypoints.md');
    expect(yaml).toMatch(/condition: "output_exists\.code_facts_public_entrypoints"/);
  });

  test('artifact-manifest, context-routing, and verification-profile generator outputs satisfy schemas', () => {
    const schemas = loadBootstrapSchemas();
    const artifactManifest = buildArtifactManifestSample();
    const contextRouting = buildContextRoutingSample();
    const databaseRouting = buildDatabaseRoutingSample();
    const verificationProfile = buildVerificationProfileSample();
    const factInventory = FACT_INVENTORY_SAMPLE;
    const riskSignals = RISK_SIGNALS_SAMPLE;
    const testSurface = TEST_SURFACE_SAMPLE;

    expect(validateAgainstSchema(schemas.artifactManifest, artifactManifest).errors).toEqual([]);
    expect(validateAgainstSchema(schemas.contextRouting, contextRouting).errors).toEqual([]);
    expect(validateAgainstSchema(schemas.databaseRouting, databaseRouting).errors).toEqual([]);
    expect(validateAgainstSchema(schemas.factInventory, factInventory).errors).toEqual([]);
    expect(validateAgainstSchema(schemas.riskSignals, riskSignals).errors).toEqual([]);
    expect(validateAgainstSchema(schemas.testSurface, testSurface).errors).toEqual([]);
    expect(validateAgainstSchema(schemas.verificationProfile, verificationProfile).errors).toEqual([]);
  });

  test('sample generator keeps manifest and verification-profile outputs deterministic', () => {
    const manifestA = buildArtifactManifestSample();
    const manifestB = buildArtifactManifestSample();
    const routingA = buildContextRoutingSample();
    const routingB = buildContextRoutingSample();
    const verificationA = buildVerificationProfileSample();
    const verificationB = buildVerificationProfileSample();

    expect(manifestA).toEqual(manifestB);
    expect(routingA).toEqual(routingB);
    expect(verificationA).toEqual(verificationB);
  });

  test('sample generator stays in sync with checked-in human-view injection index sample', () => {
    const expectedYaml = fs.readFileSync(SAMPLE_INJECTION_INDEX_PATH, 'utf8');

    expect(serializeInjectionIndex()).toBe(expectedYaml);
  });

  test('review minimal-context sample satisfies schema and compiler output', () => {
    const schemas = loadBootstrapSchemas();
    const verificationProfile = buildVerificationProfileSample();
    const compiledReview = buildReviewMinimalContext({
      riskSignals: RISK_SIGNALS_SAMPLE,
      testSurface: TEST_SURFACE_SAMPLE,
      verificationProfile,
    });

    expect(validateAgainstSchema(schemas.minimalContext, REVIEW_MINIMAL_CONTEXT_SAMPLE).errors).toEqual([]);
    expect(compiledReview).toEqual(REVIEW_MINIMAL_CONTEXT_SAMPLE);
  });

  test('plan/work minimal-context checked-in samples satisfy schema and compiler output', () => {
    const schemas = loadBootstrapSchemas();
    const verificationProfile = buildVerificationProfileSample();

    expect(validateAgainstSchema(schemas.minimalContext, PLAN_MINIMAL_CONTEXT_SAMPLE).errors).toEqual([]);
    expect(validateAgainstSchema(schemas.minimalContext, WORK_MINIMAL_CONTEXT_SAMPLE).errors).toEqual([]);
    expect(buildPlanMinimalContext({ factInventory: FACT_INVENTORY_SAMPLE, verificationProfile })).toEqual(PLAN_MINIMAL_CONTEXT_SAMPLE);
    expect(buildWorkMinimalContext({
      factInventory: FACT_INVENTORY_SAMPLE,
      riskSignals: RISK_SIGNALS_SAMPLE,
      testSurface: TEST_SURFACE_SAMPLE,
      verificationProfile,
    })).toEqual(WORK_MINIMAL_CONTEXT_SAMPLE);
  });

  test('governance samples 已纳入 bootstrap control plane outputs', () => {
    const manifest = buildArtifactManifestSample();
    const ownership = buildOwnershipRegistrySample();
    const reviewQueue = buildReviewQueueSample();

    expect(manifest.outputs['fact-inventory.json']).toMatchObject({
      plane: 'control',
      status: 'required',
    });
    expect(manifest.outputs['risk-signals.json']).toMatchObject({
      plane: 'control',
      status: 'required',
    });
    expect(manifest.outputs['test-surface.json']).toMatchObject({
      plane: 'control',
      status: 'required',
    });
    expect(manifest.outputs['database-routing.json']).toMatchObject({
      plane: 'control',
      status: 'required',
    });
    expect(manifest.outputs['context-routing.json']).toMatchObject({
      plane: 'control',
      status: 'required',
    });
    expect(manifest.outputs['minimal-context/plan.json']).toMatchObject({
      plane: 'control',
      status: 'required',
    });
    expect(manifest.outputs['minimal-context/work.json']).toMatchObject({
      plane: 'control',
      status: 'required',
    });
    expect(manifest.outputs['minimal-context/review.json']).toMatchObject({
      plane: 'control',
      status: 'required',
    });
    expect(manifest.outputs['ownership.json']).toMatchObject({
      plane: 'control',
      status: 'optional',
    });
    expect(manifest.outputs['review-queue.json']).toMatchObject({
      plane: 'control',
      status: 'optional',
    });
    expect(ownership.schema_version).toBe('v1');
    expect(reviewQueue.schema_version).toBe('v1');
  });

  test('artifact-manifest sample 包含 data_quality 字段', () => {
    const manifest = buildArtifactManifestSample();
    expect(manifest.data_quality).toBe('fact-backed');
  });

  test('fact-inventory sample 包含 topology contract', () => {
    expect(FACT_INVENTORY_SAMPLE.topology).toMatchObject({
      schema_version: 'v1',
      kind: 'single_repo',
      container_kind: 'git_repo',
      selection_granularity: 'project',
    });
    expect(FACT_INVENTORY_SAMPLE.topology.units).toEqual([
      expect.objectContaining({
        kind: 'project',
        path: '.',
        git_root: '.',
      }),
    ]);
  });

  test('buildArtifactManifest：空 factInventory -> data_quality empty', () => {
    const { buildArtifactManifest } = require('../../src/bootstrap-compiler/compile-routing');
    const manifest = buildArtifactManifest({});
    expect(manifest.data_quality).toBe('empty');
  });

  test('buildArtifactManifest：有 modules 无 entrypoints -> data_quality partial', () => {
    const { buildArtifactManifest } = require('../../src/bootstrap-compiler/compile-routing');
    const manifest = buildArtifactManifest({
      actualAssets: [
        'fact-inventory.json',
        'risk-signals.json',
        'test-surface.json',
        'database-routing.json',
        'context-routing.json',
        'artifact-manifest.json',
        'freshness.json',
        'verification-profile.json',
        'minimal-context/plan.json',
        'minimal-context/work.json',
        'minimal-context/review.json',
      ],
      factInventory: { modules: [{ path: 'src/' }], entrypoints: [] },
    });
    expect(manifest.data_quality).toBe('partial');
  });

  test('buildArtifactManifest：缺关键 control-plane 资产时 status=incomplete', () => {
    const { buildArtifactManifest } = require('../../src/bootstrap-compiler/compile-routing');
    const manifest = buildArtifactManifest({
      actualAssets: [
        'fact-inventory.json',
        'risk-signals.json',
        'test-surface.json',
      ],
      factInventory: { modules: [{ path: 'src/' }], entrypoints: [{ path: 'src/index.js' }] },
    });

    expect(manifest.status).toBe('incomplete');
  });

  test('buildArtifactManifest：有 modules 和 entrypoints -> data_quality fact-backed', () => {
    const { buildArtifactManifest } = require('../../src/bootstrap-compiler/compile-routing');
    const manifest = buildArtifactManifest({
      factInventory: {
        modules: [{ path: 'src/' }],
        entrypoints: [{ path: 'src/index.js' }],
      },
    });
    expect(manifest.data_quality).toBe('fact-backed');
  });

  test('minimal-context 三份 context 都包含 provenance 和 confidence 字段', () => {
    const verificationProfile = buildVerificationProfileSample();
    const plan = buildPlanMinimalContext({ factInventory: FACT_INVENTORY_SAMPLE, verificationProfile });
    const work = buildWorkMinimalContext({
      factInventory: FACT_INVENTORY_SAMPLE,
      riskSignals: RISK_SIGNALS_SAMPLE,
      testSurface: TEST_SURFACE_SAMPLE,
      verificationProfile,
    });
    const review = buildReviewMinimalContext({
      riskSignals: RISK_SIGNALS_SAMPLE,
      testSurface: TEST_SURFACE_SAMPLE,
      verificationProfile,
    });

    expect(plan.provenance).toBe('fact-inventory');
    expect(plan.confidence).toBe('medium'); // modules > 0, testSurface not passed
    expect(work.provenance).toBe('fact-inventory');
    expect(work.confidence).toBe('high'); // modules > 0 and test_files > 0
    expect(review.provenance).toBe('empty-fallback');
    expect(review.confidence).toBe('low'); // no factInventory passed
  });
});
