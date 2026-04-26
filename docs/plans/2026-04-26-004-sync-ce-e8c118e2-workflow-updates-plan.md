---
title: "sync: 同步 CE e8c118e2 Workflow 更新"
type: refactor
status: active
date: 2026-04-26
origin: CE 1284290a..e8c118e2 filtered to non-docs-tests files
---

# sync: 同步 CE e8c118e2 Workflow 更新

## 概览

本计划用于指导把 CE 上游 `1284290a..e8c118e2` 中适合 spec-first 的变更同步到当前项目。

本次分析遵守用户指定范围：

- 逐个查看 CE 更新中所有非 `docs/`、非 `tests/` 文件的具体 diff。
- 不处理 CE 的 `docs/` 和 `tests/` 目录变更。
- 同步时不能机械复制 CE 路径和命名，必须按 spec-first 当前项目结构做 `spec-` 前缀、技能命名和 host 语义适配。
- 输出的是实施计划，不直接改 workflow 源文件。

核心判断：大部分 skill/agent 行为改动值得同步；`ce-pr-description` 删除和 CE converter cleanup 不应机械同步；`ce-work` 的并行 worktree 模型需要按 spec-first 的 Codex/Claude host 能力重新表述。

## 审查后质量修正

本计划已经过本轮会话中的独立 agent 文档质量审查，并在后续人工复核中继续收紧。已接受并纳入本文的修正包括：

- 增加逐文件同步判定附录，避免目录级描述掩盖单文件 diff。
- 明确 PR description 的单一真相源：`spec-pr-description` 继续负责生成 PR title/body，`git-commit-push-pr` 只做薄委托和应用。
- 明确 work/work-beta host 能力矩阵，避免把 Claude Code worktree isolation 误套到 Codex delegation。
- 增加 `CHANGELOG.md` 治理实施单元。
- 把验证计划从“新增或更新测试”改成具体测试文件和断言清单。
- 收紧开放措辞，改成可执行条件。
- 补充 CE diff 文案级 before/after 依据，新增文件只索引路径，删除文件说明不机械同步原因。
- 收紧 U7：要求先做 PR description 写作能力 gap audit，再决定局部合并点。
- 收紧验证口径：一次性执行全量同步时，最低验证必须覆盖所有受影响实施单元，而不是只跑高风险子集。

---

## 已读取的 CE 文件范围

本次已逐项读取以下 CE 变更文件，排除了 `docs/` 和 `tests/`：

| CE 文件 | 处理状态 |
|---|---|
| `AGENTS.md` | 已读取，需按 spec-first 维护规则适配 |
| `plugins/compound-engineering/README.md` | 已读取，部分同步 |
| `plugins/compound-engineering/agents/ce-pr-comment-resolver.agent.md` | 已读取，需同步 |
| `plugins/compound-engineering/agents/ce-session-historian.agent.md` | 已读取，需同步 |
| `plugins/compound-engineering/skills/ce-code-review/**` | 已读取，需同步，属于重点 |
| `plugins/compound-engineering/skills/ce-commit-push-pr/**` | 已读取，需部分同步 |
| `plugins/compound-engineering/skills/ce-compound/**` | 已读取，需同步 |
| `plugins/compound-engineering/skills/ce-compound-refresh/**` | 已读取，需同步 |
| `plugins/compound-engineering/skills/ce-debug/SKILL.md` | 已读取，需同步但注意行为变化 |
| `plugins/compound-engineering/skills/ce-demo-reel/**` | 已读取，需同步到 `feature-video` |
| `plugins/compound-engineering/skills/ce-doc-review/**` | 已读取，需同步术语更新 |
| `plugins/compound-engineering/skills/ce-pr-description/SKILL.md` | 已读取，CE 删除；spec-first 不同步删除 |
| `plugins/compound-engineering/skills/ce-resolve-pr-feedback/SKILL.md` | 已读取，需同步 |
| `plugins/compound-engineering/skills/ce-session-inventory/**` | 已读取，需同步 |
| `plugins/compound-engineering/skills/ce-sessions/SKILL.md` | 已读取，需同步 |
| `plugins/compound-engineering/skills/ce-work/**` | 已读取，需按 host 能力适配 |
| `plugins/compound-engineering/skills/ce-work-beta/**` | 已读取，需按 host 能力适配 |
| `plugins/compound-engineering/skills/lfg/references/tracker-defer.md` | 已读取，需同步 artifact 路径 |
| `src/data/plugin-legacy-artifacts.ts` | 已读取，CE converter 专属，当前不直接同步 |
| `src/utils/legacy-cleanup.ts` | 已读取，CE converter 专属，当前不直接同步 |

---

## CE 原始 diff 更新内容详解

本节只记录 CE 上游在 `1284290a..e8c118e2` 中通过 `git diff` 看到的原始改动事实，不包含 spec-first 是否同步的判断。同步判断见后续“逐文件同步判定附录”和“明确改动点清单”。

diff 获取命令：

```bash
git -C /Users/kuang/xiaobu/compound-engineering-plugin diff 1284290a..e8c118e2 -- <file>
```

过滤规则：排除 CE 的 `docs/**` 和 `tests/**`。

### CE 仓库说明与资产清单

| CE 文件 | git diff 中的具体更新 |
|---|---|
| `AGENTS.md` | 新增 `Validating Agent and Skill Changes` 小节。核心内容是：Claude Code plugin 的 agent/skill prose 在 session start 缓存；同一 session 内用 typed agent 或 Skill 调用验证不到刚编辑的 prose；验证 agent/skill 行为变更应使用 `skill-creator` eval workflow，把当前源文件内容注入 fresh subagent；不要编辑 `~/.claude/plugins/cache/` 或 `~/.claude/plugins/marketplaces/`；脚本、parser、converter、测试仍读取当前源码，不受该缓存限制。 |
| `plugins/compound-engineering/README.md` | Skills 数量从 `42+` 改为 `35+`；删除 `ce-pr-description` 清单条目；`ce-commit-push-pr` 描述从“commit/push/open PR、更新已有 PR description，并委托 `ce-pr-description`”改为“也可只生成 PR description 而不 commit”；`/ce-polish-beta` 显示名改为 `ce-polish-beta`。 |

### CE agents

| CE 文件 | git diff 中的具体更新 |
|---|---|
| `plugins/compound-engineering/agents/ce-pr-comment-resolver.agent.md` | triage 决策树新增 `declined` verdict：当 reviewer 观点可能有道理，但建议修法会让代码变差时使用。diff 给出的有害修法包括违反 `CLAUDE.md`/`AGENTS.md`、添加无效 defensive code、吞掉应传播的错误、过早抽象、用注释复述代码。默认策略从“只有 reviewer 事实错误才 skip”改为“事实错误用 `not-addressing`，建议有害用 `declined`，不确定则修”。新增 `Declined: ...` 回复模板，返回 enum 增加 `declined`。 |
| `plugins/compound-engineering/agents/ce-session-historian.agent.md` | 新增强约束：禁止为了判断相关性而直接 `ce-session-extract`；extract 前必须已有 branch 精确匹配、branch 包含主题关键词、或 `ce-session-inventory --keyword` 返回 `match_count > 0`。新增时间预算：有完整答案就停，“no relevant prior sessions” 也是完整答案；抽取 3-5 个 session 后已有综合材料就停。repo name 解析从只判断 `.git` 改为区分 `git rev-parse --git-common-dir` 的绝对路径与相对路径，只有绝对路径才按 linked worktree 主 repo 处理。Step 3 重写为 branch filter -> keyword filter -> window/current-session filter -> 最多 5 个 deep-dive；`files_matched: 0` 时立即返回 no relevant prior sessions，不 extract。Step 4 改为只有 Step 3 选出 session 才 skeleton extract；tail extraction 从默认变为仅当 head 输出明显停在调查中途时才触发。 |

### CE code-review workflow

| CE 文件 | git diff 中的具体更新 |
|---|---|
| `plugins/compound-engineering/skills/ce-code-review/SKILL.md` | run artifact 路径从 `.context/compound-engineering/ce-code-review/<run-id>/` 全面迁到 `/tmp/compound-engineering/ce-code-review/<run-id>/`，覆盖 autofix、report-only、headless、run id mkdir、subagent artifact、detail enrichment 和最终输出。Stage 5 的 recommended action 从保守 tie-break 改为 `autofix_class + suggested_fix` 映射：`gated_auto/manual` 有 `suggested_fix` 推荐 Apply，无则 Defer，`advisory` Acknowledge；`safe_auto` 仍是自动处理。Stage 5b 表格改为 best-judgment 路径不再跑 validator pre-pass，理由是 fixer 会在 apply 时自然验证，失败进入 `failed` bucket。交互 option B 文案从 LFG 改为 `Auto-resolve with best judgment`，并改成直接 dispatch fixer，不走 bulk preview。option C 无 tracker 文案从 “tracker sink/platform” 改为面向开发者的“当前 checkout 未配置 issue tracker”。option A 的 “LFG the rest” 改为 best-judgment-the-rest，并保证只 dispatch 一次 fixer。新增 fixer 后 failed bucket 处理顺序：有 failed 时先问用户 file tickets / walk through / ignore，再输出 completion report。 |
| `plugins/compound-engineering/skills/ce-code-review/references/bulk-preview.md` | reference 从“LFG、File tickets、LFG the rest 三个 bulk action 的 preview”收缩为“只服务 File tickets option C”。明确 best-judgment path 不使用 bulk preview，因为本地 fix 可通过 diff/review撤销，只有 filing tickets 会产生 durable external state。示例从 `LFG plan` 改为 `File plan`，所有 finding 都进入 `Filing [TRACKER] tickets` bucket；Proceed 只执行 ticket creation；Cancel 回 routing question；no tracker 时 option C upstream 不提供，因此 preview 不会被调用。 |
| `plugins/compound-engineering/skills/ce-code-review/references/findings-schema.json` | `autofix_class` description 大幅扩展：`safe_auto` 定义为 local mechanical fix，需满足“一句话说清且不改变 function signature、public API/error contract、security posture、permission model”等条件；`gated_auto` 用于 contract/permission/module boundary 变化；`manual` 通常应配 `suggested_fix`；`advisory` 是 report-only。`suggested_fix` description 从“明显正确才写”改为“只要能从 diff、周边代码、parallel pattern、framework convention 给出可辩护代码改动，就应提供；不完整信息不是省略理由；省略仅限没有 code-level change 或纯组织决策”。 |
| `plugins/compound-engineering/skills/ce-code-review/references/subagent-template.md` | reviewer artifact 写入路径改到 `/tmp/compound-engineering/ce-code-review/{run_id}/{reviewer_name}.json`。`safe_auto` rubric 重写：强调 wrong-side cost 对称，机械 fix 被误分到 gated_auto 会让用户处理本可自动修的发现；列出 internal nil guard、parallel pattern off-by-one、scope 内 dead code removal、机械 helper extraction 等仍可 safe_auto 的边界案例。`manual` 规则改为能从 diff/周边代码 defend 时必须配 `suggested_fix`。`suggested_fix` 规则新增 grounded、concrete、imperfect information still propose、rare omit cases 等细则，并说明 manual 无 suggested_fix 会进入 best-judgment failed bucket。 |
| `plugins/compound-engineering/skills/ce-code-review/references/tracker-defer.md` | ticket body 读取 `why_it_matters` 的 artifact path 从 `.context/compound-engineering/...` 改为 `/tmp/compound-engineering/...`；body 超长截断时的 artifact pointer 同步改到 `/tmp/compound-engineering/ce-code-review/<run-id>/`。 |
| `plugins/compound-engineering/skills/ce-code-review/references/walkthrough.md` | 术语从 LFG 改为 best-judgment；artifact 读取和 full fix pointer 改到 `/tmp/compound-engineering/...`；per-finding option 4 改为 `Auto-resolve with best judgment on the rest`。新增“无 `suggested_fix` 时隐藏 Apply”规则，避免展示不可执行 Apply。no tracker 文案改成“当前 checkout 没配置 issue tracker”，避免 `tracker sink` 和 `platform` 术语。best-judgment-the-rest 从 Stage 5b + bulk preview 改为直接 dispatch fixer；fixer 失败后按 `SKILL.md` 的 failed bucket 处理问题继续。自然走完 walkthrough 时才 end-of-loop dispatch；best-judgment-the-rest 分支不再二次 dispatch。completion report 终态名称同步改为 best-judgment。 |

### CE PR / feedback workflow

| CE 文件 | git diff 中的具体更新 |
|---|---|
| `plugins/compound-engineering/skills/ce-commit-push-pr/SKILL.md` | description 扩展触发词，新增 “write/draft/describe PR description” 也由该 skill 处理。新增三类 intent：description-only generation、description update on existing PR、full workflow。description-only generation 会跳过 Step 1 full-workflow decision tree 的 stop gates、跳过 commit/push，只进入 Step 6 组合 PR title/body；如果用户粘贴 PR URL/number，则把它作为 PR ref 传入。Description Update workflow 不再调用 `ce-pr-description`，而是读取新 reference `references/pr-description-writing.md` 并执行 Pre-A + Steps A-H；保留 evidence block 判断，使用 quoted heredoc 写临时 body，再 `gh pr edit`。Full workflow 的 Step 6 改为读取 `pr-description-writing.md`，由 Pre-A 负责 base detection、PR ref、fork/API fallback 和 diff/commit list；Step 7 用 quoted heredoc 生成 body file 后 `gh pr create/edit`。 |
| `plugins/compound-engineering/skills/ce-commit-push-pr/references/pr-description-writing.md` | 新增 286 行 PR description 写作 reference。内容承接被删除的 `ce-pr-description` 核心逻辑：Pre-A 解析 current-branch / PR mode、PR URL/number、base override、existing PR body、fork PR 和 API-only fallback；后续步骤包含 commit 分类、evidence preservation/capture decision、before/after narrative frame、按变更规模选择 body 深度、writing voice、visual communication、GitHub issue 编号规则、focus hint、conventional-commit title、body assembly、Compound Engineering badge、compression pass。该 reference 是 `ce-commit-push-pr` 内部写作逻辑来源。 |
| `plugins/compound-engineering/skills/ce-pr-description/SKILL.md` | 整个 400 行独立 skill 被删除。被删 skill 原本是 standalone PR title/body 生成器：支持 current-branch mode、PR mode、`base:<ref>` override、返回 `{title, body_file}`，且不调用 `gh pr create/edit`，供 `ce-commit-push-pr` 和 `ce-pr-stack` 复用。CE 本次删除意味着写作逻辑迁入 `ce-commit-push-pr/references/pr-description-writing.md`。 |
| `plugins/compound-engineering/skills/ce-resolve-pr-feedback/SKILL.md` | 在“Agent time is cheap”原则下新增窄例外：当 suggested fix 会让代码变差时，用 `declined` 并说明具体 harm。agent summary verdict enum 增加 `declined`；verdict meanings 增加 `declined` 定义；聚合 `files_changed` 时，若所有结果都是 `replied` / `not-addressing` / `declined` / `needs-human`，跳过测试和提交步骤。回复模板新增 `Declined: ...`；最终 summary 新增 Declined 分组。 |

### CE compound / session history

