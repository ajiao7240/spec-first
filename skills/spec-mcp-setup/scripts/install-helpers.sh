#!/bin/bash
# install-helpers.sh - Install or verify required non-MCP helper tooling.

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib-helper-registry.sh"

MODE="install"
DEFAULT_STAGE_TIMEOUT_SECONDS="${SPEC_FIRST_STAGE_TIMEOUT_SECONDS:-900}"

NPM_MIRROR_ENDPOINT="https://registry.npmmirror.com"
UV_MIRROR_ENDPOINT="https://mirrors.tuna.tsinghua.edu.cn/pypi/simple"
CHROME_MIRROR_ENDPOINT="https://npmmirror.com/mirrors/chrome-for-testing"
LAST_INSTALL_SOURCE="official"
LAST_INSTALL_MIRROR_USED="false"
BROWSER_HELPER_OPT_IN_ACTION="set SPEC_FIRST_BROWSER_HELPER_REQUIRED=1 and rerun spec-mcp-setup install"
export NPM_MIRROR_ENDPOINT UV_MIRROR_ENDPOINT CHROME_MIRROR_ENDPOINT

reset_install_provenance() {
  LAST_INSTALL_SOURCE="official"
  LAST_INSTALL_MIRROR_USED="false"
}

write_install_provenance() {
  if [ -n "${LAST_INSTALL_PROVENANCE_FILE:-}" ]; then
    printf 'install_source=%s\nmirror_used=%s\n' "$LAST_INSTALL_SOURCE" "$LAST_INSTALL_MIRROR_USED" >"$LAST_INSTALL_PROVENANCE_FILE" 2>/dev/null || true
  fi
}

load_install_provenance() {
  local provenance_file="$1"
  local key value
  [ -s "$provenance_file" ] || return 0
  while IFS='=' read -r key value; do
    case "$key" in
      install_source) LAST_INSTALL_SOURCE="$value" ;;
      mirror_used) LAST_INSTALL_MIRROR_USED="$value" ;;
    esac
  done <"$provenance_file"
}

