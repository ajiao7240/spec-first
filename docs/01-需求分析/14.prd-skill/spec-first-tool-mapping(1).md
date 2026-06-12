# spec-first 工具匹配矩阵

## 概述

spec-first 的三层架构中，能力层（Capability Layer）的 51 个 Agent 是代码知识图谱工具的核心消费者。两个工具互补，覆盖全部阶段：

| 工具 | 定位 | 更新时态 | 核心优势 |
|------|------|----------|---------|
| Graphify | 全貌审计 | 批处理 | 模块聚类、多模态、给人类看 |
| CodeGraph | 实时索引 | 增量（2s 防抖） | 调用链查询、影响分析、给 Agent 用 |

**核心原则**：同一时间窗口内只维护一个「真相源」。Graphify 和 CodeGraph 分别掌管不同阶段，不并行运行。

---

## 一、工作流阶段（Workflow Skills）

### Stage-0 Bootstrap：初始化项目上下文

| 维度 | 说明 |
|------|------|
| 核心问题 | 这个项目由什么组成？模块边界在哪？ |
| 推荐工具 | **Graphify** |
| 使用方式 | 项目初始化时一次性运行 |
| 产物 | GRAPH_REPORT.md（模块边界、God nodes、耦合热点、架构分层） |

**理由**：Bootstrap 需要全貌——不是查某个函数的调用者，而是理解整个代码库的架构。Graphify 的 Leiden 聚类自动发现模块边界，god nodes 标记核心节点，这正是 Bootstrap 所需的结构化输入。GRAPH_REPORT.md 本身即可作为新人的学习路线——模块边界 + god nodes 天然给出了阅读入口和优先级。

CodeGraph 在此阶段**不适用**——它提供的是点查询（"这个函数被谁调用"），Bootstrap 需要的是面查询（"整个系统的结构是怎样的"）。

---

### Stage-1 Ideate：发散候选、排序方向

| 维度 | 说明 |
|------|------|
| 核心问题 | 做哪个方向？当前系统的约束是什么？ |
| 推荐工具 | **Graphify**（复用 Bootstrap 产物） |
| 使用方式 | 不重跑，直接读取 GRAPH_REPORT.md |
| 关键输入 | 模块耦合度 → 判断改动成本，架构分层 → 判断影响范围 |

**理由**：Ideate 阶段不需要精确的调用链（那是 Plan 的事），需要的是**宏观判断**——"改动订单模块会牵连支付和库存，这三个方向需要一起评估"。Graphify 的模块边界已经给出了这个答案。

CodeGraph 在此阶段**过度精确**——Ideate 不需要知道具体哪个函数调用哪个函数。

---

### Stage-2 Brainstorm：澄清需求、收敛范围

| 维度 | 说明 |
|------|------|
| 核心问题 | 这个需求技术上可行吗？涉及哪些模块？ |
| 推荐工具 | **Graphify**（子图下钻） |
| 使用方式 | 基于 Ideate 选定的方向，下钻相关模块的子图 |
| 关键输入 | 涉及的模块列表 → 调用链概览 → 风险模块标记 |

**理由**：Brainstorm 需要从「方向」收敛到「范围」。Graphify 的子图下钻提供选定模块的局部视图——依赖关系、跨域关联、风险节点。如果只是查单个函数调用链，CodeGraph 更快，但 Brainstorm 需要的是模块级别的范围判断，Graphify 更合适。spec-first 自有的 Research Agents 可承担自然语言追问职责，无需外部工具。

---

### Stage-3 Plan：实施方案、拆解任务、识别风险

| 维度 | 说明 |
|------|------|
| 核心问题 | 怎么改？顺序是什么？风险在哪？ |
| 推荐工具 | **Graphify**（子图追溯）+ **CodeGraph**（调用链细节） |
| 使用方式 | Graphify 做路径规划，CodeGraph 验证具体依赖 |
| 关键输入 | 依赖路径 → 分阶段实施顺序，阻塞点标记 → 风险清单 |

**理由**：Plan 是工具重叠度最高的阶段——既需要 Graphify 的宏观路径规划（"先解耦 A 和 B，再改 C"），也需要 CodeGraph 的微观验证（"确认这个函数确实只被这三处调用"）。两者互补：

- Graphify：决定**顺序**（依赖路径 → 先改什么后改什么）
- CodeGraph：验证**细节**（调用链是否真的是 Plan 假设的那样）

