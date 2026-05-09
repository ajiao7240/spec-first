---
title: "feat: 建立 skill/agent 质量治理与安全执行薄契约"
type: feat
status: active
date: 2026-05-07
revision: 3
last_updated: 2026-05-07T19:16+08:00
spec_id: 2026-05-07-001-skill-agent-quality-governance
target_repo: spec-first
origin: docs/项目审查/2026-05-07-skill-agent-prompt-expert-review.md
referenced_reviews:
  - path: docs/项目审查/2026-05-07-skill-agent-prompt-expert-review.md
    role: origin
    scope: in
  - path: docs/项目审查/2026-05-07-source-code-comprehensive-review.md
    role: cross-reference
    scope: deferred
    deferred_findings: ["P1-1", "P1-2", "P1-4", "P1-5", "P1-6"]
    followup_plan: docs/plans/2026-05-08-001-source-code-deferred-tracker.md
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

## Modification Levels

为避免 plan-level prose 修订与 implementation 落地混淆，本计划区分三层修订状态：

- **plan-prose**：仅修改本计划文档措辞，未触达任何 source。Review Reception 默认归为此层。
- **source-mod**：修改 `skills/`、`agents/`、`scripts/`、`src/cli/`、`tests/` 等仓库源码。每条 source-mod 都必须有独立 CHANGELOG 记录与 IU 编号。
- **runtime-effect**：source-mod 落地后，宿主行为发生变化（如 worktree 不再默认复制 env、delegation 不再 unbounded staging）。Phase exit gate 必须验证此层而非仅 plan-prose。

本计划当前 revision=3 及之前的所有修订都属于 plan-prose；source-mod 与 runtime-effect 由 Phase A/B/C 在执行时分批产生。Verification 与 exit gate 引用 source-mod / runtime-effect 证据，不引用 plan-prose 修订。

## Phase 1 Methodological Limits

本计划默认承认下列方法论限制是 Phase 1 已知短板，不在本计划内消除；后续 plan 显式接续：

- **fixture-only regression**：U5 的 eval fixtures 仅是结构化文档，不会被任何 runner 自动灌入模型。fixture content contract test 只能阻止"空文件 game readiness"，不能保证 prompt 行为不退化。LLM-as-judge / replay runner 是后续 plan 的能力，不在本计划范围。
- **untrusted_input_handling self-declaration**：U7 增加的字段是 agent 对自己处理方式的声明，不是 runtime 强制。无 sandbox、无 output sanitization。后续若发现 agent 输出真被 prompt injection 污染，需新建 `runtime untrusted input enforcement` 能力 plan。
- **social/confirmed/market 三类分离无验证**：D6 要求 `spec-competitive-intelligence-researcher` 在输出中区分三类，但本计划不引入 reviewer 校验该字段是否被滥用。该校验由 consumer workflow 在 dispatch 时承担。
- **plan-prose 修订不等于行为变更**：所有 Modification Levels = plan-prose 的修订（包括 Review Reception 列出的 13 条）必须在 Phase A/B/C 通过 source-mod 落地才会改变实际行为。

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
| R11 | Phase A 不得只修 `git-worktree` 而遗漏同类 `.env*` 默认复制路径 | implementation-readiness review；`skills/spec-optimize/scripts/experiment-worktree.sh` 也默认复制 `.env*` | U1 增加 repo-wide high-risk env propagation audit；同类默认复制路径必须修复、显式 opt-in，或在 Phase A exit gate 中登记为 scoped deferred risk |

## Scope Boundaries

- 本计划只承接 `docs/项目审查/2026-05-07-skill-agent-prompt-expert-review.md`（doc 1，prompt/agent 层）的 P1/P2。`docs/项目审查/2026-05-07-source-code-comprehensive-review.md`（doc 2，source-code 层）的下列 finding **不在本计划范围**：
  - doc 2 P1-1 `src/cli/state.js` managed state 删除路径 final containment guard
  - doc 2 P1-2 `.agents/plugins` Codex marketplace cleanup ownership
  - doc 2 P1-4 `package.json` / `package-lock.json` 版本漂移
  - doc 2 P1-5 `spec-standards` impact capabilities canonical path 漂移
  - doc 2 P1-6 public workflow helper / reference runtime delivery 不闭环
  - 例外：doc 2 P1-3 `spec-work-beta` 无界 staging 与 doc 1 P1-02 重叠，已通过本计划 R2/U2 覆盖。
  - 上述 deferred finding 由后续独立 plan 承接；本计划执行不应顺手修这些点。
- 本计划不把 `spec-first` 改成重状态机、中心化 gate 系统或复杂 prompt 规则引擎。
- 本计划不一次性重写 42 个 skill 和 51 个 agent。
- 本计划不手改 `.claude/`、`.codex/`、`.agents/skills/` generated runtime mirror。
- 本计划不把 external prompt docs、GitHub repo、Twitter/X 观点变成项目 source of truth。
- 本计划不要求所有 agent 输出同一 JSON schema。
- 本计划不把 low-risk optional/internal skills 纳入第一批 eval 强制覆盖；剩余 internal_only / optional skills 的 eval 决策延后到该 skill 进入 high-traffic 路径或下游 consumer 出现时再评估。
- 本计划的 Phase A 安全修复不再只以 `git-worktree` 为唯一对象。任何脚本或 skill prose 中默认复制 `.env*`、凭据、私钥或 token 的行为都必须通过 high-risk execution audit 被显式分类：本计划内修复、转成 opt-in，或写入 deferred tracker 并降低对应 exit gate 的全局成功信号。
- 本计划不引入新的 runtime workflow command；新增能力优先是 source contract、tests、agent profile 或 lint。
- 本计划不执行实际外部竞品调研，只建立可复用 competitive intelligence agent 与证据 contract。每次调研必须在执行时重新取最新来源。
- 本计划默认将 `spec-competitive-intelligence-researcher` 作为 source-only 资产创建，runtime delivery 推迟到具体 workflow 显式声明 consumer 之后。

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

目标：第一批高风险写入、shell-heavy、git、secrets、external service 相关 skill 先有同一套最小安全边界；Phase A 必须先修真实 workspace/secrets/staging 风险，再把低流量或未消费路径登记为 deferred risk。

最小能力：

- 高风险 skill 明确 writes、shell/network、secrets、git staging/commit、external service、rollback/stop condition。
- `git-worktree` 默认不复制 `.env*`。
- repo-wide high-risk execution audit 覆盖 `skills/*/scripts/*` 与高风险 skill prose，确认没有未登记的默认 `.env*` / credential propagation。当前已知同类路径：`skills/spec-optimize/scripts/experiment-worktree.sh`。
- `spec-work-beta` batch success path 只 stage batch-owned file set。

成功信号：

- 没有未登记的默认 secret propagation；如同类路径暂不在 Phase A 修复，必须有明确 deferred risk、owner 和阻断条件，不能把 Phase A 表述为全仓 secret propagation 已消除。
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

### Universal IU Rules

下列规则适用于本计划下所有 IU，避免在每个 IU 重复声明：

