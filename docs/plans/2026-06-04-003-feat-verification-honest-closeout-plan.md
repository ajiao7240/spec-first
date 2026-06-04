---
title: "feat: Verification Profile + Run Summary + Honest Closeout（v1.13）"
type: feat
status: completed
date: 2026-06-04
spec_id: 2026-06-04-003-feat-verification-honest-closeout
depth: deep
origin:
  - docs/01-需求分析/13.scale集成/spec-first内化集成scale-project-scaffold技术方案.md
  - docs/01-需求分析/13.scale集成/project-scaffold依赖安装流程与spec-first-setup优化技术方案.md
  - docs/01-需求分析/13.scale集成/README.md
host: claude+codex
slice: v1.13（父方案 Phase B / P0 可信交付基线）
implements_schemas:
  - docs/contracts/verification/verification-profile.schema.json
  - docs/contracts/verification/verification-run-summary.schema.json
  - docs/contracts/workflows/honest-closeout.schema.json
  - docs/contracts/workflows/spec-work-run-artifact.schema.json
---

# feat: Verification Profile + Run Summary + Honest Closeout（v1.13）

**Target repo:** `spec-first`

## Summary

把 SCALE 集成父方案 Phase B 的三份可信交付合同（`verification-profile.v1`、`verification-run-summary.v1`、`honest-closeout.v1`）落成 source contracts + deterministic helpers，并在 `spec-work` closeout 兑现第一处 named workflow 行为变化：验证结论从"自述测试通过"变为引用结构化 check 的 `passed/failed/not-run/degraded`，缺结构化 claim 或证据时降级为 `degraded` 而非静默通过。这同时闭合 v1.11–v1.12 readiness baseline 的 workflow consuming gate。

---

## Problem Frame

v1.11–v1.12 已经把 dependency/provider readiness 做成 deterministic facts，并由 `doctor.decision_input_health` 直接消费（direct consumer gate 已过）。但按父方案 §0.0，readiness baseline 是 **enabling infrastructure**——它面向 workflow 的消费门槛要到 v1.13 接入 `spec-work` closeout 才真正闭合。在此之前，`spec-work` 的最终回复仍可能出现父方案 §4.6 列出的谎报模式：

```text
没跑测试却说测试通过。
dry-run 被说成验证通过。
required_tools 缺失却把 check 写成 passed。
只读 summary 却说已确认源码。
```

当前 source 现状（已直接核对）：

- `docs/contracts/verification/` 目录、`spec-first.verification.json`、`verification-run-summary` / `honest-closeout` / `verification-profile` helper **均不存在**。
- `spec-work-run-artifact/v1`（`docs/contracts/workflows/spec-work-run-artifact.schema.json`）的 `script_confirmed.validation.commands[]` 当前是 `required` + `additionalProperties:false`，自带逐 check 明细——与父方案 §4.4/§4.5「`verification-run-summary` 是逐 check 明细唯一来源、`validation` 只保留聚合 status + ref」直接冲突。
- `spec-work` closeout（`skills/spec-work/references/shipping-workflow.md` Phase 4 的 "Evaluate Durable Evidence Triggers" 步骤）已有 durable evidence trigger 链与 producer 调用，但 trigger `trigger-not-run-validation`（`shipping-workflow.md:108`）依赖的"验证状态"目前没有结构化 check 来源，只能靠 LLM 自述。

父方案要解决的桥是：

`repo verification facts -> structured run summary -> structured closeout claim -> honest verdict`

这条桥的 deterministic 牙齿建立在 `verification-run-summary` 的真实 `exit_code` 之上，因此 profile + run-summary + honest-closeout 三者必须同相位交付（父方案 Phase B）。

---

## Requirements

- R1. 新增 `verification-profile.v1` source contract（schema + docs），canonical 字段以 project-scaffold 子方案 §4.4 为准（`schema_version`/`default_profile`/`profiles.{services,checks}`/`services.{path,stack,required}`/`stacks.{detect,commands,runner_kind,required_tools}`，**不含 `productSmoke`**——它在子方案 §2.5/§13 是 intent，未进 §4.4 canonical，本切片不私自加字段，profile 实例 canonical 路径是 repo root 的 `spec-first.verification.json`（checked-in），本地覆盖走 `.spec-first/verification-profile.local.json`（gitignored）。**该文件已有现存消费者** `scanVerificationProfile`（`skills/spec-mcp-setup/scripts/scan-configured-deps.cjs:236`），但它当前读的是 **flat 顶层 `profile.checks[]` 的 `{id, command}`**，与 §4.4 canonical（check 是 `profiles.<name>.checks` 下的 id 字符串，命令经 `stacks.<key>.commands.<check>` 解析）**不兼容**。落 canonical schema 时必须**同步更新 `scanVerificationProfile` 走 canonical 解析**，否则它读 `undefined` 静默扫到 0 个 verification 依赖；不造第二套读取约定。
- R2. 新增 `verification-run-summary.v1` source contract（schema + docs），canonical 字段以父方案 §4.4 为准：顶层 `checks[]`，每条含 `id/service/command/status/exit_code/ran/required_tools/missing_tools/log_path/reason_code`，顶层含 `generated_at/profile`。
- R3. 新增 `honest-closeout.v1` source contract（schema + docs），canonical claim 校验模型以父方案 §4.6 为准：`claims[]` 为 `{claim_type, asserted_status, evidence_refs[], verdict, reason_code}`，`claim_type` 固定枚举 `validation/impact_surface/review/knowledge_promotion`，顶层 `overall/overall_reason_code`。
- R4. 提供 deterministic helpers：verification-profile loader（只解析不裁决）、verification-run-summary capture（不重跑命令、不推断 exit_code）、honest-closeout validator（只做 schema 级关系校验，不解析自然语言）。三者复用现有 target-repo containment + secret-deny + schema-validator，不重造校验。
- R5. `spec-work-run-artifact` 与 `verification-run-summary` 是单向引用：bump 到 `spec-work-run-artifact/v2`，`script_confirmed.validation` 改为 `{status, reason_code, run_summary_ref}`，移除 `commands[]`；v1 artifact 仍可读（read/prune 兼容）。**同时 bump payload 层 `PAYLOAD_SCHEMA_VERSION`**（`spec-work-run-artifact-payload/v1` → `/v2`），payload 侧 `validateValidation` 从 require `commands[]` 改为 require `run_summary_ref`——payload 与 artifact 两层不可只改一层。
- R6. `spec-work` closeout（shipping-workflow Phase 4）接入：执行验证后用 capture helper 写 run-summary，closeout 产结构化 honest-closeout claims，最终回复的验证/沉淀 claim 可追溯到结构化 claim 对象与其 evidence refs。
- R7. dry-run 只能映射成 `not-run` + `reason_code=schedulable`，不得写成 `passed`；required_tools 缺失记 `not-run: missing_dependency`，不自动安装。
- R8. 缺结构化 claim 对象时 honest-closeout 返回 `degraded`（honest-but-unverifiable），不得标记 verified；任一 claim `unsupported` 则 overall 不得为 verified。
- R9. 不新增中心 runner、不接管命令执行；helper 只在"执行后立即捕获"约定下工作，诚实边界写进合同（capture 可信度 = workflow 当步如实转录，弱于进程级监督）。
- R10. v1.13 consuming gate：`[CON-READY-001]` 第二层——v1.13 `spec-work` closeout 能基于 v1.11–v1.12 的 readiness projection + 本切片的 verification facts 区分 verified / not-run / degraded（父方案 §9.0.1）。

