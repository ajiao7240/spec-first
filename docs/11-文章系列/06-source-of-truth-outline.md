---
name: source-of-truth-outline
description: 第 6 篇文章大纲：不要修生成物，要修 Source-of-Truth
metadata:
  type: article-outline
  series_index: 06
---

# 不要修生成物，要修 Source-of-Truth

**状态：** 大纲
**内容类型：** 取舍 / Building in Public
**Harness 坐标：** Governance Harness / Knowledge Harness
**目标读者：** 经常为了让 AI 任务“眼前通过”，直接 patch 运行时副本、生成文件或临时产物的开发者。

## 核心论点

AI coding 中最隐蔽的系统漂移，常常来自“修了眼前读到的文件”，但没有修真正的 source-of-truth。generated runtime 出错时，正确动作是回到 source 和 generator，而不是手改 mirror。

## Evidence Ticket

- 本地证据：`docs/solutions/workflow-issues/modify-source-not-artifacts-2026-04-13.md`
- 本地证据：`docs/10-prompt/结构化项目角色契约.md`
- 本地证据：`docs/contracts/ai-coding-harness.md`
- 需降敏：不暴露私有会话细节，只公开 source/runtime/generator 的通用边界。
- 回流资产：Source/runtime 边界卡

## 大纲

### 1. 开场：为什么“直接改它现在读到的文件”很危险？

- AI 看到 runtime mirror 旧内容，很容易建议直接改 mirror。
- 这种修法短期看有效，长期会制造 source/runtime drift。
- 真实工程系统里，能被消费的文件不一定是该被维护的文件。

### 2. 一个典型场景

- `.agents/skills/` 或 `.claude/skills/` 里的 runtime 副本落后。
- 直觉动作：直接编辑 runtime 副本。
- 正确动作：先检查 `skills/`、`agents/`、`templates/` source，再通过 `spec-first init` 或生成链刷新 runtime。

### 3. source、runtime、artifact 三者分工

- Source-of-truth：长期维护和 review 的真实来源。
- Generated runtime：宿主实际消费的生成副本。
- Durable artifact：workflow 运行后留下的证据、计划、learning 或报告。
- 三者混淆后，review、debug、update 都会变难。

### 4. spec-first 的边界规则

- 优先修改 source，不手改 generated runtime assets。
- source 与 runtime 不一致时，先确认 source，再检查 generator，最后再刷新 runtime。
- generated artifact 可作为证据或缓存，不应成为治理源头。

### 5. 这条原则不只适用于 spec-first

- 代码生成文件、OpenAPI client、SDK binding、docs site build output、compiled assets 都有类似边界。
- AI agent 尤其容易忽略这个边界，因为它会优先修眼前文件。
- Harness 要做的是让这个边界在任务开始前就显式化。

### 6. Source/runtime 边界卡

- 这个文件是人维护的，还是生成的？
- 它的上游模板或 generator 在哪里？
- 修改后如何重新生成或同步？
- 消费者读的是 source，还是 runtime mirror？
- 需要把 drift 记录为 failure / learning 吗？

### 7. 结尾 CTA

- 让读者下次遇到 AI 建议改生成物时先问：这是真源头，还是只是当前被消费的副本？
- 引到后续文章：Spec 不是文档负担，是给 Agent 的压缩上下文。

## 可带走的判断

能被 AI 读到的文件，不一定就是应该被你修改的文件。Harness 的价值之一，就是让 source-of-truth 在执行前就清晰可见。