1. **文件存在性核验**：IU 开始时先核验 `Files` 中所有 `Modify:` 路径在仓库中实际存在；不存在的改为 `Create:` 并在 IU 末尾备注（含创建原因）。`Create:` 路径核验确实不存在，避免覆盖既有文件。
2. **fresh-source eval**：所有触及 `skills/`、`agents/` prose 的 IU 必须按 `docs/contracts/workflows/fresh-source-eval-checklist.md` 执行 fresh-source eval；helper dispatch 不可用时记录 `fresh_source_eval: not_run` 与原因，不能默认 typed-agent 缓存通过。
3. **CHANGELOG 拆条**：每个 IU 至少产生 1 条独立 CHANGELOG 记录；触及多个能力面（如 U2 同时改 task-pack schema 与 spec-work-beta reference）时拆为多条，每条聚焦一个能力面。
4. **Test 模式与 contract 关系**：Phase A 编写的 contract test 在 Phase B 出 `docs/contracts/workflows/skill-agent-quality-governance.md` 后必须做一次模式 review；若新 contract 暴露已有测试断言不一致，由 Phase B 在退出前同步迁移测试模式（视为 Phase B 的退出条件之一），不重写 Phase A 实际逻辑。
5. **Risks 表反映**：若 IU 引入新机制（如 secret deny pattern、orchestrator 三选一、audit 报告），同步在 `## Risks And Mitigations` 表中追加或更新对应行，并以 `Verified by:` 引用具体 contract test。

### U1. Harden Worktree Env Handling And Audit Default Env Propagation

**Goal:** Worktree creation no longer copies secrets by default, and Phase A cannot miss sibling scripts that copy `.env*` by default.

**Requirements:** R1, R4, R11

**Files:**

- Modify: `skills/git-worktree/SKILL.md`
- Modify: `skills/git-worktree/scripts/worktree-manager.sh`
- Modify: `skills/spec-optimize/scripts/experiment-worktree.sh`（当前已知同类 `.env*` 默认复制路径；若 implementation 决定不在 Phase A 修复，必须改为 deferred tracker 条目并降低 CUD-002 全局成功信号）
- Create: `tests/unit/git-worktree-contracts.test.js`
- Create: `tests/unit/high-risk-execution-contracts.test.js`
- Modify: `CHANGELOG.md`

**Approach:**

- Change CLI usage to `create [--copy-env] <branch-name> [from-branch]` or equivalent explicit opt-in.
- Default path prints that env files were not copied and how to opt in, without reading file contents.
- `--copy-env` copies only `.env*` except `.env.example`, preserving current backup behavior。触发时必须先输出待复制 env 文件清单（仅文件名，不读取内容），并将操作记录写入 `.worktrees/<name>/.env-copy.log`。log 治理规则：
  - log 仅记录 `timestamp`、`source_path`、`destination_path`、`size_bytes`、`sha256_8`（前 8 位指纹），禁止写文件内容；
  - log 文件路径必须出现在 worktree 内的 `.gitignore` 或全局 `.gitignore` 中，禁止纳入 commit；
  - log 默认保留 30 天，超期由 worktree-manager 在 list/clean 子命令中提示；
  - 多次 opt-in append 写入，禁止 overwrite，确保审计可追溯。
- Keep `.worktrees` gitignore and dev-tool trust behavior unchanged.
- Update prose to remove the current manual "copy `.env*`" snippet as a default recommendation; replace with explicit opt-in wording。
- Run a bounded source audit over `skills/*/scripts/*`, high-risk helper skill prose, and delegation references for default `.env*` / credential / private-key propagation. The first audit must explicitly classify `skills/spec-optimize/scripts/experiment-worktree.sh` because it currently copies `.env*` from the main repo by default.
- For every confirmed default propagation path found by the audit, either convert it to explicit opt-in with file-name-only disclosure and no content reads, or add a named deferred risk with owner, reason, and blocking condition. Do not leave the path silent while claiming "no default secret propagation".
- **U1↔U2 互锁**：worktree 内合法编辑 env 文件后，U2 的 secret deny pattern 默认仍然拒 staging，避免 env 漂入 commit。如果 batch 显式声明 `expected_side_effects` 中包含具体 env 文件名（必须精确路径，不接受 glob），且 IU 描述里明确"修改 env"为意图变更，secret deny 才让步；其他情况一律按 deny pattern 处理。这个互锁规则必须同时出现在 `skills/git-worktree/SKILL.md` 与 `skills/spec-work-beta/references/codex-delegation-workflow.md` 中。

**Test scenarios:**

- Default create path does not call/copy env files.
- `--copy-env` path copies expected env filenames and still skips `.env.example`.
- `--copy-env` 输出 env 文件清单且写入 `.env-copy.log`，log 不含文件内容、字段命中规格（timestamp/source/destination/size/sha256_8）。
- `.env-copy.log` 路径在 gitignore 中、append 模式可见、超 30 天提示存在。
- Existing destination env file is backed up only in opt-in path.
- 即使 worktree 复制了 env，U2 secret deny pattern 在 staging 时仍拒绝 env 文件，除非 batch 声明了精确 env 路径作为 `expected_side_effects`。
- `skills/spec-optimize/scripts/experiment-worktree.sh` 不再默认复制 `.env*`，或有明确 opt-in / deferred-risk contract；contract test 防止同类默认 env copy 路径再次静默出现。
- high-risk execution contract test 扫描 `skills/*/scripts/*` 和高风险 skill prose，任何默认 `.env*` / credential propagation 必须命中 allowlist 中的 explicit opt-in 或 deferred risk 记录。
- `bash -n skills/git-worktree/scripts/worktree-manager.sh` passes.
- Contract test asserts `SKILL.md` no longer says env copying is default。
- IU 开始时核验 `tests/unit/git-worktree-contracts.test.js` 是否已存在；不存在改为 Create 并在 CHANGELOG 单独记录。

**Verification:**

- `npx jest tests/unit/git-worktree-contracts.test.js --runInBand`
- `npx jest tests/unit/high-risk-execution-contracts.test.js --runInBand`
- `bash -n skills/git-worktree/scripts/worktree-manager.sh`
- `bash -n skills/spec-optimize/scripts/experiment-worktree.sh`

### U2. Bound `spec-work-beta` Delegation Staging

**Goal:** Delegated batch success cannot stage unrelated modified or untracked files.

**Requirements:** R2, R4

**Files:**

- Modify: `skills/spec-work-beta/references/codex-delegation-workflow.md`
- Modify: `skills/spec-write-tasks/references/task-pack-schema.md`（新增 `expected_side_effects` 字段定义）
- Create: `src/cli/contracts/security/secret-deny-patterns.json`（统一管理 secret deny pattern source）
- Create: `src/cli/contracts/security/secret-deny-patterns.schema.json`
- Create or Modify: `tests/unit/spec-work-beta-contracts.test.js`
- Create: `tests/unit/secret-deny-patterns-contracts.test.js`
- Modify: `CHANGELOG.md`

**Approach:**

