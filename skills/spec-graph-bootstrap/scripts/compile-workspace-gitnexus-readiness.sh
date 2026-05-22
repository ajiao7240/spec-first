#!/bin/bash
# Thin wrapper for the deterministic workspace GitNexus readiness classifier.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

exec node "$REPO_ROOT/src/cli/helpers/compile-workspace-gitnexus-readiness.js" "$@"
