---
title: feat: 固化 spec-app-consistency-audit headless runner
date: 2026-05-04
status: completed
type: plan
spec_id: 2026-05-04-002-app-audit-headless-runner
origin: docs/2026-05-04/spec-first-global-audit/09-actionable-task-list.md#AUDIT-P2-001
target_repo: spec-first
---

# feat: 固化 spec-app-consistency-audit headless runner

## 摘要

本计划用于实现 `AUDIT-P2-001`：把当前 `spec-app-consistency-audit` 单测中已经串联验证的 headless e2e recipe 固化为一个可复用 runner。目标是让 `spec-code-review` 等 headless caller 和下游 workflow 用一条命令生成完整 run-scoped artifacts，并复用现有 artifact validation，而不是继续把编排逻辑散落在测试文件里。

Runner v1 只承诺 `mode:headless` pipeline；`mode:default` 交互式复现路径不在 v1 范围（见 `## 非目标`）。

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
- v1 不承诺 `mode:default` 或 `mode:report-only` 入口语义；维护者交互式复现 default mode 的需求留给 v1.1 评估，不阻塞 v1 落地。

## 现有证据

| 证据 | 当前作用 |
|---|---|
| `skills/spec-app-consistency-audit/SKILL.md` | 定义 headless/report-only/default mode、artifact 路径、metadata lifecycle、strict issue gate 和 LLM/脚本边界 |
| `skills/spec-app-consistency-audit/scripts/lib/audit-utils.js` | 提供 mode、path、git base、source input、redaction 和 common artifact helpers |
| `tests/unit/spec-app-consistency-audit-cli-e2e.test.js` | 已证明 metadata、preflight、impact facts、contracts、merge、report、manifest、headless envelope 和 validation 可以串联 |
| `skills/spec-app-consistency-audit/scripts/validate-artifacts.js` | 提供当前 artifact schema validation 和 strict issue 校验 |
| `skills/spec-app-consistency-audit/scripts/render-headless-envelope.js` | 提供成功/失败 envelope 输出，适合作为 runner terminal summary |

## Runner Contract v1

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
| `mode:headless` | 可选；默认 `headless`，runner v1 只接受 `mode:headless`，传入其他值返回 failed envelope |
| `base:<sha-or-ref>` | headless diff scope 必填；缺失时返回 failed envelope 与非 0 exit |
| `--source <path>` | source root 或 repo root；必须保持 repo/source scoped diff contract |
| `--prd <path>` | local PRD/materialized product input |
| `--figma-context <path>` | local materialized Figma context；runner 不做远程 Figma 拉取 |
| `--run-id <id>` | 可选；缺省由 metadata builder 生成 |
| `--run-dir <path>` | 可选；缺省 `.spec-first/app-audit/runs/<run-id>/` |
| `--output-format json|text` | 可选；默认输出 headless envelope text，JSON 模式输出 run summary |

> **v1 issue input contract：** runner 支持显式 `--raw-issues <path>`，也支持调用方把 raw issues staging 到 `<run-dir>/input/raw-issues.json`。只要存在 raw issue 输入，调用方必须显式提供 `--issue-synthesis-status llm_provided|fixture_provided`；runner 不替调用方推断 issue 来源，也不生成 LLM verdict。无 raw issue 输入时，runner 生成空 `issues.json` 并标记 `issue_synthesis_status: not_run`，表示 awaiting LLM audit。

输出：

- `metadata.json`
- `preflight.json`
- `impact-facts.json`
- `contracts/*.json`
- `merged-context.json`
- `app-audit-context.json`
- `issues.json`（始终写出；无 raw issue 输入时为空数组并带 `issue_synthesis_status: not_run`，有输入时必须带 `llm_provided` 或 `fixture_provided`）
- `audit-report.json`
- `artifact-manifest.json`
- `headless-envelope.txt`
- validation summary stdout

> **Markdown summary 边界：** `app-consistency-audit.md` 与 `app-consistency-audit.summary.md` 属于下游 Report Writer 产物，runner v1 不直接生成，避免把 deterministic pipeline 夸大为完整 LLM verdict/report workflow。