| CE 文件 | git diff 中的具体更新 |
|---|---|
| `plugins/compound-engineering/skills/ce-compound/SKILL.md` | 新增 Pre-resolved context：用 `git rev-parse --git-common-dir` 区分相对 `.git`/`../.git` 和绝对 worktree `.git`，预解析 repo name；同时预解析当前 git branch。Session Historian dispatch prompt 从长上下文改为紧凑格式：只传 clean repo/branch、7 天窗口、一个具体 problem topic、一个 filter rule 和固定 output schema；明确不要追加额外 context block、exclusion list 或 keyword bullets。Phase 2 写出 learning 后新增运行 `python3 scripts/validate-frontmatter.py <output-path>`，失败必须修复并重跑。 |
| `plugins/compound-engineering/skills/ce-compound/scripts/validate-frontmatter.py` | 新增可执行 Python stdlib 脚本。检查 docs/solutions frontmatter parser-safety：文件必须以完整 `---` 行开始并用完整 `---` 行结束；顶层 scalar 中未 quote 的 ` #` 报错，防止 YAML comment truncation；未 quote 的 `: ` 报错，防止 strict parser 误解成 nested mapping。脚本不做 schema required/enum 校验，也不检查 YAML reserved indicator，因为这些会产生 loud parser error，不属于 silent corruption。exit code：0 通过，1 validation failure，2 usage/file error。 |
| `plugins/compound-engineering/skills/ce-compound-refresh/SKILL.md` | Replace Flow 中 replacement subagent 写出 successor 后，新增运行 `python3 scripts/validate-frontmatter.py <new-learning-path>` 的步骤；验证失败时必须 quote/fix/re-run，不能宣称成功；通过前不能删除旧 learning。原删除旧 learning 步骤从第 3 步后移到第 4 步。 |
| `plugins/compound-engineering/skills/ce-compound-refresh/scripts/validate-frontmatter.py` | 新增与 `ce-compound/scripts/validate-frontmatter.py` 同构的 parser-safety validator，供 refresh replacement flow 使用。 |
| `plugins/compound-engineering/skills/ce-session-inventory/SKILL.md` | 参数说明新增 `--keyword K1[,K2,...]`，用于按 session 全文件 user/assistant 文本做 case-insensitive substring filter；说明 keyword scan 成本高于 metadata-only，适合按主题 ranking，不作为默认。输出字段新增每个 session 的 `match_count` 和 `keyword_matches`，`_meta` 新增 `files_matched`。 |
| `plugins/compound-engineering/skills/ce-session-inventory/scripts/extract-metadata.py` | 新增 `_extract_user_assistant_text()`，只提取 user/assistant 真正说出的文本；跳过 JSONL metadata、tool_use、tool_result、thinking/reasoning。Codex user message 会剥离 `<system_instruction>` wrapper。新增 `count_keyword_matches()`；参数解析支持 `--keyword`。处理顺序改为先做 cheap metadata/CWD filter，再做 expensive keyword scan，避免扫描其他 repo 的 Codex sessions。带 `--keyword` 且空输入时 `_meta` 也输出 `files_matched: 0`，与 batch no-match 形状一致。 |
| `plugins/compound-engineering/skills/ce-sessions/SKILL.md` | repo name pre-resolved 命令从 `if [ "$common" = ".git" ]` 改为 `case "$common" in /*)`，修复正常 checkout 返回相对 `.git` 或 `../.git` 时被误当 linked worktree 的问题。 |

### CE debug / demo / doc-review / work

| CE 文件 | git diff 中的具体更新 |
|---|---|
| `plugins/compound-engineering/skills/ce-debug/SKILL.md` | Phase 4 从“修复后统一询问下一步”改为 branch-aware handoff：如果 debug skill 自己创建了分支，且上下文无冲突规则，则预告并默认进入 commit + open PR；如果是 pre-existing branch，仍询问用户。compound capture 不再机械询问，而是按 lesson 判断：mechanical fix 默认不提示；能形成 generalizable lesson 时中性提示；出现 3+ 处 pattern 或暴露共享依赖/框架/约定错误假设时重点提示。 |
| `plugins/compound-engineering/skills/ce-demo-reel/references/tier-browser-reel.md` | browser capture 等待从固定 `agent-browser wait 2000` 改为 `agent-browser wait --load networkidle` 后再 `agent-browser wait 1000`。补充说明：SPA 单靠固定 wait 不够，可能截到空 shell；websocket/long-polling 页面应用 `agent-browser wait --text "<known content>"` 或 `agent-browser wait --fn "<expression>"` 等待特定 ready 条件。 |
| `plugins/compound-engineering/skills/ce-demo-reel/scripts/capture-demo.py` | 新增 `DEFAULT_MIN_FRAME_BYTES = 20 * 1024`。`_stitch_frames()` 增加 `min_frame_bytes` 参数，stitch 前检查每个 frame 文件大小，小于阈值时报错并提示可能页面未加载完，可用 `--min-frame-bytes 0` 禁用。GIF 降帧递归时传递该阈值。`screenshot-reel` 使用 silicon 渲染代码帧，主动以 `min_frame_bytes=0` 绕过 blank screenshot guard。`stitch` 子命令新增 `--min-frame-bytes` 参数。 |
| `plugins/compound-engineering/skills/ce-doc-review/SKILL.md` | 用户可见文案从 LFG 改为 auto-resolve with best judgment；加载 reference 的说明中，把 “bulk-action preview used by LFG” 改为 “best-judgment routing”。行为模型仍保留 bulk preview。 |
| `plugins/compound-engineering/skills/ce-doc-review/references/bulk-preview.md` | 全文术语替换：LFG -> best-judgment，`LFG plan` -> `Auto-resolve plan`，`LFG the rest` -> `Auto-resolve with best judgment on the rest`。Call site、preview header、Proceed/Cancel、append unavailable 说明同步改名。执行模型没有像 code-review 那样收缩为 option C-only。 |
| `plugins/compound-engineering/skills/ce-doc-review/references/open-questions-defer.md` | duplicate handling 说明中，把 “LFG-the-rest after a walk-through Defer” 改成 “best-judgment-the-rest after a walk-through Defer”。 |
| `plugins/compound-engineering/skills/ce-doc-review/references/synthesis-and-presentation.md` | recommended_action 消费者说明中，把 LFG 改为 best-judgment path；无 `suggested_fix` 时 downgrade to Defer 的说明同步改名，强调 best-judgment path / bulk-preview 不会 schedule actionless Apply。 |
| `plugins/compound-engineering/skills/ce-doc-review/references/walkthrough.md` | option B/D、completion wording 等用户可见文案从 LFG 改为 `Auto-resolve with best judgment` / `Auto-resolve with best judgment on the rest`。 |
| `plugins/compound-engineering/skills/ce-work/SKILL.md` | parallel safety check 改为区分 worktree isolation：有 file overlap 且无 isolation 时降级 serial；有 isolation 时仍可 parallel，冲突交给 post-batch merge。新增 Claude Code `Agent` tool 的 `isolation: "worktree"` / `run_in_background: true` 说明，并说其他无内建 worktree isolation 的平台共享 orchestrator directory。shared-directory fallback constraints 只在无 isolation 时生效：subagent 不 stage/commit、不跑 project test suite。worktree-isolated post-batch flow 新增 review diff、subagent 未 commit 则在 worktree 内 stage/commit、按依赖顺序 merge、冲突时 `git merge --abort` 并 serial 重派、每次 merge 后跑相关测试、cleanup worktree unlock/remove 和 branch delete。commit ownership 改为 worktree-isolated 允许 subagent branch 内 stage/commit，shared-directory fallback 仍由 orchestrator commit。 |
| `plugins/compound-engineering/skills/ce-work-beta/SKILL.md` | 与 `ce-work/SKILL.md` 同步引入 worktree isolation parallel model、overlap handling、Claude Code Agent isolation 参数、shared-directory fallback constraints、post-batch merge/cleanup、commit ownership 分流。 |
| `plugins/compound-engineering/skills/ce-work/references/tracker-defer.md` | ticket body 中 code-review artifact path 从 `.context/compound-engineering/...` 改成 `/tmp/compound-engineering/...`；超长 body 截断提示同步改路径。 |
| `plugins/compound-engineering/skills/ce-work-beta/references/tracker-defer.md` | 同 `ce-work/references/tracker-defer.md`，只改 artifact pointer 到 `/tmp/compound-engineering/...`。 |
| `plugins/compound-engineering/skills/lfg/references/tracker-defer.md` | 同步 code-review artifact pointer 到 `/tmp/compound-engineering/...`。 |

### CE legacy cleanup

| CE 文件 | git diff 中的具体更新 |
|---|---|
| `src/data/plugin-legacy-artifacts.ts` | `EXTRA_LEGACY_ARTIFACTS_BY_PLUGIN["compound-engineering"].skills` 增加 `"ce-pr-description"`，表示插件升级清理时把该 skill 视为 legacy artifact。 |
| `src/utils/legacy-cleanup.ts` | `STALE_SKILL_DIRS` 增加 `"ce-pr-description"`；`LEGACY_ONLY_SKILL_DESCRIPTIONS` 增加 `ce-pr-description` 的旧 description，用于识别 legacy-only skill。 |

---

## CE 到 spec-first 的路径映射

同步时必须使用下表，不允许只做字符串替换。

| CE 源路径 | spec-first 目标路径 | 同步策略 |
|---|---|---|
| `plugins/compound-engineering/agents/ce-pr-comment-resolver.agent.md` | `agents/spec-pr-comment-resolver.agent.md` | `ce-` 改为 `spec-` 后同步 |
| `plugins/compound-engineering/agents/ce-session-historian.agent.md` | `agents/spec-session-historian.agent.md` | `ce-` 改为 `spec-` 后同步 |
| `plugins/compound-engineering/skills/ce-code-review/**` | `skills/spec-code-review/**` | `ce-` 改为 `spec-` 后同步 |
| `plugins/compound-engineering/skills/ce-doc-review/**` | `skills/spec-doc-review/**` | `ce-` 改为 `spec-` 后同步 |
| `plugins/compound-engineering/skills/ce-compound/**` | `skills/spec-compound/**` | `ce-` 改为 `spec-` 后同步 |
| `plugins/compound-engineering/skills/ce-compound-refresh/**` | `skills/spec-compound-refresh/**` | `ce-` 改为 `spec-` 后同步 |
| `plugins/compound-engineering/skills/ce-debug/SKILL.md` | `skills/spec-debug/SKILL.md` | `ce-` 改为 `spec-` 后同步 |
| `plugins/compound-engineering/skills/ce-session-inventory/**` | `skills/spec-session-inventory/**` | `ce-` 改为 `spec-` 后同步 |
| `plugins/compound-engineering/skills/ce-sessions/SKILL.md` | `skills/spec-sessions/SKILL.md` | `ce-` 改为 `spec-` 后同步 |
| `plugins/compound-engineering/skills/ce-work/**` | `skills/spec-work/**` | 需结合 Codex/Claude host 能力改写 |
| `plugins/compound-engineering/skills/ce-work-beta/**` | `skills/spec-work-beta/**` | 需结合 Codex/Claude host 能力改写 |
| `plugins/compound-engineering/skills/ce-commit-push-pr/**` | `skills/git-commit-push-pr/**` | spec-first 技能名不同，不能机械改为 `spec-commit-push-pr` |
| `plugins/compound-engineering/skills/ce-demo-reel/**` | `skills/feature-video/**` | spec-first 技能名不同 |
| `plugins/compound-engineering/skills/ce-resolve-pr-feedback/**` | `skills/resolve-pr-feedback/**` | spec-first 技能名不同 |
| `plugins/compound-engineering/skills/lfg/**` | `skills/lfg/**` | 名称保持一致 |
| 删除的 `plugins/compound-engineering/skills/ce-pr-description/SKILL.md` | `skills/spec-pr-description/SKILL.md` | 不同步删除；需保留为 spec-first 公共 workflow |
| `src/data/plugin-legacy-artifacts.ts` | 无直接目标 | CE CLI converter 专属，当前不迁移 |
| `src/utils/legacy-cleanup.ts` | 无直接目标 | CE CLI converter 专属，当前不迁移 |

---

## 当前阶段实施约束：禁止整文件覆盖

本轮同步处于“语义适配升级”阶段，不允许把 CE 文件整文件覆盖到 spec-first 目标文件。原因是 spec-first 已经有独立命名、公共 workflow 路由、Codex/Claude 双宿主治理、runtime 资产边界和本项目独有能力。整文件覆盖会丢失 spec-first 本地演化，并可能把 CE host 假设、CE 路径、CE 删除决策误带入当前项目。

执行时必须按以下规则：

1. **CE 新增文件**：允许按目标路径新建文件，但仍要做 spec-first 适配。
   - `ce-` / `compound-engineering` 命名要改为 spec-first 语义。
   - docstring、artifact path、badge、skill 调用名、frontmatter name 不能保留 CE 专属语义。
   - 新增脚本要保留可执行位，并补测试。

2. **CE 修改文件**：禁止覆盖目标文件，必须做局部替换。
   - 先读取 CE diff hunk，再读取 spec-first 当前目标文件。
   - 以“新增规则 / 替换段落 / 修改字段 / 插入步骤 / 删除旧句子”为单位定位编辑点。
   - 只替换与 CE diff 对应且经 spec-first 语义判断需要同步的片段。
   - 保留 spec-first 当前已有的本地段落、host-specific 说明、公共 workflow 路由和 changelog 治理。
   - 如果目标文件结构已经与 CE 不同，按行为意图重写局部段落，而不是追求 hunk 形状一致。

3. **CE 删除文件**：禁止直接删除 spec-first 对应文件。
   - 先判断该文件在 spec-first 是否仍是公共 workflow、standalone skill 或内部 primitive。
   - 若仍被 `using-spec-first`、README、governance 或 tests 引用，则保留。
   - 只有另开退休计划并完成路由、runtime、cleanup、tests 和 changelog 后，才允许删除。

4. **CE legacy cleanup / converter 文件**：只有当前项目存在同构 cleanup registry 时才迁移。
   - 没有同构机制时，记录为“不迁移”，不能为追齐 CE 而新增无需求治理面。

5. **每个修改文件都要形成 patch 级证据**。
   - 实施 PR 或后续工作记录中要能说明“CE diff 中哪一段 -> spec-first 哪个局部段落”。
   - 验证不能只 grep CE 关键词；需要断言 spec-first 目标行为存在且 CE 残留不存在。

### 逐文件允许操作方式

下表是执行时的硬约束。`M` 表示 CE 修改，`A` 表示 CE 新增，`D` 表示 CE 删除。

