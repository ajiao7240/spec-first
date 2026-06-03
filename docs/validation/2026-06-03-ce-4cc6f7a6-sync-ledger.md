---
title: CE 4cc6f7a6 sync decision ledger
date: 2026-06-03
type: validation
source_plan: docs/plans/2026-06-03-002-refactor-sync-ce-4cc6f7a6-workflow-updates-plan.md
target_repo: spec-first
ce_repo: /Users/kuang/xiaobu/compound-engineering-plugin
ce_range: 834ca4e58a82c4e06040ff448bc4bd97551f4be9..4cc6f7a6ea33612aaf2d19f6c3bd5ad80bbc2a5e
ce_head: 4cc6f7a6ea33612aaf2d19f6c3bd5ad80bbc2a5e
status: implementation-closeout-completed
implementation_status: implemented-with-deferred-migrations
---

# CE 4cc6f7a6 sync decision ledger

## Scope

本 ledger 是 U1 gate 产物，只记录 CE `834ca4e5..4cc6f7a6` 排除 `docs/**` 与 `tests/**` 后的 124 个实施面条目的同步判定。它不是实现报告，也不授权整文件复制。U3-U12 只有在 U2 post-ledger gate 汇总后，才能按本 ledger 的 accepted / adapted / contract-migration 行进入实现。

边界：

- CE `docs/**` 与 `tests/**` 不进入逐文件 ledger 行。
- CE release metadata、plugin manifest 当前版本、CE README/CHANGELOG 当前值不作为 spec-first source 行为同步。
- `.claude/`、`.codex/`、`.agents/skills/` generated runtime mirrors 不作为 source 编辑目标。
- `*.agent.md -> *.md` 是 runtime contract migration 候选，不混入普通 agent 内容同步。

## U0 Facts

| Fact | Value |
|---|---|
| target repo | `spec-first` |
| target branch | `leo-2026-06-03-ceupdate` |
| target base revision | `9847a75b1b21a4fcbee416232857253c226bf885` |
| CE repo | `/Users/kuang/xiaobu/compound-engineering-plugin` |
| CE base | `834ca4e58a82c4e06040ff448bc4bd97551f4be9` |
| CE head | `4cc6f7a6ea33612aaf2d19f6c3bd5ad80bbc2a5e` |
| CE filtered command | `git -C /Users/kuang/xiaobu/compound-engineering-plugin diff --name-status 834ca4e58a82c4e06040ff448bc4bd97551f4be9..4cc6f7a6ea33612aaf2d19f6c3bd5ad80bbc2a5e -- . ':(exclude)docs/**' ':(exclude)tests/**'` |
| filtered entries | `124` |
| filtered name-status mix | `18 A`, `14 D`, `52 M`, `40 R` |
| CE worktree note | CE repo has unrelated untracked files; range objects and diff are readable. |

## Dirty Overlap Matrix

| Path | Existing state before this ledger | Overlap with U1 | Strategy |
|---|---|---|---|
| `CHANGELOG.md` | modified before this run | direct overlap because U1 must append changelog | append one new top entry only; preserve existing dirty entries |
| `docs/01-需求分析/13.scale集成/CodeGraph技术方案.md` | modified before this run | no overlap | do not read for sync decisions; do not edit |
| `docs/validation/2026-06-03-ce-4cc6f7a6-sync-ledger.md` | absent | new U1 artifact | create source validation artifact |

## Decision Legend

| Code | Decision | Meaning |
|---|---|---|
| `out-of-scope` | not synced | CE-only release/product/runtime metadata, plugin manifests, CE README/CHANGELOG current values, or no spec-first homologous surface |
| `rejected` | not synced | CE behavior would remove a current stronger spec-first contract and no equivalence gate is closed |
| `spike` | deferred | product/runtime boundary needs a separate plan or explicit migration before implementation |
| `contract-migration` | deferred implementation | valuable direction, but requires consumer contract migration and tests before touching source |
| `accepted-adapted` | implementation candidate | CE intent is useful, but must be semantically merged into existing spec-first source/tests |

## Direct-Read Evidence Packs

Rows whose `decision` is `accepted-adapted` or `contract-migration` reference one or more packs below. Each pack records the required `ce_intent`, `local_improvements_to_preserve`, `merge_strategy`, `consumer_tests`, `opened_ce_ref`, `opened_target_ref`, `opened_consumer_refs`, and `read_summary`. If implementation later narrows to a specific hunk not covered by the pack, the row must be amended before editing.

