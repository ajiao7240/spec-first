# graphify 借鉴方案

> 文档定位：研究性借鉴分析，不替代 [阶段0-CRG-NodeJS集成技术方案.md](./阶段0-CRG-NodeJS集成技术方案.md)。
>
> 目标：把 graphify 项目中已经过生产验证的算法和机制有选择地移植到 CRG Node.js 实现，
> 避免重复造轮子，同时保持 v1 范围可控。
>
> 如与 [修订终版.md](./修订终版.md) 或阶段 0 技术方案冲突，以总版和阶段 0 为准。

---

## 1. graphify 是什么

graphify 是一个独立的 Python 代码图分析工具（7,446 行，约 10 个核心模块），核心流程：

```
detect → extract → build_graph → cluster → analyze → report → export
```

与 code-review-graph（CRG）的关键区别：

| 维度 | graphify | CRG (code-review-graph) |
|---|---|---|
| 存储 | 内存 NetworkX 图 + JSON 持久化 | SQLite WAL 持久化（`graph.db`）|
| 对外接口 | CLI + MCP server（`graphify serve`）| CLI 子命令（`spec-first crg <cmd>`）|
| 语言支持 | 代码 + PDF/DOCX/图片（多模态）| 纯代码（19 语言）|
| 社区算法 | Leiden（graspologic）→ Louvain fallback | 3-Pass：自适应目录框架 → 双指标健康评估 → 连通分量精化 |
| 置信度模型 | `EXTRACTED / INFERRED / AMBIGUOUS` | `Observed / Inferred / Unknown` |

两个项目的目标都是"结构化代码事实用于 AI 辅助"，算法层有大量可复用的设计智慧。

---

## 2. 借鉴决策总表

| # | 借鉴项 | graphify 来源 | 优先级 | 引入方式 | 落地位置 |
|---|---|---|---|---|---|
| B1 | 多因子惊喜连接算法 | `analyze.py:surprising_connections` + `_surprise_score` | **P0** | 直接移植算法逻辑 | 新增 `crg/analyze.js` + `crg surprising-connections` 子命令 |
| B2 | 社区健康度双指标 | `cluster.py:cohesion_score` + `communities.py:_compute_cohesion` | **P0** | 升级为密度 + 独立性双指标，四象限分类诊断 | `crg/communities.js` + `crg communities` 输出 `health` 字段 |
| B3 | 神节点文件级过滤 | `analyze.py:_is_file_node` / `god_nodes` | **P0** | 移植过滤逻辑 | `crg/analyze.js` + `crg architecture` 输出优化 |
| B4 | 语料库健康检查 | `detect.py:CORPUS_WARN/UPPER_THRESHOLD` | **P1** | 移植阈值与分级逻辑 | `crg stats` 输出新增 `corpus_health` 字段 |
| B5 | 3-Pass 社区检测算法 | `cluster.py:cluster` / `_split_community` / `_MAX_COMMUNITY_FRACTION` | **P0** | 超越原实现：自适应目录框架 → 双指标评估 → 连通分量精化（替代递归 Leiden）；零外部依赖，完全确定性 | `crg/communities.js` 全量重设计 |
| B6 | 敏感文件过滤模式 | `detect.py:_SENSITIVE_PATTERNS` | **P0** | 移植正则表达式集合 | `crg/parser.js` 文件发现层 |
| C1 | 图报告结构（概念借鉴）| `report.py:generate` + GRAPH_REPORT.md | P2 | 章节结构参考 | `00-summary.md` 文档结构设计 |
| C2 | Token 压缩率基准（概念借鉴）| `benchmark.py:run_benchmark` | P2 | 指标方法论参考 | `crg stats` 可选 KPI 字段 |

**不借鉴**（详见第 9 节）：LLM 语义抽取、多模态输入（PDF/DOCX）、watch 模式、wiki 导出。

---

## 3. B1：多因子惊喜连接算法

### 3.1 graphify 实现

graphify 的 `surprising_connections()` 函数对跨文件边打复合惊喜分（`_surprise_score`），返回最不可预测的连接：

