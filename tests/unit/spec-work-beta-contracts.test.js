'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'spec-work-beta', 'SKILL.md');
const CONFIG_TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-mcp-setup',
  'references',
  'config-template.yaml',
);
const DELEGATION_REFERENCE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-work-beta',
  'references',
  'codex-delegation-workflow.md',
);

describe('spec-work-beta context orientation contract', () => {
  test('keeps beta execution as explicit opt-in instead of default handoff', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Beta rollout note');
    expect(text).toContain('manually only when the current request explicitly asks to trial beta execution');
    expect(text).toContain('Codex delegation');
    expect(text).toContain('delegate:codex');
    expect(text).toContain('guide-mode recommendations, planning handoffs, and ordinary execution-ready work remain pointed at stable `spec-work`');
  });

  test('passes bounded direct-read context to delegates without retired graph ids', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');
    expect(text).toContain('Context Orientation Anchor');
    expect(text).toContain('the plan or task pack');
    expect(text).toContain('workspace-graph-targets.v1');
    expect(text).toContain('bounded candidate repos');
    expect(text).toContain('GitNexus-first evidence per candidate');
    expect(text).toContain('definitions-only GitNexus results as pointers');
    expect(text).toContain('Delegate prompts should carry bounded direct-read context');
    expect(text).toContain('explicit file boundaries');
    expect(text).toContain('not graph work-run ids');
    expect(text).toContain('Workspace Repo Scope');
    expect(text).toContain('per-unit/per-task `target_repo` values');
    expect(text).toContain('Delegation may split across child repos only when repo scopes and write sets are explicit');
    expect(text).toContain('advisory graph target facts');
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

describe('spec-work-beta Codex delegation config contract', () => {
  test('model and reasoning effort defer to Codex config when unset or invalid', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(skill).toContain('For optional settings without a hard default (`work_delegate_model`, `work_delegate_effort`)');
    expect(skill).toContain('defers to the user\'s `~/.codex/config.toml` default');
    expect(skill).toContain('resolves to unset and defers to the user\'s `~/.codex/config.toml` default');
    expect(skill).toContain('`delegate_model` -- string from config, or unset');
    expect(skill).toContain('`delegate_effort` -- string from config, or unset');
    expect(skill).not.toContain('`delegate_model` -- string (from config or default `gpt-5.4`)');
    expect(skill).not.toContain('`delegate_effort` -- string (from config or default `high`)');
  });

  test('config pre-resolution guards empty repo roots before reading local config', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(skill).toContain('(top=$(git rev-parse --show-toplevel 2>/dev/null); [ -n "$top" ]');
    expect(skill).toContain('(common=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null); [ -n "$common" ]');
    expect(skill).toContain('|| echo \'__NO_CONFIG__\'');
    expect(skill).not.toContain('cat "$(git rev-parse --show-toplevel 2>/dev/null)/.spec-first/config.local.yaml"');
  });

  test('codex exec omits model and effort flags unless configured', () => {
    const reference = fs.readFileSync(DELEGATION_REFERENCE_PATH, 'utf8');

    expect(reference).toContain('Conditional flags');
    expect(reference).toContain('If `delegate_model` is set');
    expect(reference).toContain('If `delegate_effort` is set');
    expect(reference).toContain('Do not substitute a placeholder string for unset values.');
    expect(reference).not.toContain('  -m "<delegate_model>" \\\n  -c \'model_reasoning_effort="<delegate_effort>"\'');
  });

  test('local config template does not pin a specific Codex delegate model', () => {
    const template = fs.readFileSync(CONFIG_TEMPLATE_PATH, 'utf8');

    expect(template).toContain('# work_delegate_model: <codex-model>');
    expect(template).toContain('# work_delegate_effort: <effort>');
    expect(template).toContain('Invalid values are ignored or fall back per setting.');
    expect(template).toContain('omit to use ~/.codex/config.toml default');
    expect(template).not.toContain('work_delegate_model: gpt-5.4');
    expect(template).not.toContain('work_delegate_effort: high');
  });
});

describe('spec-work-beta host entrypoint contract', () => {
  test('routes oversized work back through the current host entrypoint', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Oversized intake and handoff');
    expect(text).toContain('current host\'s brainstorm or plan entrypoint');
    expect(text).toContain('If the input is a bare prompt and the product WHAT is unclear, recommend the current host\'s brainstorm entrypoint');
    expect(text).toContain('If the desired outcome is clear but no settled plan exists, return to the current host\'s plan entrypoint');
    expect(text).toContain('offer the standalone `spec-write-tasks` diversion once');
    expect(text).toContain('Do not describe task compilation as a command-backed workflow entrypoint');
    expect(text).toContain('If execution discovers scope beyond the plan/task pack');
    expect(text).toContain('Do not expand scope in place.');
    expect(text).toContain('Do not invent human-time phases');
    expect(text).not.toContain('would benefit from `/spec:brainstorm` or `/spec:plan`');
    expect(text).not.toContain('return to `/spec:plan` to reduce scope');
    expect(text).not.toContain('/spec:brainstorm` / `/spec:plan` on Claude Code');
    expect(text).not.toContain('$spec-brainstorm` / `$spec-plan` on Codex');
    expect(text).not.toContain('current host\'s plan entrypoint (`/spec:plan` on Claude Code, `$spec-plan` on Codex)');
    expect(text).not.toContain('/spec:write-tasks');
    expect(text).not.toContain('/spec:spec-write-tasks');
    expect(text).not.toContain('$spec-write-tasks');
  });
});
