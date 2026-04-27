'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'spec-work-beta', 'SKILL.md');

describe('spec-work-beta context orientation contract', () => {
  test('passes bounded direct-read context to delegates without retired graph ids', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');
    expect(text).toContain('Context Orientation Anchor');
    expect(text).toContain('the plan or task pack');
    expect(text).toContain('Delegate prompts should carry bounded direct-read context');
    expect(text).toContain('explicit file boundaries');
    expect(text).toContain('not graph work-run ids');
    expect(text).not.toContain('spec-first ' + 'crg hook');
    expect(text).not.toContain('$spec-' + 'graph' + '-bootstrap');
    expect(text).not.toContain('/spec:' + 'graph' + '-bootstrap');
    expect(text).not.toContain('stage0-context');
  });
});

describe('spec-work-beta task-pack identity contract', () => {
  test('rejects missing or mismatched spec_id before delegate execution tasks', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('read `spec_id` from the task pack and source plan');
    expect(text).toContain('If the task pack lacks `spec_id`, stop as missing identity');
    expect(text).toContain('reject the task pack as wrong-chain handoff before implementation');
    expect(text).toContain('missing-spec-id, spec-id-mismatch');
    expect(text).toContain('Do not treat it as execution state or completion status');
  });
});

describe('spec-work-beta subagent and delegation isolation contract', () => {
  test('keeps Codex delegation serial and does not borrow Claude worktree parameters', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Host capability matrix');
    expect(text).toContain('Codex delegation (`codex exec`)');
    expect(text).toContain('Follow `references/codex-delegation-workflow.md`');
    expect(text).toContain('this path forces serial execution from the delegation routing gate');
    expect(text).toContain('Codex `spawn_agent` / forked workspace');
    expect(text).toContain('Do not pass or claim Claude\'s `isolation: "worktree"` parameter');
    expect(text).toContain('Codex delegation:');
    expect(text).toContain('the orchestrator still owns git operations and PR creation');
    expect(text).toContain('Shared-directory fallback or Codex fork-workspace handoff');
  });
});
