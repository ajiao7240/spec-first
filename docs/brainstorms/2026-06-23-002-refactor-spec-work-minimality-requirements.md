---
spec_id: 2026-06-23-002-spec-work-minimality
artifact_kind: prd-requirements
target_surface: cli-devtool
status: draft
evidence_grade: mixed
created: 2026-06-23
source_material: user-provided external reference plan on Ponytail-inspired spec-work minimality
---

# refactor: spec-work 最小实现决策层需求

## Summary

`spec-work` 需要在保持现有执行 workflow 身份、质量门和 source/runtime 边界的前提下，新增一层“实现前最小性判断”。目标不是让 agent 盲目少写代码，而是让 `$spec-work` 在新增代码、依赖、文件、抽象、配置或 runtime 相关产物前，先判断该实现是否真的需要存在、是否可复用当前代码或平台能力、是否会牺牲安全/数据/可访问性/可观测性/验证质量，并在必要时留下可审查的 rejected path、protected code 和 debt/gain 证据。

## Problem Frame

用户提供的参考计划已经分析了 Ponytail 的“结构化减法”方法，并指出 `spec-work` 当前已有高质量执行闭环，但缺少实现前的最小实现决策层。该参考计划属于 HOW 倾向较强的优化方案，不能直接作为执行计划消费；本 PRD 只提炼规划阶段必须稳定的 WHAT/WHY：`spec-work` 对实现最小性的行为要求、不可裁剪边界、artifact/consumer 关系、负向验收和规划时需要重新确认的证据。

## Current System Snapshot

| claim | tag | source / owner | note |
| --- | --- | --- | --- |
| `spec-work` 当前定位为执行 validated task pack、settled plan、spec path 或 concrete implementation request 的 workflow。 | confirmed-source | `skills/spec-work/SKILL.md` | Workflow Contract Summary 明确 When To Use / Workflow / Outputs。 |
| `spec-work` 明确在 WHAT/HOW 未解决、repo scope 不明确、task pack stale、scope 会扩张或需要手改 generated runtime mirrors 时不应继续执行。 | confirmed-source | `skills/spec-work/SKILL.md` | 当前已有执行边界和失败模式。 |
| `spec-work` 已要求先建立可观察的最小 feedback loop，并鼓励按 vertical tracer bullets 完成行为、验证和交付证据。 | confirmed-source | `skills/spec-work/SKILL.md` | 该机制回答“如何观察和验证当前 slice”。 |
| `spec-work` 已要求执行时以 source plan/task pack 为范围权威，scope 外文件、repo、routes、symbols、consumers 或 risks 只能记录为 follow-up/test-candidate，不能静默加入当前单元。 | confirmed-source | `skills/spec-work/SKILL.md` | 这能防需求扩张，但不等同于防实现过度工程。 |
| `spec-work` 已有 Test Discovery、Test Scenario Completeness 和 System-Wide Test Check，覆盖测试发现、happy/edge/error/integration 场景、真实链路、orphaned state 和错误策略等问题。 | confirmed-source | `skills/spec-work/SKILL.md` | 这些机制可以作为 protected code categories 的现有质量底线。 |
| `spec-work` 已有后置 `Simplify as You Go`，在每 2-3 个相关实现单元后审查重复、共享 helper、复用和效率优化。 | confirmed-source | `skills/spec-work/SKILL.md` | 当前是后置简化提醒，不是实现前的 minimality gate。 |
| `spec-work` Phase 4 已要求 structured verification closeout，不能只用 “tests passed” 自然语言作为验证证明。 | confirmed-source | `skills/spec-work/references/shipping-workflow.md` | verification-run-summary 和 honest-closeout 是结构化验证基础。 |
| `docs/contracts/workflows/spec-work-run-artifact.schema.json` 是 source-owned write-side contract，producer 写 `spec-work-run-artifact/v2`；payload 使用 `spec-work-run-artifact-payload/v2`。 | confirmed-source | `skills/spec-work/SKILL.md`, `docs/contracts/workflows/spec-work-run-artifact.schema.json`, `tests/unit/spec-work-run-artifact-contract.test.js`, `tests/unit/spec-work-run-artifact-producer.test.js` | minimality 证据若进入 run artifact，必须遵守现有 artifact 边界。 |
| 用户提供的 Ponytail/spec-work 参考计划主张新增 minimality ladder、dependency/abstraction gate、protected code categories、minimality review/debt/gain 和 eval/metrics。 | user-stated | user-provided external reference plan | 这些是参考主张；本 PRD 需要经当前 source 校准后沉淀为需求。 |

