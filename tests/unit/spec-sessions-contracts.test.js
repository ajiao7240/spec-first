'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/spec-sessions/SKILL.md');
const COMMAND_PATH = path.join(REPO_ROOT, 'templates/claude/commands/spec/sessions.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('spec-sessions contracts', () => {
  test('skill title and usage align with dual-host entrypoints', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('# Spec-First Sessions');
    expect(skill).toContain('Claude: /spec:sessions [question or topic]');
    expect(skill).toContain('Codex:  $spec-sessions [question or topic]');
    expect(skill).toContain('spec-first:research:session-historian');

    expect(skill).not.toContain('# /sessions');
    expect(skill).not.toContain('/ce:sessions');
  });

  test('command template points at the paired source skill', () => {
    const command = read(COMMAND_PATH);

    expect(command).toContain('# Spec-First Sessions');
    expect(command).toContain('skills/spec-sessions/SKILL.md');
    expect(command).not.toContain('.claude/spec-first/workflows/spec-sessions/SKILL.md');
  });
});
