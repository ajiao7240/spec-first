---
title: Bootstrap Delete And Regenerate Plan
created: 2026-04-20
updated: 2026-04-20
status: completed
owner: engineering
origin: 用户请求“结束掉之前的 plan，改为不采用覆盖更新，直接删除更新”
supersedes: docs/plans/2026-04-19-008-topology-unified-bootstrap-plan.md only for bootstrap/runtime 更新策略；topology contract 本身已在 008 计划完成
scope: runtime managed asset hard reset 口径收紧、bootstrap slug 级 delete-and-regenerate、bootstrap drift 诊断、workspace child slug 定向清理、doctor/evaluator contract 收口
---

# Bootstrap Delete And Regenerate Plan

## 1. 问题框定

当前仓库的 `spec-first init` 与 `spec-graph-bootstrap` 在更新语义上并不对称：

1. runtime managed assets 已有 hard reset / prune 能力，但对“重新安装时是否统一先删后生”还没有形成唯一口径。
2. bootstrap control-plane 与 `docs/contexts/<slug>/` 产物仍可能保留旧 contract 文件；当后续运行只做覆盖更新时，容易产生“新字段已写入、旧结构仍残留”的混合态。
3. 当前 rollback 基础并不能直接支撑 control-plane 的删后重建：现有 bootstrap backup 主要围绕 `contextDir`，且 backup 目录位于 control-plane 目录内部；如果直接删除 `.spec-first/workflows/bootstrap/<slug>/`，现有 backup 语义本身就会失效。
4. `doctor` 与 Stage-0 evaluator 当前能诊断部分 runtime 漂移，但对 bootstrap 产物的 contract 漂移还不够显式，导致用户容易误以为“产物已生成 = 产物已符合当前规范”。

本计划不再讨论 topology contract 本身；008 计划已覆盖并完成那一层。本计划只收口“受管产物升级时，应该怎样安全、清晰、可验证地删除后重建”。

## 2. 目标

把 runtime / bootstrap 两类受管产物的更新策略统一到“定向 delete-and-regenerate”：

1. `init` 对 runtime managed assets 采用 hard reset 后重建，而不是依赖 overlay 修补旧 runtime。
2. `spec-graph-bootstrap` 对目标 `slug` 的 control-plane 与 `docs context` 采用先删除、再完整生成，而不是保留旧文件做覆盖更新。
3. `doctor` / evaluator 对 bootstrap contract 过旧、关键产物缺失、workspace root / child slug 产物不完整等情况给出明确诊断。
4. 所有删除后重建路径都必须具备显式 rollback / restore 语义，不能把“删完再写”当作默认安全路径。
5. 保持删除边界可解释、可回滚、可验证，不把 `.spec-first/graph/` 的 CRG 图数据库误纳入高成本删除面。

## 3. 范围边界

### 3.1 本轮纳入范围

1. `src/cli/commands/init.js` 的 runtime 更新语义收紧
2. `src/bootstrap-compiler/run-bootstrap.js` 的 slug 级删除后重建
3. workspace root / child slug 的定向 prune 与 rerun 语义
4. bootstrap contract drift 诊断
5. 与上述行为直接相关的 unit / smoke / contract tests

### 3.2 本轮明确不做

1. 不删除 `.spec-first/graph/` 与 CRG 索引数据库
2. 不把 `init` 默认升级成“自动触发 bootstrap 重跑”的重 orchestrator
3. 不清空整个 `docs/contexts/` 或整个 `.spec-first/workflows/bootstrap/`
4. 不发明新的多阶段状态机来表达 bootstrap 更新流程

## 4. 核心决策

### KD-1：runtime 与 bootstrap 分层治理

`init` 只负责 runtime managed assets；bootstrap 产物由 `spec-graph-bootstrap` / `runBootstrap` 负责。两者都采用 delete-and-regenerate，但不混成一个命令的隐式副作用。

理由：

