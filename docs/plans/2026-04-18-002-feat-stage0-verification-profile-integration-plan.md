---
title: feat: Add Stage-0 verification profile and platform-aware workflow handoff
type: feature
status: superseded
date: 2026-04-18
origin: docs/plans/2026-04-18-cross-language-multi-platform-ai-dev-assistance-strategy.md
related:
  - docs/plans/2026-04-18-spec-first-ai-dev-quality-remediation-plan.md
  - docs/plans/2026-04-18-cross-language-multi-platform-ai-dev-assistance-strategy.md
---

# feat: Add Stage-0 verification profile and platform-aware workflow handoff

**Target repo:** `spec-first`

## Overview

本计划把“跨语言、多端 AI 开发辅助”中的最高杠杆下一步收敛成可直接施工的实现范围：

1. 为 Stage-0 新增 `verification-profile.json` machine contract
2. 把该 contract 编译进现有 `bootstrap-compiler` 主链
3. 让 `spec-plan`、`spec-work`、`spec-code-review` 能稳定消费这份 profile，而不是继续只给泛化测试建议

本计划刻意**不**同时展开 Android verifier、Desktop verifier、CI 总 gate、compound 回灌等后续扩展。原因很简单：如果先没有 `verification-profile` 这份 control-plane 真源，后续所有 verifier 编排都会继续停留在 prompt prose 和人工猜测层。

## Problem Frame

当前仓库已经具备三块关键基础：

1. `src/crg/parser.js`、`src/crg/input-convergence.js` 已具备多语言事实提取底子
2. `src/context-routing/loader.js`、`src/context-routing/evaluator.js` 已形成稳定的 Stage-0 control-plane 消费主链
3. `skills/test-browser/SKILL.md`、`skills/test-xcode/SKILL.md` 已存在平台验证能力积木

但系统仍缺一个关键中间层：

- 当前 Stage-0 不会稳定输出“这个仓库属于哪些平台、有哪些测试框架、哪些验证是 required gate、哪些 verifier 可用”的统一 machine-readable profile。
- `spec-plan`、`spec-work`、`spec-code-review` 因此只能停留在“建议跑 `npm test` / `pytest` / `go test`”的泛化层，无法把 Stage-0 事实真正转成平台感知验证建议。
- 后续即使继续增加 verifier 数量，也仍然不知道“这次任务最少该验证什么”。

换句话说，当前系统的问题不是缺更多 verifier，而是缺：

`repo facts -> verification profile -> workflow handoff`

这条桥。

## Requirements Trace

- R1. 为 Stage-0 新增 `verification-profile.json` contract，并纳入 `docs/contracts/spec-graph-bootstrap/` 与 schema loader 体系。
- R2. `verification-profile.json` 必须由当前仓库真实信号推导，而不是写死 sample-only 常量。
- R3. profile 的主分类必须是平台面，而不是语言面；语言只作为辅助维度。
- R4. `artifact-manifest.json` 必须把 `verification-profile.json` 视为正式 output，而不是临时旁路文件。
- R5. `spec-plan`、`spec-work`、`spec-code-review` 必须通过现有 Stage-0 evaluator / loader 主链消费该 profile，禁止走第二套直接文件读取约定。
- R6. profile 缺失或解析失败时必须触发降级，不得伪造验证要求。
- R7. 本轮只要求“读 profile 并输出 required/optional verification guidance”，不要求直接自动调用 verifier skill。

## Scope Boundaries

### In Scope

- `verification-profile.json` schema
- compiler 内的 profile 生成逻辑
- manifest / checked-in sample / schema loader 同步
- minimal-context 对 verification focus 的最小暴露
- workflow contract 接入与合同测试

### Out of Scope

- 新增 Android / Desktop verifier
- 自动执行 `test-browser`、`test-xcode`
- CI 分支保护与新的 GitHub workflow
- compound 回灌 verification learnings
- `change surface -> per-diff verification recommendation` 的完整实现

这些都应建立在本计划完成后的稳定 profile 真源之上。

## Current Code Facts

### Fact 1: Stage-0 compiler 仍主要生成 minimal-context / freshness / lint / contradictions

- `src/bootstrap-compiler/compile-machine-artifacts.js`
  - 当前只输出 `minimal_context`、`freshness`、`lint_report`、`contradictions`
  - 没有 verification profile

### Fact 2: routing / manifest 仍由 sample generator 驱动

- `src/bootstrap-compiler/compile-routing.js`
  - 当前直接调用 `sample-generator`
