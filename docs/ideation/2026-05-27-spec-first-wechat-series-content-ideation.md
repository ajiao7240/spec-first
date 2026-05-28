---
date: 2026-05-27
topic: spec-first-wechat-series-content
focus: 规划 spec-first 微信公众号系列文章内容
mode: repo-grounded
---

# Ideation: spec-first 微信公众号系列内容规划

## Grounding Context

### Codebase Context

现有第一篇 `docs/11-文章系列/01-spec-first.md` 已经建立入口心智：**AI Coding 不是 Prompt 问题，而是 Workflow 问题**，并把主链路压缩为 `Codebase -> Graph -> Spec -> Plan -> Code -> Review -> Knowledge`。

现有系列规划 `docs/11-文章系列/2026-05-27-003-spec-first-wechat-series-requirements.md` 已经把叙事从 workflow 升级到 **AI Coding Harness**，并拆出三条内容流：概念思想、Harness 深度、Building in Public。角色契约 `docs/10-prompt/结构化项目角色契约.md` 和 `docs/contracts/ai-coding-harness.md` 进一步提供底层原则：`Light contract`、`Explicit boundaries`、`Scripts prepare, LLM decides`。

当前缺口不是继续补一个松散标题池，而是把第一季收束成可连续发布、可复用、可转化的内容包：每篇都要有一个明确读者问题、一个 Harness 坐标、一个证据票据，以及一个可回流资产。

### Past Learnings

可直接转化为 Building in Public 或 Harness 案例的素材包括：

- `docs/solutions/workflow-issues/modify-source-not-artifacts-2026-04-13.md`：不要修 generated runtime，要修 source-of-truth。
- `docs/solutions/workflow-issues/workflow-host-instruction-reuse-policy-2026-05-25.md`：正确上下文不是无限上下文。
- `docs/solutions/workflow-issues/reviewer-dispatch-failure-2026-05-07.md`：工具失败时 workflow 不应该假装成功。
- `docs/solutions/workflow-issues/doc-review-codex-multi-agent-dispatch-boundary-2026-05-05.md`：调用 workflow 即授权其文档化 reviewer phase。
- `docs/solutions/architecture-patterns/upstream-ce-sync-upgrade-methodology-2026-04-26.md`：同步上游不是复制文件，脚本列事实，LLM 做语义适配。

这些素材需要降敏：隐藏具体网关、token、机器状态、私有路径和完整错误日志，只保留工程结构、决策逻辑和可复用原则。

### External Context

外部趋势支持本系列的上位叙事：2025-2026 的 AI coding 主线正在从补全和聊天转向可派工的 coding agent、spec-driven development、工具权限、审计、review 和 workflow governance。

发布前应重新核对的外部来源：

- OpenAI Codex cloud：<https://openai.com/index/introducing-codex/>
- OpenAI Codex docs：<https://platform.openai.com/docs/codex/overview>
- GitHub Copilot coding agent docs：<https://docs.github.com/en/copilot/using-github-copilot/coding-agent/about-assigning-tasks-to-copilot>
- GitHub Spec Kit：<https://github.com/github/spec-kit>
- DORA 2025 AI-assisted software development report：<https://dora.dev/dora-report-2025/>

## Ranked Ideas

### 1. 第一季做成 12 篇最小产品化叙事包

**Description:** 不把系列无限铺开，先把第一季限制为 12 篇：第 1 篇已发布，后续 11 篇围绕 Harness 定义、Context/Spec/Plan/Review/Knowledge、真实工程取舍和完整案例展开。每周约 3 篇，4 周后形成一个可以收藏、转发、沉淀到官网/README/用户手册的入门资产包。

**Basis:** `direct:` 现有规划已经设定每周 3 篇和三条内容流；第一篇已经完成入口心智，下一步需要把 “workflow” 升级为 “Harness”。

**Rationale:** 限制篇数会迫使系列有结构，不会变成随想更新。12 篇足够覆盖核心心智、关键机制和转化案例，也能作为后续小册或官网专题的骨架。

**Downsides:** 会牺牲部分功能细节，例如 `doctor`、`init`、`mcp-setup` 只能作为案例或后续第二季主题。

**Confidence:** 94%

**Complexity:** Medium

**Status:** Unexplored

### 2. 第二篇必须做 Harness 枢纽文

**Description:** 第一篇已经把读者从 prompt 拉到 workflow；第二篇应回答 “Workflow 之后，到底要搭什么系统？” 文章应定义 AI Coding Harness：把不稳定的 AI 推理放进可重复、可观察、可约束、可验证的工程闭环。后续所有文章都挂到 Harness 的某一层或某个 workflow 节点。

**Basis:** `direct:` `docs/11-文章系列/2026-05-27-003-spec-first-wechat-series-requirements.md` 已经把 C-07 标为系列枢纽文章；`docs/contracts/ai-coding-harness.md` 已给出六层 Harness 结构。

**Rationale:** 如果第二篇直接进入 Graph、Review 或安装教程，系列会像功能散点。Harness 枢纽文能建立共同坐标系，减少后续重复立论。

**Downsides:** 抽象度高，必须搭配具体失败场景，不宜写成概念定义百科。

**Confidence:** 96%

**Complexity:** Medium

**Status:** Unexplored

### 3. 每篇绑定一个 Evidence Ticket

