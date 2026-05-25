#!/bin/bash
# 仅用于 benchmark：从 provider 原生存储中提取稳定 graph anchors。

set -euo pipefail

REPO_ROOT=""
PROVIDER="all"
GITNEXUS_PACKAGE="${GITNEXUS_PACKAGE:-gitnexus@1.6.5}"
GITNEXUS_REPO_SELECTOR="${GITNEXUS_REPO_SELECTOR:-}"

usage() {
  cat <<'EOF'
Usage: extract-graph-anchors.sh --repo <path> [--provider all|gitnexus] [--gitnexus-repo <selector>]

Outputs JSON with nodes[] and edges[] anchors. This helper is benchmark-only, extracts active providers only, and does not mutate canonical graph artifacts.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO_ROOT="${2:-}"
      [ -n "$REPO_ROOT" ] || { echo "extract-graph-anchors.sh: --repo requires a value" >&2; exit 1; }
      shift 2
      ;;
    --provider)
      PROVIDER="${2:-}"
      [ -n "$PROVIDER" ] || { echo "extract-graph-anchors.sh: --provider requires a value" >&2; exit 1; }
      shift 2
      ;;
    --gitnexus-repo)
      GITNEXUS_REPO_SELECTOR="${2:-}"
      [ -n "$GITNEXUS_REPO_SELECTOR" ] || { echo "extract-graph-anchors.sh: --gitnexus-repo requires a value" >&2; exit 1; }
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "extract-graph-anchors.sh: unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

[ -n "$REPO_ROOT" ] || { usage >&2; exit 1; }
[ -d "$REPO_ROOT/.git" ] || { echo "extract-graph-anchors.sh: repo is not a git checkout: $REPO_ROOT" >&2; exit 1; }
REPO_ROOT="$(cd "$REPO_ROOT" && pwd -P)"
if [ -z "$GITNEXUS_REPO_SELECTOR" ]; then
  GITNEXUS_REPO_SELECTOR="$REPO_ROOT"
fi

SOURCE_REVISION="$(git -C "$REPO_ROOT" rev-parse --verify 'HEAD^{commit}' 2>/dev/null || true)"
[ -n "$SOURCE_REVISION" ] || { echo "extract-graph-anchors.sh: cannot resolve HEAD" >&2; exit 1; }

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/spec-first-anchors.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

empty_provider_json() {
  local provider="$1"
  local status="$2"
  local reason="$3"
  jq -n \
    --arg provider "$provider" \
    --arg status "$status" \
    --arg reason "$reason" \
    '{provider:$provider,status:$status,nodes:[],edges:[],diagnostics:[{reason_code:$reason}]}'
}

parse_gitnexus_output() {
  local input_file="$1"
  local kind="$2"
  local markdown_file="$TMP_DIR/gitnexus-${kind}-markdown.txt"

  if jq -e 'type == "object" and has("markdown")' "$input_file" >/dev/null 2>&1; then
    jq -r '.markdown // ""' "$input_file" > "$markdown_file"
  elif jq -e 'type == "string"' "$input_file" >/dev/null 2>&1; then
    jq -r . "$input_file" > "$markdown_file"
  else
    cp "$input_file" "$markdown_file"
  fi

  awk -v kind="$kind" '
    BEGIN { FS="|"; }
    /^\|/ && $0 !~ /^\|[[:space:]-]+\|/ && $0 !~ /^\|[[:space:]]*(kind|type)[[:space:]]*\|/ {
      for (i = 1; i <= NF; i++) {
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", $i)
      }
      if (kind == "node" && NF >= 6) {
        printf "%s\t%s\t%s\t%s\t%s\n", $2, $3, $4, $5, $6
      } else if (kind == "edge" && NF >= 6) {
        printf "%s\t%s\t%s\t%s\t%s\n", $2, $3, $4, $5, $6
      }
    }
  ' "$markdown_file"
}

