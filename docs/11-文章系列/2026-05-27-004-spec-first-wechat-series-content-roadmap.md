---
name: spec-first-wechat-series-content-roadmap
description: spec-first 微信公众号第一季内容路线图：12 篇最小叙事包、每周三篇结构、证据票据与可回流资产
metadata:
  type: project
---

# spec-first 微信公众号第一季内容路线图

**状态：** 建议稿
**日期：** 2026-05-27
**当前基线：** 第 1 篇已发布：`docs/11-文章系列/01-spec-first.md`
**关联规划：** `docs/11-文章系列/2026-05-27-003-spec-first-wechat-series-requirements.md`
**Ideation 记录：** `docs/ideation/2026-05-27-spec-first-wechat-series-content-ideation.md`

---

## 结论

第一季先做 **12 篇最小产品化叙事包**，不要无限铺开。

核心目标不是把 spec-first 的所有功能讲完，而是完成 4 件事：

1. 把第一篇的 `Workflow` 心智升级为 `AI Coding Harness`。
2. 用 12 篇建立读者对 Context / Spec / Plan / Review / Knowledge 的基本地图。
3. 每篇绑定一个 evidence ticket，避免写成泛 AI 观点文。
4. 每 4 篇沉淀一个公开资产，最终形成可转发、可收藏、可复用的入门包。

第一季主线：

```text
Prompt 问题
  -> Workflow 问题
  -> Harness 问题
  -> Evidence / Review / Knowledge 闭环
```

## 每周结构

每周约 3 篇，建议固定成：

| 位置 | 内容类型 | 作用 | 写作重心 |
|---|---|---|---|
| 文章 A | 观点篇 | 传播入口，回答为什么 | 反模式、行业语境、读者痛点 |
| 文章 B | 机制篇 | 建立理解，回答怎么工作 | Harness 层、workflow 节点、artifact |
| 文章 C | 取舍 / 案例篇 | 建立信任，回答为什么这样设计 | Building in Public、真实 failure、边界取舍 |

每篇文章都要有：

- 一个读者熟悉的失败场景
- 一个 Harness 坐标
- 一个 evidence ticket
- 一个可带走的判断或 checklist
- 一个轻量下一步动作

## 第一季 12 篇目录

> **标题格式约定：** 所有系列文章正文标题统一为 `Spec-First：xxxx`。下表“建议标题”列已按此格式给出；`xxxx` 为论点式主题，写作时仍可微调措辞，但保留 `Spec-First：` 前缀。

