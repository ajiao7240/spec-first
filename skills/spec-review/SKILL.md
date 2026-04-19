---
name: review-workflow
description: "Structured code review using tiered persona agents, confidence-gated findings, and a merge/dedup pipeline. Use when reviewing code changes before creating a PR."
argument-hint: "[mode:autofix|mode:report-only] [PR number, GitHub URL, or branch name]"
---

# Code Review

Reviews code changes using dynamically selected reviewer personas. Spawns parallel sub-agents that return structured JSON, then merges and deduplicates findings into a single report.

## Stage-0 上下文预载（可选增强，不阻断主工作流）

> 此步骤读取 `spec-graph-bootstrap` 生成的 Stage-0 产物作为增强上下文，
> 在 reviewer 召唤前注入，扩展 review 的风险感知范围。
> 优先以 evaluator 输出 contract 为真源；任何文件缺失、JSON 解析失败、目录不存在均只触发降级，不中止主工作流。

**本 workflow stage 标识**：`review`

### 预载步骤

1. **解析 slug**
   - 取当前仓库根目录名：`slug = basename(git rev-parse --show-toplevel)`
   - context 路径：`docs/contexts/<slug>/`
   - 命令失败或路径不存在 → 跳过整个预载步骤（Level 3）

2. **读取 control plane contract**
   - 控制面路径：`.spec-first/workflows/bootstrap/<slug>/`
   - 优先读取 `context-routing.json` 与 `artifact-manifest.json`
   - 若存在 `minimal-context/review.json`，视为最高优先级 machine context
   - 任一关键 contract 缺失或解析失败 → 进入 Level 2 降级

3. **按 evaluator 输出 contract 组织上下文**
   - 优先以 `selection_subject / selected_contexts` 作为 Stage-0 的解释型真源，回答“命中了谁、为什么命中、当前上下文边界是什么”
   - `selected_assets / fallback_reason / level / skipped_rules` 保留为 compatibility view；它们必须由解释层单向派生，不再反向决定命中主体
   - `review` 场景优先读取：
     - `minimal-context/review.json`
     - `code-facts/high-risk-modules.md`
     - `code-facts/test-map.md`
     - `context-packs/review-change.md`
   - `injection-index.yaml` 仅作为人类视图，不再是运行时唯一判定逻辑
   - 若 runtime 输出 `selection_subject.kind = workspace`，仅把它视为 overview / unresolved fallback，不要把 workspace 当成常规 `L0` review 主体
   - 若 `minimal-context/review.json` 提供 `platform_focus` 或 `verification_gaps_to_check`，将其视为 repo 级 verification summary baseline
   - 若当前 runtime `verification_summary` 还提供 `source / verification_gaps_to_check / recommended_required_verifications / recommended_optional_verifications / repo_verification_gaps_to_check`，则以 `verification_gaps_to_check` 作为本次 review 的 effective gap checklist；若同时提供顶层 `verifier_dispatch`，则把 `verifier_dispatch.handoff_posture / dispatch_candidates / manual_required_verifications / dispatch_blockers` 视为“候选 verifier + blocker”输入，而不是固定 dispatch 树
   - 若 `verification_summary.source === 'change-surface'`，即使 `verification_gaps_to_check` 为空，也不要把 `repo_verification_gaps_to_check` 回填成当前改动必须检查的缺口；后者只表示仓库级 baseline
   - 若当前 runtime 还提供 `ai_dev_quality_gate_result.passed / checks / failures / artifact_path`，则把它视为最近一次 CI/gate 的事实快照；它可以帮助判断当前改动的质量背景，但不能被解释成 review 编排状态
   - 若当前 runtime 还提供 `verification_evidence.evidence_items`，则把它当成独立证据引用清单；它只回答“已有何种证据、来自哪个 verifier、落在哪”，不回答执行编排
   - 若当前 runtime 还提供 `verification_gate_state.overall_status / required_gates / optional_evidence / blockers / ci_gate`，则用它区分“缺证据 / 被 blocker 阻断 / 已满足 / 当前无需验证”，不要把它当成已经执行过 verifier 的证明；只有挂上真实 evidence reference 时，`satisfied` 才成立
   - **Runtime Stage-0 context（best-effort, pre-resolved JSON）**
!`repo=$(git rev-parse --show-toplevel 2>/dev/null || pwd); if command -v spec-first >/dev/null 2>&1 && spec-first stage0-context --stage review --workflow spec-review --format json 2>/dev/null; then true; elif [ -f "$repo/bin/spec-first.js" ] && node "$repo/bin/spec-first.js" stage0-context --stage review --workflow spec-review --format json 2>/dev/null; then true; elif [ -f "$repo/node_modules/spec-first/bin/spec-first.js" ] && node "$repo/node_modules/spec-first/bin/spec-first.js" stage0-context --stage review --workflow spec-review --format json 2>/dev/null; then true; else echo '__SPEC_FIRST_STAGE0_CONTEXT_UNAVAILABLE__'; fi`
   - 若输出为 `__SPEC_FIRST_STAGE0_CONTEXT_UNAVAILABLE__`，说明 runtime helper 当前不可用；继续按上面的 control plane contract 手工预载，不阻断主任务
   - 每个文件：存在则读取，缺失则跳过（Level 1）
   - 默认写一条 Stage-0 telemetry，至少记录 `stage / profile / selection_subject / selected_contexts / selected_assets / fallback_reason / skipped_rules`

4. **Level 2 固定最小集合**（control plane contract 不可用时）
   - `docs/contexts/<slug>/00-summary.md`
   - `docs/contexts/<slug>/pitfalls/index.md`
   - `docs/contexts/<slug>/code-facts/public-entrypoints.md`
   - `docs/contexts/<slug>/code-facts/test-map.md`

5. **降级说明**
   - 触发降级时，在响应中一句话说明原因
   - 不要求用户先补 bootstrap 产物，主任务继续执行

6. **workspace v1 边界**
   - 默认仍按单仓 Stage-0 消费，不改变现有 selected assets 顺序
   - 若 runtime 已解析出 workspace / module / nested topology，以 `selection_subject / selected_contexts` 为准，不再把 repo-only 路径假设当成唯一语义
   - 只有显式提供 `repoRoots` 时，才进入 workspace 聚合路径

### Reload Before Act

Treat freshness and fallback as trust-shaping inputs, not as blockers:

- `L0` and non-stale context: consume Stage-0 directly; no forced reload before reviewer dispatch
- `L1` with `freshness_stale`: before spawning reviewers, re-read the explicit plan (if any), the diff scope, and the most relevant `selected_assets`
- `L2`: treat Stage-0 as degraded context; re-read the current diff, the most relevant code facts, and any explicit plan/source path before review
- `L3` or runtime helper unavailable: continue, but say bootstrap context is unavailable and rely on direct repo reads

Reload priority should be:
1. Explicit `plan:<path>` input or other user-provided source path
2. Stage-0 `selected_assets`
3. Current diff / review scope
4. Broader repo context only if still needed

Do not block review solely because context is stale or partial. Do not present `freshness_stale` as `L0`.

## When to Use

- Before creating a PR
- After completing a task during iterative implementation
- When feedback is needed on any code changes
- Can be invoked standalone
- Can run as a read-only or autofix review step inside larger workflows

## Argument Parsing

Parse `$ARGUMENTS` for the following optional tokens. Strip each recognized token before interpreting the remainder as the PR number, GitHub URL, or branch name.

| Token | Example | Effect |
|-------|---------|--------|
| `mode:autofix` | `mode:autofix` | Select autofix mode (see Mode Detection below) |
| `mode:report-only` | `mode:report-only` | Select report-only mode |
| `base:<sha-or-ref>` | `base:abc1234` or `base:origin/main` | Skip scope detection — use this as the diff base directly |
| `plan:<path>` | `plan:docs/plans/2026-03-25-001-feat-foo-plan.md` | Load this plan for requirements verification |
| `work_run:<run-id>` | `work_run:20260419-231500-ab12cd34` | Load the explicit upstream `spec-work` run artifact for execution context |
| `work_artifact_dir:<path>` | `work_artifact_dir:.spec-first/workflows/spec-work/demo/20260419-231500-ab12cd34` | Load the explicit upstream `spec-work` artifact directory |

All tokens are optional. Each one present means one less thing to infer. When absent, fall back to existing behavior for that stage.

### Optional Upstream Work Handoff

When `work_run:<run-id>` or `work_artifact_dir:<path>` is provided:

- Prefer that explicit handoff over any directory inference.
- Read `artifact_dir/run.json` as the machine truth from upstream execution.
- Treat `artifact_dir/closure-summary.md` as optional human-readable projection only.
- Use `current_core_goal`, `plan_deviations`, `verification`, `residual_risks`, and `resume_anchor` as advisory review context. They can sharpen review focus, but they do not replace diff analysis or create a second verdict engine.

When no explicit work handoff is provided but the review is clearly downstream of `spec-work`:

- You may infer the latest matching work artifact using `plan_path + workspace_slug`, optionally narrowed by `git_branch` or `head_sha`.
- Do not treat a leaf file path such as `run.json` as the stable cross-workflow identifier.
- If no matching artifact is found, continue without it. Missing work artifacts are a degraded-input condition, not a blocker.

**Conflicting mode flags:** If multiple mode tokens appear in arguments, stop and do not dispatch agents. Emit: `Review failed. Reason: conflicting mode flags — <mode_a> and <mode_b> cannot be combined.`

## Mode Detection

| Mode | When | Behavior |
|------|------|----------|
| **Interactive** (default) | No mode token present | Review, apply `safe_auto` fixes automatically, present findings, ask for policy decisions on `gated_auto` / `manual` findings, and optionally continue into fix/push/PR next steps |
| **Autofix** | `mode:autofix` in arguments | No user interaction. Review, apply only policy-allowed `safe_auto` fixes, re-review in bounded rounds, write a run artifact, and emit residual downstream work when needed |
| **Report-only** | `mode:report-only` in arguments | Strictly read-only. Review and report only, then stop with no edits, artifacts, todos, commits, pushes, or PR actions |

### Autofix mode rules

- **Skip all user questions.** Never pause for approval or clarification once scope has been established.
- **Apply only `safe_auto -> review-fixer` findings.** Leave `gated_auto`, `manual`, `human`, and `release` work unresolved.
- **Write a run artifact** under `.spec-first/workflows/spec-review/<run-id>/` summarizing findings, applied fixes, residual actionable work, and advisory outputs.
- **Create durable todo files only for unresolved actionable findings** whose final owner is `downstream-resolver`. Load the `todo-create` skill for the canonical directory path and naming convention.
- **Never commit, push, or create a PR** from autofix mode. Parent workflows own those decisions.

### Report-only mode rules

- **Skip all user questions.** Infer intent conservatively if the diff metadata is thin.
- **Never edit files or externalize work.** Do not write `.spec-first/workflows/spec-review/<run-id>/`, do not create todo files, and do not commit, push, or create a PR.
- **Safe for parallel read-only verification.** `mode:report-only` is the only mode that is safe to run concurrently with browser testing on the same checkout.
- **Do not switch the shared checkout.** If the caller passes an explicit PR or branch target, `mode:report-only` must run in an isolated checkout/worktree or stop instead of running `gh pr checkout` / `git checkout`.
- **Do not overlap mutating review with browser testing on the same checkout.** If a future orchestrator wants fixes, run the mutating review phase after browser testing or in an isolated checkout/worktree.

## Severity Scale

All reviewers use P0-P3:

| Level | Meaning | Action |
|-------|---------|--------|
| **P0** | Critical breakage, exploitable vulnerability, data loss/corruption | Must fix before merge |
| **P1** | High-impact defect likely hit in normal usage, breaking contract | Should fix |
| **P2** | Moderate issue with meaningful downside (edge case, perf regression, maintainability trap) | Fix if straightforward |
| **P3** | Low-impact, narrow scope, minor improvement | User's discretion |

## Action Routing

Severity answers **urgency**. Routing answers **who acts next** and **whether this skill may mutate the checkout**.

| `autofix_class` | Default owner | Meaning |
|-----------------|---------------|---------|
| `safe_auto` | `review-fixer` | Local, deterministic fix suitable for the in-skill fixer when the current mode allows mutation |
| `gated_auto` | `downstream-resolver` or `human` | Concrete fix exists, but it changes behavior, contracts, permissions, or another sensitive boundary that should not be auto-applied by default |
| `manual` | `downstream-resolver` or `human` | Actionable work that should be handed off rather than fixed in-skill |
| `advisory` | `human` or `release` | Report-only output such as learnings, rollout notes, or residual risk |

Routing rules:

- **Synthesis owns the final route.** Persona-provided routing metadata is input, not the last word.
- **Choose the more conservative route on disagreement.** A merged finding may move from `safe_auto` to `gated_auto` or `manual`, but never the other way without stronger evidence.
- **Only `safe_auto -> review-fixer` enters the in-skill fixer queue automatically.**
- **`requires_verification: true` means a fix is not complete without targeted tests, a focused re-review, or operational validation.**

## Reviewers

17 reviewer personas in layered conditionals, plus CE-specific agents. See the persona catalog included below for the full catalog.

**Always-on (every review):**

| Agent | Focus |
|-------|-------|
| `spec-first:review:correctness-reviewer` | Logic errors, edge cases, state bugs, error propagation |
| `spec-first:review:testing-reviewer` | Coverage gaps, weak assertions, brittle tests |
| `spec-first:review:maintainability-reviewer` | Coupling, complexity, naming, dead code, abstraction debt |
| `spec-first:review:project-standards-reviewer` | CLAUDE.md and AGENTS.md compliance -- frontmatter, references, naming, portability |
| `spec-first:review:agent-native-reviewer` | Verify new features are agent-accessible |
| `spec-first:research:learnings-researcher` | Search docs/solutions/ for past issues related to this PR |

**Cross-cutting conditional (selected per diff):**

| Agent | Select when diff touches... |
|-------|---------------------------|
| `spec-first:review:security-reviewer` | Auth, public endpoints, user input, permissions |
| `spec-first:review:performance-reviewer` | DB queries, data transforms, caching, async |
| `spec-first:review:api-contract-reviewer` | Routes, serializers, type signatures, versioning |
| `spec-first:review:data-migrations-reviewer` | Migrations, schema changes, backfills |
| `spec-first:review:reliability-reviewer` | Error handling, retries, timeouts, background jobs |
| `spec-first:review:adversarial-reviewer` | Diff >=50 changed lines of executable code (not prose/instruction Markdown, JSON schemas, or config), or auth, payments, data mutations, external APIs |
| `spec-first:review:cli-readiness-reviewer` | CLI command definitions, argument parsing, CLI framework usage, command handler implementations |
| `spec-first:review:previous-comments-reviewer` | Reviewing a PR that has existing review comments or threads |

**Stack-specific conditional (selected per diff):**

| Agent | Select when diff touches... |
|-------|---------------------------|
| `spec-first:review:dhh-rails-reviewer` | Rails architecture, service objects, session/auth choices, or Hotwire-vs-SPA boundaries |
| `spec-first:review:kieran-rails-reviewer` | Rails application code where conventions, naming, and maintainability are in play |
| `spec-first:review:kieran-python-reviewer` | Python modules, endpoints, scripts, or services |
| `spec-first:review:kieran-typescript-reviewer` | TypeScript components, services, hooks, utilities, or shared types |
| `spec-first:review:julik-frontend-races-reviewer` | Stimulus/Turbo controllers, DOM events, timers, animations, or async UI flows |

**CE conditional (migration-specific):**

| Agent | Select when diff includes migration files |
|-------|------------------------------------------|
| `spec-first:review:schema-drift-detector` | Cross-references schema.rb against included migrations |
| `spec-first:review:deployment-verification-agent` | Produces deployment checklist with SQL verification queries |

## Review Scope

Every review spawns all 4 always-on personas plus the 2 CE always-on agents, then adds whichever cross-cutting and stack-specific conditionals fit the diff. The model naturally right-sizes: a small config change triggers 0 conditionals = 6 reviewers. A Rails auth feature might trigger security + reliability + kieran-rails + dhh-rails = 10 reviewers.

## Protected Artifacts

The following paths are spec-first pipeline artifacts and must never be flagged for deletion, removal, or gitignore by any reviewer:

- `docs/brainstorms/*` -- requirements documents created by spec:brainstorm
- `docs/plans/*.md` -- plan files created by spec:plan (living documents with progress checkboxes)
- `docs/solutions/*.md` -- solution documents created during the pipeline

If a reviewer flags any file in these directories for cleanup or removal, discard that finding during synthesis.

## How to Run

### Stage 1: Determine scope

Compute the diff range, file list, and diff. Minimize permission prompts by combining into as few commands as possible.

**If `base:` argument is provided (fast path):**

The caller already knows the diff base. Skip all base-branch detection, remote resolution, and merge-base computation. Use the provided value directly:

```
BASE_ARG="{base_arg}"
BASE=$(git merge-base HEAD "$BASE_ARG" 2>/dev/null) || BASE="$BASE_ARG"
```

Then produce the same output as the other paths:

```
echo "BASE:$BASE" && echo "FILES:" && git diff --name-only $BASE && echo "DIFF:" && git diff -U10 $BASE && echo "UNTRACKED:" && git ls-files --others --exclude-standard
```

This path works with any ref — a SHA, `origin/main`, a branch name. Automated callers (spec:work, lfg) should prefer this to avoid the detection overhead. **Do not combine `base:` with a PR number or branch target.** If both are present, stop with an error: "Cannot use `base:` with a PR number or branch target — `base:` implies the current checkout is already the correct branch. Pass `base:` alone, or pass the target alone and let scope detection resolve the base." This avoids scope/intent mismatches where the diff base comes from one source but the code and metadata come from another.

**If a PR number or GitHub URL is provided as an argument:**

If `mode:report-only` is active, do **not** run `gh pr checkout <number-or-url>` on the shared checkout. Tell the caller: "mode:report-only cannot switch the shared checkout to review a PR target. Run it from an isolated worktree/checkout for that PR, or run report-only with no target argument on the already checked out branch." Stop here unless the review is already running in an isolated checkout.

First, verify the worktree is clean before switching branches:

```
git status --porcelain
```

If the output is non-empty, inform the user: "You have uncommitted changes on the current branch. Stash or commit them before reviewing a PR, or use standalone mode (no argument) to review the current branch as-is." Do not proceed with checkout until the worktree is clean.

Then check out the PR branch so persona agents can read the actual code (not the current checkout):

```
gh pr checkout <number-or-url>
```

Then fetch PR metadata. Capture the base branch name and the PR base repository identity, not just the branch name:

```
gh pr view <number-or-url> --json title,body,baseRefName,headRefName,url
```

Use the repository portion of the returned PR URL as `<base-repo>` (for example, `sunrain520/spec-first` from `https://github.com/sunrain520/spec-first/pull/348`).

