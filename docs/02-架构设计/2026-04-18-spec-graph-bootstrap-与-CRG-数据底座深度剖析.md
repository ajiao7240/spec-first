# spec-graph-bootstrap 与 CRG 数据底座深度剖析

> 生成时间：2026-04-18
> 范围：`skills/spec-graph-bootstrap/`（Skill 层）+ `src/crg/`（数据底座）+ `src/bootstrap-compiler/`（编译层）+ `src/context-routing/`（消费层）
> 目的：系统化梳理 graph-informed Stage-0 的阶段合约、工具链、SQLite schema、降级链路、并行语义与铁律，作为后续工程演进与 Review 的基线。

## 当前状态（2026-04-18）

- `implemented`：当前代码已经上线并可验证的主链，是 `context-routing.json` / `artifact-manifest.json` / `verification-profile.json` + `src/context-routing/evaluator.js` / `stage0-context` / `crg review-context` 这一套轻量 contract 与消费链路；本轮又补了 `context-routing evaluator` 与 `crg flows/context/review-context` 的 characterization baseline，用测试锁定当前公开输出边界。
- `active`：当前执行中的整改主文档是 `docs/plans/2026-04-18-spec-first-ai-dev-quality-remediation-plan.md`。这条主线优先做“事实收敛 + characterization + 轻 contract 守卫”，先提升 LLM 的决策输入质量，再决定是否推进更深的编译器或算法整改。
- `design-discussion`：本文中关于更大范围的 compiler 去 sample 化、CRG 事实底座重构、Phase 0-4 终局语义与分层演进的内容，当前仍主要是审计/设计讨论输入，不等同于“代码已实现”或“已成为运行时强约束”。

---

## 一、总体定位与分层

`spec-graph-bootstrap` 是 Stage-0 的 **graph-informed 入口**。相较 `spec-graph-bootstrap`，它把"项目上下文生成"从 LLM 自由探查升级为 **AST 级事实抽取**，以 CRG CLI（`spec-first crg`）为 Tier 1 工具，输出 Observed 事实优先的控制面产物。

```
┌── Skill 层 (skills/spec-graph-bootstrap/SKILL.md + references/)
│   Phase 0 就绪探测 → Phase 1 事实抽取 → Phase 2 PRD → Phase 3 文档 → Phase 4 路由
│
├── CLI 工具层 (spec-first crg)  ← Tier 1 工具，17 子命令
│   build / stats / context / query / impact / search / flows / flow / communities
│   community / architecture / surprising-connections / god-nodes / large-functions
│   affected-flows / detect-changes / review-context
│
├── 编译层 (src/bootstrap-compiler/)
│   orchestrator → compile-machine-artifacts → compile-human-assets → compile-routing
│
├── 数据底座 (src/crg/)
│   SQLite + tree-sitter + FTS5 + HNSW  →  graph.db (nodes/edges/flows/communities/chunks/fts)
│
└── 消费层 (src/context-routing/)
    loader → evaluator (always + stages + selection_rules + advice) → priority → profiles
```

**Contract 真源**：`docs/contracts/spec-graph-bootstrap/*.schema.json`（JSON Schema Draft 2020-12）。SKILL.md 只保留流程与语义解释；runtime 输出与 sample 必须同时满足 schema。

---

## 二、Skill 层：Phase 0–4 完整合约

### Phase 0 — 就绪探测（决定降级等级）

#### 0.1 Slug 生成（最先执行，后续所有路径复用同一值）

```
raw  = basename(resolve(target))
slug = raw
  .replace(/[\s\/\\:*?"<>|]+/g, "-")   # FS 非法字符
  .replace(/-{2,}/g, "-")               # 折叠连续 -
  .replace(/^-+|-+$/g, "")              # 去首尾 -
  .slice(0, 128)                        # 最长 128
if slug == "" or slug == ".":           # 特判
  slug = "default"  # 降级警告
```

产物路径：
- 控制面：`.spec-first/workflows/bootstrap/<slug>/`
- 人类上下文：`docs/contexts/<slug>/`

#### 0.1b Slug 碰撞检测

若 `docs/contexts/<slug>/README.md` 属其他项目 → 交互确认 → 用户选 `n` 则终止并提示 `--slug=<custom>`。首次运行（README 不存在或无法解析 `project_identity.name`）不弹确认。

#### 0.2 MCP 就绪探测

- Step 0: 宿主选择（Claude / Codex）
- Step 1: mcp-setup marker 检测
- Step 2: Serena MCP probe → `serena.ready = true/false`

#### 0.2b CRG CLI 就绪检查

读 `host-setup.json`（v5+）：
- `crg.cli_available == false` → `crg.indexed = false`，`graph_support_state = "crg-cli-unavailable"`
- `cli_available == true` 且 `native_modules == "missing"` → 警告后继续（预期 `crg stats` 可能 exit 2）
- 文件不可读 → 视同 v<5，按无 CRG block 逻辑继续

#### 0.3 图状态三分支

```
[1] graph.db 不存在                                     → crg.indexed=false
[2] spec-first crg stats 非零退出 / envelope.degraded    → crg.indexed=false + 打印 warnings
[3] node_count=0 且 edge_count=0                        → crg.indexed=false
[4] node_count > 0                                       → crg.indexed=true
    → 记录 data.last_built / node_count / edge_count
    → 进入 stale 检测（对比 artifact-manifest.inputs.crg.graph_last_built + inputs.files SHA）
```

若未构建但 CLI 可用 → 询问用户是否立即构建（普通项目 2-5 分钟，大型 monorepo 可达 10 分钟）；失败或超时 >10min → 降级。

#### 0.4 分析模式判定矩阵

| 触发条件 | mode | code_facts_confidence | graph_support_state |
|---|---|---|---|
| `crg.indexed=true` | Full | high | local-available |
| `serena.ready=true`（CRG 未建） | Enhanced | medium | crg-not-indexed |
| CLI 不可用 + `serena.ready=true` | Enhanced | medium | crg-cli-unavailable |
| CLI 不可用 + serena 未就绪 | Basic | low | crg-cli-unavailable |
| 其余 | Basic | low | unavailable |

