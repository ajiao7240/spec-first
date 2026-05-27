# Trellis 纵向钻探与 spec-first 质量提升分析

> 日期: 2026-05-27
> 输入范围: 用户指定只读对标材料 `external:trellis` 的本地快照文档与代码
> 对照目标: `repo:spec-first`
> 输出性质: 长期业界借鉴 artifact；不是实施计划，不是 runtime contract，不替代既有 roadmap

## 0. 结论先行

Trellis 最值得 spec-first 借鉴的不是 `.trellis/tasks/`、active task、`task.json.status` 或每轮 hook 本身，而是它背后的更深一层判断:

> 长会话 AI coding 的根本问题不是 agent 不够多，而是关键约束会随时间衰减。可靠系统必须把约束外置、分层、按时机重新注入，并用测试守住这些注入点。

spec-first 已经走在另一条更轻的路线上: `Codebase -> Graph -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge`，source/runtime 边界清楚，deterministic facts 与 LLM judgment 分工也更明确。因此，spec-first 不应复制 Trellis 的强任务状态机；应吸收 Trellis 的“约束衰减防御”并改写成 spec-first 自己的 Harness 机制:

1. 把 Trellis 的 per-turn breadcrumb 改写为 spec-first 的 workflow step reminder、context bundle 和 run evidence，而不是新增 active-task 状态。
2. 把 Trellis 的 `implement.jsonl` / `check.jsonl` 改写为 task-pack `context_refs`、artifact-summary、review-pre-facts 和 source-read requirements，而不是新增任务目录注入协议。
3. 把 Trellis 的 `.trellis/spec/` 改写为 `docs/contracts/`、`docs/solutions/`、source skills/agents/templates 和必要的 project-local artifacts，而不是新增平行规范根。
4. 把 Trellis 的 workspace journal 改写为 `spec-work` run evidence、`spec-sessions` distilled replay 和 `spec-compound` learning docs，而不是默认个人流水账。
5. 把 Trellis 的 workflow markdown invariant 测试升级为 spec-first 的 public workflow contract summary、source/runtime guard、runtime capability catalog 和 changelog/release continuity tests。

一句话: Trellis 用强状态机稳定 AI 执行；spec-first 应用轻合同和证据闭环稳定 AI 判断。

## 0.1 Artifact Status

本文的长期定位是 **industry borrowing / comparative analysis**，用于保存 Trellis 对 spec-first 的可复用启发、反面边界和 clean-room 证据，不作为新的实施 source-of-truth。

- 已有实施路线以 `docs/plans/2026-05-11-001-feat-trellis-inspired-workflow-quality-plan.md` 及其后续实际 source 变更为准。
- 本文第 10 节只记录“相对既有 roadmap 的强化、delta 或设计问题”，不能被单独当作 P0/P1 backlog。
- 任何后续实现必须回到 source skills、agents、CLI contracts、tests、docs/contracts 或新的 plan/task-pack；不得从本文直接推导 runtime 行为。
- 外部 Trellis 内容只作为思想和机制对照；因 AGPL-3.0-only 边界，后续实现不得复制 Trellis 代码、schema、prompt 或大段 prose。

## 1. 证据边界

### 1.1 Trellis 读取范围

本次实际读取并对照了 `external:trellis` 的 5 份分析文档。该 `docs/` 目录在观察快照中属于未跟踪材料，因此只作为用户提供的 local comparative input，不作为 upstream release 文档事实:

| 文件 | 关键主题 |
| --- | --- |
| `docs/trellis-project-analysis.md` | 总体目标、状态机、上下文三层注入、skill/agent、工程取舍、风险 |
| `docs/trellis-workflow-analysis.md` | 0-1 项目和存量迭代如何收敛到同一条任务闭环 |
| `docs/trellis-first-time-existing-project.md` | 首次接入已有项目时先判断 spec 是否可用 |
| `docs/trellis-existing-project-iteration.md` | 已有项目需求迭代的 PRD、task、jsonl、执行、检查、记录 |
| `docs/trellis-memory-system.md` | spec、task、session、history 四层记忆，以及写入时机 |