# run_with_mirror_fallback <mirror_env_pairs...> -- <cmd...>
# mirror_env_pairs: KEY=VALUE entries injected on the second attempt only.
run_with_mirror_fallback() {
  local -a mirror_env=()
  while [ $# -gt 0 ]; do
    if [ "$1" = "--" ]; then
      shift
      break
    fi
    mirror_env+=("$1")
    shift
  done

  if "$@"; then
    LAST_INSTALL_SOURCE="official"
    LAST_INSTALL_MIRROR_USED="false"
    write_install_provenance
    return 0
  fi

  if [ ${#mirror_env[@]} -eq 0 ]; then
    LAST_INSTALL_SOURCE="both-failed"
    LAST_INSTALL_MIRROR_USED="false"
    write_install_provenance
    return 1
  fi

  local pair key value rc=0
  local -a saved_keys_set=()
  local -a saved_values_set=()
  local -a saved_keys_unset=()
  for pair in "${mirror_env[@]}"; do
    key="${pair%%=*}"
    value="${pair#*=}"
    if [ -n "${!key+x}" ]; then
      saved_keys_set+=("$key")
      saved_values_set+=("${!key}")
    else
      saved_keys_unset+=("$key")
    fi
    export "$key=$value"
  done
  "$@" || rc=$?
  local i
  for ((i=0; i<${#saved_keys_set[@]}; i++)); do
    export "${saved_keys_set[$i]}=${saved_values_set[$i]}"
  done
  for key in "${saved_keys_unset[@]}"; do
    unset "$key"
  done

  if [ "$rc" -eq 0 ]; then
    LAST_INSTALL_SOURCE="mirror"
    LAST_INSTALL_MIRROR_USED="true"
    write_install_provenance
    return 0
  fi

  LAST_INSTALL_SOURCE="both-failed"
  LAST_INSTALL_MIRROR_USED="true"
  write_install_provenance
  return 1
}

npm_mirror_env_pairs() {
  printf '%s\n' "npm_config_registry=${NPM_MIRROR_ENDPOINT}" "NPM_CONFIG_REGISTRY=${NPM_MIRROR_ENDPOINT}"
}

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
import os
import signal
import subprocess
import sys
import time

timeout = float(sys.argv[1])
args = sys.argv[2:]

def terminate_process_tree(process):
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except Exception:
        try:
            process.terminate()
        except Exception:
            return
    deadline = time.time() + 5
    while time.time() < deadline:
        if process.poll() is not None:
            return
        time.sleep(0.1)
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except Exception:
        try:
            process.kill()
        except Exception:
            pass

try:
    process = subprocess.Popen(
        args,
        stdin=subprocess.DEVNULL,
        start_new_session=True,
    )
    try:
        exit_code = process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        terminate_process_tree(process)
        sys.exit(124)
except subprocess.TimeoutExpired:
    sys.exit(124)
except FileNotFoundError as exc:
    sys.stderr.write(f"{exc}\n")
    sys.exit(127)
except Exception as exc:
    sys.stderr.write(f"{exc}\n")
    sys.exit(1)

sys.exit(exit_code)
PY
}

GLOBAL_AGENT_BROWSER_SKILL="$HOME/.agents/skills/agent-browser/SKILL.md"
GLOBAL_AST_GREP_SKILL="$HOME/.agents/skills/ast-grep/SKILL.md"
AGENT_BROWSER_INSTALL_MARKER="$HOME/.agent-browser/spec-first-install.json"
HELPER_JSON='{}'
PARALLEL_TASK_PIDS=()
PARALLEL_TASK_LABELS=()
AGENT_BROWSER_BROWSER_INSTALL_EXIT_CODE=""
AGENT_BROWSER_SKILL_INSTALL_EXIT_CODE=""
AST_GREP_SKILL_INSTALL_EXIT_CODE=""

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

run_npm_global_install_attempt() {
  local npm_env=()
  if [ -n "${NPM_CONFIG_REGISTRY:-}" ]; then
    npm_env+=("NPM_CONFIG_REGISTRY=$NPM_CONFIG_REGISTRY")
  fi
  if [ -n "${npm_config_registry:-}" ]; then
    npm_env+=("npm_config_registry=$npm_config_registry")
  fi
  if [ -n "${HTTPS_PROXY:-}" ]; then
    npm_env+=("HTTPS_PROXY=$HTTPS_PROXY")
  fi
  if [ -n "${https_proxy:-}" ]; then
    npm_env+=("https_proxy=$https_proxy")
  fi
  if [ -n "${HTTP_PROXY:-}" ]; then
    npm_env+=("HTTP_PROXY=$HTTP_PROXY")
  fi
  if [ -n "${http_proxy:-}" ]; then
    npm_env+=("http_proxy=$http_proxy")
  fi
  if [ -n "${NO_PROXY:-}" ]; then
    npm_env+=("NO_PROXY=$NO_PROXY")
  fi
  if [ -n "${no_proxy:-}" ]; then
    npm_env+=("no_proxy=$no_proxy")
  fi

  if CI=true npm install -g "$@" --no-audit --no-fund --loglevel=error --fetch-timeout=30000 --fetch-retries=1; then
    return 0
  fi
  command -v sudo >/dev/null 2>&1 || return 1
  sudo -n env CI=true "${npm_env[@]}" npm install -g "$@" --no-audit --no-fund --loglevel=error --fetch-timeout=30000 --fetch-retries=1
}

run_npm_global_install_with_optional_sudo() {
  local mirror_pairs=()
  while IFS= read -r pair; do
    mirror_pairs+=("$pair")
  done < <(npm_mirror_env_pairs)
  run_with_mirror_fallback "${mirror_pairs[@]}" -- run_npm_global_install_attempt "$@"
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
      if [ "$os" = "linux" ]; then
        echo "CI=true npm install -g agent-browser@latest --no-audit --no-fund --loglevel=error && agent-browser install --with-deps && npx -y skills@latest add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y"
      else
        echo "CI=true npm install -g agent-browser@latest --no-audit --no-fund --loglevel=error && agent-browser install && npx -y skills@latest add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y"
      fi
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
      local mirror_pairs=()
      while IFS= read -r pair; do
        mirror_pairs+=("$pair")
      done < <(npm_mirror_env_pairs)
      run_with_mirror_fallback "${mirror_pairs[@]}" -- npx -y skills@latest add ast-grep/agent-skill -g -y
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
export -f run_npm_global_install_attempt
export -f run_with_mirror_fallback
export -f reset_install_provenance
export -f write_install_provenance
export -f load_install_provenance
export -f npm_mirror_env_pairs
export -f run_install_command

add_helper_fact() {
  local id="$1"
  local type="$2"
  local dependency_status="$3"
  local install_status="$4"
  local skill_status="$5"
  local result="$6"
  local next_action="$7"
  local baseline_blocking="${8:-true}"
  local install_source="${9:-official}"
  local mirror_used="${10:-false}"
  local browser_capability_demand_signals="${11:-[]}"
  local profile required safety_result reason_code

  profile="$(helper_registry_profile "$id" 2>/dev/null || echo "minimal")"
  required="$(jq -r --arg id "$id" '.helpers[] | select(.id == $id) | .required // true' "$(helper_registry_path)" 2>/dev/null || echo "true")"
  safety_result="$(helper_registry_safety_result "$id" 2>/dev/null || echo "unknown")"
  case "$result" in
    ready) reason_code="ready" ;;
    skipped) reason_code="optional-skipped" ;;
    degraded) reason_code="optional-capability-degraded" ;;
    action-required) reason_code="required-runtime-action-required" ;;
    *) reason_code="unknown" ;;
  esac

  HELPER_JSON="$(jq \
    --arg id "$id" \
    --arg type "$type" \
    --arg dependency_status "$dependency_status" \
    --arg install_status "$install_status" \
    --arg skill_status "$skill_status" \
    --arg result "$result" \
    --arg next_action "$next_action" \
    --argjson baseline_blocking "$baseline_blocking" \
    --arg profile "$profile" \
    --argjson required_json "$required" \
    --arg safety_result "$safety_result" \
    --arg reason_code "$reason_code" \
    --arg install_source "$install_source" \
    --argjson mirror_used "$mirror_used" \
    --argjson browser_capability_demand_signals "$browser_capability_demand_signals" \
    '. + {($id): {
      required: $required_json,
      baseline_blocking: $baseline_blocking,
      profile: $profile,
      kind: $type,
      type: $type,
      dependency_status: $dependency_status,
      configured_status: "not-applicable",
      host_config_status: "not-applicable",
      allowed: "not-applicable",
      install_status: $install_status,
      safety: $safety_result,
      skill_status: $skill_status,
      project_status: "not-applicable",
      result: $result,
      reason_code: $reason_code,
      next_action: $next_action,
      install_source: $install_source,
      mirror_used: $mirror_used,
      browser_capability_demand_signals: $browser_capability_demand_signals
    }}' <<<"$HELPER_JSON")"
}

