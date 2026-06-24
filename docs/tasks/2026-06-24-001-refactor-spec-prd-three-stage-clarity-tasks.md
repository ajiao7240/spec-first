---
title: "spec-prd product-expert-led clarification task pack"
type: "task-pack"
status: "derived"
date: "2026-06-24"
spec_id: "2026-06-24-002-spec-prd-product-expert-led-clarification"
source_plan: "docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md"
source_plan_hash: "sha256:1bae8a819bf054879ce387736104a63c1ed0423520e84ba4a72812e4d3f8a98c"
generated_by: "spec-write-tasks"
mode: "derived"
target_repo: "spec-first"
source_sections:
  - "Problem Frame"
  - "Target Architecture"
  - "Product Expert Lens Contract"
  - "Requirements"
  - "Implementation Units"
  - "Risks And Controls"
  - "Completion Criteria"
---

# Task Pack: spec-prd product-expert-led clarification

## Overview

本任务包将 source plan 拆成 8 个串行执行任务，执行顺序按方案声明的逻辑链路保持为 `U1 -> U2 -> U7 -> U6 -> U8 -> U3 -> U4 -> U5`。拆分重点不是机械复制 U-ID，而是先稳定 Product Expert Lens 单一真相源与默认热路径，再接入低频 trigger-only 分支，最后用 readiness、eval、fresh-source eval 和文档收口。

任务包不改变方案 scope：`$spec-prd` 仍是单一公开 workflow；Product Expert Lens 是 first-class internal flow layer；`design-source-evidence.md` 与 `large-input-checkpoint.md` 是 trigger-only references；不新增 public workflow、持久 design-source artifact、progress schema、第二 PRD topology，且不手改 generated runtime mirrors。

## Source Summary

- **Source plan:** `docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md`
- **Task-ready branch:** `compile`。计划已有 `spec_id`、明确 source/runtime 边界、14 条 Requirements、8 个 U-ID、目标文件、测试面和完成标准。
- **Consumed sections:** Problem Frame、Target Architecture、Product Expert Lens Contract、Requirements、Implementation Units、Risks And Controls、Completion Criteria。
- **Scope boundaries shaping split:** 不新增 `$spec-product-expert`；不把 product reviewer 作为默认依赖；不扩展 `docs/contracts/project-graph-consumption.md`；不把 Figma MCP 作为 required baseline；不新增 transcript/progress schema；不保留两份 product lens canonical surface。
- **Implementation-time unknowns:** `product-judgment` coverage tag 是否进入 required quality buckets；runtime regeneration 的最终 diff 范围；fresh-source eval 是否因当前 host 缺少可用 dispatch primitive 而只能记录 not-run；README 不在 source plan U5 / T008 files 范围内；若执行中发现用户手册外仍有 README 或其他用户可见入口漂移，**停止并返回 source plan / task-pack 更新授权**，不在 task-pack 授权外直接改 README（derived task-pack 不得新增 source plan 未列的文件 scope）。`source topology` / `examples.json source_refs` 必须随 reference 创建分阶段推进（U1 后 11/7，U7 后 12/8，U8 终态 13/9），不能在 T001/T002 提前列入尚未创建的分支 reference。

## Traceability Matrix

| Source | Requirement / Acceptance | Task(s) | Validation |
| --- | --- | --- | --- |
| U1 | R1, R2, R4, R6, R7, R13 | T001 | canonical lens source、旧 Adaptive 命名迁移、U1 后 source topology 11/7、readiness canonical 断言 |
| U2 | R1, R2, R3, R6, R7 | T002 | SKILL 热路径默认加载 product lens、grill 按 Lens 排序消费、不提前加入 U7/U8 分支 reference |
| U7 | R2, R4, R10, R11, R12 | T003 | Figma/design-source URL/tool/auth/fetch/degrade/advisory/reconciliation/headless 边界、Design Hook 按名引用 single source、source topology 推进到 12/8 |
| U6 | R4, R9 | T004 | 成型输入综合、HOW 降级、无 `to-prd` 字段表、eval case |
| U8 | R13, R14 | T005 | Large-Input Map-Reduce 接 Lens、PRD checkpoint/resume、source_ref degraded fallback、external interface vs internal implementation、source topology 终态 13/9 |
| U3 | R5 | T006 | closeout 三项锚点、`planning_would_invent_what` 边界、script/LLM 语义边界 |
| U4 | R2, R3, R5, R6 | T007 | product-judgment eval cases、expected/must_not、防 naming-only |
| U5 | R8 | T008 | 用户手册、CHANGELOG、fresh-source eval、runtime regeneration 说明 |

所有 R1-R14 至少由一个 task 覆盖。风险表中的 progressive disclosure、light contract、provider boundary、context-loss 和 maintainer-local Figma fact 泄漏风险分别落入 T001/T002/T003/T005/T008 的 `stop_if` 与 `risk_note`。

## Task Graph

- **T001** 建立 Product Expert Lens 单一真相源，是后续所有消费链的 foundation；只推进 product lens 创建后的 topology/test 到 11/7，不提前声明尚未创建的分支 reference。
- **T002** 在默认热路径接入 Lens，并让 grill 只消费排序接口，不复制 Lens 维度；只加入 `product-expert-lens.md` 默认引用，不在本任务加入 design-source / large-input trigger refs。
- **T003** 接入 design-source/Figma trigger-only 分支，依赖 T001/T002 的 Lens 指针和热路径边界；同时创建文件、加入 SKILL trigger-only 引用、把 topology/test 原子推进到 12/8。
- **T004** 完成成型输入综合与 HOW 降级，依赖 Product Expert Lens 已存在且 write-in 能引用它。
- **T005** 完成长链路/超大输入 checkpoint 与 resume，依赖 Lens、write-in 和 trigger-only 边界已稳定；同时创建文件、加入 SKILL trigger-only 引用、把 topology/test 推进到终态 13/9，并保持 large-input external interface 与 internal implementation 分离。
- **T006** 强化 readiness closeout，依赖前面各类 closure/checkpoint 信息已有落点。
- **T007** 增加 eval 覆盖，覆盖 T001-T006 的行为锚点。
- **T008** 做用户文档、CHANGELOG、fresh-source eval 和 runtime regeneration 收口，依赖全部 source 行为变更完成。

