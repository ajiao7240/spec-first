---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a88644969371398a873cabeac0a028ab_4e943461662c11f1aa625254006c9bbf
    ReservedCode1: QBCw+EaTnUNDZKj0ETeM8uwphtvE8RdrIKlsaL8pIEUITToo3/FnL6H1DSQ4S941FEimr4R/DdZrDUZVzbHyAjFp5ibCs9prGbpA2XubFp6resxbpppA/2PCVlYA96VH799Mr6aMBN/h5vBruq26ZQq6dTaZ4I+3XKkSKERiKY61yCfZJDEIv9gQ5bs=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a88644969371398a873cabeac0a028ab_4e943461662c11f1aa625254006c9bbf
    ReservedCode2: QBCw+EaTnUNDZKj0ETeM8uwphtvE8RdrIKlsaL8pIEUITToo3/FnL6H1DSQ4S941FEimr4R/DdZrDUZVzbHyAjFp5ibCs9prGbpA2XubFp6resxbpppA/2PCVlYA96VH799Mr6aMBN/h5vBruq26ZQq6dTaZ4I+3XKkSKERiKY61yCfZJDEIv9gQ5bs=
---

# Claude Code + OpenSpec + Superpowers 联合开发流程深度分析：与 spec-first 逐维度对照

> **分析日期**：2026-06-12
> **分析对象**：OpenSpec（Fission-AI，37K+ GitHub Star）+ Superpowers（Jesse Vincent / obra，开源）
> **对照对象**：spec-first（AI 编码研发体系）
> **数据来源**：微信推文「Claude Code + OpenSpec + Superpowers 开发协作流程深度细化」全文、OpenSpec 官方文档与 Quick Start、Superpowers 架构文档（BestHub / 53AI / 博客园 / Bswen）、ThoughtWorks 技术雷达、Solosoft 深度解析、Zenn 日文实践报告、CSDN 得物技术实战

---

## 一、项目概述

### 1.1 OpenSpec

**定位**：面向 AI 编码时代的规格驱动开发（Spec-Driven Development, SDD）框架，解决「在写代码之前，人类和 AI 就"要构建什么"达成一致」的核心问题。

| 维度 | 详情 |
|------|------|
| 作者/组织 | Fission-AI |
| GitHub Star | 37,000+ |
| 开源协议 | MIT License |
| 技术栈 | Node.js + TypeScript CLI，轻量级设计 |
| 核心特点 | 无需 API 密钥，无需 MCP 配置 |
| 四步生命周期 | Draft（起草）→ Review（审查）→ Implement（实现）→ Archive（归档） |
| 核心产出 | proposal.md + design.md + tasks.md + spec.md（四件套） |
| 设计哲学 | 「活文档」（Living Documentation）——规格不是一次性产物，而是与代码共生的功能需求记录 |
| 集成工具 | Claude Code、Cursor、GitHub Copilot、Amazon Q Developer、Windsurf、Aider |
| 关键差异化 | Delta Specs（增量规格）、Brownfield-first（面向存量项目）、工具无关（文件驱动而非 API 绑定） |

OpenSpec 在 ThoughtWorks 2026 年 4 月技术雷达中被特别点评：*"我们尤其欣赏 OpenSpec 聚焦增量规格（spec deltas）而非预先定义完整规格的做法，这使得它特别适合存量系统。"*

### 1.2 Superpowers

**定位**：面向 Claude Code 的完整软件工程 Pipeline 插件，通过 20+ 可组合 Skills 覆盖需求梳理、架构设计、TDD、代码审查和分支管理等完整软件开发生命周期。

