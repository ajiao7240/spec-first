---
date: 2026-05-26
topic: gitnexus-integration-portfolio-80-20
spec_id: 2026-05-26-002-gitnexus-integration-portfolio-80-20
---

# GitNexus 集成需求 portfolio — 按 80/20 + 边际成本重排版

## 文档定位

本文档不是新的 brainstorm，而是对 2026-05-26 同一会话中累计讨论的 GitNexus 相关想法做 portfolio 级 review，按 80/20 + 边际成本原则筛选并重排。

主线 brainstorm（review-pre-facts 4 op 扩展）见 `docs/brainstorms/2026-05-26-001-gitnexus-workflow-context-evidence-requirements.md`。本文档是它的"上下文 + 路线图"补充，回答"这一项主线之外，还应该做什么、不该做什么、按什么顺序"。

2026-05-27 修订：本 portfolio 不再作为"第一波 / 第二波 / deferred" 的分阶段范围裁剪依据。用户目标已调整为完整实现：用 GitNexus 提升 AI coding 的上下文质量和证据质量，同时保持 spec-first Harness 边界。80/20 仍用于决定实现顺序、helper 固化边界和边际成本说明，但不再把 workflow-native session lane、workspace/group resource lane 或 Knowledge lane 推迟到未来需求。

---

## 核心结论

会话中累计讨论的 GitNexus 相关想法经拆分、合并和去重后，重排为四条完整实现 lane：

- **Deterministic helper lane**：`review-pre-facts` 固化 `query/context/impact/detect_changes`，产出 bounded facts。
- **Workflow-native session lane**：`route_map/api_impact/shape_check/tool_map/cypher` 按任务域显式调用，进入 shared evidence envelope。
- **Workspace/group resource lane**：repo/group resources 与 group-aware `query/context/impact` 做多仓/monorepo orientation，不决定写入 scope。
- **Mutation-gated maintenance lane**：`group_sync/rename/analyze/repair/clean` 永不进入普通 workflow 自动化，只能 preview-first 手动或 setup/bootstrap 处理。

**边际成本陡升的三个临界点**仍然成立，但它们只决定"不进入 deterministic helper"，不代表不能在 workflow-native/resource lane 中被完整治理：

1. helper 第 5 个 capability 之后（tool_map 之后每个都是独立 normalize 逻辑）
2. cypher（需要全新 read-only enforcement design）
3. hook 注入第 3 个之后（上下文经济性 + 误触发率反伤）

---

## First Principles / Industry Alignment

AI 辅助编码的行业方向已经从 autocomplete / chat answer 转向 **agentic coding loop**：agent 能接收任务、读取仓库、运行工具/测试、提出 PR 或修复建议。但这并不意味着 spec-first 应追求最多 agent、最多 hook 或最多 provider capability。对 spec-first 来说，第一性原理仍是：

1. **上下文质量优先于工具数量**：GitNexus 只有在把 call graph、impact、change scope 转成 bounded、可验证、可脱敏的 facts 时，才提升 AI coding；直接把更多 raw graph output 注入 prompt 反而增加噪声和 prompt-injection 面。
2. **确定性事实优先，语义判断留给 LLM**：scripts/helper 负责 query-plan、provenance、budget、redaction、degraded reason；LLM 负责 scope、finding、root cause、task ordering 和风险解释。
3. **闭环优先于能力清单**：真正的研发增益来自 `Codebase -> Graph -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge` 链路中证据可流转，而不是 capability catalog 更完整。
4. **先测量再固化**：utilization 和 evidence-to-decision 数据用于决定某个 native capability 是否值得进入 durable helper，不阻止任务域明确时的 session-local 使用。
5. **边界成本必须显性化**：每新增一个 helper operation、hook 注入点或 workflow 消费方，都要证明它减少了重复 source reads、降低 review/debug 漏判或提升任务排序质量；否则保留在 session/resource lane。

Industry signals reviewed for this framing:

- GitHub Copilot coding agent / agent mode: async task execution, repo context, tests/linters and PR review loop.
- OpenAI Codex: cloud/CLI coding agent that can work across software engineering tasks and integrate into engineering workflows.
- Anthropic agent guidance: prefer simple composable workflows, add agent complexity only when it clearly improves outcomes.
- DORA / AI-assisted software development research: AI coding value depends on system conditions and measurement, not tool adoption alone.
- GitHub open-source signals: coding-agent runtimes, context/documentation MCP, spec-driven development, SWE-bench-style evaluation, and AI coding harness projects are all converging on repeatable context + execution + evidence loops.

---

## AI Coding Harness Layer Model

GitNexus 集成不应被理解成"接入更多 graph tools"，而应放进 spec-first 的 AI Coding Harness 分层中评估。每一层只承担自己能稳定证明的职责：

| Harness layer | spec-first owner | GitNexus role | 完整实现落点 | 不拥有的 authority |
|---|---|---|---|---|
| **Context Harness** | `review-pre-facts`、Graph / GitNexus Evidence posture、SessionStart readiness snapshot | 提供 bounded `query/context/impact/detect_changes` pointers、symbol relationships、blast-radius、changed-symbol scope、route/API/tool/group context | helper lane + workflow-native/resource lane | 不决定需求 scope，不自动扩实现范围 |
| **Evidence Harness** | facts normalization、Coverage、debug hypothesis ledger、source-read requirements | 产出 advisory graph evidence，帮助 LLM 找到需要直接读取/验证的代码与测试 | provider-results + shared session evidence envelope | 不单独支撑 finding、root cause 或 merge decision |
| **Execution Harness** | `spec-plan`、`spec-write-tasks`、`spec-work`、review/debug workflows | 作为 plan/task/work/review/debug 的输入事实，不驱动 workflow 状态机 | plan/task/work/review/debug handoff | 不调度任务、不执行 mutation、不替代 LLM 判断 |
| **Evaluation Harness** | run artifacts、Coverage、debug summary、retrospective metrics | 记录 capability 使用、degraded reason、graph-to-finding / graph-to-decision 转化 | utilization + conversion metrics | 不用 adoption 数量伪装效果，必须看决策质量 |
| **Governance Harness** | contracts、redaction、mutation boundary、hook budget、provider readiness | 受 read-only / bounded / redacted / provenance 校验约束 | readiness snapshot、redaction、reason codes、mutation-gated lane | 不运行 `analyze`、repair、`group_sync`、`rename` 等 maintenance action |
| **Knowledge Harness** | `docs/solutions/`、compound / refresh、project standards | 把被验证过的 graph-informed 经验沉淀为可复用知识 | compound / refresh graph-informed learning | 不把 raw provider output 当长期知识 |

由此得到一个更强的完整实现判断：GitNexus 集成不是单点 helper 改造，而是完整 AI Coding Harness 闭环。Helper lane 提升上下文与证据质量，metrics 证明是否真的有效，readiness snapshot 降低 stale/误用风险，redaction 保证 durable artifact 安全，task/work handoff 把 evidence 传到执行，Knowledge lane 把 source-confirmed graph-informed 经验暴露给后续 agent。缺任一项，GitNexus 集成都容易退化成一次性工具调用。

---

## I. 完整实现核心项（历史第一波成本估算）

以下 6 项仍是最高 ROI 的实现核心，但不再表示"只做第一波"。它们必须与 workflow-native/resource/Knowledge lane 一起构成完整 Harness 集成。按"价值 / 成本比"从高到低排，历史成本估算约 **3 周**：

