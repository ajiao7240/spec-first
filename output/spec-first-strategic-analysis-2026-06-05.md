# spec-first 战略分析报告：定位、竞品与下一阶段路线图

> 报告日期：2026-06-05 | 数据截止：2026年6月初 | 版本：v1.0

---

## 一、项目能力全景

### 1.1 当前版本与规模

spec-first 当前版本为 **v1.10.0**，是一个以 npm 全局包形式分发的 CLI 工具，安装命令 `npm install -g spec-first`。项目以 Node.js（≥20.0.0）为运行时，CommonJS 模块系统，核心逻辑分布在约 60 个 JS 源文件中。

资产规模概览：

| 维度 | 数量 | 说明 |
|---|---|---|
| Skill 资产 | 40 个 | 20 workflow command + 2 standalone + 18 internal_only |
| Agent Profile | 51 个 | 覆盖代码审查、架构设计、安全、研究、领域专精、治理六类 |
| 工作流命令模板 | 20 个 | 位于 `templates/claude/commands/spec/` |
| 治理注册表 | 2 个 JSON | skills-governance.json（38条）+ agents-governance.json |
| CLI 源文件 | ~60 个 | `src/cli/` 下命令、适配器、契约、辅助模块 |
| 辅助脚本 | 16 个 | 测试调度、门禁、发布、技能入口校验等 |
| 测试体系 | unit/smoke/integration | ~40 单元测试 + 4 冒烟测试 + e2e |
| 已部署项目 | 9+ 个 | kaz-mvp、sdd-riper、Hr360、ai-engineering-standards 等 |

### 1.2 核心架构

spec-first 的架构遵循 **Source/Runtime 分离** 原则，可以概括为四层模型：

```
┌─────────────────────────────────────────┐
│  Layer 1: Source of Truth（作者维护）    │
│  skills/ + agents/ + templates/ + src/  │
├─────────────────────────────────────────┤
│  Layer 2: Governance（治理注册表）       │
│  skills-governance.json                 │
│  agents-governance.json                 │
├─────────────────────────────────────────┤
│  Layer 3: Adapter（平台适配器）          │
│  claude.js / codex.js                   │
├─────────────────────────────────────────┤
│  Layer 4: Runtime（可重建产物）          │
│  .claude/commands/ .claude/skills/      │
│  .codex/agents/ .agents/skills/         │
└─────────────────────────────────────────┘
```

- **Source of Truth**：`skills/`、`agents/`、`templates/`、`src/cli/` 为作者维护的唯一真相源。
- **Governance**：`skills-governance.json` 是治理中枢，定义每个 skill 的入口面（`entry_surface`）、命令名、宿主交付方式（`host_delivery`），实现 `workflow_command` / `standalone_skill` / `internal_only` 三级准入。
- **Adapter**：`claude.js` 和 `codex.js` 各自实现平台适配，Claude 侧合并 command template frontmatter + skill body 生成 `/spec:*` 命令，Codex 侧直接渲染为 `$spec-*` skill。
- **Runtime**：`.claude/` 和 `.codex/` 下的产物可随时通过 `spec-first init` 重建，禁止手动修改。

### 1.3 工作流全景

spec-first 定义了完整的软件开发生命周期工作流链：

```
ideate → brainstorm → prd → plan → write-tasks → work → code-review → compound
   ↑                                                  ↓            ↓
doc-review                                        debug      optimize
                                                  polish-beta
```

**20 个公开工作流命令**覆盖从创意发散到知识沉淀的完整链路：

| 阶段 | 命令 | 职责 |
|---|---|---|
| 创意 | `ideate` / `brainstorm` | 创意发散与需求头脑风暴 |
| 需求 | `prd` / `doc-review` | 存量系统 PRD / 文档审查 |
| 规划 | `plan` | 实施计划编写 |
| 执行 | `work` | 编码工作执行 |
| 审查 | `code-review` | 代码审查 |
| 调优 | `debug` / `optimize` / `polish-beta` | 故障调试 / 可度量优化 / UI 打磨 |
| 沉淀 | `compound` / `compound-refresh` | 知识沉淀与刷新 |
| 治理 | `skill-audit` / `app-consistency-audit` | 资产治理审计 |
| 运维 | `mcp-setup` / `update` / `release-notes` | 运行时配置 / 版本更新 |

