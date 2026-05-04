# ECC Agent 集成到 spec-first 的终态技术方案文档

> 建议文件名：`docs/2026-05-04-ecc-agent-integration-final/TECHNICAL_PLAN.md`
> 文档定位：终态技术方案，不是 MVP 方案
> 核心目标：把 ECC 的优秀 agent 专家能力吸收到 spec-first，但不让 ECC 的 agent 结构反向主导 spec-first 架构。

---

## 0. 结论先行

**最终形态不是“把 ECC agents 原样搬进 spec-first”。**

最终形态应该是：

```text
spec-first Skill 负责流程闭环
ECC Agent 能力被吸收为 spec-first 专家 Lens / Agent
Graph / Repo facts / Standards / Diff / Docs 提供证据
Skill Router 按任务、风险、文件、技术栈动态选择专家
Skill Synthesis 负责最终裁判、合并、降噪、写产物
```

一句话：

> **ECC 提供优秀的专家能力样本，spec-first 提供工程闭环、证据路由、产物协议和团队治理。**

ECC 官方定位里，agents 是由 skills 调用的 specialized subagents，通常不是用户直接调用；这和 spec-first 当前“Skill 是节点，Agent 是局部专家”的方向一致。ECC 当前公开说明显示其 typical cycle 是 `brainstorm → plan → work → code-review → compound`，并声明当前包含 37 个 skills 和 51 个 agents。([GitHub][1])

spec-first 当前用户手册已经把系统定义成项目级 AI 工程闭环，而不是单点命令集合；当前闭环覆盖 `mcp-setup / graph-bootstrap → ideate → brainstorm → doc-review → plan → write-tasks → work / debug / optimize / polish → code-review / app-consistency-audit → compound / compound-refresh / sessions / slack-research / skill-audit`。([GitHub][2])

---

# 1. 背景与目标

## 1.1 背景

spec-first 当前已经具备自己的核心闭环：

```text
Codebase
  → Graph
  → Spec
  → Plan
  → Tasks
  → Code
  → Review
  → Knowledge
```

它的关键价值不是“多几个 prompt”，而是：

1. 把 AI coding 从临时聊天变成受治理的工程流程。
2. 把需求、方案、任务、代码、审查、知识沉淀变成可追踪产物。
3. 让不同阶段调用不同专家，而不是所有事情都塞给一个通用 agent。
4. 通过 graph facts / repo standards / diff / docs 让 agent 判断有证据来源。
5. 支持个人开发、团队协作、多端协同、多仓工作区。

ECC 的价值在于：它已经沉淀了一组非常细的专家 agent，例如 correctness、security、testing、architecture、scope guardian、coherence、git history、repo research、design、PR feedback 等。ECC README 列出的 agent 覆盖 Review、Document Review、Research、Design、Workflow、Docs 等类别。([GitHub][3])

## 1.2 目标

本方案目标是把 ECC agent 能力系统化吸收到 spec-first：

| 目标      | 说明                                                              |
| ------- | --------------------------------------------------------------- |
| 能力吸收    | 吸收 ECC 中成熟的专家视角，而不是复制 ECC 的命令结构                                 |
| 架构不反客为主 | spec-first 仍以 Skill 为流程节点，以 Agent/Lens 为局部专家                    |
| 动态路由    | 每次只调用必要 agent，避免 token 爆炸                                       |
| 证据优先    | agent 判断必须基于 spec、plan、tasks、graph facts、diff、standards、history |
| 产物标准化   | agent 输出统一进入 spec-first review/report schema                    |
| 团队可共享   | 支持团队规范仓库、项目 repo-profile、外部 standards index                     |
| 可演进     | 支持后续接入更多外部 agent 框架，而不是只服务 ECC                                  |
| 可审计     | 每次 agent 被调用的原因、输入、输出、置信度、证据都可追踪                                |

---

# 2. 非目标

| 非目标                                                      | 原因                                                                      |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| 不把 ECC 每个 agent 直接暴露成 `/spec:*` 命令                       | 会破坏 spec-first 的 workflow 闭环                                            |
| 不把 ECC skills 原样复制进 spec-first                           | ECC 的 skill taxonomy 和 spec-first 的产物链路不完全一致                            |
| 不默认每次 review 调用所有 agent                                  | token 成本高，噪音大，审查质量下降                                                    |
| 不让 agent 直接写长期产物                                         | agent 只负责局部判断，最终写入由 Skill synthesis 控制                                  |
| 不把 Figma、Slack、Session、GitHub PR 等能力设为 required baseline | 这些属于 optional capability，不能阻断核心流程                                       |
| 不引入硬规则引擎                                                 | 保持 spec-first 的原则：Light contract、Explicit boundaries、Let the LLM decide |
| 不把 repo-profile.yaml 变成运行时状态文件                           | repo-profile 只保存确认后的稳定标准，不保存 runtime routing 状态                         |

---

# 3. 核心设计原则

## 3.1 Skill 是流程节点，Agent 是专家视角

最终边界：

```text
Skill:
  - 决定当前 workflow 阶段
  - 读取上下文和证据
  - 决定调用哪些 agent
  - 汇总、裁判、降噪、排序
  - 写入最终产物

Agent:
  - 只做一个局部专家判断
  - 不决定流程
  - 不直接写长期产物
  - 不越权修改 repo-profile
  - 输出结构化 findings
```

## 3.2 Agent 不等于 Skill

ECC 中很多能力虽然叫 agent，但在 spec-first 里应该被重命名为：

```text
Lens / Expert / Reviewer / Researcher
```

例如：

| ECC 名称                       | spec-first 终态名称               |
| ---------------------------- | ----------------------------- |
| `ce-scope-guardian-reviewer` | `scope-guardian-expert`       |
| `ce-feasibility-reviewer`    | `feasibility-expert`          |
| `ce-correctness-reviewer`    | `correctness-review-expert`   |
| `ce-git-history-analyzer`    | `git-history-research-expert` |
| `ce-design-lens-reviewer`    | `design-lens-expert`          |

## 3.3 Scripts prepare, LLM decides

脚本只负责准备事实：

```text
diff stats
changed files
graph facts
provider readiness
test commands
repo standards
manifest facts
history hints
artifact existence
```

LLM/Skill 负责判断：

```text
这个变更是否需要 security expert？
这个方案是否 scope creep？
这个 plan 是否缺少 API contract？
这个 app audit 是否需要 iOS expert？
这个 data migration 是否高风险？
```

## 3.4 Preview-first，Confirm-before-write

所有标准、规范、agent registry 变更都必须先 preview：

```text
生成建议
  → 展示影响
  → 用户确认
  → 写入 repo-profile / standards index / managed assets
```

不能 silent write。

## 3.5 Graph-first，不重复扫仓库

spec-first 已有 graph readiness / graph facts 方向。ECC 的 repo research / architecture / pattern recognition 能力应优先消费：

```text
.spec-first/graph/graph-facts.json
.spec-first/graph/bootstrap-impact-capabilities.json
.spec-first/graph/reuse-candidates.json
.spec-first/graph/architecture-facts.json
.spec-first/config/provider-artifacts.json
.spec-first/config/runtime-capabilities.json
```

而不是每个 agent 都自己重新扫描整个仓库。

---

# 4. 当前基线

## 4.1 spec-first 当前基线

spec-first 当前资产模型已经不是简单 command 集合，而是带 runtime governance 的 managed assets。当前 README 显示 capability layer 包含 bundled source assets，运行时会按 Claude / Codex 投递 commands、workflow skills、standalone skills、agents 和 managed state。([GitHub][4])

用户手册中明确当前推荐入口包括 `spec-mcp-setup`、`spec-graph-bootstrap`、`spec-app-consistency-audit`、`spec-skill-audit`、`spec-compound`，并且支持单仓单项目、单仓多模块、多仓工作区三种开发模式。([GitHub][2])

## 4.2 ECC 当前基线

ECC 当前 agent 分类包括：

```text
Review
Document Review
Research
Design
Workflow
Docs
```

Review 类里包含 correctness、security、testing、maintainability、performance、reliability、API contract、architecture、Swift/iOS、data integrity、schema drift 等。Document Review 类里包含 coherence、design lens、feasibility、product lens、scope guardian、security lens、adversarial document reviewer。Research 类里包含 best practices、framework docs、git history、issue intelligence、learnings、repo research、session historian、slack researcher、web researcher。Design 类里包含 design implementation、design iterator、figma design sync。Workflow 类里包含 PR comment resolver 和 spec flow analyzer。([GitHub][3])

