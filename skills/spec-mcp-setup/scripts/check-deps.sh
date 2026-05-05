#!/bin/bash
# check-deps.sh - Detect prerequisite dependencies for Required Harness Runtime setup.

set -euo pipefail

detect_os_without_jq() {
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

linux_package_install_command() {
  local apt_pkg="$1"
  local dnf_pkg="$2"
  local yum_pkg="$3"
  local pacman_pkg="$4"
  local apk_pkg="$5"

  if command -v apt-get >/dev/null 2>&1; then
    echo "sudo apt-get update && sudo apt-get install -y $apt_pkg"
  elif command -v dnf >/dev/null 2>&1; then
    echo "sudo dnf install -y $dnf_pkg"
	  elif command -v yum >/dev/null 2>&1; then
	    echo "sudo yum install -y $yum_pkg"
	  elif command -v pacman >/dev/null 2>&1; then
	    echo "sudo pacman -Syu --needed $pacman_pkg"
	  elif command -v apk >/dev/null 2>&1; then
	    echo "sudo apk update && sudo apk add --upgrade $apk_pkg"
  else
    echo ""
  fi
}

jq_install_suggestion() {
  local linux_cmd
  case "$(detect_os_without_jq)" in
    macos) echo "brew install jq" ;;
    linux|wsl)
      linux_cmd="$(linux_package_install_command jq jq jq jq jq)"
      echo "${linux_cmd:-请参考 https://jqlang.github.io/jq/ 安装 jq}"
      ;;
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
	  local linux_cmd
	  local fnm_fallback='tmp=$(mktemp) && curl -fsSL https://fnm.vercel.app/install -o "$tmp" && printf '\''Installer saved to %s\nReview it, then run: bash "%s" && fnm install --lts\n'\'' "$tmp" "$tmp"'
	  case "$cmd:$os" in
	    node:macos|npm:macos|npx:macos) echo "brew install node" ;;
	    node:linux|node:wsl)
	      linux_cmd="$(linux_package_install_command nodejs nodejs nodejs nodejs nodejs)"
	      echo "${linux_cmd:-$fnm_fallback}"
	      ;;
	    npm:linux|npx:linux|npm:wsl|npx:wsl)
	      linux_cmd="$(linux_package_install_command npm npm npm npm npm)"
	      echo "${linux_cmd:-$fnm_fallback}"
	      ;;
	    node:windows|npm:windows|npx:windows) echo "winget install OpenJS.NodeJS.LTS" ;;
    uv:windows|uvx:windows) echo "powershell -NoProfile -ExecutionPolicy ByPass -Command \"\$script = Join-Path \$env:TEMP 'uv-install.ps1'; Invoke-WebRequest -Uri https://astral.sh/uv/install.ps1 -OutFile \$script; Write-Output ('Installer saved to ' + \$script); Write-Output ('Review it, then run: powershell -NoProfile -ExecutionPolicy ByPass -File ' + \$script)\"" ;;
    uv:*|uvx:*) echo "tmp=\$(mktemp) && curl -LsSf https://astral.sh/uv/install.sh -o \"\$tmp\" && printf 'Installer saved to %s\nReview it, then run: sh \"%s\"\n' \"\$tmp\" \"\$tmp\"" ;;
    python3:macos) echo "brew install python" ;;
    python3:linux|python3:wsl)
      linux_cmd="$(linux_package_install_command python3 python3 python3 python python3)"
      echo "${linux_cmd:-Install Python from https://www.python.org/downloads/}"
      ;;
    git:macos) echo "xcode-select --install or brew install git" ;;
    git:linux|git:wsl)
      linux_cmd="$(linux_package_install_command git git git git git)"
      echo "${linux_cmd:-Install git from https://git-scm.com/downloads}"
      ;;
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
