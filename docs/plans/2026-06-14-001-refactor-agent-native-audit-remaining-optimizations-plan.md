---
title: refactor: 收敛 agent-native 审查剩余优化项
type: refactor
status: active
date: 2026-06-14
spec_id: 2026-06-14-001-agent-native-audit-remaining-optimizations
origin: docs/项目审查/2026-06-12-agent-native-architecture-audit-report.md
---

# refactor: 收敛 agent-native 审查剩余优化项

## Summary

本计划把 `2026-06-12-agent-native-architecture-audit-report.md` 中仍未完成或仅部分完成的优化点，按当前本地 source 重新收敛为可执行切片。W1 Eval readiness 已在 `2026-06-13-002` 计划中完成，本计划只处理剩余 XS/S/M 卫生项、legacy 收口项和条件项。

---

## Decision Brief

- **Recommended approach:** 先落 P0 的低风险确定性收敛，再处理 source/runtime 卫生和 legacy 删除；Runtime Setup alias、doctor JSON freshness、schema-validator details 保持独立或条件式，不混进快速修复。
- **Key decisions:** 以当前 source 为准，不把审查报告旧结论当 deterministic truth；所有 runtime mirror 仍由 `spec-first init` 再生，不手改 `.claude/`、`.codex/`、`.agents/skills/`。
- **Validation focus:** 每个切片配 focused contract/unit test；影响 setup 双宿主脚本的切片同时覆盖 Bash 与 PowerShell；legacy 删除必须以现有 Jest integration 覆盖承接为前提。
- **Largest risks / boundaries:** 当前工作树存在大量无关 dirty docs 变更，实施前必须重新核对 in-scope diff，避免覆盖用户改动；本计划不引入重型 eval 框架、不新增硬 gate、不把 LLM judge 变成 release blocker。

---

## Problem Frame

原审查报告已经确认 spec-first 的 agent-native 架构主线健康，真正系统性短板 W1 Eval readiness 已经落地完成。剩余问题集中在两类：

- 已明确的 XS/S 工程卫生：过期 help 文案、setup helper URL 双份维护、CI path trigger 漏接、support-file drift false positive、clean apply 前可见性不足、guardrail 文档缺 workflow 应用索引。
- 需要独立处理或保持条件式的收口项：legacy shell e2e 链仍 live-but-vestigial、Runtime Setup alias 迁移仍 deferred、doctor JSON freshness 投影和 schema-validator `details[]` 需要 consumer 证据。

本计划目标是把这些优化点拆成最小可维护落地顺序，避免把已经完成的 W1 或仍无消费者的 speculative schema 扩展重新做一遍。

---

## Requirements

- R1. 明确 W1 Eval readiness 已完成，禁止重复规划 schema/fixture/scorer 主线。
- R2. P0 修复必须是低风险、可并行、focused test 可证明的 source-only 变更。
- R3. 所有涉及 setup helper 的变更必须保持 Bash/PowerShell 对称，并从 registry 读取确定性 facts。
- R4. 所有 source/runtime 相关变更必须遵守 source-first：只改 `skills/`、`templates/`、`src/cli/`、`tests/`、`.github/`、`docs/` 等 source，不手改 generated runtime mirrors。
- R5. Legacy 删除必须先证明当前 Jest integration 覆盖仍承接 workflow closeout/verification 语义。
- R6. 条件项只有在 consumer 或明确 runtime closeout 需求存在时进入实现，不为了 schema 完整性提前扩展。
- R7. 每个实施切片必须同步 `CHANGELOG.md`，并声明是否影响用户可见行为和 runtime regeneration。

---

## Assumptions

- A1. 当前本地 HEAD `59d4bd15` 上，`docs/plans/2026-06-13-002-refactor-eval-readiness-fixture-schema-plan.md` 的 `status: completed` 与 `CHANGELOG.md` 记录足以把 W1 视为已完成基线。
- A2. 当前工作树存在大量无关 docs 迁移/治理 dirty 变更；执行本计划时必须在每个切片开头重跑 `git status --short` 并只处理 in-scope 文件。
- A3. Graphify 在本轮探索中只作为 `provider_untrusted` 导航；其 query 召回偏离主题，结论不依赖 Graphify 输出。

---

## Scope Boundaries

