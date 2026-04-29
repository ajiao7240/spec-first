# 2026-04-29 Skill 质量小步审查循环

## 第 1 轮（已修复）
- 问题描述：`proof` 的 frontmatter description 过长，把触发词、排除项和用途全部塞进发现层，增加 skill discovery 噪声。
- 等级：中。
- 具体修复方式：直接修改 `skills/proof/SKILL.md` 的 frontmatter `description`，删除展开式触发词和正文级流程说明，只保留 proof 场景的核心用途与排除边界。
- 基于项目整体思考的最佳解决方案推荐：发现层只保留路由所需的高信号触发与排除条件，复杂协作细节留在正文 contract。
- 修复结论：压缩 `skills/proof/SKILL.md` description。
- 修复效果：降低误触发概率，让 Proof skill 更符合 light contract 的入口边界。

## 第 2 轮（已修复）
- 问题描述：`spec-compound-refresh` description 接近千字符，混入多种案例和否定条件，削弱 skill router 的判别质量。
- 等级：中。
- 具体修复方式：重写 `skills/spec-compound-refresh/SKILL.md` 的 frontmatter `description`，收敛为“维护 `docs/solutions/` stale/overlap/drift 文档”的入口判断，并保留普通 refactor/debug/review 不应触发的边界。
- 基于项目整体思考的最佳解决方案推荐：将入口定义收敛到 `docs/solutions/` 维护场景，明确非目标为普通 refactor/debug/review。
- 修复结论：压缩 `skills/spec-compound-refresh/SKILL.md` description。
- 修复效果：compound refresh 与普通开发工作边界更清楚，减少错误路由。

## 第 3 轮（已修复）
- 问题描述：`spec-plan` description 把软件、旅行、学习、deepening 触发词全部展开，过长且重复正文。
- 等级：中。
- 具体修复方式：修改 `skills/spec-plan/SKILL.md` 的 frontmatter `description`，把 plan/deepen 两类入口压缩成高层用途描述，去掉大量示例领域和正文 workflow 细节。
- 基于项目整体思考的最佳解决方案推荐：发现层保留 plan/deepen 的判别边界，HOW 细节留给 workflow 正文。
- 修复结论：压缩 `skills/spec-plan/SKILL.md` description。
- 修复效果：planning 入口更简洁，仍保留 outcome unclear 时优先 brainstorm 的边界。

## 第 4 轮（已修复）
- 问题描述：`spec-slack-research` description 过长，重复说明 digest 能力，容易和原始 Slack 搜索工具混淆。
- 等级：中。
- 具体修复方式：修改 `skills/spec-slack-research/SKILL.md` 的 frontmatter `description`，突出 Slack 组织语境综合与 digest 输出，删除 raw message list 式细节。
- 基于项目整体思考的最佳解决方案推荐：入口层强调“组织语境综合”，避免把 skill 暴露成 raw search。
- 修复结论：压缩 `skills/spec-slack-research/SKILL.md` description。
- 修复效果：Slack research 的 synthesis 职责更突出。

## 第 5 轮（已修复）
- 问题描述：`git-commit-push-pr` description 过长，commit/PR/description-only 三种意图混写。
- 等级：中。
- 具体修复方式：修改 `skills/git-commit-push-pr/SKILL.md` frontmatter `description`，把入口压缩为完整 commit/push/PR 与 PR 描述写作两类，并保留 description-only 不提交不推送的显式承诺；同步调整相关 contract 测试断言。
- 基于项目整体思考的最佳解决方案推荐：发现层只区分“完整交付”和“仅写 PR 描述”两个入口意图，正文再处理流程分支。
- 修复结论：压缩 `skills/git-commit-push-pr/SKILL.md` description。
- 修复效果：降低 description-only 请求误跑 commit/push gates 的风险。