## Change Delta

| item | current | target | delta | evidence |
| --- | --- | --- | --- | --- |
| workflow identity | `spec-work` 是执行明确 work 的 workflow，强调 shipping complete features。 | 保持执行 workflow 身份，不变成独立审计器、lint 规则引擎、代码压缩器或规划 workflow。 | keep | `skills/spec-work/SKILL.md` |
| scope authority | plan/task/user request 是执行范围权威，外部工具和发现只是 advisory。 | minimality 也必须服从该范围权威；不能借“少写代码”缩小已确认的验收，也不能借“复用”扩大范围。 | keep / extend | `skills/spec-work/SKILL.md` |
| feedback loop | 行为变更前建立或尝试最小反馈环。 | 在反馈环和实现动作之间新增实现前 minimality 判断，减少不必要的代码、依赖、文件、抽象和配置。 | extend | `skills/spec-work/SKILL.md`, user-provided reference plan |
| simplify mechanism | `Simplify as You Go` 是后置经验式简化。 | 升级为前置 minimality gate + 后置 minimality review/gain/debt 闭环。 | replace / extend | `skills/spec-work/SKILL.md` |
| dependency decisions | 当前没有专门的 dependency add gate。 | 新增依赖必须被显式判定为 scope 必需、现有能力不可替代，并记录 accepted/rejected 理由。 | add | user-provided reference plan |
| abstraction decisions | 当前依赖一般工程判断和 nearby pattern。 | 新增抽象、helper、wrapper、manager、factory、hook、adapter、共享配置等必须有调用点、约定、保护或维护性理由。 | add | user-provided reference plan |
| protected code | 测试、系统链路、错误/状态等保护散布在现有质量机制中。 | 明确 minimality 不能裁剪数据丢失保护、安全校验、可访问性、可观测性和必需验证。 | extend | `skills/spec-work/SKILL.md` |
| closeout evidence | run artifact/verification summary 已承载结构化 closeout。 | 默认把 minimality decisions、rejected paths、protected code、debt/gain findings 写入 final/work summary，并在 durable evidence trigger 适用时复用现有 run artifact 通用槽位（如 `llm_asserted.summary`、`key_decisions`、`deferred_follow_up`、`read_artifacts`）；只有出现明确 typed downstream consumer 时，才另走 consumer-backed schema extension。 | extend | `skills/spec-work/references/shipping-workflow.md`, `docs/contracts/workflows/spec-work-run-artifact.schema.json` |
| generated runtime mirrors | `.claude/`、`.codex/`、`.agents/skills/` 不作为 source。 | minimality 不得把 generated mirrors 当成可直接修补或可直接删减的 source surface。 | keep | `docs/10-prompt/结构化项目角色契约.md`, `skills/spec-work/SKILL.md` |

## Goals / Success Metrics

| goal | observable signal | baseline / target posture | evidence |
| --- | --- | --- | --- |
| 减少 AI 执行期不必要实现 | closeout 或 review 中可观察到 rejected dependency/file/abstraction/config paths，且新增依赖和单调用点抽象都有理由。 | 无可信数值 baseline；本轮只要求有可审查口径，不制造 LOC 目标。 | assumption + user-provided reference plan |
| 不因“少写代码”降低质量 | protected code categories 被显式保留，测试/验证 posture 不低于原 workflow 要求。 | 质量底线不得下降；critical review findings 不应因过度精简增加。 | confirmed-source: `skills/spec-work/SKILL.md` |
| 让后续 plan/work/review 可复盘 minimality 判断 | work summary、review handoff 或现有 run artifact 通用字段能看到 material decisions、debt/gain 和 not-run reason。 | 默认不扩 schema、不新增第二套 workflow artifact topology；typed schema extension 需要另有明确 consumer。 | confirmed-source: `skills/spec-work/references/shipping-workflow.md` |