---

### Stage-4 Work：按计划实现

| 维度 | 说明 |
|------|------|
| 核心问题 | 改了这行代码会影响什么？这个函数的完整调用链是什么？ |
| 推荐工具 | **CodeGraph**（唯一选择） |
| 使用方式 | Agent 实时查询调用链、影响面 |
| 约束 | 绝对禁止在此阶段运行 Graphify（批处理、图谱滞后） |

**理由**：Work 阶段三个刚性约束——**实时性**（代码改了图谱必须立刻更新）、**低延迟**（Agent 查询毫秒级）、**零 LLM 开销**（不能每次查调用链都消耗 Token）。三件事 CodeGraph 全做到，Graphify 全做不到。

**CodeGraph 在 Work 阶段的具体调用**：
- `codegraph_context`：Agent 开始改某个文件时，一次调用拿到入口点 + 关联符号 + 代码片段
- `codegraph_callers`：改函数前查"谁在调我"
- `codegraph_callees`：改函数前查"我调了谁"
- `codegraph_impact`：提交前评估变更影响面

---

### Stage-5 Review：结构化审查与质量判定

| 维度 | 说明 |
|------|------|
| 核心问题 | 实现是否符合 Plan？改动是否引入回归？ |
| 推荐工具 | **CodeGraph** |
| 使用方式 | 与 Work 阶段共用同一 CodeGraph 实例 |
| 关键输入 | 变更影响分析、调用链校验、框架路由定位 |

**理由**：Review 的本质是「Plan 预期」vs「Work 实现」的对照。CodeGraph 提供当前代码的实际调用链，与 Plan 阶段的设计对照。不需要 Graphify 的全貌分析——Review 只关心本次改动。

**CodeGraph 在 Review 阶段的具体调用**：
- `codegraph_impact`：对比 PR 前后的影响面变化
- `codegraph_callers`：确认新增/删除的函数调用链符合预期
- `codegraph_search`：快速定位 PR 涉及的文件和符号

---

### Stage-6 Compound：提炼经验、沉淀知识

| 维度 | 说明 |
|------|------|
| 核心问题 | 这次学到了什么？架构演进方向是什么？ |
| 推荐工具 | **Graphify**（历史快照对照） |
| 使用方式 | 阶段性（如每迭代周期末）运行一次 |
| 关键输入 | 本次迭代前后的模块边界变化、耦合度变化、新出现的 god nodes |

**理由**：Compound 需要的是**跨时间对比**——"迭代前模块 A 和 B 耦合度 0.7，迭代后降到 0.3"。Graphify 的 GRAPH_REPORT.md 天然适合存档对比。CodeGraph 的实时索引不支持历史快照。

---

## 二、Agent 层（Capability Layer）

spec-first 的 51 个 Agent 分为五类：Research、Design、Review、Documentation、Analysis。以下按类别匹配工具。

### Research Agents（研究类）

| Agent 类型 | 推荐工具 | 理由 |
|-----------|---------|------|
| 代码库研究 | **Graphify** | 全貌探索，依赖社区聚类发现模块 |
| 依赖分析 | **CodeGraph** | 精确追溯上下游调用链 |
| 模式发现 | **Graphify** | Leiden 聚类 + god nodes 擅长发现隐藏模式 |
| 外部调研 | 无（web_search） | 不涉及本地代码图谱 |

### Design Agents（设计类）

| Agent 类型 | 推荐工具 | 理由 |
|-----------|---------|------|
| 架构设计 | **Graphify** | 当前架构全景 → 设计方案约束 |
| 重构设计 | **Graphify**（宏观）+ **CodeGraph**（微观） | 先聚类定边界，再查调用链验证 |
| API 设计 | **CodeGraph** | 框架路由识别（13 个框架）定位已有 endpoint |
| 数据模型设计 | **CodeGraph** | 追溯数据流路径 |

### Review Agents（审查类）

| Agent 类型 | 推荐工具 | 理由 |
|-----------|---------|------|
| 结构审查 | **CodeGraph** | 实时调用链校验 |
| 规格符合性审查 | **CodeGraph** | Plan vs 实现对照 |
| 安全审查 | **CodeGraph** | 追溯敏感数据流路径 |
| 性能审查 | **CodeGraph** | 追溯热路径 |
| 代码质量审查 | 无 | 质量审查不依赖图谱 |