```python
# graphify/analyze.py - _surprise_score()
def _surprise_score(G, u, v, data, node_community, u_source, v_source):
    score = 0
    reasons = []

    # 因子 1: 置信度权重 (AMBIGUOUS=3, INFERRED=2, EXTRACTED=1)
    conf_bonus = {"AMBIGUOUS": 3, "INFERRED": 2, "EXTRACTED": 1}.get(conf, 1)
    score += conf_bonus

    # 因子 2: 跨文件类型加分 (code↔paper 比 code↔code 更惊喜)
    if cat_u != cat_v:
        score += 2

    # 因子 3: 跨仓库/顶层目录加分
    if _top_level_dir(u_source) != _top_level_dir(v_source):
        score += 2

    # 因子 4: 跨社区加分 (Leiden 判定结构上距离远)
    if cid_u is not None and cid_u != cid_v:
        score += 1

    # 因子 5: 外围→枢纽加分 (低度节点意外连到高度节点)
    if min(deg_u, deg_v) <= 2 and max(deg_u, deg_v) >= 5:
        score += 1
```

排除规则：`imports`、`contains`、`method` 关系边（结构性边，不是"惊喜"）；文件级枢纽节点；孤立方法存根。

### 3.2 CRG Node.js 适配

CRG 的置信度模型是 `Observed / Inferred / Unknown`（对应 graphify 的 `EXTRACTED / INFERRED / AMBIGUOUS`），因子映射如下：

| graphify 因子 | CRG 适配 |
|---|---|
| 置信度权重 | `Unknown=3, Inferred=2, Observed=1` |
| 跨文件类型 | 简化为"跨语言"（`ext_u !== ext_v`）|
| 跨仓库 | v1 单仓库，跳过此因子 |
| 跨社区 | 直接使用 CRG 社区检测结果 |
| 外围→枢纽 | 保留，`degree` 数据从 `graph.db` 直接查 |

**新增子命令**：`spec-first crg surprising-connections`

```jsonc
// 输出示例
{
  "surprising_connections": [
    {
      "source": "AuthService",
      "target": "CacheManager",
      "score": 5,
      "confidence": "Inferred",
      "reasons": [
        "inferred connection - not explicitly stated in source",
        "bridges separate communities"
      ],
      "source_file": "src/auth/service.ts",
      "target_file": "src/cache/manager.ts"
    }
  ]
}
```

**典型用途**：`high-risk-modules.md` 生成时，惊喜连接是高风险模块的重要信号来源；`architecture/module-map.md` 中标注非显式跨模块依赖。

### 3.3 新增模块

- `src/crg/analyze.js`（新文件，约 150 行）
  - `surprisingConnections(db, communities, topN)` — 核心算法
  - `godNodes(db, topN)` — 见 B3
- `src/crg/cli/analyze.js`（新文件，约 80 行）
  - `crg surprising-connections` 子命令入口
  - `crg god-nodes` 子命令入口（可合并入 `crg architecture`）

### 3.4 阶段0文档影响

在 §2.1 目录树中新增：
```
src/crg/
  ├── analyze.js              ← 新增（god_nodes + surprising_connections）
  └── cli/
      └── analyze.js          ← 新增（surprising-connections / god-nodes 子命令）
```

在 §2.3 子命令总表中新增一行：
| `spec-first crg surprising-connections` | — | `[--top=<N>] [--repo=<path>]` | 跨社区非显式高惊喜边列表 |

---

## 4. B2：社区健康度双指标

### 4.1 为什么单指标不够

graphify 和 CRG Python 各用了一个公式，但两个公式回答的是不同问题：

```
graphify  公式（密度）：  actual_intra / (n*(n-1)/2)
                         回答："这个社区内部有多紧密？"

CRG Python 公式（独立性）：intra / (intra + inter)
                         回答："这个社区对外依赖有多少？"
```

单独使用任意一个都有盲点：

- 只看密度：`utils/` 目录内部没有调用关系，density≈0 → 误报为"需要拆分"，但这是正常的工具集
- 只看独立性：一个紧密耦合但大量对外暴露的 `service/` 模块，independence≈0.2 → 无法区分"合理的 Facade"和"技术债积累"