## Change Topology

Primary topology: workflow-change

Secondary topology: contract-change, artifact evidence extension, source-of-truth boundary

Why this topology matters: 本次需求改变的是 `spec-work` 执行行为和证据闭环，而不是单个功能实现。规划若不明确 workflow identity、dependency/abstraction 触发边界、protected code、run artifact 消费方式和 generated runtime 非 source 边界，后续实现容易把 minimality 误做成 LOC 优先、全仓默认 audit、硬编码静态分析器、或者独立于 `spec-work` 的第二套 artifact 系统。

## Surface Map

| surface | current behavior | owner/source | artifact/contract | consumer | delta | evidence |
| --- | --- | --- | --- | --- | --- | --- |
| public workflow entry | `$spec-work` / `/spec:work` 执行明确 work。 | `skills/spec-work/SKILL.md`, runtime catalog | workflow skill source | Claude/Codex users | keep | confirmed-source |
| execution hot path | Phase 0-2 处理输入、范围、环境、执行和测试。 | `skills/spec-work/SKILL.md` | skill prose | `spec-work` orchestrator | extend minimality decision before risky implementation actions | confirmed-source + user-stated |
| quality/review pass | Tiered review、Simplify as You Go、Final Validation。 | `skills/spec-work/SKILL.md`, `skills/spec-work/references/shipping-workflow.md` | skill prose / review handoff | `spec-code-review`, human reviewers | extend minimality review/gain/debt | confirmed-source + user-stated |
| verification closeout | structured verification summary, honest closeout, resource lens。 | `skills/spec-work/references/shipping-workflow.md`, verification contracts | closeout evidence | users, reviewers, run artifact producer | extend with minimality evidence when triggered | confirmed-source |
| run artifact | `spec-work-run-artifact/v2` source-owned write-side contract。 | `docs/contracts/workflows/spec-work-run-artifact.schema.json`, CLI helper/tests | run JSON under `.spec-first/workflows/spec-work/**` | `spec-code-review`, resume/handoff, maintainers | reuse existing generic fields by default; typed schema extension only with separate consumer-backed contract change | confirmed-source |
| eval/examples | `skills/spec-work/evals/examples.json` is examples-as-context, not quality proof。 | `skills/spec-work/SKILL.md` | source fixture | maintainers/fresh-source eval | extend with minimality examples only as advisory fixtures | confirmed-source |
| generated runtime mirrors | generated host assets are excluded from ordinary source authority。 | `docs/10-prompt/结构化项目角色契约.md`, `skills/spec-work/SKILL.md` | runtime copies | host runtimes | keep untouched except via `spec-first init` | confirmed-source |

## Producer / Artifact / Consumer

| producer | artifact/schema/path | freshness/authority | consumers | change effect | evidence |
| --- | --- | --- | --- | --- | --- |
| `spec-work` maintainer | `skills/spec-work/SKILL.md` | source-of-truth | Claude/Codex runtime render, users, tests | Adds minimality behavior contract to hot path. | confirmed-source |
| `spec-work` maintainer | `skills/spec-work/references/*.md` | source support files | `spec-work`, runtime copies, tests | May hold detailed minimality ladder/review/gain rules if hot path stays compact. | confirmed-source |
| `spec-work` closeout | work summary / final response | per-run human summary | user, reviewers, downstream workflows | Must show material minimality decisions or skipped reason when relevant. | confirmed-source |
| internal CLI producer | `spec-work-run-artifact/v2` under `.spec-first/workflows/spec-work/**` | generated run evidence, not source authority | `spec-code-review`, resume/handoff, maintainers | May carry compact minimality evidence through existing generic fields when durable trigger applies; no new typed field is required in this PRD. | confirmed-source |
| reviewer workflow | `spec-code-review` findings and residual work artifact | review evidence | `spec-work`, human reviewers, tracker/defer flow | Can consume minimality-gain focus to catch over-compression. | confirmed-source for review consumer; user-stated for focus |
| eval maintainer | `skills/spec-work/evals/examples.json` or focused fixture | source advisory examples | contract tests, fresh-source eval context | Captures representative minimality drift cases without becoming semantic proof. | confirmed-source + assumption |

