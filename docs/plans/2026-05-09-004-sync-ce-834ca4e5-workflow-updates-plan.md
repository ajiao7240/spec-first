---
title: Sync CE 834ca4e5 Workflow Updates Into Spec-First
type: refactor
status: active
date: 2026-05-09
origin: docs/solutions/architecture-patterns/upstream-ce-sync-upgrade-methodology-2026-04-26.md
spec_id: SYNC-CE-834CA4E5
---

# Sync CE 834ca4e5 Workflow Updates Into Spec-First

## Summary

本计划把 CE `06a7cee0..834ca4e5` 的 workflow、agent、脚本和 runtime 更新做增量语义同步。同步方式不是整文件覆盖，而是按当前 `spec-first` 的 `spec-*` 命名、Claude/Codex 双宿主、source/runtime 边界、CHANGELOG 治理和现有测试契约做局部适配。

---

## Problem Frame

用户提供的 CE `git pull` 日志显示上游从 `06a7cee0` fast-forward 到 `834ca4e5`，包含 118 个文件、11687 行新增和 2090 行删除。变更主题横跨 session history 编排重构、doc-review 降噪、plan 模板拆分、resolve-pr-feedback 分页、Codex hooks、skill 文档站、新 skill、PR 写作压缩和多处 prompt size 优化。按常态化 CE 同步协议，必须先写技术方案，逐文件判定哪些应同步、如何适配、哪些不同步或延后 spike。

---

## Requirements

- R1. 固定输入范围：`CE_REPO=/Users/kuang/xiaobu/compound-engineering-plugin`，`SPEC_REPO=/Users/kuang/xiaobu/spec-first`，`CE_RANGE=06a7cee0..834ca4e5`。
- R2. 默认实施范围排除 CE `docs/**` 与 `tests/**`，但把它们作为上游意图证据读取；用户若显式要求同步文档站或测试，另开计划。
- R3. 每个 CE 变更必须归类为直接同步、语义适配后同步、不同步或延后 spike；不得因为路径可映射就整文件复制。
- R4. 保持 source-first：只改 `skills/`、`agents/`、`src/cli/`、`tests/`、`docs/` 等 source-of-truth；不手改 `.claude/`、`.codex/`、`.agents/skills/` runtime mirror。
- R5. 保持当前项目公共入口：CE `/ce-*` 只作为来源证据，落点必须使用 `spec-*`、`git-*`、`feature-video`、`proof` 等当前命名。
- R6. 保持当前项目产品边界：不因 CE 新增 `ce-strategy`、`ce-product-pulse`、`ce-simplify-code`、`ce-riffrec-feedback-analysis` 或 `docs/skills` 文档站而自动扩展 public skill 面。
- R7. 同步脚本逻辑时保留确定性事实归脚本、语义判断归 LLM 的边界；不得用脚本决定架构判断或 review 结论。
- R8. 每个 source 变更都必须同步 `CHANGELOG.md`，并按当前 Codex developer profile 使用作者 `leokuang`。
- R9. 若后续执行涉及 skill/agent prose 行为，验证以 source 读取和 contract tests 为准；fresh-source eval 仅在用户明确允许 helper agents 时执行并记录。

---

## Scope Boundaries

- 本计划只生成增量同步方案，不在本轮执行 CE 同步实现。
- 不同步 CE release metadata：`.release-please-manifest.json`、`package.json` 版本、`plugins/compound-engineering/*plugin.json` 版本、CE `CHANGELOG.md`。
- 不把 CE plugin converter / multi-target 平台层迁入 `spec-first`，包括 `src/converters/claude-to-codex.ts`、`src/targets/codex.ts`、`src/types/codex.ts` 原样实现。
- 不直接创建 `docs/skills/*.md` 英文文档站；当前仓库默认中文治理、README/用户手册结构和 skill 计数需要单独设计。
- 不直接新增 `spec-strategy`、`spec-product-pulse`、`spec-simplify-code`、`spec-riffrec-feedback-analysis`。
- 不引入 Cursor、Gemini、Pi session history 支持，除非后续产品边界明确扩展；当前项目保持 Claude Code + Codex。
- 不删除当前 spec-first 独有能力，除非引用审计证明其职责已被新结构完全吸收。

---

## Input Facts

### Commands Used For Plan Evidence

```bash
git -C /Users/kuang/xiaobu/compound-engineering-plugin rev-parse HEAD
git -C /Users/kuang/xiaobu/compound-engineering-plugin log --oneline 06a7cee0..834ca4e5
git -C /Users/kuang/xiaobu/compound-engineering-plugin diff --name-status 06a7cee0..834ca4e5
git -C /Users/kuang/xiaobu/compound-engineering-plugin diff --name-status 06a7cee0..834ca4e5 -- . ':(exclude)docs/**' ':(exclude)tests/**'
git -C /Users/kuang/xiaobu/compound-engineering-plugin diff --stat 06a7cee0..834ca4e5 -- . ':(exclude)docs/**' ':(exclude)tests/**'
```

