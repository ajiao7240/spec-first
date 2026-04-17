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
- 明确 repo 级选择继续委托 child evaluator

此步对应来源：

- `stage0-index-entry-upgrade` 的 `workspace control-plane 真源`
- `auto-discover-child-git-bootstrap` 的 `workspace-registry.json / workspace-routing.json`

---

### Step 3：补 telemetry 与 workspace run 归属

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

此步对应来源：

- `stage0-index-entry-upgrade` 的 telemetry 升级
- `auto-discover-child-git-bootstrap` 的 workspace telemetry 归属

---

### Step 4：再改 bootstrap 输出路径模型

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

此步对应来源：

- `auto-discover-child-git-bootstrap` 的路径锚点模型

为什么不能更早做：

- 入口和 workspace contract 没先定好，路径怎么拆都会反复返工。

---

### Step 5：接入 workspace registry 生成能力

目标：

- 把 workspace mode 从“能消费已有 registry”升级成“能生成 registry”

优先改动：

- `src/bootstrap-compiler/workspace-registry.js`（预计新增）
- `src/bootstrap-compiler/run-bootstrap.js`
- `src/bootstrap-compiler/workspace-compiler.js`

产物：

- `workspace-registry.json`
- `workspace-routing.json`
- workspace overview docs

完成标准：

- 对顶层非 git workspace，bootstrap 能生成 workspace 级 control-plane
- runtime 能直接消费这些产物

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

### Step 8：最后同步 skill 文案与镜像

目标：

- 保证 skill 文案与真实 runtime 行为一致

优先改动：

- `skills/spec-plan/SKILL.md`
- `skills/spec-work/SKILL.md`
- `skills/spec-review/SKILL.md`
- `docs/10-prompt/skills/` 对应镜像

统一改为：

- `repoRoots -> git root -> workspace registry -> child discovery -> fallback`

完成标准：

- skill 文案不再写死“只认 git root”
- 镜像文档无 drift

此步对应来源：

- 两份方案中关于 Stage-0 preload 的统一要求

为什么放最后：

- 文案应该跟随真实实现，而不是先写新口径再等代码慢慢追。

---

## 3. 开发节奏建议

建议按三个提交波次推进：

### Wave 1：入口统一

- Step 1
- Step 2
- Step 3

预期效果：

- 先打通“已存在 workspace registry 的消费主链”
- 但还不做自动发现与批量发布

### Wave 2：产物生成

- Step 4
- Step 5
- Step 6

预期效果：

- 能从 workspace 根目录生成并消费 child packs

### Wave 3：工程硬化

- Step 7
- Step 8

预期效果：

- 防止半成功状态
- skill / runtime / docs 口径统一

---

## 4. 最小可交付版本

如果要先做一个最小可交付版本，建议截止到：

- Step 1
- Step 2
- Step 3

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

### Wave 2 后

- 顶层非 git workspace 能生成 workspace pack + child packs
- child pack 落到 workspace 根目录，而不是 child repo 自己目录
- `selected_contexts` 与 `selected_assets` 同时存在且语义一致

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
