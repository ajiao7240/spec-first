#!/bin/bash

# Experiment Worktree Manager
# Creates, cleans up, and manages worktrees for optimization experiments.
# Each experiment gets an isolated worktree with copied shared resources.
#
# Usage:
#   experiment-worktree.sh create [--copy-env] <spec_name> <exp_index> <base_branch> [shared_file ...]
#   experiment-worktree.sh cleanup <spec_name> <exp_index>
#   experiment-worktree.sh cleanup-all <spec_name>
#   experiment-worktree.sh count
#
# Worktrees are created at: .worktrees/optimize-<spec>-exp-<NNN>/
# Branches are named: optimize-exp/<spec>/exp-<NNN>

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo -e "${RED}Error: Not in a git repository${NC}" >&2
  exit 1
}

WORKTREE_DIR="$GIT_ROOT/.worktrees"

experiment_branch_name() {
  local spec_name="${1:?Error: spec_name required}"
  local padded_index="${2:?Error: padded_index required}"

  # Keep experiment refs outside optimize/<spec> so they do not collide
  # with the long-lived optimization branch namespace.
  echo "optimize-exp/${spec_name}/exp-${padded_index}"
}

ensure_worktree_exclude() {
  local exclude_file
  exclude_file=$(git rev-parse --git-path info/exclude)

  mkdir -p "$(dirname "$exclude_file")"

  if ! grep -q "^\.worktrees$" "$exclude_file" 2>/dev/null; then
    echo ".worktrees" >> "$exclude_file"
  fi
}

is_registered_worktree() {
  local worktree_path="${1:?Error: worktree_path required}"

  git worktree list --porcelain | awk -v target="$worktree_path" '
    $1 == "worktree" && $2 == target { found = 1 }
    END { exit(found ? 0 : 1) }
  '
}

is_branch_checked_out() {
  local branch_name="${1:?Error: branch_name required}"
  local branch_ref="refs/heads/$branch_name"

  git worktree list --porcelain | awk -v target="$branch_ref" '
    $1 == "branch" && $2 == target { found = 1 }
    END { exit(found ? 0 : 1) }
  '
}

reset_worktree_to_base() {
  local worktree_path="${1:?Error: worktree_path required}"
  local branch_name="${2:?Error: branch_name required}"
  local base_branch="${3:?Error: base_branch required}"
  local current_branch

  current_branch=$(git -C "$worktree_path" symbolic-ref --quiet --short HEAD 2>/dev/null || true)
  if [[ "$current_branch" != "$branch_name" ]]; then
    echo -e "${RED}Error: Existing worktree is on unexpected branch: ${current_branch:-detached} (expected $branch_name)${NC}" >&2
    echo -e "${RED}Clean up the stale worktree before rerunning this experiment.${NC}" >&2
    return 1
  fi

  echo -e "${YELLOW}Resetting existing experiment worktree to base: $branch_name -> $base_branch${NC}" >&2
  git -C "$worktree_path" reset --hard "$base_branch" >/dev/null
  git -C "$worktree_path" clean -fdx >/dev/null
}

realpath_existing() {
  local path="${1:?Error: path required}"
  node -e 'const fs = require("fs"); console.log(fs.realpathSync(process.argv[1]));' "$path"
}

realpath_for_new_path() {
  local path="${1:?Error: path required}"
  node -e 'const fs = require("fs"); const path = require("path"); const target = process.argv[1]; const dir = fs.realpathSync(path.dirname(target)); console.log(path.join(dir, path.basename(target)));' "$path"
}

path_within() {
  local path="${1:?Error: path required}"
  local root="${2:?Error: root required}"
  [[ "$path" == "$root" || "$path" == "$root"/* ]]
}

is_exact_repo_relative_path() {
  local path="${1:-}"
  [[ -n "$path" ]] || return 1
  [[ "$path" != "." && "$path" != ./* && "$path" != */. && "$path" != */./* ]] || return 1
  [[ "$path" != /* && "$path" != ~* && "$path" != *\\* && "$path" != *//* ]] || return 1
  case "$path" in
    ..|../*|*/..|*/../*|*'*'*|*'?'*|*'['*|*']'*|*'{'*|*'}'*) return 1 ;;
  esac
  return 0
}

is_env_example_file() {
  case "$1" in
    .env.example|.env.template|.env.sample|*/.env.example|*/.env.template|*/.env.sample) return 0 ;;
    *) return 1 ;;
  esac
}

