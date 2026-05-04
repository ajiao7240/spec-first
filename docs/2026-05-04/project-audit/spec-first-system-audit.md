# spec-first 系统级质量审查报告

审查日期：2026-05-04

审查对象：当前 `spec-first` worktree，分支 `leo-2026-05-04-graph-bootstrap-update`

审查边界：本报告只做系统级审查与修复计划编译。`docs/10-prompt/全面项目审查.md` 明确禁止在审查阶段修改代码；因此本次未进入 P0/P1 修复实现阶段。

## 1. 结论先行

整体判断：`spec-first` 已经不是 prompt collection，而是一个成型的 AI engineering workflow harness。它的 source/runtime 边界、双宿主投递、workflow skill 治理、graph readiness、task-pack、app audit 和 review/knowledge 闭环都有真实代码和测试支撑。当前成熟度可评为 **beta-quality 工程系统**：适合团队试点和受控引入，距离开源推广的稳定版还差一轮质量门禁、文档信息架构和异常场景收敛。

最大优势：项目的主线理念与代码结构基本一致。`package.json:9-25` 暴露克制的 CLI 面；`src/cli/adapters/claude.js:18-47` 与 `src/cli/adapters/codex.js:12-57` 明确双宿主 runtime 位置；`src/cli/contracts/dual-host-governance/skills-governance.json:39-455` 将 workflow command、standalone skill、internal-only skill 分开；`.gitignore:31-50` 将 generated runtime 与 `.spec-first` runtime facts 排除出 source。

最大风险：主测试链路当前不能稳定证明质量。`package.json:16` 的 `test:unit` 运行 `npx jest tests/unit --runInBand`，但仓库没有 Jest ignore 配置排除 `.worktrees/`；`.gitignore:27` 只让 Git 忽略 `.worktrees/`，不能约束 Jest。当前 checkout 内存在 `.worktrees/spec-standards-2026-05-04/tests/unit/package-install-contracts.test.js`，导致 `tests/unit/package-install-contracts.test.js:71-95` 的 npm pack bytecode 测试被重复发现并竞争同一 `skills/spec-release-notes/scripts/__pycache__` 路径。已执行的 `npm run test:unit` 因此失败：155 suites 中 2 个 package-install-contracts 测试失败，808/810 tests 通过。这是 **P0 / S1**，因为它破坏主质量门禁和发布信任。

方向性问题：未发现 S0。当前方向符合 `Light contract + Explicit boundaries + Scripts prepare, LLM decides`。需要守住的是：不要把 graph-bootstrap 做回内置 graph engine，不要把 skill 流程做成强状态机，不要让 runtime facts 进入 repo-profile 或 source truth。

过度设计风险：存在局部 S2。历史 CRG 文档、`lfg` internal skill、App audit 的多层产物与大量历史方案文档，给新维护者制造概念噪音。当前治理文件将 `lfg` 标为 internal-only（`skills-governance.json:127-135`），所以不是公开入口错误，但仍需要 legacy/internal 标识和文档分层。

代码质量风险：除 P0 测试隔离外，主要是外部命令无 timeout。`src/cli/commands/doctor.js:116-138`、`src/cli/developer.js:265-269`、`skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh:497-523` 均使用同步外部命令或 provider command，缺少 timeout 边界。相比之下 `skills/spec-mcp-setup/scripts/install-mcp.sh:24` 已有阶段 timeout 变量，说明项目已经接受 timeout 作为 deterministic guardrail。

是否适合团队使用：适合在懂 source/runtime 边界的团队中试点；不适合在没有维护者陪伴的企业环境中直接大规模推广，原因是 docs 历史层太厚、主测试链路当前失败、多仓 graph/provider 降级场景仍需要更强测试。

是否适合开源推广：README 已能说明价值和 quickstart（`README.zh-CN.md` 的 quickstart 与完整流程），但当前 `src/cli/index.js:129-149` help 输出混用 emoji/中文符号和英文说明，且文档目录有大量历史设计输入，开源新用户会难以区分“当前可用能力”和“历史方案”。

下一阶段最应该优先修复：

| 优先级 | 数量 | 主题 |
|---|---:|---|
| P0 | 1 | 修复 Jest/worktree 测试隔离，恢复 `npm run test:unit` 可作为主质量门禁 |
| P1 | 7 | 外部命令 timeout、Graph provider 执行边界、文档历史层归档、schema validator 边界、worktree source truth、Windows/PowerShell parity、app audit 端到端验证 |
| P2 | 10 | CLI i18n/UX、skill token budget、legacy internal skill 降噪、changelog 可读性、docs taxonomy、provider heuristic eval、cost telemetry 等 |

## 2. 项目定位与目标一致性审查

| 维度 | 当前事实 | 判断 | 风险 | 建议 |
|---|---|---|---|---|
| Workflow-first 定位 | README 将问题定义为软件生命周期编排；`README.zh-CN.md` 展示 `mcp-setup -> graph-bootstrap -> brainstorm -> plan -> work -> review -> compound` | 一致 | S3：英文/中文入口仍有部分体验不一致 | 保持 README 主线，补“当前能力 vs 历史方案”导读 |
| Light contract | CLI root 只有 `doctor/init/clean/tasks/startup-reminder`，见 `src/cli/index.js:28-55` | 一致 | S2：App audit artifact contract 较厚 | 对厚 contract 标明适用场景和最小消费面 |
| Explicit boundaries | `.gitignore:31-50` 明确 generated runtime 与 runtime facts；adapter 分离 Claude/Codex | 一致 | S1：当前 worktree 有 tracked 文档删除与未跟踪 ECC 目录并存 | 将 ECC 文档移动纳入 source truth 或撤销未跟踪漂移 |
| Scripts prepare, LLM decides | App audit scripts 输出 candidate/confirmed gate；`validate-artifacts.js:52-54` 要求 script artifact stay candidate | 一致 | S2：少量脚本承担 heuristic 判断过多，如 GitNexus probe token | 将 heuristic 输出标为 advisory，并扩大 eval coverage |
| Code graph / provider evidence | mcp-setup 写 provider config，graph-bootstrap 编译 provider status | 一致 | S1：provider command 无 timeout | 为 bootstrap provider run 增加 timeout 与 reason_code |
| Preview-first | app audit report-only 禁写，`audit-utils.js:218-221` | 局部一致 | S2：init/clean 是直接写 runtime，但属于明确命令授权 | 保持 init/clean 明确命令边界，文档继续强调 source-first |
| Knowledge loop | compound/compound-refresh、docs/solutions、sessions/slack-research 形成知识层 | 一致 | S2：docs/solutions 与历史 docs 缺 freshness 标记 | 增加 docs lifecycle/taxonomy 规则 |

## 3. 全流程闭环审查