## 第 6 轮（已修复）
- 问题描述：`spec-brainstorm` description 冗长，和 using-spec-first 的“不要默认 brainstorm”治理存在张力。
- 等级：中。
- 具体修复方式：修改 `skills/spec-brainstorm/SKILL.md` frontmatter `description`，把触发条件收敛到需求未清、方向未定或存在多个有效方案的情况，避免把 brainstorm 写成所有任务的默认入口。
- 基于项目整体思考的最佳解决方案推荐：把触发范围写成 unclear requirements / product direction / multiple valid solutions，避免成为万能前门。
- 修复结论：压缩 `skills/spec-brainstorm/SKILL.md` description。
- 修复效果：强化 brainstorm 作为 WHAT 澄清入口，而不是所有任务的默认入口。

## 第 7 轮（已修复）
- 问题描述：`spec-optimize` description 过长，发现层包含实验机制细节。
- 等级：低。
- 具体修复方式：修改 `skills/spec-optimize/SKILL.md` frontmatter `description`，只保留可度量目标、系统实验、hard gates、judge-scored output 等入口判断词，把执行机制留在正文。
- 基于项目整体思考的最佳解决方案推荐：发现层只表达 metric-driven optimization 的适用条件，实验机制留给正文。
- 修复结论：压缩 `skills/spec-optimize/SKILL.md` description。
- 修复效果：优化入口更聚焦可度量目标，减少普通 work 被误路由到 optimize。

## 第 8 轮（已修复）
- 问题描述：`git-commit` 的 fallback context 使用单条串联 shell 命令，输出混杂且不利于 Codex/终端上下文阅读。
- 等级：中。
- 具体修复方式：修改 `skills/git-commit/SKILL.md` 的 Context fallback 代码块，将 `printf ...; git ...;` 串联命令拆成多条独立命令：`git status`、`git diff HEAD`、当前分支、近期 log、默认分支解析。
- 基于项目整体思考的最佳解决方案推荐：让脚本/命令保持确定性、可读、可单步复查；不要为省一条命令牺牲输出清晰度。
- 修复结论：改为分开运行 `git status`、`git diff`、branch、log 和 default branch 命令。
- 修复效果：上下文采集更稳定，失败点更易定位。

## 第 9 轮（已修复）
- 问题描述：`git-commit` 用 `git commit -m "$(cat <<EOF ...)"` 传多行正文，存在 shell 插值和换行保真风险。
- 等级：高。
- 具体修复方式：修改 `skills/git-commit/SKILL.md` 的 commit 示例，先用 `mktemp` 创建 `COMMIT_MSG`，再用 quoted heredoc 写入完整 commit message，最后通过 `git commit -F "$COMMIT_MSG"` 读取文件提交。
- 基于项目整体思考的最佳解决方案推荐：多行正文写入临时文件，并使用 `git commit -F` 读取，脚本负责确定性 I/O，LLM 只负责语义写作。
- 修复结论：改为 `COMMIT_MSG=$(mktemp ...)` + heredoc + `git commit -F "$COMMIT_MSG"`。
- 修复效果：commit message 更安全，减少特殊字符破坏命令的风险。

## 第 10 轮（已修复）
- 问题描述：`git-commit-push-pr` fallback context 同样使用单条串联 shell 命令，PR 检查与 git 输出混在一起。
- 等级：中。
- 具体修复方式：修改 `skills/git-commit-push-pr/SKILL.md` 的 Context fallback，把状态、diff、branch、log、default branch 和 `gh pr view` 拆为独立命令，避免同一输出块里混杂不同事实来源。
- 基于项目整体思考的最佳解决方案推荐：按事实类型拆开命令，让 agent 明确知道每段输出的来源。
- 修复结论：改为分步采集 status、diff、branch、log、default branch、PR check。
- 修复效果：PR workflow 的输入事实更容易审查与复用。

## 第 11 轮（已修复）
- 问题描述：`git-commit-push-pr` commit 示例同样用 `git commit -m "$(cat ...)"`，多行正文存在 quoting 风险。
- 等级：高。
- 具体修复方式：修改 `skills/git-commit-push-pr/SKILL.md` 的 Step 4 commit 示例，将多行 commit message 写入 `COMMIT_MSG` 临时文件，并用 `git commit -F "$COMMIT_MSG"` 读取，保持与独立 `git-commit` skill 同一模式。
- 基于项目整体思考的最佳解决方案推荐：统一 Git commit 正文输入方式，避免两个 Git skill 分叉。
- 修复结论：改为 temp file + `git commit -F`。
- 修复效果：commit/push/PR 流程中的 commit 步骤与独立 commit skill 一致。

