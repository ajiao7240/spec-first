# Rewrite Plan

## Goals

- Fix semantic P0s before expanding the skill/agent surface.
- Preserve source-first/runtime-generated boundaries.
- Add light contracts where they unblock review closure, not a central workflow engine.
- Keep scripts responsible for deterministic facts and agents responsible for bounded judgment only.

## Non-Goals

- Do not rewrite every skill into a heavy schema.
- Do not add a new workflow state machine.
- Do not patch `.claude/`, `.codex/`, or `.agents/skills/` by hand.
- Do not make agents own final synthesis, merge readiness, or source mutation.

## P0 Rewrite Set

| id | title | target files | reason | current issue | expected change | acceptance criteria | priority | risk | whether_changelog_required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P0-001 | Convert browser test helper to evidence-only | `skills/test-browser/SKILL.md` | Internal helper exposure breaks public/internal governance. | Internal helper exposes `/test-browser` usage and “Fix now.” | Rewrite as delegated browser evidence helper; remove public command examples and direct fix path. | Governance says internal and skill body has no public-entry examples; output is evidence summary only. | P0 | Medium: parent workflows must preserve browser-test affordance. | yes |
| P0-002 | Convert Xcode test helper to evidence-only | `skills/test-xcode/SKILL.md` | Internal helper exposure breaks public/internal governance. | Internal helper exposes `/test-xcode` usage and “Fix now.” | Rewrite as delegated Xcode/simulator evidence helper; parent workflow owns fixes. | Governance says internal and skill body has no public-entry examples; output is evidence summary only. | P0 | Medium: iOS review must retain simulator evidence path. | yes |
| P0-003 | Remove internal helper from entry router | `skills/using-spec-first/SKILL.md` | Router must not recommend hidden helpers as user paths. | Router recommends `git-commit-push-pr` internal helper. | Remove direct route; use public workflow or active shipping handoff. | Route table contains no internal-only skill as recommended user path. | P0 | Low: replacement is routing prose only. | yes |
| P0-004 | Retire legacy autonomous pipeline | `skills/lfg/SKILL.md` | Legacy central engine conflicts with light workflow harness. | Autonomous central pipeline commits, pushes, tests, and opens PRs. | Retire or hard-hide; keep compatibility note only if needed. | No public or recommended route can invoke `lfg`; autonomous side-effect chain is removed or isolated. | P0 | Medium: old internal callers may need migration note. | yes |
| P0-005 | Remove proactive mutating design agent | `agents/spec-design-iterator.agent.md` | Agents are expert roles, not source-mutating workflows. | Proactive screenshot-analyze-improve cycles lack parent-owned write/stop/verification contract. | Retire, or move to explicit workflow phase with parent-owned contract. | Agent no longer owns source mutation or completion judgment. | P0 | Medium: frontend workflow may need a replacement diagnosis lens. | yes |
| P0-006 | Split Figma sync agent | `agents/spec-figma-design-sync.agent.md` | Agent owns capture, mutation, verification, and completion. | Figma/browser capture, code modification, verification, and completion live inside one agent. | Split into read-only diagnosis plus workflow-owned mutation, or retire standalone agent. | Any code edit is owned by parent workflow; diagnosis output has evidence and confidence. | P0 | Medium-high: `spec-work` references must be updated. | yes |
| P0-007 | Repair runtime drift audit evidence | `skills/spec-skill-audit/scripts/*`, runtime audit docs | Runtime parity cannot be claimed without deterministic evidence. | Runtime drift audit failed trusted-checkout validation. | Make `--runtime` work from source checkout or emit explicit degraded parity report. | `node skills/spec-skill-audit/scripts/write-audit-artifacts.js --repo . --runtime` produces usable report or intentional degraded result. | P0 | Medium: touches audit script and runtime trust policy. | yes |
| P0-008 | Define shared review finding envelope | `skills/spec-code-review`, `skills/spec-doc-review`, `skills/spec-app-consistency-audit`, reviewer templates | H5 review closure needs a shared minimum finding contract. | Code/doc/app review have strong local schemas but no shared minimum. | Define `review-finding.v1` with evidence, owner, verification, confidence, changelog, residual fields. | Code/doc/app review can map local findings into shared fields without losing domain extensions. | P0 | Medium: must preserve existing domain-specific fields. | yes |

## P1 Rewrite Set

