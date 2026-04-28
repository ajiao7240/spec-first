#!/bin/bash
# check-deps.sh - Detect prerequisite dependencies for Required Harness Runtime setup.

set -euo pipefail

detect_os_without_jq() {
  local os
  os="$(uname -s 2>/dev/null || echo "unknown")"
  case "$os" in
    Darwin) echo "macos" ;;
    Linux) echo "linux" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *) echo "unknown" ;;
  esac
}

jq_install_suggestion() {
  case "$(detect_os_without_jq)" in
    macos) echo "brew install jq" ;;
    linux) echo "sudo apt-get install -y jq" ;;
    windows) echo "winget install jqlang.jq" ;;
    *) echo "请参考 https://jqlang.github.io/jq/ 安装 jq" ;;
  esac
}

command -v jq >/dev/null 2>&1 || {
  echo "错误：jq 是必需依赖，请先安装 jq。建议：$(jq_install_suggestion)" >&2
  exit 1
}

detect_os() {
  local os
  os="$(uname -s 2>/dev/null || echo "unknown")"
  case "$os" in
    Darwin) echo "macos" ;;
    Linux)
      if grep -qi microsoft /proc/version 2>/dev/null; then
        echo "wsl"
      else
        echo "linux"
      fi
      ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *) echo "unknown" ;;
  esac
}

install_suggestion_for() {
  local cmd="$1"
  local os="$2"
  case "$cmd:$os" in
    node:macos|npm:macos|npx:macos) echo "brew install node" ;;
    node:linux|npm:linux|npx:linux|node:wsl|npm:wsl|npx:wsl) echo "curl -fsSL https://fnm.vercel.app/install | bash && fnm install --lts" ;;
    node:windows|npm:windows|npx:windows) echo "winget install OpenJS.NodeJS.LTS" ;;
    uv:windows|uvx:windows) echo "powershell -ExecutionPolicy ByPass -c \"irm https://astral.sh/uv/install.ps1 | iex\"" ;;
    uv:*|uvx:*) echo "curl -LsSf https://astral.sh/uv/install.sh | sh" ;;
    python3:macos) echo "brew install python" ;;
    python3:linux|python3:wsl) echo "sudo apt-get install -y python3" ;;
    git:macos) echo "xcode-select --install or brew install git" ;;
    git:linux|git:wsl) echo "sudo apt-get install -y git" ;;
    git:windows) echo "winget install Git.Git" ;;
    *) echo "" ;;
  esac
}

check_command_json() {
  local cmd="$1"
  local required="$2"
  local os="$3"
  local version_flag="${4:---version}"
  if command -v "$cmd" >/dev/null 2>&1; then
    local version
    version="$("$cmd" "$version_flag" 2>&1 | head -1 || true)"
    jq -n --argjson required "$required" --arg version "$version" '{required:$required,installed:true,version:$version,install_suggestion:null}'
  else
    local suggestion
    suggestion="$(install_suggestion_for "$cmd" "$os")"
    jq -n --argjson required "$required" --arg suggestion "$suggestion" '{required:$required,installed:false,version:null,install_suggestion:(if $suggestion == "" then null else $suggestion end)}'
  fi
}

OS="$(detect_os)"

NODE_JSON="$(check_command_json node true "$OS")"
NPM_JSON="$(check_command_json npm true "$OS")"
NPX_JSON="$(check_command_json npx true "$OS")"
UV_JSON="$(check_command_json uv true "$OS")"
UVX_JSON="$(check_command_json uvx true "$OS")"
JQ_JSON="$(check_command_json jq true "$OS")"
PYTHON_JSON="$(check_command_json python3 true "$OS" --version)"
GIT_JSON="$(check_command_json git false "$OS" --version)"

jq -n \
  --arg schema "deps.v2" \
  --arg platform "$OS" \
  --argjson node "$NODE_JSON" \
  --argjson npm "$NPM_JSON" \
  --argjson npx "$NPX_JSON" \
  --argjson uv "$UV_JSON" \
  --argjson uvx "$UVX_JSON" \
  --argjson jq_dep "$JQ_JSON" \
  --argjson python3 "$PYTHON_JSON" \
  --argjson git "$GIT_JSON" \
  '{
    schema_version:$schema,
    platform:$platform,
    dependencies:{
      node:$node,
      npm:$npm,
      npx:$npx,
      uv:$uv,
      uvx:$uvx,
      jq:$jq_dep,
      python3:$python3,
      git:$git
    }
  }
  | .required_ready = ([.dependencies[] | select(.required == true) | .installed] | all)
  | .warnings = (
      [.dependencies | to_entries[] | select(.value.required == false and .value.installed == false) | "\(.key) missing"]
    )'
