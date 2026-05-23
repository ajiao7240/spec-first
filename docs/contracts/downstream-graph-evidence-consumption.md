# Downstream Graph Evidence Consumption

## 目标

本文定义 `$spec-work`、`$spec-code-review` 和 `$spec-debug` 如何消费 `$spec-plan` 产出的 `## Graph / GitNexus Evidence` envelope，以及 `$spec-work` run artifact 中的 `graph_evidence_used` session-local 摘要。

这是 downstream consumer 专用 light contract。它不定义新的 readiness truth，不重写 `docs/contracts/graph-evidence-policy.md` 的四轴枚举和 Plan envelope validity matrix，也不替代 `docs/contracts/workspace-gitnexus-consumption.md` 的多仓 scope 规则。

## Source Of Truth

- Plan envelope 四轴继续来自 `docs/contracts/graph-evidence-policy.md`：`capability_status`、`evidence_grade`、`evidence_posture`、`freshness_state`。
- GitNexus capability、`source_tags[]` 和 mutation boundary 继续来自 `docs/contracts/gitnexus-capability-catalog.md`。
- 多仓 workspace 的 target repo / per-child scope 继续来自 `docs/contracts/workspace-gitnexus-consumption.md`。
- Downstream workflow 只能把 plan/work graph evidence 当 implementation/review/debug focus pointer；scope authority 仍来自用户请求、origin requirements、plan/task pack、当前 git diff 和显式 repo scope。

## Consumer Role Vocabulary

| Consumer role | Workflow | Consumption point | Purpose |
| --- | --- | --- | --- |
| `plan-intake` | `$spec-work` | Phase 1 plan/task-pack intake | 用 `capabilities_used`、`key_findings`、`impact_on_plan` 和 `source_reads_required` 缩小 source reads 与 test selection。 |
| `review-preflight` | `$spec-code-review` | runtime readiness preflight before reviewer dispatch | 汇总 plan/work evidence posture，选择是否使用 GitNexus native capability，统一写入 Coverage。 |
| `debug-trace` | `$spec-debug` | hypothesis ledger and causal-chain validation | 记录 GitNexus 对 hypothesis 的贡献，并要求 root cause 由 reproduction/source/log/test 等 non-graph evidence 关闭因果链。 |

## Output Locations

| Workflow | Output location | Required shape |
| --- | --- | --- |
| `$spec-work` | `skills/spec-work/references/shipping-workflow.md` closeout 的 `Graph evidence used` / `graph_evidence_used` section；可选写入 `spec-work-run-artifact` 的 `graph_evidence_used` object | `capabilities_used`、`evidence_grade`、`evidence_posture`、`freshness_state`、`repo_scope`、`graph_findings_applied`、`graph_findings_as_risk_only`、`source_reads_validated`、`redaction_status` |
| `$spec-code-review` | `skills/spec-code-review/references/review-output-template.md` 的 Coverage section | `Graph evidence: <posture/display> (from plan/work/native tools) \| limitations: <reason>` |
| `$spec-debug` | hypothesis ledger 的 optional `graph_evidence` field；Debug Summary 的 `graph_claims_validated_by` / `graph_claims_remaining_advisory` when-applicable section | Graph claim 必须标明 capability、摘要、freshness/grade 和 causal-chain link；root cause 需要 non-graph confirmation |

## Repo Scope Vocabulary

Downstream workflow 只能使用以下 `repo_scope` 词表：

- `<target-repo-name>`：单仓或写入前已明确 target repo。
- `per-unit`：plan/task pack 为每个 implementation unit 指定 repo scope。
- `per-fix`：debug 为每个 fix 指定 repo scope。
- `parent-workspace-orientation-only`：父 workspace / GitNexus group evidence 只能用于 read-only orientation；写入、测试、review autofix 或 commit 前仍必须 resolve 明确 `target_repo` 或 per-child scope。

`group.status="group-ready"` 只表示 read-only orientation surface 可以辅助查询，不表示 workflow 获得跨 repo 写入权限。

## Validity Constraints

Downstream consumer 共用 `docs/contracts/graph-evidence-policy.md` 的 Plan envelope validity matrix。不得为 downstream workflow 引入第二套合法性 enum，也不得把 `fallback` 当作 `evidence_grade`。

- `evidence_grade=primary` 可以与 `evidence_posture=fallback` 共存；这表示 source/test/schema 等 fallback 事实已 confirmed。
- `evidence_grade=stale` 或 `evidence_grade=advisory` 只能作为 pointer；必须由 direct source reads、tests、logs 或 schema/contract checks 确认后才能成为 finding/root-cause/implementation fact。
- `source_reads_required` 中列出的文件、符号或测试必须 direct read 或执行相应验证；GitNexus pointer 不能替代这些读取。
- plan/work evidence 缺失、reader not-found/not-readable、artifact scope mismatch 或 schema shape 不可用时，consumer 记录 `Graph evidence: unavailable` / `stale` 并继续 bounded direct reads。

## Degraded-Once Rule

`degraded-once rule`：同一次 downstream run 中，如果 GitNexus 或 graph provider unavailable/stale/degraded/query-unverified，orchestrator 只在 closeout、Coverage 或 Debug Summary 中记录一次 provider limitation。不要让每个 reviewer persona、每条 hypothesis 或每个 implementation slice 重复探测同一个不可用 provider。

如果后续步骤需要 graph-heavy primary evidence，应 handoff 到 `$spec-graph-bootstrap` / `/spec:graph-bootstrap`，而不是在 downstream workflow 内部静默 rebuild。

## Non-Expansion Rule

`non-expansion rule`：GitNexus 发现的额外 repo、route、symbol、consumer、flow 或 blast radius 只能进入 risk / follow-up / test-candidate / review coverage，不得自动扩大 plan/task/debug target scope。

Downstream workflow 可以用 graph findings 优先读文件、选择测试或提出风险，但实现边界仍由 plan/task pack 和明确 target repo 决定。

## D4 Mutation-Gated Boundary Note

D4 是 boundary document，不是 maintenance workflow 实现。

`workspace_group_sync`、`group_sync`、`symbol_rename`、GitNexus `rename` 或等价 mutation-capable capability 必须标记为 `mutation-gated` / `requires explicit user action`。`mutation-gated ≠ unavailable`：它表示 capability 可能存在，但普通 `$spec-work`、`$spec-code-review`、`$spec-debug` 不得自动执行。

进入 mutation-capable maintenance path 之前，必须满足：

- preview-first output；
- explicit user action；
- 明确 `target_repo`、group scope 或 per-child scope；
- 独立 maintenance workflow 或后续计划。

禁止把此边界改写成自动执行 group 同步、无声重命名、自动同步 group registry 或自动多文件 rename。
