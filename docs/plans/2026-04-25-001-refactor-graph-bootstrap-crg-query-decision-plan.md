---
title: "refactor: 将 spec-graph-bootstrap 收缩为 CRG 图索引 + 按需查询 + LLM 决策"
type: refactor
status: completed
date: 2026-04-25
---

# refactor: 将 spec-graph-bootstrap 收缩为 CRG 图索引 + 按需查询 + LLM 决策

## Overview

当前 `spec-graph-bootstrap` 已经具备 CRG AST 图、`impact`、`review-context`、`affected-flows`、`risk-signals` 与测试面线索，但 workflow 主链仍以“生成项目上下文文档包”为中心。这个定位对 onboarding 有价值，却不是用户真正想要的核心能力。

本方案将 `spec-graph-bootstrap` 的主目标重构为：

```text
CRG 图索引初始化
  -> 按需查询候选修改点与影响面
  -> LLM 基于证据做工程决策
```

重构不是要让脚本替 LLM 判断“该改哪里”，而是让脚本提供更稳定、更低噪音、更贴近任务的代码事实输入。最终目标是让 `spec-plan`、`spec-write-tasks`、`spec-work`、`spec-code-review` 在有 CRG 图索引时优先消费按需查询结果或派生索引，同时让旧 Stage-0 docs/runtime 不再作为默认事实入口；现有 workflow 的 local repo reads / diff reads 仍保留为 direct-read fallback。

## Product Decision Basis

本轮默认入口优化对象是正在执行 `plan / work / review` 的 agentic engineering workflow，而不是首次 onboarding 或一次性项目介绍。判断依据不是“文档没有价值”，而是当前 Stage-0 docs 主链在 bootstrap/runtime contract 上承担了错误职责：它把静态说明书设计成可注入的事实路径，使系统边界容易退回过期摘要，而不是按当前任务查询最新代码图。这里说的“默认事实路径”指 `spec-graph-bootstrap` 与 Stage-0 runtime 产物的契约面，不表示当前 `spec-plan` / `spec-work` / `spec-code-review` source skill 已经显式读取 `stage0-context`。

因此产品取舍是：

- **默认优化对象：** 已在仓库中执行需求规划、代码修改、影响面判断和代码评审的开发者 / agent。
- **默认成功标准：** 更快获得候选修改面、blast radius、affected flows、candidate tests 和 limitations。
- **非默认但保留的对象：** 首次 onboarding、项目介绍、人类审计阅读；这些需求由显式 `--report` projection 承接，不再占用默认事实链路。
- **不选择轻量 docs 默认入口的原因：** 即使 docs 变轻，只要它仍是默认 workflow 输入，就会继续形成第二事实层；query-first 直接把代码事实和 LLM 语义判断重新分边界。

Concrete signals:

- 最近几轮方案修订反复把 `docs/contexts`、`minimal-context`、`context-routing` 和 `injection-index.yaml` 从默认事实路径中移除，说明 Stage-0 docs 主链已经在架构判断中成为第二真相源风险，而不是稳定输入。
- 评审和修复焦点持续集中在 `review-context`、blast radius、affected flows、candidate tests、direct-read fallback、`decision_input_kind` 与 `evidence[]`，而不是“生成更多 markdown 摘要”。
- 当前旧主链需要 slug、workspace fan-out、PRD task contracts、docs generation、backup/restore、routing、selected assets 和 minimal-context 才能进入默认 workflow；这与用户“定位修改点 / 影响面”的高频任务路径不成比例。
- `src/crg/` 已经具备 AST 图、SQLite 存储、`impact`、`review-context`、flows、communities、affected-flows 等底座；默认入口切到 query-first 是把已有代码事实能力放到用户实际决策点，而不是新增一个平行文档产品。
- onboarding 和人类审计仍有价值，但它们的使用频率和时机更接近显式报告需求；用 `--report` 承接可以保留价值，同时避免默认 workflow 读取 stale projection。

## Planning Anchor

- **Restated Understanding：** 用户希望 `skills/spec-graph-bootstrap` 能通过源码 AST 索引快速理解项目、定位潜在修改点，并在修改后估算影响范围和爆炸半径。
- **Current Core Goal：** 把 `spec-graph-bootstrap` 从“文档生成主链”重构为“CRG 图索引控制台 + 查询入口契约”，让后续 workflow 直接使用图事实作为 LLM 决策输入。
- **Scope / Non-goals：** 本方案只规划架构、contract、CLI/query、workflow 消费方式与 cutover 路径；不在本文档中实现代码，不新增强状态机，不把 docs 产物作为事实真源。
- **Verification-as-Done：** 完成后应能证明：默认 bootstrap 路径更轻；`graph.db` 是代码事实真源；新任务能通过查询获得候选修改面；已有 diff 能通过 `review-context` 得到 blast radius、affected flows、候选测试与验证建议；静态 docs 退为可选投影。

## Problem Frame

当前系统有两个方向拉扯：

1. **CRG 数据底座方向**：`src/crg/` 已经在构建代码图、执行流、社区、影响面、测试候选与变更上下文。
2. **Stage-0 文档包方向**：`skills/spec-graph-bootstrap/SKILL.md` 仍按 Phase 0-4 生成 `docs/contexts/<slug>/` 的固定 markdown 产物，并通过 `injection-index.yaml` 注入后续 workflow。

这导致三个实际问题：

- **主链过重：** 为了获得代码索引能力，用户需要经过 slug、workspace fan-out、PRD task contracts、文档生成、backup/restore、routing 等大量流程。
- **消费契约错位：** 当前 `spec-plan` / `spec-work` / `spec-code-review` source skill 主要依赖自身 local research、plan/diff/source reads，并没有显式消费 `stage0-context`；但 `spec-graph-bootstrap` 仍生产 Stage-0 注入产物和 `stage0-context` runtime 面，导致事实层契约与高频 workflow 实际需求错位。C1 要新增薄 CRG hook anchor 并删除 legacy Stage-0 默认面，而不是假装替换一个已经存在的 source-skill Stage-0 默认读取。
- **职责边界模糊：** bootstrap 同时承担索引初始化、项目知识总结、文档生成、路由治理、workspace 协调，导致它很难围绕“快速定位修改点与影响面”优化。

从 `docs/10-prompt/项目角色.md` 的判断基线看，当前偏差本质是：确定性事实准备和语义决策之间的边界没有足够清晰。正确方向不是把 bootstrap 继续扩成更完整的文档状态机，而是把它收缩成更强的事实输入层。

## Current Flow Snapshot

当前主链近似如下：

```text
$spec-graph-bootstrap
  |
  v
Phase 0 readiness / slug / topology / manifest
  |
  +-- workspace_multi_repo
  |     |
  |     v
  |   每个 child repo 跑完整 Phase 1-4
  |     |
  |     v
  |   workspace registry / routing / docs
  |
  +-- single_repo / monorepo
        |
        v
      Phase 1 事实抽取
        |
        v
      Phase 2 PRD task contracts
        |
        v
      Phase 3 docs/contexts 文档生成
        |
        v
      Phase 4 injection-index 路由生成
```

这条链路里，真正服务“修改定位 / blast radius”的核心路径只有：

```text
spec-first crg build
  |
  v
.spec-first/graph/graph.db
  |
  +-- crg search
  +-- crg context
  +-- crg impact
  +-- crg review-context
  +-- crg affected-flows
  +-- crg flows / communities
```

## Target Architecture

目标架构把系统拆成三层：

```text
+--------------------------------------------------+
| LLM Decision Layer                               |
|                                                  |
| - 理解用户需求                                  |
| - 判断候选修改点是否真实相关                    |
| - 判断 blast radius 是否需要扩大实现/验证范围    |
| - 制定 plan / work / review 决策                 |
+--------------------------^-----------------------+
                           |
                           | evidence-rich query results
                           |
+--------------------------+-----------------------+
| Query Layer                                      |
|                                                  |
| - locate                                         |
| - path                                           |
| - explain                                        |
| - impact                                         |
| - review-context                                 |
| - affected-flows                                 |
| - test-suggestions                               |
+--------------------------^-----------------------+
                           |
                           | deterministic graph facts
                           |
+--------------------------+-----------------------+
| CRG Index Layer                                  |
|                                                  |
| - AST parse                                      |
| - nodes / edges                                  |
| - imports / calls                                |
| - flows / flow_nodes                             |
| - communities                                    |
| - tests / file fingerprints                      |
+--------------------------^-----------------------+
                           |
                           | source files
                           |
                     Repo working tree
```

Terminology:

- `crg context`：现有图 overview/map 查询，提供 top hubs、flows、communities 等低 token 概览。
- `crg workflow-context`：CRG hook 内部使用的 stage envelope，按 `plan|work|review` stage 裁剪 `graph-index-status`、`code-navigation` 与推荐 query；skill 默认 anchor 指向 `crg hook ...`，不直接锚定裸 `workflow-context`。
- `locate/path/explain`：任务级按需查询，分别解决候选定位、关系路径、局部解释。
- `code-navigation.json`：持久化 dashboard，不是 workflow 上下文包。
- `module-context` 不作为 MVP 命令；若未来需要，只能作为 `explain/community` 的薄别名或后续扩展。

核心原则：

- `graph.db` 是代码事实真源。
- `graph-index-status.json` 只表达图索引健康状态。
- `code-navigation.json` 是 CRG 的轻量 index / dashboard，供 LLM 首先导航下一步 query；它不替代 `graph.db`。
- `graph-report.md` 是可选人类可读投影，不参与核心事实判定；旧 `docs/contexts/<slug>/` 文档包不再默认生成。
- `graph-operations.jsonl` 只记录图操作历史，帮助解释状态变化；它不是新的事实真源。
- LLM 只能基于脚本事实做语义决策，不能假装自己执行了 AST/graph 确定性分析。

## CRG Operating Loop

借鉴 LLM Wiki 的 `ingest / query / lint` 操作闭环，本方案把 CRG 的长期心智收敛为三类动作：

```text
build
  -> ingest source code into deterministic graph facts

query
  -> retrieve task-specific change / impact / path evidence

lint
  -> inspect graph health, capability drift, index drift, and fallback honesty
```

对应到 spec-first：

| Loop | CRG surface | Script responsibility | LLM responsibility |
| --- | --- | --- | --- |
| build | `crg build`, `graph-index-status.json`, `code-navigation.json` | 解析源码、更新 graph、写状态与导航 index | 判断图状态是否足以支撑当前任务 |
| query | `workflow-context`, `locate`, `path`, `explain`, `impact`, `review-context` | 返回候选、路径、邻居、影响面、证据和限制 | 选择修改点、解释取舍、决定验证范围 |
| lint | `spec-first doctor` graph section, graph lint findings, `graph-operations.jsonl` | 检查结构健康、能力漂移、fallback 诚实性 | 决定是否继续、重建、降级或修复 |

这只是操作心智，不引入新状态机。脚本仍只准备事实和健康信号，LLM 负责工程意义判断。

## Graphify Reference Synthesis

本方案更新时参考了 `graphify` 项目的架构和 workflow 设计。Graphify 的核心启发不是“多模态知识图谱”本身，而是它把 graph 设计成 agent 的导航层，而不是一次性文档包：

```text
detect()
  -> extract()
  -> build_graph()
  -> cluster()
  -> analyze()
  -> report()
  -> export()
```

Graphify 的关键产品心智是：

```text
Map first, query precisely.
```

对应到 spec-first：

```text
code-navigation.json / graph-report.md
  -> 给 LLM 一张低 token 的项目地图

crg locate / path / explain / impact / review-context
  -> 让 LLM 针对具体任务精确查图

LLM
  -> 基于证据做最终工程判断
```

### 可直接借鉴的设计

- **Map + Query 双层消费模型**：Graphify 用 `GRAPH_REPORT.md` 做 overview map，用 `query/path/explain` 做精确图查询。spec-first 应采用 `code-navigation.json` + optional `graph-report.md` 作为 map，用 CRG CLI query 作为精确导航。
- **Always-on reminder，而不是 hard gate**：Graphify 通过 `AGENTS.md` / hook 提醒 agent 在架构问题前先看 graph map。spec-first 应把 graph-ready 变成 workflow 优先输入，而不是阻塞用户的强 gate。
- **三类查询语义**：`query` 从问题出发拉局部子图，`path` 解释两个节点之间怎么连，`explain` 解释单个节点的 source、community、neighbors、degree。spec-first 当前方案已有 `locate / impact / review-context`，还应补 `path / explain`。
- **清晰置信度标签**：Graphify 使用 `EXTRACTED / INFERRED / AMBIGUOUS`。spec-first 应在 CRG query 输出中统一压成 `observed / inferred / ambiguous`，避免 LLM 把候选事实误读成最终结论。
- **输入检测与增量缓存**：Graphify 先 `detect` 文件类型、敏感文件、规模风险，再决定提取策略。spec-first 应补 `crg detect-inputs` 或同等内部能力，先区分 code/test/generated/config/docs/sensitive，再决定是否全量建图、局部建图或提示 child-first。
- **shrink guard / last-known-good**：Graphify 拒绝用明显更小的 graph 覆盖已有 `graph.json`，防止 partial chunk 覆盖完整图。spec-first CRG build 应采用同类保护：rebuild 后 node/edge 数异常收缩时，不静默覆盖 last-known-good。
- **分析不止 top hubs**：Graphify 输出 god nodes、surprising connections、knowledge gaps、suggested questions。spec-first 的 `code-navigation.json` 应补 `surprising_connections`、`thin_communities`、`ambiguous_edges`、`suggested_queries`。
- **查询面保持 CLI / hook**：spec-first 本方案不引入新的 host-level 查询服务；精确查询面收口到 `spec-first crg ...` CLI 与显式 lifecycle hook，避免新增 host 依赖和第二套工具契约。

### 不应照搬的设计

- 不把 Graphify 的多模态 semantic extraction 放入默认 CRG 主链。spec-first 的代码修改效率依赖 deterministic AST/graph facts，LLM semantic extraction 只能作为可选知识层。
- 不把 `graphify-out/` 可提交模式照搬为 `.spec-first/graph/` 默认提交。CRG SQLite graph 应继续作为本地生成事实底座，必要时通过 CI artifact 或轻量 report 分享。
- 不用 NetworkX JSON 替代 SQLite。Graphify 的 `graph.json` 适合便携查询，spec-first 的 CRG 需要 SQLite 支撑 diff、BFS、FTS 和高频 CLI 查询。

## code-review-graph Reference Synthesis

本方案也参考 code-review-graph reference project。它的价值不是工具外壳，而是把 code graph 做成可度量、可查询、可分层降噪的 review input engine：

- **diff hunk → changed nodes:** 先解析 `git diff --unified=0`，再用 node `line_start` / `line_end` overlap 映射真实修改节点。spec-first 的 `review-context.changed_nodes` 应采用同样口径；全文件节点只能作为 `changed_file_nodes` 或 fallback/context，不应混作真实 hunk 命中。
- **SQLite recursive CTE impact:** impact radius 默认在 SQLite 内用 recursive CTE 扩展，而不是在 JS 内存中构造全图 BFS。spec-first 的 `impact` 与 `review-context.graph_expansion` 应优先采用 SQLite CTE，并输出 `max_depth`、`truncated`、`total_impacted`、`returned_count`。
- **detail profile:** 所有工具先返回 compact/minimal 输出，只有 LLM 需要具体证据时再升级到 standard。spec-first 不恢复旧 `minimal-context`，但 CRG query / hook envelope 可以支持 `--detail=minimal|standard` 或等价 `detail_profile`。
- **postprocess 分层:** core graph build 与 signatures / FTS / flows / communities 等 derived signals 分开；derived failure 写 warnings/limitations，不丢 primary graph。spec-first C1 应允许 flows/communities 降级，并通过 capability/limitation 告诉 LLM。
- **评价指标:** 不能只证明命令能跑。C1 acceptance 应记录 `query_hit_rate`、`impact_recall`、`context_token_ratio`；C1 硬门槛优先保证关键候选不漏和 limitations 诚实，precision 可以后续优化。
- **FTS + boost locate:** `locate` 可借鉴 FTS5 + keyword fallback + kind/context boost：exact path/symbol > FTS name > retrieval_text；changed files、candidate tests、risk paths 可加权。embedding / semantic rerank 只能作为 C3/C4 增强，不进 C1。

不借鉴的部分：

- 不新增 host-level query server。spec-first 查询面继续 CLI-first，workflow 通过显式 hook 消费。
- 不采用自动 watch / file-save hooks。CRG lifecycle hooks 必须是显式 workflow anchor，不做全局隐式 AOP。
- 不采用 wiki / memory loop 把 query 结果沉淀为 runtime markdown。长期知识仍由 `spec-compound` 系列治理，CRG report 只能是显式人类审计投影。
- 不采用 in-memory session hints 作为决策依据。可以保留 stateless `recommended_queries`，但不引入会话状态机。

## LLM Wiki Reference Synthesis

本方案也参考了 `Karpathy-llm-wiki-bootstrap-skill` 的底层模式。它的价值不是 Markdown wiki 形式本身，而是三个长期维护机制：

- **Source-of-truth separation:** `raw/` 不可变，`wiki/` 可维护。映射到 CRG：repo working tree 是原始事实，`graph.db` 是确定性派生事实，`code-navigation.json` / `graph-report.md` 只是 projection。
- **Single contract + thin pointers:** `SCHEMA.md` 是唯一操作契约，`AGENTS.md` / `CLAUDE.md` 只是指针。映射到 spec-first：source skill 和 schema 是唯一可编辑真源，runtime mirror / installed anchors 只能是生成投影。
- **Index + log navigation:** `index.md` 帮 LLM 找内容，`log.md` 提供操作历史。映射到 CRG：`code-navigation.json` 是图导航 index，`graph-operations.jsonl` 是 append-only 图操作历史。
- **Ingest / query / lint loop:** wiki 通过 ingest、query、lint 保持活性。映射到 CRG：build、query、`spec-first doctor` graph section 三段闭环。

不照搬的部分：

- 不把 CRG 变成 Markdown wiki；CRG 的核心产物仍是 SQLite graph 和结构化 query。
- 不把 query 后的每个发现自动写成文档；可复用经验应交给 `spec-compound`，而不是让 graph bootstrap 重建 Stage-0 docs。
- 不照搬 blocking interactive bootstrap；代码索引应默认 non-interactive，只有 report mode 或 workspace ambiguity 才需要用户确认。

## Requirements Trace

- R1. `spec-graph-bootstrap` 默认主链必须以 CRG 图索引 ready 为完成目标，而不是以生成完整 `docs/contexts` 为完成目标。
- R2. `graph.db` 必须被定义为代码事实真源；所有摘要型产物都只能是 projection 或 dashboard。
- R3. bootstrap 完成后必须提供最小 machine-readable 状态产物，说明图索引是否可用、是否 stale、可用查询能力是什么。
- R4. `crg review-context` 必须成为已有 diff 的主影响面入口，输出 changed nodes、graph expansion、affected flows、candidate tests、risk summary 与 recommended verifications。
- R5. `crg impact` 必须从单点 blast radius 扩展为 LLM 可消费的压缩影响面，至少聚合 impacted modules、affected flows 与 candidate tests。
- R6. 新任务规划必须有任务定位查询路径，脚本只返回候选 symbol/file/module/flow 与证据，不做最终语义判断。
- R7. Cutover 完成态下，`spec-plan`、`spec-work`、`spec-work-beta`、`spec-code-review` 必须全部通过显式 lifecycle hooks 消费 CRG workflow context 与按需查询结果；`spec-write-tasks` 作为可选派生层必须保留 plan 作为唯一真相源，并让 task pack 被 `spec-work` 消费时仍回到同一 `before-work` hook；不得再以 `stage0-context` / `context-routing` 作为任何默认 runtime 入口。
- R8. docs 生成、workspace fan-out、backup/restore、injection-index 文档路由必须从默认主链删除；可选人类文档只允许通过显式 report mode 生成，不作为 fallback 事实层。
- R9. 所有新增 contract 必须保持 light contract，不引入中心化 gate、强状态机或规则引擎。
- R10. 本方案不做向下兼容。实现可以在同一分支内按依赖顺序施工，但对外合并必须是原子 cutover：新增 CRG hook / query 入口、切换真实消费者、删除旧 Stage-0 runtime 同时完成；删除对象包括 `stage0-context` CLI、`context-routing` 运行时选择链、`minimal-context`、`docs/contexts` 默认生成和 `injection-index.yaml` 默认生成。
- R11. CRG query 输出必须统一暴露 `observed / inferred / ambiguous` 语义，并附带 `evidence[]` 与 `limitations[]`。
- R12. 方案必须补齐 `path` 与 `explain` 两类查询：前者解释两个 symbol/module 的连接路径，后者解释单个 symbol/module 的局部上下文。
- R13. Cutover MVP 必须具备 status honesty、最小 freshness 与最小安全过滤；完整输入检测可后续增强，但 fallback suggested reads 不能泄露 sensitive / generated / self-output / runtime mirror 路径。
- R14. Cutover MVP 必须具备最小 shrink guard / last-known-good 保护：复用现有 generation pointer，异常 partial rebuild 不得静默 promote；C2 再补完整 input detection、显式 prune intent 与更细健康规则。
- R15. `code-navigation.json` 的 cutover MVP 可以先输出最小 dashboard；后续必须补 surprise/gap/question 类导航信号，帮助 LLM 主动提出高价值后续查询。
- R16. CRG 主链必须提供轻量 append-only 图操作历史，用于解释 build/promote/degrade/fallback 发生了什么；该历史只是审计日志，不作为代码事实真源。
- R17. `spec-first doctor` 的 graph section 必须作为 graph lint/report 输出结构健康 findings，不得演化为中心化 hard gate，也不得扩张成新的多级 graph 子命令。
- R18. workflow 集成必须采用显式 lifecycle hooks：skill 拥有 hook point，CRG 提供 hook handler 与统一 envelope，LLM 拥有最终决策；禁止全局隐式 AOP、自动 prompt 改写、hook rules engine 或 hook 失败阻塞 workflow。
- R19. CRG control-plane artifact 必须锚定在 `.spec-first/graph/`，与 active graph pointer 同域管理；bootstrap slug 目录只能保存可选投影或运行记录，不能成为 plan/work/review hook 查找图状态的必需条件。
- R20. CRG query CLI 必须沿用现有 `crg-cli/v1` envelope；`locate/path/explain/impact/review-context` 的具体 payload 放入 `data`，避免为新查询创建第二套 CLI 输出协议。
- R21. diff base 必须由共享 deterministic resolver 处理：优先显式 `--since`，其次 `--work-run` 持久 handoff 中的 `work_start_ref`，再次 workflow 显式传入的 `work_start_ref`，最后按当前 `spec-code-review` base 解析策略推导 merge-base；无法解析时返回 direct-read fallback，不直接失败。
- R22. planned change surface 必须以机器可读 handoff 交给 `before-work`：`spec-plan` 输出唯一 sentinel JSON block，或调用方显式传入 `--planned-surface` sidecar JSON；task pack 只能通过 `source_plan` / `source_plan_hash` 引用 plan handoff，不能复制或改写 planned surface 成第二真相源；hook 只解析结构化 surface，不从 markdown prose 推断语义。
- R23. C1 必须同步迁移 AI Dev Quality Gate、branch protection policy、`run-ai-dev-quality-gate` 和 verification-gate integration；任何仍保护 `src/context-routing/**` 或 `stage0-context` 作为现行默认 runtime 的治理入口，都视为 cutover 未完成。