write_agent_browser_install_marker() {
  local install_command="$1"
  local marker_dir
  marker_dir="$(dirname "$AGENT_BROWSER_INSTALL_MARKER")"
  mkdir -p "$marker_dir"
  local tmp
  tmp="$(mktemp "${marker_dir}/spec-first-install.XXXXXX")"
  chmod 600 "$tmp"
  jq -n \
    --arg installed_at "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
    --arg install_command "$install_command" \
    --arg source "spec-mcp-setup" \
    '{schema_version:"agent-browser-install.v1",installed_by:$source,installed_at:$installed_at,install_command:$install_command}' > "$tmp"
  mv "$tmp" "$AGENT_BROWSER_INSTALL_MARKER"
}

global_skill_installed() {
  local skill_name="$1"
  [ -f "$HOME/.agents/skills/$skill_name/SKILL.md" ] || [ -f "$HOME/.claude/skills/$skill_name/SKILL.md" ] || [ -f "$HOME/.codex/skills/$skill_name/SKILL.md" ]
}

browser_helper_required() {
  case "${SPEC_FIRST_BROWSER_HELPER_REQUIRED:-}" in
    1|true|TRUE|True|yes|YES|Yes) return 0 ;;
    *) return 1 ;;
  esac
}

collect_browser_demand_signals_json() {
  local -a signals=()
  if [ -f package.json ]; then
    local package_signals
    package_signals="$(jq -r '
      def deps: ((.dependencies // {}) + (.devDependencies // {}) + (.optionalDependencies // {}));
      [
        (deps | keys[]? | select(test("(@playwright/test|playwright|cypress|puppeteer|storybook|@storybook/)")) | "package.json:dependency:" + .),
        (.scripts // {} | to_entries[]? | select((.key + " " + (.value|tostring)) | test("playwright|cypress|puppeteer|storybook|vite|next|nuxt|astro|remix|svelte-kit|sveltekit")) | "package.json:scripts." + .key)
      ][]' package.json 2>/dev/null || true)"
    if [ -n "$package_signals" ]; then
      while IFS= read -r signal; do
        [ -n "$signal" ] && signals+=("$signal")
      done <<<"$package_signals"
    fi
  fi

  local file
  for file in next.config.js next.config.mjs vite.config.js vite.config.ts nuxt.config.js nuxt.config.ts astro.config.mjs remix.config.js svelte.config.js config/routes.rb manage.py mix.exs artisan storybook.config.js .storybook/main.js .storybook/main.ts; do
    [ -e "$file" ] && signals+=("config-file:$file")
  done

  local dir
  for dir in src/app pages app/views templates public storybook .storybook; do
    if [ -d "$dir" ] && find "$dir" -mindepth 1 -maxdepth 1 2>/dev/null | read -r _; then
      signals+=("dir:$dir")
    fi
  done

  if [ "${#signals[@]}" -eq 0 ]; then
    printf '[]'
    return
  fi

  printf '%s\n' "${signals[@]}" | sort -u | jq -R -s 'split("\n") | map(select(length > 0))'
}

queue_parallel_task() {
  local label="$1"
  shift
  stage_log "$label" "start (parallel)"
  (
    "$@" >/dev/null 2>&1
  ) &
  PARALLEL_TASK_PIDS+=("$!")
  PARALLEL_TASK_LABELS+=("$label")
}

wait_for_parallel_tasks() {
  local index
  local pid
  local label
  local exit_code

  for index in "${!PARALLEL_TASK_PIDS[@]}"; do
    pid="${PARALLEL_TASK_PIDS[$index]}"
    label="${PARALLEL_TASK_LABELS[$index]}"
    if wait "$pid"; then
      exit_code=0
    else
      exit_code="$?"
    fi

    case "$label" in
      agent-browser-browser-install)
        AGENT_BROWSER_BROWSER_INSTALL_EXIT_CODE="$exit_code"
        ;;
      agent-browser-skill-install)
        AGENT_BROWSER_SKILL_INSTALL_EXIT_CODE="$exit_code"
        ;;
      ast-grep-skill-install)
        AST_GREP_SKILL_INSTALL_EXIT_CODE="$exit_code"
        ;;
    esac

    if [ "$exit_code" -eq 124 ]; then
      stage_log "$label" "timed out after ${DEFAULT_STAGE_TIMEOUT_SECONDS}s"
    else
      stage_log "$label" "done (exit $exit_code)"
    fi
  done

  PARALLEL_TASK_PIDS=()
  PARALLEL_TASK_LABELS=()
}