| CE 状态 | CE 文件 | spec-first 允许操作 |
|---|---|---|
| M | `AGENTS.md` | 局部新增中文验证规则；不覆盖整个 `AGENTS.md`；若同步 `CLAUDE.md`，只改同义治理段落。 |
| M | `plugins/compound-engineering/README.md` | 只更新现有 README/README.zh-CN 中对应能力描述；不复制 CE skill count；不删除 `spec-pr-description` 入口。 |
| M | `plugins/compound-engineering/agents/ce-pr-comment-resolver.agent.md` | 在 `agents/spec-pr-comment-resolver.agent.md` 中局部加入 `declined` verdict、分类规则、模板和 enum；保留 spec-first agent 现有身份与路径。 |
| M | `plugins/compound-engineering/agents/ce-session-historian.agent.md` | 在 `agents/spec-session-historian.agent.md` 中局部替换 relevance gating、time budget、repo name、Step 3/4；skill 调用名使用当前 frontmatter `session-inventory` / `session-extract`。 |
| M | `plugins/compound-engineering/skills/ce-code-review/SKILL.md` | 局部替换 artifact path、Stage 5 action mapping、Stage 5b matrix、interactive option B、failed bucket、no-tracker 文案；不得覆盖整个 `SKILL.md`。 |
| M | `plugins/compound-engineering/skills/ce-code-review/references/bulk-preview.md` | 局部重写为 option C-only reference；如果 spec-first 文件含本地说明，保留不冲突段落。 |
| M | `plugins/compound-engineering/skills/ce-code-review/references/findings-schema.json` | 只替换 `autofix_class.description` 和 `suggested_fix.description` 字段；不得重排 schema 或改其他字段。 |
| M | `plugins/compound-engineering/skills/ce-code-review/references/subagent-template.md` | 局部替换 artifact path、safe_auto rubric、suggested_fix 规则；保留 spec-first persona/output contract 结构。 |
| M | `plugins/compound-engineering/skills/ce-code-review/references/tracker-defer.md` | 只替换 artifact pointer 字符串为 `/tmp/spec-first/spec-code-review/<run-id>/`。 |
| M | `plugins/compound-engineering/skills/ce-code-review/references/walkthrough.md` | 局部替换 LFG 文案、artifact pointer、Apply suppression、no-tracker 文案、best-judgment-the-rest dispatch；不覆盖整个 walkthrough。 |
| M | `plugins/compound-engineering/skills/ce-commit-push-pr/SKILL.md` | 只同步 intent detection 和薄委托流程；不得把 CE 内联写作 reference 整段复制进 `git-commit-push-pr`。 |
| A | `plugins/compound-engineering/skills/ce-commit-push-pr/references/pr-description-writing.md` | 不创建同名目标文件；把缺失写作能力按局部段落合并进 `skills/spec-pr-description/SKILL.md`。 |
| M | `plugins/compound-engineering/skills/ce-compound-refresh/SKILL.md` | 在 Replace Flow 局部插入 validator 步骤；不改其他 refresh 流程。 |
| A | `plugins/compound-engineering/skills/ce-compound-refresh/scripts/validate-frontmatter.py` | 可新建 `skills/spec-compound-refresh/scripts/validate-frontmatter.py`；docstring 改 spec-first；保留 stdlib 和执行权限。 |
| M | `plugins/compound-engineering/skills/ce-compound/SKILL.md` | 局部插入 pre-resolved context、收紧 historian dispatch prompt、写后 validator；不覆盖全 skill。 |
| A | `plugins/compound-engineering/skills/ce-compound/scripts/validate-frontmatter.py` | 可新建 `skills/spec-compound/scripts/validate-frontmatter.py`；docstring 改 spec-first；保留 stdlib 和执行权限。 |
| M | `plugins/compound-engineering/skills/ce-debug/SKILL.md` | 局部替换 Phase 4 handoff；保留 spec-first 当前 branch/commit/PR guard。 |
| M | `plugins/compound-engineering/skills/ce-demo-reel/references/tier-browser-reel.md` | 只替换 browser wait 步骤和 websocket/long-polling fallback 说明。 |
| M | `plugins/compound-engineering/skills/ce-demo-reel/scripts/capture-demo.py` | 局部增加 constant、参数、frame-size guard、recursive pass-through、screenshot-reel bypass；不覆盖脚本全文件。 |
| M | `plugins/compound-engineering/skills/ce-doc-review/SKILL.md` | 只替换用户可见 LFG 文案和 reference 引用说明；不改变 doc-review bulk-preview 行为模型。 |
| M | `plugins/compound-engineering/skills/ce-doc-review/references/bulk-preview.md` | 只做 LFG -> best-judgment 文案替换；不得套用 code-review 的 option C-only 收缩。 |
| M | `plugins/compound-engineering/skills/ce-doc-review/references/open-questions-defer.md` | 只替换 `LFG-the-rest` 引用文案。 |
| M | `plugins/compound-engineering/skills/ce-doc-review/references/synthesis-and-presentation.md` | 只替换 recommended_action 消费者中的 LFG 文案。 |
| M | `plugins/compound-engineering/skills/ce-doc-review/references/walkthrough.md` | 只替换 option B/D 和 completion wording 文案。 |
| D | `plugins/compound-engineering/skills/ce-pr-description/SKILL.md` | 禁止删除 `skills/spec-pr-description/SKILL.md`；保留公共 workflow，只局部吸收 CE 写作能力。 |
| M | `plugins/compound-engineering/skills/ce-resolve-pr-feedback/SKILL.md` | 局部加入 `declined` verdict、reply、summary 和 no-files-changed 条件。 |
| M | `plugins/compound-engineering/skills/ce-session-inventory/SKILL.md` | 局部增加 `--keyword` 参数和输出字段说明。 |
| M | `plugins/compound-engineering/skills/ce-session-inventory/scripts/extract-metadata.py` | 局部增加 user/assistant text extraction、keyword count、arg parsing、CWD-before-keyword 顺序和 empty meta shape；不覆盖脚本。 |
| M | `plugins/compound-engineering/skills/ce-sessions/SKILL.md` | 只替换 repo name pre-resolved shell snippet。 |
| M | `plugins/compound-engineering/skills/ce-work-beta/SKILL.md` | 不照搬 CE worktree 文案；按 host capability matrix 局部改写。`codex-delegation-workflow.md` 只做冲突审查。 |
| M | `plugins/compound-engineering/skills/ce-work-beta/references/tracker-defer.md` | 只替换 artifact pointer 字符串。 |
| M | `plugins/compound-engineering/skills/ce-work/SKILL.md` | 不照搬 CE worktree 文案；按 host capability matrix 局部改写。 |
| M | `plugins/compound-engineering/skills/ce-work/references/tracker-defer.md` | 只替换 artifact pointer 字符串。 |
| M | `plugins/compound-engineering/skills/lfg/references/tracker-defer.md` | 只替换 artifact pointer 字符串。 |
| M | `src/data/plugin-legacy-artifacts.ts` | 不迁移；spec-first 无同构 CE converter registry 且不删除 `spec-pr-description`。 |
| M | `src/utils/legacy-cleanup.ts` | 不迁移；不得新增 cleanup 机制来追齐 CE。 |

---

## 逐文件同步判定附录

下表是本次 CE 非 `docs/`、非 `tests/` 变更的逐文件判定。实施时以该表为检查清单，目录级章节不能替代本表。

| CE 文件 | CE 具体改动摘要 | spec-first 目标文件 | 同步结论 | 实施单元 | 验证点 |
|---|---|---|---|---|---|
| `AGENTS.md` | 新增 agent/skill 行为验证规则，说明 Claude plugin session cache 与 `skill-creator` eval 路径 | `AGENTS.md`，按条件同步到 `CLAUDE.md` | 同步，按 spec-first source/runtime 边界改写 | U1 | 文档含 source asset、runtime asset、cache 验证边界 |
| `plugins/compound-engineering/README.md` | 调整 skill count，删除 `ce-pr-description` 条目，扩展 `ce-commit-push-pr` 描述 | `README.md`、`README.zh-CN.md` 中已有相关条目 | 部分同步；不复制 count；不删除 `spec-pr-description` | U1、U7 | 若目标文档存在对应条目则更新，否则不新增清单 |
| `plugins/compound-engineering/agents/ce-pr-comment-resolver.agent.md` | 增加 `declined` verdict、分类规则、回复模板、返回 enum | `agents/spec-pr-comment-resolver.agent.md` | 同步 | U2 | contract test 断言 `declined` enum 和有害建议边界 |
| `plugins/compound-engineering/agents/ce-session-historian.agent.md` | 增加相关性 gating、时间预算、repo name 修复、keyword fallback、deep-dive cap、conditional tail | `agents/spec-session-historian.agent.md` | 同步，技能调用名按 spec-first 当前 frontmatter 使用 `session-inventory` / `session-extract` | U3 | `session-history-scripts.test.js` 和 historian contract 断言禁止 extract-to-check-relevance |
| `plugins/compound-engineering/skills/ce-code-review/SKILL.md` | artifact 移到 `/tmp`，best-judgment 路径取消 Stage 5b 和 bulk preview，新增 failed bucket 处理，重写 fixer queue contract | `skills/spec-code-review/SKILL.md` | 同步，路径改为 `/tmp/spec-first/spec-code-review` | U5 | `spec-code-review-contracts.test.js` 覆盖路由、fixer、Stage 5b 边界 |
| `plugins/compound-engineering/skills/ce-code-review/references/bulk-preview.md` | bulk preview 缩小为 file tickets option C 专用 | `skills/spec-code-review/references/bulk-preview.md` | 同步 | U5 | 断言 best-judgment 不再使用 bulk preview |
| `plugins/compound-engineering/skills/ce-code-review/references/findings-schema.json` | 扩展 `autofix_class` 和 `suggested_fix` 描述，强调 safe_auto 与 suggested_fix 规则 | `skills/spec-code-review/references/findings-schema.json` | 同步 | U5 | JSON 可解析，字段 description 含 safe_auto test 与 soft punt 约束 |
| `plugins/compound-engineering/skills/ce-code-review/references/subagent-template.md` | 更新 safe_auto rubric、manual+suggested_fix 规则、artifact 路径 | `skills/spec-code-review/references/subagent-template.md` | 同步 | U5 | 断言 artifact path 与 safe_auto 边界 |
| `plugins/compound-engineering/skills/ce-code-review/references/tracker-defer.md` | artifact pointer 改为 `/tmp` | `skills/spec-code-review/references/tracker-defer.md` | 同步，路径 spec-first 化 | U5 | grep 不再出现 `.context/compound-engineering` |
| `plugins/compound-engineering/skills/ce-code-review/references/walkthrough.md` | LFG 改 best-judgment；无 `suggested_fix` 隐藏 Apply；无 tracker 文案去 jargon；rest 路径直接 fixer | `skills/spec-code-review/references/walkthrough.md` | 同步 | U5 | 断言 Apply suppression、no tracker 文案、直接 fixer |
| `plugins/compound-engineering/skills/ce-commit-push-pr/SKILL.md` | 增加 description-only/update/full 三模式，写作逻辑内联到 reference，quoted heredoc body | `skills/git-commit-push-pr/SKILL.md` | 部分同步；只同步 mode detection 和薄委托，不内联写作逻辑 | U7 | `git-commit-push-pr` 仍委托 `spec-pr-description` |
| `plugins/compound-engineering/skills/ce-commit-push-pr/references/pr-description-writing.md` | 新增 PR description 写作 reference，承接被删除 skill 的逻辑 | 不新增同名 reference；缺失能力合并到 `skills/spec-pr-description/SKILL.md` | 部分同步；作为差异来源，不作为新真相源 | U7 | `spec-pr-description` 是唯一 title/body 生成源 |
| `plugins/compound-engineering/skills/ce-compound-refresh/SKILL.md` | Replace Flow 写 successor 后运行 frontmatter validator | `skills/spec-compound-refresh/SKILL.md` | 同步 | U4 | 文本断言 replacement 后 validator 再删除旧文档 |
| `plugins/compound-engineering/skills/ce-compound-refresh/scripts/validate-frontmatter.py` | 新增 parser-safety validator | `skills/spec-compound-refresh/scripts/validate-frontmatter.py` | 同步，docstring 改 spec-first | U4 | `frontmatter-validator.test.js` 执行脚本 |
| `plugins/compound-engineering/skills/ce-compound/SKILL.md` | 增加 pre-resolved repo/branch、收紧 historian prompt、写完后 validator | `skills/spec-compound/SKILL.md` | 同步 | U4 | contract test 覆盖 pre-resolved context 和 validator 调用 |
| `plugins/compound-engineering/skills/ce-compound/scripts/validate-frontmatter.py` | 新增 parser-safety validator | `skills/spec-compound/scripts/validate-frontmatter.py` | 同步，docstring 改 spec-first | U4 | `frontmatter-validator.test.js` 执行脚本 |
| `plugins/compound-engineering/skills/ce-debug/SKILL.md` | Phase 4 改为 skill-owned branch 默认 commit/PR，pre-existing branch 询问，compound capture 按 lesson 判断 | `skills/spec-debug/SKILL.md` | 同步，并按 `AGENTS.md` / 任务上下文 guard 退回询问 | U8 | contract test 覆盖 branch-owned / pre-existing / mechanical fix |
| `plugins/compound-engineering/skills/ce-demo-reel/references/tier-browser-reel.md` | browser wait 改 networkidle + buffer，补 websocket/long-polling wait 指南 | `skills/feature-video/references/tier-browser-reel.md` | 同步 | U9 | contract test 断言 networkidle 和 wait fallback |
| `plugins/compound-engineering/skills/ce-demo-reel/scripts/capture-demo.py` | stitch 增加 `--min-frame-bytes` blank guard，screenshot-reel bypass | `skills/feature-video/scripts/capture-demo.py` | 同步 | U9 | `feature-video-contracts.test.js` 执行 tiny PNG 场景 |
| `plugins/compound-engineering/skills/ce-doc-review/SKILL.md` | LFG 用户文案改 best-judgment | `skills/spec-doc-review/SKILL.md` | 同步文案 | U6 | doc-review contract 断言不暴露 LFG 用户文案 |
| `plugins/compound-engineering/skills/ce-doc-review/references/bulk-preview.md` | LFG plan 文案改 Auto-resolve plan，行为保持 | `skills/spec-doc-review/references/bulk-preview.md` | 同步文案 | U6 | 文案一致性断言 |
| `plugins/compound-engineering/skills/ce-doc-review/references/open-questions-defer.md` | `LFG-the-rest` 引用改 best-judgment-the-rest | `skills/spec-doc-review/references/open-questions-defer.md` | 同步文案 | U6 | 文案一致性断言 |
| `plugins/compound-engineering/skills/ce-doc-review/references/synthesis-and-presentation.md` | LFG 行为引用改 best-judgment path | `skills/spec-doc-review/references/synthesis-and-presentation.md` | 同步文案 | U6 | 文案一致性断言 |
| `plugins/compound-engineering/skills/ce-doc-review/references/walkthrough.md` | option B/D 文案改 best-judgment，completion wording 更新 | `skills/spec-doc-review/references/walkthrough.md` | 同步文案 | U6 | 文案一致性断言 |
| `plugins/compound-engineering/skills/ce-pr-description/SKILL.md` | 删除独立 PR description skill | `skills/spec-pr-description/SKILL.md` | 不同步删除；保留公共 workflow | U7 | using-spec-first 仍能路由 `$spec-pr-description` |
| `plugins/compound-engineering/skills/ce-resolve-pr-feedback/SKILL.md` | 支持 `declined` verdict、reply、summary、files_changed 空判断 | `skills/resolve-pr-feedback/SKILL.md` | 同步 | U2 | `resolve-pr-feedback-contracts.test.js` 断言 `declined` 全链路 |
| `plugins/compound-engineering/skills/ce-session-inventory/SKILL.md` | 文档化 `--keyword`、`match_count`、`keyword_matches`、`files_matched` | `skills/spec-session-inventory/SKILL.md` | 同步 | U3 | 文本断言参数和输出字段 |
| `plugins/compound-engineering/skills/ce-session-inventory/scripts/extract-metadata.py` | 新增 user/assistant-only keyword scan，CWD filter 先于 keyword | `skills/spec-session-inventory/scripts/extract-metadata.py` | 同步 | U3 | `session-history-scripts.test.js` 执行脚本 |
| `plugins/compound-engineering/skills/ce-sessions/SKILL.md` | 修复 repo name pre-resolved 命令 | `skills/spec-sessions/SKILL.md` | 同步 | U3 | 文本断言 `case "$common" in /*)` |
| `plugins/compound-engineering/skills/ce-work-beta/SKILL.md` | 增加 worktree-isolated 并行、merge/cleanup、commit ownership | `skills/spec-work-beta/SKILL.md` | 只同步可执行 host matrix；不把 CE 文案照搬到 Codex delegation | U10 | `spec-work-beta-contracts.test.js` 覆盖矩阵和 delegation 边界 |
| `plugins/compound-engineering/skills/ce-work-beta/references/tracker-defer.md` | artifact pointer 改 `/tmp` | `skills/spec-work-beta/references/tracker-defer.md` | 同步，路径 spec-first 化 | U5 | grep 路径 |
| `plugins/compound-engineering/skills/ce-work/SKILL.md` | 增加 worktree-isolated 并行、merge/cleanup、commit ownership | `skills/spec-work/SKILL.md` | 只同步可执行 host matrix | U10 | `spec-work-contracts.test.js` 覆盖矩阵 |
| `plugins/compound-engineering/skills/ce-work/references/tracker-defer.md` | artifact pointer 改 `/tmp` | `skills/spec-work/references/tracker-defer.md` | 同步，路径 spec-first 化 | U5 | grep 路径 |
| `plugins/compound-engineering/skills/lfg/references/tracker-defer.md` | artifact pointer 改 `/tmp` | `skills/lfg/references/tracker-defer.md` | 同步，路径 spec-first 化 | U5 | grep 路径 |
| `src/data/plugin-legacy-artifacts.ts` | CE legacy registry 增加 `ce-pr-description` | 无直接目标 | 不同步；spec-first 不删除 `spec-pr-description` 且无同构 registry | U11 | 无代码变更 |
| `src/utils/legacy-cleanup.ts` | stale skill dirs 和 legacy-only description 增加 `ce-pr-description` | 无直接目标 | 不同步；后续若退休 `spec-pr-description` 另开计划 | U11 | 无代码变更 |

---

## 明确改动点清单

### 1. 仓库维护说明：新增 agent/skill 行为验证规则

**CE 改了什么**