> **`issue_synthesis_status` 字段：** machine-readable source-of-truth 是 `issues.json` 与 `audit-report.json`；`headless-envelope.txt` 渲染固定文本行 `Issue synthesis status: <enum>` 供 headless caller 扫描。`validate-artifacts.js` 校验 JSON artifact 字段，`render-headless-envelope.js` targeted tests 校验文本 envelope 行。下游 `spec-code-review` 据此区分 「audit 通过 / 0 issue」 与 「awaiting LLM audit / 未 audit」。详见 U3。

## 实施单元

### U1. 盘点并抽出当前 e2e recipe

**目标：** 从 `tests/unit/spec-app-consistency-audit-cli-e2e.test.js` 提取当前脚本顺序、必要输入和产物依赖。

**修改范围：**

- `tests/unit/spec-app-consistency-audit-cli-e2e.test.js`
- 可能新增 `tests/helpers/app-audit-fixture.js` 或局部 helper
- 可能新增 `tests/helpers/app-audit-fixture-dimensions.json` 或等价的 fixture-dimensions registry

**验收标准：**

- 测试 fixture 不再把 runner 逻辑与断言混在一起。
- 现有脚本顺序、artifact path 和 validation 断言保持等价。
- 抽出的 fixture helper 显式登记必须覆盖的输入维度，至少包括：PRD 缺失/最小化、figma-context 缺失/local materialized、route 多语言、KMP 共享模块缺/在、analytics 事件空/缺 case、i18n 资源缺失。维度清单作为 fixture-dimensions registry 与 fixture 同源维护。
- 新增一个 fixture audit 检查项：每次构建 fixture 时自动核对 fixture-dimensions registry 是否被全部覆盖；缺项则 fail 测试或显式标注 known-gap，禁止 silent skip。该 audit 与 e2e 测试同跑，不要求维护独立的 dogfood smoke run。

### U2. 新增 headless runner CLI

**目标：** 新增 `run-audit.js`，串联 deterministic artifact pipeline。

**修改范围：**

- `skills/spec-app-consistency-audit/scripts/run-audit.js`
- 可能扩展 `skills/spec-app-consistency-audit/scripts/lib/audit-utils.js`

**验收标准：**

- `node skills/spec-app-consistency-audit/scripts/run-audit.js --help` 返回参数说明和 mode 边界。
- 缺 `base:<ref>` 时返回 failed headless envelope，exit code 非 0，不写半成品 run。
- 传入 `mode:default` / `mode:report-only` 或其他非 `headless` 值时，返回 failed envelope `mode_unsupported`，exit code 非 0；--help 文本明确列出 v1 仅接受 `mode:headless`。
- 正常 fixture 运行写出完整 run-scoped artifacts。
- runner 在串联 `merge-contracts.js` 时显式覆盖调用形态；issue 输入 contract 已在 `## Resolved Decisions` 定稿为 v1 范围：
  1. 默认调用,合并 contract artifacts → `merged-context.json`
  2. `--issues-artifact --issue <raw-issues>` → `issues.json`；无 raw issue 输入时 runner 先写空 raw issue stub，再生成 `issue_synthesis_status: not_run`
  3. `--issue <issues.json>` 加 routes/quality artifacts → `audit-report.json`
- runner 的最后一步在 `render-headless-envelope.js` 之前调用 metadata finalize（新增 helper 或扩展 `build-run-metadata.js`），把 `metadata.json` 从 `started` 升级为 `complete` / `degraded` / `failed`，与 SKILL.md 的 metadata lifecycle 契约对齐。
- metadata finalize 只更新既有 `metadata.json` 的 status / completed / reason 字段，不重新扫描 source、不重新计算 `source_inputs`、`diff_hash` 或 `worktree_fingerprint`；如果扩展 `build-run-metadata.js`，必须确保 `.spec-first/app-audit/runs/**` 不进入 source hash。
- runner 对 `--source`、`--prd`、`--figma-context`、`--run-dir` 和 `--run-id` 执行 realpath containment 校验：拒绝 `..` traversal、symlink escape、不安全 run-id、默认 run dir 外写入，以及未声明的绝对 output escape。
- source scanning 只读取预期 App source root / git-tracked diff scope 内的文本输入；排除 `.env*`、private keys/certs、credential files、dependency/build directories、generated runtime mirrors 和大文件超限输入，所有排除以 degraded mode / reason_code 记录。
- runner 输出前统一经过 shared redaction layer；所有 persisted artifacts、JSON/text stdout、markdown summary、manifest 和 headless envelope 不得包含 token-like secret、Authorization / Cookie、长原文 PRD/Figma/source/issue 文本或绝对本机路径。
- U2 开始前先测量现有 e2e recipe wall-clock 基线并记录阈值；如果 subprocess 串联超过阈值，先列出需要 callable export 的脚本，再决定是否改为 single Node process 内调用，避免实现中途反转 runner 形态。

