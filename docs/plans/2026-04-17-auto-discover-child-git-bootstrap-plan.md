# 自动发现子 `.git` 并为每个子工程生成独立 `docs/contexts/<child-slug>/` 的改造方案

**日期：** 2026-04-17  
**状态：** Proposed  
**适用范围：** `spec-graph-bootstrap` / Stage-0 / workspace bootstrap / context routing  
**相关背景：**
- `docs/项目介绍/crg/2026-04-15-007-cross-repo-multi-service-demand-integration-capabilities-plan.md`
- `docs/项目介绍/crg/2026-04-15-008-cross-repo-multi-service-integration-implementation-plan.md`
- `skills/spec-plan/SKILL.md`
- `skills/spec-work/SKILL.md`
- `skills/spec-review/SKILL.md`

---

## 1. 背景与问题定义

当前问题不是“没索引到”，而是把“多 git 工作区”错误地索引成了“单仓多模块项目”。

在以下真实目录中：

`/Users/kuang/ops/code/9627_KAZ展业项目-MVP版本-CRM需求_中台开发`

已确认该目录本身不是 git 仓库，但其下存在多个独立子工程：

- `hs-kaz-bss-service`
- `hs-kaz-crm-basic-service`
- `hs-kaz-crm-service`
- `hs-kaz-crm-open-api`
- `hs-kaz-crm-web`
- `hs-kaz-crm-admin`
- `hs-kaz-crm-money-service`
- `hs-kaz-crm-task`

而当前 Stage-0 只生成了一套基于顶层目录名的 context pack：

- `docs/contexts/9627_KAZ展业项目-MVP版本-CRM需求_中台开发/`
- `.spec-first/workflows/bootstrap/9627_KAZ展业项目-MVP版本-CRM需求_中台开发/`

从现有产物看，系统已经把这个目录当成“多模块 monorepo”处理，而不是“一个工作区下挂多个 git 工程”处理。直接后果是：

1. workspace 总览与 repo 级上下文被压扁进同一个 slug。
2. git 边界相关能力失真，例如 `repo_head_commit` 为空、变更识别不能正确落到子工程。
3. `plan / work / review` 这类需要 repo 边界的工作流只能消费错误粒度的 Stage-0 上下文。

问题本质是：

> 工作区级总览和子仓级上下文是两个不同消费层级，不能继续混成一个 `basename(target)` slug。

---

## 2. 目标

本次改造只解决一个核心目标：

> 当目标目录本身不是 git 仓库、但其下存在多个子 `.git` 时，系统自动发现这些子工程，并为每个子工程生成独立 `docs/contexts/<child-slug>/` 与 `.spec-first/workflows/bootstrap/<child-slug>/`，同时保留 workspace 级总览。

### 2.1 目标行为

系统应具备以下行为：

1. 自动发现 workspace 下的子 `.git`
2. 为每个子工程分配稳定 `childSlug`
3. 对每个子工程单独运行 repo 级 bootstrap/compiler
4. 保留 workspace 级 overview pack，但不再伪装成 repo context
5. 生成 machine-readable 的 `workspace registry`
6. 让 `plan / work / review` 能基于 registry 正确选择单个或多个 child context
7. 单仓路径完全兼容，不退化

### 2.2 单仓 / 多仓统一支持原则

本方案不是“只支持多仓”的分叉方案，而是要求同一套 Stage-0 体系同时支持：

| 模式 | 触发条件 | 是否本方案覆盖 |
|---|---|---|
| `single-repo` | `target` 本身是 git root | 是，且必须保持现有路径完全兼容 |
| `workspace-explicit` | 调用方显式给出 `repoRoots` | 是，作为现有 workspace v1 的升级承接 |
| `workspace-discovered` | 顶层非 git，通过 registry 或 child `.git` 自动发现进入 | 是，本方案重点覆盖 |

补充约束：