1. `init` 的职责是宿主运行时安装，不是项目上下文重建。
2. bootstrap 产物与 repo 内容强相关，删除与重建都应由 bootstrap 生命周期自己负责。

### KD-2：删除范围只限受管目录，不做全仓 overlay 清扫

允许删除的目标：

1. runtime managed assets：`.claude/spec-first/`、`.claude/commands/spec/`、`.claude/skills/`、`.agents/skills/`、宿主受管 agent 目录等
2. bootstrap control-plane：`.spec-first/workflows/bootstrap/<slug>/`
3. human-facing context docs：`docs/contexts/<slug>/`

明确不删除：

1. `.spec-first/graph/`
2. `docs/` 下非 `docs/contexts/<slug>/` 的其他文档
3. 用户自定义 skill、agent、hook、settings 等非 state 跟踪资产

### KD-3：bootstrap rerun 必须“先备份，再删除，再重建，失败可恢复”

虽然更新语义改为 delete-and-regenerate，但不能裸删后继续执行。必须复用现有 `rollback` / backup 基础，让失败时能恢复上一次完整产物。

补充约束：

1. backup 不能放在即将被删除的 control-plane 目录内部
2. restore 语义必须同时覆盖 `controlPlaneDir` 与 `contextDir`
3. workspace batch backup 也要能恢复 root + child 的完整目录树，而不仅是 docs 一侧

这意味着本计划的第一前提不是“直接在现有 rollback 上切删除”，而是先把 rollback 升级成真正支持 delete-and-regenerate 的机制。

### KD-4：runtime delete-and-regenerate 不是无条件全量删除，而是受保护的 destructive path

`init` 的目标是收口 runtime 更新语义，但不能把当前所有 rerun 都立刻改成“先全删再重建”。

本计划采用更稳妥的策略：

1. legacy state：继续走 hard reset
2. current state 且检测到 runtime drift / incompatible manifest shape：进入 destructive reset path
3. current state 且只是普通 rerun：可保留现有 `remove obsolete + write current` 主链，直到 atomic reset / rollback 就绪后再决定是否统一切换

这样可以避免把当前 `init` 的风险面一次性扩大到所有正常 rerun。

### KD-5：contract drift 是显式诊断，不是假定用户自己会清理

当以下任一条件成立时，`doctor` / evaluator 必须明确标记 bootstrap 已过期：

1. repo / child-slug 场景缺少 `context-routing.json`
2. repo / child-slug 场景缺少 `minimal-context/plan.json`、`minimal-context/work.json`、`minimal-context/review.json`
3. workspace-root 场景缺少 `workspace-registry.json` 或 `workspace-routing.json`
4. `artifact-manifest.json` 的 outputs 集合与当前 topology kind 对应的必需产物集合不匹配

补充约束：

1. workspace root 不能按 child/repo 的 `minimal-context/*` 规则误报
2. child slug / single-repo 也不能按 workspace-root overview manifest 规则误报

## 5. 实施单元

### Unit 0：先补 rollback 基础

**涉及文件**

1. `src/bootstrap-compiler/rollback.js`
2. `src/bootstrap-compiler/run-bootstrap.js`
3. `tests/unit/spec-graph-bootstrap-compiler.test.js`

**目标**

把 bootstrap rollback 从“主要恢复 context docs”升级到“可恢复 control-plane + context docs 的完整 delete-and-regenerate 前置能力”。

**要求**

1. backup 落在 control-plane 外部安全位置
2. single-repo restore 同时恢复 `controlPlaneDir` 与 `contextDir`
3. workspace restore 同时恢复 workspace root 与 child slug 目录
4. 失败时用户不会看到删空后无法恢复的中间态

**测试场景**

1. control-plane 已被删除时 restore 仍可恢复
2. workspace root / child 任一环节 publish 失败时，batch restore 恢复完整目录树
3. backup 目录不会随着目标 slug 目录删除而一起丢失

### Unit 1：收口 runtime destructive path

**涉及文件**