- Replace the success-path `git add $(git diff --name-only HEAD; git ls-files --others --exclude-standard)` guidance with a batch-owned file set gate.
- Define the batch-owned set as the combined `Files` list from the plan units/tasks assigned to that batch, plus any result JSON `files_modified` that are within that combined set.
- 允许 batch 在 task-pack 中显式声明 `expected_side_effects` 白名单（如 lockfile 同步、generated fixture、formatter 邻近格式化），写入 batch-owned set 即视为合法；未声明的副作用一律视为越界。
  - **task-pack schema 同步修改**：`skills/spec-write-tasks/references/task-pack-schema.md` 新增 `expected_side_effects: string[]` 字段，每条为 repo-relative 精确路径或 glob，禁止 `**` 全仓 glob；spec-write-tasks 在生成 task-pack 时把 IU `Files` 中标 "Modify" / "Create" 的路径自动作为初始白名单候选。
- Before staging, compare actual modified/untracked files to the (batch-owned ∪ expected_side_effects) set.
- If any diff path is outside the resulting set, stop batch commit and surface到 orchestrator：orchestrator 决策 `extend-batch`、`drop-stray`、`abort` 三选一，不允许 silent auto-stage。
- 任何 staging path 命中 secret deny pattern 一律拒绝并停止 batch，无论是否在 batch-owned set 内。Secret deny pattern source 集中维护在 `src/cli/contracts/security/secret-deny-patterns.json`，初版至少覆盖：
  - 通用 env：`.env`、`.env.*`（除 `.env.example`、`.env.template`、`.env.sample`）；
  - 私钥：`*.pem`、`*.key`、`id_rsa*`、`id_ed25519*`、`id_dsa*`、`id_ecdsa*`、`*.p12`、`*.pfx`、`*.keystore`、`*.kdbx`、`*.htpasswd`；
  - 工具凭据：`.npmrc`、`.pypirc`、`.netrc`、`.git-credentials`、`.aws/credentials`、`.aws/config`、`.gcp/*credentials*.json`、`google-services.json`、`GoogleService-Info.plist`、`*serviceAccount*.json`、`firebase-adminsdk-*.json`；
  - token / secret 词形：`**/*token*`、`**/*secret*`、`**/*credentials*`、`**/*password*`、`**/*apikey*`、`**/*api_key*`（不区分大小写，配置文件中可白名单具体路径）；
  - 移动平台签名：`*.mobileprovision`、`*.cer`、`*.certSigningRequest`。
- secret-deny-patterns.json 必须支持 `allowlist`（精确路径），用于 IU 显式声明合法 env 修改（与 U1↔U2 互锁规则配合）。
- Stage only batch-owned paths. Use a path-safe approach in implementation prose and tests; do not rely on unquoted command substitution.

**Test scenarios:**

- Reference text no longer contains unbounded `git add $(git diff --name-only HEAD; git ls-files --others --exclude-standard)`.
- Reference requires batch file-set comparison before staging.
- Reference says out-of-batch diff stops commit and surfaces to orchestrator with three explicit options（extend-batch / drop-stray / abort）。
- Reference 引用 `src/cli/contracts/security/secret-deny-patterns.json` 作为 deny pattern source（不在 prose 中硬编码 pattern）。
- `secret-deny-patterns.json` schema 校验：含 `version`、`patterns[]`、`allowlist[]`、`exclusions[]` 四个根字段。
- task-pack schema 包含 `expected_side_effects` 定义；spec-write-tasks 输出样例覆盖该字段；`**` 全仓 glob 被 schema 校验拒绝。
- Reference allows IU 显式 `expected_side_effects` allowlist 并要求该字段在 plan 单元中声明。
- Reference preserves rollback path scoping to batch file list.
- secret-deny 命中场景下 staging 拒绝并 surface，含 env、private key、token、cloud credential 等至少 4 种命中样例的测试。

**Verification:**

- `npx jest tests/unit/spec-work-beta-contracts.test.js tests/unit/secret-deny-patterns-contracts.test.js --runInBand`
- Fresh-source eval per `docs/contracts/workflows/fresh-source-eval-checklist.md`（确认 spec-work-beta delegation prose 行为已对齐磁盘最新源；如 helper dispatch 不可用，记录 `fresh_source_eval: not_run` 与原因）。

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
- Replace hardcoded current-year wording in touched files with the canonical phrase mandated by U8：`use the host/session current date provided in startup reminders`。**禁止**使用 `{{year}}` / `{{current_date}}` 等占位符（U8 lint 会 flag）。仅在文件本身已被本 IU 编辑时顺手替换，不主动扫描全仓——后者由 U8 lint 承担。

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

- Create: `skills/spec-skill-audit/references/eval-fixture-schema.md`
- Create: `skills/spec-skill-audit/references/eval-fixture.schema.json`
- Create eval fixtures under:
  - `skills/using-spec-first/evals/`
  - `skills/spec-brainstorm/evals/`
  - `skills/spec-plan/evals/`
  - `skills/spec-work/evals/`
  - `skills/spec-code-review/evals/`
  - `skills/spec-doc-review/evals/`
  - `skills/spec-mcp-setup/evals/`
  - `skills/spec-update/evals/`
- Modify: `skills/spec-graph-bootstrap/evals/*.json` & `skills/spec-write-tasks/evals/*.json`（如与 canonical schema 不一致，按 IU 内迁移脚本 align，保持 ready 状态）
- Modify: `tests/unit/skill-audit-scripts.test.js`
- Modify: `CHANGELOG.md`

**Approach:**

- Reuse `skills/spec-graph-bootstrap/evals/` and `skills/spec-write-tasks/evals/` schema style.
- 由于现有 ready 模板自身 schema 不完全统一，本计划 IU 开始时先抽出 canonical fixture schema 写入 `skills/spec-skill-audit/references/eval-fixture-schema.md`（共用），再让第一批 8 个 skill 一致采用：
  - 顶层字段：`schema_version`（string，初版 `"1.0"`）、`skill`（string，对应 skill id）、`category`（enum：`trigger` / `boundary` / `failure` / `expected-behavior`）、`cases`（数组，至少 2 条）。
  - case 顶层字段：`name`（string，唯一）、`input`（object，含 `user_intent`、`context_snippets[]`、`prior_state` 可选项）、`expected_behavior` 或 `expected_violation`（至少一个非空，前者用于 trigger / expected-behavior，后者用于 boundary / failure）、`notes`（可选）。
  - failure 类必须含 `expected_violation.kind`（如 `missing_input`、`tool_unavailable`、`unauthorized_dispatch`）。
- 每个 skill 至少 4 个文件覆盖 4 个 category。
- Each skill gets four minimal files:
  - `trigger-cases.json`
  - `boundary-cases.json`
  - `failure-cases.json`
  - `expected-behavior-cases.json`
- Keep each file small: 2 to 5 cases per category.
- Cover both positive and negative routing, especially `using-spec-first` public workflow selection, `spec-plan` versus `spec-brainstorm`, and `spec-work` execution-ready boundaries.
- Do not implement LLM-as-judge in this phase（已在 Phase 1 Methodological Limits 显式承认该限制）。

**Test scenarios:**

