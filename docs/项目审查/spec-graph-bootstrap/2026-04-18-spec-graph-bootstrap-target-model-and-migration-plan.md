# `spec-graph-bootstrap` 目标产物模型与迁移路线图

## 核心判断

在“轻 contract + 明确边界 + 让 LLM 决策”的指导思想下，`spec-graph-bootstrap` 下一阶段最重要的优化方向，不是继续增加 Stage-0 产物数量，而是：

1. 收紧持久化真源边界
2. 提升运行时决策输入质量
3. 降低重复表达与合同漂移
4. 把 verification 信息稳定在“事实快照”层，而不是继续长成“多状态流转 + 强编排”的状态机

这份文档不讨论“当前实现是否真实如此”，那部分已在已有专项审查文档中论证；本文件只回答：

- `spec-graph-bootstrap` 更合理的目标产物模型应是什么
- 应如何从当前实现迁移到更轻、更稳、更适合 LLM 决策的结构

## 分析前提

本判断基于两个事实：

1. 当前 `spec-graph-bootstrap` 已经具备一套 Stage-0 基础事实层、阶段卡片层、文档层、路由层与 runtime context 汇总层  
   代码依据：
   - [run-bootstrap.js](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/run-bootstrap.js)
   - [compile-machine-artifacts.js](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/compile-machine-artifacts.js)
   - [compile-human-assets.js](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/compile-human-assets.js)
   - [compile-routing.js](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/compile-routing.js)
   - [stage0-context.js](/Users/kuang/xiaobu/spec-first/src/cli/commands/stage0-context.js)
   - [workspace-compiler.js](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/workspace-compiler.js)

2. `code-review-graph` 的优秀点，不在于“用了图”，而在于它把上下文系统明确拆成：
   - 持久化结构真源
   - 机器派生层
   - 运行时压缩上下文层
   - 轻 workflow 约束层  
   代码依据：
   - [graph.py](/Users/kuang/xiaobu/code-review-graph/code_review_graph/graph.py)
   - [context.py](/Users/kuang/xiaobu/code-review-graph/code_review_graph/tools/context.py)
   - [build.py](/Users/kuang/xiaobu/code-review-graph/code_review_graph/tools/build.py)
   - [prompts.py](/Users/kuang/xiaobu/code-review-graph/code_review_graph/prompts.py)

## 目标模型

建议把 `spec-graph-bootstrap` 的目标产物模型明确分成 4 层。

### 1. 事实真源层

这一层是长期持久化、机器优先、字段可追溯的 Stage-0 真源。

建议保留为核心主集合：

- `fact-inventory.json`
- `risk-signals.json`
- `test-surface.json`
- `verification-profile.json`
- `artifact-manifest.json`
- `freshness.json`

这层的原则：

- 每个字段必须能追溯到代码事实、分析规则或稳定推导逻辑
- 不承载 workflow 状态流转
- 不承载人类叙述性表达
- 不混入 sample 数据或占位数据

### 2. 运行时决策层

这一层是面向下游 workflow 的“最小充分决策输入”，应由 runtime 在调用时生成，而不是主要依赖大量预落盘静态文件。

建议把 `spec-first stage0-context` 作为这一层的统一入口。

目标上，这个运行时决策包应稳定输出：

- `selected_assets`
- `fallback_reason`
- `level`
- `freshness_status`
- `verification_summary`
- `verification_evidence`
- `verification_gate_state`
- `ai_dev_quality_gate_result`
- `workspace / repo scope`
- `task-facing advice`

这层的原则：

- 以当前任务、当前变更面、当前 repo/workspace 命中范围为输入
- 输出最小充分上下文，而不是固定阶段文件包
- 保留 LLM 决策空间，不编码强状态跳转

### 3. 人类阅读层

这一层只承担“辅助理解”，不再承担唯一运行时真源职责。

建议保留：

- `00-summary.md`
- `architecture/module-map.md`
- `code-facts/public-entrypoints.md`
- `code-facts/test-map.md`
- `code-facts/high-risk-modules.md`
- `context-packs/review-change.md`

这层的原则：

- 人类可快速扫描
- 不和 machine truth 重复定义同一套 routing contract
- 不承担“唯一真源”职责

### 4. workspace 聚合层

workspace 层应只承担“注册、选择、聚合”职责，不应继续扩展成另一套完整静态知识库。

建议保留：

- `workspace-registry.json`
- `workspace-routing.json`

