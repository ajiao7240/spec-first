# Stage-0 Workspace 实际开发顺序清单

**日期：** 2026-04-17  
**状态：** Proposed  
**来源文档：**
- `docs/plans/2026-04-17-stage0-index-entry-upgrade-plan.md`
- `docs/plans/2026-04-17-auto-discover-child-git-bootstrap-plan.md`

---

## 1. 目的

本清单不是第三份平行方案，而是把以下两份文档按真实依赖关系压成一条可执行开发顺序：

- `2026-04-17-stage0-index-entry-upgrade-plan.md`
- `2026-04-17-auto-discover-child-git-bootstrap-plan.md`

核心原则：

> 不按“先做完整文档 A，再做完整文档 B”的文件顺序开发，而按“入口先立住、产物再生成、消费再收口”的依赖顺序推进。

---

## 2. 总顺序

### Step 1：先把 Stage-0 入口统一起来

目标：

- 先让系统具备“识别 single-repo / workspace”的能力
- 但此时不要求自动发现 child `.git`

优先改动：

- `src/context-routing/entry-resolver.js`（新增）
- `src/context-routing/loader.js`
- `src/context-routing/workspace-loader.js`
- `src/bootstrap-compiler/workspace-compiler.js`

完成标准：

- 支持 `single-repo`
- 支持显式 `repoRoots`
- 支持“已存在 `workspace-registry.json`”的 workspace 入口
- 单仓 `selected_assets` 顺序完全不变

此步对应来源：

- `stage0-index-entry-upgrade` 的 Phase 1

为什么必须先做：

- 如果入口还停留在 `git rev-parse --show-toplevel`，后面就算生成了 child pack，`plan / work / review` 也还是从 workspace 根目录进不去。

---

### Step 2：定义 workspace control-plane 真源

目标：

- 明确 workspace mode 到底读什么
- 防止后续实现时再造第二套 evaluator

要做的事：

- 定义 `workspace-registry.json` schema
- 定义 `workspace-routing.json` schema
- 定义 `workspaceRoot` ancestor lookup 规则：从 `target || cwd` 向上逐级探测
- 定义 registry/routing 的 `schema_version` 与不兼容降级策略
- 写死 child 匹配信号优先级：
  - `repoRoots`
  - `targetPath`
  - `cwd`
  - `changedFiles`
  - default overview only

优先改动：

- `src/context-routing/workspace-loader.js`
- `src/bootstrap-compiler/workspace-compiler.js`
- 必要时新增 schema/fixture

完成标准：

- workspace mode 可输出 `selected_contexts`
- 仍保留兼容投影的 `selected_assets`
- registry/routing 损坏或 schema 不兼容时，返回确定性的 workspace degrade，而不是静默掉回 directory fallback
- 明确 repo 级选择继续委托 child evaluator

此步对应来源：

- `stage0-index-entry-upgrade` 的 `workspace control-plane 真源`
- `auto-discover-child-git-bootstrap` 的 `workspace-registry.json / workspace-routing.json`

---

### Step 3：先落地路径模型升级

目标：

- 让单仓与 workspace 共享同一套 path resolver
- 明确 `sourceRepoRoot` 与 `artifactAnchorRoot` 分离

优先改动：

- `src/crg/artifact-paths.js`
- `src/bootstrap-compiler/run-bootstrap.js`

必须支持：

- `single-repo`：`artifactAnchorRoot = sourceRepoRoot`
- `workspace-*`：`artifactAnchorRoot = workspaceRoot`

完成标准：

- child pack 可以写到 workspace 根目录
- 单仓 pack 路径不变
- 后续 telemetry / registry / bootstrap 都不需要各自再猜一遍输出根

此步对应来源：

- `auto-discover-child-git-bootstrap` 的路径锚点模型

为什么必须放在 telemetry 前：

- telemetry 的落盘目录依赖 `artifactAnchorRoot`
- 如果路径模型没先定，telemetry 就会临时复制一套路径决策，后面还得返工

---

### Step 4：补 telemetry 与 workspace run 归属

目标：

