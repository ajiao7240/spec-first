---
title: 同步 CE 06a7cee0 workflow 更新到 spec-first 技术方案
date: 2026-05-04
status: active
type: plan
source: ce-sync
ce_range: 4b5f28da..06a7cee0
ce_head: 06a7cee0ad68cb50cebdb8a2a864ec4148ffba78
origin: docs/solutions/architecture-patterns/upstream-ce-sync-upgrade-methodology-2026-04-26.md
---

# 同步 CE 06a7cee0 workflow 更新到 spec-first 技术方案

## Summary

本计划用于把 CE `4b5f28da..06a7cee0` 中适合 spec-first 的 workflow、agent、script 和 governance 变更同步到当前仓库。同步采用“事实取证 + 语义适配”方式：安全修复和既有 workflow 改良进入本轮实施，新产品能力入口先进入产品边界 spike，不把 CE 新 skill 机械复制进 spec-first。

## Problem Frame

CE 本轮更新覆盖 98 个文件、4004 行新增和 1158 行删除，既包含 shell safety、review numbering、PR branch/body 安全、setup/update 脚本等高价值修复，也包含 `ce-strategy`、`ce-product-pulse`、`ce-simplify-code` 等新增能力。spec-first 与 CE 已分叉，当前项目有双宿主 runtime、source/runtime 边界、公开 workflow 暴露面和 CHANGELOG 治理，不能用整文件覆盖或按 CE 路径直接迁移。

本计划遵循 `docs/solutions/architecture-patterns/upstream-ce-sync-upgrade-methodology-2026-04-26.md`：脚本负责列文件、取 diff、跑测试和残留扫描；LLM 负责同步判定、路径映射、是否保留分叉和是否延后。

## Graph Readiness

- target_repo: `spec-first`
- status: stale
- source_revision: `dbf9bab1a871fc7aa6c790fe26b70eda10e0e0dc`
- current_revision: `10483135a1763804492500fac17e570ffe1aed78`
- stale: true
- primary_providers: `code-review-graph`, `gitnexus`
- degraded_providers: none reported in artifact
- fallback_capabilities: bounded direct repo reads, local CE git diff, existing tests
- runtime_mcp_evidence: not used for this plan; scope is CE diff planning, not symbol behavior analysis
- confidence: medium
- limitations: graph artifacts were generated on 2026-05-01 and predate the current source revision; current worktree is dirty. This plan relies on direct CE diff evidence and source reads.

## Goals

- Produce an implementation-ready CE sync plan for `4b5f28da..06a7cee0`.
- Preserve spec-first source-of-truth boundaries: edit `skills/`, `agents/`, `templates/`, `src/cli/`, docs and tests only; do not hand-edit generated `.claude/`, `.codex/`, `.agents/skills/`.
- Sync high-confidence fixes that improve existing spec-first workflow quality:
  - shell pre-resolution safety and extracted update scripts
  - setup global skill-root detection
  - brainstorm/plan synthesis summaries and artifact shape discipline
  - code-review quick path, stable finding numbers, bounded reviewer dispatch, PR comment gate
  - PR branch creation from fresh remote base and PR body `--body-file`
  - work/work-beta plan section compatibility and review-tier cost control
  - compound-refresh inbound-link deletion guard
  - polish-beta Bash 3.2 compatibility
- Require explicit product-boundary decisions before adding new capability families: strategy, product pulse, simplify-code.
- Map CE tests into this repo's current Jest/shell test layout instead of copying Bun/TS tests.

## Non-Goals

- Do not sync CE `3.4.2` release metadata, CE changelog, CE plugin manifests, CE bun lockfile, or CE package version into spec-first.
- Do not create `spec-product-pulse`, `spec-strategy`, or `spec-simplify-code` in the main implementation pass without a separate product-boundary decision.
- Do not delete `spec-cli-agent-readiness-reviewer` or `spec-cli-readiness-reviewer` without an explicit inbound-reference audit and spec-first-specific value decision.
- Do not bring CE docs wholesale into `docs/`; CE docs/tests are upstream intent evidence only unless a specific solution doc is needed as a spec-first learning.
- Do not rewrite existing spec-first skill files by full-copying CE files.

## Input Facts

User-provided update summary:

```text
Updating 4b5f28da..06a7cee0
98 files changed, 4004 insertions(+), 1158 deletions(-)
```

Verified local CE facts:

- CE range: `4b5f28da..06a7cee0`
- CE head: `06a7cee0ad68cb50cebdb8a2a864ec4148ffba78`
- Full CE diff: 98 files
- Filtered implementation target, excluding `docs/**` and `tests/**`: 77 file entries
- Initial spec-first dirty files observed at plan start:
  - `CHANGELOG.md`
  - `docs/2026-05-04/spec-first-global-audit/08-priority-roadmap.md`
  - `docs/2026-05-04/spec-first-global-audit/09-actionable-task-list.md`

During validation, additional unrelated dirty files appeared in the same checkout, including entry docs, README files, `src/cli/commands/init.js`, and dual-host/init tests. Treat `git status --short` at execution time as the source of truth, not the snapshot above. Implementation must not overwrite any existing or newly appearing user/parallel edits.

## Upstream Commit Themes

