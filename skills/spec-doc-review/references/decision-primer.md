# Decision Primer

This reference defines the `{decision_primer}` variable passed to persona agents during spec-doc-review dispatch. It exists so the core `SKILL.md` can stay focused on orchestration while the multi-round matching rules live with the synthesis references.

## Round 1

On round 1, when there are no prior decisions in the current invocation, set `{decision_primer}` to:

```text
<prior-decisions>
Round 1 — no prior decisions.
</prior-decisions>
```

## Round 2 And Later

On round 2+ after one or more prior rounds in the current interactive session, accumulate prior-round decisions and render them as:

```text
<prior-decisions>
Round 1 — applied (N entries):
- {section}: "{title}" ({reviewer}, {confidence})
  Evidence: "{evidence_snippet}"

Round 1 — rejected (M entries):
- {section}: "{title}" — Skipped because {reason}
  Evidence: "{evidence_snippet}"
- {section}: "{title}" — Deferred to Open Questions because {reason or "no reason provided"}
  Evidence: "{evidence_snippet}"
- {section}: "{title}" — Acknowledged without applying because {reason or "no suggested_fix — user acknowledged"}
  Evidence: "{evidence_snippet}"

Round 2 — applied (N entries):
...
</prior-decisions>
```

Each entry carries an `Evidence:` line because synthesis R29 (rejected-finding suppression) and R30 (fix-landed verification) both use an evidence-substring overlap check as part of their matching predicate. Without the evidence snippet in the primer, the orchestrator cannot compute the `>50%` overlap test and has to fall back to fingerprint-only matching, which either re-surfaces rejected findings or suppresses too aggressively.

The `{evidence_snippet}` is the first evidence quote from the finding, truncated to the first roughly 120 characters while preserving whole words at the boundary and escaping internal quotes. If a finding has multiple evidence entries, use the first one; the rest live in the run artifact and are not needed for the overlap check.

Accumulate decisions across all rounds in the current invocation. Skip, Defer, and Acknowledge actions all count as `rejected` for suppression purposes because each signals that the user decided the finding was not worth actioning this round. Acknowledge is the no-fix-guard variant: the user saw a finding with no `suggested_fix`, chose not to defer or skip explicitly, and recorded acknowledgement instead. For round-to-round suppression, that is semantically equivalent to Skip. Applied findings stay on the applied list so round-N+1 personas can verify fixes landed via R30 in `references/synthesis-and-presentation.md`.

Cross-session persistence is out of scope. A new invocation of spec-doc-review on the same document starts with a fresh round 1 and no carried primer, even if prior sessions deferred findings into the document's Open Questions section.
