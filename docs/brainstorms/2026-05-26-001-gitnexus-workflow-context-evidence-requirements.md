---
date: 2026-05-26
topic: gitnexus-workflow-context-evidence
spec_id: 2026-05-26-001-gitnexus-workflow-context-evidence
---

# GitNexus Bounded Pre-Facts Capability Extension

## Summary

将现有 `review-pre-facts` 的 bounded GitNexus query-plan 从单一 `query` 扩展到 deterministic helper 适合固化的四个 read-only operation：`query`、`context`、`impact`、`detect_changes`；同时把 GitNexus 其余 read-only 深能力纳入 workflow-native session lane 与 workspace/group resource lane，形成完整 AI Coding Harness 集成。

这不是把 GitNexus 变成 workflow engine。`spec-plan`、`spec-code-review`、`spec-debug` 已经有 SKILL prose 和 downstream contract 规定 Graph / GitNexus Evidence、Coverage、debug hypothesis ledger、non-expansion、stale fallback 和 non-graph confirmation 边界。本需求补齐两层缺口：一是 deterministic facts layer 能生成、校验、归一化、渲染高频深度 GitNexus evidence；二是 `route_map`、`api_impact`、`shape_check`、`tool_map`、`cypher`、group-aware `query/context/impact` 和 GitNexus resources 在明确任务场景下有统一的 provenance、budget、redaction、degraded reason 和 durable summary 边界。

---

## Problem Frame

当前 `spec-first` 已具备 GitNexus graph readiness、provider consumption、Plan envelope、Code Review Coverage、Debug hypothesis ledger 和 downstream graph evidence contract。但 `src/cli/helpers/review-pre-facts.js` 的 deterministic query-plan 仍只产出 `gitnexus.query`，normalizer 也主要理解 `facts` / `process_symbols` / `definitions` 这类 query-shaped 输出。

这造成一个实际缺口：workflow prose 已经允许使用 `context`、`impact`、`detect_changes` 等深度能力，但可复用、可校验、可降级的 facts helper 仍停留在浅层 query。结果是 plan / review / debug 可以临时调用 GitNexus，但缺少统一的 operation bounds、provenance、redaction、size cap、raw-result validation 和 workflow-neutral facts rendering。

### Glossary

- **bounded query-plan** — helper 产出的 executable plan；orchestrator 只能执行 plan 中声明的 tool、operation 和 arguments。
- **operation profile** — 每个 GitNexus operation 的固定参数边界、raw-result budget、normalization shape 和 degraded reason。
- **workflow-neutral facts** — 给 `plan` / `debug` 使用的 facts wording；不包含 reviewer Coverage、finding、dispatch gate 等 review-only 语义。
- **session-local evidence** — 当前会话 live MCP tool/resource 返回的事实；可用于本轮判断，不回写 compiled readiness。
- **durable artifact** — 会进入 repo docs、plan、review summary、debug summary 或 workflow run artifact 的持久输出；必须避免 raw provider output 和未脱敏私有标识符外泄。

---

## Existing Baseline

这些能力已经存在，不作为本次新增实现范围：

- `spec-plan` 已有 `## Graph / GitNexus Evidence` template，包含 `capabilities_used`、`key_findings`、`impact_on_plan`、`source_reads_required`、`limitations`。
- `spec-plan` 已有 Graph / GitNexus Evidence Posture 规则，负责四轴 posture、source tags、native capability selection 和 non-expansion。
- `spec-code-review` 已有 GitNexus native capability routing candidates、Coverage graph evidence 行、finding 必须由 diff/source/test/contract 确认的边界。
- `spec-debug` 已有 optional `graph_evidence` hypothesis ledger 字段，以及 graph-informed causal link 必须由 non-graph observation 关闭的 gate。
- `docs/contracts/downstream-graph-evidence-consumption.md` 已定义 plan-intake、review-preflight、debug-trace、degraded-once 和 non-expansion。
- `docs/contracts/graph-evidence-policy.md` 已定义 graph evidence 四轴、stale/degraded/definitions-only 处理、conflict handling 和 mutation boundary。
- `review-pre-facts` 已有 temp artifact boundary、raw size cap、single-query cap、path containment、snapshot freshness、provenance validation 和 degraded render。

