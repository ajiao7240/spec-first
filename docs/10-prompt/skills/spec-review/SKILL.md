---
name: review-workflow
description: “使用分层角色代理、置信门控发现和合并/重复数据删除管道进行结构化代码审查。在创建 PR 之前审查代码更改时使用。”
argument-hint: "[mode:autofix|mode:report-only] [PR number, GitHub URL, or branch name]"
---

# 代码审查

使用动态选择的审阅者角色来审阅代码更改。生成返回结构化 JSON 的并行子代理，然后将结果合并并删除重复数据到单个报告中。

## 何时使用

- 创建 PR 之前
- 在迭代实施过程中完成任务后
- 当任何代码更改需要反馈时
- 可以独立调用
- 可以在较大的工作流程中作为只读或自动修复审核步骤运行

## 参数解析

解析 `$ARGUMENTS` 以获得以下可选标记。在将剩余部分解释为 PR 编号、GitHub URL 或分支名称之前，先剥离每个已识别的标记。

| 代币 | 例子 | 影响 |
|-------|---------|--------|
| `mode:autofix` | `mode:autofix` | 选择自动修复模式（请参阅下面的模式检测） |
| `mode:report-only` | `mode:report-only` | 选择仅报告模式 |
| `base:<sha-or-ref>` | `base:abc1234` 或 `base:origin/main` | 跳过范围检测 - 直接使用它作为 diff 基础 |
| `plan:<path>` | `plan:docs/plans/2026-03-25-001-feat-foo-plan.md` | 加载此计划以进行需求验证 |

所有标记都是可选的。每一件礼物都意味着少一件需要推断的事情。当缺席时，回到该阶段的现有行为。

## 模式检测

| 模式 | 什么时候 | 行为 |
|------|------|----------|
| **交互式**（默认） | 不存在模式令牌 | 审查、展示调查结果、在需要时要求做出政策决定，并可选择继续执行修复/推送/公关后续步骤 |
| **自动修复** | 参数中的 `mode:autofix` | 没有用户交互。审查，仅应用策略允许的 `safe_auto` 修复，在有限的轮次中重新审查，编写运行工件，并在需要时发出剩余的下游工作 |
| **仅供报告** | 参数中的 `mode:report-only` | 严格只读。仅审查和报告，然后停止，不进行任何编辑、工件、待办事项、提交、推送或 PR 操作 |

### 自动修复模式规则

- **跳过所有用户问题。** 一旦范围确定，切勿暂停等待批准或澄清。
- **仅应用`safe_auto -> review-fixer`调查结果。**让`gated_auto`、`manual`、`human`和`release`工作悬而未决。
- **在 `.context/spec-first/spec-review/<run-id>/` 下编写运行工件**，总结发现结果、应用的修复、剩余的可操作工作和咨询输出。
- **仅为未解决的可操作结果创建持久的待办事项文件**，其最终所有者是`downstream-resolver`。加载规范目录路径和命名约定的 `todo-create` 技能。
- **切勿从自动修复模式提交、推送或创建 PR**。父工作流拥有这些决策。

### 仅报告模式规则

- **跳过所有用户问题。** 如果差异元数据很薄，则保守地推断意图。
- **切勿编辑文件或外部化工作。** 不要编写 `.context/spec-first/spec-review/<run-id>/`，不要创建待办事项文件，也不要提交、推送或创建 PR。
- **并行只读验证是安全的。** `mode:report-only` 是唯一可以在同一结帐时与浏览器测试同时安全运行的模式。
- **不要切换共享签出。** 如果调用者传递显式 PR 或分支目标，则 `mode:report-only` 必须在隔离的签出/工作树中运行或停止，而不是运行 `gh pr checkout` / `git checkout`。
- **不要在同一签出中将变异审查与浏览器测试重叠。** 如果未来的编排器想要修复，请在浏览器测试后或在隔离的签出/工作树中运行变异审查阶段。

## 严重程度

所有审稿人都使用 P0-P3：

| 等级 | 意义 | 行动 |
|-------|---------|--------|
| **P0** | 严重破坏、可利用漏洞、数据丢失/损坏 | 合并前必须修复 |
| **P1** | 正常使用中可能会出现高影响缺陷，从而违反合同 | 应该修复 |
| **P2** | 具有重大缺点的中等问题（边缘情况、性能回归、可维护性陷阱） | 如果简单则修复 |
| **P3** | 影响低、范围窄、改进较小 | 用户自行决定 |

## 动作路由

严重性回答**紧急**。路由答案**谁接下来行动**以及**此技能是否会改变结账**。

