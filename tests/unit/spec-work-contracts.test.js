'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'spec-work', 'SKILL.md');
const SHIPPING_WORKFLOW_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-work',
  'references',
  'shipping-workflow.md',
);

describe('spec-work context orientation contract', () => {
  test('uses plan/task-pack guided direct reads without retired graph hooks', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');
    expect(text).toContain('Context Orientation Anchor');
    expect(text).toContain('the plan or task pack');
    expect(text).toContain('nearby implementation files');
    expect(text).toContain('nearby tests');
    expect(text).toContain('git diff or changed files');
    expect(text).toContain('prefer live MCP evidence for concrete execution questions');
    expect(text).toContain('fall back to bounded direct repo reads');
    expect(text).toContain('they do not update compiled `query_ready`');
    expect(text).toContain('definitions-only evidence');
    expect(text).toContain('local file/symbol pointers');
    expect(text).toContain('Scope expansion is judged against the plan/task pack and concrete diff');
    expect(text).toContain('Workspace Repo Scope');
    expect(text).toContain('workspace-graph-targets.v1');
    expect(text).toContain('bounded candidate repos');
    expect(text).toContain('GitNexus-first evidence per candidate');
    expect(text).toContain('degraded-fallback');
    expect(text).toContain('single `target_repo` or per-unit/per-task `target_repo`');
    expect(text).toContain('actual `git status` changes belong to the selected child repo');
    expect(text).not.toContain('spec-first ' + 'crg hook');
    expect(text).not.toContain('$spec-' + 'graph' + '-bootstrap');
    expect(text).not.toContain('/spec:' + 'graph' + '-bootstrap');
    expect(text).not.toContain('stage0-context');
    expect(text).not.toContain('selected_assets');
  });
});

describe('spec-work run artifact boundary contract', () => {
  test('does not claim planned run artifact schema as current runtime truth', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Run Artifact Boundary');
    expect(text).toContain('docs-side planned contract');
    expect(text).toContain('does not currently write');
    expect(text).toContain('.spec-first/workflows/spec-work/<workspace-slug>/<run-id>/run.json');
    expect(text).toContain('Do not claim this artifact exists');
  });
});

describe('spec-work requirements and shipping policy contract', () => {
  test('reads Requirements as the current plan section while preserving legacy compatibility', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');
    const shipping = fs.readFileSync(SHIPPING_WORKFLOW_PATH, 'utf8');

    expect(text).toContain('`Requirements` (or legacy `Requirements Trace`)');
    expect(text).toContain('Quality Check and Finishing Work');
    expect(text).toContain('you must read `references/shipping-workflow.md`');
    expect(text).toContain('Do not skip this.');
    expect(shipping).toContain('If the plan has a `Requirements` section (or legacy `Requirements Trace`)');
  });

  test('shipping review tiers use real host-native review or spec-code-review fallback', () => {
    const shipping = fs.readFileSync(SHIPPING_WORKFLOW_PATH, 'utf8');

    expect(shipping).toContain('Tier 1 -- host-native code review');
    expect(shipping).toContain('real built-in code review command or skill');
    expect(shipping).toContain('Do not treat ordinary self-review as Tier 1.');
    expect(shipping).toContain('Tier 2 -- `spec-code-review`');
    expect(shipping).toContain('No host-native review exists');
    expect(shipping).toContain('Sensitive surface touched');
    expect(shipping).toContain('Large and diffuse change');
    expect(shipping).toContain('Very large change');
    expect(shipping).toContain('Plan or task explicitly requests it');
    expect(shipping).toContain('Code review completed (Tier 1 host-native or Tier 2 `spec-code-review`)');
    expect(shipping).not.toContain('inline self-review');
    expect(shipping).not.toContain('/simplify');
    expect(shipping).not.toContain('ce-simplify-code');
    expect(shipping).not.toContain('spec-simplify-code');
    expect(shipping).not.toContain('ce-code-review');
  });
});