## 第 12 轮（已修复）
- 问题描述：`git-commit-push-pr` 用 `--body "$(cat "$BODY_FILE")"` 创建或更新 PR，正文可能因 shell 命令替换丢尾部换行或遇到大正文风险。
- 等级：高。
- 具体修复方式：修改 `skills/git-commit-push-pr/SKILL.md` 中 `gh pr create`、`gh pr edit` 的示例，把 `--body "$(cat "$BODY_FILE")"` 全部替换为 GitHub CLI 原生 `--body-file "$BODY_FILE"`；同时在 `tests/unit/git-commit-push-pr-contracts.test.js` 增加正反向断言防回归。
- 基于项目整体思考的最佳解决方案推荐：用 GitHub CLI 原生 `--body-file` 承载 Markdown 正文。
- 修复结论：PR create/edit/update 全部改为 `--body-file "$BODY_FILE"`，并补 contract 断言。
- 修复效果：PR 描述写入更稳定，特殊字符和长正文风险下降。

## 第 13 轮（已修复）
- 问题描述：`report-bug` 的 Codex 版本采集仍指向泛化 `.codex/plugins/`，与当前 runtime state 路径不一致。
- 等级：中。
- 具体修复方式：修改 `skills/report-bug/SKILL.md` 的环境采集说明，将 Codex 侧从泛化 plugin registry 改为 `spec-first --version`、`.codex/spec-first/state.json` 与 `.agents/skills/` runtime surface；Claude 侧保留插件 metadata 与 loaded skill path。
- 基于项目整体思考的最佳解决方案推荐：bug report 只采集当前支持宿主的真实 metadata surface，不引入“其他平台”泛化。
- 修复结论：改为 Claude plugin metadata、Codex `spec-first --version`、`.codex/spec-first/state.json` 与 `.agents/skills/`。
- 修复效果：bug report 环境信息更贴近当前双宿主架构。

## 第 14 轮（已修复）
- 问题描述：`report-bug` 创建 GitHub issue 时用 `--body "[Formatted bug report]"`，不适合多行 Markdown。
- 等级：高。
- 具体修复方式：修改 `skills/report-bug/SKILL.md` 的 GitHub issue 创建示例，新增 `BODY_FILE=$(mktemp ...)` 与 quoted heredoc，把格式化 bug report 写入文件，再在带 label 和无 label 两条 `gh issue create` 路径中使用 `--body-file "$BODY_FILE"`。
- 基于项目整体思考的最佳解决方案推荐：和 PR body 一样，用临时文件承载 issue body，再交给 `gh --body-file`。
- 修复结论：新增 `BODY_FILE` heredoc，并在带 label 与无 label 两条路径使用 `--body-file`。
- 修复效果：bug report 不再依赖脆弱 shell escaping。

## 第 15 轮（已修复）
- 问题描述：`report-bug` 输出仍写 `/report-bug`，且点名旧 maintainer，形成运行面和组织事实漂移。
- 等级：中。
- 具体修复方式：修改 `skills/report-bug/SKILL.md` 的输出模板与确认说明，把 `Reported via /report-bug skill` 改成 `Reported via report-bug skill`，并把个人 maintainer 通知语句改为 spec-first maintainers。
- 基于项目整体思考的最佳解决方案推荐：内部 skill 不伪装成 slash command；组织责任用 “spec-first maintainers” 而非个人硬编码。
- 修复结论：改为 `report-bug` skill，并移除个人 maintainer 名。
- 修复效果：减少入口误导和人员事实过期风险。

