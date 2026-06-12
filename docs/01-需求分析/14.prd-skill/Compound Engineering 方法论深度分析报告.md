---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a88644969371398a873cabeac0a028ab_7212c3ef660f11f1835c5254002906a7
    ReservedCode1: ujQU688fZ2QqKlDZtZLQUgl3DRz6cJaJzxL8PO5HjeSIp6v6x9hsGDyNWlfj5zMaRGrU7lG++RODlFMIi4nrDT1QZPyJ7+7UdxXngEC5gsJc3wzlUWvigTCYPecgLVR+b8Zcs12Uer5hHVApu2+G8gezAfpv4f0TtsN6CfTfRT1aL44c0W8F/1ov068=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a88644969371398a873cabeac0a028ab_7212c3ef660f11f1835c5254002906a7
    ReservedCode2: ujQU688fZ2QqKlDZtZLQUgl3DRz6cJaJzxL8PO5HjeSIp6v6x9hsGDyNWlfj5zMaRGrU7lG++RODlFMIi4nrDT1QZPyJ7+7UdxXngEC5gsJc3wzlUWvigTCYPecgLVR+b8Zcs12Uer5hHVApu2+G8gezAfpv4f0TtsN6CfTfRT1aL44c0W8F/1ov068=
---


# Compound Engineering 方法论深度分析

> 基于 EveryInc/compound-engineering-plugin（37 个 Skills + 51 个 Agents）的系统分析
> 核心命题：80% 规划 + 20% 执行的 AI Agent 工程方法论
> 分析日期：2026-06-12
> 对照基线：spec-first v1.10.0（51 个 Agent + 37 个 Skill）
> 知识链：串联 experience-depositor / Harness 经验进化 / 六层反馈沉淀 / L4 多 Agent 编排 / design.md 文档链

---

## 目录

