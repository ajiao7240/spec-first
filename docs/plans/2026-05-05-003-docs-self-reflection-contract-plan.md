---
title: docs: 建立 self-reflection capability-upgrade 轻量 contract
date: 2026-05-05
status: completed
type: docs
spec_id: 2026-05-05-003-self-reflection-contract
target_repo: spec-first
origin: docs/2026-05-05-self-reflection-upgrade/05-prioritized-roadmap.md
---

# docs: 建立 self-reflection capability-upgrade 轻量 contract

## Overview

本计划承接 Cycle 0 自我审视报告中的 Accepted CUD-001..005，把它们落成一个 source-level、docs-only 的轻量 contract。目标是让后续自我审视能稳定执行：

```text
自我审视 -> 能力缺口 -> 能力升级决策 -> 最佳实践吸收 -> plan handoff -> review 验证 -> compound 沉淀 -> 下一轮自我审视
```

本计划不是新增 `spec-evolve`、新 skill、agent、script、command 或 runtime workflow。它只把当前已经验证需要的报告结构、证据 intake、CUD 追踪、provider freshness、fresh-source eval 期望和 30-cycle next input 固化为可审查的 source contract。

## Requirements Trace

| Requirement | Origin | Planned fix |
|---|---|---|
| R1. 自我审视 composition contract | CUD-001 | 新增 `docs/contracts/workflows/self-reflection-capability-upgrade.md` |
| R2. CUD feedback through plan/review/compound | CUD-003 | 在 contract 中定义 advisory CUD lifecycle fields 和 status vocabulary |
| R3. 外部/本地 best-practice intake | CUD-002 | 在 contract 中定义 source_type、freshness、applicability、counter_signal、linked_gap |
| R4. Graph/provider freshness labels | CUD-004 | 在 contract 中定义 `current`、`stale`、`partial`、`definitions-only`、`unavailable`、`not-used` |
| R5. Fresh-source eval expectation | CUD-005 | 在 contract 中定义 review target 与 fresh-source eval required 字段 |

## Scope Boundaries

- 不新增 `spec-evolve`。
- 不新增 self-reflection agent profile。
- 不新增自动 rewrite / auto-upgrade system。
- 不新增 scripts 或 eval harness。
- 不修改 `.claude/`、`.codex/`、`.agents/skills/` generated runtime mirrors。
- 不让脚本判断 capability gap、CUD decision、priority 或语义有效性。
- 不把本地参考项目或外部 GitHub 项目变成 spec-first source truth。

## Graph Readiness

- target_repo: `spec-first`
- status: `stale`
- source_revision: `.spec-first/graph/provider-status.json` 中 provider snapshot 指向旧 commit，Cycle 0 报告已标记 degraded
- current_revision: `fa49220c2442c86d6082b1480a6641d66000adaa`
- stale: `true`
- primary_providers: `gitnexus`, `code-review-graph`
- degraded_providers: graph facts stale / partial for prose workflow concepts
- fallback_capabilities: bounded direct source reads, current reports, docs contracts
- runtime_mcp_evidence: Cycle 0 GitNexus query 对 prose workflow 未返回可用 processes
- confidence: medium
- limitations: 本计划为 docs/prose contract 修复，不依赖图谱做强证据；图谱状态只作为 freshness 边界输入

## Implementation Units

### U1. Add Self-Reflection Contract

- Files:
  - `docs/contracts/workflows/self-reflection-capability-upgrade.md`
- Goal: 覆盖 report set、metadata、evidence intake、provider freshness、capability gap、CUD、plan handoff、review、compound 和 next-cycle input。
- Verification:
  - contract 明确 5 个 Accepted CUD 的落点。
  - contract 明确 skipped/deferred 项不是当前实现范围。
  - contract 明确 script-owned facts 与 LLM-owned judgment。

### U2. Link Contract Into Source Index And Prompt

- Files:
  - `docs/README.md`
  - `docs/10-prompt/自我进化.md`
- Goal: 让未来运行者能从 source-of-truth index 和 prompt 入口发现 contract。
- Verification:
  - `docs/README.md` Source Of Truth 表包含新 contract。
  - Prompt 顶部说明 contract 是稳定报告结构，角色契约仍是最高判断基线。

### U3. Close Cycle 0 Handoff

- Files:
  - `docs/2026-05-05-self-reflection-upgrade/05-prioritized-roadmap.md`
  - `docs/2026-05-05-self-reflection-upgrade/06-next-self-reflection-input.md`
  - `CHANGELOG.md`
- Goal: 把 CUD-001..005 的 plan handoff 和 source fix 结果回写到 Cycle 0 active artifact。
- Verification:
  - roadmap 仍只基于 Accepted CUD。
  - next-cycle input 能检查 contract 是否被 review / compound，而不是重复等待 plan handoff。
  - changelog 记录 source 变更。

## Review Plan

- 对新增 contract 和相关链接执行 `spec-doc-review`。直接进入当前宿主的 doc-review workflow 时，其 documented persona-reviewer phase 默认由 workflow invocation 授权；是否 dispatch 由 host capability、runtime availability、用户是否显式 no-agents / report-only、以及安全边界决定。
- 如果 reviewer dispatch primitive 不可用、runtime 无法调用，或用户显式禁用 helper agents，才执行 single-agent report-only fallback，并在 review artifact 中记录原因。
- Review 重点：
  - 是否仍保持 Light contract。
  - 是否避免 `spec-evolve` / runtime workflow / hidden state。
  - 是否清楚区分 deterministic checks 和 semantic decisions。
  - 是否让 plan/review/compound handoff 可追踪但不变成状态机。

## Compound Plan

如果 review 后确认本次修复形成可复用 pattern，则沉淀一条 `docs/solutions/` knowledge-track 文档。若 review 发现 contract 仍不稳定，则只记录 `compound_expected`，不提前写学习文档。

## Completion Evidence

- Source contract: `docs/contracts/workflows/self-reflection-capability-upgrade.md`
- Review gate: `docs/validation/2026-05-05-self-reflection-contract-doc-review.md`
- Compound record: `docs/solutions/workflow-issues/self-reflection-cud-contract-loop-2026-05-05.md`
- Runtime generated directories: unchanged

## Verification

Commands:

- `find docs/2026-05-05-self-reflection-upgrade -maxdepth 1 -type f | sort`
- `rg -n "self-reflection-capability-upgrade|CUD-001|fresh-source|current\\|stale|compound_expected" docs`
- `git status --short .claude .codex .agents/skills`
- `python3 scripts/validate-frontmatter.py /Users/kuang/xiaobu/spec-first/docs/solutions/workflow-issues/self-reflection-cud-contract-loop-2026-05-05.md` from `skills/spec-compound/`

Not planned:

- `npm test`，因为本计划不改 CLI、scripts、runtime generation 或 tests。
- fresh-source eval，除非后续实际修改 skill/agent/source workflow prose。本计划新增 docs contract 和 prompt link，不改变当前 host runtime behavior。
