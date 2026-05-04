# CE Dispatch Boundary Audit Matrix

Date: 2026-05-05

Scope: `spec-first` source skills that mention agent, subagent, parallel dispatch, reviewer, resolver, worker, researcher, persona, `Task`, `spawn_agent`, fork workspace, or worktree isolation semantics.

This audit treats Compound Engineering (CE) as lineage evidence, not as truth source. The source of truth for repair decisions is the current `spec-first` product boundary, source skill contract, Codex runtime rendering behavior, and focused contract tests.

## Deterministic Scan

Scan pattern used:

```bash
rg -n "agent|subagent|sub-agent|parallel|spawn_agent|Task |dispatch|delegat|reviewer|resolver|worker|fork|worktree|persona" skills/*/SKILL.md
```

The scan was supplemented by direct source reads for `skills/resolve-pr-feedback/SKILL.md`, `skills/agent-native-audit/SKILL.md`, and the matching CE source skills under `/Users/kuang/xiaobu/compound-engineering-plugin/plugins/compound-engineering/skills/`.

## Matrix

| skill | ce_counterpart | dispatch_terms | dispatch_type | mutates_repo | host_capability | session_authorization | workflow_invocation_authorization | runtime_rendering_risk | fallback | isolation_required | orchestrator_final_owner | accepted_divergence | repair_priority | action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `skills/spec-doc-review/SKILL.md` | `ce-doc-review/SKILL.md` | reviewer, persona, dispatch, bounded parallelism, `spawn_agent` | reviewer | no for reviewers; orchestrator may edit one doc after user routing | Claude `Agent`; Codex `spawn_agent`; stricter policy may override | required by host/session policy | direct workflow invocation may authorize documented persona-review phase when host/session allow | low; source already host-neutral | single-agent report-only fallback | no for reviewer dispatch | yes; orchestrator synthesizes report and applies doc edits | accepted: stronger spec-first headless/task-pack and routing contract | keep | fixed reference; add matrix evidence only |
| `skills/spec-code-review/SKILL.md` | `ce-code-review/SKILL.md` | reviewer, persona, sub-agents, validator, `spawn_agent` | reviewer / validator / fixer routing | reviewers no; `safe_auto` fixer may mutate in allowed modes | Claude `Agent`; Codex `spawn_agent`; host-provided model aliases only | required | should match doc-review: direct `$spec-code-review` may authorize documented reviewer phase when host/session allow | medium; stale Codex anti-dispatch prose | single-agent report-only fallback | yes for mutating fixer/headless contexts | yes; orchestrator owns artifacts, synthesis, final routing | needs repair: Codex no-dispatch assumption is stale | P0 | repair source and add tests |
| `skills/spec-plan/SKILL.md` | `ce-plan/SKILL.md` | `Task spec-*`, research agents, parallel | read-only research | no | Claude `Task`/`Agent`; Codex `spawn_agent`; inline fallback | required | direct `$spec-plan` may authorize documented planning research phase when host/session allow | high; Codex adapter silently rendered `Task` into inline profile application | sequential / inline current-agent research fallback | no | yes; orchestrator owns final plan | needs repair: source shorthand tied dispatch to Claude-era `Task` | P0/P1 | repair source, repair Codex adapter legacy rendering, add runtime tests |
| `skills/spec-ideate/SKILL.md` | `ce-ideate/SKILL.md` | grounding agents, ideation sub-agents, parallel, cost notice | read-only ideation / research | no; orchestrator writes ideation artifacts/checkpoints | Claude/Codex if dispatch primitive exposed | required | direct `$spec-ideate` may authorize documented grounding/ideation phases when host/session allow | low; no `Task` shorthand | warn-and-proceed grounding failure; sequential/inline ideation fallback needed | no | yes; orchestrator owns artifact/checkpoints | accepted: spec-first naming and local handoff changes | P1 | clarify source and add tests |
| `skills/spec-debug/SKILL.md` | `ce-debug/SKILL.md` | parallel investigation, sub-agents | read-only investigation | no in investigation phase; fix phase is orchestrator-owned | host dispatch optional | optional | no automatic dispatch; only when independent evidence bottlenecks justify it and policy allows | low | sequential hypothesis probes | no | yes; current agent owns fix | accepted: already says latency optimization, not correctness dependency | keep | matrix evidence; generic regression only |
| `skills/spec-optimize/SKILL.md` | `ce-optimize/SKILL.md` | parallel experiments, worktree backend, Codex backend, judge sub-agents | optimizer / experiment backend | yes, but only inside experiment worktrees/delegated workspaces | worktree backend, Codex delegation, subagents, serial local | required through budget/admission gates | direct workflow invocation authorizes only approved/budgeted optimization phases | medium; backend/fallback boundaries should be explicit | serial local/worktree fallback after Codex failures | yes | yes; orchestrator owns kept merges, runner-up cherry-picks, cleanup, final options | accepted: spec-first tighter budgets and source/runtime path rules | P2 | clarify source and add tests |
| `skills/resolve-pr-feedback/SKILL.md` | `ce-resolve-pr-feedback/SKILL.md` | resolver, parallel agents, batching, conflict avoidance | mutating resolver | yes | host dispatch primitive when available; current-agent sequential fallback | required | direct invocation may authorize resolver dispatch only when safe | low; no runtime adapter issue | sequential current-agent fallback; serialize overlaps | yes | yes; orchestrator owns combined validation, staging, commit, push, replies | needs repair: opening prose overstates default parallelism | P1 | repair source and add tests |
| `skills/spec-work/SKILL.md` | `ce-work/SKILL.md` | subagents, parallel, worktree isolation, fork workspace | mutating worker | yes | Claude worktree isolation; Codex fork workspace; shared-directory fallback; inline | required | direct `$spec-work` may authorize documented worker strategy when plan/task scope and safety checks allow | low | inline or serial subagents | yes | yes; orchestrator owns Codex fork-workspace integration, staging, commits, project-level verification | accepted: spec-first explicitly fixed CE's old "Codex shares directory" assumption | keep | existing tests plus generic regression |
| `skills/spec-work-beta/SKILL.md` | `ce-work-beta/SKILL.md` | delegation, Codex exec, subagents, fork workspace | mutating worker / delegate | yes | Codex delegation, Claude worktree isolation, Codex fork workspace | required; beta explicit opt-in | direct invocation only when user explicitly trials beta/delegation mode | low | stable `spec-work`, serial delegation, inline fallback | yes | yes | accepted: beta opt-in and serial Codex delegation are spec-first product boundaries | keep | existing tests plus generic regression |
| `skills/agent-native-audit/SKILL.md` | `ce-agent-native-audit/SKILL.md` | 8 parallel sub-agents, `spawn_agent`, explorer | internal read-only audit | no | Claude explorer agent; Codex `spawn_agent` explorer | required | not a public `$spec-*` workflow; direct helper use does not bypass session policy | low | sequential current-agent audit | no | yes; orchestrator owns scored report | needs repair: internal/helper and fallback boundary under-specified | P2 | clarify source and generic tests |
| `skills/spec-compound/SKILL.md` | `ce-compound/SKILL.md` | parallel subagents, session historian, reviewers | research / knowledge assembly | child agents no; orchestrator writes docs and instruction maintenance | host dispatch optional | required | direct `$spec-compound` may enter full mode only after user mode choice and session policy allows | low | lightweight mode skips subagents | no for child agents | yes | accepted: strong text-only child boundary already present | keep | matrix evidence; no source change required |
| `skills/spec-compound-refresh/SKILL.md` | `ce-compound-refresh/SKILL.md` | investigation subagents, replacement subagents, parallel/batched | doc refresh / replacement | investigation no; replacement subagent writes one successor; orchestrator handles delete/metadata | host dispatch optional | required | direct invocation authorizes only scope-selected refresh work | low | inline/direct investigation; stale-mark in autofix ambiguity | yes for replacement sequencing | yes; orchestrator merges results and centralizes deletes/metadata edits | accepted: already separates read-only investigation and sequential replacement | keep | matrix evidence; no source change required |
| `skills/spec-brainstorm/SKILL.md` | `ce-brainstorm/SKILL.md` | Slack researcher opt-in, agent wording | optional research | no | Slack researcher only if tools/session allow | required | direct brainstorm does not auto-dispatch Slack; user opt-in required | low | proceed without Slack context | no | yes; orchestrator writes requirements doc | accepted: Slack context is opt-in and not correctness dependency | keep | matrix evidence; no source change required |
| `skills/spec-slack-research/SKILL.md` | `ce-slack-research/SKILL.md` | researcher dispatch | external research | no | Slack researcher if host/session/tools allow | required | direct `$spec-slack-research` targets a single researcher but does not bypass policy | low | relay unavailable; no alternate research unless same Slack tools are available | no | yes; researcher returns digest, orchestrator relays | accepted: standalone Slack digest skill | keep | matrix evidence; no source change required |