1. [Compound Engineering 方法论文本](#第-1-章compound-engineering-方法论文本)
2. [工作流闭环全景](#第-2-章工作流闭环全景)
3. [跨平台架构分析](#第-3-章跨平台架构分析)
4. [与 spec-first 的全景对照](#第-4-章与-spec-first-的全景对照)
5. [与前序知识链收束](#第-5-章与前序知识链收束)
6. [核心启示提炼](#第-6-章核心启示提炼)
7. [分级改进建议](#第-7-章分级改进建议)

---

# 第 1 章：Compound Engineering 方法论文本

## 1.1 核心命题：翻转技术债逻辑

Compound Engineering 的根本论断用一句话表达：

> **每次工程工作都应该让下一次更简单，而不是更难。**

传统软件工程中，技术债的积累是线性的——每个功能增加复杂度，每个 bug 修复留下只有当事人懂的隐性知识。Compound Engineering 翻转了这一逻辑：通过有意识的规划、审查和知识沉淀，让每次工作都成为下一次的**杠杆支点**。

这个命题的论证不需要理论推导，而是由四项可执行动作构成闭环：

```
┌──────────────────────────────────────────────────────┐
│  规划透彻         严格审查        知识编码        保持高质量  │
│  /ce-brainstorm → /ce-code-review → /ce-compound → （循环） │
└──────────────────────────────────────────────────────┘
```

## 1.2 80/20 法则：从直觉反转到工程论证

Compound Engineering 的 80/20 法则不是口号的包装，而是从 AI 生产力特性推导出的工程策略：

| 维度 | 传统直觉 | Compound Engineering 论证 | 工程依据 |
|------|---------|------------------------|---------|
| **认知负荷分配** | 让 AI 尽快写代码，人审代码 | 脑暴+计划占 80% 精力，执行只占 20% | AI 写代码快但做决策弱——快对于错误方向是加速器 |
| **AI 能力利用** | AI 的核心价值是生成代码 | AI 被严重低估的使用方式是先想清楚再写 | 多数人在"快"的阶段停止，忽略"对"的阶段 |
| **错误成本结构** | 代码写错了改就是 | 方向错导致的批量代码返工成本远高于单次 bug 修复 | 越晚发现方向错误，返工代价指数增长 |
| **知识积累机制** | 经验留在开发者脑子里 | 知识必须编码为可被下一个 Agent 消费的产物 | 人脑经验的衰减速度与团队轮换速度成正比 |

**关键论证链**：

1. AI 写代码的边际成本极低——让 AI 写 100 行和 1000 行的成本差异远小于人类工程师。
2. 但 AI 做"方向性判断"的能力弱于人类——它倾向于"使代码看起来合理"而非"做正确的架构决策"。
3. 因此，把 AI 的精力分配在"执行"上（它能做且做得快），把人类的精力分配在"规划"上（人能做且做得对），才是最优人机分工。
4. 执行前的规划（脑暴、计划）占 80% 精力，不是让人类更累，而是让执行更短——好的计划让执行量更小，而不是更快地执行大量计划外代码。

> **好的脑暴让计划更精确，好的计划让执行量更小，好的审查抓的是模式而不只是 bug，好的 compound 笔记让下一个 Agent 不用从零开始学同一个教训。**

## 1.3 四条核心原则的杠杆效应论证

### 原则一：规划 80%，执行 20%

**杠杆机制**：规划的投入产出不是线性的，而是呈幂律分布。一个小时的深度规划可以消除 8 小时的错误执行。这不是主观意愿问题，而是 AI 的认知特性决定的——AI 在缺乏方向约束时会用"看起来合理"的代码填充不确定性，这些代码在后续审查中被发现、回滚、重写的成本是指数级的。

### 原则二：审查找模式而非找 bug

**杠杆机制**：单个 bug 的修复成本固定，但模式性错误会递归产生同类 bug。如果审查只抓 bug 不抓模式，下一个 Agent 会犯同样的错误。/ce-code-review 用多 Agent 并行审查来提升模式发现概率——不同 Agent 有不同的审查视角，模式性错误在多个视角下更容易暴露。

### 原则三：知识沉淀是杠杆支点

**杠杆机制**：/ce-compound 是闭环中回报最高的单步动作。如果没有这一步，每个 Agent 每次从零学起，团队的知识随时间稀释。有了它，知识随时间累积——效率提升的曲线从衰减变成复利。在数学上：不沉淀的团队效率 ≈ O(1/n)，沉淀的团队效率 ≈ O(log n)。

### 原则四：策略锚点是方向保证

**杠杆机制**：STRATEGY.md 确保每次脑暴和计划朝同一产品目标前进。多个 Agent 并行开发的场景下，没有策略锚点会导致各 Agent 往不同方向拉——一个做性能优化，一个做新功能，一个做重构，三者互不协调。锚点把分散的 Agent 行为对齐到统一产品目标。

## 1.4 方法论的独特性：与其他 AI 工程方法的差异

Compound Engineering 的独特性在于它**不关注"AI 写什么代码"而关注"AI 该怎么参与工程工作"**：

| 对比维度 | Prompt Engineering | Agent 框架（如 LangChain） | Compound Engineering |
|---------|-------------------|-------------------------|---------------------|
| 关注层次 | 单次对话质量 | Agent 工具调用编排 | 工程工作的长期累积效应 |
| 时间尺度 | 当前对话 | 当前任务 | 跨任务、跨 Agent、跨版本 |
| 核心机制 | 提示词优化 | 工具链 + 内存 | 规划→执行→审查→沉淀闭环 |
| 知识处理 | 不处理 | 短期记忆 | 长期知识累积（/ce-compound） |
| 团队维度 | 个人提效 | 单 Agent 提效 | 多 Agent 协作的知识杠杆 |

---

# 第 2 章：工作流闭环全景

## 2.1 上游锚点层：STRATEGY.md 与 /ce-ideate

### 2.1.1 STRATEGY.md 的定位

STRATEGY.md 是 Compound Engineering 的"北极星"。它不是一个普通文档，而是**所有下游 Agent 行为的约束锚点**：

| 维度 | 内容 | 下游 Agent 如何消费 |
|------|------|-------------------|
| 产品目标 | 要解决什么问题、为谁解决 | /ce-brainstorm 生成的想法必须对焦此目标 |
| 方法 | 技术栈选择、架构约束 | /ce-plan 的方案设计受此约束 |
| 用户画像 | 目标用户特征、使用场景 | /ce-brainstorm 评估想法时对照用户价值 |
| 关键指标 | 成功度量标准 | /ce-product-pulse 的报告框架由此定义 |

**与 spec-first / PRD 的区别**：STRATEGY.md 更接近"产品宪法"而非"功能需求文档"。它回答的不是"这次做什么"，而是"什么是符合我们方向的事"。这种定位决定了它不会像 PRD 一样随需求变化频繁修改，而是作为常量约束所有变量。

### 2.1.2 /ce-ideate：可选的发散探索

/ce-ideate 是一个独立的可选步骤，在大方向不明确时执行。其工作流程是：

```
多想法生成 → 批判性评估 → 选出最强想法 → 进入脑暴
```

**与 /ce-brainstorm 的区别**：/ce-ideate 是发散收敛（多→一），/ce-brainstorm 是深度聚焦（一→深入）。

**这个步骤的存在揭示了 Compound Engineering 的一个重要设计理念**：在产品方向模糊的阶段，不跳过评估直接进入实现。这对应了五级能力模型中 L4 AI Tech Lead 的"方案比较"职责——Architect Agent 的职能上移到产品层面。

## 2.2 核心循环层：Brainstorm → Plan → Work → Debug → Code Review → Compound

### 2.2.1 循环的全景结构

```
  ┌───────────────────────────────────────────────┐
  │                                                │
  ▼                                                │
/ce-brainstorm  ──→  /ce-plan  ──→  /ce-work      │
  │                     │             │            │
  │                     │             ▼            │
  │                     │        /ce-debug ←──┐    │
  │                     │             │        │    │
  │                     │             ▼        │    │
  │                     └──→  /ce-code-review ─┘    │
  │                                  │              │
  │                                  ▼              │
  └──────────── /ce-compound ←────────┘              │
                                                      │
  /ce-strategy ──────────────────────────────────────┘
```

### 2.2.2 各节点的职责边界与信息流向

| 节点 | 输入 | 输出 | 负责的 Agent 类型 | 关键约束 |
|------|------|------|-----------------|---------|
| /ce-brainstorm | 一句话想法 + STRATEGY.md | docs/brainstorms/*.md | 脑暴 Agent | 必须对照 STRATEGY.md 验证方向一致性 |
| /ce-plan | 脑暴文档 | 实施计划 | 规划 Agent | 计划必须具备"可执行"粒度，不只"做什么"还有"怎么做" |
| /ce-work | 实施计划 | 代码变更 | 执行 Agent(s) | 严格按计划执行，不做计划外变更 |
| /ce-debug | Bug 描述 + 代码库 | Bug 修复 | 调试 Agent | 修复完成后必须走 /ce-code-review |
| /ce-code-review | 代码变更 | 审查报告 | 多个审查 Agent（并行） | 抓模式性错误而非单次 bug |
| /ce-compound | 审查报告 + 执行经验 | 知识沉淀 | 沉淀 Agent | 必须结构化为可被下一个 Agent 消费的格式 |

### 2.2.3 循环的"浪费最小化"设计

这个循环有三个精心设计的防浪费机制：

1. **/ce-brainstorm 前置**：不直接进入计划，因为计划成本高于脑暴。脑暴用低成本探索方向正确性，方向错了进入计划是对精细规划资源的浪费。

2. **/ce-plan 与 /ce-work 的严格分工**：计划阶段不做代码，执行阶段不偏离计划。这防止了"边做边改方向"的隐性返工——传统开发中工程师经常在执行到一半时发现方向问题，但已经投入的代码成为沉默成本，导致"补丁式修复"而非回退重来。

3. **/ce-compound 作为必选步骤**：如果代码审查后不沉淀就进入下一个循环，相当于每次从零开始。Compound Engineering 把沉淀设计为循环的**必然终点**而非可选附件——没有沉淀的循环不是完成态。

## 2.3 下游反馈层：/ce-product-pulse

/ce-product-pulse（产品脉搏报告）是循环之外的反馈层，其独立存在揭示了 Compound Engineering 的一个关键设计原则：**工程反馈（code-review/compound）和产品反馈（pulse）是两条独立的反馈线**。

| 维度 | /ce-code-review + /ce-compound | /ce-product-pulse |
|------|------------------------------|-------------------|
| 反馈类型 | 工程质量反馈 | 产品效果反馈 |
| 时间窗口 | 每次代码变更 | 周期性（时间窗口内汇总） |
| 关心什么 | 代码对不对 | 产品好不好 |
| 成果落点 | 知识沉淀为 Agent 可消费格式 | docs/pulse-reports/ 可浏览时间线 |
| 消费方 | 下一个 Agent | 人和产品决策者 |
| 指标 | 模式性错误、代码质量 | 用量、性能、错误率、后续行动建议 |

**这个双层反馈结构对应了 AI Coding 六层架构中"评价指标层"的双指标设计**——交付指标（PR 周期、Bug 率）和产品指标（用量、性能）分属不同反馈线，不会互相混淆。

---

# 第 3 章：跨平台架构分析

## 3.1 10 平台安装矩阵

Compound Engineering 支持 10 个 AI Coding 平台，安装方式分为两类：

### 3.1.1 原生平台（一键安装）

| 平台 | 安装命令 | 安装复杂度 | 说明 |
|------|---------|-----------|------|
| Claude Code | `/plugin marketplace add` | 1 步 | 最简安装路径 |
| Cursor | `/add-plugin compound-engineering` | 1 步 | Cursor slash 命令体系 |
| GitHub Copilot | `copilot plugin install` | 1 步 | VS Code 命令面板或 CLI |
| Factory Droid | `droid plugin marketplace add` | 1 步 | Droid CLI |
| Qwen Code | `qwen extensions install` | 1 步 | Qwen CLI |

### 3.1.2 转换器平台（通用安装）

| 平台 | 安装命令 | 安装复杂度 |
|------|---------|-----------|
| OpenCode / Pi / Gemini / Kiro | `bunx @every-env/compound-plugin install --to <target>` | 1 步（通过转换器） |

## 3.2 Codex 三步安装的特殊性

Codex 是唯一需要三步安装的平台，这暴露了当前 AI Coding 平台间的一个关键差异：

```
Step 1: codex plugin marketplace add EveryInc/compound-engineering-plugin
Step 2: bunx @every-env/compound-plugin install compound-engineering --to codex
Step 3: codex → /plugins → Compound Engineering → Install
```

**原因拆解**：

| 步骤 | 安装内容 | Codex 的当前限制 |
|------|---------|----------------|
| Step 1 | 注册 marketplace | 正常——所有平台都需要 |
| Step 2 | 安装 Agents（Bun 补充） | Codex 原生插件规范**暂不支持自定义 Agent**——这是唯一需要额外步骤的根本原因 |
| Step 3 | TUI 安装 Skills | Codex 的 Skills 通过 TUI 界面安装，不走 CLI |

**一旦 Codex 原生插件规范支持自定义 Agent，Step 2 可去掉**——这表明 Compound Engineering 的架构已经从 Codex 的能力边界中倒推出了 Codex 需要演进的方向。

## 3.3 Pi 的前置依赖

Pi 没有原生 subagent 原语，这是其根本性的架构差异：

```bash
pi install npm:pi-subagents    # 必须——提供 subagent 工具
pi install npm:pi-ask-user     # 推荐——提供 ask_user 工具
```

这意味着 Pi 的 Agent 模型是基于 npm 包扩展的，而非平台内置的。这种设计使 Pi 在 Agent 灵活性上有更大的可扩展空间，但也带来了额外的安装复杂度。从架构演进角度看，subagent 原语正在成为 AI Coding 平台的基础设施——Pi 当前缺少它，但通过社区包填补了这一缺口。

## 3.4 跨平台设计的工程启示

Compound Engineering 的跨平台策略揭示了插件生态的几个关键模式：

1. **Bun 作为通用运行时**：转换器平台统一使用 `bunx @every-env/compound-plugin install` 命令，Bun 起到了跨平台包管理器和运行时的作用。这是对 npm/npx 在 AI 工具链中地位的一个信号——Bun 的启动速度优势在 CLI 工具场景下有实际价值。

2. **平台能力差异的"适配器模式"**：Codex 和 Pi 的特殊安装步骤不是 Compound Engineering 的设计缺陷，而是平台能力差异的真实反映。插件通过"原生适配 + 转换器降级"的策略覆盖全平台，这种设计避免了"为最低公分母牺牲高级平台特性"的经典陷阱。

3. **"安装步骤数"作为平台成熟度指标**：安装步骤越少，平台对插件/Agent 的支持越原生。Claude Code 和 Cursor 的一步安装说明其插件体系已经成熟；Codex 的三步安装说明其仍在从"工具"向"平台"演进的路上。

---

# 第 4 章：与 spec-first 的全景对照

## 4.1 规模镜像：相同数字，相反侧重

两个体系在 Agent 和 Skill 数量上惊人相似——互为镜像：

| | spec-first v1.10.0 | Compound Engineering | 关系 |
|---|---|------|------|
| Agent 数量 | 51 | 51 | 完全相同 |
| Skill 数量 | 37 | 37 | 完全相同 |
| 核心偏向 | 技术审查体系（安全/性能/数据/前端/测试） | 流程编排体系（brainstorm→plan→work→review→compound） | 互补镜像 |

**这个镜像结构揭示了一个深层洞察**：51 个 Agent + 37 个 Skill 的规模可能是一个 AI 工程体系在"复杂但可管理"的临界点。两个互不相关的项目独立收敛到相同数量，暗示了某种最优粒度——每个 Agent 负责一个足够具体的职责，但总数量不至于超出编排的可管理范围。

## 4.2 流程 vs 技术审查：互补定位

| 维度 | spec-first | Compound Engineering | 互补性 |
|------|-----------|---------------------|--------|
| 安全审查 | spec-sec-audit 等专门 Agent | 无专门的独立安全审查 Agent | spec-first 强 |
| 性能审查 | spec-perf-review 等 | 无专门的性能审查 Agent | spec-first 强 |
| 数据审查 | spec-data-audit 等 | 无专门的数据审查 Agent | spec-first 强 |
| 前端审查 | spec-frontend-review 等 | 无专门的前端审查 Agent | spec-first 强 |
| 测试审查 | spec-test-review 等 | 无专门的测试审查 Agent | spec-first 强 |
| **脑暴/方向探索** | 无 /ce-brainstorm 对应 | /ce-brainstorm + /ce-ideate | Compound 强 |
| **多 Agent 并行审查** | spec-code-review（单一 Agent） | /ce-code-review（多 Agent 并行） | Compound 强 |
| **知识沉淀闭环** | **无 /ce-compound 对应（关键缺口）** | /ce-compound | Compound 强 |
| **策略锚点** | **无 STRATEGY.md 机制** | /ce-strategy → STRATEGY.md | Compound 强 |
| **产品脉搏报告** | 无对应 | /ce-product-pulse | Compound 强 |
| **多想法评估（ideate）** | 无对应 | /ce-ideate | Compound 强 |

**定位总结**：spec-first 是一个**技术质量保障体系**——确保代码在安全、性能、数据、前端、测试等维度上不犯专业错误。Compound Engineering 是一个**产品交付编排体系**——确保 Agent 在正确的方向上按正确的节奏做正确的事。两者不是竞争关系，而是**可以叠用的互补层**。

## 4.3 逐命令对照

| Compound Engineering 命令 | spec-first 对应 | 差异分析 |
|--------------------------|----------------|---------|
| /ce-strategy → STRATEGY.md | 无 | spec-first 没有一个显式的"策略锚点"机制。PRD 定义做什么，但不定义什么是"对的方向" |
| /ce-ideate | 无 | spec-first 没有多想法评估阶段——直接进入 spec-prd（需求定义） |
| /ce-brainstorm | spec-prd | spec-prd 是需求定义，偏向"写清楚需求"；/ce-brainstorm 是想法发散与聚焦，偏向"想清楚方向"。前者是生产者思维，后者是探索者思维 |
| /ce-plan | spec-plan | 接近对应。spec-plan 生成技术方案，/ce-plan 生成实施计划。差异：spec-plan 更偏向技术架构，/ce-plan 更偏向任务拆解与执行步骤 |
| /ce-work | spec-work | 接近对应。spec-work 管理工作流步骤，/ce-work 按计划执行 |
| /ce-debug | 无独立命令 | spec-first 的 bug 修复可能嵌在 spec-work 中，无独立的调试循环 |
| /ce-code-review | spec-code-review | 结构差异最大：spec-code-review 是单一 Agent 审查，关注代码质量；/ce-code-review 是多 Agent 并行审查，追求模式发现而非单次 bug。多 Agent 并行的模式发现力是两者间最关键的代差 |
| /ce-compound | **无** | **最关键的结构性缺口**。spec-first 没有知识沉淀 Agent——每次任务结束后，学到的经验没有被系统化编码 |
| /ce-product-pulse | 无 | spec-first 关注代码质量，不关注产品效果 |

## 4.4 spec-first 的关键缺口分析

### 缺口一：无知识沉淀闭环（P0）

这是 spec-first 相对于 Compound Engineering 最关键的结构性缺口。spec-first 有完整的代码生成→审查→修复循环，但没有**把审查和修复中的经验编码为可复用资产**的机制。每次 code-review 发现的模式性错误，修复后如果没被编码，下一个需求还会重犯。

对照六层架构：这一缺口对应流程层"反馈沉淀"环节的缺失。

### 缺口二：无策略锚点（P0）

spec-first 没有 STRATEGY.md 的概念。PRD 定义了需求，但 PRD 只是"这次做什么"——没有更高层的方向性约束"什么是符合方向的事"。在多 Agent 并行开发的场景下，这会带来方向性漂移风险。

### 缺口三：单 Agent 审查 vs 多 Agent 并行审查（P1）

spec-code-review 是单一 Agent 审查，/ce-code-review 是多 Agent 并行。多 Agent 并行的优势在于不同审查视角的交叉验证——安全 Agent、性能 Agent、前端 Agent 同时审查，模式性错误更容易在视角交叉中暴露。

### 缺口四：无 ideate 阶段（P2）

spec-first 直接从 spec-prd 进入需求定义，没有可选的"多想法评估"阶段。这对需求明确的项目不是问题，但对方向性探索类需求，跳过评估可能意味着把不确定性推到了更贵的编码阶段。

---

# 第 5 章：与前序知识链收束

本章将 Compound Engineering 的核心机制与前序 Harness Engineering 分析系列的五条知识链进行逐条对接，揭示各概念之间的深层关系。

## 5.1 与 experience-depositor（第四篇 PRD→代码）

### 5.1.1 概念映射

| Compound Engineering | PRD→可验证代码（第四篇） | 关系 |
|---------------------|------------------------|------|
| /ce-compound | experience-depositor（经验沉淀 Agent） | **概念同构**——都是把任务中学到的经验系统化编码为可复用资产 |
| 沉淀内容：审查报告 + 执行经验 | 沉淀内容：有效提示词、常见失败、修复方式、组件复用经验、Figma 直读规则 | 内容类型接近但侧重不同——Compound 偏向流程经验，PRD→代码偏向技术经验 |
| 消费者：下一个 Agent | 消费者：下一个需求 | 消费模式一致 |

### 5.1.2 关键差异

**experience-depositor 沉淀的是"技术操作经验"**（哪些 prompt 有效、哪些 Figma 节点要特别注意、哪类编译错误常见），**/ce-compound 沉淀的是"工程流程经验"**（这次脑暴为什么偏了、审查发现了什么模式性问题、计划中哪个假设被证伪了）。

两者处于知识金字塔的不同层级：experience-depositor 偏向操作层，/ce-compound 偏向流程层。理想情况下应该同时存在——操作经验和流程经验分别编码，互不覆盖。

### 5.1.3 知识链价值

experience-depositor 提供了知识编码的**执行实例**，/ce-compound 提供了知识编码的**流程位置**。两者结合回答了一个完整的问题：**在流程的什么位置，用什么方式，编码什么内容**。这个三维定位是知识沉淀从"可选项"变成"系统化机制"的关键。

## 5.2 与 Harness 五层架构的经验三级进化

Harness 五层架构提出了经验的三个进化层级：

```
lesson（单次教训）→ pattern（重复模式）→ instinct（组织本能）
```

Compound Engineering 的 /ce-compound 恰好覆盖了从 lesson 到 pattern 的转化过程：

| 进化阶段 | Harness 定义 | Compound Engineering 实现 |
|---------|-------------|--------------------------|
| lesson | 单次任务中的经验（"字段顺序错了"） | /ce-code-review 抓到的单次问题 |
| pattern | 重复出现的模式（"导出类需求经常字段顺序错"） | /ce-compound 把重复问题编码为模式沉淀 |
| instinct | 组织本能（不用显式提醒自动避免） | 需要多个 /ce-compound 循环的积累——单次沉淀无法达到此层 |

**关键洞察**：/ce-compound 是 lesson→pattern 转换的工程化机制。没有它，lesson 只会留在当次审查报告的聊天窗口里，永远不会进化成 pattern。Harness 三级进化定义了"目标"，/ce-compound 提供了"手段"。

对照六层架构中流程层的"反馈沉淀"环节：Harness 给它定义了进化层级，Compound Engineering 给它定义了执行命令。

## 5.3 与六层架构的反馈沉淀机制

从 AI Coding 六层架构视角看，/ce-compound 处于**流程层（L3）的反馈沉淀环节**：

| 六层架构维度 | Compound Engineering 对应 |
|-------------|-------------------------|
| **流程层→反馈沉淀** | /ce-compound——把纠偏沉淀为需求模板、上下文说明、测试用例、禁止事项 |
| **Agent 执行层→Review Agent** | /ce-code-review 的多 Agent 并行审查 |
| **Agent 执行层→Coding Agent** | /ce-work 的执行 Agent |
| **Agent 执行层→Architect Agent** | /ce-plan + /ce-brainstorm 的规划和脑暴 |
| **组织能力层→AI Tech Lead** | /ce-strategy 的锚点维护 + /ce-ideate 的方向探索——多 Agent 编排的前置工作 |
| **组织能力层→监督式工程师** | 整个循环中的人机分工——人负责策略、确认、取舍；AI 负责执行、审查、沉淀 |

**六层架构中流程层"三工程"与 Compound Engineering 的映射**：

| 三工程 | Compound Engineering 对应 |
|--------|--------------------------|
| Intent Engineering（意图工程） | /ce-brainstorm + /ce-plan——在 AI 执行前把目标、边界、验收标准说清楚 |
| Context Engineering（上下文工程） | 隐含在 /ce-plan→/ce-work 的信息传递中——计划文档充当"上下文包" |
| Verification Engineering（验证工程） | /ce-code-review——多 Agent 并行验证；验证方式在执行前已通过计划定义 |

**gap 提示**：Compound Engineering 的 Context Engineering 不够显性化——没有独立的"上下文准备"命令，上下文通过计划文档隐式传递。六层架构中"小上下文包"（入口、相似实现、字段映射、权限判断、测试文件、禁止修改模块）的准备在 Compound Engineering 中被埋在 /ce-plan 中，没有被提升为独立工程。

## 5.4 与 L4 AI Tech Lead（多 Agent 编排）

五级能力模型中 L4 AI Tech Lead 的核心职责是**多 Agent 编排**——决定哪些任务适合交给 Agent、哪些模块禁止自动改、哪些测试必须跑、哪些结果必须人工确认。

Compound Engineering 的工作流闭环正是对这一职责的**工程化表达**：

| L4 AI Tech Lead 职责 | Compound Engineering 实现 |
|---------------------|--------------------------|
| 任务边界定义 | /ce-strategy 定义方向边界 → /ce-brainstorm 定义范围边界 → /ce-plan 定义执行边界 |
| 上下文共享 | /ce-plan 产出的计划文档在不同 Agent 间传递——充当上下文共享介质 |
| 状态同步 | /ce-product-pulse——周期性状态报告；/ce-code-review→/ce-compound——错误状态沉淀 |
| 结果汇总 | /ce-compound——结果和经验汇总为可复用资产 |
| 禁止自动修改的模块 | 隐含在 STRATEGY.md 中——"方法"和"架构约束"定义了禁区 |
| 必须人工确认的环节 | 未显性化——当前循环中没有人工门禁点（/ce-strategy 创建 STRATEGY.md 后，脑暴→计划→执行→审查全自动） |

**关键 gap**：L4 要求"哪些结果必须人工确认"，但 Compound Engineering 的循环中没有显性的人工门禁。整个循环 STRATEGY.md→brainstorm→plan→work→review→compound 是全自动的。这与 PRD→可验证代码的两道人工门禁（需求审阅 + 架构确认）形成鲜明对比。

**评估**：Compound Engineering 的循环更适合"已明确方向的功能开发"，而 PRD→可验证代码的流程更适合"高风险/新需求"的开发场景。前者省去了人工等待时间，后者用人工门禁换取了方向正确性保证。

## 5.5 与 design.md 文档链的对应

design.md 的文档流水线是：

```
requirements.md → design.md → tasks.md → code + test
```

Compound Engineering 的文档链是：

```
STRATEGY.md → docs/brainstorms/*.md → plan doc → code + review
```

| design.md 链 | Compound Engineering 链 | 关系 |
|-------------|------------------------|------|
| requirements.md（做什么） | STRATEGY.md（什么是符合方向的事）+ docs/brainstorms/*.md（探索性需求定义） | STRATEGY.md 层级更高——不仅是"这次做什么"，更是"永远要朝什么方向" |
| design.md（怎么做） | /ce-plan 产出（技术方案 + 实施计划） | design.md 偏向"架构设计"，/ce-plan 偏向"执行计划"——后者多了一个"按什么顺序"的维度 |
| tasks.md（一步步拆） | 隐含在 /ce-plan 中——计划的"任务拆解"部分 | 未独立成文档——可能值得分离？ |
| code + test | /ce-work 产出 + /ce-code-review | Compound 多了审查和沉淀环节 |

**关键差异**：design.md 链的每个阶段产物是**独立的可审阅文档**（人可以读 requirements.md 独立判断是否正确，再读 design.md 独立判断方案是否可行）。Compound Engineering 链的产物更多是**Agent 间流转的内部格式**（脑暴文档→计划文档→执行产物→审查报告→沉淀笔记）。前者对人的可读性和审阅友好度更高，后者对 Agent 的流转效率更高。

---

# 第 6 章：核心启示提炼

## 6.1 知识沉淀是分水岭——从线性衰减到复合增长

传统软件工程中，团队知识的自然曲线是**衰减**的：每次新人加入、老人离开、需求更替，隐性知识都在流失。投入越多的功能，复杂度越高的系统，知识衰减的速度越快——这是技术债的经济学解释。

Compound Engineering 的 /ce-compound 翻转了这条曲线：从衰减变为**复合增长**。每次任务结束，经验被结构化编码，下一个 Agent 不仅从上次的水平开始，而且是从更高的水平开始。在数学上：

- **不沉淀**：团队效率 ≈ O(1/n)，n 为任务数或团队成员变动次数
- **沉淀**：团队效率 ≈ O(log n)，知识随任务数对数增长

**这个翻转是 Compound Engineering 最根本的工程贡献——它把 AI Agent 的"快"从单次加速变成了长期杠杆。**

## 6.2 审查不是结束而是循环的支点

传统开发中，代码审查的价值常被低估——它被视为"发布前的一道检查"，而不是"下一次开发的起点"。/ce-code-review→/ce-compound 的串联重新定位了审查在工程循环中的位置：

- **审查发现问题**（模式性错误而非单次 bug）
- **沉淀编码经验**（将错误模式转化为 Agent 可消费的规则）
- **下一次避免**（新 Agent 读取沉淀后的规则，自动避开已知陷阱）

审查从"终点检查"变成了"循环支点"。这改变了审查的投入产出计算——审查不仅保护本次交付的质量，更在降低下一次交付的成本。

## 6.3 策略锚点解决的是 Agent 的"目标对齐"问题

多 Agent 并行开发时，最大的风险不是单个 Agent 做错，而是多个 Agent 往不同方向做。一个做性能优化、一个做新功能、一个做重构——每个 Agent 单独看都没错，但合在一起没有产生协同效应。

STRATEGY.md 解决的就是这个对齐问题。它不是另一个 PRD，而是一个更高层级的"方向约束"——任何 Agent 开始工作前都要检查：我的产出是否符合产品目标？我的方案是否符合技术栈约束？我的优先级是否符合关键指标？

这种对齐机制对应了 L4 AI Tech Lead 的核心职责：**不在执行层管 Agent，而在方向层对齐 Agent。**

## 6.4 80/20 法则的本质是人机分工最优解

80/20 不是工作量分配，而是一个**认知经济学优化**：

- AI 的"快"在**执行端**（代码生成的速度是人类工程师的 10-100 倍）
- AI 的"弱"在**决策端**（方向判断、取舍决策、异常边界识别）
- 人类反过来：执行端弱于 AI（写代码慢、易遗漏、重复性疲劳），但决策端远超 AI

因此最优分工不是各做 50%，而是将人类的精力集中到 AI 最弱的决策端（脑暴、计划、审查策略），将 AI 的精力集中到人类最弱的执行端（代码生成、多 Agent 并行检查、知识归纳）。

**这个分工不是牺牲效率，而是效率最大化——人的精力总预算有限，花在决策上每一小时的杠杆效应远超花在执行上。**

---

# 第 7 章：分级改进建议

以下建议针对 Harness Engineering 分析系列所覆盖的体系（spec-first + 六层架构 + Harness 五层 + PRD→代码闭环），以 Compound Engineering 为对照基准，按优先级分级。

## P0：结构性缺口——必须补齐

### 7.1 知识沉淀闭环（对应 /ce-compound）

**当前状态**：spec-first 有 spec-code-review 但无知识沉淀机制；六层架构有"反馈沉淀"概念但无独立命令；PRD→可验证代码有一个 experience-depositor Agent 但偏向操作层经验。

**建议**：
- 新增 `/harness-compound` 命令或独立 Agent，在每次需求交付后执行
- 沉淀结构至少包含：本次发现的模式性错误、有效提示词/修复方式、上下文准备经验、验证设计经验
- 沉淀产物格式需可被下一个 Agent 直接消费（而非人类阅读后手动转述）
- 与 experience-depositor 的分工：experience-depositor 负责技术操作经验（Figma 节点映射、编译错误模式），/harness-compound 负责流程工程经验（这次脑暴偏了什么、计划假设被什么证伪、审查发现了什么跨需求模式）

### 7.2 策略锚点（对应 STRATEGY.md）

**当前状态**：spec-first 用 spec-prd 定义需求，但 PRD 只是"这次做什么"——缺少"什么是符合方向的事"这层约束。

**建议**：
- 新增 `/harness-strategy` 命令，创建/维护一个产品级 STRATEGY.md
- STRATEGY.md 至少覆盖：产品目标、方法/技术栈约束、用户画像、关键指标、禁止事项
- 所有下游 Agent（brainstorm/prd/plan/work）在启动时读取 STRATEGY.md 验证方向对齐
- STRATEGY.md 的修改频率应远低于 PRD——它应被视为"产品宪法"而非"功能需求"

## P1：能力增强——应当优化

### 7.3 多 Agent 并行审查（对应 /ce-code-review）

**当前状态**：spec-code-review 是单一 Agent 审查。

**建议**：
- 设计多 Agent 并行审查策略，在 code-review 阶段同时启动至少 3 个审查 Agent（安全/性能/规范 等不同视角）
- 增加"模式汇总"环节——多个审查 Agent 的输出汇总后，提取跨 Agent 一致指出的模式性缺陷
- 模式汇总的输出直接注入 /harness-compound（P0 建议），形成审查→沉淀的完整链条

### 7.4 Context Engineering 显性化

**当前状态**：六层架构提出了 Context Engineering（小上下文包）的概念，PRD→可验证代码中有 ArchitectureDesign 做上下文准备，但没有独立的"上下文准备"命令。

**建议**：
- 新增 `/harness-context` 命令，在 /harness-plan 之后、/harness-work 之前执行
- 上下文包至少包含：入口文件、相似实现引用、字段映射规则、权限判断逻辑、验证工具路径、禁止修改模块列表
- 上下文包产物不超过 8K tokens（遵循 Harness 五层中 L1 常驻入口层的 ≤8K 约束）

### 7.5 人工门禁设计

**当前状态**：Compound Engineering 没有显性人工门禁；PRD→可验证代码有两道人工门禁（需求审阅 + 架构确认）。

**建议**：
- 在 /harness-brainstorm 产出后增加第一道可选门禁：**方向确认**——确认脑暴方向与 STRATEGY.md 一致（对低风险需求可自动跳过）
- 在 /harness-plan 产出后增加第二道门禁：**方案确认**——确认技术方案、模块拆分和边界定义（对高风险/新模块必须人工确认）
- 利用 intent × risk 动态裁剪：QUERY/BUG_FIX 跳过门禁，FEATURE/HIGH_RISK 触发门禁

## P2：体验优化——建议补充

### 7.6 产品脉搏报告（对应 /ce-product-pulse）

**建议**：新增 `/harness-pulse` 命令，周期性生成产品脉搏报告，覆盖：时间窗口内的用量变化、性能趋势、Top N 错误、后续行动建议。报告保存到 docs/pulse-reports/，形成可浏览的产品效果时间线。

### 7.7 /ce-ideate 式的多想法评估

**建议**：在 /harness-brainstorm 前增加可选的 `/harness-ideate` 阶段，用于方向不明确时生成并批判性评估多个想法，选出最强的一个进入脑暴。对需求明确的任务可跳过。

### 7.8 文档链产物的人类可读性提升

**当前状态**：Compound Engineering 的产物偏向 Agent 间流转效率，人类可读性弱于 design.md 链。

**建议**：在关键门禁点的产物（脑暴文档、计划文档）中加入人类可读摘要段，格式为 3-5 条关键判断 + 1 条风险提示 + 1 条建议行动，确保人在 60 秒内可做出审阅决策。

---

## 附录 A：两个体系的核心命令对照表

| 维度 | Compound Engineering | spec-first | Harness 工程 |
|------|---------------------|-----------|-------------|
| 策略锚点 | /ce-strategy → STRATEGY.md | 无 | 无 |
| 方向探索 | /ce-ideate | 无 | 无 |
| 脑暴/需求 | /ce-brainstorm | spec-prd | requirements.md |
| 技术方案 | /ce-plan | spec-plan | design.md |
| 任务拆解 | 隐含在 /ce-plan | spec-task（推测） | tasks.md |
| 执行 | /ce-work | spec-work | code + test |
| 调试 | /ce-debug | 无独立命令 | 无独立命令 |
| 代码审查 | /ce-code-review（多 Agent 并行） | spec-code-review（单 Agent） | G1-G8 门禁 + agent 三角色评审 |
| 知识沉淀 | /ce-compound | **无（关键缺口）** | experience-depositor（操作层） |
| 产品脉搏 | /ce-product-pulse | 无 | 无 |
| Context Engineering | 隐含在 /ce-plan | 隐含在 spec-plan | 无独立命令 |

## 附录 B：知识链关系总图

```
┌─────────────────────────────────────────────────────────────┐
│                   Compound Engineering                       │
│                    (37 Skills + 51 Agents)                   │
│                                                             │
│  STRATEGY.md ──→ brainstorm ──→ plan ──→ work ──→          │
│                                         review ──→ compound │
│                                                             │
│  核心机制：知识沉淀闭环（/ce-compound）                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
┌─────────────────┐ ┌─────────────┐ ┌──────────────────┐
│ Harness 三级进化 │ │ 六层架构    │ │ PRD→代码第四篇    │
│ lesson→pattern  │ │ 流程层反馈   │ │ experience-      │
│ →instinct       │ │ 沉淀环节     │ │ depositor        │
│                 │ │              │ │                  │
│ /ce-compound 是 │ │ /ce-compound │ │ 操作层 vs 流程层 │
│lesson→pattern的 │ │ 是反馈沉淀的 │ │ 经验编码         │
│ 工程化转换机制  │ │ 具体执行命令 │ │                  │
└─────────────────┘ └─────────────┘ └──────────────────┘
          │                │                │
          └────────────────┼────────────────┘
                           │
                           ▼
          ┌────────────────────────────┐
          │  L4 AI Tech Lead           │
          │  多 Agent 编排              │
          │  Compound 的闭环是          │
          │  编排能力的工程化表达        │
          └──────────────┬─────────────┘
                         │
                         ▼
          ┌────────────────────────────┐
          │  design.md 文档链           │
          │  requirements → design     │
          │  → tasks → code            │
          │                            │
          │  Compound 的文档链：        │
          │  STRATEGY → brainstorm     │
          │  → plan → code+review      │
          └────────────────────────────┘
```
*（内容由AI生成，仅供参考）*