| 维度 | 详情 |
|------|------|
| 作者 | Jesse Vincent（GitHub: obra） |
| 创建时间 | 2025 年 10 月 |
| 开源协议 | 开源 |
| 四层架构 | User Layer（跨平台）→ Framework Layer（Session Hook 注入）→ Execution Layer（子代理调度）→ Output Layer（Git 管理） |
| 核心机制 | Subagent-Driven Development —— 每个 step 在全新子代理中执行（上下文隔离），完成后由独立审查子代理检查 |
| 双阶段审查 | Stage 1: Spec Compliance Reviewer（功能完整性、边界处理、测试覆盖）；Stage 2: Code Quality Reviewer（可维护性、风格、DRY、命名、过度工程） |
| 七阶段工作流 | Brainstorming → Git Worktree → Writing Plans → Subagent Development → TDD → Code Review → Finish Branch |
| 执行模式 | Subagent-Driven（自动两阶段审查，适合明确任务）与 Executing Plans（人工检查点，适合探索性任务） |
| TDD | 内置强制——步骤结构化为 RED-GREEN-REFACTOR 循环，Implementer 先写测试再实现 |

### 1.3 联合工作流全景

以微信推文中的真实案例「给情报平台加一个按周统计分析功能」为线索：

```
用户一句话需求
       │
       ▼
┌─────────────────────────────────────────────┐
│ OpenSpec: Draft（propose）                    │
│ 自动生成 proposal.md / design.md /           │
│ tasks.md / spec.md                           │
│                                               │
│ 人类审核 → 自然语言交互修改 → 确认            │
└─────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│ Superpowers: Brainstorming（自动触发）        │
│ 苏格拉底式追问（数据策略、定义、交互方案）     │
│ → 方案对比 + 推荐 + 确认 → 决策记录           │
└─────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│ Superpowers: Writing Plans（自动触发）        │
│ 每个 step 细化到输入/输出/验收标准             │
│ 2-5 分钟原子任务粒度                           │
└─────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│ Superpowers: Execution                       │
│ 子代理驱动模式：                              │
│   Implementer（TDD）→                        │
│   Spec Reviewer →                            │
│   Code Quality Reviewer                      │
│ 每个 Task 重复上述循环                         │
└─────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│ OpenSpec: Archive                            │
│ 移动到 archive/ → 更新 specs/ → 决策记录保存  │
└─────────────────────────────────────────────┘
```

---

## 二、与 spec-first 逐维度对照

### 2.1 矩阵对照表

| 维度 | OpenSpec + Superpowers | spec-first |
|------|----------------------|------------|
| **定位** | 规格驱动开发框架 + 完整软件工程执行 Pipeline | AI 编码研发体系（37 Skills + 51 Agents） |
| **需求入口** | 一句话自然语言 → OpenSpec 自动生成四份结构化文档 | 用户自由对话 → phase Skill 引导阶段化产出 |
| **文档体系** | proposal.md + design.md + tasks.md + spec.md（四件套，强制统一） | spec.md + plan.md + decisions.md（三件套，无 tasks.md） |
| **工作流阶段** | Draft → Review → Implement → Archive（OpenSpec）