### CE Head And Commit Themes

- CE HEAD: `834ca4e58a82c4e06040ff448bc4bd97551f4be9`
- Tags at head: `compound-engineering-v3.7.3`, `cli-v3.7.3`
- Range: `06a7cee0..834ca4e5`
- Full diff: 118 files changed, 11687 insertions, 2090 deletions
- Filtered implementation diff excluding `docs/**` and `tests/**`: 75 files changed, 3893 insertions, 2063 deletions

Key upstream commits in range:

| Commit | Upstream subject | Sync relevance |
|---|---|---|
| `dde92563` | add Riffrec feedback skill | 延后 spike，新 public skill 边界未确认 |
| `4cc1ee6f` | fix ce-worktree script path | 可语义适配到 `git-worktree` |
| `7ff3472c` | update Codex sandbox flags | 可语义适配到 `spec-work-beta` |
| `a1698b7a` | add user-facing skill docs | 不直接同步，文档站需单独设计 |
| `1f3c6466` | block diagram deletion in doc review | 可同步到 `spec-doc-review` |
| `c7fc6743` | escape literal pipes in findings tables | 可同步到 code/doc review templates |
| `be2efd7d` | plan implementation units as headings | 可同步到 `spec-plan` / `spec-code-review` |
| `3e03365d` | adaptive effort selection for Codex delegation | 可同步到 `spec-work-beta` |
| `60b66dd9` | convert hooks to `.codex/hooks.json` | 延后 spike，spec-first runtime governance 不同构 |
| `8349e750` | cut doc-review plan noise | 可同步到 doc-review personas and synthesis |
| `168fad4a` | ideate topic-surface decomposition | 可同步到 `spec-ideate`，需去除 CE-only grounding |
| `9ec351a1` | trim commit-push-pr prescription | 可局部同步到 `git-commit-push-pr` |
| `6fc57c50` | debug triage and hypothesis discipline | 可同步到 `spec-debug` |
| `a01d2a64` | slim agent-native architecture | 可同步到 `agent-native-architecture` |
| `04031a5a` / `0e49506b` | trim skill/agent descriptions | 可局部同步，需不削弱触发精度 |
| `81710efa` | unblock session-history on Claude Code | 高优先级，需语义适配到 `spec-sessions` |
| `62279b05` | extract conditional content to references | 可同步多 skill reference 拆分 |
| `07a6d528` | paginate GraphQL connections | 可同步到 `resolve-pr-feedback` scripts |

---

## CE File Inventory And Decisions

### Release, Metadata, And CE Docs

| CE file group | Status | Decision | Reason |
|---|---:|---|---|
| `.github/.release-please-manifest.json`, `package.json`, `plugins/compound-engineering/*plugin.json`, root and plugin `CHANGELOG.md` | M | 不同步 | CE release/package metadata 与 spec-first 版本线不同源 |
| `docs/skills/**` 35 files | A | 延后 spike | 用户文档站有价值，但需 spec-first 命名、中文默认语言、README/用户手册信息架构和 skill 计数统一设计 |
| `docs/plans/2026-05-08-001-fix-ce-sessions-orchestration-refactor-plan.md` | A | 证据读取，不落盘 | 作为 session refactor 设计依据；spec-first 本计划重新表达 |
| `docs/solutions/skill-design/ce-prefix-required-for-skills-and-agents-2026-05-01.md` | A | 不直接同步 | CE `ce-` prefix 规则不能照搬；可作为 spec-first naming contract 检查依据 |

### Agents