本需求不重新立这些 contract，只要求 helper 实现能够匹配它们。

---

## Goals

- G1. `review-pre-facts` prepare mode can emit bounded query-plan entries for `query`、`context`、`impact`、`detect_changes`.
- G2. Raw live MCP output for those operations can be validated, normalized, budgeted, and rendered without unbounded prompt injection.
- G3. `plan` / `debug` receive workflow-neutral facts wording; existing `doc-review` / `code-review` reviewer wording remains backward compatible.
- G4. Operation-specific facts preserve useful graph signal, such as symbol relationship, blast-radius summary, affected modules/processes, changed-symbol scope, and required source reads.
- G5. Durable artifacts never retain raw provider output or unredacted private repo evidence by default.
- G6. Workflow-native GitNexus calls for route/API/tool/Cypher and workspace/group resources have a shared evidence envelope, so they improve context and evidence quality without bypassing Harness governance.
- G7. `spec-work` and Knowledge workflows can consume source-confirmed graph evidence for read/test focus and durable learnings without granting GitNexus task, mutation, finding, or root-cause authority.

## Non-Goals

- NG1. Do not create a parallel facts pipeline.
- NG2. Do not rebuild `spec-plan`、`spec-code-review`、`spec-debug` graph evidence prose that already exists.
- NG3. Do not add route/API-specific deterministic operations to `review-pre-facts-query-plan.v1`; they belong to workflow-native session evidence when a workflow explicitly needs them.
- NG4. Do not add `cypher` to deterministic query-plan. Explicit session-local `cypher` use remains governed by schema-first read-only rules, query budget and redaction.
- NG5. Do not run provider refresh、`analyze`、repair、`group_sync`、`rename` or any mutation-capable GitNexus operation from ordinary workflow facts extraction.
- NG6. Do not use private project evidence as durable proof unless it is redacted to repo-relative, symbol-level summaries.

---

## Deterministic Helper Selection Criteria

`review-pre-facts-query-plan.v1` 只把 `query`、`context`、`impact`、`detect_changes` 纳入 deterministic bounded query-plan，不是因为其他 GitNexus capability 不重要，而是因为这四项同时满足以下条件：

- **Read-only and non-mutating**: operation 本身不刷新 provider、不修复索引、不改代码、不改 GitNexus workspace state。
- **Per-target classifiable**: helper 可以从 changed path、symbol、stack trace、review scope 或 plan target 推导出 bounded arguments，而不需要脚本做业务/架构判断。
- **Budgetable raw output**: raw result 可以在 single-query cap 和 total artifact cap 内被截断、降级或摘要化，不需要把完整 provider output 注入 prompt。
- **Normalizable evidence shape**: 输出能归一化为 symbol/path/process/impact/source-read candidates，供 LLM 做语义判断，而不是要求 helper 模拟 review 结论。
- **High-frequency workflow fit**: 对 `plan`、`code-review`、`debug` 的上下文质量有直接贡献，且不会把 route/API、workspace 或 mutation 语义扩散进 deterministic helper。

未进入 deterministic helper 的 capability 只是暂不满足 helper 级分类、预算或治理成熟度，不代表不能在 SKILL 中作为 session-local native MCP evidence 被显式调用。

## SKILL ↔ Helper Boundary

- Helper query-plan 只覆盖 `query`、`context`、`impact`、`detect_changes`。
- Route/API/shape/tool/workspace/cypher 等 capability 仍由对应 SKILL 在明确任务场景下做 session-local MCP 调用，并继续遵守 `docs/contracts/graph-evidence-policy.md` 的 advisory evidence 边界。
- 当 workflow 需要 helper query-plan 之外的 GitNexus capability 时，helper rendering 必须显式披露 limitation，例如 `out_of_scope_for_deterministic_helper`，而不是暗示 GitNexus 不可用。
- Helper-owned facts 只负责确定性计划、provenance、normalization、budget、redaction 和 degraded reason；scope authority、finding、root cause、业务优先级仍由 LLM 基于 source/test/log/contract 证据判断。

