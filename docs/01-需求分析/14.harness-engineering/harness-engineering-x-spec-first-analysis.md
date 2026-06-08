---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a88644969371398a873cabeac0a028ab_84ab395c62ec11f1832e5254006c9bbf
    ReservedCode1: AZO/veUUV6EZXHmazoiFw7VrALFcbTG2XPFk6efvIe8EdFN4pnN+EtvtMw81P0w2pMP95ZZ370L2Al76VnOVejzuHFYmAQIl8IxRoqCYE+Z31tXQsjtJsHfoUp1DIJYUK1wUCClCBTgeC3/bcIhd3eeAhiKdZv3wAyCcJ0PIxINY9bxr+kXFlMOqHlk=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a88644969371398a873cabeac0a028ab_84ab395c62ec11f1832e5254006c9bbf
    ReservedCode2: AZO/veUUV6EZXHmazoiFw7VrALFcbTG2XPFk6efvIe8EdFN4pnN+EtvtMw81P0w2pMP95ZZ370L2Al76VnOVejzuHFYmAQIl8IxRoqCYE+Z31tXQsjtJsHfoUp1DIJYUK1wUCClCBTgeC3/bcIhd3eeAhiKdZv3wAyCcJ0PIxINY9bxr+kXFlMOqHlk=
---

# Harness Engineering 方法论 × spec-first 集成分析

