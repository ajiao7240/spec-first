# CRG 深度优化审查报告

> Lifecycle: historical-input / external-reference. 本文保留历史 CRG/CE/ECC 方案、迁移或对比材料；其中 `src/crg`、`spec-first crg`、`graph.db`、`better-sqlite3`、`.claude-plugin`、命令数量和文件数量等旧口径可能已过期。当前 source of truth 以 `docs/archive-index.md`、`docs/README.md`、根目录 README、`docs/05-用户手册/`、`docs/contracts/`、`skills/`、`src/cli/`、`CHANGELOG.md`、`spec-mcp-setup` 和 `spec-graph-bootstrap` 为准。

> 审查时间：2026-04-17
> 审查对象：`src/crg/` 全量代码（46 个 JS 文件，8,567 行）
> 审查视角：算法正确性、图/检索算法质量、复杂度、工程健壮性
> 审查者：Claude Opus 4.7（AST-Driven Coder 模式）
> 基线数据（审查时刻 `crg stats`）：
>   - `node_count`: 779
>   - `edge_count`: 1977
>   - `unresolved_edge_count`: 2809
>   - `resolve_rate`: 41.3%（resolved 1977 / total 4786）
>   - 最差 unresolved 分布：`calls` 2515 / `imports_from` 263 / `contains` 31
>   - 最差来源文件：`skills/onboarding/scripts/inventory.mjs` 292 条、`src/cli/plugin.js` 156 条

---

## 0. 执行摘要

### 0.1 总体结论

CRG 代码图引擎当前已具备**可运行、可测试、可消费**的完整基础设施：SQLite + tree-sitter + FTS5 + 代际管理 + 多语言解析 + retrieval pipeline + review-context 端到端链路。但从图算法 / 检索系统视角看，当前实现仍处在"**骨架正确、血肉不足**"的阶段：

1. **F1/C1/C7 为代表的消费语义问题**会让下游 AI agent 接收到静默假阳、过宽 blast radius 或噪音异常信号；
2. **8 条算法复杂度问题**使大仓库构建时间和查询延迟高于应有水平；
3. **检索与社区相关术语需要按代码事实收敛理解**：`community_id` 当前更接近目录启发式分区；`semantic-rerank` 实际是 lexical overlap；dense retrieval / ANN 尚未进入 v1 主链；
4. **`retrieval_text` 字段信号密度接近零**，chunks 表当前更像"虚拟切片 metadata"而非代码文本，这是整个检索栈最大的系统性弱点。

与审查报告 `2026-04-17-spec-first-全项目正式审查报告.md` 里已列出的 F1（`crg build` unresolved 口径分裂）并列：
- 本次原始审查识别 **31 条新 Finding** + 继承 F1 = **32 条**；
- 第一轮元审查补入 U1 (summary dead weight) + U2（open-db finding，**当时标题"缺 readonly"是事实错误，Round 2 已纠正为"缺 fileMustExist 与长进程连接复用"，详见第 7 章 U2**）= **34 条**；
- 第二轮元审查（外部审查）修订 F1/C1-C7/P1 等事实/推理口径，拆 C3 为 C3a+C3b，新增 S6 (unresolved 分类字段) = **35 条**；
- 第三轮元审查（外部审查 Round 3）：S6 拆为 S6.1（path_shape 形态）+ S6.2（resolveEdges failure_reason，需先改 graph.js），U2 缺口 1 降级为"配置显式性"（删 TOCTOU 论据），C6 删除残留的 Round 1 重命名代码块，C5 修复示例不再写新模板 summary。**Finding 总数仍为 35**（S6 内部拆 step 不增 ID）。

**当前规模：35 条 Finding**（详情见 2.1 总览）。

### 0.2 对 AI agent 的具体影响

| 缺陷大类 | 对 AI agent 的影响 |
|---|---|
| `community_id` 以目录启发式为主（C1） | `surprising_connections` 若把 `cross_community` 单独当异常，会放大正常跨目录调用的噪音 |
| 全局符号乱消歧（C2 关联） | 生成错误 calls 边，`callers_of` / `impact` 给出虚假 blast radius |
| 相对路径 suffix 覆盖不全（C3） | 会漏掉一部分本地相对 import；但当前仓库 `imports_from` unresolved 主因其实是 builtins / 第三方 bare name |
| retrieval_text 信号空（D1） | FTS/LIKE/semantic-rerank 全建立在"文件路径 + 类型 + 名称"之上，召回严重受限 |
| `semantic-rerank` 实为 lexical overlap（C6） | 模糊查询提升有限，API/文件命名比真实能力更强 |
| diff 缺 hunk 级过滤（C7） | 改 1 行注释 → review-context 把整个文件的 50 个函数都当 affected，2-hop BFS 爆炸 |
| BFS 用 `Array.shift()`（P1） | 大仓库 impact / review-context 查询延迟乘以节点数 |
| FTS5 全量重建（P5） | 增量 build 每次重建 FTS 索引，限制了增量真正的速度 |

### 0.3 推荐修复路径

**Phase 1 → 2 → 3 → 4** 按正确性 → 性能 → Schema → 架构顺序推进，每 Phase 独立可验证、独立可发布。

---

## 1. 审查范围与方法

### 1.1 审查范围

覆盖 `src/crg/` 下全部源码：

- 核心 pipeline：`parser.js`、`graph.js`、`incremental.js`、`input-convergence.js`、`chunking.js`、`migrations.js`
- 后处理：`communities.js`、`flows.js`、`analyze.js`、`search.js`
- 查询命令：`cli/build.js`、`cli/query.js`、`cli/postprocess.js`、`cli/context.js`、`cli/router.js`、`cli/envelope.js`、`cli/open-db.js`
- 检索：`retrieval/api.js`、`retrieval/seed.js`、`retrieval/expand.js`、`retrieval/rerank.js`、`retrieval/semantic-rerank.js`、`retrieval/pack.js`、`retrieval/profiles.js`、`retrieval/query-plan.js`
- 变更分析：`changes.js`、`commands/review-context.js`、`commands/impact.js`、`commands/detect-changes.js`
- 代际管理：`generations/paths.js`、`generations/promote.js`、`generations/health.js`、`generations/rollback.js`
- 常量与配置：`constants.js`、`lang-config.js`、`artifact-paths.js`

### 1.2 方法

1. **静态审查**：逐文件阅读源码，识别算法原理漏洞、复杂度退化、边界条件、语义漂移；
2. **运行验证**：执行 `crg stats --repo=.` 获取 live 基线，交叉验证 build 输出；
3. **对比宣称**：将 `docs/项目介绍/CRG-代码图引擎分析.md` 与 README 的能力声明与代码实际行为比对，识别 doc/code drift；
4. **AI agent 视角**：为每个 finding 评估其对 plan/work/review 工作流的影响。

### 1.3 审查原则

- **以代码为准**：不以文档、注释、commit 说明作为事实依据；
- **不把"测试全绿"当作正确性证明**：测试覆盖的是"已假设正确的场景"，不一定能反证算法缺陷；
- **区分骨架 vs 血肉**：同样的代码布局，retrieval_text 空和 retrieval_text 含真实代码，能力是两个量级。

---

## 2. 优先级矩阵

### 2.1 总览

> **证据层级标签（Round 2 元审查）**：每条 Finding 增加一列"证据层级"：
>
> - ✅ **已验证代码**：根因直接对应源码行，改动前后行为可静态判定（如 F1、C2、C7 hunk 级语义、P1 `Array.shift()`）；
> - 🔬 **需 benchmark**：改动合理但收益/代价需要基准数据回填（如 P1 的具体下降百分比、Q4 pragma 效果、P5 增量重建 vs 全量的阈值）；
> - 🧭 **架构推断**：涉及语义/消费者行为假设，落地前需设计评审（如 C1 方案 B Louvain、D2 dense retrieval、D5 call-site schema 变更、U7 外部模块建模）。
>
> 下表的"证据"列标签用于 Phase 规划时区分"可立即动手"与"需先做 benchmark/design"。

| ID | 标题 | 级别 | Phase | 证据 | 位置 |
|---|---|---|---|---|---|
| F1 | `crg build` 0 变更增量 unresolved 口径分裂 | 🔴 高 | 1 | ✅ | `cli/build.js:287-291, 390-405` |
| C1 | `community_id` 以目录启发式分区为主，`surprisingConnections` 过度依赖 `cross_community` | 🔴 高 | 1 | ✅（方案 A）/ 🧭（方案 B Louvain）| `communities.js:75-102` |
| C2 | `resolveEdges` AMBIGUOUS 缓存只缓存状态，不缓存候选集 | 🔴 高 | 1 | ✅ | `graph.js:255-280` |
| C3a | JS/TS 相对路径 suffix 覆盖不全（不影响 Python/Ruby） | 🟡 中 | 1 | ✅ | `graph.js:313-316` |
| C3b | Python / Ruby module normalization 需独立 resolver | 🟡 中 | 2+ | 🧭 | `parser.js:453, 1138` + `graph.js` 新增 resolvers 分层 |
| C4 | basename fallback 只对 C/ObjC 头文件启用 | 🟡 中 | 1 | ✅ | `graph.js:322-330` |
| C5 | `chunking.js` 对 `line_end=0` 节点产生废块 | 🟡 中 | 1 | ✅ | `chunking.js:18-27` |
| C6 | `semantic-rerank` 实际是 lexical overlap rerank | 🟡 中 | 1 | ✅ | `retrieval/semantic-rerank.js:13-18` |
| C7 | `changes.js` 不做 hunk 级 diff 过滤 → 改三层输出 | 🔴 高 | 1 | ✅ | `changes.js:27-39` + `review-context.js:150-160` |
| P1 | BFS 普遍使用 `Array.shift()`（O(n²)） | 🔴 高 | 2 | ✅（语义）/ 🔬（收益量化）| `flows.js:59` 等 4 处 |
| P2 | `writeCommunities` 子社区统计 O(E×C) | 🔴 高 | 2 | ✅ | `communities.js:253-270` |
| P3 | 社区 community_id 传播关联子查询 N+1 | 🔴 高 | 2 | ✅ | `communities.js:346-354` |
| P4 | `detectFlows` 入口识别 `NOT IN (subquery)` O(N×E) | 🟡 中 | 2 | 🔬 | `flows.js:163-169` |
| P5 | FTS5 每次 postprocess 全量重建 | 🟡 中 | 2 | 🔬 | `search.js:85-126` |
| P6 | `searchNodesByLike` 全表扫 × term 数 | 🟡 中 | 2 | 🔬 | `retrieval/seed.js:27-34` |
| P7 | `assessFileRisk` fanIn N+1 查询 | 🔴 高 | 2 | ✅ | `changes.js:56` |
| P8 | `review-context` 加载全图 calls 边到内存 | 🟡 中 | 2 | 🔬 | `review-context.js:152-159` |
| S1 | `edges(target_id, kind)` 缺复合索引 | 🔴 高 | 3 | ✅ | `migrations.js:147-150` |
| S2 | `unresolved_edges` 无唯一约束 | 🟡 中 | 3 | ✅ | `migrations.js:104-112` |
| S3 | `expand.js` 无分块，接近 999 参数上限 | 🟡 中 | 3 | ✅ | `retrieval/expand.js:14-24` |
| S4 | FTS5 关键字转义仅去双引号 | 🟡 中 | 3 | ✅ | `search.js:31` |
| S5 | `nodes.id` 非稳定（含 lineStart） | 🟢 低 | 3 | 🧭 | `parser.js:108` |
| S6 | `unresolved_edges` 缺 `path_shape` + `failure_reason`（S6.1 形态 / S6.2 语义 两步走） | 🟡 中 | 3 | ✅（S6.1）/ 🧭（S6.2 需改 resolveEdges）| `migrations.js:104-112` + `graph.js:285-347` |
| D1 | `retrieval_text` 信号密度接近零 | 🔴 高 | 4 | ✅ | `parser.js:139` |
| D2 | dense retrieval / ANN 尚未进入 v1 主链 | 🟡 中 | 4 | 🧭 | `retrieval/*.js` 全局 |
| D3 | 权重全是硬编码魔法数字 | 🟡 中 | 4 | ✅ | `flows.js` / `changes.js` / `analyze.js` |
| D4 | chunk 内部分裂不是 AST-aware | 🟡 中 | 4 | ✅ | `chunking.js:22-38` |
| D5 | `calls` 边不含 call-site 行号 | 🟡 中 | 4 | 🧭 | `parser.js` + schema |
| D6 | `parser.js` 单文件 1841 行，16 语言混在一起 | 🟢 低 | 4 | ✅ | `parser.js` |
| Q1 | SECURITY_KEYWORDS 展开 O(N×25) | 🟢 低 | 横向 | ✅ | `flows.js:117`、`analyze.js`、`changes.js` |
| Q2 | `surprisingConnections` 两次扫 edges | 🟢 低 | 横向 | ✅ | `analyze.js:61-78` |
| Q3 | `isIos` 检测 `readdirSync` 全目录 | 🟢 低 | 横向 | ✅ | `cli/build.js:193-202` |
| Q4 | better-sqlite3 缺性能 pragma | 🟡 中 | 横向 | 🔬 | `migrations.js:21-23` |
| Q5 | generations/ 无自动回收 | 🟡 中 | 横向 | ✅ | `generations/*.js` |

### 2.2 按级别统计

- 🔴 高危：**10 条**
- 🟡 中危：**19 条**（含 U2、S6、C3b；原 17 + Round 2 修订）
- 🟢 低危：**6 条**（含 U1）
- **合计：35 条**（原 32 + U1/U2 + 拆分 C3 新增 C3b + 新增 S6）

### 2.3 新增 Finding（元审查补入）

| ID | 标题 | 级别 | Phase | 来源 | 位置 |
|---|---|---|---|---|---|
| U1 | `nodes.summary` / `chunks.summary` 是硬编码模板，属 dead weight | 🟢 低 | 4 | Round 1 | `parser.js:138`、`chunking.js:35` |
| U2 | `open-db.js` 缺 `fileMustExist` 与长进程连接复用（readonly 已有） | 🟡 中 | 3 | Round 2 事实修正 | `cli/open-db.js:51` |
| C3b | Python / Ruby module normalization 独立 resolver | 🟡 中 | 2+ | Round 2 拆分 | `parser.js:453,1138` + `graph.js` |
| S6 | `unresolved_edges` 缺形态/语义分类（S6.1 path_shape + S6.2 failure_reason 两步） | 🟡 中 | 3 | Round 2 → Round 3 拆两步 | `migrations.js:104-112` + `graph.js:285-347` |

### 2.4 unresolved 量化目标基线表

当前 baseline：`node_count=779 / edge_count=1977 / unresolved_edge_count=2809`。

> **审计性声明（Round 2/3 元审查）**：下表的 `node_builtin` / `bare_name` / `relative_path` / `slash_nonrelative` 是**人工根因分类**，**不是 `unresolved_edges` 表的持久化字段**。当前 schema（`migrations.js:104-112`）只存 `source_id / source_file / edge_kind / target_name / target_path_raw`。
>
> **Round 3 修正**：S6.1（path_shape 形态分类）落地后，可对账"形态分布"，但**仍不能**断言"修了 C3a 就少 N 条 suffix_not_covered"——同一形态可能因多种原因失败。只有 **S6.2**（resolveEdges 显式 failure_reason）落地后，本表才能升级为 CI 可强制断言的真审计基线。在 S6.2 未落地之前，下表数字**只能作为人工审计参考**。

| 修复项 | 预期 unresolved 下降（条） | 说明 |
|---|---|---|
| C2（AMBIGUOUS 缓存 + 若同步引入 import-covered 守卫） | 50-100 | scope-aware 消歧可能把假阳性边降级为 unresolved，总数可能**先略升再回落** |
| C3a（JS/TS 相对路径 suffix 扩展） | ~10 条降为 resolved | 当前仓库 `relative_path` bucket 仅 10 条，影响有限 |
| C4（basename fallback 泛化） | 20-50 | 视仓库语言构成而定，本仓库 JS/TS 为主，影响小 |
| 组合效果（当前仓库） | 2809 → 2700-2750 | 当前 baseline 的 `imports_from` unresolved 主因是 `node_builtin`(128) + `bare_name`(124)，这些不是 C2/C3a/C4 的目标 |
| 真正的大头：外部模块建模（超出本次审查） | 200-250 | 需要对 Node builtins / Python stdlib / npm 第三方做 "已知外部模块集合"，见 C3a 根因分析；也需 C3b（Python/Ruby module normalization）|

**关键诚实度声明**：

- Phase 1 修完后，本仓库 `unresolved_edge_count` 不会降到 2000 以下；真正能让它大幅下降的是"外部模块已知集合建模"，不在当前 35 条 Finding 的 Phase 1 范围里；
- 对 AI agent 消费而言，**`unresolved_count` 本身不是目标**；目标是 "resolved 边的假阳性率" 下降、surprising/risk 信号精度提升，这些靠 C1/C2/C7 而非 C3a；
- 量化目标表的主要作用是**防止 Phase 1 验收被 unresolved 绝对数字误导**；
- 在 S6.2 未落地之前，表中数字**只能作为人工审计参考**，不能作为 CI 回归门禁；S6.1 单独落地时只能做"形态分布"对账。

---

## 3. 修复路线图

### 3.1 Phase 结构

```
Phase 1  正确性缺陷（Critical Fixes）
  ├─ F1、C1-C7
  ├─ 目标：消除静默假阳并校准关键消费语义
  ├─ 验证：新增 unit + e2e 回归
  └─ 工期：3-5 工作日

Phase 2  算法复杂度与性能
  ├─ P1-P8
  ├─ 目标：可测量 build / query 延迟下降
  ├─ 验证：benchmarks 新增 before/after 计时
  └─ 工期：3-4 工作日

Phase 3  SQL / Schema / 数据结构
  ├─ S1-S5
  ├─ 目标：SQLite 层性能与数据一致性
  ├─ 验证：migrations 幂等、现有 db 可升级
  └─ 工期：1-2 工作日

Phase 4  设计层架构改造
  ├─ D1-D6
  ├─ 目标：从 "骨架索引" 升级为 "可检索事实库"
  ├─ 验证：检索召回率 / 语义相关度指标
  └─ 工期：**拆为 3 个子 phase**，总计 4-6 周
     ├─ Phase 4.1 重命名 + retrieval_text 真实化 (D1/D4/C6 重命名兼容层)    — 1 周
     ├─ Phase 4.2 dense retrieval / ANN (D2 含模型分发与 CI cache 策略)       — 2-3 周
     └─ Phase 4.3 call-site 精度 + parser 拆分 + 权重配置化 (D3/D5/D6)         — 1-2 周

横向项  Quick Wins（Q1-Q5）
  ├─ 随任一 Phase 附带执行
  └─ 工期：合并到各 Phase 内
```