is_secret_denied_path() {
  local path="${1#./}"
  local lower_path
  is_env_example_file "$path" && return 1
  lower_path=$(printf '%s' "$path" | tr '[:upper:]' '[:lower:]')

  case "$lower_path" in
    .env|.env.*|*/.env|*/.env.*|*.pem|*.key|id_rsa*|*/id_rsa*|id_ed25519*|*/id_ed25519*|id_dsa*|*/id_dsa*|id_ecdsa*|*/id_ecdsa*|*.p12|*.pfx|*.keystore|*.kdbx|*.htpasswd) return 0 ;;
    .npmrc|*/.npmrc|.pypirc|*/.pypirc|.netrc|*/.netrc|.git-credentials|*/.git-credentials|.aws/credentials|*/.aws/credentials|.aws/config|*/.aws/config) return 0 ;;
    .gcp/*credentials*.json|*/.gcp/*credentials*.json|google-services.json|*/google-services.json|googleservice-info.plist|*/googleservice-info.plist|*serviceaccount*.json|firebase-adminsdk-*.json|*/firebase-adminsdk-*.json) return 0 ;;
    *token*|*secret*|*credentials*|*password*|*apikey*|*api_key*|*.mobileprovision|*.cer|*.certsigningrequest) return 0 ;;
    *) return 1 ;;
  esac
}

reject_secret_denied_tree() {
  local source_real="${1:?Error: source_real required}"
  local root_real="${2:?Error: root_real required}"
  local relative_path child_path

  if [[ -f "$source_real" ]]; then
    relative_path="${source_real#"$root_real"/}"
    if is_secret_denied_path "$relative_path"; then
      echo -e "${RED}Error: shared_file matches secret deny patterns: $relative_path${NC}" >&2
      return 1
    fi
    return 0
  fi

  while IFS= read -r -d '' child_path; do
    relative_path="${child_path#"$root_real"/}"
    if is_secret_denied_path "$relative_path"; then
      echo -e "${RED}Error: shared_file directory contains secret-denied directory: $relative_path${NC}" >&2
      return 1
    fi
  done < <(find "$source_real" -type d -print0)

  while IFS= read -r -d '' child_path; do
    relative_path="${child_path#"$root_real"/}"
    if is_secret_denied_path "$relative_path"; then
      echo -e "${RED}Error: shared_file directory contains secret-denied path: $relative_path${NC}" >&2
      return 1
    fi
  done < <(find "$source_real" -type f -print0)

  while IFS= read -r -d '' child_path; do
    relative_path="${child_path#"$root_real"/}"
    echo -e "${RED}Error: shared_file directory contains symlink; symlink copying is not supported: $relative_path${NC}" >&2
    return 1
  done < <(find "$source_real" -type l -print0)
  return 0
}

ensure_env_copy_log_excluded() {
  local worktree_path="${1:?Error: worktree_path required}"
  local exclude_file
  exclude_file=$(git -C "$worktree_path" rev-parse --git-path info/exclude)
  mkdir -p "$(dirname "$exclude_file")"
  if ! grep -Fxq ".env-copy.log" "$exclude_file" 2>/dev/null; then
    echo ".env-copy.log" >> "$exclude_file"
  fi
}

file_sha256_8() {
  local source="${1:?Error: source required}"
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$source" | awk '{print substr($1, 1, 8)}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$source" | awk '{print substr($1, 1, 8)}'
  else
    echo -e "${RED}Error: no SHA-256 tool found for env copy audit${NC}" >&2
    return 1
  fi
}

append_env_copy_log() {
  local worktree_path="${1:?Error: worktree_path required}"
  local source="${2:?Error: source required}"
  local dest="${3:?Error: dest required}"
  local size sha8 timestamp log_file
  size=$(wc -c < "$source" | tr -d '[:space:]')
  sha8=$(file_sha256_8 "$source")
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  log_file="$worktree_path/.env-copy.log"
  printf 'timestamp=%s source_path=%s destination_path=%s size_bytes=%s sha256_8=%s\n' \
    "$timestamp" "$source" "$dest" "$size" "$sha8" >> "$log_file"
}

