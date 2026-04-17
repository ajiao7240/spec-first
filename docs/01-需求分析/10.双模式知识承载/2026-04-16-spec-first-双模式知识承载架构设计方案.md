# spec-first 双模式知识承载架构设计方案

> 文档性质：架构设计方案
> 撰写日期：2026-04-16
> 前置文档：
> - [2026-04-16-spec-first-双模式知识承载需求分析与风险收益评估.md](./2026-04-16-spec-first-双模式知识承载需求分析与风险收益评估.md)
> - [2026-04-16-spec-graph-bootstrap-双模式知识承载-gap-分析.md](./2026-04-16-spec-graph-bootstrap-双模式知识承载-gap-分析.md)

---

## 1. 目标与结论

本方案要解决的问题是：

> 在保留 `项目内文档` 作为正式产品模式的前提下，为 `spec-first` 增加 `外挂知识仓库` 模式，并让 `spec-graph-bootstrap`、`spec-bootstrap`、`spec-compound` 以及后续 `plan / work / review` 可以统一消费同一套 durable knowledge backend。

架构结论如下：

1. `spec-first` 必须正式引入 **knowledge backend** 抽象
2. durable docs 与 control plane 必须分离治理
3. 外挂模式下，**repo 级长期文档迁到 external knowledge repo 作为主真源**
4. control plane 仍保留 repo-local
5. `init` 必须承担“绑定 + 自动注册 + 目录骨架初始化”的职责
6. 绑定关系必须 machine-readable，且平台无关

一句话总结：

> 正确架构不是“双仓模式”，而是“**双模式 durable knowledge backend + 单模式 repo-local control plane**”。

---

## 2. 关键设计原则

### 2.1 保留 `in_repo` 正式模式，但不要求旧实现兼容

不传 knowledge repo 地址时，系统仍支持 `in_repo` 这一正式产品模式：

- durable docs 仍在当前代码仓库
- control plane 仍在当前代码仓库

但由于当前仍在开发阶段，不以兼容当前旧 resolver、旧 state、旧 tests、旧 skill contract 为约束。允许直接重写这些旧实现。

### 2.2 external 模式单一真源

当项目切到 external 模式后：

- repo 级长期文档的正式真源只能是 external knowledge repo
- 当前代码仓库不能再作为这类文档的主写入源
- 不设计兼容双写或兼容回写路径；若需要保留说明性文件，应只保留最小绑定元数据

### 2.3 control plane 不外移

以下内容继续保留 repo-local：

- `.spec-first/workflows/bootstrap/<slug>/`
- graph / manifest / freshness / minimal-context / routing 等运行控制面产物
- rerun backup 与本地运行态状态

原因：

1. 它们是运行控制面，不是团队长期知识资产
2. 它们与 repo 当前文件状态、graph、SHA、local build 紧耦合
3. 外移后会显著增加同步、回滚与时效复杂度

### 2.4 durable docs 统一走 backend resolver

所有长期 human-readable 文档路径，不能再直接拼 `repoRoot/docs/...`，而必须先经过统一 resolver。

### 2.5 binding 必须平台无关

knowledge repo 与代码 repo 的绑定关系，不能放在 `.claude/` 或 `.codex/` 私有状态里。

原因：

- 这是项目级知识承载配置，不是某个宿主平台的运行时状态
- Claude / Codex / 其他宿主都应复用同一份绑定信息

### 2.6 协作冲突要通过目录设计来降低，而不是靠流程口头约束

必须通过目录边界和元数据拆分，降低共享 knowledge repo 下的 merge 冲突。

---

## 3. 架构总览

## 3.1 两类资产

### A. Control Plane Assets

位置：

```text
<repoRoot>/.spec-first/workflows/bootstrap/<slug>/
```

代表：

- `artifact-manifest.json`
- `context-routing.json`
- `freshness.json`
- `minimal-context/*.json`
- `risk-signals.json`
- `fact-inventory.json`

特点：

- repo-local
- machine-first
- 运行态衍生产物
- 不作为外挂知识库的主迁移对象

### B. Durable Knowledge Assets

位置：

- in-repo 模式：
  ```text
  <repoRoot>/docs/...
  ```
