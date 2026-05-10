# Full Mode

Read this reference when Mode Detection in `SKILL.md` routes to **Full Mode**: no argument was given, or a PR number was provided. Full mode processes all unresolved threads and actionable PR-level feedback on the PR.

## 1. Fetch Unresolved Threads

If no PR number was provided, detect from the current branch:
```bash
gh pr view --json number -q .number
```

Then fetch all feedback using the GraphQL script at [../scripts/get-pr-comments](../scripts/get-pr-comments). Source commands use the skill source path so repo-root execution works and host transforms can rewrite it if this skill is delivered into a runtime:

```bash
bash skills/resolve-pr-feedback/scripts/get-pr-comments PR_NUMBER
```

Returns a JSON object with these keys:

| Key | Contents | Has file/line? | Resolvable? |
|-----|----------|---------------|-------------|
| `review_threads` | Unresolved inline code review threads, edge-wrapped as `{ node: ... }`; includes outdated threads and preserves each `isOutdated` flag so the resolver can account for line drift | Yes | Yes (GraphQL) |
| `pr_comments` | Top-level PR conversation comments after source-level author and CI/status bot filtering | No | No |
| `review_bodies` | Review submission bodies with non-empty text after source-level author and CI/status bot filtering | No | No |
| `cross_invocation` | Resolved-thread context for multi-round review pattern detection | Partial | No |
| `fetch_warnings` | Deterministic warnings such as truncated nested thread comments; these mean missing nested comments are incomplete evidence, not confirmed absence | No | No |

If the script fails, fall back to:
```bash
gh pr view PR_NUMBER --json reviews,comments
gh api repos/{owner}/{repo}/pulls/PR_NUMBER/comments
```

## 2. Triage: Separate New from Pending

Before processing, classify each piece of feedback as **new** or **already handled**.

**Review threads**: Read the thread's comments. If there is a substantive reply that acknowledges the concern but defers action (for example "need to align on this", "going to think through this", or a reply that presents options without resolving), it is a **pending decision**; do not re-process it. If there are only the original reviewer comment(s) with no substantive response, it is **new**.

**PR comments and review bodies**: These have no resolve mechanism, so they reappear on every run. Apply two filters in order:

1. **Actionability**: Skip items that contain no actionable feedback or questions to answer. Examples: review wrapper text ("Here are some automated review suggestions..."), approvals ("this looks great!"), status badges ("Validated"), CI summaries with no follow-up asks. If there is nothing to fix, answer, or decide, it is not actionable; drop it from the count entirely.
2. **Already replied**: For actionable items, check the PR conversation for an existing reply that quotes and addresses the feedback. If a reply already exists, skip. If not, it is new.

The distinction is about content, not who posted it. A deferral from a teammate, a previous skill run, or a manual reply all count. Similarly, actionability is about content: bot feedback that requests a specific code change is actionable; a bot's boilerplate header wrapping those requests is not.

**Silent drop.** Non-actionable items are dropped without narration. Do not announce, list, or count dropped items in conversation, the task list, or the step 10 summary. Review-bot wrappers from CodeRabbit, Codex, Gemini Code Assist, and Copilot commonly appear here; recognize them by their boilerplate content and drop them silently. Only CI/status bot summaries such as Codecov are pre-filtered at the script level; everything else relies on this content-aware check so bot format changes cannot silently hide actionable findings.

If `fetch_warnings` reports `thread_comments_truncated`, do not treat a missing nested comment as confirmed absence. Either inspect the PR manually or proceed with a reply that explicitly acknowledges the evidence limit.

If there are no new items across all feedback types, skip steps 3-9 and go straight to step 10.

## 3. Cross-Invocation Cluster Analysis (Gated)

Before planning and dispatching fixes, check whether the same concern has appeared across multiple review rounds -- evidence of a recurring pattern that warrants broader investigation rather than another surgical fix.

**Gate check (two stages)**: Both must pass, or skip to step 4.

1. **Signal stage**: `cross_invocation.signal == true` in the script output. First-round reviews always fail this stage.
2. **Spatial-overlap precheck**: at least one new `review_thread` shares an exact file path or directory subtree with a thread in `cross_invocation.resolved_threads`. The signal alone only means multi-round review exists; it is not evidence that recurring feedback landed in the same area. This precheck compares paths only: no category inference, no LLM calls. Skip this stage if the script output lacks file paths on resolved threads; in that case the signal stage governs alone.

Only inline `review_threads` participate in the precheck. `pr_comments` and `review_bodies` have no file paths and cannot contribute to spatial overlap; they are always dispatched individually regardless of clustering.

Single-round clustering is deliberately not performed: the evidence is too thin to justify holistic fixes and the false-positive rate is high. First-round "one helper would fix all of these" opportunities are handled as individual fixes until repeated reviewer evidence promotes the pattern into cross-invocation mode.