copy_env_files() {
  local worktree_path="${1:?Error: worktree_path required}"
  local copied=0

  ensure_env_copy_log_excluded "$worktree_path"
  shopt -s nullglob
  local env_files=()
  for f in "$GIT_ROOT"/.env*; do
    [[ -f "$f" ]] || continue
    local basename
    basename=$(basename "$f")
    case "$basename" in
      .env.example|.env.template|.env.sample) continue ;;
    esac
    env_files+=("$f")
  done

  if [[ ${#env_files[@]} -eq 0 ]]; then
    echo -e "${YELLOW}No .env files copied: none found in main repo${NC}" >&2
    shopt -u nullglob
    return
  fi

  echo -e "${YELLOW}Copying env files by explicit --copy-env opt-in:${NC}" >&2
  for f in "${env_files[@]}"; do
    local basename
    basename=$(basename "$f")
    echo -e "${YELLOW}  - $basename${NC}" >&2
    cp "$f" "$worktree_path/$basename"
    append_env_copy_log "$worktree_path" "$f" "$worktree_path/$basename"
    copied=$((copied + 1))
  done
  shopt -u nullglob

  echo -e "${GREEN}Copied $copied env file(s) into experiment worktree${NC}" >&2
}

copy_shared_file() {
  local worktree_path="${1:?Error: worktree_path required}"
  local shared_file="${2:?Error: shared_file required}"
  local source_path="$GIT_ROOT/$shared_file"
  local dest_path="$worktree_path/$shared_file"
  local root_real worktree_real source_real dest_real dest_dir

  if ! is_exact_repo_relative_path "$shared_file"; then
    echo -e "${RED}Error: shared_file must be an exact repo-relative path: $shared_file${NC}" >&2
    return 1
  fi

  if is_secret_denied_path "$shared_file"; then
    echo -e "${RED}Error: shared_file matches secret deny patterns: $shared_file${NC}" >&2
    return 1
  fi

  if [[ ! -e "$source_path" ]]; then
    echo -e "${RED}Error: shared_file does not exist: $shared_file${NC}" >&2
    return 1
  fi

  root_real=$(realpath_existing "$GIT_ROOT")
  worktree_real=$(realpath_existing "$worktree_path")
  source_real=$(realpath_existing "$source_path")
  if ! path_within "$source_real" "$root_real"; then
    echo -e "${RED}Error: shared_file resolves outside repo: $shared_file${NC}" >&2
    return 1
  fi

  reject_secret_denied_tree "$source_real" "$root_real"

  dest_dir=$(dirname "$dest_path")
  mkdir -p "$dest_dir"
  dest_real=$(realpath_for_new_path "$dest_path")
  if ! path_within "$dest_real" "$worktree_real"; then
    echo -e "${RED}Error: shared_file destination resolves outside experiment worktree: $shared_file${NC}" >&2
    return 1
  fi

  if [[ -f "$source_real" ]]; then
    rm -rf "$dest_real"
    cp "$source_real" "$dest_real"
  elif [[ -d "$source_real" ]]; then
    rm -rf "$dest_real"
    cp -R "$source_real" "$dest_real"
  fi
}

# Create an experiment worktree
create_worktree() {
  local copy_env="false"
  if [[ "${1:-}" == "--copy-env" ]]; then
    copy_env="true"
    shift
  fi

  local spec_name="${1:?Error: spec_name required}"
  local exp_index="${2:?Error: exp_index required}"
  local base_branch="${3:?Error: base_branch required}"
  shift 3

  local padded_index
  padded_index=$(printf "%03d" "$exp_index")
  local worktree_name="optimize-${spec_name}-exp-${padded_index}"
  local branch_name
  branch_name=$(experiment_branch_name "$spec_name" "$padded_index")
  local worktree_path="$WORKTREE_DIR/$worktree_name"

  # Check if worktree already exists
  if [[ -d "$worktree_path" ]]; then
    if ! git -C "$worktree_path" rev-parse --is-inside-work-tree >/dev/null 2>&1 || \
       ! is_registered_worktree "$worktree_path"; then
      echo -e "${RED}Error: Existing path is not a valid registered git worktree: $worktree_path${NC}" >&2
      echo -e "${RED}Remove or repair that directory before rerunning the experiment.${NC}" >&2
      return 1
    fi

    echo -e "${YELLOW}Worktree already exists: $worktree_path${NC}" >&2
    reset_worktree_to_base "$worktree_path" "$branch_name" "$base_branch"
  else
    mkdir -p "$WORKTREE_DIR"
    ensure_worktree_exclude

    # Create worktree from the base branch
    if ! git worktree add -b "$branch_name" "$worktree_path" "$base_branch" --quiet 2>/dev/null; then
      if git show-ref --verify --quiet "refs/heads/$branch_name"; then
        if is_branch_checked_out "$branch_name"; then
          echo -e "${RED}Error: Existing experiment branch is already checked out: $branch_name${NC}" >&2
          echo -e "${RED}Clean up the stale worktree before rerunning this experiment.${NC}" >&2
          return 1
        fi

        echo -e "${YELLOW}Resetting existing experiment branch to base: $branch_name -> $base_branch${NC}" >&2
        git branch -f "$branch_name" "$base_branch" >/dev/null
        git worktree add "$worktree_path" "$branch_name" --quiet
      else
        echo -e "${RED}Error: Failed to create worktree for $branch_name from $base_branch${NC}" >&2
        return 1
      fi
    fi
  fi

  if [[ "$copy_env" == "true" ]]; then
    copy_env_files "$worktree_path"
  else
    echo -e "${YELLOW}Environment files not copied by default. Pass --copy-env to opt in.${NC}" >&2
  fi

  # Copy explicitly declared shared files after path and secret-boundary checks.
  for shared_file in "$@"; do
    copy_shared_file "$worktree_path" "$shared_file"
  done

  echo "$worktree_path"
}

# Clean up a single experiment worktree
cleanup_worktree() {
  local spec_name="${1:?Error: spec_name required}"
  local exp_index="${2:?Error: exp_index required}"

  local padded_index
  padded_index=$(printf "%03d" "$exp_index")
  local worktree_name="optimize-${spec_name}-exp-${padded_index}"
  local branch_name
  branch_name=$(experiment_branch_name "$spec_name" "$padded_index")
  local worktree_path="$WORKTREE_DIR/$worktree_name"

  if [[ -d "$worktree_path" ]]; then
    git worktree remove "$worktree_path" --force 2>/dev/null || {
      # If worktree remove fails, try manual cleanup
      rm -rf "$worktree_path" 2>/dev/null || true
      git worktree prune 2>/dev/null || true
    }
  fi

  # Delete the experiment branch
  git branch -D "$branch_name" 2>/dev/null || true

  echo -e "${GREEN}Cleaned up: $worktree_name${NC}" >&2
}

# Clean up all experiment worktrees for a spec
cleanup_all() {
  local spec_name="${1:?Error: spec_name required}"
  local prefix="optimize-${spec_name}-exp-"
  local count=0

  if [[ ! -d "$WORKTREE_DIR" ]]; then
    echo -e "${YELLOW}No worktrees directory found${NC}" >&2
    return 0
  fi

  for worktree_path in "$WORKTREE_DIR"/${prefix}*; do
    if [[ -d "$worktree_path" ]]; then
      local worktree_name
      worktree_name=$(basename "$worktree_path")
      # Extract index from name
      local index_str="${worktree_name#$prefix}"

      git worktree remove "$worktree_path" --force 2>/dev/null || {
        rm -rf "$worktree_path" 2>/dev/null || true
      }

      # Delete the branch
      local branch_name
      branch_name=$(experiment_branch_name "$spec_name" "$index_str")
      git branch -D "$branch_name" 2>/dev/null || true

      count=$((count + 1))
    fi
  done

  git worktree prune 2>/dev/null || true

  # Clean up empty worktree directory
  if [[ -d "$WORKTREE_DIR" ]] && [[ -z "$(ls -A "$WORKTREE_DIR" 2>/dev/null)" ]]; then
    rmdir "$WORKTREE_DIR" 2>/dev/null || true
  fi

  echo -e "${GREEN}Cleaned up $count experiment worktree(s) for $spec_name${NC}" >&2
}

# Count total worktrees (for budget check)
count_worktrees() {
  local count=0
  if [[ -d "$WORKTREE_DIR" ]]; then
    for worktree_path in "$WORKTREE_DIR"/*; do
      if [[ -d "$worktree_path" ]] && [[ -e "$worktree_path/.git" ]]; then
        count=$((count + 1))
      fi
    done
  fi
  echo "$count"
}

# Main
main() {
  local command="${1:-help}"

  case "$command" in
    create)
      shift
      create_worktree "$@"
      ;;
    cleanup)
      shift
      cleanup_worktree "$@"
      ;;
    cleanup-all)
      shift
      cleanup_all "$@"
      ;;
    count)
      count_worktrees
      ;;
    help)
      cat << 'EOF'
Experiment Worktree Manager

Usage:
  experiment-worktree.sh create [--copy-env] <spec_name> <exp_index> <base_branch> [shared_file ...]
  experiment-worktree.sh cleanup <spec_name> <exp_index>
  experiment-worktree.sh cleanup-all <spec_name>
  experiment-worktree.sh count

Commands:
  create       Create an experiment worktree with copied shared files; .env* copy requires --copy-env
  cleanup      Remove a single experiment worktree and its branch
  cleanup-all  Remove all experiment worktrees for a spec
  count        Count total active worktrees (for budget checking)

Worktrees:  .worktrees/optimize-<spec>-exp-<NNN>/
Branches:   optimize-exp/<spec>/exp-<NNN>
EOF
      ;;
    *)
      echo -e "${RED}Unknown command: $command${NC}" >&2
      exit 1
      ;;
  esac
}

main "$@"