- external 模式：
  ```text
  <knowledgeRepoLocal>/<repoSlug>/docs/...
  ```

代表：

- `docs/contexts/<slug>/...`
- `docs/solutions/...`
- 后续可能包括 `docs/plans` / `docs/reviews` / `docs/work`

特点：

- human-readable
- 长期团队资产
- 可 code review / 合并 / 共享
- 由 knowledge backend 决定真实落点

## 3.2 总体结构 ASCII 图

```text
                    +--------------------------------------+
                    |         spec-first workflows         |
                    | bootstrap / graph-bootstrap / review |
                    +-------------------+------------------+
                                        |
                                        v
                         +--------------+---------------+
                         |   knowledge backend resolver |
                         |  mode = in_repo | external   |
                         +--------+----------------------+
                                  |
             +--------------------+--------------------+
             |                                         |
             v                                         v
   +---------+----------+                   +----------+-----------+
   | in-repo durable    |                   | external durable     |
   | docs root          |                   | docs root            |
   | <repoRoot>/docs/   |                   | <knowledgeRepo>/<repoSlug>/docs/ |
   +--------------------+                   +----------------------+

同时始终保留：

<repoRoot>/.spec-first/workflows/bootstrap/<slug>/   # control plane
```

---

## 4. 模式模型

## 4.1 模式定义

系统只支持两个正式模式：

### Mode A: `in_repo`

含义：

- durable docs 与代码同仓
- 无需 knowledge repo binding
- 作为默认模式

### Mode B: `external_knowledge`

含义：

- durable docs 写入 external knowledge repo
- 当前 repo 自动注册到某个 knowledge group
- 当前代码 repo 只保留绑定元数据与必要指针

## 4.2 切换规则

### `spec-first init` 未传 knowledge repo 地址

结果：

- 项目保持 `in_repo`
- 不写知识绑定文件
- 走新的 `in_repo` 主链实现

### `spec-first init` 传入 knowledge repo 地址

结果：

- 项目进入 `external_knowledge`
- 自动完成 knowledge repo 接入与当前 repo 注册
- 后续 durable docs 通过 external backend 写入

---

## 5. 状态与配置 Contract

## 5.1 平台无关的项目级绑定文件

新增文件：

```text
<repoRoot>/.spec-first/project-knowledge.json
```

这是项目级、平台无关、可提交的绑定文件。

建议 schema：

```json
{
  "schema_version": "v1",
  "mode": "external_knowledge",
  "repo_slug": "order-service",
  "knowledge_repo": {
    "remote": "git@github.com:org/knowledge-order-group.git",
    "branch": "main",
    "registered_at": "2026-04-16T00:00:00Z"
  },
  "durable_docs": {
    "project_root": "order-service",
    "docs_root": "order-service/docs"
  }
}
```

说明：

- `repo_slug` 是当前代码 repo 在 knowledge repo 中的顶层目录名
- `project_root` 与 `docs_root` 用于 resolver 直接拼接 durable docs 路径
- 不保存本地 clone 路径，因为那是用户环境信息

### 为什么不用当前 `state.json`

当前 [state.js](/Users/kuang/xiaobu/spec-first/src/cli/state.js) 的职责是：

- 记录 managed runtime assets
- 与 Claude/Codex 运行时安装紧耦合

而知识绑定是：

- 项目级真配置
- 宿主无关
- 应被团队共享

所以不能把它作为主绑定真源放进当前 platform state。

## 5.2 用户级本地 knowledge repo 映射

新增用户级配置：

```text
~/.spec-first/config.json
```

新增 section：

```json
{
  "knowledgeRepos": {
    "git@github.com:org/knowledge-order-group.git": {
      "local_path": "/Users/kuang/.spec-first/repos/knowledge-order-group",
      "last_synced_at": "2026-04-16T00:00:00Z"
    }
  }
}
```

职责：

- 保存 remote -> local clone path 映射
- 保存本地 clone 缓存路径
- 不作为团队共享配置

## 5.3 project state 与 runtime state 的关系