| Commit | Theme | Sync impact |
|---|---|---|
| `cd2fc67c` | Branch from fresh remote base | Sync into `git-commit-push-pr` with spec-first naming |
| `41e7f72a` | Surface scope synthesis in brainstorm/plan | Sync after adapting `/ce-*` to current-host entrypoints |
| `8cc07acb` | Refresh solution docs | Evidence only unless referenced by implementation |
| `1f0a77bc` | Replace shell antipatterns blocked by permission checks | Sync shell safety and tests |
| `e806522c` | Compound-refresh inbound links before deletion | Sync |
| `9751d1a3` | Restate model override at dispatch point | Sync with current stable model-alias policy |
| `0c515c06` | Inline post-generation menu routing | Sync into `spec-plan` handoff if not already present |
| `d69a772b` | Queue reviewers when subagent slots fill | Sync bounded parallelism |
| `5ac1a063` | Mandate walkthrough load on entry | Sync |
| `09fa18bc` | Previous-comments persona skip empty PRs | Sync comment gate |
| `d217660b` | Default harness-native review, escalate on risk | Sync only after adapting to Codex/Claude host capability |
| `15c1cde7` | Close plan synthesis drift | Sync |
| `8f804669` | Compound/sessions permission error | Sync pre-resolution simplification |
| `cb8f9b34` | Add strategy and product-pulse skills | Product-boundary spike; no direct copy |
| `265cb428` | Move strategy doc to root with frontmatter | Product-boundary spike |
| `5e045341` | Non-git CWD branch fallback | Sync branch-only pre-resolution |
| `3873b9e9` | URL-encode badge model slugs | Sync |
| `2d207574` | Add simplify-code skill | Product/workflow-boundary spike; do not reference from shipping until accepted |
| `ae408721` | Remove CLI-readiness reviewer agents | Deletion audit required; default preserve spec-first divergence until decided |
| `887db6b2` | Detect Codex global skills in setup | Sync |
| `520a9ebe` | Grant Write to JSON-pipeline reviewers | Sync if current agent frontmatter uses tool allowlists |
| `607c52ab` | Move resolve-base script to scripts dir | Sync source path and tests |
| `71d23d14` | Enforce CE prefix in tests | Adapt as `spec-*` prefix governance if useful |
| `74624f8e` | Simplify-code test scope by ripple risk | Product/workflow-boundary spike |
| `9539bf04` | Remove bash parameter expansion in `!` backticks | Sync |
| `caf5e125` | Bash 3.2 project detection | Sync polish-beta script |
| `a84cb759` | Use `--body-file` for PR descriptions | Sync |
| `e8567566` | Stable code-review finding numbers | Sync |
| `06a7cee0` | CE release main | Do not sync release metadata |

## Filtering Rule

Default implementation scope excludes CE `docs/**` and `tests/**`. Excluded files are still evidence:

- CE `docs/brainstorms/2026-04-24-surface-scope-earlier-requirements.md` and `docs/plans/2026-04-26-feat-surface-scope-earlier-plan.md` explain the synthesis-summary feature.
- CE `docs/solutions/workflow/stale-local-base-contamination.md` explains the branch creation fix.
- CE tests define assertions to port into this repo's `tests/unit/*` shape.

## Path Mapping

| CE path | spec-first target |
|---|---|
| `.compound-engineering/config.local.example.yaml` | `.spec-first/config.local.example.yaml`, only for accepted config keys |
| `plugins/compound-engineering/AGENTS.md` | `AGENTS.md` and/or source skill governance docs, only for spec-first-applicable rules |
| `plugins/compound-engineering/README.md` | `README.md`, `README.zh-CN.md`, only for accepted public surface changes |
| `plugins/compound-engineering/agents/ce-*.agent.md` | `agents/spec-*.agent.md` |
| `plugins/compound-engineering/skills/ce-brainstorm/**` | `skills/spec-brainstorm/**` |
| `plugins/compound-engineering/skills/ce-plan/**` | `skills/spec-plan/**` |
| `plugins/compound-engineering/skills/ce-code-review/**` | `skills/spec-code-review/**` |
| `plugins/compound-engineering/skills/ce-doc-review/**` | `skills/spec-doc-review/**` |
| `plugins/compound-engineering/skills/ce-commit-push-pr/**` | `skills/git-commit-push-pr/**` |
| `plugins/compound-engineering/skills/ce-compound/**` | `skills/spec-compound/**` |
| `plugins/compound-engineering/skills/ce-compound-refresh/**` | `skills/spec-compound-refresh/**` |
| `plugins/compound-engineering/skills/ce-sessions/**` | `skills/spec-sessions/**` |
| `plugins/compound-engineering/skills/ce-setup/**` | `skills/spec-mcp-setup/**` and relevant config templates; no `spec-setup` source exists here |
| `plugins/compound-engineering/skills/ce-update/**` | `skills/spec-update/**`, with dual-host Claude/Codex adaptation |
| `plugins/compound-engineering/skills/ce-work/**` | `skills/spec-work/**` |
| `plugins/compound-engineering/skills/ce-work-beta/**` | `skills/spec-work-beta/**` |
| `plugins/compound-engineering/skills/ce-polish-beta/**` | `skills/spec-polish-beta/**` |
| `plugins/compound-engineering/skills/ce-product-pulse/**` | deferred spike; possible `skills/spec-product-pulse/**` only after product decision |
| `plugins/compound-engineering/skills/ce-strategy/**` | deferred spike; possible `skills/spec-strategy/**` only after product decision |
| `plugins/compound-engineering/skills/ce-simplify-code/**` | deferred spike; possible internal helper only after workflow decision |
| CE plugin converter / legacy cleanup source | only sync when spec-first has the same cleanup surface |