1. 单仓仍然是默认快路径，不因为引入 workspace 能力而退化
2. 顶层非 git 且只发现 1 个 child repo 时，默认仍按 workspace 处理，不自动塌缩为单仓
3. “单成员 workspace” 仍需保留 workspace overview、workspace registry 与集中式 artifact anchor 语义

---

## 3. 非目标

本次改造不做以下内容：

- 不做组织级 repo 自动发现
- 不做 cross-repo symbol graph
- 不做跨仓 semantic retrieval / embedding 召回
- 不做新的用户命令体系
- 不把多个 child repo 重新压平成一个超大匿名 context 包
- 不解决所有 cross-repo intelligence 终局问题

本次目标是“边界纠偏 + 最小主链补齐”，不是终局平台化改造。

---

## 4. 方案选项对比

| 方案 | 描述 | 优点 | 问题 | 结论 |
|---|---|---|---|---|
| A | 继续把顶层目录当 monorepo，只增强 module-map | 改动最小 | git 边界仍错误，`headCommit` 继续失真，review/detect-changes 仍错位 | 不推荐 |
| B | 保持现状，只要求用户显式传 `repoRoots` | 实现简单 | 用户负担大，bootstrap 仍无法正确处理“文件夹里多个 git 工程” | 不推荐 |
| C | 新增 workspace bootstrap 模式，自动发现子 `.git`，生成 workspace pack + child packs | 语义正确，兼容单仓，便于后续 cross-repo 能力演进 | 需要新增 registry 和 routing 逻辑 | 推荐 |

推荐采用方案 C。

---

## 5. 推荐方案总览

### 5.1 总体思路

引入新的 bootstrap 分支：

- 如果 `target` 本身是 git root：继续走现有单仓 bootstrap
- 如果 `target` 不是 git root，但发现一个或多个子 git root：进入 `workspace bootstrap mode`

`workspace bootstrap mode` 做两件事：

1. 生成 workspace 级 overview pack
2. 对每个 child repo 单独运行 repo 级 bootstrap/compiler，产出独立 child context

### 5.2 设计原则

1. `workspace` 与 `repo` 必须是两层实体，不能再共用一个 slug 语义。
2. human-readable docs 不是路由真源，machine-readable registry 才是。
3. child repo 编译尽量复用现有单仓 contract，减少破坏面。
4. workspace pack 只承载“总览、映射、路由”，不伪装成 repo context。
5. 单仓路径保持零破坏兼容。
6. 不新开第二套 workspace 主链，优先扩展现有 `src/context-routing/workspace-loader.js` 与 `src/bootstrap-compiler/workspace-compiler.js`。

---

## 6. 关键设计

### 6.1 身份模型

定义两类实体：

- `workspace`
- `child repo`

定义三类根路径：

- `workspaceRoot`：用户传入的目标目录，也是 workspace overview 与集中式 context 产物的归属目录
- `sourceRepoRoot`：真实 child git repo 根目录，用于 git 边界判断、head commit、CRG 输入采集
- `artifactAnchorRoot`：Stage-0 durable docs 与 bootstrap control plane 的输出根目录；本方案明确取 `workspaceRoot`

定义两类 slug：

- `workspaceSlug = basename(resolve(target))`
- `childSlug = slugify(relative(target, childRepoRoot))`

推荐 `childSlug` 使用“相对路径 slug”为主，而不是简单 basename。原因：

1. basename 可能冲突
2. 相对路径天然表达工作区中的位置
3. 对后续嵌套目录更稳定

示例：

```text
workspace root:
9627_KAZ展业项目-MVP版本-CRM需求_中台开发/

children:
hs-kaz-crm-service -> childSlug = hs-kaz-crm-service
hs-kaz-crm-admin   -> childSlug = hs-kaz-crm-admin
apps/admin         -> childSlug = apps-admin
```

若发生冲突，则在 slug 后追加短 hash：

```text
apps-admin-a1b2
```

