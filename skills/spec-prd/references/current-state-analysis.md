# Current-State Analysis

Load this reference before writing `Current System Snapshot`, `Change Delta`, or any code/source-backed PRD claim.

## Source Priority

Use the strongest available evidence and label the claim:

1. `confirmed-source` - repo source, tests, docs, contracts, templates, or deterministic command output directly confirms the claim.
2. `user-stated` - the product owner explicitly states the claim and it is not contradicted by confirmed source.
3. `gitnexus-pointer` - GitNexus or graph output points to a candidate file/symbol/flow but direct source confirmation has not happened.
4. `external-research` - explicit external source, with date and link or citation.
5. `assumption` - agent inference carried because it is safe, visible, and reviewable.

These PRD tags map to the existing graph evidence policy posture; do not add a new evidence enum or provider contract.

## GitNexus Boundary

When graph facts are stale, dirty, definitions-only, or impact-unavailable, GitNexus is a candidate pointer only. It can guide what to read next, but it must not be written as a confirmed current-state fact.

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

## Change Delta Vocabulary

Every material change should be classified:

- `keep` - explicitly preserved behavior or surface
- `extend` - added behavior on top of an existing capability
- `replace` - new behavior supersedes existing behavior
- `remove` - existing behavior is retired
- `unknown` - the owner or source evidence has not resolved the delta

Avoid "same as before" or "reuse existing logic" unless the preserved behavior and delta are explicit.

## Contradiction Handling

If user wording conflicts with confirmed source:

1. Record the mismatch as `contradiction`.
2. Cite the source path or source tag.
3. Give an evidence-backed recommended default when one is safe.
4. Ask one minimal owner question that decides scope or acceptance.

Do not silently convert user-stated claims into confirmed source facts.

## Confirmed Claim Rule

A current-state claim without an evidence tag cannot be treated as `confirmed-source`. Put it in `Evidence And Assumptions` or `Outstanding Questions` until confirmed.
