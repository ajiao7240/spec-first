# spec-graph-bootstrap 当前执行主链

> 校准时间: 2026-04-20
> 当前代码依据:
> - `skills/spec-graph-bootstrap/SKILL.md`
> - `src/bootstrap-compiler/run-bootstrap.js`
> - `src/bootstrap-compiler/orchestrator.js`
> - `src/bootstrap-compiler/compile-machine-artifacts.js`
> - `src/bootstrap-compiler/compile-human-assets.js`
> - `src/bootstrap-compiler/compile-routing.js`
> - `src/bootstrap-compiler/workspace-registry.js`
> - `src/context-routing/evaluator.js`
> - `src/context-routing/loader.js`
> - `src/context-routing/telemetry.js`
> - `tests/e2e/spec-graph-bootstrap-mainline.sh`
> - `tests/unit/spec-graph-bootstrap-contracts.test.js`

---

## 校准说明

这份文档描述的是**当前仓库头状态下已经落地的 JS 编译器主链**，不是早期 prompt 契约里的理想化流程图。

几个重要口径先明确：

- 当前单仓主入口是 `runBootstrap()`，workspace 主入口是 `runWorkspaceBootstrap()`
- 当前编译主链是 `compileBootstrapArtifacts()`，内部固定顺序为：
  `machine-artifacts -> human-assets -> routing`
- 当前事实提取主来源是 `deriveBootstrapInputs()` 的**文件系统 / package.json / topology 推断**
- 当前消费侧降级逻辑发生在 `evaluateContextForRepo()`，等级为 `L0-L3`
- 旧文档里的 `Full / Enhanced / Basic`、MCP 就绪探测、CRG stats / build 交互、stale 对比 `fingerprints vs stats`，**不是当前 JS runtime 主链的真实执行路径**

---

## 入口与输出路径

宿主入口：

- Claude: `/spec:graph-bootstrap [target-repo-path]`
- Codex: `$spec-graph-bootstrap [target-repo-path]`

当前单仓 slug 规则：

- `detectSlug(repoRoot)` 直接返回 `path.basename(repoRoot)`
- 也就是说，**当前 JS runtime 没有在这里做额外 sanitize**

当前默认产物路径：

```text
<repoRoot>/.spec-first/workflows/bootstrap/<slug>/
<repoRoot>/docs/contexts/<slug>/
```

workspace 模式下，所有 child repo 的产物都锚定在 `workspaceRoot` 下，而不是各 child repo 自己目录里：

```text
<workspaceRoot>/.spec-first/workflows/bootstrap/<childSlug>/
<workspaceRoot>/docs/contexts/<childSlug>/
<workspaceRoot>/.spec-first/workflows/bootstrap/<workspaceSlug>/
<workspaceRoot>/docs/contexts/<workspaceSlug>/
```

---

## 总体执行流

```text
入口（/spec:graph-bootstrap 或 $spec-graph-bootstrap）
  ↓
runBootstrap(repoRoot)
  ↓
判断是否进入 workspace 分支
  ├─ 是：runWorkspaceBootstrap(...)
  │    ├─ buildWorkspaceRegistry / buildWorkspaceRouting
  │    ├─ batch backup
  │    ├─ 对每个 child repo 调用 runBootstrap(...)
  │    ├─ 写 workspace control-plane + overview docs
  │    ├─ 记录 bootstrap telemetry
  │    └─ prune 已移除 child 的旧产物
  │
  └─ 否：单仓主链
       ├─ createBootstrapBackup(...)
       ├─ compileBootstrapArtifacts(...)
       │    ├─ compileMachineArtifacts(...)
       │    ├─ compileHumanAssets(...)
       │    └─ compileRouting(...)
       ├─ 清空旧 control-plane / context docs
       ├─ 写 control-plane artifacts
       ├─ 写 docs/contexts + injection-index
       ├─ 记录 bootstrap telemetry
       └─ 删除 backup

任一 fatal error
  ↓
restoreBootstrapBackup / restoreBatchBackup
  ↓
抛错退出，不保留半覆盖状态
```