### 6.2 路径锚点模型

本方案在这里做一个必须先锁死的架构决策：

> child repo 的 git/CRG 输入边界锚定 `sourceRepoRoot`，但 Stage-0 的 `docs/contexts/<child-slug>/` 与 `.spec-first/workflows/bootstrap/<child-slug>/` 统一锚定 `artifactAnchorRoot = workspaceRoot`。

这样做的原因是：

1. 用户当前预期就是在 workspace 根目录集中看到所有 child context
2. workspace 级 overview 与 child repo pack 需要天然共存于同一个 durable docs 根下
3. 保持 child repo 的 git/graph 事实仍然以真实 repo 边界采集，避免把“输出汇总”误做成“输入混仓”

这意味着要明确拆分两种路径语义：

- **输入/事实根**：`sourceRepoRoot`
- **输出/产物根**：`artifactAnchorRoot`

约束如下：

1. `.spec-first/graph/`、git head、repo shape、ignore 规则仍然以 `sourceRepoRoot` 为真源
2. `docs/contexts/<child-slug>/` 与 `.spec-first/workflows/bootstrap/<child-slug>/` 以 `artifactAnchorRoot` 为真源
3. workspace overview 本身也写入 `artifactAnchorRoot`
4. 不允许再默认把 `repoRoot` 同时当作“输入根 + 输出根”

因此，实施时必须显式改造当前路径模型，而不是继续复用“`resolveContextDocsDir(repoRoot, slug)` 永远落到 repoRoot 下”的假设。

补充说明：

1. `single-repo` 模式下，`artifactAnchorRoot = sourceRepoRoot`
2. `workspace-*` 模式下，`artifactAnchorRoot = workspaceRoot`
3. 同一套 path resolver 必须同时支持这两种模式，不能再依赖“repoRoot 永远既是输入根也是输出根”的隐式假设

### 6.3 子 `.git` 自动发现规则

建议采用以下规则：

1. 仅当 `target` 不是 git root 时启用 child discovery
2. 扫描 `target` 的子目录，识别 `.git` 目录或 `.git` 文件
3. 对候选目录执行 `git -C <candidate> rev-parse --show-toplevel` 做真实性校验
4. 仅接受 top-level 位于 `target` 之下的 repo
5. 一旦确认某目录是 child repo，默认不再向其内部递归
6. 默认排除以下目录：
   - `node_modules`
   - `.git`
   - `.spec-first`
   - `docs`
   - `dist`
   - `build`
   - `coverage`
7. 扫描深度默认限制为 `2~3` 层，可配置但不建议无限递归

推荐伪代码：

```js
function bootstrapTarget(target) {
  if (isGitRoot(target)) {
    return bootstrapSingleRepo(target);
  }

  const childRepos = discoverChildGitRepos(target);

  if (childRepos.length === 0) {
    return bootstrapDirectoryOnlyFallback(target);
  }

  const workspace = buildWorkspaceRegistry(target, childRepos);
  writeWorkspaceOverview(workspace);

  for (const repo of childRepos) {
    bootstrapSingleRepo(repo.repoRoot, {
      workspaceSlug: workspace.workspaceSlug,
      childSlug: repo.childSlug
    });
  }

  writeWorkspaceControlPlane(workspace);
}
```

### 6.4 运行时入口 contract

当前 `plan / work / review` 的 Stage-0 入口默认是：

1. `git rev-parse --show-toplevel`
2. `slug = basename(git root)`
3. 读取 `docs/contexts/<slug>/` 与 `.spec-first/workflows/bootstrap/<slug>/`

这个入口在“顶层目录不是 git repo”的 workspace 场景下会直接失败。因此，本方案要求把入口 contract 明确改为以下优先级：

1. **显式 `repoRoots` 优先**
   - 如果调用方已经显式提供 `repoRoots`，继续走现有 workspace v1 聚合入口
   - 这是对现有能力的保留，不回退
