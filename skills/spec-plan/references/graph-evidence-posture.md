# Graph / GitNexus Evidence Posture (spec-plan reference)

This reference is loaded only when `skills/spec-plan/SKILL.md` Phase 1.1a.1 condition fires: the plan involves code implementation, architecture, API/routes, cross-module or cross-repo behavior, execution flows, testing strategy, or review risk, and graph artifacts, workspace advisory facts, or a current-session GitNexus MCP tool/resource surface are present. It does not apply to the no-graph/no-MCP fast unavailable path resolved earlier in 1.1a, and it does not apply to docs-only / prose-only / narrow non-code-affecting runs.

The probe is task-specific evidence context. It is not canonical readiness truth, must not replace `Graph Readiness.status`, provider `query_ready`, workspace `query_usability`, or impact support levels, and must not write back to `.spec-first/graph/*`, `.spec-first/providers/*`, `.spec-first/impact/*`, setup projections, or workspace advisory artifacts.

## Envelope Shape Source of Truth

The envelope schema (field list, ordering, and four-axis enum literals) lives in the `## Graph / GitNexus Evidence` block of `skills/spec-plan/references/plan-template.md`. Read that block to see the exact field names and enum values; do not reconstruct the schema from memory.

The four axes are:

- `capability_status=available|partial|unavailable|mutation-gated`
- `evidence_grade=primary|session-local|advisory|stale`
- `evidence_posture=primary|fallback`
- `freshness_state=fresh|stale|dirty-advisory|query-unverified`

Vocabulary semantics are locked by `docs/contracts/graph-evidence-policy.md`; consumption boundary is locked by `docs/contracts/graph-provider-consumption.md` and `docs/contracts/workspace-gitnexus-consumption.md`.

## Four-Axis Interpretation

Interpret the envelope with `docs/contracts/graph-evidence-policy.md` as source of truth.

- `evidence_grade=primary` is the Plan alias for confirmed evidence.
- `evidence_posture=fallback` means the Plan chose direct source reads / ast-grep / git diff / code-review-graph instead of GitNexus for this question.
- `evidence_posture=fallback + evidence_grade=primary` is valid when the fallback facts are current source, test, schema, or command evidence; posture describes which provider was used, grade describes how trustworthy the fact is.
- `source_reads_required mandatory` means source reads are required for stale/advisory/session-local paths and for any `evidence_posture=fallback`; they are still strongly expected when primary graph evidence changes implementation scope or tests.

The validity matrix in `docs/contracts/graph-evidence-policy.md` (Plan envelope validity matrix) enumerates illegal axis combinations such as `capability_status=unavailable + evidence_grade=primary`, `capability_status=unavailable + evidence_posture=primary`, `capability_status=mutation-gated + automatic mutation step`, `freshness_state=stale + evidence_grade=primary`, `freshness_state=dirty-advisory + evidence_grade=primary`, and `freshness_state=query-unverified + evidence_grade=primary`. Honor that matrix when filling the envelope.

## Native Capability Selection

Native capability selection is LLM-owned and task-matched, not a deterministic router:

| Task signal | Prefer | Fallback when unavailable |
| --- | --- | --- |
| Route/API handler or consumer changes | `api_impact`, then `route_map`, then `shape_check` where applicable | `query` / `context` plus bounded source reads |
| Response shape risk | `shape_check` | route handler reads plus consumer source reads |
| Symbol/refactor/reuse question | `query`, `context`, `impact` | bounded `rg` / ast-grep / code-review-graph |
| MCP/RPC/tool surface change | `tool_map` | tool definition source reads |
| Complex graph structure question | `cypher` only after schema/resource orientation | direct contract/source reads |
| Repo/workspace orientation | `list_repos`, `group_list`, and read-only MCP resources | workspace advisory artifacts or bounded per-repo reads |

Always report the matched capability as `native_tool_or_resource`; never hide it behind "GitNexus used: yes". Current MCP tools and read-only MCP resources are session-local tool/resource selection guidance; verify the live surface before claiming availability, and label successful live evidence as `session-local`. If a specialized native capability is unavailable, continue with `query` / `context` plus source reads, or fall back to bounded direct repo reads; do not claim a static durable capability catalog is current truth.

## Scope Authority and Mutation Boundary

Scope authority remains with the user request, origin requirements, plan/task pack, and current git diff. GitNexus findings only propose risks, impacted surfaces, reuse candidates, test candidates, or follow-up options; they must not expand implementation scope automatically. Mutation-capable capabilities such as `workspace_group_sync`, `group_sync`, `symbol_rename`, GitNexus `rename`, or equivalent provider mutations must be labeled `mutation-gated` / `requires explicit user action`, kept preview-first, and must not become automatic implementation units.

## Multi-Repo Workspace Posture

Multi-repo plans must report registry evidence, group evidence, per-repo `query_usability`, dirty/stale limitations, and the current write boundary. Any plan that could lead to edits, tests, changelog updates, commits, or review autofix must name `target_repo` or per-unit repo scope before write/test/changelog/commit-oriented work. If GitNexus impact returns extra repo candidates, record the extra repo candidates as risks or follow-ups unless the user changes scope explicitly.
