# spec-mcp-setup Execution Flow Mirror

> 镜像用途：辅助审查 Required Harness Runtime Setup 的脚本/LLM 边界。源码真相源仍是 `skills/spec-mcp-setup/`。

```text
User invokes /spec:mcp-setup or $spec-mcp-setup
  |
  v
check-deps.*
  |
  |-- required deps: node, npm, npx, uv, uvx, jq, python3 on Unix
  v
install-helpers.*
  |
  |-- install/verify agent-browser CLI
  |-- run agent-browser install
  |-- write/read ~/.agent-browser/spec-first-install.json
  |-- install global agent-browser skill
  |-- install/verify gh, jq, vhs, silicon, ffmpeg, ast-grep
  |-- install/verify global ast-grep skill
  |-- output helper_tools facts for every required helper
  v
install-mcp.*
  |
  |-- warm required MCP tools
  |-- write Claude/Codex host MCP config
  |-- support Codex quoted TOML key:
  |     [mcp_servers."code-review-graph"]
  |-- bootstrap Serena current repo without destroying an existing ready project
  |-- keep internal setup metadata out of host MCP server entries
  |-- treat Codex higher-precedence config as blocking only for the same MCP section
  |-- do not run graph provider builds
  v
detect-tools.*
  |
  |-- output tool-facts.v2
  |-- no baseline_ready
  |-- no top-level crg
  v
verify-tools.*
  |
  |-- merge detect-tools facts
  |-- merge install-helpers --verify-only facts
  |-- compute baseline_ready once
  |-- write readiness ledger schema_version=v2
  |-- preserve query_ready=true when repeated setup sees ready providers
  |-- print final Markdown status table
  |-- print friendly next steps:
  |     restart Claude Code/Codex or start a new session by default
  |     then run graph bootstrap
  |     or let the agent continue if it only needs deterministic bootstrap scripts
  v
write-provider-config.*
  |
  |-- git repo only
  |-- write .spec-first/config/graph-providers.json
  |-- first setup writes query_ready=false
  |-- repeated setup preserves query_ready=true when provider setup is still ready
  |-- repeated setup preserves graph-bootstrap readiness metadata
  |-- semantic projection unchanged 时不刷新 generated_at、不污染 git status
  v
Next: restart/new session, then /spec:graph-bootstrap or $spec-graph-bootstrap; agent may accept "继续完成" for deterministic-script continuation
```
