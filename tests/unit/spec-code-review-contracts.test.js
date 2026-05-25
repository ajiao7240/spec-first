'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { getAdapter } = require('../../src/cli/adapters');

const SKILL_PATH = path.join(__dirname, '..', '..', 'skills', 'spec-code-review', 'SKILL.md');
const PRE_FACTS_CONTRACT_PATH = path.join(
  __dirname,
  '..',
  '..',
  'docs',
  'contracts',
  'workflows',
  'review-pre-facts-extraction.md',
);
const CODE_REVIEW_BASELINE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'docs',
  'validation',
  'review-pre-facts',
  'code-review-baseline-2026-05-12.md',
);

function renderWorkflowSkill(platform) {
  const adapter = getAdapter(platform);
  return adapter.transformSkillContent(fs.readFileSync(SKILL_PATH, 'utf8'), {
    skillName: 'spec-code-review',
    isWorkflowSkill: true,
  });
}

describe('spec-code-review context orientation contract', () => {
  test('starts from diff evidence and keeps findings reviewer-owned', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');
    expect(text).toContain('Context Orientation Anchor');
    expect(text).toContain('diff scope');
    expect(text).toContain('plan/task/work artifacts when present');
    expect(text).toContain('already-loaded host/project instructions');
    expect(text).toContain('not automatic re-read targets for every review run');
    expect(text).toContain('Stage 3b is the narrow project-standards persona exception');
    expect(text).toContain('nearby implementation files');
    expect(text).toContain('nearby tests');
    expect(text).toContain('prefer live GitNexus MCP evidence for concrete review questions');
    expect(text).toContain('fall back to bounded direct repo reads');
    expect(text).toContain('they do not update compiled `query_ready`');
    expect(text).toContain('definitions-only evidence');
    expect(text).toContain('local file/symbol pointers');
    expect(text).toContain('live MCP/provider startup or call fails');
    expect(text).toContain('treat that provider as degraded evidence rather than a reviewer failure');
    expect(text).toContain('do not repeatedly probe the same unavailable provider across personas');
    expect(text).toContain('Record the provider degradation once in Coverage');
    expect(text).toContain('External tools may prioritize inspection, but they do not define scope authority or replace reviewer judgment');
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
    expect(text).toContain('stale graph + lightweight review');
    expect(text).toContain('stale graph + graph-heavy review');
    expect(text).toContain('shared helper/API/route/provider contract/core workflow/cross-module changes');
    expect(text).toContain('review-pre-facts changes');
    expect(text).toContain('execution flows, impact, `detect_changes`, or blast radius');
    expect(text).toContain('recommend `$spec-graph-bootstrap` / `/spec:graph-bootstrap`');
    expect(text).toContain('Code Review must not run GitNexus analyze/build/index refresh');
    expect(text).toContain('provider repair, default git hooks, watchers, or daemons');
    expect(text).toContain('does not by itself disable reviewer dispatch');
    expect(text).toContain('group changed files by Git repo');
    expect(text).toContain('Resolve graph readiness, diff context, impact evidence, and test suggestions per child repo');
    expect(text).toContain('workspace-graph-targets.v1');
    expect(text).toContain('workspace-gitnexus-readiness.v1');
    expect(text).toContain('`group.status="group-ready"`');
    expect(text).toContain('bounded registry/per-repo fallback');
    expect(text).toContain('GitNexus is the primary diff-impact evidence source when available');
    expect(text).toContain('stale, unavailable, or definitions-only GitNexus evidence falls back to bounded registry/per-repo/direct diff reads');
    expect(text).toContain('changed-symbol impact, related-test candidate, or blast-radius supporting evidence');
    expect(text).toContain('GitNexus-first evidence for bounded candidate repos');
    expect(text).toContain('degraded-fallback or definitions-only limitations');
    expect(text).not.toContain('Code-review-graph is the review/diff-impact provider');
    expect(text).not.toContain('Code-review-graph remains the primary diff impact provider');
    expect(text).not.toContain('code-review-graph build');
    expect(text).toContain('autofix review must not edit a child repo unless that repo is explicit');
    expect(text).toContain('risk assessments must remain scoped to the repo that owns the file');
    expect(text).toContain('Discover project standards paths');
    expect(text).toContain('find all `**/CLAUDE.md` and `**/AGENTS.md` in the repo');
    expect(text).toContain('Pass the resulting path list to the `project-standards` persona inside a `<standards-paths>` block');
    expect(text).not.toContain('docs/examples/standards-' + 'glue-consumption-examples.md');
    expect(text).not.toContain('.spec-first/' + 'standards/');
    expect(text).not.toContain('<standards-baseline-paths>');
    expect(text).not.toContain('spec-first ' + 'crg hook');
    expect(text).not.toContain('stage0-context');
    expect(text).not.toContain('selected_assets');
  });

  test('consumes domain context before findings without fixed ADR directory mandates', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Domain Language And Decision Ledger');
    expect(text).toContain('consume existing context before asking questions or raising gaps that repo/docs can answer');
    expect(text).toContain('already-loaded project standards and host instructions, `docs/contracts/`, existing brainstorms/plans/solutions');
    expect(text).toContain('Read `AGENTS.md` / `CLAUDE.md` source only under the Host Instruction Reuse Policy or the Stage 3b project-standards persona exception');
    expect(text).toContain('repo-local glossary or ADR-like artifacts that actually exist');
    expect(text).toContain('Do not require a fixed `CONTEXT.md`, `docs/adr/`, or glossary directory.');
    expect(text).toContain('record the limitation in Coverage as advisory context rather than blocking the review');
    expect(text).toContain('`question`, `recommended_answer`, `source_tag`, `chosen_answer`, `consequence`, and `deferred_reason`');
    expect(text).toContain('`confirmed`, `advisory`, `session-local`, `stale`, or `user`');
    expect(text).toContain('hard to reverse, would be surprising without context, and reflects a real tradeoff');
    expect(text).not.toContain('must use `CONTEXT.md`');
    expect(text).not.toContain('must use `docs/adr/`');
  });

  test('review checks feedback loops without forcing TDD ritual on docs-only changes', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Feedback Loop Review Boundary');
    expect(text).toContain('When reviewing behavior-bearing changes, check whether the work established and reran a feedback loop appropriate to the change');
    expect(text).toContain('failing or characterization tests, CLI invocation, HTTP/browser script, trace replay, throwaway harness, property/fuzz loop');
    expect(text).toContain('Findings should name the missing observable risk, not demand TDD ritual by default');
    expect(text).toContain('For docs-only and config-only changes, docs contract checks, schema/help/render checks, generated catalog diff checks, or diff-shape review can be sufficient verification');
    expect(text).toContain('Do not flag "no test-first loop" when the change has no behavior-bearing code');
  });
});

