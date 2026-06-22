---
spec_id: 2026-06-23-003-spec-work-coding-quality
artifact_kind: prd-requirements
target_surface: cli-devtool
status: draft
evidence_grade: mixed
created: 2026-06-23
source_material: user request to optimize spec-work skill and improve coding quality
related_prd: docs/brainstorms/2026-06-23-002-refactor-spec-work-minimality-requirements.md
---

# refactor: spec-work 编码质量增强需求

## Summary

`spec-work` 需要在保持执行 workflow 身份、source/runtime 边界和现有 structured verification closeout 的前提下，新增一组明确的编码质量行为要求。目标是让 `$spec-work` 在执行代码变更时更稳定地产出可维护、可测试、符合现有模式、可审查且不丢失保护性行为的代码；不是新增独立代码质量 workflow、全仓审计器、静态评分器或硬编码语义裁判。

## Problem Frame

用户提出“优化 work skill，增强 skill 的编码质量”。当前 `spec-work` 已具备任务包边界、反馈回路、测试发现、系统链路检查、review 和 structured closeout，但编码质量要求分散在执行步骤中，缺少一个可被 plan 消费的产品级增量：如何在执行前识别质量风险，如何把现有模式、测试、异常链路、review_focus 和 closeout 证据连接成稳定质量闭环，以及如何与已存在的 minimality PRD 协同，避免“少写代码”变成“少保护、少验证、少证据”。

## Current System Snapshot

| claim | tag | source / owner | note |
| --- | --- | --- | --- |
| `spec-work` 当前定位为执行 validated task pack、settled plan、spec path 或 concrete implementation request 的 workflow。 | confirmed-source | `skills/spec-work/SKILL.md` | Workflow Contract Summary 明确 When To Use、Outputs、Failure Modes 和 Workflow。 |
| `spec-work` 在 WHAT/HOW 未解决、repo scope 不明确、task pack stale 或需要手改 generated runtime mirrors 时应停止或交还上游。 | confirmed-source | `skills/spec-work/SKILL.md` | 编码质量增强不能绕过这些入口边界。 |
| `spec-work` 已要求在改行为前建立或尝试最小 feedback loop，落地后复跑同一 loop 或记录原因。 | confirmed-source | `skills/spec-work/SKILL.md` | 当前机制覆盖反馈回路，但未把它显式写成 coding quality intent。 |
| `spec-work` 已有 Test Discovery、Test Scenario Completeness、System-Wide Test Check，覆盖测试定位、happy/edge/error/integration 场景、真实链路、orphaned state 和错误策略。 | confirmed-source | `skills/spec-work/SKILL.md` | 这些是编码质量增强的现有质量底线。 |
| `spec-work` 已要求 Follow Existing Patterns，读取 nearby source/tests、confirmed team standards 和 scope-matched standards。 | confirmed-source | `skills/spec-work/SKILL.md`, `docs/contracts/team-standards.md` | 质量增强应复用这个 source-first pattern 入口，不另造规范系统。 |
| `spec-work` task pack 已可携带 `review_gate` 和 `review_focus`，并要求 required gate 使用 diff-scoped report-only review 或显式 handoff。 | confirmed-source | `skills/spec-work/SKILL.md`, `tests/unit/spec-work-contracts.test.js` | 编码质量增强可以把质量风险映射到 review_focus，但不能把 review_focus 当 scope authority。 |
| Shipping workflow 要求每个变更经过真实 review，且无 host-native review 时回退到 `spec-code-review`。 | confirmed-source | `skills/spec-work/references/shipping-workflow.md` | 质量增强应保留 review 必经原则。 |
| Structured verification closeout 通过 `verification-run-summary.v1` 和 `honest-closeout.v1` 记录真实检查结果；自然语言 “tests passed” 不能作为 verified evidence。 | confirmed-source | `skills/spec-work/references/shipping-workflow.md`, `docs/contracts/verification/verification-run-summary.md` | 编码质量 closeout 必须使用同一证据边界。 |
| `skills/spec-work/evals/examples.json` 是 examples-as-context，不是 execution state machine、runtime gate 或语义质量证明。 | confirmed-source | `skills/spec-work/SKILL.md`, `docs/contracts/workflows/eval-fixture-contract.md` | 质量 fixtures 只能做 advisory coverage。 |
| 现有 minimality PRD 已定义实现前 minimality decision、protected code、minimality review/debt/gain 和默认不全仓 audit 的边界。 | confirmed-source | `docs/brainstorms/2026-06-23-002-refactor-spec-work-minimality-requirements.md` | 本 PRD 是后续编码质量增量，不重复 minimality 主题。 |
| 当前 `skills/spec-work/**` 没有第一层级的 `Code Quality Profile` 或 `coding quality` section。 | confirmed-source | `rg -n "Code Quality|coding quality|quality profile" skills/spec-work/SKILL.md skills/spec-work/references` | 说明质量要求存在但未形成显式质量画像。 |