- 让 workspace mode 有稳定可追溯的运行记录

优先改动：

- `src/context-routing/telemetry.js`

新增字段：

- `mode`
- `workspace_slug`
- `matched_child_slugs`
- `selected_context_count`

落盘规则：

- `single-repo`：继续写 `<repoRoot>/.spec-first/workflows/<workflow>/<slug>/`
- `workspace-*`：统一写 `<artifactAnchorRoot>/.spec-first/workflows/<workflow>/<workspaceSlug>/`

完成标准：

- 单仓 telemetry 路径不变
- workspace mode 有唯一归属目录
- 不做 child repo 级 telemetry 双写
- freshness 聚合保持与现有 repo evaluator 一致：若任一 selected context 为 `stale` 且没有更强错误，保留当前 level，并将 `fallback_reason` 置为 `freshness_stale`

此步对应来源：

- `stage0-index-entry-upgrade` 的 telemetry 升级
- `auto-discover-child-git-bootstrap` 的 workspace telemetry 归属

---

### Step 5：接入 workspace registry 生成能力

目标：

- 把 workspace mode 从“能消费已有 registry”升级成“能写出 registry”
- 但本步只处理“repo 列表已知”的情况，不负责自动发现 repo 列表

优先改动：

- `src/bootstrap-compiler/workspace-registry.js`（预计新增）
- `src/bootstrap-compiler/run-bootstrap.js`
- `src/bootstrap-compiler/workspace-compiler.js`

产物：

- `workspace-registry.json`
- `workspace-routing.json`
- workspace overview docs

完成标准：

- 在以下前提之一成立时，bootstrap 能生成 workspace 级 control-plane：
  - 显式传入 `repoRoots`
  - 或调用方已提供预发现的 child repo 列表
- runtime 能直接消费这些产物
- 不要求本步自己去扫描并发现 child `.git`

此步对应来源：

- `auto-discover-child-git-bootstrap` Phase A + Phase C

---

### Step 6：接入 child `.git` 自动发现

目标：

- 在顶层非 git 且 registry 不存在时，自动发现子工程

优先改动：

- 发现逻辑模块（可新增）
- `run-bootstrap.js`
- `workspace-registry.js`

关键规则：

- 只在顶层非 git 时触发
- 发现 child repo 后停止继续下钻
- 默认排除 `node_modules`、`docs`、`.spec-first` 等生成目录
- 单成员 workspace 不塌缩回单仓
- 首轮 rollout 置于 feature flag 后，例如 `SPEC_BOOTSTRAP_DISCOVER_CHILD_GIT=1`

完成标准：

- 能稳定发现 child `.git`
- 能生成稳定 `childSlug`
- 能生成 child packs + workspace pack

此步对应来源：

- `auto-discover-child-git-bootstrap` Phase A + Phase B

---

### Step 7：补批量发布与回滚

目标：

- 避免 workspace bootstrap 出现“半成功状态”

优先改动：

- `src/bootstrap-compiler/rollback.js`
- `src/bootstrap-compiler/run-bootstrap.js`

需要实现：

- staging 目录
- publish 前完整校验
- batch backup / batch restore
- `workspaceSlug + touchedChildSlugs` all-or-nothing

完成标准：

- 任一 child 失败时，不留下半成功正式产物

此步对应来源：

- `auto-discover-child-git-bootstrap` 的批量发布与回滚语义

为什么放在这里：

- 没有真实多 child 写入前，批量回滚无法做对

---

### Step 8：横切门禁，按 Wave 同步 skill 文案与镜像

目标：

- 保证 skill 文案与真实 runtime 行为一致

优先改动：

- `skills/spec-plan/SKILL.md`
- `skills/spec-work/SKILL.md`
- `skills/spec-review/SKILL.md`
- `docs/10-prompt/skills/` 对应镜像
- 相关 contract tests
- 如涉及治理边界，补相关 governance 文档与 lint/tests

同步口径原则：

- Wave 1：`repoRoots -> git root -> workspace registry -> fallback`
- Wave 2 及以后：`repoRoots -> git root -> workspace registry -> child discovery -> fallback`