describe('spec-code-review pre-facts baseline gate contract', () => {
  test('shared contract defines code-review baseline gate and report-only no-artifact boundary', () => {
    const contract = fs.readFileSync(PRE_FACTS_CONTRACT_PATH, 'utf8');
    const baseline = fs.readFileSync(CODE_REVIEW_BASELINE_PATH, 'utf8');

    expect(contract).toContain('docs/validation/review-pre-facts/code-review-baseline-YYYY-MM-DD.md');
    expect(contract).toContain('Gate passes only when read count is available');
    expect(contract).toContain('wall time is comparable');
    expect(contract).toContain('at least two reviewers repeatedly read the same changed file/caller/test');
    expect(contract).toContain('P0/P1 parity can be manually checked');
    expect(contract).toContain('dirty snapshot behavior is recorded');
    expect(contract).toContain('Code-review pre-facts baseline: inconclusive (<reason>)');
    expect(contract).toContain('code-review Stage 4a and template injection remain follow-up work');
    expect(contract).toContain('Pre-facts skipped (report-only no-artifact boundary)');
    expect(baseline).toContain('Code-review pre-facts baseline: inconclusive (read_count_unavailable)');
    expect(baseline).toContain('Stage 4a default pre-facts injection and code-review template `{codebase_facts}` injection remain follow-up work');
    expect(baseline).toContain('Doc-review pre-facts delivery is not blocked');
  });
});

describe('spec-code-review compound recommendation contract', () => {
  test('final report can recommend compound only as advisory learning capture', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');
    const template = fs.readFileSync(
      path.join(__dirname, '..', '..', 'skills', 'spec-code-review', 'references', 'review-output-template.md'),
      'utf8',
    );

    expect(skill).toContain('Learning Capture Recommendation');
    expect(skill).toContain('new reusable lesson worth capturing');
    expect(skill).toContain('advisory only');
    expect(skill).toContain('not a finding');
    expect(skill).toContain('not residual actionable work');
    expect(skill).toContain('not a verdict input');
    expect(skill).toContain('not an autofix item');
    expect(skill).toContain('not a merge gate');
    expect(skill).toContain('Skip silently');
    expect(skill).toContain('mechanical fixes');
    expect(skill).toContain('one-off docs edits');
    expect(skill).toContain('formatting-only changes');
    expect(skill).toContain('cannot be stated in one sentence');
    expect(skill).toContain('Offer neutrally');
    expect(skill).toContain('repeated finding pattern');
    expect(skill).toContain('reusable review heuristic');
    expect(skill).toContain('Lean into the offer');
    expect(skill).toContain('pattern appears in 3+ places');
    expect(skill).toContain('current host\'s compound entrypoint with brief context');
    expect(skill).toContain('In report-only, autofix, and headless modes, ask no questions');
    expect(skill).toContain('include at most one advisory line');
    expect(skill).toContain('Do not automatically run `spec-compound`');
    expect(skill).toContain('do not write `docs/solutions/`');
    expect(skill).toContain('do not file tickets');
    expect(skill).toContain('do not add extra prompts because of this checklist');
    expect(skill).toContain('recommend `spec-compound-refresh` only with a narrow scope hint');
    expect(skill).toContain('Learning Capture Recommendation:');
    expect(template).toContain('### Learning Capture Recommendation');
    expect(template).toContain('current host\'s compound entrypoint with brief context');
    expect(template).toContain('include only when the current review produced a new reusable lesson');
    expect(skill).not.toContain('$spec-compound-auto');
    expect(skill).not.toContain('/spec:compound-auto');
    expect(skill).not.toContain('spec-first compound-auto');
  });
});

