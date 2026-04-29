#!/bin/bash
# activate-serena.sh - Bootstrap current repo for Serena after host config is ready

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
TOOLS_JSON="$SKILL_DIR/mcp-tools.json"

REFRESH=false
VERIFY_ONLY=false
REPO_ARG=""
LANGUAGES_TEXT=""
append_language_values() {
  local raw="$1"
  local language
  IFS=',' read -ra language_values <<< "$raw"
  for language in ${language_values[@]+"${language_values[@]}"}; do
    language="$(printf '%s' "$language" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    [ -n "$language" ] || continue
    LANGUAGES_TEXT="${LANGUAGES_TEXT}${language}"$'\n'
  done
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --refresh)
      REFRESH=true
      shift
      ;;
    --verify-only)
      VERIFY_ONLY=true
      shift
      ;;
    --repo)
      REPO_ARG="${2:-}"
      [ -n "$REPO_ARG" ] || { echo "activate-serena.sh: --repo requires a value" >&2; exit 1; }
      shift 2
      ;;
    --language)
      [ -n "${2:-}" ] || { echo "activate-serena.sh: --language requires a value" >&2; exit 1; }
      append_language_values "$2"
      shift 2
      ;;
    *)
      echo "activate-serena.sh: unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

TARGET_ARGS=()
if [ -n "$REPO_ARG" ]; then
  TARGET_ARGS+=(--repo "$REPO_ARG")
fi
set +e
TARGET_ENV="$(bash "$SCRIPT_DIR/resolve-project-target.sh" --format env ${TARGET_ARGS[@]+"${TARGET_ARGS[@]}"})"
TARGET_STATUS=$?
set -e
[ -n "$TARGET_ENV" ] || { echo "activate-serena.sh: target resolver returned no env output" >&2; exit 1; }
eval "$TARGET_ENV"
if [ "$TARGET_STATUS" -ne 0 ] || [ "$state_write_allowed" != "true" ]; then
  resolved_reason="${reason_code:-workspace-target-required}"
  resolved_next="${next_action:-Choose a child Git repo and rerun with --repo <child>.}"
  jq -n \
    --arg reason_code "$resolved_reason" \
    --arg next_action "$resolved_next" \
    --arg workspace_root "$workspace_root" \
    '{
      schema_version:"serena-project-bootstrap.v1",
      overall_status:"action-required",
      reason_code:$reason_code,
      workspace_root:$workspace_root,
      next_action:$next_action
    }'
  echo "activate-serena.sh: $resolved_reason. $resolved_next" >&2
  exit 1
fi

REPO_ROOT="$selected_repo_root"
PROJECT_DIR="$REPO_ROOT/.serena"
PROJECT_FILE="$PROJECT_DIR/project.yml"
READY_MARKER_FILE="$(jq -r '.tools[] | select(.id == "serena") | .project_bootstrap.ready_marker_file // ".serena/index-ready.json"' "$TOOLS_JSON")"
READY_MARKER_PATH="$REPO_ROOT/$READY_MARKER_FILE"
INDEX_COMMAND_JSON="$(jq -c '.tools[] | select(.id == "serena") | .project_bootstrap.index_command' "$TOOLS_JSON")"
INDEX_COMMAND="$(jq -r '.command' <<<"$INDEX_COMMAND_JSON")"

if [ "$VERIFY_ONLY" = "true" ]; then
  if [ -f "$PROJECT_FILE" ] && [ -f "$READY_MARKER_PATH" ]; then
    jq -n \
      --arg repo_root "$REPO_ROOT" \
      --arg project_file ".serena/project.yml" \
      --arg ready_marker "$READY_MARKER_FILE" \
      '{
        schema_version:"serena-project-bootstrap.v1",
        overall_status:"ready",
        reason_code:null,
        repo_root:$repo_root,
        project_file:$project_file,
        ready_marker:$ready_marker,
        next_action:""
      }'
  else
    jq -n \
      --arg repo_root "$REPO_ROOT" \
      --arg project_file ".serena/project.yml" \
      --arg ready_marker "$READY_MARKER_FILE" \
      '{
        schema_version:"serena-project-bootstrap.v1",
        overall_status:"action-required",
        reason_code:"serena-project-not-ready",
        repo_root:$repo_root,
        project_file:$project_file,
        ready_marker:$ready_marker,
        next_action:"Run spec-mcp-setup to activate Serena for the selected repo."
      }'
  fi
  exit 0
fi

