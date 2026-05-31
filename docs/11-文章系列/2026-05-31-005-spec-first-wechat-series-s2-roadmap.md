---
name: spec-first-wechat-series-s2-roadmap
description: spec-first 微信公众号第二季内容路线图：总分结构，1篇总览 + 12篇 skill 深度剖析，覆盖完整开发链路
metadata:
  type: project
---

# spec-first 微信公众号第二季内容路线图

**状态：** 规划稿
**日期：** 2026-05-31
**前置：** 第一季 6 篇已发布（01-06），建立了 AI Coding Harness 认知框架
**关联规划：** `docs/11-文章系列/2026-05-27-004-spec-first-wechat-series-content-roadmap.md`

---

## 第二季定位

第一季回答了"为什么需要 Harness"——建立认知框架，讲清楚 Context / Evidence / Governance / Knowledge 各层的价值。

第二季回答"怎么用"——用**总-分结构**，先用一篇总览把完整开发链路串起来，再逐个 skill 深度剖析，让读者能直接上手。

**叙事主线：**

```text
第一季：为什么需要 Harness（认知框架）
第二季：Harness 的每一层怎么用（操作地图）
```

**目标读者升级：**

- 第一季：对 AI coding 感兴趣但还没系统化的开发者（A 型读者）
- 第二季：已经认同 Harness 理念、想真正上手 spec-first 的开发者（B 型读者）

---

## 总分结构

```
S2-00 总览：一个真实需求从想法到上线的完整旅程
  ↓
第一组：环境准备
  S2-01 doctor / init / mcp-setup
  S2-02 graph-bootstrap
  ↓
第二组：需求与规划
  S2-03 brainstorm / ideate
  S2-04 spec-prd（存量系统）
  S2-05 plan
  S2-06 write-tasks
  ↓
第三组：执行与调试
  S2-07 work
  S2-08 debug
  ↓
第四组：审查与质量
  S2-09 code-review
  S2-10 doc-review
  ↓
第五组：沉淀与优化
  S2-11 compound / compound-refresh
  S2-12 optimize
```

---

## 第二季 13 篇目录

> **标题格式约定：** 所有系列文章正文标题统一为 `Spec-First：xxxx`（全角冒号）。
> **质量标准：** 每篇正文不少于 1.5 万字，正文配图 6-10 张（不含封面）。

### 总览篇

| # | 内容类型 | 建议标题 | 核心论点 | 核心 skill | 回流资产 |
|---|---|---|---|---|---|
| S2-00 | 总览 | Spec-First：一个真实需求从想法到上线的完整旅程 | 用一个小需求走完完整链路，让读者看到 spec-first 的全貌和每个节点的输入/输出 | 全链路 | 完整工作流链路图 |

### 第一组：环境准备

| # | 内容类型 | 建议标题 | 核心论点 | 核心 skill | 回流资产 |
|---|---|---|---|---|---|
| S2-01 | 机制 | Spec-First：安装之后，第一件事是什么——doctor、init 和 mcp-setup | 工具安装完不等于可以用；runtime 就绪才是真正的起点 | `doctor` / `init` / `mcp-setup` | 环境就绪检查清单 |
| S2-02 | 机制 | Spec-First：让 AI 知道你的代码库——graph-bootstrap 的设计逻辑 | 代码图谱不是一次性操作，而是持续的 readiness 管理；dirty-advisory / definitions-only 时如何降级 | `graph-bootstrap` | Graph readiness 状态卡 |

### 第二组：需求与规划

| # | 内容类型 | 建议标题 | 核心论点 | 核心 skill | 回流资产 |
|---|---|---|---|---|---|
| S2-03 | 机制 | Spec-First：从一句话到可执行需求——brainstorm 是怎么工作的 | brainstorm 不是头脑风暴，而是把模糊意图收敛成可审查的 requirements brief；ideate 是更早的方向探索 | `brainstorm` / `ideate` | Requirements brief 最小字段卡 |
| S2-04 | 取舍 | Spec-First：存量系统怎么写需求——spec-prd 的 brownfield 逻辑 | 0-1 产品用 brainstorm，存量系统增量需求用 spec-prd；PRD 级需求让 plan 不用猜 WHAT | `spec-prd` | Brownfield PRD 检查清单 |
| S2-05 | 机制 | Spec-First：计划不是微观指令——plan 如何约束 AI 的执行边界 | plan 的价值是 scope、验证、风险和 handoff，不是逐步指令；plan 和 task pack 的分工 | `plan` | Plan anti-drift checklist |
| S2-06 | 机制 | Spec-First：把计划拆成可执行切片——write-tasks 的设计逻辑 | task pack 是 plan 的派生产物，不是独立 source of truth；spec_id / source_plan_hash 防止过期链路 | `write-tasks` | Task pack 最小字段卡 |

