# spec-mcp-setup Prompt Mirror

> 镜像用途：记录 `skills/spec-mcp-setup/SKILL.md` 的当前架构语义，便于 prompt / workflow 审查。源码真相源仍是 `skills/spec-mcp-setup/SKILL.md`。

`spec-mcp-setup` 是 Required Harness Runtime Setup，不再是可选 MCP 安装器。

固定 runtime baseline：

- MCP：`serena`、`sequential-thinking`、`context7`
- graph providers：`gitnexus`、`code-review-graph`
- helper：`agent-browser`、`gh`、`jq`、`vhs`、`silicon`、`ffmpeg`、`ast-grep`、global `ast-grep` skill

边界：

- `mcp-tools.json` 是 MCP 与 graph provider 的唯一 machine registry；所有 MCP / graph-provider 的 package/version spec 只从这里读取，`.spec-first/config/graph-providers.json` 只是投影，不是第二个版本源。
- `code-review-graph` 默认是 `cli_artifact` graph provider，`host_config_required=false`，不由 `spec-mcp-setup` 默认写入 host MCP config；其 `serve` MCP server 只是显式可选增强。
- required helper tooling 不进入 `mcp-tools.json`，由 `install-helpers.*` 管理。
- `install-helpers.* --verify-only` 只读检查 helper facts；`agent-browser install` 的完成状态以 `$HOME/.agent-browser/spec-first-install.json` 为 marker。
- `install-helpers.*` 会保留继承下来的 npm registry、proxy 和 mirror 环境变量。若需要国内 npm 源或企业代理，可在运行 setup 前设置标准 `NPM_CONFIG_REGISTRY` / `npm_config_registry` 及代理环境变量；install helpers 会在 sudo fallback 中继续透传，而不是丢弃它们。Linux 上 `agent-browser install` 会自动带 `--with-deps`，把浏览器运行时和系统依赖一起装。缺失时，`agent-browser` 浏览器运行时、全局 `agent-browser` skill 和全局 `ast-grep` skill 会并发安装；依赖包管理器的 helper CLI 仍保持串行，避免锁冲突。
- `check-deps.*` 输出的缺失依赖安装建议必须 review-first 且匹配当前平台：Linux/WSL 优先根据本机可用的 `apt-get`、`dnf`、`yum`、`pacman`、`apk` 生成建议；可以下载 installer 到本地临时文件并打印复核后的下一条命令，但不得使用 `curl | sh`、`irm | iex`、自动执行远程 installer，或依赖 `less` / `notepad` 这类交互式查看器；PowerShell 脚本输出应使用 PowerShell 可执行语法，不输出 Bash-only 语法。
- 安装路径必须请求最新版本：npm/npx 使用 `@latest`，`uvx` 使用 `--upgrade`，Cargo 支持的工具使用 `--force`，Homebrew/winget handoff 优先 upgrade-before-install；临时 package pin 只能写在 `mcp-tools.json`，所有 GitNexus 投影必须读取该配置值，不在 prose 或测试里硬编码版本；`--verify-only` 仍保持只读，不升级。
- GitNexus `query_probe` 使用 indexed repo label，并写出最多 5 个 source-derived 的 bounded ordered `query_probe_policy.candidates[]`，同时保留 legacy `token` / `selected_from` 字段。
- 父级多仓 workspace 只做 advisory control-plane；`bootstrap-project-config.*`、`install-mcp.*` 和 `verify-tools.*` 在父级 workspace 无 `--repo` 时默认进入 all-child-repos maintenance path，逐个 child 调用既有 `--repo` 流程，只能在父目录写 `.spec-first/workspace/project-config-bootstrap-summary.json` / `mcp-setup-summary.json` / `mcp-verify-summary.json`，不能写父级 repo-local `.spec-first/config/*`、`.spec-first/graph/*`、`.spec-first/impact/*`、`.spec-first/providers/*` 或 `.serena/*`。
- `--all-repos` / `-AllRepos` 是父级 workspace 默认全仓行为的显式等价入口；`--repo` 只用于收窄到一个 child repo。
- batch 模式下首次 Serena bootstrap 必须由 agent 传入 per-child language map；全局 `--serena-language` 不能套用到所有 child repo。缺少语言证据的 child 返回 `serena_language_required`，由 LLM 基于 child repo 证据选择语言后重试。
- `detect-tools.*` 只输出 tool facts，不输出 `baseline_ready`，不输出顶层 `crg`。
- `verify-tools.*` 合并 tool facts 与 helper facts，统一写 readiness ledger v2。
- 安装/验证完成后的 assistant 最终回复必须复述 readiness ledger v2 派生的完整状态，并在状态块下面追加简短友好的下一步提示；优先使用 fenced code block 中的分组对齐状态块，不要用单个 9 列宽表或裸 Markdown 表格挤压 Codex 输出区域。
- 最终状态块第一段必须是 `Execution result` 汇总表，直接展示 `Harness runtime` 与 `Graph readiness` 判定，并列出 ready/pending graph providers；`Graph providers` 明细表必须同时展示 `Query` 与 `Bootstrap`。
- 用户显式运行 `/spec:mcp-setup` 或 `$spec-mcp-setup` 时，视为已授权完成 required setup workflow；不要在创建/刷新 `.spec-first/config.local.example.yaml`、首次创建 `.spec-first/config.local.yaml`、更新 `.gitignore`、安装 required helper tooling、写 host MCP config 或写 setup-owned `.spec-first/config/*.json` 前再次询问用户。
- 权限不足时，优先自动使用宿主允许的提权执行路径或脚本内非交互式 sudo/package-manager 路径重试；如果仍失败或需要当前 harness 无法提供的凭据，记录 command stage、reason、next action 并在最终状态中说明，不要卡在确认问题上。
- 自主 setup 不包含破坏性或语义不明确动作；不要自动删除 `compound-engineering.local.md`、`.compound-engineering/config.local.yaml`、既有 `.spec-first/config.local.yaml` 或用户手写 host config section，除非用户明确要求删除/卸载。
- 如果 graph providers 仍是 `query_ready=false`，不要说 setup 已完全完成；要明确提示可运行 `/spec:graph-bootstrap` / `$spec-graph-bootstrap`，或回复“继续完成”让 agent 继续执行。
- 同时提示用户：graph bootstrap 是 deterministic CLI 编译，可以在当前会话直接运行；如果 agent 判断当前只需调用 deterministic bootstrap 脚本，可以接受“继续完成”。重启 Claude Code/Codex 或新开会话只在下游 workflow 依赖新写入的 MCP config 或 live MCP probe 前需要。
- 当 graph readiness 已经 ready 时，下一步提示不能只停留在重启 caveat；应推荐 `/spec:standards` 或 `$spec-standards` 作为 durable handoff，用来编译项目规范与 glue capability baseline。
- 重复执行 setup、init 后重新安装、升级后重新 init/verify 时，如果 canonical graph artifacts 仍存在且当前 provider 仍 ready，必须从 canonical artifacts 重建 `query_ready=true` / `bootstrap_required=false` projection，不要把已完成 bootstrap 的 projection 打回 pending。
- 卸载或 provider 不再 ready 时，不保留 query readiness；ledger/projection 应反映 action-required 或需要重新 bootstrap。
- Serena 语言选择是语义决策，由 LLM 基于 package manifest、构建文件和代表性源码判断；证据明确时不要询问用户。
- 首次 Serena bootstrap 必须由 agent 传入显式 Serena 语言；脚本不得进入 Serena 交互式语言选择。无既有 `.serena/project.yml` 语言且未传语言时，`activate-serena.*` fail-fast 并要求 agent 传入显式语言。
- `install-mcp.*` 遇到首次无语言时应返回 `reason_code=serena_language_required` 和明确重试动作；agent 看到该 reason 后基于本地证据选语言并立即重试，不把明确场景交给用户决策。
- `.spec-first/config/graph-providers.json` 是 provider selection projection，不是第二个 registry。
- 首次 setup 后 graph providers 是 `configured=true`、`enabled_for_bootstrap=true`、`query_ready=false`；重复 setup 可在 provider 仍 ready 且 canonical artifacts 仍 current 时投影 `query_ready=true`。
- 重复执行 setup 必须幂等且非破坏：Serena 已 ready 时不强制重建；需要重建时先保留旧 `.serena/project.yml` 与 ready marker，失败要恢复旧状态。
- host MCP server entry 只写宿主支持字段，例如 `command`、`args`、`startup_timeout_sec`；`selected_scope` 等内部元数据只进入脚本输出和 ledger。
- Codex higher-precedence config 只在同名 MCP section 存在时影响该工具；profile-only 或无关 MCP section 不应阻断 selected-scope config。
- `.spec-first/config/graph-providers.json` 语义未变化时不得只为刷新 `generated_at` 重写文件；重复 verify 应保持工作区干净，并把 projection 状态视为 `ready`。
- 保留 query-ready provider 时，必须从 canonical provider status 投影 provider 级 `last_bootstrap_status` / `last_bootstrapped_at`；`spec-graph-bootstrap` 不回写 setup-owned config。

禁止事项：

- 不运行配置中的 GitNexus `analyze` / `status` / `query` provider 命令。
- 不运行 `uvx --upgrade code-review-graph build`。
- 不恢复 retired internal graph CLI。
- 不恢复旧 selectable setup modes、optional registry entries、legacy pending states 或 browser MCP server。

后续 handoff：

- setup 完成后在状态块下提示现在可运行 `/spec:graph-bootstrap` 或 `$spec-graph-bootstrap` 编译 graph readiness；同时允许 agent 在确认只需 deterministic script 时响应“继续完成”。重启/新会话是下游 MCP reload caveat，不是 graph bootstrap 前置条件。