- `src/bootstrap-compiler/sample-generator.js`
  - 当前 `artifact-manifest` 输出里没有 `verification-profile.json`

### Fact 3: schema loader 当前只认四类 schema

- `src/bootstrap-compiler/schema-loader.js`
  - 当前只加载：
    - `artifact-manifest.schema.json`
    - `context-routing.schema.json`
    - `minimal-context.schema.json`
    - `freshness.schema.json`

### Fact 4: workflow 已经围绕 evaluator output contract 收敛

- `tests/unit/workflow-stage0-consumption.test.js`
  - 已锁定 `selected_assets / fallback_reason / level / skipped_rules`
- `skills/spec-plan/SKILL.md`
- `skills/spec-work/SKILL.md`
- `skills/spec-code-review/SKILL.md`

这意味着新增 verification profile 时，不应发明第二套 workflow preload 语义，而应继续走现有 evaluator contract。

### Fact 5: 当前仓库已存在平台 verifier 积木，但还未统一调度

- `skills/test-browser/SKILL.md`
- `skills/test-xcode/SKILL.md`
- `skills/spec-mcp-setup/mcp-tools.json`

因此本轮可以只先落“平台验证画像 + workflow handoff”，暂不落自动执行。

## Design Goals

1. **统一真源**
   - verification profile 是 control-plane contract，不是 workflow 文本约定
2. **平台优先**
   - 主分类按 `web / mobile-ios / mobile-android / backend / desktop / shared-contract / unknown`
3. **可降级**
   - 不确定时输出 `unknown` / `confidence: low`，不做猜测式强判
4. **最小接入**
   - 先影响 Stage-0 产物和 workflow guidance，不直接引入自动执行编排
5. **保持 sample 同步约束**
   - 继续沿用 checked-in sample + schema + compiler output 三方一致性模式

## Proposed Contract

### File

- `.spec-first/workflows/bootstrap/<slug>/verification-profile.json`

### Required top-level fields

- `schema_version`
- `generated_at`
- `profile_id`
- `platforms`
- `languages`
- `detected_test_frameworks`
- `required_gates`
- `optional_gates`
- `verifier_hints`
- `environment_prerequisites`
- `fallback_reason`

### Platform enum

- `web`
- `mobile-ios`
- `mobile-android`
- `backend`
- `desktop`
- `shared-contract`
- `unknown`

### Gate model

每个 gate 建议最小结构：

- `id`
- `kind`
- `scope`
- `required`
- `reason`
- `suggested_commands`
- `evidence_type`

### Verifier hint model

每个 hint 建议最小结构：

- `verifier`
- `platforms`
- `available`
- `prerequisites`
- `evidence_outputs`

### Design constraints

- `platforms` 可多值
- `languages` 是辅助上下文，不能替代 `platforms`
- `required_gates` 与 `optional_gates` 必须结构一致，只通过 `required` 布尔和分组位置区分
- `suggested_commands` 允许为空数组，不允许编造不存在的命令

## Inference Strategy

### Signal sources

#### Platform signals

优先基于当前可验证的仓库事实做推断：

- 文件路径命中
  - `src/app/`、`app/`、`pages/`、`components/`、`public/`、`playwright`、`cypress` 倾向 `web`
  - `ios/`、`.xcodeproj`、`.xcworkspace`、`Podfile`、`.swift` 倾向 `mobile-ios`
  - `android/`、`app/src/main/AndroidManifest.xml`、`.kt`、`.kts`、`build.gradle` 倾向 `mobile-android`
  - `src/main/java`、`src/main/kotlin`、`server/`、`api/`、`routes/`、`controllers/`、`fastapi`、`flask`、`spring` 倾向 `backend`
  - `electron`、`tauri`、`desktop` 倾向 `desktop`
  - `openapi`、`proto`、`schema`、`contracts` 倾向 `shared-contract`

#### Language signals

- 复用 `src/crg/input-convergence.js` 的 `presentLanguages` 推导结果或同口径扩展

#### Test framework signals

优先基于文件与依赖：

- `playwright.config.*` -> `playwright`
- `cypress.config.*` -> `cypress`
- `pytest.ini` / `conftest.py` -> `pytest`
- `jest.config.*` -> `jest`
- `vitest.config.*` -> `vitest`
- `pom.xml` / `build.gradle*` + `src/test/java` -> `junit`
- `Package.swift` / `xcodebuild` project signals -> `xctest`

### Confidence strategy

- 命中多个强信号 -> `high`
- 命中单强信号或多个弱信号 -> `medium`
- 仅路径启发式、缺少框架/测试面支撑 -> `low`