可保留但弱化：

- `workspace/routing-overview.md`
- `workspace/repo-registry.md`

这层的原则：

- 帮 runtime 找到该聚合哪些 child repo
- 帮 runtime 确定 fallback 和匹配优先级
- 不替代 child repo 的单仓 Stage-0 决策输入

## 建议的核心主产物集合

### 应保留为核心 truth 的产物

| 产物 | 角色 | 原因 |
|---|---|---|
| `fact-inventory.json` | repo 结构事实主表 | 所有模块、入口、集成、测试面派生的根基 |
| `risk-signals.json` | 风险事实主表 | 风险映射和 review 聚焦的事实基础 |
| `test-surface.json` | 测试事实主表 | 测试映射、候选测试、覆盖视角的基础 |
| `verification-profile.json` | 验证基线主表 | 为 `plan/work/review` 提供默认验证矩阵 |
| `artifact-manifest.json` | 输出账本 | 描述输入版本、输出关系、产物集合 |
| `freshness.json` | 新鲜度账本 | 明确 Stage-0 是否陈旧 |
| `workspace-registry.json` | workspace 注册表 | 解决 child repo 发现问题 |
| `workspace-routing.json` | workspace 路由表 | 解决 child repo 选择与 overview 注入问题 |

### 应保留为人类缓存的产物

| 产物 | 角色 | 原因 |
|---|---|---|
| `00-summary.md` | 总览缓存 | 快速建立项目基本心智 |
| `architecture/module-map.md` | 结构缓存 | 方便计划阶段理解模块边界 |
| `code-facts/public-entrypoints.md` | 入口缓存 | 方便计划/回退时理解入口链路 |
| `code-facts/test-map.md` | 测试缓存 | 方便 review/work 快速理解测试面 |
| `code-facts/high-risk-modules.md` | 风险缓存 | 方便 review/work 快速扫描风险 |
| `context-packs/review-change.md` | 任务导向缓存 | 最接近 review/work 的压缩包 |

### 应降级为 runtime-first / cache 的产物

| 产物 | 建议角色 | 原因 |
|---|---|---|
| `minimal-context/plan.json` | runtime cache | 不应再被视为主真源 |
| `minimal-context/work.json` | runtime cache | 更适合作为 `stage0-context` 的缓存来源 |
| `minimal-context/review.json` | runtime cache | 更适合作为 runtime 汇总的中间产物 |
| `context-routing.json` | 过渡期 machine routing contract | 可以保留，但应逐步让位给 runtime-first contract |
| `injection-index.yaml` | 人类视图 | 不应继续与 machine routing 并列为双真源 |

### 应退出默认核心集合的产物

| 产物 | 退出原因 |
|---|---|
| `ownership.json` | 当前不是 repo-fact 驱动，而是 sample 型控制面 |
| `review-queue.json` | 当前不是 repo-fact 驱动，容易被误判为真实任务账本 |
| `README.md` | 信息密度低，更多是目录入口提示，不值得保留为核心上下文资产 |
| `pitfalls/index.md` | 与 `high-risk-modules.md` 重叠度高，容易重复表达同类风险 |

## 推荐的统一 contract

建议把 `spec-graph-bootstrap` 的核心 contract 收敛为一句话：

`spec-graph-bootstrap` 负责生成稳定、可追溯的 Stage-0 repo facts，并通过 `stage0-context` 在运行时按 `plan/work/review` 编译最小充分决策输入；markdown 产物只作为人类阅读缓存，不作为唯一运行时真源。

这个 contract 的价值在于：

- 它比当前合同更轻
- 它把真源与阅读层分开了
- 它把 runtime 汇总能力正式提升为系统主入口
- 它天然避免把 bootstrap 做成重编排状态机

## 迁移路线图

迁移建议分 5 个阶段推进，先统一语义，再替换消费方式，再收敛冗余产物。

### 阶段 0：先修合同，不改行为

目标：

- 让文档和当前实现对齐
- 停止把目标态写成现状

建议动作：

1. 收紧 [skills/spec-graph-bootstrap/SKILL.md](/Users/kuang/xiaobu/spec-first/skills/spec-graph-bootstrap/SKILL.md)
2. 明确当前主真源是：
   - `src/bootstrap-compiler/`
   - `stage0-context`
3. 明确 `ownership.json` / `review-queue.json` 不是 repo-fact 核心产物
4. 明确 `injection-index.yaml` 是人类视图，不是唯一 routing 真源

