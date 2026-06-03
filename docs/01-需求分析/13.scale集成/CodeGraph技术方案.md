# spec-first 集成 GBrain / Graphify / CodeGraph 技术方案

## 0. 核心结论

你这个判断是对的：**不能只拿当前 spec-first 的既有约束去否定 GBrain / Graphify / CodeGraph 的集成合理性。**

如果目标只是维持当前 spec-first 的轻量 workflow，那三者只能被放成 optional provider；但如果目标是把 spec-first 升级成真正的 **AI Coding Harness / Context Intelligence Harness**，这三个组件应该成为一等能力。

我建议把设计目标从：

```text
optional provider pack
```

升级为：

```text
Context Intelligence Plane
```

也就是：

```text
CodeGraph = 当前代码结构事实层
Graphify  = 当前项目语义图谱层
GBrain    = 长期团队记忆与历史经验层
```

三者组合后，spec-first 不再只是：

```text
需求 -> 计划 -> 任务 -> 实现 -> Review -> Learning
```

而是升级为：

```text
需求/问题
  -> 当前代码结构理解
  -> 当前项目语义理解
  -> 历史经验/决策召回
  -> 证据融合
  -> 计划/实现/Review/沉淀
```

---

# 1. 三个组件不是重复，而是三层上下文能力

## 1.1 CodeGraph：代码结构事实层

CodeGraph 是 local-first code intelligence library + CLI + MCP server，使用 Tree-sitter 解析代码，提取 symbols、edges、files，存储到本地 `.codegraph/` SQLite FTS5 索引中，并通过 MCP 暴露给 Claude Code、Codex、Cursor、OpenCode 等工具；它的抽取是 AST 派生，不是 LLM 总结。([GitHub][1])

它提供的能力包括：

```text
symbol search
callers / callees
impact radius
affected tests
file structure
indexed source context
```

CodeGraph 的 CLI 明确支持 `codegraph init -i` 初始化并构建 `.codegraph/` 索引，也支持 `query`、`files`、`callers`、`callees`、`impact`、`affected`、`serve --mcp` 等命令。([GitHub][2])

**它在 spec-first 中最适合承担：**

```text
Code Evidence Candidate Provider
```

它解决的问题是：

```text
这个需求要改哪些代码？
这个函数谁调用？
这个 diff 的 blast radius 是什么？
哪些测试可能受影响？
review 时是否漏看了调用链？
debug 时错误路径如何到达这里？
```

CodeGraph 自己的 benchmark 显示，在 7 个真实开源代码库、7 种语言上，使用 CodeGraph 的 agent 平均成本降低 16%、tokens 减少 47%、速度提升 22%、tool calls 减少 58%。([GitHub][2])

所以 CodeGraph 应该最先接入核心链路。

---

## 1.2 Graphify：项目语义图谱层

Graphify 是面向 AI coding assistants 的多模态知识图谱构建工具，可以从 code、docs、PDF、images、videos 中构建 queryable knowledge graph。([GitHub][3])

它结合 Tree-sitter 静态分析和 LLM-driven semantic extraction，把 source code、documentation、research papers、diagrams 转成解释 “what the code does and why it was designed that way” 的图谱。([Graphify][4])

Graphify 输出包括：

```text
graphify-out/graph.html
graphify-out/GRAPH_REPORT.md
graphify-out/graph.json
```

其中 `graph.json` 是可查询图谱，`GRAPH_REPORT.md` 是人类可读审计报告，`graph.html` 是交互式图。([GitHub][3])

它还支持：

```text
/graphify query
/graphify path
/graphify explain
graphify hook install
graphify prs
graphify prs --conflicts
python -m graphify.serve graphify-out/graph.json
```

Graphify 的 MCP server 能提供 `query_graph`、`get_node`、`get_neighbors`、`shortest_path`、`list_prs`、`get_pr_impact`、`triage_prs` 等结构化访问。([GitHub][3])

**它在 spec-first 中最适合承担：**

```text
Project Knowledge Graph Compiler
```

它解决的问题是：

```text
当前系统有哪些业务概念？
代码和文档描述是否一致？
某个 PRD 涉及哪些模块、接口、文档、SQL、脚本？
哪些模块是 god nodes？
哪些跨域连接很意外？
哪些 PR 共享同一图谱社区，存在合并顺序风险？
```

所以 Graphify 不应该只服务 review，它应该前置到 PRD / Plan 阶段。

---

## 1.3 GBrain：长期团队记忆层