同时读取了 Trellis 关键源码和模板:

| 路径 | 观察到的机制 |
| --- | --- |
| `packages/cli/src/templates/trellis/workflow.md` | `[workflow-state:*]` tag blocks 是 per-turn breadcrumb 的 source of truth |
| `packages/cli/src/templates/shared-hooks/inject-workflow-state.py` | 每轮解析 active task status，再从 `workflow.md` 注入短提醒 |
| `packages/cli/src/templates/shared-hooks/inject-subagent-context.py` | 子代理启动前读取 `implement.jsonl` / `check.jsonl` / `prd.md` |
| `packages/cli/src/templates/shared-hooks/session-start.py` | 会话启动按任务状态输出不同 next action，并拦截 jsonl 未 curated 的情况 |
| `packages/cli/src/templates/trellis/scripts/common/active_task.py` | session-scoped active task 指针与多平台 session id 解析 |
| `packages/cli/src/templates/trellis/config.yaml` | journal 轮转、lifecycle hooks、monorepo packages、Codex dispatch mode |
| `packages/cli/src/templates/common/skills/update-spec.md` | code-spec first、7 节 executable contract 模板 |
| `packages/cli/package.json` 与 `LICENSE` | `@mindfoldhq/trellis` v0.5.19，AGPL-3.0-only |

Clean-room evidence:

| Fact | Value |
| --- | --- |
| repo label | `external:trellis` |
| observed revision | `4ff3f1d4ff5f936921aed4f470a8a3693a503091` |
| package evidence | `@mindfoldhq/trellis` v0.5.19 |
| license evidence | `AGPL-3.0-only` from package metadata and inspected license surface |
| worktree limitation | dirty snapshot: deleted `assets/trellis-demo-zh.gif`; untracked `.serena/`, `.trellis/workspace/codex-agent/`, `docs/` |
| inspected command class | `git rev-parse HEAD`, `git status --short`, package metadata read, bounded source/template reads |
| authority limitation | Dirty and untracked files are session-local evidence only; this report records ideas and mechanisms, not stable upstream release claims. |

### 1.2 spec-first 对照范围

本次读取的 spec-first 证据包括:

| 路径 | 对照含义 |
| --- | --- |
| `docs/10-prompt/结构化项目角色契约.md` | spec-first 演化判断基线 |
| `docs/contracts/ai-coding-harness.md` | Context / Execution / Evidence / Evaluation / Governance / Knowledge Harness 分层 |
| `docs/contracts/context-governance.md` | 默认上下文排除、summary-first、runtime artifact policy |
| `docs/contracts/context-bundle.md` | context-request/context-bundle 轻量 envelope |
| `docs/contracts/artifact-summary.md` | durable artifact summary-first handoff |
| `docs/contracts/source-runtime-customization-boundary.md` | source/runtime/provider 定制边界 |
| `docs/contracts/workflows/review-pre-facts-extraction.md` | review 前置事实抽取、GitNexus bounded evidence |
| `docs/contracts/workflows/spec-work-run-artifact.schema.json` | `spec-work` run evidence contract，当前 producer available 但 workflow integrated 为 false |
| `skills/using-spec-first/SKILL.md` | workflow 入口治理 |
| `skills/spec-brainstorm/SKILL.md` | WHAT 阶段需求成型与 one-question 机制 |
| `skills/spec-work/SKILL.md` | 执行阶段、task-pack 消费、feedback loop、run artifact 边界 |
| `skills/spec-debug/SKILL.md` | root-cause、feedback loop、hypothesis ledger |
| `skills/spec-compound/SKILL.md` | `docs/solutions/` 知识沉淀 |
| `src/cli/adapters/claude.js` / `src/cli/adapters/codex.js` | source 到双宿主 runtime 的投影边界 |
| `src/cli/task-pack.js` / `src/cli/commands/tasks.js` | task pack hash、validate、derived execution handoff |
| `docs/plans/2026-05-11-001-feat-trellis-inspired-workflow-quality-plan.md` | 既有 completed Trellis-inspired roadmap；本文不得重复制造第二实施路线 |