| `autofix_class` | 默认所有者 | 意义 |
|-----------------|---------------|---------|
| `safe_auto` | `review-fixer` | 当当前模式允许突变时，适合熟练修复者的本地确定性修复 |
| `gated_auto` | `downstream-resolver` 或 `human` | 存在具体修复，但它更改了默认情况下不应自动应用的行为、合同、权限或其他敏感边界 |
| `manual` | `downstream-resolver` 或 `human` | 应该移交而不是固定在技能中的可行工作 |
| `advisory` | `human` 或 `release` | 仅报告输出，例如经验教训、部署说明或残余风险 |

路由规则：

- **综合拥有最终的路由。** Persona提供的路由元数据是输入，而不是最后的决定。
- **对于分歧，选择更保守的路线。** 合并的发现可能会从 `safe_auto` 移动到 `gated_auto` 或 `manual`，但如果没有更有力的证据，绝不会以其他方式移动。
- **只有`safe_auto -> review-fixer`自动进入技能修复者队列。**
- **`requires_verification: true` 意味着如果没有有针对性的测试、有针对性的重新审查或操作验证，修复是不完整的。**

## 审稿人

分层条件中的 15 个审稿人角色，以及特定于 CE 的代理。有关完整目录，请参阅下面包含的角色目录。

**始终在线（每次评论）：**

| 代理人 | 重点 |
|-------|-------|
| `spec-first:review:correctness-reviewer` | 逻辑错误、边缘情况、状态错误、错误传播 |
| `spec-first:review:testing-reviewer` | 覆盖范围差距、弱断言、脆弱测试 |
| `spec-first:review:maintainability-reviewer` | 耦合、复杂性、命名、死代码、抽象债务 |
| `spec-first:review:project-standards-reviewer` | CLAUDE.md 和 AGENTS.md 合规性 - frontmatter、引用、命名、可移植性 |
| `spec-first:review:agent-native-reviewer` | 验证新功能是否可供代理访问 |
| `spec-first:research:learnings-researcher` | 搜索 docs/solutions/ 以查找与此 PR 相关的过去问题 |

**横切条件（根据差异选择）：**

| 代理人 | 当 diff 接触时选择... |
|-------|---------------------------|
| `spec-first:review:security-reviewer` | 身份验证、公共端点、用户输入、权限 |
| `spec-first:review:performance-reviewer` | 数据库查询、数据转换、缓存、异步 |
| `spec-first:review:api-contract-reviewer` | 路由、序列​​化器、类型签名、版本控制 |
| `spec-first:review:data-migrations-reviewer` | 迁移、架构更改、回填 |
| `spec-first:review:reliability-reviewer` | 错误处理、重试、超时、后台作业 |
| `spec-first:review:adversarial-reviewer` | Diff >=50 更改的非测试/非生成/非锁定文件行，或身份验证、支付、数据突变、外部 API |

**特定于堆栈的条件（根据差异选择）：**

| 代理人 | 当 diff 接触时选择... |
|-------|---------------------------|
| `spec-first:review:dhh-rails-reviewer` | Rails 架构、服务对象、会话/身份验证选择或 Hotwire-vs-SPA 边界 |
| `spec-first:review:kieran-rails-reviewer` | 约定、命名和可维护性发挥作用的 Rails 应用程序代码 |
| `spec-first:review:kieran-python-reviewer` | Python 模块、端点、脚本或服务 |
| `spec-first:review:kieran-typescript-reviewer` | TypeScript 组件、服务、挂钩、实用程序或共享类型 |
| `spec-first:review:julik-frontend-races-reviewer` | Stimulus/Turbo 控制器、DOM 事件、计时器、动画或异步 UI 流 |

**CE 条件（特定于迁移）：**

| 代理人 | 当 diff 包含迁移文件时选择 |
|-------|------------------------------------------|
| `spec-first:review:schema-drift-detector` | 针对包含的迁移交叉引用 schema.rb |
| `spec-first:review:deployment-verification-agent` | 生成带有 SQL 验证查询的部署清单 |

## 审查范围

每次审核都会生成所有 4 个始终在线的角色以及 2 个 CE 始终在线的代理，然后添加适合差异的横切和特定于堆栈的条件。该模型自然会调整大小：一个小的配置更改会触发 0 个条件 = 6 个审阅者。 Rails 身份验证功能可能会触发安全性 + 可靠性 + kieran-rails + dhh-rails = 10 个审阅者。

## 受保护的文物

以下路径是规范优先的管道工件，任何审阅者都不得将其标记为删除、删除或 gitignore：

- `docs/brainstorms/*` -- 由spec:brainstorm 创建的需求文档
- `docs/plans/*.md` -- 由 spec:plan 创建的计划文件（带有进度复选框的活动文档）
- `docs/solutions/*.md` -- 在管道期间创建的解决方案文档

如果审阅者标记这些目录中的任何文件以进行清理或删除，请在综合过程中丢弃该发现。

## 如何跑步

### 第一阶段：确定范围

