# Token Budget Policy

## Policy Summary

所有预算都是默认值，不是质量上限。超过预算时必须显式降级或请求更大上下文，不能静默读全量。

## 13.1 Skill MD Budget

| skill class | target core budget | hard review threshold | policy |
| --- | ---:| ---:| --- |
| high-frequency public workflow | 3,000-4,000 tokens | 5,000 tokens | 超过必须拆 references 或说明 why core-only不可行 |
| medium-frequency workflow | 2,000-3,000 tokens | 4,000 tokens | examples/checklists 不进 core |
| internal helper | 800-1,500 tokens | 2,000 tokens | 只保留 delegated boundary 和 inputs/outputs |
| beta/experimental | 1,500-3,000 tokens | 4,000 tokens | stable 规则复用引用，不复制 |

Required rules:

- 长 checklist 放 references。
- 长 examples 放 references。
- 重复 governance 放共享 contract。
- host-specific detail 放 templates 或 host refs。
- `SKILL.md` 必须说明何时读取 refs。

## 13.2 Agent MD Budget

| agent class | target budget | policy |
| --- | ---: | --- |
| reviewer persona | 600-1,200 tokens | narrow trigger + evidence rules + JSON output |
| broad researcher | 1,000-1,800 tokens | max sources / max refs / authority rules |
| synthesis/report writer | 800-1,500 tokens | structured inputs, compact output |
| mutating agent | 0 | 退役或迁移到 workflow-owned phase |

禁止：

- 复制 skill workflow。
- 输出长篇方法论。
- 同时拥有 diagnosis、mutation、verification 和 final judgment。
- 无 schema 的自由散文 findings。

## 13.3 Artifact Budget

| artifact | default budget | policy |
| --- | ---: | --- |
| requirements/brainstorm | 3k-8k | summary + R-IDs + decisions |
| plan | 5k-12k | downstream reads summary first |
| task-pack | 3k-8k | task cards reference plan ids |
| review report | human report can be long; handoff <=3k | machine findings canonical |
| compound doc | 2k-6k | index/delta for future reads |
| app-audit report | report + summary split | headless envelope <=3k |

每个 durable artifact 必须有 summary。下游默认读 summary；full artifact 只在需要时读取。

## 13.4 Review Budget

| review type | default reviewer budget | max findings | context rule |
| --- | --- | ---: | --- |
| tiny low-risk code diff | 2-3 reviewers | 10 merged | diff summary + changed files |
| normal code diff | 4-6 reviewers | 15 merged | changed files + direct deps |
| sensitive code diff | 6-8 reviewers | 20 merged | allow broader deps with reason |
| doc review | 2 always-on + selected conditional | 15 merged | section map, not full doc per reviewer |
| app audit | selected experts only | 20 issues | audit-plan chooses expert slices |

Reviewer output must be structured. Synthesis reads structured findings, not full prose.

## 13.5 Tool Result Budget

| tool result | LLM-visible default | raw storage |
| --- | --- | --- |
| tests | failed tests, exit code, failed file/line | full log path |
| graph | readiness, reason_code, top facts | raw provider log path |
| search | top matches with reasons | command output path if huge |
| browser | screenshot ids + issue summary | trace/log/screenshot paths |
| MCP | normalized facts with provenance | raw result path, size cap |
| audit scripts | summary markdown/json | full JSON opt-in |

If a tool output exceeds budget, summarize, truncate with reason, and store path. Do not paste raw output into workflow context.

## 13.6 Session Budget

| item | policy |
| --- | --- |
| current run state | compact summary only |
| raw conversation history | not durable context |
| prior sessions | metadata + skeleton/error extracts only |
| decision log | summarize decisions and evidence refs |
| resume instruction | compact, no raw tool transcript |
| compound handoff | confirmed delta only |

`spec-sessions` 的既有规则“never read entire session files”应提升为全局 session budget policy。

## Budget Failure Modes

| reason_code | response |
| --- | --- |
| `context_budget_exceeded` | return partial bundle and excluded_context |
| `full_file_not_allowed` | provide excerpt and path |
| `raw_tool_result_too_large` | summarize and link raw log path |
| `reviewer_budget_exceeded` | rank reviewers, skip with reason |
| `artifact_summary_missing` | generate summary first or ask for permission |