Brainstorming → Git Worktree → Writing Plans → Subagent Dev → TDD → Code Review → Finish（Superpowers） | Bootstrap → Ideate → Brainstorm → Plan → Work → Review → Compound（七阶段） |
| **需求澄清** | Superpowers Socratic Questioning（主动追问 + 方案对比 + 推荐确认） | Brainstorm phase 内 Agent 自由对话 |
| **任务拆解** | Writing Plans：原子 step，每个 2-5 分钟，含完整输入/输出/验收标准 | Plan phase：Agent 自主规划，无强制 step 粒化 |
| **执行模式** | 子代理驱动：Implementer → Spec Reviewer → Quality Reviewer（三子代理接力） | Agent 编排：阶段 Skill 内隐式调度 Agents |
| **审查机制** | 双阶段强制审查（Spec Compliance + Code Quality），每个 step 完成后自动触发 | Review phase 单阶段结构化审查（Code Review Agent） |
| **测试策略** | TDD 内置强制——先写测试再实现，步骤结构化为 RED-GREEN-REFACTOR | 测试非强制，依赖 Agent 自觉 |
| **归档机制** | 显式 Archive：移至 archive/ + 合并到 specs/ + 决策记录持久化（知识复利） | 无正式归档流程，文档随代码库留存 |
| **上下文管理** | 每个 step 全新子代理（上下文隔离，防膨胀） | Agent 会话级上下文管理 |
| **环境隔离** | Git Worktree 独立工作空间 | 无内置环境隔离机制 |
| **集成环境** | Claude Code / Cursor / Copilot / Amazon Q / Windsurf / Aider | Claude Code 为主 |
| **开源协议** | MIT（OpenSpec）/ 开源（Superpowers） | 未公开 |
| **活文档哲学** | 规格与代码共生，archive 后可复用；后续需求可参考 archive 快速启动 | 文档随对话产生，缺乏显式归档与复用机制 |
| **技能/插件规模** | OpenSpec CLI + 20+ Superpowers Skills | 37 Skills + 51 Agents |
| **阶段切换** | Superpowers Session Hook 自动触发下一阶段 | 用户手动触发或 Skill 内部指引 |

---

## 三、关键差异深度分析

### 3.1 「四件套文档体系」 vs 「阶段化产出」

#### OpenSpec 四件套的结构化约束

OpenSpec 强制每个变更产生四份固定文档：

```
openspec/changes/<change-name>/
├── proposal.md    ← 为什么做：背景、目标、范围、边界
├── design.md      ← 怎么做：技术方案、模块设计、数据库变更
├── tasks.md       ← 分几步：原子任务拆解（可勾选项）
└── specs/         ← 做成什么样：功能规格定义（Delta Specs）
    └── <feature>/
        └── spec.md
```

**深层设计意图**：
- `proposal.md` 解决「做不做」——在编码前对齐预期，防止实现完才发现方向不对
- `design.md` 解决「怎么做」——固化技术决策，让后续维护者/AI 知道当初为什么这么设计
- `tasks.md` 解决「按什么顺序做」——将设计转化为可执行、可追踪、可勾选的清单
- `spec.md` 解决「做成什么样才算完」——可验证的验收标准，Delta Specs 只记录增量变更

**spec-first 的阶段化产出特点**：
- `spec.md` 在 Bootstrap/Ideate 阶段产出，侧重功能需求描述
- `plan.md` 在 Plan 阶段产出，侧重实施规划
- `decisions.md` 记录关键设计决策
- 无强制 `tasks.md`——任务粒度由 Agent 自主决定

#### 优劣对比

| 维度 | OpenSpec 强制四件套 | spec-first 阶段化产出 |
|------|-------------------|---------------------|
| **结构统一性** | 高——每个变更产出完全一致 | 中——依赖阶段 Skill 指引，存在弹性 |
| **可预测性** | 高——下游流程（Implement/Review）预期输入固定 | 中——Agent 需理解不同产出的语义 |
| **Archive 后可复用性** | 高——标准化文档可直接作为新需求的参考模板 | 低——缺少统一格式，复用需要人工理解 |
| **灵活性** | 低——小需求也会产生四份文档（过度工程风险） | 高——Agent 可自主判断产出粒度和文档数量 |
| **知识复利** | 强——archive 后每份文档都是资产 | 弱——文档可能在对话中消散 |

**核心洞察**：四件套的本质不是「多写文档」，而是「建立结构化共识」。tasks.md 是最被低估的产出——它承担了 Plan 阶段的核心职责（任务拆解），同时是 Work 阶段的执行脚本、Review 阶段的检查清单、Archive 后的知识资产。这种「一物多用」的设计在 spec-first 中缺失。

---

### 3.2 「原子 Step + TDD 内置 + 双审查」 vs 「Agent 自主执行」

#### Superpowers 的执行铁三角

这是 Superpowers 对 AI 编码最深刻的工程化贡献。每个 step 经历三道防线：

