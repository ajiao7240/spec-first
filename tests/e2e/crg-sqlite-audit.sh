#!/usr/bin/env bash
# =============================================================================
# CRG 阶段0 SQLite 结果审计
#
# 目标：
#   1. 校验 graph.db 物理健康（integrity / foreign keys）
#   2. 校验关键表不变量（无悬挂引用、无计数漂移、枚举合法）
#   3. 校验 CLI 输出与 SQLite 真值一致
#   4. 暴露结果纯度风险（如 runtime 副本目录混入图）
#
# 用法：
#   bash tests/e2e/crg-sqlite-audit.sh [--repo=<path>]
# =============================================================================

set -euo pipefail

REPO="${1:-$(pwd)}"
REPO="${REPO#--repo=}"
BIN="node $(pwd)/bin/spec-first.js"
PASS=0
FAIL=0
WARN=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS+1)); }
fail() { echo -e "  ${RED}✗${NC} $1"; FAIL=$((FAIL+1)); }
warn() { echo -e "  ${YELLOW}!${NC} $1"; WARN=$((WARN+1)); }
section() { echo -e "\n${CYAN}── $1 ──${NC}"; }

run_crg_json() {
  local out
  out=$($BIN crg "$@" --repo="$REPO" 2>/dev/null)
  echo "$out"
}

run_db_json() {
  local js="${1-}"
  DB_AUDIT_JS="$js" node - "$REPO" <<'NODE'
const Database = require('better-sqlite3');
const repo = process.argv[2];
const path = require('path');
const db = new Database(path.join(repo, '.spec-first', 'graph', 'graph.db'), { readonly: true });
const fn = new Function('db', 'repo', process.env.DB_AUDIT_JS || '');
const result = fn(db, repo);
process.stdout.write(JSON.stringify(result));
db.close();
NODE
}

json_get() {
  local json="$1"
  local expr="$2"
  echo "$json" | node -e "const fs=require('fs'); const j=JSON.parse(fs.readFileSync(0,'utf8')); console.log(${expr});"
}

section "准备"

if [[ ! -f "$REPO/.spec-first/graph/graph.db" ]]; then
  echo "  图不存在，先执行构建..."
  $BIN crg build --repo="$REPO" >/dev/null
fi
ok "graph.db 已存在"

# 旧路径 negative guard：确认旧目录未被创建
if [[ -d "$REPO/.spec-first-graph" ]]; then
  fail "旧路径 .spec-first-graph/ 存在（应已迁移到 .spec-first/graph/）"
else
  ok "旧路径 .spec-first-graph/ 不存在"
fi

section "物理健康"

PHYSICAL_JSON=$(run_db_json "$(cat <<'JS'
const integrityRows = db.prepare('PRAGMA integrity_check').all();
const fkRows = db.prepare('PRAGMA foreign_key_check').all();
return {
  integrity: integrityRows.map((r) => Object.values(r)[0]),
  foreign_keys: fkRows,
};
JS
)")

INTEGRITY=$(json_get "$PHYSICAL_JSON" "j.integrity.join(',')")
FK_COUNT=$(json_get "$PHYSICAL_JSON" "j.foreign_keys.length")

if [[ "$INTEGRITY" == "ok" ]]; then
  ok "integrity_check=ok"
else
  fail "integrity_check=$INTEGRITY"
fi

if [[ "$FK_COUNT" == "0" ]]; then
  ok "foreign_key_check 无异常"
else
  fail "foreign_key_check 返回 $FK_COUNT 条异常"
fi

section "结果不变量"