GBrain 定位是 AI agent 的 brain layer，它不是普通搜索引擎，而是把 synthesis、graph traversal、gap analysis 放在一起：`gbrain search` 返回原始检索材料，`gbrain think` 会基于检索结果生成带 citation 和 gap analysis 的综合回答。([GitHub][5])

GBrain 还提供 self-wiring knowledge graph：每次 page write 时抽取实体引用并创建 typed edges；它强调 vector search 返回语义接近，graph 返回事实连接，hybrid search 组合 vector、BM25、RRF、source-tier boost 和 reranker。([GitHub][5])

架构上，GBrain 支持 PGLite 作为默认本地引擎，也支持 Postgres + pgvector 作为 shared / large / multi-machine 部署；brain repo 是 system of record，知识以 Markdown 存在 git repo 中，再同步到 Postgres 用于检索。([GitHub][5])

它还支持本地/远程 MCP，Claude Code 可以用 `claude mcp add gbrain -- gbrain serve`，Codex 可以用 `gbrain connect ... --agent codex`，HTTP server 支持 OAuth 2.1、scope-gated access 和 rate limiting。([GitHub][5])

**它在 spec-first 中最适合承担：**

```text
Team Memory / Institutional Recall
```

它解决的问题是：

```text
过去为什么拒绝这个方案？
这个模块以前踩过什么坑？
类似 bug 的 RCA 是什么？
历史 review finding 有哪些？
团队规范中有没有相关约束？
这个方案是否重复了历史争议？
```

GBrain 不应该直接决定当前代码怎么改。它应该提供“历史经验、决策、gap、冲突、citation”。

---

# 2. 新目标架构：Context Intelligence Plane

建议在 spec-first 中新增一层：

```text
Context Intelligence Plane
```

它不是单个 provider adapter，而是一组能力：

```text
1. Provider Registry
2. Provider Readiness & Freshness
3. Query Planner
4. Provider Router
5. Evidence Fusion
6. Context Pack Builder
7. Confirmation / Promotion Engine
8. Refresh Scheduler
9. Runtime Projection
```

架构图：

```text
┌─────────────────────────────────────────────────────────────┐
│                        spec-first                           │
│                                                             │
│  spec-prd / spec-plan / spec-work / spec-code-review / spec-debug │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              Context Intelligence Plane                     │
│                                                             │
│  Query Planner                                               │
│  ├─ classify: code / semantic / history / verification       │
│  ├─ choose provider(s)                                       │
│  └─ set confidence requirement                               │
│                                                             │
│  Provider Router                                             │
│  ├─ CodeGraph adapter                                        │
│  ├─ Graphify adapter                                         │
│  └─ GBrain adapter                                           │
│                                                             │
│  Evidence Fusion                                             │
│  ├─ normalize facts                                          │
│  ├─ detect conflicts                                         │
│  ├─ freshness / repo alignment                               │
│  ├─ source-read requirements                                 │
│  └─ context pack budget                                      │
│                                                             │
│  Confirmation / Promotion                                    │
│  ├─ advisory                                                 │
│  ├─ evidence candidate                                       │
│  ├─ confirmed context                                        │
│  └─ durable memory / governance rule                         │
└───────────────┬──────────────────┬──────────────────┬───────┘
                │                  │                  │
                ▼                  ▼                  ▼
         ┌────────────┐     ┌────────────┐     ┌────────────┐
         │ CodeGraph  │     │ Graphify   │     │ GBrain     │
         │ code graph │     │ project KG │     │ team brain │
         └────────────┘     └────────────┘     └────────────┘
```

## 2.1 集成阶段总览

按当前 spec-first 最新代码，集成不能从“直接让所有 workflow 使用 provider”开始。正确拆法是先安装与事实层，再进入 skill 使用层，最后才做 evidence fusion 和长期记忆晋升。

| 阶段 | 名称 | 目标 | 是否安装 | 是否进入 skill/workflow |
| ---- | ---- | ---- | -------- | ----------------------- |
| 1 | Provider 边界与 Profile | 定义 `minimal` / `recommended` / `platform`，明确 provider 不是 truth | 否 | 否 |
| 2 | Readiness / Install Plan | 检测 provider 是否安装、配置、索引 fresh、repo aligned，并生成安装建议 | 只检查，不默认安装 | 否 |
| 3 | 显式安装与验证 | 用户确认后安装 CodeGraph / Graphify / GBrain，并验证可用性 | 是，explicit opt-in | 否 |
| 4 | Runtime / Host Projection | 将 provider 状态投影为 Claude / Codex 可读的 setup-owned facts | 不一定 | 间接 |
| 5 | Skill 集成使用 | `spec-plan` / `spec-code-review` / `spec-debug` 等消费 provider facts | 否 | 是 |
| 6 | Evidence / Memory Promotion | verified learning 先写 `docs/solutions/`，再可选同步 GBrain 或刷新 Graphify | 可选 | 是 |