## Filtered CE File Decisions

### Root, package, release, and plugin metadata

| CE file | Status | Decision | Rationale |
|---|---:|---|---|
| `.compound-engineering/config.local.example.yaml` | M | Defer partial | Only new content is `pulse_*` config for `ce-product-pulse`; do not add until product-pulse is accepted |
| `.github/.release-please-manifest.json` | M | Do not sync | CE version metadata |
| `AGENTS.md` | M | Semantic adapt | `docs/solutions/` description improvements are generally applicable; CE-specific names must be rewritten |
| `CHANGELOG.md` | M | Do not sync | CE release history |
| `README.md` | M | Semantic adapt after product decision | Strategy/product-pulse public surface is not automatically accepted |
| `bun.lock` | M | Do not sync | CE package manager metadata |
| `package.json` | M | Do not sync | CE version bump `3.2.0 -> 3.4.2` |
| `plugins/compound-engineering/.claude-plugin/plugin.json` | M | Do not sync | CE plugin metadata |
| `plugins/compound-engineering/.codex-plugin/plugin.json` | M | Do not sync | CE plugin metadata |
| `plugins/compound-engineering/.cursor-plugin/plugin.json` | M | Do not sync | CE plugin metadata; spec-first does not target Cursor |
| `plugins/compound-engineering/AGENTS.md` | M | Semantic adapt | Skill design principles, bounded dispatch, shell pre-resolution rules are valuable; CE path/name examples require rewrite |
| `plugins/compound-engineering/CHANGELOG.md` | M | Do not sync | CE changelog |
| `plugins/compound-engineering/README.md` | M | Semantic adapt after product decision | Remove CLI reviewers and add strategy/pulse only if matching decisions are accepted |

### Agents

| CE file | Status | Decision | Rationale |
|---|---:|---|---|
| `plugins/compound-engineering/agents/ce-adversarial-reviewer.agent.md` | M | Direct sync, rename | Adds `Write` so JSON-pipeline reviewers can write artifacts |
| `plugins/compound-engineering/agents/ce-api-contract-reviewer.agent.md` | M | Direct sync, rename | Same `Write` permission change |
| `plugins/compound-engineering/agents/ce-correctness-reviewer.agent.md` | M | Direct sync, rename | Same `Write` permission change |
| `plugins/compound-engineering/agents/ce-data-migrations-reviewer.agent.md` | M | Direct sync, rename | Same `Write` permission change |
| `plugins/compound-engineering/agents/ce-dhh-rails-reviewer.agent.md` | M | Direct sync, rename | Same `Write` permission change |
| `plugins/compound-engineering/agents/ce-julik-frontend-races-reviewer.agent.md` | M | Direct sync, rename | Same `Write` permission change |
| `plugins/compound-engineering/agents/ce-kieran-python-reviewer.agent.md` | M | Direct sync, rename | Same `Write` permission change |
| `plugins/compound-engineering/agents/ce-kieran-rails-reviewer.agent.md` | M | Direct sync, rename | Same `Write` permission change |
| `plugins/compound-engineering/agents/ce-kieran-typescript-reviewer.agent.md` | M | Direct sync, rename | Same `Write` permission change |
| `plugins/compound-engineering/agents/ce-maintainability-reviewer.agent.md` | M | Direct sync, rename | Same `Write` permission change |
| `plugins/compound-engineering/agents/ce-performance-reviewer.agent.md` | M | Direct sync, rename | Same `Write` permission change |
| `plugins/compound-engineering/agents/ce-previous-comments-reviewer.agent.md` | M | Direct sync, rename | Same `Write` permission change |
| `plugins/compound-engineering/agents/ce-project-standards-reviewer.agent.md` | M | Direct sync, rename | Same `Write` permission change |
| `plugins/compound-engineering/agents/ce-reliability-reviewer.agent.md` | M | Direct sync, rename | Same `Write` permission change |
| `plugins/compound-engineering/agents/ce-security-reviewer.agent.md` | M | Direct sync, rename | Same `Write` permission change |
| `plugins/compound-engineering/agents/ce-swift-ios-reviewer.agent.md` | M | Direct sync, rename | Same `Write` permission change |
| `plugins/compound-engineering/agents/ce-testing-reviewer.agent.md` | M | Direct sync, rename | Same `Write` permission change |
| `plugins/compound-engineering/agents/ce-cli-agent-readiness-reviewer.agent.md` | D | Defer spike / default preserve | spec-first currently references `spec-cli-agent-readiness-reviewer`; deletion needs repo-specific value and reference audit |
| `plugins/compound-engineering/agents/ce-cli-readiness-reviewer.agent.md` | D | Defer spike / default preserve | spec-first currently selects `spec-cli-readiness-reviewer`; deletion would change review coverage |

