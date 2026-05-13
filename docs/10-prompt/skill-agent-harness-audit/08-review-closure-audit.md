# Review Closure Audit

## Review Capability Checklist

| Capability | spec-code-review | spec-doc-review | spec-app-consistency-audit | Current judgment |
| --- | --- | --- | --- | --- |
| Binds to diff | Yes | Indirect/document path | Yes in headless/from code-review | Strong for code review. |
| Binds to task-pack | Plan/task artifacts optional | Yes for task-pack docs | Indirect | Medium. |
| Binds to evidence-packet | Pre-facts and graph context, not named v1 | Pre-facts, not named v1 | Strong domain artifacts | Needs shared v1. |
| Binds to context-bundle | Implicit review context | Implicit codebase-facts | app-audit-context.json | Needs shared v1. |
| Structured finding | Yes | Yes, workflow-specific | Yes | Strong but divergent schemas. |
| Severity/category/evidence/recommendation | Yes | Yes | Yes | Good. |
| requires_changelog | Not universal per finding | Not universal per finding | Not universal | Add field to review-finding.v1. |
| fix-plan | Safe_auto/gated/manual routing | safe_auto/manual modes | Preview writeback | Good. |
| re-review | Code-review has validation/review loops | Doc-review has review/fix interaction | Evidence gates | Medium-high. |
| residual risk | Coverage sections | Review envelope | Final report | Good. |
| compound candidate | Code-review has learning capture recommendation | Not universal | Handoff boundary | Medium. |
| final merge/no-merge | Code-review verdict | Doc-review does not merge | App-audit scope verdict | Correct boundary. |
| agent final judgment overreach | Some freeform doc agents can sound final | Parent synthesis owns final judgment | Expert prompts bounded | Needs template hardening. |

## Maturity Rating

Current review maturity: L4, finding -> fix-plan -> re-review exists in code-review and partially in doc-review/app-audit. It is not yet L5 because the review family lacks one shared minimum finding envelope, compound is advisory, and reusable knowledge is not consistently backed by an evidence-packet/compound-delta chain.

Target maturity: L5, finding -> fix-plan -> re-review -> compound, but only when the finding produced a reusable lesson. Compound must remain opt-in/advisory, not automatic knowledge writeback.

## Closure Findings

| id | Finding | Evidence | Recommendation | Priority |
| --- | --- | --- | --- | --- |
| RC-001 | Shared review-finding schema is missing | Code/doc/app audit all define local finding shapes | Add minimal `review-finding.v1` with optional extensions | P0 |
| RC-002 | Changelog requirement is repository-level, not finding-level | `AGENTS.md` requires changelog; review schemas do not always carry `requires_changelog` | Add `requires_changelog` and `changelog_reason` to review finding where source changes are proposed | P1 |
| RC-003 | Agent freeform outputs can destabilize synthesis | Several doc lenses and old experts lack JSON output | Either mark them as lenses or give them structured finding output | P1 |
| RC-004 | Compound closure is not guaranteed | Code-review offers learning capture, compound remains separate | Keep optional, but pass evidence-packet summary when invoked | P2 |
| RC-005 | Mutating agents can bypass closure | `spec-design-iterator` and `spec-figma-design-sync` combine diagnosis, code change, and verification | Parent workflow must own mutation, re-review, and completion; agents return bounded findings or patches only | P0 |
| RC-006 | Internal test helpers can bypass closure | `test-browser` / `test-xcode` offer direct fix options while marked internal | Convert to evidence-only helpers so review/work owns any fix/re-review loop | P0 |

## Closure Target

The minimum H5 closure path is:

```text
finding -> owner/routing -> fix decision -> verification -> residual risk -> optional compound
```

The shared contract only needs to normalize the small fields every review workflow already needs: evidence, severity, confidence, owner, verification, changelog requirement, residual status, and source artifact. Domain-specific review workflows can keep richer extensions.
