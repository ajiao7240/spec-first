---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a88644969371398a873cabeac0a028ab_4e7ec83a662b11f1aa625254006c9bbf
    ReservedCode1: WY8ulKEC+Ry1CSz6df8NIiUAM2XYcpFonXDgXOVEAvZM7LRuOjItw/2jO3SOXh2dc+C9jiQuQAR1YwLiXRg6+hn1yk5Hhv5rhxtCWMwxpB8vR1GSE3D2BUk2HF83fDjj8JQ2LU83ck/FKLXL+giee7g1dUuf2PszAGxhpsNKNC1+C5tuTHhcYbbj3E0=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a88644969371398a873cabeac0a028ab_4e7ec83a662b11f1aa625254006c9bbf
    ReservedCode2: WY8ulKEC+Ry1CSz6df8NIiUAM2XYcpFonXDgXOVEAvZM7LRuOjItw/2jO3SOXh2dc+C9jiQuQAR1YwLiXRg6+hn1yk5Hhv5rhxtCWMwxpB8vR1GSE3D2BUk2HF83fDjj8JQ2LU83ck/FKLXL+giee7g1dUuf2PszAGxhpsNKNC1+C5tuTHhcYbbj3E0=
---

# pm-skills vs spec-first：产品管理与 AI 编码研发体系的逐维度对照分析

> **分析日期**：2026-06-12
> **分析对象**：phuryn/pm-skills（13.3k Star，MIT License）
> **对照对象**：spec-first（AI 编码研发体系）
> **数据来源**：微信推文、今日头条深度测评、Paweł Huryn 博客（PM Skills 2.0 发布文章）、BestHub 架构文档、SD百科/CSDN/博客园/网易等搜索聚合信息、GitHub 项目页

---

## 一、项目概述

### 1.1 核心定位

**pm-skills** 的官方定位是 **"PM Skills Marketplace: The AI Operating System for Better Product Decisions"**——面向产品决策的 AI 操作系统。其核心理念是将经过验证的产品管理方法论编码为 AI 可调用的 Skills、Commands 和 Plugins，让 AI 从"会写产品文档"升级为"按产品框架思考"。

正如 Paweł Huryn 在 The Product Compass 中所言：
> *"Generic AI gives you text. PM Skills gives you structure."*

### 1.2 关键数据

| 指标 | 数值 |
|------|------|
| GitHub Star | 13,300+（截至 2026-06-12） |
| Fork | 1,500+ |
| Skills 总数 | 68 |
| Commands 总数 | 42 |
| Plugins 总数 | 9 |
| 开源协议 | MIT License |
| 作者 | Paweł Huryn（The Product Compass Newsletter，131,000+ subscribers） |

### 1.3 理论基础

pm-skills 并非凭空设计，而是将业界顶级产品管理方法论系统化编码：

| 方法论来源 | 代表人物 | 核心贡献 | 对应 Plugin |
|------------|----------|----------|-------------|
| **持续发现习惯** | Teresa Torres | Opportunity Solution Tree（机会解决方案树）、持续发现 | pm-product-discovery |
| **赋能产品团队** | Marty Cagan | INSPIRED / TRANSFORMED，产品战略九部分画布 | pm-product-strategy |
| **预型测试** | Alberto Savoia | The Right It，假设优先级排序（影响力 × 风险矩阵） | pm-product-discovery |
| **精益产品手册** | Dan Olsen | 结构化 PRD 格式、产品-市场匹配框架 | pm-execution |

### 1.4 作者背景

Paweł Huryn，GitHub 简介为 **"AI PM Coach · ex-CPO · Builder"**，是 The Product Compass Newsletter 的创建者（131,000+ subscribers），长期从事产品管理方法论写作、AI PM 教学和开源工具构建。pm-skills 是其多年积累的系统化产出——不是工程师随手写的 Prompt 玩具，而是将产品管理框架工程化编码的结果。

---

## 二、架构分析