process_cli_helper() {
  local name="$1"
  local os="$2"
  local baseline_blocking="${3:-true}"
  local status="ready"
  local dependency_status="ready"
  local install_status="ready"
  local next_action=""
  local install_command
  local install_source="official"
  local mirror_used="false"

  if ! command -v "$name" >/dev/null 2>&1; then
    dependency_status="missing"
    install_status="action-required"
    install_command="$(install_command_for "$name" "$os")"
    if [ "$name" = "ast-grep" ] && command -v rg >/dev/null 2>&1 && [ "$MODE" != "install" ]; then
      status="degraded"
      next_action="ast-grep missing; falling back to rg. Install via: ${install_command:-install ast-grep manually}"
      add_helper_fact "$name" "helper" "$dependency_status" "$install_status" "not-applicable" "$status" "$next_action" "false" "$install_source" "$mirror_used"
      return
    fi
    if [ "$MODE" = "install" ]; then
      local provenance_file
      local install_succeeded="false"
      provenance_file="$(mktemp 2>/dev/null || echo /tmp/spec-first-helper-prov.$$)"
      : >"$provenance_file" 2>/dev/null || true
      reset_install_provenance
      if LAST_INSTALL_PROVENANCE_FILE="$provenance_file" run_install_command_with_timeout "$name" "$os" "install:$name"; then
        install_succeeded="true"
        load_install_provenance "$provenance_file"
      fi
      rm -f "$provenance_file" 2>/dev/null || true
      if [ "$install_succeeded" = "true" ] && command -v "$name" >/dev/null 2>&1; then
        dependency_status="ready"
        install_status="ready"
        status="ready"
        next_action=""
        install_source="$LAST_INSTALL_SOURCE"
        mirror_used="$LAST_INSTALL_MIRROR_USED"
      else
        if [ "$baseline_blocking" = "false" ]; then
          status="degraded"
          next_action="optional helper for feature-video skill; install via: ${install_command:-install $name manually}"
        else
          status="action-required"
          next_action="${install_command:-install $name manually}"
        fi
      fi
    else
      if [ "$baseline_blocking" = "false" ]; then
        status="degraded"
        next_action="optional helper for feature-video skill; install via: ${install_command:-install $name manually}"
      else
        status="action-required"
        next_action="${install_command:-install $name manually}"
      fi
    fi
  fi

  add_helper_fact "$name" "helper" "$dependency_status" "$install_status" "not-applicable" "$status" "$next_action" "$baseline_blocking" "$install_source" "$mirror_used"
}