INVARIANT_JSON=$(run_db_json "$(cat <<'JS'
function get(sql) { return db.prepare(sql).get().c; }
return {
  orphan_edges: get(`SELECT COUNT(*) c
    FROM edges e
    LEFT JOIN nodes s ON s.id = e.source_id
    LEFT JOIN nodes t ON t.id = e.target_id
    WHERE s.id IS NULL OR t.id IS NULL`),
  orphan_flow_entries: get(`SELECT COUNT(*) c
    FROM flows f
    LEFT JOIN nodes n ON n.id = f.entry_node_id
    WHERE f.entry_node_id IS NOT NULL AND n.id IS NULL`),
  orphan_flow_nodes: get(`SELECT COUNT(*) c
    FROM flow_nodes fn
    LEFT JOIN flows f ON f.id = fn.flow_id
    LEFT JOIN nodes n ON n.id = fn.node_id
    WHERE f.id IS NULL OR n.id IS NULL`),
  orphan_fingerprints: get(`SELECT COUNT(*) c
    FROM fingerprints fp
    LEFT JOIN nodes n ON n.file_path = fp.file_path
    WHERE n.file_path IS NULL`),
  duplicate_edges: get(`SELECT COUNT(*) c
    FROM (
      SELECT source_id, target_id, kind, COUNT(*) n
      FROM edges
      GROUP BY source_id, target_id, kind
      HAVING n > 1
    )`),
  bad_line_ranges: get(`SELECT COUNT(*) c
    FROM nodes
    WHERE line_start IS NOT NULL
      AND line_end IS NOT NULL
      AND line_end < line_start`),
  bad_test_flags: get(`SELECT COUNT(*) c FROM nodes WHERE is_test NOT IN (0, 1)`),
  bad_confidence: get(`SELECT COUNT(*) c
    FROM nodes
    WHERE confidence NOT IN ('Observed', 'Inferred', 'Unknown')`),
  bad_source_tier: get(`SELECT COUNT(*) c
    FROM nodes
    WHERE source_tier NOT IN ('crg_ast', 'serena_semantic', 'grep_glob')`),
  bad_community_status: get(`SELECT COUNT(*) c
    FROM communities
    WHERE health_status NOT IN ('healthy', 'isolated', 'scattered', 'fragmented')`),
  bad_criticality: get(`SELECT COUNT(*) c
    FROM flows
    WHERE criticality < 0 OR criticality > 1`),
  flow_node_count_mismatch: get(`SELECT COUNT(*) c
    FROM flows f
    LEFT JOIN (
      SELECT flow_id, COUNT(*) cnt
      FROM flow_nodes
      GROUP BY flow_id
    ) x ON x.flow_id = f.id
    WHERE COALESCE(x.cnt, 0) != f.node_count`),
  community_file_count_mismatch: get(`SELECT COUNT(*) c
    FROM communities c
    LEFT JOIN (
      SELECT community_id, COUNT(DISTINCT file_path) cnt
      FROM nodes
      WHERE community_id IS NOT NULL
      GROUP BY community_id
    ) x ON x.community_id = c.id
    WHERE COALESCE(x.cnt, 0) != c.file_count`),
  bad_evidence_json: get(`SELECT COUNT(*) c FROM nodes WHERE json_valid(evidence) = 0`),
  fts_row_mismatch: get(`SELECT ABS(
      (SELECT COUNT(*) FROM fts_nodes) -
      (SELECT COUNT(*) FROM nodes)
    ) c`),
  graph_meta_rows: get(`SELECT COUNT(*) c FROM graph_meta`),
};
JS
)")

for key in \
  orphan_edges orphan_flow_entries orphan_flow_nodes orphan_fingerprints duplicate_edges bad_line_ranges \
  bad_test_flags bad_confidence bad_source_tier bad_community_status bad_criticality \
  flow_node_count_mismatch community_file_count_mismatch bad_evidence_json fts_row_mismatch
do
  VALUE=$(json_get "$INVARIANT_JSON" "j['$key']")
  if [[ "$VALUE" == "0" ]]; then
    ok "$key=0"
  else
    fail "$key=$VALUE"
  fi
done

META_ROWS=$(json_get "$INVARIANT_JSON" "j.graph_meta_rows")
if [[ "$META_ROWS" == "1" ]]; then
  ok "graph_meta 恰好 1 行"
else
  fail "graph_meta 行数=$META_ROWS，应为 1"
fi

section "CLI 对账"

STATS_JSON=$(run_crg_json stats)
FLOWS_JSON=$(run_crg_json flows)
COMMUNITIES_JSON=$(run_crg_json communities)
ARCH_JSON=$(run_crg_json architecture)

