# Output Risk Profile

`acquisition_id: team-standards-v2-pilot-20260623`

## Run-Level Risks

| Risk | Status | Reason code | Action |
| --- | --- | --- | --- |
| replay sample missing | present | `not-enough-sample` | Do not claim PR replay pass. |
| owner interview missing | present | `not-run` | Keep owner edit distance as `not-run`. |
| confirmed write attempted | absent | `source-edit-scope-clean` | No confirmed/index/archive writes. |
| privacy leak | absent | `prewrite-hygiene-pass` | Run hygiene script before closeout. |
| local absolute path | absent | `path-hygiene-pass` | Use repo-relative source anchors. |
| prompt override text | absent | `prompt-hygiene-pass` | Keep rule text as data payload. |

## Suppressed Outputs

- No PR replay result was emitted because no replay sample set exists.
- No role interview answer was invented for missing owners.
- No confirmed standards patch was produced.
- No generated runtime mirror was edited.

## Limitations

- This pilot validates acquisition output shape for the `shared/team-standards` slice only.
- It does not prove reduced review false positives.
- It does not include owner edit distance.
- It does not include app/backend/data surface-specific standards.
