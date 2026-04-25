# CRG（Code Review Graph）完整代码分析文档

> 基于 `src/crg/` 全部 46 个源文件（13,697 行）的深度分析
> 分析时间：2026-04-17

---

## 1. 系统定位

CRG 是一个**本地代码图引擎**，以 tree-sitter AST 解析为基座，将代码库的结构关系（函数调用、模块导入、继承、包含）持久化到 SQLite，然后在图上执行社区检测、流程追踪、风险评估、全文搜索和任务感知的上下文检索，最终为 AI agent 的 plan/work/review 工作流提供结构化的代码理解信号。

---

## 2. 总体架构

```
+------------------------------------------------------------------+
|                          CLI Layer                                 |
|  router.js (17 子命令路由)                                         |
|  envelope.js (统一 JSON 输出)                                      |
|  open-db.js (只读 DB 连接)                                         |
+------------------------------------------------------------------+
        |
        v
+------------------------------------------------------------------+
|                       Build Pipeline                               |
|  input-convergence.js → parser.js → incremental.js → graph.js     |
|  (文件收集)         (AST解析)     (SHA增量)       (写入DB)          |
|                                                                    |
|  chunking.js (语义分块)   generations/ (代际管理)                    |
+------------------------------------------------------------------+
        |
        v
+------------------------------------------------------------------+
|                     Post-Processing Layer                          |
|  postprocess.js 编排:                                              |
|    communities.js → flows.js → analyze.js → search.js              |
|    (3-Pass社区)    (PageRank+BFS) (4因子分析) (FTS5重建)            |
+------------------------------------------------------------------+
        |
        v
+------------------------------------------------------------------+
|                      Query & Retrieval Layer                       |
|  cli/query.js (11种模式)   cli/context.js (上下文摘要)              |
|  commands/impact.js (反向BFS)  commands/review-context.js          |
|  commands/detect-changes.js (git diff 风险评分)                     |
|                                                                    |
|  retrieval/api.js 编排:                                            |
|    seed.js → expand.js → rerank.js → semantic-rerank.js → pack.js  |
|    (多源种子) (图扩展)    (启发式排序) (词项重排)       (预算打包)    |
+------------------------------------------------------------------+
        |
        v
+------------------------------------------------------------------+
|                       Storage Layer                                |
|  SQLite (WAL模式) + FTS5                                           |
|  9 tables: nodes, edges, communities, flows, flow_nodes,           |
|            graph_meta, fingerprints, unresolved_edges, chunks       |
|  1 virtual: fts_nodes (FTS5)                                       |
+------------------------------------------------------------------+
```

---

## 3. 数据库 Schema（9 表 + 1 FTS5 虚表）

```
migrations.js — 269 行

+------------------+     +------------------+     +------------------+
| communities      |     | nodes            |     | edges            |
+------------------+     +------------------+     +------------------+
| id TEXT PK       |<----| id TEXT PK       |<--->| id TEXT PK       |
| label TEXT       |     | file_path TEXT    |     | source_id TEXT FK|
| file_count INT   |     | name TEXT        |     | target_id TEXT FK|
| health_status    |     | kind TEXT        |     | kind TEXT        |
|   CHECK(healthy/ |     | line_start INT   |     | weight REAL      |
|   isolated/      |     | line_end INT     |     +------------------+
|   fragmented/    |     | is_test INT      |
|   scattered)     |     | generation_id    |     +------------------+
| health_density   |     | parser_quality   |     | chunks           |
| health_independ. |     | summary TEXT     |     +------------------+
+------------------+     | retrieval_text   |     | id TEXT PK       |
                         | community_id FK  |---->| node_id FK       |
                         | confidence TEXT   |     | parent_symbol_id |
                         | source_tier TEXT  |     | generation_id    |
                         | evidence TEXT     |     | file_path TEXT   |
                         | inference_reason  |     | kind TEXT        |
                         +------------------+     | name TEXT        |
                                                  | line_start/end   |
+------------------+     +------------------+     | summary TEXT     |
| flows            |     | flow_nodes       |     | retrieval_text   |
+------------------+     +------------------+     +------------------+
| id TEXT PK       |<----| flow_id TEXT FK   |
| entry_node_id FK |     | node_id TEXT FK   |     +------------------+
| name TEXT        |     | position INT      |     | fingerprints     |
| criticality REAL |     +------------------+     +------------------+
| node_count INT   |                               | file_path PK     |
| depth INT        |     +------------------+     | sha256 TEXT      |
+------------------+     | graph_meta       |     | updated_at TEXT  |
                         +------------------+     +------------------+
                         | id INT PK (=1)   |
                         | schema_version   |     +------------------+
                         | last_built TEXT   |     | unresolved_edges |
                         | analyzer_version |     +------------------+
                         | unresolved_edge  |     | id INT PK AUTO   |
                         |   _count INT     |     | source_id TEXT   |
                         +------------------+     | source_file TEXT |
                                                  | edge_kind TEXT   |
+------------------+                               | target_name TEXT |
| fts_nodes (FTS5) |                               | target_path_raw  |
+------------------+                               +------------------+
| node_id UNIDX    |
| name             |
| retrieval_text   |
| file_path UNIDX  |
| kind UNIDX       |
+------------------+
```