```
  Implementer                 Spec Reviewer          Quality Reviewer
  (先测后写)       ──→      (按 spec.md 对照)  ──→   (检查代码质量)
```

**第一道防线：Implementer（TDD 内置）**

Implementer 的执行步骤被硬编码为 RED-GREEN-REFACTOR：
1. 写失败测试
2. 运行测试，确认失败
3. 写最小实现
4. 运行测试，确认通过
5. Commit

这不是建议，是结构——Implementer 如果跳过测试直接写实现，Spec Reviewer 会立即拒绝。

**第二道防线：Spec Reviewer（需求合规）**

Spec Reviewer 只问一个问题：「实现是否满足规格？」审查点：
- 是否实现了所有要求的功能点
- 边界条件是否处理
- 测试是否覆盖规格要求
- **不关注代码风格或实现细节**

**第三道防线：Quality Reviewer（代码质量）**

Quality Reviewer 只问一个问题：「实现是否易读、可维护？」审查点：
- 是否遵循项目代码风格
- 是否存在重复代码（DRY）
- 命名是否清晰
- 是否出现过度工程化

**为什么必须是两道而非一道**：将审查拆分为两个独立阶段，避免了常见评审陷阱——在讨论代码风格时忽略功能缺陷、因实现"看起来不错"而放松对需求完整性的检查、审查意见混杂导致难以区分优先级。

#### spec-first 的执行模式

spec-first 的 Work phase 中，Agent 在共享会话上下文中连续执行任务，审查在 Review phase 集中进行。特点：
- Agent 自主判断实现顺序和方式
- 测试由 Agent 自觉编写，非强制
- 审查在事后集中进行

#### 对比分析

| 维度 | Superpowers 原子 Step + 铁三角 | spec-first Agent 自主执行 |
|------|-------------------------------|-------------------------|
| **上下文隔离** | 每个 step 全新子代理，防止上下文漂移 | 共享会话上下文，存在累积偏差风险 |
| **测试保证** | 结构强制 TDD，不可跳过 | 依赖 Agent 自觉，可能被省略 |
| **审查触发** | 自动触发，不可跳过 | phase 流程触发，但可能因上下文复杂被稀释 |
| **失败代价** | 单步失败影响局部，快速重试 | 全流程失败后需回退 |
| **审查分工** | 需求合规与代码质量分离 | 单次审查覆盖所有维度 |
| **开发者心智负担** | 低——流程驱动力强 | 中——需主动关注审查和测试 |

**核心洞察**：Superpowers 执行铁三角的实质是把「质量保障」从「人的习惯」变成「系统的结构」。传统开发中测试覆盖率取决于开发者是否勤快、代码审查取决于 reviewer 是否认真——SDD 流程中两者都是强制的、自动触发的。

---

### 3.3 「苏格拉底式追问」 vs 「Agent 自由对话」

#### Superpowers Brainstorming 的追问机制

Superpowers 的 Brainstorming 阶段不是普通的「AI 问几个问题」，而是一套结构化的设计决策推导流程：

**追问模式**：
1. 识别一个未被明确的设计决策点
2. 提出 2-3 个可选方案
3. 分析各方案优劣
4. 推荐最优方案 + 理由
5. 等待人类确认
6. 记录决策到 design-decisions.md

案例中的实际对话链：
```
数据查询策略？→ A（实时）/B（预计算）/C（缓存）→ 推荐 B → 确认
高危定义标准？→ 基于 severity >= 4 → 确认
周选择器交互？→ A（下拉）/B（日期）/C（箭头）→ 推荐 B+C → 确认
```

**关键设计**：
- 每次只问一个问题（避免认知超载）
- 每次都给出方案对比（不是空泛的「你觉得呢」）
- 每次都推荐并附理由（发挥专家引导作用）
- 每次确认后写入决策记录（知识沉淀）

#### spec-first 的 Brainstorm 对话

