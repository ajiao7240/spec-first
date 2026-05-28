#!/bin/bash
# repair-worktree.sh - Preview broken worktree pointer repair guidance.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib-git-health.sh"

MODE="dry-run"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      MODE="dry-run"
      shift
      ;;
    --apply|--unlink)
      echo "reason_code=repair-worktree-apply-deferred" >&2
      echo "repair-worktree only supports --dry-run in this release. Deleting .git is deferred to a follow-up design with dry-run fingerprint binding." >&2
      exit 1
      ;;
    --help|-h)
      cat <<'EOF'
Usage: repair-worktree.sh [--dry-run]

Preview broken Git worktree pointer repair guidance. This command never deletes .git.
EOF
      exit 0
      ;;
    *)
      echo "repair-worktree.sh: unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

target_dir="$(pwd -P)"
detect_git_health "$target_dir"

if [ "$GIT_HEALTH_STATUS" != "broken-worktree" ]; then
  echo "reason_code=repair-worktree-not-broken-worktree" >&2
  echo "repair-worktree is only available when the current directory has a broken .git worktree pointer. Current status: $GIT_HEALTH_STATUS." >&2
  exit 1
fi

timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
git_file="$target_dir/.git"

cat <<EOF
repair_worktree_dry_run=true
generated_at=$timestamp
reason_code=broken-worktree

Broken worktree pointer:
  git_file: $git_file
  pointer_raw: $GIT_HEALTH_WORKTREE_POINTER_RAW
  pointer_path: $GIT_HEALTH_WORKTREE_POINTER_PATH
  pointer_exists: $GIT_HEALTH_WORKTREE_POINTER_EXISTS

Unlink preview:
  This command will not delete files.
  Manual command, if you decide this stale worktree pointer is safe to remove:
    rm "$git_file"

Manual repair guidance:
  If this directory should become a normal Git repo, remove the stale .git pointer yourself, then run git init or restore the correct repository metadata.
  If this directory should remain a parent workspace, leave repo-local artifacts advisory-only and select child repos with --repo <child>.

Workaround:
  For explicit non-git folder indexing, run the relevant setup/bootstrap flow with --folder .
EOF