| 节点 | 当前实现证据 | 是否闭合 | 主要问题 | 风险 |
|---|---|---:|---|---|
| Codebase | GitNexus index 当前可查询；`rg --files` 盘点约 1156 项，`find src bin scripts skills tests docs -type f` 为 1076 项 | 是 | 大仓/多仓场景仍依赖 shell resolver 与 provider readiness | S2 |
| Graph | `skills/spec-mcp-setup/scripts/write-provider-config.sh:57-60` 写 `graph-providers.json/runtime-capabilities.json/provider-artifacts.json` | 是 | provider bootstrap run 无 timeout | S1 |
| Spec | `docs/brainstorms/`、`docs/plans/`、`docs/tasks/` 已有稳定目录 | 是 | 历史方案与当前方案混放 | S2 |
| Brainstorm | `skills/spec-brainstorm/SKILL.md`，workflow governance 标为 command | 是 | 需要更清楚说明何时不进入 brainstorm | S3 |
| Plan | `skills/spec-plan/SKILL.md` 与 plan docs | 是 | plan 历史量大，freshness 需要更强标识 | S2 |
| Tasks | `src/cli/commands/tasks.js` 提供 hash/validate；`src/cli/task-pack.js` 负责 deterministic handoff | 是 | 任务质量仍由 LLM 判断，文档需要持续强调 | S3 |
| Work/Code | `skills/spec-work/SKILL.md`、`spec-work-beta` | 是 | beta delegation 与普通 work 边界需要在 README 中更显眼 | S3 |
| Review | `skills/spec-code-review/SKILL.md`、`spec-doc-review`、`spec-app-consistency-audit` | 是 | code-review 完整能力依赖 subagent，当前 Codex 调用规则需避免未经授权派生 | S2 |
| Knowledge | `skills/spec-compound/SKILL.md`、`spec-compound-refresh`、`docs/solutions/` | 是 | 解决方案文档缺 stale/active lifecycle | S2 |

当前闭环没有断链，但 **质量门禁断裂**：`npm run test:unit` 失败会让 Review -> Knowledge 之后的 release 信任无法闭合。

## 4. Skill 体系审查

治理事实：当前 source 中有 41 个 `skills/*/SKILL.md`；20 个 Claude command 模板在 `templates/claude/commands/spec/`；`skills-governance.json` 将公开 workflow、standalone skill、internal-only skill 分开。

| Skill | 当前定位 | 输入 | 输出 | 上游依赖 | 下游消费者 | 当前问题 | 风险等级 | 优化建议 |
|---|---|---|---|---|---|---|---|---|
| using-spec-first | 入口治理 meta skill | 用户意图、当前 host、项目上下文 | 推荐/路由到公开 workflow | AGENTS/CLAUDE managed block | 全部 workflow | 自身不是 workflow，但容易被误写成命令 | S2 | 继续用 lint 锁定不出现 `/spec:using-spec-first` |
| spec-mcp-setup | Required harness runtime setup | host、repo target、tool config | `.spec-first/config/*.json`、setup summary | detect-host、resolve-project-target | graph-bootstrap、downstream skills | 写 provider config 脚本较大，heuristic 密集 | S2 | 拆 helper 并扩充 provider projection tests |
| spec-graph-bootstrap | Graph readiness compiler | provider config/runtime facts | `.spec-first/graph/*`、impact capabilities | mcp-setup outputs | code-review/work/debug/app audit | provider command 无 timeout | S1 | 增加 timeout、reason_code、log truncation schema |
| spec-ideate | 想法生成与评估 | 主题、约束、上下文 | idea/options 文档或会话输出 | user prompt | brainstorm/plan | 与 brainstorm 边界靠 prose 维持 | S3 | 在 README 增加 ideate vs brainstorm 判定表 |
| spec-brainstorm | WHAT 澄清与 requirements brief | 模糊需求 | `docs/brainstorms/*-requirements.md` | using-spec-first | plan/doc-review | 当前合理 | S3 | 保持不作为万能入口 |
| spec-doc-review | 文档审查 | requirements/plan/task/doc | findings、open questions | docs artifacts | plan/work | synthesis 状态机较复杂 | S2 | 保留复杂度但将 chain 规则收敛到 reference |
| spec-plan | HOW 规划 | requirements、目标、上下文 | `docs/plans/*-plan.md` | brainstorm/doc-review | write-tasks/work | 历史 plan 多，freshness 易混 | S2 | plan frontmatter 加 active/superseded 指引 |
| spec-write-tasks | standalone task-pack 编译 | settled plan | `docs/tasks/*-tasks.md`、task pack | plan | work | 入口不是 `$spec-*`，用户可能困惑 | S3 | README 继续强调 standalone skill |
| spec-work | 执行 workflow | plan/task/明确任务 | 代码、测试、验证说明 | plan/tasks | code-review/compound | 大任务可能过载 | S2 | 明确 oversized handoff 到 plan/write-tasks |
| spec-work-beta | delegation beta | 可拆分任务 | 代码和 worker 汇总 | work/task pack | review | beta 风险高 | S2 | 默认不推荐，需显式 opt-in |
| spec-debug | bug/失败根因 | 错误、日志、复现步骤 | root cause、fix、验证 | tests/runtime | work/review | 当前合理 | S3 | 保持先复现再修 |
| spec-optimize | metric-driven optimization | 可测指标、实验空间 | measurement、experiments、best result | tests/benchmarks | work/review | 成本易上升 | S2 | 强制 metric gate 和实验上限 |
| spec-polish-beta | UI/browser polish | running app、目标页面 | 视觉/交互修复建议或变更 | dev server/browser | work/review | beta，需要 browser availability | S3 | 继续保持 beta 标识 |
| spec-code-review | diff/PR 代码审查 | branch/PR/base | findings、safe_auto/residual | git diff、AGENTS、tests | work/PR | 依赖 subagents；当前会话规则不允许未授权派生 | S2 | 明确单代理 fallback 与 report-only 路径 |
| spec-app-consistency-audit | 移动 App 静态一致性审查 | PRD/Figma/source/task/runtime facts | `.spec-first/app-audit/runs/<run-id>/` | app inputs、rule packs | code-review/work | 产物协议厚，orchestration 仍多靠 LLM | S2 | 增端到端 headless fixture |
| spec-compound | 知识沉淀 | 已解决问题 | `docs/solutions/*` | work/debug/review | future sessions | 当前合理 | S3 | 输出需带 freshness trigger |
| spec-compound-refresh | 知识刷新 | stale docs/solutions | 更新/合并/删除方案 | compound docs | future sessions | 需要防止顺手大清理 | S3 | 要求 scope-limited refresh |
| spec-sessions | 历史会话研究 | 会话查询 | research digest | session inventory/extract | plan/debug | internal helper 边界已清楚 | S3 | 保持不暴露 inventory/extract |
| spec-slack-research | Slack 组织上下文 | 查询主题 | digest | Slack/search tools | plan/brainstorm | 外部工具可用性不稳定 | S3 | 输出必须标注来源限制 |
| spec-skill-audit | skill 质量审计 | skill target/scope | audit report | skills/governance | skill evolution | 当前合理 | S3 | 继续用 contract/eval fixtures 锁定 |
| spec-update | 更新/runtime repair | host runtime state | upgrade guidance/init refresh | CLI runtime state | all workflows | startup reminder host 行为复杂 | S2 | 保持只读 reminder，不自动升级 |
| spec-release-notes | 发布摘要 | version/release query | changelog digest | CHANGELOG | users/maintainers | CHANGELOG 体量大 | S2 | 增加按版本范围/主题过滤 |
| agent-native-architecture | internal architecture lens | 架构问题 | 内部分析 | workflow caller | work/review | internal-only 清晰 | S3 | 不暴露用户入口 |
| agent-native-audit | internal audit lens | 审计目标 | 内部 findings | workflow caller | review | internal-only 清晰 | S3 | 保持内部 |
| changelog | internal changelog helper | diff/summary | changelog entry | work/release | CHANGELOG | 依赖 host developer profile | S3 | 继续要求 `.developer` |
| feature-video | internal visual helper | feature context | video artifact guidance | polish/docs | docs | 范围偏旁路 | S3 | 若长期不用可归档 |
| frontend-design | internal design helper | UI task | design review | polish/work | UI work | 与外部 frontend skill 可能重叠 | S3 | 明确只作内部 lens |
| gemini-imagegen | internal image helper | image prompt | generated image | docs/marketing | assets | 外部 API 风险 | S3 | 保持 opt-in |
| git-clean-gone-branches | internal git maintenance | branch state | cleanup plan/action | git | maintainer | 有副作用 | S2 | 只在显式请求下使用 |
| git-commit | internal git helper | staged diff | commit | work | repo history | 有副作用 | S2 | 保持 explicit commit request |
| git-commit-push-pr | internal PR helper | branch/diff | PR/description | work/review | GitHub | push/PR 外部副作用 | S2 | 继续禁止自动 PR |
| git-worktree | internal workspace helper | branch/path | worktree | review/work | developer | 可能制造 test discovery 风险 | S2 | worktree 路径必须被 tests 忽略 |
| lfg | internal autonomous workflow | task/review residuals | autonomous execution | review/work | internal | 强自动化/状态机风格与 light contract 有张力 | S2 | 标注 legacy/internal，避免主文档推荐 |
| proof | internal verification helper | claim/test target | proof summary | work/review | reviewer | 当前合理 | S3 | 保持 evidence-only |
| report-bug | internal issue helper | bug report | issue draft | debug | tracker | 外部副作用 | S3 | 显式确认后外发 |
| resolve-pr-feedback | internal PR feedback helper | PR comments | fixes/summary | code-review | PR | 可能越权改动 | S2 | 要求 target scope 和 verification |
| spec-dhh-rails-style | internal style lens | Rails-like design question | opinionated guidance | work/plan | developers | 领域窄 | S3 | 保持 optional lens |
| spec-session-inventory | internal helper | session dirs | inventory facts | spec-sessions | spec-sessions | 已正确 internal-only | S3 | 不暴露入口 |
| spec-session-extract | internal helper | session file | session skeleton | spec-sessions | spec-sessions | 已正确 internal-only | S3 | 不暴露入口 |
| test-browser | internal testing helper | URL/app | browser test notes | polish/work | reviewer | 外部 browser 依赖 | S3 | 仅在 browser task 使用 |
| test-xcode | internal testing helper | Xcode/iOS target | test notes | app work | reviewer | 平台依赖强 | S3 | 明确 macOS-only |