spec-first 的 Brainstorm phase 中，Agent 与用户进行开放式对话以澄清需求。特点：
- 更依赖 Agent 的自主判断
- 更依赖用户的主导权
- 对话节奏由用户控制

#### 对比分析

| 维度 | Superpowers Socratic Questioning | spec-first Agent 对话 |
|------|--------------------------------|----------------------|
| **主动性** | 强——AI 主动识别遗漏决策点并追问 | 中——AI 响应式对话，依赖用户引导 |
| **结构化** | 强——方案对比 + 推荐 + 确认固定模板 | 弱——对话风格随 Agent 不同而变化 |
| **决策记录** | 强制——每次确认后写入 design-decisions.md | 可选——decisions.md 不一定被更新 |
| **追问粒度** | 一次一个问题，降低认知负荷 | 可能同时提出多个问题 |
| **专家感** | 「专家引导」模式 | 「协作者辅助」模式 |

**核心洞察**：Brainstorming 阶段的质量决定了后续所有阶段的质量。Superpowers 的 Socratic 追问模式确保在开始编码前暴露所有关键设计决策点，并用结构化决策记录固化下来。这对复杂需求的价值尤为显著——减少了「实现到一半才发现方向有误」的风险。

---

### 3.4 归档机制差异：知识的复利效应

这是 OpenSpec 的 Archive 与 spec-first 的文档留存之间最本质的差异。

#### OpenSpec Archive 的完整闭环

```
归档操作（/openspec:archive）触发：

1. 移动 openspec/changes/<change>/
   → openspec/archive/<change>/
   （保留 proposal.md / design.md / tasks.md / decisions.md / specs/）

2. 合并规格变更
   → openspec/specs/<project>/<feature>.md
   （将 delta specs 合并到主规格库）

3. 标记完成日期和状态

结果：
- openspec/changes/ 始终为空（等待下一个需求）
- openspec/archive/ 积累每次开发的完整知识
- openspec/specs/ 是当前系统的实时规格字典
```

#### Archive 的核心价值：知识复利

案例中最具启发性的场景——三个月后新需求「按月统计」：

```bash
> 参考 openspec/archive/weekly-analytics/ 的方案，加一个按月统计功能
```

Claude Code 读取归档文档后，可以：
- 复用已有设计方案（统计查询模式、汇总表策略）
- 复用任务结构（后端核心逻辑 → API → 前端）
- 参考过往决策记录（为什么用预计算而非实时查询）
- 快速生成新变更提案

**没有 Archive 的结果**：每次新需求从零开始——重新设计、重新讨论、重新拆任务。这就是「知识只存在于对话历史中，随着会话结束而消散」的困境。

#### spec-first 的现状

| 维度 | OpenSpec Archive | spec-first |
|------|----------------|-----------|
| **归档触发** | 命令显式触发 | 无正式触发机制 |
| **归档内容** | 完整四件套 + 决策记录 | 依赖对话中产生的文档 |
| **合并机制** | Delta Specs 自动合并到 specs/ | 无 |
| **可检索性** | 归档目录结构化、可浏览 | 依赖文件系统搜索 |
| **后续复用** | 直接引用 archive/ 路径 | 需要人工定位和回忆 |
| **知识复利** | 每次开发都是对知识库的增量贡献 | 知识可能随会话消散 |

**核心洞察**：Archive 是 SDD 流程中被严重低估的环节。没有归档，规格驱动开发只完成了一半——驱动了「这次开发」但没驱动「下次开发」。Archive 的本质是让每次开发的经验变成可复用的资产，实现「知识复利」——团队的开发经验随时间不断积累，而非不断遗忘。

---

## 四、知识链收束

本节将此分析与 AI Coding 研发体系前序调研链路衔接，形成完整的知识图谱。

### 4.1 与前序调研链路的衔接

#### 4.1.1 流程层映射