两个指标组合，才能产生四象限可操作诊断。

### 4.2 双指标四象限分类

```
                   independence 高（边界清晰）
                          │
   density 低             │           density 高
   ┌─────────────────────┼──────────────────────┐
   │  isolated            │   healthy             │
   │  tools / utils       │   auth / payment      │
   │  正常，无需干预       │   健康模块 ✓          │
── ┼─────────────────────┼──────────────────────┼ ──
   │  fragmented          │   scattered           │
   │  内部无边，物理已分离  │   大量跨出，架构漂移   │
   │  → Pass 3 拆分       │   → 标注风险信号       │
   └─────────────────────┼──────────────────────┘
                          │
                   independence 低（边界模糊）
```

分类阈值（可配置）：

| 指标 | 阈值 | 说明 |
|---|---|---|
| density ≥ 0.2 | 密度达标 | n*(n-1)/2 中至少 20% 的边存在 |
| independence ≥ 0.4 | 独立性达标 | 内部边占所有相关边 40% 以上 |

**`scattered` 是最重要的风险信号**：内部紧密但大量对外暴露 = 开发者画了边界但代码无视它，是技术债积累的典型特征。直接对应 `high-risk-modules.md` 的来源。

### 4.3 CRG Node.js 实现

```javascript
// src/crg/communities.js - communityHealth()
function communityHealth(db, communityId) {
  const nodeIds = db.prepare(
    'SELECT id FROM nodes WHERE community_id = ?'
  ).all(communityId).map(r => r.id);

  const n = nodeIds.length;
  if (n <= 1) return { density: 1.0, independence: 1.0, status: 'healthy' };

  const ph = nodeIds.map(() => '?').join(',');

  // 密度：内部边数 / 最大可能边数
  const intraCount = db.prepare(`
    SELECT COUNT(*) as cnt FROM edges
    WHERE from_id IN (${ph}) AND to_id IN (${ph})
  `).get(...nodeIds, ...nodeIds).cnt;

  // 对外边数：一端在社区内，一端在社区外
  const interCount = db.prepare(`
    SELECT COUNT(*) as cnt FROM edges
    WHERE (from_id IN (${ph}) AND to_id NOT IN (${ph}))
       OR (to_id   IN (${ph}) AND from_id NOT IN (${ph}))
  `).get(...nodeIds, ...nodeIds, ...nodeIds, ...nodeIds).cnt;

  const density      = round2(intraCount / (n * (n - 1) / 2));
  const independence = (intraCount + interCount) > 0
    ? round2(intraCount / (intraCount + interCount))
    : 1.0;

  return { density, independence, status: classifyHealth(density, independence) };
}

function classifyHealth(density, independence) {
  const dense       = density >= 0.2;
  const independent = independence >= 0.4;
  if ( dense &&  independent) return 'healthy';
  if (!dense &&  independent) return 'isolated';    // utils/helpers
  if ( dense && !independent) return 'scattered';   // 架构漂移，高风险
  return 'fragmented';                              // 内部无连通，触发 Pass 3
}
```

### 4.4 输出格式

```jsonc
{
  "communities": [
    {
      "id": 0,
      "name": "auth",
      "node_count": 18,
      "health": {
        "density": 0.42,
        "independence": 0.71,
        "status": "healthy"
      }
    },
    {
      "id": 3,
      "name": "service",
      "node_count": 24,
      "health": {
        "density": 0.61,
        "independence": 0.19,
        "status": "scattered",
        "note": "81% 的依赖边跨出本社区，是潜在耦合热点"
      }
    }
  ],
  "stats": {
    "by_status": { "healthy": 4, "isolated": 2, "scattered": 1, "fragmented": 1 }
  }
}
```

### 4.5 阶段0文档影响

`crg communities` 输出说明更新：增加"含 `health.status` 四象限分类（healthy / isolated / scattered / fragmented）"。

---

## 5. B3：神节点文件级过滤

### 5.1 graphify 实现

