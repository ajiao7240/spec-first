#!/bin/bash
#
# Create a new git worktree with optional environment files and dev-tool trust.
#
# The distinctive work this script does (vs. raw `git worktree add`):
#   1. Optionally copies .env* files from the main repo with --copy-env
#   2. Trusts mise/direnv configs with branch-aware safety rules,
#      so hooks and scripts don't block on interactive trust prompts
#   3. Ensures .worktrees is gitignored (via `git check-ignore`)
#
# List / remove / switch operations are NOT provided here. Use git directly:
#   git worktree list
#   git worktree remove <path>
#   cd <worktree-path>   # switching is just `cd`

set -euo pipefail

# Resolve the main worktree's working tree, not the current worktree's toplevel.
# `git worktree list --porcelain` always emits the main worktree first. This
# handles normal repos, linked worktrees (where --show-toplevel would return
# the nested worktree), submodules (where --git-common-dir points under
# .git/modules), and --separate-git-dir setups (where --git-common-dir points
# to an external path). Parse with `sed` to preserve paths containing spaces
# (awk '{print $2}' would truncate them).
GIT_ROOT=$(git worktree list --porcelain | sed -n 's/^worktree //p' | head -n 1)
WORKTREE_DIR="$GIT_ROOT/.worktrees"

usage() {
  cat <<'EOF'
Usage: worktree-manager.sh create [--copy-env] <branch-name> [from-branch]

Creates .worktrees/<branch-name> with <branch-name> branched from
[from-branch] (default: origin's default branch, or main).

The main repo checkout is not modified; from-branch is fetched but
not checked out.

By default, .env* files are not copied. Pass --copy-env to opt in.
EOF
}

# Ensure .worktrees is ignored in the main repo. Runs `git check-ignore` from
# the main repo root so it sees the main repo's .gitignore (which is not
# inherited by linked worktrees). Falls back to a grep guard to avoid
# duplicate entries when check-ignore misses an uncommitted gitignore rule.
ensure_gitignore() {
  if (cd "$GIT_ROOT" && git check-ignore -q .worktrees) 2>/dev/null; then
    return
  fi
  if grep -Fxq ".worktrees" "$GIT_ROOT/.gitignore" 2>/dev/null; then
    return
  fi
  echo ".worktrees" >> "$GIT_ROOT/.gitignore"
  echo "Added .worktrees to .gitignore"
}

ensure_env_copy_log_excluded() {
  local worktree_path="$1"
  local exclude_file
  exclude_file=$(git -C "$worktree_path" rev-parse --git-path info/exclude)
  mkdir -p "$(dirname "$exclude_file")"
  if ! grep -Fxq ".env-copy.log" "$exclude_file" 2>/dev/null; then
    echo ".env-copy.log" >> "$exclude_file"
  fi
}

append_env_copy_log() {
  local worktree_path="$1" source="$2" dest="$3"
  local size sha8 timestamp log_file
  size=$(wc -c < "$source" | tr -d '[:space:]')
  if command -v shasum >/dev/null 2>&1; then
    sha8=$(shasum -a 256 "$source" | awk '{print substr($1, 1, 8)}')
  elif command -v sha256sum >/dev/null 2>&1; then
    sha8=$(sha256sum "$source" | awk '{print substr($1, 1, 8)}')
  else
    echo "Error: no SHA-256 tool found for env copy audit" >&2
    return 1
  fi
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  log_file="$worktree_path/.env-copy.log"
  printf 'timestamp=%s source_path=%s destination_path=%s size_bytes=%s sha256_8=%s\n' \
    "$timestamp" "$source" "$dest" "$size" "$sha8" >> "$log_file"
}

is_env_example_file() {
  case "$1" in
    .env.example|.env.template|.env.sample) return 0 ;;
    *) return 1 ;;
  esac
}

