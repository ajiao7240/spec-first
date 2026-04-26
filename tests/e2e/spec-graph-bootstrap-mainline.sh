#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
TARGET_REPO="$TMP_DIR/crg-mainline"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$TARGET_REPO/src"
cat > "$TARGET_REPO/package.json" <<'JSON'
{
  "name": "crg-mainline-fixture",
  "scripts": {
    "test": "node --test"
  }
}
JSON
cat > "$TARGET_REPO/src/index.js" <<'JS'
function greet(name) {
  return `hello ${name}`;
}

module.exports = { greet };
JS

node "$REPO_ROOT/bin/spec-first.js" crg build --repo="$TARGET_REPO" >/tmp/spec-first-crg-build.out

test -f "$TARGET_REPO/.spec-first/graph/graph-index-status.json"
test -f "$TARGET_REPO/.spec-first/graph/code-navigation.json"
test -f "$TARGET_REPO/.spec-first/graph/graph-operations.jsonl"

if [ -e "$TARGET_REPO/.spec-first/workflows/bootstrap" ]; then
  echo "legacy bootstrap control-plane should not be generated" >&2
  exit 1
fi

node "$REPO_ROOT/bin/spec-first.js" crg workflow-context --repo="$TARGET_REPO" --stage=plan --task="change greeting" >/tmp/spec-first-crg-workflow-context.out
node -e '
const fs = require("node:fs");
const payload = JSON.parse(fs.readFileSync("/tmp/spec-first-crg-workflow-context.out", "utf8"));
if (payload.data.stage !== "plan") throw new Error("expected plan stage");
if (!payload.data.recommended_queries.some((item) => item.command.includes("crg locate"))) {
  throw new Error("expected locate query recommendation");
}
const text = JSON.stringify(payload);
if (/stage0-context|minimal-context|context-routing|selected_assets/.test(text)) {
  throw new Error("workflow-context exposed legacy Stage-0 fields");
}
'

node "$REPO_ROOT/bin/spec-first.js" crg hook before-plan --repo="$TARGET_REPO" --task="change greeting" >/tmp/spec-first-crg-before-plan.out
node -e '
const fs = require("node:fs");
const payload = JSON.parse(fs.readFileSync("/tmp/spec-first-crg-before-plan.out", "utf8"));
if (payload.data.hook_id !== "before_plan") throw new Error("expected before_plan hook");
if (!String(payload.data.candidate_surface_policy || "").includes("LLM selects")) {
  throw new Error("expected LLM decision boundary");
}
'

node "$REPO_ROOT/bin/spec-first.js" crg locate --repo="$TARGET_REPO" --query="greet" --detail=minimal >/tmp/spec-first-crg-locate.out
node -e '
const fs = require("node:fs");
const payload = JSON.parse(fs.readFileSync("/tmp/spec-first-crg-locate.out", "utf8"));
if (!Array.isArray(payload.data.candidates)) throw new Error("expected locate candidates array");
'
