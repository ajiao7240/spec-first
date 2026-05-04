---
title: fix: 审计 CE dispatch-boundary 在 spec-first skills 中的漂移
type: fix
status: active
date: 2026-05-05
spec_id: 2026-05-05-002-ce-dispatch-boundary-audit
origin: docs/brainstorms/2026-04-13-spec-first-sync-compound-engineering-updates-requirements.md
---

# fix: 审计 CE dispatch-boundary 在 spec-first skills 中的漂移

## Overview

`spec-first` 已经修复了 `spec-doc-review` 的 Codex 多 agent 边界：当当前 host 和 session 规则允许时，workflow 自己文档化的 persona dispatch 可以执行；当 runtime policy 更严格或 dispatch 不可用时，退回 report-only fallback。这个模式很可能不只影响 `spec-doc-review`，因为 `spec-first` 仍然继承了 CE 的多 agent workflow 结构。

本计划用于做一轮聚焦的 CE lineage audit：全量核实所有 source skills 中的 multi-agent、parallel reviewer、worker、resolver dispatch 语义，并修复那些错误降级 Codex、错误假设 Claude-only primitive、把 dispatch 静默改写成 inline profile reading，或缺少安全 fallback 的位置。

---

## Problem Frame

当前项目源于 CE，核心 workflow 形态仍高度相似。最近只修正了 `skills/spec-doc-review/SKILL.md`，但 source 扫描已经显示其他 skill 仍然提到 subagents、parallel agents、reviewer personas、resolver agents 或 Codex `spawn_agent`。

已知信号：

- `skills/spec-code-review/SKILL.md` 仍然写着 Codex 不应仅因为 skill 提到 reviewer personas 就调用 `spawn_agent`，并且没有对齐 `spec-doc-review` 里“直接调用当前 host workflow 可授权文档化 reviewer phase”的边界。
- `skills/spec-plan/SKILL.md` source 仍使用 `Task spec-...(...)` research dispatch 行，而当前 Codex runtime transform 会把它们改写为 “Read `.codex/agents/...` and apply that agent profile”。这可能会让 Codex 中本应多 agent 的 planning research 退化为 inline profile application。
- `resolve-pr-feedback`、`spec-work`、`spec-work-beta` 会执行 mutating 或 integration-sensitive dispatch，需要比只读 reviewer workflow 更严格的 isolation、conflict avoidance 和 fallback。
- `spec-ideate`、`spec-optimize`、`spec-debug`、`agent-native-audit` 使用 read-only 或 experimental parallelism。这里 dispatch 应是能力优化，不应成为 correctness dependency。

原始 CE sync requirements 已经定义了更大的同步规则：先做映射基线，语义对比 CE 与 spec-first，再批次化同步核心 workflow，同时避免产品边界漂移。本计划是该同步体系下的一个窄化 follow-up，只处理 dispatch-boundary 这一类问题。

---

## Requirements Trace

- R1. 为每个提到 agent、subagent、parallelism、dispatch、delegation、reviewer persona 或 resolver agent 的 `skills/*/SKILL.md` 建立 skill-level dispatch-boundary matrix。
- R2. 对每个命中的 spec-first skill，尽量找到对应 CE source skill；有对应关系时做语义对比，但 CE 只作为证据，不作为真相源。
- R3. 每个受影响 workflow 必须区分四个概念：host capability、当前 session authorization、workflow invocation authorization、fallback behavior。
- R4. 保持 source/runtime 边界：只修改 `skills/`、`agents/`、`src/cli/`、tests 和 docs；不手改 `.claude/`、`.codex/`、`.agents/skills/` runtime mirrors。
- R5. 对 Codex，明确承认当前可通过 `spawn_agent` 支持 dispatch。不能仅因为 host 是 Codex 就降级。
- R6. 对 runtime rendering，验证 Codex 生成的 skills 不会在 workflow 本应 dispatch 时，把 `Task` 行误改成 inline “read and apply profile”。
- R7. 对 mutating dispatch workflows，parallelism 前必须有 disjoint write-set 或 isolation 语义；除非 host-specific isolation contract 明确允许，否则 final integration、validation、staging、commits 由 orchestrator 负责。
- R8. 为修复后的边界补 contract tests，避免后续 CE sync 重新引入 “Codex means no dispatch” 或 “parallel means unbounded” 旧假设。
- R9. 任何 source、test 或 docs 变更都要更新 `CHANGELOG.md`；若行为对用户可见，再同步 README 或 workflow docs。