GitNexus compiled readiness 可用于 orientation，但不是本文的 graph-fresh 证据: `.spec-first/graph/provider-status.json` 的 `last_indexed_commit` 为 `8dc7e77627d1f38286d91bf1f4af11831dd6a766`，当前对照时 `repo:spec-first` HEAD 为 `5a23afb035d8da295f828190e56cbd9b5ad39dfa` 且工作树 dirty。本文是 docs-only 长期分析，最终判断以当前文件读取、既有 plan 对照和角色契约为准。

## 2. 第一层: 表面问题不是“没有流程”

Trellis 表面上是一个工作流工具。它有 CLI、platform configurators、skills、agents、hooks、tasks、workspace journal。若停在这一层，很容易得出错误结论: spec-first 应该也加 active task、任务目录、per-turn hook。

但 Trellis 文档反复暴露出更具体的问题:

- AI 会在第 20 轮忘记第 3 步没做。
- 子代理不知道该读哪些 spec。
- 研究结果留在聊天里，下一阶段拿不到。
- 任务完成后没有把经验写回可复用知识。
- 用户手改、AI 改动和 runtime 产物容易混在一起。

这不是“缺少流程”的问题，而是“约束和证据没有稳定进入下一次判断”的问题。

spec-first 当前已经有流程:

```text
Codebase -> Graph -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge
```

所以 spec-first 的问题不是补一条 Trellis 式任务链，而是让这条链中的每个节点更抗遗忘、更可恢复、更少上下文污染。

## 3. 第二层: Trellis 的根机制是四层记忆

Trellis 把记忆分成四类:

| 记忆层 | Trellis 载体 | 它回答的问题 |
| --- | --- | --- |
| 长期团队知识 | `.trellis/spec/` | 这个项目怎么写才安全 |
| 任务知识 | `.trellis/tasks/<task>/prd.md`、`task.json`、`*.jsonl` | 当前任务要做什么、给子代理读什么 |
| 会话执行状态 | `.trellis/.runtime/sessions/<id>` | 当前 AI 会话指向哪个任务 |
| 历史流水账 | `.trellis/workspace/<dev>/journal-N.md` | 上次为什么这么做 |

这一层的关键洞察是: 不同寿命的信息不能放在同一个文件里。

spec-first 已经有类似但更分散的分层:

| 记忆层 | spec-first 现状 |
| --- | --- |
| 长期工程合同 | `docs/contracts/`、source skills/agents/templates、`AGENTS.md`、`CLAUDE.md` |
| 需求与计划 | `docs/brainstorms/`、`docs/plans/` |
| 派生执行输入 | `docs/tasks/` task packs、`source_plan_hash`、`context_refs` |
| 运行证据 | `.spec-first/graph/`、`.spec-first/impact/`、`.spec-first/workflows/` |
| 知识沉淀 | `docs/solutions/` |
| 会话历史 | `spec-sessions` 从 host session records 抽取 |

差异在于: Trellis 以 task 为中心，spec-first 以 artifact chain 和 Harness layer 为中心。

因此可借鉴的不是目录形态，而是“每层只回答一个问题”的原则。spec-first 后续凡是新增字段、artifact、contract，应先问:

- 这是长期合同、任务输入、运行证据、审查证据，还是知识沉淀？
- 谁写它: script、LLM、agent，还是用户？
- 谁消费它: plan、work、review、debug、compound，还是 release guard？
- 它是 confirmed truth，还是 advisory evidence？

如果回答不清，就不该新增。

## 4. 第三层: 记忆本身不够，必须按时机注入

Trellis 的真正强点不是“文件多”，而是它把注入时机切得很细:

| 注入层 | 触发时机 | 目的 |
| --- | --- | --- |
| SessionStart | 会话开始 | 给 AI 冷启动上下文、当前状态、next action |
| UserPromptSubmit | 每轮用户输入 | 用极短 breadcrumb 抵抗流程遗忘 |
| PreToolUse / sub-agent spawn | 子代理启动 | 给 implement/check/research 一次性灌入任务上下文 |