## Complete Capability Lanes

完整实现不按阶段切分，而按治理 lane 切分：

- **Deterministic helper lane**: `query`、`context`、`impact`、`detect_changes`，由 `review-pre-facts` 生成 exact query-plan，orchestrator 执行后归一化为 bounded facts。
- **Workflow-native session lane**: `route_map`、`api_impact`、`shape_check`、`tool_map`、`cypher`，由 SKILL/LLM 在任务域匹配时显式调用，输出进入 shared evidence envelope，不进入 helper query-plan。
- **Workspace/group resource lane**: `gitnexus://repo/*`、`gitnexus://group/*` resources 与 group-aware `query/context/impact`，用于多仓/monorepo/service context orientation，不自动决定写入 repo 或扩大 scope。
- **Mutation-gated maintenance lane**: `group_sync`、`rename`、provider refresh、repair、clean、`analyze` 等 mutation-capable 或 maintenance operation 永不进入普通 workflow 自动执行，只能由独立 preview-first maintenance/setup/bootstrap 路径处理。

---

## Requirements

### Operation Scope

- R1. `review-pre-facts` bounded query-plan 的 executable GitNexus operation allowlist 仅包含 `query`、`context`、`impact`、`detect_changes`。
- R2. Query-plan entries must keep the existing executable-plan contract: `query_id`、`provider`、`tool_name`、`operation`、`arguments`、`target_refs`、`max_results`、`reason_code`、`fallback_reason_code`。Orchestrator may execute only the declared operation and exact arguments.
- R3. Read-only GitNexus resources such as `gitnexus://repo/{name}/context`、`gitnexus://repo/{name}/processes`、`gitnexus://repo/{name}/process/{name}`、`gitnexus://repo/{name}/schema` may be recorded as resource evidence, but must not be mixed into executable tool query-plan entries.

### Operation Bounds

- R4. `query` defaults: `include_content=false`、bounded `limit`、bounded `max_symbols`、repo scope explicit when multiple repos may exist.
- R5. `context` defaults: prefer `uid` or `name + file_path/kind` disambiguation when available; `include_content=false`; degrade on ambiguous symbol rather than asking the LLM to invent a target.
- R6. `impact` defaults: require explicit `target` and `direction`; use provider `summaryOnly` only when the current executable MCP schema/profile proves support; cap `maxDepth`、`limit`、`timeoutMs`; carry `byDepthCounts` / summary instead of unbounded `byDepth` when output would exceed budget.
- R7. `detect_changes` defaults: workflow must choose `scope` explicitly. PR review uses `compare + base_ref`; local review uses `staged`、`unstaged` or `all` based on user/review scope; linked worktree mismatch requires explicit `worktree` or fallback to direct git diff facts.

### Normalized Result Shape

- R8. Provider results must support operation-specific normalized evidence instead of forcing every result into a source excerpt shape.
- R9. All normalized operation facts must carry common metadata: `provider`、`query_id`、`operation`、`repo_scope`、`target_refs`、`freshness/readiness`、`tier/grade`、`reason_code`、`provenance`、`limitations[]`、`redaction_status`。
- R10. `query` facts may continue using `source_path + line_window/anchor + excerpt` when available.
- R11. `context` facts must preserve symbol identity, disambiguation status, incoming/outgoing relationship summaries, and source paths that require direct read verification.
- R12. `impact` facts must preserve blast-radius summary, risk, affected modules/processes, by-depth counts, and source/test candidates without requiring every item to become an excerpt.
- R13. `detect_changes` facts must preserve changed-symbol scope, compared scope/base/worktree, affected-process summary, and risk summary; raw diff lines must not be copied into durable artifacts.

### Rendering And Workflow Profiles

- R14. Existing `doc-review` / `code-review` rendering remains backward compatible for reviewer pre-facts.
- R15. Add workflow-neutral rendering for `plan` and `debug`; it must describe capabilities, key pointers, source reads required, limitations, and advisory status without Coverage/finding/dispatch wording.
- R16. `plan` and `debug` facts remain inputs to existing Graph / GitNexus Evidence and `graph_evidence` ledger shapes. They do not introduce new durable artifact namespaces.