## Change Delta

| item | current | target | delta | evidence |
| --- | --- | --- | --- | --- |
| workflow identity | `spec-work` 执行明确 work，强调 scoped source changes、tests 和 verification notes。 | 保持执行 workflow 身份，不新增 public `$spec-code-quality` 或全仓审计入口。 | keep | `skills/spec-work/SKILL.md` |
| quality intent | 质量要求散布在 feedback loop、Test Discovery、System-Wide Test Check、review 和 closeout。 | 增加显式 coding quality intent：每个行为性 slice 要知道本次需要保护的质量风险、现有模式、测试/检查和 review focus。 | extend | `skills/spec-work/SKILL.md` |
| local pattern use | 已要求 Follow Existing Patterns 和 source-first standards。 | 将 pattern reuse 写成编码质量要求：先确认 nearby source/tests/contracts/team standards，再选择实现风格。 | extend | `skills/spec-work/SKILL.md`, `docs/contracts/team-standards.md` |
| test quality | 当前要求发现并更新测试，补 happy/edge/error/integration 场景。 | 明确质量增强不得只追求“有测试”，还要覆盖风险匹配的场景、真实链路或可解释 not-run/not-added 原因。 | extend | `skills/spec-work/SKILL.md` |
| review focus | task pack 可携带 `review_gate` / `review_focus`。 | 编码质量风险需要进入 review_focus 或 closeout summary，使 review 能看到可维护性、测试、异常链路和保护性行为风险。 | extend | `skills/spec-work/SKILL.md`, `skills/spec-work/references/shipping-workflow.md` |
| closeout evidence | structured verification 和 run artifact 已存在。 | 编码质量证据默认进入 final/work summary、verification summary、review status 和现有 run artifact generic 字段；不默认新增 typed schema。 | extend | `skills/spec-work/references/shipping-workflow.md`, `docs/contracts/workflows/spec-work-run-artifact.schema.json` |
| minimality interaction | minimality PRD 已要求减少不必要依赖/抽象/文件，同时保护安全、数据、可访问性、可观测性和验证。 | 编码质量增强必须与 minimality 协同：更少代码不能降低测试、异常处理、可读性、复用边界或 review 证据。 | keep / extend | `docs/brainstorms/2026-06-23-002-refactor-spec-work-minimality-requirements.md` |
| generated runtime mirrors | generated mirrors 不作为 source。 | 编码质量增强仍只修改 source-of-truth；runtime refresh 是后续生成步骤。 | keep | `docs/10-prompt/结构化项目角色契约.md`, `skills/spec-work/SKILL.md` |

## Goals / Success Metrics

| goal | observable signal | baseline / target posture | evidence |
| --- | --- | --- | --- |
| 提升 `spec-work` 代码变更的可维护性 | work closeout 或 review handoff 中可看到质量风险、模式依据、测试/检查覆盖和 residual status。 | 无可信数值 baseline；本轮要求有可审查口径，不制造质量分数。 | user-stated + confirmed-source |
| 降低行为性改动缺少匹配测试或异常链路检查的概率 | 行为性 slice 若未新增/更新测试，必须有具体 reason_code 或 review handoff；System-Wide Test Check 的适用/跳过原因可见。 | 质量底线不得低于当前 `spec-work`。 | `skills/spec-work/SKILL.md` |
| 让 review 更容易发现代码质量回归 | `review_focus` 或 review handoff 能指向可维护性、测试覆盖、真实链路、protected behavior、source/runtime 和 minimality-gain 风险。 | 不要求每次都跑 full review；仍按 shipping workflow 的 review tier 规则。 | `skills/spec-work/SKILL.md`, `skills/spec-work/references/shipping-workflow.md` |
| 保持 prompt 负担可控 | 质量规则进入 hot path 的内容保持短、可执行；细节进入 reference 或 eval examples。 | 不把 `SKILL.md` 变成大型代码审查手册。 | `docs/contracts/workflows/skill-agent-quality-governance.md` |