**Origin acceptance examples:**（来自父方案 §9.0.1 / 子方案 §13 consumer gate，作为本计划测试锚点）
- AE-CON-VPROF（`[CON-VPROF-001]`）：有 profile 时验证命令来自 profile 解析；无 profile 时回退 package.json 探测并标 `profile_source:"inferred"`。
- AE-CON-VRUN（`[CON-VRUN-001]`）：closeout 验证结论从"自述"变为引用 run-summary 的 `passed/failed/not-run`；`not-run` 必带 reason_code。
- AE-CON-HONEST（`[CON-HONEST-001]`）：缺结构化 claim 或证据时 closeout 从"通过"降级为 `degraded`，非静默通过。

---

## Scope Boundaries

- 不新增监督式中心 runner（`src/runtime/` 仍是父方案 §3.3 后置 platform surface）；只提供 thin capture helper。
- 不实现 governance lens / task-governance-signals / RuleMaturity（父方案 Phase C / v1.14）。
- 不实现 CodeGraph / Graphify / GBrain provider adapter（父方案 Phase E / v1.16）。
- 不新增 `productSmoke` 真实跨边界 probe 的执行编排；**也不在 `verification-profile.v1` schema 中预留 `productSmoke` 字段**（未进子方案 §4.4 canonical，加之违反 §0.4.3）。将来需要时按 §0.4.3 改 canonical + bump。
- 不把 `verification-evidence.json`（doctor freshness 投影）改成本合同；它保持现状，是 doctor 视角投影。
- 不复制 `.scale/` 状态机、G0-G22 gate、inline hook、quality-contract 作为流程状态 truth；只吸收 contract shape 与 red-line 文案。
- 不自动执行多端验证或 verifier skill；本切片只做"读 profile + 捕获真实执行 + 诚实 closeout"。

### Deferred to Follow-Up Work

- `spec-debug` / `spec-code-review` 引用同一 `verification-run-summary.v1` 结构的 closeout 接入：本计划只在 schema/helper 层保证可被它们消费，prose 接入留到各自 workflow 的后续切片（父方案 §6 矩阵 E1，非 v1.13 consuming gate 必需）。
- `productSmoke` 真实 probe 执行与空 probe block/warn 行为：profile schema 预留字段，执行编排单独切。
- quality-contract red-line 完整文案库：本切片只吸收 not-run / dry-run 红线措辞，不搬整套。

---

## Completion Criteria

本计划涉及 source-owned contract schema + runtime 行为，`status` 移到 `completed` 前必须满足：

- 三份新 schema（`verification-profile`、`verification-run-summary`、`honest-closeout`）落 `docs/contracts/**/*.schema.json`，经 `src/contracts/schema-validator.js` 校验，valid/invalid fixture 测试通过。
- `spec-work-run-artifact/v2` schema 落地，producer 写 v2、read/prune 兼容 v1；REG-RUNART-001/002/003 + REG-DOCTOR-001/002 + REG-SUITE-001 全绿（父方案 §9.0 每相位回归门槛）。
- `spec-work` closeout（source skill `skills/spec-work/**` 与 generated runtime 由 `spec-first init` 同步）真实调用 capture helper 与 honest-closeout validator，consuming gate `[CON-VRUN-001]` / `[CON-HONEST-001]` / `[CON-READY-001]`(第二层) 各有一条断言捕获行为变化。
- `npm test`（unit + smoke + integration）全绿；`CHANGELOG.md` 按格式追加 `(user-visible)`（closeout 行为变化对用户可见）。
- README / docs 同步：新增三份合同入口与 `spec-first.verification.json` 用户面说明。

---

## Direct Evidence Readiness

- target_repo: `spec-first`（当前 cwd，git toplevel 一致）
- evidence_sources: 直接源码读取（5 个关键 helper/schema/skill 文件全文）、rg 结构搜索、git log/status
- source_refs: `src/cli/helpers/spec-work-run-artifact.js`、`docs/contracts/workflows/spec-work-run-artifact.schema.json`、`src/cli/commands/internal.js`、`src/cli/helpers/setup-facts.js`、`src/verification/artifact-paths.js`、`src/contracts/schema-validator.js`、`docs/contracts/verifiers/verification-evidence.schema.json`、`skills/spec-work/references/shipping-workflow.md`、`skills/spec-work/SKILL.md`
- current_revision: `7e754cbda6e37b8363e9cb70bee18613627fe29a`（branch `leo-2026-06-03-ceupdate`）
- worktree_status: dirty（`.kiro/specs/dependency-readiness-baseline/` 已删未提交、`.codex/` untracked；均与本计划无关）
- confidence: high（集成面与现有 helper/schema 模式已逐文件确认）
- limitations: 未实际运行测试或 helper；外部参考项目（scale-engine/project-scaffold）命令为 snapshot，落地前需 `--help` 复核

---

## Direct Evidence