### Documentation Agents（文档类）

| Agent 类型 | 推荐工具 | 理由 |
|-----------|---------|------|
| 文档生成 | **Both** | Graphify 给结构概览，CodeGraph 给细节 |
| 文档审计 | **Graphify** | 多模态对照——设计文档 vs 实际代码 vs 架构图 |
| API 文档 | **CodeGraph** | 框架路由 → endpoint 清单 |

### Analysis Agents（分析类）

| Agent 类型 | 推荐工具 | 理由 |
|-----------|---------|------|
| 影响分析 | **CodeGraph** | `codegraph_impact` 原生支持 |
| 架构分析 | **Graphify** | 聚类 + 分层 + god nodes |
| 演进分析 | **Graphify** | 历史快照对比 |
| 技术债分析 | **Graphify** | 耦合热点 + 模块边界漂移 |

---

## 三、时间轴视图

```
                    Bootstrap      Ideate     Brainstorm     Plan           Work          Review      Compound
                    ─────────      ──────     ──────────     ────           ────          ──────      ────────
Graphify            ████████████   ██(读取)   ██████████     ██████                                       ██████████
(批处理)

CodeGraph                                                     ██(验证)       ████████████  ██████████
(实时增量)
```

- **实线**：主要使用者
- **虚线**：辅助使用者
- **空白**：不适用

---

## 四、集成优先级

| 优先级 | 工具 | 阶段覆盖 | 集成成本 | 即时收益 |
|--------|------|---------|---------|---------|
| **P0** | CodeGraph | Work + Review + Design(部分) | 极低（npm + MCP 挂载） | Agent 工具调用 -58%，Token -47% |
| **P1** | Graphify | Bootstrap + Ideate + Plan + Compound | 中（Python 环境 + LLM API） | PRD/Plan 质量提升，模块边界精确化 |

---

## 五、不建议集成的场景

| 工具 | 不适用场景 | 原因 |
|------|-----------|------|
| Graphify | Work 阶段 | 批处理滞后，Agent 基于过期图谱做判断会引入错误 |
| CodeGraph | Bootstrap / Ideate | 只提供点查询，无法给出全貌 |
| Graphify + CodeGraph 并行 | 任何实时编码场景 | 双重真相源——两个图谱数据可能不一致 |

---

## 六、总结

```
spec-first 技能树                    ← 工具映射

Bootstrap ────────────────→ Graphify（全貌 + 学习路线）
Ideate ───────────────────→ Graphify（读取 Bootstrap 产物）
Brainstorm ───────────────→ Graphify（子图下钻）+ Research Agents（自然语言问答）
Plan ─────────────────────→ Graphify（路径规划）+ CodeGraph（调用链验证）
Work ─────────────────────→ CodeGraph（实时查询）
Review ───────────────────→ CodeGraph（影响分析）
Compound ─────────────────→ Graphify（历史快照对比）
```

**关键约束**：Graphify 和 CodeGraph 不在同一时间窗口并行运行。前者用于「停下来看全貌」（Bootstrap → Plan），后者用于「边改边查」（Work → Review）。两者在同一份分析成果上接力，不冲突。

---

## 附录：为什么不需要 Understand Anything

决策基于对话轮次 79 的移出分析。Understand Anything 的四个核心能力均有替代方案：

| 能力 | Understand Anything 实现 | 替代方案 | 替代可行性 |
|------|-------------------------|---------|-----------|
| Business Logic View | Domain→Flow→Step 三层映射 | Graphify Leiden 聚类 + LLM 语义标签 | Graphify 的模块聚类天然给出业务边界，LLM 语义标签可自动生成业务域描述 |
| Onboarding 学习路线 | `/understand-onboard` 依赖顺序 | GRAPH_REPORT.md | god nodes → 核心入口，模块边界 → 阅读范围，耦合度 → 阅读优先级 |
| 自然语言问答 | `/understand-chat` | spec-first Research Agents | 自有 Agent 在模块边界上下文中问答，结果更精准 |
| 变更影响分析 | `/understand-diff` | CodeGraph `codegraph_impact` | 实时、零 LLM 开销，比批处理 diff 更准确 |

结论：双轨（Graphify + CodeGraph）即可覆盖 spec-first 全部 7 个阶段，无刚需缺口。
*（内容由AI生成，仅供参考）*
