'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/frontend-design/SKILL.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('frontend-design skill contracts', () => {
  test('skill preserves identity, agent-browser fallback, and spec-first design-iterator reference', () => {
    const skill = read(SKILL_PATH);

    // Skill identity
    expect(skill).toContain('name: frontend-design');

    // agent-browser is the repo-owned fallback for visual verification
    // If upstream syncs back to /ce-setup, the verification step breaks — ce-setup does not exist here
    expect(skill).toContain('agent-browser');
    expect(skill).not.toContain('ce-setup');

    // design-iterator canonical naming — must use spec-first namespace, not upstream compound-engineering
    // If this regresses, the design-iterator sub-agent reference becomes unresolvable at runtime
    expect(skill).toContain('spec-first:design:design-iterator');
    expect(skill).not.toContain('compound-engineering:design:design-iterator');

    // Visual verification workflow — core skill contract
    // If upstream removes the tool-preference cascade, iterative verification breaks silently
    expect(skill).toContain('Tool Preference Cascade');
  });
});
