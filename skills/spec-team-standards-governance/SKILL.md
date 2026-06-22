---
name: spec-team-standards-governance
description: Govern team development standards as source documents: query confirmed standards, audit standards health, draft candidates, and prepare promotion/deprecation proposals without restoring spec-standards.
---

# Spec Team Standards Governance

Use this standalone skill when the user asks to query, initialize, audit, propose, promote, or deprecate team development standards. It is a source-maintenance method, not a public `$spec-*` workflow and not the retired `spec-standards` workflow.

## Hard Boundaries

- Do not create `$spec-standards`, `/spec:standards`, `skills/spec-standards/` or `.spec-first/standards/`.
- Do not edit generated runtime mirrors such as `.claude/`, `.codex/` or `.agents/skills/`.
- Standalone direct use defaults to report/proposal-only. Durable source mutation requires an active `$spec-work` or equivalent source-edit workflow, ordinary diff review, `CHANGELOG.md`, and focused tests.
- Scripts or structured steps may collect deterministic/advisory facts; the LLM decides semantic applicability and promotion posture.
- Only `trust=confirmed,lifecycle_state=active` and scope-matched standards can become hard context. `observed`, `suggested`, `imported`, `conflict` and `confirmed-draft` are not enforceable.
- Confidence score is not authority. High-impact governance, conflicts and owner-unresolved rules require owner/ADR/design-note handling.

## Modes

| Mode | Purpose | Output | Source mutation boundary |
| --- | --- | --- | --- |
| `query` | Return relevant standards for a workflow slice | Filtered rule IDs, matched files, excluded reasons, fallback and limitations | read-only |
| `init` | Initialize brownfield candidate notes from explicit sources | acquisition notes, candidate patch preview, conflicts | proposal-only; V1 writes candidates only inside source-edit workflow |
| `propose` | Draft candidates from repeated issues, incidents or source refs | `suggested` / `observed` candidate cards and decision trace | proposal-only |
| `promote` | Prepare confirmed-draft or confirmed patch proposal | promotion proposal with authority tier, gates, owner status and index patch preview | actual confirmed/index writes require source-edit workflow |
| `deprecate` | Prepare lifecycle downgrade | deprecated/archive patch preview and invalidation evidence | actual lifecycle/archive writes require source-edit workflow |
| `audit` | Check standards health | advisory drift/conflict/stale-owner/no-load-all report | no blocking gate |
| `eval/replay` | Evaluate an existing acquisition run with replay, retrieval, noise and owner-edit evidence | eval cases, threshold results, limitations and promotion evidence | read-only or validation artifact; never a promotion gate by itself |

## Reference Loading Map

Read only the references required by the active mode. Never load every reference by default.

| Scenario | Read references | Do not default-read |
| --- | --- | --- |
| `query` | `references/meta-prompt-governance.md`, `references/loading-and-consumption.md`; read `authority-tiers.md` or `promotion-and-conflicts.md` only if conflict/tier interpretation is needed | initialization, acquisition scoring, interview or replay details |
| `init` | `references/meta-prompt-governance.md`, `references/initialization.md`, `references/acquisition-quality.md`, `references/output-risk-profile.md` | replay/golden samples, full lifecycle details |
| `init` with V2 pilot input | `references/source-matrix.md`, `references/role-interview-playbook.md` when source mix or owner questions affect acquisition quality | unrelated surface refs, replay details unless samples exist |
| `propose` | `references/meta-prompt-governance.md`, `references/acquisition-quality.md`, `references/adaptive-expansion.md`, `references/promotion-and-conflicts.md`; use `references/source-matrix.md` when source authority is uncertain | all standards files, unrelated surface refs |
| `promote` | `references/meta-prompt-governance.md`, `references/authority-tiers.md`, `references/promotion-and-conflicts.md`, `references/loading-and-consumption.md` | initialization playbook, broad evidence collection |
| `deprecate` | `references/meta-prompt-governance.md`, `references/lifecycle.md`, `references/promotion-and-conflicts.md`, `references/authority-tiers.md` | acquisition task pack details |
| `audit` | `references/meta-prompt-governance.md`, `references/loading-and-consumption.md`, `references/lifecycle.md`, `references/output-risk-profile.md`; for V2 ledgers read `references/source-matrix.md` and `references/validation-and-replay.md` | role interviews unless owner gaps require follow-up |
| `eval/replay` | `references/meta-prompt-governance.md`, `references/validation-and-replay.md`, `references/output-risk-profile.md`, `evals/README.md`, and only the named eval cases | init/propose/promote details not needed for the eval question |

## Workflow

1. Parse mode from the user request. If unclear, default to `query` for lookup requests and `audit` for health-check requests; otherwise ask one short clarification.
2. Read `docs/contracts/team-standards.md`.
3. For standards selection, read `docs/standards/index.md` before rule files. If the index is missing, stale or scope is unknown, use the fallback modes from the contract.
4. Read only mode-specific references from the loading map.
5. Produce the mode output with `matched_rule_ids`, `matched_files`, `excluded_rule_ids`, `uncertainty_reason`, `fallback_mode`, `limitations`, and `source_refs_used` when applicable.
6. For candidate/proposal outputs, include `authority_tier`, owner status, `why_not_confirmed`, pre-write gate result, decision trace and next action.
7. For V2 acquisition or replay outputs, include `acquisition_id`, single extraction target, source anchors, evidence quality, replay status, owner-edit status, limitations and whether samples were sufficient.
8. If source edits are authorized by an outer source-edit workflow, keep writes scoped to `docs/standards/**`, this skill's source files, tests, docs and `CHANGELOG.md`; never patch runtime mirrors.

## Output Contract

Every output should include:

- `mode`
- `status`: `completed`, `degraded`, `blocked`, or `proposal-only`
- `source_refs_used`
- `matched_rule_ids` / `candidate_ids` / `proposal_ids` as applicable
- `acquisition_id` / `replay_case_ids` when evaluating V2 acquisition quality
- `fallback_mode` and `limitations`
- `next_action`

For promotion/deprecation proposals, include `gate_results`, `confidence.signals`, `autonomy.mode`, `next_action`, `outcome`, `decision_trace`, and the diff/source files that a source-edit workflow would update.

## Failure Modes

| Reason | Response |
| --- | --- |
| `contract-missing` | Degrade to host instructions and direct source reads; do not treat standards files as hard context |
| `index-missing` | Do not scan all `docs/standards/**`; ask for index creation or use explicit user-requested rule refs |
| `scope-uncertain` | Load only shared/high-priority safe summary; report uncertainty |
| `conflict-present` | Return conflict refs and owner next action; do not enforce |
| `prewrite-gate-failed` | Do not write candidate content; return report-only limitation |
| `source-edit-not-authorized` | Produce patch preview only |
| `not-enough-sample` | Record degraded eval evidence; do not claim replay/retrieval pass |
| `owner-unavailable` | Keep candidates advisory or prepare owner questions; do not infer owner approval |

## Non-Goals

- No CLI command, route-map entry, public workflow catalog entry or runtime mirror patch.
- No automatic rule mining to confirmed policy.
- No PR replay, retrieval eval, role interview or V2 ledger claim unless real pilot inputs exist.
