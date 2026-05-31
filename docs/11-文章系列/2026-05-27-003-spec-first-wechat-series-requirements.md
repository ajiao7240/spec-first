---
name: spec-first-wechat-article-series
description: spec-first 微信公众号系列文章规划——分层框架、三大内容流、初期标题池（含 Harness 定位）
metadata:
  type: project
---

# spec-first 微信公众号系列文章规划

**状态：** 框架已确认，具体标题边写边填
**节奏：** 每周 3 篇
**第一篇：** 已发布 `docs/11-文章系列/01-spec-first.md`
**创建日期：** 2026-05-27

---

## 核心定位（2026-05-27 升级）

系列的叙事框架从"workflow"升级为"Harness"。

> spec-first = **AI Coding Harness** for spec-driven software engineering

Harness 的精髓不是"套一层框架"，而是：
> 把不稳定的 AI 推理，放进一个**可重复、可观察、可约束、可验证**的工程闭环里。

spec-first 本质上已经在做 Harness，只是以前没有把这个概念明确说出来。Harness 有 6 个核心层：

| 层 | 精髓 | 对 spec-first 的意义 |
|---|---|---|
| Context Harness | 给 AI 正确上下文，不给无限上下文 | review-pre-facts、GitNexus、Context bundle、docs/solutions |
| Execution Harness | 把任务执行变成可跟踪流程 | spec-plan → tasks → spec-work 执行骨架 |
| Evidence Harness | 结论必须有证据来源 | graph evidence、source reads、tests、debug ledger |
| Evaluation Harness | 记录有没有真的变好 | utilization、graph-to-finding ratio、debug 命中率 |
| Governance Harness | 权限、边界、安全、降级 | redaction、mutation boundary、provider readiness、hook budget |
| Knowledge Harness | 把经验沉淀给下一次 | spec-compound、docs/solutions/、project standards |

这个框架是系列文章的思想脊梁，应在第 2–3 周用一篇"Harness 定义文章"点明，并在后续各篇中持续呼应。

---

## 目标

| 维度 | 说明 |
|---|---|
| 拉新用户 | 吸引正在用 AI coding 但还未系统化的开发者了解并安装 spec-first |
| 建立思想领导力 | 对 AI coding workflow 输出有深度的观察，建立个人技术影响力 |
| Building in public | 公开记录 spec-first 的设计思考、演化过程和踩坑经历，产生真实感共鸣 |

## 读者分层

**A 型读者（新读者）**：知道 Claude Code / Codex，用过一些 AI 工具，感到流程混乱但还没找到系统方法。
**B 型读者（已有用户）**：已安装或试用过 spec-first，想更深入了解各个 workflow 阶段。

内容策略：概念类文章以 A 型为主入口（A 型进来后可以转化为 B 型），实操类文章以 B 型为主但对 A 型有学习价值，Building in public 两类都读。

---

## 三大内容流

### 流 1：概念 / 思想 层（Concept Stream）

**职能：** 建立"AI Coding Harness"的认知框架，产生思想领导力，吸引对 AI 工程化方法论感兴趣的广泛读者。
**频率：** 1 篇/周
**文章 DNA：** 从问题出发，论点鲜明，结尾有清晰结论；不一定要介绍 spec-first，但观点服务于 Harness 立场。

标题风格示例：
- 「X 不是 Y 问题，而是 Z 问题」
- 「为什么 [普遍做法] 行不通」
- 「[核心观点]：AI coding 下一阶段的真正门槛」

### 流 2：Harness 深度系列（Deep Dive Stream）

**职能：** 把 spec-first 的 Harness 6 层和 workflow 各阶段做成独立可读的深度文章，既教育新用户，也帮助已有用户更深地使用。
**频率：** 1 篇/周
**文章 DNA：** 先讲"没有它时发生什么"（问题），再讲"它是怎么工作的"（原理），最后给出关键控制点或实操建议（落地）。

覆盖两个维度：

