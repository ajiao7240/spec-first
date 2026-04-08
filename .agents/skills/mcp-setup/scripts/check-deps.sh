#!/bin/bash
# check-deps.sh - Detect prerequisite dependencies for MCP tools
# Output: JSON with install status and suggestions for missing deps

set -euo pipefail

# jq 是硬依赖
command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

# Helper: check if a command exists and get version
check_command() {
  local cmd="$1"
  local version_flag="${2:-"--version"}"

  if command -v "$cmd" >/dev/null 2>&1; then
    local version
    version=$("$cmd" "$version_flag" 2>&1 | head -1)
    jq -n --arg ver "$version" '{"installed":true,"version":$ver}'
  else
    echo '{"installed":false}'
  fi
}

# Detect OS
detect_os() {
  local os
  os="$(uname -s 2>/dev/null || echo "unknown")"
  case "$os" in
    Darwin) echo "macos" ;;
    Linux) echo "linux" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *) echo "unknown" ;;
  esac
}

OS=$(detect_os)

# Check Node.js
NODE_JSON=$(check_command "node" "--version")
if echo "$NODE_JSON" | jq -e '.installed' >/dev/null 2>&1; then
  NODE_JSON=$(echo "$NODE_JSON" | jq '. + {"install_suggestion": null}')
else
  if [ "$OS" = "macos" ]; then
    NODE_JSON=$(echo "$NODE_JSON" | jq '. + {"install_suggestion": {
      "command": "curl -fsSL https://fnm.vercel.app/install | bash && export FNM_PATH=\"$HOME/.fnm\" && export PATH=\"$FNM_PATH:$PATH\" && eval \"$(fnm env)\" && fnm install --lts",
      "safety": "gated_auto",
      "risk_hint": "fnm installs Node.js to user directory, may conflict with system Node.js",
      "manual": "Install from https://nodejs.org/ or use: brew install node"
    }}')
  elif [ "$OS" = "linux" ]; then
    NODE_JSON=$(echo "$NODE_JSON" | jq '. + {"install_suggestion": {
      "command": "curl -fsSL https://fnm.vercel.app/install | bash && export FNM_PATH=\"$HOME/.fnm\" && export PATH=\"$FNM_PATH:$PATH\" && eval \"$(fnm env)\" && fnm install --lts",
      "safety": "gated_auto",
      "risk_hint": "fnm installs Node.js to user directory, may conflict with system Node.js",
      "manual": "Install from https://nodejs.org/ or use: sudo apt install nodejs"
    }}')
  else
    NODE_JSON=$(echo "$NODE_JSON" | jq '. + {"install_suggestion": {
      "command": "winget install OpenJS.NodeJS.LTS",
      "safety": "manual",
      "risk_hint": "Use the Windows package manager, may require a terminal restart",
      "manual": "Install from https://nodejs.org/ or use winget install OpenJS.NodeJS.LTS"
    }}')
  fi
fi

# Check uv
UV_JSON=$(check_command "uv" "--version")
if echo "$UV_JSON" | jq -e '.installed' >/dev/null 2>&1; then
  UV_JSON=$(echo "$UV_JSON" | jq '. + {"install_suggestion": null}')
else
  UV_JSON=$(echo "$UV_JSON" | jq '. + {"install_suggestion": {
    "command": "curl -LsSf https://astral.sh/uv/install.sh | sh",
    "safety": "safe_auto",
    "risk_hint": "Installs to ~/.cargo/bin/, no sudo required",
    "manual": "Install from https://docs.astral.sh/uv/getting-started/installation/"
  }}')
fi

# Check jq (hard dependency)
JQ_JSON=$(check_command "jq" "--version")
if echo "$JQ_JSON" | jq -e '.installed' >/dev/null 2>&1; then
  JQ_JSON=$(echo "$JQ_JSON" | jq '. + {"install_suggestion": null}')
else
  if [ "$OS" = "macos" ]; then
    JQ_JSON=$(echo "$JQ_JSON" | jq '. + {"install_suggestion": {
      "command": "brew install jq",
      "safety": "safe_auto",
      "risk_hint": "Standard Homebrew package, no conflicts",
      "manual": "brew install jq or install from https://jqlang.github.io/jq/"
    }}')
  elif [ "$OS" = "linux" ]; then
    JQ_JSON=$(echo "$JQ_JSON" | jq '. + {"install_suggestion": {
      "command": "sudo apt-get install -y jq",
      "safety": "safe_auto",
      "risk_hint": "Standard system package",
      "manual": "sudo apt install jq or install from https://jqlang.github.io/jq/"
    }}')
  else
    JQ_JSON=$(echo "$JQ_JSON" | jq '. + {"install_suggestion": {
      "command": "winget install jqlang.jq",
      "safety": "manual",
      "risk_hint": "Use the Windows package manager, may require a terminal restart",
      "manual": "Install from https://jqlang.github.io/jq/ or use winget install jqlang.jq"
    }}')
  fi
fi

# Output combined JSON
jq -n \
  --argjson node "$NODE_JSON" \
  --argjson uv "$UV_JSON" \
  --argjson jq_dep "$JQ_JSON" \
  --arg os "$OS" \
  '{
    "os": $os,
    "node": $node,
    "uv": $uv,
    "jq": $jq_dep
  }'