## Change Topology

Primary topology: workflow-change

Secondary topology: contract-change, evaluation-fixture extension, source-of-truth boundary

Why this topology matters: 本次改变的是 `spec-work` 执行行为和质量证据闭环，不是单个项目代码修复。若 planning 不明确 workflow 身份、现有质量机制、review consumer、run artifact 证据边界、minimality 交互和 generated runtime 非 source 边界，后续实现容易滑向四种反模式：新增独立 public workflow、把 eval fixture 当语义质量证明、把 review_focus 当 scope authority、或为质量证据过早扩展 typed run artifact schema。

## Surface Map

| surface | current behavior | owner/source | artifact/contract | consumer | delta | evidence |
| --- | --- | --- | --- | --- | --- | --- |
| public workflow entry | `$spec-work` / `/spec:work` 执行明确 work。 | `skills/spec-work/SKILL.md` | workflow skill source | Claude/Codex users | keep | confirmed-source |
| Phase 0/1 intake | 判断输入、repo scope、task pack、environment 和 task list。 | `skills/spec-work/SKILL.md` | skill prose | work orchestrator | extend with coding-quality intent detection | confirmed-source |
| Phase 2 execution | 读取 source、实现、测试、系统链路检查、follow patterns。 | `skills/spec-work/SKILL.md` | skill prose | work executor | extend with explicit quality-risk posture per behavior slice | confirmed-source |
| Phase 3/4 shipping | review、final validation、structured verification、run artifact trigger、completion response。 | `skills/spec-work/references/shipping-workflow.md` | shipping reference | users, review, PR | extend with quality evidence in summary/review handoff | confirmed-source |
| task-pack metadata | `review_gate` / `review_focus` 是 review intent metadata。 | `skills/spec-work/SKILL.md`, tests | task-pack contract consumer behavior | `spec-work`, `spec-code-review` | extend with coding-quality focus when source plan/task exposes risk | confirmed-source |
| run artifact | `spec-work-run-artifact/v2` 是 generated run evidence, not source authority。 | `docs/contracts/workflows/spec-work-run-artifact.schema.json` | run JSON | resume/handoff/review | default use generic fields; no required typed quality schema | confirmed-source + assumption |
| eval/examples | examples-as-context, advisory only。 | `skills/spec-work/evals/examples.json` | fixture source | maintainers, fresh-source eval context | add coding-quality examples without claiming semantic proof | confirmed-source |
| generated runtime mirrors | `.claude/**`, `.codex/**`, `.agents/skills/**` 非 source。 | role contract, `skills/spec-work/SKILL.md` | generated mirror | host runtime | keep source-first | confirmed-source |

## Producer / Artifact / Consumer

| producer | artifact/schema/path | freshness/authority | consumers | change effect | evidence |
| --- | --- | --- | --- | --- | --- |
| `spec-work` maintainer | `skills/spec-work/SKILL.md` | source-of-truth | runtime projection, workflow users, tests | Adds compact coding-quality behavior anchors to hot path. | confirmed-source |
| `spec-work` maintainer | `skills/spec-work/references/*.md` | source support files | `spec-work`, tests, runtime projection | May hold detailed quality review/check guidance if hot path stays compact. | confirmed-source |
| `spec-work` closeout | final/work summary | per-run human evidence | user, reviewer, future handoff | Names quality risks, checks run/not-run, test posture, review residuals. | confirmed-source + assumption |
| verification helper | `verification-run-summary.v1` | structured per-check result | `honest-closeout`, final response, run artifact payload | Records actual quality-related commands/checks as passed/failed/not-run/degraded. | confirmed-source |
| internal CLI producer | `spec-work-run-artifact/v2` | generated run evidence | resume/handoff/review | Carries compact quality evidence via existing generic fields when durable trigger applies. | confirmed-source + assumption |
| `spec-code-review` | review report / residual artifact | review evidence | `spec-work`, human reviewers | Consumes coding-quality review focus when risk warrants. | confirmed-source |
| eval maintainer | `skills/spec-work/evals/examples.json` | source advisory examples | tests, fresh-source eval context | Adds drift examples for coding-quality posture without semantic proof claims. | confirmed-source |