**Origin linkage:** 本计划推进 origin 中与 dispatch-boundary 直接相关的 requirement（具体范围由 U1 matrix 锁定），将其中一个 CE lineage concern 转化为可执行、可验证的实施 pass。该 plan 不主张推进 origin 中的 mapping baseline、批次同步、CE feature parity 等其他 requirement。origin 文档缺少 `spec_id`，因此本计划使用 plan-local `spec_id`，并将 origin link 记录为 advisory trace。

---

## Scope Boundaries

- 不做完整 CE feature sync，也不整文件复制 CE skills。
- 不修改公开 workflow entrypoint 名称。
- 不直接修改 generated runtime assets。
- 不在缺少独立产品边界决策时，把 `ce-simplify-code` 等 CE-only 能力扩进 spec-first。
- 不放宽当前 session 的 developer/runtime restrictions。workflow prose 可以说明“host 与 session rules 允许时”的行为，但实际执行仍必须遵守当前 host policy。
- 不引入中心化 dispatch state machine。保持轻量 prose contract 与聚焦 tests。

### Deferred to Follow-Up Work

- dispatch-boundary 之外的更大 CE parity audit：交给独立 CE sync 计划或 `spec-skill-audit` pass。
- `spec-first init --codex` 或 `spec-first init --claude` runtime regeneration：等 source 与 tests 修复后，由用户明确要求再执行。
- fresh host-session behavioral validation：实施后有价值，但不能替代 source 和 contract tests。

---

## Graph Readiness

- target_repo: `spec-first`
- status: stale
- source_revision: `dbf9bab1a871fc7aa6c790fe26b70eda10e0e0dc`
- current_revision: `7928d76c`
- stale: true
- primary_providers: `code-review-graph`, `gitnexus`
- degraded_providers: artifact 未报告 degraded provider
- fallback_capabilities: 有界直接读取 source、读取 CE source、source/runtime render tests、必要时使用 GitNexus live MCP 做 symbol-level evidence
- runtime_mcp_evidence: 未使用；当前任务是 prose/runtime contract planning，不是 symbol 行为分析
- confidence: medium
- limitations: graph artifacts 生成于 2026-05-01，且当前 worktree dirty；本计划主要依赖直接文件证据，compiled graph facts 只作为 stale context

---

## Context & Research

### Relevant Code and Patterns

- `skills/spec-doc-review/SKILL.md` 是已修复参考模式：dispatch capability gate、workflow invocation authorization、Codex `spawn_agent` support、bounded parallelism、backpressure handling、single-agent report-only fallback。
- `tests/unit/spec-doc-review-contracts.test.js` 已锁住 doc-review 的新 wording，并防止旧的 unbounded parallel language 回归。
- `skills/spec-code-review/SKILL.md` 已有 dispatch capability gate 和 bounded scheduler，但 Codex-specific wording 仍可能让直接 `$spec-code-review` 调用后错误降级。
- `tests/unit/spec-code-review-contracts.test.js` 已覆盖 bounded reviewer/validator dispatch、model alias safety、stable numbering 和 artifact boundaries，是追加 Codex workflow-invocation authorization 断言的自然落点。
- `src/cli/adapters/codex.js` 会把 source 中的 `Task spec-...(...)` 行改写为 Codex runtime 中的 “Read `.codex/agents/...` and apply that agent profile”。在 Codex 已支持 `spawn_agent` 后，这个 transform 可能已经过时。
- `tests/unit/init-dry-run.test.js` 和 runtime adapter tests 可在临时目录验证 generated Codex skill content，不需要直接编辑 `.agents/skills/`。

### Institutional Learnings

