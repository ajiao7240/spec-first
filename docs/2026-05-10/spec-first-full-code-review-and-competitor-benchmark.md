> 本报告以当前仓库代码为事实依据，结合 GitHub 同类项目调研，目标是提升 spec-first 作为 AI 辅助研发 workflow harness 的稳定性、闭环质量、竞品吸收能力与开源可信度。

# spec-first 全面代码审查报告

日期：2026-05-10
分支：`leo-2026-05-09-uv`
commit：`209d91e275c5a7d463c65043ed848a2c3ee34a63`
审查范围：`package.json`、`bin/`、`src/cli/`、`skills/`、`agents/`、`scripts/`、`templates/`、`docs/`、`tests/`、`.spec-first/graph` 现有事实产物、generated runtime 目录边界、GitHub 同类项目。
审查方法：直接读取源码、skill/agent/script/test 文档与产物；运行 skill-audit deterministic inventory；抽样 CLI help、doctor/init/task-pack/provider readiness 代码；读取 GitNexus / code-review-graph readiness artifacts；用 GitHub README/release/项目页面调研竞品。

## 总体结论

当前 spec-first 已经不是 prompt collection，而是一个有明确 source/runtime 边界、双宿主 runtime 生成、graph readiness、workflow skill、review/knowledge 闭环的 AI coding workflow harness。主链路 `Codebase -> Graph -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge` 基本成立，且关键设计方向符合 `Light contract + Explicit boundaries + Scripts prepare, LLM decides`。

但当前还不适合用“稳定无风险的通用开源工具”口径推广，更适合定位为可用的 beta/preview 级 workflow harness：核心 CLI 和 provider readiness 已有强防线，风险主要集中在用户心智与产物消费契约，而不是单个命令完全不可用。

本次发现：P0=0，P1=9，P2=8，P3=4。

当前最大风险：

1. `doctor` 与 graph/provider readiness 的边界对新用户不够直观，用户可能误以为 `doctor pass` 就等于 graph/query/review-ready。
2. public workflow skill 的输入/输出/失败模式摘要不统一，deterministic audit 给出 189 个 P1 结构信号；这些不是全部真实缺陷，但说明可读性和 handoff contract 成本偏高。
3. `spec-code-review` 默认 always-on reviewer 成本偏高，小 diff 也会触发较重上下文。
4. graph/impact artifact shape 已经比较严格，但 consumer-facing docs 仍不足，容易产生旧字段或顶层 ready 字段误读。
5. docs 历史材料中 CRG/CE 旧内容仍可被搜索命中，虽然多处已标 historical，但 contributor 仍可能被误导。

最值得优先修复的 3 件事：

1. 给 `doctor` / `mcp-setup` / `graph-bootstrap` 增加一页“readiness meaning”用户文档，并让 `doctor` 输出明确提示 provider readiness 不在其检查范围内。
2. 给 public workflow skills 增加统一的最小 I/O/failure summary block，把长流程细节下沉到 references。
3. 给 `spec-code-review` 增加 scale-aware reviewer preflight，保留全量 review 能力但降低小改动默认上下文成本。

最值得借鉴集成的 3 个竞品能力：

1. GitHub Spec Kit 的 spec/plan/tasks/implement artifact consistency check 与 archive 思路。
2. claude-code-spec-workflow / cc-sdd 的 bugfix fast path 与 per-task verification/review gate。
3. Aider 的 lint/test loop、repo map fallback、benchmark fixture suite。

## Project Fact Map

```text
spec-first/
  bin/
    spec-first.js                 # npm bin 入口，Node 版本 gate
    postinstall.js                # 安装后提示
  src/cli/
    index.js                      # package CLI dispatch
    commands/{doctor,init,clean,tasks}.js
    adapters/{claude,codex}.js    # 双宿主 runtime adapter
    plugin.js                     # 从 governance/source 生成 manifest
    contracts/dual-host-governance/skills-governance.json
    state.js                      # managed runtime write/remove plan executor
    atomic-write.js               # 已存在 atomic helper，尚未全量接入
  src/verification/
    artifact-paths.js             # workflow artifact safe path helper
  skills/
    */SKILL.md                    # 40 个 source skills
    */scripts/                    # workflow/script helper
    */references/                 # 渐进式上下文
  agents/
    *.agent.md                    # 51 个 reviewer/researcher/expert agents
  templates/
    claude/commands/spec/*.md     # Claude command source
  scripts/
    run-test-suite.cjs            # 跨平台 test runner
    generate-runtime-capability-catalog.js
    release-publish.cjs 等
  tests/
    unit/ smoke/ integration/     # CLI、contract、runtime、provider、shell portability
  docs/
    10-prompt/结构化项目角色契约.md
    contracts/ plans/ tasks/ solutions/ validation/ historical docs
  .spec-first/
    config/ graph/ providers/ impact/ audits/standards/  # canonical/advisory artifacts
  .claude/ .codex/ .agents/skills/
    generated runtime mirrors      # 不作为 source-of-truth
```

事实摘要：

| 项 | 当前事实 |
|---|---|
| package | `package.json` 声明 `name=spec-first`、`version=1.8.1`、`bin.spec-first=bin/spec-first.js`、`engines.node >=20.0.0` |
| CLI commands | `startup-reminder`、`doctor`、`init`、`clean`、`tasks`、`gitnexus-instruction` |
| source skills | 40 个 |
| agents | 51 个 |
| 脚本类资产 | 抽样 inventory 计 128 个，含 shell/PowerShell/Node/Python |
| public workflows | governance 中 21 个 `workflow_command` |
| standalone skills | governance 中 2 个 `standalone_skill` |
| internal-only skills | governance 中 17 个 |
| generated runtime | `.claude/`、`.codex/`、`.agents/skills/`，不作为 source |
| current graph facts | `.spec-first/graph/provider-status.json` 显示 `code-review-graph` 与 `gitnexus` cold-run ready/query_ready |
| worktree | 审查时已有大量未提交改动，本报告只新增报告并追加 changelog，不整理用户现有改动 |

关键源码证据：

- `package.json:1-81`：包名、Node engines、test/build scripts、published files。
- `bin/spec-first.js:5-22`：入口先校验 Node 版本，再调用 `runCli`，异常 exit 1。
- `src/cli/index.js:15-64`：CLI dispatch 与 unknown command exit 2。
- `src/cli/plugin.js:114-156`：plugin manifest 从 source/governance 构建。
- `src/cli/plugin.js:279-390`：governance 校验 entry surface、host delivery、internal-only 不外露。
- `src/verification/artifact-paths.js:44-74`：workflow artifact segment 禁绝绝对路径、`..`、Windows 非法名。

## 当前真实 Workflow 图

```text
install / spec-first --help / startup-reminder
   |
   v
spec-first doctor
   |  runtime asset / host readiness / workflow surface
   |  注意：decision_input_health 当前为 not_checked
   v
spec-first init --claude|--codex
   |  source -> generated runtime mirrors
   v
$spec-mcp-setup
   |  tool-facts.v2 + graph-providers/runtime-capabilities/provider-artifacts
   v
$spec-graph-bootstrap
   |  provider-status + graph-facts + bootstrap-impact-capabilities
   v
$spec-standards
   |  project shape / standards candidates / glue map
   v
$spec-ideate? / $spec-brainstorm
   |  idea exploration / requirements doc
   v
$spec-doc-review
   |  requirements/plan/doc persona review
   v
$spec-plan
   |  implementation plan; WHAT/HOW boundary
   v
spec-write-tasks?  (standalone optional derived layer)
   |  task pack with spec_id + source_plan_hash
   v
$spec-work / $spec-debug / $spec-optimize / $spec-polish-beta
   |  code changes, tests, execution evidence
   v
$spec-code-review / $spec-app-consistency-audit
   |  structured review, optional domain-specific audit
   v
$spec-compound / $spec-compound-refresh / $spec-sessions
   |  knowledge capture, refresh, session history retrieval
```

理想收敛图：

```text
doctor
  -> clearly says: runtime-ready != provider/query-ready
mcp-setup
  -> deterministic tool facts only
graph-bootstrap
  -> canonical provider capabilities + evidence + degraded reason_code
standards
  -> confirmed/observed/imported/suggested/conflict facts
brainstorm
  -> requirements artifact with spec_id and scope boundaries
doc-review
  -> requirements quality findings
plan
  -> portable HOW artifact with traceability and verification
write-tasks (optional)
  -> derived task pack with hash, repo scope, waves, stop_if
work/debug
  -> code + test evidence + residual risk
code-review
  -> scale-aware review + accepted residuals
compound
  -> reusable docs/solutions learning
```

