#!/bin/bash
# install-helpers.sh - Install or verify required non-MCP helper tooling.

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

MODE="install"
DEFAULT_STAGE_TIMEOUT_SECONDS="${SPEC_FIRST_STAGE_TIMEOUT_SECONDS:-900}"
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

stage_log() {
  local stage="$1"
  local message="$2"
  printf 'spec-mcp-setup: [helpers/%s] %s\n' "$stage" "$message" >&2
}

run_with_timeout() {
  local timeout_seconds="$1"
  shift
  python3 - "$timeout_seconds" "$@" <<'PY'
import subprocess
import sys

timeout = float(sys.argv[1])
args = sys.argv[2:]

try:
    completed = subprocess.run(args, check=False, stdin=subprocess.DEVNULL, timeout=timeout)
except subprocess.TimeoutExpired:
    sys.exit(124)
except FileNotFoundError as exc:
    sys.stderr.write(f"{exc}\n")
    sys.exit(127)
except Exception as exc:
    sys.stderr.write(f"{exc}\n")
    sys.exit(1)

sys.exit(completed.returncode)
PY
}

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
    echo "sudo apt-get update && sudo apt-get install -y $apt_pkg"
  elif command -v dnf >/dev/null 2>&1; then
    echo "sudo dnf upgrade -y $dnf_pkg || sudo dnf install -y $dnf_pkg"
  elif command -v yum >/dev/null 2>&1; then
    echo "sudo yum update -y $yum_pkg || sudo yum install -y $yum_pkg"
  elif command -v pacman >/dev/null 2>&1; then
    echo "sudo pacman -Syu --needed $pacman_pkg"
  elif command -v apk >/dev/null 2>&1; then
    echo "sudo apk update && sudo apk add --upgrade $apk_pkg"
  else
    echo ""
  fi
}

run_with_optional_sudo() {
  if [ "$(id -u 2>/dev/null || echo 1)" = "0" ]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo -n "$@"
  else
    return 1
  fi
}

run_npm_global_install_with_optional_sudo() {
  if env CI=true npm install -g "$@" --no-audit --no-fund --loglevel=error; then
    return 0
  fi
  command -v sudo >/dev/null 2>&1 || return 1
  sudo -n env CI=true npm install -g "$@" --no-audit --no-fund --loglevel=error
}

brew_latest_install_command() {
  local pkg="$1"
  echo "brew update && if brew list --formula $pkg >/dev/null 2>&1; then brew upgrade -q $pkg; else brew install -q $pkg; fi"
}

winget_latest_install_command() {
  local package_id="$1"
  echo "winget upgrade --id $package_id -e --silent --accept-package-agreements --accept-source-agreements || winget install --id $package_id -e --silent --accept-package-agreements --accept-source-agreements"
}

run_brew_latest_install() {
  local pkg="$1"
  brew update >/dev/null 2>&1 || true
  if brew list --formula "$pkg" >/dev/null 2>&1; then
    brew upgrade -q "$pkg" || true
  else
    brew install -q "$pkg"
  fi
}

run_winget_latest_install() {
  local package_id="$1"
  winget upgrade --id "$package_id" -e --silent --accept-package-agreements --accept-source-agreements \
    || winget install --id "$package_id" -e --silent --accept-package-agreements --accept-source-agreements
}

