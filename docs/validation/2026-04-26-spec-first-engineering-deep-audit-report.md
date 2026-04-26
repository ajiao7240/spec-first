# spec-first 工程深度审查报告

日期：2026-04-26  
审查人：Codex  
审查范围：当前工作区 `/Users/kuang/xiaobu/spec-first`  
审查姿态：代码优先、证据驱动、工程负责人视角  

## 0. 管理层摘要

一句话结论：**spec-first 当前不是自动代码生成器，也不是重状态机编排器；它本质上是一个 AI coding workflow harness + runtime asset packager + CRG 决策输入层，已经明显超过“提示词文件化”，但工程闭环仍主要依赖宿主 LLM 自觉与软 contract。**

总分：**74/100**  
成熟度等级：**团队试点**，接近“可推广”，但还没到组织级规范平台。

### 3 个最强项

- 【代码已证实】双宿主 runtime 安装、同步、漂移检测已经形成真实 CLI 能力：`init` / `doctor` / `clean`、adapter、manifest/governance、state 管理都存在。
- 【代码已证实】CRG query-first 方向是实质增强：`spec-first crg build` / `query` / `review-context` / `hook` / `workflow-context` 能生成可消费的图证据、风险排序、候选测试和 fallback 信息。
- 【代码已证实】测试链路很强：本次 `npm test` 全绿，unit 62 suites / 329 tests，CRG e2e 77 项、SQLite audit 31 项全通过。

### 5 个最高优先级风险

- P1【代码已证实】当前安装态 runtime drift：`doctor --json` 报 `.claude/commands/spec`、`.agents/skills` 多处 drift，workflow surface 未完全 resolved。
- P1【代码已证实】`decision_input_health` 仍是 `not_checked`，`workflow_runnability` 是 `not_verified`，缺少 execution-grade verification evidence。
- P1【代码已证实】当前 `.spec-first/graph/` 中 `graph.db` ready，但 `code-navigation.json` / `graph-index-status.json` 缺失，`workflow-context` 把 `code_navigation` 标成 `ambiguous`。
- P2【代码已证实】很多 workflow 闭环是 `SKILL.md` 软约束，不是代码 enforce；尤其 `plan` / `work` / `review` / `compound` 的真实执行依赖宿主遵循。
- P2【代码已证实】`spec-write-tasks` / `spec-work` 要求 task-relevant hash，但仓库中没有对应 deterministic hash tooling，当前测试主要是文本 contract 检查。

### 系统定位

这套系统更像：**LLM 决策输入平台 + workflow harness**，不是重编排器。

### 30 / 60 / 90 天整改建议

- 30 天：修 runtime drift；补 `decision_input_health` 检查；让 CRG build/control-plane 文件生成与 `doctor` / `workflow-context` 对齐。
- 60 天：补 verification evidence 写入链路，把 `verification-evidence.json`、quality gate result、review residuals 串起来。
- 90 天：给 task pack hash、workflow artifact、review run artifact 做最小 deterministic validators，形成轻 contract 的真实消费闭环。

## 1. 项目本质定义

一句话定义：**spec-first 是一个面向 Claude Code / Codex 的 AI coding 工程化 harness：用 CLI 安装 workflow runtime，用 SKILL/agent/prompt 定义软流程，用 CRG 图索引和 quality gate 给 LLM 提供结构化决策输入。**

边界说明：

- 它做：安装/同步 runtime 资产、管理双宿主入口、生成语言/治理/开发者 profile、构建 CRG 图索引、提供 workflow hooks、提供 review/plan/work/compound 等技能 contract。
- 它做：把需求、计划、执行、评审、知识沉淀固化成工件路径和技能协议。
- 它不做：不直接替 LLM 实现完整语义判断，不把 workflow 做成强状态机，不强制每一步必须经过中心 gate。
- 它不做：不保证宿主真实执行了 `SKILL.md` 里的所有步骤；多数质量规则仍靠 LLM 遵守。
- 它不是纯 prompt pack：因为 `src/cli/`、`src/crg/`、`scripts/`、测试和 contracts 已经有真实可运行平台能力。

## 2. 基于代码事实的项目结构总览

### 目录结构解读

