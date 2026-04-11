---
title: "feat: CRG Node.js 阶段0 Bootstrap 实现"
type: feat
status: active
date: 2026-04-11
origin: docs/01-需求分析/spec-graph-bootstrap需求/阶段0-CRG-NodeJS集成技术方案.md
---

# feat: CRG Node.js 阶段0 Bootstrap 实现

## Overview

在 `spec-first` npm 包内从零实现 CRG（Code Review Graph）Node.js 核心能力，消除 Python 依赖和 MCP 手动注册步骤，实现 `npm install -g spec-first` 后通过 `spec-first crg <command>` 直接可用。覆盖 Step 0（契约冻结）→ Step 3（review 场景 + 增量刷新稳定）；Step 4（CI 矩阵 / 跨平台 prebuild 验证 / 性能基线）和 Step 5（消费闭环 3A/3B gate）均作为独立后续阶段另行验收。

## Problem Frame

现状要求用户分别安装 Python CRG、手动注册 MCP server、重启 Claude，才能进入 spec-graph-bootstrap 工作流——六步操作，两种语言运行时，一次重启。这使 spec-graph-bootstrap 阶段 1-4 的构建依赖不可控环境。

本计划将全部 CRG 能力内嵌 `spec-first` 包，以 CLI 子命令方式暴露 17 个工具，SKILL.md 通过 `Bash(...)` 调用，JSON 输出到 stdout。Node.js 版是 spec-graph-bootstrap 的唯一 CRG 实现，不与 Python CRG 共存（参见 origin §十二）。

## Requirements Trace

- R1. `spec-first crg build --repo=<path>` 可在真实项目上运行，返回合法 JSON（node_count, edge_count）
- R2. 17 个子命令均有 JSON schema 约束，输出格式变更视为 breaking change  
  > 子命令清单：`build` / `stats` / `context` / `query` / `impact` / `large-functions` / `search` / `flows` / `flow` / `affected-flows` / `communities` / `community` / `architecture` / `surprising-connections` / `god-nodes` / `detect-changes` / `review-context`
- R3. 所有输出遵循统一 envelope：`schema_version / generated_at / repo_root / degraded / warnings / data`
- R4. `confidence / source_tier / evidence / inference_reason` 字段覆盖率 100%（origin §8.5）
- R5. 输入收敛生效：`Pods/graphify-out/build/dist/.git` 在最终输入集合中文件数为 0
- R6. `crg communities` 每项含 `health.status`（四象限）、`health.density`、`health.independence`（B2/B5）
- R7. `crg surprising-connections` 每项含 `score`（整数）和 `reasons`（string[]），不含结构边（B1）
- R8. `crg architecture` 的 `hub_nodes` 不含 `kind=module` 文件级节点（B3）
- R9. `crg stats` 含 `corpus_health.status`（small/optimal/large）和 `corpus_health.total_loc`（B4）
- R10. 敏感文件前置过滤：graph.db 节点表和 FTS 索引均不含命中 SENSITIVE_PATTERNS 的文件路径（B6）；FTS 索引 symbol 名称，不扫描文件内容——symbol 名称内嵌密钥属 v1 已知限制，由 rebuildFTS 前二次路径校验降低风险
- R11. 同一仓库两次 `crg build` 无变更时第二次 `changed_files: 0`（增量幂等）
- R12. `exit 2` 只触发降级，不阻断主任务（`safe_crg_call` 约定，origin §8.7）
- R13. native 模块（tree-sitter, better-sqlite3）优先使用 prebuild binary，安装失败时输出清晰诊断

## Scope Boundaries

- Step 5（3A/3B 消费闭环验证）不在本计划范围，作为独立 gate 另行执行
- iOS 扩展（Swift/ObjC/Kotlin + CTMediator 适配器）属于 Step 2 语言按需扩展，v1 Parser 只保证 JS/TS/Python/Go/Java/Rust/C/C++ 八种语言
- 向量搜索（embed_graph）、wiki 生成、多仓库、重构分析不集成（origin §四 取舍表）
- `spec-first init` 不新增 MCP 配置写入步骤，仅增加可选引导提示
- Python CRG 继续独立存在，Node.js 版不与其共存，不需要互操作兼容层

## Context & Research

### Relevant Code and Patterns

- `src/cli/index.js`：命令分发模式（`cmd === 'doctor'` 分支），`crg` 路由按同一模式追加
- `src/cli/commands/init.js`：资产同步与 `spec-first init` 幂等性模式
- `src/cli/plugin.js`：插件 manifest 驱动 + `syncBundledAssets` 泛化同步，crg 模块不进入此链路
- `bin/spec-first.js`：CLI 入口，`argv[2] === 'crg'` 分发是唯一入口变更点

