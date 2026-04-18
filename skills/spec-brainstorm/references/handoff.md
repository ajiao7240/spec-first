# Handoff

This content is loaded when Phase 4 begins — after the requirements document is written and reviewed.

---

#### 4.0 Terminal State Lock

This workflow does **not** hand off to arbitrary next steps.

Before offering or executing any option, classify the requested next action:

**Denylist — blocked unless the escape hatch is used**
- Any skill or workflow whose normal effect is to modify source code
- Any skill or workflow whose normal effect is to change the host runtime or environment
- Examples: implementation skills, package-install flows, git-writing flows, environment or MCP mutation flows

**Allowlist-Workflow — normal brainstorm exits**
- `/spec:plan`
- `/spec:work` only when the direct-to-work gate is satisfied
- `document-review`
- `/spec:brainstorm`
- `/spec:review` only when a PR already exists and the user is explicitly routing there

**Allowlist-SideEffect — allowed non-implementation side effects**
- `Share to Proof`
- Read-only export or sharing actions that do not mutate code or host runtime

This is an intentional divergence from the single-exit superpowers model. Brainstorm may end in planning, eligible direct-to-work, additional review, continued brainstorming, or lightweight sharing — but it does not jump straight into arbitrary implementation or environment-changing skills.

**Unlisted requests**
- If the request clearly maps to one of the allowlisted categories above, explain the mapping and use the canonical option
- If the request falls into the denylist, refuse it and keep the user in the brainstorm handoff menu
- If the user explicitly insists on a denylisted path, use the escape hatch only after a second explicit confirmation that they are deliberately diverging from the brainstorm terminal state
- Record escape-hatch use as a Key Decision for the current run when a requirements document exists
- `skip future gates` never applies to the escape hatch

#### 4.0a Escape Hatch Confirmation

Use escape hatch wording like:

> "That next step falls outside the normal brainstorm exits because it would modify code or the host environment. If you want to deliberately diverge anyway, confirm explicitly and I will record that choice before handing off."

#### 4.1 Present Next-Step Options

Present next steps using the platform's blocking question tool when available (see Interaction Rules in the main skill). Otherwise present numbered options in chat and end the turn.

If `Resolve Before Planning` contains any items:
- Ask the blocking questions now, one at a time, by default
- If the user explicitly wants to proceed anyway, first convert each remaining item into an explicit decision, assumption, or `Deferred to Planning` question
- If the user chooses to pause instead, present the handoff as paused or blocked rather than complete
- Do not offer `Proceed to planning` or `Proceed directly to work` while `Resolve Before Planning` remains non-empty

**Question when no blocking questions remain:** "Brainstorm complete. What would you like to do next?"

**Question when blocking questions remain and user wants to pause:** "Brainstorm paused. Planning is blocked until the remaining questions are resolved. What would you like to do next?"

Present only the options that apply:
- **Proceed to planning (Recommended)** - Run `/spec:plan` for structured implementation planning
- **Proceed directly to work** - Only offer this when scope is lightweight, success criteria are clear, scope boundaries are clear, and no meaningful technical or research questions remain
- **Run additional document review** - Offer this only when a requirements document exists. Runs another pass for further refinement
- **Ask more questions** - Continue clarifying scope, preferences, or edge cases
- **Share to Proof** - Offer this only when a requirements document exists
- **Done for now** - Return later

If the direct-to-work gate is not satisfied, omit that option entirely.

If the user requests an unlisted next step here, resolve it through the Terminal State Lock before doing anything else.

#### 4.2 Handle the Selected Option

**If user selects "Proceed to planning (Recommended)":**

Immediately run `/spec:plan` in the current session. Pass the requirements document path when one exists; otherwise pass a concise summary of the finalized brainstorm decisions. Do not print the closing summary first.

**If user selects "Proceed directly to work":**

Immediately run `/spec:work` in the current session using the finalized brainstorm output as context. If a compact requirements document exists, pass its path. Do not print the closing summary first.

**If user selects "Share to Proof":**

```bash
CONTENT=$(cat docs/brainstorms/YYYY-MM-DD-<topic>-requirements.md)
TITLE="Requirements: <topic title>"
RESPONSE=$(curl -s -X POST https://www.proofeditor.ai/share/markdown \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg title "$TITLE" --arg markdown "$CONTENT" --arg by "ai:spec-first" '{title: $title, markdown: $markdown, by: $by}')")
PROOF_URL=$(echo "$RESPONSE" | jq -r '.tokenUrl')
```

Display the URL prominently: `View & collaborate in Proof: <PROOF_URL>`

If the curl fails, skip silently. Then return to the Phase 4 options.

**If user selects "Ask more questions":** Return to Phase 1.3 (Collaborative Dialogue) and continue asking the user questions one at a time to further refine the design. Probe deeper into edge cases, constraints, preferences, or areas not yet explored. Continue until the user is satisfied, then return to Phase 4. Do not show the closing summary yet.

**If user selects "Run additional document review":**

Load the `document-review` skill and apply it to the requirements document for another pass.

When document-review returns "Review complete", return to the normal Phase 4 options and present only the options that still apply. Do not show the closing summary yet.

#### 4.3 Closing Summary

Use the closing summary only when this run of the workflow is ending or handing off, not when returning to the Phase 4 options.

When complete and ready for planning, display:

```text
Brainstorm complete!

Requirements doc: docs/brainstorms/YYYY-MM-DD-<topic>-requirements.md  # if one was created

Key decisions:
- [Decision 1]
- [Decision 2]

Recommended next step: `/spec:plan`
```

If the user pauses with `Resolve Before Planning` still populated, display:

```text
Brainstorm paused.

Requirements doc: docs/brainstorms/YYYY-MM-DD-<topic>-requirements.md  # if one was created

Planning is blocked by:
- [Blocking question 1]
- [Blocking question 2]

Resume with `/spec:brainstorm` when ready to resolve these before planning.
```