### 2.1 三层模型

pm-skills 采用清晰的三层架构：

```
Plugins（插件层）
  └─ 按 PM 领域打包，一键安装全套框架
Commands（命令层）
  └─ 用户通过 /command 触发的斜杠工作流，链式串联多个 Skill
Skills（技能层）
  └─ 最小构建单元，封装单一产品方法论框架，自动加载
```

**Skill** 是原子化的方法卡片——每个 Skill 包含某个 PM 任务所需的领域知识、分析框架或引导式工作流（如 `opportunity-solution-tree`、`prioritization-frameworks`、`brainstorm-ideas-existing`）。Skill 在相关对话中**自动加载**，无需手动触发。

**Command** 是用户主动触发的端到端工作流。一个 Command 背后是多个 Skill 的有序组合。命令完成后，AI 会主动推荐下一步操作（如做完 `/strategy` 后推荐 `/write-prd`）。

**Plugin** 是面向 PM 领域的可安装包，将相关 Skills 和 Commands 按领域分组打包。安装 Marketplace 一次，9 个 Plugin 全部就绪。

### 2.2 9 个 Plugin 清单及覆盖领域

| # | Plugin 名称 | Skills | Commands | 覆盖领域 | 理论基础 |
|---|------------|--------|----------|----------|----------|
| 1 | **pm-toolkit** | 4 | 5 | 简历审查、法律文档（NDA/隐私政策）、校对 | 通用工具集 |
| 2 | **pm-product-discovery** | 13 | 5 | 创意生成、假设识别与优先级、实验设计、OST、用户访谈 | Teresa Torres 持续发现 |
| 3 | **pm-product-strategy** | 12 | 5 | 产品愿景、商业模式、定价策略、竞争分析、波特五力 | Marty Cagan 产品战略 |
| 4 | **pm-market-research** | 7 | 3 | 用户画像、市场细分、用户旅程图、市场规模、竞品分析 | — |
| 5 | **pm-data-analytics** | 3 | 3 | SQL 生成、队列分析、A/B 测试分析 | — |
| 6 | **pm-marketing-growth** | 5 | 2 | 营销创意、定位、价值主张、北极星指标 | Sean Ellis North Star |
| 7 | **pm-go-to-market** | 6 | 3 | 滩头细分、ICP、消息策略、增长循环、Battlecard | — |
| 8 | **pm-execution** | 16 | 11 | PRD、OKR、路线图、冲刺规划、回顾、发布说明、利益相关方管理 | Dan Olsen PRD + Christina Wodtke OKR |
| 9 | **pm-ai-shipping**（v2.0.0 新增） | 2 | 5 | AI 代码意图审查、安全审计、性能审计、测试覆盖映射 | — |

### 2.3 关键命令深析

#### 2.3.1 `/discover`：完整需求发现周期

```
/discover [产品想法]
  └─ brainstorm-ideas → identify-assumptions → prioritize-assumptions → brainstorm-experiments
```

这是从灵感 → 可验证假设的完整流水线。先发散（头脑风暴多角度创意），再收敛（识别价值/可用性/可行性/商业可行性四类假设），再排序（影响力 × 风险矩阵），最后设计实验（最便宜的验证方案）。

#### 2.3.2 `/write-prd`：含自检和风险评估的 PRD 生成

```
/write-prd [功能描述]
  └─ create-prd → pre-mortem → strategy-red-team
```

传统 AI 写 PRD：生成一篇漂亮的文档。pm-skills 的 `/write-prd`：先写 PRD 主体 → 假设发布后失败，倒推失败原因（pre-mortem）→ 从批评者角度攻击 PRD 的战略假设（red-team）。输出的是包含自检和风险评估的完整 PRD。

#### 2.3.3 `/red-team-prd`：攻击性假设审查

```
/red-team-prd [你的 PRD / roadmap / strategy]
```

Paweł 对这一命令的描述：**"Most PRDs only survive polite feedback."**（大多数 PRD 只能经受住礼貌反馈。）

