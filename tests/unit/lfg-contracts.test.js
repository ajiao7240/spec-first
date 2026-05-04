'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const LFG_SKILL_PATH = path.join(REPO_ROOT, 'skills', 'lfg', 'SKILL.md');
const GOVERNANCE_PATH = path.join(
  REPO_ROOT,
  'src',
  'cli',
  'contracts',
  'dual-host-governance',
  'skills-governance.json',
);

describe('lfg legacy internal contract', () => {
  test('lfg is marked as a legacy internal shim, not a public workflow path', () => {
    const skill = fs.readFileSync(LFG_SKILL_PATH, 'utf8');
    const governance = JSON.parse(fs.readFileSync(GOVERNANCE_PATH, 'utf8'));
    const lfg = governance.skills.find((entry) => entry.skill_name === 'lfg');

    expect(skill).toContain('Legacy internal autonomous workflow shim');
    expect(skill).toContain('not a public `spec-first` workflow');
    expect(skill).toContain('Do not recommend it in README, user manuals, `using-spec-first` guide mode, or public workflow tables.');
    expect(skill).toContain('Only run this skill when an internal caller explicitly invokes `lfg`');
    expect(skill).toContain('Prefer the explicit public chain');
    expect(skill).not.toContain('/spec:lfg');
    expect(skill).not.toContain('$spec-lfg');

    expect(lfg).toEqual(expect.objectContaining({
      entry_surface: 'internal_only',
      command_name: null,
      host_delivery: {
        claude: 'internal',
        codex: 'internal',
      },
    }));
  });
});