process_agent_browser() {
  local status="ready"
  local dependency_status="ready"
  local install_status="ready"
  local skill_status="ready"
  local next_action=""
  local baseline_blocking="false"
  local os="${OS:-$(detect_os)}"
  local agent_browser_install_command="agent-browser install"
  local agent_browser_install_args=(agent-browser install)
  local browser_install_queued="no"
  local skill_install_queued="no"
  local install_source="official"
  local mirror_used="false"
  local browser_required="no"
  local demand_signals_json
  demand_signals_json="$(collect_browser_demand_signals_json)"
  if browser_helper_required; then
    browser_required="yes"
  fi

  if [ "$os" = "linux" ]; then
    agent_browser_install_command="agent-browser install --with-deps"
    agent_browser_install_args=(agent-browser install --with-deps)
  fi

  if ! command -v agent-browser >/dev/null 2>&1; then
    dependency_status="missing"
    install_status="action-required"
    status="skipped"
    next_action="$BROWSER_HELPER_OPT_IN_ACTION"
  fi

  if ! global_skill_installed "agent-browser"; then
    skill_status="action-required"
    if [ "$browser_required" = "yes" ]; then
      status="degraded"
      if [ "$MODE" = "install" ]; then
        skill_install_queued="yes"
        queue_parallel_task "agent-browser-skill-install" run_with_timeout "$DEFAULT_STAGE_TIMEOUT_SECONDS" npx -y skills@latest add https://github.com/vercel-labs/agent-browser --skill agent-browser -g -y
      fi
    else
      status="skipped"
      next_action="$BROWSER_HELPER_OPT_IN_ACTION"
    fi
  fi

  if [ "$dependency_status" = "missing" ] && [ "$MODE" = "install" ] && [ "$browser_required" = "yes" ]; then
    stage_log "agent-browser" "installing CLI via npm"
    local npm_install_exit_code=0
    local provenance_file
    provenance_file="$(mktemp 2>/dev/null || echo /tmp/spec-first-ab-prov.$$)"
    : >"$provenance_file" 2>/dev/null || true
    if LAST_INSTALL_PROVENANCE_FILE="$provenance_file" run_with_timeout "$DEFAULT_STAGE_TIMEOUT_SECONDS" bash -c 'run_npm_global_install_with_optional_sudo agent-browser@latest' >/dev/null 2>&1; then
      npm_install_exit_code=0
    else
      npm_install_exit_code="$?"
    fi
    if [ -s "$provenance_file" ]; then
      while IFS='=' read -r key value; do
        case "$key" in
          install_source) install_source="$value" ;;
          mirror_used) mirror_used="$value" ;;
        esac
      done <"$provenance_file"
    fi
    rm -f "$provenance_file" 2>/dev/null || true
    if [ "$npm_install_exit_code" -eq 0 ] && command -v agent-browser >/dev/null 2>&1; then
      dependency_status="ready"
      install_status="ready"
      status="ready"
      next_action=""
      stage_log "agent-browser" "CLI install finished"
    else
      status="degraded"
      install_status="action-required"
      if [ "$npm_install_exit_code" -eq 124 ]; then
        next_action="agent-browser CLI install timed out after ${DEFAULT_STAGE_TIMEOUT_SECONDS}s"
        stage_log "agent-browser" "CLI install timed out after ${DEFAULT_STAGE_TIMEOUT_SECONDS}s"
      else
        next_action="agent-browser CLI not found after npm install"
        stage_log "agent-browser" "CLI install did not produce an executable"
      fi
    fi
  fi

  if [ "$dependency_status" = "ready" ] && [ ! -f "$AGENT_BROWSER_INSTALL_MARKER" ]; then
    install_status="action-required"
    if [ "$browser_required" = "yes" ]; then
      status="degraded"
      if [ "$MODE" = "verify-only" ]; then
        next_action="$BROWSER_HELPER_OPT_IN_ACTION"
      else
        next_action="run ${agent_browser_install_command} or set AGENT_BROWSER_EXECUTABLE_PATH to an existing Chrome/Chromium/Brave executable"
      fi
    else
      status="skipped"
      next_action="$BROWSER_HELPER_OPT_IN_ACTION"
    fi
  fi

  if [ "$MODE" = "verify-only" ] && [ "$dependency_status" = "ready" ] && [ "$skill_status" = "action-required" ]; then
    if [ "$browser_required" = "yes" ]; then
      status="degraded"
      next_action="$BROWSER_HELPER_OPT_IN_ACTION"
    else
      status="skipped"
      next_action="$BROWSER_HELPER_OPT_IN_ACTION"
    fi
  fi

  if [ "$MODE" = "install" ] && [ "$browser_required" = "yes" ] && [ "$dependency_status" = "ready" ] && [ ! -f "$AGENT_BROWSER_INSTALL_MARKER" ]; then
    install_status="action-required"
    status="degraded"
    browser_install_queued="yes"
    queue_parallel_task "agent-browser-browser-install" run_with_timeout "$DEFAULT_STAGE_TIMEOUT_SECONDS" "${agent_browser_install_args[@]}"
  fi

  AGENT_BROWSER_INSTALL_COMMAND="$agent_browser_install_command"
  AGENT_BROWSER_OS="$os"
  AGENT_BROWSER_DEPENDENCY_STATUS="$dependency_status"
  AGENT_BROWSER_INSTALL_STATUS="$install_status"
  AGENT_BROWSER_SKILL_STATUS="$skill_status"
  AGENT_BROWSER_RESULT="$status"
  AGENT_BROWSER_NEXT_ACTION="$next_action"
  AGENT_BROWSER_BASELINE_BLOCKING="$baseline_blocking"
  AGENT_BROWSER_BROWSER_INSTALL_QUEUED="$browser_install_queued"
  AGENT_BROWSER_SKILL_INSTALL_QUEUED="$skill_install_queued"
  AGENT_BROWSER_INSTALL_SOURCE="$install_source"
  AGENT_BROWSER_MIRROR_USED="$mirror_used"
  AGENT_BROWSER_DEMAND_SIGNALS_JSON="$demand_signals_json"

  if [ "$browser_install_queued" = "no" ] && [ "$skill_install_queued" = "no" ]; then
    add_helper_fact "agent-browser" "helper" "$dependency_status" "$install_status" "$skill_status" "$status" "$next_action" "$baseline_blocking" "$install_source" "$mirror_used" "$demand_signals_json"
  fi
}