| CE file | spec-first target | Decision | Notes |
|---|---|---|---|
| `agents/ce-session-historian.agent.md` | `agents/spec-session-historian.agent.md` | 语义适配后同步 | 转为 synthesis-only；不再让 subagent 调 Skill；保持 Claude/Codex，不引入 Cursor |
| `agents/ce-adversarial-document-reviewer.agent.md` | `agents/spec-adversarial-document-reviewer.agent.md` | 语义适配后同步 | 按 `Document type` 和 `Origin` 抑制 plan 噪音 |
| `agents/ce-coherence-reviewer.agent.md` | `agents/spec-coherence-reviewer.agent.md` | 语义适配后同步 | 增加 plan/requirements doc-type adaptation 和 safe-auto 模式 |
| `agents/ce-design-lens-reviewer.agent.md` | `agents/spec-design-lens-reviewer.agent.md` | 语义适配后同步 | 区分 requirements 与 plan 的设计审查粒度 |
| `agents/ce-feasibility-reviewer.agent.md` | `agents/spec-feasibility-reviewer.agent.md` | 语义适配后同步 | requirements 下只抓方向性不可行，plan 下完整 implementability 审查 |
| `agents/ce-product-lens-reviewer.agent.md` | `agents/spec-product-lens-reviewer.agent.md` | 语义适配后同步 | `origin:` plan 不重审 WHAT/WHY |
| `agents/ce-scope-guardian-reviewer.agent.md` | `agents/spec-scope-guardian-reviewer.agent.md` | 语义适配后同步 | `origin:` plan 聚焦 implementation bloat 与 deferred scope creep |
| `agents/ce-security-lens-reviewer.agent.md` | `agents/spec-security-lens-reviewer.agent.md` | 语义适配后同步 | security 粒度随 doc type 调整 |
| `agents/ce-learnings-researcher.agent.md`, `ce-slack-researcher.agent.md`, `ce-swift-ios-reviewer.agent.md`, `ce-web-researcher.agent.md` | same `spec-*` agents | 直接或微适配 | description trim only；确认不丢触发边界后同步 |

### Skills And References

| CE file group | spec-first target | Decision | Notes |
|---|---|---|---|
| `skills/ce-sessions/**`, deleted `ce-session-inventory`, deleted `ce-session-extract`, script moves | `skills/spec-sessions/**`; remove or retire `skills/spec-session-inventory` / `skills/spec-session-extract` | 语义适配后同步 | 高优先级；解决 subagent Skill deadlock；脚本由 orchestrator 调用，historian 只综合 scratch files |
| `skills/ce-compound/SKILL.md` | `skills/spec-compound/SKILL.md` | 语义适配后同步 | opt-in session history 改为调用 `spec-sessions` |
| `skills/ce-resolve-pr-feedback/**` | `skills/resolve-pr-feedback/**` | 语义适配后同步 | 拆 `full-mode` / `targeted-mode` references；GraphQL connections 分页；保留 current project reply/resolve scripts |
| `skills/ce-plan/**` | `skills/spec-plan/**` | 语义适配后同步 | Implementation Units 用 `### U1.` headings；模板移到 `references/plan-template.md`；handoff 默认 headless doc-review 并提供 deeper review |
| `skills/ce-code-review/**` | `skills/spec-code-review/**` | 语义适配后同步 | 识别 heading 型 Implementation Units；escape table pipes；requirements completeness 覆盖 units |
| `skills/ce-doc-review/**` | `skills/spec-doc-review/**` | 语义适配后同步 | doc type classification、origin slot、diagram deletion suppression、prior-round resolution suppression、walkthrough option guard |
| `skills/ce-ideate/**` | `skills/spec-ideate/**` | 语义适配后同步 | topic axes、basis 命名、axis recovery、user-named root markdown；不引入 `STRATEGY.md` 作为 spec-first 必读 anchor |
| `skills/ce-commit-push-pr/**` | `skills/git-commit-push-pr/**` | 语义适配后同步 | 压缩模式检测和 PR writing guidance；保留 Spec-First badge、PR body file safety、current branch safeguards |
| `skills/ce-compound-refresh/**` | `skills/spec-compound-refresh/**` | 语义适配后同步 | 将 Keep/Update/Consolidate/Replace/Delete flows 移到 `references/per-action-flows.md` |
| `skills/ce-debug/SKILL.md` | `skills/spec-debug/SKILL.md` | 语义适配后同步 | trivial-bug fast path、observed-values hypothesis discipline、failed-fix invalidation |
| `skills/ce-work-beta/**` | `skills/spec-work-beta/**` | 语义适配后同步 | Codex current sandbox flags 与 per-batch effort；保留 explicit beta/delegation consent |
| `skills/ce-worktree/SKILL.md` | `skills/git-worktree/SKILL.md` | 语义适配后同步 | script path resolve against skill dir, not user cwd |
| `skills/lfg/SKILL.md` | `skills/lfg/SKILL.md` | 语义适配后同步 | CI watch/autofix loop；确认当前项目是否继续公开 `lfg` 后执行 |
| `skills/ce-agent-native-architecture/**` | `skills/agent-native-architecture/**` | 语义适配后同步 | slim main skill and add `references/checklists.md`; keep no `compound-engineering` leakage |
| `skills/ce-riffrec-feedback-analysis/**` | none | 延后 spike | 新外部反馈分析 skill，不属于当前主链路默认入口 |
| `skills/ce-brainstorm/SKILL.md`, `ce-optimize/SKILL.md`, `ce-proof/SKILL.md`, `ce-slack-research/SKILL.md` | mapped current targets | 直接或微适配 | mostly description/frontmatter trim；需防止触发精度下降 |

### CE Platform Source