**51 个 Agent Profile** 在这些工作流中被动态调度，形成多角色协作。典型如代码审查阶段可同时调度 `spec-correctness-reviewer`、`spec-testing-reviewer`、`spec-security-reviewer`、`spec-code-simplicity-reviewer` 四个维度并行审查。

### 1.4 技术栈与工具链

| 维度 | 选型 |
|---|---|
| 运行时 | Node.js ≥ 20.0.0 |
| 模块系统 | CommonJS |
| 包管理 | npm global install |
| 核心依赖 | `ignore`（gitignore 匹配）、`simple-git`（Git 操作） |
| 测试 | Jest（单元） + Shell 脚本（冒烟/集成） |
| 代码风格 | 2 空格缩进、单引号、分号 |
| 目标宿主 | Claude Code（`/spec:*`）+ Codex（`$spec-*`） |
| 操作系统 | macOS / Linux / Windows |

---

## 二、项目定位分析

### 2.1 spec-first 是什么

spec-first 是一个**双宿主（Claude Code + Codex）的 AI 编程工作流框架**。它提供了一套结构化的软件开发方法论，通过 40 个 skill、51 个 agent profile、20 个工单命令，将 AI 编程从"一句话 prompt 出代码"升级为"规范驱动、多阶段、可追溯、可审计"的工程化协作。

其核心方法论是 **Spec-Driven Development（SDD）**：以规范为中枢，通过 ideate → brainstorm → prd → plan → tasks → work → review → compound 的完整链路，确保 AI 编码不偏离用户意图。

spec-first 同时还是一个**知识管理系统**的雏形。通过 `spec-compound` skill 将项目经验沉淀为可复用知识，通过 `spec-graph-bootstrap` 从代码库自动提取结构化的项目上下文（Understanding / Rules / Patterns / Decisions / Risks），正在演进为"既管流程又管知识"的 Agent 交付系统。

### 2.2 spec-first 不是（边界声明）

1. **不是代码生成器**：spec-first 不生成代码，它生成的是 AI 编程助手的**行为指令**（Markdown-based skill + agent profile + command template）。实际编码由 Claude / Codex 等 AI 模型完成。
2. **不是 CI/CD 工具**：不替代 Jenkins、GitHub Actions 等持续集成系统。spec-first 关注的是"编码前的规范对齐"和"编码中的质量控制"，而非部署流水线。
3. **不是 IDE 插件**：它通过自定义命令（`/spec:*` 和 `$spec-*`）注入 AI 编程助手的命令空间，不侵入编辑器 UI 层。
4. **不是项目管理工具**：不替代 Jira、Linear 等。spec-first 的 tasks 是"AI 可执行的任务清单"，面向 Agent 而非面向人类项目经理。
5. **不是知识库产品**：当前知识管理仍是文档级方案（Markdown + Git），不提供知识图谱、语义检索等数据库级能力。

### 2.3 对标定位：spec-first 在生态中的坐标

在当前"规范驱动 AI 编程"赛道中，spec-first 的定位可以概括为：

> **"双宿主工作流引擎 + 知识管理系统雏形"** —— 在流程覆盖度和架构治理深度上领先，在社区生态和上手体验上待追赶。

相比于 Superpowers 的"全自动触发 + 子 Agent 驱动"、Spec-Kit 的"30+ 集成 + 91 社区扩展"、OpenSpec 的"极简提案—归档"闭环，spec-first 选择了一条不同的路径：**以治理注册表为中枢，以双宿主适配为差异化，以 51 个 Agent Profile 构建多维审查能力**。

---

## 三、竞品深度对比

### 3.1 Superpowers（184k Stars）

#### 项目概述