1. `src/cli/commands/init.js`
2. `src/cli/state.js`
3. `tests/unit/init-dry-run.test.js`
4. `tests/unit/managed-state-contracts.test.js`
5. `tests/unit/using-spec-first-runtime-contracts.test.js`

**目标**

把 `init` 的 destructive path 明确成：

1. 读 state / legacy state
2. 只在 legacy 或 current drift 命中时进入 destructive reset
3. destructive reset 时删除 managed runtime assets
4. 重新生成当前 manifest 对应的 runtime assets

**要求**

1. dry-run 输出要能体现 remove + write，而不是只体现 write side
2. 不破坏“保留用户自定义资产”的既有边界
3. destructive reset 的 apply 路径要有明确失败恢复策略，或至少在 plan 中显式列为前置约束
4. 在没有 drift 的普通 rerun 上，不强制扩大 destructive 面

**测试场景**

1. Claude rerun `init` 后不残留已淘汰 runtime skill / command / agent
2. Codex rerun `init` 后不残留 legacy compatibility 路径
3. custom asset 仍被保留
4. 普通 current rerun 不会因为 write 阶段失败而把 runtime 清空

### Unit 2：把 single-repo bootstrap 改成 slug 级删除后重建

**涉及文件**

1. `src/bootstrap-compiler/run-bootstrap.js`
2. `src/bootstrap-compiler/rollback.js`
3. `tests/unit/spec-graph-bootstrap-compiler.test.js`

**目标**

对 single-repo `slug` 的两类目录：

1. `.spec-first/workflows/bootstrap/<slug>/`
2. `docs/contexts/<slug>/`

统一采用“备份 -> 删除 -> 重新生成 -> 成功后清理备份；失败则回滚”。

**要求**

1. 建立在 Unit 0 的 rollback 能力就绪之上
2. 删除范围只限当前 `slug`
3. 重新生成后目录树必须只包含当前 compiler 主链会写出的文件
4. 旧 contract 文件不会在 rerun 后残留

**测试场景**

1. 先写入模拟旧文件，再 rerun bootstrap，确认旧文件被清掉
2. rerun 失败时恢复旧目录树

### Unit 3：workspace child slug 定向删除后重建

**涉及文件**

1. `src/bootstrap-compiler/run-bootstrap.js`
2. `src/bootstrap-compiler/workspace-registry.js`
3. `tests/unit/workspace-context.test.js`
4. `tests/unit/workspace-nested-topology.test.js`
5. `tests/unit/spec-graph-bootstrap-compiler.test.js`

**目标**

workspace rerun 时：

1. workspace root slug 目录先删除后重建
2. 当前 registry 中仍存在的 child slug 目录逐个删除后重建
3. 已从 registry 移除的 child slug 继续按 prune 路径删除

**要求**

1. 删除范围只限当前 `slug`
2. 不删除无关 slug
3. child repo 本身为 monorepo 时，nested topology 输出仍完整
4. workspace rerun 后不会残留旧 child 的过期 minimal-context / routing 文件
5. workspace root manifest 与 child slug manifest 分别按各自 contract 生成，不混用检查规则

### Unit 4：bootstrap drift 诊断

**涉及文件**

1. `src/context-routing/evaluator.js`
2. `src/cli/commands/doctor.js`
3. `tests/unit/doctor-json-contract.test.js`
4. `tests/unit/runtime-contract-boundary.test.js`

**目标**

把“bootstrap 目录存在但 contract 过旧”显式诊断出来。

**要求**

1. 关键 control-plane 缺失时，不得继续给出误导性的完整态
2. `doctor --json` 需要给出可操作 fix，例如“重新运行 `spec-graph-bootstrap`”
3. evaluator 的 `fallback_reason` 要能区分“文件不存在”和“旧 contract 漂移”
4. drift 判定按 manifest kind / topology kind 分型：
   - workspace root
   - repo / child slug
   - single-repo

### Unit 5：KAZ 类混合态回归

**涉及文件**