- `write-audit-artifacts.js` marks the first-wave skills ready.
- JSON fixture files parse and 通过 canonical schema 校验：含 `schema_version="1.0"`、`skill`、`category`、`cases[]`。
- 每个 fixture 文件至少包含 2 条 case；每条 case 必须含 `name`、`input.user_intent`、`expected_behavior` / `expected_violation` 中至少一个非空字段——空数组、仅 schema_version 的占位文件、字段全为空字符串均视为 not ready，禁止用空文件 game readiness gate。
- failure-cases.json 中每条 case 必须含 `expected_violation.kind`。
- `spec-write-tasks` remains the ready template, not a new public workflow command。若 `spec-graph-bootstrap` / `spec-write-tasks` 现有 fixture 与新 schema 不一致，IU 内通过迁移脚本 align（不破坏 ready 状态）。
- 剩余 internal_only / optional skills（如 `git-commit`、`git-commit-push-pr`、`changelog`、`proof`、`feature-video` 等）继续保持 missing 状态，等待 high-traffic 触发或下游 consumer 显式声明再补 eval。该决策在 `Scope Boundaries` 中明示，本 IU 不修改它们。

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
- Bring stable `spec-work` and `spec-work-beta` UI guidance parity back into alignment：在 `skills/spec-work/SKILL.md` 中按 `spec-work-beta` 的 `Frontend Design Guidance` section 等价化（**通过 section title 锚定，不锚定行号**：插入位置位于 `Figma` 相关章节之后、`Track Progress` 章节之前）；保持 stable 不引入 beta-only delegation delta，仅同步 frontend-design phase trigger 与 done signal。如果 spec-work-beta 中该 section title 在 IU 执行前已重命名，IU 须先做 sync read 确认最新 section title 再插入。
- 同步修复 stable `spec-work` 的两个 Step 6 编号重复（按 origin review P3 finding 校正为 Step 6 / Step 7）。

**Test scenarios:**

- Stable and beta work skills both contain the bounded simplification rule.
- Stable and beta work skills both contain the success-standard-first wording.
- Stable `spec-work` 在 `Figma` 相关章节之后、`Track Progress` 章节之前存在 `Frontend Design Guidance` 等价 section（contract test 通过 markdown heading 顺序匹配，不引用行号）。
- Stable `spec-work` 不再出现重复的 Step 6 编号。
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
- Create: `docs/validation/2026-05-07-best-practices-researcher-consumer-audit.md`
- Create: `docs/validation/best-practices-researcher-consumer-audit.schema.json`
- Do not modify `src/cli/plugin.js` or `src/cli/contracts/dual-host-governance/skills-governance.json`：runtime delivery deferred per Scope Boundaries 与 P1-C。
- Modify or create focused agent contract tests under `tests/unit/`
- Modify: `CHANGELOG.md`

**Approach:**

- Add researcher output fields: `research_value`, `claims`, `sources`, `authority_tier`, `date_checked`, `freshness_limitations`, `untrusted_input_handling`, `actionability_for_spec_first`.
- Update `spec-best-practices-researcher` authority order:
  - project convention: project standards/skills/source docs first;
  - external facts: official docs/primary sources/current releases first;
  - local skills are historical experience, not current external fact.
- 在更新 `spec-best-practices-researcher` authority 前，先做 downstream consumer audit：grep 全仓 dispatch 点（`agents/`、`skills/`、`src/cli/`、`templates/`、`docs/contracts/`），确认现有调用方未对旧 authority 形成 hard-coded 依赖；若发现 consumer 显式假设旧 order，列入 deferred breaking change 并在 IU 末尾备注。
- **audit 产物规格化**：audit 报告写入 `docs/validation/2026-05-07-best-practices-researcher-consumer-audit.md`，最低字段：`audit_date`、`audit_command`（grep / 工具命令）、`hits[]`（每条含 `path`、`line`、`callsite_kind`：dispatch / prose-reference / contract-assertion、`assumes_old_authority`：true/false/unknown、`evidence_quote`）、`hard_coded_dependencies[]`（仅 true 命中）、`migration_decision`：apply-now / defer / abort、`reviewer`、`signoff_at`。
- **abort 协议**（按 `H = hard_coded_dependencies` 数量与 `P = 命中 public_workflow 的子集` 量化决策）：
  - `H == 0`：apply-now，authority change 与 audit 同 PR 提交。
  - `1 <= H <= 2` 且 `|P| == 0`：defer，逐条 hit 写入 audit `hard_coded_dependencies[]` 并标 `deferred`，authority change 仍可 apply-now。
  - `1 <= H <= 2` 且 `|P| >= 1`：defer，**且** authority change 必须 abort（保留新增字段与新 agent 创建），由独立 plan 处理 public workflow 迁移。
  - `H >= 3`（不论 `|P|`）：abort，authority change 整体推迟到独立 plan；audit 仍归档为 source-of-truth。
  - 任一 abort 决策都必须在 audit 文档 `migration_decision: abort` 中记录触发条件（`H`、`|P|`、命中 public workflow 路径列表），并在父 plan tracker 中追加触发条件。
- Add untrusted input handling to researchers that read external pages, GitHub issues, Slack, session history or social content.
- Add `spec-competitive-intelligence-researcher` for GitHub + Twitter/X + official/release signal synthesis. The output must separate `confirmed facts`, `market signals`, `social discourse`, `adopt`, `avoid`, and `fit-to-spec-first`.
- 默认作为 source-only agent 创建，不在本计划内推到 runtime delivery。`src/cli/contracts/dual-host-governance/skills-governance.json` 与 `src/cli/plugin.js` 的 bundling 修改延后到具体 workflow（如未来的 `spec-research` 或 `spec-ideate` 扩展）显式声明 consumer 之后再单独 plan 处理。

**Test scenarios:**

- Best-practices researcher no longer states skill-based guidance is highest authority for external API facts.
- `docs/validation/2026-05-07-best-practices-researcher-consumer-audit.md` 存在且通过 schema 校验（必填字段非空、`migration_decision` ∈ {apply-now, defer, abort}）。
- audit 决策 = abort 时，spec-best-practices-researcher authority prose 修改不被 commit；决策 = apply-now 时 prose 修改与 audit 同 PR 提交。
- Competitive intelligence agent requires source freshness and separates social signal from confirmed fact.
- Researchers include untrusted input handling.
- Runtime catalog/governance tests 不需断言 `spec-competitive-intelligence-researcher` 已 bundled——本计划保持 source-only。

**Verification:**

- `npx jest tests/unit/best-practices-researcher-contracts.test.js tests/unit/agent-support-contracts.test.js --runInBand`
- 不运行 `npm run docs:runtime-catalog`：本计划不变更 bundled runtime catalog。

### U8. Add Prompt Source Drift Lint

**Goal:** Catch mechanical prompt drift before it appears in manual reviews.

**Requirements:** R5, R9, R10

**Files:**

- Create or modify: `scripts/lint-prompt-source.js`
- Create: `scripts/lint-prompt-source.config.json`
- Create: `scripts/lint-prompt-source.config.schema.json`
- Create: `tests/unit/lint-prompt-source.test.js`
- Modify: `package.json`（新增 `lint:prompt-source` script）
- Modify: `.github/workflows/ai-dev-quality-gate.yml`（path filter 覆盖 `skills/`、`agents/`、`templates/`、`docs/contracts/`；新增读 lint 输出并在 `release_age >= 2` 时失败的 step）
- Modify: `CHANGELOG.md`

**Approach:**

