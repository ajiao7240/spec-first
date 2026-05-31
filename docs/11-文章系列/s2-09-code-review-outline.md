---
name: s2-09-code-review-outline
description: 第二季第 9 篇大纲：code-review——为什么"你再检查一下"没用
metadata:
  type: article-outline
  series: s2
  series_index: "s2-09"
---

# Spec-First：AI review 了半天，上线还是出了问题——为什么

**状态：** 大纲
**内容类型：** 机制篇
**Harness 坐标：** Evidence Harness（review 结构化）

## 核心论点

review 需要角色、证据、影响面、降级和 residual risk。"你再检查一下"没有 severity、没有 evidence、没有 owner、没有 verification，不是 review contract。review-pre-facts 是 review 的证据准备层。

## Evidence Ticket

- 本地证据：`skills/spec-code-review/SKILL.md`
- 本地证据：`src/cli/helpers/review-pre-facts/`（boundary.js、constants.js）
- 本地证据：`docs/solutions/workflow-issues/reviewer-dispatch-failure-2026-05-07.md`
- 官网证据：`/Users/kuang/xiaobu/spec-first-official-website/website/docs/guide/review-guide.md`
- 回流资产：Review checklist

## 大纲

### 1. 开场：为什么 AI review 经常没有用

### 2. review 的六个维度：correctness / security / performance / maintainability / test / docs

### 3. review-pre-facts 是什么：review 的证据准备层

### 4. actionable finding 的最小结构：evidence + severity + owner + verification

### 5. residual risk 是什么：review 后仍然存在的风险

### 6. reviewer dispatch：多角色并行 review 的设计

### 7. dispatch 失败时如何降级：fallback to single-agent

### 8. review findings 如何交接给 work 和 compound

### 9. 本篇小结：review 是证据，不是建议

## 可带走的判断

review finding 必须能回答：证据在哪里？严重程度是什么？谁来修？怎么验证？
