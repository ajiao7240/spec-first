'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills', 'spec-update', 'SKILL.md');
const GOVERNANCE_PATH = path.join(
  REPO_ROOT,
  'src',
  'cli',
  'contracts',
  'dual-host-governance',
  'skills-governance.json',
);

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('spec-update contracts', () => {
  test('source skill supports Claude Code and Codex update flows', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('Supports Claude Code and');
    expect(skill).toContain('Codex with host-specific update commands');
    expect(skill).toContain('Claude Code branch');
    expect(skill).toContain('Codex branch');
    expect(skill).toContain('claude plugin update');
    expect(skill).toContain('npm install -g spec-first@latest');
    expect(skill).toContain('spec-first doctor --codex --json');
    expect(skill).toContain('spec-first init --codex');
    expect(skill).toContain('current host\'s');
    expect(skill).toContain('/spec:update` on Claude Code');
    expect(skill).toContain('$spec-update` on Codex');
    expect(skill).not.toContain('run `/spec:update` in a');
    expect(skill).not.toContain('ce_platforms: [claude]');
    expect(skill).not.toContain('Claude Code only.');
  });

  test('Claude marketplace pre-resolution avoids case statements and uses stable sentinel', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('grep -q "/plugins/cache/.*/spec-first/.*/skills/spec-update$"');
    expect(skill).toContain('__SPEC_UPDATE_NOT_MARKETPLACE__');
    expect(skill).not.toContain('__SPEC_UPDATE_NOT_MARKETPLASPEC__');
    expect(skill).not.toContain('case "${CLAUDE_SKILL_DIR}"');
    expect(skill).not.toContain(';; esac');
  });

  test('governance exposes spec-update on both hosts', () => {
    const governance = JSON.parse(read(GOVERNANCE_PATH));

    expect(governance.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skill_name: 'spec-update',
          entry_surface: 'workflow_command',
          command_name: 'update',
          host_scope: 'dual_host',
          owner_host: null,
          host_delivery: {
            claude: 'command',
            codex: 'skill',
          },
        }),
      ]),
    );
  });
});
