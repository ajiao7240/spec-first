# Current-State Analysis

Load this reference before writing `Current System Snapshot`, `Change Delta`, or any code/source-backed PRD claim.

## Source Priority

Use the strongest available evidence and label the claim:

1. `confirmed-source` - repo source, tests, docs, contracts, templates, or deterministic command output directly confirms the claim.
2. `user-stated` - the product owner explicitly states the claim and it is not contradicted by confirmed source.
3. `source-candidate` - a bounded source search or user-provided pointer identifies a candidate file/symbol/flow, but direct source confirmation has not happened.
4. `external-research` - explicit external source, with date and link or citation.
5. `assumption` - agent inference carried because it is safe, visible, and reviewable.

These PRD tags are authoring provenance labels, not a provider contract.

## Source Candidate Boundary

Candidate source hits can guide what to read next, but they must not be written as confirmed current-state facts until direct source/docs/tests or deterministic command output confirms the claim.

If a claim affects scope, acceptance, compliance, money movement, user-visible behavior, or permission boundaries, confirm it with direct source/docs/tests or record it as `assumption` / `Outstanding Questions`.

## Snapshot Coverage

Right-size the snapshot, but check these dimensions before deciding something is irrelevant:

- existing user-visible capability or workflow
- pages, routes, commands, APIs, or background jobs involved
- roles, permissions, accounts, and actor boundaries
- status, exception, empty, loading, retry, and failure behavior
- configuration, feature flags, tenant/market/region rules
- docs, tests, templates, or contracts that already define the behavior

Current-state discovery constrains the PRD. It does not expand the product scope by itself.

## Framing-Aligned Evidence

When `change-topology-lens.md`'s Framing Gate is active, use its evidence plan to guide source reads before writing final current-state claims:

- each load-bearing claim should explain which WHAT boundary it supports;
- each source read should either confirm a current-state claim, expose a contradiction, or close an affected surface;
- package, docs, tests, fixtures, runtime generation, and downstream workflow consumers are first-class surfaces when the topology touches them;
- external-tool output, generated mirrors, historical docs, and old plans remain pointers unless direct source/docs/tests confirm the current fact.

Do not turn the evidence plan into a second artifact contract. It is a run-local guard against undersampling the current system.

## Change Delta Vocabulary

Every material change should be classified:

- `keep` - explicitly preserved behavior or surface
- `extend` - added behavior on top of an existing capability
- `replace` - new behavior supersedes existing behavior
- `remove` - existing behavior is retired
- `unknown` - the owner or source evidence has not resolved the delta

Avoid "same as before" or "reuse existing logic" unless the preserved behavior and delta are explicit.

## Surface And Contract Discovery

For medium, large, mixed-surface, workflow, contract, setup/runtime, migration, replace, or remove changes, current-state analysis should identify affected surfaces before drafting requirements. Use a compact map when it prevents planning from inventing scope:

```text
surface | current behavior | owner/source | artifact/contract | consumer | delta | evidence
```

Typical surfaces include user entry, CLI/API/UI, skill/agent/workflow, config, runtime generation, artifact/schema/report, docs/onboarding, tests/fixtures/package, and release/ops/support. Mark non-involved surfaces as out of scope only when that boundary matters.

When a durable or semi-durable output exists, identify the chain:

```text
producer | artifact/schema/path | freshness/authority | consumers | change effect | evidence
```

Producer/consumer discovery is required when the PRD changes workflow handoff, generated assets, setup facts, review facts, schemas, reports, package contents, or any artifact that another skill, CLI command, test, or document consumes.

## Source-Of-Truth Discovery

For generated assets, mirrored docs, config, schemas, artifacts, templates, external-tool facts, or source/runtime boundaries, record:

```text
current_source_of_truth:
target_source_of_truth:
generated_mirrors:
non_authoritative_refs:
conflict_rule:
```

Historical docs, stale artifacts, generated mirrors, copied docs, and external-tool output are not source-of-truth unless the PRD explicitly promotes them and explains why. If source-of-truth is unclear, use `Outstanding Questions` or a visible assumption rather than letting planning decide.

## Contradiction Handling

A contradiction can arise from three sources: user wording, confirmed source, and the project domain glossary (`docs/contracts/domain-glossary.md`) when it exists. If any two conflict:

1. Record the mismatch as `contradiction`.
2. Cite the source path or source tag for each side (including the glossary's `canonical_name` when a canonical term is involved).
3. Give an evidence-backed recommended default when one is safe. Prefer the established canonical term over a new ad-hoc one unless the source proves the canonical is now stale.
4. Ask one minimal owner question that decides scope or acceptance.

Do not silently convert user-stated claims into confirmed source facts, and do not silently override an established canonical term — surface the conflict.

## Confirmed Claim Rule

A current-state claim without an evidence tag cannot be treated as `confirmed-source`. Put it in `Evidence And Assumptions` or `Outstanding Questions` until confirmed.