Superpowers 由 Jesse（@obra）创建，是当前 Star 数最高的 AI 编程技能框架（**184k GitHub Stars**），最新版本 **v5.1.0**（2026年5月4日发布），MIT 协议。技术栈以 Shell（66.4%）和 JavaScript（24.8%）为主。已进入 Claude Code 和 Cursor 的官方插件市场。

#### 核心工作流

Superpowers 的核心特点是 **skill 自动触发，用户无需主动选择**：

```
brainstorming → using-git-worktrees → writing-plans → subagent-driven-development
                                                        ↓
                                        test-driven-development (RED-GREEN-REFACTOR)
                                                        ↓
                                        requesting-code-review (两阶段审查)
                                                        ↓
                                        finishing-a-development-branch
```

- **brainstorming**：在编码前自动激活，通过交互式问答细化需求，分节展示设计方案供验证
- **subagent-driven-development**：派发全新子 Agent 执行每个任务，每个子 Agent 经历两阶段审查（spec compliance → code quality）
- **TDD 强制执行**：严格 RED-GREEN-REFACTOR 循环，删除未经测试的代码

#### 架构特点

- **Composable Skills**：技能可组合，每个 skill 是独立的功能单元
- **Subagent 驱动**：任务执行不是"主 Agent 线性执行"，而是"派发子 Agent → 审查 → 继续"的树形结构
- **Hook 系统**：通过 session-start hook 注入指令，确保 Agent 在会话开始时就进入工作流
- **多平台**：Claude Code（插件市场）、Cursor（插件市场）、Codex（手动安装）、OpenCode（手动安装）

#### 与 spec-first 的差异对比

| 维度 | Superpowers | spec-first |
|---|---|---|
| **触发方式** | 自动触发（hook + skill 描述匹配） | 用户主动调用（`/spec:*` 命令） |
| **执行模型** | 子 Agent 树形派发 | 主 Agent 流程串联 |
| **TDD 态度** | 强制 RED-GREEN-REFACTOR | 由 Agent Profile 建议而非强制 |
| **知识管理** | 无独立知识系统 | compound + bootstrap 双机制 |
| **Agent 体系** | 无显式 Agent 定义 | 51 个 Agent Profile 显式角色 |
| **治理机制** | 无 | governance.json 注册表三层准入 |
| **工作流阶段** | ~8 个核心 skill | 20 个 workflow + 更多内部 skill |
| **安装方式** | 插件市场一键安装 | npm global install + init |

Superpowers 的核心优势是"零学习成本"——用户不需要记住命令，skill 自动激活。其子 Agent 驱动模型也使其在长任务自主执行方面表现突出。但劣势是缺乏显式治理机制和知识管理闭环。

### 3.2 Spec-Kit（96k Stars, GitHub 官方）

#### 项目概述

Spec-Kit 是 **GitHub 官方推出**的 SDD 工具包，**96k+ GitHub Stars**，200+ 贡献者。Python 技术栈，通过 `uv` 包管理器安装。已集成 **30 个 AI 编程工具**（Copilot、Claude、Gemini、Codex、Windsurf 等），拥有 **91 个社区扩展**和 **18 个预设**。

#### 核心工作流

Spec-Kit 定义了 8 步 SDD 流程（5 步必选 + 3 步可选）：

```
/speckit.constitution  → 项目宪法（必选）
/speckit.specify       → 基准规范（必选）
/speckit.clarify       → 需求澄清（可选）
/speckit.plan          → 技术方案（必选）
/speckit.checklist     → 质量检查清单（可选）
/speckit.tasks         → 可执行任务（必选）
/speckit.analyze       → 跨交付件一致性报告（可选）
/speckit.implement     → 落实实现（必选）
```

#### 架构特点

- **Scripts prepare, LLM decides**：通过 shell 脚本处理确定性工作（文件发现、模板渲染、一致性校验），减少 AI 自由发挥的不确定性
- **宪法机制（Constitution）**：项目级的代码风格、测试标准、架构原则以 Markdown 固化，AI 在后续所有阶段强制执行
- **跨交付件一致性分析**：`/speckit.analyze` 自动比对 spec / plan / tasks 三者的一致性
- **社区生态**：91 扩展 + 18 预设 + 4 个"友方项目"，可替换整个 SDD 流程（如 AIDE 7 步工程生命周期、MAQA 多 Agent 质量门禁）

