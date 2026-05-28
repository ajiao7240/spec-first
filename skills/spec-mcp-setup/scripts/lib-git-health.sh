#!/bin/bash
# Shared Git health detection helpers for spec-mcp-setup scripts.

detect_git_health() {
  local target_dir="$1"
  local git_entry="$target_dir/.git"
  local first_line pointer raw_pointer pointer_path git_error

  GIT_HEALTH_STATUS="not-git"
  GIT_HEALTH_REASON_CODE="not-git"
  GIT_HEALTH_GIT_ENTRY_TYPE="missing"
  GIT_HEALTH_WORKTREE_POINTER_RAW=""
  GIT_HEALTH_WORKTREE_POINTER_PATH=""
  GIT_HEALTH_WORKTREE_POINTER_EXISTS=""

  if [ ! -e "$git_entry" ]; then
    if git -C "$target_dir" rev-parse --show-toplevel >/dev/null 2>&1; then
      GIT_HEALTH_STATUS="ok"
      GIT_HEALTH_REASON_CODE="git-ok"
      GIT_HEALTH_GIT_ENTRY_TYPE="ancestor"
    fi
    return 0
  fi

  if [ -f "$git_entry" ]; then
    GIT_HEALTH_GIT_ENTRY_TYPE="file"
    IFS= read -r first_line < "$git_entry" || first_line=""
    first_line="${first_line%$'\r'}"
    case "$first_line" in
      gitdir:*)
        raw_pointer="${first_line#gitdir:}"
        raw_pointer="${raw_pointer#"${raw_pointer%%[![:space:]]*}"}"
        GIT_HEALTH_WORKTREE_POINTER_RAW="$raw_pointer"
        case "$raw_pointer" in
          /*) pointer_path="$raw_pointer" ;;
          *) pointer_path="$target_dir/$raw_pointer" ;;
        esac
        if [ -e "$(dirname "$pointer_path")" ]; then
          pointer_path="$(cd "$(dirname "$pointer_path")" && pwd -P)/$(basename "$pointer_path")"
        fi
        GIT_HEALTH_WORKTREE_POINTER_PATH="$pointer_path"
        if [ -e "$pointer_path" ] && git -C "$target_dir" rev-parse --show-toplevel >/dev/null 2>&1; then
          GIT_HEALTH_STATUS="ok"
          GIT_HEALTH_REASON_CODE="git-ok"
          GIT_HEALTH_WORKTREE_POINTER_EXISTS="true"
        else
          GIT_HEALTH_STATUS="broken-worktree"
          if [ -e "$pointer_path" ]; then
            GIT_HEALTH_REASON_CODE="broken-worktree-pointer-invalid"
            GIT_HEALTH_WORKTREE_POINTER_EXISTS="true"
          else
            GIT_HEALTH_REASON_CODE="broken-worktree"
            GIT_HEALTH_WORKTREE_POINTER_EXISTS="false"
          fi
        fi
        ;;
      *)
        GIT_HEALTH_STATUS="corrupted-gitdir"
        GIT_HEALTH_REASON_CODE="gitdir-file-unparseable"
        ;;
    esac
    return 0
  fi

  if [ -d "$git_entry" ]; then
    GIT_HEALTH_GIT_ENTRY_TYPE="directory"
    if git -C "$target_dir" rev-parse --show-toplevel >/dev/null 2>&1; then
      GIT_HEALTH_STATUS="ok"
      GIT_HEALTH_REASON_CODE="git-ok"
    else
      GIT_HEALTH_STATUS="corrupted-gitdir"
      GIT_HEALTH_REASON_CODE="gitdir-directory-invalid"
    fi
    return 0
  fi

  GIT_HEALTH_GIT_ENTRY_TYPE="other"
  GIT_HEALTH_STATUS="corrupted-gitdir"
  GIT_HEALTH_REASON_CODE="gitdir-entry-invalid"
}
