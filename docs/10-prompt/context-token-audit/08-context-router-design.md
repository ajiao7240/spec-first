# Context Router Design

## 目标

Context Router MVP 让 workflow 不再自行“到处读上下文”，而是提交 `context-request`，获得带预算、来源、included/excluded reason、degraded status 的 `context-bundle`。

该机制必须保持 `Scripts prepare, LLM decides`：router 只准备和裁剪事实，不替 LLM 做语义结论。

## Non-goals

- 不做中心化 workflow engine。
- 不做强状态机。
- 不替代 `spec-plan` / `spec-work` / `spec-review` 的判断。
- 不把 provider 内部实现变成 workflow contract。
- 不默认读全仓、全 docs、全 runtime。

## Context Request Schema

```json
{
  "schema_version": "spec-first.context-request.v1",
  "stage": "code-review",
  "intent": "review_diff_for_regression_risk",
  "spec_id": null,
  "task_ids": [],
  "changed_files": [],
  "needs": [
    "requirements",
    "plan_summary",
    "task_pack",
    "diff",
    "direct_dependencies",
    "callers",
    "tests",
    "standards",
    "compound_failures"
  ],
  "budget": {
    "max_files": 20,
    "max_tokens": 60000,
    "prefer_symbols": true,
    "allow_full_file": false
  }
}
```

## Context Bundle Schema

```json
{
  "schema_version": "spec-first.context-bundle.v1",
  "request_id": "ctx_...",
  "stage": "code-review",
  "intent": "review_diff_for_regression_risk",
  "providers_used": [],
  "included_context": [
    {
      "kind": "diff_summary",
      "path": null,
      "tokens_estimated": 1200,
      "reason": "directly requested by stage"
    }
  ],
  "excluded_context": [
    {
      "kind": "runtime_artifacts",
      "path": ".spec-first/audits/",
      "reason": "runtime audit artifacts are not source truth and exceed budget"
    }
  ],
  "summaries": [],
  "evidence_refs": [],
  "tool_results": [],
  "budget_used": {
    "estimated_tokens": 0,
    "files": 0
  },
  "confidence": "medium",
  "degraded": false,
  "reason_code": null
}
```

## Provider Priority

```text
1. direct artifacts: task-pack, evidence-packet, review-findings
2. git diff / changed files
3. graph readiness / graph facts
4. code-review-graph impact
5. Serena symbol lookup
6. ast-grep structural search
7. ripgrep fallback
8. standards / repo-profile / glue-map
9. compound index
10. full file fallback
```

## Bundle Principles

1. 默认给摘要。
2. 必要时给片段。
3. 最后才给全文。
4. 所有 included context 必须有 reason。
5. 所有 excluded context 可记录 reason，超预算必须记录。
6. provider degraded 必须显式说明。
7. full file fallback 必须绑定 changed file、direct dependency 或用户明确要求。
8. runtime mirror 默认排除，只有 setup/update/drift/audit workflow 可读。
9. raw logs 和 raw tool outputs 默认 path-only。
10. bundle 是 advisory artifact，不是 semantic conclusion。

## MVP Phases

| phase | deliverable | consumers | validation |
| --- | --- | --- | --- |
| C4-1 | `context-request.v1` / `context-bundle.v1` prose contract | code-review, doc-review | schema examples parse |
| C4-2 | `spec-first internal context-bundle --stage ... --json` preview script | review/work/debug | unit tests with budget caps |
| C4-3 | review-pre-facts integration | code/doc review | degraded/provider budget tests |
| C4-4 | artifact-summary registry | plan/task/review/compound | docs contract tests |
| C4-5 | runtime exclusion policy | all workflows | lint rejects default `.spec-first/audits` reads |

## Example Requests

| stage | request intent | default included | default excluded |
| --- | --- | --- | --- |
| doc-review | review plan quality | document section map, source links, pre-facts | unrelated docs, runtime mirrors |
| code-review | review diff | diff summary, changed files, direct deps, tests | full docs, full changelog, old audit artifacts |
| work | execute task | current task card, affected file slices, validation notes | full plan/task-pack unless needed |
| compound | capture learning | confirmed fix summary, changed file refs, related solution index | raw session transcript |
| graph-bootstrap | compile readiness | provider summary, reason_code, raw log paths | raw logs content unless failure drilldown |

## Failure Modes

| reason_code | meaning | behavior |
| --- | --- | --- |
| `budget_exceeded` | requested context exceeds budget | return truncated bundle with excluded reasons |
| `provider_degraded` | graph/MCP provider unavailable/stale | use lower provider tier and mark degraded |
| `source_scope_ambiguous` | target repo/files unclear | ask for clarification or route to plan |
| `runtime_context_blocked` | runtime mirror requested by non-runtime workflow | exclude and explain source/runtime boundary |
| `no_relevant_context` | search found nothing useful | return empty bundle with confidence low |
