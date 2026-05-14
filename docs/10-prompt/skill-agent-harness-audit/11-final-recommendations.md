# Skill / Agent Harness Audit Final Recommendations v2

## 1. Decision

当前 `spec-first` 已达到 **H4 Evidence-governed Harness**，但尚未达到 **H5 Review-closed Engineering Loop**。

H5 的阻断点不是 prompt 长度、agent 数量或模板完整度，而是四类闭环仍不稳定：

1. public / internal helper 边界仍有泄漏。
2. 少数 agent 仍像 source-mutating workflow，而不是专家判断角色。
3. review closure 需要共享 finding envelope 和 adoption path。
4. runtime drift audit 尚未提供 confirmed 或明确 degraded 的 parity 证据。

下一阶段目标应是 **关闭 P0/P1 的边界、证据、handoff 和 review closure 缺口**。不建议追求 H6，也不建议继续扩张 net-new skill / agent。

## 2. Scope And Authority

本建议是 audit snapshot 的结构化收口，不是 runtime truth，也不是新的 workflow source-of-truth。

Source-of-truth：

- `skills/**/SKILL.md`
- `agents/*.agent.md`
- `docs/contracts/**`
- `src/cli/**`
- `CLAUDE.md`
- `AGENTS.md`

Generated runtime mirrors：

- `.claude/**`
- `.codex/**`
- `.agents/skills/**`

修复策略必须 source-first。runtime drift 只能通过 `spec-first init --claude|--codex` 或明确 degraded parity report 处理；不要手改 runtime mirror。

## 3. Goals

- 把 H4 evidence harness 收敛为 H5 review-closed loop。
- 修复 public / internal、agent / workflow、source / runtime 边界。
- 让 review findings 能跨 code / doc / app workflow 被消费、追踪和关闭。
- 用 light contract 提升可验证性，不引入中心化 workflow state machine。
- 保持 scripts prepare deterministic facts，LLM / agents decide semantic judgment。

## 4. Non-Goals

- 不重写所有 skill / agent。
- 不新增 generic expert agents。
- 不把 scorecard signals 升级成 gates。
- 不让 scripts 做架构、业务优先级或 review 结论。
- 不把 runtime mirror 当 source truth。
- 不建立 heavy schema platform。

## 5. Evidence Status

| Evidence | Status | Meaning |
| --- | --- | --- |
| Objective source | confirmed | `docs/10-prompt/审查skill.md` |
| Role baseline | confirmed | `docs/10-prompt/结构化项目角色契约.md` |
| Skill source scan | confirmed | 40 个 `skills/**/SKILL.md` 已覆盖 |
| Agent source scan | confirmed | 51 个 `agents/*.agent.md` 已覆盖 |
| Two-pass review | confirmed | 每个 Markdown 文件经过 contract review + boundary/overlap review |
| Deterministic skill signals | advisory | P0 0 / P1 180 / P2 102；这是 scan signal，不是 release gate |
| Semantic final risks | LLM judgment | P0 8 / P1 42 / P2 68 |
| Runtime parity | degraded | `--runtime` 因 trusted-checkout validation 失败，不能声称 clean |

质量判断：

| Area | Grade | Judgment |
| --- | --- | --- |
| Core workflow skills | B | 证据、边界和阶段职责较强，但 contract 仍偏 prose-heavy。 |
| Auxiliary / internal skills | D | 多个 helper 看起来像 public workflow 或 mutating tool。 |
| Code-review agents | A- | JSON output、confidence anchor、suppress rules 和 persona 边界较成熟。 |
| Doc / research / lens agents | C | 专业价值明确，但 output shape、context budget 和 evidence anchor 不够一致。 |
| Runtime governance | B- | source / runtime 边界表达清楚，但本轮 runtime drift 未得到确定性验证。 |

## 6. P0 Landing Plan

先关闭 P0，不要先做平台化扩展。

| Order | Item | Source Action | Acceptance |
| ---: | --- | --- | --- |
| 1 | `test-browser` | 改成 delegated browser evidence-only helper。 | 无 public command 示例；无 direct fix path；输出 evidence summary。 |
| 2 | `test-xcode` | 改成 delegated simulator evidence helper。 | parent workflow owns fix decision；helper 不直接修复。 |
| 3 | `using-spec-first` | 移除 internal helper 用户入口推荐。 | route map 不推荐 hidden helper；PR description 通过 public workflow / shipping handoff 进入。 |
| 4 | `lfg` | retire 或 hard-hide legacy autonomous pipeline。 | 不再作为 public / recommended path；不保留默认 commit / push / PR 链路。 |
| 5 | `spec-design-iterator` | retire，或迁入 explicit opt-in workflow phase。 | agent 不拥有 source mutation、stop condition 或 completion judgment。 |
| 6 | `spec-figma-design-sync` | split 为 read-only diagnosis + workflow-owned mutation，或 retire standalone agent。 | code edits 由 parent workflow 拥有；diagnosis 输出 evidence 和 confidence。 |
| 7 | Runtime drift audit | 修复 `--runtime`，或输出 reason-coded degraded parity report。 | 能得到 confirmed clean 或 explicit degraded status；不能 silent fail。 |
| 8 | Review closure | adopt `review-finding.v1` 到 code / doc / app review。 | shared fields 可被 synthesis 消费，domain extensions 保留。 |

Current-source note：如果当前分支已经新增 `docs/contracts/workflows/review-finding.md`，P0-008 的剩余工作应从“定义 contract”收窄为“完成 workflow adoption 和 focused tests”。