---

# 5. 终态架构

## 5.1 总体架构图

```text
┌───────────────────────────────────────────────────────────────┐
│                        User Intent                            │
│  requirement / bug / plan / PR / app audit / skill audit       │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                    spec-first Skill Node                      │
│ brainstorm / doc-review / plan / write-tasks / work / review  │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                    Context & Evidence Builder                 │
│ spec docs / plan / tasks / diff / graph facts / standards      │
│ git history / tests / PR comments / app evidence / sessions    │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                      Agent Router                             │
│ risk signals + file signals + domain signals + stage signals   │
└───────────────┬───────────────┬───────────────┬───────────────┘
                │               │               │
                ▼               ▼               ▼
      ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
      │ Product Lens   │ │ Engineering    │ │ Research Lens  │
      │ Scope / Flow   │ │ Quality Lens   │ │ History / Docs │
      └────────────────┘ └────────────────┘ └────────────────┘
                │               │               │
                └───────────────┬───────────────┘
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                     Skill Synthesis                           │
│ merge / dedupe / rank / conflict resolve / confidence grading  │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                    spec-first Artifacts                       │
│ brainstorm.md / design.md / plan.md / tasks.md / review.md    │
│ app-audit report / compound learning / standards preview      │
└───────────────────────────────────────────────────────────────┘
```

## 5.2 三层模型

```text
Workflow Layer
  spec-brainstorm
  spec-doc-review
  spec-plan
  spec-write-tasks
  spec-work
  spec-code-review
  spec-app-consistency-audit
  spec-compound
  spec-skill-audit

Agent Orchestration Layer
  agent registry
  routing policy
  evidence budget
  confidence model
  findings schema
  synthesis policy

Evidence Layer
  graph facts
  repo standards
  team standards
  docs artifacts
  diff facts
  git history
  PR comments
  test results
  app audit evidence
```

## 5.3 终态核心模块

| 模块                       | 职责                                | 是否新增  |
| ------------------------ | --------------------------------- | ----- |
| `agent-registry`         | 注册 spec-first 内部专家与 ECC 来源映射      | 新增    |
| `agent-router`           | 根据阶段、风险、文件、技术栈选择 agent            | 新增    |
| `evidence-builder`       | 统一准备 agent 输入上下文                  | 新增/增强 |
| `agent-output-schema`    | 统一 agent findings 输出结构            | 新增    |
| `skill-synthesis-policy` | 规定如何合并、去重、裁判 agent 输出             | 新增    |
| `standards-ingestion`    | 引入团队规范仓库和 repo-profile            | 新增/增强 |
| `graph-aware-review`     | 让 plan/review/task 消费 graph facts | 增强    |
| `app-agent-router`       | App audit 场景专项路由                  | 增强    |
| `skill-audit-agent-pack` | 审查 skill/agent 自身质量               | 增强    |

---

# 6. ECC Agent 到 spec-first 的终态映射

## 6.1 Review 类

| ECC Agent                           | spec-first 终态 Agent               | 进入哪个 Skill                                  | 集成等级 | 说明                                          |
| ----------------------------------- | --------------------------------- | ------------------------------------------- | ---- | ------------------------------------------- |
| `ce-correctness-reviewer`           | `correctness-review-expert`       | `code-review` / `debug`                     | P0   | 默认核心审查专家                                    |
| `ce-maintainability-reviewer`       | `maintainability-review-expert`   | `code-review`                               | P0   | 控制复杂度、耦合、死代码                                |
| `ce-testing-reviewer`               | `testing-review-expert`           | `code-review` / `work`                      | P0   | 检查测试缺口和弱断言                                  |
| `ce-security-reviewer`              | `security-code-review-expert`     | `code-review`                               | P0   | 代码层安全审查                                     |
| `ce-reliability-reviewer`           | `reliability-review-expert`       | `code-review` / `debug`                     | P0   | 生产稳定性和失败模式                                  |
| `ce-api-contract-reviewer`          | `api-contract-expert`             | `plan` / `code-review`                      | P0   | 多端、多团队强相关                                   |
| `ce-architecture-strategist`        | `architecture-expert`             | `plan` / `code-review`                      | P0   | 必须结合 graph facts                            |
| `ce-project-standards-reviewer`     | `project-standards-expert`        | `code-review` / `skill-audit` / `standards` | P0   | 检查 CLAUDE.md / AGENTS.md / repo-profile     |
| `ce-adversarial-reviewer`           | `adversarial-code-review-expert`  | `code-review`                               | P0   | 高风险变更最终压测                                   |
| `ce-code-simplicity-reviewer`       | `simplicity-expert`               | `plan` / `code-review`                      | P0   | 防过度设计                                       |
| `ce-data-integrity-guardian`        | `data-integrity-expert`           | `plan` / `code-review`                      | P1   | 数据一致性、迁移、导入导出                               |
| `ce-data-migrations-reviewer`       | `migration-safety-expert`         | `code-review`                               | P1   | 数据库迁移专项                                     |
| `ce-data-migration-expert`          | `production-data-mapping-expert`  | `debug` / `code-review`                     | P2   | 生产 ID 映射专项                                  |
| `ce-performance-reviewer`           | `performance-review-expert`       | `code-review`                               | P1   | 性能风险审查                                      |
| `ce-performance-oracle`             | `performance-optimization-expert` | `optimize`                                  | P1   | 优化阶段使用                                      |
| `ce-security-sentinel`              | `security-deep-audit-expert`      | `skill-audit` / `code-review`               | P1   | 高风险安全深审                                     |
| `ce-pattern-recognition-specialist` | `pattern-recognition-expert`      | `skill-audit` / `compound` / `code-review`  | P1   | 提炼模式和反模式                                    |
| `ce-swift-ios-reviewer`             | `ios-mobile-review-expert`        | `app-consistency-audit` / `code-review`     | P1   | App/iOS 场景强价值                               |
| `ce-julik-frontend-races-reviewer`  | `frontend-async-race-expert`      | `code-review` / `app-consistency-audit`     | P1   | 泛化成前端异步竞态专家                                 |
| `ce-kieran-typescript-reviewer`     | `typescript-expert`               | `code-review`                               | P1   | TS 项目按需启用                                   |
| `ce-kieran-python-reviewer`         | `python-expert`                   | `code-review`                               | P1   | Python 项目按需启用                               |
| `ce-kieran-rails-reviewer`          | `rails-convention-expert`         | `code-review`                               | P2   | Rails 项目按需启用                                |
| `ce-dhh-rails-reviewer`             | `rails-style-profile-dhh`         | `code-review`                               | P3   | 风格强，不进默认核心                                  |
| `ce-schema-drift-detector`          | `generated-artifact-drift-expert` | `code-review`                               | P2   | 从 Rails schema 泛化成 generated artifact drift |
| `ce-deployment-verification-agent`  | `deployment-readiness-expert`     | `work` / `code-review`                      | P1   | 发布前 Go/No-Go checklist                      |
| `ce-agent-native-reviewer`          | `agent-native-design-expert`      | `skill-audit`                               | P1   | 审查 spec-first 自身 skill/agent 设计             |

## 6.2 Document Review 类

| ECC Agent                          | spec-first 终态 Agent             | 进入哪个 Skill                             | 集成等级 | 说明                  |
| ---------------------------------- | ------------------------------- | -------------------------------------- | ---- | ------------------- |
| `ce-coherence-reviewer`            | `coherence-expert`              | `doc-review` / `plan` / `write-tasks`  | P0   | 审查文档矛盾、术语漂移         |
| `ce-feasibility-reviewer`          | `feasibility-expert`            | `doc-review` / `plan`                  | P0   | 判断方案是否能落地           |
| `ce-product-lens-reviewer`         | `product-lens-expert`           | `brainstorm` / `doc-review`            | P0   | 审查问题定义和目标偏移         |
| `ce-scope-guardian-reviewer`       | `scope-guardian-expert`         | `brainstorm` / `plan` / `doc-review`   | P0   | 防 scope creep、防过早抽象 |
| `ce-security-lens-reviewer`        | `security-plan-review-expert`   | `plan` / `doc-review`                  | P0   | 方案层安全审查             |
| `ce-adversarial-document-reviewer` | `adversarial-doc-review-expert` | `doc-review` / `plan`                  | P0   | 挑战前提、隐含假设、决策压力测试    |
| `ce-design-lens-reviewer`          | `design-lens-expert`            | `doc-review` / `app-consistency-audit` | P1   | 审交互状态、设计缺口、AI slop  |

