---
title: "Stage-0 索引入口升级方案"
type: archive
status: superseded
created: 2026-04-17
archived_at: 2026-06-14
archive_reason: "legacy plan-status backfill; retained as historical evidence only, not an active implementation plan"
---
# Stage-0 索引入口升级方案

> Lifecycle: historical plan archive. This document is retained as historical evidence only and is not an active implementation plan.

**日期：** 2026-04-17  
**状态：** Proposed  
**适用范围：** `plan / work / review` Stage-0 预载、`context-routing`、workspace bootstrap 接入  
**相关文档：**
- `docs/plans/2026-04-17-auto-discover-child-git-bootstrap-plan.md`
- `docs/plans/2026-04-15-008-cross-repo-multi-service-integration-implementation-plan.md`
- `skills/spec-plan/SKILL.md`
- `skills/spec-work/SKILL.md`
- `skills/spec-code-review/SKILL.md`

---

## 1. 问题定义

当前 `plan / work / review` 三个 workflow 的 Stage-0 入口都建立在同一个单仓假设上：

1. 先执行 `git rev-parse --show-toplevel`
2. 取 `slug = basename(git root)`
3. 读取 `docs/contexts/<slug>/`
4. 读取 `.spec-first/workflows/bootstrap/<slug>/context-routing.json` 与 `artifact-manifest.json`
5. 交给 evaluator 产出 `selected_assets / fallback_reason / level / skipped_rules`

这条链路在单仓场景下成立，但在以下场景下会直接失效：

- 当前目录本身不是 git repo
- 顶层目录是一个 workspace，下面挂多个子 git 工程
- workspace 已经存在或即将引入 `workspace-registry.json`
- 用户希望从 workspace 根目录直接触发 `plan / work / review`

现状的核心问题不是 evaluator，而是：

> Stage-0 缺少统一的“入口解析器”，导致 runtime 只能从单仓视角猜 slug，而不能先判断当前应该走 single-repo、workspace 还是 fallback。

---

## 2. 目标

本方案只解决一个核心问题：

> 为 `plan / work / review` 建立统一的 Stage-0 runtime locator，使系统能先判定运行模式，再解析索引根与上下文选择，而不是先假设当前一定是单仓 git root。

### 2.1 目标行为

升级后的入口应支持以下优先级：

1. 显式 `repoRoots` 优先
2. 当前目录可解析出 git root 时走单仓
3. git root 失败时，若存在 `workspace-registry.json`，走 workspace mode
4. 如有需要，再进入 child `.git` 自动发现
5. 都失败时走现有 fallback

### 2.2 成功标准

1. 单仓路径完全兼容，不改变当前 `selected_assets` 顺序
2. 显式 `repoRoots` 的 workspace v1 路径完全兼容
3. workspace mode 不再依赖 `git rev-parse --show-toplevel` 才能进入
4. `plan / work / review` 不再各自实现一套入口逻辑
5. workspace mode 能稳定表达“workspace overview + child repo context”双层选择结果

### 2.3 支持模式矩阵

本方案明确同时支持单仓与多仓，但二者通过同一入口解析器进入：

| 模式 | 触发条件 | 控制面真源 | 说明 |
|---|---|---|---|
| `single-repo` | 当前 `target/cwd` 可解析出 git root | `context-routing.json + artifact-manifest.json + minimal-context/<stage>.json` | 保持现有语义，不改 `selected_assets` |
| `workspace-explicit` | 显式传入 `repoRoots` | `workspace-registry.json + workspace-routing.json` + child repo control-plane | 兼容现有 workspace v1，并向结构化选择升级 |
| `workspace-registered` | 顶层非 git，但已存在 `workspace-registry.json` | `workspace-registry.json + workspace-routing.json` + child repo control-plane | 入口升级 Phase 1 即支持 |
| `workspace-discovered` | 顶层非 git，registry 不存在，但能发现 child `.git` | discovery 结果 + 生成后的 workspace control-plane | 依赖后续 bootstrap 侧自动发现能力 |

