---
title: "团队开发规范治理层任务包"
type: "task-pack"
status: "derived"
date: "2026-06-22"
spec_id: "2026-06-21-004-team-standards-governance-layer"
source_plan: "docs/plans/2026-06-21-004-feat-team-standards-governance-layer-plan.md"
source_plan_hash: "sha256:9dd59db7d00e08e11a39106b3239432b0a88c253d3c132b4cc315879c07af11d"
generated_by: "spec-write-tasks"
mode: "derived"
target_repo: "spec-first"
source_sections:
  - "Requirements"
  - "Scope Boundaries"
  - "Completion Criteria"
  - "Implementation Units"
  - "Direct Evidence"
  - "System Impact"
  - "Risks And Dependencies"
---

# Task Pack: 团队开发规范治理层

## Overview

本任务包把 source plan 的 12 个 implementation units 编译为 13 个可执行任务。拆分原则不是 U-ID 机械映射，而是按反馈环分层：source contract、standards source、workflow consumption、review enforcement、brownfield/acquisition、standalone skill、replay/eval 和最终审计分别关闭验证面。

关键 fan-out：

- U3/U4 分成 T003/T004：先建立统一 rule-selection/summary-first 消费合同，再把 plan/task/work/debug/doc-review 的具体行为接入，避免一次任务同时改所有语义。
- U10 分成 T009/T010：candidate/ledger source 模板与 skill reference 的获取质量模型分开验证，避免一个任务同时承担文档产物、质量门和 skill prose。
- U13 单独作为 T013：只做最终验证、迁移审计、absence guard 和 changelog，不承载前置实现。

本任务包不恢复 `$spec-standards` / `/spec:standards`，不写 `.spec-first/standards/`，也不把 candidate、graphify/codegraph 或 LLM confidence 当作 confirmed hard context。

## Source Summary

- **Source plan:** `docs/plans/2026-06-21-004-feat-team-standards-governance-layer-plan.md`
- **Task-ready branch:** `compile`。计划有 `spec_id`、`target_repo: spec-first`、R1-R38、C1-C28、明确 scope boundaries、implementation units、文件面、测试场景和验证收口。
- **Consumed sections:** 摘要、决策摘要、需求、范围边界、完成标准、直接证据、产物结构、source 权威层级、standards/capability spec 边界、implementation units、系统影响、风险、分阶段交付、文档计划。
- **Scope boundaries shaping split:** 不恢复 retired standards workflow；不让 scripts 做 semantic authority；不默认全量扫描 standards 库；不把 candidates/derived artifacts 变成 source truth；不手改 generated runtime mirrors。
- **Implementation-time unknowns:** 最终 README 文案位置、是否新增还是复用用户手册页、fresh-source eval 是否可用、是否需要后续 CLI selector 独立计划。这些不得在任务执行时扩大本计划范围。

## Traceability Matrix

| Source | Requirement / Acceptance | Task(s) | Validation |
| --- | --- | --- | --- |
| U1 | R1, R2, R3, R5, R7, R8, R13, R16, R21, R35, R37 / C1, C15, C25, C27 | T001 | `context-governance` contract test + source review of trust/source hierarchy |
| U2 | R1, R3, R4, R8, R11, R12, R14, R15 / C2, C8, C9, C10, C11 | T002 | standards skeleton contract assertions and no-auto-confirm checks |
| U3 | R2, R3, R5, R7, R15, R16, R36, R37 / C3, C26, C27 | T003 | focused workflow contract tests prove summary-first, scope-filtered consumption |
| U4 | R5, R8, R9, R15 / C3, C13, C14 | T004 | plan/work/write-tasks/debug/doc-review tests prove standards influence without scope expansion |
| U5 | R5, R6, R7, R15, R16 / C4 | T005 | code-review and agent governance tests prove confirmed-only standards findings |
| U6 | R2, R8, R9, R11, R14 / C6, C10, C18, C19 | T006 | brownfield docs distinguish explicit rules, observed patterns, candidates and conflicts |
| U7 | R7, R9, R10 / C5, C6, C7 | T007 | README/user-doc and route/catalog absence guards prove no public standards workflow |
| U9 | R17-R21, R35, R36, R38 / C12, C13, C14, C28 | T008 | skill entrypoint/reference-map tests prove standalone boundary and progressive disclosure |
| U10 | R22-R24, R27, R29-R32 / C16, C17, C21-C24 | T009, T010 | candidate ledger docs plus skill acquisition references cover source anchors, gates and routing |
| U11 | R24-R26, R29 / C18 | T011 | role interview and slicing docs prove no whole-repo default extraction |
| U12 | R15, R16, R23, R28, R33, R34 / C20 | T012 | replay/retrieval eval fixtures cover hits, noise, owner edit distance and no LLM self-pass |
| U13 | R1-R38 / C1-C28 | T013 | focused test suite, absence grep, migration/source-authority/rule-selection audits and changelog |

Every R1-R38 is covered by at least one task through its source unit. Scope boundaries are carried into `stop_if`, `risk_note`, and final audit checks.

## Task Graph

- T001 defines the semantic contract that all later docs, skills and tests reference.
- T002 creates the confirmed standards source surface and minimal skeleton after T001 defines the rules for interpreting it.
- T003 updates workflow-wide rule selection and summary-first consumption before any workflow-specific behavior is deepened.
- T004 and T005 both depend on T003 and can be reasoned as separate surfaces: daily plan/work/task/debug/doc-review behavior versus code-review enforcement.
- T006 can start after T002 because it extends the standards source skeleton with brownfield candidate guidance.
- T007 updates discovery/docs and absence guards after the contract and workflow consumption story are clear.
- T008 builds the standalone governance skill after the docs and route boundaries exist.
- T009/T010 fill acquisition source templates and skill quality references after the skill skeleton exists.
- T011 adds role interview and slicing after acquisition models exist.
- T012 adds replay/eval after acquisition and review enforcement exist.
- T013 validates and closes all prior work.

