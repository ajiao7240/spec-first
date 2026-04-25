---
date: 2026-04-17
topic: spec-brainstorm-capability-upgrade
type: enhancement-proposal
status: draft
version: v1.3
source_refs:
  - skills/spec-brainstorm/
  - /Users/kuang/xiaobu/compound-engineering-plugin/plugins/compound-engineering/skills/ce-brainstorm/
  - /Users/kuang/xiaobu/superpowers/skills/brainstorming/
---

# spec-first Brainstorm 能力升级方案

**方案版本**：v1.3 · 日期 2026-04-17
**范围**：`skills/spec-brainstorm/` 及其下游契约
**正式同步基线**：`compound-engineering-plugin/plugins/compound-engineering/skills/ce-brainstorm/`
**外部借鉴源**：`superpowers/skills/brainstorming/`

**v1.3 变更**（相对 v1.2）：补齐 5 个结构性缺口——新增“源项目优势覆盖矩阵”（§2.5）、补入 `P1.5 Context Pulse` 吸收 `recent commits / current work pulse`（§4.P1.5）、补入 `P1.6 Preflight Self-Check` 吸收 deterministic spec self-review（§4.P1.6）、在 `P0.4` 下显式声明对 source terminal state 的 `Deliberate Divergence`（§4.P0.4）、将 `P2.1 Visual Companion` 明确收口为 deferred-not-absorbed 并补充协议边界（§4.P2.1 / §4.5）。

**v1.2 变更**（相对 v1.1）：修订 3 个执行级缺陷——集成测试接线动作写入 S1 范围（§7）、HARD-GATE 范围明确限定为"禁止跳到 implementation"而非"必须落盘文档"（§4.P1.1）、Terminal State Lock denylist 原则收敛为"会修改源码或宿主运行环境"（§4.P0.4）。

**v1.1 变更**：Epic 元数据单一来源（§4.P0.1 / §6）、blocking tool fallback 全局继承（§3.5）、Terminal State Lock 三层模型（§4.P0.4）、Epic 消费契约机械化 + `spec-plan` 下游测试矩阵（§4.P0.1 / §5）、skip-gate flag 载体与生命周期（§4.P0.3）。

---

## 一、背景与目标

`skills/spec-brainstorm` 目前是 spec-first 的前端入口，已具备**研究路由（7 源）+ 非软件分流 + 三档 scope + blocking/deferred 问题分类 + multi-persona spec-doc-review**等差异化能力。经对**当前正式同步基线** `ce-brainstorm` 与**外部方法参考** `superpowers/brainstorming` 做对比，结论不是“当前仓库明显落后于正式基线”，而是：

- 相对 `ce-brainstorm`：当前 `spec-brainstorm` 已基本追平正式同步基线，并在 supplemental context、research digest、dual-host 适配上有所增强；
- 真正尚未系统吸收的，是 `superpowers/brainstorming` 中关于**流程纪律、上下文脉冲、自检闭环、单出口安全意图**的部分做法。

基于此，识别出 4 项 P0、6 项 P1、1 项 P2 的增强项。本方案目标：

1. 在**不破坏现有优势**（research digest 契约 / 非软件路由 / spec-doc-review 多 persona）前提下吸收外部最佳实践；
2. 以**最小改动面**覆盖 4 个真实痛点：大型需求识别缺失 / 一次性交付偏差纠正成本高 / 用户层 review 缺 gate / 出口路径无硬约束；
3. 提供可量化的验证策略与 CHANGELOG 合规落地路径。

**基线判定原则**：
- `ce-brainstorm` 用于判断“当前仓库是否已经具备某项能力”，避免把已同步内容重复立项
- `superpowers/brainstorming` 用于识别“可借鉴但尚未纳入 spec-first 契约”的做法，不把它直接等同于当前仓库上游缺口

---

## 二、当前差距诊断（速览）

| 痛点 | 现状 | 触发场景 | 影响 |
|---|---|---|---|
| 大型需求无分解 | 三档 scope 只覆盖单 feature | 用户抛"建一个含 chat/存储/计费的平台" | 问题细化到错层级，后续 plan 被迫发明产品 |
| 需求文档一次性产出 | Phase 3 一次写完 → Phase 3.5 评审 | Standard/Deep 大需求 | 方向偏差要等全文回放才发现，返工成本高 |
| 无用户本人 review gate | spec-doc-review agent 完即进 handoff | 任何有文档的 brainstorm | 用户未真正过目就进入 planning |
| 出口缺少显式 Terminal State Lock | handoff 选项已有允许列表，但对未列出 skill 缺少明文 hard deny | agent 误触发其他 skill | brainstorm 能被实现类 skill 劫持 |

---

## 二.五、源项目优势覆盖矩阵

下表用于回答本轮最关键的问题：**当前方案是否真的把源项目的优势吸收完整了。** 结论必须分成“已具备 / 本期吸收 / 延后吸收 / 刻意不吸收”，不能只说“参考了 source”。

