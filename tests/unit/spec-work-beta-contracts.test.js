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
const SHIPPING_WORKFLOW_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-work-beta',
  'references',
  'shipping-workflow.md',
);
const TRACKER_DEFER_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'spec-work-beta',
  'references',
  'tracker-defer.md',
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
    expect(text).toContain('workspace-gitnexus-readiness.v1');
    expect(text).toContain('`group.status="group-ready"` may orient cross-repo GitNexus queries');
    expect(text).toContain('stale/advisory group evidence never expands work or delegation scope');
    expect(text).toContain('bounded candidate repos');
    expect(text).toContain('GitNexus-first evidence per candidate');
    expect(text).toContain('bounded direct repo reads');
    expect(text).toContain('definitions-only GitNexus results as pointers');
    expect(text).toContain('Delegate prompts should carry bounded direct repo-read context');
    expect(text).toContain('explicit file boundaries');
    expect(text).toContain('not graph work-run ids');
    expect(text).toContain('Graph Freshness / Refresh Trigger Boundary');
    expect(text).toContain('same shared freshness fields as stable Work');
    expect(text).toContain('.spec-first/graph/provider-status.json');
    expect(text).toContain('.spec-first/graph/graph-facts.json');
    expect(text).toContain('.spec-first/impact/bootstrap-impact-capabilities.json');
    expect(text).toContain('provider `query_ready=true`');
    expect(text).toContain('current `source_revision`, `worktree_dirty`, `worktree_status_hash`');
    expect(text).toContain('setup-owned provider projection / fingerprint freshness');
    expect(text).toContain('Branch switch, pull, rebase, merge');
    expect(text).toContain('provider fingerprint mismatch');
    expect(text).toContain('stale / bootstrap-required signals');
    expect(text).toContain('stale graph + lightweight work');
    expect(text).toContain('stale graph + graph-heavy work');
    expect(text).toContain('shared helper/API/route/provider contract/core workflow/cross-module changes');
    expect(text).toContain('review-pre-facts changes');
    expect(text).toContain('execution flows or blast radius');
    expect(text).toContain('recommend `$spec-graph-bootstrap` / `/spec:graph-bootstrap`');
    expect(text).toContain('Delegation prompts must carry the same stale-graph limitations');
    expect(text).toContain('must not ask workers to run GitNexus analyze, code-review-graph build');
    expect(text).toContain('provider repair, index rebuild, default git hooks, watchers, or daemons');
    expect(text).toContain('`detect_changes` / impact results are review evidence');
    expect(text).toContain('not refresh triggers');
    expect(text).toContain('Workspace Repo Scope');
    expect(text).toContain('per-unit/per-task `target_repo` values');
    expect(text).toContain('Delegation may split across child repos only when repo scopes and write sets are explicit');
    expect(text).toContain('advisory graph target facts');
    expect(text).not.toContain('spec-first ' + 'crg hook');
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

  test('keeps validated task packs as first-class executable work documents', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Treat a validated task pack as a first-class executable work document.');
    expect(text).toContain('The task pack supplies execution order, task boundaries, file focus, `stop_if`, and validation notes');
    expect(text).toContain('If the work document is already a validated task pack, do not offer task compilation again');
    expect(text).toContain('do not rebuild execution structure from the source plan');
    expect(text).toContain('Execute from the task pack\'s validated task structure');
    expect(text).toContain('preserve each task\'s `review_gate` and `review_focus` as review intent metadata');
    expect(text).toContain('for `review_gate: required`, treat the task as a task completion checkpoint');
    expect(text).toContain('record `pre_task_base` or an equivalent diff anchor');
    expect(text).toContain('if a reliable per-task diff range cannot be formed, stop and hand off');
    expect(text).toContain('same dependency/wave-boundary required gates may be batched');
    expect(text).toContain('terminal required tasks must still be covered before Phase 3 completes');
  });
});