## Fixed Reference Quadrants

`skills/spec-doc-review/SKILL.md` is the fixed reference pattern for read-only reviewer dispatch:

1. Claude dispatch available: use bounded persona reviewer dispatch through the platform primitive.
2. Claude dispatch fails or is capacity-limited: queue/backpressure when capacity-related; otherwise mark failed only after a successful dispatch times out/fails or non-capacity errors occur.
3. Codex `spawn_agent` available: dispatch through `spawn_agent`; do not downgrade solely because the host is Codex.
4. Stricter session policy overrides workflow prose: when host/developer/session policy requires explicit authorization and it is absent, do not call `Agent`, `Task`, `spawn_agent`, or equivalent; run single-agent report-only fallback.

## Accepted CE Divergences

- CE is lineage evidence only. `spec-first` keeps current public workflow names and does not import CE-only skills.
- `spec-work` and `spec-work-beta` intentionally strengthen CE's older shared-directory language with Codex fork-workspace and orchestrator-owned integration semantics.
- `spec-doc-review` keeps spec-first's task-pack/headless/routing enhancements while using CE's multi-persona lineage as evidence.
- `spec-compound` and `spec-compound-refresh` keep spec-first's orchestrator-owned artifact discipline instead of letting leaf agents become artifact owners.

## Repair Summary

- P0: repair `spec-code-review`, `spec-plan`, and Codex adapter legacy `Task spec-*` rendering.
- P1: clarify `spec-ideate` and `resolve-pr-feedback` dispatch boundaries.
- P2: clarify `spec-optimize` and `agent-native-audit` as optional/capability-gated dispatch surfaces.
- Keep: `spec-doc-review`, `spec-debug`, `spec-work`, `spec-work-beta`, `spec-compound`, `spec-compound-refresh`, `spec-brainstorm`, and `spec-slack-research` are sufficiently bounded for this pass, with regression coverage added where useful.