补充约束：

1. `target` 本身是 git repo 时，始终优先视为 `single-repo`
2. 顶层非 git 且 child repo 数量为 1 时，默认仍视为 `workspace-*`
3. 不把“单成员 workspace”自动塌缩回单仓，因为其 `artifactAnchorRoot` 与 `sourceRepoRoot` 语义不同

---

## 3. 非目标

本次不做以下内容：

- 不重写 evaluator 主逻辑
- 不推翻 `context-routing.json + artifact-manifest.json + minimal-context/<stage>.json` 现有 contract
- 不一次性完成 child `.git` 自动发现、workspace registry 生成、cross-repo impact 全套终局能力
- 不在本轮改造中引入 embedding、semantic retrieval、global repo discovery

本次改造只解决“索引入口怎么升级”，不是整个 cross-repo 系统的终局方案。

---

## 4. 当前现状

### 4.1 skill 侧现状

当前 `skills/spec-plan/SKILL.md`、`skills/spec-work/SKILL.md`、`skills/spec-code-review/SKILL.md` 的 Stage-0 preload 都显式写死：

- 通过 `git rev-parse --show-toplevel` 解析 slug
- 再按 `docs/contexts/<slug>/` 与 `.spec-first/workflows/bootstrap/<slug>/` 取上下文

这意味着 workspace 根目录只要不是 git repo，入口就直接失败。

### 4.2 runtime 侧现状

当前 runtime 模块分工如下：

- `src/context-routing/loader.js`
  - 负责按 `repoRoot + slug` 解析控制面与 docs 路径
- `src/context-routing/evaluator.js`
  - 负责根据 routing/manifest/minimal-context 输出 `selected_assets`
- `src/context-routing/workspace-loader.js`
  - 只支持显式 `repoRoots` 聚合
- `src/bootstrap-compiler/workspace-compiler.js`
  - 对多 repo 结果仅输出 `repo-a:minimal-context/plan.json` 这种扁平字符串

当前缺失的是：

- 一个统一的 Stage-0 入口解析器
- 对 workspace registry 的一级识别
- 对 workspace mode 的结构化上下文选择 contract

---

## 5. 方案选项对比

| 方案 | 描述 | 优点 | 问题 | 结论 |
|---|---|---|---|---|
| A | 只改 skill 文案，让每个 skill 自己多加几条判断 | 改动最少 | 逻辑分散，代码与文档容易漂移，测试很难统一 | 不推荐 |
| B | 让 `plan / work / review` 各自拥有独立入口 helper | 每个 workflow 可单独演进 | 重复实现，后续 drift 风险高 | 不推荐 |
| C | 新增统一 `Stage-0 runtime locator`，由 skill 与 runtime 共用 | 入口统一、测试集中、单仓兼容好、便于后续 workspace mode 扩展 | 需要补一层新 contract | 推荐 |

推荐采用方案 C。

---

## 6. 推荐方案

### 6.1 新增统一入口解析器

新增：

- `src/context-routing/entry-resolver.js`

职责：

1. 判断当前运行模式是 `single-repo`、`workspace` 还是 `fallback`
2. 解析当前应读取的索引根
3. 输出统一的入口解析结果，供 `loader / workspace-loader / skills` 复用

建议 API：

```js
resolveStage0Entry({
  cwd,
  target,
  repoRoots,
  stage
})
```

返回值建议：

```json
{
  "mode": "single-repo | workspace | fallback",
  "reason": "explicit-repo-roots | git-root | workspace-registry | child-git-discovery | fallback",
  "workspaceRoot": "/abs/path/to/workspace",
  "workspaceSlug": "my-workspace",
  "repoRoots": [
    "/abs/path/to/repo-a"
  ],
  "matchedChildSlugs": [
    "repo-a"
  ]
}
```

补充约束：