read_project_languages() {
  local project_file="$1"
  [ -f "$project_file" ] || return 0
  awk '
    /^[[:space:]]*languages:[[:space:]]*$/ { in_languages=1; next }
    in_languages && /^[[:space:]]*-[[:space:]]*/ {
      line=$0
      sub(/^[[:space:]]*-[[:space:]]*/, "", line)
      sub(/[[:space:]]+#.*$/, "", line)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", line)
      gsub(/^["'"'"']|["'"'"']$/, "", line)
      if (line != "") print line
      next
    }
    in_languages && /^[^[:space:]]/ { exit }
  ' "$project_file"
}

if [ "$REFRESH" != "true" ] && [ -f "$PROJECT_FILE" ] && [ -f "$READY_MARKER_PATH" ]; then
  exit 0
fi

EFFECTIVE_LANGUAGES_TEXT="$LANGUAGES_TEXT"
if [ -z "$EFFECTIVE_LANGUAGES_TEXT" ] && [ -f "$PROJECT_FILE" ]; then
  EFFECTIVE_LANGUAGES_TEXT="$(read_project_languages "$PROJECT_FILE")"
fi

if [ -z "$EFFECTIVE_LANGUAGES_TEXT" ]; then
  if [ "$REFRESH" = "true" ]; then
    echo "activate-serena.sh: Serena refresh requires --language when no existing project languages are available." >&2
  else
    echo "activate-serena.sh: Serena first-time bootstrap requires --language for non-interactive setup." >&2
  fi
  echo "activate-serena.sh: Let the LLM inspect project evidence and pass supported Serena languages, for example: --language typescript or --language kotlin --language java." >&2
  exit 1
fi

mkdir -p "$PROJECT_DIR"

BACKUP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/spec-serena-bootstrap.XXXXXX")"
PROJECT_BACKUP=""
MARKER_BACKUP=""
trap 'rm -rf "$BACKUP_DIR"' EXIT

restore_existing_state() {
  if [ -n "$PROJECT_BACKUP" ] && [ -f "$PROJECT_BACKUP" ]; then
    mkdir -p "$(dirname "$PROJECT_FILE")"
    cp "$PROJECT_BACKUP" "$PROJECT_FILE"
  fi
  if [ -n "$MARKER_BACKUP" ] && [ -f "$MARKER_BACKUP" ]; then
    mkdir -p "$(dirname "$READY_MARKER_PATH")"
    cp "$MARKER_BACKUP" "$READY_MARKER_PATH"
  fi
}

if [ -f "$PROJECT_FILE" ]; then
  PROJECT_BACKUP="$BACKUP_DIR/project.yml"
  cp "$PROJECT_FILE" "$PROJECT_BACKUP"
fi
if [ -f "$READY_MARKER_PATH" ]; then
  MARKER_BACKUP="$BACKUP_DIR/index-ready.json"
  cp "$READY_MARKER_PATH" "$MARKER_BACKUP"
fi

rm -f "$READY_MARKER_PATH"
rm -f "$PROJECT_FILE"

build_index_args() {
  local languages_text="$1"
  while IFS= read -r arg; do
    index_args+=("$arg")
  done <<EOF
$(jq -r '.args[]' <<<"$INDEX_COMMAND_JSON")
EOF
  if ! jq -e '.args | index("--language")' <<<"$INDEX_COMMAND_JSON" >/dev/null 2>&1; then
    while IFS= read -r language; do
      [ -n "$language" ] || continue
      index_args+=("--language" "$language")
    done <<<"$languages_text"
  fi
}

language_count() {
  local count=0
  while IFS= read -r language; do
    [ -n "$language" ] || continue
    count=$((count + 1))
  done <<<"$1"
  printf '%s' "$count"
}

attempt_bootstrap() {
  local attempt_name="$1"
  local languages_text="$2"
  local command_log="$3"

  rm -f "$READY_MARKER_PATH"
  rm -f "$PROJECT_FILE"

  index_args=()
  build_index_args "$languages_text"
  printf 'attempt=%s\ncommand=%s %s\n' "$attempt_name" "$INDEX_COMMAND" "${index_args[*]}" >"$command_log"
  set +e
  (cd "$REPO_ROOT" && "$INDEX_COMMAND" "${index_args[@]}") >>"$command_log" 2>&1
  serena_exit=$?
  set -e
  return "$serena_exit"
}

write_ready_marker() {
  mkdir -p "$(dirname "$READY_MARKER_PATH")"
  tmp_marker="$(mktemp "$(dirname "$READY_MARKER_PATH")/index-ready.XXXXXX")"
  chmod 600 "$tmp_marker"
  jq -n --arg project_root "$REPO_ROOT" --arg indexed_at "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" '{project_root:$project_root,index_status:"ready",indexed_at:$indexed_at}' > "$tmp_marker"
  mv "$tmp_marker" "$READY_MARKER_PATH"
}

if command -v "$INDEX_COMMAND" >/dev/null 2>&1; then
  ATTEMPT_LOGS_TEXT=""
  attempt_log="$BACKUP_DIR/serena-bootstrap.full.log"
  if attempt_bootstrap "all-languages" "$EFFECTIVE_LANGUAGES_TEXT" "$attempt_log"; then
    write_ready_marker
    if [ -f "$PROJECT_FILE" ] && [ -f "$READY_MARKER_PATH" ]; then
      exit 0
    fi
  fi
  ATTEMPT_LOGS_TEXT="${ATTEMPT_LOGS_TEXT}${attempt_log}"$'\n'

  if [ "$(language_count "$EFFECTIVE_LANGUAGES_TEXT")" -gt 1 ]; then
    attempt_index=0
    while IFS= read -r language; do
      [ -n "$language" ] || continue
      attempt_index=$((attempt_index + 1))
      attempt_log="$BACKUP_DIR/serena-bootstrap.${attempt_index}.${language}.log"
      if attempt_bootstrap "single-language:$language" "$language" "$attempt_log"; then
        write_ready_marker
        if [ -f "$PROJECT_FILE" ] && [ -f "$READY_MARKER_PATH" ]; then
          exit 0
        fi
      fi
      ATTEMPT_LOGS_TEXT="${ATTEMPT_LOGS_TEXT}${attempt_log}"$'\n'
    done <<<"$EFFECTIVE_LANGUAGES_TEXT"
  fi

  echo "activate-serena.sh: Serena bootstrap failed for all language attempts." >&2
  while IFS= read -r attempt_log; do
    [ -n "$attempt_log" ] || continue
    [ -s "$attempt_log" ] || continue
    echo "activate-serena.sh: Serena output from $(basename "$attempt_log") (last 30 lines):" >&2
    tail -30 "$attempt_log" >&2
  done <<<"$ATTEMPT_LOGS_TEXT"
else
  echo "activate-serena.sh: command not found: $INDEX_COMMAND" >&2
fi

restore_existing_state
exit 1
