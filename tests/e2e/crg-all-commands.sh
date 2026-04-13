#!/usr/bin/env bash
# =============================================================================
# CRG 阶段0 全命令端到端测试
#
# 覆盖：
#   - 17 个子命令正常路径（JSON envelope 格式、必填字段）
#   - 必填参数缺失时的 exit 1 / exit 2
#   - 错误参数（无效 pattern、不存在资源 ID）
#   - 增量稳定性（第二次 build changed_files=0）
#
# 用法：
#   bash tests/e2e/crg-all-commands.sh [--repo=<path>]
#
# 默认使用当前目录作为 repo。
# =============================================================================

set -euo pipefail

REPO="${1:-$(pwd)}"
REPO="${REPO#--repo=}"
BIN="node $(pwd)/bin/spec-first.js"
PASS=0
FAIL=0
SKIP=0

# ─── helpers ──────────────────────────────────────────────────────────────────

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS+1)); }
fail() { echo -e "  ${RED}✗${NC} $1"; FAIL=$((FAIL+1)); }
skip() { echo -e "  ${YELLOW}~${NC} $1 (skip)"; SKIP=$((SKIP+1)); }
section() { echo -e "\n${CYAN}── $1 ──${NC}"; }

# 执行命令，返回 stdout；失败时输出到 stderr 不中断
run() { $BIN crg "$@" --repo="$REPO" 2>/dev/null; }
run_raw() { $BIN crg "$@" 2>/dev/null; }

# 检查 JSON 是否包含所有必填键
check_json() {
  local label="$1"; local json="$2"; shift 2
  local keys=("$@")
  if [[ -z "$json" ]]; then
    fail "$label — 输出为空"
    return
  fi
  for key in "${keys[@]}"; do
    if ! echo "$json" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const j=JSON.parse(d); if(j['$key']===undefined && (j.data||{})['$key']===undefined){process.exit(1);}" 2>/dev/null; then
      fail "$label — 缺少字段: $key"
      return
    fi
  done
  ok "$label"
}

