---
name: s2-05-plan-outline
description: 第二季第 5 篇大纲：plan——计划不是微观指令，而是执行边界
metadata:
  type: article-outline
  series: s2
  series_index: "s2-04"
---

# Spec-First：你给 AI 的计划，其实是在帮它跑偏

**状态：** 大纲
**内容类型：** 机制篇
**Harness 坐标：** Execution Harness（scope 约束）

## 核心论点

plan 的价值不是告诉 AI 每一步怎么做，而是约束 scope、验证方式、风险和 handoff。plan 是决策 artifact，不是微观指令。实现细节仍然由 LLM 判断。

## Evidence Ticket

- 本地证据：`skills/spec-plan/SKILL.md`
- 本地证据：`docs/plans/`（真实 plan 文件样例）
- 本地证据：`docs/contracts/context-bundle.md`（context-bundle.v1 envelope）
- 官网证据：`/Users/kuang/xiaobu/spec-first-official-website/website/docs/guide/plan-guide.md`
- 回流资产：Plan anti-drift checklist

## 大纲

### 1. 开场：为什么 AI 做着做着就偏了

### 2. plan 是什么：scope、验证、风险、handoff 的边界文档

### 3. plan 不是什么：不是逐步指令，不是状态机

### 4. 一份好的 plan 包含哪些字段

### 5. plan 如何防止 scope 扩张

### 6. plan 和 task pack 的分工：plan 是 source，task pack 是派生

### 7. plan 的 graph evidence posture：如何标注证据可信度

### 8. 什么时候 plan 就够了，什么时候需要 write-tasks

### 9. 本篇小结：Artifact 给边界，LLM 做判断

## 可带走的判断

plan 写清楚"不做什么"和"怎么验证"，比写清楚"怎么做"更重要。