## 5. 文档体系审查

| 文档路径 | 当前作用 | 是否过时 | 与代码不一致点 | 风险 | 修复建议 |
|---|---|---:|---|---|---|
| `README.md` / `README.zh-CN.md` | 开源入口与 quickstart | 否 | 快速开始与 CLI/init 基本一致 | S3 | 增“当前能力 vs 历史方案”导读 |
| `AGENTS.md` / `CLAUDE.md` | host 项目入口 | 否 | source/runtime 边界与 adapter 一致 | S3 | 保持 managed block 自动生成 |
| `docs/10-prompt/结构化项目角色契约.md` | 演化判断 source of truth | 否 | 与 AGENTS 基线一致 | S3 | 新架构决策继续先读 |
| `docs/10-prompt/全面项目审查.md` | 本次审查 prompt | 否 | 与任务目标一致，但和 active goal 的“自动修复”有冲突 | S2 | 审查与修复阶段显式拆分 |
| `docs/05-用户手册/` | 用户手册 | 局部 | 手册覆盖 graph/app audit，但入口较多 | S2 | 加“首次使用最短路径”和 troubleshooting |
| `docs/02-架构设计/` | 架构方案 | 部分历史 | 包含旧 CRG、ECC、规范建设等多代方案 | S2 | 增 `active/archived/superseded` 索引 |
| `docs/03-实施方案/` | 方案落地文档 | 部分历史 | 旧 task/write-task 方案与当前代码需要读者自行判断 | S2 | 每篇加 status/frontmatter |
| `docs/brainstorms/` | requirements brief | 否 | 与 workflow 输出一致 | S3 | 加 freshness/linked plan 规则 |
| `docs/plans/` | execution plans | 部分历史 | 大量历史 plan 未标 superseded | S2 | 加 plan lifecycle index |
| `docs/tasks/` | task packs | 否 | task CLI 已有 hash/validate | S3 | README 链接到 validator |
| `docs/solutions/` | durable learnings | 否 | 与 compound/refresh 对齐 | S2 | 加 stale refresh trigger |
| `docs/validation/` | 验证/审查记录 | 部分历史 | 旧 CRG 文档仍描述 `src/crg` 时代 | S2 | 归档旧报告，标明历史背景 |
| `docs/spec-graph-bootstrap-flow.md` | graph-bootstrap 流程说明 | 局部 | 文档中已指出旧 CRG 口径不适用当前 JS 主链 | S2 | 将这类“澄清文档”提升为 graph current-state |
| `docs/09-业界借鉴/` / `docs/业界分析/` | 外部借鉴 | 可能历史 | 与当前代码关系弱 | S3 | 从用户手册导航中降权 |
| `docs/项目审查/` / `docs/项目介绍/` | 历史审查/介绍 | 部分历史 | 包含旧 src/crg 深度审查 | S2 | 统一迁入 archive 或加历史标签 |
| `skills/*/SKILL.md` | workflow/source skill | 否 | 通过 governance/lint 管理 | S3 | 继续以 source 为准，不手改 runtime |
| `docs/10-prompt/skills/*` | prompt/skill 镜像或评审输入 | 局部 | 与 source skill 可能漂移 | S2 | 明确是否为 source、snapshot 或 prompt input |