| 源能力 | 来源 | 当前项目状态 | 本方案动作 | 结论 | 理由 |
|---|---|---|---|---|---|
| HARD-GATE：未完成需求对齐前不得进入 implementation | `superpowers/brainstorming/SKILL.md` | 部分具备，当前文案不够硬 | `P1.1` 明文化 | 本期吸收 | 保留 spec-first 的 WHAT/HOW 边界，同时补齐硬约束 |
| “简单需求也不能跳过对齐”反模式声明 | 同上 | 未显式写出 | `P1.1` 明文化 | 本期吸收 | 可减少“看起来简单就直写代码”的漂移 |
| 探索上下文时显式看 `files / docs / recent commits` | 同上 | `files / docs` 已有，`recent commits` 缺显式合同 | `P1.5 Context Pulse` | 本期吸收 | 低成本补齐“继续上次那个”与近期脉冲场景 |
| 大型需求先拆 decomposition 再做首个子项目 | 同上 | 缺显式早检测 | `P0.1` | 本期吸收 | 这是当前痛点之一，且与 spec-first 下游契约兼容 |
| 提出 2-3 approaches 供用户比较 | `superpowers` 与当前/正式基线共有 | 已具备，且当前方案更克制 | 保持现状 | 已具备 | 当前 `spec-brainstorm` 已有 approaches phase；仅在“推荐先后顺序”上与 source 保持刻意差异 |
| design-for-isolation 边界自检 | `superpowers/brainstorming/SKILL.md` | 未显式写入 requirements capture | `P1.2` | 本期吸收 | 能提升 requirements 对职责边界的表达质量 |
| working in existing codebase 时允许 targeted improvements | 同上 | 精神上接近，边界规则不清 | `P1.3` | 本期吸收 | 吸收“顺手做必要改进”，但禁止实现层重构写进 requirements |
| 写完 spec 后做 deterministic self-review | `spec-document-reviewer-prompt.md` / `SKILL.md` | 依赖 `spec-doc-review`，缺本地 preflight | `P1.6` | 本期吸收 | 以轻量 preflight 吸收该优势，减少后续 review 噪音 |
| 用户亲自 review spec 后再进入下一阶段 | `superpowers/brainstorming/SKILL.md` | 缺显式 gate | `P0.3` | 本期吸收 | `spec-doc-review` 不能替代用户本人意图确认 |
| terminal state 只允许进入 writing-plans | `superpowers/brainstorming/SKILL.md` | 当前产品面更宽 | `P0.4` + Deliberate Divergence | 刻意不原样吸收 | 吸收安全意图，但不复制单出口模型 |
| Visual Companion | `visual-companion.md` | 当前无此能力 | `P2.1` 独立立项占位 | 延后吸收 | 依赖本地 server、host matrix、state 契约，复杂度高 |
| spec 写入 `docs/superpowers/specs/` 并立即 commit | `superpowers/brainstorming/SKILL.md` | 当前不采用 | §4.5 明确不吸收 | 刻意不吸收 | spec-first 路径、治理和工作流不同，brainstorm 阶段不强制 commit |
| 每个 checklist item 强制创建 task | `superpowers/brainstorming/SKILL.md` | 当前不采用 | §4.5 明确不吸收 | 刻意不吸收 | spec-first 不要求 brainstorm 阶段绑定独立 task 系统 |

---

## 三、集成方案总览

### P0（本次主线·4 项）
- P0.1 Scope Decomposition 早检测
- P0.2 Requirements 分节逐确认
- P0.3 用户本人 Review Gate
- P0.4 Terminal State Lock

### P1（次迭代·6 项）
- P1.1 HARD-GATE + 反模式显式声明
- P1.2 Design-for-isolation 边界检查
- P1.3 Targeted Improvements Scope Rule
- P1.4 Process Flow 图
- P1.5 Context Pulse
- P1.6 Preflight Self-Check

### P2（独立立项·1 项）
- P2.1 Visual Companion（deferred-not-absorbed）→ 独立为 `skills/spec-brainstorm-visual/`，按需 offer

---

## 三.五、交互前置条件（全局继承，适用于所有 P0/P1 新增交互）

**平台 blocking 问答工具可用性 fallback**（继承 `skills/spec-brainstorm/SKILL.md:33` 与 `references/handoff.md:9` 既有合同，不重新发明）：

- 宿主提供 blocking 问答工具（Claude Code `AskUserQuestion` / Codex `request_user_input` / Gemini `ask_user`）时：用之；
- 宿主**不提供**时：统一退回"编号选项呈现在 chat + 等待下一条用户消息再推进"，与现有合同一致；
- 本方案所有出现"blocking 问答工具"的场景（§4.P0.1 决策点 / §4.P0.2 分节确认 / §4.P0.3 Review Gate / §4.P0.4 逃生口确认）**均自动继承此 fallback**，不再在各节单独复述；
- 测试契约：`tests/unit/spec-brainstorm-contracts.test.js` 必须覆盖"blocking 工具不可用时的降级路径等价性"断言。

---

## 四、逐项落地设计

### P0.1 Scope Decomposition 早检测

**目的**：在花费 N 轮问题细化之前识别 epic 类需求，引导用户先拆解。

**触发判定（保守阈值，双条件）**：
- 特征 1：feature description 包含 ≥3 个独立功能名词短语（按「名词 + 动词」块切分，去重后计数）
- 特征 2：任一成立 —— 描述长度 >150 字 / 出现"平台/生态/全套/整套/suite"类关键词 / 涉及 ≥3 个不同用户角色

