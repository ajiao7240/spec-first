---
name: spec-graph-bootstrap
description: "Graph-informed project bootstrap. Runs Phase 0–4: CRG readiness detection → AST-grade fact extraction (fact-inventory.json / risk-signals.json / test-surface.json) → task planning → document generation → route generation."
---

# Spec-First Graph Bootstrap

`spec-graph-bootstrap` 是 graph-informed 的项目上下文生成工作流，以 CRG CLI（`spec-first crg`）为 Tier 1 工具，输出 Observed 事实优先的控制面产物。

## 调用方式

```
/spec:graph-bootstrap [target-repo-path]
```

`target-repo-path` 省略时取当前工作目录。

## 缺失运行时时的处理

如果当前运行时中缺少此文件，先执行：

```bash
spec-first init --claude   # Claude 运行时
spec-first init --codex    # Codex 运行时
```

---

## Phase 0：就绪探测与模式判定

### 0.1 Slug 生成（最先执行，后续所有路径使用同一值）

```
slug = basename(resolve(target))  # 特殊字符替换为 -
```

立即告知用户：
```
📁 Slug: <slug>
   产物路径: .spec-first/workflows/bootstrap/<slug>/
             docs/contexts/<slug>/
```

### 0.2 MCP 就绪探测（沿用 spec-bootstrap）

- Step 0: 宿主选择（Claude / Codex）
- Step 1: mcp-setup marker 检测
- Step 2: Serena MCP probe → `serena.ready = true/false`

### 0.2b CRG CLI 就绪检查（新增）

读取当前宿主的 `host-setup.json`（路径来自 0.2 Step 1 的 marker 路径）。

```
Read host-setup.json

If version >= "5" and crg block exists:
  If crg.cli_available == false:
    → crg.indexed = false（直接跳过所有 CRG 操作）
    → graph_support_state = "crg-cli-unavailable"
    → 跳到 0.4 模式判定（降级到 Enhanced/Basic）
    → 打印: "CRG CLI 不可用 (host-setup.json: crg.cli_available=false)"

  If crg.cli_available == true and crg.native_modules == "missing":
    → 打印: "⚠️ CRG CLI 可用但原生模块缺失 (better-sqlite3/tree-sitter), 图构建可能失败"
    → 继续到 0.3 执行 DB 检测，但预期 crg stats 可能 exit 2

If version < "5" or crg block 不存在:
    → 按现有逻辑继续（不阻断，直接执行 0.3 DB 检测）
```

### 0.3 CRG 图状态检测

```
[1] DB 不存在（<target>/.spec-first/graph/graph.db）
    → crg.indexed = false → 跳到 3b

[2] DB 存在 → Bash: spec-first crg stats --repo=<target>

    [2a] 非零退出 或 envelope.degraded=true
         → crg.indexed = false → 打印 warnings → 跳到 3b

    [2b] node_count=0 且 edge_count=0
         → crg.indexed = false → 跳到 3b

    [2c] node_count > 0
         → crg.indexed = true
         → 记录 data.last_built, data.node_count, data.edge_count
         → 跳到 3c（stale 检测）

3b. 提示用户构建：
    "检测到 spec-first crg CLI 可用，但当前项目尚未构建图索引（或图为空）。
     是否现在构建？（普通项目 2-5 分钟，大型 monorepo 可达 10 分钟）"

    用户选「是」→ Bash: spec-first crg build --repo=<target>
                   成功 → crg.indexed=true，进入 3c
                   失败/超时>10min → crg.indexed=false，降级，写 generation_errors
    用户选「否」→ crg.indexed=false → 降级到 Enhanced/Basic

3c. Stale 检测（artifact-manifest.json 存在时执行）：
    对比 artifact-manifest.json.inputs.crg.graph_last_built vs 当前 crg stats data.last_built
    对比 inputs.files 中关键文件 SHA
    → 不一致：打印 ⚠️ stale 警告（不阻断流程）
```

### 0.4 分析模式判定

```
crg.indexed=true           → mode=Full,     graph_support_state=local-available,      code_facts_confidence=high
serena.ready=true          → mode=Enhanced, graph_support_state=crg-not-indexed,     code_facts_confidence=medium
crg-cli-unavailable        → mode=Enhanced, graph_support_state=crg-cli-unavailable, code_facts_confidence=medium (serena.ready=true)
                           → mode=Basic,    graph_support_state=crg-cli-unavailable, code_facts_confidence=low   (serena.ready=false)
else                       → mode=Basic,    graph_support_state=unavailable,          code_facts_confidence=low
```

