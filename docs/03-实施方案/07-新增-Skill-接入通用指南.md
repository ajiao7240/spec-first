# 新增 Skill 接入通用指南

> Lifecycle: historical-input. 本文是旧 skill 接入指南，只作为背景；当前 skill / workflow / dual-host governance 以 `AGENTS.md`、`docs/10-prompt/结构化项目角色契约.md`、`skills/`、`agents/`、`src/cli/contracts/dual-host-governance/skills-governance.json` 和 `docs/catalog/runtime-capabilities.md` 为准。

## 1. 文档目标

本文档用于指导在当前 `spec-first` 仓库中新增一个 skill，并决定它应该如何接入整个工作流体系。

覆盖范围不是单一的 `work` 阶段，而是整个主链路：

- `ideate`
- `brainstorm`
- `plan`
- `work`
- `review`
- `compound`

重点回答六个问题：

- 新 skill 应该放在哪里，哪些目录是源码，哪些目录是运行态生成物
- 新能力应接成宿主 workflow 的内部 hook、独立 workflow，还是只提供 agent
- 不同阶段通常会在什么位置挂接新 skill
- `SKILL.md` 应该如何写，才能在多个阶段复用
- 如何同时兼容 Claude Code 与 Codex
- 接入后如何做初始化、诊断、回归和打包验证

## 2. 核心结论

在当前仓库里，“新增 skill”不是先改 CLI，也不是先改运行态目录，而是先决定它在系统中的角色。

推荐顺序始终是：

1. 先判定它属于哪种能力形态
2. 再在 `skills/` 或 `agents/` 中落 canonical 源码
3. 再决定要不要挂接到某个宿主 workflow
4. 只有在需要直接暴露给用户时，才增加公开入口

一句话概括：

**能力先模块化，宿主后挂接，入口最后公开。**

## 3. 当前系统的真实装载模型

### 3.1 Canonical 资产层

仓库中的真实源码层是：

- `skills/`
- `agents/`
- `templates/claude/commands/spec/`
- `src/cli/contracts/dual-host-governance/skills-governance.json`

其中：

- `skills/` 是 skill 的 canonical source
- `agents/` 是 agent profile 的 canonical source
- `templates/claude/commands/spec/` 是 Claude 的 slash command 模板
- `src/cli/contracts/dual-host-governance/skills-governance.json` 定义双宿主运行时交付与公开 workflow 入口治理

### 3.2 运行态生成层

平台运行态不是源码，不能手改：

- Claude 运行态：
  - `.claude/commands/spec/`
  - `.claude/skills/`
  - `.claude/agents/`
- Codex 运行态：
  - `.agents/skills/`
  - `.codex/agents/`
  - `.codex/spec-first/`

这些目录由初始化命令生成：

```bash
spec-first init --claude
spec-first init --codex
```

### 3.3 “宿主 workflow”与“能力 skill”

当前仓库里要区分两个概念：

- **宿主 workflow**
  - 例如 `spec-ideate`、`spec-brainstorm`、`spec-plan`、`spec-work`、`spec-code-review`、`spec-compound`
  - 它们负责定义某一阶段的主流程
- **能力 skill**
  - 例如 `git-worktree`、`spec-doc-review`、`frontend-design`
  - 它们负责给宿主 workflow 提供专项能力

很多新增 skill 并不是新的主流程，而是给某个宿主 workflow 增加一段条件逻辑。当前仓库已经存在这种模式，尤其在 `spec-work` 里最明显，但它并不只属于 `work` 阶段。

## 4. 新增 Skill 的三种接入模式

新增能力前，先判断它属于哪一类。

### 4.1 模式 A：宿主 workflow 内部 hook 型能力

适合：

- 这项能力依附于某个阶段而存在
- 它只在特定上下文下触发
- 用户通常不会单独调用它

典型例子：

- `brainstorm` 阶段的 scope 守门
- `plan` 阶段的 rollout / rollback 检查
- `work` 阶段的数据库迁移守门
- `review` 阶段的 observability lens
- `compound` 阶段的去重与过期检查

接入方式：

1. 新增独立 skill
2. 在宿主 workflow 的 `SKILL.md` 中增加条件触发段
3. 必要时新增 agent

这是新增 skill 最常见、也最推荐的模式。

### 4.2 模式 B：独立可调用 workflow

适合：

- 这项能力本身就是单独阶段或单独入口
- 用户会主动直接调用它
- 它不依附于某个宿主 workflow 才成立

