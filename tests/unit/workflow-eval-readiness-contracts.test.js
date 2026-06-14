'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  CANONICAL_SCHEMA_VERSION,
  normalizeFixtureFile,
  validateNormalizedCases,
} = require('../../skills/spec-skill-audit/scripts/eval-fixture-normalizer');

const REPO_ROOT = path.join(__dirname, '..', '..');
const FIRST_WAVE_WORKFLOWS = [
  'spec-plan',
  'spec-code-review',
  'spec-debug',
  'spec-compound',
];

function read(filePath) {
  return fs.readFileSync(path.join(REPO_ROOT, filePath), 'utf8');
}

function readJson(filePath) {
  return JSON.parse(read(filePath));
}

describe('first-wave workflow eval readiness contracts', () => {
  test.each(FIRST_WAVE_WORKFLOWS)('%s has canonical trigger and boundary fixtures', (skill) => {
    const evalPath = `skills/${skill}/evals/examples.json`;
    const payload = readJson(evalPath);
    const cases = normalizeFixtureFile({ repoRoot: REPO_ROOT, filePath: evalPath });
    const tags = new Set(cases.flatMap((entry) => entry.coverage_tags));

    expect(payload.schema_version).toBe(CANONICAL_SCHEMA_VERSION);
    expect(payload.skill).toBe(skill);
    expect(validateNormalizedCases(cases, { repoRoot: REPO_ROOT })).toEqual([]);
    expect(tags.has('trigger')).toBe(true);
    expect(tags.has('boundary')).toBe(true);
    expect(cases.filter((entry) => entry.coverage_tags.includes('trigger')).length).toBeGreaterThanOrEqual(1);
    expect(cases.filter((entry) => entry.coverage_tags.includes('boundary')).length).toBeGreaterThanOrEqual(1);
  });

  test.each(FIRST_WAVE_WORKFLOWS)('%s skill references eval examples as context, not as router', (skill) => {
    const skillText = read(`skills/${skill}/SKILL.md`);

    expect(skillText).toContain(`skills/${skill}/evals/examples.json`);
    expect(skillText).toContain('examples-as-context');
    expect(skillText).toContain('not a deterministic router');
    expect(skillText).toContain('not');
    expect(skillText).toContain('LLM judgment');
  });
});
