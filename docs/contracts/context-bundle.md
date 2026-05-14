# Context Bundle 合同

`context-request.v1` 和 `context-bundle.v1` 是 `spec-first` 的轻量上下文包合同。它们用于把当前任务需要的 related paths、artifact summaries、evidence paths 和 full-read triggers 放进一个可审查 envelope 中。

这不是中心化 Context Router，也不是 workflow 状态机。脚本只准备确定性路径、预算和 reason；LLM 仍决定哪些上下文足以支持当前 plan、work、review 或 compound 判断。

## 目标

- 为高频 workflow 提供 cache-friendly dynamic suffix：当前请求、diff、tool summary、临时 evidence 和 context bundle 放在稳定指令之后。
- 让 reviewer / worker / researcher 收到最小充分 context，而不是 full repo、full docs、full artifact 或 generated runtime mirror。
- 记录 included / excluded context 的 reason_code，预算超限时显式 degraded。
- 保留 path-backed evidence；full content 只在 `full_read_triggers` 命中时按路径展开。

## 非目标

- 不实现 provider-specific repo map。
- 不替 workflow 做语义优先级排序。
- 不替代 `docs/contracts/context-governance.md` 的 runtime exclusion policy。
- 不把 raw logs、MCP dumps 或 reviewer JSON 全文复制到 agent prompt。

## `context-request.v1`

```json
{
  "schema_version": "spec-first.context-request.v1",
  "stage": "work",
  "intent": "execute_task_pack",
  "spec_id": null,
  "task_ids": [],
  "changed_files": ["skills/spec-work/SKILL.md"],
  "needs": ["plan_summary", "task_card", "diff", "tests"],
  "budget": {
    "max_files": 20,
    "max_tokens": 60000,
    "prefer_symbols": true,
    "allow_full_file": false
  }
}
```

## `context-bundle.v1`

```json
{
  "schema_version": "spec-first.context-bundle.v1",
  "request": {
    "schema_version": "spec-first.context-request.v1",
    "stage": "work",
    "intent": "execute_task_pack"
  },
  "related_paths": [
    {
      "path": "skills/spec-work/SKILL.md",
      "source": "changed_file",
      "reason": "directly changed by current task",
      "tokens_estimated": 0
    }
  ],
  "artifact_summaries": [
    {
      "path": "docs/plans/example-summary.md",
      "reason": "summary-first handoff"
    }
  ],
  "evidence_paths": [
    {
      "path": "tests/unit/spec-work-contracts.test.js",
      "reason": "focused verification target"
    }
  ],
  "full_read_triggers": [
    "summary is missing required scope or non-goal details",
    "reviewer needs exact evidence for an actionable finding"
  ],
  "excluded_context": [
    {
      "path": ".spec-first/audits/example",
      "reason_code": "runtime_audit_artifact_excluded",
      "reason": "runtime audit artifacts are excluded from ordinary context"
    }
  ],
  "budget_used": {
    "files": 3,
    "estimated_tokens": 0
  },
  "confidence": "medium",
  "degraded": false,
  "reason_code": null
}
```

## Consumption 规则

1. Stable instruction prefix 保持稳定：role contract、workflow contract summary、hard boundaries 和 reference index。
2. Dynamic suffix 承载 volatile context：user request、diff summary、tool summary、test output summary、context bundle 和 temporary evidence paths。
3. Consumer 先读取 `artifact_summaries`，再读取完整 artifact paths。
4. Consumer 精确读取 `evidence_paths`；没有新的 reason 时，不扩展到父目录。
5. 只有列出的 `full_read_triggers` 命中时，consumer 才展开完整文件。
6. `docs/contracts/context-governance.md` 排除的 runtime/generated paths 仍保持排除，除非任务明确是 setup/update/runtime-drift/audit scope。
7. Degraded bundle 仍是有用 evidence，但最终判断必须说明 limitation。

## 最小内部 Helper

`spec-first internal context-bundle --json` 可以从显式 path arguments 生成这个 envelope。它是 deterministic helper：把路径规范化为 repo-relative canonical paths，应用 runtime / outside-repo / symlink-escape exclusion，记录 budget pressure 并输出 JSON。它不搜索 repo、不排序文件、不检查 provider internals，也不决定 semantic relevance。