核心边界：

```text
安装 = setup-owned deterministic facts
使用 = workflow-owned LLM judgment
```

安装成功只说明 provider 可用，不说明 provider 输出可信。provider 输出进入 skill 后也只能先是 advisory / candidate，必须经过 source-read、test、log、review 或 compound confirmation 才能升级。

## 2.2 安装与 Skill 使用边界

安装阶段由 `spec-mcp-setup` 或其后续 provider setup 子流程负责：

```text
detect -> install plan -> explicit install -> verify -> write setup facts
```

它只回答：

```text
CodeGraph 是否安装？
Graphify 是否有 graph artifact？
GBrain 是否可连接？
索引是否 fresh？
当前 repo 是否 aligned？
缺失时 fallback 是什么？
```

它不回答：

```text
这个需求应该怎么做？
这个 finding 是否成立？
这个历史经验是否适用于当前代码？
```

Skill 使用阶段由各 workflow 自己消费 provider facts，并保持原有职责：

- `spec-plan` 判断实施顺序和风险，不让 provider 自动扩大 scope。
- `spec-code-review` 判断 finding 是否成立，不让 provider result 直接变成 finding。
- `spec-debug` 判断 root cause，不让历史 RCA 直接替代当前日志和源码证据。
- `spec-work` 执行计划，不让 provider 生成新需求或新任务范围。

---

# 3. 不要再用单一 “advisory provider” 模型

当前 spec-first 文档里对 provider facts 的处理是非常保守的：scripts 只准备 deterministic facts，LLM 做 semantic judgment；外部工具在 source/test/log/schema/contract 或用户确认前都是 advisory。([GitHub][6])

这个边界对于防止误导是对的，但如果永远停在 advisory，三者的价值无法释放。

我建议把 provider 可信度升级为 **Context Maturity Model**：

| Level | 名称                 | 含义                                 | 示例                             |
| ----- | ------------------ | ---------------------------------- | ------------------------------ |
| L0    | unavailable        | 未安装、不可用、无索引                        | CodeGraph 未初始化                 |
| L1    | advisory           | 有结果，但未确认新鲜度或来源                     | GBrain 召回旧经验                   |
| L2    | evidence_candidate | 可作为候选上下文，需要回源确认                    | Graphify 找到概念关联                |
| L3    | confirmed_context  | 新鲜度、repo alignment、source refs 已确认 | CodeGraph impact + source-read |
| L4    | durable_knowledge  | 经 review/compound/promote 后长期沉淀    | GBrain / docs/solutions 共同记录   |
| L5    | governance_rule    | 多次验证后升级为规则/检测器                     | RuleMaturity approved          |

关键变化是：

```text
advisory 不是终点，而是起点。
```

Provider output 经过 freshness、repo alignment、source-read、test/log、review/compound 后，可以升级为 confirmed context 或 durable knowledge。

---

# 4. 三者的技术集成分工

## 4.1 CodeGraph 接入方案

### 接入位置

CodeGraph 应该进入：

```text
spec-plan
spec-work
spec-code-review
spec-debug
```

### 主要使用能力

CodeGraph MCP tools 包括 `codegraph_explore`、`codegraph_search`、`codegraph_callers`、`codegraph_callees`、`codegraph_impact`、`codegraph_node`、`codegraph_files`、`codegraph_status`。([GitHub][2])

在 spec-first 中映射为：

| spec-first 需求 | CodeGraph 能力                              |
| ------------- | ----------------------------------------- |
| 找相关代码         | `codegraph_search` / `codegraph_explore`  |
| 理解调用链         | `codegraph_callers` / `codegraph_callees` |
| 改动影响面         | `codegraph_impact`                        |
| 受影响测试         | `codegraph affected`                      |
| 文件结构          | `codegraph_files`                         |
| 索引健康          | `codegraph_status`                        |

### Adapter 输出

```json
{
  "provider": "codegraph",
  "kind": "code_structure",
  "status": "evidence_candidate",
  "freshness": {
    "index_exists": true,
    "current_repo_aligned": true,
    "last_indexed_commit": "abc123",
    "current_commit": "abc123",
    "stale": false
  },
  "facts": [
    {
      "type": "symbol_impact",
      "symbol": "submitOrder",
      "paths": ["src/order/service.ts", "src/order/controller.ts"],
      "relationship": "caller|callee|impact|affected_test",
      "confidence": "high",
      "source_read_required": true
    }
  ],
  "limitations": []
}
```