Then compute a local diff against the PR's base branch so re-reviews also include local fix commits and uncommitted edits. Substitute the PR base branch from metadata (shown here as `<base>`) and the PR base repository identity derived from the PR URL (shown here as `<base-repo>`). Resolve the base ref from the PR's actual base repository, not by assuming `origin` points at that repo:

```
PR_BASE_REMOTE=$(git remote -v | awk 'index($2, "github.com:<base-repo>") || index($2, "github.com/<base-repo>") {print $1; exit}')
if [ -n "$PR_BASE_REMOTE" ]; then PR_BASE_REMOTE_REF="$PR_BASE_REMOTE/<base>"; else PR_BASE_REMOTE_REF=""; fi
PR_BASE_REF=$(git rev-parse --verify "$PR_BASE_REMOTE_REF" 2>/dev/null || git rev-parse --verify <base> 2>/dev/null || true)
if [ -z "$PR_BASE_REF" ]; then
  if [ -n "$PR_BASE_REMOTE_REF" ]; then
    git fetch --no-tags "$PR_BASE_REMOTE" <base>:refs/remotes/"$PR_BASE_REMOTE"/<base> 2>/dev/null || git fetch --no-tags "$PR_BASE_REMOTE" <base> 2>/dev/null || true
    PR_BASE_REF=$(git rev-parse --verify "$PR_BASE_REMOTE_REF" 2>/dev/null || git rev-parse --verify <base> 2>/dev/null || true)
  else
    if git fetch --no-tags https://github.com/<base-repo>.git <base> 2>/dev/null; then
      PR_BASE_REF=$(git rev-parse --verify FETCH_HEAD 2>/dev/null || true)
    fi
    if [ -z "$PR_BASE_REF" ]; then PR_BASE_REF=$(git rev-parse --verify <base> 2>/dev/null || true); fi
  fi
fi
if [ -n "$PR_BASE_REF" ]; then BASE=$(git merge-base HEAD "$PR_BASE_REF" 2>/dev/null) || BASE=""; else BASE=""; fi
```

```
if [ -n "$BASE" ]; then echo "BASE:$BASE" && echo "FILES:" && git diff --name-only $BASE && echo "DIFF:" && git diff -U10 $BASE && echo "UNTRACKED:" && git ls-files --others --exclude-standard; else echo "ERROR: Unable to resolve PR base branch <base> locally. Fetch the base branch and rerun so the review scope stays aligned with the PR."; fi
```

Extract PR title/body, base branch, and PR URL from `gh pr view`, then extract the base marker, file list, diff content, and `UNTRACKED:` list from the local command. Do not use `gh pr diff` as the review scope after checkout -- it only reflects the remote PR state and will miss local fix commits until they are pushed. If the base ref still cannot be resolved from the PR's actual base repository after the fetch attempt, stop instead of falling back to `git diff HEAD`; a PR review without the PR base branch is incomplete.

**If a branch name is provided as an argument:**

Check out the named branch, then diff it against the base branch. Substitute the provided branch name (shown here as `<branch>`).

If `mode:report-only` is active, do **not** run `git checkout <branch>` on the shared checkout. Tell the caller: "mode:report-only cannot switch the shared checkout to review another branch. Run it from an isolated worktree/checkout for `<branch>`, or run report-only on the current checkout with no target argument." Stop here unless the review is already running in an isolated checkout.

First, verify the worktree is clean before switching branches:

```
git status --porcelain
```

If the output is non-empty, inform the user: "You have uncommitted changes on the current branch. Stash or commit them before reviewing another branch, or provide a PR number instead." Do not proceed with checkout until the worktree is clean.

```
git checkout <branch>
```

Then detect the review base branch and compute the merge-base. Run the `references/resolve-base.sh` script, which handles fork-safe remote resolution with multi-fallback detection (PR metadata -> `origin/HEAD` -> `gh repo view` -> common branch names):

```
RESOLVE_OUT=$(bash references/resolve-base.sh) || { echo "ERROR: resolve-base.sh failed"; exit 1; }
if [ -z "$RESOLVE_OUT" ] || echo "$RESOLVE_OUT" | grep -q '^ERROR:'; then echo "${RESOLVE_OUT:-ERROR: resolve-base.sh produced no output}"; exit 1; fi
BASE=$(echo "$RESOLVE_OUT" | sed 's/^BASE://')
```

If the script outputs an error, stop instead of falling back to `git diff HEAD`; a branch review without the base branch would only show uncommitted changes and silently miss all committed work.

On success, produce the diff:

```
echo "BASE:$BASE" && echo "FILES:" && git diff --name-only $BASE && echo "DIFF:" && git diff -U10 $BASE && echo "UNTRACKED:" && git ls-files --others --exclude-standard
```

You may still fetch additional PR metadata with `gh pr view` for title, body, and linked issues, but do not fail if no PR exists.

**If no argument (standalone on current branch):**

Detect the review base branch and compute the merge-base using the same `references/resolve-base.sh` script as branch mode:

```
RESOLVE_OUT=$(bash references/resolve-base.sh) || { echo "ERROR: resolve-base.sh failed"; exit 1; }
if [ -z "$RESOLVE_OUT" ] || echo "$RESOLVE_OUT" | grep -q '^ERROR:'; then echo "${RESOLVE_OUT:-ERROR: resolve-base.sh produced no output}"; exit 1; fi
BASE=$(echo "$RESOLVE_OUT" | sed 's/^BASE://')
```

If the script outputs an error, stop instead of falling back to `git diff HEAD`; a standalone review without the base branch would only show uncommitted changes and silently miss all committed work on the branch.

On success, produce the diff:

```
echo "BASE:$BASE" && echo "FILES:" && git diff --name-only $BASE && echo "DIFF:" && git diff -U10 $BASE && echo "UNTRACKED:" && git ls-files --others --exclude-standard
```

Using `git diff $BASE` (without `..HEAD`) diffs the merge-base against the working tree, which includes committed, staged, and unstaged changes together.

**Untracked file handling:** Always inspect the `UNTRACKED:` list, even when `FILES:`/`DIFF:` are non-empty. Untracked files are outside review scope until staged. If the list is non-empty, tell the user which files are excluded. If any of them should be reviewed, stop and tell the user to `git add` them first and rerun. Only continue when the user is intentionally reviewing tracked changes only. In `mode:autofix`, do not stop to ask — proceed with tracked changes only and note the excluded untracked files in the Coverage section of the output.