### 3.2 Phase 之间的依赖关系

```
F1 ──┐
     ├─> Phase 1 (C1-C7) ──> Phase 2 (P1-P7) ──┬─> Phase 4 (D1-D6)
     │                                          │
     └──────────────────────> Phase 3 (S1-S5) ──┤
                                                │
     Phase 3.S1 (edges(target_id,kind) 复合索引) ──> Phase 2.P8 (review-context 按需加载)
```

- Phase 1 必须先行：正确性是其他所有修复的前置条件；
- Phase 2 与 Phase 3 大部分可并行；**但 P8 依赖 S1**：review-context 按需加载反向邻接的查询形如 `WHERE target_id IN (...) AND kind='calls'`，没有 `(target_id, kind)` 复合索引时性能反而比全图加载更差。实施顺序必须是 `S1 → P8`；
- Phase 4 依赖 Phase 2 + Phase 3：架构改造要在性能/Schema 稳定后推进。

### 3.3 每 Phase 的验收门禁

| Phase | 门禁条件 |
|---|---|
| 1 | 新增 unit test 覆盖 F1、C1-C7 每个 finding；`crg build` + `crg stats` unresolved 一致；`surprising_connections` 测试用例有强语义断言（不只是 count > 0） |
| 2 | 现有 `tests/e2e/crg-all-commands.sh` 不回归；benchmarks 记录 build / review-context 时间下降 |
| 3 | migrations 对老 db 可幂等升级；`tests/smoke/install-tarball.sh` 通过 |
| 4 | 检索召回率基准（需先建立）有可测量提升；术语边界明确（例如 `semantic-rerank` 的 lexical overlap 属性被显式说明） |

### 3.4 风险与回滚

- **代际机制提供天然回滚**：每次 build 产生独立 generation DB，promote 失败自动保留旧版本；
- **所有 schema 改动加 migration**：支持从 v1 db 升级，不破坏现有用户；
- **敏感改动（C1 / D1 / D2）**：建议在独立 feature flag / profile 下引入，不一次性替换默认行为。

---

## 4. Findings

（Findings 详情见后续章节：Phase 0 / Phase 1 / Phase 2 / Phase 3 / Phase 4 / Quick Wins）

每个 Finding 统一采用以下七段式：

1. **标题 + 级别 + Phase**
2. **位置**（file:line）
3. **问题描述**（现象 / 代码片段）
4. **根因分析**（为什么错 / 为什么慢 / 为什么容易被过度解读）
5. **修复方案**（before/after 代码草图 + 替代方案）
6. **影响评估**（对 build / retrieval / AI agent 的影响）
7. **验证方式**（如何 unit test / 如何 e2e test / 如何量化）

---

## 5. 继承 Finding（纳入 Phase 1 执行）

> **命名说明**：F1 在优先级矩阵里列入 Phase 1 执行，本章节保留"继承"措辞仅为提醒它来源于前次全项目审查，不代表有独立的 Phase 0。

### F1. `crg build` 在 0 变更增量构建时返回错误的 unresolved 计数

- **级别**：🔴 高
- **Phase**：1
- **位置**：`src/crg/cli/build.js:287-291, 390-405`

#### 问题描述

在 `parsedChanged.length === 0 && !force` 时，`build.js:287-291` 明确**不更新**持久化的 `graph_meta.unresolved_edge_count` 与 `unresolved_edges` 表：

```js
if (parsedChanged.length > 0 || force) {
  setUnresolvedEdgeCount(db, unresolvedCount);
  replaceUnresolvedEdges(db, unresolved);
}
```

但紧接着构造返回 envelope 时仍直接把本轮内存中的 `unresolvedCount` 写入：

```js
// build.js:390-405
const envelope = makeEnvelope(repoRoot, {
  ...
  unresolved_edge_count: unresolvedCount,        // ← 本轮内存值（0 变更时 = 0）
  last_build_unresolved_edge_count: unresolvedCount,
  ...
});
```

结果：`crg build` 返回 `unresolved_edge_count: 0`，但 `crg stats` 返回 `unresolved_edge_count: 2809`。同一图谱、同一时刻、两个官方入口结论矛盾。

#### 根因分析

代码路径分裂：持久化路径受门控，但返回值路径没受门控。这是"**写 vs 读**"不一致的典型 bug。

#### 修复方案

在 `parsedChanged.length === 0 && !force` 分支下，从持久化真相回读：

```js
// 修复后 —— 回读必须覆盖 envelope 里所有 last_build_* 字段
let reportedUnresolvedCount = unresolvedCount;
let reportedTopKinds = topUnresolvedKinds;
let reportedTopFiles = topUnresolvedFiles;
let reportedSamples = unresolvedSamples;
let reportedSampleCount = unresolved.length;

if (parsedChanged.length === 0 && !force) {
  // 1. count
  const metaRow = db.prepare('SELECT unresolved_edge_count FROM graph_meta WHERE id = 1').get();
  reportedUnresolvedCount = metaRow?.unresolved_edge_count ?? 0;

  // 2. summary aggregates（按持久化表重新统计，而非用本轮内存值）
  reportedTopKinds = db.prepare(`
    SELECT edge_kind AS kind, COUNT(*) AS count
    FROM unresolved_edges GROUP BY edge_kind ORDER BY count DESC LIMIT 5
  `).all();
  reportedTopFiles = db.prepare(`
    SELECT source_file AS file_path, COUNT(*) AS count
    FROM unresolved_edges GROUP BY source_file ORDER BY count DESC LIMIT 5
  `).all();
  reportedSamples = db.prepare(`
    SELECT source_id, source_file, edge_kind, target_name, target_path_raw
    FROM unresolved_edges LIMIT 10
  `).all();
  reportedSampleCount = db.prepare('SELECT COUNT(*) AS c FROM unresolved_edges').get()?.c ?? 0;
}

const envelope = makeEnvelope(repoRoot, {
  ...
  unresolved_edge_count: reportedUnresolvedCount,
  last_build_unresolved_edge_count: reportedUnresolvedCount,
  last_build_unresolved_summary: {
    top_kinds: reportedTopKinds,
    top_source_files: reportedTopFiles,
    sample_count: reportedSampleCount,
  },
  last_build_unresolved_samples: reportedSamples,
  ...
});
```

**关键修订（M4）**：仅回读 `unresolved_edge_count` 而不回读 `top_kinds` / `top_source_files` / `samples`，会产生 "count=2809 + top_kinds=[] + samples=[]" 的内部自相矛盾 envelope。修复必须**一次性覆盖所有 unresolved 字段**。

#### 影响评估

- 上层工作流（`spec-code-review` 消费 `review-context`）如果读 `build` 返回判断"最近构建是否 clean"，会在增量构建时误判为零 unresolved；
- 修复后 `build` 与 `stats` 口径强一致，CRG 的"工程事实底座"可信度恢复。

#### 验证方式

新增 `tests/unit/crg-build-unresolved-consistency.test.js`：

```js
test('crg build 在 0 变更增量时返回持久化真相', () => {
  // 1. 全量构建，产生 unresolved
  // 2. 再次 build（0 变更）
  // 3. 断言 build 返回的 unresolved_edge_count === stats 返回的 unresolved_edge_count
});
```

---

## 6. Phase 1：正确性缺陷

### C1. `community_id` 以目录启发式分区为主，`surprisingConnections` 过度依赖 `cross_community`

- **级别**：🔴 高
- **Phase**：1
- **位置**：`src/crg/communities.js:75-102`

#### 问题描述

Pass 1 按 file_path 第一个非容器目录分组：

```js
for (const node of moduleNodes) {
  const parts = node.file_path.split('/');
  let dir = '(root)';
  for (let i = 0; i < parts.length - 1; i++) {
    if (!CONTAINER_DIRS.has(parts[i])) {
      dir = parts[i];
      break;
    }
  }
  if (!communityMap[dir]) communityMap[dir] = [];
  communityMap[dir].push(node);
}
```

Pass 2 只评估"健康度标签"，Pass 3 只对超大社区做连通分量拆分。代码事实表明：`community_id` **主要反映目录启发式分区**，图拓扑只在 oversized 社区时参与 BFS 精化；它不是"全局按耦合关系算出来的聚类结果"。

#### 根因分析

问题不在于 `3-Pass` 这个词本身虚假。`docs/项目介绍/CRG-代码图引擎分析.md` 已按"目录框架 + 健康评估 + BFS 精化"描述当前实现。真正的风险在消费侧：`analyze.js:112-116` 把 `cross_community` 直接给 40 分，等价于把"跨目录启发式分区"当成强异常信号。对合理模块化的代码库，跨目录调用是架构常态，不应单独构成高分惊喜。

#### 修复方案

**方案 A（推荐，最小侵入）**：保留目录分组作为 baseline，但**降低 surprising_connections.cross_community 权重**到 15，并要求与 `cross_language` 或 `peripheral_to_hub` 至少一项共同触发：

```js
// analyze.js 修复后
if (src.community_id !== tgt.community_id) {
  // cross_community 只是触发条件，不单独构成高分
  reasons.push('cross_community');
  // 不直接加分，留到组合判定
}
// ... 在最后组合判定：
if (reasons.includes('cross_community') && (reasons.includes('cross_language') || reasons.includes('peripheral_to_hub'))) {
  score += 30;  // 组合后才加权
}
```

**关键阈值说明（M2）**：

当前代码 `analyze.js:127` 有 `if (score < 30) continue` 过滤。方案 A 必须与此阈值对齐：
- 组合给 30 分 **刚好** 等于 min_score 阈值，可以通过过滤；
- 若未来调整 `min_score`，本条也要同步调整组合分；
- 建议把 `min_score=30` 连同这 4 项权重一起迁入 D3 的 `weights/defaults.json` 中显式管理，形成"权重 + 阈值"的原子配置，防止未来调一边忘了另一边。

若不启用 D3，至少在 analyze.js 内增加常量：

```js
const SURPRISING_MIN_SCORE = 30;
const CROSS_COMMUNITY_COMBINED_SCORE = 30;  // 与 MIN_SCORE 严格相等
```

**方案 B（彻底修复）**：引入 `graphology-communities-louvain`（纯 JS，无原生依赖），在 module 级别跑 Louvain：

```js
// 伪代码
const graph = new Graph();
moduleNodes.forEach(n => graph.addNode(n.id));
moduleEdges.forEach(e => graph.addEdge(e.src, e.tgt));
const communities = louvain(graph, { resolution: 1.0 });
// 用 Louvain 结果覆盖 nodeToCommunity
```

**方案 C**：在消费者与报告中明确 `community_id` 的语义边界: 它当前是"目录优先分区 + oversized BFS 精化"，不是耦合驱动的全局社区发现。

#### 影响评估

- **当前**：AI agent 消费 `surprising_connections` 时，看到一堆"跨目录调用"的噪音信号，**无法区分架构常态 vs 真正的异常边**；
- **修复后（方案 A）**：surprising 信号质量立刻提升；
- **修复后（方案 B）**：社区边界更接近真实耦合度，`similar_to` 查询精度有望进一步提升。

#### 验证方式

新增 `tests/unit/crg-surprising-semantics.test.js`：

```js
test('surprising_connections 不再把正常跨目录调用报告为惊喜', () => {
  // 构造场景：src/auth 调用 src/utils
  // 断言 surprising 为空（这是正常架构）
});

test('真正的跨语言 + 跨社区调用才进 surprising', () => {
  // 构造 swift 调用 js 的不寻常边
  // 断言 surprising 命中
});
```

#### 依赖

- 方案 B 需要新增 npm 依赖 `graphology` + `graphology-communities-louvain`（约 60KB）
- 方案 A 零新增依赖，推荐作为 Phase 1 快速收敛

---

### C2. `resolveEdges` AMBIGUOUS 缓存只缓存状态，不缓存候选集

- **级别**：🔴 高
- **Phase**：1
- **位置**：`src/crg/graph.js:255-280`

#### 问题描述

```js
const getSymbolId = (name, srcFile) => {
  if (symbolCache[name] !== undefined) {
    const cached = symbolCache[name];
    if (cached !== AMBIGUOUS) return cached;
    // ↓ AMBIGUOUS 分支每次都重新扫全表
    const rows = getAllSymbolRows.all(name);
    const sameFile = rows.filter((r) => r.file_path === srcFile);
    return sameFile.length === 1 ? sameFile[0].id : null;
  }
  // ... 首次查询逻辑
};
```

当 `name` 全局重名（AMBIGUOUS）时，**每次调用都重新执行 `getAllSymbolRows.all(name)`**，缓存只省去了 `rows.length` 判断。

#### 根因分析

缓存设计缺陷：AMBIGUOUS 存在的目的是"记住需要同文件消歧"，但没把消歧数据（rows）一起缓存。

对于 `run`、`build`、`init`、`parse`、`resolve` 这类 JS/Node 项目高频重名 symbol，这在每次 resolveEdges 里会被调用几十~几百次。

#### 修复方案

缓存 rows 本身：

```js
// 修复后
const getSymbolId = (name, srcFile) => {
  let cached = symbolCache[name];
  if (cached === undefined) {
    const rows = getAllSymbolRows.all(name);
    if (rows.length === 0) {
      cached = { status: 'none' };
    } else if (rows.length === 1) {
      cached = { status: 'unique', id: rows[0].id };
    } else {
      cached = { status: 'ambiguous', rows };
    }
    symbolCache[name] = cached;
  }

  if (cached.status === 'none') return null;
  if (cached.status === 'unique') return cached.id;

  // ambiguous：从缓存的 rows 里做同文件过滤（无 SQL）
  const sameFile = cached.rows.filter((r) => r.file_path === srcFile);
  return sameFile.length === 1 ? sameFile[0].id : null;
};
```

#### 影响评估

- 在重名 symbol 较多的仓库，可明显减少 `resolveEdges` 的重复 SQL；
- 增量 build 时间有望下降，但需 benchmark 实测后再量化。

#### 验证方式

- 基准测试：对 `inventory.mjs`（当前 292 条 unresolved）添加 1 个新 require，测量 resolveEdges 耗时；
- `tests/unit/crg-resolve-edges-cache.test.js`：断言同一 AMBIGUOUS name 多次调用时 `getAllSymbolRows.all` 只执行一次（通过 spy 计数）。

---

### C3a. JS/TS 相对路径 suffix 覆盖不全

- **级别**：🟡 中
- **Phase**：1
- **位置**：`src/crg/graph.js:313-316`

> **拆分说明（Round 2 元审查）**：原 C3 把 JS/TS 文件系统相对路径、Python 模块语义、Ruby `require`/`require_relative` 混在一张 suffix 表里，**三者 import 语义根本不同**。已拆为 C3a（本条，JS/TS 范围）+ C3b（Python/Ruby module normalization，独立 Finding 推迟）。

#### 问题描述

```js
for (const suffix of ['', '.js', '.mjs', '.ts', '/index.js']) {
  targetId = getModuleId(resolvedBase + suffix);
  if (targetId) break;
}
```

当前相对路径 fallback 缺失以下 JS/TS 扩展：
- `.tsx`（本仓库用，TypeScript + JSX）
- `.cjs` / `.cts`（CommonJS TypeScript / CJS ESM 项目）
- `.jsx`
- `/index.ts`、`/index.tsx`、`/index.mjs`、`/index.cjs`（现代 TS monorepo 常用）

触发条件：`graph.js:298` 的 `if (!targetId && normalized.startsWith('.') && raw.source_id)` 已限定在"以 `.` 开头的相对路径 raw"，与 Python / Ruby 的 module name 语义隔离。本条只修 JS/TS 分支。Python `from .utils import X`、Ruby `require_relative './helper'` 划入 **C3b** 独立处理。

但复核 active generation DB 的 `unresolved_edges` 后，当前仓库 `imports_from` 的实际分布是：

- `node_builtin`: 128
- `bare_name`: 124
- `relative_path`: 10
- `slash_nonrelative`: 1

也就是说，**相对路径 suffix 不全确实是问题，但只解释了当前仓库 263 条 `imports_from` unresolved 里的很小一部分**；主因其实是 Node/Python builtins 与第三方 bare-name import 没被建模为"外部模块已知集合"。

#### 根因分析

相对路径解析确实基于较早的 Node.js CJS 假设，没有跟随语言扩展；但报告如果把当前 baseline 的 `imports_from` unresolved 主要归因为 suffix 缺失，就是证据外推过度。

#### 修复方案

**只扩 JS/TS 语言分支，不跨语言混合**：

```js
// graph.js 修改 resolveEdges 内部的相对路径分支
function resolveJsLikeRelative(rawPath, sourcePath, getModuleId) {
  // 仅在 rawPath 以 '.' 开头时调用；srcLang 仅限 javascript / typescript
  const srcLang = inferLanguage(sourcePath);
  let suffixes;
  if (srcLang === 'typescript') {
    suffixes = ['', '.ts', '.tsx', '.cts', '.mts',
                '/index.ts', '/index.tsx', '/index.mts', '/index.cts',
                '.js', '.jsx', '.mjs', '.cjs',  // TS 允许 import JS
                '/index.js', '/index.mjs', '/index.cjs'];
  } else if (srcLang === 'javascript') {
    suffixes = ['', '.js', '.mjs', '.cjs', '.jsx',
                '/index.js', '/index.mjs', '/index.cjs'];
  } else {
    return null;  // 其他语言不走这里，见 C3b
  }
  // ... 原有路径拼接逻辑
  for (const suffix of suffixes) {
    const id = getModuleId(resolvedBase + suffix);
    if (id) return id;
  }
  return null;
}
```

**明确不做的事**（划入 C3b）：
- Python `from .utils import X` 的 module name 规范化；
- Ruby `require` / `require_relative` 的路径解析；
- Go / Java 等其他语言的 import 模式。

#### 影响评估

- 对本地相对 import 的命中率有帮助，TypeScript/TSX 项目尤其受益；
- 但在当前仓库基线上，它不应被视为 `imports_from` unresolved 的主修复路径。

#### 验证方式