## 闭环完整性审查

| 节点 | 输入 | 输出 | 下游消费者 | Preview-first | 证据链 | 缺口 |
|---|---|---|---|---|---|---|
| `doctor` | repo/runtime state | JSON/text health report | user/init docs | read-only | runtime checks | 不检查 graph/provider decision facts，`decision_input_health: not_checked` |
| `init` | source assets + developer profile | generated host runtime | Claude/Codex host | `--dry-run` | managed state + backup | write path 未统一 atomic helper |
| `mcp-setup` | host/tool deps | `tool-facts.v2`、provider config | graph-bootstrap/downstream skills | setup 写入前有 facts | reason_code/next_action | 用户文档需强调只是准备事实，不代表 query-ready |
| `graph-bootstrap` | provider config | provider-status/graph-facts/impact capabilities | plan/work/review orientation | blocked/degraded/status artifacts | raw logs、exit code、result class | consumer docs 对 artifact shape 不够直观 |
| `standards` | project source/advisory standards | standards/glue artifacts | plan/write-tasks/work/review | preview candidate | trust level | workspace advisory 与 child repo confirmed 边界需更醒目 |
| `brainstorm` | user idea/repo scan | requirements doc | plan/doc-review | interactive confirm | source refs | 输出 contract 可再压缩成固定摘要 |
| `doc-review` | docs/spec/plan | findings report | plan/work revisions | report-only default | persona findings | 多 persona 成本需 scale-aware |
| `plan` | requirements/user prompt/code evidence | implementation plan | write-tasks/work/review | asks before unresolved decisions | files/tests/requirements trace | 674 行技能文档较长，入口 contract 可前置 |
| `write-tasks` | settled plan/task pack | derived task pack | work | branch: compile/skip/return/draft | `spec_id` + `source_plan_hash` | 缺少跨 repo 示例 fixture |
| `work` | plan/task pack/prompt | code, tests, summary | code-review/compound | uses plan/task as authority | git/test evidence | planned `run.json` schema 未实现，需保持 docs 口径一致 |
| `code-review` | diff/PR/base/plan | findings/autofix residuals | work/fix/PR | mode-specific | reviewer JSON/temp artifacts | always-on 6 reviewers 对小 diff 偏重 |
| `compound` | solved problem | docs/solutions learning | sessions/future work | review old docs | source/test evidence | 需要 stale doc refresh 更强 discovery |

## 核心发现

### P0

未发现会立即阻断 CLI 安装、runtime 生成、主流程执行或 provider fail-closed 的代码级 P0。这个结论有边界：本次未运行完整 `npm test`，也未对外部官网仓库执行同步验证。

## [P1-001] `doctor` 与 provider readiness 边界不够清晰

- 问题类型：CLI 用户心智 / readiness contract
- 涉及文件：`src/cli/commands/doctor.js`、`README.md`、`docs/catalog/runtime-capabilities.md`
- 代码证据：`src/cli/commands/doctor.js:485-499` 输出 `decision_input_health: 'not_checked'`；`src/cli/commands/doctor.js:526-614` 只计算 runtime assets、host readiness、workflow surface、execution evidence。
- 当前行为：`doctor` 可以真实检查安装与 runtime surface，但不检查 graph/provider decision facts。
- 期望行为：用户能一眼区分 `doctor pass`、`mcp-setup ready`、`graph-bootstrap query_ready` 三个层次。
- 影响：新用户可能在 `doctor` 通过后直接进入 graph-heavy workflow，误把 provider unavailable 当 workflow bug。
- 根因：runtime readiness 与 provider readiness 是正确分层的，但文档和输出提示缺少“下一层能力”的显式说明。
- 修复建议：在 `doctor` 文本输出加入 `Graph/provider readiness: not checked; run $spec-mcp-setup then $spec-graph-bootstrap`；README quickstart 增加 readiness ladder。
- 验证方式：`node bin/spec-first.js doctor --json` snapshot；README contract test 检查 ladder 文案。

## [P1-002] managed runtime 写入路径未统一 atomic helper

- 问题类型：文件系统可靠性
- 涉及文件：`src/cli/state.js`、`src/cli/atomic-write.js`
- 代码证据：`src/cli/state.js:513-561` 的 `writeManagedFile` 直接 `fs.writeFileSync`；`src/cli/atomic-write.js:12-21` 已提供 temp + rename atomic write helper。
- 当前行为：`init` 对 destructive reset 有 rollback backup，但普通 managed file write 不是 atomic。
- 期望行为：所有 generated runtime file write 共用 `writeFileAtomic`，失败时不留下半写文件。
- 影响：进程中断、磁盘异常或并发 init 时可能留下截断 runtime asset。
- 根因：atomic helper 已新增但未接入旧 state executor。
- 修复建议：让 `writeManagedFile` 调用 `writeFileAtomic`，buffer 场景补充 atomic buffer 写入；保留 chmod。
- 验证方式：新增/扩展 `tests/unit/atomic-write.test.js` 与 `init-dry-run`/runtime write contract。

## [P1-003] public workflow skill 的 I/O/failure summary 不统一

- 问题类型：skill contract / 上下文成本
- 涉及文件：`skills/spec-*.md`、`skills/using-spec-first/SKILL.md`
- 代码证据：`wc -l` 显示 `spec-code-review` 964 行、`spec-plan` 674 行、`spec-mcp-setup` 655 行、`spec-compound` 542 行、`spec-work` 431 行；`.spec-first/audits/skill-audit/latest/skill-audit-summary.md` 显示 40 skills、P0=0、P1=189、P2=110、平均分 63，且声明 deterministic signals 需要 LLM 语义复核。
- 当前行为：很多 skill 有清晰流程，但入口处没有统一的 `Inputs / Outputs / Failure Modes / Artifacts / Downstream Consumers` 摘要。
- 期望行为：每个 public workflow 前 100 行能说明何时用、何时不用、读什么、写什么、失败如何降级。
- 影响：agent 加载长 skill 时容易丢失 handoff contract，审查/执行成本升高。
- 根因：能力演进快，局部规则不断追加到主 SKILL，而不是下沉 references。
- 修复建议：先给 21 个 workflow_command 加统一最小 contract block；长 persona catalog、mode matrix、edge cases 下沉 `references/`。
- 验证方式：`node skills/spec-skill-audit/scripts/write-audit-artifacts.js --repo . --runtime`；新增 skill contract smoke。

## [P1-004] `spec-code-review` 小 diff 默认 reviewer 成本偏高

- 问题类型：agent 调度 / 成本控制
- 涉及文件：`skills/spec-code-review/SKILL.md`、`agents/spec-*.agent.md`
- 代码证据：`skills/spec-code-review/SKILL.md:133-149` 声明 18 reviewer personas，并且 always-on 包含 correctness、testing、maintainability、project-standards、agent-native、learnings 6 个。
- 当前行为：除 quick review short-circuit 外，full pipeline 对小 diff 仍默认带 6 个 always-on 视角。
- 期望行为：小 diff 可走 minimum reviewer set；中/大 diff 或敏感 diff 自动扩展。
- 影响：上下文、等待时间、review fatigue 增加，尤其 docs-only 或 single-file trivial change。
- 根因：review 质量优先规则不断累加，缺少 scale-aware selector。
- 修复建议：加入 deterministic diff preflight：docs-only/1-2 file/simple config 可选 2-3 core reviewers；敏感目录维持全量；`mode:headless` 保持结构化输出。
- 验证方式：`tests/unit/spec-code-review-contracts.test.js` 加 reviewer selection fixtures。

## [P1-005] graph/impact artifact consumer docs 与实际 shape 不够直观

- 问题类型：artifact contract / downstream consumption
- 涉及文件：`.spec-first/graph/provider-status.json`、`.spec-first/graph/graph-facts.json`、`.spec-first/impact/bootstrap-impact-capabilities.json`、`docs/contracts/graph-evidence-policy.md`
- 代码证据：当前 `provider-status.json` 中两个 provider 为 `status=ready`、`query_ready=true`；`graph-facts.json` 顶层可见 `provider_summary.ready_primary_providers`，而不是简单顶层 `query_ready`；`bootstrap-impact-capabilities.json` 使用 `capabilities.context_selection/impact_radius/review_support`。
- 当前行为：artifact 语义合理，但消费者必须知道不同文件的字段层级。
- 期望行为：docs 明确“读哪个 canonical artifact、读哪个字段、不能读哪个旧字段”。
- 影响：后续 skill/script 易写出旧字段判断或用 provider artifact 存在性代替真实能力。
- 根因：provider compiler 先强化了 fail-closed，consumer-facing contract 没同步压缩成速查表。
- 修复建议：新增 `docs/contracts/graph-provider-consumption.md`，列出 canonical fields、readiness truth table、degraded reason_code。
- 验证方式：docs consistency test + fixture JSON schema test。