典型例子：

- `spec-brainstorm`
- `spec-plan`
- `spec-code-review`
- `spec-doc-review`

接入方式：

1. 新增 `skills/spec-xxx/SKILL.md`
2. 新增 Claude command template
3. 更新 `src/cli/contracts/dual-host-governance/skills-governance.json`
4. 让 Codex 运行态通过 `.agents/skills/spec-xxx` 暴露 `$spec-xxx`

### 4.3 模式 C：agent-only 能力

适合：

- 只是给其他 skill 提供子角色
- 不需要独立 skill 层
- 只需要被 `Task spec-first:<category>:<agent>` 调起

典型例子：

- reviewer
- analyst
- strategist

接入方式：

1. 新增 `agents/<category>/<agent>.md`
2. 在已有 skill 中引用该 agent

## 5. 命名与 frontmatter 规则

### 5.1 普通能力 skill

普通能力 skill 建议保持目录名与 `name:` 一致，例如：

```md
---
name: git-worktree
description: ...
---
```

适用对象：

- `git-worktree`
- `spec-doc-review`
- `resolve-pr-feedback`
- 未来新增的 `db-migration-guard`、`scope-pressure-test` 这类能力型 skill

### 5.2 主流程 workflow skill

当前仓库中的主流程 workflow skill，源码层经常使用内部 workflow 名，而不是直接把 `name:` 写成公开入口名。

现状示例：

- `skills/spec-brainstorm/SKILL.md` → `name: brainstorm-workflow`
- `skills/spec-plan/SKILL.md` → `name: plan-workflow`
- `skills/spec-work/SKILL.md` → `name: work-workflow`
- `skills/spec-code-review/SKILL.md` → `name: review-workflow`

这说明当前仓库真实策略是：

- 主流程 workflow 的源码 `name:` 可以使用内部名
- Codex 运行态会由 adapter 重写成目录名

因此不要机械套用“所有 skill 都必须 `name == 目录名`”。

推荐规则：

- 能力型 skill：`name == 目录名`
- 主流程 workflow：遵循现有 `*-workflow` 家族命名

### 5.3 特例：显式公开入口的 workflow

公开入口必须同时在 source skill、Claude command template 和 dual-host governance 中成立。不要仅凭某个 `SKILL.md` frontmatter 判断它已经是当前用户入口；以 `docs/catalog/runtime-capabilities.md` 生成结果和 `src/cli/contracts/dual-host-governance/skills-governance.json` 为准。

## 6. 新增 Skill 的标准接入步骤

### 6.1 第一步：先判定“它是谁的能力”

在写任何文件之前，先回答以下问题：

1. 它是新的主流程，还是现有阶段的能力扩展
2. 如果是能力扩展，它的宿主 workflow 是谁
3. 它是否可能被多个宿主 workflow 复用
4. 它是否需要单独对用户暴露入口
5. 它是否需要专属 agent

如果这一步不明确，后面很容易做成：

- 本应是 hook 型能力，却被错误做成新的 `spec-*` workflow
- 本应复用的能力，被直接硬编码进某个宿主 workflow

### 6.2 第二步：创建源码目录

标准目录：

```text
skills/<skill-name>/
  SKILL.md
  references/      # 可选
  scripts/         # 可选
```

建议：

- 目录名使用 kebab-case
- 名称聚焦能力，不聚焦一次性任务
- hook 型能力不要强行使用 `spec-` 前缀，除非它真的是公开 workflow

### 6.3 第三步：编写 `SKILL.md`

通用模板应避免写死在 `work` 阶段。推荐使用“宿主无关”的骨架：

```md
---
name: <skill-name>
description: <一句话描述能力与触发场景>
argument-hint: "[optional: host artifact path or scope hint]"
---

# <Title>

## Purpose

Use this skill when:
- <触发条件 A>
- <触发条件 B>

Do not use this skill when:
- <非目标 A>
- <非目标 B>

## Inputs

Required:
- host workflow
- current artifact path or subject
- current scope or unit of focus
- known constraints / risks / goals

Optional:
- related requirements or references
- existing pattern files
- success or verification target

## Workflow

1. Read the host context and determine whether this capability is needed.
2. Inspect only the relevant files, sections, or artifacts.
3. Return:
   - decision
   - rationale
   - recommended actions or constraints
   - verification or follow-up checklist
4. If blocked, return a fallback path with explicit tradeoffs.

## Output Contract

- Decision: use / skip
- Why
- Required actions or constraints
- Verification or follow-up checklist
- Fallback
```