- repo_scope: `spec-first` 单仓
- source_reads_completed:
  - `spec-work-run-artifact.js`（1316 行全文）：确认 `validateValidation` 当前校验 `commands[]`、producer write/read/prune 三命令、target-repo containment（`resolveTargetRepoRoot` + `validateOutputContainment`）、secret 扫描、generated-runtime 路径拒绝模式。
  - `spec-work-run-artifact.schema.json`：确认 `script_confirmed.validation` 形状、`additionalProperties:false`、`if/then` producer reason_code 约束、`artifact_path` pattern。
  - `internal.js`：确认内部 CLI 派发模式（`spec-first internal <sub>`），新 helper 按相同模式注册。
  - `setup-facts.js`（`computeDecisionInputHealth`）：确认 v1.11/v1.12 readiness projection 形状——status enum 是 `not_checked|missing|stale|error|warn|pass`（**无 `not-run`/顶层 `degraded`**），degraded 在 `warn` + `basis.degraded_count`/`provider_counts`。v1.13 closeout 消费它标 readiness 侧 degraded，但 verified/not-run 来自 run-summary check，不混。
  - `artifact-paths.js`：确认 `resolveWorkflowArtifactDir` containment 复用入口。
  - `schema-validator.js`：确认支持 `$ref/enum/required/additionalProperties/anyOf/oneOf/if-then-else/pattern/type`，足以表达三份新 schema。
  - `shipping-workflow.md` Phase 4 "Evaluate Durable Evidence Triggers" 步骤（auto-numbered `n.`，无 "Step 2.5" 字面；`trigger-not-run-validation` 在 line 108）：确认 closeout trigger 链与 producer 调用现状，是 v1.13 接入点。
- source_reads_required:
  - `skills/spec-work/SKILL.md` line 103–105 段落（producer 描述）实施时精确改写。
  - `templates/claude/commands/spec/work.md` 与 `.codex/` 同步由 `spec-first init` 生成，不手改。
- commands_or_tools_used: `rg`、`git log/status/rev-parse`、`ls`、逐文件 Read
- impact_on_plan: run-artifact 处理方式由用户拍板为 **bump v2**（移除 `commands[]`，validation 改 `{status,reason_code,run_summary_ref}`），决定了 U5 的 schema 变更与 REG 回归面。
- key_findings:
  - 现有 helper 已有成熟的 target-repo containment + secret-deny + atomic-write + schema-validator 模式，三个新 helper 应抽 `helpers/target-repo.js` 复用（父方案 §3.4），不各自重造。
  - `verification-run-summary` 落点应在 `.spec-first/workflows/spec-work/<slug>/<run-id>/logs/` 同级，复用 `resolveWorkflowArtifactDir` containment。
  - honest-closeout 是 helper，不落盘第二份 durable artifact（父方案 §4.6）；它校验 closeout payload 的 claim↔evidence 关系，输出 verdict。
- limitations: 未运行测试；`spec-first.verification.json` 的 stack 探测口径需与现有 doctor package-script 探测对齐（实施时读 doctor.js 对应函数确认）。

---

## Context & Research

### Relevant Code and Patterns

- `src/cli/helpers/spec-work-run-artifact.js` — target-repo containment、secret 扫描、schema 校验、atomic immutable write 的权威范式。三个新 helper 全部对齐它。
- `src/cli/commands/internal.js` — 内部 CLI 派发：新增 `verification-profile` / `verification-run-summary` / `honest-closeout` 三个 subcommand。
- `src/contracts/schema-validator.js` — 唯一 schema 校验器，所有新 schema 通过它（`[CT-007]`）。
- `src/verification/artifact-paths.js` `resolveWorkflowArtifactDir` — run-summary / log 路径 containment 复用入口。
- `src/cli/helpers/setup-facts.js` `computeDecisionInputHealth` — v1.11/v1.12 readiness projection；v1.13 closeout 消费它（`[CON-READY-001]` 第二层）。
- `src/cli/helpers/secret-deny-patterns.js`、`src/cli/atomic-write.js` — secret-deny 与原子写复用。
- `skills/spec-work/references/shipping-workflow.md` Phase 4 + `skills/spec-work/SKILL.md` line 103–105 — closeout 接入点。

### Institutional Learnings

- v1.11/v1.12 plan（`docs/plans/2026-06-04-001-feat-dependency-readiness-baseline-plan.md`）确立的模式：schema 落 `docs/contracts/**`、helper 复用 schema-validator、doctor 作为 direct consumer、producer→consumer 同切片验收。v1.13 延续。
- 父方案 §0.4.3 schema 单一定义规则：`verification-profile.v1` canonical 在子方案 §4.4、`verification-run-summary.v1` 与 `honest-closeout.v1` canonical 在父方案 §4.4/§4.6；本计划落盘后 schema 文件转 canonical、方案章节转引用（按 `spec-work-run-artifact/v1` 既有模式）。

### External References

- 不引入外部网络研究。scale-engine `VerificationProfile.ts` / `FinalReportGuard.ts`、project-scaffold `.agent/project.json` / `verify.sh` 是父方案已消化的本地证据；命令为 snapshot，本计划不固化外部命令。

---

## Key Technical Decisions

- **run-artifact bump 到 v2，移除 `commands[]`**（用户拍板）：`script_confirmed.validation` 改为 `{status, reason_code, run_summary_ref}`，逐 check 明细唯一来源是 `verification-run-summary.v1`。彻底兑现父方案 §4.5 单向引用、消除双明细源（`[VT-007]`）。代价是 producer 需写 v2、read/prune 兼容 v1、REG-RUNART 测试补 v2 变体——blast radius 最大但契约最干净，符合"消除第二套 evidence enum"的硬边界。
- **三个 helper 抽 `helpers/target-repo.js` 公共前置**（父方案 §3.4）：containment + git root + path 校验从 `spec-work-run-artifact.js` 提取为库级复用，避免散点重造漂移。这是本切片的前置 U1。
- **honest-closeout 是 validator helper，不落盘**：校验 closeout payload 的结构化 claim↔evidence 关系，输出 `consistent/unsupported/degraded` verdict；不解析自然语言（NL lint 只作 advisory）。诚实边界写进合同。
- **verification-run-summary capture 不重跑命令**：workflow 执行命令后把 `command + exit_code + log_path` 通过 stdin/参数交给 helper，helper 只做 schema 校验 + redaction + containment + 写盘（`[VT-006]`）。诚实边界（capture 可信度 = 当步如实转录，弱于进程级监督）写进合同。
- **verification-profile loader 只解析不裁决**：解析 `spec-first.verification.json` → 缺省回退 package.json 探测（标 `profile_source:"inferred"`）→ 都没有则 `not-configured`；选哪个 profile 是 workflow 判断。
- **本地 override 路径**：`.spec-first/verification-profile.local.json` 为第一顺位（父方案 §0.4），`.spec-first/config.local.yaml` 作兼容别名；均 gitignored，只覆盖本机路径/临时 skip。