- `docs/solutions/workflow-issues/doc-review-codex-multi-agent-dispatch-boundary-2026-05-05.md` 记录了核心经验：不要混淆 host capability、workflow invocation authorization 和更严格的 session runtime restriction。
- `docs/solutions/architecture-patterns/upstream-ce-sync-upgrade-methodology-2026-04-26.md` 定义了 CE sync 的总原则：应用 CE hunk 前必须先比较当前 spec-first 语义。
- `docs/2026-05-04/project-audit/spec-first-system-audit.md` 已指出 `spec-code-review` 依赖 subagents，需要在 Codex 下明确 fallback boundaries。

### External References

- 不需要外部研究。本计划所需证据都在本地：CE source skills、spec-first source skills、runtime adapter transforms、existing contract tests。

---

## Key Technical Decisions

- 将本次工作定义为 targeted dispatch-boundary repair，而不是 full CE parity project。这样能保持 contract 轻量，也避免重新讨论无关 CE product capabilities。
- 先做 matrix，再做修复。matrix 是证据产物，能避免只修明显的 `spec-code-review`，也避免无控制地 bulk rewrite。
- 对 mutating workflows 比 read-only reviewer workflows 更保守。`resolve-pr-feedback`、`spec-work`、`spec-work-beta` 需要 isolation 和 integration 保证；`spec-debug`、`spec-ideate` 更容易安全降级为 sequential 或 inline analysis。
- 先明确 source intent，再修 Codex runtime rendering。如果 source 仍使用 host-neutral `Task` shorthand，generated Codex runtime 不能在没有显式 fallback rationale 的情况下把 dispatch 降级为 inline profile reading。
- 验证以 source 和 generated-runtime expectation 为主。runtime mirrors 是 disposable outputs，不手改。
- **Source dispatch contract（candidate）**：source skills 在需要 dispatch 时使用 host-neutral prose `Dispatch <agent>(<args>)`，或显式分支 (`Claude: Agent ... / Codex: spawn_agent ...`)；adapter 不再改写 `Task` 行；保留 `Task` 仅作 host-shorthand。U3 与 U4 的 prose 改写以此 contract 为 anchor，避免实施者在缺少 plan 级根据时各自选择不同改写方向。

---

## Open Questions

### Resolved During Planning

- 是否应该做完整 CE skill sync？不应该。当前用户问题是 dispatch-boundary 类漂移，因此实施应全量 audit 这一类问题，只修受影响 surfaces。
- `spec-code-review` 已经有 fallback gate，还要不要纳入？要。它当前 Codex-specific wording 是与 `spec-doc-review` 新边界最明显不一致的残留点。
- generated Codex runtime 是否要纳入？要。用户贴出的 runtime `spec-plan` 内容显示 source-to-runtime transform 可能会擦掉 intended dispatch。

### Deferred to Implementation

- `src/cli/adapters/codex.js` 最终是保留 `Task` dispatch wording，还是把它改写为显式 `spawn_agent` wording，取决于 `spec-plan` 和相关 skills 最终选择的 source contract。
- README 是否需要更新，取决于修复是否改变用户可见 workflow 行为，而不只是内部 contract wording。

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

用一张小矩阵分类每个 affected skill：

| Field | Meaning |
|---|---|
| `skill` | Source skill path |
| `ce_counterpart` | CE source path or `none` |
| `dispatch_type` | read-only reviewer、research、resolver、worker、optimizer、internal audit |
| `mutates_repo` | child agents 是否可能编辑 repo files |
| `workflow_invocation_authorizes_dispatch` | yes、no、not applicable |
| `codex_support` | `spawn_agent`、fork workspace、inline fallback、unsupported、unclear |
| `fallback` | report-only、sequential、inline current agent、stop |
| `risk` | P0/P1/P2/P3 |
| `action` | keep、clarify prose、repair source、repair runtime transform、add test |

实施时先从 deterministic source scan 和人工语义 review 填矩阵，再只 patch 有具体 `action` 的行。

---

## Implementation Units

- U1. **建立 dispatch-boundary audit matrix**

**Goal:** 创建 repo-local evidence artifact，列出每个具备 agent、subagent、parallel、dispatch、delegation、reviewer 或 resolver 语义的 spec-first skill，并映射到 CE。

**Requirements:** R1, R2, R3, R4

**Dependencies:** None

**Files:**
- Create: `docs/validation/2026-05-05-ce-dispatch-boundary-audit-matrix.md`
- Modify: `CHANGELOG.md`

