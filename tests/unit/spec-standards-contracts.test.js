'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  buildDownstreamConsumers,
  buildGlueMap,
  buildInventory,
  buildProjectShape,
  buildStandardsPlan,
  parseArgs,
  prepareBaseline,
} = require('../../skills/spec-standards/scripts/prepare-baseline');
const {
  discoverChildGitRepos,
  normalizeRepoSelector,
  normalizeTargetKind,
  resolveStandardsTarget,
} = require('../../skills/spec-standards/scripts/standards-targeting');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/spec-standards/SKILL.md');
const SCRIPT_PATH = path.join(REPO_ROOT, 'skills/spec-standards/scripts/prepare-baseline.js');
const TARGETING_SCRIPT_PATH = path.join(REPO_ROOT, 'skills/spec-standards/scripts/standards-targeting.js');
const WORKSPACE_FACTS_SCRIPT_PATH = path.join(REPO_ROOT, 'skills/spec-standards/scripts/standards-workspace-facts.js');
const VALIDATOR_SCRIPT_PATH = path.join(REPO_ROOT, 'skills/spec-standards/scripts/validate-artifacts.js');
const COMMAND_TEMPLATE_PATH = path.join(REPO_ROOT, 'templates/claude/commands/spec/standards.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(read(filePath));
}

function writeFile(root, relativePath, contents = '') {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, 'utf8');
}