---

## Open Questions

### Resolved During Planning

- run-artifact `commands[]` 如何处理？→ bump 到 `spec-work-run-artifact/v2`，移除 `commands[]`，validation 改 `{status,reason_code,run_summary_ref}`，v1 仍可读（用户选择 A）。
- honest-closeout 是否落盘第二份 artifact？→ 否，是 validator helper，映射进现有 run-artifact 字段（父方案 §4.6）。
- verification-profile 实例放哪？→ repo root `spec-first.verification.json`（checked-in），不放 `.spec-first/config/*.json`（已 gitignore）。
- 是否新建中心 runner？→ 否，thin capture helper + 诚实边界（父方案 §3.3/§4.4）。

### Deferred to Implementation

- `spec-first.verification.json` 缺省时的 inferred 探测口径：读 `package.json` 的 `test`/`typecheck`/`lint` 等脚本作为 check 候选（**新逻辑**——`scan-configured-deps.cjs:217` `scanPackageSetupScripts` 的 regex 只匹配 setup/bootstrap 类，故意排除 test；doctor.js 只做 `--version`）。复用 `scan-configured-deps.cjs` 的读文件/解析风格，不复用其 setup-only regex。
- v1 → v2 run-artifact 迁移：现存 v1 artifact 是否需要一次性转换？倾向只保证 read/prune 兼容、不批量迁移（immutable + 30 天 retention 自然淘汰）。durable v1 consumer 检查已前移为 U5 第 1 步（grep gate），不再悬空。
- honest-closeout `evidence_refs` 指向 run-summary check 的引用语法（如 `verification-run-summary:typecheck`）落地形态：实施时与 capture helper 输出的 check id 对齐。

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```text
spec-work Phase 4 closeout（host workflow / LLM + host shell）
  │
  │ 1. 真实执行验证命令（npm run typecheck / test:unit ...），拿真实 exit_code
  ▼
verification-profile loader  ──reads──►  spec-first.verification.json
  （只解析：profile/services/stacks/checks/required_tools）          │ 缺省回退 package.json 探测
  │                                                                  │ → profile_source: inferred
  ▼
verification-run-summary capture（thin, deterministic）
  入参: {check id, command, exit_code, ran, required_tools, missing_tools, log_path}
  产出: .spec-first/workflows/spec-work/<slug>/<run-id>/verification-run-summary.json
        checks[]: {id,service,command,status,exit_code,ran,...,reason_code}
  规则: 不重跑命令、不推断 exit_code；dry-run → not-run+schedulable；缺工具 → not-run+missing_dependency
  │
  ▼
honest-closeout validator（deterministic schema-level）
  入参: claims[] = {claim_type, asserted_status, evidence_refs[]}
        evidence_refs 指向 run-summary check id / docs/solutions / review artifact
  产出: claims[].verdict ∈ {consistent, unsupported, degraded}
        overall ∈ {verified, degraded, ...}  （任一 unsupported → 不得 verified；无结构化 claim → degraded）
  │
  ▼
spec-work-run-artifact/v2 producer
  script_confirmed.validation = {status, reason_code, run_summary_ref}  （commands[] 已移除）
  通过 run_summary_ref 单向指向 verification-run-summary（逐 check 明细唯一来源）
  │
  ▼
最终回复: Verification 行引用结构化 check 的 passed/failed/not-run；缺证据 → degraded（不静默通过）
```

---

## Implementation Units

### U1. 抽取 `helpers/target-repo.js` 公共 containment 前置

**Goal:** 把 `spec-work-run-artifact.js` 已验证的 target-repo containment + git root + path 校验 + secret-deny 组合提取为库级复用模块，供三个新 helper import，避免散点重造（父方案 §3.4）。

**Requirements:** R4

**Dependencies:** None

**Files:**
- Create: `src/cli/helpers/target-repo.js`
- Modify: `src/cli/helpers/spec-work-run-artifact.js`（改为 import 公共模块，保留对外行为不变）
- Test: `tests/unit/target-repo-containment.test.js`

**Approach:**
- 抽出 `resolveTargetRepoRoot`（git toplevel + realpath 一致）、`validateOutputContainment`（ancestor 遍历 + symlink 拒绝 + realpath 越界）、generated-runtime 前缀拒绝、secret-deny 包装。`validateOutputContainment` 在 `spec-work-run-artifact.js` 有 9 处 in-file 调用点，抽取后须全部 rewire 到公共模块——这是"行为不变"可测的前提。
- `spec-work-run-artifact.js` 改为复用公共实现，**逐行保证现有 reason_code 与拒绝行为不变**（这是回归敏感重构，不改语义）。

**Execution note:** characterization-first —— 先对 `spec-work-run-artifact.js` 现有 containment 行为补/确认特征测试，再抽取，确保抽取前后 REG-RUNART-003 与 path-escape 行为完全一致。

**Patterns to follow:**
- `src/cli/helpers/spec-work-run-artifact.js` `resolveTargetRepoRoot` / `validateOutputContainment` / `GENERATED_RUNTIME_PREFIXES`
- `src/cli/helpers/secret-deny-patterns.js`

**Test scenarios:**
- Happy path: 合法 git repo root 解析成功，返回 realpath 一致的 root。
- Edge case: 非 git 目录 / 非目录路径 → `target-repo-not-found`。
- Error path: symlink ancestor、`..` 越界、`.git/` 路径、generated runtime 前缀（`.claude/`、`.codex/`、`.agents/skills/`）→ 拒绝并给对应 reason。
- Integration: `spec-work-run-artifact.js` 改用公共模块后，现有 contract/producer 测试全绿（行为不变）。

**Verification:**
- `tests/unit/spec-work-run-artifact-*.test.js` 全绿；新 containment 测试覆盖越界/symlink/runtime 前缀。

---

### U2. `verification-profile.v1` 合同 + loader helper

**Goal:** 落 `verification-profile.v1` schema + docs，并提供只解析不裁决的 loader：解析 `spec-first.verification.json`，缺省回退 package.json 探测（标 `profile_source:"inferred"`），都没有则 `not-configured`。

**Requirements:** R1, R4, R7, AE-CON-VPROF

**Dependencies:** U1