- 不重做 W1 eval fixture schema、normalizer、readiness scorer、first-wave eval fixtures 或 fresh-source-eval cadence。
- 不新增外部 eval 平台，不接 Promptfoo/LangSmith/Braintrust/OpenAI Evals，不把 LLM judge 作为 CI hard gate。
- 不手改 generated runtime mirrors；如某切片最终需要 runtime refresh，由实现 workflow 在 source 验证后显式运行 `spec-first init`。
- 不把 `schema-validator` 的 `details[]` 当作默认工作；没有 consumer 前只记录为条件项。
- 不把 Runtime Setup alias 迁移和小文案修复混成一个隐式大迁移；alias 迁移按独立切片处理。

### Deferred to Follow-Up Work

- `schema-validator` 结构化 `details[].{keyword,instanceLocation}`：仅当 CLI/helper/review consumer 需要机器可读错误定位时启动。
- 完整 `/spec:runtime-setup` / `$spec-runtime-setup` alias 迁移：遵循 `docs/plans/2026-06-07-003-refactor-runtime-setup-lifecycle-plan.md` 的 U8，不作为 P0 顺手改。

---

## Completion Criteria

- P0 三项完成：`update` help 文案、`check-health` URL registry accessor、plan taxonomy CI path trigger。
- P1 三项完成：`plugin.js` support-file ignore set、`clean` apply 前摘要、guardrails 维度到 workflow 索引。
- P2 至少完成 legacy shell e2e 链删除，或明确保留原因与 replacement coverage gap。
- 每个已实施切片都有 focused test、`CHANGELOG.md` 记录和 `git diff --check` 通过记录。
- 未实施条件项在 closeout 中明确标为 deferred，并说明 consumer 或触发条件。

---

## Direct Evidence Readiness

- target_repo: `spec-first`
- evidence_sources: direct source reads, `rg`, `nl`, `sed`, `git status --short`, `CHANGELOG.md`, advisory Graphify query
- source_refs:
  - `docs/项目审查/2026-06-12-agent-native-architecture-audit-report.md`
  - `docs/plans/2026-06-13-002-refactor-eval-readiness-fixture-schema-plan.md`
  - `scripts/run-test-suite.cjs`
  - `tests/integration/e2e.sh`
  - `src/cli/plugin.js`
  - `src/cli/index.js`
  - `skills/spec-mcp-setup/scripts/check-health`
  - `skills/spec-mcp-setup/scripts/check-health.ps1`
  - `skills/spec-mcp-setup/helper-tools.json`
  - `.github/workflows/ai-dev-quality-gate.yml`
  - `tests/unit/plan-status-taxonomy.test.js`
  - `skills/agent-native-architecture/references/runtime-production-guardrails.md`
  - `src/cli/commands/clean.js`
  - `src/cli/commands/doctor.js`
  - `src/contracts/schema-validator.js`
- current_revision: `59d4bd15`
- worktree_status: dirty; many unrelated docs migration/deletion changes plus existing `CHANGELOG.md` edits
- confidence: medium-high for listed source state; medium for implementation blast radius because worktree is dirty
- limitations: no tests were run during planning; Graphify query was advisory and low-signal; line numbers may drift before implementation

---

## Direct Evidence

- repo_scope: current `spec-first` checkout only
- source_reads_completed:
  - W1 completion: `CHANGELOG.md` and completed eval readiness plan confirm normalized fixtures, normalizer, scorer, focused CI and fresh-source-eval cadence landed.
  - L1: `scripts/run-test-suite.cjs:100` still runs `tests/integration/e2e.sh`; that shell e2e calls `scripts/task-manager.sh`, `scripts/stage-gate.sh`, and `scripts/review-judge.sh`.
  - L4(a): `src/cli/plugin.js` support-file integrity traverses all files under support dirs and currently has no central ignore predicate.
  - L3: root CLI help still describes `update` as check-only.
  - W5: `check-health` Bash and PowerShell still carry separate URL switch functions despite `helper-tools.json` exposing `safety.source_repo`.
  - W2: `plan-status-taxonomy.test.js` exists, but GitHub workflow path filters do not include `docs/plans/**`.
  - W6: `runtime-production-guardrails.md` lists guardrail dimensions but lacks a dimension-to-workflow application index.
  - W3: `clean` supports `--dry-run`, but apply path does not echo the same summary before mutation.
  - L4(b)(c): `doctor --json` does not project a dedicated `runtime_catalog_freshness` field.
  - W4: `schema-validator` returns `valid/errors`; current callers primarily consume `errors`, and no confirmed `details[]` consumer was found.