```python
# graphify/analyze.py - _is_file_node()
def _is_file_node(G, node_id):
    """排除文件级枢纽节点和方法存根。"""
    attrs = G.nodes[node_id]
    label = attrs.get("label", "")
    source_file = attrs.get("source_file", "")

    # 规则 1: 节点 label == 源文件名（机械性聚集大量 import/contains 边）
    if source_file and label == Path(source_file).name:
        return True

    # 规则 2: AST 方法存根，label 格式为 '.method_name()'
    if label.startswith(".") and label.endswith("()"):
        return True

    # 规则 3: 孤立函数存根，仅有 1 条 contains 边
    if label.endswith("()") and G.degree(node_id) <= 1:
        return True

    return False
```

### 5.2 CRG Node.js 适配

CRG 的节点 schema 中有 `node_type`（`function` / `class` / `method` / `module` 等）和 `file_path`，过滤规则可以更精确：

```javascript
// src/crg/analyze.js - isFileHubNode()
function isFileHubNode(node) {
  // 规则 1: module 类型节点且 name === basename(file_path)
  if (node.type === 'module') return true;

  // 规则 2: method stub —— name 以 '.' 开头（Python AST 约定）
  if (node.name.startsWith('.') && node.name.endsWith('()')) return true;

  // 规则 3: 孤立函数 —— edge_count <= 1（仅有 contains 边）
  if (node.edge_count <= 1) return true;

  return false;
}
```

**输出增强**：`crg architecture` 的 `hub_nodes` 列表不再包含文件级模块节点，只返回真正的核心抽象（Service、Manager、Handler 等类/函数）。

**核心价值**：CRG 当前 `architecture` 输出的高连接度节点可能被文件级 hub 污染。过滤后质量显著提升，避免误判"this file is a god node"。

---

## 6. B4：语料库健康检查

### 6.1 graphify 实现

```python
# graphify/detect.py
CORPUS_WARN_THRESHOLD = 50_000    # words - 低于此值，图结构价值有限
CORPUS_UPPER_THRESHOLD = 500_000  # words - 高于此值，token 成本警告
FILE_COUNT_UPPER = 200            # files - 上界

# 分级结果
if total_words < CORPUS_WARN_THRESHOLD:
    health = "small"   # "you may not need a graph"
elif total_words >= CORPUS_UPPER_THRESHOLD:
    health = "large"   # "Large corpus: token cost warning"
else:
    health = "optimal" # 无警告
```

### 6.2 CRG Node.js 适配

CRG 的等价指标是"代码行数"而非"词数"：

| graphify（词数）| CRG 适配（代码行数）| 阈值来源 |
|---|---|---|
| < 50k words | < 5k LOC | 约等换算（代码行 ≈ 词数 / 10）|
| 50k – 500k words | 5k – 50k LOC | 最佳区间 |
| > 500k words | > 50k LOC | 大型项目警告 |

**输出增强**：`crg stats` 新增 `corpus_health` 字段：

```jsonc
// spec-first crg stats 输出
{
  "nodes": 1842,
  "edges": 5431,
  "files": 87,
  "last_built": "2026-04-10T08:23:00Z",
  "corpus_health": {           // ← 新增
    "total_loc": 12400,
    "status": "optimal",       // small | optimal | large
    "message": null            // null 表示无警告
  }
}
```

`small` 状态时 message 示例：`"代码量较小，图分析收益有限；facts-first 模式仍然有效"`
`large` 状态时 message 示例：`"代码量较大（>50k LOC），context 注入时注意 token 预算"`

**对 spec-graph-bootstrap 的价值**：`crg stats` 是 Phase 0 前置检查命令。`corpus_health` 直接告诉 SKILL.md 当前仓库体量，让后续 context pack 生成策略自适应调整。

---

## 7. B5：3-Pass 社区检测算法

### 7.1 现有方案的根本问题

graphify（全局 Leiden）和 CRG Python（igraph Leiden + 文件级 fallback）都用单一算法处理全部情况：

- Leiden 找"数学模块度最优划分"，不等于人类可读的模块边界
- 随机种子导致跨 rerun 结果不稳定，直接破坏 `fingerprints.json` 有效性
- Node.js 生态没有生产就绪的 Leiden 实现（`graphology-communities-leiden` 存在但引入整个 graphology 图库）
- CRG Python 的文件级 fallback 质量太差：200 个函数的 `parser.py` 变成一个 200 节点的"社区"

