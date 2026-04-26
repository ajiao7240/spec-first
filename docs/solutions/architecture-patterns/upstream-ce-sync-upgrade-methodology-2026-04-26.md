---
title: 上游 CE 更新同步到 spec-first 的常态化升级方法
date: 2026-04-26
last_updated: 2026-04-27
category: docs/solutions/architecture-patterns
module: workflow-asset-sync
problem_type: architecture_pattern
component: development_workflow
severity: medium
applies_when:
  - spec-first 需要持续吸收 compound-engineering-plugin 的上游更新
  - 上游更新同时涉及 skills、agents、scripts、README、runtime governance 或 workflow contract
  - 需要避免机械复制 CE 命名、路径和 host 假设
tags: [ce-sync, workflow-assets, migration, governance, spec-first]
---

# 上游 CE 更新同步到 spec-first 的常态化升级方法

## Context

`spec-first` 来源于 `compound-engineering-plugin`，后续 CE 上游持续更新会成为常态。同步不是简单复制文件，因为两边已经出现了明确分叉：

- CE 使用 `ce-*` 命名，spec-first 使用 `spec-*` 或本项目已有的非 `spec-*` skill 名称。
- CE 的 host 假设、artifact 路径、runtime 资产和 cleanup registry 不一定存在于 spec-first。
- spec-first 有自己的公共 workflow 路由、source/runtime 边界、CHANGELOG 治理和双宿主策略。
- 同一个 CE 变更可能包含可直接同步、需要语义改写、应延后 spike、或不应同步四类结果。

因此，常态化同步必须把“事实收集”和“语义决策”分开：脚本负责列出 diff、路径、状态和验证命令；LLM 负责判断哪些变化真正提升 spec-first、哪些会造成多真相源或 host 语义漂移。

## Guidance

后续收到 CE 更新范围时，按下面协议执行。除非用户明确只要调研，否则默认产出可执行计划；如果用户明确要求“直接同步升级”，则在计划通过自检后继续实施。

### 0. 固定执行原则

CE 同步升级是常态化治理动作，不是一次性迁移。每轮都必须遵守这几个原则：

- **先计划，后实施**：除非用户明确要求跳过计划，否则先生成或更新 `docs/plans/` 下的同步计划。
- **逐文件，不抽查**：过滤后的 CE 文件必须全部进入判定，不允许只看代表文件。
- **diff 驱动，不凭印象**：每个修改文件都要从 `git diff` 中提取具体改动文案，明确“修改前 / 修改后”的行为变化。
- **新增可建，修改只 patch，删除不机械跟随**：CE 新增文件可以按 spec-first 目标路径新建；CE 修改文件只能做局部替换；CE 删除文件必须先判断 spec-first 是否仍有公共入口或本地独有价值。
- **source 优先，runtime 不手改**：只改 `skills/`、`agents/`、`src/`、docs、tests 等 source asset；`.claude/`、`.codex/` 是生成资产。
- **单一真相源优先**：如果 CE 把能力内联到另一个 skill，而 spec-first 已经有独立公共 workflow，不能为了追齐 CE 而制造第二套写作逻辑或第二套 contract。
- **脚本做确定性检查，LLM 做语义判断**：脚本列 diff、跑测试、验证格式；是否同步、如何适配、是否保留公共入口由 LLM 按项目边界判断。

### 1. 先固定输入范围

从用户给出的 CE range 或 git 输出中提取：

- 上游仓库路径，例如 `/Users/kuang/xiaobu/compound-engineering-plugin`。
- commit range，例如 `1284290a..e8c118e2`。
- 过滤规则，例如排除 `docs/`、`tests/`。
- 用户要求的输出形态，例如计划文档、直接实施、中文文档、独立 agent 审查。

然后用确定性命令拿事实：

```bash
git -C /path/to/compound-engineering-plugin diff --name-status <base>..<head>
git -C /path/to/compound-engineering-plugin diff --unified=0 <base>..<head> -- <file>
```

不能抽样。过滤后的每个 CE 文件都必须进入同步判定表。

如果用户要求过滤 `docs/`、`tests/`，命令层也要显式过滤，避免后续人工清单漂移：

```bash
git -C /path/to/compound-engineering-plugin diff --name-status <base>..<head> -- . ':(exclude)docs/**' ':(exclude)tests/**'
```

### 2. 建立 CE 到 spec-first 的路径映射

同步前先读 spec-first 当前文件，而不是假设目标路径存在。路径映射遵循当前项目结构：