`/red-team-prd` 的作用是在评审前主动攻击方案假设：找出最危险的假设、按"最需优先验证"排序、为每个假设推荐最便宜的验证实验。五条能杀死方案的假设比二十条通用风险更有价值。

#### 2.3.4 `/ship-check`：intended-vs-implemented 审计

v2.0.0 新增的 AI Shipping Kit 核心命令。解决的核心问题：**AI 写代码很快，但不留任何意图记录——系统应该做什么、谁能做什么、密钥在哪里、哪些规则被测试验证了。**

`/ship-check` 的完整流程：

```
/document-app → /security-audit-static → /performance-audit-static → /derive-tests → 编译 Shipping Packet
```

其核心审查闸门是 **intended vs. implemented**（意图 vs. 实现），寻找"产品承诺"与"代码实际行为"不符之处：

- 文档声称有权限控制但实际未实施
- 定时任务端点任何人都能调用
- 测试覆盖了代码但未覆盖真实工作流

该 Kit 包含两个 Skill：
- `shipping-artifacts`：定义让 AI 构建的应用可审查的文档集（架构、数据流、权限、变量/密钥、测试覆盖图 + 条件性文档如邮件/定时任务/SEO/自动化）
- `intended-vs-implemented`：以双方证据审计文档意图与实际代码之间的差距

**对 PM 的意义**："/the AI wrote it/ 不是签字理由。`/ship-check` 把一个 AI 工程化的 repo 变成一个人类可以签名的交付包。"

### 2.4 跨平台支持

| 工具 | 安装方式 | Skills | Commands |
|------|----------|--------|----------|
| **Claude Code** | CLI `claude plugin marketplace add` + `install` | 完整支持 | 完整支持 |
| **Claude Cowork** | GUI Marketplace 一键安装 | 完整支持 | 完整支持 |
| **Codex CLI** | CLI `codex plugin marketplace add` + `add` | 完整支持 | 仅 Skills（需自然语言调用） |
| **Cursor** | 复制 SKILL.md 到 `.cursor/skills/` | 仅 Skills | 不支持 |
| **Gemini CLI** | 复制到 `~/.gemini/skills/` | 仅 Skills | 不支持 |
| **OpenCode** | 复制到 `.opencode/skills/` | 仅 Skills | 不支持 |
| **Kiro** | 复制 SKILL.md | 仅 Skills | 不支持 |

Commands（斜杠命令）是 Claude-specific 的，Skills（`SKILL.md` 文件）遵循通用 Skill 格式，具有跨平台可移植性。

---

## 三、与 spec-first 逐维度对照

### 3.1 矩阵对照表