## Source-Of-Truth Resolution

| item | current source-of-truth | target source-of-truth | generated mirrors / non-authoritative refs | conflict rule |
| --- | --- | --- | --- | --- |
| `spec-work` workflow behavior | `skills/spec-work/SKILL.md` plus required references | same | `.claude/**`, `.codex/**`, `.agents/skills/**` | Source wins; regenerate runtime if needed, do not patch mirrors. |
| minimality rules | absent as first-class current behavior | `skills/spec-work/SKILL.md` hot-path contract plus optional source references | user-provided reference plan remains advisory | PRD settles WHAT; future plan owns HOW/file layout. |
| dependency/abstraction decisions | existing engineering judgment and nearby code conventions | explicit workflow decision note when material | package manager lockfiles are evidence of changed dependencies, not policy source | New dependencies/abstractions need reason and protected checks. |
| closeout evidence | verification-run-summary, honest closeout, final/work summary, run artifact payload/schema | same; minimality evidence defaults to summary / `llm_asserted` generic fields when durable artifact exists | `.spec-first/workflows/**` artifacts are run evidence, not scope authority; typed schema extension is a future consumer-backed contract change | Artifact consumers may read evidence but cannot infer source scope or approval from it. |
| external Ponytail article/plan | external inspiration/reference | no direct source authority in repo | article and external plan are reference-claims only | Product scope and acceptance come from this PRD plus confirmed repo source. |

## Actors

| actor | role in this increment | requirement relevance |
| --- | --- | --- |
| Workflow maintainer | Edits `spec-work` source, references, tests, closeout/schema/docs as needed. | Needs clear source/runtime and artifact contract boundaries. |
| Work executor agent | Runs `spec-work` against plan/task/user request. | Must choose smallest adequate implementation path without weakening protections. |
| Planning author | Converts this PRD into a plan. | Should not invent whether dependency/abstraction/protected-code behavior is required. |
| Reviewer / `spec-code-review` | Reviews implementation and residuals. | Needs minimality-gain signals to catch over-compression and over-engineering. |
| Downstream user | Reads final response, run artifact, PR, or changelog. | Needs evidence that less code did not mean less safety or verification. |

## Requirements

