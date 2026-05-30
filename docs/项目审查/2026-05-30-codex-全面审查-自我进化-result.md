---
doc_role: review-result
authority: review-evidence
status: superseded-by-index
canonical_index: 2026-05-30-codex-100轮审查后当前优化点.md
pairs_with: 2026-05-30-codex-全面审查-自我进化.md (本文是其 100 轮原始审查的复审收敛)
note: Codex 链复审结论(P0-P6)。已被 canonical_index 收敛吸收;查方向以 index 为准,本文保留为推导证据。
---

# 2026-05-30 Codex 全面审查：自我进化复审结论

## 复审结论

`2026-05-30-codex-全面审查-自我进化.md` 已完成两批共 100 轮多视角审查，覆盖 `Codebase -> Graph -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge` 全链路。第二轮第 51-100 轮吸收 Claude prior report、GitHub/X 调研和外部一手资料，把第一轮“方向判断”进一步压缩成 CUD backlog 与可落地优先级。复审后的核心结论是：

spec-first 当前最需要的不是继续增加公开 workflow，而是把已有 workflow 变成可度量、可复盘、可比较的工程闭环。也就是说，下一阶段主线应从“把链路搭完整”转向“证明链路真的提升交付质量”。

复审时还检查了同目录 Claude 分析文件 `2026-05-30-全面审查-自我进化.md`。该文件已推进到 40 轮，作为 `prior_report/advisory evidence` 保留不动；Codex 文档第二轮显式吸收其中关于 current-state、definitions-only graph、handoff、Evaluation 三角、invariant matrix、mutation boundary、prompt injection、CRG/Trellis/Qoder/知识基座等洞察，并继续追加为第 51-100 轮。

## 完成性核对

| 要求 | 当前证据 | 结论 |
| --- | --- | --- |
| 阅读角色契约并以其为判断基线 | 本轮执行前读取 `docs/10-prompt/结构化项目角色契约.md` | 完成 |
| 对核心链路做 50 轮多视角审查 | 主文档 `## 50 轮次审查` 下包含第 01 至第 50 轮 | 完成 |
| 再次进行 50 轮调研分析优化 | 主文档 `## 第二轮 50 轮次调研分析优化` 下包含第 51 至第 100 轮 | 完成 |
| 结合外部行业研究 | 主文档记录 Anthropic、OpenAI、GitHub Spec Kit、Kiro、GitHub Copilot、Gemini CLI、METR、OpenTelemetry 等一手资料，并新增 GitHub/X search signals | 完成 |
| 不局限当前实现，提出演化方向 | 100 轮中多次提出 Evaluation Harness、workflow semantic eval、friction audit、artifact discoverability、host adapter matrix、current-state brief、review merge dry-run、invariant matrix | 完成 |
| 产出主审查文档 | `docs/项目审查/2026-05-30-codex-全面审查-自我进化.md` | 完成 |
| 复审后产出 result 文档 | 本文件 | 完成 |

## 关键发现

1. **系统定位成立。** spec-first 已明显超出 prompt collection，具备 repo-local source/runtime governance、workflow artifact、graph readiness、task-pack identity、review closure 与 knowledge compounding。
2. **最强资产在 Review 与 Evidence。** `spec-code-review` 的 confidence anchor、dedup、coverage disclosure，以及 graph/review-pre-facts 的 provenance 边界，是当前最接近“工程级 AI 审查”的部分。
3. **最大缺口在 Evaluation Harness。** 目前能说明流程做了什么，但还不能系统说明流程让用户少返工、少误判、更快交付了多少。
4. **Graph 应继续是 evidence input，不是语义权威。** 当前 GitNexus readiness/freshness 边界设计正确，下一步应强化 source-confirmed consumption，而不是急于把 graph 升为 primary。
5. **Spec 是入口，不应成为唯一护城河。** 外部 Spec Kit/Kiro 正在强化 spec-driven 心智；spec-first 的差异化应落在 evidence/review/knowledge closure，而不是“也有 spec 文档”。
6. **双宿主 projection 是优势也会变成维护税。** Claude/Codex/Gemini/Copilot 等 host 指令层正在标准化，spec-first 应维护 source-governed adapter matrix，而不是复制 host-specific 语义。
7. **Knowledge 节点需要 freshness discipline。** `docs/solutions/` 已有价值，但需要轻量 index、last_verified、stale signal，避免知识沉淀变成陈旧上下文。
8. **第二轮最强收敛点是“消费证明”。** graph fields、run artifacts、solutions、review summaries 已经存在；下一步应证明它们被 downstream 读到并影响决策，再决定是否扩能力。
9. **GitHub/X 调研支持但不决定方向。** GitHub 显示 context engineering、coding-agent benchmark、agent-safe retrieval 等方向活跃；X 显示 spec-driven/context engineering/AGENTS.md 热度。但这些只能作为 watchlist 或 secondary evidence，不能替代 source-confirmed project gaps。