AI Coding 研发体系系列已覆盖多个流程框架的对照分析。OpenSpec 的 Draft → Review → Implement → Archive 与 spec-first 的 Bootstrap → Ideate → Brainstorm → Plan → Work → Review → Compound 存在清晰的映射关系：

| OpenSpec + Superpowers 阶段 | spec-first 对应阶段 | 映射关系 |
|---------------------------|-------------------|---------|
| Draft（OpenSpec propose） | Bootstrap + Ideate | OpenSpec 更结构化（固定四点产出），spec-first 更灵活（弹性文档产出） |
| Review（人工审核四件套） | Brainstorm | Superpowers 的 Socratic Questioning 是 Brainstorm 的增强版——从「自由对话」升级为「方案对比 + 推荐 + 确认」 |
| — | Plan | 这一阶段 spec-first 存在而 OpenSpec 原始流程缺失——但 Superpowers 的 Writing Plans 填补了此处空白 |
| Implement（/openspec:apply） | Work | Superpowers 的子代理铁三角（Implementer → Spec Reviewer → Quality Reviewer）是 Work 阶段的工程化增强 |
| — | Review | Superpowers 将 Review 前移并拆分到每个 step 内（Spec + Quality），spec-first 的 Review 在事后集中进行 |
| Archive（/openspec:archive） | Compound | OpenSpec Archive 是 Compound 的结构化版本——从「文档留存」升级为「知识合并 + 可复用归档」 |

**关键发现**：OpenSpec 原始四阶段缺 Plan（任务拆解）环节——这正是 Superpowers 的 Writing Plans 所填补的。两者组合后才形成完整的需求 → 设计 → 计划 → 执行 → 归档闭环。

#### 4.1.2 方法论层衔接：与 pm-skills 分析的共通理念

**上一轮 pm-skills 分析**指出，pm-skills 的 `/red-team-prd`（攻击自己的 PRD）与 Superpowers 的 Socratic Questioning（追问设计决策）在「持续发现假设」上共享共通理念：

| 维度 | pm-skills /red-team-prd | Superpowers Socratic Questioning |
|------|------------------------|--------------------------------|
| 目标 | 发现 PRD 中的假设和盲点 | 发现需求中未明确的设计决策点 |
| 方法 | CRITIC 视角攻击——**不放过任何未经检验的假设** | 方案对比 + 推荐——**不给模糊空间留余地** |
| 产出 | 发现错误假设、遗漏风险、未明确定义 | 结构化决策记录 design-decisions.md |
| 核心理念 | 「发现错误的时间越早，修复成本越低」 | 「共识在编码前达成，偏离在实现中杜绝」 |

两者都体现了「在行动之前穷尽所有假设」的工程哲学，只是在不同的流程阶段发挥作用。

#### 4.1.3 规模层对比：Compound Engineering 视角

spec-first 的设计哲学是 Compound Engineering——通过 37 Skills + 51 Agents 的组合构建完整的研发体系。Superpowers 采用不同的工程策略：

| 维度 | spec-first（Compound Engineering） | Superpowers（子代理模型） |
|------|----------------------------------|-------------------------|
| 设计哲学 | 多 Skill / Agent 组合，覆盖面广 | 少而精的核心 Skills，深度聚焦 |
| 核心数量 | 37 Skills + 51 Agents | 20+ Skills，核心 5-7 个 |
| 扩展方式 | 新增 Skill/Agent | 覆盖机制——不修改框架代码即可定制 |
| 灵活性 | 高——可组合性强 | 中——流程约束更强 |
| 学习成本 | 高——需要理解 Skill 间依赖 | 中——七阶段线性流程更直观 |

**核心洞察**：两者代表了不同的工程哲学。spec-first 追求「广度」——通过大量 Skill/Agent 组合覆盖各类场景；Superpowers 追求「深度」——通过少量精心设计的阶段 + 强约束保证质量基线。两者的选择取决于团队规模、项目复杂度和对质量保障的要求。