- source_reads_required:
  - Before implementation, re-read in-scope files after dirty worktree settles or immediately before patching.
  - For legacy deletion, inspect `tests/integration/verification-gate.integration.test.js` and `tests/integration/spec-work-closeout-producer.test.js` to confirm replacement coverage.
- commands_or_tools_used: `rg`, `sed`, `nl`, `git status --short`, provider-standard Graphify query via `$HOME/.local/bin/graphify`
- impact_on_plan: W1 removed from active work; remaining work split into P0/P1/P2/conditional buckets.
- key_findings: All remaining active work is XS/S except legacy deletion and optional doctor projection; no architecture redesign is needed.
- limitations: Planning evidence is bounded, not a repository-wide proof; implementation must rerun focused tests.

---

## Context & Research

### Relevant Code and Patterns

- `scripts/run-ai-dev-quality-gate.js` already centralizes a focused workflow-runtime contract suite; it is the right place to add `plan-status-taxonomy.test.js`.
- `skills/spec-mcp-setup/scripts/lib-helper-registry.sh` and `.ps1` already centralize install command display; helper project URL should follow that source-owned registry pattern.
- `src/cli/commands/clean.js` already has a `printCleanDryRun` summary helper; apply-path visibility should reuse or factor that summary rather than creating a second format.
- `tests/unit/package-install-contracts.test.js` already treats `__pycache__` and `.pyc` as package noise; `plugin.js` runtime support traversal should align with that packaging boundary.

### Institutional Learnings

- Source/runtime boundary remains source-first: modify `skills/`, `templates/`, `src/cli/`, `docs/`, `.github/`, `tests/`; regenerate runtime only through `spec-first init` when explicitly needed.
- Scripts produce deterministic facts such as registry values, path filters, manifest versions, and test results; LLM-owned judgment remains in plan/review/closeout interpretation.

### External References

- None used for this plan. The remaining work is repo-local governance and deterministic source hygiene.

---

## Key Technical Decisions

- KTD1. Treat W1 as completed baseline, not active work: the completed plan and changelog evidence show the eval fixture contract, normalizer, scorer, first-wave fixtures and focused gate already landed.
- KTD2. Bundle P0 as one small source-only PR: help text, helper URL accessor and CI trigger are low-risk, independent, and cheap to verify.
- KTD3. Keep setup helper facts registry-owned: `check-health` should read `helper-tools.json` through shared Bash/PowerShell accessors rather than duplicating URL switch tables.
- KTD4. Keep mutation visibility preview-first but not prompt-heavy: `clean` should echo summary before apply, without adding a hard confirmation prompt or `--force` branch.
- KTD5. Keep guardrail guidance provider-neutral: the new index should map dimensions to spec-first workflows and source refs, not to provider-specific field names.
- KTD6. Delete legacy shell e2e as a separate slice: the old chain is live in the runner, so deletion must be paired with integration coverage confirmation.
- KTD7. Leave speculative validator details deferred: expanding validation output without a consumer adds contract surface without improving current workflow behavior.

---

## Open Questions

### Resolved During Planning

- Is W1 still pending? No. Current source/changelog evidence marks it completed.
- Is L1 dead code? No. It is live because `run-test-suite.cjs` still runs `tests/integration/e2e.sh`.
- Does `clean` need a hard confirmation gate? No. Current project guardrail posture allows reversible managed runtime cleanup; the gap is summary visibility.

### Deferred to Implementation

- Exact CI workflow path placement for `docs/plans/**`: decide in implementation whether it belongs only in `ai-dev-quality-gate.yml` or also in another workflow after checking current CI cost.
- Exact `plugin.js` ignore predicate placement: choose the smallest shared helper that covers integrity and copy traversal without changing unrelated package filtering behavior.
- Runtime Setup alias scope: decide in the alias slice whether to do prose-only deferral cleanup or full host command alias delivery.

---

## Implementation Units

### U1. 修正 update help 文案

**Goal:** 让 CLI root help 与 `spec-first update` 当前真实升级行为一致。

**Requirements:** R2, R7

