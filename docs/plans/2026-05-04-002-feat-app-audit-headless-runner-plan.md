---
title: feat: 固化 spec-app-consistency-audit headless runner
date: 2026-05-04
status: active
type: plan
spec_id: 2026-05-04-002-app-audit-headless-runner
origin: docs/2026-05-04/spec-first-global-audit/09-actionable-task-list.md#AUDIT-P2-001
target_repo: spec-first
---

# feat: 固化 spec-app-consistency-audit headless runner

## 摘要

本计划用于实现 `AUDIT-P2-001`：把当前 `spec-app-consistency-audit` 单测中已经串联验证的 headless e2e recipe 固化为一个可复用 runner。目标是让维护者和下游 workflow 用一条命令生成完整 run-scoped artifacts，并复用现有 artifact validation，而不是继续把编排逻辑散落在测试文件里。

本计划只规划 runner 落地，不在本轮实现。

## 背景

当前 `tests/unit/spec-app-consistency-audit-cli-e2e.test.js` 已经通过 subprocess 串联以下脚本并验证产物：

- `build-run-metadata.js`
- `preflight.js`
- `build-impact-facts.js`
- `extract-prd-contract.js`
- `extract-figma-contract.js`
- `extract-code-contract.js`
- `extract-page-routes.js`
- `extract-kmp-architecture.js`
- `extract-engineering-quality.js`
- `extract-components.js`
- `extract-modules.js`
- `extract-analytics.js`
- `extract-i18n.js`
- `build-industry-profile.js`
- `select-rule-packs.js`
- `merge-contracts.js`
- `build-audit-context.js`
- `build-artifact-manifest.js`
- `render-headless-envelope.js`
- `validate-artifacts.js`

这些脚本已经体现了正确边界：脚本准备 deterministic facts、artifact manifest、validation result 和 headless envelope；LLM 仍负责专家审查、issue 语义判断、evidence auditor 和最终 verdict。缺口是当前 recipe 的编排入口主要存在于测试中，不便于 code-review headless 调用、手工复现或未来 workflow 复用。

## 目标

- 新增单一 headless runner，例如 `skills/spec-app-consistency-audit/scripts/run-audit.js`。
- 复用现有脚本与 schema 校验，生成完整 `.spec-first/app-audit/runs/<run-id>/` artifact chain。
- 为 `mode:headless` 提供稳定 `--help`、参数解析、失败 envelope 和 exit code 语义。
- 将现有 e2e 测试改为验证 runner，或抽出共享 fixture/helper 后让测试和 runner 使用同一 contract。
- 保持 `spec-app-consistency-audit` 的语义判断边界：runner 不做 LLM verdict，不做自动修复，不把 rule-pack-only 信号提升为 confirmed issue。

## 非目标

- 不改变 `spec-app-consistency-audit` 的公开 workflow 入口或 host runtime 生成逻辑。
- 不实现 autofix、writeback apply、runtime validation、真机/simulator 执行或远程 Figma 拉取。
- 不把 runner 变成通用状态机；它只负责确定性 artifact pipeline。
- 不手改 `.claude/`、`.codex/` 或 `.agents/skills/` generated runtime assets。
- 不把 LLM issue synthesis、evidence auditor 或 final verdict 内置进脚本。

## 现有证据

| 证据 | 当前作用 |
|---|---|
| `skills/spec-app-consistency-audit/SKILL.md` | 定义 headless/report-only/default mode、artifact 路径、metadata lifecycle、strict issue gate 和 LLM/脚本边界 |
| `skills/spec-app-consistency-audit/scripts/lib/audit-utils.js` | 提供 mode、path、git base、source input、redaction 和 common artifact helpers |
| `tests/unit/spec-app-consistency-audit-cli-e2e.test.js` | 已证明 metadata、preflight、impact facts、contracts、merge、report、manifest、headless envelope 和 validation 可以串联 |
| `skills/spec-app-consistency-audit/scripts/validate-artifacts.js` | 提供当前 artifact schema validation 和 strict issue 校验 |
| `skills/spec-app-consistency-audit/scripts/render-headless-envelope.js` | 提供成功/失败 envelope 输出，适合作为 runner terminal summary |

## Runner Contract 草案

建议入口：

```bash
node skills/spec-app-consistency-audit/scripts/run-audit.js \
  mode:headless \
  base:<sha-or-ref> \
  --source <repo-or-source-root> \
  --prd <path> \
  --figma-context <path> \
  --run-id <run-id>
```

最小参数：

| 参数 | 语义 |
|---|---|
| `mode:headless` | 必填或默认；runner v1 只承诺 headless pipeline |
| `base:<sha-or-ref>` | headless diff scope 必填；缺失时返回 failed envelope 与非 0 exit |
| `--source <path>` | source root 或 repo root；必须保持 repo/source scoped diff contract |
| `--prd <path>` | local PRD/materialized product input |
| `--figma-context <path>` | local materialized Figma context；`figma-ref` 不做远程拉取 |
| `--run-id <id>` | 可选；缺省由 metadata builder 生成 |
| `--run-dir <path>` | 可选；缺省 `.spec-first/app-audit/runs/<run-id>/` |
| `--output-format json|text` | 可选；默认输出 headless envelope text，JSON 模式输出 run summary |