finalize_agent_browser() {
  local os="$1"
  local dependency_status="$2"
  local install_status="$3"
  local skill_status="$4"
  local status="$5"
  local next_action="$6"
  local browser_install_queued="$7"
  local skill_install_queued="$8"
  local baseline_blocking="$9"
  local install_source="${10:-official}"
  local mirror_used="${11:-false}"
  local demand_signals_json="${12:-[]}"
  local browser_failed="no"
  local install_command="${AGENT_BROWSER_INSTALL_COMMAND:-agent-browser install}"

  if [ "$MODE" = "install" ]; then
    if [ "$dependency_status" != "ready" ] && command -v agent-browser >/dev/null 2>&1; then
      dependency_status="ready"
    fi

    if [ "$browser_install_queued" = "yes" ]; then
      if [ "${AGENT_BROWSER_BROWSER_INSTALL_EXIT_CODE:-1}" -eq 0 ] && command -v agent-browser >/dev/null 2>&1; then
        write_agent_browser_install_marker "$install_command"
        install_status="ready"
      else
        install_status="action-required"
        browser_failed="yes"
        status="degraded"
        baseline_blocking="false"
        next_action="agent-browser browser runtime install failed; browser automation may be unavailable. Rerun ${install_command} or set AGENT_BROWSER_EXECUTABLE_PATH to an existing Chrome/Chromium/Brave executable."
      fi
    fi

    if [ "$skill_install_queued" = "yes" ]; then
      if [ "${AGENT_BROWSER_SKILL_INSTALL_EXIT_CODE:-1}" -eq 0 ] && global_skill_installed "agent-browser"; then
        skill_status="ready"
      else
        skill_status="action-required"
        status="degraded"
        baseline_blocking="false"
        if [ "$browser_failed" != "yes" ] && [ "$dependency_status" = "ready" ]; then
          next_action="install global agent-browser skill manually"
        fi
      fi
    fi

    if [ "$dependency_status" = "ready" ] && [ "$install_status" = "ready" ] && [ "$skill_status" = "ready" ]; then
      status="ready"
      baseline_blocking="false"
      next_action=""
    fi
  fi

  add_helper_fact "agent-browser" "helper" "$dependency_status" "$install_status" "$skill_status" "$status" "$next_action" "$baseline_blocking" "$install_source" "$mirror_used" "$demand_signals_json"
}

