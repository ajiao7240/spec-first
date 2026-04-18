'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ClaudeAdapter = require('../../src/cli/adapters/claude');
const CodexAdapter = require('../../src/cli/adapters/codex');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills', 'using-spec-first', 'SKILL.md');
const DOC_MIRROR_PATH = path.join(REPO_ROOT, 'docs', '10-prompt', 'skills', 'using-spec-first', 'SKILL.md');
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

describe('using-spec-first contracts', () => {
  test('source skill defines the entry-governor contract', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('name: using-spec-first');
    expect(skill).toContain('session-level entry governor');
    expect(skill).toContain('substantial work');
    expect(skill).toContain('workflow-first');
    expect(skill).toContain('It does **not** exist to force every task through brainstorming.');
    expect(skill).toContain('Do **not** make `spec-brainstorm` the universal default front door.');
    expect(skill).toContain('Do **not** adopt the `using-superpowers` rule');
    expect(skill).toContain('Do **not** write Codex entrypoints as `/spec:*`.');
    expect(skill).toContain('Do **not** write Claude workflow entrypoints as `$spec-*`.');
    expect(skill).toContain('Claude workflow entrypoints use `/spec:*`');
    expect(skill).toContain('Codex workflow entrypoints use `$spec-*`');
    expect(skill).toContain('do not reload this same skill file again');
    expect(skill).toContain('`using-spec-first` governs **workflow entry and routing**');
    expect(skill).toContain('/spec:plan');
    expect(skill).toContain('$spec-plan');
    expect(skill).toContain('/spec:work');
    expect(skill).toContain('$spec-work');
  });

  test('docs mirror matches the source skill exactly', () => {
    expect(read(DOC_MIRROR_PATH)).toBe(read(SKILL_PATH));
  });

  test('skills governance registers using-spec-first as a dual-host standalone skill', () => {
    const governance = JSON.parse(read(GOVERNANCE_PATH));

    expect(governance.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skill_name: 'using-spec-first',
          entry_surface: 'standalone_skill',
          command_name: null,
          host_scope: 'dual_host',
          owner_host: null,
          host_delivery: {
            claude: 'skill',
            codex: 'skill',
          },
        }),
      ]),
    );
  });

  test('runtime transforms preserve standalone naming across hosts', () => {
    const sourceSkill = read(SKILL_PATH);
    const claude = new ClaudeAdapter();
    const codex = new CodexAdapter();
    const claudeRuntime = claude.transformSkillContent(sourceSkill);
    const codexRuntime = codex.transformSkillContent(sourceSkill, { skillName: 'using-spec-first' });

    expect(claudeRuntime).toContain('name: using-spec-first');
    expect(codexRuntime).toContain('name: using-spec-first');
    expect(claudeRuntime).toContain('Claude workflow entrypoints use `/spec:*`');
    expect(codexRuntime).toContain('Codex workflow entrypoints use `$spec-*`');
  });
});
