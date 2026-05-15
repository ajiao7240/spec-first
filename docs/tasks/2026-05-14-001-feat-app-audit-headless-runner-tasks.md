---
title: "feat: 固化 spec-app-consistency-audit headless runner — Task Pack"
type: "task-pack"
status: "derived"
date: "2026-05-14"
spec_id: "2026-05-04-002-app-audit-headless-runner"
source_plan: "docs/plans/2026-05-04-002-feat-app-audit-headless-runner-plan.md"
source_plan_hash: "sha256:c23eeaf4a7c6784a05425397e65443c723329f271fcc4c6d31010c60cdb1bc87"
generated_by: "spec-write-tasks"
mode: "derived"
target_repo: "spec-first"
source_sections:
  - "目标"
  - "非目标"
  - "Runner Contract 草案"
  - "实施单元"
  - "验证计划"
  - "完成定义"
---

# feat: 固化 spec-app-consistency-audit headless runner — Task Pack

## Overview

本任务包从 `docs/plans/2026-05-04-002-feat-app-audit-headless-runner-plan.md` 派生。计划目标是把 21 个脚本组成的 deterministic e2e recipe 固化为一个可复用 headless runner（`run-audit.js`），并建立 `issue_synthesis_status` 枚举与 fixture-dimensions registry，确保下游 `spec-code-review` 与 LLM 审查能够正确区分「未审计」与「审计通过」。

任务包按 4 个 wave 执行：

- **Wave 1（基础并行）**：T001 fixture helper + dimensions registry；T002 schema 枚举与 envelope 字段。
- **Wave 2（核心 runner）**：T003 新增 `run-audit.js`，串联 21 个脚本与三种 `merge-contracts` 调用形态。
- **Wave 3（依赖收尾）**：T004 metadata finalize；T005 SKILL.md prose 更新。
- **Wave 4（验证 + 用户面）**：T006 e2e 测试重写、用户文档更新、CHANGELOG。

源计划保留为 scope/acceptance 的唯一权威；任务包不增加新的 product scope。

## Source Summary

- **Source Plan**：`docs/plans/2026-05-04-002-feat-app-audit-headless-runner-plan.md`
- **Source Plan Hash**：`sha256:c23eeaf4a7c6784a05425397e65443c723329f271fcc4c6d31010c60cdb1bc87`
- **Spec ID**：`2026-05-04-002-app-audit-headless-runner`
- **Target Repo**：`spec-first`（单仓上下文，所有任务在 `spec-first` 仓库内执行）
- **Task-Ready Branch**：源计划已通过 doc-review + spec-plan deferred-resolution，frontmatter 完整，scope/acceptance 已收敛，承诺 `mode:headless` v1。
- **Consumed Source Sections**：`目标`、`非目标`、`Runner Contract 草案`、`实施单元`（U1–U4）、`验证计划`、`完成定义`。
- **Scope Boundaries**：runner 仅产出 deterministic facts/report/validation，不做 LLM verdict、不做 autofix、不实现 `mode:default`/`mode:report-only`、不手改 generated runtime 镜像、不接受 `--raw-issues` 入参（v1 deferred）。
- **Implementation-Time Unknowns**：subprocess 串联 wall-clock 基线（计划风险表登记）；如超出可接受阈值（< 5s）则在 T003/T004 评估改为同进程 `require + invoke`，不属于本任务包默认 scope。

## Traceability Matrix