## Execution Waves

- **Wave 1:** T001
- **Wave 2:** T002
- **Wave 3:** T003
- **Wave 4:** T004, T005, T006
- **Wave 5:** T007
- **Wave 6:** T008
- **Wave 7:** T009
- **Wave 8:** T010
- **Wave 9:** T011
- **Wave 10:** T012
- **Wave 11:** T013

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
      "tasks": ["T004", "T005", "T006"]
    },
    {
      "wave": 5,
      "tasks": ["T007"]
    },
    {
      "wave": 6,
      "tasks": ["T008"]
    },
    {
      "wave": 7,
      "tasks": ["T009"]
    },
    {
      "wave": 8,
      "tasks": ["T010"]
    },
    {
      "wave": 9,
      "tasks": ["T011"]
    },
    {
      "wave": 10,
      "tasks": ["T012"]
    },
    {
      "wave": 11,
      "tasks": ["T013"]
    }
  ],
  "tasks": [
    {
      "task_id": "T001",
      "source_unit": "U1",
      "requirement_refs": ["R1", "R2", "R3", "R5", "R7", "R8", "R13", "R16", "R21", "R35", "R37"],
      "goal": "Create the team standards source contract and trust model so standards, candidates, host instructions, capability specs, contracts, solutions and generated runtime assets have explicit authority boundaries.",
      "dependencies": [],
      "files": [
        "docs/contracts/team-standards.md",
        "docs/contracts/context-governance.md",
        "tests/unit/context-governance-contracts.test.js"
      ],
      "context_refs": [
        "docs/plans/2026-06-21-004-feat-team-standards-governance-layer-plan.md#U1-定义规范-source-合同与信任模型",
        "docs/10-prompt/结构化项目角色契约.md",
        "docs/contracts/context-governance.md",
        "docs/contracts/project-graph-consumption.md"
      ],
      "entry_hint": "Start with `docs/contracts/team-standards.md`; make it the semantic contract before touching context-governance references.",
      "test_focus": "Trust/lifecycle/promotion/source hierarchy, confirmed-only hard context, project-enum registry ownership, no `.spec-first/standards/` or public standards workflow resurrection.",
      "done_signal": "`tests/unit/context-governance-contracts.test.js` asserts the new team standards contract boundary, source authority hierarchy, advisory candidate handling, and retired standards absence guards.",
      "parallelizable": false,
      "risk_note": "If this contract is vague, later tasks will either over-enforce candidates or duplicate host/project instruction rules into another source of truth.",
      "review_gate": "required",
      "review_focus": "Review authority hierarchy, confirmed-only hard-context rule, source/runtime boundary, and `Scripts prepare, LLM decides` separation.",
      "target_repo": "spec-first",
      "stop_if": "The contract needs a new public workflow, a durable runtime state root, or semantic confirmation by scripts instead of LLM/source review.",
      "wave": 1
    },
    {
      "task_id": "T002",
      "source_unit": "U2",
      "requirement_refs": ["R1", "R3", "R4", "R8", "R11", "R12", "R14", "R15"],
      "goal": "Create the minimal `docs/standards/**` source skeleton, registry, scoped rule-card templates, candidates/archive boundaries, and first confirmed seed/template examples without building a giant standards document.",
      "dependencies": ["T001"],
      "files": [
        "docs/standards/index.md",
        "docs/standards/shared.md",
        "docs/standards/cross-surface.md",
        "docs/standards/app.md",
        "docs/standards/h5.md",
        "docs/standards/pc.md",
        "docs/standards/admin.md",
        "docs/standards/backend.md",
        "docs/standards/data.md",
        "docs/standards/job-event.md",
        "docs/standards/architecture.md",
        "docs/standards/design.md",
        "docs/standards/coding.md",
        "docs/standards/testing.md",
        "docs/standards/review.md",
        "docs/standards/security.md",
        "docs/standards/candidates/README.md",
        "docs/standards/archive/README.md",
        "tests/unit/team-standards-governance-contracts.test.js"
      ],
      "context_refs": [
        "docs/plans/2026-06-21-004-feat-team-standards-governance-layer-plan.md#U2-创建规范-source-骨架和首批规则模板",
        "docs/contracts/team-standards.md",
        "docs/03-实施方案/06-开发规范.md",
        "docs/01-需求分析/11.project-standards/第一层级.md"
      ],
      "entry_hint": "Build `docs/standards/index.md` first with Surface / Layer / Capability Registry, then add scoped files with compact rule-card templates.",
      "test_focus": "Index is summary-first, registry-backed project-enum values exist, candidates/archive are separated from confirmed rules, and no file claims code scanning can auto-confirm standards.",
      "done_signal": "The standards skeleton is navigable from `index.md`, contains no whole-corpus duplication, and focused contract tests assert registry/source/candidate boundaries.",
      "parallelizable": false,
      "risk_note": "A large copied prose corpus would defeat summary-first consumption and make future workflow prompts pay permanent context cost.",
      "review_gate": "required",
      "review_focus": "Check registry shape, rule-card minimum fields, confirmed seed authority, candidate/archive separation, and no stale historical rule promotion.",
      "target_repo": "spec-first",
      "stop_if": "A seed rule cannot cite current authority, needs an owner that the plan does not identify, or requires writing standards into generated runtime mirrors.",
      "wave": 2
    },
    {
      "task_id": "T003",
      "source_unit": "U3",
      "requirement_refs": ["R2", "R3", "R5", "R7", "R15", "R16", "R36", "R37"],
      "goal": "Define and wire the summary-first standards consumption contract across workflows so each consumer records matched, excluded, uncertain, fallback and limitation information without defaulting to full standards scans.",
      "dependencies": ["T001", "T002"],
      "files": [
        "docs/contracts/team-standards.md",
        "skills/spec-plan/references/governance-boundaries.md",
        "skills/spec-work/SKILL.md",
        "skills/spec-write-tasks/SKILL.md",
        "skills/spec-code-review/SKILL.md",
        "skills/spec-doc-review/SKILL.md",
        "skills/spec-debug/SKILL.md",
        "tests/unit/spec-plan-contracts.test.js",
        "tests/unit/spec-work-contracts.test.js",
        "tests/unit/spec-write-tasks-contracts.test.js",
        "tests/unit/spec-code-review-contracts.test.js",
        "tests/unit/spec-doc-review-contracts.test.js",
        "tests/unit/spec-debug-contracts.test.js"
      ],
      "context_refs": [
        "docs/plans/2026-06-21-004-feat-team-standards-governance-layer-plan.md#U3-定义-summary-first-规范消费合同",
        "docs/contracts/team-standards.md",
        "skills/spec-plan/references/governance-boundaries.md",
        "skills/spec-work/SKILL.md",
        "skills/spec-write-tasks/references/task-quality-guide.md"
      ],
      "entry_hint": "First add the rule selection contract to `team-standards.md`, then update each workflow with the same summary-first/fallback vocabulary.",
      "test_focus": "Workflow prose references the same contract, confirmed/scope-matched rules are hard context, non-confirmed or unknown-scope cases degrade, and full `docs/standards/**` scans are not the default fallback.",
      "done_signal": "Focused workflow contract tests pass and assert matched/excluded/uncertainty/fallback/limitations language plus no retired standards artifacts.",
      "parallelizable": false,
      "risk_note": "If consumers phrase selection differently, standards will drift into ad hoc prompt behavior and become another hidden state machine.",
      "review_gate": "required",
      "review_focus": "Check uniform rule-selection vocabulary, fallback modes, capability-spec boundary, and no external-tool facts as scope authority.",
      "target_repo": "spec-first",
      "stop_if": "A workflow needs a standards CLI selector or full corpus read to implement this task; that belongs to a later plan.",
      "wave": 3
    },
    {
      "task_id": "T004",
      "source_unit": "U4",
      "requirement_refs": ["R5", "R8", "R9", "R15"],
      "goal": "Integrate confirmed standards into plan, task-pack, work, debug and doc-review behavior as bounded constraints, closeout evidence or expected invariants without letting standards create product scope.",
      "dependencies": ["T003"],
      "files": [
        "skills/spec-plan/references/governance-boundaries.md",
        "skills/spec-work/SKILL.md",
        "skills/spec-write-tasks/SKILL.md",
        "skills/spec-doc-review/SKILL.md",
        "skills/spec-debug/SKILL.md",
        "tests/unit/spec-plan-contracts.test.js",
        "tests/unit/spec-work-contracts.test.js",
        "tests/unit/spec-write-tasks-contracts.test.js",
        "tests/unit/spec-doc-review-contracts.test.js",
        "tests/unit/spec-debug-contracts.test.js"
      ],
      "context_refs": [
        "docs/plans/2026-06-21-004-feat-team-standards-governance-layer-plan.md#U4-将规范集成到-plan-task-work-debug-和-doc-review",
        "docs/contracts/team-standards.md",
        "skills/spec-plan/references/governance-boundaries.md",
        "skills/spec-work/SKILL.md",
        "skills/spec-debug/SKILL.md"
      ],
      "entry_hint": "Treat this as behavior prose on top of T003's contract: add decision-note, task context, closeout, invariant and doc-review limits in the relevant workflow sections.",
      "test_focus": "Standards can influence technical constraints and review focus, but cannot invent WHAT, acceptance criteria, root cause evidence, or coding-style document review findings.",
      "done_signal": "Focused tests prove standards rule IDs are recorded where they materially shape decisions and that absent/conflict/candidate standards remain advisory.",
      "parallelizable": true,
      "risk_note": "The main failure mode is turning standards into product scope authority or applying coding/testing rules to PRD/plan reviews.",
      "review_gate": "required",
      "review_focus": "Check workflow-specific boundaries, especially spec-write-tasks source-plan authority and doc-review architecture/design-only use.",
      "target_repo": "spec-first",
      "stop_if": "The implementation needs to add new lifecycle state, approval state, or workflow progress tracking to standards consumption.",
      "wave": 4
    },
    {
      "task_id": "T005",
      "source_unit": "U5",
      "requirement_refs": ["R5", "R6", "R7", "R15", "R16"],
      "goal": "Extend code-review standards enforcement so the project-standards persona can discover and enforce confirmed `docs/standards/**` rules with the same evidence rigor as AGENTS.md/CLAUDE.md.",
      "dependencies": ["T003"],
      "files": [
        "skills/spec-code-review/SKILL.md",
        "skills/spec-code-review/references/persona-catalog.md",
        "agents/spec-project-standards-reviewer.agent.md",
        "tests/unit/spec-code-review-contracts.test.js",
        "tests/unit/agents-governance-contracts.test.js",
        "tests/unit/workflow-skill-agent-map-contracts.test.js"
      ],
      "context_refs": [
        "docs/plans/2026-06-21-004-feat-team-standards-governance-layer-plan.md#U5-扩展-code-review-的规范-enforcement",
        "agents/spec-project-standards-reviewer.agent.md",
        "skills/spec-code-review/SKILL.md#Stage-3b-Discover-project-standards-paths",
        "skills/spec-code-review/references/persona-catalog.md"
      ],
      "entry_hint": "Update Stage 3b path discovery before changing the reviewer persona; keep parent orchestration cheap and pass paths, not standards contents.",
      "test_focus": "Confirmed scope-matched rules can produce findings with rule ID plus diff/source evidence; suggested/observed/imported/conflict/deprecated rules and generic best practices are suppressed.",
      "done_signal": "Code-review and agent governance tests prove `docs/standards/**` discovery, confirmed-only enforcement, changed-file scope matching, and retired workflow absence.",
      "parallelizable": true,
      "risk_note": "A broader standards source without stricter evidence requirements would increase review noise and generic best-practice findings.",
      "review_gate": "required",
      "review_focus": "Check project-standards persona evidence threshold, exact citation requirements, and degraded behavior when standards docs are missing.",
      "target_repo": "spec-first",
      "stop_if": "The reviewer must read all standards files by default or flag rules that lack confirmed trust and changed-file applicability.",
      "wave": 4
    },
    {
      "task_id": "T006",
      "source_unit": "U6",
      "requirement_refs": ["R2", "R8", "R9", "R11", "R14"],
      "goal": "Document the brownfield initialization path with explicit rules inventory, observed patterns, suggested candidates, conflicts and safe promotion examples.",
      "dependencies": ["T001", "T002"],
      "files": [
        "docs/standards/index.md",
        "docs/standards/shared.md",
        "docs/standards/candidates/README.md",
        "docs/standards/candidates/explicit-rules-inventory.md",
        "docs/standards/candidates/observed-patterns.md",
        "docs/standards/candidates/suggested-candidates.md",
        "docs/standards/candidates/conflicts.md",
        "docs/05-用户手册/团队开发规范治理.md"
      ],
      "context_refs": [
        "docs/plans/2026-06-21-004-feat-team-standards-governance-layer-plan.md#U6-文档化-brownfield-规范初始化",
        "docs/01-需求分析/11.project-standards/第一层级.md",
        "docs/validation/execution-logs/2026-05-04-spec-standards-loop.md",
        "docs/contracts/team-standards.md"
      ],
      "entry_hint": "Start in `docs/standards/candidates/README.md`; keep code/graph/review-derived material as observed or suggested until promotion evidence exists.",
      "test_focus": "Brownfield guidance distinguishes explicit authority, observed code patterns, suggested candidates, conflicts, confirmed-draft proposals and confirmed source edits.",
      "done_signal": "Docs explain how a maintainer can bootstrap a small standards slice without claiming whole-repo scans or old docs are confirmed policy.",
      "parallelizable": true,
      "risk_note": "This task is where historical debt and personal preference are most likely to be repackaged as team standards.",
      "review_gate": "required",
      "review_focus": "Check confirmed-only lessons, graphify/codegraph provider_untrusted language, and owner/source-edit workflow exit conditions.",
      "target_repo": "spec-first",
      "stop_if": "The guidance requires graphify/codegraph availability, whole-repo extraction, or automatic promotion from code structure to confirmed standards.",
      "wave": 4
    },
    {
      "task_id": "T007",
      "source_unit": "U7",
      "requirement_refs": ["R7", "R9", "R10"],
      "goal": "Update user-facing docs and route/reference guards so team standards are discoverable as source docs while retired public standards workflows remain absent.",
      "dependencies": ["T003", "T006"],
      "files": [
        "README.md",
        "README.zh-CN.md",
        "docs/README.md",
        "docs/05-用户手册/README.md",
        "docs/05-用户手册/12-gitignore参考.md",
        "tests/unit/runtime-capability-catalog.test.js",
        "tests/unit/using-spec-first-contracts.test.js"
      ],
      "context_refs": [
        "docs/plans/2026-06-21-004-feat-team-standards-governance-layer-plan.md#U7-更新用户文档和-route-references",
        "README.md",
        "README.zh-CN.md",
        "docs/05-用户手册/12-gitignore参考.md",
        "tests/unit/runtime-capability-catalog.test.js"
      ],
      "entry_hint": "Add compact docs pointers to `docs/contracts/team-standards.md` and `docs/standards/index.md`; do not add command syntax.",
      "test_focus": "Docs mention team standards source docs, gitignore guidance treats `docs/standards/**` as source, and runtime/route tests continue rejecting `$spec-standards` and `/spec:standards`.",
      "done_signal": "User docs can route maintainers to standards source and brownfield guidance without introducing any public workflow or generated runtime path.",
      "parallelizable": false,
      "risk_note": "A docs discoverability change can accidentally reintroduce the retired workflow as a user-facing command.",
      "review_gate": "required",
      "review_focus": "Check no command surface, no runtime mirror edits, and clear source/runtime language in gitignore guidance.",
      "target_repo": "spec-first",
      "stop_if": "A README or route map change needs to expose `$spec-standards`, `/spec:standards`, or `.spec-first/standards/` as active source.",
      "wave": 5
    },
    {
      "task_id": "T008",
      "source_unit": "U9",
      "requirement_refs": ["R17", "R18", "R19", "R20", "R21", "R22", "R23", "R24", "R25", "R26", "R27", "R28", "R29", "R30", "R31", "R32", "R33", "R34", "R35", "R36", "R38", "R7", "R8", "R13", "R14", "R15", "R16"],
      "goal": "Create the standalone `team-standards-governance` skill skeleton with mode routing, hard boundaries, output contracts and reference loading map, while keeping it out of public `$spec-*` route surfaces.",
      "dependencies": ["T003", "T006", "T007"],
      "files": [
        "skills/team-standards-governance/SKILL.md",
        "skills/team-standards-governance/references/initialization.md",
        "skills/team-standards-governance/references/meta-prompt-governance.md",
        "skills/team-standards-governance/references/authority-tiers.md",
        "skills/team-standards-governance/references/acquisition-quality.md",
        "skills/team-standards-governance/references/source-matrix.md",
        "skills/team-standards-governance/references/role-interview-playbook.md",
        "skills/team-standards-governance/references/validation-and-replay.md",
        "skills/team-standards-governance/references/output-risk-profile.md",
        "skills/team-standards-governance/references/promotion-and-conflicts.md",
        "skills/team-standards-governance/references/loading-and-consumption.md",
        "skills/team-standards-governance/references/adaptive-expansion.md",
        "skills/team-standards-governance/references/lifecycle.md",
        "tests/unit/team-standards-governance-contracts.test.js",
        "tests/unit/lint-skill-entrypoints.test.js",
        "tests/unit/runtime-capability-catalog.test.js",
        "tests/unit/using-spec-first-contracts.test.js"
      ],
      "context_refs": [
        "docs/plans/2026-06-21-004-feat-team-standards-governance-layer-plan.md#U9-设计-standalone-规范治理-skill-skeleton-与架构收口",
        "skills/using-spec-first/SKILL.md",
        "docs/contracts/workflows/fresh-source-eval-checklist.md",
        "docs/contracts/team-standards.md"
      ],
      "entry_hint": "Write `SKILL.md` as a thin router first; keep mode-specific mechanics in references and add placeholder sections that later tasks can fill.",
      "test_focus": "Standalone skill entrypoint, six modes, no-load-all reference map, proposal-only direct invocation, source-edit workflow boundary, no public route/catalog exposure.",
      "done_signal": "Skill entrypoint and governance tests prove mode boundaries, progressive disclosure, authority-tier references, and absence of `$spec-standards` or `.spec-first/standards/` claims.",
      "parallelizable": false,
      "risk_note": "The skill could become a hidden public workflow or a second giant context file unless the entrypoint stays thin and mode-specific.",
      "review_gate": "required",
      "review_focus": "Check standalone/public workflow boundary, reference loading map, source-edit write boundary, and confidence-not-authority language.",
      "target_repo": "spec-first",
      "stop_if": "The skill needs to automatically modify confirmed standards outside active source-edit workflow or expose itself as a public `$spec-*` workflow.",
      "wave": 6
    },
    {
      "task_id": "T009",
      "source_unit": "U10",
      "requirement_refs": ["R22", "R23", "R24", "R27", "R29", "R30", "R31", "R32"],
      "goal": "Define acquisition task-pack and candidate ledger source templates so every standards extraction run has one target slice, source anchors, evidence quality, privacy review, lineage and owner decision routing.",
      "dependencies": ["T008"],
      "files": [
        "docs/standards/candidates/acquisition-task-pack.md",
        "docs/standards/candidates/evidence-quality-ledger.md",
        "docs/standards/candidates/fact-ledger.md",
        "docs/standards/candidates/source-matrix.md",
        "docs/standards/candidates/output-risk-profile.md",
        "docs/standards/candidates/lineage-ledger.md",
        "docs/standards/candidates/owner-decision-queue.md",
        "docs/standards/candidates/promotion-log.md",
        "tests/unit/team-standards-governance-contracts.test.js"
      ],
      "context_refs": [
        "docs/plans/2026-06-21-004-feat-team-standards-governance-layer-plan.md#U10-定义获取任务包与证据质量模型",
        "docs/contracts/team-standards.md",
        "docs/standards/candidates/README.md"
      ],
      "entry_hint": "Start with `acquisition-task-pack.md` and make every other ledger reference the acquisition id and source-anchor model.",
      "test_focus": "Single extraction target, include/exclude scope, source anchor fields, no local absolute paths, do-not-promote list, owner queue only for conflict/high-risk/owner_required.",
      "done_signal": "Candidate source templates let reviewers trace candidate -> proposal -> confirmed/deprecated/archive without treating ledgers as hard context.",
      "parallelizable": false,
      "risk_note": "Without ledger discipline, acquisition output will be hard to review and owner queue will become a catch-all for low-quality candidate cleanup.",
      "review_gate": "required",
      "review_focus": "Check source anchor completeness, privacy/redaction, owner queue negative routing, and lineage/promotion vocabulary parity with `team-standards.md`.",
      "target_repo": "spec-first",
      "stop_if": "The template needs to support mixed-surface extraction in one run or emits local absolute paths into formal candidate outputs.",
      "wave": 7
    },
    {
      "task_id": "T010",
      "source_unit": "U10",
      "requirement_refs": ["R22", "R23", "R24", "R27", "R29", "R30", "R31", "R32"],
      "goal": "Fill the governance skill's acquisition-quality, source-matrix, output-risk and promotion references with quality gates, warning routing, decision trace and derived artifact boundaries.",
      "dependencies": ["T009"],
      "files": [
        "skills/team-standards-governance/references/acquisition-quality.md",
        "skills/team-standards-governance/references/source-matrix.md",
        "skills/team-standards-governance/references/output-risk-profile.md",
        "skills/team-standards-governance/references/promotion-and-conflicts.md",
        "tests/unit/team-standards-governance-contracts.test.js"
      ],
      "context_refs": [
        "docs/plans/2026-06-21-004-feat-team-standards-governance-layer-plan.md#U10-定义获取任务包与证据质量模型",
        "skills/team-standards-governance/SKILL.md",
        "docs/standards/candidates/acquisition-task-pack.md",
        "docs/standards/candidates/source-matrix.md"
      ],
      "entry_hint": "Use the source docs from T009 as the contract source, then write mode-specific reference guidance for the skill without duplicating all templates into `SKILL.md`.",
      "test_focus": "Evidence score is not authority, graphify/codegraph remain provider_untrusted, source matrix caps trust levels, warnings route to collect/refine/owner/reject actions, derived artifacts cite source rule IDs.",
      "done_signal": "Skill reference tests prove quality gates and warning routing are present and that AI rules/review checklists/query summaries cannot become independent source truth.",
      "parallelizable": false,
      "risk_note": "Quality gates can be misread as mechanical approval unless authority tier and owner/diff review remain explicit.",
      "review_gate": "required",
      "review_focus": "Check acquisition vs authority separation, warning routing, output-risk suppression, and derived artifact source boundaries.",
      "target_repo": "spec-first",
      "stop_if": "The reference text implies a high confidence score, quality-gate pass, or code inference can directly create confirmed hard context.",
      "wave": 8
    },
    {
      "task_id": "T011",
      "source_unit": "U11",
      "requirement_refs": ["R24", "R25", "R26", "R29"],
      "goal": "Add brownfield slicing and role-interview playbooks so large multi-surface projects can acquire standards by risk/capability slices and capture organization rules without leaking private details.",
      "dependencies": ["T010"],
      "files": [
        "docs/standards/candidates/README.md",
        "docs/standards/candidates/role-interview-notes.md",
        "skills/team-standards-governance/references/role-interview-playbook.md",
        "skills/team-standards-governance/references/initialization.md",
        "docs/05-用户手册/团队开发规范治理.md",
        "tests/unit/team-standards-governance-contracts.test.js"
      ],
      "context_refs": [
        "docs/plans/2026-06-21-004-feat-team-standards-governance-layer-plan.md#U11-定义-Brownfield-切片策略与角色化访谈",
        "skills/team-standards-governance/references/acquisition-quality.md",
        "docs/standards/candidates/acquisition-task-pack.md"
      ],
      "entry_hint": "Add slice priority before role-specific questions; keep interview outcomes as suggested candidates or explicit owner decisions with source/privacy constraints.",
      "test_focus": "High-risk capability/churn/incident/owner-available slicing, architecture/security/testing/SRE/multi-surface/backend/data/business-owner question sets, unanswered questions preserved.",
      "done_signal": "Docs and skill references let a maintainer start one acquisition slice and know which questions still require owner answers instead of LLM completion.",
      "parallelizable": false,
      "risk_note": "Interview notes can accidentally encode personal data or unverified spoken preference as durable team policy.",
      "review_gate": "required",
      "review_focus": "Check privacy/redaction, owner decision semantics, open question handling, and no whole-repo initialization default.",
      "target_repo": "spec-first",
      "stop_if": "The playbook requires all teams/surfaces to be interviewed before any small slice can produce candidates.",
      "wave": 9
    },
    {
      "task_id": "T012",
      "source_unit": "U12",
      "requirement_refs": ["R15", "R16", "R23", "R28", "R33", "R34"],
      "goal": "Add replay and retrieval eval guidance plus trigger/output eval fixtures so standards acquisition quality can be measured without relying on LLM self-assessment.",
      "dependencies": ["T005", "T010", "T011"],
      "files": [
        "skills/team-standards-governance/references/validation-and-replay.md",
        "skills/team-standards-governance/evals/README.md",
        "skills/team-standards-governance/evals/trigger-cases.json",
        "skills/team-standards-governance/evals/output-cases.json",
        "skills/team-standards-governance/evals/examples.json",
        "skills/team-standards-governance/evals/golden-samples/README.md",
        "docs/validation/standards-governance/2026-06-21-acquisition-quality-validation.md",
        "tests/unit/team-standards-governance-contracts.test.js",
        "tests/unit/spec-code-review-contracts.test.js"
      ],
      "context_refs": [
        "docs/plans/2026-06-21-004-feat-team-standards-governance-layer-plan.md#U12-增加获取质量验证与回放-eval",
        "skills/team-standards-governance/references/validation-and-replay.md",
        "skills/spec-code-review/SKILL.md",
        "skills/spec-code-review/evals/examples.json"
      ],
      "entry_hint": "Define the reusable eval case schema in `evals/README.md` first, then add trigger and output cases that exercise no-absolute-path and derived-artifact citation constraints.",
      "test_focus": "PR replay, retrieval eval, expected/non-hit rule IDs, false positives/negatives, owner edit distance, sample insufficiency, pilot thresholds, no LLM self-pass.",
      "done_signal": "Eval fixtures and references cover should-trigger, should-not-trigger, near-neighbor, boundary, replay/retrieval/noise metrics and source-rule citation requirements.",
      "parallelizable": false,
      "risk_note": "Without replay/eval shape, the governance layer could look complete while only producing more docs and more review noise.",
      "review_gate": "required",
      "review_focus": "Check metric definitions, sample insufficiency honesty, false-positive budget, and that eval results remain promotion evidence rather than owner authority.",
      "target_repo": "spec-first",
      "stop_if": "The validation section needs to claim pass without runnable/reviewable samples, owner feedback, or explicit `not-run`/`not-enough-sample` status.",
      "wave": 10
    },
    {
      "task_id": "T013",
      "source_unit": "U13",
      "requirement_refs": ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10", "R11", "R12", "R13", "R14", "R15", "R16", "R17", "R18", "R19", "R20", "R21", "R22", "R23", "R24", "R25", "R26", "R27", "R28", "R29", "R30", "R31", "R32", "R33", "R34", "R35", "R36", "R37", "R38"],
      "goal": "Run focused validation, source-authority/rule-selection/migration audits, absence guards, path hygiene checks, fresh-source/doc review where available, and changelog closeout for the governance layer.",
      "dependencies": ["T004", "T005", "T007", "T008", "T009", "T010", "T011", "T012"],
      "files": [
        "CHANGELOG.md",
        "docs/validation/standards-governance/2026-06-21-team-standards-governance-validation.md",
        "docs/validation/standards-governance/2026-06-21-team-standards-governance-migration-audit.md",
        "tests/unit/context-governance-contracts.test.js",
        "tests/unit/spec-plan-contracts.test.js",
        "tests/unit/spec-work-contracts.test.js",
        "tests/unit/spec-write-tasks-contracts.test.js",
        "tests/unit/spec-code-review-contracts.test.js",
        "tests/unit/spec-doc-review-contracts.test.js",
        "tests/unit/spec-debug-contracts.test.js",
        "tests/unit/team-standards-governance-contracts.test.js",
        "tests/unit/runtime-capability-catalog.test.js",
        "tests/unit/using-spec-first-contracts.test.js",
        "tests/unit/workflow-skill-agent-map-contracts.test.js"
      ],
      "context_refs": [
        "docs/plans/2026-06-21-004-feat-team-standards-governance-layer-plan.md#U13-增加聚焦验证-review-和迁移审计",
        "docs/contracts/workflows/fresh-source-eval-checklist.md",
        "docs/contracts/team-standards.md",
        "skills/team-standards-governance/SKILL.md"
      ],
      "entry_hint": "Start by listing changed files from the previous tasks, then run the narrowest focused tests and write validation/migration audit evidence before updating `CHANGELOG.md`.",
      "test_focus": "All changed workflow/skill/reviewer contract tests, retired standards absence guards, diff check, acquisition output audit, derived artifact drift audit, source-authority and rule-selection audits.",
      "done_signal": "Validation report records exact commands/results/limitations, changelog is updated, absence guards still pass, and any unavailable fresh-source/doc-review step is explicitly documented.",
      "parallelizable": false,
      "risk_note": "This plan touches public workflow prose and governance docs; without final audit, old standards behavior or derived-source drift can quietly return.",
      "review_gate": "required",
      "review_focus": "Check completion criteria C1-C28 coverage, generated runtime non-edit proof, changelog accuracy, and honest validation limitations.",
      "target_repo": "spec-first",
      "stop_if": "Focused tests reveal semantic contract drift that cannot be resolved without changing source-plan scope or restoring retired standards workflow behavior.",
      "wave": 11
    }
  ]
}
```

## Task Cards

### T001 - Source Contract And Trust Model

- `source_unit`: U1
- `goal`: Define the source authority hierarchy, trust/lifecycle/promotion model and confirmed-only hard-context rule.
- `files`: `docs/contracts/team-standards.md`, `docs/contracts/context-governance.md`, `tests/unit/context-governance-contracts.test.js`
- `test_focus`: contract text and tests distinguish source, candidate, generated runtime and advisory providers.
- `done_signal`: context-governance tests assert the new standards source contract and absence of retired `.spec-first/standards/` active paths.
- `stop_if`: implementation needs a public standards workflow, runtime state root or script-owned semantic confirmation.

### T002 - Standards Source Skeleton

- `source_unit`: U2
- `goal`: Create the summary-first standards source surface, registry and scoped templates.
- `files`: `docs/standards/index.md` plus scoped standards files, candidate/archive README files and `tests/unit/team-standards-governance-contracts.test.js`.
- `test_focus`: registry, compact rule cards, candidate/archive separation, no whole-corpus duplication.
- `done_signal`: a downstream workflow can start at `docs/standards/index.md` and open only relevant scoped files.
- `stop_if`: a seed rule lacks current authority or needs owner confirmation not present in the plan.

### T003 - Workflow Consumption Contract

- `source_unit`: U3
- `goal`: Give plan/work/write-tasks/code-review/doc-review/debug the same rule-selection contract.
- `files`: `docs/contracts/team-standards.md`, six workflow skill files/references and their focused tests.
- `test_focus`: matched/excluded/uncertainty/fallback/limitations and confirmed/scope-matched hard context.
- `done_signal`: workflow tests prove no consumer defaults to full standards scans or retired artifacts.
- `stop_if`: the work requires a standards selector CLI or semantic script gate.

### T004 - Daily Workflow Integration

- `source_unit`: U4
- `goal`: Make standards useful in plan/task/work/debug/doc-review without expanding product scope.
- `files`: plan/work/write-tasks/doc-review/debug skill surfaces and focused tests.
- `test_focus`: decision-note, context_refs, closeout evidence, debug invariant and doc-review architecture/design-only use.
- `done_signal`: tests prove standards can constrain implementation while remaining subordinate to the source plan, reproduction and direct evidence.
- `stop_if`: standards consumption becomes workflow state, approval state or product requirement authority.

### T005 - Code Review Enforcement

- `source_unit`: U5
- `goal`: Extend project-standards review to confirmed standards docs with exact rule and diff/source evidence.
- `files`: `skills/spec-code-review/SKILL.md`, persona catalog, project-standards reviewer and review/agent tests.
- `test_focus`: confirmed-only findings, scope matching, generic best-practice suppression and missing-standards degradation.
- `done_signal`: project-standards reviewer can cite confirmed rule IDs without reading every standards file by default.
- `stop_if`: suggested/observed/imported/conflict/deprecated rules produce hard findings.

### T006 - Brownfield Initialization Docs

- `source_unit`: U6
- `goal`: Document explicit rules, observed patterns, suggested candidates, conflicts and promotion examples for large existing repos.
- `files`: standards candidate docs and `docs/05-用户手册/团队开发规范治理.md`.
- `test_focus`: code/graph/review-derived material stays advisory until source refs and promotion criteria exist.
- `done_signal`: maintainers can bootstrap a small slice without whole-repo policy claims.
- `stop_if`: guidance depends on graphify/codegraph availability or whole-repo extraction.

### T007 - User Docs And Route Absence

- `source_unit`: U7
- `goal`: Make team standards discoverable in docs without adding a command.
- `files`: README/user-doc files, gitignore reference and route/catalog tests.
- `test_focus`: docs point to source docs and tests keep `$spec-standards` / `/spec:standards` absent.
- `done_signal`: user docs explain source/runtime boundary and confirmed standards source examples.
- `stop_if`: discoverability requires a public standards workflow or generated runtime mirror.

### T008 - Standalone Governance Skill Skeleton

- `source_unit`: U9
- `goal`: Create a thin standalone skill with six modes, output boundaries and no-load-all reference map.
- `files`: `skills/team-standards-governance/**` source skeleton and skill/route tests.
- `test_focus`: progressive disclosure, proposal-only direct invocation, active source-edit workflow write boundary.
- `done_signal`: `SKILL.md` is a router and references hold mode-specific details.
- `stop_if`: the skill needs to auto-modify confirmed standards or appear in the public workflow route map.

### T009 - Acquisition Templates And Ledgers

- `source_unit`: U10
- `goal`: Create acquisition task-pack, fact/evidence/lineage/owner/promotion ledgers and output risk source templates.
- `files`: `docs/standards/candidates/*.md` source templates and governance contract tests.
- `test_focus`: single extraction target, source anchors, no local absolute paths, owner queue negative routing.
- `done_signal`: every candidate can be traced to an acquisition id and evidence source without becoming hard context.
- `stop_if`: templates need to support mixed unrelated surfaces in one run.

### T010 - Acquisition Quality Skill References

- `source_unit`: U10
- `goal`: Fill skill references for acquisition quality, source matrix, output risk and promotion/derived artifact boundaries.
- `files`: `skills/team-standards-governance/references/acquisition-quality.md`, `source-matrix.md`, `output-risk-profile.md`, `promotion-and-conflicts.md`, tests.
- `test_focus`: evidence score is not authority, provider_untrusted handling, warning routing and derived artifact citation.
- `done_signal`: reference tests prove quality gates produce next actions, not confirmed hard context.
- `stop_if`: quality gate pass or LLM confidence is treated as owner decision.

### T011 - Slicing And Role Interviews

- `source_unit`: U11
- `goal`: Add slicing strategy and role-specific interview playbook for architecture/security/testing/SRE/multi-surface/backend/data/business owners.
- `files`: candidate README/notes, role-interview reference, initialization reference, user guide, tests.
- `test_focus`: slice priority, privacy/redaction, owner decision semantics and open questions.
- `done_signal`: a maintainer can start one acquisition slice and preserve unanswered questions.
- `stop_if`: all teams or full repo must be interviewed before useful candidates can be produced.

### T012 - Replay And Eval Fixtures

- `source_unit`: U12
- `goal`: Add PR replay, retrieval eval, noise budget, owner edit distance guidance and eval fixtures.
- `files`: validation reference, eval JSON/README/examples, optional validation report and focused tests.
- `test_focus`: expected/non-hit rule IDs, false positives/negatives, sample insufficiency, no LLM self-pass, no absolute paths.
- `done_signal`: eval fixtures can review trigger/output quality and record `not-run` / `not-enough-sample` honestly.
- `stop_if`: validation claims pass without samples, owner evidence or explicit limitation status.

### T013 - Final Validation And Migration Audit

- `source_unit`: U13
- `goal`: Close the plan with focused tests, absence guards, migration/source-authority/rule-selection audits and changelog.
- `files`: `CHANGELOG.md`, validation reports and focused test files.
- `test_focus`: changed workflow/skill/reviewer tests, absence grep, diff check, path hygiene, derived artifact drift, source authority audit.
- `done_signal`: validation report lists commands, results, limitations and C1-C28 coverage; changelog is updated.
- `stop_if`: validation requires restoring retired standards behavior or changing source-plan scope.

## Orientation Evidence

- **provider:** `direct-repo-reads`
- **posture:** `bounded`
- **evidence_refs:**
  - `docs/plans/2026-06-21-004-feat-team-standards-governance-layer-plan.md`
  - `docs/10-prompt/结构化项目角色契约.md`
  - `skills/spec-plan/references/governance-boundaries.md`
  - `skills/spec-work/SKILL.md`
  - `skills/spec-write-tasks/SKILL.md`
  - `skills/spec-code-review/SKILL.md`
  - `skills/spec-doc-review/SKILL.md`
  - `skills/spec-debug/SKILL.md`
  - `agents/spec-project-standards-reviewer.agent.md`
  - `docs/contracts/context-governance.md`
  - related focused tests found with `rg --files`
  - `node bin/spec-first.js internal task-governance-signals --source plan-declared --input ... --json`
- **limitations:**
  - `task-governance-signals` returned `collection_status: degraded`, `reason_codes: ["planning-context-unreadable","candidate-lightweight"]`, and `candidate_level: lightweight`; this was treated as degraded advisory counter-evidence, not as task complexity authority.
  - No fresh-source subagent/doc-review was dispatched while compiling this task pack.
  - Some planned files do not exist yet; task `files` are concrete repo-relative future source paths and are intended execution ownership boundaries, not proof of current existence.
  - The source plan is `status: active`; if its body changes, this task pack must be regenerated because `source_plan_hash` will become stale.

## Validation Notes

- Source plan hash was computed with `node bin/spec-first.js tasks hash docs/plans/2026-06-21-004-feat-team-standards-governance-layer-plan.md`.
- The expected hash for this task pack is `sha256:9dd59db7d00e08e11a39106b3239432b0a88c253d3c132b4cc315879c07af11d`.
- Deterministic validation must be run with `node bin/spec-first.js tasks validate docs/tasks/2026-06-21-004-feat-team-standards-governance-layer-tasks.md --repo . --json`.
- Deterministic validation proves identity, freshness and `Task Pack Contract` structure only. It does not prove that the semantic split is optimal.
- Semantic review focus after validation: U10 fan-out, same-wave file overlap, over-broad docs tasks, review_gate usage, context_refs granularity and stop_if specificity.

## Regeneration Rules

Rebuild this task pack when any of these change:

- source plan body, implementation units, requirements, completion criteria or scope boundaries,
- `source_plan_hash`,
- `spec_id`,
- task-pack schema or validator field set,
- workflow source/runtime boundary rules,
- task split semantics after semantic review.

If `source_plan_hash` no longer matches the current source plan body, reject the task pack as stale and regenerate from the plan. If `spec_id` no longer matches, reject it as wrong-chain handoff.