- `tests/unit/crg-relative-path-jsts.test.js`：构造 TSX / CTS / MTS / `/index.tsx` 相对 import 场景，断言解析成功；
- 基线数据对比：修复前后 `unresolved_edges` 里 `target_path_raw` 以 `.` 开头的条数差值（S6 落地前先人工抽样）。

---

### C3b. Python / Ruby module normalization 不在 JS/TS resolver 范围

- **级别**：🟡 中
- **Phase**：2 或更晚（不在 Phase 1 范围）
- **位置**：`src/crg/parser.js:453`（Python `import_from_statement`）、`src/crg/parser.js:1138`（Ruby `require` / `require_relative`）+ `src/crg/graph.js` 需要新增 module resolver

> **拆分说明（Round 2 元审查）**：从原 C3 拆出。Python/Ruby 的"模块名 → 文件路径"不是 filesystem-style suffix 补全，是语言级 resolver 工程。

#### 问题描述

**Python**：
- `from .utils import foo` 里 parser 提取的 `target` 是模块名文本 `utils`，不是文件系统路径；
- `from ..common.helpers import bar` 需要理解 package `__init__.py` / `__init__.pyi` / namespace package；
- `import numpy.linalg.norm` 需要 `sys.path` 检索 + package 结构解析。

**Ruby**：
- `require 'active_support/core_ext/string'` 查的是 `$LOAD_PATH` 里每个目录；
- `require_relative './helper'` 是文件系统相对路径，但**只查 `.rb`**（无扩展名推断）；
- Rails autoload 路径（`app/models/user.rb` → `User` 常量）是 Ruby 特有语义。

强行把这些塞进 `resolveJsLikeRelative` 的 suffix 表会产生假阳性（例如把 Python `utils` 错绑到 JS 仓库某个 `utils.js` 模块）。

#### 根因分析

当前 resolver 体系没有 "per-language module resolver" 分层。每个语言需要独立的 resolver 插件。

#### 修复方案（方向性，不在 Phase 1 落地）

建立 `src/crg/resolvers/` 分层：

```
src/crg/resolvers/
  index.js              ← 按 srcLang 分发
  jsts-relative.js      ← C3a 落地，覆盖 filesystem suffix
  python-module.js      ← sys.path + __init__.py 检索
  ruby-module.js        ← $LOAD_PATH + require_relative 分流
  go-package.js         ← import path → directory 解析
```

每个 resolver 导出 `resolve(rawEdge, sourcePath, db): nodeId | null`。`graph.resolveEdges` 按 srcLang 调用相应 resolver。

Python resolver 至少需要：
1. `sys.path` 配置（从 repo 根的 `setup.py` / `pyproject.toml` / `.python-version` 推断）；
2. Package 结构（`__init__.py` 存在性）；
3. Relative import 层级（`from ..foo` = 向上 2 层）。

Ruby resolver 至少需要：
1. `$LOAD_PATH` 配置（`Gemfile` + `.ruby-version` 启发）；
2. `require` vs `require_relative` 分流；
3. Rails autoload 路径（可选，按项目启发）。

#### 影响评估

- 不在 Phase 1 范围，不阻塞主线；
- 推进后，Python / Ruby 项目的 `unresolved_edge_count` 可能大幅下降；
- 为未来"外部模块已知集合"（Node builtins / Python stdlib / Ruby stdlib）工程打基础。

#### 验证方式

独立 Finding 推进时再定；Phase 1 阶段不需要覆盖。

---

### C4. basename fallback 只对 C/ObjC 头文件启用

- **级别**：🟡 中
- **Phase**：1
- **位置**：`src/crg/graph.js:322-330`

#### 问题描述

```js
if (!targetId && raw.target_path_raw) {
  const rawPath = raw.target_path_raw.replace(/\\/g, '/');
  const isFilenameOnly = !rawPath.includes('/');
  const isHeaderExt = /\.(h|hpp|hh|hxx|m|mm|c|cc|cpp|cxx)$/i.test(rawPath);
  if (isFilenameOnly && isHeaderExt) {
    const srcFile = raw.source_id ? raw.source_id.split('#', 1)[0] : '';
    targetId = getModuleByBasename(rawPath, srcFile);
  }
}
```

Java `import foo.Bar`（parser 如产出纯 basename）、Python 模块名、Ruby 常量引用、Swift 不带路径的 module import 全都跳过了 basename fallback。

#### 根因分析

当初设计 basename fallback 是为 ObjC `#import "file.h"` 的场景，没泛化到其他语言。

#### 修复方案

扩展触发条件：任何 `isFilenameOnly` 且扩展名属于 `INDEXABLE_EXTS` 的 target 都走 basename fallback：

```js
const { INDEXABLE_EXTS } = require('./input-convergence');

if (!targetId && raw.target_path_raw) {
  const rawPath = raw.target_path_raw.replace(/\\/g, '/');
  const isFilenameOnly = !rawPath.includes('/');
  const ext = path.extname(rawPath).slice(1).toLowerCase();
  const isIndexable = INDEXABLE_EXTS.has(ext);
  if (isFilenameOnly && isIndexable) {
    const srcFile = raw.source_id ? raw.source_id.split('#', 1)[0] : '';
    targetId = getModuleByBasename(rawPath, srcFile);
  }
}
```

#### 影响评估

- Java / Python / Ruby / Swift 多语言仓库受益；
- 本仓库主要是 JS/TS，影响较小，但对外用户场景重要。

#### 验证方式

新增 Python / Ruby / Swift basename fallback 单测。

---

### C5. `chunking.js` 对 `line_end=0` 节点产生废块

- **级别**：🟡 中
- **Phase**：1
- **位置**：`src/crg/chunking.js:18-27`

#### 问题描述

```js
const span = Math.max((node.line_end || 0) - (node.line_start || 0) + 1, 1);
const chunkCount = Math.max(1, Math.ceil(span / effectiveMaxLines));

for (let index = 0; index < chunkCount; index++) {
  const start = (node.line_start || 0) + (index * effectiveMaxLines);
  const end = Math.min((node.line_end || 0), start + effectiveMaxLines - 1);
  chunks.push({
    ...
    line_start: start,
    line_end: end,   // ← 可能 < line_start，产生颠倒块
  });
}
```

当 parser 对某类节点未填 `line_end`（某些 tree-sitter grammar 异常时可能发生），产出的 chunk 会出现 `line_start > line_end` 的数据不合法状态，污染 chunks 表。

#### 根因分析

边界条件处理不完整：依赖"所有 node 都有合法 line_start/line_end"的假设，但 parser 返回的数据结构没有强约束。

#### 修复方案

在 chunking 入口校验：