## 6.3 Research 类

| ECC Agent                       | spec-first 终态 Agent               | 进入哪个 Skill                                 | 集成等级 | 说明                               |
| ------------------------------- | --------------------------------- | ------------------------------------------ | ---- | -------------------------------- |
| `ce-repo-research-analyst`      | `repo-research-expert`            | `graph-bootstrap` / `plan` / `code-review` | P0   | 应优先消费 graph facts                |
| `ce-git-history-analyzer`       | `git-history-expert`              | `plan` / `code-review` / `compound`        | P0   | 追踪设计演化和历史约束                      |
| `ce-learnings-researcher`       | `knowledge-reuse-expert`          | `compound` / `plan`                        | P0   | 搜索历史方案和知识沉淀                      |
| `ce-best-practices-researcher`  | `best-practices-research-expert`  | `plan` / `skill-audit`                     | P1   | 高质量方案设计时启用                       |
| `ce-framework-docs-researcher`  | `framework-docs-expert`           | `plan` / `debug` / `code-review`           | P1   | 技术栈官方文档研究                        |
| `ce-web-researcher`             | `external-research-expert`        | `ideate` / `brainstorm` / `skill-audit`    | P1   | 竞品、开源、最佳实践研究                     |
| `ce-session-historian`          | `session-history-expert`          | `sessions` / `plan`                        | P1   | 搜索历史 Claude/Codex/Cursor session |
| `ce-slack-researcher`           | `team-discussion-research-expert` | `slack-research` / `brainstorm`            | P2   | 依赖 Slack connector               |
| `ce-issue-intelligence-analyst` | `issue-intelligence-expert`       | `ideate` / `brainstorm`                    | P2   | 产品运营/痛点聚类                        |

## 6.4 Design 类

| ECC Agent                           | spec-first 终态 Agent            | 进入哪个 Skill                         | 集成等级 | 说明                                     |
| ----------------------------------- | ------------------------------ | ---------------------------------- | ---- | -------------------------------------- |
| `ce-design-implementation-reviewer` | `design-implementation-expert` | `app-consistency-audit` / `polish` | P1   | 校验 UI 实现与设计证据一致性                       |
| `ce-design-iterator`                | `design-polish-expert`         | `polish` / `work`                  | P1   | UI polish 阶段启用                         |
| `ce-figma-design-sync`              | `figma-sync-expert`            | `app-consistency-audit`            | P2   | 依赖 Figma evidence，不设 required baseline |

spec-first 当前 `app-consistency-audit` 已经覆盖 PRD、Figma context、本地源码、页面路由、KMP/Clean Architecture、组件复用、埋点、i18n 和行业规则之间的一致性检查，所以 Design/App 类 agent 应优先挂入这个 skill，而不是新建孤立 skill。([GitHub][2])

## 6.5 Workflow / Docs 类

| ECC Agent                 | spec-first 终态 Agent             | 进入哪个 Skill                                            | 集成等级 | 说明                  |
| ------------------------- | ------------------------------- | ----------------------------------------------------- | ---- | ------------------- |
| `ce-pr-comment-resolver`  | `pr-feedback-resolution-expert` | `work` / `code-review` / 新增可选 `resolve-pr-feedback`   | P1   | 处理 PR 评论            |
| `ce-spec-flow-analyzer`   | `spec-flow-expert`              | `brainstorm` / `doc-review` / `app-consistency-audit` | P0   | 分析用户流程和 spec 缺口     |
| `ce-ankane-readme-writer` | `readme-style-profile-ankane`   | `compound` / docs                                     | P3   | 太特定，仅作为可选写作 profile |

---

# 7. spec-first 终态 Agent 分组

最终不要暴露一堆零散 agent，而是形成稳定专家包。

## 7.1 P0 核心专家包

```text
Product & Scope Pack
  - product-lens-expert
  - scope-guardian-expert
  - spec-flow-expert

Document Quality Pack
  - coherence-expert
  - feasibility-expert
  - adversarial-doc-review-expert
  - security-plan-review-expert

Engineering Quality Pack
  - correctness-review-expert
  - maintainability-review-expert
  - testing-review-expert
  - reliability-review-expert
  - simplicity-expert

Architecture & Contract Pack
  - architecture-expert
  - api-contract-expert
  - repo-research-expert
  - git-history-expert

Governance Pack
  - project-standards-expert
  - knowledge-reuse-expert
```

## 7.2 P1 条件专家包

```text
Security Deep Pack
  - security-code-review-expert
  - security-deep-audit-expert

Performance Pack
  - performance-review-expert
  - performance-optimization-expert

Data Pack
  - data-integrity-expert
  - migration-safety-expert

Frontend/App Pack
  - design-lens-expert
  - design-implementation-expert
  - design-polish-expert
  - frontend-async-race-expert
  - ios-mobile-review-expert

Language Pack
  - typescript-expert
  - python-expert
  - rails-convention-expert

Research Pack
  - best-practices-research-expert
  - framework-docs-expert
  - external-research-expert
  - session-history-expert
```

## 7.3 P2/P3 可插拔专家包

```text
Team Context Pack
  - team-discussion-research-expert
  - issue-intelligence-expert

External Tool Pack
  - figma-sync-expert
  - pr-feedback-resolution-expert

Style Profile Pack
  - rails-style-profile-dhh
  - readme-style-profile-ankane
```

---

# 8. Skill 级终态集成方案

## 8.1 `spec-brainstorm`

### 目标

从用户原始需求、PRD、会议纪要、业务想法中形成高质量 `Brainstorm.md`。

### 集成 agents

| Agent                             | 触发条件                         |
| --------------------------------- | ---------------------------- |
| `product-lens-expert`             | 默认启用                         |
| `scope-guardian-expert`           | 默认启用                         |
| `spec-flow-expert`                | 涉及用户流程、多端流程、App/H5/admin 流程  |
| `external-research-expert`        | 用户要求竞品/开源/行业参考               |
| `team-discussion-research-expert` | 用户指定 Slack/会议/团队讨论           |
| `issue-intelligence-expert`       | 用户要求从 issues / feedback 归纳需求 |

### 输出增强

```text
Brainstorm.md
  - problem framing
  - users / scenarios
  - explicit assumptions
  - scope boundaries
  - multi-team impact
  - open questions
  - candidate specs
  - evidence used
  - agents invoked
```

---

## 8.2 `spec-doc-review`

### 目标

审查 PRD、Brainstorm、Design、Plan、Tasks 等文档质量。

### 集成 agents

| Agent                           | 触发条件                                  |
| ------------------------------- | ------------------------------------- |
| `coherence-expert`              | 默认启用                                  |
| `feasibility-expert`            | 技术方案、计划、任务拆分                          |
| `scope-guardian-expert`         | 需求范围、方案范围                             |
| `security-plan-review-expert`   | auth/data/API/payment/file/permission |
| `adversarial-doc-review-expert` | 高风险文档或用户要求深审                          |
| `design-lens-expert`            | App/H5/前端体验相关文档                       |

### 输出增强

```text
doc-review.md
  - contradictions
  - terminology drift
  - missing assumptions
  - feasibility risks
  - scope creep risks
  - security gaps
  - required revisions
  - optional suggestions
```

---

## 8.3 `spec-plan`

### 目标

把已经收敛的需求变成可执行技术方案。

### 集成 agents

| Agent                            | 触发条件                   |
| -------------------------------- | ---------------------- |
| `architecture-expert`            | 默认启用                   |
| `repo-research-expert`           | 默认启用，但优先读 graph facts  |
| `git-history-expert`             | 涉及改造旧模块、历史约定、架构演进      |
| `api-contract-expert`            | 涉及接口、多端、SDK、DTO、schema |
| `data-integrity-expert`          | 涉及数据库、迁移、账务、订单、资产      |
| `security-plan-review-expert`    | 涉及权限、用户数据、外部输入         |
| `feasibility-expert`             | 默认启用                   |
| `simplicity-expert`              | 默认启用，防止过度设计            |
| `framework-docs-expert`          | 技术栈不确定、新框架、新 API       |
| `best-practices-research-expert` | 用户要求行业/开源最佳实践          |