- `bin/spec-first.js`：包级入口，只路由 `crg` 或 `src/cli`。
- `src/cli/`：安装治理层，负责 `doctor` / `init` / `clean`、adapter、manifest、state、developer identity、language policy、bootstrap blocks。
- `src/crg/`：代码图与 workflow 决策输入层，负责 graph build、SQLite、query、review-context、workflow-context、hooks。
- `skills/`：workflow 和 helper skills 的 source of truth。
- `agents/`：review/research/persona agents 的 source of truth。
- `templates/`：Claude command/hook runtime 模板。
- `.claude/`、`.codex/`、`.agents/`：运行时副本，不是 source of truth。
- `.spec-first/`：graph、workflow、quality gate 等运行产物。
- `tests/`：unit/smoke/integration/e2e/contract 测试。

### 文本版分层架构图

```text
bin/spec-first.js
  -> src/cli/index.js
       -> commands: doctor / init / clean
       -> plugin manifest + skills-governance
       -> adapters: Claude / Codex
       -> state + managed blocks + developer/lang/changelog
       -> runtime assets: .claude / .codex / .agents
  -> src/crg/cli/router.js
       -> build/stats/query/context/review-context/workflow-context/hook
       -> SQLite graph.db + graph artifacts
       -> workflow hooks: before-plan / before-work / after-work / before-review

skills/*.md + agents/*.md
  -> host LLM reads and executes
  -> outputs docs/brainstorms, docs/plans, docs/solutions, .spec-first/workflows
```

### 边界判断

- 【代码已证实】source/runtime 边界清楚：`skills/`、`agents/`、`templates/` 是源，`.claude/`、`.codex/`、`.agents/` 是生成副本。
- 【代码已证实】host adapter 有明确分层：Claude 有 slash command，Codex 走 `.agents/skills`。
- 【高可信推断】职责仍有局部泄漏：`src/cli/plugin.js` 同时负责 manifest 校验、asset sync、runtime transform、integrity anchors，已接近过重。

## 3. 关键执行链路复盘

### 执行链路图

```text
spec-first --help/version
  -> src/cli/index.js

spec-first init --claude|--codex
  -> parse args
  -> getAdapter()
  -> loadPluginManifest()
  -> loadSkillsGovernance()
  -> buildFilteredAssetSet()
  -> resolveDeveloperIdentity()
  -> planBundledAssetSync()
  -> adapter.planRuntimeFilesSync()
  -> buildState()
  -> drift/legacy detection
  -> applyOperationPlan()
  -> write runtime assets + state + developer + instruction blocks

spec-first doctor --json
  -> Node/Git/plugin/CRG checks
  -> detect platforms
  -> inspect managed state/assets/blocks/hooks
  -> compute workflow_runnability
  -> read verification-evidence.json if present

spec-first clean --claude|--codex
  -> read managed state
  -> remove only tracked managed assets
  -> remove managed instruction blocks/hooks/runtime files

spec-first crg build --repo
  -> collect input files
  -> parse with tree-sitter
  -> write graph.db
  -> compute communities/flows/unresolved edges
  -> promote generation
  -> write control-plane artifacts

spec-first crg hook before-plan/work/review
  -> build workflow-context
  -> return advisory decision inputs
```

### 关键事实

- 【代码已证实】`bin/spec-first.js` 对 `crg` 延迟加载，其他命令走 `src/cli/index.js`。
- 【代码已证实】`init` 职责很重：manifest、governance、runtime sync、state、developer、instruction blocks、drift reset、rollback backup 都在一个命令内。
- 【代码已证实】`doctor` 已不只是存在性检查：它检查 runtime drift、host CLI、CRG native modules、CRG graph、developer identity、verification evidence freshness。
- 【代码已证实】`clean` 基于 managed state 删除，不盲删整个 runtime，安全性较好。
- 【代码已证实】`crg` 是独立子系统，当前已有 20+ 子命令和 e2e 覆盖。

## 4. 流程 contract 与决策输入审查

