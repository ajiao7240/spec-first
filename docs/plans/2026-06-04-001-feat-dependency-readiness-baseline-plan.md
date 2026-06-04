---
title: "feat: Dependency Readiness Baseline（v1.11 producer + v1.12 doctor consumer）"
type: plan
status: completed
date: 2026-06-04
spec_id: 2026-06-04-001-feat-dependency-readiness-baseline
depth: deep
requirements_source: .kiro/specs/dependency-readiness-baseline/requirements.md
origin:
  - docs/01-需求分析/13.scale集成/spec-first内化集成scale-project-scaffold技术方案.md
  - docs/01-需求分析/13.scale集成/project-scaffold依赖安装流程与spec-first-setup优化技术方案.md
  - docs/01-需求分析/13.scale集成/README.md
host: claude+codex
slice: v1.11 + v1.12（同一 producer→consumer 切片）
---

# feat: Dependency Readiness Baseline（v1.11 + v1.12）

## Summary

把 SCALE 集成路线图第一个 P0 切片落地：让 `spec-first` 能从确定性 facts 诚实回答「哪些依赖 ready / missing / degraded / 已配置但未验证」。

本切片是 **producer→consumer 对**，不可拆开验收：

- **v1.11 producer（生产侧）**：把当前**双份维护**在 `install-helpers.sh` 与 `check-health` 的 helper 列表（实测当前两份内容一致，但存在漂移风险）收敛为 `helper-tools-registry.v1` 单一 registry；新增 `tool-facts.v2` 兼容 normalizer、configured dependency scan、install safety lens；扩展 status renderer 与 workflow mode 写入边界。
- **v1.12 consumer（消费侧）**：把 `doctor.js` 的 `decision_input_health`（当前硬编码 `'not_checked'`）演进为消费 setup facts 的 deterministic rollup，并输出 `decision_input_health_basis`。

绝大部分是 **重构而非从零开发**：脚本全套（含 PowerShell 对等）已存在，缺的是「单一 registry 真相源 + facts normalizer + doctor 消费」。

成功标准（consumer gate，父方案 §9.0.1）：选定 host 且 v1.11 facts 存在时，`doctor --json` 的 `decision_input_health` 由 setup facts 计算得出（不再是常量 `not_checked`），且 `decision_input_health_basis.artifact_refs` 指向被消费的 facts 文件。**v1.11 不得在 v1.12 doctor rollup 落地前单独宣称完成。**

## Goals / Non-goals

### Goals

1. helper 列表与 required/baseline 逻辑收敛到单一 `helper-tools.json`，消除 `install-helpers.sh` ↔ `check-health` 双份维护与漂移风险（当前两份内容一致）。
2. `required` 与 `baseline_blocking` 语义分离：minimal profile 只在真正 baseline blocker 缺失时 `action-required`。
3. `tool-facts.v1` → `tool-facts.v2` 演进 + 兼容 normalizer，消费端只读 normalized projection。
4. configured dependency scan：把 host MCP/hook/allowlist/script/verification 五类 surface 调用的命令投影为 facts。
5. install safety lens：plan/apply 之间的轻量风险判断，区分普通 missing 与高风险安装，不静默执行 blocked。
6. workflow mode 写入边界明确：`--check`（只读）/ `--verify-only`·`--refresh-facts`（只写 facts）/ `--plan`（只规划）/ `--install`（才安装+改 host config）。
7. status renderer 统一输出 9 分区 + 13 字段行。
8. `doctor.decision_input_health` deterministic rollup（7 状态）+ `decision_input_health_basis`（machine-readable）。
9. provider-readiness.v1 **generic 槽位**（字段 canonical 归父方案 §7.1），不实现具体 provider。
10. 双宿主 parity + 跨平台 runner（shell / PowerShell `platform_required_tools` 分离）。

### Non-goals

- ❌ 不重命名 source 目录（`skills/spec-mcp-setup/**` 保持现状；`spec-runtime-setup` 入口重命名是独立 work 任务）。
- ❌ 不交付 `verification-profile.v1` / `verification-run-summary.v1` / `honest-closeout.v1`（v1.13）。
- ❌ 不交付 governance lens / task-governance-signals / RuleMaturity（v1.14+）。
- ❌ 不实现 CodeGraph / Graphify / GBrain 具体 provider 逻辑（v1.16）。
- ❌ doctor / init 不安装、不 repair、不写 host config、不刷新 provider。
- ❌ 不引入第二套 schema 校验实现（复用 `src/contracts/schema-validator.js`）。

## Source-of-truth / 边界