验收标准：

- 仅读合同文档，也不会误判系统已经具备更重的 Phase 2/3 contract 或强状态编排

### 阶段 1：为每个产物建立分级元数据

目标：

- 给每个产物明确角色
- 让后续“保留 / 降级 / 删除 / runtime-first”有统一依据

建议动作：

在 `artifact-manifest.json` 或配套 contract 中为每个产物增加统一元数据，例如：

- `artifact_role`
- `truth_level`
- `default_consumer`
- `runtime_required`
- `human_only`

建议的 `truth_level` 至少区分：

- `source_of_truth`
- `derived_cache`
- `human_reference`
- `deprecated`

验收标准：

- 系统能明确回答“哪些是主真源、哪些只是缓存、哪些只是阅读层”

### 阶段 2：让 `stage0-context` 成为唯一优先入口

目标：

- 下游 workflow 不再自己维护复杂 preload 路径表
- runtime compiled context 成为第一公民

建议动作：

1. `spec-plan`、`spec-work`、`spec-code-review`、`spec-work-beta` 统一先调用 `stage0-context`
2. skill 内部只保留极小 fallback 资产集合
3. 不再在 skill 文档中维护冗长“优先读这些文件”的手工列表

验收标准：

- Stage-0 的消费入口从“文件集合”切换为“运行时决策包”

### 阶段 3：收敛重复产物

目标：

- 消除重复表达
- 降低合同漂移与维护成本

建议动作顺序：

1. 在 `context-routing.json` 与 `injection-index.yaml` 之间确定单一 machine-first 真源
2. 让 `pitfalls/index.md` 并入 `code-facts/high-risk-modules.md` 或 `context-packs/review-change.md`
3. 让 `README.md` 退出默认核心产物集合
4. 让 `ownership.json` / `review-queue.json` 退出默认核心主集合

我建议的保留方向是：

- 保留 `context-routing.json` 作为过渡期 machine routing contract
- 弱化或删除 `injection-index.yaml`

验收标准：

- 系统里不再存在两套并列表达同一 routing contract 的主文件

### 阶段 4：把 `minimal-context/*.json` 从主产物降为 runtime cache

目标：

- 把 Stage-0 的重点从“预落盘阶段卡片”转向“运行时编译最小决策包”

建议动作：

1. `stage0-context` 直接从事实真源层计算 `plan/work/review` 决策包
2. `minimal-context/*.json` 如需保留，只作为缓存
3. `artifact-manifest` 不再把它们标注为核心 truth
4. 下游 skill 文档也不再把它们描述为最高真源

验收标准：

- 系统心智完成从“静态装配”到“runtime-first”迁移

### 阶段 5：收紧 verification 体系，避免状态机化

目标：

- 保留高质量验证输入
- 避免把质量门做成强编排状态机

建议动作：

保留为 runtime facts：

- `verification_summary`
- `verification_evidence`
- `verification_gate_state`
- `ai_dev_quality_gate_result`

把 `verifier_dispatch` 明确降格为：

- 候选 verifier 建议
- blocker 提示
- handoff posture 提示

而不是：

- 硬性执行树
- 强状态流转器
- 自动阻断编排核心

验收标准：

- verification 字段只回答“当前事实如何”，不回答“必须按什么状态机推进”

## 优先级建议

如果只能先做 3 件事，建议顺序如下：

1. 把 `stage0-context` 升格成主入口
2. 把 `ownership.json`、`review-queue.json`、`injection-index.yaml`、`pitfalls/index.md` 从核心产物集合中降级
3. 收紧 `SKILL.md` 合同，统一 runtime-first 心智

原因：

- 这 3 步不会推高系统复杂度
- 这 3 步能显著提升 LLM 输入质量
- 这 3 步可以先完成“降重”，再去考虑后续的结构升级

## 最终目标形态

理想终局不是“更多 Stage-0 文件”，而是：

1. 磁盘上只有少量稳定、可追溯的事实真源
2. runtime 有一个统一的 `stage0-context` 决策编译器
3. markdown 只做人类阅读缓存，不承担唯一真源职责
4. workflow skill 不自己拼装大段上下文树，而是消费最小充分决策输入
5. verification 是事实快照，不是编排状态机

如果能收敛到这个形态，`spec-graph-bootstrap` 才真正符合：

- 轻 contract
- 明确边界
- 让 LLM 决策
- 给 LLM 提供更高质量的决策输入

