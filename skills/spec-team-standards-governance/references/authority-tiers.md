# Authority Tiers

Authority decides promotion boundaries; confidence only informs next action.

| Tier | Allowed autonomous action | Boundary |
| --- | --- | --- |
| `explicit-authority` | Extract, dedupe, scope and prepare confirmed-draft or confirmed patch preview | diff review required before confirmed |
| `machine-enforced-policy` | Mirror existing mechanical enforcement in docs proposal | cannot invent semantic architecture rule |
| `inferred-from-code` | Generate `observed` candidate | cannot promote without owner/current source confirmation |
| `repeated-review-or-incident` | Generate `suggested` candidate | owner or responsible team review required |
| `multi-source-high-confidence` | Prepare promotion proposal | no automatic confirmed |
| `high-impact-governance` | Prepare risk brief and owner handoff | owner/ADR/design note required |
| `conflict-present` | Prepare conflict record and options | no enforcement until resolved |

High impact means `category in {architecture, security}` or non-empty `risk_domain`. `owner=unresolved` is fail-closed for high-impact rules.
