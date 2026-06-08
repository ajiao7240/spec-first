---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a88644969371398a873cabeac0a028ab_572209dd630011f1832e5254006c9bbf
    ReservedCode1: a6jvHJeFe9lQTZUPVA4/B3UzUXaHp7+KdsO1rCq6psoWwHFMbOvsIeSbOc9pMHy4LKb2dNDvEbVfaXaFLzi+wqmsbirzMJS3/0/evIWUh/Z/PcVrPLzrQW0zsnvrEOY+aQvKBmbDjFJHycY3RxuTpUld7qr24dNQdu7AZUCBPxTX/j3pdDuNOr/EKOk=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a88644969371398a873cabeac0a028ab_572209dd630011f1832e5254006c9bbf
    ReservedCode2: a6jvHJeFe9lQTZUPVA4/B3UzUXaHp7+KdsO1rCq6psoWwHFMbOvsIeSbOc9pMHy4LKb2dNDvEbVfaXaFLzi+wqmsbirzMJS3/0/evIWUh/Z/PcVrPLzrQW0zsnvrEOY+aQvKBmbDjFJHycY3RxuTpUld7qr24dNQdu7AZUCBPxTX/j3pdDuNOr/EKOk=
---

# gstack × OpenSpec × Superpowers 三层工具体系深度分析

> 分析日期：2026-06-08
> 核心问题：OpenSpec 的 Explore 需求阶段为何没有 gstack 的 Plan 阶段功能丰富？
> 前置系列：Harness Engineering 分析 | brooks-lint 集成 | 侠客汇 × PRD 改进

---

## 一、三层工具的定位全景

```
                    gstack
              ┌─────────────────┐
              │ Think → Plan    │  ← 产品/架构/设计审查（角色分离的虚拟工程团队）
              │ → Build → Review│
              │ → Test → Ship   │
              │ → Reflect       │
              └─────────────────┘
                     ↓ 产出：设计文档 / 架构方案 / 测试计划
                    
                   OpenSpec
              ┌─────────────────┐
              │ Explore → Propose│  ← 规范定义/变更追踪/增量归档（Spec-Driven）
              │ → Apply → Archive│
              └─────────────────┘
                     ↓ 产出：proposal.md / spec.md / design.md / tasks.md

                  Superpowers
              ┌─────────────────┐
              │ Brainstorming    │
              │ → Write-Plan     │  ← TDD 铁律 / 1% 规则 / Gate 机制（工程纪律）
              │ → Execute        │
              │ → Review → Finish│
              └─────────────────┘
                     ↓ 产出：设计文档 / 微小任务清单 / 验证证据
```

**一句话关系**：gstack 管"在正确阶段做正确的事"（流程治理），OpenSpec 管"做什么"（规范一致性），Superpowers 管"怎么做且做对"（工程纪律）。

---

## 二、gstack Plan 阶段：三层角色审查体系

gstack 的 Plan 阶段不是单一命令，而是由**三个独立且互补的审查角色**构成：

### 2.1 /plan-ceo-review —— 创始人视角

| 维度 | 具体内容 |
|------|---------|
| **核心问题** | "这个请求内隐藏的 10 星产品是什么？" |
| **思维模式** | Brian Chesky 模式——不从字面理解需求，从用户视角重新思考问题 |
| **四种模式** | Expansion（扩张梦想） / Selective Expansion（选择性扩张） / Hold Scope（保持范围） / Scope Reduction（缩减至 MVP） |
| **具体审查** | 需求背后隐藏的高价值产品方向、用户真正需要什么（而非他们说了什么）、从照片上传到"帮卖家创建一个能卖出去的listing"的重新定义 |
| **产出** | CEO 视角设计文档，持久化到 `~/.gstack/projects/`，喂给 eng-review |

**这远不止"探索需求**——这是对需求本身的**价值重定义**。它用 YC 评估数千家创业公司的方法论来质询产品方向。

案例：用户说"做日历简报 app"→ CEO review 重新定义为"个人参谋长 AI"——监控日历、生成智力准备工作、管理 CRM、优先时间、用金钱换杠杆。这是从功能到产品的升维。

### 2.2 /plan-eng-review —— 工程经理视角