### U3. 保持 LLM verdict 外置

**目标：** 明确 runner 只负责 facts、contract merge、report assembly 和 validation，不替 LLM 生成 confirmed issue 或 final semantic verdict。

**修改范围：**

- `skills/spec-app-consistency-audit/SKILL.md`
- `skills/spec-app-consistency-audit/scripts/run-audit.js`
- `skills/spec-app-consistency-audit/scripts/validate-artifacts.js`（新增 `issue_synthesis_status` 枚举校验）
- `skills/spec-app-consistency-audit/scripts/render-headless-envelope.js`（在 envelope 中输出该字段）
- 可能扩展 `skills/spec-app-consistency-audit/scripts/lib/audit-utils.js`（共享枚举常量与 redaction 规则）
- tests

**验收标准：**

- runner 不包含业务语义 severity 判断、issue synthesis prompt 或 autofix 逻辑。
- `issues.json` 只能来自显式输入、LLM-produced artifact 或 fixture；没有输入时 report 应表达 no semantic issues produced / awaiting LLM audit。
- `issues.json` 与 `audit-report.json` 必须输出 `issue_synthesis_status`；`headless-envelope.txt` 必须渲染 `Issue synthesis status: <enum>` 固定文本行。取值限定为 `not_run` / `llm_provided` / `fixture_provided`：
  - `not_run`：无 raw issues 与 fixture issues 输入，runner 不发明 issues
  - `llm_provided`：来自显式 LLM-produced artifact 输入
  - `fixture_provided`：来自 fixture 输入（用于测试与 dogfood）
- `validate-artifacts.js` 强制校验 JSON artifacts 中 `issue_synthesis_status` 字段存在且取值在合法枚举内；缺失或越界视为 schema 违规，validation 失败。`headless-envelope.txt` 的固定文本行由 `render-headless-envelope.js` targeted tests 校验，不把 text artifact 伪装成 JSON schema。
- 当 `issue_synthesis_status = not_run` 且 `issues` 数组为空时，audit-report 必须明确表达 "awaiting LLM audit"，下游 `spec-code-review` 据此区分 「audit 通过」 与 「未 audit」。
- 如果 v1 决定支持 caller-staged LLM issue artifact，必须先定义严格 schema、来源标记、size/count/string length cap、markdown/control character escaping、redaction 和 fail-closed 行为；不得把 LLM/fixture artifact 当 trusted local input。

### U4. 更新测试与文档

**目标：** 让 e2e 测试验证 runner contract，并更新 source skill 文档。

**修改范围：**

- `tests/unit/spec-app-consistency-audit-cli-e2e.test.js`
- `skills/spec-app-consistency-audit/SKILL.md`
- `docs/05-用户手册/04-workflows-artifacts-map.md` 或 `10-产物目录.md`，仅当用户可见 runner contract 需要说明
- `CHANGELOG.md`

**验收标准：**