## [P1-006] 官网/README/docs 同步缺少仓库内质量门禁

- 问题类型：文档一致性 / 开源可信度
- 涉及文件：`README.md`、`README.zh-CN.md`、`docs/05-用户手册/**`、外部官网仓库
- 代码证据：当前 repo 没有 website source 目录；`package.json:67` homepage 指向 GitHub README；docs 下存在用户手册与 runtime capability catalog，但未发现官网同步 test。
- 当前行为：README 与当前 CLI 多数一致，但官网内容不在本仓库 CI 控制范围。
- 期望行为：仓库内 README、用户手册、官网内容有明确 source-of-truth 或同步检查。
- 影响：用户从官网进入时可能看到旧命令或旧能力说明。
- 根因：网站与 package repo 分离，缺少 docs contract。
- 修复建议：建立 `docs/site-sync-contract.md` 或在官网 repo 加 CI，至少抽取 quickstart command matrix。
- 验证方式：README/website command drift test，或跨 repo docs sync report。

## [P1-007] 历史 CRG/CE 材料仍有搜索误导风险

- 问题类型：文档漂移 / historical residue
- 涉及文件：`docs/项目介绍/**`、`docs/业界分析/**`、`docs/README.md`
- 代码证据：`docs/项目介绍/README.md` 已有 historical-input 标识，但正文和子目录仍包含旧 CRG、`.claude-plugin`、`graph.db`、`better-sqlite3` 等历史方案词汇。
- 当前行为：历史文档被保留为输入材料，目录仍在默认 docs 搜索范围内。
- 期望行为：历史材料保留，但 contributor 不会误认为是当前 architecture truth。
- 影响：新贡献者可能基于旧 CRG/CE 方案修改错误路径。
- 根因：archive 标识存在，但搜索入口没有强 stale banner / current-doc index。
- 修复建议：新增 `docs/archive-index.md`，给历史目录统一 banner；README contributor section 明确当前 source-of-truth 文档。
- 验证方式：`rg "better-sqlite3|\\.claude-plugin|src/crg|graph.db" docs` drift allowlist test。

## [P1-008] `spec-work` run artifact schema 处于 planned-but-not-produced 状态

- 问题类型：artifact truth / workflow evidence
- 涉及文件：`skills/spec-work/SKILL.md`、`docs/contracts/workflows/spec-work-run-artifact.schema.json`
- 代码证据：`skills/spec-work/SKILL.md:23-26` 明确声明当前 workflow source 不写 `.spec-first/workflows/spec-work/<slug>/<run-id>/run.json`，不能声称 artifact 存在。
- 当前行为：skill 文档诚实声明边界，但 docs-side planned contract 仍可能被下游误读为已实现。
- 期望行为：planned schema 与 runtime producer 状态在 catalog 中有机器可读 `planned|implemented` 标识。
- 影响：外部集成者可能等待不存在的 run artifact。
- 根因：contract 设计先行，producer 尚未落地。
- 修复建议：runtime capability catalog 增加 planned contracts section；若近期不实现，则把 schema 移到 `docs/contracts/planned/`。
- 验证方式：catalog test 确认 planned schema 不被 `doctor` 或 downstream 当 runtime truth。

## [P1-009] Windows/PowerShell 支持有 contract 测试，但真实 CI matrix 需要持续确认

- 问题类型：跨平台验证
- 涉及文件：`scripts/run-test-suite.cjs`、`tests/unit/mcp-setup-powershell-contracts.test.js`、`.github/workflows/npm-install-matrix.yml`
- 代码证据：`scripts/run-test-suite.cjs:61-67` Windows 原生跳过 POSIX shell test；`scripts/run-test-suite.cjs:78-95` Windows 跑 PowerShell/Jest provider contracts；`tests/unit/shell-portability.test.js` 覆盖 bash shebang、strict mode、macOS-only sed 禁止。
- 当前行为：代码层已做大量 portability contract，但本次未验证 GitHub Actions 当前 matrix。
- 期望行为：release gate 必须在 Windows/macOS/Linux 上跑最小 install/doctor/init smoke。
- 影响：Node runner 和 PowerShell parity 变更仍可能只在本地 macOS 通过。
- 根因：跨平台 contract 和真实 CI matrix 是两层，需要持续绑定。
- 修复建议：把 `npm-install-matrix-smoke.js` 固化到 Actions matrix，报告每个平台 Node 20/22。
- 验证方式：GitHub Actions matrix + `npm run test:release:install`。

## [P2-001] 单 git 多 module 缺少 module-level scope manifest

- 问题类型：workspace topology / graph scope
- 涉及文件：`skills/spec-graph-bootstrap/**`、`skills/spec-plan/SKILL.md`、`skills/spec-work/SKILL.md`
- 证据：父目录多独立 repo 通过 `workspace-graph-targets.v1` 与 `target_repo` 规则覆盖；单 repo 多 module 主要靠 LLM/file boundaries 和 provider 结果，没有 dedicated module manifest。
- 影响：大型 monorepo 内多 module 任务仍可能扩大 scope。
- 修复建议：P2 设计 `.spec-first/project-shape/modules.json` advisory manifest，只作为 context selection，不作为状态机。
- 验证方式：fixture monorepo + plan/work/review scope tests。

## [P2-002] task-pack 缺少 per-task review gate 的轻量实现

- 问题类型：闭环质量 / task verification
- 证据：`spec-write-tasks` 已定义 waves、dependency、`stop_if`、`test_focus`；`spec-work` 能消费 task pack，但 code-review 仍以 diff/PR 为主。
- 影响：长任务可以完成后统一 review，但缺少 task 级“每片完成即复核”的内建协议。
- 修复建议：借鉴 cc-sdd/Kiro-inspired per-task reviewer：task card 增加 `review_gate: optional|required`；`spec-work` 完成 task 后可调用 report-only mini review。
- 验证方式：task pack fixture + `spec-code-review mode:report-only base:<sha>` handoff test。

## [P2-003] benchmark/eval fixture suite 仍偏弱

- 问题类型：开源可信度 / AI workflow eval
- 证据：当前有 contract/unit/smoke/integration，但缺少跨项目真实需求到代码的 benchmark fixture。
- 影响：难证明 workflow 改动提升 AI 辅助研发质量，而不是 prompt 变长。
- 修复建议：建立 5-10 个 fixture repos：docs-only、CLI bug、API contract、multi-module refactor、graph-degraded fallback；记录 baseline 与 expected artifacts。
- 验证方式：`npm run test:ai-dev:gate` 扩展为可重复 benchmark。

## [P2-004] `spec-standards` / `glue-map` 与 plan/work 的消费边界需更多 examples

- 问题类型：facts consumption / LLM-owned judgment
- 证据：`spec-plan` 与 `spec-write-tasks` 已写明 confirmed/observed/imported/suggested/conflict/unknown 消费规则，但 examples 不够集中。
- 影响：agent 可能把 advisory standards 当 hard rule。
- 修复建议：新增 standards consumption examples：confirmed hard constraint、observed advisory、workspace-advisory-only 回到 child repo baseline。
- 验证方式：docs/examples contract + skill audit semantic checklist。

## [P2-005] agent 角色存在命名/职责重叠，需要边界 catalog

- 问题类型：agent governance
- 证据：`performance-oracle` vs `performance-reviewer`、`security-sentinel` vs `security-reviewer`、`data-integrity-guardian` vs `data-migrations-reviewer` 语义接近。
- 影响：未来 workflow 可能重复调度相似 agent，增加上下文噪音。
- 修复建议：新增 `docs/catalog/agent-roles.md`：planning/deepening experts 与 code-review personas 分层，不急着删除。
- 验证方式：agent catalog lint：每个 agent 有 owner skill、trigger、not-to-use。

## [P2-006] lightweight/no-graph fast path 可再产品化

- 问题类型：DX / 低仪式感
- 证据：skills 已经允许 degraded/no-graph fallback，但用户入口更强调 full setup。
- 影响：新用户 10 分钟内跑通最小闭环的路径仍偏重。
- 修复建议：借鉴 OpenSpec：提供 `quick mode` 指南，明确无需 graph 也可 brainstorm -> plan -> work -> review。
- 验证方式：README quickstart test；fresh repo no-MCP smoke。

