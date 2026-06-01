# GitNexus 多仓模式 group 配置问题分析

## 背景

本工作区是父级多仓 workspace，父目录本身不是 Git 仓库，实际代码分布在多个 child Git repo 中，例如：

- `hs-kaz-crm-money-service`
- `hs-kaz-crm-admin`
- `hs-kaz-crm-open-api`
- `hs-kaz-crm-service`
- `hs-kaz-crm-web`

父级 workspace 完整路径：

```text
/Users/kuang/ops/code/9627_KAZ展业项目-MVP版本-CRM需求_中台开发
```

当前 `.spec-first/workspace/graph-targets.json` 与 `.spec-first/workspace/gitnexus-readiness.json` 纳入的 Git child repo 路径如下：

| target_repo | workspace_relative_path | git_root |
| --- | --- | --- |
| `hs-kaz-bss-service` | `hs-kaz-bss-service` | `/Users/kuang/ops/code/9627_KAZ展业项目-MVP版本-CRM需求_中台开发/hs-kaz-bss-service` |
| `hs-kaz-crm-admin` | `hs-kaz-crm-admin` | `/Users/kuang/ops/code/9627_KAZ展业项目-MVP版本-CRM需求_中台开发/hs-kaz-crm-admin` |
| `hs-kaz-crm-basic-service` | `hs-kaz-crm-basic-service` | `/Users/kuang/ops/code/9627_KAZ展业项目-MVP版本-CRM需求_中台开发/hs-kaz-crm-basic-service` |
| `hs-kaz-crm-money-service` | `hs-kaz-crm-money-service` | `/Users/kuang/ops/code/9627_KAZ展业项目-MVP版本-CRM需求_中台开发/hs-kaz-crm-money-service` |
| `hs-kaz-crm-open-api` | `hs-kaz-crm-open-api` | `/Users/kuang/ops/code/9627_KAZ展业项目-MVP版本-CRM需求_中台开发/hs-kaz-crm-open-api` |
| `hs-kaz-crm-service` | `hs-kaz-crm-service` | `/Users/kuang/ops/code/9627_KAZ展业项目-MVP版本-CRM需求_中台开发/hs-kaz-crm-service` |
| `hs-kaz-crm-task` | `hs-kaz-crm-task` | `/Users/kuang/ops/code/9627_KAZ展业项目-MVP版本-CRM需求_中台开发/hs-kaz-crm-task` |
| `hs-kaz-crm-web` | `hs-kaz-crm-web` | `/Users/kuang/ops/code/9627_KAZ展业项目-MVP版本-CRM需求_中台开发/hs-kaz-crm-web` |

父目录下还存在 `hs-kaz-es-service`：

```text
/Users/kuang/ops/code/9627_KAZ展业项目-MVP版本-CRM需求_中台开发/hs-kaz-es-service
```

但当前检查结果显示它不是 Git 仓库，也未出现在 workspace graph/readiness 的 Git child repo 清单中，因此不应直接作为当前 GitNexus group 成员加入；如后续需要纳入，应先确认它的仓库归属、索引方式和目标 scope。

仓库治理要求跨 repo 代码查询、影响分析、代码理解类任务必须先读取：

- `.spec-first/workspace/graph-targets.json`
- `.spec-first/workspace/gitnexus-readiness.json`

再根据 `group.status` 和 `recommended_query_path` 判断使用 GitNexus group 查询、bounded fallback，或直接源码读取。

## 当前现状

当前 GitNexus 并不是完全不可用。

官方开源版 GitNexus 支持多仓 group。基于本地官方源码 `gitnexus@1.6.5` 的核实结果：

- CLI 支持 `gitnexus group create/add/remove/list/sync/contracts/query/status`
- MCP 支持 `group_list` 和 `group_sync`
- MCP 的 `query` / `context` / `impact` 支持通过 `repo="@<groupName>"` 进入 group mode
- MCP 的 `query` / `context` / `impact` 也支持 `repo="@<groupName>/<memberPath>"` 限定到 group 内某个成员
- group mode 的跨仓 impact 依赖 Contract Registry / bridge，需要先执行 group sync

需要注意的是，当前官方源码中的 MCP 形态不是单独暴露 `group_query`、`group_context`、`group_impact`。这些旧式 group 专用工具已被迁移为：