extract_gitnexus() {
  local node_rows="$TMP_DIR/gitnexus-nodes.tsv"
  local edge_rows="$TMP_DIR/gitnexus-edges.tsv"
  local node_raw="$TMP_DIR/gitnexus-nodes.out"
  local edge_raw="$TMP_DIR/gitnexus-edges.out"
  local node_query='MATCH (n:Function) RETURN "Function" AS kind, n.name AS name, n.filePath AS filePath, n.startLine AS startLine, n.endLine AS endLine UNION ALL MATCH (n:Class) RETURN "Class" AS kind, n.name AS name, n.filePath AS filePath, n.startLine AS startLine, n.endLine AS endLine UNION ALL MATCH (n:Interface) RETURN "Interface" AS kind, n.name AS name, n.filePath AS filePath, n.startLine AS startLine, n.endLine AS endLine UNION ALL MATCH (n:Method) RETURN "Method" AS kind, n.name AS name, n.filePath AS filePath, n.startLine AS startLine, n.endLine AS endLine'
  local edge_query='MATCH (n)-[r:CodeRelation]->(m) WHERE r.type IN ["CALLS","IMPORTS","IMPORTS_FROM","REFERENCES"] RETURN r.type AS type, n.filePath AS fromFile, n.name AS fromName, m.filePath AS toFile, m.name AS toName'

  if ! command -v npx >/dev/null 2>&1; then
    empty_provider_json gitnexus unavailable npx-missing
    return
  fi

  set +e
  (cd "$REPO_ROOT" && npx -y "$GITNEXUS_PACKAGE" cypher "$node_query" --repo "$GITNEXUS_REPO_SELECTOR") > "$node_raw" 2>"$TMP_DIR/gitnexus-nodes.err"
  local node_status=$?
  (cd "$REPO_ROOT" && npx -y "$GITNEXUS_PACKAGE" cypher "$edge_query" --repo "$GITNEXUS_REPO_SELECTOR") > "$edge_raw" 2>"$TMP_DIR/gitnexus-edges.err"
  local edge_status=$?
  if [ "$node_status" -eq 0 ]; then
    parse_gitnexus_output "$node_raw" node > "$node_rows"
  else
    : > "$node_rows"
  fi
  if [ "$edge_status" -eq 0 ]; then
    parse_gitnexus_output "$edge_raw" edge > "$edge_rows"
  else
    : > "$edge_rows"
  fi
  set -e

  jq -n \
    --arg provider "gitnexus" \
    --arg repo_root "$REPO_ROOT" \
    --arg source_revision "$SOURCE_REVISION" \
    --arg repo_selector "$GITNEXUS_REPO_SELECTOR" \
    --argjson node_status "$node_status" \
    --argjson edge_status "$edge_status" \
    --rawfile nodes "$node_rows" \
    --rawfile edges "$edge_rows" '
      def rows($text): ($text | split("\n") | map(select(length > 0) | split("\t")));
      {
        provider:$provider,
        status:(if $node_status == 0 and $edge_status == 0 then "ok" else "partial" end),
        metadata:{
          repo_root:$repo_root,
          source_revision:$source_revision,
          repo_selector:$repo_selector,
          node_exit_code:$node_status,
          edge_exit_code:$edge_status
        },
        nodes:(rows($nodes) | map({
          kind:.[0],
          name:.[1],
          path:.[2],
          start_line:(.[3] | tonumber?),
          end_line:(.[4] | tonumber?)
        })),
        edges:(rows($edges) | map({
          type:.[0],
          from_path:.[1],
          from_name:.[2],
          to_path:.[3],
          to_name:.[4]
        })),
        diagnostics:[]
      }'
}

provider_results="$TMP_DIR/providers.jsonl"
: > "$provider_results"

case "$PROVIDER" in
  all)
    extract_gitnexus >> "$provider_results"
    ;;
  gitnexus)
    extract_gitnexus >> "$provider_results"
    ;;
  *)
    echo "extract-graph-anchors.sh: unsupported provider: $PROVIDER" >&2
    exit 1
    ;;
esac

jq -s \
  --arg repo_root "$REPO_ROOT" \
  --arg source_revision "$SOURCE_REVISION" '{
    schema_version:"spec-first-graph-anchor-extraction.v1",
    repo_root:$repo_root,
    source_revision:$source_revision,
    providers:.,
    nodes:[.[].nodes[]?],
    edges:[.[].edges[]?],
    diagnostics:[.[].diagnostics[]?]
  }' "$provider_results"