## 6. 代码质量审查

| 文件路径 | 问题类型 | 具体问题 | 证据 | 影响 | 严重级别 | 修复建议 |
|---|---|---|---|---|---|---|
| `package.json` + `.worktrees/` | 测试隔离 | Jest 会发现 ignored worktree 内重复测试 | `package.json:16`、`.gitignore:27`、`.worktrees/.../package-install-contracts.test.js` | 主 unit gate 失败 | S1 | 加 `jest.config.js` 或 CLI ignore `.worktrees/`、`.agents/`、runtime dirs |
| `tests/unit/package-install-contracts.test.js` | 测试副作用 | 两份测试写同一 `skills/spec-release-notes/scripts/__pycache__` | `tests/unit/package-install-contracts.test.js:71-95` | 并发/重复发现时竞争 npm pack | S1 | 用 test temp dir 或 unique fixture path |
| `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh` | 外部命令 timeout | provider command 直接执行，无 timeout | `bootstrap-providers.sh:497-523` | provider 卡住会挂死 bootstrap | S1 | 引入 `SPEC_FIRST_STAGE_TIMEOUT_SECONDS` 和 timeout reason_code |
| `src/cli/commands/doctor.js` | 外部命令 timeout | `spawnSync('git')`、host CLI version 无 timeout | `doctor.js:116-138` | doctor 可能卡住 | S2 | 封装 `spawnSync` timeout helper |
| `src/cli/developer.js` | 外部命令 timeout | `git config user.name` 无 timeout | `developer.js:265-269` | init/developer profile 可能卡住 | S2 | 复用 timeout helper，失败降级为空 |
| `src/contracts/schema-validator.js` | Schema 能力边界 | 只支持 type/enum/const/required/properties/items，`additionalProperties:false` 不生效 | `schema-validator.js:3-64` | 若 schema 依赖完整 JSON Schema 会误过 | S2 | 文档标为 lightweight validator 或接入 Ajv/补关键字 |
| `src/cli/index.js` | CLI 输出协议 | help/version 面向英文用户不够一致，含 emoji | `index.js:129-149` | 开源 CLI 体验不稳 | S3 | 统一 plain text/i18n，保留机器输出稳定 |
| `scripts/lint-skill-entrypoints.js` | 测试边界 | 扫描 `skills` 和 `docs/10-prompt/skills`，未覆盖 README/用户手册所有入口表达 | `lint-skill-entrypoints.config.json` | 入口漂移可能漏检 | S2 | 扩 scanRoots 到 README/用户手册关键目录 |
| `skills/spec-mcp-setup/scripts/write-provider-config.sh` | 维护性 | 单脚本承担 projection、GitNexus token heuristic、artifact 写入 | `write-provider-config.sh:57-180` | 难审查，回归范围大 | S2 | 拆成 deterministic helpers，保留主脚本 contract |
| 当前 worktree | Source truth 漂移 | tracked ECC 文档删除，同时新增未跟踪 ECC 目录 | `git status --short` | 审查/提交时可能遗漏 source 文档 | S2 | 明确移动意图后纳入 git 或恢复 |

## 7. Graph / MCP / Provider 架构审查

| 模块 | 当前职责 | 应有职责 | 偏差 | 风险 | 修复建议 |
|---|---|---|---|---|---|
| `spec-mcp-setup` | 安装/验证 required harness runtime，写 provider config | 统一 provider 安装与能力发现入口 | 基本一致 | S2：脚本偏大 | 拆 projection/test helper |
| `graph-providers.json` | provider commands/config | canonical provider command source | 一致 | S2：命令执行缺 timeout | 加命令级 timeout 配置 |
| `runtime-capabilities.json` | host/tool capability facts | 下游 degraded mode 输入 | 一致 | S3 | 保持 schema_version |
| `provider-artifacts.json` | provider 产物路径/状态 | 连接 setup 与 bootstrap | 一致 | S3 | 增 consumer docs |
| `spec-graph-bootstrap` | 编译 graph readiness facts | Graph Readiness Compiler | 当前已经更像 compiler | S1：执行 provider 时可能卡住 | 引入 timeout 与 partial artifacts |
| GitNexus | live MCP / code graph evidence | 外部 provider，不成为 source | 一致 | S2：query probe heuristic 仍需 eval | 增复杂 repo golden cases |
| code-review-graph | external provider command/MCP | 辅助 graph provider | 一致 | S2：不可用时降级需更多测试 | fixture 覆盖 unavailable/exit0-bad-json |
| ast-grep | 结构搜索辅助 | optional provider/tool | 一致 | S3 | 保持 optional degraded |
| agent-browser | browser QA provider | UI/runtime 验证辅助 | 一致 | S3 | 不纳入 graph readiness 必需项 |
| Serena MCP | LSP-like provider | optional code intelligence | 一致 | S2：语言选择复杂 | all-repos language map 增 e2e |
| Context7 / Sequential Thinking | docs/reasoning provider | 非 graph source | 一致 | S3 | 文档说明只作辅助 |
| legacy CRG docs | 历史内置 graph 方案 | archive/reference | 当前 docs 多处仍可见 | S2 | 归档旧 `src/crg` 时代文档并加 banner |

## 8. 产物协议审查

