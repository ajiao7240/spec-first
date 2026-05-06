---
title: "feat: 建立 skill/agent 质量治理与安全执行薄契约"
type: feat
status: active
date: 2026-05-07
spec_id: 2026-05-07-001-skill-agent-quality-governance
target_repo: spec-first
origin: docs/项目审查/2026-05-07-skill-agent-prompt-expert-review.md
---

# feat: 建立 skill/agent 质量治理与安全执行薄契约

## Summary

本计划承接 `docs/项目审查/2026-05-07-skill-agent-prompt-expert-review.md` 的 P1/P2 findings，把 skill/agent 质量提升从一次性人工审查转成可回归、可治理、可验证的工程机制。

方案的核心不是重写全部 prompt，而是建立四个薄机制：

1. 高风险执行边界：先修会真实影响用户工作区和 secrets 的默认行为。
2. 最小 eval fixtures：先覆盖主链路 public workflows，证明 prompt 退化可被发现。
3. 分层 agent 输出契约：reviewer、researcher、writer/strategist 分别治理，不强行一套 JSON schema。
4. 研究证据纪律：统一 external facts、project convention、GitHub/Twitter/X 信号和 source freshness 的权威层级。

这四个机制服务 `Codebase -> Graph -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge` 主链路，遵守 `Light contract + Explicit boundaries + Scripts prepare, LLM decides`。

## Report Calibration Used By This Plan

原报告的总体方向成立，但本计划在实施前校准两个点，避免把审查噪声变成错误工程任务：

- `spec-doc-review` 文档审查 personas 不应被当成普通 `freeform` agent 补 JSON 输出形状。`skills/spec-doc-review/references/subagent-template.md` 已在 orchestrator dispatch 时注入 JSON findings schema、severity、confidence、evidence 和 false-positive suppression。对这些 persona 的后续工作应聚焦 domain quality、evidence discipline 和误报抑制，而不是在每个 agent 文件里重复 schema。
- `internal_only` optional skills 不应全部机械补齐 eval fixtures。第一批 eval 应覆盖 public workflow、高风险执行 helper 和下游自动消费面；低风险 optional skills 只需明确 optional/plugin 边界、触发范围和安全说明，等进入高流量或高风险路径后再补 eval。

## Requirements

| ID | Requirement | Origin evidence | Planned response |
|---|---|---|---|
| R1 | 修复 `git-worktree` 默认复制 `.env*` 的 secret propagation 风险 | 报告 P1-01；`skills/git-worktree/SKILL.md` 与 `skills/git-worktree/scripts/worktree-manager.sh` | 默认不复制 env，新增显式 opt-in，并补 contract tests |
| R2 | 修复 `spec-work-beta` Codex delegation 成功路径 unbounded staging | 报告 P1-02；`skills/spec-work-beta/references/codex-delegation-workflow.md` | 只 stage batch file set，发现 batch 外 diff 立即 stop |
| R3 | 为主链路 public workflows 增加最小 eval fixtures | 报告 P1-03；`skills/*/evals/` 现只有少数 ready | 先补 8 个高价值 missing 主入口，用现有 ready skills 作为模板 |
| R4 | 建立高风险执行 skill 的 mutation boundary | 报告 P1-04 | 用一个薄 contract 描述 writes、shell/network、secrets、git、external service、rollback/stop |
| R5 | 修复明确的 prompt/script drift 和 typo | 报告 P2-02、P2-03 | 修 `gemini-imagegen` 默认模型/扩展名 drift，修 `agent-native-audit` option/typo |
| R6 | 调和 `spec-work` 的速度、简化与精准修改之间的张力 | 报告 C3、C4 | 将 `Start Fast` 改成先建立成功标准再执行；将 simplification 限定到本次 touched files/ownership |
| R7 | 建立 agent 输出 contract registry，但不把所有 agent 改成 findings JSON | 报告 P2-05 | 定义 reviewer/researcher/writer-strategist 三类 contract，doc-review personas 使用 orchestrator-injected schema |
| R8 | 统一 researcher authority、freshness 和 untrusted input 处理 | 报告 C5、C7、C9、P2-07 | 抽 Research Evidence Contract，新增 competitive intelligence researcher |
| R9 | 降低 long-form skill 的 drift 成本 | 报告 P2-04、P2-08 | 引入 prompt source lint 和 progressive disclosure 改造队列 |
| R10 | 避免硬编码年份继续自然过期 | 报告 C8 | 改为使用 host/session current date，增加 lint 例外规则 |