| CE file | spec-first equivalent | Decision | Reason |
|---|---|---|---|
| `src/converters/claude-to-codex.ts`, `src/types/codex.ts`, `src/targets/codex.ts` | `src/cli/adapters/codex.js`, `src/cli/plugin.js`, `src/cli/claude-settings.js`, templates | 延后 spike | CE plugin conversion target 与 spec-first CommonJS init/clean/doctor runtime model 不同构 |
| `src/data/plugin-legacy-artifacts.ts`, `src/utils/legacy-cleanup.ts` | `src/cli/adapters/codex.js`, `src/cli/commands/clean.js`, runtime cleanup tests | 语义适配后同步 | 仅同步 retired session primitive cleanup 概念，不迁移 CE file paths |

### Tests

| CE tests | spec-first target | Decision |
|---|---|---|
| `session-history-scripts.test.ts`, `tests/skills/ce-session-historian-no-skill-tool.test.ts` | `tests/unit/session-history-scripts.test.js`, `tests/unit/spec-sessions-contracts.test.js` | 语义适配后同步 |
| `resolve-pr-feedback-pagination.test.ts` | `tests/unit/resolve-pr-feedback-contracts.test.js` or new focused test | 语义适配后同步 |
| `pipeline-review-contract.test.ts`, `review-skill-contract.test.ts` | `tests/unit/spec-plan-contracts.test.js`, `tests/unit/spec-code-review-contracts.test.js`, `tests/unit/spec-doc-review-contracts.test.js` | 语义适配后同步 |
| `codex-writer.test.ts`, `frontmatter.test.ts`, `compound-support-files.test.ts` | existing runtime/asset tests only if semantic sync lands | 部分同步 |
| `tests/skills/ce-worktree.test.ts` | `tests/unit/git-worktree-contracts.test.js` or existing shell/unit target | 语义适配后同步 |

---

## Implementation Units

### U1. Rework Session History Into Orchestrator-Owned Extraction

**Goal:** 把 CE session-history deadlock 修复适配到 spec-first：`spec-sessions` 负责发现、过滤、scratch extraction 和 dispatch，`spec-session-historian` 只综合已抽取文件。

**Requirements:** R1, R3, R4, R5, R6, R7

**Dependencies:** None

**Files:**
- Modify: `skills/spec-sessions/SKILL.md`
- Modify: `agents/spec-session-historian.agent.md`
- Modify: `skills/spec-compound/SKILL.md`
- Move/Delete: `skills/spec-session-inventory/**`, `skills/spec-session-extract/**` if scripts move into `skills/spec-sessions/scripts/`
- Modify: `src/cli/plugin.js` or asset filtering only if internal skill deletion changes runtime delivery
- Test: `tests/unit/spec-sessions-contracts.test.js`
- Test: `tests/unit/session-history-scripts.test.js`
- Test: runtime cleanup tests if source skills are deleted

**Approach:**
- Move deterministic scripts under `skills/spec-sessions/scripts/` or otherwise make `spec-sessions` script-owned; avoid subagent Skill calls.
- Preserve current project host boundary: Claude Code and Codex only. Do not import CE Cursor support unless scripts already support it and product boundary is separately approved.
- Update `spec-compound` to call `spec-sessions` synchronously after launching parallel research agents, preserving wall-clock overlap.
- Retire `spec-session-inventory` / `spec-session-extract` from runtime delivery only after `rg` confirms no remaining source caller depends on them as skills.

**Execution note:** Characterization-first. Start by adding contract tests that forbid `spec-session-historian` from invoking `session-inventory` / `session-extract` and require `spec-sessions` to own scratch extraction.

**Test scenarios:**
- Happy path: no question argument asks user through current host blocking tool, then runs session search.
- Edge case: keyword filter returns `files_matched: 0`; no extraction or historian dispatch happens.
- Edge case: selected sessions cap at 5 total.
- Error path: extraction output write fails; no synthesis dispatch with partial paths.
- Runtime: deleted primitive skills are cleaned from generated runtime or remain internal only if deliberately retained.

**Verification:**
- `npx jest tests/unit/spec-sessions-contracts.test.js tests/unit/session-history-scripts.test.js --runInBand`
- `npm run lint:skill-entrypoints`

---

### U2. Sync Resolve PR Feedback Pagination And Mode References

**Goal:** 把 CE `resolve-pr-feedback` 的 GraphQL pagination 修复和 full/targeted mode reference 拆分同步到 `resolve-pr-feedback`。

**Requirements:** R3, R4, R5, R7

**Dependencies:** None

