'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'spec-debug', 'SKILL.md');

describe('spec-debug branch-aware handoff contract', () => {
  test('consumes domain context before debugging questions without fixed ADR directory mandates', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Domain Language And Decision Ledger');
    expect(text).toContain('consume existing context before asking questions that repo/docs can answer');
    expect(text).toContain('already-loaded project standards and host instructions, `docs/contracts/`, existing plans/solutions');
    expect(text).toContain('Read `AGENTS.md` / `CLAUDE.md` source only under the Host Instruction Reuse Policy');
    expect(text).toContain('repo-local glossary or ADR-like artifacts that actually exist');
    expect(text).toContain('Do not require a fixed `CONTEXT.md`, `docs/adr/`, or glossary directory.');
    expect(text).toContain('If those artifacts are absent, treat the gap as advisory and continue');
    expect(text).toContain('`question`, `recommended_answer`, `source_tag`, `chosen_answer`, `consequence`, and `deferred_reason`');
    expect(text).toContain('`confirmed`, `advisory`, `session-local`, `stale`, or `user`');
    expect(text).toContain('fix direction is hard to reverse, would be surprising without context, and reflects a real tradeoff');
    expect(text).not.toContain('must use `CONTEXT.md`');
    expect(text).not.toContain('must use `docs/adr/`');
  });

  test('uses workspace graph targets only for read-only debugging evidence', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Context Orientation Anchor');
    expect(text).toContain('already-loaded host/project instructions');
    expect(text).toContain('not automatic re-read targets for every debug run');
    expect(text).toContain('Host Instruction Reuse Policy allows it');
    expect(text).toContain('Maintain a run-local context ledger for this workflow');
    expect(text).toContain('Reuse loaded summaries within the same workflow run');
    expect(text).toContain('Re-read only when exact wording is needed');
    expect(text).toContain('workspace-graph-targets.v1');
    expect(text).toContain('workspace-gitnexus-readiness.v1');
    expect(text).toContain('group or bounded registry/per-repo evidence');
    expect(text).toContain('`group-missing` is fallback context, not provider failure');
    expect(text).toContain('GitNexus-first queries');
    expect(text).toContain('degraded-fallback');
    expect(text).toContain('definitions-only GitNexus results as file/symbol pointers');
    expect(text).toContain('single explicit `target_repo` or per-fix repo scope');
    expect(text).toContain('do not let cwd, graph target facts, group readiness facts, or live MCP results choose a sibling repo for edits');
    expect(text).toContain('Graph Freshness / Refresh Trigger Boundary');
    expect(text).toContain('.spec-first/graph/provider-status.json');
    expect(text).toContain('.spec-first/graph/graph-facts.json');
    expect(text).toContain('.spec-first/impact/bootstrap-impact-capabilities.json');
    expect(text).toContain('provider `query_ready=true`');
    expect(text).toContain('current `source_revision`, `worktree_dirty`, `worktree_status_hash`');
    expect(text).toContain('setup-owned provider projection / fingerprint freshness');
    expect(text).toContain('Branch switch, pull, rebase, merge');
    expect(text).toContain('provider fingerprint mismatch');
    expect(text).toContain('stale / bootstrap-required signals');
    expect(text).toContain('stale graph + lightweight debugging');
    expect(text).toContain('stale graph + graph-heavy debugging');
    expect(text).toContain('shared helper/API/route/provider contract/core workflow/cross-module failures');
    expect(text).toContain('review-pre-facts failures');
    expect(text).toContain('execution flows and blast radius');
    expect(text).toContain('recommend `$spec-graph-bootstrap` / `/spec:graph-bootstrap`');
    expect(text).toContain('Debug must not run GitNexus analyze/build/index refresh');
    expect(text).toContain('provider repair, default git hooks, watchers, or daemons');
  });

  test('skill-owned branches default to commit-and-PR with explicit override checks', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Skill-owned branch: default to commit-and-PR without prompting');
    expect(text).toContain('Check contextual overrides first');
    expect(text).toContain('already-loaded repo instructions');
    expect(text).toContain('Read `AGENTS.md` / `CLAUDE.md` source only if the loaded instruction context is missing');
    expect(text).toContain('Run `git-commit-push-pr`');
    expect(text).toContain('Pre-existing branch: ask the user');
  });

  test('compound capture is offered only for generalizable lessons', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('After a PR is open: consider offering learning capture');
    expect(text).toContain('Skip silently');
    expect(text).toContain('fix is mechanical');
    expect(text).toContain('Offer neutrally');
    expect(text).toContain('Lean into the offer');
    expect(text).toContain('pattern appears in 3+ locations');
    expect(text).toContain('run `spec-compound`');
  });

  test('design rethinking handoff uses the current host brainstorm entrypoint', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('current host\'s brainstorm entrypoint');
    expect(text).not.toContain('**Rethink the design** (`/spec:brainstorm`)');
    expect(text).not.toContain('suggest `/spec:brainstorm`');
    expect(text).not.toContain('transferred to `/spec:brainstorm`');
    expect(text).not.toContain('/spec:brainstorm` on Claude Code');
    expect(text).not.toContain('$spec-brainstorm` on Codex');
  });

  test('trivial fast-path is narrow and still keeps choice and workspace gates', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Trivial-bug fast-path');
    expect(text).toContain('single-file typo');
    expect(text).toContain('missing import');
    expect(text).toContain('null dereference');
    expect(text).toContain('off-by-one');
    expect(text).toContain('Fast-path does not skip Phase 2');
    expect(text).toContain('Fix it now');
    expect(text).toContain('Diagnosis only');
    expect(text).toContain('Workspace and branch check');
    expect(text).toContain('Negative boundary');
    expect(text).toContain('Do not use the fast-path for multi-file causal chains');
    expect(text).toContain('Non-trivial bugs still require the full investigation path');
  });

  test('hypotheses require concrete observations and failed fixes invalidate evidence first', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Feedback Loop And Hypothesis Ledger');
    expect(text).toContain('Before declaring root cause or proposing a fix, establish or attempt the smallest feedback loop that can observe the symptom');
    expect(text).toContain('a failing test, CLI invocation, HTTP/browser script, trace replay, throwaway harness, property/fuzz loop');
    expect(text).toContain('record `feedback_loop_not_possible` with the exact missing condition');
    expect(text).toContain('do not pretend a loop exists');
    expect(text).toContain('`hypothesis`, `prediction`, `evidence_for`, `evidence_against`, `probe_result`, and `final_root_cause`');
    expect(text).toContain('After a fix, rerun the same feedback loop or state why it cannot be rerun before handoff');
    expect(text).toContain('Concrete observation');
    expect(text).toContain('runtime value');
    expect(text).toContain('log line');
    expect(text).toContain('instrumented boundary');
    expect(text).toContain('working comparison');
    expect(text).toContain('specific code reference');
    expect(text).toContain('Failed fix evidence reset');
    expect(text).toContain('record the invalidated evidence before forming the next hypothesis');
    expect(text).toContain('Do not stack another fix attempt on top of a contradicted hypothesis');
    expect(text).toContain('optional `graph_evidence`');
    expect(text).toContain('Use `graph_evidence` only when GitNexus evidence shaped the hypothesis');
    expect(text).toContain('capability name, compact result summary, freshness/grade');
    expect(text).toContain('`graph_evidence` does not replace `evidence_for` source/test confirmed facts');
    expect(text).toContain('stale graph + graph-heavy debugging should still recommend `$spec-graph-bootstrap`');
    expect(text).toContain('every uncertain link informed by that graph evidence must be closed by at least one non-graph observation');
    expect(text).toContain('reproduction, source read, log line, runtime value, or test result');
    expect(text).toContain('GitNexus-backed root cause with no non-graph confirmation violates this gate');
    expect(text).toContain('applies only to hypotheses that use `graph_evidence`');
  });

  test('debug summary can disclose validated and advisory graph claims', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('**Graph evidence** (when applicable):');
    expect(text).toContain('graph_claims_validated_by');
    expect(text).toContain('graph_claims_remaining_advisory');
    expect(text).toContain('confirmed by reproduction/source/log/test');
    expect(text).toContain('not independently confirmed');
  });

  test('multi-repo debug requires target repo before fixes even with group evidence', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('single explicit `target_repo` or per-fix repo scope');
    expect(text).toContain('even when GitNexus group evidence is ready');
    expect(text).toContain('do not let cwd, graph target facts, group readiness facts, or live MCP results choose a sibling repo for edits');
  });

  test('fix phase preserves project test conventions and right-sized review', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Read the nearby or project-level testing convention before adding a reproduction test');
    expect(text).toContain('match the existing test style, fixture pattern, and command shape');
    expect(text).toContain('Self-review every changed line against the root cause');
    expect(text).toContain('remove only debris introduced by this fix');
    expect(text).toContain('do not refactor unrelated code');
    expect(text).toContain('Review scope');
    expect(text).toContain('non-trivial fixes');
    expect(text).toContain('lightweight code review');
    expect(text).toContain('current host\'s code-review entrypoint');
    expect(text).toContain('Do not invoke a full review ritual for an obvious mechanical fix');
  });
});
