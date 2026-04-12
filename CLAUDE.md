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
| `input-convergence.js` | 候选文件收敛（git ls-files + 排除链 + Pod 适配）；步骤8 EXT_TO_LANG 语言过滤保证 finalInputs 为纯代码文件；isIos=true 时调用 computePodExcludePaths（Pods/** 兜底 + 本地 :path: Pod 白名单）；getTrackedFiles/getUntrackedFiles maxBuffer=256MB 防大仓库 ENOBUFS fallback |
| `parser.js` | tree-sitter AST 解析 → symbol_key + raw_edges；CommonJS require() → imports_from 边；module 节点继承 isTestFile 标记；ObjC：.m/.mm → tree-sitter-objc，@interface/@implementation/@protocol 提取 class/interface + 方法选择器，.h ObjC 启发式路由，NS_ASSUME_NONNULL_BEGIN/END 预处理 |
| `incremental.js` | SHA256 增量检测 + fingerprints 更新（detectChangedFiles 返回 changedShas 供复用） |
| `graph.js` | upsertNodes/upsertEdges + resolveEdges 六阶段解析（直接 target_id → 精确 file_path → 相对路径解析（require('./x')＋扩展名探测）→ basename 模糊匹配（ObjC #import "file.h" 无路径，按 basename 查 module 节点，多候选取最近邻）→ 全局符号 → 同文件消歧；缓存用 Object.create(null) 防原型污染） |
| `communities.js` | 3-Pass 社区检测（Pass1 CONTAINER_DIRS、Pass2 fragmented/scattered、Pass3 最小4节点） |
| `flows.js` | PageRank + BFS 流程检测 |
| `analyze.js` | surprising_connections（spec§14.6 4因子：confidence_weight/cross_language/cross_community/peripheral_to_hub）+ god_nodes 分析 |
| `search.js` | FTS5 搜索 + rebuildFTS（独立虚表，drop-recreate 全量重建） |
| `changes.js` | git diff 风险评分（High/Medium/Low） |
| `cli/build.js` | build + stats CLI handler；自动检测 iOS 仓库（Podfile.lock/.xcodeproj）并传 isIos 给 collectInputFiles；prunedPaths 清理历史残留路径；增量构建 0 变更时保留 graph_meta.unresolved_edge_count 不归零 |
| `cli/context.js` | context 命令 |
| `cli/query.js` | `--pattern` 8种查询 FactItem 输出（callers_of/callees_of/importers_of/importees_of/dependents_of/dependencies_of/tests_for/similar_to） |
| `cli/postprocess.js` | 后处理编排（writeCommunities→detectFlows→analyzeGraph→rebuildFTS） |
| `cli/open-db.js` | 共享 DB open 工具 |
| `cli/envelope.js` | JSON 信封工厂 |
| `commands/` | 13 个子命令处理器（flows/flow/affected-flows/communities/community/architecture/surprising-connections/god-nodes/impact/large-functions/search/detect-changes/review-context） |

**JSON 契约**：`docs/contracts/crg-cli-v1.schema.json`（JSON Schema Draft 2020-12）

**测试**：`npm run test:jest`（需先 `npm install --legacy-peer-deps`）

<!-- spec-first:lang:start -->
## Language and Governance Policy (managed by spec-first)

**Language setting:** `en`

### Language Rules
- All natural language output including responses, status updates, generated documentation, review comments, and plan notes must use **English**
- Code identifiers (variables, functions, classes, modules, technical identifiers in filenames) remain in English
- New code comments use English — concise and clear
- Technical identifiers such as code, commands, paths, config keys, env var names, API names, and protocol names are never translated

### Changelog Governance
**Code Change Iron Law (No Exceptions)**
- Any addition, deletion, or modification to project source code must include a matching entry in the repo-root `CHANGELOG.md`
- If no matching entry exists, refuse to generate the code change
- Use the repository's existing changelog format
- **Example:** `- vX.Y.Z YYYY-MM-DD author: one-line summary`
- Append `(user-visible)` for user-visible changes
<!-- spec-first:lang:end -->