**落地位置**：`SKILL.md` 新增 Phase 0.3a（插在 0.3 Scope Assess 之前）

**流程**：
1. 命中触发条件 → 使用平台 blocking 问答工具单选提问：「这个需求看起来涉及 {N} 个相对独立的子系统，建议先拆成独立的 brainstorm 分别推进。要现在分解，还是我把它们合并为一次 brainstorm？」
2. 选"分解" → 写入 `docs/brainstorms/YYYY-MM-DD-<epic>-decomposition.md`（新模板，见下）→ 选首个 sub-project → 回到标准 Phase 0.3
3. 选"合并" → 把用户确认记录为 Key Decision（"用户选择合并，接受更高 planning 复杂度"）→ 回到标准 Phase 0.3

**新模板 `decomposition.md`**：
```markdown
---
date: YYYY-MM-DD
topic: <epic-slug>
type: epic-decomposition
---

# <Epic Title>

## Epic Goal
[一句话]

## Sub-projects
| ID | 名称 | 职责 | 依赖 | 优先级 |
|----|------|------|------|--------|
| SP1 | ... | ... | - | P0 |
| SP2 | ... | ... | SP1 | P1 |

## Build Order
SP1 → SP2 → ...（理由）

## Cross-cutting Concerns
- 认证 / 数据隔离 / 观测性（仅列出跨子项目共享的决策）

## Open Questions
- ...

## Next Steps
-> 从 SP1 开始走标准 /spec:brainstorm
```

**交叉引用（Epic 元数据单一来源契约）**：

- **唯一来源**：各 sub-project 的 requirements doc **frontmatter** 新增可选字段 `epic: <epic-slug>`。**不**在 Key Decisions 或正文任何位置冗余承载此信息（Key Decisions 是自由文本区，不适合结构化元数据）。
- **Epic doc 文件命名约定**：`docs/brainstorms/YYYY-MM-DD-<epic-slug>-decomposition.md`，其中 `<epic-slug>` 必须与 frontmatter 中的 `topic` 字段完全一致。
- **路径推导规则**（当前主消费者为 `spec-plan`）：
  1. 读取 sub-project requirements doc 的 frontmatter `epic` 字段，得到 `<epic-slug>`
  2. 在 `docs/brainstorms/` 下 glob 匹配 `*-<epic-slug>-decomposition.md`
  3. 命中多个（因不同 date 前缀）时取**文件名字典序最大**（等价于最新 date）的那个
  4. 命中零个 → 退化为"仅告警 + 继续"（见下）
- **Epic doc 缺失时的退化行为**（consumer side）：
  - `spec-plan`：发出 warning 到执行日志"epic doc <slug> not found, planning without epic context"，继续执行（**不**阻断）
  - 不得因 epic doc 缺失而中止工作流，避免 frontmatter 字段成为单点故障
- **范围边界**：本方案**不**把 epic metadata 消费契约下放到 `spec-work` 的 direct-to-work 路径。原因是当前 `references/handoff.md` 已明文限制 direct-to-work 仅在 `Lightweight + 成功标准清晰 + 无重要技术/研究问题` 时才可出现，该路径与 epic decomposition 场景天然不重叠。
- **后续扩展条件**：若未来 `spec-work` 明确扩展为“稳定消费 requirements frontmatter 的一等入口”，再单独立项补 epic 上下文加载义务与对应测试。
- **消费端测试覆盖**：
  - `tests/unit/spec-plan-contracts.test.js` 新增 "epic metadata consumption" 用例（读取 frontmatter → glob 推导 → 命中/多命中/零命中三分支）
  - 本期**不**要求 `tests/unit/spec-work-contracts.test.js` 新增 epic 消费测试；`spec-work` 保持当前 plan-driven / lightweight direct-to-work 边界
  - 测试不能仅验证 brainstorm 自身产出，必须至少验证 `spec-plan` 的下游消费行为

---

### P0.2 Requirements 分节逐确认

**目的**：偏差在 300 字内被抓住，而不是 3000 字后。

**落地位置**：`references/requirements-capture.md` + `SKILL.md` Phase 3

**规则**：
- **Lightweight**：允许一次性生成（维持现状）
- **Standard / Deep**：必须分节呈现。节序：
  1. Problem Frame
  2. Requirements（按分组，每组一次呈现）
  3. Success Criteria
  4. Scope Boundaries
  5. Key Decisions（如有）
  6. Dependencies / Assumptions（如有）
  7. Outstanding Questions

**实现机制**（避免多次文件 I/O）：
- 每节先在**对话中呈现草稿 prose**（≤150 字），用 blocking 问答工具：「本节对吗？」— 选项：`Y, 继续` / `调整本节` / `回到上一节`
- 全部节确认后**一次性写入** `docs/brainstorms/YYYY-MM-DD-<topic>-requirements.md`
- 用户选"调整本节" → 保留其他已确认节，仅迭代当前节

**退出条件**：所有节 Y 确认 → 进入 Phase 3.5

**Lightweight fast path**：仍可一次性生成 + 单次确认。

---

### P0.3 用户本人 Review Gate

**目的**：区分 agent 级评审（spec-doc-review）与人眼级产品意图验证。

**落地位置**：Phase 3.5 末尾，Phase 4 开始之前新增 Phase 3.6

