# spec-graph-bootstrap 双模式知识承载 Gap 分析

> 文档性质：现状审查 / Gap 分析
> 撰写日期：2026-04-16
> 审查对象：
> - `skills/spec-graph-bootstrap/SKILL.md`
> - `src/bootstrap-compiler/`
> - `src/crg/artifact-paths.js`
> - `src/cli/commands/init.js`
> - `tests/unit/spec-graph-bootstrap-contracts.test.js`
> - `tests/unit/crg-artifact-paths.test.js`
> 审查标准：
> - [2026-04-16-spec-first-双模式知识承载需求分析与风险收益评估.md](./2026-04-16-spec-first-双模式知识承载需求分析与风险收益评估.md)

---

## 1. 审查目标

本次审查不是判断 `spec-graph-bootstrap` 当前实现“是否可用”，而是判断：

> 以当前代码实现为准，`spec-graph-bootstrap` 是否已经满足“项目内文档 + 外挂知识仓库”双模式知识承载目标。

这里的目标口径包括：

1. 默认支持 `项目内文档` 模式
2. 可选支持 `外挂知识仓库` 模式
3. `init` 传入知识库 git 地址后，自动将当前 repo 注册进知识库项目
4. 外挂模式下 repo 级长期文档也迁移到外挂知识库作为主真源
5. 后续 `spec-graph-bootstrap` 产物能够稳定写入并被 `bootstrap / plan / work / review` 消费

---

## 2. 总结结论

审查结论非常明确：

> 当前 `spec-graph-bootstrap` 实现**满足 repo 内长期文档模式**，但**不满足双模式知识承载目标**，且差距是架构级差距，不是参数级补丁。

换句话说：

- 对旧模型：成立
- 对新模型：不成立

同时需要明确一个实施前提：

> 当前仍处于开发阶段，因此现有 repo-local tests、旧 path contract、旧 skill 文本、旧 state 结构都属于可直接重写的历史实现包袱，不构成必须向下兼容的约束。

这意味着后续正确动作不是“在旧单模式 contract 外面再包一层兼容逻辑”，而是：

1. 直接定义双模式正式 contract
2. 直接重写旧单模式 tests
3. 直接替换旧 repo-local 唯一真源模型
4. 以新架构为准重写 skill 与 resolver 语义

当前实现的真实模型是：

```text
控制面产物:
  <repoRoot>/.spec-first/workflows/bootstrap/<slug>/

长期文档产物:
  <repoRoot>/docs/contexts/<slug>/
```

这里不存在：

- knowledge backend abstraction
- external knowledge repo binding
- `init` 层知识库接入与自动注册
- external durable docs resolver
- external mode 下的 backup / rollback 语义

---

## 3. 当前实现已满足的部分

### 3.1 已稳定支持 repo 内长期文档模式

当前实现明确把 repo 内文档作为 durable docs 真源：

- `spec-graph-bootstrap` skill 文档中，产物路径明确写为：
  - `.spec-first/workflows/bootstrap/<slug>/`
  - `docs/contexts/<slug>/`
- 编译主链中，`runBootstrap()` 会同时写控制面与 `docs/contexts/<slug>/`
- 单测与样本均把 `docs/contexts/<slug>` 视为正式 contract

这意味着当前系统对“项目内文档模式”的支持是完整且一致的。

### 3.2 已稳定支持 repo 级控制面与文档面分层

当前实现已经具备正确的两层输出意识：

1. control plane
2. human-readable docs plane

这为后续扩展到 external knowledge backend 提供了基础，但仅仅是基础。

### 3.3 已稳定支持 rerun backup 与失败恢复

当前 `docs/contexts/<slug>` 已具备：

- rerun 前备份
- 写入失败时恢复
- 成功后清理 backup

这说明系统已经理解“长期文档是真资产，需要保护”，只是保护范围仍局限于 repo-local 文档目录。

---

## 4. 当前实现不满足双模式目标的高置信 Gap

## 4.1 Gap-A：长期文档落点被硬编码为 repo 内 `docs/contexts/<slug>`

### 代码证据