TRUTH_JSON=$(run_db_json "$(cat <<'JS'
function get(sql) { return db.prepare(sql).get(); }
return {
  node_count: get('SELECT COUNT(*) c FROM nodes').c,
  edge_count: get('SELECT COUNT(*) c FROM edges').c,
  flow_count: get('SELECT COUNT(*) c FROM flows').c,
  community_count: get('SELECT COUNT(*) c FROM communities').c,
  unresolved_edge_count: get('SELECT unresolved_edge_count c FROM graph_meta WHERE id = 1').c,
};
JS
)")

compare_eq() {
  local label="$1"
  local left="$2"
  local right="$3"
  if [[ "$left" == "$right" ]]; then
    ok "$label: $left == $right"
  else
    fail "$label: $left != $right"
  fi
}

compare_eq "stats.node_count vs db" \
  "$(json_get "$STATS_JSON" "j.data.node_count")" \
  "$(json_get "$TRUTH_JSON" "j.node_count")"

compare_eq "stats.edge_count vs db" \
  "$(json_get "$STATS_JSON" "j.data.edge_count")" \
  "$(json_get "$TRUTH_JSON" "j.edge_count")"

compare_eq "stats.unresolved_edge_count vs db" \
  "$(json_get "$STATS_JSON" "j.data.unresolved_edge_count")" \
  "$(json_get "$TRUTH_JSON" "j.unresolved_edge_count")"

compare_eq "flows.items.length vs db" \
  "$(json_get "$FLOWS_JSON" "j.data.items.length")" \
  "$(json_get "$TRUTH_JSON" "j.flow_count")"

compare_eq "communities.items.length vs db" \
  "$(json_get "$COMMUNITIES_JSON" "j.data.items.length")" \
  "$(json_get "$TRUTH_JSON" "j.community_count")"

ARCH_HUBS=$(json_get "$ARCH_JSON" "j.data.hub_nodes.length")
if [[ "$ARCH_HUBS" =~ ^[0-9]+$ ]]; then
  ok "architecture.hub_nodes.length=$ARCH_HUBS"
else
  fail "architecture.hub_nodes.length 非整数: $ARCH_HUBS"
fi

section "结果纯度风险"

RISK_JSON=$(run_db_json "$(cat <<'JS'
function get(sql) { return db.prepare(sql).get(); }
function all(sql) { return db.prepare(sql).all(); }
return {
  unresolved_edge_count: get('SELECT unresolved_edge_count c FROM graph_meta WHERE id = 1').c,
  unresolved_detail_count: get('SELECT COUNT(*) c FROM unresolved_edges').c,
  runtime_nodes: get(`SELECT COUNT(*) c
    FROM nodes
    WHERE file_path LIKE '.claude/%'
       OR file_path LIKE '.codex/%'
       OR file_path LIKE '.agents/%'`).c,
  runtime_flows: get(`SELECT COUNT(*) c
    FROM flows
    WHERE entry_node_id LIKE '.claude/%'
       OR entry_node_id LIKE '.codex/%'
       OR entry_node_id LIKE '.agents/%'`).c,
  duplicated_source_copies: get(`SELECT COUNT(*) c
    FROM (
      SELECT canonical
      FROM (
        SELECT DISTINCT file_path,
          CASE
            WHEN file_path LIKE '.claude/%' THEN SUBSTR(file_path, 9)
            WHEN file_path LIKE '.agents/%' THEN SUBSTR(file_path, 9)
            WHEN file_path LIKE '.codex/%' THEN SUBSTR(file_path, 8)
            ELSE file_path
          END AS canonical
        FROM nodes
        WHERE file_path LIKE '.claude/%'
           OR file_path LIKE '.codex/%'
           OR file_path LIKE '.agents/%'
           OR file_path LIKE 'skills/%'
           OR file_path LIKE 'agents/%'
      )
      GROUP BY canonical
      HAVING COUNT(*) > 1
    )`).c,
  root_breakdown: all(`SELECT
      CASE
        WHEN file_path LIKE '.claude/%' THEN '.claude'
        WHEN file_path LIKE '.codex/%' THEN '.codex'
        WHEN file_path LIKE '.agents/%' THEN '.agents'
        WHEN file_path LIKE 'skills/%' THEN 'skills'
        WHEN file_path LIKE 'agents/%' THEN 'agents'
        WHEN file_path LIKE 'src/%' THEN 'src'
        WHEN file_path LIKE 'tests/%' THEN 'tests'
        ELSE 'other'
      END AS bucket,
      COUNT(*) c
    FROM nodes
    GROUP BY bucket
    ORDER BY c DESC`),
};
JS
)")