#### 与 spec-first 的差异对比

| 维度 | Spec-Kit | spec-first |
|---|---|---|
| **官方背书** | GitHub 官方，生态位最强 | 独立社区项目 |
| **集成数量** | 30 个 AI 工具 | 2 个（Claude + Codex） |
| **社区生态** | 91 扩展 + 18 预设 + 200+ 贡献者 | 无扩展市场 |
| **技术栈** | Python（uv） | Node.js（npm） |
| **确定性保证** | Shell 脚本处理文件操作 | JavaScript 插件管理器 |
| **宪法机制** | 独立 constitution 阶段 | repo-profile（轻量规范输入） |
| **一致性分析** | analyze 阶段自动跨交付件比对 | 无自动跨阶段一致性检查 |
| **Agent 体系** | 无显式 Agent | 51 个 Agent Profile |
| **审查体系** | 通过扩展（如 Architecture Guard）补充 | 原生 4 维度 code-review |
| **知识沉淀** | 无 | compound + bootstrap |

Spec-Kit 的最大优势是 GitHub 官方品牌 + 庞大的社区生态 + 30 工具集成，这使它在"开箱即用"维度远超所有竞品。但其劣势是缺乏 spec-first 的 Agent 多角色审查和知识沉淀闭环。

### 3.3 OpenSpec（Fission-AI）

#### 项目概述

OpenSpec 由 Fission-AI 开发，**v1.2.0**，npm 安装，TypeScript/ESM 技术栈，340 commits。定位为"极简规范驱动开发"，强调 brownfield-first（适合存量项目而非 0→1 新项目）。

#### 核心工作流

OpenSpec 的架构围绕"提案—实现—归档"三阶段闭环：

```
/openspec:proposal → 生成 changes/<id>/ (proposal.md + specs/ + tasks.md)
         ↓
   Review & Align（人机协作对齐）
         ↓
/openspec:apply    → AI 按 tasks.md 实现代码 + 测试
         ↓
/openspec:archive   → 归档已完成变更，合并 spec 更新回 source-of-truth
```

#### 架构特点

- **Brownfield-first**：将 `openspec/specs/`（当前真相）和 `openspec/changes/`（提案更新）分离，使增量变更的 diff 显式可见
- **Change Tracking**：每个变更以独立目录存在，proposal / tasks / spec deltas 共处一室，归档时合并
- **12+ 工具支持**：Claude Code、CodeBuddy、Cursor、Windsurf、Codex、GitHub Copilot、Amazon Q 等
- **AGENTS.md 兼容**：自动读取 `openspec/AGENTS.md`，任何 AI 工具只需遵循该文件即可加入工作流

#### 与 spec-first 的差异对比

| 维度 | OpenSpec | spec-first |
|---|---|---|
| **设计哲学** | 极简（3 命令：propose/apply/archive） | 完整（20+ 命令覆盖全生命周期） |
| **目标场景** | Brownfield-first | 新项目 + 存量项目 |
| **变更管理** | changes/ 目录 + archive 合并 | 无独立变更管理，以文档目录组织 |
| **知识管理** | specs/ 作为 source-of-truth | compound + bootstrap 双机制 |
| **Agent 体系** | 无 | 51 个 Agent Profile |
| **多宿主** | 通过 AGENTS.md 兼容 12+ 工具 | 原生双宿主适配器 |
| **审查体系** | 无内置 | 原生 4 维度 code-review |
| **安装方式** | npm install -g @fission-ai/openspec | npm install -g spec-first |

OpenSpec 的独特价值在存量项目场景——它不要求项目从零开始遵循规范，而是以增量变更的方式逐步建立规范体系。但其功能范围明显窄于 spec-first，缺乏审查、调试、优化、知识沉淀等阶段。

### 3.4 四维能力矩阵对照