## Feasibility and Expected Impact

### 可行性判断

整体可行性：**方向高，C1 实施风险中高**。

```text
架构方向可行性：高
工程落地可行性：中等偏高风险
短期收益确定性：中高
长期系统收益：高
过度设计风险：中，需要通过原子 cutover、内部门禁和延后增强项控制
```

判断依据：

- `src/crg/` 已经存在 AST 图、SQLite 存储、`impact`、`review-context`、`flows`、`communities`、`affected-flows` 等底座。
- 当前方案不是重建 GraphRAG 平台，而是把已有 CRG 能力从“bootstrap 文档生成附属品”提升为 workflow 默认决策输入。
- 当前 `skills/spec-plan/SKILL.md`、`skills/spec-work/SKILL.md`、`skills/spec-code-review/SKILL.md` 没有显式消费 `stage0-context`；因此 C1 的真实工作是新增低侵入 CRG hook anchor、迁移 plugin/help/governance 入口并删除旧 Stage-0 runtime 面，而不是替换一个已经存在的 source-skill Stage-0 调用点。
- Graphify、GraphRAG、Neo4j GraphRAG、LlamaIndex KG-RAG 的共同模式都是 `index -> query -> answer/decision`，当前方案与这个架构方向一致。
- 最大工程风险不在算法从零实现，而在 Stage-0 runtime 原子删除、workflow anchor 一次性切换、query 输出质量控制和 fallback 诚实性。

### 预期效果

`spec-plan`：

```text
Before:
  读任务描述和本地源码
  必要时人工/LLM 自行 rg 或打开文件
  Stage-0 docs 只作为 legacy bootstrap 产物存在，不是当前 source skill 的显式默认调用

After:
  crg locate 找候选 symbol/file/module
  crg explain 理解候选点局部结构
  crg path 解释模块关系
  LLM 写出带 evidence 的 candidate change surface
```

预期收益：计划更具体，减少“先看看 X 附近”这类低价值表述。

`spec-work`：

```text
Before:
  按计划改代码
  通过 plan / source reads / diff 自行判断影响面
  测试选择主要依赖人工/LLM 经验

After:
  实现前用 impact/path 校准允许改动面
  实现后用 review-context 比较实际 blast radius
```

预期收益：更早发现局部改动扩大成核心调用链影响，减少漏测。

`spec-code-review`：

```text
Before:
  主要读 diff、相关源码和评审上下文
  没有 graph-native blast radius 默认入口

After:
  review-context 输出 hunk hit nodes / graph expansion / affected flows / candidate tests
  reviewer 按影响面排序审查
```

预期收益：review 从“逐文件看 diff”升级为“按风险和影响面看 diff”。

### 受影响 Skill 与行为变化

| Skill / surface | 当前行为 | 新行为 | 提升 |
| --- | --- | --- | --- |
| `spec-graph-bootstrap` | 默认生成 Stage-0 docs/runtime 包 | 默认构建 CRG 图索引、写 `graph-index-status.json` / `code-navigation.json` / `graph-operations.jsonl`，report 只显式生成 | bootstrap 从“产文档”转为“提供低噪音代码事实入口” |
| `spec-plan` | 主要按任务、需求文档和本地源码做 local research；当前 source skill 不显式读取 `stage0-context` | cutover 声明极薄 `before_plan` hook anchor；hook 内部读取 `workflow-context --stage=plan` 并按需建议 `locate/path/explain`，由 LLM 选择 candidate change surface；local reads 保留为 fallback | 计划输出更具体，候选文件、symbol、证据和假设更可审查 |
| `spec-write-tasks` | 新增的可选 plan -> task pack 派生层 | 不新增独立 CRG hook；task pack 保留 `source_plan` / `source_plan_hash`，可把 CRG query 作为 task `context_refs` / `entry_hint` / `test_focus` 的输入索引，但不得改 scope；`spec-work` 消费 task pack 时通过 `before-work --task-pack=<tasks.md>` 回到 source plan handoff | 大计划执行前能压缩任务上下文，同时避免 task pack 变成第二份 plan 或第二事实层 |
| `spec-work` | 按计划和局部源码实现，影响面多靠经验判断；当前 source skill 不显式读取 Stage-0 selected assets | cutover 声明 `before_work` / `after_work` hook anchor；hook 内部用 `workflow-context --stage=work`、`impact`、`review-context` 校准计划面与实际 blast radius | 更早发现改动扩散、漏测和计划偏移 |
| `spec-work-beta` | 与 `spec-work` 类似，但含委派执行路径 | 复用同一 `before_work` / `after_work` hook envelope，并传给委派 agent 作为共同事实输入 | 多 agent/委派实现更容易对齐同一影响面 |
| `spec-code-review` | 主要按 diff 文件、局部源码和评审经验审查；当前 source skill 不显式读取 `stage0-context` | cutover 声明 `before_review` hook anchor；hook 内部读取 `workflow-context --stage=review` / `review-context`，按 affected flows、graph expansion、candidate tests 输出排序建议 | review 从逐文件扫描升级为风险优先审查 |
| `using-spec-first` | 只负责 workflow 入口治理 | 不新增复杂入口；graph bootstrap 只在需要代码事实索引时进入，普通 planning/work/review 通过对应 skill 消费 CRG context | 保持入口轻量，避免把 bootstrap 变成所有请求的前置流程 |
| `spec-compound` / `spec-compound-refresh` | 管理可复用经验、pattern、方案沉淀 | 继续承接“值得长期保存的知识”；CRG query 发现不自动写成长期文档 | 避免 graph bootstrap 重新膨胀成知识库或文档生成器 |
| `spec-update` / installed runtime | 刷新运行时 skill / agent 资产 | runtime mirror 带 source hash / generated marker；doctor 只报告 drift，不把 mirror 当真源 | 降低 source skill 与安装后资产漂移风险 |

完成后的系统变化不是新增一个独立“图产品”，而是把代码事实输入前移到所有关键研发 workflow：planning 更具体，implementation 有计划面与实际面比较，review 能按影响面排序，fallback 仍回到 direct repo reads，不回到旧 Stage-0 文档包。

集成姿势必须是“低侵入显式 hook”，不是“零改 `.md` 的隐式注入”。相关 skill 只增加 3-8 行 hook anchor，完整语义集中到 CRG hook contract；这样既避免把 CRG 逻辑散写进每个 skill，也避免隐藏式 AOP 破坏可审计性。

### 最小成功闭环

第一版不追求完整 Workstream A-I，但必须是无兼容层的 query-first 原子闭环。最小成功闭环需要同时证明：

```text
graph ready
  -> locate / explain / path 输出候选修改面与解释证据
  -> spec-plan 能写出 candidate change surface
  -> review-context / impact 输出可用影响面
  -> spec-work 能比较计划改动面与实际 blast radius
  -> spec-code-review 能按影响面排序审查
  -> stage0-context / context-routing 不再是任何默认入口
```

这个闭环跑通前，不推进复杂 graph-report、跨 repo graph merge 或多模态 semantic layer；CRG MCP server 不进入本方案。

## Scope Boundaries

### In Scope

- 重塑 `skills/spec-graph-bootstrap/SKILL.md` 的默认目标与 Phase 结构。
- 新增或调整 CRG 图索引状态产物 contract。
- 强化 `crg review-context`、`crg impact`，并新增轻量 `crg locate/path/explain` 的设计。
- 新增 CRG lifecycle hooks 与 workflow context 入口，并在同一 cutover 中为 `spec-plan`、`spec-work`、`spec-work-beta`、`spec-code-review` 增加极薄 hook anchor；`spec-write-tasks` 只保留 task-pack pass-through。当前 source skills 的 local research / plan / diff reads 继续存在，但 legacy `stage0-context` / `context-routing` / `minimal-context` 不再作为任何默认 runtime 入口或 fallback。
- 删除 Stage-0 human docs 的默认生成链路；显式 report mode 只作为人类审计投影。
- 删除旧 `context-routing` runtime 默认链路，包括 `minimal-context` 选择、`selected_assets` 注入和 `injection-index.yaml` 路由。
- 增加 freshness、最小安全过滤、最小 shrink guard、diff base resolver 和 suggested query 导航信号；完整输入检测、显式 prune intent、高级 graph health 规则与 surprise/gap/question 可作为 cutover 后增强项，但不得影响 Stage-0 原子删除。
- 为关键 contract 和 CLI 输出补 unit / contract / smoke / e2e 验证面。

### Out of Scope

- 不在本轮引入向量数据库、RAG 平台或远端索引服务。
- 不把 CRG 查询结果上升为强制 gate 结果。
- 不让 `locate` 直接决定最终修改文件。
- 不做全局隐式 AOP、不自动改写所有 skill prompt、不引入 hook rules engine / hooks.yaml / condition DSL。
- 不实现 CRG MCP server；需要结构化图查询时使用 CLI / hook。
- 不在本轮解决所有语言 AST 解析完备性问题。
- 不保留旧 Stage-0 docs/runtime 作为兼容层；旧产物在 cutover 后只能被删除或作为历史文件忽略，不作为新架构 fallback 或输入。

### Deferred to Separate Tasks

- 跨 repo symbol graph 与真正跨仓调用链。
- 大型 monorepo 的增量图构建性能优化。
- 基于 LSP/Serena 的 symbol disambiguation 深度融合。
- CRG query 结果的 token budget 自适应压缩算法。
- UI/可视化图谱浏览器。
- 多模态 / docs / image / video semantic extraction。
- embedding / semantic rerank 默认接入。
- 自动 watch / file-save hooks。
- wiki / memory loop 将 query 结果反写为 runtime markdown。

## MVP Scope

### MVP-1: Atomic Query-First Cutover

目标：一次性完成 plan / work / review 的 query-first 默认入口切换，不保留 Stage-0 兼容层。实现分支内部可以按依赖顺序施工，但合并后的用户可见状态必须是单一默认入口。

Included:

- `graph-index-status.json`
- `code-navigation.json` 最小版：`entrypoints`、`test_roots`、`high_risk_nodes`、`top_flows`、`top_communities`、`top_hubs`、`query_starters`
- `graph-operations.jsonl`
- 最小状态指示：`status` 能区分 `ready` / `missing` / `degraded` / `unavailable`，`freshness.state` 能区分 `fresh` / `stale` / `unknown`
- 最小安全过滤：fallback suggested reads 不指向 sensitive / generated / self-output / runtime mirror / Stage-0 docs 路径
- 最小 shrink guard：异常 node/edge 收缩不静默 promote，保留 last-known-good 并写 degraded status
- 最小 detail profile：CRG query / hook envelope 支持 compact `minimal` 输出和证据完整的 `standard` 输出；不恢复旧 `minimal-context` 链路
- 共享 diff base resolver：显式 `--since`、`--work-run` / `work_start_ref`、merge-base 推导
- 最小 `change_surface` contract：允许 work/review 对照计划范围与实际影响面
- 机器可读 `planned_change_surface` handoff：`spec-plan` 使用唯一 sentinel JSON block 或 `--planned-surface` sidecar，`before-work` 不解析 prose
- task pack handoff：`spec-write-tasks` 产物只引用 `source_plan` / `source_plan_hash`，`before-work --task-pack=<tasks.md>` 先校验并回到 source plan 的 planned surface；task pack 不复制或改写 planned surface
- `crg locate`
- `crg path`
- `crg explain`
- `crg review-context` 增强：`affected_flows`、`impacted_modules`、`risk_summary`、`candidate_tests`
- `crg impact` 增强：`impacted_modules`、`affected_flows`、`candidate_tests`
- `spec-first crg workflow-context --stage=plan|work|review`
- `workflow-context.review.verification_focus` 最小承接 `test-surface.coverage_gaps`
- `spec-first crg hook before-plan|before-work|after-work|before-review`
- `spec-plan` 通过 `before-plan` 生成 candidate change surface
- `spec-write-tasks` 作为可选派生层保留 plan SoT，不新增 CRG lifecycle hook；task pack 可携带 CRG query refs 作为执行上下文索引
- `spec-work` / `spec-work-beta` 通过 `before-work` 与 `after-work` 对照计划面和实际 blast radius
- `spec-code-review` 通过 `before-review` 以 `review-context` 排序审查重点
- 删除 `stage0-context` CLI、`context-routing` 默认 runtime、`minimal-context` 默认输入、`docs/contexts` 默认生成和 `injection-index.yaml` 默认生成

Excluded:

- `surprising_connections`
- 完整 input detection / 显式 prune intent / 高级 shrink health 规则
- `graph-report.md`
- CRG MCP server（明确不做）

Done signal:

```text
给定一个新需求，spec-plan 能用 locate/explain/path 形成候选修改面；
给定一个真实 diff，review-context 能输出 changed nodes、2-hop callers、affected flows、candidate tests；
给定一次 spec-work，after-work 能比较 actual_change_surface 与 planned_change_surface；
异常 partial graph rebuild 不会覆盖 last-known-good；
graph unavailable 时，所有 hooks 都返回 direct-read fallback，且不读旧 Stage-0 docs；
CLI/help/plugin anchors/runtime skills 不再推荐或调用 stage0-context。
```

### MVP-2: Reliability Layer

目标：把 cutover MVP 的最小 freshness 扩展为可长期默认开启的可靠性层，保证 query-first 不被 stale / partial graph 破坏。

Included:

- input detection
- self-output exclusion
- sensitive file skip summary
- freshness status
- explicit prune/delete intent
- advanced shrink health thresholds
- last-known-good diagnostics

Done signal:

```text
graph rebuild 不会因 partial output 静默覆盖健康图；
graph stale / degraded 时 workflow 明确降级，不伪造 CRG 事实。
```

### MVP-3: Navigation and Optional Surface

目标：在不扩大默认主链的前提下补强 map 层和可选查询接口。

Included:

- `surprising_connections`
- `thin_communities`
- `ambiguous_edges`
- `suggested_queries`
- optional `graph-report.md`

Done signal:

```text
code-navigation.json 能给出高价值 suggested queries；
graph-report.md 只是 audit projection；
可选 surface 只包含人类审计用 `graph-report.md`；结构化查询继续通过 CLI / hook 提供，不新增 CRG MCP server。
```

## Key Technical Decisions

### 决策 1：默认 bootstrap 只保证 graph ready

默认 `$spec-graph-bootstrap` 不再把完整 markdown 文档包作为 done signal。默认完成条件变为：

```text
CRG 可用
graph.db 存在且健康
graph-index-status.json 写入
code-navigation.json 写入
基础按需查询可用：context / impact / review-context / locate / path / explain
workflow hooks 可用：before-plan / before-work / after-work / before-review
```

原因：用户核心目标是代码索引和影响面判断，不是每次都生成项目说明书。

### 决策 2：Stage-0 docs/runtime 从默认链路删除

默认链路不再生成或消费 Stage-0 文档包与 runtime routing：

```text
删除默认生成:
  docs/contexts/<slug>/
  docs/contexts/<slug>/injection-index.yaml
  .spec-first/workflows/bootstrap/<slug>/minimal-context/*.json
  .spec-first/workflows/bootstrap/<slug>/context-routing.json

删除默认消费:
  spec-first stage0-context
  src/context-routing selected_assets / fallback L0-L3
  module-map/public-entrypoints 作为 workflow 默认上下文
```

替代路径是一次性切换到：

```text
graph.db
  -> graph-index-status.json
  -> code-navigation.json
  -> spec-first crg hook before-plan
  -> spec-first crg hook before-work / after-work
  -> spec-first crg hook before-review
  -> locate / explain / path / impact / review-context
  -> LLM 决策
```

显式 report mode 可以生成 `graph-report.md` 或其他人类审计摘要，但这些文件不再作为 fallback 事实层。

### 决策 3：按需查询优先于预生成大上下文

新任务与变更场景优先查询：

```text
crg context
crg locate
crg impact
crg review-context
crg affected-flows
```

原因：具体任务的相关代码面需要结合任务语义实时判断，预生成静态文档不能替代按需查询。

### 决策 4：`locate` 是检索聚合器，不是语义裁决器

`crg locate --query="<task>"` 可以聚合关键词、路径、symbol、flow、community 结果，但输出必须是候选与证据：

```text
candidate_files[]
candidate_symbols[]
candidate_modules[]
related_flows[]
evidence[]
limitations[]
```

不输出：

```text
must_modify_files[]
final_decision
required_implementation_steps
```

最终判断属于 LLM。

### 决策 5：已有 diff 的主入口是 `review-context`

`review-context` 比单独的 `impact` 更适合修改后评估，因为它天然知道 diff、hunks、changed files、changed nodes、候选测试和验证建议。它应成为 `spec-work` 后验验证与 `spec-code-review` 输入的核心。

`review-context.changed_nodes` 必须优先来自 hunk overlap：脚本解析 `git diff --unified=0` 后，用 node `line_start` / `line_end` 判断是否命中。changed file 内但未命中 hunk 的节点只能进入 `changed_file_nodes` 或 surrounding context；当 hunk 不可用时，才降级为文件级 changed nodes，并写入 limitation。

### 决策 6：以 CRG lifecycle hooks 原子替换旧 Stage-0 runtime

不再把旧 Stage-0 产物保留为兼容层。

新的切换策略是：

```text
同一 cutover:
  新增 CRG workflow-context + 固定 lifecycle hooks
  切换 plan/tasks/work/work-beta/review 的真实消费入口
  删除 stage0-context / context-routing / minimal-context / docs 默认链路
```

`fact-inventory.json`、`risk-signals.json`、`test-surface.json` 中仍有价值的信息必须由 CRG query 或 `code-navigation.json` 的投影字段承接；不能因为删除旧文件而丢失测试面、风险面和拓扑面信息。

### 决策 7：引入 Graphify 风格的 map/query split

`code-navigation.json` 与 optional `graph-report.md` 只回答“这张代码图大概长什么样、值得从哪里开始查”。真正回答具体任务的问题，必须走 CRG query。

原因：把 overview map 和 precise query 分开，可以避免重新把 docs 产物推回事实真源。

### 决策 7.5：CRG query 支持 detail profile，但不恢复 `minimal-context`

CRG query / hook envelope 可以支持 `--detail=minimal|standard` 或同等 `detail_profile` 字段：

- `minimal`：summary、top candidates、risk/test gap counts、limitations、recommended_queries。
- `standard`：item-level `evidence[]`、edge/path details、ranked context、完整候选数组。

默认 workflow hook 先请求 `minimal`，LLM 只有在需要解释具体候选时再调用 `standard` 或更具体的 `locate/path/explain/impact/review-context`。这只是 token 输出分级，不是旧 `minimal-context` runtime 链路，也不能变成第二事实入口。

