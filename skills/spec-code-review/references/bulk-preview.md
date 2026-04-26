# Bulk Action Preview

This reference defines the compact plan preview that Interactive mode shows before filing tickets via routing option C. It gives the user a single-screen view of the durable external state the agent is about to create, with exactly two options to Proceed or Cancel.

Best-judgment fix paths do **not** use this preview. Local fixes are reviewable and reversible via git diff, while ticket filing creates durable external state; only option C needs this explicit preview gate.

Interactive mode only.

---

## When the preview fires

One call site:

1. **Routing option C (top-level File tickets)** — after the user picks `File a [TRACKER] ticket per finding without applying fixes` but before any ticket is filed. Scope: every pending `gated_auto` / `manual` finding that survived Stage 5b. Every finding appears under `Filing [TRACKER] tickets (N):` regardless of the agent's natural recommendation, because option C is batch-defer.

The user confirms with `Proceed` or backs out with `Cancel`. There are no per-item decisions inside the preview.

---

## Preview structure

The preview is grouped by the action the agent intends to take. Bucket headers appear only when their bucket is non-empty.

```
<Path label> — <scope summary>[ (tracker: <name>)]:

Filing [TRACKER] tickets (N):
  [P2] <file>:<line> — <one-line plain-English summary>
```

Worked example:

```
File plan — 2 findings as Linear tickets:

Filing Linear tickets (2):
  [P2] billing_service.rb:230 — N+1 on refund batch (no concrete fix)
  [P2] session_helper.rb:12 — Session reset behavior needs discussion
```

---

## Scope summary wording by path

- **Routing option C (top-level File tickets):** header reads `File plan — N findings as [TRACKER] tickets:`. Every finding lands in the `Filing [TRACKER] tickets (N):` bucket.

When the detected tracker is low-confidence or generic (see `tracker-defer.md`), the `(tracker: <name>)` annotation is omitted from the header and the `Filing [TRACKER] tickets` bucket header uses the generic form (`Filing tickets (N):`).

---

## Per-finding line format

Each line uses the compressed form of the framing-quality bar from the plan (R22-R25 — observable-behavior-first, no function / variable names unless needed to locate). The one-line summary is drawn from the persona-produced `why_it_matters` by taking the first sentence (and, when the first sentence is too long for the preview width, paraphrasing it tightly to fit).

- **Shape:** `[<severity>] <file>:<line> — <one-line summary>`
- **Width target:** keep lines near 80 columns so the preview renders cleanly in narrow terminals. Truncate with ellipsis when necessary.
- **No function / variable names inline** unless the reader needs them to locate the issue.
- **Advisory bucket phrasing:** the `Acknowledging (N):` bucket describes the advisory content in one line. No "fix" phrase — advisory findings have no concrete fix.

When no `why_it_matters` is available for a finding (e.g., Unit 2's template upgrade hasn't fully propagated through the persona run, or the artifact file was unreadable), fall back to the finding's title directly. Note the gap in the completion report's Coverage section if it affects more than a few findings in the same run.

---

## Question and options

After the preview body is rendered, ask the user using the platform's blocking question tool (`AskUserQuestion` in Claude Code or `request_user_input` in Codex). In Claude Code, the tool should already be loaded from the Interactive-mode pre-load step — if it isn't, call `ToolSearch` with query `select:AskUserQuestion` now. The text fallback below applies only when the harness genuinely lacks a blocking tool — `ToolSearch` returns no match, the tool call explicitly fails, or the runtime mode does not expose it (e.g., Codex edit modes without `request_user_input`). A pending schema load is not a fallback trigger. Never silently skip the question.

Stem (adapted to the path):
- For routing C: `The agent is about to file the tickets above. Proceed?`

Options (exactly two for routing option C):
- `Proceed` — execute the plan as shown
- `Cancel` — do nothing, return to the originating question

Only when `ToolSearch` explicitly returns no match or the tool call errors — or on a platform with no blocking question tool — fall back to presenting numbered options and waiting for the user's next reply.

---

## Cancel semantics

Return the user to the routing question (the four-option menu). Do not file any tickets or record any state. The session's cached tracker-detection tuple is preserved.

In every case, `Cancel` changes no on-disk or external state.

---

## Proceed semantics

When the user picks `Proceed`:

- **Routing option C (top-level File tickets):** every finding routes through `tracker-defer.md` for ticket creation. No fixes are applied. After all tickets have been filed (or failed), emit the unified completion report.

Failure during `Proceed` (e.g., ticket creation fails for one finding during a batch Defer) follows the failure path defined in `tracker-defer.md` — surface the failure inline with Retry / Fallback / Skip, continue with the rest of the plan, and capture the failure in the completion report's failure section.

---

## Edge cases

- **Zero findings in the ticket bucket:** do not invoke this preview. Option C with no findings is a no-op and should return to the routing question.
- **All findings in one bucket:** preview still shows the bucket header; Proceed / Cancel still offered. This is the common case for routing option C (every finding under `Filing tickets`).
- **N=1 preview (only one finding in scope):** the preview still uses the grouped format, just with a single-line bucket. `Proceed` / `Cancel` still apply.
- **No tracker available:** option C is not offered upstream (see `tracker-defer.md` no sink handling), so this preview should not be invoked. If it is invoked anyway, cancel back to the routing question and report that no issue tracker is configured for this checkout.