**交互**（独立一条消息，不与 handoff 选项合并）：
> "需求文档已写入 `<path>`，自动评审通过。请打开确认文档是否反映了你的真实意图，回复 OK 继续到 planning，或说明需要调整的点。"

**阻塞规则**：
- 未收到 ack → 不能进入 Phase 4
- 用户提出修改 → 回到 Phase 3 对应节的分节确认流程
- 用户显式 skip（如「直接走 planning」）→ 记录到 `Key Decisions: 用户主动 skip review gate` 再进入 Phase 4
- Lightweight 且无文档产出 → 此 gate 自动略过（对话本身即 review）

**skip future gates 状态承载面（载体与生命周期）**：

- **选定载体**：**当前 skill 运行期内存变量**，不持久化，不跨会话，不写入 `.claude/spec-first/state.json`，不写入 memory 系统
- **生命周期**：仅在当前 `/spec:brainstorm` 调用栈内有效；skill 退出即失效；下次调用需用户重新声明
- **作用域**：仅覆盖 Phase 3.6 User Review Gate 与 Phase 0.3a Decomposition 决策点；**不**覆盖 Phase 4.2 Terminal State Lock 的逃生口（安全关键，必须每次显式二次确认）
- **拒绝理由**：不进入 memory / state.json，因为 review gate 的价值在于"用户当下是否真的过目了 spec"，跨会话保留该 skip 意图反而会导致用户长期绕过 gate，违背设计初衷

**与 spec-doc-review 的协作边界**：spec-doc-review 查完整性/一致性/风险，User Review Gate 查产品意图是否对齐。

---

### P0.4 Terminal State Lock

**目的**：brainstorm 出口不被 implementation skill 劫持，同时保留既有非实现类出口（如 Proof 分享）。

**落地位置**：`SKILL.md` Core Principles 新增一条 + Phase 4 开头明文声明

**采用 denylist + 双 allowlist 三层模型**（不再是单纯白名单，避免与 `references/handoff.md` 现有 `Share to Proof` 出口冲突）：

**① Denylist（硬禁止，除非走逃生口）**：
- 任何**会修改源码或改变宿主运行环境**的 skill（无论修改对象是代码文件、依赖清单、MCP 配置、系统 settings、CI 管线还是其他运行时载荷）
- 典型示例：`frontend-design`、`coding-task`、`mcp-setup`（修改宿主 MCP 配置）、`release-skills`、`git-commit-push-pr`、以及任何直接修改源码 / 创建脚手架 / 执行 git write / 执行包管理安装的 skill
- 原则判定：若一个 skill 的"正常效果"会导致源码或宿主运行环境发生持久性变化，就属于 denylist

**② Allowlist-Workflow（默认允许的下游工作流）**：
- `/spec:plan`（默认推荐）
- `/spec:work`（仅 direct-to-work gate 通过时）
- `/spec:code-review`（PR 已存在时）
- `spec-doc-review`（重跑评审）
- `/spec:brainstorm`（自身继续）

**③ Allowlist-SideEffect（允许的非实现类副作用出口）**：
- `Share to Proof`（对齐 `references/handoff.md:21、41` 既有行为）
- 文档导出 / 只读分享类操作
- 原则判定：不修改源码、不触发下游实现、仅产生文档或外部协作链接

**逃生口**（Denylist 的唯一合法绕过）：
- 用户显式声明"skip planning，直接改代码"
- 必须二次确认（独立 blocking 问答，不与其他问题合并）
- 必须写入 requirements doc 的 `Key Decisions: 用户主动跳过 planning 路径，风险自承`
- 不受 §4.P0.3 skip future gates session flag 豁免

**实现位置**：
- `SKILL.md` Phase 4 开头段落明文声明三层模型
- `references/handoff.md` Phase 4.2 新增 "Unlisted skill requested" 分支处理指南（先按三层模型分类，再决定路径）

**Deliberate Divergence（显式偏离声明）**：
- `superpowers/brainstorming` 的 terminal state 是**单出口**：spec 通过后只能进入 `writing-plans`
- `spec-first` 的产品面不同，必须保留现有合法出口：`/spec:plan`、通过 gate 的 `/spec:work` direct-to-work、重跑 `spec-doc-review`、以及 `Share to Proof`
- 因此本方案**吸收的是 terminal safety intent**：brainstorm 不得被实现类 skill 劫持；**不吸收的是 single-exit form**：不把所有后续动作都折叠成一个写计划技能
- 该偏离属于刻意设计，不是漏抄 source

---

### P1.1 HARD-GATE + 反模式显式声明

**落地位置**：`SKILL.md` 顶部（`# Brainstorm a Feature or Improvement` 标题之后、Core Principles 之前）

**新增内容**：
```markdown
<!-- spec-first:brainstorm:hard-gate -->
**HARD GATE**: 在用户对本次 brainstorm 的产品意图达成显式确认（或走完 Lightweight fast path 的口头对齐）之前，禁止调用任何 implementation skill、脚手架代码或修改源码。此规则对所有请求生效，**不以"需求看起来简单"为例外**。

**HARD GATE 约束的是"不得直接跳到 implementation"，而不是"必须把所有 brainstorm 都落盘成文档"。** Lightweight brainstorm 仍可按仓库既有合同（`SKILL.md:247` / `references/requirements-capture.md:76`）跳过文档产出，只要用户在对话中完成了产品意图对齐。是否产出文档 = Scope 决定；是否进入 implementation = HARD GATE 决定。两者正交。

**Anti-pattern：「这需求太简单不需要 brainstorm」** — 越简单的需求越容易踩"未验证假设"。简单需求的 brainstorm 可在 3-5 轮对话内完成并由口头对齐收尾（无需文档），但不得跳过对齐本身。软性减重（Phase 0.2）只决定**文档长度 / 是否落盘**，不决定**是否跳过产品意图确认**。
```

