# 最终建议

## 总体结论

当前 `spec-first` 的 skill / agent Markdown 已经明显超出普通 prompt 说明，进入了“部分 AI Coding Harness”的阶段。最成熟的节点已经具备稳定工程阶段的形态：`spec-graph-bootstrap`、`spec-write-tasks`、`spec-code-review`、`spec-doc-review`、`spec-plan`、`spec-app-consistency-audit`、`spec-skill-audit`。

但它还没有达到完整 H5。主要原因不是文档不够长，而是四类闭环缺口仍会影响可信度：

1. 少数 helper skill 存在 public/internal 边界泄漏。
2. 两个 agent 仍承担了 source-mutating workflow 职责。
3. code/doc/app review 的 finding contract 尚未统一。
4. 本轮 runtime mirror drift 未能完成确定性验证。

终审判断：当前等级为 **H4 Evidence-governed Harness**，目标等级为 **H5 Review-closed Engineering Loop**。暂不建议追求 H6；应先关闭 P0/P1 的边界、证据、handoff 和 review closure 缺口。

## 审查完整性

| 项目 | 结果 |
| --- | --- |
| 审查来源 | `docs/10-prompt/审查skill.md` |
| Skill 覆盖 | 40 个 `skills/**/SKILL.md` |
| Agent 覆盖 | 51 个 `agents/*.agent.md` |
| 交叉审查方式 | 每个 Markdown 文件两轮只读审查：contract review + boundary/overlap review |
| deterministic skill scan | P0 0 / P1 180 / P2 102 signals |
| 最终语义风险计数 | P0 8 / P1 42 / P2 68 |
| runtime drift | 未验证；`--runtime` 因 trusted-checkout validation 失败而不能证明 clean |

## 质量等级

| 领域 | 等级 | 原因 |
| --- | --- | --- |
| 核心 workflow skills | B | 证据、边界和阶段职责较强，但 contract 仍偏 prose-heavy。 |
| 辅助 / internal skills | D | 多个 helper 看起来像 public workflow 或 mutating tool，缺少清晰 helper contract。 |
| Code-review agents | A- | JSON 输出、confidence anchor、suppress rules 和 persona 边界较成熟。 |
| Doc / research / lens agents | C | 专业价值明确，但输出格式、context budget 和 evidence anchor 不够一致。 |
| Runtime governance | B- | source/runtime 边界表达清楚，但本轮 runtime drift 未得到确定性验证。 |

## P0 阻断风险

| id | 对象 | 发现 | 立即建议 |
| --- | --- | --- | --- |
| P0-001 | `test-browser` | governance 标记为 `internal_only`，但正文暴露 `/test-browser` 示例和 “Fix now” 修复路径。 | 改为 delegated browser evidence helper；删除 public command 示例和直接修复权。 |
| P0-002 | `test-xcode` | governance 标记为 `internal_only`，但正文暴露 `/test-xcode` 示例和 “Fix now” 修复路径。 | 改为 delegated simulator evidence helper；修复决策归 parent workflow。 |
| P0-003 | `using-spec-first` | route map 推荐 `git-commit-push-pr` internal helper。 | PR description 需求应通过 public workflow / shipping handoff 进入，不直接暴露 internal helper。 |
| P0-004 | `lfg` | legacy autonomous pipeline 仍包含 review/test/commit/push/PR 行为。 | 退役或 hard-hide；只保留必要迁移说明。 |
| P0-005 | `spec-design-iterator` | proactive mutating agent 缺少 parent-owned write / stop / verification contract。 | 退役，或迁入显式 opt-in workflow phase。 |
| P0-006 | `spec-figma-design-sync` | agent 同时拥有 Figma/browser capture、code mutation、verification 和 completion 判断。 | 拆成 read-only diagnosis + workflow-owned mutation，或退役 standalone agent。 |
| P0-007 | runtime drift audit | runtime parity 未验证；`--runtime` 因 trusted-checkout validation 失败。 | 修复 runtime drift audit，或输出明确 degraded runtime parity report。 |
| P0-008 | shared review closure | code/doc/app review 缺少共享最小 `review-finding.v1`。 | 引入 shared finding envelope，并允许各 workflow 保留 domain extensions。 |

## 十大必修问题