| 产物路径 | 类型 | 是否应提交仓库 | 生成者 | 消费者 | 是否需要 schema | 是否需要人工确认 | 问题 | 建议 |
|---|---|---:|---|---|---:|---:|---|---|
| `CLAUDE.md` / `AGENTS.md` | host source entry | 是 | source/generator | host agents | 否 | 是 | managed block 与 source 主体需同步 | 继续 source-first |
| `skills/` | source skill | 是 | maintainer | init/runtime | 否 | 是 | 41 skills 信息量大 | governance + lint 持续守护 |
| `templates/` | runtime template source | 是 | maintainer | init | 否 | 是 | 双宿主 drift 风险 | contract tests |
| `.claude/commands/spec/` | generated runtime | 否 | `spec-first init --claude` | Claude | 是，state manifest | 是 | 不应手改 | 保持 gitignored |
| `.claude/skills/` | generated runtime | 否 | init | Claude | 是，state manifest | 是 | 运行时缓存 | fresh-source eval |
| `.agents/skills/` | generated runtime | 否 | `spec-first init --codex` | Codex | 是，state manifest | 是 | 当前 runtime 全量 gitignored | 不手改 |
| `.codex/spec-first/state.json` | runtime state | 否 | init/update | doctor/update | 是 | 否 | stale runtime 需 doctor 检测 | 保持 gitignored |
| `.spec-first/config.local.yaml` | local user config | 否 | user/setup | setup/bootstrap | 是 | 是 | 示例可提交 | 只提交 `.example` |
| `.spec-first/config/*.json` | runtime capabilities/config | 否 | mcp-setup | graph-bootstrap | 是 | setup 是明确授权 | `.gitignore:46` 已忽略 | 保持 canonical |
| `.spec-first/graph/*` | graph readiness facts | 否 | graph-bootstrap | downstream skills | 是 | 否 | provider failure partial 需稳定 | 增 schema tests |
| `.spec-first/impact/*` | impact capability facts | 否 | graph-bootstrap/app audit | review/work | 是 | 否 | 是否共享未说明充分 | 用户手册补说明 |
| `.spec-first/app-audit/runs/<run-id>/` | skill run artifacts | 否 | app audit | code-review/work | 是 | report-only 禁写 | 产物多、厚 | 加 manifest/index |
| `docs/brainstorms/*` | durable spec | 是 | LLM workflow | plan/review | frontmatter | 是 | freshness 弱 | 加 lifecycle |
| `docs/plans/*` | durable plan | 是 | LLM workflow | tasks/work | frontmatter | 是 | 历史 plan 混放 | active/superseded |
| `docs/tasks/*` | task handoff | 是 | write-tasks | work | 是 | 是 | CLI validator 已有 | 链接 validator |
| `/tmp/spec-first/*` | temporary run artifacts | 否 | workflows | orchestrators | 是 | 否 | 可见性低 | final 输出 artifact path |

## 9. 健壮性与异常场景审查

| 场景 | 当前表现 | 预期表现 | 当前风险 | 修复建议 | 是否需要测试 |
|---|---|---|---|---|---:|
| 空仓库 | resolver/setup 可返回 no source/degraded | action-required，不写 repo state | S2 | 空仓 fixture | 是 |
| 非 git 仓库 | `write-provider-config.sh:35-55` 跳过写入并输出 next_action | 不写 `.spec-first/config` | S3 | 保持 | 是 |
| 大型 monorepo | preflight 有 `DEFAULT_MAX_SCAN_FILES=2000` | 有限扫描、degraded summary | S2 | 增 monorepo fixture | 是 |
| 父目录多个独立 git 项目 | all-repos resolver 支持 | 默认 advisory，写 child-local facts | S2 | all-repos e2e | 是 |
| 单 git repo 多 module | 主要靠 graph/provider 识别 | 不误判为多 repo | S2 | fixture | 是 |
| 单 git repo 单项目 | 主路径支持 | 正常 init/setup/bootstrap | S3 | smoke 保持 | 是 |
| 无 Claude Code | doctor warning | 不阻塞 Codex | S3 | doctor tests | 是 |
| 无 Codex | doctor warning | 不阻塞 Claude | S3 | doctor tests | 是 |
| 无 MCP | setup action-required | 不假装 ready | S2 | setup degraded test | 是 |
| 无 graph provider | bootstrap degraded | 输出 canonical degraded facts | S2 | provider missing fixture | 是 |
| GitNexus 安装失败 | setup logs/summary | 明确 reason_code | S2 | install failure fixture | 是 |
| GitNexus query 失败但 exit 0 | 近期已有 query readiness 强化 | 不仅看 exit 0 | S2 | 保持 exit0-bad-output fixture | 是 |
| code-review-graph 不可用 | degraded/provider unavailable | 下游降级 direct reads | S2 | provider unavailable fixture | 是 |
| ast-grep 不可用 | optional degraded | 不阻断主链 | S3 | tool missing fixture | 可选 |
| agent-browser 不可用 | polish/app runtime 降级 | 不阻断静态审查 | S3 | browser missing fixture | 可选 |
| Windows 路径 | PowerShell 脚本和 path normalize 部分覆盖 | 与 Unix parity | S2 | Windows CI 或 contract tests | 是 |
| 网络不可用 | version reminder 350ms timeout；install 依赖网络 | 只读提醒吞错，安装给出 action-required | S2 | offline fixture | 是 |
| npm 安装失败 | install-mcp 应记录失败 | 不半写 ready | S2 | npm failure fixture | 是 |
| 权限不足 | atomic write 可能失败 | 明确 exit non-zero + path | S2 | read-only temp fixture | 是 |
| 只读目录 | app audit report-only 禁写；其他写入需测试 | 不半写 | S2 | read-only fixture | 是 |
| 产物 JSON 损坏 | validate/readJson 会抛 | 输出 invalid/degraded | S2 | corrupt artifact fixture | 是 |
| 旧版本产物残留 | init hard reset legacy；clean 拒绝 legacy migration | 清晰迁移路径 | S2 | legacy state tests | 是 |
| CHANGELOG 缺失 | 项目规则要求更新 | 明确失败/提示 | S2 | changelog helper test | 可选 |
| docs 缺失 | workflow 应创建目标目录 | 不静默失败 | S2 | missing docs dir fixture | 可选 |
| 用户中断执行 | shell trap 清临时文件部分存在 | 不留下半写 ready | S2 | interrupt/partial write test | 可选 |

## 10. 性能与 token 成本审查

| 问题 | 触发场景 | 成本影响 | 工程影响 | 优化建议 |
|---|---|---|---|---|
| Skill prose 体量大 | code-review/doc-review/work | 高 token | 审查慢、上下文拥挤 | progressive references，默认只读核心段 |
| App audit 多专家/多 artifact | 移动 App 审查 | 高 token + 文件 IO | 小项目成本偏高 | 按输入缺失动态裁剪 lens |
| docs 历史层过厚 | agent 搜索 docs | 中高 | 容易读旧方案 | docs lifecycle index |
| provider bootstrap 重跑 | graph readiness | 中 | 重复外部命令 | freshness fingerprint + cache |
| GitNexus probe token heuristic | 大仓 | 低到中 | 可能读源码抽 token | 保持 file size limit，增 golden eval |
| README/手册重复流程 | 文档上下文注入 | 中 | 多处漂移 | single source snippets 或 lint |
| code-review persona 并行 | 大 diff | 高 | 成本不可控 | diff-size/persona routing |
| sessions/slack research | 历史搜索 | 高 | 外部上下文膨胀 | digest cap + source limits |
| package test npm pack | unit gate | 中 | 慢且有副作用 | 使用 isolated temp package root |
| graph facts 下游消费 | work/debug | 低 | 当前方向正确 | 继续摘要化，不 dump 全量 graph |

## 11. 测试体系审查