### 决策 8：新增 `path` 与 `explain` 作为一等查询

`locate` 解决“可能改哪里”，`impact` 解决“改这里影响谁”，`review-context` 解决“这个 diff 影响谁”。但 LLM 还需要两个解释性问题：

```text
为什么 A 和 B 有关系？        -> crg path
这个 symbol 周围是什么结构？  -> crg explain
```

这两类查询能显著提高 plan/review 中的证据解释质量。

### 决策 9：统一查询置信度语义

CRG query 输出统一使用：

```text
observed   直接 AST/git/diff/SQLite 事实
inferred   图遍历、社区、命名、测试映射推断
ambiguous  多候选、冲突证据、低分或不确定
```

迁移规则：

- 旧 `confidence: "Observed"` 或来自 AST / git / diff / SQLite 精确事实的条目映射为 `decision_input_kind: "observed"`。
- 旧 `confidence: "Inferred"`、`source_tier` 指向 graph traversal / community / naming / test mapping 的条目映射为 `decision_input_kind: "inferred"`。
- 多候选、证据冲突、低分、无法稳定映射或既有字段缺失的条目映射为 `decision_input_kind: "ambiguous"`。

`confidence`、`source_tier`、`score`、`inference_reason` 只能作为 deprecated/debug 字段短期保留，不得作为 workflow consumer 的分支依据。凡是会影响 LLM 决策的 query item 都必须有 item-level `decision_input_kind` 与 `evidence[]`；`change_surface.decision_input_kind` 是对该对象的保守聚合摘要，不能替代 item-level 标签。聚合规则采用最保守口径：任一 item 为 `ambiguous` 则对象为 `ambiguous`；否则任一 item 为 `inferred` 则对象为 `inferred`；全部 observed 才能标记为 `observed`。

### 决策 10：图构建必须有异常收缩保护

如果 rebuild 后 node/edge 数显著下降，且没有显式 prune/delete intent，系统不能静默覆盖 last-known-good graph。应写入 degraded status 和 limitation，让 LLM 知道当前图不可信。

原因：AI workflow 最怕“看起来成功但事实输入变少”。shrink guard 是输入质量守门，不是 gate 状态机。

## Proposed New Default Flow

```text
$spec-graph-bootstrap [target]
  |
  v
+-------------------------------+
| 1. Resolve target / optional slug |
+-------------------------------+
  |
  v
+-------------------------------+
| 2. Probe CRG readiness         |
| - CLI available                |
| - native modules ready         |
| - graph.db exists              |
| - graph stale?                 |
+-------------------------------+
  |
  +------------------------------+
  | missing / stale / unhealthy
  v
+-------------------------------+
| 3. Build or rebuild graph      |
| spec-first crg build           |
+-------------------------------+
  |
  v
+-------------------------------+
| 4. Validate graph              |
| spec-first crg stats/context   |
+-------------------------------+
  |
  v
+-------------------------------+
| 5. Write machine control plane |
| - .spec-first/graph/graph-index-status.json |
| - .spec-first/graph/code-navigation.json    |
| - .spec-first/graph/artifact-manifest.json  |
+-------------------------------+
  |
  v
+-------------------------------+
| 6. Print query guidance        |
| - locate for task planning     |
| - review-context for diff      |
| - impact for symbol blast      |
+-------------------------------+
  |
  v
END
```

Optional report mode:

```text
$spec-graph-bootstrap --report
  |
  v
Default graph-ready flow
  |
  v
Generate graph-report.md audit projection
```

Workspace mode:

```text
$spec-graph-bootstrap --workspace
  |
  v
Discover child repos
  |
  v
Run graph-ready flow per child
  |
  v
Write workspace graph status registry
  |
  v
Write workspace graph status summary
```

Workspace MVP ownership:

- C1 不实现跨 repo symbol graph，也不让 hook 自动选择唯一 child repo。
- `spec-first crg hook ... --repo=<child>` 是 workspace 中唯一确定查询某个 child graph 的默认方式。
- 当任务目标跨 child 或无法判定归属时，workflow-context 返回 workspace child candidates、limitations 和 direct-read fallback 建议；LLM 决定后续查询哪个 child。
- 旧 workspace docs registry 在 cutover 中删除；child graph status registry 只说明每个 child 的 graph 可用性，不替代跨仓语义判断。

## Proposed Artifacts

### graph-index-status.json

Path:

```text
.spec-first/graph/graph-index-status.json
```

旧 bootstrap slug 目录不再是 graph status 的查找入口；可选 report/projection 可以另行写入人类审计目录，但不得作为 hook runtime 的读取来源。

Purpose: 回答“当前图索引是否可用、是否可信、能支持哪些查询”。

Shape:

```json
{
  "schema_version": "v1",
  "generated_at": "<ISO>",
  "repo_root": ".",
  "graph_db": ".spec-first/graph/graph.db",
  "status": "ready",
  "freshness": {
    "state": "fresh",
    "head_commit": "<git-sha-or-null>",
    "last_built": "<ISO-or-null>",
    "changed_file_count_since_build": 0
  },
  "stats": {
    "node_count": 0,
    "edge_count": 0,
    "flow_count": 0,
    "community_count": 0
  },
  "capabilities": {
    "search": true,
    "context": true,
    "impact": true,
    "review_context": true,
    "affected_flows": true,
    "locate": true,
    "path": true,
    "explain": true
  },
  "limitations": []
}
```

Notes:

- `repo_root` 持久化产物中使用 repo-relative display 值，避免把本机绝对路径写入可分享 artifact；CLI 控制台可临时打印绝对路径辅助调试。
- `status` 只表达索引可用性：`ready | missing | degraded | unavailable`。
- `freshness.state` 只表达新鲜度：`fresh | stale | unknown`。
- `capabilities` 只表达工具是否可调用，不表达 LLM 是否应该信任某个结论。
- `limitations[]` 用自然语言短句说明缺口，例如 `graph-db-stale`、`native-modules-missing`、`flows-empty`。

### change_surface contract

Purpose: 给 `spec-plan`、`spec-write-tasks`、`spec-work`、`spec-code-review` 一个最小、可比较的修改面对象，用来表达“计划要改哪里”和“实际影响到哪里”。它是 LLM 决策输入，不是强制 gate；`spec-write-tasks` 只能引用该对象，不能改写它。

Shape:

```json
{
  "schema_version": "v1",
  "source": "plan|review-context|impact|manual",
  "files": [],
  "symbols": [],
  "modules": [],
  "flows": [],
  "normalized_files": [],
  "normalized_symbols": [],
  "normalized_modules": [],
  "normalized_flows": [],
  "unmatched_items": [],
  "evidence": [],
  "decision_input_kind": "observed|inferred|ambiguous",
  "limitations": []
}
```

Comparison rules:

- `planned_change_surface` 来自 plan 或 work 前的 LLM 显式声明。
- `before-work --planned-surface=<path>` 的 sidecar JSON 优先级最高；存在该参数时不扫描 plan inline block。
- `before-work --task-pack=<tasks.md>` 只把 task pack 当作派生执行索引：先读取 frontmatter 的 `source_plan` / `source_plan_hash`，校验未过期后回到 source plan 读取 sentinel 或 sidecar；task pack 中的 task cards 只能提供 files/context_refs/test_focus，不得覆盖 `planned_change_surface`。
- `spec-plan` inline handoff 必须使用唯一 sentinel 包裹 JSON fenced block：

~~~md
<!-- spec-first:planned_change_surface:start -->
```json
{
  "schema_version": "v1",
  "source": "plan",
  "files": [],
  "symbols": [],
  "modules": [],
  "flows": [],
  "evidence": [],
  "decision_input_kind": "observed|inferred|ambiguous",
  "limitations": []
}
```
<!-- spec-first:planned_change_surface:end -->
~~~

- `before-work --plan=<plan.md>` 只读取上述 sentinel block，不从 markdown prose 做语义推断。
- `--task-pack` 缺失 `source_plan` 时返回 `task-pack-invalid` limitation；`source_plan_hash` 不匹配时返回 `task-pack-stale` limitation，并拒绝把 stale task cards 当作计划事实。
- inline sentinel 必须恰好出现一组；多组返回 `planned-surface-ambiguous` limitation，缺失返回 `planned-surface-missing` limitation。
- JSON parse 失败返回 `planned-surface-invalid-json` limitation；schema 校验失败返回 `planned-surface-invalid` limitation。
- `planned_change_surface_hash` 基于 parse 后的 canonical JSON 计算，不包含 markdown sentinel、fenced marker 或 surrounding prose；hash 写入 `.spec-first/graph/work-runs/<run_id>.json`。
- `actual_change_surface` 来自 `review-context` / `impact` 的 deterministic query 输出。
- `files[]` 必须是 repo-relative canonical path；`symbols[]` 优先使用 CRG node id；`modules[]` / `flows[]` 使用稳定 module/community/flow id。
- `normalized_*` 是脚本完成 canonicalization 后的比较输入；`unmatched_items[]` 记录无法映射的人工条目或 ambiguous entries。
- 脚本只对 `normalized_*` 做集合差异：`expanded_files`、`expanded_symbols`、`expanded_modules`、`expanded_flows`。
- 是否接受扩大、回补实现或扩大验证范围，由 LLM 决策。
- Cutover MVP 必须支持 `files[]`、`modules[]`、`flows[]` 的最小比较；`symbols[]` 在 CRG 能解析到 symbol id 时必须填充，无法解析时写入 `unmatched_items[]` 与 `limitations[]`。

### code-navigation.json

Path:

```text
.spec-first/graph/code-navigation.json
```

`code-navigation.json` 与 active graph pointer 同域管理，避免 plan/work/review hook 依赖 bootstrap slug。

Purpose: 给 LLM 一个低 token 的图索引 index / dashboard。workflow 应先读 `graph-index-status.json`，再读 `code-navigation.json`，最后按 `query_starters` 或 `recommended_queries` 调 CRG CLI；不得从这里推断完整代码事实。

Shape:

```json
{
  "schema_version": "v1",
  "generated_at": "<ISO>",
  "source": "crg-context",
  "entrypoints": [],
  "top_flows": [],
  "top_communities": [],
  "top_hubs": [],
  "high_risk_nodes": [],
  "surprising_connections": [],
  "thin_communities": [],
  "ambiguous_edges": [],
  "test_roots": [],
  "suggested_queries": [],
  "query_starters": [
    {
      "intent": "plan-new-task",
      "requires_capability": "locate",
      "command": "spec-first crg locate --query=\"<task>\" --repo=<target>"
    },
    {
      "intent": "review-diff",
      "requires_capability": "review_context",
      "command": "spec-first crg review-context --since=<ref> --repo=<target>"
    },
    {
      "intent": "symbol-impact",
      "requires_capability": "impact",
      "command": "spec-first crg impact --symbol=<symbol_id> --depth=2 --repo=<target>"
    },
    {
      "intent": "explain-node",
      "requires_capability": "explain",
      "command": "spec-first crg explain --symbol=<symbol_id_or_query> --repo=<target>"
    },
    {
      "intent": "trace-relationship",
      "requires_capability": "path",
      "command": "spec-first crg path --from=<symbol_or_query> --to=<symbol_or_query> --repo=<target>"
    }
  ]
}
```

Notes:

- 它不包含全量 symbol 表。
- 它只保留 top-N 导航信号。
- 它是 LLM 的第一导航入口，角色类似 LLM Wiki 的 `index.md`，但格式是 machine-readable JSON。
- 默认每类导航数组最多 10 项；每项只允许 node id、repo-relative path、kind、score、short reason、query hint，不允许长段 prose、完整源码片段或 README 式架构说明。
- 消费方如需细节必须回查 CRG CLI。
- `surprising_connections`、`thin_communities`、`ambiguous_edges` 与 `suggested_queries` 都是导航建议，不是风险裁决。
- Cutover MVP 可以先写入 surprise/gap 类字段的空数组，保持 schema 稳定；Unit 9 / navigation polish 再补真实分析信号。
- `query_starters` 必须按 `graph-index-status.json.capabilities` 过滤；cutover MVP 中 `locate/path/explain` 已是默认能力，若某语言或 graph 状态不支持，必须在 capabilities 和 limitations 中诚实降级。

### graph-operations.jsonl

Path:

```text
.spec-first/graph/graph-operations.jsonl
```

operation log 跟随 graph control-plane，不跟随 bootstrap slug；它解释 graph 状态变化，不记录 workflow 文档包历史。

Purpose: 轻量记录 CRG 图操作历史，帮助 doctor、debug 和 workflow 解释“为什么当前 graph 是这个状态”。它借鉴 LLM Wiki 的 append-only `log.md`，但保持结构化 JSONL。

Line shape:

```json
{
  "time": "<ISO>",
  "operation": "build|promote|degrade|workflow-context",
  "generation_id": "<id-or-null>",
  "hook_id": null,
  "status": "ready|missing|degraded|unavailable",
  "freshness_state": "fresh|stale|unknown",
  "node_count": 0,
  "edge_count": 0,
  "limitations": [],
  "reason": null
}
```

Rules:

- append-only；不要把它作为可编辑状态机。
- 不记录源码正文、绝对路径、secret-like literal。
- 不作为代码事实真源；真实代码事实仍来自 `graph.db`。
- Cutover MVP 只记录 `build`、`promote`、`degrade`、`workflow-context` fallback；hook fallback 统一记为 `operation: "workflow-context"`，并写入 `hook_id: "before_work|after_work|before_review|before_plan"` 与 `reason: "hook:<hook_id>:fallback"`，避免引入第二套 operation 类型。
- Cutover MVP 不要求 `doctor` append，避免把第一版拖成完整审计系统。
- Reliability hardening 可把 `operation` 扩展为包含 `doctor`、shrink guard、last-known-good、input detection 事件。

### graph-report.md

Path:

```text
docs/reports/crg/<slug>/graph-report.md
```

Purpose: Graphify 风格的人类可读审计摘要。它是 `code-navigation.json` 的 prose projection，不是事实真源。

Minimum sections:

```text
## Graph Status
## Core Abstractions
## Key Flows
## Surprising Connections
## Thin / Ambiguous Areas
## Suggested Queries
```

Rules:

- 默认主链不强制生成，只能由显式 report mode 生成。
- 每条 surprise / gap 必须引用 CRG node id、file path 或 query evidence。
- 不允许把 graph-report 写成“项目说明书全集”；它只服务图导航。

### artifact-manifest.json

继续保留，但语义调整：

Path:

```text
.spec-first/graph/artifact-manifest.json
```

```text
status: complete
outputs:
  graph-index-status.json:
    depends_on: ["crg:stats", "crg:context"]
  code-navigation.json:
    depends_on: ["crg:context"]
  graph-operations.jsonl:
    depends_on: ["crg:build"]
    appenders: ["workflow-context"]
optional_outputs:
  graph-report.md:
    generated: false
    reason: "report-mode-not-requested"
```

Cutover MVP 只要求 `workflow-context` / hook fallback 写入 operation log；hook fallback 仍由 `workflow-context` appender 记录，并用 `hook_id` 区分来源。`doctor` 只读 log 并报告 drift。Reliability hardening 若需要增强审计，再把 `doctor` 作为可选 appender 加入。

### crg workflow-context output

Command:

```bash
spec-first crg workflow-context --stage=<plan|work|review> --repo=<target>
```

Purpose: 作为 CRG lifecycle hook 的底层 stage envelope，为 workflow 提供低 token、可审计、按阶段裁剪的 CRG 决策输入。它承接旧 `stage0-context` 曾承担的 context 职责，但不作为 skill 默认 anchor；skill 只锚定 `crg hook ...`。它不是新的 `selected_assets` 系统，不返回 markdown 文件列表，也不把 fallback 包装成 CRG 事实。

Base shape:

```json
{
  "schema_version": "v1",
  "stage": "plan",
  "generated_at": "<ISO>",
  "repo_root": ".",
  "graph_status": {
    "status": "ready",
    "freshness": { "state": "fresh" },
    "capabilities": {}
  },
  "navigation": {
    "source": "code-navigation.json",
    "entrypoints": [],
    "top_flows": [],
    "top_communities": [],
    "top_hubs": [],
    "suggested_queries": []
  },
  "stage_context": {},
  "recommended_queries": [],
  "evidence": [],
  "limitations": [],
  "fallback": {
    "mode": "crg",
    "reason": null,
    "suggested_reads": []
  }
}
```

Stage-specific shape:

```json
{
  "plan": {
    "candidate_query_plan": [],
    "suggested_followups": []
  },
  "work": {
    "planned_change_surface": {},
    "actual_change_surface": {},
    "expanded_surface": {},
    "post_change_queries": ["review-context", "impact"]
  },
  "review": {
    "review_context_summary": {},
    "risk_ordering": [],
    "verification_focus": []
  }
}
```

Rules:

- `stage_context` 只能包含当前 stage 必需的压缩事实，不得塞入完整 source、完整 graph 或 markdown projection。
- `navigation` 与 `stage_context` 默认 top-N 上限为 10；`evidence[]` 默认上限为 20 条，且只能包含 repo-relative path、node id、query id、短 reason，不包含源码正文。
- `recommended_queries[]` 与 `stage_context.suggested_followups[]` 必须按 `graph_status.capabilities` 过滤；能力不可用时写入 `limitations[]`，例如 `locate-unavailable`，不能推荐不可执行命令。
- `recommended_queries[]` 是下一步 deterministic CLI 查询建议，不是 workflow gate。
- `fallback.mode = "direct-read"` 时，`stage_context` 不能包含 CRG-derived fields，例如 `blast_radius`、`affected_flows`、`candidate_tests`。
- `fallback.suggested_reads[]` 最多 5 条 repo-relative path 或 query hint，避免 fallback 变成无目标 grep；suggested reads 必须经过 cutover MVP 的最小安全过滤。
- 输出必须始终带 `limitations[]`，即使 graph ready 也要说明覆盖缺口，例如 `flows-empty`、`tests-not-linked`、`locate-unavailable`。

### crg lifecycle hook output

Lifecycle hook 是 CRG 低侵入接入 workflow 的唯一默认外壳。它封装 `workflow-context` 与底层 query，但不替代 `workflow-context` contract；hook 的职责是把“何时需要哪类事实”表达清楚，让 skill 只声明极薄 anchor。`workflow-context` 可以作为 CLI primitive 和测试面存在，但不成为 plan/work/review skill 的裸入口。

Commands:

```bash
spec-first crg hook before-work [--plan=<plan.md>|--task-pack=<tasks.md>|--planned-surface=<surface.json>|--task="<task description>"] --repo=<target>
spec-first crg hook after-work [--work-run=<id>|--since=<base>|--work-start-ref=<sha>|--auto-base] --repo=<target>
spec-first crg hook before-review [--work-run=<id>|--since=<base>|--work-start-ref=<sha>|--auto-base] --repo=<target>
spec-first crg hook before-plan --task="<task description>" --repo=<target>
```

Naming:

- CLI subcommand 使用 kebab-case：`before-work`、`after-work`、`before-review`、`before-plan`。
- JSON envelope 使用 snake_case `hook_id`：`before_work`、`after_work`、`before_review`、`before_plan`。
- Router 必须维护一张固定映射表；schema 和 contract tests 必须锁定 kebab-case CLI 与 snake_case `hook_id` 的一一对应关系。

Stage mapping:

| CLI hook | JSON `hook_id` | Stage | Release | Primary consumers | Internal facts |
| --- | --- | --- | --- | --- | --- |
| `before-plan` | `before_plan` | `plan` | cutover | `spec-plan` | `workflow-context --stage=plan`, `locate/path/explain` query plan |
| `before-work` | `before_work` | `work` | cutover | `spec-work`, `spec-work-beta` consuming plan or task pack | `workflow-context --stage=work`, structured planned surface, optional task-pack execution focus, `impact` suggestions, `work_run_id`, `work_start_ref` |
| `after-work` | `after_work` | `work` | cutover | `spec-work`, `spec-work-beta` | shared diff base resolver, `review-context`, actual surface, candidate tests |
| `before-review` | `before_review` | `review` | cutover | `spec-code-review` | shared diff base resolver, `workflow-context --stage=review`, `review-context`, risk ordering |

Diff base resolution:

- `before-work` 写入轻量 work run artifact：`.spec-first/graph/work-runs/<run_id>.json`，包含 `work_start_ref`、`planned_change_surface_hash`、`plan_path`、`created_at` 和 `limitations[]`；它不是状态机，只是 deterministic handoff。
- `before-work` envelope 同时返回 `work_run_id` 与 `work_start_ref`，默认 `work_start_ref` 是当前 `HEAD`。
- `before-work --task-pack=<tasks.md>` 必须先验证 task pack 的 `source_plan` / `source_plan_hash`，再从 source plan 或 `--planned-surface` 读取 planned surface；task pack 的 task cards 可作为 `execution_focus` / `context_refs`，但不能成为 planned surface 真源。
- `after-work` / `before-review` 的 diff base 解析顺序是：显式 `--since` > `--work-run` 读取的 `work_start_ref` > `--work-start-ref` > `--auto-base` 推导的 merge-base。
- `--auto-base` 必须复用 `spec-code-review` 的 base 解析语义，优先使用显式参数或当前分支相对默认分支的 merge-base，不得退化为 `git diff HEAD`。
- 无法解析 base 时，hook 返回 direct-read fallback envelope，并在 `limitations[]` 写入 `diff-base-unresolved`；不得让 `review-context` 因缺少 `--since` 直接终止整个 workflow。