2. **单仓优先**
   - 若当前目录能通过 `git rev-parse --show-toplevel` 解析出 git root，则继续走现有单仓入口
3. **workspace 自动发现**
   - 若 git root 解析失败，则以当前 `target` 或当前工作目录作为 `workspaceRoot`
   - 若存在 `.spec-first/workflows/bootstrap/<workspaceSlug>/workspace-registry.json`，进入 workspace mode
4. **最终降级**
   - 若以上均失败，保持当前 Level 3 fallback

这要求明确扩展现有组件，而不是平行新增一套新链路：

- 扩展 `src/context-routing/workspace-loader.js`
- 扩展 `src/bootstrap-compiler/workspace-compiler.js`
- 扩展 `src/context-routing/loader.js`
- 扩展 `skills/spec-plan/SKILL.md`
- 扩展 `skills/spec-work/SKILL.md`
- 扩展 `skills/spec-review/SKILL.md`

具体约束：

1. 旧的显式 `repoRoots` contract 仍然有效
2. 自动发现只是在“未显式提供 `repoRoots` 且顶层非 git”时补充生效
3. skill 中的 Stage-0 preload 文案必须从“只有 `git rev-parse`”升级为“`git root -> workspace registry -> fallback`”三段式
4. `docs/10-prompt/skills/` 下的镜像文档必须同步更新，避免 source skill 与镜像 drift

### 6.5 输出目录结构

推荐产物结构如下：

```text
<workspace>/
  docs/
    contexts/
      <workspace-slug>/
        00-summary.md
        README.md
        architecture/
          module-map.md
        workspace/
          repo-registry.md
          routing-overview.md
      <child-slug-1>/
        00-summary.md
        README.md
        architecture/
        code-facts/
        context-packs/
        pitfalls/
      <child-slug-2>/
        ...
  .spec-first/
    workflows/
      bootstrap/
        <workspace-slug>/
          workspace-registry.json
          workspace-routing.json
          artifact-manifest.json
        <child-slug-1>/
          artifact-manifest.json
          context-routing.json
          minimal-context/
        <child-slug-2>/
          ...
```

这里有两个关键约束：

1. `docs/contexts/<workspace-slug>/` 保留，但重新定义为 workspace overview pack
2. 真正供 repo 级工作流消费的 pack 在各自 `docs/contexts/<child-slug>/`

结合第 6.2 节的路径决策，目录语义应理解为：

- `<workspace>/docs/contexts/<workspace-slug>/`：workspace overview
- `<workspace>/docs/contexts/<child-slug>/`：child repo 的 durable docs
- `<workspace>/.spec-first/workflows/bootstrap/<workspace-slug>/`：workspace registry / routing / overview control plane
- `<workspace>/.spec-first/workflows/bootstrap/<child-slug>/`：child repo 的 bootstrap control plane

而不是：

- `<childRepoRoot>/docs/contexts/<child-slug>/`

这个差异必须在实现前写进 path resolver contract，否则 Phase B 会落错目录。

### 6.6 control plane 与 durable docs 分层

必须明确：

- `docs/contexts/*` 是人类可读视图
- `.spec-first/workflows/bootstrap/*` 是 machine-readable control plane

推荐新增 `workspace-registry.json` 作为 workspace 真源：

```json
{
  "workspaceSlug": "9627_KAZ展业项目-MVP版本-CRM需求_中台开发",
  "workspaceRoot": "/path/to/workspace",
  "mode": "workspace",
  "children": [
    {
      "childSlug": "hs-kaz-crm-service",
      "repoRoot": "/path/to/workspace/hs-kaz-crm-service",
      "relativePath": "hs-kaz-crm-service",
      "headCommit": "abc123",
      "languageHints": ["java"],
      "status": "ready"
    }
  ]
}
```

推荐新增 `workspace-routing.json`：

