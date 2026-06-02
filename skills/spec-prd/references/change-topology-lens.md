# Change Topology Lens

Load this reference early for the run-local Framing Gate when the user's wording already signals removal, migration, workflow/contract change, source-of-truth movement, generated/runtime mirrors, package/docs/test cleanup, or cross-surface scope. Reuse it after current-state analysis and before drafting requirements when the change may alter capability identity, source-of-truth, workflow handoff, artifacts, contracts, runtime generation, or active product surface.

This lens classifies the **shape of the system change**, not the user's input intent. A single PRD may use more than one topology, but choose the primary topology that most affects planning invention risk.

This is not a request to add implementation units. The lens defines WHAT boundaries so planning does not invent affected surfaces, consumers, or source-of-truth decisions.

## Framing Gate

Before deep evidence gathering, classify the likely system shape from the user's request, existing PRD, or rough note. This gate is internal authoring discipline: use it to decide what to inspect and what to ask, not to force a new final PRD section.

Write a compact scratch answer to these prompts:

```text
candidate_topologies:
load_bearing_surfaces:
source_of_truth_risk:
producer_consumer_risk:
negative_space_risk:
owner_question_needed:
evidence_plan:
```

Use `unknown` where the prompt is not enough. Do not keep reading indefinitely to avoid one hard product decision; if the missing answer changes WHAT, ask the smallest owner question.

## Evidence Plan

Before turning current-state observations into PRD claims, identify the evidence needed for each load-bearing surface:

```text
claim_or_question | surface | source_to_read_or_command | required_evidence_tag | why_load_bearing | fallback_if_unconfirmed
```

Evidence planning is mandatory for workflow, contract, setup/runtime, migration, replace, remove, and mixed-surface PRDs. It is optional for small single-surface `add` or `extend` increments. The plan may stay in scratch form, but every material final claim must still use the evidence tags from `current-state-analysis.md`.

Use evidence planning to prevent two failure modes:

- broad repo reading without knowing which WHAT decision it proves;
- narrow reading that misses package, docs, tests, runtime generation, or downstream consumers.

## Topology Table

| Topology | Use when | PRD precision risk |
| --- | --- | --- |
| `add` | A new capability, entry, state, artifact, or workflow surface is introduced. | Plan may invent where it attaches or who consumes it. |
| `extend` | Existing capability gains behavior while preserving identity. | A real identity/default/permission change may be hidden as "enhancement". |
| `replace` | New behavior supersedes old behavior. | Old behavior exit, compatibility, migration, and rollback may be underspecified. |
| `remove` | Existing active behavior, entry, artifact, or integration is retired. | Producers, consumers, tests, docs, and package surfaces may remain alive. |
| `migrate` | Source-of-truth, data ownership, runtime delivery, or config authority moves. | Dual-write, drift, validation, and rollback boundaries may be invented later. |
| `split` | One large product/system scope becomes multiple independently plannable scopes. | Shared identity, release order, and cross-scope contracts may drift. |
| `merge` | Multiple concepts, entries, or workflows collapse into one. | Old names/routes/docs may stay current or consumers may not know the canonical path. |
| `policy-change` | Defaults, permissions, gating, compliance, operational rules, or support policy change. | Behavior vs documentation-only change may blur. |
| `workflow-change` | Skill, agent, command, handoff, review, setup, or runtime workflow behavior changes. | Entry, artifact, downstream consumer, and generated runtime boundaries may be missed. |
| `contract-change` | Schema, artifact, API, config, CLI output, package surface, or test contract changes. | Versioning, producer/consumer coverage, and compatibility may be incomplete. |

## Required Reasoning Blocks

Use these blocks only when they reduce planning invention. Keep them compact for small changes.

### Surface Map

```text
surface | current behavior | owner/source | artifact/contract | consumer | delta | evidence
```

Suggested surfaces: user entry, CLI/API/UI, skill/agent/workflow, config, runtime generation, artifact/schema/report, docs/onboarding, tests/fixtures/package, release/ops/support.