---

## 单仓主链

### 1. 入口判定

`runBootstrap()` 先做两件事：

1. 解析 `controlPlaneDir` 和 `contextDir`
2. 判断当前目标是否应该走 workspace 分支

workspace 分支触发条件是：

- `repoRoot` 自己不是 git root
- `artifactAnchorRoot === repoRoot`
- 显式传入 `repoRoots`，或者自动发现到了 child git repo

满足这三个条件时，当前调用不会继续走单仓链，而是直接转入 `runWorkspaceBootstrap()`。

### 2. 发布前备份

单仓主链在真正生成前会执行：

```text
createBootstrapBackup({ contextDir, controlPlaneDir, generatedAt })
```

这个 backup 保护的是两类内容：

- `.spec-first/workflows/bootstrap/<slug>/`
- `docs/contexts/<slug>/`

这和旧文档只强调 `docs/contexts/<slug>/` 备份不同。当前代码的回滚面更大，是**控制面 + 上下文文档一起回滚**。

### 3. 编译主链：`compileBootstrapArtifacts()`

当前编译器固定分成三个阶段：

```text
machine-artifacts
  ↓
human-assets
  ↓
routing
```

如果某一阶段抛错，返回值会带：

- `status: failed`
- `error.stage`: `machine-artifacts` / `human-assets` / `routing`

随后外层 `runBootstrap()` 会触发 restore。

### 4. Machine Artifacts 阶段

`compileMachineArtifacts()` 的真实职责是：

1. `deriveBootstrapInputs()` 先派生事实输入
2. 生成 `verification-profile.json`
3. 生成三份 `minimal-context/*.json`
4. 生成 `freshness.json`
5. 生成 `lint-report.json`
6. 生成 `contradictions.json`

其中，`deriveBootstrapInputs()` 当前主要靠静态仓库扫描：

- `package.json`
- 仓库文件列表
- repo topology
- 入口文件推断
- 模块路径推断
- integration 依赖推断
- test surface 推断
- database candidate 推断
- 基于文件行数的风险信号推断

也就是说，**当前 JS 主链不是先跑 `spec-first crg stats/build` 再决定是否继续**。

### 5. Human Assets 阶段

`compileHumanAssets()` 当前会生成这些文档：

```text
00-summary.md
README.md
architecture/module-map.md
code-facts/public-entrypoints.md
code-facts/test-map.md
code-facts/high-risk-modules.md
pitfalls/index.md
context-packs/review-change.md
```

这些文档来自 machine artifacts，不再是独立 worker 并行执行后的人工汇编产物。

### 6. Routing 阶段

`compileRouting()` 当前固定生成四个 routing / contract 产物：

```text
database-routing.json
context-routing.json
artifact-manifest.json
injection-index.yaml
```

这里有几个需要特别校准的点：

- `artifact-manifest.json` 当前由 `buildArtifactManifest()` 直接构造
- `data_quality` 当前规则是：
  - `modules.length > 0 && entrypoints.length > 0` -> `fact-backed`
  - 只有一边存在 -> `partial`
  - 两边都空 -> `empty`
- `artifact-manifest.inputs.crg.graph_last_built` 当前直接写 `generatedAt`
- `artifact-manifest.inputs.crg.node_count` 当前是 `modules + entrypoints + signals + testFiles` 的汇总计数
- `artifact-manifest.inputs.crg.edge_count` 当前固定为 `0`

所以，旧文档里那种“读取 graph.db -> 跑 `crg stats` -> stale 对比真实图状态”的说法，不适用于当前这条 JS 编译主链。

### 7. 发布阶段

编译成功后，`runBootstrap()` 的发布顺序是：

```text
fs.rmSync(controlPlaneDir)
fs.rmSync(contextDir)
writeControlPlaneArtifacts(...)
writeContextArtifacts(...)
recordWorkflowTelemetry(...)
removeBootstrapBackup(...)
```

也就是说：

- 先整体清空旧目录
- 再一次性写入新 control-plane
- 再写 human-facing context docs
- 最后记录 telemetry