### 关键原则

CodeGraph 自己的 agent guidance 里说，结构问题应该直接使用 CodeGraph，不要用 grep/read 重复它已经做过的工作，并且结果可视为已读，但要检查 staleness banner。([GitHub][2])

spec-first 不应该原样采用“完全信任”这一点，而应该改成：

```text
CodeGraph 结果可替代盲目 grep 探索，
但关键结论仍需最小 source-read confirmation。
```

也就是：

```text
CodeGraph narrows the search.
source-read confirms the decision.
```

这样既释放 CodeGraph 的 token/速度价值，又不会让索引成为不可质疑的 truth。

---

## 4.2 Graphify 接入方案

### 接入位置

Graphify 应该进入：

```text
spec-prd
spec-plan
spec-code-review
spec-compound
spec-app-consistency-audit
```

`spec-update` 只处理 spec-first 更新和 runtime repair，不直接消费 Graphify 语义图谱 facts；Graphify refresh 应由 provider setup / platform profile 的 readiness 或 refresh 子流程负责。

### 主要使用能力

Graphify 输出 `graphify-out/graph.html`、`GRAPH_REPORT.md`、`graph.json`；支持 `/graphify query`、`/graphify path`、`/graphify explain`，也支持 MCP 访问 graph。([GitHub][3])

在 spec-first 中映射为：

| spec-first 需求 | Graphify 能力                          |
| ------------- | ------------------------------------ |
| PRD 当前态理解     | `GRAPH_REPORT.md` + `graphify query` |
| 业务概念定位        | `graphify explain`                   |
| 跨文档/代码关系      | `graphify path` / `shortest_path`    |
| 架构热点          | god nodes / communities              |
| 文档-代码一致性      | graph nodes + source refs            |
| PR 合并风险       | `graphify prs --conflicts`           |

### Adapter 输出

```json
{
  "provider": "graphify",
  "kind": "project_semantic_graph",
  "status": "evidence_candidate",
  "freshness": {
    "graph_json_exists": true,
    "graph_report_exists": true,
    "graph_built_at": "2026-06-03T01:00:00Z",
    "changed_files_since_build": ["docs/api.md"],
    "stale": true
  },
  "facts": [
    {
      "type": "domain_concept",
      "concept": "订单提交流程",
      "paths": ["docs/order.md", "src/order/service.ts"],
      "confidence": "medium",
      "source_read_required": true
    }
  ],
  "gaps": [
    "docs/api.md changed after graph build"
  ]
}
```

### 是否提交 graphify-out？

Graphify README 建议团队提交 `graphify-out/`，让团队成员 pull 后助手可以直接读取图谱，并建议忽略 `manifest.json` 和 `cost.json` 等本地文件。([GitHub][3])

spec-first 可以支持两种模式：

```text
team-shared mode:
  graphify-out/graph.json
  graphify-out/GRAPH_REPORT.md
  可提交

local mode:
  graphify-out/ 只本地使用
```

对你的场景，500+ repo 更适合：

```text
关键仓库 team-shared graph
普通仓库 local/on-demand graph
平台侧维护 global graph registry
```

---

## 4.3 GBrain 接入方案

### 接入位置

GBrain 不应该直接进入低层 `spec-work` 修改代码阶段，而应该优先进入：

```text
spec-prd
spec-plan
spec-debug
spec-code-review
spec-compound
```

### 主要使用能力

GBrain 支持 `gbrain search` 获取原始检索材料，`gbrain think` 生成带 citation 和 gap analysis 的综合回答。([GitHub][5])

它支持本地 PGLite、Postgres + pgvector，brain repo 是 Markdown git repo，数据库用于检索，删除在 git 中变成 DB soft-delete。([GitHub][5])

在 spec-first 中映射为：

| spec-first 需求 | GBrain 能力                            |
| ------------- | ------------------------------------ |
| 历史方案召回        | `gbrain search` / `gbrain think`     |
| 类似 bug RCA    | search + citation                    |
| 架构决策历史        | think + gap analysis                 |
| 团队规范/经验       | brain repo pages                     |
| 冲突经验检测        | gap analysis                         |
| compound 后沉淀  | `gbrain capture` 或 team brain import |

### Adapter 输出

```json
{
  "provider": "gbrain",
  "kind": "institutional_memory",
  "status": "advisory",
  "facts": [
    {
      "type": "historical_decision",
      "summary": "过去拒绝同步扣减库存方案，因为跨市场延迟不可控",
      "citations": [
        "brain://architecture/order-inventory-2025-11"
      ],
      "freshness": "possibly_stale",
      "confidence": "medium",
      "current_source_confirmation_required": true
    }
  ],
  "gaps": [
    "No recent note after 2026-02 migration"
  ],
  "conflicts": []
}
```