这套模板可以适配：

- `ideate` 的 idea 筛选
- `brainstorm` 的 scope / product 挑战
- `plan` 的 rollout / testing / architecture 风险扫描
- `work` 的专项执行守门
- `review` 的专项 reviewer lens
- `compound` 的知识提炼与去重

### 6.4 第四步：如果需要子角色，再新增 agent

目录：

```text
agents/<category>/<agent-name>.md
```

在 skill 源码中引用 agent 时，统一使用 canonical 形式：

```text
Task spec-first:<category>:<agent-name>(...)
```

例如：

```text
Task spec-first:review:correctness-reviewer(Review rollback and migration risks)
```

不要在源码 skill 里直接写平台路径：

- `.claude/agents/...`
- `.codex/agents/...`

这些路径应由 adapter 在运行态改写。

### 6.5 第五步：挂接到宿主 workflow

如果这是 hook 型能力，就在宿主 workflow 的 `SKILL.md` 中加入条件路由。

推荐统一写法：

```md
<N>. **<Capability Name>** (if applicable)

   Trigger this capability when:
   - <signal-a>
   - <signal-b>
   - <signal-c>

   When triggered:
   - Load the `<skill-name>` skill
   - Pass the host workflow context, current artifact, scope, and known constraints
   - Treat the result as input to the next step in this workflow
   - Complete the returned checklist before marking this step done

   Fallback:
   - If the skill is unavailable, continue with a manual review using the same categories
```

这一段至少要说清楚五件事：

1. 何时触发
2. 传什么输入
3. 输出会影响哪个后续步骤
4. 宿主 workflow 如何消费结果
5. 失败时如何降级

### 6.6 第六步：只有在需要独立入口时，才加 workflow 注册

如果该能力要成为新的独立 workflow，则额外执行：

1. 修改 `src/cli/contracts/dual-host-governance/skills-governance.json`
2. 新增 `templates/claude/commands/spec/<name>.md`
3. 采用与现有主流程一致的 workflow 命名策略

如果它只是现有阶段的 hook 型能力，则不要改这三处。

## 7. 六阶段接入矩阵

下面这张矩阵用于判断不同阶段通常适合接什么能力。

| 宿主 workflow | 主输入 | 常见 hook 类型 | 常见触发信号 | 典型输出 |
| --- | --- | --- | --- | --- |
| `ideate` | 问题域、项目现状、改进目标 | 点子生成、优先级挑战、约束过滤 | “给我想点子”、改进方向很多、缺少优先级 | 候选想法、排序、筛选理由 |
| `brainstorm` | feature idea、问题描述、需求上下文 | scope 守门、产品挑战、用户价值 lens | 需求模糊、范围膨胀、目标和需求不一致 | 范围收敛建议、取舍、待确认问题 |
| `plan` | requirements doc、实现范围、约束 | 架构风险、测试完整性、rollout/rollback 检查 | 高风险改造、跨模块、外部依赖、迁移 | 计划约束、实施顺序、验证补充 |
| `work` | plan、implementation unit、变更文件 | 专项执行守门、专项实现辅助 | migration、UI、发布、并行改动 | 执行约束、检查清单、补充验证 |
| `review` | diff、branch、PR、变更摘要 | 领域 reviewer、security lens、operability lens | 高风险 diff、生产变更、监控不足 | findings、修复建议、风险分级 |
| `compound` | solved problem、solution doc、经验候选 | 模式抽取、去重、过期检查、知识整理 | 解法可复用、文档重叠、历史经验漂移 | 可沉淀模式、去重建议、刷新动作 |

## 8. 宿主 workflow 的 hook 段如何设计

hook 段建议统一按“触发器 + 行为 + 降级”三段结构写。

### 8.1 触发器

触发器建议来自以下四类信号：

- 当前工件中出现明确关键词
- 当前阶段存在明显风险标签
- 当前范围命中某类文件或章节模式
- 当前目标存在明确领域约束

### 8.2 行为

行为段必须明确：

- 在当前 workflow 的哪个步骤加载
- 传递什么上下文
- 返回结果如何影响宿主 workflow

推荐写法：

- “before generating ranked ideas”
- “before finalizing requirements”
- “before locking the plan”
- “before implementation”
- “before presenting findings”
- “before writing the final solution document”

### 8.3 降级

必须写明：