---

## 4. Build Pipeline 详解

### 4.1 文件收集（input-convergence.js — 728 行）

```
输入: repoRoot
  |
  v
+---------------------------+
| Step 1: 获取候选文件       |
|   tracked-only (git ls-files, maxBuffer=256MB)
|   tracked+untracked (+ git status --porcelain)
|   all-files (递归 walkDir, 非 git 仓库 fallback)
+---------------------------+
  |
  v  iOS 检测: Podfile.lock / .xcodeproj → isIos=true
+---------------------------+
| Step 2: iOS 自动模式升级   |
|   有 :path: 本地 Pod → tracked+untracked
|   Pods/** 兜底排除, 本地 Pod 白名单保留
+---------------------------+
  |
  v
+---------------------------+
| Step 3: 默认排除规则       |
|   .git, node_modules, dist, build, .next, .nuxt, .turbo,
|   .cache, coverage, DerivedData, Carthage, __pycache__,
|   .spec-first, vendor, target... (25 条)
+---------------------------+
  |
  v
+---------------------------+
| Step 4: .spec-firstignore  |
|   gitignore 语法 + ! 白名单
|   (ignore npm 包优先, SimpleIgnore fallback)
+---------------------------+
  |
  v
+---------------------------+
| Step 5: extraExcludes/Includes |
|   适配器注入的额外规则
+---------------------------+
  |
  v
+---------------------------+
| Step 6: 安全硬规则（不可绕过）|
|   .env*, credentials.*, secrets.*, .pem, private_key
+---------------------------+
  |
  v
+---------------------------+
| Step 7: 二进制扩展名过滤   |
|   png/jpg/gif/woff/mp4/zip/pdf/lock...
|   豁免: package-lock.json, podfile.lock
+---------------------------+
  |
  v
+---------------------------+
| Step 8: 语言过滤           |
|   INDEXABLE_EXTS (从 LANG_CONFIG 派生)
|   仅保留 tree-sitter 可解析的文件
+---------------------------+
  |
  v
+---------------------------+
| Step 9: 排序 + 推导语言    |
|   sorted + detectPresentLanguages
+---------------------------+
  |
  v
输出: { finalInputs[], presentLanguages, stats }
```

### 4.2 AST 解析（parser.js — 1,841 行，CRG 最大文件）

**支持 16 种语言**（通过 lang-config.js 配置）：

| 语言 | tree-sitter 包 | 扩展名 |
|------|---------------|--------|
| JavaScript | tree-sitter-javascript | js, jsx, mjs, cjs |
| TypeScript | tree-sitter-typescript | ts, mts, cts |
| TSX | tree-sitter-typescript (.tsx) | tsx |
| Python | tree-sitter-python | py, pyw |
| Go | tree-sitter-go | go |
| Java | tree-sitter-java | java |
| Rust | tree-sitter-rust | rs |
| C | tree-sitter-c | c, h |
| C++ | tree-sitter-cpp | cc, cpp, cxx, hpp |
| ObjC | tree-sitter-objc (vendor) | m, mm |
| Swift | tree-sitter-swift (vendor) | swift |
| Kotlin | tree-sitter-kotlin | kt, kts |
| Ruby | tree-sitter-ruby | rb |
| PHP | tree-sitter-php | php |
| C# | tree-sitter-c-sharp | cs |
| Scala | tree-sitter-scala | scala, sc |