| 维度 | 具体内容 |
|------|---------|
| **核心问题** | "技术的脊柱能否承载产品愿景？" |
| **覆盖领域** | 架构 / 系统边界 / 数据流 / 状态转换 / 失败模式 / 边界情况 / 信任边界 / 测试覆盖 |
| **关键机制** | **强制出图**——序列图、状态图、组件图、数据流图、测试矩阵。图表强制隐藏假设浮出表面 |
| **审查仪表板** | 每个审查后输出状态仪表板（Eng/Ceo/Design 各列，运行次数/状态/CLEAR/必需），Eng Review 是**唯一必需的门禁** |
| **数据流** | 测试计划工件自动传递给 `/qa` 阶段，无手动复制粘贴 |

**核心价值**：从"模糊计划"到"可执行的技术蓝图"。图表不只是文档，是思维完整性检查——强制 LLM 把模糊直觉外化为精确的结构。

### 2.3 /plan-design-review —— 高级设计师视角

| 维度 | 具体内容 |
|------|---------|
| **核心问题** | "用户实际会看到什么？" |
| **七轮审查** | 信息架构 → 交互状态覆盖 → 用户旅程 → AI 糊弄风险 → 设计系统对齐 → 响应式/可访问性 → 未解决设计决策 |
| **评分机制** | 每轮 0-10 分，解释 10 分标准，给出修复计划。低分 = 大量修复，高分 = 快速通过 |
| **独特价值** | 在计划阶段捕获空状态/错误状态/加载状态/AI 糊弄风险——修复成本最低的时候 |

**关键洞察**：大多数计划描述后端做什么，但从不指定用户实际看到什么。空状态/错误状态/加载状态这些决策被推迟到"实现时再想"——然后工程师以"未找到物品"作为空状态发布。`/plan-design-review` 在计划阶段就捕获这些。

### 2.4 /design-consultation —— 从零构建完整设计系统

这是 Plan 阶段的扩展能力——当项目没有既有设计系统时，从零构建：审美方向、排版（3+ 字体带特定角色）、色板（十六进制值）、间距比例、布局方法、动效策略。每个推荐带理由，每个选择强化其他选择。同时提出"安全选择"和"创意风险"——并告诉用户哪个是哪个。

---

## 三、OpenSpec Explore 阶段：自由对话式调研

### 3.1 当前能力

| 维度 | 具体内容 |
|------|---------|
| **核心命令** | `/opsx:explore` |
| **定位** | 需求模糊时的前期调研，自由对话模式 |
| **工作方式** | AI 分析项目现有代码、架构、业务逻辑，梳理需求可行性、技术难点、依赖关系 |
| **关键约束** | **不生成任何变更文件**——仅做调研分析，不写 proposal/design/tasks |
| **产出** | 需求调研文档（对话内呈现，非持久化物） |

### 3.2 能力边界

对比上述 gstack Plan 阶段的三层角色体系，OpenSpec 的 Explore 阶段的功能空白非常明显：

| 维度 | gstack Plan | OpenSpec Explore | 差距 |
|------|------------|-----------------|------|
| **角色分离** | 3 个独立审查角色（CEO/Eng/Design） | 单一自由对话 | **无角色分离** |
| **产品价值重定义** | `/plan-ceo-review` 四种模式（扩张/选择/保持/缩减）+ 隐藏10星产品挖掘 | 仅调研可行性 | **无价值重定义机制** |
| **技术架构锁定** | `/plan-eng-review` 强制出图（序列图/状态图/数据流图/测试矩阵） | 无 | **无结构化技术审查** |
| **体验设计审查** | `/plan-design-review` 七轮交互审查 + 0-10 评分 | 无 | **无设计审查** |
| **设计系统构建** | `/design-consultation` 从零构建完整设计体系 | 无 | **无设计系统能力** |
| **门禁机制** | 审查仪表板 + Eng Review 为唯一必需门 | Explore 无门禁概念 | **无质量闸门** |
| **阶段间数据流** | Plan 产出自动喂给 QA/Build | Explore → Propose 无自动传递 | **无标准化数据流** |
| **持久化** | 所有 Plan 产出持久化到 `~/.gstack/projects/` | Explore 不生成文件 | **无产出物持久化** |

