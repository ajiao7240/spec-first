---
title: Top 3 运行时安全与可运行性优化计划
created: 2026-04-19
status: completed
owner: engineering
origin: 2026-04-19 下一阶段最高优先级问题收敛
scope: init/clean dry-run 与 managed boundary、资产内容级一致性守卫、doctor runnability simulation contract
---

# Top 3 运行时安全与可运行性优化计划

## 1. 背景与问题定义

上一轮已经完成的工作，主要把决策输入的“真假边界”先收紧了一层：

- `src/context-routing/evaluator.js` 已经把 `fact-backed / mixed / skeletal` 拉开，不再把装配完成误判成高可信事实。
- `src/cli/commands/doctor.js` 已提供 `--json` 输出，并明确 `workflow_runnability: not_verified`。
- `tests/unit/asset-consistency.test.js` 已覆盖 source skill 有 mirror、package/plugin version 对齐、retired bootstrap token 不回归。

但下一阶段最优先的三个问题仍然直接影响用户对 runtime 的信任，以及 LLM 对当前仓库状态的判断质量：

1. `init` / `clean` 缺少 `--dry-run`，用户无法在执行前看见 managed boundary 和文件影响面。
2. 资产一致性测试仍偏“存在性”，还不能证明 source/mirror 的关键 contract 没漂移。
3. `doctor --json` 只能说 `not_verified`，还不能表达“为什么只是 not_verified”以及“哪些前置条件已经满足到 simulated”。

这三项都不应通过重状态机解决，而应通过更清晰的边界、共享计划结构、可机器消费的事实分层，给用户和 LLM 更高质量的决策输入。

## 2. 代码事实基线

### 2.1 `init` 当前事实

`src/cli/commands/init.js` 当前链路是：

1. 解析参数。
2. 读取现有 state；若是 legacy state，走 hard reset。
3. 基于 manifest、adapter、developer 构造 `previewState`。
4. 直接调用：
   - `removeObsoleteManagedAssets(projectRoot, previousState, previewState, adapter)`
   - `pruneCommandNamespace(projectRoot, previewState.commands, adapter)`
5. 再调用 `syncBundledAssets(projectRoot, adapter)` 真正写入 runtime 资产。
6. 写 runtime files、lang policy、instruction bootstrap、developer file、managed state。

结论：

- 当前已经存在“previewState”概念，但它只服务内部删除判断，不是用户可见 contract。
- 真实 apply 和“潜在变更计划”没有共享一个显式结构体。
- `pruneCommandNamespace()` 会删除 command 目录下不在 allow-list 中的文件，但 CLI 没有提前把这一行为显式暴露给用户。

### 2.2 `clean` 当前事实

`src/cli/commands/clean.js` 当前链路是：

1. 解析参数。
2. 读取 managed state；legacy state 直接报错退出。
3. 通过 `removeManagedAssets(projectRoot, state, adapter)` 删除 tracked assets。
4. 删除 instruction bootstrap / Claude SessionStart hook / runtime files / state file / empty roots。

结论：

- `clean` 的删除边界主要靠 state 文件 enforce，是正确方向。
- 但用户在真正删除前看不到“将删哪些 tracked 文件/目录、哪些 custom 资产不会动”。
- `removeEmptyManagedRoots()` 属于 clean 末尾收口行为，当前也没有 preview。

### 2.3 state 层当前事实

`src/cli/state.js` 目前提供：

- `removeManagedAssets()`
- `removeObsoleteManagedAssets()`
- `pruneCommandNamespace()`
- `hardResetManagedAssets()`

这些函数都直接执行删除，不返回计划对象。

结论：

- 当前 state 层是“执行器”，不是“planner + executor”双态结构。
- 如果直接在 `init.js` / `clean.js` 各自拼接 dry-run 文案，后续极易出现 preview/apply 漂移。

### 2.4 asset consistency 当前事实

`tests/unit/asset-consistency.test.js` 现在只验证：

1. 每个 `skills/<name>/SKILL.md` 都有 `docs/10-prompt/skills/<name>/SKILL.md`。
2. `package.json` version 与 `.claude-plugin/plugin.json` version 一致。
3. retired bootstrap token 不回归。

结论：

- 这是 presence-level guard，不是 content-level guard。
- 直接做“全量 mirror byte-equal”风险过高，因为仓库内已有 source/mirror 故意不完全字节相等的先例。
- 真正该守的是关键 contract anchor，而不是机械要求所有 docs mirror 与 source 完全一致。

### 2.5 `doctor` 当前事实

`src/cli/commands/doctor.js` 当前 `buildDoctorReport()` 输出：

