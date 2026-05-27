---
date: 2026-05-27
topic: gitnexus-readiness-capability-semantics
spec_id: 2026-05-27-001-gitnexus-readiness-capability-semantics
---

# GitNexus Readiness Capability Semantics Alignment

## Summary

Lock in the capability semantics model already implemented across `spec-mcp-setup`, `spec-graph-bootstrap`, startup graph snapshots, and downstream GitNexus consumers, and close the remaining surfacing and test-coverage gaps. The goal is to keep the current GitNexus state obvious—what is configured, what is loaded in the current host session, what query/context evidence can support, and what impact/review evidence is unavailable or advisory—and to prevent regressions as downstream workflows continue to evolve.

---

## Problem Frame

Code-side fields and contracts already encode most of the capability semantics this document was originally written to introduce. `provider-status.json` exposes `result_class:"definitions-only"` and a verification reason; `graph-facts.json` carries `freshness_state="dirty-advisory"` and `dirty_classification="graph-affecting-blocked"`; `bootstrap-impact-capabilities.json` records `context_selection`, `impact_radius`, and `review_support` separately; `version-reminder.js` emits a startup snapshot that already includes `capabilities=query/context=full, impact=none, review=none` plus limitations; `spec-mcp-setup`'s success summary separates harness runtime from graph readiness and warns about restart/new session before live MCP tools become visible; `review-pre-facts.js` gates emitted operations on `availableOperations` derived from those artifacts.

What is still uneven is human-facing surfacing and test coverage. `bootstrap-report.md` exposes the provider row and a single limitations sentence, but does not display the `query/context · impact · review` matrix side-by-side; downstream consumers must open the JSON to see the full picture. The unified capability vocabulary is correct in each place but is not collected anywhere as a shared glossary. Anti-regression tests for the user-visible distinctions exist only partially. Because `review-pre-facts` now lets downstream workflows consume `query`, `context`, `impact`, and `detect_changes` facts, any drift in surfacing or gating could re-introduce the over-trust failure mode this work originally targeted.

The remaining improvement is therefore not to invent new GitNexus calls or new capability fields. It is to (a) finish surfacing the existing matrix in human-readable bootstrap output, (b) fix one shared vocabulary across docs/skill prose/contracts so it cannot drift, and (c) add the minimum anti-regression tests so future changes cannot collapse `query_ready=true` back into "all GitNexus capabilities are active".

---

## Actors

- A1. Human operator: runs setup/bootstrap workflows and decides the next workflow based on their reports.
- A2. Orchestrator agent: reads setup/bootstrap/startup facts and routes to plan, work, review, debug, or graph refresh.
- A3. Setup workflow: prepares host runtime, helper tools, and setup-owned GitNexus projections without compiling graph readiness.
- A4. Graph bootstrap workflow: compiles canonical graph/provider/impact readiness artifacts and reports degraded evidence states.
- A5. Downstream workflow consumer: `spec-plan`, `spec-work`, `spec-code-review`, `spec-doc-review`, `spec-debug`, and `review-pre-facts` consumers that use graph evidence as advisory focus.

---

## Key Flows

- F1. Setup handoff clarity
  - **Trigger:** A1 runs `spec-mcp-setup`.
  - **Actors:** A1, A2, A3
  - **Steps:** Setup reports host runtime status, host config status, graph bootstrap status, and whether the current session can use newly configured MCP tools.
  - **Outcome:** A1 and A2 can tell whether to run graph bootstrap, restart/open a new session, or continue to a downstream workflow with degraded evidence.
  - **Covered by:** R1, R3, R4, R8

- F2. Bootstrap capability classification
  - **Trigger:** A1 runs `spec-graph-bootstrap` after setup.
  - **Actors:** A1, A2, A4
  - **Steps:** Bootstrap reports graph readiness, dirty/stale state, evidence class, query/context support, impact/review support, live MCP probe posture, limitations, and artifact paths.
  - **Outcome:** `query_ready=true` is understandable as query/context orientation when definitions-only, not as full impact/review readiness.
  - **Covered by:** R1, R2, R5, R6, R9