| Source | Requirement / Acceptance | Task(s) | Validation |
| --- | --- | --- | --- |
| U1 | fixture helper、fixture-dimensions registry、fixture audit、覆盖 PRD/figma/route/KMP/analytics/i18n 维度 | T001 | helper 单测 + e2e 测试在 T006 完整跑通 |
| U2 | `run-audit.js` CLI、`--help`、参数与 mode 边界、串联 21 脚本、三种 merge-contracts 调用形态 | T003 | `--help` smoke + e2e 测试 + 失败 envelope 断言 |
| U2 | metadata finalize（`started → complete/degraded/failed`），与 SKILL.md lifecycle 对齐 | T004 | metadata.json 状态字段断言 + e2e 串联 |
| U3 | `issue_synthesis_status` 枚举（`not_run`/`llm_provided`/`fixture_provided`）写入 `issues.json`、`audit-report.json`、`headless-envelope.txt`，并由 `validate-artifacts.js` 校验 | T002, T003, T005 | 单测覆盖三种取值 + 缺失/越界报错 |
| U3 | runner 不生成 LLM verdict / 不内联 issue synthesis | T003, T005 | 代码审阅 + SKILL.md prose review |
| U4 | e2e 测试覆盖 enum 三态 + fixture-dimensions registry，禁止 silent skip | T001, T006 | 测试在 `npx jest tests/unit/spec-app-consistency-audit-cli-e2e.test.js` 通过 |
| U4 | 用户文档与 CHANGELOG 更新；不夸大 v1 能力 | T006 | `npm run lint:skill-entrypoints` + 人工 prose review |

每个源单元至少出现一次，任务集合覆盖了源计划的所有 R/AE 锚点。

## Task Graph

```
T001 ──┐
T002 ──┼──► T003 ──► T004 ──► T006
       │              │
       │              └──► T005 ──► T006
       └─► (T002 schema 必须先于 T003 写出枚举字段)
```

- T001 与 T002 可并行：T001 改测试 helper，T002 改 lib/validator/envelope schema，文件无重叠。
- T003 依赖 T001 fixture helper（用于自我验证）与 T002 枚举常量；同时执行所有串联编排。
- T004 与 T005 在 T003 完成后并行：T004 改脚本（metadata finalize），T005 改 SKILL.md prose；文件无重叠。
- T006 在 T003/T004/T005 全部完成后执行（测试需要完整 runner + finalize + 文档对齐）。

## Execution Waves

| Wave | Tasks | 备注 |
| --- | --- | --- |
| 1 | T001, T002 | 基础并行，文件无重叠 |
| 2 | T003 | 核心 runner，依赖 wave 1 |
| 3 | T004, T005 | 收尾并行，文件无重叠 |
| 4 | T006 | 端到端验证 + 用户面文档 |

同一 wave 内所有任务的 `files` 集合互斥，未引入 `**` 通配；跨 wave 才允许重叠（如 T003/T004 都触及 `run-audit.js`、`build-run-metadata.js`，已串行）。

## Task Pack Contract

