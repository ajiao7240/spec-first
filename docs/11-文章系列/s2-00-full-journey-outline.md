---
name: s2-00-full-journey-outline
description: 第二季第 0 篇大纲：用一个真实需求走完 spec-first 完整链路，建立全局地图；包含三种研发模式（0-1/1-10/10-100）和 spec-prd 的位置
metadata:
  type: article-outline
  series: s2
  series_index: "s2-00"
---

# Spec-First：从一句话到上线，我用 spec-first 跑完了整个流程

**状态：** 大纲
**内容类型：** 总览篇
**目标读者：** 已认同 Harness 理念、想真正上手 spec-first 的开发者

## 核心论点

spec-first 的价值不在于多跑命令，而在于把 AI coding 的每个关键判断显式化。用一个小需求走完完整链路，让读者看到每个节点的输入、输出和交接边界。同时说清楚三种研发模式（0-1 / 1-10 / 10-100）下链路的差异——不是每次都要走完所有步骤。

## Evidence Ticket

- 本地证据：`skills/spec-prd/SKILL.md`（brownfield increment 定义）
- 官网证据：`/Users/kuang/xiaobu/spec-first-official-website/website/docs/guide/first-workflow.md`
- 官网证据：`/Users/kuang/xiaobu/spec-first-official-website/website/docs/guide/workflow-commands.md`
- 官网证据：`/Users/kuang/xiaobu/spec-first-official-website/website/docs/guide/best-practices.md`（三种场景建议）
- 回流资产：完整工作流链路图 + 三种研发模式对照表

## 大纲

### 1. 开场：为什么需要一张全局地图

- 第二季的目标：从"为什么"到"怎么用"
- 这篇文章的作用：建立坐标系，后续每篇都能在这张地图上找到位置

### 2. 三种研发模式：不同阶段，不同链路

spec-first 支持三种研发模式，链路有所不同：

| 模式 | 场景 | 需求工具 | 典型链路 |
|---|---|---|---|
| **0-1** | 全新产品/功能，方向未定 | `ideate` → `brainstorm` | 环境 → ideate → brainstorm → plan → doc-review → work → review → compound |
| **1-10** | 已有产品，增量功能 | `brainstorm` 或 `spec-prd` | 环境 → brainstorm/spec-prd → plan → doc-review → write-tasks → work → review → compound |
| **10-100** | 存量系统，增量需求，需要 PRD 级文档 | `spec-prd` | 环境 → spec-prd → plan → doc-review → write-tasks → work → review → compound |

这三种模式的核心差别在需求阶段：
- 0-1 用 brainstorm 探索方向，产出 requirements brief
- 1-10/10-100 用 spec-prd 描述存量系统的变化 delta，产出 PRD 级需求文档

### 3. 完整链路走查（以 1-10 模式为例）

用一个真实小需求（改进 CLI 首次使用体验）走完完整链路：

#### 第零步：环境就绪（doctor / init / mcp-setup / graph-bootstrap）

- 为什么这三件事有顺序依赖
- 就绪后能做什么，不就绪会发生什么

#### 第一步：需求收敛

**0-1 模式：** `ideate` → `brainstorm` → requirements brief

**1-10 / 10-100 模式：** `spec-prd` → PRD 级需求文档（`docs/brainstorms/*-requirements.md`，`artifact_kind: prd-requirements`）

- spec-prd 的核心：current-state evidence + change delta
- 产出物：让 plan 不用猜 WHAT

#### 第二步：计划形成（plan → plan doc）

- plan 的输入：requirements brief 或 PRD 需求文档
- plan 的输出：scope、验证方式、风险、handoff

#### 第三步：计划 review（doc-review → findings）

- 为什么 plan 之后立即 review
- doc-review 发现的问题，修复成本最低

#### 第四步：任务切片（write-tasks → task pack，可选）

- 什么时候需要 write-tasks，什么时候直接 work

#### 第五步：执行（work → code changes + verification）

- work 的五个控制点
- scope 扩张时如何停止

#### 第六步：代码审查（code-review → findings）

- review-pre-facts 是什么
- actionable finding 的最小结构

#### 第七步：经验沉淀（compound → docs/solutions/）

- 什么时候触发 compound
- 沉淀的经验如何被下一次任务发现

### 4. 每个节点的输入/输出总结表

| 节点 | 输入 | 输出 | 适用模式 |
|---|---|---|---|
| doctor/init | — | runtime assets | 全部 |
| mcp-setup | runtime assets | provider 配置 | 全部 |
| graph-bootstrap | provider 配置 | readiness facts | 全部 |
| ideate | 模糊想法 | 方向候选 | 0-1 |
| brainstorm | 方向/想法 | requirements brief | 0-1 / 1-10 |
| spec-prd | 存量系统 + 变更请求 | PRD 级需求文档 | 1-10 / 10-100 |
| plan | 需求文档 | plan doc | 全部 |
| doc-review | plan doc | findings | 全部 |
| write-tasks | plan doc | task pack | 复杂任务 |
| work | plan / task pack | code + verification | 全部 |
| code-review | diff | findings | 全部 |
| compound | 已解决问题 | docs/solutions/ | 全部 |

### 5. 什么时候可以跳过某些步骤

- 小任务（单文件、typo、局部修复）：可以跳过 write-tasks，直接 work
- 方向已清晰：可以跳过 ideate，直接 brainstorm 或 spec-prd
- 简单增量：可以用 brainstorm 代替 spec-prd
- 低风险改动：doc-review 可以轻量化

### 6. 本篇小结：地图比命令更重要

spec-first 不是要求每次都走完所有步骤，而是让每一步都留下下一步能读取的高质量上下文。三种研发模式的差别在需求阶段，其余链路基本一致。

## 可带走的判断

先判断自己处于哪种研发模式（0-1 / 1-10 / 10-100），再选择对应的需求工具，然后按链路推进。
