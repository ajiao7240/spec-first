# CRG 作为工作流质量底座

> 文档类型：架构设计  
> 创建日期：2026-04-12  
> 状态：设计确认

---

## 1. 核心定位

**CRG 不是一个“代码图工具”，而是 spec-first 的工程事实内核、工作流上下文引擎和质量控制底座。**

AST、代码图、调用图、社区检测、影响分析，都只是 CRG 的实现方案，不是 CRG 的产品定义。

更准确地说：

- 对外，CRG 提供的是可被工作流消费的工程事实。
- 对内，CRG 可以通过 AST、静态分析、图算法、增量索引、规则推断等多种技术实现。
- 未来即使底层实现从“单一 AST 代码图”演进为“代码图 + Git 变更 + 测试信号 + 文档事实 + 运行时观测”的复合事实层，CRG 的定位也不变。

因此，CRG 不应被定义为：

- 一个 CLI 图数据库工具
- 一个面向 review 的代码分析器
- 一组 `crg *` 子命令

CRG 应该被定义为：

- spec-first 在工程侧的长期事实层
- 为 `spec:plan` / `spec:work` / `spec:code-review` 提供上下文注入的引擎
- 为风险识别、影响评估、质量把关提供统一事实来源的底座

```
CRG（工程事实内核）
        ↓
事实采集 / 事实归一 / 事实评分 / 事实查询
        ↓
┌────────────┬────────────┬────────────┐
│ spec:plan  │ spec:work  │ spec:code-review│
└────────────┴────────────┴────────────┘
        ↓
上下文更准、决策更稳、质量可控
```

当前阶段 AST/代码图是最现实、最先落地的事实采集方案，因此阶段0聚焦 build pipeline 是正确的；但从终局目标看，AST 图分析只是 CRG 的一个子层，不应被误当成 CRG 本身。

---

## 2. 终局职责边界

CRG 终局上应该承担四类能力：

| 能力层 | 职责 | 典型输出 |
|------|------|-----------|
| 事实采集层 | 从代码、配置、Git、测试、文档中采集原始信号 | 节点、边、变更、测试信号、文档引用 |
| 事实归一层 | 把异构信号整理为统一可消费事实 | symbol、module、community、flow、risk item |
| 上下文引擎层 | 针对不同工作流组装最小充分上下文 | plan context、work impact、review context |
| 质量控制层 | 对改动、设计、实现进行风险与质量约束 | 风险评分、影响范围、耦合异常、证据链 |

这意味着 CRG 的目标不是“图建得出来”，而是：

- 对 `spec:plan`，提供真实结构边界与改动代价
- 对 `spec:work`，提供受影响范围、上下游关系、测试候选
- 对 `spec:code-review`，提供架构级风险、隐性依赖、证据化审查支撑

---

## 3. 多角色覆盖逻辑

spec-first 的目标用户覆盖前后端开发、产品、运营等多个角色。CRG 对各角色的价值路径如下：

| 角色 | 使用的工作流 | CRG 的贡献 |
|------|------------|-----------|
| 前端开发 | plan/work/review | JS/TS/CSS 等结构事实、模块边界与影响路径 |
| 后端开发 | plan/work/review | 多语言结构图谱、调用链与变更风险 |
| 移动开发 | plan/work/review | Swift/Kotlin/ObjC 等端侧结构与跨端影响 |
| 全栈开发 | plan/work/review | 跨语言、跨目录、跨层级的关系归一 |
| 产品经理 | brainstorm/plan | 通过 plan 阶段的工程事实理解真实技术边界 |
| 运营 | review/detect-changes | 变更风险评分、影响范围与质量异常提示 |

**关键洞察**：产品和运营通常不直接操作 CRG，但他们消费的工作流质量，最终会被 CRG 的事实上下文质量直接决定。

---

## 4. 各阶段 CRG 集成点设计

### 4.1 spec:plan

**问题**：计划时不了解现有代码结构，容易提出“纸面合理但实现代价极高”的方案。

**CRG 提供的上下文**：
```bash
spec-first crg context --repo .
# → top_hubs（高连通节点）+ communities（模块社区）+ flows（执行流）

spec-first crg architecture --repo .
# → 模块边界与社区结构，识别跨边界改动代价

spec-first crg god-nodes --repo .
# → 高风险节点清单，plan 时需要特别标注的改动点
```

