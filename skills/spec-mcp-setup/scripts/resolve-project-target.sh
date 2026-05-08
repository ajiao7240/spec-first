#!/bin/bash
# resolve-project-target.sh - Resolve the repo target for project-local spec-first state.

set -euo pipefail

REPO_ARG=""
OUTPUT_FORMAT="json"
SCAN_DEPTH=3

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO_ARG="${2:-}"
      [ -n "$REPO_ARG" ] || { echo "resolve-project-target.sh: --repo requires a value" >&2; exit 1; }
      shift 2
      ;;
    --format)
      OUTPUT_FORMAT="${2:-}"
      [ "$OUTPUT_FORMAT" = "json" ] || [ "$OUTPUT_FORMAT" = "env" ] || {
        echo "resolve-project-target.sh: --format must be json or env" >&2
        exit 1
      }
      shift 2
      ;;
    --scan-depth)
      SCAN_DEPTH="${2:-}"
      [[ "$SCAN_DEPTH" =~ ^[0-9]+$ ]] || { echo "resolve-project-target.sh: --scan-depth must be an integer" >&2; exit 1; }
      shift 2
      ;;
    *)
      echo "resolve-project-target.sh: unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

json_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  printf '%s' "$value"
}

env_quote() {
  # Wrap value in single quotes for safe `eval`. Most caller-supplied values come from
  # controlled sources (resolver-derived enums, fixed strings) without literal single quotes,
  # so the bash-builtin fast path avoids per-call `sed` forks. The slow path activates only
  # when the input actually contains a `'`, e.g. a repo path or git config value with an
  # apostrophe — there we need a real escape so install-mcp.sh `eval "$TARGET_ENV"` stays safe.
  case "$1" in
    *\'*)
      printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"
      ;;
    *)
      printf "'%s'" "$1"
      ;;
  esac
}

canonicalize_existing_path() {
  local path="$1"
  if command -v realpath >/dev/null 2>&1; then
    realpath "$path"
  elif command -v readlink >/dev/null 2>&1 && readlink -f "$path" >/dev/null 2>&1; then
    readlink -f "$path"
  else
    python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$path"
  fi
}

