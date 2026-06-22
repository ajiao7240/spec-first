# Source Matrix

This reference defines the default authority boundaries for different evidence sources in V2 standards acquisition. It helps explain candidate origin; it does not decide promotion.

| Source type | Examples | Max default trust | Max authority tier | Candidate types | Required confirmation |
| --- | --- | --- | --- | --- | --- |
| `explicit-doc` | `AGENTS.md`, `CLAUDE.md`, README, architecture docs, design notes | `suggested` or `confirmed-draft` proposal | `explicit-authority` | `explicit-rule`, `promotion-proposal` | active source-edit workflow, diff review, owner/high-impact check |
| `machine-enforced-config` | lint, formatter, schema, CI, test command config | `suggested` or `confirmed-draft` proposal | `machine-enforced-policy` | `explicit-rule`, `promotion-proposal` | current config source and no semantic expansion |
| `code-structure` | current source layout, dependency direction, test layout | `observed` | `inferred-from-code` | `observed-pattern` | source confirmation plus owner/design note before promotion |
| `project-graph` | graphify/codegraph candidate paths | `observed` | `inferred-from-code` with `provider_untrusted` | `observed-pattern` | reconfirm from current source/test/doc/log evidence |
| `pr-review` | repeated review comments, accepted reviewer feedback | `suggested` | `repeated-review-or-incident` | `suggested-rule` | replay case refs, owner or reviewer consensus |
| `incident` | postmortem, bug replay, production issue analysis | `suggested` | `repeated-review-or-incident` or `high-impact-governance` | `suggested-rule`, `conflict-record` | privacy review and owner gate for high impact |
| `tests` | fixtures, regression tests, contract tests | `observed` or `suggested` | `machine-enforced-policy` when mechanically enforced | `observed-pattern`, `promotion-proposal` | test source and scope validation |
| `interview` | role owner answers and owner decisions | `suggested` or `confirmed-draft` proposal | `explicit-authority` only when the decision is explicit | `suggested-rule`, `promotion-proposal` | source refs, scope, privacy review and owner identity as role |
| `docs-solutions` | reusable lessons and prior debugging docs | `suggested` | `repeated-review-or-incident` | `suggested-rule` | current-source reconfirmation |

Code structure cannot produce `confirmed` trust by itself. `provider_untrusted` facts can prioritize inspection, but they cannot be promotion evidence until a current source anchor exists.

## Promotion Notes

- `confidence_score` and evidence quality scores are inputs, not authority.
- `multi-source-high-confidence` can prepare a promotion proposal, but confirmed writes still require source-edit workflow and review.
- `conflict-present` always holds promotion until conflict resolution.
- High-impact governance uses owner/ADR/design-note handling even when evidence quality is high.