| CE 类型 | spec-first 目标 |
|---|---|
| `plugins/compound-engineering/agents/ce-*.agent.md` | `agents/spec-*.agent.md` |
| `plugins/compound-engineering/skills/ce-code-review/**` | `skills/spec-code-review/**` |
| `plugins/compound-engineering/skills/ce-doc-review/**` | `skills/spec-doc-review/**` |
| `plugins/compound-engineering/skills/ce-compound/**` | `skills/spec-compound/**` |
| `plugins/compound-engineering/skills/ce-compound-refresh/**` | `skills/spec-compound-refresh/**` |
| `plugins/compound-engineering/skills/ce-debug/**` | `skills/spec-debug/**` |
| `plugins/compound-engineering/skills/ce-session-*` | `skills/spec-session-*` source path；正文调用名以 frontmatter `name` 为准 |
| `plugins/compound-engineering/skills/ce-work/**` | `skills/spec-work/**` |
| `plugins/compound-engineering/skills/ce-work-beta/**` | `skills/spec-work-beta/**` |
| `plugins/compound-engineering/skills/ce-commit-push-pr/**` | `skills/git-commit-push-pr/**`，不是 `spec-commit-push-pr` |
| `plugins/compound-engineering/skills/ce-demo-reel/**` | `skills/feature-video/**` |
| `plugins/compound-engineering/skills/ce-resolve-pr-feedback/**` | `skills/resolve-pr-feedback/**` |
| `plugins/compound-engineering/skills/lfg/**` | `skills/lfg/**` |
| CE plugin converter / legacy cleanup source | 只有 spec-first 存在同构治理面时才迁移 |

如果 CE 删除了某个 skill，不能默认同步删除。先检查 `using-spec-first`、README、governance contract、runtime adapter 和当前用户入口，确认它在 spec-first 是否仍是公共 workflow 或本项目独有能力。

### 3. 逐文件建立同步判定表

计划文档必须包含逐文件表，字段固定为：

| 字段 | 内容 |
|---|---|
| CE 文件 | 过滤后的上游文件路径 |
| CE 具体改动摘要 | 从 diff 提炼，不写目录级泛化 |
| spec-first 目标文件 | repo-relative path；没有目标时写“无直接目标” |
| 同步结论 | 同步、部分同步、不同步、延后 spike |
| 实施单元 | 归入哪个实施批次 |
| 验证点 | 对应测试文件或人工检查点 |

这张表是同步升级的主控清单。主题章节可以解释设计，但不能替代表格。

### 3.1 补充 diff 文案级依据

当用户要求“明确改动点”或本轮同步会进入实施阶段时，计划还必须在每个主题小节中补 `CE diff 文案级依据`。这不是新增一张宽表，而是把证据放进对应改动点下，方便执行者直接定位 patch。

写法约束：

- **M 修改文件**：写出关键修改前文案和修改后文案，至少覆盖会影响 spec-first patch 的 hunk。
- **A 新增文件**：不展开全文，直接索引 CE 新增路径，并说明目标是否新建、合并或不落盘。
- **D 删除文件**：写清被删文件原职责、CE 删除后的新归宿，以及 spec-first 是否同步删除。
- **大型 prompt / skill diff**：不需要复制全段，但必须记录足够精确的 before/after 句子、enum、路径、选项名、步骤名或行为。
- **路径类变更**：写清旧路径、新路径和 spec-first 目标路径，避免 CE 路径残留。

示例：

```markdown
**CE diff 文案级依据**

- 修改前：`verdict: [fixed | fixed-differently | replied | not-addressing | needs-human]`。
- 修改后：`verdict: [fixed | fixed-differently | replied | not-addressing | declined | needs-human]`。
- 修改后新增回复模板：`Declined: [specific harm cited ...]`。
```

新增文件示例：

```markdown
- 新增文件索引：`plugins/compound-engineering/skills/ce-compound/scripts/validate-frontmatter.py`。
```

### 4. 用四类决策处理每个变更

每个 CE diff 只能归入以下四类之一：

1. **直接同步**：命名、路径、host 语义和 spec-first 目标一致；只需 `ce-` 到 `spec-` 或路径改写。
2. **语义适配后同步**：CE 思路正确，但必须改成 spec-first 命名、host 能力、artifact 路径、frontmatter name、用户入口或治理文案。
3. **不迁移**：CE 变更只服务 CE converter、CE 删除的公共面在 spec-first 仍需保留，或会制造多真相源。
4. **延后 spike**：需要 host 能力、外部工具或产品决策确认；本轮只能写 fallback 或边界，不实现高风险路径。

判断时按 `docs/10-prompt/项目角色.md` 的基线：

- 提升输入质量优先于增加流程控制。
- 保持单一真相源。
- 脚本做确定性检查，LLM 做语义判断。
- 不把 CE 的 host 能力泛化到 spec-first。
- 不为了表面完整性引入状态机、强编排或重复 contract。