| Pack | ce_intent | local_improvements_to_preserve | merge_strategy | consumer_tests | opened_ce_ref | opened_target_ref | opened_consumer_refs | read_summary |
|---|---|---|---|---|---|---|---|---|
| DR-A-agent-suffix | Migrate CE agent source names from `*.agent.md` to `*.md` and remove several specialized reviewers from CE catalog. | Current spec-first discovers agents via `.agent.md`, Codex adapter rewrites references to `.codex/agents/<name>.agent.md`, smoke/tests assert `.agent.md`, and deleted reviewers still have spec-first value or references. | `contract-migration`; keep source suffix unchanged during content sync; split a full suffix migration only after discovery, adapters, runtime cleanup, README/catalog and smoke tests are migrated together. | `tests/unit/agents-governance-contracts.test.js`; `tests/unit/runtime-plan-contracts.test.js`; `tests/unit/agent-support-contracts.test.js`; `tests/smoke/cli.sh`; `tests/unit/init-dry-run.test.js`. | CE filtered name-status and stat; representative agent rename/content hunks including `ce-maintainability-reviewer.md`, `ce-data-migration-reviewer.md`, `ce-pr-comment-resolver.md`, `ce-web-researcher.md`. | `agents/*.agent.md`; `src/cli/plugin.js`; `src/cli/adapters/codex.js`. | `tests/unit/*agent*`; `tests/smoke/cli.sh`; `tests/unit/runtime-plan-contracts.test.js`; `tests/unit/spec-code-review-contracts.test.js`. | CE suffix rename is mostly R100 and therefore a delivery contract change rather than content change. Current spec-first has explicit `.agent.md` runtime assumptions; accepting this as ordinary sync would silently drop installed agents. |
| DR-B-code-review | Fold schema drift into data migration persona, strengthen maintainability around complexity deletion and 1k-line regressions, remove language-convention reviewers, and delete CE `resolve-base.sh`. | spec-first keeps trusted `skills/spec-code-review/scripts/resolve-base.sh`, parent-owned reviewer artifacts, bounded dispatch, mode-aware demotion, CLI readiness boundary, read-only leaf reviewers, and existing stack reviewers. | `accepted-adapted` for maintainability/data-migration rubric; `contract-migration` for reviewer consolidation; `rejected` for deleting `resolve-base.sh` unless equivalence tests replace it. | `tests/unit/spec-code-review-contracts.test.js`; `tests/unit/skill-shell-safety.test.js`; `bash -n skills/spec-code-review/scripts/resolve-base.sh`. | CE code-review `SKILL.md`, `persona-catalog.md`, `review-output-template.md`, deleted `scripts/resolve-base.sh`, new `ce-maintainability-reviewer.md`, new `ce-data-migration-reviewer.md`. | `skills/spec-code-review/SKILL.md`; `skills/spec-code-review/references/persona-catalog.md`; `agents/spec-maintainability-reviewer.agent.md`; `agents/spec-data-migrations-reviewer.agent.md`; `skills/spec-code-review/scripts/resolve-base.sh`. | `tests/unit/spec-code-review-contracts.test.js`; deleted reviewer references in persona catalog and tests. | CE improves maintainability and migration/schema-drift framing, but also removes current helper and reviewers. The helper deletion is not accepted without fork-safe, shallow-clone and fail-closed tests replacing the script contract. |
| DR-C-pr-feedback | Simplify PR feedback resolution by removing cross-invocation cluster analysis and pushing a stronger default-to-fix resolver rubric. | spec-first currently protects mutating resolver dispatch with `cross_invocation`, `<cluster-brief>`, file-overlap serialization, untrusted-comment security, combined validation, and parent-owned replies/resolution. | `accepted-adapted` for default-to-fix wording; `contract-migration` for deleting clustering only after duplicate-thread fixture proves no duplicate mutation/reply/resolve. | `tests/unit/resolve-pr-feedback-contracts.test.js`; `tests/unit/spec-pr-comment-resolver-contracts.test.js`; `tests/unit/resolve-pr-feedback-pagination.test.js`. | CE `resolve-pr-feedback/SKILL.md`, `references/full-mode.md`, `references/targeted-mode.md`, `scripts/get-pr-comments`, `ce-pr-comment-resolver.md`. | `skills/resolve-pr-feedback/**`; `agents/spec-pr-comment-resolver.agent.md`. | `tests/unit/resolve-pr-feedback-contracts.test.js`; `tests/unit/spec-pr-comment-resolver-contracts.test.js`; `tests/unit/resolve-pr-feedback-pagination.test.js`. | CE's rubric is useful because it treats validation as a tripwire, not a reason to avoid fixes. The cluster deletion would remove an existing safety contract and must be proven with a focused duplicate-thread regression. |
| DR-D-plan-brainstorm-html-concepts | Add exclusive `output:html` mode, format-specific rendering refs, section refs, config keys, and root `CONCEPTS.md` vocabulary grounding. | spec-first currently has Markdown canonical consumers (`spec-work`, task-pack, doc-review, plan-template, requirements-capture), repo-relative artifact contracts, current-host entrypoint wording, direct-evidence readiness sections, and no root `CONCEPTS.md` source-of-truth. | `accepted-adapted`; prefer Markdown canonical plus HTML sidecar unless U7 proves HTML-only parity for all consumers. `CONCEPTS.md` is advisory vocabulary only. | `tests/unit/spec-plan-contracts.test.js`; `tests/unit/spec-brainstorm-contracts.test.js`; `tests/unit/spec-work-contracts.test.js`; `tests/unit/spec-write-tasks-contracts.test.js`; setup config tests when added. | CE `CONCEPTS.md`; CE plan/brainstorm `SKILL.md`; `html-rendering.md`; `markdown-rendering.md`; `plan-sections.md`; `brainstorm-sections.md`; setup `config-template.yaml`. | `skills/spec-plan/SKILL.md`; `skills/spec-brainstorm/SKILL.md`; `skills/spec-mcp-setup/references/config-template.yaml`; current tests. | `tests/unit/spec-plan-contracts.test.js`; `tests/unit/spec-brainstorm-contracts.test.js`; `tests/unit/spec-work-contracts.test.js`; downstream plan/work/task-pack refs. | CE rendering references are strong, but CE assumes exclusive HTML/Markdown artifact selection and `.compound-engineering/config.local.yaml`. spec-first must map to `.spec-first/config.local.yaml` and avoid making HTML a second or replacement canonical source without downstream tests. |
| DR-E-compound-concepts | Let compound/refresh seed or refine `CONCEPTS.md`, add headless behavior and vocabulary discoverability. | spec-first compound currently writes one learning doc, keeps instruction-file edits maintenance-only, uses distilled replay refs, excludes raw external output, and compound-refresh owns stale docs under `docs/solutions/`. | `accepted-adapted`; add vocabulary update as optional maintenance only if `CONCEPTS.md` exists or explicit bootstrap is requested; preserve one primary learning deliverable. | `tests/unit/spec-compound-contracts.test.js`; frontmatter validation scripts; compound-refresh action-flow tests. | CE `ce-compound/SKILL.md`; `ce-compound/references/concepts-vocabulary.md`; `ce-compound-refresh/SKILL.md`; `ce-compound-refresh/references/concepts-vocabulary.md`. | `skills/spec-compound/SKILL.md`; `skills/spec-compound-refresh/SKILL.md`; compound tests. | `tests/unit/spec-compound-contracts.test.js`; `skills/spec-compound-refresh/references/per-action-flows.md`. | CE vocabulary rules are useful but introduce an optional second maintenance write. In spec-first it must remain advisory, non-required, and not convert compound into a durable replay index. |
| DR-F-git-proof-feature-video | Improve PR description value-first writing, default-branch branch handling, Proof HITL resilience, and feature-video headless/R2 behavior. | spec-first has stronger body-file PR safety, Spec-First badge, feature-video mapping, default-branch confirmation policy, Proof identity `ai:spec-first`, retry discipline, and user consent around evidence upload. | `accepted-adapted` for PR writing principle and Proof retry clarity; `spike` for automatic dev-server start/R2 upload because it changes consent, network, and hosting policy. | `tests/unit/git-commit-push-pr-contracts.test.js`; proof contract tests if added; feature-video shell/script tests if added. | CE `ce-commit/SKILL.md`; `ce-commit-push-pr/SKILL.md`; `pr-description-writing.md`; `ce-proof/SKILL.md`; `hitl-review.md`; `ce-demo-reel` refs. | `skills/git-commit/SKILL.md`; `skills/git-commit-push-pr/**`; `skills/proof/**`; `skills/feature-video/**`. | `tests/unit/git-commit-push-pr-contracts.test.js`; existing Proof/feature-video source. | CE's value-first PR writing principle can be merged, but CE automatic branch creation and headless evidence upload must be reconciled with spec-first confirmation and hosting boundaries. |
| DR-G-sessions-evals | Add CE sessions terminology-preservation eval suite for vocabulary capture assumptions. | spec-first `spec-sessions` currently has bounded extraction, no durable replay index, current-session exclusion, and no `evals/` assets under this skill. | `spike`; evaluate only if spec-first adopts vocabulary capture as a load-bearing downstream consumer; do not copy CE PR-number ground truth. | Future eval harness tests; no current source tests. | CE `ce-sessions/evals/README.md`; `evals.json`; `grader.md`; current `ce-sessions/SKILL.md` hunk. | `skills/spec-sessions/SKILL.md`. | `tests/unit/spec-sessions-contracts.test.js`. | The eval structure is useful, but CE ground truth is tied to CE PRs and session history. spec-first needs its own eval fixtures before adopting it as runtime evidence. |
| DR-H-cli-runtime | Respect `CODEX_HOME`, avoid nested `.codex` writes, update detection/cleanup for Codex home and legacy CE artifacts. | spec-first CLI is CommonJS under `src/cli/**`, owns dual-host runtime projection, `init`/`clean` managed state, runtime-untrack, and source/runtime boundary tests. | `contract-migration`; defer until Codex runtime home is defined separately from project root, source root, and `.spec-first` state root, with CommonJS init/clean/doctor/runtime tests. | `tests/unit/init-dry-run.test.js`; `tests/unit/clean-dry-run.test.js`; `tests/unit/runtime-plan-contracts.test.js`; `tests/unit/runtime-untrack.test.js`; `tests/unit/init-source-path-coverage.test.js`; smoke tests. | CE TS hunks under `src/commands/*`, `src/targets/*`, `src/utils/*`, `src/data/plugin-legacy-artifacts.ts`. | `src/cli/commands/init.js`; `src/cli/commands/clean.js`; `src/cli/plugin.js`; `src/cli/adapters/codex.js`; `src/cli/runtime-untrack.js`. | `tests/unit/init-dry-run.test.js`; `tests/unit/clean-dry-run.test.js`; `tests/unit/runtime-plan-contracts.test.js`. | CE's `CODEX_HOME` behavior is directionally useful, but the implementation paths differ. spec-first must not confuse Codex home with repo root, source root, or `.spec-first` state. |
| DR-I-metadata | CE version bumps, release manifests, plugin manifests, CE README/CHANGELOG/AGENTS source, and CE plugin package values changed. | spec-first package metadata, README, AGENTS managed blocks, changelog, release policy, and plugin source are independently governed. | `out-of-scope`; do not sync current CE release values. | Changelog only for actual spec-first source changes. | CE metadata name-status/stat. | `CHANGELOG.md` current dirty entry; root README/AGENTS policy. | N/A. | These rows are release/product metadata and are not semantic workflow behavior. |
| DR-J-web-researcher | Make web research agent capability-based instead of hardcoded to `WebSearch`/`WebFetch`, while preserving structured external grounding. | spec-first currently hardcodes `WebSearch, WebFetch`, uses current host/session date, forbids shell web fetchers, and integrates only with `spec-ideate` today. | `accepted-adapted`; loosen to dedicated web-search/fetch capabilities only if host/tool boundary remains explicit and shell network fetch stays disallowed unless a dedicated web tool is provided. | `tests/unit/best-practices-researcher-contracts.test.js` or a new web-researcher contract test. | CE `ce-web-researcher.md`. | `agents/spec-web-researcher.agent.md`. | `spec-ideate` integration references and agent tests. | CE wording avoids hardcoding tool names and fits multi-host runtimes. spec-first should keep the no-generic-network-tool guard and current-date boundary. |