- 在 `AGENTS.md` 新增 “Validating Agent and Skill Changes”。
- 说明 Claude Code 插件的 agent/skill prose 会在 session start 时缓存。
- 行为变更不能通过同一 session 内的 typed agent 或 Skill 调用验证。
- 推荐用 `skill-creator` eval workflow，把当前源文件内容注入 fresh subagent。
- 明确不要编辑 `~/.claude/plugins/cache/` 或 `~/.claude/plugins/marketplaces/`。
- 说明脚本、parser、converter、测试不受这个缓存限制。

**CE diff 文案级依据**

- 修改前：`AGENTS.md` 没有 agent/skill prose 行为验证小节，只保留插件安装、目录和测试说明。
- 修改后：新增 `## Validating Agent and Skill Changes`，核心文案是：
  - `Behavioral changes to a plugin agent or skill ... need a different validation path than mechanical code changes`
  - `Use the skill-creator skill to test changes`
  - `Plugin agent and skill definitions both cache at session start`
  - `Do NOT edit ~/.claude/plugins/cache/ or ~/.claude/plugins/marketplaces/`
  - `Mechanical changes do not have this restriction`

**spec-first 要怎么改**

- 在 `AGENTS.md` 中新增对应中文规则，但要改成 spec-first 语义：
  - source of truth 是 `skills/`、`agents/`、`src/cli/`。
  - `.claude/` 和 `.codex/` 是 runtime 生成副本，不手改。
  - 验证 skill/agent prose 时，需要使用读取当前源文件的 eval 方式，而不是依赖已缓存的 runtime 技能。
- 只有当 `CLAUDE.md` 是本仓库需要维护的兼容入口时，才同步类似说明；不要破坏 generated/runtime 边界。

**是否同步**

- 同步，属于维护质量规则。

---

### 2. README / 技能清单：CE 移除独立 PR description 技能

**CE 改了什么**

- `plugins/compound-engineering/README.md` 中 Skills 数量从 `42+` 改为 `35+`。
- 删除 `ce-pr-description` 的清单条目。
- 把 `ce-commit-push-pr` 描述扩展为：
  - 可 commit/push/open PR。
  - 可更新已有 PR description。
  - 可只生成 PR description，不 commit、不 push。
- 把 `ce-polish-beta` 的显示从 slash form 调整为 skill 名称 form。

**CE diff 文案级依据**

- 修改前：技能数量行是 `| Skills | 42+ |`；修改后：`| Skills | 35+ |`。
- 修改前：README 有 `| ce-pr-description | Write or regenerate a value-first PR title and body ... |`；修改后：该行删除。
- 修改前：`ce-commit-push-pr` 描述是 `Commit, push, and open a PR ... also update an existing PR description (delegates title/body generation to ce-pr-description)`。
- 修改后：`ce-commit-push-pr` 描述改为 `Commit, push, and open a PR ... also update an existing PR description, or generate a description on its own without committing`。
- 修改前：polish-beta 行以 `/ce-polish-beta` 展示；修改后：以 `ce-polish-beta` 展示。

**spec-first 要怎么改**

- 不复制 CE 的技能数量；必须从 spec-first 当前 `skills/` 重新统计或避免写死数量。
- 不删除 `skills/spec-pr-description/SKILL.md`。
- 如果 README 或用户手册中描述 `git-commit-push-pr`，可补充“只生成 PR description”的能力。
- 如果 README 仍把 `spec-pr-description` 作为公共 workflow 展示，保留。

**是否同步**

- 部分同步。
- 同步 `git-commit-push-pr` 能力描述。
- 不同步 `spec-pr-description` 删除。

---

### 3. PR feedback：新增 `declined` verdict

**CE 改了什么**

- `ce-pr-comment-resolver.agent.md` 新增 verdict：`declined`。
- `declined` 用于“review 意见可能成立，但按建议修改会让代码更差”的情况。
- 典型原因：
  - 违反 `CLAUDE.md` / `AGENTS.md` 项目规则。
  - 增加无意义 defensive code。
  - 吞掉本应传播的错误。
  - 过早抽象。
  - 用注释复述代码。
- 默认策略仍然是：有效反馈尽量修，只有 reviewer 事实错误或建议有害才跳过。
- `ce-resolve-pr-feedback/SKILL.md` 同步支持：
  - verdict enum 增加 `declined`。
  - no-files-changed 判断把 `declined` 视为无需验证/提交的结果。
  - reply 格式新增 `Declined: ...`。
  - summary 增加 Declined 分组。

**CE diff 文案级依据**

- `ce-pr-comment-resolver.agent.md` 修改前：默认跳过门槛是 `the reviewer is factually wrong about the code`；修改后：跳过门槛扩展为 reviewer 事实错误对应 `not-addressing`，建议有害对应 `declined`，并补充 `When in doubt, fix it`。
- `ce-pr-comment-resolver.agent.md` 修改前：verdict enum 是 `fixed | fixed-differently | replied | not-addressing | needs-human`；修改后：变成 `fixed | fixed-differently | replied | not-addressing | declined | needs-human`。
- `ce-pr-comment-resolver.agent.md` 修改后新增分类句：`the suggested fix would actively make the code worse ... -> verdict: declined with the specific harm cited`。
- `ce-pr-comment-resolver.agent.md` 修改后新增回复模板：`Declined: [specific harm cited ...]`。
- `ce-resolve-pr-feedback/SKILL.md` 修改前：原则是 `Fix everything valid ... fix it rather than punt it`；修改后：增加窄例外 `when implementing the suggested fix would actively make the code worse ... use the declined verdict`。
- `ce-resolve-pr-feedback/SKILL.md` 修改前：无文件变更时只把 `replied` / `not-addressing` / `needs-human` 视为无需验证提交；修改后：加入 `declined`。
- `ce-resolve-pr-feedback/SKILL.md` 修改后新增 summary 行：`Declined (count): [what was declined and the harm cited]`。

**spec-first 要怎么改**

- `agents/spec-pr-comment-resolver.agent.md`
  - 增加 `declined` 分类规则。
  - 增加 declined 回复模板。
  - 更新返回格式中的 verdict enum。
- `skills/resolve-pr-feedback/SKILL.md`
  - 增加 `declined` verdict。
  - 聚合 `files_changed` 时，把全为 `replied` / `not-addressing` / `declined` / `needs-human` 的情况视为无需测试和提交。
  - 回复模板和最终 summary 增加 Declined。

**是否同步**

- 同步。

**原因**

- 这是质量边界，不是流程复杂化。
- 它保留“修有效反馈”的默认，同时避免 agent 为了迎合 review 而引入更差代码。

---

### 4. Session historian：减少无关 session 深挖

**CE 改了什么**

- `ce-session-historian.agent.md` 新增硬规则：
  - 禁止为了验证相关性而直接 extract session。
  - extract 前必须已有相关性证据：
    - branch 精确匹配 dispatch branch。
    - branch 包含问题关键词。
    - `ce-session-inventory --keyword` 返回 `match_count > 0`。
- 新增时间预算：
  - 有完整答案就停止。
  - “没有相关 prior sessions” 是完整答案。
  - 已抽取 3-5 个 session 且足够综合时停止。
- 修复 repo name 计算：
  - `git rev-parse --git-common-dir` 返回相对路径 `.git` 或 `../.git` 时，使用 `--show-toplevel`。
  - 只有绝对路径才按 linked worktree 主 repo 处理。
- 重写 Step 3：
  - 先按 branch 过滤。
  - branch 无结果或 Codex 无 branch 时，用 `--keyword`。
  - `files_matched: 0` 时立即停止，不 extract。
  - 最多 deep-dive 5 个 session。
- tail extraction 改为条件触发：
  - 只有 head skeleton 看起来停在调查中途时才 tail。

**CE diff 文案级依据**

- 修改前：historian 没有明确禁止“extract to verify relevance”；修改后：新增 `Never extract a session to verify whether it is relevant`，并要求 extract 前至少满足 branch 精确匹配、branch 含 topic keyword、或 `ce-session-inventory --keyword` 返回 `match_count > 0`。
- 修改前：没有时间预算小节；修改后：新增 `## Time budget`，明确 `Stop as soon as you have a complete answer`，`no relevant prior sessions` 也是完整答案，抽取 `3-5 sessions` 且已有综合材料后停止。
- 修改前：repo name 命令只判断 `if [ "$common" = ".git" ]`；修改后：改为 `case "$common" in /*) ... ;; *) ... ;; esac`，用绝对路径判断 linked worktree。
- 修改前：Step 3 是按 same branch、same CWD、related branch、keyword matching 的信号优先级做相关性判断；修改后：Step 3 改名为 `Select sessions to deep-dive (or stop)`，按 branch filter、keyword filter、window/current-session filter、deep-dive cap 顺序执行。
- 修改前：keyword matching 是概念性信号；修改后：要求 branch filter 为零时运行 `ce-session-inventory <repo> <days> --keyword K1,K2,...`，且 `files_matched: 0` 时立即返回 no relevant prior sessions，禁止 extract。
- 修改前：head skeleton 不覆盖结论时默认 tail；修改后：`Tail extraction is conditional, not default`，只有 head 输出明显停在调查中途才 `tail:50`。

**spec-first 要怎么改**

- `agents/spec-session-historian.agent.md`
  - 同步上述相关性 gating、时间预算、repo name 修复、deep-dive cap、conditional tail。
  - 把 CE 技能名改为 spec-first 技能名：
    - `ce-session-inventory` -> `session-inventory`，即 `skills/spec-session-inventory/SKILL.md` 当前 frontmatter `name`。
    - `ce-session-extract` -> `session-extract`，即 `skills/spec-session-extract/SKILL.md` 当前 frontmatter `name`。
- `skills/spec-sessions/SKILL.md`
  - 同步 repo name pre-resolved 命令修复。

**是否同步**

- 同步。

**原因**

- 这符合 spec-first 的“提升输入质量，不增加强编排”原则。
- 它减少无关 session 读取，降低 token 和时间成本。

---

### 5. Session inventory：新增 `--keyword` 过滤

**CE 改了什么**

- `ce-session-inventory/SKILL.md` 新增参数：
  - `--keyword K1[,K2,...]`
- 输出新增：
  - 每个匹配 session 增加 `match_count`。
  - 每个匹配 session 增加 `keyword_matches`。
  - `_meta` 增加 `files_matched`。
- `extract-metadata.py` 新增内容扫描逻辑：
  - 只统计 user / assistant 真实文本。
  - 跳过 JSONL metadata。
  - 跳过 tool calls。
  - 跳过 tool results。
  - 跳过 thinking / reasoning blocks。
  - Codex user message 会剥离 `<system_instruction>` 前缀。
  - 先做 CWD filter，再做 keyword scan，避免扫描其他 repo 的 Codex session。
  - 空输入且带 `--keyword` 时，也输出 `files_matched: 0`。

**CE diff 文案级依据**

- `ce-session-inventory/SKILL.md` 修改前：参数只有 repo、days、platform/cwd 等；修改后：新增 `--keyword K1[,K2,...]`，说明它是 case-insensitive substring filter，并会新增 `match_count`、`keyword_matches` 和 `_meta.files_matched`。
- `ce-session-inventory/SKILL.md` 修改前：最终 `_meta` 只有 `files_processed`、`parse_errors`、可选 `filtered_by_cwd`；修改后：带 keyword 时 `_meta` 还包含 `files_matched`。
- `extract-metadata.py` 修改前：`process_file` 只做 metadata extraction；修改后：新增 `_extract_user_assistant_text(filepath)`，只拼接 user/assistant 文本，跳过 metadata、tool_use、tool_result、thinking/reasoning。
- `extract-metadata.py` 修改前：没有 keyword count；修改后：新增 `count_keyword_matches(filepath, keywords)`，对过滤后的 user/assistant 文本做大小写不敏感 substring count。
- `extract-metadata.py` 修改前：参数注释是 `files and optional --cwd-filter`；修改后：变成 `files and optional --cwd-filter / --keyword`。
- `extract-metadata.py` 修改前：无输入时输出 `{"files_processed": 0, "parse_errors": 0}`；修改后：若带 `--keyword`，无输入也输出 `files_matched: 0`。

**spec-first 要怎么改**

- `skills/spec-session-inventory/SKILL.md`
  - 增加 `--keyword` 参数说明和输出字段说明。
- `skills/spec-session-inventory/scripts/extract-metadata.py`
  - 增加 `_extract_user_assistant_text`。
  - 增加 `count_keyword_matches`。
  - 参数解析支持 `--keyword`。
  - 按 CE 的顺序先 CWD filter，再 keyword scan。

**是否同步**

- 同步。

**验证重点**

- keyword 不应命中 `sessionId`、`gitBranch`、tool output 等元数据。
- `files_matched: 0` 必须在无匹配和无输入两种场景都稳定出现。

---

### 6. Compound：新增 pre-resolved context 和 frontmatter validator

**CE 改了什么**

- `ce-compound/SKILL.md` 新增 pre-resolved context：
  - repo name。
  - git branch。
- Session Historian dispatch prompt 变短：
  - 只传 repo/branch、7 天窗口、一个具体 problem topic、filter rule、输出 schema。
  - 明确不要附加额外上下文块、排除列表或 keyword bullet。
- 新增 `scripts/validate-frontmatter.py`。
- compound 文档写完后运行：
  - `python3 scripts/validate-frontmatter.py <output-path>`

**CE diff 文案级依据**

- 修改前：`ce-compound/SKILL.md` 没有 `Pre-resolved context`；修改后：新增 repo name 和 git branch 两行预解析命令，其中 repo name 使用 `case "$common" in /*)` 判断 worktree。
- 修改前：Session Historian dispatch prompt 要传“具体问题描述、当前 git branch 和 working directory、过滤指令、详细 output format”，并列出较长的上下文说明。
- 修改后：dispatch prompt 改为 `keep tight`，只传 clean pre-resolved repo/branch、`7 days` 时间窗口、一句 problem topic、一行 filter rule、固定 output schema，并明确 `Do not append additional context blocks, exclusion lists, or topic-keyword bullets`。
- 修改前：Phase 2 写出 learning 后没有确定性 parser-safety 检查；修改后：新增第 8 步 `Run python3 scripts/validate-frontmatter.py <output-path>`，失败必须 quote/fix/re-run。
- 新增文件索引：`plugins/compound-engineering/skills/ce-compound/scripts/validate-frontmatter.py`。

**spec-first 要怎么改**

- `skills/spec-compound/SKILL.md`
  - 增加 pre-resolved context。
  - 调整 Session Historian dispatch prompt。
  - 文档写完后调用本 skill 目录内 validator。
- 新增 `skills/spec-compound/scripts/validate-frontmatter.py`。

**是否同步**

- 同步。

**原因**

- pre-resolved context 减少 historian 的无效推导。
- validator 是确定性 parser-safety 检查，符合脚本职责。

---

### 7. Compound refresh：replacement 后验证 frontmatter

**CE 改了什么**

- `ce-compound-refresh/SKILL.md` 的 Replace Flow 新增步骤：
  - replacement subagent 写出新 learning 后，运行 frontmatter validator。
  - validator 失败时，必须修复并重跑。
  - 验证通过前不能删除旧 learning，也不能宣称成功。
- 新增 `ce-compound-refresh/scripts/validate-frontmatter.py`。

**CE diff 文案级依据**

- 修改前：Replace Flow 第 3 步是 `After the subagent completes, the orchestrator deletes the old learning file`。
- 修改后：第 3 步改为先运行 `python3 scripts/validate-frontmatter.py <new-learning-path>`，检查 malformed delimiter、unquoted ` #`、unquoted `: `，失败时 quote/fix/re-run，且 `Do not declare success while validation fails`。
- 修改后：原删除旧 learning 的动作后移为第 4 步，确保 validation 通过前不删除旧文档。
- 新增文件索引：`plugins/compound-engineering/skills/ce-compound-refresh/scripts/validate-frontmatter.py`。

**spec-first 要怎么改**

- `skills/spec-compound-refresh/SKILL.md`
  - 在 Replace Flow 中加入同样验证步骤。
- 新增 `skills/spec-compound-refresh/scripts/validate-frontmatter.py`。

**是否同步**

- 同步。

---

### 8. Frontmatter validator：新增确定性脚本

**CE 改了什么**

新增 Python stdlib 脚本，检查 `docs/solutions/` frontmatter 的 parser-safety：