| 维度 | spec-first | Superpowers | Spec-Kit | OpenSpec |
|---|---|---|---|---|
| **工作流完整度** | 高（20 命令，全生命周期） | 中（~8 核心 skill） | 中高（8 步，5 必选） | 低（3 命令） |
| **知识管理** | compound + bootstrap 双机制 | 无 | 无 | specs/ 作为真相源 |
| **Agent 体系** | 51 个显式 Agent Profile | 子 Agent 隐式派发 | 无 | 无 |
| **多宿主支持** | 双宿主（Claude + Codex），原生适配器 | 4 平台（Claude/Cursor/Codex/OpenCode），插件市场 | 30+ 集成，生态最强 | 12+ 工具，通过 AGENTS.md |
| **质量标准** | 4 维度 code-review + skill-audit | 两阶段审查（spec + code quality） | analyze 跨交付件一致性 + checklist | 无内置 |
| **社区生态** | 无扩展市场 | 无扩展市场 | 91 扩展 + 18 预设 + 200+ 贡献者 | 无扩展市场 |
| **安装体验** | npm install + init | 插件市场一键安装 | uv tool install + init | npm install + init |
| **存量项目支持** | bootstrap 提取项目上下文 | 无特殊支持 | specify init 即可 | brownfield-first，变更管理模型 |
| **确定性保证** | JS 插件管理器 | Hook + skill 匹配 | Shell 脚本处理文件操作 | TypeScript CLI |
| **治理模型** | governance.json 三级准入 | 无 | constitution 宪法 | AGENTS.md 约定 |
| **自动化程度** | 用户主动调用命令 | skill 自动触发 | 用户主动调用命令 | 用户主动调用命令 |
| **TDD 态度** | 建议（Agent 角色判断） | 强制执行 | 无内置 | 无内置 |
| **Git 工作流集成** | bootstrap 阶段 | worktree 隔离 + auto commit | 无内置 | 无内置 |

---

## 四、差异化优势与战略护城河

### 4.1 独有优势

**1. Agent 多角色审查体系（唯一）**

spec-first 拥有 51 个显式 Agent Profile，覆盖代码审查、架构设计、安全、领域专精、治理五类角色。一个 `/spec:code-review` 命令可同时调度 4 个维度的审查 Agent（correctness / testing / security / simplicity），这在四个竞品中独一无二。

Superpowers 有两阶段审查但角色粒度粗（spec compliance + code quality）；Spec-Kit 和 OpenSpec 完全没有内置审查 Agent。

**2. 知识沉淀闭环（唯一）**

spec-first 通过 `spec-compound` 实现"编码→经验提取→知识沉淀"，通过 `spec-graph-bootstrap` 实现"代码库→结构化上下文"，形成完整的知识管理闭环。在三层架构（Ingest/Query/Lint）的设想中，bootstrap 对应 Ingest 层，compound 对应持续更新机制，尚未实现的 Knowledge Harness 对应 Query 层。

Spec-Kit 完全无知识管理；OpenSpec 只有 specs/ 作为真相源但不具备主动提取和沉淀能力；Superpowers 无独立知识系统。

**3. 治理注册表机制（唯一）**

`skills-governance.json` + `agents-governance.json` 实现了 `workflow_command` / `standalone_skill` / `internal_only` 三级准入治理，明确了每个资产对用户的可见性边界。这种显式治理在四个竞品中唯一存在。

其他三个项目通过"文件名匹配"或"AGENTS.md 引用"实现隐式治理，缺乏统一的准入声明。

**4. 双宿主原生适配器**

spec-first 的 `claude.js` 和 `codex.js` 是两个完整的平台适配器，不仅处理文件同步，还包括命令模板合并、格式差异适配、治理注册表差异化渲染。Spec-Kit 虽然支持 30 个工具但通过通用集成方式；OpenSpec 通过 AGENTS.md 兼容但不是原生适配器。

### 4.2 结构性差距

**1. 社区生态——巨大差距**

