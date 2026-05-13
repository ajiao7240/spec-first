# Final Recommendations

## Overall Conclusion

Current spec-first skill/agent Markdown has moved beyond prompt descriptions into a partial AI Coding Harness. The strongest nodes already behave like stable engineering stages: `spec-graph-bootstrap`, `spec-write-tasks`, `spec-code-review`, `spec-doc-review`, `spec-plan`, `spec-app-consistency-audit`, and `spec-skill-audit`.

The system is not fully review-closed because public/internal boundaries are leaky in a few helper skills, two agents still behave like mutating workflows, review outputs are not normalized across code/doc/app review, and runtime mirror parity was not verified in this audit.

Current level: H4 Evidence-governed Harness. Target level: H5 Review-closed Engineering Loop. H6 should wait until H5 is stable.

## Audit Completeness

| Scope | Result |
| --- | --- |
| Skills reviewed | 40 `skills/**/SKILL.md` files |
| Agents reviewed | 51 `agents/*.agent.md` files |
| Cross-review pattern | Two reviewers per Markdown file: contract review + boundary/overlap review |
| Deterministic skill scan | P0 0 / P1 180 / P2 102 signals |
| Final semantic risk count | P0 8 / P1 42 / P2 68 |
| Runtime drift | Unverified; `--runtime` failed trusted-checkout validation |

## Quality Grade

| Area | Grade | Reason |
| --- | --- | --- |
| Core workflow skills | B | Strong evidence and boundaries, but contracts are prose-heavy. |
| Auxiliary/internal skills | D | Several look like public workflows or mutating tools without clear helper contracts. |
| Code-review agents | A- | Good JSON, confidence anchors, and suppress rules. |
| Doc/research/lens agents | C | Useful expertise, inconsistent outputs and context budgets. |
| Runtime governance | B- | Source/runtime boundary is clear, but runtime drift audit was not confirmed. |

## P0 Blocking Risks

| id | object | finding | immediate recommendation |
| --- | --- | --- | --- |
| P0-001 | `test-browser` | Internal helper exposes `/test-browser` examples and “Fix now.” | Convert to delegated evidence helper. |
| P0-002 | `test-xcode` | Internal helper exposes `/test-xcode` examples and “Fix now.” | Convert to delegated simulator evidence helper. |
| P0-003 | `using-spec-first` | Router recommends `git-commit-push-pr` internal helper. | Route PR-description needs through public workflow/shipping handoff. |
| P0-004 | `lfg` | Legacy autonomous pipeline still encodes review/test/commit/push/PR behavior. | Retire or hard-hide. |
| P0-005 | `spec-design-iterator` | Proactive mutating agent lacks parent-owned write/stop/verification contract. | Retire or move into explicit workflow phase. |
| P0-006 | `spec-figma-design-sync` | Agent owns Figma/browser capture, code mutation, verification, and completion. | Split diagnosis from workflow-owned mutation. |
| P0-007 | runtime drift audit | Runtime parity is unverified due to trusted-checkout validation failure. | Fix audit support or emit explicit degraded runtime parity report. |
| P0-008 | shared review closure | Code/doc/app review lack one shared `review-finding.v1` minimum. | Define shared finding envelope with workflow extensions. |

## Top 10 Must-Fix Issues

1. Remove public-command examples and direct fix authority from `test-browser`.
2. Remove public-command examples and direct fix authority from `test-xcode`.
3. Remove `git-commit-push-pr` internal-helper recommendation from `using-spec-first`.
4. Retire or hard-hide `lfg`.
5. Retire or workflow-gate `spec-design-iterator`.
6. Split or retire `spec-figma-design-sync`.
7. Make runtime drift audit produce a report or explicit degraded status.
8. Define shared `review-finding.v1`.
9. Add compact stage contracts to the core chain.
10. Add explicit evidence labels to compound/session-derived knowledge.

## Top 20 Recommended Optimizations

1. Promote `spec-write-tasks` Task Pack Contract as the artifact template.
2. Add `artifact-header.v1` to durable Markdown artifacts.
3. Add `evidence-packet.v1` for high-risk plan/review/work/compound claims.
4. Normalize document-review lens outputs.
5. Add context budgets to web/slack/session/history researchers.
6. Make `spec-work-beta` a thin explicit beta wrapper over `spec-work`.
7. Add top budget and mutation gates to `spec-optimize`.
8. Add dirty-tree/server lifecycle policy to `spec-polish-beta`.
9. Add report-only/output-dir mode to `spec-skill-audit`.
10. Add local changelog reminders to mutating workflows.
11. Merge or retire older broad expert agents.
12. Split web/framework/best-practices researcher source authority.
13. Move long optional workflow branches to references.
14. Keep `spec-standards` preview-first and avoid rules-engine expansion.
15. Keep `using-spec-first` as router only, not workflow state.
16. Add source-derived capability manifest for public/internal/host availability.
17. Add agent forbidden-behavior boilerplate to all reviewer agents.
18. Require reviewer agents to declare finding emitter vs lens-note emitter.
19. Add focused audit tests for section presence and governance conflicts.
20. Preserve `.spec-first/` outputs as artifacts, not source truth.

## Keep As Templates

| Kind | Template candidates | Why |
| --- | --- | --- |
| Skills | `spec-skill-audit`, `spec-graph-bootstrap`, `spec-write-tasks`, `spec-doc-review`, `spec-plan` | Clear stage role, evidence handling, degraded-mode thinking, or durable artifact shape. |
| Code-review agents | `spec-adversarial-reviewer`, `spec-api-contract-reviewer`, `spec-correctness-reviewer`, `spec-performance-reviewer`, `spec-security-reviewer`, `spec-project-standards-reviewer`, `spec-testing-reviewer` | Triggered personas with evidence rules, confidence anchors, and structured output. |

