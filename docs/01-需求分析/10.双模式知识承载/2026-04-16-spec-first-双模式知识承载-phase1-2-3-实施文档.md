# spec-first 双模式知识承载 Phase 1 / 2 / 3 实施文档

> 文档性质：分阶段实施文档
> 撰写日期：2026-04-16
> 适用范围：`init`、`spec-graph-bootstrap`、`spec-graph-bootstrap`、`spec-compound`、`spec-plan`、`spec-work`、`spec-review`、`context-routing`
> 前置文档：
> - [2026-04-16-spec-first-双模式知识承载需求分析与风险收益评估.md](./2026-04-16-spec-first-双模式知识承载需求分析与风险收益评估.md)
> - [2026-04-16-spec-graph-bootstrap-双模式知识承载-gap-分析.md](./2026-04-16-spec-graph-bootstrap-双模式知识承载-gap-分析.md)
> - [2026-04-16-spec-first-双模式知识承载架构设计方案.md](./2026-04-16-spec-first-双模式知识承载架构设计方案.md)

---

## 1. 文档目标

本文档不是重复讨论“要不要做双模式知识承载”，而是明确回答：

> 在不考虑历史实现向下兼容的前提下，`spec-first` 应如何按 Phase 1 / 2 / 3 分阶段落地“项目内文档 + 外挂知识仓库”双模式知识承载，并保证实现顺序正确、边界清晰、可验证、不过度设计。

本文档强调五件事：

1. 每个阶段的目标与成功定义
2. 每个阶段具体改哪些模块
3. 每个阶段明确不做什么
4. 每个阶段的验证与验收标准
5. 三个阶段之间的严格依赖顺序

---

## 2. 全局实施原则

## 2.1 产品保留双模式，实现不兼容旧单模式实现

本次实施保留两个正式产品模式：

1. `in_repo`
2. `external_knowledge`

但当前仍在开发阶段，因此不把以下内容当成必须兼容的约束：

1. 旧的 repo-local path resolver
2. 旧的 platform state 结构
3. 旧的 tests 假设
4. 旧的 skill 文本 contract
5. 旧的单模式 `docs/contexts/<slug>` 唯一真源模型

也就是说：

> 可以直接把旧单模式 contract 重写为双模式正式 contract，而不是先做一层迁移兼容壳。

## 2.2 先打通主链，再扩展文档家族

正确顺序必须是：

```text
binding
  -> resolver
  -> writer
  -> reader
  -> tests
  -> doctor / consistency
  -> group-level knowledge
```

不能反过来先做 group-level、先做全量 docs 家族、或先做大而全的治理功能。

## 2.3 control plane 与 durable docs 分离治理

始终保留：

```text
<repoRoot>/.spec-first/workflows/bootstrap/<slug>/
```

作为 repo-local control plane。

durable docs 则由 knowledge backend resolver 决定：

- `in_repo` -> `<repoRoot>/docs/...`
- `external_knowledge` -> `<knowledgeRepoLocal>/<repoSlug>/docs/...`

## 2.4 只做真正能落地的阶段设计

本实施方案不把以下内容提前纳入主线：

1. 历史文档自动迁移工具
2. 顶层 README 自动重写
3. repo 解绑 / 重命名 / 分组迁移全生命周期
4. 跨 knowledge repo 联邦搜索
5. 后台同步守护进程
6. 组织级统一知识平台

这些内容要么不是当前主链所需，要么会显著放大复杂度。

---

## 3. 三阶段总体策略

## 3.1 Phase 1：让双模式主链成立

回答的问题：

> 当用户在 `init` 阶段传入 knowledge repo 地址后，系统是否已经可以把当前 repo 接入 external mode，并让 repo 级长期知识稳定写入、稳定读取、稳定回滚？

如果 Phase 1 不成立，后面所有阶段都没有意义。

## 3.2 Phase 2：让双模式成为统一工作流能力

回答的问题：

> 在 repo 级 external durable docs 已成立的基础上，是否已经把更多 workflow 的 durable docs 接入统一后端，并具备一致性校验与 doctor 自检能力？