### Institutional Learnings

- 无相关 `docs/solutions/` 先例——本实现为 spec-first 首次内嵌 native 模块，无历史模式可直接参照

### External References

- origin §三 技术选型：`tree-sitter ~0.25.x`、`better-sqlite3 ~12.6.0`（v12.6.2 捆绑 SQLite 3.51.3）、`simple-git ~3.0.0`
- origin §七 SQLite Schema：7 张表（nodes/edges/communities/flows/flow_nodes/graph_meta/fingerprints）+ FTS5 虚表
- origin §十四 + 核心算法实现参考.md：8 个算法参考实现（§14.1–14.8）
- 输入收敛技术方案.md §四：输入收敛流水线顺序（git ls-files → 排除规则 → 语言推导）

## Key Technical Decisions

- **CLI 子命令而非 MCP server**：SKILL.md 直接 `Bash(...)` 调用，无需 MCP 注册或重启（origin §二 §三）
- **better-sqlite3 同步 API**：事务批量提交（1 次 fsync vs N 次），WAL 模式，THREADSAFE=2 符合单线程 Node.js 用法；`unixepoch()` 在捆绑 SQLite 3.51.3 上完全支持
- **tree-sitter ~0.25.x patch-level 锁定**：防止语言包小版本升级静默改变解析行为（origin §六 版本策略）
- **native 模块延迟 require**：只有 `argv[2] === 'crg'` 时才加载 `src/crg/`，不影响 `init/doctor/clean` 启动速度
- **契约先行（Step 0）**：JSON schema + 测试先于实现冻结，防止后续 breaking change（origin §十 Step 0）
- **输入收敛 tracked-only 默认模式**：`git ls-files` 优先，iOS 本地 Pod 场景自动升级至 `tracked+untracked`（输入收敛方案 §四）
- **3-Pass 社区检测替代 Leiden**：完全确定性，rerun 结果严格一致，消除 fingerprints 漂移风险（B5，origin §十一）
- **symbol_key 稳定标识**：`<file_path>#<kind>#<name>#L<line_start>` 解决同名符号串线（origin §十三）
- **`resolveEdges` 两阶段边处理**：parser 只输出 `target_name/target_path_raw`（raw edge），`graph.js` 在入库后统一解析为 `source_id/target_id` canonical 边（origin Step 1 deliverables）

## Open Questions

### Resolved During Planning

- `unixepoch()` SQLite 兼容性：better-sqlite3 v12.6.2 捆绑 SQLite 3.51.3（>= 3.38.0），无需替换为 JS 层时间戳，可直接使用
- `.spec-first-graphignore` 由仓库维护还是 init 写入：由仓库侧维护，`spec-first init` 默认不覆写，避免覆盖项目已有治理规则（输入收敛方案 v1 约定）
- iOS Pods 目录由谁管理：iOS 适配器 `computePodExcludePaths` 自动处理，用户不需要在配置文件中写 Pod 规则
- `exit 2` 降级语义：只触发 `safe_crg_call` 中的 fallback，不阻断 workflow（origin §8.7）

### Deferred to Implementation

- `resolveEdges` 跨文件引用解析的精确匹配率：依赖真实项目测试才可量化
- `.h` 文件 ObjC/C/C++ 启发式路由的误判率：fixture 覆盖后运行时可能有边界案例
- tree-sitter 各语言包在 Windows arm64 上的 prebuild binary 覆盖情况：需实际 CI 矩阵验证
- `crg context` 的 `~100 token` 输出大小控制策略（top-N 截断规则的具体阈值）：实现时基于真实项目调整

## High-Level Technical Design

> *此图说明预期架构和数据流，供 reviewer 验证方向，是定向参考，不是实现规格。*

```mermaid
flowchart TD
    subgraph Input["输入收敛层 (input-convergence.js)"]
        A[git ls-files] --> B[内置排除规则]
        B --> C[.spec-first-graphignore]
        C --> D[安全硬规则过滤]
        D --> E[final_inputs]
    end

    subgraph Parse["解析层 (parser.js)"]
        E --> F[detectPresentLanguages]
        F --> G[tree-sitter AST 提取]
        G --> H[nodes[] + raw_edges[]]
    end

    subgraph Graph["图数据层 (graph.js / incremental.js)"]
        H --> I[resolveEdges → canonical 边]
        I --> J[SQLite upsert]
        K[fingerprints 表 SHA 比对] --> G
    end

    subgraph Post["后处理层 (flows/communities/analyze)"]
        J --> L[PageRank-like flows]
        J --> M[3-Pass communities]
        J --> N[surprising_connections]
    end

    subgraph CLI["CLI 层 (src/crg/cli/)"]
        O[router.js] --> P[build/stats/context]
        O --> Q[query/impact/search]
        O --> R[flows/communities]
        O --> S[review/changes]
    end

    Post --> CLI
    Graph --> CLI

    CLI --> T["stdout: JSON envelope\n{schema_version, degraded, data}"]
```