```text
query/context/impact + repo="@groupName"
```

以及：

```text
group_list
group_sync
gitnexus://group/{name}/contracts
gitnexus://group/{name}/status
```

通过 `mcp__gitnexus.list_repos` 可见，KAZ 多个子仓已经存在 repo-local GitNexus 索引，包括：

- `hs-kaz-bss-service`
- `hs-kaz-crm-admin`
- `hs-kaz-crm-basic-service`
- `hs-kaz-crm-money-service`
- `hs-kaz-crm-open-api`
- `hs-kaz-crm-service`
- `hs-kaz-crm-task`
- `hs-kaz-crm-web`

这说明单个子仓层面的 GitNexus 查询能力可用。对于明确落在某个子仓的问题，可以显式传入 `repo` 参数使用 GitNexus，例如：

```text
repo: "hs-kaz-crm-money-service"
```

但是父级 workspace 的多仓 group 查询当前不可用。证据如下：

- `.spec-first/workspace/gitnexus-readiness.json` 中 `recommended_query_path` 为 `direct-read-fallback`
- `.spec-first/workspace/gitnexus-readiness.json` 中 `group.status` 为 `not-evaluated-no-mcp-input`
- `mcp__gitnexus.group_list` 返回 `groups: []`
- 各子仓 readiness 中存在 `current-with-dirty-overlay` 提示，需要用源码读取校验当前工作树

因此当前状态应表述为：

```text
官方开源版支持 group；KAZ repo-local GitNexus 可用；当前 KAZ 跨仓 group 关联未配置，父级 workspace 无法直接使用 group mode 做多仓关联查询。
```

## 问题表现

在回答“出金支持几种方式”时，查询流程出现了一个判断偏差：

1. 已按治理要求读取 `graph-targets.json` 和 `gitnexus-readiness.json`
2. 看到 `recommended_query_path=direct-read-fallback`
3. 直接使用 `rg` 和源码读取确认枚举
4. 没有先对明确相关的 `hs-kaz-crm-money-service` 执行 repo-local GitNexus 查询

这个流程虽然最终结论来自源码，事实可靠，但对 GitNexus 能力的使用不充分。

更准确的流程应该是：

1. 先读取 workspace readiness，确认 group 查询是否可用
2. 如果 group 不可用，但问题明显落在某个子仓，优先使用 repo-local GitNexus 查询
3. 对 dirty overlay、枚举值、关键接口字段，再用源码读取做最终校验
4. 只有当目标子仓不明确、索引缺失、查询无结果或结果与源码冲突时，再退回纯 `rg` / direct-read fallback

## 根因分析

### 1. readiness 的推荐路径容易被理解为全局禁用 GitNexus

`recommended_query_path=direct-read-fallback` 描述的是父级 workspace 当前没有可用 group 查询入口，不代表所有 child repo 的 GitNexus 索引都不可用。

在多仓 workspace 中，需要区分两种能力：

- repo-local 查询：针对单个 child repo 的 GitNexus 查询
- group 查询：跨 child repo 的 GitNexus 关联查询

当前问题在于将父级 group 不可用误读成 GitNexus 整体不可用。

### 2. group 配置缺失

`group_list` 返回空数组，说明当前 GitNexus 没有注册 KAZ workspace 对应的 group。

缺少 group 后，以下能力不可直接使用：

- `repo: "@groupName"` 的跨仓查询
- `repo: "@groupName/childRepoPath"` 的 group-scoped 查询
- 基于 Contract Registry 的跨仓 contract bridge
- `group_sync` 后的 API 消费方与提供方关联

这不是官方开源版能力缺失，而是本机当前 GitNexus registry 中没有为 KAZ workspace 建立 group 配置。

### 3. dirty overlay 降低索引可信度

多个子仓标记为 `current-with-dirty-overlay`。这意味着 GitNexus 索引可能基于当前 commit 或 dirty overlay 快照，仍需要用源码读取验证关键事实。

这不应阻止使用 GitNexus 做定位和影响分析，但最终结论需要以当前源码为准。

## 优化建议

### 优化一：配置 KAZ 多仓 GitNexus group

为当前父级 workspace 配置一个 GitNexus group，例如：

```text
kaz-crm-mvp
```

group 应覆盖当前工作区内的主要子仓：

