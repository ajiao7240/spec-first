# Context Governance Contract

本 contract 固化 `spec-first` 的默认上下文消费边界。它不是 Context Router 实现，也不是 workflow 状态机；它只定义普通 workflow 在读取 repo context 时必须遵守的最小 runtime exclusion policy。

它是 AI Coding Harness 的 Context Harness 边界之一；目录级 Harness map 见 `docs/contracts/ai-coding-harness.md`。

## Goals

- 默认不把 runtime / generated / audit artifacts 当作普通上下文。
- 保留 source-first、summary-first、path-backed evidence 的读取方式。
- 固化 cache-friendly prompt layout：稳定指令前置，动态请求、diff、tool summary 和临时 evidence 后置。
- 允许 runtime/setup/audit workflow 在明确任务范围内读取对应 artifacts。
- 在超出默认上下文预算时记录 reason，而不是静默读取全量目录。

## Non-Goals

- 不实现中心化 context router。
- 不替代 `spec-plan`、`spec-work`、`spec-code-review` 或 `spec-doc-review` 的语义判断。
- 不禁止读取明确用户指定的文件。
- 不把 `.gitignore` 当作 LLM context policy 的唯一来源。

## Default Exclusions

普通上下文读取默认排除：

| path | reason_code | 说明 |
| --- | --- | --- |
| `.spec-first/audits/**` | `runtime_audit_artifact_excluded` | skill/runtime 审计执行产物，体积大、可重建，不是 source truth |
| `.claude/**` | `generated_runtime_mirror_excluded` | Claude generated runtime mirror / host-local state |
| `.codex/**` | `generated_runtime_mirror_excluded` | Codex generated runtime mirror / host-local state |
| `.agents/skills/**` | `generated_runtime_mirror_excluded` | Codex-facing generated skill mirror |

普通 workflow 仍可读取 checked-in source truth，例如 `skills/`、`agents/`、`templates/`、`src/cli/`、`docs/contracts/`、`AGENTS.md`、`CLAUDE.md`、`README*` 和当前任务直接相关的源码、测试、计划或需求文档。

## Host Instruction Reuse Policy

`AGENTS.md`、`CLAUDE.md` 和项目角色文档是 host / project instruction layer。Claude 或 Codex 进入仓库时通常已经把适用的入口指令注入到当前会话；普通 workflow 的 context orientation 应优先使用这些已加载的 host/project instructions，而不是因为 prompt 提到 instruction files 就重新读取根 `AGENTS.md` / `CLAUDE.md`。

允许精确读取 instruction source 的场景是：

1. 用户明确点名某个 instruction 文件或具体路径。
2. 当前任务正在修改、审查、生成或诊断 instruction / runtime / setup / update / audit / source-runtime drift 行为。
3. 已加载指令缺失、明显 stale、与当前 source 冲突，或 workflow 需要核对 source-of-truth 以避免漂移。
4. 需要检查目录级 `AGENTS.md` / `CLAUDE.md` 是否管辖当前 changed files，而该目录级指令未出现在已加载 host context 中。
5. `spec-code-review` 的 project-standards persona 需要自包含 standards path list；父级 orchestrator 只发现并传递路径，leaf reviewer 只读取与 changed files 相关的 sections。

禁止把根 `AGENTS.md` / `CLAUDE.md` 当作每次 plan/work/debug/review 的普通必读上下文。若只是为了执行方向校准，使用已加载 instruction summary；若因上述例外读取 source 文件，在输出、Coverage 或 closeout 中说明读取原因即可。

## Runtime Artifact Policy

`.spec-first/graph/**`、`.spec-first/providers/**`、`.spec-first/impact/**`、`.spec-first/workspace/**`、`.spec-first/app-audit/**` 和 `.spec-first/workflows/**` 默认也不是普通 source context。下游 workflow 应优先读取该目录下的 canonical summary、readiness facts、validated contract 或明确路径，而不是扫描整棵 `.spec-first/**`。

`summary-first` 规则：

1. 先读取 summary、manifest、status、readiness facts 或用户指定路径。
2. 需要更深证据时，按具体 artifact path 精确读取。
3. 不把 raw logs、大 JSON、旧 audit snapshots 或 generated mirrors 广播给 reviewer / worker。
4. 如果因为预算或边界排除 context，应在输出或 coverage 中说明 excluded path 和 reason_code。