## Implementation Units

---

- [ ] **Unit 1: 契约冻结**

**Goal:** 在编写任何实现代码前冻结 JSON 输出格式、事实字段和参数矩阵，所有后续单元以契约测试为门控

**Requirements:** R2, R3, R4

**Dependencies:** 无

**Files:**
- Create: `docs/contracts/crg-cli-v1.schema.json`
- Create: `docs/contracts/crg-fact-item.schema.json`
- Create: `docs/contracts/crg-query-args.md`
- Create: `tests/contracts/crg-cli-v1.test.js`

**Approach:**
- `crg-cli-v1.schema.json`：定义统一 envelope（`schema_version/generated_at/repo_root/degraded/warnings/data`）和 17 个子命令各自 `data` 字段的类型约束
- `crg-fact-item.schema.json`：定义 `confidence`（Observed/Inferred/Unknown）、`source_tier`（crg_ast/serena_semantic/grep_glob）、`evidence`、`inference_reason`（v1 枚举：5 种固定值）的字段要求
- `crg-query-args.md`：pattern × 参数矩阵（callers_of → --symbol，importers_of → --module，tests_for → --subject 等），非法组合标注 exit 1
- `crg-cli-v1.test.js`：契约测试框架——验证 envelope 字段存在、`Inferred` 事实必须有 `inference_reason`、非法参数组合返回 exit 1；测试在实现完成前以 "pending" 形式存在

**Patterns to follow:**
- 测试框架选定为 **Jest**（v1 统一）；在 Unit 2 `package.json` 中声明为 `devDependency`；现有 `tests/unit/*.sh` 脚本保持不变，新 `.test.js` 文件由 `npm test` 通过 Jest runner 执行

**Test scenarios:**
- Happy path：完整 envelope JSON 通过 schema 验证
- Error path：`Inferred` 事实缺少 `inference_reason` 时契约测试失败
- Error path：`crg query --pattern=callers_of --module=<x>` 参数组合不合法，exit 1
- Edge case：`warnings` 字段为空数组而非 null/undefined

**Verification:**
- `tests/contracts/crg-cli-v1.test.js` 在无实现时以 pending 状态可运行，不报语法错误
- schema 文件通过 JSON Schema 语法校验

---

- [ ] **Unit 2: 基础设施搭建（依赖声明 + CLI 路由 + Schema 初始化）**

**Goal:** 将 native 依赖加入 package.json，在 CLI 入口接入 `crg` 路由，建立 SQLite schema 初始化与版本管理层

**Requirements:** R1, R13

**Dependencies:** Unit 1

**Files:**
- Modify: `package.json`（新增 tree-sitter 主包及 8 个语言 grammar 包、better-sqlite3、simple-git、ignore 依赖；devDependencies 新增 jest）
- Modify: `bin/spec-first.js`（`argv[2] === 'crg'` 延迟 require 分发至 router.js）
- Create: `src/crg/cli/router.js`（子命令分发，`--help` 列表，未知命令 exit 1）
- Create: `src/crg/migrations.js`（建表 + schema v1 初始化，`schema_version` 写入 `graph_meta`）

**Approach:**
- `package.json`：依赖版本遵循 `~`（patch-level）策略（origin §六）；tree-sitter 主包及各语言 grammar 包（`tree-sitter-javascript`、`tree-sitter-typescript`、`tree-sitter-python`、`tree-sitter-go`、`tree-sitter-java`、`tree-sitter-rust`、`tree-sitter-c`、`tree-sitter-cpp`）统一 `~0.25.x`，`better-sqlite3 ~12.6.0`，`simple-git ~3.0.0`，`ignore ^5.0.0`（`.spec-first-graphignore` 解析），`jest` devDependency（测试框架，Unit 1 选定）
- `bin/spec-first.js`：延迟 require——`if (argv[2] === 'crg') { require('../src/crg/cli/router').run(argv.slice(3)); return; }` 插入在 `runCli` 调用之前，不影响现有命令路径
- `router.js`：纯分发逻辑，无业务代码；handler 模块按需 require（同样延迟加载）；对 `--repo` 参数执行 `path.resolve` + `fs.statSync` 验证目录存在，非法路径 exit 1
- `migrations.js`：7 张表 + FTS5 虚表按 origin §七 schema 建立；`PRAGMA foreign_keys = ON`；`PRAGMA journal_mode = WAL`；`graph_meta` 写入 `schema_version=1`

