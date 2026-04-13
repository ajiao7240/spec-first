# spec-graph-bootstrap 执行逻辑流程图

> 生成时间: 2026-04-12
> 源文件: `.claude/skills/spec-graph-bootstrap/SKILL.md`

---

## 总体流程

```
┌─────────────────────────────────────────────────────────────────────┐
│                    /spec:graph-bootstrap [target]                    │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │   Phase 0: 就绪探测   │
                │   与模式判定          │
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │   Phase 1: 事实抽取   │
                │   (CRG CLI 路径)     │
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │   Phase 2: 任务规划   │
                │   (PRD task contracts)│
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │   Phase 3: 文档生成   │
                │   (事实 → 摘要)      │
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │   Phase 4: 路由生成   │
                │   (injection-index)  │
                └─────────────────────┘
```

---

## Phase 0 详细流程

```
┌──────────────────────────────────────────────────────────────┐
│ 0.1 Slug 生成（最先执行）                                      │
│     slug = basename(resolve(target))                          │
│     产物路径: .spec-first/workflows/bootstrap/<slug>/          │
│               docs/contexts/<slug>/                           │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 0.2 MCP 就绪探测                                              │
│     Step 0: 宿主选择 (Claude / Codex)                         │
│     Step 1: mcp-setup marker 检测                             │
│     Step 2: Serena MCP probe → serena.ready = true/false      │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 0.3 CRG 图状态检测                                            │
│                                                               │
│  ┌─ DB 不存在 (<target>/.spec-first/graph/graph.db)           │
│  │   → crg.indexed = false ──────────────────┐               │
│  │                                            │               │
│  ├─ DB 存在 → spec-first crg stats            │               │
│  │   ├─ 非零退出 / degraded=true              │               │
│  │   │   → crg.indexed = false ──────────────┤               │
│  │   ├─ node_count=0 且 edge_count=0          │               │
│  │   │   → crg.indexed = false ──────────────┤               │
│  │   └─ node_count > 0                        │               │
│  │       → crg.indexed = true ──── 3c stale ─┤               │
│  │                                            │               │
│  └────────────────────────────────────────────┘               │
│                     │                                         │
│                     ▼  [crg.indexed=false]                    │
│             ┌───────────────┐                                  │
│             │ 提示用户构建？  │                                  │
│             └───┬───────┬───┘                                  │
│              是 │       │ 否                                   │
│                 ▼       ▼                                      │
│         crg build   crg.indexed=false                          │
│         ┌──┴──┐      降级到 Enhanced/Basic                     │
│        成功  失败/超时                                          │
│         │     │                                                │
│         │     └→ crg.indexed=false, 降级, 写 generation_errors │
│         ▼                                                      │
│   crg.indexed=true                                             │
│         │                                                      │
│         ▼                                                      │
│   3c. Stale 检测 (fingerprints vs stats data.last_built)       │
│       → 不一致: ⚠️ stale 警告（不阻断）                         │
└────────────┬───────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 0.4 分析模式判定                                               │
│                                                               │
│   crg.indexed=true  → mode=Full,     confidence=high          │
│   serena.ready=true → mode=Enhanced, confidence=medium         │
│   else               → mode=Basic,    confidence=low           │
│                                                               │
│   ┌──────────┐    失败     ┌───────────┐   失败   ┌─────────┐ │
│   │  Full    │───────────→│ Enhanced  │─────────→│  Basic  │  │
│   │ confidence: high      │ confidence: medium   │confidence│ │
│   │ severity: 无上限       │ severity: medium上限  │  : low  │  │
│   └──────────┘            └───────────┘          │sev: med  │  │
│                                                   └─────────┘  │
└────────────┬───────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 0.5 探测输出                                                  │
│     CRG: indexed=yes/no, nodes=N, edges=M                     │
│     Serena: ready=yes/no                                      │
│     分析模式: Full/Enhanced/Basic                              │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 0.6 写入 artifact-manifest.json（第一次写入, status=in_progress）│
│     路径: .spec-first/workflows/bootstrap/<slug>/             │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 0.7 Rerun Backup 准备                                         │
│     docs/contexts/<slug>/ 已存在？                             │
│     ├─ 是 → 备份到 backup_<ISO-timestamp>/                    │
│     │        校验备份（文件数一致）                              │
│     │        失败 → 停止，报告错误                              │
│     └─ 否 → 跳过 backup                                       │
└──────────────────────────────────────────────────────────────┘
```

---

## Phase 1 详细流程（Full 模式 CRG CLI 路径）