计算差异范围、文件列表和差异。通过组合成尽可能少的命令来最小化权限提示。

**如果提供 `base:` 参数（快速路径）：**

调用者已经知道 diff 基数。跳过所有基分支检测、远程解析和合并基计算。直接使用提供的值：

```
BASE_ARG="{base_arg}"
BASE=$(git merge-base HEAD "$BASE_ARG" 2>/dev/null) || BASE="$BASE_ARG"
```

然后产生与其他路径相同的输出：

```
echo "BASE:$BASE" && echo "FILES:" && git diff --name-only $BASE && echo "DIFF:" && git diff -U10 $BASE && echo "UNTRACKED:" && git ls-files --others --exclude-standard
```

该路径适用于任何引用 - SHA、`origin/main`、分支名称。自动调用者（spec:work、lfg、slfg）应该更喜欢这样做，以避免检测开销。 **不要将 `base:` 与 PR 编号或分支目标组合。** 如果两者都存在，则停止并显示错误：“不能将 `base:` 与 PR 编号或分支目标一起使用 - `base:` 意味着当前结帐已经是正确的分支。单独传递 `base:`，或单独传递目标并让范围检测解析基数。”这可以避免范围/意图不匹配，即差异基础来自一个源，但代码和元数据来自另一个源。

**如果提供 PR 编号或 GitHub URL 作为参数：**

如果 `mode:report-only` 处于活动状态，请不要**在共享结账上运行 `gh pr checkout <number-or-url>`。告诉调用者：“mode:report-only 无法切换共享签出来审查 PR 目标。从该 PR 的隔离工作树/签出中运行它，或者在已签出的分支上运行不带目标参数的仅报告。”除非评论已经在单独的结帐中运行，否则请在此停止。

首先，在切换分支之前验证工作树是否干净：

```
git status --porcelain
```

如果输出非空，则通知用户：“您在当前分支上有未提交的更改。在查看 PR 之前存储或提交它们，或使用独立模式（无参数）按原样查看当前分支。”在工作树干净之前不要继续结账。

然后检查 PR 分支，以便角色代理可以读取实际代码（而不是当前的检查）：

```
gh pr checkout <number-or-url>
```

然后获取 PR 元数据。捕获基本分支名称和 PR 基本存储库标识，而不仅仅是分支名称：

```
gh pr view <number-or-url> --json title,body,baseRefName,headRefName,url
```

使用返回的 PR URL 的存储库部分作为 `<base-repo>`（例如 `https://github.com/sunrain520/spec-first/pull/348` 中的 `sunrain520/spec-first`）。

然后根据 PR 的基础分支计算本地差异，以便重新审查还包括本地修复提交和未提交的编辑。替换来自元数据的 PR 基础分支（此处显示为 `<base>`）和从 PR URL 派生的 PR 基础存储库标识（此处显示为 `<base-repo>`）。从 PR 的实际基础存储库解析基本引用，而不是假设 `origin` 指向该存储库：

```
PR_BASE_REMOTE=$(git remote -v | awk 'index($2, "github.com:<base-repo>") || index($2, "github.com/<base-repo>") {print $1; exit}')
if [ -n "$PR_BASE_REMOTE" ]; then PR_BASE_REMOTE_REF="$PR_BASE_REMOTE/<base>"; else PR_BASE_REMOTE_REF=""; fi
PR_BASE_REF=$(git rev-parse --verify "$PR_BASE_REMOTE_REF" 2>/dev/null || git rev-parse --verify <base> 2>/dev/null || true)
if [ -z "$PR_BASE_REF" ]; then
  if [ -n "$PR_BASE_REMOTE_REF" ]; then
    git fetch --no-tags "$PR_BASE_REMOTE" <base>:refs/remotes/"$PR_BASE_REMOTE"/<base> 2>/dev/null || git fetch --no-tags "$PR_BASE_REMOTE" <base> 2>/dev/null || true
    PR_BASE_REF=$(git rev-parse --verify "$PR_BASE_REMOTE_REF" 2>/dev/null || git rev-parse --verify <base> 2>/dev/null || true)
  else
    if git fetch --no-tags https://github.com/<base-repo>.git <base> 2>/dev/null; then
      PR_BASE_REF=$(git rev-parse --verify FETCH_HEAD 2>/dev/null || true)
    fi
    if [ -z "$PR_BASE_REF" ]; then PR_BASE_REF=$(git rev-parse --verify <base> 2>/dev/null || true); fi
  fi
fi
if [ -n "$PR_BASE_REF" ]; then BASE=$(git merge-base HEAD "$PR_BASE_REF" 2>/dev/null) || BASE=""; else BASE=""; fi
```