- F3. Startup snapshot interpretation
  - **Trigger:** A top-level workflow begins and startup reminder emits a graph snapshot.
  - **Actors:** A2, A5
  - **Steps:** The snapshot summarizes canonical readiness without refreshing artifacts or proving current live MCP exposure.
  - **Outcome:** A downstream workflow can decide whether graph evidence is primary, session-local, advisory, stale, or unavailable before making claims.
  - **Covered by:** R1, R6, R7

- F4. Downstream pre-facts gating
  - **Trigger:** A5 prepares GitNexus-backed pre-facts or graph evidence for a plan/review/debug/workflow handoff.
  - **Actors:** A2, A5
  - **Steps:** The consumer checks capability semantics before using `query`, `context`, `impact`, or `detect_changes` as source-read focus or review evidence.
  - **Outcome:** Definitions-only evidence can focus source reads, but impact/review claims require explicit impact/review capability or direct source/test/contract confirmation.
  - **Covered by:** R2, R7, R10, R11

---

## Requirements

每条需求标注当前实现现实：`[locked-in]` 表示代码已实现，本工作的意图是固化与防回退；`[gap]` 表示存在真实改进点；`[partial]` 表示机制已就位但覆盖或固化不足。详细比对见末尾的"Implementation Reality Snapshot"。

**Shared capability semantics**
- R1. `[partial]` Setup、bootstrap、startup snapshot、下游 contract 已各自使用一致的状态词汇（`host_config_written`、`current_session_loaded`、`graph_compiled`、`query_ready`、`definitions-only`、`result_class`、`impact_radius/review_support` 状态、`dirty-advisory`/`graph-affecting-blocked`、`stale`、`live MCP unavailable`），但这些词汇散落在 README、skill prose、contract、JSON schema、startup snapshot 五处；本工作必须把它们集中到一处共享 vocabulary（contract 或 docs 索引），其他地方引用同一处定义。
- R2. `[locked-in]` `query_ready=true` 不得隐含完整 GitNexus fusion。`provider-status.json` 已含 `result_class:"definitions-only"` 与 `verification_reason`；`graph-provider-consumption.md` 已声明 definitions-only 仅支持 query/context orientation。本工作必须保留并加 anti-regression 测试，防止后续重构丢失这些字段或改写措辞。
- R3. `[locked-in]` Setup-owned availability/discovery 已与 canonical graph readiness 分离（`runtime-capabilities.json.gitnexus_capability_discovery` 显式标注 `setup_inferred availability only; not query-ready graph evidence`）。本工作必须保留这条 boundary 措辞，并在测试中固化。

**Setup output**
- R4. `[locked-in]` `spec-mcp-setup` 成功摘要已分组展示 `Execution result`（harness runtime + graph readiness）、`MCP servers`、`Graph providers`、`Helper tools`、`Project setup facts`。本工作必须保留分组结构与"graph bootstrap is still pending"语义，并加测试覆盖 pending/ready 两种 graph readiness 状态下的 prose 形态。
- R5. `[locked-in]` `skills/spec-mcp-setup/SKILL.md` 当前 `下一步` 第 3 条已说明"重启 Claude Code/Codex 或新开会话只在下游 workflow 依赖新写入的 MCP 配置或 live MCP probe 前需要"。本工作必须保留这条提示，并在测试中固化它在 graph readiness pending 与 ready 路径上都出现。
- R6. `[locked-in]` Setup 已用 "deterministic CLI compilation" 措辞描述 graph bootstrap，且不把 setup 写成"全部能力激活"。本工作必须保留这一措辞，并把它加入 vocabulary glossary。