**Files:**
- Modify: `skills/resolve-pr-feedback/SKILL.md`
- Create: `skills/resolve-pr-feedback/references/full-mode.md`
- Create: `skills/resolve-pr-feedback/references/targeted-mode.md`
- Modify: `skills/resolve-pr-feedback/scripts/get-pr-comments`
- Modify: `skills/resolve-pr-feedback/scripts/get-thread-for-comment`
- Test: `tests/unit/resolve-pr-feedback-contracts.test.js`

**Approach:**
- Keep GitHub API details in scripts; skill prose decides mode and dispatch strategy.
- Port separate paginated GraphQL queries for reviewThreads, comments, reviews because `gh api graphql --paginate` only follows outer pageInfo.
- Preserve `isOutdated` as relocation signal, not resolution signal.
- Do not copy CE names or path references.

**Test scenarios:**
- PR with more than one page of threads/comments/reviews is represented in JSON output.
- Targeted comment URL maps to parent thread when thread is beyond first page.
- Skill loads mode reference and does not inline hundreds of lines back into `SKILL.md`.

**Verification:**
- `npx jest tests/unit/resolve-pr-feedback-contracts.test.js --runInBand`
- `bash -n skills/resolve-pr-feedback/scripts/get-pr-comments skills/resolve-pr-feedback/scripts/get-thread-for-comment`

---

### U3. Sync Plan Template Extraction And Handoff Review Menu

**Goal:** 把 CE plan 的 `### U1.` implementation unit heading、`references/plan-template.md` 拆分、默认 headless doc-review 及 deeper review 入口适配到 `spec-plan`。

**Requirements:** R3, R4, R5, R7

**Dependencies:** None

**Files:**
- Modify: `skills/spec-plan/SKILL.md`
- Create: `skills/spec-plan/references/plan-template.md`
- Modify: `skills/spec-plan/references/plan-handoff.md`
- Modify: `skills/spec-plan/references/deepening-workflow.md` if section names drift
- Test: `tests/unit/spec-plan-contracts.test.js`
- Test: `tests/unit/runtime-plan-contracts.test.js` if runtime rendering is affected

**Approach:**
- Move large template out of `SKILL.md` only if current source still inlines it.
- Preserve spec-first current-host wording and `$spec-work` / `/spec:work` abstraction; never reintroduce `/ce-work`.
- Handoff menu must hide "Run deeper doc review" when only FYI findings remain.
- Keep absolute chat-output path rule.

**Test scenarios:**
- Generated plans use `### U1.` heading units, not list items.
- `spec-code-review` can read current numeric subsections and legacy bullet units.
- `spec-plan` loads `references/plan-template.md` and `references/plan-handoff.md` non-optionally.
- Handoff includes headless review summary and deeper review only for actionable findings.

**Verification:**
- `npx jest tests/unit/spec-plan-contracts.test.js tests/unit/runtime-plan-contracts.test.js --runInBand`

---

### U4. Reduce Review Noise And Harden Review Output Tables

**Goal:** 同步 CE code/doc review 的 document type adaptation、origin slot、literal pipe escaping、visual aid preservation 和 plan requirements completeness 修复。

**Requirements:** R3, R4, R5, R7

**Dependencies:** U3 for Implementation Units heading format.

**Files:**
- Modify: `skills/spec-code-review/SKILL.md`
- Modify: `skills/spec-code-review/references/review-output-template.md`
- Modify: `skills/spec-doc-review/SKILL.md`
- Modify: `skills/spec-doc-review/references/review-output-template.md`
- Modify: `skills/spec-doc-review/references/subagent-template.md`
- Modify: `skills/spec-doc-review/references/synthesis-and-presentation.md`
- Modify: `skills/spec-doc-review/references/walkthrough.md`
- Modify: document reviewer agents listed in the Agents section
- Test: `tests/unit/spec-code-review-contracts.test.js`
- Test: `tests/unit/spec-doc-review-contracts.test.js`

**Approach:**
- Orchestrator classifies `requirements` vs `plan` once and passes `Document type` plus `Origin` into reviewer prompts.
- Review personas trust context slots; they do not re-parse frontmatter.
- Plan with `origin:` suppresses product/premise re-litigation unless plan introduces new strategic or architectural risk.
- Escape `|` in markdown table cells for code and doc review outputs.
- Preserve diagrams and visual aids; update inconsistent diagrams instead of recommending deletion.

**Test scenarios:**
- Plan with origin does not activate routine adversarial premise challenge solely because it has many units.
- Finding table examples escape delimiter pipes.
- Walkthrough regular menu never replaces "best judgment on rest" with "Acknowledge".
- Code review requirements completeness checks both requirements and implementation units.

**Verification:**
- `npx jest tests/unit/spec-code-review-contracts.test.js tests/unit/spec-doc-review-contracts.test.js --runInBand`

---

### U5. Sync Ideate Topic Axes And Basis Contract