| # | 内容类型 | 建议标题 | 核心论点 | Evidence ticket | 回流资产 |
|---|---|---|---|---|---|
| 01 | 已发布 | Spec-First：AI Coding 不是 Prompt 问题，而是 Workflow 问题 | AI coding 的瓶颈在 workflow，不在 prompt | `01-spec-first.md` | 系列入口文 |
| 02 | 枢纽 | Spec-First：从 Workflow 到 AI Coding Harness | Harness 是把不稳定 AI 推理放进可重复、可观察、可约束、可验证闭环 | `docs/contracts/ai-coding-harness.md`、系列规划 C-07 | Harness 六层图 |
| 03 | 观点 | Spec-First：为什么你不敢把任务真正交给 AI | 信任问题来自意图、上下文、证据、review、知识都没有工程化 | 外部趋势源 + 第一篇痛点 | AI Coding Workflow 自测清单 |
| 04 | 机制 | Spec-First：Context Harness——正确上下文不是无限上下文 | AI 需要 bounded decision inputs，而不是无限读仓库 | `workflow-host-instruction-reuse-policy-2026-05-25.md` | Context 选择清单 |
| 05 | 机制 | Spec-First：别再让 AI 猜你的代码——Graph 如何改变决策输入 | Graph/readiness facts 是 Context/Evidence 层，不是炫技 | `docs/contracts/graph-evidence-policy.md`、GitNexus readiness docs | Graph evidence 解释卡 |
| 06 | 取舍 | Spec-First：不要修生成物，要修 Source-of-Truth | generated runtime 出错时必须回 source/generator，而不是手改 mirror | `modify-source-not-artifacts-2026-04-13.md` | Source/runtime 边界卡 |
| 07 | 观点 | Spec-First：Spec 不是文档负担，是给 Agent 的压缩上下文 | Spec 是轻量任务边界，不是传统重文档 | 角色契约的 `Light contract` | Spec 最小字段卡 |
| 08 | 机制 | Spec-First：Plan 如何防止 AI 在执行中跑偏 | Plan 的价值是约束 scope、验证、风险和 handoff | README workflow artifacts、plan docs | Plan anti-drift checklist |
| 09 | 取舍 | Spec-First：Scripts prepare, LLM decides——同步上游不是复制文件 | 脚本列事实，LLM 做语义适配；不要让脚本假装架构师 | `upstream-ce-sync-upgrade-methodology-2026-04-26.md` | Script/LLM 职责边界卡 |
| 10 | 机制 | Spec-First：Review Harness——为什么“你再检查一下”没用 | Review 需要角色、证据、影响面、降级和 residual risk | `reviewer-dispatch-failure-2026-05-07.md`、doc-review dispatch learning | Review checklist |
| 11 | 机制 | Spec-First：Knowledge Harness——每次修复都应该变成下次输入优势 | 经验不能留在聊天记录，应变成可发现、可刷新、可复用的 learning | `docs/solutions/`、compound 相关 docs | Knowledge capture 模板 |
| 12 | 案例 | Spec-First：真实跑一圈——从模糊需求到 Review 和 Knowledge | 用一个小任务展示 Spec -> Plan -> Work -> Review -> Knowledge 如何闭环 | 选一个可公开的小型任务 artifact | End-to-end walkthrough |

## 第一季资产节奏

每 4 篇沉淀一个对外资产：

| 阶段 | 覆盖文章 | 资产 | 用途 |
|---|---|---|---|
| 阶段 1 | 01-04 | AI Coding Workflow 自测清单 | 帮读者诊断自己卡在哪一层 |
| 阶段 2 | 05-08 | AI Coding Harness 六层图 + artifact map | 帮读者理解 spec-first 不是 prompt pack |
| 阶段 3 | 09-12 | spec-first 真实闭环案例合集 | 帮读者从认同观点进入试用 |

这些资产可以回流到 README、官网、用户手册或后续演讲材料。

## 证据票据模板

每篇开写前填写：

```text
文章编号：
核心失败场景：
Harness 坐标：
本地证据：
外部证据（如有，发布前重查）：
需降敏内容：
读者可带走的判断：
回流资产：
下一步动作：
```

## 选题池：第二季候选

第一季完成后，再扩展以下方向：

- `doctor` / `init` / `mcp-setup` 的冷启动路径。
- Graph readiness、dirty-advisory、definitions-only evidence 的细节系列。
- 双宿主 Claude Code + Codex 的治理故事。
- `spec-debug` 如何把失败变成 hypothesis ledger。
- `spec-optimize` 如何做度量驱动优化。
- `spec-compound-refresh` 如何处理过期 learning。
- release / changelog / source-runtime drift 的真实案例。
- AI coding agent 安全、权限、审计、sandbox 的治理边界。

## 不建议第一季优先写

- 工具横评：Claude Code vs Codex vs Cursor。
- 纯安装教程：第一篇已有 Quick Start，后续可放到第二季或官网。
- 全量命令手册：容易削弱 Harness 心智。
- 纯外部趋势评论：缺少 spec-first 的独特证据。
- 项目流水账：Building in Public 应写架构取舍，不写进度播报。

## 下一篇建议

下一篇优先写：

> Spec-First：从 Workflow 到 AI Coding Harness

这篇要完成三件事：

1. 承接第一篇的 `Workflow` 判断。
2. 明确定义 `AI Coding Harness`。
3. 给后续 10 篇文章提供统一坐标系。

建议进入 `$spec-brainstorm`，先产出这篇文章的 requirements brief，再开正文。
