#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BIN="node $REPO_ROOT/bin/spec-first.js"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/spec-first-crg-workspace.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

make_repo() {
  local repo="$1"
  local name="$2"
  mkdir -p "$repo/src"
  git init -q "$repo"
  cat >"$repo/src/index.js" <<JS
function ${name}Greeting(name) {
  return "hello " + name;
}

module.exports = { ${name}Greeting };
JS
  git -C "$repo" add src/index.js
}

make_repo "$TMP_DIR/repo-a" "repoA"
make_repo "$TMP_DIR/repo-b" "repoB"

SCAN_OUT="$TMP_DIR/scan.json"
STATUS_OUT="$TMP_DIR/status.json"
CONTEXT_OUT="$TMP_DIR/context.json"
BUILD_OUT="$TMP_DIR/build.json"

$BIN crg workspace scan --root="$TMP_DIR" >"$SCAN_OUT"
$BIN crg workspace status --root="$TMP_DIR" >"$STATUS_OUT"
$BIN crg workspace context --root="$TMP_DIR" --task="change repo-b greeting" >"$CONTEXT_OUT"

node - "$SCAN_OUT" "$STATUS_OUT" "$CONTEXT_OUT" "$TMP_DIR" <<'NODE'
const fs = require('fs');
const [scanPath, statusPath, contextPath, root] = process.argv.slice(2);
const realRoot = fs.realpathSync.native(root);
const scan = JSON.parse(fs.readFileSync(scanPath, 'utf8'));
const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
const context = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
if (scan.schema_version !== 'crg-cli/v1') throw new Error('scan envelope schema mismatch');
if (status.schema_version !== 'crg-cli/v1') throw new Error('status envelope schema mismatch');
if (context.schema_version !== 'crg-cli/v1') throw new Error('context envelope schema mismatch');
const slugs = scan.data.children.map((child) => child.slug).sort();
if (slugs.join(',') !== 'repo-a,repo-b') throw new Error(`unexpected children: ${slugs.join(',')}`);
if (!status.data.children.every((child) => child.signals.includes('graph_missing'))) {
  throw new Error('expected child graph_missing before build');
}
const serialized = JSON.stringify(context);
for (const forbidden of ['selected_repo', 'target_repo', 'final_repo']) {
  if (serialized.includes(forbidden)) throw new Error(`context leaked ${forbidden}`);
}
if (context.data.candidates[0].slug !== 'repo-b') throw new Error('task name should rank repo-b first');
if (!context.data.candidates[0].recommended_commands.join('\n').includes(`${realRoot}/repo-b`)) {
  throw new Error('recommended commands must point at child repo');
}
NODE

$BIN crg workspace build --root="$TMP_DIR" --repo=repo-b --force >"$BUILD_OUT"

node - "$BUILD_OUT" "$TMP_DIR" <<'NODE'
const fs = require('fs');
const path = require('path');
const [buildPath, root] = process.argv.slice(2);
const build = JSON.parse(fs.readFileSync(buildPath, 'utf8'));
if (build.schema_version !== 'crg-cli/v1') throw new Error('build envelope schema mismatch');
if (build.data.built_child.slug !== 'repo-b') throw new Error('wrong child built');
if (!build.data.child_build || !build.data.child_build.data || !build.data.child_build.data.generation_id) {
  throw new Error('child build envelope was not preserved');
}
if (!fs.existsSync(path.join(root, 'repo-b', '.spec-first', 'graph', 'graph.db'))) {
  throw new Error('child graph.db missing');
}
if (fs.existsSync(path.join(root, '.spec-first', 'graph', 'graph.db'))) {
  throw new Error('parent workspace graph.db must not exist');
}
if (!fs.existsSync(path.join(root, 'repo-b', '.spec-first', 'graph', 'repo-topology.json'))) {
  throw new Error('child repo-topology.json missing');
}
NODE

echo "crg workspace mainline ok"