## 第 16 轮（已修复）
- 问题描述：`changelog` 的 Discord curl 示例直接内联 JSON，`{{CHANGELOG}}` 中的引号、换行或反斜杠会破坏 payload。
- 等级：中。
- 具体修复方式：修改 `skills/changelog/SKILL.md` 的 Discord posting 示例，先把 `{{CHANGELOG}}` 写入 `CHANGELOG_FILE`，再用 `jq -n --rawfile content "$CHANGELOG_FILE" '{content: $content}'` 生成 `PAYLOAD_FILE`，最后用 `curl --data @"$PAYLOAD_FILE"` 发送。
- 基于项目整体思考的最佳解决方案推荐：用文件和 JSON encoder 构造 payload，shell 只做确定性传输。
- 修复结论：加入 `CHANGELOG_FILE`、`PAYLOAD_FILE` 与 `jq -n --rawfile`，并给 webhook 变量加引号。
- 修复效果：Discord 发布示例对真实 changelog 文本更稳健。

## 第 17 轮（已修复）
- 问题描述：`git-worktree` 手动补拷 `.env*` 的示例会复制 `.env.example`，且在无匹配时可能报错。
- 等级：中。
- 具体修复方式：修改 `skills/git-worktree/SKILL.md` 的手动补拷示例，改为遍历 `.env .env.*`，对不存在的 glob 结果先跳过，并显式跳过 `.env.example`，避免把示例配置当作真实 secrets 文件复制。
- 基于项目整体思考的最佳解决方案推荐：和 worktree-manager 的行为一致，跳过 `.env.example`，并显式处理无匹配。
- 修复结论：改为 `for env_file in .env .env.*` 循环，检查存在性并跳过 `.env.example`。
- 修复效果：手动修复路径与自动创建路径行为一致。

## 第 18 轮（已修复）
- 问题描述：`git-clean-gone-branches` 建议用 `git worktree list | grep "\\[$branch\\]"` 检测 worktree，branch 名含正则字符或 slash 时脆弱。
- 等级：中。
- 具体修复方式：修改 `skills/git-clean-gone-branches/SKILL.md` 删除流程说明，把 pretty output + grep 的检测方式替换为 `git worktree list --porcelain`，并要求按 `branch refs/heads/<branch>` 精确判断 worktree 占用。
- 基于项目整体思考的最佳解决方案推荐：读取 `git worktree list --porcelain` 并按 `branch refs/heads/<branch>` 精确匹配。
- 修复结论：更新删除流程说明，禁止依赖 pretty output grep。
- 修复效果：分支清理更少误删或漏删 worktree。

## 第 19 轮（已修复）
- 问题描述：`feature-video` 静态截图模板使用 `![Before](url-1)` / `![After](url-2)`，容易被链接检查当作真实坏链。
- 等级：低。
- 具体修复方式：修改 `skills/feature-video/references/tier-static-screenshots.md` 中的截图 Markdown 示例，把 `url-1`、`url-2` 替换为 `<before-image-url>`、`<after-image-url>` 这类显式占位值。
- 基于项目整体思考的最佳解决方案推荐：模板占位符使用显式占位 URL 语义，避免伪装成相对文件。
- 修复结论：改为 `![Before](<before-image-url>)` 与 `![After](<after-image-url>)`。
- 修复效果：模板更清楚，减少文档 link audit 噪声。

## 第 20 轮（已修复）
- 问题描述：`spec-plan` 计划模板中的 `[...](path)`、`[path or symbol]`、`[url]` 混用 Markdown 链接和占位文本，易产生伪坏链。
- 等级：低。
- 具体修复方式：修改 `skills/spec-plan/SKILL.md` 的计划模板占位写法，把伪 Markdown 链接改成 `<origin-document-path>`、`<path or symbol>`、`#<number>`、`<url>` 等不会被链接检查误判的占位形式。
- 基于项目整体思考的最佳解决方案推荐：占位符应明确是待替换值，不应被误判为真实链接。
- 修复结论：改为 `<origin-document-path>`、`<path or symbol>`、`#<number>`、`<url>`。
- 修复效果：计划产物模板对链接检查和人工阅读更友好。