**Dependencies:** None

**Files:**
- Modify: `src/cli/index.js`
- Test: `tests/unit/cli-entry-contracts.test.js` or `tests/unit/update-contracts.test.js`
- Modify: `CHANGELOG.md`

**Approach:**
- 删除 `check-only; never auto-upgrades` 措辞。
- 明确 `update` 会升级 CLI，并提醒用户之后运行 `spec-first init` 刷新项目 runtime assets。

**Patterns to follow:**
- `src/cli/commands/update.js` 的 help 和 success 输出。
- `tests/unit/update-contracts.test.js` 对 update 行为的 focused 契约。

**Test scenarios:**
- Happy path: root help includes upgrade wording for `update`.
- Error path: root help no longer contains `check-only` or `never auto-upgrades`.

**Verification:**
- Focused CLI help/update contract tests pass.

---

### U2. 将 check-health helper URL 收敛到 registry

**Goal:** 消除 Bash/PowerShell 两套 hardcoded project URL switch，统一读取 `helper-tools.json`。

**Requirements:** R2, R3, R7

**Dependencies:** None

**Files:**
- Modify: `skills/spec-mcp-setup/scripts/lib-helper-registry.sh`
- Modify: `skills/spec-mcp-setup/scripts/lib-helper-registry.ps1`
- Modify: `skills/spec-mcp-setup/scripts/check-health`
- Modify: `skills/spec-mcp-setup/scripts/check-health.ps1`
- Test: `tests/unit/dependency-readiness-baseline.test.js`
- Test: `tests/unit/mcp-setup-powershell-contracts.test.js`
- Modify: `CHANGELOG.md`

**Approach:**
- 增加 Bash `helper_registry_source_repo <id>` 和 PowerShell `Get-HelperSourceRepo`。
- `check-health` 两端通过 accessor 读取 `safety.source_repo`。
- 保留 `agent-browser` 的 opt-in install/action 特殊语义，只去掉 URL 双份维护。

**Patterns to follow:**
- 现有 `helper_registry_install_command_display` / `Get-HelperInstallCommandDisplay` 的共享 accessors。
- `helper-tools.json` 的 `safety.source_repo` 字段。

**Test scenarios:**
- Happy path: `gh`、`jq`、`ast-grep` health output URL 来自 registry。
- Edge case: 缺失 `source_repo` 时输出空 URL，而不是 fallback 到旧 switch。
- Integration: Bash 与 PowerShell contract 都断言没有重复 switch 表。

**Verification:**
- `npm run test:mcp-setup` pass。

---

### U3. 将 plan status taxonomy 接入 CI path trigger

**Goal:** 让 `docs/plans/**` 变更能够触发现有 plan status taxonomy 检查。

**Requirements:** R2, R7

**Dependencies:** None

**Files:**
- Modify: `.github/workflows/ai-dev-quality-gate.yml`
- Modify: `scripts/run-ai-dev-quality-gate.js`
- Test: `tests/unit/ai-dev-quality-gate.test.js`
- Existing test: `tests/unit/plan-status-taxonomy.test.js`
- Modify: `CHANGELOG.md`

**Approach:**
- 把 `tests/unit/plan-status-taxonomy.test.js` 加入 `WORKFLOW_RUNTIME_CONTRACT_TESTS`。
- 在 GitHub workflow paths 中加入 `docs/plans/**` 和该测试文件。
- 不新增 plan archive/schema，不改变 plan status taxonomy 本身。

**Patterns to follow:**
- `scripts/run-ai-dev-quality-gate.js` 的 focused Jest suite 列表。
- `.github/workflows/ai-dev-quality-gate.yml` 当前 path filter 风格。

**Test scenarios:**
- Happy path: quality gate suite includes `plan-status-taxonomy.test.js`.
- Integration: workflow path filter includes `docs/plans/**` and the taxonomy test file.

**Verification:**
- `npm run test:ai-dev:gate` pass。

---

### U4. 给 plugin support-file traversal 加 ignore set

**Goal:** 避免 `__pycache__`、`.pyc`、`.DS_Store` 等本地/构建噪音造成 runtime drift false positive。

**Requirements:** R4, R7

**Dependencies:** None

**Files:**
- Modify: `src/cli/plugin.js`
- Test: `tests/unit/skill-audit-scripts.test.js` or a focused plugin/runtime integrity test
- Modify: `CHANGELOG.md`

