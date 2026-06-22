---
title: "用户级语言偏好同步任务包"
type: "task-pack"
status: "derived"
date: "2026-06-22"
spec_id: "2026-06-22-001-user-language-sync"
source_plan: "docs/plans/2026-06-22-001-feat-user-language-sync-plan.md"
source_plan_hash: "sha256:cf82919fa868e69f15179e0de1c0a8359b5e18e46595e20f8ce770645d516fe0"
generated_by: "spec-write-tasks"
mode: "derived"
target_repo: "spec-first"
source_sections:
  - "Requirements"
  - "Scope Boundaries"
  - "Direct Evidence"
  - "Key Technical Decisions"
  - "Implementation Units"
  - "System-Wide Impact"
  - "Risks & Dependencies"
---

# Task Pack: 用户级语言偏好同步

## Overview

本任务包把 source plan 的 6 个 implementation units 编译为 7 个串行执行任务。第二轮语义审查发现 U4 同时包含新模块、路径 helper、marker 行为、collision/failure 语义、init 集成、all-repos once、dry-run/apply 集成等多个独立验证面；保留为一个任务会让反馈环过大。因此 U4 被拆成 T004(模块/路径/marker 基础) 与 T005(init 集成/运行级聚合)，其余 U1/U2/U3/U5/U6 分别保持独立闭环。

任务包不改变 plan 的 WHAT/HOW：项目级 language block 仍是 source-of-truth，用户级 sync 是显式授权后的全局副作用，user-level writes 不进入 repo-local `operationPlan`，opt-out 是 all-host cleanup。

## Source Summary

- **Source plan:** `docs/plans/2026-06-22-001-feat-user-language-sync-plan.md`
- **Task-ready branch:** `compile`。计划有 `spec_id`、`target_repo: spec-first`、14 条 requirements、明确 scope boundaries、U1-U6 文件边界、依赖链、测试清单和全局副作用风险。
- **Consumed sections:** Summary、Decision Brief、Requirements、Assumptions、Scope Boundaries、Completion Criteria、Direct Evidence Readiness、Direct Evidence、Key Technical Decisions、Implementation Units、System-Wide Impact、Risks & Dependencies、Documentation / Operational Notes。
- **Scope boundaries shaping split:** 不做无条件默认静默写用户级文件；不写 `~/.codex/AGENTS.override.md`；不用 hook 强制回答语言；不把项目治理复制到用户级；不手改 generated runtime mirrors。
- **Implementation-time unknowns:** README 更新的最终文案位置；init output 的 exact copy；是否需要扩展 focused tests 到 `npm run test:unit`；external host 是否在 fresh process 中加载 user instruction 不在本任务包内证明。
- **Freshness note:** source plan hash refreshed after the ADR / ownership / observability additions; task graph remains unchanged because those additions clarify boundaries rather than adding implementation units.

## Traceability Matrix

| Source | Requirement / Acceptance | Task(s) | Validation |
| --- | --- | --- | --- |
| U1 | R5, R7, R12, R13 | T001 | `tests/unit/lang-policy.sh` 覆盖共享 hard-execution language prose、project/user wrapper 分离、marker upsert/remove |
| U2 | R2, R3, R4, R14 | T002 | `tests/unit/developer.sh` 覆盖 `sync_user_language` parse/format/round-trip；init profile write branch 覆盖显式 preference change |
| U3 | R2, R3, R4, R8, R11, R14 | T003 | init args/help/i18n/interactive tests 覆盖 flags、prompt、non-interactive unset、dry-run/cancel 不落盘 |
| U4 | R5, R6, R7, R8, R9, R10, R14 | T004, T005 | T004 覆盖 `user-language-sync` 模块、Codex/Claude target、marker/collision/cleanup no-create；T005 覆盖 init 顶层集成、all-repos once、dry-run/apply aggregate |
| U5 | R8, R10, R11, R14 | T006 | init dry-run/apply output tests 覆盖 user-level sync section、partial success non-zero、cleanup failure retry signal |
| U6 | R1, R11, R12, R13 | T007 | README/README.zh-CN/help/CHANGELOG 更新；focused suite 与 `npm run typecheck` 通过 |