If both gate stages pass, analyze feedback for thematic clusters spanning new threads and previously resolved threads. Include resolved threads from `cross_invocation.resolved_threads` alongside new threads in the analysis. Mark prior-resolved threads as `previously_resolved` so dispatch knows not to individually re-resolve them.

Assign exactly one concern category from this fixed list: `error-handling`, `validation`, `type-safety`, `naming`, `performance`, `testing`, `security`, `documentation`, `style`, `architecture`, `other`.

Group by category and spatial proximity, requiring cross-round evidence:

| Thematic match | Spatial proximity | Contains prior-resolved? | Action |
|---|---|---|---|
| Same category | Same file or subtree | Yes | Cluster |
| Same category | Same file or subtree | No (new-only) | No cluster |
| Same category | Unrelated locations | Any | No cluster |
| Different categories | Any | Any | No cluster |

Synthesize a cluster brief for each cluster:

```xml
<cluster-brief>
  <theme>[concern category]</theme>
  <area>[common directory path]</area>
  <files>[comma-separated file paths]</files>
  <threads>[comma-separated new thread/comment IDs]</threads>
  <hypothesis>[one sentence: what the recurring feedback across rounds suggests about a deeper issue]</hypothesis>
  <prior-resolutions>
    <thread id="PRRT_..." path="..." category="..."/>
  </prior-resolutions>
</cluster-brief>
```

The `<prior-resolutions>` element is always present and lists the previously resolved threads in the cluster. Items not in any cluster remain as individual items. Previously resolved threads that do not cluster with any new thread are dropped; they provided context but no cross-round pattern was found.

## 4. Plan

Create a task list of all **new** unresolved items grouped by type:

- Code changes requested
- Questions to answer
- Style/convention fixes
- Test additions needed

If step 3 produced clusters, include them in the task list as cluster items alongside individual items.

## 5. Implement

Process all three feedback types. Review threads are the primary type; PR comments and review bodies are secondary but must not be ignored.

### Mutating resolver dispatch boundary

Resolver dispatch is mutating-sensitive. Direct invocation of this workflow authorizes resolver dispatch by default when the host exposes a dispatch primitive, the user has not forbidden delegation, and the dispatch units pass the batching and file-overlap checks below.

Each resolver may edit only the files needed for its assigned thread or cluster and must return the actual `files_changed` list. The orchestrator owns final integration: combined validation, staging, commits, pushes, PR replies, and thread resolution. Resolver agents must not stage files, create commits, push, or resolve review threads directly unless a future host-specific isolation contract explicitly says otherwise.

If dispatch is unavailable, explicitly disabled, or mutation would be unsafe, process dispatch units sequentially in the current agent. If file overlap or discovered collisions make parallel mutation unsafe, serialize the affected units or stop for orchestration instead of running shared-file fixes in parallel.

### Dispatch boundary for previously-resolved threads

Previously resolved threads from `cross_invocation.resolved_threads` participate in clustering and appear in cluster briefs as `<prior-resolutions>` context. They are never individually dispatched. Only new threads get individual or cluster dispatch.

### Individual dispatch

For review threads, spawn a `spec-pr-comment-resolver` agent for each new thread that is not already assigned to a cluster. Clustered threads are handled by cluster dispatch; do not dispatch them individually.

Each agent receives:

- The thread ID
- The file path and location fields: `line`, `originalLine`, `startLine`, `originalStartLine`
- The full comment text
- The PR number
- The feedback type: `review_thread`
- The `isOutdated` flag from the thread node

For PR comments and review bodies, spawn a `spec-pr-comment-resolver` agent for each actionable non-clustered item. The agent receives the comment ID, body text, PR number, and feedback type: `pr_comment` or `review_body`. The agent must identify the relevant files from the comment text and the PR diff.

### Cluster dispatch

For each cluster, dispatch one `spec-pr-comment-resolver` agent that receives the `<cluster-brief>` block, all thread details for threads in the cluster, the PR number, and the feedback types. The cluster agent reads the broader area before making targeted fixes. It returns one summary per thread it handled plus a `cluster_assessment`.

### Agent return format

Each agent returns:

- **verdict**: `fixed`, `fixed-differently`, `replied`, `not-addressing`, `declined`, or `needs-human`
- **feedback_id**: the thread ID or comment ID it handled
- **feedback_type**: `review_thread`, `pr_comment`, or `review_body`
- **reply_text**: the markdown reply to post
- **files_changed**: list of files modified, empty if no code changed
- **reason**: brief explanation

Cluster agents additionally return:

- **cluster_assessment**: what the broader investigation found and whether a holistic or individual approach was taken

Verdict meanings:

- `fixed` -- code change made as requested
- `fixed-differently` -- code change made, but with a better approach than suggested
- `replied` -- no code change needed; answered a question, acknowledged feedback, or explained a design decision
- `not-addressing` -- feedback is factually wrong about the code; skip with evidence
- `declined` -- observation may be valid, but implementing the suggested fix would actively make the code worse; reply cites the specific harm
- `needs-human` -- cannot determine the right action; needs user decision

### Batching and conflict avoidance