**Files:**
- Create: `docs/contracts/verification/verification-profile.schema.json`
- Create: `docs/contracts/verification/verification-profile.md`
- Create: `src/verification/profile-loader.js`（解析/来源解析逻辑）
- Create: `src/cli/helpers/verification-profile.js`（CLI-facing wrapper，import profile-loader）
- Modify: `src/cli/commands/internal.js`（注册 `verification-profile` subcommand）
- Modify: `skills/spec-mcp-setup/scripts/scan-configured-deps.cjs`（`scanVerificationProfile` 改走 canonical 解析：从 flat `checks[]` 改为 `profiles.<name>.checks` id → `stacks.commands` 命令解析）
- Test: `tests/unit/verification-profile.test.js`、`tests/unit/mcp-setup.sh` 或对应 scan 测试（断言 `scanVerificationProfile` 在 canonical schema 下仍能发现 check 命令）

**Approach:**
- schema canonical 字段以 project-scaffold 子方案 §4.4 为准：`schema_version`/`default_profile`/`profiles`/`services.{path,stack,required}`/`stacks.{detect,commands,runner_kind,required_tools}`。**不含 `productSmoke`**（未进 §4.4 canonical，本切片不加；若将来需要，按 §0.4.3 改 canonical 并 bump）。
- loader 解析优先级：① `spec-first.verification.json`（repo root，`profile_source:"explicit"`）→ ② package scripts 探测（标 `profile_source:"inferred"`）→ ③ `not-configured` + reason_code。
- **inferred 探测是新逻辑，不是复用 `scanPackageSetupScripts`**：后者（`scan-configured-deps.cjs:217`）的 regex 只匹配 `setup|bootstrap|prepare|postinstall|install` 脚本，**故意排除** `test`/`typecheck`/`lint`/`e2e`——而 verification 推断恰恰要这些。doctor.js 只做 `--version`，也无 test-script 探测。因此 inferred 探测需新写：读 `package.json` 的 `test`/`typecheck`/`lint` 等脚本作为 check 候选，**复用 `scan-configured-deps.cjs` 读文件/解析的代码风格**，不复用其 setup-only regex。
- **更新现存消费者对齐 canonical（必做，非 read-for-reference）**：`scanVerificationProfile`（`scan-configured-deps.cjs:236`）当前读 flat 顶层 `checks[].{id,command}`，与 §4.4 canonical 不兼容（见 R1）。U2 必须把它改成 canonical 解析（`profiles.<name>.checks` id → `stacks.commands`），并补回归测试证明改后仍能发现 check 命令；否则现存 configured-dep 扫描在新 schema 下静默失效。
- 本地 override：`.spec-first/verification-profile.local.json`（第一顺位）/ `.spec-first/config.local.yaml`（兼容别名），只覆盖本机路径/临时 skip。

**Patterns to follow:**
- `src/cli/helpers/setup-facts.js`（loader + normalizer + reason_code 分层）
- `src/contracts/schema-validator.js` 校验入口

**Test scenarios:**
- Happy path: 存在 `spec-first.verification.json` → 解析出 profiles/stacks/checks，`profile_source:"explicit"`。
- Edge case: 无 profile 文件但有 package.json `test`/`typecheck`/`lint` scripts → `profile_source:"inferred"`，commands 来自这些 scripts（AE-CON-VPROF）。
- Edge case: 既无 profile 又无可探测 scripts → `not-configured` + reason_code。
- Error path: schema invalid / 不可读 → 对应 reason_code，不崩溃。
- Edge case: 本地 override 只改本机参数，不改团队 check 身份。
- Integration（消费者迁移）: 用 canonical schema 的 `spec-first.verification.json`（check 在 `profiles.<name>.checks` + `stacks.commands`），`scanVerificationProfile` 改后仍发现 verification-command configured deps；旧 flat `checks[]` 读取被替换，不留双路径。

**Verification:**
- valid/invalid fixture 经 schema-validator；loader 在三种来源下 `profile_source` 正确切换；`scanVerificationProfile` 迁移回归测试绿。

---

### U3. `verification-run-summary.v1` 合同 + capture helper

**Goal:** 落 `verification-run-summary.v1` schema + docs，并提供 thin capture helper：接收已执行命令的 `command/exit_code/log_path/required_tools/missing_tools`，做 schema 校验 + redaction + containment + 写盘；不重跑命令、不推断 exit_code。

**Requirements:** R2, R4, R7, R9, AE-CON-VRUN

**Dependencies:** U1

**Files:**
- Create: `docs/contracts/verification/verification-run-summary.schema.json`
- Create: `docs/contracts/verification/verification-run-summary.md`
- Create: `src/cli/helpers/verification-run-summary.js`
- Modify: `src/cli/commands/internal.js`（注册 `verification-run-summary` subcommand，含 `record`/`read`）
- Test: `tests/unit/verification-run-summary.test.js`

**Approach:**
- schema canonical 字段以父方案 §4.4 为准：顶层 `{schema_version, generated_at, profile, checks[]}`；`checks[]` = `{id, service, command, status, exit_code, ran, required_tools, missing_tools, log_path, reason_code}`。
- `status` ∈ `passed/failed/not-run/degraded`；`passed` 必须 `ran=true` 且有 `exit_code` + `log_path`；`not-run` 必须有 `reason_code` 且 `ran=false`。
- `log_path` 是 redacted repo-relative 字符串，落 `.spec-first/workflows/spec-work/<slug>/<run-id>/logs/` 同级（复用 `resolveWorkflowArtifactDir` containment）。
- **log 内容 redaction 边界（区别于路径字符串）**：`log_path` 只保证*路径串*是 repo-relative；它指向的*文件内容*是否脱敏需显式约定。本切片采用与 run-artifact `raw_log_ref`（带 `secret_stripped:true` 语义）一致的 fail-closed 立场：capture 入参带 check 级 `redaction_status`（`redacted`/`none-required`），helper 对 `log_path` 内容做 secret-deny 扫描（复用 `secret-deny-patterns`），命中且非 `redacted` 则拒绝写入；并在合同写明"helper 不深扫大日志全文，超界内容由 caller 在写前脱敏"的限制，不冒充内容级保证。
- dry-run → `not-run` + `reason_code=schedulable`；缺工具 → `not-run` + `reason_code=missing_dependency`。
- 诚实边界写进 docs：capture 可信度 = workflow 当步如实转录，弱于进程级监督；helper 绝不重跑命令、不推断 exit_code。

**Execution note:** 先写 `[VT-006]` 越界检测的失败测试（提交未经 capture 入口的 exit_code 应被拒/不进入），再实现。