```json
{
  "workspaceSlug": "9627_KAZ展业项目-MVP版本-CRM需求_中台开发",
  "defaultSelectionMode": "child-first",
  "childrenByPath": {
    "hs-kaz-crm-service": "hs-kaz-crm-service"
  },
  "fallback": {
    "whenNoChildMatched": "workspace-overview-only"
  }
}
```

`workspace-routing.json` 需要承担 workspace 级选择语义，而不只是“静态映射表”。建议至少包含：

- `defaultSelectionMode`
- `childrenByPath`
- `childMatchSignalPriority`
- `fallback.whenNoChildMatched`
- `workspaceOverviewAssets`

建议增加如下字段：

```json
{
  "childMatchSignalPriority": [
    "repoRoots",
    "targetPath",
    "cwd",
    "changedFiles",
    "default"
  ],
  "workspaceOverviewAssets": [
    "workspace/routing-overview.md",
    "00-summary.md"
  ]
}
```

核心价值在于：

> 把 `workspace registry` 变成 machine-readable 真源，避免继续靠顶层 basename slug 承载多仓语义。

### 6.7 multi-child 选择 contract

当前 `workspace-compiler` 的多 repo 表达方式是把结果扁平成：

```text
repo-a:minimal-context/plan.json
repo-b:architecture/module-map.md
```

这对人类阅读够用，但对 runtime 来说不够稳定，无法表达：

- workspace asset 与 repo asset 的 scope 差异
- 单 child 命中 / 多 child 命中 / 未命中 child 的不同 fallback
- token budget、排序、去重、telemetry 的统一结构

因此本方案要求为 workspace mode 增加结构化选择结果，同时保留旧字段投影：

```json
{
  "schema_version": "v2",
  "stage": "plan",
  "mode": "workspace",
  "workspace_slug": "9627_KAZ展业项目-MVP版本-CRM需求_中台开发",
  "selected_contexts": [
    {
      "scope": "workspace",
      "slug": "9627_KAZ展业项目-MVP版本-CRM需求_中台开发",
      "asset_path": "workspace/routing-overview.md",
      "reason": "workspace-overview-default",
      "priority": 10
    },
    {
      "scope": "repo",
      "slug": "hs-kaz-crm-service",
      "repo_root": "/path/to/workspace/hs-kaz-crm-service",
      "asset_path": "minimal-context/plan.json",
      "reason": "path-match",
      "priority": 100
    }
  ],
  "selected_assets": [
    "workspace:workspace/routing-overview.md",
    "hs-kaz-crm-service:minimal-context/plan.json"
  ]
}
```

约束如下：

1. `selected_contexts` 是新的 machine contract 真源
2. `selected_assets` 保留为向后兼容投影，减少对 telemetry、tests、skill 文案的冲击
3. 单仓模式继续保持当前 `selected_assets` 顺序与语义，不强行升级为 v2
4. 只有 workspace mode 才需要返回 `selected_contexts`

### 6.8 编译策略

推荐把现有单仓 bootstrap/compiler 复用为 child repo 编译器，而不是重写第二套 repo 级流程。

具体策略：

- child repo 编译继续沿用当前单仓 `artifact-manifest.json / context-routing.json / minimal-context/*` 契约
- workspace 级新增轻量 registry / routing / overview 编译
- workspace 编译不再强行产出 repo 语义的 `headCommit`
- child 编译恢复真实 git `headCommit`
- 优先扩展现有 `workspace-loader.js` / `workspace-compiler.js`，而不是平行再建一个 `workspace-bootstrap-loader-v2`

这里再明确一个边界：

1. repo 级选择继续使用 child repo 各自的 `context-routing.json`
2. workspace 级选择不要求生成 workspace 版 `context-routing.json`
3. workspace 级 control-plane 真源是 `workspace-registry.json + workspace-routing.json`
4. runtime 通过 `entry-resolver + workspace-loader` 先组装 `selected_contexts`，再把 repo 级选择委托给 child evaluator