### 输出增强

```text
design.md / plan.md
  - selected architecture
  - alternatives considered
  - rejected alternatives
  - graph evidence
  - reuse candidates
  - integration points
  - API contract impact
  - data impact
  - security impact
  - test strategy
  - rollout strategy
  - risks and mitigations
  - agent findings summary
```

---

## 8.4 `spec-write-tasks`

### 目标

把 plan 编译成可执行任务包，降低 work 阶段上下文负担。

### 集成 agents

| Agent                         | 触发条件            |
| ----------------------------- | --------------- |
| `coherence-expert`            | 默认启用            |
| `architecture-expert`         | plan 涉及多模块/架构调整 |
| `api-contract-expert`         | 涉及接口联调          |
| `testing-review-expert`       | 默认启用，生成验证任务     |
| `scope-guardian-expert`       | 大需求、多端、多团队      |
| `deployment-readiness-expert` | 涉及发布/迁移/生产风险    |

### 输出增强

```text
tasks.md
  - task groups
  - execution order
  - parallelizable tasks
  - owner/team hints
  - required context per task
  - test commands
  - review checkpoints
  - blocked-by / depends-on
  - rollback / release notes if needed
```

---

## 8.5 `spec-work`

### 目标

执行 plan/tasks，完成代码修改。

### 集成 agents

work 阶段不建议大量 agent 常驻。agent 应只在关键节点介入：

| Agent                           | 触发条件           |
| ------------------------------- | -------------- |
| `repo-research-expert`          | work 前快速定位模式   |
| `framework-docs-expert`         | 实现遇到 API/框架不确定 |
| `pr-feedback-resolution-expert` | 用户要求处理 PR 评论   |
| `deployment-readiness-expert`   | work 完成前生成发布检查 |
| `testing-review-expert`         | 生成或补充测试策略      |
| `simplicity-expert`             | work 完成后做简化检查  |

### 输出增强

```text
work-log.md
  - changed files
  - implementation decisions
  - deviations from plan
  - tests run
  - unresolved risks
  - follow-up review hints
```

---

## 8.6 `spec-debug`

### 目标

定位 bug、复现问题、提出修复方案。

### 集成 agents

| Agent                         | 触发条件            |
| ----------------------------- | --------------- |
| `correctness-review-expert`   | 默认启用            |
| `reliability-review-expert`   | 异步、任务、外部服务、生产问题 |
| `git-history-expert`          | 回归问题、历史变更相关     |
| `data-integrity-expert`       | 数据错乱、状态不一致      |
| `frontend-async-race-expert`  | 前端状态/竞态/重复提交    |
| `security-code-review-expert` | 安全相关 bug        |
| `framework-docs-expert`       | 框架行为不确定         |

### 输出增强

```text
debug-report.md
  - symptom
  - reproduction
  - suspected root cause
  - evidence
  - changed files
  - fix options
  - selected fix
  - regression tests
```

---

## 8.7 `spec-code-review`

### 目标

对代码变更做结构化、多专家、证据驱动的审查。

### 默认 P0 agents

```text
correctness-review-expert
testing-review-expert
maintainability-review-expert
simplicity-expert
project-standards-expert
```

### 条件 agents

| Agent                             | 触发条件                                              |
| --------------------------------- | ------------------------------------------------- |
| `security-code-review-expert`     | auth、permission、file、command、API、external input   |
| `api-contract-expert`             | API/schema/DTO/SDK/openapi/rpc                    |
| `data-integrity-expert`           | DB/migration/ETL/data repair                      |
| `migration-safety-expert`         | migration files                                   |
| `performance-review-expert`       | loops/query/cache/render/concurrency              |
| `reliability-review-expert`       | jobs/retry/queue/network/IO                       |
| `typescript-expert`               | `.ts` / `.tsx`                                    |
| `python-expert`                   | `.py`                                             |
| `ios-mobile-review-expert`        | Swift/iOS/KMP mobile                              |
| `frontend-async-race-expert`      | frontend async/UI state                           |
| `adversarial-code-review-expert`  | high risk / release blocking                      |
| `generated-artifact-drift-expert` | generated schema / lockfile / generated API files |
| `previous-comments-reviewer`      | PR review context available                       |

### 输出增强

```text
code-review.md
  - executive summary
  - blocking issues
  - non-blocking issues
  - test gaps
  - architecture concerns
  - security concerns
  - standards violations
  - overengineering signals
  - agent findings
  - final verdict
```

---

## 8.8 `spec-app-consistency-audit`

### 目标

审查 PRD、Figma、本地源码、路由、组件、架构、埋点、i18n、行业规则之间的一致性。

### 集成 agents

| Agent                          | 触发条件                         |
| ------------------------------ | ---------------------------- |
| `product-lens-expert`          | 默认启用                         |
| `spec-flow-expert`             | 默认启用                         |
| `design-lens-expert`           | 有设计/交互要求                     |
| `design-implementation-expert` | 有 Figma context 或截图 evidence |
| `ios-mobile-review-expert`     | iOS/Swift/KMP                |
| `frontend-async-race-expert`   | H5/admin/front-end           |
| `api-contract-expert`          | 多端接口依赖                       |
| `analytics-expert`             | 埋点变更                         |
| `i18n-expert`                  | 国际化、多语言                      |
| `industry-rule-expert`         | 金融/行情/交易/合规等行业约束             |

其中 `analytics-expert`、`i18n-expert`、`industry-rule-expert` 不一定来自 ECC，但应作为 spec-first app audit 自有专家补齐。

### 输出增强

```text
.spec-first/app-audit/runs/<run-id>/
  - evidence-manifest.json
  - route-map.json
  - prd-coverage.md
  - design-coverage.md
  - source-coverage.md
  - architecture-coverage.md
  - analytics-coverage.md
  - i18n-coverage.md
  - final-report.md
```

---

## 8.9 `spec-compound`

### 目标

把工作完成后的稳定经验沉淀为可复用知识。

### 集成 agents

| Agent                         | 触发条件                   |
| ----------------------------- | ---------------------- |
| `knowledge-reuse-expert`      | 默认启用                   |
| `pattern-recognition-expert`  | 多次出现相同模式/反模式           |
| `git-history-expert`          | 需要记录演化原因               |
| `project-standards-expert`    | 发现可沉淀为项目标准             |
| `readme-style-profile-ankane` | 仅 Ruby gem README 场景可选 |

### 输出增强

```text
compound-learning.md
  - problem
  - decision
  - implementation pattern
  - reusable checklist
  - anti-pattern
  - linked specs/plans/reviews
  - standard candidates
```

---

## 8.10 `spec-skill-audit`

### 目标

审查 spec-first 自身 skill / agent / runtime delivery / governance 是否高质量。

### 集成 agents

| Agent                        | 触发条件                      |
| ---------------------------- | ------------------------- |
| `agent-native-design-expert` | 默认启用                      |
| `project-standards-expert`   | 默认启用                      |
| `coherence-expert`           | 默认启用                      |
| `simplicity-expert`          | 默认启用                      |
| `security-deep-audit-expert` | 涉及脚本、安装、shell、文件写入        |
| `cli-readiness-expert`       | spec-first CLI/runtime 改动 |
| `pattern-recognition-expert` | 审查 skill/agent 模式复用       |

### 输出增强

```text
skill-audit-report.md
  - source skill quality
  - runtime delivery drift
  - prompt boundary issues
  - agent routing issues
  - security issues
  - duplicated logic
  - overengineering
  - recommended patches
```

---

# 9. Agent Router 设计

## 9.1 路由输入

```json
{
  "workflow": "spec-code-review",
  "spec_id": "2026-05-04-001",
  "stage": "code_review",
  "changed_files": [],
  "diff_summary": {},
  "graph_facts": {},
  "repo_profile": {},
  "team_standards": {},
  "risk_signals": [],
  "available_capabilities": {},
  "user_request": "",
  "artifact_paths": {}
}
```