## Execution Waves

- **Wave 1:** T001
- **Wave 2:** T002
- **Wave 3:** T003
- **Wave 4:** T004
- **Wave 5:** T005
- **Wave 6:** T006
- **Wave 7:** T007
- **Wave 8:** T008

## Task Pack Contract

```json
{
  "schema_version": "task-pack/v1",
  "execution_waves": [
    {
      "wave": 1,
      "tasks": ["T001"]
    },
    {
      "wave": 2,
      "tasks": ["T002"]
    },
    {
      "wave": 3,
      "tasks": ["T003"]
    },
    {
      "wave": 4,
      "tasks": ["T004"]
    },
    {
      "wave": 5,
      "tasks": ["T005"]
    },
    {
      "wave": 6,
      "tasks": ["T006"]
    },
    {
      "wave": 7,
      "tasks": ["T007"]
    },
    {
      "wave": 8,
      "tasks": ["T008"]
    }
  ],
  "tasks": [
    {
      "task_id": "T001",
      "source_unit": "U1",
      "requirement_refs": ["R1", "R2", "R4", "R6", "R7", "R13"],
      "goal": "Extract Product Expert Lens into a first-class canonical reference and remove the old output-template-owned Adaptive Product Expert Lens as a second truth source.",
      "dependencies": [],
      "files": [
        "skills/spec-prd/references/product-expert-lens.md",
        "skills/spec-prd/references/prd-output-template.md",
        "skills/spec-prd/references/prd-readiness-lens.md",
        "skills/spec-prd/references/domain-language-and-decision-ledger.md",
        "tests/unit/spec-prd-contracts.test.js"
      ],
      "context_refs": [
        "docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md#U1-Extract-Product-Expert-Lens-Into-First-Class-Reference",
        "docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md#Product-Expert-Lens-Contract",
        "skills/spec-prd/references/prd-output-template.md",
        "skills/spec-prd/references/prd-readiness-lens.md",
        "tests/unit/spec-prd-contracts.test.js"
      ],
      "entry_hint": "Start by moving the existing Adaptive Product Expert Lens content into `product-expert-lens.md`, then replace output-template/readiness references with canonical links.",
      "test_focus": "U1-only source topology progression to 11/7, canonical lens reuse, Adaptive-to-Product rename anchors, no duplicate product lens fallback, and old output-template lens assertions replaced rather than layered.",
      "done_signal": "`product-expert-lens.md` is the only canonical lens source; `prd-output-template.md` and `prd-readiness-lens.md` reference it by name; focused contract tests reject old Adaptive anchors, duplicate canonical surfaces, and premature 13/9 topology before branch references exist.",
      "parallelizable": false,
      "risk_note": "Keeping the old output-template lens as a fallback would create two drifting truth sources and invalidate later tasks.",
      "review_gate": "required",
      "review_focus": "Check single-source-of-truth, replace-not-layer test updates, U1 11/7 topology staging, and that low-frequency branch details are not copied into the default lens body.",
      "stop_if": "The implementation requires retaining `prd-output-template.md` as a long-term fallback canonical lens, adding a public product-expert workflow, or listing design-source/large-input refs before their files are created.",
      "wave": 1
    },
    {
      "task_id": "T002",
      "source_unit": "U2",
      "requirement_refs": ["R1", "R2", "R3", "R6", "R7"],
      "goal": "Rewire the spec-prd entrypoint and grill integration so Product Expert Lens is loaded on the authoring hot path and Requirements Grill consumes only its minimal risk-ranked gap interface.",
      "dependencies": ["T001"],
      "files": [
        "skills/spec-prd/SKILL.md",
        "skills/spec-prd/references/grill-with-docs-integration.md",
        "tests/unit/spec-prd-contracts.test.js"
      ],
      "context_refs": [
        "docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md#U2-Rewire-SKILL-Flow-And-Load-Product-Expert-Lens-On-The-Hot-Path",
        "docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md#Product-Expert-Lens-Interface-Invariants",
        "skills/spec-prd/SKILL.md#Reference-Trigger-Map",
        "skills/spec-prd/references/grill-with-docs-integration.md"
      ],
      "entry_hint": "Update the Reference Trigger Map with only the hot-path `product-expert-lens.md` reference, then add the smallest possible grill handoff sentence that says Lens ranking drives the next owner question.",
      "test_focus": "Default authoring loads `product-expert-lens.md`; design-source and large-input branch references are not added in U2; grill does not copy Product Expert Lens dimensions.",
      "done_signal": "Contract tests prove the hot-path lens reference exists, branch references are deferred to U7/U8, and grill consumes Lens ordering without becoming a second lens source.",
      "parallelizable": false,
      "risk_note": "Overwriting `SKILL.md` with branch protocols would reintroduce the sprawl problem the plan explicitly fixed.",
      "review_gate": "required",
      "review_focus": "Check progressive disclosure, front-140-line anchor stability, no premature branch reference insertion, dispatch boundary wording, and one-question-at-a-time grill behavior preservation.",
      "stop_if": "The task needs to relax SKILL entrypoint guard tests without a source-plan update, add design-source/large-input trigger refs in U2, or duplicate Product Expert Lens dimensions inside `grill-with-docs-integration.md`.",
      "wave": 2
    },
    {
      "task_id": "T003",
      "source_unit": "U7",
      "requirement_refs": ["R2", "R4", "R10", "R11", "R12"],
      "goal": "Add the trigger-only design-source evidence path for front-end/UI PRDs with Figma or other design sources while keeping provider facts advisory and run-local.",
      "dependencies": ["T001", "T002"],
      "files": [
        "skills/spec-prd/references/design-source-evidence.md",
        "skills/spec-prd/references/product-expert-lens.md",
        "skills/spec-prd/references/prd-output-template.md",
        "skills/spec-prd/SKILL.md",
        "skills/spec-prd/evals/examples.json",
        "tests/unit/spec-prd-contracts.test.js"
      ],
      "context_refs": [
        "docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md#U7-Consume-External-Design-Source-Figma-As-Capability-Class-Evidence",
        "docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md#Progressive-Disclosure-Boundary",
        "skills/spec-prd/SKILL.md#Capability-Class-Evidence-Boundary",
        "docs/contracts/project-graph-consumption.md"
      ],
      "entry_hint": "Create `design-source-evidence.md` as the detailed protocol, add its SKILL trigger-only reference in the same task, and leave only provider-neutral pointers in Product Expert Lens and the hot path.",
      "test_focus": "URL parse/tool discovery/auth probe/fetch-or-degrade flow, advisory evidence posture, external interface vs internal probe trace split, Design Hook named-reference single source, source topology progression to 12/8, no maintainer-local Figma facts, no OS-specific install commands, and headless no-fetch.",
      "done_signal": "Contract/eval coverage proves design-source is trigger-only, Figma is optional per-run/per-user/per-host/per-OS evidence, PRD output template does not copy the design WHAT extraction list, failures degrade to Planning Recheck/reference-claim, topology reaches 12/8, and `project-graph-consumption.md` remains unchanged.",
      "parallelizable": false,
      "risk_note": "Treating Figma as confirmed scope authority or as a setup baseline would leak provider state into the PRD contract.",
      "review_gate": "required",
      "review_focus": "Check provider boundary, cross-platform degraded modes, Design Hook single-source reference, no PRD/Figma/source consistency audit, and no `project-graph-consumption.md` edits.",
      "stop_if": "The design requires modifying `docs/contracts/project-graph-consumption.md`, installing MCP from spec-prd, hard-coding platform-specific setup commands, persisting a design-source artifact, copying the design WHAT extraction list into `prd-output-template.md`, or jumping topology to 13/9 before U8.",
      "wave": 3
    },
    {
      "task_id": "T004",
      "source_unit": "U6",
      "requirement_refs": ["R4", "R9"],
      "goal": "Standardize structured-input synthesis so already-decided PRDs, design docs, or conversation summaries are written into standard PRD sections while implementation/testing decisions are demoted to HOW.",
      "dependencies": ["T001", "T002", "T003"],
      "files": [
        "skills/spec-prd/references/prd-output-template.md",
        "skills/spec-prd/references/product-expert-lens.md",
        "skills/spec-prd/evals/examples.json",
        "tests/unit/spec-prd-contracts.test.js"
      ],
      "context_refs": [
        "docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md#U6-Standardize-Structured-Input-Synthesis-And-HOW-Demotion",
        "skills/spec-prd/references/prd-output-template.md",
        "skills/spec-prd/references/product-expert-lens.md"
      ],
      "entry_hint": "Add the reverse case beside existing gap-to-target mapping: structured input is synthesized and filtered, not treated as missing-WHAT by default.",
      "test_focus": "Already-structured inputs are not over-questioned, HOW is demoted unless it changes scope/acceptance/source-of-truth, and no `to-prd` adapter name or fixed field table appears.",
      "done_signal": "Contract/eval coverage proves implementation-heavy or already-decided inputs become PRD write targets without re-asking settled WHAT and without introducing a `to-prd` field map.",
      "parallelizable": false,
      "risk_note": "Recreating `to-prd` as a named adapter would add the coupling the plan explicitly rejected.",
      "review_gate": "required",
      "review_focus": "Check WHAT/HOW boundary, write-target mapping, and absence of issue-tracker/no-interview/to-prd field-table leakage.",
      "stop_if": "The implementation needs a new PRD Writer Adapter abstraction, a fixed `to-prd` mapping table, or a second output artifact.",
      "wave": 4
    },
    {
      "task_id": "T005",
      "source_unit": "U8",
      "requirement_refs": ["R13", "R14"],
      "goal": "Add long-chain and large-input checkpoint discipline so Map-Reduce reduced candidates feed Product Expert Lens and PRD drafts serve as recoverable checkpoints for resume-prd.",
      "dependencies": ["T001", "T002", "T003", "T004"],
      "files": [
        "skills/spec-prd/references/large-input-checkpoint.md",
        "skills/spec-prd/SKILL.md",
        "skills/spec-prd/references/prd-output-template.md",
        "skills/spec-prd/references/prd-readiness-lens.md",
        "skills/spec-prd/evals/examples.json",
        "tests/unit/spec-prd-contracts.test.js"
      ],
      "context_refs": [
        "docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md#U8-Long-Chain-PRD-Checkpoint-And-Resume-Discipline",
        "docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md#Large-Input-Coordination-Map-Reduce--Lens",
        "docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md#Long-Chain-Checkpoint-And-Resume",
        "skills/spec-prd/references/domain-language-and-decision-ledger.md"
      ],
      "entry_hint": "Put the full Map-Reduce-to-Lens-to-checkpoint flow in `large-input-checkpoint.md`, add its SKILL trigger-only reference in the same task, and only add size/chain write-timing pointers to output/readiness surfaces.",
      "test_focus": "Reduce output feeds Lens risk ordering, checkpoint writes use existing PRD sections with evidence tag/confirmation posture/source_ref, ordinary short PRDs still write after closure, resume prefers source_ref with degraded re-reduce fallback, external interface fields are visible, internal Map/Shuffle/Reduce details stay private, and topology reaches final 13/9.",
      "done_signal": "Contract/eval coverage proves checkpoint and resume behavior without transcript/progress schema, `large-input-checkpoint.md` remains trigger-only rather than ordinary PRD authoring, callers consume only the external interface, and topology reaches final 13/9 only after the file exists.",
      "parallelizable": false,
      "risk_note": "Adding a second progress file or transcript would violate the single-artifact topology and make PRD progress non-derivable from the PRD itself. Cross-workflow gap (out of scope, must not be silently assumed fixed): reduced candidates degraded into `Planning Recheck` rely on spec-plan re-confirming advisory items before selecting HOW, but spec-plan currently does not honor that named re-confirm semantic (see plan Downstream Consumption Contract); this task-pack does not fix it — the degrade exit may be ineffective until spec-plan adds re-confirm support, so do not treat 'written into Planning Recheck' as 'downstream re-confirmed'.",
      "review_gate": "required",
      "review_focus": "Check write-timing axes, source_ref recovery limits, external-interface/internal-implementation split, no new schema/columns, no internal algorithm test lock, and no ordinary-path checkpoint pollution.",
      "stop_if": "The implementation requires a persistent progress schema, transcript artifact, vector reducer, making checkpoint mandatory for ordinary short PRDs, or locking Map/Shuffle/Reduce internal algorithms in contract tests.",
      "wave": 5
    },
    {
      "task_id": "T006",
      "source_unit": "U3",
      "requirement_refs": ["R5"],
      "goal": "Strengthen PRD closeout and readiness so handoff explicitly states which downstream confirmations were eliminated, which remain carried, and whether planning would still invent WHAT.",
      "dependencies": ["T001", "T002", "T003", "T004", "T005"],
      "files": [
        "skills/spec-prd/references/prd-readiness-lens.md",
        "skills/spec-prd/references/prd-output-template.md",
        "skills/spec-prd/SKILL.md",
        "tests/unit/spec-prd-contracts.test.js"
      ],
      "context_refs": [
        "docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md#U3-Strengthen-PRD-Closeout-And-Readiness",
        "skills/spec-prd/references/prd-readiness-lens.md",
        "skills/spec-prd/references/prd-output-template.md"
      ],
      "entry_hint": "Extend existing `planning_would_invent_what` and readiness outcome anchors; do not add script-owned semantic computation.",
      "test_focus": "Closeout includes Resolved before planning, Still carried, and `planning_would_invent_what`; open load-bearing WHAT gaps prevent ready-for-planning; scripts do not compute semantic readiness.",
      "done_signal": "Focused contract tests prove the three closeout anchors exist and readiness cannot silently pass unresolved load-bearing gaps.",
      "parallelizable": false,
      "risk_note": "Letting deterministic artifact checks compute downstream confirmation reduction would move LLM-owned semantic judgment into scripts.",
      "review_gate": "required",
      "review_focus": "Check script/LLM boundary, reuse of existing readiness anchors, and handoff entropy wording.",
      "stop_if": "The implementation needs `check-prd-artifact.js` or another script to decide `planning_would_invent_what` semantically.",
      "wave": 6
    },
    {
      "task_id": "T007",
      "source_unit": "U4",
      "requirement_refs": ["R2", "R3", "R5", "R6"],
      "goal": "Add product-judgment eval coverage that detects real behavior changes rather than Product Expert Lens naming-only drift.",
      "dependencies": ["T001", "T002", "T003", "T004", "T005", "T006"],
      "files": [
        "skills/spec-prd/evals/examples.json",
        "tests/unit/spec-prd-contracts.test.js"
      ],
      "context_refs": [
        "docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md#U4-Add-Evals-For-Product-Judgment-Quality",
        "skills/spec-prd/evals/examples.json",
        "skills/spec-prd/scripts/run-evals.js"
      ],
      "entry_hint": "Add cases with explicit expected and must_not assertions, then decide whether `product-judgment` becomes a required quality bucket or remains extra coverage.",
      "test_focus": "Product gaps detected before owner questions, grill questions bind to write targets, readiness closeout names eliminated/carried confirmations, inline escalation critique names risk/write target, missing dispatch authorization never spawns reviewer, and a naming-only counter-example fixture (same Product Expert Lens wording, empty judgment) is rejected by the eval so the suite proves it guards against naming-only drift, not just wording drift.",
      "done_signal": "Eval fixtures include product-judgment coverage with expected/must_not assertions and contract tests prove the coverage tags and anti-pattern guards are present.",
      "parallelizable": false,
      "risk_note": "String fixtures can prevent drift but cannot prove semantic behavior; fresh-source eval remains required in T008.",
      "review_gate": "optional",
      "review_focus": "Check fixture quality, no overfitting to exact wording, and no accidental required-bucket mismatch.",
      "stop_if": "Making the eval pass requires weakening source-first, dispatch-boundary, or readiness anti-pattern assertions.",
      "wave": 7
    },
    {
      "task_id": "T008",
      "source_unit": "U5",
      "requirement_refs": ["R8"],
      "goal": "Update user documentation and changelog, record fresh-source eval evidence, and regenerate host runtime mirrors only through the generator if source changes require it.",
      "dependencies": ["T001", "T002", "T003", "T004", "T005", "T006", "T007"],
      "files": [
        "docs/05-用户手册/22-PRD需求文档质量增强流程.md",
        "docs/validation/spec-prd/fresh-source-eval-2026-06-24-product-expert-lens.md",
        "CHANGELOG.md"
      ],
      "context_refs": [
        "docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md#U5-User-Docs-Changelog-Runtime-Fresh-Source-Eval",
        "docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md#Downstream-Consumption-Contract",
        "docs/contracts/workflows/fresh-source-eval-checklist.md",
        "docs/05-用户手册/22-PRD需求文档质量增强流程.md",
        "CHANGELOG.md"
      ],
      "entry_hint": "Run the focused source/eval checks first, then write the user-facing explanation and fresh-source eval report from actual evidence.",
      "test_focus": "Contract tests, eval runner, changelog format, fresh-source eval coverage for inline critique/grill ordering/checkpoint-resume, and generator-only runtime refresh.",
      "done_signal": "User docs explain the Product Expert Lens -> Requirements Grill -> Standard PRD Write-In -> Readiness Lens flow, CHANGELOG records all source changes, fresh-source eval is passed or honestly not-run with reason — and when not-run, the delivery must record in the fresh-source eval report and closeout that 'product-judgment capability is unverified, naming-only residual risk remains', must not claim semantic verification passed, and must flag this residual risk so the downstream shipping/doc review inspects it — because fresh-source eval is the only semantic gate and `$spec-prd` default-inline + frequent missing dispatch makes not-run the most likely path (this is a residual-risk record, not a task-pack approval/execution state; review_gate stays review intent only); the user docs / changelog record the Downstream Consumption Contract as a documented handoff boundary (closeout three-items are same-session handoff; cross-session downstream infers readiness from persistent PRD sections; the spec-plan Planning Recheck re-confirm dependency is an out-of-scope cross-workflow note, not assumed fixed); and any runtime mirror changes come only from `spec-first init`.",
      "parallelizable": false,
      "risk_note": "Skipping fresh-source eval would leave only string-level proof and miss the plan's main naming-only failure mode.",
      "review_gate": "required",
      "review_focus": "Check user-visible docs, changelog completeness, fresh-source eval honesty, and no hand-edited generated runtime mirrors.",
      "stop_if": "Fresh-source eval cannot be run and no explicit not-run reason/residual risk is recorded, or generated mirrors require manual edits.",
      "wave": 8
    }
  ]
}
```