代码库有两种本质不同的结构信号：**目录**（开发者意图）和 **import/call 图**（实际耦合）。
最优解不是"用图算法替代目录"，而是**"用目录作框架，用图算法诊断框架质量"**。

### 7.2 3-Pass 算法设计

```
Pass 1：自适应目录框架        目录 → 初始社区（确定性，体现开发者意图）
                                  ↓
Pass 2：双指标健康评估        对每个社区计算 density + independence，分类四象限
  healthy / isolated / scattered / fragmented → 写入 health 字段（诊断信息）
  scattered / fragmented → 不触发拆分（偏差本身是有价值的架构信号）
  oversized（> 25% 总节点）→ 进入 Pass 3
                                  ↓
Pass 3：oversized 连通分量精化  只对超大社区运行（单一目的，触发条件明确）
```

**关键设计原则**：
- Pass 3 只有一个触发条件（size），避免多触发器带来的边界条件爆炸
- `fragmented` 和 `scattered` 作为诊断输出保留，不触发自动拆分——偏差是给 SKILL.md 的信号，不是需要"修复"的错误

### 7.3 Pass 1：自适应目录框架

简单取顶层目录会把所有文件归入 `src/` 这个无意义的容器层。需要检测并跳过容器目录：

```javascript
// src/crg/communities.js
const CONTAINER_DIRS = new Set([
  'src', 'lib', 'app', 'packages', 'modules',
  'source', 'sources', 'code', 'core',
]);

function effectiveDir(filePath) {
  const parts = filePath.replace(/\\/g, '/').split('/');
  // 跳过容器目录，取第一个有语义的层
  for (let i = 0; i < parts.length - 1; i++) {
    if (!CONTAINER_DIRS.has(parts[i].toLowerCase())) return parts[i];
  }
  return parts[0]; // fallback：顶层
}
```

典型效果：

```
src/auth/service.ts   →  auth     ✓（跳过 src）
src/payment/stripe.ts →  payment  ✓（跳过 src）
packages/core/index.ts →  core    ✓（跳过 packages）
utils/helpers.ts      →  utils    ✓（无容器层，直接取）
```

### 7.4 Pass 3：oversized 连通分量精化

只对超过 `总节点数 × 25%` 的社区运行，触发条件单一清晰：

```javascript
// src/crg/communities.js - splitOversized()
const MAX_COMMUNITY_FRACTION = 0.25;
const MIN_SPLIT_SIZE = 10;

function splitOversized(community, allNodeCount, db) {
  const maxSize = Math.max(MIN_SPLIT_SIZE,
    Math.floor(allNodeCount * MAX_COMMUNITY_FRACTION));
  if (community.nodeIds.length <= maxSize) return [community];

  // Step 1：连通分量分析（排除 contains / defined_in 等结构边）
  const STRUCTURAL_EDGES = new Set(['contains', 'defined_in']);
  const ph = community.nodeIds.map(() => '?').join(',');
  const intraEdges = db.prepare(`
    SELECT from_id, to_id FROM edges
    WHERE from_id IN (${ph}) AND to_id IN (${ph})
      AND kind NOT IN ('contains', 'defined_in')
  `).all(...community.nodeIds, ...community.nodeIds);

  const components = connectedComponents(community.nodeIds, intraEdges);

  // Step 2：多个连通块 → 各自成社区
  if (components.length >= 2) {
    return components.map(ids => buildCommunity(ids, db));
  }

  // Step 3：一个大连通块 → 按子目录再分组
  const bySubDir = groupByEffectiveSubDir(community.nodeIds, db);
  if (Object.keys(bySubDir).length >= 2) {
    return Object.values(bySubDir).map(ids => buildCommunity(ids, db));
  }

  // Step 4：子目录也无法区分 → 保留原社区，标注 oversized
  return [{ ...community, health: { ...community.health, note: 'oversized, no split boundary found' } }];
}

// BFS 连通分量，~25 行，零依赖
function connectedComponents(nodeIds, edges) {
  const adj = new Map(nodeIds.map(id => [id, []]));
  for (const { from_id: u, to_id: v } of edges) {
    if (adj.has(u) && adj.has(v)) { adj.get(u).push(v); adj.get(v).push(u); }
  }
  const visited = new Set();
  const components = [];
  for (const node of nodeIds) {
    if (visited.has(node)) continue;
    const comp = [];
    const queue = [node];
    while (queue.length) {
      const cur = queue.shift();
      if (visited.has(cur)) continue;
      visited.add(cur); comp.push(cur);
      for (const nb of (adj.get(cur) || [])) queue.push(nb);
    }
    components.push(comp);
  }
  return components;
}
```

