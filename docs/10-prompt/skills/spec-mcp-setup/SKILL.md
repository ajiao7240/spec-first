# spec-mcp-setup Prompt Mirror

> 镜像用途：记录 `skills/spec-mcp-setup/SKILL.md` 的当前架构语义，便于 prompt / workflow 审查。源码真相源仍是 `skills/spec-mcp-setup/SKILL.md`。

`spec-mcp-setup` 是 Required Harness Runtime Setup，不再是可选 MCP 安装器。

固定 runtime baseline：

- MCP：`serena`、`sequential-thinking`、`context7`
- graph-provider MCP：`gitnexus`、`code-review-graph`
- helper：`agent-browser`、`gh`、`jq`、`vhs`、`silicon`、`ffmpeg`、`ast-grep`、global `ast-grep` skill

边界：

- `mcp-tools.json` 是 MCP 与 graph-provider MCP 的唯一 machine registry，schema version 为 `4`。
- required helper tooling 不进入 `mcp-tools.json`，由 `install-helpers.*` 管理。
- `install-helpers.* --verify-only` 只读检查 helper facts；`agent-browser install` 的完成状态以 `$HOME/.agent-browser/spec-first-install.json` 为 marker。
- `detect-tools.*` 只输出 tool facts，不输出 `baseline_ready`，不输出顶层 `crg`。
- `verify-tools.*` 合并 tool facts 与 helper facts，统一写 readiness ledger v2。
- 安装/验证完成后的 assistant 最终回复必须复述 readiness ledger v2 派生的完整 Markdown 状态表，并在表格下面追加简短友好的下一步提示；不要只依赖命令输出里出现过表格，避免最终结论丢失完整表格。
- 如果 graph providers 仍是 `query_ready=false`，不要说 setup 已完全完成；要明确提示可运行 `/spec:graph-bootstrap` / `$spec-graph-bootstrap`，或回复“继续完成”让 agent 继续执行。
- 同时提示用户：默认安全路径是先重启 Claude Code/Codex 或新开会话，让新写入的 MCP config 被宿主加载，再运行 graph bootstrap；如果 agent 判断当前只需调用 deterministic bootstrap 脚本，可以接受“继续完成”，但下游 workflow 前仍要重启或新开会话。
- 重复执行 setup、init 后重新安装、升级后重新 init/verify 时，如果当前 provider 仍 ready，必须保留既有 `query_ready=true` / `bootstrap_required=false`，不要把已完成 bootstrap 的 projection 打回 pending。
- 卸载或 provider 不再 ready 时，不保留 query readiness；ledger/projection 应反映 action-required 或需要重新 bootstrap。
- `.spec-first/config/graph-providers.json` 是 provider selection projection，不是第二个 registry。
- 首次 setup 后 graph providers 是 `configured=true`、`enabled_for_bootstrap=true`、`query_ready=false`；重复 setup 可在 provider 仍 ready 时保留 `query_ready=true`。

禁止事项：

- 不运行 `npx -y gitnexus@latest analyze`。
- 不运行 `uvx code-review-graph build`。
- 不恢复 retired internal graph CLI。
- 不恢复旧 selectable setup modes、optional registry entries、legacy pending states 或 browser MCP server。

后续 handoff：

- setup 完成后在表格下提示先重启/新会话，再运行 `/spec:graph-bootstrap` 或 `$spec-graph-bootstrap`；同时允许 agent 在确认只需 deterministic script 时响应“继续完成”。