## Scope Boundaries

- 本计划不把 `spec-first` 改成重状态机、中心化 gate 系统或复杂 prompt 规则引擎。
- 本计划不一次性重写 42 个 skill 和 51 个 agent。
- 本计划不手改 `.claude/`、`.codex/`、`.agents/skills/` generated runtime mirror。
- 本计划不把 external prompt docs、GitHub repo、Twitter/X 观点变成项目 source of truth。
- 本计划不要求所有 agent 输出同一 JSON schema。
- 本计划不把 low-risk optional/internal skills 纳入第一批 eval 强制覆盖。
- 本计划不引入新的 runtime workflow command；新增能力优先是 source contract、tests、agent profile 或 lint。
- 本计划不执行实际外部竞品调研，只建立可复用 competitive intelligence agent 与证据 contract。每次调研必须在执行时重新取最新来源。

## Graph Readiness

- target_repo: `spec-first`
- status: `stale`
- source_revision: `dbf9bab1a871fc7aa6c790fe26b70eda10e0e0dc`
- current_revision: `fac57f4b15a6b67768abcafc761308f62a4cb1a7`
- stale: `true`
- primary_providers: `code-review-graph`, `gitnexus`
- degraded_providers: none reported by compiled artifact
- fallback_capabilities: bounded direct source reads, current report artifact, existing tests, live GitNexus if implementation touches symbols
- runtime_mcp_evidence: not used for this planning pass; current plan is prompt/docs/script-surface governance and was grounded by bounded direct reads
- confidence: medium
- limitations: compiled graph facts are older than current HEAD and worktree state; implementation that changes JS symbols must run live impact analysis before editing symbols, and must run `gitnexus_detect_changes()` before commit

## Context & Research

### Local Evidence

- `docs/10-prompt/结构化项目角色契约.md` establishes the system goal and source/runtime boundary.
- `docs/项目审查/2026-05-07-skill-agent-prompt-expert-review.md` provides the triggering findings and priority ordering.
- `skills/spec-doc-review/references/subagent-template.md` proves doc-review persona output is injected by the orchestrator, not owned by persona prose alone.
- `skills/spec-skill-audit/scripts/write-audit-artifacts.js` already emits `eval-readiness-report.json` from `skills/<skill>/evals/*` file presence.
- `skills/spec-graph-bootstrap/evals/` and `skills/spec-write-tasks/evals/` are the strongest existing eval fixture templates.
- `skills/git-worktree/scripts/worktree-manager.sh` currently copies `.env*` by default.
- `skills/spec-work-beta/references/codex-delegation-workflow.md` currently stages all modified and untracked files on successful delegated batch.
- `agents/spec-web-researcher.agent.md` already has the strongest untrusted web input and source freshness model among researcher agents.

### External Prompt Baseline

External references are calibration input only. They do not override the project role contract.

- Google Gemini Prompt Design Strategies: clear task framing, context, constraints, examples and output guidance. URL checked 2026-05-07: `https://ai.google.dev/gemini-api/docs/prompting-strategies`
- OpenAI Prompt Optimizer and evaluation docs: prompt quality should be tied to measurable evals and iterative optimization. URLs checked 2026-05-07: `https://developers.openai.com/api/docs/guides/prompt-optimizer`, `https://developers.openai.com/api/docs/guides/evaluation-best-practices`
- Anthropic Claude prompt engineering and evaluation docs: clear instructions, explicit context, examples, success criteria and multidimensional evaluation. URLs checked 2026-05-07: `https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices`, `https://platform.claude.com/docs/en/test-and-evaluate/develop-tests`

## Key Technical Decisions

### D1. 先修执行风险，再补治理框架

`git-worktree` env propagation 和 `spec-work-beta` unbounded staging 会实际改变用户本地安全边界和提交内容，因此 Phase A 必须先落地。Eval、contract 和 researcher 改造属于质量治理，重要但不应阻塞安全修复。

### D2. 一个 human-readable contract 先承载四类薄契约

第一版不新增多套 schema。新增 `docs/contracts/workflows/skill-agent-quality-governance.md`，在一个文档里定义：

- Skill Minimum Contract v1
- High-risk Execution Safety Contract v1
- Agent Output Contract Registry v1
- Research Evidence Contract v1