## 3.3 Phase 3：让双模式升级为 polyrepo / workspace 能力

回答的问题：

> 当多个 repo 归组到同一个 knowledge repo 后，系统是否已经能够承载 group / workspace / cross-repo 级 durable knowledge，并与 cross-repo 主链协同？

---

## 4. Phase 1：双模式主链打通

## 4.1 Phase 1 的目标

Phase 1 的目标不是“做一个 demo”，而是建立双模式的正式实现主链。

Phase 1 完成后，必须具备以下能力：

1. `init` 能识别 `in_repo` / `external_knowledge`
2. 传入 knowledge repo 后，系统能自动完成 knowledge repo 接入与当前 repo 注册
3. `spec-graph-bootstrap` / `spec-graph-bootstrap` 能把 durable docs 写到正确后端
4. `spec-compound` 能把 `docs/solutions` 写到正确后端
5. `context-routing` 能从正确后端读取 durable docs
6. control plane 继续 repo-local 且不受 external mode 影响
7. rerun backup / rollback 在 external mode 下仍成立

## 4.2 Phase 1 的范围

Phase 1 只覆盖以下正式能力：

1. knowledge mode 定义与绑定 contract
2. `init --knowledge-repo` 入口
3. knowledge repo 自动注册当前 repo
4. durable docs path resolver
5. `docs/contexts`
6. `docs/solutions`
7. writer / reader / backup / tests 主链

## 4.3 Phase 1 明确不做

1. 不自动发现 workspace 中其他 repo
2. 不自动生成 `_group/docs/*`
3. 不接入 `docs/plans` / `docs/reviews` / `docs/work`
4. 不做复杂权限平台
5. 不做自动迁移历史文档
6. 不做 repo 内 README 指针文件必填治理
7. 不做 repo 解绑 / 重命名 / 归组迁移

## 4.4 Phase 1 架构边界

### A. control plane

保留 repo-local：

```text
<repoRoot>/.spec-first/workflows/bootstrap/<slug>/
```

包含：

1. `artifact-manifest.json`
2. `context-routing.json`
3. `freshness.json`
4. `minimal-context/*.json`
5. `fact-inventory.json`
6. `risk-signals.json`
7. `test-surface.json`

### B. durable docs

由 backend resolver 决定：

```text
if mode = in_repo
  -> <repoRoot>/docs/...

if mode = external_knowledge
  -> <knowledgeRepoLocal>/<repoSlug>/docs/...
```

Phase 1 纳入的 durable docs family 只有：

1. `docs/contexts`
2. `docs/solutions`

## 4.5 Phase 1 模块改造清单

### A. CLI 与配置层

需要改造：

1. `src/cli/commands/init.js`
2. `src/cli/state.js`
3. 新增 `src/knowledge-backend/project-binding.js`
4. 新增 `src/knowledge-backend/user-config.js`
5. 新增 `src/knowledge-backend/register.js`

目标：

1. `init` 支持 `--knowledge-repo`
2. 项目级 binding 可读写
3. 用户级 local clone 映射可读写
4. external mode 注册流程可重复执行且幂等

说明：

- `state.js` 可以重构或缩减职责，但 project knowledge binding 不能继续依附在 platform runtime state 中。

### B. Knowledge Backend Resolver

需要新增：

1. `src/knowledge-backend/resolver.js`

目标：

1. 解析项目 mode
2. 解析 durable docs project root
3. 为不同 docs family 返回正式路径
4. 为 external mode 返回 knowledge repo 本地根

### C. Bootstrap Compiler 与 Writer

需要改造：

1. `src/crg/artifact-paths.js`
2. `src/bootstrap-compiler/run-bootstrap.js`
3. `src/bootstrap-compiler/compile-human-assets.js`
4. 相关 writer helper

目标：

1. control plane resolver 与 durable docs resolver 正式拆开
2. human asset 写入不再默认拼 `repoRoot/docs/...`
3. external mode 的 backup / rollback 覆盖真正 durable docs 真源

### D. Reader 与 Context Routing

需要改造：

1. `src/context-routing/loader.js`
2. `src/context-routing/evaluator.js`
3. `src/context-routing/workspace-loader.js`