**维度 A — Harness 6 层**（从工程层视角讲清楚为什么需要每一层）：
```
Context → Execution → Evidence → Evaluation → Governance → Knowledge
```

**维度 B — Workflow 工作链**（从用户操作视角讲清楚每个阶段怎么用）：
```
Codebase → Graph → Spec → Plan → Work → Review → Knowledge
```

每个节点至少一篇，部分节点可以 2 篇（概念篇 + 实操篇）。两个维度可以交叉：例如"Evidence Harness"对应"Graph + Review"两个 workflow 节点。

### 流 3：Building in Public 系列（BIP Stream）

**职能：** 公开 spec-first 的真实设计决策、演化历程和踩坑经验，建立真实感和社区温度。
**频率：** 1 篇/周（可与前两流轮换）
**文章 DNA：** 以第一人称叙事为主，说明当时面对的选择、为什么这样决定、结果如何；避免变成纯技术说明。

---

## 内容编排模式

建议三流轮换，每周保持节奏多样性：

```
周一：Workflow 深度（最实用，吸引回访）
周三：概念/思想（广泛传播，思想领导力）
周五：Building in Public（轻松真实，社区感）
```

或按主题聚簇：每周围绕同一个 spec-first 阶段，用不同角度写 2-3 篇形成共振。例如：

```
【Review 周】
  - 概念：Review 为什么必须结构化
  - 深度：spec-first 的 Review workflow 是怎么工作的
  - BIP：我为什么把 Review 设计成 6 维度
```

两种模式均可，根据当期写作状态灵活选择。

---

## 初期标题池（未发布，候选）

以下为框架级候选标题，按内容流归类。具体标题在写作时按节奏选取、调整或替换。

> **标题格式约定：** 系列正文标题统一为 `Spec-First：xxxx`，下表候选已按此格式给出；`xxxx` 同时承载该篇核心论点，写作时可微调措辞但保留前缀。完整格式说明见 `2026-05-27-004-spec-first-wechat-series-content-roadmap.md`。

### 流 1：概念层

| 编号 | 候选标题 | 核心论点 |
|---|---|---|
| C-01 | Spec-First：AI 工程的下一个瓶颈，不是模型不够强 | 决策输入质量决定输出质量，不是模型智能 |
| C-02 | Spec-First：为什么我不做 Prompt 框架 | Prompt 是输入形式，Harness 是系统结构；二者不是同一层的东西 |
| C-03 | Spec-First：Spec > Code——结构化意图比代码本身更值钱 | Spec 的可读性、可追踪性、可 review 性远高于代码本身 |
| C-04 | Spec-First：AI coding 的五个反模式 | 把常见错误做法梳理清楚，反推 Harness 的必要性 |
| C-05 | Spec-First：当你同时使用两个 AI coding 工具时 | 双宿主一致性问题引出 governed Harness 的必要性 |
| C-06 | Spec-First：Scripts prepare, LLM decides——我认为最重要的 AI 工程原则 | 分工原则：脚本产出确定性事实，LLM 做语义判断 |
| **C-07** | **Spec-First：从 Workflow 到 AI Coding Harness** | **定义文章：Harness = 把不稳定 AI 推理放进可重复、可观察、可验证闭环** |

> C-07 是系列的枢纽文章，建议在第 2 周发布，确立"Harness"作为整个系列的叙事锚点。

### 流 2：Harness 深度

**2A — Harness 6 层系列**（从工程层视角）

| 编号 | 候选标题 | 对应 Harness 层 |
|---|---|---|
| H-01 | Spec-First：Context Harness——给 AI 正确上下文，而不是无限上下文 | Context |
| H-02 | Spec-First：Execution Harness——把 AI 任务执行变成可跟踪的流程 | Execution |
| H-03 | Spec-First：Evidence Harness——AI 的结论，必须有证据来源 | Evidence |
| H-04 | Spec-First：Evaluation Harness——你的 AI coding 有没有真的变好 | Evaluation |
| H-05 | Spec-First：Governance Harness——权限、边界、降级，AI 工程的安全层 | Governance |
| H-06 | Spec-First：Knowledge Harness——每次 AI coding 的经验都不应该消失 | Knowledge |