这样可以避免为 workspace 再造一套与 repo evaluator 语义重叠的 routing contract。

这样可以把改动收敛在“发现 + 调度 + registry + routing”层，而不是重写整条 Stage-0 主链。

实施时涉及的关键文件应在计划中明确：

- `src/crg/artifact-paths.js`
- `src/bootstrap-compiler/run-bootstrap.js`
- `src/context-routing/loader.js`
- `src/context-routing/workspace-loader.js`
- `src/bootstrap-compiler/workspace-compiler.js`

### 6.9 workflow 消费端行为

`plan / work / review` 的消费逻辑建议调整为：

1. 优先判断当前目标是否存在 `workspace-registry.json`
2. 若不存在，继续按单仓 Stage-0 路径
3. 若存在：
   - 文件或变更命中单个 child repo：优先加载该 child slug 的 context
   - 命中多个 child repo：加载 workspace overview + 多 child 最小上下文
   - 未命中具体 child：仅加载 workspace overview，并提示需要进一步选择

这会把“workspace 总览”和“repo 级执行上下文”显式分离，而不是让一个 workspace slug 同时承担两种职责。

更具体地说，命中策略需要在计划中写死：

1. **单 child 命中**
   - 直接选择该 child repo 的 `minimal-context/<stage>.json`
   - 可附带 1 个 workspace overview 资产作为背景
2. **多 child 命中**
   - 先选 workspace overview
   - 再选多个 child repo 的 `minimal-context/<stage>.json`
   - 若超出预算，优先保留 repo 级 machine context，裁掉 narrative docs
3. **未命中 child**
   - 仅返回 workspace overview
   - `fallback_reason` 明确标记为 `workspace_child_unresolved` 或等价语义

同时，telemetry 也需要补充 workspace 维度：

- `mode`
- `workspace_slug`
- `matched_child_slugs`
- `selected_context_count`

并明确 workspace mode 的 workflow telemetry 归属：

1. 统一写入 `<artifactAnchorRoot>/.spec-first/workflows/<workflow>/<workspaceSlug>/`
2. 不在每个 child repo 的 artifact 目录下复制一份 workflow telemetry
3. `slug` 字段在 workspace mode 下取 `workspaceSlug`

### 6.10 批量发布与回滚语义

workspace bootstrap 与单仓 bootstrap 的关键区别，不只是“多写几个目录”，而是一次运行会触碰：

- 1 个 workspace slug
- N 个 child slug

因此必须补一个批量发布 contract：

1. **staging 先行**
   - 先将 workspace pack 与所有 child packs 写入 staging 目录
   - staging 目录建议位于 `<artifactAnchorRoot>/.spec-first/workflows/bootstrap/.staging/<run-id>/`
2. **完整性校验**
   - 校验所有 child repo 的 `artifact-manifest.json / context-routing.json / minimal-context/*`
   - 校验 workspace 的 `workspace-registry.json / workspace-routing.json`
3. **批量发布**
   - 只有全部校验通过后，才把 staging 结果发布到正式目录
4. **失败回滚**
   - 若在发布前失败，直接丢弃 staging，不污染正式目录
   - 若在发布过程中失败，恢复本次触碰到的全部 slug：`workspaceSlug + touchedChildSlugs`
5. **Phase 1 默认 all-or-nothing**
   - 不接受“前 4 个 child 成功，第 5 个失败，先保留部分产物”的半成功状态

这意味着当前单目录级别的 backup/restore 工具需要扩展为 batch-aware，而不是继续只支持一个 `contextDir/controlPlaneDir` 对。

---

## 7. 实施分期

### Phase A：发现与注册

目标：把“多 git 工作区”识别正确。

交付：

- child `.git` 自动发现
- `childSlug` 分配
- `workspace-registry.json`
- `workspace-routing.json`
- 路径锚点 contract：`sourceRepoRoot` 与 `artifactAnchorRoot` 分离