1. 删除 `test-browser` 的 public command 示例和直接修复权。
2. 删除 `test-xcode` 的 public command 示例和直接修复权。
3. 从 `using-spec-first` 移除对 `git-commit-push-pr` internal helper 的直接推荐。
4. 退役或 hard-hide `lfg`。
5. 退役或 workflow-gate `spec-design-iterator`。
6. 拆分或退役 `spec-figma-design-sync`。
7. 让 runtime drift audit 产出可用报告或明确 degraded status。
8. 定义 shared `review-finding.v1`。
9. 给核心 workflow chain 增加 compact stage contract。
10. 给 compound / session-derived knowledge 增加 fact / inference / assumption 标注。

## 二十项推荐优化

1. 将 `spec-write-tasks` 的 Task Pack Contract 提炼为 artifact 模板。
2. 给 durable Markdown artifacts 增加 `artifact-header.v1`。
3. 在高风险 plan/review/work/compound claim 上使用 `evidence-packet.v1`。
4. 统一 document-review lens 输出。
5. 给 web/slack/session/history researchers 增加 context budget。
6. 将 `spec-work-beta` 收敛为显式 opt-in 的 thin wrapper。
7. 给 `spec-optimize` 增加预算、metric fact 和 mutation gate。
8. 给 `spec-polish-beta` 增加 dirty-tree 与 dev-server lifecycle policy。
9. 给 `spec-skill-audit` 增加 report-only 或 explicit output-dir mode。
10. 在 mutating workflows 中增加本地 changelog reminder。
11. 合并或退役旧的 broad expert agents。
12. 明确 web / framework-docs / best-practices researchers 的 source authority 分工。
13. 将长 workflow 的深层可选分支移动到 references。
14. 保持 `spec-standards` preview-first，避免演化成 rules engine。
15. 保持 `using-spec-first` 只做 router，不做 workflow state。
16. 从 source 生成 capability manifest，用于 public/internal/host availability。
17. 给 reviewer agents 增加 forbidden-behavior boilerplate。
18. 要求 reviewer agents 明确自己输出 finding 还是 lens note。
19. 增加针对 section presence 和 governance conflicts 的 focused audit tests。
20. 保持 `.spec-first/` 输出为 artifact，不把它当 source truth。

## 标杆模板

| 类型 | 候选 | 原因 |
| --- | --- | --- |
| Skills | `spec-skill-audit`、`spec-graph-bootstrap`、`spec-write-tasks`、`spec-doc-review`、`spec-plan` | 阶段职责、证据处理、degraded-mode 或 durable artifact 形态较清楚。 |
| Code-review agents | `spec-adversarial-reviewer`、`spec-api-contract-reviewer`、`spec-correctness-reviewer`、`spec-performance-reviewer`、`spec-security-reviewer`、`spec-project-standards-reviewer`、`spec-testing-reviewer` | persona trigger、evidence rules、confidence anchor 和 structured output 较成熟。 |

## 最需要重写

| 类型 | 候选 | 原因 |
| --- | --- | --- |
| Skills | `test-browser`、`test-xcode`、`using-spec-first`、`lfg`、`spec-work-beta` | 前四个是 P0 边界冲突或 legacy central orchestration；beta 需要显式 opt-in 和 thin wrapper discipline。 |
| Agents | `spec-design-iterator`、`spec-figma-design-sync`、`spec-security-sentinel`、`spec-pattern-recognition-specialist`、`spec-performance-oracle` | 前两个是 P0 mutating agents；其余与更成熟的 reviewer/lens family 重叠。 |

## 退役 / 合并建议

| 动作 | 候选 |
| --- | --- |
| 退役或 hard-hide | `lfg`、作为 proactive mutator 的 `spec-design-iterator`、作为 mutating agent 的 `spec-figma-design-sync`。 |
| 改为 delegated helper | `test-browser`、`test-xcode`、部分 git/shipping helpers。 |
| 合并到 canonical reviewer | `spec-data-integrity-guardian`、`spec-data-migration-expert`、`spec-performance-oracle`、`spec-security-sentinel`。 |
| 改为 lens / manual helper | `spec-architecture-strategist`、`spec-pattern-recognition-specialist`、`spec-ankane-readme-writer`。 |

## 暂停新增 Skill / Agent

建议暂停 net-new skill / agent 扩张，除非存在现有 workflow 无法承载的明确缺失阶段。下一阶段应优先强化 contract、handoff、evidence 和 runtime drift verification，而不是继续添加 persona。

## Skill MD 标准模板

模板中的 section heading 保留英文，是为了对齐现有 `SKILL.md` 结构和 audit 脚本的 canonical section 识别；说明文字改为中文。