1. `workspace-registry.json` 的查找不能假设当前目录就是 `workspaceRoot`
2. `entry-resolver` 应从 `target || cwd` 开始，按祖先目录逐级向上探测
3. 对每个候选目录 `candidateDir`，检查：
   - `<candidateDir>/.spec-first/workflows/bootstrap/<basename(candidateDir)>/workspace-registry.json`
4. 首个命中的候选目录即视为 `workspaceRoot`
5. 若 registry 文件存在但 JSON 解析失败、缺少关键字段或 `schema_version` 不支持，必须锁定该候选目录并进入 workspace degrade 路径，禁止继续向上搜索或直接掉回单仓 fallback

### 6.2 固定入口优先级

入口优先级必须写死，禁止各模块各自猜测：

1. **显式 `repoRoots` 优先**
   - 若调用方已显式提供 `repoRoots`，直接进入现有 workspace 聚合路径
2. **单仓 git root**
   - 若当前目录可解析出 git root，则进入单仓路径
3. **workspace registry**
   - 若 git root 失败，则查找 `.spec-first/workflows/bootstrap/<workspaceSlug>/workspace-registry.json`
   - 找到即进入 workspace mode
4. **child `.git` 自动发现**
   - 仅在后续阶段引入，作为 registry 不存在时的补充能力
5. **fallback**
   - 所有入口都失败时，进入现有 Level 3 降级

### 6.3 路径模型升级

入口升级必须与路径模型一起升级，否则 workspace mode 仍会落回单仓假设。

本方案明确采用双根路径模型：

- `sourceRepoRoot`
  - 真实 child git repo 根目录
  - 用于 git/CRG 输入、head commit、repo shape、graph 事实采集
- `artifactAnchorRoot`
  - Stage-0 durable docs 与 bootstrap control plane 的输出根
  - workspace mode 下明确取 `workspaceRoot`

这意味着：

1. 输入事实依然按真实 repo 边界采集
2. 输出产物可以集中写入 workspace 根目录
3. runtime 入口不能再把 `repoRoot` 同时当作输入根和输出根

**Workspace control-plane 真源**

本方案在这里再补一个必须明确的边界：

1. repo mode 的真源仍然是现有 `context-routing.json + artifact-manifest.json + minimal-context/<stage>.json`
2. workspace mode 的真源不要求复刻一份 workspace 级 `context-routing.json`
3. workspace mode 由 `entry-resolver + workspace-loader + workspace-routing.json + workspace-registry.json` 共同产出 `selected_contexts`
4. child repo 的具体资产选择，仍委托给各 child repo 自己的 evaluator contract

换句话说：

- repo 级选择继续使用现有 evaluator
- workspace 级选择由新的 runtime locator 负责组装

这样可以避免为 workspace 再平行造一套 `context-routing.json` 解释器。

### 6.4 兼容现有 evaluator contract

当前被锁死的 runtime 真 contract 是：

- `context-routing.json`
- `artifact-manifest.json`
- `minimal-context/<stage>.json`
- `selected_assets / fallback_reason / level / skipped_rules`

这层 contract 已被 skill 文案与测试覆盖，因此本轮不应推翻。

正确做法是：

- 单仓 mode：继续输出当前 `selected_assets`
- workspace mode：新增 `selected_contexts`
- 同时保留一个兼容投影的 `selected_assets`

建议 workspace mode 输出：

```json
{
  "schema_version": "v2",
  "mode": "workspace",
  "workspace_slug": "my-workspace",
  "selected_contexts": [
    {
      "scope": "workspace",
      "slug": "my-workspace",
      "asset_path": "workspace/routing-overview.md",
      "reason": "workspace-overview-default",
      "priority": 10
    },
    {
      "scope": "repo",
      "slug": "repo-a",
      "repo_root": "/abs/path/to/repo-a",
      "asset_path": "minimal-context/plan.json",
      "reason": "path-match",
      "priority": 100
    }
  ],
  "selected_assets": [
    "workspace:workspace/routing-overview.md",
    "repo-a:minimal-context/plan.json"
  ],
  "fallback_reason": null
}
```

