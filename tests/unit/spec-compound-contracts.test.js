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
    expect(skill).toContain('quality-feedback-topics.json');
    expect(skill).toContain('candidate_topics');
    expect(skill).toContain('supplementary hints, not primary evidence');
    expect(skill).toContain('Knowledge track output sections');
    expect(skill).toContain('What Didn\'t Work** section (bug track) or **Context** section (knowledge track)');
    expect(skill).toContain('single durable file');
    expect(skill).toContain('Human Summary');
    expect(skill).toContain('LLM Reuse Context');
    expect(skill).toContain('primary reuse surface');
    expect(skill).toContain('Do not create a second durable artifact');
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
      expect(template).toContain('## Human Summary');
      expect(template).toContain('## LLM Reuse Context');
      expect(template).toContain('Prefer repo-factual details');
      expect(template).toContain('say so explicitly rather than guessing');
      expect(template).toContain('### Code Touchpoints');
      expect(template).toContain('### Provenance');
    }
  });

  test('spec-compound-refresh treats quality feedback artifacts as passive drift signals and preserves dual-view docs', () => {
    const skill = read('skills/spec-compound-refresh/SKILL.md');

    expect(skill).toContain('quality-feedback-topics.json');
    expect(skill).toContain('candidate_topics');
    expect(skill).toContain('supplementary drift signal');
    expect(skill).toContain('must not be treated as an automatic refresh queue');
    expect(skill).toContain('Human Summary');
    expect(skill).toContain('LLM Reuse Context');
    expect(skill).toContain('same durable file');
    expect(skill).toContain('section-aware');
    expect(skill).toContain('Code Touchpoints');
    expect(skill).toContain('Provenance');
  });

  test('learnings-researcher treats critical-patterns and dual-view sections as optional input', () => {
    const agent = read('agents/research/learnings-researcher.md');

    expect(agent).toContain('If `docs/solutions/patterns/critical-patterns.md` exists');
    expect(agent).toContain('Missing this file is not an error');
    expect(agent).toContain('applies_when');
    expect(agent).toContain('## Human Summary');
    expect(agent).toContain('## LLM Reuse Context');
    expect(agent).toContain('primary reuse surface');
    expect(agent).toContain('Missing these sections is not an error');
  });
});
