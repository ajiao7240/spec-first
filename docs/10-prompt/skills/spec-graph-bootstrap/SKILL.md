---
name: spec-graph-bootstrap
description: "Graph-informed project bootstrap. Runs Phase 0–4: CRG readiness detection → AST-grade fact extraction (fact-inventory.json / risk-signals.json / test-surface.json) → task planning → document generation → route generation."
---

# Spec-First Graph Bootstrap

`spec-graph-bootstrap` 是 graph-informed 的项目上下文生成工作流，以 CRG CLI（`spec-first crg`）为 Tier 1 工具，输出 Observed 事实优先的控制面产物。

当前正式支持三类拓扑：

1. `workspace_multi_repo`
2. `monorepo_multi_module`
3. `single_repo`

## 调用方式

```
/spec:graph-bootstrap [target-repo-path]
```

`target-repo-path` 省略时取当前工作目录。

当目标目录不是 git repo 但能稳定发现 child repo，或调用方显式提供 `repoRoots` 时，默认按 workspace 模式继续，而不是因为“不是单一 git 仓库”中断主链。

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
- `compile-routing.js` 最后生成 routing / manifest / injection-index / `database-routing.json`

其中：

- `.spec-first/workflows/bootstrap/<slug>/workspace-registry.json` 与 `workspace-routing.json` 是 workspace machine-first 真源
- `workspace-readiness-summary.json` 只暴露 advisory-only readiness snapshot，不参与 routing / gate 真源判定
- `docs/contexts/<workspaceSlug>/workspace/repo-registry.md` 若存在，也只能是 human-facing 镜像，不得反向成为 runtime 真源

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

if slug == "" or slug == ".":           # 特判空串和 "."
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
    用户选「n」→ 停止并提示通过 --slug=<custom> 参数指定自定义 slug
```
若 README.md 不存在或无法解析 project_identity.name，视为首次运行，不弹确认。

### 0.2 MCP 就绪探测

- Step 0: 宿主选择（Claude / Codex）
- Step 1: mcp-setup marker 检测
- Step 2: Serena MCP probe → `serena.ready = true/false`

### 0.2b CRG CLI 就绪检查

读取当前宿主的 `host-setup.json`（路径来自 0.2 Step 1 的 marker 路径）。

```
Read host-setup.json
# ↑ 如果 Read 失败（文件不存在 / marker 路径未知）:
#   → 视同 version < "5"，按无 CRG block 逻辑继续
#   → 打印: "host-setup.json 不可读，跳过 CRG 就绪检查"

If version >= "5" and crg block exists:
  If crg.cli_available == false:
    → crg.indexed = false（直接跳过所有 CRG 操作）
    → graph_support_state = "crg-cli-unavailable"
    → 跳到 0.4 模式判定（降级到 Enhanced/Basic）

  If crg.cli_available == true and crg.native_modules == "missing":
    → 打印: "⚠️ CRG CLI 可用但原生模块缺失, 图构建可能失败"
    → 继续到 0.3 执行 DB 检测，但预期 crg stats 可能 exit 2

If version < "5" or crg block 不存在:
    → 按现有逻辑继续
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
    "检测到 spec-first crg CLI 可用，但当前项目尚未构建图索引。
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

写入 `status: in_progress`。完整字段定义见 `references/artifact-schemas.md`。

### 0.7 Rerun Backup（阶段2范围内必须支持）

如果 `docs/contexts/<slug>/` 已存在，在 **任何 Phase 3 写入开始前**：

- 备份到 `.spec-first/workflows/bootstrap/<slug>/backup_<ISO-timestamp>/`
- **校验备份**（两级校验，任一失败则停止并报告错误，不进入 Phase 3）：
  1. 文件数量相等（原目录 vs backup 目录递归统计）
  2. backup 中不存在空文件（文件大小 = 0 字节）：`glob backup/**/* | filter(size == 0) → 若非空则报告具体文件名`
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

## Phase 1：事实抽取

### 模式路由

- **Full 模式**（`crg.indexed=true`）：读取 `references/phase1-crg-extraction.md`，按 Stage A→B-Round1→B-Round2→B-Round3→C 序列执行事实抽取。完成后返回此处 §1.6 写入控制面。
- **Enhanced / Basic 模式**（`crg.indexed=false`）：读取 `references/phase1-degraded-extraction.md`，按 Batch 1→2→3 序列执行事实抽取。完成后返回此处 §1.6 写入控制面。

### 1.6 写入控制面（所有模式共享）