约束如下：

1. `selected_contexts` 是 workspace mode 的新真源
2. `selected_assets` 继续作为兼容字段保留
3. 单仓模式不升级 schema，不改变现有 `selected_assets` 顺序
4. telemetry 初期仍可继续记录 `selected_assets`

**child 选择信号优先级**

为避免 `matchedChildSlugs` 成为不可执行语义，workspace mode 的 child 选择信号必须写死为以下顺序：

1. 显式传入的 `repoRoots`
2. 显式 `target` 路径命中某个 child repo
3. 当前 `cwd` 位于某个 child repo 内
4. `changedFiles` 命中的 child repo 列表
5. 若以上都不存在，则只返回 workspace overview，不强行猜 child repo

补充说明：

1. `plan` 场景通常没有 `changedFiles`，因此更依赖 `repoRoots / target / cwd`
2. `review` 场景若存在 `changedFiles`，应优先以变更命中结果为准
3. 当信号来源互相冲突时，以优先级更高者覆盖，而不是并集扩张

### 6.5 扩展现有模块，而不是重写

应优先扩展以下现有模块：

- `src/context-routing/loader.js`
- `src/context-routing/workspace-loader.js`
- `src/bootstrap-compiler/workspace-compiler.js`
- `src/context-routing/telemetry.js`

不建议：

- 新开一套 `workspace-loader-v2`
- 新开一套 `workspace-evaluator`
- 在 skill 层复制 runtime 入口逻辑

原则是：

> 入口升级只新增一层 locator，不新增第二套 Stage-0 体系。

### 6.6 skill 层改造方式

skill 文案需要同步升级，但只承担“声明入口顺序”，不承担实现。

三个 skill 的 Stage-0 preload 应从当前的：

- `git rev-parse --show-toplevel`

升级为：

- `显式 repoRoots -> git root -> workspace registry -> fallback`

需要同步修改：

- `skills/spec-plan/SKILL.md`
- `skills/spec-work/SKILL.md`
- `skills/spec-code-review/SKILL.md`
- `docs/10-prompt/skills/` 下对应镜像文档

### 6.7 telemetry 升级

当前 telemetry 只记录：

- `workflow`
- `slug`
- `stage`
- `selected_assets`
- `fallback_reason`

workspace mode 需要新增以下字段：

- `mode`
- `workspace_slug`
- `matched_child_slugs`
- `selected_context_count`

但为了兼容旧消费方，`selected_assets` 仍保留。

同时需要明确落盘归属：

1. `single-repo` 模式继续落到 `<repoRoot>/.spec-first/workflows/<workflow>/<slug>/`
2. `workspace-*` 模式统一落到 `<artifactAnchorRoot>/.spec-first/workflows/<workflow>/<workspaceSlug>/`
3. Phase 1 不做双写，不在 child repo 目录下再复制一份 workflow telemetry
4. telemetry record 中新增 `mode / workspace_slug / matched_child_slugs`，但 `slug` 字段仍保留，workspace mode 下其值等于 `workspaceSlug`

这样可以保证：

- 单仓路径不变
- workspace 运行时的 telemetry 有唯一归属目录
- 后续回放与问题排查能以 workspace 级 run 为单位查看

### 6.8 workspace degrade matrix

workspace mode 不允许在实现时临场发明 fallback 语义。本方案要求沿用现有 `L0-L3` 严重度，并固化如下矩阵：