#### 4.1.4 design.md 差异

OpenSpec 的 design.md 与 spec-first 的 design.md 存在显著差异：

| 维度 | OpenSpec design.md | spec-first design.md |
|------|-------------------|---------------------|
| 生成时机 | Draft 阶段（在代码编写之前） | Plan 阶段后 |
| 内容侧重 | 技术方案选择、数据库变更、代码结构修改、trade-off 分析 | 实施规划、架构分析 |
| 决策记录 | 与 design-decisions.md 互补 | 决策可能内嵌于 design.md |
| 后续价值 | Archive 后成为可复用参考 | 随代码留存 |

#### 4.1.5 Agent 配置与注入机制对比

| 维度 | Superpowers Session Hook | spec-first Phase Skill Loading |
|------|-------------------------|-------------------------------|
| 注入方式 | 会话开始时自动注入 Skill 上下文 | 按需加载 phase Skill |
| 触发条件 | 自动检测状态（如 OpenSpec 确认后自动进 Brainstorming） | 用户手动或 Skill 内部指引 |
| 阶段过渡 | 无缝自动切换 | 需显式切换 |
| 开发体验 | 「不用记下一步做什么」 | 「需要知道调用哪个 phase」 |

---

## 五、分级改进建议

基于以上逐维度分析，对 spec-first 提出以下分级改进建议：

### P0（应立即借鉴 —— 对质量和可靠性有实质提升）

#### 1. 引入 `tasks.md` 作为强制产出物

**现状**：spec-first 的 Plan 阶段产出 plan.md，但任务拆解粒度由 Agent 自主决定，可能不够原子化。

**建议**：
- 将 Plan 阶段产出从单一 plan.md 扩展为 plan.md + tasks.md
- `tasks.md` 的每个 step 必须包含：输入 / 输出 / 验收标准（三元组）
- 每个 step 的目标粒度：一个子代理调用即可完成，2-5 分钟执行时间
- tasks.md 同时担当：Plan 阶段的产出、Work 阶段的执行脚本、Review 阶段的检查清单

**参考案例**：OpenSpec tasks.md 中的 step 格式：
```
## Step 1.2：实现 IOC 总量统计查询
- 输入：start_date, end_date
- 输出：该时间范围内的 IOC 总数（整数）
- 验收标准：
  - 查询语句使用 COUNT(*)，WHERE created_at BETWEEN start AND end
  - 空范围返回 0，不抛异常
  - 单元测试覆盖：有数据、无数据、跨月数据三种情况
```

#### 2. 引入强制测试策略

**现状**：spec-first 的测试依赖 Agent 自觉，Work phase 中测试非强制。

**建议**：
- 在 Work phase 的 Skill 指令中内置 TDD 步骤序列：
  1. 先写失败测试
  2. 确认测试失败
  3. 写最小实现
  4. 确认测试通过
  5. Commit
- Skill 指令中明确：如果跳过测试直接实现 → 视为不符合流程规范
- 不要求每个项目都 80% 覆盖率，但要求「每个 step 的实现都有对应的测试」

---

### P1（应在下个迭代引入 —— 对流程健壮性有增量提升）

#### 3. 双阶段审查机制

**现状**：spec-first 的 Review phase 是单阶段审查，需求合规和代码质量在同一轮审查中覆盖。

**建议**：
- 将 Review phase 拆分为两道独立审查：
  - **Spec Review**：检查实现是否满足 spec.md 中的功能需求（功能完整性、边界处理、测试覆盖）
  - **Code Quality Review**：检查代码质量（可维护性、风格、DRY、命名、过度工程）
- Spec Review 不关注代码风格，Quality Review 不关注功能需求——各司其职
- 两道审查之间设置阻断：Spec Review 未通过则禁止进入 Quality Review

**设计理由**：分离审查关注点能避免「因代码风格讨论忽略功能缺陷」「因实现'看起来不错'放松需求检查」等常见审查陷阱。