#### 0.6 artifact-manifest.json 首写（status: in_progress）

```yaml
schema_version: "v1"
generated_at: <now>
updated_at: <now>
status: in_progress
inputs:
  crg:
    graph_last_built: <data.last_built>
    node_count: <N>
    edge_count: <M>
    last_build_commit: <git rev-parse HEAD>
  files:
    "package.json": "<sha256>"
  analyzer_versions: { crg: v1, entrypoints: v1, module_structure: v1, ... }
  schema_versions: { fact_inventory: v1, risk_signals: v1, test_surface: v1 }
table_hashes: {}           # Phase 3 database worker 回填
domain_assignments: {}     # Phase 3 database worker 回填
```

**设计决策**：幂等优于断点续传，中断重跑从 Phase 0 重新开始。

#### 0.7 Rerun Backup

Phase 3 写入前必须执行：
1. 备份 `docs/contexts/<slug>/` → `.spec-first/workflows/bootstrap/<slug>/backup_<ISO>/`
2. 两级校验（任一失败则停止）：
   - 文件数量递归统计相等
   - backup 中不存在空文件（大小 = 0）
3. Phase 3 全成功 → 删除 backup
4. 固定 v1 产物任一写入失败 → backup 全量恢复 + 写 `generation_errors` + 停止
5. 不允许静默覆盖旧上下文；不允许半覆盖状态

**约束范围**：backup 只保护 `docs/contexts/<slug>/`；控制面 `.spec-first/workflows/bootstrap/<slug>/` 按本次运行结果覆盖。database worker 失败属条件产物失败，**不触发 backup 全量恢复**，仅记 `generation_errors`。

---

### Phase 1 — 事实抽取

#### Full 模式（CRG CLI 路径）

**并行语义铁律**：同 Stage 内所有 `spec-first crg *` 调用必须**同一 response 内并行发出**（Claude 原生多工具并行）；Stage 间有数据依赖，必须串行。

**Stage 序列**：`1.0 Context 预热 → A → B-Round1 → B-Round2 → B-Round3 → C`

**1.0 前置**：
```bash
spec-first crg context --repo=<target>
```
读 `top_flows / top_communities / top_hubs` 确定后续优先级。字段注意：`crg context` 与 `crg flows` 均返回 **`flow_id`** 字段（非 `id`），可直接传给 `crg flow --id=<flow_id>`。

**Stage A（并行）**：
- `crg stats` + Read(package.json / go.mod / pom.xml / requirements.txt) → `project_identity`
- `crg search "schema|entity|model|dto|migration|validation"` × 6（FTS5 每词独立调用，空格=短语匹配，不支持多词 OR）→ `data_shapes`
  - kind 分类启发式：
    - `migration` + 文件名含数字前缀或 `migrate` → `migration`
    - `schema` + class/interface → `schema`
    - `dto` + 名称含 Dto/DTO/Request/Response → `dto`
    - `entity`/`model` + class + 名称含 Entity/Model → `entity`
    - `validation` + 名称含 Validator/Validation → `validation`
    - 兜底 → `schema`
- 每层框架 API 的 `crg search` 并行（React useState/useEffect、Vue defineComponent、Express router、FastAPI APIRouter、Django urlpatterns、Android Activity、iOS UIViewController、Electron BrowserWindow、CLI commander 等）→ `layers`
  - 判定：crg search ≥1 → observed；0 但 package.json 依赖命中 → observed；目录模式匹配 → inferred；无 → unknown
- Read/Glob → `database`
  - `db_type` 候选：mysql / postgres / mongodb / sqlite 等
  - `db_access_level`：L1（MCP 直连）/ L2（CLI 直连）/ L3（ORM 推断，不触发 database worker）
  - Full 模式 CRG 图不含 DB schema 信息，**数据库探测与降级模式共用 Glob/Read**

**Stage B-Round1（并行）**：
- `crg flows --repo=<target>` → `data.items[]: {flow_id, entry_node, criticality, node_count}`
  - 零结果 fallback：跳过 B-Round2 flow 系列 + Stage C impact 系列，降级为 Glob entrypoint 探测；`generation_errors` 记 `fallback_applied: true`；§1.6 校验 6 视为 fallback，不触发 halt
- `crg communities --repo=<target>` + `crg architecture --repo=<target>` → `data.items[].community_id`（字符串，如 `"tests"` / `"crg/1"`）
  - 零结果 fallback：`modules` 降级 Glob 目录、`testing_surface` 降级 Glob、Stage B-Round2 `crg community` 全跳过
- Read(package.json) → 按 `primary_language` 收窄候选库名（database/cache/message_queue/http_client/auth）

**Stage B-Round2（并行）**：
- `crg flow --id=<flow_id>` × top-5（`flow_id` 来自 Round1）
  - top-5 选取规则：
    1. `criticality` 降序（字符串枚举映射 high=3/medium=2/low=1/其余=0）
    2. 同 criticality → `node_count` 降序（更深的流更重要）
    3. 仍相同 → `flow_id` 字典序升序（保证确定性）
- `crg community --id=<community_id>` × N → `data.members[]` 含 `id`（symbol_key）/ `name` / `file_path`
- `crg search <lib>` × N 定位库节点 ID
  - 优先级：
    1. `file_path` 包含 `node_modules/<lib>/` 或 `vendor/<lib>/` 路径段
    2. `name == <lib>`（区分大小写）
    3. 无匹配 → 跳过 Round3，Grep fallback
  - 多节点同时满足 → 取 `file_path` 最短的（通常是入口 index 节点）

**Stage B-Round3（并行）**：
- `crg query --pattern=importers_of --module=<lib_node_id>` × N
  - `--module` 必须是 **symbol_key 字符串**，不接受库名
  - 输出 → `integrations`，`inference_reason: "crg-importers-evidence"`

