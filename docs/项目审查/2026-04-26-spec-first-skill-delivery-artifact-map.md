# Spec-First Skill 研发体系与产物映射

文档角色：`skill 研发体系说明 / 产物地图`  
日期：`2026-04-26`  
范围：当前 `spec-first` 仓库的公开 workflow skill、辅助 review/knowledge skill，以及与需求、方案、执行相关的主要落盘产物  
判断基线：`docs/10-prompt/项目角色.md`

## 一句话结论

当前 `spec-first` 的 skill 研发体系是一条以轻 contract 驱动的研发链路：

```text
想法/机会
  -> 需求定义
  -> 技术方案
  -> 开发执行
  -> 代码/文档评审
  -> 知识沉淀
```

其中：

- `spec-brainstorm` 产出需求文档，回答 **WHAT**。
- `spec-plan` 产出技术方案，回答 **HOW**。
- `spec-work` / `spec-work-beta` 执行开发任务，产出代码、测试、提交和验证结果。
- `spec-doc-review` / `spec-code-review` 分别审查文档和实现。
- `spec-compound` / `spec-compound-refresh` 把已解决问题沉淀为长期知识。
- `spec-graph-bootstrap` 提供跨阶段的仓库事实输入层，当前以 Stage-0 上下文产物为主，正在向 CRG 图索引 + 按需查询收敛。

核心边界是：**文档是决策产物，不是状态机；执行进度由代码、测试、提交和运行产物证明。**

## 总览表

| 阶段 | 主要问题 | 对应 skill | 主要产物 | 主要消费者 |
| --- | --- | --- | --- | --- |
| 想法生成 | 有哪些值得做的方向？ | `spec-ideate` | `docs/ideation/*.md` | `spec-brainstorm` |
| 需求定义 | 要做什么、为什么做、边界是什么？ | `spec-brainstorm` | `docs/brainstorms/*-requirements.md` | `spec-plan`、`spec-doc-review` |
| 技术方案 | 怎么做、改哪些模块、怎么验证？ | `spec-plan` | `docs/plans/*-plan.md` | `spec-work`、`spec-code-review`、`spec-doc-review` |
| 开发执行 | 按方案实现、补测试、验证、交付 | `spec-work` / `spec-work-beta` | 代码变更、测试、提交、`CHANGELOG.md`、plan 状态更新 | `spec-code-review`、PR 流程、`spec-compound` |
| 文档评审 | 需求/方案是否清晰、完整、可执行？ | `spec-doc-review` | findings、safe_auto 修复、Open Questions、report-only 结论 | `spec-brainstorm`、`spec-plan` |
| 代码评审 | 实现是否正确、缺测试、偏离方案？ | `spec-code-review` | review report、safe_auto 修复、`.spec-first/workflows/spec:code-review/<run-id>/` | `spec-work`、PR 流程 |
| 知识沉淀 | 这次解决的问题以后如何复用？ | `spec-compound` / `spec-compound-refresh` | `docs/solutions/**/*.md` | 后续 `spec-plan`、`spec-work`、reviewer agents |
| 项目事实输入 | 仓库结构、风险、上下文、CRG 图事实 | `spec-graph-bootstrap` | 当前 Stage-0 产物；目标为 `.spec-first/graph/*` | `spec-plan`、`spec-work`、`spec-code-review` |

## 需求文档

对应 skill：`spec-brainstorm`

职责是定义 **WHAT**，包括：

- 用户问题是什么
- 目标用户、actor 或使用者是谁
- 关键流程是什么
- 需求和验收标准是什么
- 哪些是 scope，哪些是 non-goal
- 哪些问题必须规划前解决，哪些可以延后

主要产物：

```text
docs/brainstorms/YYYY-MM-DD-<topic>-requirements.md
```

典型内容：

- Problem frame
- Actors / Key flows / Acceptance examples
- Requirements / Success criteria
- Scope boundaries
- Open questions
- Deferred for later

辅助入口：

- `spec-ideate`：在需求还没有成形前生成和筛选想法，产物在 `docs/ideation/`。
- `spec-doc-review`：审查需求文档，检查一致性、范围、可行性和产品判断。

边界：

- 需求文档不负责写实现方案。
- 需求文档可以记录关键技术约束，但只有当这些约束会影响产品行为、范围或验收时才应进入需求层。
- 如果需求已经足够明确，可以直接进入 `spec-plan`；不需要为了流程完整性强行 brainstorm。

## 技术方案

对应 skill：`spec-plan`

职责是定义 **HOW**，包括：

- 技术路线
- 受影响文件
- 实现单元
- 依赖顺序
- 风险和边界
- 测试策略
- 验证方式
- 从需求到实现单元的 traceability