## 7. P1 Contract Work

P1 的目标是补齐最小可维护合同，不是建立新的规则平台。

| Priority | Contract Work | Boundary |
| --- | --- | --- |
| P1-001 | Core stage compact contracts | 给 `spec-brainstorm`、`spec-plan`、`spec-write-tasks`、`spec-work`、`spec-code-review`、`spec-doc-review`、`spec-compound` 顶部增加 Inputs / Outputs / Artifacts / Handoff / Degraded Mode。 |
| P1-002 | `artifact-header.v1` | 用于 durable Markdown artifacts 的 type、source、trust、consumer；不做全局 artifact registry。 |
| P1-003 | `evidence-packet.v1` | 只用于高风险 claims，区分 facts / inferences / assumptions / limitations；不存 raw provider dumps。 |
| P1-004 | `context-bundle.v1` | 用于 reviewer / worker / researcher 的 summary-first handoff；不做中心化 context router。 |
| P1-005 | Researcher budget policy | 限制 web / slack / session / history researcher 的 query、source count、freshness 和 context budget。 |
| P1-006 | Thin beta wrapper | `spec-work-beta` 保持 explicit opt-in，只描述相对 `spec-work` 的 delegation delta。 |
| P1-007 | Optimize execution boundary | `spec-optimize` 明确 metric facts、budget gates、mutation policy；scripts own metrics，LLM judges experiment quality。 |
| P1-008 | Mutating helper risk policy | commit / PR / feedback / shipping helpers 统一 preview、staged files、tests、changelog 和 authorization 输出。 |
| P1-009 | Duplicate expert consolidation | retire、manual-only 或合并旧 broad expert agents；默认 dispatch 使用 canonical reviewer / lens family。 |

## 8. Template Direction

保留模板方向，但不要把模板变成强制性重写运动。

### Skill MD Minimum

`SKILL.md` 顶部应能在 30 秒内回答：

- Purpose：这个 stage 解决什么研发问题。
- When To Use / When Not To Use：入口和非目标。
- Inputs / Outputs / Artifacts：必需输入、输出和 durable/session-scoped evidence。
- Workflow：主路径步骤，不隐藏关键 gate。
- Evidence Requirements：哪些 claim 必须引用 file / diff / test / graph / user input / prior decision。
- Context Policy：included / excluded context、budget 和 degraded providers。
- Tool / Script Boundary：Scripts prepare deterministic facts; LLM decides semantic judgment。
- Handoff：上游来源和下游消费者。
- Failure / Degraded Mode：missing input、unavailable provider、failed tests、unsafe dispatch 等处理。

### Agent MD Minimum

`*.agent.md` 应能说明：

- Role / Expertise：它能判断什么。
- Trigger：parent workflow 何时选择它。
- Non-goals：它不能决定什么。
- Required Inputs：给出 confident finding 所需的最小上下文。
- Evidence Rules：finding 必须引用证据。
- Output Format：structured finding 或明确标记的 lens notes。
- Confidence Policy：high / medium / low anchor。
- Escalation：交回 parent synthesis 的条件。
- Forbidden Behaviors：不编排 workflow，不做最终 merge decision，不编造 evidence，不私自拥有 source mutation。

## 9. Best Current Templates

这些资产可作为后续收敛时的参考，不表示要机械复制。

| Kind | Template Candidates | Why |
| --- | --- | --- |
| Skills | `spec-skill-audit`、`spec-graph-bootstrap`、`spec-write-tasks`、`spec-doc-review`、`spec-plan` | 阶段职责、证据处理、degraded mode 或 durable artifact 形态较清楚。 |
| Code-review agents | `spec-adversarial-reviewer`、`spec-api-contract-reviewer`、`spec-correctness-reviewer`、`spec-performance-reviewer`、`spec-security-reviewer`、`spec-project-standards-reviewer`、`spec-testing-reviewer` | persona trigger、evidence rules、confidence anchor 和 structured output 较成熟。 |

## 10. Defer

暂缓以下方向：

- H6 自动治理平台。
- central workflow state machine。
- generic expert agent 扩张。
- automatic compound writes。
- provider-internal contract coupling。
- heavy schema platform。
- runtime mirror patch 作为修复策略。

这些能力只有在现有 H5 closure 稳定、并且证明能提升 LLM 输入质量、证据链或用户研发效率时，才应重新讨论。

## 11. Minimal Execution Order

1. 修复 public / internal P0：`test-browser`、`test-xcode`、`using-spec-first`、`lfg`。
2. 处理 mutating agent P0：`spec-design-iterator`、`spec-figma-design-sync`。
3. 修复 runtime drift audit 的 confirmed / degraded 输出。
4. 完成 `review-finding.v1` adoption，而不只是新增文档。
5. 给核心 workflow chain 增加 compact stage contract。
6. 再处理 lens / research / compound 的 P1/P2 收敛。

## 12. Validation Plan

每个 source change 都需要：

- focused source read：确认修改的是 source-of-truth，不是 generated mirror。
- focused contract test 或 audit scan：覆盖对应 boundary。
- `CHANGELOG.md`：所有 source / docs 变更按仓库规则记录。
- runtime impact note：说明是否需要 `spec-first init --claude|--codex`。

Runtime parity 只能在 deterministic command 成功或 degraded report 明确时声明。scorecards 是 signals，不是 gates；最终风险排序仍由 reviewer synthesis 负责。