| 维度 | 取值 |
| --- | --- |
| 范围 SoT | `.kiro/specs/dependency-readiness-baseline/requirements.md`（18 条 EARS） |
| 命名/路径/schema canonical | 父方案 §0.4 总表、§7.1（provider-readiness canonical 字段） |
| Source-of-truth 路径 | `skills/spec-mcp-setup/**`、`src/cli/commands/doctor.js`、`src/contracts/`、`docs/contracts/**` |
| Generated runtime（不手改） | `.claude/`、`.codex/`、`.agents/skills/` |
| 生成/本地 facts | `.spec-first/config/tool-facts.json`、`runtime-capabilities.json`（gitignored，由 setup 产、doctor 消费） |
| Schema 唯一落盘 | `docs/contracts/**/*.schema.json`；`src/cli/contracts/**` 只 `require()` 引用，不放第二份 |

## 现状锚点（实现前置调研，已核对真实 source）

| 锚点 | 真实位置 | 工作性质 |
| --- | --- | --- |
| helper 内联列表 + baseline 逻辑 | `install-helpers.sh`（L484 `baseline_blocking` 默认 true、L539 browser opt-in、L686 `add_helper_fact`、L340 agent-browser case、L391 ast-grep case） | 抽取到 registry |
| 第二份 helper 列表（双份维护，漂移风险源） | `check-health`（L79-121 agent-browser/gh/jq/vhs/silicon/ffmpeg case；实测当前与 install-helpers.sh 内容一致） | 收敛到同一 registry |
| tool-facts 生产 | `write-setup-facts.sh`（L86 产 `tool-facts.v1`、L105 `runtime-capabilities.v1`） | 演进 v2 + 不破坏 v1 |
| doctor health 装配 | `doctor.js` L485-499 报告对象、L491 `decision_input_health:'not_checked'`、L516 JSON 输出 | rollup 演进 |
| freshness 常量（须保留） | `doctor.js` L15 `VERIFICATION_EVIDENCE_MAX_AGE_MS = 7*24*60*60*1000`、L703 `determineEvidenceFreshness` | Req 16.2 不回归 |
| schema 校验器 | `src/contracts/schema-validator.js:47` `validateAgainstSchema()` | 复用 |
| 测试入口 | `package.json` test:mcp-setup（跑 `mcp-setup.sh` + `mcp-setup-powershell-contracts.test.js`）/ test:unit / test:smoke / test:integration | 扩充 |
| PowerShell parity 锚点 | `mcp-setup-powershell-contracts.test.js`、各 `*.ps1` | 同步新增 |

## 产物清单（按归属）

### 新增 source

```text
skills/spec-mcp-setup/helper-tools.json          # helper-tools-registry.v1（单一 helper 真相源；字段以 project-scaffold §4.2 canonical 为准，不重定义）
skills/spec-mcp-setup/provider-tools.json        # provider 槽位 registry（generic 骨架，不含具体 provider entries；锚点：父方案 §0.4.1 + Req 13）
docs/contracts/provider-readiness.md             # provider-readiness.v1 契约文档（字段 canonical 引父方案 §7.1）
docs/contracts/provider-readiness.schema.json    # provider-readiness.v1 schema（顶层，父方案 §7.1 登记）
docs/contracts/helper-tools-registry.schema.json # helper-tools-registry.v1 schema（顶层，父方案 §0.4.3 已登记；机器可校验落盘，字段源出 §4.2）
docs/contracts/tool-facts.schema.json            # tool-facts.v2 schema（顶层，父方案 §0.4.3 已登记；含 v1 兼容说明）
```

> Schema 落盘路径边界（呼应 Req 17.4 + 父方案 §0.4.3）：新增 schema 一律落 `docs/contracts/` 顶层，与既有 `provider-readiness.schema.json` 并列，**不新建 `docs/contracts/setup/` 子目录**（父方案 §7.1 未登记该目录）。`src/cli/contracts/**` 只 `require()` 引用，不放第二份。helper-tools-registry 字段在 schema 文件落地前以 project-scaffold §4.2 为 canonical，落地后按 `spec-work-run-artifact/v1` 模式 schema 文件转 canonical、§4.2 转引用。

### 新增脚本逻辑（shell + PowerShell 对等）

```text
skills/spec-mcp-setup/scripts/lib-helper-registry.sh / .ps1   # 从 registry 读 helper 列表
skills/spec-mcp-setup/scripts/normalize-setup-facts.sh / .ps1 # tool-facts.v1/v2 → normalized projection
skills/spec-mcp-setup/scripts/scan-configured-deps.sh / .ps1  # configured dependency scan
skills/spec-mcp-setup/scripts/setup-plan-renderer.cjs         # read-only plan renderer + install safety（Node，跨平台）
```