| 维度 | pm-skills | spec-first |
|------|-----------|------------|
| **定位** | AI 产品管理操作系统——将 PM 方法论编码为 AI 可调用工作流 | AI 编码研发体系——将软件开发流程编码为 Agent Skills |
| **目标用户** | 产品经理、创业者、AI 产品负责人、非技术决策者 | 工程师、技术负责人、AI 编码实践者 |
| **规模** | 68 Skills / 42 Commands / 9 Plugins | 37 Skills / 51 Agents |
| **架构模型** | Skills → Commands → Plugins（三层显式串联） | Skills → Agents（工作流层 + 能力层，阶段 Skill 内部隐式编排 Agent） |
| **工作流阶段** | discover → strategy → write-prd → plan-launch → ship-check | Bootstrap → Ideate → Brainstorm → Plan → Work → Review → Compound |
| **链式编排** | Commands 显式串联多 Skill，用户可见、可触发 | 阶段 Skill 内部隐式编排 Agent，对外暴露统一接口 |
| **对抗性审查** | `/red-team-prd`：在 PRD 评审前主动攻击假设；`/pre-mortem`：假设失败后倒推原因 | Review 阶段结构化审查（代码审查），无前置假设攻击机制 |
| **代码交付审查** | `/ship-check`：intended-vs-implemented 审计 + Shipping Packet 编译，面向非技术 PM | Review Agent 代码审查（技术视角），无 PM 视角的 shipping packet |
| **框架理论基础** | Teresa Torres（持续发现）、Marty Cagan（产品战略）、Alberto Savoia（预型测试）、Dan Olsen（PRD）、Porter、Sean Ellis 等 | Harness Engineering、SDD（Spec-Driven Development）、Compound Engineering |
| **上下文管理** | PM Brain（Markdown 第二大脑）：策略、用户、决策、假设、利益相关方等结构化上下文文件 | 项目上下文文件（spec.md / plan.md / decisions.md），工程视角 |
| **跨平台** | Claude Code / Cowork / Codex / Cursor / Gemini CLI / OpenCode / Kiro（7 个平台） | Claude Code 为主，Codex 兼容 |
| **安装方式** | Plugin Marketplace（GUI 一键安装）/ CLI 安装 / 文件复制 | npm 包 + CLI |
| **开源协议** | MIT（完全开源） | 未公开 |
| **技能粒度** | 单一方法框架（如 `opportunity-solution-tree`） | 复合流程步骤（如 `plan` Skill 内含多 Agent） |
| **自动加载** | Skill 在相关对话中自动加载，用户无需手动调用 | Agent 由阶段 Skill 内部调度 |
| **可复用性** | Skill 跨 Command 共享（如 `prioritization-frameworks` 被 `/discover`、`/write-prd`、`/triage-requests` 共享） | Agent 绑定在阶段 Skill 内，跨阶段共享性待验证 |
| **工作流推荐** | 命令完成后 AI 主动推荐下一步操作（如 `/strategy` → 推荐 `/write-prd`） | 阶段间有明确衔接，但无主动推荐机制 |

### 3.2 工作流阶段映射

```
pm-skills 工作流:
  /discover  →  /strategy  →  /write-prd  →  /plan-launch  →  /ship-check
  (发现)       (策略)        (撰写PRD)      (上市计划)        (交付审查)

spec-first 工作流:
  Bootstrap  →  Ideate  →  Brainstorm  →  Plan  →  Work  →  Review  →  Compound
  (启动)       (构思)      (头脑风暴)     (规划)   (执行)    (审查)     (复合)
```

关键观察：
- **pm-skills 的 discover/strategy 对应 spec-first 的 Ideate/Brainstorm/Plan**，但 pm-skills 在产品发现阶段的工具密度远高于 spec-first（13 个 discovery Skills vs. 暂无专门发现 Agent）
- **pm-skills 的 ship-check 是 spec-first 中缺乏的能力**——spec-first 有 Review 阶段但面向代码质量，无 PM 视角的 intended-vs-implemented 交付审计
- **pm-skills 的 red-team-prd 在 spec-first 中没有对应物**——spec-first 的审查发生于实现后，而 red-team 在方案确定前主动攻击假设

---

## 四、关键差异深度分析

### 4.1 "先攻击自己" vs "先审查别人"

**pm-skills 模式**：`/red-team-prd` 和 `/pre-mortem` 在 PRD 评审**之前**主动攻击方案假设。时序为：

```
想法 → 写PRD → [red-team 攻击假设] → 修改PRD → 评审 → 开发 → 交付
            ↑ 此时攻击成本最低
```

**spec-first 模式**：Review 阶段在代码实现**之后**审查。时序为：

```
想法 → Plan → Work(实现) → [Review 审查] → Compound
                              ↑ 审查发现的问题修复成本已较高
```

**核心差异**：
1. **成本不对称**：pm-skills 在最便宜的阶段（文档阶段）就暴露假设风险；spec-first 在代码已写完后审查
2. **审查视角**：pm-skills 的 red-team 是从"对手视角"主动攻击，spec-first 的 Review 是从"同伴视角"被动审查
3. **心理学价值**：Paweł 强调"/red-team-prd 让你在周二杀掉一个坏下注，而不是一个季度后在领导层面前为它辩护"——这种"先自己打自己"的思维模式降低了防御心理