- `/Users/kuang/ops/code/9627_KAZ展业项目-MVP版本-CRM需求_中台开发/hs-kaz-bss-service`
- `/Users/kuang/ops/code/9627_KAZ展业项目-MVP版本-CRM需求_中台开发/hs-kaz-crm-admin`
- `/Users/kuang/ops/code/9627_KAZ展业项目-MVP版本-CRM需求_中台开发/hs-kaz-crm-basic-service`
- `/Users/kuang/ops/code/9627_KAZ展业项目-MVP版本-CRM需求_中台开发/hs-kaz-crm-money-service`
- `/Users/kuang/ops/code/9627_KAZ展业项目-MVP版本-CRM需求_中台开发/hs-kaz-crm-open-api`
- `/Users/kuang/ops/code/9627_KAZ展业项目-MVP版本-CRM需求_中台开发/hs-kaz-crm-service`
- `/Users/kuang/ops/code/9627_KAZ展业项目-MVP版本-CRM需求_中台开发/hs-kaz-crm-task`
- `/Users/kuang/ops/code/9627_KAZ展业项目-MVP版本-CRM需求_中台开发/hs-kaz-crm-web`

CLI 配置示例：

```bash
gitnexus group create kaz-crm-mvp
gitnexus group add kaz-crm-mvp hs-kaz-bss-service hs-kaz-bss-service
gitnexus group add kaz-crm-mvp hs-kaz-crm-admin hs-kaz-crm-admin
gitnexus group add kaz-crm-mvp hs-kaz-crm-basic-service hs-kaz-crm-basic-service
gitnexus group add kaz-crm-mvp hs-kaz-crm-money-service hs-kaz-crm-money-service
gitnexus group add kaz-crm-mvp hs-kaz-crm-open-api hs-kaz-crm-open-api
gitnexus group add kaz-crm-mvp hs-kaz-crm-service hs-kaz-crm-service
gitnexus group add kaz-crm-mvp hs-kaz-crm-task hs-kaz-crm-task
gitnexus group add kaz-crm-mvp hs-kaz-crm-web hs-kaz-crm-web
gitnexus group sync kaz-crm-mvp
```

其中第三个参数是 registry name，需要与 `gitnexus list` / `mcp__gitnexus.list_repos` 中的 repo 名称一致。

配置完成后执行 group 同步，生成跨仓 Contract Registry 和桥接关系。MCP 侧对应操作为：

```text
group_sync(name="kaz-crm-mvp")
```

完成后期望 `group_list` 能返回该 group，并可使用：

```text
repo: "@kaz-crm-mvp"
repo: "@kaz-crm-mvp/hs-kaz-crm-money-service"
```

如果只需要只读验证当前是否已配置 group，应先调用：

```text
group_list()
```

### 优化二：调整查询决策说明

在多仓 workspace 中，查询策略应明确分层：

1. 如果 `group.status=group-ready`，优先使用 group 查询
2. 如果 group 不可用，但目标子仓明确，使用 repo-local GitNexus
3. 如果目标子仓不明确，先用 bounded fanout 或 `rg` 定位候选子仓
4. 对 dirty overlay、用户可见接口、枚举、SQL、配置等事实，用源码读取校验
5. 当 GitNexus 结果与源码或测试冲突时，以源码或测试验证事实为准

### 优化三：改进 agent 执行习惯

后续遇到类似问题时，应避免直接把 `direct-read-fallback` 理解为 GitNexus 不可用。

推荐执行顺序：

```text
1. 读取 workspace graph/readiness
2. 调用 list_repos 确认目标子仓索引是否存在
3. 若目标子仓明确，调用 GitNexus query/context
4. 用 rg/sed 读取源码校验最终事实
5. 回答中说明使用的是 repo-local GitNexus 还是 direct-read fallback
```

### 优化四：刷新 readiness 输出语义

如果后续维护 spec-first / GitNexus readiness 生成逻辑，建议将推荐路径表达得更精确。

当前：

```text
recommended_query_path: direct-read-fallback
```

建议补充类似字段：

```text
group_query_ready: false
repo_local_query_ready: true
recommended_query_path: repo-local-gitnexus-then-direct-verify
```

这样可以降低误读概率。

### 优化五：区分官方能力、当前配置和 spec-first readiness

后续分析时应把三层概念分开：

