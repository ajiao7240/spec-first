'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

describe('spec-compound contracts', () => {
  test('spec-compound restores explicit full/lightweight mode selection and session historian flow', () => {
    const skill = read('skills/spec-compound/SKILL.md');

    expect(skill).toContain('# Spec-First Compound');
    expect(skill).toContain('Claude: /spec:compound [brief context]');
    expect(skill).toContain('Codex:  $spec-compound [brief context]');
    expect(skill).toContain('1. Full (recommended)');
    expect(skill).toContain('2. Lightweight');
    expect(skill).toContain('Would you also like to search your [harness name] session history');
    expect(skill).toContain('spec-first:research:session-historian');
    expect(skill).toContain('Knowledge track output sections');
    expect(skill).toContain('What Didn\'t Work** section (bug track) or **Context** section (knowledge track)');
    expect(skill).toContain('`spec-sessions` workflow');
    expect(skill).not.toContain('# /compound');
    expect(skill).not.toContain('/research [topic]');
  });

  test('compound schemas and templates are dual-track aware', () => {
    const compoundSchema = read('skills/spec-compound/references/schema.yaml');
    const refreshSchema = read('skills/spec-compound-refresh/references/schema.yaml');
    const compoundTemplate = read('skills/spec-compound/assets/resolution-template.md');
    const refreshTemplate = read('skills/spec-compound-refresh/assets/resolution-template.md');

    for (const schema of [compoundSchema, refreshSchema]) {
      expect(schema).toContain('tracks:');
      expect(schema).toContain('track_rules:');
      expect(schema).toContain('knowledge:');
      expect(schema).toContain('applies_when:');
    }

    for (const template of [compoundTemplate, refreshTemplate]) {
      expect(template).toContain('## Bug Track Template');
      expect(template).toContain('## Knowledge Track Template');
      expect(template).toContain('## Context');
      expect(template).toContain('## Guidance');
    }
  });

  test('learnings-researcher treats critical-patterns as optional input', () => {
    const agent = read('agents/research/learnings-researcher.md');

    expect(agent).toContain('If `docs/solutions/patterns/critical-patterns.md` exists');
    expect(agent).toContain('Missing this file is not an error');
    expect(agent).toContain('applies_when');
  });
});