- skill 不可用时是否继续
- 缺少工具时如何人工降级
- 什么情况下必须阻断宿主 workflow

经验建议：

- 守门型能力：可以设置阻断条件
- 分析型能力：优先允许降级
- 外部调用型能力：必须显式写出失败路径

## 9. Claude / Codex 兼容要求

### 9.1 不要手改运行态目录

不要直接修改：

- `.claude/`
- `.codex/`
- `.agents/skills/`

这些都是生成物。

### 9.2 skill 内容里不要硬编码平台专属路径

不要在源码 skill 中直接引用：

- `.claude/skills/...`
- `.agents/skills/...`
- `.claude/agents/...`
- `.codex/agents/...`

除非你明确在写平台专用说明，否则都应避免。

### 9.3 agent 引用使用 canonical 形式

源码 skill 中的 agent 引用统一使用：

```text
spec-first:<category>:<agent-name>
```

或：

```text
Task spec-first:<category>:<agent-name>(...)
```

这样 Claude 与 Codex 可以分别通过 adapter 转换到各自运行态格式。

### 9.4 注意 Codex 的 runtime skill 名暴露规则

Codex 运行态会依赖目录名与 runtime skill 名的对应关系，因此 workflow skill 的可发现性最终要看生成后的 runtime 内容，而不是只看源码 frontmatter。

这也是为什么：

- 主流程 workflow 在源码里可以保留 `*-workflow`
- 但 Codex 运行态仍会暴露 `$spec-work`、`$spec-plan` 这类名字

## 10. 验证与回归清单

新增 skill 后，至少做以下检查。

### 10.1 结构检查

- `skills/<new-skill>/SKILL.md` 存在
- 如有 agent，`agents/<category>/<agent>.md` 存在
- 如是独立 workflow，Claude command template 已新增

### 10.2 初始化检查

```bash
node bin/spec-first.js init --claude -u kuang --lang zh
node bin/spec-first.js init --codex -u kuang --lang zh
```

检查：

- Claude 运行态 skill 是否生成到 `.claude/skills/`
- Codex 运行态 skill 是否生成到 `.agents/skills/`
- 如新增 agent，是否生成到 `.claude/agents/` 与 `.codex/agents/`

### 10.3 诊断检查

```bash
node bin/spec-first.js doctor --claude
node bin/spec-first.js doctor --codex
```

关注：

- skill 目录数量是否同步
- agent 是否缺失
- Claude runtime 是否出现未改写的 canonical agent 名称

### 10.4 回归测试

至少跑：

```bash
npm test
bash tests/smoke/cli.sh
```

如果新增的是公开 workflow，还要更新 smoke 里的：

- command 数量断言
- skill 数量断言
- 关键文件存在性断言

如果只是新增 hook 型能力，通常至少要更新：

- skill 数量断言

### 10.5 打包检查

```bash
npm pack --dry-run
```

确认新 skill / agent 已进入发布包。

## 11. 案例 A：为 `spec-work` 增加数据库迁移守门能力

### 11.1 目标

当 plan 或当前实现单元涉及以下内容时：

- migration
- schema
- DDL
- rollback

`spec-work` 在真正开始改代码前，先加载 `db-migration-guard`，输出：

- 风险清单
- 执行约束
- 验证清单
- 回滚检查点

### 11.2 新增 skill 目录

```text
skills/db-migration-guard/
  SKILL.md
```

### 11.3 `SKILL.md` 示例

```md
---
name: db-migration-guard
description: Guard database migrations executed during spec-work. Use when the current plan or unit touches schema, DDL, rollback, or migration files.
argument-hint: "[optional: plan path or migration scope]"
---

# Database Migration Guard

## Purpose

Use this skill when:
- the host workflow is `spec-work`
- the current plan mentions migration, schema, DDL, or rollback
- the current unit touches migration files or schema definitions

Do not use this skill when:
- the change is pure application logic with no schema impact
- the current task only reads existing persistence structures

## Inputs

Required:
- host workflow
- current plan path
- current implementation unit
- files in scope
- known database risks

## Workflow

1. Determine whether the current unit changes persistence structure or migration behavior.
2. Inspect migration files, schema files, and adjacent persistence code.
3. Return:
   - migration risk summary
   - preflight checklist
   - rollout / rollback constraints
   - verification checklist
4. If no schema-impacting change exists, return `Decision: skip`.
```

### 11.4 在 `spec-work` 中加入 hook

