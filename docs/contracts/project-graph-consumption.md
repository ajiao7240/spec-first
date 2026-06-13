# Project Graph Consumption Contract

`project-graph-consumption.v1` defines how workflows consume project-graph and code-graph capability-class providers as candidate evidence. It is an advisory consumption contract, not a provider readiness contract, not a workflow state machine, and not a confirmed evidence source.

This contract belongs to the Evidence Harness map in `docs/contracts/ai-coding-harness.md`. It closes the provider-consumption gap between setup-owned readiness facts and workflow-owned semantic judgment without adding a second evidence schema.

## Goals

- Give workflows one source of truth for project-graph consumption boundaries.
- Preserve candidate-only usage: project-graph output can orient investigation, but it cannot prove findings, scope, root cause, affected tests, or merge readiness.
- Keep provider readiness mechanical and workflow conclusions source-grounded.
- Reuse existing evidence fields instead of adding a graph-specific schema.

## Non-Goals

- Do not make project-graph output confirmed evidence.
- Do not make project-graph a deterministic TIA, coverage, affected-test, dependency, or ownership provider.
- Do not require workflows to run project-graph before direct source reads.
- Do not run mutation, generation, refresh, or repair operations through this consumption contract.
- Do not read full project-graph artifacts as context; never cat graph.json.

## Capability Vocabulary

Use provider-neutral capability classes in workflow prose:

- `project-graph`: strategic repository map candidates for broad orientation, relationship paths, and concept explanation.
- `code-graph`: tactical code-structure candidates such as call graph, impact, ownership, and affected-test hints.

`rg` and ast-grep are stateless baseline source-location tools, not readiness-lifecycle providers. Naming them in contracts or workflow skills is allowed because provider-neutral constraints are aimed at lifecycle providers, not baseline source search tools.

Provider-specific commands may appear only in an appendix or setup-owned implementation docs. Workflow SKILL prose should refer to capability classes and native surfaces, not provider command names.

## Consumption Gradient

Use project-graph output only to shrink the next read:

1. Broad orientation query: identify candidate areas, documents, or concepts to inspect.
2. Relationship path: inspect a candidate relationship between two named areas.
3. Concept explanation: get a scoped concept map before returning to source.

The output stays candidate-only. A useful candidate can change where you look first, but it cannot become the answer.

## Trigger Shape

Default project-graph use is appropriate for architecture relationships, cross-file relationships, impact analysis, broad codebase navigation, and questions about how one project area connects to another.

Default project-graph use is not appropriate for simple factual Q&A, current conversation or current-context summaries, user-provided single-document summarization/editing, or already-scoped file reads. In those cases, answer directly, use bounded source reads, or use baseline search tools first. A workflow may still use project-graph later if the request expands into architecture or impact analysis.

## Readiness Gate

Availability is anchored in setup-facts, not artifact presence:

1. Read the setup-facts artifact that carries `provider_readiness[]`.
2. Confirm the artifact has trustworthy top-level freshness metadata, including `generated_at`. If setup facts are missing, stale, missing `generated_at`, or otherwise freshness-untrusted, record project-graph availability as unknown and fall back to bounded direct source reads, `rg`, and ast-grep.
3. Consume the single provider entry whose capability class you intend to use. Do not transfer readiness from another provider.
4. Interpret `readiness_status` at the provider-entry level:
   - `fresh`: exploration-tier orientation may use the provider; conclusion-tier claims still require source/test/log/doc confirmation.
   - `stale`: exploration-tier orientation may use the provider when you annotate that the graph lags HEAD; it must not directly support conclusion-tier claims, which must be re-grounded regardless.
   - `unknown` / `unverified`: do not use the provider as a readiness-backed candidate source; use bounded direct reads, `rg`, and ast-grep.
   - `degraded` / `not-run`: use only when the degradation still leaves a clearly bounded read-only native surface; otherwise fall back.

Fallback triggers are: provider missing, setup-facts freshness untrusted, readiness facts missing, readiness self-reported as `unknown`/`unverified`, provider call failure, explicit disablement, or unsafe context. Fallback is never-blocking for ordinary workflows.

## Trust Tiers

Exploration-tier navigation may use project-graph candidates directly to decide where to inspect next.

Conclusion-tier consumption must be confirmed from source, tests, logs, docs, contracts, or user confirmation before it appears in a plan claim, review finding, root-cause conclusion, implementation basis, or shipping claim.

## Relay Chain

This relay is a trust-elevation direction, not a call-priority order. Trust rises from project-graph (advisory orientation - "where to look first") through code-graph / `rg` / ast-grep (tactical locating - "where exactly, connected to what") to source / tests / logs / docs (confirmed truth - "is it actually so"); the funnel narrows scope as trust rises. Any workflow may start directly at a lower layer - reading source first is always valid, and skipping project-graph is not a violation; whether to issue a project-graph query is an LLM judgment based on readiness facts and task shape. The one hard rule is no skip-layer elevation: a project-graph candidate must not enter a conclusion-tier claim without lower-layer confirmation.

When code-graph derived relationship facts, such as call edges, impact surfaces, ownership candidates, or affected-test candidates, enter conclusion-tier claims, they also require confirmation. Verbatim source snippets returned through a native code-graph interface count as bounded direct reads when the workflow records file and line references; they do not require ceremonial re-reading.

## Recording Rules

Do not add schema fields or graph-specific evidence enums.

- Advisory project-graph or code-graph use, including queries run and candidates accepted or rejected, is summarized in `provider_untrusted.summaries[]` for work-run artifacts.
- Confirmed evidence is recorded in existing direct evidence fields such as `direct_evidence_used.source_refs`, `direct_evidence_used.checks_or_logs`, and `direct_evidence_used.limitations`.
- Review outputs record confirmed coverage in their existing `Direct evidence:` lines and may name provider candidates only as untrusted coverage context.
- Cross-workflow handoff reuses `evidence_summaries[]`.
- Setup-side `lifecycle.fallback_used` remains separate from consumption-side fallback notes.

## Project-Graph Limitations

Project-graph is an advisory candidate provider. It does not unlock deterministic TIA, coverage, dependency graph, ownership, affected-test, or review-impact claims as confirmed facts. Those claims need direct evidence even when project-graph output looks plausible.

## Validation Expectations

- Contract tests should pin the candidate-only rule, the readiness-status mapping, the never-cat graph artifact rule, the fallback trigger set, the recording fields, and the relay-chain no skip-layer elevation rule.
- Workflow tests should assert that each consuming workflow references this contract and keeps provider-specific command names out of workflow SKILL prose.
- Setup tests should keep readiness facts mechanical: exit status, output presence, provider lifecycle bits, and advisory next actions only.

## Appendix: Provider-Specific Examples

When a project-graph provider is available through Graphify, query with domain terms instead of the tool name itself. For example, prefer a broad architecture question about "workflow evidence boundary" over a self-referential query about "graphify". Use `graphify query`, `graphify path`, or `graphify explain` only as bounded read-only navigation, then return to source.
