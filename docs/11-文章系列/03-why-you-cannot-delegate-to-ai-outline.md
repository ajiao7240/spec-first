---
name: why-you-cannot-delegate-to-ai-outline
description: 第 3 篇文章大纲：解释开发者为什么不敢真正把任务交给 AI，并引出 governed loop
metadata:
  type: article-outline
  series_index: 03
---

# 为什么你不敢把任务真正交给 AI

**状态：** 大纲
**内容类型：** 观点篇
**Harness 坐标：** Context / Evidence / Review / Knowledge
**目标读者：** 已经在用 AI coding，但仍然把它当成临时助手而不是可委派执行者的开发者。

## 核心论点

开发者不敢真正把任务交给 AI，不是因为 AI 完全不会写代码，而是因为任务缺少可交付的工程边界：意图没有沉淀、上下文没有约束、结论没有证据、review 没有结构、经验没有复用。

## Evidence Ticket

- 本地证据：`docs/11-文章系列/01-spec-first.md`
- 本地证据：`docs/contracts/ai-coding-harness.md`
- 外部证据：OpenAI Codex、GitHub Copilot cloud agent、GitHub Spec Kit、DORA 研究页，发布前重查最新表述。
- 需降敏：无
- 回流资产：AI Coding Workflow 自测清单

## 大纲

### 1. 开场：你真的敢让 AI 独立做完一个任务吗？

- 大多数人会让 AI 写函数、改局部代码、解释错误。
- 但一到真实需求，还是会盯着它每一步。
- 问题不是“AI 是否能生成代码”，而是“我凭什么相信它没有跑偏”。

### 2. AI coding 的信任缺口

- 意图缺口：任务目标停留在聊天里。
- 上下文缺口：模型不知道哪些代码事实可信。
- 计划缺口：执行路径没有被审查。
- 证据缺口：结论没有 provenance、freshness、limitations。
- 复用缺口：这次踩过的坑，下次还会再踩。

### 3. 为什么更强模型不能单独解决这个问题？

- 更强模型会放大已有流程能力。
- 如果工程系统没有边界，模型越能干，越可能把错误扩散得更快。
- 真实问题从“生成能力”转向“可委派性”。

### 4. 从 vibe coding 到 governed loop

- vibe coding 适合探索和原型。
- 生产协作需要可复盘 artifact：Spec、Plan、Review、Knowledge。
- governed loop 的关键不是多加审批，而是把关键判断变成可检查对象。

### 5. spec-first 给信任补上的 5 个对象

- Spec：让意图显式化。
- Plan：让执行路径可审查。
- Graph / Context：让代码事实可追踪。
- Review：让质量判断结构化。
- Knowledge：让经验进入下一次任务。

### 6. 自测清单

- 这个任务的目标是否离开聊天窗口后仍然可读？
- AI 的计划是否能被别人审查？
- 关键结论是否有 source、test、log 或 provider evidence？
- review 是否区分 finding、risk、residual risk？
- 完成后有没有沉淀可复用 learning？

### 7. 结尾 CTA

- 引导读者用自测清单检查自己的 AI coding 流程。
- 引到下一篇：Context Harness，正确上下文不是无限上下文。

## 可带走的判断

你不敢委派 AI，不一定是模型不够强；更可能是你的任务还没有被放进一个可治理的工程闭环里。
