'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ClaudeAdapter = require('../../src/cli/adapters/claude');
const CodexAdapter = require('../../src/cli/adapters/codex');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/agent-native-architecture/SKILL.md');

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

    expect(skill).toContain('## What aspect of agent-native architecture do you need help with?');
    expect(skill).toContain('1. **Design architecture**');
    expect(skill).toContain('13. **Refactoring**');
    expect(skill).toContain('**Wait for response before proceeding.**');

    expect(skill).toContain('Read `references/architecture-patterns.md`');
    expect(skill).toContain('Read `references/mcp-tool-design.md`');
    expect(skill).toContain('Read `references/agent-native-testing.md`');

    expect(skill).toContain('## Architecture Review Checklist');
    expect(skill).toContain('**CRUD Completeness:** Every entity has create, read, update, AND delete');
    expect(skill).toContain('**Completion Signals:** Agent has explicit `complete_task` tool');
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
    expect(claudeRuntime).toContain('## Architecture Review Checklist');
    expect(codexRuntime).toContain('## Architecture Review Checklist');
    expect(claudeRuntime).not.toContain('compound-engineering');
    expect(codexRuntime).not.toContain('compound-engineering');
  });
});
