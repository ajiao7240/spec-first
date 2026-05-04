'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'spec-release-notes', 'SKILL.md');

describe('spec-release-notes filtering contract', () => {
  test('supports scoped version, range, and topic queries without dumping changelog bodies', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(skill).toContain('version:<semver-or-tag>');
    expect(skill).toContain('since:<semver-or-tag>');
    expect(skill).toContain('until:<semver-or-tag>');
    expect(skill).toContain('topic:<slug-or-term>');
    expect(skill).toContain('Normalize versions by stripping a leading `spec-first-v` or `v`.');
    expect(skill).toContain('Version-like bare inputs (`2.65.0`, `v2.65.0`, `spec-first-v2.65.0`) become `version:<that-version>`');
    expect(skill).toContain('apply any parsed version/range filters');
    expect(skill).toContain('`topic:` does not discard entries by itself; it biases the confidence judgment');
    expect(skill).toContain('The goal is a scoped answer, not a long changelog dump.');
    expect(skill).toContain('Do not paste the whole release body or copy a long sequence of CHANGELOG entries.');
    expect(skill).toContain('If filters are present but no confident semantic match exists');
  });
});