---

### P1.2 Design-for-isolation 边界检查

**落地位置**：`references/requirements-capture.md` "Before finalizing, check" 清单新增 3 条

```markdown
- 每条 R* 能否归属到一个清晰的职责单元？若横跨多个职责，是否需要拆成更细的 R*？
- 需求涉及的组件边界是否清晰到 consumer 无需了解内部实现即可正确使用？
- 若某边界决策会被迫在 planning 阶段拍板，它本质是产品决策还是实现决策？是产品决策就应在本文档里定下来。
```

**边界与 planning 的分工声明（补入同文件 header）**：纯技术分层（哪个文件、哪个类）留给 planning；用户可感知的产品能力单位在 brainstorm 确定。

---

### P1.3 Targeted Improvements Scope Rule

**落地位置**：`references/requirements-capture.md` Scope Boundaries 章节头部增加启发式

```markdown
**既存代码相关改进的纳入原则**：
- **包含**：直接影响本次需求边界、用户可感知行为、或跨模块职责分工的关联改进
- **排除**：纯实现层重构（拆分类、移动文件、局部 service 重写）以及与本次需求无因果关系的通用 refactor、代码质量改进
- **记录方式**：在 Requirements / Key Decisions 中只记录**产品或架构层级**的关联约束，不写具体类名、文件名或重构动作
- **示例**：可写“需要把现有认证能力收口为单一路径以支撑 R3”，不要写“拆分 UserService 以支持 R3”
```

**效果**：避免两种病态 —— 把所有技术债塞进 requirements doc / 完全忽略会改变需求边界的关联改进。

---

### P1.4 Process Flow 图

**落地位置**：`SKILL.md` 位于 "Execution Flow" 标题之下、Phase 0 之前

**内容**（Mermaid `flowchart TD`）：Resume Check → Task Domain Classify（软件/非软件/直接回答）→ Scope Decomposition Needed（P0.1）→ Epic Doc 分支 OR 标准 Phase 0.3 → Supplemental Research Dispatch → Pressure Test → Dialogue → Approaches → Section-by-section Capture（P0.2）→ spec-doc-review → User Review Gate（P0.3）→ Handoff Options with Terminal State Lock（P0.4）

**作用**：agent 快速对齐全景决策树，降低路由错误。

---

### P1.5 Context Pulse

**目的**：吸收 `superpowers` 中“探索项目上下文时显式查看 recent commits”的优势，但控制在轻量脉冲级别，不升级为完整 code review。

**落地位置**：`SKILL.md` 在 Phase 0.1 之后新增 `0.1a Current Work Pulse`；并在 Phase 1.1 Context Scan 中补一条触发说明。

**触发条件**（任一成立才触发）：
- 用户明确说“继续上次那个”“基于刚才的 brainstorm 继续”
- Phase 0.1 命中 resume existing work
- 当前 topic 与最近提交主题明显相关
- 当前工作区存在与 topic 强相关的脏改动

**动作边界**：
- 读取最近 5-10 条 commits 的摘要（主题 + 受影响路径），必要时读取 `git status --short`
- 只输出**Current Work Pulse 简报**，包括：
  1. 近期发生了什么
  2. 哪些变化可能影响本次 brainstorm
  3. 哪些结论仍需在 requirements 中显式确认
- 不做完整 code review，不逐文件展开，不把近期提交自动视为“既定产品决策”

**不触发场景**：
- 全新 topic，且当前工作区无相关近期脉冲
- Lightweight 新需求，repo scan 已足够回答问题

**价值**：降低“继续既有讨论”时的上下文断裂，避免 brainstorm 与最新工作状态脱节。

---

### P1.6 Preflight Self-Check

**目的**：吸收 `superpowers` 的 deterministic spec self-review 优势，在进入 `spec-doc-review` 之前先做一次本地低成本预检。

**落地位置**：`SKILL.md` 在 Phase 3 与 Phase 3.5 之间新增 `Phase 3.4 Preflight Self-Check`；`references/requirements-capture.md` 的完成性检查中同步补入。

**四项固定检查**：
1. **Placeholder scan**：是否存在 `TODO`、`TBD`、占位符或未完成段落
2. **Contradiction scan**：Requirements / Success Criteria / Scope Boundaries / Key Decisions 之间是否互相打架
3. **Scope sanity**：文档是否已经膨胀为多个独立子系统，需要回退到 decomposition
4. **Ambiguity scan**：是否存在足以让 `spec-plan` 或执行阶段做出两种相反实现的模糊描述

**执行规则**：
- 能在本地直接修正的，先 inline 修正，再进入 `spec-doc-review`
- 若发现需要用户补决策的问题，回到对应节确认，不把模糊点带进 Phase 3.5
- Lightweight 且未产出 requirements doc 时，此步骤为 no-op

