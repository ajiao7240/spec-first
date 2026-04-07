# Agent-First Spec-Docs Knowledge Architecture

**Goal:** 为 `spec-first` 建立一套从 `0 -> 100` 可连续演进的团队知识架构：以代码分析结果为原始输入，以 markdown 知识页为中间表示，以 Agent CLI 上下文装配为主要消费方式。

**Positioning:** 这不是单纯的“独立文档仓库”方案，而是一个 `agent-first, human-auditable` 的知识编译系统。

---

## 适用阶段与运行模式

这套架构跨阶段成立，但不要求在所有项目阶段启用同一治理强度。

- `0 -> 1`：支持，但必须降配为 `Lite` 模式
- `1 -> 10`：最适配，作为当前 Phase 1 的默认目标
- `10 -> 100`：方向成立，但需要在 Phase 2+ 增补规模化治理

### Lite 模式（0 -> 1）

适用场景：
- 单项目或单仓库
- 主要目标是先证明知识沉淀有收益
- owner 边界尚不稳定，项目知识结构仍在探索

启用能力：
- `raw/`
- `knowledge/`
- 最轻量 `docs-local.json`
- 基础 validator
- 单项目上下文路由

降级策略：
- `draft/` 可选，不强制
- `owner` 可默认为当前项目开发者
- 可先允许 in-repo mode
- 不强制 workspace 发现
- 不要求复杂 publish 审核链

说明：
- `Lite` 模式中的 validator 仍然作用于**知识树本身**
- 它不要求项目必须绑定独立 docs repo
- 只要存在可识别的 `knowledge/` 结构，无论位于 in-repo 还是 docs repo，都可以执行基础校验

### Team 模式（1 -> 10）

适用场景：
- 多个模块 owner
- 多个 workflow 节点需要复用同一份知识
- 独立 docs repo 已有明显价值

启用能力：
- docs repo 绑定
- workspace 发现与 slug 解析
- `raw -> draft -> knowledge`
- `docs-local.json`
- publish validator
- `spec-plan` / `spec-work` / `spec-review` 的知识优先读取

### Scale 模式（10 -> 100）

适用场景：
- 项目数、模块数、owner 数明显增长
- 同义页面、陈旧页面、重复知识与 shared routing 成为主要成本

在 Team 之外需要额外补强：
- taxonomy / canonical id 规则
- 更强的 stale detection
- `_shared/` 与跨项目知识路由
- 更严格的 publish lint
- 知识健康度指标与 doctor 扩展
- 更细粒度的 owner / reviewer 约束

## 北极星架构

无论项目处于哪个阶段，都保持以下核心结构不变：

1. **原始层 `raw/`**
   - 记录代码分析结果
   - 只追加，不静默改写
   - 必须带时间、commit、分析范围

2. **工作层 `draft/`**
   - 承接 LLM 综合、比较、归纳
   - 允许不确定和冲突存在
   - 不能冒充正式知识

3. **发布层 `knowledge/`**
   - 只承载团队认可的知识页
   - 是 Agent CLI 的高信任上下文池
   - 必须具备最基本的可追溯性

4. **治理层**
   - 由 frontmatter、目录规则、validator、doctor 组成
   - 不依赖某个具体模型能力
   - 不依赖某个特定平台 UI

5. **消费层**
   - 人类通过 markdown 直接阅读
   - Agent CLI 通过知识路由和上下文装配消费
   - 同一份知识同时服务人和 agent，但优先满足 agent 的稳定读取

## 现在必须定死的决策

- `raw -> draft -> knowledge` 三层分离
- `docsLocalPath` 不写入共享 state，但必须有运行时私有发现链路
- `knowledge/` 只能承载已发布页
- 已发布页必须具备最小可追溯字段
- Agent 的读取顺序必须是“先知识、后源码”
- docs repo 继续保持 git-native / markdown-native，而不是提前服务化

## 可以延后但必须预留扩展点的决策

- `_shared/` 跨项目知识路由
- taxonomy / canonical id 体系
- 更强的 stale detection
- 知识健康度指标和 doctor 报表
- owner / reviewer 更细粒度治理
- 语义召回、向量检索或数据库索引

延后的原则不是“不考虑”，而是：
- 目录与 schema 不阻塞未来接入
- 运行时 contract 不绑定当前实现细节
- doctor / validator 可以渐进增强

## 从 0 -> 100 的演进路径

1. **0 -> 1：先证明知识沉淀有收益**
   - 能生成 `raw/`
   - 能产出少量 `knowledge/`
   - Agent 能在关键节点读到它

2. **1 -> 10：建立稳定治理**
   - 引入 `draft/`
   - 引入 owner / publish guard
   - 让 `plan/work/review` 统一消费知识层

3. **10 -> 100：降低知识运营成本**
   - 解决重复页、陈旧页、shared knowledge、跨项目路由
   - 让 doctor 不只检查“有没有”，还检查“健不健康”

## 全局能力矩阵

| 能力 | Lite (0->1) | Team (1->10) | Scale (10->100) |
|---|---|---|---|
| docs repo | 可选 | 推荐默认 | 必须 |
| in-repo fallback | 必须支持 | 支持 | 仅应急 |
| `raw/` | 必须 | 必须 | 必须 |
| `draft/` | 可选 | 必须 | 必须 |
| `knowledge/` | 必须 | 必须 | 必须 |
| owner 审核 | 弱约束 | 必须 | 必须且更细粒度 |
| publish validator | 基础 | 标准 | 强化 |
| workspace 发现 | 可选 | 推荐 | 必须 |
| `_shared/` 路由 | 不需要 | 可选 | 必须 |
| stale detection | 轻量 | 标准 | 强化 |
| 健康度指标 | 不需要 | 可选 | 必须 |
| 语义/向量检索 | 不需要 | 可选 | 可考虑 |

## 防止未来返工的检查点

每个阶段实施时，都要回头检查：

1. 这项改动是在强化 `raw -> draft -> knowledge`，还是在绕开它？
2. 这项改动会不会让 agent 又退回到“直接扫源码”为主？
3. 这项改动是为当前阶段解决真实问题，还是提前为更大规模做过度设计？
4. 这项改动未来是可增强的，还是会把后续扩展路径锁死？

## 设计总原则

1. **结构优先于功能堆叠**
2. **高信任上下文优先于高覆盖率**
3. **显式治理优先于隐式约定**
4. **运行时 contract 稳定优先于内部实现优雅**
5. **演进式扩展优先于一次到位**
