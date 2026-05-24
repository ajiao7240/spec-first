#!/bin/bash
# Thin wrapper for the deterministic workspace GitNexus readiness classifier.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SOURCE_HELPER="$REPO_ROOT/src/cli/helpers/compile-workspace-gitnexus-readiness.js"

if [ -f "$SOURCE_HELPER" ]; then
  exec node "$SOURCE_HELPER" "$@"
fi

if [ -n "${SPEC_FIRST_CLI:-}" ]; then
  if [ -f "$SPEC_FIRST_CLI" ] && [[ "$SPEC_FIRST_CLI" == *.js ]]; then
    exec node "$SPEC_FIRST_CLI" internal workspace-gitnexus-readiness "$@"
  fi
  exec "$SPEC_FIRST_CLI" internal workspace-gitnexus-readiness "$@"
fi

if command -v spec-first >/dev/null 2>&1; then
  exec spec-first internal workspace-gitnexus-readiness "$@"
fi

echo 'compile-workspace-gitnexus-readiness.sh: could not locate source helper or spec-first CLI' >&2
exit 127