**Approach:**
- 在 `plugin.js` 中增加集中 ignore predicate，覆盖 `__pycache__/`、`.pyc`、`.pyo`、`.DS_Store` 等既有 package 忽略噪音。
- 让 support-file integrity traversal 和 copy/list 逻辑共用同一 predicate。
- 不忽略真正 source support files，不扩大到任意 dotfile。

**Patterns to follow:**
- `tests/unit/package-install-contracts.test.js` 对 Python bytecode/package noise 的边界。
- `src/cli/plugin.js` 中现有 `listDirectoryFiles` 与 integrity issue 输出风格。

**Test scenarios:**
- Happy path: 正常 support text/binary 文件仍参与 integrity 比较。
- Edge case: `scripts/__pycache__/tool.pyc` 不产生 `missing_file` 或 `content_mismatch`。
- Error path: 非忽略的 support file drift 仍然被报告。

**Verification:**
- Focused runtime drift/plugin integrity tests pass。

---

### U5. clean apply 前打印摘要

**Goal:** 让 `spec-first clean --claude|--codex` 在 apply 前显示与 dry-run 一致的高价值摘要。

**Requirements:** R2, R4, R7

**Dependencies:** None

**Files:**
- Modify: `src/cli/commands/clean.js`
- Test: `tests/unit/clean-dry-run.test.js`
- Modify: `CHANGELOG.md`

**Approach:**
- 抽出 dry-run/apply 共用 summary renderer，或让 apply path 在 `applyOperationPlan` 前打印 compact summary。
- 保持当前 auto-apply 行为，不新增 prompt、不新增 `--force`。
- 保留 “Custom assets outside the spec-first managed set were left untouched” 语义。

**Patterns to follow:**
- `printCleanDryRun` 的 remove/update/empty-root 统计。
- `init --dry-run` preview-first 但不强塞确认的输出风格。

**Test scenarios:**
- Happy path: apply stdout 在删除前包含 remove/update summary。
- Edge case: custom assets remain untouched 的承诺仍在 apply 输出中出现。
- Regression: `--dry-run` 仍不改文件，apply 仍删除 managed assets。

**Verification:**
- `tests/unit/clean-dry-run.test.js` focused pass。

---

### U6. 增加 production guardrails 维度到 workflow 索引

**Goal:** 让 `runtime-production-guardrails.md` 从维度清单升级为可消费的 workflow 应用索引。

**Requirements:** R4, R7

**Dependencies:** None

**Files:**
- Modify: `skills/agent-native-architecture/references/runtime-production-guardrails.md`
- Test: `tests/unit/agent-native-architecture-contracts.test.js`
- Modify: `CHANGELOG.md`

**Approach:**
- 在文档末尾追加“Dimension to workflow application index”。
- 映射维度到 `spec-plan`、`spec-work`、`spec-code-review`、`spec-mcp-setup`、`spec-skill-audit` 等真实消费点。
- 明确 `External facts and social sources` 是否进入测试锚点；建议纳入索引断言，避免未来又被误数。

**Patterns to follow:**
- 现有 guardrails 维度标题。
- `tests/unit/agent-native-architecture-contracts.test.js` 的 discoverability contract。

**Test scenarios:**
- Happy path: 每个关键 guardrail dimension 都有至少一个 workflow application row。
- Edge case: external/social facts 行存在，且标为 advisory evidence pressure，不是 confirmed source truth。
- Regression: 文档仍不出现 provider-specific contract fields 或 “comprehensive security” 过度承诺。

**Verification:**
- Focused agent-native architecture contracts pass。

---

### U7. 删除 legacy shell e2e 链

**Goal:** 移除 live-but-vestigial 的旧五步 shell 流程，避免继续维护过时 workflow 语义。

**Requirements:** R5, R7

**Dependencies:** U1-U6 可并行；实施前必须先确认 replacement coverage。

**Files:**
- Modify: `scripts/run-test-suite.cjs`
- Delete: `tests/integration/e2e.sh`
- Delete: `scripts/task-manager.sh`
- Delete: `scripts/stage-gate.sh`
- Delete: `scripts/review-judge.sh`
- Inspect/Test: `tests/integration/verification-gate.integration.test.js`
- Inspect/Test: `tests/integration/spec-work-closeout-producer.test.js`
- Modify: `CHANGELOG.md`