### GBrain 的边界

GBrain 的 `brain-vs-memory` 文档强调：world knowledge 放入 GBrain，agent operational state 放入 agent memory，当前上下文仍留在 session。([GitHub][7])

映射到 spec-first：

```text
GBrain 存：
  团队历史、架构决策、复盘、RCA、会议纪要、规范、业务知识

spec-first docs 存：
  当前项目 plan/task/review/solution artifacts

agent/session memory 存：
  当前运行偏好、临时任务上下文
```

---

# 5. 新增核心 Contract / Schema

## 5.1 `context-intelligence-plane.md`

新增：

```text
docs/contracts/context-intelligence-plane.md
```

内容定义：

```text
Provider roles
Query routing
Freshness model
Evidence maturity model
Context pack budget
Confirmation requirements
Promotion rules
Credential/privacy boundary
```

---

## 5.2 `provider-readiness.v1`

```json
{
  "version": "1.0",
  "provider": "codegraph|graphify|gbrain",
  "installed": true,
  "configured": true,
  "available": true,
  "index_exists": true,
  "freshness": "fresh|stale|unknown",
  "current_repo_aligned": true,
  "last_indexed_commit": "abc123",
  "current_commit": "abc123",
  "capabilities": ["search", "impact", "query_graph"],
  "limitations": [],
  "fallback": {
    "used": false,
    "provider": null,
    "reason": null
  }
}
```

---

## 5.3 `context-query.v1`

```json
{
  "version": "1.0",
  "workflow": "spec-plan",
  "intent": "code_impact|semantic_understanding|historical_recall|debug_path|review_blast_radius",
  "question": "新增订单撤单逻辑影响哪些模块？",
  "target_repo": "/repo",
  "target_scope": {
    "paths": ["src/order", "docs/order.md"],
    "symbols": ["submitOrder"]
  },
  "required_maturity": "evidence_candidate|confirmed_context",
  "budget": {
    "max_providers": 3,
    "max_tokens": 4000,
    "summary_first": true
  }
}
```

---

## 5.4 `provider-context-result.v1`

```json
{
  "version": "1.0",
  "provider": "codegraph",
  "intent": "code_impact",
  "status": "ok|degraded|failed|not_run",
  "maturity": "advisory|evidence_candidate|confirmed_context",
  "facts": [],
  "evidence_refs": [],
  "freshness": {},
  "limitations": [],
  "source_read_requirements": []
}
```

---

## 5.5 `context-fusion-summary.v1`

```json
{
  "version": "1.0",
  "query_id": "ctx-20260603-001",
  "providers_used": ["codegraph", "graphify", "gbrain"],
  "confirmed": [],
  "candidates": [],
  "conflicts": [],
  "gaps": [],
  "source_read_required": [],
  "recommended_context_pack": {
    "include": [],
    "exclude": [],
    "reason": []
  }
}
```

---

# 6. Query Router 设计

新增模块：

```text
src/cli/context-intelligence/
  query-router.js
  provider-registry.js
  readiness.js
  freshness.js
  fusion.js
  context-pack-builder.js
  providers/
    codegraph.js
    graphify.js
    gbrain.js
```

路由规则：

| Intent                | 首选                      | 辅助                 | 确认路径                      |
| --------------------- | ----------------------- | ------------------ | ------------------------- |
| code_impact           | CodeGraph               | Graphify           | source-read + tests       |
| symbol_lookup         | CodeGraph               | rg fallback        | source-read               |
| prd_current_state     | Graphify                | CodeGraph + GBrain | docs/code source-read     |
| semantic_relationship | Graphify                | GBrain             | cited docs/source         |
| historical_decision   | GBrain                  | docs/solutions     | citation + freshness      |
| debug_path            | CodeGraph               | GBrain             | logs + source-read        |
| review_blast_radius   | CodeGraph               | Graphify           | diff + source-read        |
| knowledge_promotion   | GBrain + docs/solutions | Graphify           | human/review confirmation |

---

# 7. Workflow 接入方案

## 7.0 可使用 Skill 矩阵

当前最新代码还没有正式集成 GBrain / Graphify / CodeGraph provider。下表定义的是推荐接入顺序和使用边界：