run_linux_package_install() {
  local apt_pkg="$1"
  local dnf_pkg="$2"
  local yum_pkg="$3"
  local pacman_pkg="$4"
  local apk_pkg="$5"

  if command -v apt-get >/dev/null 2>&1; then
    run_with_optional_sudo apt-get update
    run_with_optional_sudo apt-get install -y "$apt_pkg"
  elif command -v dnf >/dev/null 2>&1; then
    run_with_optional_sudo dnf upgrade -y "$dnf_pkg" || run_with_optional_sudo dnf install -y "$dnf_pkg"
  elif command -v yum >/dev/null 2>&1; then
    run_with_optional_sudo yum update -y "$yum_pkg" || run_with_optional_sudo yum install -y "$yum_pkg"
  elif command -v pacman >/dev/null 2>&1; then
    run_with_optional_sudo pacman -Syu --needed --noconfirm "$pacman_pkg"
  elif command -v apk >/dev/null 2>&1; then
    run_with_optional_sudo apk update
    run_with_optional_sudo apk add --upgrade "$apk_pkg"
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
      echo "CI=true npm install -g agent-browser@latest --no-audit --no-fund --loglevel=error && agent-browser install && npx -y skills@latest add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y"
      ;;
    gh)
      if [ "$os" = "windows" ]; then
        winget_latest_install_command "GitHub.cli"
      elif [ "$os" = "linux" ]; then
        linux_cmd="$(linux_package_install_command gh gh gh github-cli github-cli)"
        echo "${linux_cmd:-Install gh from https://cli.github.com}"
      else
        brew_latest_install_command "gh"
      fi
      ;;
    jq)
      if [ "$os" = "windows" ]; then
        winget_latest_install_command "jqlang.jq"
      elif [ "$os" = "linux" ]; then
        linux_cmd="$(linux_package_install_command jq jq jq jq jq)"
        echo "${linux_cmd:-Install jq from https://jqlang.github.io/jq/}"
      else
        brew_latest_install_command "jq"
      fi
      ;;
    vhs)
      if [ "$os" = "linux" ] || [ "$os" = "windows" ]; then
        if command -v go >/dev/null 2>&1; then echo "go install github.com/charmbracelet/vhs@latest"; else echo "Install vhs from https://github.com/charmbracelet/vhs"; fi
      else
        brew_latest_install_command "vhs"
      fi
      ;;
    silicon)
      if [ "$os" = "linux" ] || [ "$os" = "windows" ]; then
        if command -v cargo >/dev/null 2>&1; then echo "cargo install silicon --force"; else echo "Install silicon from https://github.com/Aloxaf/silicon"; fi
      else
        brew_latest_install_command "silicon"
      fi
      ;;
    ffmpeg)
      if [ "$os" = "windows" ]; then
        winget_latest_install_command "Gyan.FFmpeg"
      elif [ "$os" = "linux" ]; then
        linux_cmd="$(linux_package_install_command ffmpeg ffmpeg ffmpeg ffmpeg ffmpeg)"
        echo "${linux_cmd:-Install ffmpeg from https://ffmpeg.org/download.html}"
      else
        brew_latest_install_command "ffmpeg"
      fi
      ;;
    ast-grep)
      if [ "$os" = "windows" ]; then
        echo "npm install -g @ast-grep/cli@latest"
      elif [ "$os" = "linux" ]; then
        if command -v cargo >/dev/null 2>&1; then echo "cargo install ast-grep --locked --force"; elif command -v npm >/dev/null 2>&1; then echo "npm install -g @ast-grep/cli@latest"; else echo "Install ast-grep from https://ast-grep.github.io"; fi
      else
        brew_latest_install_command "ast-grep"
      fi
      ;;
    ast-grep-skill)
      echo "npx -y skills@latest add ast-grep/agent-skill -g -y"
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
      if [ "$os" = "windows" ]; then run_winget_latest_install "GitHub.cli"; elif [ "$os" = "linux" ]; then run_linux_package_install gh gh gh github-cli github-cli; else run_brew_latest_install "gh"; fi
      ;;
    jq)
      if [ "$os" = "windows" ]; then run_winget_latest_install "jqlang.jq"; elif [ "$os" = "linux" ]; then run_linux_package_install jq jq jq jq jq; else run_brew_latest_install "jq"; fi
      ;;
    vhs)
      if [ "$os" = "linux" ] || [ "$os" = "windows" ]; then command -v go >/dev/null 2>&1 && go install github.com/charmbracelet/vhs@latest; else run_brew_latest_install "vhs"; fi
      ;;
    silicon)
      if [ "$os" = "linux" ] || [ "$os" = "windows" ]; then command -v cargo >/dev/null 2>&1 && cargo install silicon --force; else run_brew_latest_install "silicon"; fi
      ;;
    ffmpeg)
      if [ "$os" = "windows" ]; then run_winget_latest_install "Gyan.FFmpeg"; elif [ "$os" = "linux" ]; then run_linux_package_install ffmpeg ffmpeg ffmpeg ffmpeg ffmpeg; else run_brew_latest_install "ffmpeg"; fi
      ;;
    ast-grep)
      if [ "$os" = "windows" ]; then run_npm_global_install_with_optional_sudo @ast-grep/cli@latest; elif [ "$os" = "linux" ]; then if command -v cargo >/dev/null 2>&1; then cargo install ast-grep --locked --force; elif command -v npm >/dev/null 2>&1; then run_npm_global_install_with_optional_sudo @ast-grep/cli@latest; else return 1; fi; else run_brew_latest_install "ast-grep"; fi
      ;;
    ast-grep-skill)
      npx -y skills@latest add ast-grep/agent-skill -g -y
      ;;
    *)
      return 1
      ;;
  esac
}

run_install_command_with_timeout() {
  local name="$1"
  local os="$2"
  local stage="$3"
  local exit_code=0
  stage_log "$stage" "start"
  if run_with_timeout "$DEFAULT_STAGE_TIMEOUT_SECONDS" bash -c 'run_install_command "$1" "$2"' _ "$name" "$os" >/dev/null 2>&1; then
    stage_log "$stage" "done (exit 0)"
    return 0
  fi
  exit_code="$?"
  if [ "$exit_code" -eq 124 ]; then
    stage_log "$stage" "timed out after ${DEFAULT_STAGE_TIMEOUT_SECONDS}s"
  else
    stage_log "$stage" "done (exit $exit_code)"
  fi
  return "$exit_code"
}

