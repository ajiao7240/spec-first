# Doc-Review Pre-Facts Same-Document Baseline

## Target

- Target document: `docs/plans/2026-05-11-007-feat-review-pre-facts-injection-plan.md`
- Document type: plan
- Origin: performance analysis of spec-doc-review and spec-code-review runtime behavior
- Baseline purpose: same-document comparison artifact before enabling doc-review pre-facts default path

## Repo Snapshot

- Source revision at baseline capture: `415e30d90a9bf1cdae0b0d8d11e7595e9e6e4c49`
- Worktree state: dirty during implementation
- Compiled graph readiness: stale for this checkout because `.spec-first/graph/graph-facts.json` records `source_revision=b5ca72a99056fb2dc6c21b6e0c063c5d6b8203a7`, which does not match current HEAD
- Graph-fresh functional pass allowed from this baseline: no

## Current-Mode Baseline

- Current-mode wall time source: `wall_time_unavailable`
- Current-mode wall time value: not collected in host transcript for this implementation run
- Read count source: `read_count_unavailable`
- Read count value: not available
- Prompt token delta source: `prompt_token_delta_unavailable`

This artifact does not claim a read-count or wall-time target pass. It only establishes the same-document baseline path, target document, graph readiness status, and findings parity method required before doc-review default pre-facts rollout.

## Findings Baseline

- P0/P1 synthesized findings: none captured in a structured same-document current-mode run during this implementation session
- P2+ sampling: not captured; future validation must record any material quality drift explicitly
- Repeated-read samples: unavailable from host transcript

## Parity Method

When running pre-facts mode against the target document:

1. Record `Pre-facts tier: <tier> (<reason>)` from Coverage.
2. Compare P0/P1 findings against any future current-mode rerun for this same document; no P0/P1 may disappear.
3. Treat `read_count_unavailable` as blocking read-count improvement claims.
4. Treat `wall_time_unavailable` as blocking wall-time improvement claims for this baseline.
5. If graph freshness prerequisites remain unmet, validate bounded-reads / unavailable degradation behavior only.