### 5. 先写计划，再做质量审查

常态化计划文档放在 `docs/plans/`，名称格式：

```text
docs/plans/YYYY-MM-DD-NNN-sync-ce-<head-sha>-workflow-updates-plan.md
```

计划至少包含：

- 输入范围和过滤规则。
- CE 到 spec-first 的路径映射。
- 逐文件同步判定附录。
- 按主题整理的具体改动点。
- 实施单元和推荐顺序。
- 风险与控制。
- 具体测试文件和断言。
- CHANGELOG 治理步骤。

当用户要求审查或变更面较大时，开启独立 agent 做文档质量审查。审查重点固定为：

- 是否所有过滤后的 CE 文件都有判定。
- 是否存在多真相源风险。
- 是否误套 CE host 假设。
- 是否遗漏 CHANGELOG 或 runtime governance。
- 验证计划是否落到具体测试文件和断言。
- 是否有“建议/必要时/可以”这类不可执行措辞。

审查意见必须回写计划文档，而不是只在聊天里总结。

审查后必须特别检查四类常见问题：

- **验证命令是否漏测**：最低验证不能只覆盖高风险单元；一次性执行全量同步时，要覆盖所有受影响实施单元。
- **公共 workflow 是否被机械删除**：CE 删除不等于 spec-first 删除，必须查 `using-spec-first`、README、governance manifest、runtime smoke 和调用方。
- **新增 reference 是否制造第二真相源**：如果能力已有独立 spec-first workflow，CE 新 reference 应作为 gap audit 输入，而不是直接落盘成并行写作源。
- **测试断言是否过宽**：例如“用户可见 LFG 文案消失”应限定 routing question、walkthrough option、preview header、completion wording 等用户可见路径，不要误伤历史说明或内部注释。

### 6. 直接同步升级时按实施单元执行

用户明确要求直接同步时，在计划自检通过后继续实施。实施顺序按风险从低到高：

1. 确定性脚本和 parser-safety 变更。
2. agent/skill contract 的小枚举或文案变更。
3. review / debug / PR workflow 行为变更。
4. work / work-beta / delegation / host capability 变更。
5. README、AGENTS、CLAUDE、governance 文案。
6. `CHANGELOG.md`。
7. runtime asset 刷新，仅在用户要求或变更涉及运行时生成时执行。

执行时遵守当前工作区保护：

- 先查 `git status --short`。
- 不覆盖用户已有改动。
- 已被其他任务改过的目标文件，先读当前内容再合并。
- 不手改 `.claude/`、`.codex/` 生成资产。

对 CE 状态为 `M` 的文件，实施记录要能说明：

```text
CE diff hunk -> spec-first 目标文件 -> 局部替换点 -> 验证断言
```

对 CE 状态为 `A` 的文件，实施记录要能说明：

```text
CE 新增路径 -> spec-first 新建/合并/不落盘决策 -> 命名和路径适配 -> 测试
```

对 CE 状态为 `D` 的文件，实施记录要能说明：

```text
CE 删除原因 -> spec-first 当前引用面 -> 删除/保留决策 -> 如保留，吸收哪些能力
```

### 6.1 特殊场景：PR description 能力迁移

CE 经常会调整 git/PR 工作流。遇到 `ce-pr-description`、`ce-commit-push-pr` 或 PR writing reference 变动时，必须先做 gap audit，而不是直接复制新 reference。

gap audit 固定覆盖：

- PR ref parsing / current-branch mode / PR mode。
- base detection / non-default base / fork PR / API-only fallback。
- commit classification。
- evidence preservation / capture handoff。
- before/after narrative frame。
- sizing table。
- writing voice、visual communication、GitHub issue numbering。
- focus hint。
- title/body assembly。
- badge、compression、return contract。

每项标记为：

| 标记 | 含义 | 处理 |
|---|---|---|
| `already covered` | spec-first 已有等价能力 | 不重复迁入 |
| `missing` | spec-first 缺失且适用 | 局部合并到现有单一真相源 |
| `conflicting` | spec-first 有能力但语义与 CE 新逻辑冲突 | 先判断项目边界，再局部修正 |

如果 `spec-pr-description` 仍是公开 workflow，则默认保持它为唯一 PR title/body 写作源；`git-commit-push-pr` 只做 intent detection、薄委托和 `gh pr create/edit` 应用。

### 7. 验证要按变更类型收口

每个实施单元必须有对应验证，不用一个全量 `npm test` 代替所有判断：