**Patterns to follow:**
- `src/cli/index.js`：`cmd ===` 分支模式
- `src/cli/commands/doctor.js`：错误 exit code 模式

**Test scenarios:**
- Happy path：`spec-first crg --help` exit 0，输出子命令列表
- Error path：`spec-first crg unknown-cmd` exit 1，stderr 含提示信息
- Happy path：在临时目录运行 `migrations.js`，验证 7 张表均已创建，`graph_meta` 含 `schema_version=1`
- Edge case：重复运行 `migrations.js` 不报错（幂等建表）

**Verification:**
- 现有 `npm run test:smoke` 通过（init/doctor/clean 命令不受影响）
- `spec-first crg --help` 可运行，`spec-first crg stats` 返回 exit 2（图未构建，预期行为）

---

- [ ] **Unit 3: 输入收敛流水线**

**Goal:** 实现 `final_inputs` 计算逻辑：git ls-files → 内置排除规则 → `.spec-first-graphignore` → 安全硬规则 → 语言推导

**Requirements:** R5, R10

**Dependencies:** Unit 2

**Files:**
- Create: `src/crg/input-convergence.js`
- Create: `tests/unit/crg-input-convergence.test.js`（或 `.sh`）
- Create: `tests/fixtures/graphignore/`（fixture 仓库目录用于验收用例）

**Approach:**
- 函数签名：`collectInputFiles(repoRoot, options)` → `{ finalInputs, presentLanguages, stats }`，`stats` 含 `input_files_total / input_files_after_ignore / input_files_by_language / ignored_files_by_rule / build_duration_ms`（输入收敛方案 §七 建议指标）
- 模式优先级：`tracked-only`（默认）→ git 不可用时全目录递归枚举回退
- iOS 升级规则：`isIos=true` + Podfile.lock 含本地 Pod（`:path:`）→ 自动升级 `tracked+untracked`，stderr warning
- `.spec-first-graphignore` 解析：支持 `*`/`**`/`?`/`!`/注释行（gitignore 语法），复用 `ignore` npm 包或自实现
- 安全硬规则：`SENSITIVE_PATTERNS`（5 条正则，origin §14.1）白名单 `!` 不能绕过
- `detectPresentLanguages(finalInputs)` 内联：基于扩展名推导，`.mm → m`，`.h` 内容启发式路由

**Test scenarios:**
- Happy path（验收用例）：含 `Pods/AFNetworking/`（三方）+ `Pods/HSTradeModule/`（本地 `:path:`）+ `graphify-out/` + `.git/` 的 fixture，三方 Pod 和产物目录文件数为 0，本地 Pod 正常入图
- Edge case：Podfile.lock EXTERNAL SOURCES 为空 → 整个 `Pods/**` 安全排除，不报错
- Edge case：白名单 `!generated/keep.ts`，仅 `keep.ts` 入图
- Error path：白名单尝试包含敏感文件（`credentials.json`），仍被拒绝
- Happy path：`tracked-only` 模式下连续两次枚举同一仓库，`final_inputs` 集合完全相同

**Verification:**
- fixture 断言：`Pods/graphify-out/build/dist/.git` 文件数为 0
- `detectPresentLanguages` 返回语言集合与 `final_inputs` 一致（无额外扫描）

---

- [ ] **Unit 4: 核心解析层**

**Goal:** 实现 `parser.js`：tree-sitter AST 提取、SENSITIVE_PATTERNS 前置过滤、8 种 v1 语言支持、`symbol_key` 稳定标识、`raw_edges` 生成

**Requirements:** R1, R10

**Dependencies:** Unit 2, Unit 3

**Files:**
- Create: `src/crg/parser.js`
- Create: `tests/unit/crg-parser.test.js`
- Create: `tests/fixtures/parser/` （每语言 ≥3 个 fixture：函数声明、类声明、import、测试文件）

**Approach:**
- `LANG_LOADERS`：JS/JSX/TS/TSX/Python/Go/Java/Rust/C/C++（10 种 v1 基础，`.mm/.hpp/.cc/.cxx` 别名），Parser 实例模块级懒加载缓存
- `symbol_key` 格式：`<file_path>#<kind>#<name>#L<line_start>`，用于边关联和跨 rerun 去重
- 敏感文件过滤：`SENSITIVE_PATTERNS` 匹配 basename，`return { skipped: true, reason: 'sensitive' }`，不抛异常
- 文件只读一次（TOCTOU-safe）：`readFileSync` 字节同时用于 SHA 计算和 `toString('utf8')` 解析
- `raw_edges`：含 `target_name / target_path_raw`，不在 parser 层解析为 `target_id`——`graph.js resolveEdges` 负责
- 测试节点识别：`TEST_FILE_RE` + `TEST_NAME_RE`，`is_test=1`
- `LANG_SPEC[lang]`（origin §14.7.1）：正式实现用统一抽取框架替代全局 `FUNC_TYPES/CLASS_TYPES`（Step 2 补全 iOS 语言时完善）