## Task Cards

- T001
  source_unit: U1
  requirement_refs:
    - R1
    - R2
    - R4
    - R6
    - R7
    - R13
  goal: Extract Product Expert Lens into a first-class canonical reference and remove the old output-template-owned Adaptive Product Expert Lens as a second truth source.
  dependencies: []
  files:
    - skills/spec-prd/references/product-expert-lens.md
    - skills/spec-prd/references/prd-output-template.md
    - skills/spec-prd/references/prd-readiness-lens.md
    - skills/spec-prd/references/domain-language-and-decision-ledger.md
    - tests/unit/spec-prd-contracts.test.js
  context_refs:
    - docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md#U1-Extract-Product-Expert-Lens-Into-First-Class-Reference
    - docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md#Product-Expert-Lens-Contract
    - skills/spec-prd/references/prd-output-template.md
    - skills/spec-prd/references/prd-readiness-lens.md
    - tests/unit/spec-prd-contracts.test.js
  entry_hint: Start by moving the existing Adaptive Product Expert Lens content into `product-expert-lens.md`, then replace output-template/readiness references with canonical links.
  test_focus: U1-only source topology progression to 11/7, canonical lens reuse, Adaptive-to-Product rename anchors, no duplicate product lens fallback, and old output-template lens assertions replaced rather than layered.
  done_signal: `product-expert-lens.md` is the only canonical lens source; `prd-output-template.md` and `prd-readiness-lens.md` reference it by name; focused contract tests reject old Adaptive anchors, duplicate canonical surfaces, and premature 13/9 topology before branch references exist.
  parallelizable: false
  risk_note: Keeping the old output-template lens as a fallback would create two drifting truth sources and invalidate later tasks.
  review_gate: required
  review_focus: Check single-source-of-truth, replace-not-layer test updates, U1 11/7 topology staging, and that low-frequency branch details are not copied into the default lens body.
  stop_if: The implementation requires retaining `prd-output-template.md` as a long-term fallback canonical lens, adding a public product-expert workflow, or listing design-source/large-input refs before their files are created.
  wave: 1