describe('spec-work-beta requirements and shipping policy contract', () => {
  test('reads Requirements as the current plan section while preserving legacy compatibility', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');
    const shipping = fs.readFileSync(SHIPPING_WORKFLOW_PATH, 'utf8');

    expect(text).toContain('`Requirements` (or legacy `Requirements Trace`)');
    expect(text).toContain('Quality Check and Finishing Work');
    expect(text).toContain('you must read `references/shipping-workflow.md`');
    expect(text).toContain('Do not skip this.');
    expect(shipping).toContain('If the plan has a `Requirements` section (or legacy `Requirements Trace`)');
  });

  test('shipping review tiers use real host-native review or spec-code-review fallback', () => {
    const shipping = fs.readFileSync(SHIPPING_WORKFLOW_PATH, 'utf8');

    expect(shipping).toContain('Tier 1 -- host-native code review');
    expect(shipping).toContain('real built-in code review command or skill');
    expect(shipping).toContain('Do not treat ordinary self-review as Tier 1.');
    expect(shipping).toContain('Tier 2 -- `spec-code-review`');
    expect(shipping).toContain('No host-native review exists');
    expect(shipping).toContain('Sensitive surface touched');
    expect(shipping).toContain('Large and diffuse change');
    expect(shipping).toContain('Very large change');
    expect(shipping).toContain('Plan or task explicitly requests it');
    expect(shipping).toContain('Task-level review focus requests it');
    expect(shipping).toContain('This Tier 2 escalation does not require `review_gate: required`');
    expect(shipping).toContain('required gate by itself only requires the diff-scoped report-only checkpoint');
    expect(shipping).toContain('Code review completed (Tier 1 host-native or Tier 2 `spec-code-review`)');
    expect(shipping).not.toContain('inline self-review');
    expect(shipping).not.toContain('/simplify');
    expect(shipping).not.toContain('ce-simplify-code');
    expect(shipping).not.toContain('spec-simplify-code');
    expect(shipping).not.toContain('ce-code-review');
  });

  test('shipping notification includes verification and residual status in the final user response', () => {
    const shipping = fs.readFileSync(SHIPPING_WORKFLOW_PATH, 'utf8');

    expect(shipping).toContain('Completion Response Contract');
    expect(shipping).toContain('final user-visible response must be compact but complete');
    expect(shipping).toContain('Completed: <what changed and the main files or artifact paths>');
    expect(shipping).toContain('Verification: <commands/checks run with pass/fail/not-run status>');
    expect(shipping).toContain('Review: <review tier or workflow used, plus residual status>');
    expect(shipping).toContain('Artifacts: <PR link, plan/task-pack path, evidence, or known-residuals path when applicable>');
    expect(shipping).toContain('Next action: <only if the user needs to do something now>');
    expect(shipping).toContain('If a check was not run, say `not run` with the concrete reason.');
    expect(shipping).toContain('omit `Next action` instead of inventing follow-up work');
  });

  test('shipping notification keeps compound recommendation in parity with stable work', () => {
    const shipping = fs.readFileSync(SHIPPING_WORKFLOW_PATH, 'utf8');

    expect(shipping).toContain('Learning-worthy compound check');
    expect(shipping).toContain('LLM-owned judgment, not a script classifier');
    expect(shipping).toContain('Skip silently');
    expect(shipping).toContain('mechanical fixes');
    expect(shipping).toContain('one-off docs edits');
    expect(shipping).toContain('formatting-only changes');
    expect(shipping).toContain('cannot be stated in one sentence');
    expect(shipping).toContain('Offer neutrally');
    expect(shipping).toContain('reusable diagnostic path');
    expect(shipping).toContain('Lean into the offer');
    expect(shipping).toContain('pattern appears in 3+ places');
    expect(shipping).toContain('current host\'s compound entrypoint with brief context');
    expect(shipping).toContain('Do not automatically run `spec-compound`');
    expect(shipping).toContain('do not write `docs/solutions/`');
    expect(shipping).toContain('do not make compound capture a completion gate');
    expect(shipping).not.toContain('$spec-compound-auto');
    expect(shipping).not.toContain('/spec:compound-auto');
    expect(shipping).not.toContain('spec-first compound-auto');
  });

  test('tracker defer uses emitted review artifact path instead of hardcoded /tmp', () => {
    const trackerDefer = fs.readFileSync(TRACKER_DEFER_PATH, 'utf8');

    expect(trackerDefer).toContain('the `spec-code-review` return named a parent-owned run artifact path');
    expect(trackerDefer).toContain('`<artifact-path>/<reviewer>.json`');
    expect(trackerDefer).toContain('Do not hardcode `/tmp`');
    expect(trackerDefer).toContain('on Windows the temp root may be `%TEMP%`');
    expect(trackerDefer).toContain('review workflow\'s returned artifact path is the authority');
    expect(trackerDefer).toContain('continued in spec-code-review run artifact: <artifact-path>');
    expect(trackerDefer).not.toContain('/tmp/spec-first/spec-code-review/<run-id>');
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

  test('Codex delegation preserves task-pack review gates and orchestrator ownership', () => {
    const reference = fs.readFileSync(DELEGATION_REFERENCE_PATH, 'utf8');

    expect(reference).toContain('batching must preserve task-pack metadata and review gates');
    expect(reference).toContain('Carry `task_id`, `dependencies`, `wave`, `review_gate`, and `review_focus`');
    expect(reference).toContain('Do not place a dependent task in the same delegated batch when its prerequisite has `review_gate: required`');
    expect(reference).toContain('the orchestrator must pause after the prerequisite batch');
    expect(reference).toContain('Same dependency/wave-boundary required gates may be batched');
    expect(reference).toContain('Workers must not decide that a required gate is satisfied');
    expect(reference).toContain('<task_pack_metadata>');
    expect(reference).toContain('review_gate, review_focus, stop_if, declared files, and source_plan');
    expect(reference).toContain('Do not mark `review_gate: required` as satisfied');
  });

  test('Codex delegation stages only batch-owned non-secret paths', () => {
    const reference = fs.readFileSync(DELEGATION_REFERENCE_PATH, 'utf8');

    expect(reference).not.toContain('git add $(git diff --name-only HEAD; git ls-files --others --exclude-standard)');
    expect(reference).toContain('build the batch-owned set from the combined `Files` list');
    expect(reference).toContain('expected_side_effects');
    expect(reference).toContain('Compare actual modified/untracked files to `(batch-owned files ∪ expected_side_effects)` before staging');
    expect(reference).toContain('extend-batch');
    expect(reference).toContain('drop-stray');
    expect(reference).toContain('abort');
    expect(reference).toContain('src/cli/contracts/security/secret-deny-patterns.json');
    expect(reference).toContain('Any path matching the deny list is rejected and surfaced, even when it is batch-owned');
    expect(reference).toContain('Env files remain denied by default even when a worktree was created with `--copy-env`');
    expect(reference).toContain('git add --pathspec-from-file "$batch_stage_paths" --pathspec-file-nul');
  });
});

describe('spec-work-beta Codex delegation config contract', () => {
  test('model and reasoning effort defer to Codex config when unset or invalid', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(skill).toContain('For optional settings without a hard default (`work_delegate_model`, `work_delegate_effort`)');
    expect(skill).toContain('defers to the user\'s `~/.codex/config.toml` default');
    expect(skill).toContain('resolves to unset and defers to the user\'s `~/.codex/config.toml` default');
    expect(skill).toContain('`delegate_model` -- string from config, or unset');
    expect(skill).toContain('`delegate_effort` -- config floor from config, or unset');
    expect(skill).toContain('Never pass `delegate_effort` directly to `codex exec`');
    expect(skill).toContain('each batch computes an `effective_effort`');
    expect(skill).not.toContain('`delegate_model` -- string (from config or default `gpt-5.4`)');
    expect(skill).not.toContain('`delegate_effort` -- string (from config or default `high`)');
  });

  test('config pre-resolution guards empty repo roots before reading local config', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(skill).toContain('(top=$(git rev-parse --show-toplevel 2>/dev/null); [ -n "$top" ]');
    expect(skill).toContain('|| echo \'__NO_CONFIG__\'');
    expect(skill).not.toContain('git rev-parse --path-format=absolute --git-common-dir');
    expect(skill).not.toContain('cat "$(dirname "$common")/.spec-first/config.local.yaml"');
    expect(skill).not.toContain('cat "$(git rev-parse --show-toplevel 2>/dev/null)/.spec-first/config.local.yaml"');
  });

  test('Codex availability pre-resolution uses a path probe with runtime fallback', () => {
    const reference = fs.readFileSync(DELEGATION_REFERENCE_PATH, 'utf8');

    expect(reference).toContain('Codex CLI path (pre-resolved)');
    expect(reference).toContain('command -v codex 2>/dev/null || true');
    expect(reference).toContain('shows an absolute path');
    expect(reference).toContain('run `command -v codex` via the shell/Bash tool');
    expect(reference).not.toContain('CODEX_AVAILABLE');
    expect(reference).not.toContain('CODEX_NOT_FOUND');
    expect(reference).not.toContain('command -v codex >/dev/null 2>&1 && echo');
  });

  test('codex exec uses current sandbox flags and per-batch effective effort', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');
    const reference = fs.readFileSync(DELEGATION_REFERENCE_PATH, 'utf8');

    expect(skill).not.toContain('--full-auto');
    expect(reference).not.toContain('--full-auto');
    expect(reference).not.toContain('(--yolo)');
    expect(reference).toContain('full-auto mode');
    expect(reference).toContain('-s workspace-write');
    expect(reference).toContain('[sandbox_workspace_write]');
    expect(reference).toContain('network_access = true');
    expect(reference).toContain('--dangerously-bypass-approvals-and-sandbox');

    expect(reference).toContain('Per-Batch Effort');
    expect(reference).toContain('`delegate_effort` is a config floor');
    expect(reference).toContain('raise `effective_effort`, never lower it');
    expect(reference).toContain('Every batch stores `effective_effort`');
    expect(reference).toContain('If `effective_effort` is `default`, omit the `-c` line');
    expect(reference).toContain('Never pass the literal default value through `model_reasoning_effort`');
    expect(reference).toContain('Do not pass `<delegate_effort>` through to `codex exec`');

    expect(reference).toContain('Conditional flags');
    expect(reference).toContain('If `delegate_model` is set');
    expect(reference).toContain('If `effective_effort` is `medium`, `high`, or `xhigh`');
    expect(reference).toContain('Do not substitute a placeholder string for unset values.');
    expect(reference).not.toContain('  -m "<delegate_model>" \\\n  -c \'model_reasoning_effort="<delegate_effort>"\'');
    expect(reference).not.toContain('model_reasoning_effort="<delegate_effort>"');
    expect(reference).not.toContain('model_reasoning_effort="default"');
    expect(reference).not.toContain('model_reasoning_effort="minimal"');
    expect(reference).not.toContain('model_reasoning_effort="low"');
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

  test('gives users a compact handoff when beta execution cannot continue safely', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('User-Facing Handoff Contract');
    expect(text).toContain('delegation deactivation');
    expect(text).toContain('do not stop with only "return to spec-plan" or a bare workflow name');
    expect(text).toContain('Blocking reason: <specific reason execution cannot continue safely>');
    expect(text).toContain('Recommended entrypoint: <current-host public entrypoint or standalone skill name>');
    expect(text).toContain('Next action: <copy-ready invocation or short reply phrase>');
    expect(text).toContain('delegation gate result');
    expect(text).toContain('something the user can immediately run or approve');
    expect(text).toContain('do not give a menu of every possible workflow');
  });
});