**Patterns to follow:**
- origin §14.1 参考实现（完整骨架代码）

**Test scenarios:**
- Happy path：JS 文件含函数声明 → nodes 含 `kind=function`，symbol_key 格式正确
- Happy path：TS 文件含类声明和方法 → `kind=class` + `kind=method`，嵌套关系正确
- Happy path：import 语句 → raw_edges 含 `kind=imports_from`，`target_path_raw` 非空
- Edge case：`.env` 文件 → `skipped=true, reason=sensitive`，不进入 nodes
- Edge case：`.h` 文件含 `@interface` → 识别为 ObjC（`lang=m`）
- Error path：unsupported_lang 文件 → `skipped=true, reason=unsupported_lang`，不抛异常
- Edge case：空文件 → nodes 只含 module 节点，edges 为空

**Verification:**
- 对 spec-first 自身 JS 源码运行 parser，node 数量 > 0，无 exit 2
- `skipped_sensitive` 计数在含 `.env` 的 fixture 下 ≥ 1

---

- [ ] **Unit 5: 增量检测 + 图数据层**

**Goal:** 实现 `incremental.js`（SHA 变更检测）和 `graph.js`（SQLite CRUD + resolveEdges）

**Requirements:** R1, R11

**Dependencies:** Unit 2（migrations.js）, Unit 4（parser 输出格式）

**Files:**
- Create: `src/crg/incremental.js`
- Create: `src/crg/graph.js`
- Create: `tests/unit/crg-incremental.test.js`

**Approach:**
- `incremental.js`：`detectChangedFiles(db, filePaths)` 返回 `{ changed, unchanged, deleted }`；1 次批量 SELECT + 单事务批量 upsert/delete（origin §14.2）；`computeFileSHA` try/catch 处理读取失败（将该文件移入 deleted）
- `graph.js`：`upsertNodes / upsertEdges`（基于 symbol_key UPSERT）；`resolveEdges(db, rawEdges, repoRoot)`——将 `target_name/target_path_raw` 解析为 `target_id`，解析失败不阻塞构建（记录 unresolved 计数）；构建完成后若 `unresolved_rate > 10%`（unresolved / total_raw_edges）则在 envelope `warnings[]` 中追加 `{ type: "high_unresolved_edge_rate", rate: <n> }`；`deleteStaleNodes(db, deletedPaths)` 级联删除节点和关联边
- 外键安全顺序：社区重建前先 `UPDATE nodes SET community_id = NULL`，再 `DELETE FROM communities`（origin §七）

**Patterns to follow:**
- origin §14.2 参考实现（批量 SELECT + 单事务）

**Test scenarios:**
- Happy path：初次构建 → 所有文件入 `changed`，fingerprints 全量写入
- Happy path：二次构建无变更 → `changed=[]`，`unchanged=all`
- Happy path：单文件修改 → 只有该文件在 `changed`，其他在 `unchanged`
- Happy path：文件删除 → 出现在 `deleted`，对应 fingerprint 从表中移除
- Edge case：文件在 filePaths 中但读取失败（ENOENT）→ 不抛出，该文件移入 `deleted`
- Integration：`resolveEdges` 在含同名函数的项目上不串线（通过 symbol_key 断言）

**Verification:**
- 同一仓库连续两次 build 日志：第二次 `changed_files: 0`
- `graph_meta` 的 `last_built` 时间戳在 build 后正确更新

---

- [ ] **Unit 6: MVP 四命令（crg build / stats / context / query）**

**Goal:** 交付 Step 1 的四个核心子命令，能在真实项目上运行并通过契约测试

**Requirements:** R1, R2, R3, R4

**Dependencies:** Unit 1（契约）, Unit 3（输入收敛）, Unit 4（parser）, Unit 5（incremental + graph）

**Files:**
- Create: `src/crg/cli/build.js`（build + stats 子命令）
- Create: `src/crg/cli/query.js`（query 子命令，8 种 pattern）
- Create: `src/crg/cli/context.js`（context 子命令）
- Modify: `tests/contracts/crg-cli-v1.test.js`（解除 pending，补充断言）