### Stage 2: Intent discovery

Understand what the change is trying to accomplish. The source of intent depends on which Stage 1 path was taken:

**PR/URL mode:** Use the PR title, body, and linked issues from `gh pr view` metadata. Supplement with commit messages from the PR if the body is sparse.

**Branch mode:** Run `git log --oneline ${BASE}..<branch>` using the resolved merge-base from Stage 1.

**Standalone (current branch):** Run:

```
echo "BRANCH:" && git rev-parse --abbrev-ref HEAD && echo "COMMITS:" && git log --oneline ${BASE}..HEAD
```

Combined with conversation context (plan section summary, PR description), write a 2-3 line intent summary:

```
Intent: Simplify tax calculation by replacing the multi-tier rate lookup
with a flat-rate computation. Must not regress edge cases in tax-exempt handling.
```

Pass this to every reviewer in their spawn prompt. Intent shapes *how hard each reviewer looks*, not which reviewers are selected.

**When intent is ambiguous:**

- **Interactive mode:** Ask one question using the platform's interactive question tool (AskUserQuestion in Claude Code, request_user_input in Codex): "What is the primary goal of these changes?" Do not spawn reviewers until intent is established.
- **Autofix/report-only modes:** Infer intent conservatively from the branch name, diff, PR metadata, and caller context. Note the uncertainty in Coverage or Verdict reasoning instead of blocking.

### Stage 2b: Plan discovery (requirements verification)

Locate the plan document so Stage 6 can verify requirements completeness. Check these sources in priority order — stop at the first hit:

1. **`plan:` argument.** If the caller passed a plan path, use it directly. Read the file to confirm it exists.
2. **PR body.** If PR metadata was fetched in Stage 1, scan the body for paths matching `docs/plans/*.md`. If exactly one match is found and the file exists, use it as `plan_source: explicit`. If multiple plan paths appear, treat as ambiguous — demote to `plan_source: inferred` for the most recent match that exists on disk, or skip if none exist or none clearly relate to the PR title/intent. Always verify the selected file exists before using it — stale or copied plan links in PR descriptions are common.
3. **Auto-discover.** Extract 2-3 keywords from the branch name (e.g., `feat/onboarding-skill` -> `onboarding`, `skill`). Glob `docs/plans/*` and filter filenames containing those keywords. If exactly one match, use it. If multiple matches or the match looks ambiguous (e.g., generic keywords like `review`, `fix`, `update` that could hit many plans), **skip auto-discovery** — a wrong plan is worse than no plan. If zero matches, skip.

**Confidence tagging:** Record how the plan was found:
- `plan:` argument -> `plan_source: explicit` (high confidence)
- Single unambiguous PR body match -> `plan_source: explicit` (high confidence)
- Multiple/ambiguous PR body matches -> `plan_source: inferred` (lower confidence)
- Auto-discover with single unambiguous match -> `plan_source: inferred` (lower confidence)

If a plan is found, read its **Requirements Trace** (R1, R2, etc.) and **Implementation Units** (checkbox items). Store the extracted requirements list and `plan_source` for Stage 6. Do not block the review if no plan is found — requirements verification is additive, not required.

### Stage 3: Select reviewers

Read the diff and file list from Stage 1. The 4 always-on personas and 2 CE always-on agents are automatic. For each cross-cutting and stack-specific conditional persona in the persona catalog included below, decide whether the diff warrants it. This is agent judgment, not keyword matching.

**File-type awareness for conditional selection:** Instruction-prose files (Markdown skill definitions, JSON schemas, config files) are product code but do not benefit from runtime-focused reviewers. The adversarial reviewer's techniques target executable code behavior. For diffs that only change instruction-prose files, skip adversarial unless the prose describes auth, payment, or data-mutation behavior. Count only executable code lines toward line-count thresholds.

**`previous-comments` is PR-only.** Only select this persona when Stage 1 gathered PR metadata (PR number or URL was provided as an argument, or `gh pr view` returned metadata for the current branch). Skip it entirely for standalone branch reviews with no associated PR -- there are no prior comments to check.

Stack-specific personas are additive. A Rails UI change may warrant `kieran-rails` plus `julik-frontend-races`; a TypeScript API diff may warrant `kieran-typescript` plus `api-contract` and `reliability`.

For CE conditional agents, check if the diff includes files matching `db/migrate/*.rb`, `db/schema.rb`, or data backfill scripts.

Announce the team before spawning:

```
Review team:
- correctness (always)
- testing (always)
- maintainability (always)
- project-standards (always)
- agent-native-reviewer (always)
- learnings-researcher (always)
- security -- new endpoint in routes.rb accepts user-provided redirect URL
- kieran-rails -- controller and Turbo flow changed in app/controllers and app/views
- dhh-rails -- diff adds service objects around ordinary Rails CRUD
- data-migrations -- adds migration 20260303_add_index_to_orders
- schema-drift-detector -- migration files present
```

This is progress reporting, not a blocking confirmation.

### Stage 3b: Discover project standards paths

Before spawning sub-agents, find the file paths (not contents) of all relevant standards files for the `project-standards` persona. Use the native file-search/glob tool to locate:

1. Use the native file-search tool (e.g., Glob in Claude Code) to find all `**/CLAUDE.md` and `**/AGENTS.md` in the repo.
2. Filter to those whose directory is an ancestor of at least one changed file. A standards file governs all files below it (e.g., `plugins/spec-first/AGENTS.md` applies to everything under `plugins/spec-first/`).

Pass the resulting path list to the `project-standards` persona inside a `<standards-paths>` block in its review context (see Stage 4). The persona reads the files itself, targeting only the sections relevant to the changed file types. This keeps the orchestrator's work cheap (path discovery only) and avoids bloating the subagent prompt with content the reviewer may not fully need.

### Stage 4: Spawn sub-agents

#### Model tiering

Persona sub-agents do focused, scoped work and should use a fast mid-tier model to reduce cost and latency without sacrificing review quality. The orchestrator itself stays on the default (most capable) model.

Use the platform's mid-tier model for all persona and CE sub-agents. In Claude Code, pass `model: "sonnet"` in the Agent tool call. On other platforms, use the equivalent mid-tier. If the platform has no model override mechanism or the available model names are unknown, omit the model parameter and let agents inherit the default -- a working review on the parent model is better than a broken dispatch from an unrecognized model name.

