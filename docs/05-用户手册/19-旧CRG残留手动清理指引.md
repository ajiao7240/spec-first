# 旧 CRG 残留手动清理指引

本文只用于清理迁移前遗留的 `code-review-graph` 本地状态。当前 graph provider 以 GitNexus 为准；`spec-first` 不再安装、配置、刷新或卸载 `code-review-graph`。

## 适用场景

- 旧版宿主配置中仍有 `code-review-graph` MCP server。
- 工作区仍有 `.code-review-graph/` 或 `.spec-first/providers/code-review-graph/` 历史产物。
- 本机 `uv` / `uvx` cache 中仍有旧 CRG package。

这些残留不会参与当前 readiness 或 fallback。需要回收磁盘空间、减少宿主配置噪音，或排查旧配置干扰时，再手动清理。

## Claude 配置

Claude Code 的用户配置通常在 `~/.claude.json`。删除 `mcpServers.code-review-graph` 条目即可。

```bash
jq 'if .mcpServers then .mcpServers |= with_entries(select(.key != "code-review-graph")) else . end' \
  "$HOME/.claude.json" > "$HOME/.claude.json.tmp" &&
mv "$HOME/.claude.json.tmp" "$HOME/.claude.json"
```

PowerShell:

```powershell
$path = Join-Path $HOME '.claude.json'
$json = Get-Content -Raw $path | ConvertFrom-Json -AsHashtable
if ($json.ContainsKey('mcpServers')) {
  $json['mcpServers'].Remove('code-review-graph')
}
$json | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 $path
```

## Codex 配置

Codex 的用户配置通常在 `~/.codex/config.toml`。删除以下 section：

```toml
[mcp_servers."code-review-graph"]
```

如果存在未加引号的旧 section，也一并删除：

```toml
[mcp_servers.code-review-graph]
```

Windows 路径通常是：

```text
%USERPROFILE%\.codex\config.toml
```

## 工作区产物

在确认不需要历史索引后，可从目标仓库根目录删除：

```bash
rm -rf .code-review-graph .spec-first/providers/code-review-graph
```

PowerShell:

```powershell
Remove-Item -Recurse -Force .code-review-graph, .spec-first/providers/code-review-graph -ErrorAction SilentlyContinue
```

## Package Cache

如需回收 `uv` / `uvx` cache，可手动运行：

```bash
uv cache clean code-review-graph
```

清理后重新运行当前链路时，先执行 `$spec-mcp-setup`，再执行 `$spec-graph-bootstrap`。不要手改 `.spec-first/config/graph-providers.json` 来绕过 stale projection 提示。