### Skills and scripts

| CE file | Status | Decision | Rationale |
|---|---:|---|---|
| `plugins/compound-engineering/skills/ce-brainstorm/SKILL.md` | M | Semantic adapt | Adds synthesis checkpoint, approach granularity, `STRATEGY.md` grounding. Sync synthesis; strategy grounding gated by strategy decision |
| `plugins/compound-engineering/skills/ce-brainstorm/references/handoff.md` | M | Semantic adapt | Chat file paths should be absolute for clickable output; keep plan artifacts repo-relative |
| `plugins/compound-engineering/skills/ce-brainstorm/references/requirements-capture.md` | M | Semantic adapt | Adds Summary/Assumptions and removes process `Next Steps`; sync with `spec-*` entrypoint language |
| `plugins/compound-engineering/skills/ce-brainstorm/references/synthesis-summary.md` | A | Semantic adapt | New reference is high-value; create `skills/spec-brainstorm/references/synthesis-summary.md` |
| `plugins/compound-engineering/skills/ce-code-review/SKILL.md` | M | Semantic adapt | Quick review, bounded dispatch, stable numbers, comment gate, script path move, Requirements section compatibility |
| `plugins/compound-engineering/skills/ce-code-review/references/persona-catalog.md` | M | Defer partial | Previous-comments gate sync; CLI-readiness removal gated by deletion decision |
| `plugins/compound-engineering/skills/ce-code-review/references/review-output-template.md` | M | Direct sync | Stable sequential finding number rule |
| `plugins/compound-engineering/skills/ce-code-review/{references => scripts}/resolve-base.sh` | R099 | Semantic adapt | Move to `skills/spec-code-review/scripts/resolve-base.sh`; update all references and tests |
| `plugins/compound-engineering/skills/ce-commit-push-pr/SKILL.md` | M | Semantic adapt | `--body-file` mandatory and fresh-base branch creation; map to `git-commit-push-pr` |
| `plugins/compound-engineering/skills/ce-commit-push-pr/references/branch-creation.md` | A | Semantic adapt | New reference should be added under `skills/git-commit-push-pr/references/` |
| `plugins/compound-engineering/skills/ce-commit-push-pr/references/pr-description-writing.md` | M | Direct sync, rename | URL-encode literal parens in badge model slugs |
| `plugins/compound-engineering/skills/ce-compound-refresh/SKILL.md` | M | Semantic adapt | Inbound-link check before delete; sync |
| `plugins/compound-engineering/skills/ce-compound/SKILL.md` | M | Direct sync, rename | Remove repo-name pre-resolution and unsafe parameter expansion |
| `plugins/compound-engineering/skills/ce-doc-review/SKILL.md` | M | Semantic adapt | Bounded parallel dispatch; sync |
| `plugins/compound-engineering/skills/ce-doc-review/references/synthesis-and-presentation.md` | M | Direct sync, rename | Treat `Summary` as framing-level section |
| `plugins/compound-engineering/skills/ce-ideate/SKILL.md` | M | Defer partial | Reads `STRATEGY.md`; sync only if strategy anchor is accepted |
| `plugins/compound-engineering/skills/ce-plan/SKILL.md` | M | Semantic adapt | Cross-repo bug route, synthesis phases, Summary template, Requirements section compatibility, handoff loading |
| `plugins/compound-engineering/skills/ce-plan/references/deepening-workflow.md` | M | Semantic adapt | Inspect diff during implementation; likely naming/template consistency |
| `plugins/compound-engineering/skills/ce-plan/references/plan-handoff.md` | M | Semantic adapt | Inline post-generation routing and absolute chat path; sync |
| `plugins/compound-engineering/skills/ce-plan/references/synthesis-summary.md` | A | Semantic adapt | New reference is high-value; create under `skills/spec-plan/references/` |
| `plugins/compound-engineering/skills/ce-plan/references/universal-planning.md` | M | Direct sync, rename | Remove SLFG wording |
| `plugins/compound-engineering/skills/ce-plan/references/visual-communication.md` | M | Direct sync, rename | `Summary` replaces `Overview` |
| `plugins/compound-engineering/skills/ce-polish-beta/scripts/detect-project-type.sh` | M | Direct sync, rename | Replace associative array with Bash 3.2-compatible newline list |
| `plugins/compound-engineering/skills/ce-product-pulse/**` | A | Defer spike | New product observability skill; needs source/runtime/governance decision |
| `plugins/compound-engineering/skills/ce-sessions/SKILL.md` | M | Direct sync, rename | Remove repo-name pre-resolution and unsafe parameter expansion |
| `plugins/compound-engineering/skills/ce-setup/SKILL.md` | M | Semantic adapt | Plugin-root detection and Codex/global skill roots; map to current setup skill boundaries |
| `plugins/compound-engineering/skills/ce-setup/references/config-template.yaml` | M | Defer partial | New `pulse_*` config gated by product-pulse decision |
| `plugins/compound-engineering/skills/ce-setup/scripts/check-health` | M | Semantic adapt | Add global skill roots `.claude`, `.agents`, `.codex`; map to `spec-mcp-setup` script if same responsibility exists |
| `plugins/compound-engineering/skills/ce-simplify-code/SKILL.md` | A | Defer spike | New execution helper; do not make shipping depend on it until accepted |
| `plugins/compound-engineering/skills/ce-strategy/**` | A | Defer spike | New strategy anchor and `STRATEGY.md` artifact; requires product-boundary decision |
| `plugins/compound-engineering/skills/ce-update/SKILL.md` | M | Semantic adapt | Extract Claude marketplace probes to scripts; keep spec-first Codex branch |
| `plugins/compound-engineering/skills/ce-update/scripts/*.sh` | A | Semantic adapt | Add `skills/spec-update/scripts/*` with spec-first repo/plugin names |
| `plugins/compound-engineering/skills/ce-work-beta/SKILL.md` | M | Direct sync, rename | Config pre-resolution safety, Requirements section compatibility, heading rename |
| `plugins/compound-engineering/skills/ce-work-beta/references/codex-delegation-workflow.md` | M | Direct sync, rename | Codex CLI path pre-resolution as absolute path |
| `plugins/compound-engineering/skills/ce-work-beta/references/shipping-workflow.md` | M | Semantic adapt | Review-tier policy sync; simplify-code step gated |
| `plugins/compound-engineering/skills/ce-work/SKILL.md` | M | Semantic adapt | Requirements section compatibility and mandatory shipping reference load |
| `plugins/compound-engineering/skills/ce-work/references/shipping-workflow.md` | M | Semantic adapt | Review-tier policy sync; simplify-code step gated |
| `src/data/plugin-legacy-artifacts.ts` | M | Defer / likely do not sync | Only supports CE cleanup of deleted CLI agents; sync only if deletion accepted and spec-first has equivalent cleanup table |
| `src/utils/legacy-cleanup.ts` | M | Defer / likely do not sync | Same |

