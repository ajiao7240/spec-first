---
name: graph-decision-input-outline
description: 第 5 篇文章大纲：Graph 如何改变 AI 的代码决策输入
metadata:
  type: article-outline
  series_index: 05
---

# 别再让 AI 猜你的代码：Graph 如何改变决策输入

**状态：** 大纲
**内容类型：** 机制篇
**Harness 坐标：** Context Harness / Evidence Harness
**目标读者：** 已经遇到过 AI 改错文件、漏掉调用方、误判影响面的开发者。

## 核心论点

代码图谱的价值不是让 AI 看起来更高级，而是把“猜代码”变成“带证据地定位代码”。Graph evidence 仍然不是绝对真相，但它能显著改善模型的第一轮决策输入。

## Evidence Ticket

- 本地证据：`docs/contracts/graph-evidence-policy.md`
- 本地证据：`docs/contracts/ai-coding-harness.md`
- 本地证据：`docs/contracts/gitnexus-capability-catalog.md`
- 本地证据：`.spec-first/graph/graph-facts.json` 当前说明 GitNexus query 可用但处于 dirty-advisory，发布正文前需重查。
- 需降敏：不发布 raw provider dump、完整私有路径或敏感 route/process 输出。
- 回流资产：Graph evidence 解释卡

## 大纲

### 1. 开场：AI 为什么总是在“看起来相关”的地方改代码？

- 没有结构化代码事实时，模型常靠关键词、文件名、局部上下文推断。
- 这种推断对小任务够用，对跨模块影响面很脆弱。
- 典型问题：漏调用方、错估影响面、误把 provider pointer 当 confirmed truth。

### 2. Graph 解决的不是智能，而是输入质量

- 图谱提供 symbol、调用、文件、route、impact、consumer 等线索。
- 它让模型先知道“哪里可能相关”，再去读源码确认。
- Graph 是 Context/Evidence 层，不是 scope authority。

### 3. spec-first 的 evidence 边界

- `confirmed`：源码、测试、schema、exit code、compiled readiness facts。
- `session-local`：本轮 live MCP / CLI 查询成功返回。
- `advisory`：候选、fallback、definitions-only、低置信 pointer。
- `stale`：索引或 fingerprint 与当前 checkout 不一致。

### 4. GitNexus 在 Harness 中的位置

- deterministic-helper lane：bounded query / context / impact / detect_changes。
- workflow-native session lane：route_map、api_impact、shape_check、tool_map、cypher。
- workspace-resource lane：父级 workspace 和 group-aware 查询。
- mutation-gated maintenance lane：rename、group_sync、provider refresh 等必须 preview-first。

### 5. 一个任务前后的对比

- 没有 Graph：先 grep，再靠文件名和直觉猜。
- 有 Graph：先看 query/context/impact pointer，再读源码确认。
- 关键强调：Graph 指路，source/test 定案。

### 6. 什么时候不要过度依赖 Graph？

- dirty-advisory、stale、query-unverified、definitions-only 时。
- provider 结果与源码或测试冲突时。
- 任务本身是轻量 docs / typo / 单文件局部修改时。

### 7. 结尾 CTA

- 提醒读者区分“Graph 给出线索”和“源码确认事实”。
- 引到下一篇：不要修生成物，要修 Source-of-Truth。

## 可带走的判断

好的代码图谱不是替代工程师判断，而是让工程师和 LLM 少从错误位置开始。