**对 spec-first 的启发**：应在 Plan 阶段（方案确定前）引入 red-team 或 pre-mortem 机制，在 Agent 编排实现之前主动挑战技术方案的假设。

### 4.2 PM 视角的代码交付审查

**pm-skills 的 `/ship-check`**：核心审查闸门是 **intended vs. implemented**（意图 vs. 实现）。它不要求使用者是技术人员——只需要知道"系统应该做什么"。

工作流程：
1. `shipping-artifacts`：定义审查文档集（架构、数据流、权限、变量、测试覆盖图 + 条件性文档）
2. `/document-app`：从代码库逆向生成系统文档
3. `/security-audit-static`：对照文档意图检查安全
4. `/performance-audit-static`：检查过度获取、缺失索引、缓存
5. `/derive-tests`：映射已有测试、提议测试和未验证缺口
6. 编译 Shipping Packet——人类可以签字的交付包

**spec-first 的 Review**：面向代码质量的工程审查，由 Review Agent 执行。关注代码正确性、规范、最佳实践。面向工程师，需要技术能力解读审查结果。

**核心差异**：

| 维度 | pm-skills /ship-check | spec-first Review |
|------|----------------------|-------------------|
| 审查对象 | 代码 vs. 文档意图的一致性 | 代码质量与正确性 |
| 使用者 | 非技术 PM 可操作 | 需要工程师 |
| 审查产物 | Shipping Packet（人类可签字） | 审查报告（技术语言） |
| 审查时序 | 上线前最后一道闸门 | 实现后常规流程 |
| 核心问题 | "这个 AI 写的应用能上线吗？" | "这段代码写得对吗？" |

**对 spec-first 的启发**：应考虑引入面向非技术决策者的交付审查能力，尤其是当 AI 生成代码成为常态后，PM/Founder 需要一个不需要逐行读代码就能判断"能不能上线"的审查界面。

### 4.3 链式命令 vs Agent 编排

**pm-skills 的 Commands 编排**：显式、用户可见、可触发、可复用。

```
/discover
  ├── brainstorm-ideas         (Skill 1)
  ├── identify-assumptions     (Skill 2)
  ├── prioritize-assumptions   (Skill 3)
  └── brainstorm-experiments   (Skill 4)
```

特征：
- **用户可见**：每个 Command 对应一个明确的斜杠入口
- **显式链式**：Skill 之间的串联关系在 Command 定义中明确声明
- **跨 Command 共享**：同一个 Skill（如 `prioritization-frameworks`）可被多个 Command 复用
- **工作流推荐**：命令完成后主动推荐下一步操作

**spec-first 的 Agent 编排**：隐式、阶段 Skill 内部调度、对外暴露统一接口。

```
Plan 阶段 Skill
  └── [内部调度多个 Agent，外部不可见]
```

特征：
- **黑盒化**：Agent 编排逻辑隐藏在阶段 Skill 内部
- **强封装**：对外暴露统一的阶段接口
- **灵活性受限**：用户无法直接调用中间 Agent 或重组编排顺序

**优劣对比**：

| 维度 | pm-skills Commands | spec-first Agent 编排 |
|------|-------------------|----------------------|
| **可发现性** | 高——/command 列表一目了然 | 低——用户需理解阶段 Skill 内部结构 |
| **可复用性** | 高——Skill 跨 Command 共享 | 中——Agent 绑定阶段，跨阶段复用待验证 |
| **编排灵活性** | 高——用户可自定义 Command | 低——编排逻辑封装在 Skill 内 |
| **学习成本** | 低——斜杠命令即语义入口 | 高——需理解阶段与 Agent 映射 |
| **扩展性** | 高——新增 Command 只需声明 Skill 链 | 中——新增阶段需修改编排逻辑 |
| **适合场景** | 面向领域专家的专业工作流 | 面向技术流程的工程编排 |