## Source-Of-Truth Resolution

| item | current source-of-truth | target source-of-truth | generated mirrors / non-authoritative refs | conflict rule |
| --- | --- | --- | --- | --- |
| `spec-work` workflow behavior | `skills/spec-work/SKILL.md` plus required references | same | `.claude/**`, `.codex/**`, `.agents/skills/**` | Source wins; regenerate runtime when needed, never patch mirrors as source fixes. |
| coding quality behavior | scattered current clauses in `skills/spec-work/SKILL.md` | `skills/spec-work/SKILL.md` hot-path anchors plus optional source reference | this PRD is planning source, not final implementation | PRD settles WHAT; future plan chooses exact file split and wording. |
| quality verification evidence | `verification-run-summary.v1`, `honest-closeout.v1`, review status, final response | same | natural-language-only claims are degraded | Scripts record facts; LLM judges sufficiency and residual risk. |
| run artifact quality evidence | `spec-work-run-artifact/v2` generic fields and closeout payload | same by default | `.spec-first/workflows/**` is run evidence, not scope authority | Typed schema extension requires a consumer-backed plan decision. |
| quality fixtures | `skills/spec-work/evals/examples.json` | same or focused source fixture under `skills/spec-work/evals/` | fixture coverage is not semantic quality proof | Fresh-source eval or human review owns semantic judgment. |

## Glossary

| term | definition | source_tag | note |
| --- | --- | --- | --- |
| coding-quality intent | `spec-work` 对当前 behavior slice 需要保护的代码质量结果的简短识别，包括可维护性、测试、异常链路、复用边界、review 关注点和验证证据。 | session-local | PRD-local term; no project glossary promotion. |
| quality-risk posture | 当前改动因共享行为、状态、异常、并发、权限、安全、可访问性、public contract、dependency、runtime projection 或 skill prose 触发的质量风险级别和检查方向。 | session-local | 用于 guiding work/review，不是打分 schema。 |
| protected quality signal | 不应因 minimality、速度或局部实现而丢失的质量信号，例如行为覆盖测试、真实链路验证、错误处理、source/runtime 边界和 review residual visibility。 | session-local | 与 minimality PRD 的 protected code categories 协同。 |

## Actors

| actor | role in this increment | requirement relevance |
| --- | --- | --- |
| Workflow maintainer | 修改 `spec-work` source、references、tests、eval fixtures 和 changelog。 | 需要明确 source/runtime、fixture 和 closeout contract 边界。 |
| Work executor agent | 使用 `spec-work` 执行 plan/task/user request。 | 需要在编码前识别质量风险并选择匹配的测试、pattern 和 review focus。 |
| Planning author | 将本 PRD 转成 implementation plan。 | 不应发明是否需要新 workflow、scorecard 或 schema extension。 |
| `spec-code-review` / reviewer | 评审实现质量和 residual 风险。 | 需要从 work handoff 获取质量风险、测试姿态和 protected signal。 |
| Human user / maintainer | 阅读 final response、PR、run artifact 或 changelog。 | 需要知道代码质量如何被验证、哪些检查未跑、是否仍有残余风险。 |

## Requirements