**Approach:**
- Step 0：先用 `grep -rn -E 'subagent|parallel|spawn_agent|Task spec-|dispatch.*agent' skills/*/SKILL.md` 产出原始命中清单，作为 matrix skill 列的 deterministic baseline；matrix 来源不能仅来自 plan 作者枚举。
- 扫描 `skills/*/SKILL.md` 和 CE `plugins/compound-engineering/skills/*/SKILL.md` 的 dispatch terms。
- 使用 High-Level Technical Design 中的 matrix fields 分类每个命中项。
- 区分 read-only dispatch、mutating dispatch、optimizer experiments、internal helper skills。
- 将 `spec-doc-review` 标记为 fixed reference pattern，而不是待重修项。

**Patterns to follow:**
- `docs/validation/2026-04-14-compound-core-workflow-batch-a-audit-report.md`
- `docs/validation/2026-05-05-ce-06a7cee0-sync-ledger.md`
- `docs/solutions/workflow-issues/doc-review-codex-multi-agent-dispatch-boundary-2026-05-05.md`

**Test scenarios:**
- Test expectation: none -- 本单元创建 validation document，不改变可执行行为。

**Verification:**
- Matrix 至少包含 `spec-code-review`、`spec-plan`、`spec-ideate`、`spec-debug`、`spec-optimize`、`resolve-pr-feedback`、`spec-work`、`spec-work-beta`、`spec-doc-review`、`agent-native-audit`，并且必须额外覆盖 `spec-compound`、`spec-compound-refresh`、`spec-brainstorm`、`spec-slack-research` 这四个同样含 dispatch/parallel/subagent 语义的 skill。
- 每一行都说明 skill 是否会 mutates repo files，以及 fallback 是什么。
- evidence section 必须列出参考实现 `spec-doc-review` 在四象限下的实际行为：(a) Claude dispatch 可用、(b) Claude dispatch 失败、(c) Codex `spawn_agent` 可用、(d) stricter session policy；其他 skill 必须对齐到该已确认契约，而非对齐到未验证的 prose。

---

- U2. **让 `spec-code-review` 对齐已修复的 doc-review 边界**

**Goal:** 更新 `spec-code-review`：当当前 host 和 session rules 允许 dispatch 时，直接调用当前 host 的 code-review workflow 可授权其文档化 reviewer phase；当 dispatch 不可用或未授权时，保留 report-only fallback。

**Requirements:** R3, R5, R8

**Dependencies:** U1

**Files:**
- Modify: `skills/spec-code-review/SKILL.md`
- Modify: `tests/unit/spec-code-review-contracts.test.js`
- Modify: `CHANGELOG.md`

**Approach:**
- 对齐 `spec-doc-review` 对 explicit subagent request、direct workflow invocation、parent orchestration、host capability、stricter session policy 的区分。
- 用 “Codex supports reviewer dispatch through `spawn_agent`; do not downgrade solely because the host is Codex.” 替换 stale Codex-specific anti-dispatch wording。
- 除非与新边界冲突，否则不改 mutating fixer 和 artifact rules。
- 保留 unsupported 或 unauthorized dispatch 下的 `single_agent_report_only_fallback`。

**Patterns to follow:**
- `skills/spec-doc-review/SKILL.md`
- `tests/unit/spec-doc-review-contracts.test.js`

**Test scenarios:**
- Happy path: contract test 能找到“直接 `$spec-code-review` invocation 在 session 允许时可授权 documented reviewer phase”的 wording。
- Edge case: contract test 仍能找到 unauthorized dispatch 下的 `single-agent report-only fallback` 和 no artifact writes。
- Error path: contract test 拒绝 stale “Codex-specific rule: do not call `spawn_agent` merely because this skill mentions reviewer personas” wording。

**Verification:**
- `spec-code-review` 仍声明 bounded reviewer 和 validator dispatch，并保留 backpressure handling。
- `spec-code-review` 不再把 Codex 视为天然不能 dispatch reviewers。

---

- U3. **修复或显式保留 Codex runtime dispatch rendering**

**Goal:** 验证 Codex runtime generation 是否还应继续把 source `Task spec-...(...)` research lines 改写成 inline “read and apply profile”；如果该 rewrite 与 Codex multi-agent support 冲突，则修复。