```
if [ -n "$BASE" ]; then echo "BASE:$BASE" && echo "FILES:" && git diff --name-only $BASE && echo "DIFF:" && git diff -U10 $BASE && echo "UNTRACKED:" && git ls-files --others --exclude-standard; else echo "ERROR: Unable to resolve PR base branch <base> locally. Fetch the base branch and rerun so the review scope stays aligned with the PR."; fi
```

从 `gh pr view` 中提取 PR 标题/正文、基本分支和 PR URL，然后从本地命令中提取基本标记、文件列表、差异内容和 `UNTRACKED:` 列表。不要使用 `gh pr diff` 作为签出后的审核范围 - 它仅反映远程 PR 状态，并且会错过本地修复提交，直到它们被推送。如果在尝试获取之后仍然无法从 PR 的实际基础存储库解析基础引用，请停止而不是回退到 `git diff HEAD`；没有 PR 基础分支的 PR 审查是不完整的。

**如果提供分支名称作为参数：**

检查指定的分支，然后将其与基础分支进行比较。替换提供的分支名称（此处显示为 `<branch>`）。

如果 `mode:report-only` 处于活动状态，请不要**在共享结账上运行 `git checkout <branch>`。告诉调用者：“mode:report-only 无法切换共享签出以查看另一个分支。从 `<branch>` 的独立工作树/签出运行它，或者在没有目标参数的情况下在当前签出上运行仅报告。”除非评论已经在单独的结帐中运行，否则请在此停止。

首先，在切换分支之前验证工作树是否干净：

```
git status --porcelain
```

如果输出非空，则通知用户：“您在当前分支上有未提交的更改。在查看另一个分支之前存储或提交它们，或者提供 PR 号。”在工作树干净之前不要继续结账。

```
git checkout <branch>
```

然后检测评论基础分支并计算合并基础。运行 `references/resolve-base.sh` 脚本，该脚本通过多重后备检测处理分叉安全远程解析（PR 元数据 -> `origin/HEAD` -> `gh repo view` -> 公共分支名称）：

```
RESOLVE_OUT=$(bash references/resolve-base.sh) || { echo "ERROR: resolve-base.sh failed"; exit 1; }
if [ -z "$RESOLVE_OUT" ] || echo "$RESOLVE_OUT" | grep -q '^ERROR:'; then echo "${RESOLVE_OUT:-ERROR: resolve-base.sh produced no output}"; exit 1; fi
BASE=$(echo "$RESOLVE_OUT" | sed 's/^BASE://')
```

如果脚本输出错误，请停止而不是退回到 `git diff HEAD`;没有基础分支的分支审查只会显示未提交的更改并默默地错过所有已提交的工作。

成功后，生成差异：

```
echo "BASE:$BASE" && echo "FILES:" && git diff --name-only $BASE && echo "DIFF:" && git diff -U10 $BASE && echo "UNTRACKED:" && git ls-files --others --exclude-standard
```

您仍然可以使用 `gh pr view` 获取标题、正文和链接问题的其他 PR 元数据，但如果不存在 PR，也不会失败。

**如果没有参数（在当前分支上独立）：**

检测审查基础分支并使用与分支模式相同的 `references/resolve-base.sh` 脚本计算合并基础：

```
RESOLVE_OUT=$(bash references/resolve-base.sh) || { echo "ERROR: resolve-base.sh failed"; exit 1; }
if [ -z "$RESOLVE_OUT" ] || echo "$RESOLVE_OUT" | grep -q '^ERROR:'; then echo "${RESOLVE_OUT:-ERROR: resolve-base.sh produced no output}"; exit 1; fi
BASE=$(echo "$RESOLVE_OUT" | sed 's/^BASE://')
```

如果脚本输出错误，请停止而不是退回到 `git diff HEAD`;没有基础分支的独立审查只会显示未提交的更改，并默默地错过分支上所有已提交的工作。

成功后，生成差异：

```
echo "BASE:$BASE" && echo "FILES:" && git diff --name-only $BASE && echo "DIFF:" && git diff -U10 $BASE && echo "UNTRACKED:" && git ls-files --others --exclude-standard
```

使用 `git diff $BASE`（不带 `..HEAD`）将合并基础与工作树进行比较，其中包括已提交、暂存和未暂存的更改。

**未跟踪的文件处理：** 始终检查 `UNTRACKED:` 列表，即使 `FILES:`/`DIFF:` 非空。未跟踪的文件在暂存之前不在审核范围内。如果列表非空，则告诉用户哪些文件被排除。如果需要审查其中任何一个，请停止并告诉用户首先`git add`然后重新运行。仅当用户有意查看跟踪的更改时才继续。

### 第二阶段：意图发现

了解变革想要实现的目标。意图的来源取决于所采取的第一阶段路径：

**PR/URL 模式：** 使用 `gh pr view` 元数据中的 PR 标题、正文和链接问题。如果正文稀疏，请补充来自 PR 的提交消息。