- T002
  source_unit: U2
  requirement_refs:
    - R1
    - R2
    - R3
    - R6
    - R7
  goal: Rewire the spec-prd entrypoint and grill integration so Product Expert Lens is loaded on the authoring hot path and Requirements Grill consumes only its minimal risk-ranked gap interface.
  dependencies:
    - T001
  files:
    - skills/spec-prd/SKILL.md
    - skills/spec-prd/references/grill-with-docs-integration.md
    - tests/unit/spec-prd-contracts.test.js
  context_refs:
    - docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md#U2-Rewire-SKILL-Flow-And-Load-Product-Expert-Lens-On-The-Hot-Path
    - docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md#Product-Expert-Lens-Interface-Invariants
    - skills/spec-prd/SKILL.md#Reference-Trigger-Map
    - skills/spec-prd/references/grill-with-docs-integration.md
  entry_hint: Update the Reference Trigger Map with only the hot-path `product-expert-lens.md` reference, then add the smallest possible grill handoff sentence that says Lens ranking drives the next owner question.
  test_focus: Default authoring loads `product-expert-lens.md`; design-source and large-input branch references are not added in U2; grill does not copy Product Expert Lens dimensions.
  done_signal: Contract tests prove the hot-path lens reference exists, branch references are deferred to U7/U8, and grill consumes Lens ordering without becoming a second lens source.
  parallelizable: false
  risk_note: Overwriting `SKILL.md` with branch protocols would reintroduce the sprawl problem the plan explicitly fixed.
  review_gate: required
  review_focus: Check progressive disclosure, front-140-line anchor stability, no premature branch reference insertion, dispatch boundary wording, and one-question-at-a-time grill behavior preservation.
  stop_if: The task needs to relax SKILL entrypoint guard tests without a source-plan update, add design-source/large-input trigger refs in U2, or duplicate Product Expert Lens dimensions inside `grill-with-docs-integration.md`.
  wave: 2