完成标准：

- 对非 git 顶层目录，能稳定列出所有 child repos
- 不再把该目录误识别为 monorepo repo identity
- 明确 child pack 输出锚定 `workspaceRoot`，而不是隐式跟随 `sourceRepoRoot`

### Phase B：child repo 独立编译

目标：为每个 child repo 产出独立 context pack。

交付：

- `docs/contexts/<child-slug>/...`
- `.spec-first/workflows/bootstrap/<child-slug>/...`
- child repo 输入仍来自真实 `sourceRepoRoot`

完成标准：

- 每个 child repo 都有真实 `headCommit`
- 每个 child repo 都能独立被 `plan / work / review` 消费
- graph / git 事实仍从 child repo 本身采集，没有被 workspace overview 混淆
- staging + publish 语义能保证“不出现半成功 workspace”

### Phase C：workspace overview 编译

目标：保留总览能力，但不污染 repo 级语义。

交付：

- workspace summary
- repo registry 文档视图
- routing overview

完成标准：

- workspace pack 只表达工作区层信息
- 不再伪装成一个真实 git 仓库 pack

### Phase D：workflow 接入

目标：让 `plan / work / review` 从“显式 `repoRoots` 才聚合”升级到“存在 registry 时可自动 child-first”。

交付：

- workspace registry aware routing
- multi-child minimal-context 装配
- child-first default selection
- `selected_contexts` 结构化 contract
- `selected_assets` 向后兼容投影

完成标准：

- 单 child 命中时自动路由到该 child context
- 多 child 命中时返回明确的 repo 边界上下文
- `git root -> workspace registry -> fallback` 入口顺序在 skill / loader / tests 中一致

---

## 8. 兼容性与迁移

### 8.1 向后兼容

以下路径必须保持不变：

- 目标本身是 git repo 的单仓 bootstrap
- 现有 `docs/contexts/<slug>/...` 单仓目录结构
- 现有 child repo 级 `artifact-manifest.json / context-routing.json` 契约
- 单仓模式下 `selected_assets` 顺序与 evaluator 语义
- 单仓模式下 workflow telemetry 目录不变化

### 8.2 渐进启用

建议两阶段开关：

1. Phase 1：通过 feature flag 启用，例如 `SPEC_BOOTSTRAP_DISCOVER_CHILD_GIT=1`
2. Phase 2：当 `target` 不是 git root 且发现 child repos 时默认启用

这样可以先在真实 workspace 上验证，不会直接冲击所有现有用户。

### 8.3 历史产物兼容

对已经生成过旧版 workspace pack 的目录：

- 允许重新 bootstrap 覆盖 workspace-level overview
- 新增 child slugs，不要求删除旧 workspace slug 目录
- 但 workflow 在发现 `workspace-registry.json` 后，应停止把 workspace slug 当单仓 repo context 使用
- 若历史代码依赖 `selected_assets`，workspace mode 先通过向后兼容投影维持运行，再逐步迁移到 `selected_contexts`

---

## 9. 验证方案

### 9.1 单元测试

至少覆盖以下场景：

- child `.git` 发现
- `.git` 目录与 `.git` 文件两种情况
- `childSlug` 冲突处理
- workspace registry schema 校验
- nested repo 去重
- 识别 child repo 后停止递归
- `sourceRepoRoot` 与 `artifactAnchorRoot` 分离后的路径解析
- workspace mode 的 `selected_contexts` 与 `selected_assets` 双输出
- 单成员 workspace 不塌缩为 single-repo
- batch publish 失败时，workspaceSlug 与全部 touchedChildSlugs 都能回滚

建议优先补以下测试文件：

- `tests/unit/crg-artifact-paths.test.js`
- `tests/unit/workspace-context.test.js`
- `tests/unit/context-routing-evaluator.test.js`

### 9.2 集成测试