```json
{
  "schema_version": "task-pack/v1",
  "execution_waves": [
    { "wave": 1, "tasks": ["T001", "T002"] },
    { "wave": 2, "tasks": ["T003"] },
    { "wave": 3, "tasks": ["T004", "T005"] },
    { "wave": 4, "tasks": ["T006"] }
  ],
  "tasks": [
    {
      "task_id": "T001",
      "source_unit": "U1",
      "requirement_refs": ["U1"],
      "goal": "把 e2e 测试中的 fixture 编排抽到共享 helper，并登记 fixture-dimensions registry + fixture audit。",
      "dependencies": [],
      "files": [
        "tests/helpers/app-audit-fixture.js",
        "tests/helpers/app-audit-fixture-dimensions.json"
      ],
      "expected_side_effects": [],
      "test_focus": "fixture helper 单元自检 + dimensions registry 全维度覆盖断言。",
      "done_signal": "helper 与 registry 文件存在,fixture audit 在缺维度时显式失败。",
      "wave": 1,
      "parallelizable": true,
      "review_gate": "optional",
      "review_focus": "fixture 是否引入新 product scope；dimensions registry 是否与计划列出的 6 个维度一致。",
      "stop_if": "需要新增 fixture 维度且未在源计划 U1 验收清单中,或需要修改 SKILL.md 与 product behavior。",
      "context_refs": [
        "docs/plans/2026-05-04-002-feat-app-audit-headless-runner-plan.md#U1-盘点并抽出当前-e2e-recipe",
        "tests/unit/spec-app-consistency-audit-cli-e2e.test.js"
      ],
      "entry_hint": "先读现有 e2e 测试,识别可复用的 PRD/figma/route fixture 写入函数,再抽到 helper。",
      "risk_note": "若把 runner 编排逻辑塞进 helper 会让 T003 难以判断职责边界。"
    },
    {
      "task_id": "T002",
      "source_unit": "U3",
      "requirement_refs": ["U3"],
      "goal": "在 audit-utils / validate-artifacts / render-headless-envelope 中加入 issue_synthesis_status 枚举常量与校验/输出位点(尚未消费时只暴露常量)。",
      "dependencies": [],
      "files": [
        "skills/spec-app-consistency-audit/scripts/lib/audit-utils.js",
        "skills/spec-app-consistency-audit/scripts/validate-artifacts.js",
        "skills/spec-app-consistency-audit/scripts/render-headless-envelope.js"
      ],
      "expected_side_effects": [],
      "test_focus": "枚举常量导出、校验函数对缺失/越界报错、envelope 字段透传。",
      "done_signal": "三个文件导出/校验/输出 issue_synthesis_status,缺失或越界 case 在单测中失败。",
      "wave": 1,
      "parallelizable": true,
      "review_gate": "required",
      "review_focus": "shared 常量与校验是否破坏现有 schema 契约;是否引入 LLM verdict 语义。",
      "stop_if": "校验逻辑需要判断 issue 严重度或语义,而非纯枚举校验。",
      "context_refs": [
        "docs/plans/2026-05-04-002-feat-app-audit-headless-runner-plan.md#U3-保持-LLM-verdict-外置",
        "skills/spec-app-consistency-audit/SKILL.md"
      ],
      "entry_hint": "先在 audit-utils.js 加 ISSUE_SYNTHESIS_STATUSES 常量,再让 validate-artifacts.js 引用,最后让 envelope 渲染读取该字段。",
      "risk_note": "envelope 输出格式变化可能影响 spec-code-review 解析,需保持向后兼容。"
    },
    {
      "task_id": "T003",
      "source_unit": "U2",
      "requirement_refs": ["U2", "U3"],
      "goal": "新增 run-audit.js,串联 21 个脚本,实现 --help、参数解析、mode:headless 边界、failed envelope、三种 merge-contracts 调用形态,并按 issue_synthesis_status 写出 issues.json/audit-report/envelope。",
      "dependencies": ["T001", "T002"],
      "files": [
        "skills/spec-app-consistency-audit/scripts/run-audit.js"
      ],
      "expected_side_effects": [],
      "test_focus": "--help 输出、缺 base 失败 envelope、非 headless mode 失败 envelope、fixture 完整 run 写出全部 artifacts。",
      "done_signal": "node skills/spec-app-consistency-audit/scripts/run-audit.js --help 输出参数说明;fixture 跑通生成 metadata/preflight/contracts/merged/report/manifest/envelope。",
      "wave": 2,
      "parallelizable": false,
      "review_gate": "required",
      "review_focus": "runner 是否越界做 LLM verdict;subprocess 编排顺序与 SKILL.md 描述是否一致;失败 envelope 是否覆盖所有 fail-fast 路径。",
      "stop_if": "需要把 issue 严重度判断或 issue synthesis 写进 runner;需要远程拉取 Figma/PRD;subprocess wall-clock 超过可接受阈值且需改架构。",
      "context_refs": [
        "docs/plans/2026-05-04-002-feat-app-audit-headless-runner-plan.md#U2-新增-headless-runner-CLI",
        "docs/plans/2026-05-04-002-feat-app-audit-headless-runner-plan.md#Runner-Contract-草案",
        "skills/spec-app-consistency-audit/scripts/lib/audit-utils.js",
        "tests/unit/spec-app-consistency-audit-cli-e2e.test.js"
      ],
      "entry_hint": "从现有 e2e 测试的脚本调用顺序开始,逐个 spawnSync/require 移到 runner;先实现 happy path,再补 failed envelope。",
      "risk_note": "21 个 subprocess 串联可能放大 wall-clock 延迟;若超阈值需在本任务内评估改为同进程 invoke。"
    },
    {
      "task_id": "T004",
      "source_unit": "U2",
      "requirement_refs": ["U2"],
      "goal": "在 runner 末尾(envelope 之前)调用 metadata finalize,把 metadata.json 从 started 升级为 complete/degraded/failed,与 SKILL.md lifecycle 对齐。",
      "dependencies": ["T003"],
      "files": [
        "skills/spec-app-consistency-audit/scripts/run-audit.js",
        "skills/spec-app-consistency-audit/scripts/build-run-metadata.js"
      ],
      "expected_side_effects": [],
      "test_focus": "metadata.json 状态字段在 happy path / 失败 / degraded 三种结局下取值正确。",
      "done_signal": "三种结局下 metadata.json 的 status 字段分别为 complete/degraded/failed,e2e 测试断言通过。",
      "wave": 3,
      "parallelizable": true,
      "review_gate": "optional",
      "review_focus": "finalize helper 是否在 envelope 渲染前调用;degraded 与 failed 的判定边界。",
      "stop_if": "需要让 finalize 步骤判断业务 issue 严重度,或需要回写 source plan/spec metadata。",
      "context_refs": [
        "docs/plans/2026-05-04-002-feat-app-audit-headless-runner-plan.md#U2-新增-headless-runner-CLI",
        "skills/spec-app-consistency-audit/SKILL.md",
        "skills/spec-app-consistency-audit/scripts/validate-artifacts.js"
      ],
      "entry_hint": "扩展 build-run-metadata.js 暴露 finalize 函数(或新增 helper),再在 run-audit.js 末尾调用。",
      "risk_note": "finalize 与 envelope 顺序错位会导致 envelope 显示已 complete 但实际 metadata 仍为 started。"
    },
    {
      "task_id": "T005",
      "source_unit": "U3",
      "requirement_refs": ["U3"],
      "goal": "更新 SKILL.md,明确 runner 是 deterministic pipeline、不承担 LLM verdict、v1 仅承诺 mode:headless,并描述 issue_synthesis_status 三态语义。",
      "dependencies": ["T003"],
      "files": [
        "skills/spec-app-consistency-audit/SKILL.md"
      ],
      "expected_side_effects": [],
      "test_focus": "npm run lint:skill-entrypoints 通过;prose 与计划完成定义对齐。",
      "done_signal": "SKILL.md 包含 runner 边界段、enum 三态语义、v1 mode 限制说明。",
      "wave": 3,
      "parallelizable": true,
      "review_gate": "required",
      "review_focus": "prose 是否夸大 v1 能力(如承诺 default/report-only);是否仍允许 runner 做语义 verdict 的描述漏网。",
      "stop_if": "需要修改 SKILL.md 的 mode 边界、artifact 路径或 LLM/脚本边界以外的内容。",
      "context_refs": [
        "docs/plans/2026-05-04-002-feat-app-audit-headless-runner-plan.md#U3-保持-LLM-verdict-外置",
        "docs/plans/2026-05-04-002-feat-app-audit-headless-runner-plan.md#非目标"
      ],
      "entry_hint": "定位现有 mode 描述段,在 headless 段补充 v1 仅承诺 headless 与 enum 三态。",
      "risk_note": "skill prose 漂移到承诺 default/report-only 会与 runner contract 冲突。"
    },
    {
      "task_id": "T006",
      "source_unit": "U4",
      "requirement_refs": ["U1", "U3", "U4"],
      "goal": "把 e2e 测试改为验证 runner contract,覆盖 enum 三态与 fixture-dimensions registry,并更新用户面文档与 CHANGELOG。",
      "dependencies": ["T003", "T004", "T005"],
      "files": [
        "tests/unit/spec-app-consistency-audit-cli-e2e.test.js",
        "docs/05-用户手册/04-workflows-artifacts-map.md",
        "docs/05-用户手册/10-产物目录.md",
        "CHANGELOG.md"
      ],
      "expected_side_effects": [],
      "test_focus": "runner happy path、缺 base 失败、非 headless mode 失败、enum 三态、fixture-dimensions audit、用户文档与 CHANGELOG 表述对齐。",
      "done_signal": "npx jest tests/unit/spec-app-consistency-audit-cli-e2e.test.js --runInBand 通过;npm run lint:skill-entrypoints 通过;CHANGELOG 含 user-visible 标记。",
      "wave": 4,
      "parallelizable": false,
      "review_gate": "required",
      "review_focus": "测试是否真正驱动 runner 而非旧 subprocess 链路;文档是否承诺 v1 之外的能力;CHANGELOG 作者是否取自当前 host developer profile。",
      "stop_if": "测试需要新增 fixture 维度且 T001 未覆盖,或文档需要描述 runner 不承诺的能力。",
      "context_refs": [
        "docs/plans/2026-05-04-002-feat-app-audit-headless-runner-plan.md#U4-更新测试与文档",
        "docs/plans/2026-05-04-002-feat-app-audit-headless-runner-plan.md#完成定义",
        "tests/helpers/app-audit-fixture.js",
        "tests/helpers/app-audit-fixture-dimensions.json"
      ],
      "entry_hint": "先用 T001 helper 重写测试 setup,再以 runner CLI 取代 21 个 spawnSync 调用,最后回到文档与 CHANGELOG。",
      "risk_note": "若文档/CHANGELOG 漂移到 v1 之外的承诺,会让下游 spec-code-review 误判 audit 范围。"
    }
  ]
}
```

