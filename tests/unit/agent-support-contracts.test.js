'use strict';

const { listBundledAgentSupportFiles } = require('../../src/cli/plugin');
const { buildState } = require('../../src/cli/state');

describe('agent support file contracts', () => {
  test('bundled agent support files are tracked separately from markdown agents', () => {
    expect(listBundledAgentSupportFiles()).toEqual([
      'research/session-history-scripts/discover-sessions.sh',
      'research/session-history-scripts/extract-errors.py',
      'research/session-history-scripts/extract-metadata.py',
      'research/session-history-scripts/extract-skeleton.py',
    ]);
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
      skills: ['document-review', 'document-review'],
      workflowSkills: ['spec-review', 'spec-plan', 'spec-review'],
      agents: ['research/session-historian.md', 'research/session-historian.md'],
      agentSupportFiles: [
        'research/session-history-scripts/extract-skeleton.py',
        'research/session-history-scripts/extract-skeleton.py',
        'research/session-history-scripts/discover-sessions.sh',
      ],
    });

    expect(state.commands).toEqual(['sessions.md', 'work.md']);
    expect(state.skills).toEqual(['document-review']);
    expect(state.workflowSkills).toEqual(['spec-plan', 'spec-review']);
    expect(state.agents).toEqual(['research/session-historian.md']);
    expect(state.agentSupportFiles).toEqual([
      'research/session-history-scripts/discover-sessions.sh',
      'research/session-history-scripts/extract-skeleton.py',
    ]);
  });
});
