# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

`spec-first` 是一个 Node.js CLI 工具，将 workflow 资产（skills、agents、commands）安装并管理到用户项目的 `.claude/` 或 `.codex/` 目录中。源码在 `src/cli/`，可发布资产在 `skills/`、`agents/`、`templates/`，生成的运行时副本（`.claude/`、`.codex/`）是输出，不是源码。`docs/solutions/` 存放按分类组织的问题解决文档与 workflow patterns，带 YAML frontmatter（如 `module`、`tags`、`problem_type`）；在已覆盖的领域做实现、排障或决策时，应优先检索这里。

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
| `adapters/codex.js` | Codex 平台适配器；`workflowsRoot = skillsRoot = '.agents/skills'`（Codex 通过 `.agents/skills/` 扫描发现技能，command-backing skills 也保留在此目录）|
| `lang-policy.js` | 幂等地将语言/治理策略注入 `CLAUDE.md` 或 `AGENTS.md`（用 `<!-- spec-first:lang:* -->` 标记管理） |
| `developer.js` | 解析 developer identity（git 用户名、lang、initialized_at）；读写 `.developer` 文件 |
| `state.js` | 读写 `.claude/spec-first/state.json`；用于增量同步时识别废弃资产；托管字段含 `commands/skills/workflowSkills/agents/agentSupportFiles`，写入与读取均经 `validateManagedStateShape` 校验 |

### 资产结构

- **`skills/`** — 每个 skill 是一个目录，入口为 `SKILL.md`；init 时整目录复制到 `.claude/skills/`（command-backing skills 同时复制到 `.claude/spec-first/workflows/`）；所有 command-backing skill 目录名须有 `spec-` 前缀（如 `spec-mcp-setup`）以保证 `rewriteSkillName` 后的名称与源文件 `name:` 字段一致
- **`agents/`** — 子目录下的 `.md` 文件；`agents/review/`、`agents/design/` 等分类
- **`templates/claude/commands/spec/`** — 命令模板文件；init 时复制到 `.claude/commands/spec/`
- **`vendor/tree-sitter-objc/`** — 受控 ObjC parser 包（从上游 tree-sitter-objc fork，收敛 peerDependency 到 `>=0.21.0`），通过 `file:` 协议引用
- **`vendor/tree-sitter-swift/`** — 受控 Swift parser 包（从上游 tree-sitter-swift fork，移除 tree-sitter-cli 安装期依赖，收敛 peerDependency 到 `>=0.21.0`），通过 `file:` 协议引用
- **`.claude-plugin/plugin.json`** — plugin manifest，声明 commands 列表和目录映射
- **bootstrap 控制面**：`spec-bootstrap` / `spec-graph-bootstrap` 工作流产物路径为 `.spec-first/workflows/bootstrap/<slug>/`（已从旧 `.context/spec-first/bootstrap/<slug>/` 迁移）；manifest 文件为 `artifact-manifest.json`（已从旧 `fingerprints.json` 重命名）；`spec-graph-bootstrap` Phase 4 生成的 `docs/contexts/<slug>/injection-index.yaml` 已收敛为 `always + stages + selection_rules + advice` 结构，`task_types` 字段不再生成，`output_exists.*` 规则以 `inject[]` 路径存在性为准；仓库内 `docs/contexts/spec-first/` 作为 graph-bootstrap 自举样本与测试基线纳入版本控制
- **Stage-0 消费接入**：`spec-plan`、`spec-work`、`spec-review` 源 skill 已接入 Stage-0 上下文预载块；消费顺序固定为 `always[] -> stages.<stage>[] -> selection_rules(output_exists.*) -> advice.<stage>`，`fact.*` 规则在 v1 显式跳过，`injection-index.yaml` 不可用时统一回退到 `00-summary.md`、`pitfalls/index.md`、`code-facts/public-entrypoints.md`、`code-facts/test-map.md`；其中 `output_exists.*` 仅按 `inject[]` 各路径是否存在决定追加，不再依赖额外 sample 路由去重
- **spec-mcp-setup 飞书 MCP 集成**：`mcp-tools.json` 新增第 5 个工具 `feishu`（`category: optional`）；引入 `detect.method: mcp_key_only`——只检测 key 存在而不校验 args，用于凭据因用户不同而各异的 MCP 工具；`install-coordinator.sh/ps1` 新增 `install_feishu/Install-Feishu` 函数，交互采集 App ID/Secret 并通过 `mcp add-json` 写入配置；`verify-tools.sh/ps1` 新增 `check_mcp_key_only/Check-McpKeyOnly` 与 `check_feishu_whoami/Get-FeishuWhoami`（调 Feishu auth API 验证凭据，带超时保护），`host-setup.json` 升至 v6 格式（新增 `tools.feishu.configured/whoami` 字段）；`setup_success` 门控不变，仍只看 3 个 required 工具；可选工具（feishu）安装失败不再触发必选工具回滚，`install_feishu` 安装后新增 post-configure 验证，sh 函数末尾补充显式 `return 0`；`read` 改用 `/dev/tty` 修复 stdin 重定向导致提示静默跳过，App Secret 改为 `-s`/`-AsSecureString` 静默输入；测试补充 `feishu.configured`/`whoami` 断言与 mcp_key_only true 分支 5.3.2 fixture
- **spec-sessions skill**：`skills/spec-sessions/` 提供会话历史检索能力，入口命令 `/spec:sessions`；对应命令模板 `templates/claude/commands/spec/sessions.md`；`agents/research/` 新增 `docs-context-reader`、`feishu-chat-researcher`、`feishu-doc-reader`、`github-context-reader`、`local-doc-reader`、`session-historian`、`web-context-reader` 等研究类 agent
- **compound 工作流同步基线（批次 A-D）**：`spec-review`、`document-review`、`resolve-pr-feedback`、`spec-ideate`、`spec-plan`、`spec-brainstorm`、`spec-work`、`spec-work-beta`、`spec-compound`、`spec-compound-refresh` 已完成对 `compound-engineering-plugin` 核心链路批次 A-D 的同步；`work`/`work-beta` 已收口 review/testing/delegation/reference 化流程，`compound`/`compound-refresh` 已补 `docs/solutions/` discoverability 检查。`spec-plan/references/plan-handoff.md` 的 pipeline contract 已明确保持交互式 `document-review` 路线：自动化调用不得请求 `mode:headless`，调用方若不能承接交互 review，必须返回 `Interactive document-review still required before execution handoff.`。`spec-ideate` 已补回非 Slack 核心 dispatch contract：creative ideation sub-agents 继承当前 run 的 model / reasoning level、不得 tier down、dispatch 时省略 `mode` 参数；同时保留本地增强的 `Cap at 6 total frames`、cross-cutting synthesis 与 two-layer critique quality gate。shared commit 的最终治理口径已收敛为“`owner 定语义，file-affinity 落地`”。后续继续同步时，不要机械回退以下本地分叉：`spec-review` 当前不接入 headless；`document-review` 保留 `batch_confirm`、`Promote Residual Concerns`、`Resolve Contradictions`、`Route by Autofix Class`；`spec-compound` 保持默认 full-mode、仅在用户明确要求时进入 compact-safe；`agents/workflow/bug-reproduction-validator.md` 因上游缺失而本地保留