```
┌──────────────────────────────────────────────────────────────┐
│ 1.0 前置触发                                                  │
│     spec-first crg context --repo=<target>                    │
│     → data.top_flows, top_communities, top_hubs               │
│     → 确定后续 Stage 优先级                                    │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
╔══════════════════════════════════════════════════════════════╗
║  1.1 Stage A（全部并行）                                      ║
║                                                              ║
║  ┌──────────────────┐  ┌──────────────────┐                  ║
║  │ 4.2 Project       │  │ 4.9 Layer        │                  ║
║  │ Identity          │  │ Detection        │                  ║
║  │ crg stats         │  │ crg search ×N    │                  ║
║  │ + Read(pkg.json)  │  │ (框架特征 API)    │                  ║
║  └────────┬─────────┘  └────────┬─────────┘                  ║
║           │                     │                             ║
║  ┌────────┴─────────┐  ┌───────┴──────────┐                  ║
║  │ 4.8 Data Shapes   │  │ 4.10 Database    │                  ║
║  │ crg search ×6     │  │ Detection        │                  ║
║  │ (schema/entity/   │  │ Glob + Read      │                  ║
║  │  model/dto/       │  │ (沿用 spec-      │                  ║
║  │  migration/       │  │  bootstrap)      │                  ║
║  │  validation)      │  └──────────────────┘                  ║
║  │ + Read(node.file) │                                        ║
║  └───────────────────┘                                        ║
╚════════════════╤═════════════════════════════════════════════╝
                 │ (数据依赖: Stage A 输出供 Stage B 使用)
                 ▼
╔══════════════════════════════════════════════════════════════╗
║  1.2 Stage B-Round1（全部并行）                                ║
║                                                              ║
║  ┌──────────────────┐  ┌──────────────────┐                  ║
║  │ 4.3 Entrypoints   │  │ 4.4 Module       │                  ║
║  │ Round1            │  │ Structure R1     │                  ║
║  │ crg flows         │  │ crg communities  │                  ║
║  │ → flow_id 列表    │  │ + crg architecture│                  ║
║  └────────┬─────────┘  └────────┬─────────┘                  ║
║           │                     │                             ║
║  ┌────────┴─────────┐                                          ║
║  │ 4.5 Integration   │                                          ║
║  │ 预处理             │                                          ║
║  │ Read(package.json) │                                          ║
║  │ → 候选库名清单      │                                          ║
║  └───────────────────┘                                          ║
╚════════════════╤═════════════════════════════════════════════╝
                 │ (数据依赖: flow_id, community_id, 库名清单)
                 ▼
╔══════════════════════════════════════════════════════════════╗
║  1.3 Stage B-Round2（全部并行）                                ║
║                                                              ║
║  ┌──────────────────┐  ┌──────────────────┐                  ║
║  │ 4.3 Entrypoints   │  │ 4.4 Module       │                  ║
║  │ Round2            │  │ Structure R2     │                  ║
║  │ crg flow --id     │  │ crg community    │                  ║
║  │ × top-5           │  │ --id=<comm_id>   │                  ║
║  │                   │  │ × N communities  │                  ║
║  └────────┬─────────┘  └────────┬─────────┘                  ║
║           │                     │                             ║
║  ┌────────┴─────────┐                                          ║
║  │ 4.5 Integration   │                                          ║
║  │ Round2            │                                          ║
║  │ crg search <lib>  │                                          ║
║  │ × N 候选库名      │                                          ║
║  │ → lib_node_id     │                                          ║
║  └───────────────────┘                                          ║
╚════════════════╤═════════════════════════════════════════════╝
                 │ (数据依赖: lib_node_id)
                 ▼
╔══════════════════════════════════════════════════════════════╗
║  1.4 Stage B-Round3                                          ║
║                                                              ║
║  ┌──────────────────────────────────┐                        ║
║  │ 4.5 Integration Round3            │                        ║
║  │ crg query --pattern=importers_of  │                        ║
║  │   --module=<lib_node_id>          │                        ║
║  │ × N (每个库节点)                   │                        ║
║  └──────────────────────────────────┘                        ║
╚════════════════╤═════════════════════════════════════════════╝
                 │ (数据依赖: members[].id, entry_node, core_shared_node_id)
                 ▼
╔══════════════════════════════════════════════════════════════╗
║  1.5 Stage C（全部并行）                                      ║
║                                                              ║
║  ┌──────────────────┐  ┌────────────────────────────────┐    ║
║  │ 4.6 Test Surface  │  │ 4.7 Risk Signals               │    ║
║  │ crg query         │  │ crg impact ×≤5                 │    ║
║  │ --pattern=        │  │ crg large-functions             │    ║
║  │   tests_for       │  │ crg god-nodes                   │    ║
║  │ --subject=<id>    │  │ crg query dependents_of ×≤5    │    ║
║  │ × ≤10 members     │  │                                 │    ║
║  └──────────────────┘  └─────────────────────────────────┘    ║
╚════════════════╤═════════════════════════════════════════════╝
                 │
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ 1.6 写入控制面（所有 Stage 完成后）                             │
│                                                               │
│   写入路径: .spec-first/workflows/bootstrap/<slug>/            │
│                                                               │
│   ┌────────────────────┐  ┌────────────────────┐              │
│   │ fact-inventory.json │  │ risk-signals.json   │              │
│   └────────────────────┘  └────────────────────┘              │
│   ┌────────────────────┐  ┌───────────────────────┐           │
│   │ test-surface.json   │  │ artifact-manifest.json │           │
│   │                     │  │ (更新, 保持            │           │
│   │                     │  │  in_progress)          │           │
│   └────────────────────┘  └───────────────────────┘           │
│                                                               │
│   写入后校验:                                                  │
│   ✓ JSON 合法性                                               │
│   ✓ schema_version 存在                                       │
│   ✓ analyzer_mode ∈ {full, enhanced, basic}                   │
│   ✗ 失败 → 报告错误，不继续后续 Phase                           │
└──────────────────────────────────────────────────────────────┘
```