| # | 工作项 | 实际成本 | 边际价值 | 完成标志 |
|---|---|---|---|---|
| **F1** | review-pre-facts 4 op 扩展（即 2026-05-26-001 brainstorm 主线）| 1.5 周（buildQueryPlan / normalize / render / fixture / test）| 极高：唯一真实代码 gap，4 个 capability 的 SKILL ↔ helper 不对称立即闭合 | spec-first 自身仓库 PR review 中产出 ≥1 条非-`query` operation evidence |
| **F2** | GitNexus utilization 度量埋点 | 0.5 周（plan run artifact / code-review Coverage / debug summary 加 `capabilities_used[]` + `graph_to_finding_ratio`）| 极高：所有后续阶段的评估前提；缺它即盲目升级 | 任意 plan/review/debug 输出可数出实际调用了几个 capability |
| **F3** | SessionStart hook 注入 GitNexus readiness snapshot（dual-host 对称）| 0.5 周（helper command + Claude/Codex 模板 + `spec-first init` 写入）| 高：每会话受益；让 LLM 用 stale graph 当 primary evidence 的概率显著下降 | 每次会话开头看到 `query_ready` / dirty 状态 / capability summary（≤500 tokens）|
| **F4** | redaction policy 上线（detect_changes raw diff + 私有 repo 标识符）| 0.5 周（复用 `src/cli/helpers/secret-deny-patterns.js` + 加 `redaction_status` field）| 高：安全 baseline，缺少会出真实事故；F1 落地的硬前置 | detect_changes raw 不进 durable artifact；私有 repo 标识符进前必脱敏 |
| **F5** | spec-write-tasks 消费 plan evidence（零代码改 SKILL prose）| <1 天 | 高 / 成本极低：task 顺序 / test focus 立即受益；隐藏的最高 ROI 工作 | task pack 含基于 plan impact / detect_changes 的 task 顺序与 test_focus |
| **F6** | discoverability 一行修补（CLAUDE.md / AGENTS.md 引用 `docs/solutions/`）| 5 分钟 | 中 / 成本最小：避免未来 agent 漏掉知识库 | 一行索引写入既有目录段落 |

完成这些核心项后，GitNexus 集成的基础 Harness 闭环成立；但完整实现还必须补齐下方 session/resource/Knowledge 治理，否则深能力仍会退回一次性工具调用。

---

## II. Workflow-native / Knowledge 固化项（不再作为未来阶段）

这些项目不应再被理解为"等第二阶段再做"。完整实现必须给它们定义 session/resource evidence envelope、消费规则、redaction 和验收；F2 度量只决定它们未来是否值得进入 deterministic helper。

| # | 工作项 | 完整实现要求 | 实际成本 |
|---|---|---|---|
| **G1** | `tool_map` session evidence | tool/MCP/RPC surface 任务可显式调用；summary 进入 shared evidence envelope；是否升入 helper 由 utilization 决定 | 1 周 |
| **G2** | hook parity matrix contract | 保持 helper-first；Codex/Claude hook 注入只承载 readiness/context snapshot，不承载 workflow 决策 | 2 天 |
| **G3** | spec-compound / refresh 接入 GitNexus | 只沉淀 source-confirmed graph-informed learning；raw provider output 不进入长期知识 | 1 周 |

这些项属于完整实现范围。可以按依赖顺序执行，但不能在需求/方案层标记为未来可选。

---

## III. 不进入 helper 但进入其他 lane 的能力

以下能力不进入 deterministic helper，但完整实现必须说明如何在 session/resource lane 使用或为什么保持 mutation-gated：

| # | 工作项 | 完整实现处理 |
|---|---|---|
| **D1** | helper 增 `route_api_evidence` / `shape_check` | 不进 helper；API/web/backend 任务使用 `route_map/api_impact/shape_check` session evidence envelope |
| **D2** | helper 增 `cypher` | 不进 helper；高级 session call，必须 schema-first、read-only、bounded query/result、redacted summary |
| **D3** | spec-release-notes 接入 GitNexus | 默认用 git/detect_changes summary；需要时可消费 source-confirmed graph evidence，不新增 release 专属 pipeline |
| **D4** | spec-optimize 接入 GitNexus | 只把 GitNexus utilization 作为优化输入；不让 graph provider 决定优化目标 |
| **D5** | spec-brainstorm 深度集成 | 只做 lightweight query/context orientation，避免需求阶段被实现细节反向污染 |
| **D6** | UserPromptSubmit 关键词 routing 提示 | 不做自动关键词 routing；使用 readiness snapshot 和 workflow prose 降低误触发 |
| **D7** | helper 集成 `repo_registry` / `workspace_group` | 不在 helper 复制；走 workspace/resource lane 和 existing readiness artifacts |
| **D8** | spec-first 作为 Codex plugin 发布 | 分发治理独立，不影响本次 Harness integration source 实现 |

---

## IV. 永不进入普通自动化

| 类别 | 边界 |
|---|---|
| `workspace_group_sync` / `symbol_rename` 等 mutation tools | 仅独立 preview-first maintenance plan |
| spec-graph-bootstrap / spec-mcp-setup（readiness 写入面）| **producer 角色**，不消费 helper facts |
| using-spec-first / spec-slack-research / spec-sessions / spec-polish-beta | 领域无关，不集成 |