### Non-goals

- 本轮不做 package manager 级全量依赖解析器
- 本轮不做 AST 级 verifier recommendation
- 本轮不做 diff-aware impact analysis

## Integration Design

## Unit 1: Add schema and checked-in sample contract

### Files

- New: `docs/contracts/spec-graph-bootstrap/verification-profile.schema.json`
- Modify: `src/bootstrap-compiler/schema-loader.js`
- Modify: `tests/unit/spec-graph-bootstrap-contracts.test.js`
- New checked-in sample:
  - `.spec-first/workflows/bootstrap/spec-first/verification-profile.json`

### Decisions

- 继续复用现有 `loadBootstrapSchemas()` 模式，把 verification profile 作为第五类正式 schema
- checked-in sample 仍以 `spec-first` 仓库为默认 fixture

### Test scenarios

- schema loader 能加载 verification profile schema
- checked-in sample 通过 schema 校验
- sample 中 `platforms`、`required_gates`、`verifier_hints` 结构合法

## Unit 2: Compile verification profile into machine artifacts

### Files

- New: `src/bootstrap-compiler/compile-verification-profile.js`
- Modify: `src/bootstrap-compiler/compile-machine-artifacts.js`
- Modify: `src/bootstrap-compiler/orchestrator.js`
- Modify: `src/bootstrap-compiler/run-bootstrap.js`
- Modify: `tests/unit/spec-graph-bootstrap-compiler.test.js`

### Decisions

- 新增独立 compiler 模块，不把 verification 推断直接塞进 `compile-machine-artifacts.js`
- `compile-machine-artifacts.js` 只负责 orchestration，不吞并推断细节
- `run-bootstrap.js` 负责把产物写入 control plane

### Suggested output shape in orchestrator result

- `machine_artifacts.verification_profile`

### Test scenarios

- `compileBootstrapArtifacts()` 返回 `machine_artifacts.verification_profile`
- `runBootstrap()` 会写出 `verification-profile.json`
- rerun 不会漏写 profile
- 写入失败时 rollback 行为与其他 control-plane 产物一致

## Unit 3: Register verification profile in artifact manifest and routing model

### Files

- Modify: `src/bootstrap-compiler/sample-generator.js`
- Modify: `src/bootstrap-compiler/compile-routing.js`
- Modify: `docs/contracts/spec-graph-bootstrap/artifact-manifest.schema.json`
- Modify: `tests/unit/spec-graph-bootstrap-contracts.test.js`

### Decisions

- `artifact-manifest.json` 必须显式记录 `verification-profile.json`
- 当前 routing 不要求把 `verification-profile.json` 本身加入 `selected_assets`
- verification profile 应通过 minimal-context 暴露必要摘要，而不是直接把整份 JSON 塞给每个 workflow

### Rationale

整份 profile 更适合被 loader / helper 读取并提炼，不适合默认注入所有上下文窗口。

### Test scenarios

- sample generator 产出的 manifest 含 `verification-profile.json`
- checked-in manifest sample 与 generator 保持一致
- schema 校验通过

## Unit 4: Expose verification summary in minimal-context

### Files

- Modify: `src/bootstrap-compiler/compile-minimal-context.js`
- Modify: `docs/contracts/spec-graph-bootstrap/minimal-context.schema.json`
- Modify: `.spec-first/workflows/bootstrap/spec-first/minimal-context/plan.json`
- Modify: `.spec-first/workflows/bootstrap/spec-first/minimal-context/work.json`
- Modify: `.spec-first/workflows/bootstrap/spec-first/minimal-context/review.json`
- Modify: `tests/unit/spec-graph-bootstrap-contracts.test.js`

### Decisions

- `plan` 暴露：
  - `platform_focus`
  - `required_verifications`
- `work` 暴露：
  - `required_verifications`
  - `optional_verifications`
- `review` 暴露：
  - `verification_gaps_to_check`

### Constraints

- minimal-context 只暴露摘要，不复制整份 JSON
- 若 verification profile 缺失，只允许 `fallback_reason` 和空数组，不允许伪造验证项

### Test scenarios

- compiler 产出的 minimal-context 与 checked-in sample 一致
- schema 放宽到支持新的 verification 摘要字段
- profile 缺失时 minimal-context 仍合法

## Unit 5: Workflow contract consumption

### Files