- 新建独立 lint 而非扩展 `scripts/lint-skill-entrypoints.js`：现有 lint 关注 entrypoint frontmatter / 入口治理，prompt-source lint 关注文本级 drift；二者关注面不同，合并会让单脚本既懂 entrypoint schema 又懂 prose 模式，违反 single responsibility。**前置条件**：在 IU 开始时先复核 `scripts/lint-skill-entrypoints.js` 是否已具备规则扩展点；若可低成本加入 prose lint 规则，则改为扩展该脚本并在 IU 中说明决策。
- Lint only deterministic text signals:
  - hardcoded current year outside examples/history（年份漂移）；prose 必须改为 "use the host/session current date provided in startup reminders" 类提示，禁止使用占位符（`{{year}}` / `{{current_date}}`）——由宿主在 SessionStart hook / 启动 reminder 中注入；
  - stale slash command entrypoints；
  - option number references that mismatch nearby headings or known contracts when explicitly configured；
  - model/default drift between declared prose and helper scripts when explicitly configured；
  - source docs that present generated runtime mirrors as source truth.
- Keep semantic quality out of lint. The script can produce facts and reason codes; LLM/reviewer decides priority.
- Start with warning mode for new lint categories except known dangerous runtime/source boundary violations。**warning 升级 fail-closed 的可执行机制**：
  - lint config 中每条 rule 必须含 `severity`（warning / error）与 `introduced_in_release`（语义版本号）；
  - `scripts/lint-prompt-source.js` 在 warning 模式输出 `release_age = current_release - introduced_in_release`；
  - 新增 CI step 在 `.github/workflows/ai-dev-quality-gate.yml` 中读取 lint 输出：当某条 rule 的 `release_age >= 2` 且当前仓库仍有该规则的 warning 时，CI 失败并要求该 rule 在下一次 release 前升级 severity 为 error 或显式加入 `exceptions[]`；
  - `exceptions[]` 必须含 `rule_id`、`path_glob`、`reason`、`expires_at`（必填，禁止永不过期）；
  - 升级动作由人工触发（修改 lint config severity 字段），但 CI 在 release_age >= 2 时强制要求决策，不允许 warning 永久存在。
- IU 必须同时更新 `.github/workflows/ai-dev-quality-gate.yml` 的 path filter 让 lint 触发在 skill / agent / template / docs/contracts 目录下都生效。

**Test scenarios:**

- Fixtures prove hardcoded current year is flagged unless under an allowlisted historical doc/example.
- Fixtures prove prose 使用 `{{year}}` / `{{current_date}}` 类占位符时被 flag。
- Fixtures prove stale entrypoint pattern is flagged.
- Existing source tree passes or produces only expected warnings documented in test snapshots.
- lint config schema 校验：每条 rule 必须含 `severity`、`introduced_in_release`，`exceptions[]` 必须含 `expires_at`。
- CI 模拟测试：构造 release_age >= 2 且仍 warning 的场景，断言 CI 失败。
- IU 决策记录（扩展现有 lint vs 新建独立 lint）出现在 `CHANGELOG.md` 或 PR 描述。

**Verification:**

- `npx jest tests/unit/lint-prompt-source.test.js --runInBand`
- `npm run lint:prompt-source` once added

## Sequencing

每个 Phase exit gate 验证的是 source-mod / runtime-effect 证据，不接受仅 plan-prose 的"声明已应用"。所有 phase 退出前必须按 Universal IU Rules 第 5 条同步更新 Risks 表 `Verified by` 列。

### Phase A: Safety And Deterministic Drift

Execute U1, U2, U3 first.

Exit gate（全部满足才能退出）：

- **U1 落地**：`skills/git-worktree/SKILL.md` 与 `worktree-manager.sh` 默认不复制 env；`--copy-env` opt-in 路径写 `.env-copy.log`（仅指纹，append-only，进 gitignore）；`skills/spec-optimize/scripts/experiment-worktree.sh` 的默认 `.env*` 复制路径已修复为 opt-in 或被登记为 scoped deferred risk；repo-wide high-risk env propagation audit 已记录结果；`tests/unit/git-worktree-contracts.test.js` 与 `tests/unit/high-risk-execution-contracts.test.js` 通过。
- **U2 落地**：`skills/spec-work-beta/references/codex-delegation-workflow.md` 不再含 unbounded `git add`；引入 batch-owned ∪ `expected_side_effects` 集合 + orchestrator 三选一；`src/cli/contracts/security/secret-deny-patterns.json` 存在并通过 schema 校验；`skills/spec-write-tasks/references/task-pack-schema.md` 含 `expected_side_effects` 字段定义且禁 `**` 全仓 glob；U1↔U2 互锁条文同时出现在两份 source；`tests/unit/spec-work-beta-contracts.test.js`、`tests/unit/secret-deny-patterns-contracts.test.js` 通过。
- **U3 落地**：`agent-native-audit` option/typo 修复；`gemini-imagegen` prose 与 scripts 默认模型/扩展名一致；触及文件中的 hardcoded year 已替换为 U8 canonical wording；contract test 与 `python3 -m py_compile` 通过。
- **fresh-source eval**：U1 / U2 / U3 各自记录 `fresh_source_eval: ran` 或 `not_run` 与原因。
- **CHANGELOG**：U1 / U2 / U3 至少各 1 条独立记录（U2 因跨能力面允许多条）。

### Phase B: Thin Contracts And Eval Readiness

Execute U4 and U5.

Exit gate：

- **U4 落地**：`docs/contracts/workflows/skill-agent-quality-governance.md` 存在并涵盖四类薄契约；含 doc-review orchestrator-injected schema 例外条款；`tests/unit/skill-agent-quality-governance-contracts.test.js` 通过。
- **U5 canonical schema**：`skills/spec-skill-audit/references/eval-fixture-schema.md` 与 `eval-fixture.schema.json` 存在；现有 ready 模板（`spec-graph-bootstrap` / `spec-write-tasks`）若不一致已对齐。
- **First-wave 8 个 skill** 各自有 4 类 fixture 且通过 fixture content contract test（每文件 ≥2 条 case；case 含 `name`、`input.user_intent`、`expected_behavior` / `expected_violation` 至少一项非空；failure 类含 `expected_violation.kind`）。
- **`write-audit-artifacts.js`** 输出 readiness summary：first-wave 8 个 skill 全部 `ready`；`spec-write-tasks` 仍 `ready`。
- **Phase A test 模式 review**：Phase A 编写的 contract test 已对照新 governance contract 模式 review；不一致项已迁移（视为 Phase B 退出条件）。
- **Risks 表**：含 fixture canonical schema、contract doc 边界相关 mitigation，`Verified by` 引用真实 test。

### Phase C: Semantic Alignment And Research Capability

Execute U6, U7, U8.

Exit gate：

