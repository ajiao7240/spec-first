'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'spec-debug', 'SKILL.md');

describe('spec-debug branch-aware handoff contract', () => {
  test('uses workspace graph targets only for read-only debugging evidence', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Context Orientation Anchor');
    expect(text).toContain('workspace-graph-targets.v1');
    expect(text).toContain('GitNexus-first queries');
    expect(text).toContain('degraded-fallback');
    expect(text).toContain('definitions-only GitNexus results as file/symbol pointers');
    expect(text).toContain('single explicit `target_repo` or per-fix repo scope');
    expect(text).toContain('do not let cwd, graph target facts, or live MCP results choose a sibling repo for edits');
  });

  test('skill-owned branches default to commit-and-PR with explicit override checks', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Skill-owned branch: default to commit-and-PR without prompting');
    expect(text).toContain('Check contextual overrides first');
    expect(text).toContain('AGENTS.md');
    expect(text).toContain('CLAUDE.md');
    expect(text).toContain('Run `git-commit-push-pr`');
    expect(text).toContain('Pre-existing branch: ask the user');
  });

  test('compound capture is offered only for generalizable lessons', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('After a PR is open: consider offering learning capture');
    expect(text).toContain('Skip silently');
    expect(text).toContain('fix is mechanical');
    expect(text).toContain('Offer neutrally');
    expect(text).toContain('Lean into the offer');
    expect(text).toContain('pattern appears in 3+ locations');
    expect(text).toContain('run `spec-compound`');
  });

  test('design rethinking handoff uses the current host brainstorm entrypoint', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('current host\'s brainstorm entrypoint');
    expect(text).not.toContain('**Rethink the design** (`/spec:brainstorm`)');
    expect(text).not.toContain('suggest `/spec:brainstorm`');
    expect(text).not.toContain('transferred to `/spec:brainstorm`');
    expect(text).not.toContain('/spec:brainstorm` on Claude Code');
    expect(text).not.toContain('$spec-brainstorm` on Codex');
  });
});
