# Compression Strategy

## 目标

在不牺牲 Harness 质量的前提下降低 token 成本。压缩对象不是 evidence 和安全边界，而是重复正文、过期上下文、无预算 fanout、长 tool output、全文 handoff 和 runtime/source 双读。

## 9.1 Instruction Compression

| layer | strategy | target | expected saving | quality risk | acceptance criteria |
| --- | --- | --- | ---: | --- | --- |
| core `SKILL.md` | 保留 Purpose、When To Use、Inputs、Outputs、Workflow skeleton、Failure modes | 高频 skills | 30%-60% instruction tokens | 过度拆分导致执行漏规则 | 每个拆出的 ref 都有明确 load condition |
| references | 长 examples、walkthrough、bulk preview、repair recipes、edge cases 按需读取 | `spec-code-review`, `spec-doc-review`, `spec-work`, `spec-plan` | 3k-15k/run | ref 过多导致导航成本 | core 中只保留 ref index 和触发条件 |
| shared governance | 重复的 source/runtime、script/LLM、CHANGELOG、dispatch 边界提到共享 governance doc | all skills | 1k-5k/run | 多真相源 | 共享 doc 是 source-of-truth，skills 只引用 |
| agent profiles | Role + Trigger + Required Inputs + Output Format + Forbidden Behaviors | broad agents | 20%-50% agent prompt | agent 判断力下降 | output schema 覆盖原有 finding 质量 |
| examples | examples-as-context 只在编辑/eval/fresh-source 时读 | high-frequency workflows | 1k-5k/run | 普通执行少示例 | eval docs 保留 examples |

## 9.2 Artifact Compression

| artifact | current problem | strategy | expected saving |
| --- | --- | --- | ---: |
| plan | 下游可能读全文 | `plan-summary.md/json` + requirement ids | 30%-50% |
| task-pack | 可能复制 plan 内容 | task cards 引用 `requirement_id` / `plan_path` / anchor | 20%-40% |
| review | 人读报告和机器 consumption 混合 | `findings.json` + `review-envelope.txt` + full report path | 30%-60% |
| app-audit | 已有 summary，但多源 issue/report 仍大 | issue summary + evidence refs + full artifacts path | 20%-40% |
| compound | solution docs 长期累积 | `compound-delta.md` + index + stale/confirmed metadata | 30%-50% future reads |
| skill-audit | full JSON 重复快照 | summary default + full opt-in + retention | 50%+ artifact tokens |

## 9.3 Tool Result Compression

| source | strategy |
| --- | --- |
| test output | LLM 只看 failed test summary、exit code、failed file/line；完整 stdout/stderr 写 path |
| graph provider | readiness summary + provider status + reason_code；raw logs path-only |
| MCP/live query | normalize to top relevant facts；raw result size cap；invalid/oversized degraded |
| browser | screenshot ids + visual issue summary；trace/log path-only |
| git diff | changed file summary + focused hunks；full diff on demand |
| skill-audit scripts | default summary, `--full-json` explicit |

## 9.4 Workflow Compression

| handoff | default packet |
| --- | --- |
| brainstorm -> plan | requirements summary, R-IDs, key decisions, non-goals, open questions |
| plan -> write-tasks | plan summary, implementation units, source plan path/hash |
| write-tasks -> work | task card, affected files, validation notes, plan refs |
| work -> code-review | diff summary, task ids, tests run, known residuals, context bundle path |
| code-review -> work | merged actionable findings only, full reviewer JSON path |
| review -> compound | confirmed recurring lesson delta, evidence refs |
| sessions -> compound/work | session digest, no raw transcript |

## 9.5 Multi-agent Compression

1. Selective dispatch is default; all-agent fanout requires explicit reason.
2. Each agent receives only its context slice plus shared `context-bundle` id.
3. Each reviewer returns structured finding JSON with max finding count.
4. Synthesis reads structured findings, not long prose.
5. Low-confidence reviewers return `unknown` / `needs_evidence` rather than essay.
6. Parent workflow owns final judgment; agents do not duplicate full reports.

## Immediate Compression

| action | files/workflows | acceptance |
| --- | --- | --- |
| Exclude runtime audit artifacts from default context | all workflows | `.spec-first/audits/**` never read unless explicit audit |
| Shrink high-frequency skill cores | `spec-code-review`, `spec-work`, `spec-plan`, `using-spec-first` | core target <4k tokens or documented exception |
| Add review output cap | code/doc review | max reviewers and max findings stated |
| Summary-first handoff | work/review/compound | final response names artifact paths and summary |

Expected saving: **30%-40%**.

## Medium-term Compression

| action | acceptance |
| --- | --- |
| Shared `review-finding.v1` | code/doc/app review map to same minimum envelope |
| `artifact-summary.v1` | plan/task/review/compound/app-audit all include summary |
| script compact modes | graph/setup/audit/test scripts emit compact JSON by default |
| compound/session indexes | prior knowledge and session history consumed via index/digest |

Expected saving: **45%-55%**.

## Architecture-level Compression

| action | acceptance |
| --- | --- |
| Context Router MVP | skills request context via schema, no ad hoc all-doc reads |
| Context Bundle | included/excluded context has reasons, budget, confidence, degraded status |
| Budget CI/linter | high-frequency skill and artifact thresholds checked |
| Tool result clearing | raw tool outputs never stay in working context after summary is produced |

Expected saving: **60%-70%**.

## 不压缩的内容

- evidence requirements
- safety rules
- source/runtime boundaries
- degraded-mode reason codes
- CHANGELOG/source governance
- tests and deterministic verification facts
- reviewer confidence and actionable finding standards