- **U6 落地**：stable `spec-work` 与 beta UI guidance parity（按 `Frontend Design Guidance` section title 锚定）；stable Step 6 重号已修复；`Start Fast` 改为"先建立成功标准再执行"；`Simplify as You Go` 限定到本次 ownership；`tests/unit/spec-work-contracts.test.js`、`spec-work-beta-contracts.test.js` 通过且断言 beta delegation delta 仍隔离。
- **U7 落地**：`docs/validation/2026-05-07-best-practices-researcher-consumer-audit.md` 存在且通过 schema 校验；`migration_decision` ∈ {apply-now, defer, abort} 已记录且按 abort 协议执行；researcher 输出字段（`research_value`、`claims`、`sources`、`authority_tier`、`date_checked`、`freshness_limitations`、`untrusted_input_handling`、`actionability_for_spec_first`）已加入相关 agent profile；`spec-competitive-intelligence-researcher.agent.md` 创建为 source-only（runtime catalog 未变）；`tests/unit/best-practices-researcher-contracts.test.js`、`tests/unit/agent-support-contracts.test.js` 通过。
- **U8 落地**：`scripts/lint-prompt-source.js` 与 config / config-schema 存在；`.github/workflows/ai-dev-quality-gate.yml` path filter 覆盖 4 类目录且新增 `release_age >= 2` 失败 step；lint config 每条 rule 含 `severity` / `introduced_in_release`，`exceptions[]` 含 `expires_at`；`npm run lint:prompt-source` 通过；`tests/unit/lint-prompt-source.test.js` 通过（含 `release_age >= 2` 模拟失败用例）。
- **Phase B contract review**：Phase B 后续修改若影响 Phase C 契约一致性，已同步 review（视为 Phase C 退出条件）。
- **Risks 表**：含 abort 协议、CI warning 升级、UI parity section title 锚定相关 mitigation，`Verified by` 引用真实 test。

## Review Plan

Each phase should receive a document/source review before implementation proceeds to the next phase.

- Phase A review focus: security boundary, git staging scope, rollback, tests.
- Phase B review focus: contract thinness, eval scope, no heavy state machine.
- Phase C review focus: source authority, prompt injection handling, long-context usability, workflow parity.

For skill/agent prose changes, use fresh-source eval per `docs/contracts/workflows/fresh-source-eval-checklist.md`. If helper dispatch is unavailable or unsafe, record `fresh_source_eval: not_run` with reason; do not claim typed-agent behavior passed from current-session cache.

每次 phase 执行结束后须做以下治理动作：

- **PR 描述同步**：phase 关联 PR 描述必须复制最近一次 `## Review Reception` 摘要（按 finding ID 列表 + 修订状态），让 PR reviewer 看见当前修订上下文。
- **未应用 finding 复审条件**：所有标 "FYI / advisory / 不在本计划范围" 的 finding 必须写入 followup tracker（默认 `docs/plans/2026-05-08-001-source-code-deferred-tracker.md` 或对应能力领域 plan），含 `finding_id`、`source_review_path`、`reaffirm_trigger`（重审触发条件，如 "next prompt-source lint upgrade"、"any new researcher agent"），不允许仅靠 prose "implementation-time 注意事项" 兜底。

## Verification

Minimum command set after each phase:

- `git diff --check`
- `npm run lint:skill-entrypoints`
- focused Jest tests for touched contracts
- `npm run typecheck` when JS scripts or CLI files change
- `node skills/spec-skill-audit/scripts/write-audit-artifacts.js --repo .` after eval/governance changes

Additional commands by phase:

- **Phase A**：
  - `bash -n skills/git-worktree/scripts/worktree-manager.sh`
  - `bash -n skills/spec-optimize/scripts/experiment-worktree.sh`
  - `python3 -m py_compile skills/gemini-imagegen/scripts/*.py`
  - `npx jest tests/unit/git-worktree-contracts.test.js tests/unit/high-risk-execution-contracts.test.js tests/unit/spec-work-beta-contracts.test.js tests/unit/secret-deny-patterns-contracts.test.js tests/unit/agent-native-architecture-contracts.test.js tests/unit/skill-shell-safety.test.js --runInBand`
  - schema 校验：`src/cli/contracts/security/secret-deny-patterns.json` 通过 `secret-deny-patterns.schema.json`
  - schema 校验：`skills/spec-write-tasks/references/task-pack-schema.md` 中 `expected_side_effects` 字段引用样例通过 spec-write-tasks 现有 task-pack contract test
- **Phase B**：
  - `npx jest tests/unit/skill-audit-scripts.test.js tests/unit/skill-agent-quality-governance-contracts.test.js --runInBand`
  - canonical fixture schema 自校验：`eval-fixture.schema.json` 对 `skills/spec-graph-bootstrap/evals/*.json`、`skills/spec-write-tasks/evals/*.json` 与第一批 8 个 skill evals 全部通过
  - `node skills/spec-skill-audit/scripts/write-audit-artifacts.js --repo .` 输出 first-wave readiness 全 `ready`
- **Phase C**：
  - `npx jest tests/unit/spec-work-contracts.test.js tests/unit/spec-work-beta-contracts.test.js tests/unit/best-practices-researcher-contracts.test.js tests/unit/agent-support-contracts.test.js tests/unit/lint-prompt-source.test.js --runInBand`
  - `npm run lint:prompt-source`
  - schema 校验：`docs/validation/2026-05-07-best-practices-researcher-consumer-audit.md` 通过 `best-practices-researcher-consumer-audit.schema.json`
  - CI 模拟：构造 `release_age >= 2` 仍 warning 场景，断言 `.github/workflows/ai-dev-quality-gate.yml` lint step 失败

Before any commit:

- 先 `git add` 当前 phase 计划单元产物，再调用 `gitnexus_detect_changes()`，确认 staged symbols/artifacts 与 phase scope 匹配；若 GitNexus 后续支持参数化 scope，再通过 contract test 升级调用形态。

## Risks And Mitigations

