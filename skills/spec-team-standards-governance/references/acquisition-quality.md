# Acquisition Quality

V1 only defines lightweight gates for candidates and patch previews.

Rule quality checklist before `confirmed-draft`:

- atomic
- actionable
- falsifiable
- scoped
- owner status present
- invalidation condition present
- migration impact stated
- examples or source refs sufficient for review

Pre-write hygiene gate:

- secret scan
- PII scan
- local absolute path scan
- prompt-injection scan

Gate warning routing:

| Warning | Next action |
| --- | --- |
| evidence warning | `collect-more-evidence` |
| actionability warning | `refine-rule` |
| abstraction warning | `refine-rule` |
| derivation warning | `refine-rule` |
| risk warning | `owner-review` |
| conflict warning/fail | `resolve-conflict` or `owner-review` |
| privacy warning | `redact` |

Do not promote personal preferences, temporary workarounds, historical debt, low-frequency exceptions, unconfirmed review opinions, stale architecture remnants or sensitive business details.