### 第三组：执行与调试

| # | 内容类型 | 建议标题 | 核心论点 | 核心 skill | 回流资产 |
|---|---|---|---|---|---|
| S2-07 | 机制 | Spec-First：让 AI 真正执行任务——work 的五个关键控制点 | work 不是"让 AI 自由发挥"，而是在 plan 边界内的受控执行；scope 扩张时如何停止 | `work` | Work 执行控制点卡 |
| S2-08 | 取舍 | Spec-First：AI 犯错了怎么办——debug 的 hypothesis ledger | debug 不是反复问 AI，而是用 hypothesis ledger 把失败变成可追踪的证据；一次只改一件事 | `debug` | Debug hypothesis 模板 |

### 第四组：审查与质量

| # | 内容类型 | 建议标题 | 核心论点 | 核心 skill | 回流资产 |
|---|---|---|---|---|---|
| S2-09 | 机制 | Spec-First：为什么"你再检查一下"没用——code-review 的六个维度 | review 需要角色、证据、影响面、降级和 residual risk；review-pre-facts 是什么 | `code-review` | Review checklist |
| S2-10 | 取舍 | Spec-First：需求和计划也需要 review——doc-review 的设计逻辑 | 代码 review 只是最后一道关；需求和计划的 review 更重要，因为它们决定了 WHAT | `doc-review` | Doc review 维度卡 |

### 第五组：沉淀与优化

| # | 内容类型 | 建议标题 | 核心论点 | 核心 skill | 回流资产 |
|---|---|---|---|---|---|
| S2-11 | 机制 | Spec-First：每次修复都应该变成下次优势——compound 的完整工作流 | compound 不是写文档，而是在上下文最新鲜时把可复用经验固化；compound-refresh 如何维护知识质量 | `compound` / `compound-refresh` | Knowledge capture 模板 |
| S2-12 | 取舍 | Spec-First：有指标才能优化——optimize 的 metric-driven 循环 | 没有可度量指标的优化是猜测；optimize 要求先定义 metric 和 measurement scaffold，再跑实验 | `optimize` | Optimization spec 模板 |

---

## 每篇文章 DNA

第二季每篇文章的结构：

1. **开场失败场景**：读者遇到过的真实问题（不用这个 skill 时会发生什么）
2. **skill 是什么**：一句话定位，和相邻 skill 的边界
3. **核心机制**：结合代码/合同/官网内容深度展开
4. **真实案例**：spec-first 项目里的真实使用场景
5. **关键判断**：什么时候用，什么时候不用
6. **可带走的资产**：checklist / 模板 / 边界卡

---

## 证据票据模板

每篇开写前填写：

```text
文章编号：S2-xx
核心 skill：
核心失败场景：
本地证据（skill SKILL.md / 官网 guide / docs/solutions/）：
官网对应页面：/Users/kuang/xiaobu/spec-first-official-website/website/docs/guide/
需降敏内容：
读者可带走的判断：
回流资产：
```

---

## 资产节奏

每 4 篇沉淀一个对外资产：

| 阶段 | 覆盖文章 | 资产 | 用途 |
|---|---|---|---|
| 阶段 1 | S2-00 ~ S2-03 | spec-first 完整工作流链路图 | 帮读者建立全局地图 |
| 阶段 2 | S2-04 ~ S2-07 | 需求→计划→执行 artifact map | 帮读者理解每个节点的输入/输出 |
| 阶段 3 | S2-08 ~ S2-12 | spec-first 质量闭环 checklist 合集 | 帮读者从认同进入日常使用 |

---

## 不建议第二季优先写

- `spec-sessions`、`spec-slack-research`：辅助工具，不在主链路，留第三季
- `spec-app-consistency-audit`、`spec-polish-beta`：专项能力，面向特定场景，留第三季
- `spec-skill-audit`、`spec-update`：运维类，留第三季
- `spec-release-notes`：发布工具，留第三季

---

## 下一步

1. 从 S2-00 总览篇开始写，建立全局地图
2. 按第一组（S2-01、S2-02）顺序推进
3. 每篇写完后走发布流水线（spec-wechat-publish skill）
4. 每 4 篇沉淀一个对外资产