describe('spec-standards workflow contract', () => {
  test('source skill preserves standards compiler boundaries', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('name: spec-standards');
    expect(skill).toContain('argument-hint: "[--baseline|--quick|--refresh|--deep] [--repo <child>|--workspace|--target-kind <auto|repo|workspace>] [--import-source <git-or-path>]"');
    expect(skill).toContain('Graph-backed Project Standards & Glue Compiler');
    expect(skill).toContain('Invocation Boundary');
    expect(skill).toContain('not an agent type');
    expect(skill).toContain('Scripts prepare facts; the LLM decides standards.');
    expect(skill).toContain('Preview before writeback.');
    expect(skill).toContain('Observed is not confirmed.');
    expect(skill).toContain('Do not write `repo-profile.yaml`.');
    expect(skill).toContain('`--repo <child>` selects one child repo as the target repo root');
    expect(skill).toContain('no-argument default batches over every discovered child repo');
    expect(skill).toContain('explicitly selects the parent advisory workspace baseline');
    expect(skill).toContain('scope.type=workspace_children');
    expect(skill).toContain('scope.type=workspace');
    expect(skill).toContain('synthesis_contract.workspace_policy');
    expect(skill).toContain('synthesis_contract.candidate_required_fields');
    expect(skill).toContain('spec-first.standards-candidates.v1');
    expect(skill).toContain('Confirmed standards are the only hard constraints.');
    expect(skill).toContain('Default mode. Prepare a first project baseline');
    expect(skill).toContain('.spec-first/standards/project-shape.json');
    expect(skill).toContain('.spec-first/standards/standards-plan.json');
    expect(skill).toContain('.spec-first/standards/glue-map.json');
    expect(skill).toContain('.spec-first/standards/standards-candidates.json');
    expect(skill).toContain('.spec-first/standards/standards-preview.md');
    expect(skill).toContain('node skills/spec-standards/scripts/validate-artifacts.js --standards-dir .spec-first/standards --json');
    expect(skill).toContain('trust_level=degraded');
    expect(skill).toContain('consumption_boundary=advisory_only');
    expect(skill).toContain('validator fail, missing validator result, `trust_level=degraded`, `consumption_boundary=advisory_only`, or `workspace-advisory-only` -> degraded/advisory only');
    expect(skill).toContain('docs/examples/standards-glue-consumption-examples.md');
    expect(skill).toContain('human-readable examples, not machine-readable schema or generated artifacts');
    expect(skill).toContain('Artifact validation is the completion gate.');
    expect(skill).toContain('If validator has not returned exit code `0`, do not report a trusted baseline or completed standards baseline');
    expect(skill).toContain('Do not rewrite contract-bearing headings, tool names, paths, command names, candidate ids, or author names just to clear diagnostics.');
    expect(skill).toContain('`advisory` is not a candidate status');
    expect(skill).toContain('node skills/spec-standards/scripts/prepare-baseline.js --mode <baseline|quick|refresh|deep>');
    expect(skill).toContain('Shared standards do not become project policy on import');
    expect(skill).toContain('Supported Modes');
    expect(skill).toContain('`--quick`');
    expect(skill).toContain('`--refresh`');
    expect(skill).toContain('`--deep`');
    expect(skill).toContain('`--import-source <git-or-path>`');
    expect(skill).toContain('Default answer must be "not modified"');
    expect(skill).toContain('.spec-first/graph/provider-status.json');
    expect(skill).toContain('.spec-first/graph/graph-facts.json');
    expect(skill).toContain('.spec-first/impact/bootstrap-impact-capabilities.json');
    expect(skill).toContain('.spec-first/providers/gitnexus/normalized/architecture-facts.json');
    expect(skill).toContain('.spec-first/providers/gitnexus/normalized/reuse-candidates.json');
    expect(skill).toContain('.spec-first/providers/code-review-graph/normalized/impact-capabilities.json');
    expect(skill).toContain('docs/contracts/graph-provider-consumption.md');
    expect(skill).not.toContain('.spec-first/graph/bootstrap-impact-capabilities.json');
  });

  test('Claude command template is metadata-only and delegates behavior to the skill', () => {
    const template = read(COMMAND_TEMPLATE_PATH);

    expect(template).toContain('description: "Compile project standards and glue capability baseline artifacts"');
    expect(template).toContain('argument-hint: "[--baseline|--quick|--refresh|--deep] [--repo <child>|--workspace|--target-kind <auto|repo|workspace>] [--import-source <git-or-path>]"');
    expect(template).toContain('This source template defines Claude command metadata only.');
    expect(template).toContain('skills/spec-standards/SKILL.md');
    expect(template).toContain('Edit the paired skill to change workflow behavior.');
  });

  test('graph artifact inventory and glue map use current canonical provider paths', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-graph-artifacts-'));
    try {
      writeFile(tmp, 'package.json', JSON.stringify({ name: 'graph-artifact-project' }));
      writeFile(tmp, 'skills/spec-graph-bootstrap/SKILL.md', '# Graph Bootstrap\n');
      writeFile(tmp, '.spec-first/graph/provider-status.json', '{}\n');
      writeFile(tmp, '.spec-first/graph/graph-facts.json', '{}\n');
      writeFile(tmp, '.spec-first/impact/bootstrap-impact-capabilities.json', '{}\n');
      writeFile(tmp, '.spec-first/providers/gitnexus/normalized/architecture-facts.json', '{}\n');
      writeFile(tmp, '.spec-first/providers/gitnexus/normalized/reuse-candidates.json', '{}\n');
      writeFile(tmp, '.spec-first/providers/code-review-graph/normalized/impact-capabilities.json', '{}\n');
      writeFile(tmp, '.spec-first/graph/bootstrap-impact-capabilities.json', '{}\n');

      const inventory = buildInventory(tmp);
      const projectShape = buildProjectShape(tmp, inventory, { targetKind: 'repo' });
      const glueMap = buildGlueMap(projectShape, inventory, { targetKind: 'repo' });
      const graphCapability = glueMap.capabilities.find((item) => item.id === 'capability.graph.readiness');

      expect(inventory.graph_artifacts).toEqual(expect.arrayContaining([
        '.spec-first/graph/provider-status.json',
        '.spec-first/graph/graph-facts.json',
        '.spec-first/impact/bootstrap-impact-capabilities.json',
        '.spec-first/providers/gitnexus/normalized/architecture-facts.json',
        '.spec-first/providers/gitnexus/normalized/reuse-candidates.json',
        '.spec-first/providers/code-review-graph/normalized/impact-capabilities.json',
      ]));
      expect(inventory.graph_artifacts).not.toContain('.spec-first/graph/bootstrap-impact-capabilities.json');
      expect(graphCapability.outputs).toEqual(expect.arrayContaining([
        '.spec-first/graph/provider-status.json',
        '.spec-first/graph/graph-facts.json',
        '.spec-first/impact/bootstrap-impact-capabilities.json',
        '.spec-first/providers/gitnexus/normalized/architecture-facts.json',
        '.spec-first/providers/gitnexus/normalized/reuse-candidates.json',
        '.spec-first/providers/code-review-graph/normalized/impact-capabilities.json',
      ]));
      expect(graphCapability.outputs).not.toContain('.spec-first/graph/bootstrap-impact-capabilities.json');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('downstream consumers expose trusted advisory risk and degraded consumption boundaries', () => {
    const consumers = buildDownstreamConsumers();
    const planConsumer = consumers.find((consumer) => consumer.workflow === 'spec-plan');
    const workConsumer = consumers.find((consumer) => consumer.workflow === 'spec-work');
    const reviewConsumer = consumers.find((consumer) => consumer.workflow === 'spec-code-review');

    for (const consumer of [planConsumer, workConsumer, reviewConsumer]) {
      expect(consumer.hard_context).toEqual(['confirmed']);
      expect(consumer.advisory_context).toEqual(['observed', 'imported', 'suggested']);
      expect(consumer.risk_context).toEqual(['conflict', 'deprecated', 'drifted']);
      expect(consumer.question_context).toEqual(['unknown']);
      expect(consumer.degraded_context).toEqual([
        'validator_fail',
        'trust_level=degraded',
        'missing_validation_result',
        'consumption_boundary=advisory_only',
        'workspace-advisory-only',
      ]);
      expect(consumer.consumption_modes).toEqual(expect.objectContaining({
        confirmed: 'hard',
        observed: 'advisory',
        imported: 'advisory',
        suggested: 'advisory',
        conflict: 'risk',
        unknown: 'question',
        validator_fail: 'degraded/advisory',
        trust_level_degraded: 'degraded/advisory',
        consumption_boundary_advisory_only: 'degraded/advisory',
        workspace_advisory_only: 'degraded/advisory',
      }));
      expect(consumer.glue_map_boundary).toContain('not a workflow state machine');
    }
  });

  test('deterministic baseline script writes only fact artifacts', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-baseline-'));
    try {
      fs.mkdirSync(path.join(tmp, 'bin'), { recursive: true });
      fs.mkdirSync(path.join(tmp, 'src/cli'), { recursive: true });
      fs.mkdirSync(path.join(tmp, 'src/cli/commands'), { recursive: true });
      fs.mkdirSync(path.join(tmp, 'skills/spec-work'), { recursive: true });
      fs.mkdirSync(path.join(tmp, 'src/cli/contracts/example'), { recursive: true });
      fs.mkdirSync(path.join(tmp, 'templates/claude/commands/spec'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'bin/spec-first.js'), '#!/usr/bin/env node\n', 'utf8');
      fs.writeFileSync(path.join(tmp, 'src/cli/index.js'), "'use strict';\n", 'utf8');
      fs.writeFileSync(path.join(tmp, 'src/cli/commands/init.js'), "'use strict';\n", 'utf8');
      fs.writeFileSync(path.join(tmp, 'skills/spec-work/SKILL.md'), '---\nname: spec-work\n---\n', 'utf8');
      fs.writeFileSync(path.join(tmp, 'src/cli/contracts/example/example.schema.json'), '{}\n', 'utf8');
      fs.writeFileSync(path.join(tmp, 'templates/claude/commands/spec/work.md'), '---\ndescription: work\n---\n', 'utf8');
      fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({
        name: 'example-spec-first',
        dependencies: {},
        devDependencies: {
          jest: '^29.0.0',
        },
      }), 'utf8');

      const result = prepareBaseline({
        root: tmp,
        output: path.join(tmp, '.spec-first/standards'),
        mode: 'baseline',
        dryRun: false,
      });

      expect(result.artifacts).toEqual([
        '.spec-first/standards/project-shape.json',
        '.spec-first/standards/standards-plan.json',
        '.spec-first/standards/glue-map.json',
      ]);
      expect(fs.existsSync(path.join(tmp, '.spec-first/standards/project-shape.json'))).toBe(true);
      expect(fs.existsSync(path.join(tmp, '.spec-first/standards/standards-plan.json'))).toBe(true);
      expect(fs.existsSync(path.join(tmp, '.spec-first/standards/glue-map.json'))).toBe(true);
      expect(fs.existsSync(path.join(tmp, '.spec-first/standards/standards-candidates.json'))).toBe(false);
      expect(fs.existsSync(path.join(tmp, '.spec-first/specs/repo-profile.yaml'))).toBe(false);

      const projectShape = readJson(path.join(tmp, '.spec-first/standards/project-shape.json'));
      const standardsPlan = readJson(path.join(tmp, '.spec-first/standards/standards-plan.json'));
      const glueMap = readJson(path.join(tmp, '.spec-first/standards/glue-map.json'));

      expect(projectShape.schema_version).toBe('spec-first.project-shape.v1');
      expect(projectShape.scope).toEqual({
        type: 'repo',
        root: '.',
        domains: [],
        modules: [],
      });
      expect(projectShape.project_mode).toBe('single_project_repo');
      expect(projectShape.project.detected_type).toBe('node_cli_ai_workflow_framework');
      expect(projectShape.module_detection).toEqual({
        status: 'not_requested',
        requested_modules: [],
        detected_count: 0,
        unavailable_modules: [],
      });
      expect(projectShape.scan).toEqual({
        max_files: 4000,
        scanned_file_count: expect.any(Number),
        truncated: false,
        hash_reliability: 'complete',
        ordering: 'lexical',
      });
      expect(projectShape.evidence.inventory_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(projectShape.evidence.inventory_hash_reliability).toBe('complete');
      expect(projectShape.recommended_standard_domains).toEqual(expect.arrayContaining([
        'artifact_contracts',
        'cli',
        'skill_workflow',
      ]));
      expect(standardsPlan.schema_version).toBe('spec-first.standards-plan.v1');
      expect(standardsPlan.budget.allow_deep_graph_queries).toBe(false);
      expect(standardsPlan.tasks.every((task) => task.owner === 'llm')).toBe(true);
      expect(standardsPlan.synthesis_contract).toEqual(expect.objectContaining({
        schema_version: 'spec-first.standards-synthesis-contract.v1',
        candidate_required_fields: expect.arrayContaining(['status', 'evidence', 'downstream_usage']),
        allowed_statuses: expect.arrayContaining(['confirmed', 'imported', 'observed', 'suggested', 'conflict', 'unknown']),
        allowed_source_types: expect.arrayContaining(['repo_profile_confirmed', 'shared_standard_imported', 'graph_observed']),
      }));
      expect(standardsPlan.synthesis_contract.writeback_policy).toEqual({
        repo_profile_yaml_modified_by_default: false,
        only_confirmed_candidates_are_patch_eligible: true,
        patch_requires_explicit_user_confirmation: true,
      });
      expect(glueMap.schema_version).toBe('spec-first.glue-map.v1');
      expect(glueMap.capabilities.map((capability) => capability.id)).toEqual(expect.arrayContaining([
        'capability.workflow.skills',
        'capability.cli.runtime-sync',
        'capability.contracts.machine-readable',
      ]));
      expect(glueMap.downstream_consumers.map((consumer) => consumer.workflow)).toEqual(expect.arrayContaining([
        'spec-plan',
        'spec-write-tasks',
        'spec-work',
        'spec-code-review',
      ]));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('repo selector scans and writes child-local standards artifacts', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-child-repo-'));
    try {
      writeFile(tmp, 'packages/app/.git/HEAD', 'ref: refs/heads/main\n');
      writeFile(tmp, 'packages/app/package.json', JSON.stringify({ name: 'child-project' }));
      writeFile(tmp, 'packages/app/bin/spec-first.js', '#!/usr/bin/env node\n');
      writeFile(tmp, 'packages/app/src/cli/index.js', "'use strict';\n");

      const result = prepareBaseline({
        root: tmp,
        repo: 'packages/app',
        mode: 'baseline',
        dryRun: false,
      });

      expect(result.target_repo).toBe('packages/app');
      expect(result.repo_root).toBe(path.join(tmp, 'packages/app'));
      expect(result.scope).toEqual({
        type: 'workspace_child_repo',
        root: '.',
        domains: [],
        modules: [],
        workspace_child: 'packages/app',
      });
      expect(result.artifacts).toEqual([
        '.spec-first/standards/project-shape.json',
        '.spec-first/standards/standards-plan.json',
        '.spec-first/standards/glue-map.json',
      ]);
      expect(result.workspace_artifacts).toEqual([
        'packages/app/.spec-first/standards/project-shape.json',
        'packages/app/.spec-first/standards/standards-plan.json',
        'packages/app/.spec-first/standards/glue-map.json',
      ]);
      expect(fs.existsSync(path.join(tmp, '.spec-first/standards/project-shape.json'))).toBe(false);
      expect(fs.existsSync(path.join(tmp, 'packages/app/.spec-first/standards/project-shape.json'))).toBe(true);

      const projectShape = readJson(path.join(tmp, 'packages/app/.spec-first/standards/project-shape.json'));
      const glueMap = readJson(path.join(tmp, 'packages/app/.spec-first/standards/glue-map.json'));
      expect(projectShape.scope.type).toBe('workspace_child_repo');
      expect(projectShape.scope.workspace_child).toBe('packages/app');
      expect(projectShape.project.detected_type).toBe('node_cli');
      expect(glueMap.scope.workspace_child).toBe('packages/app');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('parent workspace default run writes child-local standards artifacts for every child repo', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-parent-workspace-'));
    try {
      writeFile(tmp, 'services/api/.git/HEAD', 'ref: refs/heads/main\n');
      writeFile(tmp, 'services/api/package.json', JSON.stringify({ name: 'api-service', dependencies: { express: '^4.18.0' } }));
      writeFile(tmp, 'services/api/src/server.js', "'use strict';\n");
      writeFile(tmp, 'apps/web/.git/HEAD', 'ref: refs/heads/main\n');
      writeFile(tmp, 'apps/web/package.json', JSON.stringify({ name: 'web-app', dependencies: { react: '^18.0.0' } }));
      writeFile(tmp, 'apps/web/src/App.tsx', 'export function App() { return null; }\n');
      writeFile(tmp, '.spec-first/workspace/graph-targets.json', '{}\n');

      const result = prepareBaseline({
        root: tmp,
        mode: 'baseline',
        dryRun: false,
      });

      expect(result.target_kind).toBe('workspace_children');
      expect(result.target_repo).toBe(null);
      expect(result.workspace_child_count).toBe(2);
      expect(result.workspace_root).toBe(tmp);
      expect(result.repo_root).toBe(tmp);
      expect(result.scope).toEqual({
        type: 'workspace_children',
        root: '.',
        domains: [],
        modules: [],
        workspace: {
          child_repo_count: 2,
          child_repos: ['apps/web', 'services/api'],
          child_repo_ordering: 'lexical',
          child_artifacts_default: true,
          parent_artifacts_written: false,
        },
      });
      expect(result.child_results.map((child) => child.target_repo)).toEqual([
        'apps/web',
        'services/api',
      ]);
      expect(result.artifacts).toEqual([
        'apps/web/.spec-first/standards/project-shape.json',
        'apps/web/.spec-first/standards/standards-plan.json',
        'apps/web/.spec-first/standards/glue-map.json',
        'services/api/.spec-first/standards/project-shape.json',
        'services/api/.spec-first/standards/standards-plan.json',
        'services/api/.spec-first/standards/glue-map.json',
      ]);
      expect(fs.existsSync(path.join(tmp, '.spec-first/standards/project-shape.json'))).toBe(false);
      expect(fs.existsSync(path.join(tmp, 'apps/web/.spec-first/standards/project-shape.json'))).toBe(true);
      expect(fs.existsSync(path.join(tmp, 'services/api/.spec-first/standards/project-shape.json'))).toBe(true);

      const webShape = readJson(path.join(tmp, 'apps/web/.spec-first/standards/project-shape.json'));
      const apiShape = readJson(path.join(tmp, 'services/api/.spec-first/standards/project-shape.json'));
      expect(webShape.scope).toEqual(expect.objectContaining({
        type: 'workspace_child_repo',
        workspace_child: 'apps/web',
      }));
      expect(apiShape.scope).toEqual(expect.objectContaining({
        type: 'workspace_child_repo',
        workspace_child: 'services/api',
      }));
      expect(webShape.project.detected_type).toBe('frontend_application');
      expect(apiShape.project.detected_type).toBe('backend_service');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('CLI parent workspace default run batches child-local standards artifacts', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-parent-cli-'));
    try {
      writeFile(tmp, 'services/api/.git/HEAD', 'ref: refs/heads/main\n');
      writeFile(tmp, 'services/api/package.json', JSON.stringify({ name: 'api-service', dependencies: { express: '^4.18.0' } }));
      writeFile(tmp, 'apps/web/.git/HEAD', 'ref: refs/heads/main\n');
      writeFile(tmp, 'apps/web/package.json', JSON.stringify({ name: 'web-app', dependencies: { react: '^18.0.0' } }));

      const result = spawnSync(process.execPath, [SCRIPT_PATH], {
        cwd: tmp,
        encoding: 'utf8',
      });

      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
      const payload = JSON.parse(result.stdout);
      expect(payload.status).toBe('pass');
      expect(payload.target_kind).toBe('workspace_children');
      expect(payload.succeeded_child_count).toBe(2);
      expect(payload.failed_child_count).toBe(0);
      expect(payload.child_results.map((child) => child.target_repo)).toEqual(['apps/web', 'services/api']);
      expect(payload.child_results.map((child) => child.status)).toEqual(['pass', 'pass']);
      expect(fs.existsSync(path.join(tmp, '.spec-first/standards/project-shape.json'))).toBe(false);
      expect(fs.existsSync(path.join(tmp, 'apps/web/.spec-first/standards/project-shape.json'))).toBe(true);
      expect(fs.existsSync(path.join(tmp, 'services/api/.spec-first/standards/project-shape.json'))).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('CLI parent workspace batch reports partial child failures with structured JSON', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-parent-cli-partial-'));
    try {
      writeFile(tmp, 'apps/web/.git/HEAD', 'ref: refs/heads/main\n');
      writeFile(tmp, 'apps/web/package.json', JSON.stringify({ name: 'web-app', dependencies: { react: '^18.0.0' } }));
      writeFile(tmp, 'services/api/.git/HEAD', 'ref: refs/heads/main\n');
      writeFile(tmp, 'services/api/package.json', '{bad json\n');

      const result = spawnSync(process.execPath, [SCRIPT_PATH], {
        cwd: tmp,
        encoding: 'utf8',
      });

      expect(result.stderr).toBe('');
      expect(result.status).toBe(1);
      const payload = JSON.parse(result.stdout);
      expect(payload.status).toBe('partial');
      expect(payload.succeeded_child_count).toBe(1);
      expect(payload.failed_child_count).toBe(1);
      expect(payload.child_results.map((child) => [child.target_repo, child.status])).toEqual([
        ['apps/web', 'pass'],
        ['services/api', 'failed'],
      ]);
      expect(payload.child_results[1].reason_code).toBe('workspace-child-baseline-failed');
      expect(payload.child_results[1].error.message).toContain('Expected property name');
      expect(payload.artifacts).toEqual([
        'apps/web/.spec-first/standards/project-shape.json',
        'apps/web/.spec-first/standards/standards-plan.json',
        'apps/web/.spec-first/standards/glue-map.json',
      ]);
      expect(fs.existsSync(path.join(tmp, 'apps/web/.spec-first/standards/project-shape.json'))).toBe(true);
      expect(fs.existsSync(path.join(tmp, 'services/api/.spec-first/standards/project-shape.json'))).toBe(false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('explicit workspace target writes advisory parent standards artifacts without mutating children', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-explicit-parent-workspace-'));
    try {
      writeFile(tmp, 'services/api/.git/HEAD', 'ref: refs/heads/main\n');
      writeFile(tmp, 'services/api/package.json', JSON.stringify({ name: 'api-service', dependencies: { express: '^4.18.0' } }));
      writeFile(tmp, 'services/api/src/server.js', "'use strict';\n");
      writeFile(tmp, 'apps/web/.git/HEAD', 'ref: refs/heads/main\n');
      writeFile(tmp, 'apps/web/package.json', JSON.stringify({ name: 'web-app', dependencies: { react: '^18.0.0' } }));
      writeFile(tmp, 'apps/web/src/App.tsx', 'export function App() { return null; }\n');
      writeFile(tmp, 'README.md', '# Parent workspace\n');

      const result = prepareBaseline({
        root: tmp,
        targetKind: 'workspace',
        mode: 'baseline',
        dryRun: false,
      });

      expect(result.target_kind).toBe('workspace');
      expect(result.scope.workspace.artifacts_advisory_only).toBe(true);
      expect(fs.existsSync(path.join(tmp, '.spec-first/standards/project-shape.json'))).toBe(true);
      expect(fs.existsSync(path.join(tmp, 'apps/web/.spec-first/standards/project-shape.json'))).toBe(false);
      expect(fs.existsSync(path.join(tmp, 'services/api/.spec-first/standards/project-shape.json'))).toBe(false);

      const projectShape = readJson(path.join(tmp, '.spec-first/standards/project-shape.json'));
      const standardsPlan = readJson(path.join(tmp, '.spec-first/standards/standards-plan.json'));
      const glueMap = readJson(path.join(tmp, '.spec-first/standards/glue-map.json'));

      expect(projectShape.project_mode).toBe('parent_workspace_multi_repo');
      expect(projectShape.project.detected_type).toBe('parent_workspace');
      expect(projectShape.domains.workspace.detected).toBe(true);
      expect(projectShape.workspace).toEqual(expect.objectContaining({
        schema_version: 'spec-first.workspace-children.v1',
        status: 'detected',
        child_repo_count: 2,
        child_repos_truncated: false,
      }));
      expect(projectShape.workspace.child_repos.map((child) => child.workspace_relative_path)).toEqual([
        'apps/web',
        'services/api',
      ]);
      expect(projectShape.workspace.child_repos[0]).toEqual(expect.objectContaining({
        detected_type: 'frontend_application',
        package_managers: ['npm'],
      }));
      expect(projectShape.workspace.child_repos[1]).toEqual(expect.objectContaining({
        detected_type: 'backend_service',
        package_managers: ['npm'],
      }));
      expect(projectShape.evidence.inventory_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(projectShape.evidence.workspace_summary_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(projectShape.evidence.scanned_file_count).toBe(1);
      expect(standardsPlan.scope.type).toBe('workspace');
      expect(standardsPlan.synthesis_contract.workspace_policy).toEqual(expect.objectContaining({
        active: true,
        artifacts_are_advisory: true,
        forbidden_writes: expect.arrayContaining([
          '<child>/.spec-first/standards/*',
          '<child>/.spec-first/specs/repo-profile.yaml',
        ]),
      }));
      expect(glueMap.scope.type).toBe('workspace');
      expect(glueMap.capabilities.map((capability) => capability.id)).toContain('capability.workspace.child-repo-map');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('workspace target resolver keeps parent and child standards scopes explicit', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-targeting-'));
    try {
      writeFile(tmp, 'services/api/.git/HEAD', 'ref: refs/heads/main\n');
      writeFile(tmp, 'services/api/package.json', JSON.stringify({ name: 'api-service' }));
      writeFile(tmp, 'apps/web/.git/HEAD', 'ref: refs/heads/main\n');
      writeFile(tmp, 'apps/web/package.json', JSON.stringify({ name: 'web-app' }));

      expect(normalizeTargetKind('workspace')).toBe('workspace');
      expect(() => normalizeTargetKind('invalid')).toThrow('Unsupported standards target kind: invalid');
      expect(normalizeRepoSelector('./services/./api')).toBe('services/api');
      expect(() => normalizeRepoSelector('.')).toThrow('not the workspace root');
      expect(() => normalizeRepoSelector('/tmp/outside')).toThrow('must be a workspace-relative child repo path');

      expect(discoverChildGitRepos(tmp).map((child) => child.workspace_relative_path)).toEqual([
        'apps/web',
        'services/api',
      ]);

      expect(resolveStandardsTarget({
        workspaceRoot: tmp,
        requestedRoot: tmp,
        repo: null,
        targetKind: 'auto',
      })).toEqual(expect.objectContaining({
        kind: 'workspace',
        reasonCode: 'workspace-child-repos-detected',
        repo: null,
      }));

      expect(resolveStandardsTarget({
        workspaceRoot: tmp,
        requestedRoot: path.join(tmp, 'services/api'),
        repo: 'services/api',
        targetKind: 'auto',
      })).toEqual(expect.objectContaining({
        kind: 'workspace_child_repo',
        reasonCode: 'explicit-child-repo',
        repo: 'services/api',
      }));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('resolveStandardsTarget returns directory-without-child-repos for plain dir', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-no-children-'));
    try {
      // 普通目录，无 .git，无子 git repo
      expect(resolveStandardsTarget({
        workspaceRoot: tmp,
        requestedRoot: tmp,
        repo: null,
        targetKind: 'auto',
      })).toEqual(expect.objectContaining({
        kind: 'repo',
        reasonCode: 'directory-without-child-repos',
      }));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('resolveStandardsTarget returns cwd-git-root for dir with .git', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-git-root-'));
    try {
      fs.writeFileSync(path.join(tmp, '.git'), 'gitdir: .git');
      expect(resolveStandardsTarget({
        workspaceRoot: tmp,
        requestedRoot: tmp,
        repo: null,
        targetKind: 'auto',
      })).toEqual(expect.objectContaining({
        kind: 'repo',
        reasonCode: 'cwd-git-root',
      }));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('resolveStandardsTarget returns explicit-workspace-target with targetKind workspace and no children', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-explicit-ws-'));
    try {
      // 无子 git repo，但显式指定 workspace
      expect(resolveStandardsTarget({
        workspaceRoot: tmp,
        requestedRoot: tmp,
        repo: null,
        targetKind: 'workspace',
      })).toEqual(expect.objectContaining({
        kind: 'workspace',
        reasonCode: 'explicit-workspace-target',
        workspaceChildren: [],
      }));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('repo selector rejects non-git children and symlink escapes', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-repo-boundary-'));
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-outside-'));
    try {
      writeFile(tmp, 'packages/app/package.json', JSON.stringify({ name: 'not-a-repo' }));
      writeFile(outside, '.git/HEAD', 'ref: refs/heads/main\n');

      expect(() => prepareBaseline({
        root: tmp,
        repo: 'packages/app',
        dryRun: true,
      })).toThrow('--repo must select a child Git repo root: packages/app');

      let symlinkCreated1 = false;
      try {
        fs.symlinkSync(outside, path.join(tmp, 'linked-outside'), 'dir');
        symlinkCreated1 = true;
      } catch (_error) {
        // 当前环境不支持 symlink，跳过安全断言
      }
      if (symlinkCreated1) {
        expect(() => prepareBaseline({
          root: tmp,
          repo: 'linked-outside',
          dryRun: true,
        })).toThrow('--repo target must stay inside the workspace root after resolving symlinks: linked-outside');
        expect(fs.existsSync(path.join(outside, '.spec-first/standards/project-shape.json'))).toBe(false);
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  test('standards output path cannot escape selected authority boundaries', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-output-boundary-'));
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-output-outside-'));
    try {
      writeFile(tmp, 'services/api/.git/HEAD', 'ref: refs/heads/main\n');
      writeFile(tmp, 'services/api/package.json', JSON.stringify({ name: 'api-service' }));

      expect(() => prepareBaseline({
        root: tmp,
        output: 'services/api/.spec-first/standards',
        mode: 'baseline',
        dryRun: false,
      })).toThrow('--output cannot be used when auto-detected parent workspace batches child standards baselines');
      expect(fs.existsSync(path.join(tmp, 'services/api/.spec-first/standards/project-shape.json'))).toBe(false);

      expect(() => prepareBaseline({
        root: tmp,
        repo: 'services/api',
        output: path.join(outside, 'standards'),
        mode: 'baseline',
        dryRun: true,
      })).toThrow('--output must stay inside the selected repo root.');

      let symlinkCreated2 = false;
      try {
        fs.symlinkSync(outside, path.join(tmp, 'services/api/.spec-first'), 'dir');
        symlinkCreated2 = true;
      } catch (_error) {
        // 当前环境不支持 symlink，跳过安全断言
      }
      if (symlinkCreated2) {
        expect(() => prepareBaseline({
          root: tmp,
          repo: 'services/api',
          mode: 'baseline',
          dryRun: true,
        })).toThrow('--output must stay inside the selected repo root.');
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  test('workspace default quick freshness writes child-local update decisions', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-workspace-quick-'));
    try {
      writeFile(tmp, 'services/api/.git/HEAD', 'ref: refs/heads/main\n');
      writeFile(tmp, 'services/api/package.json', JSON.stringify({ name: 'api-service' }));

      prepareBaseline({
        root: tmp,
        mode: 'baseline',
        dryRun: false,
      });
      writeFile(tmp, 'services/api/src/server.js', "'use strict';\n");
      prepareBaseline({
        root: tmp,
        mode: 'quick',
        dryRun: false,
      });

      const decision = readJson(path.join(tmp, 'services/api/.spec-first/standards/standards-update-decision.json'));
      expect(decision.recommendation).toBe('refresh');
      expect(decision.reason_codes).toContain('inventory-hash-changed');
      expect(fs.existsSync(path.join(tmp, '.spec-first/standards/standards-update-decision.json'))).toBe(false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('workspace quick with no file changes recommends reuse-current-baseline', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-workspace-quick-reuse-'));
    try {
      writeFile(tmp, 'services/api/.git/HEAD', 'ref: refs/heads/main\n');
      writeFile(tmp, 'services/api/package.json', JSON.stringify({ name: 'api-service' }));

      // 先写入 baseline
      prepareBaseline({
        root: tmp,
        mode: 'baseline',
        dryRun: false,
      });
      // standards-candidates.json 和 standards-preview.md 由 LLM 写入，手动模拟
      const standardsDir = path.join(tmp, 'services/api/.spec-first/standards');
      writeFile(tmp, 'services/api/.spec-first/standards/standards-candidates.json', JSON.stringify({ schema_version: 'v1', items: [] }));
      writeFile(tmp, 'services/api/.spec-first/standards/standards-preview.md', '# Preview\n');

      // 无文件变更立即再次 quick 运行
      prepareBaseline({
        root: tmp,
        mode: 'quick',
        dryRun: false,
      });

      const decision = readJson(path.join(standardsDir, 'standards-update-decision.json'));
      expect(decision.recommendation).toBe('reuse-current-baseline');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('explicit workspace child repo samples stay consistently bounded across advisory artifacts', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-workspace-truncated-'));
    try {
      for (let index = 0; index < 22; index += 1) {
        const name = `repo-${String(index).padStart(2, '0')}`;
        writeFile(tmp, `${name}/.git/HEAD`, 'ref: refs/heads/main\n');
        writeFile(tmp, `${name}/package.json`, JSON.stringify({ name }));
      }

      prepareBaseline({
        root: tmp,
        targetKind: 'workspace',
        mode: 'baseline',
        dryRun: false,
      });

      const projectShape = readJson(path.join(tmp, '.spec-first/standards/project-shape.json'));
      const standardsPlan = readJson(path.join(tmp, '.spec-first/standards/standards-plan.json'));
      const glueMap = readJson(path.join(tmp, '.spec-first/standards/glue-map.json'));
      const workspaceCapability = glueMap.capabilities.find((item) => item.id === 'capability.workspace.child-repo-map');

      expect(projectShape.workspace.child_repo_count).toBe(22);
      expect(projectShape.workspace.child_repos).toHaveLength(20);
      expect(projectShape.workspace.child_repos_truncated).toBe(true);
      expect(standardsPlan.scope.workspace.child_repo_count).toBe(22);
      expect(standardsPlan.scope.workspace.child_repos).toHaveLength(20);
      expect(standardsPlan.scope.workspace.child_repos_truncated).toBe(true);
      expect(workspaceCapability.entrypoints).toHaveLength(20);
      expect(workspaceCapability.child_repo_count).toBe(22);
      expect(workspaceCapability.child_repos_truncated).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('workspace discovery skips internal worktree directories', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-worktrees-skip-'));
    try {
      writeFile(tmp, '.worktrees/feature/.git/HEAD', 'ref: refs/heads/main\n');
      writeFile(tmp, 'services/api/.git/HEAD', 'ref: refs/heads/main\n');

      expect(discoverChildGitRepos(tmp).map((child) => child.workspace_relative_path)).toEqual([
        'services/api',
      ]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('workspace discovery deduplicates nested repos — inner repo is excluded', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-nested-dedup-'));
    try {
      // 外层 git repo
      writeFile(tmp, 'repos/parent/.git/HEAD', 'ref: refs/heads/main\n');
      // 嵌套在外层 repo 内的 git submodule
      writeFile(tmp, 'repos/parent/submod/.git/HEAD', 'ref: refs/heads/main\n');

      const discovered = discoverChildGitRepos(tmp).map((child) => child.workspace_relative_path);
      // 内层 repos/parent/submod 应被去重，不出现在结果中
      expect(discovered).toContain('repos/parent');
      expect(discovered).not.toContain('repos/parent/submod');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('dry-run does not write baseline artifacts', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-dry-run-'));
    try {
      writeFile(tmp, 'package.json', JSON.stringify({ name: 'dry-run-project' }));

      const result = prepareBaseline({
        root: tmp,
        output: path.join(tmp, '.spec-first/standards'),
        mode: 'baseline',
        dryRun: true,
      });

      expect(result.dry_run).toBe(true);
      expect(result.artifacts).toEqual([
        '.spec-first/standards/project-shape.json',
        '.spec-first/standards/standards-plan.json',
        '.spec-first/standards/glue-map.json',
      ]);
      expect(fs.existsSync(path.join(tmp, '.spec-first/standards'))).toBe(false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('quick mode writes a deterministic update decision only', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-quick-'));
    try {
      writeFile(tmp, 'package.json', JSON.stringify({ name: 'quick-project' }));

      const result = prepareBaseline({
        root: tmp,
        output: path.join(tmp, '.spec-first/standards'),
        mode: 'quick',
        dryRun: false,
      });

      expect(result.mode).toBe('quick');
      expect(result.artifacts).toEqual([
        '.spec-first/standards/standards-update-decision.json',
      ]);
      expect(fs.existsSync(path.join(tmp, '.spec-first/standards/standards-update-decision.json'))).toBe(true);
      expect(fs.existsSync(path.join(tmp, '.spec-first/standards/project-shape.json'))).toBe(false);

      const decision = readJson(path.join(tmp, '.spec-first/standards/standards-update-decision.json'));
      expect(decision.schema_version).toBe('spec-first.standards-update-decision.v1');
      expect(decision.mode).toBe('quick');
      expect(decision.recommendation).toBe('run-baseline');
      expect(decision.reason_codes).toContain('missing-fact-artifacts');
      expect(decision.current_inventory_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('refresh mode scopes the plan and emits a refresh decision', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-refresh-'));
    try {
      writeFile(tmp, 'package.json', JSON.stringify({ name: 'refresh-project' }));
      writeFile(tmp, 'src/db/migrate/001.sql', 'create table users(id integer);\n');

      const result = prepareBaseline({
        root: tmp,
        output: path.join(tmp, '.spec-first/standards'),
        mode: 'refresh',
        domains: ['database'],
        modules: ['src/db'],
        dryRun: false,
      });

      expect(result.mode).toBe('refresh');
      expect(result.scope.domains).toEqual(['database']);
      expect(result.artifacts).toEqual(expect.arrayContaining([
        '.spec-first/standards/standards-update-decision.json',
      ]));

      const standardsPlan = readJson(path.join(tmp, '.spec-first/standards/standards-plan.json'));
      const projectShape = readJson(path.join(tmp, '.spec-first/standards/project-shape.json'));
      const decision = readJson(path.join(tmp, '.spec-first/standards/standards-update-decision.json'));
      expect(standardsPlan.mode).toBe('refresh');
      expect(standardsPlan.scope_plan.global.domains).toEqual(['database']);
      expect(standardsPlan.scope_plan.modules).toEqual(['src/db']);
      expect(projectShape.module_detection).toEqual({
        status: 'requested',
        requested_modules: ['src/db'],
        detected_count: 1,
        unavailable_modules: [],
        limitations: [],
      });
      expect(projectShape.modules).toEqual([
        expect.objectContaining({
          path: 'src/db',
          status: 'detected',
          detected_type: 'database_module',
          evidence: [expect.objectContaining({
            reason_code: 'requested-module-scan',
            file_count: 1,
          })],
        }),
      ]);
      expect(standardsPlan.tasks).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: 'refresh.database',
          action: 'refresh_candidates_from_bounded_scope',
          owner: 'llm',
        }),
      ]));
      expect(decision.recommendation).toBe('refresh-requested');
      expect(decision.reason_codes).toContain('explicit-refresh-request');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('deep mode enables deep budgets and writes a graph query index', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-deep-'));
    try {
      writeFile(tmp, 'package.json', JSON.stringify({ name: 'deep-project' }));
      writeFile(tmp, 'bin/spec-first.js', '#!/usr/bin/env node\n');
      writeFile(tmp, 'src/cli/index.js', "'use strict';\n");
      writeFile(tmp, '.spec-first/graph/graph-facts.json', '{}\n');

      const result = prepareBaseline({
        root: tmp,
        output: path.join(tmp, '.spec-first/standards'),
        mode: 'deep',
        domains: ['cli', 'graph'],
        dryRun: false,
      });

      expect(result.mode).toBe('deep');
      expect(result.artifacts).toEqual(expect.arrayContaining([
        '.spec-first/standards/graph-query-index.json',
      ]));

      const standardsPlan = readJson(path.join(tmp, '.spec-first/standards/standards-plan.json'));
      const queryIndex = readJson(path.join(tmp, '.spec-first/standards/graph-query-index.json'));
      expect(standardsPlan.budget.allow_multi_agent).toBe(true);
      expect(standardsPlan.budget.allow_raw_source_context).toBe(true);
      expect(standardsPlan.budget.allow_deep_graph_queries).toBe(true);
      expect(standardsPlan.dispatch.mode).toBe('multi_lens_review');
      expect(queryIndex.schema_version).toBe('spec-first.standards-graph-query-index.v1');
      expect(queryIndex.planned_queries.map((query) => query.domain)).toEqual(expect.arrayContaining(['cli', 'graph']));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('import-source writes import lock and marks shared standards as imported', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-import-project-'));
    const source = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-import-source-'));
    try {
      writeFile(tmp, 'package.json', JSON.stringify({ name: 'import-project' }));
      writeFile(source, 'backend.md', '# Backend Standards\n\nUse explicit service boundaries.\n');

      const result = prepareBaseline({
        root: tmp,
        output: path.join(tmp, '.spec-first/standards'),
        mode: 'baseline',
        importSource: source,
        dryRun: false,
      });

      expect(result.artifacts).toEqual(expect.arrayContaining([
        '.spec-first/standards/standards-sources.json',
        '.spec-first/standards/import-lock.json',
        '.spec-first/standards/imported-standards.json',
      ]));

      const importLock = readJson(path.join(tmp, '.spec-first/standards/import-lock.json'));
      const imported = readJson(path.join(tmp, '.spec-first/standards/imported-standards.json'));
      const standardsPlan = readJson(path.join(tmp, '.spec-first/standards/standards-plan.json'));
      expect(importLock.schema_version).toBe('spec-first.standards-import-lock.v1');
      expect(importLock.source.status).toBe('available');
      expect(imported.schema_version).toBe('spec-first.imported-standards.v1');
      expect(imported.alignment_required).toBe(true);
      expect(imported.eligible_for_repo_profile_writeback).toBe(false);
      expect(imported.items).toEqual([
        expect.objectContaining({
          id: 'imported.backend-md',
          title: 'Backend Standards',
          status: 'imported',
          source_type: 'shared_standard_imported',
        }),
      ]);
      expect(standardsPlan.tasks).toEqual(expect.arrayContaining([
        expect.objectContaining({
          domain: 'shared_standards',
          action: 'align_imported_standards_with_project_shape',
          owner: 'llm',
        }),
      ]));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
      fs.rmSync(source, { recursive: true, force: true });
    }
  });

  test('import-source records unavailable git remotes without fetching', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-import-remote-'));
    try {
      writeFile(tmp, 'package.json', JSON.stringify({ name: 'remote-import-project' }));

      prepareBaseline({
        root: tmp,
        output: path.join(tmp, '.spec-first/standards'),
        mode: 'baseline',
        importSource: 'https://example.com/team/shared-standards.git',
        dryRun: false,
      });

      const importLock = readJson(path.join(tmp, '.spec-first/standards/import-lock.json'));
      const imported = readJson(path.join(tmp, '.spec-first/standards/imported-standards.json'));
      expect(importLock.source.type).toBe('git_remote');
      expect(importLock.source.status).toBe('unavailable');
      expect(importLock.source.reason_code).toBe('remote-fetch-not-performed');
      expect(imported.items).toEqual([]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('CLI rejects unsupported modes and malformed arguments', () => {
    const cases = [
      {
        args: ['--mode', 'unsupported', '--dry-run'],
        message: 'Unsupported mode for deterministic standards preparation: unsupported',
      },
      {
        args: ['--quick', '--deep', '--dry-run'],
        message: 'Conflicting standards modes: quick and deep cannot be combined.',
      },
      {
        args: ['--unknown'],
        message: 'Unknown argument: --unknown',
      },
      {
        args: ['--root'],
        message: '--root requires a value.',
      },
      {
        args: ['--repo', '/tmp/outside', '--dry-run'],
        message: '--repo must be a workspace-relative child repo path',
      },
      {
        args: ['--repo', '../outside', '--dry-run'],
        message: '--repo must not traverse outside the workspace root: ../outside',
      },
      {
        args: ['--repo', '.', '--dry-run'],
        message: '--repo must select a child Git repo path, not the workspace root: .',
      },
      {
        args: ['--repo', 'packages/app', '--workspace', '--dry-run'],
        message: '--repo cannot be combined with --workspace or --target-kind workspace.',
      },
      {
        args: ['--repo', 'packages/app', '--target-kind', 'workspace', '--dry-run'],
        message: '--repo cannot be combined with --workspace or --target-kind workspace.',
      },
      {
        args: ['--workspace', '--target-kind', 'repo', '--dry-run'],
        message: 'Conflicting standards target kinds: workspace and repo cannot be combined.',
      },
      {
        args: ['--target-kind', 'repo', '--workspace', '--dry-run'],
        message: 'Conflicting standards target kinds: repo and workspace cannot be combined.',
      },
    ];

    for (const testCase of cases) {
      const result = spawnSync(process.execPath, [SCRIPT_PATH, ...testCase.args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      });

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(testCase.message);
    }
  });

  test('argument parser accepts public standards modes and scoped inputs', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-parse-args-'));
    try {
      writeFile(tmp, 'packages/app/.git/HEAD', 'ref: refs/heads/main\n');

      const args = parseArgs([
        '--root',
        tmp,
        '--refresh',
        '--domain',
        'cli',
        '--module',
        'src/cli',
        '--repo',
        './packages/./app',
        '--import-source',
        './standards',
        '--target-kind',
        'repo',
        '--dry-run',
      ]);

      expect(args.mode).toBe('refresh');
      expect(args.domains).toEqual(['cli']);
      expect(args.modules).toEqual(['src/cli']);
      expect(args.repo).toBe('packages/app');
      expect(args.targetKind).toBe('workspace_child_repo');
      expect(args.requestedTargetKind).toBe('repo');
      expect(args.importSource).toBe('./standards');
      expect(args.dryRun).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('generated standards artifacts and tool indexes do not affect project-shape facts', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-ignore-'));
    try {
      writeFile(tmp, 'package.json', JSON.stringify({ name: 'ignore-project' }));
      writeFile(tmp, '.gitnexus/meta.json', '{}\n');
      writeFile(tmp, '.spec-first/standards/project-shape.json', '{}\n');
      writeFile(tmp, '.spec-first/standards/raw/Foo.swift', 'struct Foo {}\n');

      const inventory = buildInventory(tmp);
      const projectShape = buildProjectShape(tmp, inventory);

      expect(inventory.files).not.toContain('.gitnexus/meta.json');
      expect(inventory.files).not.toContain('.spec-first/standards/project-shape.json');
      expect(inventory.files).not.toContain('.spec-first/standards/raw/Foo.swift');
      expect(projectShape.domains.mobile.detected).toBe(false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('inventory scan is lexical and marks truncated hashes as partial evidence', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-inventory-'));
    try {
      writeFile(tmp, 'z-last.js', "'use strict';\n");
      writeFile(tmp, 'a-first.js', "'use strict';\n");
      writeFile(tmp, 'm-middle.js', "'use strict';\n");

      const inventory = buildInventory(tmp, { maxFiles: 2 });
      const projectShape = buildProjectShape(tmp, inventory);

      expect(inventory.files).toEqual(['a-first.js', 'm-middle.js']);
      expect(inventory.truncated).toBe(true);
      expect(inventory.scan).toEqual({
        max_files: 2,
        scanned_file_count: 2,
        truncated: true,
        hash_reliability: 'partial',
        ordering: 'lexical',
      });
      expect(projectShape.scan.hash_reliability).toBe('partial');
      expect(projectShape.evidence.inventory_hash_reliability).toBe('partial');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('spec-standards CLI scripts keep executable syntax and help output', () => {
    const targetingCheck = spawnSync(process.execPath, ['--check', TARGETING_SCRIPT_PATH], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    expect(targetingCheck.status).toBe(0);
    const workspaceFactsCheck = spawnSync(process.execPath, ['--check', WORKSPACE_FACTS_SCRIPT_PATH], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    expect(workspaceFactsCheck.status).toBe(0);

    const scripts = [
      [SCRIPT_PATH, 'Prepare deterministic spec-standards facts.'],
      [VALIDATOR_SCRIPT_PATH, 'Validate generated spec-standards candidates and preview artifacts.'],
    ];

    for (const [scriptPath, expectedHelp] of scripts) {
      const check = spawnSync(process.execPath, ['--check', scriptPath], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      });
      expect(check.status).toBe(0);

      const help = spawnSync(process.execPath, [scriptPath, '--help'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      });
      expect(help.status).toBe(0);
      expect(help.stdout).toContain('Usage');
      expect(help.stdout).toContain(expectedHelp);
    }
  });

  test('docs, agents, and parser fixtures do not activate product database or mobile domains', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-domain-negative-'));
    try {
      writeFile(tmp, 'package.json', JSON.stringify({ name: 'domain-negative-project' }));
      writeFile(tmp, 'docs/plans/database-migration-plan.md', '# Migration plan\n');
      writeFile(tmp, 'agents/spec-data-migrations-reviewer.agent.md', '# Reviewer\n');
      writeFile(tmp, 'tests/fixtures/parser/kotlin/Main.kt', 'class Main\n');
      writeFile(tmp, 'tests/fixtures/parser/swift/App.swift', 'struct App {}\n');

      const inventory = buildInventory(tmp);
      const projectShape = buildProjectShape(tmp, inventory);
      const standardsPlan = buildStandardsPlan(projectShape, inventory);

      expect(projectShape.domains.database.detected).toBe(false);
      expect(projectShape.domains.mobile.detected).toBe(false);
      expect(standardsPlan.scope_plan.global.domains).not.toContain('database');
      expect(standardsPlan.scope_plan.global.domains).not.toContain('mobile');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('generic CLI projects do not receive spec-first runtime-sync glue capability', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-standards-generic-cli-'));
    try {
      writeFile(tmp, 'package.json', JSON.stringify({ name: 'generic-cli-project' }));
      writeFile(tmp, 'bin/generic-cli.js', '#!/usr/bin/env node\n');
      writeFile(tmp, 'src/cli/index.js', "'use strict';\n");

      const inventory = buildInventory(tmp);
      const projectShape = buildProjectShape(tmp, inventory);
      const glueMap = buildGlueMap(projectShape, inventory);

      expect(projectShape.domains.cli.detected).toBe(true);
      expect(glueMap.capabilities.map((capability) => capability.id)).not.toContain('capability.cli.runtime-sync');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
