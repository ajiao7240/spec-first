'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { listBundledAgentSupportFiles, listBundledAgents } = require('../../src/cli/plugin');
const { buildState } = require('../../src/cli/state');

const REPO_ROOT = path.join(__dirname, '..', '..');

describe('agent support file contracts', () => {
  test('phase 2 owned agent profiles state role ownership without mutation authority', () => {
    const expectations = [
      {
        fileName: 'spec-repo-research-analyst.agent.md',
        owns: 'You own repository structure, documentation, conventions, implementation patterns, technology inventory, and scoped source-orientation findings.',
        notOwns: 'You do not own architecture approval, test-risk verdicts, scope-drift findings, implementation work, or review autofix.',
      },
      {
        fileName: 'spec-learnings-researcher.agent.md',
        owns: 'You own institutional learning lookup under `docs/solutions/`, relevance ranking, stale-learning caveats, and reusable lesson summaries.',
        notOwns: 'You do not own current architecture decisions, test-risk verdicts, scope approval, implementation work, or review autofix.',
      },
      {
        fileName: 'spec-architecture-strategist.agent.md',
        owns: 'You own architecture risk, pattern compliance, layering, dependency direction, API/interface stability, and long-term design implications.',
        notOwns: 'You do not own repository inventory, institutional-learning search, test-coverage verdicts, scope-goal alignment, implementation work, or review autofix.',
      },
      {
        fileName: 'spec-testing-reviewer.agent.md',
        owns: 'You own test-risk assessment, coverage gaps, assertion quality, brittle test patterns, and whether verification proves changed behavior.',
        notOwns: 'You do not own architecture approval, product scope, repository research, institutional-learning search, implementation work, or review autofix.',
      },
      {
        fileName: 'spec-scope-guardian-reviewer.agent.md',
        owns: 'You own scope-goal alignment, unjustified complexity, over-broad task boundaries, premature abstractions, and right-sizing concerns.',
        notOwns: 'You do not own product strategy, architecture implementation details, test-risk verdicts, repository inventory, implementation work, or review autofix.',
      },
    ];

    for (const { fileName, owns, notOwns } of expectations) {
      const text = fs.readFileSync(path.join(REPO_ROOT, 'agents', fileName), 'utf8');

      expect(text).toContain('## Role Ownership Boundary');
      expect(text).toContain(owns);
      expect(text).toContain(notOwns);
      expect(text).not.toContain('You own implementation work');
      expect(text).not.toContain('You own review autofix');
    }
  });

  test('bundled agent support files are tracked separately from markdown agents', () => {
    expect(listBundledAgentSupportFiles()).toEqual([]);
  });

  test('buildState preserves agentSupportFiles in managed state', () => {
    const state = buildState('1.5.1', {
      platform: 'claude',
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