### 0.5 探测输出格式

```
🔍 检测项目工具就绪状态...

CRG:      indexed=yes, nodes=<N>, edges=<M>, last_built=<T>
Serena:   ready=yes/no

📊 分析模式: Full/Enhanced/Basic | Code Facts: high/medium/low | Graph Support: <state>
```

### 0.6 Phase 0 完成后写入 artifact-manifest.json（第一次写入）

路径：`.spec-first/workflows/bootstrap/<slug>/artifact-manifest.json`

```yaml
schema_version: "v1"
generated_at: <now>
updated_at: <now>
status: in_progress
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
    risk_signals: "v1"
    test_surface: "v1"
```

### 0.7 Rerun Backup（阶段2范围内必须支持）

如果 `docs/contexts/<slug>/` 已存在，在 **任何 Phase 3 写入开始前**：

- 备份到 `.spec-first/workflows/bootstrap/<slug>/backup_<ISO-timestamp>/`
- **校验备份**：统计原目录文件数与 backup 中文件数；不一致则停止并报告错误，不进入 Phase 3
- 如果目录不存在：跳过 backup，继续执行

失败恢复与清理：

- Phase 3 全部成功：成功后删除 backup 目录
- Phase 3 任一固定 v1 产物写入失败（`00-summary.md` / `architecture/module-map.md` / `pitfalls/index.md` / `code-facts/*` / `context-packs/review-change.md` / `README.md` / `injection-index.yaml`）：
  - 立即用 backup 全量恢复 `docs/contexts/<slug>/`
  - 写入 `generation_errors`
  - 停止流程，不得保留半覆盖状态

约束：

- 不允许静默覆盖旧上下文
- 不允许在 backup 校验失败后继续渲染文档
- backup 只保护 `docs/contexts/<slug>/`；控制面 `.spec-first/workflows/bootstrap/<slug>/` 按本次运行结果覆盖

---

## Phase 1：事实抽取（Full 模式 CRG CLI 路径）

> **并行语义**：同一 Stage 内的所有 Bash 调用在同一 response 内批量发出（Claude 原生并行）。Stage 间有数据依赖，必须顺序执行。

### 1.0 前置触发（单独一步，先于所有 Stage）

```bash
spec-first crg context --repo=<target>
```

读取 `data.top_flows`、`data.top_communities`、`data.top_hubs`，确定后续 Stage 优先级。

> 字段注意：`crg context` 与 `crg flows` 均返回 `flow_id` 字段（非 `id`），直接传给 `crg flow --id=<flow_id>` 即可。

### 1.1 Stage A（同一 response 内并行）

#### 4.2 Project Identity
```bash
spec-first crg stats --repo=<target>
Read(<target>/package.json)  # 或 go.mod / pom.xml 等主配置文件
```
输出 → `fact-inventory.project_identity`：`name`, `primary_language`, `primary_frameworks`, `repo_shape`

#### 4.8 Data Shapes（FTS5 多词须独立调用，不得合并）
```bash
spec-first crg search "schema"     --repo=<target>
spec-first crg search "entity"     --repo=<target>
spec-first crg search "model"      --repo=<target>
spec-first crg search "dto"        --repo=<target>
spec-first crg search "migration"  --repo=<target>
spec-first crg search "validation" --repo=<target>
```
对 `kind=class|interface|struct` 的候选节点：`Read(<node.file_path>)` 提取字段列表（替代 children_of）。
输出 → `fact-inventory.data_shapes`

**kind 分类规则**（`inference_reason: "crg-semantic-search-evidence"`）：
- 命中 `migration` + 文件名含数字前缀/`migrate` → `migration`
- 命中 `schema` + class/interface → `schema`
- 命中 `dto` + 名称含 Dto/DTO/Request/Response → `dto`
- 命中 `entity`/`model` + class + 名称含 Entity/Model → `entity`
- 命中 `validation` + 名称含 Validator/Validation → `validation`
- 其余 → `schema`（兜底）

#### 4.9 Layer Detection
对每层并行 `crg search "<框架特征 API>" --repo=<target>`（同一 response 内）：
- frontend(React): `useState` / `useEffect` / `JSX`
- frontend(Vue): `defineComponent` / `createApp`
- frontend(Angular): `Injectable` / `Component` / `NgModule`
- backend(Express): `router` / `middleware` / `app.listen`
- backend(FastAPI): `APIRouter` / `Depends` / `HTTPException`
- backend(Django): `urlpatterns` / `views` / `models.Model`
- mobile(Android): `Activity` / `Fragment` / `ViewModel`
- mobile(iOS): `UIViewController` / `SwiftUI` / `UIView`
- desktop(Electron): `BrowserWindow` / `ipcMain`
- cli: `commander` / `yargs` / `argparse` / `cobra`