- `install_health`
- `runtime_asset_health`
- `host_readiness`
- `decision_input_health: not_checked`
- `workflow_runnability: not_verified`

结论：

- 当前已做到“不虚构已验证 workflow”。
- 但 `workflow_runnability` 仍是单点值，缺少 supporting evidence：
  - 哪些条件满足了
  - 为什么还是 `not_verified`
  - 什么情况下可以升级为 `simulated`
- 这会让下游 LLM 只能拿到结论，拿不到结论背后的判据。

## 3. 目标与非目标

## 3.1 目标

1. 为 `spec-first init` / `spec-first clean` 增加 `--dry-run`，让 preview 与 apply 共用同一计划结构。
2. 让 CLI 显式暴露 managed boundary：
   - 哪些路径由 spec-first 管理
   - 哪些删除属于 tracked removal
   - 哪些删除属于 namespace prune / empty-root cleanup
   - 哪些 custom 文件会保留
3. 把资产一致性从“存在性”升级到“关键 contract anchor 一致性”。
4. 把 `doctor --json` 的 `workflow_runnability` 升级为：
   - `not_verified`
   - `simulated`
   - `verified`
5. 对 `simulated` / `verified` 给出独立证据字段，不把其塞回单个 summary 文本。

## 3.2 非目标

1. 不引入多阶段审批状态机。
2. 不把 `doctor` 变成 workflow orchestrator。
3. 不要求 source/mirror 全量字节级一致。
4. 不在本轮实现真实宿主端到端 workflow 执行。
5. 不改变现有 managed state 的 source-of-truth 地位。

## 4. 设计原则

1. `轻 contract + 明确边界 + 让 LLM 决策`
2. preview 与 apply 必须共享同一内部计划结构，禁止两套逻辑。
3. `doctor` 只报告事实分层，不替用户决定下一步。
4. asset consistency 只守“runtime / docs 会误导用户”的关键 contract，不守非关键 prose 差异。
5. 单一真相源保持不变：
   - runtime 删除边界真源仍是 managed state + adapter root
   - asset contract 真源仍是 `skills/` + 对应 contract tests
   - workflow runnability 真源仍是 `doctor` 的机器可读 report

## 5. 总体方案

### 5.1 `init` / `clean` 新增 shared operation plan

在 `src/cli/state.js` 增加 planner 层，把“将执行的动作”先编译成计划对象，再由 apply 层消费。

建议新增的内部结构：

```js
{
  operations: [
    { kind: 'remove_file', reason: 'obsolete_managed_asset', path: '.claude/commands/spec/foo.md' },
    { kind: 'remove_dir', reason: 'obsolete_workflow_skill', path: '.claude/spec-first/workflows/spec-old' },
    { kind: 'prune_command', reason: 'namespace_not_managed', path: '.claude/commands/spec/custom.md' },
    { kind: 'write_runtime_asset', reason: 'bundled_sync', path: '.agents/skills/spec-work/SKILL.md' },
    { kind: 'write_state', reason: 'managed_state_refresh', path: '.codex/spec-first/state.json' },
    { kind: 'remove_empty_root', reason: 'post_clean_cleanup', path: '.agents/agents' }
  ],
  summary: {
    remove_file: 0,
    remove_dir: 0,
    prune_command: 0,
    write_runtime_asset: 0,
    write_state: 0,
    remove_empty_root: 0
  }
}
```

该结构是内部 contract，不需要一次性暴露全部字段给用户，但 apply 与 dry-run 必须都消费它。

### 5.2 dry-run 输出边界

#### `init --dry-run`

输出应至少包含：

- 目标平台
- 将写入的 managed assets 数量与关键路径
- 将删除的 obsolete managed assets
- 将 prune 的 command namespace 文件
- developer/profile/lang-policy/bootstrap/state 是否会被写入
- “dry-run only, no files changed”

#### `clean --dry-run`

输出应至少包含：

- 目标平台
- 将删除的 tracked managed assets
- 将删除的 runtime 管理文件（state / bootstrap / settings hook）
- 将尝试清理的空目录
- 明确声明 custom assets outside managed set remain untouched

### 5.3 asset consistency 从 presence 升级到 contract anchors

不做全量 byte-equal。改为对每个高风险资产定义 anchor 级 contract test。

优先覆盖：

1. `spec-plan`
2. `spec-work`
3. `spec-work-beta`
4. `spec-review`
5. `spec-graph-bootstrap`

原因：