### Workflow-Native And Resource Evidence

- R16a. Workflow-native GitNexus calls must use a shared evidence envelope with: `capability`、`lane`、`tool_or_resource`、`arguments_or_uri`、`repo_scope`、`task_domain`、`provenance`、`freshness/readiness`、`summary`、`source_reads_required`、`limitations[]`、`redaction_status`。
- R16b. `route_map`、`api_impact`、`shape_check` may be used for API/web/backend tasks and must summarize route/handler/consumer/shape evidence without persisting full private route/process dumps.
- R16c. `tool_map` may be used for MCP/RPC/tool-surface tasks such as setup, skill audit, app consistency audit or tool contract review, and must summarize tool names, handlers and source-read candidates.
- R16d. `cypher` requires schema-first read-only enforcement, bounded query text, result row/byte limits, and redacted summaries. Raw Cypher results must remain session/temp scoped.
- R16e. Repo/group resources and group-aware `query/context/impact` may orient multi-repo work only after explicit `target_repo` or per-task repo scope is known. Group evidence is advisory and cannot expand write scope.
- R16f. `spec-work` consumes graph evidence for source-read/test-focus/risk checks; before editing shared symbols it should prefer session-local `impact` when available, and before closeout/review it should prefer `detect_changes`.
- R16g. `spec-compound` / `spec-compound-refresh` may record only source-confirmed graph-informed lessons; raw provider output never becomes durable knowledge.

### Safety And Governance

- R17. Preserve existing raw artifact total cap、single-query cap、rendered block cap、temp artifact boundary、run-id boundary、path containment、snapshot freshness、untrusted excerpt warning and provenance validation.
- R18. Validate current live MCP tool surface before execution when tool annotations are observable. If read-only / non-destructive status cannot be verified, degrade with `tool_annotation_unverified`.
- R19. Reject or degrade any raw result whose `query_id`、`tool_name`、`operation` or argument provenance does not match the declared query-plan.
- R20. Do not execute provider refresh、`analyze`、repair、`group_sync`、`rename` or mutation-capable operations from this helper.
- R21. Durable outputs must be redacted by default: keep repo-relative paths, symbol-level summaries, reason codes and bounded excerpts; do not persist raw provider stdout/stderr, raw diff hunks, credentialed URLs, tokens, private keys, cookies, internal hostnames, or full private process/route dumps.
- R22. Private repo samples, including hszq-app observations, are session-local validation inspiration only. They may inform fixture design but must not be committed as raw evidence.

---

## Acceptance Examples

- AE1. Given a review of a local diff touching shared helper code, prepare emits a bounded `detect_changes` entry with explicit scope, then an `impact` entry for high-risk changed symbols. Coverage may cite the graph summary, but findings still require diff/source/test/contract confirmation.
- AE2. Given a planning task for a shared symbol refactor, prepare can emit `query -> context -> impact` entries with bounded arguments. The rendered plan facts list source reads required and limitations without reviewer Coverage wording.
- AE3. Given a debug task with a stack-trace symbol, prepare can emit `query/context` facts. A debug hypothesis may cite those facts as `graph_evidence`, but root cause remains unconfirmed until reproduction/source/log/test closes the causal link.
- AE4. Given an `impact` response for a hub symbol, normalizer keeps summary/risk/by-depth counts and omits unbounded by-depth details with a budget reason.
- AE5. Given raw output missing provenance, mismatched operation, mutation-capable tool output, unverified tool annotation, or oversized response, render produces a legal degraded block instead of injecting provider output.
- AE6. Given `detect_changes` raw output containing diff-like or sensitive content, durable output retains only changed-symbol / affected-process summary and redaction status.

---

## Success Criteria

