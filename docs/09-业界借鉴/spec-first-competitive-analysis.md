---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a88644969371398a873cabeac0a028ab_f0dda9ec61d211f19f62525400d9a7a1
    ReservedCode1: o5+SmKUS6/2ttAMF7pP/VXlnvbPemyCaLtdlVeNhoD9woq5jzdTRAXcaYi/3JtrMEeQD7t0GJT8T8rtuSocrsZGMbQ2GdVvzQy8GYbidt1a8nLH3sMfj7ZfGAxx/cYE+0RzfqUWbRYA4wNaxtkCkOpracAug5pg9usQnoDz/lZ0OfEZwzd5so5kiMMw=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a88644969371398a873cabeac0a028ab_f0dda9ec61d211f19f62525400d9a7a1
    ReservedCode2: o5+SmKUS6/2ttAMF7pP/VXlnvbPemyCaLtdlVeNhoD9woq5jzdTRAXcaYi/3JtrMEeQD7t0GJT8T8rtuSocrsZGMbQ2GdVvzQy8GYbidt1a8nLH3sMfj7ZfGAxx/cYE+0RzfqUWbRYA4wNaxtkCkOpracAug5pg9usQnoDz/lZ0OfEZwzd5so5kiMMw=
---

# Spec-First 竞品深度对标分析报告