**分支模式：** 使用第 1 阶段解析的合并基础运行 `git log --oneline ${BASE}..<branch>`。

**独立（当前分支）：** 运行：

```
echo "BRANCH:" && git rev-parse --abbrev-ref HEAD && echo "COMMITS:" && git log --oneline ${BASE}..HEAD
```

结合对话上下文（计划部分摘要、PR 描述），写出 2-3 行意图摘要：

```
Intent: Simplify tax calculation by replacing the multi-tier rate lookup
with a flat-rate computation. Must not regress edge cases in tax-exempt handling.
```

在生成提示中将其传递给每个审阅者。意图决定了*每个审稿人看起来有多努力*，而不是选择了哪些审稿人。

**当意图不明确时：**

- **交互模式：** 使用平台的交互问题工具（Claude Code 中的 AskUserQuestion、Codex 中的 request_user_input）提出一个问题：“这些更改的主要目标是什么？”在意图确定之前不要催生审阅者。
- **自动修复/仅报告模式：** 从分支名称、差异、PR 元数据和调用者上下文保守地推断意图。请注意覆盖或判决推理中的不确定性，而不是阻塞。

### 阶段 2b：计划发现（需求验证）

找到计划文档，以便第 6 阶段可以验证需求的完整性。按优先顺序检查这些来源 - 在第一次点击时停止：

1. **`plan:` 参数。** 如果调用者传递了计划路径，则直接使用它。读取该文件以确认其存在。
2. **PR 正文。** 如果在第 1 阶段获取 PR 元数据，请扫描正文以查找匹配 `docs/plans/*.md` 的路径。如果恰好找到一个匹配项并且该文件存在，则将其用作 `plan_source: explicit`。如果出现多个计划路径，则视为不明确 - 对于磁盘上存在的最新匹配，降级为 `plan_source: inferred`，或者如果不存在或没有与 PR 标题/意图明确相关的则跳过。使用前务必验证所选文件是否存在 - PR 描述中陈旧或复制的计划链接很常见。
3. **自动发现。** 从分支名称中提取 2-3 个关键字（例如，`feat/onboarding-skill` -> `onboarding`、`skill`）。 Glob `docs/plans/*` 并过滤包含这些关键字的文件名。如果恰好有一个匹配，则使用它。如果多个匹配项或匹配项看起来不明确（例如，`review`、`fix`、`update` 等通用关键字可能会命中多个计划），**跳过自动发现** - 错误的计划比没有计划更糟糕。如果零个匹配，则跳过。

**置信度标记：** 记录如何找到计划：
- `plan:` 参数 -> `plan_source: explicit` （高置信度）
- 单一明确的 PR 正文匹配 -> `plan_source: explicit`（高置信度）
- 多个/不明确的 PR 正文匹配 -> `plan_source: inferred`（置信度较低）
- 使用单个明确匹配自动发现 -> `plan_source: inferred`（较低置信度）

如果找到计划，请阅读其**需求跟踪**（R1、R2 等）和**实施单元**（复选框项）。存储提取的需求列表和第 6 阶段的 `plan_source`。如果未找到计划，请勿阻止审核 - 需求验证是附加的，不是必需的。

### 第三阶段：选择审稿人

读取第 1 阶段的差异和文件列表。4 个始终在线的角色和 2 个 CE 始终在线的代理是自动的。对于下面包含的角色目录中的每个横切和特定于堆栈的条件角色，确定差异是否值得。这是代理判断，而不是关键字匹配。

堆栈特定的角色是累加的。 Rails UI 更改可能需要 `kieran-rails` 加上 `julik-frontend-races`； TypeScript API diff 可能需要 `kieran-typescript` 加上 `api-contract` 和 `reliability`。

对于 CE 条件代理，检查差异是否包含与 `db/migrate/*.rb`、`db/schema.rb` 或数据回填脚本匹配的文件。

在生成前宣布团队：

```
Review team:
- correctness (always)
- testing (always)
- maintainability (always)
- project-standards (always)
- agent-native-reviewer (always)
- learnings-researcher (always)
- security -- new endpoint in routes.rb accepts user-provided redirect URL
- kieran-rails -- controller and Turbo flow changed in app/controllers and app/views
- dhh-rails -- diff adds service objects around ordinary Rails CRUD
- data-migrations -- adds migration 20260303_add_index_to_orders
- schema-drift-detector -- migration files present
```

这是进度报告，而不是阻塞确认。

### 第 3b 阶段：发现项目标准路径

在生成子代理之前，找到 `project-standards` 角色的所有相关标准文件的文件路径（不是内容）。使用本机文件搜索/glob 工具来定位：

