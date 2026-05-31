---
name: s2-08-debug-outline
description: 第二季第 8 篇大纲：debug——AI 犯错了怎么办，hypothesis ledger 的设计逻辑
metadata:
  type: article-outline
  series: s2
  series_index: "s2-08"
---

# Spec-First：反复问 AI 你再看看，只会让 bug 越来越多

**状态：** 大纲
**内容类型：** 取舍篇
**Harness 坐标：** Evidence Harness（失败追踪）

## 核心论点

debug 不是反复问 AI "你再看看"，而是用 hypothesis ledger 把失败变成可追踪的证据。一次只改一件事，先复现再修复，根因必须有 source/test/log 支撑。

## Evidence Ticket

- 本地证据：`skills/spec-debug/SKILL.md`（hypothesis、reproduce、one change at a time）
- 本地证据：`docs/solutions/workflow-issues/`（真实 debug 案例）
- 官网证据：`/Users/kuang/xiaobu/spec-first-official-website/website/docs/guide/debug-guide.md`
- 回流资产：Debug hypothesis 模板

## 大纲

### 1. 开场：为什么"你再检查一下"会让 bug 越来越多

### 2. debug 的核心原则：先复现，再修复

### 3. hypothesis ledger 是什么：把猜测变成可追踪的假设

### 4. 一次只改一件事：为什么散弹枪式 debug 不可行

### 5. 根因必须有证据：source / test / log / runtime 支撑

### 6. graph evidence 在 debug 中的角色：advisory pointer，不是 confirmed truth

### 7. debug 结束后：把失败经验沉淀到 docs/solutions/

### 8. 本篇小结：失败是最有价值的 evidence

## 可带走的判断

debug 时先问：能复现吗？假设是什么？这次只改一件事。