absolutize_maybe_missing() {
  local path="$1"
  case "$path" in
    /*) printf '%s\n' "$path" ;;
    *) printf '%s/%s\n' "$INVOCATION_CWD" "$path" ;;
  esac
}

path_is_within() {
  local child="$1"
  local parent="$2"
  [ "$child" = "$parent" ] && return 0
  case "$child" in
    "$parent"/*) return 0 ;;
    *) return 1 ;;
  esac
}

relative_to_workspace() {
  local path="$1"
  local root="$2"
  if [ "$path" = "$root" ]; then
    printf '.\n'
  elif path_is_within "$path" "$root"; then
    printf '%s\n' "${path#"$root"/}"
  else
    printf '%s\n' "$path"
  fi
}

INVOCATION_CWD="$(pwd -P)"
CWD_GIT_ROOT="$(git -C "$INVOCATION_CWD" rev-parse --show-toplevel 2>/dev/null || true)"
if [ -n "$CWD_GIT_ROOT" ]; then
  CWD_GIT_ROOT="$(canonicalize_existing_path "$CWD_GIT_ROOT")"
fi

mode=""
repo_status="not-git-repo"
selection_source=""
state_write_allowed="false"
workspace_root="$INVOCATION_CWD"
selected_repo_root=""
repo_label=""
reason_code=""
next_action=""
exit_code=0
candidate_roots=()
candidate_labels=()

add_candidate() {
  local root="$1"
  local existing
  for existing in ${candidate_roots[@]+"${candidate_roots[@]}"}; do
    [ "$root" = "$existing" ] && return 0
    if path_is_within "$root" "$existing"; then
      return 0
    fi
  done
  candidate_roots+=("$root")
}

discover_candidates() {
  local root="$1"
  local queue=()
  local current depth child name git_root canonical_root

  queue+=("0|$root")
  while [ "${#queue[@]}" -gt 0 ]; do
    current="${queue[0]}"
    queue=("${queue[@]:1}")
    depth="${current%%|*}"
    current="${current#*|}"

    while IFS= read -r child; do
      [ -n "$child" ] || continue
      name="$(basename "$child")"
      case "$name" in
        .git|node_modules|vendor|.claude|.codex|.agents|.spec-first|.cache|.direnv|.venv)
          continue
          ;;
      esac

      if [ -e "$child/.git" ]; then
        git_root="$(git -C "$child" rev-parse --show-toplevel 2>/dev/null || true)"
        [ -n "$git_root" ] || continue
        canonical_root="$(canonicalize_existing_path "$git_root")"
        path_is_within "$canonical_root" "$root" || continue
        add_candidate "$canonical_root"
        continue
      fi

      if [ "$depth" -lt "$SCAN_DEPTH" ]; then
        queue+=("$((depth + 1))|$child")
      fi
    done < <(find -P "$current" -mindepth 1 -maxdepth 1 -type d -print 2>/dev/null | sort)
  done

  local sorted candidate
  sorted="$(printf '%s\n' ${candidate_roots[@]+"${candidate_roots[@]}"} | sed '/^$/d' | sort)"
  candidate_roots=()
  while IFS= read -r candidate; do
    [ -n "$candidate" ] || continue
    candidate_roots+=("$candidate")
  done <<<"$sorted"
}

if [ -n "$REPO_ARG" ]; then
  raw_target="$(absolutize_maybe_missing "$REPO_ARG")"
  if [ ! -e "$raw_target" ]; then
    mode="invalid-target"
    reason_code="repo-target-not-found"
    next_action="Choose an existing child Git repo and rerun with --repo <path>."
    exit_code=1
  else
    canonical_target="$(canonicalize_existing_path "$raw_target")"
    if [ -n "$CWD_GIT_ROOT" ]; then
      workspace_root="$CWD_GIT_ROOT"
    else
      workspace_root="$INVOCATION_CWD"
    fi

    if ! path_is_within "$canonical_target" "$workspace_root"; then
      mode="invalid-target"
      reason_code="repo-target-outside-workspace"
      next_action="Choose a child Git repo inside the current workspace."
      exit_code=1
    else
      target_git_root="$(git -C "$canonical_target" rev-parse --show-toplevel 2>/dev/null || true)"
      if [ -z "$target_git_root" ]; then
        mode="invalid-target"
        reason_code="repo-target-not-git"
        next_action="Choose a path inside a child Git repo and rerun with --repo <path>."
        exit_code=1
      else
        selected_repo_root="$(canonicalize_existing_path "$target_git_root")"
        if ! path_is_within "$selected_repo_root" "$workspace_root"; then
          mode="invalid-target"
          reason_code="repo-target-outside-workspace"
          next_action="Choose a child Git repo inside the current workspace."
          exit_code=1
        elif [ -n "$CWD_GIT_ROOT" ] && [ "$selected_repo_root" != "$CWD_GIT_ROOT" ]; then
          mode="invalid-target"
          reason_code="repo-target-outside-workspace"
          next_action="Run from the target repo or invoke from its parent workspace."
          exit_code=1
        else
          mode="git-repo"
          repo_status="git-repo"
          selection_source="explicit-repo"
          state_write_allowed="true"
          repo_label="$(relative_to_workspace "$selected_repo_root" "$workspace_root")"
        fi
      fi
    fi
  fi
elif [ -n "$CWD_GIT_ROOT" ]; then
  mode="git-repo"
  repo_status="git-repo"
  selection_source="cwd-git-root"
  state_write_allowed="true"
  workspace_root="$CWD_GIT_ROOT"
  selected_repo_root="$CWD_GIT_ROOT"
  repo_label="$(basename "$CWD_GIT_ROOT")"
else
  discover_candidates "$workspace_root"
  if [ "${#candidate_roots[@]}" -eq 0 ]; then
    mode="workspace-no-git-candidates"
    reason_code="workspace-no-git-candidates"
    next_action="Run from a Git repo or pass --repo <child> after creating one."
  elif [ "${#candidate_roots[@]}" -eq 1 ]; then
    mode="workspace-single-candidate"
    reason_code="workspace-target-required"
    candidate_labels+=("$(relative_to_workspace "${candidate_roots[0]}" "$workspace_root")")
    next_action="Rerun with --repo ${candidate_labels[0]}."
  else
    mode="workspace-multi-repo"
    reason_code="workspace-target-required"
    for candidate in "${candidate_roots[@]}"; do
      candidate_labels+=("$(relative_to_workspace "$candidate" "$workspace_root")")
    done
    next_action="Choose a child Git repo and rerun with --repo <child>."
  fi
fi

emit_json() {
  local candidates_json="[]"
  local i item first="true"
  candidates_json="["
  for i in "${!candidate_roots[@]}"; do
    [ "$first" = "true" ] || candidates_json+=","
    first="false"
    item="$(printf '{"repo_label":"%s","git_root":"%s","workspace_relative_path":"%s","relationship":"child_git_repo"}' \
      "$(json_escape "${candidate_labels[$i]:-$(relative_to_workspace "${candidate_roots[$i]}" "$workspace_root")}")" \
      "$(json_escape "${candidate_roots[$i]}")" \
      "$(json_escape "$(relative_to_workspace "${candidate_roots[$i]}" "$workspace_root")")")"
    candidates_json+="$item"
  done
  candidates_json+="]"

  printf '{'
  printf '"schema_version":"project-target.v1",'
  printf '"mode":"%s",' "$(json_escape "$mode")"
  printf '"repo_status":"%s",' "$(json_escape "$repo_status")"
  printf '"selection_source":"%s",' "$(json_escape "$selection_source")"
  printf '"state_write_allowed":%s,' "$state_write_allowed"
  printf '"invocation_cwd":"%s",' "$(json_escape "$INVOCATION_CWD")"
  printf '"workspace_root":"%s",' "$(json_escape "$workspace_root")"
  if [ -n "$selected_repo_root" ]; then
    printf '"selected_repo_root":"%s",' "$(json_escape "$selected_repo_root")"
  else
    printf '"selected_repo_root":null,'
  fi
  printf '"repo_label":"%s",' "$(json_escape "$repo_label")"
  printf '"candidates":%s,' "$candidates_json"
  printf '"reason_code":"%s",' "$(json_escape "$reason_code")"
  printf '"next_action":"%s"' "$(json_escape "$next_action")"
  printf '}\n'
}

emit_env() {
  printf 'schema_version=%s\n' "$(env_quote "project-target.v1")"
  printf 'mode=%s\n' "$(env_quote "$mode")"
  printf 'repo_status=%s\n' "$(env_quote "$repo_status")"
  printf 'selection_source=%s\n' "$(env_quote "$selection_source")"
  printf 'state_write_allowed=%s\n' "$(env_quote "$state_write_allowed")"
  printf 'invocation_cwd=%s\n' "$(env_quote "$INVOCATION_CWD")"
  printf 'workspace_root=%s\n' "$(env_quote "$workspace_root")"
  printf 'selected_repo_root=%s\n' "$(env_quote "$selected_repo_root")"
  printf 'repo_label=%s\n' "$(env_quote "$repo_label")"
  printf 'reason_code=%s\n' "$(env_quote "$reason_code")"
  printf 'next_action=%s\n' "$(env_quote "$next_action")"
}

if [ "$OUTPUT_FORMAT" = "env" ]; then
  emit_env
else
  emit_json
fi

exit "$exit_code"