### 4.4 方法论理论基础

**pm-skills 的理论根基**：
- Teresa Torres（*Continuous Discovery Habits*）：机会解决方案树、持续发现
- Marty Cagan（*INSPIRED* / *TRANSFORMED*）：产品战略九部分画布、赋能产品团队
- Alberto Savoia（*The Right It*）：预型测试、假设优先级
- Dan Olsen（*The Lean Product Playbook*）：结构化 PRD
- Porter's Five Forces、Ansoff Matrix、JTBD、North Star Metric、OKR 等

**spec-first 的理论根基**：
- Harness Engineering：以工程化流程编排 AI 开发
- SDD（Spec-Driven Development）：以规范文档驱动开发
- Compound Engineering：多 Agent 复合编排

**差异分析**：

1. **可教学性**：pm-skills 的每个 Skill 背后都有可引用的经典文献和成熟框架。一个 PM 可以通过学习 Skill 背后的方法论来提升自己的产品判断力——Skill 既是工具也是教材。spec-first 的 Agent 编排更偏向工程实践经验的沉淀，缺少可溯源的经典文献支撑。

2. **可迁移性**：pm-skills 的方法论不依赖特定技术栈——Teresa Torres 的持续发现无论用 Claude Code 还是 Cursor 都适用。spec-first 的 Agent 编排与 Claude Code 生态绑定较深，跨平台迁移时编排逻辑需要适配。

3. **领域深度 vs 工程广度**：pm-skills 在 PM 领域纵向深耕（68 个 Skills 覆盖从发现到交付），spec-first 在开发流程横向覆盖（Bootstrap 到 Compound 七个阶段）。前者追求领域专业度，后者追求流程完整度。

4. **对 spec-first 的启发**：spec-first 的每个阶段是否可以对应到具体的工程方法论文献（如 SDD 对应哪个论文、Compound Engineering 的理论基础是什么），增强其"可教学性"。

---

## 五、知识链收束

### 5.1 pm-skills 在 AI Coding 研发体系中的位置

基于前序调研的 AI Coding 研发体系（六层架构/流程层/五级能力模型），pm-skills 处于：

- **流程层**：覆盖从需求发现到交付审查的完整 PM 工作流，与 AI Coding 体系中的"需求分析 → 方案设计"阶段高度重叠
- **能力层级**：按照五级能力模型（L1 辅助 → L2 协作 → L3 自动化 → L4 自主 → L5 智能），pm-skills 的 Skills 和 Commands 主要处于 **L2-L3**
  - Skills 提供结构化的方法论指导（L2 协作）
  - Commands 实现端到端工作流自动化（L3 自动化）
  - `/red-team-prd` 的对抗性审查和对下一步操作的主动推荐，开始涉及 L4 自主能力的雏形

### 5.2 与 Compound Engineering 的规模镜像对照

| 维度 | pm-skills | Compound Engineering |
|------|-----------|---------------------|
| 技能/Agent 数 | 68 Skills | 37 Skills + 51 Agents |
| 编排层 | 42 Commands | 阶段 Skill 内部 Agent 编排 |
| 编排可见性 | 显式（Commands 定义可见） | 隐式（阶段 Skill 封装） |
| 领域覆盖 | PM 全流程（discovery → shipping） | 开发全流程（Bootstrap → Compound） |
| 跨平台 | 7 个平台 | Claude Code 为主 |

结构差异的关键点：规模相近（68 vs. 88），但 pm-skills 选择了"显式链式命令"的编排范式，Compound Engineering 选择了"隐式 Agent 编排"的封装范式。

### 5.3 与 design.md 的技术合约机制对照

前序 design.md 分析中提出了"技术合约"概念——将设计决策显式化为可验证的约束。pm-skills 中是否有类似机制？