- T003
  source_unit: U7
  requirement_refs:
    - R2
    - R4
    - R10
    - R11
    - R12
  goal: Add the trigger-only design-source evidence path for front-end/UI PRDs with Figma or other design sources while keeping provider facts advisory and run-local.
  dependencies:
    - T001
    - T002
  files:
    - skills/spec-prd/references/design-source-evidence.md
    - skills/spec-prd/references/product-expert-lens.md
    - skills/spec-prd/references/prd-output-template.md
    - skills/spec-prd/SKILL.md
    - skills/spec-prd/evals/examples.json
    - tests/unit/spec-prd-contracts.test.js
  context_refs:
    - docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md#U7-Consume-External-Design-Source-Figma-As-Capability-Class-Evidence
    - docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md#Progressive-Disclosure-Boundary
    - skills/spec-prd/SKILL.md#Capability-Class-Evidence-Boundary
    - docs/contracts/project-graph-consumption.md
  entry_hint: Create `design-source-evidence.md` as the detailed protocol, add its SKILL trigger-only reference in the same task, and leave only provider-neutral pointers in Product Expert Lens and the hot path.
  test_focus: URL parse/tool discovery/auth probe/fetch-or-degrade flow, advisory evidence posture, external interface vs internal probe trace split, Design Hook named-reference single source, source topology progression to 12/8, no maintainer-local Figma facts, no OS-specific install commands, and headless no-fetch.
  done_signal: Contract/eval coverage proves design-source is trigger-only, Figma is optional per-run/per-user/per-host/per-OS evidence, PRD output template does not copy the design WHAT extraction list, failures degrade to Planning Recheck/reference-claim, topology reaches 12/8, and `project-graph-consumption.md` remains unchanged.
  parallelizable: false
  risk_note: Treating Figma as confirmed scope authority or as a setup baseline would leak provider state into the PRD contract.
  review_gate: required
  review_focus: Check provider boundary, cross-platform degraded modes, Design Hook single-source reference, no PRD/Figma/source consistency audit, and no `project-graph-consumption.md` edits.
  stop_if: The design requires modifying `docs/contracts/project-graph-consumption.md`, installing MCP from spec-prd, hard-coding platform-specific setup commands, persisting a design-source artifact, copying the design WHAT extraction list into `prd-output-template.md`, or jumping topology to 13/9 before U8.
  wave: 3