```js
function buildChunksForNodes(nodes, { maxLines = DEFAULT_MAX_CHUNK_LINES } = {}) {
  const chunks = [];
  for (const node of nodes) {
    if (!node || node.kind === 'module') continue;

    const start = node.line_start || 0;
    const end = node.line_end || 0;
    // 合法性校验：line_end < line_start 时，退化为单行 chunk
    if (end < start) {
      chunks.push({
        id: sanitizeChunkId(node.id, 1),
        node_id: node.id,
        parent_symbol_id: node.id,
        generation_id: node.generation_id || null,
        file_path: node.file_path,
        kind: 'chunk',
        name: `${node.name}#chunk1`,
        line_start: start,
        line_end: start,                      // 强制等于 line_start
        summary: null,                        // ← Round 3：不再写模板字符串（与 U1 对齐：模板 summary 是 dead weight）
        retrieval_text: node.retrieval_text || null,  // ← 不再生成"file_path kind name"模板，等 D1 给出真实 retrieval_text 后再补
      });
      continue;
    }

    // 正常切分逻辑 ...
  }
  return chunks;
}
```

#### 影响评估

- chunks 表不再出现非法 line 范围；
- 检索层 `loadChunksByFiles` 返回的数据合法性可靠。

#### 验证方式

`tests/unit/crg-chunking-edge-cases.test.js`：构造 `line_end=0` 节点，断言 chunks 合法。

---

### C6. `semantic-rerank` 实际是 lexical overlap rerank

- **级别**：🟡 中
- **Phase**：1
- **位置**：`src/crg/retrieval/semantic-rerank.js:13-18`

#### 问题描述

```js
const haystack = `${item.name} ${item.retrieval_text}`.toLowerCase();
const overlap = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
return { ...item, score: item.score + (overlap * 0.5), ... };
```

这是朴素子串计数，不是 dense semantic rerank。没有 embedding、没有 IDF、没有词干化、没有 identifier subword 拆分。需要注意的是，当前 `docs/项目介绍/CRG-代码图引擎分析.md` 已把它写成"query 词项与 name+retrieval_text 的重叠度"，因此这里更准确的定性是**API / 文件命名偏强，能力上限偏低**，而不是现有项目介绍存在明显 doc/code drift。

#### 根因分析

命名与实现之间仍有被过度解读的空间。此外 `retrieval_text` 本身信号稀薄（见 D1），即便未来接入 dense rerank，也需要先补文本载体。

#### 修复方案

> **Round 3 修订**：原 Round 1 给的"重命名为 `lexical-overlap-rerank.js`"代码草图已废弃。**当前唯一有效方案是下面的"原地增强策略"——保留 `semantic-rerank.js` 文件名，只改实现 + 加文件头注释**。Round 1 的重命名草图与 Round 2 的"保留文件名"决策直接冲突，已删除。

**Phase 4 根治**：参见 D2（混合检索无 embedding）。

**原地增强策略（Round 2 元审查修订，Round 3 维持）**：

原版本推荐"重命名文件 + re-export 兼容层 + `@deprecated` + 下个 major 删除"。**这是过度工程**：
- 文件是内部模块，`retrieval/api.js` 是唯一 caller；
- 现有测试 `tests/unit/crg-semantic-rerank.test.js` 只测内部行为，不是公开契约；
- 引入兼容层反而让 Phase 1 工作量增加而收益为零。

**采用更务实的方案**：**保留文件名 `semantic-rerank.js` 不改，只改实现**：

1. 函数内部升级为 `identifier-aware lexical overlap`（subword 拆分 + 集合交集），实现示例：

   ```js
   // src/crg/retrieval/semantic-rerank.js（保留文件名，只改实现）
   function splitIdentifier(s) {
     // 'getUserById' -> ['get', 'user', 'by', 'id']
     return String(s || '')
       .split(/(?=[A-Z])|[_\-./\s]+/)
       .map(t => t.toLowerCase())
       .filter(Boolean);
   }

   function semanticRerank(items, { query = '', enabled = false } = {}) {
     if (!enabled) return items;
     const queryTerms = new Set(splitIdentifier(query));
     return [...items].map((item) => {
       const haystackTerms = new Set([
         ...splitIdentifier(item.name || ''),
         ...splitIdentifier(item.retrieval_text || ''),
       ]);
       let overlap = 0;
       for (const t of queryTerms) if (haystackTerms.has(t)) overlap++;
       return { ...item, score: item.score + overlap * 0.5 };
     }).sort((l, r) => r.score - l.score);
   }

   module.exports = { semanticRerank };  // 保留旧函数名
   ```

2. 文件头注释明确标注：

   ```js
   /**
    * ⚠️ Lexical overlap rerank, NOT dense semantic rerank.
    *
    * This module reranks retrieval results by token-level overlap between
    * query and item.name + item.retrieval_text (with identifier subword
    * splitting, e.g. `getUserById` → ['get','user','by','id']).
    *
    * For true semantic reranking (embedding + cosine similarity),
    * see Phase 4 D2 (`retrieval/dense-rerank.js`).
    */
   ```

3. `docs/项目介绍/CRG-代码图引擎分析.md` 术语边界段同步明确；
4. 保留旧函数名 `semanticRerank` 作为 export（零 breaking）；
5. 下一个 major 版本如果真引入 dense rerank，再另建 `dense-rerank.js` 并重命名 lexical 模块。那是一次大改，与现在这次 Phase 1 解耦。

#### 影响评估

- Phase 1 最小修复后，identifier 驱动的 query 精度提升；
- 术语边界更清晰，避免调用方把它误解为 dense semantic rerank。

#### 验证方式

`tests/unit/crg-lexical-rerank.test.js`：
- `getUserById` query 能 match `fetch_user_by_id` 节点（subword 拆分后 both 含 user/by/id）；
- 纯子串匹配下该场景会 miss。

---

### C7. `changes.js` 不做 hunk 级 diff 过滤 —— 改为三层并存输出

- **级别**：🔴 高
- **Phase**：1
- **位置**：`src/crg/changes.js:27-39` + `src/crg/commands/review-context.js:150-160`

#### 问题描述

```js
function getChangedFilesFromGit(repoRoot, since) {
  const output = execFileSync(
    'git',
    ['diff', '--name-only', since, 'HEAD'],   // ← 只拿文件名
    ...
  );
  ...
}
```

`assessNodePriorities` 对变更文件里**所有** function/method/class 打分（`changes.js:308-310`）：

```js
const nodes = db.prepare(
  "SELECT id, name, kind FROM nodes WHERE file_path = ? AND kind IN ('function', 'method', 'class')"
).all(filePath);
```

**后果**：改 1 行注释 → review-context 把整个文件的 50 个函数都列为 affected → 每个再做 2-hop 反向 BFS → blast_radius 爆炸性的假阳性。

#### 根因分析

文件级 diff 是最粗粒度，没利用 git 的行号信息。

#### 修复方案（Round 2 元审查修订：三层并存，不替换）

**原版本推荐"只保留与 hunk 相交的节点"——这会产生新的假阴性**：
- 文件头 import 变化（影响整个 module）；
- 模块级常量 / default export 变化（外溢全文件）；
- 类级 signature 变化（影响 class 所有 method）；
- 这些都不会命中某个具体 function 的 hunk 区间。

**正确做法：保留文件级语义，追加 hunk-level 和 module-scope-level 两层，让消费方自行选择**。

**修复 1：`changes.js` 提取 hunks**

```js
function getChangedHunksFromGit(repoRoot, since) {
  const output = execFileSync(
    'git',
    ['diff', '--unified=0', since, 'HEAD'],
    { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  const result = [];
  let currentFile = null, currentHunks = [];
  for (const line of output.split('\n')) {
    const fileMatch = line.match(/^\+\+\+ b\/(.+)$/);
    if (fileMatch) {
      if (currentFile) result.push({ file: currentFile, hunks: currentHunks });
      currentFile = fileMatch[1];
      currentHunks = [];
      continue;
    }
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch) {
      const start = parseInt(hunkMatch[1], 10);
      const count = hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1;
      currentHunks.push({ start, end: start + count - 1 });
    }
  }
  if (currentFile) result.push({ file: currentFile, hunks: currentHunks });
  return result;
}
```

**修复 2：`review-context.js` envelope 改为三层并存**

```js
// 现有 affected_nodes 语义保留不变（所有非 module 节点）
const affected_nodes = [...];

// 新增 hunk_hit：严格与 hunk 相交的 function/method/class
const hunk_hit = nodes.filter(n =>
  hunks.some(h => !(n.line_end < h.start || n.line_start > h.end))
);

// 新增 module_scope_hit：hunk 覆盖了文件头部（line <= firstFunctionStart）或类体 signature 行
const firstFnStart = Math.min(...nodes
  .filter(n => n.kind === 'function' || n.kind === 'class')
  .map(n => n.line_start), Infinity);
const module_scope_hit = [];
for (const h of hunks) {
  if (h.start < firstFnStart) {
    // hunk 落在文件头部，视为 module-level 变更
    module_scope_hit.push({ hunk: h, scope: 'module_header' });
  }
  // class body 顶部 hunk → 整个 class 命中
  for (const n of nodes.filter(n => n.kind === 'class')) {
    if (h.start >= n.line_start && h.start <= n.line_start + 5) {
      module_scope_hit.push({ hunk: h, scope: 'class_signature', node_id: n.id });
    }
  }
}

return makeEnvelope(repoRoot, {
  diff_summary: ...,
  affected_nodes,       // 旧语义：文件级（保底）
  hunk_hit,             // 新：严格 hunk 交集
  module_scope_hit,     // 新：module header / class signature 级
  candidate_tests: ...,
  graph_expansion: ...,
  review_guidance: [...],  // guidance 综合三层给优先级
  ranked_context: ...,
});
```

**修复 3：消费方（`spec-code-review`）选层使用**

- 默认降噪模式：用 `hunk_hit ∪ module_scope_hit` 作为真正受影响节点；
- 兜底严格模式：回退到 `affected_nodes`；
- 架构影响分析：专用 `module_scope_hit`；
- 任何只看 `affected_nodes` 的老消费方保持工作不变（向后兼容）。

#### 影响评估

- **当前**：改 1 行注释 → 全文件节点都 affected，review 噪音极大；
- **修复后**：
  - `hunk_hit` 在"改 1 行"场景下只返回 1 个节点；
  - `module_scope_hit` 在"改 import 列表"场景下准确报告"文件头部变了"；
  - `affected_nodes` 保持不变，老消费方不 break；
  - spec-code-review 默认降噪但不丢严格模式兜底能力。

#### 验证方式

`tests/unit/crg-changes-three-layer.test.js`：
- 构造单行注释改动 → `hunk_hit=[那一行命中的 node]`、`module_scope_hit=[]`、`affected_nodes=[全文件]`；
- 构造文件头 import 变化 → `hunk_hit=[]`、`module_scope_hit=[{scope:'module_header'}]`、`affected_nodes=[全文件]`；
- 构造类签名变化 → `module_scope_hit=[{scope:'class_signature', node_id:...}]`。

---

---

## 7. Phase 2：算法复杂度与性能

### P1. BFS 普遍使用 `Array.shift()`（均摊 O(n²)）

- **级别**：🔴 高
- **Phase**：2
- **位置**：
  - `src/crg/flows.js:59`
  - `src/crg/communities.js:47`
  - `src/crg/commands/impact.js:30`
  - `src/crg/commands/review-context.js:167`

#### 问题描述

四处 BFS 实现都用 `Array.shift()`：

```js
const queue = [[entryId, 0]];
while (queue.length > 0 && flowNodes.length < maxNodes) {
  const [cur, depth] = queue.shift();   // ← O(n) per call
  ...
}
```

JavaScript 数组 `shift()` 是 O(n) 操作（需要搬移所有元素），标准 BFS 应为 O(V+E)，这里退化为 O(V×(V+E))。

#### 根因分析

JavaScript 缺少内置队列。开发者直接用数组+shift 实现，没意识到均摊复杂度退化。

#### 修复方案

统一改为头索引队列，零依赖、零结构改动：

```js
// 修复后（通用 pattern）
const queue = [startId];
let head = 0;
while (head < queue.length) {
  const cur = queue[head++];
  // ...
  queue.push(...);
}
```

如果元素是 tuple：

```js
const queue = [[entryId, 0]];
let head = 0;
while (head < queue.length) {
  const [cur, depth] = queue[head++];
  if (depth >= maxDepth) continue;
  // ...
}
```

#### 影响评估

四处热点程度**并不一样**，不能一概而论：

| 位置 | 规模上限 | 每次访问代价 | 优先级 |
|---|---|---|---|
| `flows.bfsFlow` | `maxNodes=20` 硬截断 | 低 | 🟢 附带修 |
| `communities.bfsComponents` | 社区内全部 module 节点，大仓库可达数千 | 高 | 🔴 **最值得先动** |
| `impact.reverseBfs` | `depth=5` 封顶，但 fan-in 可能爆 | 中-高 | 🟡 次优先 |
| `review-context.reverseBfs` | 每个 affected node 都跑一次，N×O(V²) | 中 | 🟡 次优先 |

**Round 2 修订**：原版本给出"大仓库 BFS 总耗时下降 50-80%"的数字**没有任何 benchmark 支撑**，已删除。准确表述：

- 语义上 `Array.shift()` 从 O(n) 退化为 O(1)，理论每次 BFS 从 O(V²) 回到 O(V+E)；
- 但实际收益取决于热点实例的 V 规模与调用频次，需 benchmark 回填；
- **实施顺序**：先补 `benchmarks/crg/bfs-hotspots.js` 建立 baseline，再按上表优先级逐个改，每改完一处回填实测差值。不接受"顺手一起改"式的打包提交。

#### 验证方式

- 基准测试：`benchmarks/crg/bfs-hotspots.js` 分别测 `communities.bfsComponents` / `impact.reverseBfs` / `review-context.reverseBfs` / `flows.bfsFlow` before/after；
- 代码层：添加 lint rule 或 grep 校验禁止 `queue.shift()` 模式；
- 每处实际差值回填本 Finding 的影响评估表。

---

### P2. `writeCommunities` 子社区内外边统计是 O(E × C)

- **级别**：🔴 高
- **Phase**：2
- **位置**：`src/crg/communities.js:253-270`

#### 问题描述

```js
for (let idx = 0; idx < components.length; idx++) {
  const component = components[idx];
  ...
  let subIntraEdges = 0;
  for (const { src, tgt } of moduleEdges) {
    if (component.has(src) && component.has(tgt)) subIntraEdges++;
  }
  let subInterEdges = 0;
  for (const { src, tgt } of moduleEdges) {
    const srcInSub = component.has(src);
    const tgtInSub = component.has(tgt);
    if (srcInSub !== tgtInSub) subInterEdges++;
  }
  ...
}
```

对每个连通分量都完整遍历 `moduleEdges` 两次。复杂度 **O(E × C)**，C 是子社区数。仓库 10K 边 + 20 个子社区 = 40 万次迭代。

#### 根因分析

没利用"每条边只属于某两个社区"这一性质。

#### 修复方案

单次遍历 `moduleEdges`，按 (srcSub, tgtSub) 分类累加：

```js
// 修复后
// 预先构造 moduleId → componentIdx 映射（-1 表示不在任何子社区）
const moduleToSubIdx = new Map();
for (let idx = 0; idx < components.length; idx++) {
  for (const modId of components[idx]) {
    moduleToSubIdx.set(modId, idx);
  }
}

// 初始化每个子社区的统计
const subStats = components.map(() => ({ intra: 0, inter: 0 }));

// 单次遍历 moduleEdges，O(E)
for (const { src, tgt } of moduleEdges) {
  const si = moduleToSubIdx.get(src);
  const ti = moduleToSubIdx.get(tgt);
  if (si === undefined || ti === undefined) continue;
  if (si === ti) {
    subStats[si].intra++;
  } else {
    subStats[si].inter++;
    subStats[ti].inter++;
  }
}

// 使用 subStats[i] 填充每个子社区的 finalCommunities 条目
```

#### 影响评估

- 复杂度从 O(E × C) 降到 O(E)；
- 对 carve-up 频繁的仓库（大量超大社区）尤其受益。

#### 验证方式

`tests/unit/crg-communities-subgraph-stats.test.js`：构造已知拓扑，断言子社区 intra/inter 计数正确 + 耗时低于阈值。

---

### P3. 社区 community_id 传播使用关联子查询（N+1）

- **级别**：🔴 高
- **Phase**：2
- **位置**：`src/crg/communities.js:346-354`

#### 问题描述

```sql
UPDATE nodes
SET community_id = (
  SELECT m.community_id FROM nodes m
  WHERE m.file_path = nodes.file_path AND m.kind = 'module'
  LIMIT 1
)
WHERE kind != 'module'
```

SQLite 对每行非 module 节点执行子查询一次。虽然 `idx_nodes_file_path_kind` 覆盖了查询，但仍是 per-row lookup。

#### 根因分析

依赖 SQL 引擎优化关联子查询，但 SQLite 对这类 pattern 的执行计划不如 JOIN UPDATE。

#### 修复方案

**版本注记（M3）**：不推荐 `UPDATE ... FROM` 语法（需 SQLite 3.33+）。`better-sqlite3` 绑定的 SQLite 版本随包版本浮动，生产部署里的用户环境不可控。默认走**方案 B（JS 驱动批量 UPDATE）**，方案 A 仅作"若未来强制升级 SQLite 最低版本可启用"的注记。

**方案 B（推荐默认，JS 驱动）**：JS 侧构建 filePath → community_id 映射，批量 UPDATE：

```js
const filePathToCommunity = new Map();
for (const community of finalCommunities) {
  for (const node of community.nodes) {  // module 节点
    filePathToCommunity.set(node.file_path, community.id);
  }
}

const updateByFile = db.prepare(
  "UPDATE nodes SET community_id = ? WHERE file_path = ? AND kind != 'module'"
);
const runUpdateAll = db.transaction(() => {
  for (const [fp, cid] of filePathToCommunity) {
    updateByFile.run(cid, fp);
  }
});
runUpdateAll();
```

**方案 A（备选，需要版本门槛）**：改用 `UPDATE ... FROM` 语法（SQLite 3.33+ 支持）：

```sql
UPDATE nodes
SET community_id = m.community_id
FROM nodes m
WHERE m.file_path = nodes.file_path
  AND m.kind = 'module'
  AND nodes.kind != 'module'
```

仅当 CI 和用户端都验证 SQLite >= 3.33 时启用。

#### 影响评估

- 大仓库 `writeCommunities` 后处理时间下降；
- 对已有 idx_nodes_file_path_kind 的项目改进较小，但对无索引的场景差距显著。

#### 验证方式

基准测试：1 万节点规模下 `writeCommunities` 耗时对比。

---

### P4. `detectFlows` 入口识别 `NOT IN (subquery)` O(N×E)

- **级别**：🟡 中
- **Phase**：2
- **位置**：`src/crg/flows.js:163-169`

#### 问题描述

```sql
SELECT id, name FROM nodes
WHERE kind != 'module'
  AND id NOT IN (
    SELECT target_id FROM edges WHERE kind = 'calls'
  )
```

SQLite 对 `NOT IN (correlated subquery)` 执行效率较差。虽然这里是不相关子查询，优化器通常能处理，但在边数多时仍可能退化。

#### 根因分析

已经在 `loadAdjacency` 加载了 calls 邻接表，再次用 SQL 找入口是重复劳动。

#### 修复方案

利用内存中已有的 `adjacency`，在 JS 侧过滤：

```js
function detectFlows(db) {
  const { adjacency } = loadAdjacency(db);

  // 计算所有 calls 边的 target 集合
  const hasIncomingCall = new Set();
  for (const [, targets] of adjacency) {
    for (const t of targets) hasIncomingCall.add(t);
  }

  // 入口 = kind != 'module' 且不在 hasIncomingCall 中
  const candidateNodes = db.prepare(
    "SELECT id, name FROM nodes WHERE kind != 'module'"
  ).all();
  const entryNodes = candidateNodes.filter(n => !hasIncomingCall.has(n.id));
  ...
}
```

#### 影响评估

- 避免 SQLite 层 NOT IN 潜在退化；
- 对大仓库 detectFlows 启动阶段提速。

#### 验证方式

基准测试：10K 节点 / 50K 边规模下 detectFlows 启动时间。

---

### P5. FTS5 每次 postprocess 全量重建

- **级别**：🟡 中
- **Phase**：2
- **位置**：`src/crg/search.js:85-126`

#### 问题描述

```js
function rebuildFTS(db) {
  db.exec('DROP TABLE IF EXISTS fts_nodes');
  db.exec(`CREATE VIRTUAL TABLE fts_nodes USING fts5(...)`);
  const nodes = db.prepare('SELECT id, name, retrieval_text, file_path, kind FROM nodes').all();
  // 全量 INSERT
  ...
}
```

无论增量 build 只改了 1 个文件，FTS 索引每次都完全重建。对 10 万节点仓库秒级耗时，限制了增量 build 的真正速度。

#### 根因分析

"drop-recreate 最简单且一定正确"的实用主义，但对增量构建的价值主张冲突。

#### 修复方案

新增增量接口：

```js
function incrementalRebuildFTS(db, changedNodeIds) {
  if (!changedNodeIds || changedNodeIds.length === 0) return { indexed_count: 0 };

  const del = db.prepare('DELETE FROM fts_nodes WHERE node_id = ?');
  const ins = db.prepare(
    'INSERT INTO fts_nodes (node_id, name, retrieval_text, file_path, kind) VALUES (?, ?, ?, ?, ?)'
  );
  const fetch = db.prepare('SELECT id, name, retrieval_text, file_path, kind FROM nodes WHERE id = ?');
  const { isSensitiveFile } = require('./input-convergence');

  let count = 0;
  const tx = db.transaction(() => {
    for (const id of changedNodeIds) {
      del.run(id);
      const node = fetch.get(id);
      if (!node) continue;
      if (isSensitiveFile(path.basename(node.file_path))) continue;
      ins.run(node.id, node.name, node.retrieval_text, node.file_path, node.kind);
      count++;
    }
  });
  tx();
  return { indexed_count: count };
}
```

在 `build.js` 和 `postprocess.js` 里，区分全量 / 增量两条路径：

```js
// build.js
const changedNodeIds = allNodes.map(n => n.id).concat(deletedNodeIds);
// ... 在 tryPostprocess 里传入 changedNodeIds
```

如果变更节点数超过总节点数的 20%，回退到全量重建：

```js
if (changedNodeIds.length > totalNodeCount * 0.2) {
  rebuildFTS(db);   // 全量
} else {
  incrementalRebuildFTS(db, changedNodeIds);
}
```

#### 影响评估

- 增量 build 真正做到"只为变更付出代价"；
- 大仓库 build 延迟下降显著。

#### 验证方式

- `tests/unit/crg-fts-incremental.test.js`：修改 1 个节点，断言其他节点的 FTS 记录未被触碰（`SELECT rowid FROM fts_nodes ORDER BY rowid` 前后稳定）；
- 基准测试：对比增量 vs 全量的 postprocess 耗时。

---

### P6. `searchNodesByLike` 全表扫 × term 数

- **级别**：🟡 中
- **Phase**：2
- **位置**：`src/crg/retrieval/seed.js:27-34`

#### 问题描述

```js
function searchNodesByLike(db, term, limit) {
  const safe = `%${term}%`;
  return db.prepare(`
    SELECT id AS node_id, name, file_path, kind, retrieval_text, 0.7 AS score
    FROM nodes
    WHERE lower(name) LIKE lower(?)
       OR lower(retrieval_text) LIKE lower(?)
    LIMIT ?
  `).all(safe, safe, limit);
}
```

`LIKE '%x%'` 无法走索引，每个 term 都触发全表扫 nodes。当 FTS5 MATCH 命中为空（极常见，因为 FTS 对复合标识符切词不友好），会连续触发多次全表扫。

#### 根因分析

作为 FTS fallback，LIKE 是最后的保底手段，但效率差。

#### 修复方案

**方案 A（推荐）**：FTS5 使用 `tokenize='trigram'`（SQLite 3.34+），让 `MATCH` 能模拟子串匹配：

```sql
CREATE VIRTUAL TABLE fts_nodes USING fts5(
  node_id UNINDEXED,
  name,
  retrieval_text,
  file_path UNINDEXED,
  kind UNINDEXED,
  tokenize='trigram'   -- ← 新增
)
```

这样 `MATCH '"foo"'` 会匹配含 `foo` 子串的任何节点，LIKE fallback 可以完全移除。

**方案 B**：生成 identifier subword 冷数据列：

```sql
ALTER TABLE nodes ADD COLUMN name_subwords TEXT;   -- 如 "get user by id"
CREATE INDEX idx_nodes_name_subwords ON nodes(name_subwords COLLATE NOCASE);
```

在 parser 里填充 subwords，然后 LIKE 可以走索引。

#### 影响评估

- 方案 A 一次性解决 FTS + LIKE 两个问题；
- 方案 B 侵入性较大，但对非 trigram SQLite 也可用。

#### 验证方式

- 基准测试：多 term 查询耗时；
- `tests/unit/crg-fts-trigram.test.js`：验证 trigram 模式下子串匹配工作。

---

### P7. `assessFileRisk` fanIn N+1 查询

- **级别**：🔴 高
- **Phase**：2
- **位置**：`src/crg/changes.js:56`

#### 问题描述

```js
function assessFileRisk(filePath, db) {
  const moduleNode = db.prepare(
    "SELECT id FROM nodes WHERE file_path = ? AND kind = 'module' LIMIT 1"
  ).get(filePath);
  if (!moduleNode) return 'Low';
  const fanIn = db.prepare(
    'SELECT COUNT(*) as cnt FROM edges WHERE target_id = ?'
  ).get(moduleNode.id)?.cnt || 0;
  ...
}
```

`detectChanges` 对每个变更文件调用 `assessFileRisk` 一次，导致 N 个变更文件 = 2N 次 SQL 查询。

#### 根因分析

单文件视角的函数，被放在批量上下文里用。

#### 修复方案

新增批量版本：

```js
// changes.js 新增
function assessFileRiskBatch(filePaths, db) {
  if (filePaths.length === 0) return new Map();

  const CHUNK_SIZE = 900;
  const modules = new Map();  // filePath → moduleId

  for (let i = 0; i < filePaths.length; i += CHUNK_SIZE) {
    const chunk = filePaths.slice(i, i + CHUNK_SIZE);
    const ph = chunk.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT id, file_path FROM nodes WHERE kind = 'module' AND file_path IN (${ph})`
    ).all(...chunk);
    for (const r of rows) modules.set(r.file_path, r.id);
  }

  const moduleIds = [...modules.values()];
  const fanInMap = new Map();
  for (let i = 0; i < moduleIds.length; i += CHUNK_SIZE) {
    const chunk = moduleIds.slice(i, i + CHUNK_SIZE);
    const ph = chunk.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT target_id, COUNT(*) AS cnt FROM edges WHERE target_id IN (${ph}) GROUP BY target_id`
    ).all(...chunk);
    for (const r of rows) fanInMap.set(r.target_id, r.cnt);
  }

  const result = new Map();
  for (const fp of filePaths) {
    const modId = modules.get(fp);
    if (!modId) { result.set(fp, 'Low'); continue; }
    const fanIn = fanInMap.get(modId) || 0;
    result.set(fp, fanIn >= 10 ? 'High' : fanIn >= 3 ? 'Medium' : 'Low');
  }
  return result;
}
```

`detectChanges` 调用一次：

```js
function detectChanges(repoRoot, since, db) {
  const { files, error } = getChangedFilesFromGit(repoRoot, since);
  ...
  const riskMap = db ? assessFileRiskBatch(files, db) : new Map();
  return files.map(file => {
    const risk_level = db ? (riskMap.get(file) || 'Low') : 'Unknown';
    ...
  });
}
```

#### 影响评估

- N 个变更文件从 2N 次查询降到 2 次；
- review-context 延迟下降显著。

#### 验证方式

`tests/unit/crg-assess-file-risk-batch.test.js`：构造多文件变更，断言 SQL 调用次数 O(1) 级。

---

### P8. `review-context` 加载全图 calls 边到内存

- **级别**：🟡 中
- **Phase**：2
- **位置**：`src/crg/commands/review-context.js:152-159`

#### 问题描述

```js
const edgeRows = db.prepare(
  "SELECT source_id, target_id FROM edges WHERE kind = 'calls'"
).all();
const reverseAdj = new Map();
for (const row of edgeRows) {
  if (!reverseAdj.has(row.target_id)) reverseAdj.set(row.target_id, []);
  reverseAdj.get(row.target_id).push(row.source_id);
}
```

无 filter，对 100K 边仓库占用 ~10MB 内存 + 同步加载延迟。而反向 BFS 深度只有 2，大部分边根本用不到。

#### 根因分析

全图加载是简单做法，但与 "只需要 2-hop 邻域" 的实际需求不匹配。

#### 修复方案

分两批按需加载：

```js
// 修复后
async function buildReverseAdjacencyForNodes(db, seedIds, maxDepth) {
  const CHUNK_SIZE = 900;
  const reverseAdj = new Map();
  const visited = new Set(seedIds);
  let frontier = [...seedIds];

  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
    // 加载 frontier 节点的直接反向邻接
    const newCallers = new Set();
    for (let i = 0; i < frontier.length; i += CHUNK_SIZE) {
      const chunk = frontier.slice(i, i + CHUNK_SIZE);
      const ph = chunk.map(() => '?').join(',');
      const rows = db.prepare(
        `SELECT source_id, target_id FROM edges WHERE kind = 'calls' AND target_id IN (${ph})`
      ).all(...chunk);
      for (const r of rows) {
        if (!reverseAdj.has(r.target_id)) reverseAdj.set(r.target_id, []);
        reverseAdj.get(r.target_id).push(r.source_id);
        if (!visited.has(r.source_id)) newCallers.add(r.source_id);
      }
    }
    for (const id of newCallers) visited.add(id);
    frontier = [...newCallers];
  }
  return reverseAdj;
}