输出：

- `metadata.json`
- `preflight.json`
- `impact-facts.json`
- `contracts/*.json`
- `merged-context.json`
- `app-audit-context.json`
- `issues.json`（仅当已有 LLM/raw issue input 或 fixture input；runner 不发明 issues）
- `audit-report.json`
- `app-consistency-audit.md`
- `app-consistency-audit.summary.md`
- `artifact-manifest.json`
- `headless-envelope.txt`
- validation summary stdout

## 实施单元

### U1. 盘点并抽出当前 e2e recipe

**目标：** 从 `tests/unit/spec-app-consistency-audit-cli-e2e.test.js` 提取当前脚本顺序、必要输入和产物依赖。

**修改范围：**

- `tests/unit/spec-app-consistency-audit-cli-e2e.test.js`
- 可能新增 `tests/helpers/app-audit-fixture.js` 或局部 helper

**验收标准：**

- 测试 fixture 不再把 runner 逻辑与断言混在一起。
- 现有脚本顺序、artifact path 和 validation 断言保持等价。

### U2. 新增 headless runner CLI

**目标：** 新增 `run-audit.js`，串联 deterministic artifact pipeline。

**修改范围：**

- `skills/spec-app-consistency-audit/scripts/run-audit.js`
- 可能扩展 `skills/spec-app-consistency-audit/scripts/lib/audit-utils.js`

**验收标准：**

- `node skills/spec-app-consistency-audit/scripts/run-audit.js --help` 返回参数说明和 mode 边界。
- 缺 `base:<ref>` 时返回 failed headless envelope，exit code 非 0，不写半成品 run。
- 正常 fixture 运行写出完整 run-scoped artifacts。

### U3. 保持 LLM verdict 外置

**目标：** 明确 runner 只负责 facts、contract merge、report assembly 和 validation，不替 LLM 生成 confirmed issue 或 final semantic verdict。

**修改范围：**

- `skills/spec-app-consistency-audit/SKILL.md`
- `skills/spec-app-consistency-audit/scripts/run-audit.js`
- tests

**验收标准：**

- runner 不包含业务语义 severity 判断、issue synthesis prompt 或 autofix 逻辑。
- `issues.json` 只能来自显式输入、LLM-produced artifact 或 fixture；没有输入时 report 应表达 no semantic issues produced / awaiting LLM audit。

### U4. 更新测试与文档

**目标：** 让 e2e 测试验证 runner contract，并更新 source skill 文档。

**修改范围：**

- `tests/unit/spec-app-consistency-audit-cli-e2e.test.js`
- `skills/spec-app-consistency-audit/SKILL.md`
- `docs/05-用户手册/04-workflows-artifacts-map.md` 或 `10-产物目录.md`，仅当用户可见 runner contract 需要说明
- `CHANGELOG.md`

**验收标准：**

- e2e 测试通过 runner 生成 artifacts，或通过共享 helper 证明 runner 与测试 recipe 一致。
- 用户文档不夸大 runner 能力为完整 runtime QA 或 LLM verdict。

## 验证计划

最小验证命令：

```bash
node skills/spec-app-consistency-audit/scripts/run-audit.js --help
npx jest tests/unit/spec-app-consistency-audit-cli-e2e.test.js --runInBand
npm run typecheck
```

影响 `SKILL.md` prose 时追加：

```bash
npm run lint:skill-entrypoints
```

如果 runner 修改共享 helper 或 validation 逻辑，再追加相关 app-audit targeted tests。

## 风险与控制

| 风险 | 影响 | 控制方式 |
|---|---|---|
| Runner contract 过厚 | 脚本开始替 LLM 做语义 judgment | 明确 runner 只产出 facts/report/validation，不生成 verdict |
| 半写 artifact | 下游 code-review 读取到不完整 run | 先写到 run dir，失败时输出 failed envelope；manifest/summary 只在完整后写 |
| report-only/headless 混淆 | 用户误以为 report-only 会写 run artifacts | runner v1 只承诺 headless；report-only 保持 no-write |
| fixture 过慢 | 单测链路变重 | 复用现有 fixture，必要时拆 smoke runner test 与完整 e2e test |
| source/runtime 边界漂移 | 手改 generated runtime 或 README 夸大能力 | 只改 source truth；runtime 需要刷新时另跑 `spec-first init` |

## 完成定义

- `run-audit.js --help` 可用且准确说明边界。
- headless fixture 一条命令生成完整 artifacts，并通过 `validate-artifacts.js`。
- 现有 e2e test 仍覆盖 metadata、preflight、impact facts、contracts、merge、report、manifest、headless envelope 和 schema validation。
- `SKILL.md` 明确 runner 是 deterministic pipeline，不承担 LLM verdict。
- `CHANGELOG.md` 已更新。
