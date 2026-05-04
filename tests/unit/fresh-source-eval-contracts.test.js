'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const CHECKLIST_PATH = path.join(REPO_ROOT, 'docs', 'contracts', 'workflows', 'fresh-source-eval-checklist.md');
const AGENTS_PATH = path.join(REPO_ROOT, 'AGENTS.md');
const CLAUDE_PATH = path.join(REPO_ROOT, 'CLAUDE.md');

describe('fresh-source eval checklist contract', () => {
  test('documents source-first semantic eval without relying on cached runtime mirrors', () => {
    const checklist = fs.readFileSync(CHECKLIST_PATH, 'utf8');
    const agents = fs.readFileSync(AGENTS_PATH, 'utf8');
    const claude = fs.readFileSync(CLAUDE_PATH, 'utf8');

    expect(checklist).toContain('checks the current source files on disk');
    expect(checklist).toContain('not runtime mirrors or definitions cached by the current session');
    expect(checklist).toContain('It must not treat `.claude/`, `.codex/`, or `.agents/skills/` as source.');
    expect(checklist).toContain('If the current host or developer instructions do not authorize subagents/fresh reviewers, do not bypass that restriction.');
    expect(checklist).toContain('Record `fresh_source_eval: not_run` with the reason.');
    expect(checklist).toContain('Do not claim fresh-source eval passed.');
    expect(checklist).toContain('Do not validate changed skill prose by invoking the same typed skill in the current session');
    expect(checklist).toContain('Do not use the checklist to require subagent dispatch when the current host policy forbids it.');
    expect(checklist).toContain('deterministic_vs_semantic_boundary');

    for (const entryDoc of [agents, claude]) {
      expect(entryDoc).toContain('docs/contracts/workflows/fresh-source-eval-checklist.md');
      expect(entryDoc).toContain('如果当前宿主策略不允许 fresh reviewer/subagent，必须记录未执行原因，不能声称通过。');
    }
  });
});
