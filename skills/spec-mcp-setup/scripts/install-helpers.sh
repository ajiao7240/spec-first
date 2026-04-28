#!/bin/bash
# install-helpers.sh - Install or verify required non-MCP helper tooling.

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

MODE="install"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --install)
      MODE="install"
      shift
      ;;
    --verify-only)
      MODE="verify-only"
      shift
      ;;
    *)
      shift
      ;;
  esac
done

GLOBAL_AGENT_BROWSER_SKILL="$HOME/.agents/skills/agent-browser/SKILL.md"
GLOBAL_AST_GREP_SKILL="$HOME/.agents/skills/ast-grep/SKILL.md"
AGENT_BROWSER_INSTALL_MARKER="$HOME/.agent-browser/spec-first-install.json"
HELPER_JSON='{}'

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

linux_package_install_command() {
  local apt_pkg="$1"
  local dnf_pkg="$2"
  local yum_pkg="$3"
  local pacman_pkg="$4"
  local apk_pkg="$5"

  if command -v apt-get >/dev/null 2>&1; then
    echo "sudo apt-get install -y $apt_pkg"
  elif command -v dnf >/dev/null 2>&1; then
    echo "sudo dnf install -y $dnf_pkg"
  elif command -v yum >/dev/null 2>&1; then
    echo "sudo yum install -y $yum_pkg"
  elif command -v pacman >/dev/null 2>&1; then
    echo "sudo pacman -S --noconfirm $pacman_pkg"
  elif command -v apk >/dev/null 2>&1; then
    echo "sudo apk add $apk_pkg"
  else
    echo ""
  fi
}

run_with_optional_sudo() {
  if [ "$(id -u 2>/dev/null || echo 1)" = "0" ]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    return 1
  fi
}

run_linux_package_install() {
  local apt_pkg="$1"
  local dnf_pkg="$2"
  local yum_pkg="$3"
  local pacman_pkg="$4"
  local apk_pkg="$5"

  if command -v apt-get >/dev/null 2>&1; then
    run_with_optional_sudo apt-get install -y "$apt_pkg"
  elif command -v dnf >/dev/null 2>&1; then
    run_with_optional_sudo dnf install -y "$dnf_pkg"
  elif command -v yum >/dev/null 2>&1; then
    run_with_optional_sudo yum install -y "$yum_pkg"
  elif command -v pacman >/dev/null 2>&1; then
    run_with_optional_sudo pacman -S --noconfirm "$pacman_pkg"
  elif command -v apk >/dev/null 2>&1; then
    run_with_optional_sudo apk add "$apk_pkg"
  else
    return 1
  fi
}

install_command_for() {
  local name="$1"
  local os="$2"
  local linux_cmd
  case "$name" in
    agent-browser)
      echo "CI=true npm install -g agent-browser --no-audit --no-fund --loglevel=error && agent-browser install && npx skills add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y"
      ;;
    gh)
      if [ "$os" = "windows" ]; then
        echo "winget install --id GitHub.cli -e --silent --accept-package-agreements --accept-source-agreements"
      elif [ "$os" = "linux" ]; then
        linux_cmd="$(linux_package_install_command gh gh gh github-cli github-cli)"
        echo "${linux_cmd:-Install gh from https://cli.github.com}"
      else
        echo "NONINTERACTIVE=1 HOMEBREW_NO_AUTO_UPDATE=1 brew install -q gh"
      fi
      ;;
    jq)
      if [ "$os" = "windows" ]; then
        echo "winget install --id jqlang.jq -e --silent --accept-package-agreements --accept-source-agreements"
      elif [ "$os" = "linux" ]; then
        linux_cmd="$(linux_package_install_command jq jq jq jq jq)"
        echo "${linux_cmd:-Install jq from https://jqlang.github.io/jq/}"
      else
        echo "NONINTERACTIVE=1 HOMEBREW_NO_AUTO_UPDATE=1 brew install -q jq"
      fi
      ;;
    vhs)
      if [ "$os" = "linux" ] || [ "$os" = "windows" ]; then
        if command -v go >/dev/null 2>&1; then echo "go install github.com/charmbracelet/vhs@latest"; else echo "Install vhs from https://github.com/charmbracelet/vhs"; fi
      else
        echo "NONINTERACTIVE=1 HOMEBREW_NO_AUTO_UPDATE=1 brew install -q vhs"
      fi
      ;;
    silicon)
      if [ "$os" = "linux" ] || [ "$os" = "windows" ]; then
        if command -v cargo >/dev/null 2>&1; then echo "cargo install silicon"; else echo "Install silicon from https://github.com/Aloxaf/silicon"; fi
      else
        echo "NONINTERACTIVE=1 HOMEBREW_NO_AUTO_UPDATE=1 brew install -q silicon"
      fi
      ;;
    ffmpeg)
      if [ "$os" = "windows" ]; then
        echo "winget install --id Gyan.FFmpeg -e --silent --accept-package-agreements --accept-source-agreements"
      elif [ "$os" = "linux" ]; then
        linux_cmd="$(linux_package_install_command ffmpeg ffmpeg ffmpeg ffmpeg ffmpeg)"
        echo "${linux_cmd:-Install ffmpeg from https://ffmpeg.org/download.html}"
      else
        echo "NONINTERACTIVE=1 HOMEBREW_NO_AUTO_UPDATE=1 brew install -q ffmpeg"
      fi
      ;;
    ast-grep)
      if [ "$os" = "windows" ]; then
        echo "npm install -g @ast-grep/cli"
      elif [ "$os" = "linux" ]; then
        if command -v cargo >/dev/null 2>&1; then echo "cargo install ast-grep --locked"; elif command -v npm >/dev/null 2>&1; then echo "npm install -g @ast-grep/cli"; else echo "Install ast-grep from https://ast-grep.github.io"; fi
      else
        echo "NONINTERACTIVE=1 HOMEBREW_NO_AUTO_UPDATE=1 brew install -q ast-grep"
      fi
      ;;
    ast-grep-skill)
      echo "npx skills add ast-grep/agent-skill -g -y"
      ;;
    *)
      echo ""
      ;;
  esac
}