1. 使用本机文件搜索工具（例如 Claude Code 中的 Glob）查找存储库中的所有 `**/CLAUDE.md` 和 `**/AGENTS.md`。
2. 筛选出其目录是至少一个已更改文件的祖先的目录。标准文件管理其下面的所有文件（例如，`plugins/spec-first/AGENTS.md` 适用于 `plugins/spec-first/` 下的所有文件）。

将生成的路径列表传递到其审阅上下文中 `<standards-paths>` 块内的 `project-standards` 角色（参见第 4 阶段）。角色本身读取文件，仅定位与更改的文件类型相关的部分。这使得编排器的工作成本较低（仅路径发现），并避免子代理提示中包含审阅者可能不完全需要的内容。

### 第四阶段：产生子代理

使用下面包含的子代理模板将每个选定的角色审阅者生成为并行子代理。每个角色子代理接收：

1. 他们的角色文件内容（身份、故障模式、校准、抑制条件）
2. 下面包含的 diff-scope 参考中的共享 diff-scope 规则
3. 下面包含的结果架构的 JSON 输出契约
4. 审查上下文：意图摘要、文件列表、差异
5. **仅适用于 `project-standards`：** 第 3b 阶段的标准文件路径列表，包含在附加到审阅上下文的 `<standards-paths>` 块中

Persona 子代理是**只读**：它们审查并返回结构化 JSON。他们不编辑文件或提出重构建议。

此处的只读意味着**非变异**，而不是“无 shell 访问权限”。当需要收集证据或验证范围时，审核子代理可以使用非变异检查命令，包括面向读取的 `git` / `gh` 用法，例如 `git diff`、`git show`、`git blame`、`git log` 和 `gh pr view`。他们不得编辑文件、更改分支、提交、推送、创建 PR 或以其他方式改变签出或存储库状态。

每个角色子代理返回与下面包含的结果架构匹配的 JSON：

```json
{
  "reviewer": "security",
  "findings": [...],
  "residual_risks": [...],
  "testing_gaps": [...]
}
```

**CE 始终在线代理**（代理本机审阅者、学习研究人员）作为标准代理调用与角色代理并行调度。为他们提供与角色接收的相同的审查上下文包：输入模式、在第 1 阶段收集的任何 PR 元数据、意图摘要、已知的审查基本分支名称、`BASE:` 标记、文件列表、差异和 `UNTRACKED:` 范围注释。不要使用通用的“查看此”提示来调用它们。它们的输出是非结构化的，并在第 6 阶段单独合成。

**CE 条件代理**（架构漂移检测器、部署验证代理）在适用时也会作为标准代理调用进行调度。传递相同的审核上下文包以及适用性原因（例如，哪些迁移文件触发了代理）。特别是对于模式漂移检测器，显式传递已解析的审查基础分支，因此它永远不会假设 `main`。它们的输出是非结构化的，必须保留以用于第 6 阶段的合成，就像 CE 始终在线代理一样。

### 第五阶段：合并结果

将多个审阅者 JSON 有效负载转换为一个经过重复删除、置信度控制的结果集。

1. **验证。** 根据架构检查每个输出。删除格式错误的结果（缺少必填字段）。记录掉落数。
2. **置信门。** 将结果抑制在 0.60 置信度以下。记录抑制计数。这符合角色说明：低于 0.60 的结果是噪音，不应在合成中幸存。
3. **重复数据删除。** 计算指纹：`normalize(file) + line_bucket(line, +/-3) + normalize(title)`。当指纹匹配时，合并：保持最高的严重性，用最强的证据保持最高的置信度，联合证据，注意哪些评论者标记了它。
4. **单独现有的。** 将带有 `pre_existing: true` 的结果提取到单独的列表中。
5. **标准化路由。** 对于每个合并的结果，设置最终的 `autofix_class`、`owner` 和 `requires_verification`。如果审稿人不同意，请保留最保守的路线。综合可以将发现范围从`safe_auto`缩小到`gated_auto`或`manual`，但在没有新证据的情况下不得扩大范围。
6. **划分工作。**构建三组：
   - 技能修复者队列：仅`safe_auto -> review-fixer`
   - 剩余可操作队列：未解决的 `gated_auto` 或 `manual` 结果，其所有者是 `downstream-resolver`
   - 仅报告队列：`advisory` 调查结果以及 `human` 或 `release` 拥有的任何内容
7. **排序** 按严重性排序（首先是 P0）-> 置信度（降序）-> 文件路径 -> 行号。
8. **收集覆盖率数据。** 合并审阅者之间的残差风险和测试差距。
9. **保留 CE 代理工件。** 将学习、代理本机、模式漂移和部署验证输出与合并的结果集一起保留。不要仅仅因为非结构化代理输出与角色 JSON 架构不匹配而删除它。

### 第六阶段：综合和呈现

使用下面包含的审核输出模板组装最终报告：