**Patterns to follow:**
- `src/cli/helpers/spec-work-run-artifact.js`（输入 JSON 校验 + containment + redaction + 写盘）
- `src/verification/artifact-paths.js` `resolveWorkflowArtifactDir`

**Test scenarios:**
- Happy path: `passed` check 带 `ran=true` + `exit_code=0` + `log_path` → 写盘 + schema valid（AE-CON-VRUN）。
- Edge case: dry-run → `not-run` + `schedulable`，不得写成 `passed`（`[VT-004]`）。
- Edge case: 缺 required_tool → `not-run` + `missing_dependency` + `missing_tools[]`（`[VT-002]`）。
- Error path: 命令 fail → `failed` + `exit_code != 0`（`[VT-003]`）。
- Error path（越界）: capture 入口未提供 exit_code / 试图让 helper 推断 → 拒绝（`[VT-006]`）。
- Edge case: `log_path` 只接受 redacted repo-relative；raw 日志不进入（`[VT-005]`）。
- Error path（内容脱敏）: `log_path` 指向的文件含 secret 且 check `redaction_status != redacted` → 拒绝写入（fail-closed，复用 secret-deny）。

**Verification:**
- valid/invalid fixture 经 schema-validator；越界检测 `[VT-004]`/`[VT-006]` 通过。

---

### U4. `honest-closeout.v1` 合同 + validator helper

**Goal:** 落 `honest-closeout.v1` schema + docs，并提供 deterministic validator：对结构化 claim 校验 `asserted_status` 是否被 `evidence_refs` 支撑，输出 `consistent/unsupported/degraded` verdict；不解析自然语言。

**Requirements:** R3, R4, R8, AE-CON-HONEST

**Dependencies:** U3（claim 的 `validation` evidence 指向 run-summary check）

**Files:**
- Create: `docs/contracts/workflows/honest-closeout.schema.json`
- Create: `docs/contracts/workflows/honest-closeout.md`
- Create: `src/cli/helpers/honest-closeout.js`
- Modify: `src/cli/commands/internal.js`（注册 `honest-closeout` subcommand）
- Test: `tests/unit/honest-closeout.test.js`

**Approach:**
- canonical claim 校验模型以父方案 §4.6 为准：`claims[]` = `{claim_type, asserted_status, evidence_refs[], verdict, reason_code}`；`claim_type` ∈ `validation/impact_surface/review/knowledge_promotion`；顶层 `{overall, overall_reason_code}`。
- **两个 §4.6 面要同时尊重**：父方案 §4.6 是 claim 校验模型（本 helper 实现），子方案 §4.6 是"四问 → closeout 字段映射"面（目标问题→影响面→验证→沉淀）。四问已落在现有 run-artifact 字段上——`objective_summary`→`llm_asserted.summary`、影响面→`script_confirmed.changed_files` + `direct_evidence_used`、验证→`script_confirmed.validation`(v2 `run_summary_ref`)、沉淀→`llm_asserted.deferred_follow_up` + `docs/solutions` refs。本切片**不新增第二份 closeout artifact**；honest-closeout 的四类 `claim_type` 正是这四问的结构化校验入口，实施时确认每个 `claim_type` 的 `evidence_refs` 指向上述现有字段，不另造字段。
- 校验规则（deterministic）：`validation=passed` 的 claim 必须指向一条 `status=passed` 且带 `exit_code` 的 run-summary check；`evidence_refs` 为空 → `unsupported`；`knowledge_promotion` 必须指向 `docs/solutions/**` 而非 recall。
- overall：任一 claim `unsupported` → 不得 `verified`；仅自然语言无结构化 claim → `degraded`（honest-but-unverifiable）。
- 不落盘第二份 durable artifact；validator 读 closeout payload（含指向 run-summary 的 ref），输出 verdict 供 run-artifact / 最终回复消费。
- NL lint（检测"测试通过"字样但无结构化 claim）只作 advisory warning，不单独判定通过/失败。

**Patterns to follow:**
- `src/cli/helpers/spec-work-run-artifact.js`（结构化校验 + reason_code）
- 父方案 §4.6 claim 校验模型

**Test scenarios:**
- Happy path: `validation=passed` 指向 `status=passed` check → `consistent`。
- Error path: claim `evidence_refs` 为空 → `unsupported` + `missing-evidence-ref`（`[CO-004]`）。
- Error path: `asserted_status` 与 evidence check status 不符（声称 passed 但 check 是 not-run）→ `unsupported` + `evidence-status-mismatch`。
- Edge case: 只有自然语言、无结构化 claim → overall `degraded`，不得 verified（`[CO-005]`，AE-CON-HONEST）。
- Edge case: `knowledge_promotion` 指向 recall 而非 `docs/solutions/**` → `unsupported`。
- Integration: not-run validation closeout → honest but degraded（`[CO-006]`）。

**Verification:**
- valid/invalid fixture 经 schema-validator；越界检测 `[CO-004]`/`[CO-005]` 通过。

---

### U5. `spec-work-run-artifact` bump 到 v2（单向引用 run-summary）

**Goal:** bump schema 到 `spec-work-run-artifact/v2`，`script_confirmed.validation` 改为 `{status, reason_code, run_summary_ref}`，移除 `commands[]`；producer 写 v2，read/prune 兼容 v1。

**Requirements:** R5（消除 §4.5 双明细源 / `[VT-007]`）

**Dependencies:** U1（先落 `helpers/target-repo.js` 抽取，再改同文件 validation）、U3（`run_summary_ref` 指向 verification-run-summary）

**Files:**
- Modify: `docs/contracts/workflows/spec-work-run-artifact.schema.json`（新增 v2，标注 v1 仍可读）
- Modify: `src/cli/helpers/spec-work-run-artifact.js`（`ARTIFACT_SCHEMA_VERSION` + `PAYLOAD_SCHEMA_VERSION` → v2、`validateValidation` 改校验 `run_summary_ref` 取代 `commands[]`、read/prune `validateArtifact` 接受 v1+v2）
- Modify: `docs/contracts/ai-coding-harness.md` 或相关 contract 引用（若引用了 v1 validation 形状）
- Test: `tests/unit/spec-work-run-artifact-contract.test.js`（line 130 硬断言 `validation.properties.commands.items.additionalProperties` 必须改写为 v2 形状）、`tests/unit/spec-work-run-artifact-producer.test.js`（fixture 中 spread `validation.commands` 的用例需改为 `run_summary_ref`）