- 文件必须以完整 `---` 行开头。
- frontmatter 必须用完整 `---` 行结束。
- 顶层 scalar value 中未 quote 的 ` #` 报错，避免 YAML 静默截断。
- 顶层 scalar value 中未 quote 的 `: ` 报错，避免严格 YAML parser 误解为 mapping。
- 不做 schema required field 或 enum 校验。
- 不检查 YAML reserved indicator，因为那些通常是 loud parser error，不是 silent corruption。

**CE diff 文案级依据**

- 新增文件索引：`plugins/compound-engineering/skills/ce-compound/scripts/validate-frontmatter.py`。
- 新增文件索引：`plugins/compound-engineering/skills/ce-compound-refresh/scripts/validate-frontmatter.py`。
- 新增脚本 docstring 明确：`Validate ce-compound docs/solutions/ frontmatter for parser-safety issues`，迁移到 spec-first 时必须改成 spec-first 语义。
- 新增脚本声明 exit code：`0` 通过、`1` validation failure、`2` usage error。
- 新增脚本的三类检查写在 docstring 中：完整 `---` delimiter、未 quote 的 ` #`、未 quote 的 `: `。
- 新增脚本明确不做 schema required/enum 校验，也不处理 YAML reserved indicator。

**spec-first 要怎么改**

- 在 `skills/spec-compound/scripts/validate-frontmatter.py` 和 `skills/spec-compound-refresh/scripts/validate-frontmatter.py` 各放一份。
- docstring 改成 spec-first，不保留 CE 命名。
- 保持无第三方依赖。

**是否同步**

- 同步。

**验证重点**

- `----` 不能被误认为合法结束 delimiter。
- unquoted `title: foo # bar` 必须失败。
- unquoted `title: foo: bar` 必须失败。
- quoted `"foo # bar"` 和 `"foo: bar"` 必须通过。

---

### 9. Code review：run artifact 从 `.context` 改到 `/tmp`

**CE 改了什么**

- `ce-code-review` 的 run artifact 路径从：
  - `.context/compound-engineering/ce-code-review/<run-id>/`
- 改为：
  - `/tmp/compound-engineering/ce-code-review/<run-id>/`
- 影响位置：
  - autofix mode。
  - headless mode。
  - reviewer artifact 写入。
  - detail enrichment。
  - tracker-defer artifact pointer。
  - walkthrough 中 Full fix pointer。

**CE diff 文案级依据**

- `ce-code-review/SKILL.md` 修改前：autofix/report-only/headless 说明使用 `.context/compound-engineering/ce-code-review/<run-id>/`；修改后：全部改为 `/tmp/compound-engineering/ce-code-review/<run-id>/`。
- `ce-code-review/SKILL.md` 修改前：创建 run dir 的命令是 `mkdir -p ".context/compound-engineering/ce-code-review/$RUN_ID"`；修改后：`mkdir -p "/tmp/compound-engineering/ce-code-review/$RUN_ID"`。
- `ce-code-review/SKILL.md` 修改前：persona subagent 写入 `.context/compound-engineering/ce-code-review/{run_id}/{reviewer_name}.json`；修改后：写入 `/tmp/compound-engineering/ce-code-review/{run_id}/{reviewer_name}.json`。
- `ce-code-review/SKILL.md` 修改前：read-only 例外写法是允许保存到 `.context/` artifact path；修改后：改成保存到 run-artifact path，并明确 under `/tmp/compound-engineering/ce-code-review/<run-id>/`。
- `tracker-defer.md` 修改前：ticket body 从 `.context/compound-engineering/ce-code-review/<run-id>/{reviewer}.json` 读取 `why_it_matters`；修改后：从 `/tmp/compound-engineering/ce-code-review/<run-id>/{reviewer}.json` 读取。
- `walkthrough.md` 修改前：Full fix pointer 指向 `.context/... -> findings[].suggested_fix`；修改后：指向 `/tmp/... -> findings[].suggested_fix`。

**spec-first 要怎么改**

- 改为 spec-first 专属路径：
  - `/tmp/spec-first/spec-code-review/<run-id>/`
- 需要修改：
  - `skills/spec-code-review/SKILL.md`
  - `skills/spec-code-review/references/tracker-defer.md`
  - `skills/spec-code-review/references/walkthrough.md`
  - `skills/spec-work/references/tracker-defer.md`
  - `skills/spec-work-beta/references/tracker-defer.md`
  - `skills/lfg/references/tracker-defer.md`

**是否同步**

- 同步，但路径必须 spec-first 化。

---

### 10. Code review：best-judgment 替代 LFG 交互

**CE 改了什么**

- 用户可见选项从 `LFG` 改为：
  - `Auto-resolve with best judgment`
  - `Auto-resolve with best judgment on the rest`
- `bulk-preview.md` 不再服务 best-judgment 路径。
- bulk preview 只保留给 file tickets，因为 ticket 是 durable external state，撤销成本高。
- best-judgment 路径直接 dispatch fixer。
- fixer 成功后直接出 unified completion report。
- fixer 有 failed bucket 时，先问用户：
  - File tickets for these。
  - Walk through these one at a time。
  - Ignore。
- final report 必须在 failed bucket 处理后再输出，避免 stale report。

**CE diff 文案级依据**

- `ce-code-review/SKILL.md` 修改前：option B 是 `LFG. Apply the agent's best-judgment action per finding`；修改后：`Auto-resolve with best judgment — apply per-finding fixes the agent can defend, surface the rest`。
- `ce-code-review/SKILL.md` 修改前：Stage 5b matrix 里 interactive LFG 和 walk-through LFG-the-rest 都 `Yes, on the action set`，且在 bulk-preview dispatch 前运行；修改后：两者都改为 `No -- the best-judgment path dispatches the fixer immediately`。
- `ce-code-review/SKILL.md` 修改后新增解释：best-judgment 跳过 Stage 5b 是因为 fixer apply/fail 本身就是验证，false-positive 进入 `failed` bucket。
- `ce-code-review/SKILL.md` 修改前：option A 的 `LFG the rest` 路径通过 `references/bulk-preview.md`；修改后：`Auto-resolve with best judgment on the rest` 直接 dispatch 一个 fixer pass，且避免二次 dispatch。
- `ce-code-review/SKILL.md` 修改后新增 failed bucket 问题：`N findings could not be auto-resolved. What should the agent do with them?`，选项是 `File tickets for these`、`Walk through these one at a time`、`Ignore — leave them in the report`。
- `ce-code-review/references/bulk-preview.md` 修改前：服务 LFG、File tickets、walk-through `LFG the rest` 三个 call site；修改后：`Interactive mode only. Option C only.`，并说明 best-judgment path 不使用 bulk preview。
- `ce-code-review/references/bulk-preview.md` 修改前示例 header 是 `LFG plan — 8 findings`，含 Applying/Filing/Skipping bucket；修改后：示例 header 是 `File plan — 8 findings as Linear tickets`，所有 finding 都进入 `Filing Linear tickets`。
- `ce-code-review/references/walkthrough.md` 修改前：option 4 是 `LFG the rest — apply the agent's best judgment to this and remaining findings`；修改后：`Auto-resolve with best judgment on the rest`。
- `ce-code-review/references/walkthrough.md` 修改前：no tracker 文案使用 `tracker sink` / `platform`；修改后：要求说“当前 checkout 没配置 issue tracker”，避免 jargon。

**spec-first 要怎么改**

- `skills/spec-code-review/SKILL.md`
  - 更新 option B 文案。
  - 删除 best-judgment 的 Stage 5b validator pre-pass。
  - 删除 best-judgment 的 bulk-preview approval gate。
  - 增加 failed bucket post-run question。
- `skills/spec-code-review/references/bulk-preview.md`
  - 改成只描述 file tickets option C。
- `skills/spec-code-review/references/walkthrough.md`
  - per-finding option D 改为 `Auto-resolve with best judgment on the rest`。
  - 该路径直接 dispatch fixer，不再进入 preview。

**是否同步**

- 同步。

**原因**

- CE 这次改动的核心是修正“过度 defer / 过度预验证”的偏差。
- 它让 fixer 在可执行 fix 上实际尝试，失败再交给用户，而不是先用额外 validator 阻断。

---

### 11. Code review：`suggested_fix` 成为可执行性信号

**CE 改了什么**

- Stage 5 推荐动作规则改为由 `autofix_class` 和 `suggested_fix` 共同决定：

| `autofix_class` | 是否有 `suggested_fix` | 推荐动作 |
|---|---:|---|
| `safe_auto` | 不适用 | Apply，但通常已在 routing question 前自动处理 |
| `gated_auto` | 有 | Apply |
| `gated_auto` | 无 | Defer |
| `manual` | 有 | Apply |
| `manual` | 无 | Defer |
| `advisory` | 不适用 | Acknowledge |

- `manual` 不再天然意味着“不能 apply”。
- `manual` 有 `suggested_fix` 时，说明 reviewer 能给出可辩护的具体修改，best-judgment 可尝试 apply。
- 多 reviewer 冲突时才用保守 tie-break：`Skip > Defer > Apply > Acknowledge`。

**CE diff 文案级依据**

- `ce-code-review/SKILL.md` 修改前：Stage 5 是 `Tie-break the recommended action`，主要根据 reviewer implied actions 选最保守结果，并说明 LFG/walk-through 推荐稳定可审计。
- `ce-code-review/SKILL.md` 修改后：Stage 5 改为 `Derive the recommended action`，新增 mapping：`safe_auto -> Apply`、`gated_auto + suggested_fix -> Apply`、`gated_auto without suggested_fix -> Defer`、`manual + suggested_fix -> Apply`、`manual without suggested_fix -> Defer`、`advisory -> Acknowledge`。
- `ce-code-review/SKILL.md` 修改后新增关键句：`The presence of suggested_fix is the authoritative signal that the agent can act on the finding`。
- `ce-code-review/references/findings-schema.json` 修改前：`suggested_fix` description 是 `Concrete minimal fix. Omit or null if no good fix is obvious`；修改后：要求只要能从 diff、周边代码、parallel pattern、framework convention 给出 defensible code change，就应提供。
- `ce-code-review/references/subagent-template.md` 修改前：`suggested_fix is optional. Only include it when the fix is obvious and correct`；修改后：`Propose a suggested_fix whenever any defensible code change is reachable from the diff and surrounding code`。
- `ce-code-review/references/walkthrough.md` 修改后新增规则：没有 `suggested_fix` 时隐藏 Apply，菜单只显示 Defer/Skip/Auto-resolve with best judgment on the rest，避免展示不可执行 Apply。

**spec-first 要怎么改**

- `skills/spec-code-review/SKILL.md`
  - 更新 Stage 5 action mapping。
- `skills/spec-code-review/references/walkthrough.md`
  - 无 `suggested_fix` 时隐藏 Apply 选项。
- `skills/spec-code-review/references/findings-schema.json`
  - 扩展 `suggested_fix` 字段说明。
- `skills/spec-code-review/references/subagent-template.md`
  - 要求 reviewer 在能给出 defensible code change 时尽量提供 `suggested_fix`。

**是否同步**

- 同步。

---

### 12. Code review：safe_auto rubric 降低过度保守

**CE 改了什么**

- `subagent-template.md` 扩展 `safe_auto` 判断：
  - 修复是 local deterministic。
  - 一句话能说明，没有 “depends on”。
  - 不改变 function signature、public API、error contract、security posture、permission model。
- 明确一些常被误判为 risky 的情况仍可 `safe_auto`：
  - internal function nil guard。
  - 有 parallel pattern 支撑的 off-by-one 修复。
  - scope 内可证明的 dead-code removal。
  - 机械 helper extraction。
- `gated_auto` 用于 contract/permission/module boundary 变化。
- `manual` 应尽量带 `suggested_fix`，只有真的需要业务上下文或跨团队决策才省略。

**CE diff 文案级依据**

- `ce-code-review/references/findings-schema.json` 修改前：`autofix_class` description 是 `Reviewer's conservative recommendation for how this issue should be handled after synthesis`；修改后：改为 downstream fixer dispatch routing class，并明确 `safe_auto` 的 one-sentence/no-depends/no contract-change 测试。
- `ce-code-review/references/subagent-template.md` 修改前：`safe_auto` 例子只列 duplicated helper、nil/null check、off-by-one、missing test、dead code；修改后：增加 `wrong-side cost is symmetric`，要求在 rubric 允许时 bias toward `safe_auto`。
- `subagent-template.md` 修改后新增 boundary cases：internal nil guard、parallel pattern 支撑的 off-by-one、scope 内 dead-code removal、mechanical helper extraction。
- `subagent-template.md` 修改前：`gated_auto` 是 concrete fix exists but changes contracts/permissions/crosses module boundary；修改后：收紧为 changes contract/permission/module boundary 或 placement 需要 design conversation。
- `subagent-template.md` 修改后新增警示：不要因为“感觉 substantive”就把 mechanical fix 默认归为 `gated_auto`。

**spec-first 要怎么改**

- 更新 `skills/spec-code-review/references/subagent-template.md`。
- 更新 `skills/spec-code-review/references/findings-schema.json` 中相关 description。

**是否同步**

- 同步。

---

### 13. Doc review：把 LFG 文案改成 best judgment

**CE 改了什么**

- `ce-doc-review` 系列文件主要做术语替换：
  - `LFG` -> `Auto-resolve with best judgment`
  - `LFG the rest` -> `Auto-resolve with best judgment on the rest`
  - `LFG plan` -> `Auto-resolve plan`
- 行为基本不变：
  - doc-review 仍使用 bulk-preview。
  - Open Questions append 机制保持。
  - synthesis 的 confidence anchor 逻辑保持。

**CE diff 文案级依据**

- `ce-doc-review/SKILL.md` 修改前：四选项文案是 `per-finding walk-through, LFG, Append-to-Open-Questions, Report-only`；修改后：`per-finding walk-through, auto-resolve with best judgment, Append-to-Open-Questions, Report-only`。
- `ce-doc-review/SKILL.md` 修改前：bulk-preview 用于 `LFG`、Append-to-Open-Questions 和 walk-through `LFG-the-rest`；修改后：用于 best-judgment routing、Append-to-Open-Questions 和 walk-through `Auto-resolve with best judgment on the rest`。
- `ce-doc-review/references/bulk-preview.md` 修改前：call site 是 `top-level LFG`；修改后：`top-level best-judgment`。
- `bulk-preview.md` 修改前：示例 `LFG plan — 8 findings`；修改后：`Auto-resolve plan — 8 findings`。
- `ce-doc-review/references/open-questions-defer.md` 修改前：duplicate handling 提到 `LFG-the-rest after a walk-through Defer`；修改后：`best-judgment-the-rest after a walk-through Defer`。
- `ce-doc-review/references/synthesis-and-presentation.md` 修改前：`recommended_action` 被 LFG 消费；修改后：被 best-judgment path 消费，并强调 bulk-preview 不 schedule actionless Apply。
- `ce-doc-review/references/walkthrough.md` 修改前：option B 是 `LFG. Apply the agent's best-judgment action per finding`，option D 是 `LFG the rest`；修改后：option B 是 `Auto-resolve with best judgment — apply per-finding edits the agent can defend, surface the rest`，option D 是 `Auto-resolve with best judgment on the rest`。

**spec-first 要怎么改**

- 修改：
  - `skills/spec-doc-review/SKILL.md`
  - `skills/spec-doc-review/references/bulk-preview.md`
  - `skills/spec-doc-review/references/open-questions-defer.md`
  - `skills/spec-doc-review/references/synthesis-and-presentation.md`
  - `skills/spec-doc-review/references/walkthrough.md`
- 只同步用户可见文案和引用一致性，不改变核心 doc-review 执行模型。

**是否同步**

- 同步。

---

### 14. Commit push PR：新增 description-only mode，但不删除 `spec-pr-description`

**CE 改了什么**

- `ce-commit-push-pr/SKILL.md` 新增三种 mode：
  - Description-only generation。
  - Description update on existing PR。
  - Full workflow。
- description-only generation 用于：
  - “write a PR description”
  - “draft a PR description”
  - “describe this PR”
  - 单独粘贴 PR URL / number。