判定（按优先级）：crg search ≥1 → `observed`；0 但 package.json 有依赖 → `observed`；目录模式匹配 → `inferred`；无 → `unknown`。

输出 → `fact-inventory.layers`

#### 4.10 Database Detection
沿用 spec-bootstrap Phase 1.5（Glob + Read）。

### 1.2 Stage B-Round1（依赖 Stage A，同一 response 内并行）

#### 4.3 Entrypoints（Round1：获取 flow 列表）
```bash
spec-first crg flows --repo=<target>
```
记录 `data.items[]`：`{flow_id, entry_node, criticality, node_count}`（无 `name` 字段，字段名为 `flow_id` 非 `id`）。

#### 4.4 Module Structure（Round1：获取社区列表 + 架构）
```bash
spec-first crg communities --repo=<target>
spec-first crg architecture --repo=<target>
```
记录 `data.items[].community_id`（字符串，如 "tests"/"crg/1"）。

#### 4.5 Integration 预处理（Round1：缩小候选库名）
```bash
Read(<target>/package.json)  # 或 requirements.txt / go.mod / pom.xml
```
根据 `primary_language` 选取已知库名清单（按分类：database/cache/message_queue/http_client/auth）。

### 1.3 Stage B-Round2（依赖 B-Round1，同一 response 内并行）

#### 4.3 Entrypoints（Round2：深度，top-5 criticality 流）
```bash
spec-first crg flow --id=<id> --repo=<target>  # × top-5
```
`id` 来自 B-Round1 `crg flows` 的 `data.items[].flow_id`。

#### 4.4 Module Structure（Round2：社区深度）
```bash
spec-first crg community --id=<community_id> --repo=<target>  # × N
```
`community_id` 来自 B-Round1 `crg communities` 的 `data.items[].community_id`。
记录 `data.members[]`（含各节点的字符串 `id`（symbol_key 格式）、`name`、`file_path`）供 Stage C 使用。

输出 → `fact-inventory.modules`（每条附 `community_id`）

#### 4.5 Integration（Round2：获取库节点 ID）
```bash
spec-first crg search <lib> --repo=<target>  # × N（候选库名列表）
```
取 `data.results` 中精确匹配项的节点 `node_id`（字符串 symbol_key）；无结果则跳过 Round3，改用 Grep 回退。

### 1.4 Stage B-Round3（依赖 B-Round2，同一 response 内并行）

#### 4.5 Integration（Round3：importers）
```bash
spec-first crg query --pattern=importers_of --module=<lib_node_id> --repo=<target>  # × N
```
`--module` 须为 B-Round2 `crg search` 返回的**节点 ID 字符串**（symbol_key 格式），不接受库名等非 ID 字符串。

输出 → `fact-inventory.integrations`（`confidence: inferred`, `inference_reason: "crg-importers-evidence"`）

### 1.5 Stage C（依赖 B-Round3，同一 response 内并行）

#### 4.6 Test Surface
```bash
spec-first crg query --pattern=tests_for --subject=<member.id> --repo=<target>  # × ≤10
```
`--subject` 为 B-Round2 `crg community` 返回的 `data.members[].id`（字符串，symbol_key 格式）。

**test_kind 分类**（路径启发式，`inference_reason: "path-naming-pattern"`）：
- `file_path` 含 `e2e`/`end-to-end`/`playwright`/`cypress` → `e2e`
- `file_path` 含 `integration`/`api-test`/`contract` → `integration`
- 其余 → `unit`（兜底）

输出 → `fact-inventory.testing_surface` + `test-surface.json`

#### 4.7 Risk Signals
```bash
# 以下 4 条在同一 response 内并行发出
spec-first crg impact --symbol=<flow.entry_node> --depth=2 --repo=<target>  # × ≤5
spec-first crg large-functions --min-lines=100 --repo=<target>
spec-first crg god-nodes --repo=<target>
spec-first crg query --pattern=dependents_of --module=<core_shared_node_id> --repo=<target>  # × ≤5
```

`--symbol` 来自 B-Round1 `crg flows` 的 `data.items[].entry_node`（top-5 criticality，已是节点 ID 字符串）。
`core_shared_node_id`：从 B-Round2 `crg community` 成员中筛选 `file_path` 含 `core/`/`shared/`/`common/`/`util/` 的节点 id。