Envelope shape:

```json
{
  "schema_version": "v1",
  "hook_id": "before_work",
  "stage": "work",
  "generated_at": "<ISO>",
  "workflow_context": {},
  "decision_inputs": [],
  "recommended_queries": [],
  "recommended_verifications": [],
  "work_run_id": null,
  "work_start_ref": null,
  "diff_base": null,
  "evidence": [],
  "limitations": [],
  "fallback": null
}
```

Rules:

- hook 只增强 context，不改变控制流；hook failure 必须返回 fallback envelope，不阻塞 workflow。
- skill `.md` 只写 lifecycle anchor 和 decision boundary，不复制 hook schema 或 CRG 查询细节。
- hook 输出是 LLM decision input，不是修改文件、测试范围或 review 结论。
- hook 不允许自动改写 prompt 主体、自动选择最终修改文件、自动跳过源码阅读、自动要求重新 bootstrap。
- hook fallback 时，顶层 `fallback` 必须复用 direct-read fallback shape；`workflow_context` 可以为空对象，或包含同一 fallback envelope，但不得包含 CRG-derived fields。消费者以顶层 `fallback` 为准。
- hook fallback 写 `graph-operations.jsonl` 时使用 `operation: "workflow-context"` + `hook_id`，不新增 `operation: "hook"`。
- 不引入通用 hook engine、hook priority、hooks.yaml、condition expression 或 plugin registry；固定 4 个 hook 足够覆盖 plan/tasks/work/review，其中 tasks 通过 `before-work --task-pack` 继承 source plan handoff。
- `before_plan` 仍然只给候选和证据；LLM 必须在 plan 中说明采纳/排除哪些候选及证据。

### direct-read fallback envelope

当 graph missing / unavailable / degraded 到无法可信查询时，workflow-context 必须诚实降级：

```json
{
  "fallback": {
    "mode": "direct-read",
    "reason": "graph-unavailable",
    "suggested_reads": [
      "package.json",
      "src/cli/index.js"
    ]
  },
  "stage_context": {},
  "recommended_queries": [],
  "evidence": [],
  "limitations": ["graph-unavailable", "crg-facts-not-used"]
}
```

Fallback rules:

- 不读取旧 `docs/contexts`、`minimal-context`、`injection-index.yaml`。
- 不声称已计算 blast radius、affected flows 或 candidate tests。
- 不输出 `decision_input_kind: observed` 的 CRG 事实；只能说明这是 direct-read fallback。
- Suggested reads 必须少量、具体、repo-relative，并由当前任务或 repo root 基础文件推导。
- Suggested reads 必须经过 sensitive / generated / self-output / runtime mirror 过滤；不得建议读取 `.env*`、credential/secret/private-key 文件、`.spec-first/**`、`.claude/**`、`.codex/**`、`.agents/**`、`docs/contexts/**` 或其他生成索引输出。
- direct-read fallback 只给路径和读取建议，不把脚本读取到的源码正文塞进 envelope；是否打开文件由 LLM 在当前任务中决定。

### Stage-0 field destination map

同一 cutover 删除旧 Stage-0 文件时，必须把仍有价值的信息由 CRG query 或新 control plane 承接：

| Old Stage-0 field | New destination | Notes |
| --- | --- | --- |
| `fact-inventory.project_identity` | `graph-index-status.json` + `code-navigation.json.entrypoints` | 只保留 repo identity / language / framework 的低 token 摘要 |
| `fact-inventory.modules` | `code-navigation.json.top_communities` / `crg communities` | module 说明不再生成 markdown，按需 query |
| `fact-inventory.topology` | `crg workflow-context` work/review surface + `crg impact` | 用于 changed files 到 impacted modules 的确定性映射 |
| `fact-inventory.entrypoints` | `code-navigation.json.entrypoints` / `crg explain` | 不再写 `public-entrypoints.md` |
| `fact-inventory.testing_surface` | `code-navigation.json.test_roots` + `review-context.candidate_tests` | 测试面进入 query 输出 |
| `risk-signals.signals` | `code-navigation.json.high_risk_nodes` + `review-context.risk_summary` | 风险只作为 decision input |
| `test-surface.coverage_gaps` | `workflow-context.review.verification_focus` | 不生成 `test-map.md` |
| `database-routing.json` | future `crg database-context` or direct-read fallback | 不进入 MVP 默认主链 |
| `context-routing.json` | deleted | 不承接 selected asset 语义 |
| `minimal-context/*.json` | deleted | 由 `crg workflow-context` stage payload 替代 |

C1 最小承接清单：

- `entrypoints`：由 CRG entrypoint detection / `crg explain` 支撑，写入 `code-navigation.json.entrypoints`；测试断言缺失时必须写 limitation，而不是静默留空。
- `testing_surface`：写入 `code-navigation.json.test_roots`，并在 `review-context.candidate_tests` / `impact.candidate_tests` 中按 diff 或 symbol 输出候选测试。
- `risk-signals.signals`：写入 `code-navigation.json.high_risk_nodes`，并在 `review-context.risk_summary` 中按 changed nodes 和 graph expansion 汇总。
- `test-surface.coverage_gaps`：进入 `workflow-context.review.verification_focus`，作为 review 验证关注点，不再生成 `test-map.md`。
- `modules` / `topology`：进入 `code-navigation.json.top_communities`、`crg impact`、`workflow-context` 的 impacted modules / affected flows。
- `database-routing.json` 明确 deferred 到 future `crg database-context` 或 direct-read fallback；C1 不声称承接数据库语义路由。
- 旧 prose-only module docs、public-entrypoints markdown 和 test-map markdown 明确 deferred/report-only；C1 不以 markdown 摘要作为 runtime 输入。

### Stage-0 deletion dependency map

本方案不做向下兼容，但实现分支内部仍必须按依赖顺序施工，避免半途断 import。合并时必须是单一 cutover：消费者已切到 CRG，旧 runtime 已删除。

```text
1. graph control-plane
   .spec-first/workflows/bootstrap/<slug>/graph-* -> .spec-first/graph/*

2. plugin/help anchors
   src/cli/plugin.js
   add/update high-value anchors to crg hook before-work|after-work|before-review|before-plan;
   remove any legacy Stage-0 mention if present

3. workflow skills
   spec-plan / spec-write-tasks / spec-work / spec-work-beta / spec-code-review
   local research remains; new thin hook anchor supplies decision_inputs + recommended_queries + fallback

4. review-context dependency
   src/crg/commands/review-context.js
   context-routing/change-surface -> src/crg/changes.js or src/crg/workflow-context

5. diff base resolver
   duplicated review base logic -> src/crg/diff-base.js or src/cli/shared-diff-base.js

6. doctor
   bootstrap contract check -> graph contract check

7. workspace
   workspace docs registry -> child graph status registry

8. CLI surface
   remove stage0-context help and command registration

9. delete or move old runtime modules
   no module remains under src/context-routing/**
```

Context-routing module disposition:

| Current module | Cutover action |
| --- | --- |
| `change-surface.js` | Move deterministic change-surface and verification recommendation helpers into `src/crg/changes.js` or `src/crg/workflow-context/change-surface.js`; remove Stage-0 names |
| `entry-resolver.js` | Move generic repo/root/slug helpers into `src/bootstrap-compiler/repo-target.js` or `src/crg/repo-target.js`; delete Stage-0 entry vocabulary |
| `telemetry.js` | Delete if only Stage-0; otherwise move generic telemetry into `src/cli/telemetry.js` |
| `verification-summary.js` / `verification-evidence.js` / `verification-gate-state.js` / `verifier-registry.js` / `quality-gate-result.js` / `quality-feedback.js` | Move still-useful deterministic verification helpers into `src/verification/*` or `src/crg/verification/*`; remove `selected_assets`, L0-L3 fallback, and Stage-0 context assumptions |
| `evaluator.js` / `fallback.js` / `priority.js` / `profiles.js` / `loader.js` / `workspace-loader.js` / `selection-context.js` | Delete; their runtime selection semantics are replaced by fixed lifecycle hooks and direct-read fallback |

Do not merge an intermediate release where `src/context-routing/**` still exists as a default runtime dependency. If a utility is still useful, move it under a new non-Stage-0 module before deletion.

Runtime consumer checklist:

| Current consumer | Current dependency | New destination |
| --- | --- | --- |
| `src/cli/index.js` | `runStage0Context` command registration | remove `stage0-context`; keep `crg` routed from `bin/spec-first.js` |
| `src/cli/plugin.js` | current high-value anchors do not expose CRG lifecycle hooks and should not be treated as a Stage-0 truth source | anchors mention `crg hook ...` and hook evidence; remove legacy Stage-0 wording if any appears |
| `src/cli/commands/doctor.js` | `context-routing/loader` + `evaluator` + verification summary | graph contract check + optional verification evidence check |
| `src/crg/commands/review-context.js` | `context-routing/change-surface` | `src/crg/changes.js` or `src/crg/workflow-context/*` |
| `src/bootstrap-compiler/run-bootstrap.js` | writes Stage-0 machine/docs/routing artifacts | graph-ready writer for `graph-index-status` / `code-navigation` |
| `src/bootstrap-compiler/workspace-compiler.js` | workspace docs registry and selected assets | child graph status registry |
| `src/bootstrap-compiler/schema-loader.js` | Stage-0 schemas as compiler truth | add graph schemas; retire Stage-0 schemas from default compiler path |
| `src/bootstrap-compiler/compile-verification-profile.js` | verifier hints from context-routing registry | CRG change surface / query-derived verification hints |
| `README.md` / `README.zh-CN.md` | Stage-0 docs package as primary entry | query-first bootstrap and direct-read fallback |

The checklist is a cutover precondition, not a compatibility plan. The final merged state must have no default runtime consumer for `stage0-context`, `context-routing`, `minimal-context`, `docs/contexts`, or `injection-index.yaml`.

### Code reality landing notes

当前源码不是 greenfield，实施时必须尊重这些现状：

- `bin/spec-first.js` 已经把 `spec-first crg ...` 直接路由到 `src/crg/cli/router.js`；不要在 `src/cli/index.js` 再新增第二条 `crg` 路由。`src/cli/index.js` 的任务是移除 `stage0-context` command registration 和 help 文案。
- `src/crg/cli/open-db.js` 在 graph missing 或 `better-sqlite3` missing 时会直接 `process.exit(2)`。`crg workflow-context` 需要先用 `resolveActiveGraphDb` / graph pointer / fs check 生成 graph status；只有 graph 可用时才打开 DB。否则必须返回 direct-read fallback envelope，不能提前 exit。
- `src/crg/cli/router.js` 当前没有 `hook`、`workflow-context`、`locate`、`path`、`explain` 子命令。cutover 必须一次性添加这些 handler，并让 `graph-index-status.json.capabilities` 只声明真实存在的 handler，避免 capability 与 router 不一致。
- `src/crg/cli/build.js` 已经有 generation、`current.json`、`last-known-good.json`、`assessGenerationHealth` 与 `promoteGeneration`。cutover 应复用这些指针生成 `.spec-first/graph/graph-index-status.json` 并实现最小 shrink guard；Reliability hardening 再增强显式 prune intent 与分层健康诊断，不要重写一套 graph generation 系统。
- `src/bootstrap-compiler/run-bootstrap.js` 当前 `DEFAULT_BOOTSTRAP_ASSETS` 和 `writeControlPlaneArtifacts` 写死 `fact-inventory`、`risk-signals`、`test-surface`、`context-routing`、`minimal-context` 与 docs。Workstream C 需要新增 graph-ready writer 并改变默认写入清单，而不是只改 schema。
- `src/bootstrap-compiler/compile-machine-artifacts.js` 当前总是编译 `minimal_context` 和 Stage-0 lint required assets。切换默认主链时要么新增 `compileGraphReadyArtifacts`，要么给 compiler 明确 mode；不要在同一个函数里同时维护两套默认 truth。
- `src/bootstrap-compiler/schema-loader.js` 当前 `loadBootstrapSchemas()` 默认加载 Stage-0 schemas。新增 graph schemas 后，要避免 schema loader 继续把 `context-routing` / `minimal-context` 当默认必需 schema。
- `src/context-routing/change-surface.js` 的 `summarizeChangeSurface` 仍被 `review-context` 使用，并且包含 verification recommendation 价值。先迁移或复制到 `src/crg/changes.js`，再删除 `context-routing`。
- `src/bootstrap-compiler/workspace-compiler.js` 不只是 docs registry，还合并 `verification_summary`、`verifier_dispatch`、`verification_evidence`、`verification_gate_state`。cutover workspace 时要明确哪些 verifier 信号进入 CRG change surface，哪些从 graph bootstrap 默认路径删除，并确保不再从 `src/context-routing/**` 读取。
- runtime mirrors / installed anchors 当前容易和 source skill 漂移。借鉴 LLM Wiki thin pointer 思想，新增或刷新 runtime asset 时应带 source hash / generated marker；doctor 只报告 drift，不把 runtime mirror 当作可编辑真源。

### Doctor Graph Section Lint Contract

`spec-first doctor` 的检查对象从 Stage-0 bootstrap contract 改为 CRG graph lint/report。为贴合当前 CLI 结构，不新增多级 graph 子命令；而是在 `spec-first doctor` 输出中增加 graph section。若后续需要显式入口，只增加 `spec-first doctor --graph` 过滤视图。它输出 graph readiness 与结构健康 findings，不做 hard gate：

```text
PASS:
  - graph-index-status.json exists
  - status = ready
  - freshness.state = fresh or stale is explicitly reported
  - graph_db exists
  - required capabilities for installed workflow anchors are true

WARNING:
  - status = degraded
  - freshness.state = stale
  - graph_db missing but fallback available
  - workflow anchors mention locate/path/explain but capability is false
  - code-navigation.json missing or stale

INFO:
  - graph unavailable and direct-read fallback is the only available path
```

Additional lint findings:

```text
HIGH:
  - capability says command is available but router has no handler
  - code-navigation references node ids not present in active graph
  - current graph pointer is broken and no last-known-good exists

MEDIUM:
  - graph-operations.jsonl missing while graph artifacts exist
  - graph-index-status generated_at older than active graph promotion
  - workflow-context returned CRG facts while fallback.mode = direct-read

LOW:
  - optional graph-report exists but is not listed as optional output
  - query_starters include disabled capabilities
```

Doctor must not reintroduce a hard gate. It reports graph readiness, index drift, capability drift, fallback honesty, and limitations; LLM/user decide whether to continue with fallback, rebuild, or fix artifacts.

## Query Contracts

All CRG query commands below keep the existing `crg-cli/v1` envelope:

```json
{
  "schema_version": "crg-cli/v1",
  "generated_at": "<ISO>",
  "repo_root": "<abs-or-display-root>",
  "degraded": false,
  "warnings": [],
  "data": {}
}
```

The command-specific examples in this section show the `data` payload only. This preserves the current CLI contract while letting workflow hooks consume typed query payloads.

### crg locate

New command:

```bash
spec-first crg locate --query="<task description>" --repo=<target>
```

Intent:

```text
新任务还没有 diff 时，聚合图索引中的候选修改点。
```

Inputs:

- `--query=<text>`：任务描述或关键词。
- `--repo=<path>`：目标仓库。
- optional `--limit=<N>`：候选结果上限。
- optional `--path=<path>`：限制在某路径下检索。

Output:

```json
{
  "query": "<task description>",
  "candidate_symbols": [
    {
      "id": "src/foo.js#function#bar#L10",
      "name": "bar",
      "file_path": "src/foo.js",
      "kind": "function",
      "score": 0.72,
      "evidence": ["fts-name-match", "flow-member"],
      "decision_input_kind": "inferred"
    }
  ],
  "candidate_files": [],
  "candidate_modules": [],
  "related_flows": [],
  "related_communities": [],
  "suggested_followup_queries": [],
  "limitations": []
}
```

Implementation posture:

- 先做 deterministic lexical / FTS / graph aggregation。
- 不调用 LLM。
- 不输出最终修改决定。
- 不读取超大源码上下文，只返回路径、symbol、line、score、evidence。
- 每条候选必须有 `decision_input_kind: observed | inferred | ambiguous`。

### crg path

New command:

```bash
spec-first crg path --from=<symbol_or_query> --to=<symbol_or_query> --repo=<target>
```

Intent:

```text
解释两个 symbol / module / concept 之间如何通过 imports、calls、contains、flow 或 community 关系连接。
```

Output:

```json
{
  "from": {},
  "to": {},
  "path_found": true,
  "hop_count": 3,
  "segments": [
    {
      "source": {},
      "relation": "calls",
      "target": {},
      "decision_input_kind": "observed",
      "evidence": []
    }
  ],
  "alternative_matches": [],
  "limitations": []
}
```

Decision boundary:

- Script 只解释图连接路径。
- LLM 决定这条路径对当前任务是否重要。
- 当 `from` 或 `to` 是模糊关键词时，命令返回 `alternative_matches[]`，不能擅自裁决唯一目标。

### crg explain

New command:

```bash
spec-first crg explain --symbol=<symbol_id_or_query> --repo=<target>
```

Intent:

```text
解释单个节点的局部上下文，帮助 LLM 在改动前理解这个 symbol/module 的角色。
```

Output:

```json
{
  "node": {},
  "source": {
    "file_path": "src/example.js",
    "line_start": 10,
    "line_end": 42
  },
  "community": {},
  "degree": {
    "in": 0,
    "out": 0,
    "total": 0
  },
  "neighbors": [],
  "flows": [],
  "candidate_tests": [],
  "decision_input_kind": "observed",
  "limitations": []
}
```

Decision boundary:

- `explain` 不总结业务语义。
- 它只提供图上邻居、社区、flow、测试候选和 source location。
- LLM 如需业务解释，应再读取 source snippet 或相关 docs。

### crg review-context

Existing command to strengthen:

```bash
spec-first crg review-context --since=<git-ref> --repo=<target>
```

Target output additions:

```json
{
  "changed_files": [],
  "changed_nodes": [
    {
      "id": "src/foo.js#function#bar#L10",
      "decision_input_kind": "observed",
      "evidence": ["diff-hunk-overlap"]
    }
  ],
  "hunk_hit_nodes": [
    {
      "id": "src/foo.js#function#bar#L10",
      "decision_input_kind": "observed",
      "evidence": ["line-range-overlap"]
    }
  ],
  "graph_expansion": [
    {
      "id": "src/foo.js#function#caller#L40",
      "relation": "calls",
      "decision_input_kind": "inferred",
      "evidence": ["reverse-call-depth-1"]
    }
  ],
  "affected_flows": [
    {
      "id": "flow:cli-init",
      "decision_input_kind": "inferred",
      "evidence": ["changed-node-in-flow"]
    }
  ],
  "impacted_modules": [],
  "candidate_tests": [
    {
      "file_path": "tests/foo.test.js",
      "decision_input_kind": "inferred",
      "evidence": ["test-imports-changed-module"]
    }
  ],
  "risk_summary": {
    "blast_radius": 0,
    "high_risk_node_count": 0,
    "coverage_gap_count": 0
  },
  "recommended_required_verifications": [],
  "recommended_optional_verifications": [],
  "limitations": []
}
```

Decision boundary:

- Script reports facts and recommendations as decision input.
- LLM decides whether recommended verification is sufficient.
- No new hard gate.

### crg impact

Existing command to strengthen:

```bash
spec-first crg impact --symbol=<symbol_id> --depth=2 --repo=<target>
```

Target output additions:

```json
{
  "symbol": {},
  "depth_used": 2,
  "blast_radius": 0,
  "impacted_nodes": [
    {
      "id": "src/foo.js#function#caller#L40",
      "decision_input_kind": "observed|inferred|ambiguous",
      "evidence": []
    }
  ],
  "impacted_modules": [
    {
      "id": "module:src/foo",
      "decision_input_kind": "inferred",
      "evidence": []
    }
  ],
  "affected_flows": [
    {
      "id": "flow:cli-init",
      "decision_input_kind": "inferred",
      "evidence": []
    }
  ],
  "candidate_tests": [
    {
      "file_path": "tests/foo.test.js",
      "decision_input_kind": "inferred",
      "evidence": []
    }
  ],
  "risk_notes": [],
  "limitations": []
}
```

## Workflow Consumption Design

### spec-plan

Before:

```text
Read task / requirements
  -> local repo research with rg / targeted file reads
  -> infer candidate files from source inspection
  -> write plan
```

Reality note: 当前 `spec-plan` source skill 没有显式调用 `stage0-context` 或 `selected_assets`。上面的 before 表达的是“缺少 graph-native planning anchor”的现状；旧 Stage-0 docs/runtime 是待删除的 legacy bootstrap 面，不是当前 `spec-plan` 已经稳定消费的默认 API。