## 下一阶段最小路线

### P0：Consumption Evidence MVP

目标：先证明现有 artifacts 是否被下游消费。

最小字段：`artifact_ref`、`read_by_workflow`、`used_for_decision`、`ignored_reason`、`source_confirmation`。首批覆盖 graph fields consumed、solutions hit telemetry、run artifact downstream consumption。

边界：只记录消费事实，不判断语义价值；语义价值仍由 review/self-reflection 判断。

### P1：Workflow Outcome Ledger

目标：用最小 schema 记录 workflow 是否产生价值。

建议字段：`goal`、`workflow_path`、`artifact_refs`、`feedback_loop`、`validation_result`、`review_result`、`residual_risk`、`rework_signal`、`downstream_consumed`。

边界：只记录事实，不让脚本判断“是否成功”；成功解释仍由 LLM/人类完成。

### P2：Friction Audit

目标：用真实任务验证 spec-first 是否降低使用者研发摩擦。

样本：first-run、标准 feature、bug debug、review autofix、compound learning 至少各 1 个。记录时间、卡点、重复输入、降级原因、最终是否 ship。

边界：这是产品/工程实证，不是新增 workflow。

### P3：Core Workflow Semantic Eval

目标：给 `using-spec-first`、`spec-brainstorm`、`spec-plan`、`spec-work`、`spec-code-review` 建立 fresh-source eval fixtures。

重点场景：应触发/应跳过、graph stale 降级、scope gate、provider-only finding rejection、source/runtime 边界。

边界：eval 检查行为语义，不替代 unit/contract tests。

### P4：Artifact Discoverability Index

目标：让 agent 和用户知道每个阶段该读哪个 artifact、哪个是 source、哪个是 generated/degraded/advisory。

最小形态：一张 `artifact -> producer -> consumer -> authority_level -> freshness -> default_read_policy` 表。

边界：先文档化，不急着做 registry 服务。

### P5：Knowledge Freshness

目标：让 `docs/solutions/` 变成可复用知识，而不是历史堆积。

最小形态：为新 solution 增加 `verified_against`、`last_verified`、`stale_signal`；对旧 solution 只做窄范围 refresh。

边界：不构建知识图谱，不全量重写。

### CUD Backlog

| CUD | 目标 | 当前建议 |
| --- | --- | --- |
| CUD-A | Evaluation + consumption evidence MVP | 立即进入 plan 候选 |
| CUD-B | scoped current-state brief | 等 CUD-A 能证明 context artifacts 被消费后再计划 |
| CUD-C | review deterministic merge dry-run | 独立大型 plan，先做 fixture/dry-run，不改 review 语义 |
| CUD-D | knowledge retrieval/freshness | 可与 CUD-A 的 solutions hit telemetry 同步试点 |
| CUD-E | invariant matrix | 先做 6 条核心 invariant，不做大全 |
| CUD-F | graph consumption contract tightening | 可作为 CUD-A 的第一批消费证明字段 |

## 明确不建议

- 不建议新增一批公开 workflow 来覆盖每个细分意图。入口越多，source/runtime、README、routing、tests、CHANGELOG 成本越高。
- 不建议把 GitNexus 或任何 provider 结果升级为默认语义权威。必须保持 source-confirmed。
- 不建议把 run artifact 发展成强状态机。它应是 resume/review/compound 的证据，不是任务进度真相源。
- 不建议把外部 host 的能力变化直接复制为 spec-first feature。应先判断 complement/compete，再决定是否消费或收缩。
- 不建议用 X/Twitter 热度直接驱动 source 变更。社交讨论只进入 watchlist。
- 不建议先做 dashboard、marketplace、knowledge graph 或 per-turn hook。先证明现有 artifacts 被消费。

## 最终判断

spec-first 的下一轮演化目标应是：

> 让每一次 `Spec -> Plan -> Tasks -> Code -> Review -> Knowledge` 都留下足够小、足够可信、足够可消费的证据，使后续 agent 能更快进入正确上下文，review 能更少假阳性，debug 能更快确认根因，knowledge 能更少陈旧，用户能更清楚看到研发质量真的提高。

第二轮把最终落点进一步收窄为：

> 先证明 artifacts 被消费，再证明消费改善结果，最后才扩展能力。

这比继续堆叠 workflow 更符合 `Light contract + Explicit boundaries + Let the LLM decide`，也更接近 spec-first 作为 AI coding harness 的长期价值。