**Graph bootstrap output**
- R7. `[gap]` `bootstrap-impact-capabilities.json` 已包含 `context_selection · impact_radius · review_support` 三维度的机读 capability matrix，但人类可读的 `bootstrap-report.md` 当前只展示 provider 单行 + 一句 query verification reason，要看 impact/review 状态必须打开 JSON。本工作必须把 `bootstrap-report.md` 增加一段并列展示，让人类操作者一眼看到 query/context、impact、review 三维度的 status / support_level / 限制摘要。该段必须从 `bootstrap-impact-capabilities.json` 派生，不引入新的真相源。
- R8. `[locked-in]` `provider-status.json:170` 已含 `result_class:"definitions-only"` 机读字段；`bootstrap-report.md:18` 已含人类可读的 definitions-only 措辞。本工作必须保留两侧的 definitions-only 字段与措辞，并加 anti-regression 测试。
- R9. `[locked-in]` `graph-facts.json` 已含 `freshness_state="dirty-advisory"` 与 `dirty_classification="graph-affecting-blocked"`；`bootstrap-report.md` overall_status 已显式拼出 `ready-dirty-advisory`。本工作必须保留这一组字段与衍生 prose。
- R10. `[locked-in]` `gitnexus-capability-catalog.md:39-40` 与 `spec-graph-bootstrap/SKILL.md:320-339` 已声明 live MCP probe 为 session-local 且不写入 `.spec-first/graph/*`、`.spec-first/providers/*`、`.spec-first/impact/*`。本工作必须保留 catalog 措辞，并把"session-local 不写 canonical"作为测试断言。

**Downstream consumption**
- R11. `[partial]` `src/cli/helpers/review-pre-facts.js:909-918` 已用 `availableOperations` 门控；契约 `docs/contracts/workflows/review-pre-facts-extraction.md:93` 已声明排除 route_map/api_impact/shape_check 等。但当前没有 fixture 直接覆盖"definitions-only artifact 输入下，review-pre-facts 不发出 impact/detect_changes 操作"。本工作必须为这条路径补 fixture（输入 = 当前 .spec-first/graph 实际状态的精简副本，期望 = query_plan 只含 query/context 操作）。
- R12. `[locked-in]` `downstream-graph-evidence-consumption.md:52-64` 已声明 definitions-only 只支持 source-read focus，impact/finding/root-cause/test-selection 必须经 source/diff/test/contract/session-local 确认；本工作必须保留 non-expansion rule 措辞。
- R13. `[locked-in]` `src/cli/version-reminder.js:213` 已输出 startup snapshot：`query_ready=...; freshness=...; dirty=...; capabilities=query/context=...; impact=...; review=...; limitations=...`。本工作必须保留这条 snapshot 的字段与顺序，并把它加入 vocabulary glossary 与 anti-regression 测试。

**Documentation and verification**
- R14. `[partial]` 各 skill prose、contract、JSON schema 内部 vocabulary 已基本一致（见 R1-R13 标注），但 README.md / README.zh-CN.md 与 CHANGELOG 当前正在修改中，且没有一处单一的 capability vocabulary glossary 让所有 surface 来引用。本工作必须新增或扩展一个集中 glossary（建议在 `docs/contracts/gitnexus-capability-catalog.md` 或新增 `docs/contracts/graph-readiness-vocabulary.md`），并审计 README/CHANGELOG 词汇与之对齐。
- R15. `[gap]` 必须新增或补强如下最小 user-visible 测试断言，每条对应一个具体 fixture：
  - R15a. `provider-status.json` 反序列化必须保留 `result_class:"definitions-only"` 与 `verification_reason`，且 `availableOperations` 派生只含 query/context。
  - R15b. `bootstrap-report.md` 的人类 prose 在 definitions-only 输入下必须同时出现 query/context、impact、review 三维度的 status 行（覆盖 R7 新增 surfacing）。
  - R15c. `version-reminder.js` 的 startup snapshot 在 `(query_ready=true, definitions-only)` 输入下必须输出固定格式的 `capabilities=query/context=full, impact=none, review=none` 与对应 limitations。
  - R15d. `review-pre-facts.js` 在 definitions-only `availableOperations` 输入下不得 emit `impact` 或 `detect_changes` 操作（fixture 锁定 query_plan 形态）。
  - R15e. Setup 成功摘要在 `graph_ready=pending` 与 `graph_ready=ready` 两种路径下都必须包含 restart/new session 提示与 deterministic compilation 措辞。
  - R15f. Live MCP probe 调用路径不得修改 `.spec-first/graph/*`、`.spec-first/providers/*`、`.spec-first/impact/*` 中任何 canonical artifact（fixture 通过比较 before/after hash 确认）。