目标：

1. control plane 仍从 repo-local 读
2. durable docs 改从 backend resolver 指向的 docs root 读
3. durable docs 缺失、损坏、路径异常时可降级，而不是整体崩溃

### E. Workflow 接入层

需要改造：

1. `skills/spec-graph-bootstrap/SKILL.md`
2. `skills/spec-graph-bootstrap/SKILL.md`
3. `spec-compound` 对应 docs 写入逻辑

目标：

1. skill 文本 contract 与新双模式实现一致
2. 明确 repo-local control plane 与 durable docs 双平面语义

### F. Tests 与 Contract

需要改造：

1. `tests/unit/crg-artifact-paths.test.js`
2. `tests/unit/spec-graph-bootstrap-contracts.test.js`
3. `tests/unit/spec-graph-bootstrap-compiler.test.js`
4. `tests/unit/context-routing-evaluator.test.js`
5. external mode 对应 fixture / integration / e2e

目标：

1. 直接重写旧单模式 tests
2. 建立 `in_repo` 与 `external_knowledge` 两套正式 contract
3. 让 tests 成为新架构真源，而不是历史包袱

## 4.6 Phase 1 数据与目录 Contract

### 4.6.1 项目级 binding

新增：

```text
<repoRoot>/.spec-first/project-knowledge.json
```

建议最小 schema：

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

### 4.6.2 用户级本地 knowledge repo 映射

新增：

```text
~/.spec-first/config.json
```

职责：

1. 保存 remote -> local clone path 映射
2. 保存本地 clone 缓存路径
3. 不提交到代码仓库

### 4.6.3 external knowledge repo 目录

Phase 1 最小目录：

```text
knowledge-repo/
├── _meta/
│   └── repos/
│       └── <repoSlug>.json
└── <repoSlug>/
    ├── README.md
    └── docs/
        ├── contexts/
        └── solutions/
```

说明：

- 当前阶段可以保留 `<repoSlug>/README.md` 作为目录占位，但不把 repo 内 README 指针机制设计为必须项。

## 4.7 Phase 1 执行步骤

### Step 1：建立 binding contract

完成项：

1. 定义 `project-knowledge.json` schema
2. 定义 user config schema
3. 定义 `in_repo` / `external_knowledge` mode 读取规则

### Step 2：实现 init external 主链

完成项：

1. `--knowledge-repo` 参数解析
2. 解析当前 repo slug 与 remote
3. clone 或校验 knowledge repo 本地副本
4. 自动注册当前 repo
5. 写入 binding 文件

### Step 3：实现 durable docs resolver

完成项：

1. `resolveKnowledgeBinding(repoRoot)`
2. `resolveDurableDocsProjectRoot(repoRoot)`
3. `resolveDurableDocsDir(repoRoot, ...segments)`

### Step 4：改造 writer 主链

完成项：

1. `spec-graph-bootstrap` 输出 `docs/contexts`
2. `spec-graph-bootstrap` 输出 `docs/contexts`
3. `spec-compound` 输出 `docs/solutions`
4. external durable docs backup / rollback

### Step 5：改造 reader 主链

完成项：

1. `context-routing` 从新 resolver 读取 durable docs
2. docs 缺失或损坏时回退到 control plane / fallback 逻辑

### Step 6：重写 contract tests

完成项：

1. `in_repo` contract
2. `external_knowledge` contract
3. e2e 覆盖两种模式

## 4.8 Phase 1 验收标准

必须全部满足：

1. `spec-first init` 未传 knowledge repo 时，`in_repo` 在新实现下稳定工作
2. `spec-first init --knowledge-repo <remote>` 能完成 clone / 校验 / 注册 / 绑定
3. `spec-graph-bootstrap` 在 external mode 下把 `docs/contexts` 写到 external durable docs root
4. `spec-graph-bootstrap` 在 external mode 下把 `docs/contexts` 写到 external durable docs root
5. `spec-compound` 在 external mode 下把 `docs/solutions` 写到 external durable docs root
6. `context-routing` 在 external mode 下能正确读取 durable docs
7. control plane 仍完整写在 repo-local
8. rerun 失败时 external durable docs 可恢复
9. tests 不再把 repo-local `docs/contexts/<slug>` 当唯一真源