```text
project-knowledge.json        -> 项目级 durable binding 真源
.claude/.../state.json        -> Claude runtime 管理状态
.codex/.../state.json         -> Codex runtime 管理状态
~/.spec-first/config.json     -> 用户本地 knowledge clone 映射
```

---

## 6. 外挂知识库目录结构

## 6.1 顶层目录

外挂知识库建议结构：

```text
knowledge-repo/
├── README.md
├── _meta/
│   ├── knowledge-group.json
│   └── repos/
│       ├── order-service.json
│       ├── payment-service.json
│       └── user-service.json
├── _group/
│   └── docs/
│       ├── service-boundaries/
│       ├── cross-repo-flows/
│       ├── shared-terms/
│       └── verification/
├── order-service/
│   ├── README.md
│   └── docs/
│       ├── contexts/
│       ├── solutions/
│       ├── plans/        # Phase 2+ 可接入
│       ├── reviews/      # Phase 2+ 可接入
│       └── work/         # Phase 2+ 可接入
├── payment-service/
│   └── docs/...
└── user-service/
    └── docs/...
```

## 6.2 为什么采用 `<knowledgeRepo>/<repoSlug>/docs/...` 结构

这是本方案的关键设计。

优点：

1. 保持与当前 repo 内相同的相对路径模型
2. 现有 `docs/contexts`、`docs/solutions` 语义可复用
3. 只需要切换“project docs root”，而不是重写所有相对路径规则
4. 用户也更容易理解：每个工程在知识库里有一个“镜像项目根”

这比直接设计成：

```text
<knowledgeRepo>/contexts/<repoSlug>/...
```

更稳，因为它能最大程度复用当前 `docs/*` 家族约定。

## 6.3 `_meta/repos/<repoSlug>.json` 设计

每个 repo 单独一个注册文件，而不是一个中央 `repos.json`。

示例：

```json
{
  "schema_version": "v1",
  "repo_slug": "order-service",
  "code_repo_remote": "git@github.com:org/order-service.git",
  "registered_at": "2026-04-16T00:00:00Z",
  "registered_by": "kuang",
  "status": "active"
}
```

原因：

1. 降低共享索引 merge 冲突
2. repo 级注册变更天然局部化
3. 更适合 `init` 自动注册

---

## 7. `init` 行为设计

## 7.1 新增参数

建议参数：

```bash
spec-first init --claude --knowledge-repo <git-url-or-local-path>
```

可选补充：

```bash
--knowledge-repo-branch <branch>
--repo-slug <slug>
```

默认规则：

- `repoSlug` 默认取当前 git remote repo 名；无 remote 时取当前目录名

## 7.2 `init` 外挂模式执行步骤

### Step 1：解析当前 repo 身份

获取：

- 当前 repo root
- 当前 repo slug
- 当前 code repo remote

### Step 2：解析 knowledge repo

如果传入的是：

- git remote URL：clone or pull 到本地缓存
- 本地路径：校验其为 git repo

### Step 3：注册当前 repo

在 knowledge repo 中确保以下内容存在：

```text
_meta/repos/<repoSlug>.json
<repoSlug>/README.md
<repoSlug>/docs/
```

### Step 4：写入项目绑定文件

在当前代码 repo 写入：

```text
.spec-first/project-knowledge.json
```

### Step 5：输出绑定结果

明确告知用户：

```text
Knowledge Mode: external_knowledge
Knowledge Repo: <remote>
Repo Slug: <repoSlug>
Durable Docs Root: <knowledgeRepoLocal>/<repoSlug>/docs/
```

## 7.3 不应该在 `init` 阶段做的事

以下动作不应在第一阶段自动做：

1. 自动迁移全部历史文档
2. 自动生成 workspace/group 级共享知识
3. 自动扫描其他 repo 并替它们注册
4. 自动 push 大量知识骨架内容

原因：

- 会拉长首次成功路径
- 失败恢复复杂
- 容易引入误注册与脏写入

---

## 8. Path Resolver 设计

## 8.1 新增统一 resolver 模块

建议新增：

```text
src/knowledge-backend/resolver.js
```

职责：

1. 读取当前项目 knowledge mode
2. 解析当前 durable docs project root
3. 返回具体的 docs family 路径

