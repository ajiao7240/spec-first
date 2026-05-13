# Evidence And Context Audit

## Evidence Gap Table

| Object | Gap | Evidence | Recommendation | Priority |
| --- | --- | --- | --- | --- |
| legacy standalone skills | Missing explicit evidence requirements | Deterministic audit reports many missing sections in `.spec-first/audits/skill-audit/latest/skill-audit-report.json` | Add compact Evidence Requirements section or mark as auxiliary/non-Harness | P1 |
| spec-brainstorm | Evidence appears in dialogue guidance but not a normalized packet | Source has evidence-gap discussion, no stable requirements-packet | Add fact/inference/assumption block to requirements output | P1 |
| spec-plan | Strong graph/standards guidance, no shared evidence-packet | `skills/spec-plan/SKILL.md` has graph readiness block | Extract evidence-packet usage note for all planning claims | P1 |
| spec-code-review | Strong diff and pre-facts evidence | `skills/spec-code-review/SKILL.md` requires diff, pre-facts, confidence gate | Use as review evidence template | P2 |
| spec-doc-review | Strong pre-facts, but no durable JSON run artifact | `skills/spec-doc-review/SKILL.md` says no repo-local JSON promised | Add optional headless finding JSON only for callers that need it | P2 |
| compound | Memory/session evidence can enter docs | `skills/spec-compound/SKILL.md` includes auto memory and session history enrichment | Require explicit evidence labels and stale-doc checks | P1 |
| runtime drift audit | Runtime parity evidence unavailable | Runtime check failed trusted-checkout validation in this run | Treat runtime parity as unverified; fix audit or record degraded status | P0 |
| test-browser / test-xcode | Evidence helper can become fixer | Both expose direct examples and “Fix now” mutation options despite internal governance | Limit to evidence packet; parent workflow decides fixes | P0 |
| spec-design-iterator / spec-figma-design-sync | Agent can create evidence and mutate in one role | Both combine capture/comparison/implementation/verification behaviors | Split evidence collection from mutation; skill owns synthesis and writes | P0 |

## Context Bloat Risk Table

| Object | Risk | Evidence | Recommendation | Priority |
| --- | --- | --- | --- | --- |
| spec-plan | Large workflow and many optional references | File includes graph, research, deepening, doc-review, Proof handoff | Keep progressive disclosure; move long branches to references where possible | P2 |
| spec-code-review | Very long orchestration file | Many modes, reviewer catalog, fix loops in one file | Keep top contract, move templates/case details to references | P2 |
| spec-optimize | Long-running loop with disk checkpoints | File has many phases and persistence rules | Add top contract and budget gates before details | P1 |
| spec-compound | Many agent and enhancement paths | Full and lightweight modes, session enrichment, specialized reviews | Separate default lightweight path from optional enhancement references | P1 |
| agents with broad research mandate | Risk of reading too broadly | repo/web/slack/history researchers have broad descriptions | Require query, scan window, max source count, and evidence limits | P1 |
| spec-mcp-setup | Long setup/projection instructions | Setup, provider, permissions, runtime projection and repair guidance live together | Keep top contract short; move host-specific troubleshooting to references | P1 |
| spec-plan | Planning, deepening, doc-review and handoff branches | Rich prose is useful but hard to scan for contract | Keep plan as semantic owner; make top inputs/outputs/non-goals explicit | P1 |

## Provider Readiness Assumption Table

| Provider assumption | Current handling | Gap | Recommendation |
| --- | --- | --- | --- |
| graph_ready implies query_ready | Graph-bootstrap explicitly rejects this | Good | Preserve fail-closed query proof. |
| stale graph blocks all work | Plan/review/debug disclose and continue for lightweight tasks | Good | Keep graph-heavy handoff to graph-bootstrap. |
| live MCP updates canonical readiness | Code-review/plan say live MCP is session-local | Good | Repeat in standards/work where graph-heavy claims are made. |
| runtime mirrors are current | Runtime drift audit failed/skipped | Weak | Treat runtime parity as unverified until init/drift check runs successfully. |

## Missing Context Policy Table

| Asset family | Missing policy | Minimal fix |
| --- | --- | --- |
| helper skills | included/excluded context, write boundary | Add `Context Policy` and `Safety Rules` sections. |
| broad agents | required inputs, source budget | Add `Required Inputs`, `Evidence Rules`, `Forbidden Behaviors`. |
| document lenses | output schema and final-synthesis boundary | Require findings or lens notes that parent skill synthesizes. |
| mutating agents | write authority, stop condition, verification ownership | Move mutation to parent workflow; agent returns diagnosis or bounded patch only when explicitly delegated. |
| internal helper skills | public examples and command-like usage | Remove examples that look like user entrypoints; consume through parent workflows. |

## Suggested Evidence Packet v1 Usage

Minimum shape:

```yaml
schema_version: evidence-packet.v1
source_artifact: <path or none>
facts:
  - type: file|diff|test|graph|session|user
    path: <path>
    anchor: <line|section|query-id>
    summary: <bounded fact>
inferences:
  - claim: <claim>
    based_on: [<fact-id>]
assumptions:
  - claim: <unverified assumption>
    owner: user|llm|external
limitations:
  - <degraded provider, missing test, stale graph, etc.>
```

## Suggested Context Request / Context Bundle Usage

- `context-request.v1`: parent skill asks for bounded files, symbols, graph facts, tests, standards, and excluded context.
- `context-bundle.v1`: script or subagent returns included paths, omitted paths, freshness, token estimate, and trust level.
- Do not make these heavy. They should be small envelopes around existing facts, not a new central state machine.