### Producer / Artifact / Consumer

Use when any durable or semi-durable output exists:

```text
producer | artifact/schema/path | freshness/authority | consumers | change effect | evidence
```

This is required for workflow, contract, runtime, setup, review, reporting, schema, and deletion/migration PRDs. It is also useful for add/extend PRDs when a new artifact will be consumed downstream.

### Source-Of-Truth Resolution

Use for generated assets, mirrored docs, config, schemas, artifacts, templates, external-tool facts, or source/runtime boundaries:

```text
current_source_of_truth:
target_source_of_truth:
generated_mirrors:
non_authoritative_refs:
conflict_rule:
```

Generated mirrors, stale artifacts, external-tool output, copied docs, and historical plans are not source-of-truth unless the PRD explicitly promotes them and names why.

### Negative Space

For high-risk, mixed-surface, workflow, contract, migration, replace, or remove changes, add negative acceptance examples:

- what must not be generated, called, installed, exposed, linked, consumed, widened, or treated as current truth;
- what existing behavior, permission, data, entry, or source boundary must remain unchanged;
- what future capability is explicitly out of scope.

## Owner Question Ladder

Ask only questions that decide scope, behavior, source-of-truth, or acceptance. Prefer source reads over owner questions when the repo can answer the point.

- `add`: Where does this attach, who is the first real consumer, and which existing defaults/permissions must remain unchanged?
- `extend`: Which identity is preserved, and which default, entry, permission, or actor behavior must not change?
- `replace`: What is the old behavior's exit rule, coexistence window, compatibility promise, and rollback boundary?
- `remove`: Which active entries, generated outputs, docs/tests/package surfaces, and downstream consumers must be gone versus archived?
- `migrate`: What is the current authority, target authority, coexistence/read path, drift check, and backout rule?
- `split`: Which child scope is independently plannable first, and what shared identity or dependency must stay common?
- `merge`: What is the canonical name/entry, and what happens to old aliases, routes, docs, and consumers?
- `policy-change`: Who owns the policy decision, when does it take effect, and what exception/support/audit language is required?
- `workflow-change`: Which public entry, internal helper, dispatch boundary, handoff artifact, generated runtime mirror, and downstream skill changes?
- `contract-change`: Who produces the contract, who consumes it, what version/compatibility rule applies, and which fixtures/tests prove it?

If more than three owner questions seem necessary, summarize the unresolved decision cluster and route to PRD refine/doc review instead of interrogating the owner through a long form.

## Topology-Specific Gates

- `add`: entry/attachment point, owner, first consumer, empty/error/permission behavior, and non-goals are explicit.
- `extend`: preserved identity and unchanged defaults/permissions are named; identity drift is either rejected or promoted to `replace`/`policy-change`.
- `replace`: old behavior exit, coexistence window, compatibility, rollback, and user/docs/test impact are explicit.
- `remove`: active surfaces, producers, artifacts, consumers, tests, docs, package/runtime, and archive boundaries are closed.
- `migrate`: current and target source-of-truth, dual-write/read window, drift detection, backout, and validation owner are explicit.
- `split`: shared identity, child scopes, cross-scope dependencies, priority/release order, and planning entrypoint are explicit.
- `merge`: canonical name/entry, old aliases/routes/docs, redirects/fallbacks, and consumer updates are explicit.
- `policy-change`: decision owner, effective date/default, affected actors, exception handling, audit/support wording, and rollback are explicit.
- `workflow-change`: public entry, internal helper boundary, artifacts, handoff, dispatch, generated runtime, and downstream skills are explicit.
- `contract-change`: producer, schema/version, consumer compatibility, fixture/test updates, and package/release impact are explicit.

## Readiness Rule

If the topology lens exposes unanswered questions that would force `spec-plan` to decide WHAT, the PRD is not `ready-for-planning`. Ask the smallest owner question, record a visible assumption, or route to doc review.
