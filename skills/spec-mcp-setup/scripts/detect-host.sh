#!/bin/bash
# detect-host.sh - Detect the current host for MCP setup (Claude Code or Codex)
# Output: JSON with host-specific paths and CLI metadata

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

detect_host() {
  case "${MCP_SETUP_HOST:-}" in
    claude|codex)
      echo "$MCP_SETUP_HOST"
      return 0
      ;;
  esac

  if [ -n "${CODEX_CI:-}" ] || [ -n "${CODEX_MANAGED_BY_NPM:-}" ] || [ -n "${CODEX_THREAD_ID:-}" ] || [ -n "${CODEX_SANDBOX:-}" ]; then
    echo "codex"
    return 0
  fi

  if [ -n "${CLAUDE_CODE_SSE_PORT:-}" ] || [ -n "${CLAUDE_CODE_SESSION_ID:-}" ] || [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
    echo "claude"
    return 0
  fi

  if command -v codex >/dev/null 2>&1 && ! command -v claude >/dev/null 2>&1; then
    echo "codex"
    return 0
  fi

  if command -v claude >/dev/null 2>&1 && ! command -v codex >/dev/null 2>&1; then
    echo "claude"
    return 0
  fi

  echo "错误：无法自动识别宿主。请显式设置 MCP_SETUP_HOST=claude 或 MCP_SETUP_HOST=codex 后再运行。" >&2
  return 1
}

detect_platform() {
  case "$(uname -s 2>/dev/null || echo unknown)" in
    Darwin)
      echo "macos"
      ;;
    Linux)
      if grep -qi microsoft /proc/version 2>/dev/null; then
        echo "wsl"
      else
        echo "linux"
      fi
      ;;
    MINGW*|MSYS*|CYGWIN*)
      echo "windows"
      ;;
    *)
      echo "unknown"
      ;;
  esac
}

host="$(detect_host)"
platform="$(detect_platform)"

case "$host" in
  claude)
    cli_command="claude"
    display_name="Claude Code"
    config_path="$HOME/.claude.json"
    marker_path="$HOME/.claude/spec-first/host-setup.json"
    config_format="json"
    ;;
  codex)
    cli_command="codex"
    display_name="Codex"
    config_path="$HOME/.codex/config.toml"
    marker_path="$HOME/.codex/spec-first/host-setup.json"
    config_format="toml"
    ;;
  *)
    echo "错误：无法识别宿主：$host" >&2
    exit 1
    ;;
esac

jq -n \
  --arg host "$host" \
  --arg display_name "$display_name" \
  --arg cli_command "$cli_command" \
  --arg config_path "$config_path" \
  --arg marker_path "$marker_path" \
  --arg config_format "$config_format" \
  --arg platform "$platform" \
  '{
    "host": $host,
    "display_name": $display_name,
    "cli_command": $cli_command,
    "config_path": $config_path,
    "marker_path": $marker_path,
    "config_format": $config_format,
    "platform": $platform
  }'