构造 fixture：

- 顶层非 git
- 下挂 3 个 sibling repos
- 其中 1 个 repo 使用嵌套目录名
- 其中 1 个 repo 缺少部分 metadata

验收标准：

- 生成 1 个 workspace pack
- 生成 3 个 child packs
- child pack 有各自 `headCommit`
- workspace pack 不再伪造 repo commit 语义
- child pack 落在 workspace 根目录下，而不是各 child repo 自己的 `docs/contexts/`
- `git root` 失败时仍能通过 workspace registry 进入 Stage-0
- 发布过程中任一 child 失败时，不留下半成功产物

### 9.3 回归测试

必须证明：

- 单仓 bootstrap 完全不变
- 显式 `repoRoots` 的旧 workspace v1 路径不破坏
- 不会把生成目录、依赖目录误识别成 repo
- `skills/spec-plan/SKILL.md`、`skills/spec-work/SKILL.md`、`skills/spec-review/SKILL.md` 的 Stage-0 文案与真实 loader 行为一致
- `docs/10-prompt/skills/` 镜像不发生 drift

### 9.4 真实案例验收

目标目录：

`/Users/kuang/ops/code/9627_KAZ展业项目-MVP版本-CRM需求_中台开发`

期望结果：

- 生成 `docs/contexts/hs-kaz-bss-service/`
- 生成 `docs/contexts/hs-kaz-crm-basic-service/`
- 生成 `docs/contexts/hs-kaz-crm-service/`
- 生成 `docs/contexts/hs-kaz-crm-open-api/`
- 生成 `docs/contexts/hs-kaz-crm-web/`
- 生成 `docs/contexts/hs-kaz-crm-admin/`
- 生成 `docs/contexts/hs-kaz-crm-money-service/`
- 生成 `docs/contexts/hs-kaz-crm-task/`
- 保留 `docs/contexts/9627_KAZ展业项目-MVP版本-CRM需求_中台开发/` 作为 workspace overview

---

## 10. 风险与控制

### 风险 1：扫描过深导致性能差

控制措施：

- 默认深度限制
- 默认排除生成目录
- 确认 child repo 后停止下钻

### 风险 2：nested repo 或 submodule 重复统计

控制措施：

- 默认只保留最外层 child repo
- 将 `includeNestedRepos` 作为显式开关，而不是默认行为

### 风险 3：child slug 不稳定

控制措施：

- 以 `relativePath` 为主
- 冲突时才追加短 hash
- 一旦写入 registry，不在同一 workspace 内随意重算

### 风险 4：workflow 继续误把 workspace pack 当 repo pack

控制措施：

- 明确 `mode: workspace` 与 `mode: repo`
- 在 routing 层硬性禁止 workspace pack 参与 repo-only 逻辑

### 风险 5：批量发布时留下半成功状态

控制措施：

- 先写 staging，再统一 publish
- batch backup / batch restore 覆盖 `workspaceSlug + touchedChildSlugs`
- Phase 1 明确采用 all-or-nothing 发布策略

---

## 11. 预期效果

做完这次改造后，系统会从“错误的单 slug 聚合”提升到“正确的 workspace + child repo 双层语义”，直接效果有四个：

1. bootstrap 产物终于和真实 git 边界对齐，`repo_head_commit` 不再在 workspace 级失真。
2. `plan / work / review` 能优先拿到正确子工程上下文，而不是一个被压平的工作区摘要。
3. 后续 cross-repo impact、ownership routing、verification matrix 都有了正确底座。
4. 这是一条不过度设计的主链，只补“发现、注册、路由、独立编译”，没有提前把系统扩成全局多仓平台。

一句话总结：

> 这次改造的本质不是“多生成几个目录”，而是把当前错误的仓库边界模型纠正为“workspace 总览 + child repo 真上下文”双层模型，让后续所有 AI 工作流第一次站在正确边界上运行。
