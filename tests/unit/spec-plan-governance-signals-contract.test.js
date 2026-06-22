'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'spec-plan', 'SKILL.md');
const PLANNING_FLOW_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-plan',
  'references',
  'planning-flow.md',
);

describe('spec-plan governance signals contract', () => {
  test('Phase 0.6 consumes candidate_level without surrendering LLM judgment', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');
    const planningFlow = fs.readFileSync(PLANNING_FLOW_PATH, 'utf8');

    expect(skill).toContain('skills/spec-plan/references/planning-flow.md');
    expect(skill).toContain('Use Phase 0.6 to classify plan depth from source evidence and optional `task-governance-signals`');
    expect(skill).toContain('helper output is advisory, and the LLM still decides');
    expect(planningFlow).toContain('spec-first internal task-governance-signals');
    expect(planningFlow).toContain('--source plan-declared');
    expect(planningFlow).toContain('candidate_level');
    expect(planningFlow).toContain('reason_codes');
    expect(planningFlow).toContain('The helper prepares signals; the LLM still decides the final plan depth.');
    expect(planningFlow).toContain('explicitly override it with a short reason');
    expect(planningFlow).toContain('Do not feed draft Implementation Units or `Files` lists into Phase 0.6');
  });
});