主要产物：

```text
docs/plans/YYYY-MM-DD-NNN-<type>-<descriptive-name>-plan.md
```

典型内容：

- YAML frontmatter：`title`、`type`、`status`、`date`、`origin`
- Overview / Problem frame
- Requirements Trace
- Scope Boundaries
- Technical Approach
- Implementation Units
- Test Scenarios
- Verification Strategy
- Risks / Open Questions
- Deferred to Implementation

`spec-plan` 会优先读取上游需求文档：

```text
docs/brainstorms/*-requirements.md
```

如果没有需求文档，`spec-plan` 也可以从用户描述直接规划；但如果发现产品问题、范围或用户行为没有定清楚，应建议回到 `spec-brainstorm`，或者在 plan 中显式写入 assumptions。

边界：

- plan 是 **decision artifact**，不是执行脚本。
- plan 不应预写实现代码，也不应写成 shell 命令流水线。
- plan 应包含足够具体的文件、单元、测试和验证信号，让执行者不需要重新发明方案。
- plan 可以包含 directional sketch，但必须明确这是审查上下文，不是照抄实现规格。

## 开发任务

对应 skill：`spec-work`  
实验性委派版本：`spec-work-beta`

职责是执行：

- 读取 plan 或直接接收明确任务
- 把 `Implementation Units` 转成任务列表
- 按现有代码模式实现
- 增改测试
- 运行验证
- 必要时提交
- 最后收口交付

主要产物不是新的“任务文档”，而是：

```text
代码变更
测试变更
验证结果
git commits
CHANGELOG.md 记录
必要时将 plan frontmatter status: active -> completed
```

`spec-work` 消费 plan 中这些内容：

- `Implementation Units`
- `Requirements Trace`
- `Files`
- `Test Scenarios`
- `Verification`
- `Deferred to Implementation`
- `Scope Boundaries`

关键边界：

- plan 是决策产物，不是执行状态表。
- `spec-work` 不应在执行中把 plan 当 checklist 乱改。
- 执行进度存在于 task tracker、git diff、commits、测试结果里。
- 如果涉及源码新增、删除或修改，本仓库规则要求同步更新根目录 `CHANGELOG.md`。
- 如果工作太大或产品边界不清，`spec-work` 应回退建议 `spec-plan` 或 `spec-brainstorm`，而不是硬做。

## 文档评审

对应 skill：`spec-doc-review`

输入：

```text
docs/brainstorms/*-requirements.md
docs/plans/*-plan.md
```

职责：

- 审查需求文档或 plan 文档
- 检查一致性、可行性、范围控制、产品判断、风险和遗漏
- 自动应用安全的 `safe_auto` 文档修复
- 对非自动修复项给出结构化 finding

输出：

- findings
- safe_auto 文档修复
- Open Questions 追加
- report-only 评审结论
- headless 模式下的结构化审查输出

边界：

- 它审查文档，不执行代码实现。
- 它可以建议修改需求或方案，但不替代 `spec-plan` 重新规划。
- 它的 findings 是输入质量改进，不是 runtime gate。

## 代码评审

对应 skill：`spec-code-review`

输入：

- 当前 branch diff
- 可选 `plan:<path>`
- 可选显式 base 或 PR 引用

职责：

- 审查实现是否正确
- 检查测试缺口
- 检查可维护性、项目规范、agent-native 使用方式、需求覆盖
- 自动应用 `safe_auto` 修复
- 输出残余风险和后续处理建议

主要产物：

```text
.spec-first/workflows/spec:code-review/<run-id>/
```

以及最终 review report。

典型内容：

- merged findings
- per-agent detail artifacts
- metadata
- residual actionable work
- testing gaps
- residual risks
- coverage information

边界：

- `spec-code-review` 审实现，不定义需求。
- 如果传入 plan，它可以做 requirements completeness 检查。
- report-only 模式不改文件；autofix/headless 可应用安全修复，但不提交、不 push、不创建 PR。

## 知识沉淀

对应 skill：

```text
spec-compound
spec-compound-refresh
```

职责：

- 把已经解决的问题沉淀成可复用经验
- 清理、合并或刷新过时 learning
- 让后续 planning、work、review 能复用团队经验

主要产物：

```text
docs/solutions/**/*.md
```

常见分类：

```text
docs/solutions/workflow-issues/
docs/solutions/architecture-patterns/
docs/solutions/developer-experience/
docs/solutions/documentation-gaps/
```

边界：