- 这几项直接承载 Stage-0 / verification / plan/work/review 的高价值 contract。
- 已有 repo 先例就是通过 unit contract tests 守这些 skill 的关键段落，而不是要求 mirror 全文 byte-equal。

本轮落地方式：

- 在 `tests/unit/asset-consistency.test.js` 中补一层“高风险 skill source/mirror 关键锚点一致性”。
- 锚点以关键词组合或正则为主，不以整篇文档文本一致为目标。
- `spec-graph-bootstrap` 重点守：
  - Stage 0-4 phase wording
  - fact inventory / risk signals / test surface
  - graph bootstrap entrypoint 表达
- `spec-plan` / `spec-work` / `spec-review` 则守：
  - verification summary
  - verifier dispatch
  - verification gate state
  - stage0-context 命令入口

### 5.4 `doctor` runnability 分层升级

建议把 `workflow_runnability` 语义拆成：

- `not_verified`
  - 缺少足够 runtime/host 条件，或尚无 simulation/evidence
- `simulated`
  - runtime asset health 与 host readiness 达到可运行基线，且关键 workflow surface 可解析/可定位，但尚无真实执行证据
- `verified`
  - 存在真实 workflow execution evidence，且证据未过期

同时新增独立字段：

```json
{
  "workflow_runnability": "simulated",
  "workflow_runnability_basis": {
    "runtime_assets_ready": true,
    "host_cli_ready": true,
    "managed_state_present": true,
    "workflow_surface_resolved": true,
    "execution_evidence_present": false,
    "reason": "runtime + host checks passed and managed workflow surfaces resolved, but no execution evidence is recorded"
  }
}
```

这保持了“结论”和“证据基础”分离，避免把所有语义压扁到一个 summary 字符串里。

### 5.5 `verified` 的证据策略

本轮不做真实工作流执行器，但先把证据插槽 contract 建好。

建议：

- `verified` 只在检测到明确 evidence 文件时返回。
- 若没有 evidence 文件，即使 runtime/host 全绿，也最多返回 `simulated`。

候选 evidence 策略：

1. 读取 `.spec-first/runtime/verification-evidence.json` 一类标准化文件。
2. 若文件不存在，则保持 `simulated`。

本轮可先采用最小合同：

- 有 evidence file 且 schema 基本合法 -> `verified`
- 否则：
  - 条件不足 -> `not_verified`
  - 条件充分但无 evidence -> `simulated`

## 6. 实施单元

## Unit 1: `init` / `clean` 共享 operation plan + dry-run

### 目标

把 state 层从纯执行器扩成“planner + executor”，让 preview 与 apply 共用同一动作计划。

### 涉及文件

- `src/cli/state.js`
- `src/cli/commands/init.js`
- `src/cli/commands/clean.js`
- `tests/unit/managed-state-contracts.test.js`
- 新增 `tests/unit/init-dry-run.test.js`
- 新增 `tests/unit/clean-dry-run.test.js`

### 设计决策

1. planner 放在 `state.js`，因为删除边界真源就在这里。
2. `init.js` 不直接做 destructive call，而是：
   - build preview plan
   - `--dry-run` 时打印 plan
   - 非 dry-run 时 apply plan 后继续 sync/write
3. `clean.js` 同样先 build clean plan，再 decide preview/apply。
4. `syncBundledAssets()` 的写入部分如果不能在本轮完全 planner 化，至少先把 destructive side 完整 planner 化；写入 side 可以先做高层 summary，不强求列出每个字节变化。

### 失败优先测试

1. `init --dry-run` 不产生文件变化。
2. `clean --dry-run` 不删除 tracked files。
3. dry-run 输出包含 remove/prune/write summary。
4. apply 与 preview 的删除列表来自同一 planner，避免计划与执行漂移。

### Done Signals

1. `spec-first init --claude --dry-run` / `--codex --dry-run` exit 0。
2. dry-run 前后目录快照一致。
3. apply 后仍通过现有 managed-state contract tests。

## Unit 2: 资产内容级一致性守卫

### 目标

让高风险 source/mirror contract 漂移在 CI 层能被检出，而不是只守 mirror 是否存在。

### 涉及文件

- `tests/unit/asset-consistency.test.js`
- 如有必要，补 `docs/10-prompt/skills/...` 中漂移的关键段落

### 设计决策

1. 不做全量 byte-equal。
2. 采用 anchor sets：
   - 每个高风险 skill 定义一组 source/mirror 必须同时出现的关键词或语义锚点。
3. 对已有专门 contract test 的 skill，不重复做整篇校验；asset consistency 只做 repo-level governance guard。

### 失败优先测试