- description-only 不走 full workflow 的 stop gate，避免在“feature branch all pushed open PR”场景直接停止。
- CE 把原 `ce-pr-description` 的写作逻辑抽到：
  - `ce-commit-push-pr/references/pr-description-writing.md`
- CE 删除了 `ce-pr-description/SKILL.md`。
- `ce-commit-push-pr` 开始自己读 reference、组合 body、用 quoted heredoc 写 temp body，再 `gh pr create` / `gh pr edit`。

**CE diff 文案级依据**

- `ce-commit-push-pr/SKILL.md` 修改前：description 触发词覆盖 commit/push/open PR 和 update/refresh/freshen/rewrite existing PR description；修改后：新增 `rewrite the PR body`、`write a PR description`、`draft a PR description`、`describe this PR`，并说明只需要 description 时不会 commit/push。
- 修改前：正文目标是 `Go from working changes to an open pull request, or rewrite an existing PR description`；修改后：`... or generate a description without touching git state`。
- 修改前：只有 description-only update 这个特殊分支；修改后：明确三种 intent：`Description-only generation`、`Description update on existing PR`、`Full workflow`。
- 修改前：description update 会调用 `ce-pr-description` 并消费 `{title, body_file}`；修改后：读取 `references/pr-description-writing.md`，执行 Pre-A 和 Steps A-H，并自己写 temp body 后 `gh pr edit`。
- 修改前：Full workflow Step 6 自己检测 base branch/remote、计算 branch diff，然后 delegate 到 `ce-pr-description`；修改后：Step 6 改为读取 `references/pr-description-writing.md`，由 Pre-A 解析 commit range 和 diff，再继续 Steps A-H composition。
- 修改前：`gh pr create` / `gh pr edit` 读取 `<BODY_FILE>`；修改后：使用 quoted heredoc 创建 `BODY_FILE=$(mktemp ...)`，再 `--body "$(cat "$BODY_FILE")"`。
- 新增文件索引：`plugins/compound-engineering/skills/ce-commit-push-pr/references/pr-description-writing.md`。
- 删除文件依据：`plugins/compound-engineering/skills/ce-pr-description/SKILL.md` 被删除；该文件原先是 standalone PR title/body generator，返回 `{title, body_file}` 且不调用 `gh pr create/edit`。

**spec-first 要怎么改**

- `skills/spec-pr-description/SKILL.md` 是唯一 PR title/body 生成器，保留为公共 workflow，不删除。
- `skills/git-commit-push-pr/SKILL.md` 只承担三件事：
  - 识别 description-only / description update / full workflow intent。
  - 对 description-only 和 description update 跳过 full workflow 的 commit/push stop gate。
  - 调用 `spec-pr-description` 取得 title/body 后执行 `gh pr create` 或 `gh pr edit` 的应用动作。
- CE `pr-description-writing.md` 中如果存在当前 `spec-pr-description` 缺失的 Pre-A/base/fork/body 处理能力，只能合并进 `skills/spec-pr-description/SKILL.md`。
- 不在 `skills/git-commit-push-pr/references/` 新增 `pr-description-writing.md`，避免形成第二套写作真相源。
- quoted heredoc 写临时 PR body 属于 shell 应用安全细节，放在 `git-commit-push-pr` 的 apply 步骤里，不承担写作决策。
- 不新增 stale cleanup。

**是否同步**

- 部分同步。

**不同步原因**

- CE 的删除是 CE 自身 workflow 暴露面调整：把原 `ce-pr-description` 的写作逻辑迁入 `ce-commit-push-pr/references/pr-description-writing.md`，并通过 legacy cleanup 把旧 skill 标为 stale。
- spec-first 当前不是同构状态：`skills/spec-pr-description/SKILL.md` 仍是公开 workflow，`skills/using-spec-first/SKILL.md` 明确把 PR description 写作路由到 `$spec-pr-description`，`tests/smoke/cli.sh` 也要求存在 `pr-description.md` 运行时命令。
- `skills/git-commit-push-pr/SKILL.md` 当前把 title/body 生成委托给 `spec-pr-description`，自己负责 commit/push/PR apply。这个边界符合 `docs/10-prompt/项目角色.md` 的“脚本/流程应用”和“LLM 写作决策”职责分离。
- 如果按 CE 直接删除，必须同步改 `using-spec-first` 路由、governance manifest、runtime command 生成、README/用户手册、`git-commit-push-pr` 写作流程、smoke/unit tests 和可能的 legacy cleanup。这已经不是本次“CE diff 局部同步”的范围，而是一次公共 workflow 退休方案。
- 更重要的是，删除后只有两条路：把完整写作逻辑复制进 `git-commit-push-pr`，或新增同名 reference。前者会让 `git-commit-push-pr` 同时承担写作决策和 PR 应用，后者会和 `spec-pr-description` 形成多真相源。两者都不符合 spec-first 当前边界。

因此本轮的正确同步方式是：吸收 CE 新增 `pr-description-writing.md` 中对 base/PR/fork/API fallback、quoted heredoc 等有价值的能力，但把这些能力合并进 `spec-pr-description` 或 `git-commit-push-pr` 的对应局部边界；不删除 `spec-pr-description`，也不创建第二套 PR 写作 reference。

---

### 15. Debug：修复后 handoff 改为 branch-aware

**CE 改了什么**

- `ce-debug/SKILL.md` Phase 4 改动较大。
- 旧行为：
  - Phase 3 修复后，总是问用户下一步：
    - commit。
    - commit and PR。
    - compound。
    - post issue。
- 新行为：
  - 如果 debug skill 在 Phase 3 创建了分支：
    - 先检查上下文是否有冲突规则。
    - 没有冲突时，预告将 commit + open PR，然后默认执行 `/ce-commit-push-pr`。
  - 如果是 pre-existing branch：
    - 仍然询问用户。
  - PR 打开后，再判断是否提供 compound capture：
    - mechanical fix 默认不提示。
    - 能一句话说明 generalizable lesson 时中性提示。
    - pattern 出现 3+ 处或暴露共享依赖/框架/约定错误假设时重点提示。
- post-mortem 阶段不再直接问 “Want to capture it with /ce-compound?”，改为为 Phase 4 判断提供依据。

**CE diff 文案级依据**

- 修改前：Phase 3 后的 post-mortem 文案直接问 `If a systemic gap was found: "This pattern appears in N other files. Want to capture it with /ce-compound?"`；修改后：改为 `Analyze how this was introduced...`，仅把 systemic gap 作为 Phase 4 是否 offer learning capture 的依据。
- 修改前：Phase 4 只要 Phase 3 跑过，就立即通过 blocking question 问用户下一步，不能停在 passive phrasing。
- 修改后：Phase 4 改成 `the next move depends on whether the skill created the branch in Phase 3`。
- 修改前：选项包含 `Commit the fix (/ce-commit)`、`Commit and open a PR (/ce-commit-push-pr)`、`Document as a learning first (/ce-compound)`、`Post findings to the issue first`。
- 修改后：skill-owned branch 分支先检查上下文 override，再预告 commit/branch/PR，然后默认运行 `/ce-commit-push-pr`，并在 issue tracker entry 时加入 auto-close syntax。
- 修改后：pre-existing branch 分支才问用户，选项收缩为 `Commit and open a PR`、`Commit the fix`、`Stop here`。
- 修改后：PR 打开后新增 learning capture 判断：mechanical fix skip silently；一句话可泛化 lesson 时 neutral offer；3+ locations 或共享依赖/框架/约定错误假设时 lean into offer。

**spec-first 要怎么改**

- `skills/spec-debug/SKILL.md`
  - 同步 branch-aware handoff。
  - 将 `/ce-commit-push-pr` 改为 spec-first 对应入口。
  - 将 `/ce-commit`、`/ce-compound`、`/ce-brainstorm` 改为 spec-first 对应入口。
  - 检查当前 `AGENTS.md` 是否允许 skill-created branch 自动 commit/PR；如果冲突，保留询问。

**是否同步**

- 同步，按 `AGENTS.md` 和任务上下文中的 commit/PR guard 执行。

**风险**

- 这是用户可见行为变化。
- 当 `AGENTS.md`、任务上下文或当前 branch 状态要求显式确认时，不能无阻塞执行 commit/PR，必须退回询问。

---

### 16. Feature video：浏览器截图等待改进

**CE 改了什么**

- `ce-demo-reel/references/tier-browser-reel.md`
  - `agent-browser wait 2000` 改为：
    - `agent-browser wait --load networkidle`
    - 再 `agent-browser wait 1000`
  - 增加 websocket/long-polling 场景说明：
    - 用 `agent-browser wait --text "<known content>"`
    - 或 `agent-browser wait --fn "<expression>"`

**CE diff 文案级依据**

- 修改前：browser tier 示例在 `agent-browser open [URL]` 后运行 `agent-browser wait 2000`。
- 修改后：改为先 `agent-browser wait --load networkidle`，再额外 `agent-browser wait 1000`。
- 修改前：说明是 `Wait 2-3 seconds after navigation for the page to settle`。
- 修改后：说明固定 wait 不足以覆盖 SPA，因为可能截到 empty shell；websocket/long-polling 页面应使用 `agent-browser wait --text "<known content>"` 或 `agent-browser wait --fn "<expression>"`。

**spec-first 要怎么改**

- `skills/feature-video/references/tier-browser-reel.md`
  - 同步等待策略和说明。

**是否同步**

- 同步。

---

### 17. Feature video：新增 blank frame guard

**CE 改了什么**

- `ce-demo-reel/scripts/capture-demo.py`
  - 新增 `DEFAULT_MIN_FRAME_BYTES = 20 * 1024`。
  - `_stitch_frames` 新增 `min_frame_bytes` 参数。
  - stitch 前检查每个 frame 文件大小。
  - 小于阈值时报错，提示可能截图时页面还没加载完。
  - 可用 `--min-frame-bytes 0` 禁用。
  - GIF 自动降帧递归调用时保留该阈值。
  - `screenshot-reel` 使用 silicon 渲染代码帧，主动传 `min_frame_bytes=0`，避免误杀。
  - argparse 为 `stitch` 增加 `--min-frame-bytes`。

**CE diff 文案级依据**

- 修改前：脚本只有 `TARGET_GIF_SIZE = 5 * 1024 * 1024`；修改后：新增 `DEFAULT_MIN_FRAME_BYTES = 20 * 1024`。
- 修改前：`_stitch_frames(output, frames, duration=3.0)`；修改后：`_stitch_frames(output, frames, duration=3.0, min_frame_bytes=DEFAULT_MIN_FRAME_BYTES)`。
- 修改后：stitch 前对每个 frame 执行 `Path(f).stat().st_size`，小于阈值时报错，提示可能页面未加载完，并建议 `--min-frame-bytes 0` 或重新用 `agent-browser wait --load networkidle` 捕获。
- 修改前：GIF 降帧递归调用 `_stitch_frames(output, reduced, duration)`；修改后：传递 `min_frame_bytes`。
- 修改前：`cmd_stitch` 直接 `_stitch_frames(args.output, args.frames, args.duration)`；修改后：传入 `args.min_frame_bytes`。
- 修改后：`cmd_screenshot_reel` 为 silicon-rendered code frames 明确传 `min_frame_bytes=0`。
- 修改后：argparse 为 `stitch` 增加 `--min-frame-bytes`，help 说明小 frame 通常代表 blank screenshot，设为 0 可禁用。

**spec-first 要怎么改**

- `skills/feature-video/scripts/capture-demo.py`
  - 同步上述逻辑。
  - 注释中的 CE 命名改成 spec-first/feature-video 语义。

**是否同步**

- 同步。

**原因**

- 这是确定性质量检查，能防止把空白 shell 截图拼成 PR demo。

---

### 18. Work / Work-beta：并行 subagent worktree 隔离

**CE 改了什么**

- `ce-work` 和 `ce-work-beta` 的并行策略更新：
  - 如果 file overlap 且没有 worktree isolation，降级 serial。
  - 如果有 worktree isolation，即使 overlap 也可并行，冲突留到 merge 阶段处理。
  - Claude Code `Agent` 可传：
    - `isolation: "worktree"`
    - `run_in_background: true`
  - 每个 subagent 在自己的 worktree branch 内运行。
  - batch 完成后：
    - 按依赖顺序 review diff。
    - subagent 未 commit 时，在该 worktree 内 stage/commit。
    - 顺序 merge 回 orchestrator branch。
    - 如果 merge conflict，`git merge --abort`，把冲突 unit 按当前 tree serial 重派。
    - 每次 merge 后跑相关测试。
    - cleanup：
      - `git worktree unlock <absolute-path>`
      - `git worktree remove <absolute-path>`
      - `git branch -d <branch-name>`
  - commit ownership 分成：
    - worktree-isolated：subagent 可在自己 branch stage/commit。
    - shared-directory fallback：subagent 不 commit，orchestrator 批后 commit。

**CE diff 文案级依据**

- `ce-work/SKILL.md` 和 `ce-work-beta/SKILL.md` 修改前：只要发现 file overlap，就 `downgrade to serial subagents`。
- 修改后：拆成两条：`overlap AND worktree isolation is unavailable` 时 serial；`overlap AND worktree isolation is available` 时仍可 parallel，冲突交给 post-batch merge flow。
- 修改前：并行 subagent 共享工作目录会有 index contention/test interference，靠 parallel constraints 缓解。
- 修改后：新增 `Subagent isolation`：Claude Code `Agent` 传 `isolation: "worktree"` 和 `run_in_background: true`；其他没有内建 worktree isolation 的平台共享 orchestrator directory。
- 修改前：`Parallel subagent constraints` 对所有并行 subagent 生效，要求不 stage/commit、不跑 project test suite。
- 修改后：改为 `Shared-directory fallback constraints`，只在无 worktree isolation 时适用；有 worktree isolation 时 subagent 可在自己 worktree branch stage/commit/run unit tests。
- 修改前：batch 完成后的处理只有 shared-directory 整合流程。
- 修改后：新增 worktree-isolated post-batch flow：wait all、review worktree diff、必要时在 worktree 内 commit、按依赖顺序 merge、冲突时 `git merge --abort` 并 serial 重派、每次 merge 后跑测试、unlock/remove worktree、delete branch。
- 修改前：parallel subagent 不 commit，由 orchestrator 批后提交；修改后：commit ownership 分裂为 worktree-isolated subagent 可提交、shared-directory fallback 仍由 orchestrator 提交。

**spec-first 要怎么改**

- `skills/spec-work/SKILL.md`
- `skills/spec-work-beta/SKILL.md`

必须适配，不可照搬：

- Claude Code 的 worktree isolation 使用 CE 表述，并保留 Claude Code 专属条件。
- Codex `spawn_agent` 在本环境中是 forked workspace/agent 语义，不应直接写成“和 orchestrator 共享目录”，除非当前 host 文档确认。
- `spec-work-beta/references/codex-delegation-workflow.md` 已有 Codex delegation 规则，必须避免与新 worktree 文案冲突。

目标文案必须使用以下 host capability matrix，不能把 CE 的 Claude Code worktree 语义泛化为所有 host：

| 执行环境 | 是否并行 | 是否隔离 | subagent stage/commit | 测试权限 | 冲突处理 | 本次处理 |
|---|---|---|---|---|---|---|
| Claude Code Agent + `isolation: "worktree"` | 允许 | 每个 subagent 独立 worktree/branch | 允许在子 worktree stage/commit | 允许跑相关测试；merge 后 orchestrator 再跑相关测试 | orchestrator 按依赖顺序 merge；冲突时 abort，把冲突 unit 改为 serial 重派 | 同步 CE worktree isolation 策略 |
| Claude Code shared directory / 无 isolation | 仅无重叠任务允许并行；有 overlap 降级 serial | 不隔离 | 禁止 subagent stage/commit | subagent 只跑窄验证；full suite 由 orchestrator 执行 | orchestrator 在共享目录内统一整合 | 同步 fallback 规则 |
| Codex `spec-work-beta` delegation | 按 `skills/spec-work-beta/references/codex-delegation-workflow.md` 执行 | 以 Codex delegation/fork workspace 的实际能力为准 | 默认由 orchestrator 负责 git 操作 | 默认由 orchestrator 负责最终验证；delegated worker 只执行分配范围内验证 | 不引入 CE worktree merge/cleanup 文案 | 本次只审查是否与新文案冲突，不改写 delegation 主流程 |
| Codex host 无可靠隔离能力 | overlap 降级 serial 或 inline | 不可靠隔离视为不隔离 | 禁止 subagent stage/commit | orchestrator 执行最终验证 | orchestrator 串行处理 | 写入 shared-directory fallback |
| 无 subagent 工具 | 不并行 | 无隔离 | 不适用 | 当前 agent 执行验证 | inline/serial | 写入 fallback |