写入路径：`.spec-first/workflows/bootstrap/<slug>/`

**写入顺序**：先写三个主文件（fact-inventory.json、risk-signals.json、test-surface.json），再写 artifact-manifest.json。

完整字段 contract 见 `references/artifact-schemas.md`。

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
   并将后续 Phase 2/3 中 `code-facts/public-entrypoints.md` 降级为 Enhanced 模式质量（标注 `[entrypoints-fallback]`）
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
- 数据库相关 contract 在 bootstrap 主链内只写 control-plane：
  - `fact-inventory.database[]`：repo 内数据库 hints
  - `fact-inventory.database_schema[]`：schema / migration / doc-er 线索
  - `database-routing.json`：LLM-first handoff，描述只读 runtime capability 与建议下一步
  - bootstrap 主链**不再创建** `database-context task`，也不再预生成 `database/` 文档目录

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

**前置动作**：若目标目录已存在，先执行 §0.7 Rerun Backup，backup 校验通过后才能继续。

**并行**（各 Worker 消费 fact-inventory.json）：
- `00-summary.md` ← `project_identity`
- `architecture/module-map.md` ← `modules` + `data_shapes`
- `pitfalls/index.md` ← `risk_signals` + `integrations`
- `code-facts/public-entrypoints.md` ← `entrypoints`
- `code-facts/test-map.md` ← `testing_surface` + `test-surface.json`
- `code-facts/high-risk-modules.md` ← `risk_signals`
- `context-packs/review-change.md` ← 静态组装（不调用 `crg review-context`，后者是 diff-based 按需工具）

数据库相关内容不再由 bootstrap 预生成文档：
- bootstrap 只写 `fact-inventory.database[]`
- bootstrap 只写 `fact-inventory.database_schema[]`
- bootstrap 只写 `database-routing.json`
- 后续阶段如需数据库分析，由 LLM 读取上述 handoff + repo 原文件，并在存在只读能力时自行决定是否执行只读 introspection

**串行（最后）**：`README.md`（上下文控制台，汇总所有产物状态）

**README.md 最小内容规范**：
```markdown
# <project_identity.name> · Context Pack

Generated: <ISO date> | Mode: <analyzer_mode> | Graph: <graph_support_state>

- project: <project_identity.name>
- primary_language: <project_identity.primary_language>
- repo_shape: <project_identity.repo_shape>
- topology: <fact.topology.kind>
- source_of_truth: control-plane artifacts under .spec-first/workflows/bootstrap/<slug>/
```
- README 退回为轻量 summary + `source_of_truth`
- 不再维护数据库产物状态表，避免 README 与真实文件落盘状态漂移

**artifact-manifest.json 第二次写入**（Phase 3 全部完成时）：

字段详见 `references/artifact-schemas.md` § 第二次写入。写入 `status: complete` 及 `outputs` 产物 depends_on 清单。

**收尾**：
- 若本次创建了 backup，且 Phase 3 / Phase 4 全部完成：删除 backup 目录
- 若**固定 v1 产物**任一写入失败：恢复 backup，停止流程

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
    - context-packs/review-change.md
  review:
    - code-facts/high-risk-modules.md
    - pitfalls/index.md
    - context-packs/review-change.md
    - code-facts/test-map.md
  unknown:
    - README.md

# output_exists.* 条件名 → 文件路径映射契约（src/context-routing/ 消费此表）
# 命名规则：路径中 / 和 - 均替换为 _，去掉扩展名
selection_rules:
  - condition: "output_exists.code_facts_public_entrypoints"
    inject:
      - code-facts/public-entrypoints.md
  - condition: "fact.graph_support_state == 'local-available'"
    inject:
      - architecture/module-map.md
      - code-facts/high-risk-modules.md

advice:
  review: "优先 code-facts 和 risk signals，再回读 narrative summary"
  work: "优先 test-map 与 review-change，定位改动风险和验证面"
  plan: "优先 module-map 与 public-entrypoints，先建立模块边界与入口心智"
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

降级规则：降级事件写入 `generation_errors[]`；`analyzer_mode` 字段记录最终模式；`README.md` Freshness 章节体现降级原因。

置信度/severity 完整枚举与约束规则见 `references/confidence-rules.md`。

---

## 最终产物树

```
.spec-first/workflows/bootstrap/<slug>/
  fact-inventory.json      ← 控制面（所有 Worker 输入源）
  risk-signals.json
  test-surface.json
  database-routing.json    ← runtime-only route / fallback / provenance 真源
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