| 流程 | 入口 | 主契约 | 工件输出 | 关键决策输入 | enforcement 来源 | 风险 |
|---|---|---|---|---|---|---|
| bootstrap / graph-bootstrap | `/spec:graph-bootstrap` / `$spec-graph-bootstrap`；CLI 是 `spec-first crg build` | `skills/spec-graph-bootstrap/SKILL.md` + `src/crg/*` | `.spec-first/graph/graph.db`、`graph-index-status.json`、`code-navigation.json`、`graph-operations.jsonl` | graph status、query recommendations、limitations、fallback `direct_repo_reads` | CRG 代码 + skill 软流程 | 当前本仓库 `graph.db` ready，但 control-plane JSON 缺失，`code_navigation` ambiguous |
| ideate | skill / host workflow | `skills/spec-ideate/SKILL.md` | `docs/ideation/` | repo scan、web research、learnings、issue themes | `SKILL.md` + 宿主 | 多 agent/问题工具依赖强，代码不 enforce |
| brainstorm | `/spec:brainstorm` / `$spec-brainstorm` | `skills/spec-brainstorm/SKILL.md` | `docs/brainstorms/*-requirements.md` | 用户选择、scope、actors/flows/acceptance examples | `SKILL.md` | 需求质量靠 LLM 执行；无 schema validator |
| plan | `/spec:plan` / `$spec-plan` | `skills/spec-plan/SKILL.md` | `docs/plans/*-plan.md` | origin requirements、repo research、CRG before-plan、solutions、external docs | `SKILL.md` + CRG hook advisory | plan structure 强，但内容真实性靠 LLM |
| write-tasks | standalone skill：`spec-write-tasks`，不是 `/spec:*` 或 `$spec-*` command-backed workflow | `skills/spec-write-tasks/SKILL.md` + `skills/spec-write-tasks/references/task-pack-schema.md` | `docs/tasks/*-tasks.md` | source plan、requirements trace、scope boundaries、implementation units、files、test scenarios、`source_plan_hash`、dependency graph、execution waves、`stop_if` | `SKILL.md` + schema 文档；当前缺少代码级 hash validator | 这是 plan -> work 的可选派生层；能降低执行上下文负载，但 stale task pack 拒绝主要依赖 LLM 按文本 contract 执行 |
| work | `/spec:work` / `$spec-work` | `skills/spec-work/SKILL.md` | 代码变更、tests、commits、work-run | plan/task-pack、CRG before-work/after-work、planned surface | `SKILL.md` + `src/crg/hooks/*` 部分 | code review/test gate 是软 enforce；task-pack hash tooling 缺口 |
| review | `/spec:code-review` / `$spec-code-review` | `skills/spec-code-review/SKILL.md` | `.spec-first/workflows/spec:code-review/<run-id>/` | diff、plan discovery、CRG before-review、hunk_hit、graph_expansion、candidate_tests、confidence | `SKILL.md`；部分 CRG hard | 多 persona 宿主执行不可由 CLI 验证 |
| compound | `/spec:compound` / `$spec-compound` | `skills/spec-compound/SKILL.md` | `docs/solutions/<category>/*.md` | conversation、git/session、related docs、schema refs | `SKILL.md` | 知识沉淀质量靠 LLM；discoverability edit 需人工/宿主 |
| mcp-setup | `/spec:mcp-setup` / `$spec-mcp-setup` | `skills/spec-mcp-setup/SKILL.md` + scripts | `~/.claude/spec-first/host-setup.json` 或 `~/.codex/spec-first/host-setup.json` | readiness ledger：`overall_status`、`baseline_ready`、tool status、fallback | shell/ps1 scripts + skill | host readiness 明确，但 graph-bootstrap 只读取 ledger，未强制 `baseline_ready` |

### Bootstrap / Stage-0 / 决策输入专项判断

- 【代码已证实】旧 Stage-0 / `minimal-context` / `context-routing` 已被退休：搜索显示相关源文件删除，测试还断言 `stage0-context` 不再暴露。
- 【代码已证实】当前强项是 **CRG 控制面可装配 + graph.db 真实分析**，不是旧的 sample-backed minimal-context。
- 【代码已证实】`verification_summary` 只在 `spec-work-beta` delegation result schema 中出现；没有独立的 `verifier_dispatch` / `verification_gate_state` 当前代码路径。
- 【代码已证实】`doctor` 已读取 `verification-evidence.json`，有 freshness/fallback_reason，但本次实际报告为 missing。
- 【代码已证实】当前 `workflow-context` 对 missing `code-navigation.json` 给出 `decision_input_kind: ambiguous`，这是正确的轻 contract 信号；问题在于 `doctor` 还没有把这类 ambiguous 汇总进 `decision_input_health`。

## 5. 软件工程质量审查

### 架构

- 【代码已证实】CLI 主面克制：`doctor` / `init` / `clean` / `crg`，没有把每个 workflow 做成 root command。
- 【代码已证实】adapter 抽象有效降低 Claude/Codex 差异：Claude command merge skill body，Codex 重写路径与 skill name。
- 【高可信推断】`init` 和 `plugin.js` 是最大维护热点：功能密度过高，后续 host 增加或 governance 规则变化会放大复杂度。