| 优先级 | Skill / Workflow | CodeGraph | Graphify | GBrain | 边界 |
| ------ | ---------------- | --------- | -------- | ------ | ---- |
| P0 | `spec-mcp-setup` | 安装、检测、verify、readiness facts | 检测 graph artifact、refresh 建议 | 连接性、citation/source 可达性 | 只管能不能用，不判断结论是否成立 |
| P0 | `spec-plan` | 代码影响候选、相关文件、受影响测试 | 语义模块/业务概念影响 | 历史决策、类似方案、约束 | 不让 provider 自动扩大 plan scope |
| P0 | `spec-code-review` | changed symbols、callers/callees、blast radius | docs/code mismatch、跨域关联 | 类似事故、历史 rejected solution | provider result 不能直接成为 finding |
| P0 | `spec-debug` | 调用链、实现链、受影响路径 | 业务流程语义 | 历史 RCA / workaround | root cause 必须由当前日志/源码/测试确认 |
| P1 | `spec-prd` | 必要时定位入口代码 | brownfield 当前态、业务概念 | 历史背景/决策约束 | 只辅助 current-state，不编造 WHAT |
| P1 | `spec-work` | 缩小编辑范围、推荐验证 | 默认少用 | 默认少用 | 实现阶段避免上下文膨胀，不新增需求 |
| P1 | `spec-compound` | 非主要写入目标 | 可提示 refresh | verified learning 可导入 | `docs/solutions/` 仍是 source-first learning |
| P2 | `spec-write-tasks` | advisory orientation evidence | 一般不接 | 一般不接 | 不能让 provider 扩大 source plan scope |
| P2 | `spec-doc-review` | 仅核查代码现状声明 | 仅核查语义现状声明 | 仅核查历史约束声明 | 最终仍需 direct source confirmation |
| P2 | `spec-app-consistency-audit` | 复杂 App impact 辅助 | 页面/模块语义辅助 | 历史产品/事故辅助 | 等 provider contract 稳定后再接 |

不建议直接接入：

| Skill / Workflow | 原因 |
| ---------------- | ---- |
| `using-spec-first` | 只做入口路由，不应读取 provider 结果或做语义判断 |
| `spec-update` | 管 spec-first 更新/runtime repair，不承担代码图谱使用 |
| `spec-release-notes` | 与代码上下文 provider 关系弱 |
| `spec-sessions` | 可以作为 GBrain 未来导入来源，但不应混成同一套 truth |

最小落地顺序：

```text
1. spec-mcp-setup
2. spec-plan
3. spec-code-review
4. spec-debug
5. spec-prd
6. spec-work
7. spec-compound
```

## 7.1 `spec-prd`

新增：

```text
Context bootstrap:
  Graphify current-state query
  GBrain historical recall
  CodeGraph entrypoint lookup when needed
```

输出 PRD 时新增章节：

```text
当前系统证据
历史决策/约束
未知点 / gap
需要 source confirmation 的点
```

---

## 7.2 `spec-plan`

新增：

```text
1. Query Router 判断问题类型
2. Graphify 给语义影响面
3. CodeGraph 给代码影响面
4. GBrain 给历史经验/约束
5. Evidence Fusion 生成 plan context pack
```

plan 新增章节：

```text
Context Intelligence Summary
- Code impact candidates
- Semantic/domain impact candidates
- Historical constraints
- Conflicts / gaps
- Required source-read confirmation
```

---

## 7.3 `spec-work`

优先使用 CodeGraph：

```text
before edit:
  codegraph impact / callers / callees / affected tests

during edit:
  source-read confirms exact files

after edit:
  codegraph affected -> verification profile
```

Graphify / GBrain 只在需要业务语义或历史约束时调用，避免实现阶段 token 爆炸。

---

## 7.4 `spec-code-review`

新增三类 review facts：

```text
CodeGraph:
  changed symbols, callers, callees, blast radius, affected tests

Graphify:
  touched domain concepts, docs/code mismatch, shared communities

GBrain:
  similar historical incidents, rejected solutions, team rules
```

finding 规则：

```text
provider result 不能直接成为 finding
provider result + diff/source/test/log 才能成为 finding
```

---

## 7.5 `spec-debug`

流程：

```text
error/log
  -> CodeGraph 调用链/实现链
  -> Graphify 业务流程/文档语义
  -> GBrain 历史 RCA / workaround
  -> source/log/test confirmation
  -> root cause
```

debug 输出新增：

```text
Hypotheses
Evidence chain
Historical analogies
Confirmed root cause
Unconfirmed candidates
```

---

## 7.6 `spec-compound`

compound 后做双写候选：

```text
docs/solutions/
  source-of-truth learning

GBrain capture/import
  team memory recall layer

Graphify refresh
  project graph current-state layer
```

但必须有 promotion gate：