完成标准：

- skill 文案不再写死“只认 git root”
- 镜像文档无 drift
- 任何改变 runtime-visible Stage-0 行为的 wave，都必须在同一 wave 内完成 source skill、mirror 和 tests 同步
- 任何源码改动都必须同步更新 `CHANGELOG.md`
- 若该 wave 构成显著 workflow 能力升级，同步更新 `docs/08-版本更新/README.md`

此步对应来源：

- 两份方案中关于 Stage-0 preload 的统一要求

为什么改成横切门禁：

- 文案应该跟随每个 wave 的真实实现同步更新
- 不能把 skill/mirror 同步拖到所有代码都改完之后，否则中间阶段一定发生 drift

---

## 3. 开发节奏建议

建议按三个提交波次推进：

### Wave 1：入口统一

- Step 1
- Step 2
- Step 3
- Step 4
- Step 8（仅同步本 wave 涉及的 skill/mirror/tests）

预期效果：

- 先打通“已存在 workspace registry 的消费主链”
- 但还不做自动发现与批量发布

### Wave 2：产物生成

- Step 5
- Step 6
- Step 8（仅同步本 wave 涉及的 skill/mirror/tests）

预期效果：

- 能从 workspace 根目录生成并消费 child packs

### Wave 3：工程硬化

- Step 7
- Step 8（做最终全量 drift sweep）

预期效果：

- 防止半成功状态
- skill / runtime / docs 口径统一

---

## 4. 最小可交付版本

如果要先做一个最小可交付版本，建议截止到：

- Step 1
- Step 2
- Step 3
- Step 4
- Step 8（仅同步 Wave 1 涉及的 skill/mirror/tests）

也就是：

> 先支持“已有 `workspace-registry.json` 时，`plan / work / review` 能从 workspace 根目录进入”，而不是一上来就把自动发现、批量回滚、所有 bootstrap 生成能力一起上。

这是风险最低、最容易验证的第一阶段。

---

## 5. 验证顺序

建议每个波次后都跑对应验证：

### Wave 1 后

- 单仓 Stage-0 路径不变
- 显式 `repoRoots` 路径不变
- 已存在 workspace registry 时能进入 workspace mode
- telemetry 能正确落到 workspace 目录

### Workspace degrade matrix（Wave 1 必须定稿）

为了避免 workspace mode 在实现时各写一套 fallback，本清单要求在 Wave 1 内把以下 degrade matrix 固化：

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

约束：

1. workspace mode 必须复用现有 `L0-L3` 语义，不再平行发明第二套严重度体系
2. `review`/`plan`/`work` 的差异只体现在 stage 资产选择，不体现在 degrade level 定义
3. 当多个 child 同时命中且其中一个 degraded 时，默认保留可用 child，不因单个 child 失败把整个 workspace run 直接打成 `L3`
4. `freshness` 是正交信号，不单独决定入口 mode；workspace mode 需要聚合 selected contexts 的 `freshness_status`
5. 若任一 selected context 为 `stale` 且没有更强 contract 失败，保留当前 level，并将 `fallback_reason` 置为 `freshness_stale`

### Wave 2 后

- 顶层非 git workspace 能生成 workspace pack + child packs
- child pack 落到 workspace 根目录，而不是 child repo 自己目录
- `selected_contexts` 与 `selected_assets` 同时存在且语义一致
- `SPEC_BOOTSTRAP_DISCOVER_CHILD_GIT=1` 打开时，真实 workspace 与 fixture 行为一致；默认开关策略明确

### Wave 3 后

- workspace bootstrap 任一 child 失败时，不留下半成功产物
- skill 与镜像文案和 runtime 行为一致

---

## 6. 结论

这两份文档真正的开发顺序不是：

1. 做完入口升级文档
2. 再做完 child bootstrap 文档

而应该是：

1. 先立入口
2. 再立 workspace contract
3. 再生成产物
4. 最后补批量发布与文档同步

一句话总结：

> 正确顺序是“入口先于产物，消费先于自动发现，contract 先于批量发布”，而不是按文档文件顺序串行开发。