| 变更类型 | 验证方式 |
|---|---|
| Python / shell 脚本 | 新增或更新 unit test，真实执行脚本 |
| skill / agent prose contract | contract test 断言关键路径、枚举、用户文案和禁止项 |
| runtime governance / init / adapter | dual-host governance、init dry-run、smoke test |
| README / AGENTS / CLAUDE 文案 | 文案 contract 或人工检查，避免生成资产漂移 |
| PR / review / work workflow 行为 | 对应 workflow contract test，加负向断言 |
| 用户可见 workflow 改动 | `CHANGELOG.md` 标记 `(user-visible)` |

最低验证从窄测试开始。影响 runtime install、init、clean 或发布包时再扩大到 smoke、build、`npm test`。

一次性执行多单元同步时，最低验证必须覆盖每个受影响单元。不要只运行 code-review / work 这类高风险测试而漏掉 session、frontmatter、debug、feature-video、PR feedback、PR description 或 changelog。

如果计划列出的某个 contract test 文件尚不存在，执行者有两个选择：

- 新增最窄 contract test。
- 把断言合并进现有同域测试，并在实现记录里说明归属。

不能因为测试文件不存在就跳过该实施单元的验证。

### 8. 收尾标准

一次 CE 同步升级完成时，必须同时满足：

- 过滤后的 CE 文件都有逐文件同步结论。
- 同步项已落到 spec-first 当前 source 文件，不含 CE 路径、CE 命名或 CE host 假设残留。
- 不同步项有明确原因。
- 保留或删除公共 workflow 的决策有 `using-spec-first` / governance 依据。
- 测试覆盖所有确定性 contract。
- `CHANGELOG.md` 已按 `.codex/spec-first/.developer` 记录作者。
- 最终回复列出实际改动、验证命令和未执行的验证。

## Why This Matters

这套方法防止 CE 更新同步变成“复制 prompt 文件”：

- 逐文件判定保证覆盖面，不靠目录级印象。
- 路径映射保证 spec-first 当前项目结构是目标，不让 CE 残留进入运行面。
- 四类决策保证 LLM 做语义判断，不让脚本或字符串替换替代架构判断。
- 独立审查保证计划能交给执行 agent，而不是只给当前会话理解。
- 验证矩阵保证新增脚本和 workflow contract 真实可执行。
- CHANGELOG 和 runtime 边界保证同步升级符合项目治理。

## When to Apply

- 用户给出 CE git 更新列表，要求同步到 spec-first。
- CE 上游发布了新版本，需要评估 spec-first 是否吸收。
- spec-first 某个 workflow 与 CE 行为漂移，需要追上上游。
- 需要删除、合并或保留某个从 CE 迁移来的 skill / agent。
- 修改涉及 `skills/`、`agents/`、workflow references、host adapter、runtime governance 或 README/AGENTS 入口文案。

## Examples

**PR description 迁移判断**

CE 删除 `ce-pr-description` 并把写作逻辑搬进 `ce-commit-push-pr`，但 spec-first 当前有公开 `$spec-pr-description` 路由。同步结论应为：

- 不删除 `skills/spec-pr-description/SKILL.md`。
- `spec-pr-description` 保持唯一 PR title/body 生成源。
- `git-commit-push-pr` 只做 intent detection、薄委托和 `gh pr create/edit` 应用。
- CE reference 中缺失的写作能力合并进 `spec-pr-description`，不新增第二写作 reference。
- 合并前先做 `pr-description-writing.md` 对当前 `spec-pr-description` 的 gap audit，只迁入 `missing` / `conflicting` 项。

**worktree isolation 迁移判断**

CE 的 Claude Code `isolation: "worktree"` 能力不能直接写进 Codex delegation。同步结论应为：

- Claude Code worktree isolation 写成 host-specific 能力。
- shared-directory fallback 禁止 subagent stage/commit。
- Codex delegation 继续按 `skills/spec-work-beta/references/codex-delegation-workflow.md` 的 orchestrator-owned git 边界执行。
- host 能力未确认时只落地 fallback，不实现自动 worktree 并行。

## Related

- `docs/10-prompt/项目角色.md` — spec-first 演化判断基线。
- `docs/plans/2026-04-26-004-sync-ce-e8c118e2-workflow-updates-plan.md` — 本方法论抽取自该次 CE 同步计划。
- `skills/using-spec-first/SKILL.md` — 公共 workflow 路由和 internal-only skill 边界。
- `docs/solutions/architecture-patterns/workflow-entrypoint-exposure-contract-2026-04-26.md` — workflow 入口暴露的双宿主治理经验。
- `docs/solutions/workflow-issues/modify-source-not-artifacts-2026-04-13.md` — 修改 source asset 而不是 runtime artifact 的经验。