**Approach:**
- 先检查两个 Jest integration 是否覆盖当前 closeout producer / verification gate 语义。
- 从 `runIntegration()` 删除 `runBash('tests/integration/e2e.sh')`。
- 删除旧 shell 脚本和 e2e 文件。
- 如果发现 replacement coverage gap，先补 Jest integration，再删除 shell 链。

**Patterns to follow:**
- `scripts/run-test-suite.cjs` 中 Jest integration 先于 shell integration 的当前结构。
- closeout artifact / verification gate integration 的 deterministic evidence 风格。

**Test scenarios:**
- Happy path: `npm run test:integration` 不再调用 legacy shell e2e，仍验证 closeout producer 和 verification gate。
- Error path: 删除后仓内 `rg` 不再发现 `task-manager.sh`、`stage-gate.sh`、`review-judge.sh` 的 active references。
- Integration: 如果补 coverage，新测试证明旧 e2e 唯一承载的行为已被当前 workflow artifacts 取代。

**Verification:**
- `npm run test:integration` pass。

---

### U8. 收口 Runtime Setup alias 迁移文案

**Goal:** 消除当前 source prose 中“未来入口 `/spec:runtime-setup` 已像当前入口一样推荐”的漂移，同时不执行完整 alias 迁移。

**Requirements:** R4, R6, R7

**Dependencies:** None

**Files:**
- Modify: `skills/spec-mcp-setup/SKILL.md`
- Modify: `templates/claude/commands/spec/mcp-setup.md`
- Inspect: `docs/plans/2026-06-07-003-refactor-runtime-setup-lifecycle-plan.md`
- Test: `tests/unit/mcp-setup-powershell-contracts.test.js` or relevant setup prose contract
- Modify: `CHANGELOG.md`

**Approach:**
- 保留当前 runnable entrypoints：`/spec:mcp-setup` 和 `$spec-mcp-setup`。
- 将 `/spec:runtime-setup` / `$spec-runtime-setup` 明确标为 deferred alias migration candidate，指向既有 U8 计划。
- 不新增 host command，不改 runtime generation，不刷新 generated runtime mirrors。

**Patterns to follow:**
- `using-spec-first` route map 当前 setup entrypoint 口径。
- `docs/plans/2026-06-07-003-refactor-runtime-setup-lifecycle-plan.md` U8 deferred boundary。

**Test scenarios:**
- Happy path: setup skill/template 当前入口只推荐 `mcp-setup`。
- Edge case: future alias 被标为 deferred，不被呈现为可运行命令。
- Regression: route map / setup guidance 仍能找到 current host entrypoint。

**Verification:**
- Focused setup prose/contract tests pass。

---

### U9. 按需投影 doctor runtime catalog freshness

**Goal:** 当 closeout、doctor automation 或 runtime repair guidance 需要机器可读 manifest freshness 时，在 `doctor --json` 增加清晰字段。

**Requirements:** R4, R6, R7

**Dependencies:** Consumer or explicit implementation decision.

**Files:**
- Modify: `src/cli/commands/doctor.js`
- Test: relevant doctor JSON contract test
- Modify: `CHANGELOG.md`

**Approach:**
- 基于现有 managed state `manifestVersion` 与 bundled manifest version 比较，投影 `runtime_catalog_freshness`。
- 候选值保持小而确定：`fresh`、`stale`、`missing`、`unknown`。
- 不把 warning prose 当机器契约；JSON 字段只表达 deterministic version comparison。

**Patterns to follow:**
- `checkManagedState` 现有 manifest mismatch 逻辑。
- `decision_input_health` / `workflow_runnability` 的 JSON projection 风格。

**Test scenarios:**
- Happy path: state manifest 与 bundled manifest 相同，JSON 输出 `fresh`。
- Edge case: state missing 或 invalid，JSON 输出 `missing` 或 `unknown`。
- Error path: state version 与 bundled version 不同，JSON 输出 `stale` 且 existing warning 保留。

**Verification:**
- Focused doctor JSON contract tests pass。

---

## System-Wide Impact