拆分决策顺序（Step 2 → 3 → 4）保证了单一退出路径，每一步都有明确的触发条件，无模糊判断。

连通分量 vs Leiden 对比：

| | 连通分量 | Leiden |
|---|---|---|
| 语义 | "这些节点之间完全没有依赖路径" | "数学模块度最优划分" |
| 可解释性 | "`auth/` 里有两组文件互不调用" | "Leiden 认为应该这样划" |
| 确定性 | 完全确定，rerun 结果稳定 | 随机种子，跨 rerun 漂移 |
| 实现成本 | ~30 行 BFS，零依赖 | 400+ 行或外部库 |

### 7.5 算法对比总表

| 维度 | graphify（全局 Leiden）| CRG Python（Leiden+文件级 fallback）| **3-Pass（本方案）** |
|---|---|---|---|
| 主要信号 | 图结构 | 图结构 | 目录（开发者意图）|
| 精化信号 | 无 | 无 | 连通分量（按需，仅异常社区）|
| 稳定性 | 随机，结果漂移 | 随机，结果漂移 | 完全确定，fingerprints 有效 |
| 可解释性 | 低 | 低 | 高（四象限分类 + 拆分原因）|
| 外部依赖 | graspologic | igraph | 零依赖 |
| 拆分触发 | 固定 25% 节点 | 固定 50 节点 | 仅 oversized（> 25%，动态阈值）|
| 不拆的情况 | 不支持 | 不支持 | scattered / fragmented 保留为诊断信号 |
| 对 AI 的价值 | 社区列表 | 社区列表 | 社区列表 + **架构诊断（四象限）** |
| 实现规模 | Python 库 | Python 库 | ~350 行 JS，自包含 |

---

## 8. B6：敏感文件过滤

### 8.1 graphify 实现

```python
# graphify/detect.py
_SENSITIVE_PATTERNS = [
    re.compile(r'(^|[\\/])\.(env|envrc)(\.|$)', re.IGNORECASE),
    re.compile(r'\.(pem|key|p12|pfx|cert|crt|der|p8)$', re.IGNORECASE),
    re.compile(r'(credential|secret|passwd|password|token|private_key)', re.IGNORECASE),
    re.compile(r'(id_rsa|id_dsa|id_ecdsa|id_ed25519)(\.pub)?$'),
    re.compile(r'(\.netrc|\.pgpass|\.htpasswd)$', re.IGNORECASE),
]
```

### 8.2 CRG Node.js 适配

直接移植为 JavaScript 正则：

```javascript
// src/crg/parser.js - SENSITIVE_PATTERNS
const SENSITIVE_PATTERNS = [
  /(^|[\\/])\.(env|envrc)(\.|$)/i,
  /\.(pem|key|p12|pfx|cert|crt|der|p8)$/i,
  /(credential|secret|passwd|password|token|private_key)/i,
  /(id_rsa|id_dsa|id_ecdsa|id_ed25519)(\.pub)?$/,
  /(\.netrc|\.pgpass|\.htpasswd)$/i,
];

function isSensitive(filePath) {
  const name = path.basename(filePath);
  const full = filePath;
  return SENSITIVE_PATTERNS.some(p => p.test(name) || p.test(full));
}
```

在文件发现遍历时，遇到敏感文件跳过解析并记录到 `skipped_sensitive[]` 列表（随 `crg build` 日志输出到 stderr，不进入 JSON stdout）。

**安全要求**（对应 CLAUDE.md 中的 Security Invariants）：