## Excluded Docs And Tests As Evidence

| CE file | Status | Use in this plan |
|---|---:|---|
| `docs/brainstorms/2026-04-24-surface-scope-earlier-requirements.md` | A | Read as feature rationale for synthesis checkpoint |
| `docs/plans/2026-04-26-feat-surface-scope-earlier-plan.md` | A | Read as implementation rationale for brainstorm/plan synthesis |
| `docs/solutions/workflow/stale-local-base-contamination.md` | A | Read as rationale for branch-creation reference |
| `docs/solutions/skill-design/post-menu-routing-belongs-inline-2026-04-28.md` | A | Read as rationale for plan handoff inline routing |
| `docs/solutions/skill-design/claude-permissions-optimizer-classification-fix.md` | D | Do not delete spec-first docs mechanically |
| Other CE `docs/**` changes | M | Evidence only; no direct doc migration |
| `tests/skill-shell-safety.test.ts` | M | Port relevant assertions into `tests/unit/skill-shell-safety.test.js` |
| `tests/review-skill-contract.test.ts` | M | Port into `tests/unit/spec-code-review-contracts.test.js` |
| `tests/pipeline-review-contract.test.ts` | M | Port into `tests/unit/spec-work-contracts.test.js` / `spec-work-beta` as applicable |
| `tests/resolve-base-script.test.ts` | M | Port path move checks into current unit tests |
| `tests/skill-agent-ce-prefix.test.ts` | A | Adapt to spec-first naming/governance only if adding/deleting agents |
| `tests/skills/ce-plan-handoff-routing.test.ts` | A | Port to `tests/unit/spec-plan-contracts.test.js` |
| `tests/skills/ce-setup-check-health.test.ts` | A | Port to `tests/unit/mcp-setup.sh` or a focused JS contract |
| `tests/skills/ce-update.test.ts` | M | Port to `tests/unit/spec-update-contracts.test.js` |
| `tests/fixtures/ce-code-review-stable-numbering.md` | A | Add spec fixture if needed |

## Key Technical Decisions

- **D1: Split sync into safe/core sync and product-boundary spike.** `ce-strategy`, `ce-product-pulse`, and `ce-simplify-code` are not simple CE parity updates; they add new user-visible artifacts, config keys, skill entries, README counts, and runtime delivery decisions. They must not ride along as mechanical migration.
- **D2: Preserve spec-first `spec-cli-*readiness*` reviewers until audited.** CE deleted both CLI readiness reviewers, but spec-first is itself a CLI/workflow harness and currently references them. Deletion is a product/review-coverage decision, not a path-sync decision.
- **D3: Sync shell safety fixes aggressively.** Changes that remove rejected `!` pre-resolution syntax, avoid Bash parameter expansion, or move script invocations into runtime scripts directly serve current host stability.
- **D4: Do not copy CE release metadata.** CE `3.4.2`, plugin manifests, release-please state, lockfile metadata, and CE changelog are not spec-first source truth.
- **D5: Use spec-first current-host language.** Any copied CE `/ce-*` text must become current-host wording (`/spec:*` for Claude, `$spec-*` for Codex) or neutral “current host entrypoint” phrasing where the source skill is shared.
- **D6: Tests follow spec-first layout.** CE's Bun/TS tests are upstream assertions, not target files. Port assertions into existing `tests/unit/*.test.js` or shell tests.
- **D7: Plan output itself is docs-only.** This plan does not implement patch, regenerate runtime, or run CE sync tests.

## Implementation Units