## 第 21 轮（已修复）
- 问题描述：`spec-ideate` scratch path 使用 `/tmp/spec-first/spec:ideate/<run-id>`，冒号路径跨平台和工具展示都不理想。
- 等级：中。
- 具体修复方式：修改 `skills/spec-ideate/SKILL.md` 中的 scratch path，将 `/tmp/spec-first/spec:ideate/<run-id>` 改为 `/tmp/spec-first/spec-ideate/<run-id>`；同时在 `tests/unit/spec-ideate-contracts.test.js` 增加禁止旧冒号路径回归的断言。
- 基于项目整体思考的最佳解决方案推荐：workflow scratch 目录使用 kebab-case 名称，与 skill id 保持一致。
- 修复结论：主流程改为 `/tmp/spec-first/spec-ideate/<run-id>`，并补 contract 断言。
- 修复效果：scratch path 更一致，避免冒号造成工具兼容问题。

## 第 22 轮（已修复）
- 问题描述：`spec-ideate` 的 web research cache reference 仍引用旧冒号路径。
- 等级：中。
- 具体修复方式：修改 `skills/spec-ideate/references/web-research-cache.md`，同步替换 `<scratch-dir>` 示例和 `SCRATCH_ROOT` 为 `/tmp/spec-first/spec-ideate`，保证主 skill 与 reference 指向同一个 scratch root。
- 基于项目整体思考的最佳解决方案推荐：同一 workflow 的主文档与 reference 必须共享同一 scratch root。
- 修复结论：同步更新 `references/web-research-cache.md` 中 `<scratch-dir>` 与 `SCRATCH_ROOT`。
- 修复效果：cache 与 checkpoint 路径不再分叉。

## 第 23 轮（已修复）
- 问题描述：`spec-release-notes` 首句写成 “recent releases of the spec-first”，语义不自然。
- 等级：低。
- 具体修复方式：修改 `skills/spec-release-notes/SKILL.md` 的开头描述，把不自然的 “recent releases of the spec-first” 改为 “recent spec-first releases”。
- 基于项目整体思考的最佳解决方案推荐：用户可见 skill 文案应保持简洁准确，避免降低信任感的小语病。
- 修复结论：改为 “recent spec-first releases”。
- 修复效果：release notes workflow 描述更专业。

## 第 24 轮（已修复）
- 问题描述：`feature-video` 多处运行 `python3 scripts/capture-demo.py`，但未说明脚本路径相对 skill 目录，容易在项目根误找 `scripts/`。
- 等级：中。
- 具体修复方式：修改 `skills/feature-video/SKILL.md` 的 Step 2，新增脚本路径解析说明，要求把 `scripts/capture-demo.py` 等 helper script 相对 loaded skill directory 解析，而不是相对目标项目根目录。
- 基于项目整体思考的最佳解决方案推荐：脚本类资产由 skill 自身拥有，agent 必须按 loaded skill directory 解析。
- 修复结论：在 Step 2 增加 script path resolution 说明。
- 修复效果：减少 source/runtime 路径漂移导致的执行失败。

## 第 25 轮（已修复）
- 问题描述：`spec-polish-beta` 同样直接写 `bash scripts/<name>.sh`，缺少 skill-relative 解析边界。
- 等级：中。
- 具体修复方式：修改 `skills/spec-polish-beta/SKILL.md` 的 Phase 1，补充 helper scripts 应相对 loaded skill directory 解析，目标 app checkout 只作为被检测和运行的项目目录。
- 基于项目整体思考的最佳解决方案推荐：明确 helper scripts 与目标 app checkout 的边界，避免误把用户项目脚本当成 workflow helper。
- 修复结论：在 Phase 1 增加脚本路径解析说明。
- 修复效果：dev server 检测 helper 的归属更清楚。