| id | priority | requirement | rationale/source |
| --- | --- | --- | --- |
| R-01 | P0 | `spec-work` must preserve its current execution workflow identity: it executes scoped work after WHAT/HOW is sufficiently clear and must not become a planning workflow, full-repo audit workflow, code minifier, or static rule engine. | confirmed-source: `skills/spec-work/SKILL.md`; AE-01 |
| R-02 | P0 | Before adding new dependencies, files, abstractions, shared helpers, wrappers, configuration, generated/runtime assets, or broad boilerplate, `spec-work` must run a minimality decision that asks whether the change is required by the current plan/task/user request. | user-stated reference plan; confirmed-source scope boundary: `skills/spec-work/SKILL.md`; AE-02 |
| R-03 | P0 | The minimality decision must prefer, in order, current code reuse, language standard library, platform/framework-native capability, already-installed dependencies, and local direct implementation before introducing new dependencies or abstractions. | user-stated reference plan; AE-02, AE-03 |
| R-04 | P0 | New dependencies must require an explicit accepted/rejected decision when dependency manifests or lockfiles change; the decision must cover scope need, existing alternatives, maintenance/security/license/runtime/bundle risk where relevant, and removal/rollback boundary. | user-stated reference plan; AE-03 |
| R-05 | P0 | New abstractions such as services, managers, factories, adapters, providers, hooks, wrappers, interfaces, shared helpers, or single-purpose configuration must require a visible justification when they have fewer than 2-3 real call sites unless they protect security, data consistency, protocol boundaries, or established framework conventions. | user-stated reference plan; AE-04 |
| R-06 | P0 | Minimality must never mean removing or skipping protected code: data-loss protection, security validation, accessibility, observability, required tests, required verification, and source/plan trace evidence are not optional brevity targets. | confirmed-source quality mechanisms: `skills/spec-work/SKILL.md`; AE-05, AE-06 |
| R-07 | P0 | The existing feedback-loop requirement must remain: minimality decisions do not replace failing/characterization tests, CLI/browser checks, schema/docs checks, or other focused feedback loops for the current slice. | confirmed-source: `skills/spec-work/SKILL.md`; AE-06 |
| R-08 | P0 | Scope non-expansion must remain bidirectional: `spec-work` must not expand work because a reusable abstraction seems useful, and must not shrink accepted requirements because the shorter path is easier. | confirmed-source: `skills/spec-work/SKILL.md`; AE-01, AE-07 |
| R-09 | P1 | `spec-work` should support a small set of minimality intensity postures, such as lightweight/default/strict/off, so ordinary work avoids heavy ceremony while dependency-sensitive or over-engineering-prone work gets stronger scrutiny. | user-stated reference plan; AE-08 |
| R-10 | P1 | For material decisions, closeout or work summary must record rejected implementation paths, protected code kept, accepted over-engineering debt, or gain-needed risks in compact form. | confirmed-source closeout boundary: `skills/spec-work/references/shipping-workflow.md`; AE-09 |
| R-11 | P1 | `Simplify as You Go` must evolve from a generic simplification reminder into a structured post-change review that classifies findings as remove-now, minimality-debt, gain-needed, or keep-protected when those distinctions affect downstream action. | confirmed-source current simplify: `skills/spec-work/SKILL.md`; AE-10 |
| R-12 | P1 | When a durable evidence trigger applies, minimality evidence must integrate with the existing structured closeout boundary. The default run-artifact representation is compact text in existing generic fields such as `llm_asserted.summary`, `key_decisions`, `deferred_follow_up`, or `read_artifacts`; this PRD does not require a new typed `minimality` schema field. | confirmed-source: `skills/spec-work/SKILL.md`, `docs/contracts/workflows/spec-work-run-artifact.schema.json`; AE-09 |
| R-13 | P1 | Review handoff should expose a `minimality-gain` style focus when the diff appears shorter but may have dropped required safety, data, accessibility, observability, testing, framework convention, or maintainability protection. | user-stated reference plan; confirmed-source review consumer: `skills/spec-work/references/shipping-workflow.md`; AE-11 |
| R-14 | P2 | Full-repo minimality audit must be explicit opt-in or triggered by high-risk evidence; it must not run by default for ordinary `spec-work` executions. | user-stated reference plan; AE-12 |
| R-15 | P2 | Eval/example coverage for minimality should use source-owned advisory fixtures that cover platform-native-before-dependency, reuse-before-reimplementation, single-use abstraction, protected-code retention, and over-compression gain cases without claiming semantic proof. | confirmed-source examples-as-context boundary: `skills/spec-work/SKILL.md`; AE-13 |
| R-16 | P0 | Any implementation of this PRD must modify source-of-truth files only and must not hand-edit generated runtime mirrors as the way to deliver minimality behavior. | confirmed-source: `docs/10-prompt/结构化项目角色契约.md`, `skills/spec-work/SKILL.md`; AE-14 |
| R-17 | P0 | Closeout must include focused deterministic verification, generated runtime mirror status, changelog coverage, and fresh-source eval status or a visible not-run reason when workflow prose behavior changes. | project instruction; confirmed-source closeout: `skills/spec-work/references/shipping-workflow.md`; AE-15 |

## Acceptance Examples