**Requirements:** R4, R5, R6, R8

**Dependencies:** U1

**Files:**
- Modify: `src/cli/adapters/codex.js`
- Modify: `tests/unit/init-dry-run.test.js`
- Modify: `tests/unit/runtime-plan-contracts.test.js`
- Modify: `tests/unit/spec-plan-contracts.test.js`
- Modify: `CHANGELOG.md`

**Approach:**
- 决定 source skills 是否改用显式 host-neutral dispatch prose，或由 Codex adapter 将 `Task spec-...(...)` render 成 `spawn_agent`-compatible instructions。
- 增加 generated-runtime expectation，证明 Codex runtime 的 `spec-plan` 保留 intended multi-agent research dispatch，或明确声明 inline fallback。
- 不编辑 `.agents/skills/`；tests 使用临时目录 render 或 inspect generated content。
- 避免 broad path rewrite 破坏 host-comparative prose 中 Claude/Codex 分支的命令。

**Patterns to follow:**
- `src/cli/adapters/codex.js`
- `tests/unit/init-dry-run.test.js`
- `tests/unit/spec-update-contracts.test.js`

**Test scenarios:**
- Happy path: generated Codex `spec-plan` runtime 不会在 source contract 期待 dispatch 时，把所有 research agents 静默改成 inline single-agent profile application。
- Edge case: 当 source 明确引用 agent profile files 时，generated runtime 仍能使用 `.codex/agents/` paths。
- Edge case: host-comparative skills 仍保留 other-host prose，不被 broad rewrite 破坏。

**Verification:**
- temp `init --codex` test 能证明 rendered `spec-plan` content 符合选定 contract。
- Source `skills/spec-plan/SKILL.md` 与 rendered Codex runtime 对 agents 是 dispatch 还是 inline apply 不再互相矛盾。

---

- U4. **澄清 planning 与 ideation 的 read-only research dispatch**

**Goal:** 让 `spec-plan` 与 `spec-ideate` 对齐 Codex multi-agent support，同时保持 cost transparency 和 fallback 清晰。

**Requirements:** R3, R5, R6, R8

**Dependencies:** U1, U3

**Files:**
- Modify: `skills/spec-plan/SKILL.md`
- Modify: `skills/spec-ideate/SKILL.md`
- Modify: `tests/unit/spec-plan-contracts.test.js`
- Modify: `tests/unit/spec-ideate-contracts.test.js`
- Modify: `CHANGELOG.md`

**Approach:**
- 为 read-only planning 与 ideation research dispatch 增加简洁 capability gate。
- 声明当 host 与 session rules 允许时，direct workflow invocation 可授权文档化 research 或 ideation dispatch。
- 当 dispatch 不可用时，保留 inline current-agent research 或 sequential probes fallback。
- 保持 `spec-ideate` 的 cost transparency，但避免 agent-count notice 暗示 session 禁止时也一定会 dispatch。

**Patterns to follow:**
- `skills/spec-doc-review/SKILL.md`
- `skills/spec-plan/SKILL.md`
- `skills/spec-ideate/SKILL.md`

**Test scenarios:**
- Happy path: `spec-plan` 在 research-agent dispatch 前声明 host/session capability checks。
- Edge case: `spec-plan` 声明 non-dispatch fallback，仍能产出 plan。
- Happy path: `spec-ideate` 保留 cost transparency，并在 multi-agent dispatch 不可用时说明 fallback。

**Verification:**
- Planning 和 ideation workflows 在 Codex runtime 中不再表现为 Claude-only 或 inline-only。

---

- U5. **审计 mutating dispatch workflows 的 isolation 与 fallback**

**Goal:** 确保可能编辑代码或处理 PR feedback 的 workflows 不把 read-only reviewer 假设套到 mutating dispatch 上。

**Requirements:** R3, R5, R7, R8

**Dependencies:** U1

**Files:**
- Modify: `resolve-pr-feedback/SKILL.md`
- Modify: `skills/spec-work/SKILL.md`
- Modify: `skills/spec-work-beta/SKILL.md`
- Modify: `tests/unit/resolve-pr-feedback-contracts.test.js`
- Modify: `tests/unit/spec-work-contracts.test.js`
- Modify: `tests/unit/spec-work-beta-contracts.test.js`
- Modify: `CHANGELOG.md`