CE always-on agents (agent-native-reviewer, learnings-researcher) and CE conditional agents (schema-drift-detector, deployment-verification-agent) also use the mid-tier model since they perform scoped, focused work.

The orchestrator (this skill) stays on the default model because it handles intent discovery, reviewer selection, finding merge/dedup, and synthesis -- tasks that benefit from stronger reasoning.

#### Run ID

Generate a unique run identifier before dispatching any agents. This ID scopes all agent artifact files and the post-review run artifact to the same directory.

```bash
RUN_ID=$(date +%Y%m%d-%H%M%S)-$(head -c4 /dev/urandom | od -An -tx1 | tr -d ' ')
mkdir -p ".spec-first/workflows/spec-review/$RUN_ID"
```

Pass `{run_id}` to every persona sub-agent so they can write their full analysis to `.spec-first/workflows/spec-review/{run_id}/{reviewer_name}.json`.

**Report-only mode:** Skip run-id generation and directory creation. Do not pass `{run_id}` to agents. Agents return compact JSON only with no file write, consistent with report-only's no-write contract.

**Permission mode:** Omit the `mode` parameter when dispatching sub-agents so the user's configured permission settings apply. Do not pass `mode: "auto"`.

Spawn each selected persona reviewer as a parallel sub-agent using the subagent template included below. Each persona sub-agent receives:

1. Their persona file content (identity, failure modes, calibration, suppress conditions)
2. Shared diff-scope rules from the diff-scope reference included below
3. The JSON output contract from the findings schema included below
4. PR metadata: title, body, and URL when reviewing a PR (empty string otherwise). Passed in a `<pr-context>` block so reviewers can verify code against stated intent
5. Review context: intent summary, file list, diff
6. Run ID and reviewer name for the artifact file path
7. **For `project-standards` only:** the standards file path list from Stage 3b, wrapped in a `<standards-paths>` block appended to the review context

Persona sub-agents are **read-only** with respect to project files: they review and return structured JSON. They do not edit project files or propose refactors. The one permitted write is saving their full analysis to the `.spec-first/workflows/` artifact path specified in the output contract.

Read-only here means **non-mutating**, not "no shell access." Reviewer sub-agents may use non-mutating inspection commands when needed to gather evidence or verify scope, including read-oriented `git` / `gh` usage such as `git diff`, `git show`, `git blame`, `git log`, and `gh pr view`. They must not edit files, change branches, commit, push, create PRs, or otherwise mutate the checkout or repository state.

Each persona sub-agent writes full JSON (all schema fields) to `.spec-first/workflows/spec-review/{run_id}/{reviewer_name}.json` and returns compact JSON with merge-tier fields only:

```json
{
  "reviewer": "security",
  "findings": [
    {
      "title": "User-supplied ID in account lookup without ownership check",
      "severity": "P0",
      "file": "orders_controller.rb",
      "line": 42,
      "confidence": 0.92,
      "autofix_class": "gated_auto",
      "owner": "downstream-resolver",
      "requires_verification": true,
      "pre_existing": false,
      "suggested_fix": "Add current_user.owns?(account) guard before lookup"
    }
  ],
  "residual_risks": [...],
  "testing_gaps": [...]
}
```

Detail-tier fields (`why_it_matters`, `evidence`) stay in the artifact file only. `suggested_fix` remains optional in both tiers. If the file write fails, the compact return still provides everything the merge needs.

**CE always-on agents** (agent-native-reviewer, learnings-researcher) are dispatched as standard Agent calls in parallel with the persona agents. Give them the same review context bundle the personas receive: entry mode, any PR metadata gathered in Stage 1, intent summary, review base branch name when known, `BASE:` marker, file list, diff, and `UNTRACKED:` scope notes. Do not invoke them with a generic "review this" prompt. Their output is unstructured and synthesized separately in Stage 6.

**CE conditional agents** (schema-drift-detector, deployment-verification-agent) are also dispatched as standard Agent calls when applicable. Pass the same review context bundle plus the applicability reason (for example, which migration files triggered the agent). For schema-drift-detector specifically, pass the resolved review base branch explicitly so it never assumes `main`. Their output is unstructured and must be preserved for Stage 6 synthesis just like the CE always-on agents.

### Stage 5: Merge findings

Convert multiple reviewer compact JSON returns into one deduplicated, confidence-gated finding set. The compact returns contain merge-tier fields (title, severity, file, line, confidence, autofix_class, owner, requires_verification, pre_existing) plus the optional `suggested_fix` and optional `dimension_tag`. Detail-tier fields (why_it_matters, evidence) are on disk in the per-agent artifact files and are not loaded at this stage.

1. **Validate.** Check each compact return for required top-level and per-finding fields, plus value constraints. Drop malformed returns or findings. Record the drop count.
   - **Top-level required:** reviewer (string), findings (array), residual_risks (array), testing_gaps (array). Drop the entire return if any are missing or wrong type.
   - **Per-finding required:** title, severity, file, line, confidence, autofix_class, owner, requires_verification, pre_existing
   - **Value constraints:**
     - severity: P0 | P1 | P2 | P3
     - autofix_class: safe_auto | gated_auto | manual | advisory
     - owner: review-fixer | downstream-resolver | human | release
     - confidence: numeric, 0.0-1.0
     - line: positive integer
     - pre_existing, requires_verification: boolean
     - dimension_tag: orthogonal_edits | over_engineering | assumption_leak | null/absent
   - Do not validate against the full schema here -- the full schema (including why_it_matters and evidence) applies to the artifact files on disk, not the compact returns.