// 使用：
const affectedNodeIds = new Set(affectedNodes.map(n => n.id));
const reverseAdj = await buildReverseAdjacencyForNodes(db, [...affectedNodeIds], 2);
```

依赖 S1（`(target_id, kind)` 复合索引）以获得最佳性能。

#### 影响评估

- 内存占用从全图降到 O(blast radius)；
- 对大仓库 review-context 延迟显著下降。

#### 验证方式

基准测试：10K 边仓库 `review-context --since=HEAD~1` 内存占用 & 耗时。

---

---

## 8. Phase 3：SQL / Schema / 数据结构

### S1. `edges(target_id, kind)` 缺复合索引

- **级别**：🔴 高
- **Phase**：3
- **位置**：`src/crg/migrations.js:147-150`

#### 问题描述

当前索引：

```sql
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
CREATE INDEX IF NOT EXISTS idx_edges_kind ON edges(kind);
```

高频查询模式 `WHERE target_id = ? AND kind = 'calls'`（见 `impact.js:85`、`changes.js:113`、`review-context.js:153` 等），SQLite 只能选一个索引，要么按 target_id 扫出一批再过滤 kind，要么按 kind 扫一大堆再过滤 target_id。

#### 根因分析

索引设计未考虑实际查询模式的 AND 组合。

#### 修复方案

新增复合索引：

```sql
-- 针对 WHERE target_id = ? AND kind = ? 的反向查询
CREATE INDEX IF NOT EXISTS idx_edges_target_kind ON edges(target_id, kind);

-- 针对 WHERE source_id = ? AND kind = ? 的正向查询
CREATE INDEX IF NOT EXISTS idx_edges_source_kind ON edges(source_id, kind);
```

加上新索引后，可以考虑删除独立的 `idx_edges_source`、`idx_edges_target`（复合索引的最左前缀覆盖），但建议第一轮先保留以降低风险。

migration 策略：`migrations.js` 用 `CREATE INDEX IF NOT EXISTS`，老 db 首次升级时自动补索引，无破坏性。

#### 影响评估

- `impact`、`callers_of`、`review-context` 反向 BFS 速度提升；
- 索引写入开销略增（每条 edge 多维护两个索引），但 edges 表写入频次低于读取，整体正收益。

#### 验证方式

- `tests/smoke/install-tarball.sh` 之后 `crg build` + `crg impact` 正常；
- `EXPLAIN QUERY PLAN SELECT ... WHERE target_id = ? AND kind = ?` 显示使用 `idx_edges_target_kind`。

---

### S2. `unresolved_edges` 无唯一约束

- **级别**：🟡 中
- **Phase**：3
- **位置**：`src/crg/migrations.js:104-112`

#### 问题描述

```sql
CREATE TABLE IF NOT EXISTS unresolved_edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL,
  source_file TEXT NOT NULL,
  edge_kind TEXT NOT NULL,
  target_name TEXT,
  target_path_raw TEXT
)
```

`replaceUnresolvedEdges`（`graph.js:416-438`）每次 DELETE FROM + INSERT，表面幂等。但如果同一 raw edge 在 rawEdges 数组里重复出现，当前会插入两条相同记录。

#### 根因分析

没有对"同一业务键"施加唯一性。AUTOINCREMENT id 是内部标识，不代表业务幂等。

#### 修复方案

新增唯一约束 + INSERT OR IGNORE：

```sql
-- migrations.js
CREATE TABLE IF NOT EXISTS unresolved_edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL,
  source_file TEXT NOT NULL,
  edge_kind TEXT NOT NULL,
  target_name TEXT,
  target_path_raw TEXT,
  UNIQUE (source_id, edge_kind, target_name, target_path_raw)
);
```

migration：对老 db 需要重建表（SQLite 不支持 ADD CONSTRAINT）。步骤：

```js
const unresolvedMeta = db.prepare(
  "SELECT sql FROM sqlite_master WHERE type='table' AND name='unresolved_edges'"
).get();
if (unresolvedMeta && !unresolvedMeta.sql.includes('UNIQUE')) {
  db.exec(`
    CREATE TABLE unresolved_edges_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id TEXT NOT NULL,
      source_file TEXT NOT NULL,
      edge_kind TEXT NOT NULL,
      target_name TEXT,
      target_path_raw TEXT,
      UNIQUE (source_id, edge_kind, target_name, target_path_raw)
    );
    INSERT OR IGNORE INTO unresolved_edges_new (source_id, source_file, edge_kind, target_name, target_path_raw)
      SELECT source_id, source_file, edge_kind, target_name, target_path_raw FROM unresolved_edges;
    DROP TABLE unresolved_edges;
    ALTER TABLE unresolved_edges_new RENAME TO unresolved_edges;
  `);
}
```

`replaceUnresolvedEdges` 改用 `INSERT OR IGNORE`：

```js
const insert = db.prepare(`
  INSERT OR IGNORE INTO unresolved_edges (
    source_id, source_file, edge_kind, target_name, target_path_raw
  ) VALUES (?, ?, ?, ?, ?)
`);
```

#### 影响评估

- 防止重复 unresolved 条目污染计数；
- 对消费层（unresolved 统计、top_kinds / top_files）口径更准。

#### 验证方式

- `tests/unit/crg-unresolved-uniqueness.test.js`：重复插入相同 unresolved，断言表里只有一行；
- migration 测试：老 db 升级后重复数据被去重。

---

### S3. `expand.js` 无分块，接近 999 参数上限

- **级别**：🟡 中
- **Phase**：3
- **位置**：`src/crg/retrieval/expand.js:14-24`

#### 问题描述

```js
function loadNeighborNodes(db, nodeIds) {
  if (!Array.isArray(nodeIds) || nodeIds.length === 0) return [];
  const placeholders = nodeIds.map(() => '?').join(',');
  return db.prepare(`
    SELECT DISTINCT n.id AS node_id, n.name, n.file_path, n.kind, n.retrieval_text
    FROM edges e
    JOIN nodes n ON (n.id = e.target_id OR n.id = e.source_id)
    WHERE (e.source_id IN (${placeholders}) OR e.target_id IN (${placeholders}))
      AND n.id NOT IN (${placeholders})
  `).all(...nodeIds, ...nodeIds, ...nodeIds);
}
```

三次复用 `placeholders` 导致有效变量数是 nodeIds × 3，接近 SQLITE_MAX_VARIABLE_NUMBER=999 时会爆（333 个种子就触顶）。当前 `seed_limit=12` 不触发，但限制了未来扩大 seed。

#### 根因分析

一次 SQL 搞定的设计思路，没考虑参数上限。

#### 修复方案

**方案 A**：分块（CHUNK_SIZE=300）：

```js
function loadNeighborNodes(db, nodeIds) {
  if (!nodeIds || nodeIds.length === 0) return [];
  const CHUNK = 300;
  const seen = new Set();
  const results = [];

  for (let i = 0; i < nodeIds.length; i += CHUNK) {
    const chunk = nodeIds.slice(i, i + CHUNK);
    const ph = chunk.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT DISTINCT n.id AS node_id, n.name, n.file_path, n.kind, n.retrieval_text
      FROM edges e
      JOIN nodes n ON (n.id = e.target_id OR n.id = e.source_id)
      WHERE e.source_id IN (${ph}) OR e.target_id IN (${ph})
    `).all(...chunk, ...chunk);
    for (const r of rows) {
      if (!seen.has(r.node_id)) {
        seen.add(r.node_id);
        results.push(r);
      }
    }
  }

  // JS 侧过滤 NOT IN (seedIds)
  const seedSet = new Set(nodeIds);
  return results.filter(r => !seedSet.has(r.node_id)).map(row => ({
    ...row, type: 'node', score: 0.8, reasons: ['graph_expand'],
  }));
}
```

**方案 B**：拆成两条查询（source 方向和 target 方向），JS 侧合并 + 去重 + 过滤。

#### 影响评估

- 支持任意大种子集；
- 方案 A 性能与原实现接近（多几次 SQL 但避免 DISTINCT 全表）。

#### 验证方式

`tests/unit/crg-expand-large-seed.test.js`：传入 500 个种子，断言不报 SQLITE_MAX_VARIABLE_NUMBER 错误。

---

### S4. FTS5 关键字转义仅去双引号

- **级别**：🟡 中
- **Phase**：3
- **位置**：`src/crg/search.js:31`

#### 问题描述

```js
const safeKeyword = '"' + keyword.replace(/"/g, '') + '"';
```

只去除双引号，没处理 FTS5 操作符：`*`（前缀通配）、`NEAR`、`AND`/`OR`/`NOT`、`:`（列过滤）、`(`/`)`（分组）、`^`（列前缀）。

Spec-First 是 CLI 工具，用户查询字符串传给 FTS，存在**FTS operator injection**风险（非 SQL injection，但能让用户构造非预期查询）。

#### 根因分析

FTS5 语法比想象中丰富，简单去双引号不够。

#### 修复方案

移除所有 FTS5 operator 字符：

```js
function sanitizeFTS5Keyword(keyword) {
  // FTS5 特殊字符：" * : ( ) ^ -
  // 以及操作符关键字：AND OR NOT NEAR
  const cleaned = String(keyword)
    .replace(/["*:()\^\-]/g, ' ')
    .replace(/\b(AND|OR|NOT|NEAR)\b/gi, ' ')
    .trim();
  if (!cleaned) return null;
  // 单词分隔后用空格拼接（FTS5 默认 AND），再用引号包裹单个 token
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  // 用 phrase query 包裹每个 token：FTS5 把 "foo" 当短语查询，不解析操作符
  return tokens.map(t => `"${t}"`).join(' ');
}

function searchNodes(db, keyword, { kind, limit = 20 } = {}) {
  const safeKeyword = sanitizeFTS5Keyword(keyword);
  if (!safeKeyword) return [];
  ...
}
```

#### 影响评估

- 提升查询安全性（用户传入 `auth*` 不再意外触发前缀匹配，除非显式支持）；
- 多 token query 由 FTS 内部 AND 组合，召回语义更清晰。

#### 验证方式

`tests/unit/crg-fts-sanitize.test.js`：
- 传入 `'*'`、`'NEAR(foo, 5)'`、`'"auth" OR "login"'`，断言不抛异常、结果语义符合"按字面 token AND 组合"。

---

### S5. `nodes.id` 非稳定（含 lineStart）

- **级别**：🟢 低
- **Phase**：3（或 Phase 4）
- **位置**：`src/crg/parser.js:108`

#### 问题描述

```js
function buildSymbolKey(filePath, kind, name, lineStart) {
  return `${filePath}#${kind}#${name}#L${lineStart}`;
}
```

函数改名、挪位置、甚至在文件顶部加一行空行，`line_start` 都会变，node.id 随之改变：
- `deleteStaleNodes` 先把旧 id 删掉（级联清 edges）；
- 新 id 进入 nodes；
- 原本指向旧 id 的 edges 已被级联删除；
- 新 edges 需要重新 resolve（可能 resolved 成别人，见 C2 关联问题）。

这是 CRG 增量构建的**隐性破坏性**行为：小改动触发大量事实重排。

#### 根因分析

id 设计想解决"同名符号消歧"，用 `lineStart` 做区分，但代价是 id 不跨 build 稳定。

现代代码图（如 Sourcegraph 的 SCIP、LSIF）用 canonical symbol path（如 `src.crg.graph::resolveEdges`）作为 id，不用行号。

#### 修复方案

**Phase 3 最小修复：文档化 + FactItem 增字段**

不改 id，但在导出层（`nodeToFactItem`）增加稳定标识：

```js
function nodeToFactItem(node, inferenceReason) {
  return {
    id: node.id,
    symbol_path: `${node.file_path}::${node.kind}::${node.name}`,  // ← 新增跨 build 稳定
    name: node.name,
    file_path: node.file_path,
    kind: node.kind,
    ...
  };
}
```

**Phase 4 根治**：引入 scope-aware symbol path：

```
src/crg/graph.js::module::graph.js          → module 节点
src/crg/graph.js::function::resolveEdges    → 函数
src/crg/graph.js::class::MyClass::method::foo  → 嵌套方法
```

这需要 parser 层支持 scope 链跟踪（tree-sitter 原生 AST 可提取）。

#### 影响评估

- Phase 3 修复：AI agent 消费时有稳定 symbol_path 可引用，跨 build 可追溯；
- Phase 4 修复：彻底解除"改一行触发大量重 resolve"的增量 build 隐性成本。

#### 验证方式

- `tests/unit/crg-symbol-path-stability.test.js`：同一个函数在文件中前后挪动，symbol_path 不变；
- CHANGELOG + docs：明确声明 id 的生命周期约束。

---

### S6. `unresolved_edges` 缺 `root_cause_hint` 列，量化基线不可审计

- **级别**：🟡 中
- **Phase**：3
- **位置**：`src/crg/migrations.js:104-112` + `src/crg/graph.js:285-347`（resolveEdges 失败路径）+ 新增分类器

> **由来（Round 2 元审查）**：2.4 unresolved 量化表使用了 `node_builtin` / `bare_name` / `relative_path` / `slash_nonrelative` 等根因分类来给 Phase 1 修复预期下降量，但当前 schema 不存 root_cause，这些数字需要人工推断，无法作为 CI 回归基线。S6 为该表打上可审计基础。
>
> **Round 3 元审查纠正**：原 S6 设计把 `symbol_ambiguous` / `suffix_not_covered` 等**只能由 resolveEdges 内部状态给出**的语义标签，写成了"分类器从持久化字段后验推断"。这是错的：
>
> - `parser.js:375-384` JS `call_expression` 抽取时 `target_path_raw: null`，绝大多数 calls 边只有 `target_name`；
> - `graph.js:338-346` resolveEdges 失败落库时**不携带 failure reason**，只复制 raw 字段；
> - 所以离线分类器永远无法可靠区分"真歧义"vs"全局查不到"vs"动态调用"vs"suffix 没覆盖"。
>
> 修订后的 S6 拆为两步，先做"保守的 `path_shape` 形态分类"，再做"resolveEdges 显式 failure reason"。

#### 问题描述

当前 `unresolved_edges` schema（`migrations.js:104-112`）：

```sql
CREATE TABLE IF NOT EXISTS unresolved_edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL,
  source_file TEXT NOT NULL,
  edge_kind TEXT NOT NULL,
  target_name TEXT,
  target_path_raw TEXT
)
```

只存原始输入，**不存形态分类**也**不存 resolveEdges 失败原因**。想回答"有多少是相对路径形态 / 有多少是 bare name 形态"必须 JS 侧后验扫；想回答"有多少是真歧义 / 有多少是查无此符号"则**根本无法**只看持久化数据回答。

后果：
- 2.4 量化目标表无法由 CI 自动复算（即使加了 path_shape 也只是形态级，不是语义级）；
- 消费方（`review-context`）想做 "只关心动态调用未建模的 unresolved" 这种过滤时没有结构化字段可用；
- Phase 1 验收必须人工抽样。

#### 根因分析

两个独立缺陷叠加：
1. **schema 设计**：只考虑"记录 raw unresolved"，没考虑消费侧分类需求；
2. **resolveEdges 行为**：失败时**丢弃了所有路径决策信息**（哪个阶段失败、是不是命中过 cache、symbol 是不是 AMBIGUOUS）。

#### 修复方案（Round 3 修订：拆两步推进）

**S6.1（Phase 3 落地，可立即做）**：仅做形态级 `path_shape` 分类，**不写语义标签**。

Schema：

```sql
ALTER TABLE unresolved_edges ADD COLUMN path_shape TEXT;
-- 可选值（纯字符串形态，不是语义）:
--   'name_only'         : 只有 target_name，没有 target_path_raw（绝大多数 calls 边）
--   'relative_path'     : target_path_raw 以 '.' 开头
--   'slash_path'        : target_path_raw 以 '/' 开头
--   'bare_name'         : target_path_raw 非空，不含 '/'，不以 '.' 开头
--   'pkg_path'          : target_path_raw 含 '/'，不以 '.' / '/' 开头（如 'foo/bar'）
--   'unknown'           : 其他
CREATE INDEX idx_unresolved_path_shape ON unresolved_edges(path_shape);
```

分类器（**纯字符串形态判定，不下语义结论**）：

```js
function classifyPathShape(raw) {
  const p = raw.target_path_raw || '';
  const n = raw.target_name || '';
  if (!p && n) return 'name_only';
  if (!p && !n) return 'unknown';
  if (p.startsWith('.')) return 'relative_path';
  if (p.startsWith('/')) return 'slash_path';
  if (!p.includes('/')) return 'bare_name';
  return 'pkg_path';
}
```

**关键**：S6.1 **不引入** `node_builtin` / `python_stdlib` / `symbol_ambiguous` / `suffix_not_covered` 这些**语义标签**——它们需要 S6.2 提供的额外信息才能判定。

**S6.2（前置依赖，需先改 resolveEdges）**：让 resolveEdges 显式输出 failure reason。

修改 `graph.js` 失败落库结构：

```js
// graph.js:338 修复后
if (!targetId) {
  unresolvedCount++;
  unresolved.push({
    source_id: raw.source_id,
    source_file: raw.source_id ? raw.source_id.split('#', 1)[0] : '',
    edge_kind: raw.kind,
    target_name: raw.target_name || null,
    target_path_raw: raw.target_path_raw || null,
    failure_reason: lastFailureReason,   // ← 新增：resolveEdges 内部记录
  });
  continue;
}
```

`lastFailureReason` 在 resolveEdges 内部按各阶段尝试结果推进：

| 走过的最后一个阶段 | failure_reason |
|---|---|
| 阶段 0（已带 target_id）但 hasNode 返回 false | `target_id_not_in_graph` |
| 阶段 1 module 未命中 | `module_path_not_found` |
| 阶段 1 相对路径所有 suffix 都 miss | `relative_suffix_not_covered` |
| 阶段 1.5 basename 多候选无匹配 | `basename_no_proximity` |
| 阶段 2 全局查不到 | `symbol_global_lookup_failed` |
| 阶段 2 全局 AMBIGUOUS 且同文件无单 hit | `symbol_ambiguous_no_disambiguation` |
| 没进入任何尝试（target_name+target_path_raw 都空） | `empty_target` |

Schema 增列：

```sql
ALTER TABLE unresolved_edges ADD COLUMN failure_reason TEXT;
CREATE INDEX idx_unresolved_failure_reason ON unresolved_edges(failure_reason);
```

**只有 S6.2 落地后**，2.4 量化表才能引用 `failure_reason='relative_suffix_not_covered'` 这种语义级断言，做 CI 回归。

#### 影响评估

**S6.1 单独落地**：
- 提供形态级分布报告（`name_only` 多少 / `bare_name` 多少 / `relative_path` 多少）；
- 2.4 量化表可以用 path_shape 字段做"形态分布对账"，但**不能**用它断言"修了 C3a 就少 N 条 suffix_not_covered"——因为同一个 `relative_path` 形态可能因为多种原因失败；
- 单次 build 多 ~2800 行分类（纯 CPU，可忽略）。

**S6.2 落地后**：
- 真正可 CI 回归（修 C3a 后 `failure_reason='relative_suffix_not_covered'` 的条数应为 0）；
- 为"外部模块建模"工程提供精准入口。

#### 验证方式

S6.1：
- `tests/unit/crg-unresolved-path-shape.test.js`：构造各形态 raw edge，断言分类正确；
- 不验证语义标签（不存在）。

S6.2：
- `tests/unit/crg-resolve-failure-reason.test.js`：构造各阶段失败场景，断言 failure_reason 正确；
- `crg-quality-gate.yml`：对比 `failure_reason` 分布的绝对值 + 变化趋势；
- 回归：改 C3a 应只让 `relative_suffix_not_covered` bucket 下降，不应影响 `symbol_global_lookup_failed`（语义隔离验证）。

#### 与 2.4 量化表的对齐

- 在 S6.1 落地前，2.4 表头"审计性声明"必须保留，明确"数字是人工抽样推断"；
- S6.1 落地后，2.4 可以引用 `path_shape` 做形态级对账；
- S6.2 落地后，2.4 才能升级为 CI 可强制断言的真审计基线。

---

---

## 9. Phase 4：设计层架构改造

### D1. `retrieval_text` 信号密度接近零

- **级别**：🔴 高
- **Phase**：4
- **位置**：`src/crg/parser.js:139`

#### 问题描述

```js
return {
  ...
  retrieval_text: `${filePath} ${kind} ${name}`,
  ...
};
```

`retrieval_text` 是 FTS5 / LIKE / semantic-rerank 的核心检索字段，但当前只是"文件路径 + 类型 + 名称"的拼接。**不含代码体、不含 docstring、不含首行注释、不含参数名**。

后果：
- FTS 对 identifier 以外的语义完全无感；
- 查询 "auth 登录逻辑" 很难命中真正的 auth 实现，除非文件路径或函数名恰好含这些词；
- 即便上真 embedding（见 D2），没有真实代码 embed 信号密度也低。

#### 根因分析

初期设计以"符号索引"为目标，retrieval 只是副产品。随着 retrieval 变成 CRG 的核心 AI agent 接口，这个字段的语义应当升级。

#### 修复方案

在 `buildNode` 时注入真实代码摘要：

```js
// parser.js 修改后
function buildNode(filePath, kind, name, lineStart, lineEnd, isTestFile, tsNode) {
  // tsNode.text 是 tree-sitter 抽出的原始代码
  const codePreview = extractCodePreview(tsNode);
  const docstring = extractDocstring(tsNode);

  return {
    id: buildSymbolKey(filePath, kind, name, lineStart),
    ...
    summary: docstring || `${kind} ${name} in ${filePath}`,
    retrieval_text: [
      filePath,
      kind,
      name,
      docstring || '',
      codePreview,        // 前 N 行代码，去空白
    ].filter(Boolean).join(' | '),
    ...
  };
}