run_install_command() {
  local name="$1"
  local os="$2"
  case "$name" in
    gh)
      if [ "$os" = "windows" ]; then winget install --id GitHub.cli -e --silent --accept-package-agreements --accept-source-agreements; elif [ "$os" = "linux" ]; then run_linux_package_install gh gh gh github-cli github-cli; else NONINTERACTIVE=1 HOMEBREW_NO_AUTO_UPDATE=1 brew install -q gh; fi
      ;;
    jq)
      if [ "$os" = "windows" ]; then winget install --id jqlang.jq -e --silent --accept-package-agreements --accept-source-agreements; elif [ "$os" = "linux" ]; then run_linux_package_install jq jq jq jq jq; else NONINTERACTIVE=1 HOMEBREW_NO_AUTO_UPDATE=1 brew install -q jq; fi
      ;;
    vhs)
      if [ "$os" = "linux" ] || [ "$os" = "windows" ]; then command -v go >/dev/null 2>&1 && go install github.com/charmbracelet/vhs@latest; else NONINTERACTIVE=1 HOMEBREW_NO_AUTO_UPDATE=1 brew install -q vhs; fi
      ;;
    silicon)
      if [ "$os" = "linux" ] || [ "$os" = "windows" ]; then command -v cargo >/dev/null 2>&1 && cargo install silicon; else NONINTERACTIVE=1 HOMEBREW_NO_AUTO_UPDATE=1 brew install -q silicon; fi
      ;;
    ffmpeg)
      if [ "$os" = "windows" ]; then winget install --id Gyan.FFmpeg -e --silent --accept-package-agreements --accept-source-agreements; elif [ "$os" = "linux" ]; then run_linux_package_install ffmpeg ffmpeg ffmpeg ffmpeg ffmpeg; else NONINTERACTIVE=1 HOMEBREW_NO_AUTO_UPDATE=1 brew install -q ffmpeg; fi
      ;;
    ast-grep)
      if [ "$os" = "windows" ]; then npm install -g @ast-grep/cli; elif [ "$os" = "linux" ]; then if command -v cargo >/dev/null 2>&1; then cargo install ast-grep --locked; elif command -v npm >/dev/null 2>&1; then npm install -g @ast-grep/cli; else return 1; fi; else NONINTERACTIVE=1 HOMEBREW_NO_AUTO_UPDATE=1 brew install -q ast-grep; fi
      ;;
    ast-grep-skill)
      npx skills add ast-grep/agent-skill -g -y
      ;;
    *)
      return 1
      ;;
  esac
}

add_helper_fact() {
  local id="$1"
  local type="$2"
  local dependency_status="$3"
  local install_status="$4"
  local skill_status="$5"
  local result="$6"
  local next_action="$7"

  HELPER_JSON="$(jq \
    --arg id "$id" \
    --arg type "$type" \
    --arg dependency_status "$dependency_status" \
    --arg install_status "$install_status" \
    --arg skill_status "$skill_status" \
    --arg result "$result" \
    --arg next_action "$next_action" \
    '. + {($id): {
      required: true,
      type: $type,
      dependency_status: $dependency_status,
      host_config_status: "not-applicable",
      install_status: $install_status,
      skill_status: $skill_status,
      project_status: "not-applicable",
      result: $result,
      next_action: $next_action
    }}' <<<"$HELPER_JSON")"
}

