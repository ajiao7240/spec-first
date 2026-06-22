# Role Interview Playbook

V2 interviews fill gaps that source code and configs cannot answer. Do not invent answers for missing roles; missing role input becomes an open question or `not-run`, not inferred policy.

## Intake Rules

- Bind the interview to one `acquisition_id` and one extraction target.
- Record role names as owner roles, not personal data.
- Keep business, customer, incident and personnel details out of reusable standards.
- Convert answers into candidates only when they include scope, exceptions, source refs or explicit owner decision.
- Interview notes are not confirmed standards. They are evidence for `suggested` candidates or promotion proposals.

## Role Questions

### architecture owner

- What layer owns business state transitions for this capability?
- Which dependency directions are prohibited?
- When is an ADR or design note required before implementation?
- Which exceptions are allowed, and who approves them?

### security/privacy owner

- Which data classes require redaction before they enter candidates or replay fixtures?
- Which permission, auth, payment, funds or privacy flows are high impact?
- Which logs, traces or PR snippets must never be copied into standards artifacts?
- What source confirms the policy: config, ADR, compliance note or owner decision?

### test/QA owner

- Which regression cases are mandatory before promotion?
- Which fixture style or integration boundary is expected?
- Which historical bugs should become replay cases?

### SRE/operations owner

- Which rollout, rollback, monitoring or alerting rules govern this slice?
- Which incident evidence can be abstracted into reusable standards without leaking sensitive details?

### App/H5/PC/Admin owner

- Which UI/error/state semantics must stay consistent across surfaces?
- Which surface-specific exception is deliberate rather than drift?
- Which source confirms cross-surface behavior?

### Backend/Data owner

- Which API, event, idempotency and data lifecycle rules apply?
- Which storage or migration constraints are high impact?

### product/business owner

- Which user promises, compliance expectations or business-state meanings constrain engineering changes?
- Which exceptions require product or compliance approval?

## Output Shape

Each interview note should record:

- `acquisition_id`
- `role`
- `status`: `answered`, `partial`, `not-run`
- `source_refs`
- `candidate_ids`
- `open_questions`
- `privacy_review`
- `next_action`