function extractCodePreview(tsNode, maxLines = 8) {
  if (!tsNode || !tsNode.text) return '';
  return tsNode.text.split('\n').slice(0, maxLines)
    .map(l => l.trim()).filter(Boolean).join(' ⏎ ');
}

function extractDocstring(tsNode) {
  // 语言特定：JS/TS → 上方 /** ... */ 注释
  // Python → def 下第一行 """..."""
  // 实现视语言而定，可先覆盖 JS/TS/Python
}
```

**chunks 表同样处理**（见 D4 合并）：

```js
// chunking.js
chunks.push({
  ...
  retrieval_text: extractLinesFromFile(filePath, start, end),  // 真实代码行
});
```

#### 影响评估

- FTS5 召回率有望显著提升（尤其对含 docstring 的项目）；
- 即便不做 embedding，lexical 检索质量也有望明显提升；
- 为 D2（真 embedding）铺路。

#### 验证方式

- 基准测试：在 spec-first 自身仓库上，query "auth guard" 应该命中 `auth-related` 节点而非随机；
- `tests/unit/crg-retrieval-text-enrichment.test.js`：断言 JS 函数的 retrieval_text 含有 JSDoc 文本。

#### 依赖

- 需要 parser.js 把 tsNode 透传到 buildNode（现有签名是 `buildNode(filePath, kind, name, lineStart, lineEnd, isTestFile)`，要加参数）；
- chunks 表需要支持更大的 retrieval_text，可能触发 SQLite 单行大小关注（默认 1GB，安全）。

---

### D2. dense retrieval / ANN 尚未进入 v1 主链

- **级别**：🟡 中
- **Phase**：4
- **位置**：`src/crg/retrieval/` 全局

#### 问题描述

`src/crg/retrieval/api.js:27-41` 当前 retrieval 主链是：

`buildSeedSet -> expandSeedSet -> rerankContext -> semanticRerank -> packContext`

**代码事实**：
- 没有 embedding 实现；
- 没有 ANN 索引；
- retrieval 主要是 FTS/LIKE（词法）+ 图扩展 + 启发式重排 + 可选 lexical overlap；
- "重排"是线性权重加分。

需要特别修正的是：当前 `docs/项目介绍/CRG-代码图引擎分析.md` 并没有把这条主链写成"BM25 + 向量"；它在图示里已经按 `seed.js → expand.js → rerank.js → semantic-rerank.js → pack.js` 描述实现。因此这里更适合被定义为 **v2 架构增强项**，而不是"当前最明显的 doc/code drift"。

#### 根因分析

v1 当前选择的是 lexical + graph + heuristic 的最小可用闭环，dense retrieval 尚未进入主链。这限制了模糊语义查询的上限，但不等于现有分析文档在虚构能力。

#### 修复方案

分两阶段：

**阶段 4.2.1：Opt-in dense retrieval**

新增 `@xenova/transformers`（纯 JS，本地 all-MiniLM-L6-v2，约 22MB，零外部 API 依赖）：

```js
// retrieval/embeddings.js
const { pipeline } = require('@xenova/transformers');

let _embedder = null;
async function getEmbedder() {
  if (!_embedder) {
    _embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return _embedder;
}

async function embedText(text) {
  const embedder = await getEmbedder();
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);  // 384 维 float32
}
```

Schema 增加 embedding 列：

```sql
ALTER TABLE chunks ADD COLUMN embedding BLOB;   -- Float32Array 序列化
```

Postprocess 阶段批量 embed：

```js
// cli/postprocess.js 扩展
async function embedChunks(db, { batchSize = 32 } = {}) {
  const chunks = db.prepare(
    'SELECT id, retrieval_text FROM chunks WHERE embedding IS NULL'
  ).all();
  const update = db.prepare('UPDATE chunks SET embedding = ? WHERE id = ?');
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const vecs = await Promise.all(batch.map(c => embedText(c.retrieval_text)));
    const tx = db.transaction(() => {
      for (let j = 0; j < batch.length; j++) {
        update.run(Buffer.from(new Float32Array(vecs[j]).buffer), batch[j].id);
      }
    });
    tx();
  }
}
```

检索时：

```js
// retrieval/dense-rerank.js
async function denseRerank(items, { query, topK = 30 } = {}) {
  const queryVec = await embedText(query);
  return items.map(item => {
    if (!item.embedding) return { ...item, _dense: 0 };
    const cos = cosineSimilarity(queryVec, deserializeFloat32(item.embedding));
    return { ...item, score: item.score + cos * 0.8, _dense: cos };
  }).sort((a, b) => b.score - a.score).slice(0, topK);
}
```

**阶段 4.2.2：ANN 索引**

向量数量 > 10K 时线性扫描仍可接受（384 维 × 10K = 15MB，几十毫秒）。超过则引入：
- SQLite 扩展 `sqlite-vec`（C 扩展，better-sqlite3 支持 loadExtension）；
- 或纯 JS `hnswlib-wasm`；
- 或外部进程 `usearch` Node binding。

Profile 里加 `dense` 开关，默认关闭（保持零依赖），CI/benchmarks 打开：

```js
// profiles.js
review: {
  ...,
  dense_rerank: { enabled: false, weight: 0.8 },
},
```

#### 影响评估

- 实现与文档对齐；
- 代码语义层检索能力有望显著提升；
- 对 AI agent plan/review 场景提供真语义召回。

#### 验证方式

- `tests/unit/crg-dense-rerank.test.js`：构造语义相似但 lexical 不同的节点对，断言 dense rerank 把语义近邻排前；
- `benchmarks/crg/retrieval-dense-vs-lexical.js`：在 spec-first 自身仓库上对比 top-k recall；
- 文档更新：对外文档标注 dense 为 opt-in。

#### 依赖

- 新增 devDep `@xenova/transformers` + 可选 `sqlite-vec`；
- 模型文件首次使用时下载，需考虑离线仓库策略。

#### 离线 CI 与气隙环境（U3）

默认 `@xenova/transformers` 首次 `pipeline(...)` 会从 HuggingFace CDN 下载模型文件（all-MiniLM-L6-v2 约 22MB）。对以下场景会 break：

- **离线 CI runner**（无出站网络）；
- **企业内网 / 气隙仓库**；
- **首次 build 冷启动**（CI 时间增加 10-30s）。

落地策略（按优先级）：

1. **预缓存到 CI 镜像**：`npm install` 阶段触发 warmup 脚本，把模型 fetch 到 `~/.cache/huggingface`，CI 镜像把该目录 bake 进去。需要在 `package.json` 加 `postinstall: node scripts/crg-warm-embedding-model.js`（可选，默认不跑，需 env 开启）；
2. **仓库内 vendor**：把模型文件 commit 到 `vendor/models/all-MiniLM-L6-v2/`（~22MB），`@xenova/transformers` 用 `env.localModelPath` 指向它。缺点：仓库 clone 变慢；优点：完全可重复；
3. **允许降级**：embedding fetch 失败时 `dense_rerank.enabled` 自动 fallback false，输出 warning。这是 opt-in 保底。

**默认策略**：D2 推出时采用策略 3（自动降级），把策略 1 作为企业用户的可选接入方案。明确在 `package.json` / README 里标注 "dense rerank 需要出站网络或预缓存模型"。

**CI 配置**：`.github/workflows/crg-quality-gate.yml` 在 dense 测试 job 里缓存 `~/.cache/huggingface`：

```yaml
- uses: actions/cache@v3
  with:
    path: ~/.cache/huggingface
    key: hf-cache-xenova-minilm-v1
```

---

### D3. 权重全是硬编码魔法数字

- **级别**：🟡 中
- **Phase**：4
- **位置**：
  - `src/crg/flows.js:139-146`（F1-F5 权重 0.30/0.20/0.25/0.15/0.10）
  - `src/crg/changes.js:92,106,130,134,140`（5 因子权重）
  - `src/crg/analyze.js:99,108,114,123`（surprising 4 因子 10/30/40/20）
  - `src/crg/retrieval/profiles.js:7-16`（retrieval 权重）

#### 问题描述

散落各处的权重没有配置化、没有版本、没有校准数据、没有 A/B。benchmarks/ 目录存在但未驱动这些权重。

#### 根因分析

原型阶段"先让它跑通"的实用主义，没演进到"可调可测"阶段。

#### 修复方案

新增 `src/crg/weights/`：

```
src/crg/weights/
  index.js               ← 导出 loadWeights(profile)
  defaults.json          ← 默认值（当前硬编码值）
  README.md              ← 每项权重的含义
```

```js
// weights/index.js
const defaults = require('./defaults.json');

function loadWeights(domain) {
  // 支持未来从 .spec-first/crg/weights.json 覆盖
  return defaults[domain] || {};
}

module.exports = { loadWeights };
```

```json
// weights/defaults.json
{
  "flow_criticality": {
    "file_spread": 0.30,
    "depth_score": 0.20,
    "security_score": 0.25,
    "test_gap": 0.15,
    "external_score": 0.10
  },
  "node_risk": {
    "flow_count": 0.25,
    "cross_community": 0.15,
    "test_coverage": 0.30,
    "security_kw": 0.20,
    "caller_count": 0.10
  },
  "surprising_connections": {
    "confidence_weight": 10,
    "cross_language": 30,
    "cross_community": 40,
    "peripheral_to_hub": 20,
    "min_score": 30
  }
}
```

所有模块 `require('../weights').loadWeights('flow_criticality')` 替代硬编码。

Tests 配 `tests/unit/crg-weights-schema.test.js` 校验 `defaults.json` 结构，防止后续误修改。

#### 影响评估

- 权重调优可测量、可版本化；
- 为后续 ML-based 权重学习（Phase 5+）铺路；
- 降低维护门槛。

#### 验证方式

- 迁移前后 smoke 测试结果一致（权重默认值不变）；
- 修改 weights/defaults.json 能触发不同评分结果。

---

### D4. chunk 内部分裂不是 AST-aware

- **级别**：🟡 中
- **Phase**：4
- **位置**：`src/crg/chunking.js:22-38`

#### 问题描述

```js
const span = Math.max((node.line_end || 0) - (node.line_start || 0) + 1, 1);
const chunkCount = Math.max(1, Math.ceil(span / effectiveMaxLines));

for (let index = 0; index < chunkCount; index++) {
  const start = (node.line_start || 0) + (index * effectiveMaxLines);
  const end = Math.min((node.line_end || 0), start + effectiveMaxLines - 1);
  chunks.push({ ... });
}
```

`buildChunksForNodes` 是以 AST 产出的 symbol span 为输入的，所以它**不是完全不 AST-aware**；但一旦单个 symbol span 超过 `maxChunkLines`，内部切分就退化为按行数机械切块。这样一个 300 行的大函数会被切成 4 块，块间无语义关联，块边界可能切断控制流。

而且（与 D1 联动）`retrieval_text` 是 `"lines X-Y"` 这样的 metadata，不是代码文本，chunking 的整体价值变得可疑。

#### 根因分析

早期设计只把 AST 用在"确定 symbol 外边界"，没有把 AST 继续用于 chunk 内部边界选择。

#### 修复方案

与 D1（retrieval_text 真实化）合并改造：

```js
// chunking.js 修复后
function buildChunksForNode(node, tsNode, fileSource, { maxLines = 80 } = {}) {
  // tsNode 是 tree-sitter 的 AST 节点
  // fileSource 是文件源码
  const chunks = [];

  if ((node.line_end - node.line_start + 1) <= maxLines) {
    // 小函数直接整块
    chunks.push(makeChunk(node, tsNode, node.line_start, node.line_end, fileSource));
    return chunks;
  }

  // 大函数：按 block/statement 边界切分
  const blockBoundaries = findBlockBoundaries(tsNode);   // AST 层找 {, }, if, for 等边界
  let currentStart = node.line_start;
  for (const boundary of blockBoundaries) {
    if (boundary - currentStart + 1 >= maxLines) {
      chunks.push(makeChunk(node, tsNode, currentStart, boundary, fileSource));
      currentStart = boundary + 1;
    }
  }
  if (currentStart <= node.line_end) {
    chunks.push(makeChunk(node, tsNode, currentStart, node.line_end, fileSource));
  }
  return chunks;
}

function findBlockBoundaries(tsNode) {
  // 遍历 tsNode 子树，返回 statement/block 末尾行号
  const boundaries = [];
  const walk = (n) => {
    if (['block', 'statement_block', 'compound_statement'].includes(n.type)) {
      boundaries.push(n.endPosition.row + 1);
    }
    for (let i = 0; i < n.childCount; i++) walk(n.child(i));
  };
  walk(tsNode);
  return boundaries.sort((a, b) => a - b);
}
```

每个 chunk 含真实代码：

```js
function makeChunk(node, tsNode, start, end, fileSource) {
  const lines = fileSource.split('\n').slice(start - 1, end);
  const code = lines.join('\n');
  return {
    id: `${node.id}:chunk:${start}-${end}`,
    ...
    retrieval_text: code,   // ← 真实代码
  };
}
```

#### 影响评估

- chunks 表变成真正可检索单元；
- 与 D1、D2 协同后，retrieval 效果有望显著提升。

#### 验证方式

- `tests/unit/crg-chunking-ast-boundaries.test.js`：长函数切分后每个 chunk 都在合理 AST 边界；
- chunks.retrieval_text 非空且含代码。

#### 依赖

D1（parser 透传 tsNode）、D2（embedding 对代码文本有效）。

---

### D5. `calls` 边不含 call-site 行号

- **级别**：🟡 中
- **Phase**：4
- **位置**：`src/crg/parser.js`（边抽取）+ `src/crg/migrations.js`（edges schema）

#### 问题描述

当前 edges 表只有 `source_id, target_id, kind, weight`，没记录"source 节点内部哪一行调用了 target"。

这导致：
- AI agent 做精准 patch 时无法定位调用点；
- `callers_of(foo)` 只说"文件 X 的函数 Y 调用了 foo"，不说第几行；
- review-context 无法定位变更影响的具体调用现场。

#### 根因分析

"符号图"层面的抽象，丢失了"调用现场"的精度。

#### 修复方案

**Schema 扩展**：

```sql
ALTER TABLE edges ADD COLUMN call_line INTEGER;   -- 调用发生的行号
ALTER TABLE edges ADD COLUMN call_column INTEGER; -- 列号（可选）
```

**Parser 扩展**：在 tree-sitter 提取 call expression 时保留调用点位置：

```js
// parser.js 伪代码
function extractCallEdges(fnTsNode, fileSymbolKey) {
  const edges = [];
  walk(fnTsNode, (n) => {
    if (n.type === 'call_expression') {
      const calleeName = extractCalleeName(n);
      edges.push({
        source_id: fnSymbolKey,
        kind: 'calls',
        target_name: calleeName,
        call_line: n.startPosition.row + 1,
        call_column: n.startPosition.column,
      });
    }
  });
  return edges;
}
```

**FactItem 扩展**：

```js
// cli/query.js callers_of 输出
{
  ...
  call_sites: [
    { file_path: 'src/a.js', line: 42, column: 8 },
    { file_path: 'src/b.js', line: 17, column: 4 },
  ],
}
```

#### 影响评估

- AI agent 生成 patch 精度可明显提升；
- `callers_of` 输出信息量提升。

#### 验证方式

- `tests/unit/crg-call-site-tracking.test.js`：构造多调用场景，断言 edges.call_line 准确；
- migration 测试：老 db 升级后 call_line 为 NULL，新 build 填充。

---

### D6. `parser.js` 单文件 1841 行，16 语言混在一起

- **级别**：🟢 低
- **Phase**：4
- **位置**：`src/crg/parser.js`

#### 问题描述

当前 parser.js 负责全部 16 语言的 AST 遍历，单文件 1841 行。加新语言要在这个大文件里找 switch case，维护成本高。

#### 根因分析

早期为了"一个文件跑通"。

#### 修复方案

拆分结构：

```
src/crg/parser/
  index.js              ← 导出 parseFile，按语言分发
  common.js             ← buildNode、buildSymbolKey、TEST_FILE_RE 等共享工具
  languages/
    javascript.js       ← JS/JSX/MJS/CJS
    typescript.js       ← TS/TSX/MTS/CTS
    python.js
    go.js
    java.js
    rust.js
    c.js
    cpp.js
    objc.js
    swift.js
    kotlin.js
    ruby.js
    php.js
    csharp.js
    scala.js
