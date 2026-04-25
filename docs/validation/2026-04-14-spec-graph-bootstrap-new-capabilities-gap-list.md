# spec-graph-bootstrap 新增能力缺口清单

## 1. 目的

本文档单独列出：**相对于当前 `spec-first` 已落地能力，`spec-graph-bootstrap` 需求中仍属于新增功能、但当前仓库头状态尚未真正具备的能力**。

这里的“尚未具备”指：

- 需求文档里明确作为后续增强、终局能力或下一阶段目标存在；
- 但当前仓库审查基线仍停留在 v1 / 阶段 0-3 已完成范围；
- 因而不能把这些项误判成“已经实现”。

当前审查基线见：

- `docs/validation/2026-04-14-spec-graph-bootstrap-phase0-3-audit-report.md`
- `docs/validation/2026-04-14-spec-graph-bootstrap-doc-drift-checklist.md`

---

## 2. 当前已具备的能力边界（用于对照）

当前仓库已明确具备的能力是：

- 新入口 `graph-bootstrap` 已接线
- 控制面路径已收敛到 `.spec-first/workflows/bootstrap/<slug>/`
- manifest 已统一为 `artifact-manifest.json`
- Stage-0 样本目录 `docs/contexts/spec-first/` 已入库
- 最小闭环文档已生成：`README.md`、`00-summary.md`、`architecture/module-map.md`、`pitfalls/index.md`、`code-facts/*`、`context-packs/review-change.md`、`injection-index.yaml`
- `spec-plan` / `spec-work` / `spec-code-review` 已接入 v1 Stage-0 预载
- 当前消费顺序固定为：`always[] -> stages.<stage>[] -> selection_rules(output_exists.*) -> advice.<stage>`
- v1 显式跳过 `fact.*`
- 缺失产物时支持降级，不阻断主任务

所以，下面列出的项目都是**超出以上边界的新增能力**。

---

## 3. 尚未具备的新增能力总览

| 能力主题 | 当前状态 | 为什么算“新增能力” |
| --- | --- | --- |
| `task_type` 路由能力 | 未实现 | 当前 v1 不再生成 `task_types`，也没有稳定消费契约 |
| `fact.*` 动态路由能力 | 未实现 | 当前消费链显式跳过 `fact.*` |
| 显式 slug 指定 | 未实现 | 当前只按 `basename(resolve(target))` 生成 slug |
| slug 冲突自动解法（hash / v2） | 未实现 | 当前文档仅保留为后续增强方向 |
| 基于项目元信息的稳定 slug 推导 | 未实现 | 当前未从 `package.json.name` / repo name 推导 |
| 增量 refresh / 局部失效重算 | 未实现 | 阶段 4 仍未进入当前已完成范围 |
| freshness / analyzer_version / confidence 对外可见 | 未完整实现 | 需求里要求展示，但当前主打的是 0-3 阶段闭环 |
| rerun 失败恢复与刷新策略闭环 | 未完整实现 | 路线图列在阶段 4，当前未审定为已完成 |
| 基于依赖模型的 outputs 选择性重算 | 未实现 | `artifact-manifest.json` 依赖模型仍属后续建设 |
| 可选增强产物树（如更多 architecture/context packs） | 未实现或未固化 | 当前只落最小闭环，不是完整终局产物树 |
| task pack 通用体系化扩展 | 未完整实现 | 当前仅有 `context-packs/review-change.md` 作为最小闭环样本 |
| 宿主行为级验收闭环 | 未完整实现 | 当前以静态契约、样本和人工验证为主，不是稳定自动化宿主级验收 |

---

## 4. 分项说明

## 4.1 `task_type` 路由能力

### 当前状态
当前 `injection-index.yaml` 已收敛为：

- `always`
- `stages`
- `selection_rules`
- `advice`

当前 v1：

- 不再生成 `task_types`
- `spec-plan` / `spec-work` / `spec-code-review` 也没有按 `task_type` 做正式消费

### 为什么算新增功能
这意味着“根据任务类型精细路由上下文”的能力，仍然没有进入当前 `spec-first` 的正式能力集。

### 后续目标
需求中保留的终局方向是：

- 根据 `task_type` 精细注入不同上下文组合
- 让 `plan/work/review` 之外的细分任务获得更准的 Stage-0 预载

---

## 4.2 `fact.*` 动态路由能力

### 当前状态
当前 v1 消费链显式跳过 `fact.*`。

也就是说，虽然事实层里已经有结构化 facts，但这些 facts 还没有真正变成“可执行路由条件”。

### 为什么算新增功能
这是从“生成 facts”走向“消费 facts”的关键升级，属于真正的新能力，而不是文档措辞差异。

### 后续目标
例如未来可以支持：

- `fact.layers.frontend.present == true`
- `fact.testing.has_e2e.confidence >= high`
- `fact.integrations.database.present == true`

然后根据这些事实条件决定额外注入哪些上下文文档。

---

## 4.3 显式 slug 指定与稳定 slug 推导

### 当前状态
当前只支持：

1. `basename(resolve(target))`
2. 特殊字符替换为 `-`

