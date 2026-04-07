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
      "command": "echo \"Please install Node.js from https://nodejs.org/\"",
      "safety": "manual",
      "risk_hint": "",
      "manual": "Install from https://nodejs.org/"
    }}')
  fi
fi

# Check Go
GO_JSON=$(check_command "go" "version")
if echo "$GO_JSON" | jq -e '.installed' >/dev/null 2>&1; then
  GO_JSON=$(echo "$GO_JSON" | jq '. + {"install_suggestion": null}')
else
  # Get latest Go version from API
  GO_LATEST=$(curl -sL --connect-timeout 5 --max-time 15 "https://go.dev/dl/?mode=json" 2>/dev/null | jq -r '.[0].version' 2>/dev/null || echo "")
  GO_VERSION="${GO_LATEST#go}"  # Strip "go" prefix
  # 版本号格式校验：防止 API 异常或注入
  if [[ ! "$GO_VERSION" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?$ ]]; then
    GO_VERSION="1.23.6"
  fi

  # 架构映射：Linux aarch64 → arm64（Go 官方下载使用 arm64）
  GO_ARCH=$(uname -m)
  [[ "$GO_ARCH" == "aarch64" ]] && GO_ARCH="arm64"

  # Build install command with resolved version
  GO_INSTALL_CMD="mkdir -p \$HOME/.local && curl -sL https://go.dev/dl/go${GO_VERSION}.\$(uname -s | tr A-Z a-z)-${GO_ARCH}.tar.gz | tar -C \$HOME/.local -xz && export PATH=\$HOME/.local/go/bin:\$PATH"

  if [ "$OS" = "macos" ]; then
    GO_JSON=$(echo "$GO_JSON" | jq --arg cmd "$GO_INSTALL_CMD" '. + {"install_suggestion": {
      "command": $cmd,
      "safety": "gated_auto",
      "risk_hint": "Installs Go to ~/.local/go, requires adding ~/.local/go/bin to PATH",
      "manual": "Install from https://go.dev/doc/install or use: brew install go"
    }}')
  elif [ "$OS" = "linux" ]; then
    GO_JSON=$(echo "$GO_JSON" | jq --arg cmd "$GO_INSTALL_CMD" '. + {"install_suggestion": {
      "command": $cmd,
      "safety": "gated_auto",
      "risk_hint": "Installs Go to ~/.local/go, requires adding ~/.local/go/bin to PATH",
      "manual": "Install from https://go.dev/doc/install or use: sudo apt install golang-go"
    }}')
  else
    GO_JSON=$(echo "$GO_JSON" | jq '. + {"install_suggestion": {
      "command": "echo \"Please install Go from https://go.dev/doc/install\"",
      "safety": "manual",
      "risk_hint": "",
      "manual": "Install from https://go.dev/doc/install"
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
      "command": "echo \"Please install jq from https://jqlang.github.io/jq/\"",
      "safety": "manual",
      "risk_hint": "",
      "manual": "Install from https://jqlang.github.io/jq/"
    }}')
  fi
fi

# Output combined JSON
jq -n \
  --argjson node "$NODE_JSON" \
  --argjson go "$GO_JSON" \
  --argjson uv "$UV_JSON" \
  --argjson jq_dep "$JQ_JSON" \
  --arg os "$OS" \
  '{
    "os": $os,
    "node": $node,
    "go": $go,
    "uv": $uv,
    "jq": $jq_dep
  }'
