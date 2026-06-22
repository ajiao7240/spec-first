# Output Risk Profile

Every proposal/report should state missing evidence, suppressed outputs and guard failures.

V1 reason codes:

- `missing-source-ref`
- `owner-unresolved`
- `high-impact-owner-required`
- `conflict-present`
- `prewrite-secret-blocked`
- `prewrite-pii-blocked`
- `path-hygiene-blocked`
- `prompt-injection-needs-sanitization`
- `source-edit-not-authorized`
- `not-enough-sample`
- `not-run`

Formal outputs must not contain local absolute paths. Use repo-relative paths or, in V2, path hash, snapshot id, line range and snippet hash.