Spec-Kit 拥有 91 个社区扩展 + 18 个预设 + 200+ 贡献者，已形成自生长的生态系统。spec-first 没有扩展市场、没有社区预设、贡献者集中在核心团队。这种差距是结构性的：Spec-Kit 的扩展架构（presets/extensions/workflows）允许社区"替换整个 SDD 流程"，而 spec-first 目前仍是"封闭式资产集合"。

**2. 安装与上手体验**

Superpowers 通过 Claude Code 插件市场实现一键安装并自动激活；Spec-Kit 通过 `uvx --from git+...` 一行命令初始化。spec-first 需要 `npm install -g spec-first` + `spec-first init` 两步，且安装后需要手动重启宿主才能看到命令。

**3. 自动化程度**

Superpowers 的 skill 自动触发模型（通过 hook + skill 描述匹配）使"用户不需要知道该用什么命令"。spec-first 要求用户主动调用 `/spec:*`，对于不熟悉工作流的用户存在"不知道该调用哪个命令"的认知门槛。

**4. 集成广度**

Spec-Kit 支持 30 个 AI 工具，OpenSpec 支持 12+ 个，Superpowers 支持 4 个。spec-first 仅支持 Claude Code 和 Codex 两个宿主，无法覆盖 Cursor、Windsurf、Copilot 等重要工具的用户群。

**5. 知识库投产状态**

知识库设计文档（双模式知识承载、独立文档仓库、Knowledge Harness、LLM-md 内容规范）已相当完备，但代码实现仍为零。文档与代码之间的鸿沟是目前 spec-first 最大的内部结构性风险。

### 4.3 战略机会窗口

**1. Agent 多角色审查的品牌高地**

当前四个竞品均未在"Agent 多角色审查"维度发力。spec-first 已有 51 个 Agent Profile 的资产基础，如果能将审查流程可视化（如展示"correctness 审查通过 / security 审查发现 3 个问题 / simplicity 建议 2 处优化"），将成为行业内的差异化标杆。

**2. 知识库从文档到投产的窗口期**

知识库方向是 spec-first 文档体系最完备的部分，但竞品尚未在该领域布局。如果能在 v1.15 完成 Knowledge Harness 投产，spec-first 将成为首个实现"从代码库自动编译知识，AI 编码时自动检索知识"的闭环工作流框架。

**3. 项目级实际落地的验证数据**

spec-first 已在 9+ 个项目中实际部署使用（kaz-mvp、sdd-riper、Hr360、ai-engineering-standards 等），这是一个重要的验证基础。将典型案例文档化并输出为最佳实践，可以弥补社区生态的不足。

---

## 五、下一阶段战略方向

### 5.1 战略一：知识引擎投产（优先级最高）

**目标**：将知识库从"文档方案"升级为"运行时能力"，实现从代码库自动编译知识、AI 编码时自动检索知识的闭环。

**核心动作**：

- **Phase 1（v1.15 Knowledge Harness）**：以 provider-absent 为默认设计，即使外部知识库不可用也能完整运行。核心机制包括 context budget（控制知识注入量，避免撑爆上下文）、`docs/solutions` promotion（将高质量方案提升为知识）、memory recall boundary（界定哪些知识应被召回）。
- **Phase 2（v1.16 可选增强）**：接入 CodeGraph / GBrain 等外部知识后端，实现跨仓库知识共享。
- **Phase 3（双模式知识承载代码化）**：将 4 月 16 日已完成的架构方案落地，实现 `in_repo` 和 `external_knowledge` 双后端切换。

**衡量标准**：在 provider-absent 模式下，spec-graph-bootstrap 能为一个中大型项目（200+ 文件）自动生成可用的 rules / patterns / decisions / pitfalls 四类知识，且 AI 在 `/spec:work` 中能自动检索并应用这些知识。

### 5.2 战略二：工作流深化

**目标**：从"流程覆盖"走向"流程深度"，在关键节点建立硬验证和可衡量质量标准。

**核心动作**：