**Approach:**
- `build.js`：编排层调用 `collectInputFiles → detectChangedFiles → parseFile（仅 changed）→ upsertNodes/Edges → deleteStaleNodes → postprocess（Unit 7 后补全）→ 更新 graph_meta`；`--force` 跳过增量，全量重建；统一 envelope 输出
- `stats.js`：单次 SELECT 聚合统计 + `corpus_health` 计算（`total_loc / 1000 < 30 → small，30-500 → optimal，> 500 → large`）；图未构建时 exit 2（B4）
- `context.js`：从 flows/communities/nodes 各取 top-N 构建紧凑概览（~100 token 目标，具体 N 值实现时调整）
- `query.js`：8 种 pattern 的 SQL 查询逻辑；按 §8.6 参数矩阵在路由层校验 pattern × 参数组合合法性

**Execution note:** 先运行契约测试（pending → failing），再实现命令使测试变绿。

**Test scenarios:**
- Happy path：`crg build --repo=<spec-first>` 返回合法 JSON，含 `node_count > 0`
- Happy path：`crg stats --repo=<built>` 含 `schema_version`、`corpus_health.status`
- Error path：图未构建时 `crg stats` exit 2，stderr 含提示
- Happy path：`crg query --pattern=callers_of --symbol=<key>` 返回合法 JSON
- Error path：`crg query --pattern=callers_of --module=<x>` exit 1（参数不合法）
- Integration：`crg build` 后立即 `crg build`，第二次 `changed_files: 0`

**Verification:**
- `tests/contracts/crg-cli-v1.test.js` 全部通过（无 pending）
- 在 spec-first 自身仓库上四个命令均返回合法 JSON，无 exit 2

---

- [ ] **Unit 7: 后处理算法（flows / communities / analyze / search）**

**Goal:** 实现 3-Pass 社区检测、PageRank-like 执行流评分、惊喜连接评分、FTS5 搜索，作为 `crg postprocess` 的内部步骤

**Requirements:** R6, R7, R8, R9

**Dependencies:** Unit 5（graph 数据层）, Unit 6（build 编排框架）

**Files:**
- Create: `src/crg/flows.js`（BFS 图遍历 + PageRank-like 评分）
- Create: `src/crg/communities.js`（3-Pass 社区检测）
- Create: `src/crg/analyze.js`（surprising_connections + godNodes）
- Create: `src/crg/search.js`（FTS5 关键词搜索）

**Approach:**
- `communities.js`：Pass 1 自适应目录框架（跳过容器层）→ Pass 2 O(E) 健康评估（`density = intra_edges / max_possible, independence = intra_edges / (intra + inter)`，四象限分类）→ Pass 3 仅对 `file_count > total_nodes × 25%` 的超大社区执行 BFS 连通分量精化；外键安全顺序写入（origin §14.5）
- `flows.js`：入口点 BFS 展开（loadAdjacency 预加载全图），PageRank damping=0.85，20 次迭代（origin §14.4）
- `analyze.js`：`surprisingConnections`——4 因子评分（structural_gap/cross_community/degree_mismatch/confidence_asymmetry），过滤 imports/contains/defined_in 结构边（B1）；`godNodes`——过滤 `kind=module` + 方法存根 + 孤立函数（B3）
- `search.js`：FTS5 `fts_nodes` 虚表的关键词查询，`--kind` 过滤
- `build.js` 中 `postprocess` 步骤补全：`build → detectChangedFiles → parse → upsert → detectFlows → writeCommunities → analyzeGraph → rebuildFTS`
- `rebuildFTS`：重建 FTS 前对每条 node 的 `file_path` 执行 SENSITIVE_PATTERNS 二次校验，命中者排除出 FTS 索引（防止输入收敛层误放行的文件进入全文搜索）

**Patterns to follow:**
- origin §14.3–14.6 参考实现

**Test scenarios:**
- Happy path：`crg communities` 每项含 `health.status`（四象限之一）、`health.density`（0–1）、`health.independence`（0–1）
- Happy path：两次运行 `crg communities`，社区 ID 和成员列表完全一致（确定性验证）
- Happy path：`crg surprising-connections` 每项含 `score`（整数）和 `reasons`（非空 string[]），不含 imports/contains/defined_in 边
- Happy path：`crg architecture` 的 `hub_nodes` 列表在含 `index.ts` 的项目上不出现文件名节点
- Happy path：`crg search keyword` 在已知含该词的项目上返回 ≥1 结果
- Edge case：`oversized` 社区 BFS 精化失败时输出 `health.note: "oversized, no split boundary found"`，不静默截断

**Verification:**
- `crg postprocess` 可独立运行，不抛出未捕获异常
- `crg communities` 每项含三个 health 字段，`stats.by_status` 汇总计数非空

---

- [ ] **Unit 8: 全量 17 子命令（flows/communities/analyze CLI + 补全 query）**