GitNexus live MCP results、`review-pre-facts` raw results 和 `gitnexus-session-evidence.v1` summaries 遵循同一规则：只传 compact facts、source-read requirements、limitations 和 temp artifact paths；不得把 raw MCP dumps 或完整 provider output 广播进普通 prompt bundle。

## Cache-Friendly Prompt Layout

高频 workflow 应把输入分成两个稳定层：

| layer | 内容 | 规则 |
| --- | --- | --- |
| stable instruction prefix | role contract、workflow contract summary、hard boundaries、reference index、source/runtime policy | 稳定排序、稳定措辞；不混入 git status、测试输出、MCP dump、raw log 或一次性诊断 |
| dynamic suffix | 当前 user request、diff summary、changed files、tool summary、artifact summary、context bundle、temporary evidence paths | 每轮按需生成；大输出使用 summary + path，full content 按 trigger 精确展开 |

`docs/contracts/context-bundle.md` 定义 `context-request.v1` / `context-bundle.v1` 的最小 envelope；`docs/contracts/artifact-summary.md` 定义 durable artifact 的 summary-first handoff。普通 workflow 应优先传递这些 compact facts，而不是复制 full artifact、full report 或 raw tool output。

## Allowed Exceptions

这些任务可在明确范围内读取对应 runtime artifacts：

| workflow / task | allowed scope |
| --- | --- |
| `spec-update` / `spec-mcp-setup` | runtime delivery、host setup、drift repair 所需的 host runtime paths |
| `spec-graph-bootstrap` | `.spec-first/graph/**`、`.spec-first/providers/**`、`.spec-first/impact/**` 的 readiness / provider evidence |
| `spec-skill-audit` | `.spec-first/audits/skill-audit/**` 的本轮 summary、scorecard、runtime-drift evidence |
| `spec-app-consistency-audit` | `.spec-first/app-audit/**` 的 run-scoped evidence |
| changelog author resolution | 精确读取当前 host developer profile：`.codex/spec-first/.developer` 或 `.claude/spec-first/.developer`，只用于 `CHANGELOG.md` 作者字段，不纳入 broad context bundle |
| user-explicit path request | 只读取用户明确点名的文件或目录，并说明它是 runtime/generated/audit context |

例外不改变 source-of-truth：generated runtime mirrors 仍应通过 source 修改后运行 `spec-first init` 并选择目标宿主来修复，不能手改 mirror 作为 source fix。

## Workflow Consumption Rule

普通 plan/work/debug/review/compound/session context 收集应按以下顺序读取：

1. 用户请求、diff、changed files、计划/需求/task-pack summary。
2. source-of-truth files 和 nearby implementation/test slices。
3. canonical readiness / review facts 的 summary 或 validated contract。
4. 精确路径的 full artifact 或 raw evidence，仅当用户要求、workflow 明确需要，或 summary 显示证据不足。

禁止把 `.spec-first/audits/**`、`.claude/**`、`.codex/**`、`.agents/skills/**` 纳入默认 `rg --files` / file-search / agent prompt bundle 的普通候选集。

内部 context helper 在匹配排除规则前必须先把输入路径规范化为 repo-relative canonical path；解析后位于当前 repo 外的路径，或 repo 内 symlink 解析后指向 repo 外的路径，必须以 `outside_repo_context_excluded` 排除，除非上游 workflow 明确使用了自己的外部路径合同。

## Failure Modes

| reason_code | behavior |
| --- | --- |
| `runtime_audit_artifact_excluded` | 返回 path/summary 指针，说明 audit artifact 不是普通 source context |
| `generated_runtime_mirror_excluded` | 指向 source-of-truth 或 update/init workflow |
| `outside_repo_context_excluded` | 不纳入普通 repo context bundle；需要外部路径时由上游 workflow 使用显式合同 |
| `runtime_context_requested_by_non_runtime_workflow` | 只读取用户明确路径；否则排除并说明边界 |
| `summary_missing` | 读取最小可用 status/manifest，或要求用户确认是否展开 full artifact |
| `context_budget_exceeded` | 生成 compact summary + excluded_context，不 silent full-read |

## Validation Expectations

- Host bootstrap 应提示默认 runtime exclusion。
- 高频 public workflows 的 context orientation 应引用本 contract 或等价规则。
- Contract tests 应防止 `.spec-first/audits/**` 和 generated mirrors 被重新描述为普通上下文。