- Modify: `skills/spec-plan/SKILL.md`
- Modify: `skills/spec-work/SKILL.md`
- Modify: `skills/spec-code-review/SKILL.md`
- Modify: `tests/unit/workflow-stage0-consumption.test.js`
- Modify: `tests/unit/spec-plan-contracts.test.js`
- Modify: `tests/unit/spec-work-contracts.test.js`

### Decisions

- workflow 文本只承认 evaluator / loader 输出摘要，不直接自己打开 `verification-profile.json`
- `spec-plan` 增加 verification matrix planning 要求
- `spec-work` 增加 required gate checklist 要求
- `spec-code-review` 增加 verification completeness 检查要求

### Test scenarios

- workflow 文本提到 verification summary 消费，但不引入第二套 preload 真源
- 缺少 profile 时，workflow 文本要求降级说明
- 只改 docs / prompt 时，不被误导成必须执行多端验证

## Pattern Anchors

- `src/bootstrap-compiler/compile-minimal-context.js`
  - 现有 minimal-context 字段组织方式
- `src/bootstrap-compiler/schema-loader.js`
  - 现有 schema 注册方式
- `tests/unit/spec-graph-bootstrap-contracts.test.js`
  - checked-in sample 与 compiler / schema 同步守护方式
- `tests/unit/spec-graph-bootstrap-compiler.test.js`
  - compiler 与 runBootstrap 行为测试模式
- `tests/unit/workflow-stage0-consumption.test.js`
  - Stage-0 workflow consumption contract 守护方式

## Sequencing

1. 先落 schema + sample contract
2. 再落 compiler 生成与 runBootstrap 写盘
3. 再把 manifest / minimal-context 接上
4. 最后改 workflow contract

这个顺序必须保持，原因是：

- workflow 文本若先改，会先于 control-plane 真源漂移
- minimal-context 若先扩字段，会先依赖不存在的 profile

## Risks

### Risk 1: 平台推断过度激进

如果仅凭文件路径就强判平台，容易把混合仓库误判为多平台强 required gate。

Mitigation:

- 引入 `confidence`
- 对低置信度结果默认只进入 optional guidance

### Risk 2: minimal-context 膨胀

如果把 profile 细节大量复制进 minimal-context，会损害当前“最小上下文”设计目标。

Mitigation:

- minimal-context 只保留摘要
- 整份 JSON 只作为 control-plane 辅助读取对象

### Risk 3: workflow 漂移

如果 workflow 直接读取 profile 文件，会绕开 evaluator contract。

Mitigation:

- 测试明确禁止第二套 preload 真源
- 只允许经 loader/helper 暴露摘要

## Success Metrics

本计划完成后，以下结果必须同时成立：

1. `runBootstrap()` 会稳定写出 `verification-profile.json`
2. checked-in `spec-first` sample 与 compiler 输出、schema 校验三方一致
3. `plan/work/review` minimal-context 含最小 verification 摘要
4. `spec-plan` / `spec-work` / `spec-code-review` 合同测试明确包含 verification guidance
5. profile 缺失时主链降级，不报假阳性 required gate

## Verification Commands

实现完成后至少要跑：

```bash
npm test -- --runTestsByPath \
  tests/unit/spec-graph-bootstrap-contracts.test.js \
  tests/unit/spec-graph-bootstrap-compiler.test.js \
  tests/unit/workflow-stage0-consumption.test.js \
  tests/unit/spec-plan-contracts.test.js \
  tests/unit/spec-work-contracts.test.js
```

如 compiler 主链改动影响较大，再补：

```bash
npm run test:integration
```

## Starting Point

建议从这几个文件开始：

1. `docs/contracts/spec-graph-bootstrap/`
2. `src/bootstrap-compiler/schema-loader.js`
3. `src/bootstrap-compiler/compile-machine-artifacts.js`
4. `src/bootstrap-compiler/run-bootstrap.js`
5. `tests/unit/spec-graph-bootstrap-contracts.test.js`

原因：

- 这些文件共同定义了 Stage-0 control-plane 的 contract surface
- 先锁 contract，再改 compiler，最后再改 workflow，返工最少

## Open Questions

### Resolved in this plan

- verification profile 是否属于 control-plane 正式产物？
  - 是，必须进入 manifest 与 checked-in sample。
- profile 主分类按语言还是按平台？
  - 按平台。
- workflow 是否直接读取 JSON？
  - 否，继续走现有 evaluator / loader handoff。

### Deferred

- Android verifier 的正式 skill / MCP 接入方式
- Desktop verifier 的 contract
- diff-aware required verification recommendation
- verification profile 是否需要进入 `context-routing.json` 的 selection rules

这些都留到本计划完成之后再推进。