### 改造现有

```text
skills/spec-mcp-setup/scripts/install-helpers.sh / .ps1   # 改为从 registry 派生，移除内联列表
skills/spec-mcp-setup/scripts/check-health(.ps1)          # 改为从 registry 派生
skills/spec-mcp-setup/scripts/verify-tools.sh / .ps1      # 从 registry 派生
skills/spec-mcp-setup/scripts/write-setup-facts.sh / .ps1 # 产 tool-facts.v2（含 existence + configured_dependencies）
skills/spec-mcp-setup/scripts/render-status-block.cjs     # 9 分区 + 13 字段
skills/spec-mcp-setup/SKILL.md                            # mode/argument 写入边界语义
src/cli/commands/doctor.js                                # decision_input_health rollup + basis + normalizer 调用
```

### 文档/changelog

```text
CHANGELOG.md（每个 commit 同步）
README.md / README.zh-CN.md（runtime-setup mode 语义，user-visible 时）
docs/01-需求分析/13.scale集成/README.md（开发进展列 v1.11/v1.12 → 进行中→已完成）
```

## 实施步骤（goal-backward，每步带验证）

> 顺序原则：先 schema/registry（真相源）→ 派生脚本（消除漂移）→ facts 生产（v2）→ doctor 消费（gate）→ 安全/边界 → 双宿主 parity → 回归。每步 commit，commit 前跑该步最窄验证。

### 阶段 P1-A：Registry 真相源（Req 1, 2, 17）

1. **写 `helper-tools-registry.v1` schema** → 验证：`validateAgainstSchema` 对样例 pass/invalid。
2. **写 `helper-tools.json`**，登记 agent-browser/gh/jq/vhs/silicon/ffmpeg/ast-grep/ast-grep-skill，含 `safety`/`platform_required_tools`/`runner_kind`；`agent-browser.baseline_blocking=false` → 验证：schema 校验通过 + 字段齐全断言。
3. **`lib-helper-registry.sh`/.ps1**：从 registry 读列表 → 验证：输出列表 == 当前内联列表（迁移等价）。
   - 验证：`bash -n` + 列表 diff fixture。

### 阶段 P1-B：派生脚本，消除双列表（Req 1.5, 2, 18）

4. **改 `install-helpers.sh`/.ps1** 从 registry 派生，保留 install-source/mirror/browser opt-in 行为。
5. **改 `check-health`/.ps1**、**`verify-tools`** 从同一 registry 派生。
   - 验证：`npm run test:mcp-setup`（mcp-setup.sh + powershell-contracts）；新增 fixture：minimal 下 agent-browser=`skipped/degraded`、ast-grep missing+rg present=`degraded`、surface-ui/`SPEC_FIRST_BROWSER_HELPER_REQUIRED=1`=`action-required`。

### 阶段 P1-C：tool-facts.v2 + normalizer（Req 3, 14）

6. **写 `tool-facts.v2` schema**（含 `items[]`/`configured_dependencies[]`/`schema_capabilities[]` + 每工具 existence 字段供未来 honest-closeout 读）。**边界**：本切片仅暴露 existence 字段作为未来读取点，不实现任何 honest-closeout 校验/消费逻辑（Req 14.3）。
7. **`normalize-setup-facts.sh`/.ps1**：v1 缺字段填 unknown/not-checked/not-applicable；reason_code `setup-facts-invalid`/`-unreadable`/`-schema-unsupported`（不可读 > 版本无法识别优先级）。
8. **改 `write-setup-facts.sh`/.ps1** 产 v2。
   - 验证：normalizer determinism（同输入两次同输出）；v1 fixture 不崩；v2 fixture 含 configured deps。

### 阶段 P1-D：configured dependency scan（Req 4）

9. **`scan-configured-deps.sh`/.ps1**：扫 MCP config/hooks/allowlist/setup scripts/verification commands 五 surface，只提命令名+来源不执行；写 `tool-facts.v2.configured_dependencies[]`；undeclared → `action-required` + `configured-dependency-undeclared`。
   - 验证：fixture：undeclared hook tool（如 ruff）→ 正确 reason_code；hook 不被执行。

### 阶段 P1-E：install safety lens + plan renderer + mode 边界（Req 5, 6, 7）