write_agent_browser_install_marker() {
  local marker_dir
  marker_dir="$(dirname "$AGENT_BROWSER_INSTALL_MARKER")"
  mkdir -p "$marker_dir"
  local tmp
  tmp="$(mktemp "${marker_dir}/spec-first-install.XXXXXX")"
  chmod 600 "$tmp"
  jq -n \
    --arg installed_at "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
    --arg source "spec-mcp-setup" \
    '{schema_version:"agent-browser-install.v1",installed_by:$source,installed_at:$installed_at,install_command:"agent-browser install"}' > "$tmp"
  mv "$tmp" "$AGENT_BROWSER_INSTALL_MARKER"
}

global_skill_installed() {
  local skill_name="$1"
  [ -f "$HOME/.agents/skills/$skill_name/SKILL.md" ] || [ -f "$HOME/.claude/skills/$skill_name/SKILL.md" ]
}

process_agent_browser() {
  local status="ready"
  local dependency_status="ready"
  local install_status="ready"
  local skill_status="ready"
  local next_action=""

  if ! command -v agent-browser >/dev/null 2>&1; then
    dependency_status="missing"
    install_status="action-required"
    status="action-required"
    next_action="install agent-browser CLI"
    if [ "$MODE" = "install" ]; then
      if CI=true npm install -g agent-browser --no-audit --no-fund --loglevel=error >/dev/null 2>&1 && command -v agent-browser >/dev/null 2>&1; then
        dependency_status="ready"
        install_status="ready"
        status="ready"
        next_action=""
      else
        next_action="agent-browser CLI not found after npm install"
      fi
    fi
  fi

  if [ "$status" = "ready" ] && [ "$MODE" = "verify-only" ] && [ ! -f "$AGENT_BROWSER_INSTALL_MARKER" ]; then
    status="action-required"
    install_status="action-required"
    next_action="run agent-browser install"
  fi

  if [ "$status" = "ready" ] && [ "$MODE" = "install" ]; then
    if agent-browser install >/dev/null 2>&1; then
      write_agent_browser_install_marker
    else
      status="action-required"
      install_status="action-required"
      next_action="run agent-browser install manually"
    fi
  fi

  if [ "$status" = "ready" ] && ! global_skill_installed "agent-browser"; then
    skill_status="action-required"
    status="action-required"
    next_action="install global agent-browser skill"
    if [ "$MODE" = "install" ]; then
      if npx skills add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y >/dev/null 2>&1 && global_skill_installed "agent-browser"; then
        skill_status="ready"
        status="ready"
        next_action=""
      else
        next_action="install global agent-browser skill manually"
      fi
    fi
  fi

  add_helper_fact "agent-browser" "helper" "$dependency_status" "$install_status" "$skill_status" "$status" "$next_action"
}

process_cli_helper() {
  local name="$1"
  local os="$2"
  local status="ready"
  local dependency_status="ready"
  local install_status="ready"
  local next_action=""

  if ! command -v "$name" >/dev/null 2>&1; then
    dependency_status="missing"
    install_status="action-required"
    status="action-required"
    next_action="$(install_command_for "$name" "$os")"
    if [ "$MODE" = "install" ]; then
      if run_install_command "$name" "$os" >/dev/null 2>&1 && command -v "$name" >/dev/null 2>&1; then
        dependency_status="ready"
        install_status="ready"
        status="ready"
        next_action=""
      else
        next_action="${next_action:-install $name manually}"
      fi
    fi
  fi

  add_helper_fact "$name" "helper" "$dependency_status" "$install_status" "not-applicable" "$status" "$next_action"
}

process_global_skill() {
  local skill_name="$1"
  local helper_id="$2"
  local status="ready"
  local dependency_status="ready"
  local install_status="ready"
  local skill_status="ready"
  local next_action=""

  if ! global_skill_installed "$skill_name"; then
    dependency_status="missing"
    install_status="action-required"
    skill_status="action-required"
    status="action-required"
    next_action="$(install_command_for "${skill_name}-skill" "$(detect_os)")"
    if [ "$MODE" = "install" ]; then
      if run_install_command "${skill_name}-skill" "$(detect_os)" >/dev/null 2>&1 && global_skill_installed "$skill_name"; then
        dependency_status="ready"
        install_status="ready"
        skill_status="ready"
        status="ready"
        next_action=""
      else
        next_action="${next_action:-install global $skill_name skill manually}"
      fi
    fi
  fi

  add_helper_fact "$helper_id" "global-skill" "$dependency_status" "$install_status" "$skill_status" "$status" "$next_action"
}

OS="$(detect_os)"
process_agent_browser
for helper in gh jq vhs silicon ffmpeg ast-grep; do
  process_cli_helper "$helper" "$OS"
done
process_global_skill "ast-grep" "ast-grep-skill"

jq -n --argjson helper_tools "$HELPER_JSON" '{helper_tools: $helper_tools}'