## 4.9 Phase 1 验证建议

单测至少包含：

1. `init external mode` 参数解析测试
2. binding 文件读写测试
3. user config 读写测试
4. repo 注册幂等测试
5. resolver `in_repo` / `external_knowledge` 分流测试
6. writer external docs root 测试
7. loader / evaluator external docs root 读取测试
8. backup / rollback external docs root 测试

e2e 至少包含：

1. `in_repo` 完整主链 e2e
2. `external_knowledge` 完整主链 e2e

---

## 5. Phase 2：durable docs 家族扩展与一致性治理

## 5.1 Phase 2 的目标

Phase 2 不是再证明 external mode 能不能跑通，而是要让双模式成为统一工作流能力。

Phase 2 完成后，应该回答：

> durable docs 是否已经从 `contexts/solutions` 扩展到更多 workflow 输出，并具备 doctor、自检和一致性治理能力？

## 5.2 Phase 2 的范围

在 Phase 1 基础上扩展：

1. `docs/plans`
2. `docs/reviews`
3. `docs/work`
4. doctor knowledge backend 检查
5. docs family consistency check
6. self-check / health 输出

## 5.3 Phase 2 明确不做

1. 不引入 `_group/docs/*` 自动写入
2. 不自动扫描或注册其他 repo
3. 不做组织级知识门户
4. 不做跨知识库聚合搜索
5. 不把迁移 helper 作为当前阶段必须项

## 5.4 Phase 2 模块改造清单

### A. Workflow 文档家族接入

需要接入：

1. `spec-plan`
2. `spec-work`
3. `spec-review`

目标：

1. 这些 workflow 的 durable docs 统一由 backend resolver 决定落点
2. 不允许一部分写 repo 内、一部分写外挂 repo

### B. Doctor 与自检

需要改造：

1. `src/cli/commands/doctor.js`
2. 相关诊断 helper

建议检查项：

1. 当前 knowledge mode
2. `project-knowledge.json` 是否存在且合法
3. 本地 knowledge repo 是否存在
4. repo 注册记录是否存在
5. durable docs root 是否存在
6. docs family 落点是否一致

### C. Consistency Check

需要新增：

1. docs family consistency 校验
2. external mode 混合落点检测
3. orphan durable docs 检测

### D. Skill / Contract 同步

需要改造：

1. `skills/spec-plan/*`
2. `skills/spec-work/*`
3. `skills/spec-review/*`

目标：

1. 文本 contract 与双模式路径语义一致
2. workflow 产物说明从单模式描述切换为双模式正式描述

## 5.5 Phase 2 文档家族分层

### 一级 durable knowledge

优先级最高：

1. `docs/contexts`
2. `docs/solutions`

### 二级 durable / semi-durable knowledge

Phase 2 纳入统一 backend：

1. `docs/plans`
2. `docs/reviews`
3. `docs/work`

说明：

- 这些内容是否长期保留，存在团队差异。
- 因此 Phase 2 的重点是“统一承载能力”，不是强制所有团队启用完全相同的保留策略。

## 5.6 Phase 2 执行步骤

### Step 1：接入更多 workflow

完成项：

1. `plan`
2. `work`
3. `review`

### Step 2：补 doctor 与 health

完成项：

1. knowledge backend doctor
2. binding / repo registration 检查
3. docs family consistency 检查

### Step 3：建立一致性 contract

完成项：

1. external mode 不允许混合 docs 落点
2. tests 明确 family 一致性
3. self-check 明确失败原因

## 5.7 Phase 2 验收标准

必须全部满足：

1. `plan / work / review` 的 durable docs 可按 mode 切换落点
2. doctor 能准确报告当前 knowledge mode、binding、registration、docs root 状态
3. external mode 下 docs family 不再混合落点
4. docs family 的 contract、tests、self-check 都已统一到新架构

## 5.8 Phase 2 验证建议

至少新增：