export -f run_winget_latest_install
export -f run_linux_package_install
export -f run_brew_latest_install
export -f run_with_optional_sudo
export -f run_npm_global_install_with_optional_sudo
export -f run_install_command

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
      stage_log "agent-browser" "installing CLI via npm"
      if run_with_timeout "$DEFAULT_STAGE_TIMEOUT_SECONDS" bash -c 'run_npm_global_install_with_optional_sudo agent-browser@latest' >/dev/null 2>&1 && command -v agent-browser >/dev/null 2>&1; then
        dependency_status="ready"
        install_status="ready"
        status="ready"
        next_action=""
        stage_log "agent-browser" "CLI install finished"
      else
        if [ "$?" -eq 124 ]; then
          next_action="agent-browser CLI install timed out after ${DEFAULT_STAGE_TIMEOUT_SECONDS}s"
          stage_log "agent-browser" "CLI install timed out after ${DEFAULT_STAGE_TIMEOUT_SECONDS}s"
        else
          next_action="agent-browser CLI not found after npm install"
          stage_log "agent-browser" "CLI install did not produce an executable"
        fi
      fi
    fi
  fi

  if [ "$status" = "ready" ] && [ "$MODE" = "verify-only" ] && [ ! -f "$AGENT_BROWSER_INSTALL_MARKER" ]; then
    status="action-required"
    install_status="action-required"
    next_action="run agent-browser install"
  fi

  if [ "$status" = "ready" ] && [ "$MODE" = "install" ]; then
    stage_log "agent-browser" "running agent-browser install"
    if run_with_timeout "$DEFAULT_STAGE_TIMEOUT_SECONDS" agent-browser install >/dev/null 2>&1; then
      write_agent_browser_install_marker
      stage_log "agent-browser" "agent-browser install finished"
    else
      status="action-required"
      install_status="action-required"
      if [ "$?" -eq 124 ]; then
        next_action="agent-browser install timed out after ${DEFAULT_STAGE_TIMEOUT_SECONDS}s"
        stage_log "agent-browser" "agent-browser install timed out after ${DEFAULT_STAGE_TIMEOUT_SECONDS}s"
      else
        next_action="run agent-browser install manually"
        stage_log "agent-browser" "agent-browser install failed"
      fi
    fi
  fi

  if [ "$status" = "ready" ] && ! global_skill_installed "agent-browser"; then
    skill_status="action-required"
    status="action-required"
    next_action="install global agent-browser skill"
    if [ "$MODE" = "install" ]; then
      stage_log "agent-browser" "installing global skill"
      if run_with_timeout "$DEFAULT_STAGE_TIMEOUT_SECONDS" npx -y skills@latest add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y >/dev/null 2>&1 && global_skill_installed "agent-browser"; then
        skill_status="ready"
        status="ready"
        next_action=""
        stage_log "agent-browser" "global skill install finished"
      else
        if [ "$?" -eq 124 ]; then
          next_action="global agent-browser skill install timed out after ${DEFAULT_STAGE_TIMEOUT_SECONDS}s"
          stage_log "agent-browser" "global skill install timed out after ${DEFAULT_STAGE_TIMEOUT_SECONDS}s"
        else
          next_action="install global agent-browser skill manually"
          stage_log "agent-browser" "global skill install failed"
        fi
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
      if run_install_command_with_timeout "$name" "$os" "install:$name" && command -v "$name" >/dev/null 2>&1; then
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
      stage_log "install:${skill_name}-skill" "start"
      if run_with_timeout "$DEFAULT_STAGE_TIMEOUT_SECONDS" npx -y skills@latest add ast-grep/agent-skill -g -y >/dev/null 2>&1 && global_skill_installed "$skill_name"; then
        dependency_status="ready"
        install_status="ready"
        skill_status="ready"
        status="ready"
        next_action=""
        stage_log "install:${skill_name}-skill" "done (exit 0)"
      else
        if [ "$?" -eq 124 ]; then
          next_action="global ${skill_name}-skill install timed out after ${DEFAULT_STAGE_TIMEOUT_SECONDS}s"
          stage_log "install:${skill_name}-skill" "timed out after ${DEFAULT_STAGE_TIMEOUT_SECONDS}s"
        else
          next_action="${next_action:-install global $skill_name skill manually}"
          stage_log "install:${skill_name}-skill" "done (exit 1)"
        fi
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
