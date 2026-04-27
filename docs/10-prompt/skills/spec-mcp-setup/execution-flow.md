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
  |-- bootstrap Serena current repo
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
  |-- print final status table as the last visible output block
  v
write-provider-config.*
  |
  |-- git repo only
  |-- write .spec-first/config/graph-providers.json
  |-- query_ready=false
  v
Next: /spec:graph-bootstrap or $spec-graph-bootstrap
```