---

## V. 边际成本曲线（让取舍可见）

```text
helper capability 数  →   1    2    3    4    │ 5  │   6     7    8   │  9
                         query ctx  imp  det  │ TM │ route api  shape │cypher
                         ── F1 范围 ──────────┘    └─ G1 ─┘ ─── D1 ────┘   D2
边际成本               低 低 低 低    低     中  中  中    高 ↑↑↑
                         复用底盘                          独立 normalize         新 enforcement

skill 接入数         →   4    5      6        7         │  8       9
                         已用  +tasks +compound +audit   │ +brainstorm
                         ── F5 ─ G3 ── G1 ──────────────┘   D5
边际成本               零   零    低     低                 中-高 ↑

hook 注入点数         →   1            2              3              │ 4
                         SessionStart  PreToolUse     PostCompact    │ UserPrompt
                         ── F3 ──── G2 兜底 ──────── (低优先级) ─────┘  D6
边际产出               高    高     中     低             负 ↑↑↑（误触发）
```

**三个临界点的工程含义**：

- helper 第 5 个之前都是复用 normalize/render 底盘；第 5 个之后每个 capability 都需独立逻辑
- skill 第 7 个之前是改 SKILL prose 的零-低成本接入；第 7 个之后才需要新 capability 配合
- hook 第 4 个之后边际产出转负（污染上下文 + 误触发率上升）

---

## VI. 主线 brainstorm 的最终定位

`docs/brainstorms/2026-05-26-001-gitnexus-workflow-context-evidence-requirements.md` 是完整 WHAT/scope source，不再只是 F1/helper 单点需求。它已经补齐三类关键信息，可直接进入技术方案与执行计划：

1. **Deterministic helper selection criteria**：解释为什么 durable query-plan 固化 `query/context/impact/detect_changes`，以及为什么未进入 helper 不等于 GitNexus capability 不可用。
2. **SKILL ↔ helper boundary**：helper 只产出 bounded facts；route/API/shape/tool/Cypher/group 能力通过 workflow-native session lane 或 resource lane 使用，并用 `out_of_scope_for_deterministic_helper` 明确披露。
3. **Complete capability lanes**：deterministic helper lane、workflow-native session lane、workspace/group resource lane、mutation-gated maintenance lane 同属完整实现范围，只是治理机制不同。

后续 plan/design 的正确动作不是把 001 压回"只做 4 op helper"，而是保留 lane model：helper 做确定性 facts，SKILL/LLM 做任务域 native GitNexus evidence，资源 lane 做多仓 orientation，mutation lane 保持 preview-first/manual。

---

## VII. 治理边界（跨所有 lane 共享）

1. GitNexus 不决定 scope authority / finding / root cause / 业务优先级
2. Helper command 负责 deterministic facts；workflow-native session calls 负责任务域深 evidence；两者都只产出 advisory context
3. mutation-capable surface 永不进 normal workflow
4. workspace/group resources 只做 repo/service orientation，不自动决定写入目标或扩大 scope
5. hook / startup 注入 ≤500 tokens / 注入点；readiness snapshot 只表达 know-that，不重复完整 know-what
6. utilization baseline 用于决定 native capability 是否值得升入 durable helper，不阻止任务域明确时的 session-local 使用
7. 不依赖 hszq-app 等私有样本作为论证基础
8. redaction 是 durable artifact 的硬前置
9. graph evidence 与 source/test/log/contract 冲突时，以可验证非图谱证据为准

---

## VIII. 推荐落地顺序

| 时间 | 工作 | 验收 |
|---|---|---|
| **W1** | Contract / schema / evidence envelope / redaction baseline | helper facts 与 session/resource evidence 都有 provenance、budget、limitations、redaction、source-read requirements |
| **W2** | Deterministic helper lane | `review-pre-facts` 产出并归一化 `query/context/impact/detect_changes`；plan/debug neutral render 与 review backward compatibility 都有测试 |
| **W3** | Workflow-native session lane + workspace/group resource lane | route/API/shape/tool/Cypher/group 能力有明确 SKILL 使用边界、evidence envelope、read-only/budget/redaction 规则 |
| **W4** | Consumer + Evaluation + Knowledge lane | `spec-plan`、`spec-code-review`、`spec-debug`、`spec-work`、`spec-write-tasks`、`spec-compound/refresh` 能消费 graph evidence；utilization 与 conversion metrics 可回看 |
| **Release gate** | Docs / README / changelog / fresh-source eval / focused tests | 完整 Harness 闭环可证明：context 更准、evidence 可追溯、source confirmation 未被削弱、mutation boundary 未破坏 |

