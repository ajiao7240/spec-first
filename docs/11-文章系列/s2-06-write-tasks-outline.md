---
name: s2-06-write-tasks-outline
description: 第二季第 6 篇大纲：write-tasks——把计划拆成可执行切片
metadata:
  type: article-outline
  series: s2
  series_index: "s2-06"
---

# Spec-First：为什么大任务交给 AI 总是一团糟

**状态：** 大纲
**内容类型：** 机制篇
**Harness 坐标：** Execution Harness（任务边界）

## 核心论点

task pack 是 plan 的派生产物，不是独立的 source of truth。write-tasks 只能重排执行切片，不能修改 scope、验收标准或 non-goals。spec_id / source_plan_hash 防止过期链路静默执行。

## Evidence Ticket

- 本地证据：`skills/spec-write-tasks/SKILL.md`
- 本地证据：`docs/tasks/`（真实 task pack 样例）
- 本地证据：`src/cli/helpers/spec-work-run-artifact.js`
- 官网证据：`/Users/kuang/xiaobu/spec-first-official-website/website/docs/guide/`（todo-system.md）
- 回流资产：Task pack 最小字段卡

## 大纲

### 1. 开场：为什么有了 plan 还需要 task pack

### 2. write-tasks 做什么：把 plan 编译成执行切片

### 3. task pack 的最小字段：spec_id / source_plan / source_plan_hash

### 4. 为什么 task pack 不能修改 scope

### 5. context_refs 是什么：有界指针，不是 scope authority

### 6. 什么时候需要 write-tasks，什么时候直接 work

### 7. task pack 过期时如何处理

### 8. 本篇小结：派生产物不能成为 source of truth

## 可带走的判断

plan 有 3 个以上 implementation units、跨模块、有真实依赖时，用 write-tasks 拆切片。