process_global_skill() {
  local skill_name="$1"
  local helper_id="$2"
  local status="ready"
  local dependency_status="ready"
  local install_status="ready"
  local skill_status="ready"
  local next_action=""
  local install_queued="no"

  if ! global_skill_installed "$skill_name"; then
    dependency_status="missing"
    install_status="action-required"
    skill_status="action-required"
    status="action-required"
    next_action="$(install_command_for "${skill_name}-skill" "$(detect_os)")"
    if [ "$MODE" = "install" ]; then
      install_queued="yes"
      queue_parallel_task "ast-grep-skill-install" run_with_timeout "$DEFAULT_STAGE_TIMEOUT_SECONDS" npx -y skills@latest add ast-grep/agent-skill -g -y
    fi
  fi

  AST_GREP_SKILL_DEPENDENCY_STATUS="$dependency_status"
  AST_GREP_SKILL_INSTALL_STATUS="$install_status"
  AST_GREP_SKILL_SKILL_STATUS="$skill_status"
  AST_GREP_SKILL_RESULT="$status"
  AST_GREP_SKILL_NEXT_ACTION="$next_action"
  AST_GREP_SKILL_INSTALL_QUEUED="$install_queued"

  if [ "$install_queued" = "no" ]; then
    add_helper_fact "$helper_id" "global-skill" "$dependency_status" "$install_status" "$skill_status" "$status" "$next_action"
  fi
}