After:

```text
User task
  |
  v
spec-first crg hook before-plan --task="<task>"
  |
  +-- ready
  |     |
  |     v
  |   hook envelope
  |     -> workflow-context --stage=plan
  |     -> suggested locate / explain / path query plan
  |     |
  |     v
  |   LLM selects candidate change surface
  |
  +-- unavailable
        |
        v
      fallback to direct repo reads
```

Plan document should include:

- candidate change surface
- evidence for each candidate
- assumptions where graph evidence or `decision_input_kind` is weak
- verification plan derived from graph facts

### spec-write-tasks

Before:

```text
Read plan
  -> split implementation units into tasks
  -> task pack may drift into a second plan if it copies scope decisions
```

After:

```text
Read settled plan
  |
  v
Preserve source_plan / source_plan_hash
  |
  +-- optional CRG refs from plan query evidence
  |     -> task context_refs / entry_hint / test_focus only
  |
  v
Write task pack as derived execution index
  |
  v
spec-work later calls:
  spec-first crg hook before-work --task-pack=<tasks.md>
    -> validate source_plan_hash
    -> read planned surface from source plan or sidecar
    -> compress task cards into execution_focus
```

Task pack document must not copy or rewrite `planned_change_surface`. It can mention CRG query refs as context indexes, but scope, acceptance, non-goals and planned surface stay in the source plan.

### spec-work

Before implementation:

```text
Read plan
  -> optionally inspect files
  -> infer blast radius from local source/diff reads
  -> implement
```

After:

```text
Read plan candidate surface
  |
  v
spec-first crg hook before-work --plan=<plan>
  # or: spec-first crg hook before-work --task-pack=<tasks>
  # or: spec-first crg hook before-work --task="<task>"
  -> planned surface check
  -> optional task-pack execution focus
  -> impact suggestions
  -> work_start_ref
  |
  v
Implement
  |
  v
After implementation:
  spec-first crg hook after-work --work-start-ref=<sha>
  # or: spec-first crg hook after-work --since=<base>
    -> review-context summary
    -> compare actual blast radius with planned surface
    -> if expanded, LLM explains whether expansion is valid
```

### spec-code-review

Before:

```text
Review diff + local source reads + reviewer judgment
```

Reality note: 当前 `spec-code-review` source skill 也没有显式读取 Stage-0 selected assets。C1 的变化是新增 `before-review` graph hook 作为低 token 影响面输入，并删除 Stage-0 runtime 默认面，不能把旧 selected assets 当成已存在的 review API。

After:

```text
spec-first crg hook before-review --since=<base>
  # or: spec-first crg hook before-review --work-run=<id>
  # or: spec-first crg hook before-review --work-start-ref=<sha>
  # or: spec-first crg hook before-review --auto-base
  |
  v
Prioritize:
  - hunk_hit_nodes
  - high risk graph_expansion
  - affected_flows
  - coverage gaps
  - candidate_tests missing or stale
  |
  v
Reviewer findings
```

## Cutover Plan

### Cutover Gates

cutover 顺序不按“保留双默认入口窗口”排序，而按“能否一次性形成 query-first 默认闭环”排序：

```text
C0: Contract repositioning
C1: Atomic query-first cutover
C2: Reliability hardening
C3: Navigation polish
C4: Optional report surface
```

`C0` 只能作为 cutover 分支内部的 contract repositioning，不是可独立发布阶段。只改 source skill / docs 并把 Stage-0 标成 retired 时，不能单独运行 `spec-first init --claude|--codex` 同步 runtime mirror，也不能发布一个 source/runtime 已提示 CRG hook、但 `src/crg/cli/router.js` 还没有 `locate/path/explain/workflow-context/hook` 的状态。

`C1` 是唯一用户可见切换点，必须同时覆盖：

```text
graph control-plane in .spec-first/graph
locate / path / explain
impact / review-context
workflow-context --stage=plan|work|review
hook before-plan|before-work|after-work|before-review
spec-plan / spec-write-tasks / spec-work / spec-work-beta / spec-code-review anchors
stage0-context / context-routing / minimal-context default deletion
AI Dev Quality Gate / branch protection / release governance migration
direct-read fallback
```

C1 内部可以按以下 gates 施工，但这些 gates 只是同一分支内的推进顺序，不能拆成独立 release：

```text
C1a: graph control-plane + non-throwing status
C1b: query contracts (locate/path/explain + enhanced impact/review-context)
C1c: lifecycle hooks + planned-surface/task-pack handoff
C1d: Stage-0 deletion + AI Dev Quality Gate / release governance migration
C1e: runtime rebuild + full verification
```

下面的 Workstream A-I（含 H.5 治理迁移切片）是工程施工切片，不代表可以分多次发布兼容层。实际合并策略以 `Rollout Strategy` 为准：C1 必须作为同一 cutover 合并；完整 input detection、高级 shrink health、surprise/gap signals 和 optional report 属于后续增强。

### C1 Merge Gate

Workstream / Unit 可以在同一实现分支内按 commit 或子 PR 施工，但任何 PR / release 不得单独合入 C1 的中间切片。C1 只有在以下硬检查同时满足时才可合并：

- `src/crg/cli/router.js` 暴露 `locate`、`path`、`explain`、`workflow-context`、`hook before-plan`、`hook before-work`、`hook after-work`、`hook before-review`。
- C1a-C1e 内部门禁已在同一 cutover 分支内全部完成，且没有任何中间态单独发布或同步 runtime mirror。
- `spec-first --help`、plugin anchors 和 command manifest 不再列出 `stage0-context` 默认入口。
- `spec-plan`、`spec-write-tasks`、`spec-work`、`spec-work-beta`、`spec-code-review` 的 source skill anchors 全部指向 CRG lifecycle contract 或 task-pack pass-through 语义，不再指向 `stage0-context`、`context-routing` 或裸 `workflow-context`；`spec-write-tasks` 不新增独立 hook，只保留 `source_plan` / `source_plan_hash` 并让 `spec-work` 通过 `before-work --task-pack` 消费。
- `rg 'stage0-context|context-routing|minimal-context|docs/contexts|injection-index.yaml'` 在默认 runtime path、source workflow anchors 和 CLI help 中不命中；允许命中迁移说明、release notes、历史文档和专门防回归测试。
- `.github/workflows/ai-dev-quality-gate.yml`、`src/cli/contracts/quality-gates/branch-protection-policy.json`、`scripts/run-ai-dev-quality-gate.js`、`tests/integration/verification-gate.integration.test.js` 与 `tests/unit/ai-dev-quality-gate.test.js` 已从 Stage-0 path/test list 迁移到 CRG graph/runtime contract tests，不再保护 `src/context-routing/**` 或 `src/cli/commands/stage0-context.js` 作为现行默认面。
- 默认 graph bootstrap 不生成 Stage-0 docs/runtime artifacts；`--report` 只能生成人类审计投影，不作为 hook runtime 输入。
- direct-read fallback denylist 覆盖 sensitive / generated / self-output / runtime mirror / Stage-0 docs 路径，且 fallback 不读取旧 Stage-0 docs。
- graph unavailable 时返回 fallback envelope 和 limitations，不因 `openDb()` 或 query handler 抛错导致 workflow 退出。
- C1 pre-merge query quality acceptance 通过 3 个历史代表任务，记录 `query_hit_rate`、`impact_recall`、`context_token_ratio`；硬门槛是关键候选不漏和 limitations 诚实，precision 只记录不阻塞。
- runtime mirror 只由 source skill / source agent / source CLI 经 `spec-first init --claude|--codex` 或对应 runtime sync 重建；合并前测试只校验 generated marker、source hash 与 drift reporting，不接受手改 mirror 作为真源。
- 合并前必须执行并记录 `npm run typecheck`、`npm run test:ai-dev:gate`、`npm test`、`npm run build`；若某项因环境问题无法执行，必须在 PR / release notes 中写明原因、影响面和替代验证。
- 任何代码或源码文档变动都必须同步更新根目录 `CHANGELOG.md`，记录格式遵循仓库现行格式，用户可见迁移标注 `(user-visible)`。

C1 query quality metrics 口径：

- `query_hit_rate`: 3 个代表任务中，`locate` top-N candidate files/symbols 是否包含人工标注 expected candidates；记录 hit/total 和 miss limitations。
- `impact_recall`: 代表 diff 中，`review-context` / `impact` 是否覆盖人工标注 affected files/tests/flows；C1 硬门槛是不漏 critical affected items。
- `context_token_ratio`: CRG hook/context 输出 token 估算 / baseline token 估算；baseline 可用旧 `stage0-context --format json` 或 naive changed-file context，记录中必须标注采用哪一种 baseline。
- precision 只记录，不作为 C1 阻塞条件；失败样本进入 C2/C3 优化，不在 C1 引入复杂 rerank 或 gate。

### Consistency Cut Lines

为避免方案在实现时重新膨胀，所有阶段必须遵守这些切线：

- **Truth source cut line:** `graph.db` 是代码事实真源；`code-navigation.json` 是低 token dashboard；`graph-report.md` 只能是显式生成的人类审计投影；`docs/contexts` 不再是默认产物或 fallback。
- **Capability cut line:** `graph-index-status.json.capabilities` 表示命令是否可调用，不表示结论可信；可信度必须由 `status`、`freshness`、`decision_input_kind`、`evidence`、`limitations` 共同表达。
- **Index/log cut line:** `code-navigation.json` 是导航 index，`graph-operations.jsonl` 是操作日志；两者帮助 LLM 定位和解释状态，但都不能覆盖 `graph.db` 或变成项目知识库。
- **MVP schema cut line:** schema 可以先稳定，字段可以先为空数组；不为填满 schema 提前实现后续分析能力。
- **LLM boundary cut line:** CLI query 只返回候选、路径、邻居、影响面和证据；是否修改、如何修改、验证是否充分由 LLM 决策。
- **Hook integration cut line:** hooks 是显式 lifecycle context enrichment，不是全局 AOP；skill 拥有 hook point，CRG 拥有 hook handler，LLM 拥有决策权。
- **Reliability cut line:** stale / degraded 时必须诚实降级；不能为了让 workflow 继续显得顺滑而伪造健康 graph。
- **Doctor lint cut line:** `spec-first doctor` 的 graph section 只能输出 lint/report findings，不得阻塞 workflow 或替代 LLM/user 的继续/重建/降级决策。
- **Cutover cut line:** 旧 Stage-0 runtime 只能在 cutover 分支内部作为被替换对象存在；合并后的新架构不允许同时维护 `stage0-context` 与 CRG lifecycle hooks 两套默认入口。

### Direct Cutover Strategy

本方案采用直接替换，不做向下兼容：

```text
Legacy Stage-0 runtime surface to remove
(not the current explicit default call inside spec-plan/spec-work/spec-code-review source skills):
  spec-first stage0-context
    -> context-routing.json
    -> minimal-context/*.json
    -> selected_assets
    -> docs/contexts markdown

New default:
  spec-first crg hook before-plan
  spec-first crg hook before-work / after-work
  spec-first crg hook before-review
    -> spec-first crg workflow-context --stage=plan|work|review
    -> .spec-first/graph/graph-index-status.json
    -> .spec-first/graph/code-navigation.json
    -> locate / path / explain / impact / review-context query results
    -> evidence / limitations / suggested next queries
    -> LLM-selected candidate change surface / verification scope
```

删除边界：

- 同一 cutover 删除 `stage0-context` 作为 `spec-plan` / `spec-write-tasks` / `spec-work` / `spec-work-beta` / `spec-code-review` 默认入口。
- 删除 `src/context-routing/**` 作为默认运行时选择链。
- 删除 `minimal-context/*.json` 作为默认 workflow 输入。
- 删除 `docs/contexts/<slug>/` 和 `injection-index.yaml` 的默认生成。
- 删除 `module-map.md`、`public-entrypoints.md` 作为 workflow 默认上下文资产。

保留边界：

- 保留 direct repo reads fallback：graph unavailable 时，LLM 明确降级到 `rg` / source inspection / targeted file reads。
- 保留显式 report mode：只为人类审计生成 `graph-report.md` 等摘要，不参与默认 workflow。
- 保留 workspace routing 的必要能力，但输出应迁移为 child graph status registry，而不是 child docs registry。

Non-retained surfaces:

- 不保留 `stage0-context` hidden alias。
- 不保留 `context-routing` wrapper。
- 不保留 `minimal-context` reader。
- 不保留 `docs/contexts` fallback reader。
- 不保留 `injection-index.yaml` generator。

### Breaking Cutover Policy

本方案是 breaking cutover，不提供 compatibility alias、wrapper 或旧 docs fallback。发布要求不是兼容旧行为，而是让用户明确知道旧入口已经退役、如何迁移，以及失败时如何恢复工作：

| Old surface | New surface | Migration note |
| --- | --- | --- |
| `spec-first stage0-context --stage plan` | `spec-first crg hook before-plan --task="<task>" --repo=<target>` | planning 入口改为 query-first hook，LLM 选择 candidate change surface |
| `spec-first stage0-context --stage work` | `spec-first crg hook before-work --plan=<plan.md> --repo=<target>` | work 前只消费 structured planned surface 和 CRG decision inputs |
| post-work manual diff inspection | `spec-first crg hook after-work --work-run=<id> --repo=<target>` | after-work 使用持久 work run 或显式 base 计算 actual surface |
| `spec-first stage0-context --stage review` | `spec-first crg hook before-review --since=<base> --repo=<target>` | review 入口改为 `review-context` + risk ordering |
| `docs/contexts/<slug>/` / `injection-index.yaml` | optional `graph-report.md` | 只用于显式人类审计，不再被默认 workflow 读取 |

Release notes 必须声明：

- `stage0-context` CLI 已删除。
- `context-routing`、`minimal-context`、`docs/contexts` 与 `injection-index.yaml` 不再作为默认事实层。
- 已生成的旧 Stage-0 产物可以留在工作区作为历史文件，但新 workflow 不读取它们；需要人类摘要时重新运行显式 report mode。
- graph unavailable 时恢复方式是 direct repo reads fallback 或重建 CRG graph，不是回退到旧 Stage-0 docs。

### Workstream A: Contract Repositioning

Goal: 先在 cutover 分支内改文档和 contract，声明无兼容层的直接切换方向；runtime 行为必须在 C1 集中替换，C0 不能独立发布、不能独立同步 runtime mirror，也不能形成长期 Stage-0 双默认入口窗口。

Files:

- Modify: `skills/spec-graph-bootstrap/SKILL.md`
- Modify: `skills/spec-graph-bootstrap/references/artifact-schemas.md`
- Modify: `skills/spec-graph-bootstrap/references/phase1-crg-extraction.md`
- Modify: `skills/spec-graph-bootstrap/references/phase1-degraded-extraction.md`
- Modify: `docs/contracts/spec-graph-bootstrap/artifact-manifest.schema.json`
- Add: `docs/contracts/spec-graph-bootstrap/graph-index-status.schema.json`
- Add: `docs/contracts/spec-graph-bootstrap/code-navigation.schema.json`
- Test: `tests/unit/spec-graph-bootstrap-contracts.test.js`
- Add: `tests/unit/runtime-mirror-source-hash.test.js`

Work:

- 不手改 `.claude/`、`.codex/`、`.agents/` runtime mirror；source skill、source agent、source CLI 更新后，通过 `spec-first init --claude|--codex` 或对应 runtime sync 重建 mirror。
- 在 `SKILL.md` 顶部明确新定位：`Index once, query on demand, let LLM decide`。
- C0 只允许在 cutover 分支内部删除或标注 retired：`docs/contexts` 默认写入、`stage0-context` 默认入口、`injection-index.yaml` 默认路由、旧 Phase 2-4 docs 主链。不要把这一步作为可发布产物；只有 C1 router / hook / query / deletion / governance migration 全部完成后，才允许重建 runtime mirror 并合并。
- 增加 Graphify-style `Map first, query precisely` 作为消费心智。
- 增加 LLM Wiki-style `build / query / lint` 操作心智，但明确这不是状态机。
- 标注旧 Phase 2-4 为 retired Stage-0 docs/runtime path。
- 定义 `graph-index-status.json` 和 `code-navigation.json` contract。
- 定义 `graph-operations.jsonl` contract。
- 定义 optional `graph-report.md` 的审计摘要定位。
- 标注 `context-routing`、`minimal-context`、`injection-index`、`docs/contexts` 为待删除 Stage-0 runtime，不再作为新 contract 扩展对象。

Verification:

- contract tests 证明 source skill 包含 query-first 定位和 graph truth boundary。
- C0 contract tests 只能作为 cutover 分支内部检查；不得把“source 已指向 CRG、runtime CLI 尚不可用”的状态发布给用户。
- runtime mirror tests 只验证 generated marker、source hash 与 drift reporting；mirror 不是可编辑真源。
- schema tests 证明新增 artifact 字段合法，并能拦住重新把 docs/context-routing 当默认事实层的回归。

### Workstream B: Input Detection and Freshness Layer

Goal: 借鉴 Graphify `detect.py`，在建图前先明确输入面和索引可信度。

Stage: C2 reliability hardening。C1 cutover 只实现最小 `status` / `freshness.state` honesty 与 fallback suggested reads 安全过滤；本 workstream 不作为 Atomic Query-First Cutover 前置。

Files:

- Add: `src/crg/commands/detect-inputs.js`
- Modify: `src/crg/input-convergence.js`
- Modify: `src/crg/incremental.js`
- Modify: `src/crg/artifact-paths.js`
- Test: `tests/unit/crg-input-convergence.test.js`
- Test: `tests/unit/crg-incremental.test.js`
- Test: `tests/e2e/crg-sqlite-audit.sh`

Work:

- 识别 code/test/generated/config/docs/sensitive。
- 跳过 `.spec-first/graph/` 与其他生成输出，避免自索引。
- 使用 repo-relative path + content hash 作为 fingerprint。
- 在 C1 最小 shrink guard 基础上增加显式 prune intent、分层阈值和更细 last-known-good diagnostics。

Verification:

- 敏感文件不会进入索引候选。
- 生成输出不会被再次索引。
- 无显式 prune intent 时，异常缩小的 graph 继续不覆盖 last-known-good，并给出更具体的 degraded reason。

### Workstream C: Graph-Ready Default Path

Goal: 让默认 bootstrap 只跑图索引 ready 主链，并停止生成 Stage-0 docs/runtime artifacts。

Files:

- Modify: `src/bootstrap-compiler/run-bootstrap.js`
- Modify: `src/bootstrap-compiler/compile-machine-artifacts.js`
- Modify: `src/bootstrap-compiler/orchestrator.js`
- Modify: `src/bootstrap-compiler/schema-loader.js`
- Modify: `src/crg/cli/build.js`
- Modify: `src/crg/cli/context.js`
- Modify: `src/crg/generations/paths.js`
- Modify: `src/crg/generations/health.js`
- Add: `src/crg/operations-log.js`
- Modify: `src/cli/commands/doctor.js`
- Test: `tests/unit/spec-graph-bootstrap-compiler.test.js`
- Test: `tests/e2e/spec-graph-bootstrap-mainline.sh`

Work:

- 新增或复用 CRG stats/context 输出生成 `graph-index-status.json`。
- 生成轻量 `code-navigation.json`。
- 写入轻量 `graph-operations.jsonl`，cutover 只记录 build/promote/degrade/workflow-context fallback，不记录源码正文或绝对路径。
- core graph build 与 derived signals 分层：nodes/edges/fingerprints 是 primary graph；FTS/flows/communities 是 postprocess 派生信号。派生步骤失败只能写 warnings/limitations 和 capability degraded，不得丢弃 primary graph。
- 从现有 `current.json` / `last-known-good.json` / `resolveActiveGraphDb` 派生 active graph 状态；cutover 不新增并行 graph pointer。
- C1 实现最小 shrink guard：rebuild 后 node/edge count 异常下降且没有显式 prune/delete intent 时，不 promote 新 generation，保留 last-known-good，并写入 `status: degraded` 与 limitation。
- 若 graph missing 或 native module missing，graph-ready writer 写 `status: missing|unavailable`，不调用会直接 exit 的 query handler。
- 默认不生成 `fact-inventory.json` / `risk-signals.json` / `test-surface.json` / `context-routing.json` / `minimal-context/*.json`。
- 默认不生成 `docs/contexts` 和 `injection-index.yaml`。
- schema loader 默认路径切到 graph schemas；Stage-0 schemas 若仍短暂存在，只能服务历史 fixture 读取或 deletion contract test，不作为默认 compiler 必需项。
- `doctor` 的 bootstrap contract 检查改为 graph contract 检查：graph status、capabilities、freshness、limitations。
- report mode 另行显式执行，不影响默认 mainline。

Verification:

- 首次运行能构建 graph 并写入 graph status。
- build/promote/degrade/workflow-context fallback 会追加 `graph-operations.jsonl`；cutover 不要求 `doctor` 写日志。
- graph stale 时能提示 rebuild。
- FTS/flows/communities 任一派生步骤失败时，graph status 保留 primary graph 可用性，并在 capabilities/limitations 中诚实降级。
- 异常 partial graph rebuild 不会覆盖 last-known-good。
- 不请求 report mode 时不要求任何 Stage-0 fixed assets 存在。
- `doctor` 不再要求 `artifact-manifest.outputs` 包含 `context-routing` 或 `minimal-context`。