- **spec-req 需求录入**（方案已完成）：新增需求录入阶段，采用 Amazon Working Backwards + Shape Up Appetite 方法论，建立 `requirements/ → plans/ → work/ → reviews/ → knowledge/` 完整可追溯链路。
- **ce-tasks 阶段补全**：当前缺失"将 plan 编译为可执行任务单元"的独立阶段，需新增 `spec-tasks` skill 实现从 plan 到 task pack 的结构化编译。
- **跨阶段一致性分析**：借鉴 Spec-Kit 的 `/speckit.analyze` 机制，实现 spec vs plan vs tasks vs work 的自动一致性校验。
- **工作流可视化**：将当前隐式的工作流链（ideate → brainstorm → ... → compound）可视化为用户可感知的进度看板。

### 5.3 战略三：生态开放

**目标**：从"封闭式资产集合"走向"开放式平台"，建立社区扩展机制。

**核心动作**：

- **Skill 市场机制**：设计社区 skill 的发布、安装、版本管理机制。参考 Spec-Kit 的 presets/extensions 架构，允许第三方发布自定义工作流。
- **Agent Profile 自定义**：允许项目团队定义自己的 Agent Profile（如"我司安全规范审查员"），纳入治理注册表。
- **CI/CD 集成**：将 spec-first 的 compound、bootstrap、skill-audit 等能力嵌入 CI 流水线，实现 MR 自动质量审查。
- **典型案例文档化**：将 9+ 个实际落地项目的经验输出为案例文档，建立"最佳实践"知识资产。

### 5.4 战略四：质量基建

**目标**：将 spec-first 从"个人工具"升级为"团队级基础设施"，建立严格的质量基线。

**核心动作**：

- **确定性验证框架**：当前 skill 指令的执行质量完全依赖 LLM 判断，缺乏确定性验证。需建立 skill 执行结果的 schema 验证（如"plan 输出必须包含哪些字段"、"compound 摘要必须满足什么格式"）。
- **回归测试体系**：为每个 workflow skill 建立 golden test（输入 → 期望输出），实现 CI 中自动回归。
- **版本兼容性矩阵**：当前仅支持 Claude Code 和 Codex，但这两个宿主自身在快速迭代。需建立版本兼容性测试矩阵。
- **安全审计**：skill 指令中可能包含文件系统操作、网络请求等能力，需建立 skill 安全审计机制。

---

## 六、优先级路线图

### 6.1 P0：立即执行（v1.11 - v1.13）

| 版本 | 目标 | 关键交付 |
|---|---|---|
| **v1.11** | Dependency Readiness Baseline | 确保 Knowledge Harness 的前置依赖（context budget、path resolver、solutions promotion pipeline）就绪 |
| **v1.12** | Host Projection / Doctor Consumption | 将 v1.11 的产出投影到双宿主，doctor 命令可消费验证结果 |
| **v1.13** | ce-tasks 阶段补全 | 新增 `spec-tasks` skill，实现 plan → task pack 的结构化编译；CE 插件入口收敛（从 36 个收敛到 8-9 个主入口） |

> v1.11 + v1.12 是不可分割的 producer→consumer 对，v1.11 不单独宣称完成。

### 6.2 P1：近期规划（v1.14 - v1.16）

| 版本 | 目标 | 关键交付 |
|---|---|---|
| **v1.14** | spec-req 需求录入 | 上线 `/spec:req` 命令，建立 requirements/ → plans/ 追溯链路 |
| **v1.15** | Knowledge Harness 投产 | 知识引擎核心能力上线：context budget + solutions promotion + memory recall boundary，provider-absent 模式下完整可用 |
| **v1.16** | 双模式知识承载代码化 | 落地 knowledge backend 抽象：`in_repo` 和 `external_knowledge` 双后端切换；可选接入 CodeGraph / GBrain |

### 6.3 P2：中期规划（v1.17+）