```text
只有已验证 solution / reviewed decision / repeated RCA 才能进入 durable memory。
```

---

# 8. Refresh / Freshness 机制

三者最大风险不是“工具不准”，而是“索引过期”。

## 8.1 CodeGraph freshness

检测：

```bash
codegraph status --json
git rev-parse HEAD
```

判断：

```text
.codegraph 存在
index commit == current commit
changed source files since index == 0
MCP 可启动
```

刷新：

```bash
codegraph sync
# 或
codegraph index --force
```

CodeGraph MCP server 本身会监听文件变化并增量同步，但 spec-first 仍应在 workflow start / before review 做 explicit readiness check。([GitHub][2])

---

## 8.2 Graphify freshness

检测：

```text
graphify-out/graph.json exists
graphify-out/GRAPH_REPORT.md exists
changed files since graph build
docs/PDF/images changed since graph build
```

刷新：

```bash
/graphify . --update
graphify extract . --force
```

Graphify README 说明 `--update` 可重提取 changed files，`graphify hook install` 可在 commit 后自动 rebuild，docs 或 papers 变化后需要 `/graphify --update`。([GitHub][3])

---

## 8.3 GBrain freshness

检测：

```bash
gbrain doctor
gbrain search stats
gbrain search "<query>" --explain
```

判断：

```text
brain reachable
source repo imported
latest docs/solutions imported
citation exists
staleness/gap analysis present
```

刷新：

```bash
gbrain import docs/solutions
gbrain capture --file ...
```

GBrain 的 brain repo 是 system of record，Markdown 文件同步到数据库用于检索；因此 spec-first 应该把 `docs/solutions` / review / validation 等产物先作为 source，再导入 GBrain。([GitHub][5])

---

# 9. 安装与 Profile 策略

不建议所有用户默认安装三者，但对于你的目标，不能把它们永远放 optional。建议 profile 分层：

| Profile     | 目标用户      | 默认能力                                          |
| ----------- | --------- | --------------------------------------------- |
| minimal     | 个人轻量使用    | 不安装三者，只支持 fallback                            |
| recommended | 正式项目      | CodeGraph 默认推荐，Graphify/GBrain 给 install plan |
| platform    | 团队/部门级    | CodeGraph + Graphify + GBrain 纳入标准能力          |
| enterprise  | 500+ repo | 中央 registry、批量 refresh、权限、审计、成本治理             |

近期落地应优先放在 `spec-mcp-setup` 的 provider readiness / install plan 中，而不是立即新增多个 package CLI 顶层命令：

```text
spec-mcp-setup provider detection:
  - check installed / configured / available
  - check index artifact / freshness / repo alignment
  - emit provider-readiness facts
  - emit install plan
  - require explicit opt-in before install
```

远期平台化后，可以再考虑独立 CLI 命令面：

```bash
spec-first providers doctor
spec-first providers plan --profile recommended
spec-first providers install --name codegraph
spec-first providers verify --name codegraph
spec-first context query --intent code_impact "撤单影响哪些模块"
spec-first context refresh --provider codegraph
spec-first context refresh --provider graphify
spec-first memory import --provider gbrain docs/solutions
```

这些命令在当前代码中尚不存在，不能写成当前可执行路径。近期文档和计划应表述为 planned platform surface 或 future CLI surface。

---

# 10. 对当前版本路线的调整建议

你当前 version-split 里 v1.16 才是 Optional Provider Pack，并且 minimal 不安装 GBrain / Graphify / CodeGraph。([GitHub][8])

如果目标是更强的 Context Intelligence Harness，我建议调整为：

```text
v1.11 Context Provider Readiness Foundation
  provider-readiness / freshness / install-plan / verify-plan

v1.12 CodeGraph Core Integration
  进入 spec-plan / spec-work / spec-code-review / spec-debug

v1.13 Context Evidence Fusion
  context-query / provider-result / fusion-summary / context-pack-builder

v1.14 Graphify Project Graph Integration
  进入 spec-prd / spec-plan / spec-code-review / spec-compound

v1.15 GBrain Memory Integration
  进入 spec-plan / spec-debug / spec-code-review / spec-compound

v1.16 Context Intelligence Router
  自动选择 CodeGraph / Graphify / GBrain / fallback

v1.17 Context Maturity + RuleMaturity
  advisory -> candidate -> confirmed -> durable knowledge -> governance rule
```

也就是：**CodeGraph 提前，Graphify 居中，GBrain 后置；但三者从 v1.11 开始就被纳入架构。**

---

# 11. 关键验收标准

## 11.1 CodeGraph 验收