### Workstream D: Strengthen review-context and impact

Goal: 让已有 diff 和单点 symbol 都能产生足够决策输入。

Files:

- Modify: `src/crg/commands/review-context.js`
- Modify: `src/crg/commands/impact.js`
- Modify: `src/crg/changes.js`
- Modify: `src/crg/cli/router.js`
- Test: `tests/unit/crg-review-context-hunks.test.js`
- Test: `tests/unit/crg-impact-cte.test.js`
- Test: `tests/unit/crg-bfs-queue-source.test.js` (fallback/helper coverage only)
- Test: `tests/contracts/crg-cli-v1.test.js`
- Test: `tests/e2e/crg-all-commands.sh`

Work:

- `review-context` 增加 `affected_flows`。
- `review-context` 增加 `impacted_modules`。
- `review-context` 输出聚合 `risk_summary`。
- `impact` 增加 flow/test/module 聚合。
- `review-context.changed_nodes` 优先来自 hunk overlap；文件级节点只进入 `changed_file_nodes` 或 fallback，并通过 limitation 表达降级。
- `impact` 与 `review-context.graph_expansion` 默认使用 SQLite recursive CTE 扩展 graph，不在 JS 内存构造全量邻接图；输出 `max_depth`、`truncated`、`total_impacted`、`returned_count`。
- 统一 `limitations[]` 字段。
- `review-context` 的 `changed_nodes`、`hunk_hit_nodes`、`graph_expansion`、`affected_flows`、`candidate_tests` 每项都必须携带 `decision_input_kind` 与 `evidence[]`。
- `impact` 的 `impacted_nodes`、`impacted_modules`、`affected_flows`、`candidate_tests` 每项都必须携带 `decision_input_kind` 与 `evidence[]`。

Verification:

- 修改一个被调用函数 hunk 时，`review-context.changed_nodes` 只包含 hunk overlap nodes，`changed_file_nodes` 可包含同文件上下文。
- 修改一个被调用函数时，`review-context` 能返回 2-hop caller expansion，并在截断时返回 `truncated` 与 `total_impacted`。
- 修改核心 flow 节点时，`affected_flows` 非空。
- 对无 flow 的库项目，输出 `limitations[]`，不伪造 flow。

### Workstream E: Add locate/path/explain Query

Goal: 支持没有 diff 的新任务定位候选修改面，并支持 explain/path 两类解释型图导航。

Files:

- Add: `src/crg/commands/locate.js`
- Add: `src/crg/commands/path.js`
- Add: `src/crg/commands/explain.js`
- Modify: `src/crg/cli/router.js`
- Modify: `src/crg/search.js`
- Add: `docs/contracts/crg-cli-v1.schema.json`
- Test: `tests/contracts/crg-cli-v1.test.js`
- Test: `tests/unit/crg-detail-profile.test.js`
- Test: `tests/e2e/crg-all-commands.sh`

Work:

- 聚合 FTS search、context top nodes、flows、communities。
- `locate` 排序借鉴 code-review-graph 的 FTS + fallback + boost：exact path/symbol match > FTS name match > retrieval_text match；changed files、candidate tests、risk paths 可加权；多候选时输出 alternatives 和 `decision_input_kind: ambiguous`，不强选业务结论。
- 新增 `docs/contracts/crg-cli-v1.schema.json` 作为 CLI envelope 与 query payload contract source，并让 `tests/contracts/crg-cli-v1.test.js` 校验 schema；不要让 Jest shape 断言成为唯一事实源。
- 输出候选 symbol/file/module/flow。
- 为每条候选保留 `evidence[]` 和 `score`。
- 统一输出 `decision_input_kind`。
- `path` 输出 shortest path + alternative matches。
- `explain` 输出 node neighborhood + community + flows + candidate tests。
- `locate` / `path` / `explain` / `search` / router 支持 `--detail=minimal|standard`；`minimal` 不输出长 evidence、edge detail 或完整 path segments，`standard` 保留 item-level evidence、edge/path details 和 score breakdown。
- 加 `limitations[]`，说明 lexical match 的局限。

Verification:

- 查询一个已知 symbol 名称时能返回该 symbol。
- 查询一个模块路径关键词时能返回对应 community/module。
- exact path/symbol match 排在普通 retrieval_text match 之前；context boost 只影响排序，不改变 evidence 语义。
- `path` 能解释两个可匹配节点的连接路径。
- `explain` 能返回单节点邻居、source location 与社区。
- contract tests 验证 `minimal` / `standard` 输出差异，且 `minimal` 不恢复旧 `minimal-context` 语义。
- 查询无匹配时返回空候选和 limitation，不退出为失败。

### Workstream F: Analysis Signals and Suggested Queries

Goal: 将 Graphify 的 god nodes / surprising connections / suggested questions 思路转化为 CRG 导航信号。

Files:

- Modify: `src/crg/analyze.js`
- Modify: `src/crg/cli/context.js`
- Modify: `src/bootstrap-compiler/compile-machine-artifacts.js`
- Modify: `docs/contracts/spec-graph-bootstrap/code-navigation.schema.json`
- Test: `tests/unit/crg-analyze.test.js`
- Test: `tests/unit/spec-graph-bootstrap-compiler.test.js`

Work:

- `code-navigation.json` 增加 `surprising_connections`。
- 增加 `thin_communities`，提示社区过薄或边不足。
- 增加 `ambiguous_edges`，标注低置信度或多候选关系。
- 增加 `suggested_queries`，例如“解释某 hub 的影响面”“查看某两个模块之间路径”。

Verification:

- 结构边如 `contains` 不应污染 surprise。
- 跨社区、高 fan-in 或低置信度关系能进入导航信号。
- suggested queries 是建议，不阻断任何 workflow。

### Workstream G: Atomic Workflow Cutover

Goal: 在同一 cutover 中让 `spec-plan`、`spec-write-tasks`、`spec-work`、`spec-work-beta`、`spec-code-review` 默认通过显式 lifecycle hooks 或 task-pack pass-through 使用 CRG context，并删除对 `stage0-context` 的默认依赖。不发布 plan/tasks 仍走 Stage-0、work/review 走 CRG 的混合状态。

Files:

- Add: `src/crg/commands/workflow-context.js`
- Add: `src/crg/commands/hook.js`
- Add: `src/crg/hooks/before-work.js`
- Add: `src/crg/hooks/after-work.js`
- Add: `src/crg/hooks/before-review.js`
- Add: `src/crg/hooks/before-plan.js`
- Add: `src/crg/diff-base.js` or `src/cli/shared-diff-base.js`
- Add: `src/crg/work-runs.js`
- Add: `docs/contracts/crg/context-hooks.md`
- Add: `src/crg/workflow-context/status.js`
- Add: `src/crg/workflow-context/navigation.js`
- Add: `src/crg/workflow-context/stage.js`
- Modify: `src/crg/cli/router.js`
- Modify: `src/cli/plugin.js`
- Modify: `src/cli/index.js`
- Modify: `skills/spec-plan/SKILL.md`
- Modify: `skills/spec-write-tasks/SKILL.md`
- Modify: `skills/spec-write-tasks/references/task-pack-schema.md`
- Modify: `skills/spec-work/SKILL.md`
- Modify: `skills/spec-work-beta/SKILL.md`
- Modify: `skills/spec-code-review/SKILL.md`
- Test: `tests/unit/spec-plan-contracts.test.js`
- Test: `tests/unit/spec-write-tasks-contracts.test.js`
- Test: `tests/unit/spec-work-contracts.test.js`
- Test: `tests/unit/spec-work-beta-contracts.test.js`
- Test: `tests/unit/spec-code-review-contracts.test.js`
- Test: `tests/unit/crg-work-runs.test.js`
- Test: `tests/unit/crg-detail-profile.test.js`
- Add/Modify: `tests/unit/runtime-mirror-source-hash.test.js`

Work:

- cutover 新增固定 lifecycle hooks：`before-plan`、`before-work`、`after-work`、`before-review`。
- hook handler 内部复用 `workflow-context` 和 query commands；不要让每个 skill 自己拼 graph status、fallback、query 输出。
- cutover 新增 `spec-first crg workflow-context --stage=plan|work|review` 作为 hook handler 的底层 envelope。
- 输出 shape 必须符合本方案的 `crg workflow-context output` contract，不能重新引入 `selected_assets`。
- `workflow-context/status.js` 先检查 graph pointer、DB 文件、native module availability 和 artifact freshness；不要复用 `openDb()` 作为第一步，避免 graph missing 时无法返回 fallback envelope。
- `spec-plan`：增加极薄 `before_plan` hook anchor，hook 通过 workflow-context 获取 graph status、code navigation、locate/explain/path suggested queries，再由 LLM 写 candidate change surface。
- `spec-write-tasks`：不新增独立 CRG hook；task pack schema 明确 `source_plan` / `source_plan_hash` 是唯一 plan handoff，CRG query 只能进入 task `context_refs` / `entry_hint` / `test_focus`，不能改变 scope、验收标准或 planned surface。
- `spec-work` / `spec-work-beta`：增加极薄 `before_work` / `after_work` hook anchor，hook 获取 structured planned surface check、`work_run_id`、`work_start_ref`、impact 建议和 post-change `review-context`。
- `before-work --task-pack=<tasks.md>` 解析 task pack frontmatter，校验 `source_plan_hash`，将 task cards 压缩为 `execution_focus`，再回到 source plan sentinel 或 `--planned-surface` 读取 planned surface。
- `before-work` 写 `.spec-first/graph/work-runs/<run_id>.json`，`after-work` 优先接收 `--work-run=<id>`，避免 session interruption / delegation / resume 丢失 diff base。
- `before-work --plan=<plan.md>` 只读取唯一 sentinel 包裹的 `planned_change_surface` JSON block；缺失时写 `planned-surface-missing` limitation，多块写 `planned-surface-ambiguous` limitation，JSON/schema 失败写 invalid limitation。需要外部 handoff 时使用 `--planned-surface=<path>`。
- `spec-code-review`：增加极薄 `before_review` hook anchor，hook 获取 `review-context` 摘要，以 graph expansion 和 affected flows 排序审查重点。
- `workflow-context` 与 `hook` 接受并传播 `detail_profile`，默认 `minimal`；当 LLM 需要具体解释时，`recommended_queries` 指向 `--detail=standard` 或更窄 query，而不是默认输出大上下文。
- `after-work` / `before-review` 复用共享 diff base resolver；无法解析 base 时返回 fallback envelope，不让 `review-context` 直接退出。
- `src/cli/plugin.js` 高价值 anchors 一次性补到 `crg hook ...`；如果实现时发现 legacy Stage-0 wording，则同一 cutover 删除。需要底层事实时再由 hook 调 `workflow-context`，不要让 plugin anchor 直接指向裸 `workflow-context`。
- `src/cli/index.js` 同一 cutover 删除 `stage0-context` command registration 和 help 文案；不保留 `spec-plan` 过渡窗口。
- graph unavailable fallback 改为 direct repo reads，不再 fallback 到 Stage-0 docs。
- 不引入全局隐式 hook、自动 prompt 注入、hook rules engine 或 hooks.yaml；只实现固定 hook CLI。
- 不手改 `.claude/`、`.codex/`、`.agents/` runtime mirror；source skill 和 CLI anchor 更新后，通过 `spec-first init --claude|--codex` 或对应 runtime sync 重建 mirror。

Verification:

- workflow skill contract 明确“查询结果是决策输入，不是强制结论”。
- workflow skill contract 只增加薄 hook anchor，完整 hook envelope 语义集中在 `docs/contracts/crg/context-hooks.md`。
- `spec-write-tasks` contract 明确 task pack 是派生工件，不新增 CRG hook、不复制 planned surface；stale task pack 必须触发重建或回到 source plan。
- graph unavailable 时能走 direct-read fallback，且输出明确说明未使用 CRG 事实。
- `before-work` 生成 work run artifact，`after-work --work-run=<id>` 能稳定解析同一 start ref。
- `before-work --task-pack=<tasks.md>` 在 hash 匹配时返回 execution_focus，在 hash 不匹配时返回 `task-pack-stale` limitation，不把 stale tasks 当计划事实。
- planned surface 缺失时返回 limitation，不解析 markdown prose。
- hook / workflow-context contract tests 验证默认 `detail_profile: minimal`，显式 standard 能传入下游 query，且 minimal 不读取旧 `minimal-context`。
- plan/tasks/work/work-beta/review anchors 全部不再包含 `stage0-context`。
- runtime mirror 测试只验证 generated marker、source hash 和 drift reporting，不把 mirror 当手改目标。

### Workstream H: Remove Stage-0 Runtime and Human Docs Default

Goal: 删除旧 Stage-0 runtime 选择链和 human docs 默认链路。

Files:

- Modify: `skills/spec-graph-bootstrap/SKILL.md`
- Modify: `src/bootstrap-compiler/compile-human-assets.js`
- Modify: `src/bootstrap-compiler/compile-routing.js`
- Modify: `src/cli/index.js`
- Delete: `src/cli/commands/stage0-context.js`
- Delete: `src/context-routing/evaluator.js`
- Delete: `src/context-routing/fallback.js`
- Delete: `src/context-routing/priority.js`
- Delete: `src/context-routing/profiles.js`
- Migrate then delete remaining `src/context-routing/*.js`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Test: `tests/smoke/cli.sh`
- Test: `tests/e2e/spec-graph-bootstrap-installed-runtime.sh`

Work:

- 明确 `$spec-graph-bootstrap` 默认只建立图索引与 query control plane。
- 删除 `stage0-context` CLI help、plugin anchors、README 现行描述。
- 将 `change-surface`、verification summary 中仍有价值的 deterministic 逻辑先迁移到 `src/crg/workflow-context`、`src/crg/changes` 或 `src/verification/*`，再删除旧 `src/context-routing/**` 域。
- 删除 `context-routing` 的 selected assets / fallback L0-L3 语义。
- 显式 report mode 可生成 `graph-report.md`，但不生成旧 `injection-index.yaml`。
- README 解释 fallback 是 direct repo reads，不是旧 Stage-0 docs。

Verification:

- CLI/help/runtime 文案不再出现 `stage0-context` 作为推荐入口。
- installed runtime skill 明确 query-first、direct reads fallback 与 optional report mode。
- C1 合并前 `rg \"require\\(['\\\"].*context-routing|from .*context-routing|src/context-routing\" src skills agents README.md README.zh-CN.md` 不应命中任何默认 runtime path；若仍有通用 helper 价值，必须已迁移到非 Stage-0 模块。
- 删除旧 `docs/contexts` 后默认 workflow 仍能 plan/tasks/work/review。

### Workstream H.5: Migrate AI Dev Quality Gate and Release Governance

Goal: 把当前仍保护 Stage-0 runtime 的质量门禁、branch policy 与发布治理迁移到 CRG graph/runtime contract。这个 workstream 属于 C1d，必须与 Stage-0 删除同一 cutover 合并，不能留一个 CI 仍要求 `stage0-context` / `context-routing` 的发布状态。

Files:

- Modify: `.github/workflows/ai-dev-quality-gate.yml`
- Modify: `src/cli/contracts/quality-gates/branch-protection-policy.json`
- Modify: `scripts/run-ai-dev-quality-gate.js`
- Modify: `tests/integration/verification-gate.integration.test.js`
- Modify: `tests/unit/ai-dev-quality-gate.test.js`
- Modify/Delete: `tests/unit/stage0-context-command.test.js`
- Modify/Delete: `tests/unit/context-routing-evaluator.test.js`
- Modify/Delete: Stage-0-only quality feedback / verification helper tests after useful deterministic helpers move to `src/crg/*` or `src/verification/*`

Work:

- Workflow path filters 从 `src/context-routing/**`、`src/cli/commands/stage0-context.js` 迁移到 `src/crg/**`、`docs/contracts/crg/**`、`docs/contracts/spec-graph-bootstrap/graph-index-status.schema.json`、`docs/contracts/spec-graph-bootstrap/code-navigation.schema.json`、workflow source skills、plugin anchor surfaces 和 runtime governance contracts。
- Branch protection policy 的 protected paths / required evidence 从 Stage-0 contracts 改为 CRG hook/query/default-bootstrap contracts。
- `scripts/run-ai-dev-quality-gate.js` 不再 hard-code `stage0-context` unit tests；改为运行 CRG CLI contract、workflow hook contract、runtime mirror source-hash、graph bootstrap default-path、fallback safety 和 governance migration tests。
- `tests/integration/verification-gate.integration.test.js` 不再断言 workflow 监听 Stage-0 paths；改断言监听 CRG graph/runtime contracts，并继续保护 quality-gate contract 自身。
- `tests/unit/ai-dev-quality-gate.test.js` 的 artifact / junit / topics 命名从 `stage0-contracts` 迁移为 `crg-runtime-contracts` 或类似中性名称。
- 若 `src/context-routing/quality-feedback.js`、verification helpers 仍有通用价值，先移动到 `src/verification/*` 或 `src/crg/verification/*`；否则连同 Stage-0 tests 删除。
- `package.json` 中保留 `test:ai-dev:gate` 入口，但其语义改为保护 CRG runtime/default workflow contracts，而不是 Stage-0 contracts。

Verification:

- AI Dev Quality Gate workflow 不再监听或要求 `src/context-routing/**`、`src/cli/commands/stage0-context.js`、`tests/unit/stage0-context-command.test.js`。
- Branch protection policy 不再把 Stage-0 runtime path 当现行 protected surface。
- `node scripts/run-ai-dev-quality-gate.js` 运行的 focused test list 全部指向 CRG / hook / runtime mirror / fallback / governance contract。
- `tests/integration/verification-gate.integration.test.js` 和 `tests/unit/ai-dev-quality-gate.test.js` 断言新的 CRG quality-gate surface。
- C1 合并前 `npm run test:ai-dev:gate`、`npm run typecheck`、`npm test`、`npm run build` 均有记录。

### Workstream I: Optional Graph Report Projection

Goal: 为人类审计和方案复盘提供显式 graph report 投影，但不把 report 变成 workflow runtime 输入。

Files:

- Add/Modify: `src/crg/commands/report.js`
- Modify: `src/crg/cli/router.js`
- Modify: `skills/spec-graph-bootstrap/SKILL.md`
- Test: `tests/unit/crg-report-contracts.test.js`

Work:

- `spec-first crg report` 或 `$spec-graph-bootstrap --report` 显式生成 `graph-report.md`。
- report 只汇总 `code-navigation.json`、graph status、limitations、suggested queries 和人工审计摘要。
- report 不作为 hook / workflow-context fallback 输入，不替代 `graph.db`、`code-navigation.json` 或 CLI query。
- report 输出必须经过 sensitive / generated / self-output / runtime mirror 过滤，不返回源码正文或 secret-like literal。

Verification:

- graph unavailable 时 report 返回 limitations，不伪造健康 graph。
- sensitive 文件、生成输出和 `.spec-first/**` 不进入 report suggested reads。
- workflow-context / hook 不读取 `graph-report.md` 作为 runtime fallback。
- CLI-first 路径不依赖 report。

## Detailed Implementation Units

### Unit 1: Reframe spec-graph-bootstrap source contract

**Goal:** 把 skill 顶层定位改成 CRG graph index console。

**Requirements:** R1, R2, R8, R9

**Files:**

- Modify: `skills/spec-graph-bootstrap/SKILL.md`
- Modify: `tests/unit/spec-graph-bootstrap-contracts.test.js`
- Add/Modify: `tests/unit/runtime-mirror-source-hash.test.js`

**Approach:**

- 不手改 `.claude/`、`.codex/`、`.agents/` runtime mirror；本 unit 只改 source skill 与测试，runtime 由 `spec-first init --claude|--codex` 或对应 runtime sync 重建。
- 增加 `Core Positioning`：
  - `CRG graph index first`
  - `On-demand query over static docs`
  - `LLM decides semantic change meaning`
- 将旧 Phase 2-4 标注为 retired Stage-0 docs/runtime path。
- 明确删除旧默认流程，而不是只调整优先级。

**Test scenarios:**

- source skill 包含 `graph.db is code-facts source of truth` 语义。
- runtime mirror rebuild 后带 generated marker / source hash，并能报告 source 与 mirror drift。
- 若 source skill 仍把 `docs/contexts` 或 `stage0-context` 描述为默认入口，contract test 失败。

### Unit 2: Add graph index control-plane artifacts

**Goal:** 提供 graph ready 的 machine-readable 状态面板。

**Requirements:** R2, R3, R10

**Files:**

- Add: `docs/contracts/spec-graph-bootstrap/graph-index-status.schema.json`
- Add: `docs/contracts/spec-graph-bootstrap/code-navigation.schema.json`
- Modify: `skills/spec-graph-bootstrap/references/artifact-schemas.md`
- Modify: `src/bootstrap-compiler/compile-machine-artifacts.js`
- Test: `tests/unit/spec-graph-bootstrap-contracts.test.js`
- Test: `tests/unit/spec-graph-bootstrap-compiler.test.js`