1. GitNexus 官方开源版能力：支持 group
2. 当前本机 GitNexus 配置：`group_list` 返回空数组，说明 KAZ group 未配置
3. spec-first workspace readiness：script mode 下不会持久化 live MCP 的 `list_repos` / `group_list` 结果，`group.status=not-evaluated-no-mcp-input` 只表示持久化 readiness 没有实时 MCP group 证据

因此不能仅凭 `not-evaluated-no-mcp-input` 判断 GitNexus group 不支持，也不能仅凭官方支持就假设当前 workspace 已经可用。最终应以 live `group_list` 与实际 group sync 状态为准。

### 优化六：明确 GitNexus 与 rg 的取舍

GitNexus 不应被当作 `rg` 的替代品。当前 KAZ workspace 尚未配置 group 时，很多普通定位问题直接使用 `rg` 更快、更稳定。

优先使用 `rg` 的场景：

- 查某个中文词、枚举值、字段名、接口路径在哪些文件出现
- 判断某个枚举支持几种取值
- 定位 SQL 字段、配置项、文案、注释
- 不需要调用链、影响分析或跨仓契约关系的轻量事实查询

优先使用 repo-local GitNexus 的场景：

- 已经大致知道目标子仓，需要理解符号、类、方法之间的调用关系
- 需要 `context` 查看调用方、被调用方、process flow
- 需要 `impact` 判断修改一个符号的直接或间接影响
- 需要 API route、handler、consumer、response shape 等结构化关系

优先使用 group GitNexus 的场景：

- 已配置 group 且已完成 `group sync`
- 需要跨仓 query / context / impact
- 需要基于 Contract Registry / bridge 分析 provider 与 consumer 的跨仓契约关系
- 需要评估一个子仓接口或 DTO 变化对其他子仓的影响

在当前 KAZ 状态下，推荐策略是：

```text
轻量全局定位：rg 优先
明确子仓结构化理解：repo-local GitNexus + 源码校验
跨仓影响分析：先补 group 配置；未补前用 rg / bounded fanout 作为降级方案
```

因此，“不知道查哪个项目”时并不一定要强行使用 GitNexus fanout。对于普通事实定位，`rg` 的成本更低；GitNexus 的主要价值在结构化代码理解和跨仓 group 配置完成后的契约/影响分析。

## 验证方式

### 当前可验证项

1. 查询官方/本地 GitNexus 版本：

```text
gitnexus package: gitnexus@1.6.5
```

2. 查询 repo-local 索引：

```text
mcp__gitnexus.list_repos
```

期望看到 KAZ 子仓索引。

3. 查询 group 配置：

```text
mcp__gitnexus.group_list
```

当前结果为：

```text
groups: []
```

4. 针对明确子仓执行 repo-local 查询：

```text
mcp__gitnexus.query(repo="hs-kaz-crm-money-service", query="WithdrawPaymentMethodEnum 出金付款方式")
```

5. 用源码读取校验枚举：

```text
hs-kaz-crm-money-service/hs-kaz-crm-money-common/src/main/java/com/huasheng/crm/money/common/enums/withdraw/WithdrawPaymentMethodEnum.java
```

### group 配置后的验证项

1. `group_list` 返回 `kaz-crm-mvp`
2. `group_sync(name="kaz-crm-mvp")` 可成功执行
3. 可通过 `repo="@kaz-crm-mvp"` 查询跨仓概念
4. 可通过 API route / contract bridge 分析跨仓调用关系
5. readiness 中不再仅推荐 `direct-read-fallback`
6. 可通过 group 资源查看 contracts/status：

```text
gitnexus://group/kaz-crm-mvp/contracts
gitnexus://group/kaz-crm-mvp/status
```

## 结论

当前问题不是 GitNexus 官方开源版在多仓模式下不可用，而是当前 workspace 缺少 GitNexus group 配置。

在 group 配置缺失时：

- 官方 group 能力存在，但当前 KAZ workspace 未启用
- 单个子仓的 GitNexus 索引仍可用
- 跨仓 group 关联查询不可用
- 轻量全局定位任务优先使用 `rg`，不必强行 GitNexus fanout
- 结构化理解和影响分析优先使用 repo-local GitNexus，再用源码校验
- 真正的多仓关联能力需要补齐 group 配置并执行 group sync