## 第 26 轮（已修复）
- 问题描述：`resolve-pr-feedback` 的 GraphQL helper scripts 使用相对路径，但未声明从 skill 目录解析。
- 等级：中。
- 具体修复方式：修改 `skills/resolve-pr-feedback/SKILL.md`，在 Full Mode 前增加 helper path resolution 说明，要求 `scripts/get-pr-comments`、`scripts/reply-to-pr-thread` 等 GraphQL helper 从 skill support assets 目录解析。
- 基于项目整体思考的最佳解决方案推荐：PR 反馈处理脚本属于 skill support assets，不能依赖目标仓库顶层 `scripts/`。
- 修复结论：在 Full Mode 前增加 helper path resolution 说明。
- 修复效果：降低在任意项目中运行该 skill 时的路径误解析风险。

## 第 27 轮（已修复）
- 问题描述：`spec-optimize` 多处 scratch path 拼成 `.spec-first/workflowsspec-optimize`，缺少 `/`。
- 等级：高。
- 具体修复方式：批量修改 `skills/spec-optimize/SKILL.md` 和 `skills/spec-optimize/references/experiment-log-schema.yaml`，把 `.spec-first/workflowsspec-optimize/<spec-name>/` 统一更正为 `.spec-first/workflows/spec-optimize/<spec-name>/`；在 `tests/unit/spec-optimize-contracts.test.js` 中增加禁止错误路径回归的断言。
- 基于项目整体思考的最佳解决方案推荐：workflow 本地状态统一归入 `.spec-first/workflows/<workflow>/`，并用 contract test 防回归。
- 修复结论：统一改为 `.spec-first/workflows/spec-optimize/`，同步 `experiment-log-schema.yaml`。
- 修复效果：优化实验日志、spec、strategy digest 的路径恢复为可发现的标准结构。

## 第 28 轮（已修复）
- 问题描述：`spec-optimize` 调用 `scripts/measure.sh` 等 helper 时未说明路径归属，容易与项目自带 scripts 混淆。
- 等级：中。
- 具体修复方式：修改 `skills/spec-optimize/SKILL.md` 的 measurement scaffolding，新增 `scripts/measure.sh`、`scripts/parallel-probe.sh`、`scripts/experiment-worktree.sh` 应相对 skill loaded directory 解析的说明；同步补 contract 断言。
- 基于项目整体思考的最佳解决方案推荐：measurement working directory 属于目标项目，helper script 路径属于 skill，两者必须显式分层。
- 修复结论：在 measurement scaffolding 中增加 skill-relative helper scripts 说明，并补 contract 断言。
- 修复效果：减少优化 workflow 执行时的路径歧义。

## 第 29 轮（已修复）
- 问题描述：`spec-session-extract` 使用 `cat <file> | python3 ...`，对文件名占位和错误定位不如直接 stdin 重定向清晰。
- 等级：低。
- 具体修复方式：修改 `skills/spec-session-extract/SKILL.md` 中的脚本调用示例，把 `cat "<file>" | python3 scripts/extract-*.py` 改为 `python3 scripts/extract-*.py < "<file>"`，去掉无意义管道。
- 基于项目整体思考的最佳解决方案推荐：确定性脚本读取文件时优先用 shell redirection，减少无意义管道。
- 修复结论：改为 `python3 scripts/extract-*.py < "<file>"`。
- 修复效果：session extract 示例更简洁，路径带特殊字符时更稳。

## 第 30 轮（已修复）
- 问题描述：`spec-mcp-setup` Reference 只列 Claude command metadata，未说明 Codex 没有单独 command template，容易让维护者寻找不存在的 Codex 模板。
- 等级：低。
- 具体修复方式：修改 `skills/spec-mcp-setup/SKILL.md` 的 Reference 列表，在 Claude command metadata 后新增 Codex runtime 说明，明确 Codex 直接加载 source skill，不存在单独 Codex command template。
- 基于项目整体思考的最佳解决方案推荐：host surface 要明确区分 Claude command-backed workflow 与 Codex skill runtime。
- 修复结论：补充 “Codex runtime loads this source skill directly; there is no separate Codex command template.”
- 修复效果：维护者对双宿主 runtime 资产边界更清楚，减少 source/runtime drift。