AE-01（对应 R-01, R-08）
Given `$spec-work` receives a validated task pack with clear scope
When the minimality layer evaluates an implementation option
Then it keeps executing the task pack rather than routing into planning, full-repo audit, or unrelated cleanup, and records out-of-scope simplification ideas as follow-up only.

AE-02（对应 R-02, R-03）
Given a task can be satisfied by an existing helper or native platform capability
When the executor considers adding a new wrapper or dependency
Then the workflow chooses reuse/native capability or records why those paths are insufficient before adding anything new.

AE-03（对应 R-03, R-04）
Given a diff modifies `package.json` or another dependency manifest/lockfile
When `spec-work` reaches closeout or review handoff
Then the dependency addition has an accepted decision with alternatives rejected and risks noted, or the dependency path is rejected in favor of standard/current/platform capability.

AE-04（对应 R-05）
Given a single local call site needs simple behavior
When the executor proposes a service, factory, adapter, provider, hook, shared helper, or wrapper
Then the default outcome is local direct implementation unless the abstraction has real call-site, consistency, protocol, security, data, or framework-convention evidence.

AE-05（对应 R-06）
Given a shorter implementation path omits input validation, auth/authz, idempotency, rollback, cleanup, accessibility label/focus semantics, logs/error handling, or required verification
When the minimality decision compares alternatives
Then the shorter path is rejected or marked gain-needed, and protected code remains visible in the implementation and closeout.

AE-06（对应 R-06, R-07）
Given behavior-bearing code changes
When minimality produces a small local implementation
Then Test Discovery, Test Scenario Completeness, System-Wide Test Check, and focused verification still apply according to current `spec-work` rules.

AE-07（对应 R-08）
Given the plan requires a compatibility or error state
When a shorter path would leave that state unsupported
Then `spec-work` must implement or explicitly hand off the required state; it cannot use minimality as a reason to drop accepted scope.

AE-08（对应 R-09）
Given a docs-only typo or narrow config change
When minimality is active
Then only material triggers such as new dependency/file/abstraction/config require visible decision notes; the workflow does not add heavy ceremony to trivial work.

AE-09（对应 R-10, R-12）
Given a durable evidence trigger applies after substantive work
When the run artifact payload is produced
Then minimality decisions are represented through the final/work summary and existing run-artifact generic fields, and the final response names either the artifact path or the concrete skipped/failed producer reason.

AE-10（对应 R-11）
Given 2-3 related implementation units have landed
When `Simplify as You Go` runs
Then findings distinguish safe remove-now items, accepted minimality debt, gain-needed protection gaps, and keep-protected code rather than only saying “simplify”.

AE-11（对应 R-13）
Given a diff substantially reduces code
When review focus is prepared
Then the handoff can ask reviewers to check whether protected security/data/accessibility/observability/testing/maintainability behavior was lost for brevity.

AE-12（对应 R-14）
Given a user asks only to execute one small scoped change
When no high-risk diff or explicit audit request exists
Then `spec-work` does not run a full-repo over-engineering audit and does not widen scope into unrelated cleanup.

AE-13（对应 R-15）
Given minimality eval/examples are added
When tests or fresh-source eval consume them
Then they are labeled examples-as-context/advisory fixtures and do not claim to prove model semantic quality or serve as a deterministic router.

AE-14（对应 R-16）
Given generated runtime copies differ from source
When delivering this behavior
Then the maintainer changes source files and uses runtime generation/verification as needed; they do not patch `.claude/**`, `.codex/**`, or `.agents/skills/**` as source fixes.

AE-15（对应 R-17）
Given workflow prose behavior changes and semantic drift matters
When closeout is written
Then focused deterministic checks, changelog coverage, generated-runtime status, and fresh-source eval status or `not_run` reason are visible.

## Negative Acceptance

NA-01
Given the goal is fewer unnecessary lines/files/dependencies
When implementing minimality behavior
Then the workflow must not optimize for LOC alone or encourage unreadable one-liners that reduce maintainability.

NA-02
Given a shorter implementation path exists
When it drops security, data-loss prevention, accessibility, observability, required tests, or source/plan trace evidence
Then it must not be accepted as a successful minimality outcome.