**与 `spec-doc-review` 的边界**：
- `Preflight Self-Check` 是作者自检，不替代 multi-persona review
- `spec-doc-review` 仍是正式质量门；preflight 的作用是减少显而易见的低级缺陷，把 reviewer 注意力留给真正的产品/范围/风险问题

---

### P2.1 Visual Companion（独立立项）

**决策**：本期**deferred-not-absorbed**，不并入 `spec-brainstorm` 主体。

**理由**：
- 依赖本地 server + scripts + `.gitignore` 副作用 + 30 分钟保活
- 跨平台（Claude Code mac/Linux/Win、Codex、Gemini）分支多
- 与 spec-first 现有资产同步模型（plugin.json / adapters / state.json）耦合点复杂，值得独立评估

**本期明确结论**：
- 当前方案**没有吸收** `visual-companion.md` 的能力，只保留一个后续独立立项占位
- 因此不能把它算作“本方案已吸收的 source 优势”，最多算“已识别但延期”

**接入方案（草图，留给下一次立项细化）**：
- 新 skill：`skills/spec-brainstorm-visual/` fork superpowers 的 `scripts/*` + `frame-template.html`
- 路径改造：`--project-dir` 落到 `.spec-first/brainstorm-visual/`
- `.gitignore` 注入：仿照 `lang-policy.js` 的标记式幂等注入机制
- 接入点：`spec-brainstorm` 在 1.3 启动前新增一条独立 offer 消息（不与 clarifying question 合并），用户同意后加载 `spec-brainstorm-visual`
- Codex adapter：复核 rewriteSkillName 与 skill path 重写不受影响

**后续立项必须覆盖的协议边界**（否则不能称为“已吸收”）：
- **server lifecycle**：启动、存活探测、30 分钟 inactivity timeout、异常重启
- **session dir contract**：`screen_dir` / `state_dir` / `server-info` 的路径与可恢复性
- **events protocol**：浏览器点击事件写入 `state_dir/events` 的读取与消费契约
- **host-specific startup matrix**：Claude Code mac/Linux、Claude Code Windows、Codex、Gemini 的启动方式差异
- **waiting screen / unload**：视觉回合结束后如何清理陈旧屏幕
- **cleanup / timeout**：会话结束后的目录清理、`.gitignore`、治理与状态文件影响

---

## 四.五、刻意不吸收与延后吸收清单

这一节用于防止“把 source 每一条都照搬”造成产品面错位。以下项不是遗漏，而是**经过判断后的非采纳结论**：

| 项目 | 状态 | 原因 |
|---|---|---|
| `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` 作为固定产物路径 | 刻意不吸收 | spec-first 已有 `docs/brainstorms/` 契约，且与现有下游消费者一致 |
| brainstorm 阶段写完 spec 后必须立即 commit | 刻意不吸收 | 当前仓库没有“brainstorm 必须提交 git”治理要求；过早 commit 会放大文档试错成本 |
| 以 architecture / components / data flow / testing 作为 brainstorm 主体结构 | 刻意不吸收 | 这些内容更接近 implementation planning；spec-first 保留 WHAT/HOW 边界 |
| terminal state 只允许进入 writing-plans | 刻意不吸收 | 当前产品面需要保留 `/spec:plan`、受 gate 约束的 `/spec:work`、`spec-doc-review`、Proof |
| 每个流程环节都强制创建 checklist task | 刻意不吸收 | spec-first 当前没有把 brainstorm 与 task 系统强绑定的必要性 |
| Visual Companion | 延后吸收 | 能力有价值，但依赖本地 server 与多宿主协议，独立立项更合理 |

**补充说明**：
- `superpowers` 的“推荐先于选项展示”不直接移植。当前 `spec-brainstorm` 保留“先展示 approach，再给 recommendation”的顺序，以避免用户被过早锚定。
- `spec-first` 吸收的是 source 中能提升 requirements 质量与流程安全性的部分，而不是复制其所有产品形态。

---

## 五、测试与验证策略

### 新增单元测试（Jest）

**brainstorm 自身契约** — `tests/unit/spec-brainstorm-contracts.test.js`
- `P0.1` decomposition 触发检测（参数化多条 description 样本）
- `P0.1` 合并路径的 Key Decision 记录契约
- `P0.1` **Epic 元数据单一来源**：frontmatter `epic` 字段存在，且 Key Decisions 与正文**不得**冗余承载
- `P0.2` 分节顺序契约 + "调整本节" 不影响其他节确认
- `P0.3` User Review Gate 阻塞（未 ack 时 handoff 选项不可呈现）
- `P0.3` skip future gates 仅作用于当前 skill 运行期，不落 state.json / memory
- `P0.4` Denylist + 双 Allowlist 三层模型契约（implementation skill 被拒 / workflow 通过 / Proof 通过 / 逃生口二次确认）
- **§3.5 blocking tool fallback**：宿主无 blocking 工具时，所有 P0 决策点等价降级到编号选项流
- `P1.5` Context Pulse 触发矩阵（resume / 相关 recent commits / 相关 dirty changes / 全新 lightweight topic 不触发）
- `P1.6` Preflight Self-Check 四项固定检查的分支覆盖（可自动修复 / 需回问用户 / Lightweight no-op）

