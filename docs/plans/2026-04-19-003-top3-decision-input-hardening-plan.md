---
title: Top 3 决策输入硬化实施计划
created: 2026-04-19
status: superseded
owner: engineering
origin: 2026-04-19 工程审查与 28 原则优先级筛选
scope: Stage-0质量等级、资产一致性治理、doctor分层健康输出
superseded_at: 2026-05-12
superseded_by: docs/plans/2026-04-19-004-top3-runtime-safety-and-runnability-plan.md
---

# Top 3 决策输入硬化实施计划

## 收口记录

2026-05-12 lifecycle cleanup 复核后，本计划状态从 `approved` 校准为 `superseded`。本计划的 Top 3 方向已被后续 runtime safety、runtime truth、runtime tool boundary、doctor runnability、dual-host governance 和 retired runtime guard 等计划及当前 source/tests 吸收；文中 `src/context-routing/*`、`src/bootstrap-compiler/*` 等早期 Stage-0 路径已不再是当前实施入口。如需继续演进，应从当前 graph/provider readiness、doctor/runtime capability 或 workflow evidence 计划进入，而不是按本文旧路径执行。

## 1. 背景

工程审查结论显示，`spec-first` 的核心价值不是强编排，而是通过 Stage-0 context、verification summary、verifier dispatch、gate state、workflow assets 和 runtime governance 给 LLM 提供更高质量的工程决策输入。

按 28 原则，最先修复的 3 个问题应选择对核心价值影响最大、改动边界可控、能快速降低误导和漂移风险的工作：

1. 收紧 Stage-0 `L0 / complete / data_quality` 语义。
2. 增加资产一致性与 retired entrypoint 回归测试。
3. 增加 `doctor --json` 分层健康输出，明确 workflow runnability 未验证。

## 2. 非目标

- 不引入重状态机。
- 不让 CLI 替 LLM 决定 workflow 下一步。
- 不把 `verification_gate_state` 变成审批流。
- 不重写全部 doctor human output。
- 不在本轮实现 `init --dry-run` / `clean --dry-run`。

## 3. 问题一：Stage-0 质量等级收紧

### 3.1 审查内容

当前 `src/context-routing/evaluator.js` 的核心风险是把 `manifest.status === complete`、routing 存在、minimal context 存在、`data_quality !== empty` 组合后判为 L0。这会让 `partial` 质量被误读为高可信。

`complete` 应只表示产物装配完成，不能表示事实可信。事实可信度应由 `data_quality`、`confidence`、`provenance`、`coverage_gaps`、`freshness` 等独立信号表达。

### 3.2 实施范围

涉及文件：

- `src/context-routing/evaluator.js`
- `src/bootstrap-compiler/compile-minimal-context.js`
- `src/bootstrap-compiler/sample-generator.js`
- `tests/unit/context-routing-evaluator.test.js`
- `tests/unit/spec-graph-bootstrap-compiler.test.js`

### 3.3 设计

收紧 evaluator 判定：

```text
L0:
  data_quality == fact-backed
  minimal-context exists
  freshness != stale

L1:
  data_quality == partial|mixed
  或 freshness == stale
  或 minimal-context missing

L2:
  data_quality == empty|sample-backed|skeletal
  或 routing missing

L3:
  context/control plane missing
  或 manifest missing/incomplete
```

输出增加：

- `data_quality`
- `confidence`
- `provenance`
- `coverage_gaps`

### 3.4 验收标准

- `partial` 不再返回 L0。
- `sample-backed` 不再返回 L0。
- `empty` 不再返回 L0。
- `fact-backed` 且 minimal context 存在时仍可返回 L0。
- `stage0-context` 的输出能让 LLM 看见质量等级和降级原因。

## 4. 问题二：资产一致性与 retired entrypoint 回归测试

### 4.1 审查内容

`spec-first` 有多个资产面：

- `skills/`
- `docs/10-prompt/skills/`
- `templates/claude/commands/spec/`
- `.claude-plugin/plugin.json`
- `src/cli/contracts/dual-host-governance/skills-governance.json`
- README 中英文

旧 workflow 迁移后，如果没有测试 guard，很容易重新出现 retired entrypoint 或 manifest/governance/version 漂移。

### 4.2 实施范围

涉及文件：

- `tests/unit/asset-consistency.test.js`
- `.claude-plugin/plugin.json`

### 4.3 设计

新增测试覆盖：

1. 所有 `skills/<name>/SKILL.md` 都有 `docs/10-prompt/skills/<name>/SKILL.md` mirror。
2. package version 与 plugin manifest version 一致。
3. retired bootstrap tokens 不得出现在源资产与文档中。

测试中的 retired token 用动态拼接，避免测试自身污染搜索结果。

### 4.4 验收标准

- legacy bootstrap skill 名称、Claude 旧入口、Codex 旧入口不会回归。
- manifest version 与 package version 漂移会失败。
- skill mirror 缺失会失败。

## 5. 问题三：`doctor --json` 分层健康输出

### 5.1 审查内容

当前 `doctor` 主要证明 runtime asset 和基础依赖是否存在，不能证明 workflow 可运行。用户容易把 PASS 输出理解成完整 workflow health。

应先提供机器可读 JSON contract，明确区分：

- install health
- runtime asset health
- host readiness
- decision input health
- workflow runnability

### 5.2 实施范围

涉及文件：

- `src/cli/commands/doctor.js`
- `tests/unit/doctor-json-contract.test.js`
- `tests/smoke/cli.sh`

### 5.3 设计

新增：

```bash
spec-first doctor --json
spec-first doctor --claude --json
spec-first doctor --codex --json
```

JSON 形状：

```json
{
  "schema_version": "v1",
  "platforms": [],
  "install_health": "pass",
  "runtime_asset_health": "not_applicable",
  "host_readiness": "not_applicable",
  "decision_input_health": "not_checked",
  "workflow_runnability": "not_verified",
  "checks": [],
  "warnings": []
}
```

本轮只建立 contract，不重写 human 输出。

### 5.4 验收标准

- `doctor --json` 输出可解析 JSON。
- 没有平台时也返回 `workflow_runnability: not_verified`。
- 已初始化平台时，JSON 包含分层健康字段。
- smoke 测试覆盖 JSON contract。

## 6. 执行顺序

1. 先写失败测试。
2. 修 Stage-0 evaluator 与 minimal-context 输出。
3. 增加资产一致性测试并修 version 漂移。
4. 增加 `doctor --json`。
5. 更新 `CHANGELOG.md`。
6. 跑 targeted tests。
7. 跑 `npm run test:unit`、`npm run test:smoke`。
8. 做代码审查。
9. 提交代码。

## 7. 验证命令

```bash
npx jest tests/unit/context-routing-evaluator.test.js tests/unit/spec-graph-bootstrap-compiler.test.js tests/unit/asset-consistency.test.js tests/unit/doctor-json-contract.test.js --runInBand
npm run test:unit
npm run test:smoke
```

## 8. 完成定义

- 三个问题均有测试覆盖。
- 新增/修改代码不引入强编排。
- `doctor --json` 明确 workflow 不可运行证明。
- Stage-0 L0 只代表 fact-backed 的高质量决策输入。
- 旧 bootstrap entrypoint 不会回归。
- 提交包含计划、实现、测试和 changelog。