#### 4. 子代理上下文隔离

**现状**：spec-first 的 Agent 在共享会话上下文中连续执行，存在上下文漂移风险。

**建议**：
- 对每个独立 task（tasks.md 中的 step）在全新子代理中执行
- 子代理仅接收：当前 step 描述 + 相关架构上下文 + 工作目录 + 约束和验收标准
- 子代理**不**继承主会话的历史上下文
- 完成后由独立的审查子代理检查

**实现要点**：
- 主 Agent 负责「精选」传递给子代理的上下文（而非全量传递）
- 子代理支持四种返回状态：DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED
- 审查未通过时自动创建新子代理重试

#### 5. 显式归档流程

**现状**：spec-first 无正式归档流程，文档随代码库留存但缺乏统一管理和复用机制。

**建议**：
- 新增 Archive phase 或在 Compound phase 中增强归档能力：

```
Archive Phase 职责：
1. 将当前变更的完整文档移到 archive/<change-name>/
2. 将增量规格合并到主 specs/ 目录
3. 记录设计决策到 decisions.md
4. 标记完成日期和状态
5. 更新 AGENTS.md（或类似上下文文件），提醒 AI 后续任务先检查归档规格
```

- 归档的核心价值：让每次开发的经验变成可复用资产，而非一次性产物

---

### P2（中长期探索 —— 对开发体验和标准化有长期价值）

#### 6. 苏格拉底式追问模式

**现状**：spec-first 的 Brainstorm 阶段依赖 Agent 自由对话，互动方式受 Agent 风格影响大。

**建议**：
- 在 Brainstorm phase 的 Skill 指令中嵌入 Socratic 追问模式：
  - 每次只问一个设计决策点
  - 每个决策点提供 2-3 个可选方案 + 优劣分析 + 推荐方案 + 理由
  - 用户确认后写入设计决策记录
  - 继续下一个决策点直至穷尽

**效果预期**：将 Brainstorm 从「Agent 被动响应」升级为「Agent 主动引导」，减少遗漏关键设计决策的风险。

#### 7. Session Hook 自动阶段切换

**现状**：spec-first 的阶段切换需要用户手动触发或 Skill 内部指引。

**建议**：
- 借鉴 Superpowers 的 Session Hook 机制，实现自动阶段检测和切换：
  - Draft 确认后自动进入 Brainstorming
  - Brainstorming 完成后自动进入 Planning
  - Planning 完成后自动进入 Execution
- 减少用户「接下来该干什么」的认知负担

#### 8. 四件套文档标准化

**现状**：spec-first 各阶段产出物格式不统一，archive 后复用困难。

**建议**：
- 统一各阶段产出为标准化文档模板：
  - spec.md（功能规格 + 验收标准）
  - plan.md（技术方案 + 架构决策）
  - tasks.md（原子任务清单 + 输入/输出/验收标准三元组）
  - decisions.md（设计决策记录）
- 标准化不是限制灵活性，而是确保「知识可被后续的 AI 和人类检索和理解」

---

## 六、结论

**一句话核心启发**：OpenSpec + Superpowers 组合对 spec-first 最核心的启发是——**「规格驱动开发的完整价值闭环不在生成文档，而在生成文档后的执行铁三角（TDD + 双审查 + 归档），以及归档带来的知识复利效应」**。四件套文档体系提供了结构化共识的起点，子代理驱动的 TDD + 双审查提供了质量内建的保障，Archive 提供了知识不断积累的载体——三者缺一不可。spec-first 在每个环节都有对应能力，但在结构化和自动化程度上存在差距，尤其在 tasks.md 的原子化拆解、TDD 的结构性强制、双阶段审查的分离设计、以及显式归档的知识复利机制这四个维度上，OpenSpec + Superpowers 的实践提供了直接可借鉴的方案。
*（内容由AI生成，仅供参考）*