## [P2-007] release/package smoke 已强，但 external install telemetry 缺失

- 问题类型：release confidence
- 证据：`tests/smoke/install-tarball.sh` 与 `scripts/run-test-suite.cjs` 已覆盖 tarball install；缺少安装后真实 `npx spec-first init --codex --dry-run` matrix artifact。
- 修复建议：release CI 输出 package content + dry-run artifact summary。
- 验证方式：`npm run test:release` artifact upload。

## [P2-008] session/knowledge 闭环需要更明确“何时 compound”

- 问题类型：knowledge compounding
- 证据：`spec-compound`、`spec-compound-refresh`、`spec-sessions` 均存在，但 work/code-review 完成后是否进入 compound 仍主要靠 agent 判断。
- 影响：团队经验沉淀可能不稳定。
- 修复建议：在 final summary contract 中加 “learning-worthy signal” checklist，不自动写 docs，只建议 `$spec-compound`。
- 验证方式：spec-work/code-review final summary contract tests。

## [P3-001] OpenHands-like execution sandbox 适合长期探索，不宜近期内建

- 问题类型：长期能力 / 架构边界
- 建议：只保留 isolated worktree mode 与 future execution abstraction，不把 spec-first 变成 agent execution platform。

## [P3-002] dashboard/product pulse 不应进入核心路径

- 问题类型：过度设计风险
- 建议：可作为外部 optional plugin，核心仍保持 CLI/artifact-first。

## [P3-003] community marketplace/extension catalog 可参考但不宜先做大生态

- 问题类型：生态扩展
- 建议：先做好 provider/skill manifest contract，再考虑 extension index。

## [P3-004] 全自动 multi-agent long-running runner 暂不应成为默认入口

- 问题类型：workflow autonomy
- 建议：保持 `$spec-work-beta` opt-in；默认 workflow 仍由用户目标和 plan/task artifacts 驱动。

## Skill 审查表

说明：职责按 `skills/*/SKILL.md` frontmatter、标题和抽样正文判断；下游消费者按当前 workflow graph 和 source references 推断。`问题等级` 是本次语义审查等级，不等同于 deterministic audit 的逐项结构信号。

| Skill | 当前职责 | 输入 | 输出 | 下游消费者 | 问题等级 | 是否闭环 | 是否过度设计 | 修复建议 |
|---|---|---|---|---|---|---|---|---|
| using-spec-first | public workflow entry routing governor | 用户意图/上下文 | 推荐入口或直接执行 | 全部 workflow | P1 | 是 | 否 | 增加输出 contract 摘要 |
| spec-mcp-setup | 工具/MCP/provider 基线准备 | repo/host/tool deps | tool facts/provider config | graph-bootstrap/skills | P1 | 是 | 否 | 文档强调 setup != query-ready |
| spec-graph-bootstrap | graph provider readiness compiler | provider config | provider-status/graph-facts/impact capabilities | plan/work/review | P1 | 是 | 否 | consumer field 速查表 |
| spec-standards | 项目规范/胶水基线 | repo source/facts | standards candidates/glue map | plan/tasks/work/review | P2 | 基本是 | 中低 | 增加 advisory examples |
| spec-ideate | grounded idea generation | topic/context | idea/options | brainstorm/plan | P2 | 部分 | 否 | 明确产物是否 durable |
| spec-brainstorm | WHAT/requirements discovery | idea/problem | requirements doc | doc-review/plan | P1 | 是 | 中低 | 固化 Inputs/Outputs/Failure Modes |
| spec-doc-review | requirements/plan/docs review | doc path | persona findings | plan/work | P1 | 是 | 中低 | scale-aware persona dispatch |
| spec-plan | HOW/implementation plan | requirements/prompt/code evidence | plan doc | write-tasks/work/review | P1 | 是 | 中低 | 长文下沉 references |
| spec-write-tasks | optional derived task pack | settled plan/task pack | task pack/decision envelope | work | P2 | 是 | 否 | 增 per-task review metadata |
| spec-work | execute plan/task/prompt | plan/task/prompt | code/test/final evidence | code-review/compound | P1 | 是 | 中低 | run artifact 状态 catalog |
| spec-debug | root-cause debug | failure/stack/test | fix/diagnosis | work/review/compound | P2 | 是 | 否 | 增 bugfix fast-path template |
| spec-optimize | metric-driven iteration | measurable goal | experiments/results | work/plan | P2 | 部分 | 中 | 限制适用范围，避免默认触发 |
| spec-polish-beta | browser/dev-server polish | runnable app | UI/UX fixes | review | P3 | 部分 | 中 | 保持 beta/opt-in |
| spec-code-review | structured code review | diff/PR/base/plan | findings/autofix residuals | work/PR/compound | P1 | 是 | 中 | scale-aware reviewer set |
| spec-app-consistency-audit | mobile app consistency audit | app PRD/Figma/source | consistency report | plan/work/review | P2 | 可选闭环 | 中 | 标注 domain-specific optional |
| spec-compound | solved problem -> learning | completed work/evidence | docs/solutions learning | sessions/future work | P2 | 是 | 否 | 强化触发信号 |
| spec-compound-refresh | refresh stale learnings | stale docs/scope | updated/deleted docs | future work | P2 | 是 | 否 | 增 overlap discovery |
| spec-sessions | session history Q&A | prior-session query | session digest | plan/debug/compound | P2 | 部分 | 否 | 明确隐私/retention boundary |
| spec-slack-research | organizational context | Slack research prompt | synthesized digest | brainstorm/plan | P3 | 部分 | 中 | 严格 opt-in |
| spec-skill-audit | skill quality audit | skill repo/path | audit artifacts | maintainer plan | P1 | 是 | 中低 | 继续区分 deterministic vs semantic |
| spec-update | package/runtime update | update/check request | update guidance/actions | init/doctor | P2 | 是 | 否 | 加 release risk notes |
| spec-release-notes | release summary | version/question | release answer | user | P3 | 部分 | 否 | 保持轻量 |
| spec-work-beta | external delegation work | plan/task | code/delegate outputs | review | P3 | 部分 | 中 | 继续 opt-in |
| git-worktree | internal isolated worktree | branch/task | worktree path | work/review | P2 | 是 | 否 | 保持 internal-only |
| resolve-pr-feedback | PR comments resolver | PR/comment | fixes/summary | code-review | P2 | 是 | 否 | pagination tests 已补，继续覆盖 |
| agent-native-architecture | agent-native architecture guidance | architecture task | guidance/checklist | plan/review | P2 | 部分 | 否 | 加 When Not To Use |
| agent-native-audit | agent-native quality audit | artifact/source | audit | review/plan | P2 | 部分 | 否 | 明确输出消费者 |
| changelog | changelog helper | source change | changelog entry | release/review | P2 | 是 | 否 | 加 exact format contract |
| feature-video | feature video guidance | feature/demo | video plan/assets | docs | P3 | 部分 | 否 | 保持非核心 |
| frontend-design | frontend design skill | UI task | design/code guidance | work/polish | P3 | 部分 | 中 | 保持触发边界 |
| gemini-imagegen | image generation helper | image prompt | image assets | docs/UI | P3 | 部分 | 中 | 标注外部 API 风险 |
| git-clean-gone-branches | local branch cleanup | git repo | cleaned branches | user | P3 | 是 | 否 | preview-first 保持 |
| git-commit | commit helper | staged changes | commit | PR/release | P2 | 是 | 否 | 与 changelog gate 对齐 |
| git-commit-push-pr | push/PR helper | branch/diff | PR | review/release | P2 | 是 | 否 | 强化 no destructive checkout |
| lfg | lightweight execution helper | simple task | result | user | P3 | 部分 | 中 | 避免绕过 main workflow |
| proof | proof/verification helper | claim | verification | review | P3 | 部分 | 否 | 明确 evidence schema |
| report-bug | bug report helper | bug details | report | debug | P2 | 是 | 否 | 和 spec-debug fast path 对齐 |
| spec-dhh-rails-style | Rails style guidance | Rails task | style review | plan/review | P3 | 部分 | 否 | 保持 stack-specific |
| test-browser | browser testing helper | URL/app | test evidence | polish/review | P2 | 是 | 中 | 明确 agent-browser boundary |
| test-xcode | Xcode testing helper | iOS project | test evidence | work/review | P3 | 部分 | 中 | 保持 platform-specific |