- 敏感文件路径绝不写入 `graph.db`（节点表和 FTS 索引均不包含）
- `crg stats` 输出 `skipped_sensitive_count` 计数，不暴露路径
- `.env` 等文件名本身也不进入 FTS5 索引

---

## 9. 概念借鉴：图报告结构（C1）

graphify 的 `report.py` 生成 `GRAPH_REPORT.md`，结构为：

```
## Corpus Stats
## God Nodes (核心抽象)
## Community Structure
  - 每个社区的名称、成员数、内聚度
## Surprising Connections (非显式跨模块依赖)
## Suggested Questions (LLM 探索入口)
```

**对 `00-summary.md` 的结构参考**（阶段 2B 产物）：

`00-summary.md` 不直接照搬，但可以参考这个章节顺序：
1. Corpus 健康状态（来自 B4 corpus_health）
2. 核心模块摘要（来自 `crg communities` + cohesion_score）
3. 关键执行流（来自 `crg flows`）
4. 跨模块意外依赖（来自 B1 surprising-connections）
5. 高风险信号（来自 `crg detect-changes` + large-functions）

这个顺序与 graphify 报告一致，也与 spec-graph-bootstrap 的 facts-first 原则一致：先给"全局结构"，再给"风险信号"。

---

## 10. 概念借鉴：Token 压缩率基准（C2）

graphify 的 `benchmark.py` 测量"全量导入 vs 图查询"的 token 压缩比：

```
Corpus: 7,500 words → ~10,000 tokens (naive full import)
平均查询: ~140 tokens
压缩比: 71.5x
```

**对 CRG 的参考**：

`crg stats` 可以增加一个可选的 `token_estimate` 字段：

```jsonc
{
  "corpus_health": {
    "total_loc": 12400,
    "estimated_tokens": 165000,  // LOC × 13.3（经验系数）
    "status": "optimal"
  }
}
```

这不是功能需求，而是帮助 SKILL.md 决策"是否需要截断 context pack"的辅助信息。阶段 2B 文档生成时，`injection-index.yaml` 的路由规则可以基于此做 token budget 估算。

---

## 11. 不借鉴的部分

| graphify 能力 | 不借鉴原因 |
|---|---|
| LLM 语义抽取（`INFERRED` / `AMBIGUOUS` 边）| 依赖 LLM API 调用；CRG v1 事实层以静态 AST 分析为准（`Observed`），LLM 辅助推断在阶段 2A 由 SKILL.md 外层处理，不内嵌 CRG |
| 多模态输入（PDF / DOCX / 图片）| graphify 支持论文、文档、图片；CRG 只分析代码文件，与 spec-graph-bootstrap 定位一致 |
| Watch 模式（`watch.py`）| graphify 用 watchdog 监听文件变化自动重跑；CRG v1 是显式调用（`crg build`）；watch 作为 v2 增强项 |
| Wiki 导出（`wiki.py`）| 生成每社区一页的 Markdown wiki；与 spec-graph-bootstrap 自身的文档体系重叠（`architecture/module-map.md` 等），格式冲突 |
| `benchmark.py` 完整移植 | 整个 benchmark 工具是独立分析器；C2 只借鉴其 token 估算思路，不移植整个模块 |

---

## 12. 对阶段 0 文档的影响汇总

以下是本借鉴方案落地后，需要更新 [阶段0-CRG-NodeJS集成技术方案.md](./阶段0-CRG-NodeJS集成技术方案.md) 的具体位置：

### §2.1 目录树

新增两个文件：
```diff
  src/crg/
+     ├── analyze.js              surprising_connections + god_nodes (B1, B3)
      ├── parser.js
      ...
      └── cli/
+         ├── analyze.js          crg surprising-connections / crg god-nodes
          ├── router.js
          ...
```

### §2.3 子命令总表

新增一行：

| 子命令 | 对应原工具 | 典型参数 | 输出说明 |
|---|---|---|---|
| `spec-first crg surprising-connections` | — （graphify 借鉴）| `[--top=<N>] [--repo=<path>]` | 跨社区非显式高惊喜边列表，含 `reasons` 字段 |