## 9.2 路由输出

```json
{
  "schema_version": "spec-first.agent-routing.v1",
  "workflow": "spec-code-review",
  "selected_agents": [
    {
      "agent": "correctness-review-expert",
      "priority": "P0",
      "reason": "default_code_review_core",
      "evidence_budget": "medium",
      "required_inputs": ["diff", "changed_files", "plan"]
    },
    {
      "agent": "api-contract-expert",
      "priority": "P0",
      "reason": "api_schema_changed",
      "evidence_budget": "high",
      "required_inputs": ["diff", "api_files", "graph_callers"]
    }
  ],
  "skipped_agents": [
    {
      "agent": "ios-mobile-review-expert",
      "reason": "no_ios_or_mobile_files_changed"
    }
  ],
  "warnings": []
}
```

## 9.3 路由规则

### Stage-based routing

| Stage       | 默认专家                                                     |
| ----------- | -------------------------------------------------------- |
| brainstorm  | product、scope、flow                                       |
| doc-review  | coherence、feasibility、scope、adversarial                  |
| plan        | architecture、repo research、feasibility、simplicity        |
| write-tasks | coherence、testing、architecture                           |
| work        | minimal agents，按需                                        |
| debug       | correctness、reliability、history                          |
| code-review | correctness、testing、maintainability、simplicity、standards |
| app audit   | product、flow、design、app/mobile                           |
| compound    | knowledge、pattern、standards                              |
| skill-audit | agent-native、coherence、simplicity、standards              |

### File-based routing

| 文件/路径信号                                            | 触发 agent                                           |
| -------------------------------------------------- | -------------------------------------------------- |
| `*.ts`, `*.tsx`                                    | `typescript-expert`                                |
| `*.py`                                             | `python-expert`                                    |
| `*.swift`, `ios/`, `xcodeproj`                     | `ios-mobile-review-expert`                         |
| `migration`, `schema`, `prisma`, `sql`             | `data-integrity-expert`, `migration-safety-expert` |
| `openapi`, `swagger`, `proto`, `dto`, `api`        | `api-contract-expert`                              |
| `auth`, `permission`, `token`, `session`, `crypto` | `security-code-review-expert`                      |
| `queue`, `job`, `retry`, `worker`                  | `reliability-review-expert`                        |
| `i18n`, `locale`, `translations`                   | `i18n-expert`                                      |
| `analytics`, `track`, `event`                      | `analytics-expert`                                 |
| `CLAUDE.md`, `AGENTS.md`, `repo-profile.yaml`      | `project-standards-expert`                         |
| `skills/**/SKILL.md`, `agents/**`                  | `agent-native-design-expert`, `skill-audit`        |

### Risk-based routing

| 风险信号               | 触发 agent                                                                      |
| ------------------ | ----------------------------------------------------------------------------- |
| 多端协作               | `api-contract-expert`, `spec-flow-expert`                                     |
| 多团队交付              | `scope-guardian-expert`, `coherence-expert`                                   |
| 生产数据变更             | `data-integrity-expert`, `deployment-readiness-expert`                        |
| 大规模重构              | `architecture-expert`, `git-history-expert`, `adversarial-code-review-expert` |
| 新技术栈               | `framework-docs-expert`, `best-practices-research-expert`                     |
| 用户明确要求深度审查         | 增加 adversarial / security deep / performance                                  |
| graph readiness 不足 | 启用 degraded mode，并标注 confidence                                               |

---

# 10. Agent 输出协议

## 10.1 统一 findings schema

```json
{
  "schema_version": "spec-first.agent-finding.v1",
  "agent": "correctness-review-expert",
  "workflow": "spec-code-review",
  "finding_id": "CR-001",
  "severity": "blocker",
  "confidence": "high",
  "category": "correctness",
  "title": "Retry state may be persisted before transaction commit",
  "evidence": [
    {
      "type": "file",
      "path": "src/jobs/retry.ts",
      "lines": "42-67"
    },
    {
      "type": "plan",
      "path": "docs/specs/.../plan.md",
      "section": "Retry design"
    }
  ],
  "impact": "May create duplicate retries after process crash",
  "recommendation": "Persist retry state inside the same transaction or make retry operation idempotent",
  "suggested_tests": [
    "simulate crash between state write and transaction commit"
  ],
  "requires_human_decision": false
}
```

## 10.2 Severity

| 级别        | 定义                    |
| --------- | --------------------- |
| `blocker` | 必须修复，否则不能进入下一阶段       |
| `high`    | 强烈建议修复，存在明显质量/安全/交付风险 |
| `medium`  | 应修复，但不阻断              |
| `low`     | 可选优化                  |
| `note`    | 观察项，不要求动作             |

## 10.3 Confidence

| 置信度       | 定义                      |
| --------- | ----------------------- |
| `high`    | 有明确代码/文档/graph evidence |
| `medium`  | 有间接证据，需要人工确认            |
| `low`     | 推测性建议，只能作为提示            |
| `unknown` | 输入不足，必须披露 degraded mode |

---

# 11. Skill Synthesis 规则

Agent 输出不能直接等于最终结论。Skill synthesis 必须做四件事：

## 11.1 合并

把多个 agent 指向同一问题的 findings 合并。

```text
security-code-review-expert:
  API 缺少鉴权

api-contract-expert:
  新接口没有声明 permission contract

project-standards-expert:
  违反 repo API governance

Synthesis:
  合并为一个 blocker：新增 API 缺少权限合约与实现
```

## 11.2 去噪

删除：

```text
无证据的泛泛建议
和当前 diff 无关的建议
重复建议
和 repo standards 冲突的建议
agent 自己越界提出的流程修改
```

## 11.3 定级

最终 severity 由 Skill 决定，不由单个 agent 决定。

```text
如果 security agent 说 high
但 evidence 不足
Skill 可以降为 medium + needs confirmation

如果 correctness + testing + reliability 同时指向同一问题
Skill 可以升为 blocker
```

## 11.4 裁判

当 agent 意见冲突时：

```text
repo confirmed standards > explicit user request > code facts > graph facts > README/manifest > agent opinion
```

---

# 12. 产物目录设计

## 12.1 Runtime/control-plane 产物

```text
.spec-first/
  agent-routing/
    runs/
      <run-id>/
        routing-input.json
        routing-decision.json
        agent-findings.jsonl
        synthesis-report.json
        evidence-manifest.json

  app-audit/
    runs/
      <run-id>/
        evidence-manifest.json
        final-report.md

  review/
    runs/
      <run-id>/
        code-review.md
        agent-findings.jsonl
        routing-decision.json

  standards/
    previews/
      <preview-id>/
        standards-preview.md
        proposed-repo-profile.patch.yaml
```

这些默认不作为长期手工维护文档，除非用户或团队治理明确要求提交。

## 12.2 Durable docs 产物

```text
docs/
  specs/
    <spec-id>/
      Brainstorm.md
      Design.md
      Plan.md
      Tasks.md
      Review.md
      Compound.md
```

## 12.3 Source assets

```text
docs/10-prompt/
  agents/
    correctness-review-expert.md
    scope-guardian-expert.md
    architecture-expert.md
    ...

  agent-packs/
    engineering-quality-pack.md
    product-scope-pack.md
    app-review-pack.md
    skill-audit-pack.md

  routing/
    agent-routing-policy.md
    risk-signals.md
    synthesis-policy.md
```

## 12.4 Config

```text
.spec-first/config/
  agent-registry.json
  agent-routing-policy.json
  team-standards-sources.json
  runtime-capabilities.json
```

## 12.5 Confirmed standards

```text
.spec-first/specs/
  repo-profile.yaml
```

只写入确认后的稳定规范，不写 runtime 状态。

---

# 13. Agent Registry 设计

## 13.1 Registry schema

```json
{
  "schema_version": "spec-first.agent-registry.v1",
  "agents": [
    {
      "id": "scope-guardian-expert",
      "display_name": "Scope Guardian Expert",
      "origin": {
        "source": "ecc-inspired",
        "ecc_agent": "ce-scope-guardian-reviewer"
      },
      "category": "document_review",
      "default_priority": "P0",
      "allowed_workflows": [
        "spec-brainstorm",
        "spec-doc-review",
        "spec-plan"
      ],
      "trigger_signals": [
        "large_scope",
        "multi_team",
        "premature_abstraction",
        "unclear_requirement_boundary"
      ],
      "required_inputs": [
        "user_request",
        "current_doc",
        "repo_profile"
      ],
      "forbidden_actions": [
        "write_files",
        "change_workflow_state",
        "modify_repo_profile"
      ],
      "output_schema": "spec-first.agent-finding.v1"
    }
  ]
}
```