**2B — Workflow 工作链系列**（从用户操作视角）

| 编号 | 候选标题 | 对应节点 |
|---|---|---|
| W-01 | Spec-First：代码库的“地图”从哪里来——Graph Bootstrap 的设计逻辑 | Codebase → Graph |
| W-02 | Spec-First：从“猜代码”到“知道代码”——代码图谱如何改变 AI 的决策输入 | Graph → Context |
| W-03 | Spec-First：从想法到 Spec——Brainstorm workflow 的设计逻辑 | Ideate → Spec |
| W-04 | Spec-First：Plan 约束实现——如何让 AI 不在执行中跑偏 | Plan |
| W-05 | Spec-First：执行阶段的治理——AI coding 的五个关键控制点 | Work |
| W-06 | Spec-First：不要再说“你再检查一下”——结构化 Review 的六个维度 | Review |
| W-07 | Spec-First：知识复利——每次任务都是下次任务的输入优势 | Compound/Knowledge |
| W-08 | Spec-First：GitNexus 集成——代码图谱驱动的 AI 开发是什么感觉 | 进阶/Graph provider |

### 流 3：Building in Public

| 编号 | 候选标题 | 主题 |
|---|---|---|
| B-01 | Spec-First：我为什么要做 spec-first（创始故事） | 动机与起点 |
| B-02 | Spec-First：Light contract——为什么我不做重状态机 | 核心设计哲学 |
| B-03 | Spec-First：我在 spec-first 里踩过的三个坑 | 失败与反思 |
| B-04 | Spec-First：一个开源 CLI 的双宿主设计故事 | Claude + Codex 双宿主架构决策 |
| B-05 | Spec-First：如何为一个 AI workflow 工具写测试 | 工程实践细节 |
| B-06 | Spec-First：spec-first 第一个月发生了什么 | 项目进展回顾 |

---

## 前四周编排示意

以下为一个可参考的初期排期示意（具体顺序可调整）：

| 周次 | 文章 1（实操/深度） | 文章 2（概念/思想） | 文章 3（BIP） |
|---|---|---|---|
| 第 1 周 | ~~01 总览（已发）~~ | C-02 Spec-First：为什么我不做 Prompt 框架 | B-01 Spec-First：我为什么做 spec-first |
| **第 2 周** | **C-07 Spec-First：从 Workflow 到 AI Coding Harness（枢纽）** | W-01 Spec-First：Graph Bootstrap | B-02 Spec-First：Light contract |
| 第 3 周 | H-01 Spec-First：Context Harness | W-03 Spec-First：从想法到 Spec | B-03 Spec-First：踩过的三个坑 |
| 第 4 周 | H-03 Spec-First：Evidence Harness | W-04 Spec-First：Plan 约束实现 | B-04 Spec-First：双宿主设计故事 |

> 第 2 周的 C-07 是整个系列的叙事转折点：从"workflow 问题"升级为"Harness 工程"，后续所有文章都在 Harness 框架下展开。

---

## 文章输出存储

- 已发布文章：`docs/11-文章系列/` （当前仅有 `01-spec-first.md`）
- 草稿建议在同目录用 `02-`、`03-` 等前缀顺序存放
- 文章配图存入 `docs/11-文章系列/pic/`

---

## 非目标

- 本文档不规定文章字数、封面图规格或发布工具
- 不是刚性发布计划，框架为指导性结构，不是合同
- 不覆盖与 spec-first 无关的 AI 工具评测或行业资讯内容

---

## 下一步

1. 从标题池中选取下一篇，开始起草
2. 如有新的 spec-first 功能/设计决策，优先补充到 Building in Public 流
3. 每发布 4–6 篇后，根据读者反馈调整三流的内容比例和主题优先级