- T004
  source_unit: U6
  requirement_refs:
    - R4
    - R9
  goal: Standardize structured-input synthesis so already-decided PRDs, design docs, or conversation summaries are written into standard PRD sections while implementation/testing decisions are demoted to HOW.
  dependencies:
    - T001
    - T002
    - T003
  files:
    - skills/spec-prd/references/prd-output-template.md
    - skills/spec-prd/references/product-expert-lens.md
    - skills/spec-prd/evals/examples.json
    - tests/unit/spec-prd-contracts.test.js
  context_refs:
    - docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md#U6-Standardize-Structured-Input-Synthesis-And-HOW-Demotion
    - skills/spec-prd/references/prd-output-template.md
    - skills/spec-prd/references/product-expert-lens.md
  entry_hint: Add the reverse case beside existing gap-to-target mapping: structured input is synthesized and filtered, not treated as missing-WHAT by default.
  test_focus: Already-structured inputs are not over-questioned, HOW is demoted unless it changes scope/acceptance/source-of-truth, and no `to-prd` adapter name or fixed field table appears.
  done_signal: Contract/eval coverage proves implementation-heavy or already-decided inputs become PRD write targets without re-asking settled WHAT and without introducing a `to-prd` field map.
  parallelizable: false
  risk_note: Recreating `to-prd` as a named adapter would add the coupling the plan explicitly rejected.
  review_gate: required
  review_focus: Check WHAT/HOW boundary, write-target mapping, and absence of issue-tracker/no-interview/to-prd field-table leakage.
  stop_if: The implementation needs a new PRD Writer Adapter abstraction, a fixed `to-prd` mapping table, or a second output artifact.
  wave: 4