1. **标题。** 范围、意图、模式、审核团队以及每个条件的理由。
2. **结果。** 按严重程度分组（P0、P1、P2、P3）。每个发现都会显示文件、问题、审阅者、置信度和综合路径。
3. **要求完整性。** 仅当在第 2b 阶段找到计划时才包括在内。对于计划中的每个需求（R1、R2 等）和实施单元，报告相应的工作是否出现在 diff 中。使用简单的清单：已满足/未解决/部分解决。路由取决于 `plan_source`：
   - **`explicit`**（调用者提供的或 PR 机构）：使用 `autofix_class: manual`、`owner: downstream-resolver` 将未解决的需求标记为 P1 结果。这些进入剩余可操作队列并且可以成为待办事项。
   - **`inferred`**（自动发现）：使用 `autofix_class: advisory`、`owner: human` 将未解决的需求标记为 P3 发现。这些只保留在报告中——没有待办事项，没有自主的后续行动。推断的计划匹配是一种暗示，而不是合同。
如果没有找到计划，请完全忽略这一部分——不要提及没有计划。
4. **应用的修复。** 仅当修复阶段在此调用中运行时才包含。
5. **剩余的可操作工作。** 包括何时移交或应该移交未解决的可操作调查结果。
6. **预先存在。**单独的部分，不计入判决。
7. **学习和过去的解决方案。** 表面学习研究人员的结果：如果过去的解决方案相关，请将它们标记为“已知模式”并链接到文档/解决方案/文件。
8. **代理-本地差距。**表面代理-本地-审阅者结果。如果没有发现间隙，则省略该部分。
9. **架构漂移检查。** 如果 schema-drift- detector 运行，总结是否发现漂移。如果存在偏差，请列出不相关的架构对象和所需的清理命令。如果干净的话，简单地说一下。
10. **部署说明。** 如果部署验证代理运行，请显示关键的执行/不执行项目：阻止预部署检查、最重要的验证查询、回滚警告和监视重点区域。保持清单可操作性，而不是将其放入覆盖范围中。
11. **覆盖范围。** 抑制计数、残余风险、测试差距、失败/超时的审阅者以及非交互模式带来的任何意图不确定性。
12. **结论。** 准备合并/准备好修复/未准备好。修复订单（如果适用）。当 `explicit` 计划有未解决的需求时，判决必须反映它 - 代码干净但缺少计划需求的 PR 是“未准备好”，除非遗漏是故意的。当 `inferred` 计划有未解决的要求时，请在判决推理中注明，但不要单独阻止它。

不包括时间估计。

## 质量门

在提交审核之前，请验证：

1. **每项发现都是可行的。** 重新阅读每项发现。如果它说“考虑”、“可能想要”或“可以改进”而没有具体的修复，则用特定的操作重写它。模糊的发现浪费了工程时间。
2. **浏览不会出现误报。** 对于每个发现，验证周围的代码是否确实被读取。检查同一函数中的其他地方是否未处理“错误”，类型注释中是否未使用“未使用的导入”，调用者是否未保护“缺少空检查”。
3. **严重性已校准。** 风格 nit 绝不是 P0。 SQL 注入绝不是 P3。重新检查每个严重性分配。
4. **行号准确。** 根据文件内容验证每个引用的行号。指向错误路线的发现比没有发现更糟糕。
5. **尊重受保护的工件。** 放弃任何建议删除或忽略 `docs/brainstorms/`、`docs/plans/` 或 `docs/solutions/` 中文件的发现。
6. **结果不会重复 linter 输出。** 不要标记项目的 linter/格式化程序会捕获的内容（缺少分号、错误缩进）。关注语义问题。

## 语言感知条件

当差异明确需要时，此技能会使用特定于堆栈的审阅代理。让这些特工保持固执己见。它们不是通用语言检查器；而是通用语言检查器。他们在始终在线和交叉的角色之上添加了独特的审查镜头。

不要仅根据文件扩展名机械地生成它们。触发器是该堆栈中有意义的行为、架构或 UI 状态的更改。

## 审核后

### 模式驱动的审后流程

提出调查结果和结论（第 6 阶段）后，按模式安排后续步骤。每种模式下的回顾和综合都保持不变；只有突变和切换行为发生变化。

#### 第 1 步：构建操作集

- **干净审查**意味着压制和预先存在的分离后的零发现。当审查干净后，跳过修复/移交阶段。
- **修复者队列：** 最终结果发送至 `safe_auto -> review-fixer`。
- **剩余可操作队列：** 未解决的 `gated_auto` 或 `manual` 结果，其最终所有者是 `downstream-resolver`。
- **仅报告队列：** `advisory` 结果以及 `human` 或 `release` 拥有的任何输出。
- **切勿将仅咨询的输出转换为修复工作或待办事项。** 部署说明、残余风险和版本拥有的项目保留在报告中。

