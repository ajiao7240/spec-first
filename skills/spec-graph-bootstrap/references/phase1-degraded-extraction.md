# Phase 1：事实抽取（Enhanced / Basic 模式降级路径）

> 本文件仅在 `crg.indexed=false` 时执行。Full 模式跳过本文件，直接读取 SKILL.md §1.6 产物。
>
> 两种降级模式均须填写 `fact-inventory.json` 相同字段；confidence 上限为 `Inferred`，
> severity 上限为 `medium`（≥2 独立信号时可升 `high`，见 `references/confidence-rules.md`）。

## 操作序列（分 3 批次执行）

> **并行约束**：每批次内的所有调用在同一 response 内并行发出（≤8 次工具调用/response）。
> 批次间有数据依赖，必须顺序执行。`integrations` 需要 Batch 1 产出的 `primary_language`，
> 因此放入 Batch 2。

---

## Batch 1（基础探测，同一 response 并行，≤8 calls）

### project_identity

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

### layers

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

## Batch 2（依赖 Batch 1 的 `primary_language`，同一 response 并行，≤8 calls）

### entrypoints

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

### modules

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

### integrations

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

### data_shapes

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
`kind` 按命名规则分类（同 Full 模式 Stage A Data Shapes kind 分类规则）

---

## Batch 3（独立，同一 response 并行，≤8 calls）

### testing_surface

**Enhanced / Basic（共用）:**
```
Glob({pattern: "**/*.{test,spec}.{ts,js,py,go,rb}"})
Glob({pattern: "**/*_test.{go,py}"})
Glob({pattern: "**/e2e/**/*.{ts,js}"})
Glob({pattern: "**/integration/**/*.{ts,js}"})
```
取前 20 个文件，每个：Read 前 30 行提取 import（被测目标）。

`test_kind` 按路径启发式分类：
- `file_path` 含 `e2e`/`end-to-end`/`playwright`/`cypress` → `e2e`
- `file_path` 含 `integration`/`api-test`/`contract` → `integration`
- 其余 → `unit`（兜底）

`confidence: Inferred`，`inference_reason: "path-naming-pattern"`

### database

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

### risk_signals（Enhanced / Basic 模式约束）

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

## 写入控制面（Enhanced / Basic）

与 SKILL.md §1.6 相同路径，相同 JSON 校验规则（1–5 项照常执行）。
**第 6 项 entrypoints 非空校验仅适用于 Full 模式，Enhanced/Basic 跳过**——降级模式下 entrypoints 为空时，只在 `generation_errors[]` 记录 `entrypoints-empty-non-full-mode`，不中断流程。

---

完成所有 Batch 后，返回 SKILL.md §1.6 写入控制面。
