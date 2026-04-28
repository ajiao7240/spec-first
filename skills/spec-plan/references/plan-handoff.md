# Plan Handoff

This file contains post-plan-writing instructions: document review, post-generation options, and issue creation. Load it after the plan file has been written and the confidence-first check (5.3.1-5.3.7) is complete.

## 5.3.8 Document Review

After the confidence-first check (and any deepening), execute the `spec-doc-review` workflow on the plan file. Pass the plan path as the argument. Do not dispatch `spec-doc-review` as an Agent/Task/subagent type; it is a workflow entrypoint whose Phase 2 dispatches reviewer agents internally. When this step is reached, it is mandatory — do not skip it because the confidence-first check already ran. The two tools catch different classes of issues.

The confidence-first check and spec-doc-review are complementary:
- The confidence-first check strengthens rationale, sequencing, risk treatment, and grounding
- Document-review checks coherence, feasibility, scope alignment, and surfaces role-specific issues

If spec-doc-review returns findings that were auto-applied, note them briefly when presenting handoff options. If residual P0/P1 findings were surfaced, mention them so the user can decide whether to address them before proceeding.

When spec-doc-review returns "Review complete", proceed to Final Checks.

**Pipeline mode:** If invoked from an automated workflow such as LFG, SLFG, or any `disable-model-invocation` context, execute `spec-doc-review` with `mode:headless` and the plan path. Headless mode applies auto-fixes silently and returns structured findings without interactive prompts. Address any P0/P1 findings before returning control to the caller.

## 5.3.9 Final Checks and Cleanup

Before proceeding to post-generation options:
- Confirm the plan is stronger in specific ways, not merely longer
- Confirm the planning boundary is intact
- Confirm origin decisions were preserved when an origin document exists

If artifact-backed mode was used:
- Clean up the temporary scratch directory after the plan is safely updated
- If cleanup is not practical on the current platform, note where the artifacts were left

## 5.4 Post-Generation Options

**Pipeline mode:** If invoked from an automated workflow such as LFG, SLFG, or any `disable-model-invocation` context, skip the interactive menu below and return control to the caller immediately. The plan file has already been written, the confidence-first check has already run, and spec-doc-review has already run — the caller (e.g., lfg, slfg) determines the next step.

After spec-doc-review completes, present the options using the platform's blocking question tool: `AskUserQuestion` in Claude Code (call `ToolSearch` with `select:AskUserQuestion` first if its schema isn't loaded) or `request_user_input` in Codex. Fall back to numbered options in chat only when no blocking tool exists in the harness or the call errors (e.g., Codex edit modes) — not because a schema load is required. Never silently skip the question.

**Question:** "Plan ready at `docs/plans/YYYY-MM-DD-NNN-<type>-<name>-plan.md`. What would you like to do next?"

**Options:**
1. **Start work** (recommended) - Begin implementing this plan in the current session using the current host's work entrypoint (`/spec:work` on Claude Code, `$spec-work` on Codex)
2. **Compile task pack with `spec-write-tasks`** - Use the standalone skill when the plan is large, dependency-heavy, or would benefit from a derived `docs/tasks/*-tasks.md` execution input
3. **Create Issue** - Create a tracked issue from this plan in your configured issue tracker (GitHub or Linear)
4. **Open in Proof (web app) — review and comment to iterate with the agent** - Open the doc in Every's Proof editor, iterate with the agent via comments, or copy a link to share with others
5. **Done for now** - Pause; the plan file is saved and can be resumed later

**Surface additional document review contextually, not as a menu fixture:** When the prior spec-doc-review pass surfaced residual P0/P1 findings that the user has not addressed, mention them adjacent to the menu and offer another review pass in prose (e.g., "Document review flagged 2 P1 findings you may want to address — want me to run another pass before you pick?"). Do not add it to the option list.