---

## Phase 1 依赖关系图

```
Stage A ──────┐
(并行)         │
               ▼
Stage B-R1 ───┐
(并行)         │
               ▼
Stage B-R2 ───┐
(并行)         │
               ▼
Stage B-R3    │
               │
               ▼
Stage C ──────┘
(并行)

依赖链路（串行）:
  A → B-R1 → B-R2 → B-R3 → C

每 Stage 内部:
  所有 Bash/Read 调用在同一 response 内并行发出
```

---

## Phase 2: 任务规划

```
┌──────────────────────────────────────────────────────────────┐
│ 前置检查: fact-inventory.json 存在且非空                        │
│   ├─ 不存在 → 停止                                            │
│   └─ 存在   → 继续                                            │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 为每个固定产物生成 PRD（带事实证据）                             │
│                                                               │
│   产物                        ← 数据源                        │
│   ─────────────────────────────────────────                   │
│   00-summary.md              ← project_identity               │
│   architecture/module-map.md ← modules + data_shapes          │
│   pitfalls/index.md          ← risk_signals + integrations    │
│   code-facts/public-entrypoints.md ← entrypoints              │
│   code-facts/test-map.md     ← testing_surface + test-surface │
│   code-facts/high-risk-modules.md ← risk_signals              │
│   context-packs/review-change.md ← 静态组装                    │
│       (risk_signals.high + coverage_gaps +                     │
│        entrypoints.http/worker + integrations.high-risk)       │
│                                                               │
│   条件产物（如 API 文档）→ 判定是否创建 task                     │
└──────────────────────────────────────────────────────────────┘
```

---

## Phase 3: 文档生成

```
┌──────────────────────────────────────────────────────────────┐
│ 前置: 若 docs/contexts/<slug>/ 已存在                          │
│       → 执行 0.7 Rerun Backup, 校验通过后继续                  │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 并行 Worker（各消费 fact-inventory.json）                       │
│                                                               │
│  ┌───────────────┐ ┌──────────────────┐ ┌─────────────────┐  │
│  │ 00-summary.md │ │ architecture/    │ │ pitfalls/       │  │
│  │               │ │ module-map.md    │ │ index.md        │  │
│  │ ← project_    │ │                  │ │                 │  │
│  │   identity    │ │ ← modules +      │ │ ← risk_signals  │  │
│  │               │ │   data_shapes    │ │   + integrations│  │
│  └───────────────┘ └──────────────────┘ └─────────────────┘  │
│                                                               │
│  ┌───────────────────────┐ ┌────────────────┐                │
│  │ code-facts/           │ │ code-facts/    │                │
│  │ public-entrypoints.md │ │ test-map.md    │                │
│  │                       │ │                │                │
│  │ ← entrypoints         │ │ ← testing_     │                │
│  │                       │ │   surface +    │                │
│  │                       │ │   test-surface │                │
│  └───────────────────────┘ └────────────────┘                │
│                                                               │
│  ┌───────────────────────┐ ┌────────────────────────────┐    │
│  │ code-facts/           │ │ context-packs/             │    │
│  │ high-risk-modules.md  │ │ review-change.md           │    │
│  │                       │ │                            │    │
│  │ ← risk_signals        │ │ ← 静态组装（不调 crg        │    │
│  │                       │ │   review-context）          │    │
│  └───────────────────────┘ └────────────────────────────┘    │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 串行（最后）:                                                  │
│   README.md（上下文控制台，汇总所有产物状态）                    │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ artifact-manifest.json 第二次写入                              │
│   status: complete                                            │
│   updated_at: <now>                                           │
│   outputs: { 各产物 depends_on 清单 }                          │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│ 收尾                                                          │
│   ├─ 成功 → 删除 backup 目录                                  │
│   └─ 失败 → 恢复 backup + 报告失败原因                         │
└──────────────────────────────────────────────────────────────┘
```