10. **`setup-plan-renderer.cjs`**：每安装项算 `safety_result`（safe/review-required/unsupported/blocked）+ reason_code；缺 source/版本/权限 → blocked。
11. **改 `render-status-block.cjs`**：9 分区 + 13 字段行。
12. **改 `SKILL.md`**：mode 写入边界（`--check` 只读 / `--verify-only`·`--refresh-facts` 写 facts / `--plan` 规划 / `--install` 安装）；`--install` 跳过 blocked、展示 review-required。
    - 验证：`--check` 不写 facts fixture；unpinned-npx=review-required；installer-script/unknown-source=blocked/review；shell metachar=review/blocked。

### 阶段 P1-F：provider-readiness generic 槽位（Req 13, 17）

13. **写 `provider-readiness.schema.json` + `provider-readiness.md`**：`readiness_status` 5 值 + `lifecycle` 布尔位 + `fallback`；字段 canonical 引父方案 §7.1；不写语义 trust。**provider-tools.json** 只放 generic 槽位。
    - 验证：schema valid/invalid；readiness 只接受 5 值；轴 B 语义档不得入 readiness。

### 阶段 P1-G：init 边界确认（Req 8）

14. 确认/补测 `init` 不安装、不写 tool-facts、不把 registry 解析写入 managed state。
    - 验证：`spec-first init --claude -y` / `--codex -y` 后 `.spec-first/config/tool-facts.json` 不被 init 创建。

### 阶段 P1-2（v1.12）：doctor 消费（Req 9, 10, 11, 12, 15）

15. **改 `doctor.js`**：
    - 读 setup facts → 经 normalizer → 计算 `decision_input_health`（7 状态决策表）。
    - 输出 `decision_input_health_basis`（reason_code/artifact_refs/schema_versions/freshness/counts/configured_dependency_counts/provider_counts）。
    - provider missing/stale 不单独使 minimal 进 error（→ warn）。
    - doctor 不安装/不写 host config/不刷新 provider。
    - 保留 L15 7 天 freshness 常量、`workflow_runnability`、run-artifact 行为不变。
    - 验证：7 状态各一 fixture（no-host/missing/invalid/required-action/stale/optional-degraded/ready）；`decision_input_health != 'not_checked'`（consumer gate 断言）；basis.artifact_refs 指向 facts。

### 阶段 P1-3：回归 + 文档（Req 16, 文档）

16. **REG 回归**：`npm test`（unit+smoke+integration）；REG-DOCTOR-001/002、REG-RUNART-001/002/003。
17. **文档**：CHANGELOG（每 commit）、README runtime-setup mode（user-visible）、`docs/01-需求分析/13.scale集成/README.md` 开发进展列更新。

## Requirements → 步骤 覆盖矩阵

| Req | 步骤 | 验证锚点 |
| --- | --- | --- |
| 1 Helper registry | 1,2,3,4,5 | schema 校验 + 列表 diff + test:mcp-setup |
| 2 required/baseline 分离 | 2,4,5 | minimal/surface-ui/env fixture |
| 3 tool-facts.v2 normalizer | 6,7,8 | determinism + v1/v2 fixture |
| 4 configured dep scan | 9 | undeclared reason_code fixture |
| 5 install safety | 10 | safety_result fixture |
| 6 mode 写入边界 | 12 | --check 不写 fixture |
| 7 status renderer | 11 | 9 分区 + 13 字段断言 |
| 8 init 不安装 | 14 | init 后 facts 不存在 |
| 9 doctor rollup | 15 | 7 状态决策表 fixture |
| 10 basis | 15 | basis 字段齐全 |
| 11 doctor 只读 | 15 | 无 install/host-config 副作用 |
| 12 provider 不阻塞 minimal | 15 | provider stale → warn |
| 13 provider-readiness 槽位 | 13 | schema valid + 5 值 enum；provider-tools.json 仅 generic 骨架（锚点 §0.4.1，无具体 entries） |
| 14 honest-closeout 接口预留 | 6 | existence 字段暴露 |
| 15 consumer gate | 15,16 | decision_input_health != not_checked |
| 16 regression | 16 | npm test 全绿 + REG-* |
| 17 命名/路径 canonical | 1,2,13 | profile/readiness enum 断言 |
| 18 双宿主 parity | 3,4,5,7,8,9,15 | powershell-contracts + jq-on-pwsh fixture |

## Open Questions / 设计决策

> 承接 requirements.md「设计阶段待定项」：freshness window 时长属设计决策，验收以「超过配置窗口」可判定条件为准。