如果后续执行时无法从 host 文档或现有 skill 文案确认隔离能力，U10 只落地 shared-directory fallback 和 Codex delegation 边界；worktree-isolated 自动并行另开 spike，不在本轮实现。

**是否同步**

- 同步思想，不能机械同步文案。

---

### 19. Tracker defer：artifact 路径同步

**CE 改了什么**

- 多个 `tracker-defer.md` 把 code-review artifact pointer 从 `.context/...` 改成 `/tmp/...`。
- 涉及：
  - `ce-code-review/references/tracker-defer.md`
  - `ce-work/references/tracker-defer.md`
  - `ce-work-beta/references/tracker-defer.md`
  - `lfg/references/tracker-defer.md`

**CE diff 文案级依据**

- `ce-code-review/references/tracker-defer.md` 修改前：`why_it_matters` 从 `.context/compound-engineering/ce-code-review/<run-id>/{reviewer}.json` 读取；修改后：从 `/tmp/compound-engineering/ce-code-review/<run-id>/{reviewer}.json` 读取。
- `ce-code-review/references/tracker-defer.md` 修改前：超长 ticket body 截断提示是 `continued in ce-code-review run artifact: .context/compound-engineering/ce-code-review/<run-id>/`；修改后：`continued in ce-code-review run artifact: /tmp/compound-engineering/ce-code-review/<run-id>/`。
- `ce-work/references/tracker-defer.md`、`ce-work-beta/references/tracker-defer.md`、`lfg/references/tracker-defer.md` 做了同样的两处替换：artifact JSON 读取路径和超长 body artifact pointer。
- 这些 diff 只改 artifact pointer，不改变 tracker detection、ticket body 字段、fallback chain 或 no-sink 行为。

**spec-first 要怎么改**

- 对应文件改成：
  - `/tmp/spec-first/spec-code-review/<run-id>/`

**是否同步**

- 同步。

---

### 20. CE legacy cleanup：当前不迁移

**CE 改了什么**

- `src/data/plugin-legacy-artifacts.ts`
  - `EXTRA_LEGACY_ARTIFACTS_BY_PLUGIN["compound-engineering"].skills` 增加 `ce-pr-description`。
- `src/utils/legacy-cleanup.ts`
  - `STALE_SKILL_DIRS` 增加 `ce-pr-description`。
  - `LEGACY_ONLY_SKILL_DESCRIPTIONS` 增加 `ce-pr-description` 的历史 description。

**CE diff 文案级依据**

- `src/data/plugin-legacy-artifacts.ts` 修改前：`compound-engineering` 的 extra legacy skills 中没有 `ce-pr-description`；修改后：新增 `"ce-pr-description"`。
- `src/utils/legacy-cleanup.ts` 修改前：`STALE_SKILL_DIRS` 中没有 `ce-pr-description`；修改后：新增 `"ce-pr-description"`。
- `src/utils/legacy-cleanup.ts` 修改前：`LEGACY_ONLY_SKILL_DESCRIPTIONS` 没有 `ce-pr-description` 描述；修改后：新增完整旧 description，内容说明它是 value-first PR title/body generator，被 `ce-commit-push-pr` 和 `ce-pr-stack` 复用，返回 `{title, body_file}` 且不编辑 PR。
- 该 diff 的语义是：CE 把已删除的 `ce-pr-description` 标记为 legacy-only artifact，供插件升级清理旧安装副本；它不是通用 PR description 能力改进。

**spec-first 要怎么改**

- 当前不改。

**不改原因**

- spec-first 当前没有 CE converter 的这套 `src/data/plugin-legacy-artifacts.ts` / `src/utils/legacy-cleanup.ts` 架构。
- spec-first 不删除 `spec-pr-description`。
- 因此没有 stale skill 需要 cleanup。

**是否同步**

- 不同步。

---

## 实施单元

所有实施单元共享同一执行姿势：**新增文件可按目标路径创建；修改文件只能做局部 patch；删除文件不能直接删除 spec-first 对应资产。** 每个单元开始前先读取目标文件当前内容，确认本地已有 spec-first 改动，再按 CE diff 的行为意图落地局部替换。

### U1. 更新仓库维护说明

**目标**

把 CE 新增的 agent/skill 行为验证规则改写为 spec-first 中文规则。

**改动文件**

- `AGENTS.md`
- `CLAUDE.md`：仅当该文件存在同一 source/runtime 治理段落时同步同义内容；不存在则不新增。
- `README.md` / `README.zh-CN.md`：仅当已有 `git-commit-push-pr` 或技能清单条目时更新对应描述；不存在则不新增清单。

**具体改动**

- 新增“验证 agent / skill 行为变更”小节。
- 说明 host session 可能缓存 skill/agent prose。
- 说明验证行为变更时要读取当前 source asset，不要编辑 runtime cache。
- 强调 `.codex/` / `.claude/` 是生成资产，不是 source of truth。
- 不复制 CE 的 skill count。

**替换边界**

- `AGENTS.md`：只插入一个新增小节或补充既有验证小节，不重写仓库指南。
- `CLAUDE.md`：仅当存在同义段落时做局部补充。
- `README.md` / `README.zh-CN.md`：只改已有 `git-commit-push-pr` 描述，不改全量 skill 清单结构。

**验证**

- 人工检查：新增规则必须明确 source asset、runtime asset、host cache 三者边界。
- 若改到 runtime governance、init、doctor 或 install 文案，运行 `npm run typecheck` 和 `npm run test:unit`。

---

### U2. 同步 PR feedback 的 `declined` verdict

**目标**

让 spec-first 在处理 PR review feedback 时能明确拒绝“会让代码变差”的建议。

**改动文件**

- `agents/spec-pr-comment-resolver.agent.md`
- `skills/resolve-pr-feedback/SKILL.md`

**具体改动**

- agent verdict enum 增加 `declined`。
- agent triage 规则增加“建议有害”分支。
- skill workflow 中增加 declined verdict 说明。
- no-files-changed 条件包含 `declined`。
- reply template 增加 `Declined: ...`。
- summary 增加 Declined 分组。

**替换边界**

- `agents/spec-pr-comment-resolver.agent.md`：只改 triage 分类、reply template、return enum 相关段落。
- `skills/resolve-pr-feedback/SKILL.md`：只改 verdict 定义、files_changed 聚合条件、reply template 和 summary 分组。

**验证**

- 更新或新增 `tests/unit/resolve-pr-feedback-contracts.test.js`，断言 `skills/resolve-pr-feedback/SKILL.md` 包含 `declined` verdict、`Declined:` reply、no-files-changed 条件和 summary 分组。
- 更新或新增 `tests/unit/spec-pr-comment-resolver-contracts.test.js`，断言 `agents/spec-pr-comment-resolver.agent.md` 的 verdict enum 包含 `declined`，且分类规则覆盖“建议有害但 reviewer 可能指出真实问题”的场景。

---

### U3. 同步 session history 精准检索

**目标**

减少 historian 无关 session 抽取，支持 keyword relevance ranking。

**改动文件**

- `agents/spec-session-historian.agent.md`
- `skills/spec-session-inventory/SKILL.md`
- `skills/spec-session-inventory/scripts/extract-metadata.py`
- `skills/spec-sessions/SKILL.md`

**具体改动**

- historian 加入禁止“extract to check relevance”的规则。
- historian 使用 branch -> keyword -> cap 的选择流程。
- historian 加入 5 session deep-dive cap。
- historian tail extraction 改为条件触发。
- session inventory 支持 `--keyword`。
- metadata script 只扫描 user/assistant 文本。
- repo name pre-resolved 命令修复相对 `.git` / `../.git` 场景。

**替换边界**

- `agents/spec-session-historian.agent.md`：只替换 relevance gating、time budget、repo name derive、Step 3/Step 4。
- `skills/spec-session-inventory/SKILL.md`：只补 `--keyword` 参数和输出字段。
- `skills/spec-session-inventory/scripts/extract-metadata.py`：只增函数、参数解析和过滤顺序，不重排既有 metadata extraction。
- `skills/spec-sessions/SKILL.md`：只替换 repo name pre-resolved shell snippet。

**验证**

- 更新或新增 `tests/unit/session-history-scripts.test.js`：
  - `--keyword` 命中 user/assistant 真实对话文本。
  - `--keyword` 不命中 JSONL metadata、tool call、tool result、thinking/reasoning block。
  - CWD filter 先于 keyword scan，其他 repo 的 Codex session 不参与匹配。
  - 无匹配和空输入两种场景都稳定输出 `_meta.files_matched: 0`。
- 更新或新增 `tests/unit/spec-sessions-contracts.test.js`，断言 `skills/spec-sessions/SKILL.md` 使用 `case "$common" in /*)` 处理相对 `.git` / `../.git`。

---

### U4. 同步 compound frontmatter parser-safety

**目标**

为 spec-first 的 `docs/solutions/` 生成和替换流程增加 deterministic frontmatter 安全检查。

**改动文件**

- `skills/spec-compound/SKILL.md`
- `skills/spec-compound/scripts/validate-frontmatter.py`
- `skills/spec-compound-refresh/SKILL.md`
- `skills/spec-compound-refresh/scripts/validate-frontmatter.py`

**具体改动**

- compound 写完 learning 后运行 validator。
- compound-refresh replacement 写完 successor 后运行 validator，成功后才能删除旧文档。
- validator 检查：
  - 严格 `---` delimiter。
  - unquoted ` #`。
  - unquoted `: `。
- validator 不做 schema enum / required field 校验。

**替换边界**

- `skills/spec-compound/SKILL.md`：只插入 pre-resolved context、收紧 historian dispatch prompt、写后 validator 步骤。
- `skills/spec-compound-refresh/SKILL.md`：只在 Replace Flow 插入 validator 运行与失败处理。
- 两个 `validate-frontmatter.py` 是新文件，可直接创建，但 docstring 和路径说明必须 spec-first 化。

**验证**

- 新增 `tests/unit/frontmatter-validator.test.js`：
  - `----` 不能作为合法 frontmatter 结束 delimiter。
  - unquoted `title: foo # bar` 失败。
  - unquoted `title: foo: bar` 失败。
  - quoted `"foo # bar"` 和 `"foo: bar"` 通过。
  - validator 不要求 schema required field，也不检查 enum。

---

### U5. 同步 code-review best-judgment 改造

**目标**

把 code review 从 LFG / pre-validator bias 改成以 `suggested_fix` 为核心的 best-judgment 可执行路径。

**改动文件**

- `skills/spec-code-review/SKILL.md`
- `skills/spec-code-review/references/bulk-preview.md`
- `skills/spec-code-review/references/findings-schema.json`
- `skills/spec-code-review/references/subagent-template.md`
- `skills/spec-code-review/references/tracker-defer.md`
- `skills/spec-code-review/references/walkthrough.md`
- `skills/spec-work/references/tracker-defer.md`
- `skills/spec-work-beta/references/tracker-defer.md`
- `skills/lfg/references/tracker-defer.md`

**具体改动**

- `skills/spec-code-review/SKILL.md`
  - artifact 路径改成 `/tmp/spec-first/spec-code-review/<run-id>/`。
  - user-facing `LFG` 改成 `Auto-resolve with best judgment`。
  - best-judgment 路径不再进入 Stage 5b validator pre-pass。
  - best-judgment 路径不再使用 `bulk-preview.md`。
  - recommended action 使用 `autofix_class + suggested_fix`。
  - fixer queue 支持 heterogeneous items。
  - fixer 返回 `applied` / `failed` / `advisory`。
  - failed bucket 先交互处理，再输出 final report。
- `skills/spec-code-review/references/bulk-preview.md`
  - 只保留 file tickets option C。
  - 明确 best-judgment 不经过 bulk preview。
- `skills/spec-code-review/references/walkthrough.md`
  - 无 `suggested_fix` 时隐藏 Apply。
  - `Auto-resolve with best judgment on the rest` 直接 dispatch fixer。
  - no tracker 文案写为“当前 checkout 未配置 issue tracker”，不出现 `tracker sink` / `platform`。
- `skills/spec-code-review/references/subagent-template.md`
  - artifact 路径改成 `/tmp/spec-first/spec-code-review/<run-id>/`。
  - safe_auto rubric 增加 local deterministic、no public contract change、no permission/security posture change 等边界。
  - manual finding 能给出可辩护代码改动时必须带 `suggested_fix`。
- `skills/spec-code-review/references/findings-schema.json`
  - 扩展 `autofix_class` / `suggested_fix` description。
  - 写明 `safe_auto` 需要测试或可证明的局部确定性依据。
  - 写明 `suggested_fix` 不允许 soft punt。
- `skills/spec-code-review/references/tracker-defer.md`、`skills/spec-work/references/tracker-defer.md`、`skills/spec-work-beta/references/tracker-defer.md`、`skills/lfg/references/tracker-defer.md`
  - artifact pointer 统一改为 `/tmp/spec-first/spec-code-review/<run-id>/`。

**替换边界**

- 禁止用 CE `ce-code-review` 文件覆盖 `skills/spec-code-review/**`。
- `SKILL.md` 按段落替换 Stage 5、Stage 5b、Interactive Step 2、fixer return shape、failed bucket 和 artifact path。
- `bulk-preview.md` 改为 option C-only，但只在 code-review 下执行；不要把该收缩套到 doc-review。
- `findings-schema.json` 只改两个 description 字段。
- tracker-defer 类文件只替换 artifact pointer，不改 tracker 发现逻辑。

**验证**

- 更新 `tests/unit/spec-code-review-contracts.test.js`。
- 断言 `skills/spec-code-review/SKILL.md` 使用 `/tmp/spec-first/spec-code-review/<run-id>/`，不再出现 `.context/compound-engineering`。
- 断言 best-judgment 路径不调用 `bulk-preview.md`，bulk preview 只服务 file tickets option C。
- 断言 Stage 5 action mapping 同时读取 `autofix_class` 和 `suggested_fix`。
- 断言 walkthrough 在无 `suggested_fix` 时隐藏 Apply。
- 断言 no tracker 文案为“当前 checkout 未配置 issue tracker”，不出现 `tracker sink` / `platform` 这类内部术语。
- 断言 fixer completion 在 failed bucket 处理后才输出 final report。

---

### U6. 同步 doc-review best-judgment 文案

**目标**

统一 doc review 用户交互中的术语，去掉 LFG 文案。

**改动文件**

- `skills/spec-doc-review/SKILL.md`
- `skills/spec-doc-review/references/bulk-preview.md`
- `skills/spec-doc-review/references/open-questions-defer.md`
- `skills/spec-doc-review/references/synthesis-and-presentation.md`
- `skills/spec-doc-review/references/walkthrough.md`

**具体改动**

- `LFG` 改为 `Auto-resolve with best judgment`。
- `LFG the rest` 改为 `Auto-resolve with best judgment on the rest`。
- 不改变 doc-review 的 bulk-preview 执行模型。

**替换边界**

- 只做用户可见术语替换和引用一致性修正。
- 明确不迁移 code-review 的 option C-only bulk-preview 变化。

**验证**

- 更新或新增 `tests/unit/spec-doc-review-contracts.test.js`：
  - routing question、walkthrough option、bulk-preview header、completion wording 等用户可见路径不再暴露 `LFG` 文案。
  - option B/D 文案分别为 `Auto-resolve with best judgment` 和 `Auto-resolve with best judgment on the rest`。
  - `bulk-preview.md` 的执行模型仍保留，不被 code-review 的 option C-only 规则误改。

---

### U7. 同步 git-commit-push-pr 的 description-only 能力

**目标**

让 `git-commit-push-pr` 支持只生成 PR description，但不删除 `spec-pr-description`。

**改动文件**

- `skills/git-commit-push-pr/SKILL.md`
- `skills/spec-pr-description/SKILL.md`