## Per-Entry Decision Table

| # | CE status/path | spec-first target | decision | evidence pack | verification assertion |
|---:|---|---|---|---|---|
| 1 | M `.github/.release-please-manifest.json` | none | out-of-scope | DR-I-metadata | CE release metadata not copied. |
| 2 | M `AGENTS.md` | `AGENTS.md` only if U8 needs discoverability | accepted-adapted | DR-D-plan-brainstorm-html-concepts; DR-I-metadata | Preserve current managed blocks; add only advisory vocabulary wording if U8 lands. |
| 3 | M `CHANGELOG.md` | none for CE content | out-of-scope | DR-I-metadata | Local changelog records spec-first source edits only. |
| 4 | A `CONCEPTS.md` | `CONCEPTS.md` | accepted-adapted | DR-D-plan-brainstorm-html-concepts; DR-E-compound-concepts | Advisory vocabulary only; not PRD/ADR/source-of-truth. |
| 5 | M `README.md` | none unless user-visible spec-first docs need updates | out-of-scope | DR-I-metadata | Do not copy CE product wording or counts. |
| 6 | M `package.json` | none | out-of-scope | DR-I-metadata | Do not sync CE version/package values. |
| 7 | M `plugins/compound-engineering/.claude-plugin/plugin.json` | none | out-of-scope | DR-I-metadata | CE plugin manifest version not copied. |
| 8 | M `plugins/compound-engineering/.codex-plugin/plugin.json` | none | out-of-scope | DR-I-metadata | CE plugin manifest version not copied. |
| 9 | M `plugins/compound-engineering/.cursor-plugin/plugin.json` | none | out-of-scope | DR-I-metadata | CE Cursor plugin manifest has no spec-first homologous source. |
| 10 | M `plugins/compound-engineering/AGENTS.md` | none | out-of-scope | DR-I-metadata | CE plugin-host instructions not copied. |
| 11 | M `plugins/compound-engineering/CHANGELOG.md` | none | out-of-scope | DR-I-metadata | CE plugin changelog not copied. |
| 12 | M `plugins/compound-engineering/README.md` | none | out-of-scope | DR-I-metadata | CE plugin README product text not copied. |
| 13 | R100 `ce-adversarial-document-reviewer.agent.md -> ce-adversarial-document-reviewer.md` | `agents/spec-adversarial-document-reviewer.agent.md` | contract-migration | DR-A-agent-suffix | Keep suffix unless full runtime migration lands. |
| 14 | R098 `ce-adversarial-reviewer.agent.md -> ce-adversarial-reviewer.md` | `agents/spec-adversarial-reviewer.agent.md` | accepted-adapted | DR-A-agent-suffix; DR-B-code-review | Merge content hunk only; suffix unchanged. |
| 15 | R100 `ce-agent-native-reviewer.agent.md -> ce-agent-native-reviewer.md` | `agents/spec-agent-native-reviewer.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 16 | R100 `ce-ankane-readme-writer.agent.md -> ce-ankane-readme-writer.md` | `agents/spec-ankane-readme-writer.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 17 | R100 `ce-api-contract-reviewer.agent.md -> ce-api-contract-reviewer.md` | `agents/spec-api-contract-reviewer.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 18 | R100 `ce-architecture-strategist.agent.md -> ce-architecture-strategist.md` | `agents/spec-architecture-strategist.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 19 | R100 `ce-best-practices-researcher.agent.md -> ce-best-practices-researcher.md` | `agents/spec-best-practices-researcher.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 20 | R100 `ce-code-simplicity-reviewer.agent.md -> ce-code-simplicity-reviewer.md` | `agents/spec-code-simplicity-reviewer.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 21 | R099 `ce-coherence-reviewer.agent.md -> ce-coherence-reviewer.md` | `agents/spec-coherence-reviewer.agent.md` | accepted-adapted | DR-A-agent-suffix | Merge content hunk only after reading exact local target. |
| 22 | R100 `ce-correctness-reviewer.agent.md -> ce-correctness-reviewer.md` | `agents/spec-correctness-reviewer.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 23 | R100 `ce-data-integrity-guardian.agent.md -> ce-data-integrity-guardian.md` | `agents/spec-data-integrity-guardian.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 24 | D `ce-data-migration-expert.agent.md` | `agents/spec-data-migration-expert.agent.md` | spike | DR-A-agent-suffix; DR-B-code-review | Deletion requires selector, catalog, tests and product-value audit. |
| 25 | A `ce-data-migration-reviewer.md` | `agents/spec-data-migrations-reviewer.agent.md` | accepted-adapted | DR-B-code-review | Merged deployment/data-shape safety rubric into existing reviewer; schema-drift consolidation remains deferred. |
| 26 | D `ce-data-migrations-reviewer.agent.md` | `agents/spec-data-migrations-reviewer.agent.md` | spike | DR-B-code-review | Do not delete until replacement persona contract is proven. |
| 27 | R100 `ce-deployment-verification-agent.agent.md -> ce-deployment-verification-agent.md` | `agents/spec-deployment-verification-agent.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 28 | R100 `ce-design-implementation-reviewer.agent.md -> ce-design-implementation-reviewer.md` | `agents/spec-design-implementation-reviewer.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 29 | R100 `ce-design-iterator.agent.md -> ce-design-iterator.md` | `agents/spec-design-iterator.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 30 | R100 `ce-design-lens-reviewer.agent.md -> ce-design-lens-reviewer.md` | `agents/spec-design-lens-reviewer.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 31 | D `ce-dhh-rails-reviewer.agent.md` | `agents/spec-dhh-rails-reviewer.agent.md` | spike | DR-B-code-review | Current catalog still selects it; deletion not accepted. |
| 32 | R100 `ce-feasibility-reviewer.agent.md -> ce-feasibility-reviewer.md` | `agents/spec-feasibility-reviewer.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 33 | R100 `ce-figma-design-sync.agent.md -> ce-figma-design-sync.md` | `agents/spec-figma-design-sync.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 34 | R100 `ce-framework-docs-researcher.agent.md -> ce-framework-docs-researcher.md` | `agents/spec-framework-docs-researcher.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 35 | R100 `ce-git-history-analyzer.agent.md -> ce-git-history-analyzer.md` | `agents/spec-git-history-analyzer.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 36 | R100 `ce-issue-intelligence-analyst.agent.md -> ce-issue-intelligence-analyst.md` | `agents/spec-issue-intelligence-analyst.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 37 | R100 `ce-julik-frontend-races-reviewer.agent.md -> ce-julik-frontend-races-reviewer.md` | `agents/spec-julik-frontend-races-reviewer.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 38 | D `ce-kieran-python-reviewer.agent.md` | `agents/spec-kieran-python-reviewer.agent.md` | spike | DR-B-code-review | Deletion requires replacement coverage for Python maintainability lens. |
| 39 | D `ce-kieran-rails-reviewer.agent.md` | `agents/spec-kieran-rails-reviewer.agent.md` | spike | DR-B-code-review | Deletion requires replacement coverage for Rails conventions lens. |
| 40 | D `ce-kieran-typescript-reviewer.agent.md` | `agents/spec-kieran-typescript-reviewer.agent.md` | spike | DR-B-code-review | Deletion requires replacement coverage for TypeScript lens. |
| 41 | R096 `ce-learnings-researcher.agent.md -> ce-learnings-researcher.md` | `agents/spec-learnings-researcher.agent.md` | accepted-adapted | DR-A-agent-suffix; DR-E-compound-concepts | Merge content only if it improves learning search; suffix unchanged. |
| 42 | D `ce-maintainability-reviewer.agent.md` | `agents/spec-maintainability-reviewer.agent.md` | accepted-adapted | DR-B-code-review | Treat as replacement content, not file deletion. |
| 43 | A `ce-maintainability-reviewer.md` | `agents/spec-maintainability-reviewer.agent.md` | accepted-adapted | DR-B-code-review | Merge stronger structural-quality rubric; keep read-only tools and schema. |
| 44 | R100 `ce-pattern-recognition-specialist.agent.md -> ce-pattern-recognition-specialist.md` | `agents/spec-pattern-recognition-specialist.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 45 | R100 `ce-performance-oracle.agent.md -> ce-performance-oracle.md` | `agents/spec-performance-oracle.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 46 | R100 `ce-performance-reviewer.agent.md -> ce-performance-reviewer.md` | `agents/spec-performance-reviewer.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 47 | D `ce-pr-comment-resolver.agent.md` | `agents/spec-pr-comment-resolver.agent.md` | accepted-adapted | DR-C-pr-feedback | Treat as replacement content, not source deletion. |
| 48 | A `ce-pr-comment-resolver.md` | `agents/spec-pr-comment-resolver.agent.md` | accepted-adapted | DR-C-pr-feedback | Merge default-to-fix rubric; preserve security and cluster mode until migration. |
| 49 | R100 `ce-previous-comments-reviewer.agent.md -> ce-previous-comments-reviewer.md` | `agents/spec-previous-comments-reviewer.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 50 | R100 `ce-product-lens-reviewer.agent.md -> ce-product-lens-reviewer.md` | `agents/spec-product-lens-reviewer.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 51 | R100 `ce-project-standards-reviewer.agent.md -> ce-project-standards-reviewer.md` | `agents/spec-project-standards-reviewer.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 52 | R100 `ce-reliability-reviewer.agent.md -> ce-reliability-reviewer.md` | `agents/spec-reliability-reviewer.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 53 | R100 `ce-repo-research-analyst.agent.md -> ce-repo-research-analyst.md` | `agents/spec-repo-research-analyst.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 54 | D `ce-schema-drift-detector.agent.md` | `agents/spec-schema-drift-detector.agent.md` | spike | DR-B-code-review | Delete only if data-migration persona absorbs schema drift with tests. |
| 55 | R100 `ce-scope-guardian-reviewer.agent.md -> ce-scope-guardian-reviewer.md` | `agents/spec-scope-guardian-reviewer.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 56 | R100 `ce-security-lens-reviewer.agent.md -> ce-security-lens-reviewer.md` | `agents/spec-security-lens-reviewer.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 57 | R100 `ce-security-reviewer.agent.md -> ce-security-reviewer.md` | `agents/spec-security-reviewer.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 58 | R100 `ce-security-sentinel.agent.md -> ce-security-sentinel.md` | `agents/spec-security-sentinel.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 59 | R100 `ce-session-historian.agent.md -> ce-session-historian.md` | `agents/spec-session-historian.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 60 | R100 `ce-slack-researcher.agent.md -> ce-slack-researcher.md` | `agents/spec-slack-researcher.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 61 | R100 `ce-spec-flow-analyzer.agent.md -> ce-spec-flow-analyzer.md` | `agents/spec-spec-flow-analyzer.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 62 | R100 `ce-swift-ios-reviewer.agent.md -> ce-swift-ios-reviewer.md` | `agents/spec-swift-ios-reviewer.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 63 | R100 `ce-testing-reviewer.agent.md -> ce-testing-reviewer.md` | `agents/spec-testing-reviewer.agent.md` | contract-migration | DR-A-agent-suffix | Suffix-only rename deferred. |
| 64 | R058 `ce-web-researcher.agent.md -> ce-web-researcher.md` | `agents/spec-web-researcher.agent.md` | accepted-adapted | DR-J-web-researcher; DR-A-agent-suffix | Merge capability-based web-tool wording; suffix unchanged. |
| 65 | M `plugins/compound-engineering/skills/ce-brainstorm/SKILL.md` | `skills/spec-brainstorm/SKILL.md` | accepted-adapted | DR-D-plan-brainstorm-html-concepts | Merge output-mode and open-question improvements with current host wording. |
| 66 | A `ce-brainstorm/references/brainstorm-sections.md` | `skills/spec-brainstorm/references/brainstorm-sections.md` | accepted-adapted | DR-D-plan-brainstorm-html-concepts | Add only if U7 adopts section/rendering split. |
| 67 | M `ce-brainstorm/references/handoff.md` | `skills/spec-brainstorm/references/handoff.md` | accepted-adapted | DR-D-plan-brainstorm-html-concepts | No source change: current host/path handoff wording is already stronger and remains preserved. |
| 68 | A `ce-brainstorm/references/html-rendering.md` | `skills/spec-brainstorm/references/html-rendering.md` | accepted-adapted | DR-D-plan-brainstorm-html-concepts | HTML sidecar/parity gate required. |
| 69 | A `ce-brainstorm/references/markdown-rendering.md` | `skills/spec-brainstorm/references/markdown-rendering.md` | accepted-adapted | DR-D-plan-brainstorm-html-concepts | Split rendering only with downstream tests. |
| 70 | D `ce-brainstorm/references/requirements-capture.md` | `skills/spec-brainstorm/references/requirements-capture.md` | contract-migration | DR-D-plan-brainstorm-html-concepts | Current tests depend on this ref; do not delete until section ref replaces it. |
| 71 | M `ce-brainstorm/references/synthesis-summary.md` | `skills/spec-brainstorm/references/synthesis-summary.md` | accepted-adapted | DR-D-plan-brainstorm-html-concepts | Merge stronger synthesis/open-ended wording if compatible. |
| 72 | M `ce-brainstorm/references/universal-brainstorming.md` | `skills/spec-brainstorm/references/universal-brainstorming.md` | accepted-adapted | DR-D-plan-brainstorm-html-concepts | No source change: local handoff and current-host boundary already cover CE intent. |
| 73 | D `ce-brainstorm/references/visual-communication.md` | `skills/spec-brainstorm/references/visual-communication.md` | contract-migration | DR-D-plan-brainstorm-html-concepts | Do not delete current visual guidance until rendering refs cover it. |
| 74 | M `ce-code-review/SKILL.md` | `skills/spec-code-review/SKILL.md` | accepted-adapted | DR-B-code-review | Merge persona/rubric improvements; keep helper and dispatch contracts. |
| 75 | M `ce-code-review/references/persona-catalog.md` | `skills/spec-code-review/references/persona-catalog.md` | accepted-adapted | DR-B-code-review | Migrate only gated selector changes. |
| 76 | M `ce-code-review/references/review-output-template.md` | `skills/spec-code-review/references/review-output-template.md` | accepted-adapted | DR-B-code-review | Schema drift section removal only if persona consolidation lands. |
| 77 | D `ce-code-review/scripts/resolve-base.sh` | `skills/spec-code-review/scripts/resolve-base.sh` | rejected | DR-B-code-review | Preserve helper until equivalence migration tests replace it. |
| 78 | M `ce-commit-push-pr/SKILL.md` | `skills/git-commit-push-pr/SKILL.md` | accepted-adapted | DR-F-git-proof-feature-video | Merge value-first/full-read wording; preserve safe branch/body-file gates. |
| 79 | M `ce-commit-push-pr/references/pr-description-writing.md` | `skills/git-commit-push-pr/references/pr-description-writing.md` | accepted-adapted | DR-F-git-proof-feature-video | Merge core principle; keep Spec-First badge/evidence/body-file flow. |
| 80 | M `ce-commit/SKILL.md` | `skills/git-commit/SKILL.md` | accepted-adapted | DR-F-git-proof-feature-video | Migration gate closed with focused tests; default-branch flow now auto-branches before commit. |
| 81 | M `ce-compound-refresh/SKILL.md` | `skills/spec-compound-refresh/SKILL.md` | accepted-adapted | DR-E-compound-concepts | Merge headless/vocabulary only within current refresh boundary. |
| 82 | A `ce-compound-refresh/references/concepts-vocabulary.md` | `skills/spec-compound-refresh/references/concepts-vocabulary.md` | accepted-adapted | DR-E-compound-concepts | Add if U8 adopts advisory vocabulary maintenance. |
| 83 | M `ce-compound/SKILL.md` | `skills/spec-compound/SKILL.md` | accepted-adapted | DR-E-compound-concepts | Merge vocabulary/headless posture without changing primary deliverable. |
| 84 | A `ce-compound/references/concepts-vocabulary.md` | `skills/spec-compound/references/concepts-vocabulary.md` | accepted-adapted | DR-E-compound-concepts | Add if U8 adopts advisory vocabulary maintenance. |
| 85 | M `ce-demo-reel/references/tier-browser-reel.md` | `skills/feature-video/references/tier-browser-reel.md` | spike | DR-F-git-proof-feature-video | Auto-start dev server needs product/security gate. |
| 86 | M `ce-demo-reel/references/upload-and-approval.md` | `skills/feature-video/references/upload-and-approval.md` | spike | DR-F-git-proof-feature-video | R2/catbox headless upload needs hosting consent policy. |
| 87 | A `ce-dogfood-beta/SKILL.md` | none or future `skills/spec-dogfood-beta/` | spike | DR-F-git-proof-feature-video | New public workflow requires separate product plan. |
| 88 | A `ce-dogfood-beta/references/dogfood-report-template.md` | none | spike | DR-F-git-proof-feature-video | Depends on dogfood workflow decision. |
| 89 | A `ce-dogfood-beta/references/test-matrix-taxonomy.md` | none | spike | DR-F-git-proof-feature-video | Depends on dogfood workflow decision. |
| 90 | M `ce-ideate/references/post-ideation-workflow.md` | `skills/spec-ideate/references/post-ideation-workflow.md` | accepted-adapted | DR-J-web-researcher | Exact local ref was read; merged Proof HITL handoff wording while preserving spec-first boundaries. |
| 91 | M `ce-plan/SKILL.md` | `skills/spec-plan/SKILL.md` | accepted-adapted | DR-D-plan-brainstorm-html-concepts | Merge output mode/concepts only with downstream consumer gate. |
| 92 | M `ce-plan/references/deepening-workflow.md` | `skills/spec-plan/references/deepening-workflow.md` | accepted-adapted | DR-D-plan-brainstorm-html-concepts | No source change: current research fallback and host-neutral deepening wording already stronger. |
| 93 | A `ce-plan/references/html-rendering.md` | `skills/spec-plan/references/html-rendering.md` | accepted-adapted | DR-D-plan-brainstorm-html-concepts | HTML sidecar/parity gate required. |
| 94 | A `ce-plan/references/markdown-rendering.md` | `skills/spec-plan/references/markdown-rendering.md` | accepted-adapted | DR-D-plan-brainstorm-html-concepts | Add only with section/rendering split tests. |
| 95 | M `ce-plan/references/plan-handoff.md` | `skills/spec-plan/references/plan-handoff.md` | accepted-adapted | DR-D-plan-brainstorm-html-concepts | No source change: current-host and task-pack handoff rules already satisfy CE intent. |
| 96 | A `ce-plan/references/plan-sections.md` | `skills/spec-plan/references/plan-sections.md` | accepted-adapted | DR-D-plan-brainstorm-html-concepts | Add if U7 splits content contract from rendering. |
| 97 | D `ce-plan/references/plan-template.md` | `skills/spec-plan/references/plan-template.md` | contract-migration | DR-D-plan-brainstorm-html-concepts | Current downstream tests consume template; do not delete until replacement closes. |
| 98 | M `ce-plan/references/synthesis-summary.md` | `skills/spec-plan/references/synthesis-summary.md` | accepted-adapted | DR-D-plan-brainstorm-html-concepts | Merge stronger synthesis wording if compatible. |
| 99 | M `ce-plan/references/universal-planning.md` | `skills/spec-plan/references/universal-planning.md` | accepted-adapted | DR-D-plan-brainstorm-html-concepts | Preserve current non-software planning contract. |
| 100 | D `ce-plan/references/visual-communication.md` | `skills/spec-plan/references/visual-communication.md` | contract-migration | DR-D-plan-brainstorm-html-concepts | Do not delete until rendering refs preserve visual guidance. |
| 101 | M `ce-proof/SKILL.md` | `skills/proof/SKILL.md` | accepted-adapted | DR-F-git-proof-feature-video | Merge only Proof API resilience compatible with `ai:spec-first`. |
| 102 | M `ce-proof/references/hitl-review.md` | `skills/proof/references/hitl-review.md` | accepted-adapted | DR-F-git-proof-feature-video | Preserve current HITL sync and retry discipline. |
| 103 | M `ce-resolve-pr-feedback/SKILL.md` | `skills/resolve-pr-feedback/SKILL.md` | accepted-adapted | DR-C-pr-feedback | Merge default-to-fix wording; preserve mutating boundary. |
| 104 | M `ce-resolve-pr-feedback/references/full-mode.md` | `skills/resolve-pr-feedback/references/full-mode.md` | accepted-adapted | DR-C-pr-feedback | Migration gate closed with resolved-thread regression; cluster contract removed. |
| 105 | M `ce-resolve-pr-feedback/references/targeted-mode.md` | `skills/resolve-pr-feedback/references/targeted-mode.md` | accepted-adapted | DR-C-pr-feedback | Step-number changes only if full-mode migration lands. |
| 106 | M `ce-resolve-pr-feedback/scripts/get-pr-comments` | `skills/resolve-pr-feedback/scripts/get-pr-comments` | accepted-adapted | DR-C-pr-feedback | Migration gate closed; `cross_invocation` output removed with parent/agent/test migration. |
| 107 | M `ce-sessions/SKILL.md` | `skills/spec-sessions/SKILL.md` | accepted-adapted | DR-G-sessions-evals | Merge only terminology/vocabulary hooks if U8 adopts them. |
| 108 | A `ce-sessions/evals/README.md` | `skills/spec-sessions/evals/README.md` | spike | DR-G-sessions-evals | CE PR ground truth must be replaced with spec-first fixtures. |
| 109 | A `ce-sessions/evals/evals.json` | `skills/spec-sessions/evals/evals.json` | spike | DR-G-sessions-evals | Needs spec-first-owned eval data. |
| 110 | A `ce-sessions/evals/grader.md` | `skills/spec-sessions/evals/grader.md` | spike | DR-G-sessions-evals | Needs spec-first-owned grading contract. |
| 111 | M `ce-setup/references/config-template.yaml` | `skills/spec-mcp-setup/references/config-template.yaml` | accepted-adapted | DR-D-plan-brainstorm-html-concepts | Map `.compound-engineering` keys to `.spec-first/config.local.yaml`; comments inactive by default. |
| 112 | M `ce-simplify-code/SKILL.md` | none | spike | DR-F-git-proof-feature-video | No current public `spec-simplify-code`; product boundary separate. |
| 113 | M `ce-work/SKILL.md` | `skills/spec-work/SKILL.md` | contract-migration | DR-D-plan-brainstorm-html-concepts | HTML plan consumption only if U7 chooses HTML parity or sidecar behavior. |
| 114 | M `ce-work/references/shipping-workflow.md` | `skills/spec-work/references/shipping-workflow.md` | contract-migration | DR-D-plan-brainstorm-html-concepts | HTML status flip requires consumer/parser contract. |
| 115 | M `src/commands/cleanup.ts` | `src/cli/commands/clean.js` | contract-migration | DR-H-cli-runtime | Deferred: Codex runtime home must first be separated from project root/source root/state root. |
| 116 | M `src/commands/convert.ts` | `src/cli/commands/init.js` or converter homolog if present | contract-migration | DR-H-cli-runtime | Deferred: TS converter path behavior has no safe ordinary CommonJS sync without runtime-home contract. |
| 117 | M `src/commands/install.ts` | `src/cli/commands/init.js` | contract-migration | DR-H-cli-runtime | Deferred: `CODEX_HOME` install semantics require init/clean/doctor/runtime tests before source edits. |
| 118 | M `src/data/plugin-legacy-artifacts.ts` | `src/cli/runtime-untrack.js` or cleanup data if homologous | contract-migration | DR-H-cli-runtime; DR-B-code-review | Legacy agent cleanup depends on reviewer deletion/suffix decisions. |
| 119 | M `src/targets/codex.ts` | `src/cli/adapters/codex.js`; `src/cli/plugin.js` | contract-migration | DR-H-cli-runtime | Deferred: nested `.codex` avoidance must be proven against current project-scoped Codex runtime projection. |
| 120 | M `src/targets/index.ts` | `src/cli/adapters/index.js` or plugin sync planning | contract-migration | DR-H-cli-runtime | Deferred: target write option needs current adapter API migration tests. |
| 121 | M `src/utils/detect-tools.ts` | `src/cli/runtime-tools-index.js` or init helpers | contract-migration | DR-H-cli-runtime | Deferred: `$CODEX_HOME` detection is only advisory until runtime-home contract exists. |
| 122 | M `src/utils/legacy-cleanup.ts` | `src/cli/runtime-untrack.js` or clean legacy helpers | contract-migration | DR-H-cli-runtime; DR-B-code-review | Only add stale-agent cleanup after deletion decision. |
| 123 | M `src/utils/model.ts` | none or model alias comments if homologous | rejected | DR-H-cli-runtime | CE comment-only model alias update has no current source need. |
| 124 | M `src/utils/resolve-home.ts` | new or existing `src/cli` home resolver | contract-migration | DR-H-cli-runtime | Deferred: no resolver patch until explicit home/default fallback tests define the boundary. |