只有当 lint 或 downstream consumer 真正需要机器可读字段时，再拆 `src/cli/contracts/**` schema。

### D3. Eval fixtures 先是回归样例，不是 LLM-as-judge 平台

第一批 eval 使用 JSON fixture，覆盖 trigger、boundary、failure、expected behavior。`spec-skill-audit` 先读取存在性和基本 schema；不引入复杂 scoring runner。这样能用最小成本降低 prompt drift，符合 Light contract。

### D4. Doc-review personas 保持 persona 专注，不重复输出 schema

`spec-adversarial-document-reviewer`、`spec-coherence-reviewer`、`spec-design-lens-reviewer`、`spec-feasibility-reviewer`、`spec-product-lens-reviewer`、`spec-scope-guardian-reviewer`、`spec-security-lens-reviewer` 的输出 contract 由 `spec-doc-review` template 注入。后续不在这些 persona 文件里重复 JSON schema，只补领域边界、证据纪律和误报抑制。

### D5. Research authority 分 project convention 与 external facts

本地 skills/standards 对项目约定有高权威；外部 API、SDK、模型、价格、平台能力、法规和竞品能力必须以官方 docs、primary source、release notes、GitHub source/issues 或当前社交信号为准。本地 skill 只能作为经验起点，不能压过当前官方事实。

### D6. Twitter/X 信号只能作为 market signal，不直接作为事实

Competitive intelligence agent 可以读取 Twitter/X，但必须将其标为 social discourse，不得把单条推文当 confirmed fact。事实类 claim 需要官方文档、GitHub release/source、issue/PR 或多个独立来源交叉验证。

### D7. Prompt source lint 只抓可证明 drift

lint 先覆盖 hard-coded year、陈旧 entrypoint、option 编号引用、default model drift、runtime source 禁止路径等机械事实。不让 lint 判断语义好坏、产品优先级或架构方向。

## Capability Upgrades

### CUD-001 Prompt Contract 与 Eval Harness

目标：让 public workflow 的 prompt 改动可回归。

最小能力：

- 每个第一批 workflow 有 `evals/trigger-cases.json`、`boundary-cases.json`、`failure-cases.json`、`expected-behavior-cases.json`。
- `spec-skill-audit` 输出 public workflow eval readiness summary。
- Contract tests 固定 high-value workflow 的 readiness 预期。

成功信号：

- 第一批主链路 workflow 的 eval readiness 从 `missing` 变为 `ready` 或有明确 deferred reason。
- 后续 prompt 改动可以用 fixture 判断是否破坏 trigger、boundary 或 failure behavior。

### CUD-002 Safe Execution Boundary

目标：所有写文件、shell-heavy、git、secrets、external service 相关 skill 都有同一套最小安全边界。

最小能力：

- 高风险 skill 明确 writes、shell/network、secrets、git staging/commit、external service、rollback/stop condition。
- `git-worktree` 默认不复制 `.env*`。
- `spec-work-beta` batch success path 只 stage batch-owned file set。

成功信号：

- 没有默认 secret propagation。
- 没有 batch 外文件被 delegation commit path 自动 stage。
- 审查者能用同一 checklist 评估高风险 skill。

### CUD-003 Agent Output 与 Research Evidence Contract

目标：让 agent 输出能被 workflow 稳定消费，同时保留角色差异。

最小能力：

- Reviewer 使用 findings contract。
- Researcher 输出 claims、sources、freshness、limitations、authority tier。
- Writer/strategist 输出 artifact、assumptions、checks performed、open risks。
- 新增 competitive intelligence researcher，专门覆盖 GitHub + Twitter/X + official/release signals + fit-to-spec-first。

成功信号：

- 下游 synthesis 能区分事实、判断、假设、社交信号和建议。
- 最新性要求不靠硬编码年份，执行时读取 host/session current date。

## Implementation Units

### U1. Harden `git-worktree` Env Handling

**Goal:** Worktree creation no longer copies secrets by default.

**Requirements:** R1, R4

**Files:**

- Modify: `skills/git-worktree/SKILL.md`
- Modify: `skills/git-worktree/scripts/worktree-manager.sh`
- Create: `tests/unit/git-worktree-contracts.test.js`
- Modify: `CHANGELOG.md`

**Approach:**