`coverage_gaps.severity` 判定（Full 模式）：
- `blast_radius ≥ 5` 且是高 criticality 流入口 → `high`
- `blast_radius ≥ 5` 但非高 criticality 入口 → `medium`
- 路径含 `core/`/`shared/`/`common/` 但 blast_radius 未达阈值 → `medium`

输出 → `risk-signals.json`（`signals` + `crg_metrics`）

### 1.6 写入控制面（所有 Stage 完成后）

写入路径：`.spec-first/workflows/bootstrap/<slug>/`

**写入顺序**：先写三个主文件，再写 artifact-manifest.json。

#### fact-inventory.json
```yaml
schema_version: "v1"
analyzer_mode: full | enhanced | basic
generated_at: <ISO>
source_snapshot:
  crg_last_built: <data.last_built>
  repo_head_commit: <git HEAD>
project_identity: { name, primary_language, primary_frameworks, repo_shape }
entrypoints: [{ path, symbol, kind, summary, confidence, inference_reason, evidence, updated_at }]
modules: [{ path, name, responsibility, community_id, confidence, inference_reason, evidence, updated_at }]
integrations: [{ path, symbol, kind, summary, confidence: inferred, inference_reason, evidence, updated_at }]
testing_surface: [{ test_path, test_symbol, target_path, target_symbol, test_kind, confidence, inference_reason, evidence, updated_at }]
data_shapes: [{ path, symbol, kind, summary, confidence: inferred, inference_reason, evidence, updated_at }]
layers: { frontend: { present, confidence, inference_reason, evidence, updated_at }, ... }
database: [{ db_type, present, confidence, inference_reason, evidence, updated_at }]
```

#### risk-signals.json
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

#### test-surface.json
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

**写入后校验**：
1. JSON 合法性检查
2. `schema_version` 字段存在
3. `analyzer_mode` 为 `full|enhanced|basic`
4. `coverage_gaps` 每条记录的 `evidence` 字段存在且非空；若无直接证据，必须填 `["no-direct-evidence"]`，不得留空数组
5. `coverage_gaps` 每条记录的 `severity` 必须为 `high` 或 `medium`，不得为 `low`
6. 校验失败 → 报告错误，不继续后续 Phase

**generation_errors 格式**（有错误时追加到顶层）：
```yaml
generation_errors:
  - extractor: string   # 如 "entrypoint_extractor"
    stage: A | B | C
    error: string
    affected_fields: [string]
    fallback_applied: bool
```

---

## Phase 2：任务规划（PRD task contracts）

**前置检查**：fact-inventory.json 存在且非空，否则停止。

- 为固定产物生成 PRD（带事实证据）：
  - `00-summary.md` ← `project_identity`
  - `architecture/module-map.md` ← `modules` + `data_shapes`
  - `pitfalls/index.md` ← `risk_signals` + `integrations`
  - `code-facts/public-entrypoints.md` ← `entrypoints`
  - `code-facts/test-map.md` ← `testing_surface` + `test-surface.json`
  - `code-facts/high-risk-modules.md` ← `risk_signals`
  - `context-packs/review-change.md` ← 静态组装（risk_signals high + test-surface coverage_gaps + entrypoints http/worker + integrations high-risk）
- 为条件产物（如 API 文档）判定是否创建 task

---

## Phase 3：文档生成（事实层 → 摘要层，不回扫源码）

输出目录：`docs/contexts/<slug>/`

**前置动作**：若目标目录已存在，先执行 `0.7 Rerun Backup`，backup 校验通过后才能继续。

**并行**（各 Worker 消费 fact-inventory.json）：
- `00-summary.md` ← `project_identity`
- `architecture/module-map.md` ← `modules` + `data_shapes`
- `pitfalls/index.md` ← `risk_signals` + `integrations`
- `code-facts/public-entrypoints.md` ← `entrypoints`
- `code-facts/test-map.md` ← `testing_surface` + `test-surface.json`
- `code-facts/high-risk-modules.md` ← `risk_signals`
- `context-packs/review-change.md` ← 静态组装（不调用 `crg review-context`，后者是 diff-based 按需工具）

**串行（最后）**：
- `README.md`（上下文控制台，汇总所有产物状态）

**artifact-manifest.json 第二次写入**（所有产物生成后）：
```yaml
status: complete
updated_at: <now>
outputs:
  "architecture/module-map.md":
    depends_on: ["schema:fact_inventory@v1", "analyzer:module_structure@v1", "analyzer:data_shapes@v1"]
  # ... 其余产物 depends_on 清单
```