**Approach:**
- **第 1 步（移除前置门）：grep 现存 v1 `commands[]` 消费者**——`rg "validation.*commands|\.commands\b" src/ skills/ tests/`，确认无 durable consumer（compound / release-notes / review 等）依赖 `script_confirmed.validation.commands[]`。这是 cheap early check，gating 整个 bump；不放到实施末尾。若发现消费者，先评估其迁移再改 schema。
- v2 `script_confirmed.validation`: `{status ∈ passed/failed/not-run/degraded, reason_code, run_summary_ref}`；`run_summary_ref` 是指向 `.spec-first/workflows/spec-work/<slug>/<run-id>/verification-run-summary.json` 的 repo-relative path（复用 `allowSpecFirstWorkflows` 路径规则）。
- **schema 双版本可读的最小正确改法**：`validateArtifact` 当前只 load 一份 schema 且 `schema_version` 是 `const "spec-work-run-artifact/v1"`（schema:33-36）。改为 `schema_version` 用 `enum:["spec-work-run-artifact/v1","spec-work-run-artifact/v2"]`，并用 `if/then`（按 schema_version 分支）让 v1 分支要求 `commands[]`、v2 分支要求 `run_summary_ref`；否则现存 v1 artifact read/prune 会全部 `artifact-schema-invalid`。
- **payload 两层都要 bump**：`PAYLOAD_SCHEMA_VERSION`（`spec-work-run-artifact.js:10`）`/v1 → /v2`，payload 侧 `validateValidation`（line ~1010，当前 require `commands[]` 数组）改为 require `run_summary_ref`。只改 artifact schema 不改 payload 校验会导致 producer 拒绝合法 v2 输入。
- producer 只写 v2；read/prune 同时接受 v1（含 `commands[]`）与 v2（含 `run_summary_ref`）。
- 不批量迁移现存 v1 artifact（immutable + 30 天 retention 自然淘汰）；v1 consumer 检查已前移到本单元第 1 步。

**Execution note:** 这是 schema 版本变更（父方案 §9.0 要求 bump + downstream consumer test）；先补 REG-RUNART-002 的 v2 变体特征测试，确认四分区 enum 不被污染、v1 仍可读，再改 producer。

**Patterns to follow:**
- 现有 `spec-work-run-artifact.schema.json` `if/then` 版本约束、`validateValidation`、`validateArtifact`

**Test scenarios:**
- Happy path: 写 v2 payload（validation 带 `run_summary_ref`，无 `commands[]`）→ 成功，artifact `schema_version=spec-work-run-artifact/v2`。
- Edge case（越界）: v2 payload 含 `commands[]` → 拒绝（`additionalProperties:false`，`[VT-007]`）。
- Integration: 现存 v1 artifact（含 `commands[]`）read/prune 仍成功（REG-RUNART-001/002/003——这些是父方案 §9.0 的回归 ID，不是现成具名测试；实施时映射到 producer 测试的 immutability 用例、contract 测试 line 128-132 的 `additionalProperties` 断言、schema path-pattern 的 generated-runtime 拒绝用例）。
- Edge case: `run_summary_ref` 指向 generated runtime / 越界路径 → 拒绝。
- Edge case: 同 workspace/run-id 重复写仍 `artifact-already-exists`（immutable 不破坏）。

**Verification:**
- 全部 `spec-work-run-artifact-*` 测试绿；contract 测试 line 130 改写为 v2 形状后通过；REG-RUNART 回归断言（见上）全绿；v1 read/prune 兼容验证通过。

---

### U6. `spec-work` closeout 接入（兑现 consuming gate）

**Goal:** 在 `spec-work` closeout（shipping-workflow Phase 4）接入 profile loader + run-summary capture + honest-closeout + v2 producer，使验证结论从"自述"变为引用结构化 check，缺证据降级为 `degraded`——兑现 `[CON-VRUN-001]`/`[CON-HONEST-001]`/`[CON-READY-001]`(第二层)。

**Requirements:** R6, R10, AE-CON-VRUN, AE-CON-HONEST

**Dependencies:** U2, U3, U4, U5

**Files:**
- Modify: `skills/spec-work/references/shipping-workflow.md`（Phase 4 的 "Evaluate Durable Evidence Triggers" 步骤 + 其后 producer 调用：写 run-summary、产 honest-closeout claims、v2 producer payload；该步骤是自动编号 `n.`，无 "Step 2.5" 字面）
- Modify: `skills/spec-work/SKILL.md`（line 103–105 Run Artifact Boundary 段落更新为 v2 + run-summary 引用；trigger `trigger-not-run-validation`（`shipping-workflow.md:108`）改为读结构化 check）
- Modify: `CHANGELOG.md`、`README.md` / `README.zh-CN.md`（用户面：closeout 验证诚实化、`spec-first.verification.json` 入口）
- Test: `tests/unit/spec-work-contracts.test.js`（closeout prose 契约：要求引用 run-summary、缺证据降级）
- Note: `.claude/` / `.codex/` generated runtime 由 `spec-first init` 同步，不手改。

**Approach:**
- closeout 序列：profile loader 解析验证候选 → workflow 真实执行 → capture helper 写 run-summary → 产结构化 honest-closeout claims（`validation` claim 指向 run-summary check id）→ v2 producer payload `validation.run_summary_ref` 指向 run-summary → 最终回复 `Verification:` 行引用结构化 check 的 `passed/failed/not-run`。
- `trigger-not-run-validation` 改为基于 run-summary 中是否有 `status=not-run` check 判断，而非 LLM 自述。
- closeout 缺结构化 claim / claim unsupported → honest-closeout overall `degraded`，最终回复不得写 verified。
- **消费 v1.11/v1.12 `decision_input_health` projection（`[CON-READY-001]` 第二层）需显式映射，非 1:1**：`computeDecisionInputHealth`（`setup-facts.js:386`）的 status enum 是 `not_checked|missing|stale|error|warn|pass`，**没有 `not-run` 或顶层 `degraded`**；degraded 体现在 `warn` 状态 + `basis.degraded_count`/`provider_counts`。closeout 的"区分 verified/not-run/degraded"是两个不同来源的组合：verified/not-run 来自 **run-summary 的 check status**，degraded 来自 **run-summary check 降级 OR `decision_input_health=warn`/`error`（readiness 侧）**。实施时明确这条映射，不要把 readiness status 当成 verification status。
- 验证 source 改完后运行 `spec-first init --claude -y` / `--codex -y` 同步 generated runtime，再跑 doctor。