**Goal:** 将 Unit 7 后处理算法暴露为 CLI 子命令，补全 `crg impact / large-functions / search / affected-flows` 等剩余命令，达到 17 子命令全覆盖

**Requirements:** R1, R2, R6, R10

**Dependencies:** Unit 6（build MVP）, Unit 7（后处理算法）

**Files:**
- Create: `src/crg/cli/flows.js`（flows / flow / affected-flows 子命令）
- Create: `src/crg/cli/communities.js`（communities / community / architecture 子命令）
- Create: `src/crg/cli/analyze.js`（surprising-connections / god-nodes 子命令）
- Modify: `src/crg/cli/query.js`（补全 impact + large-functions + search 子命令）
- Create: `src/crg/cli/postprocess.js`（crg postprocess 独立暴露）

**Approach:**
- 所有 CLI 处理器从 `src/crg/` 各算法模块调用，不包含业务逻辑
- `affected-flows`：调用 `simple-git` 获取 `--since=<sha>` 的变更文件集，与 flow_nodes 表关联查询受影响流
- `impact`：调用 `loadAdjacency` + `impactRadius`（origin §14.3），支持 `--depth=N`
- `large-functions`：`SELECT name, file_path, line_end - line_start AS loc FROM nodes WHERE kind IN ('function','method') AND loc >= <min-lines> ORDER BY loc DESC LIMIT <limit>`
**Test scenarios:**
- Happy path：17 个子命令在 spec-first 自身仓库上均返回合法 JSON，无 exit 2
- Happy path：`crg flows --sort=criticality` 输出按 criticality 降序
- Happy path：`crg communities` 社区数 ≥1，成员文件列表非空
- Happy path：`crg search <known-keyword>` 返回含该词的 node
- Integration（B5 Pass 3）：对 oversized 社区，BFS 精化后各子集独立输出，子集 file_count 之和等于原 file_count
- Edge case：`--since=<invalid-sha>` 返回 exit 1，不是 exit 2

**Verification:**
- 所有输出中 `confidence/source_tier` 字段覆盖率 100%
- 输入收敛断言：在含 Pods/graphify-out/build/dist/.git 的真实或 fixture 仓库，最终输入集合文件数为 0

---

- [ ] **Unit 9: review 场景 + 增量刷新稳定 + fingerprints.json**

**Goal:** 实现 `changes.js`（git diff + 风险评分）、`crg review-context / detect-changes` 子命令、`fingerprints.json` 产物依赖图管理，完成 Step 3 目标

**Requirements:** R11, R12

**Dependencies:** Unit 8（全量子命令）

**Files:**
- Create: `src/crg/changes.js`（git diff 解析 + 风险评分 High/Medium/Low）
- Create: `src/crg/cli/review.js`（detect-changes + review-context 子命令）
- Modify: `src/crg/cli/build.js`（build 完成后写 fingerprints.json）

**Approach:**
- `changes.js`：`simple-git` 获取 `--since=<sha>` diff，对每个变更文件/函数按修改规模、fan-in/blast-radius 评风险等级；参照 Python `changes.py` 逻辑移植
- `review-context`：组合 `changes.js` + `impactRadius` + 被修改节点代码片段（从 SQLite 取 line_start/line_end，再读文件）+ 相关测试列表（`tested_by` 边）
- `fingerprints.json`：build 完成后写入 `inputs`（文件 SHA）+ `outputs`（产物依赖关系）+ `analyzer_version / graph_schema_version`，路径：`.spec-first-graph/fingerprints.json`（origin §七 fingerprints.json 结构）
- `crg stats` 在图过期时（`fingerprints` SHA 与磁盘不一致超过阈值）输出 `warning: stale`，exit 0

**Test scenarios:**
- Happy path：`crg detect-changes --since=HEAD~1` 返回含 `risk_level`（High/Medium/Low）的合法 JSON
- Happy path：`crg review-context --since=HEAD~1` 返回含 `diff_summary` 和 `affected_nodes` 的合法 JSON
- Happy path：同一仓库执行两次 `crg build`，第二次输出 `changed_files: 0`
- Happy path：`crg stats` 在图过期时输出 `warnings[].type = "stale"`，不 exit 2
- Integration：指定单文件变更后，`fingerprints.json` 只有该文件的 SHA 更新
- Edge case：`crg build` 中途崩溃（`fingerprints` 表半写入）→ 下次 build 重新全量检测，不残留脏数据

**Verification:**
- `crg detect-changes` 和 `crg review-context` 在 spec-first 自身仓库最近 1 个 commit 上均返回合法 JSON
- `fingerprints.json` 存在于 `.spec-first-graph/`，含 `schema_version / analyzer_version / inputs / outputs` 字段