| 测试对象 | 当前测试情况 | 缺口 | 推荐测试 | 优先级 |
|---|---|---|---|---|
| 主 unit gate | `npm run test:unit` 覆盖 shell/Jest | 当前失败，worktree 未隔离 | Jest ignore + duplicate discovery regression | P0 |
| CLI typecheck | `npm run typecheck` 覆盖 bin/src/scripts JS | 不跑 shell syntax | 增 shellcheck 或 bash -n 核心脚本 | P2 |
| mcp-setup | `tests/unit/mcp-setup.sh`、PowerShell contracts | timeout/failure fixture 需补 | offline/npm fail/permission tests | P1 |
| graph-bootstrap | `tests/unit/spec-graph-bootstrap.sh` | provider command hang 未覆盖 | timeout fixture | P1 |
| task-pack | Jest + CLI validate | 基本可用 | invalid frontmatter/path matrix | P2 |
| init/doctor/clean | smoke + unit | external command timeout 未覆盖 | fake CLI hang test | P1 |
| app audit | 多个 `spec-app-consistency-audit-*` tests | 缺完整 orchestrated headless run | fixture repo end-to-end | P1 |
| code-review/doc-review | contract prose tests | subagent synthesis runtime 难测 | schema fixture + merge pipeline tests | P2 |
| README/manual | user-manual contracts | docs taxonomy 不测 | docs lifecycle lint | P2 |
| package install | npm pack dry-run test | 当前副作用路径共享 | isolated temp package test | P0 |
| Windows | PowerShell contract 部分覆盖 | CI parity 不完整 | Windows matrix 或 pwsh fixture | P1 |
| generated runtime | dual-host governance tests | runtime cache 行为无法本会话验证 | fresh-source eval checklist | P2 |

## 12. 安全性与副作用审查

| 风险点 | 文件/逻辑 | 触发方式 | 影响 | 修复建议 |
|---|---|---|---|---|
| provider command hang | `bootstrap-providers.sh:497-523` | 外部 provider 卡住 | bootstrap 永不返回 | timeout + kill + reason_code |
| sync command hang | `doctor.js:116-138`、`developer.js:265-269` | PATH 中 git/host CLI 异常 | doctor/init 卡住 | spawn timeout helper |
| report-only 写入 | app audit | `mode:report-only --output` | 已被阻止 | 保持 `assertCanWrite` tests |
| 路径穿越 | app audit output/input | `--output ../../...` | 已有 resolve/allowOutside 边界，但需持续测试 | 增路径逃逸 regression |
| shell eval | `resolve-project-target.sh` 输出 env 被 eval | malicious path | 当前 env_quote 降低风险 | 保持 quote tests，避免扩大 eval |
| 敏感信息泄漏 | app audit artifacts | token/path/URL | `validate-artifacts.js:13` 有 sensitive pattern | 增 redaction fixture |
| runtime overwrite | init/clean | 重新生成 host runtime | 覆盖用户 runtime | 保持 managed block/state manifest 和 preview/dry-run |
| git side effects | internal git skills | commit/push/cleanup | 用户历史被改 | 只在显式请求下启用 |
| postinstall trust | `package.json:25` | npm install 后运行 | 用户担心副作用 | postinstall 只提示 init，不装 native |

## 13. 过度设计审查

| 类型 | 当前表现 | 是否必要 | 成本 | 收敛方式 |
|---|---|---|---|---|
| 必要复杂度 | 双宿主 adapter、managed runtime、source/runtime drift | 必要 | 中 | 用 governance tests 守住 |
| 必要复杂度 | Graph provider readiness compiler | 必要 | 中高 | 不回到内置 CRG engine |
| 必要复杂度 | App audit run-scoped artifacts | 对移动 App 审查必要 | 高 | 最小消费面 + manifest |
| 偶然复杂度 | docs 多代方案混放 | 非必要 | 高 | docs lifecycle/归档 |
| 偶然复杂度 | `write-provider-config.sh` 过大 | 非必要 | 中 | 拆 helper |
| 历史包袱 | legacy CRG 文档和 `lfg` internal skill | 部分保留即可 | 中 | 标 legacy/internal，不作为主入口 |
| 过早抽象 | 过多 internal helper skills | 部分可推迟 | 中 | 只保留被 workflow 消费的 helper |
| 必须现在做 | 测试隔离与 timeout | 必须 | 低中 | P0/P1 修复 |
| 可以推迟 | CLI emoji/i18n polish | 可推迟 | 低 | P2 |

结论：当前没有方向性过度设计；风险集中在“历史材料没有生命周期”和“局部脚本职责过大”。最不应做的是把这些问题用中央状态机或重规则引擎解决。

## 14. 架构债务清单

| 债务 | 所在位置 | 影响 | 修复成本 | 优先级 |
|---|---|---|---:|---|
| Jest 发现 `.worktrees` 重复测试 | `package.json` / Jest 默认配置 | 主测试失败 | 低 | P0 |
| package install test 写共享 source 路径 | `tests/unit/package-install-contracts.test.js` | 测试竞争 | 低 | P0 |
| Provider run 无 timeout | `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh` | bootstrap 卡住 | 中 | P1 |
| doctor/developer 外部命令无 timeout | `src/cli/commands/doctor.js`、`src/cli/developer.js` | init/doctor 卡住 | 低 | P1 |
| Docs 历史层无 lifecycle | `docs/02-*`、`docs/plans`、`docs/validation` | 维护者误读旧方案 | 中 | P1 |
| Lightweight schema validator 未显式声明边界 | `src/contracts/schema-validator.js` | schema 误信任 | 低中 | P1 |
| 当前 ECC 文档移动未完全纳入 git | worktree status | source truth 漂移 | 低 | P1 |
| App audit 缺完整 orchestrated fixture | `skills/spec-app-consistency-audit` tests | 厚 contract 难证明 | 中 | P1 |
| Windows parity 不完整 | shell/PowerShell 双实现 | 跨平台风险 | 中 | P1 |
| CLI i18n/emoji 输出 | `src/cli/index.js` | 开源体验 | 低 | P2 |
| `lfg` legacy/internal 噪音 | `skills/lfg` | 理念混淆 | 低 | P2 |
| Changelog 体量过大 | `CHANGELOG.md` | release 认知成本 | 中 | P2 |

## 15. P0 / P1 / P2 修复计划

### P0：必须立即修复

| ID | 问题 | 证据 | 修复方向 | 验证 |
|---|---|---|---|---|
| P0-1 | 主 unit gate 因 `.worktrees` 测试重复发现失败 | `package.json:16`、`.gitignore:27`、`.worktrees/.../package-install-contracts.test.js`、`tests/unit/package-install-contracts.test.js:71-95` | 增 Jest ignore 或明确 config；package test 改 isolated temp fixture | `npm run test:unit` 必须通过 |

### P1：近期修复

