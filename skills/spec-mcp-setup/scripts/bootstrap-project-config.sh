#!/bin/bash
# bootstrap-project-config.sh - Apply explicit project-local setup actions.

set -euo pipefail

REFRESH_EXAMPLE="no"
CREATE_LOCAL="no"
ENSURE_GITIGNORE="no"
DELETE_LEGACY_MARKDOWN="no"
JSON_OUTPUT="no"
REPO_ARG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --refresh-example)
      REFRESH_EXAMPLE="yes"
      shift
      ;;
    --create-local)
      CREATE_LOCAL="yes"
      shift
      ;;
    --ensure-gitignore)
      ENSURE_GITIGNORE="yes"
      shift
      ;;
    --delete-legacy-markdown)
      DELETE_LEGACY_MARKDOWN="yes"
      shift
      ;;
    --json)
      JSON_OUTPUT="yes"
      shift
      ;;
    --repo)
      REPO_ARG="${2:-}"
      [ -n "$REPO_ARG" ] || { echo "bootstrap-project-config.sh: --repo requires a value" >&2; exit 1; }
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

json_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  printf '%s' "$value"
}

emit_json() {
  local overall_status="$1"
  local reason="$2"
  local repo_root="$3"
  local example_status="$4"
  local local_status="$5"
  local gitignore_status="$6"
  local legacy_markdown_status="$7"
  local legacy_config_status="$8"

  printf '{'
  printf '"schema_version":"project-config-bootstrap.v1",'
  printf '"overall_status":"%s",' "$(json_escape "$overall_status")"
  printf '"reason":"%s",' "$(json_escape "$reason")"
  printf '"repo_root":"%s",' "$(json_escape "$repo_root")"
  printf '"project":{"example_config_status":"%s","local_config_status":"%s","local_config_gitignore_status":"%s"},' \
    "$(json_escape "$example_status")" \
    "$(json_escape "$local_status")" \
    "$(json_escape "$gitignore_status")"
  printf '"legacy":{"compound_engineering_markdown_status":"%s","compound_engineering_config_status":"%s"}' \
    "$(json_escape "$legacy_markdown_status")" \
    "$(json_escape "$legacy_config_status")"
  printf '}\n'
}

TARGET_ARGS=()
if [ -n "$REPO_ARG" ]; then
  TARGET_ARGS+=(--repo "$REPO_ARG")
fi
set +e
TARGET_ENV="$(bash "$SCRIPT_DIR/resolve-project-target.sh" --format env ${TARGET_ARGS[@]+"${TARGET_ARGS[@]}"})"
TARGET_STATUS=$?
set -e
[ -n "$TARGET_ENV" ] || { echo "bootstrap-project-config.sh: target resolver returned no env output" >&2; exit 1; }
eval "$TARGET_ENV"
if [ "$TARGET_STATUS" -ne 0 ] || [ "$state_write_allowed" != "true" ]; then
  resolved_reason="${reason_code:-workspace-target-required}"
  if [ "$JSON_OUTPUT" = "yes" ]; then
    emit_json "action-required" "$resolved_reason" "" "not-applicable" "not-applicable" "not-applicable" "not-applicable" "not-applicable"
  else
    echo "${next_action:-Project config bootstrap requires a selected git repo.}"
  fi
  exit 0
fi

REPO_ROOT="$selected_repo_root"
TEMPLATE="$SCRIPT_DIR/../references/config-template.yaml"
SPEC_DIR="$REPO_ROOT/.spec-first"
EXAMPLE_CONFIG="$SPEC_DIR/config.local.example.yaml"
LOCAL_CONFIG="$SPEC_DIR/config.local.yaml"
GITIGNORE="$REPO_ROOT/.gitignore"
LEGACY_MARKDOWN="$REPO_ROOT/compound-engineering.local.md"
LEGACY_CONFIG="$REPO_ROOT/.compound-engineering/config.local.yaml"

[ -f "$TEMPLATE" ] || {
  if [ "$JSON_OUTPUT" = "yes" ]; then
    emit_json "action-required" "missing-template" "$REPO_ROOT" "missing-template" "skipped" "skipped" "skipped" "skipped"
  else
    echo "Missing template: $TEMPLATE" >&2
  fi
  exit 1
}

example_status="skipped"
local_status="skipped"
gitignore_status="skipped"
legacy_markdown_status="missing"
legacy_config_status="missing"

if [ -f "$LEGACY_MARKDOWN" ]; then
  legacy_markdown_status="present"
fi
if [ -f "$LEGACY_CONFIG" ]; then
  legacy_config_status="present"
fi

if [ "$REFRESH_EXAMPLE" = "yes" ]; then
  mkdir -p "$SPEC_DIR"
  cp "$TEMPLATE" "$EXAMPLE_CONFIG"
  example_status="refreshed"
fi

if [ "$CREATE_LOCAL" = "yes" ]; then
  mkdir -p "$SPEC_DIR"
  if [ -f "$LOCAL_CONFIG" ]; then
    local_status="already-exists"
  else
    cp "$TEMPLATE" "$LOCAL_CONFIG"
    local_status="created"
  fi
fi

if [ "$ENSURE_GITIGNORE" = "yes" ]; then
  if git check-ignore -q "$LOCAL_CONFIG" 2>/dev/null; then
    gitignore_status="already-ignored"
  else
    touch "$GITIGNORE"
    if grep -Fxq '.spec-first/*.local.yaml' "$GITIGNORE"; then
      gitignore_status="already-present"
    else
      if [ -s "$GITIGNORE" ] && [ "$(tail -c 1 "$GITIGNORE" | wc -l | tr -d ' ')" = "0" ]; then
        printf '\n' >>"$GITIGNORE"
      fi
      printf '.spec-first/*.local.yaml\n' >>"$GITIGNORE"
      gitignore_status="added"
    fi
  fi
fi

if [ "$DELETE_LEGACY_MARKDOWN" = "yes" ]; then
  if [ -f "$LEGACY_MARKDOWN" ]; then
    rm "$LEGACY_MARKDOWN"
    legacy_markdown_status="deleted"
  else
    legacy_markdown_status="missing"
  fi
fi

if [ "$JSON_OUTPUT" = "yes" ]; then
  emit_json "ready" "" "$REPO_ROOT" "$example_status" "$local_status" "$gitignore_status" "$legacy_markdown_status" "$legacy_config_status"
else
  echo "Project config bootstrap complete."
  echo "  example_config: $example_status"
  echo "  local_config: $local_status"
  echo "  local_config_gitignore: $gitignore_status"
  echo "  legacy_markdown: $legacy_markdown_status"
  echo "  legacy_config: $legacy_config_status"
fi