**集成位置**：Phase 0 研究阶段，注入结构事实与高风险上下文后，再开始方案设计。

**决策质量提升**：

- 知道哪些模块高度耦合，方案会优先考虑解耦成本
- 知道 god node 列表，能提前标注改动风险
- 知道社区边界，避免设计跨社区的上帝接口
- 后续若接入 Git/测试事实，还能识别高频变更区与薄弱验证区

---

### 4.2 spec:work

**问题**：实现时不知道上下游关系，改了 A 不知道 B 会不会被带坏。

**CRG 提供的上下文**：
```bash
spec-first crg affected-flows --repo . --files <changed-files>
# → 当前改动影响哪些执行流（High/Medium/Low）

spec-first crg impact --repo . --files <changed-files>
# → 影响分析报告

spec-first crg query --repo . --pattern callers_of --symbol <symbol>
# → 调用方列表，改接口前必看
```

**集成位置**：实现开始前获取受影响流；关键接口改动前查询调用方。

**决策质量提升**：

- 实现前知道影响范围，避免漏改上下游
- 改接口前知道调用方列表，减少兼容性遗漏
- 知道关键执行流后，测试覆盖会更有针对性
- 后续接入测试事实后，可进一步给出回归建议面

---

### 4.3 spec:code-review

**问题**：Review 只看 diff 行，容易漏掉架构层面的隐性影响。

**CRG 提供的上下文**：
```bash
spec-first crg review-context --repo . --files <changed-files>
# → 改动文件的完整图谱上下文（调用方/被调用方/社区归属）

spec-first crg detect-changes --repo .
# → 风险评分 + 关键变更文件排序

spec-first crg surprising-connections --repo .
# → 隐性跨模块依赖，捕捉意料之外的耦合
```

**集成位置**：Review 开始前，拉取工程事实上下文，注入 reviewer agent。

**决策质量提升**：

- 不只看“改了什么”，还看“改到了谁依赖的东西”
- 能发现 diff 本身看不出的跨模块耦合
- 风险评分辅助决定 review 深度与关注点
- 审查意见可绑定证据链，而不只是抽象判断

---

## 5. 当前状态与缺口

```
现状：CRG query-first control plane ✅  |  质量/证据事实层增强中 ✅  |  工作流消费面 advisory 集成中 ⚠️
```

| 工作流 | CRG 调用 | 状态 |
|--------|---------|------|
| spec:plan | `crg hook before-plan` / `workflow-context` / `architecture` | 已有 advisory 入口，继续增强质量摘要 |
| spec:work | `crg hook before-work` / `impact` / `review-context` | 已有 work-run 与 graph context，继续增强证据质量 |
| spec:code-review | `crg hook before-review` / `review-context` / `surprising-connections` | 已有 review context，继续增强 confidence/reason 输出 |

**根本原因**：

- 当前 CRG 已经从旧 Stage-0 context pack 转向 query-first 图事实层。
- 关键缺口不再是“有没有图”，而是“图事实是否可度量、可解释、可置信消费”。
- 因此当前优化重点是 `graph-quality.json`、edge provenance、retrieval eval/fusion、community/flow metadata 与 hook compact summary。

### 5.1 质量与证据模型

CRG 产物必须把“事实强度”显式暴露给 LLM，而不是让脚本替 LLM 做语义裁决。

| 产物/字段 | 作用 | 边界 |
|---|---|---|
| `graph-quality.json` | generation-scoped 质量报告，暴露 parser coverage、unresolved edge rate、confidence distribution、community/flow/retrieval 概况 | advisory，不作为 hard gate |
| `edges.confidence` / `edges.resolution_method` / `edges.evidence` | 说明边是 direct target、相对路径、tsconfig alias、符号名还是启发式解析 | 不改变 node/edge identity |
| `unresolved_edges.reason` / `evidence` | 说明 unresolved 是 no_match、ambiguous、invalid_target_id 等 | unresolved 优先于猜测，避免假阳性 |
| `communities.algorithm` / `community_source` / `cohesion` | 说明社区来自 directory、graph 或 hybrid | directory-first fallback 保留 |
| `flows.entry_source` / `entry_confidence` / `truncated` | 说明 flow entry 是 CLI-like、route-like、test-like 或 zero-in-degree 候选，并暴露截断 | entry 是候选信号，不是运行时真相 |
| retrieval `score_breakdown` / `reasons` | 说明结果来自 FTS、changed file、candidate test、graph expansion、RRF fusion 等 | LLM 根据证据判断是否采用 |