| id | priority | requirement | rationale/source |
| --- | --- | --- | --- |
| R-01 | P0 | `spec-work` must preserve its execution workflow identity and must not become a separate public code-quality workflow, whole-repo audit engine, code-style linter, or semantic quality scorecard. | confirmed-source: `skills/spec-work/SKILL.md`; AE-01 |
| R-02 | P0 | 对每个 behavior-bearing slice，`spec-work` 必须在行为性编辑开始前识别 compact coding-quality intent：质量风险、应遵循的既有模式、要运行或说明 not-run 的测试/检查，以及相关 review focus；实现过程中发现新证据时可以更新该 intent，完成前必须保留最终状态。 | user-stated; confirmed-source: feedback loop and testing clauses in `skills/spec-work/SKILL.md`; AE-02 |
| R-03 | P0 | Coding-quality intent must be source-first: nearby implementation files, nearby tests, plan/task refs, confirmed team standards, relevant contracts, and direct source evidence guide the quality baseline before new conventions are introduced. | confirmed-source: `skills/spec-work/SKILL.md`, `docs/contracts/team-standards.md`; AE-03 |
| R-04 | P0 | The workflow must keep scope authority unchanged: quality improvements can only modify files and behavior required by the current plan/task/user request, failed check, or accepted review fix. | confirmed-source: `skills/spec-work/SKILL.md`; AE-04 |
| R-05 | P0 | Test quality must match the risk of the slice: happy path, edge case, error/failure path, integration/real-chain coverage, characterization test, or explicit not-applicable reason must be visible where relevant. | confirmed-source: Test Discovery and Test Scenario Completeness in `skills/spec-work/SKILL.md`; AE-05 |
| R-06 | P0 | System-Wide Test Check must remain active for callbacks, middleware, persistence, retry/fallback, parallel interfaces, and error strategies; skip reasons must be concrete when the check is not applicable. | confirmed-source: `skills/spec-work/SKILL.md`; AE-06 |
| R-07 | P0 | Maintainability requirements must be explicit enough for planning: follow existing naming/style/module boundaries, avoid speculative abstraction, avoid broad opportunistic refactor, and record unrelated cleanup as follow-up. | confirmed-source: `skills/spec-work/SKILL.md`; AE-07 |
| R-08 | P0 | Coding-quality enhancement must be compatible with the minimality PRD: fewer lines, fewer files, or fewer dependencies cannot remove protected quality signals such as tests, error handling, accessibility, observability, source trace, or review evidence. | confirmed-source: related PRD `2026-06-23-002`; AE-08 |
| R-09 | P1 | When plan/task metadata provides `review_gate` or `review_focus`, `spec-work` must preserve it as review intent and may enrich the handoff with coding-quality focus without treating it as scope authority or approval state. | confirmed-source: `skills/spec-work/SKILL.md`, tests; AE-09 |
| R-10 | P1 | When source discovery reveals quality risk not named by the plan, `spec-work` must either address it only if it is necessary for the current slice, record it as follow-up, or hand off for plan/review rather than silently expanding scope. | confirmed-source: non-expansion clauses in `skills/spec-work/SKILL.md`; AE-10 |
| R-11 | P1 | Final/work summary must include compact coding-quality evidence when behavior changed: tests/checks run or not-run with reasons, test files added/updated/removed or justified absent, review tier, residual status, and material protected-quality decisions. | confirmed-source: shipping workflow completion response and structured verification; AE-11 |
| R-12 | P1 | Durable evidence must use existing closeout and run-artifact boundaries by default; this PRD does not require a new typed `coding_quality` schema field unless a future consumer explicitly needs machine-queryable fields. | confirmed-source: `spec-work-run-artifact/v2`; AE-12 |
| R-13 | P1 | Eval/example coverage should add coding-quality drift cases for source-first patterns, test adequacy, protected-quality retention, review_focus preservation, and fixture-as-advisory boundaries. | confirmed-source: examples-as-context and eval fixture contract; AE-13 |
| R-14 | P0 | When implementation changes skill/workflow prose behavior, closeout must include fresh-source eval status or `not_run` reason; current-session invocation of the same skill is not a valid semantic proof. | confirmed-source: `docs/contracts/workflows/fresh-source-eval-checklist.md`; AE-14 |
| R-15 | P0 | Coding-quality rules must preserve `Scripts prepare, LLM decides`: scripts/tests may check required strings, paths, fixtures and structured facts, but must not claim to judge semantic code quality. | confirmed-source: role contract and eval fixture contract; AE-15 |
| R-16 | P0 | Implementation must modify source-of-truth files only and must not hand-edit generated runtime mirrors as the way to deliver coding-quality behavior. | confirmed-source: role contract, `skills/spec-work/SKILL.md`; AE-16 |
| NFR-01 | P1 | Hot-path prose should stay compact and progressive-disclosure friendly; detailed quality examples should live in references or eval fixtures when they would bloat `SKILL.md`. | confirmed-source: skill-agent quality governance; AE-17 |
| NFR-02 | P0 | Changelog, focused contract tests, and generated runtime mirror status must be visible in implementation closeout because this changes workflow prose behavior. | project instruction; AE-17 |
| NFR-03 | P1 | Quality evidence must distinguish confirmed source/test/log facts from assumptions, advisory fixtures, source-candidates, and LLM-owned readiness judgment. | confirmed-source: role contract, PRD evidence rules; AE-15 |