### 为什么算新增功能
以下能力都还没有进入当前实现：

- 用户显式传入 slug
- 从 `package.json.name` / repo name 推导更稳定 slug
- slug 冲突时自动附加短 hash
- 支持 `<slug>-v2` / `<slug>-<date>` 的正式版本化策略

### 后续目标
让同一个项目在多轮 bootstrap、分支验证、上下文版本化时更稳、更可控。

---

## 4.4 增量 refresh / 局部失效重算

### 当前状态
当前完成范围主要到阶段 3B；阶段 4 仍属于后续目标。

因此目前还不能说系统已经具备：

- 局部失效分析
- 只重算受影响产物
- 全量/局部刷新切换
- rerun refresh 稳定策略

### 为什么算新增功能
这会把 `spec-graph-bootstrap` 从“一次性生成器”升级成“长期维护的 Stage-0 知识层”，能力等级明显不同。

### 后续目标
路线图中明确希望支持：

- 入口文件变化，只刷新入口相关产物
- 测试变化，只刷新测试相关产物
- 重大结构变化，升级为全量刷新
- rerun 失败时按策略恢复

---

## 4.5 freshness / confidence / analyzer version 对外可见

### 当前状态
需求文档强调正式产物应体现：

- `updated_at`
- `analyzer_version`
- `schema_version`
- `source_snapshot`
- `confidence`

但当前 0-3 阶段放行的重点仍是：

- 控制面 schema 收敛
- 最小闭环产物存在
- Stage-0 消费接入成立

### 为什么算新增功能
“让后续节点看到 freshness/confidence 并据此判断可信度”是更高一层的系统能力，目前还没有形成稳定外显闭环。

---

## 4.6 `artifact-manifest.json` 依赖模型

### 当前状态
虽然 `artifact-manifest.json` 已经替代 `fingerprints.json` 成为统一 manifest，
但它目前还不是完整的“依赖驱动刷新索引系统”。

### 为什么算新增功能
真正的新能力不是“文件名改了”，而是：

- 输入 -> 产物依赖图可计算
- 某类输入变化后能精确定位需重算的 outputs
- 可记录跳过原因、刷新类型、重算范围

这部分还属于阶段 4 建设目标。

---

## 4.7 扩展产物树与更多 task packs

### 当前状态
当前已落地的是 v1 最小闭环，不是完整终局产物树。

现在稳定可依赖的产物主要是：

- `README.md`
- `00-summary.md`
- `architecture/module-map.md`
- `pitfalls/index.md`
- `code-facts/public-entrypoints.md`
- `code-facts/test-map.md`
- `code-facts/high-risk-modules.md`
- `context-packs/review-change.md`
- `injection-index.yaml`

### 为什么算新增功能
需求里还保留了更多增强项，例如：

- 更多 `architecture/*` 文档
- 更多 `context-packs/*`
- 更细分的任务包与场景包

这些都不是当前 `spec-first` 已稳定具备的能力。

---

## 4.8 宿主行为级自动验收

### 当前状态
当前验证闭环主要靠：

- source skill 契约
- 样本目录
- 单元测试
- 3A/3B 人工或半自动验证记录

但还没有形成“在真实 Claude / Codex 宿主会话中，稳定自动证明预载行为正确”的完整验收体系。

### 为什么算新增功能
这意味着现在证明的是“契约与样本成立”，而不是“宿主实际执行行为被系统化持续验证”。

这是独立的新能力方向。

---

## 5. 建议按优先级理解这些新增能力

### 第一优先级：最有产品价值的新增能力

1. `fact.*` 动态路由
2. 增量 refresh / 局部失效重算
3. `artifact-manifest.json` 依赖模型
4. freshness / confidence 外显

这些能力直接决定 `spec-graph-bootstrap` 能否从“静态生成文档”升级为“长期可消费、可维护的知识层系统”。

### 第二优先级：工程体验增强

5. 显式 slug 指定
6. slug 冲突自动解法
7. 基于项目元信息的稳定 slug 推导

这些能力主要提升多项目、多轮运行、多版本上下文管理体验。

### 第三优先级：精细化上下文路由

8. `task_type` 路由
9. 更多 `context-packs/*`
10. 更完整的扩展产物树

这些能力主要提升 Stage-0 上下文注入的精准度和覆盖面。

---

## 6. 最终判断

如果问题是：

> 当前 `spec-first` 还没有、但 `spec-graph-bootstrap` 需求里新增出来的能力有哪些？

那么最核心的答案是四类：

1. **基于 facts 的动态路由能力**（当前还没有，v1 只做 `output_exists.*`）
2. **增量 refresh / 局部失效重算能力**（当前还没有，阶段 4 未完成）
3. **更稳定的 slug 管理能力**（当前还没有，仍是基础 basename 方案）
4. **更完整的 Stage-0 产物与 task pack 体系**（当前只有最小闭环，不是完整终局能力）

换句话说，当前 `spec-first` 已经有了 `spec-graph-bootstrap` 的 **v1 最小闭环**，但还没有拥有它在需求文档里定义的 **完整终局增强能力集**。