### 3.3 根本原因分析

这并非 OpenSpec 的设计缺陷，而是**定位差异**：

- **OpenSpec 的核心定位**是"规范的一致性和可追溯性"——它的主要价值在 `propose → apply → archive` 的规范增量合并机制，Explore 仅仅是正式流程前的"暖场"步骤
- **gstack 的核心定位**是"虚拟工程团队的阶段化工序"——Plan 是它的**主战场**，不是前置步骤

换句话说：OpenSpec 假设用户已经知道要做什么（只是需要把规范写下来），gstack 假设用户需要一个团队帮他**想清楚**要做什么。

---

## 四、Superpowers：弥补"怎么做"的工程纪律层

Superpowers 在三层体系中填补了 gstack 和 OpenSpec 都不覆盖的空白——**强制执行的工程纪律**。

### 4.1 与 gstack 的关键差异

| 维度 | gstack Plan | Superpowers Brainstorm |
|------|------------|----------------------|
| **角色模型** | CEO/Eng/Design 多角色专业分工 | 单一 AI 按 SOP 执行苏格拉底式提问 |
| **约束机制** | 流程门禁（阶段间有产出物传递） | Gate 机制（1% 规则 + 不可协商的门槛） |
| **提问风格** | 价值重定义——"隐藏的10星产品是什么？" | 功能边界澄清——"需要用户认证吗？公开API？" |
| **贪婪程度** | 积极寻找更高级的产品方向 | 保守确保不遗漏需求细节 |

Superpowers 的核心哲学：**"规则可以绕开，门槛不行"**——每一个关键转换都设计为 Gate，条件不满足就无法进入下一步。

### 4.2 Superpowers 的独特贡献

| 机制 | 说明 |
|------|------|
| **1% 规则** | 即使只有 1% 概率适用某 Skill，也必须调用检查。不可协商 |
| **TDD 铁律** | 如果生产代码在测试存在前被写出，代码必须删除。无例外 |
| **子代理并行** | 主 Agent 读 Plan → 启子 Agent 独立实现 → 两阶段审查 → 子 Agent 终止 |
| **4 阶段调试** | 根因调查 → 模式分析 → 假设测试 → 实现。3 次失败 = 停止，质疑架构 |
| **验证先于完成** | 没有最新验证证据，禁止声称完成 |

---

## 五、与 spec-first 的对照映射

### 5.1 spec-first 在三层体系中的位置

```
gstack 流程层       OpenSpec 规范层       Superpowers 纪律层
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ /office-hours│   │ /opsx:explore│   │ brainstorming│
│ /plan-ceo    │   │ /opsx:propose│   │ writing-plans│
│ /plan-eng    │   │ /opsx:apply  │   │ TDD (铁律)   │
│ /plan-design │   │ /opsx:archive│   │ subagent-dev │
│ /review      │   └──────────────┘   │ verification │
│ /qa          │                      └──────────────┘
│ /ship        │
└──────────────┘

         ↓ spec-first 当前对标 ↓

┌──────────────────────────────────────────┐
│ spec-prd (Phase 0-4)                     │
│   Phase 0: 意图分类 + input_posture      │ ← 对标 gstack office-hours 的部分功能
│   Phase 1: Evidence Collection           │ ← 对标 OpenSpec explore
│   Phase 2: Bounded Scenario Grill        │ ← 对标 gstack plan-ceo 的部分功能
│   Phase 3: PRD Draft                     │ ← 对标 OpenSpec propose
│   Phase 4: Readiness Lens                │ ← 对标 Superpowers verification
├──────────────────────────────────────────┤
│ spec-plan: 任务拆解 + 依赖图             │ ← 对标 gstack plan-eng + Superpowers write-plan
├──────────────────────────────────────────┤
│ spec-code-review (Stage 0-6)             │ ← 对标 gstack review + Superpowers systematic-debugging
└──────────────────────────────────────────┘
```

### 5.2 spec-first 缺失的 gstack Plan 能力

对照 gstack 的 Plan 阶段三层角色，spec-first 当前的 spec-prd 存在以下结构性缺口：

