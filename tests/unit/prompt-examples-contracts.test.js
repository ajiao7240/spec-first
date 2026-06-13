'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const EXAMPLE_FILES = [
  ['using-spec-first', path.join(REPO_ROOT, 'skills', 'using-spec-first', 'evals', 'examples.json'), 'skills/using-spec-first/evals/examples.json'],
  ['spec-work', path.join(REPO_ROOT, 'skills', 'spec-work', 'evals', 'examples.json'), 'skills/spec-work/evals/examples.json'],
  ['spec-doc-review', path.join(REPO_ROOT, 'skills', 'spec-doc-review', 'evals', 'examples.json'), 'skills/spec-doc-review/evals/examples.json'],
];
const USING_SPEC_FIRST_ROUTING_CASES = path.join(
  REPO_ROOT,
  'skills',
  'using-spec-first',
  'evals',
  'routing-cases.json',
);
const PLACEHOLDER_PATTERN = /\b(?:TODO|TBD|foo|bar)\b|example 1/i;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

describe('prompt examples baseline contracts', () => {
  test.each(EXAMPLE_FILES)('%s examples file follows prompt-examples/v1 shape', (skill, filePath) => {
    expect(fs.existsSync(filePath)).toBe(true);
    const payload = readJson(filePath);

    expect(payload.schema_version).toBe('prompt-examples/v1');
    expect(payload.skill).toBe(skill);
    expect(Array.isArray(payload.examples)).toBe(true);
    expect(payload.examples.length).toBeGreaterThanOrEqual(4);
    expect(payload.examples.length).toBeLessThanOrEqual(6);

    const seenNames = new Set();
    for (const example of payload.examples) {
      expect(typeof example.name).toBe('string');
      expect(example.name.trim()).toBe(example.name);
      expect(example.name.length).toBeGreaterThan(0);
      expect(seenNames.has(example.name)).toBe(false);
      seenNames.add(example.name);

      for (const field of ['user_intent', 'expected_posture', 'boundary_note', 'source_note']) {
        expect(typeof example[field]).toBe('string');
        expect(example[field].trim().length).toBeGreaterThan(0);
      }

      for (const field of ['negative_signal', 'context_snippets']) {
        if (example[field] === undefined) continue;
        if (Array.isArray(example[field])) {
          expect(example[field].length).toBeGreaterThan(0);
          for (const item of example[field]) {
            expect(typeof item).toBe('string');
            expect(item.trim().length).toBeGreaterThan(0);
          }
        } else {
          expect(typeof example[field]).toBe('string');
          expect(example[field].trim().length).toBeGreaterThan(0);
        }
      }

      const serialized = JSON.stringify(example);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
    }
  });

  test.each(EXAMPLE_FILES)('%s skill prompt references examples as context', (skill, _filePath, relativeExamplePath) => {
    const skillPrompt = fs.readFileSync(path.join(REPO_ROOT, 'skills', skill, 'SKILL.md'), 'utf8');

    expect(skillPrompt).toContain(relativeExamplePath);
    expect(skillPrompt).toContain('examples-as-context');
    expect(skillPrompt).toContain('not');
  });

  test('using-spec-first routing cases pin lightweight direct outcomes without becoming a router', () => {
    const payload = readJson(USING_SPEC_FIRST_ROUTING_CASES);
    const skillPrompt = fs.readFileSync(path.join(REPO_ROOT, 'skills', 'using-spec-first', 'SKILL.md'), 'utf8');

    expect(payload.schema_version).toBe('using-spec-first-routing-cases/v1');
    expect(payload.skill).toBe('using-spec-first');
    expect(Array.isArray(payload.cases)).toBe(true);
    expect(payload.cases.length).toBeGreaterThanOrEqual(5);
    expect(payload.cases.length).toBeLessThanOrEqual(8);
    expect(skillPrompt).toContain('skills/using-spec-first/evals/routing-cases.json');
    expect(skillPrompt).toContain('not a deterministic router');

    const casesById = new Map(payload.cases.map((entry) => [entry.id, entry]));
    for (const id of [
      'greeting-direct-answer',
      'current-context-explanation-direct',
      'narrow-where-used-bounded-read',
      'current-document-summary-direct',
    ]) {
      const entry = casesById.get(id);
      expect(entry).toBeDefined();
      expect(entry.public_workflow_required).toBe(false);
      expect(entry.expected_entrypoint).toBeNull();
      expect(entry.graphify_required).toBe(false);
      expect(entry.artifact_expected).toBe(false);
      expect(['direct_answer', 'bounded_read']).toContain(entry.expected_outcome);
      expect(entry.expected_outcome).not.toBe('public_workflow');
    }

    expect(casesById.get('explicit-spec-plan-honored')).toMatchObject({
      expected_outcome: 'public_workflow',
      public_workflow_required: true,
      expected_entrypoint: '$spec-plan',
      artifact_expected: true,
    });

    for (const entry of payload.cases) {
      expect(typeof entry.name).toBe('string');
      expect(typeof entry.user_intent).toBe('string');
      expect(typeof entry.boundary_note).toBe('string');
      expect(entry.name.trim()).toBe(entry.name);
      expect(entry.user_intent.trim().length).toBeGreaterThan(0);
      expect(entry.boundary_note.trim().length).toBeGreaterThan(0);
      expect(JSON.stringify(entry)).not.toMatch(PLACEHOLDER_PATTERN);
    }
  });
});