**Execution note:** 这是 prose（skill）变更，按 CLAUDE.md「Agent 与 Skill 变更验证」用 fresh-source eval 校验 closeout 语义；不依赖会话缓存。

**Patterns to follow:**
- `skills/spec-work/references/shipping-workflow.md` Phase 4 现有 trigger 链与 producer 调用
- `skills/spec-work/SKILL.md` line 103–105 现有 producer 描述措辞

**Test scenarios:**
- Happy path: closeout 引用 run-summary 的 `passed/failed/not-run`，`not-run` 必带 reason_code（AE-CON-VRUN，`[CON-VRUN-001]`）。
- Edge case: 缺结构化 claim 或 evidence → closeout 降级 `degraded`，非静默通过（AE-CON-HONEST，`[CON-HONEST-001]`）。
- Edge case: 只改 docs/prompt 时不被误导成必须执行多端验证（docs-only feedback loop）。
- Integration: closeout 基于 run-summary check status 区分 verified/not-run，并结合 `decision_input_health`（`warn/error`）标 degraded（`[CON-READY-001]` 第二层，按上方显式映射）。
- Edge case（越界）: closeout prose 不引入第二套 preload 真源 / 不直接读 raw provider dump。

**Verification:**
- `spec-work-contracts.test.js` 锁定 closeout 引用 run-summary + 降级语义；fresh-source eval 确认 closeout 不谎报；`spec-first init` 后 doctor 两宿主无 drift。

---

## System-Wide Impact

- **Interaction graph:** 新增三个 `spec-first internal <sub>` 入口（profile/run-summary/honest-closeout）；`spec-work` closeout 串联它们 + v2 producer。`doctor` 不变（仍读 `verification-evidence.json` freshness 投影，本切片不改）。
- **Error propagation:** helper 全部 deterministic，失败返回 reason_code 不抛；closeout 在 helper 失败时保持诚实（记 reason_code，不伪造 passed）。
- **State lifecycle risks:** run-summary 与 run-artifact 都 immutable 写；v1→v2 共存期 read/prune 必须兼容两版，避免 prune 误判 v1 artifact 不可读。
- **API surface parity:** Claude 与 Codex 双宿主——skill 改动后必须 `spec-first init` 同步 generated runtime；`scan-configured-deps.cjs` 已有的 Codex parity 模式作参照。
- **Integration coverage:** 单测无法证明 closeout 在真实 workflow 中诚实——靠 `spec-work-contracts.test.js` 契约 + fresh-source eval 双重保障。
- **Unchanged invariants:** `spec-work-run-artifact` immutable 写 + `artifact-already-exists`、generated-runtime 路径拒绝、secret 扫描、`verification-evidence.json` doctor 投影——本计划均不改语义，v2 只换 validation 内部形状。

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| v1→v2 schema 变更破坏现存 v1 artifact read/prune | read/prune `validateArtifact` 同时接受 v1+v2；REG-RUNART-001/002/003 全绿门槛；不批量迁移，靠 retention 自然淘汰 |
| 三 helper 各自重造 containment 导致漂移 | U1 先抽 `helpers/target-repo.js` 公共前置，三 helper 强制复用（父方案 §3.4） |
| capture helper 被误用为"进程级保证" | 诚实边界写进 `verification-run-summary.md` 合同；`[VT-006]` 越界测试禁止推断 exit_code |
| honest-closeout 被当成 NL 检测器 | 合同明确 validator 只做结构化 claim↔evidence 校验，NL lint 仅 advisory；`[CO-005]` 锁定无结构化 claim → degraded |
| skill prose 改动被会话缓存掩盖 | 按 CLAUDE.md fresh-source eval 校验 closeout 语义；source 改后 `spec-first init` 同步双宿主 |
| profile inferred 探测造第二套口径 / 与现存消费者冲突 | inferred 探测新写（test/typecheck/lint 脚本），复用 `scan-configured-deps.cjs` 读文件风格；U2 同步把现存 `scanVerificationProfile`（flat `checks[]`）迁到 canonical 解析 + 回归测试，消除 schema 落地后静默失效 |
| dry-run / 缺工具被美化成 passed | schema 强制 dry-run→not-run+schedulable、缺工具→not-run+missing_dependency；`[VT-002]`/`[VT-004]` 锁定 |

---

## Documentation / Operational Notes

- `CHANGELOG.md` 必须按仓库格式追加，作者读 `~/.spec-first/.developer`，closeout 行为变化标 `(user-visible)`。
- README / README.zh-CN：新增 `spec-first.verification.json` 用户面说明 + 三份合同入口；docs 目录补合同索引。
- 父方案 §0.4.3：三份 schema 落盘后转 canonical，方案章节（父方案 §4.4/§4.6、子方案 §4.4/§4.5/§4.6）改为引用 schema 文件路径。
- Runtime 同步：source skill 改完运行 `spec-first init --claude -y` 与 `--codex -y`，再 `spec-first doctor --claude/--codex --json` 确认无 drift。

---

## Sources & References

- **Origin documents:**
  - [父方案](../01-需求分析/13.scale集成/spec-first内化集成scale-project-scaffold技术方案.md)（§4.4/§4.5/§4.6 canonical、§8 Phase B、§9.0/§9.0.1 验收）
  - [setup 子方案](../01-需求分析/13.scale集成/project-scaffold依赖安装流程与spec-first-setup优化技术方案.md)（§4.4 verification-profile canonical、§4.5/§4.6 落点、Phase 4、§13 验收）
  - [SCALE 集成索引 README](../01-需求分析/13.scale集成/README.md)（v1.13 范围与开发约束）
- 前序切片：`docs/plans/2026-06-04-001-feat-dependency-readiness-baseline-plan.md`（v1.11+v1.12，本计划的 enabling infra 前置）
- 关键 source：`src/cli/helpers/spec-work-run-artifact.js`、`docs/contracts/workflows/spec-work-run-artifact.schema.json`、`src/cli/commands/internal.js`、`src/cli/helpers/setup-facts.js`、`src/verification/artifact-paths.js`、`src/contracts/schema-validator.js`、`skills/spec-work/references/shipping-workflow.md`
- 测试锚点：`[CON-VPROF-001]`/`[CON-VRUN-001]`/`[CON-HONEST-001]`/`[CON-READY-001]`（父方案 §9.0.1）、`[VT-002~007]`/`[CO-004~006]`/`[CT-001~004]`/`[CT-006~007]`（父方案 §9；`[CT-005]` 属 provider-readiness/v1.16，本切片不含）
