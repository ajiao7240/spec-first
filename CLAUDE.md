# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

`spec-first` 是一个 Node.js CLI 工具，将 workflow 资产（skills、agents、commands）安装并管理到用户项目的 `.claude/` 或 `.codex/` 目录中。源码在 `src/cli/`，可发布资产在 `skills/`、`agents/`、`templates/`，生成的运行时副本（`.claude/`、`.codex/`）是输出，不是源码。

## 开发命令

```bash
npm test                          # 完整测试套件（smoke + integration）
npm run test:smoke                # CLI 帮助、init、生成资产、doctor 验证
npm run test:integration          # 端到端流程检查
npm run test:jest                 # CRG Jest 单元测试（需先 npm install --legacy-peer-deps）
bash tests/unit/lang-policy.sh   # 单独验证语言策略注入逻辑
bash tests/unit/mcp-setup.sh     # 单独验证 mcp-setup skill 脚本和配置
npm pack                          # 发布前构建 tarball
```

## 架构

### 核心模块（`src/cli/`）

| 文件/目录 | 职责 |
|---|---|
| `commands/init.js` | `spec-first init` - 同步资产到项目，写入 developer profile 和 lang policy |
| `commands/doctor.js` | 检查运行时资产完整性和一致性 |
| `commands/clean.js` | 清理 spec-first 管理的资产 |
| `plugin.js` | 加载 `.claude-plugin/plugin.json` manifest；实现 `syncBundledAssets`（commands/skills/agents 复制 + 转换） |
| `adapters/claude.js` | Claude 平台适配器；负责 canonical agent name 重写（`spec-first:category:name` → bare name）|
| `adapters/codex.js` | Codex 平台适配器 |
| `lang-policy.js` | 幂等地将语言/治理策略注入 `CLAUDE.md` 或 `AGENTS.md`（用 `<!-- spec-first:lang:* -->` 标记管理） |
| `developer.js` | 解析 developer identity（git 用户名、lang、initialized_at）；读写 `.developer` 文件 |
| `state.js` | 读写 `.claude/spec-first/state.json`；用于增量同步时识别废弃资产 |

### 资产结构

- **`skills/`** — 每个 skill 是一个目录，入口为 `SKILL.md`；init 时整目录复制到 `.claude/skills/`
- **`agents/`** — 子目录下的 `.md` 文件；`agents/review/`、`agents/design/` 等分类
- **`templates/claude/commands/spec/`** — 命令模板文件；init 时复制到 `.claude/commands/spec/`
- **`.claude-plugin/plugin.json`** — plugin manifest，声明 commands 列表和目录映射

### Canonical Agent Name 系统

Skill/Agent 源文件中使用 `spec-first:category:name` 格式引用 agent。Claude adapter 在 init 时将其重写为 bare name（`name`），Codex adapter 保留完整格式，以保证跨平台 agent 名称唯一性。

`doctor` 命令会检测运行时文件中是否残留未重写的 canonical 名称。

### CRG 模块（`src/crg/`）

`spec-first crg <subcommand>` — 内嵌 Code Review Graph Node.js 运行时，提供 17 个子命令：

| 文件 | 职责 |
|---|---|
| `cli/router.js` | 17 子命令路由 + `--repo` 路径校验 |
| `migrations.js` | better-sqlite3 schema 初始化（7 表 + FTS5） |
| `input-convergence.js` | 候选文件收敛（git ls-files + 排除链 + Pod 适配）；DEFAULT_EXCLUDES 用 bin/Debug/** + bin/Release/** 替代 bin/**，避免误排 Node.js CLI 入口 |
| `parser.js` | tree-sitter AST 解析 → symbol_key + raw_edges；CommonJS require() → imports_from 边；module 节点继承 isTestFile 标记 |
| `incremental.js` | SHA256 增量检测 + fingerprints 更新（detectChangedFiles 返回 changedShas 供复用） |
| `graph.js` | upsertNodes/upsertEdges + resolveEdges 五阶段解析（直接 target_id → 精确 file_path → 相对路径解析（require('./x')＋扩展名探测）→ 全局符号 → 同文件消歧；缓存用 Object.create(null) 防原型污染） |
| `communities.js` | 3-Pass 社区检测（Pass1 CONTAINER_DIRS、Pass2 fragmented/scattered、Pass3 最小4节点） |
| `flows.js` | PageRank + BFS 流程检测 |
| `analyze.js` | surprising_connections（spec§14.6 4因子：confidence_weight/cross_language/cross_community/peripheral_to_hub）+ god_nodes 分析 |
| `search.js` | FTS5 搜索 + rebuildFTS（独立虚表，drop-recreate 全量重建） |
| `changes.js` | git diff 风险评分（High/Medium/Low） |
| `cli/build.js` | build + stats CLI handler；增量构建 0 变更时保留 graph_meta.unresolved_edge_count 不归零 |
| `cli/context.js` | context 命令 |
| `cli/query.js` | `--pattern` 8种查询 FactItem 输出（callers_of/callees_of/importers_of/importees_of/dependents_of/dependencies_of/tests_for/similar_to） |
| `cli/postprocess.js` | 后处理编排（writeCommunities→detectFlows→analyzeGraph→rebuildFTS） |
| `cli/open-db.js` | 共享 DB open 工具 |
| `cli/envelope.js` | JSON 信封工厂 |
| `commands/` | 13 个子命令处理器（flows/flow/affected-flows/communities/community/architecture/surprising-connections/god-nodes/impact/large-functions/search/detect-changes/review-context） |

**JSON 契约**：`docs/contracts/crg-cli-v1.schema.json`（JSON Schema Draft 2020-12）

**测试**：`npm run test:jest`（需先 `npm install --legacy-peer-deps`）

<!-- spec-first:lang:start -->
## 语言与治理策略（由 spec-first 管理）

**语言设置：** `zh`

### 语言规则
- 回复、状态更新、生成文档、评审意见、计划说明等所有自然语言输出使用**中文**
- 允许混用英文技术术语，不要求强行翻译常见技术词
- 代码标识符（变量、函数、类、模块、文件名中的技术标识）保持英文
- 新增代码注释使用中文，简洁清晰，不写空洞注释
- 代码、命令、路径、配置键、环境变量名、API 名称、协议名等技术标识不因语言偏好而被翻译

### Changelog 治理规则
**代码变动铁律（无例外）**
- 任何对项目源码的新增、删除、修改，必须同步在项目根目录 `CHANGELOG.md` 中添加一条记录
- 无此记录的代码变动，一律拒绝生成
- 记录格式以仓库现行格式为准
- **示例：** `- vX.Y.Z YYYY-MM-DD 作者: 一句话摘要`
- 用户可见变更在末尾追加 `(user-visible)`
<!-- spec-first:lang:end -->