2. **Confidence gate.** Suppress findings below 0.60 confidence. Exception: P0 findings at 0.50+ confidence survive the gate. Record the suppressed count. This matches the persona instructions and the schema's confidence thresholds.
3. **Deduplicate.** Compute fingerprint: `normalize(file) + line_bucket(line, +/-3) + normalize(title)`. When fingerprints match, merge: keep highest severity, keep highest confidence, note which reviewers flagged it, and retain a candidate `dimension_tag` when any reviewer marked the finding as change-discipline.
4. **Cross-reviewer agreement.** When 2+ independent reviewers flag the same issue (same fingerprint), boost the merged confidence by 0.10 (capped at 1.0). Cross-reviewer agreement is strong signal -- independent reviewers converging on the same issue is more reliable than any single reviewer's confidence. Note the agreement in the Reviewer column of the output (e.g., "security, correctness").
5. **Separate pre-existing.** Pull out findings with `pre_existing: true` into a separate list.
6. **Resolve disagreements.** When reviewers flag the same code region but disagree on severity, autofix_class, owner, or `dimension_tag`, annotate the Reviewer column with the disagreement (e.g., "security (P0), correctness (P1) -- kept P0" or "maintainability (`over_engineering`), correctness (`assumption_leak`) -- kept `over_engineering`"). This transparency helps the user understand why a finding was routed the way it was.
7. **Normalize routing and dimension.** For each merged finding, set the final `autofix_class`, `owner`, `requires_verification`, and `dimension_tag`. If reviewers disagree on routing, keep the most conservative route. If reviewers disagree on `dimension_tag`, keep the highest-confidence non-null tag as the primary label and preserve the disagreement note in the Reviewer column. A change-discipline finding must stay identifiable as change-discipline rather than being rewritten into generic maintainability wording.
8. **Partition the work.** Build three sets:
   - in-skill fixer queue: only `safe_auto -> review-fixer`
   - residual actionable queue: unresolved `gated_auto` or `manual` findings whose owner is `downstream-resolver`
   - report-only queue: `advisory` findings plus anything owned by `human` or `release`
9. **Sort.** Order by severity (P0 first) -> confidence (descending) -> file path -> line number.
10. **Collect coverage data.** Union residual_risks and testing_gaps across reviewers.
11. **Preserve CE agent artifacts.** Keep the learnings, agent-native, schema-drift, and deployment-verification outputs alongside the merged finding set. Do not drop unstructured agent output just because it does not match the persona JSON schema.

### Stage 6: Synthesize and present

Assemble the final report using the review output template included below:

1. **Header.** Scope, intent, mode, reviewer team with per-conditional justifications.
2. **Findings.** Grouped by severity (P0, P1, P2, P3) and rendered as pipe-delimited markdown tables. Each finding shows file, issue, reviewer(s), confidence, and synthesized route. When a finding carries `dimension_tag`, keep it visible by prefixing the Issue cell with `[change-discipline:<dimension_tag>] ` rather than folding it into generic maintainability wording.
3. **Requirements Completeness.** Include only when a plan was found in Stage 2b. For each requirement (R1, R2, etc.) and implementation unit in the plan, report whether corresponding work appears in the diff. Use a simple checklist: met / not addressed / partially addressed. Routing depends on `plan_source`:
   - **`explicit`** (caller-provided or PR body): Flag unaddressed requirements as P1 findings with `autofix_class: manual`, `owner: downstream-resolver`. These enter the residual actionable queue and can become todos.
   - **`inferred`** (auto-discovered): Flag unaddressed requirements as P3 findings with `autofix_class: advisory`, `owner: human`. These stay in the report only — no todos, no autonomous follow-up. An inferred plan match is a hint, not a contract.
   Omit this section entirely when no plan was found — do not mention the absence of a plan.
4. **Three-Axis Verdict.** Render this immediately after Requirements Completeness and before Applied Fixes. This is a compact aggregation layer, not a second verdict engine. Use exactly these axes:
   - `Requirement Completion`
   - `Plan-Diff Fidelity`
   - `Code Intrinsic Quality`
   Axis rules:
   - **`explicit` plan source:** all three axes may be shown and may inform the final verdict.
   - **`inferred` plan source:** show all three axes only when the inferred mapping is strong enough to say something useful, but keep `Requirement Completion` and `Plan-Diff Fidelity` advisory in wording. They must not block on their own.
   - **`missing` plan source:** show only `Code Intrinsic Quality`. Omit `Requirement Completion` and `Plan-Diff Fidelity` entirely. Do not emit placeholder `N/A` rows or prose just to keep the shape symmetric.
   - `Plan-Diff Fidelity` may only use the diff, the resolved plan source, and explicitly available plan content. Never fabricate fidelity from branch names or vague user intent.
   - `Code Intrinsic Quality` summarizes code-level quality independent of plan availability. It may still be negative even when no plan exists.
   Keep the axis language concise: status + one-line reasoning per axis.
5. **Applied Fixes.** Include only if a fix phase ran in this invocation.
6. **Residual Actionable Work.** Include when unresolved actionable findings were handed off or should be handed off.
7. **Pre-existing.** Separate section, does not count toward verdict.
8. **Learnings & Past Solutions.** Surface learnings-researcher results: if past solutions are relevant, flag them as "Known Pattern" with links to docs/solutions/ files.
9. **Agent-Native Gaps.** Surface agent-native-reviewer results. Omit section if no gaps found.
10. **Schema Drift Check.** If schema-drift-detector ran, summarize whether drift was found. If drift exists, list the unrelated schema objects and the required cleanup command. If clean, say so briefly.
11. **Deployment Notes.** If deployment-verification-agent ran, surface the key Go/No-Go items: blocking pre-deploy checks, the most important verification queries, rollback caveats, and monitoring focus areas. Keep the checklist actionable rather than dropping it into Coverage.
12. **Coverage.** Suppressed count, residual risks, testing gaps, failed/timed-out reviewers, and any intent uncertainty carried by non-interactive modes.
13. **Verdict.** Ready to merge / Ready with fixes / Not ready. Fix order if applicable. When an `explicit` plan has unaddressed requirements, the verdict must reflect it — a PR that's code-clean but missing planned requirements is "Not ready" unless the omission is intentional. When an `inferred` plan has unaddressed requirements, note it in the verdict reasoning but do not block on it alone. The three-axis view should sharpen this reasoning, not replace it.

Do not include time estimates.

**Format verification:** Before delivering the report, verify the findings sections use pipe-delimited table rows (`| # | File | Issue | ... |`) rather than prose blocks or per-finding separators.

## Quality Gates

Before delivering the review, verify:

1. **Every finding is actionable.** Re-read each finding. If it says "consider", "might want to", or "could be improved" without a concrete fix, rewrite it with a specific action. Vague findings waste engineering time.
2. **No false positives from skimming.** For each finding, verify the surrounding code was actually read. Check that the "bug" isn't handled elsewhere in the same function, that the "unused import" isn't used in a type annotation, that the "missing null check" isn't guarded by the caller.
3. **Severity is calibrated.** A style nit is never P0. A SQL injection is never P3. Re-check every severity assignment.
4. **Line numbers are accurate.** Verify each cited line number against the file content. A finding pointing to the wrong line is worse than no finding.
5. **Protected artifacts are respected.** Discard any findings that recommend deleting or gitignoring files in `docs/brainstorms/`, `docs/plans/`, or `docs/solutions/`.
6. **Findings don't duplicate linter output.** Don't flag things the project's linter/formatter would catch (missing semicolons, wrong indentation). Focus on semantic issues.