- e2e 测试通过 runner 生成 artifacts，或通过共享 helper 证明 runner 与测试 recipe 一致。
- e2e / targeted tests 覆盖 `issue_synthesis_status = not_run` 与 `fixture_provided`；`llm_provided` 无输入时 fail closed。所有已支持 JSON artifact 都要断言 `validate-artifacts.js` 在缺失或非法枚举时报错。
- e2e / targeted tests 覆盖 `headless-envelope.txt` 的 `Issue synthesis status: <enum>` 固定行。
- 新增负向 fixture：PRD、Figma context、source file、LLM issue payload 中出现 token-like secret 时，runner artifacts、stdout、markdown summary、manifest 和 headless envelope 均不泄漏原值。
- 新增 path-boundary fixture：`--source` / `--prd` / `--figma-context` / `--run-dir` / `--run-id` 的 traversal、symlink escape、默认 run dir 外写入和 unsafe run-id 均 fail closed。
- 新增 metadata finalize fixture：finalize 不重算 source hash，不把 `.spec-first/app-audit/runs/**` 纳入 `source_inputs` 或 `worktree_fingerprint`。
- e2e 测试覆盖 fixture-dimensions registry：U1 登记的所有维度都有至少一个 fixture case，未覆盖维度由 fixture audit 显式报错或标注 known-gap。
- 用户文档不夸大 runner 能力为完整 runtime QA 或 LLM verdict；明确 v1 仅承诺 `mode:headless`，`mode:default` 留给 v1.1。

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
| Subprocess 启动延迟 | 21 个子进程串联放大 headless caller 端到端延迟，影响 `spec-code-review` UX | plan 阶段先量一次 wall-clock 基线，设可接受阈值（如 < 5s）；超阈值则在 U2 改为 single Node process 内 require + invoke,而非子进程串联 |
| Artifact 泄漏敏感信息 | run artifacts / stdout 被下游 caller、日志或 git 操作传播 | 所有输出通过 shared redaction layer；secret-like fixture 覆盖 PRD、Figma、source、LLM issue 四类输入 |
| 路径与 source scope 逃逸 | headless caller 传入路径导致读写 repo 外文件或扫描 secret 文件 | realpath containment、run-id 校验、默认 run-dir confinement、secret/build/generated mirror 排除和 fail-closed negative tests |
| Metadata finalize 自引用 | 末尾 finalize 把本次 run artifacts 纳入 source hash，破坏 freshness 判断 | finalize 只改 status 字段；必要时让 source hash 排除 `.spec-first/app-audit/runs/**` |

## 完成定义

- `run-audit.js --help` 可用且准确说明边界，并明确 v1 仅接受 `mode:headless`。
- headless fixture 一条命令生成完整 artifacts，并通过 `validate-artifacts.js`。
- 现有 e2e test 仍覆盖 metadata、preflight、impact facts、contracts、merge、report、manifest、headless envelope 和 schema validation。
- `issues.json` 与 `audit-report.json` 输出 `issue_synthesis_status` 枚举（`not_run` / `llm_provided` / `fixture_provided`），并由 `validate-artifacts.js` 强制校验。
- `headless-envelope.txt` 渲染 `Issue synthesis status: <enum>` 固定行，JSON artifacts 是该状态的 machine-readable source-of-truth。
- runner path/source boundary、redaction coverage 与 metadata finalize 不自引用均有负向或 targeted tests。
- fixture-dimensions registry 与 fixture audit 在 e2e 测试链路中生效，禁止 silent 漏覆盖。
- `SKILL.md` 明确 runner 是 deterministic pipeline，不承担 LLM verdict，且 v1 仅承诺 `mode:headless`。
- `CHANGELOG.md` 已更新。

## Resolved Decisions

### From 2026-05-14 doc-review

- **Runner lifecycle / issue input contract：** v1 runner 同时承担 deterministic facts/context 生成与显式 raw issues 的 post-LLM report assembly。LLM-produced / fixture-produced issues 只能通过 `--raw-issues <path>` 或 `<run-dir>/input/raw-issues.json` staging 输入，且必须显式声明 `--issue-synthesis-status llm_provided|fixture_provided`；runner 不通过隐式 side channel 推断来源。
- **`not_run` 与 `issues.json` presence：** `issue_synthesis_status = not_run` 时生成空 `issues.json`，并在 `issues.json` 与 `audit-report.json` 中写入 `issue_synthesis_status: not_run`；`headless-envelope.txt` 渲染 `Issue synthesis status: not_run` 与 awaiting LLM audit 文案。下游据此区分「未 audit」与「0 issue audit 通过」。
- **Fixture-dimensions registry scope：** v1 将 fixture-dimensions registry 纳入 e2e 测试链路，缺失维度必须失败或显式登记 known gap，避免 runner recipe coverage 静默退化。
