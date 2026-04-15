'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  loadBootstrapSchemas,
  validateAgainstSchema,
} = require('../../src/bootstrap-compiler/schema-loader');
const {
  buildArtifactManifestSample,
  buildContextRoutingSample,
  serializeInjectionIndex,
} = require('../../src/bootstrap-compiler/sample-generator');
const {
  buildPlanMinimalContext,
  buildReviewMinimalContext,
  buildWorkMinimalContext,
} = require('../../src/bootstrap-compiler/compile-minimal-context');

const REPO_ROOT = path.join(__dirname, '..', '..');
const GITIGNORE_PATH = path.join(REPO_ROOT, '.gitignore');
const GRAPH_BOOTSTRAP_SKILL_PATH = path.join(
  REPO_ROOT,
  'skills/spec-graph-bootstrap/SKILL.md'
);
const SAMPLE_INJECTION_INDEX_PATH = path.join(
  REPO_ROOT,
  'docs/contexts/spec-first/injection-index.yaml'
);
const SAMPLE_CONTEXT_ROUTING_PATH = path.join(
  REPO_ROOT,
  '.spec-first/workflows/bootstrap/spec-first/context-routing.json'
);
const SAMPLE_ARTIFACT_MANIFEST_PATH = path.join(
  REPO_ROOT,
  '.spec-first/workflows/bootstrap/spec-first/artifact-manifest.json'
);
const SAMPLE_REVIEW_MINIMAL_CONTEXT_PATH = path.join(
  REPO_ROOT,
  '.spec-first/workflows/bootstrap/spec-first/minimal-context/review.json'
);
const SAMPLE_PLAN_MINIMAL_CONTEXT_PATH = path.join(
  REPO_ROOT,
  '.spec-first/workflows/bootstrap/spec-first/minimal-context/plan.json'
);
const SAMPLE_WORK_MINIMAL_CONTEXT_PATH = path.join(
  REPO_ROOT,
  '.spec-first/workflows/bootstrap/spec-first/minimal-context/work.json'
);
const SAMPLE_OWNERSHIP_PATH = path.join(
  REPO_ROOT,
  '.spec-first/workflows/bootstrap/spec-first/ownership.json'
);
const SAMPLE_REVIEW_QUEUE_PATH = path.join(
  REPO_ROOT,
  '.spec-first/workflows/bootstrap/spec-first/review-queue.json'
);
const SAMPLE_RISK_SIGNALS_PATH = path.join(
  REPO_ROOT,
  '.spec-first/workflows/bootstrap/spec-first/risk-signals.json'
);
const SAMPLE_TEST_SURFACE_PATH = path.join(
  REPO_ROOT,
  '.spec-first/workflows/bootstrap/spec-first/test-surface.json'
);
const SAMPLE_FACT_INVENTORY_PATH = path.join(
  REPO_ROOT,
  '.spec-first/workflows/bootstrap/spec-first/fact-inventory.json'
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
  });

  test('source skill schema requires updated_at for layer facts and risk signal facts', () => {
    const skill = fs.readFileSync(GRAPH_BOOTSTRAP_SKILL_PATH, 'utf8');

    expect(skill).toContain(
      'layers: { frontend: { present, confidence, inference_reason, evidence, updated_at }, ... }'
    );
    expect(skill).toContain(
      'signals: [{ path, symbol, kind, summary, severity, confidence, inference_reason, evidence, updated_at }]'
    );
    expect(skill).toContain(
      'top_hubs: [{ id, name, file_path, kind, in_degree, confidence, inference_reason, evidence, updated_at }]'
    );
  });

  test('checked-in sample injection index avoids duplicate public-entrypoints injection in plan/work', () => {
    const yaml = fs.readFileSync(SAMPLE_INJECTION_INDEX_PATH, 'utf8');
    const planBlock = yaml.match(/plan:\n([\s\S]*?)\n  work:/);
    const workBlock = yaml.match(/work:\n([\s\S]*?)\n  review:/);

    expect(planBlock && planBlock[1]).not.toContain('code-facts/public-entrypoints.md');
    expect(workBlock && workBlock[1]).not.toContain('code-facts/public-entrypoints.md');
    expect(yaml).toMatch(/condition: "output_exists\.code_facts_public_entrypoints"/);
  });

  test('artifact-manifest and context-routing checked-in samples satisfy the P0 schemas', () => {
    const schemas = loadBootstrapSchemas();
    const artifactManifest = JSON.parse(fs.readFileSync(SAMPLE_ARTIFACT_MANIFEST_PATH, 'utf8'));
    const contextRouting = JSON.parse(fs.readFileSync(SAMPLE_CONTEXT_ROUTING_PATH, 'utf8'));

    expect(validateAgainstSchema(schemas.artifactManifest, artifactManifest).errors).toEqual([]);
    expect(validateAgainstSchema(schemas.contextRouting, contextRouting).errors).toEqual([]);
  });

  test('sample generator stays in sync with checked-in artifact-manifest and context-routing samples', () => {
    const expectedManifest = JSON.parse(fs.readFileSync(SAMPLE_ARTIFACT_MANIFEST_PATH, 'utf8'));
    const expectedRouting = JSON.parse(fs.readFileSync(SAMPLE_CONTEXT_ROUTING_PATH, 'utf8'));
    const generatedManifest = buildArtifactManifestSample();
    const generatedRouting = buildContextRoutingSample();

    expect(generatedManifest).toEqual(expectedManifest);
    expect(generatedRouting).toEqual(expectedRouting);
  });

  test('sample generator stays in sync with checked-in human-view injection index sample', () => {
    const expectedYaml = fs.readFileSync(SAMPLE_INJECTION_INDEX_PATH, 'utf8');

    expect(serializeInjectionIndex()).toBe(expectedYaml);
  });

  test('review minimal-context sample satisfies schema and compiler output', () => {
    const schemas = loadBootstrapSchemas();
    const riskSignals = JSON.parse(fs.readFileSync(SAMPLE_RISK_SIGNALS_PATH, 'utf8'));
    const testSurface = JSON.parse(fs.readFileSync(SAMPLE_TEST_SURFACE_PATH, 'utf8'));
    const expectedReview = JSON.parse(fs.readFileSync(SAMPLE_REVIEW_MINIMAL_CONTEXT_PATH, 'utf8'));
    const compiledReview = buildReviewMinimalContext({ riskSignals, testSurface });

    expect(validateAgainstSchema(schemas.minimalContext, expectedReview).errors).toEqual([]);
    expect(compiledReview).toEqual(expectedReview);
  });

  test('plan/work minimal-context checked-in samples satisfy schema and compiler output', () => {
    const schemas = loadBootstrapSchemas();
    const factInventory = JSON.parse(fs.readFileSync(SAMPLE_FACT_INVENTORY_PATH, 'utf8'));
    const riskSignals = JSON.parse(fs.readFileSync(SAMPLE_RISK_SIGNALS_PATH, 'utf8'));
    const testSurface = JSON.parse(fs.readFileSync(SAMPLE_TEST_SURFACE_PATH, 'utf8'));
    const expectedPlan = JSON.parse(fs.readFileSync(SAMPLE_PLAN_MINIMAL_CONTEXT_PATH, 'utf8'));
    const expectedWork = JSON.parse(fs.readFileSync(SAMPLE_WORK_MINIMAL_CONTEXT_PATH, 'utf8'));

    expect(validateAgainstSchema(schemas.minimalContext, expectedPlan).errors).toEqual([]);
    expect(validateAgainstSchema(schemas.minimalContext, expectedWork).errors).toEqual([]);
    expect(buildPlanMinimalContext({ factInventory })).toEqual(expectedPlan);
    expect(buildWorkMinimalContext({ factInventory, riskSignals, testSurface })).toEqual(expectedWork);
  });

  test('governance samples 已纳入 bootstrap control plane outputs', () => {
    const manifest = JSON.parse(fs.readFileSync(SAMPLE_ARTIFACT_MANIFEST_PATH, 'utf8'));
    const ownership = JSON.parse(fs.readFileSync(SAMPLE_OWNERSHIP_PATH, 'utf8'));
    const reviewQueue = JSON.parse(fs.readFileSync(SAMPLE_REVIEW_QUEUE_PATH, 'utf8'));

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
});