```

每个 `languages/*.js` 导出统一接口：

```js
module.exports = {
  extension: ['.js', '.jsx', '.mjs', '.cjs'],
  extractNodesAndEdges(tree, filePath, isTestFile) {
    // tree-sitter 特定语言的遍历逻辑
    return { nodes: [], rawEdges: [] };
  },
};
```

`parser/index.js` 装配：

```js
const lang = inferLanguage(filePath);
const langModule = require(`./languages/${lang}`);
const { nodes, rawEdges } = langModule.extractNodesAndEdges(tree, filePath, isTestFile);
```

#### 影响评估

- 维护性明显改善；
- 新语言贡献门槛下降；
- 语言特定 bug 定位清晰。

#### 验证方式

迁移前后 `tests/unit/crg-parser-*.test.js` 全绿。每个语言建独立测试文件。

**U5 复用约束**：`extension: [...]` 字段不应在 `languages/*.js` 里重新定义。已经有 `src/crg/lang-config.js` 提供 `buildExtToLang`。`parser/index.js` 按语言分发时，**必须**从 `lang-config` 读扩展名映射，否则会出现两套 source of truth 漂移。新结构里 `languages/*.js` 只导出 `extractNodesAndEdges`，不导出 `extension`。

---

### U1. `nodes.summary` / `chunks.summary` 是硬编码模板，属于 dead weight

- **级别**：🟢 低
- **Phase**：4（与 D1 合并推进）
- **位置**：`src/crg/parser.js:138`、`src/crg/chunking.js:35`

#### 问题描述

```js
// parser.js:138
summary: `${kind} ${name} defined in ${filePath}`

// chunking.js:35
summary: `${chunkConfig.language} ${node.kind} ${node.name} chunk ${index + 1}/${chunkCount}`
```

`summary` 字段在 schema 里存在（`migrations.js:45, 123`），每个 node / chunk 都写入了一份模板字符串，但**当前代码库内没有任何消费者做有意义的利用**——FactItem 不透出、retrieval 不参与、UI 不展示。

#### 根因分析

与 D1（retrieval_text）同一个时代的设计预埋，没跟进到真实 summary 生成。当前状态是空字段占位。

#### 修复方案

与 D1 合并改造，两种取向二选一：

**方案 A（彻底删除）**：`ALTER TABLE nodes DROP COLUMN summary`，减小 DB 体积；
**方案 B（真实摘要）**：与 D1 一起升级为真正的摘要内容——JSDoc / docstring 首段 + signature，由 parser 产出。

推荐方案 B，与 D1 合并 PR。

#### 影响评估

- 方案 A：DB 体积下降；
- 方案 B：summary 字段变成对 AI agent 真正有用的"一行描述"，可供 FactItem 透出。

#### 验证方式

`tests/unit/crg-summary-content.test.js`：断言 summary 非模板。

---

### U2. `open-db.js` 缺 `fileMustExist` 与长进程连接复用

- **级别**：🟡 中
- **Phase**：3
- **位置**：`src/crg/cli/open-db.js:51`

> **事实修正（Round 2 元审查）**：原 U2 标题"缺 readonly 模式与 connection pooling"是**事实错误**。已核实 `open-db.js:51` 明确写了 `new Database(dbPath, { readonly: true })`。readonly 不是问题。真正的缺口是 `fileMustExist` 与长进程场景下的连接复用。

#### 问题描述

当前 `openDb` 实现（`open-db.js:13-54`）：

```js
function openDb(argv) {
  // ...
  // 3. 检查 DB 文件
  const dbPath = resolveActiveGraphDb(repoRoot);
  if (!fs.existsSync(dbPath)) {
    process.stderr.write(`error: CRG graph not built...`);
    process.exit(2);
  }
  // ...
  // 5. 以只读模式打开，启用外键约束
  const db = new Database(dbPath, { readonly: true });   // ← readonly 已有
  db.pragma('foreign_keys = ON');
  return { db, repoRoot };
}
```

仍然存在的两个缺口：

**缺口 1：`fileMustExist` 未显式声明（配置显式性 / 防御式对齐，非正确性修复）**

> **Round 3 修正**：原版本声称"`existsSync` 与 `new Database` 之间的 TOCTOU 窗口会让 better-sqlite3 新建一个空 DB 文件"。**本地实测不成立**：`new Database(missingPath, { readonly: true })` 直接抛 `SQLITE_CANTOPEN`，**不会创建新文件**——只有 writable 模式下默认才会"不存在则创建"。
>
> 因此 `fileMustExist: true` 在当前 readonly 路径下**不是防止假阳性的正确性修复**，而是**配置显式性 / 与 `prepare(sql, { fileMustExist: true })` 等其他场景表达一致**的工程对齐。文档级别有价值，运行时行为差异可忽略。

仍建议补 `fileMustExist: true`，理由有二：
1. **防御式编程**：未来如果有人把这段代码 copy 到 writable 场景（例如新增写入命令），不带 `fileMustExist` 会立刻吃到"自动创建空 DB"的坑；
2. **意图表达**：让代码读者一眼看出"这里只读 + 必须存在"，省去去看 `existsSync` 前置检查才能推断意图。

不再保留"避免空库假阳性"这个具体论据。

**缺口 2：长进程场景无连接复用**

CLI 场景下单次命令打开 → 查询 → 关闭是合理的。但 CRG 被其他场景消费时（MCP server、IDE 插件、`spec-code-review` 批量调用多个 `crg query`），每次都 `new Database` 有性能浪费：
- 每次 open 要重新解析 schema；
- WAL reader slot 占用频繁回收；
- `pragma` 设置每次重新执行。

#### 根因分析

- `fileMustExist` 缺失是**配置显式性**问题，不是当前 readonly 路径下的运行时正确性问题（见缺口 1 的 Round 3 修正）；
- 连接复用是只在长进程场景才凸显的问题，单次 CLI 用户不会遇到。

#### 修复方案

**修复 1：补 `fileMustExist`**（零成本，纯防御式 / 显式化，不改变当前 readonly 路径下的运行时行为）

```js
// open-db.js:51 修复
const db = new Database(dbPath, { readonly: true, fileMustExist: true });
```

前置的 `fs.existsSync` 检查仍然保留，用于给用户**更友好的错误提示**（"CRG graph not built. Run: spec-first crg build ..."）；不再宣称它是"正确性的唯一保障"。

**修复 2：长进程连接复用**（可选，仅在 MCP server / IDE 插件场景启用）

抽出复用层：

```js
// cli/open-db-pool.js（新增，可选模块）
const connections = new Map();  // dbPath -> { db, refs }

function acquireReadonlyDb(dbPath) {
  let entry = connections.get(dbPath);
  if (!entry) {
    const Database = require('better-sqlite3');
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    db.pragma('foreign_keys = ON');
    db.pragma('cache_size = -64000');
    db.pragma('mmap_size = 268435456');
    entry = { db, refs: 0 };
    connections.set(dbPath, entry);
  }
  entry.refs++;
  return entry.db;
}

function releaseReadonlyDb(dbPath) {
  const entry = connections.get(dbPath);
  if (!entry) return;
  entry.refs--;
  if (entry.refs <= 0) {
    entry.db.close();
    connections.delete(dbPath);
  }
}
```

CLI 命令不走 pool，保持现有 open/close 语义。MCP server / IDE 插件显式 `acquire` / `release`。

#### 影响评估

- 修复 1：配置显式化，**不改变当前 readonly 路径下的运行时行为**；价值在于防御未来 writable 场景的复用 + 代码意图清晰；
- 修复 2：只在长进程场景有收益，CLI 用户无感；
- 不再保留"原 U2 readonly 缺口"和"TOCTOU 假成功"两个错误论据（已在缺口 1 的 Round 3 修正段公开纠错）。

#### 验证方式

- `tests/unit/crg-open-db-file-must-exist.test.js`：手动验证 `new Database(missing, { readonly: true, fileMustExist: true })` 抛 `SQLITE_CANTOPEN`；同时验证不带 `fileMustExist` 在 readonly 模式下也抛错（确认缺口 1 的运行时无差异）；
- 长进程连接复用仅在 MCP server / IDE 插件 feature 启用后补专项测试。

---

## 10. Quick Wins（横向执行）

### Q1. SECURITY_KEYWORDS 展开 O(N×25)

- **级别**：🟢 低
- **位置**：`src/crg/flows.js:117`、`src/crg/analyze.js`、`src/crg/changes.js:133,266`

#### 问题

每次匹配都 `[...SECURITY_KEYWORDS]` spread Set 为 Array，再 `.some(kw => name.toLowerCase().includes(kw))`，每节点 25 次 includes。

#### 修复

预编译为单正则：

```js
// constants.js
const SECURITY_KEYWORDS = new Set([...]);  // 保留
const SECURITY_REGEX = new RegExp(
  `(${[...SECURITY_KEYWORDS].map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
  'i'
);

module.exports = { SECURITY_KEYWORDS, SECURITY_REGEX };
```

使用方：

```js
// flows.js
const { SECURITY_REGEX } = require('./constants');
const secCount = nodeRows.filter(n => n.name && SECURITY_REGEX.test(n.name)).length;
```

#### 影响

大 flow 场景下数十万次 includes 降为数千次 regex test。

---

### Q2. `surprisingConnections` 两次扫 edges

- **级别**：🟢 低
- **位置**：`src/crg/analyze.js:61-78`

#### 问题

```js
const edges = db.prepare('SELECT id, source_id, target_id, kind FROM edges').all();
const semanticEdges = edges.filter((e) => !STRUCTURAL_EDGE_KINDS.has(e.kind));
// ...
const inDegree = new Map();
for (const edge of edges) {     // ← 再次遍历全量 edges
  inDegree.set(edge.target_id, (inDegree.get(edge.target_id) || 0) + 1);
}
```

#### 修复

单次遍历，同时 filter + 统计 inDegree：

```js
const rawEdges = db.prepare('SELECT id, source_id, target_id, kind FROM edges').all();
const semanticEdges = [];
const inDegree = new Map();
for (const edge of rawEdges) {
  inDegree.set(edge.target_id, (inDegree.get(edge.target_id) || 0) + 1);
  if (!STRUCTURAL_EDGE_KINDS.has(edge.kind)) semanticEdges.push(edge);
}
```

---

### Q3. `isIos` 检测 `readdirSync` 全目录

- **级别**：🟢 低
- **位置**：`src/crg/cli/build.js:193-202`

#### 问题

```js
const isIos = (() => {
  if (fs.existsSync(path.join(repoRoot, 'Podfile.lock'))) return true;
  try {
    return fs.readdirSync(repoRoot).some(
      (e) => e.endsWith('.xcodeproj') || e.endsWith('.xcworkspace')
    );
  } catch (_) { return false; }
})();
```

`readdirSync` 在大仓库可能读数千项，为了找 `.xcodeproj` 扩展。

#### 修复

直接 existsSync 检查常见路径名：

```js
const isIos = fs.existsSync(path.join(repoRoot, 'Podfile.lock'))
  || fs.existsSync(path.join(repoRoot, 'Podfile'));
// xcodeproj 检测放慢路径，只在没有 Podfile 时才 readdir
if (!isIos) {
  try {
    isIos = fs.readdirSync(repoRoot).some(e => e.endsWith('.xcodeproj') || e.endsWith('.xcworkspace'));
  } catch (_) {}
}
```

---

### Q4. better-sqlite3 缺性能 pragma

- **级别**：🟡 中
- **位置**：`src/crg/migrations.js:21-23`

#### 问题

只设 `foreign_keys=ON` 和 `journal_mode=WAL`。缺常见性能 pragma。

#### 修复

```js
const DDL_STATEMENTS = [
  `PRAGMA foreign_keys = ON`,
  `PRAGMA journal_mode = WAL`,
  `PRAGMA synchronous = NORMAL`,       // WAL 下 NORMAL 已足够持久化，大幅提速写入
  `PRAGMA cache_size = -64000`,        // 64MB 页缓存
  `PRAGMA temp_store = MEMORY`,
  `PRAGMA mmap_size = 268435456`,      // 256MB mmap
  ...
];
```

#### 影响

大仓库 build 时间有望下降，但需 benchmark 实测后再量化。

---

### Q5. generations/ 无自动回收

- **级别**：🟡 中
- **位置**：`src/crg/generations/`

#### 问题

每次 build 产生一个 `generations/<id>/graph.db`，无清理策略。大仓库每次几十 MB，几天后磁盘占用失控。

#### 修复

在 `promoteGeneration` 成功后，保留最近 N 代（默认 3）：

```js
// generations/promote.js 扩展
function pruneOldGenerations(repoRoot, { keep = 3 } = {}) {
  const genDir = path.join(resolveGraphDir(repoRoot), 'generations');
  if (!fs.existsSync(genDir)) return;

  const entries = fs.readdirSync(genDir)
    .map(name => ({ name, mtime: fs.statSync(path.join(genDir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  // 保留最近 keep 代 + current + last-known-good 引用的代际
  const protectedIds = new Set([
    readCurrentJson(repoRoot),
    readLastKnownGood(repoRoot),
    ...entries.slice(0, keep).map(e => e.name),
  ].filter(Boolean));

  for (const entry of entries) {
    if (!protectedIds.has(entry.name)) {
      fs.rmSync(path.join(genDir, entry.name), { recursive: true, force: true });
    }
  }
}
```

在 `build.js` promote 成功后调用。

---

## 11. 验收标准

### 11.1 Phase 1 验收

- [ ] F1 修复：`crg build` + `crg stats` unresolved 口径强一致（unit + e2e）；
- [ ] C1 修复：`surprising_connections` 不再把正常跨目录调用报告为惊喜（unit 构造用例断言）；
- [ ] C2 修复：AMBIGUOUS 缓存 rows 一次性，AMBIGUOUS name 多次查询 SQL 次数 = 1（spy 计数）；
- [ ] C3 修复：TSX / CTS / Python 相对路径解析成功；基线 `unresolved_edge_count` 对比修复前下降（实测数字记入 CHANGELOG）；
- [ ] C4 修复：多语言 basename fallback 单测通过；
- [ ] C5 修复：`line_end < line_start` 输入下 chunking 产出合法数据；
- [ ] C6 修复：新命名（lexical-overlap 或类似），subword 拆分单测覆盖；
- [ ] C7 修复：hunk 级过滤生效，单行注释改动不触发全文件 review；
- [ ] 所有 Phase 1 改动对应 CHANGELOG 条目完整；
- [ ] `npm test` 全绿。

### 11.2 Phase 2 验收

- [ ] P1 修复：四处 BFS 不再使用 `Array.shift()`（可 grep 守护）；
- [ ] P2 修复：子社区统计单次遍历 moduleEdges；
- [ ] P3 修复：社区 community_id 传播耗时下降；
- [ ] P4 修复：detectFlows 入口识别不依赖 `NOT IN (subquery)`；
- [ ] P5 修复：FTS 增量重建生效，大规模场景回退全量重建；
- [ ] P6 修复：FTS5 trigram 或 subword 索引方案任一落地；
- [ ] P7 修复：`assessFileRiskBatch` 落地，detectChanges SQL 次数 O(1) 级；
- [ ] P8 修复：review-context 按需加载反向邻接；
- [ ] benchmarks 新增 Phase 2 前后对比数据；
- [ ] `npm run test:e2e:crg` 通过。

### 11.3 Phase 3 验收

- [ ] S1 新增复合索引，老 db 升级正常；
- [ ] S2 unresolved_edges 唯一约束，老 db 去重升级；
- [ ] S3 expand 分块，500 种子不报 SQLite 参数上限错误；
- [ ] S4 FTS5 关键字转义加固，恶意 operator 不触发非预期语义；
- [ ] S5 FactItem 增加 `symbol_path`，docs 声明 id 生命周期约束；
- [ ] `tests/smoke/install-tarball.sh` 通过；
- [ ] migrations 幂等测试。

### 11.4 Phase 4 验收

- [ ] D1 retrieval_text 含真实代码 / docstring，FTS 基线查询召回提升；
- [ ] D2 dense retrieval opt-in 可用，benchmarks 记录 dense vs lexical recall；
- [ ] D3 权重配置化，支持覆盖；
- [ ] D4 chunks 表含真实代码，AST-aware 切分；
- [ ] D5 edges.call_line 填充，callers_of 输出 call_sites；
- [ ] D6 parser.js 拆分为 `parser/languages/*.js`；
- [ ] 对外文档（README / CRG-代码图引擎分析.md / 项目介绍）与实现事实一致，消除所有"name vs thing"差。

---

## 12. 风险与回滚

### 12.1 高风险变更

| 变更 | 风险 | 缓解 |
|---|---|---|
| C1 社区检测改造（若走方案 B） | 新 npm 依赖、社区边界大幅变化 | 先方案 A 过渡；方案 B 放 Phase 4 并做 A/B profile |
| C6/D2 引入 embedding | 新模型依赖、CI 时间增加 | opt-in profile；模型下载延迟 CI 首次；离线仓库预缓存 |
| S2 unresolved_edges 重建表 | migration 失败风险 | 预先 backup；migration 在事务内；测试覆盖多种老 schema |
| D5 edges schema 变更 | 老 db 无 call_line | `ALTER TABLE ADD COLUMN` 默认 NULL；消费层 graceful fallback |

### 12.2 回滚机制

- **代际机制**：每次 build 失败自动保留上一代 `current`；
- **Schema migration 幂等**：所有 migrate 都用 `IF NOT EXISTS` / 先检查再变更，多次运行安全；
- **Feature flag**：Phase 4 的 D1/D2 引入通过 profile 选项 `--semantic=dense` 控制，默认关闭；
- **版本回退**：`package.json` 升版前在 CHANGELOG 标注 breaking change，用户可回退 `npm install spec-first@<prev>`。

---

## 13. 附录

### A. 每个 Finding 的交叉引用索引

```
F1 ┬─ 关联：P5（FTS 增量重建）、S2（unresolved 唯一约束）
   ├─ 交叉验证：F1 的"0 变更回读持久化真相"策略依赖 C2/C3 修复后的 unresolved 语义稳定
   │    C2/C3 修复 → 第一次全量 build 写入新 unresolved → 后续增量 build 回读应保持一致
   │    验证方式：同一套 fixture 覆盖 F1 + C2 + C3，而非三个独立测试
   └─ 影响：spec-code-review 对 crg build 返回的 unresolved 判断

C1 ┬─ 关联：analyze.surprisingConnections 权重 + D3 weights 配置化
   │    方案 A 的 `score += 30` 与 `min_score = 30` 必须严格相等（M2）
   └─ 影响：spec-code-review 消费 surprising 信号

C2 ┬─ 关联：同文件优先消歧策略、C3 相对路径解析、F1 unresolved 口径（见上）
   └─ 影响：resolveEdges 速度与重名 symbol 解析稳定性

C3 ┬─ 关联：C4（basename fallback）、外部模块建模、F1 unresolved 口径
   └─ 影响：relative-path import 解析率，而非全部 unresolved import
   └─ 量化目标：见 2.4 基线表

C6 ┬─ 关联：api.js 硬编码 import（M5 迁移策略）、D2 dense rerank 真正语义层
   └─ 影响：retrieval 重排语义清晰度

C7 ┬─ 关联：P8（review-context 按需加载）
   └─ 影响：review-context graph_expansion 质量

P1 ┬─ 贯穿：flows / communities / impact / review-context
   └─ 影响：所有图遍历延迟

P8 ┬─ **依赖**：S1（edges(target_id, kind) 复合索引）必须先落地
   └─ 影响：review-context 延迟

D1 ┬─ 依赖：D4（AST-aware chunking 共用 extract）、D2（给 embedding 提供真实 text）
   ├─ 关联：U1（summary 字段同步真实化）
   └─ 影响：检索栈全链路

D2 ┬─ 依赖：D1、D4
   ├─ 环境依赖：U3 离线 CI 策略
   └─ 影响：所有 retrieve 调用

D6 ┬─ 约束：U5 必须复用 lang-config，不重新定义 extension 映射
   └─ 影响：parser 可维护性
```

### B. Benchmark 规划

新增 `benchmarks/crg/optimization-phases.js`：

```js
// 基线数据
baseline = {
  node_count: 779,
  edge_count: 1977,
  unresolved: 2809,
  build_duration_ms: /* 实测 */,
  review_context_duration_ms: /* 实测 */,
};