## Acceptance Examples

AE-01（对应 R-01）
Given `$spec-work` receives a settled implementation request
When coding-quality enhancement is active
Then it continues as the work execution workflow and does not route into a new public quality workflow, whole-repo audit, linter, or scorecard.

AE-02（对应 R-02）
Given a behavior-bearing task changes state handling
When the executor starts the slice
Then 在行为性编辑开始前，它记录或携带 compact quality intent，命名 state risk、existing patterns、tests/checks 和 review focus，并在完成前保持最终状态可见。

AE-03（对应 R-03）
Given nearby source and tests already show the project pattern
When implementing the change
Then `spec-work` follows that pattern unless a source-backed reason justifies divergence.

AE-04（对应 R-04）
Given source discovery finds unrelated cleanup opportunities
When the current task does not require them
Then `spec-work` records follow-up or review context rather than modifying unrelated files.

AE-05（对应 R-05）
Given the plan's test scenario says only “validates correctly”
When the slice has boundary and failure behavior
Then `spec-work` expands the test intent to concrete happy, edge, failure, or integration scenarios before using it as done evidence.

AE-06（对应 R-06）
Given a change touches callback, middleware, persistence, retry/fallback, parallel interface, or error strategy behavior
When marking the task done
Then System-Wide Test Check is applied, or a concrete not-applicable reason is visible.

AE-07（对应 R-07）
Given a new helper could be generalized for future work
When the current task has only one local need
Then the default is local, readable, pattern-compatible code unless the abstraction protects a current quality boundary.

AE-08（对应 R-08）
Given the minimal implementation removes error handling or test coverage
When comparing implementation paths
Then `spec-work` rejects or flags that path as quality-gain-needed rather than treating fewer lines as success.

AE-09（对应 R-09）
Given a task card carries `review_gate: required` and `review_focus: error handling`
When the task is verified
Then the review handoff preserves the focus, includes actual changed files and source plan context, and does not treat the metadata as approval.

AE-10（对应 R-10）
Given a source read reveals a broader module consistency problem
When the current slice only needs one behavior fix
Then `spec-work` fixes the required slice or stops for plan/review handoff; it does not silently widen implementation scope.

AE-11（对应 R-11）
Given behavior-bearing code changed
When final response is written
Then verification status, tests added/updated or absence reason, review tier/residual status, and any protected-quality decisions are visible.

AE-12（对应 R-12）
Given durable run evidence is triggered
When coding-quality evidence is recorded
Then it uses final/work summary, verification summary, review evidence, or existing run artifact generic fields, and no new typed schema is required by default.

AE-13（对应 R-13）
Given eval examples are added for coding quality
When tests or fresh-source eval consume them
Then the examples are labeled advisory examples-as-context and do not claim semantic quality proof.

AE-14（对应 R-14）
Given `skills/spec-work/SKILL.md` or its references change workflow prose
When closeout is prepared
Then fresh-source eval status is `passed`, `concerns`, or `not_run` with reason; current-session self-invocation is not reported as proof.

AE-15（对应 R-15, NFR-03）
Given a deterministic test checks coding-quality source text
When it passes
Then the closeout describes it as contract/structure coverage, not as proof that future code quality is semantically good.

AE-16（对应 R-16）
Given generated runtime mirrors exist
When delivering this behavior
Then source files under `skills/`, `docs/contracts/`, tests, or generator source are changed first; generated mirrors are regenerated or reported out of date rather than hand-edited.