## Task Cards

### T001 — 抽出 fixture helper 与 dimensions registry

- source_unit: U1
- goal: 把 e2e 测试中的 fixture 编排抽到共享 helper,并登记 fixture-dimensions registry + fixture audit。
- dependencies: []
- files:
  - tests/helpers/app-audit-fixture.js
  - tests/helpers/app-audit-fixture-dimensions.json
- requirement_refs: [U1]
- context_refs:
  - docs/plans/2026-05-04-002-feat-app-audit-headless-runner-plan.md#U1
  - tests/unit/spec-app-consistency-audit-cli-e2e.test.js
- entry_hint: 先识别可复用的 PRD/figma/route fixture 写入函数。
- test_focus: fixture helper 单元自检 + registry 全维度覆盖。
- done_signal: helper 与 registry 文件存在,fixture audit 在缺维度时显式失败。
- parallelizable: true
- risk_note: helper 不要承担 runner 编排逻辑。
- review_gate: optional
- review_focus: 是否引入新 product scope;6 个维度是否齐全。
- stop_if: 需要新增 fixture 维度且未在 U1 验收清单中。
- wave: 1

### T002 — issue_synthesis_status 枚举与校验入口

- source_unit: U3
- goal: 在 audit-utils / validate-artifacts / render-headless-envelope 中加入 issue_synthesis_status 枚举常量与校验/输出位点。
- dependencies: []
- files:
  - skills/spec-app-consistency-audit/scripts/lib/audit-utils.js
  - skills/spec-app-consistency-audit/scripts/validate-artifacts.js
  - skills/spec-app-consistency-audit/scripts/render-headless-envelope.js