## Most Need Rewrite

| Kind | Candidates | Reason |
| --- | --- | --- |
| Skills | `test-browser`, `test-xcode`, `using-spec-first`, `lfg`, `spec-work-beta` | First four are P0 boundary conflicts or legacy central orchestration; beta needs explicit opt-in and thin wrapper discipline. |
| Agents | `spec-design-iterator`, `spec-figma-design-sync`, `spec-security-sentinel`, `spec-pattern-recognition-specialist`, `spec-performance-oracle` | First two are P0 mutating agents; the rest overlap stronger structured reviewer/lens families. |

## Retire / Merge Candidates

| Action | Candidates |
| --- | --- |
| Retire or hard-hide | `lfg`, `spec-design-iterator` as proactive mutator, `spec-figma-design-sync` as mutating agent. |
| Convert to delegated helper | `test-browser`, `test-xcode`, selected git/shipping helpers. |
| Merge into canonical reviewer | `spec-data-integrity-guardian`, `spec-data-migration-expert`, `spec-performance-oracle`, `spec-security-sentinel`. |
| Convert to lens/manual helper | `spec-architecture-strategist`, `spec-pattern-recognition-specialist`, `spec-ankane-readme-writer`. |

## Pause New Skill / Agent Expansion

Recommendation: pause net-new skill/agent expansion except when a missing stage cannot be represented by existing workflows. The next increment should harden contracts and handoffs, not add personas.

## Skill MD Standard Template

```markdown
# Skill Name

## Purpose
One sentence describing the workflow stage.

## When To Use
- Trigger conditions.

## When Not To Use
- Explicit non-goals.

## Inputs
Required and optional inputs.

## Outputs
Durable and session-scoped outputs.

## Workflow
Numbered execution steps.

## Evidence Requirements
Claims that require file, diff, test, graph, user, or prior-decision evidence.

## Context Policy
Included context, excluded context, budgets, degraded providers.

## Tool / Script Boundary
Scripts prepare deterministic facts; LLM decides semantic judgment.

## Handoff
Upstream and downstream consumers.

## Safety Rules
Preview-first, source-first, no silent writes, changelog for source changes.

## Failure / Degraded Mode
Missing input, unavailable provider, failed tests, unsafe dispatch.
```

## Agent MD Standard Template

```markdown
# Agent Name

## Role
One expert role.

## Expertise
What this agent can judge.

## Trigger
When the parent skill selects it.

## Non-goals
What it must not decide.

## Required Inputs
Minimum context for a confident finding.

## Review Focus
Specific dimensions.

## Evidence Rules
Every finding cites evidence.

## Output Format
Structured finding or explicitly marked lens notes.

## Confidence Policy
High/medium/low or anchor thresholds.

## Escalation
What goes back to parent skill synthesis.

## Forbidden Behaviors
No workflow orchestration, no final merge decision, no invented evidence.
```

## `contract.yaml` Standard Template

```yaml
schema_version: stage-contract.v1
stage_id: spec-example
public_entrypoints:
  claude: /spec:example
  codex: $spec-example
inputs:
  required: []
  optional: []
outputs:
  required: []
artifacts:
  durable: []
  session_scoped: []
evidence_requirements: []
context_policy:
  include: []
  exclude: []
  budget: bounded
safety:
  write_policy: preview-first
  source_changes_require_changelog: true
degraded_modes: []
downstream_consumers: []
```

## `review-finding.v1` Minimum

```json
{
  "finding_id": "F-001",
  "severity": "blocking|high|medium|low|info",
  "category": "requirements|architecture|code-quality|test|security|performance|ux|i18n|analytics|graph|changelog|documentation",
  "title": "...",
  "description": "...",
  "evidence": [
    {
      "type": "file|diff|test|graph|standard|requirement|compound",
      "path": "...",
      "anchor": "...",
      "summary": "..."
    }
  ],
  "impact": "...",
  "recommendation": "...",
  "owner": "review-fixer|downstream-resolver|human|release",
  "requires_verification": true,
  "requires_changelog": true,
  "confidence": "high|medium|low",
  "residual_status": "unresolved|applied|deferred|accepted|not_applicable"
}
```

## Evidence Packet And Context Bundle Recommendation

Use `evidence-packet.v1` only at high-risk or cross-stage boundaries: review findings, graph-heavy planning claims, compound knowledge capture, runtime drift, and app-consistency issues. Its job is to separate facts, inferences, assumptions, and limitations; it should not store raw provider dumps.

Use `context-bundle.v1` for subagent dispatch and graph-heavy workflows. It should name included paths, omitted paths, source freshness, trust level, and token budget. It must stay a small envelope around existing facts, not a global context router.

## Automation Direction

- Extend `spec-skill-audit` to audit agents deterministically enough to produce facts, while keeping semantic judgment in reviewer synthesis.
- Make runtime drift audit work from the source checkout.
- Add section-presence and governance-conflict tests for internal helper exposure.
- Keep scorecards as signals, not gates.

## Do Not Expand

Do not add generic expert agents, a central workflow state machine, a heavy schema platform, automatic compound writes, or runtime mirror patches as a fix strategy.

## Next Minimal Fix Order

1. Fix internal/public helper conflicts: `test-browser`, `test-xcode`, `using-spec-first`, `lfg`.
2. Retire or split mutating agents: `spec-design-iterator`, `spec-figma-design-sync`.
3. Fix runtime drift audit support.
4. Introduce shared `review-finding.v1`.
5. Add compact contracts to the core chain.
