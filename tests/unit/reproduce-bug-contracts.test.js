'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/reproduce-bug/SKILL.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('reproduce-bug contracts', () => {
  test('skill preserves GitHub issue-grounded entrypoint and neighboring skill boundaries', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('name: reproduce-bug');
    expect(skill).toContain('argument-hint: "[GitHub issue number or URL]"');
    expect(skill).toContain('gh issue view $ARGUMENTS --json title,body,comments,labels,assignees');
    expect(skill).toContain('issue-grounded reproduction/investigation entrypoint');
    expect(skill).toContain('existing GitHub issues');
    expect(skill).toContain('/spec:debug');
    expect(skill).toContain('use the `report-bug` skill');
    expect(skill).not.toContain('/report-bug');
  });

  test('browser reproduction route stays pinned to agent-browser', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('Use the `agent-browser` CLI for browser automation.');
    expect(skill).toContain('Do not use any alternative browser MCP integration or built-in browser-control tool.');
    expect(skill).toContain('agent-browser open http://localhost:${PORT:-3000}');
    expect(skill).toContain('agent-browser screenshot bug-evidence.png');
  });

  test('close-out routes full debug/fix work to spec-debug', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('Continue with /spec:debug to root-cause and fix');
    expect(skill).toContain('hand off the confirmed reproduction steps, evidence, and the current best hypothesis to `/spec:debug`');
    expect(skill).not.toContain('/ce-debug');
  });
});