| # | 问题 | 候选 | 推荐 | source_tag | consequence |
| --- | --- | --- | --- | --- | --- |
| OQ-1 | setup-facts freshness window 时长（Req 9.5 `stale` 阈值）？`doctor.js` 现仅有 `VERIFICATION_EVIDENCE_MAX_AGE_MS=7天`，无 setup-facts 专属常量 | (a) 复用/对齐 7 天常量；(b) 新增独立 `SETUP_FACTS_MAX_AGE_MS`；(c) 可配置（`.spec-first/config`） | (a) 初期对齐 7 天，与既有 freshness 语义一致、最小新增；确有需求再独立或可配置 | advisory（待实现确认） | **阈值确定前，步骤 15 的 `stale` fixture 阻塞**——Req 9.5 deterministic rollup 的一档无法写 fixture |
| OQ-2 | helper-tools-registry schema 落地后 canonical 归属（schema 文件 vs §4.2 prose） | 按 `spec-work-run-artifact/v1` 既有模式：schema 文件转 canonical、§4.2 转引用 | 落地时按既有模式迁移，父方案 §0.4.3 已预登记 | advisory | 不迁移则 §4.2 与 schema 文件双定义（违反 §0.4.3） |

## Risks / Anti-patterns

| 风险 | 反模式 | 防护 |
| --- | --- | --- |
| registry 只是搬家 | required/baseline/surface 仍混用 | schema 强制 `baseline_blocking`/`surface_overlays`/`demand_signals` 分离字段 |
| 双列表残留 | check-health 还自带列表 | 步骤 5 收敛 + diff 验证两者同源 |
| v1 消费端崩 | normalizer 不兼容旧 facts | 步骤 7 v1 fixture 必过 |
| doctor 偷偷装东西 | rollup 顺手 repair | 步骤 15 只读断言 |
| not-run 被美化 | 缺工具写成通过 | existence 字段 + 未来 honest-closeout 读取点（Req 14） |
| 越界做 v1.13/provider | 顺手实现 verification/CodeGraph | Non-goals + provider 只 generic 槽位 |
| 单宿主只改一半 | 只改 .sh 不改 .ps1 | 每步 shell+ps1 对等 + powershell-contracts |
| consumer gate 空转 | v1.11 facts 无人消费就宣称完成 | 步骤 15 gate 断言 + v1.11 不单独完成 |

## 测试计划

- **Contract tests**：helper-tools-registry / tool-facts.v2 / provider-readiness schema valid+invalid；复用 `schema-validator.js`（不建第二套）。
- **Setup/readiness fixtures**：minimal agent-browser=skipped、ast-grep→rg degraded、surface-ui 升级、undeclared hook、unpinned-npx review、blocked installer-script、`--check` 不写、`--verify-only` 写不装、v1 兼容、v2 configured deps、jq-on-PowerShell 不失败。
- **Doctor fixtures**：7 状态 decision_input_health 决策表、basis 字段、provider stale→warn、consumer gate（!=not_checked）。
- **Regression**：REG-DOCTOR-001/002、REG-RUNART-001/002/003、`npm test` 全绿。
- **命令**：`npm run test:mcp-setup`（每脚本步）；`npm run typecheck`+`test:unit`（doctor/CLI 步）；`npm run test:smoke` + `spec-first init/doctor --claude|--codex --json`（projection 步）；`npm test`（收尾）。

## 验收（DoD）

1. helper 列表唯一来源 `helper-tools.json`，install-helpers/check-health/verify-tools 同源。
2. minimal 下 agent-browser 不作 baseline blocker；ast-grep 可 degraded 到 rg。
3. `tool-facts.v2` + normalizer 兼容 v1；reason_code 完整。
4. configured dependency scan 报 undeclared hook/script command。
5. install safety 输出 risk_flags/pin_status/review_required/safety_result；`--install` 不执行 blocked。
6. `--check` 不写 facts；mode 写入边界清晰。
7. **`doctor --json` 的 `decision_input_health` 由 facts 计算（!= `not_checked`）+ basis 指向 facts（consumer gate 过）。**
8. 双宿主 parity；Windows 原生 PowerShell 不因缺 jq 失败。
9. `npm test` 全绿；REG-* 不回归。
10. CHANGELOG/README/开发进展列同步；未做 source 目录重命名、未做 v1.13/provider/governance。

## 已执行验证（本 plan 阶段）

- 已读取 requirements.md 全文（18 条 EARS）。
- 已核对真实 source 锚点：install-helpers.sh / check-health 双列表、write-setup-facts v1、doctor.js L15/L491、schema-validator.js:47、test 入口、powershell-contracts。
- 未执行任何实现、未跑测试、未改 source（plan 阶段）。