AE-17（对应 NFR-01, NFR-02）
Given coding-quality guidance grows beyond a compact hot-path anchor
When implementing the PRD
Then detailed rules move to a source reference or eval fixture, focused contract tests and changelog are updated, and generated runtime status is reported.

## Negative Acceptance

NA-01
Given the user asks to improve coding quality
When implementing this PRD
Then the workflow must not create a new public `$spec-code-quality` entrypoint or expose an internal helper as a user-facing workflow.

NA-02
Given a deterministic fixture or Jest test passes
When reporting quality confidence
Then the result must not be described as semantic proof that all future `spec-work` code output is high quality.

NA-03
Given a shorter or simpler implementation exists
When it drops required tests, real-chain checks, error handling, accessibility, observability, source trace, or review evidence
Then it must not be accepted as a coding-quality improvement.

NA-04
Given unrelated code smells are discovered near the target files
When they are outside current plan/task/user scope
Then they must not be silently included in the implementation diff.

NA-05
Given coding-quality evidence is useful
When no typed downstream consumer needs it
Then the implementation must not invent a new run artifact schema family or required scorecard.

NA-06
Given generated runtime mirrors contain stale `spec-work` copies
When source and runtime diverge
Then `.claude/**`, `.codex/**`, and `.agents/skills/**` must not become the source-of-truth.

## Scope Boundaries

### In Scope

- `spec-work` workflow behavior for coding-quality intent, source-first pattern selection, test adequacy, system-wide checks, review focus, and closeout evidence.
- Coordination with the existing minimality PRD so smaller implementation does not drop protected quality signals.
- Focused source contract tests and advisory eval examples that prevent quality prompt drift.
- Fresh-source eval status or not-run reason for workflow prose changes.
- Source/runtime boundary and changelog expectations.

### Out Of Scope

- Implementing this PRD during the PRD workflow.
- Creating a new public code-quality workflow, static analysis engine, CI scorecard, universal quality schema, or all-repo audit default.
- Replacing `spec-code-review`, `verification-run-summary.v1`, `honest-closeout.v1`, or `spec-work-run-artifact/v2`.
- Changing business requirements, task-pack scope authority, or plan acceptance criteria under the banner of coding quality.
- Hand-editing generated runtime mirrors to deliver behavior.

## Evidence And Assumptions

| claim | tag | source / owner | note |
| --- | --- | --- | --- |
| “编码质量” is interpreted as the quality of code changes produced by `spec-work`, not the packaging quality of the skill file itself only. | assumption | user request + current target surface | This is the narrowest interpretation that serves the execution workflow. |
| Coding-quality enhancement should remain inside `spec-work`, not become a new public workflow. | assumption | role contract + current workflow identity | New public entry would duplicate existing work/review chain. |
| Existing `spec-work` quality clauses are strong but scattered. | confirmed-source | `skills/spec-work/SKILL.md`, `skills/spec-work/references/shipping-workflow.md` | This PRD consolidates product behavior for planning. |
| Run artifact schema extension is not required by default. | assumption + confirmed-source | `docs/contracts/workflows/spec-work-run-artifact.schema.json` | Existing generic fields and final/work summary can carry human-readable quality evidence unless a typed consumer appears. |
| Eval examples can cover drift scenarios but cannot prove semantic coding quality. | confirmed-source | `skills/spec-work/SKILL.md`, `docs/contracts/workflows/eval-fixture-contract.md` | Fresh-source eval or human review owns semantic judgment. |
| Project glossary exists but has no active entries. | confirmed-source | `docs/contracts/domain-glossary.md` | PRD-local glossary terms are not promoted. |

## Planning Recheck