### U1. Fact Replay And Dirty Worktree Guard

Files:

- `docs/plans/2026-05-04-001-sync-ce-06a7cee0-workflow-updates-plan.md`
- `CHANGELOG.md`

Actions:

- Re-run CE fact commands before implementation:
  - `git -C <ce-repo> rev-parse HEAD`
  - `git -C <ce-repo> log --oneline 4b5f28da..06a7cee0`
  - `git -C <ce-repo> diff --name-status 4b5f28da..06a7cee0`
  - `git -C <ce-repo> diff --name-status 4b5f28da..06a7cee0 -- . ':(exclude)docs/**' ':(exclude)tests/**'`
- Re-check `git status --short` in spec-first and preserve user edits.

Test scenarios:

- Current CE head equals or contains `06a7cee0ad68cb50cebdb8a2a864ec4148ffba78`.
- Filtered file count remains explainable; any drift updates the plan before implementation.

### U2. Shell Safety, Setup, And Update

Files:

- `skills/spec-update/SKILL.md`
- `skills/spec-update/scripts/currently-loaded-version.sh`
- `skills/spec-update/scripts/marketplace-name.sh`
- `skills/spec-update/scripts/upstream-version.sh`
- `skills/spec-mcp-setup/SKILL.md`
- `skills/spec-mcp-setup/references/config-template.yaml`
- `skills/spec-mcp-setup/scripts/check-health`
- `.spec-first/config.local.example.yaml`
- `tests/unit/spec-update-contracts.test.js`
- `tests/unit/mcp-setup.sh`
- `tests/unit/skill-shell-safety.test.js`

Actions:

- Move Claude plugin version probes in `spec-update` out of `!` backticks into runtime scripts with narrow `allowed-tools`.
- Keep existing Codex npm/runtime branch in `spec-update`; do not regress dual-host behavior.
- Adapt setup health checks to recognize global skill roots under `.claude`, `.agents`, and `.codex` where equivalent logic exists.
- Do not add `pulse_*` config keys unless U8 product-pulse is accepted.
- Remove unsafe repo-name pre-resolution patterns from `spec-compound`, `spec-sessions`, and work-beta config reads.

Test scenarios:

- `spec-update` no longer contains `!` pre-resolution commands invoking `bash <script>`.
- `spec-update` scripts use spec-first repository and sentinel names, not CE names.
- Shell safety tests reject `case`, top-level `[A] && B || C`, quoted command substitution, and parameter expansion operators in `!` backticks.
- Setup health detection treats `~/.agents/skills/<name>` and `~/.codex/skills/<name>` as valid skill roots where the setup script owns that check.

### U3. Brainstorm And Plan Synthesis Checkpoints

Files:

- `skills/spec-brainstorm/SKILL.md`
- `skills/spec-brainstorm/references/handoff.md`
- `skills/spec-brainstorm/references/requirements-capture.md`
- `skills/spec-brainstorm/references/synthesis-summary.md`
- `skills/spec-plan/SKILL.md`
- `skills/spec-plan/references/deepening-workflow.md`
- `skills/spec-plan/references/plan-handoff.md`
- `skills/spec-plan/references/synthesis-summary.md`
- `skills/spec-plan/references/universal-planning.md`
- `skills/spec-plan/references/visual-communication.md`
- `tests/unit/spec-brainstorm-contracts.test.js`
- `tests/unit/spec-plan-contracts.test.js`

Actions:

- Add Phase 2.5 style synthesis checkpoint to brainstorm.
- Add solo-mode and brainstorm-sourced synthesis checkpoint rules to plan.
- Rename plan template `Overview` to `Summary` where current source still uses legacy heading, while preserving legacy read compatibility.
- Add headless `## Assumptions` routing for unconfirmed inferred bets.
- Remove process `Next Steps` from durable requirements artifacts.
- Use absolute paths in chat handoff lines, but keep plan document file references repo-relative.
- Defer `STRATEGY.md` reads and `spec-strategy` references until U8 accepts strategy as a spec-first artifact.

Test scenarios:

- `spec-brainstorm` requires loading `references/synthesis-summary.md` before doc write.
- `spec-plan` template includes `## Summary` and still reads legacy `Requirements Trace`.
- Plan handoff tests assert post-generation menu routing does not stop after selection.
- No generated requirements or plan template includes process-exhaust `Next Steps` as a required durable section.

### U4. Code Review Pipeline

Files:

- `skills/spec-code-review/SKILL.md`
- `skills/spec-code-review/references/persona-catalog.md`
- `skills/spec-code-review/references/review-output-template.md`
- `skills/spec-code-review/references/resolve-base.sh`
- `skills/spec-code-review/scripts/resolve-base.sh`
- `agents/spec-*-reviewer.agent.md`
- `tests/unit/spec-code-review-contracts.test.js`
- `tests/unit/skill-shell-safety.test.js`

Actions:

- Add quick-review short-circuit only where the current host has a real built-in review command; for Codex without such a command, fall through to existing spec review behavior.
- Add stable finding numbers assigned once after sorting and reused in residual summaries.
- Move `resolve-base.sh` from `references/` to `scripts/`; update all paths.
- Add bounded parallel dispatch for reviewer and validator subagents.
- Add previous-comments `hasPriorComments` gate and approval-only skip.
- Add `Write` to reviewer agent frontmatter where artifacts require writes and host delivery supports the field.
- Do not remove CLI readiness reviewers in this unit unless U9 deletion audit accepts it.

