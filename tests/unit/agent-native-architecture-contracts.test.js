'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ClaudeAdapter = require('../../src/cli/adapters/claude');
const CodexAdapter = require('../../src/cli/adapters/codex');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/agent-native-architecture/SKILL.md');
const REFERENCES_DIR = path.join(REPO_ROOT, 'skills/agent-native-architecture/references');
const CHECKLISTS_PATH = path.join(REFERENCES_DIR, 'checklists.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('agent-native-architecture contracts', () => {
  test('source skill preserves identity and core agent-native architecture principles', () => {
    const skill = read(SKILL_PATH);

    expect(skill).toContain('name: agent-native-architecture');
    expect(skill).toContain('### 1. Parity');
    expect(skill).toContain('### 2. Granularity');
    expect(skill).toContain('### 3. Composability');
    expect(skill).toContain('### 4. Emergent Capability');
    expect(skill).toContain('### 5. Improvement Over Time');

    expect(skill).toContain('Whatever the user can do through the UI, the agent should be able to achieve through tools.');
    expect(skill).toContain('Features are outcomes achieved by an agent operating in a loop.');
    expect(skill).toContain('Can you add a new feature by writing a new prompt section, without adding new code?');
  });

  test('source skill preserves intake routing and architecture checklist contracts', () => {
    const skill = read(SKILL_PATH);
    const checklists = read(CHECKLISTS_PATH);

    expect(skill).toContain('## What aspect of agent-native architecture do you need help with?');
    expect(skill).toContain('1. **Design architecture**');
    expect(skill).toContain('13. **Refactoring**');
    expect(skill).toContain('**Wait for response before proceeding.**');

    expect(skill).toContain('Read `references/architecture-patterns.md`');
    expect(skill).toContain('Read `references/architecture-patterns.md` and `references/checklists.md`');
    expect(skill).toContain('Read `references/mcp-tool-design.md`');
    expect(skill).toContain('Read `references/agent-native-testing.md`');
    expect(skill).toContain('references/checklists.md');
    expect(skill).not.toContain('<architecture_checklist>');
    expect(skill).not.toContain('<anti_patterns>');
    expect(skill).not.toContain('<success_criteria>');

    expect(checklists).toContain('## Architecture Review Checklist');
    expect(checklists).toContain('## Anti-Patterns');
    expect(checklists).toContain('## Success Criteria');
    expect(checklists).toContain('**CRUD Completeness:** Every entity has create, read, update, AND delete');
    expect(checklists).toContain('**Completion Signals:** Agent has explicit `complete_task` tool');
    expect(checklists).toContain('THE CARDINAL SIN');
    expect(checklists).toContain('The Ultimate Test');
  });

  test('runtime transforms preserve host-specific naming and core contracts', () => {
    const sourceSkill = read(SKILL_PATH);
    const claude = new ClaudeAdapter();
    const codex = new CodexAdapter();
    const claudeRuntime = claude.transformSkillContent(sourceSkill);
    const codexRuntime = codex.transformSkillContent(sourceSkill, {
      skillName: 'agent-native-architecture',
    });

    expect(claudeRuntime).toContain('name: agent-native-architecture');
    expect(codexRuntime).toContain('name: agent-native-architecture');
    expect(claudeRuntime).toContain('references/checklists.md');
    expect(codexRuntime).toContain('references/checklists.md');
    expect(claudeRuntime).not.toContain('compound-engineering');
    expect(codexRuntime).not.toContain('compound-engineering');
  });

  test('reference examples avoid dated provider model ids', () => {
    const references = fs.readdirSync(REFERENCES_DIR)
      .filter((entry) => entry.endsWith('.md'))
      .map((entry) => read(path.join(REFERENCES_DIR, entry)))
      .join('\n');

    expect(references).not.toMatch(/claude-3-/);
    expect(references).not.toMatch(/claude-sonnet-4-\d{8}/);
    expect(references).not.toMatch(/claude-opus-4-\d{8}/);
    expect(references).toContain('Config.models.fast');
    expect(references).toContain('Config.models.frontier');
  });
});