Based on selection:
- **Start work** -> Call the current host's work entrypoint with the plan path: `/spec:work <plan-path>` on Claude Code or `$spec-work <plan-path>` on Codex
- **Compile task pack with `spec-write-tasks`** -> Load the standalone `spec-write-tasks` skill with the plan path. Do not invoke `/spec:write-tasks` or `$spec-write-tasks`; this is a standalone skill, not a command-backed workflow. If it writes an executable task pack with matching `spec_id` and verifiable `source_plan_hash`, offer to proceed with the current host's work entrypoint: `/spec:work <task-pack-path>` on Claude Code or `$spec-work <task-pack-path>` on Codex. If it returns `skip`, `return-to-plan`, `draft-only`, unverifiable identity/hash, or a non-executable task pack, do not offer task-pack execution; follow the returned recommendation instead.
- **Create Issue** -> Follow the Issue Creation section below
- **Open in Proof (web app) — review and comment to iterate with the agent** -> Load the `proof` skill in HITL-review mode with:
  - source file: `docs/plans/<plan_filename>.md`
  - doc title: `Plan: <plan title from frontmatter>`
  - identity: `ai:spec-first` / `Spec-First`
  - recommended next step: current host's work entrypoint (`/spec:work` on Claude Code, `$spec-work` on Codex; shown in the proof skill's final terminal output)

  Follow `references/hitl-review.md` in the proof skill. It uploads the plan, prompts the user for review in Proof's web UI, ingests each thread by reading it fresh and replying in-thread, applies agreed edits as tracked suggestions, and syncs the final markdown back to the plan file atomically on proceed.

  When the proof skill returns:
  - `status: proceeded` with `localSynced: true` -> the plan on disk now reflects the review. Re-execute the `spec-doc-review` workflow on the updated plan before re-rendering the menu — HITL can materially rewrite the plan body, so the prior spec-doc-review pass no longer covers the current file and section 5.3.8 requires a review before any handoff option is offered. Then return to the post-generation options with the refreshed residual findings.
  - `status: proceeded` with `localSynced: false` -> the reviewed version lives in Proof at `docUrl` but the local copy is stale. Offer to pull the Proof doc to `localPath` using the proof skill's Pull workflow. If the pull happened, re-execute the `spec-doc-review` workflow on the pulled file before re-rendering the options (same 5.3.8 rationale — the local plan was materially updated by the pull). If the pull was declined, include a one-line note above the menu that `<localPath>` is stale vs. Proof — otherwise `Start /spec:work`, `Compile task pack`, or `Create Issue` will silently use the pre-review copy.
  - `status: done_for_now` -> the plan on disk may be stale if the user edited in Proof before leaving. Offer to pull the Proof doc to `localPath` so the local plan file stays in sync. If the pull happened, re-execute the `spec-doc-review` workflow on the pulled file before re-rendering the options (same 5.3.8 rationale). If the pull was declined, include the stale-local note above the menu. `done_for_now` means the user stopped the HITL loop — it does not mean they ended the whole plan session; they may still want to start work or create an issue.
  - `status: aborted` -> fall back to the options without changes.

  If the initial upload fails (network error, Proof API down), retry once after a short wait. If it still fails, tell the user the upload didn't succeed and briefly explain why, then return to the options — don't leave them wondering why the option did nothing.
- **Done for now** -> Display a brief confirmation that the plan file is saved and end the turn
- **If the user asks for another document review** (either from the contextual prompt when P0/P1 findings remain, or by free-form request) -> Execute the `spec-doc-review` workflow with the plan path for another pass, then return to the options
- **Other** -> Accept free text for revisions and loop back to options

## Issue Creation

When the user selects "Create Issue", detect their project tracker:

1. Read `AGENTS.md` (or `CLAUDE.md` for compatibility) at the repo root and look for `project_tracker: github` or `project_tracker: linear`.
2. If `project_tracker: github`:

   ```bash
   gh issue create --title "<type>: <title>" --body-file <plan_path>
   ```

3. If `project_tracker: linear`:

   ```bash
   linear issue create --title "<title>" --description "$(cat <plan_path>)"
   ```

4. If no tracker is configured, ask the user which tracker they use with the platform's blocking question tool: `AskUserQuestion` in Claude Code (call `ToolSearch` with `select:AskUserQuestion` first if its schema isn't loaded) or `request_user_input` in Codex. Fall back to asking in chat only when no blocking tool exists or the call errors (e.g., Codex edit modes) — not because a schema load is required. Never silently skip. Options: `GitHub`, `Linear`, `Skip`. Then:
   - Proceed with the chosen tracker's command above
   - Offer to persist the choice by adding `project_tracker: <value>` to `AGENTS.md`, where `<value>` is the lowercase tracker key (`github` or `linear`) — not the display label — so future runs match the detector in step 1 and skip this prompt
   - If `Skip`, return to the options without creating an issue

5. If the detected tracker's CLI is not installed or not authenticated, surface a clear error (e.g., "`gh` CLI not found — install it or create the issue manually") and return to the options.

After issue creation:
- Display the issue URL
- Ask whether to proceed to the current host's work entrypoint (`/spec:work` on Claude Code, `$spec-work` on Codex) using the platform's blocking question tool