**Goal:** 把 CE ideate 的 topic-surface decomposition、axis recovery、basis terminology 和 user-named root markdown handling 同步到 `spec-ideate`，同时保持 spec-first 产品边界。

**Requirements:** R3, R4, R5, R6, R7

**Dependencies:** None

**Files:**
- Modify: `skills/spec-ideate/SKILL.md`
- Modify: `skills/spec-ideate/references/post-ideation-workflow.md`
- Modify: `skills/spec-ideate/references/universal-ideation.md`
- Test: `tests/unit/spec-ideate-contracts.test.js`

**Approach:**
- Add Phase 1.5 topic axes as orchestrator-side analysis, not script-owned state.
- Replace warrant terminology with basis only if all downstream artifact templates and tests are updated together.
- Treat user-named root `.md` files as constraint; other root docs as background.
- Do not make `STRATEGY.md` a required or privileged spec-first source unless a separate strategy skill/product decision lands.

**Test scenarios:**
- Surprise-me mode skips decomposition.
- Atomic subject skips decomposition.
- Axis coverage can dispatch up to 2 recovery agents, not unbounded.
- Survivor artifact records axis gaps.
- User-named markdown is full-read constraint; unrelated markdown remains background.

**Verification:**
- `npx jest tests/unit/spec-ideate-contracts.test.js --runInBand`

---

### U6. Sync PR Writing And Commit-Push-PR Compression Carefully

**Goal:** 将 CE `ce-commit-push-pr` 的精简 mode flow 与 PR description writing guidance 适配到 `git-commit-push-pr`。

**Requirements:** R3, R4, R5, R7

**Dependencies:** None

**Files:**
- Modify: `skills/git-commit-push-pr/SKILL.md`
- Modify: `skills/git-commit-push-pr/references/branch-creation.md`
- Modify: `skills/git-commit-push-pr/references/pr-description-writing.md`
- Test: `tests/unit/git-commit-push-pr-contracts.test.js`

**Approach:**
- Keep current spec-first branch safety, PR body `--body-file`, non-empty/readback guards and Spec-First badge.
- Sync concise mode routing only when it does not weaken default-branch protection.
- Keep user evidence prompt and demo integration but map `ce-demo-reel` to `feature-video` if current source uses that boundary.

**Test scenarios:**
- Description-only does not run full branch decision gates.
- Default branch still cannot be pushed directly.
- PR body never uses heredoc-to-stdin, `--body-file -`, or shell-expanded body string.
- Badge remains Spec-First, not Compound Engineering.

**Verification:**
- `npx jest tests/unit/git-commit-push-pr-contracts.test.js --runInBand`

---

### U7. Extract Compound Refresh Per-Action Flows

**Goal:** 把 `spec-compound-refresh` 的 Keep/Update/Consolidate/Replace/Delete flow 移入 reference，减小主 skill 并保留 action contract。

**Requirements:** R3, R4, R5, R7

**Dependencies:** None

**Files:**
- Modify: `skills/spec-compound-refresh/SKILL.md`
- Create: `skills/spec-compound-refresh/references/per-action-flows.md`
- Test: `tests/unit/spec-compound-contracts.test.js`

**Approach:**
- Main skill only路由到 matching reference；reference 承担 step-by-step flow。
- Preserve current `docs/solutions/` frontmatter validator and inbound-link final check.

**Test scenarios:**
- Main skill names all five flows and requires reading reference.
- Reference preserves parser-safe frontmatter validation before old file deletion.
- Delete flow final inbound-link check remains.

**Verification:**
- `npx jest tests/unit/spec-compound-contracts.test.js --runInBand`

---

### U8. Sync Debug Triage And Hypothesis Discipline

**Goal:** 将 CE debug 的 trivial-bug fast path、observed-value hypothesis 和 failed-fix invalidation 适配到 `spec-debug`。

**Requirements:** R3, R4, R5, R7

**Dependencies:** None

**Files:**
- Modify: `skills/spec-debug/SKILL.md`
- Test: `tests/unit/spec-debug-contracts.test.js`

**Approach:**
- Keep "investigate before fixing" as default, but allow obvious one-line bug fast path after user choice gate.
- Require at least one concrete observation for each hypothesis.
- On failed fix, explicitly invalidate prior hypothesis before forming another.

**Test scenarios:**
- Fast path still runs workspace/branch check before editing.
- Diagnosis-only path produces summary without code mutation.
- Failed fix wording requires invalidation evidence.

**Verification:**
- `npx jest tests/unit/spec-debug-contracts.test.js --runInBand`

---

### U9. Sync Work-Beta Codex Delegation Flags And Per-Batch Effort

**Goal:** 同步 CE work-beta 的 current Codex CLI sandbox flags 和 per-batch effort resolution。