**Approach:**
- 先比对现行 `skills/resolve-pr-feedback/SKILL.md`、`skills/spec-work/SKILL.md`、`skills/spec-work-beta/SKILL.md` 已具备的 isolation/fallback 段（例如 `resolve-pr-feedback` 已有 Batching、Conflict avoidance、Sequential fallback 三段），只对仍缺失的 host capability gate / workflow invocation authorization 段做 patch；不重写已正确的 conflict 与 fallback 条款。
- 对 `resolve-pr-feedback`，澄清 direct invocation 是否授权 resolver-agent dispatch，并在 dispatch 或 isolation 不可用时要求 sequential fallback 或 conflict-aware batching（如该 skill 已具备相应 wording，仅补 capability gate 即可，不重写）。
- 对 `spec-work` 和 `spec-work-beta`，验证现有 Codex fork-workspace row 是否仍正确，并且比 CE 旧 shared-directory wording 更新。
- 保持 Codex fork-workspace handoff 下 orchestrator 拥有 final integration、project-level verification、staging、commits。
- 当 write sets overlap 且 isolation 不明确时，不增加 parallelism。

**Patterns to follow:**
- `skills/spec-work/SKILL.md`
- `skills/spec-work-beta/SKILL.md`
- `resolve-pr-feedback/SKILL.md`
- CE `ce-work` 与 `ce-resolve-pr-feedback` 仅作为历史对比

**Test scenarios:**
- Happy path: mutating workflows 区分 fork-workspace、worktree isolation、shared-directory fallback、no-subagent support。
- Edge case: file sets overlap 时，除非 host isolation contract 提供 inspectable merge handoff，否则必须 serialize。
- Error path: 无 dispatch support 时，要么提供 inline/sequential current-agent path，要么在 mutation 不安全时明确 stop。

**Verification:**
- 若当前 spec-first contract 认为 Codex 使用 forked workspace semantics，mutating workflow 不再声称 Codex subagents 与 orchestrator 共享目录。
- Codex fork-workspace handoff 下不要求 subagents stage 或 commit。

---

- U6. **审计 optimizer、debug 与 internal-audit parallelism**

**Goal:** 分类低频或 experimental parallelism，确保它们是 optimization，而不是 hard dependency。

**Requirements:** R1, R3, R5, R8

**Dependencies:** U1

**Files:**
- Modify: `skills/spec-optimize/SKILL.md`
- Modify: `skills/spec-debug/SKILL.md`
- Modify: `skills/agent-native-audit/SKILL.md`
- Modify: `tests/unit/spec-optimize-contracts.test.js`
- Modify: `tests/unit/spec-debug-contracts.test.js`
- Modify: `CHANGELOG.md`

**Approach:**
- 保持 `spec-debug` parallel investigation 是 latency optimization：subagents 只读，且有 sequential fallback。
- 对 `spec-optimize`，澄清 Codex delegation、worktree experiments、ordinary subagent dispatch 是不同 backends，并确保 Codex failure cascade 能 fallback 到 supported local mode。
- 对 `agent-native-audit`，按 internal helper 处理（不在 `/spec:*` 公开入口），保留 capability gate 与 sequential fallback；不引入 workflow invocation authorization wording。

**Patterns to follow:**
- `skills/spec-debug/SKILL.md`
- `skills/spec-optimize/SKILL.md`
- `skills/agent-native-audit/SKILL.md`

**Test scenarios:**
- Happy path: `spec-debug` 保留 read-only hypothesis probes 和 sequential fallback。
- Edge case: `spec-optimize` 不把 Codex delegation failures 当成 terminal，只要 subagent 或 serial execution 可继续。
- Edge case: `agent-native-audit` 不要求 unbounded parallel dispatch。

**Verification:**
- Experimental 和 internal-audit workflows 都把 dispatch 写成 optional capability，而不是 correctness 必需条件。

---

- U7. **增加 dispatch-boundary regression tests 与 docs**

**Goal:** 防止未来 CE sync 重新引入 stale host assumptions 或 generated-runtime drift。

**Requirements:** R2, R4, R8, R9