| gstack Plan 能力 | spec-first 对标物 | 现状 | 缺失程度 |
|-----------------|------------------|------|---------|
| CEO Review（价值重定义） | Phase 2 Bounded Scenario Grill | 仅问 owner"这个场景谁负责"，不追问"隐藏的更高价值产品方向" | **严重缺失** |
| Eng Review（强制出图） | spec-prd 内无；spec-plan 有任务依赖图 | 有任务依赖图，但无序列图/状态图/数据流图的强制产出 | **中等缺失** |
| Design Review（七轮交互） | 无 | spec-prd 完全无设计审查环节 | **完全缺失** |
| Design Consultation（设计系统） | 无 | 完全由 spec-design skill 独立处理（且为非强制） | **部分缺失** |
| 审查就绪仪表板 | Readiness Lens 5 个 Pack | 自评通过/不通过，但无多角色审查状态汇总 | **中等缺失** |
| Plan → QA 数据流 | spec-plan → spec-code-review | 有 task 分解到 stage 3 dispatch，但非标准化的测试计划传递 | **部分缺失** |

### 5.3 spec-first 无法或不应照搬的 gstack 设计

| gstack 设计 | 不适合 spec-first 的原因 |
|------------|------------------------|
| 15+ 独立角色斜杠命令 | spec-first 的 skill 体系设计为**流水线模式**（Phase 串行），而非角色并行调度。强行插入多个 CEO/Eng/Design 角色会破坏流水线的可预测性 |
| 强制出图（序列图/状态图） | spec-prd 的核心产出是 PRD 文档，不是架构蓝图。架构图属于 spec-plan 阶段。跨阶段注入可能造成职责混乱 |
| 审查仪表板（多角色状态汇总） | spec-first 当前只有单一 orchestrator，无多角色并发审查。引入需要先建立多角色调度框架 |
| Plan 产出自动喂给 QA | spec-first 的上下游衔接依赖 spec-id traceability，而非文件传递。需要更结构化的数据契约 |

---

## 六、可操作改进建议

### 6.1 P0：为 spec-prd 引入"价值重定义"追问机制

**参考 gstack 的 `/plan-ceo-review`**。

在 spec-prd Phase 2（Bounded Scenario Grill）中增加一个"Value Reframe"子步骤：

```
Phase 2.5 Value Reframe:
1. 基于 Phase 1 evidence，输出当前需求的"字面理解"
2. 追问三个问题：
   a. 用户真正想解决的问题是什么？（不是他们要求的功能）
   b. 如果这个问题被完美解决，用户的生活/工作会有什么可见变化？
   c. 当前需求方案是否可能是"局部最优"——解决了一个更小问题的更复杂版本？
3. 如果第 3 问的回答为"是"，输出 Value Reframe 卡片：
   - 当前方案：[字面需求]
   - 重构方案：[更高价值的方向]
   - 差异：[为什么重构方案更好]
   - 风险：[重构方案的风险和前提假设]
4. Value Reframe 卡片作为 Phase 3 PRD Draft 的必读前导
```

**设计原则**：Value Reframe 是**可选建议**而非强制替代——owner 可以选择"接受重构"或"坚持原方案"。这与 gstack 的四种模式（扩张/选择/保持/缩减）逻辑一致。

### 6.2 P1：为 spec-plan 引入"测试计划工件"

**参考 gstack 的 `/plan-eng-review` 测试矩阵 + `/qa` 自动拾取机制**。

在 spec-plan 的输出中新增一个 `test-matrix.md` 文件：

```yaml
# test-matrix.md（spec-plan 产出物）
features:
  - id: FEAT-001
    name: 用户登录
    test_scenarios:
      - happy_path: 正确账号密码登录
      - edge_case: 密码错误 3 次锁定
      - edge_case: 过期 token 自动刷新
      - security: SQL 注入尝试
      - security: 暴力破解检测
    coverage_target: 95%
```

此文件在 spec-code-review 的 Stage 3 dispatch 时自动注入 reviewer agent 的上下文，确保审查范围与测试计划对齐。

### 6.3 P1：spec-prd Readiness Lens 增加"设计审查"维度

**参考 gstack 的 `/plan-design-review`**。

在当前 Readiness Lens 的 5 个 Pack 中增加一个 `pack-design-coverage`：