这一层解决的是三种不同噪声:

- 冷启动噪声: AI 一进来不知道项目状态。
- 长会话衰减: AI 做到后面忘了当前 phase。
- 子代理隔离: 子代理没有父会话记忆。

spec-first 对应能力已经有雏形:

- `using-spec-first` 是入口路由器，但不是会话状态注入器。
- `context-governance` 与 `context-bundle` 定义最小上下文 envelope。
- `review-pre-facts` 能把 graph/direct-read facts 压缩成 reviewer 可消费的前置信息。
- `artifact-summary` 能让下游先读摘要，再按 trigger 展开全文。
- `spec-work` 已要求 run-local context ledger 和 feedback loop。

缺口在于: spec-first 的上下文注入更多靠 workflow prose 和人工执行纪律，还没有形成 Trellis 那样清晰的“时机矩阵”。

建议改写为 spec-first 自己的三层:

| spec-first 层 | 目标 | 不做什么 |
| --- | --- | --- |
| Entry orientation | `using-spec-first` / public workflow summary 先读事实，再推荐入口 | 不写 active task |
| Dynamic context bundle | work/review/debug 按 request 生成最小 context refs 与 excluded reason | 不广播全 repo |
| Run/Review evidence handoff | `spec-work`、`spec-code-review`、`spec-compound` 留 compact evidence | 不存 workflow progress state |

这是 Trellis 注入思想的轻量版本。

## 5. 第四层: Breadcrumb 的本质是“周期性冗余”

Trellis 的 breadcrumb 看似只是 200 到 300 token 的短提醒。往下一层看，它解决的是 LLM attention 中指令权重下降的问题。

Trellis 用 `workflow.md` 中的 `[workflow-state:STATUS]` block 做 source of truth，每轮 hook 只解析，不内嵌 fallback 文案。这样做有两个强约束:

1. Prompt 中每轮都有当前 phase 的必要提醒。
2. 提醒内容由 markdown source 控制，并被 regression test 守护。

这给 spec-first 的启发很直接:

spec-first 不一定需要每轮 hook，但需要识别哪些约束一旦被遗忘就会造成高风险静默失败。对这些约束，应进入“周期性可见”而非“只在长 skill 文档里出现一次”。

候选约束包括:

- `spec-work`: task pack 是 derived artifact，scope authority 仍是 source plan。
- `spec-work`: 写代码前必须建立或尝试反馈环。
- `spec-code-review`: finding 必须由 diff/source/test/contract 证实，provider evidence 只是 advisory。
- `spec-debug`: 根因链必须闭合，graph evidence 不能替代 reproduction/source/log/test。
- `spec-compound`: learning 必须来自已解决问题，不归档原始聊天。
- `spec-update` / `init`: generated runtime mirror 不能作为 source fix。

落地方式不应是 Trellis 式 `task.json.status`。更适合 spec-first 的方式是:

- 在 public workflow summary 中放“本 workflow 最容易被遗忘的 3 条 invariant”。
- 把“关键提醒是否已应用”先作为 design question，而不是直接新增 `critical_reminders_applied[]` 字段；若后续进入 contract，必须先定义 writer、consumer、truth tier、schema/version、tests 和降级行为。
- 为高风险 workflow prose 增加 contract tests: 如果某个 required gate 出现在执行段落中，summary/closeout/reminder 段也必须出现对应提醒。

这等价于把 Trellis 的 breadcrumb invariant 从 runtime hook 迁移到 source contract + tests。

## 6. 第五层: JSONL 注入的本质是“上下文裁剪责任前移”

Trellis 的 `implement.jsonl` / `check.jsonl` 不是普通上下文列表。它把“子代理该读什么”的判断责任前移到 Phase 1.3:

- 主会话先理解任务。
- 主会话选择 spec/research 文件。
- 子代理启动时只读 curated entries。

这防止子代理盲扫整个 spec 树，也防止 Phase 2 才发现关键研究丢失。

spec-first 不能照搬 JSONL，因为 task-pack 已经承担 derived execution handoff，`context-bundle` 与 `artifact-summary` 也已经存在。真正要吸收的是:

> 执行前必须显式选择最小充分上下文，并说明为什么这些上下文足够。

当前 spec-first 已有 `context_refs`、`source_reads_required`、`evidence_paths`，但还可以更硬一点:

1. `docs/tasks/*` 中的 `context_refs` 应明确区分:
   - source-plan focused section
   - contract/doc reference
   - changed/nearby source path
   - test/verification path
   - research/evidence artifact
2. `spec-work` 在进入实现前应报告:
   - 已读哪些 task refs；
   - 回查了 source plan 哪些 section；
   - 哪些 context refs 只是 advisory；
   - 哪些证据因 stale/degraded 未采用。
3. `review-pre-facts` 的 `source_reads_required[]` 应成为 review/debug/work 的可执行提醒，而不是只是 provider result 的附属字段。

这能保留 Trellis 的上下文裁剪收益，又不会新增 `.trellis/tasks/<task>/*.jsonl` 这类第二任务系统。

## 7. 第六层: `.trellis/spec` 的本质是“可执行知识”，不是规范目录

Trellis 的 `update-spec.md` 很关键。它把 “spec” 定义为 code-spec:

- signatures
- request/response/env contracts
- validation/error matrix
- good/base/bad cases
- tests required
- wrong vs correct

这一层比 “把经验写进文档” 更深。它要求知识能被未来 agent 执行、验证、反例校准。

spec-first 的 `docs/solutions/` 已经能沉淀经验，但还需要更明确地区分两类知识:

| 类型 | 应放哪里 | 要求 |
| --- | --- | --- |
| 可执行合同 | `docs/contracts/`、source skill/agent/template、CLI schema/tests | 字段、边界、错误、测试、反例 |
| 可复用经验 | `docs/solutions/` | 适用条件、症状、根因、解决、预防、证据路径 |

可借鉴动作:

- `spec-compound` 对 CLI/API/schema/env/cross-layer 经验，增加“contract depth”检查。
- `spec-debug` 修复后若 root cause 属于 recurring class，要求说明是否需要 contract、test、runtime guard 或 compound。
- `spec-code-review` 对 docs-only contract 变更，不只看 prose 一致性，还要问“能否被未来 workflow 执行或验证”。

不应做的事:

- 不新增 `.spec-first/spec/` 或 `.trellis/spec/`。
- 不把所有经验都提升到合同。
- 不让脚本判断知识是否“有价值”。脚本只能验证 frontmatter/schema/path/test presence，价值判断仍由 LLM 和 review 做。

## 8. 第七层: Journal 的本质是“恢复因果链”

Trellis 的 workspace journal 记录个人时间线: 哪个 session、哪个 branch、做了什么、测试如何、下一步是什么。它不是团队规范，不进 git。

spec-first 当前有三块相邻能力:

- `spec-sessions`: 从 host session history 中检索过去工作。
- `spec-work-run-artifact`: schema 已有，当前 contract 明确 `workflow_integrated=false`。
- `spec-compound`: 把已解决问题沉淀到 `docs/solutions/`。

这说明 spec-first 不缺 journal 的思想，缺的是执行闭环里的稳定落点。

建议:

1. 优先把 `spec-work` run artifact 真正接入 closeout，至少覆盖长任务、task-pack、degraded graph、not-run validation、resume/compaction 这些触发条件。
2. `spec-sessions` 继续作为原始会话历史的检索层，不要复制 Trellis 的个人 journal 目录。
3. `spec-compound` 只保存经过判断的可复用经验，不保存全量流水账。

这样形成轻量分工:

```text
host session raw history -> spec-sessions 检索
work closeout evidence   -> .spec-first/workflows/spec-work/.../run.json
reusable lesson          -> docs/solutions/...
```

这比 Trellis journal 更符合 spec-first 的 source/runtime/artifact 边界。

## 9. 第八层: 状态机的代价不能被忽略

Trellis 的强状态机解决了很多问题，但也带来真实成本:

| 成本 | 表现 |
| --- | --- |
| 状态耦合 | task status、active pointer、breadcrumb、phase gate 必须同步 |
| 平台兼容成本 | 多平台 session id、Cursor shell ticket、Codex dispatch mode 等补丁 |
| Token 成本 | 每轮 breadcrumb 与 spec 注入 |
| 用户摩擦 | 小任务也容易被流程化 |
| 文档损坏风险 | `workflow.md` tag block 一坏，hook 降级 |
| license 边界 | Trellis 为 AGPL-3.0-only，不能复制实现或大段 prose |

spec-first 的核心哲学是 `Light contract + Explicit boundaries + Scripts prepare, LLM decides`。因此必须拒绝下列照搬:

- 不引入 persistent active task。
- 不让 task status 决定 workflow phase。
- 不把 task directory 作为所有工作的必经入口。
- 不默认每次 work 都 dispatch implement/check 子代理。
- 不默认 auto-commit、archive、journal。
- 不把 generated runtime mirror 当作可手改 source。
- 不复制 Trellis 代码、schema、prompt 大段文本。

Trellis 证明的是“周期性约束与上下文裁剪有价值”，不是“强状态机一定适合 spec-first”。

## 10. 相对既有 roadmap 的 8 个可复用判断

本节不是新的 P0/P1 backlog。既有 roadmap 已在 `docs/plans/2026-05-11-001-feat-trellis-inspired-workflow-quality-plan.md` 中完成 Trellis / pro-workflow / Matt Pocock skills 的综合吸收规划；本文只记录 Trellis 纵向钻探后，对该 roadmap 的强化、delta 或后续设计问题。

| 判断 | 与既有 roadmap 的关系 | 本文长期结论 | 边界 |
| --- | --- | --- | --- |
| `spec-work` run artifact | Reinforces U3 / R3 | Trellis journal 再次证明 run evidence 是 Code -> Review -> Knowledge 的高杠杆闭环；若 producer available 但 workflow integrated 仍为 false，应优先按既有计划收口。 | 不记录 active phase、approval state、next active task；final response 不能伪装成 durable evidence。 |
| workflow required-gate reminder invariant | Adds delta to U1 / U8 | Trellis breadcrumb 的新价值是“required gate 必须在 summary / reminder / closeout 仍可见”；这可作为后续 contract-test lens。 | 不先发明 per-turn hook；不直接新增 schema 字段。 |
| task-pack `context_refs` 质量 | Reinforces U2 | `context_refs` 应是 minimal sufficient execution context selection，而不是 path list；`spec-work` 仍需回查 source plan 聚焦片段。 | Validator 只验证 deterministic shape/path/freshness，不判断语义充分。 |
| `spec-brainstorm` 问题分流 gate | Reinforces R14 / U9 / U10 | action-before-asking、阻塞问题和偏好问题分流仍是提升 requirements 输入质量的关键。 | 不把 brainstorm 变成固定问卷或强制 task lifecycle。 |
| executable-contract depth | Adds delta to compound/debug/review 知识闭环 | Trellis code-spec 提醒 spec-first 区分 reusable learning 与 contract change candidate；高风险经验要能被未来 workflow 执行或验证。 | `docs/solutions/` 不升格为 source contract；价值判断仍由 LLM/review 完成。 |
| Debug 后防复发矩阵 | Adds delta to debug closeout | break-loop taxonomy 可作为 `spec-debug` Phase 4 handoff 的判断镜片，帮助决定是否需要 compound、contract、test 或 guard follow-up。 | 不新增固定 debug 模板，不让脚本判断 root-cause 类别。 |
| Research artifact-backed | Adds cross-workflow design question | 长 research 应留下 source paths、evidence summaries、limitations 和后续 source-read requirement，避免只留在 chat。 | 是否落到 temp artifact、plan/brainstorm doc、artifact-summary 或 workflow closeout，需另行设计 consumer。 |
| Release continuity guard | Reinforces U5 | Trellis manifest continuity 继续支持 spec-first 用 deterministic guard 检查 public workflow surface、README、runtime catalog、governance、CHANGELOG 和 package delivery drift。 | 脚本只验证事实和 reason_code，不输出 skill 质量或 release readiness 语义结论。 |

