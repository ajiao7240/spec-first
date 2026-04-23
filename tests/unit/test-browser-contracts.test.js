'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/test-browser/SKILL.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('test-browser contracts', () => {
  test('skill preserves upstream browser testing workflow contracts', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('## Use `agent-browser` Only For Browser Automation');
    expect(skill).toContain('### 2. Ask Browser Mode');
    expect(skill).toContain('### 5. Detect Dev Server Port');
    expect(skill).toContain('### 8. Human Verification (When Required)');
    expect(skill).toContain('### 10. Test Summary');
    expect(skill).toContain('Human Verification Needed');
    expect(skill).toContain('load the `todo-create` skill and create a todo with priority p1');
    expect(skill).toContain('Load the `test-browser` skill with one of these argument shapes:');
    expect(skill).toContain('## Verifier Registry Metadata');
    expect(skill).toContain('Verifier id: `test-browser`');
    expect(skill).toContain('Supported platforms: `web`');
  });

  test('skill keeps spec-first installation enhancement and avoids stale upstream setup command', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('npm install -g agent-browser');
    expect(skill).toContain('agent-browser install');
    expect(skill).toContain('run `/spec:mcp-setup` to provision dependencies');
    expect(skill).toContain('If installation fails, inform the user and stop.');

    expect(skill).not.toContain('/ce-setup');
    expect(skill).not.toContain('run `/setup` to provision dependencies');
    expect(skill).not.toContain('/test-browser');
  });
});
