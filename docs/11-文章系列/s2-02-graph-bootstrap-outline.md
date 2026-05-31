---
name: s2-02-graph-bootstrap-outline
description: 第二季第 2 篇大纲：graph-bootstrap——让 AI 知道你的代码库
metadata:
  type: article-outline
  series: s2
  series_index: "s2-02"
---

# Spec-First：让 AI 知道你的代码库——graph-bootstrap 的设计逻辑

**状态：** 大纲
**内容类型：** 机制篇
**Harness 坐标：** Context Harness / Evidence Harness

## 核心论点

代码图谱不是一次性操作，而是持续的 readiness 管理。graph-bootstrap 产出的不是"代码地图"，而是一组 readiness facts，告诉下游 workflow 当前图谱能用到什么程度。

## Evidence Ticket

- 本地证据：`.spec-first/graph/graph-facts.json`（freshness_state、limitations、capabilities）
- 本地证据：`skills/spec-graph-bootstrap/SKILL.md`
- 本地证据：`docs/contracts/gitnexus-capability-catalog.md`
- 官网证据：`/Users/kuang/xiaobu/spec-first-official-website/website/docs/guide/graph-bootstrap.md`
- 官网证据：`/Users/kuang/xiaobu/spec-first-official-website/website/docs/guide/graph-overview.md`
- 回流资产：Graph readiness 状态卡

## 大纲

### 1. 开场：为什么 AI 总是在"看起来相关"的地方改代码

### 2. graph-bootstrap 产出什么：readiness facts 而不是代码地图

### 3. graph-facts.json 的关键字段解读

### 4. 四种 freshness 状态：fresh / dirty-advisory / stale / query-unverified

### 5. definitions-only 是什么意思：能用和不能用的边界

### 6. 什么时候需要重新 bootstrap

### 7. 图谱不可用时如何降级

### 8. 本篇小结：readiness facts 是 Evidence Harness 的基础

## 可带走的判断

使用图谱结果前，先看 freshness_state 和 limitations，再决定用到什么程度。