**Requirements:** R3, R4, R5, R7

**Dependencies:** None

**Files:**
- Modify: `skills/spec-work-beta/SKILL.md`
- Modify: `skills/spec-work-beta/references/codex-delegation-workflow.md`
- Test: `tests/unit/spec-work-beta-contracts.test.js`

**Approach:**
- Replace stale `--yolo` / `--full-auto` semantics if present with current Codex flags.
- Derive `effective_effort` per batch; never pass literal `"default"` to `codex exec`.
- Preserve explicit beta consent and config default deferral to `~/.codex/config.toml`.

**Test scenarios:**
- full-auto maps to `-s workspace-write`.
- yolo maps to `--dangerously-bypass-approvals-and-sandbox`.
- Unset delegate effort plus default picked level emits no reasoning-effort flag.
- Config floor raises lower picked effort but does not lower higher picked effort.

**Verification:**
- `npx jest tests/unit/spec-work-beta-contracts.test.js --runInBand`

---

### U10. Sync Agent-Native Architecture Slimming And Checklist Reference

**Goal:** 把 `agent-native-architecture` 主 skill 瘦身，新增 checklist reference，减少启动上下文负担。

**Requirements:** R3, R4, R5, R7

**Dependencies:** None

**Files:**
- Modify: `skills/agent-native-architecture/SKILL.md`
- Create: `skills/agent-native-architecture/references/checklists.md`
- Test: `tests/unit/agent-native-architecture-contracts.test.js`

**Approach:**
- Preserve current non-CE skill identity and existing references.
- Move architecture checklist、anti-patterns、success criteria into `references/checklists.md`.
- Ensure runtime copies do not mention `compound-engineering` or `/ce-*`.

**Test scenarios:**
- Main skill lists route 14 for review/checklists.
- Checklist reference contains architecture checklist, anti-patterns and success criteria.
- No CE branding leaks into source/runtime transform.

**Verification:**
- `npx jest tests/unit/agent-native-architecture-contracts.test.js --runInBand`

---

### U11. Sync Small Workflow Fixes And Description Trims With Guardrails

**Goal:** 批量处理低风险小切片：`git-worktree` script path、`lfg` CI autofix loop、small descriptions and support prose trims。

**Requirements:** R3, R4, R5, R7

**Dependencies:** U1-U10 should land first so small trims do not obscure behavioral diffs.

**Files:**
- Modify: `skills/git-worktree/SKILL.md`
- Modify: `skills/lfg/SKILL.md`
- Potentially modify: `skills/spec-brainstorm/SKILL.md`, `skills/spec-optimize/SKILL.md`, `skills/proof/SKILL.md`, `skills/spec-slack-research/SKILL.md`, selected agent descriptions
- Test: existing contract tests for touched skills

**Approach:**
- Apply only changes that improve correctness or reduce context without losing trigger precision.
- For `lfg`, confirm whether this project still treats it as an exposed capability; if yes, add CI watch/autofix loop with bounded 3-iteration stop and durable residual PR-body section.
- For description trims, preserve trigger phrases that current tests or user workflows rely on.

**Verification:**
- `npm run lint:skill-entrypoints`
- Relevant focused Jest contracts based on touched files

---

## Deferred Or Rejected Slices

| Slice | Decision | Follow-up trigger |
|---|---|---|
| CE `docs/skills` user-facing docs | 延后 spike | User asks for a spec-first skill catalog/docs site, or README/user manual reorg plan is opened |
| CE `ce-strategy` | 延后 spike | Product strategy source-of-truth decision exists; must define `STRATEGY.md` ownership and consumers |
| CE `ce-product-pulse` | 延后 spike | External analytics/log/data source, PII policy and `.spec-first/config.local.yaml` contract are defined |
| CE `ce-simplify-code` | 延后 spike | Decide whether this belongs as `spec-work` / `spec-code-review` mode before new public skill |
| CE `ce-riffrec-feedback-analysis` | 延后 spike | User requests Riffrec/video feedback ingestion as a first-class input source |
| CE Codex hooks conversion | 延后 spike | Spec-first decides Codex runtime should write `.codex/hooks.json`; needs init/clean/doctor governance plan |
| CE release metadata and plugin manifests | 不同步 | Never for CE sync; spec-first release path owns versions |
| CE Cursor session support | 延后 spike | Product boundary expands beyond Claude/Codex session stores |

---

## System-Wide Impact