## U1 Gate Summary

| Decision | Count |
|---|---:|
| accepted-adapted | 45 |
| contract-migration | 51 |
| spike | 16 |
| rejected | 2 |
| out-of-scope | 10 |
| total | 124 |

Implementation remains blocked until U2 because several accepted/adapted rows are intentionally conditional:

- HTML rendering must choose Markdown canonical + HTML sidecar or HTML-only parity before editing `spec-plan` / `spec-brainstorm` / `spec-work`.
- Reviewer consolidation cannot delete `resolve-base.sh`, schema drift, data migration, Kieran/DHH, or suffix contracts without tests.
- PR feedback simplification cannot remove `cross_invocation` until duplicate-thread regression is written.
- Codex runtime home changes must map to CommonJS and preserve source/runtime boundary.

## U2 Post-Ledger Gate

U2 recomputed the table from the 124 rows and uses the counts in the summary above as the execution boundary:

- `accepted-adapted`: 45 rows can enter implementation only by semantic merge against current spec-first source/tests.
- `contract-migration`: 51 rows cannot be landed as ordinary sync; they require a migration test gate or a separate plan.
- `spike`: 16 rows stay deferred for product/runtime boundary decisions.
- `rejected`: 2 rows stay out of implementation.
- `out-of-scope`: 10 rows stay out of implementation.