- Change CLI usage to `create [--copy-env] <branch-name> [from-branch]` or equivalent explicit opt-in.
- Default path prints that env files were not copied and how to opt in, without reading file contents.
- `--copy-env` copies only `.env*` except `.env.example`, preserving current backup behavior.
- Keep `.worktrees` gitignore and dev-tool trust behavior unchanged.
- Update prose to remove the current manual "copy `.env*`" snippet as a default recommendation; replace with explicit opt-in wording.

**Test scenarios:**

- Default create path does not call/copy env files.
- `--copy-env` path copies expected env filenames and still skips `.env.example`.
- Existing destination env file is backed up only in opt-in path.
- `bash -n skills/git-worktree/scripts/worktree-manager.sh` passes.
- Contract test asserts `SKILL.md` no longer says env copying is default.

**Verification:**

- `npx jest tests/unit/git-worktree-contracts.test.js --runInBand`
- `bash -n skills/git-worktree/scripts/worktree-manager.sh`

### U2. Bound `spec-work-beta` Delegation Staging

**Goal:** Delegated batch success cannot stage unrelated modified or untracked files.

**Requirements:** R2, R4

**Files:**

- Modify: `skills/spec-work-beta/references/codex-delegation-workflow.md`
- Modify: `tests/unit/spec-work-beta-contracts.test.js`
- Modify: `CHANGELOG.md`

**Approach:**

- Replace the success-path `git add $(git diff --name-only HEAD; git ls-files --others --exclude-standard)` guidance with a batch-owned file set gate.
- Define the batch-owned set as the combined `Files` list from the plan units/tasks assigned to that batch, plus any result JSON `files_modified` that are within that combined set.
- Before staging, compare actual modified/untracked files to the batch-owned set.
- If any diff path is outside the batch-owned set, stop batch commit and require orchestrator judgment; do not auto-stage.
- Stage only batch-owned paths. Use a path-safe approach in implementation prose and tests; do not rely on unquoted command substitution.

**Test scenarios:**

- Reference text no longer contains unbounded `git add $(git diff --name-only HEAD; git ls-files --others --exclude-standard)`.
- Reference requires batch file-set comparison before staging.
- Reference says out-of-batch diff stops commit and surfaces to orchestrator.
- Reference preserves rollback path scoping to batch file list.

**Verification:**

- `npx jest tests/unit/spec-work-beta-contracts.test.js --runInBand`

### U3. Fix Prompt/Script Drift Quick Wins

**Goal:** Clear deterministic drift is fixed before broader prompt governance work.

**Requirements:** R5, R10

**Files:**

- Modify: `skills/agent-native-audit/SKILL.md`
- Modify: `skills/gemini-imagegen/SKILL.md`
- Modify: `skills/gemini-imagegen/scripts/generate_image.py`
- Modify: `skills/gemini-imagegen/scripts/edit_image.py`
- Modify: `skills/gemini-imagegen/scripts/multi_turn_chat.py`
- Modify or create focused tests under `tests/unit/`
- Modify: `CHANGELOG.md`

**Approach:**

- Correct `agent-native-audit` option numbering and typo `SHARED WORKSPASpec-First`.
- Align `gemini-imagegen` prose and scripts on default model and output extension.
- Do not silently change model choice if current API availability is uncertain. Implementation must verify current Gemini image model docs or mark the model selection as a user-provided default with clear fallback.
- Replace hardcoded current-year wording in touched files with host/session current date wording when the file is already being edited.

**Test scenarios:**

- Contract tests assert the corrected option mapping.
- Contract tests assert no `SHARED WORKSPASpec-First` typo remains.
- Python scripts compile with `python3 -m py_compile`.
- Contract tests assert `SKILL.md` and script defaults agree.

**Verification:**

- `npx jest tests/unit/agent-native-architecture-contracts.test.js tests/unit/skill-shell-safety.test.js --runInBand`
- `python3 -m py_compile skills/gemini-imagegen/scripts/*.py`

### U4. Add Skill/Agent Quality Governance Contract

**Goal:** Provide a single source document for thin contracts without creating heavy runtime governance.

**Requirements:** R3, R4, R7, R8, R9

**Files:**

- Create: `docs/contracts/workflows/skill-agent-quality-governance.md`
- Create: `tests/unit/skill-agent-quality-governance-contracts.test.js`
- Modify: `docs/README.md` if the docs index requires new contract discovery
- Modify: `CHANGELOG.md`

**Approach:**