| item | why recheck | required before | blocks planning? |
| --- | --- | --- | --- |
| `skills/spec-work/SKILL.md` current source | Current worktree is dirty; implementation plan should select edit points from latest source. | Writing implementation units | yes |
| `skills/spec-work/references/shipping-workflow.md` | Closeout and review behavior live in the reference, not only in `SKILL.md`. | Planning closeout/review changes | yes |
| `tests/unit/spec-work-contracts.test.js` | Existing tests define source contract anchors and should guide focused regression coverage. | Planning test changes | yes |
| `docs/contracts/workflows/spec-work-run-artifact.schema.json` | Recheck only if planning proposes typed artifact fields; default path avoids schema extension. | Any schema-extension unit | yes for schema-extension units; no for summary-only units |
| `skills/spec-work/evals/examples.json` | Coding-quality examples must preserve examples-as-context and source authority boundaries. | Planning eval fixture changes | yes |
| `docs/brainstorms/2026-06-23-002-refactor-spec-work-minimality-requirements.md` | Coding quality and minimality must not conflict. | Planning protected-quality or minimality-related wording | yes |

## Decision Notes

| question | recommended_answer | source_tag | chosen_answer | consequence | deferred_reason |
| --- | --- | --- | --- | --- | --- |
| Should coding-quality enhancement be a new public workflow? | No; keep it inside `spec-work`. | assumption + role contract | accepted assumption | Preserves the core Codebase -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge chain. | none |
| Should this PRD require a new typed `coding_quality` field in `spec-work-run-artifact/v2`? | No by default; use existing closeout and generic run artifact fields unless a typed consumer appears. | confirmed-source + assumption | accepted assumption | Avoids schema churn before consumer need is proven. | none |
| Should deterministic tests judge semantic coding quality? | No; they should check structure, source anchors, fixture boundaries, and known dangerous regressions only. | confirmed-source | accepted | Keeps Scripts prepare, LLM decides. | none |
| Should coding quality override minimality? | No; the two must compose. Minimality rejects unnecessary code; coding quality preserves necessary protection and evidence. | related PRD + assumption | accepted | Prevents both over-engineering and unsafe over-compression. | none |

## Feature Slices

| feature id | title | requirement refs | acceptance refs | source / evidence | notes |
| --- | --- | --- | --- | --- | --- |
| FS-01 | 编码质量意图识别 | R-01, R-02, R-03, R-04 | AE-01, AE-02, AE-03, AE-04 | `skills/spec-work/SKILL.md` | P0，先稳定 work hot path 的质量判断入口。 |
| FS-02 | 测试与真实链路质量覆盖 | R-05, R-06, R-07 | AE-05, AE-06, AE-07 | `skills/spec-work/SKILL.md` | P0，聚焦 test adequacy、system-wide check 和 maintainability。 |
| FS-03 | minimality 与 protected quality 协同 | R-08 | AE-08 | related PRD `2026-06-23-002` | P0，防止少写代码降低质量。 |
| FS-04 | review 与 closeout 证据 | R-09, R-10, R-11, R-12 | AE-09, AE-10, AE-11, AE-12 | `skills/spec-work/references/shipping-workflow.md` | P1，进入现有 review/verification/run evidence 边界。 |
| FS-05 | eval、fresh-source、source/runtime 治理 | R-13, R-14, R-15, R-16, NFR-01, NFR-02, NFR-03 | AE-13, AE-14, AE-15, AE-16, AE-17 | eval fixture contract, fresh-source checklist, role contract | P0/P1，避免 fixture 过度宣称和 runtime mirror source 漂移。 |

## Outstanding Questions

| question | blocks planning? | recommended default | owner |
| --- | --- | --- | --- |
| 是否需要将详细编码质量规则拆入新的 `skills/spec-work/references/` 文件？ | no | 如果 hot path 超过紧凑锚点，就拆 reference；否则先内联短规则。 | workflow maintainer |
| 是否需要 typed run artifact schema extension？ | no | 不需要；先用 final/work summary 和 existing generic fields，除非后续出现机器消费者。 | workflow maintainer |
| 是否需要 README / 用户手册更新？ | no | 只有 public workflow semantics 或用户可见入口行为变化明显时更新；内部质量增强可先用 changelog/validation 记录。 | workflow maintainer |

## Readiness Self-Check

readiness_outcome: ready-for-planning

Planning should not need to invent WHAT for public workflow identity, source/runtime boundary, coding-quality goals, minimality interaction, review/closeout evidence, eval fixture authority, fresh-source eval status, or schema-extension default. Planning still owns HOW: exact wording, file split, focused tests, fixture shape, and whether runtime regeneration is needed after source changes.