Test scenarios:

- Stable numbering spans severity sections and does not restart in residual work.
- `resolve-base.sh` path references point to `scripts/resolve-base.sh`.
- Previous-comments reviewer is selected only with PR metadata and actual prior feedback.
- Bounded-dispatch wording treats concurrency-limit errors as backpressure, not reviewer failure.

### U5. Work, Work-Beta, And Shipping

Files:

- `skills/spec-work/SKILL.md`
- `skills/spec-work/references/shipping-workflow.md`
- `skills/spec-work-beta/SKILL.md`
- `skills/spec-work-beta/references/codex-delegation-workflow.md`
- `skills/spec-work-beta/references/shipping-workflow.md`
- `tests/unit/spec-work-contracts.test.js`
- `tests/unit/spec-work-beta-contracts.test.js`

Actions:

- Update plan-reading language to prefer `## Requirements`, with legacy `Requirements Trace` compatibility.
- Make shipping workflow reference loading mandatory.
- Adapt review-tier policy:
  - Tier 1 can be host-native review only if such a command/tool exists.
  - If the host lacks built-in review, use `spec-code-review` fallback rather than pretending Tier 1 ran.
  - Escalate to Tier 2 on sensitive surfaces, large diffuse changes, very large changes, or explicit plan/task request.
- Do not add a required simplify step unless U8 accepts `spec-simplify-code`.
- Keep operational validation and residual work sinks aligned with existing spec-first paths.

Test scenarios:

- Work and work-beta consume both `Requirements` and legacy `Requirements Trace`.
- Shipping workflow does not mention `/simplify` or `ce-simplify-code` unless the new helper is accepted.
- Tier 1/Tier 2 wording does not imply a missing host-native review exists on Codex.

### U6. Git Commit / PR Safety

Files:

- `skills/git-commit-push-pr/SKILL.md`
- `skills/git-commit-push-pr/references/branch-creation.md`
- `skills/git-commit-push-pr/references/pr-description-writing.md`
- `tests/unit/git-commit-push-pr-contracts.test.js`

Actions:

- Add fresh remote-base branch creation reference.
- Require user decision when local default branch has unpushed commits.
- Use stash/retry/pop only for checkout collisions; do not auto-resolve conflicts.
- Require temp file plus `gh pr create/edit --body-file "$BODY_FILE"` for PR body.
- URL-encode literal parentheses in model badge slug examples.

Test scenarios:

- `git-commit-push-pr` rejects `--body "$(cat "$BODY_FILE")` and stdin body patterns.
- `branch-creation.md` documents stale-base and forgot-to-branch cases.
- Badge model slug examples encode `(` and `)`.

### U7. Compound, Sessions, Doc Review, And Polish

Files:

- `skills/spec-compound/SKILL.md`
- `skills/spec-compound-refresh/SKILL.md`
- `skills/spec-sessions/SKILL.md`
- `skills/spec-doc-review/SKILL.md`
- `skills/spec-doc-review/references/synthesis-and-presentation.md`
- `skills/spec-polish-beta/scripts/detect-project-type.sh`
- `tests/unit/spec-compound-contracts.test.js`
- `tests/unit/spec-sessions-contracts.test.js`
- `tests/unit/spec-doc-review-contracts.test.js`

Actions:

- Remove repo-name `git-common-dir` pre-resolution from compound/sessions; keep branch-only pre-resolution with safe fallback.
- Add inbound-link check before compound-refresh deletion and distinguish decorative vs substantive citations.
- Add bounded parallel dispatch language to doc-review.
- Treat `Summary` as a framing-level section for doc-review chain-root detection.
- Replace Bash associative array usage in polish project detection with Bash 3.2-compatible newline list.

Test scenarios:

- Compound/sessions do not use `${common%...}` or `basename "$(dirname "$common")"` in `!` backticks.
- Compound-refresh cannot delete a learning with substantive inbound links.
- Polish project detection script passes `bash -n` under macOS Bash 3.2 constraints and preserves multi-hit output shape.

### U8. Product-Boundary Spike For New Skills

Files:

- `docs/plans/<future>-product-context-loop-plan.md` or a dedicated brainstorm/plan
- `skills/spec-ideate/SKILL.md`
- `skills/spec-brainstorm/SKILL.md`
- `skills/spec-plan/SKILL.md`
- `skills/spec-work/references/shipping-workflow.md`
- `src/cli/contracts/dual-host-governance/skills-governance.json`
- `README.md`
- `README.zh-CN.md`

Actions:

- Decide whether spec-first should add:
  - `spec-strategy` producing root `STRATEGY.md`
  - `spec-product-pulse` producing `docs/pulse-reports/`
  - `spec-simplify-code` as an internal pre-review helper
- For each accepted skill, define:
  - entry surface: public workflow vs standalone vs internal helper
  - source/runtime delivery in Claude and Codex
  - artifact contract and gitignore behavior
  - README/manual impact and runtime asset count
  - tests and fresh-source eval