Plan body rewrite is not required at this gate. The original U3-U12 units remain usable as thematic containers, but their execution scope is narrowed by this ledger:

| Implementation slice | Rows allowed to proceed | Gate result |
|---|---|---|
| Web researcher capability wording | 64, optionally 90 if `spec-ideate` exact local ref supports it | Proceed after adding `web-researcher` contract test; keep shell-network substitution disallowed. |
| PR description value-first wording | 78, 79 | Proceed after focused `git-commit-push-pr` assertions; do not change body-file or evidence boundaries. |
| Code-review rubric tightening | 14, 21, 25, 42, 43, 74, 75, 76 | Proceed only for maintainability/data-migration wording that preserves read-only reviewers, parent-owned artifacts, CLI readiness, and `resolve-base.sh`. |
| Plan/brainstorm rendering groundwork | 65-73, 91-100, 111, 113, 114 | Proceed only as Markdown-canonical plus optional HTML sidecar unless HTML-only consumer tests are added first. |
| Advisory vocabulary | 2, 4, 41, 81-84, 107 | Proceed only as optional `CONCEPTS.md` advisory vocabulary; no PRD/ADR/source-of-truth promotion. |
| PR feedback resolver rubric | 47, 48, 103-106 | Proceed after resolved-thread regression closes the cluster-removal gate. |
| Codex runtime home | 115-117, 119-121, 124 | Deferred as contract migration; do not edit until runtime home vs project/source/state-root boundary is planned and tested. |