finalize_global_skill() {
  local helper_id="$1"
  local skill_name="$2"
  local status="${AST_GREP_SKILL_RESULT:-ready}"
  local dependency_status="${AST_GREP_SKILL_DEPENDENCY_STATUS:-ready}"
  local install_status="${AST_GREP_SKILL_INSTALL_STATUS:-ready}"
  local skill_status="${AST_GREP_SKILL_SKILL_STATUS:-ready}"
  local next_action="${AST_GREP_SKILL_NEXT_ACTION:-}"

  if [ "${AST_GREP_SKILL_INSTALL_QUEUED:-no}" = "yes" ]; then
    if [ "${AST_GREP_SKILL_INSTALL_EXIT_CODE:-1}" -eq 0 ] && global_skill_installed "$skill_name"; then
      dependency_status="ready"
      install_status="ready"
      skill_status="ready"
      status="ready"
      next_action=""
    else
      dependency_status="missing"
      install_status="action-required"
      skill_status="action-required"
      status="action-required"
      if [ "${AST_GREP_SKILL_INSTALL_EXIT_CODE:-1}" -eq 124 ]; then
        next_action="global ${skill_name}-skill install timed out after ${DEFAULT_STAGE_TIMEOUT_SECONDS}s"
      else
        next_action="${next_action:-install global $skill_name skill manually}"
      fi
    fi
  fi

  add_helper_fact "$helper_id" "global-skill" "$dependency_status" "$install_status" "$skill_status" "$status" "$next_action"
}

OS="$(detect_os)"
process_agent_browser
while IFS= read -r helper; do
  [ "$helper" != "agent-browser" ] || continue
  baseline_blocking="$(helper_registry_baseline_blocking "$helper")"
  process_cli_helper "$helper" "$OS" "$baseline_blocking"
done < <(helper_registry_cli_ids)
while IFS= read -r helper_id; do
  skill_name="$(helper_registry_skill_name "$helper_id")"
  [ -n "$skill_name" ] || continue
  process_global_skill "$skill_name" "$helper_id"
done
wait_for_parallel_tasks
finalize_agent_browser \
  "$AGENT_BROWSER_OS" \
  "$AGENT_BROWSER_DEPENDENCY_STATUS" \
  "$AGENT_BROWSER_INSTALL_STATUS" \
  "$AGENT_BROWSER_SKILL_STATUS" \
  "$AGENT_BROWSER_RESULT" \
  "$AGENT_BROWSER_NEXT_ACTION" \
  "$AGENT_BROWSER_BROWSER_INSTALL_QUEUED" \
  "$AGENT_BROWSER_SKILL_INSTALL_QUEUED" \
  "$AGENT_BROWSER_BASELINE_BLOCKING" \
  "${AGENT_BROWSER_INSTALL_SOURCE:-official}" \
  "${AGENT_BROWSER_MIRROR_USED:-false}" \
  "${AGENT_BROWSER_DEMAND_SIGNALS_JSON:-[]}"
finalize_global_skill "ast-grep-skill" "ast-grep"

jq -n \
  --argjson helper_tools "$HELPER_JSON" \
  --arg npm_mirror "$NPM_MIRROR_ENDPOINT" \
  --arg uv_mirror "$UV_MIRROR_ENDPOINT" \
  --arg chrome_mirror "$CHROME_MIRROR_ENDPOINT" \
  '{
    helper_tools: $helper_tools,
    mirror_endpoints: {
      npm: $npm_mirror,
      uv: $uv_mirror,
      chrome: $chrome_mirror
    },
    recommended_environment_variables: {
      npm: { npm_config_registry: $npm_mirror },
      uv: { UV_INDEX_URL: $uv_mirror }
    }
  }'