// 每 Phase 完成后追加一轮
phase1_results = {
  unresolved: /* 预期下降 */,
  surprising_count: /* 预期下降 */,
  ...
};
```

CI 层加 `crg-quality-gate.yml` 对比基线，回归告警。

### C. 文档更新清单

- [ ] `README.md`：必要时补 `community_id` / `semantic-rerank` 的术语边界说明
- [ ] `docs/项目介绍/CRG-代码图引擎分析.md`：如需进一步避免过度解读，可补 `community_id` 与 lexical-overlap rerank 的消费边界
- [ ] `docs/项目介绍/README.md`：Stage-0 消费清单同步
- [ ] `CHANGELOG.md`：按治理规则，每次代码变动追加条目
- [ ] 本报告（本文件）：Phase 完成后追加 "Phase N 完成摘要" 章节

### D. 依赖与工具清单

- 新增 dev/runtime 依赖（按方案选择，不是当前报告的前置事实）：
  - `graphology`, `graphology-communities-louvain`（仅当选择 C1 方案 B）
  - `@xenova/transformers`（仅当推进 D2 dense retrieval）
  - 可选 `sqlite-vec` 或 `hnswlib-wasm`（仅当推进 D2 ANN）
- 现有依赖无需变更。

### E. Phase 完成后的文档维护约定

每完成一个 Phase，必须：

1. 在本报告追加 "Phase N 完成摘要" 章节，包含：
   - 实测基线数据变化（unresolved、build 时间、召回率）；
   - 已修复 Finding 列表 + commit hash；
   - 未完全解决的遗留问题及原因；
2. 更新 `CHANGELOG.md`；
3. 触发 `/spec:compound` 把通用模式写入 `docs/solutions/`。

> **术语注（G3）**：`/spec:compound` 是本项目内部 skill，用于把可复用的问题解决模式沉淀到 `docs/solutions/`。skill 定义见 `skills/spec-compound/SKILL.md`。外部 reviewer 可用普通 markdown 写入 `docs/solutions/` 替代。

### F. 本报告自身的迭代约定（G4）

本报告声明为 CRG 全量优化的 "single source of truth"。为防止报告与实施事实脱节，约定以下更新规则：

**1. Finding 生命周期**

| 状态 | 含义 | 标记 |
|---|---|---|
| `open` | 未开始 | 默认 |
| `in-progress` | 正在修复，关联 PR | 在 Finding 标题后追加 `【in-progress #<PR>】` |
| `fixed` | 已修复，PR 合入 | 在 Finding 标题后追加 `【fixed @<commit>】`，同时附"实测差值" |
| `wontfix` | 决定不修，需给理由 | 标题后追加 `【wontfix: <原因>】` |

**2. 元审查修订（M/U/G）**

- `M*`（事实偏差 / 推理缺陷）→ 就地修订原 Finding，并在修订点加 `（M<N> 修订）` 注脚；
- `U*`（补入的新 Finding）→ 新增 Finding 并在优先级矩阵 2.3 追加；
- `G*`（结构/呈现问题）→ 就地修订，不需要特别标注。

**3. 新发现的 Finding 如何追加**

- 新 Finding ID 延续字母分类（C8 / P9 / S6 / D7 等，不回填已用编号）；
- 必须走完整七段式；
- 在 2.1 优先级矩阵追加行、2.2 级别统计同步、附录 A 交叉引用同步；
- CHANGELOG 记一行 "报告新增 Finding <ID>：<标题>"。

**4. 拒绝修复的 Finding 如何 closeout**

- 保留 Finding 文本不删；
- 在七段式最后追加 `#### Closeout` 章节：原因 + 替代方案 + 决策人；
- 在 2.1 矩阵的"级别"列加删除线（例如 ~~🔴 高~~），"Phase" 列改为 `wontfix`。

**5. 定期 re-audit**

每半年或每次大版本发布前，对本报告做一次 re-audit：

- 核对所有 `fixed` Finding 在代码里确实不复发；
- 对 `open` Finding 的优先级做一次重估；
- 对 baseline 数据做一次刷新。

---

## 14. 审查签收

- 审查范围：`src/crg/` 46 文件 / 8,567 行
- 发现 Finding 总数：**35**（原 32 + Round 1 补入 U1/U2 + Round 2 拆 C3→C3a+C3b 并新增 S6）
- 级别分布：🔴 高 10 / 🟡 中 19 / 🟢 低 6
- 建议完成工期：**Phase 1 3-5 天 + Phase 2 3-4 天 + Phase 3 1-2 天 + Phase 4 4-6 周**，总计约 5-8 周（视是否启动 D2 dense retrieval 而定）
- 本报告已应用三轮元审查修订：
  - **Round 1**：M1-M5 事实/推理修订、U1-U7 补入、G1-G4 结构修订；
  - **Round 2（外部审查）**：U2 事实错误修正、P1 收益数字删除、C3 拆 C3a+C3b、C6 降级为原地增强、C7 改三层输出、新增 S6、新增证据层级标签、工期与路径重算（详见第 15 章 15.1-15.6）；
  - **Round 3（外部审查）**：S6 拆为 S6.1（path_shape 形态）+ S6.2（resolveEdges failure_reason）两步，U2 缺口 1 降级为"配置显式性"删 TOCTOU 论据，C6 删除 Round 1 残留代码块消除内部矛盾，C5 quick fix 不再写模板 summary 与 U1 对齐（详见 15.7）。
- 核心主张：
  - **Phase 1 必须先行**：正确性是一切下游能力的前提；
  - **Phase 2 / 3 大部分可并行，但 P8 依赖 S1**（见 3.2）；
  - **Phase 4 是长期工程**：retrieval_text / embedding / chunking / call-site 精度共同决定 CRG 作为 "AI 代码理解底座" 的上限；
  - **unresolved 绝对数字不是终极目标**：见 2.4，Phase 1 修完不会让 baseline 2809 降到 2000 以下，真正的大头是"外部模块建模"（C3b + 未来外部集合建模），不在本次 35 条 Finding 的 Phase 1 范围内。

本报告作为 CRG 全量优化的 **single source of truth**，后续修复按 Finding ID 认领，每条独立 PR，完成后按附录 F 约定回填本报告。

---

## 15. 第二轮元审查修订记录（外部审查）

> 本章节完整记录 Round 2 元审查的 6 条事实/设计质疑与最终处理结论，用于未来 re-audit 时快速定位"这一轮为什么这么改"。

### 15.1 审查背景

- 第一轮元审查由同一 Claude 实例自审完成，产出 M1-M5 + U1-U7 + G1-G4 修订；
- 第二轮由外部审查者（Codex CLI）基于代码事实重新核对，发现 Round 1 仍有未纠正的错误；
- 本章记录 Round 2 对 Round 1 的再修订。

### 15.2 外部审查 6 条质疑与处理

| # | 外部质疑 | 判断 | 处理 |
|---|---|---|---|
| 1 | U2 事实错误：`open-db.js` 已经是 readonly，不是"缺 readonly" | ✅ 接受 | 重写 U2 为"缺 `fileMustExist` 与长进程连接复用（readonly 已有）"，并在 Finding 顶部加"事实修正"段公开纠错 |
| 2 | 2.4 unresolved 量化表使用的 bucket 不是 schema 字段，不可自动复算 | ✅ 接受 | 2.4 表头加"审计性声明"；新增 S6（`unresolved_edges.root_cause_hint` 列 + 分类器），让基线可 CI 复算 |
| 3 | C7 "只保留 hunk 相交节点"会把假阳性变假阴性（文件头 import / 类签名变化会被错杀） | ✅ 接受 | C7 修复方案改为"三层并存输出"：`affected_nodes` / `hunk_hit` / `module_scope_hit`，消费方选层 |
| 4 | C3 suffix 表混淆 JS/TS filesystem 与 Python/Ruby module 语义 | ✅ 接受 | 拆为 C3a（JS/TS suffix 扩展，Phase 1 落地）+ C3b（Python/Ruby resolver 工程，Phase 2+） |
| 5 | P1 "BFS 总耗时下降 50-80%" 无 benchmark 支撑 | ✅ 接受 | 删除具体百分比；P1 影响评估改为分热点表，明确 `communities.bfsComponents` 最优先，实施顺序强制 benchmark-first |
| 6 | C6 "重命名文件 + 兼容层 + deprecation" 对内部模块是 over-engineering | ✅ 接受 | C6 改为"保留 `semantic-rerank.js` 文件名，只改实现 + 加文件头注释"，删除原 M5 re-export 兼容层方案 |

### 15.3 本轮未接受的建议

| 外部建议 | 保留理由 |
|---|---|
| "报告分三层：已验证事实 / 高置信假设 / 待基准验证" 全文重构 | ROI 不足。改为在 2.1 矩阵追加"证据层级"一列（✅/🔬/🧭），每条 Finding 打标签，代价可控 |

### 15.4 Finding 总数演进

| 轮次 | 事件 | 总数 |
|---|---|---|
| 原始审查 | 31 条新 Finding + F1 继承 | 32 |
| Round 1 | 补入 U1（summary dead weight）、U2（open-db 连接，**当时标题错误**）| 34 |
| Round 2 | U2 标题纠正、C3 拆为 C3a+C3b、新增 S6（unresolved root cause）| 35 |

### 15.5 Phase 1 实施前置条件清单

Round 2/3 修订后，Phase 1 开工前需要确认：

- [ ] 已接受 U2 事实修正（open-db.js readonly 无需改动；fileMustExist 是配置显式性而非正确性）；
- [ ] 已接受 C7 三层输出方案（不替换文件级 affected）；
- [ ] 已接受 C3a 只覆盖 JS/TS，Python/Ruby 归 C3b 推迟；
- [ ] 已接受 C6 不重命名文件（前面 Round 1 重命名草图已删除）；
- [ ] 已接受 P1 benchmark-first 实施顺序；
- [ ] Phase 1 验收阶段不以"unresolved 绝对数字下降"为 pass/fail 标准（2.4 量化基线表说明）；
- [ ] **S6.1（path_shape 形态分类）在 Phase 3 先行落地，但 2.4 表升级为 CI 真审计基线必须等 S6.2（resolveEdges 显式 failure_reason）落地**；
- [ ] C5 quick fix 不再向 summary 写模板字符串（与 U1 对齐）。

### 15.6 后续 Round N 迭代约定

参见附录 F：新发现的事实错误优先于任何其他 Finding，以 `Round N 事实修正` 块形式就地插入对应 Finding，而不是新增 Finding。本章记录所有 Round-level 修订的入账轨迹。

---

### 15.7 Round 3 元审查修订（外部审查）

> Round 3 由外部审查者再次基于代码事实核对 Round 2 后的报告，发现 4 处仍需修订。本节完整记录质疑与处理。

#### 15.7.1 外部质疑 4 条与处理

| # | 外部质疑 | 判断 | 处理 |
|---|---|---|---|
| 1 | S6 把"不可从持久化数据推断的语义"写成可审计真相：分类器只看 `target_name`/`target_path_raw`，但 calls 边天然只有 `target_name`（`parser.js:375`），unresolved 落库不存 failure reason（`graph.js:338`）。所以分类器**无法**可靠产出 `symbol_ambiguous` / `suffix_not_covered` 等语义标签 | ✅ 接受 | S6 拆为 **S6.1（path_shape 形态分类，可立即做）+ S6.2（resolveEdges 显式 failure_reason，需先改 graph.js）**；删除所有 `node_builtin` / `python_stdlib` / `symbol_ambiguous` 等"分类器后验语义"标签；2.4 表声明强化"S6.2 落地后才能 CI 强制断言" |
| 2 | U2 缺口 1 把 `fileMustExist` 写成"避免空库假阳性"的正确性修复，但实测 `{ readonly: true }` 打开不存在的 DB 直接抛 `SQLITE_CANTOPEN`，**不会**创建新文件。论据不成立 | ✅ 接受 | U2 缺口 1 标题改为"配置显式性 / 防御式对齐，非正确性修复"；删除 TOCTOU 论据；保留 `fileMustExist: true` 改动但理由改为"防御未来 writable 场景被复用 + 意图表达"；影响评估明确"不改变运行时行为" |
| 3 | C6 内部自相矛盾：前半段还展示 `lexical-overlap-rerank.js` 重命名代码，后半段又说"保留文件名不改"。执行者会困惑 | ✅ 接受 | C6 修复方案章节顶部加"Round 3 修订"段，明确**Round 1 重命名草图已废弃**；删除冲突的 Round 1 代码块；把 splitIdentifier / 函数实现搬到"原地增强策略"段下面，并改 export 名为 `semanticRerank` 保持零 breaking |
| 4 | (a) 0.x 把 Round 1 U2 描述简写为"open-db fileMustExist"，但 Round 2 才纠正过当时标题错；(b) C5 quick fix 又往 summary 写模板字符串，与 U1 把模板 summary 定为 dead weight 矛盾 | ✅ 接受 | (a) 0.x Round 1 描述改为"open-db finding（当时标题`缺 readonly`是事实错误，Round 2 已纠正）"；(b) C5 修复示例的 `summary: \`degenerate span ...\`` 改为 `summary: null`，`retrieval_text` 不再生成模板，注释明确"等 D1 给出真实 retrieval_text 后再补" |

#### 15.7.2 Round 3 未提出的反驳

Round 3 的 4 条质疑均成立，没有保留任何反驳。

#### 15.7.3 S6 双步演进的关键含义

Round 3 让 S6 从"一锤子分类器"变成两步：

1. **S6.1**（Phase 3 可立即落地）：仅做形态分类（`name_only` / `relative_path` / `bare_name` / `slash_path` / `pkg_path` / `unknown`），不写任何语义标签；
2. **S6.2**（前置依赖：必须先改 `graph.js` resolveEdges 显式输出 `failure_reason`）：才能为 2.4 量化表提供"修了 C3a 就少 N 条 `relative_suffix_not_covered`"这种语义级回归断言。

**实施顺序硬约束**：
- Phase 1（C3a / C3b 只 stub / C7 三层输出）→
- Phase 2 性能 →
- Phase 3 = S6.1（形态分类）+ 其他 Schema 项 →
- 在 Phase 3/4 之间插入 **S6.2 graph.js 改造**（独立 PR），→
- 然后才能开 2.4 表的 CI 回归门禁。

如果跳过 S6.2 直接给 2.4 加 CI 门禁，会复刻 Round 2 那种"看起来可审计、实际靠后验猜测"的错误。

#### 15.7.4 Finding 总数演进（更新）

| 轮次 | 事件 | 总数 |
|---|---|---|
| 原始审查 | 31 条新 Finding + F1 继承 | 32 |
| Round 1 | 补入 U1（summary dead weight）、U2（open-db 连接，**当时标题错误**）| 34 |
| Round 2 | U2 标题纠正、C3 拆为 C3a+C3b、新增 S6（unresolved root cause）| 35 |
| Round 3 | S6 拆为 S6.1+S6.2 两步（**不增 ID**）、U2 缺口 1 降级、C6 删 Round 1 残留、C5 不再写模板 summary | 35（不变） |

#### 15.7.5 Round 3 未接受的建议

无。本轮 4 条全部接受。