`crg stats` 行备注更新："含 `corpus_health` 字段（体量分级：small / optimal / large）"

`crg communities` 行备注更新："含 `health.status` 四象限分类（healthy / isolated / scattered / fragmented）及 `density` + `independence` 双指标"

### §五 模块对照表（5.1）

新增 `analyze.js` 行：

| Python 模块 | 行数 | Node.js 模块 | 预估行数 | 备注 |
|---|---|---|---|---|
| `graphify/analyze.py` | 430 | `crg/analyze.js` | ~150 | 借鉴移植；surprising_connections + god_nodes；NetworkX → SQLite 查询 |

### §十 实施路线图

Step 1（基础框架）新增 `analyze.js` 到搭建清单。

Step 2（核心功能）新增验收标准：
- `crg surprising-connections` 输出合法 JSON，每项包含 `score` 和 `reasons`
- `crg communities` 输出每个社区带 `health.status`（四象限）、`health.density`、`health.independence` 三个字段
- `crg communities` 顶层含 `stats.by_status` 汇总计数
- `crg stats` 输出带 `corpus_health.status` 字段
- `crg build` 跳过敏感文件，stderr 输出 `skipped_sensitive_count`
- 对于 `fragmented` 社区，连通分量分析后若有 ≥2 个子集，各自独立输出为独立社区

---

## 13. 实施优先级建议

**P0（与核心功能同步实现，不可分割）**：

- **B5 3-Pass 社区算法（含 B2 双指标）**：社区检测是 `crg communities`、`crg architecture`、B1 惊喜连接的共同基础。Pass 1（目录框架）+ Pass 2（双指标诊断）+ Pass 3（仅 oversized 拆分）三层应整体实现；Pass 3 触发条件单一（> 25% 总节点），不引入多触发器边界复杂度。预估约 350 行，首版就包含。
- **B6 敏感文件过滤**：安全类，解析前置，实现成本极低（~15 行正则），应在 `parser.js` 第一版就包含。
- **B3 神节点文件级过滤**：`crg architecture` 的质量基础；不过滤的话，`module.ts` 这类文件会污染 god nodes 列表。与 `analyze.js` 同步实现。

**P1（核心稳定后追加）**：

- **B1 惊喜连接算法**：依赖 Pass 2 的四象限分类结果（跨社区边权重）；B5 完成后追加，约 150 行独立模块，不影响现有子命令。
- **B4 语料库健康检查**：`crg stats` 的增量字段，不改变现有输出结构。

**P2（阶段 2B 文档生成设计时参考）**：

- **C1 图报告结构**：影响 `00-summary.md` 章节顺序设计（corpus health → 模块摘要 → 执行流 → 风险信号）。
- **C2 Token 压缩率**：影响 `injection-index.yaml` token budget 逻辑设计。

---

## 14. 结论

本借鉴方案对 graphify 的核心算法做了一处关键升级：**B2 + B5 从两个独立借鉴项合并为一个整体算法（3-Pass）**，这个设计超越了两个已有实现（graphify 的全局 Leiden 和 CRG Python 的文件级 fallback）。

对 CRG Node.js 价值最高的贡献：

1. **3-Pass 社区检测（B5，含 B2 双指标）**：目录框架 + 双指标诊断 + 连通分量精化。确定性、零依赖、可解释，`scattered` 状态直接成为 `high-risk-modules.md` 的输入来源。预估 350 行。
2. **惊喜连接（B1）**：多因子评分找出非显式跨模块依赖，graphify 已有生产验证。预估 150 行。
3. **神节点文件级过滤（B3）**：消除文件级 hub 噪声，让 `crg architecture` 的输出真正可用。预估 40 行。
4. **敏感文件过滤（B6）**：安全类，解析前置，直接移植 5 条正则。约 15 行。
5. **语料库健康检查（B4）**：`crg stats` 的 token budget 感知字段，~30 行。

合计约 590 行，全部纯逻辑，零外部图算法依赖，不改变 `spec-first crg <command>` 的零 Python 安装承诺。

**总原则不变**：CRG Node.js 是唯一实现，graphify 是借鉴来源，不是依赖。