1. 高风险 skill 的 source 与 mirror 缺少关键锚点时失败。
2. retired bootstrap token guard 继续保留。
3. version consistency 继续保留。

### Done Signals

1. 高风险 skill source/mirror anchor drift 能被测试检出。
2. 不新增第二真相源。
3. 测试失败输出能明确指向具体 skill 与缺失 anchor。

## Unit 3: `doctor` runnability simulation / evidence contract

### 目标

把 `doctor --json` 从“只有 not_verified”提升成“能解释 not_verified/simulated/verified 的机器可读 contract”。

### 涉及文件

- `src/cli/commands/doctor.js`
- `tests/unit/doctor-json-contract.test.js`
- `tests/smoke/cli.sh`

### 设计决策

1. `workflow_runnability` 不再只靠硬编码常量，而是由 `workflow_runnability_basis` 计算。
2. `decision_input_health` 仍保持轻量语义，不与 runnability 混成一个字段。
3. 不重写 human output；先升级 JSON contract。
4. 真实 evidence 仅作为升级为 `verified` 的必要条件之一，不做流程编排。

### 失败优先测试

1. 无平台项目仍返回 `not_verified`，并说明 basis 不满足。
2. 平台存在且 runtime/host 条件满足时，返回 `simulated` 而不是 `not_verified`。
3. 有 evidence 文件时返回 `verified`。
4. JSON schema 向后兼容保留既有字段。

### Done Signals

1. `doctor --json` 可稳定输出三态 runnability。
2. `workflow_runnability_basis` 能解释状态来源。
3. smoke tests 覆盖 no-platform / platform-without-evidence / platform-with-evidence 至少前两类。

## 7. 风险与缓解

### 风险 1: preview/apply 漂移

原因：如果 planner 只覆盖删除，不覆盖写入 summary，用户仍可能误判 init 影响面。

缓解：

- 本轮明确在 plan 中区分“destructive operations full fidelity”和“write operations summarized fidelity”。
- 输出文案必须标注哪些是精确列表，哪些是汇总说明。

### 风险 2: content-level guard 过严导致维护成本上升

原因：如果锚点太多，任何普通文案修改都会触发 CI 噪音。

缓解：

- 只守 runtime-visible contract anchors。
- prose 风格与示例不纳入 repo-level asset consistency。

### 风险 3: `simulated` 被误读成已验证

原因：用户或 LLM 可能把 `simulated` 当成“运行过了”。

缓解：

- `workflow_runnability_basis.reason` 必须显式写明“no execution evidence recorded”。
- 保留 `verified` 作为唯一起过真实证据门槛的状态。

## 8. 验证计划

### 8.1 Targeted

```bash
npx jest tests/unit/managed-state-contracts.test.js tests/unit/init-dry-run.test.js tests/unit/clean-dry-run.test.js tests/unit/asset-consistency.test.js tests/unit/doctor-json-contract.test.js --runInBand
```

### 8.2 Broader

```bash
npm run test:smoke
npm test
```

## 9. 完成定义

1. `init` / `clean` 都支持 `--dry-run`。
2. dry-run 不修改文件系统。
3. destructive preview 与 apply 共用同一 planner。
4. asset consistency 能检测高风险 contract anchor 漂移。
5. `doctor --json` 支持 `not_verified / simulated / verified`。
6. `workflow_runnability_basis` 独立输出状态依据。
7. 所有相关 unit/smoke tests 通过。
8. `CHANGELOG.md` 同步记录源码改动。

## 10. 计划自审

### 10.1 与代码现状是否一致

一致，原因如下：

- `previewState` 在 `src/cli/commands/init.js` 已存在，说明引入 planner 是顺势收口，不是推翻重写。
- 删除边界目前集中在 `src/cli/state.js`，把 dry-run 规划逻辑放回这里能保持单一真相源。
- `tests/unit/asset-consistency.test.js` 当前确实只有 presence/version/retired-token 三类守卫，升级点明确。
- `src/cli/commands/doctor.js` 当前确实把 `workflow_runnability` 写死为 `not_verified`，升级空间明确。

### 10.2 是否违反仓库原则

没有。

- 没有引入多状态强编排。
- `doctor` 只是多给事实依据，不替 LLM 决策。
- `asset consistency` 仍是 contract guard，不是文档统一风格引擎。

### 10.3 当前 plan 仍保留的实现裁量

以下点保留到实现期决定，且不会影响 plan 的可执行性：

1. planner object 的最终字段命名。
2. evidence file 的最终路径命名。
3. dry-run 文案的具体输出格式。

这些都属于表示层或命名层裁量，不影响核心 contract。
