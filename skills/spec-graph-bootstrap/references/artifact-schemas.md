# Stage-0 产物 JSON 字段定义

本文件定义 bootstrap 控制面主 JSON 文件与 `artifact-manifest.json` 的完整字段 contract。

## fact-inventory.json

```yaml
schema_version: "v1"
analyzer_mode: full | enhanced | basic
graph_support_state: local-available | crg-not-indexed | crg-cli-unavailable | unavailable
# ↑ 与 Phase 0.4 判定结果一致，注入 injection-index.yaml 中 fact.graph_support_state 条件所需
generated_at: <ISO>
source_snapshot:
  crg_last_built: <data.last_built>   # Enhanced/Basic 模式填 null
  repo_head_commit: <git HEAD>
project_identity: { name, primary_language, primary_frameworks, repo_shape }
entrypoints: [{ path, symbol, kind, summary, confidence, inference_reason, evidence, updated_at }]
modules: [{ path, name, responsibility, community_id, confidence, inference_reason, evidence, updated_at }]
integrations: [{ path, symbol, kind, summary, confidence: inferred, inference_reason, evidence, updated_at }]
testing_surface: [{ test_path, test_symbol, target_path, target_symbol, test_kind, confidence, inference_reason, evidence, updated_at }]
data_shapes: [{ path, symbol, kind, summary, confidence: inferred, inference_reason, evidence, updated_at }]
layers: { frontend: { present, confidence, inference_reason, evidence, updated_at }, ... }
database: [{ present, connection_name, config_source, db_type, database_name_guess, credential_keys, static_access_hints, confidence, inference_reason, evidence }]
# 只表达静态候选发现，不写 secret 值、probe 历史、fallback 历史
# static_access_hints: ["cli"] 等静态提示；真正的 route / fallback / provenance 收口在 database-routing.json
```

## database-routing.json

```yaml
schema_version: "v1"
generated_at: <ISO>
candidate_connections:
  - connection_name: string
    db_type: string
    config_source: string
    database_name_guess: string | null
    credential_keys: [string]
    static_access_hints: [string]
    confidence: string
    inference_reason: string
    evidence: [string]
secret_resolution:
  - connection_name: string
    status: resolved | partial | missing | not-required
    required_credential_keys: [string]
    resolved_credential_keys: [string]
    missing_credential_keys: [string]
    provenance: process.env | other-runtime
probe_attempts:
  - connection_name: string
    route: mcp | cli
    status: ready | blocked | unavailable | skipped
    reason: string
route_decisions:
  - connection_name: string
    selected_route: mcp | cli | null
    decision: selected | blocked
    fallback_reason: string | null
    provenance: [string]
selected_connections:
  - connection_name: string
    route: mcp | cli
    db_type: string
    config_source: string
generation_blockers:
  - connection_name: string
    stage: route-selection | generation
    reason: string
# secret 解析只写 key 名与状态，不落密码、连接串或用户名明文
```

## risk-signals.json

```yaml
schema_version: "v1"
generated_at: <ISO>
signals: [{ path, symbol, kind, summary, severity, confidence, inference_reason, evidence, updated_at }]
crg_metrics:
  # Full 模式：所有字段由 crg god-nodes / crg large-functions / crg stats 填充
  # Enhanced/Basic 模式：total_nodes/total_edges/avg_fan_out 填 null；top_hubs/largest_functions 填 []
  total_nodes: <N> | null
  total_edges: <M> | null
  avg_fan_out: <M/N> | null
  top_hubs: [{ id, name, file_path, kind, in_degree, confidence, inference_reason, evidence, updated_at }]  # crg god-nodes；confidence: Inferred；非 Full 模式填 []
  largest_functions: [{ id, name, file_path, kind, loc }]  # 非 Full 模式填 []
  # 字段值为 null/[] 时，必须在 generation_errors[] 中记录原因（如 "crg not indexed"）
```

## test-surface.json

```yaml
schema_version: "v1"
generated_at: <ISO>
test_files:
  - path: string
    kind: unit | integration | e2e | smoke
    targets: [string]           # 推断的被测目标文件路径列表
    summary: string             # 简要描述（如 "Integration tests for database layer"）
    confidence: Observed | Inferred
    inference_reason: string | null   # Inferred 时必填
    evidence: [string]          # 分类依据（路径特征、import 来源等）
    updated_at: <ISO>
coverage_gaps:
  - path: string
    symbol: string
    severity: high | medium     # 不产生 low；不满足阈值的节点不录入
    summary: string             # 简要描述（如 "No test file imports this module"）
    confidence: Observed | Inferred
    inference_reason: string    # 必填（Full: "crg-blast-radius-threshold"; Enhanced: "directory-naming-pattern" 等）
    evidence: [string]          # 判断为 gap 的依据；必须非空，无直接证据时填 ["no-direct-evidence"]
    updated_at: <ISO>
# Full 模式独有字段（Enhanced/Basic 填 null）
crg_tests_for_count: <N> | null    # tests_for 查询汇总
tested_by_coverage: <float> | null # 有 imports_from+is_test=1 覆盖的非测试节点 / 总非测试节点
```

## artifact-manifest.json

### 第一次写入（Phase 0 完成后）

```yaml
schema_version: "v1"
generated_at: <now>
updated_at: <now>
status: in_progress   # complete 在 Phase 3 结束时写入；中断重跑从 Phase 0 重新开始（设计决策：幂等优于断点续传）
inputs:
  crg:
    graph_last_built: <data.last_built>   # crg stats 返回
    node_count: <N>
    edge_count: <M>
    last_build_commit: <git rev-parse HEAD>  # 失败时填 null
  files:
    "package.json": "<sha256>"   # Read 后计算
    # 关键配置文件 SHA
  analyzer_versions:
    crg: "v1"
    entrypoints: "v1"
    module_structure: "v1"
    test_surface: "v1"
    risk_signals: "v1"
      schema_versions:
        fact_inventory: "v1"
        database_routing: "v1"
        risk_signals: "v1"
        test_surface: "v1"
# 首次写入时均为空，Phase 3 database worker 完成后回填
table_hashes: {}          # { "<table_name>": "sha256:<hex>" } — SHOW CREATE TABLE 内容的 SHA256
domain_assignments: {}    # { "<table_name>": "<domain_name>" } — 稳定域分配，写入后不再重聚类
```

### 第二次写入（Phase 3 全部完成时）

```yaml
# 写法：Read manifest（database worker Step 6 已写入 table_hashes/domain_assignments）→ 深合并以下字段 → Write
# Step 6 写入的 table_hashes / domain_assignments 在此步骤中保持不变，不得覆盖
status: complete
updated_at: <now>
outputs:
  "architecture/module-map.md":
    depends_on: ["schema:fact_inventory@v1", "analyzer:module_structure@v1", "analyzer:data_shapes@v1"]
  # ... 其余产物 depends_on 清单
```
