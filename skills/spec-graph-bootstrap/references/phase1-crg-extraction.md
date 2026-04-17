# Phase 1：事实抽取（Full 模式 CRG CLI 路径）

> **并行语义**：同一 Stage 内的所有 Bash 调用在同一 response 内批量发出（Claude 原生并行）。Stage 间有数据依赖，必须顺序执行。

## 1.0 前置触发（单独一步，先于所有 Stage）

```bash
spec-first crg context --repo=<target>
```

读取 `data.top_flows`、`data.top_communities`、`data.top_hubs`，确定后续 Stage 优先级。

> 字段注意：`crg context` 与 `crg flows` 均返回 `flow_id` 字段（非 `id`），直接传给 `crg flow --id=<flow_id>` 即可。

## 1.1 Stage A（同一 response 内并行）

### Project Identity
```bash
spec-first crg stats --repo=<target>
Read(<target>/package.json)  # 或 go.mod / pom.xml 等主配置文件
```
输出 → `fact-inventory.project_identity`：`name`, `primary_language`, `primary_frameworks`, `repo_shape`

### Data Shapes（FTS5 多词须独立调用，不得合并）
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

### Layer Detection
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

### Database Detection（Full 模式，与 Enhanced/Basic 共用相同探测方式）
```bash
Read(<target>/package.json | go.mod | pom.xml | requirements.txt)
  → 检测 DB 依赖（mysql2/pg/mongoose/sequelize/typeorm/prisma/gorm/django 等）
Glob({pattern: "**/{.env,.env.example,config/database.yml,config/settings.py}", path: <target>})
  → 检测 DB_HOST / DATABASE_URL 等连接参数变量名
Glob({pattern: "**/migrations/**/*.{js,ts,py,go,rb,sql}", path: <target>})
  → 检测迁移文件存在性
```

`db_type` / `db_access_level` 推断规则与 Enhanced/Basic § database 节完全相同。

> 注：Full 模式 CRG 图不包含数据库 schema 信息，因此 database 探测与降级模式共用 Glob/Read 方式，
> 不调用任何 CRG 命令。

## 1.2 Stage B-Round1（依赖 Stage A，同一 response 内并行）

### Entrypoints（Round1：获取 flow 列表）
```bash
spec-first crg flows --repo=<target>
```
记录 `data.items[]`：`{flow_id, entry_node, criticality, node_count}`（无 `name` 字段，字段名为 `flow_id` 非 `id`）。

**零结果 fallback**：若 `data.items[]` 为空（纯库类项目/无循环依赖）：
- 跳过 B-Round2 `crg flow` 系列和 Stage C `crg impact` 系列
- 降级为 Glob-based entrypoint 探测（同 Enhanced/Basic § entrypoints Basic 路径）
- 在 `generation_errors[]` 记录 `{ extractor: "entrypoint_extractor", error: "crg-flows-empty-fallback-to-glob", stage: "B", fallback_applied: true }`
- §1.6 校验第 6 项视为"fallback_applied=true"，**不触发 halt**，降级标注 `[entrypoints-fallback]`

### Module Structure（Round1：获取社区列表 + 架构）
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

### Integration 预处理（Round1：缩小候选库名）
```bash
Read(<target>/package.json)  # 或 requirements.txt / go.mod / pom.xml
```
根据 `primary_language` 选取已知库名清单（按分类：database/cache/message_queue/http_client/auth）。

## 1.3 Stage B-Round2（依赖 B-Round1，同一 response 内并行）

### Entrypoints（Round2：深度，top-5 criticality 流）
```bash
spec-first crg flow --id=<id> --repo=<target>  # × top-5
```
`id` 来自 B-Round1 `crg flows` 的 `data.items[].flow_id`。

**top-5 选取规则**：对 `data.items[]` 按以下优先级排序，取前 5：
1. `criticality` 降序（数值型直接比较；字符串枚举映射：`high=3 / medium=2 / low=1 / 其余=0`）
2. 同 criticality 时：`node_count` 降序（更深的流更重要）
3. 仍相同时：`flow_id` 字典序升序（保证确定性）

### Module Structure（Round2：社区深度）
```bash
spec-first crg community --id=<community_id> --repo=<target>  # × N
```
`community_id` 来自 B-Round1 `crg communities` 的 `data.items[].community_id`。
记录 `data.members[]`（含各节点的字符串 `id`（symbol_key 格式）、`name`、`file_path`）供 Stage C 使用。

输出 → `fact-inventory.modules`（每条附 `community_id`）

### Integration（Round2：获取库节点 ID）
```bash
spec-first crg search <lib> --repo=<target>  # × N（候选库名列表）
```
从 `data.results[]` 中按以下优先级取精确匹配节点的 `node_id`（字符串 symbol_key）：
1. **file_path 路径段匹配**：`file_path` 包含 `node_modules/<lib>/` 或 `vendor/<lib>/` 路径段的节点（NPM / Go vendor 安装路径）
2. **name 完全相等**：若无路径段匹配，取 `name == <lib>`（区分大小写）的节点
3. 仍无匹配 → 跳过 Round3，改用 Grep 回退（同 Basic 路径）

> 多个节点均满足条件时：取 `file_path` 最短的那个（通常是入口 index 节点），避免传入深层内部模块 ID 给 `importers_of`。

## 1.4 Stage B-Round3（依赖 B-Round2，同一 response 内并行）

### Integration（Round3：importers）
```bash
spec-first crg query --pattern=importers_of --module=<lib_node_id> --repo=<target>  # × N
```
`--module` 须为 B-Round2 `crg search` 返回的**节点 ID 字符串**（symbol_key 格式），不接受库名等非 ID 字符串。

输出 → `fact-inventory.integrations`（`confidence: inferred`, `inference_reason: "crg-importers-evidence"`）

## 1.5 Stage C（依赖 B-Round3，同一 response 内并行）

### Test Surface
```bash
spec-first crg query --pattern=tests_for --subject=<member.id> --repo=<target>  # × ≤10
```
`--subject` 为 B-Round2 `crg community` 返回的 `data.members[].id`（字符串，symbol_key 格式）。

**≤10 subjects 选取规则**（全部 members 合并后跨社区选取，确保代表性）：
1. **核心模块优先**：`file_path` 含 `core/` / `shared/` / `common/` / `util/` / `lib/` 的节点（最高优先）
2. **高风险节点次之**：出现在 Stage C Risk Signals `crg impact` 入口节点列表中的 members（这些节点已知有高 blast_radius）
3. **每个社区至少 1 个**：若前两轮未覆盖某社区，从该社区取 file_path 最短的节点补位
4. 仍不足 10：按 symbol_key 字典序补足至 10 或全选（members ≤ 10 时全选，无需筛选）

**test_kind 分类**（路径启发式，`inference_reason: "path-naming-pattern"`）：
- `file_path` 含 `e2e`/`end-to-end`/`playwright`/`cypress` → `e2e`
- `file_path` 含 `integration`/`api-test`/`contract` → `integration`
- 其余 → `unit`（兜底）

输出 → `fact-inventory.testing_surface` + `test-surface.json`

### Risk Signals
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

---

完成所有 Stage 后，返回 SKILL.md §1.6 写入控制面。