- Until accepted, do not copy CE README public-surface changes or `pulse_*` config keys.

Test scenarios:

- Governance contract rejects unregistered public skill entries.
- README counts change only when governance changes.
- No `STRATEGY.md`, `docs/pulse-reports/`, or `spec-simplify-code` references appear in core workflows before acceptance.

### U9. CLI Readiness Reviewer Deletion Audit

Files:

- `agents/spec-cli-agent-readiness-reviewer.agent.md`
- `agents/spec-cli-readiness-reviewer.agent.md`
- `skills/spec-code-review/SKILL.md`
- `skills/spec-code-review/references/persona-catalog.md`
- `src/cli/contracts/dual-host-governance/agents-governance.json` if present
- `README.md`
- `README.zh-CN.md`
- `tests/unit/spec-code-review-contracts.test.js`
- relevant docs under `docs/validation/` and `docs/业界分析/`

Actions:

- Run an inbound-reference audit:
  - `rg -n "spec-cli-agent-readiness|spec-cli-readiness|cli-readiness|cli-agent-readiness" agents skills src templates README.md README.zh-CN.md docs AGENTS.md tests`
- Decide between:
  - preserve divergence and keep CLI readiness reviewers
  - remove from default selector but keep agent files as internal/manual review assets
  - delete agent files and cleanup governance/docs/tests
- Default for first implementation: preserve divergence unless the audit produces a clear replacement.

Test scenarios:

- If preserving, CE legacy cleanup changes are not ported.
- If deleting, all references and runtime governance are updated and fresh-source eval covers the reviewer-team behavior.

### U10. Runtime Governance, Docs, Changelog, And Verification

Files:

- `CHANGELOG.md`
- `README.md`
- `README.zh-CN.md`
- `src/cli/contracts/dual-host-governance/skills-governance.json`
- `src/cli/contracts/dual-host-governance/agents-governance.json` if present
- `.claude-plugin/plugin.json`
- `templates/claude/commands/spec/**`
- related tests

Actions:

- Update README/manual/runtime counts only for accepted source changes.
- Update CHANGELOG with current host developer profile author.
- Run source/runtime drift checks; regenerate runtime only via `spec-first init --claude|--codex` when implementation changes source assets that are delivered to host runtime.
- For skill/agent prose behavior changes, run fresh-source eval or record why it was not executed.

Test scenarios:

- `npm run lint:skill-entrypoints`
- `npm run typecheck`
- focused unit tests from U2-U9
- `npm run test:smoke` if runtime delivery or public entry surface changes
- `npm run build` only if package contents or runtime delivery changed materially

## Verification Matrix

| Unit | Minimum validation |
|---|---|
| U1 | `git diff --check -- docs/plans/2026-05-04-001-sync-ce-06a7cee0-workflow-updates-plan.md CHANGELOG.md` |
| U2 | `npm run typecheck`; `node tests/unit/spec-update-contracts.test.js` if directly runnable; `npm run test:unit -- --runTestsByPath ...` if Jest supports path filter; `npm run test:unit` fallback |
| U3 | `tests/unit/spec-brainstorm-contracts.test.js`, `tests/unit/spec-plan-contracts.test.js`, `npm run lint:skill-entrypoints` |
| U4 | `tests/unit/spec-code-review-contracts.test.js`, `tests/unit/skill-shell-safety.test.js` |
| U5 | `tests/unit/spec-work-contracts.test.js`, `tests/unit/spec-work-beta-contracts.test.js` |
| U6 | `tests/unit/git-commit-push-pr-contracts.test.js` |
| U7 | compound/sessions/doc-review/polish focused tests plus `bash -n skills/spec-polish-beta/scripts/detect-project-type.sh` |
| U8 | no implementation without separate plan; if accepted, add governance and runtime tests before source delivery |
| U9 | inbound-reference audit output plus focused review contract tests |
| U10 | `npm run lint:skill-entrypoints`, `npm run test:smoke`, fresh-source eval for changed skill/agent prose |

## Residual Risks

- CE strategy/pulse/simplify-code may be valuable, but accepting them expands spec-first's product identity beyond its current core workflow. Treat as a separate decision.
- Review-tier changes can reduce cost but may also lower review depth if host-native review is unavailable or weak. The spec-first adaptation must explicitly name fallback behavior.
- Deleting CLI readiness reviewers may remove coverage that matters more to spec-first than to CE.
- Moving `resolve-base.sh` from `references/` to `scripts/` affects runtime package contents and tests; stale references will break review scope detection.
- Adding `Write` to reviewer agents may have host-specific implications; verify both Claude and Codex runtime generation.

## Implementation Order

1. U1 fact replay and dirty worktree guard.
2. U2 shell safety/setup/update changes.
3. U3 brainstorm/plan synthesis references.
4. U4 code-review pipeline changes excluding CLI reviewer deletion.
5. U6 PR branch/body safety.
6. U7 compound/sessions/doc-review/polish fixes.
7. U5 work/work-beta shipping policy after code-review behavior is settled.
8. U9 CLI readiness deletion audit decision.
9. U8 product-boundary spike for new skills.
10. U10 README/governance/changelog/runtime/test closure.

This order front-loads deterministic safety fixes and leaves product-surface expansion until after core sync is stable.