describe('spec-code-review CE sync contracts', () => {
  test('quick review only short-circuits to a real host built-in', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Quick Review Short-Circuit');
    expect(text).toContain('Use a real built-in only');
    expect(text).toContain('No invented fallback');
    expect(text).toContain('Codex currently has no universal slash-command review primitive');
    expect(text).toContain('quick intent falls through to the full pipeline');
  });

  test('requirements completeness reads current and legacy implementation unit formats', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Recognize both current heading-style units (`### U1. [Name]`)');
    expect(text).toContain('legacy list-item units (`- U1. **[Name]**`)');
    expect(text).toContain('Store the extracted requirements list, implementation unit IDs/titles, and `plan_source`');
  });

  test('interactive findings tables escape literal pipe characters', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');
    const template = fs.readFileSync(
      path.join(__dirname, '..', '..', 'skills', 'spec-code-review', 'references', 'review-output-template.md'),
      'utf8',
    );

    for (const text of [skill, template]) {
      expect(text).toContain('Escape every literal pipe');
      expect(text).toContain('`\\|`');
      expect(text).toContain('TypeScript union types');
    }
  });

  test('uses OS temp run artifacts and best-judgment routing without bulk preview', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');
    const bulkPreview = fs.readFileSync(
      path.join(__dirname, '..', '..', 'skills', 'spec-code-review', 'references', 'bulk-preview.md'),
      'utf8',
    );
    const walkthrough = fs.readFileSync(
      path.join(__dirname, '..', '..', 'skills', 'spec-code-review', 'references', 'walkthrough.md'),
      'utf8',
    );

    expect(text).toContain('`<review-artifact-dir>/` is a session/orchestrator handoff');
    expect(text).toContain('Resolve it under the current OS temp directory');
    expect(text).toContain('`os.tmpdir()` / `$TMPDIR` / `%TEMP%`');
    expect(text).toContain('Do not hardcode `/tmp`');
    expect(text).toContain('include the concrete path in every `Artifact:` line or structured return');
    expect(text).toContain('session/orchestrator handoff, not repo-local durable truth');
    expect(text).toContain('Do not promise it will be committed or retained.');
    expect(text).toContain('docs/residual-review-findings/<branch-or-head-sha>.md');
    expect(text).toContain('do not durable-store the full per-reviewer JSON bundle by default');
    expect(text).not.toContain('.spec-first/workflows/spec:code-review');
    expect(text).toContain('Auto-resolve with best judgment — apply per-finding fixes the agent can defend, surface the rest');
    expect(text).toContain('No Stage 5b validator pre-pass. No bulk-preview approval gate.');
    expect(text).toContain('post-run failure-handling question');
    expect(text).toContain('no issue tracker is configured for this checkout');
    expect(text).not.toContain('tracker sink');
    expect(text).not.toContain('/tmp/spec-first/spec-code-review/<run-id>');

    expect(bulkPreview).toContain('One call site');
    expect(bulkPreview).toContain('Routing option C (top-level File tickets)');
    expect(bulkPreview).toContain('Best-judgment fix paths do **not** use this preview.');
    expect(bulkPreview).not.toContain('Routing option B (top-level');

    expect(walkthrough).toContain('No `suggested_fix`:');
    expect(walkthrough).toContain('hide option A (`Apply the proposed fix`)');
    expect(walkthrough).toContain('Do not run Stage 5b and do not call `bulk-preview.md` for this path.');
    expect(walkthrough).toContain('There is no second dispatch in that branch.');
    expect(walkthrough).not.toContain('Auto-resolve with best judgment on the rest → Proceed');
    expect(walkthrough).not.toContain('Auto-resolve with best judgment on the rest → Cancel');
    expect(walkthrough).toContain('Walk-through bailed via `Auto-resolve with best judgment on the rest`');
    expect(walkthrough).not.toContain('Walk-through bailed via `Auto-resolve with best judgment on the rest → Proceed`');
  });

  test('schema and subagent template push reviewers to provide defensible suggested fixes', () => {
    const schema = fs.readFileSync(
      path.join(__dirname, '..', '..', 'skills', 'spec-code-review', 'references', 'findings-schema.json'),
      'utf8',
    );
    const template = fs.readFileSync(
      path.join(__dirname, '..', '..', 'skills', 'spec-code-review', 'references', 'subagent-template.md'),
      'utf8',
    );

    expect(schema).toContain('safe_auto = local mechanical fix');
    expect(schema).toContain('The wrong-side cost is symmetric');
    expect(schema).toContain('bias toward safe_auto when the rubric permits');
    expect(schema).toContain('no change to function signature, public-API/error contract, security posture, or permission model');
    expect(schema).toContain('helper extraction, naming/placement must follow mechanically');
    expect(schema).toContain('Propose one whenever any defensible code change is reachable');
    expect(schema).toContain('I need <specific input> to commit');
    expect(template).toContain('you can articulate the fix in one sentence');
    expect(template).toContain('Boundary cases that often feel risky but are still `safe_auto`');
    expect(template).toContain('A nil guard that turns a crash into a nil-return is `safe_auto`');
    expect(template).toContain('The "I need `<specific input>` before I can commit" framing is a soft punt');
    expect(template).toContain('Pair `manual` with a concrete `suggested_fix` whenever you can defend one');
    expect(template).toContain('Imperfect information is not grounds for omission');
  });

  test('tracker defer references keep the tracker confidence tuple consistent', () => {
    const files = [
      path.join(__dirname, '..', '..', 'skills', 'spec-code-review', 'references', 'tracker-defer.md'),
      path.join(__dirname, '..', '..', 'skills', 'spec-work', 'references', 'tracker-defer.md'),
      path.join(__dirname, '..', '..', 'skills', 'lfg', 'references', 'tracker-defer.md'),
    ];

    for (const filePath of files) {
      const text = fs.readFileSync(filePath, 'utf8');

      expect(text).toContain('{ tracker_name, confidence, named_sink_available, any_sink_available }');
      expect(text).toContain('Primary sources are already-loaded project guidance plus precise tracker lookups');
      expect(text).toContain('Check already-loaded project guidance for tracker references');
      expect(text).toContain('perform a precise lookup for tracker references');
      expect(text).toContain('avoid full-file reads unless the exact lookup is inconclusive and Defer execution is imminent');
      expect(text).toContain('confidence = high');
      expect(text).toContain('confidence = low');
      expect(text).not.toContain('Primary sources: `CLAUDE.md` and `AGENTS.md`');
      expect(text).not.toContain('Read `CLAUDE.md` / `AGENTS.md` for tracker references');
      expect(text).not.toContain('confidence-first');
      expect(text).not.toContain('tracker_confidence');
    }
  });

  test('all tracker defer references use emitted review artifact paths instead of hardcoded temp roots', () => {
    const files = [
      path.join(__dirname, '..', '..', 'skills', 'spec-code-review', 'references', 'tracker-defer.md'),
      path.join(__dirname, '..', '..', 'skills', 'spec-work', 'references', 'tracker-defer.md'),
      path.join(__dirname, '..', '..', 'skills', 'lfg', 'references', 'tracker-defer.md'),
    ];

    for (const filePath of files) {
      const text = fs.readFileSync(filePath, 'utf8');

      expect(text).toContain('<artifact-path>/<reviewer>.json');
      expect(text).toContain('Do not hardcode `/tmp`');
      expect(text).toContain('review workflow\'s returned artifact path is the authority');
      expect(text).not.toContain('/tmp/spec-first/spec-code-review/<run-id>');
    }
  });

  test('bulk preview remains option-C only after best-judgment migration', () => {
    const bulkPreview = fs.readFileSync(
      path.join(__dirname, '..', '..', 'skills', 'spec-code-review', 'references', 'bulk-preview.md'),
      'utf8',
    );

    expect(bulkPreview).toContain('One call site');
    expect(bulkPreview).toContain('Options (exactly two for routing option C)');
    expect(bulkPreview).not.toContain('in all three cases');
  });

  test('model tiering avoids hard-coded non-Claude model names', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('use only a host-provided stable alias or omit the model parameter');
    expect(text).toContain('do not invent a model name from memory');
    expect(text).toContain('on other platforms use a host-provided cheap stable alias or omit the model parameter');
    expect(text).not.toContain('gpt-5.4-mini');
    expect(text).not.toContain('gpt-5.4-nano');
  });

  test('runtime readiness preflight prevents multiplying broken MCP startup across reviewers', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');
    const claudeRuntime = renderWorkflowSkill('claude');
    const codexRuntime = renderWorkflowSkill('codex');

    for (const content of [text, claudeRuntime, codexRuntime]) {
      expect(content).toContain('Runtime readiness preflight');
      expect(content).toContain('spec-mcp-setup');
      expect(content).toContain('detect-tools.sh');
      expect(content).toContain('host_config_status: ready | fallback-active | not-required');
      expect(content).toContain('host_config_status: action-required | precedence-blocked');
      expect(content).toContain('not safe for multi-persona dispatch');
      expect(content).toContain('runtime boundary issue');
      expect(content).toContain('Record it once in Coverage');
      expect(content).toContain('Graph provider `query_ready: false`');
      expect(content).toContain('does not by itself disable reviewer dispatch');
      expect(content).toContain('When a required MCP server is not host-config-ready before dispatch');
      expect(content).toContain('do not spawn reviewer agents');
      expect(content).toContain('single_agent_report_only_fallback: true');
      expect(content).toContain('runtime readiness preflight unavailable');
      expect(content).toContain('MCP startup incomplete');
    }

    expect(text).toContain('bash skills/spec-mcp-setup/scripts/detect-tools.sh');
    expect(claudeRuntime).toContain('bash .claude/spec-first/workflows/spec-mcp-setup/scripts/detect-tools.sh');
    expect(codexRuntime).toContain('bash .agents/skills/spec-mcp-setup/scripts/detect-tools.sh');
    expect(codexRuntime).toContain('| Claude runtime | `bash .claude/spec-first/workflows/spec-mcp-setup/scripts/detect-tools.sh` |');
    expect(codexRuntime).not.toContain('| Claude runtime | `bash .agents/skills/spec-mcp-setup/scripts/detect-tools.sh` |');
  });

  test('preflight consumes plan and work graph evidence once and reports Coverage posture', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');
    const template = fs.readFileSync(
      path.join(__dirname, '..', '..', 'skills', 'spec-code-review', 'references', 'review-output-template.md'),
      'utf8',
    );

    expect(text).toContain('After `detect-tools.sh` and before reviewer dispatch, consolidate downstream graph evidence once');
    expect(text).toContain('`## Graph / GitNexus Evidence` block');
    expect(text).toContain('`evidence_grade`, `evidence_posture`, `capabilities_used`, `limitations`');
    expect(text).toContain('`Graph evidence: unavailable (no plan evidence)`');
    expect(text).toContain('spec-work run artifact path / `run_id`');
    expect(text).toContain('read `graph_evidence_used` as best-effort session-local supplement');
    expect(text).toContain('spec-first internal spec-work-run-artifact read --target-repo <repo>');
    expect(text).toContain('do not directly scan `.spec-first/workflows/spec-work/**`');
    expect(text).toContain('artifact `plan_path` / `source_refs` reasonably match');
    expect(text).toContain('reader returns not-found/not-readable');
    expect(text).toContain('scope mismatches');
    expect(text).toContain('do not inject the artifact evidence into reviewer prompts or native routing');
    expect(text).toContain('Do not ask each persona reviewer to repeat the same provider probe');
    expect(text).toContain('**Degraded-once rule:**');
    expect(text).toContain('record it once in Coverage');
    expect(text).toContain('for multi-repo review, report graph evidence per child repo');
    expect(template).toContain('Graph evidence: <posture>');
  });

  test('routes graph-heavy diffs to GitNexus native capabilities while requiring source confirmation', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('GitNexus native capability routing candidates');
    expect(text).toContain('Activation happens only after Stage 4 confirms graph-native use is allowed');
    expect(text).toContain('`evidence_posture=primary` and `evidence_grade=primary|session-local`');
    expect(text).toContain('`fallback`, `advisory`, or `stale` evidence remains orientation only');
    expect(text).toContain('Route handler / public API diff -> prefer `api_impact`, then `route_map`');
    expect(text).toContain('use `shape_check` for response-shape drift risk');
    expect(text).toContain('Response shape / consumer access diff -> prefer `shape_check`');
    expect(text).toContain('Shared symbol / helper diff -> use `context` and `impact`');
    expect(text).toContain('MCP/RPC tool definition diff -> use `tool_map`');
    expect(text).toContain('Workspace multi-repo diff -> resolve graph evidence per child repo');
    expect(text).toContain('Stale / unavailable / definitions-only GitNexus -> fall back to direct diff reads');
    expect(text).toContain('Do not raise a finding solely from graph output');
    expect(text).toContain('confirmed by diff/source/test/contract evidence');
  });

  test('Codex reviewer dispatch avoids fork_context and agent_type parameter conflicts', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');
    const codexRuntime = renderWorkflowSkill('codex');

    for (const content of [text, codexRuntime]) {
      expect(content).toContain('Codex `spawn_agent` parameter hygiene');
      expect(content).toContain('Codex reviewer prompts are self-contained');
      expect(content).toContain('pass the persona, diff-scope rules, output schema, PR metadata, intent, file list, diff, and standards paths');
      expect(content).toContain('Dispatch one reviewer per `spawn_agent` call');
      expect(content).toContain('do not bundle multiple reviewer personas into one sub-agent prompt');
      expect(content).toContain('prefer the default sub-agent type and omit `agent_type`');
      expect(content).toContain('specialized by the prompt, not by a generic explorer/worker role');
      expect(content).toContain('omit `fork_context`');
      expect(content).toContain('do not combine `fork_context: true` with `agent_type`');
      expect(content).toContain('If a runtime requires `fork_context: true`');
      expect(content).toContain('omit `agent_type` and still include the full self-contained review context');
      expect(content).toContain('correct the parameters once and retry through the bounded scheduler');
      expect(content).toContain('not a reviewer failure');
    }
  });

  test('workflow progress updates do not expose private reasoning scratchpads', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Progress Reporting Boundary');
    expect(text).toContain('User-visible progress updates are operational evidence, not a reasoning scratchpad.');
    expect(text).toContain('Do not expose private deliberation, tentative inner monologue, or first-person reasoning');
    expect(text).toContain('"I\'m thinking"');
    expect(text).toContain('"I need to consider"');
    expect(text).toContain('"I think"');
    expect(text).toContain('state the verified limitation and the next check');
    expect(text).toContain('Use the session language for new prose');
  });

  test('resolve-base script lives under scripts and runtime calls use the trusted skill path', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');
    const claudeRuntime = renderWorkflowSkill('claude');
    const codexRuntime = renderWorkflowSkill('codex');
    const scriptPath = path.join(
      __dirname,
      '..',
      '..',
      'skills',
      'spec-code-review',
      'scripts',
      'resolve-base.sh',
    );
    const legacyPath = path.join(
      __dirname,
      '..',
      '..',
      'skills',
      'spec-code-review',
      'references',
      'resolve-base.sh',
    );
    const script = fs.readFileSync(scriptPath, 'utf8');

    expect(fs.existsSync(scriptPath)).toBe(true);
    expect(fs.existsSync(legacyPath)).toBe(false);
    expect(text).toContain('skills/spec-code-review/scripts/resolve-base.sh');
    expect(text).not.toContain('bash scripts/resolve-base.sh');
    expect(text).not.toContain('references/resolve-base.sh');
    expect(claudeRuntime).toContain('.claude/spec-first/workflows/spec-code-review/scripts/resolve-base.sh');
    expect(codexRuntime).toContain('.agents/skills/spec-code-review/scripts/resolve-base.sh');
    expect(claudeRuntime).not.toContain('bash scripts/resolve-base.sh');
    expect(codexRuntime).not.toContain('bash scripts/resolve-base.sh');
    expect(script).toContain('Usage from source: bash skills/spec-code-review/scripts/resolve-base.sh');
    expect(script).toContain('Runtime adapters rewrite that source path');
  });

  test('previous-comments reviewer is gated by actual prior feedback', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');
    const catalog = fs.readFileSync(
      path.join(__dirname, '..', '..', 'skills', 'spec-code-review', 'references', 'persona-catalog.md'),
      'utf8',
    );

    expect(skill).toContain('hasPriorComments');
    expect(skill).toContain('approval-state submissions with empty bodies');
    expect(skill).toContain('previous-comments` is PR-only AND comment-gated');
    expect(skill).toContain('approval-only reviews with empty bodies');
    expect(catalog).toContain('PR-only AND comment-gated');
    expect(catalog).toContain('hasPriorComments');
  });

  test('scale-aware reviewer preflight allows low-risk minimum reviewer sets', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');
    const catalog = fs.readFileSync(
      path.join(__dirname, '..', '..', 'skills', 'spec-code-review', 'references', 'persona-catalog.md'),
      'utf8',
    );

    for (const text of [skill, catalog]) {
      expect(text).toContain('scale-aware reviewer preflight');
      expect(text).toContain('minimum set');
      expect(text).toContain('sensitive');
      expect(text).toContain('prior');
      expect(text).toContain('explicit plan');
      expect(text).not.toContain('Spawned on every review regardless of diff content.');
      expect(text).not.toContain('a small config change triggers 0 conditionals = 6 reviewers');
    }

    expect(skill).toContain('`changed_file_count <= 2`');
    expect(skill).toContain('`untracked_excluded_count == 0`');
    expect(skill).toContain('`sensitive_diff == false`');
    expect(skill).toContain('`plan_explicit == false`');
    expect(skill).toContain('`docs_only == true`');
    expect(skill).toContain('`simple_config_only == true`');
    expect(skill).toContain('`non_test_non_generated_non_lock_line_count <= 25`');
    expect(skill).toContain('Progressive disclosure boundary: low-risk docs-only, simple config, and tiny executable diffs may use a minimum reviewer set');
    expect(skill).toContain('high-risk workflow, contract, release, source/runtime boundary, provider evidence, security, or cross-module changes must use the full default core plus applicable conditional reviewers');
    expect(skill).toContain('avoid unbounded fan-out on small diffs without hiding risk');
    expect(skill).toContain('| `docs_only` | `spec-project-standards-reviewer`, `spec-maintainability-reviewer` |');
    expect(skill).toContain('| `simple_config_only` | `spec-correctness-reviewer`, `spec-testing-reviewer`, `spec-project-standards-reviewer` |');
    expect(skill).toContain('| tiny executable diff | `spec-correctness-reviewer`, `spec-testing-reviewer`, `spec-maintainability-reviewer` |');
    expect(skill).toContain('`mode:headless` and `mode:report-only` keep their structured output contracts');
    expect(skill).toContain('`mode:autofix` may use the minimum set only for `docs_only` or `simple_config_only`');
    expect(skill).toContain('Record the preflight facts, selected core tier (`minimum` or `full`), and reason in Coverage');
    expect(skill).toContain('If the facts are missing, ambiguous, or contradicted by the diff, choose the full default core.');

    expect(catalog).toContain('Default Core');
    expect(catalog).toContain('Low-risk tiny diffs may use a minimum core of 2-3 reviewers');
    expect(catalog).toContain('Announce the team');
    expect(catalog).toContain('selected core tier');
  });

  test('retains CLI readiness reviewers as a spec-first product boundary', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');
    const catalog = fs.readFileSync(
      path.join(__dirname, '..', '..', 'skills', 'spec-code-review', 'references', 'persona-catalog.md'),
      'utf8',
    );
    const cliAgentReadiness = fs.readFileSync(
      path.join(__dirname, '..', '..', 'agents', 'spec-cli-agent-readiness-reviewer.agent.md'),
      'utf8',
    );
    const cliReadiness = fs.readFileSync(
      path.join(__dirname, '..', '..', 'agents', 'spec-cli-readiness-reviewer.agent.md'),
      'utf8',
    );

    expect(skill).toContain('CLI readiness boundary');
    expect(skill).toContain('Keep `spec-cli-readiness-reviewer` as the conditional reviewer for CLI-facing diffs');
    expect(skill).toContain('This project is itself a CLI/workflow harness');
    expect(skill).toContain('not a replacement for the structured JSON persona');
    expect(skill).not.toContain('U9 divergence note');
    expect(skill).not.toContain('CE `06a7cee0` removed its CLI readiness reviewers');
    expect(catalog).toContain('CLI readiness boundary');
    expect(catalog).toContain('this repository ships a CLI/workflow harness');
    expect(catalog).not.toContain('CE removed its CLI readiness reviewers');
    expect(catalog).toContain('These Spec-First conditional agents provide specialized analysis');
    expect(catalog).not.toContain('CE-native agents');
    expect(catalog).toContain('| `cli-readiness` | `spec-cli-readiness-reviewer` |');
    expect(cliReadiness).toContain('"reviewer": "cli-readiness"');
    expect(cliReadiness).toContain('Return your findings as JSON matching the findings schema');
    expect(cliAgentReadiness).toContain('source code**, **plans**, and **specs**');
    expect(cliAgentReadiness).toContain('CLI Agent-Readiness Review');
  });

  test('finding numbers are stable across severity and residual sections', () => {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');
    const template = fs.readFileSync(
      path.join(
        __dirname,
        '..',
        '..',
        'skills',
        'spec-code-review',
        'references',
        'review-output-template.md',
      ),
      'utf8',
    );

    expect(skill).toContain('Sort and number');
    expect(skill).toContain('assign monotonically increasing `#` values across the full primary finding set');
    expect(skill).toContain('reuse the same stable `#`');
    expect(skill).toContain('Finding numbers come from the stable assignment in Stage 5');
    expect(template).toContain('Stable sequential finding numbers');
    expect(template).toContain('| 3 | `export_service.rb:91`');
  });

  test('reviewer and validator dispatch are bounded instead of treating capacity as failure', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Bounded parallel dispatch');
    expect(text).toContain('Respect the current harness\'s active-subagent limit');
    expect(text).toContain('active-agent/thread/concurrency-limit spawn errors as backpressure');
    expect(text).toContain('Start with at most 4 active reviewer agents');
    expect(text).toContain('Do not launch every selected reviewer in one burst');
    expect(text).toContain('A generic `Agent spawn failed` with one or more active reviewers is presumed capacity/backpressure first');
    expect(text).toContain('Wait for any active reviewer to complete');
    expect(text).toContain('retry the same queued reviewer once');
    expect(text).toContain('A spawn failure that includes `MCP startup incomplete`, `MCP startup failed`, or a required MCP server name');
    expect(text).toContain('Stop launching new reviewers');
    expect(text).toContain('collect any already-started reviewers that can complete');
    expect(text).toContain('apply remaining persona lenses inline through the single-agent report-only fallback');
    expect(text).toContain('Only mark a queued reviewer as failed after the bounded retry path rules out capacity/backpressure');
    expect(text).toContain('Spawn validators with bounded parallelism');
    expect(text).toContain('bounded queueing rules in Stage 4');
    expect(text).toContain('supports reviewer dispatch but not parallel sub-agents');
    expect(text).toContain('dispatch reviewers sequentially through the same Stage 4 scheduler');
    expect(text).toContain('If the platform has no dispatch primitive, or dispatch is explicitly disabled or unsafe, use the Stage 4 single-agent report-only fallback');
  });

  test('code-review dispatch is analysis-only and mutation is mode-bound', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('Reviewers are analysis agents, not implementation workers.');
    expect(text).toContain('Dispatch is bounded to the resolved diff scope, selected reviewer personas, advisory facts, and output schema.');
    expect(text).toContain('Do not create hidden implement/check agents from code review.');
    expect(text).toContain('Mutation is allowed only through documented `safe_auto` / selected Apply paths in the chosen mode');
    expect(text).toContain('report-only fallback, unsafe runtime, or missing dispatch capability must not edit source, generated runtime mirrors, or workflow artifacts.');
    expect(text).not.toContain('fallback may edit source');
    expect(text).not.toContain('hidden implement/check lifecycle');
  });

  test('code-review leaf reviewers remain read-only while artifacts are parent-owned', () => {
    const reviewers = [
      'spec-adversarial-reviewer',
      'spec-api-contract-reviewer',
      'spec-correctness-reviewer',
      'spec-data-migrations-reviewer',
      'spec-dhh-rails-reviewer',
      'spec-julik-frontend-races-reviewer',
      'spec-kieran-python-reviewer',
      'spec-kieran-rails-reviewer',
      'spec-kieran-typescript-reviewer',
      'spec-maintainability-reviewer',
      'spec-performance-reviewer',
      'spec-previous-comments-reviewer',
      'spec-project-standards-reviewer',
      'spec-reliability-reviewer',
      'spec-security-reviewer',
      'spec-swift-ios-reviewer',
      'spec-testing-reviewer',
    ];

    for (const reviewer of reviewers) {
      const text = fs.readFileSync(
        path.join(__dirname, '..', '..', 'agents', `${reviewer}.agent.md`),
        'utf8',
      );
      expect(text).toContain('tools: Read, Grep, Glob, Bash');
      expect(text).not.toContain('tools: Read, Grep, Glob, Bash, Write');
    }

    for (const reviewer of ['spec-cli-agent-readiness-reviewer', 'spec-cli-readiness-reviewer']) {
      const text = fs.readFileSync(
        path.join(__dirname, '..', '..', 'agents', `${reviewer}.agent.md`),
        'utf8',
      );
      expect(text).toContain('tools: Read, Grep, Glob, Bash');
      expect(text).not.toContain('tools: Read, Grep, Glob, Bash, Write');
    }

    const template = fs.readFileSync(
      path.join(
        __dirname,
        '..',
        '..',
        'skills',
        'spec-code-review',
        'references',
        'subagent-template.md',
      ),
      'utf8',
    );
    expect(template).toContain('Do not write files.');
    expect(template).toContain('the orchestrator writes your returned JSON itself');
    expect(template).toContain('reviewer agents read-only');
    expect(template).toContain('You are operationally read-only.');
    expect(template).not.toContain('This is the ONE write operation you are permitted to make');

    const skill = fs.readFileSync(SKILL_PATH, 'utf8');
    expect(skill).toContain('Do not ask leaf reviewers to write files directly.');
    expect(skill).toContain('const reviewArtifactDir = path.join(os.tmpdir(), \'spec-first\', \'spec-code-review\', runId);');
    expect(skill).toContain('the orchestrator may write that JSON to `<review-artifact-dir>/{reviewer_name}.json`');
    expect(skill).toContain('Artifact persistence is parent/orchestrator-owned');
  });

  test('supports single-agent report-only fallback when reviewer dispatch is unavailable or unsafe', () => {
    const text = fs.readFileSync(SKILL_PATH, 'utf8');

    expect(text).toContain('When dispatch is unavailable, explicitly disabled, or unsafe, falls back to a single-agent report-only review instead of bypassing host boundaries.');
    expect(text).toContain('Dispatch capability gate');
    expect(text).toContain('Dispatch capability is part of the runtime boundary, not a reviewer-selection preference.');
    expect(text).toContain('the current tool contract controls dispatch permission');
    expect(text).toContain('A workflow entrypoint by itself is not enough to call `spawn_agent`');
    expect(text).toContain('require an explicit user request for subagents/parallel agents/delegated review');
    expect(text).toContain('parent-orchestrator delegation that carries that permission');
    expect(text).toContain('Codex may expose reviewer dispatch through `spawn_agent`');
    expect(text).toContain('only when both the host capability and the current permission boundary allow it');
    expect(text).toContain('Do not downgrade solely because the host is Codex when the permission boundary is satisfied.');
    expect(text).toContain('set `single_agent_report_only_fallback: true`');
    expect(text).toContain('Treat the effective mode as report-only');
    expect(text).toContain('Do not create `<review-artifact-dir>/` and do not write reviewer artifacts.');
    expect(text).toContain('Skip Stage 5b validator dispatch and all fixer paths.');
    expect(text).toContain('single-agent report-only fallback: reviewer dispatch unavailable, explicitly disabled, or unsafe');
    expect(text).toContain('| single-agent report-only fallback | No -- dispatch is unavailable, explicitly disabled, or unsafe | n/a |');
    expect(text).not.toContain('Codex-specific rule: do not call `spawn_agent` merely because this skill mentions reviewer personas.');
    expect(text).not.toContain('Codex should inline reviewer personas');
    expect(text).not.toContain('explicit user authorization');
  });
});