**解析流程**：

```
parseFile(filePath, repoRoot)
  |
  v
[1. 语言检测]
  扩展名 → LANG_CONFIG 查表
  .h 特殊处理: ObjC 启发式检测
    (@interface/@implementation/@protocol → objc)
    (NS_ASSUME_NONNULL_BEGIN → objc)
    否则 → c
  |
  v
[2. tree-sitter 解析]
  懒加载 Parser 实例（缓存复用）
  语言加载失败 → { nodes: [module_node], rawEdges: [], reason: 'no_parser' }
  解析失败 → { ..., reason: 'parse_error:...' }
  |
  v
[3. AST 遍历]
  DFS 遍历 tree-sitter AST
  提取 node 类型:
    function / method / class / interface / struct / enum / module / variable
  每个 node 产出:
    { id: "<file_path>#<kind>#<name>#L<line_start>",
      file_path, name, kind, line_start, line_end, is_test }
  |
  v
[4. 边提取]
  import/require → imports_from 边
  函数调用 → calls 边
  继承/实现 → inherits / implements 边
  包含关系 → contains 边
  CommonJS require() → imports_from 边
  |
  v
[5. ObjC 特殊处理]
  @interface → class node
  @implementation → class node
  @protocol → interface node
  方法选择器提取
  NS_ASSUME_NONNULL_BEGIN/END 预处理
  |
  v
[6. 测试文件标记]
  file_path 含 test/spec/__tests__ → is_test=1
  module 节点继承 isTestFile 标记
  |
  v
输出: { nodes[], rawEdges[], reason? }
```

**buildChunksForNodes**（chunking.js — 170 行）：

```
对每个 node:
  if (line_end - line_start) > maxChunkLines:
    切分为多个 chunk，每个 ≤ maxChunkLines 行
    chunk_id = "{nodeId}:chunk:{index}"
  else:
    单个 chunk = 整个 node
  |
  v
输出: chunks[] (id, node_id, parent_symbol_id, file_path, kind, name,
               line_start, line_end, summary, retrieval_text)
```

### 4.3 增量检测（incremental.js）

```
detectChangedFiles(db, finalInputs, repoRoot)
  |
  v
[对每个文件计算 SHA-256]
  computeFileSHA(absPath) → { sha, size }
  |
  v
[与 fingerprints 表对比]
  新文件 (不在表中) → changed
  SHA 变化 → changed
  SHA 不变 → unchanged
  表中有但 finalInputs 无 → deleted
  |
  v
输出: { changed[], deleted[], changedShas: Map }

updateFingerprints(db, parsedChanged, deletedPaths, repoRoot, changedShas?)
  → UPSERT 成功解析的文件 SHA
  → DELETE 已删除/跳过的文件指纹
```

### 4.4 图写入（graph.js — 448 行）

**upsertNodes**：批量 INSERT OR REPLACE，含 generation_id / parser_quality / summary / retrieval_text。

**resolveEdges 六阶段解析**：

```
rawEdges (source_id, target_name, target_path_raw, kind)
  |
  v
[阶段 1: 直接 target_id]
  target_id 在 nodes 表中存在 → 已解析
  |  (未解析)
  v
[阶段 2: 精确 file_path]
  target_path_raw 精确匹配 nodes.file_path → 找到 module 节点
  |  (未解析)
  v
[阶段 3: 相对路径解析]
  require('./x') → 拼接 source 目录 + 相对路径 + 扩展名探测
  (.js, .ts, .tsx, /index.js, /index.ts)
  |  (未解析)
  v
[阶段 4: basename 模糊匹配]
  ObjC #import "file.h" 无路径 → 按 basename 查 module 节点
  多候选 → 取最近邻 (目录深度最接近 source)
  |  (未解析)
  v
[阶段 5: 全局符号]
  target_name 查 nodes.name (精确匹配)
  |  (未解析)
  v
[阶段 6: 同文件消歧]
  source_id 同 file_path 下按 name 查找
  |  (仍未解析)
  v
记入 unresolved_edges 表

缓存: Object.create(null) 防原型污染
```