**Stage C（并行）**：
- **Test Surface**：`crg query --pattern=tests_for --subject=<member.id>` × ≤10
  - subjects 选取规则（跨社区选取，确保代表性）：
    1. 核心模块优先：`file_path` 含 `core/` `shared/` `common/` `util/` `lib/`
    2. 高风险节点次之：出现在 Risk Signals impact 入口节点列表中
    3. 每个社区至少 1 个：未覆盖社区取 file_path 最短节点补位
    4. 不足 10：按 symbol_key 字典序补足
  - test_kind 分类（`inference_reason: "path-naming-pattern"`）：
    - `e2e` / `end-to-end` / `playwright` / `cypress` → `e2e`
    - `integration` / `api-test` / `contract` → `integration`
    - 其余 → `unit`
- **Risk Signals**（同 response 并行 4 条）：
  - `crg impact --symbol=<flow.entry_node> --depth=2` × ≤5（top-5 criticality 流入口）
  - `crg large-functions --min-lines=100`
  - `crg god-nodes`
  - `crg query --pattern=dependents_of --module=<core_shared_node_id>` × ≤5
- `coverage_gaps.severity` 判定（Full 模式）：
  - `blast_radius ≥ 5` 且 高 criticality 流入口 → `high`
  - `blast_radius ≥ 5` 非高 criticality → `medium`
  - 路径含 `core/ shared/ common/` 但未达阈值 → `medium`

#### Enhanced / Basic 模式（`crg.indexed=false`）

3 批次，同 response 并行（≤8 calls），批次间串行：

- **Batch 1**（基础探测）：`project_identity` + `layers`
  - Enhanced 用 `mcp__serena__get_symbols_overview` / `search_for_pattern`
  - Basic 用 `Glob` + `Read` 元文件
- **Batch 2**（依赖 primary_language）：`entrypoints` + `modules` + `integrations` + `data_shapes`
  - Enhanced 用 `mcp__serena__find_symbol` / `search_for_pattern`
  - Basic 用 `Glob` + `Read`
- **Batch 3**：`testing_surface` + `risk_signals`（confidence 上限 Inferred，severity 上限 medium）

**severity 约束**：
- 单一信号 → `medium`
- ≥2 独立信号同时命中 → `high` 可用

#### 1.6 写入控制面（所有模式共享）

写入顺序：`fact-inventory.json` → `risk-signals.json` → `test-surface.json` → `artifact-manifest.json`

**7 项校验**：
1. JSON 合法
2. `schema_version` 存在
3. `analyzer_mode ∈ {full, enhanced, basic}`
4. `coverage_gaps.evidence` 非空（无证据填 `["no-direct-evidence"]`）
5. `coverage_gaps.severity ∈ {high, medium}`（不得 low）
6. **Full 模式 `entrypoints` 非空**（空 → 写错误且降级产物标注 `[entrypoints-fallback]`）
7. 任一失败 → 报告错误，不进入后续 Phase

**generation_errors 格式**：
```yaml
generation_errors:
  - extractor: string         # "entrypoint_extractor" 等
    stage: A | B | C | null
    error: string
    affected_fields: [string]
    fallback_applied: bool
```

去重与上限：
- `(extractor, error)` 完全相同跳过
- 上限 50 条，达上限追加哨兵 `{ extractor: "system", error: "generation_errors-truncated-at-50", ... }`

---

### Phase 2 — PRD Quality Gate

**前置检查**（任一失败终止）：
1. `fact-inventory.json` 文件存在
2. JSON 合法非空
3. `schema_version == "v1"`
4. `analyzer_mode` 为枚举值之一
5. `project_identity.name` 非空

**固定产物 PRD**：
- `00-summary.md` ← `project_identity`
- `architecture/module-map.md` ← `modules` + `data_shapes`
- `pitfalls/index.md` ← `risk_signals` + `integrations`
- `code-facts/public-entrypoints.md` ← `entrypoints`
- `code-facts/test-map.md` ← `testing_surface` + `test-surface.json`
- `code-facts/high-risk-modules.md` ← `risk_signals`
- `context-packs/review-change.md` ← 静态组装

**条件产物**：`database-context`（`database[].present=true` 且 `db_type=mysql` 且 `db_access_level ≠ Level3`）

**Quality Gate 5 项自动 enrich**：
1. `Goal` 指向 `fact-inventory` 具体字段（如 `fact.modules[0].name`）
2. `Context` 含真实字段值（路径、类名、community_id）
3. `Files to Fill` 精确文件路径
4. `Technical Notes` ≥1 项目专属约束
5. risk-signal 引用：`pitfalls/index.md` 和 `high-risk-modules.md` 必须引用 ≥1 条 `severity≥medium` 信号（含 path + symbol）

失败 → 自动从 fact-inventory 补齐 Context → 重试 1 次 → 仍失败记 `prd-quality-gate-failed` 并最小化 Technical Notes 继续。

---

### Phase 3 — 文档生成

**事实层 → 摘要层，不回扫源码**。Worker 只消费 `fact-inventory.json`。

**并行 Workers**（消费对应事实块）：并列生成 7 个固定 v1 产物

**条件 Worker**：database worker（四层索引 Tier 0/1/2/3，详见 `references/database-worker.md`）

**串行最后**：`README.md`（上下文控制台）
```markdown
# <project_identity.name> · Context Pack

Generated: <ISO> | Mode: <analyzer_mode> | Graph: <graph_support_state>

## 产物状态
| 产物 | 状态 | 备注 |
| 00-summary.md | generated | |
| ...
状态枚举：generated / skipped / failed

## 异常摘要
<generation_errors 非空时列 {extractor, error}；否则 "无">
```

**artifact-manifest.json 第二次写入**：
- `status: complete` + `updated_at`
- `outputs` 列每个产物的 `depends_on: ["schema:fact_inventory@v1", "analyzer:module_structure@v1", ...]`
- **深合并**：database worker Step 6 已写入的 `table_hashes` / `domain_assignments` 保持不变

**收尾**：
- Phase 3/4 全成功 → 删除 backup
- 固定 v1 产物任一失败 → 恢复 backup，停止
- database worker 失败 → 只记 error，不触发恢复

---

### Phase 4 — 路由生成

