# rule-maturity.v1

`rule-maturity.v1` is a governance rule maturity record shape.

In v1.14 this contract was schema/docs-only. v1.17 phase 1 adds the only writer for shadow observations: `spec-first internal rule-maturity record`. No promotion state machine is implemented, and no automatic upgrade to `advisory`, `required-evidence`, or `blocking` exists.

## Stages

- `shadow`: observed but not user-facing by default.
- `advisory`: user-facing guidance, still non-blocking.
- `required-evidence`: reserved for later maturity work.
- `blocking`: reserved for later maturity work and requires explicit human-approved evidence and rollback policy.

## Boundary

`shadow_hits` are discrete workflow observations with evidence refs. They are not daemon counters and are not proof that a rule should become blocking. `record` always writes `stage: "shadow"` and does not accept a `--stage` parameter; stage changes belong to future human-reviewed `adjudicate` / `promote` / `demote` work, not this producer.

The local evidence store is `.spec-first/governance/rule-maturity.json`. It is gitignored runtime evidence, not source truth. The store is an array of complete `rule-maturity.v1` records keyed by `rule_id`; each record's `shadow_hits[]` is the primary evidence, while `evidence_refs` is the de-duplicated projection of hit evidence refs.

`spec-first internal rule-maturity list --json` is the deterministic read surface. It reports rule stage, shadow hit count, reason codes, workflow names, evidence refs, and `last_observed_at` using the maximum `Date.parse(shadow_hits[].observed_at)` value. Invalid timestamps degrade the output with `reason_code: invalid-observed-at`.

## Producer and Consumers

| Surface | Role | Boundary |
| --- | --- | --- |
| `spec-first internal rule-maturity record` |唯一 shadow-hit writer | Requires `--rule-id`, `--workflow`, `--evidence-ref`, and `--reason-code`; rejects `--stage`; corrupted stores return `evidence-store-corrupt` without rewriting evidence. |
| `spec-first internal rule-maturity list --json` | deterministic reader | Reads local evidence and returns projection facts only. |
| `spec-code-review` Stage 6 | developer-visible candidate prompt | May surface `Rule Maturity Candidates` with `rule_id`, durable `evidence_ref`, `reason_code`, `human_review_kind`, and `similar_existing_rule_ids`; it does not adjudicate or promote rules. |
| `spec-plan` | planning-depth governance observation | May record a small shadow hit after the LLM confirms or overrides task-governance signals. |
| `spec-skill-audit` | periodic governance health consumer | Writes `rule-maturity-observations.json` with empty/ok/degraded facts; this is not the ordinary developer human-review entrypoint. |

`rule_id` should follow `lens-family + problem-class` kebab-case using one of the canonical lens-family prefixes: `preflight`, `exploration`, `planning`, `execution`, `verification`, `review`, or `summary`. This is an advisory naming convention, not a schema validator.

`evidence_ref` must point to durable repo-readable evidence such as a review artifact, plan section, validation report, `docs/solutions/**` learning, or a repeatable command plus output artifact. Session-only summaries, raw lens stdout, `/tmp` files, and "see above" references are not durable evidence refs.