后续执行者应先检查这些判断在既有 roadmap、当前 source 和 tests 中是否已经落地；只有剩余 delta 明确、consumer 明确、验证路径明确时，才另开 plan 或 task-pack。

## 11. 不应从 Trellis 借的 7 件事

1. **不要复制 active task pointer。** spec-first 的 scope authority 来自 requirements/plan/task-pack/source refs，不来自当前会话状态。
2. **不要复制 `task.json.status` phase routing。** spec-first 不应有隐藏状态机决定当前该 brainstorm 还是 implement。
3. **不要新增 `.trellis/spec` 式规范根。** spec-first 已有 source skills、docs/contracts、docs/solutions 和 host entry docs。
4. **不要默认 auto-commit / archive / journal。** 这会与用户工作树、review、PR 边界冲突。
5. **不要默认 implement/check 双 agent 流水线。** spec-first 应保持 explicit dispatch 和 bounded worker/reviewer scope。
6. **不要把 per-turn hook 做成所有 workflow 的强依赖。** hook 可作为未来 optional capability，但不应变成核心 correctness 前提。
7. **不要复制 AGPL 实现或大段 prose。** 本报告只吸收思想、机制和取舍，用 spec-first 语言重新表达。

## 12. 后续消费方式

本文进入长期知识库后，正确消费方式不是“照第 10 节排期”，而是把它当作 Trellis-specific review lens:

1. **检查既有 roadmap。** 先对照 `docs/plans/2026-05-11-001-feat-trellis-inspired-workflow-quality-plan.md`，判断某个点是 already covered、reinforced、new delta，还是已被后续 source 变更吸收。
2. **回到当前 source。** 再读取对应 `skills/`、`docs/contracts/`、`src/cli/contracts/`、tests 和 CHANGELOG，确认当前运行时 source-of-truth 是否仍存在缺口。
3. **只为明确 delta 建 plan。** 如果只是强化既有方向，更新既有 plan/status 或相关 contract test 即可；如果是新字段、新 artifact、新 release guard 或跨 workflow consumer，必须另开小计划说明 writer、consumer、truth tier、schema、failure mode 和验证路径。
4. **保持 clean-room。** 后续实现只能使用 spec-first 自己的语言、schema、tests 和 docs；Trellis AGPL 代码、prompt、schema 和长段 prose 不进入 spec-first source。

最小可维护顺序仍应继承既有 roadmap 的阶段划分，而不是由本文重新定义:

| 消费类型 | 处理方式 |
| --- | --- |
| Reinforcement | 用本文作为 review / design rationale，确认既有实现没有偏离 Trellis 启发的本质。 |
| Delta candidate | 先写窄计划或 review finding，再改 source 和 tests。 |
| Design question | 先保留为 open question；没有 writer/consumer/schema/test 前不写入 contract。 |
| Rejected borrowing | 保留在第 11 节作为反向 guard，防止后续把 Trellis 状态机搬进 spec-first。 |

## 13. 最终判断

Trellis 的深层价值可以压成一条因果链:

```text
LLM 会遗忘
  -> 关键约束必须外置
  -> 外置后必须分层
  -> 分层后必须按时机注入
  -> 注入点必须有 source of truth
  -> source of truth 必须被测试守护
  -> 完成后必须把经验写回可复用知识
```

spec-first 的深层价值是另一条链:

```text
AI coding 是 workflow 问题
  -> workflow 需要 artifacts
  -> artifacts 需要 source/runtime/provider 边界
  -> scripts 准备 facts
  -> LLM 做 judgment
  -> review 验证 judgment
  -> compound 沉淀知识
```

两条链真正相交的地方不是 task system，而是:

> 用最小的确定性机制，让下一次 LLM 判断拿到更好的事实、更清楚的边界、更短的上下文和更可靠的历史。

因此，spec-first 应借 Trellis 的“抗遗忘工程”，不借 Trellis 的“强状态形态”。这才是对 spec-first 质量提升最稳、最符合角色契约的吸收方式。
