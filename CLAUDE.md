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
node bin/spec-first.js init --claude --dry-run -u <name> --lang <zh|en>  # 预演 init 的 managed boundary 与写入面
node bin/spec-first.js clean --claude --dry-run                           # 预演 clean 的删除/更新边界，不改写项目文件
pnpm run release:publish -- auto --dry-run   # 按 git-npm 契约执行发布预演（支持 auto|patch|minor|major）
pnpm run release:publish -- auto             # 真实发布时会先提升 package.json version，再跑发布校验与 npm publish
# 若 `git-npm auto` 中途重试导致版本前滚，应先提交最终 version/changelog 收口，再避免重复 auto bump
# npm publish 若提示自动纠正 `bin` 或 `repository.url`，应先把这些修正落回 package.json 再重试发布
# `doctor --json` 现会把 workflow verification evidence 的真源固定到 `.spec-first/workflows/verification/<slug>/verification-evidence.json`，并显式报告 schema/freshness；`init/clean --dry-run` 也已升级为 file-level operation preview；其中 `init` 通过 `planRuntimeFilesSync` 统一 preview/apply，`clean` 也已切换到共享 runtime cleanup plan，并补齐 Codex legacy cleanup 的 dry-run 预览面
```

## 架构

### 核心模块（`src/cli/`）

| 文件/目录 | 职责 |
|---|---|
| `commands/init.js` | `spec-first init` - 基于 operation plan 同步资产到项目，统一 dry-run preview 与真实 apply，并写入 developer profile / lang policy |
| `commands/doctor.js` | 检查运行时资产完整性和一致性 |
| `commands/clean.js` | 清理 spec-first 管理的资产；运行时 cleanup 通过共享 operation plan 执行，保持 dry-run preview 与真实 apply 尽量同构 |
| `plugin.js` | 加载 `.claude-plugin/plugin.json` manifest；实现 `planBundledAssetSync`（commands/skills/agents/support files 的 plan 化复制 + 转换） |
| `adapters/claude.js` | Claude 平台适配器；负责 canonical agent name 重写（`spec-first:category:name` → bare name），并通过 `planRuntimeFilesSync` / `planRuntimeFilesRemoval` 产出 SessionStart hook 的 runtime sync / cleanup plan |
| `adapters/codex.js` | Codex 平台适配器；`workflowsRoot = skillsRoot = '.agents/skills'`（Codex 通过 `.agents/skills/` 扫描发现技能，command-backing skills 也保留在此目录），并通过 `planRuntimeFilesSync` / `planRuntimeFilesRemoval` 统一 legacy runtime sync / cleanup |
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
- **bootstrap 控制面**：`spec-graph-bootstrap` 工作流产物路径为 `.spec-first/workflows/bootstrap/<slug>/`；旧 Stage-0 bootstrap 入口已按撤役计划退场，不再作为当前可安装/可路由 workflow 资产。manifest 文件为 `artifact-manifest.json`（已从旧 `fingerprints.json` 重命名）；`spec-graph-bootstrap` Phase 4 生成的 `docs/contexts/<slug>/injection-index.yaml` 已收敛为 `always + stages + selection_rules + advice` 结构，`task_types` 字段不再生成，`output_exists.*` 规则以 `inject[]` 路径存在性为准；仓库内 `docs/contexts/spec-first/` 作为 graph-bootstrap 自举样本与测试基线纳入版本控制；`runWorkspaceBootstrap` 返回值含 `prunedChildSlugs: string[]`（成功清理的已移除 child slug）与 `failedPrunes: Array<{childSlug, error}>`（rm 失败明细），调用方据此审计 rerun 期间被 prune 或清理失败的 child 产物
- **bootstrap 数据质量信号**（2026-04-19）：`artifact-manifest.json` 的 `data_quality` 只表达事实输入质量，不表达产物是否装配完成；`evaluateContext` 只有在 `data_quality: 'fact-backed'` 且 minimal context 存在、freshness 未 stale 时才给 L0；`partial` / `mixed` 最高 L1，`empty` / `sample-backed` / `skeletal` 最高 L2，缺少 `data_quality` 的旧 manifest 降级为 L1 并给出 `fallback_reason: 'legacy_manifest_missing_quality_fields'`；`compile-minimal-context.js` 为 plan/work/review 三份 context 追加 `provenance`、`confidence`、`coverage_gaps` 元字段，供下游 skill 感知事实来源、置信度与覆盖缺口；`minimal-context.schema.json` 与 `artifact-manifest.schema.json` 同步补充质量字段；workspace 空仓库 bootstrap 正确报告 degraded，不再误给 L0；`fallback_reason` 优先暴露根因数据质量不足，其次才是 minimal context 缺失
- **Stage-0 消费接入**：`spec-plan`、`spec-work`、`spec-review` 源 skill 已接入 Stage-0 上下文预载块；消费顺序固定为 `always[] -> stages.<stage>[] -> selection_rules(output_exists.*) -> advice.<stage>`，`fact.*` 规则在 v1 显式跳过，`injection-index.yaml` 不可用时统一回退到 `00-summary.md`、`pitfalls/index.md`、`code-facts/public-entrypoints.md`、`code-facts/test-map.md`；其中 `output_exists.*` 仅按 `inject[]` 各路径是否存在决定追加，不再依赖额外 sample 路由去重
- **Stage-0 verification 合同 wording**（2026-04-19）：`spec-work` / `spec-work-beta` 源 skill + docs mirror + contract test 新增 `platform_focus` / `verification_summary` / `verifier_dispatch` / `ai_dev_quality_gate_result` / `verification_evidence` / `verification_gate_state` 条款解析指引，统一与 runtime `stage0-context` payload 字段名对齐；`verification_summary.source === 'change-surface'` 语义明示 baseline vs effective checklist 区分；contract test 新增对应 substring 断言
- **Karpathy execution-boundary delta**（2026-04-19，spec-work 侧；见 plan 004 Step 1）：`skills/spec-work/SKILL.md` + docs mirror + contract test 接入 R1-R5——Phase 1 Read Plan and Clarify 增加 `allowed change surface` 识别 / `Every changed line must trace to a plan implementation unit, task, or the current user request.` / `If multiple materially different approaches exist, state the tradeoffs before proceeding.`；Phase 2 Task Execution Loop 增加 Change discipline guardrails（`Implement the minimum code the current task requires.` + `opportunistic cleanup` 禁令 + `own-wave orphan` 清理义务，`pre-existing dead code` 不触碰）；Phase 2 Track Progress 强制 scope expansion 分类为 `required dependency` / `separate follow-up`；Simplify as You Go 补 `noticeably simpler` 收口；contract test 新增精确 wording + 语义锚点组合 + mirror 同步断言（共 6 个 test）。Step 2（`spec-work-beta` 同步）由 follow-up commit 承担
- **Karpathy execution-boundary delta**（2026-04-19，spec-work-beta 同步；plan 004 Step 2）：`skills/spec-work-beta/SKILL.md` + docs mirror + contract test 按 Precondition diff 保留 beta 有意分叉（delegation signal / Argument Parsing / `delegation_scope` 决策表 / Codex Delegation Execution Loop / Phase 2.7 Frontend Design Guidance / `--workflow spec-work-beta`），只同步 R1-R5 execution-boundary delta 至 4 个对应 section；contract test 新增 2 个 test（8 个总）覆盖精确 wording + 语义锚点组合 + mirror 同步；source 与 docs/10-prompt mirror byte-equal 同步。plan 004 至此 Step 1 + Step 2 两个 commit 闭环
- **spec-mcp-setup 飞书 MCP 集成**：`mcp-tools.json` 新增第 5 个工具 `feishu`（`category: optional`）；引入 `detect.method: mcp_key_only`——只检测 key 存在而不校验 args，用于凭据因用户不同而各异的 MCP 工具；`install-coordinator.sh/ps1` 新增 `install_feishu/Install-Feishu` 函数，交互采集 App ID/Secret 并通过 `mcp add-json` 写入配置；`verify-tools.sh/ps1` 新增 `check_mcp_key_only/Check-McpKeyOnly` 与 `check_feishu_whoami/Get-FeishuWhoami`（调 Feishu auth API 验证凭据，带超时保护），`host-setup.json` 升至 v6 格式（新增 `tools.feishu.configured/whoami` 字段）；`setup_success` 门控不变，仍只看 3 个 required 工具；可选工具（feishu）安装失败不再触发必选工具回滚，`install_feishu` 安装后新增 post-configure 验证，sh 函数末尾补充显式 `return 0`；`read` 改用 `/dev/tty` 修复 stdin 重定向导致提示静默跳过，App Secret 改为 `-s`/`-AsSecureString` 静默输入；测试补充 `feishu.configured`/`whoami` 断言与 mcp_key_only true 分支 5.3.2 fixture
- **spec-sessions skill**：`skills/spec-sessions/` 提供会话历史检索能力，入口命令 `/spec:sessions`；对应命令模板 `templates/claude/commands/spec/sessions.md`；`agents/research/` 新增 `docs-context-reader`、`feishu-chat-researcher`、`feishu-doc-reader`、`github-context-reader`、`local-doc-reader`、`session-historian`、`web-context-reader` 等研究类 agent
- **spec-brainstorm 能力升级**（2026-04-17）：`skills/spec-brainstorm/SKILL.md` 补齐 `0.1a Current Work Pulse`、`0.3a Scope Decomposition`、`3.4 Preflight Self-Check`、`3.6 User Review Gate`、`Phase 4: Handoff and Terminal State Lock`；`references/` 新增 `decomposition-capture.md` epic 模板，`requirements-capture.md` 增加分节确认 + `epic` frontmatter contract，`handoff.md` 增加 Terminal State Lock；`spec-plan` 成为 epic consumer（缺失时 warning 不阻断）；smoke 显式断言 `decomposition-capture.md` 进入 Claude/Codex runtime；integration 新增 `tests/integration/spec-brainstorm-flow.sh` 确定性 wiring check
- **using-spec-first 默认治理层**（2026-04-17）：`skills/using-spec-first/` 作为 dual-host standalone skill 固化入口治理合同——默认治理层 / 统一入口 / workflow-first（非 brainstorming-first）；`src/cli/contracts/dual-host-governance/skills-governance.json` 注册 `using-spec-first` 为 `standalone_skill` + `dual_host`（claude/codex 均以 skill 交付）；由 `tests/unit/using-spec-first-contracts.test.js` 与 `tests/unit/using-spec-first-runtime-contracts.test.js` 守护 source/runtime 两层 contract
- **spec 命令模板补齐**：新增 `templates/claude/commands/spec/debug.md`、`setup.md`、`update.md`，使 `spec-debug`、`spec-setup`、`spec-update` 在 Claude runtime 下具备对应命令入口模板
- **compound 工作流同步基线（批次 A-D）**：`spec-review`、`document-review`、`resolve-pr-feedback`、`spec-ideate`、`spec-plan`、`spec-brainstorm`、`spec-work`、`spec-work-beta`、`spec-compound`、`spec-compound-refresh` 已完成对 `compound-engineering-plugin` 核心链路批次 A-D 的同步；`work`/`work-beta` 已收口 review/testing/delegation/reference 化流程，`compound`/`compound-refresh` 已补 `docs/solutions/` discoverability 检查。`spec-plan` 当前已恢复非软件 planning 路由，补齐 `references/universal-planning.md` 与 `references/visual-communication.md`，并将 deepening 流程收敛为 auto / interactive 双模式；入口 `description`、`argument-hint` 与空输入追问也必须与该能力保持一致，避免 skill discovery 与正文 contract 漂移。`spec-plan/references/plan-handoff.md` 的 pipeline contract 已明确保持交互式 `document-review` 路线：自动化调用不得请求 `mode:headless`，调用方若不能承接交互 review，必须返回 `Interactive document-review still required before execution handoff.`。**spec-plan execution-readiness retrofit**（2026-04-17）：新增 `Execution Readiness` 质量维度、`Starting point`/`Execution note` 两个 contract 字段、execution placeholder scan 与 low-context handoff 派生层，由 `tests/unit/spec-plan-contracts.test.js` 守护。`spec-review` 当前已恢复 ce-review 的非 headless 主线 contract：interactive 默认先自动应用 `safe_auto -> review-fixer`，仅对剩余 `gated_auto` / `manual` 走 blocking question；reviewer catalog 扩展回 17 个 reviewer，补齐 `cli-readiness-reviewer` 与 PR-only 的 `previous-comments-reviewer`；Stage 4 保持 mid-tier sub-agent model tiering，Stage 5 保持 compact-return merge、cross-reviewer agreement 与 resolve disagreements 规则，并由 `tests/unit/spec-review-contracts.test.js` 守护。`spec-ideate` 已补回非 Slack 核心 dispatch contract：creative ideation sub-agents 继承当前 run 的 model / reasoning level、不得 tier down、dispatch 时省略 `mode` 参数；同时保留本地增强的 `Cap at 6 total frames`、cross-cutting synthesis 与 two-layer critique quality gate。shared commit 的最终治理口径已收敛为“`owner 定语义，file-affinity 落地`”。后续继续同步时，不要机械回退以下本地分叉：`spec-review` 当前不接入 headless；`document-review` 保留 `batch_confirm`、`Promote Residual Concerns`、`Resolve Contradictions`、`Route by Autofix Class`；`spec-compound` 保持默认 full-mode、仅在用户明确要求时进入 compact-safe；`agents/workflow/bug-reproduction-validator.md` 因上游缺失而本地保留

### Canonical Agent Name 系统

Skill/Agent 源文件统一使用 `spec-first:category:name` 作为 canonical agent name。Claude adapter 在 init 时会把 skill 内的 canonical 引用重写为 bare name（`name`），并把 Task 调用改写为宿主可执行的 bare-agent 形式；Codex adapter 会把 canonical 引用与 Task 调用重写为显式的 `.codex/agents/...` 路径，同时把共享 skill/command 路径改写到 Codex runtime 布局。

`doctor` 当前仅对 Claude runtime 检测是否残留未重写的 canonical 名称与未解析的 Task agent 引用；Codex 侧的 transform contract 主要由 unit/smoke 测试守护。

## AI 决策输入原则

始终牢记这个思想：

`轻 contract + 明确边界 + 让 LLM 决策`

在本仓库里，这不是一句口号，而是必须遵守的实现约束：

- **轻 contract**：只暴露稳定、必要、可组合的结构化事实，不把 orchestration、固定执行顺序、宿主特定流程树硬编码进 contract。
- **明确边界**：repo profile、diff recommendation、verifier dispatch、gate state、workflow prose、telemetry 各自回答各自的问题，不能越权替别的层做决策。
- **让 LLM 决策**：control plane 和 runtime 的职责是给模型提供更高质量的决策输入，提高当前任务的清晰度、相关性与可解释性，而不是过早剥夺模型的判断空间。
- **优先提高输入质量而不是增加耦合**：如果两种方案都能工作，优先选择让 LLM 拿到更干净、更真实、更贴近当前改动输入的方案，而不是选择更重、更硬编码的自动化。
- **质量提升优先来自更好的决策输入**：优先补真实上下文、provenance、freshness、confidence、fallback_reason、verification signals，而不是优先补更复杂的流转控制。
- **不要把质量门做成“多状态流转 + 强编排”的状态机**：不要为了追求表面上的确定性，引入过重的 stage transition、强绑定执行树、审批分支或策略引擎。
- **质量门应该暴露事实，不应该代替模型做流程编排**：verification summary、verifier dispatch、gate state、freshness、confidence、fallback reason 应保持独立、可组合、各司其职，而不是被压成一个大而全的 orchestration 对象。
- **判断方向是否正确的标准**：如果一个新增机制主要增加的是状态流转、耦合和固定执行路径，而不是显著提升 LLM 决策输入质量，那么它不符合本仓库的演进方向。

### CRG 模块（`src/crg/`）

`spec-first crg <subcommand>` — 内嵌 Code Review Graph Node.js 运行时，提供 17 个子命令：

| 文件 | 职责 |
|---|---|
| `cli/router.js` | 17 子命令路由 + `--repo` 路径校验 |
| `migrations.js` | better-sqlite3 schema 初始化（7 表 + FTS5） |
| `input-convergence.js` | 候选文件收敛（git ls-files + 排除链 + Pod 适配）；步骤8 EXT_TO_LANG 语言过滤保证 finalInputs 为纯代码文件；isIos=true 时调用 computePodExcludePaths（Pods/** 兜底 + 本地 :path: Pod 白名单）；getTrackedFiles/getUntrackedFiles maxBuffer=256MB 防大仓库 ENOBUFS fallback；DEFAULT_EXCLUDES 包含 `.spec-first/**`（已替换旧 `.spec-first-graph/**`）；ignore 文件为 `.spec-firstignore`（GRAPH_IGNORE_FILE 常量，已替换旧 `.spec-first-graphignore`） |
| `parser.js` | tree-sitter AST 解析 → symbol_key + raw_edges；CommonJS require() → imports_from 边；module 节点继承 isTestFile 标记；ObjC：.m/.mm → tree-sitter-objc，@interface/@implementation/@protocol 提取 class/interface + 方法选择器，.h ObjC 启发式路由，NS_ASSUME_NONNULL_BEGIN/END 预处理 |
| `incremental.js` | SHA256 增量检测 + fingerprints 更新（detectChangedFiles 返回 changedShas 供复用） |
| `graph.js` | upsertNodes/upsertEdges + resolveEdges 六阶段解析（直接 target_id → 精确 file_path → 相对路径解析（require('./x')＋扩展名探测，扩展名列表含 `.js/.cjs/.mjs/.ts/.tsx/.jsx/.d.ts/index.ts/index.tsx`）→ basename 模糊匹配（ObjC #import "file.h" 无路径，按 basename 查 module 节点，多候选取最近邻）→ 全局符号 → 同文件消歧；缓存用 Object.create(null) 防原型污染） |
| `communities.js` | 3-Pass 社区检测（Pass1 CONTAINER_DIRS、Pass2 fragmented/scattered、Pass3 最小4节点）；密度分母为无向口径 `n*(n-1)/2`（moduleEdges 已去重），D_THRESHOLD=0.6；Pass3 带空边集保护：至少存在一个 size>=2 连通分量才拆分，否则保留父社区并标 `health_note`，避免配置/i18n/DTO 目录被切成单点子社区 |
| `flows.js` | PageRank + BFS 流程检测；entry 查询加 `ORDER BY id ASC` 保证 100 条 flow 截断的确定性 |
| `analyze.js` | surprising_connections（spec§14.6 4因子：confidence_weight/cross_language/cross_community/peripheral_to_hub）；F3 `cross_community` 独立加 40 分并解除对 F2/F4 的门控（纯跨社区调用不再被 0 分过滤），过滤阈值 40；in_degree 与 god_nodes LEFT JOIN 均过滤 `imports_from/contains/defined_in` 结构边，消除 contains 污染 |
| `search.js` | FTS5 搜索 + rebuildFTS（独立虚表，drop-recreate 全量重建） |
| `changes.js` | git diff 风险评分（High/Medium/Low） |
| `cli/build.js` | build + stats CLI handler；自动检测 iOS 仓库（Podfile.lock/.xcodeproj）并传 isIos 给 collectInputFiles；prunedPaths 清理历史残留路径；增量构建 0 变更时保留 graph_meta.unresolved_edge_count 不归零 |
| `cli/context.js` | context 命令 |
| `cli/query.js` | `--pattern` 8种查询 FactItem 输出（callers_of/callees_of/importers_of/importees_of/dependents_of/dependencies_of/tests_for/similar_to） |
| `cli/postprocess.js` | 后处理编排（writeCommunities→detectFlows→analyzeGraph→rebuildFTS） |
| `cli/open-db.js` | 共享 DB open 工具 |
| `cli/envelope.js` | JSON 信封工厂 |
| `artifact-paths.js` | 集中路径解析模块；纯函数，无 I/O；导出 resolveGraphDir/Db/InputFingerprints（→ `.spec-first/graph/`）、resolveWorkflowArtifactDir（→ `.spec-first/workflows/<wf>/<slug>/`，支持 `artifactAnchorRoot` 选项用于 workspace/child 锚定）、resolveContextDocsDir（→ `docs/contexts/<slug>/`，同样支持 `artifactAnchorRoot`）及 R4 文件名常量（GRAPH_INPUT_FINGERPRINTS_FILE / BOOTSTRAP_ARTIFACT_MANIFEST_FILE / GRAPH_IGNORE_FILE）；todos 持久工作项目录（→ `docs/todos/`，VCS 资产，todo-create/triage/resolve 共享） |
| `commands/` | 13 个子命令处理器（flows/flow/affected-flows/communities/community/architecture/surprising-connections/god-nodes/impact/large-functions/search/detect-changes/review-context） |
| `chunking.js` | 语义分块：按 symbol 边界切分代码为 chunk，供 retrieval 向量化 |
| `retrieval/` | 语义检索层：向量编码、ANN 索引（HNSW）、混合搜索（BM25 + 向量）、重排 |
| `generations/` | LLM 生成层：prompt 组装、上下文裁剪、输出解析 |

**顶层模块**：
| 目录 | 职责 |
|---|---|
| `src/context-routing/` | 跨工作流上下文路由：解析 injection-index.yaml、按阶段/输出存在性选择注入文件；含 `workspace-loader.js`（workspace/child 分层加载，freshness 聚合支持 healthy/fresh 等价判定）、`entry-resolver.js`（入口查询；`chooseMatchedChildren` 的 targetPath/cwd/changedFiles 按 `workspaceRoot` 锚点解析相对路径，避免相对 changedFiles 静默 miss）、`evaluator.js`、`loader.js`、`telemetry.js` |
| `src/bootstrap-compiler/` | bootstrap 产物编译器：将 Phase 0–4 产物编译为 Stage-0 可消费的标准化上下文包；支持 workspace/child control-plane、overview 发布、workspace telemetry、child 产物锚定读取与 batch rollback；包含 `workspace-registry.js` 注册表、`workspace-compiler.js` 编译器、`run-bootstrap.js` 编排与 `rollback.js` 回滚 |

**JSON 契约**：`docs/contracts/crg-cli-v1.schema.json`（JSON Schema Draft 2020-12）；`docs/contracts/` 目录集中存放所有 CLI/API 契约 Schema

**测试**：`npm run test:jest`（需先 `npm install --legacy-peer-deps`）；`npm run test:unit` 现额外串行执行 `tests/unit/spec-graph-bootstrap-contracts.test.js`，覆盖 Stage-0 injection-index 契约与 fact/risk 字段的 `updated_at` 要求；新增 benchmark smoke、context-routing evaluator、semantic rerank、workflow telemetry、Stage-0 freshness 等 13 个单元测试

**CI**：`.github/workflows/crg-quality-gate.yml` 为 CRG 质量门禁 workflow

**已移除 skill**：`dhh-rails-style`（迁至宿主侧独立 skill）、`slfg`（废弃）

<!-- spec-first:lang:start -->
## 语言与治理策略（由 spec-first 管理）

**语言设置：** `中文`

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

<!-- spec-first:bootstrap:start -->
## Workflow 入口治理（由 spec-first 管理）

- 当前项目已安装 `using-spec-first`
- 开始 substantial work 前，先按 `using-spec-first` 做 workflow 判定
- Claude workflow 入口使用 `/spec:*`
- 不要把 `using-spec-first` 本身当作 command-backed workflow
<!-- spec-first:bootstrap:end -->
