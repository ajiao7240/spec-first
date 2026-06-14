'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { getAdapter } = require('../../src/cli/adapters');
const {
  inspectInstalledAssets,
  listBundledAgentSupportFiles,
  listBundledAgents,
  planBundledAssetSync,
  syncBundledAssets,
} = require('../../src/cli/plugin');
const { buildState } = require('../../src/cli/state');

const REPO_ROOT = path.join(__dirname, '..', '..');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spec-first-agent-support-'));
}

function removeDirectoryIfEmpty(dirPath) {
  try {
    fs.rmdirSync(dirPath);
  } catch (error) {
    if (!error || (error.code !== 'ENOENT' && error.code !== 'ENOTEMPTY')) {
      throw error;
    }
  }
}

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

  test('runtime support traversal ignores local bytecode and OS noise without hiding real drift', () => {
    const projectRoot = makeTempDir();
    const adapter = getAdapter('codex');
    const sourceScriptsDir = path.join(REPO_ROOT, 'skills', 'spec-release-notes', 'scripts');
    const cacheDir = path.join(sourceScriptsDir, '__pycache__');
    const bytecodePath = path.join(cacheDir, `noise-${process.pid}.pyc`);
    const pyoPath = path.join(cacheDir, `noise-${process.pid}.pyo`);
    const dsStorePath = path.join(sourceScriptsDir, '.DS_Store');

    try {
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(bytecodePath, 'bytecode fixture\n', 'utf8');
      fs.writeFileSync(pyoPath, 'optimized bytecode fixture\n', 'utf8');
      fs.writeFileSync(dsStorePath, 'macOS metadata fixture\n', 'utf8');

      const plan = planBundledAssetSync(projectRoot, adapter);
      const operationPaths = plan.plan.operations.map((operation) => operation.path);
      expect(operationPaths.some((operationPath) => (
        operationPath.includes('__pycache__')
        || operationPath.endsWith('.pyc')
        || operationPath.endsWith('.pyo')
        || operationPath.endsWith('.DS_Store')
      ))).toBe(false);

      syncBundledAssets(projectRoot, adapter);
      expect(fs.existsSync(path.join(projectRoot, '.agents/skills/spec-release-notes/scripts/__pycache__'))).toBe(false);
      expect(fs.existsSync(path.join(projectRoot, '.agents/skills/spec-release-notes/scripts/.DS_Store'))).toBe(false);
      expect(inspectInstalledAssets(projectRoot, adapter).skills.drifted).toEqual([]);

      const runtimeSupportPath = path.join(projectRoot, '.agents/skills/spec-work/references/shipping-workflow.md');
      fs.appendFileSync(runtimeSupportPath, '\nlocal drift fixture\n', 'utf8');
      const drifted = inspectInstalledAssets(projectRoot, adapter).skills.drifted.find((entry) => (
        entry.skillName === 'spec-work'
      ));
      expect(drifted.issues).toContain('content_mismatch:references/shipping-workflow.md');
    } finally {
      fs.rmSync(bytecodePath, { force: true });
      fs.rmSync(pyoPath, { force: true });
      fs.rmSync(dsStorePath, { force: true });
      removeDirectoryIfEmpty(cacheDir);
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
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