# Copy .env* files (except documented examples/templates) from main repo to
# worktree when the caller explicitly opts in. Backs up any pre-existing
# destination file.
copy_env_files() {
  local worktree_path="$1"
  local copied=0

  ensure_env_copy_log_excluded "$worktree_path"
  shopt -s nullglob

  local sources=()
  for source in "$GIT_ROOT"/.env*; do
    [[ -f "$source" ]] || continue
    local name
    name=$(basename "$source")
    is_env_example_file "$name" && continue
    sources+=("$source")
  done

  if [[ ${#sources[@]} -eq 0 ]]; then
    echo "  No .env files in main repo"
    shopt -u nullglob
    return
  fi

  echo "  Copying env files by explicit --copy-env opt-in:"
  for source in "${sources[@]}"; do
    local name
    name=$(basename "$source")
    echo "  - $name"
  done

  for source in "${sources[@]}"; do
    local name
    name=$(basename "$source")
    local dest="$worktree_path/$name"
    if [[ -f "$dest" ]]; then
      cp "$dest" "${dest}.backup"
      echo "  Backed up existing $name to ${name}.backup"
    fi
    cp "$source" "$dest"
    append_env_copy_log "$worktree_path" "$source" "$dest"
    echo "  Copied $name"
    copied=$((copied + 1))
  done
  shopt -u nullglob

  if [[ $copied -eq 0 ]]; then
    echo "  No .env files in main repo"
  fi
}

get_default_branch() {
  local head_ref
  head_ref=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null || true)
  if [[ -n "$head_ref" ]]; then
    echo "${head_ref#refs/remotes/origin/}"
  else
    echo "main"
  fi
}

# Auto-trust is only safe when the worktree is based on a long-lived branch
# the developer already controls. Review/PR branches fall back to the default
# branch baseline and require manual direnv approval.
is_trusted_base_branch() {
  local branch="$1"
  local default_branch="$2"
  [[ "$branch" == "$default_branch" ]] && return 0
  case "$branch" in
    develop|dev|trunk|staging|release/*) return 0 ;;
    *) return 1 ;;
  esac
}

# Return 0 if worktree's copy of $file has the same blob hash as $base_ref's.
# Symlinks are rejected (can't verify content).
config_unchanged() {
  local file="$1" base_ref="$2" worktree_path="$3"
  [[ -L "$worktree_path/$file" ]] && return 1
  local base_hash worktree_hash
  base_hash=$(git rev-parse "$base_ref:$file" 2>/dev/null) || return 1
  worktree_hash=$(git hash-object "$worktree_path/$file") || return 1
  [[ "$base_hash" == "$worktree_hash" ]]
}

# Trust dev tool configs (mise, direnv) so hooks/scripts don't block on
# interactive trust prompts. Auto-trusts only when the config matches the
# trusted baseline branch.
trust_dev_tools() {
  local worktree_path="$1" base_ref="$2" allow_direnv_auto="$3"
  local trusted=0
  local manual=()

  if command -v mise &>/dev/null; then
    for f in .mise.toml mise.toml .tool-versions; do
      [[ -f "$worktree_path/$f" ]] || continue
      if config_unchanged "$f" "$base_ref" "$worktree_path" \
         && (cd "$worktree_path" && mise trust "$f" --quiet); then
        trusted=$((trusted + 1))
      else
        manual+=("mise trust $f")
      fi
      break
    done
  fi

  if command -v direnv &>/dev/null && [[ -f "$worktree_path/.envrc" ]]; then
    if [[ "$allow_direnv_auto" == "true" ]] \
       && config_unchanged ".envrc" "$base_ref" "$worktree_path" \
       && (cd "$worktree_path" && direnv allow); then
      trusted=$((trusted + 1))
    else
      manual+=("direnv allow")
    fi
  fi

  [[ $trusted -gt 0 ]] && echo "  Trusted $trusted dev tool config(s)"
  if [[ ${#manual[@]} -gt 0 ]]; then
    echo "  Manual review required for: ${manual[*]}"
    echo "  Review the diff, then run from $worktree_path"
  fi
}

create_worktree() {
  local copy_env="false"
  if [[ "${1:-}" == "--copy-env" ]]; then
    copy_env="true"
    shift
  fi

  local branch_name="${1:-}"
  local from_branch="${2:-}"

  if [[ -z "$branch_name" ]]; then
    echo "Error: branch name required" >&2
    usage >&2
    exit 1
  fi

  local default_branch
  default_branch=$(get_default_branch)
  from_branch="${from_branch:-$default_branch}"

  local worktree_path="$WORKTREE_DIR/$branch_name"
  if [[ -d "$worktree_path" ]]; then
    echo "Error: worktree already exists at $worktree_path" >&2
    echo "Use 'cd $worktree_path' to switch, or 'git worktree remove' first." >&2
    exit 1
  fi

  echo "Creating worktree $branch_name from $from_branch"

  mkdir -p "$WORKTREE_DIR"
  ensure_gitignore

  # Fetch from-branch without touching the main checkout.
  if ! git fetch origin "$from_branch" --quiet; then
    echo "Warning: could not fetch origin/$from_branch; using local ref" >&2
  fi

  # Prefer origin/<from> if available, else fall back to local ref.
  local base_ref="origin/$from_branch"
  if ! git rev-parse --verify "$base_ref" &>/dev/null; then
    base_ref="$from_branch"
  fi

  git worktree add -b "$branch_name" "$worktree_path" "$base_ref"

  echo "Environment files:"
  if [[ "$copy_env" == "true" ]]; then
    copy_env_files "$worktree_path"
  else
    echo "  Not copied by default. Re-run create with --copy-env to opt in."
  fi

  echo "Dev tool trust:"
  local trust_branch="$default_branch"
  local allow_direnv_auto="false"
  if is_trusted_base_branch "$from_branch" "$default_branch"; then
    trust_branch="$from_branch"
    allow_direnv_auto="true"
  fi
  # Refresh the trust baseline before the hash-baseline check. Without this,
  # a stale origin/<default_branch> can cause auto-trust against an outdated
  # baseline when from_branch is untrusted (feature/review branches).
  if [[ "$trust_branch" != "$from_branch" ]]; then
    if ! git fetch origin "$trust_branch" --quiet; then
      echo "  Warning: could not fetch origin/$trust_branch; baseline may be stale" >&2
    fi
  fi
  local trust_ref="origin/$trust_branch"
  if git rev-parse --verify "$trust_ref" &>/dev/null; then
    trust_dev_tools "$worktree_path" "$trust_ref" "$allow_direnv_auto"
  else
    echo "  Skipped: $trust_ref not available locally"
  fi

  echo ""
  echo "Worktree ready: $worktree_path"
  echo "Switch with: cd $worktree_path"
}

main() {
  local command="${1:-}"
  shift || true
  case "$command" in
    create) create_worktree "$@" ;;
    ""|help|-h|--help) usage ;;
    *)
      echo "Error: unknown command '$command'" >&2
      usage >&2
      exit 1
      ;;
  esac
}

main "$@"