### 稳健性与幂等性

- 【代码已证实】`init --dry-run`、`clean --dry-run`、state shape、legacy reset、rollback backup 都有实现和测试。
- 【代码已证实】`clean` 只基于 managed state 删除，避免删除 custom assets。
- 【代码已证实】`doctor` 能发现 drift，而不是只检查目录存在。
- 【代码已证实】schema validator 是轻量实现，只覆盖 type/required/properties/enum/const，不是完整 JSON Schema 引擎。

### 可维护性

- 【代码已证实】`skills-governance.json` 是较好的单一真相源，校验 command/skill/internal visibility。
- 【代码已证实】`.claude-plugin/plugin.json` 与 governance 仍共同存在；当前由 `validateSkillsGovernance()` 交叉校验，降低但没有消除多真相源风险。
- 【高可信推断】高价值 anchor drift 检查实用，但 anchor 字符串变更会造成脆弱 false positive。

## 6. AI 决策增益价值审查

它提升 AI 编码质量的核心机制是：

```text
repo code
  -> CRG parser/SQLite graph
  -> workflow-context / hooks / review-context
  -> LLM gets candidate files, graph expansion, risk signals, candidate tests, limitations, fallback reason
  -> LLM decides plan/work/review scope
  -> skills require durable artifacts: requirements, plan, review, solutions
  -> later workflows reuse those artifacts
```

判断：

- 【代码已证实】质量增益主要来自 **更好的决策输入** 和 **工件沉淀**，不是来自强流程强制。
- 【代码已证实】`review-context` 输出 `affected_nodes`、`hunk_hit`、`candidate_tests`、`graph_expansion`、verification recommendations、confidence、ranked_context，是真实决策输入。
- 【代码已证实】`workflow-context` 在 graph unavailable 时返回 `fallback: direct_repo_reads`，不会伪造 graph evidence。
- 【代码已证实】当前缺口是 provenance/freshness/confidence 不均衡：FactItem 有 `confidence/source_tier/evidence`，但 graph status freshness 是 `not_checked`，doctor 的 `decision_input_health` 仍未实现。
- 【高可信推断】这条“轻 contract + LLM 决策”路线合理；真正问题不是缺少状态机，而是部分输入健康状态还没有闭环。

收益边界：

- 对需求质量：中高，brainstorm requirements artifact 能减少跳步。
- 对设计质量：中高，plan quality bar、requirements trace、CRG planning anchors 有帮助。
- 对实现质量：中，`spec-work` 很强但软约束为主。
- 对评审质量：中高，`review-context` 和 persona review contract 是实质增强。
- 对知识沉淀质量：中，compound 有明确 schema/目录，但执行依赖宿主。
- 对团队治理质量：中高，init/doctor/governance/changelog/lang policy 有平台雏形。

新增复杂度：

- runtime drift。
- skill/source/runtime 三层漂移。
- `.spec-first/` artifact 污染/生命周期管理。
- 宿主工具差异和 question/subagent 能力差异。
- 用户需要理解 `/spec:*`、`$spec-*`、standalone skill、internal skill 的边界。

## 7. 测试与质量保障审查

### 本次实际验证

- `npm run typecheck`：通过。
- `npm test`：通过。
- Unit：62 suites / 329 tests 通过。
- Smoke：install-local、CLI help/version、doctor、init、clean 通过。
- Integration：verification gate 3 tests 通过。
- E2E：五步闭环脚本、graph-bootstrap runtime、CRG commands、SQLite audit 全通过。
- CRG e2e：77/77 通过。
- SQLite audit：31/31 通过。

### 测试体系性质

- 【代码已证实】CRG 是行为验证和数据一致性验证。
- 【代码已证实】CLI init/clean/doctor 是安装与漂移验证。
- 【代码已证实】很多 workflow contract tests 是文本锚点检查，不等于真实宿主执行验证。
- 【代码已证实】`tests/integration/e2e.sh` 的五步闭环仍是 `.claude/tasks` 文件样板和 shell gate，不能证明真实 LLM workflow 质量。
- 【高可信推断】测试成熟度：**7.5/10**。CRG/CLI 强，宿主 workflow 真实执行弱。

### 缺失的高价值测试