| Risk | Why it matters | Mitigation | Verified by |
|---|---|---|---|
| Eval fixtures become ritual, not proof | Adding files without meaningful cases gives false confidence | Keep fixtures tied to concrete trigger/boundary/failure scenarios; canonical fixture schema 在 `eval-fixture-schema.md`；fixture content contract test 拒绝空字段 | `tests/unit/skill-audit-scripts.test.js`、`canonical fixture schema` 校验 |
| Contract doc grows into hidden rules engine | Violates Light contract | Keep one doc, four thin contracts, no semantic state machine | `tests/unit/skill-agent-quality-governance-contracts.test.js` |
| Research agent overweights Twitter/X | Social content is noisy and manipulable | Separate social discourse from confirmed facts; require primary source for factual claims；untrusted_input_handling 字段（self-declaration，已在 Phase 1 Limits 声明） | `tests/unit/best-practices-researcher-contracts.test.js` |
| Prompt lint overreaches into semantic judgment | Scripts would replace LLM judgment | Lint only deterministic drift signals and reason codes; warning 升级 fail-closed 由 CI 强制（release_age >= 2） | `tests/unit/lint-prompt-source.test.js`、CI step in `.github/workflows/ai-dev-quality-gate.yml` |
| Work/work-beta parity refactor breaks beta isolation | Beta must remain explicit opt-in | Tests must assert beta delegation delta remains isolated；UI parity 通过 section title 锚定不锚行号 | `tests/unit/spec-work-contracts.test.js`、`tests/unit/spec-work-beta-contracts.test.js` |
| Runtime mirror edited directly | Creates source/runtime drift | All changes source-first; runtime regeneration only through `spec-first init --claude\|--codex` when needed | `npm run lint:skill-entrypoints` |
| `--copy-env` opt-in 仍泄露 secrets | opt-in 用户决策门槛低，env 易漂入 commit | U1 输出 `.env-copy.log`（仅指纹）；U2 secret deny pattern 默认拒 staging；U1↔U2 互锁仅放精确路径 allowlist | `tests/unit/git-worktree-contracts.test.js`、`tests/unit/secret-deny-patterns-contracts.test.js` |
| Phase A 漏掉 `git-worktree` 之外的默认 secret propagation | 同类风险可能藏在 optional/internal 脚本中，导致安全 exit gate 虚假通过 | U1 增加 high-risk execution audit；当前已知 `spec-optimize` env copy 必须修复、opt-in 或登记 deferred risk；contract test 扫描同类默认 propagation | `tests/unit/high-risk-execution-contracts.test.js` |
| Batch-owned + side_effects 仍误 stage 越界文件 | delegation 成功路径默认信任 batch，未声明的副作用可能漂入 | orchestrator 三选一（extend-batch / drop-stray / abort）；secret deny 跨集合一律拒；`expected_side_effects` 不接受 `**` 全仓 glob | `tests/unit/spec-work-beta-contracts.test.js` |
| `spec-best-practices-researcher` authority 升级破坏 downstream consumer | hard-coded 假设旧 order 的 dispatch 点会静默失效 | U7 强制 audit `docs/validation/...consumer-audit.md`；abort 协议（>=3 hard-coded 或 public workflow 命中触发 abort） | `docs/validation/2026-05-07-best-practices-researcher-consumer-audit.md` 校验、`tests/unit/best-practices-researcher-contracts.test.js` |
| reviewer dispatch 失败导致审查降级 fallback | single-orchestrator 易漏 persona 视角 | reviewer 恢复后须重做一轮 cross-check；本轮失败根因记录在 `docs/solutions/workflow-issues/reviewer-dispatch-failure-2026-05-07.md` | followup plan 中的 review re-run 任务 |
| Plan-prose 修订被误读为行为变更 | Review Reception 列表易让读者以为 source 已改 | 引入 Modification Levels（plan-prose / source-mod / runtime-effect）；exit gate 引用 source-mod 证据 | Phase A/B/C exit gate 文案校验 |

## Open Questions

### Resolved During Planning

- Should every internal skill receive eval fixtures now? No. First wave covers public workflows, high-risk execution helpers and downstream-consumed behavior。剩余 internal_only / optional skills 延后到 high-traffic 触发或下游 consumer 出现时再评估。
- Should doc-review personas receive duplicated JSON schema in each agent file? No. Output contract is injected by `spec-doc-review` subagent template.
- Should competitive intelligence use Twitter/X? Yes, but only as social/market signal with source freshness and fact separation.
- Should contract definitions start as machine-readable schemas? No. Start as human-readable source contract; add schemas when deterministic validation needs them.
- Should `spec-competitive-intelligence-researcher` ship to runtime in this plan? No. 默认 source-only；runtime delivery 推迟到具体 workflow 显式声明 consumer 后由独立 plan 处理。
- Should U8 extend `lint-skill-entrypoints` or create new lint? Default 新建独立 lint；IU 开始时复核现有 lint 是否易扩展，若易扩展则改方案并记录决策。
- Should the `gitnexus_detect_changes` call use a `scope` argument? No。CLAUDE.md 标准用法是无参；本计划先 `git add` phase 产物再调用。
- Are doc 2（source-code-comprehensive-review）的 P1-1/P1-2/P1-4/P1-5/P1-6 在本计划范围？No。已在 Scope Boundaries 中明示 deferred；本计划只承接 doc 1 的 P1/P2。

### Deferred To Implementation

- Exact `git-worktree` opt-in flag parsing shape.
- Whether `gemini-imagegen` should keep `gemini-3-pro-image-preview` as default after checking current official Gemini docs.
- 具体 `spec-best-practices-researcher` downstream consumer audit 报告的呈现形式（PR 评论 / IU 备注 / docs/validation 子文档）。
- `spec-work` UI Quality Guard 段落的具体措辞（按 spec-work-beta `Frontend Design Guidance` section title 锚定等价化，不引入新规则；具体 wording 在 IU 执行时按当前 beta 措辞决定）。
- `lint-prompt-source` 的 `exceptions[]` 初始名单与豁免理由（`severity` / `release_age` / 升级机制已在 U8 Approach 中规格化，仅初始数据待定）。

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

## Review Reception

### 2026-05-07 第 1 轮（fallback）

通过 `/spec:doc-review` 对本计划做 single-agent report-only 审查（reviewer dispatch 因 1m context API 与服务端 panic 不可用，按 fallback 协议执行）。审查应用 6 类 inline persona checklist：coherence、feasibility、scope-guardian、adversarial、product-lens、security-lens。

修订级别说明：本轮 13 条 finding 的 "已应用" 全部为 **plan-prose** level（仅修改本文档措辞），未触达任何 source。Phase A/B/C 执行时由对应 IU 把 plan-prose 修订转化为 **source-mod** 与 **runtime-effect**。

| ID | Finding | Modification Level | Followup |
|---|---|---|---|
| P1-A | Scope Boundaries 显式 doc 2 deferred 与例外 | plan-prose | E-1 followup tracker |
| P1-B | U2 batch staging side-effect/secret deny | plan-prose（待 U2 source-mod 落地） | Phase A |
| P1-C | competitive-intelligence agent source-only | plan-prose | runtime delivery 推迟到独立 plan |
| P1-D | U5 fixture content contract test | plan-prose（待 U5 source-mod 落地） | Phase B |
| P1-E | gitnexus 调用形态修复 | plan-prose | Verification 节直接生效 |
| P1-F | spec-best-practices-researcher consumer audit | plan-prose（待 U7 source-mod 落地） | Phase C |
| P2-A | U8 占位符禁用 + 宿主注入日期 | plan-prose | Phase C |
| P2-B | spec-work UI guidance section title 锚定 | plan-prose | Phase C |
| P2-C | U8 lint reconcile + warning 升级 enforcement | plan-prose | Phase C |
| P2-D | U2 fresh-source eval | plan-prose | Phase A |
| P2-E | 剩余 internal_only 延后策略 | plan-prose | Scope Boundaries 直接生效 |
| P2-SE-1 | U1 opt-in audit log | plan-prose | Phase A |
| P2-SE-2 | U2 secret deny pattern 集中化 | plan-prose | Phase A |

未应用 finding（advisory，已写入 followup tracker，按 reaffirm_trigger 重审）：FYI-1 / FYI-2 / FYI-3 / P2-SE-3 / Doc 1 / Doc 2 meta 短板。

### 2026-05-07 第 2 轮（self-meta-review）

发现第 1 轮修订引入新问题清单（27 项），按 Issue 分类编辑器复盘后再次 plan-prose 修订，覆盖：