- **pm-skills 的"合约"**：`/ship-check` 中的 intended-vs-implemented 审计本质上就是一种技术合约验证——产品意图（PM 定义的需求）是"合约"，代码实现是"履约"，审计在比对合约是否被正确履行。
- **差异**：spec-first 的技术合约偏向"代码间的契约"（接口/类型/测试），pm-skills 的合约偏向"人与代码间的契约"（PM 意图 vs. 开发实现）。
- **互补性**：两者可以结合——spec-first 增加 PM 视角的意图-实现审计，pm-skills 借鉴 spec-first 的自动化技术合约验证。

### 5.4 Agent 配置文件规范对比

| 维度 | pm-skills SKILL.md | spec-first CLAUDE.md / AGENTS.md |
|------|-------------------|----------------------------------|
| 文件格式 | 通用 Skill 格式（Markdown，含领域知识、框架定义、输出模板） | Markdown 格式（含 Agent 角色、工具权限、工作流指令） |
| 组织方式 | `skills/{phase-skill}/SKILL.md` + `references/{TEMPLATE.md, EXAMPLE.md}` | 项目级 `CLAUDE.md` / 阶段级 `AGENTS.md` |
| 自动加载 | 对话上下文匹配时自动加载 | 按阶段或项目上下文手动/自动加载 |
| 可移植性 | Skills 文件可跨 7 个平台复制使用 | Claude-specific，跨平台需适配 |
| 粒度 | 单一方法框架（如 `opportunity-solution-tree` 的完整定义和输出模板） | 复合角色（Agent 内含多步骤工作流） |

pm-skills 的 SKILL.md 格式更接近"方法卡片"——每个文件编码一个完整的 PM 框架并附带模板和示例；spec-first 的 AGENTS.md 更像"角色说明书"——描述 Agent 的职责和能力边界。

---

## 六、分级改进建议

### P0（应立即借鉴）

#### 1. 在 Plan 或 Review 阶段引入 pre-mortem / red-team 思维

**核心问题**：spec-first 的审查发生于实现之后，此时修复假设错误成本已高。

**建议方案**：
- 在 Plan 阶段末尾或 Review 阶段起始位置增加 **pre-mortem Agent**——假设方案已经失败，从代码实现角度倒推可能的技术债务、架构风险、集成问题
- 在方案确定前增加 **red-team Agent**——从攻击者视角挑战技术决策，列出最可能翻车的假设并按影响 × 概率排序
- 参考 pm-skills 的 `/red-team-prd` 指令结构：不制造虚假疑虑，而是基于真实约束找出"五条能杀死方案的假设"

**预期收益**：
- 在最便宜的阶段暴露风险
- 降低后期返工成本
- 提升方案质量（经受过攻击的方案才是可信的方案）

#### 2. 显式化 Skill 级别的复用关系

**核心问题**：spec-first 的 Agent 编排隐藏在阶段 Skill 内部，跨阶段共享性不可见。

**建议方案**：
- 识别跨阶段可复用的原子能力（如代码分析、测试生成、文档生成），将其抽象为可共享的 Agent
- 参考 pm-skills 中 `prioritization-frameworks` 被 `/discover`、`/write-prd`、`/triage-requests` 三个 Command 共享的模式
- 在 Agent 配置文件中标注复用关系

### P1（应在下个迭代引入）

#### 3. 考虑 PM 视角的交付审查（类似 /ship-check）

**核心问题**：spec-first 的 Review Agent 面向工程师，非技术决策者无法独立判断"能不能上线"。

**建议方案**：
- 新增 **Shipping Agent** 或扩展 Review Agent，增加以下能力：
  - `shipping-artifacts`：生成面向非技术审查者的交付文档集（架构概览、权限矩阵、关键流程、测试覆盖摘要）
  - `intended-vs-implemented`：比对 spec.md 中的技术意图与实际代码实现的一致性
  - 编译 **Shipping Packet**：将代码审查结果翻译为 PM/Founder 可理解的上线检查清单
- 面向场景：AI 生成的代码、快速原型、内部工具的上线前审查