1. `tests/unit/stage0-context-command.test.js`
2. `tests/unit/workflow-stage0-consumption.test.js`
3. 必要时新增针对 workspace fixture 的专项测试

**目标**

锁住“runtime 已升级，但 bootstrap 目录仍是旧 contract”这一类混合态问题。

**测试场景**

1. workspace 根目录旧 bootstrap 产物存在时，rerun 后生成完整新 contract
2. `spec-plan` / `spec-work` / `spec-review` 读取 Stage-0 时，不再消费旧 injection-only 语义
3. 不会因为残留旧 docs/context 文件而误判当前命中主体

## 6. 顺序与依赖

建议顺序：

1. Unit 0：rollback 基础
2. Unit 2：single-repo delete-and-regenerate
3. Unit 3：workspace child slug delete-and-regenerate
4. Unit 4：bootstrap drift 诊断
5. Unit 1：runtime destructive path 收紧
6. Unit 5：KAZ 类混合态回归

原因：

1. 没有 rollback 基础，就不能安全地把 bootstrap publish 改成先删后生。
2. 这次实际痛点首先来自 bootstrap 产物混合态，不先改 bootstrap publish 语义，诊断只能报错不能自愈。
3. workspace 是 single-repo 策略的扩展，依赖同一删除后重建模型。
4. diagnostics 要在主链行为稳定后再锁 contract，更容易保证 wording 和真实行为一致。

## 7. 风险与取舍

1. **误删风险**
   - 只允许删受管 `slug` 目录，不允许扩大到整棵 `docs/contexts/` 或 `.spec-first/workflows/bootstrap/`
2. **失败窗口**
   - 必须复用 backup / rollback，避免“删完后生成失败，目录瞬时为空”成为用户可见状态
3. **graph stale 仍是独立问题**
   - 本计划故意不碰 `.spec-first/graph/`；graph freshness 仍由现有 CRG / freshness contract 处理
4. **runtime destructive path 风险外溢**
   - 如果没有先引入 drift gate 或原子恢复，就不应把 current rerun 全量切到 hard reset
5. **init 不自动重跑 bootstrap**
   - 这是刻意保持边界清晰；否则会让 runtime 安装与 repo 分析重建耦合得过重

## 8. Verification

满足以下条件时，本计划视为完成：

1. rerun `init` 后，runtime managed assets 只保留当前 manifest 应有集合
2. rerun `spec-graph-bootstrap` 后，目标 `slug` 目录不再残留旧 contract 文件
3. workspace rerun 后，旧 child slug 的 stale control-plane/docs 被正确 prune
4. `doctor` 与 evaluator 能按 workspace-root / repo-child 两类 contract 明确识别 bootstrap outdated / partial contract
5. `spec-plan` / `spec-work` / `spec-review` 在旧产物混合态被修复后，只消费当前 Stage-0 contract
6. `.spec-first/graph/` 未被误删，CRG 高成本产物边界保持不变

## 9. Verification Surface

至少运行以下测试：

1. `tests/unit/init-dry-run.test.js`
2. `tests/unit/managed-state-contracts.test.js`
3. `tests/unit/using-spec-first-runtime-contracts.test.js`
4. `tests/unit/spec-graph-bootstrap-compiler.test.js`
5. `tests/unit/workspace-context.test.js`
6. `tests/unit/workspace-nested-topology.test.js`
7. `tests/unit/stage0-context-command.test.js`
8. `tests/unit/workflow-stage0-consumption.test.js`
9. `tests/unit/doctor-json-contract.test.js`

## 10. 结论

本计划采用的最终更新策略是：

1. rollback：先补齐真正支持 delete-and-regenerate 的恢复能力
2. runtime：legacy / drift 命中时走 protected destructive reset
3. bootstrap slug：delete + regenerate
4. diagnostics：按 manifest kind 显式识别 drift / partial / outdated

不再沿用 overlay update 作为主语义，也不采用全仓粗暴清空。目标是让受管产物既能干净升级，又不突破明确边界。