NA-03
Given a dependency or abstraction might be useful later
When there is no current plan/task/user scope or source evidence for that future need
Then `spec-work` must not add it speculatively.

NA-04
Given a full-repo audit might find broader cleanup
When the current request is ordinary scoped work
Then the audit must not run by default and must not create unrelated implementation scope.

NA-05
Given minimality evidence is useful for closeout
When durable evidence is recorded
Then the implementation must not invent a new artifact family outside the existing `spec-work` closeout/run-artifact boundary without a separate consumer-backed contract change.

NA-06
Given examples/evals are added
When describing their confidence
Then the workflow must not present them as provider telemetry, benchmark proof, or human adjudication unless those evidence artifacts exist.

NA-07
Given generated runtime mirrors exist
When source and runtime diverge
Then `.claude/**`, `.codex/**`, and `.agents/skills/**` must not become the source-of-truth for minimality behavior.

## Scope Boundaries

### In Scope

- `spec-work` workflow behavior around implementation-before-code minimality decisions.
- Dependency addition, abstraction addition, new file/helper/config/wrapper decision behavior.
- Protected code categories at workflow requirement level.
- Post-change minimality review/gain/debt behavior as part of `spec-work` quality/review closeout.
- Existing structured verification and `spec-work-run-artifact/v2` evidence boundary when minimality decisions need durable evidence.
- Advisory eval/example cases that prevent prompt drift without becoming semantic proof.
- Source/runtime boundary, changelog, deterministic tests, and fresh-source eval/not-run closeout expectations.

### Out Of Scope

- Implementing this PRD during the PRD workflow.
- Rewriting `spec-work` as an automated optimizer, static analyzer, full-repo audit engine, or central state machine.
- Making LOC reduction, token reduction, or file count reduction the sole success metric.
- Adding a new public `$spec-minimality` workflow or exposing internal helper skills as user entrypoints.
- Running full-repo over-engineering audit by default on every `spec-work` invocation.
- Hand-editing generated runtime mirrors to deliver the behavior.
- Expanding dependency/license/security policy beyond what is needed to decide implementation minimality at workflow level.

## Evidence And Assumptions

| claim | tag | source / owner | note |
| --- | --- | --- | --- |
| `spec-work` current source has no first-class `Work Minimality Gate` section. | confirmed-source | `rg -n "Work Minimality|minimality" skills/spec-work/SKILL.md skills/spec-work/references` | No first-class minimality gate was found in `skills/spec-work/**`; the current source only has post-change `Simplify as You Go`. |
| Minimality behavior should be attached to `spec-work`, not split into a new public workflow. | assumption | Role contract + current workflow identity | This follows the core chain and avoids new entrypoint topology. |
| Daily/default posture should avoid heavy ceremony. | user-stated | user-provided external reference plan | PRD writes this as requirement posture, not exact implementation mode names. |
| Dependency manifests and lockfiles are the primary visible trigger for dependency add decisions. | assumption | Common package manager convention + user-provided reference plan | Future plan should enumerate project-relevant manifests from current source. |
| Protected code categories map onto current `spec-work` quality mechanisms but may need clearer prompt wording. | confirmed-source + assumption | `skills/spec-work/SKILL.md` | Current tests/checks cover much of the quality floor; wording is not yet explicit as minimality boundary. |
| Existing `spec-work-run-artifact/v2` has constrained generic fields and `additionalProperties: false`; material minimality evidence can be carried as compact text in existing generic fields, while typed schema extension requires separate consumer-backed schema/test work. | confirmed-source + assumption | `docs/contracts/workflows/spec-work-run-artifact.schema.json`, `tests/unit/spec-work-run-artifact-contract.test.js` | This PRD chooses the default non-schema-extension path to avoid forcing planning to invent the contract decision. |
| User-provided Ponytail article/source facts are external inspiration, not project source truth. | user-stated / external-reference | user-provided external reference plan | No external web verification was requested or required for this PRD; repo source determines current state. |

## Planning Recheck