### Canonical Agent Name 系统

Skill/Agent 源文件统一使用 `spec-first:category:name` 作为 canonical agent name。Claude adapter 在 init 时会把 skill 内的 canonical 引用重写为 bare name（`name`），并把 Task 调用改写为宿主可执行的 bare-agent 形式；Codex adapter 会把 canonical 引用与 Task 调用重写为显式的 `.codex/agents/...` 路径，同时把共享 skill/command 路径改写到 Codex runtime 布局。

`doctor` 当前仅对 Claude runtime 检测是否残留未重写的 canonical 名称与未解析的 Task agent 引用；Codex 侧的 transform contract 主要由 unit/smoke 测试守护。

### CRG 模块（`src/crg/`）

`spec-first crg <subcommand>` — 内嵌 Code Review Graph Node.js 运行时，提供 17 个子命令：

| 文件 | 职责 |
|---|---|
| `cli/router.js` | 17 子命令路由 + `--repo` 路径校验 |
| `migrations.js` | better-sqlite3 schema 初始化（7 表 + FTS5） |
| `input-convergence.js` | 候选文件收敛（git ls-files + 排除链 + Pod 适配）；步骤8 EXT_TO_LANG 语言过滤保证 finalInputs 为纯代码文件；isIos=true 时调用 computePodExcludePaths（Pods/** 兜底 + 本地 :path: Pod 白名单）；getTrackedFiles/getUntrackedFiles maxBuffer=256MB 防大仓库 ENOBUFS fallback；DEFAULT_EXCLUDES 包含 `.spec-first/**`（已替换旧 `.spec-first-graph/**`）；ignore 文件为 `.spec-firstignore`（GRAPH_IGNORE_FILE 常量，已替换旧 `.spec-first-graphignore`） |
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
| `artifact-paths.js` | 集中路径解析模块；纯函数，无 I/O；导出 resolveGraphDir/Db/InputFingerprints（→ `.spec-first/graph/`）、resolveWorkflowArtifactDir（→ `.spec-first/workflows/<wf>/<slug>/`）、resolveContextDocsDir（→ `docs/contexts/<slug>/`）及 R4 文件名常量（GRAPH_INPUT_FINGERPRINTS_FILE / BOOTSTRAP_ARTIFACT_MANIFEST_FILE / GRAPH_IGNORE_FILE）；todos 持久工作项目录（→ `docs/todos/`，VCS 资产，todo-create/triage/resolve 共享） |
| `commands/` | 13 个子命令处理器（flows/flow/affected-flows/communities/community/architecture/surprising-connections/god-nodes/impact/large-functions/search/detect-changes/review-context） |

**JSON 契约**：`docs/contracts/crg-cli-v1.schema.json`（JSON Schema Draft 2020-12）

**测试**：`npm run test:jest`（需先 `npm install --legacy-peer-deps`）；`npm run test:unit` 现额外串行执行 `tests/unit/spec-graph-bootstrap-contracts.test.js`，覆盖 Stage-0 injection-index 契约与 fact/risk 字段的 `updated_at` 要求

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