这些字段的目标是提升输入质量：脚本提供可审计事实，LLM 继续决定计划范围、实现路径和 review 重点。

---

## 6. 为什么 AST 图只是方案，不是定义

如果把 CRG 等同于 AST 代码图，会出现三个设计偏差：

1. 容易把目标收缩为“支持更多语言 parser 的工程”。
2. 容易忽视 Git 变更、测试结果、文档事实、人工标注这些同样关键的工程信号。
3. 容易把工作流做成“先查图再做事”，而不是“按任务场景自动组装上下文”。

正确理解应该是：

- AST/代码图解决的是“结构事实”
- Git/changes 解决的是“演化事实”
- 测试/coverage 解决的是“验证事实”
- 需求/设计文档解决的是“意图事实”

CRG 的终局价值，在于把这些事实统一成一个可查询、可注入、可审计的工程上下文系统。

---

## 7. Graceful Degradation 原则

CRG 集成必须支持降级，不能成为强依赖：

```
CRG DB 存在？
    ├── 是 → 注入工程事实上下文，增强决策质量
    └── 否 → 跳过 CRG 步骤，工作流正常运行（仅提示“建议先运行 crg build”）
```

这保证了：

- 新项目还没 build 时，工作流不阻断
- CRG build 失败时，工作流不崩溃
- 产品/运营等不关心代码图的角色不受影响

---

## 8. 语言覆盖度 = 结构事实质量上限

在当前阶段，语言覆盖度主要影响的是“结构事实”的质量上限，而不是 CRG 全部价值的上限。

```
语言未覆盖                    语言已覆盖
──────────────────            ──────────────────────
Swift 文件不入图               Swift 文件进入图谱
↓                             ↓
crg affected-flows            crg affected-flows
返回不完整调用链               返回完整 iOS 调用链
↓                             ↓
work 阶段遗漏 iOS 端影响        work 阶段主动处理 iOS 端
```

因此，这一节的正确表述是：

- 语言覆盖度越高，结构图越完整
- 结构图越完整，plan/work/review 的结构判断越准
- 但高质量 CRG 仍然需要代码图之外的其他事实源

当前已覆盖语言（按当前方向目标口径）：

- JavaScript / TypeScript / TSX
- Python / Go / Java / Rust
- C / C++ / ObjC
- Swift / Kotlin
- Ruby / PHP / C# / Scala

---

## 9. 下一步行动

### 优先级 P0：把 CRG 质量事实稳定接入 workflow hooks

当前工作流应优先消费已有 hook/context 输出，而不是重新引入旧 context pack：

- `spec-first crg hook before-plan --repo . --task "<task>"`
- `spec-first crg hook before-work --repo . --plan <plan.md>` 或 `--task-pack <tasks.md>`
- `spec-first crg hook before-review --repo . --since <base>`

这些 hook 输出里的 `graph_quality`、`decision_inputs`、`recommended_queries` 都是 LLM 的 advisory 输入，不应被实现成脚本级语义路由。

### 优先级 P1：继续把 repo-local 事实底座做扎实

优先保证：

- 输入收敛可靠
- 增量构建可靠
- AST/结构事实可靠
- edge canonical 化可靠
- postprocess 与查询契约可靠
- retrieval eval fixture 能衡量 MRR、Recall@K、F1 与 token efficiency
- edge/community/flow metadata 能解释算法来源和限制

### 优先级 P2：跨角色上下文桥接

建立产品文档到代码结构的追踪链路，回答“哪个需求对应哪些模块/社区”。

### 优先级 P3：从“代码图工具”演进到“复合事实引擎”

后续应逐步把以下事实并入 CRG：

- Git 改动历史与热点文件
- 测试结果、测试映射、候选回归面
- 文档事实与需求到代码的映射
- 人工评审结论与风险标签

这样 CRG 才真正成为 spec-first 的工程事实内核，而不是只停留在 AST 图分析层。