| 方向 | 关键交付 |
|---|---|
| **生态开放 v1** | 社区 skill 市场机制设计 + 试点（允许第三方发布 1-3 个自定义 skill） |
| **跨阶段一致性分析** | 自动比对 spec vs plan vs tasks vs work 的一致性 |
| **工作流可视化** | 进度看板、Agent 审查结果可视化展示 |
| **CI 集成** | compound + bootstrap + skill-audit 嵌入 CI 流水线 |
| **多宿主扩展** | 评估增加 Cursor、Windsurf 适配器 |

---

## 七、风险与对策

### 风险 1：知识库投产延迟导致设计资产贬值

**描述**：双模式知识承载的架构方案已于 4 月 16 日完整输出，但代码层（backend resolver、init 参数、path resolver）仍为零。如果到 v1.15 仍无法投产，竞品可能率先填补知识管理空档。

**对策**：
- 严格控制 v1.11-v1.15 的知识库版本节奏，不因其他需求插入而延期
- 双模式知识承载的 Phase 1（单后端 in_repo）先行，Phase 2（external_knowledge）可在 v1.16 补充
- Knowledge Harness 以 provider-absent 设计保证不依赖外部后端，降低首次交付复杂度

### 风险 2：社区生态差距持续扩大

**描述**：Spec-Kit 的 91 扩展 + 18 预设是网络效应产物，每增加一个扩展就降低后来者的替代成本。如果 spec-first 不尽快开放生态，差距将以指数方式扩大。

**对策**：
- 在 v1.17 前不追求生态规模，而是聚焦"Agent 多角色审查"和"知识管理闭环"两个差异化高地
- P2 阶段的生态开放从"项目级自定义 Agent Profile"切入（这是 Spec-Kit 没有的能力），而非直接竞争社区扩展数量

### 风险 3：双宿主维护成本 vs 价值不对等

**描述**：Claude Code 和 Codex 各自快速迭代，适配器需要持续跟进两者 API 变化。但当前用户群主要集中在 Claude Code，Codex 侧使用率可能较低。如果双宿主维护成本持续增长而 Codex 侧用户无增长，ROI 会恶化。

**对策**：
- 在 v1.16 后评估 Codex 侧的实际使用数据，决定是否降级为"社区维护"或"基础兼容"
- 将适配器抽象接口进一步标准化，降低宿主变化带来的修改面

### 风险 4：Skill 资产膨胀导致治理成本失控

**描述**：当前已有 40 个 skill + 51 个 agent profile，随着 spec-req、spec-tasks 等新增 skill 和更多 Agent Profile 的加入，治理注册表的维护成本将线性增长。CE 插件已暴露 36 个入口点暴露了这个问题。

**对策**：
- 严格执行 v1.13 的入口收敛（从 36 收敛到 8-9 个主入口），为后续 skill 新增建立"必须通过入口收敛评审"的硬性规则
- 新增 Agent Profile 需经过"是否可被已有 Agent 覆盖"的复用性审查
- 引入 skill/agent 的 deprecation 机制，定期清理低使用率资产

### 风险 5：依赖 LLM 能力的脆弱性

**描述**：spec-first 的核心价值交付依赖 LLM 对 skill 指令的理解和执行质量。同一 skill 在不同 LLM 版本下的表现可能显著不同。如果未来 Anthropic/OpenAI 的模型行为发生不可预期的变化，可能导致工作流断链。

**对策**：
- 在 P2 阶段建立 golden test 回归体系（输入→期望输出），每个主要版本发布前自动化验证
- 关键 skill（brainstorm / plan / work / code-review）建立 behavior contract，明确"如果 LLM 输出不满足什么条件，skill 应如何降级"
- 探索 skill 指令中增加更多确定性约束（如必须输出的 JSON schema、必须包含的 section），减少对 LLM "发挥空间"的依赖

---

> **报告结语**：spec-first 在 Agent 多角色审查和知识管理闭环两个维度建立了独特的竞争优势。当前最大的挑战不是竞品追赶，而是将已有设计资产（尤其是知识库体系）高效投产，并在生态开放之前守住差异化高地。v1.11 到 v1.15 的五个版本，将决定 spec-first 是从"功能完整的个人工具"走向"有护城河的团队基础设施"，还是停留在"文档比代码先进"的状态。