**Approach:**

- 先从已有 `crg stats` / `crg context` 结果派生。
- 不在 artifact 内嵌全量 symbol。
- 支持 graph unavailable 状态。
- C1 最小承接 `entrypoints`、`test_roots`、`high_risk_nodes`、`top_communities`、`top_flows`、`query_starters`；无法派生时必须写入 limitations。

**Test scenarios:**

- graph ready 输出 `status=ready` 和 stats。
- graph missing 输出 `status=missing`，capabilities false 或 degraded。
- context 无 flows 时通过 `limitations[]` 表达，不失败。
- compiler test 断言 `code-navigation.entrypoints`、`test_roots`、`high_risk_nodes` 存在，或有明确 limitations 解释缺失。
- workflow/review contract test 断言 `review-context.risk_summary`、`review-context.candidate_tests` 与 `workflow-context.review.verification_focus` 能从 C1 最小字段承接。

### Unit 3: Make bootstrap default graph-ready

**Goal:** 默认路径只生成 CRG query-first control plane，不再生成旧 Stage-0 docs/runtime artifacts。

**Requirements:** R1, R8, R10

**Files:**

- Modify: `src/bootstrap-compiler/run-bootstrap.js`
- Modify: `src/bootstrap-compiler/orchestrator.js`
- Modify: `tests/e2e/spec-graph-bootstrap-mainline.sh`
- Modify: `src/cli/commands/doctor.js`

**Approach:**

- 默认 mainline 只断言 `graph-index-status.json`、`code-navigation.json` 和必要 manifest。
- 默认不写 `fact-inventory.json`、`risk-signals.json`、`test-surface.json`、`context-routing.json`、`minimal-context/*.json`、`docs/contexts`、`injection-index.yaml`。
- `doctor` 检查 graph contract，不再检查 Stage-0 bootstrap contract。

**Test scenarios:**

- 默认运行不生成 Stage-0 docs/runtime artifacts 也算成功。
- CLI/help 不再承诺 report mode 生成旧文档树。
- graph build 失败时 status 为 degraded/unavailable，并保留明确原因。

### Unit 4: Strengthen review-context as diff blast-radius entry

**Goal:** 修改后可以稳定回答影响范围和验证面。

**Requirements:** R4, R7, R11

**Files:**

- Modify: `src/crg/commands/review-context.js`
- Modify or move: `src/context-routing/change-surface.js` → `src/crg/changes.js`
- Modify: `tests/unit/crg-review-context-hunks.test.js`
- Modify: `tests/contracts/crg-cli-v1.test.js`

**Approach:**

- `changed_nodes` 只表示 diff hunk overlap 命中的节点；同文件但未命中的节点进入 `changed_file_nodes` 或 context，hunk 不可用时写 limitation 并降级。
- `graph_expansion` 默认用 SQLite recursive CTE 做 2-hop caller/import expansion，避免在 JS 内存构造全图邻接表。
- 在现有 changed nodes / graph expansion 基础上补 affected flows。
- 汇总 impacted modules 和 risk summary。
- 将 verification recommendation 作为 decision input，保持 advisory。

**Test scenarios:**

- diff 命中函数 hunk 时，`hunk_hit_nodes` 包含该函数。
- diff 只改同文件一个函数时，`changed_nodes` 不包含未命中 hunk 的兄弟函数；`changed_file_nodes` 可包含它们作为上下文。
- caller 2-hop 扩展按 risk score 排序，并在超过上限时返回 `truncated` / `total_impacted`。
- changed node 参与 flow 时，`affected_flows` 包含对应 flow。
- `changed_nodes`、`hunk_hit_nodes`、`graph_expansion`、`affected_flows`、`candidate_tests` 每项都携带 `decision_input_kind` 与 `evidence[]`。
- 无测试候选时输出 coverage gap / limitation。

### Unit 5: Strengthen impact as symbol blast-radius entry

**Goal:** 单 symbol 影响分析输出 LLM 可直接消费的压缩面。

**Requirements:** R5, R11

**Files:**

- Modify: `src/crg/commands/impact.js`
- Add: `tests/unit/crg-impact-cte.test.js`
- Modify: `tests/unit/crg-bfs-queue-source.test.js` (fallback/helper coverage only)
- Modify: `tests/e2e/crg-all-commands.sh`

**Approach:**

- 默认用 SQLite recursive CTE 执行 reverse impact traversal；现有 reverse BFS 只作为 fallback / 单测 helper，不作为大图默认路径。
- `tests/unit/crg-impact-cte.test.js` 作为默认 traversal 的主测试；`crg-bfs-queue-source.test.js` 只保留 fallback/helper 覆盖，不作为 impact command 主路径验收。
- 增加 module 聚合。
- 增加 affected flows 查询。
- 增加 candidate tests。
- 输出 `max_depth`、`truncated`、`total_impacted`、`returned_count` 和 limitations。

**Test scenarios:**

- 输入合法 symbol 返回 blast radius。
- 输入高 fan-in symbol 返回 impacted modules。
- 输入高 fan-in symbol 且超过返回上限时，输出截断元数据，不静默丢结果。
- 输入不在 flow 中的 symbol 返回 empty affected flows + limitation。
- `impacted_nodes`、`impacted_modules`、`affected_flows`、`candidate_tests` 每项都携带 `decision_input_kind` 与 `evidence[]`。

### Unit 6: Add locate/path/explain queries

**Goal:** 新需求无 diff 时能快速获得候选修改点，并能解释节点与路径关系。

**Requirements:** R6, R7, R9, R11, R12

**Files:**

- Add: `src/crg/commands/locate.js`
- Add: `src/crg/commands/path.js`
- Add: `src/crg/commands/explain.js`
- Modify: `src/crg/cli/router.js`
- Modify: `src/crg/search.js`
- Add: `docs/contracts/crg-cli-v1.schema.json`
- Add: `tests/unit/crg-detail-profile.test.js`
- Modify: `tests/contracts/crg-cli-v1.test.js`
- Modify: `tests/e2e/crg-all-commands.sh`

**Approach:**

- 当前 router 已有 `query` / `search` / `context`，但没有 `locate` / `path` / `explain`。cutover 新命令应优先复用现有 FTS、context、nodes/edges 查询能力，不重写第二套 retrieval。
- 初版只做 deterministic 查询聚合。
- `locate` 排序使用 deterministic boost：exact path/symbol match > FTS name match > retrieval_text match；changed files、candidate tests、risk paths 可加权，但必须在 `evidence[]` / score breakdown 中说明来源。
- 关键词来源由 LLM 在 workflow 中提取，命令只接收 query 字符串。
- 结果按 score 排序，保留 evidence。
- `path` 使用 shortest path，返回 segments 与 relation `decision_input_kind`。
- `explain` 返回 source location、community、degree、neighbors、flows、candidate tests。
- 多匹配时返回 alternatives，不擅自选唯一业务结论。
- `--detail=minimal|standard` 由 router 统一解析并传给 locate/path/explain/search；minimal 只保留候选摘要、短 evidence summary 和 limitations，standard 才返回完整 item-level evidence、path segments、edge details 与 score breakdown。

**Test scenarios:**

- 查询文件名关键词返回对应 file candidate。
- 查询 symbol 名称返回 symbol candidate。
- 查询 community 相关路径返回 module/community candidate。
- exact path/symbol match 排在普通 retrieval_text match 之前。
- 两个连通 symbol 返回 path。
- 不连通 symbol 返回 no-path limitation。
- explain 返回 node neighborhood。
- 模糊 query 返回 alternatives。
- detail profile 覆盖 minimal/standard 输出差异、非法 detail 参数报错语义，以及 minimal 不触发旧 `minimal-context` 路径。
- 无结果不报错。

### Unit 6.5: Add direct-read fallback suggested_reads filter

**Goal:** 在 C1 cutover 内补齐最小 fallback 安全过滤，不等待完整 input detection。

**Requirements:** R13

**Files:**

- Add: `src/crg/workflow-context/suggested-reads-filter.js`
- Modify: `src/crg/commands/workflow-context.js`
- Modify: `src/crg/commands/hook.js`
- Modify: `tests/unit/crg-workflow-context-fallback.test.js`

**Approach:**

- 过滤只处理 fallback suggested reads，不承担完整 graph input classification。
- denylist 覆盖 `.env*`、credential/secret/private-key、`.spec-first/**`、`.claude/**`、`.codex/**`、`.agents/**`、`docs/contexts/**`、generated output 和 Stage-0 docs/runtime 路径。
- 输出只保留少量 repo-relative paths 或 query hints；被过滤项只计入 `limitations[]`，不打印敏感路径正文。
- C2 的 `detect-inputs` 可以复用同一 denylist，但不得反向要求 C1 实现完整输入检测。

**Test scenarios:**

- graph unavailable fallback 不建议读取 `.agents/**`、`.codex/**`、`.claude/**`、`.spec-first/**` 或 `docs/contexts/**`。
- fallback 对 `.env.local`、`private-key.pem`、`credentials.json` 等路径只写 limitation，不输出为 suggested read。
- 正常源码路径仍可作为 suggested read 返回。

### Unit 7: Replace workflow consumption with CRG lifecycle hooks

**Goal:** 后续 workflow 通过显式 lifecycle hooks 或 task-pack pass-through 使用 CRG workflow-context 和查询结果做默认输入，并在同一 cutover 移除 `stage0-context` 默认入口。

**Requirements:** R7, R9, R10, R18

**Files:**

- Add: `src/crg/commands/workflow-context.js`
- Add: `src/crg/commands/hook.js`
- Add: `src/crg/hooks/before-work.js`
- Add: `src/crg/hooks/after-work.js`
- Add: `src/crg/hooks/before-review.js`
- Add: `src/crg/hooks/before-plan.js`
- Add: `src/crg/diff-base.js` or `src/cli/shared-diff-base.js`
- Add: `src/crg/work-runs.js`
- Add: `docs/contracts/crg/context-hooks.md`
- Add: `src/crg/workflow-context/status.js`
- Add: `src/crg/workflow-context/navigation.js`
- Add: `src/crg/workflow-context/stage.js`
- Modify: `src/crg/cli/router.js`
- Modify: `src/cli/plugin.js`
- Modify: `skills/spec-plan/SKILL.md`
- Modify: `skills/spec-write-tasks/SKILL.md`
- Modify: `skills/spec-write-tasks/references/task-pack-schema.md`
- Modify: `skills/spec-work/SKILL.md`
- Modify: `skills/spec-work-beta/SKILL.md`
- Modify: `skills/spec-code-review/SKILL.md`
- Modify: `tests/unit/spec-plan-contracts.test.js`
- Add/Modify: `tests/unit/spec-write-tasks-contracts.test.js`
- Modify: `tests/unit/spec-work-contracts.test.js`
- Modify: `tests/unit/spec-work-beta-contracts.test.js`
- Modify: `tests/unit/spec-code-review-contracts.test.js`
- Add: `tests/unit/crg-work-runs.test.js`
- Add/Modify: `tests/unit/crg-detail-profile.test.js`
- Add/Modify: `tests/unit/runtime-mirror-source-hash.test.js`

**Approach:**

- 不手改 `.claude/`、`.codex/`、`.agents/` runtime mirror；workflow source skill 与 CLI anchor 更新后，由 `spec-first init --claude|--codex` 或对应 runtime sync 重建。
- `status.js` 负责 non-throwing graph readiness：检查 active graph path、native module、`graph-index-status.json`、capabilities、freshness，返回结构化状态。
- graph unavailable 时不调用 `openDb()`、`review-context` 或 `impact` handler；直接输出 direct-read fallback envelope。
- 为 `spec-plan` 增加 `before_plan` hook anchor；hook 内部调用 `crg workflow-context --stage=plan` 与 locate/path/explain query plan。
- 为 `spec-write-tasks` 增加 task-pack pass-through 说明：它不调用新的 CRG hook，不生成新的 graph fact，只把 source plan、source hash、任务文件边界和可选 CRG query refs 交给后续 `spec-work`。
- 为 `spec-work` / `spec-work-beta` 增加 `before_work` / `after_work` hook anchor；hook 内部调用 `crg workflow-context --stage=work`、返回 `work_run_id` / `work_start_ref`，并在 after-work 通过 shared diff base resolver 调用 `review-context`。
- `before-work --task-pack=<tasks.md>` 校验 `source_plan_hash` 后读取 source plan 的 planned surface，并把 task cards 归一化成 `execution_focus`；hash mismatch 返回 `task-pack-stale` limitation。
- `before-work` 写 `.spec-first/graph/work-runs/<run_id>.json`；`after-work --work-run=<id>` 优先从该 artifact 读取 `work_start_ref`，避免中断、委派或恢复后丢失比较基准。
- `before-work --plan=<plan.md>` 只读取 plan 中唯一 sentinel 包裹的 `planned_change_surface` JSON block；也可用 `--planned-surface=<path>` 显式传入 sidecar 且 sidecar 优先。缺失时写 `planned-surface-missing` limitation，多块写 `planned-surface-ambiguous` limitation，JSON/schema 失败写 invalid limitation，不从 prose 推断语义。
- 为 `spec-code-review` 增加 `before_review` hook anchor；hook 内部调用 `crg workflow-context --stage=review`、shared diff base resolver 与 review-context priority rule。
- `workflow-context` 输出统一 base envelope，并按 stage 填充最小 `stage_context`。
- `hook` 输出统一 hook envelope，并嵌入或引用 workflow-context；hook failure 不阻塞 workflow，只返回 fallback。
- `workflow-context` 和 `hook` 默认 `detail_profile: minimal`，并把显式 `--detail=standard` 传播给 locate/impact/review-context/path/explain；需要更多证据时只通过 `recommended_queries` 建议标准档或更窄 query。
- fallback 改为 direct repo reads，不再支持旧 Stage-0 docs 作为事实 fallback。
- plugin anchors 一次性补到 `crg hook before-plan|before-work|after-work|before-review`；如果存在 legacy Stage-0 wording，则同一 cutover 删除。
- 不实现通用 hook engine、hooks.yaml、优先级、条件表达式或插件注册表。

**Test scenarios:**

- skill 文本只包含极薄 hook anchor，不复制 CRG schema 细节。
- `spec-write-tasks` 文本明确 task pack 是派生执行索引，plan 是唯一 SoT，CRG query refs 只能作为执行上下文索引。
- skill 文本要求 graph-ready 时优先通过 hook 获取 CRG query 输入。
- skill 文本明确查询结果不是强制结论。
- graph unavailable fallback 不要求用户先重新 bootstrap，也不读取旧 `docs/contexts`。
- `after-work --work-run=<id>` 能在新会话中复用 before-work 的 start ref。
- planned surface 缺失时 hook 返回 limitation，不解析 markdown prose。
- stale task pack 返回 `task-pack-stale` limitation，不把 task cards 当 planned surface。
- 默认 hook envelope 标注 `detail_profile: minimal`；显式 standard 会传递到下游 query，但不会让 workflow 恢复旧 `minimal-context` 或 Stage-0 docs。
- plan/tasks/work/work-beta/review runtime anchors 都不再出现 `stage0-context`。
- hook handler 单测覆盖 ready、stale、unavailable、fallback 四类 envelope。

### Unit 7.5: Delete Stage-0 runtime routing

**Goal:** 删除旧 `stage0-context` / `context-routing` 默认运行时链路，避免双默认入口长期共存。

**Requirements:** R7, R8, R10, R23

**Files:**

- Delete: `src/cli/commands/stage0-context.js`
- Delete: `src/context-routing/evaluator.js`
- Delete: `src/context-routing/fallback.js`
- Delete: `src/context-routing/priority.js`
- Delete: `src/context-routing/profiles.js`
- Migrate then delete all remaining `src/context-routing/*.js`
- Modify: `src/cli/index.js`
- Modify: `src/cli/commands/doctor.js`
- Modify: `src/crg/commands/review-context.js`
- Move useful logic from `src/context-routing/change-surface.js` to `src/crg/changes.js` or `src/crg/workflow-context/change-surface.js`

**Approach:**

- 先确认 `crg hook` 按生命周期覆盖入口：cutover 覆盖 plan/tasks/work/work-beta/review；tasks 通过 `before-work --task-pack` 继承 source plan handoff，`workflow-context` 作为 hook 底层 envelope 保留。
- 将 change surface、verification recommendation 中仍有价值的 deterministic 逻辑迁移到 CRG 模块。
- 删除 selected_assets、fallback L0/L1/L2/L3、minimal-context provenance 等 Stage-0 runtime 语义。
- `doctor` 改查 CRG graph contract，不查 bootstrap Stage-0 contract。

**Test scenarios:**

- CLI help 不再列出 `stage0-context`。
- cutover 后 `spec-plan` / `spec-write-tasks` / `spec-work` / `spec-work-beta` / `spec-code-review` runtime anchors 只指向 CRG lifecycle hooks 或 task-pack pass-through，不再指向 `stage0-context`。
- `review-context` 不再依赖 `context-routing` 模块。
- graph unavailable 时输出 direct-read fallback envelope。

### Unit 7.6: Migrate quality gate governance

**Goal:** 将 AI Dev Quality Gate、branch protection policy 和 verification-gate integration 从 Stage-0 runtime 迁移到 CRG graph/runtime contract。

**Requirements:** R7, R8, R10, R23

**Files:**

- Modify: `.github/workflows/ai-dev-quality-gate.yml`
- Modify: `src/cli/contracts/quality-gates/branch-protection-policy.json`
- Modify: `scripts/run-ai-dev-quality-gate.js`
- Modify: `tests/integration/verification-gate.integration.test.js`
- Modify: `tests/unit/ai-dev-quality-gate.test.js`
- Modify/Delete: `tests/unit/stage0-context-command.test.js`
- Modify/Delete: `tests/unit/context-routing-evaluator.test.js`

**Approach:**

- 将 workflow path filters、policy protected paths 和 gate test list 从 Stage-0 runtime path 切到 CRG command/hook/contracts/source skill/runtime governance path。
- `run-ai-dev-quality-gate.js` 保留 deterministic test runner 职责，不做语义判断；它只聚合 CRG runtime contract tests、hook fallback tests、runtime mirror source-hash tests 和 graph bootstrap default-path tests。
- 若 quality feedback / verification evidence helper 仍有价值，迁移到 `src/verification/*` 或 `src/crg/verification/*` 后再更新 import；否则删除 Stage-0-only helper 与测试。
- 统一 artifact 命名，避免继续输出 `stage0-contracts` 作为当前质量门禁语义。

**Test scenarios:**

- `.github/workflows/ai-dev-quality-gate.yml` 不再监听 `src/context-routing/**` 或 `src/cli/commands/stage0-context.js`。
- branch protection policy 不再保护 Stage-0 runtime path 作为现行默认面。
- `tests/integration/verification-gate.integration.test.js` 断言 CRG graph/runtime governance path。
- `tests/unit/ai-dev-quality-gate.test.js` 断言 focused test list 不包含 Stage-0-only tests，且包含 CRG hook/query/runtime mirror/fallback tests。
- `npm run test:ai-dev:gate` 能在 Stage-0 删除后通过。

### Unit 8: Add input detection and advanced graph health

**Goal:** 在 C1 最小 shrink guard 之后，补齐 Graphify-style input detection、显式 prune intent 与更细图健康保护。

**Requirements:** R13, R14

**Files:**

- Add: `src/crg/commands/detect-inputs.js`
- Modify: `src/crg/input-convergence.js`
- Modify: `src/crg/incremental.js`
- Modify: `src/crg/generations/promote.js`
- Modify: `src/crg/generations/health.js`
- Test: `tests/unit/crg-input-convergence.test.js`
- Test: `tests/unit/crg-incremental.test.js`

**Approach:**

- 输出输入分类摘要，不读取源码正文到 prompt。
- fingerprint 使用 repo-relative path。
- graph rebuild 后在 C1 最小 shrink guard 基础上补充语言/路径/文件类型分层阈值。
- 支持显式 prune/delete intent，避免正常大规模删除被误判为异常 shrink。
- 丰富 degraded 诊断，但不改变 C1 已建立的“不静默覆盖 last-known-good”底线。

**Test scenarios:**

- `.spec-first/graph/` 与显式 report projection 不会被索引。
- sensitive 文件被跳过并只记录 count。
- 无显式 prune 时 node_count 大幅下降会保留 last-known-good 并给出更具体的 degraded reason。

### Unit 9: Add graph analysis signals to code-navigation

**Goal:** 让 map 层提供 surprise/gap/question 信号，而不只列 top hubs。

**Requirements:** R15

**Files:**

- Modify: `src/crg/analyze.js`
- Modify: `src/crg/cli/context.js`
- Modify: `src/bootstrap-compiler/compile-machine-artifacts.js`
- Modify: `docs/contracts/spec-graph-bootstrap/code-navigation.schema.json`
- Test: `tests/unit/crg-analyze.test.js`
- Test: `tests/unit/spec-graph-bootstrap-compiler.test.js`