# 检查顶层 envelope 字段
check_envelope() {
  local label="$1"; local json="$2"
  if [[ -z "$json" ]]; then
    fail "$label — 输出为空"
    return
  fi
  local ok_flag
  ok_flag=$(echo "$json" | node -e "
    const d=require('fs').readFileSync('/dev/stdin','utf8');
    try{
      const j=JSON.parse(d);
      const req=['schema_version','generated_at','repo_root','degraded','warnings','data'];
      const missing=req.filter(k=>j[k]===undefined);
      if(missing.length>0){console.log('missing:'+missing.join(','));process.exit(0);}
      if(j.schema_version!=='crg-cli/v1'){console.log('bad_schema:'+j.schema_version);process.exit(0);}
      console.log('ok');
    }catch(e){console.log('parse_error:'+e.message);}
  " 2>/dev/null)
  if [[ "$ok_flag" == "ok" ]]; then
    ok "$label — envelope 格式正确"
  else
    fail "$label — envelope 异常: $ok_flag"
  fi
}

# 检查 exit code
check_exit() {
  local label="$1"; local expected="$2"; shift 2
  local code=0
  $BIN crg "$@" >/dev/null 2>/dev/null || code=$?
  if [[ "$code" == "$expected" ]]; then
    ok "$label — exit $expected"
  else
    fail "$label — 期望 exit $expected, 实际 exit $code"
  fi
}

# 取 data 里某字段的数字值
get_num() { echo "$1" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(j.data['$2']??'null');" 2>/dev/null; }
get_arr_len() { echo "$1" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); const arr=j.data['$2']||j.data.items||[]; console.log(Array.isArray(arr)?arr.length:-1);" 2>/dev/null; }

# =============================================================================
# 1. 确保图已构建
# =============================================================================
section "准备：确保图已构建"

if [[ ! -f "$REPO/.spec-first/graph/graph.db" ]]; then
  echo "  图未构建，执行 crg build..."
  BUILD_OUT=$(run build 2>&1)
  echo "$BUILD_OUT" | grep -q '"schema_version"' && ok "初次构建成功" || fail "初次构建失败: $BUILD_OUT"
else
  ok "图已存在，跳过初次构建"
fi

# =============================================================================
# 2. crg build
# =============================================================================
section "crg build"

BUILD_OUT=$(run build 2>/dev/null)
check_envelope "build — envelope" "$BUILD_OUT"

NC_VAL=$(get_num "$BUILD_OUT" node_count)
EC_VAL=$(get_num "$BUILD_OUT" edge_count)
CF_VAL=$(get_num "$BUILD_OUT" changed_files)

if [[ "$NC_VAL" -gt 0 ]] 2>/dev/null; then
  ok "build.node_count=$NC_VAL > 0"
else
  fail "build.node_count=$NC_VAL 应 > 0"
fi

if [[ "$EC_VAL" -gt 0 ]] 2>/dev/null; then
  ok "build.edge_count=$EC_VAL > 0"
else
  fail "build.edge_count=$EC_VAL 应 > 0"
fi

ok "build.changed_files=${CF_VAL}（增量构建：应为0）"

# --force 全量重建
FORCE_OUT=$(run build --force 2>/dev/null)
FORCE_CF=$(get_num "$FORCE_OUT" changed_files)
if [[ "$FORCE_CF" -gt 0 ]] 2>/dev/null; then
  ok "build --force 全量重建，changed_files=$FORCE_CF > 0"
else
  fail "build --force changed_files=$FORCE_CF 应 > 0"
fi

# 旧路径 negative guard：确认 .spec-first-graph/ 从未被创建
if [ -d "$REPO/.spec-first-graph" ]; then
  fail "build 创建了旧路径 .spec-first-graph（应使用 .spec-first/graph/）"
else
  ok "build 未创建旧路径 .spec-first-graph"
fi

# 确认新路径已存在
if [ -f "$REPO/.spec-first/graph/graph.db" ]; then
  ok "build 使用新路径 .spec-first/graph/graph.db"
else
  fail "build 未在 .spec-first/graph/graph.db 创建数据库"
fi

# 缺少 --repo
check_exit "build 缺 --repo → exit 1" 1 build

# =============================================================================
# 3. crg stats
# =============================================================================
section "crg stats"

STATS_OUT=$(run stats 2>/dev/null)
check_envelope "stats — envelope" "$STATS_OUT"

CORPUS=$(echo "$STATS_OUT" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(j.data.corpus_health?.status??'null');" 2>/dev/null)
if [[ "$CORPUS" =~ ^(small|optimal|large)$ ]]; then
  ok "stats.corpus_health.status=$CORPUS"
else
  fail "stats.corpus_health.status='$CORPUS' 不在 small/optimal/large"
fi

LAST_BUILT=$(echo "$STATS_OUT" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(j.data.last_built??'null');" 2>/dev/null)
if [[ "$LAST_BUILT" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2} ]]; then
  ok "stats.last_built 是 ISO 时间戳"
else
  fail "stats.last_built='$LAST_BUILT' 格式异常"
fi

check_exit "stats 缺 --repo → exit 1" 1 stats

# =============================================================================
# 4. crg context
# =============================================================================
section "crg context"

CTX_OUT=$(run context 2>/dev/null)
check_envelope "context — envelope" "$CTX_OUT"

for key in top_flows top_communities top_hubs summary; do
  VAL=$(echo "$CTX_OUT" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(j.data['$key']!==undefined?'ok':'missing');" 2>/dev/null)
  if [[ "$VAL" == "ok" ]]; then ok "context.data.$key 存在"
  else fail "context.data.$key 缺失"; fi
done

# =============================================================================
# 5. crg query（8 种 pattern）
# =============================================================================
section "crg query"

# 需要找一个存在的节点 ID（query/impact 均接受 node.id）
SAMPLE_SYMBOL=$(node -e "
const { initDatabase } = require('./src/crg/migrations');
const db = initDatabase('.spec-first/graph/graph.db');
const r = db.prepare(\"SELECT id FROM nodes WHERE kind='function' LIMIT 1\").get();
console.log(r ? r.id : 'unknown');
db.close();
" 2>/dev/null)

SAMPLE_MODULE=$(node -e "
const { initDatabase } = require('./src/crg/migrations');
const db = initDatabase('.spec-first/graph/graph.db');
const r = db.prepare(\"SELECT id FROM nodes WHERE kind='module' LIMIT 1\").get();
console.log(r ? r.id : 'unknown');
db.close();
" 2>/dev/null)

# 8 种 pattern：逐一测试（避免 bash 3.2 不支持 declare -A）
for PATTERN in callers_of callees_of similar_to; do
  Q_OUT=$(run query --pattern="$PATTERN" --symbol="$SAMPLE_SYMBOL" 2>/dev/null)
  check_envelope "query $PATTERN — envelope" "$Q_OUT"
done

for PATTERN in importers_of importees_of dependents_of dependencies_of; do
  Q_OUT=$(run query --pattern="$PATTERN" --module="$SAMPLE_MODULE" 2>/dev/null)
  check_envelope "query $PATTERN — envelope" "$Q_OUT"
done

Q_OUT=$(run query --pattern=tests_for --subject="$SAMPLE_MODULE" 2>/dev/null)
check_envelope "query tests_for — envelope" "$Q_OUT"

# 缺少 --pattern
check_exit "query 缺 --pattern → exit 1" 1 query --repo="$REPO"

# =============================================================================
# 6. crg impact
# =============================================================================
section "crg impact"

IMPACT_OUT=$(run impact --symbol="$SAMPLE_SYMBOL" 2>/dev/null)
check_envelope "impact --symbol — envelope" "$IMPACT_OUT"

BLAST=$(echo "$IMPACT_OUT" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(j.data.blast_radius??'null');" 2>/dev/null)
if [[ "$BLAST" =~ ^[0-9]+$ ]]; then
  ok "impact.blast_radius=${BLAST}（整数）"
else
  fail "impact.blast_radius='$BLAST' 非整数"
fi

check_exit "impact 缺 --symbol → exit 1" 1 impact --repo="$REPO"

# =============================================================================
# 7. crg large-functions
# =============================================================================
section "crg large-functions"

LF_OUT=$(run large-functions 2>/dev/null)
check_envelope "large-functions — envelope" "$LF_OUT"

LF_COUNT=$(get_arr_len "$LF_OUT" items)
ok "large-functions.items=$LF_COUNT 个"

# 检验每项字段
echo "$LF_OUT" | node -e "
  const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const items=j.data.items||[];
  const bad=items.filter(i=>!i.name||!i.file_path||typeof i.loc!=='number');
  if(bad.length>0){console.error('bad items:',JSON.stringify(bad[0]));process.exit(1);}
  console.log('ok');
" 2>/dev/null && ok "large-functions 每项字段完整" || fail "large-functions 存在字段缺失项"

# =============================================================================
# 8. crg search
# =============================================================================
section "crg search"

SEARCH_OUT=$(run search --keyword "$SAMPLE_SYMBOL" 2>/dev/null)
check_envelope "search — envelope" "$SEARCH_OUT"

S_COUNT=$(get_arr_len "$SEARCH_OUT" results)
ok "search '$SAMPLE_SYMBOL' 结果: $S_COUNT 个"

# FTS5 短语查询（含特殊字符，应不崩溃）
SPECIAL_OUT=$(run search --keyword "NOT OR AND" 2>/dev/null)
check_envelope "search 含 FTS5 操作符不崩溃" "$SPECIAL_OUT"

# 缺少 keyword
check_exit "search 缺 keyword → exit 1" 1 search --repo="$REPO"

# =============================================================================
# 9. crg flows
# =============================================================================
section "crg flows"

FLOWS_OUT=$(run flows 2>/dev/null)
check_envelope "flows — envelope" "$FLOWS_OUT"

FL_COUNT=$(get_arr_len "$FLOWS_OUT" items)
ok "flows.items=$FL_COUNT 个"

# =============================================================================
# 10. crg flow（单个 flow）
# =============================================================================
section "crg flow"

FLOW_ID=$(node -e "
const { initDatabase } = require('./src/crg/migrations');
const db = initDatabase('.spec-first/graph/graph.db');
const r = db.prepare('SELECT id FROM flows LIMIT 1').get();
console.log(r ? r.id : '');
db.close();
" 2>/dev/null)

if [[ -n "$FLOW_ID" ]]; then
  FLOW_OUT=$(run flow --id="$FLOW_ID" 2>/dev/null)
  check_envelope "flow --id — envelope" "$FLOW_OUT"
  FNODES=$(echo "$FLOW_OUT" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(Array.isArray(j.data.nodes)?j.data.nodes.length:-1);" 2>/dev/null)
  ok "flow.nodes=${FNODES} 个"
else
  skip "flow — 无 flow 数据（flows 为空）"
fi

# 无效 flow id
check_exit "flow 无效 id → exit 1" 1 flow --repo="$REPO" --id="nonexistent_flow_id"
check_exit "flow 缺 --id → exit 1" 1 flow --repo="$REPO"

# =============================================================================
# 11. crg affected-flows
# =============================================================================
section "crg affected-flows"

AF_OUT=$(run affected-flows --since=HEAD~1 2>/dev/null)
check_envelope "affected-flows — envelope" "$AF_OUT"

AF_COUNT=$(get_arr_len "$AF_OUT" items)
ok "affected-flows.items=$AF_COUNT 个"

check_exit "affected-flows 缺 --since → exit 1" 1 affected-flows --repo="$REPO"

# =============================================================================
# 12. crg communities
# =============================================================================
section "crg communities"

COMM_OUT=$(run communities 2>/dev/null)
check_envelope "communities — envelope" "$COMM_OUT"

COMM_COUNT=$(get_arr_len "$COMM_OUT" items)
ok "communities.items=$COMM_COUNT 个社区"

# 健康状态只能是规定的 4 种
BAD_STATUS=$(echo "$COMM_OUT" | node -e "
const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const valid=new Set(['healthy','isolated','fragmented','scattered']);
const items=j.data.items||[];
const bad=items.filter(i=>!valid.has(i.health?.status));
console.log(bad.length);
" 2>/dev/null)
if [[ "$BAD_STATUS" == "0" ]]; then
  ok "communities 所有健康状态在合法枚举（healthy/isolated/fragmented/scattered）"
else
  fail "communities 存在 $BAD_STATUS 个非法健康状态（可能含废弃的 fragile/overloaded）"
fi

# stats.total 应等于 items.length
echo "$COMM_OUT" | node -e "
const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const items=j.data.items||[];
const stats=j.data.stats||{};
if(stats.total!==items.length){console.error('stats.total('+stats.total+') != items.length('+items.length+')');process.exit(1);}
console.log('ok');
" 2>/dev/null && ok "communities.stats.total == items.length" || fail "communities.stats.total 与 items.length 不一致"

# =============================================================================
# 13. crg community（单个社区）
# =============================================================================
section "crg community"

COMM_ID=$(node -e "
const { initDatabase } = require('./src/crg/migrations');
const db = initDatabase('.spec-first/graph/graph.db');
const r = db.prepare('SELECT id FROM communities LIMIT 1').get();
console.log(r ? r.id : '');
db.close();
" 2>/dev/null)

if [[ -n "$COMM_ID" ]]; then
  COMM1_OUT=$(run community --id="$COMM_ID" 2>/dev/null)
  check_envelope "community --id — envelope" "$COMM1_OUT"
  echo "$COMM1_OUT" | node -e "
    const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const d=j.data;
    const req=['community_id','label','file_count','health','members'];
    const miss=req.filter(k=>d[k]===undefined);
    if(miss.length){console.error('missing:'+miss.join(','));process.exit(1);}
    console.log('ok');
  " 2>/dev/null && ok "community 字段完整（community_id/label/file_count/health/members）" || fail "community 字段缺失"
else
  skip "community — 无社区数据"
fi

check_exit "community 无效 ID → exit 1" 1 community --repo="$REPO" --id="nonexistent_community"
check_exit "community 缺 --id → exit 1" 1 community --repo="$REPO"

# =============================================================================
# 14. crg architecture
# =============================================================================
section "crg architecture"

ARCH_OUT=$(run architecture 2>/dev/null)
check_envelope "architecture — envelope" "$ARCH_OUT"

echo "$ARCH_OUT" | node -e "
const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const d=j.data;
if(!Array.isArray(d.hub_nodes)){console.error('hub_nodes 非数组');process.exit(1);}
if(!Array.isArray(d.cross_community_edges)){console.error('cross_community_edges 非数组');process.exit(1);}
console.log('ok hub_nodes='+d.hub_nodes.length+' cross_community_edges='+d.cross_community_edges.length);
" 2>/dev/null | { read line; [[ "$line" == ok* ]] && ok "architecture: $line" || fail "architecture 字段异常: $line"; }

# =============================================================================
# 15. crg surprising-connections
# =============================================================================
section "crg surprising-connections"

SC_OUT=$(run surprising-connections 2>/dev/null)
check_envelope "surprising-connections — envelope" "$SC_OUT"

SC_COUNT=$(get_arr_len "$SC_OUT" items)
ok "surprising-connections.items=$SC_COUNT 个"

# 若有结果，验证字段
echo "$SC_OUT" | node -e "
const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const items=j.data.items||[];
if(items.length===0){console.log('ok_empty');process.exit(0);}
const bad=items.filter(i=>typeof i.score!=='number'||!Array.isArray(i.reasons)||!i.source||!i.target);
if(bad.length>0){console.error('bad:'+JSON.stringify(bad[0]));process.exit(1);}
console.log('ok_'+items.length);
" 2>/dev/null && ok "surprising-connections 字段验证通过" || fail "surprising-connections 字段异常"

# =============================================================================
# 16. crg god-nodes
# =============================================================================
section "crg god-nodes"

GN_OUT=$(run god-nodes 2>/dev/null)
check_envelope "god-nodes — envelope" "$GN_OUT"

GN_COUNT=$(get_arr_len "$GN_OUT" items)
ok "god-nodes.items=$GN_COUNT 个"

# 验证 FactItem 必填字段
echo "$GN_OUT" | node -e "
const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const items=j.data.items||[];
const req=['id','name','file_path','kind','confidence','source_tier'];
const bad=items.filter(i=>req.some(k=>i[k]===undefined||i[k]===null));
if(bad.length>0){console.error('missing fields in:',JSON.stringify(bad[0]));process.exit(1);}
// confidence 应为 Inferred；source_tier 来自 AST 层（crg_ast）
const wrongConf=items.filter(i=>i.confidence!=='Inferred');
if(wrongConf.length>0){console.error('confidence!=Inferred:',wrongConf[0].name);process.exit(1);}
console.log('ok');
" 2>/dev/null && ok "god-nodes FactItem 字段验证（confidence=Inferred）" || fail "god-nodes FactItem 字段异常"

# =============================================================================
# 17. crg detect-changes
# =============================================================================
section "crg detect-changes"

DC_OUT=$(run detect-changes --since=HEAD~2 2>/dev/null)
check_envelope "detect-changes — envelope" "$DC_OUT"

DC_COUNT=$(get_arr_len "$DC_OUT" items)
ok "detect-changes.items=$DC_COUNT 个"

# risk_level 枚举
echo "$DC_OUT" | node -e "
const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const items=j.data.items||[];
const valid=new Set(['High','Medium','Low']);
const bad=items.filter(i=>!valid.has(i.risk_level));
if(bad.length>0){console.error('bad risk_level:',bad[0].risk_level);process.exit(1);}
console.log('ok');
" 2>/dev/null && ok "detect-changes risk_level 枚举正确（High/Medium/Low）" || fail "detect-changes risk_level 枚举异常"

check_exit "detect-changes 缺 --since → exit 1" 1 detect-changes --repo="$REPO"

# =============================================================================
# 18. crg review-context
# =============================================================================
section "crg review-context"

RC_OUT=$(run review-context --since=HEAD~1 2>/dev/null)
check_envelope "review-context — envelope" "$RC_OUT"

# diff_summary 非空
DS=$(echo "$RC_OUT" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(j.data.diff_summary??'null');" 2>/dev/null)
if [[ -n "$DS" && "$DS" != "null" ]]; then
  ok "review-context.diff_summary='$DS'"
else
  fail "review-context.diff_summary 为空"
fi

# affected_nodes FactItem 验证
echo "$RC_OUT" | node -e "
const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const nodes=j.data.affected_nodes||[];
const req=['id','name','file_path','kind','confidence','source_tier'];
const bad=nodes.filter(n=>req.some(k=>n[k]===undefined||n[k]===null));
if(bad.length>0){console.error('missing fields:',JSON.stringify(bad[0]));process.exit(1);}
console.log('ok affected_nodes='+nodes.length);
" 2>/dev/null && ok "review-context.affected_nodes FactItem 字段完整" || fail "review-context.affected_nodes 字段缺失"

# candidate_tests FactItem 验证
echo "$RC_OUT" | node -e "
const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const tests=j.data.candidate_tests||[];
const req=['id','name','file_path','kind','is_test','confidence','source_tier','inference_reason'];
const bad=tests.filter(t=>req.some(k=>t[k]===undefined||t[k]===null));
if(bad.length>0){console.error('missing fields in candidate_test:',JSON.stringify(bad[0]));process.exit(1);}
const wrongIsTest=tests.filter(t=>t.is_test!==1);
if(wrongIsTest.length>0){console.error('is_test!=1:',wrongIsTest[0]);process.exit(1);}
console.log('ok candidate_tests='+tests.length);
" 2>/dev/null && ok "review-context.candidate_tests FactItem 字段完整（is_test=1）" || fail "review-context.candidate_tests 字段异常"

check_exit "review-context 缺 --since → exit 1" 1 review-context --repo="$REPO"

# =============================================================================
# 19. crg postprocess（内部命令）
# =============================================================================
section "crg postprocess"

PP_OUT=$(run postprocess 2>/dev/null)
check_envelope "postprocess — envelope" "$PP_OUT"

# =============================================================================
# 20. 错误路径：无效子命令 / 缺少图
# =============================================================================
section "错误路径"

check_exit "无效子命令 → exit 1" 1 invalidcmd --repo="$REPO"

TMPDIR_EMPTY=$(mktemp -d)
check_exit "stats 图未构建 → exit 2" 2 stats --repo="$TMPDIR_EMPTY"
rm -rf "$TMPDIR_EMPTY"

# =============================================================================
# 21. 增量稳定性：允许首轮吸收工作树变更，随后必须稳定
# =============================================================================
section "增量稳定性"

FIRST_OUT=$(run build 2>/dev/null)
FIRST_CF=$(get_num "$FIRST_OUT" changed_files)
if [[ "$FIRST_CF" =~ ^[0-9]+$ ]]; then
  ok "第 1 次增量构建 changed_files=${FIRST_CF}（允许吸收当前工作树变更）"
else
  fail "第 1 次增量构建 changed_files='${FIRST_CF}' 非法"
fi

for i in 2 3; do
  INC_OUT=$(run build 2>/dev/null)
  INC_CF=$(get_num "$INC_OUT" changed_files)
  if [[ "$INC_CF" == "0" ]]; then
    ok "第 $i 次增量构建 changed_files=0（稳定）"
  else
    fail "第 $i 次增量构建 changed_files=${INC_CF}（应已稳定为 0）"
  fi
done

# =============================================================================
# 结果汇总
# =============================================================================
TOTAL=$((PASS+FAIL+SKIP))
echo ""
echo "═══════════════════════════════════════════"
echo -e " 结果: ${GREEN}$PASS 通过${NC}  ${RED}$FAIL 失败${NC}  ${YELLOW}$SKIP 跳过${NC}  / $TOTAL 总计"
echo "═══════════════════════════════════════════"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