生成 `docs/contexts/<slug>/injection-index.yaml`：

```yaml
always:
  - 00-summary.md
  - README.md

stages:
  plan:
    - architecture/module-map.md
    - database/database-index.md        # 文件不存在时静默跳过
  work:
    - code-facts/test-map.md            # database 文档不预注入
  review:
    - code-facts/high-risk-modules.md
    - pitfalls/index.md
    - context-packs/review-change.md
    - code-facts/test-map.md
    - database/database-index.md
    - database/data-flow.md
  unknown:
    - README.md

selection_rules:
  - condition: "output_exists.code_facts_public_entrypoints"
    inject: [code-facts/public-entrypoints.md]
  - condition: "fact.graph_support_state == 'local-available'"
    inject: [architecture/module-map.md, code-facts/high-risk-modules.md]

advice:
  review: "优先 code-facts 和 risk signals；已注入 database-index + data-flow"
  work: "优先 code-facts 和 test-map；database 文档按需 Read"
  plan: "优先 architecture/module-map 和 database-index"
```

**selection_rules 三类 condition**（由 `src/context-routing/evaluator.js` 消费）：
- `output_exists.<key>` — key 规则：路径 `/` 和 `-` 替换 `_`，去扩展名
- `stage_is.<stage>` — 阶段等值判断
- `fact.*` — v1 显式跳过，不做实际判断

---

## 三、降级链路

```
Full (CRG CLI)       crg.indexed=false
confidence: high ──→  Enhanced (Serena)      serena.ready=false
severity: 无上限       confidence: medium ──→  Basic (Built-in)
                      severity 上限: medium   confidence: low
                                              severity 上限: medium
```

**降级必须留痕**：
- 降级事件写 `generation_errors[]`
- `analyzer_mode` 字段记录最终模式
- `README.md` Freshness 章节体现降级原因

### 置信度枚举（inference_reason 必填）

**CRG Tier（Full）**：
- `crg-importers-evidence` / `crg-dependents-evidence` / `crg-tests-for-evidence`
- `crg-semantic-search-evidence`
- `crg-blast-radius-threshold` / `crg-large-function-heuristic`

**Serena Tier（Enhanced）**：
- `serena-pattern-match` / `serena-symbol-evidence`

**Built-in Tier（所有模式 fallback）**：
- `directory-naming-pattern` / `path-naming-pattern`
- `grep-import-pattern` / `read-source-code`
- `package-json-analysis` / `glob-pattern-match`

**约束**：
1. `inference_reason` 必须使用上述枚举值，不得自由描述
2. `crg query` 全系列固定输出 `Inferred`
3. 单条 `inferred` 事实不得触发 `high` severity，除非 ≥2 独立信号
4. `crg query` 的 `--symbol` / `--module` / `--subject` 必须是 **symbol_key 字符串**（`<file_path>#<kind>#<name>#L<line_start>`），不接受裸名
5. `crg search` 底层 FTS5：多词须各自独立调用，空格 = 短语匹配

---

## 四、CRG 数据底座（`src/crg/`）

### 4.1 入口分发（`cli/router.js`）

17 子命令 + `postprocess`。HANDLER_MAP 支持 `{module, fn}` 对象（如 `stats → {module:'./build', fn:'runStats'}`）。

- `--repo=<path>` 强制校验存在且为目录（否则 exit 1）
- handler MODULE_NOT_FOUND → exit 2 提示 "run crg build first"
- handler 导出函数名不存在 → exit 2

### 4.2 SQLite Schema（`migrations.js` - 7 表 + FTS5）

```
PRAGMA foreign_keys = ON
PRAGMA journal_mode = WAL
PRAGMA synchronous = NORMAL
PRAGMA cache_size = -64000
PRAGMA temp_store = MEMORY
PRAGMA mmap_size = 268435456
```

**communities**（先建，nodes 外键引用）：
- `id PK / label / file_count / health_status CHECK(healthy|isolated|fragmented|scattered) / health_density / health_independence`

**nodes**（核心表）：
- `id (symbol_key) PK / file_path / name / kind / line_start / line_end / is_test`
- `generation_id / parser_quality DEFAULT 'ok'`
- `summary / retrieval_text / community_id FK ON DELETE SET NULL`
- `confidence DEFAULT 'Observed' / source_tier DEFAULT 'crg_ast' / evidence(JSON) / inference_reason`

**edges**：`id PK / source_id / target_id / kind / weight` — ON DELETE CASCADE

**flows / flow_nodes**：入口节点 + criticality + depth + 多对多位置

**graph_meta**：单行（CHECK id=1）/ schema_version / last_built / analyzer_version / unresolved_edge_count

**fingerprints**：file_path PK / sha256 / updated_at

**unresolved_edges**：AUTOINCREMENT / source_id / source_file / edge_kind / target_name / target_path_raw

**chunks**：语义分块供 HNSW 向量化（node_id FK / parent_symbol_id / file_path / line range / retrieval_text）

**fts_nodes (FTS5 虚表)**：独立存储（非 content=nodes，迁移逻辑 DROP 旧版重建）
- 列：node_id UNINDEXED / name / retrieval_text / file_path UNINDEXED / kind UNINDEXED

**索引**：
```
idx_nodes_file_path / idx_nodes_kind / idx_nodes_file_path_kind / idx_nodes_is_test
idx_edges_source / idx_edges_target / idx_edges_source_kind / idx_edges_target_kind / idx_edges_kind
idx_unresolved_edges_source_file / idx_unresolved_edges_kind
idx_chunks_node_id / idx_chunks_file_path
```

**迁移兼容**：ADD COLUMN 方式补 `flows.name/depth`、`nodes.generation_id/parser_quality/summary/retrieval_text`；communities CHECK 缺失时 RENAME 重建；fts 含 `content=nodes` 或缺 `retrieval_text` 列时 DROP 重建。

### 4.3 输入收敛 10 阶段（`input-convergence.js`）