| 场景 | 建议 level | fallback_reason | 结果 |
|---|---|---|---|
| `single-repo` 正常 | `L0` | `null` | 继续沿用当前 evaluator 结果 |
| workspace registry 正常，child 选择正常 | `L0` | `null` | 返回 workspace overview + child contexts |
| workspace registry 存在，但 JSON 损坏或缺少关键字段 | `L2` | `workspace_registry_invalid` | 若 workspace overview 可用则只返回 overview，否则走现有 Level 3 降级 |
| workspace registry 存在，但 `schema_version` 不支持 | `L2` | `workspace_registry_schema_unsupported` | 若 workspace overview 可用则只返回 overview，否则走现有 Level 3 降级 |
| workspace registry 正常，但未命中 child | `L1` | `workspace_child_unresolved` | 只返回 workspace overview |
| workspace registry 正常，但部分 child control-plane 缺失 | `L1` | `workspace_child_partial_degraded` | 返回 workspace overview + 可用 child contexts |
| workspace registry 存在，但 `workspace-routing.json` 缺失或损坏 | `L2` | `workspace_routing_missing` | 只返回 workspace overview，禁止猜 child |
| workspace registry 存在，但 `workspace-routing.json` 的 `schema_version` 不支持 | `L2` | `workspace_routing_schema_unsupported` | 只返回 workspace overview，禁止猜 child |
| workspace 入口成立，但 child context 全部不可用 | `L2` | `workspace_children_unavailable` | 只返回 workspace overview |
| 单仓入口失败且 workspace 入口也失败 | `L3` | `context_dir_missing` 或等价现有 fallback | 回到现有 Level 3 降级 |

补充约束：

1. workspace mode 复用现有 `L0-L3` 语义，不再平行定义第二套等级体系
2. `review` / `plan` / `work` 的差异只体现在 stage 资产选择，不体现在 degrade level 定义
3. 多 child 命中且部分 child degraded 时，默认保留可用 child，不因单个 child 失败直接打成 `L3`
4. `freshness` 语义保持与现有 repo evaluator 一致：它是正交信号，不单独决定 mode 切换
5. workspace mode 需要聚合 `selected_contexts` 的 `freshness_status`；若任一 selected context 为 `stale` 且没有更强的 contract 失败，保留当前 level，并将 `fallback_reason` 置为 `freshness_stale`

---

## 7. 实施分期

### Phase 1：统一入口解析器

目标：

- 先把单仓与已存在 workspace registry 的入口统一起来

范围：

- 新增 `src/context-routing/entry-resolver.js`
- 改造 `loader.js`
- 改造 `workspace-loader.js`
- 改造 `workspace-compiler.js`
- 改造三个 skill 的 preload 文案
- 同步 source skill / mirror / contract tests

本阶段不做：

- child `.git` 自动发现
- workspace registry 自动生成
- workspace bootstrap 批量发布语义

完成标准：

- 单仓路径完全兼容
- 已有 `workspace-registry.json` 时可不依赖 git root 进入 workspace mode
- 支持 `single-repo / workspace-explicit / workspace-registered` 三种模式
- workspace degrade matrix 定稿
- source skill / mirror / tests 与实际 runtime 行为一致

### Phase 2：workspace registry 接入

目标：

- 让 bootstrap 产物能为 Stage-0 入口提供 registry 真源

范围：

- 定义 `workspace-registry.json`
- 定义 `workspace-routing.json`
- 让 runtime 识别并消费它们

完成标准：

- workspace mode 可稳定输出 `selected_contexts`
- `selected_assets` 兼容投影稳定

### Phase 3：child `.git` 自动发现

目标：

- 在 registry 不存在时，支持 workspace 根目录自动发现子工程

范围：

- 增加 child `.git` 发现
- 生成 child slug
- 写入 workspace registry

完成标准：

- 用户在非 git workspace 根目录下运行，也能进入正确 Stage-0 索引路径

---

## 8. 测试方案

### 8.1 单元测试

建议新增或扩展：

- `tests/unit/workspace-context.test.js`
- `tests/unit/context-routing-evaluator.test.js`
- `tests/unit/crg-artifact-paths.test.js`
- `tests/unit/entry-resolver.test.js`

至少覆盖以下场景：