## Agent 审查表

| Agent | 当前职责 | 所属 skill | 是否必要 | 是否重叠 | 是否应合并 | 是否应增强 | 建议 |
|---|---|---|---|---|---|---|---|
| spec-correctness-reviewer | logic/edge/state review | code-review | 是 | 低 | 否 | 是 | 保持 always-on 或 minimum core |
| spec-testing-reviewer | coverage/assertion review | code-review | 是 | 低 | 否 | 是 | 与 task test_focus 联动 |
| spec-maintainability-reviewer | complexity/coupling review | code-review | 是 | 低 | 否 | 是 | 小 diff 可条件化 |
| spec-project-standards-reviewer | project rules compliance | code-review | 是 | 中 | 否 | 是 | 读取 standards artifacts |
| spec-agent-native-reviewer | agent-accessibility review | code-review | 是 | 中 | 否 | 是 | 仅对 CLI/workflow/user-facing diff always-on |
| spec-learnings-researcher | prior learnings search | code-review/compound | 是 | 中 | 否 | 是 | 对 docs-only 小 diff 可降级 |
| spec-security-reviewer | security-sensitive code review | code-review | 是 | 中 | 否 | 是 | 与 security-sentinel 分层 |
| spec-security-sentinel | broader security expert | plan/deep review | 可选 | 中 | 不急 | 是 | 标注 planning/deep-dive |
| spec-security-lens-reviewer | doc security lens | doc-review | 是 | 中 | 否 | 否 | 保持 doc-only |
| spec-performance-reviewer | perf-sensitive diff review | code-review | 是 | 中 | 否 | 是 | 与 performance-oracle 分层 |
| spec-performance-oracle | perf architecture specialist | plan/optimize | 可选 | 中 | 不急 | 是 | 标注 deep-dive |
| spec-api-contract-reviewer | API/schema contract review | code-review | 是 | 低 | 否 | 是 | 加 route/api impact |
| spec-reliability-reviewer | retries/timeouts/failure modes | code-review | 是 | 低 | 否 | 是 | 与 debug outputs 联动 |
| spec-data-migrations-reviewer | migrations/backfill review | code-review | 是 | 中 | 否 | 是 | 与 data-migration-expert 分层 |
| spec-data-migration-expert | migration planning expert | plan | 可选 | 中 | 不急 | 是 | planning-only catalog |
| spec-data-integrity-guardian | data correctness expert | plan/review | 可选 | 中 | 不急 | 是 | clarify trigger |
| spec-schema-drift-detector | schema drift | review/graph | 是 | 中 | 否 | 是 | provider artifact examples |
| spec-adversarial-reviewer | adversarial code review | code-review | 是 | 低 | 否 | 否 | 条件触发保持 |
| spec-previous-comments-reviewer | prior PR comments | code-review | 是 | 低 | 否 | 是 | GitHub API failure mode |
| spec-cli-readiness-reviewer | CLI diff usability | code-review | 是 | 中 | 否 | 是 | spec-first 核心保留 |
| spec-cli-agent-readiness-reviewer | CLI agent-readiness deep dive | plan/review | 可选 | 中 | 否 | 是 | 避免与上一个同跑 |
| spec-agent-native-reviewer | agent-native review | code-review | 是 | 中 | 否 | 是 | 见上 |
| spec-coherence-reviewer | doc coherence | doc-review | 是 | 低 | 否 | 否 | 保持 |
| spec-feasibility-reviewer | doc feasibility | doc-review | 是 | 低 | 否 | 否 | 保持 |
| spec-product-lens-reviewer | product lens | doc-review/brainstorm | 是 | 中 | 否 | 否 | 不进入代码 review 默认 |
| spec-design-lens-reviewer | design lens | doc-review | 是 | 中 | 否 | 否 | UI/product docs 条件触发 |
| spec-scope-guardian-reviewer | scope creep | doc-review/plan | 是 | 低 | 否 | 是 | 可用于 task-pack |
| spec-adversarial-document-reviewer | adversarial doc review | doc-review | 是 | 低 | 否 | 否 | 条件化 |
| spec-design-implementation-reviewer | design vs implementation | app audit/review | 可选 | 中 | 否 | 是 | domain-specific |
| spec-figma-design-sync | Figma/source sync | app audit | 可选 | 低 | 否 | 是 | optional |
| spec-julik-frontend-races-reviewer | frontend race conditions | code-review | 可选 | 低 | 否 | 否 | stack-specific |
| spec-swift-ios-reviewer | iOS review | code-review/app audit | 可选 | 低 | 否 | 否 | conditional only |
| spec-kieran-python-reviewer | Python style review | code-review | 可选 | 中 | 否 | 否 | stack-specific |
| spec-kieran-rails-reviewer | Rails style review | code-review | 可选 | 中 | 否 | 否 | stack-specific |
| spec-kieran-typescript-reviewer | TypeScript style review | code-review | 可选 | 中 | 否 | 否 | stack-specific |
| spec-dhh-rails-reviewer | Rails/DHH style | code-review | 可选 | 中 | 否 | 否 | stack-specific |
| spec-architecture-strategist | architecture strategy | plan | 是 | 中 | 否 | 是 | 不做 controller |
| spec-code-simplicity-reviewer | simplicity pressure | review/plan | 是 | 中 | 否 | 是 | 可与 maintainability 分层 |
| spec-pattern-recognition-specialist | pattern mining | plan/compound | 可选 | 中 | 否 | 是 | 只做 evidence |
| spec-spec-flow-analyzer | workflow flow analysis | skill-audit/plan | 是 | 低 | 否 | 是 | 强化闭环审查 |
| spec-repo-research-analyst | repo research | plan/review | 是 | 中 | 否 | 是 | 不替代 direct reads |
| spec-best-practices-researcher | external practices | plan | 可选 | 中 | 否 | 是 | require citations |
| spec-framework-docs-researcher | framework docs | plan/work | 是 | 低 | 否 | 否 | only current docs |
| spec-git-history-analyzer | history evidence | plan/debug/review | 是 | 低 | 否 | 是 | structured summary |
| spec-issue-intelligence-analyst | issues context | plan/debug | 可选 | 低 | 否 | 否 | external availability |
| spec-web-researcher | web research | ideate/plan | 可选 | 中 | 否 | 是 | citation discipline |
| spec-slack-researcher | Slack org context | slack-research | 可选 | 低 | 否 | 否 | opt-in |
| spec-session-historian | session history synthesis | sessions | 是 | 低 | 否 | 是 | 不直接 dispatch 已正确 |
| spec-learnings-researcher | learnings retrieval | review/compound | 是 | 中 | 否 | 是 | see above |
| spec-pr-comment-resolver | PR feedback resolver | resolve-pr-feedback | 是 | 低 | 否 | 是 | pagination/threads |
| spec-deployment-verification-agent | deploy verification | release/review | 可选 | 低 | 否 | 否 | conditional |
| spec-ankane-readme-writer | README writing style | docs | 可选 | 低 | 否 | 否 | docs-only |

Agent 总结：体系总体符合“局部专家，不做流程裁判”。主要问题不是 agent 失控，而是缺少一个可读的 agent role catalog 和 scale-aware selector。

## Script 审查表

说明：本仓库有 128 个脚本类资产。逐个文件完全展开会降低报告可读性；下表按脚本族覆盖所有重要输入/输出/写入/探测路径，leaf helper 继承所在脚本族风险。