```
1. 获取候选文件（tracked-only / tracked+untracked / all-files，maxBuffer=256MB 防 ENOBUFS）
2. iOS 自动模式升级（Podfile.lock 或 *.xcodeproj/*.xcworkspace 存在 → isIos=true）
3. DEFAULT_EXCLUDES (glob)：
   .git/** .claude/** .codex/** .agents/** .spec-first/** .code-review-graph/**
   graphify-out/** node_modules/** dist/** build/** .next/** .nuxt/** .turbo/**
   .cache/** coverage/** .nyc_output/** DerivedData/** Carthage/**
   .gradle/** .m2/** vendor/** bin/Debug/** bin/Release/** target/**
   __pycache__/** .venv/** venv/** .pytest_cache/**
4. .spec-firstignore 规则（GRAPH_IGNORE_FILE 常量）
5. 适配器 extraExcludes / extraIncludes
6. SENSITIVE_PATTERNS（硬规则，不可白名单绕过）：
   /^\.env(\.|$)/i / credentials?\.(json|ya?ml)$/i / secrets?\.(json|ya?ml)$/i
   /\.pem$/i / private[\s_-]?key/i
7. BINARY_EXTS 过滤：png/jpg/jpeg/gif/svg/ico/woff*/ttf/otf/eot/mp4/mp3/mov/
   zip/tar/gz/bz2/xz/7z/rar/pdf/lock（豁免 package-lock.json / Podfile.lock）
8. EXT_TO_LANG 语言过滤（只保留可解析代码）
9. 输出排序
10. 推导 presentLanguages
```