**Dependencies:** U2, U3, U4, U5, U6

**Files:**
- Create or modify: `tests/unit/spec-dispatch-boundary-contracts.test.js`
- Modify: `tests/unit/workflow-invocation-boundary.test.js`
- Modify: `docs/validation/2026-05-05-ce-dispatch-boundary-audit-matrix.md`
- Modify: `CHANGELOG.md`

**Approach:**
- 增加一个小型 static negative assertion：高风险 source skills 不得携带未引用 audit matrix accepted-divergence 集合的 stale "Codex cannot dispatch" wording；若有合法 session-policy 依据，必须在 source 引用 matrix entry 才允许出现该 wording。
- 对适合共享 wording 的 skills 增加 cross-skill assertions。
- 具体行为仍放在各 skill 的 contract tests 中，避免单个大测试变成规则引擎。
- 现有 `tests/unit/workflow-invocation-boundary.test.js` 锁公开 entrypoint 不被 dispatch；新 `tests/unit/spec-dispatch-boundary-contracts.test.js` 锁 dispatch capability gate / fallback wording 的跨 skill 共享条款；不在新文件复制旧文件断言。
- 在 audit matrix 中记录所有接受的 CE divergence。

**Patterns to follow:**
- `tests/unit/spec-doc-review-contracts.test.js`
- `tests/unit/workflow-invocation-boundary.test.js`
- `tests/unit/spec-code-review-contracts.test.js`

**Test scenarios:**
- Happy path: 具备 reviewer/research dispatch 的 source skills 提到 host/session capability 与 fallback。
- Edge case: source skills 仍可说明 stricter runtime policy 覆盖 workflow prose。
- Error path: 如果 `spec-code-review` 重新引入 stale Codex-specific anti-dispatch wording，test fails。

**Verification:**
- Contract tests 能让 cross-skill policy 可发现，但不会把它变成 central rule engine。

---

- U8. **验证 source、generated runtime expectations 与 fresh-source 行为**

**Goal:** 用窄测试、source/runtime boundary checks 和 limitations 记录收口实施。

**Requirements:** R4, R8, R9

**Dependencies:** U1, U2, U3, U4, U5, U6, U7

**Files:**
- Modify: `CHANGELOG.md`
- Optional modify: `docs/contracts/workflows/fresh-source-eval-checklist.md` only if the checklist itself needs a dispatch-boundary note

**Approach:**
- 运行每个 touched skill 和 adapter 的窄单测。
- 运行 `npm run lint:skill-entrypoints`，因为 public workflow 与 agent boundary language 是本次变更的一部分。
- 若 adapter code 变更，运行 `npm run typecheck`。
- 若 runtime rendering 变更，使用 temp-dir `init --codex` contract test，而不是编辑 `.agents/skills/`。
- Source 修复后再考虑 fresh-source eval；若当前 host policy 不允许 dispatch-based evaluation，记录未执行原因。

**Patterns to follow:**
- `docs/contracts/workflows/fresh-source-eval-checklist.md`
- `tests/unit/init-dry-run.test.js`
- `tests/unit/runtime-plan-contracts.test.js`

**Test scenarios:**
- Happy path: 窄 skill contract tests pass。
- Edge case: generated Codex runtime content 与 source intent 对齐，且没有直接 runtime mirror edits。
- Error path: 若 fresh-source eval 因当前 session policy 不允许 reviewer dispatch 而未执行，final report 明确说明 limitation。

**Verification:**
- 最终实施总结列出实际运行的 tests，并明确说明 generated runtime assets 没有被手改。

---

## System-Wide Impact