```text
1. 未初始化 .codegraph 时，doctor 报 not_configured。
2. codegraph status 可读时，输出 index stats。
3. spec-plan 能生成 related files/symbol candidates。
4. spec-code-review 能生成 changed symbol blast radius。
5. codegraph affected 能进入 verification recommendation。
6. stale index 不能写成 confirmed_context。
```

## 11.2 Graphify 验收

```text
1. graphify-out/graph.json 缺失时报 not_configured。
2. GRAPH_REPORT.md 存在时可提取 god nodes / surprises summary。
3. spec-prd 能引用项目语义当前态。
4. spec-plan 能输出 semantic impact candidates。
5. graph stale 时必须提示 refresh。
6. Graphify result 必须带 source paths，不允许只有抽象概念。
```

## 11.3 GBrain 验收

```text
1. gbrain doctor 失败时不阻塞核心 workflow，但标记 memory unavailable。
2. spec-plan 能召回历史决策并带 citation。
3. spec-debug 能召回类似 RCA。
4. spec-code-review 能召回历史事故/规范。
5. stale / conflicting memory 必须显示 gap，不得直接当规则。
6. spec-compound 只能把 verified learning 导入 GBrain。
```

## 11.4 Fusion 验收

```text
1. 同一问题能并行收集 CodeGraph / Graphify / GBrain 输出。
2. Fusion summary 能区分 confirmed / candidate / advisory / conflict / gap。
3. Context Pack 不塞 raw graph.json、大日志或全文 brain pages。
4. 所有 provider facts 有 provenance、freshness、confidence、limitations。
5. provider result 与 source-read 冲突时，source-read 优先。
```

---

# 12. 最终技术判断

这三个组件应该集成，而且应该比当前 roadmap 更主动地集成。

但集成方式不是：

```text
把三个工具装上，然后在 prompt 里提醒 AI 可以用
```

而是：

```text
把三者抽象成 spec-first 的 Context Intelligence Plane
```

最终能力目标是：

```text
CodeGraph 负责回答：当前代码怎么连？
Graphify 负责回答：当前项目怎么组织？
GBrain 负责回答：过去为什么这么做？
spec-first 负责回答：基于当前代码、项目语义和历史经验，这次应该如何计划、实现、验证、评审和沉淀？
```

一句话方案：

> **把 GBrain / Graphify / CodeGraph 从 optional provider 升级为 spec-first 的上下文智能底座；用 readiness、freshness、query router、evidence fusion、context maturity 和 source confirmation 管住可信度，而不是用当前 spec-first 的既有边界把它们长期压成 advisory。**

[1]: https://github.com/colbymchenry/codegraph/blob/main/CLAUDE.md "codegraph/CLAUDE.md at main · colbymchenry/codegraph · GitHub"
[2]: https://github.com/colbymchenry/codegraph "GitHub - colbymchenry/codegraph: Pre-indexed code knowledge graph for Claude Code, Codex, Gemini, Cursor, OpenCode, AntiGravity, Kiro, and Hermes Agent — fewer tokens, fewer tool calls, 100% local · GitHub"
[3]: https://github.com/safishamsi/graphify "GitHub - safishamsi/graphify: AI coding assistant skill (Claude Code, Codex, OpenCode, Cursor, Gemini CLI, and more). Turn any folder of code, SQL schemas, R scripts, shell scripts, docs, papers, images, or videos into a queryable knowledge graph. App code + database schema + infrastructure in one graph. · GitHub"
[4]: https://graphify.net/ "Graphify — Open-Source Knowledge Graph Skill for AI Coding Assistants"
[5]: https://github.com/garrytan/gbrain "GitHub - garrytan/gbrain: Garry's Opinionated OpenClaw/Hermes Agent Brain · GitHub"
[6]: https://github.com/sunrain520/spec-first/blob/leo-2026-06-02-runtime/docs/contracts/ai-coding-harness.md "spec-first/docs/contracts/ai-coding-harness.md at leo-2026-06-02-runtime · sunrain520/spec-first · GitHub"
[7]: https://github.com/garrytan/gbrain/blob/master/docs/guides/brain-vs-memory.md "gbrain/docs/guides/brain-vs-memory.md at master · garrytan/gbrain · GitHub"
[8]: https://github.com/sunrain520/spec-first/blob/leo-2026-06-02-runtime/docs/00-%E7%89%88%E6%9C%AC%E8%B7%AF%E7%BA%BF/2026-06-03-scale-engine-fusion-version-split.md "spec-first/docs/00-版本路线/2026-06-03-scale-engine-fusion-version-split.md at leo-2026-06-02-runtime · sunrain520/spec-first · GitHub"