#### 步骤2：按模式选择策略

**互动模式**

- 仅当存在可操作的工作时才提出单一政策问题。
- 推荐默认值：

````
我应该如何处理可操作的发现？
  1. 应用 safe_auto 修复并将其余部分作为剩余工作（推荐）
  2. 仅应用 safe_auto 修复
  3. 仅审查报告
````

- 根据实际行动设置提示。如果修复程序队列为空，则不要提供“应用安全自动修复”选项。询问是否将剩余的可操作工作外部化或仅保留审核报告。
- 仅在用户明确批准特定项目后，才将 `gated_auto` 结果包含在修复程序队列中。不要仅根据严重性来扩大队列。

**自动修复模式**

- 不要问任何问题。
- 仅应用 `safe_auto -> review-fixer` 队列。
- 保留 `gated_auto`、`manual`、`human` 和 `release` 项目未解决。
- 仅针对最终所有者为 `downstream-resolver` 的未解决的可操作调查结果准备剩余工作。

**仅报告模式**

- 不要问任何问题。
- 不要构建修复程序队列。
- 不要创建残留的待办事项或 `.context` 工件。
- 第 6 阶段后停止。所有内容都保留在报告中。

#### 第 3 步：使用一个修复程序和有限的回合来应用修复

- 在当前结账中为当前修复程序队列生成一个修复程序子代理。该修复程序应用所有已批准的更改，并针对一致的树一次性运行相关的目标测试。
- 不要在同一结账时分散多个修复者。并行修复程序需要隔离的工作树/分支和有意的合并。
- 修复土地后仅重新审查更改的范围。
- 用 `max_rounds: 2` 绑定循环。如果第二轮后问题仍然存在，请停止并将其作为剩余工作移交或报告为未解决。
- 如果任何已应用的发现具有 `requires_verification: true`，则在目标验证运行之前，该轮是不完整的。
- 不要在同一结帐时与浏览器测试同时启动变异审核轮次。想要两者的未来编排器必须在并行阶段运行 `mode:report-only` 或将变异审查隔离在自己的结账/工作树中。

#### 第 4 步：发出工件和下游切换

- 在交互和自动修复模式下，在 `.context/spec-first/spec-review/<run-id>/` 下编写每次运行的工件，其中包含：
  - 综合研究结果
  - 应用修复
  - 剩余可操作工作
  - 仅供咨询的产出
- 在自动修复模式下，仅针对未解决的可操作结果创建持久待办事项文件，其最终所有者为 `downstream-resolver`。加载规范目录路径、命名约定、YAML frontmatter 结构和模板的 `todo-create` 技能。每个待办事项应将发现的严重性映射到待办事项优先级（`P0`/`P1` -> `p1`、`P2` -> `p2`、`P3` -> `p3`）并设置 `status: ready`，因为这些发现已通过综合进行分类。
- 请勿为 `advisory` 结果、`owner: human`、`owner: release` 或受保护工件清理建议创建待办事项。
- 如果只剩下咨询输出，则不要创建待办事项。
- 交互模式可以提供修复后剩余的可操作工作的具体化，但不需要完成审查。

#### 第 5 步：最后的后续步骤

**仅限交互模式：**修复审核周期完成后（干净的判决或用户选择停止），根据输入模式提供后续步骤。重用已知的第 1 阶段已解决的审核基础/默认分支；不要仅硬编码 `main`/`master`。

- **PR模式（通过PR号码/URL输入）：**
  - **推送修复**——推送提交到现有的 PR 分支
  - **退出** -- 暂时完成
- **分支模式（没有 PR 的功能分支，而不是已解决的审核基础/默认分支）：**
  - **创建 PR（推荐）** -- 推送并打开拉取请求
  - **没有 PR 继续**——留在分支上
  - **退出** -- 暂时完成
- **在已解决的审核基础/默认分支上：**
  - **继续** -- 继续后续步骤
  - **退出** -- 暂时完成

如果“创建 PR”：首先使用 `git push --set-upstream origin HEAD` 发布分支，然后使用 `gh pr create` 以及从分支更改派生的标题和摘要。
如果“推送修复”：使用 `git push` 推送分支以更新现有 PR。

**自动修复和仅报告模式：** 在报告、工件发射和剩余工作切换后停止。不要提交、推送或创建 PR。

## 倒退

如果平台不支持并行子代理，请按顺序运行审阅者。其他一切（阶段、输出格式、合并管道）保持不变。

---

## 包含的参考资料

### 角色目录

@./references/persona-catalog.md

### 子代理模板

@./references/subagent-template.md

### 差异范围规则

@./references/diff-scope.md

### 调查结果架构

@./references/findings-schema.json

### 检查输出模板

@./references/review-output-template.md