> 基于 [awesome-agent-harness](https://github.com/Picrew/awesome-agent-harness) 57 个开源项目的全景扫描与深度调研
> 
> 分析视角：Spec-First 项目技术架构师
> 
> 日期：2026-06-07

---

## 一、执行摘要

Agent Harness 生态正在经历一场静默的范式转移：从"AI 直接写代码"向"AI 先做规格、再做实现、再做验证"的 **Spec-First** 模式演进。本次调研覆盖 57 个项目，深度聚焦其中 8 个与 Spec-First 理念最相关的标杆项目。

**核心发现**：当前市场上没有任何一个项目完整实现了"规格驱动全链路闭环"——各个环节（需求澄清、规格生成、计划编排、执行隔离、质量门禁、知识沉淀）被不同项目片段化地实现，存在巨大的整合与升级空间。

**Spec-First 的迭代方向应聚焦于三个战略层级**：
- **P0（差异化壁垒）**：规格形式化验证引擎 + 双向可追溯性
- **P1（工程化完备）**：Worktree 隔离执行 + 分阶段质量门禁 + 规格版本管理
- **P2（生态化扩展）**：规格复用市场 + 多 Agent 规格协同 + 规格驱动的持续集成

---

## 二、Agent Harness 生态全景图谱

### 2.1 项目分类矩阵

| 类别 | 数量 | 代表项目 | 与 Spec-First 相关度 |
|------|------|----------|---------------------|
| 编码代理（Coding Agent） | 18 | Claude Code, OpenCode, Codex CLI, aider, Qwen Code, Cline | ★★★★ |
| Agent Harness 运行时 | 12 | OpenClaw, CowAgent, ZeroClaw, IronClaw, nanobot | ★★★ |
| 多 Agent 编排 | 8 | oh-my-claudecode, Superset, 1Code, Maestro, Vibe Kanban | ★★★★★ |
| Worktree 隔离执行 | 6 | Superset, oh-my-claudecode, 1Code, Compound Engineering | ★★★★★ |
| 浏览器代理 | 4 | Browser Use, Agent TARS, Webwright | ★ |
| 桌面代理 | 5 | cmux, OSAURUS, holaOS, Open Cowork | ★★ |
| 工作流/方法论 | 4 | AI-DLC, Compound Engineering, AI-DLC Workflows | ★★★★★ |

### 2.2 Spec-First 相关度热力分布

```
Spec-First 理念成熟度（规格 → 计划 → 执行 → 验证 → 沉淀）

Compound Engineering  ████████████████████░  90%
AI-DLC (AWS)         ██████████████████░░░  85%
oh-my-claudecode     ████████████████░░░░░  75%
Vibe Kanban          ██████████████░░░░░░░  65%
OpenCode             ████████████░░░░░░░░░  55%
oh-my-codex          ████████████░░░░░░░░░  55%
Superset             ████████░░░░░░░░░░░░░  35%
Maestro              ████████░░░░░░░░░░░░░  35%
```

---

## 三、关键标杆项目深度剖析

### 3.1 Compound Engineering — 最完整的 Spec-First 参考实现

**核心理念**："80% 在规划和评审，20% 在执行。每个工程单元都应让后续单元更简单。"

**完整工作流**：

```
/ce-strategy    → STRATEGY.md（产品战略锚点）
      ↓
/ce-ideate      → 大规模创意生成与批判性评估
      ↓
/ce-brainstorm  → 交互式需求澄清，产出需求文档
      ↓
/ce-plan        → 从需求文档生成详细实现计划
      ↓
/ce-work        → Worktree 隔离执行 + 任务追踪
      ↓
/ce-code-review → 多 Agent 代码评审
      ↓
/ce-compound    → 知识沉淀，使未来工作更容易
      ↓
/ce-product-pulse → 产品脉搏报告（数据反馈闭环）
```

**37 个 Skills + 51 个 Agents** 的庞大组件体系。

**关键设计洞察**：
1. **战略锚点是规格的根**：`STRATEGY.md` 作为上游约束，向下渗透到 brainstorm 和 plan 阶段
2. **Brainstorm 是交互式而非一次性**：通过 Q&A 确保需求理解的深度
3. **Compound 是知识复利**：每次学到的教训被编码为可复用的知识，下次 Agent 不需要从头学习
4. **Product Pulse 是反馈闭环**：将线上数据回流到下一个规划周期

**对 Spec-First 的启示**：Compound Engineering 是目前最接近"完整 Spec-First 闭环"的实现，但缺失了**规格形式化验证**（需求文档没有机器可执行的约束检查）和**规格-代码双向追溯**。

---

### 3.2 AI-DLC (AWS) — 企业级方法论框架

**核心理念**："AI 作为中心协作者，通过三个阶段——Inception → Construction → Operations——系统化地驱动软件开发。"

**三阶段模型**：

| 阶段 | AI 职责 | 人类职责 | 产出物 |
|------|---------|----------|--------|
| Inception（启始） | 将业务意图转化为详细需求、Story、Unit | Mob Elaboration：团队验证 AI 的提问和提案 | 需求文档、User Story、验收标准 |
| Construction（构建） | 提出逻辑架构、领域模型、代码方案、测试 | Mob Construction：技术决策和架构选择 | 架构文档、代码、测试套件 |
| Operations（运维） | 管理 IaC 和部署 | 团队监督 | 部署配置、监控 |

**关键创新**：
1. **"Bolt" 替代 Sprint**：以小时/天为单位的短周期，而非周
2. **AI 主动寻求澄清**：AI 不是被动接受指令，而是通过提问获取上下文
3. **上下文累积**：每个阶段的上下文持久化到仓库，为下一阶段提供更丰富的输入
4. **Mob 协作模式**：团队实时参与 AI 的提问和提案，而非事后评审

**对 Spec-First 的启示**：AI-DLC 提供了**方法论层面的框架**，但具体实现依赖外部工具（Kiro Steering Files、Cursor Rules、CLAUDE.md 等），缺乏原生的规格引擎。其 "AI 主动提问 → 人类决策 → AI 执行" 的交互模式是 Spec-First 应内置的核心交互范式。

---

### 3.3 oh-my-claudecode — 多 Agent 编排的 Spec 实践

**核心工作流**：

```
/deep-interview           → 苏格拉底式需求澄清
      ↓
/ralplan                  → 迭代式规划共识
      ↓
/team 3:executor "..."    → Team 流水线：team-plan → team-prd → team-exec → team-verify → team-fix
      ↓
/ce-code-review 等效      → 多 Agent 评审
      ↓
/skillify                 → 知识提取与复用
```

**19 个专业化 Agent**，支持智能模型路由（Haiku 做简单任务，Opus 做复杂推理）。

**Spec-First 相关亮点**：
1. **Deep Interview**：通过 Socratic 提问暴露隐藏假设，量化需求清晰度
2. **Team 流水线自带 plan → prd → exec → verify → fix 闭环**
3. **Skill 系统**：将调试知识编码为可移植的技能文件，自动注入
4. **Ultragoal**：持久化目标/检查点/证据，不需要启动额外循环

**对 Spec-First 的启示**：oh-my-claudecode 证明了**多 Agent 编排 + 规格驱动可以无缝结合**。其 Deep Interview 是需求澄清的最佳实践，但生成的 PRD 仍然是纯文本，缺乏结构化/形式化约束。

---

### 3.4 Vibe Kanban + Superset — Worktree 隔离执行范式

**Vibe Kanban**：
- Kanban 看板作为"规格管理平面"：创建、优先级排序、分配 Issue
- Workspace 作为"隔离执行平面"：每个 Workspace 有独立分支、终端、Dev Server
- 内置 Diff 审查 + 行级评论
- 支持 10+ 编码代理

**Superset**：
- 纯 Worktree 编排：并行运行多个 CLI 编码代理
- 内置终端 + Diff 查看器
- Workspace 预设（自动化环境搭建）

**对 Spec-First 的启示**：这两个项目解决了 Spec-First 的**执行隔离问题**——每个 Spec 应该在独立的 Worktree 中执行，避免相互干扰，且执行结果可独立审查。这是 Spec-First 工程化落地的基础设施。

---

### 3.5 OpenCode — 内置 Plan/Build 角色分离

**核心设计**：
- `plan` Agent：只读，用于分析和代码探索，拒绝文件编辑，运行命令需授权
- `build` Agent：全权限开发
- `Tab` 键切换

**对 Spec-First 的启示**：Plan 角色是 Spec-First 的天然载体。但 OpenCode 的 Plan 角色聚焦于"代码探索"而非"规格生成"，缺少从需求到计划的转化能力。

---

## 四、Spec-First 能力差距矩阵

以"理想 Spec-First 系统"为基准，横评各项目的能力覆盖：

| 能力维度 | Compound Eng. | AI-DLC | oh-my-cc | Vibe Kanban | OpenCode | Superset | Spec-First 理想态 |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **需求澄清** | ★★★★ | ★★★★ | ★★★★★ | ★★★ | ★ | ★ | 交互式 Q&A + 自动检测模糊点 |
| **规格生成** | ★★★★ | ★★★★ | ★★★ | ★★★ | ★★ | ★ | 结构化、可验证的规格文档 |
| **规格形式化验证** | ★ | ★ | ★ | ★ | ★ | ★ | **自动化约束检查、类型验证** |
| **计划编排** | ★★★★★ | ★★★★ | ★★★★ | ★★★ | ★★ | ★ | 自动拆解 + 依赖分析 |
| **执行隔离** | ★★★★ | ★ | ★★★ | ★★★★★ | ★ | ★★★★★ | Git Worktree + 沙箱 |
| **代码生成** | ★★★★ | ★★★★ | ★★★★ | ★★★★ | ★★★★ | ★★★★ | Agent 自主编码 |
| **质量门禁** | ★★★★ | ★★★★ | ★★★★ | ★★★ | ★★ | ★ | 自动 Lint/Test/Build/Review |
| **人工评审** | ★★★★ | ★★★★ | ★★★ | ★★★★★ | ★★ | ★★★ | Diff 审查 + 行级评论 |
| **双向追溯** | ★ | ★★ | ★ | ★ | ★ | ★ | **Spec ↔ Code ↔ Test 全链路** |
| **知识沉淀** | ★★★★★ | ★★ | ★★★★★ | ★ | ★ | ★ | 自动提取可复用模式 |
| **反馈闭环** | ★★★★★ | ★★★ | ★★★ | ★★ | ★ | ★ | 线上数据回流到规划 |
| **多 Agent 协同** | ★★★★ | ★★ | ★★★★★ | ★★★★ | ★★ | ★★★★★ | 专业 Agent 分工 |
| **规格版本管理** | ★★ | ★★ | ★ | ★★ | ★ | ★ | **Spec 的 Git 化版本演进** |

> ★ = 基本缺失  ★★ = 有概念但未实现  ★★★ = 部分实现  ★★★★ = 较好实现  ★★★★★ = 业界最佳

---

## 五、Spec-First 迭代升级路线图

### 5.1 战略定位

**Spec-First 的核心竞争力公式**：

```
Spec-First Value = 规格质量 × 执行效率 × 验证覆盖度 × 知识复用率
```

当前市场各项目分散地解决了公式中的部分因子，但没有一个项目把四个因子系统化地串联起来。

### 5.2 P0 级迭代方向（差异化壁垒，立即启动）

#### P0-1：规格形式化验证引擎

**现状痛点**：所有项目的"规格"都是纯文本（Markdown），Agent 执行时依赖 LLM 自行理解，没有机器可执行的约束检查。

**目标方案**：
```
需求规格 → 结构化 Schema（JSON Schema / TypeSpec）→ 自动验证
```

具体能力：
- **需求完整性检查**：自动检测规格中的模糊词汇（"大概"、"可能"、"尽量"）和缺失字段
- **需求一致性验证**：交叉检查多个需求之间是否存在逻辑冲突
- **验收标准可测试化**：将自然语言验收标准自动转化为可执行的测试骨架
- **需求覆盖度分析**：执行后自动比对代码变更与规格条款，输出覆盖率报告

**对标参考**：TypeSpec（API 规格语言）、Gherkin（BDD 场景）、OpenAPI Spec

#### P0-2：Spec ↔ Code ↔ Test 双向追溯链路

**现状痛点**：规格、代码、测试三者完全割裂。需求变更时无法评估影响范围，代码变更时无法确认是否仍然满足规格。

**目标方案**：
```
Spec Item #42 "用户登录超时限制"
  ├── Code: auth/session.go:120-145
  ├── Test: auth/session_test.go:30-55
  └── Status: ✅ Verified (2026-06-07)
```

具体能力：
- **Spec 到 Code 的正向追溯**：每个规格条目关联到具体的代码文件和行号
- **Code 到 Spec 的反向追溯**：任意代码变更自动关联到对应规格条目
- **影响分析**：修改一条 Spec，自动列出所有受影响的代码和测试
- **覆盖度仪表盘**：实时展示 Spec 的代码覆盖率和测试覆盖率

### 5.3 P1 级迭代方向（工程化完备，Q3-Q4 重点）

#### P1-1：Worktree 原生的规格隔离执行

**对标**：Superset + Vibe Kanban + Compound Engineering `/ce-work`

**目标方案**：
```
用户创建 Spec → 自动创建 Git Worktree → Agent 在隔离环境执行 → 产出 Diff → 人工审查 → 合并
```

- 每个 Spec 自动分配独立的 Git Worktree
- 支持并行执行多个 Spec（如 Superset 的 10+ Agent 并行）
- 内置 Dev Server / Preview 环境
- 执行完成后自动生成 Diff 供审查

#### P1-2：分阶段质量门禁系统

**对标**：AI-DLC 三阶段模型 + Compound Engineering 的 Review 闭环 + UltraQA 质量循环

**目标方案**：
```
Inception Gate（需求质量）  →  Construction Gate（代码质量）  →  Operations Gate（部署质量）
  ├─ 完整性检查              ├─ Lint/Test/Build 通过          ├─ 部署检查
  ├─ 一致性验证              ├─ 多 Agent Code Review          ├─ 监控指标
  └─ 验收标准明确            └─ 安全扫描                      └─ 回滚预案
```

- 每个 Gate 不通过则阻断后续阶段
- 门禁规则可配置（项目级 / 组织级）
- 失败自动诊断 + 修复建议 + 自动重试

#### P1-3：规格版本管理与演进

**对标**：Git 版本控制 + Compound Engineering 的 Compound 知识沉淀

**目标方案**：
- Spec 的 Git 化版本管理（diff / blame / log / tag）
- 需求变更时自动 diff 新旧 Spec，评估影响范围
- Spec 演进历史可视化
- 支持 Spec 分支（实验性需求 vs 主线路需求）

### 5.4 P2 级迭代方向（生态化扩展，明年规划）

#### P2-1：规格复用市场

**对标**：CowAgent Skill Hub + oh-my-claudecode Skill 系统

**目标方案**：
- 常见业务场景的 Spec 模板库（用户认证、支付、通知、权限管理等）
- 社区贡献 + 评分机制
- 一键导入并适配到当前项目上下文

#### P2-2：多 Agent 规格协同

**对标**：oh-my-claudecode Team 模式 + HiClaw 协作式多 Agent

**目标方案**：
- 大型 Spec 自动拆解为子 Spec，分配给不同专业 Agent
- 子 Spec 之间的依赖管理和结果聚合
- 人在回路监督 + 冲突仲裁

#### P2-3：规格驱动的 CI/CD 集成

**对标**：AI-DLC Operations 阶段 + Agent Orchestrator

**目标方案**：
- PR 自动关联 Spec，CI 检查 Spec 状态
- Spec 未通过验收的代码禁止合并
- 部署后自动验证 Spec 达成情况

---

## 六、竞争格局与 Spec-First 的独特定位

### 6.1 市场空白分析

| 竞争方向 | 已有玩家 | Spec-First 的机会 |
|----------|----------|-------------------|
| 编码代理本体 | Claude Code, Codex, Cline, OpenCode, aider... | **不做编码代理，做规格层** |
| Agent 编排 | oh-my-claudecode, Superset, Maestro, Vibe Kanban | **不做通用编排，做规格驱动的编排** |
| 工作流方法论 | AI-DLC, Compound Engineering | **不做方法论，做方法论的可执行引擎** |
| Worktree 隔离 | Superset, Vibe Kanban, 1Code | **不做通用隔离，做规格感知的隔离** |

**Spec-First 的独特定位**：**规格驱动的开发编排层**——不在编码 Agent 层面竞争，而在"编码之前和编码之后"的价值链上建立壁垒。

### 6.2 战略建议：三圈层架构

```
        ┌──────────────────────────────────┐
        │        生态层（P2）               │
        │  Spec 模板市场 / CI 集成 / 多Agent │
        │  ┌────────────────────────────┐   │
        │  │     工程层（P1）            │   │
        │  │  Worktree 隔离 / 质量门禁   │   │
        │  │  / 版本管理 / 审查协作      │   │
        │  │  ┌──────────────────────┐  │   │
        │  │  │   核心层（P0）        │  │   │
        │  │  │  Spec 形式化引擎     │  │   │
        │  │  │  双向追溯链路        │  │   │
        │  │  └──────────────────────┘  │   │
        │  └────────────────────────────┘   │
        └──────────────────────────────────┘
```

**核心层**（必须自研）：规格形式化引擎 + 追溯链路 → **这是护城河**

**工程层**（部分自研 + 集成）：可深度集成 Superset 的 Worktree 能力、复用 AI-DLC 的门禁理念

**生态层**（开放平台）：通过 Plugin/MCP 协议对接各类编码 Agent，构建开放生态

---

## 七、行动计划建议

| 时间 | 里程碑 | 关键产出 | 风险 |
|------|--------|----------|------|
| **Week 1-2** | P0-1 规格 Schema 原型 | JSON Schema 格式的 Spec 定义 + 基础验证器 | 格式设计过重导致 Agent 难以生成 |
| **Week 3-4** | P0-1 模糊检测引擎 | 自动识别 Spec 中 10+ 类模糊表述 | 中文 NLP 准确性 |
| **Week 5-6** | P0-2 追溯链路 MVP | Spec Item → Code 文件级关联 + 覆盖度 Dashboard | 需要侵入编码 Agent 的工具调用 |
| **Week 7-8** | P1-1 Worktree 集成 | 对接 Git Worktree，Spec → 自动创建隔离环境 | 多 Worktree 资源占用 |
| **Week 9-10** | P1-2 首个质量门禁 | Inception Gate（需求完整性 + 一致性） | 门禁过严导致流程阻塞 |
| **Week 11-12** | 内测发布 | 端到端可用 + 文档 + 2 个标杆案例 | 与现有编码 Agent 的兼容性 |

---

## 附录 A：调研项目完整清单

| 项目 | 核心能力 | Spec-First 相关特性 |
|------|----------|---------------------|
| [Compound Engineering](https://github.com/EveryInc/compound-engineering-plugin) | 完整工程循环 | Strategy → Brainstorm → Plan → Work → Review → Compound |
| [AI-DLC Workflows](https://github.com/awslabs/aidlc-workflows) | 工作流规则引擎 | Inception → Construction → Operations 三阶段 + 质量门禁 |
| [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) | 多 Agent 编排 | Deep Interview + Team Pipeline + Skill 系统 |
| [Vibe Kanban](https://github.com/BloopAI/vibe-kanban) | Kanban 工作台 | Kanban 规划 + Worktree 隔离 + Diff 审查 |
| [Superset](https://github.com/superset-sh/superset) | Worktree 编排器 | 并行 Worktree + 内置 Terminal + Diff Viewer |
| [OpenCode](https://github.com/anomalyco/opencode) | 开源编码代理 | Plan/Build 角色分离 |
| [CowAgent](https://github.com/zhayujie/CowAgent) | Agent Harness 参考实现 | Planning + 三层记忆 + Skill Hub |
| [OpenClaw](https://github.com/openclaw/openclaw) | 个人助手 Gateway | 会话管理 + 通道 + 沙箱 |
| [oh-my-codex](https://github.com/Yeachan-Heo/oh-my-codex) | Codex 工作流层 | 澄清→完成的标准流程 + 持久状态 |
| [1Code](https://github.com/21st-dev/1code) | 桌面编排器 | Worktree 隔离 + MCP 工具管理 + 自动化触发 |
| [Maestro](https://github.com/RunMaestro/Maestro) | 并行编排指挥台 | Worktree 隔离 + 任务队列 + Playbook |
| [OpenHands](https://github.com/OpenHands/OpenHands) | 软件工程代理 | 仓库级编码任务 |
| [aider](https://github.com/Aider-AI/aider) | 终端编码助手 | Repo Map + Git 感知编辑 + Lint/Test 反馈 |
| [Claude Code](https://github.com/anthropics/claude-code) | 官方终端编码代理 | Git 工作流 + 自然语言编辑 |
| [ZeroClaw](https://github.com/zeroclaw-labs/zeroclaw) | 安全 Agent Runtime | SOP + 审批门禁 + 沙箱 |
| [IronClaw](https://github.com/nearai/ironclaw) | 安全优先 Harness | WASM 沙箱 + 例程调度 |
| [NanoClaw](https://github.com/qwibitai/nanoclaw) | 容器隔离 Harness | 定时任务 + 按群组隔离记忆 |

## 附录 B：关键术语对照

| 术语 | 定义 | 来源 |
|------|------|------|
| Spec-First | 先规格后实现，规格驱动全链路 | 本报告 |
| Compound Engineering | 工程复利：每次工程单元让后续更简单 | Every Inc. |
| Bolt | AI-DLC 中的短周期工作单元（替代 Sprint） | AWS AI-DLC |
| Mob Elaboration | 团队实时参与 AI 需求澄清 | AWS AI-DLC |
| Worktree | Git 工作树，用于隔离并行开发环境 | Git |
| Deep Dream | 夜间自动蒸馏记忆为长期条目 | CowAgent |
| Socratic Interview | 通过提问暴露假设的需求澄清方法 | oh-my-claudecode |
*（内容由AI生成，仅供参考）*