- Unit fixtures cover query-plan generation, raw-result validation, provider-results normalization, render/degrade behavior and budget truncation for all four operations.
- Existing `doc-review` / `code-review` query-only behavior remains backward compatible.
- `plan` and `debug` receive workflow-neutral facts and do not leak reviewer-only trust wording.
- Oversized, mismatched, missing-provenance, mutation-capable and annotation-unverified results fail closed or degrade.
- Durable outputs include `operation`、`repo_scope`、provenance、freshness/readiness、limitations and `redaction_status`.
- No deterministic query-plan invokes route/API-specific operations, `cypher`, provider refresh, repair, group sync or rename.
- Workflow-native evidence summaries exist for route/API/tool/Cypher and workspace/group capabilities, with provenance, source-read requirements, limitations and redaction status.
- `spec-work` and knowledge workflows consume graph evidence as advisory focus only and do not grant GitNexus scope, finding, root-cause or mutation authority.

---

## Implementation Anchors

- `src/cli/helpers/review-pre-facts.js`
  - `runReviewPreFacts()` currently accepts only `doc-review` / `code-review`.
  - `LIMITS.maxFacts` and `LIMITS.renderedBlockChars` currently contain only review workflow budgets.
  - `buildQueryPlan()` currently hardcodes `gitnexus.query`.
  - `normalizeRawFacts()` currently normalizes query-shaped `facts`、`process_symbols`、`definitions`.
  - `validateProviderResults()` currently requires review workflows and excerpt/source-path-centered facts.
  - `buildFactsBlock()` currently renders review-oriented trust wording.
- `docs/contracts/workflows/review-pre-facts-extraction.md`
  - Update only the contract needed for operation profiles, result shape, workflow profiles and redaction.
- `tests/unit/review-pre-facts-helper.test.js` and `tests/fixtures/review-pre-facts/`
  - Add focused fixtures for `query`、`context`、`impact`、`detect_changes`.

---

## Key Decisions

- D1. 需求收敛为 complete Harness integration：helper lane 补 deterministic facts，workflow-native/resource lane 补深能力 evidence envelope。
- D2. Deterministic bounded query-plan 只包含 `query`、`context`、`impact`、`detect_changes`；其他 read-only 能力通过 session/resource lane 使用。
- D3. Existing SKILL prose and downstream graph evidence contracts are the baseline, but complete implementation must wire `spec-work` and knowledge consumers into advisory graph evidence handoff.
- D4. Prefer additive evolution of existing helper safety model; decide in planning whether to implement a neutral core with `review-pre-facts` alias or add workflow profiles inside the current helper.
- D5. Resource evidence and tool evidence stay separate.
- D6. Provider evidence remains advisory until source/test/log/schema/contract confirms the claim.
- D7. Private repo evidence is session-local unless redacted before durable output.

---

## Dependencies / Assumptions

- 依赖现有 `docs/contracts/graph-evidence-policy.md`、`docs/contracts/graph-provider-consumption.md`、`docs/contracts/downstream-graph-evidence-consumption.md`、`docs/contracts/workflows/review-pre-facts-extraction.md`。
- 依赖 GitNexus MCP live tools 在目标 host 中可用；不可用时必须 fallback。
- 依赖 GitNexus MCP tool annotations / current tool surface 可被当前 host 观察；不可观察时按 `tool_annotation_unverified` 降级，不执行 live query-plan。
- hszq-app 实测只能作为 session-local validation inspiration，证明大型私有 repo 中 `context`、`impact`、`detect_changes` 输出需要 bounds 和脱敏；不得提交私有源码、raw provider output 或未脱敏 symbol/process dump。

---

## Outstanding Questions

### Resolved By Complete Implementation Plan

- Q1. Implement as neutral facts core + `review-pre-facts` alias, or as workflow profiles inside the current helper?
- Q2. Preserve `review-pre-facts-provider-results.v1` with additive fields, or introduce v2 for operation-specific result shapes?
- Q3. Should operation selection be produced entirely by deterministic target classification, or should workflow prose pass an explicit operation profile hint into prepare mode?
- Q4. What minimum redaction filter is required before `detect_changes` summaries enter durable plan/review/debug output?
- Q5. Which 1-2 measurement signals should be recorded during rollout: normalized operation coverage, degraded reason distribution, repeated direct-read reduction, or Coverage graph-disclosed surfaces?