```md
7. **Database Migration Guard** (if applicable)

   Trigger this capability when:
   - the plan mentions `migration`, `schema`, `DDL`, or `rollback`
   - the current unit touches migration files, schema definitions, or persistence-layer code
   - the change has data integrity or rollout risk

   When triggered:
   - Load the `db-migration-guard` skill before implementation
   - Pass the host workflow context, current plan path, implementation unit, files in scope, and known risks
   - Treat the returned preflight and rollback notes as execution constraints for the unit
   - Complete the verification checklist before marking the unit done

   Fallback:
   - If the skill is unavailable, manually review migration ordering, rollback safety, and data integrity risks before proceeding
```

### 11.5 为什么这是 hook 型而不是新 workflow

因为这个能力：

- 只在 `work` 阶段有意义
- 不需要用户直接输入 `$db-migration-guard`
- 本质上是执行守门，而不是新的阶段

所以它适合：

**独立 skill + `spec-work` 内部 hook**

## 12. 案例 B：为 `spec-brainstorm` 增加范围压力测试能力

### 12.1 目标

当 `brainstorm` 阶段出现以下情况时：

- 需求数量偏多
- 目标与需求不一致
- P0/P1/P2 混在一起
- 用户想法很多但缺少取舍

在输出 requirements 之前，先加载 `scope-pressure-test`，帮助宿主 workflow：

- 识别范围膨胀
- 区分必须项与可延后项
- 标记必须在 `brainstorm` 阶段解决的产品决策

### 12.2 新增 skill 目录

```text
skills/scope-pressure-test/
  SKILL.md
```

### 12.3 `SKILL.md` 示例

```md
---
name: scope-pressure-test
description: Stress-test brainstorm scope before requirements are finalized. Use when the current feature idea contains too many goals, unclear priorities, or likely scope creep.
argument-hint: "[optional: requirements path or scope hint]"
---

# Scope Pressure Test

## Purpose

Use this skill when:
- the host workflow is `spec-brainstorm`
- the current brainstorm contains many requirements, multiple priority tiers, or unclear goals
- the user is exploring several directions at once

Do not use this skill when:
- the feature is already tightly scoped
- the requirements are already explicit and internally consistent

## Inputs

Required:
- host workflow
- current feature idea or requirements draft
- known goals and non-goals
- open product questions

## Workflow

1. Check whether the current brainstorm is trying to solve multiple problems at once.
2. Identify which requirements are core, optional, or misplaced.
3. Return:
   - scope pressure summary
   - keep / cut / defer suggestions
   - questions that must be resolved before planning
   - recommended scope boundaries
4. If the scope is already coherent, return `Decision: skip`.
```

### 12.4 在 `spec-brainstorm` 中加入 hook

```md
<N>. **Scope Pressure Test** (if applicable)

   Trigger this capability when:
   - the feature idea contains many goals or requirement candidates
   - multiple priority tiers appear early in the brainstorm
   - the current discussion shows likely scope creep or blurred success criteria

   When triggered:
   - Load the `scope-pressure-test` skill before writing the final requirements document
   - Pass the host workflow context, current brainstorm notes, goals, non-goals, and open questions
   - Use its keep / cut / defer output to tighten the requirements and scope boundaries
   - Resolve any “must-answer-before-planning” questions before ending the brainstorm

   Fallback:
   - If the skill is unavailable, manually do a keep / cut / defer pass before finalizing the requirements doc
```

### 12.5 为什么这不是 `plan` 或 `review` 能力

因为这个能力的核心价值是：

- 在需求定义阶段压缩范围
- 在进入 `plan` 前解决关键产品取舍
- 防止把产品决策推迟到技术规划阶段

所以它更适合作为：

**`spec-brainstorm` 的内部 hook 型能力**

## 13. 实施建议

如果你准备新增一个 skill，建议按以下顺序推进：

1. 先判断它属于 hook 型、独立 workflow，还是 agent-only
2. 再判断它的宿主 workflow 是谁，是否会跨多个阶段复用
3. 把 `SKILL.md` 写成宿主无关模板，不要一开始就写死在 `work`
4. 如果它只是能力扩展，优先先挂到一个宿主 workflow 验证
5. 通过 `init`、`doctor`、smoke、pack 验证后，再决定是否升格为独立入口

一句话概括：

**不是所有新增 skill 都应该变成新的 `spec-*`。大多数新增 skill，应该先作为某个宿主 workflow 的能力模块存在。**
