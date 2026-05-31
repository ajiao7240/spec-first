---
name: s2-12-optimize-outline
description: 第二季第 12 篇大纲：optimize——有指标才能优化，metric-driven 循环
metadata:
  type: article-outline
  series: s2
  series_index: "s2-11"
---

# Spec-First：把它优化好一点——这句话为什么会让 AI 失控

**状态：** 大纲
**内容类型：** 取舍篇
**Harness 坐标：** Evaluation Harness

## 核心论点

没有可度量指标的优化是猜测。optimize 要求先定义 metric 和 measurement scaffold，再跑实验，用 hard gate 或 LLM-as-judge 打分，保留更好的版本。没有指标就拒绝运行。

## Evidence Ticket

- 本地证据：`skills/spec-optimize/SKILL.md`（metric.primary / stopping / execution）
- 本地证据：`skills/spec-optimize/references/example-hard-spec.yaml`
- 本地证据：`skills/spec-optimize/references/experiment-log-schema.yaml`
- 官网证据：`/Users/kuang/xiaobu/spec-first-official-website/website/docs/guide/optimize-guide.md`
- 回流资产：Optimization spec 模板

## 大纲

### 1. 开场：为什么"把它优化好一点"是一个危险的请求

### 2. optimize 的前提：可度量的目标 + 可重复的 measurement 命令

### 3. hard gate vs LLM-as-judge：两种评分方式的适用场景

### 4. optimization spec 的关键字段：metric / stopping / execution / budget

### 5. 实验循环：baseline → 实验 → 打分 → 保留 → 收敛

### 6. 立即写入实验结果：crash-safety 的核心规则

### 7. 什么时候用 optimize，什么时候用 work

### 8. optimize 的边界：不是普通 work 的替代品

### 9. 本篇小结：先定义"更好"，再去优化

## 可带走的判断

优化前先问：成功的度量标准是什么？怎么测量？预算是多少？