- Runtime drift 修复后，`doctor --json` 应达到 `workflow_surface_resolved=true` 的 fixture。
- `verification-evidence.json` 生成、freshness、schema invalid、stale、missing 的端到端测试。
- task pack hash deterministic tooling 测试。
- 真实安装后 `$spec-plan` / `$spec-work` / `$spec-code-review` runtime content 与 source skill 的 snapshot/semantic anchor 测试。
- host readiness ledger 到 graph-bootstrap decision 的消费测试。

## 8. 问题与风险清单

| 编号 | 问题 | 级别 | 证据 | 为什么是问题 | 影响范围 | 建议 |
|---|---|---|---|---|---|---|
| R1 | 当前 runtime drift | P1 | `doctor --json` 报 `.claude/commands/spec`、`.agents/skills` drift | 用户实际 host 入口可能不是当前 source truth | Claude/Codex runtime | 立即跑 init 修复，并把 drift-free doctor 加入 release gate |
| R2 | workflow runnability 未验证 | P1 | `workflow_runnability: not_verified`，evidence missing | 用户会误以为可运行，实际只证明安装面部分可用 | 全 workflow | 写入/读取 verification evidence，区分 simulated/verified |
| R3 | decision input health 未实现 | P1 | `decision_input_health: not_checked` | 决策输入平台缺少总健康判断 | graph-bootstrap/plan/work/review | 增加 CRG control-plane、freshness、coverage、fallback 汇总 |
| R4 | 当前 CRG control-plane JSON 缺失 | P1 | `.spec-first/graph` 只有 `graph.db/current/input-fingerprints`，workflow-context 报 `code_navigation ambiguous` | LLM 少了导航摘要，graph ready 与 navigation ready 混淆 | planning/review | build/promote 后保证 `graph-index-status.json`、`code-navigation.json` 稳定存在 |
| R5 | `SKILL.md` 软约束被误读为硬 enforce | P2 | plan/work/review/compound 大量要求只在 skill 文本中 | 团队可能高估自动化闭环 | DevEx/治理 | 文档和 doctor 明确 hard/soft enforcement |
| R6 | task pack hash 无确定性工具 | P2 | 只有 skill 文本要求，`rg source_plan_hash` 无 src/scripts 实现 | stale task pack 无法可靠拒绝 | spec-write-tasks/spec-work | 增加 `spec-first tasks hash/validate` 或轻量脚本 |
| R7 | `init` 职责过重 | P2 | `init.js` 处理 manifest、state、drift、rollback、runtime、developer | 后续维护风险大 | CLI | 拆 plan/build/apply/report 小模块 |
| R8 | quality gate 是 advisory | P2 | branch policy `mode: advisory`，GitHub 设置不被修改 | 组织误以为分支保护已生效 | CI/治理 | 明确输出“建议配置”，提供校验脚本 |
| R9 | 五步 E2E 仍偏样板 | P2 | `tests/integration/e2e.sh` 手写 markdown 文件模拟流程 | 证明文件 gate，不证明 LLM workflow | 测试可信度 | 增加 host runtime dry-run / skill contract execution fixture |
| R10 | user cognitive load 偏高 | P3 | 20 workflow commands、40+ skills、50+ agents | 新团队 adoption 成本高 | DevEx | 提供最小路径：setup/init/graph-bootstrap/plan/work/review |
| R11 | changelog 铁律过强且软 enforce | P3 | 规则在 AGENTS/CLAUDE managed block，无 precommit enforce | 既可能造成负担，也可能被绕过 | 团队治理 | 改为 configurable policy + optional lint |
| R12 | schema validator 能力有限 | P3 | 自研 validator 只支持部分 JSON Schema | contract 复杂后可能漏检 | contracts | 要么保持 schema 简单，要么引入 Ajv |

### 8.1 建议整改顺序

立刻修：

- 修 runtime drift，让 `doctor --json` 不再报 runtime asset health warn。
- 修 CRG control-plane artifact 缺失，确保 graph ready 不等于 navigation ambiguous。
- 补 `decision_input_health` 最小实现：graph state、control-plane existence、freshness、fallback reason、coverage gaps。

下个版本修：

- verification evidence 生成/读取闭环。
- task pack hash deterministic tooling。
- workflow runtime snapshot/anchor 测试升级。

中期结构性改造：

- 拆 `init/plugin` 过重职责。
- 把 quality gate 从 advisory policy 扩展到可验证 repo settings 检查。
- 给 `docs/brainstorms/plans/solutions` 增加轻 schema/lint，而不是重状态机。

## 9. 优点总结

