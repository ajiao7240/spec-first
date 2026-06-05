'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'spec-plan', 'SKILL.md');

describe('spec-plan governance signals contract', () => {
  test('Phase 0.6 consumes candidate_level without surrendering LLM judgment', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('spec-first internal task-governance-signals');
    expect(text).toContain('--source plan-declared');
    expect(text).toContain('candidate_level');
    expect(text).toContain('reason_codes');
    expect(text).toContain('The helper prepares signals; the LLM still decides the final plan depth.');
    expect(text).toContain('explicitly override it with a short reason');
    expect(text).toContain('Do not feed draft Implementation Units or `Files` lists into Phase 0.6');
  });
});
