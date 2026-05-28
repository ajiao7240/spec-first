---
name: ai-coding-harness-positioning-outline
description: 第 2 篇文章大纲：什么是 AI Coding Harness，承接第一篇 workflow 叙事并建立第一季坐标系
metadata:
  type: article-outline
  series_index: 02
---

# 什么是 AI Coding Harness：spec-first 的定位升级

**状态：** 大纲  
**内容类型：** 枢纽篇  
**Harness 坐标：** 总览 / Context / Execution / Evidence / Evaluation / Governance / Knowledge  
**目标读者：** 已经认同“AI coding 不是 prompt 问题，而是 workflow 问题”，但还不知道下一层系统结构是什么的开发者。

## 核心论点

`AI Coding Harness` 不是再发明一套 prompt，也不是用状态机替代 LLM 判断。它的作用是把不稳定的 AI 推理放进一个可重复、可观察、可约束、可验证、可沉淀的工程闭环里。

## Evidence Ticket

- 本地证据：`docs/contracts/ai-coding-harness.md`
- 本地证据：`docs/10-prompt/结构化项目角色契约.md`
- 本地证据：`docs/11-文章系列/2026-05-27-003-spec-first-wechat-series-requirements.md`
- 需降敏：无
- 回流资产：Harness 六层图

## 大纲

### 1. 开场：Workflow 之后，还缺什么？

- 承接第一篇：prompt 不是系统，workflow 才是系统。
- 但 workflow 这个词仍然偏抽象，读者会继续问：到底要搭什么？
- 引出本文答案：AI Coding Harness。

### 2. Harness 的一句话定义

- Harness = 给 AI coding 建一层工程承载结构。
- 它不替模型做语义判断，而是让模型做判断时拿到更好的输入、边界和证据。
- 反面定义：不是 prompt pack、不是 agent collection、不是复杂流程引擎。

### 3. 为什么 AI coding 需要 Harness？

- 模型会越来越强，但真实工程失败常来自决策输入退化。
- 典型失败：上下文不稳、计划漂移、review 失效、经验无法复用。
- Harness 解决的不是“模型会不会写代码”，而是“任务能不能被交付、审查和复盘”。

### 4. spec-first 的六层 Harness

- Context Harness：给正确上下文，不给无限上下文。
- Execution Harness：让计划、任务、执行和 handoff 可跟踪。
- Evidence Harness：让结论有来源、限制和 freshness。
- Evaluation Harness：记录是否真的变好，而不是只看使用次数。
- Governance Harness：明确权限、source/runtime、provider 和降级边界。
- Knowledge Harness：把一次经验变成下一次输入优势。

### 5. `Scripts prepare, LLM decides`

- 脚本负责事实：路径、hash、schema、readiness、exit code。
- LLM 负责判断：scope、取舍、风险、review、下一步。
- 这条分工是 spec-first 和重状态机工具的关键差异。

### 6. 这篇之后，系列怎么展开？

- Context：AI 到底凭什么理解代码？
- Spec / Plan：如何让意图和执行边界显式化？
- Review：为什么“你再检查一下”不够？
- Knowledge：为什么每次修复都应该反哺下一次？

### 7. 结尾 CTA

- 让读者用一句话自测：现在自己的 AI coding 流程里，有没有 Context、Evidence、Review、Knowledge 四个闭环？
- 引到下一篇：为什么你不敢把任务真正交给 AI。

## 可带走的判断

如果一套 AI coding 方法只能让模型“更会写”，但不能让任务更可追踪、结论更可质疑、经验更可复用，它还不是 Harness。
