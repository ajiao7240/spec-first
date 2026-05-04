'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  buildGlueMap,
  buildInventory,
  buildProjectShape,
  buildStandardsPlan,
  parseArgs,
  prepareBaseline,
} = require('../../skills/spec-standards/scripts/prepare-baseline');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/spec-standards/SKILL.md');
const SCRIPT_PATH = path.join(REPO_ROOT, 'skills/spec-standards/scripts/prepare-baseline.js');
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
    expect(skill).toContain('Graph-backed Project Standards & Glue Compiler');
    expect(skill).toContain('Invocation Boundary');
    expect(skill).toContain('not an agent type');
    expect(skill).toContain('Scripts prepare facts; the LLM decides standards.');
    expect(skill).toContain('Preview before writeback.');
    expect(skill).toContain('Observed is not confirmed.');
    expect(skill).toContain('Do not write `repo-profile.yaml`.');
    expect(skill).toContain('`--repo <child>` selects the child repo as the target repo root');
    expect(skill).toContain('synthesis_contract.candidate_required_fields');
    expect(skill).toContain('spec-first.standards-candidates.v1');
    expect(skill).toContain('Confirmed standards are the only hard constraints.');
    expect(skill).toContain('Default mode. Prepare a first project baseline');
    expect(skill).toContain('.spec-first/standards/project-shape.json');
    expect(skill).toContain('.spec-first/standards/standards-plan.json');
    expect(skill).toContain('.spec-first/standards/glue-map.json');
    expect(skill).toContain('.spec-first/standards/standards-candidates.json');
    expect(skill).toContain('.spec-first/standards/standards-preview.md');
    expect(skill).toContain('node skills/spec-standards/scripts/prepare-baseline.js --mode <baseline|quick|refresh|deep>');
    expect(skill).toContain('Shared standards do not become project policy on import');
    expect(skill).toContain('Supported Modes');
    expect(skill).toContain('`--quick`');
    expect(skill).toContain('`--refresh`');
    expect(skill).toContain('`--deep`');
    expect(skill).toContain('`--import-source <git-or-path>`');
    expect(skill).toContain('Default answer must be "not modified"');
  });

  test('Claude command template is metadata-only and delegates behavior to the skill', () => {
    const template = read(COMMAND_TEMPLATE_PATH);

    expect(template).toContain('description: "Compile project standards and glue capability baseline artifacts"');
    expect(template).toContain('argument-hint: "[--baseline|--quick|--refresh|--deep] [--import-source <git-or-path>]"');
    expect(template).toContain('This source template defines Claude command metadata only.');
    expect(template).toContain('skills/spec-standards/SKILL.md');
    expect(template).toContain('Edit the paired skill to change workflow behavior.');
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
      expect(projectShape.evidence.inventory_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
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
      const decision = readJson(path.join(tmp, '.spec-first/standards/standards-update-decision.json'));
      expect(standardsPlan.mode).toBe('refresh');
      expect(standardsPlan.scope_plan.global.domains).toEqual(['database']);
      expect(standardsPlan.scope_plan.modules).toEqual(['src/db']);
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
        args: ['--repo', '../outside', '--dry-run'],
        message: '--repo must not traverse outside the workspace root: ../outside',
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
    const args = parseArgs([
      '--refresh',
      '--domain',
      'cli',
      '--module',
      'src/cli',
      '--repo',
      'packages/app',
      '--import-source',
      './standards',
      '--dry-run',
    ]);

    expect(args.mode).toBe('refresh');
    expect(args.domains).toEqual(['cli']);
    expect(args.modules).toEqual(['src/cli']);
    expect(args.repo).toBe('packages/app');
    expect(args.importSource).toBe('./standards');
    expect(args.dryRun).toBe(true);
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
