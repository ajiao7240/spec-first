# Artifact Summary 合同

`artifact-summary.v1` 是 durable workflow artifact 的共享 summary-first handoff 合同。它让下游 plan、work、review、compound 和 release 步骤先消费简短摘要与精确 evidence paths，再决定是否读取完整 artifact。

本合同不要求每个 producer 立刻写入新文件。在某个 workflow 拥有确定性 producer 之前，可以在 handoff 中提供等价 summary 段落。边界保持一致：先 summary，只有命中明确 trigger 时才展开 full artifact。

## 目标

- 避免把长计划、review report、audit JSON、raw log 或 session transcript 传给每个下游 agent。
- 通过携带 source paths、evidence paths 和 full-read triggers 保留可追踪性。
- 让 summary 足够短，便于 cache-friendly 传递和索引。

## 非目标

- 不是第二份完整报告。
- 不是 underlying artifact 的 source-of-truth 替代品。
- 不是 script-owned semantic conclusion。

## `artifact-summary.v1`

```json
{
  "schema_version": "spec-first.artifact-summary.v1",
  "artifact_type": "plan|task-pack|review|work|compound|audit|release|graph-readiness",
  "source_path": "docs/plans/example-plan.md",
  "producer": "spec-plan",
  "timestamp": "2026-05-14T00:00:00Z",
  "goal": "简短说明 artifact 目的",
  "scope": ["repo-relative/path-or-area"],
  "non_goals": ["明确排除的工作"],
  "key_conclusions": ["下游需要先看到的决策或结果"],
  "changed_facts": ["此 artifact 改变的确定性事实"],
  "unresolved_risks": ["仍相关的风险或未知项"],
  "evidence_paths": ["tests/unit/example.test.js"],
  "recommended_next_action": "当前 host work entrypoint",
  "full_artifact_read_triggers": [
    "summary 缺少必需的 requirement、task、finding 或 evidence detail",
    "下游 reviewer 需要精确 prose 或 line references 才能形成 finding"
  ]
}
```

## Producer 规则

- Plan 和 task artifacts 汇总 goal、scope、non-goals、implementation units、validation 和 open questions。
- Review artifacts 汇总 verdict、actionable findings、residual status、evidence paths 和完整 reviewer artifact path。
- Work artifacts 汇总 changed files、verification commands、review tier 和 residual status。
- Compound artifacts 汇总 reusable lesson delta 与 source evidence paths。
- Tool-heavy artifacts 汇总 exit code、reason_code、关键字段和 raw log paths，而不是嵌入 raw output。

## Consumer 规则

1. 先读取 summary。
2. 只有 `full_artifact_read_triggers` 适用时才展开 full artifact。
3. agent handoff 传递 summary 和 paths，不复制 full artifact body。
4. 如果缺少 summary，标记 `summary_missing`，并读取最小可用 status、manifest 或 explicit path。