- **Runtime delivery:** U1 may remove or reclassify internal session primitive skills. This affects `buildFilteredAssetSet()`, runtime asset counts, `doctor`, `clean` cleanup and tests.
- **Review workflows:** U3 and U4 change plan/doc-review/code-review contracts; downstream `spec-work`, `spec-write-tasks` and PR review behavior may observe heading-format and requirements-completeness changes.
- **GitHub API scripts:** U2 changes JSON shape for `review_threads` to edge-wrapped `{ node: ... }`; callers and tests must align.
- **Codex delegation:** U9 changes `codex exec` invocation flags and reasoning-effort propagation.
- **Documentation governance:** The plan itself and future implementation must update `CHANGELOG.md`; docs/skills is not implemented in this plan.
- **Generated runtime assets:** Source edits may require `spec-first init --claude` / `spec-first init --codex` only after source validation, not before.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Session primitive deletion breaks existing callers | Run `rg "spec-session-inventory|spec-session-extract|session-inventory|session-extract"` before deletion; update or preserve internal delivery if any caller remains |
| CE Cursor support leaks into spec-first | Add contract assertions that session docs mention only Claude Code and Codex unless product boundary changes |
| Review-noise suppression hides real findings | Tests must cover high-stakes / no-origin cases where adversarial/product/scope personas still activate |
| Plan template extraction breaks runtime rendering | Add source and rendered runtime contract tests for plan template loading |
| Resolve PR feedback JSON shape changes break scripts | Update all parsing references and add fixture tests for paginated thread output |
| Codex flags drift again | Contract tests assert exact current flags and forbid stale `--yolo` / `--full-auto` in delegation workflow |
| Description trimming removes trigger phrases | Contract tests should check trigger precision for public skills before accepting trims |
| Changelog conflicts with existing dirty file | Append one line only; do not reorder or normalize unrelated entries |

---

## Verification Matrix

Run narrow tests after each implementation unit, then final broader checks:

| Unit | Focused verification |
|---|---|
| U1 | `npx jest tests/unit/spec-sessions-contracts.test.js tests/unit/session-history-scripts.test.js --runInBand` |
| U2 | `npx jest tests/unit/resolve-pr-feedback-contracts.test.js --runInBand`; `bash -n` PR feedback scripts |
| U3 | `npx jest tests/unit/spec-plan-contracts.test.js tests/unit/runtime-plan-contracts.test.js --runInBand` |
| U4 | `npx jest tests/unit/spec-code-review-contracts.test.js tests/unit/spec-doc-review-contracts.test.js --runInBand` |
| U5 | `npx jest tests/unit/spec-ideate-contracts.test.js --runInBand` |
| U6 | `npx jest tests/unit/git-commit-push-pr-contracts.test.js --runInBand` |
| U7 | `npx jest tests/unit/spec-compound-contracts.test.js --runInBand` |
| U8 | `npx jest tests/unit/spec-debug-contracts.test.js --runInBand` |
| U9 | `npx jest tests/unit/spec-work-beta-contracts.test.js --runInBand` |
| U10 | `npx jest tests/unit/agent-native-architecture-contracts.test.js --runInBand` |
| U11 | touched skill tests plus `npm run lint:skill-entrypoints` |
| Final | `git diff --check`; `npm run test:unit`; `npm run typecheck`; `npm run test:smoke` if runtime assets or CLI behavior changed |

Fresh-source eval:

- Required only for behavior-sensitive skill/agent prose if the host permits helper agents and the user has not disabled them.
- If not executed, record the reason in the implementation ledger or final summary; do not claim behavior-level eval passed.

---

## CHANGELOG And Runtime Regeneration

Implementation must add a `CHANGELOG.md` entry for every source change batch. The expected implementation changelog shape:

```text
- v1.8.0 YYYY-MM-DD HH:MM:SS leokuang: fix(ce-sync): 语义适配 CE 834ca4e5 workflow 更新，覆盖 sessions 编排、review 降噪、plan 模板、PR feedback 分页、ideate axes、work-beta Codex flags 等契约 (user-visible)
```

Runtime regeneration:

- Do not hand-edit `.claude/`, `.codex/`, `.agents/skills/`.
- If source changes affect runtime delivery, run `spec-first init --claude` and/or `spec-first init --codex` after source tests pass.
- If runtime regeneration changes tracked source files such as `CLAUDE.md` or `AGENTS.md` managed blocks, inspect diffs and ensure they are source-of-truth generator outputs.

---

## Sources & References

- Sync methodology: `docs/solutions/architecture-patterns/upstream-ce-sync-upgrade-methodology-2026-04-26.md`
- Previous CE ledger: `docs/validation/2026-05-05-ce-06a7cee0-sync-ledger.md`
- Previous CE plan: `docs/plans/2026-05-04-001-sync-ce-06a7cee0-workflow-updates-plan.md`
- CE repo: `/Users/kuang/xiaobu/compound-engineering-plugin`
- CE range: `06a7cee0..834ca4e5`
- Current spec-first role baseline: `docs/10-prompt/结构化项目角色契约.md`