1. doctor external mode contract tests
2. docs family consistency tests
3. `plan / work / review` external mode integration tests
4. external mode 下孤儿文档 / 路径漂移检测测试

---

## 6. Phase 3：workspace / group 级 durable knowledge

## 6.1 Phase 3 的目标

Phase 3 的重点不是“再加更多 repo 级文档”，而是把双模式能力升级为 polyrepo / workspace 能力。

Phase 3 需要回答：

> 当多个 repo 归组到同一个 knowledge repo 后，系统是否已经能承载 group / workspace / cross-repo 级 durable knowledge，并与 cross-repo 主链协同？

## 6.2 Phase 3 的范围

1. `_group/docs/*` 正式引入
2. repo-level 与 group-level durable knowledge 分层
3. 与 cross-repo / workspace 主链整合
4. group-level 文档写入边界与治理

## 6.3 Phase 3 明确不做

1. 不做全公司统一知识大仓
2. 不做复杂在线权限平台
3. 不做向量检索平台化
4. 不让普通 repo-local workflow 默认改写 group-level 顶层文档

## 6.4 Phase 3 模块改造清单

### A. group-level resolver

需要新增：

1. `resolveGroupDocsDir(...)`

用途：

1. 解析 `_group/docs/...`
2. 为 cross-repo durable docs 提供正式落点

### B. cross-repo 主链接入

应优先接入：

1. workspace repo registry
2. cross-repo dependency index
3. cross-repo impact analysis
4. cross-repo minimal-context assembly
5. cross-repo ownership & review routing
6. contract-level dependency extraction
7. cross-repo task decomposition
8. cross-repo verification matrix
9. incremental update + rollback

说明：

- 这些能力在团队微服务拆分过细、一个需求涉及多个工程时，才真正体现 external knowledge repo 的战略价值。

### C. group-level workflow 约束

必须新增显式 workflow 或管理命令，而不是让任意 repo-local bootstrap 默认改 `_group/docs/*`。

原因：

1. group-level 文档天然是多 repo 共享资产
2. 自动误写风险高
3. merge 冲突与责任边界更复杂

## 6.5 Phase 3 repo-level / group-level 边界

### repo-level durable knowledge

只回答：

1. 该 repo 是什么
2. 该 repo 的上下文、约束、长期经验是什么
3. 该 repo 内的稳定模式与方案是什么

### group-level durable knowledge

只回答：

1. 多 repo 如何协作
2. service boundary 是什么
3. shared terms 是什么
4. cross-repo flow / ownership / verification 如何组织

## 6.6 Phase 3 执行步骤

### Step 1：建立 `_group/docs/*` contract

完成项：

1. 目录结构
2. resolver
3. group metadata

### Step 2：接入 cross-repo durable knowledge

完成项：

1. registry
2. dependency index
3. impact analysis
4. verification matrix

### Step 3：明确 group-level 写入权限

完成项：

1. 只允许显式 group workflow
2. repo-local workflow 默认不可写 group 顶层
3. CODEOWNERS / review 边界建议文档化

## 6.7 Phase 3 验收标准

必须全部满足：

1. `_group/docs/*` 有正式目录与 resolver
2. repo-level 与 group-level 边界清晰
3. cross-repo / workspace 主链可消费 group-level durable docs
4. 普通 repo-local workflow 不会误写 group-level 顶层
5. 多 repo 共用一个 knowledge repo 时，知识层仍可维护、可合并、可审计

## 6.8 Phase 3 验证建议

至少新增：

1. group-level resolver tests
2. repo-level / group-level boundary tests
3. multi-repo knowledge repo integration e2e
4. cross-repo consumer tests

---

## 7. 三阶段依赖关系

## 7.1 正确顺序

```text
Phase 1
  -> binding / resolver / writer / reader / tests
  -> 让 repo-level 双模式主链成立

Phase 2
  -> 扩展更多 docs family
  -> 补 doctor / self-check / consistency

Phase 3
  -> 引入 _group/docs
  -> 接入 cross-repo / workspace durable knowledge
```

## 7.2 为什么不能反过来

### 不能先做 Phase 3