**Description:** 所有文章发布前都填写一个 evidence ticket：本篇依据哪一个本地文档、solution learning、真实 artifact、外部来源或第一性推理。文章结构固定为：问题场景 -> spec-first 原则 -> 证据票据 -> 可复用判断。

**Basis:** `direct:` grounding 发现当前内容偏理念宣言，缺少具体失败案例、前后对比、命令输出和 artifact 示例；`docs/solutions/` 已有多篇可转化素材。

**Rationale:** 证据票据能防止系列滑向泛 AI 评论文，也把 `docs/solutions/` 变成内容资产库。它与 spec-first 自身的 Evidence Harness 一致。

**Downsides:** 写作速度会变慢；外部事实类文章发布前要重新核对来源。

**Confidence:** 93%

**Complexity:** Low

**Status:** Unexplored

### 4. 每周采用“观点 / 机制 / 取舍”三篇结构

**Description:** 每周三篇分别承担不同任务：观点篇负责传播和入口心智，机制篇负责解释 Harness 或 workflow 节点，取舍篇负责 Building in Public 的真实工程故事。每周可以围绕一个主题聚簇，也可以按三流轮播。

**Basis:** `direct:` 现有规划已经确立概念思想、Harness 深度、Building in Public 三条内容流；发散结果也反复收敛到三流固定轮播。

**Rationale:** 固定结构降低选题焦虑，也训练读者预期。它能避免连续理念文疲劳，也避免过早变成工具教程。

**Downsides:** 有些周可能没有足够强的 BIP 素材，需要从 `docs/solutions/` 提前准备。

**Confidence:** 91%

**Complexity:** Low

**Status:** Unexplored

### 5. 用失败模式词典组织传播

**Description:** 不按功能逐个讲，而是从 AI coding 失控场景切入：上下文污染、计划漂移、review 幻觉、generated runtime 被手修、知识断层、工具失败被假装成功。每个失败模式对应一层 Harness 或一个 workflow 解法。

**Basis:** `direct:` 第一篇已经归纳上下文不稳、需求不显式、计划漂移、review 零散、知识无法复利；learnings 中有 source/runtime、review 降级、上游同步等真实故事。

**Rationale:** 失败模式比功能名更容易传播，也更贴近读者经验。它能把复杂治理变成读者熟悉的问题。

**Downsides:** 需要控制标题力度，避免写成焦虑营销或只讲失败不讲建设。

**Confidence:** 89%

**Complexity:** Medium

**Status:** Unexplored

### 6. 做一篇完整闭环案例作为转化资产

**Description:** 选择一个足够小但完整的真实任务，展示如何从一个模糊需求进入 Spec、Plan、Work、Review、Knowledge。文章重点展示 artifact 如何改变下一次决策，而不是命令炫技。

**Basis:** `direct:` grounding 明确指出当前缺少“真实任务如何跑完一圈”的案例型文章；README 已经把 workflow artifacts 作为核心差异点。

**Rationale:** 案例文会成为最强用户转化资产：读者不只是认同理念，而是知道自己该如何试一次。

**Downsides:** 需要准备干净、可公开、不会暴露私有信息的任务样例。

**Confidence:** 90%

**Complexity:** Medium-High

**Status:** Unexplored

### 7. Building in Public 写架构取舍，不写流水账

**Description:** BIP 文章不写“今天做了什么”，而写“这次为什么这样取舍”：为什么不手改 runtime、为什么工具失败要显式降级、为什么脚本只产事实、为什么 Light contract 比复杂状态机更重要。每篇遵循“事故现象 -> 错误边界 -> 修复原则 -> 可复用 learning”的结构。

**Basis:** `direct:` learnings 中 `modify-source-not-artifacts`、`reviewer-dispatch-failure`、`upstream-ce-sync-upgrade-methodology`、`self-reflection-cud-contract-loop` 都适合转化为公开取舍档案。

**Rationale:** 这能让 BIP 成为建立工程信任的内容线，而不是项目更新日志。

**Downsides:** 降敏成本较高；有些内部细节必须抽象处理。

**Confidence:** 92%

**Complexity:** Medium

**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | 直接按命令逐篇写教程 | 容易变成工具手册，弱化 Harness 上位叙事 |
| 2 | 第二篇直接写安装 / Quick Start | 第一篇已有 Quick Start，当前更缺 Harness 枢纽 |
| 3 | 写 Claude Code / Codex / Cursor 横评 | 偏离 spec-first 的 workflow harness 定位，且容易过时 |
| 4 | 无限扩展 36 篇季度大纲 | 当前阶段不够聚焦，第一季应先形成 12 篇最小叙事包 |
| 5 | 纯外部趋势评论 | 缺少 repo 证据，容易同质化 |
| 6 | BIP 写项目进度流水账 | 不如“架构取舍档案”有复用价值 |
| 7 | 每篇都完整重讲 spec-first | 重复成本高，应通过短入口和 Harness 回扣解决 |
| 8 | 先覆盖所有 workflow 节点 | 范围过大，第一季优先覆盖 Harness 心智和最强案例 |

## Recommended Handoff

优先进入下一篇文章草稿，而不是继续扩大标题池。建议 seed：

> 什么是 AI Coding Harness：spec-first 的定位升级

下一步如果需要展开正文，进入 `$spec-brainstorm`，目标是把这篇枢纽文的读者、论点、结构、证据票据和结尾 CTA 明确下来。