---

## Phase 4: 路由生成

```
┌──────────────────────────────────────────────────────────────┐
│ 生成 injection-index.yaml                                     │
│                                                               │
│   docs/contexts/<slug>/injection-index.yaml                   │
│                                                               │
│   结构:                                                       │
│   ┌─────────────────────────────────┐                         │
│   │ always: [...]                   │  ← 所有 task 注入       │
│   ├─────────────────────────────────┤                         │
│   │ stages:                        │                         │
│   │   plan: [...]                   │                         │
│   │   work: [...]                   │                         │
│   │   review: [...]                 │                         │
│   ├─────────────────────────────────┤                         │
│   │ task_types:                     │                         │
│   │   always / plan / work /        │                         │
│   │   review / unknown              │                         │
│   ├─────────────────────────────────┤                         │
│   │ selection_rules:                │                         │
│   │   - condition: "output_exists.*"│                         │
│   │     inject: [...]               │                         │
│   └─────────────────────────────────┘                         │
└──────────────────────────────────────────────────────────────┘
```

---

## 最终产物树

```
.spec-first/workflows/bootstrap/<slug>/
├── fact-inventory.json        ← 控制面（所有 Worker 输入源）
├── risk-signals.json
├── test-surface.json
└── artifact-manifest.json     ← 两段写入（in_progress → complete）

docs/contexts/<slug>/
├── README.md                  ← 上下文控制台
├── 00-summary.md              ← 项目摘要
├── architecture/
│   └── module-map.md          ← 模块地图
├── pitfalls/
│   └── index.md               ← 风险陷阱
├── code-facts/
│   ├── public-entrypoints.md  ← 公共入口点
│   ├── test-map.md            ← 测试地图
│   └── high-risk-modules.md   ← 高风险模块
├── context-packs/
│   └── review-change.md       ← 变更审查上下文
└── injection-index.yaml       ← 路由索引
```

---

## 降级链路

```
┌──────────┐  crg.indexed=false   ┌───────────┐  serena.ready=false  ┌─────────┐
│   Full   │────────────────────→ │ Enhanced  │────────────────────→ │  Basic  │
│          │                      │           │                      │         │
│ CRG CLI  │                      │ Serena    │                      │Built-in │
│          │                      │           │                      │         │
│ conf:    │                      │ conf:     │                      │ conf:   │
│  high    │                      │  medium   │                      │  low    │
│          │                      │           │                      │         │
│ sev:     │                      │ sev:      │                      │ sev:    │
│  无上限  │                      │  medium   │                      │  medium │
│          │                      │   上限    │                      │   上限   │
└──────────┘                      └───────────┘                      └─────────┘

降级规则:
  - 降级事件 → generation_errors[]
  - analyzer_mode 字段记录最终模式
  - README.md Freshness 章节体现降级原因
  - Enhanced/Basic 单一信号 → severity=medium
  - Enhanced/Basic ≥2 独立信号 → severity=high 可用
```

---

## 置信度体系

```
Observed（确定性）              Inferred（推断性）
──────────────────             ──────────────────
crg flows/communities 直接返回  crg query（固定 Inferred）
crg large-functions/impact     crg search kind 分类
Read(package.json/go.mod)      路径/目录命名模式
                               Serena 模式搜索
                               Grep import 推断

约束:
  - crg query 全系列固定输出 Inferred
  - 单条 inferred 事实不得触发 high severity
    （除非 ≥2 个独立信号支持）
  - crg query 的 --symbol/--module/--subject
    须为节点 ID 字符串（symbol_key 格式）
  - crg search 多词须各自独立调用（FTS5 限制）
```

---

## Rerun Backup 安全机制

```
Phase 3 写入前检查:
  docs/contexts/<slug>/ 已存在？
  │
  ├─ 否 → 跳过 backup，直接写入
  │
  └─ 是 → 备份到 backup_<ISO-timestamp>/
           │
           ├─ 校验通过（文件数一致）
           │   → 继续写入
           │   │
           │   ├─ Phase 3+4 全部成功 → 删除 backup
           │   │
           │   └─ 任一产物写入失败
           │       → 立即用 backup 全量恢复
           │       → 写入 generation_errors
           │       → 停止，不保留半覆盖状态
           │
           └─ 校验失败
               → 停止，报告错误
               → 不进入 Phase 3
```