**具体改动**

- 执行前先做 CE `pr-description-writing.md` 与当前 `skills/spec-pr-description/SKILL.md` 的逐段 gap audit：
  - `Pre-A` / base detection / PR ref parsing / fork PR / API fallback。
  - commit classification。
  - evidence preservation / capture handoff。
  - before/after narrative frame。
  - sizing table。
  - writing voice / visual communication / GitHub issue numbering。
  - focus hint。
  - title/body assembly。
  - badge / compression / return contract。
- gap audit 结果按 `already covered` / `missing` / `conflicting` 分类；只对 `missing` 和确有冲突的段落做局部 patch。
- 增加 mode detection：
  - description-only generation。
  - description update。
  - full workflow。
- description-only 跳过 full workflow stop gate。
- `git-commit-push-pr` 调用 `spec-pr-description` 生成 title/body，自己只负责 `gh pr create` / `gh pr edit` 应用。
- 引入 quoted heredoc 写 PR body 的安全方式，仅用于写临时 body 文件。
- `skills/spec-pr-description/SKILL.md` 承接 CE `pr-description-writing.md` 中当前缺失的 Pre-A/base/fork/body 处理能力。
- `spec-pr-description` 保持为唯一写作源和公共 workflow。

**替换边界**

- `skills/git-commit-push-pr/SKILL.md`：只新增 intent detection、stop gate 跳过、调用 `spec-pr-description` 的薄委托和 quoted heredoc apply。
- `skills/spec-pr-description/SKILL.md`：只把 gap audit 判定为 `missing` 或 `conflicting` 的 Pre-A/base/fork/body 等能力合并进现有写作流程；已覆盖内容不得重复迁入。
- 不把 CE `pr-description-writing.md` 作为新 reference 落盘。

**明确不做**

- 不删除 `skills/spec-pr-description/SKILL.md`。
- 不新增 `spec-pr-description` stale cleanup。
- 不新增 `skills/git-commit-push-pr/references/pr-description-writing.md`。

**验证**

- 更新或新增 `tests/unit/git-commit-push-pr-contracts.test.js`：
  - “write a PR description” / “draft a PR description” / 单独 PR URL 进入 description-only mode。
  - description-only mode 不触发 commit/push stop gate。
  - `git-commit-push-pr` 文案委托 `spec-pr-description`，不包含完整 PR body 写作模板。
  - 不存在 `skills/git-commit-push-pr/references/pr-description-writing.md`。
- 更新 `tests/unit/using-spec-first-contracts.test.js`，断言 `$spec-pr-description` 仍是公开可路由 workflow。
- 人工检查或实现记录必须包含 U7 gap audit 表，说明 CE 新 reference 的每个主要步骤在 spec-first 中是 `already covered`、`missing` 还是 `conflicting`。

---

### U8. 同步 debug 的 branch-aware handoff

**目标**

让 debug 修复后的下一步根据 branch ownership 决定，而不是总是同一菜单。

**改动文件**

- `skills/spec-debug/SKILL.md`

**具体改动**

- Phase 3 如果 skill 创建了 branch：
  - 检查上下文是否禁止自动 PR。
  - 无冲突时预告并进入 commit-and-PR。
- 如果是 pre-existing branch：
  - 继续询问用户。
- compound capture 只在有 generalizable lesson 时提示。

**替换边界**

- 只改 Phase 4 handoff 和 compound capture 判断。
- 保留 spec-first 当前调试阶段、验证阶段和项目治理 guard。

**验证**

- 更新或新增 `tests/unit/spec-debug-contracts.test.js`：
  - skill-owned branch 分支路径存在。
  - pre-existing branch 仍询问。
  - mechanical fix 不默认提示 compound。
  - 当 `AGENTS.md` 或任务上下文禁止自动 PR 时，skill-owned branch 路径必须退回询问。

---

### U9. 同步 feature-video 截图质量保护

**目标**

降低 PR demo 捕获空白页面的概率。

**改动文件**

- `skills/feature-video/references/tier-browser-reel.md`
- `skills/feature-video/scripts/capture-demo.py`

**具体改动**

- browser capture 使用 `agent-browser wait --load networkidle`。
- 增加 websocket/long-polling 的 `--text` / `--fn` 等待 fallback。
- stitch 增加 `--min-frame-bytes`。
- 小于默认 20KB 的 frame 报错。
- `--min-frame-bytes 0` 可禁用。
- screenshot-reel 禁用该 guard。

**替换边界**

- reference 只替换 browser wait 指令和 ready fallback。
- Python 脚本只增 blank frame guard 相关 constant、参数和调用链，不重写 capture/upload/stitch 其他逻辑。

**验证**

- 更新或新增 `tests/unit/feature-video-contracts.test.js`：
  - tiny frame 默认失败。
  - `--min-frame-bytes 0` 通过。
  - screenshot-reel 不受 guard 影响。
  - `tier-browser-reel.md` 包含 `agent-browser wait --load networkidle` 和 websocket/long-polling 的 `--text` / `--fn` fallback。

---

### U10. 适配 work / work-beta 并行隔离模型

**目标**

吸收 CE 的 worktree isolation 思路，但按 spec-first host 实际能力改写。

**改动文件**

- `skills/spec-work/SKILL.md`
- `skills/spec-work-beta/SKILL.md`
- 审查 `skills/spec-work-beta/references/codex-delegation-workflow.md`

**具体改动**

- 加 host capability matrix。
- 区分：
  - Claude Code worktree-isolated subagent。
  - Codex delegation / fork workspace。
  - shared-directory fallback。
- 有隔离时，overlap 可并行，merge conflict 在回合并时处理。
- 无隔离时，overlap 降级 serial。
- isolated batch merge 后清理 worktree 和 branch。
- shared-directory fallback 仍禁止 subagent stage/commit/full-suite。
- `skills/spec-work-beta/references/codex-delegation-workflow.md` 本轮只做冲突审查；若已清楚表达 Codex delegation 的 orchestrator-owned git 边界，则不修改该 reference。

**替换边界**

- 不复制 CE “其他平台共享 orchestrator directory”的泛化文案。
- `spec-work` / `spec-work-beta` 只插入 host capability matrix 和由矩阵推导的并行/commit/test 规则。
- Codex delegation reference 只有在与 host matrix 直接冲突时才局部修正。

**验证**

- 更新 `tests/unit/spec-work-contracts.test.js`。
- 更新 `tests/unit/spec-work-beta-contracts.test.js`。
- 断言 `spec-work` / `spec-work-beta` 包含 host capability matrix。
- 断言 Claude Code worktree-isolated、shared-directory fallback、Codex delegation 三类路径的 stage/commit/test 权限不同。
- 断言 Codex delegation 不声明 CE 的 `isolation: "worktree"` 能力。
- 运行 `tests/unit/crg-workflow-context-hooks.test.js`，确认 CRG hook contract 不回退。

---

### U11. 明确不迁移 CE legacy cleanup

**目标**

记录 CE cleanup 变更在 spec-first 当前不适用。

**改动文件**

- 无。

**原因**

- CE cleanup 是 compound-engineering plugin converter 的 upgrade cleanup。
- spec-first 当前保留 `spec-pr-description`。
- 没有 stale artifact 需要清理。

---

### U12. 补充 CHANGELOG 治理记录

**目标**

确保后续执行本计划时，所有 source asset 变更满足仓库 changelog 治理要求。

**改动文件**

- `CHANGELOG.md`

**具体改动**

- 执行任何 `skills/`、`agents/`、`src/cli/`、`scripts/`、`AGENTS.md`、`CLAUDE.md`、`README*.md` 或测试文件变更前，读取 `.codex/spec-first/.developer` 作为 `作者`。
- 在根目录 `CHANGELOG.md` 增加一条符合现行格式的记录：
  - `- vX.Y.Z YYYY-MM-DD HH:MM:SS 作者: 一句话摘要`
- 如果同步导致用户可见 workflow 行为变化，记录末尾必须带 `(user-visible)`。
- 只改本计划文档时不需要为后续实现提前写 changelog；真正执行 source asset 变更的同一提交必须包含 changelog。

**验证**

- 运行或复用 `tests/unit/changelog-format.test.js`。
- 人工检查 changelog 记录的作者来自 `.codex/spec-first/.developer`，不是 host 默认用户名猜测。

---

## 推荐执行顺序

执行每一项时先生成局部 patch，不生成整文件替换 patch。新文件单独提交或单独 hunk 创建；已有文件每个 hunk 都要能追溯到 CE diff 的具体意图。

1. **先做低风险确定性脚本**
   - U3 session inventory keyword。
   - U4 frontmatter validator。
   - U9 feature-video blank guard。

2. **再做 PR feedback 和 debug**
   - U2 declined verdict。
   - U8 debug handoff。

3. **再做 review 系列**
   - U5 code-review best-judgment。
   - U6 doc-review wording。

4. **再做 PR description flow**
   - U7。
   - 保留 `spec-pr-description` 的公共入口。

5. **最后做 work/work-beta**
   - U10。
   - 这部分与 host 能力和 delegation 语义最相关，风险最高。

6. **最后补仓库说明**
   - U1。
   - 根据实际同步结果更新文档。

7. **最后补治理记录**
   - U12。
   - 与实际 source asset 变更同批落地。

---

## 风险与控制

| 风险 | 控制方式 |
|---|---|
| 机械删除 `spec-pr-description` 导致公共 workflow 断裂 | 本次明确不删除，另开计划再讨论 |
| CE 的 `/tmp/compound-engineering` 路径混入 spec-first | 统一改成 `/tmp/spec-first/spec-code-review` |
| code-review best-judgment 过度自动化 | 只 apply 有 `suggested_fix` 的项；失败进入 failed bucket 交互 |
| validator 被扩展成 schema engine | 只做 parser-safety，不替代 LLM 内容判断和 schema contract |
| worktree isolation 文案误导 Codex 行为 | U10 使用 host capability matrix；host 能力未确认时只落地 fallback 和 delegation 边界 |
| 修改 generated runtime asset | 只改 source asset；需要 runtime 更新时通过 `spec-first init --codex|--claude` |
| 当前工作区已有未提交改动 | 实施前检查 `git status`，不要覆盖无关改动 |
| 后续实现遗漏 changelog | U12 固定为收尾单元；source asset 变更未写 `CHANGELOG.md` 不算完成 |
| 整文件覆盖导致 spec-first 本地演化丢失 | 本轮禁止覆盖已有目标文件；所有 `M` 状态 CE 文件只能转成局部 patch |
| 新增文件保留 CE 专属语义 | 新建文件也必须改 docstring、路径、artifact、skill name 和 spec-first 命名 |

---

## 验证计划

每个实施单元的最窄验证如下：

| 实施单元 | 测试文件 | 必须断言 |
|---|---|---|
| U1 | `tests/unit/dual-host-governance-contracts.test.js` 或 `tests/unit/instruction-bootstrap.test.js` | source asset / runtime asset / host cache 边界文案存在，且不要求手改 `.claude/` / `.codex/` |
| U2 | `tests/unit/resolve-pr-feedback-contracts.test.js`、`tests/unit/spec-pr-comment-resolver-contracts.test.js` | `declined` enum、reply、summary、no-files-changed 条件齐全 |
| U3 | `tests/unit/session-history-scripts.test.js`、`tests/unit/spec-sessions-contracts.test.js` | keyword 只扫 user/assistant 文本，CWD filter 先于 keyword，`files_matched` 稳定输出，repo name 相对 `.git` 修复存在 |
| U4 | `tests/unit/frontmatter-validator.test.js` | delimiter、unquoted ` #`、unquoted `: `、quoted scalar、非 schema 校验边界 |
| U5 | `tests/unit/spec-code-review-contracts.test.js` | `/tmp/spec-first/spec-code-review` 路径、best-judgment 不走 bulk preview、option C-only bulk preview、`suggested_fix` action mapping、no tracker 文案、failed bucket 顺序 |
| U6 | `tests/unit/spec-doc-review-contracts.test.js` | routing question、walkthrough option、bulk-preview header、completion wording 等用户可见路径不出现 LFG，bulk-preview 模型不变 |
| U7 | `tests/unit/git-commit-push-pr-contracts.test.js`、`tests/unit/using-spec-first-contracts.test.js` | description-only intent 不触发 commit/push gate，`spec-pr-description` 仍是公开路由，未新增第二写作 reference，执行记录包含 PR description gap audit |
| U8 | `tests/unit/spec-debug-contracts.test.js` | skill-owned branch、pre-existing branch、mechanical fix、自动 PR 禁止规则 |
| U9 | `tests/unit/feature-video-contracts.test.js` | networkidle wait、websocket fallback、tiny frame guard、`--min-frame-bytes 0`、screenshot-reel bypass |
| U10 | `tests/unit/spec-work-contracts.test.js`、`tests/unit/spec-work-beta-contracts.test.js`、`tests/unit/crg-workflow-context-hooks.test.js` | host matrix、stage/commit/test 权限分离、Codex 不声明 CE worktree isolation、CRG hook 不回退 |
| U12 | `tests/unit/changelog-format.test.js` | changelog 格式、作者来源、user-visible 标记 |

按实施单元分批执行时，至少运行本表中对应实施单元的测试。若一次性执行 U2-U10 / U12 全量同步，最低验证命令应覆盖全部受影响单元：

```bash
npm run typecheck
npx jest tests/unit/resolve-pr-feedback-contracts.test.js tests/unit/spec-pr-comment-resolver-contracts.test.js --runInBand
npx jest tests/unit/session-history-scripts.test.js tests/unit/spec-sessions-contracts.test.js --runInBand
npx jest tests/unit/frontmatter-validator.test.js --runInBand
npx jest tests/unit/spec-code-review-contracts.test.js --runInBand
npx jest tests/unit/spec-doc-review-contracts.test.js --runInBand
npx jest tests/unit/git-commit-push-pr-contracts.test.js tests/unit/using-spec-first-contracts.test.js --runInBand
npx jest tests/unit/spec-debug-contracts.test.js --runInBand
npx jest tests/unit/feature-video-contracts.test.js --runInBand
npx jest tests/unit/spec-work-contracts.test.js tests/unit/spec-work-beta-contracts.test.js --runInBand
npx jest tests/unit/changelog-format.test.js --runInBand
```

如果本地尚未创建其中某个 contract test 文件，执行者必须先补对应最窄测试，或在实现记录中明确说明该断言合并进了哪个现有测试文件。

新增脚本能力后也可用 pattern 聚合运行：

```bash
npx jest tests/unit --runInBand --testPathPattern='frontmatter|session|feature-video|resolve-pr|doc-review|git-commit|debug|changelog'
```

影响 runtime install 或 generated asset 时再跑：

```bash
npm run test:unit
npm run test:smoke
npm run build
```

影响 host 治理、init、clean 或发布物时跑完整链路：

```bash
npm test
```

---

## 完成标准

- CE 本次非 `docs/`、非 `tests/` 文件变更全部有同步判断。
- 每个需要同步的改动点都有 spec-first 目标文件。
- 每个不应同步的改动点都有明确理由。
- CE 状态为 `M` 的文件没有被整文件覆盖，执行记录能说明每个局部 hunk 的来源和目标段落。
- CE 状态为 `A` 的文件只在计划允许的目标路径新建，并完成 spec-first 命名、路径和 docstring 适配。
- CE 状态为 `D` 的文件没有被机械映射为 spec-first 删除。
- `spec-pr-description` 保留，不因 CE 删除而机械删除。
- `spec-code-review` artifact 路径改为 `/tmp/spec-first/spec-code-review/<run-id>/`。
- `spec-session-inventory` 支持 `--keyword`、`match_count`、`keyword_matches`、`files_matched`。
- `spec-compound` 和 `spec-compound-refresh` 拥有本地 frontmatter validator。
- `feature-video` 支持 blank frame guard。
- `resolve-pr-feedback` 和 `spec-pr-comment-resolver` 支持 `declined`。
- `spec-work` / `spec-work-beta` 明确区分 isolated 与 shared-directory 执行。
- 新增或更新 tests 覆盖所有确定性 contract。
- 后续执行 source asset 变更时，`CHANGELOG.md` 已按项目治理记录本次同步。
