'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/agent-native-audit/SKILL.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('agent-native-audit skill contracts', () => {
  test('skill preserves identity, headless mode, and agent-native-architecture reference', () => {
    const skill = read(SKILL_PATH);

    // Skill identity
    expect(skill).toContain('name: agent-native-audit');

    // Headless mode prevents token burn on skill load
    expect(skill).toContain('disable-model-invocation: true');

    // Reference to agent-native-architecture — must stay discoverable as a skill handoff
    expect(skill).toContain('Load the `agent-native-architecture` skill');
    expect(skill).not.toContain('compound-engineering:agent-native-architecture');
    expect(skill).not.toContain('/agent-native-architecture');

    // 8 audit principles — core scoring surface
    // If upstream changes principle count, scoring model and summary table both break
    expect(skill).toContain('Action Parity');
    expect(skill).toContain('Tools as Primitives');
    expect(skill).toContain('Context Injection');
    expect(skill).toContain('Shared Workspace');
    expect(skill).toContain('CRUD Completeness');
    expect(skill).toContain('UI Integration');
    expect(skill).toContain('Capability Discovery');
    expect(skill).toContain('Prompt-Native Features');

    // Parallel sub-agent execution contract — 8 agents dispatched for parallel audit
    expect(skill).toContain('8 parallel sub-agents');
  });
});
