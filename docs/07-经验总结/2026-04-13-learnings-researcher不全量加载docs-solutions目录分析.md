---
title: "learnings-researcher 不全量加载 docs/solutions/ 文件"
date: "2026-04-13"
category: "workflow-issues"
module: "spec-first"
problem_type: "workflow_issue"
component: "documentation"
symptoms:
  - "担心 spec-plan Phase 1 调用 learnings-researcher 时全量加载 docs/solutions/ 进入上下文"
  - "随着 docs/solutions/ 文件增多，是否会导致上下文膨胀"
root_cause: "inadequate_documentation"
resolution_type: "documentation_update"
severity: "low"
tags: ["learnings-researcher", "docs/solutions", "context-window", "grep-first", "spec-plan"]
---

# learnings-researcher 不全量加载 docs/solutions/ 文件

## Problem

调用 `spec-plan` 时会触发 `learnings-researcher` agent 扫描 `docs/solutions/`，
引发疑问：是否会全量把目录下所有文件加载进上下文，随着文件增多导致 token 爆炸？

## 结论

**设计上不全量加载。** `agents/research/learnings-researcher.md` 采用 grep-first 策略，
只有命中关键词的候选文件才会被读取内容。

## 实际加载流程

```
Step 1: 从任务描述提取关键词（模块名、技术词、症状词）
Step 2: 可选——按 category 子目录缩小范围
Step 3: Grep 预筛（files_only=true，只返回文件路径，不读内容）← 关键
         → 通常从 200 个文件缩减到 5-20 个候选
Step 3b: 固定全量读取 docs/solutions/patterns/critical-patterns.md（如存在）← 唯一强制全读
Step 4: 只读候选文件的前 30 行（frontmatter）
Step 5: 相关度打分（strong / moderate / weak）
Step 6: 只对 strong/moderate 文件做全量读取
Step 7: 返回摘要给 spec-plan，不返回原文
```

设计中明确禁止的行为（DON'T 列表）：

> "Read frontmatter of ALL files（use content-search to pre-filter first）"

## 两个例外

| 例外 | 行为 | 风险 |
|------|------|------|
| `docs/solutions/patterns/critical-patterns.md` | **每次必读全文**，不受 grep 过滤 | 该文件越大，每次 spec-plan 的固定开销越高 |
| grep 返回 <3 候选时 | 自动扩大为全内容搜索（仍然 files_only） | 仍不全量读取内容，只扩大匹配范围 |

## 真实风险：LLM 遵从性

设计是 grep-first，但没有强制执行机制。LLM 在实际执行时可能：

- 忽略 grep 指令，直接 `ls docs/solutions/` + 逐文件读取
- 在文件数量少（当前仅 4 个）时走捷径全量读取

**当前文件数量少，影响可接受。随着 docs/solutions/ 增长，这个风险会放大。**

## 建议

1. **保持 critical-patterns.md 精简**：该文件是唯一强制全读的文件，不要堆积内容
2. **frontmatter 写准确**：grep 是靠 `tags`、`module`、`title` 等字段筛选，frontmatter 越精准，召回越准
3. **当前无需担心**：4 个文件时全量读取与 grep-first 的 token 差距可忽略

## 相关文件

- `agents/research/learnings-researcher.md` — agent 完整定义，Step 3 是核心
- `skills/spec-plan/SKILL.md:190` — 调用点：`Task spec-first:research:learnings-researcher(...)`
