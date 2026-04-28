'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'spec-debug', 'SKILL.md');

describe('spec-debug branch-aware handoff contract', () => {
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
    expect(text).toContain('/spec:brainstorm` on Claude Code');
    expect(text).toContain('$spec-brainstorm` on Codex');
    expect(text).not.toContain('**Rethink the design** (`/spec:brainstorm`)');
    expect(text).not.toContain('suggest `/spec:brainstorm`');
    expect(text).not.toContain('transferred to `/spec:brainstorm`');
  });
});
