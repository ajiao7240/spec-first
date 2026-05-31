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

## 第二季系列结构（更新版：12篇）

```
S2-00 总览：从一句话到上线，我用 spec-first 跑完了整个流程
  ↓
第一组：环境准备（合并为 1 篇）
  S2-01 doctor/init/mcp-setup + graph-bootstrap
  ↓
第二组：需求与规划（4篇）
  S2-02 brainstorm/ideate（0-1 需求）
  S2-03 spec-prd（1-10 / 10-100 存量系统需求）
  S2-04 plan
  S2-05 doc-review  ← plan 之后，work 之前
  S2-06 write-tasks
  ↓
第三组：执行与调试（2篇）
  S2-07 work
  S2-08 debug
  ↓
第四组：审查与质量（1篇）
  S2-09 code-review
  ↓
第五组：沉淀与优化（2篇）
  S2-10 compound/refresh
  S2-11 optimize
```

**需求模式说明（0-1 / 1-10 / 10-100）：**

| 模式 | 场景 | 推荐工具 |
|---|---|---|
| 0-1 | 全新产品/功能，方向未定 | `spec-ideate` → `spec-brainstorm` |
| 1-10 | 已有产品，增量功能，需求较清晰 | `spec-brainstorm` 或 `spec-prd` |
| 10-100 | 存量系统，增量需求，需要 PRD 级文档 | `spec-prd`（brownfield increment） |

**doc-review 位置说明：** doc-review 放在 plan 之后、write-tasks 之前，是因为 plan 是最值得 review 的 artifact——它决定了 WHAT 和 HOW 的边界。plan 写完后立即 review，发现问题的成本最低。

---

## 第二季 12 篇目录

> **标题格式约定：** 所有系列文章正文标题统一为 `Spec-First：xxxx`（全角冒号）。
> **质量标准：** 每篇正文不少于 1.5 万字，正文配图 6-10 张（不含封面）。

### 总览篇

| # | 内容类型 | 建议标题 | 核心论点 | 核心 skill | 回流资产 |
|---|---|---|---|---|---|
| S2-00 | 总览 | Spec-First：从一句话到上线，我用 spec-first 跑完了整个流程 | 用一个小需求走完完整链路，让读者看到 spec-first 的全貌和每个节点的输入/输出 | 全链路 | 完整工作流链路图 |

### 第一组：环境准备（合并为 1 篇）

| # | 内容类型 | 建议标题 | 核心论点 | 核心 skill | 回流资产 |
|---|---|---|---|---|---|
| S2-01 | 机制 | Spec-First：开始第一个任务之前，你需要做这三件事 | init/mcp-setup/graph-bootstrap 三件事有顺序依赖，缺一不可；runtime 就绪才是真正的起点 | `doctor` / `init` / `mcp-setup` / `graph-bootstrap` | 环境就绪三步清单 |

### 第二组：需求与规划（5篇）

| # | 内容类型 | 建议标题 | 核心论点 | 核心 skill | 回流资产 |
|---|---|---|---|---|---|
| S2-02 | 机制 | Spec-First：为什么你的需求说清楚了，AI 还是做错了 | 0-1 场景：brainstorm 把模糊意图收敛成可审查的 requirements brief；ideate 是更早的方向探索 | `brainstorm` / `ideate` | Requirements brief 最小字段卡 |
| S2-03 | 取舍 | Spec-First：改老系统时，AI 最容易在哪里翻车 | 1-10/10-100 场景：存量系统增量需求用 spec-prd；PRD 级需求让 plan 不用猜 WHAT | `spec-prd` | Brownfield PRD 检查清单 |
| S2-04 | 机制 | Spec-First：你给 AI 的计划，其实是在帮它跑偏 | plan 的价值是 scope、验证、风险和 handoff，不是逐步指令 | `plan` | Plan anti-drift checklist |
| S2-05 | 取舍 | Spec-First：代码写完才发现需求理解错了，这个错误可以提前避免 | doc-review 在 plan 之后立即运行，发现问题成本最低；需求和计划的 review 比代码 review 更重要 | `doc-review` | Doc review 维度卡 |
| S2-06 | 机制 | Spec-First：为什么大任务交给 AI 总是一团糟 | task pack 是 plan 的派生产物；spec_id / source_plan_hash 防止过期链路静默执行 | `write-tasks` | Task pack 最小字段卡 |

### 第三组：执行与调试（2篇）

| # | 内容类型 | 建议标题 | 核心论点 | 核心 skill | 回流资产 |
|---|---|---|---|---|---|
| S2-07 | 机制 | Spec-First：AI 做着做着就偏了？五个控制点让它回到正轨 | work 不是"让 AI 自由发挥"，而是在 plan 边界内的受控执行；scope 扩张时如何停止 | `work` | Work 执行控制点卡 |
| S2-08 | 取舍 | Spec-First：反复问 AI 你再看看，只会让 bug 越来越多 | debug 不是反复问 AI，而是用 hypothesis ledger 把失败变成可追踪的证据；一次只改一件事 | `debug` | Debug hypothesis 模板 |

### 第四组：审查与质量（1篇）

| # | 内容类型 | 建议标题 | 核心论点 | 核心 skill | 回流资产 |
|---|---|---|---|---|---|
| S2-09 | 机制 | Spec-First：AI review 了半天，上线还是出了问题——为什么 | review 需要角色、证据、影响面、降级和 residual risk；review-pre-facts 是什么 | `code-review` | Review checklist |

### 第五组：沉淀与优化（2篇）

| # | 内容类型 | 建议标题 | 核心论点 | 核心 skill | 回流资产 |
|---|---|---|---|---|---|
| S2-10 | 机制 | Spec-First：你解决过的问题，为什么下次还要重新解决一遍 | compound 不是写文档，而是在上下文最新鲜时把可复用经验固化；compound-refresh 如何维护知识质量 | `compound` / `compound-refresh` | Knowledge capture 模板 |
| S2-11 | 取舍 | Spec-First：把它优化好一点——这句话为什么会让 AI 失控 | 没有可度量指标的优化是猜测；optimize 要求先定义 metric 和 measurement scaffold，再跑实验 | `optimize` | Optimization spec 模板 |

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
