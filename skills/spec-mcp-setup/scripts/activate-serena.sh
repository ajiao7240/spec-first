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

mkdir -p "$PROJECT_DIR"
rm -f "$READY_MARKER_PATH"
rm -f "$PROJECT_FILE"

if command -v uvx >/dev/null 2>&1; then
  create_args=(
    --from git+https://github.com/oraios/serena
    serena project create "$REPO_ROOT"
    --language typescript
    --language vue
    --language markdown
    --language yaml
    --language bash
    --index
  )
  if uvx "${create_args[@]}" >/dev/null 2>&1; then
    mkdir -p "$(dirname "$READY_MARKER_PATH")"
    jq -n --arg project_root "$REPO_ROOT" --arg indexed_at "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" '{project_root:$project_root,index_status:"ready",indexed_at:$indexed_at}' > "$READY_MARKER_PATH"
    exit 0
  fi
fi

exit 1
