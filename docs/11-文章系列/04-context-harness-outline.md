---
name: context-harness-outline
description: 第 4 篇文章大纲：Context Harness，正确上下文不是无限上下文
metadata:
  type: article-outline
  series_index: 04
---

# Context Harness：正确上下文不是无限上下文

**状态：** 大纲
**内容类型：** 机制篇
**Harness 坐标：** Context Harness
**目标读者：** 习惯把更多文档、更多代码、更多历史记录直接塞给 AI 的开发者。

## 核心论点

AI coding 需要的不是无限上下文，而是有边界、相关、可追溯、可复用的决策输入。Context Harness 的目标是让模型读到该读的内容，并知道哪些只是 advisory，哪些才是 confirmed truth。

## Evidence Ticket

- 本地证据：`docs/solutions/workflow-issues/workflow-host-instruction-reuse-policy-2026-05-25.md`
- 本地证据：`docs/contracts/ai-coding-harness.md`
- 本地证据：`docs/contracts/context-governance.md`
- 需降敏：不暴露具体会话历史，只讲 host instruction layer 与 task context bundle 的边界。
- 回流资产：Context 选择清单

## 大纲

### 1. 开场：为什么“多给点上下文”经常适得其反？

- 上下文越多，模型不一定越准。
- 无边界上下文会挤占任务真正需要的 source、diff、test evidence。
- 读者常见误区：把 AGENTS、README、docs、历史对话、provider dump 一次性全塞进去。

### 2. 两种上下文不要混在一起

- Host/project instruction layer：会话启动时已加载，用于稳定约束 agent 行为。
- Task context bundle：围绕当前任务精确收集的 source、diff、plan、test、artifact 和 provider facts。
- 混淆后果：每个 workflow 都重复读根文档，当前任务证据反而变少。

### 3. Context Harness 的原则

- 先复用已加载 host instructions。
- 只在明确例外下读取 instruction source。
- 对 provider facts 标明 freshness 和 limitations。
- 默认排除 generated runtime mirror 和无关 audit artifacts。

### 4. “正确上下文”的四个问题

- 这个上下文是否服务当前任务？
- 它是 source-of-truth，还是 generated/runtime mirror？
- 它是 confirmed、session-local、advisory，还是 stale？
- 它的消费者是谁：plan、work、review、debug，还是 knowledge？

### 5. spec-first 如何实践

- workflow orientation 从当前请求、plan/task、已加载指令、附近源码、diff 出发。
- `docs/contracts/context-governance.md` 固化复用策略。
- 文章中可展示一个对比：默认重读 root instructions vs reuse-first + precise source read。

### 6. Context 选择清单

- 必读：当前任务目标、相关 plan/task、相关 diff/source/test。
- 条件读取：AGENTS/CLAUDE source、contracts、provider facts、docs/solutions。
- 默认不读：generated runtime mirror、raw MCP dump、无关历史审查。

### 7. 结尾 CTA

- 让读者在下次让 AI 工作前先问：我给的是“更多上下文”，还是“更好的决策输入”？
- 引到下一篇：Graph 如何改变 AI 的代码决策输入。

## 可带走的判断

Context engineering 的核心不是把仓库塞进窗口，而是让模型知道当前任务最该相信什么。