**Approach:**

- 复用现有 `god-nodes` / community / flow 信息。
- 增加 surprise ranking，但过滤 `contains` / `defined_in` 等结构边。
- 生成 suggested queries，不生成结论。

**Test scenarios:**

- 跨社区业务边能进入 surprise。
- 纯结构边不进入 surprise。
- thin community 能被标注为低连接导航信号。

### Unit 10: Optional graph report projection

**Goal:** 为人类审计提供可显式生成的 graph report 投影，不增加新的结构化查询面。

**Requirements:** R7, R9

**Files:**

- Add/Modify: `src/crg/commands/report.js`
- Modify: `src/crg/cli/router.js`
- Modify: `skills/spec-graph-bootstrap/SKILL.md`
- Test: `tests/unit/crg-report-contracts.test.js`

**Approach:**

- 显式 `--report` 或 `crg report` 才生成 `graph-report.md`。
- report 只作为人类审计投影，不作为 hook runtime input。
- report 复用 graph status、code navigation、limitations 和 suggested queries；不返回源码正文。
- 不实现 CRG MCP server。

**Test scenarios:**

- report 包含 graph status、limitations 和 suggested queries 摘要。
- graph missing 返回 limitation，不伪造空健康报告。
- hook / workflow-context 不读取 graph-report.md。

## Verification Strategy

### Repository Required Verification

本仓库的 cutover 验证不能只停留在 focused tests。C1 合并前必须执行并在 PR / release notes 中记录：

- `npm run typecheck`
- `npm run test:ai-dev:gate`
- `npm test`
- `npm run build`

同时，任何源码、source skill、治理 contract 或文档变动都必须同步更新根目录 `CHANGELOG.md`。如果某条命令因本机环境或 optional native module 缺失无法执行，记录必须说明失败命令、失败原因、影响面和替代验证；不能用“文档-only”名义跳过 changelog 或 release governance。

### Primary Verification

直接切换阶段优先用少量高信号验证，不把旧 Stage-0 测试保留为阻塞：

- CLI smoke:
  - `spec-first --help` 不再推荐 `stage0-context`。
  - `spec-first crg workflow-context --stage=plan|work|review` 能返回结构化 envelope。
  - `spec-first crg hook before-plan|before-work|after-work|before-review` 能返回结构化 envelope。
  - graph unavailable 时返回 direct-read fallback envelope。

- Contract text checks:
  - source skill / runtime mirror 不再把 `docs/contexts`、`minimal-context`、`stage0-context` 描述为默认入口。
  - plugin anchors 指向 `crg hook ...`，而不是 `stage0-context` 或裸 `crg workflow-context`。
  - `locate` / `path` / `explain` 不输出最终修改决定。

- Governance checks:
  - `.github/workflows/ai-dev-quality-gate.yml` 不再保护 Stage-0 runtime path 作为现行默认面。
  - `src/cli/contracts/quality-gates/branch-protection-policy.json` 的 protected paths 指向 CRG graph/runtime contracts、source workflow anchors 和 quality-gate contracts。
  - `scripts/run-ai-dev-quality-gate.js` 的 focused test list 不再 hard-code Stage-0-only tests。

- One real repo manual acceptance:
  - 真实 diff 能通过 `review-context` 输出 changed nodes、affected flows、candidate tests。
  - `spec-code-review` 能按 CRG risk ordering 审查。
  - graph unavailable 时 workflow 明确走 direct repo reads。

- C1 pre-merge query quality acceptance:
  - 选取 3 个历史代表任务，分别覆盖 plan、work、review 场景。
  - `locate` / `explain` / `path` 对 planning 任务必须命中预期 candidate files 或 symbols；misses 必须进入 `limitations[]`，不能伪装为成功。
  - `review-context` 对真实 diff 必须返回 changed nodes、affected flows 或明确 limitations，并给出 candidate tests 或 coverage gap。
  - 该验收是合并前质量门槛，不是 runtime hard gate；失败时修 query 质量或收窄 C1 scope，不能保留 Stage-0 默认入口作为替代。

### Legacy Tests

旧 Stage-0 测试可以删除或重写，不作为兼容约束。凡是断言以下行为的测试应删除或改写：

- 默认生成 `docs/contexts`。
- 默认生成 `injection-index.yaml`。
- 默认存在 `context-routing.json`。
- 默认存在 `minimal-context/*.json`。
- `stage0-context` 是 workflow runtime anchor。
- AI Dev Quality Gate 必须监听 `src/context-routing/**` 或 `src/cli/commands/stage0-context.js`。
- release governance artifact 必须输出 `stage0-contracts` 作为当前门禁语义。

### Focused Unit / Contract Tests

- `tests/unit/spec-graph-bootstrap-contracts.test.js`
  - 锁定 query-first 定位。
  - 锁定 graph truth boundary。
  - 锁定 report projection 语义。
  - 锁定 Graphify-style map/query split。
  - 锁定 Stage-0 runtime deletion 语义。

- `tests/unit/spec-graph-bootstrap-compiler.test.js`
  - 验证 `graph-index-status.json` 和 `code-navigation.json`。

- `tests/contracts/crg-cli-v1.test.js`
  - 锁定 `locate`、`path`、`explain`、`impact`、`review-context` 输出 shape。

- `tests/unit/crg-input-convergence.test.js`
  - 锁定输入分类、敏感文件跳过、自输出排除。

- `tests/unit/crg-analyze.test.js`
  - 锁定 surprise/gap/suggested query 的过滤和排序。

- `tests/unit/spec-plan-contracts.test.js`
- `tests/unit/spec-write-tasks-contracts.test.js`
- `tests/unit/spec-work-contracts.test.js`
- `tests/unit/spec-work-beta-contracts.test.js`
- `tests/unit/spec-code-review-contracts.test.js`
  - 锁定 workflow 消费口径。
  - 锁定 plan/tasks/work/work-beta/review 的默认入口都是 `crg hook ...` 或 task-pack pass-through，不再引用 Stage-0。

- `tests/unit/ai-dev-quality-gate.test.js`
- `tests/integration/verification-gate.integration.test.js`
  - 锁定 AI Dev Quality Gate 与 branch protection policy 已迁移到 CRG graph/runtime contract。
  - 锁定 focused gate test list 不再依赖 `stage0-context` 或 `context-routing`。

### E2E / Smoke

- `tests/e2e/crg-all-commands.sh`
  - 覆盖 `locate`、`path`、`explain`、增强 `impact`、增强 `review-context`。

- `tests/e2e/spec-graph-bootstrap-mainline.sh`
  - 改为 graph-ready 默认主链。

- `tests/e2e/spec-graph-bootstrap-installed-runtime.sh`
  - 验证安装后的 runtime skill 描述 query-first、CRG lifecycle hooks 与 direct reads fallback。

- `tests/smoke/cli.sh`
  - 验证 help 文案不再把 docs 包描述成默认事实真源。

- `npm run test:ai-dev:gate`
  - 验证 release governance 当前保护的是 CRG runtime contract，而不是旧 Stage-0 contract。

### Manual Acceptance Scenarios

1. **新任务规划：**
   - 输入“为 CLI 增加 X 行为”。
   - `spec-plan` 先通过 `crg hook before-plan` 获取 planning envelope，再按建议调用 `crg locate` / `crg explain` / `crg path` 返回候选文件和 symbol。
   - LLM 在计划中说明选择哪些候选、排除哪些候选、证据是什么。

2. **修改后影响面：**
   - 修改一个核心函数。
   - `crg hook after-work --work-start-ref=<sha>` 或 `--since=<base>` 返回 changed nodes、caller expansion、affected flows、candidate tests。
   - `spec-work` 能判断实际 blast radius 是否超出 plan。

3. **单点影响分析：**
   - 对一个高 fan-in symbol 运行 `crg impact`。
   - 输出 impacted modules 和 affected flows。
   - LLM 能据此决定验证范围。

4. **graph unavailable fallback：**
   - 删除或禁用 `graph.db`。
   - workflow 明确降级到 direct repo reads。
   - 不阻塞用户，不伪造 CRG 结论。

5. **路径解释：**
   - 对两个模块或 symbol 运行 `crg path`。
   - 输出 shortest path 与 relation `decision_input_kind`。
   - LLM 能引用该路径解释为什么候选修改面相关。

6. **节点解释：**
   - 对候选 symbol 运行 `crg explain`。
   - 输出 source location、community、neighbors、flows 和 candidate tests。
   - LLM 能在不全量读文件的情况下决定是否需要进一步打开源码。

## Risks and Mitigations

- **风险：直接删除 Stage-0 runtime 可能破坏旧消费者。**
  - 缓解：不做向下兼容，但采用原子 cutover checklist：同一合并中新增 CRG hooks/query、替换 plugin anchors / workflow skills / doctor 检查，并删除 `stage0-context` 和 `context-routing`。不发布双默认入口状态。

- **风险：`locate` 被误解为自动决定修改点。**
  - 缓解：contract 明确只输出 candidates/evidence/limitations，workflow 文本要求 LLM 决策。

- **风险：CRG 图质量不足导致错误定位。**
  - 缓解：所有 query 输出都带 `decision_input_kind`、evidence、limitations；LLM 必须在计划中标注低置信度假设。

- **风险：输出太大，反而降低 LLM 效率。**
  - 缓解：query 默认 top-N、聚合 module/flow/test 摘要，细节按需二次查询。

- **风险：workspace 场景退化。**
  - 缓解：将 workspace registry 迁移为 child graph status registry；每个 child 只需 graph-ready，不生成 child docs。

- **风险：map 层重新膨胀成另一个 docs 包。**
  - 缓解：`code-navigation.json` 只保留 top-N 和 suggested queries；`graph-operations.jsonl` 只记录操作事件；`graph-report.md` 只做 audit summary，不能加入长篇架构叙述。

- **风险：graph operation log 被误当成状态机或第二事实源。**
  - 缓解：`graph-operations.jsonl` append-only，只服务审计和解释；当前状态仍由 active graph pointer、`graph-index-status.json` 和 graph health 检查表达。

- **风险：cutover 被 operation log / doctor lint 拖大。**
  - 缓解：cutover 的 operation log 只记录 build/promote/degrade/workflow-context fallback；doctor 只在现有 `spec-first doctor` 中新增 graph section，不新增多级 CLI，也不要求完整 lint 自动修复。

- **风险：hook 注入演化成隐式 AOP 或强编排。**
  - 缓解：hook point 必须由 skill 显式声明；不做全局自动注入、不自动改写 prompt、不做 hook rules engine。hook 只返回 envelope 和 limitations，不阻塞 workflow、不决定修改文件。

- **风险：每个 skill 都复制 CRG hook 细节，导致 prompt 膨胀和漂移。**
  - 缓解：相关 skill 只增加 3-8 行极薄 hook anchor；完整 hook contract 放在 `docs/contracts/crg/context-hooks.md`，contract tests 检查 skill 只引用 hook 语义，不内嵌 schema 大段内容。

- **风险：direct repo reads fallback 让 LLM 重新无目标 grep。**
  - 缓解：fallback envelope 必须说明 graph unavailable 原因，并给出少量 repo-relative suggested reads；不能回退到旧 docs，也不能伪造 CRG 事实。

- **风险：direct repo reads fallback 或 graph/report 泄露敏感文件。**
  - 缓解：所有 suggested reads 和 graph/report projection 必须经过 sensitive / generated / self-output 过滤；不实现 CRG MCP server，不新增远程或 host-level 查询面，report 不返回源码正文或 secret-like literal。

- **风险：shrink guard 误挡正常大规模删除。**
  - 缓解：支持显式 prune/delete intent；无 intent 时只降级并保留 last-known-good。

## Rollout Strategy

```text
Step 1: 先在 cutover 分支内改文档和 contract，声明目标架构；C0 不单独发布、不单独同步 runtime mirror
Step 2 / C1a: 新增 .spec-first/graph control-plane，包含 non-throwing status honesty、最小 freshness、operation log 和 last-known-good shrink guard
Step 3 / C1b: 新增 locate / explain / path，并增强 review-context / impact
Step 4 / C1c: 新增 workflow-context --stage=plan|work|review、固定 4 个 lifecycle hooks、shared diff base resolver、planned surface sentinel 和 task-pack handoff
Step 5 / C1c: 将 spec-plan / spec-write-tasks / spec-work / spec-work-beta / spec-code-review 与 plugin anchors 一次性切到 crg hook 或 task-pack pass-through
Step 6 / C1d: 在同一 cutover 删除 stage0-context CLI、context-routing runtime、minimal-context 和 docs/contexts 默认生成
Step 7 / C1d: 同步迁移 AI Dev Quality Gate、branch protection policy、run-ai-dev-quality-gate、verification-gate integration 和相关 unit tests
Step 8 / C1e: 重建 runtime mirror，运行 smoke / contract / e2e / manual acceptance、npm run typecheck、npm run test:ai-dev:gate、npm test、npm run build，并记录 query_hit_rate / impact_recall / context_token_ratio，确认没有双默认入口
Step 9: cutover 后补完整 input detection / freshness / explicit prune intent / advanced shrink health diagnostics
Step 10: cutover 后增加 surprise/gap/suggested query 导航信号
Step 11: cutover 后评估 optional graph-report；不扩展 hook 配置面，不新增 CRG MCP server
```

Step 2-8 是同一个用户可见 cutover，不应拆成多次发布。允许在同一分支内按 commit 分层施工，但不能合并一个仍保留 Stage-0 默认入口、或治理门禁仍保护 Stage-0 path 的中间态。

## Exit Criteria by Stage

### C0 Contract Exit

- source skill 明确 query-first、map/query split、Stage-0 runtime deletion。
- C0 产物只存在于 cutover 分支内部；不得单独发布，不得单独运行 `spec-first init --claude|--codex` 同步 runtime mirror 给用户。
- C0 文档必须明确当前 plan/work/review source skills 没有显式消费 `stage0-context`，避免把 C1 描述成替换一个并不存在的 source-skill 默认调用。
- runtime mirror 由 source 重建后带 generated marker / source hash；测试验证 drift reporting，不把 mirror 当手改目标。
- contract test 能拦住“docs/context-routing 是默认事实层”这类回归。

### C1 Atomic Cutover Exit

- `.spec-first/graph/graph-index-status.json`、`.spec-first/graph/code-navigation.json`、`.spec-first/graph/graph-operations.jsonl` 可用。
- `locate` 只输出候选与证据，不输出最终修改决定。
- `path` 能解释两个候选之间的 graph 关系。
- `explain` 能解释单个候选的局部 graph 上下文。
- `review-context` 对真实 diff 输出 changed nodes、graph expansion、affected flows、candidate tests。
- `impact` 对真实 symbol 输出 blast radius、impacted modules、affected flows。
- `crg workflow-context --stage=plan|work|review` 与 `crg hook before-plan|before-work|after-work|before-review` 可用。
- C1 pre-merge query quality acceptance 用 3 个历史代表任务记录 `query_hit_rate`、`impact_recall`、`context_token_ratio`；硬门槛是关键候选不漏和诚实 limitations，precision 仅记录为 C2/C3 优化输入。
- `before-work` 生成 work run artifact，`after-work --work-run=<id>` 能稳定复用 start ref。
- `spec-plan` 输出机器可读 `planned_change_surface`，`before-work` 不解析 prose。
- 最小 shrink guard 已启用，异常 partial rebuild 不覆盖 last-known-good。
- `spec-plan` / `spec-write-tasks` / `spec-work` / `spec-work-beta` / `spec-code-review` 通过显式 hook anchor 或 task-pack pass-through 获取 CRG 输入，不再依赖 `stage0-context`。
- `stage0-context` CLI、`context-routing` 默认 runtime、`minimal-context` 默认输入、`docs/contexts` 默认生成链路已删除。
- AI Dev Quality Gate、branch protection policy、`scripts/run-ai-dev-quality-gate.js`、verification-gate integration 和相关 unit tests 已迁移到 CRG graph/runtime contract，不再保护 Stage-0 path 作为现行默认面。
- `CHANGELOG.md` 已记录 cutover 代码 / source skill / governance / 文档变更。
- `npm run typecheck`、`npm run test:ai-dev:gate`、`npm test`、`npm run build` 已执行并记录结果。

### C2 Reliability Exit

- stale / degraded graph 不会被当作 healthy。
- 异常 shrink 不会静默覆盖 last-known-good。
- workflow 在 graph unavailable 时能降级到 direct repo reads fallback。

### C3 Navigation Polish Exit

- `code-navigation.json` 能输出 `surprising_connections`、`thin_communities`、`ambiguous_edges` 与 `suggested_queries`。
- suggested queries 只是导航建议，不成为 workflow gate。

### C4 Optional Report Surface Exit

- `graph-report.md` 只是 audit summary，不重新膨胀为项目知识库。
- `graph-report.md` 必须复用 fallback suggested reads 的 sensitive / generated / self-output / runtime mirror 过滤。
- `graph-report.md` 不返回 source bodies、secret-like literals 或被过滤路径。
- workflow-context / hook 不读取 `graph-report.md` 作为 runtime fallback。
- contract tests 覆盖 report 的过滤、no-source-body 和 no-secret-literal 约束。

## Success Metrics

- 默认 bootstrap 产物数量减少，完成时间降低。
- `spec-plan` 中候选修改面的路径和 symbol 引用更多来自 CRG query，而不是泛化文档摘要。
- `spec-work` 能在实现后报告 blast radius 是否扩大。
- `spec-code-review` 能按 affected flows / high-risk expansion 排序审查重点。
- 用户不需要生成或阅读 `docs/contexts` 也能得到修改定位与影响面判断。
- `spec-first stage0-context` 不再是推荐或默认 runtime 入口。
- LLM 能通过 `path/explain` 解释“为什么这些模块相关”，而不是只给出文件列表。
- graph rebuild 不会因异常 partial output 静默覆盖健康图。
- `code-navigation.json` 能主动给出 suggested queries，减少无目标 grep。

### Measurement Plan

第一轮不要引入复杂 benchmark，只保留轻量可复现指标：

```text
context_size:
  - 默认 hook envelope / workflow context token 量是否低于旧 Stage-0 selected_assets
  - 是否不再生成 docs/contexts markdown
  - 采样同一个真实 repo，对比旧 `stage0-context --format json` 与新 `crg hook before-work|before-review|before-plan` 的字符数 / token 估算

planning_specificity:
  - plan 中是否出现具体 candidate symbol/file/module
  - 每个 candidate 是否有 evidence
  - 采样 3 个历史小需求，记录候选是否能定位到具体文件或 symbol

review_focus:
  - review 是否优先覆盖 affected flows / high-risk graph expansion
  - 采样 3 个真实 diff，记录 review checklist 是否按 affected flows 排序

verification_precision:
  - recommended verification 是否从 changed surface 派生
  - 是否减少泛化“跑全量测试”建议
  - 记录 recommended commands 中与 changed files/modules 直接相关的比例

user_outcome:
  - 采样 3 个历史任务，记录 plan 首轮是否达到可执行状态
  - 记录 spec-work 后是否能解释实际 blast radius 扩大原因，以及是否减少返工轮次
  - 记录 spec-code-review 是否发现旧 review checklist 遗漏的受影响 flow / candidate test
  - 记录完成一次 plan/work/review 的总交互次数和命令次数是否下降

fallback_honesty:
  - graph stale/unavailable 时是否明确降级
  - fallback 是否走 direct repo reads，而不是旧 Stage-0 docs
  - 人为禁用 graph.db，确认 envelope 不含 CRG-derived fields

operation_traceability:
  - 最近一次 build/promote/degrade/fallback 是否能从 graph-operations.jsonl 解释
  - `spec-first doctor` graph finding 是否能指向具体 artifact 或 operation log entry
```

这些指标只作为观察面，不作为 hard gate。它们的作用是判断 query-first 是否真的提高 LLM 决策输入质量。

## Non-Success Signals

- 只是把更多 markdown 加入 `docs/contexts`。
- `locate` 输出“必须修改文件”这类语义裁决。
- `review-context` 输出很大但没有 affected flows、candidate tests、risk summary。
- `path/explain` 被实现成 prose 总结而不是结构化 graph facts。
- 所有关系都被标为 observed，没有 ambiguous 候选语义。
- graph rebuild node_count 异常缩小时仍静默 promote。
- `spec-plan` 仍主要依赖 `stage0-context`、`minimal-context` 或 `module-map.md`，不查 CRG。
- `spec-work` / `spec-code-review` runtime anchors 仍指向 `stage0-context`。
- `docs/contexts` 或 `injection-index.yaml` 继续默认生成。
- `context-routing` 继续作为默认 workflow 上下文选择链。

## Final Target Statement

重构后的 `spec-graph-bootstrap` 应该能用一句话解释：

```text
Index once, query on demand, let LLM decide.
```

借鉴 Graphify 后，产品心智补充为：

```text
Map first, query precisely.
```

对应到 spec-first 项目的角色原则：

```text
Scripts prepare graph facts.
LLM decides engineering meaning.
Workflows consume query results.
Docs are optional projections.
```