- [artifact-paths.js](/Users/kuang/xiaobu/spec-first/src/crg/artifact-paths.js#L83)
- [artifact-paths.js](/Users/kuang/xiaobu/spec-first/src/crg/artifact-paths.js#L92)
- [run-bootstrap.js](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/run-bootstrap.js#L96)
- [run-bootstrap.js](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/run-bootstrap.js#L123)
- [SKILL.md](/Users/kuang/xiaobu/spec-first/skills/spec-graph-bootstrap/SKILL.md#L55)

### 事实

`resolveContextDocsDir(repoRoot, slug)` 直接返回：

```text
<repoRoot>/docs/contexts/<slug>/
```

`runBootstrap()` 中的 `contextDir` 完全依赖这一 resolver，随后所有 human docs 都写入该目录。

skill 文本也同步将此路径作为固定 contract。

### 影响

外挂知识库模式要求：

- repo 级长期文档写入 external knowledge repo
- 当前代码 repo 不再作为这类长期文档的正式主真源

当前实现完全没有这种切换能力。

### 判断

这是 **P0 架构级差距**。

原因：

- 不是入口问题
- 不是配置没接上
- 而是底层 path resolver 模型本身没有 backend 抽象

---

## 4.2 Gap-B：`init` 当前不支持 knowledge repo 参数、状态记录或自动注册

### 代码证据

- [init.js](/Users/kuang/xiaobu/spec-first/src/cli/commands/init.js#L28)
- [init.js](/Users/kuang/xiaobu/spec-first/src/cli/commands/init.js#L176)
- [init.js](/Users/kuang/xiaobu/spec-first/src/cli/commands/init.js#L180)

### 事实

当前 `init` 只支持：

- `--claude`
- `--codex`
- `--force`
- `--user`
- `--lang`

不存在任何：

- `--docs-repo`
- `--knowledge-repo`
- `--knowledge-git`
- `docsRepo`
- `docsProjectSlug`
- `knowledgeMode`

之类的能力。

同时，`runInit()` 也没有：

1. clone / pull 外部 knowledge repo
2. 当前 repo 自动注册到 knowledge repo
3. knowledge mode 状态落盘
4. knowledge repo 与当前 repo 绑定关系落盘

### 影响

你要求的：

> `init` 传入知识库 git 地址后，自动把当前 repo 注册进知识库项目

当前完全没有入口级支撑。

### 判断

这是 **P0 产品入口级差距**。

没有这一层，后续所有 external mode 行为都无从谈起。

---

## 4.3 Gap-C：测试与 contract 将 repo-local `docs/contexts` 视为唯一真源

### 代码证据

- [spec-graph-bootstrap-contracts.test.js](/Users/kuang/xiaobu/spec-first/tests/unit/spec-graph-bootstrap-contracts.test.js#L21)
- [spec-graph-bootstrap-contracts.test.js](/Users/kuang/xiaobu/spec-first/tests/unit/spec-graph-bootstrap-contracts.test.js#L73)
- [crg-artifact-paths.test.js](/Users/kuang/xiaobu/spec-first/tests/unit/crg-artifact-paths.test.js#L29)
- [crg-artifact-paths.test.js](/Users/kuang/xiaobu/spec-first/tests/unit/crg-artifact-paths.test.js#L35)

### 事实

现有测试固定引用：

- `docs/contexts/spec-first/injection-index.yaml`
- `.spec-first/workflows/bootstrap/spec-first/...`

并且明确断言：

```text
resolveContextDocsDir('/repo', 'my-app') === '/repo/docs/contexts/my-app'
```

### 影响

这说明当前 contract 不是：

- 默认 in-repo + 可切换 external

而是：

- **唯一合法长期文档路径就是 repo 内 `docs/contexts/<slug>`**

### 判断

这是 **P0 contract 级差距**。

即使后面临时在某处加 external path，也会首先与现有测试与 contract 体系冲突。

---

## 4.4 Gap-D：backup / rollback 语义只保护 repo-local 文档目录

### 代码证据

- [SKILL.md](/Users/kuang/xiaobu/spec-first/skills/spec-graph-bootstrap/SKILL.md#L173)
- [run-bootstrap.js](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/run-bootstrap.js#L98)
- [run-bootstrap.js](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/run-bootstrap.js#L141)

### 事实

当前 backup / restore 明确围绕：

```text
docs/contexts/<slug>/
```

skill 文本也写明：

- backup 只保护 `docs/contexts/<slug>/`
- 失败时恢复 `docs/contexts/<slug>/`

### 影响

外挂模式下，如果长期文档真源迁到 external knowledge repo：

- 现有 backup contract 将失效
- 失败恢复机制不再覆盖真正的 durable docs 真源

### 判断

这是 **P1 运行可靠性差距**。

它说明外部知识库模式不是“改个路径”就能完成，而需要重做 backup / rollback contract。

---

## 4.5 Gap-E：编译器管线没有 knowledge backend 抽象

### 代码证据

- [compile-human-assets.js](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/compile-human-assets.js#L3)
- [orchestrator.js](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/orchestrator.js#L20)
- [run-bootstrap.js](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/run-bootstrap.js#L69)

### 事实

当前编译器只区分：

1. machine artifacts
2. human assets
3. routing

但没有：

- storage mode
- backend type
- docs writer abstraction
- source-of-truth plane abstraction

`writeContextArtifacts()` 也只是直接把文本写进某个目录。

### 影响

外挂知识库模式要求：

- 同一套 workflow 消费逻辑
- 不同底层知识承载后端

而当前编译管线还没有抽象能力承载这件事。

### 判断

这是 **P1 编译器架构差距**。

---

## 4.6 Gap-F：skill 契约文本本身仍然是单模式产物契约

### 代码证据

- [SKILL.md](/Users/kuang/xiaobu/spec-first/skills/spec-graph-bootstrap/SKILL.md#L47)
- [SKILL.md](/Users/kuang/xiaobu/spec-first/skills/spec-graph-bootstrap/SKILL.md#L143)
- [SKILL.md](/Users/kuang/xiaobu/spec-first/skills/spec-graph-bootstrap/SKILL.md#L175)
- [SKILL.md](/Users/kuang/xiaobu/spec-first/skills/spec-graph-bootstrap/SKILL.md#L453)

### 事实

skill 中明确写死了：

1. slug 生成方式
2. 产物路径
3. artifact-manifest 写入位置
4. backup 位置与恢复目标
5. 输出目录 `docs/contexts/<slug>/`

没有任何关于：

- `项目内文档` / `外挂知识库` 模式分流
- external knowledge repo 写入路径
- knowledge mode detection
- external mode 下的 fallback

### 影响

即使底层代码未来扩展，skill contract 也必须同步重写，否则行为契约与实际实现会漂移。

### 判断

这是 **P1 契约文档差距**。

---

## 5. 差距优先级排序

### P0：不解决就无法成立双模式

1. `artifact-paths` / `run-bootstrap` 的 docs 落点硬编码为 repo-local
2. `init` 没有 knowledge repo 参数与自动注册能力
3. contract / tests 把 `docs/contexts/<slug>` 视为唯一真源

### P1：即使入口打通也会失效或不可维护

1. backup / rollback 只覆盖 repo-local docs
2. 编译器没有 knowledge backend abstraction
3. skill 契约仍是单模式文本

### P2：后续推广和工程化时必须补齐

1. external mode 下的迁移策略
2. repo 解绑 / 重命名 / 归组迁移
3. 团队协作与 merge 边界

---

## 6. 当前实现与目标之间的本质差异

### 当前实现的真实架构

```text
repoRoot
├── .spec-first/workflows/bootstrap/<slug>/   # control plane
└── docs/contexts/<slug>/                     # durable docs
```

### 目标架构的最小要求

```text
knowledge mode = in-repo | external

if in-repo:
  durable docs -> <repoRoot>/docs/contexts/<slug>/

if external:
  durable docs -> <knowledgeRepoLocal>/<group-or-project>/<repo-slug>/...

control plane:
  仍需有 repo-local control plane，或定义新的 workspace/control 语义

binding:
  current repo -> knowledge repo -> docs root
```

### 差异本质

当前实现是：

- 单模式 repo-local durable docs

目标要求是：

- 双模式 durable knowledge backend

所以差异不是“路径没改”，而是：

> 当前系统还没有“知识后端”这一层正式抽象。

---

## 7. 最终结论

如果以你当前定义的需求为准，那么：

> `spec-graph-bootstrap` 当前产物体系**不满足**双模式知识承载目标。

更准确地说：

1. 它已经很好地满足了 `项目内文档模式`
2. 但还没有进入 `外挂知识库模式` 的实现阶段
3. 当前 gap 是架构级 gap，而不是零散补漏

因此，后续正确动作不是直接在现有代码上“加个 git 地址参数”，而是先补一份正式架构方案，回答这些问题：

1. knowledge mode 如何定义
2. external knowledge repo 的 binding contract 如何定义
3. `init` 如何接入并自动注册当前 repo
4. docs writer / reader resolver 如何抽象
5. external mode 下 backup / rollback 如何处理
6. 当前 tests / contracts 如何从单模式升级到双模式

一句话收口：

> `spec-graph-bootstrap` 当前实现是“repo 内 durable docs 模型”的成熟实现，不是“双模式知识承载模型”的部分实现。