- 【代码已证实】CLI 安装治理是真实能力，不是 README 承诺。
- 【代码已证实】Claude/Codex adapter 边界清楚，Codex 不再走旧 command 兼容层。
- 【代码已证实】CRG 从旧 Stage-0 文档包转向 query-first 图证据，方向与“脚本准备事实、LLM 做判断”一致。
- 【代码已证实】`doctor` 的输出已经开始区分 install health、runtime asset health、host readiness、workflow runnability。
- 【代码已证实】测试数量和层次足够支撑团队试点，尤其 CRG SQLite audit 有真实工程价值。
- 【高可信推断】项目最强的工程资产不是 prompt，而是“runtime install + CRG decision input + workflow artifact conventions”的组合。

## 10. 总评分与成熟度判断

| 维度 | 分数 | 理由 |
|---|---:|---|
| 需求工程 | 8 | brainstorm/plan artifact 和 trace 设计完整，但内容质量靠 LLM |
| 架构设计 | 7 | 分层方向正确，`init/plugin` 有过重趋势 |
| 分层清晰度 | 7 | source/runtime/adapter 清楚，manifest/governance 仍需压实单一真相源 |
| 代码质量 | 7 | CommonJS 风格一致，CRG 模块化较好，局部命令过重 |
| 稳健性 | 7 | dry-run、state、rollback、doctor 较强，workflow evidence 缺口明显 |
| 测试充分性 | 8 | CRG/CLI 很强，宿主真实执行验证不足 |
| 可维护性 | 6 | skills/agents/runtime 多层漂移管理成本高 |
| 可扩展性 | 7 | adapter/governance 可扩展，但新增 host 成本不低 |
| 开发者体验 | 7 | init/doctor 清晰，workflow 面偏大 |
| AI 协作增益 | 8 | 决策输入和 artifacts 明显增强 LLM 判断 |
| 规范治理能力 | 7 | 有治理块和 doctor，但多为软 enforce |
| 组织可推广性 | 6 | 适合试点，组织级落地还需验证/运行性闭环 |

总分：**74/100**  
等级：**团队试点**。

理由：核心平台能力已存在，CRG 方向正确，测试基础扎实；但 workflow runnability、decision input health、runtime drift、task pack hash 和真实宿主执行验证还没闭环。

## 11. 最终结论

技术负责人审查结论：

**值得继续推进，但不能按“成熟工程规范平台”推广；当前适合在高自律、愿意接受轻 contract 的工程团队中试点。**

适合：

- 已经使用 Claude Code / Codex 的团队。
- 希望把 AI coding 从一次性对话升级到 artifacts + review + knowledge 的团队。
- 能接受 LLM 做语义判断、脚本只准备事实的团队。
- 有平台负责人维护 runtime drift、skills、agents、contracts 的团队。

不适合：

- 需要强审批流、强状态机、强制合规 gate 的团队。
- 期望“安装后自动保证 AI 写对代码”的团队。
- 不愿维护 `.spec-first`、skills、agents、runtime assets 的个人项目。

它是否显著提升 AI 编码质量：**是，但提升点不是“自动写代码更强”，而是让 LLM 更少在弱上下文里猜。**

提升的质量：

- 需求质量：通过 brainstorm requirements artifact。
- 设计质量：通过 plan quality bar、requirements trace、CRG planning anchors。
- 实现质量：通过 spec-work 执行姿势、test discovery、system-wide test check。
- 评审质量：通过 code-review persona contract + CRG review-context。
- 知识沉淀质量：通过 compound `docs/solutions/`。
- 团队治理质量：通过 init/doctor/lang/changelog/developer identity/governance。

最强的地方：**把 AI workflow 的决策输入结构化，而不是把 LLM 塞进强状态机。**

最弱的地方：**运行性和输入健康还没有完全可验证；当前仍容易把“有 prompt/contract”误认为“已 enforce”。**

当前最该优先补的 3 个短板：

1. `doctor` 中 `decision_input_health` 和 `workflow_runnability` 从 `not_checked/not_verified` 变成可解释的健康状态。
2. CRG control-plane artifacts 的生成/存在/freshness 保证。
3. task pack hash 与 verification evidence 的最小 deterministic tooling。

最终判断：**继续投入是合理的。路线应继续坚持“轻 contract + 明确边界 + 高质量决策输入”，不要回到多状态流转和强编排；下一阶段重点不是增加更多 workflow，而是把现有决策输入做真、做稳、做可追溯。**