**deleteStaleNodes**：按 file_path 批量删除，外键级联清理 edges。

### 4.5 代际管理（generations/ — 4 文件）

```
buildGenerationId() → ISO时间戳 (如 "2026-04-17T10:30:00.000Z")

Build 流程:
  [1] 创建 generations/<id>/ 目录
  [2] 复制 current DB → generation DB
  [3] 在 generation DB 上执行 build
  [4] assessGenerationHealth() 检查:
      - DB 文件存在
      - nodeCount > 0
  [5] 健康 → promoteGeneration():
      - 更新 current.json 指针
      - 更新 last-known-good.json
      - 复制 DB 到标准位置
  [5'] 不健康 → 保留旧 current

resolveActiveGraphDb() 优先级:
  current.json 指向的 DB > last-known-good.json > graph.db (默认)
```

---

## 5. Post-Processing Layer 详解

### 5.1 社区检测（communities.js — 369 行，3-Pass 算法）

```
Pass 1: 自适应目录框架
+---------------------------------------+
| 所有 module 节点按 file_path 分组       |
| 跳过容器目录: src/, lib/, app/,        |
|   packages/, internal/, pkg/           |
| 单文件目录合并到 (root)                 |
+---------------------------------------+
  |
  v
Pass 2: O(E) 健康评估
+---------------------------------------+
| 对每个社区:                              |
|   intra_edges = 社区内部边数             |
|   inter_edges = 跨社区边数               |
|   density = intra / (n*(n-1))           |
|   independence = intra / (intra+inter)   |
|                                          |
|   density>0.3 & independence>0.5 → healthy|
|   density>0.3 & independence≤0.5 → fragmented|
|   density≤0.3 & independence>0.5 → isolated  |
|   density≤0.3 & independence≤0.5 → scattered |
+---------------------------------------+
  |
  v
Pass 3: 超大社区精化
+---------------------------------------+
| 条件: file_count > total * 25% 且 >= 4 |
| BFS 找连通分量                           |
| 多分量 → 拆分为子社区 (id/0, id/1, ...) |
+---------------------------------------+
  |
  v
输出: communities 表 + nodes.community_id 更新
```

### 5.2 流程检测（flows.js — 221 行）

```
[1. 构建邻接表]
  edges WHERE kind='calls' → adjacency Map
  反向邻接 → reverseAdjacency Map

[2. 识别入口点]
  fan-in=0 的非 module 节点 → entry points

[3. BFS 展开]
  从每个入口沿 calls 边展开
  max_depth=5, max_nodes=20
  产出: { nodeIds, depth }

[4. 5因子 criticality 评分]
  +-----------+--------+-------------------------+
  | 因子      | 权重   | 计算方式                 |
  +-----------+--------+-------------------------+
  | file_spread| 0.30  | 涉及文件数, 1→0, 5+→1.0 |
  | depth_score| 0.20  | node_count / 20          |
  | security   | 0.25  | 含安全关键词节点占比      |
  | test_gap   | 0.15  | 1 - 测试覆盖率           |
  | external   | 0.10  | unresolved 边节点占比    |
  +-----------+--------+-------------------------+
  安全关键词: auth,login,password,token,session,crypt,
    secret,credential,permission,sql,query,execute...（25个）

[5. 写入 flows + flow_nodes 表]
```

### 5.3 图分析（analyze.js — 215 行）

**surprising_connections 4 因子评分 (0-100)**：

```
+----------------------+-------+-----------------------------------+
| 因子                  | 分值  | 条件                              |
+----------------------+-------+-----------------------------------+
| confidence_weight    | 10    | 至少一方 confidence=Inferred       |
| cross_language       | 30    | 源/目标文件语言不同                |
| cross_community      | 40    | 社区 ID 不同                      |
| peripheral_to_hub    | 20    | 低入度→高入度 (入度比>3)           |
+----------------------+-------+-----------------------------------+
```

**god_nodes**：in_degree 前 5% 的非 module 节点，1-10 个。

### 5.4 全文搜索（search.js）