- Define four thin contracts in one document:
  - `Skill Minimum Contract v1`: trigger, non-trigger, inputs, outputs, workflow skeleton, failure mode, verification/done signal.
  - `High-risk Execution Safety Contract v1`: writes, shell/network, secrets, git staging/commit, external service, rollback/stop.
  - `Agent Output Contract Registry v1`: reviewer, researcher, writer/strategist output families.
  - `Research Evidence Contract v1`: authority tier, source freshness, date checked, limitations, untrusted content handling.
- Include an explicit exception: doc-review persona files receive their output schema from `skills/spec-doc-review/references/subagent-template.md`.
- State that optional/internal skills can remain optional without eval until they become high-traffic, mutating, or downstream-consumed.
- Keep deterministic checks script-owned and semantic classification LLM-owned.

**Test scenarios:**

- Contract doc mentions all four contract names.
- Contract doc names the doc-review orchestrator-injected output exception.
- Contract doc explicitly forbids hand-editing generated runtime mirrors.
- Contract doc distinguishes public workflow/high-risk helper from optional internal skill priority.

**Verification:**

- `npx jest tests/unit/skill-agent-quality-governance-contracts.test.js --runInBand`

### U5. Add First-Wave Public Workflow Eval Fixtures

**Goal:** Move high-value workflow prompt changes from manual confidence to fixture-backed regression checks.

**Requirements:** R3

**Files:**

- Create eval fixtures under:
  - `skills/using-spec-first/evals/`
  - `skills/spec-brainstorm/evals/`
  - `skills/spec-plan/evals/`
  - `skills/spec-work/evals/`
  - `skills/spec-code-review/evals/`
  - `skills/spec-doc-review/evals/`
  - `skills/spec-mcp-setup/evals/`
  - `skills/spec-update/evals/`
- Modify: `tests/unit/skill-audit-scripts.test.js`
- Modify: `CHANGELOG.md`

**Approach:**

- Reuse `skills/spec-graph-bootstrap/evals/` and `skills/spec-write-tasks/evals/` schema style.
- Each skill gets four minimal files:
  - `trigger-cases.json`
  - `boundary-cases.json`
  - `failure-cases.json`
  - `expected-behavior-cases.json`
- Keep each file small: 2 to 5 cases per category.
- Cover both positive and negative routing, especially `using-spec-first` public workflow selection, `spec-plan` versus `spec-brainstorm`, and `spec-work` execution-ready boundaries.
- Do not implement LLM-as-judge in this phase.

**Test scenarios:**

- `write-audit-artifacts.js` marks the first-wave skills ready.
- JSON fixture files parse and include `schema_version` plus non-empty `cases`.
- `spec-write-tasks` remains the ready template, not a new public workflow command.

**Verification:**

- `npx jest tests/unit/skill-audit-scripts.test.js --runInBand`
- `node skills/spec-skill-audit/scripts/write-audit-artifacts.js --repo .`

### U6. Align Execution Workflow Prose With Precise Editing

**Goal:** Preserve execution speed while removing prompt tension that can cause scope creep.

**Requirements:** R6, R9

**Files:**

- Modify: `skills/spec-work/SKILL.md`
- Modify: `skills/spec-work-beta/SKILL.md`
- Modify: `tests/unit/spec-work-contracts.test.js`
- Modify: `tests/unit/spec-work-beta-contracts.test.js`
- Modify: `CHANGELOG.md`

**Approach:**

- Reframe `Start Fast, Execute Faster` to "establish success standard quickly, then execute".
- Add red flags where the executor must not fast-forward: target repo ambiguity, source-of-truth ambiguity, runtime generation, auth/security, migration, external side effects, unbounded file set.
- Limit `Simplify as You Go` to complexity introduced or directly exposed by the current change, inside current ownership/file scope.
- Tell executor to record unrelated pre-existing complexity as follow-up instead of refactoring it.
- Bring stable `spec-work` and `spec-work-beta` UI guidance parity back into alignment, while keeping beta-only delegation delta isolated.

**Test scenarios:**

- Stable and beta work skills both contain the bounded simplification rule.
- Stable and beta work skills both contain the success-standard-first wording.
- Beta delegation remains explicit opt-in.
- Tests continue to reject old host entrypoint drift.

**Verification:**

- `npx jest tests/unit/spec-work-contracts.test.js tests/unit/spec-work-beta-contracts.test.js --runInBand`

### U7. Add Agent Output And Research Evidence Contracts

**Goal:** Improve downstream consumability of agent output without flattening roles.