describe('spec-work task-pack identity contract', () => {
  test('rejects missing or mismatched spec_id before creating execution tasks', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('read `spec_id` from the task pack and source plan');
    expect(text).toContain('If the task pack lacks `spec_id`, stop as missing identity');
    expect(text).toContain('reject the task pack as wrong-chain handoff before implementation');
    expect(text).toContain('missing-spec-id, spec-id-mismatch');
    expect(text).toContain('Do not treat it as execution state or completion status');
  });

  test('keeps validated task packs as first-class executable work documents', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Treat a validated task pack as a first-class executable work document.');
    expect(text).toContain('The task pack supplies execution order, task boundaries, file focus, `stop_if`, and validation notes');
    expect(text).toContain('If the work document is already a validated task pack, do not offer task compilation again');
    expect(text).toContain('do not rebuild execution structure from the source plan');
    expect(text).toContain('Execute from the task pack\'s validated task structure');
    expect(text).toContain('Requires plan-unit metadata or validated task-card metadata');
    expect(text).toContain('The full work-document path. If it is a task pack, also pass the `source_plan` path');
    expect(text).toContain('task-card equivalents (`task_id`, `dependencies`, `wave`, `files`, `test_focus`, `done_signal`, `stop_if`)');
    expect(text).toContain('Read any referenced files from the plan, task pack, or discovered during Phase 0');
    expect(text).toContain('If the work document is a task pack, use `Task Cards`, `Execution Waves`, `dependencies`, and `task_id`');
  });
});

describe('spec-work subagent isolation contract', () => {
  test('uses a host capability matrix instead of assuming shared-directory or worktree behavior', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Host capability matrix');
    expect(text).toContain('Claude Code `Agent` with worktree isolation');
    expect(text).toContain('Pass `isolation: "worktree"` and `run_in_background: true`');
    expect(text).toContain('Codex `spawn_agent` / forked workspace');
    expect(text).toContain('Do not pass or claim Claude\'s `isolation: "worktree"` parameter');
    expect(text).toContain('If files overlap, dispatch serially');
    expect(text).toContain('Shared-directory fallback constraints');
    expect(text).toContain('worktree-isolated mode');
    expect(text).toContain('git worktree remove <absolute-path>');
    expect(text).toContain('Shared-directory fallback or Codex fork-workspace handoff');
  });
});

describe('spec-work host entrypoint contract', () => {
  test('routes oversized work back through the current host entrypoint', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Oversized intake and handoff');
    expect(text).toContain('current host\'s brainstorm or plan entrypoint');
    expect(text).toContain('If the input is a bare prompt and the product WHAT is unclear, recommend the current host\'s brainstorm entrypoint');
    expect(text).toContain('If the desired outcome is clear but no settled plan exists, return to the current host\'s plan entrypoint');
    expect(text).toContain('offer the standalone `spec-write-tasks` diversion once');
    expect(text).toContain('Do not describe task compilation as a command-backed workflow entrypoint');
    expect(text).toContain('If execution discovers scope beyond the plan/task pack');
    expect(text).toContain('Do not expand scope in place.');
    expect(text).toContain('Do not invent human-time phases');
    expect(text).not.toContain('would benefit from `/spec:brainstorm` or `/spec:plan`');
    expect(text).not.toContain('return to `/spec:plan` to reduce scope');
    expect(text).not.toContain('/spec:brainstorm` / `/spec:plan` on Claude Code');
    expect(text).not.toContain('$spec-brainstorm` / `$spec-plan` on Codex');
    expect(text).not.toContain('current host\'s plan entrypoint (`/spec:plan` on Claude Code, `$spec-plan` on Codex)');
    expect(text).not.toContain('/spec:write-tasks');
    expect(text).not.toContain('/spec:spec-write-tasks');
    expect(text).not.toContain('$spec-write-tasks');
  });
});