iOS 下额外调用 `computePodExcludePaths`：Pods/** 兜底 + 本地 `:path:` Pod 白名单。

### 4.4 解析器（`parser.js`）

支持 14 种语言：`javascript / typescript / tsx / python / go / java / rust / c / cpp / objc / swift / kotlin / ruby / php / c-sharp / scala`。

**关键设计**：
- `PARSER_CACHE = Object.create(null)` 防原型污染
- 用 `!== undefined` 区分"未查询"与"已知失败"，避免重复 require
- **TOCTOU-safe**：单次 `readFileSync` 同时用于 SHA256 和内容解析
- tree-sitter 未安装 → graceful degradation（返回 module 节点 + 空边）
- symbol_key 格式：`<file_path>#<kind>#<name>#L<line_start>`
- TEST_FILE_RE `/\.(test|spec)\.[jt]sx?$|__tests__\//` + TEST_NAME_RE `/^(it|test|describe|beforeEach|...)$/`

**ObjC 专项**：
- `.m` / `.mm` → tree-sitter-objc；`.h` 启发式路由
- `@interface` / `@implementation` / `@protocol` 提取 class/interface + 方法选择器
- `NS_ASSUME_NONNULL_BEGIN/END` 预处理
- `#import "file.h"` 无路径 → basename 查 module 节点，多候选取最近邻

**CommonJS**：`require()` → `imports_from` 边；module 节点继承 `isTestFile` 标记。

### 4.5 图写入与边解析（`graph.js`）

**`resolveEdges` 六阶段**（缓存用 `Object.create(null)` 防原型污染）：
1. 直接 `target_id` 已给
2. 精确 `file_path` 匹配
3. 相对路径解析（`require('./x')` + 扩展名探测）
4. basename 模糊匹配（ObjC `#import "file.h"` 按 basename 查 module，多候选最近邻）
5. 全局符号表
6. 同文件消歧

**未解析边**：写入 `unresolved_edges` 表 + 更新 `graph_meta.unresolved_edge_count`；`build` 输出 `last_build_unresolved_summary` 含 top_kinds / top_source_files / sample_count / samples。

**upsert 语义**：
- `upsertNodes`：ON CONFLICT(id) 更新所有字段；community_id 默认 NULL（后续社区检测填充）；evidence JSON 序列化；confidence/source_tier/inference_reason 默认 Observed/crg_ast/null。
- 文件级局部替换：先 `deleteStaleNodes(rebuildableFiles)`（级联删边）→ 再 `upsertNodes`，避免函数改名/删除/行号变化时旧事实残留。

### 4.6 增量构建（`incremental.js`）

SHA256 分类：
- filePaths 中无 DB 记录 或 SHA 变化 → `changed`
- filePaths 中有记录且 SHA 未变 → `unchanged`
- DB 有记录但不在 filePaths 中 → `deleted`
- 文件读取失败（ENOENT）→ 从 filePaths 移出，归入 deleted

**优化**：`detectChangedFiles` 返回 `changedShas` 供 `updateFingerprints` 复用，避免二次读取。SQLite IN 分片 CHUNK_SIZE=900（低于默认 SQLITE_MAX_VARIABLE_NUMBER=999）。

**解析质量分类**（`classifyParseQuality`）：
- `no_parser` / `parse_error` → 退化结果，不覆盖旧事实，只输出质量告警
- `module_only` → 仅保留 module 节点，算可重建
- `ok` → 正常参与文件级局部替换

`build` 输出 warnings：
- `skipped_sensitive` / `no_parser_files` / `parse_error_files` / `module_only_files`
- `high_unresolved_edge_rate`（unresolvedRate > 0.1）
- `force_rebuild_partial`（--force 且存在 parser degradation）
- `generation_health_failed`

### 4.7 Generation 管理（`generations/*`）

每次 build：
1. `generationId = ISO 时间戳去分隔符`
2. 新 DB 路径：`.spec-first/graph/generations/<id>/graph.db`
3. 旧 active DB copy 到新 generation 目录
4. 执行 build
5. `assessGenerationHealth` 判定（节点数、边数等）
6. 健康 → `promoteGeneration`：
   - 写 `current.json`（指针 JSON：`{generation_id, db_path, promoted_at, status:'healthy', node_count, edge_count}`）
   - 写 `last-known-good.json`
   - 复制 DB 到主位置 `graph.db`
7. 不健康 → 不升 active 指针，保留上一次 last-known-good

**所有 stats/context/query 调用走 `resolveActiveGraphDb`**：优先 current → last-known-good → 默认 graph.db。**读者永远不会读到半构建状态**。

### 4.8 Postprocess 流水线（顺序不可颠倒）

```
writeCommunities
  ├── Pass 1: CONTAINER_DIRS 跳过 + 顶层目录分组
  │   CONTAINER_DIRS = {src, lib, app, pkg, internal, external, core, main,
  │                     common, shared, utils, helpers, modules, components,
  │                     services, controllers, models, api, server, client,
  │                     web, backend, frontend}
  ├── Pass 2: O(E) 健康评估（density, independence）→ healthy/isolated/fragmented/scattered 四象限
  └── Pass 3: 超大社区（file_count > total_nodes × 25%）BFS 连通分量精化
        最小 4 节点约束
↓
detectFlows
  ├── 仅加载 'calls' 边构建邻接表
  ├── 5 因子 criticality 评分
  └── BFS maxDepth=5 / maxNodes=20 / 最多 100 flows
↓
analyzeGraph
  ├── surprising_connections（4 因子评分 0-100，spec §14.6）：
  │   confidence_weight + cross_language + cross_community + peripheral_to_hub
  │   过滤结构边：imports_from / contains / defined_in
  └── god_nodes：in_degree 前 5%，排除 module 节点
↓
rebuildFTS
  独立 FTS5 全量 drop-recreate，依赖最终 nodes 状态（含 community_id 更新后）
```

### 4.9 8 种 Query Pattern + Context + Impact

| pattern | 必填参数 | inference_reason |
|---|---|---|
| callers_of / callees_of | --symbol | call_graph_traversal |
| importers_of / importees_of | --module | import_analysis |
| dependents_of / dependencies_of | --module | import_analysis |
| tests_for | --subject | naming_convention |
| similar_to | --symbol | directory_proximity |
| children_of | --module | containment_analysis |
| file_summary | --file | file_structure |
| inheritors_of | --symbol | inheritance_analysis |

**`crg context` 输出**：
- `top_hubs`：in_degree 降序 Top5 非 module（confidence:Inferred, evidence:[in_degree=N], inference_reason:call_graph_traversal）
- `top_communities`：file_count Top3（alias id → community_id）
- `top_flows`：criticality Top3（alias id → flow_id）
- `summary`：`N nodes, M edges, K communities, J flows`
- `ranked_context`：挂载 `retrieval/api.js` 的 plan profile 结果

### 4.10 检索与生成扩展

**retrieval/**：
- query-plan → seed → expand → rerank（BM25 + 向量）→ semantic-rerank（HNSW ANN）→ pack（token budget 打包）→ profiles（plan/work/review）→ api 统一入口
- chunks 表为向量化基础；`buildChunksForNodes` 按 maxLines（默认 80，按语言可覆盖）切分非 module 节点
- rerank 对 `retrieval_text` 做混合检索，semantic-rerank 做向量相似度重排

**generations/**：
- `health.js` 判定 generation 健康
- `promote.js` 升 active pointer
- `rollback.js` 回退到 last-known-good
- `paths.js` 提供 `buildGenerationId` / `resolveActiveGraphDb` / `resolveGenerationDb` / `writeGraphPointer` / `readGraphPointer`

### 4.11 Envelope 与路径契约

所有 CLI 子命令统一 `makeEnvelope(repoRoot, data, {warnings, degraded})` 输出 JSON。

**`artifact-paths.js` 纯函数**（无 I/O）：
- `resolveGraphDir` → `.spec-first/graph/`
- `resolveGraphDb` → `.spec-first/graph/graph.db`
- `resolveGraphInputFingerprints` → `.spec-first/graph/input-fingerprints.json`
- `resolveWorkflowArtifactDir(repoRoot, 'bootstrap', slug)` → `.spec-first/workflows/bootstrap/<slug>/`
- `resolveContextDocsDir(repoRoot, slug)` → `docs/contexts/<slug>/`
- 支持 `options.artifactAnchorRoot` 偏离 repoRoot

**文件名常量**：
- `GRAPH_INPUT_FINGERPRINTS_FILE = 'input-fingerprints.json'`
- `GRAPH_DB_FILE = 'graph.db'`
- `GRAPH_CURRENT_FILE = 'current.json'`
- `GRAPH_LAST_KNOWN_GOOD_FILE = 'last-known-good.json'`
- `GRAPH_GENERATIONS_SUBDIR = 'generations'`
- `BOOTSTRAP_ARTIFACT_MANIFEST_FILE = 'artifact-manifest.json'`
- `GRAPH_IGNORE_FILE = '.spec-firstignore'`

---

## 五、编译层（`src/bootstrap-compiler/`）

主链入口 `orchestrator.js`：
```
compileBootstrapArtifacts
  ├── compileMachineArtifacts  (fact-inventory / risk-signals / test-surface / manifest)
  ├── compileHumanAssets       (docs/contexts/<slug>/ 下 md 资产)
  └── compileRouting           (context-routing.json + injection-index.yaml)
```

返回 `{status: complete|failed, generated_at, stages: [{name, status}], machine_artifacts, human_assets, routing, error?}`。失败时精确定位失败 stage（machine-artifacts / human-assets / routing）。

其他模块：
- `freshness.js` — 新鲜度管理（进入 `freshness.json`）
- `lint.js` — 产物 lint
- `contradictions.js` — 冲突检测
- `rollback.js` — 失败回退
- `workspace-compiler.js` / `workspace-registry.js` — workspace 场景
- `review-queue.js` / `review-queue-state.js` — 人工 review 队列
- `ownership.js` / `ownership-registry.js` — 产物归属
- `sample-generator.js` — 样本生成
- `schema-loader.js` — schema 加载
- `run-bootstrap.js` — 端到端驱动
- `compile-minimal-context.js` — 最小上下文兜底

---

## 六、消费层（`src/context-routing/`）

- `loader.js`：读取 `injection-index.yaml` / `artifact-manifest.json` / `freshness.json`，解析 `controlPlaneDir` / `contextDir`，按先控制面后上下文两级 `findExistingAsset`。
- `evaluator.js`：
  - `buildOutputExistsMap` 基于 `manifest.outputs` 生成 key（去扩展名 + `/-.` 替换为 `_`）
  - `evaluateSelectionRule` 三分支：`output_exists.*` / `stage_is.*` / `fact.*`（v1 跳过）
  - `evaluateContext` 加载 `always → stages.<stage> → selection_rules → advice.<stage>`
  - manifest 缺失/status≠complete → L3 fallback（统一回退到 `00-summary.md / pitfalls/index.md / code-facts/public-entrypoints.md / code-facts/test-map.md`）
- `priority.js`：`trimAssetsToBudget` token 预算裁剪
- `profiles.js`：stage 归一化 + minimal context 偏好
- `fallback.js`：L3 fallback 资产清单
- `telemetry.js`：消费遥测
- `workspace-loader.js` / `entry-resolver.js`：workspace/多入口

---

## 七、关键设计铁律（汇总）

1. **幂等优于断点续传**：`status: in_progress` 中断重跑必须从 Phase 0 开始。
2. **写入顺序严格**：communities → nodes（FK）；postprocess writeCommunities → detectFlows → analyzeGraph → rebuildFTS。
3. **不允许静默覆盖**：Rerun backup + 空文件校验 + 失败全量回滚。
4. **Full 模式 `entrypoints` 非空是硬约束**：空则降级标注 `[entrypoints-fallback]` 并写 `generation_errors`。
5. **降级事件必须留痕**：`analyzer_mode` + `generation_errors` + README Freshness 三位一体。
6. **并行语义合约**：同 Stage 批量发出工具调用，Stage 间串行。
7. **Schema contract 机器优先**：`docs/contracts/spec-graph-bootstrap/*.schema.json` 是真源；SKILL.md 只保留流程与语义解释。
8. **节点 ID 格式强约束**：`crg query` 的 `--symbol` / `--module` / `--subject` 必须是 symbol_key 字符串（`<file>#<kind>#<name>#L<line>`），不接受裸名。
9. **FTS5 多词独立调用**：空格 = 短语匹配，不支持多词 OR。
10. **Generation 隔离**：每次 build 写 generation 目录，健康检查通过才升 active pointer，读者永远不会读到半构建状态。
11. **路径常量集中**：所有路径经 `artifact-paths.js` 纯函数解析，禁止字符串拼接。
12. **敏感文件硬规则**：SENSITIVE_PATTERNS 不可被白名单绕过。

---

## 八、产物结构速查

```
.spec-first/
  graph/
    graph.db                          # active DB 主位置
    current.json                       # active generation 指针
    last-known-good.json              # 回退指针
    input-fingerprints.json           # SHA 快照
    generations/
      <generationId>/
        graph.db                       # 每次 build 隔离 DB
  workflows/
    bootstrap/
      <slug>/
        fact-inventory.json           # 控制面（所有 Worker 输入源）
        risk-signals.json
        test-surface.json
        artifact-manifest.json        # 两段写入 in_progress → complete
        backup_<ISO>/                 # Rerun Backup（成功后删除）

docs/
  contexts/
    <slug>/
      README.md                        # 上下文控制台
      00-summary.md
      architecture/module-map.md
      pitfalls/index.md
      code-facts/public-entrypoints.md
      code-facts/test-map.md
      code-facts/high-risk-modules.md
      context-packs/review-change.md
      database/                        # 条件（MySQL L1/L2）
        database-index.md              # Tier 0 总索引
        data-flow.md                   # Tier 2 核心业务数据流
        database-er.md                 # ≤30 表 Tier 1A
        domains/<name>-domain.md × N   # >30 表 Tier 1B
        semantic-catalog.md            # >100 表 Tier 3
      injection-index.yaml             # Phase 4 路由
  contracts/
    spec-graph-bootstrap/
      artifact-manifest.schema.json
      context-routing.schema.json
      freshness.schema.json
      minimal-context.schema.json

.spec-firstignore                      # CRG 输入忽略规则
```

---

## 九、演进方向参考

- **schema contract 优先**：SKILL.md 文本调整前应先调整 `docs/contracts/spec-graph-bootstrap/*.schema.json`。
- **injection-index `fact.*` 条件**：当前 v1 跳过，未来可由 evaluator 读取 `fact-inventory.json` 做真判定。
- **generation 健康判定**：目前基于节点/边数量阈值，可扩展为更精细的质量指标（如 unresolved_rate、parser_degradation_rate 的加权）。
- **retrieval 层 profiles**：plan/work/review 默认 query 固定，可进一步基于 fact-inventory 动态生成。
- **多语言覆盖**：14 种语言中部分仅 module 节点退化（kotlin、scala、c-sharp 深度有限），可按需加入更完整的 tree-sitter 查询。

---

## 十、在整个项目中的定位

### 10.1 一句话定位

**spec-graph-bootstrap 是整个 spec-first 工作流的"事实层生产者"** —— 它是唯一调用 CRG 数据底座产出 AST 级事实、并把事实物化为下游所有阶段可消费上下文的入口。

### 10.2 在工作流主链上的位置

```
Host Setup         →  Stage-0          →  Ideate → Brainstorm → Plan → Work → Review → Compound
(spec-mcp-setup)      ┌─ spec-graph-bootstrap        ↑                                          ↑
                      └─ spec-graph-bootstrap  │                                          │
                                               └───── 消费 docs/contexts/<slug>/ ────────┘
```

它是 Stage-0 两个并列入口之一：

- `spec-graph-bootstrap` — 稳定默认，Serena/Built-in 为主，适合没有本地图索引的项目
- `spec-graph-bootstrap` — graph-informed，**以 CRG 为 Tier 1**，事实置信度更高（high vs medium/low）

两者产出**同构**的 `docs/contexts/<slug>/` 与 `.spec-first/workflows/bootstrap/<slug>/`，下游消费方不需要感知入口差异——这是把"数据源质量"与"消费合约"解耦的关键设计。

### 10.3 在三层架构中的位置

```
Entry Layer:      spec-first CLI       (doctor / init / clean)
Workflow Layer:   spec-graph-bootstrap ← 本 skill（唯一调用 CRG CLI 的 workflow skill）
                  其他 spec-* skills   (消费，不构建)
Capability Layer: agents/ (review/research/design/workflow)
```

**spec-graph-bootstrap 是唯一跨越 workflow 层与数据底座的 skill**：

- 上承 SKILL 文本合约（Phase 0–4）
- 下接 `spec-first crg` CLI 17 个子命令
- 再往下是 `src/crg/` 的 SQLite + tree-sitter + FTS5 + HNSW 底座

其他所有 skill 都是 **纯消费者**，不直接触碰 `graph.db`、不直接调 `crg` CLI。

### 10.4 生产者 / 消费者关系

**spec-graph-bootstrap 是以下产物的唯一生产者**：

| 产物 | 消费方 |
|---|---|
| `.spec-first/workflows/bootstrap/<slug>/fact-inventory.json` | Phase 2/3 内部 Worker；`spec-plan` / `spec-work` / `spec-review` 的 Stage-0 预载块 |
| `.spec-first/workflows/bootstrap/<slug>/risk-signals.json` | `spec-review`（高风险模块注入）、`spec-work`（风险感知） |
| `.spec-first/workflows/bootstrap/<slug>/test-surface.json` | `spec-work`（测试策略）、`spec-review`（测试覆盖） |
| `.spec-first/workflows/bootstrap/<slug>/artifact-manifest.json` | `src/context-routing/evaluator.js` 的 `output_exists.*` 解析 |
| `docs/contexts/<slug>/*.md` (7+ 固定产物) | `spec-plan` / `spec-work` / `spec-review` 按阶段注入 |
| `docs/contexts/<slug>/injection-index.yaml` | `src/context-routing/` 全套消费链的路由真源 |

**它是 CRG 数据底座的唯一"业务调用点"**：`src/crg/` 的所有 CLI 子命令（`stats / context / query / impact / search / flows / ...`）都只在 spec-graph-bootstrap 的 Phase 1 被编排调用。其他 skill 没有 CRG 入口。

### 10.5 与下游 skill 的契约接口

`injection-index.yaml` 是 spec-graph-bootstrap → 其他 skill 的**单一合约接口**：

```yaml
always:           # 所有阶段预载
stages.plan:      # spec-plan 预载
stages.work:      # spec-work 预载
stages.review:    # spec-review 预载
selection_rules:  # output_exists.* 动态路由
advice.<stage>:   # 阶段提示
```

下游 skill（`spec-plan/SKILL.md`、`spec-work/SKILL.md`、`spec-review/SKILL.md`）在入口处都有 Stage-0 上下文预载块，固定消费顺序：

```
always[] → stages.<stage>[] → selection_rules(output_exists.*) → advice.<stage>
```

`injection-index.yaml` 不可用时，统一回退到 4 个最小文件（`00-summary.md` / `pitfalls/index.md` / `code-facts/public-entrypoints.md` / `code-facts/test-map.md`）。

### 10.6 与兄弟 skill 的关系

| Skill | 与 spec-graph-bootstrap 的关系 |
|---|---|
| `spec-graph-bootstrap` | **同级并列替代**，产出同构；共享 `docs/contexts/<slug>/` 命名空间 |
| `spec-mcp-setup` | **上游依赖**，Phase 0 需要 host marker + Serena/CRG 就绪状态 |
| `spec-plan` / `spec-work` / `spec-review` | **下游消费者**，通过 injection-index 读取事实 |
| `spec-compound` | **间接下游**，沉淀 `docs/solutions/` 时可回引上下文事实 |
| `spec-ideate` / `spec-brainstorm` | 轻度消费（通常只读 `00-summary.md`） |
| `spec-debug` / `spec-optimize` | 按需读 `pitfalls/index.md` 和 `risk-signals.json` |
| `todo-create` / `todo-triage` / `todo-resolve` | 与本 skill 无直接依赖，但共享 `.spec-first/` 命名空间 |

### 10.7 在"治理铁律"上的核心角色

spec-graph-bootstrap 是 spec-first 治理理念的**具象化样本**：

1. **Observed 事实优先** — CRG 产出全部落到 SQLite，不靠 LLM 臆测
2. **置信度分级落地** — `Observed / Inferred` 三档 + `inference_reason` 枚举 + severity 上限随模式降级
3. **产物即合约** — schema 真源在 `docs/contracts/spec-graph-bootstrap/`，SKILL.md 只讲流程
4. **降级必留痕** — `analyzer_mode` + `generation_errors` + README Freshness 三位一体
5. **幂等优于断点续传** — 中断即全量重跑，避免半状态污染
6. **不静默覆盖** — Rerun backup + 空文件校验 + 失败全量回滚
7. **Generation 隔离** — 读者永远读不到半构建状态（current.json / last-known-good.json 双指针）

其他 skill 套用这套理念，但**只有 spec-graph-bootstrap 把它与真实代码解析绑定**。它是整个项目"从 prompt 工程到工程化 AI 工作流"的**物理层证据**。

### 10.8 演进视角

从项目路线图看，spec-graph-bootstrap 的角色在持续扩张：

- **早期**：bootstrap 只有单一入口（现在的 `spec-graph-bootstrap`），完全靠 Serena/Built-in
- **当前**：`spec-graph-bootstrap` 并列上线，作为 graph-informed 升级路径；`spec-graph-bootstrap` 保持稳定默认
- **中期趋势**：CRG 数据底座能力（retrieval / semantic-rerank / chunks）将让更多下游 skill 直接消费 `graph.db`，而非仅靠 `docs/contexts/<slug>/` 的 markdown
- **长期定位**：spec-graph-bootstrap 可能演化为**整个项目的"事实根源层"**，上层所有 AI 判断最终都能追溯到 AST 级 evidence

### 10.9 定位总结

**spec-graph-bootstrap 不是一个普通的 workflow stage，而是整个 spec-first 项目的"事实契约生产点"**：它把 CRG 数据底座的原始能力，编译成所有下游 skill 都能稳定消费的结构化事实，是把"AI 编码 → 规格驱动工程"这一命题**落到物理层**的关键结点。