**Requirements:** R7, R8

**Files:**

- Modify: `docs/contracts/workflows/skill-agent-quality-governance.md`
- Modify: `agents/spec-best-practices-researcher.agent.md`
- Modify: `agents/spec-framework-docs-researcher.agent.md`
- Modify: `agents/spec-web-researcher.agent.md` if needed to become the template source
- Modify: `agents/spec-slack-researcher.agent.md`
- Create: `agents/spec-competitive-intelligence-researcher.agent.md`
- Modify: `src/cli/plugin.js` and governance contracts only if bundled runtime delivery requires the new agent to ship
- Modify or create focused agent contract tests under `tests/unit/`
- Modify: `CHANGELOG.md`

**Approach:**

- Add researcher output fields: `research_value`, `claims`, `sources`, `authority_tier`, `date_checked`, `freshness_limitations`, `untrusted_input_handling`, `actionability_for_spec_first`.
- Update `spec-best-practices-researcher` authority order:
  - project convention: project standards/skills/source docs first;
  - external facts: official docs/primary sources/current releases first;
  - local skills are historical experience, not current external fact.
- Add untrusted input handling to researchers that read external pages, GitHub issues, Slack, session history or social content.
- Add `spec-competitive-intelligence-researcher` for GitHub + Twitter/X + official/release signal synthesis. The output must separate `confirmed facts`, `market signals`, `social discourse`, `adopt`, `avoid`, and `fit-to-spec-first`.
- If the agent is bundled, update `src/cli/contracts/dual-host-governance/skills-governance.json` or relevant runtime projection source through normal source-first flow.

**Test scenarios:**

- Best-practices researcher no longer states skill-based guidance is highest authority for external API facts.
- Competitive intelligence agent requires source freshness and separates social signal from confirmed fact.
- Researchers include untrusted input handling.
- Runtime catalog/governance tests pass if the new agent is bundled.

**Verification:**

- `npx jest tests/unit/best-practices-researcher-contracts.test.js tests/unit/agent-support-contracts.test.js --runInBand`
- `npm run docs:runtime-catalog` if bundled runtime catalog changes

### U8. Add Prompt Source Drift Lint

**Goal:** Catch mechanical prompt drift before it appears in manual reviews.

**Requirements:** R5, R9, R10

**Files:**

- Create or modify: `scripts/lint-prompt-source.js`
- Create: `scripts/lint-prompt-source.config.json`
- Create: `tests/unit/lint-prompt-source.test.js`
- Modify: `package.json`
- Modify: `CHANGELOG.md`

**Approach:**

- Lint only deterministic text signals:
  - hardcoded current year outside examples/history;
  - stale slash command entrypoints;
  - option number references that mismatch nearby headings or known contracts when explicitly configured;
  - model/default drift between declared prose and helper scripts when explicitly configured;
  - source docs that present generated runtime mirrors as source truth.
- Keep semantic quality out of lint. The script can produce facts and reason codes; LLM/reviewer decides priority.
- Start with warning mode for new lint categories except known dangerous runtime/source boundary violations.

**Test scenarios:**

- Fixtures prove hardcoded current year is flagged unless under an allowlisted historical doc/example.
- Fixtures prove stale entrypoint pattern is flagged.
- Existing source tree passes or produces only expected warnings documented in test snapshots.

**Verification:**

- `npx jest tests/unit/lint-prompt-source.test.js --runInBand`
- `npm run lint:prompt-source` once added

## Sequencing

### Phase A: Safety And Deterministic Drift

Execute U1, U2, U3 first.

Exit gate:

- No default env copy.
- No unbounded delegation staging guidance.
- Gemini defaults and agent-native audit text no longer drift.
- Focused unit/contract tests pass.

### Phase B: Thin Contracts And Eval Readiness

Execute U4 and U5.

Exit gate:

- `skill-agent-quality-governance.md` exists and is contract-tested.
- First-wave public workflows have minimal eval fixtures.
- `write-audit-artifacts.js` reports first-wave readiness improvement.

### Phase C: Semantic Alignment And Research Capability

Execute U6, U7, U8.

Exit gate:

- Work/work-beta execution prose no longer conflicts with precise editing.
- Researcher authority/freshness discipline is consistent.
- Competitive intelligence researcher exists and is not treated as a fact source without verification.
- Prompt source lint catches mechanical drift without judging semantic quality.