因为 repo 级 external durable docs 还没成立时，先做 group-level 只会制造更多真源冲突。

### 不能先迁全量 docs 家族

因为当前最明确、最稳定、最值得先纳入 knowledge backend 的 durable docs 仍然是：

1. `docs/contexts`
2. `docs/solutions`

### 不能把 control plane 一起外移

因为这会同时引入：

1. graph / freshness / manifest / rollback 复杂度
2. 本地运行态与 remote durable knowledge 混写问题
3. 更高的失败恢复成本

---

## 8. 全量交付物清单

## 8.1 Phase 1 交付物

1. `project-knowledge.json` contract
2. user-level knowledge repo config contract
3. `knowledge-backend/resolver.js`
4. `init --knowledge-repo` 主链
5. external mode repo 自动注册
6. `spec-graph-bootstrap` external durable docs 支持
7. `spec-graph-bootstrap` external durable docs 支持
8. `spec-compound` external durable docs 支持
9. `context-routing` external durable docs 读取支持
10. external durable docs backup / rollback
11. 双模式正式 tests / contract 重写
12. `in_repo` 与 `external_knowledge` e2e

## 8.2 Phase 2 交付物

1. `plan / work / review` backend 接入
2. doctor knowledge backend checks
3. docs family consistency checks
4. self-check / health 输出
5. docs family 新 contract tests

## 8.3 Phase 3 交付物

1. `_group/docs` 结构
2. group-level resolver
3. repo-level / group-level boundary contract
4. cross-repo consumer integration
5. 多 repo 协作治理策略
6. cross-repo durable knowledge tests

---

## 9. 风险与控制策略

## 9.1 Phase 1 风险

### 风险 1：writer 已切 external，但 reader 仍读 repo-local

控制策略：

1. 先落 binding / resolver
2. 再同时改 writer / reader
3. contract tests 先于 e2e 落地

### 风险 2：external durable docs 回滚语义不完整

控制策略：

1. control plane rollback 与 durable docs rollback 明确拆开
2. external rerun 测试必须覆盖失败恢复

### 风险 3：tests 仍被旧单模式假设绑住

控制策略：

1. 直接重写 tests
2. 不做“保住旧断言再局部 patch”的路线

## 9.2 Phase 2 风险

### 风险 1：docs family 发生混合落点

控制策略：

1. doctor 检测
2. family consistency tests
3. external mode 下统一 resolver 强约束

### 风险 2：workflow 文本 contract 与实现漂移

控制策略：

1. skill 文本同步改造
2. 在 contract tests 中覆盖路径语义

## 9.3 Phase 3 风险

### 风险 1：repo-level 与 group-level 边界混乱

控制策略：

1. 显式 `_group/docs/*` 分层
2. 显式 group workflow
3. 普通 repo-local workflow 禁止直接写 group 顶层

### 风险 2：知识仓库 merge 冲突过多

控制策略：

1. `_meta/repos/<repoSlug>.json` 局部注册
2. `<repoSlug>/docs/...` 按 repo 分目录
3. group-level 内容集中到 `_group/docs/*`

---

## 10. 最终结论

这份实施文档给出的核心判断是：

1. 正确的落地顺序必须是 `Phase 1 -> Phase 2 -> Phase 3`
2. 当前最重要的不是“补一个路径参数”，而是把双模式主链正式建立起来
3. 当前开发阶段不需要为了历史实现兼容而增加额外复杂度
4. 因此应直接重写旧单模式 contract、旧 tests、旧 path model、旧 skill 文本

最终应以以下主链作为开发基线：

```text
repo-local:
  .spec-first/workflows/bootstrap/<slug>/      # control plane

knowledge backend:
  in_repo            -> <repoRoot>/docs/...
  external_knowledge -> <knowledgeRepoLocal>/<repoSlug>/docs/...
```

Phase 1 的任务是让这条主链成立。
Phase 2 的任务是让这条主链覆盖更多 workflow，并可自检、可治理。
Phase 3 的任务是让这条主链升级为 polyrepo / workspace 场景下真正有战略价值的 durable knowledge 基础设施。