| Script / 脚本族 | 输入 | 输出 | Exit Code 语义 | JSON Schema | 跨平台风险 | 错误处理问题 | 修复建议 |
|---|---|---|---|---|---|---|---|
| `bin/spec-first.js` | argv | CLI exit code | 0/1/2 | 无 | 低 | 良好 | 保持 Node gate |
| `bin/postinstall.js` | npm lifecycle | 安装提示 | Node 不支持 exit 1 | 无 | Unicode/cmd 可读性 | 低 | 提供 ASCII fallback |
| `src/cli/commands/doctor.js` | runtime state | text/JSON report | has_error -> nonzero | `schema_version:v1` | 低 | provider not checked 易误读 | 增 readiness ladder |
| `src/cli/commands/init.js` | platform/lang/user | generated runtime | error -> 1 | managed state | 低 | 普通 write 非 atomic | 接入 atomic helper |
| `src/cli/commands/clean.js` | platform | removed managed assets | error -> 1/2 | managed state | 中 | destructive 边界需持续测 | 保持 dry-run/plan |
| `src/cli/commands/tasks.js` | task-pack path | hash/validation JSON | validator fail nonzero | task pack contract | 低 | workspace target 语义仍由 LLM | 增 cross-repo fixtures |
| `src/cli/plugin.js` | source/governance | manifest | throw -> fail | schemaVersion=1 | 低 | 良好 | 保持 source-first |
| `scripts/run-test-suite.cjs` | suite name | test execution | failed status preserved | 无 | Windows 跳 POSIX shell | 真实 CI 需确认 | Actions matrix 固化 |
| `scripts/typecheck-js.js` | JS files | node --check | syntax fail nonzero | 无 | 低 | 良好 | 继续扩大覆盖 |
| `scripts/generate-runtime-capability-catalog.js` | source facts | docs catalog | fail nonzero | catalog implicit | 低 | planned/implemented 需区分 | 加 planned section |
| `scripts/npm-install-matrix-smoke.js` | tarball/package | install smoke | fail nonzero | 无 | 低 | 依赖 npm/env | CI matrix artifact |
| `tests/smoke/install-tarball.sh` | package tarball | install verification | fail nonzero | 无 | POSIX only | Windows 用 Node 替代 | 保持 dual path |
| `tests/unit/shell-portability.test.js` | repo scripts | portability assertions | Jest status | 无 | 低 | 良好 | 加 more forbidden patterns |
| `skills/spec-mcp-setup/scripts/detect-tools.sh` | host/tool config | `tool-facts.v2` | dep/config facts | `tool-facts.v2` | bash | jq required | 保持 scripts prepare |
| `skills/spec-mcp-setup/scripts/write-provider-config.sh` | facts file | graph-providers/runtime-capabilities/provider-artifacts | blocked may exit 0 with skipped status | v1 artifacts | bash/mktemp | ok | docs explain skipped exit 0 |
| `skills/spec-mcp-setup/scripts/*.ps1` | host/tool config | PowerShell parity facts | fail nonzero | v2/v1 | Windows native | parity drift risk | 保持 Jest contracts |
| `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh` | provider config | provider-status/graph-facts/impact capabilities/raw logs | blocked/degraded/ready structured | v1 artifacts | bash/jq/timeout | 较好，fail-closed | consumer docs |
| `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1` | provider config | PS provider artifacts | fail/degraded | v1 artifacts | Windows | parity drift | contract tests |
| `skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.*` | workspace | target candidates | advisory statuses | workspace graph targets | medium | parent/child ambiguity | docs examples |
| `skills/spec-skill-audit/scripts/write-audit-artifacts.js` | skills repo | audit artifacts | fail nonzero | multiple JSON | 低 | deterministic != semantic | 输出继续标 signal not gate |
| `skills/spec-skill-audit/scripts/lint-skill-structure.js` | skills | lint signals | fail/nonfail by mode | implicit | 低 | false positives | semantic review required |
| `skills/spec-sessions/scripts/*` | session history | extracted digests | fail/skip | session artifacts | medium | privacy/availability | retention boundary |
| `skills/resolve-pr-feedback/scripts/*` | GitHub PR comments | thread/comment JSON | API fail nonzero | implicit JSON | network | pagination/API rate | tests 已有，继续 mock |
| `scripts/review-judge.sh` | review output | gate result | shell status | 无 | bash | legacy risk | 迁移 Node or test |
| `scripts/stage-gate.sh` | stage inputs | gate result | shell status | 无 | bash | legacy risk | 明确 owner/usage |
| `scripts/task-manager.sh` | task inputs | task updates | shell status | 无 | bash | legacy risk | 若不用则 archive |
| skill media/browser scripts | prompts/URLs | assets/evidence | provider dependent | varied | high | external API/browser | 必须 opt-in + raw logs |

## Graph / MCP / Provider 审查

| 场景 | 当前支持情况 | 风险 | 缺失能力 | 推荐 provider | 修复优先级 |
|---|---|---|---|---|---|
| 父目录多个独立 git 工程 | `workspace-graph-targets.v1`、AGENTS bootstrap block、plan/work/review target_repo 规则已覆盖 | 用户未指定 target_repo 时写入 sibling/parent 的风险已被规则降低但仍需执行者遵守 | parent-level summary 到 child-local artifact 的例子 | GitNexus/code-review-graph per repo，Serena fallback | P1/P2 |
| 单 git 多 module | 依赖 provider graph + LLM bounded reads + plan file boundaries | module scope 容易膨胀 | module manifest/advisory project-shape | GitNexus + Serena + ast-grep | P2 |
| 单 git 单项目 | 支持最好；provider-status 当前显示 CRG/GitNexus ready | graph stale/dirty worktree 需持续判断 | readiness ladder docs | GitNexus primary，CRG impact，Serena direct | P1 |

Provider 层正向证据：