> 参考文章：[为什么 2026 年真正重要的是 Harness Engineering？](https://mp.weixin.qq.com/s/RwWfknFIFvJPIdsJMgeNiQ)
> 作者：Rahul (@sairahul1)
> 分析日期：2026-06-08
> 前置系列：[侠客汇 × spec-prd 改进分析](./14.prd-skill/prd-skill-xiakehui-improvement-analysis.md) | [二轮深度评审](./14.prd-skill/prd-skill-xiakehui-improvement-analysis-deepseek-review.md) | [brooks-lint × code-review 集成](./14.code-review/technical-proposal-brooks-lint-integration.md)

---

## 一、核心框架提炼

### 1. 根本定义

```
Agent = Model + Harness
```

Harness 是模型之外的一切——约束、反馈回路、文档、工具权限。模型是 CPU，Harness 是操作系统。2026 年的核心命题不再是"怎么让模型更强"，而是"怎么让环境让模型变得可靠"。

### 2. 5 种 Harness 工件

| # | 工件 | 本质 | 关键设计细节 |
|---|------|------|-------------|
| 1 | AGENT.md / CLAUDE.md | Agent 的入职文档 | 每个模块一个文件，持续更新；没有它，agent 每次会话都在盲跑 |
| 2 | JSON 功能列表 | 进度追踪器 | JSON 而非 Markdown（agent 覆盖 JSON 概率更低）；定义功能 + 验证方式 + pass/fail |
| 3 | 会话初始化例程 | 标准化启动序列 | Anthropic 的 7 步：确认目录 → 读 git log → 读功能列表 → 启动服务器 → 端到端验证 → 实现 → 提交 |
| 4 | Sprint 合约 | AI-AI 设计评审 | Generator 提出方案 → Evaluator 审查 → 双方一致后开始实现 |
| 5 | 结构化任务模板 | 代码库影响地图 | 真实文件路径 + 真实符号名 + 现有模式 + 验收标准；在编码前生成 |

### 3. 三大阵营

| 阵营 | 核心理念 | 标志性做法 |
|------|---------|-----------|
| OpenAI | 环境优先 | 先设计环境（AGENT.md + CI/CD 接入 + 依赖流），再放手让 agent 工作 |
| Anthropic | 执行与评判分离 | Planner → Generator → Evaluator 三 agent 分工；Evaluator 用浏览器自动化测试 |
| ThoughtWorks | 2×2 控制框架 | Feedforward/Feedback × Computational/Inferential，四象限覆盖所有控制机制 |

### 4. 五条普适原则

| 原则 | 内涵 | 反面教训 |
|------|------|---------|
| 上下文胜过指令 | 给地图，不要给手册。展示当前世界状态优于抽象讲述怎么做 | 模糊描述 → 幻觉路径；扎根真实文件 → 贴合代码库 |
| 规划与执行分离 | 规划和实现必须是独立步骤，中间有审查门禁 | 同一次处理中规划+执行 → 不可靠结果 |
| 反馈回路不可协商 | 只有 feedforward 没有 feedback = 绕了远路的 prompt | 没有反馈的 harness，只是装饰 |
| 一次只做一件事 | 强制增量主义——读进度 → 选功能 → 实现 → 提交 → 重复 | 一次做太多 → 耗尽上下文 → 漏需求 |
| 代码库就是文档 | Repo 是唯一事实来源。约定不写进代码库，agent 就不知道 | 混乱 repo + AI agent = 规模化混乱 |

### 5. 两个悖论

**Harness 衰减**：Harness 中每个组件都编码了"模型做不到什么"的假设。模型升级后，这些假设过期，组件变成开销。Opus 4.5 → 4.6 → 4.7，sprint 拆解和 evaluator 的职责持续缩小。

**构建是为了删除**：把每个 harness 组件设计成可移除的。定期关掉测试，输出质量不变 → 删除。Manus 6 个月重构 5 次，Vercel 移除 80% 工具后性能更好。

---

## 二、与 spec-first 现有架构的对照映射

spec-first 的 skill 体系本质上就是一套 Harness。每个 skill（spec-prd / spec-plan / spec-code-review）都是"模型之外的一切"——约束、流程、质量闸门、输出模板。

### 2.1 spec-first 的 Harness 现状矩阵

对照 ThoughtWorks 的 2×2 框架，对 spec-first 当前体系做一次全面映射：

| 象限 | spec-prd 对应物 | spec-code-review 对应物 | spec-plan 对应物 |
|------|----------------|------------------------|-----------------|
| **Computational Feedforward**（确定性引导） | Domain Glossary、Evidence Tags 五级体系、Topology 10 种类型 | findings-schema.json、decay_risk 枚举、severity 权重表 | 任务依赖图、spec-id 追溯链 |
| **Computational Feedback**（确定性反馈） | check-glossary-drift.js（术语漂移检测）、eval examples（45 个用例） | Health Score 计算（纯公式）、coverage 分析 | CI/CD 构建验证 |
| **Inferential Feedforward**（AI 引导） | SKILL.md 6 条原则、Phase 0-4 流程、output_shape 选择、Readiness Lens 5 个 Pack | persona-catalog 触发规则、pre-facts 注入模板、decay-risk-field-guide | 架构蓝图加载 |
| **Inferential Feedback**（AI 反馈） | Readiness Lens 自检（v1 自执行）、quality_diagnosis 7 维度 | decay-tagger 分类、health-calculator 评分、decay 趋势分析 | 当前缺失 |

### 2.2 五个工件在 spec-first 中的对应

| 工件 | spec-first 对应物 | 现状 | 差距 |
|------|------------------|------|------|
| AGENT.md / CLAUDE.md | `.spec-review.yaml` + SKILL.md 头部声明 + Decay Risk Field Guide | 已存在，但分布在多个文件中，不是"每个模块一个文件"的粒度和位置 | 缺少模块级的 context 文件嵌入式分布 |
| JSON 功能列表 | Feature Slices（3-7 片，含 identity trace）+ spec-id-traceability | 有 slice 概念，但缺少 pass/fail 状态追踪机制 | 无跨会话的进度持久化 |
| 会话初始化例程 | Phase 0 意图分类 + input_posture 判定 | 有初始化流程，但偏重"判断做什么"，不检测"上次做到哪里" | 无 git log / 进度文件扫描 |
| Sprint 合约 | 当前无。最接近的是 Phase 2 Bounded Scenario Grill（但仅问 owner，不是 Agent-Agent 协商） | 完全缺失 | 无 AI-AI 设计评审机制 |
| 结构化任务模板 | evidence-and-topology.md + Topology Framing Gate（10 种拓扑类型） | 有拓扑分析，但产出的是"风险清单"而非"可执行的影响地图" | 缺少真实文件路径/符号名的自动提取 |

---

## 三、核心洞察：spec-first 的 Harness 衰减风险

### 3.1 Harness 最厚的地方：spec-prd

spec-prd 是整个 spec-first 体系中 harness 最厚的 skill——6 条原则、4 阶段、10 种拓扑、18 个 conditional sections、5 级证据标签、5 套 readiness pack、45 个 eval 用例。这是 spec-prd 高质量的来源，但也是它面临最大衰减风险的原因。

**衰减弱信号**：
- 侠客汇分析中提到的"输入策略"问题——如果模型对会议纪要 vs BRD 的判别能力已经提升到不需要显式的 `input_fidelity`，这个机制就是 overhead
- 错题本的匹配精度——如果模型本身已经不会在会员+积分的交叉领域编造规则，correction-ledger 的维护成本就超过收益
- 知识漏斗的语义检索——如果模型的上下文窗口持续增大、在上下文中自己就能做好信息筛选，三级漏斗就是多余的一层

**衰减检测建议**：参考 Anthropic 的做法——定期关掉某个 harness 组件，对比输出质量。例如：
- 关掉 Phase 1 的 evidence depth 判定，对比 evidence 编造率是否上升
- 关掉 Phase 2 的 Bounded Scenario Grill，对比 owner 纠正率是否上升
- 关掉 Phase 3 的 output_shape 选择逻辑，对比 PRD 结构完整性是否下降

### 3.2 当前 spec-first 最违背 Harness 原则的地方

对照五条原则逐一审视：

| 原则 | spec-first 吻合度 | 问题 |
|------|------------------|------|
| 上下文胜过指令 | 70% | evidence-tag 体系充分提供当前状态，但缺少"当前正在推进的工作"的进度上下文 |
| 规划与执行分离 | 90% | spec-prd → spec-plan 的移交天然分离了规划和执行，但 PRD 内部的 Phase 3 起草和 Phase 4 审查之间缺少硬门禁（见二轮分析） |
| 反馈回路不可协商 | 60% | Feedforward 很强（evidence tags、readiness lens），Feedback 偏弱——code-review 有 Health Score 但 spec-prd 的 readiness lens 是自执行的（无独立 evaluator） |
| 一次只做一件事 | 85% | Feature Slices 强制分解、code-review 的 Stage 3 dispatch 并行派发；但 spec-prd 的 Phase 3 一次输出完整 PRD |
| 代码库就是文档 | 80% | `.spec-review.yaml`、`domain-glossary.md` 都在 repo 中；但 correction-ledger 和 knowledge-base 的设计建议把它们放在 spec-first 框架内而非项目 repo 内 |

---

## 四、可操作集成建议

### 4.1 引入"Sprint 合约"机制到 code-review

**价值**：Harness 文章中最具原创性的一个机制——让 Generator 和 Evaluator 两个 agent 在动手前先谈判达成一致。这直接解决了 code-review 中当前没有解决的一个问题：Stage 3 派发的多个 reviewer agent 各自审查、结果在 Stage 5 合并，但没有任何 agent 在审查前就"审查什么、不审查什么"达成共识。

**方案**：

在 Stage 3 dispatch 之前，增加一个 Stage 2.5 "Review Contract Negotiation"：
1. **Scope Agent**（已有：persona-catalog 选中的 reviewer 之一兼任）起草 Review Scope Contract——列出本次审查覆盖的 decay risk 维度（R1-R6）、重点关注的模块、skip 的模块、depth calibration
2. **Challenge Agent**（adversarial-reviewer 兼任）审查 Scope Contract——"这个 scope 有没有遗漏？有没有过度？focus 优先级是否合理？"
3. 双方协商一致后，Scope Contract 作为 Stage 3 dispatch 的约束注入每个 reviewer 的上下文

**预期效果**：
- 减少 Stage 5 merge 阶段发现"A reviewer 审了 B reviewer 该审的东西"的冲突
- 减少 reviewer agent 拓宽审查范围导致的上下文浪费
- 对齐 Anthropic 的洞察——"在动手前先谈判的 agent 产出更可靠"

### 4.2 引入"会话初始化例程"到 spec-prd

**价值**：spec-prd 的 Phase 0 做意图分类，但它不会读取"上次 PRD 做到哪了"。如果一个 PRD 分两次会话完成（比如 Phase 3 起草后 owner 说"让我想想"，第二天继续），第二次会话的 AI 不知道上下文——尽管 Phase 3 的产出已经保存为文件，AI 不会主动去读。

**方案**：

在 SKILL.md 的 Phase 0 头部增加一个 `Session Bootstrap` 步骤：

```
Phase 0 Bootstrap:
1. 确认工作目录和项目根路径
2. 读取 .spec-review.yaml（项目级 harness 配置）
3. 读取领域术语表 docs/contracts/domain-glossary.md
4. 检测是否存在进行中的 PRD 草稿：
   - 扫描 output/ 目录下的 latest PRD 文件
   - 读取 Decision Card（如果有）获取上次停止的阶段
   - 输出: "检测到进行中的 PRD [feat-xxx]，上次停在 Phase 3 Section Anchor 2"
5. 检测是否存在匹配的 correction-ledger 条目
6. 输出 bootstap summary → 进入 Phase 0 意图分类
```

**边界条件**：
- 如果存在进行中的 PRD 但没有 Decision Card（旧版本产物），不强行恢复上下文，提示 owner"检测到旧版 PRD，是否作为输入？"
- 如果 bootstrap 检测到上次停止在 Phase 3 但产出的 Core Sections 已被修改（owner 手动编辑过），警告"草稿已被手动修改，是否使用手动版本作为起点？"

### 4.3 引入"构建是为了删除"的设计原则

**价值**：Harness 文章最反直觉的洞察——好的 harness 设计不是让组件"永不过时"，而是让组件"容易移除"。spec-first 当前的 skill 组件（principles、phases、references、scripts、evals）没有显式的"可移除性"设计。

**方案**：

在 spec-first 的设计规范中新增一条原则：

> **Harness Removability Principle**：每个 skill 中的每个组件（原则、阶段、参考文件、脚本）必须能被独立禁用而不影响其他组件的运行。禁用方式通过 `.spec-review.yaml` 的 `disable` 字段控制。每季度运行一次 `harness-decay-audit` 脚本，对比启用/禁用每个组件时的输出质量，标记质量无差异的组件为"候选移除"。

具体改造：

- 当前 `.spec-review.yaml` 的 `disable` 字段只支持按 decay risk code 禁用（R1-R6、T1-T6）。扩展为支持按 component 禁用：

```yaml
disable:
  components:
    readiness_lens: false          # 关掉整个 Readiness Lens
    evidence_depth: false          # 关掉 Phase 1 的 evidence depth 判定
    bounded_scenario_grill: false  # 关掉 Phase 2 的 owner 问题
    section_anchor: false          # 关掉 Phase 3 的分步确认（未来引入后）
  risk_codes:
    - R4  # 按 decay risk 禁用（已有）
```

- 每季度运行 `harness-decay-audit`：对每个可禁用组件做 A/B 测试（10 个历史 PRD 用例，启用 vs 禁用，对比 readiness_lens 通过率、owner 纠正次数、evidence 编造率），输出衰减报告。

### 4.4 引入 ThoughtWorks 2×2 框架作为 skill 设计的 review lens

**价值**：Harness 文章中的 ThoughtWorks 2×2 是一个通用的 harness 评估框架。spec-first 的任何 skill 设计都可以用它来自检。

**方案**：

在 spec-first 的 skill 设计模板中新增一个"Harness 象限覆盖自检"章节：

```markdown
## Harness 象限覆盖自检

| 象限 | 本 skill 的对应物 | 覆盖度 | 缺失风险 |
|------|------------------|--------|---------|
| Computational Feedforward | ... | | |
| Computational Feedback | ... | | |
| Inferential Feedforward | ... | | |
| Inferential Feedback | ... | | |

**当前最大薄弱象限**: [填写]
**补救计划**: [填写]
```

对 spec-prd 自检：

| 象限 | 对应物 | 覆盖度 |
|------|--------|--------|
| CF | check-glossary-drift.js、evidence-tags 五级 | 强 |
| CFb | eval examples 45 个、fresh-source eval 7 次 | 中 |
| IF | SKILL.md 原则、Phase 0-4、Readiness Lens、Topology Gate | 最强 |
| IFb | Readiness Lens 自检（自执行） | **弱** |

**最大薄弱象限：Inferential Feedback**——spec-prd 的 Readiness Lens 是自执行的（orchestrator 自己审自己），没有独立的 evaluator agent。这违反 Anthropic 的核心洞察——"agent 同时扮演学生和老师，会给自己全 A"。

**补救**：将 Readiness Reviewer 实体化为独立 agent（SKILL.md 已预留此路径——"只有当 fresh-source eval 证明自审稳定失效时，才会实体化"）。当前已有 7 次 eval 数据，可以据此评估是否到了实体化的时机。

---

## 五、三篇文章的知识链收束

本系列已分析的三篇文章存在一条清晰的接力链：

```
brooks-lint 分析（轮次 38-40）
  └─ 引入：衰减风险框架 R1-R6 + T1-T6，结构化诊断链，著作出处追溯
  └─ 产出：spec-code-review 4 个新 Agent + 5 处决策逻辑改动 + 技术方案文档

侠客汇 AI-Native 工作流（轮次 41-42）
  └─ 引入：可自进化的组织记忆，错题本机制，引用账本，知识漏斗，产品-技术双线闭环
  └─ 产出：spec-prd 7 项改进建议 + 二轮深度质疑 + 修正路线图

Harness Engineering（本文）
  └─ 引入：Agent = Model + Harness，5 种工件，5 条原则，Harness 衰减，构建是为了删除
  └─ 产出：spec-first Harness 全景映射 + Sprint 合约 + Session Bootstrap + Removability 原则
```

三篇文章的深层联系：

| 主题 | brooks-lint | 侠客汇 | Harness Engineering |
|------|------------|--------|---------------------|
| 核心机制 | 衰减风险分类框架 | 自进化组织记忆 | 环境优先于模型 |
| 关键洞察 | 裸模型通过率 16%，加 harness 94% | 需求做得越多，工作流越聪明 | 同一模型，更好 harness = +13% |
| 演进方向 | 固定框架 → 持续沉淀 | 人的经验 → 系统的记忆 | Harness 衰减 → 构建是为了删除 |
| 对 spec-first 的根本启示 | 审查需要结构化衰减维度 | 知识需要可进化的沉淀机制 | **所有机制都需要可移除性设计** |

最后一条是前两篇文章都没有触及的元原则——spec-first 引入的任何新机制（错题本、知识漏斗、成熟度体系、Sprint 合约、Session Bootstrap），都必须同时设计它的移除路径和衰减检测方式。否则，spec-first 会从"太薄"走向另一个极端——"太厚"，在一个模型快速进化的时代，过厚的 harness 和没有 harness 一样危险。

---

## 附录：Harness Engineeting 五条原则在 spec-first 中的落地检查清单

- [ ] **上下文胜过指令**：spec-prd 的 evidence collection 是否在每次 PRD 起草前都重新校准（而非依赖上一次运行的缓存）？spec-code-review 的 pre-facts 注入是否基于真实的 diff 上下文（而非上一次 review 的结论）？
- [ ] **规划与执行分离**：spec-prd 的 Phase 3 起草和 Phase 4 审查之间是否有足够的独立评估（而非自审）？spec-code-review 的 Stage 2 选 agent 和 Stage 3 派发之间是否有 scope 协商？
- [ ] **反馈回路不可协商**：每个 skill 是否同时拥有 feedforward（引导）和 feedback（验证）？spec-prd 的 Readiness Lens 是否到了需要独立 evaluator agent 的时机？
- [ ] **一次只做一件事**：spec-prd 的 Phase 3 一次性输出完整 PRD 是否可以被拆分为更小的增量步骤（如先输出 Core Sections，确认后再输出 Conditional Sections）？spec-code-review 的 Stage 3 并行派发后，Stage 5 merge 是否因为 reviewer 之间范围重叠而导致冲突？
- [ ] **代码库就是文档**：knowledge-base、correction-ledger、review-knowledge-ledger 这些新机制是否作为项目 repo 中的文件存在（而非 spec-first 框架的外部存储）？
*（内容由AI生成，仅供参考）*
