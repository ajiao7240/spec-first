#!/bin/bash
# activate-serena.sh - Bootstrap current repo for Serena after host config is ready

set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo '错误：jq 是必需依赖，请先安装 jq' >&2; exit 1; }

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
TOOLS_JSON="$SKILL_DIR/mcp-tools.json"
PROJECT_DIR="$REPO_ROOT/.serena"
PROJECT_FILE="$PROJECT_DIR/project.yml"
READY_MARKER_FILE="$(jq -r '.tools[] | select(.id == "serena") | .project_bootstrap.ready_marker_file // ".serena/index-ready.json"' "$TOOLS_JSON")"
READY_MARKER_PATH="$REPO_ROOT/$READY_MARKER_FILE"
INDEX_COMMAND_JSON="$(jq -c '.tools[] | select(.id == "serena") | .project_bootstrap.index_command' "$TOOLS_JSON")"
INDEX_COMMAND="$(jq -r '.command' <<<"$INDEX_COMMAND_JSON")"

if [ -f "$PROJECT_FILE" ] && [ -f "$READY_MARKER_PATH" ]; then
  exit 0
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

if command -v "$INDEX_COMMAND" >/dev/null 2>&1; then
  index_args=()
  while IFS= read -r arg; do
    index_args+=("$arg")
  done <<EOF
$(jq -r '.args[]' <<<"$INDEX_COMMAND_JSON")
EOF
  if (cd "$REPO_ROOT" && "$INDEX_COMMAND" "${index_args[@]}") >/dev/null 2>&1; then
    mkdir -p "$(dirname "$READY_MARKER_PATH")"
    tmp_marker="$(mktemp "$(dirname "$READY_MARKER_PATH")/index-ready.XXXXXX")"
    chmod 600 "$tmp_marker"
    jq -n --arg project_root "$REPO_ROOT" --arg indexed_at "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" '{project_root:$project_root,index_status:"ready",indexed_at:$indexed_at}' > "$tmp_marker"
    mv "$tmp_marker" "$READY_MARKER_PATH"
    if [ -f "$PROJECT_FILE" ] && [ -f "$READY_MARKER_PATH" ]; then
      exit 0
    fi
  fi
fi

restore_existing_state
exit 1