- requirement_refs: [U3]
- context_refs:
  - docs/plans/2026-05-04-002-feat-app-audit-headless-runner-plan.md#U3
  - skills/spec-app-consistency-audit/SKILL.md
- entry_hint: 先在 audit-utils.js 加 ISSUE_SYNTHESIS_STATUSES 常量,再让 validator 引用。
- test_focus: 枚举导出 + 缺失/越界报错 + envelope 字段透传。
- done_signal: 三个文件分别导出/校验/输出枚举。
- parallelizable: true
- risk_note: envelope 输出格式变化要保持向后兼容。
- review_gate: required
- review_focus: 是否破坏现有 schema 契约;是否引入 LLM verdict 语义。
- stop_if: 校验逻辑需要判断 issue 严重度。
- wave: 1

### T003 — 新增 run-audit.js headless runner

- source_unit: U2
- goal: 新增 run-audit.js,串联 21 个脚本,实现 --help、参数解析、mode:headless 边界、failed envelope、三种 merge-contracts 调用形态,并按 enum 写出 artifacts。
- dependencies: [T001, T002]
- files:
  - skills/spec-app-consistency-audit/scripts/run-audit.js
- requirement_refs: [U2, U3]
- context_refs:
  - docs/plans/2026-05-04-002-feat-app-audit-headless-runner-plan.md#U2
  - docs/plans/2026-05-04-002-feat-app-audit-headless-runner-plan.md#Runner-Contract-草案
  - skills/spec-app-consistency-audit/scripts/lib/audit-utils.js
  - tests/unit/spec-app-consistency-audit-cli-e2e.test.js