---

## Acceptance Examples

- AE1. **Covers R1, R4, R5.** Given setup has just configured GitNexus for a host, when setup completes, the output says the harness runtime is ready, graph readiness is pending or ready, and whether the current session may need restart/new session before live MCP tools are available.
- AE2. **Covers R2, R7, R8.** Given graph bootstrap returns definitions-only query evidence, when the final report is shown, it says query/context orientation is ready but process graph, impact, related tests, and review-impact evidence are unavailable.
- AE3. **Covers R7, R9.** Given graph bootstrap runs with graph-affecting dirty files, when readiness is reported, the output marks the state as dirty-advisory and avoids calling it clean primary graph evidence.
- AE4. **Covers R10, R13.** Given startup or bootstrap can see canonical graph artifacts but not current live MCP tools, when reporting capability state, it marks live MCP as unavailable/not loaded without changing canonical readiness.
- AE5. **Covers R11, R12.** Given pre-facts wants to emit impact or detect-changes evidence but bootstrap artifacts only expose definitions-only query/context readiness, when the downstream consumer prepares evidence, it degrades or limits impact/review use and records source-read confirmation requirements.
- AE6. **Covers R14, R15.** Given a user reads README and then runs setup/bootstrap, the same capability terms appear in docs, workflow output, and tests, so "ready" cannot be mistaken for "all GitNexus capabilities active".

---

## Success Criteria

- A human operator can answer from the final setup/bootstrap output: "Can I use GitNexus for query/context only, or also for impact/review evidence?"
- A downstream agent can choose graph, session-local MCP, or bounded direct reads without inventing the meaning of `query_ready`, definitions-only, dirty-advisory, or live MCP unavailable.
- `review-pre-facts` and workflow prose no longer imply `impact` / `detect_changes` are primary-ready solely because `query_ready=true`.
- Documentation and tests reinforce the same source/runtime/evidence boundary instead of creating parallel terms.

---

## Scope Boundaries

- Do not make `spec-mcp-setup` run GitNexus analyze, query, build, index, repair, group sync, or graph refresh commands.
- Do not write live MCP probe results into canonical `.spec-first/graph/*`, `.spec-first/providers/*`, or `.spec-first/impact/*` readiness artifacts.
- Do not claim GitNexus decides implementation scope, review findings, root cause, task ordering, or mutation permission.
- Do not promote `route_map`, `api_impact`, `shape_check`, `tool_map`, `cypher`, group resources, `group_sync`, or `rename` into the deterministic pre-facts query-plan.
- Do not require this work to fix GitNexus provider internals or make process graph / impact evidence available where the provider currently returns definitions-only.
- Do not hand-edit generated runtime mirrors to force behavior; source changes must flow through source-owned skills, scripts, docs, tests, and runtime generation when needed.

---

## Key Decisions

- Treat this as a semantics alignment problem, not a provider feature expansion: the immediate value is preventing over-trust and improving downstream evidence quality.
- Keep setup, bootstrap, startup snapshot, and downstream consumption as separate lanes: each owns different facts and must not overwrite another lane's authority.
- Use definitions-only as a useful but limited state: it can support query/context orientation, but not impact/review claims without additional confirmation.
- Prefer a compact capability matrix over verbose prose in final outputs: it makes the distinction between query/context and impact/review visible at decision time.
- Capability matrix 的真相源已确定：复用 `.spec-first/impact/bootstrap-impact-capabilities.json` 的 `context_selection · impact_radius · review_support` 三维度结构，不新增 schema 字段；本工作只在 `bootstrap-report.md` 与 vocabulary glossary 增加 surfacing/引用。
- 实现已基本就位（R2/R3/R4/R5/R6/R8/R9/R10/R12/R13），本工作的主体是 surfacing（R7）、glossary 集中（R1/R14）与 anti-regression 测试（R15），不重做已落地的 contract 与 prose。

---

## Dependencies / Assumptions

