'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ClaudeAdapter = require('../../src/cli/adapters/claude');
const CodexAdapter = require('../../src/cli/adapters/codex');
const { inspectInstalledAssets, syncSkills } = require('../../src/cli/plugin');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills', 'using-spec-first', 'SKILL.md');
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
    expect(skill).toContain('standalone meta skill and entry governor');
    expect(skill).toContain('not a command-backed workflow');
    expect(skill).toContain('If You Are A Subagent');
    expect(skill).toContain('substantial work');
    expect(skill).toContain('environment setup, host setup, MCP setup, missing tools, or host readiness');
    expect(skill).not.toContain('graph' + '-bootstrap');
    expect(skill).not.toContain('spec-first ' + 'crg');
    expect(skill).toContain('workflow-first');
    expect(skill).toContain('Routing Priority');
    expect(skill).toContain('Explicit user route');
    expect(skill).toContain('Routing Red Flags');
    expect(skill).toContain('Do not chain multiple workflows automatically');
    expect(skill).toContain('It does **not** exist to force every task through brainstorming.');
    expect(skill).toContain('Do **not** make `spec-brainstorm` the universal default front door.');
    expect(skill).toContain('Do **not** adopt the `using-superpowers` rule');
    expect(skill).toContain('Do **not** write Codex entrypoints as `/spec:*`.');
    expect(skill).toContain('Do **not** write Claude workflow entrypoints as `$spec-*`.');
    expect(skill).toContain('Claude workflow entrypoints use `/spec:*`');
    expect(skill).toContain('Codex workflow entrypoints use `$spec-*`');
    expect(skill).toContain('do not reload or invoke `using-spec-first` just to bootstrap yourself');
    expect(skill).toContain('`using-spec-first` governs **entry routing only**');
    expect(skill).toContain('Do **not** expose internal-only skills as user entrypoints.');
    expect(skill).toContain('spec-session-inventory');
    expect(skill).toContain('using-spec-first` itself is a standalone meta skill');
    expect(skill).toContain('/spec:update');
    expect(skill).toContain('$spec-update');
    expect(skill).toContain('/spec:doc-review');
    expect(skill).toContain('$spec-doc-review');
    expect(skill).toContain('git-commit-push-pr');
    expect(skill).toContain('description-only mode');
    expect(skill).not.toContain('/spec:pr-description');
    expect(skill).not.toContain('$spec-pr-description');
    expect(skill).toContain('/spec:optimize');
    expect(skill).toContain('$spec-optimize');
    expect(skill).toContain('/spec:plan');
    expect(skill).toContain('$spec-plan');
    expect(skill).toContain('spec-write-tasks');
    expect(skill).toContain('not a `/spec:*` or `$spec-*` workflow entrypoint');
    expect(skill).toContain('/spec:work');
    expect(skill).toContain('$spec-work');
  });

  test('skills governance exposes using-spec-first as a standalone meta skill on both hosts', () => {
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

  test('runtime transforms preserve internal guidance text when transformed directly', () => {
    const sourceSkill = read(SKILL_PATH);
    const claude = new ClaudeAdapter();
    const codex = new CodexAdapter();
    const claudeRuntime = claude.transformSkillContent(sourceSkill);
    const codexRuntime = codex.transformSkillContent(sourceSkill, { skillName: 'using-spec-first' });

    expect(claudeRuntime).toContain('name: using-spec-first');
    expect(codexRuntime).toContain('name: using-spec-first');
    expect(claudeRuntime).toContain('Claude workflow entrypoints use `/spec:*`');
    expect(codexRuntime).toContain('Codex workflow entrypoints use `$spec-*`');
    expect(codexRuntime).toContain('using-spec-first` itself is a standalone meta skill');
    expect(claudeRuntime).toContain('Claude Code installs it as `.claude/skills/using-spec-first/SKILL.md`');
    expect(claudeRuntime).toContain('Codex installs it as `.agents/skills/using-spec-first/SKILL.md`');
    expect(codexRuntime).toContain('Claude Code installs it as `.claude/skills/using-spec-first/SKILL.md`');
    expect(codexRuntime).toContain('Codex installs it as `.agents/skills/using-spec-first/SKILL.md`');
  });

  test('codex runtime install notes do not trigger path rewrite drift', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'using-spec-first-codex-runtime-'));
    const codex = new CodexAdapter();

    try {
      syncSkills(projectRoot, codex);
      const status = inspectInstalledAssets(projectRoot, codex).skills;
      const usingSpecFirstDrift = status.drifted.find((entry) => entry.skillName === 'using-spec-first');

      expect(usingSpecFirstDrift).toBeUndefined();
      expect(read(path.join(projectRoot, '.agents', 'skills', 'using-spec-first', 'SKILL.md'))).toContain(
        'Claude Code installs it as `.claude/skills/using-spec-first/SKILL.md`',
      );
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