- entry_hint: 从现有 e2e 测试的脚本调用顺序开始,逐个移到 runner。
- test_focus: --help / 缺 base 失败 / 非 headless mode 失败 / fixture happy path。
- done_signal: --help 输出 + fixture 完整 artifact chain 通过 validate-artifacts。
- parallelizable: false
- risk_note: 21 个 subprocess 串联会放大 wall-clock 延迟。
- review_gate: required
- review_focus: 是否越界做 LLM verdict;subprocess 顺序;失败 envelope 覆盖。
- stop_if: 需要把 issue 严重度判断写进 runner;subprocess wall-clock 超阈值需改架构。
- wave: 2

### T004 — metadata finalize 收尾

- source_unit: U2
- goal: 在 envelope 渲染前调用 metadata finalize,把 metadata.json 从 started 升级为 complete/degraded/failed。
- dependencies: [T003]
- files:
  - skills/spec-app-consistency-audit/scripts/run-audit.js
  - skills/spec-app-consistency-audit/scripts/build-run-metadata.js
- requirement_refs: [U2]
- context_refs:
  - docs/plans/2026-05-04-002-feat-app-audit-headless-runner-plan.md#U2
  - skills/spec-app-consistency-audit/SKILL.md
  - skills/spec-app-consistency-audit/scripts/validate-artifacts.js
- entry_hint: 扩展 build-run-metadata.js 暴露 finalize 函数,再在 runner 末尾调用。
- test_focus: 三种结局下 metadata.json 状态字段。
- done_signal: e2e 测试断言通过。
- parallelizable: true
- risk_note: finalize 与 envelope 顺序错位会失真。
- review_gate: optional
- review_focus: finalize 调用时序;degraded/failed 边界。
- stop_if: 需要 finalize 判断业务 issue 严重度。
- wave: 3

### T005 — SKILL.md prose 对齐

- source_unit: U3
- goal: SKILL.md 明确 runner 是 deterministic pipeline、v1 仅承诺 mode:headless、enum 三态语义。
- dependencies: [T003]
- files:
  - skills/spec-app-consistency-audit/SKILL.md
- requirement_refs: [U3]
- context_refs:
  - docs/plans/2026-05-04-002-feat-app-audit-headless-runner-plan.md#U3
  - docs/plans/2026-05-04-002-feat-app-audit-headless-runner-plan.md#非目标
- entry_hint: 定位现有 mode 描述段补充 v1 边界与 enum。
- test_focus: lint:skill-entrypoints + 计划完成定义对齐。
- done_signal: SKILL.md 含 runner 边界段、enum 三态、v1 mode 限制。
- parallelizable: true
- risk_note: prose 漂移到 default/report-only 承诺会与 runner contract 冲突。
- review_gate: required
- review_focus: 是否夸大 v1 能力;是否仍漏网的 LLM verdict 描述。
- stop_if: 需要修改 mode 边界以外的内容。
- wave: 3

### T006 — e2e 测试 + 用户文档 + CHANGELOG

- source_unit: U4
- goal: 改写 e2e 测试驱动 runner,覆盖 enum 三态与 fixture-dimensions registry;更新用户面文档与 CHANGELOG。
- dependencies: [T003, T004, T005]
- files:
  - tests/unit/spec-app-consistency-audit-cli-e2e.test.js
  - docs/05-用户手册/04-workflows-artifacts-map.md
  - docs/05-用户手册/10-产物目录.md
  - CHANGELOG.md
- requirement_refs: [U1, U3, U4]
- context_refs:
  - docs/plans/2026-05-04-002-feat-app-audit-headless-runner-plan.md#U4
  - docs/plans/2026-05-04-002-feat-app-audit-headless-runner-plan.md#完成定义
  - tests/helpers/app-audit-fixture.js
  - tests/helpers/app-audit-fixture-dimensions.json