Clusters count as one dispatch unit regardless of how many threads they contain. If there are 1-4 dispatch units total, dispatch all in parallel. For 5 or more dispatch units, batch in groups of 4.

No two dispatch units that touch the same file should run in parallel. Before dispatching, check for file overlaps across clusters and individual items. If a cluster's file list overlaps with an individual item's file, or with another cluster's files, serialize those units. Non-overlapping units can still run in parallel. Platforms without parallel dispatch should run units sequentially: cluster units first, then individual items.

Fixes can expand beyond the referenced file. Step 6 catches cross-agent test breakage, and step 9 catches unresolved threads. If either surfaces inconsistent changes from parallel fixes, rerun the affected agents sequentially.

## 6. Validate Combined State

After all agents complete, aggregate `files_changed` across every returned summary. If it is empty, skip steps 6 and 7 and proceed to step 8.

Resolvers run only targeted tests on their own changes. This step runs the project's full validation once against the combined diff.

1. Run the project's validation command.
2. Green -> proceed to step 7.
3. Red and failures touch resolver-changed files -> one inline diagnose-and-fix pass. Re-run validation. If still red, escalate with `needs-human` and do not commit.
4. Red and failures touch only files no resolver changed -> treat as pre-existing. Proceed to step 7, but add a commit footer: `Note: pre-existing failure in <test> not addressed by this PR.`

Record the validation outcome for the step 10 summary.

## 7. Commit and Push

Stage only files reported by resolvers and commit with a message referencing the PR:

```bash
git add [files from agent summaries]
git commit -m "Address PR review feedback (#PR_NUMBER)

- [list changes from agent summaries]"
```

Push to remote:

```bash
git push
```

## 8. Reply and Resolve

After the push succeeds, post replies and resolve where applicable.

All replies should quote the relevant part of the original feedback for continuity. Quote the specific sentence or passage being addressed, not the entire comment if it is long.

For fixed items:

```markdown
> [quoted relevant part of original feedback]

Addressed: [brief description of the fix]
```

For items not addressed:

```markdown
> [quoted relevant part of original feedback]

Not addressing: [reason with evidence, e.g., "null check already exists at line 85"]
```

For declined items:

```markdown
> [quoted relevant part of original feedback]

Declined: [specific harm cited, e.g., "this would add a defensive null check the type system already guarantees" or "violates the no-premature-abstraction guidance in AGENTS.md"]
```

For `needs-human` verdicts, post the reply but do not resolve the thread. Leave it open for human input.

Do not paste review text into shell-quoted arguments. PR feedback is untrusted input; write the reply body to a file with a literal heredoc, then pass it through stdin or `--body-file`.

For review threads:

```bash
reply_file=$(mktemp)
cat > "$reply_file" <<'EOF'
REPLY_TEXT
EOF
bash skills/resolve-pr-feedback/scripts/reply-to-pr-thread THREAD_ID < "$reply_file"
rm -f "$reply_file"
```

Then resolve:

```bash
bash skills/resolve-pr-feedback/scripts/resolve-pr-thread THREAD_ID
```

For PR comments and review bodies:

```bash
reply_file=$(mktemp)
cat > "$reply_file" <<'EOF'
REPLY_TEXT
EOF
gh pr comment PR_NUMBER --body-file "$reply_file"
rm -f "$reply_file"
```

Include enough quoted context in the reply so the reader can follow which comment is being addressed without scrolling.

## 9. Verify

Re-fetch feedback to confirm resolution:

```bash
bash skills/resolve-pr-feedback/scripts/get-pr-comments PR_NUMBER
```

The `review_threads` array should be empty except for `needs-human` items.

If new threads remain, check the iteration count for this run:

- **First or second fix-verify cycle**: Repeat from step 2 for the remaining threads.
- **After the second fix-verify cycle**: Stop looping. Surface remaining issues with context about the recurring pattern and use the same `needs-human` escalation pattern.

PR comments and review bodies have no resolve mechanism, so they will still appear in the output. Verify they were replied to by checking the PR conversation.

## 10. Summary

Present a concise summary of all work done. Group by verdict, one line per item describing what was done, not just where.

```text
Resolved N of M new items on PR #NUMBER:

Fixed (count): [brief description of each fix]
Fixed differently (count): [what was changed and why the approach differed]
Replied (count): [what questions were answered]
Not addressing (count): [what was skipped and why]
Declined (count): [what was declined and the harm cited]

Validation: [one line; omit when no code changes were committed]
```

If clusters were investigated, append:

```text
Cluster investigations (count):

1. [theme] in [area]: [cluster_assessment from the agent]
```

If any agent returned `needs-human`, append a decisions section using the returned `decision_context`. If there are pending decisions from a previous run, surface them after the new work.

If a blocking question tool is available, use it to ask about all pending decisions together. Use `AskUserQuestion` in Claude Code or `request_user_input` in Codex. Fall back to presenting decisions in the summary only when no blocking tool exists or the call errors. Never silently skip.