- **CLI surface:** U1 and U5 affect user-visible CLI output only; no new commands or flags.
- **Runtime generation:** U4 may affect runtime drift/asset inspection, but source remains `src/cli/plugin.js`; runtime mirrors are not edited directly.
- **Setup scripts:** U2 touches Bash and PowerShell setup health scripts; must preserve dual-host parity.
- **CI:** U3 changes GitHub Actions path filters and quality gate test list; monitor CI duration but expected cost is small.
- **Workflow governance:** U6 and U8 are prose/contract governance changes; they affect how workflows consume guardrail/setup guidance.
- **Integration coverage:** U7 changes test topology by removing a shell integration chain; replacement coverage must be explicit.
- **Unchanged invariants:** Public workflow entrypoint governance, source/runtime boundary, eval light-contract posture, and generated runtime exclusion remain unchanged.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Dirty worktree causes accidental overwrite | Re-run `git status --short` before each patch; only edit listed files; inspect in-scope diffs if already modified |
| Registry URL accessor changes setup output unexpectedly | Add Bash and PowerShell focused assertions against `helper-tools.json` values |
| Legacy shell deletion removes hidden coverage | Inspect current integration tests first; add Jest coverage before deletion if needed |
| Guardrail index becomes another stale table | Keep rows tied to existing workflow names and test only load-bearing mappings |
| Doctor JSON freshness becomes premature schema surface | Implement U9 only with clear consumer or explicit acceptance; otherwise keep deferred |
| Runtime Setup alias prose implies unavailable commands | Keep current `mcp-setup` as runnable entrypoint and mark alias as deferred |

---

## Documentation / Operational Notes

- Each source change requires `CHANGELOG.md` entry using the current v1.10.0 format.
- User-visible CLI/help/setup output changes should include `(user-visible)` in changelog.
- Runtime mirrors are not part of this plan's source edits. If implementation later requires refresh, run `spec-first init` explicitly and record it.
- No README update is required unless a change alters documented user-facing command behavior beyond help/prose.

---

## Alternative Approaches Considered

- **Do everything in one large cleanup PR:** Rejected. The changes are independent and current worktree is dirty; large mixed diffs would make review and rollback harder.
- **Drop all conditional items now:** Rejected. `doctor --json` freshness has plausible automation value, but `schema-validator details[]` lacks a confirmed consumer; preserving them as conditional avoids speculative contract expansion.
- **Full Runtime Setup alias migration in P0:** Rejected. Alias delivery affects host command generation and public entrypoint governance; it should follow the existing U8 plan rather than be hidden inside a cleanup batch.

---

## Phased Delivery

### Phase 1: P0 deterministic hygiene

- U1: update help text.
- U2: registry-owned helper URLs.
- U3: plan taxonomy CI trigger.

### Phase 2: P1 source/runtime visibility

- U4: plugin support-file ignore set.
- U5: clean apply summary.
- U6: guardrails workflow index.

### Phase 3: P2 retirement and deferred surfaces

- U7: legacy shell e2e chain deletion after coverage confirmation.
- U8: Runtime Setup alias prose cleanup or explicit alias-slice handoff.
- U9: doctor JSON freshness only if consumer/owner confirms value.

---

## Sources & References

- Origin review: `docs/项目审查/2026-06-12-agent-native-architecture-audit-report.md`
- Completed W1 plan: `docs/plans/2026-06-13-002-refactor-eval-readiness-fixture-schema-plan.md`
- Runtime Setup lifecycle plan: `docs/plans/2026-06-07-003-refactor-runtime-setup-lifecycle-plan.md`
- Role contract: `docs/10-prompt/结构化项目角色契约.md`
- CLI runner: `scripts/run-test-suite.cjs`
- Legacy e2e: `tests/integration/e2e.sh`
- Runtime delivery: `src/cli/plugin.js`
- CLI help: `src/cli/index.js`
- Setup health scripts: `skills/spec-mcp-setup/scripts/check-health`, `skills/spec-mcp-setup/scripts/check-health.ps1`
- Helper registry: `skills/spec-mcp-setup/helper-tools.json`
- Quality gate workflow: `.github/workflows/ai-dev-quality-gate.yml`
- Guardrails reference: `skills/agent-native-architecture/references/runtime-production-guardrails.md`
- Clean command: `src/cli/commands/clean.js`
- Doctor command: `src/cli/commands/doctor.js`
- Schema validator: `src/contracts/schema-validator.js`