```
rebuildFTS(db):
  DROP + RECREATE fts_nodes 虚表
  遍历所有非敏感 nodes → INSERT (node_id, name, retrieval_text, file_path, kind)
  事务批量插入

searchNodes(db, keyword):
  SELECT * FROM fts_nodes WHERE fts_nodes MATCH '"keyword"'
  ORDER BY bm25(fts_nodes) (负值越大越相关)
  支持 kind 过滤 + limit
```

---

## 6. Retrieval Pipeline 详解

```
retrieveContext(db, config)
  |
  v
[1. Query Planning] ← query-plan.js + profiles.js
  |  输入: query, changedFiles, candidateTests, profile(可选)
  |  推断 intent: plan/work/review/search
  |  选择 profile → budget, weights, seed_limit
  |
  v
[2. Seed 构建] ← seed.js
  |  多源采集:
  |    FTS 全文匹配 (score=1.0)
  |    LIKE 模糊匹配 (score=0.7)
  |    变更文件节点 (score=1.0)
  |    候选测试节点 (score=1.0)
  |    变更文件 chunks (score=1.1)
  |  去重: 按 node_id, 保留最高分
  |
  v
[3. 图扩展] ← expand.js
  |  种子节点的邻接节点 (depth=1, score=0.8)
  |  种子节点的子 chunks (score=0.9)
  |
  v
[4. 启发式重排] ← rerank.js
  |  基础分数 + 多维度加成:
  |    changed_file: 5 (review) / 3 (plan) / 4 (work)
  |    candidate_test: 4 / 2 / 3
  |    risk_path: 3 / 1 / 2
  |    graph_expand: 2 / 2 / 2
  |    entrypoint: 1 / 4 / 1
  |    module: 1 / 3 / 1
  |  输出: score_breakdown 详细分量
  |
  v
[5. 语义重排] ← semantic-rerank.js (可选)
  |  query 词项与 name+retrieval_text 的重叠度
  |  每次匹配 +0.5 分
  |
  v
[6. Token 预算打包] ← pack.js
  |  estimateTokens: text.length/4, 最少 80
  |  贪心: 按分数逐项加入, 每文件最多 2 节点
  |  超预算则停止
  |
  v
输出: { profile, query_plan, ranked_context[], estimated_tokens }
```

**Profile 差异**：

```
+----------+--------+------------+-------------------------------+
| Profile  | Budget | Seed Limit | 最高权重维度                    |
+----------+--------+------------+-------------------------------+
| review   | 1400   | 12         | changed_file(5), test(4)      |
| plan     | 1400   | 12         | entrypoint(4), module(3)      |
| work     | 1400   | 12         | changed_file(4), test(3)      |
| search   | 1200   | 10         | 全部 = 1（均衡）               |
+----------+--------+------------+-------------------------------+
```

---

## 7. 查询命令体系（11 种模式）

```
cli/query.js — 439 行

spec-first crg query --pattern=<mode> --symbol=<id> --repo=<path>

+------------------+----------+------------------------------------------+
| Pattern          | 参数     | 功能                                      |
+------------------+----------+------------------------------------------+
| callers_of       | symbol   | 谁调用了这个符号 (edges.calls 反向)        |
| callees_of       | symbol   | 这个符号调用了谁 (edges.calls 正向)        |
| importers_of     | module   | 谁导入了这个模块 (edges.imports_from 反向) |
| importees_of     | module   | 这个模块导入了谁 (edges.imports_from 正向) |
| dependents_of    | module   | = importers_of                            |
| dependencies_of  | module   | = importees_of                            |
| tests_for        | subject  | 哪些测试指向这个符号 (is_test=1 的来源)    |
| similar_to       | symbol   | 同社区的其他节点                           |
| children_of      | module   | module 包含的子节点 (edges.contains)       |
| file_summary     | file     | 文件内所有非 module 节点                   |
| inheritors_of    | symbol   | 继承/实现了这个符号 (inherits/implements)  |
+------------------+----------+------------------------------------------+

输出格式: FactItem[]
{ id, name, file_path, kind, line_start, line_end, is_test,
  confidence: 'Inferred', source_tier: 'crg_ast',
  inference_reason, evidence[] }
```

---