## Review Plan

Each phase should receive a document/source review before implementation proceeds to the next phase.

- Phase A review focus: security boundary, git staging scope, rollback, tests.
- Phase B review focus: contract thinness, eval scope, no heavy state machine.
- Phase C review focus: source authority, prompt injection handling, long-context usability, workflow parity.

For skill/agent prose changes, use fresh-source eval per `docs/contracts/workflows/fresh-source-eval-checklist.md`. If helper dispatch is unavailable or unsafe, record `fresh_source_eval: not_run` with reason; do not claim typed-agent behavior passed from current-session cache.

## Verification

Minimum command set after each phase:

- `git diff --check`
- `npm run lint:skill-entrypoints`
- focused Jest tests for touched contracts
- `npm run typecheck` when JS scripts or CLI files change
- `node skills/spec-skill-audit/scripts/write-audit-artifacts.js --repo .` after eval/governance changes

Additional commands by phase:

- Phase A: `bash -n skills/git-worktree/scripts/worktree-manager.sh`; `python3 -m py_compile skills/gemini-imagegen/scripts/*.py`
- Phase B: `npx jest tests/unit/skill-audit-scripts.test.js tests/unit/skill-agent-quality-governance-contracts.test.js --runInBand`
- Phase C: `npx jest tests/unit/spec-work-contracts.test.js tests/unit/spec-work-beta-contracts.test.js tests/unit/best-practices-researcher-contracts.test.js --runInBand`

Before any commit:

- Run `gitnexus_detect_changes(scope: "staged")` and confirm changed symbols/artifacts match the phase scope.

## Risks And Mitigations

| Risk | Why it matters | Mitigation |
|---|---|---|
| Eval fixtures become ritual, not proof | Adding files without meaningful cases gives false confidence | Keep fixtures tied to concrete trigger/boundary/failure scenarios and review them like source |
| Contract doc grows into hidden rules engine | Violates Light contract | Keep one doc, four thin contracts, no semantic state machine |
| Research agent overweights Twitter/X | Social content is noisy and manipulable | Separate social discourse from confirmed facts; require primary source for factual claims |
| Prompt lint overreaches into semantic judgment | Scripts would replace LLM judgment | Lint only deterministic drift signals and reason codes |
| Work/work-beta parity refactor breaks beta isolation | Beta must remain explicit opt-in | Tests must assert beta delegation delta remains isolated |
| Runtime mirror edited directly | Creates source/runtime drift | All changes source-first; runtime regeneration only through `spec-first init --claude|--codex` when needed |

## Open Questions

### Resolved During Planning

- Should every internal skill receive eval fixtures now? No. First wave covers public workflows, high-risk execution helpers and downstream-consumed behavior.
- Should doc-review personas receive duplicated JSON schema in each agent file? No. Output contract is injected by `spec-doc-review` subagent template.
- Should competitive intelligence use Twitter/X? Yes, but only as social/market signal with source freshness and fact separation.
- Should contract definitions start as machine-readable schemas? No. Start as human-readable source contract; add schemas when deterministic validation needs them.

### Deferred To Implementation

- Exact `git-worktree` opt-in flag parsing shape.
- Whether `gemini-imagegen` should keep `gemini-3-pro-image-preview` as default after checking current official Gemini docs.
- Whether the new competitive intelligence agent ships to runtime immediately or remains source-only until a workflow consumes it.
- Whether prompt source lint should start as `warning` for all categories or fail closed for a small denylist.

## Completion Evidence

Expected artifacts after implementation:

- Safety fixes in `skills/git-worktree/` and `skills/spec-work-beta/references/`.
- Prompt drift fixes in `skills/agent-native-audit/` and `skills/gemini-imagegen/`.
- Contract doc: `docs/contracts/workflows/skill-agent-quality-governance.md`.
- First-wave eval fixtures under the selected `skills/*/evals/`.
- Researcher/competitive intelligence agent source updates under `agents/`.
- Prompt source lint and tests if Phase C proceeds.
- Changelog entries for each source-changing phase.
- Validation report under `docs/validation/`.

## Not Planned

- Full `npm test` for every docs-only or prompt-only phase unless the changed surface justifies it.
- Runtime regeneration unless source changes affect projected runtime assets and `spec-first doctor --claude|--codex` reports drift.
- External GitHub/Twitter/X data collection during this plan authoring. The new researcher agent will perform current data collection at execution time.
