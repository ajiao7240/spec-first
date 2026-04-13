---
title: "修改生成产物而非源头模板"
date: "2026-04-13"
category: "workflow-issues"
module: "spec-first"
problem_type: "workflow_issue"
component: "documentation"
symptoms:
  - "直接修改 docs/contexts/<slug>/injection-index.yaml，而非 skills/spec-graph-bootstrap/SKILL.md"
  - "修改在下次运行 spec-graph-bootstrap 后被覆盖"
  - "advice.work 内容与 stages.work 实际文件列表语义不符"
root_cause: "missing_workflow_step"
resolution_type: "documentation_update"
severity: "high"
tags: ["injection-index", "spec-graph-bootstrap", "source-of-truth", "artifact", "generated-file", "phase-4"]
---

# 修改生成产物而非源头模板

## Problem

在修复 `injection-index.yaml` 中 `advice.work` 的语义错误时，直接编辑了产物文件
`docs/contexts/spec-first/injection-index.yaml`，而该文件由 `spec-graph-bootstrap` 运行时生成，
正确的修改目标是 `skills/spec-graph-bootstrap/SKILL.md` Phase 4 中的 yaml 生成模板。

## Symptoms

- `injection-index.yaml` 中发现 `advice.work: "优先 context-packs 和 test-map，而非 architecture"`
- 但 `stages.work` 已被修正为 `[code-facts/public-entrypoints.md, code-facts/test-map.md]`（不含 context-packs）
- 两者语义不一致，会误导 LLM 去查找不存在的上下文文件
- 第一反应是直接打开并编辑产物文件

## What Didn't Work

- **直接修改产物文件** `docs/contexts/spec-first/injection-index.yaml`
  - 原因：该文件在每次执行 `/spec:graph-bootstrap` 时会被重新生成，手工改动不可持久
  - 风险：形成源头与产物不一致的"配置漂移"

## Solution

修改源头模板，而非产物文件：

```bash
# 错误：修改产物
vi docs/contexts/spec-first/injection-index.yaml

# 正确：修改生成源头
vi skills/spec-graph-bootstrap/SKILL.md  # 找到 Phase 4 yaml 模板
```

**Before（SKILL.md Phase 4 模板中）**：
```yaml
advice:
  work: "优先 context-packs 和 test-map，而非 architecture"
```

**After**：
```yaml
advice:
  work: "优先 code-facts 和 test-map，而非 architecture"
```

修改源头后，如需立即生效，有两个路径：
1. 重新运行 `/spec:graph-bootstrap` 自动刷新产物
2. 同步手动更新产物文件（仅作临时对齐，源头已修复）

## Why This Works

spec-first 项目遵循**单向生成链**设计：

```
skills/spec-graph-bootstrap/SKILL.md   ← 源头（唯一真实来源）
         ↓ Phase 4：LLM 执行生成逻辑
docs/contexts/<slug>/injection-index.yaml  ← 产物（可重新生成）
```

产物文件是运行时的临时输出，应被视为"可重新生成的缓存"而非可手工维护的配置文件。
修改源头确保：持久性（变更在 git 历史中）、可重现性（任何人重跑得到一致结果）、可追溯性。

## Prevention

**识别 spec-first 中的产物 vs 源头**：

| 产物位置 | 源头位置 | 触发方式 |
|---------|---------|---------|
| `docs/contexts/<slug>/` 所有文件 | `skills/spec-graph-bootstrap/SKILL.md` Phase 4 | `/spec:graph-bootstrap` |
| `.spec-first/workflows/bootstrap/<slug>/` JSON 文件 | `skills/spec-graph-bootstrap/SKILL.md` 各 Phase | `/spec:graph-bootstrap` |
| `.claude/skills/`、`.agents/skills/` | `skills/` 目录各 SKILL.md | `spec-first init` |

**通用原则**：
1. 遇到文件内容错误，先追溯其生成来源，再决定修改位置
2. 产物目录（`docs/contexts/`、`.spec-first/workflows/`）中的文件默认不应手工编辑
3. 若无法立即重新生成产物，手工临时修改可接受——但必须同步修改源头

**检查方式**：
```bash
# 判断文件是否为产物：检查是否出现在 spec-graph-bootstrap 的输出描述中
grep -n "docs/contexts" skills/spec-graph-bootstrap/SKILL.md
```

## Related Issues

- `docs/plans/2026-04-13-002-artifact-path-standardization-design.md` — 产物路径标准化设计，解释了源头/产物分层的整体方案
- `docs/plans/2026-04-13-003-refactor-artifact-path-hard-cut-plan.md` — Unit 3 明确规定"只改 source-of-truth（skills/ 与 templates/），runtime 副本不作手工编辑入口"
- `docs/solutions/logic-errors/spec-bootstrap-deep-review.md` — 类似问题：PRD 模板（源头）vs 生成的 worker 产物的边界设计
