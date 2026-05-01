'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { listBundledAgentSupportFiles, listBundledAgents } = require('../../src/cli/plugin');
const { buildState } = require('../../src/cli/state');

const REPO_ROOT = path.join(__dirname, '..', '..');

describe('agent support file contracts', () => {
  test('bundled agent support files are tracked separately from markdown agents', () => {
    expect(listBundledAgentSupportFiles()).toEqual([]);
  });

  test('buildState preserves agentSupportFiles in managed state', () => {
    const state = buildState('1.5.1', {
      platform: 'claude',
      developer: {
        path: '.claude/spec-first/.developer',
        name: 'kuang',
        lang: 'zh',
        initializedAt: '2026-04-15 00:23:08',
        version: '1.5.1',
      },
      commands: [{ filename: 'sessions.md' }, { filename: 'work.md' }, { filename: 'sessions.md' }],
      skills: ['spec-doc-review', 'spec-doc-review'],
      workflowSkills: ['spec-code-review', 'spec-plan', 'spec-code-review'],
      agents: ['spec-session-historian.agent.md', 'spec-session-historian.agent.md'],
      agentSupportFiles: [],
    });

    expect(state.commands).toEqual(['sessions.md', 'work.md']);
    expect(state.skills).toEqual(['spec-doc-review']);
    expect(state.workflowSkills).toEqual(['spec-code-review', 'spec-plan']);
    expect(state.agents).toEqual(['spec-session-historian.agent.md']);
    expect(state.agentSupportFiles).toEqual([]);
  });

  test('bundled markdown agents do not carry trailing whitespace', () => {
    for (const agentPath of listBundledAgents()) {
      const absolutePath = path.join(REPO_ROOT, 'agents', agentPath);
      const lines = fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/);

      lines.forEach((line, index) => {
        if (/[ \t]+$/.test(line)) {
          throw new Error(`${agentPath}:${index + 1} has trailing whitespace`);
        }
      });
    }
  });
});