| id | title | target files | reason | current issue | expected change | acceptance criteria | priority | risk | whether_changelog_required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1-001 | Add compact stage contracts | Core public workflow `SKILL.md` files | Contracts are prose-heavy and hard to scan. | Trigger, inputs, outputs, artifacts, degraded mode, and handoff are uneven. | Add compact Contract Summary to `spec-brainstorm`, `spec-plan`, `spec-write-tasks`, `spec-work`, `spec-code-review`, `spec-doc-review`, `spec-compound`. | A reader can identify stage role and handoff in under 30 seconds. | P1 | Low if prose-only. | yes |
| P1-002 | Add durable artifact header | Plans, reviews, task packs, compound docs | Durable artifacts need stable trust metadata. | Plans, reviews, task packs, and compound docs use inconsistent headers. | Add `artifact-header.v1` convention. | New durable Markdown artifacts identify type, source, trust level, and consumer. | P1 | Low: header-only convention. | yes |
| P1-003 | Guard compound knowledge evidence | `skills/spec-compound`, `skills/spec-compound-refresh`, session handoffs | Knowledge should not preserve weak assumptions as facts. | Session/memory evidence can become durable knowledge. | Add `evidence-packet.v1` or fact/inference/assumption labels for compound. | New solution docs mark unverifiable context and stale overlaps. | P1 | Medium: touches knowledge workflow. | yes |
| P1-004 | Normalize document-review lenses | `agents/spec-*-lens-reviewer.agent.md`, doc-review references | Parent synthesis needs mergeable inputs. | Lens outputs are useful but not consistently structured. | Mark as lens notes or emit shared finding envelope. | `spec-doc-review` can synthesize without ad hoc parsing. | P1 | Medium: agent templates may need coordinated edits. | yes |
| P1-005 | Add budgets to broad researchers | `spec-web-researcher`, `spec-slack-researcher`, `spec-repo-research-analyst`, `spec-git-history-analyzer` | External/history research can create context bloat. | Researchers lack consistent query, scan window, and source limits. | Add required query, max source count, freshness, and included/excluded context. | Reports include source limits, freshness, and evidence anchors. | P1 | Low: mostly prose contract. | yes |
| P1-006 | Thin beta work wrapper | `skills/spec-work-beta/SKILL.md`, `skills/using-spec-first/SKILL.md` | Beta delegation should remain explicit opt-in. | Stable/beta overlap can confuse routing. | Make beta thin-by-reference and explicit opt-in. | `using-spec-first` does not recommend beta unless requested; beta states delta from `spec-work`. | P1 | Medium: beta behavior references may drift. | yes |
| P1-007 | Bound optimize execution engine | `skills/spec-optimize/SKILL.md`, optimize references/scripts | Optimize mixes metrics, worktrees, judging, and mutation. | Long-running loop can look like a central execution engine. | Add top contract, metric fact boundary, budget gates, and mutation policy. | Scripts own metrics; LLM judges experiment quality; writes are explicit. | P1 | Medium-high: workflow behavior is complex. | yes |
| P1-008 | Normalize mutating helper safety | Commit/PR/feedback/shipping helper skills | Publishing and staging need uniform gates. | Commit/PR/feedback helpers lack shared preview/staging/changelog policy. | Add small `tool-risk-policy.v1` table. | Mutating helper outputs show staged files, tests, changelog decision, and authorization. | P1 | Medium: may affect shipping flow. | yes |
| P1-009 | Consolidate duplicate expert agents | Older architecture/security/performance/data/pattern agents | Duplicate agents increase synthesis instability. | Older broad experts overlap structured reviewers. | Merge, retire, or mark manual-only. | Default dispatch uses structured canonical reviewer/lens families only. | P1 | Low-medium: dispatch maps need care. | yes |

## P2 Cleanup Set

| id | title | target files | reason | current issue | expected change | acceptance criteria | priority | risk | whether_changelog_required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P2-001 | Promote task-pack header example | `skills/spec-write-tasks/references/*`, docs/contracts | Strongest artifact pattern is local to task packs. | Other artifacts lack the same header discipline. | Promote Task Pack Contract as a reusable artifact-header example. | Plans/reviews can adopt the header without requiring task packs. | P2 | Low. | yes |
| P2-002 | Add examples-as-context selectively | High-leverage public workflows | Examples improve trigger and output stability without heavy eval platform. | Most skills lack examples/evals. | Add one or two examples-as-context for top public workflows only. | Audit eval-readiness improves for selected workflows. | P2 | Low. | yes |
| P2-003 | Generate capability manifest | CLI/init/update contracts | Public/internal status is scattered across governance and prose. | Router and runtime delivery lack one source-derived manifest. | Generate source-derived capability manifest. | Init/doctor/router can report host availability without manual registry drift. | P2 | Medium. | yes |
| P2-004 | Move long branches to references | Long workflow `SKILL.md` files | Primary contracts are hidden by deep optional details. | Optional troubleshooting/templates hide primary stage contract. | Move deep details into references while keeping top contract in `SKILL.md`. | Primary workflow path is readable without losing advanced guidance. | P2 | Low-medium. | yes |
| P2-005 | Share provider readiness note | Graph-heavy consumers | Consumers repeat similar degraded-mode logic. | Provider readiness language can drift across skills. | Add shared provider-readiness consumption note by reference. | Graph-heavy consumers align without depending on provider internals. | P2 | Low. | yes |

## Minimal Landing Order

1. Fix P0 internal/public boundary conflicts: `test-browser`, `test-xcode`, `using-spec-first`, `lfg`.
2. Retire or split P0 mutating agents: `spec-design-iterator`, `spec-figma-design-sync`.
3. Fix runtime drift audit evidence.
4. Add shared `review-finding.v1`.
5. Add compact contracts to core workflow chain.
6. Normalize lens/research/compound evidence after the closure path is stable.