- **Interaction graph:** 影响 workflow skill prose、Codex runtime rendering、contract tests，可能影响 instruction docs；除非 Codex adapter transform 被修，否则不改变 CLI command behavior。
- **Error propagation:** Dispatch 不可用时，应降级到 report-only、sequential 或 inline current-agent path。mutating workflows 在 dispatch 不安全时必须 stop 或 serialize。
- **State lifecycle risks:** runtime mirrors 可能在 regenerate 前保持 stale；source 与 tests 仍是真相源。未执行 `spec-first init --codex` 或 `spec-first init --claude` 前，不应声称 runtime behavior 已刷新。
- **API surface parity:** Claude 与 Codex 应暴露等价 workflow semantics，但技术 primitive 不同；计划不得声称 isolation behavior 完全相同。
- **Integration coverage:** 如果 adapter behavior 变化，必须有 generated-runtime tests；只做 source skill prose tests 不足以覆盖用户贴出的 Codex runtime 问题。
- **Unchanged invariants:** `spec-doc-review` 仍是 fixed reference implementation。公开 workflow names 与 source/runtime boundaries 不变。

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| 机械 CE parity 覆盖 spec-first-specific Codex governance | Matrix-first audit；CE 是证据，不是真相源 |
| Source fixes 因 adapter transforms 没有进入 Codex runtime | U3 加 generated runtime contract tests |
| Mutating parallel dispatch 造成 file collisions 或 lost changes | 要求 isolation、disjoint write sets、sequential fallback 和 orchestrator integration |
| Tests 过度中心化，把 policy 变成 brittle rule engine | Cross-skill assertions 保持窄范围，skill-specific contracts 放回本地 test files |
| 当前 dirty worktree 掩盖 unrelated user changes | 编辑前读取当前目标文件并局部 patch；不 revert unrelated changes |

---

## Documentation / Operational Notes

- 如果 source changes 改变 `$spec-code-review`、`$spec-plan`、`$spec-ideate`、`$spec-work` 或 `$spec-work-beta` 的用户可见行为，应同步 README 或用户文档。
- 如果只是内部 boundary wording 与 tests 变化，`CHANGELOG.md` 和 validation matrix 可能足够。
- Runtime refresh 不属于本计划默认实施范围；只有 source validation 后用户明确要求才执行。
- 每个 implementation unit 至少产出一条 `CHANGELOG.md` 条目；用户可见行为变更（U2、U4、U5、U6 的可见输出）追加 `(user-visible)` 标记；`作者` 字段使用 host developer profile（Claude 读取 `.claude/spec-first/.developer`，Codex 读取 `.codex/spec-first/.developer`）。

---

## Sources & References

- **Origin document:** `docs/brainstorms/2026-04-13-spec-first-sync-compound-engineering-updates-requirements.md`
- Related plan: `docs/plans/2026-05-04-001-sync-ce-06a7cee0-workflow-updates-plan.md`
- Related audit: `docs/2026-05-04/project-audit/spec-first-system-audit.md`
- Related learning: `docs/solutions/workflow-issues/doc-review-codex-multi-agent-dispatch-boundary-2026-05-05.md`
- Fixed reference skill: `skills/spec-doc-review/SKILL.md`
- Primary candidate skill: `skills/spec-code-review/SKILL.md`
- Runtime transform candidate: `src/cli/adapters/codex.js`
- CE source root: local CE checkout supplied by the user; compare `plugins/compound-engineering/skills/` inside that checkout

---

## Review Log

`spec-doc-review` 2026-05-05 单 agent report-only fallback（reviewer dispatch 因 host 网关 panic 与 1m 上下文未启用而 5/5 失败）后追加；FYI 级条目仅记录，未重写主体段落：

- F1：Origin linkage 段术语已统一为 `advisory trace`；Sources & References 仍保留 origin document 强引用，二者语义不冲突。
- F2：`src/cli/adapters/codex.js:205-214` 已确认现行 transform 实把 `Task spec-...(...)` 改写为 inline `Read .codex/agents/...` profile application；U3 Goal 的"验证是否还应继续"应在实施时按 fact 处理为"验证并替换"，而非开放性问题。
- F3：Risks 表当前未标注优先级与 owner；如实施时新增风险，建议按 P0/P1/P2/P3 分级并在每行末尾注明 owner，便于交接。
- F4：Graph Readiness 段 `degraded_providers: artifact 未报告 degraded provider` 中英混排，下次 plan 修订时统一为中文 "artifact 未报告降级 provider" 或保留 schema 字段名为英文。
- F5：按本仓库 CLAUDE.md 任务分级，本 plan（8 unit、跨 ~14 skill + adapter + 6+ test files）属"大型任务"；下一轮修订建议补全 migration strategy 与 downstream consumer checks 段，避免在实施期再被 scope-guardian 反向要求。