- T005
  source_unit: U8
  requirement_refs:
    - R13
    - R14
  goal: Add long-chain and large-input checkpoint discipline so Map-Reduce reduced candidates feed Product Expert Lens and PRD drafts serve as recoverable checkpoints for resume-prd.
  dependencies:
    - T001
    - T002
    - T003
    - T004
  files:
    - skills/spec-prd/references/large-input-checkpoint.md
    - skills/spec-prd/SKILL.md
    - skills/spec-prd/references/prd-output-template.md
    - skills/spec-prd/references/prd-readiness-lens.md
    - skills/spec-prd/evals/examples.json
    - tests/unit/spec-prd-contracts.test.js
  context_refs:
    - docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md#U8-Long-Chain-PRD-Checkpoint-And-Resume-Discipline
    - docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md#Large-Input-Coordination-Map-Reduce--Lens
    - docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md#Long-Chain-Checkpoint-And-Resume
    - skills/spec-prd/references/domain-language-and-decision-ledger.md
  entry_hint: Put the full Map-Reduce-to-Lens-to-checkpoint flow in `large-input-checkpoint.md`, add its SKILL trigger-only reference in the same task, and only add size/chain write-timing pointers to output/readiness surfaces.
  test_focus: Reduce output feeds Lens risk ordering, checkpoint writes use existing PRD sections with evidence tag/confirmation posture/source_ref, ordinary short PRDs still write after closure, resume prefers source_ref with degraded re-reduce fallback, external interface fields are visible, internal Map/Shuffle/Reduce details stay private, and topology reaches final 13/9.
  done_signal: Contract/eval coverage proves checkpoint and resume behavior without transcript/progress schema, `large-input-checkpoint.md` remains trigger-only rather than ordinary PRD authoring, callers consume only the external interface, and topology reaches final 13/9 only after the file exists.
  parallelizable: false
  risk_note: Adding a second progress file or transcript would violate the single-artifact topology and make PRD progress non-derivable from the PRD itself. Cross-workflow gap (out of scope, must not be silently assumed fixed): reduced candidates degraded into `Planning Recheck` rely on spec-plan re-confirming advisory items before selecting HOW, but spec-plan currently does not honor that named re-confirm semantic (see plan Downstream Consumption Contract); this task-pack does not fix it — the degrade exit may be ineffective until spec-plan adds re-confirm support, so do not treat 'written into Planning Recheck' as 'downstream re-confirmed'.
  review_gate: required
  review_focus: Check write-timing axes, source_ref recovery limits, external-interface/internal-implementation split, no new schema/columns, no internal algorithm test lock, and no ordinary-path checkpoint pollution.
  stop_if: The implementation requires a persistent progress schema, transcript artifact, vector reducer, making checkpoint mandatory for ordinary short PRDs, or locking Map/Shuffle/Reduce internal algorithms in contract tests.
  wave: 5

- T006
  source_unit: U3
  requirement_refs:
    - R5
  goal: Strengthen PRD closeout and readiness so handoff explicitly states which downstream confirmations were eliminated, which remain carried, and whether planning would still invent WHAT.
  dependencies:
    - T001
    - T002
    - T003
    - T004
    - T005
  files:
    - skills/spec-prd/references/prd-readiness-lens.md
    - skills/spec-prd/references/prd-output-template.md
    - skills/spec-prd/SKILL.md
    - tests/unit/spec-prd-contracts.test.js
  context_refs:
    - docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md#U3-Strengthen-PRD-Closeout-And-Readiness
    - skills/spec-prd/references/prd-readiness-lens.md
    - skills/spec-prd/references/prd-output-template.md
  entry_hint: Extend existing `planning_would_invent_what` and readiness outcome anchors; do not add script-owned semantic computation.
  test_focus: Closeout includes Resolved before planning, Still carried, and `planning_would_invent_what`; open load-bearing WHAT gaps prevent ready-for-planning; scripts do not compute semantic readiness.
  done_signal: Focused contract tests prove the three closeout anchors exist and readiness cannot silently pass unresolved load-bearing gaps.
  parallelizable: false
  risk_note: Letting deterministic artifact checks compute downstream confirmation reduction would move LLM-owned semantic judgment into scripts.
  review_gate: required
  review_focus: Check script/LLM boundary, reuse of existing readiness anchors, and handoff entropy wording.
  stop_if: The implementation needs `check-prd-artifact.js` or another script to decide `planning_would_invent_what` semantically.
  wave: 6

- T007
  source_unit: U4
  requirement_refs:
    - R2
    - R3
    - R5
    - R6
  goal: Add product-judgment eval coverage that detects real behavior changes rather than Product Expert Lens naming-only drift.
  dependencies:
    - T001
    - T002
    - T003
    - T004
    - T005
    - T006
  files:
    - skills/spec-prd/evals/examples.json
    - tests/unit/spec-prd-contracts.test.js
  context_refs:
    - docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md#U4-Add-Evals-For-Product-Judgment-Quality
    - skills/spec-prd/evals/examples.json
    - skills/spec-prd/scripts/run-evals.js
  entry_hint: Add cases with explicit expected and must_not assertions, then decide whether `product-judgment` becomes a required quality bucket or remains extra coverage.
  test_focus: Product gaps detected before owner questions, grill questions bind to write targets, readiness closeout names eliminated/carried confirmations, inline escalation critique names risk/write target, missing dispatch authorization never spawns reviewer, and a naming-only counter-example fixture (same Product Expert Lens wording, empty judgment) is rejected by the eval so the suite proves it guards against naming-only drift, not just wording drift.
  done_signal: Eval fixtures include product-judgment coverage with expected/must_not assertions and contract tests prove the coverage tags and anti-pattern guards are present.
  parallelizable: false
  risk_note: String fixtures can prevent drift but cannot prove semantic behavior; fresh-source eval remains required in T008.
  review_gate: optional
  review_focus: Check fixture quality, no overfitting to exact wording, and no accidental required-bucket mismatch.
  stop_if: Making the eval pass requires weakening source-first, dispatch-boundary, or readiness anti-pattern assertions.
  wave: 7