- A-1 / A-2 / A-3 / A-4：新增 `## Modification Levels` 与 `## Phase 1 Methodological Limits` 段，显式承认 plan-prose 与方法论 Phase 1 限制。
- B-1：U1↔U2 互锁段（worktree 内合法 env 编辑须显式精确路径声明）。
- B-2：U2 同步修改 `task-pack-schema.md` 增 `expected_side_effects` 字段。
- B-3：U6 锚点改 section title。
- B-4：U7 abort 协议（hard-coded >=3 或 public workflow 命中触发 abort）。
- C-1：U2 secret deny pattern 集中到 `src/cli/contracts/security/secret-deny-patterns.json`，扩展至工具凭据、移动签名、token 词形。
- C-2：U5 canonical fixture schema（`schema_version`、`skill`、`category`、`cases[]` + case 字段约束）。
- C-3：U7 audit 报告 schema（`docs/validation/...consumer-audit.md`）。
- C-4：U8 warning 升级 enforcement（CI 读 `release_age >= 2` 强制升级）。
- C-5：U1 `.env-copy.log` 治理（指纹/gitignore/30 天保留/append-only）。
- D-1：Universal IU Rules 中加入文件存在性核验。
- D-2：Universal IU Rules 中加入 Phase A test 模式与 contract 关系协议。
- D-3：Risks 表整体重构，新增 5 行机制对应 mitigation 与 `Verified by`。
- D-4：Universal IU Rules 全覆盖 fresh-source eval。
- D-5：Universal IU Rules 要求 CHANGELOG 拆条（每 IU ≥1 条）。
- E-1：frontmatter 引用 followup tracker `docs/plans/2026-05-08-001-source-code-deferred-tracker.md`（已创建）。
- E-2：Risks 表加 reviewer dispatch 失败 mitigation，followup 在 `docs/solutions/workflow-issues/reviewer-dispatch-failure-2026-05-07.md`（已创建）。
- E-3 / E-4：frontmatter 增 `revision`、`last_updated`、`referenced_reviews`。
- E-5：Review Plan 节加 followup tracker 写入要求。
- E-6：Review Plan 节加 PR 描述同步要求。
- F-1：依赖 reviewer dispatch 恢复后重做 multi-persona cross-check（已写入 followup tracker）。
- F-2：审查流程改进归入独立 plan（待创建）。

第 2 轮仍属 plan-prose；落地仍需 Phase A/B/C source-mod。

### 2026-05-07 第 3 轮（终审修订）

第 2 轮后做一次全面终审，识别 F1–F10 必修项 + S 类建议项。逐条修订：

- **F1**：删 U2 重复 `**Files:**` 段。
- **F2**：删 U7 Files 中与 P1-C 决策矛盾的 plugin.js 行，改为 `Do not modify` 显式声明。
- **F3**：U7 Files 补 `docs/validation/2026-05-07-best-practices-researcher-consumer-audit.md` 与对应 schema。
- **F4**：U5 Files 补 `skills/spec-skill-audit/references/eval-fixture-schema.md` 与对应 JSON schema；现有 ready 模板 align 写入 Files。
- **F5**：U8 Files 补 `.github/workflows/ai-dev-quality-gate.yml`、lint config schema。
- **F6**：Open Questions 删 `spec-work-beta:433-440` 行号锚点，改 section title 锚定描述。
- **F7**：Open Questions 删已被 U8 解决的 warning 升级 question；保留尚未确定的 `exceptions[]` 初始名单。
- **F8**：U3 Approach 显式引用 U8 canonical wording `use the host/session current date provided in startup reminders`，禁占位符。
- **F9**：重写 Phase A/B/C exit gate，逐项引用 source-mod 证据（U1–U8 各自落地条件、fresh-source eval、CHANGELOG 拆条、Phase-to-Phase contract review）。
- **F10**：Verification 节按 phase 列出完整 test 命令集，含 `secret-deny-patterns-contracts.test.js` / `lint-prompt-source.test.js` / consumer-audit schema 校验 / CI 模拟。
- **S3**：U7 abort 协议量化为 `H` / `|P|` 公式，覆盖边界条件。
- **S6**：CHANGELOG 第 2 轮 issue 计数从 27 勘误为 26（A4+B4+C5+D5+E6+F2）。

第 3 轮仍属 plan-prose；P 类（必修）已全部消除，S/L 类剩余项保留为 plan-prose 滚动维护。批量验收：F 类 0 条剩余，可进入 Phase A U1（git-worktree）开发。

未应用的 S 类（保留为后续滚动修订）：

- S1（Universal IU Rules 第 4 条仅覆盖 A→B 测试模式迁移，未补 B→C）
- S2（Phase 1 Limits fixture 描述偏弱）
- S4（Modification Levels 与 Sequencing 关系未在 Sequencing 节内重申，但 Phase 9 已通过 exit gate 重写隐式覆盖）
- S5（competitive-intelligence agent dead-end consumer dispatch 校验）
- S7–S14（命名对称、tracker 反向引用等治理闭环建议）
- L1–L6（措辞 / 可读性）

上述项不阻塞执行，由后续 plan revision 或独立审查流程改进 plan 接续。

### 2026-05-07 第 1 轮明细（保留作历史）

已在本版本应用的修订：

- P1-A：Scope Boundaries 显式列出 doc 2 的 deferred P1 与例外。
- P1-B：U2 batch staging 增加 `expected_side_effects` allowlist、orchestrator 三选一决策协议、secret deny pattern。
- P1-C：U7 默认将 `spec-competitive-intelligence-researcher` 作为 source-only；runtime delivery 推迟到 consumer 出现后由独立 plan 处理。
- P1-D：U5 fixture content contract test，禁止用空文件 game readiness。
- P1-E：Verification 修复 `gitnexus_detect_changes()` 调用形态（无参）。
- P1-F：U7 增加 `spec-best-practices-researcher` 下游 consumer audit 步骤。
- P2-A：U8 prose 禁止占位符，要求宿主 SessionStart hook / 启动 reminder 注入当前日期。
- P2-B：U6 指定 stable `spec-work` 的 UI guidance 插入位置（Figma stage 之后、Track Progress 之前），并修复 Step 6 重复编号。
- P2-C：U8 显式 IU 开始时复核 `lint-skill-entrypoints` 扩展可行性，记录决策。
- P2-D：U2 Verification 增加 fresh-source eval 步骤。
- P2-E：U5 / Scope Boundaries 明示剩余 internal_only / optional skills 延后策略。
- P2-SE-1：U1 `--copy-env` 触发输出文件清单与 `.env-copy.log`，不写文件内容。
- P2-SE-2：U2 secret deny pattern（`.env*`、`*.pem`、`*.key`、`id_rsa*`、`secrets.*` 等）一律拒绝 staging。

未应用的 finding（advisory only，不动 plan 主体）：

- FYI-1 4 类薄契约单文件 vs 拆分：保持单文件，未来契约扩张时再评估。
- FYI-2 Risks mitigation 加 "Verified by"：第 2 轮已应用（见 Risks 表）。
- FYI-3 competitive-intelligence agent "新增 vs 收敛" 路径：已通过 P1-C 决策（source-only 新增）间接表态。
- P2-SE-3 D6 Twitter/X 出方约束（IP / 身份）：作为 implementation-time 注意事项，不写入 plan，由具体 consumer plan 承担。

Review docs（doc 1 / doc 2）的 meta 质量短板（P-numbering 不统一、URL freshness 时间戳缺失、Coverage Ledger Appendix 体积大）属于已交付 review 报告的回顾性问题，不在本计划修订范围；后续审查流程改进 plan 处理。
