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

  test('source skill and prompt mirror define the four-surface boundary map explicitly', () => {
    const skill = fs.readFileSync(GRAPH_BOOTSTRAP_SKILL_PATH, 'utf8');
    const promptMirror = fs.readFileSync(PROMPT_MIRROR_SKILL_PATH, 'utf8');

    for (const content of [skill, promptMirror]) {
      expect(content).toContain('## Surface Map');
      expect(content).toContain('spec-first source repo internals');
      expect(content).toContain('installed runtime assets');
      expect(content).toContain('target repo generated artifacts');
      expect(content).toContain('package CLI surfaces');
      expect(content).toContain('docs/contracts/spec-graph-bootstrap/');
      expect(content).toContain('src/bootstrap-compiler/');
      expect(content).toContain('spec-first stage0-context');
      expect(content).toContain('不是 `spec-first graph-bootstrap` 包级子命令');
      expect(content).toContain('不要在 target repo 中查找 source repo 内部路径来判断 workflow 是否可用');
    }
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
    expect(claudeRuntime).toContain('installed runtime assets');
    expect(codexRuntime).toContain('installed runtime assets');
    expect(claudeRuntime).toContain('package CLI surfaces');
    expect(codexRuntime).toContain('package CLI surfaces');
    expect(claudeRuntime).toContain('不是 `spec-first graph-bootstrap` 包级子命令');
    expect(codexRuntime).toContain('不是 `spec-first graph-bootstrap` 包级子命令');
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
    expect(schemas).toContain('database: [{ present, connection_name, config_source, evidence_sources, db_type, database_name_guess, credential_keys, static_access_hints, confidence, inference_reason, evidence }]');
    expect(schemas).toContain('database_schema: [{ source_kind, path, db_type, connection_name, confidence, inference_reason, evidence }]');
    expect(schemas).toContain('## database-routing.json');
    expect(schemas).toContain('discovery_strategy: llm-led');
    expect(schemas).toContain('candidate_readiness:');
    expect(schemas).toContain('can_readonly_introspect: boolean');
    expect(schemas).toContain('候选级 facts + candidate blockers 才是主信息面板');
    expect(schemas).toContain('recommended_action / blockers 是 compatibility projection');
    expect(schemas).toContain('route: mysql-cli | <future readonly cli>');
    expect(schemas).toContain('recommended_action: llm-readonly-introspect | llm-inspect-repo | not-needed');
    expect(schemas).not.toContain('mysql-mcp');
  });

  test('source skill references 把数据库发现表述为 LLM-first handoff，而不是 extractor profile 注册表', () => {
    const degraded = fs.readFileSync(
      path.join(REPO_ROOT, 'skills/spec-graph-bootstrap/references/phase1-degraded-extraction.md'),
      'utf8'
    );
    const full = fs.readFileSync(
      path.join(REPO_ROOT, 'skills/spec-graph-bootstrap/references/phase1-crg-extraction.md'),
      'utf8'
    );
    const schemas = fs.readFileSync(GRAPH_BOOTSTRAP_SCHEMAS_PATH, 'utf8');

    expect(degraded).toContain('framework hints');
    expect(degraded).toContain('不再维护 database extractor profile registry');
    expect(full).toContain('raw database handoff');
    expect(full).toContain('不再在脚本层维护 database extractor profile registry 或 selected route 语义');
    expect(schemas).toContain('LLM-first handoff contract');
  });

  test('artifact-schemas.md 定义了 data_quality 字段及分析模式映射规则', () => {
    const schemas = fs.readFileSync(GRAPH_BOOTSTRAP_SCHEMAS_PATH, 'utf8');

    expect(schemas).toContain('data_quality');
    expect(schemas).toContain('fact-backed');
    expect(schemas).toContain('"partial"');
    expect(schemas).toContain('"skeletal"');
    // 包含按 analyzer_mode 决定 data_quality 的规则说明
    expect(schemas).toContain('analyzer_mode');
  });

  test('SKILL.md W.3 workspace docs 写入清单包含 injection-index.yaml', () => {
    const skill = fs.readFileSync(GRAPH_BOOTSTRAP_SKILL_PATH, 'utf8');
    const w3Section = skill.slice(skill.indexOf('#### W.3 Workspace Docs 写入'));

    expect(w3Section).toContain('injection-index.yaml');
  });

  test('SKILL.md W.2 workspace manifest 声明不写 data_quality', () => {
    const skill = fs.readFileSync(GRAPH_BOOTSTRAP_SKILL_PATH, 'utf8');
    const w2Section = skill.slice(
      skill.indexOf('**artifact-manifest.json**（workspace slug 级'),
      skill.indexOf('**workspace-readiness-summary.json**')
    );

    expect(w2Section).toContain('data_quality');
    expect(w2Section).toContain('不写');
  });

  test('source skill and prompt mirror describe database surfaces as handoff only, without bootstrap database docs', () => {
    const sourceSkill = fs.readFileSync(GRAPH_BOOTSTRAP_SKILL_PATH, 'utf8');
    const promptMirror = fs.readFileSync(PROMPT_MIRROR_SKILL_PATH, 'utf8');

    expect(sourceSkill).toContain('fact-inventory.database_schema[]');
    expect(promptMirror).toContain('fact-inventory.database_schema[]');
    expect(sourceSkill).toContain('bootstrap 主链**不再创建** `database-context task`');
    expect(promptMirror).toContain('bootstrap 主链**不再创建** `database-context task`');
    expect(sourceSkill).toContain('bootstrap 只写 `database-routing.json`');
    expect(promptMirror).toContain('bootstrap 只写 `database-routing.json`');
    expect(sourceSkill).not.toContain('database/database-index.md');
    expect(promptMirror).not.toContain('database/database-index.md');
  });

  test('source skill and prompt mirror describe database-routing top-level summary as compatibility projection', () => {
    const sourceSkill = fs.readFileSync(GRAPH_BOOTSTRAP_SKILL_PATH, 'utf8');
    const promptMirror = fs.readFileSync(PROMPT_MIRROR_SKILL_PATH, 'utf8');

    expect(sourceSkill).toContain('candidate_readiness.candidates[]');
    expect(promptMirror).toContain('candidate_readiness.candidates[]');
    expect(sourceSkill).toContain('`recommended_action` / `blockers[]` 只保留 compatibility projection');
    expect(promptMirror).toContain('`recommended_action` / `blockers[]` 只保留 compatibility projection');
    expect(sourceSkill).not.toContain('runtime-only route / fallback / provenance 真源');
    expect(promptMirror).not.toContain('runtime-only route / fallback / provenance 真源');
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

  test('fact-inventory schema and checked-in sample expose evidence-first database contracts', () => {
    const schemas = loadBootstrapSchemas();
    const databaseSchema = schemas.factInventory.properties.database.items.properties;

    expect(databaseSchema.evidence_sources).toBeDefined();
    expect(databaseSchema.evidence_sources.items.required).toEqual(
      expect.arrayContaining(['kind', 'path'])
    );
    expect(schemas.factInventory.properties.database_schema).toBeDefined();
    expect(FACT_INVENTORY_SAMPLE.database[0].evidence_sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: expect.any(String),
          path: expect.any(String),
        }),
      ])
    );
    expect(FACT_INVENTORY_SAMPLE.database_schema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source_kind: expect.any(String),
          path: expect.any(String),
          db_type: expect.any(String),
        }),
      ])
    );
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

  test('buildArtifactManifest：full 模式有 modules 和 entrypoints -> data_quality fact-backed', () => {
    const { buildArtifactManifest } = require('../../src/bootstrap-compiler/compile-routing');
    const manifest = buildArtifactManifest({
      factInventory: {
        analyzer_mode: 'full',
        modules: [{ path: 'src/' }],
        entrypoints: [{ path: 'src/index.js' }],
      },
    });
    expect(manifest.data_quality).toBe('fact-backed');
  });

  test('buildArtifactManifest：enhanced 模式有 modules 和 entrypoints -> data_quality partial（非 fact-backed）', () => {
    const { buildArtifactManifest } = require('../../src/bootstrap-compiler/compile-routing');
    const manifest = buildArtifactManifest({
      factInventory: {
        analyzer_mode: 'enhanced',
        modules: [{ path: 'src/' }],
        entrypoints: [{ path: 'src/index.js' }],
      },
    });
    expect(manifest.data_quality).toBe('partial');
  });

  test('buildArtifactManifest：basic 模式有数据 -> data_quality skeletal', () => {
    const { buildArtifactManifest } = require('../../src/bootstrap-compiler/compile-routing');
    const manifest = buildArtifactManifest({
      factInventory: {
        analyzer_mode: 'basic',
        modules: [{ path: 'src/' }],
        entrypoints: [],
      },
    });
    expect(manifest.data_quality).toBe('skeletal');
  });

  test('buildArtifactManifest：analyzer_mode 缺失时有数据 -> data_quality partial（保守，非 fact-backed）', () => {
    const { buildArtifactManifest } = require('../../src/bootstrap-compiler/compile-routing');
    const manifest = buildArtifactManifest({
      factInventory: {
        modules: [{ path: 'src/' }],
        entrypoints: [{ path: 'src/index.js' }],
      },
    });
    expect(manifest.data_quality).toBe('partial');
    expect(manifest.data_quality).not.toBe('fact-backed');
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