## Language-Aware Conditionals

This skill uses stack-specific reviewer agents when the diff clearly warrants them. Keep those agents opinionated. They are not generic language checkers; they add a distinct review lens on top of the always-on and cross-cutting personas.

Do not spawn them mechanically from file extensions alone. The trigger is meaningful changed behavior, architecture, or UI state in that stack.

## After Review

### Mode-Driven Post-Review Flow

After presenting findings and verdict (Stage 6), route the next steps by mode. Review and synthesis stay the same in every mode; only mutation and handoff behavior changes.

#### Step 1: Build the action sets

- **Clean review** means zero findings after suppression and pre-existing separation. Skip the fix/handoff phase when the review is clean.
- **Fixer queue:** final findings routed to `safe_auto -> review-fixer`.
- **Residual actionable queue:** unresolved `gated_auto` or `manual` findings whose final owner is `downstream-resolver`.
- **Report-only queue:** `advisory` findings and any outputs owned by `human` or `release`.
- **Never convert advisory-only outputs into fix work or todos.** Deployment notes, residual risks, and release-owned items stay in the report.

#### Step 2: Choose policy by mode

**Interactive mode**

- Apply `safe_auto -> review-fixer` findings automatically without asking. These are safe by definition.
- Ask a policy question **using the platform's blocking question tool** (`AskUserQuestion` in Claude Code, `request_user_input` in Codex, `ask_user` in Gemini) only when `gated_auto` or `manual` findings remain after safe fixes. Do not replace with a conversational open-ended question. Adapt the options to match what actually remains:

  **When `gated_auto` findings are present** (with or without `manual`):
  ```
  Safe fixes have been applied. What should I do with the remaining findings?
  1. Review and approve specific gated fixes (Recommended)
  2. Leave as residual work
  3. Report only -- no further action
  ```

  **When only `manual` findings remain** (no `gated_auto`):
  ```
  Safe fixes have been applied. The remaining findings need manual resolution. What should I do?
  1. Leave as residual work (Recommended)
  2. Report only -- no further action
  ```

  If no blocking question tool is available, present the applicable numbered options as text and wait for the user's selection before proceeding.
- If no `gated_auto` or `manual` findings remain after safe fixes, skip the policy question entirely — report what was fixed and proceed to next steps.
- Only include `gated_auto` findings in the fixer queue after the user explicitly approves the specific items. Do not widen the queue based on severity alone.

**Autofix mode**

- Ask no questions.
- Apply only the `safe_auto -> review-fixer` queue.
- Leave `gated_auto`, `manual`, `human`, and `release` items unresolved.
- Prepare residual work only for unresolved actionable findings whose final owner is `downstream-resolver`.

**Report-only mode**

- Ask no questions.
- Do not build a fixer queue.
- Do not create residual todos or `.context` artifacts.
- Stop after Stage 6. Everything remains in the report.

#### Step 3: Apply fixes with one fixer and bounded rounds

- Spawn exactly one fixer subagent for the current fixer queue in the current checkout. That fixer applies all approved changes and runs the relevant targeted tests in one pass against a consistent tree.
- Do not fan out multiple fixers against the same checkout. Parallel fixers require isolated worktrees/branches and deliberate mergeback.
- Re-review only the changed scope after fixes land.
- Bound the loop with `max_rounds: 2`. If issues remain after the second round, stop and hand them off as residual work or report them as unresolved.
- If any applied finding has `requires_verification: true`, the round is incomplete until the targeted verification runs.
- Do not start a mutating review round concurrently with browser testing on the same checkout. Future orchestrators that want both must either run `mode:report-only` during the parallel phase or isolate the mutating review in its own checkout/worktree.

#### Step 4: Emit artifacts and downstream handoff

- In interactive and autofix modes, write a per-run artifact under `.spec-first/workflows/spec-review/<run-id>/` containing:
  - synthesized findings
  - applied fixes
  - residual actionable work
  - advisory-only outputs
- In autofix mode, create durable todo files only for unresolved actionable findings whose final owner is `downstream-resolver`. Load the `todo-create` skill for the canonical directory path, naming convention, YAML frontmatter structure, and template. Each todo should map the finding's severity to the todo priority (`P0`/`P1` -> `p1`, `P2` -> `p2`, `P3` -> `p3`) and set `status: ready` since these findings have already been triaged by synthesis.
- Do not create todos for `advisory` findings, `owner: human`, `owner: release`, or protected-artifact cleanup suggestions.
- If only advisory outputs remain, create no todos.
- Interactive mode may offer to externalize residual actionable work after fixes, but it is not required to finish the review.

#### Step 5: Final next steps

**Interactive mode only:** after the fix-review cycle completes (clean verdict or the user chose to stop), offer next steps based on the entry mode. Reuse the resolved review base/default branch from Stage 1 when known; do not hard-code only `main`/`master`.

- **PR mode (entered via PR number/URL):**
  - **Push fixes** -- push commits to the existing PR branch
  - **Exit** -- done for now
- **Branch mode (feature branch with no PR, and not the resolved review base/default branch):**
  - **Create a PR (Recommended)** -- push and open a pull request
  - **Continue without PR** -- stay on the branch
  - **Exit** -- done for now
- **On the resolved review base/default branch:**
  - **Continue** -- proceed with next steps
  - **Exit** -- done for now

If "Create a PR": first publish the branch with `git push --set-upstream origin HEAD`, then use `gh pr create` with a title and summary derived from the branch changes.
If "Push fixes": push the branch with `git push` to update the existing PR.

**Autofix and report-only modes:** stop after the report, artifact emission, and residual-work handoff. Do not commit, push, or create a PR.

## Fallback

If the platform doesn't support parallel sub-agents, run reviewers sequentially. Everything else (stages, output format, merge pipeline) stays the same.

---

## Included References

### Persona Catalog

@./references/persona-catalog.md

### Subagent Template

@./references/subagent-template.md

### Diff Scope Rules

@./references/diff-scope.md

### Findings Schema

@./references/findings-schema.json

### Review Output Template

@./references/review-output-template.md