## 8. 风险评估体系（changes.js — 394 行）

### 文件级风险

```
module 节点 fan-in:
  >= 10 → High
  >= 3  → Medium
  < 3   → Low
```

### 节点级 5 因子评分 (0.0-1.0)

```
+--------------------+--------+----------------------------+
| 因子                | 权重   | 计算方式                    |
+--------------------+--------+----------------------------+
| F1 flow_count      | 0.25   | 参与流数 / 10              |
| F2 cross_community | 0.15   | 跨社区调用方数 / 5          |
| F3 is_test_covered | 0.30   | 有覆盖→0.05, 无覆盖→0.30   |
| F4 security_kw     | 0.20   | 含关键词→0.20, 否则→0      |
| F5 caller_count    | 0.10   | 入边总数 / 20              |
+--------------------+--------+----------------------------+

assessNodeRiskBatch: 批量优化, N*5 次查询压缩为 ~6 次
```

### review-context 完整链路

```
spec-first crg review-context --since=<git-ref> --repo=<path>
  |
  v
[1] detectChanges(repoRoot, since) → 变更文件 + 风险等级
  |
  v
[2] 受影响节点: 变更文件中所有非 module 节点
  |
  v
[3] 候选测试: 文件名启发式 + is_test=1
  |
  v
[4] 图扩展: 2层反向 BFS (调用者方向)
  |
  v
[5] 批量风险评分: assessNodeRiskBatch()
  |
  v
[6] 审查指引: review_priorities + test_gaps
  |
  v
[7] 检索上下文: 'review' profile → ranked_context
  |
  v
输出: { diff_summary, affected_nodes, candidate_tests,
        graph_expansion, review_guidance, ranked_context }
```

---

## 9. Build 主流程（cli/build.js — 605 行）

```
spec-first crg build --repo=<path> [--force]
  |
  v
[1. 原生模块检查]
  require('better-sqlite3') 失败 → exit 2
  |
  v
[2. iOS 自动检测]
  Podfile.lock / .xcodeproj → isIos=true
  |
  v
[3. 创建 Generation]
  generationId = ISO时间戳
  复制 current DB → generation DB
  |
  v
[4. 输入收集]
  collectInputFiles(repoRoot, { isIos })
  |
  v
[5. 历史残留清理]
  existingGraphPaths ∩ !inputSet → prunedPaths
  deleteStaleNodes(db, prunedPaths)
  |
  v
[6. 增量检测]
  --force → 清空 fingerprints, 全量重建
  detectChangedFiles() → { changed, deleted, changedShas }
  |
  v
[7. 解析变更文件]
  对每个 changed file:
    parseFile() → classify quality (ok/no_parser/parse_error/module_only)
    no_parser/parse_error → 跳过, 不覆盖旧事实
    ok/module_only → 收集 nodes + rawEdges
  |
  v
[8. 局部替换]
  deleteStaleNodes(db, rebuildableFiles)
  upsertNodes(db, allNodes)
  upsertChunks(db, buildChunksForNodes(allNodes))
  |
  v
[9. 边解析]
  resolveEdges(db, allRawEdges) → 六阶段解析
  upsertEdges(db, resolved)
  replaceUnresolvedEdges(db, unresolved)
  |
  v
[10. 更新指纹]
  updateFingerprints(db, parsedChanged, skippedChanged)
  |
  v
[11. 后处理]
  tryPostprocess(db):
    writeCommunities → detectFlows → analyzeGraph → rebuildFTS
  |
  v
[12. 代际管理]
  assessGenerationHealth() → healthy?
  healthy → promoteGeneration() (更新 current + last-known-good)
  unhealthy → 保留旧 current, 输出警告
  |
  v
[13. 输出]
  JSON envelope: { generation_id, node_count, edge_count,
    changed_files, duration_ms, build_quality, warnings }
```

---

## 10. 文件清单与行数