- entry_hint: 用 T001 helper 重写测试 setup,再用 runner CLI 取代 21 个 spawnSync 调用。
- test_focus: runner happy path / 缺 base / 非 headless mode / enum 三态 / fixture audit / 文档与 CHANGELOG 对齐。
- done_signal: jest e2e 通过 + lint:skill-entrypoints 通过 + CHANGELOG 含 user-visible 标记。
- parallelizable: false
- risk_note: 文档漂移到 v1 之外的承诺会让 spec-code-review 误判范围。
- review_gate: required
- review_focus: 测试是否真正驱动 runner;文档承诺范围;CHANGELOG 作者来源。
- stop_if: 测试需要新增 fixture 维度且 T001 未覆盖;文档需要描述 runner 不承诺的能力。
- wave: 4

## Orientation Evidence

- provider: direct-repo-reads
- posture: bounded
- evidence_refs:
  - skills/spec-app-consistency-audit/SKILL.md(行 5–30,mode 边界与 artifact lifecycle)
  - skills/spec-app-consistency-audit/scripts/lib/audit-utils.js(行 2–34,APP_AUDIT_MODES、SKIPPED_DIRS、makeArtifact)
  - skills/spec-app-consistency-audit/scripts/validate-artifacts.js(行 2–16,ARTIFACT_CONTRACT_STATUSES、METADATA_STATUSES)
  - skills/spec-app-consistency-audit/scripts/render-headless-envelope.js(行 2–27,renderHeadlessEnvelope/renderHeadlessFailureEnvelope)
  - tests/unit/spec-app-consistency-audit-cli-e2e.test.js(行 1–32,runNode/runNodeRaw 串联 helper)
- limitations:
  - Pre-facts tier: bounded-reads (graph_stale_bounded_reads),21 个 extract-* 与 build-* 脚本未直读,任务边界基于源计划与 SKILL.md/test e2e 推断。
  - Subprocess wall-clock 基线尚未实测,T003 风险由源计划已登记的风险表覆盖。

## Validation Notes

- 任务包派生自 `docs/plans/2026-05-04-002-feat-app-audit-headless-runner-plan.md`,源计划 hash:`sha256:c23eeaf4a7c6784a05425397e65443c723329f271fcc4c6d31010c60cdb1bc87`,通过 `node bin/spec-first.js tasks hash <plan-path>` 计算。
- spec_id 与源计划一致(`2026-05-04-002-app-audit-headless-runner`),非 wrong-chain 派生。
- `Task Pack Contract` 已包含可机读 JSON,可由 `spec-first tasks validate <task-pack-path> --json` 验证 frontmatter 与结构。
- 同 wave 内 `files` 集合互斥(W1: T001/T002 文件不重叠;W3: T004/T005 文件不重叠);跨 wave 重叠文件(`run-audit.js`、`build-run-metadata.js`)已串行。
- 拒绝条件:hash 不匹配、spec_id 与源计划不一致、源计划 frontmatter 改动后未重算 hash、stop_if 触发但任务仍试图扩大 scope。
- 最能证明拆分有用的验证:T006 e2e 在不修改源计划 scope 的前提下覆盖 enum 三态 + fixture-dimensions registry,且 runner 失败 envelope 在缺 base / 非 headless mode 下行为一致。

## Regeneration Rules

发生以下变更时必须重建任务包:

- `docs/plans/2026-05-04-002-feat-app-audit-headless-runner-plan.md` 主体改动(包括 scope/acceptance/U-ID 边界)。
- 源计划 frontmatter 中 `spec_id` 或 `target_repo` 变化。
- `Implementation Units` 增删或重排导致 T-ID/U-ID 映射失真。
- `Files` 集合调整导致同 wave 内出现新的文件重叠。
- 验证策略(`Validation Notes`)发生根本变化(例如不再依赖 `validate-artifacts.js`)。

如果 `source_plan_hash` 与当前源计划不一致,执行必须被拒绝并重新派生任务包。如果 `spec_id` 不匹配,视为 wrong-chain handoff,必须从源计划重建。如果某个任务的 `stop_if` 在执行中触发,返回 `spec-plan` 或重跑 `spec-write-tasks`,不要在原任务包内扩大 scope。