1. 显式 `repoRoots` 优先于其他入口
2. git root 存在时保持单仓路径不变
3. git root 失败但存在 `workspace-registry.json` 时进入 workspace mode
4. 单仓模式下 `selected_assets` 顺序完全不变
5. workspace mode 同时返回 `selected_contexts` 与 `selected_assets`
6. `sourceRepoRoot` 与 `artifactAnchorRoot` 分离后的路径解析正确
7. 从非 git 的嵌套子目录启动时，ancestor lookup 能正确找到 `workspaceRoot`
8. `workspace-registry.json` 损坏或缺少关键字段时，返回 `L2 workspace_registry_invalid`，而不是静默掉回 fallback
9. `workspace-registry.json` 的 `schema_version` 不支持时，返回 `L2 workspace_registry_schema_unsupported`
10. `workspace-routing.json` 的 `schema_version` 不支持时，返回 `L2 workspace_routing_schema_unsupported`
11. workspace mode 的 freshness 聚合能在无更强错误时产出 `fallback_reason = freshness_stale`

### 8.2 集成测试

构造 fixture：

- 顶层目录不是 git repo
- 下挂多个子 repo
- workspace 根目录下存在 bootstrap registry

断言：

- `plan / work / review` 可从 workspace 根目录进入 Stage-0
- 返回值中包含 workspace overview 与 child repo context
- `fallback_reason`、`selected_assets`、`selected_contexts` 语义一致

### 8.3 回归测试

必须证明：

1. 当前单仓 `spec-graph-bootstrap-mainline` 不退化
2. skill Stage-0 文案与 runtime 行为保持一致
3. `workflow-stage0-consumption.test.js` 继续通过

---

## 9. 风险与控制

### 风险 1：入口逻辑分散在 skill 与 runtime 两侧，导致漂移

控制措施：

- runtime 以 `entry-resolver.js` 为唯一真源
- skill 只描述优先级，不复制实现逻辑
- 增加 contract 测试保护文案与代码一致性

### 风险 2：workspace mode 直接推翻 `selected_assets`，导致现有 workflow/telemetry 断裂

控制措施：

- workspace mode 先增量引入 `selected_contexts`
- `selected_assets` 保持兼容投影
- 单仓模式完全不变

### 风险 3：路径锚点未拆分，child pack 仍写入子仓自身目录

控制措施：

- 在 path resolver 层显式区分 `sourceRepoRoot` 与 `artifactAnchorRoot`
- 对路径解析增加单元测试

### 风险 4：child `.git` 自动发现过早接入，导致 Phase 1 范围膨胀

控制措施：

- Phase 1 明确不做自动发现
- 先支持“已有 workspace registry”的入口升级
- 自动发现延后到 Phase 3

---

## 10. 推荐落地顺序

建议按以下顺序推进：

1. 先做 `entry-resolver.js`
2. 再改 `loader / workspace-loader / workspace-compiler`
3. 再补 `selected_contexts` workspace contract
4. 再改三个 skill 与镜像文档
5. 最后接 child `.git` 自动发现

这个顺序的核心目的是：

- 先统一入口
- 再补 workspace 表达能力
- 最后再加自动发现

而不是一开始就把“自动发现、registry、skill、routing、telemetry”全部耦合在一次改造里。

---

## 11. 结论

索引入口不应该继续被理解为“怎么算 slug”，而应该升级成：

> 一个统一的 Stage-0 runtime locator，先判定 mode，再解析 root，再决定消费哪些索引 contract。

这样做有三个直接收益：

1. `plan / work / review` 不再被单仓 git root 假设卡死
2. workspace registry 能真正进入主路径，而不是生成后没人消费
3. 后续 child `.git` 自动发现、workspace overview、multi-child context 都有稳定入口可挂接

一句话总结：

> 这次升级的重点不是“增加更多索引文件”，而是把进入索引系统的第一跳从“单仓猜测”升级为“统一定位”，为后续 workspace 语义接入铺平主链。