```
文件                                          行数    职责
─────────────────────────────────────────────────────────────────
parser.js                                     1841   AST 解析 (16 种语言)
input-convergence.js                           728   输入收敛 (10 步过滤)
cli/build.js                                   605   构建主流程
graph.js                                       448   图写入 + 六阶段边解析
cli/query.js                                   439   11 种查询模式
changes.js                                     394   风险评估 (5 因子)
communities.js                                 369   3-Pass 社区检测
commands/review-context.js                     269   Review 上下文
migrations.js                                  269   Schema + 迁移
flows.js                                       221   PageRank + BFS 流检测
analyze.js                                     215   surprising + god_nodes
cli/router.js                                  173   17 子命令路由
lang-config.js                                 170   16 语言配置
chunking.js                                    170   AST 语义分块
retrieval/rerank.js                            ~140   启发式重排
retrieval/seed.js                              ~130   多源种子
retrieval/api.js                               ~120   检索 API
artifact-paths.js                              113   路径解析
retrieval/expand.js                            ~100   图扩展
retrieval/pack.js                              ~90    Token 打包
retrieval/profiles.js                          ~80    Profile 定义
retrieval/query-plan.js                        ~80    查询规划
retrieval/semantic-rerank.js                   ~60    语义重排
generations/paths.js                           ~100   代际路径
generations/promote.js                         ~60    代际提升
generations/health.js                          ~40    健康检查
generations/rollback.js                        ~40    代际回滚
cli/postprocess.js                             ~80    后处理编排
cli/envelope.js                                 31   JSON 信封
cli/open-db.js                                  57   只读 DB 连接
constants.js                                    14   安全关键词
commands/ (其余 10 个)                        ~1000   子命令处理器
─────────────────────────────────────────────────────────────────
总计 (46 个文件)                             13697
```

---

## 11. 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 存储 | SQLite + WAL | 单文件、零配置、支持并发读 |
| 解析 | tree-sitter (原生 binding) | AST 级精度、16 语言统一接口 |
| 增量 | SHA-256 per-file | O(n) 对比、无 git 依赖 |
| 边解析 | 六阶段 fallback | 最大化解析率、兼容各语言 import 语义 |
| 社区 | 目录优先 + 健康评估 + BFS 精化 | 简单有效、不依赖复杂聚类算法 |
| 流程 | BFS + 5 因子评分 | criticality 可解释、可审计 |
| 检索 | seed→expand→rerank→pack | 混合检索、profile 可切换 |
| 代际 | current + last-known-good | 构建失败不污染消费 |
| FTS | 独立 FTS5 虚表 (非 content=) | 简单可靠、rebuildFTS 全量重建 |
| ObjC/Swift | vendor/ fork 包 | 控制 peerDep、收敛到 >=0.21.0 |

---

## 12. 数据流总图

```
+-------------+
| Source Code  |
+-------------+
       |
       v
[input-convergence] ──10步过滤──> finalInputs[]
       |
       v
[parser]            ──tree-sitter──> nodes[] + rawEdges[]
       |
       v
[incremental]       ──SHA-256对比──> changed[] / deleted[]
       |
       v
[graph]             ──六阶段解析──> nodes + edges → SQLite
       |
       v
[chunking]          ──语义分块──> chunks → SQLite
       |
       v
[postprocess]
  |-- [communities] ──3-Pass──> communities 表 + nodes.community_id
  |-- [flows]       ──BFS+5因子──> flows + flow_nodes 表
  |-- [analyze]     ──4因子+入度──> surprising_connections + god_nodes
  |-- [search]      ──FTS5重建──> fts_nodes 虚表
       |
       v
[generations]       ──健康检查──> promote / rollback
       |
       v
+--------------------------------------------------+
|              SQLite DB (graph.db)                  |
|  nodes | edges | communities | flows | flow_nodes  |
|  chunks | fingerprints | graph_meta | fts_nodes    |
+--------------------------------------------------+
       |
       v
[Query Layer]
  |-- query (11种模式)
  |-- impact (反向BFS)
  |-- review-context (变更→影响→测试→风险→检索)
  |-- detect-changes (git diff→风险评分)
  |-- context (top hubs/communities/flows)
       |
       v
[Retrieval Pipeline]
  seed → expand → rerank → semantic-rerank → pack
       |
       v
+--------------------------------------------------+
|        ranked_context (FactItem[])                 |
|  → spec-graph-bootstrap 消费                       |
|  → spec-plan / spec-work / spec-code-review 消费        |
+--------------------------------------------------+
```