## 13.2 Agent metadata

每个 agent 必须声明：

```text
id
origin
category
capability
allowed workflows
trigger signals
required inputs
optional inputs
output schema
forbidden actions
confidence rules
token budget
degraded mode behavior
```

---

# 14. Standards 与团队规范仓库集成

你之前提到团队规范希望设计成单独 Git 仓库，各端开发按标准目录结构录入。这部分应成为终态能力，而不是后补功能。

## 14.1 标准来源优先级

```text
1. 用户本次明确指令
2. 项目 repo-profile.yaml confirmed fields
3. 团队规范仓库 pinned standards
4. 项目内 docs / README / AGENTS.md / CLAUDE.md
5. CRG / GitNexus / graph observed evidence
6. manifest/config inferred facts
7. agent suggestions
```

## 14.2 团队规范仓库建议结构

```text
team-standards/
  README.md

  global/
    engineering-principles.md
    code-review-policy.md
    changelog-policy.md
    security-baseline.md

  frontend/
    architecture.md
    api-contract.md
    component.md
    i18n.md
    analytics.md

  mobile/
    app-architecture.md
    kmp.md
    ios.md
    android.md
    analytics.md

  backend/
    api.md
    database.md
    migration.md
    reliability.md
    observability.md

  ai-coding/
    claude.md
    codex.md
    agents.md
    prompt-style.md

  index.yaml
```

## 14.3 `index.yaml`

```yaml
schema_version: team-standards-index.v1
standards:
  - id: global.changelog
    title: Changelog Governance
    path: global/changelog-policy.md
    applies_to:
      workflows:
        - spec-work
        - spec-code-review
      file_patterns:
        - "src/**"
        - "packages/**"
    severity: blocker

  - id: backend.database-migration
    title: Database Migration Safety
    path: backend/migration.md
    applies_to:
      file_patterns:
        - "**/migrations/**"
        - "**/*.sql"
    agents:
      - data-integrity-expert
      - migration-safety-expert
```

## 14.4 spec-first 项目绑定配置

```yaml
schema_version: spec-first.team-standards-source.v1
sources:
  - id: company-engineering-standards
    type: git
    repo: "git@github.com:company/team-standards.git"
    ref: "main"
    path: "."
    pinned_commit: "<commit>"
    enabled: true
```

## 14.5 使用方式

```text
/spec:standards import <team-standards-repo>
/spec:standards preview
/spec:standards apply
```

终态上可以新增 `spec-standards`，但它不应是硬规则引擎，而是 standards ingestion + preview + confirmed writeback 工具。

---

# 15. 多端、多团队、大需求场景

## 15.1 单 spec_id，多团队任务包

对于一个大需求涉及 App、H5、Admin、中台、行情组、后端多个团队时，不建议默认拆成多个 spec_id。

推荐终态：

```text
一个业务需求 = 一个 spec_id
多个团队交付 = 多个 workstream
每个 workstream 有自己的 tasks、owners、contracts、verification
```

目录：

```text
docs/specs/2026-05-04-001-market-feature/
  Brainstorm.md
  PRD.normalized.md
  Design.md
  Plan.md
  Tasks.md

  workstreams/
    app/
      Tasks.md
      Review.md
    h5/
      Tasks.md
      Review.md
    admin/
      Tasks.md
      Review.md
    backend-core/
      Tasks.md
      Review.md
    backend-market/
      Tasks.md
      Review.md

  contracts/
    api-contract.md
    event-contract.md
    analytics-contract.md
    release-contract.md
```

## 15.2 多团队 agent 路由

| 场景           | 必选 agents                                                     |
| ------------ | ------------------------------------------------------------- |
| 多端需求拆分       | `spec-flow-expert`, `api-contract-expert`, `coherence-expert` |
| 后端接口影响前端/App | `api-contract-expert`, `product-lens-expert`                  |
| 多团队任务拆分      | `scope-guardian-expert`, `architecture-expert`                |
| 埋点/数据看板      | `analytics-expert`, `api-contract-expert`                     |
| i18n         | `i18n-expert`, `design-lens-expert`                           |
| 发版风险         | `deployment-readiness-expert`, `reliability-review-expert`    |

---

# 16. 三种仓库模式支持

spec-first 当前用户手册已经明确支持单仓单项目、单仓多模块、多仓工作区三种模式，并说明 `.spec-first` 的权威事实属于 selected Git repo root；多仓工作区父目录只拥有 advisory workspace summaries，不拥有 child repo 的 canonical artifacts。([GitHub][2])

## 16.1 单仓单项目

```text
repo/
  .spec-first/
  src/
  docs/
```

agent router 使用当前 repo 的 graph facts、standards、diff。

## 16.2 单仓多模块

```text
repo/
  .spec-first/
  apps/app/
  apps/admin/
  packages/core/
  services/api/
```

不在每个 module 下创建独立 `.spec-first`。router 通过 module map 判断影响范围。

## 16.3 多仓工作区

```text
workspace/
  app-repo/
    .spec-first/
  h5-repo/
    .spec-first/
  backend-repo/
    .spec-first/
  workspace-summary/
```

父目录只做 advisory，不写 child repo canonical facts。

---

# 17. Token 成本控制方案

这是终态成败关键。

## 17.1 不允许全量注入

禁止：

```text
每次 review 注入所有 agent prompt
每次 plan 注入所有 standards
每次 work 注入所有 graph facts
每次 app audit 注入完整 Figma JSON
```

## 17.2 分级上下文预算

| Budget   | 使用场景       | 输入                                                   |
| -------- | ---------- | ---------------------------------------------------- |
| `tiny`   | 快速分类       | file paths、diff stats、stage                          |
| `small`  | 默认 agent   | relevant diff、current doc section、standards snippets |
| `medium` | P0 深审      | relevant files、graph neighbors、plan section          |
| `high`   | 高风险专项      | full related context、history、tests、contracts         |
| `manual` | 用户明确要求全量深审 | 由 skill 明确提示成本和范围                                    |

## 17.3 两阶段路由

```text
Stage 1: Cheap Router
  只读 changed files / diff stats / stage / explicit user request
  输出 candidate agents

Stage 2: Evidence Builder
  只为 selected agents 准备上下文
  每个 agent 拿最小必要证据
```

## 17.4 Agent 并发限制

| 阶段          | 默认最大 agent 数 |
| ----------- | -----------: |
| brainstorm  |            3 |
| doc-review  |            4 |
| plan        |            5 |
| write-tasks |            4 |
| work        |            2 |
| debug       |            4 |
| code-review |            5 |
| app audit   |            6 |
| skill-audit |            5 |

超过上限时，Skill synthesis 必须合并相似专家或降级为 checklist mode。

---

# 18. 安全与治理

## 18.1 Agent 禁止行为

所有 agent 默认禁止：

```text
直接写文件
直接提交代码
直接修改 repo-profile.yaml
直接修改 AGENTS.md / CLAUDE.md
直接安装依赖
直接执行 destructive command
直接改变 workflow state
```

## 18.2 高风险动作必须由 Skill 执行

```text
write files
apply patch
run install
run migration
commit
push
create PR
write standards
clean runtime assets
```

## 18.3 安全审查触发

只要出现以下信号，必须启用 security 相关 agent：

```text
auth
permission
token
session
cookie
crypto
webhook
payment
file upload/download
shell command
eval
external API
user generated input
PII
```

---

# 19. 版本路线图：从 MVP 到终局

下面是完整终态规划，不只是 MVP。

---

## V0：方案冻结与资产盘点

### 目标

确认 spec-first 当前 skill/agent/runtime 资产，冻结集成边界。

### 工作内容

| 任务                     | 输出                           |
| ---------------------- | ---------------------------- |
| 盘点现有 spec-first agents | `current-agent-inventory.md` |
| 盘点 ECC agents          | `ecc-agent-inventory.md`     |
| 做重复能力矩阵                | `agent-overlap-matrix.md`    |
| 定义命名规范                 | `agent-naming-policy.md`     |
| 定义禁止行为                 | `agent-boundaries.md`        |