```markdown
# Skill Name

## Purpose
一句话说明该 workflow stage 解决什么研发问题。

## When To Use
- 明确触发条件。

## When Not To Use
- 明确非目标和不适用场景。

## Inputs
必需输入和可选输入。

## Outputs
durable outputs 和 session-scoped outputs。

## Workflow
编号执行步骤。

## Evidence Requirements
说明哪些 claim 必须引用 file、diff、test、graph、user input 或 prior decision evidence。

## Context Policy
说明 included context、excluded context、budget 和 degraded providers。

## Tool / Script Boundary
Scripts prepare deterministic facts; LLM decides semantic judgment.

## Handoff
上游来源和下游消费者。

## Safety Rules
preview-first、source-first、no silent writes、source changes require CHANGELOG。

## Failure / Degraded Mode
missing input、unavailable provider、failed tests、unsafe dispatch 等失败处理。
```

## Agent MD 标准模板

模板中的 section heading 保留英文，是为了对齐现有 agent profile 结构和后续 contract/audit 自动化；说明文字改为中文。

```markdown
# Agent Name

## Role
一句话说明专家角色。

## Expertise
说明该 agent 能判断什么。

## Trigger
说明 parent skill 什么时候选择它。

## Non-goals
说明它不能决定什么。

## Required Inputs
给出 confident finding 所需的最小上下文。

## Review Focus
列出具体审查维度。

## Evidence Rules
所有 finding 必须引用 evidence。

## Output Format
structured finding 或明确标记的 lens notes。

## Confidence Policy
high / medium / low 或 anchor thresholds。

## Escalation
哪些问题必须交回 parent skill synthesis。

## Forbidden Behaviors
不编排 workflow，不做最终 merge decision，不编造 evidence。
```

## `contract.yaml` 标准模板

```yaml
schema_version: stage-contract.v1
stage_id: spec-example
public_entrypoints:
  claude: /spec:example
  codex: $spec-example
inputs:
  required: []
  optional: []
outputs:
  required: []
artifacts:
  durable: []
  session_scoped: []
evidence_requirements: []
context_policy:
  include: []
  exclude: []
  budget: bounded
safety:
  write_policy: preview-first
  source_changes_require_changelog: true
degraded_modes: []
downstream_consumers: []
```

## `review-finding.v1` 最小字段

```json
{
  "finding_id": "F-001",
  "severity": "blocking|high|medium|low|info",
  "category": "requirements|architecture|code-quality|test|security|performance|ux|i18n|analytics|graph|changelog|documentation",
  "title": "...",
  "description": "...",
  "evidence": [
    {
      "type": "file|diff|test|graph|standard|requirement|compound",
      "path": "...",
      "anchor": "...",
      "summary": "..."
    }
  ],
  "impact": "...",
  "recommendation": "...",
  "owner": "review-fixer|downstream-resolver|human|release",
  "requires_verification": true,
  "requires_changelog": true,
  "confidence": "high|medium|low",
  "residual_status": "unresolved|applied|deferred|accepted|not_applicable"
}
```

## Evidence Packet 与 Context Bundle 接入建议

`evidence-packet.v1` 只应用在高风险或跨阶段边界：review findings、graph-heavy planning claims、compound knowledge capture、runtime drift、app-consistency issues。它的职责是区分 facts、inferences、assumptions 和 limitations；不要存 raw provider dumps。

`context-bundle.v1` 用于 subagent dispatch 和 graph-heavy workflows。它应记录 included paths、omitted paths、source freshness、trust level 和 token budget。它必须保持为 existing facts 外的一层小 envelope，不应演化成全局 context router。

## 后续自动化方向

- 扩展 `spec-skill-audit`，让它能为 agents 生成确定性事实，同时仍由 reviewer synthesis 做语义判断。
- 修复从 source checkout 执行 runtime drift audit 的能力。
- 增加 section-presence 与 governance-conflict focused tests。
- 保持 scorecards 是 signals，不是 gates。

## 不建议扩张的能力

不要新增 generic expert agents、central workflow state machine、heavy schema platform、automatic compound writes，也不要把 patch runtime mirror 当作修复策略。

## 下一阶段最小执行顺序

1. 修复 internal/public helper conflicts：`test-browser`、`test-xcode`、`using-spec-first`、`lfg`。
2. 退役或拆分 mutating agents：`spec-design-iterator`、`spec-figma-design-sync`。
3. 修复 runtime drift audit support。
4. 引入 shared `review-finding.v1`。
5. 给 core chain 增加 compact contracts。
