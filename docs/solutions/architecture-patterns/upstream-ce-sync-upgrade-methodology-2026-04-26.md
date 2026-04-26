---
title: 上游 CE 更新同步到 spec-first 的常态化升级方法
date: 2026-04-26
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

### 1. 先固定输入范围

从用户给出的 CE range 或 git 输出中提取：

- 上游仓库路径，例如 `/Users/kuang/xiaobu/compound-engineering-plugin`。
- commit range，例如 `1284290a..e8c118e2`。
- 过滤规则，例如排除 `docs/`、`tests/`。
- 用户要求的输出形态，例如计划文档、直接实施、中文文档、独立 agent 审查。

然后用确定性命令拿事实：

```bash
git -C /path/to/compound-engineering-plugin diff --name-status <base>..<head>
git -C /path/to/compound-engineering-plugin diff -- <file>
```

不能抽样。过滤后的每个 CE 文件都必须进入同步判定表。

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