- Existing graph evidence contracts already define GitNexus as Context / Evidence Harness input rather than scope authority.
- Current bootstrap artifacts can represent definitions-only and impact/review limitations; planning should verify whether existing fields are sufficient before adding new schema.
- Host sessions may not immediately load newly written MCP config, so current-session availability must remain separate from persisted host config readiness.
- Current worktree state can be dirty during bootstrap; dirty-advisory remains valid as explicit advisory evidence, not clean primary proof.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R1, R14][Documentation] Vocabulary glossary 应该新增独立 `docs/contracts/graph-readiness-vocabulary.md`，还是扩展现有的 `docs/contracts/gitnexus-capability-catalog.md`？两种选择对下游引用与目录治理的影响需要在 plan 中权衡。
- [Affects R11, R15d][Technical] `review-pre-facts.js` 的 `availableOperations` 门控当前是隐式（按 artifact 字段派生）。是否需要在 helper 层显式拒绝 definitions-only 输入下的 impact/detect_changes 操作（fail-loud），还是保持隐式 + fixture 测试覆盖即可？
- [Affects R15][Testing] R15a-R15f 的六条最小 test surface 应分别归属：`tests/unit/review-pre-facts-helper.test.js`、`tests/unit/spec-graph-bootstrap-contracts.test.js`、`tests/unit/version-reminder.sh`/`*.test.js` 等既有 suite，还是为 capability semantics 新建一个聚合 suite？需要在 plan 中决定，避免测试散落不易回归审计。

---

## Implementation Reality Snapshot

本节记录 2026-05-27 的代码事实比对结果，作为 plan 阶段的输入证据。修改 source 时若发现下列引用过时，应同步更新本节或迁移到 plan/solution 文档。

| 需求 | 状态 | 关键证据 |
| --- | --- | --- |
| R1 共享 vocabulary | partial | 各处词汇一致，但未集中 glossary |
| R2 query_ready ≠ full fusion | locked-in | `provider-status.json:170` `result_class:"definitions-only"` + `docs/contracts/graph-provider-consumption.md:83-86` |
| R3 setup vs canonical 分离 | locked-in | `runtime-capabilities.json` `gitnexus_capability_discovery` 显式 `setup_inferred availability only` |
| R4 setup 三段式输出 | locked-in | `skills/spec-mcp-setup/SKILL.md:549-589` Execution result + Graph providers + 下一步 |
| R5 restart/new session 提示 | locked-in | `skills/spec-mcp-setup/SKILL.md:589` 第 3 条 |
| R6 deterministic compilation 措辞 | locked-in | `skills/spec-mcp-setup/SKILL.md:544` "deterministic CLI compilation" |
| R7 bootstrap-report 三维度并列 | gap | `.spec-first/graph/bootstrap-report.md:16-18` 仅 provider 单行；matrix 在 `.spec-first/impact/bootstrap-impact-capabilities.json` |
| R8 definitions-only 显式分类 | locked-in | `provider-status.json:170` + `bootstrap-report.md:18` |
| R9 dirty-advisory 措辞 | locked-in | `graph-facts.json freshness_state="dirty-advisory"` + `dirty_classification="graph-affecting-blocked"` |
| R10 live MCP session-local | locked-in | `docs/contracts/gitnexus-capability-catalog.md:39-40` + `spec-graph-bootstrap/SKILL.md:320-339` |
| R11 downstream gating | partial | `src/cli/helpers/review-pre-facts.js:909-918` 已门控；缺 fixture |
| R12 non-expansion rule | locked-in | `docs/contracts/downstream-graph-evidence-consumption.md:52-64` |
| R13 startup snapshot | locked-in | `src/cli/version-reminder.js:213` 已输出 capabilities + limitations |
| R14 vocabulary 一致 | partial | skill/contract 一致；README/CHANGELOG 与 glossary 待对齐 |
| R15 anti-regression 测试 | gap | R15a-R15f 待在 plan 中分配到具体 suite |

合计：locked-in 10 项、partial 3 项、gap 2 项。本工作的有效新增工作量主要落在 R7 surfacing、R1/R14 glossary、R15a-R15f 测试，以及把 R11 从 partial 升级到 locked-in 的最小 fixture。
