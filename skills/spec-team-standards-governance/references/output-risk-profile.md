# 输出风险画像

每个 proposal/report 都应说明 missing evidence、suppressed outputs 和 guard failures。

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

正式输出不得包含 local absolute paths。使用 repo-relative paths；V2 中也可使用 path hash、snapshot id、line range 和 snippet hash。