## 8.2 关键 API

### `resolveKnowledgeBinding(repoRoot)`

返回：

```js
{
  mode: 'in_repo' | 'external_knowledge',
  repoSlug,
  projectKnowledgeFile,
  knowledgeRepoRemote,
  knowledgeRepoLocal,
  durableProjectRoot
}
```

### `resolveDurableDocsProjectRoot(repoRoot)`

返回：

- in-repo:
  ```text
  <repoRoot>
  ```
- external:
  ```text
  <knowledgeRepoLocal>/<repoSlug>
  ```

### `resolveDurableDocsDir(repoRoot, ...segments)`

统一用于：

- `docs/contexts`
- `docs/solutions`
- `docs/plans`
- `docs/reviews`
- `docs/work`

## 8.3 与现有 `artifact-paths.js` 的关系

现有：

- `resolveWorkflowArtifactDir()` 保留不变
- `resolveContextDocsDir()` 不应再作为 durable docs 的最终入口

正确做法：

1. `artifact-paths.js` 继续负责 repo-local control plane
2. durable docs 改走 `knowledge-backend/resolver.js`

这样可以最小化破坏现有 graph/control plane 语义。

---

## 9. `spec-graph-bootstrap` 改造设计

## 9.1 当前设计问题

当前 [run-bootstrap.js](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/run-bootstrap.js) 直接用：

- `resolveWorkflowArtifactDir(repoRoot, 'bootstrap', slug)`
- `resolveContextDocsDir(repoRoot, slug)`

这意味着 control plane 与 durable docs 在代码层被绑定在一起。

## 9.2 正确改造后的写入模型

### control plane

保持：

```text
<repoRoot>/.spec-first/workflows/bootstrap/<slug>/
```

### durable docs

改为：

```text
<durableProjectRoot>/docs/contexts/<slug>/
```

其中：

- in-repo: `durableProjectRoot = repoRoot`
- external: `durableProjectRoot = <knowledgeRepoLocal>/<repoSlug>`

## 9.3 backup / rollback 设计

### in-repo 模式

保持当前语义。

### external 模式

backup 目标改为：

```text
<knowledgeRepoLocal>/<repoSlug>/docs/contexts/<slug>/
```

要求：

1. 仍然在写入前创建 backup
2. 写入失败时恢复 external durable docs
3. control plane 失败恢复仍走 repo-local 逻辑

### 注意

backup 语义必须拆成两层：

1. control plane rollback
2. durable docs rollback

不能再假设两者在同一个 repo root 下。

## 9.4 `context-routing/loader` 改造

当前 [loader.js](/Users/kuang/xiaobu/spec-first/src/context-routing/loader.js) 同时依赖：

- control plane dir
- context docs dir

改造后应变成：

- control plane dir：仍从 repoRoot 推导
- context docs dir：从 durable docs resolver 推导

否则 `plan / work / review` 在 external 模式下会读不到正确 docs。

---

## 10. 其他 workflow 的接入策略

## 10.1 Phase 1 必须接入

1. `spec-graph-bootstrap`
2. `spec-bootstrap`
3. `spec-compound`
4. `context-routing/loader`
5. `context-routing/evaluator`

原因：

- 这是 durable knowledge 生产与消费主链

## 10.2 Phase 2 再接入

1. `spec-plan`
2. `spec-work`
3. `spec-review`

原因：

- 这些输出中包含大量短生命周期文档
- 是否全部外移，需要再评估“全部文档外移”与“长期文档先外移”的平衡

本方案建议：

### Phase 1

先确保 repo 级长期知识外移成立：

- `docs/contexts`
- `docs/solutions`

### Phase 2

再决定是否统一外移：

- `docs/plans`
- `docs/reviews`
- `docs/work`

这样可避免一上来把 transient docs 与 durable knowledge 混成一类。

---

## 11. 协作与合并策略

## 11.1 目录边界

每个 repo 只允许默认写自己的目录：

```text
<knowledgeRepo>/<repoSlug>/...
```

这条边界必须被工具和 skill 契约明确化。

## 11.2 group 级目录写入权限