如果中途失败，则走：

```text
restoreBootstrapBackup(...)
throw error
```

---

## Workspace 分支

### 1. 触发方式

`runBootstrap()` 会在目标目录不是单一 git repo、但能发现 child repo 时进入 workspace 模式。

发现 child repo 的方式有两种：

- 调用方显式传入 `repoRoots`
- `discoverChildGitRepos()` 自动扫描子目录

### 2. Workspace 预处理

`runWorkspaceBootstrap()` 先生成三份 workspace 级结构：

- `workspace-registry.json`
- `workspace-routing.json`
- `workspace-readiness-summary.json`

其中：

- `workspace-registry.json` 是 child repo 真源清单
- `workspace-routing.json` 定义 workspace overview 的选择策略
- `workspace-readiness-summary.json` 是 advisory-only 的 readiness snapshot

### 3. Child Repo 执行

对每个 child repo，workspace 主链会调用：

```text
runBootstrap({
  repoRoot: child.repoRoot,
  slug: child.childSlug,
  artifactAnchorRoot: workspaceRoot
})
```

这意味着 child repo 的 control-plane 和 docs 都会发布到 workspace 根目录下。

### 4. Workspace 根产物发布

在所有 child 成功后，workspace 根会重新写入：

控制面：

```text
workspace-registry.json
workspace-routing.json
artifact-manifest.json
workspace-readiness-summary.json
```

文档面：

```text
00-summary.md
README.md
workspace/routing-overview.md
workspace/repo-registry.md
```

### 5. Telemetry 与 prune

workspace 根发布成功后还会做两件事：

1. 记录 `workflow=bootstrap` 的 telemetry
2. prune 上一次 registry 中存在、但本次已不存在的 child 产物

返回值会暴露：

- `prunedChildSlugs`
- `failedPrunes`

`failedPrunes` 不会触发整个 workspace bootstrap 回滚；它是**附带返回的清理异常**，不是主流程 fatal error。

---

## 当前控制面产物

单仓主链当前会写入以下 control-plane artifacts：

```text
fact-inventory.json
risk-signals.json
test-surface.json
database-routing.json
context-routing.json
artifact-manifest.json
freshness.json
lint-report.json
contradictions.json
verification-profile.json
ownership.json
review-queue.json
minimal-context/review.json
minimal-context/plan.json
minimal-context/work.json
```

其中：

- `ownership.json`、`review-queue.json` 当前是 sample/governance 产物
- 三份 `minimal-context/*.json` 是当前主工作流消费链的重要 control-plane 输入
- `context-routing.json` 是**运行时选择资产的真源**
- `injection-index.yaml` 是 human-facing mirror，不等同于全部 runtime 选择逻辑

---

## 当前上下文文档产物

单仓 `docs/contexts/<slug>/` 当前默认会有：

```text
00-summary.md
README.md
architecture/module-map.md
code-facts/public-entrypoints.md
code-facts/test-map.md
code-facts/high-risk-modules.md
pitfalls/index.md
context-packs/review-change.md
injection-index.yaml
```

`README.md` 当前会明确写出：

```text
source_of_truth: control-plane artifacts under .spec-first/workflows/bootstrap/<slug>/
```

这也与测试 `tests/e2e/spec-graph-bootstrap-mainline.sh` 一致。

---

## 当前消费侧选择逻辑

真正决定主 workflow 注入哪些资产的，不是这份文档，也不只是 `injection-index.yaml`，而是：

```text
loadBootstrapRuntimeState(...)
  ↓
evaluateContext(...)
```

### 1. 运行时加载

`loadBootstrapRuntimeState()` 当前会读取：

- `fact-inventory.json`
- `context-routing.json`
- `artifact-manifest.json`
- `freshness.json`
- `verification-profile.json`

### 2. 选择顺序

`evaluateContext()` 当前会按下面顺序构造候选资产：

1. `routing.always`
2. `routing.stages[stage]`
3. 满足 `selection_rules` 的 `inject[]`
4. 若存在 `minimal-context/<stage>.json`，会**优先 prepend 到最前面**