- `docs/solutions/` 是长期知识库，不是当前任务状态。
- `spec-compound` 记录已经解决的问题，不替代 `spec-plan` 写未来方案。
- `spec-compound-refresh` 处理 stale / overlapping / drifted learning，不做普通代码重构。

## 项目事实输入层

对应 skill：`spec-graph-bootstrap`

当前体系中，它是 Stage-0 / CRG 上下文生成器，为 `spec-plan`、`spec-work`、`spec-code-review` 提供仓库事实和上下文。

当前主要产物：

```text
.spec-first/workflows/bootstrap/<slug>/
docs/contexts/<slug>/
```

代表性产物：

```text
artifact-manifest.json
fact-inventory.json
risk-signals.json
test-surface.json
context-routing.json
minimal-context/*.json
docs/contexts/<slug>/architecture/module-map.md
docs/contexts/<slug>/code-facts/test-map.md
docs/contexts/<slug>/context-packs/review-change.md
```

正在规划的目标收敛方向是：

```text
.spec-first/graph/graph.db
.spec-first/graph/graph-index-status.json
.spec-first/graph/code-navigation.json
.spec-first/graph/graph-operations.jsonl
spec-first crg locate/path/explain/impact/review-context
```

也就是从“预生成上下文文档”转向：

```text
CRG 图索引
  -> 按需查询候选修改面和影响面
  -> LLM 基于 evidence / limitations 做工程决策
```

边界：

- 脚本负责确定性事实准备。
- LLM 负责语义判断和工程决策。
- 静态 docs 只能是 projection，不应成为第二事实真源。
- fallback 应回到 direct repo reads，而不是旧文档包。

## 三类核心产物的对应关系

| 类型 | 对应 skill | 标准产物 | 下游消费者 |
| --- | --- | --- | --- |
| 需求文档 | `spec-brainstorm` | `docs/brainstorms/*-requirements.md` | `spec-plan`、`spec-doc-review` |
| 技术方案 | `spec-plan` | `docs/plans/*-plan.md` | `spec-work`、`spec-code-review`、`spec-doc-review` |
| 开发任务 | `spec-work` / `spec-work-beta` | 代码 diff、测试、commits、`CHANGELOG.md`、plan completed 状态 | `spec-code-review`、PR 流程、`spec-compound` |

## 推荐使用顺序

### 方向不明确

```text
spec-ideate
  -> spec-brainstorm
  -> spec-plan
  -> spec-work
  -> spec-code-review
  -> spec-compound
```

### 已经有明确需求

```text
spec-brainstorm
  -> spec-doc-review
  -> spec-plan
  -> spec-work
```

### 已经有明确实现目标

```text
spec-plan
  -> spec-doc-review
  -> spec-work
  -> spec-code-review
```

### 已经有明确小改动

```text
spec-work
  -> targeted verification
  -> optional spec-code-review
```

### 已经完成一次修复，值得沉淀

```text
spec-compound
```

如果旧知识已经漂移：

```text
spec-compound-refresh
```

## 边界裁剪原则

1. 不要把需求文档写成技术方案。
2. 不要把技术方案写成执行脚本。
3. 不要把执行进度写回 plan body。
4. 不要把 review findings 当作需求真源。
5. 不要把 `docs/solutions/` 当作当前任务 backlog。
6. 不要让 `spec-graph-bootstrap` 的 projection 替代真实代码读取或 CRG 查询。
7. 不要为了流程完整性强行经过所有 skill；入口应由当前问题的清晰度和风险决定。

## 最小判断表

| 用户输入形态 | 应优先使用 |
| --- | --- |
| “有什么值得改？” | `spec-ideate` |
| “帮我想清楚这个需求” | `spec-brainstorm` |
| “写个技术方案 / plan this” | `spec-plan` |
| “按这个方案实现” | `spec-work` |
| “审查这份需求/方案文档” | `spec-doc-review` |
| “审查当前 diff / PR” | `spec-code-review` |
| “把这次解决过程沉淀下来” | `spec-compound` |
| “这些经验文档过时了，清理一下” | `spec-compound-refresh` |
| “给这个仓库建立代码事实索引 / 上下文” | `spec-graph-bootstrap` |

## 结论

`spec-first` 的 skill 研发体系不是要把研发流程做成重状态机，而是用一组边界清晰的 workflow skill 产出可复用决策输入：

```text
spec-brainstorm 产需求
spec-plan 产方案
spec-work 产实现
spec-code-review 审实现
spec-compound 沉淀经验
spec-graph-bootstrap 提供仓库事实输入
```

这套体系的质量关键不在“每一步是否都被强制执行”，而在每个产物是否保持单一职责、可追溯、可审查，并且能提高后续 LLM 决策输入质量。