- `skills/spec-mcp-setup/scripts/detect-tools.sh:273-420`：graph providers 在 setup 阶段写 `query_ready:false`、`bootstrap_required:true`，没有把 dependency/configured 当 query-ready。
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh:557-620`：强制 config/runtime/provider artifact schema 与 path contract。
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh:637-738`：provider allowlist、command shape 校验、禁止 shell metachar。
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh:753-828`：命令数组执行，有 timeout/raw log/diagnostic/truncation。
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh:841-899`：GitNexus query probe 区分 diagnostic、process-results、definitions-only、empty。
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh:1120-1156`：FTS/read-only/missing-index 会进入 projection-stale 或 provider-storage-readonly；只有 `process-results` 才 verified。

当前 graph artifacts：

- `provider-status.json`：`code-review-graph@2.3.3`、`gitnexus@1.6.4-rc.100` cold-run ready，query_ready true。
- `graph-facts.json`：`ready_primary_providers=["code-review-graph","gitnexus"]`，`partial_primary_available=true`。
- `bootstrap-impact-capabilities.json`：`context_selection=full`、`impact_radius=full`、`review_support=partial`，并声明 downstream LLM 决定 evidence relevance。

结论：provider compiler 已经避免了“exit 0 就 ready”的关键误判；需要加强的是 consumer docs 与 `doctor` 口径，而不是推翻现有 provider design。

## 文档一致性审查

| 文档 | 是否过期 | 与代码不一致点 | 用户影响 | 修复建议 |
|---|---|---|---|---|
| `README.md` | 基本当前 | quickstart 仍需更清楚区分 doctor/mcp/graph readiness | 新用户 setup 心智 | 增 readiness ladder |
| `README.zh-CN.md` | 基本当前 | 同 README | 中文用户 | 同步更新 |
| `AGENTS.md` | 当前 | 规则完整，长度较大 | agent 可用 | 保持 managed block 轻量 |
| `CLAUDE.md` | 当前 | 需与 AGENTS managed block 持续同步 | 双宿主一致性 | dual-host governance test |
| `docs/10-prompt/结构化项目角色契约.md` | 当前 | 是角色契约 source-of-truth | 正向 | 保持优先级 |
| `docs/catalog/runtime-capabilities.md` | 部分不足 | planned vs implemented artifact 需更清晰 | 下游误读 | 加 status 字段 |
| `docs/contracts/graph-evidence-policy.md` | 基本当前 | 缺 consumer field quick reference | provider 消费误判 | 新增 consumption doc |
| `skills/*/SKILL.md` | 语义大多当前 | 入口 I/O/failure summary 不统一 | 上下文成本 | 统一 contract block |
| `docs/项目介绍/**` | historical | 旧 CRG/CE 方案仍多 | 搜索误导 | archive banner/index |
| 官网文档 | 未纳入本 repo 验证 | 不可在本仓库确认同步 | 开源可信度 | 跨 repo docs sync |

CE/旧 CRG 残留结论：当前 source/README/skills 没有发现阻断级旧 CE 项目残留；历史目录保留旧材料是合理的，但应更强隔离为 archive/historical input，避免搜索命中误导当前架构判断。

## 测试与质量门禁审查

| 测试类型 | 当前是否存在 | 覆盖对象 | 缺口 | 推荐实现 |
|---|---|---|---|---|
| 单元测试 | 是 | CLI/contracts/scripts | 部分新 docs artifact shape | 扩展 graph consumer schema fixtures |
| CLI smoke | 是 | help/init/doctor/install | Windows true matrix 需确认 | Actions matrix |
| install tarball | 是 | npm pack/install | 外部平台矩阵 | upload artifact |
| release governance | 是 | dual host/source/runtime | website docs sync | docs sync test |
| shell portability | 是 | shebang/strict/sed | 仍需减少 legacy shell | migrate risky scripts |
| PowerShell contracts | 是 | mcp/setup/bootstrap parity | live Windows runtime | CI Windows |
| graph provider mock | 是 | readiness/fallback | live MCP flaky | mark as session-local |
| skill contract | 是 | many spec-* skills | semantic eval 不自动化 | fresh-source eval checklist |
| docs consistency | 部分 | README language split | website/old docs drift | command matrix docs lint |
| benchmark/eval | 部分 | `test:ai-dev:gate` | real AI workflow fixtures | P2 benchmark suite |

## 竞品对比报告

调研来源：

- GitHub Spec Kit: https://github.com/github/spec-kit
- claude-code-spec-workflow: https://github.com/Pimzino/claude-code-spec-workflow
- Compound Engineering Plugin: https://github.com/EveryInc/compound-engineering-plugin
- Superpowers: https://github.com/obra/superpowers
- cc-sdd: https://github.com/gotalab/cc-sdd
- BMAD-METHOD: https://github.com/bmad-code-org/BMAD-METHOD
- OpenSpec: https://github.com/Fission-AI/OpenSpec
- Aider: https://github.com/aider-ai/aider
- OpenHands: https://github.com/OpenHands/OpenHands
- ShakaCode commands/skills/agents: https://github.com/shakacode/claude-code-commands-skills-agents
- Trellis: https://github.com/mindfold-ai/Trellis

| 项目 | 定位 | 亮点 | 短板 | spec-first 可借鉴点 | 建议等级 |
|---|---|---|---|---|---|
| GitHub Spec Kit | spec-driven development toolkit | constitution/specify/plan/tasks/implement、extension catalog、archive/memory | 更偏完整 SDD toolchain | artifact consistency check、architecture drift audit、feature archive | A/B |
| claude-code-spec-workflow | Claude Code spec workflow | Requirements -> Design -> Tasks -> Implementation；Bug Report -> Analyze -> Fix -> Verify | README 指向 MCP 版本，生态迁移中 | bugfix fast path、task-level verification template | A |
| Compound Engineering Plugin | 多工具 AI engineering plugin | 跨 Claude/Codex/Cursor/Copilot/Qwen 分发，CE loop 完整 | 容易偏平台化/产品脉冲 | multi-tool adapter manifest、external expert pack 策略 | B/C |
| Superpowers | composable agent skills methodology | lightweight initial instructions、skills、TDD、worktree/subagent 方法论 | mandatory methodology 可能过强 | skill authoring checklist、TDD completion discipline | A |
| cc-sdd | Kiro-inspired spec-driven dev | discovery/requirements/design/tasks、long-running impl、per-task review | 可能变重，任务状态更多 | per-task review gate、file boundary annotations | A/B |
| BMAD-METHOD | AI-native Agile role pack | PM/Architect/Dev/QA、scale-adaptive | Agile 仪式感较重 | scale-aware routing、dynamic agent selection | B |
| OpenSpec | lightweight SDD | propose/apply/archive、低仪式感、不锁 IDE | graph/code intelligence 较弱 | lightweight/no-graph mode、change archive | A |
| Aider | git-aware AI coding tool | repo map、lint/test auto loop、benchmark、git workflow | 不是 spec workflow harness | test/lint loop、repo map fallback、benchmark fixture | A |
| OpenHands | autonomous engineering agent platform | sandbox/workspace/SDK/benchmarks | 对 spec-first 过重 | isolated execution sandbox 长期参考 | C/B长期 |
| ShakaCode commands/skills/agents | shared Claude assets | command/skill/agent sync、generated runtime warning、large PR review helpers | scope 小，生态小 | shared asset sync discipline、file-by-file review mechanics | A |
| Trellis | task/workspace/wiki/session workflow | progressive context、task PRD、session memory、多平台 adapter | 易形成第二套状态平台 | progressive context loading、workspace journal | B |

### 借鉴分类

立即可借鉴：

- readiness/artifact consistency check。
- bugfix fast path：`Bug Report -> Analyze -> Fix -> Verify`。
- per-task verification template。
- skill authoring checklist。
- Aider-style lint/test loop 与 repo map fallback。
- generated runtime “do not edit mirrors” sync discipline。

中期能力：

- module-level scope manifest。
- per-task review gate。
- dynamic reviewer/agent selection。
- benchmark fixture suite。
- multi-tool/provider extension manifest。

只适合作为参考：

- OpenHands sandbox/SDK。
- BMAD 完整 Agile 角色体系。
- Trellis workspace journal 的完整状态层。
- Compound product pulse。

不建议引入：

- 强状态机驱动的 mandatory workflow。
- 默认全量 multi-agent/autonomous runner。
- 把 spec-first 变成 marketplace/agent platform。
- 把 repo-profile 或 `.spec-first` 变成运行时状态仓库。

## 过度设计风险表

| 风险 | 当前状态 | 判断 | 建议 |
|---|---|---|---|
| 强状态机替代 LLM | 未发现核心路径强状态机 | 可控 | 继续让 scripts 输出 facts，LLM 判断 |
| graph 污染所有 skill | 多数 skill 明确 degraded fallback | 可控 | 强化 graph consumption docs |
| repo-profile 运行时状态化 | 未见主要依赖 | 可控 | 保持 advisory/source profile |
| all tasks full workflow | using-spec-first 避免默认 brainstorm | 可控 | README 增 quick/no-graph mode |
| agent 过量默认调度 | code-review always-on 偏重 | P1 | scale-aware selection |
| historical docs 干扰 source truth | 存在搜索风险 | P1 | archive banner/index |

## 能力集成路线图

# spec-first 能力集成路线图

## P0: 稳定主流程

当前无代码级 P0。短期仍应把 P1-001、P1-002、P1-005 当作“稳定主流程”优先项处理。

## P1: 强化审查与验证

1. Readiness ladder
   - 目标：让用户知道 `doctor`、`mcp-setup`、`graph-bootstrap` 分别证明什么。
   - 改动内容：doctor text、README、runtime capability docs。
   - 涉及文件：`src/cli/commands/doctor.js`、`README.md`、`README.zh-CN.md`、`docs/catalog/runtime-capabilities.md`。
   - 风险：低。
   - 验证方式：doctor JSON/text tests、README command drift test。
   - 是否影响架构：不影响，只强化边界。

2. Atomic runtime writes
   - 目标：generated runtime 写入抗中断。
   - 改动内容：`writeManagedFile` 使用 atomic helper。
   - 涉及文件：`src/cli/state.js`、`src/cli/atomic-write.js`、tests。
   - 风险：中低，注意 chmod/buffer。
   - 验证方式：atomic-write tests、init smoke。
   - 是否影响架构：不影响。

3. Public workflow contract summary
   - 目标：减少 skill 入口上下文成本。
   - 改动内容：21 个 workflow_command 增 `Inputs/Outputs/Artifacts/Failure Modes/Downstream` 摘要。
   - 涉及文件：`skills/spec-*/SKILL.md`。
   - 风险：中，需避免大规模 prose churn。
   - 验证方式：skill-audit + fresh-source eval checklist。
   - 是否影响架构：强化现有架构。

4. Scale-aware code review
   - 目标：小 diff 不默认 6 always-on reviewer。
   - 改动内容：review preflight + reviewer selection fixtures。
   - 涉及文件：`skills/spec-code-review/SKILL.md`、tests。
   - 风险：中，不能降低敏感 diff 审查。
   - 验证方式：review selection fixtures。
   - 是否影响架构：不影响，优化调度。

## P2: 引入竞品优秀实践

1. Bugfix fast path
   - 从 claude-code-spec-workflow/cc-sdd 借鉴 `Bug Report -> Analyze -> Fix -> Verify`。
   - 落点：`spec-debug` + `spec-work` handoff template。

2. Per-task review gate
   - 从 cc-sdd/Kiro-inspired 借鉴。
   - 落点：`spec-write-tasks` task card optional review metadata + `spec-work` completion hook。

3. Benchmark fixture suite
   - 从 Aider/OpenHands 借鉴 benchmark discipline。
   - 落点：`tests/fixtures/ai-workflows/**` + `npm run test:ai-dev:gate`。

4. Lightweight/no-graph mode
   - 从 OpenSpec 借鉴低仪式感。
   - 落点：README quickstart、using-spec-first guide、no-MCP smoke。

5. Agent role catalog and dynamic selection
   - 从 BMAD scale-aware role idea 借鉴，但不搬完整 Agile。
   - 落点：`docs/catalog/agent-roles.md` + code-review selector tests。

## P3: 长期 agent execution / sandbox / benchmark 能力

1. Isolated execution sandbox
   - 参考 OpenHands，但只作为 future provider abstraction。
2. Dashboard/product pulse
   - 保持 external plugin，不进入核心。
3. Extension catalog
   - 等 provider/skill manifest 稳定后再做。
4. Long-running autonomous runner
   - 保持 `$spec-work-beta` opt-in。

## 最小修复 PR 建议

### PR-1: 修复主流程与 readiness 判断

- 目标：消除 `doctor pass == graph ready` 误解。
- 修改范围：doctor output、README readiness ladder、graph consumption docs。
- 不做什么：不改变 provider bootstrap 逻辑。
- 验证命令：`npm run test:mcp-setup`、`npm run test:graph-bootstrap`、doctor unit tests。
- 合并风险：低。

### PR-2: 修复 docs / website / README 一致性

- 目标：减少历史文档误导，建立 current source index。
- 修改范围：README、README.zh-CN、docs archive banner、site sync contract。
- 不做什么：不删除历史研究材料。
- 验证命令：README language split tests、docs drift allowlist test。
- 合并风险：低。

### PR-3: 增强 script contract / JSON schema / exit code

- 目标：让脚本输出与 consumer contract 更可测。
- 修改范围：atomic write、provider artifact docs/schema tests、task-pack workspace fixtures。
- 不做什么：不把 LLM 判断写进脚本。
- 验证命令：`npm run test:unit`、`npm run test:smoke`。
- 合并风险：中低。

### PR-4: 引入竞品借鉴的轻量能力

- 目标：bugfix fast path、per-task verification、lightweight/no-graph quick path。
- 修改范围：`spec-debug`、`spec-write-tasks`、`spec-work`、README。
- 不做什么：不引入重状态机或 dashboard。
- 验证命令：skill contract tests、task pack fixtures、fresh-source eval。
- 合并风险：中。

### PR-5: 增加测试与跨平台 smoke test

- 目标：release/install/AI workflow 更可信。
- 修改范围：GitHub Actions matrix、benchmark fixtures、install dry-run artifact。
- 不做什么：不要求所有 provider live network in CI。
- 验证命令：`npm run test:release`、Windows/macOS/Linux matrix。
- 合并风险：中。

### PR-6: 借鉴 Codex `/goal` 的轻量执行目标封套

- 目标：把长任务执行从“一句 prompt 开跑”收敛为可审计、可停止、可恢复的目标生命周期。
- 修改范围：`spec-work` final summary、`spec-write-tasks` task handoff、`spec-plan` stop-if guidance、可选 `tasks goal-envelope --json` preview。
- 不做什么：不复刻 Codex runtime、不实现常驻 loop engine、不把 `.spec-first` 做成重状态机。
- 验证命令：`tests/unit/spec-work-contracts.test.js`、`tests/unit/task-pack-command.test.js`、fresh-source eval。
- 合并风险：中，必须防止长任务自治绕过 plan/task/source authority。

## 补充调研：Codex `/goal` 与长任务目标封套

调研来源：

- 原 X 链接：`https://x.com/minlibuilds/status/2053099063982407818`
- X Article 短链跳转：`https://x.com/i/article/2053068027189678081`
- 公开长文版本：`https://www.aivi.fyi/llms/codex-goal`
- OpenAI Codex release：`https://github.com/openai/codex/releases/tag/rust-v0.128.0`
- Codex goal continuation template：`https://github.com/openai/codex/blob/main/codex-rs/core/templates/goals/continuation.md`
- Codex budget limit template：`https://github.com/openai/codex/blob/main/codex-rs/core/templates/goals/budget_limit.md`

信息边界：X 原推文只有短链接；回复区明确主题是复刻/拆解 Codex `/goal`、将其转成 Claude Code skill，并总结 prompt 防偷懒技巧。X Article 正文需要登录，普通抓取只能看到登录页；本节结合 X 回复、公开长文版本和 Codex 源码模板做架构解读。

### 核心判断

Codex `/goal` 的价值不是“更强 prompt”，而是一个轻量的目标生命周期 contract：

```text
Objective
  -> persisted goal state
  -> continuation loop
  -> completion audit
  -> budget-limited wrap-up
  -> user-controlled pause/resume/clear
```

这与 spec-first 的核心哲学一致：长任务完成不能靠模型自我感觉，必须通过需求/任务/约束到文件、命令、测试、PR 状态、残余风险的证据映射来判断。Codex `continuation.md` 的关键不是催促模型继续，而是要求模型在宣称完成前审计显式目标、交付物和验证证据；`budget_limit.md` 的关键不是 token 耗尽时停机，而是收尾并说明剩余工作与恢复路径。

### 可借鉴能力

| 能力 | 对 spec-first 的价值 | 推荐落点 | 建议等级 |
|---|---|---|---|
| Goal Execution Envelope | 将执行期目标、范围、约束、完成条件和停止条件结构化 | `spec-write-tasks` preview、`spec-work` intake | A |
| Completion Audit | 防止“测试过了/写了很多代码”被误当完成 | `spec-work` final summary、`spec-code-review` input | A |
| Stop If | 在 scope 扩张、依赖新增、schema/source-runtime 边界变化时显式停下 | `spec-plan`、`spec-write-tasks`、`spec-work` | A |
| First Action: read and report | 防止 agent 假装读过 plan/task/source | `spec-work` Phase 1、task-pack validation | A |
| Budget-limited wrap-up | 长任务预算耗尽时保留可恢复上下文 | `spec-work-beta`、`spec-optimize`、`spec-code-review` | B |
| Goal suitability classifier | 判断何时适合长任务自治，何时回到 brainstorm/plan/debug | `using-spec-first`、`spec-work` Phase 0 | A |

建议的最小封套：

```yaml
objective:
scope:
constraints:
done_when:
stop_if:
token_budget:
first_action:
evidence_checklist:
source_artifacts:
```

消费边界：

- `spec-plan` 仍然定义 HOW，goal envelope 只是执行期压缩，不替代 plan。
- `spec-write-tasks` 可从 settled plan 派生 envelope，但必须带 `spec_id`、`source_plan`、`source_plan_hash`。
- `spec-work` 可以消费 envelope，但不能把 envelope 当新 scope source。
- Codex `/goal` 适配应先做 copy-ready preview，不自动启动，不写 runtime state。

### 不建议照搬

| 不建议项 | 原因 | spec-first 替代方式 |
|---|---|---|
| 复刻 `/goal` runtime loop | 会把 spec-first 从 workflow harness 推向 execution engine | 只生成 goal envelope 和 completion audit |
| 所有 workflow 持久化状态 | 容易形成重状态机 | 只持久化 source artifacts、task pack、review/knowledge evidence |
| 默认无人值守长任务 | destructiveness、scope expansion、依赖变更风险高 | `stop_if` + user gate |
| 用测试通过替代完成判断 | 测试只是证据，不是需求满足本身 | requirement/task/constraint -> evidence audit |

### 建议集成顺序

1. P1：在 `spec-work` final summary 增加 `Completion Audit` 固定段。
2. P1：在 `spec-plan` 和 `spec-write-tasks` 标准化 `Stop if`。
3. P1：在 `spec-write-tasks` 增加 `Goal Execution Envelope` preview，不执行、不写 runtime。
4. P2：在 `using-spec-first` 加 goal-suitability classifier，区分长任务、bugfix、小任务、产品决策。
5. P2：为 Codex 生成 copy-ready `/goal` prompt；Claude Code 则生成等价 skill handoff。
6. P3：若未来实现 `spec-work-run-artifact.schema.json`，再把 envelope、completion audit、budget wrap-up 纳入 run artifact。

本节结论：Codex `/goal` 可补强 spec-first 的 `Plan -> Tasks -> Work -> Review` 执行期 contract，但集成方式必须保持轻量。spec-first 应吸收“目标可映射、边界可停止、完成可审计、预算可收尾”，而不是复制一个长任务运行时。

## 审查边界与未执行项

- 未运行完整 `npm test`，因为当前工作区已有大量未提交改动，完整测试失败时难以区分本报告引入的问题与既有改动问题。
- 未执行 fresh-source subagent eval；本报告是主审查 agent 的源码审查与 deterministic artifact 复核。
- 未修改 generated runtime assets，也未运行 `spec-first init`。
- 竞品调研以 GitHub README/项目页面为主，未逐个 clone 竞品源码做代码级审计。