---

## IX. 与原版需求清单的映射

| 原版需求条目 | 完整实现落点 |
|---|---|
| A 主线 brainstorm（review-pre-facts 4 op）| Deterministic helper lane，保留为最高 ROI 主干 |
| B0 集成矩阵需求 | 收编为 capability lane / Harness layer map，不作为独立状态机 |
| B1 capability 扩展 | `tool_map`、route/api/shape、Cypher 全部进入 workflow-native session lane；是否升入 helper 由 utilization 决定 |
| B2 utilization 度量 | Evaluation Harness，记录 capability use、degraded reason 和 evidence-to-decision/finding/debug-hypothesis 转化 |
| B3 hook parity matrix | Governance Harness，保持 helper-first；hook/startup 只承载 readiness/context snapshot 和 host-specific 注入边界 |
| B4 hook context injection | Startup readiness snapshot，≤500 tokens，避免 stale graph 被误当 primary evidence |
| B5 cypher | Advanced session lane，schema-first read-only、query/result budget、redacted summary |
| B6 跨 workflow 扩散 | `spec-write-tasks`、`spec-work`、`spec-compound/refresh` 都消费 source-confirmed graph evidence；release/optimize 仅在任务域需要时使用 |
| B7 redaction | Governance Harness 硬前置，覆盖 durable facts、session evidence summary 和 knowledge 沉淀 |
| B8 discoverability | Knowledge Harness，最小 source-first 指引让后续 agent 能找到 `docs/solutions/` |

**原始想法经拆分 / 合并后 → 4 条完整实现 lane + 1 条 mutation-gated 边界**。80/20 的作用是决定落地顺序和 helper 固化边界，不是把能力推迟到模糊未来。

---

## X. 关联文档

- 主线 brainstorm：[2026-05-26-001-gitnexus-workflow-context-evidence-requirements.md](./2026-05-26-001-gitnexus-workflow-context-evidence-requirements.md)
- Codex hook 知识沉淀：[../solutions/tooling-decisions/codex-cli-supports-lifecycle-hooks-2026-05-26.md](../solutions/tooling-decisions/codex-cli-supports-lifecycle-hooks-2026-05-26.md)
- 既有 GitNexus 路线相关 brainstorm / plan：
  - `docs/brainstorms/2026-05-22-001-gitnexus-first-class-capability-plugin-requirements.md`
  - `docs/brainstorms/2026-05-22-003-gitnexus-downstream-workflows-deep-integration.md`
  - `docs/plans/2026-05-23-003-feat-gitnexus-downstream-workflows-deep-integration-plan.md`
  - `docs/plans/2026-05-25-001-gitnexus-only-graph-provider-plan.md`
- 核心 contract：
  - `docs/contracts/graph-evidence-policy.md`
  - `docs/contracts/graph-provider-consumption.md`
  - `docs/contracts/downstream-graph-evidence-consumption.md`
  - `docs/contracts/workflows/review-pre-facts-extraction.md`
  - `docs/contracts/gitnexus-capability-catalog.md`
  - `docs/contracts/workspace-gitnexus-consumption.md`
- helper 主体：`src/cli/helpers/review-pre-facts.js`
- 现有 hook 模板：`templates/claude/hooks/session-start`

---

## 一句话

**80/20 review 把原始想法收敛为完整但有边界的 Harness 集成**：`review-pre-facts` 负责高频 deterministic facts，workflow-native/session/resource lanes 负责任务域深 GitNexus evidence，metrics 证明是否值得把能力升入 helper，mutation-capable tools 永不进入普通自动化。目标不是"更多 GitNexus"，而是让 spec-first 的 Context Harness 与 Evidence Harness 更准确、可追溯、可验证、可治理。