---

## System-Wide Impact

- **Interaction graph:** `bin/spec-first.js` 新增 `argv[2] === 'crg'` 分支；`spec-first init / doctor / clean` 命令路径不受影响；native 模块延迟 require，`spec-first init` 启动速度不变
- **Error propagation:** `exit 2` 只代表"图未构建/DB 损坏"，SKILL.md 通过 `safe_crg_call` 捕获降级，不阻断主任务；`exit 1` 为参数错误或业务错误，由调用方处理
- **`safe_crg_call` 接口约定（本计划文档化，实现由 SKILL.md 承担）：**
  - 调用方（SKILL.md）包裹所有 `crg` 子命令调用
  - `exit 0`：正常输出，解析 JSON，继续主任务
  - `exit 2`：降级——返回空 `data: []` / `data: {}` + `degraded: true`，不抛出，不阻断 workflow
  - `exit 1`：参数错误，向上抛出，视为调用者 bug
  - stderr 内容不转发给 LLM，仅记录日志
- **State lifecycle risks:** `fingerprints` 表 build 中途失败时不完整，下次 build 重新全量检测（自愈）；社区写入需外键安全顺序（先 NULL community_id，再 DELETE communities），否则外键约束错误
- **API surface parity:** `crg query` 的 pattern × 参数矩阵变更视为 breaking change；统一 envelope `schema_version=crg-cli/v1` 变更需 major 版本号
- **Integration coverage:** `safe_crg_call` 约定需在 spec-graph-bootstrap SKILL.md 中实现——本计划不覆盖 SKILL.md 修改，但需与其保持接口一致
- **Unchanged invariants:** `spec-first init / doctor / clean` 行为完全不变；`.claude-plugin/plugin.json` manifest 和资产同步链路不受影响；现有 smoke/integration 测试全部继续通过

## Risks & Dependencies

| 风险 | 缓解 |
|------|------|
| native 模块（tree-sitter/better-sqlite3）在受限 CI 环境编译失败 | 两者均优先使用 prebuild binary（常见平台已覆盖）；安装失败时 postinstall 输出清晰诊断并退出，v1 不提供 WASM fallback（WAL/FTS5/同步 API 不等价） |
| `npm test` smoke 测试被 native 模块安装耗时拖慢 | native 模块只在 `spec-first crg` 调用路径加载，延迟 require 保证不影响 init/doctor/clean 命令 |
| tree-sitter 语言包版本碎片化（~0.25.x 内小版本差异） | CI 矩阵覆盖 macOS/Linux × Node 18/20/22；所有语言包统一锁 ~0.25.x；语言包升级需 CI 全矩阵通过后合入 |
| `resolveEdges` 跨文件引用解析率低（target_path_raw 难以对齐） | unresolved 边记录计数但不阻塞 build；以 Python CRG 对同一仓库的解析结果作为 ground truth 基准对比 |
| 社区 ID 跨 rerun 不稳定（历史 Leiden 问题） | 3-Pass 确定性算法（B5）已从设计上消除此风险；fixture 测试两次 rerun 社区 ID 完全一致 |
| Step 5（3A/3B gate）不在本计划，产物有收益但未验证 | Step 5 作为独立 gate 在 Step 4 稳定化后执行，由单独 plan 驱动 |

## Documentation / Operational Notes

- `.spec-first-graph/` 应加入目标仓库 `.gitignore`，图数据库属本地构建产物，不应提交
- `.spec-first-graphignore` 由目标仓库维护，`spec-first init` 默认不强制覆写
- native 模块安装失败时用户看到 postinstall 诊断，需按提示安装 build-tools（node-gyp 前置依赖）
- 语言支持扩展（Swift/ObjC/Kotlin）按需安装，不强制加入基础依赖；文档中说明可选依赖安装方式

## Sources & References

- **主文档：** [阶段0-CRG-NodeJS集成技术方案.md](../01-需求分析/spec-graph-bootstrap需求/阶段0-CRG-NodeJS集成技术方案.md)
- **输入收敛：** [阶段0-输入收敛与排除规则技术方案.md](../01-需求分析/spec-graph-bootstrap需求/阶段0-输入收敛与排除规则技术方案.md)
- **算法参考：** [阶段0-核心算法实现参考.md](../01-需求分析/spec-graph-bootstrap需求/阶段0-核心算法实现参考.md)
- 相关 plan：[2026-04-10-001-feat-crg-mcp-setup-integration-plan.md](2026-04-10-001-feat-crg-mcp-setup-integration-plan.md)（MCP setup，不同路径，无直接依赖）
- 现有 CLI 入口：`src/cli/index.js`、`bin/spec-first.js`