```
Pack 6: Design Coverage（设计覆盖）
- 空状态：[是否定义了无数据时的用户看到什么]
- 错误状态：[是否定义了每种错误类型的用户反馈]
- 加载状态：[是否定义了骨架屏/进度指示]
- 边界 UI：[是否定义了极端数据（超长标题/0条结果）的呈现]
- 响应式断点：[是否定义了移动端/平板/桌面三档布局策略]
```

此 Pack 的定位是"提醒"而非"强制"——低分不阻塞 PRD 通过，但警告 owner"体验边界的定义缺失"。

### 6.4 P2：引入 spec-ops 新 Skill（远景）

将 gstack 和 Superpowers 的独特机制打包为一个新的 `spec-ops` skill：

```
spec-ops:
  - /ops:ceo-check    → 价值重定义追问（参考 gstack plan-ceo-review）
  - /ops:eng-check    → 架构完整性审查（参考 gstack plan-eng-review）
  - /ops:design-check → 七轮设计审查（参考 gstack plan-design-review）
  - /ops:tdd-gate     → TDD 铁律门禁（参考 Superpowers TDD Iron Law）
  - /ops:verify       → 验证先于完成（参考 Superpowers verification-before-completion）
```

**引入时机**：等待 spec-prd 的 Readiness Reviewer 独立 agent 实体化后（当前 7 次 eval 数据积累中），作为该 agent 的能力扩展，而非独立新 skill。

---

## 七、结语：三者的"不是竞品，是互补"关系

```
        OpenSpec              gstack               Superpowers
     ┌────────────┐      ┌────────────┐        ┌────────────┐
     │ 规范做什么  │      │ 流程谁来做  │        │ 纪律怎么做  │
     │ (What)     │  →   │ (Who+When) │   →    │ (How)      │
     └────────────┘      └────────────┘        └────────────┘
         规范层               流程层                纪律层
```

gstack 的 Plan 阶段之所以比 OpenSpec 的 Explore 丰富得多，是因为它们回答的是**不同的问题**：

- OpenSpec Explore 问："这个需求能做吗？技术可行性如何？"
- gstack Plan 问："我们应该做这个吗？如果做，最佳方向是什么？技术脊柱怎么搭？用户会看到什么？"

spec-first 当前在 Explore 层面对齐 OpenSpec（Phase 1 evidence collection），在 Plan 层面部分对齐 gstack（spec-plan 任务拆解），但在**价值重定义**和**设计审查**两个维度存在结构性空白。上述 P0-P2 建议按优先级逐步填补。

---

## 附录：三层工具能力矩阵总览

| 能力维度 | gstack | OpenSpec | Superpowers | spec-first 当前 |
|---------|--------|----------|-------------|----------------|
| 需求探索/调研 | `/office-hours`（6 个强制问题） | `/opsx:explore`（自由对话） | `brainstorming`（苏格拉底提问） | Phase 0-1 |
| 产品价值重定义 | `/plan-ceo-review`（4 种模式） | 无 | 无 | **缺失** |
| 技术架构锁定 | `/plan-eng-review`（强制出图） | 无（在 design.md 中可选） | `writing-plans`（微小任务拆解） | spec-plan |
| 体验设计审查 | `/plan-design-review`（7 轮 0-10 评分） | 无 | 无 | **缺失** |
| 设计系统构建 | `/design-consultation` | 无 | 无 | spec-design（非强制） |
| 规范定义 | 无 | `/opsx:propose`（4 文件一次性生成） | 无 | Phase 3 PRD Draft |
| TDD 铁律 | 无 | 无 | `test-driven-development`（Iron Law） | **缺失** |
| 代码审查 | `/review`（Staff Engineer） | 无 | `requesting-code-review` | Stage 0-6 |
| QA 测试 | `/qa`（真实浏览器） | 无 | `verification-before-completion` | **缺失** |
| 发布部署 | `/ship`（一键 PR） | 无 | `finishing-a-development-branch` | **缺失** |
| 增量归档 | 无 | `/opsx:archive`（精准合并） | 无 | **部分**（spec-id trace） |
| Gate 机制 | 审查仪表板（Eng Review 必需门） | 无 | 1% 规则 + 不可协商门槛 | Readiness Lens（自评） |
*（内容由AI生成，仅供参考）*