| item | why recheck | required before | blocks planning? |
| --- | --- | --- | --- |
| `skills/spec-work/SKILL.md` current dirty state | The worktree already has unrelated source changes; a future plan should verify the latest source before selecting exact edit points. | Writing implementation plan units | yes |
| `docs/contracts/workflows/spec-work-run-artifact.schema.json` payload shape | The default path is existing generic fields; recheck schema only if a future plan proposes typed `minimality` fields or machine-queryable artifact semantics. | Any plan unit that changes run artifact schema/payload | yes for schema-extension units; no for summary-only units |
| `tests/unit/spec-work-contracts.test.js`, `tests/unit/spec-work-run-artifact-contract.test.js`, `tests/unit/spec-work-run-artifact-producer.test.js` | Existing tests define current contract anchors and producer behavior. | Test plan selection | yes |
| `skills/spec-work/evals/examples.json` | Examples-as-context boundary must be preserved if minimality examples are added. | Eval/example unit planning | yes |

## Decision Notes

| question | recommended_answer | source_tag | chosen_answer | consequence | deferred_reason |
| --- | --- | --- | --- | --- | --- |
| Should minimality be a separate public workflow? | No; keep it inside `spec-work` execution behavior. | assumption + role contract | accepted assumption | Avoids new public entry and keeps the change in the execution node of the core chain. | none |
| Should full-repo audit run by default? | No; explicit opt-in or high-risk trigger only. | user-stated | accepted assumption | Prevents scope widening and context noise during ordinary work. | none |
| Should LOC be the primary success metric? | No; use dependency/file/abstraction reduction plus protected-code and verification posture. | user-stated + role contract | accepted assumption | Avoids unsafe over-compression. | none |
| Should generated runtime mirrors be edited to deliver behavior? | No. | confirmed-source | accepted | Source changes first; runtime refresh is separate. | none |
| Should this PRD require a new typed `minimality` field in `spec-work-run-artifact/v2`? | No by default; use final/work summary and existing generic artifact fields unless a future consumer needs typed queries. | confirmed-source + assumption | accepted assumption | Planning can implement closeout evidence without inventing schema scope; schema extension remains a separate consumer-backed decision. | none |

## Feature Slices

| feature id | title | requirement refs | acceptance refs | source / evidence | notes |
| --- | --- | --- | --- | --- | --- |
| FS-01 | 实现前 minimality decision | R-01, R-02, R-03, R-08 | AE-01, AE-02, AE-07 | `skills/spec-work/SKILL.md`, user-provided reference plan | P0，先稳定行为身份和决策阶梯。 |
| FS-02 | dependency / abstraction gate | R-04, R-05 | AE-03, AE-04 | user-provided reference plan | P0，防止顺手装包和过早抽象。 |
| FS-03 | protected code quality floor | R-06, R-07, R-13 | AE-05, AE-06, AE-11 | `skills/spec-work/SKILL.md` | P0/P1，确保少写不降质。 |
| FS-04 | closeout / artifact / review evidence | R-10, R-11, R-12, R-17 | AE-09, AE-10, AE-15 | `skills/spec-work/references/shipping-workflow.md`, `docs/contracts/workflows/spec-work-run-artifact.schema.json` | P1，进入现有证据闭环；默认不扩 typed schema。 |
| FS-05 | optional audit / eval calibration | R-09, R-14, R-15 | AE-08, AE-12, AE-13 | `skills/spec-work/SKILL.md`, user-provided reference plan | P1/P2，避免默认全仓扫描和 fixture 过度宣称。 |

## Outstanding Questions

| question | blocks planning? | recommended default | owner |
| --- | --- | --- | --- |
| minimality intensity posture 的具体名称是否必须采用 `lite/full/ultra/off`？ | no | PRD 不固定名称；计划可按现有 workflow 语言选择轻量/default/strict/off。 | workflow maintainer |
| 是否需要 README / 用户手册更新？ | no | 只有 public workflow semantics 或用户可见入口行为变化时更新；内部质量门可先用 changelog/validation 记录。 | workflow maintainer |
