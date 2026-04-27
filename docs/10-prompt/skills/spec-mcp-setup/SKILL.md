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
- 安装/验证完成后的最后一个可见输出 block 必须是 readiness ledger v2 派生的状态表；ledger/projection 说明放在表格前，不在表格后追加非表格 footer。
- `.spec-first/config/graph-providers.json` 是 provider selection projection，不是第二个 registry。
- setup 后 graph providers 只能是 `configured=true`、`enabled_for_bootstrap=true`、`query_ready=false`。

禁止事项：

- 不运行 `npx -y gitnexus@latest analyze`。
- 不运行 `uvx code-review-graph build`。
- 不恢复 retired internal graph CLI。
- 不恢复旧 selectable setup modes、optional registry entries、legacy pending states 或 browser MCP server。

后续 handoff：

- setup 完成后提示运行 `/spec:graph-bootstrap` 或 `$spec-graph-bootstrap`。
