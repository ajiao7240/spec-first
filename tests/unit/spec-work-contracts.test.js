'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'spec-work', 'SKILL.md');

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

describe('spec-work task-pack identity contract', () => {
  test('rejects missing or mismatched spec_id before creating execution tasks', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('read `spec_id` from the task pack and source plan');
    expect(text).toContain('If the task pack lacks `spec_id`, stop as missing identity');
    expect(text).toContain('reject the task pack as wrong-chain handoff before implementation');
    expect(text).toContain('missing-spec-id, spec-id-mismatch');
    expect(text).toContain('Do not treat it as execution state or completion status');
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

    expect(text).toContain('current host\'s brainstorm or plan entrypoint');
    expect(text).not.toContain('would benefit from `/spec:brainstorm` or `/spec:plan`');
    expect(text).not.toContain('return to `/spec:plan` to reduce scope');
    expect(text).not.toContain('/spec:brainstorm` / `/spec:plan` on Claude Code');
    expect(text).not.toContain('$spec-brainstorm` / `$spec-plan` on Codex');
    expect(text).not.toContain('current host\'s plan entrypoint (`/spec:plan` on Claude Code, `$spec-plan` on Codex)');
  });
});
