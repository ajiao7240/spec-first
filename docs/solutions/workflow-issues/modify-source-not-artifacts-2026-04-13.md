---
title: "修改生成产物而非源头模板"
date: "2026-04-13"
category: "workflow-issues"
module: "spec-first"
problem_type: "workflow_issue"
component: "documentation"
severity: "high"
applies_when:
  - "发现 docs/contexts/ 或 .spec-first/workflows/ 里的生成产物与预期不一致"
  - "需要修复 spec-first 工作流的生成逻辑或模板输出"
tags: ["injection-index", "spec-graph-bootstrap", "source-of-truth", "artifact", "generated-file", "phase-4"]
---

# 修改生成产物而非源头模板

## Context

在修复 `injection-index.yaml` 中 `advice.work` 的语义错误时，很容易直接打开
`docs/contexts/spec-first/injection-index.yaml` 这样的产物文件动手改，但它其实由
`spec-graph-bootstrap` 运行时生成，真正的 source-of-truth 在
`skills/spec-graph-bootstrap/SKILL.md` 的 Phase 4 模板里。

## Guidance

遇到 `docs/contexts/`、`.spec-first/workflows/`、`.claude/`、`.codex/` 等运行时或生成产物出错时，先反向追踪生成链，优先修改源头模板，而不是直接修补产物。

修改路径示例：

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

## Why This Matters

spec-first 项目遵循**单向生成链**设计：

```
skills/spec-graph-bootstrap/SKILL.md   ← 源头（唯一真实来源）
         ↓ Phase 4：LLM 执行生成逻辑
docs/contexts/<slug>/injection-index.yaml  ← 产物（可重新生成）
```

产物文件是运行时的临时输出，应被视为“可重新生成的缓存”而非可手工维护的配置文件。修改源头确保：持久性、可重现性、可追溯性。

## When to Apply

- 发现某个生成文件的内容错误，但不确定该改哪里时
- 处理 workflow / template / command / runtime asset 一致性问题时
- 看到改动目标位于 `docs/contexts/`、`.spec-first/`、`.claude/`、`.codex/` 这类明显产物目录时

## Examples

**识别 spec-first 中的产物 vs 源头**：

| 产物位置 | 源头位置 | 触发方式 |
|---------|---------|---------|
| `docs/contexts/<slug>/` 所有文件 | `skills/spec-graph-bootstrap/SKILL.md` Phase 4 | `/spec:graph-bootstrap` |
| `.spec-first/workflows/bootstrap/<slug>/` JSON 文件 | `skills/spec-graph-bootstrap/SKILL.md` 各 Phase | `/spec:graph-bootstrap` |
| `.claude/skills/`、`.agents/skills/` | `skills/` 目录各 SKILL.md | `spec-first init` |

**通用原则**：
1. 遇到文件内容错误，先追溯其生成来源，再决定修改位置
2. 产物目录（`docs/contexts/`、`.spec-first/workflows/`）中的文件默认不应手工编辑
3. 若无法立即重新生成产物，手工临时修改可接受，但必须同步修改源头

**检查方式**：
```bash
grep -n "docs/contexts" skills/spec-graph-bootstrap/SKILL.md
```

## Related

- `docs/plans/2026-04-13-002-artifact-path-standardization-design.md` — 产物路径标准化设计，解释了源头/产物分层的整体方案
- `docs/plans/2026-04-13-003-refactor-artifact-path-hard-cut-plan.md` — Unit 3 明确规定“只改 source-of-truth（skills/ 与 templates/），runtime 副本不作手工编辑入口”
- `docs/validation/2026-04-01-spec-bootstrap-deep-review.md` — 类似问题：PRD 模板（源头）vs 生成的 worker 产物的边界设计