以下目录不应由普通 repo-local bootstrap 自动写：

```text
_group/docs/...
_meta/knowledge-group.json
```

只允许：

1. 显式 group-level workflow
2. 显式管理命令
3. 人工维护

## 11.3 注册文件冲突控制

采用：

```text
_meta/repos/<repoSlug>.json
```

而不是单一 `repos.json`，以降低 merge 冲突。

## 11.4 CODEOWNERS 建议

推荐在 knowledge repo 中采用：

```text
/order-service/** @team-order
/payment-service/** @team-payment
/_group/** @arch-team
/_meta/** @arch-team
```

这样可把 repo-level durable knowledge 与 group-level shared knowledge 的评审责任分开。

## 11.5 README / index 更新策略

不建议每次 `init` 或 `bootstrap` 都自动重写 knowledge repo 顶层 README。

原因：

1. 容易制造无意义冲突
2. 会让每个 repo 的日常变更污染顶层索引

正确策略是：

- repo 注册只写本 repo 的注册文件与本 repo 目录骨架
- 顶层 README 由显式管理任务维护

---

## 12. 模式切换与后续治理

当前阶段不把“兼容旧安装、兼容旧路径、平滑迁移旧文档”作为核心目标。

因此本阶段只要求：

1. 新架构下的 `in_repo` 与 `external_knowledge` 两种正式模式成立
2. 模式切换后的真源边界清晰
3. repo 重命名、迁移、解绑等生命周期治理在后续单独设计

也就是说，当前开发实现可以直接重写旧路径 contract、旧 state 结构、旧测试假设，而不为历史兼容背负额外复杂度。

---

## 13. 实施分期

## Phase 1：打通架构主链

目标：

- external mode 可被初始化
- 当前 repo 可自动注册
- `spec-graph-bootstrap` 与 `spec-bootstrap` 可正确写 external durable docs
- `context-routing` 可正确读 external durable docs

模块：

1. `src/cli/commands/init.js`
2. 新增 `src/knowledge-backend/*`
3. `src/bootstrap-compiler/run-bootstrap.js`
4. `src/context-routing/loader.js`
5. `src/context-routing/evaluator.js`
6. `tests/unit/*` 与 `tests/e2e/*`

## Phase 2：扩展 durable docs 家族

目标：

- `spec-compound` 走 external durable knowledge
- 评估 `plans/reviews/work` 是否全部纳入

## Phase 3：group-level knowledge

目标：

- 在同一个 knowledge repo 中承载 cross-repo / workspace / group-level 文档
- 与 cross-repo 主链方案结合

---

## 14. 与当前 gap 的逐项对应

| Gap | 本方案对应解法 |
|---|---|
| repo-local `docs/contexts` 硬编码 | 新增 durable docs resolver，切走 `resolveContextDocsDir` |
| `init` 无 knowledge repo 接入 | 新增 `--knowledge-repo` 参数与自动注册流程 |
| 当前 tests 把 repo-local 当唯一真源 | 将 contract 升级为双模式，增加 external fixture |
| backup 只保护 repo-local docs | 拆分 control plane rollback 与 durable docs rollback |
| 编译器无 backend abstraction | 新增 `knowledge-backend/resolver.js` |
| skill 契约仍是单模式 | 改写 `spec-graph-bootstrap` / `spec-bootstrap` skill 契约 |

---

## 15. 最终结论

这份方案的关键判断是：

1. external knowledge repo 模式值得做
2. 但必须以 knowledge backend 架构来落地
3. `spec-graph-bootstrap` 当前实现不能直接平滑支持该模式
4. 正确切入点不是“改一个路径”，而是：
   - 新增 binding contract
   - 新增 durable docs resolver
   - 保持 control plane repo-local
   - 改造 writer / reader 主链

最终推荐架构：

```text
repo-local:
  .spec-first/workflows/bootstrap/<slug>/      # control plane

knowledge backend:
  in_repo            -> <repoRoot>/docs/...
  external_knowledge -> <knowledgeRepoLocal>/<repoSlug>/docs/...
```

这是当前最稳、不过度设计、又真正支持团队协作与 polyrepo 微服务场景的实现方向。