**下游消费端契约**（v1.1 新增，防止"plan 被迫发明产品"在契约层重现）
- `tests/unit/spec-plan-contracts.test.js` 新增 "epic metadata consumption" 用例
  - 读取 frontmatter `epic` → glob 推导 → 命中单个 / 命中多个取最新 / 命中零个 三分支
  - 零命中时必须是 warning + 继续，**不**中止工作流
- `tests/unit/spec-work-contracts.test.js` 本期**不**新增 epic 消费覆盖
  - 维持现有 `spec-work` plan-driven / lightweight direct-to-work contract
  - 若未来扩展 `spec-work` 输入边界，再补对应契约测试

### 新增 smoke / integration
`tests/integration/spec-brainstorm-flow.sh`
- Epic 场景 → 生成 decomposition.md + 引导首个 sub-project + 下游 plan 正确 glob 到 epic doc
- 单需求 Lightweight → 不触发分节、不触发 review gate
- 单需求 Standard → 走完 7 节确认 + preflight self-check + review gate + handoff 选项正确
- **Proof 出口场景**：Phase 4 选择 Share to Proof 后 Terminal State Lock 不拦截
- **Resume/continue 场景**：命中 existing work 时会生成 Current Work Pulse，而不是直接丢失最近工作上下文

### 回归
- `npm run test:smoke` 保证 skill 同步 / rewrite / state.json 写入无回归
- `tests/unit/spec-review-contracts.test.js`、`spec-graph-bootstrap-contracts.test.js` 无需改动但必须绿灯

### 手工验证剧本
- Lightweight：一句话需求 → 3-5 轮完成
- Standard：典型 feature → 分节确认 + review gate 顺畅
- Deep：跨模块重构 → decomposition 是否正确触发或正确不触发
- Anti-case：已明确 PRD 的需求 → HARD-GATE 不过度打断
- **Fallback case**：模拟无 blocking 工具的宿主 → P0 交互点等价降级
- **Proof case**：选择 Share to Proof 出口 → Terminal State Lock 放行
- **Resume pulse case**：用户说“继续上次那个” → recent commits / git status 只产出轻量 pulse，不升级为 code review

---

## 六、兼容性与治理

### 向后兼容
- `requirements-capture.md` 模板字段**只扩不删**；老需求文档仍可被 spec-plan 正确消费
- skill frontmatter `name: brainstorm-workflow` 不变
- Codex adapter：涉及文件均在 `skills/spec-brainstorm/`，经 adapter 路径重写后仍走标准 skill 路径，无 canonical agent name 变更
- `spec-work` 本期不新增 epic frontmatter 消费语义，避免把大型需求 contract 意外下放到 lightweight direct-to-work

### 上下游同步
- `spec-plan` 入口 description / argument-hint：保持现有交互式 review 主线契约不变；补充 Epic 元数据消费规则——**从 requirements doc frontmatter 的 `epic` 字段读取**，按 §4.P0.1 路径推导规则 glob 匹配 epic decomposition doc，命中零个时退化为仅告警继续（**不**从 Key Decisions 正文读取）
- `spec-work` direct-to-work gate：本期仅在 Terminal State Lock 说明里继续明确"gate 未通过不得直接跳入"；**不**新增 Epic 上下文加载义务
- `spec-doc-review`：无契约变更，User Review Gate 是**其后**的追加步骤
- `references/handoff.md`：§4.P0.4 Denylist + 双 Allowlist 三层模型须在此文件 Phase 4.2 落地，保留 `Share to Proof` 行为
- `docs/10-prompt/skills/spec-brainstorm/`：作为 `skills/spec-brainstorm/` 的镜像，必须同步刷新，避免 prompt mirror 漂移
- `docs/08-版本更新/README.md`：若 P0/P1 落地形成用户可见 workflow 变化，必须同步追加版本说明
- 若后续单独立项新增 `skills/spec-brainstorm-visual/`：需同步更新 `src/cli/contracts/dual-host-governance/skills-governance.json` 与相关 lint / tests

### 语言与 Changelog
- 所有新增文字遵循 `zh` 策略（代码标识符 / 配置键保留英文）
- `CHANGELOG.md` 每个 P0/P1 项单独一条记录（按 CLAUDE.md 铁律），格式：
  ```
  - vX.Y.Z 2026-MM-DD 作者: spec-brainstorm 新增 Scope Decomposition 早检测与 Epic 分解模板 (user-visible)
  ```
- 对用户可见的 workflow 变更，除 `CHANGELOG.md` 外还需同步更新 `docs/08-版本更新/README.md`

---

## 七、实施路线图

| Sprint | 周期 | 范围 | 验收 |
|---|---|---|---|
| S1 | 1 周 | P0.1 + P0.2 + P0.3 + P0.4 + 配套单元/集成测试 + **测试 runner 接线**（见下）+ 4 条 CHANGELOG | 新增测试**在默认 `npm run test:integration` 入口下被执行**，全绿 + smoke 无回归 |
| S2 | 0.5 周 | P1.1 + P1.2 + P1.3 + P1.4 + P1.5 + P1.6 + 手工验证剧本 | 6 条 CHANGELOG + 手工剧本通过 |
| S3 | 独立立项 | P2.1 Visual Companion 独立 skill 的 brainstorm + plan | 不在本方案主线范围 |