| ID | 问题 | 证据 | 修复方向 | 验证 |
|---|---|---|---|---|
| P1-1 | graph-bootstrap provider command 无 timeout | `bootstrap-providers.sh:497-523` | timeout wrapper + `provider-command-timeout` reason_code | `npm run test:graph-bootstrap` |
| P1-2 | doctor/developer 外部命令无 timeout | `doctor.js:116-138`、`developer.js:265-269` | spawn helper + tests | targeted Jest/smoke |
| P1-3 | docs 历史层无 lifecycle | `docs/02-架构设计/`、`docs/validation/`、旧 CRG docs | docs index/status banner | docs lint |
| P1-4 | schema validator 边界不清 | `schema-validator.js:3-64` | 标 lightweight 或补关键 JSON Schema keywords | schema-validator unit |
| P1-5 | 当前 ECC 文档 source truth 漂移 | `git status --short` | 明确移动/新增并同步 changelog | `git status` clean for intended docs |
| P1-6 | Windows/PowerShell parity 仍需扩展 | Unix/PowerShell 双脚本 | 增 pwsh contract cases | PowerShell tests |
| P1-7 | app audit 厚 contract 缺完整 orchestrated fixture | `skills/spec-app-consistency-audit/scripts/*` | headless fixture repo + artifact validation | app audit e2e |

### P2：中长期优化

| ID | 问题 | 修复方向 |
|---|---|---|
| P2-1 | CLI help/i18n polish | plain text + `--json` 稳定输出边界 |
| P2-2 | `write-provider-config.sh` 过大 | 拆 GitNexus probe、projection writer、artifact writer |
| P2-3 | `lfg` internal legacy 噪音 | 文档标 legacy/internal，必要时移入 archive |
| P2-4 | CHANGELOG 可读性下降 | release-notes 增 version/topic 摘要 |
| P2-5 | docs taxonomy 复杂 | `docs/README.md` 或 docs index 说明目录职责 |
| P2-6 | provider heuristic eval 不足 | golden repo cases |
| P2-7 | Skill token budget 未量化 | 为重 skill 加 context budget/checklist |
| P2-8 | sessions/slack 外部上下文成本 | digest cap 与 source evidence limits |
| P2-9 | generated runtime fresh-source eval 过程偏手工 | 编写 eval checklist/template |
| P2-10 | package build/test 成本 | 将 npm pack dry-run 放 release slice，unit 用 deterministic fixture |

## 16. 可执行开发任务拆分

| 任务名称 | 背景 | 修改范围 | 涉及文件 | 验收标准 | 测试方式 | 风险 | 是否需要更新文档 | 是否需要更新 CHANGELOG.md |
|---|---|---|---|---|---|---|---:|---:|
| 修复 Jest worktree 隔离 | 主 unit gate 失败 | 测试配置 | `package.json` 或 `jest.config.js` | `.worktrees` 测试不被发现 | `npm run test:unit` | 可能影响 Jest discovery | 是 | 是 |
| 隔离 npm pack bytecode 测试 | 测试写 source 路径 | 单测 | `tests/unit/package-install-contracts.test.js` | 不写共享 `skills/.../__pycache__` | targeted Jest | package path 断言需调整 | 否 | 是 |
| 为 graph-bootstrap provider run 加 timeout | provider 可能卡住 | shell/ps1 + tests | `bootstrap-providers.sh/.ps1`、tests | timeout 输出稳定 reason_code | `npm run test:graph-bootstrap` | 跨平台 timeout 差异 | 是 | 是 |
| 为 doctor/developer 外部命令加 timeout | CLI 可能卡住 | CLI helper | `doctor.js`、`developer.js` | fake hanging command 不阻塞 | unit/smoke | helper API 设计 | 否 | 是 |
| 明确 schema-validator contract | 避免误信任完整 JSON Schema | code/docs/tests | `src/contracts/schema-validator.js`、tests | unsupported keyword 有显式行为 | targeted Jest | 引入 Ajv 会增依赖 | 是 | 是 |
| 建立 docs lifecycle index | 历史方案混乱 | docs-only | `docs/README.md` 或 `docs/00-版本路线/*` | 读者能区分 active/archived | docs lint/rg | 文档改动范围大 | 是 | 是 |
| 收口 ECC 文档移动 | worktree source truth 漂移 | docs/git | `docs/02-架构设计/ECC集成/*` | status 只剩预期改动 | `git status` | 可能覆盖用户意图，需确认 | 是 | 是 |
| App audit headless fixture | 厚 contract 需黑盒证明 | tests/fixtures | app audit tests | 完整 run 产物 validate 通过 | targeted Jest | fixture 维护成本 | 是 | 是 |
| PowerShell parity 扩展 | Windows 风险 | tests/scripts | ps1 tests | Unix/ps1 输出字段一致 | pwsh contract | CI 环境限制 | 否 | 是 |
| CLI help/i18n polish | 开源体验 | CLI/docs | `src/cli/index.js`、README | help 无乱码/emoji 依赖 | smoke | 文案变更 | 是 | 是 |
| provider config script 拆分 | 维护性 | scripts/tests | `write-provider-config.sh/.ps1` | 行为不变，单测覆盖 helper | mcp setup tests | 回归面大 | 是 | 是 |
| legacy/internal skill 降噪 | 理念清晰 | docs/governance | `skills/lfg/SKILL.md`、governance docs | 不出现在用户入口 | lint | 可能影响内部调用 | 是 | 是 |

## 17. 最终建议

当前项目最应该守住的边界：source-of-truth 与 generated runtime 的边界、provider readiness facts 与 LLM judgment 的边界、workflow skill 与 internal helper 的边界。`scripts prepare, LLM decides` 是这个项目能成立的核心，不应被脚本化专家系统或中央状态机替代。

当前最不应该做的事情：不要恢复内置 CRG runtime，不要把 graph-bootstrap 扩成安装器，不要让 repo-profile 或 `.spec-first/config.local.yaml` 承担 workflow state，不要为了解决 docs 混乱引入重流程引擎。

当前最应该优先补强的能力：先修 P0 测试隔离，让主质量门禁恢复可信；随后补 timeout/failure reason_code，确保 setup/bootstrap/doctor 在真实工程环境下不会卡死；再做 docs lifecycle，把当前能力、历史设计、实验方案分层。

如何让 spec-first 更像真正可落地的 AI engineering workflow system：让每个节点都有最小可验证产物、稳定 degraded mode、明确 consumer 和验证命令。当前 graph/app audit/task-pack 已经走在正确方向，下一步是让这些 contract 在失败路径、跨平台、多仓、大仓中同样可证明。

如何避免退化成 prompt/skill 集合：继续用 `skills-governance.json` 管公开入口，用 `CHANGELOG.md` 和 tests 约束 source 变更，用 `.spec-first/*` canonical artifacts 给 downstream skills 提供事实输入，用 docs lifecycle 清理历史噪音。Skill 可以多，但必须始终服务 `Codebase -> Graph -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge` 的明确节点。

