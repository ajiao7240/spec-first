# Honest Closeout Contract

`honest-closeout.v1` is the structured verdict model for workflow closeout claims. It is a validator output, not a second durable closeout artifact.

Canonical fields are defined by `docs/contracts/workflows/honest-closeout.schema.json`:

- `claims[]`: `claim_type`, `asserted_status`, `evidence_refs[]`, `verdict`, and `reason_code`.
- `claim_type`: `validation`, `impact_surface`, `review`, or `knowledge_promotion`.
- `overall`: `verified`, `degraded`, or `unsupported`.

Evidence boundaries:

- `validation` claims must point at `verification-run-summary:<check-id>` refs backed by `verification-run-summary.v1`.
- Empty evidence refs are `unsupported`.
- A validation claim that honestly reports `not-run`, `failed`, or `degraded` evidence is not verified; it degrades overall closeout instead of pretending validation passed.
- `impact_surface`, `review`, and `knowledge_promotion` path refs must resolve to regular files inside the target repo; missing files, symlinks, and path escapes are unsupported.
- `knowledge_promotion` claims must point at existing `docs/solutions/**` files.
- Natural-language claims without structured claim objects are `degraded` with `overall_reason_code: "missing-structured-claims"`.

The validator only checks structured claim-to-evidence relationships. Natural-language linting may warn about phrases such as "tests passed", but it is advisory and cannot mark closeout verified.