然后再：

- 去重
- 过滤不存在的文件
- 按 token budget 裁剪

### 3. 当前 `context-routing.json` 的阶段选择

当前默认阶段资产是：

```text
always:
  - 00-summary.md
  - README.md
  - freshness.json

plan:
  - architecture/module-map.md

work:
  - code-facts/test-map.md
  - context-packs/review-change.md
  - lint-report.json

review:
  - minimal-context/review.json
  - code-facts/high-risk-modules.md
  - pitfalls/index.md
  - context-packs/review-change.md
  - code-facts/test-map.md
  - lint-report.json
  - contradictions.json
```

注意两点：

- `context-routing.json` 比 `injection-index.yaml` 多了 control-plane 资产，例如 `freshness.json`、`lint-report.json`、`contradictions.json`
- `minimal-context/review.json` 在 routing 内和 evaluator prepend 两层都被考虑，但最终会去重

### 4. 选择规则

当前只支持这三条 `output_exists.*` 规则：

```text
output_exists.code_facts_public_entrypoints
output_exists.code_facts_high_risk_modules
output_exists.context_packs_review_change
```

它们的判断依据来自 `artifact-manifest.outputs`，不是直接扫描 markdown。

---

## 当前降级逻辑：L0-L3

当前 runtime 降级的真实入口是 `evaluateContext()`，不是旧文档里的 `Full / Enhanced / Basic`。

### L3

这些情况会直接进入 `L3`：

- `contextDir` 或 `controlPlaneDir` 缺失
- `artifact-manifest.json` 缺失
- manifest `status !== complete`

典型 `fallback_reason`：

- `context_dir_missing`
- `manifest_incomplete`

### L2

这些情况会进入 `L2`：

- `context-routing.json` 缺失
- bootstrap contract 已漂移
- `data_quality = empty`
- `data_quality = sample-backed / skeletal`

典型 `fallback_reason`：

- `bootstrap_contract_outdated`
- `routing_missing`
- `empty_fact_inventory`

### L1

这些情况会进入 `L1`：

- `data_quality = partial / mixed`
- manifest 缺少质量字段
- `minimal-context/<stage>.json` 缺失但 data quality 还算够用
- freshness 为 `stale`

典型 `fallback_reason`：

- `data_quality_partial`
- `legacy_manifest_missing_quality_fields`
- `minimal_context_missing`
- `freshness_stale`

### L0

满足下面条件时进入 `L0`：

- manifest `status = complete`
- routing 存在
- data quality 充足（通常是 `fact-backed`）
- freshness 没有把结果打成 stale
- 当前 stage 的 minimal-context 可用

---

## 与旧版流程图相比，当前应删除的口径

以下说法不应再作为“当前代码事实”保留在流程图正文里：

- `Phase 0 MCP 就绪探测 -> Full / Enhanced / Basic 模式判定`
- `graph.db` 检查后提示用户是否执行 `spec-first crg build`
- `crg stats` 结果直接驱动当前主链的 compile 分支
- `artifact-manifest.inputs.crg.graph_last_built` 来自真实 CRG stats
- `stale 检测 = fingerprint vs stats.last_built`
- “Phase 1 由多轮 CRG worker 并行抽取，再进入 Phase 2/3/4 汇编”是当前 JS compiler 主链

这些内容可以保留为**历史设计意图**，但不能继续写成“当前仓库执行逻辑”。

---

## 一句话结论

当前 `spec-graph-bootstrap` 的真实执行形态，已经收敛为：

- **生成侧**：`runBootstrap -> compileBootstrapArtifacts -> 发布 control-plane + docs`
- **workspace 侧**：`runWorkspaceBootstrap -> child fan-out -> workspace 汇总 + prune`
- **消费侧**：`loadBootstrapRuntimeState -> evaluateContextForRepo -> L0-L3 选择与降级`

如果后续还要继续更新这份文档，应优先对齐上述三条代码真链，而不是继续追随旧版 prompt 里的阶段叙事。