**S1 测试 runner 接线细则**（v1.2 强化，避免"文档写了会测，CI 根本没跑"的假象）：

- `tests/integration/spec-brainstorm-flow.sh` **必须在 `tests/integration/e2e.sh` 中被 source 或调用**，否则 `npm run test:integration` 不会覆盖
- `tests/unit/spec-brainstorm-contracts.test.js` 走 `npm run test:unit` 的 Jest 入口（`npx jest tests/unit --runInBand`），无需额外接线
- `tests/unit/spec-plan-contracts.test.js` 同上；`tests/unit/spec-work-contracts.test.js` 本期无新增 epic 覆盖要求
- **验收硬条件**：在**未手工单独执行** `spec-brainstorm-flow.sh` 的前提下，直接运行 `npm run test:integration` 必须覆盖该脚本，并能通过输出日志或失败传播证明接线有效；**不得**用 "`git log` 里是否出现过 `tests/integration/e2e.sh` 修改 commit" 作为验收条件

---

## 八、风险与对冲

| 风险 | 概率 | 影响 | 对冲 |
|---|---|---|---|
| 分节确认让 Lightweight 感知变长 | 中 | 用户体验 | Lightweight fast path + 单节提示 ≤20 字 + blocking 工具单选 |
| Decomposition 误检 | 中 | 用户被打断 | 双条件阈值（名词数 + 字数/关键词）+ 用户否定后无摩擦回到标准路径 |
| User Review Gate 疲劳 | 低 | 用户体验 | 允许 session 级 `skip future gates`（session flag，不入 memory）|
| Terminal State Lock 拦合法用例 | 低 | 流程卡顿 | 逃生口 + Key Decisions 记录 + 支持一次性 override |
| Context Pulse 带入无关近期提交噪音 | 中 | 低 | 仅在 4 类触发条件启动；最多看 5-10 条 commits；只输出 pulse 简报 |
| 与 spec-plan 契约漂移，或误把 epic contract 下放到 spec-work | 中 | 下游失灵 | 本方案显式限定 epic consumer 仅为 `spec-plan`；`spec-work` 维持现有边界，未来扩展再单列立项 |

---

## 九、成功指标

**量化（需要 6-8 周采样）**：
- Epic 类需求被正确识别并进入 decomposition 流程的比例 ≥ 70%
- Standard/Deep brainstorm 产出的 requirements doc 在 Phase 3 之后**重大内容改写**的频次下降 ≥ 40%
- 用户在 User Review Gate 发现"我原本想的不是这样"的比例 ≥ 15%（说明 gate 真的抓到了偏差）
- Terminal State Lock 逃生口触发率 < 5%（高则说明白名单太窄）

**质量（主观评估）**：
- `/spec:plan` 反馈"brainstorm 没给清楚的产品决策，我被迫发明"数量下降
- Epic 类需求的 plan 阶段单次成本下降（不需要中途拆分）

---

## 十、决策请求

**v1.3 修订已闭环 5 个结构性缺口**：
1. ✅ 用“源项目优势覆盖矩阵”把 source 优势分成已具备 / 本期吸收 / 延后吸收 / 刻意不吸收，文档可自证完整性
2. ✅ 补入 `P1.5 Context Pulse`，显式吸收 `recent commits / current work pulse`
3. ✅ 补入 `P1.6 Preflight Self-Check`，补上 `spec-doc-review` 之前的 deterministic preflight
4. ✅ 在 `P0.4` 下加入 `Deliberate Divergence`，明确吸收的是 terminal safety intent，而不是单出口形式
5. ✅ 将 `P2.1 Visual Companion` 收口为 deferred-not-absorbed，并写清后续立项必须覆盖的协议边界

**v1.2 修订已闭环 3 个执行级缺陷**：
1. ✅ 集成测试 runner 接线写入 S1 范围，验收硬条件改为 `npm run test:integration` 的真实覆盖证明，而非 `git log` 证据
2. ✅ HARD-GATE 范围限定为"禁止跳到 implementation"，与 Lightweight fast path 无文档路径正交，不再互搏
3. ✅ Terminal State Lock denylist 原则收敛为"修改源码或宿主运行环境"，mcp-setup 归类与原则一致

**v1.1 已闭环 5 个 contract 级缺陷**（保持不变）：
1. ✅ Epic 元数据单一来源 = requirements doc frontmatter
2. ✅ Blocking tool fallback 全局继承声明（§3.5）
3. ✅ Terminal State Lock 三层模型显式收纳 Proof
4. ✅ Epic 消费契约机械化 + 测试矩阵延伸到 `spec-plan` 消费端（`spec-work` 维持 deferred）
5. ✅ skip future gates 载体 = 当前 skill 运行期内存

本方案建议：
1. **立即启动 S1**（P0 全部 4 项），contract 与执行级缺陷已修订，可进入立项执行
2. **S2 与 S1 并行或紧接**（P1 全部 6 项），多为文档侧改动
3. **S3 独立立项**，不阻塞本方案落地

如认可 v1.3 骨架，建议下一步：启动 S1 → 生成对应 CODE_TASK 文档（`abcoder:task`）→ 走 `/spec:plan` 结构化分解 → 进入 `/spec:work` 执行。