Blocked by this gate:

- Agent suffix migration rows remain `contract-migration`; no `.md` source agent rename in normal sync.
- Reviewer deletions and schema-drift consolidation cannot remove existing spec-first reviewers without selector/reference/test audit.
- `resolve-base.sh` deletion is rejected for this run.
- `cross_invocation` / `<cluster-brief>` removal gate closed during implementation with resolved-thread regression coverage.
- Dogfood, simplify-code, sessions evals, R2 upload, auto-start dev server, and stale-agent cleanup remain spikes or contract migrations.

## Final Implementation Corrections

During implementation, several U2 decisions were refined under the downstream correction rule:

- Rows 80, 90, 104, and 106 moved into `accepted-adapted` after focused source reads and tests closed their original migration/spike gates.
- Rows 115-117, 119-121, and 124 moved from ordinary `accepted-adapted` to `contract-migration` after direct reads showed CE's `CODEX_HOME` changes target a global Codex plugin home, while spec-first currently uses project-scoped Codex runtime projection.
- Rows 67, 72, 92, and 95 remained `accepted-adapted` but required no source edit because current spec-first handoff/deepening wording already preserves stronger source/runtime and current-host boundaries.

Downstream correction rule: if implementation discovers a row decision is too broad or wrong, update that row and recompute the U2 scope before editing source.