### 验收标准

```text
所有 agent 都有分类
所有 P0/P1/P2/P3 都有明确归属
没有直接复制 ECC skill 的设计
```

---

## V1：P0 Agent Pack 集成

### 目标

先把最有价值、最通用、最不依赖外部工具的 agent 能力集成进 spec-first。

### 范围

```text
Product & Scope Pack
Document Quality Pack
Engineering Quality Pack
Architecture & Contract Pack
Governance Pack
```

### 进入 skills

```text
spec-brainstorm
spec-doc-review
spec-plan
spec-write-tasks
spec-code-review
spec-skill-audit
```

### 关键任务

| 任务                   | 说明                                               |
| -------------------- | ------------------------------------------------ |
| 新增 P0 agent docs     | 不复制 ECC 原文，重写成 spec-first 风格                     |
| 新增 routing policy v1 | 基于 workflow + file path + risk signal            |
| 新增 finding schema v1 | 所有 agent 输出统一结构                                  |
| 更新 code-review skill | 引入 P0 engineering reviewers                      |
| 更新 doc-review skill  | 引入 coherence / feasibility / scope / adversarial |
| 更新 plan skill        | 引入 architecture / contract / simplicity          |
| 更新 skill-audit       | 引入 agent-native / standards / simplicity         |

### 验收标准

```text
code-review 不再是单一泛审
doc-review 能审出范围漂移、术语矛盾、可行性问题
plan 能明确说明用了哪些专家判断
每次 agent 调用都有 reason
没有明显 token 暴涨
```

---

## V2：Graph-aware Agent Routing

### 目标

让 agent 不只看文本，而是消费 graph readiness 和 code facts。

### 范围

```text
repo-research-expert
architecture-expert
api-contract-expert
testing-review-expert
reuse-candidates
impact capabilities
```

### 关键任务

| 任务                                    | 说明                        |
| ------------------------------------- | ------------------------- |
| 接入 graph-facts.json                   | plan/review/task 使用       |
| 接入 bootstrap-impact-capabilities.json | 判断能否做影响分析                 |
| 接入 reuse-candidates.json              | plan/tasks 推荐复用模块         |
| 接入 architecture-facts.json            | architecture expert 使用    |
| 增加 graph degraded mode                | graph 缺失不失败，标注 confidence |
| 增加 evidence manifest                  | 每次审查记录用了哪些证据              |

### 验收标准

```text
architecture 建议有 graph evidence
code-review 能说明影响面
write-tasks 能推荐复用模块
graph 不可用时不会假装可用
```

---

## V3：P1 条件专家包

### 目标

接入技术栈、领域、高风险专项专家。

### 范围

```text
Security Deep Pack
Performance Pack
Data Pack
Frontend/App Pack
Language Pack
Research Pack
```

### 关键任务

| 任务                         | 说明                                        |
| -------------------------- | ----------------------------------------- |
| 增加 file-pattern routing    | TS/Python/iOS/migration/API               |
| 增加 risk-signal routing     | security/data/performance/reliability     |
| 增强 app-consistency-audit   | 引入 design/iOS/frontend/API/analytics/i18n |
| 增强 debug                   | 引入 reliability/history/data/frontend race |
| 增强 optimize                | 引入 performance oracle                     |
| 增强 framework docs research | 新技术栈按需触发                                  |

### 验收标准

```text
TS/Python/iOS 项目能自动启用对应专家
migration 变更能触发 data/migration 专家
App 审查能覆盖产品/设计/代码/路由/埋点/i18n
性能专家只在相关风险出现时启用
```

---

## V4：团队规范仓库与 Standards Ingestion

### 目标

支持团队共享规范，并在 spec-first workflow 中被 agent 消费。

### 范围

```text
team standards git repo
repo-profile confirmed fields
standards preview
standards apply
project-standards-expert
```

### 关键任务

| 任务                             | 说明                             |
| ------------------------------ | ------------------------------ |
| 新增 `spec-standards`            | import / preview / apply       |
| 支持团队规范仓库 index.yaml            | 按端、领域、workflow、file pattern 绑定 |
| 支持 pinned commit               | 保证团队规范版本稳定                     |
| 更新 project-standards-expert    | 审查是否违反团队规范                     |
| 更新 code-review/doc-review/plan | 消费 standards snippets          |
| preview-first 写 repo-profile   | 只写确认后的最小字段                     |

### 验收标准

```text
能导入团队规范仓库
能预览会影响哪些 workflow / agents
能把确认后的规则写入 repo-profile
code-review 能引用团队规范
不把规范仓库全文塞进上下文
```

---

## V5：多端大需求与 Workstream Orchestration

### 目标

支持一个需求涉及 App、H5、Admin、多个后端团队的真实公司研发场景。

### 范围

```text
single spec_id
multiple workstreams
contracts
team task packs
cross-team review
```

### 关键任务

| 任务               | 说明                                   |
| ---------------- | ------------------------------------ |
| 扩展 brainstorm    | 识别业务域、系统域、团队域                        |
| 扩展 plan          | 输出 workstreams                       |
| 扩展 write-tasks   | 每个团队生成 task pack                     |
| 新增 contract docs | API/event/analytics/release contract |
| 扩展 app audit     | 多端一致性                                |
| 扩展 code-review   | 每个 workstream 独立审查 + 全局合并            |

### 验收标准

```text
一个 spec_id 能承载多端需求
每个团队有独立任务包
跨团队接口和埋点有 contract
最终 review 能合并为全局质量结论
```

---

## V6：PR / CI / Release 集成

### 目标

让 spec-first 支持真实开发闭环中的 PR feedback、CI、release readiness。

### 范围

```text
PR comments
CI results
test reports
release checklist
commit/push/pr
```

### 关键任务

| 任务                          | 说明                                         |
| --------------------------- | ------------------------------------------ |
| 接入 PR comments              | previous-comments / pr-feedback-resolution |
| 接入 CI artifacts             | failed tests / lint / build                |
| 增加 release readiness report | deployment-readiness-expert                |
| 增强 commit/push/pr           | PR 描述引用 spec/plan/tasks/review             |
| 增强 compound                 | PR 完成后沉淀知识                                 |

### 验收标准

```text
PR 评论不会丢
CI 失败能进入 debug/review
release 前能输出 Go/No-Go
PR 描述能追踪 spec/plan/review
```

---

## V7：跨工具与多宿主终态

### 目标

让 spec-first 的 agent architecture 同时支持 Claude Code、Codex、Cursor 等宿主。

ECC 文档中提到 Skills 遵循开放 SKILL.md 标准，skill 文件夹可包含 `SKILL.md`、`scripts/`、`references/`、`assets/`，启动时只加载 name/description，调用时再注入完整内容；这个模型非常适合 spec-first 做低 token 的能力声明和按需注入。([GitHub][5])

### 范围

```text
Claude
Codex
Cursor
future hosts
```

### 关键任务

| 任务                        | 说明                                  |
| ------------------------- | ----------------------------------- |
| 抽象 host delivery          | 不把 agent 写死到 Claude/Codex           |
| 统一 source asset           | 一份 agent source，多宿主投递               |
| host capability detection | 判断是否支持 subagent / skill / MCP       |
| fallback mode             | 宿主不支持 subagent 时转成 inline checklist |
| runtime drift audit       | skill-audit 检查投递资产漂移                |

### 验收标准

```text
同一套专家能力能投递到不同宿主
宿主能力不足时能降级
不会因为某宿主缺 subagent 而阻断主流程
```

---

## V8：终局形态：Agent Governance Platform for AI Engineering

### 目标

spec-first 成为 workflow-first AI engineering harness，而不是单项目 prompt 包。

### 终态能力

```text
1. 支持完整工程闭环
2. 支持 graph-aware evidence
3. 支持团队规范仓库
4. 支持多端、多团队、大需求
5. 支持动态专家路由
6. 支持 PR / CI / Release
7. 支持知识沉淀和复用
8. 支持 skill/agent 自审和演化
9. 支持多宿主 runtime delivery
10. 支持外部 agent framework 能力吸收
```

### 终态口号