- T008
  source_unit: U5
  requirement_refs:
    - R8
  goal: Update user documentation and changelog, record fresh-source eval evidence, and regenerate host runtime mirrors only through the generator if source changes require it.
  dependencies:
    - T001
    - T002
    - T003
    - T004
    - T005
    - T006
    - T007
  files:
    - docs/05-用户手册/22-PRD需求文档质量增强流程.md
    - docs/validation/spec-prd/fresh-source-eval-2026-06-24-product-expert-lens.md
    - CHANGELOG.md
  context_refs:
    - docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md#U5-User-Docs-Changelog-Runtime-Fresh-Source-Eval
    - docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md#Downstream-Consumption-Contract
    - docs/contracts/workflows/fresh-source-eval-checklist.md
    - docs/05-用户手册/22-PRD需求文档质量增强流程.md
    - CHANGELOG.md
  entry_hint: Run the focused source/eval checks first, then write the user-facing explanation and fresh-source eval report from actual evidence.
  test_focus: Contract tests, eval runner, changelog format, fresh-source eval coverage for inline critique/grill ordering/checkpoint-resume, and generator-only runtime refresh.
  done_signal: User docs explain the Product Expert Lens -> Requirements Grill -> Standard PRD Write-In -> Readiness Lens flow, CHANGELOG records all source changes, fresh-source eval is passed or honestly not-run with reason — and when not-run, the delivery must record in the fresh-source eval report and closeout that 'product-judgment capability is unverified, naming-only residual risk remains', must not claim semantic verification passed, and must flag this residual risk so the downstream shipping/doc review inspects it — because fresh-source eval is the only semantic gate and `$spec-prd` default-inline + frequent missing dispatch makes not-run the most likely path (this is a residual-risk record, not a task-pack approval/execution state; review_gate stays review intent only); the user docs / changelog record the Downstream Consumption Contract as a documented handoff boundary (closeout three-items are same-session handoff; cross-session downstream infers readiness from persistent PRD sections; the spec-plan Planning Recheck re-confirm dependency is an out-of-scope cross-workflow note, not assumed fixed); and any runtime mirror changes come only from `spec-first init`.
  parallelizable: false
  risk_note: Skipping fresh-source eval would leave only string-level proof and miss the plan's main naming-only failure mode.
  review_gate: required
  review_focus: Check user-visible docs, changelog completeness, fresh-source eval honesty, and no hand-edited generated runtime mirrors.
  stop_if: Fresh-source eval cannot be run and no explicit not-run reason/residual risk is recorded, or generated mirrors require manual edits.
  wave: 8

## Orientation Evidence

- **provider:** direct-repo-reads
- **posture:** bounded
- **evidence_refs:**
  - `docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md`
  - `skills/spec-write-tasks/SKILL.md`
  - `skills/spec-write-tasks/references/task-pack-schema.md`
  - `docs/tasks/2026-06-22-001-feat-user-language-sync-tasks.md`
  - `docs/tasks/2026-06-12-007-refactor-agent-native-architecture-governance-tasks.md`
  - `tests/unit/spec-prd-contracts.test.js`
  - `skills/spec-prd/SKILL.md`
- **limitations:** 未执行 semantic doc-review；任务语义质量由本 task-pack 的 human-readable sections 与后续 doc-review 判断，不由 `spec-first tasks validate` 证明。未读取 generated runtime mirrors，因为它们不是 source-of-truth。

## Validation Notes

- `source_plan_hash` 使用 `node bin/spec-first.js tasks hash docs/plans/2026-06-24-002-refactor-spec-prd-three-stage-clarity-plan.md` 计算，当前值为 `sha256:1bae8a819bf054879ce387736104a63c1ed0423520e84ba4a72812e4d3f8a98c`。
- 本任务包应通过 `node bin/spec-first.js tasks validate docs/tasks/2026-06-24-001-refactor-spec-prd-three-stage-clarity-tasks.md --json` 的 deterministic identity/freshness/structure 校验后，才作为 `spec-work` handoff。
- 关键语义验证不是任务包 validator，而是执行期的 `tests/unit/spec-prd-contracts.test.js`、`skills/spec-prd/scripts/run-evals.js`、fresh-source eval、changelog format 和 runtime generator discipline。
- **两个 source_refs 数组语义不同，勿共用计数**：`source topology` test 的 `references` 严格数组（当前 6 项，含 `evaluation-governance.md`，不含 `SKILL.md`）与 `examples.json` 的 `source_refs`（当前 6 项，含 `SKILL.md`，不含 `evaluation-governance.md`）是成员不同的两组数组。R7 的「6→9」是按各自起点 +3（新增 product-lens / design-source / large-input 三个 reference）后的终态简记，**不是同一个数组**。执行 T001/T003/T005 前先实跑 `npx jest tests/unit/spec-prd-contracts.test.js -t "source topology"` 与 `-t "eval fixtures"` 读出各自当前真实数组，分别按字母序（topology references 是字母序）或既有逻辑序（examples source_refs 非字母序）插入新成员，不要把两个数组的期望值混用。

## Regeneration Rules

如果 source plan、scope、Requirements、Implementation Units、files、verification 或本 task-pack 的 task semantics 发生变化，必须重新生成本任务包。

如果 `source_plan_hash` 与当前 source plan 不匹配，执行必须拒绝并重新派生任务包。如果 `spec_id` 与 source plan 不匹配，视为 wrong-chain handoff。如果任一任务触发 `stop_if`，返回 `spec-plan` 或重跑 `spec-write-tasks`，不要在任务执行中扩大 scope。