**收尾**：
- 若本次创建了 backup，且 Phase 3 / Phase 4 全部完成：删除 `.spec-first/workflows/bootstrap/<slug>/backup_<ISO-timestamp>/`
- 若任一步失败：先恢复 backup，再报告失败原因

---

## Phase 4：路由生成

生成 `docs/contexts/<slug>/injection-index.yaml`：

```yaml
always:
  - 00-summary.md
  - README.md

stages:
  plan:
    - architecture/module-map.md
  work:
    - code-facts/test-map.md
  review:
    - code-facts/high-risk-modules.md
    - pitfalls/index.md
    - context-packs/review-change.md
    - code-facts/test-map.md
  unknown:
    - README.md

selection_rules:
  - condition: "output_exists.code_facts_public_entrypoints"
    inject:
      - code-facts/public-entrypoints.md
  - condition: "fact.graph_support_state == 'local-available'"
    inject:
      - architecture/module-map.md
      - code-facts/high-risk-modules.md

advice:
  review: "优先 code-facts 和 risk signals，而非 narrative"
  work: "优先 code-facts 和 test-map，而非 architecture"
  plan: "优先 architecture/module-map 和 code-facts/public-entrypoints"
```

---

## 降级链路

```
Full (CRG CLI)       crg.indexed=false
confidence: high ──→  Enhanced (Serena)      serena.ready=false
severity: 无上限       confidence: medium ──→  Basic (Built-in)
                      severity 上限: medium    confidence: low
                                              severity 上限: medium
```

降级规则：
- 降级事件写入 `generation_errors[]`
- `analyzer_mode` 字段记录最终模式
- `README.md` Freshness 章节体现降级原因

**Enhanced/Basic 模式 severity 约束**：
- 单一信号命中 → `medium`
- ≥2 个独立信号同时命中 → `high` 可用

---

## 置信度规则

**Observed**（确定性来源）：
- `crg flows`/`crg communities`/`crg community` 直接返回的 AST 节点
- `crg large-functions`/`crg impact` 统计数据
- `Read(package.json/go.mod)` 等元文件

**Inferred**（推断性来源，必须附 `inference_reason`）：

CRG Tier（Full 模式）：
- `crg query`（CLI 内部固定输出 Inferred）→ `"crg-importers-evidence"` / `"crg-dependents-evidence"` / `"crg-tests-for-evidence"`
- `crg search` 节点的 kind 分类 → `"crg-semantic-search-evidence"`
- `crg impact` / `crg large-functions` → `"crg-blast-radius-threshold"` / `"crg-large-function-heuristic"`

Serena Tier（Enhanced 模式）：
- Serena 模式搜索 → `"serena-pattern-match"`
- Serena symbol 定位 → `"serena-symbol-evidence"`

Built-in Tier（所有模式均可作 fallback）：
- 路径/目录命名模式 → `"directory-naming-pattern"`
- 文件路径中的 test_kind 分类 → `"path-naming-pattern"`
- Grep import 推断 → `"grep-import-pattern"`
- Read 工具直接读取源码推断 → `"read-source-code"`
- package.json / go.mod / pom.xml 依赖字段推断 → `"package-json-analysis"`
- Glob 文件发现 → `"glob-pattern-match"`

**约束**：`inference_reason` 必须使用上述枚举值之一，不得使用自由描述性文字（如 `"direct-code-reading"`）。

**约束**：
- `crg query` 全系列固定输出 `Inferred`
- 单条 `inferred` 事实不得触发 `high` severity，除非 ≥2 个独立信号支持
- `crg query` 的 `--symbol`/`--module`/`--subject` 须为**节点 ID 字符串**（symbol_key 格式：`<file_path>#<kind>#<name>#L<line_start>`），不接受裸名称
- `crg search` 底层 FTS5：多词须各自独立调用，空格=短语匹配（phrase），不支持多词 OR

---

## 最终产物树

```
.spec-first/workflows/bootstrap/<slug>/
  fact-inventory.json      ← 控制面（所有 Worker 输入源）
  risk-signals.json
  test-surface.json
  artifact-manifest.json   ← 两段写入（in_progress → complete）

docs/contexts/<slug>/
  README.md
  00-summary.md
  architecture/module-map.md
  pitfalls/index.md
  code-facts/public-entrypoints.md
  code-facts/test-map.md
  code-facts/high-risk-modules.md
  context-packs/review-change.md
  injection-index.yaml
```