```text
Spec-first turns AI coding agents into a governed engineering system.

Skill owns the workflow.
Agent owns the expert judgment.
Graph owns the evidence.
Standards own the boundary.
Synthesis owns the final decision.
Knowledge owns the compounding.
```

---

# 20. 开发任务拆分

## Phase 1：文档与协议

```text
docs/2026-05-04-ecc-agent-integration-final/
  TECHNICAL_PLAN.md
  AGENT_MAPPING.md
  ROUTING_POLICY.md
  FINDINGS_SCHEMA.md
  SYNTHESIS_POLICY.md
  VERSION_ROADMAP.md
```

## Phase 2：Agent Registry

```text
src/
  agent-registry/
    registry.ts
    schema.ts
    ecc-mapping.ts
    validate.ts
```

或如果项目当前不适合新增 src 结构，则先放入 runtime asset generator 对应位置。

## Phase 3：P0 Agents

```text
docs/10-prompt/agents/
  product-lens-expert.md
  scope-guardian-expert.md
  spec-flow-expert.md
  coherence-expert.md
  feasibility-expert.md
  adversarial-doc-review-expert.md
  correctness-review-expert.md
  testing-review-expert.md
  maintainability-review-expert.md
  simplicity-expert.md
  architecture-expert.md
  api-contract-expert.md
  project-standards-expert.md
```

## Phase 4：Router

```text
routing/
  workflow-router.ts
  file-signal-router.ts
  risk-signal-router.ts
  budget-policy.ts
  degraded-mode.ts
```

## Phase 5：Skill 改造

优先顺序：

```text
1. spec-code-review
2. spec-doc-review
3. spec-plan
4. spec-write-tasks
5. spec-brainstorm
6. spec-skill-audit
7. spec-app-consistency-audit
8. spec-compound
```

## Phase 6：Standards

```text
spec-standards/
  import
  preview
  apply
  validate
```

## Phase 7：多端 workstream

```text
workstream planner
contract generator
cross-team task pack
multi-workstream review synthesis
```

---

# 21. 测试策略

## 21.1 单元测试

| 对象                  | 测试点                                     |
| ------------------- | --------------------------------------- |
| agent registry      | schema 校验、重复 id、非法 workflow             |
| router              | file signals、risk signals、stage signals |
| budget policy       | agent 数量上限、token budget                 |
| synthesis           | findings 合并、去重、定级                       |
| standards ingestion | index.yaml 解析、匹配规则                      |

## 21.2 Golden tests

构造固定场景：

```text
TS API breaking change
Python data migration
iOS UI state issue
multi-team PRD
large refactor
security-sensitive diff
skill-audit on bad SKILL.md
```

每个场景断言：

```text
selected agents 正确
skipped agents 合理
findings schema 合法
final report 有 evidence
degraded mode 正确披露
```

## 21.3 E2E 测试

```text
spec-brainstorm → spec-doc-review → spec-plan → spec-write-tasks → spec-work → spec-code-review → spec-compound
```

检查：

```text
产物是否完整
agent routing 是否可追踪
review 是否引用 plan/tasks
compound 是否沉淀最终经验
```

---

# 22. 风险矩阵

| 风险        | 表现                           | 解决方案                                      |
| --------- | ---------------------------- | ----------------------------------------- |
| token 暴涨  | 每次调用太多 agent                 | 两阶段路由、agent 上限、budget policy              |
| agent 噪音  | 输出重复、泛泛建议                    | synthesis 去重、证据要求、confidence              |
| 架构污染      | ECC 命名/skill 反向主导 spec-first | 重命名为 spec-first expert，保留 origin metadata |
| 规则过硬      | 变成 hard gate engine          | 保持 preview-first，Skill synthesis 裁判       |
| 外部工具依赖    | Figma/Slack/PR 不可用导致失败       | optional capability + degraded mode       |
| 标准冲突      | 团队规范与项目规范不一致                 | 优先级规则 + conflict report                   |
| graph 不可用 | agent 假装知道影响面                | graph readiness 检查 + confidence 降级        |
| 多端过度拆分    | 一个需求拆成多个 spec_id 导致割裂        | 单 spec_id + 多 workstream                  |
| agent 越权  | agent 直接写文件或状态               | forbidden actions + skill-only write      |
| 宿主差异      | Claude/Codex/Cursor 支持能力不同   | host capability detection + fallback mode |

---

# 23. 终态验收标准

## 23.1 能力验收

```text
P0 agents 全部可被对应 skill 调用
P1 agents 能基于风险和文件信号条件触发
每次 agent 调用都有 reason
每次 agent 输出符合 finding schema
每次 final report 都有 synthesis summary
```

## 23.2 质量验收

```text
code-review 能发现 correctness/testing/security/maintainability/simplicity 问题
doc-review 能发现 coherence/scope/feasibility 问题
plan 能引用 graph facts 和 repo standards
app audit 能覆盖 PRD/Figma/source/route/analytics/i18n
skill-audit 能审查 skill/agent/runtime drift
```

## 23.3 成本验收

```text
默认 code-review agent 数 <= 5
默认 plan agent 数 <= 5
默认 brainstorm agent 数 <= 3
graph facts 只注入相关片段
standards 只注入匹配片段
外部 research 不默认触发
```

## 23.4 团队协作验收

```text
支持团队规范仓库导入
支持单 spec_id 多 workstream
支持 API/event/analytics/release contracts
支持 PR feedback 与 review 追踪
支持 compound 知识沉淀
```

---

# 24. 最终推荐实施顺序

最稳的顺序是：

```text
1. 先做 Agent Registry + P0 agent docs
2. 再改 spec-code-review
3. 再改 spec-doc-review
4. 再改 spec-plan
5. 再接 graph-aware routing
6. 再接 app-consistency-audit 专项 agents
7. 再做 standards repo ingestion
8. 再做多端 workstream
9. 最后做 PR/CI/release 和多宿主终态
```

不要先做：

```text
全量 ECC agent 导入
新建一堆 /spec:* agent 命令
复杂 UI
团队规范仓库同步器
自动 PR resolver
```

这些都会把 MVP 拉爆，而且会破坏 spec-first 当前最核心的 workflow-first 结构。

---

# 25. 最终技术判断

ECC 对 spec-first 最有价值的不是它的命令，而是它的 **expert decomposition**：

```text
一个优秀工程师不是一个全能脑袋，
而是一组可被调度的专家判断。
```

spec-first 对 ECC 能力的正确吸收方式是：

```text
ECC Agent 思想
  → spec-first Expert/Lens
  → Agent Registry
  → Evidence-aware Router
  → Skill Synthesis
  → Durable Engineering Artifacts
  → Compound Knowledge
```

最终形态：

```text
spec-first 不成为 ECC 的二次封装。
spec-first 成为可以吸收 ECC、Compound、Superpowers、Kiro、Cursor、Claude/Codex 等优秀实践的 AI Engineering Harness。
```

真正的终局不是：

```text
更多 agent
```

而是：

```text
正确的阶段
正确的证据
正确的专家
正确的产物
正确的裁判
正确的知识沉淀
```

这和 spec-first 的核心定位完全一致：

```text
AI coding is not a prompt problem — it is a workflow problem.

Spec > Code.
Systems > Prompts.
```

[1]: https://github.com/EveryInc/compound-engineering-plugin "GitHub - EveryInc/compound-engineering-plugin: Official Compound Engineering plugin for Claude Code, Codex, Cursor, and more · GitHub"
[2]: https://github.com/sunrain520/spec-first/blob/master/docs/05-%E7%94%A8%E6%88%B7%E6%89%8B%E5%86%8C/README.md "spec-first/docs/05-用户手册/README.md at master · sunrain520/spec-first · GitHub"
[3]: https://github.com/EveryInc/compound-engineering-plugin/blob/main/plugins/compound-engineering/README.md "compound-engineering-plugin/plugins/compound-engineering/README.md at main · EveryInc/compound-engineering-plugin · GitHub"
[4]: https://github.com/sunrain520/spec-first "GitHub - sunrain520/spec-first: spec-first · GitHub"
[5]: https://github.com/EveryInc/compound-engineering-plugin/blob/main/docs/specs/cursor.md "compound-engineering-plugin/docs/specs/cursor.md at main · EveryInc/compound-engineering-plugin · GitHub"