**预期收益**：
- 降低非技术决策者的代码审查门槛
- 为 AI 编码时代的上线决策提供结构化的责任追溯
- 补齐 spec-first 从工程师视角到决策者视角的能力缺口

#### 4. 显式化链式工作流——让 Commands 链式编排可见、可复用

**核心问题**：spec-first 的阶段 Skill 对用户而言是黑盒，用户不知道 Agent 如何编排、无法自定义工作流。

**建议方案**：
- 参考 pm-skills 的 Commands 设计，为 spec-first 增加**显式工作流定义层**：
  - 每个阶段 Skill 的输出中包含"内部 Agent 编排链路"的可视化说明
  - 允许高级用户自定义 Agent 编排顺序（类似自定义 Command）
  - 工作流完成后推荐自然的下一步骤
- 不完全抛弃隐式编排（保持简易使用场景的友好性），但在高级模式下开放编排可见性

### P2（中长期探索）

#### 5. Plugin 市场机制——按领域打包 Skills，降低安装门槛

**核心问题**：spec-first 目前以 npm 包 + CLI 安装，非开发者安装门槛高。

**建议方案**：
- 按开发领域打包 Agent（如 Frontend Plugin / Backend Plugin / DevOps Plugin / Data Plugin）
- 参考 pm-skills 的 Marketplace 机制：一个 GitHub 仓库管理所有 Plugin，GUI 一键安装
- 长期目标：建立类似 pm-skills 的 Plugin 生态，允许社区贡献领域 Plugin

#### 6. 方法论理论基础建设

**核心问题**：spec-first 的每个阶段缺乏可溯源的经典工程方法论文献支撑，可教学性弱。

**建议方案**：
- 为每个阶段 Skill 明确标注对应的方法论文献：
  - Bootstrap → 项目启动最佳实践（来源）
  - Plan → Spec-Driven Development（来源）
  - Work → Harness Engineering（来源）
  - Review → 代码审查最佳实践（来源）
  - Compound → Compound Engineering（来源）
- 在 Agent 配置文件（AGENTS.md）中增加 `methodology` 字段引用方法论文献
- 长期目标：建立 spec-first 自己的方法论体系（参考 pm-skills 对 Torres/Cagan/Savoia 的引用方式）

#### 7. PM Brain 式上下文管理

**核心问题**：spec-first 的上下文文件（spec.md / plan.md / decisions.md）偏向工程视角，缺少产品决策的结构化上下文。

**建议方案**：
- 为 spec-first 增加结构化的"项目第二大脑"：
  - 产品策略上下文（目标用户、价值主张、竞品定位）
  - 技术决策上下文（架构决策记录 ADR、技术选型理由）
  - 假设与实验上下文（待验证假设、实验设计、验证结果）
- 参考 pm-skills 的 PM Brain 设计：纯 Markdown 文件，本地化存储，可被 Agent 在相关上下文中自动加载
- 与现有 spec.md / plan.md / decisions.md 互补而非替代

---

## 七、结论

**pm-skills 对 spec-first 的核心启发**：**在编码之前先攻击自己，在交付之前先审计意图。**

pm-skills 证明了两件很重要的事：
1. 将领域方法论编码为 AI 可调用的结构化工作流，不仅可行而且有强烈的市场需求（13.3k Star 在短时间内获得）；
2. "意图 vs. 实现"的审计视角填补了 AI 编码时代的关键能力缺口——当代码由 AI 生成，人类需要的不只是代码审查，而是"我想要的"和"AI 给的"是否一致的系统性比对。

spec-first 作为 AI 编码研发体系，在工程流程的完整性和 Agent 编排的深度上已经建立了扎实的基础。pm-skills 带来的最大启示是：**将"攻击自己的假设"和"审计意图的实现"这两个视角融入体系，将极大提升 spec-first 在方案质量和交付可靠性上的能力上限。**
*（内容由AI生成，仅供参考）*
