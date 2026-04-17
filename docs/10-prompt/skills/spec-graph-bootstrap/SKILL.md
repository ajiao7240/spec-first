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

## Contract 真源

Stage-0 的字段 contract 不再只存在于本文件文本中，以下目录为 machine-first 真源：

```text
docs/contracts/spec-graph-bootstrap/
```

本文件只保留阶段流程、降级语义、输出职责与字段解释；sample 与 runtime 输出必须同时满足 schema contract。

编译职责收敛到 `src/bootstrap-compiler/`：
- 默认主链入口为 `orchestrator.js`
- `compile-machine-artifacts.js` 先生成 machine artifacts
- `compile-human-assets.js` 再组织 docs assets
- `compile-routing.js` 最后生成 routing / manifest / injection-index

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
slug = sanitize(basename(resolve(target)))
```

**Slug 生成规则（精确定义）**：
```
raw  = basename(resolve(target))        # 取最后一段路径名
slug = raw
  .replace(/[\s\/\\:*?"<>|]+/g, "-")   # 空白符及 FS 非法字符 → -
  .replace(/-{2,}/g, "-")               # 连续多个 - 折叠为一个
  .replace(/^-+|-+$/g, "")             # 去首尾 -
  .slice(0, 128)                        # 最长 128 字符

if slug == "" or slug == ".":           # 特判空串和 "."（basename of "." 或仅含非法字符的名称）
  slug = "default"
  打印: "⚠️ Slug 降级为 'default'（原目录名无法生成有效 slug），请通过 --slug=<name> 手动指定"
```

立即告知用户：
```
📁 Slug: <slug>
   产物路径: .spec-first/workflows/bootstrap/<slug>/
             docs/contexts/<slug>/
```

**碰撞检测（Slug 生成后立即执行）**：
```
if docs/contexts/<slug>/README.md 存在:
  读取其中 project_identity.name（若有）
  if 读取到 name 且 name ≠ 当前项目名:
    打印: "⚠️ 警告：docs/contexts/<slug>/ 已存在且属于项目 '<existing_name>'，
            本次运行将覆盖该目录。确认继续？[Y/n]"
    用户选「n」→ 停止并提示通过 --slug=<custom> 参数指定自定义 slug（备用路径）
```
若 README.md 不存在或无法解析 project_identity.name，视为首次运行，不弹确认。

### 0.2 MCP 就绪探测

- Step 0: 宿主选择（Claude / Codex）
- Step 1: mcp-setup marker 检测
- Step 2: Serena MCP probe → `serena.ready = true/false`

### 0.2b CRG CLI 就绪检查（新增）

读取当前宿主的 `host-setup.json`（路径来自 0.2 Step 1 的 marker 路径）。

```
Read host-setup.json
# ↑ 如果 Read 失败（文件不存在 / marker 路径未知）:
#   → 视同 version < "5"，按无 CRG block 逻辑继续（不阻断，直接执行 0.3 DB 检测）
#   → 打印: "host-setup.json 不可读，跳过 CRG 就绪检查"

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
    risk_signals: "v1"
    test_surface: "v1"
# 首次写入时均为空，Phase 3 database worker 完成后回填
table_hashes: {}          # { "<table_name>": "sha256:<hex>" } — SHOW CREATE TABLE 内容的 SHA256
domain_assignments: {}    # { "<table_name>": "<domain_name>" } — 稳定域分配，写入后不再重聚类
```

### 0.7 Rerun Backup（阶段2范围内必须支持）

如果 `docs/contexts/<slug>/` 已存在，在 **任何 Phase 3 写入开始前**：

- 备份到 `.spec-first/workflows/bootstrap/<slug>/backup_<ISO-timestamp>/`
- **校验备份**（两级校验，任一失败则停止并报告错误，不进入 Phase 3）：
  1. 文件数量相等（原目录 vs backup 目录递归统计）
  2. backup 中不存在空文件（文件大小 = 0 字节，表示复制截断）：`glob backup/**/* | filter(size == 0) → 若非空则报告具体文件名`
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

#### 4.10 Database Detection（Full 模式，与 Enhanced/Basic 共用相同探测方式）
```bash
Read(<target>/package.json | go.mod | pom.xml | requirements.txt)
  → 检测 DB 依赖（mysql2/pg/mongoose/sequelize/typeorm/prisma/gorm/django 等）
Glob({pattern: "**/{.env,.env.example,config/database.yml,config/settings.py}", path: <target>})
  → 检测 DB_HOST / DATABASE_URL 等连接参数变量名
Glob({pattern: "**/migrations/**/*.{js,ts,py,go,rb,sql}", path: <target>})
  → 检测迁移文件存在性
```

`db_type` / `db_access_level` 推断规则与 Phase 1 Enhanced/Basic § database 节完全相同。

> 注：Full 模式 CRG 图不包含数据库 schema 信息，因此 database 探测与降级模式共用 Glob/Read 方式，
> 不调用任何 CRG 命令。

### 1.2 Stage B-Round1（依赖 Stage A，同一 response 内并行）

#### 4.3 Entrypoints（Round1：获取 flow 列表）
```bash
spec-first crg flows --repo=<target>
```
记录 `data.items[]`：`{flow_id, entry_node, criticality, node_count}`（无 `name` 字段，字段名为 `flow_id` 非 `id`）。

**零结果 fallback**：若 `data.items[]` 为空（纯库类项目/无循环依赖）：
- 跳过 B-Round2 `crg flow` 系列和 Stage C `crg impact` 系列
- 降级为 Glob-based entrypoint 探测（同 Enhanced/Basic § entrypoints Basic 路径）
- 在 `generation_errors[]` 记录 `{ extractor: "entrypoint_extractor", error: "crg-flows-empty-fallback-to-glob", stage: "B", fallback_applied: true }`
- 第 1.6 校验第 6 项视为"fallback_applied=true"，**不触发 halt**，降级标注 `[entrypoints-fallback]`

#### 4.4 Module Structure（Round1：获取社区列表 + 架构）
```bash
spec-first crg communities --repo=<target>
spec-first crg architecture --repo=<target>
```
记录 `data.items[].community_id`（字符串，如 "tests"/"crg/1"）。

**零结果 fallback**：若 `data.items[]` 为空（纯库 / 单文件项目）：
- `modules` 降级为 Glob 目录探测（等同 Enhanced/Basic § modules Basic 路径）
- `testing_surface` 降级为 Glob 文件扫描（等同 Enhanced/Basic § testing_surface 路径）
- Stage B-Round2 `crg community --id=<community_id>` 全部跳过，`data.members[]` 视为空
- Stage C `crg query tests_for` 全部跳过
- 在 `generation_errors[]` 记录 `{ extractor: "module_extractor", error: "crg-communities-empty-fallback-to-glob", stage: "B", fallback_applied: true }`

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

**top-5 选取规则**：对 `data.items[]` 按以下优先级排序，取前 5：
1. `criticality` 降序（数值型直接比较；字符串枚举映射：`high=3 / medium=2 / low=1 / 其余=0`）
2. 同 criticality 时：`node_count` 降序（更深的流更重要）
3. 仍相同时：`flow_id` 字典序升序（保证确定性）

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
从 `data.results[]` 中按以下优先级取精确匹配节点的 `node_id`（字符串 symbol_key）：
1. **file_path 路径段匹配**：`file_path` 包含 `node_modules/<lib>/` 或 `vendor/<lib>/` 路径段的节点（NPM / Go vendor 安装路径）
2. **name 完全相等**：若无路径段匹配，取 `name == <lib>`（区分大小写）的节点
3. 仍无匹配 → 跳过 Round3，改用 Grep 回退（同 Basic 路径）

> 多个节点均满足条件时：取 `file_path` 最短的那个（通常是入口 index 节点），避免传入深层内部模块 ID 给 `importers_of`。

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

**≤10 subjects 选取规则**（全部 members 合并后跨社区选取，确保代表性）：
1. **核心模块优先**：`file_path` 含 `core/` / `shared/` / `common/` / `util/` / `lib/` 的节点（最高优先）
2. **高风险节点次之**：出现在 Stage C 4.7 `crg impact` 入口节点列表中的 members（这些节点已知有高 blast_radius）
3. **每个社区至少 1 个**：若前两轮未覆盖某社区，从该社区取 file_path 最短的节点补位
4. 仍不足 10：按 symbol_key 字典序补足至 10 或全选（members ≤ 10 时全选，无需筛选）

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
database: [{ db_type, present, db_access_level, confidence, inference_reason, evidence, updated_at }]
# db_access_level: "Level1"（MCP 直连）/ "Level2"（CLI 直连）/ "Level3"（ORM 推断，不触发 database worker）
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
6. **Full 模式专项**：`entrypoints` 数组不得为空；若为空，写入 `generation_errors`：
   ```yaml
   - extractor: "entrypoint_extractor"
     stage: B
     error: "entrypoints-empty-in-full-mode — 可能原因：crg flow --id=<flow_id> 的 flow_id 字段名读取错误（应为 data.items[].flow_id，非 data.items[].id）"
     affected_fields: ["entrypoints", "fact-inventory.json"]
     fallback_applied: false
   ```
   并将后续 Phase 2/3 中 `code-facts/public-entrypoints.md` 的 PRD context 降级为 Enhanced 模式质量（标注 `[entrypoints-fallback]`）
7. 校验失败（1-5 项）→ 报告错误，不继续后续 Phase

**generation_errors 格式**（有错误时追加到顶层）：
```yaml
generation_errors:
  - extractor: string   # 如 "entrypoint_extractor"
    stage: A | B | C
    error: string
    affected_fields: [string]
    fallback_applied: bool
```

**去重与上限规则**：
- 写入前检查：若已存在 `(extractor, error)` 完全相同的条目，跳过（不写重复）
- 单次运行上限：50 条；达到上限后追加一条哨兵条目并停止新增：
  `{ extractor: "system", stage: null, error: "generation_errors-truncated-at-50", affected_fields: [], fallback_applied: false }`

---

## Phase 1（Enhanced / Basic 模式降级路径）

> 本节仅在 `crg.indexed=false` 时执行。Full 模式跳过本节，直接读取 Phase 1.6 产物。
>
> 两种降级模式均须填写 `fact-inventory.json` 相同字段；confidence 上限为 `Inferred`，
> severity 上限为 `medium`（≥2 独立信号时可升 `high`，见置信度规则）。

### 操作序列（分 3 批次执行）

> **并行约束**：每批次内的所有调用在同一 response 内并行发出（≤8 次工具调用/response）。
> 批次间有数据依赖，必须顺序执行。`integrations` 需要 Batch 1 产出的 `primary_language`，
> 因此放入 Batch 2。

---

### Batch 1（基础探测，同一 response 并行，≤8 calls）

#### project_identity

**Enhanced（Serena）:**
```
Read(<target>/package.json | go.mod | pom.xml)   → name, primary_language, primary_frameworks
mcp__serena__get_symbols_overview({relative_path: "."})  → repo_shape（top-level 目录结构）
```

**Basic:**
```
Read(<target>/package.json | go.mod | pom.xml)   → name, primary_language, primary_frameworks
Glob({pattern: "*", path: <target>})             → repo_shape（顶层目录列表）
```

`confidence: Observed`（元文件直接读取）

#### layers

**Enhanced:**
```
Read(<target>/package.json)  → dependencies/devDependencies 字段
mcp__serena__search_for_pattern({substring_pattern: "useState|useEffect"})     → frontend(React)
mcp__serena__search_for_pattern({substring_pattern: "defineComponent|createApp"}) → frontend(Vue)
mcp__serena__search_for_pattern({substring_pattern: "router\\.|app\\.listen"}) → backend(Node)
mcp__serena__search_for_pattern({substring_pattern: "APIRouter|Depends"})      → backend(FastAPI)
... （每层 1 次 search_for_pattern，同一 response 并行）
```

**Basic:**
```
Read(<target>/package.json)  → dependencies 字段匹配框架关键词
Glob({pattern: "android/**"})  / Glob({pattern: "ios/**"})  → mobile 检测
Glob({pattern: "**/cmd/**"})   / Glob({pattern: "**/bin/**"}) → cli 检测
```

`confidence: Inferred`，`inference_reason: "package-json-analysis"` / `"directory-naming-pattern"`

---

### Batch 2（依赖 Batch 1 的 `primary_language`，同一 response 并行，≤8 calls）

#### entrypoints

**Enhanced:**
```
mcp__serena__find_symbol({name_path_pattern: "main|App|Application|Bootstrap|Server", relative_path: "."})
mcp__serena__search_for_pattern({substring_pattern: "app\\.listen|app\\.run|serve\\("})
mcp__serena__search_for_pattern({substring_pattern: "router\\.(get|post|put|delete|patch)"})
```
取前 5 个最高匹配项，映射到 `entrypoints[].path/symbol/kind`。

**Basic:**
```
Glob({pattern: "**/main.{ts,js,go,py,rb,java}"})
Glob({pattern: "**/app.{ts,js}"})
Glob({pattern: "**/server.{ts,js}"})
Glob({pattern: "**/cmd/*/main.go"})
Read(<entry files>)  → 提取 entrypoint symbol 名
```

`confidence: Inferred`，`inference_reason: "serena-symbol-evidence"` / `"glob-pattern-match"`

#### modules

**Enhanced:**
```
mcp__serena__get_symbols_overview({relative_path: "<top-level-dir>"})  × top-6 目录（同一 response 并行）
→ 每个目录：取 exported class/function 列表 → 推断 responsibility
```

**Basic:**
```
Glob({pattern: "*/", path: <target>})  → 顶层目录列表
Read(<dir>/index.{ts,js} | README.md)  × top-6（同一 response 并行）
→ 提取模块职责描述
```

`confidence: Inferred`，`inference_reason: "serena-symbol-evidence"` / `"read-source-code"`
`community_id` 填 `"<dir-name>"（inferred）`

#### integrations

**Enhanced:**
```
Read(<target>/package.json | requirements.txt | go.mod)  → 已知库清单（database/cache/queue/http/auth）
mcp__serena__find_referencing_symbols({name_path: "<lib>", relative_path: "."})  × top-5 库（并行）
```

**Basic:**
```
Read(<target>/package.json | requirements.txt | go.mod)  → 依赖清单
Grep({pattern: "import.*from ['\"]<lib>['\"]", glob: "**/*.{ts,js,py,go}"})  × top-5 库（并行）
```

`confidence: Inferred`，`inference_reason: "serena-symbol-evidence"` / `"grep-import-pattern"`

#### data_shapes

**Enhanced:**
```
mcp__serena__search_for_pattern({substring_pattern: "class.*Entity|class.*Schema|interface.*Dto|type.*Model"})
→ 取前 10 个匹配节点，Read 各文件提取字段列表
```

**Basic:**
```
Grep({pattern: "class.*(Entity|Schema|Model)|interface.*(Dto|Request|Response)", glob: "**/*.{ts,js,py}"})
Read(<matched files>)  × ≤10（并行）
```

`confidence: Inferred`，`inference_reason: "serena-pattern-match"` / `"grep-import-pattern"`
`kind` 按命名规则分类（同 Stage A 4.8 kind 分类规则）

---

### Batch 3（独立，同一 response 并行，≤8 calls）

#### testing_surface

**Enhanced / Basic（共用）:**
```
Glob({pattern: "**/*.{test,spec}.{ts,js,py,go,rb}"})
Glob({pattern: "**/*_test.{go,py}"})
Glob({pattern: "**/e2e/**/*.{ts,js}"})
Glob({pattern: "**/integration/**/*.{ts,js}"})
```
取前 20 个文件，每个：Read 前 30 行提取 import（被测目标）。

`test_kind` 按路径启发式分类（同 Stage C 4.6 规则）。
`confidence: Inferred`，`inference_reason: "path-naming-pattern"`

#### database

**Enhanced / Basic（共用）:**
```
Read(<target>/package.json | go.mod | pom.xml | requirements.txt)
  → 检测 DB 依赖（mysql2/pg/mongoose/sequelize/typeorm/prisma/gorm/django 等）
Glob({pattern: "**/{.env,.env.example,config/database.yml,config/settings.py}"})
  → 检测 DB_HOST / DATABASE_URL 等连接参数变量名
Glob({pattern: "**/migrations/**/*.{js,ts,py,go,rb,sql}", path: <target>})
  → 检测迁移文件存在性
```

`db_type` 推断（依赖名映射）：`mysql2`/`mysql` → `mysql`；`pg` → `postgresql`；`mongoose` → `mongodb`；`redis` → `redis`；无命中 → 空

`db_access_level` 推断：
- 依赖含 ORM（`sequelize`/`typeorm`/`prisma`/`gorm`/`django.db`/`ActiveRecord`）且无迁移文件 → `"Level3"`（ORM inference，**不触发 database worker**）
- 有迁移文件 + 有 DB 依赖 → `"Level2"`（CLI 直连可行，database worker 可触发）
- 其余 → `"Level3"`（保守默认，避免误触发）

`confidence: Inferred`，`inference_reason: "package-json-analysis"` / `"glob-pattern-match"`

---

#### risk_signals（Enhanced / Basic 模式约束）

不执行 `crg impact` / `crg large-functions` / `crg god-nodes`。

**Enhanced:**
```
mcp__serena__search_for_pattern({substring_pattern: "TODO|FIXME|HACK"})  → code-level risk
mcp__serena__find_symbol({name_path_pattern: ".*Service|.*Manager|.*Handler", relative_path: "."})
→ 类行数 > 300 行启发式判断 god_node
```

**Basic:**
```
Grep({pattern: "TODO|FIXME|HACK", glob: "**/*.{ts,js,py,go,rb}"})  → code-level risk
Glob({pattern: "**/*.{ts,js,py,go}"})  → 文件行数 > 500 → 列为 god_node 候选
```

`risk-signals.json` 的 `crg_metrics` 字段：
- `total_nodes / total_edges / avg_fan_out`：填 `null`
- `top_hubs / largest_functions`：填 `[]`
- 在 `generation_errors[]` 中记录：`{ extractor: "crg_metrics", error: "crg not indexed", ... }`

`severity` 上限：单条信号 → `medium`；≥2 个独立信号 → `high` 可用。

### 写入控制面（Enhanced / Basic）

与 Phase 1.6 相同路径，相同 JSON 校验规则（1–5 项照常执行）。
**第 6 项 entrypoints 非空校验仅适用于 Full 模式，Enhanced/Basic 跳过**——降级模式下 entrypoints 为空时，只在 `generation_errors[]` 记录 `entrypoints-empty-non-full-mode`，不中断流程。

---

## Phase 2：任务规划（PRD task contracts）

**前置检查**（依次执行，任一失败则停止并报告错误）：
1. `fact-inventory.json` 文件存在（Read 成功）
2. JSON 合法（parse 成功，非空 JSON）
3. `schema_version == "v1"`
4. `analyzer_mode` 为 `full` / `enhanced` / `basic` 之一
5. `project_identity.name` 非空（最低事实要求）

- 为固定产物生成 PRD（带事实证据）：
  - `00-summary.md` ← `project_identity`
  - `architecture/module-map.md` ← `modules` + `data_shapes`
  - `pitfalls/index.md` ← `risk_signals` + `integrations`
  - `code-facts/public-entrypoints.md` ← `entrypoints`
  - `code-facts/test-map.md` ← `testing_surface` + `test-surface.json`
  - `code-facts/high-risk-modules.md` ← `risk_signals`
  - `context-packs/review-change.md` ← 静态组装（risk_signals high + test-surface coverage_gaps + entrypoints http/worker + integrations high-risk）
- 为条件产物（如 API 文档）判定是否创建 task
- **database-context task**（条件）：`fact-inventory.json` 中 `database[].present=true` 且 `db_type=mysql` 且 `db_access_level` 不为 `Level3`（ORM inference）时创建
  - 产物按库规模自适应（过滤后表数决定）：

    | 规模 | 过滤后表数 | 必须产物 |
    |---|---|---|
    | 小型 | ≤ 30 | `database/database-index.md` + `database/data-flow.md` + `database/database-er.md` |
    | 中型 | 31–100 | `database/database-index.md` + `database/data-flow.md` + `database/domains/<name>-domain.md × N` |
    | 大型 | > 100 | 全四层：上述全部 + `database/semantic-catalog.md` |

  - PRD 须包含：db_access_level（Level1/Level2）、连接参数变量名（不写值）、R23 backup table filter 规则、过滤后表数（决定规模档位）
  - 详细产物格式规范见 `docs/02-架构设计/全局分析/2026-04-16-database-四层索引方案.md`

### Phase 2 PRD Quality Gate

**所有 PRD 写完后执行（自动 enrich，不引入人工审批阻断）：**

1. `Goal` 具体——指向 `fact-inventory.json` 中的特定字段（如 `fact.modules[0].name`），不是泛型 bootstrap 描述
2. `Context` 含来自 `fact-inventory.json` 的真实字段值（路径、类名、community_id 等具体证据）
3. `Files to Fill` 列出精确文件路径，不是抽象类别或目录名
4. `Technical Notes` 含 ≥1 项来自 `fact-inventory.json` 的项目专属约束（如 primary_framework、repo_shape）
5. **risk-signal 引用**：`pitfalls/index.md` 和 `code-facts/high-risk-modules.md` 的 PRD 必须引用 `risk-signals.json` 中 `severity≥medium` 的至少 1 条具体信号（path + symbol）

**任一检查不通过：**
1. 自动从 `fact-inventory.json` 补充 `Context` 字段（追加具体字段值）
2. 重跑当前 PRD 的对应检查
3. 最多重试 1 次；仍不通过则在 `generation_errors` 中记录 `prd-quality-gate-failed`，降级该 PRD 的 `Technical Notes` 为最小可用状态，继续执行 Phase 3

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
- `database/` ← **条件**（`fact-inventory.database[].present=true` 且 `db_access_level≠Level3`）

  **database worker 执行规范**（四层索引，按 db_access_level 接入）：

  **Step 1 — 连接前校验 + 连接与 schema 读取：**

  **Level 1（MCP）预校验**：`mcp__mysql-mcp-server__execute_query("SELECT 1")` probe：
  - 成功 → `execute_query("SELECT DATABASE()")` 一致性校验：
    - **期望值来源**：Phase 1 database 探测时从 `.env` / `DATABASE_URL` / `config/database.yml` 中提取的 DB 名（若无则跳过比对）
    - **校验规则**：
      - 返回 NULL → 终止，写 `generation_errors[{ error: "mcp-no-database-selected: 连接成功但未选中数据库，请检查 MCP 连接配置" }]`，跳过 database worker
      - 返回 `information_schema` / `mysql` / `performance_schema` → 终止，写 generation_errors，跳过 database worker（系统库，不应导出）
      - 与期望 DB 名不匹配（且有期望值）→ 打印 ⚠️ 警告，**不终止**，继续使用当前连接的 DB（允许 MCP 默认 DB 与 .env 不同）
      - 其余 → 通过校验，继续 `list_tables`
  - 失败（工具不可用/超时）→ 写 `generation_errors[{ extractor: "database_worker", error: "mcp-connection-failed", ... }]`，**跳过整个 database worker，继续 Phase 3 其他产物**

  **Level 2（CLI）预校验**：先检查必要环境变量是否已设置：
  ```
  if $DB_HOST 未设置 OR $DB_USER 未设置:
    写 generation_errors[{ extractor: "database_worker", error: "db-env-vars-missing: DB_HOST/DB_USER not set", ... }]
    跳过整个 database worker，继续 Phase 3 其他产物
  ```
  环境变量均已设置 → `mysql -h $DB_HOST -u $DB_USER -p$DB_PASS --connect-timeout=10 -e "SHOW TABLES"` → `SHOW CREATE TABLE <t> × N`
  命令失败（exit 非 0）→ 写 `generation_errors`，跳过 database worker

  **Step 2 — R23 backup table filter：**
  过滤后缀 `_bak/_backup/_old/_copy/_tmp/_temp/_deprecated/_archive`；前缀 `bak_/backup_/tmp_/temp_`；日期模式 `_20YYMMDD/_YYYY_MM/_YYYYMM`。
  > **不使用 last_update 启发式**：`information_schema.tables.update_time` 对 InnoDB 表始终为 NULL（MySQL InnoDB 行为），基于此字段的 stale 检测从不触发，已删除该规则。命名模式过滤已覆盖绝大多数 backup 表场景。
  在 `database-index.md` 的 auto 段中列出所有被过滤的表及原因（透明报告）。

  **Step 2b — 读取增量基线（重跑时执行）：**
  ```
  Read artifact-manifest.json → prev_table_hashes, prev_domain_assignments
  如果文件不存在或字段为空 → 视为首次运行，所有表标记为 changed
  ```

  **Step 3 — Per-table hash 计算与增量判定：**
  ```
  对每张过滤后的表:
    current_hash = SHA256(SHOW CREATE TABLE <t> 的完整输出)
    if current_hash == prev_table_hashes[t]:
      status = unchanged   # auto 段跳过重写，manual 段不触碰
    else:
      status = changed     # auto 段重新生成
  新表（prev 中不存在）: status = new

  规模判定（按过滤后总表数）:
    ≤ 30  → 小型
    31–100 → 中型
    > 100  → 大型
  ```

  **Step 4 — 域分配（稳定优先）：**
  ```
  对每张表:
    if prev_domain_assignments[t] exists:
      domain = prev_domain_assignments[t]   # 复用，不重聚类
    else:
      domain = cluster(t)   # 仅对新表运行 FK 连通分量 + 命名前缀推断
  ```
  实体类型推断（所有表）：
  主数据（被多域 FK 引用）/ 事务（status + amount + created_at）/ 状态机（status enum + updated_at）/ 关系（纯 FK 对）/ 配置（key/value 模式）/ 审计（operator + created_at，无 updated_at）/ 缓存（expires_at/ttl）

  **Step 5 — 文件写入（auto/manual 标记系统）：**

  所有数据库文档使用统一的标记语义（命名空间：`spec-graph-bootstrap`）：
  - `<!-- spec-graph-bootstrap:auto:* -->` 段：bootstrap 按需重写（hash 变化或新表时）
  - `<!-- spec-graph-bootstrap:manual:* -->` 段：**bootstrap 永远不触碰**，团队自由编辑

  `database-index.md` 写入格式：
  ```markdown
  <!-- spec-graph-bootstrap:auto:start hash=<all-tables-combined-hash> -->
  ## 业务域清单
  ...（域列表 + 核心实体快查 + 跨域 FK 接口 + 被过滤表列表）
  <!-- spec-graph-bootstrap:auto:end -->

  <!-- spec-graph-bootstrap:manual:start -->
  <!-- 团队补充：业务背景、特殊约定、已知问题等，bootstrap 不覆盖 -->
  <!-- spec-graph-bootstrap:manual:end -->
  ```

  `all-tables-combined-hash` 计算规则：
  ```
  sorted_tables = 过滤后所有表名按字母升序排列
  hash_input    = sorted_tables.map(t → table_hashes[t]).join("\n")
  all-tables-combined-hash = SHA256(hash_input)
  ```
  重跑规则：any-table-changed → 重写 auto 段；manual 段完整保留。

  `semantic-catalog.md` 写入格式（大型）：
  ```markdown
  <!-- spec-graph-bootstrap:auto:start table=orders hash=sha256:abc123 -->
  ## orders
  - **业务名**: 订单
  - **实体类型**: 事务
  - **所属域**: order_domain
  - **核心字段**: `id`(PK), `user_id`(FK→users), `status`(enum), `total_amount`
  - **索引提示**: KEY idx_user_status (user_id, status); KEY idx_created (created_at)
  - **业务说明**: 记录每笔订单的主体信息
  <!-- spec-graph-bootstrap:auto:end -->

  <!-- spec-graph-bootstrap:manual:start table=orders -->
  <!-- 团队补充：如 "status=shipped 时触发物流 webhook（OrderService.notify）" -->
  <!-- spec-graph-bootstrap:manual:end -->
  ```
  重跑规则：hash 未变 → 跳过该表的 auto 段；hash 变化 → 仅重写该表 auto 段；manual 段不变。

  `data-flow.md` 写入规则（**人工优先模式**，所有规模）：
  ```
  文件不存在：
    → 全量生成初稿，文件顶部附 generated-draft 标记

  文件存在 + 含 <!-- spec-graph-bootstrap:generated-draft --> 标记：
    → 团队尚未确认，覆盖重新生成（保留 generated-draft 标记）

  文件存在 + 不含 generated-draft 标记（团队已确认）：
    → 增量模式：
      基线对比：加载上次运行的 fact-inventory.json（若存在），提取上次 entrypoints 路径集合
      新增入口 = 本次 fact-inventory.entrypoints(HTTP/worker) - 上次路径集合
      对每个新增入口：仅追加（不修改已有内容），格式：
        ## [待确认：<scenario-name>]（spec-graph-bootstrap 新检测，请团队审核后删除此提示）
      若上次 fact-inventory.json 不存在：跳过追加，仅打印提示"无法确定增量基线，跳过本次追加"
  ```
  初次生成文件顶部必须包含：
  ```markdown
  <!-- spec-graph-bootstrap:generated-draft -->
  > ⚠️ 此文件为 bootstrap 初稿，基于入口点推断生成，请团队补充业务细节并验证准确性。
  > 确认完毕后，删除上方的 `<!-- spec-graph-bootstrap:generated-draft -->` 注释行（整行删除）——
  > 删除该注释行后 bootstrap 不再覆盖，只追加新检测到的场景。
  ```
  内容来源：`fact-inventory.entrypoints`（HTTP/worker 类型）→ 业务场景；`risk-signals`（high severity）→ 高风险路径风险表。覆盖 3–5 个核心场景，每个场景含：触发点 + 编号步骤 + 状态机图（有 status enum 的核心事务表）。

  `database-er.md` / `domains/<name>-domain.md` 写入格式：

  ~~~markdown
  <!-- spec-graph-bootstrap:auto:start hash=<domain-tables-combined-hash> -->
  ```mermaid
  erDiagram
    ...（≤25 张表）
  ```
  <!-- spec-graph-bootstrap:auto:end -->

  <!-- spec-graph-bootstrap:manual:start -->
  <!-- 补充说明：ER 图未体现的业务约束、软删除规则等 -->
  <!-- spec-graph-bootstrap:manual:end -->
  ~~~
  `domain-tables-combined-hash` 计算规则（与 all-tables-combined-hash 同算法，作用域为域内表）：
  ```
  domain_sorted_tables = 该域内过滤后的表名按字母升序排列
  hash_input           = domain_sorted_tables.map(t → table_hashes[t]).join("\n")
  domain-tables-combined-hash = SHA256(hash_input)
  ```
  重跑规则：域内任一表 changed → 重写该域文件 auto 段；manual 段保留。

  **Step 6 — 局部回填 artifact-manifest.json（仅写两个字段）：**
  ```
  # 写法：Read manifest → 深合并以下两个字段 → Write manifest
  # 不覆盖其他已有字段（如 status / generated_at / inputs 等）
  table_hashes[t] = current_hash   （所有过滤后的表，无论 changed/unchanged）
  domain_assignments[t] = domain   （所有表，包括本次新聚类的）
  ```
  在 Phase 3 串行收尾（**README.md 写完后、artifact-manifest 全局第二写之前**）执行，
  确保 manifest 反映本次最终状态。

  **凭据保护（所有 Step 均适用）**：只写连接参数变量名，不写密码或完整连接串；日志中密码值替换为 `***`

**串行（最后）**：
- `README.md`（上下文控制台，汇总所有产物状态）

  **README.md 最小内容规范**：
  ```markdown
  # <project_identity.name> · Context Pack

  Generated: <ISO date> | Mode: <analyzer_mode> | Graph: <graph_support_state>

  ## 产物状态

  | 产物 | 状态 | 备注 |
  |------|------|------|
  | 00-summary.md | generated | |
  | architecture/module-map.md | generated | |
  | pitfalls/index.md | generated | |
  | code-facts/public-entrypoints.md | generated / skipped[entrypoints-fallback] | |
  | code-facts/test-map.md | generated | |
  | code-facts/high-risk-modules.md | generated | |
  | context-packs/review-change.md | generated | |
  | database/ | generated / skipped | 跳过原因：<error> |

  ## 异常摘要

  <!-- 若 generation_errors[] 非空，列出每条 extractor + error；否则写 "无" -->
  ```
  - `状态` 只取值：`generated` / `skipped` / `failed`
  - 若 generation_errors 非空，在"异常摘要"节列出每条 `{ extractor, error }`
  - 不写原始 fact-inventory 内容，只写产物状态（README 是元信息，不是事实层）

**artifact-manifest.json 第二次写入**（Step 6 局部写之后，Phase 3 全部完成时）：
```yaml
# 写法：Read manifest（Step 6 已写入 table_hashes/domain_assignments）→ 深合并以下字段 → Write
# Step 6 写入的 table_hashes / domain_assignments 在此步骤中保持不变，不得覆盖
status: complete
updated_at: <now>
outputs:
  "architecture/module-map.md":
    depends_on: ["schema:fact_inventory@v1", "analyzer:module_structure@v1", "analyzer:data_shapes@v1"]
  # ... 其余产物 depends_on 清单
```

**database worker 失败边界**：
- **Step 1 连接失败**（预校验阶段已 abort）：`database/` 目录完全未写入，其余产物不受影响，不触发 backup 恢复
- **Step 2–4 中途失败**（schema 读取/hash 计算/域分配失败）：`database/` 目录尚未写入，视同 Step 1 失败处理，写 generation_errors，跳过 database worker
- **Step 5 写入中途失败**（文件部分写入）：`database/` 目录处于半写状态 → 删除整个 `database/` 目录，写 generation_errors，**不触发全量 backup 恢复**（固定 v1 产物未受影响），继续完成 README.md 和 Phase 4

**收尾**：
- 若本次创建了 backup，且 Phase 3 / Phase 4 全部完成：删除 `.spec-first/workflows/bootstrap/<slug>/backup_<ISO-timestamp>/`
- 若**固定 v1 产物**（`00-summary.md` / `architecture/module-map.md` / `pitfalls/index.md` / `code-facts/*` / `context-packs/review-change.md` / `README.md` / `injection-index.yaml`）任一写入失败：恢复 backup，停止流程
- database worker 失败属于条件产物失败，**不触发 backup 全量恢复**，仅记录 generation_errors

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

# output_exists.* 条件名 → 文件路径映射契约（src/context-routing/ 消费此表）
# 条件名由 context-routing 按 docs/contexts/<slug>/<path> 是否存在来评估
# 命名规则：路径中 / 和 - 均替换为 _，去掉扩展名
#
# output_exists.code_facts_public_entrypoints  → code-facts/public-entrypoints.md
# output_exists.database_index                 → database/database-index.md
# output_exists.database_data_flow             → database/data-flow.md
# output_exists.database_er                    → database/database-er.md（小型专用）
# output_exists.semantic_catalog               → database/semantic-catalog.md（大型专用）
#
# fact.* 条件由 context-routing 从 fact-inventory.json 顶层字段读取：
# fact.graph_support_state                     → fact-inventory.json $.graph_support_state

selection_rules:
  - condition: "output_exists.code_facts_public_entrypoints"
    inject:
      - code-facts/public-entrypoints.md
  - condition: "fact.graph_support_state == 'local-available'"
    inject:
      - architecture/module-map.md
      - code-facts/high-risk-modules.md
  - condition: "output_exists.database_index"
    inject:
      - database/database-index.md
  - condition: "output_exists.database_data_flow"
    inject:
      - database/data-flow.md
  # domains/*.md 和 semantic-catalog.md 由调用方按需引用，不在 injection-index 中全量注入
  # （避免大型系统的 semantic-catalog 过度消耗 context window）

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
  database/                       ← 条件（MySQL Level1/Level2 已验证，四层索引）
    database-index.md             ← 所有规模（Tier 0：总索引）
    data-flow.md                  ← 所有规模（Tier 2：核心业务场景数据流叙事）
    database-er.md                ← 仅小型（≤30 表，Tier 1A）
    domains/<name>-domain.md × N  ← 中大型（>30 表，Tier 1B）
    semantic-catalog.md           ← 仅大型（>100 表，Tier 3）
  injection-index.yaml
```