UNRESOLVED_COUNT=$(json_get "$RISK_JSON" "j.unresolved_edge_count")
UNRESOLVED_DETAIL_COUNT=$(json_get "$RISK_JSON" "j.unresolved_detail_count")
RUNTIME_NODE_COUNT=$(json_get "$RISK_JSON" "j.runtime_nodes")
RUNTIME_FLOW_COUNT=$(json_get "$RISK_JSON" "j.runtime_flows")
DUPLICATED_COPY_COUNT=$(json_get "$RISK_JSON" "j.duplicated_source_copies")

if [[ "$UNRESOLVED_COUNT" == "0" ]]; then
  ok "unresolved_edge_count=0"
else
  if [[ "$UNRESOLVED_DETAIL_COUNT" == "$UNRESOLVED_COUNT" ]]; then
    ok "unresolved 明细表已建立: count=${UNRESOLVED_DETAIL_COUNT}"
  else
    warn "unresolved_edge_count=${UNRESOLVED_COUNT}, unresolved 明细条数=${UNRESOLVED_DETAIL_COUNT}，可观测性仍不完整"
  fi
fi

if [[ "$RUNTIME_NODE_COUNT" == "0" && "$RUNTIME_FLOW_COUNT" == "0" ]]; then
  ok "图中未混入 runtime 副本目录"
else
  warn "runtime 副本目录已入图: nodes=${RUNTIME_NODE_COUNT}, flows=${RUNTIME_FLOW_COUNT}"
fi

if [[ "$DUPLICATED_COPY_COUNT" == "0" ]]; then
  ok "未发现 source/runtime 多份副本同时入图"
else
  warn "发现 ${DUPLICATED_COPY_COUNT} 个 canonical 文件同时存在 source/runtime 多份副本"
fi

echo "$RISK_JSON" | node -e '
  const fs = require("fs");
  const j = JSON.parse(fs.readFileSync(0, "utf8"));
  console.log("  节点路径分布:");
  for (const row of j.root_breakdown) {
    console.log(`    - ${row.bucket}: ${row.c}`);
  }
'

section "审查结论"

if [[ "$FAIL" -eq 0 ]]; then
  ok "SQLite 结构正确性、关系一致性、CLI 对账全部通过"
else
  fail "存在硬失败项，当前 graph.db 不应视为通过审计"
fi

if [[ "$WARN" -gt 0 ]]; then
  if [[ "$UNRESOLVED_COUNT" == "0" && "$RUNTIME_NODE_COUNT" == "0" && "$DUPLICATED_COPY_COUNT" == "0" ]]; then
    ok "当前未发现额外结果纯度风险"
  elif [[ "$UNRESOLVED_COUNT" == "0" ]]; then
    warn "当前存在结果质量风险，重点是 runtime 副本混入图"
  elif [[ "$RUNTIME_NODE_COUNT" == "0" && "$DUPLICATED_COPY_COUNT" == "0" ]]; then
    warn "当前存在结果质量风险，重点是 unresolved 边可观测性不足"
  else
    warn "当前存在结果质量风险，重点是 unresolved 边可观测性不足与 runtime 副本混入图"
  fi
else
  ok "当前未发现额外结果纯度风险"
fi

TOTAL=$((PASS + FAIL + WARN))
echo ""
echo "═══════════════════════════════════════════"
echo -e " 结果: ${GREEN}$PASS 通过${NC}  ${RED}$FAIL 失败${NC}  ${YELLOW}$WARN 告警${NC}  / $TOTAL 总计"
echo "═══════════════════════════════════════════"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