## 审查验证记录

| 命令/检查 | 结果 |
|---|---|
| `git status --short --branch` | 当前分支存在既有 ECC 文档删除和未跟踪 ECC 目录 |
| `git diff --stat github/master...HEAD` | 50 files, 10491 insertions, 101 deletions |
| `find skills -mindepth 2 -maxdepth 2 -name SKILL.md` | 41 个 source skill |
| `find templates/claude/commands/spec -maxdepth 1 -type f -name '*.md'` | 20 个 Claude workflow command 模板 |
| `git ls-files .agents .claude .codex .spec-first` | 仅 `.claude/hooks/session-start`、`.claude/settings.json`、`.spec-first/config.local.example.yaml` tracked |
| `npm run test:unit` | 失败：2 个 package-install-contracts 测试失败，根因是 `.worktrees` 重复测试 discovery 与共享 bytecode fixture |
| `npm pack --dry-run --json` | 单独执行通过，说明失败来自 test isolation/重复 discovery，而非 package files contract 本身 |

## 18. 修复阶段进展

本节记录审查报告生成后的修复状态。修复阶段仍遵守 source/runtime 边界：只改 source、docs、tests 和 `CHANGELOG.md`，未手改 `.claude/`、`.codex/`、`.agents/skills/` generated runtime mirror。

| ID | 状态 | 修复/判断 | 代码或文档证据 | 验证 |
|---|---|---|---|---|
| P0-1 | fixed | 增加 Jest ignore 配置，隔离 `.worktrees` / generated runtime / scratch roots；package install contract 使用唯一 bytecode fixture 与 isolated npm cache | `jest.config.js`、`tests/unit/jest-config-contracts.test.js`、`tests/unit/package-install-contracts.test.js` | `npx jest tests/unit/jest-config-contracts.test.js tests/unit/package-install-contracts.test.js --runInBand`、`npx jest tests/unit --listTests \| rg '\.worktrees\|package-install-contracts'`、`npm run test:unit` |
| P1-1 | fixed | 为 graph-bootstrap provider command 增加 command-level timeout、raw log、`provider-command-timeout` reason_code；PowerShell 版本保持 parity | `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`、`skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`、`tests/unit/spec-graph-bootstrap.sh`、`tests/unit/mcp-setup-powershell-contracts.test.js` | `bash tests/unit/spec-graph-bootstrap.sh`、`npx jest tests/unit/mcp-setup-powershell-contracts.test.js --runInBand` |
| P1-2 | fixed | 为 doctor/developer 同步外部命令增加 bounded spawn helper；Git/host CLI timeout 分别输出 ERROR/WARNING，developer author fallback 保持空值降级 | `src/cli/external-command.js`、`src/cli/commands/doctor.js`、`src/cli/developer.js`、`tests/unit/doctor-runtime-tools.test.js`、`tests/unit/developer.sh` | `npx jest tests/unit/doctor-runtime-tools.test.js --runInBand`、`bash tests/unit/developer.sh` |
| P1-3 | fixed | 新增 docs lifecycle index，区分 current、active-artifact、historical-input、archived、external-reference，避免历史方案覆盖当前 source | `docs/README.md`、`tests/unit/docs-lifecycle-contracts.test.js` | `npx jest tests/unit/docs-lifecycle-contracts.test.js --runInBand` |
| P1-4 | fixed | 明确 lightweight schema validator contract；补齐 `additionalProperties:false`、组合 schema、基础 bounds，并声明 `format` 等 keyword 为 advisory | `src/contracts/schema-validator.js`、`docs/contracts/schema-validator.md`、`tests/unit/schema-validator-contracts.test.js` | `npx jest tests/unit/schema-validator-contracts.test.js tests/unit/quality-feedback.test.js tests/unit/spec-work-run-artifact-contract.test.js tests/unit/ai-dev-quality-gate.test.js tests/unit/branch-protection-policy.test.js --runInBand` |
| P1-5 | blocked | 当前 ECC 文档删除和未跟踪新目录是本轮前已存在的用户 worktree 漂移；未确认移动意图前不能擅自 add/restore/delete | `git status --short` 显示 tracked 删除 `docs/02-架构设计/2026-05-04-ecc-agent-integration-final.md` 与 untracked `docs/02-架构设计/ECC集成/` | 未执行修复；需用户确认 ECC 文档移动/保留策略 |
| P1-6 | fixed for scoped parity | provider timeout 修复同时覆盖 Unix/PowerShell 双实现；仍未替代真实 Windows CI | `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`、`tests/unit/mcp-setup-powershell-contracts.test.js` | `npx jest tests/unit/mcp-setup-powershell-contracts.test.js --runInBand` |
| P1-7 | verified / reclassified | 复核发现已有完整 headless artifact chain fixture，覆盖 metadata、preflight、impact、contract extraction、manifest、validate-artifacts 和 headless envelope；本轮不重复造 fixture | `tests/unit/spec-app-consistency-audit-cli-e2e.test.js` | `npx jest tests/unit/spec-app-consistency-audit-cli-e2e.test.js --runInBand` |

修复阶段新增风险：`readGitUserName` 的 GitNexus impact 为 CRITICAL，因其影响 `resolveDeveloperIdentity`、`resolveChangelogAuthor` 和 `runInit`。本次仅为其底层 `spawnSync` 增加 timeout，并保持 timeout/error 返回空字符串的原有降级语义。

### 最终验证补充

| 命令/检查 | 结果 |
|---|---|
| `npm run typecheck` | 通过：35 files checked |
| `npm run test:graph-bootstrap` | 通过：包含 provider timeout fixture |
| `npx jest tests/unit/jest-config-contracts.test.js tests/unit/package-install-contracts.test.js tests/unit/doctor-runtime-tools.test.js tests/unit/schema-validator-contracts.test.js tests/unit/docs-lifecycle-contracts.test.js --runInBand` | 通过：5 suites / 15 tests |
| `npx jest tests/unit/spec-app-consistency-audit-cli-e2e.test.js --runInBand` | 通过：12 tests，含完整 headless artifact chain |
| `npx jest tests/unit/mcp-setup-powershell-contracts.test.js --runInBand` | 通过：15 tests |
| `npm run test:unit` | 通过：80 suites / 413 tests |
| `gitnexus_detect_changes(scope=all)` | medium：主要影响 `BuildDoctorReport -> CheckGit`；P1-2 高风险路径已用 targeted timeout tests 覆盖 |
| `git status --ignored --short skills/spec-release-notes/scripts/__pycache__` | 仍存在 ignored `__pycache__/`，不是 source；本轮未删除 |