所有 R1-R14 至少由一个 task 覆盖。Scope Boundaries 不产生独立 task，而是进入各任务的 `stop_if` / `risk_note`。

## Task Graph

- **T001** 建立共享语言规则与 marker primitive，是后续 user sync 写入内容的 foundation。
- **T002** 在 developer profile 中加入 consent field，并为 init profile write 提供可持久化状态，依赖 T001 的 sync 语义。
- **T003** 把 consent 暴露为 CLI flags 与 one-time interactive prompt，依赖 T002 的 profile field。
- **T004** 新增 `user-language-sync` 模块、Codex/Claude target helper、marker/collision/cleanup 行为，依赖 T001 的 block builder 和 T002/T003 的 preference 语义。
- **T005** 把 T004 的 run-level aggregate plan 接入 `runInit` / all-repos / dry-run / apply 流，依赖 T004 的模块 API。
- **T006** 完成 preview/apply/failure output 语义，依赖 T005 的 aggregate result。
- **T007** 做 docs/changelog/verification closeout，依赖全部实现任务。

## Execution Waves

- **Wave 1:** T001
- **Wave 2:** T002
- **Wave 3:** T003
- **Wave 4:** T004
- **Wave 5:** T005
- **Wave 6:** T006
- **Wave 7:** T007

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
    }
  ],
  "tasks": [
    {
      "task_id": "T001",
      "source_unit": "U1",
      "requirement_refs": ["R5", "R7", "R12", "R13"],
      "goal": "Refactor language policy generation so project-level and user-level instruction blocks share one hard-execution language-rule source while preserving separate markers and project-only changelog/governance.",
      "dependencies": [],
      "files": [
        "src/cli/lang-policy.js",
        "tests/unit/lang-policy.sh"
      ],
      "context_refs": [
        "docs/plans/2026-06-22-001-feat-user-language-sync-plan.md#U1-Shared-Language-Policy-Helpers",
        "src/cli/lang-policy.js",
        "tests/unit/lang-policy.sh"
      ],
      "entry_hint": "Start from `buildManagedBlock`, `applyManagedBlock`, `buildZhPolicy`, and `buildEnPolicy`; introduce shared language-rule builders before adding the user wrapper.",
      "test_focus": "Shared zh/en hard-execution prose parity between project and user blocks, project-only changelog/governance retention, user block exclusion of project governance, marker upsert/remove idempotency.",
      "done_signal": "`tests/unit/lang-policy.sh` proves project and user blocks share normalized language prose, preserve distinct governance scope, and keep content outside managed markers byte-for-byte.",
      "parallelizable": false,
      "risk_note": "Leaking project changelog/governance into user-level files would turn repo-specific rules into global personal instructions.",
      "review_gate": "required",
      "review_focus": "Check shared language fragment boundaries, marker semantics, and that user-level block remains language-only.",
      "stop_if": "The implementation requires changing project-level managed marker names, copying full project governance into user-level files, or hand-editing generated runtime mirrors.",
      "wave": 1
    },
    {
      "task_id": "T002",
      "source_unit": "U2",
      "requirement_refs": ["R2", "R3", "R4", "R14"],
      "goal": "Persist user-language sync consent as `sync_user_language=true|false` in the global developer profile and make init profile-write resolution update or preserve it correctly.",
      "dependencies": ["T001"],
      "files": [
        "src/cli/developer.js",
        "src/cli/commands/init.js",
        "tests/unit/developer.sh"
      ],
      "context_refs": [
        "docs/plans/2026-06-22-001-feat-user-language-sync-plan.md#U2-Global-Developer-Profile-Consent-Field",
        "src/cli/developer.js",
        "src/cli/commands/init.js",
        "tests/unit/developer.sh"
      ],
      "entry_hint": "Add parse/normalize/format support first, then update `resolveGlobalDeveloperWriteAction` branches so explicit or interactive preference changes trigger profile writes.",
      "test_focus": "true/false/unset/invalid round-trip, false is not dropped, project-local profile does not authorize sync, unchanged name/lang/hosts still writes when preference changes.",
      "done_signal": "`tests/unit/developer.sh` passes and includes profile consent parsing plus init profile-write preservation/update coverage for `sync_user_language`.",
      "parallelizable": false,
      "risk_note": "Treating missing preference as false would silently skip the first consent prompt and make non-interactive runs persist opt-out without user intent.",
      "review_gate": "required",
      "review_focus": "Check global-only authorization, false round-trip, and host-only/name-lang overwrite branch preservation.",
      "stop_if": "The change needs a second global settings file or uses project-local developer profiles as authorization for user-level writes.",
      "wave": 2
    },
    {
      "task_id": "T003",
      "source_unit": "U3",
      "requirement_refs": ["R2", "R3", "R4", "R8", "R11", "R14"],
      "goal": "Add `--sync-user-language` / `--no-sync-user-language` flags, usage/help/i18n copy, and one-time interactive consent resolution without mutating profile or user files in dry-run/cancel paths.",
      "dependencies": ["T002"],
      "files": [
        "src/cli/commands/init.js",
        "src/cli/init-i18n.js",
        "tests/unit/init-interactive.test.js",
        "tests/unit/init-i18n.test.js",
        "tests/unit/cli-entry-contracts.test.js"
      ],
      "context_refs": [
        "docs/plans/2026-06-22-001-feat-user-language-sync-plan.md#U3-Init-CLI-Flags-and-Interactive-Consent-Flow",
        "src/cli/commands/init.js#parseInitArgs",
        "src/cli/commands/init.js#collectInitInput",
        "src/cli/init-i18n.js"
      ],
      "entry_hint": "Wire explicit flag parsing before interactive consent; keep non-interactive absent preference as `unset`, and treat prompt No as persisted false only after final apply proceeds.",
      "test_focus": "Both flags rejected together, stored true/false no prompt, explicit flags under `-y`, dry-run/cancel do not persist false, non-interactive absent stays unset, zh/en message parity.",
      "done_signal": "Init interactive/i18n/CLI entry tests cover flags, prompt timing, dry-run/cancel semantics, and help copy without touching real user files.",
      "parallelizable": false,
      "risk_note": "Persisting `sync_user_language=false` during dry-run or cancelled apply would convert preview/cancel into a real global preference mutation.",
      "review_gate": "required",
      "review_focus": "Check mutation timing, absent-vs-false distinction, and localized help/prompt copy.",
      "stop_if": "The prompt must run in non-interactive mode or opt-out cleanup must be represented as a per-host selected-host-only action.",
      "wave": 3
    },
    {
      "task_id": "T004",
      "source_unit": "U4",
      "requirement_refs": ["R5", "R6", "R7", "R8", "R9", "R10", "R14"],
      "goal": "Implement the `user-language-sync` foundation module and host path helpers outside repo-local operation plans, covering Codex/Claude target resolution, marker upsert/removal behavior, collision detection primitives, and cleanup no-create semantics.",
      "dependencies": ["T001", "T002", "T003"],
      "files": [
        "src/cli/user-language-sync.js",
        "src/cli/helpers/global-config-dir.js",
        "tests/unit/user-language-sync.test.js"
      ],
      "context_refs": [
        "docs/plans/2026-06-22-001-feat-user-language-sync-plan.md#U4-User-Language-Sync-Plan-and-Apply",
        "src/cli/helpers/global-config-dir.js",
        "src/cli/lang-policy.js"
      ],
      "entry_hint": "Create the dedicated module first and export/reuse `samePhysicalPath` plus `resolveClaudeUserInstructionPath`; keep init integration out of this task except for stable API shape needed by T005.",
      "test_focus": "CODEX_HOME-aware Codex target, Claude helper basis, enable creates missing files, cleanup never creates missing files, marker content preservation, same-physical-path collision status, and structured operation diagnostics.",
      "done_signal": "`tests/unit/user-language-sync.test.js` proves target resolution, marker behavior, cleanup no-create, collision classification, and structured diagnostics without requiring `runInit` integration.",
      "parallelizable": false,
      "risk_note": "Duplicating canonicalization or marker manipulation outside this module would create drift between user-level and project-level instruction handling.",
      "review_gate": "required",
      "review_focus": "Check path helper authority, source/runtime boundary, action-specific missing-target semantics, global opt-out cleanup, and no duplicated canonicalization logic.",
      "stop_if": "The implementation requires writing `~/.codex/AGENTS.override.md`, creating files during cleanup-only mode, or modifying generated `.claude`, `.codex`, or `.agents/skills` mirrors.",
      "wave": 4
    },
    {
      "task_id": "T005",
      "source_unit": "U4",
      "requirement_refs": ["R5", "R6", "R7", "R8", "R9", "R10", "R14"],
      "goal": "Integrate the user-language sync aggregate plan into the top-level init runner so selected-host enable/maintain, all-host opt-out cleanup, dry-run preview, apply-once semantics, and all-repos once behavior are wired without adding user writes to repo-local operation plans.",
      "dependencies": ["T004"],
      "files": [
        "src/cli/commands/init.js",
        "tests/unit/init-dry-run.test.js",
        "tests/unit/init-interactive.test.js"
      ],
      "context_refs": [
        "docs/plans/2026-06-22-001-feat-user-language-sync-plan.md#U4-User-Language-Sync-Plan-and-Apply",
        "src/cli/commands/init.js#runInit",
        "src/cli/commands/init.js#buildInitPlans"
      ],
      "entry_hint": "Wire the aggregate plan after preference resolution and project plan building; apply it exactly once from `runInit`, never from per-child or per-platform project apply helpers.",
      "test_focus": "Selected-host enable/maintain, all-host opt-out cleanup, stored-false residual cleanup, dry-run no-write, all-repos once, and no user operations inside repo-local `operationPlan`.",
      "done_signal": "Init integration tests prove the aggregate user-sync plan is built/applied once per run, not once per child repo or platform plan, and remains separate from repo-local operation plans.",
      "parallelizable": false,
      "risk_note": "Applying user sync from child/project plan paths would repeat global writes and make all-repos behavior non-deterministic.",
      "review_gate": "required",
      "review_focus": "Check aggregate ownership, all-repos once semantics, selected-host vs all-host cleanup split, and project-root containment preservation.",
      "stop_if": "User-level operations need to be inserted into `operationPlan`, child plans, parent plans, or per-host project plans.",
      "wave": 5
    },
    {
      "task_id": "T006",
      "source_unit": "U5",
      "requirement_refs": ["R8", "R10", "R11", "R14"],
      "goal": "Make init preview/apply output report user-level language sync as a distinct global side effect with per-host write/remove/noop/skipped/failed states and non-zero exit on sync failure.",
      "dependencies": ["T005"],
      "files": [
        "src/cli/commands/init.js",
        "src/cli/init-i18n.js",
        "tests/unit/init-dry-run.test.js",
        "tests/unit/init-interactive.test.js"
      ],
      "context_refs": [
        "docs/plans/2026-06-22-001-feat-user-language-sync-plan.md#U5-Preview-Apply-Output-and-Failure-Reporting",
        "src/cli/commands/init.js#printInitPreviews",
        "src/cli/commands/init.js#printInitApplySuccess",
        "src/cli/init-i18n.js"
      ],
      "entry_hint": "Add output rendering after T005 aggregate integration exists; propagate user-sync status into the top-level run result so diagnostics are not lost behind project init success.",
      "test_focus": "Dry-run includes user-level sync section, no-consent output does not claim sync, opt-out reports all-host removals, write/removal failure exits non-zero and avoids false success wording.",
      "done_signal": "Focused init output tests prove visible global-side-effect reporting and fail-loud behavior for single-repo and all-repos modes.",
      "parallelizable": false,
      "risk_note": "Printing diagnostics while returning exit 0 would let users believe global language sync succeeded when it actually failed.",
      "review_gate": "required",
      "review_focus": "Check partial-success wording, reason codes, all-repos summary behavior, and no noisy absolute-path docs leakage.",
      "stop_if": "Output needs to claim hook-level enforcement of language or suppress user-sync failures to keep project init green.",
      "wave": 6
    },
    {
      "task_id": "T007",
      "source_unit": "U6",
      "requirement_refs": ["R1", "R11", "R12", "R13"],
      "goal": "Update README, README.zh-CN, help-facing documentation, and CHANGELOG, then run the focused verification suite and expand to unit tests if shared init contracts changed broadly.",
      "dependencies": ["T001", "T002", "T003", "T004", "T005", "T006"],
      "files": [
        "README.md",
        "README.zh-CN.md",
        "CHANGELOG.md"
      ],
      "context_refs": [
        "docs/plans/2026-06-22-001-feat-user-language-sync-plan.md#U6-Documentation-Changelog-and-Verification-Pass",
        "README.md",
        "README.zh-CN.md",
        "CHANGELOG.md"
      ],
      "entry_hint": "Keep docs concise: explain project-level vs user-level instruction files, opt-in/opt-out flags, Codex/Claude targets, and that hooks do not enforce natural-language output.",
      "test_focus": "Docs mention opt-in and opt-out; changelog format passes; changed JS files pass `node --check`; focused lang/developer/init/user-sync tests pass.",
      "done_signal": "README/README.zh-CN/help-facing copy and CHANGELOG describe the user-visible behavior; focused verification commands from the source plan pass, with `npm run test:unit` added if init contract impact proves broad.",
      "parallelizable": false,
      "risk_note": "Docs must not promise perfect language enforcement or imply hook-based enforcement; current sessions may cache old instructions.",
      "review_gate": "required",
      "review_focus": "Check docs accuracy, `(user-visible)` changelog marking, verification scope, and explicit generated runtime impact statement.",
      "stop_if": "Documentation needs to describe full project governance in user-level files or claim external host runtime loading was deterministically verified when it was not.",
      "wave": 7
    }
  ]
}
```

## Task Cards

### T001 — Shared Language Policy Helpers

- source_unit: U1
- requirement_refs: R5, R7, R12, R13
- files: `src/cli/lang-policy.js`, `tests/unit/lang-policy.sh`
- context_refs: plan U1, current `lang-policy.js`, current language policy tests
- verification focus: shared hard-execution language fragment, separate project/user wrappers, user-language markers, upsert/remove semantics
- stop_if: project governance must be copied to user-level files or runtime mirrors must be hand-edited

### T002 — Global Developer Profile Consent Field

- source_unit: U2
- requirement_refs: R2, R3, R4, R14
- files: `src/cli/developer.js`, `src/cli/commands/init.js`, `tests/unit/developer.sh`
- context_refs: plan U2, developer profile parsing/formatting, init global profile write resolution
- verification focus: `sync_user_language` true/false/unset, invalid value handling, explicit preference writes even when identity is unchanged
- stop_if: non-global profile data would authorize user-level writes

### T003 — Init CLI Flags and Interactive Consent Flow

- source_unit: U3
- requirement_refs: R2, R3, R4, R8, R11, R14
- files: `src/cli/commands/init.js`, `src/cli/init-i18n.js`, `tests/unit/init-interactive.test.js`, `tests/unit/init-i18n.test.js`, `tests/unit/cli-entry-contracts.test.js`
- context_refs: plan U3, `parseInitArgs`, `collectInitInput`, init i18n messages
- verification focus: explicit flags, prompt timing, non-interactive unset, dry-run/cancel no mutation, zh/en parity
- stop_if: opt-out cleanup is limited only to selected host or dry-run persists false

### T004 — User Language Sync Foundation Module

- source_unit: U4
- requirement_refs: R5, R6, R7, R8, R9, R10, R14
- files: `src/cli/user-language-sync.js`, `src/cli/helpers/global-config-dir.js`, `tests/unit/user-language-sync.test.js`
- context_refs: plan U4, Codex home helper, language policy marker helpers
- verification focus: module-level aggregate operations, Codex/Claude path resolution, collision classification, marker preservation, cleanup no-create
- stop_if: cleanup creates missing global files, path helper duplicates canonicalization, or runtime mirrors become task-owned

### T005 — Init Aggregate Integration

- source_unit: U4
- requirement_refs: R5, R6, R7, R8, R9, R10, R14
- files: `src/cli/commands/init.js`, `tests/unit/init-dry-run.test.js`, `tests/unit/init-interactive.test.js`
- context_refs: plan U4, top-level init runner, `buildInitPlans`
- verification focus: aggregate plan built once, applied once, dry-run no-write, all-repos once, selected-host write vs all-host cleanup
- stop_if: user-level operations need to live in repo-local operation plans, child plans, or per-platform project plans

### T006 — Preview, Apply Output, and Failure Reporting

- source_unit: U5
- requirement_refs: R8, R10, R11, R14
- files: `src/cli/commands/init.js`, `src/cli/init-i18n.js`, `tests/unit/init-dry-run.test.js`, `tests/unit/init-interactive.test.js`
- context_refs: plan U5, init preview/apply output functions
- verification focus: visible user-level sync section, per-host status, partial success non-zero, cleanup failure retry wording
- stop_if: output suppresses global sync failure or claims hooks enforce answer language

### T007 — Documentation, Changelog, and Verification Pass

- source_unit: U6
- requirement_refs: R1, R11, R12, R13
- files: `README.md`, `README.zh-CN.md`, `CHANGELOG.md`
- context_refs: plan U6, README init sections, changelog format
- verification focus: docs/help clarify project vs user instruction files and flags; focused tests and typecheck pass
- stop_if: docs promise perfect enforcement or omit generated runtime impact

## Orientation Evidence

- provider: mixed
- posture: bounded
- evidence_refs:
  - `docs/plans/2026-06-22-001-feat-user-language-sync-plan.md`
  - `src/cli/lang-policy.js`
  - `src/cli/developer.js`
  - `src/cli/commands/init.js`
  - `src/cli/helpers/global-config-dir.js`
  - `skills/spec-write-tasks/SKILL.md`
  - `skills/spec-write-tasks/references/task-pack-schema.md`
  - `skills/spec-write-tasks/references/task-quality-guide.md`
  - `skills/spec-write-tasks/references/execution-handoff-contract.md`
- limitations:
  - Orientation confirmed current file existence and key integration points, but did not re-read every affected test file before compilation.
  - `codegraph_explore` was used as advisory navigation only; direct source reads and the source plan remain authoritative.
  - External host runtime loading of user instruction files is intentionally not proven by this task pack.

## Validation Notes

- This task pack derives from `docs/plans/2026-06-22-001-feat-user-language-sync-plan.md`.
- `source_plan_hash` was computed with `node bin/spec-first.js tasks hash docs/plans/2026-06-22-001-feat-user-language-sync-plan.md`.
- The task pack is intentionally serial because source plan dependencies are linear and `src/cli/commands/init.js` is shared by T002, T003, T005, and T006.
- Second-round semantic review split source U4 across T004/T005 because the original one-task version combined independent module-level and init-integration feedback loops.
- Same-wave file overlap is absent because every wave contains exactly one task.
- Deterministic validation proves identity, freshness, and `Task Pack Contract` structure only. It does not prove that the split is semantically optimal.

## Regeneration Rules

Rebuild this task pack if any of these change:

- the source plan body, implementation units, requirements, scope boundaries, or verification plan;
- `spec_id` or source plan path;
- task pack schema / validator required fields;
- task splitting semantics after manual review;
- execution triggers any task's `stop_if`.

If `source_plan_hash` does not match the current source plan body, reject execution and regenerate from the source plan. If `spec_id` no longer matches, reject as wrong-chain handoff.
