# resource-governance-lens.v1

`resource-governance-lens.v1` is the canonical contract for resource advisory facts.

It reports large files, generated output, raw log retention, owner/module path hints, and staging-scope risks. It never blocks `git add`, commit, closeout, or review.

## Source Of Truth

Spec-first owns the default policy in the producer and this contract. External files such as project-scaffold `.scale/resource-policy.json` are reference material only.

If a future implementation adds `--policy-json`, that override must be schema-documented here before use. External `.scale` policy shapes must not become implicit source-of-truth.

## Path Boundary

`subject_path` is the file or path the advisory is about. It may point at generated runtime mirrors such as `.claude/`, `.codex/`, or `.agents/skills/`.

`evidence_ref` is the evidence proving the advisory. It must point to an allowed source/log/artifact reference or deterministic git summary such as `git-status:porcelain` or `git-diff:cached`. Generated runtime mirror paths must not be used as `evidence_ref`.

## Status And Exit Code

`status` is `ok`, `advisory`, or `unavailable`. It is advisory and never-blocking: the exit code is always `0` for all three. `unavailable` (for example `not-a-repo`) is a non-blocking degraded posture, not a fast-fail signal — consumers must read `status` rather than the exit code to detect degradation. A non-zero exit is reserved for a rejected invocation (bad arguments, schema unavailable/invalid).

## Retained Directory Whitelist

Raw-log advisories are suppressed for paths under retained directories (`coverage/`, `test-results/`, `playwright-report/`, `.spec-first/workflows`, `tmp/`, `temp/`), which legitimately hold bulky logs and artifacts. The whitelist gates the raw-log dimension; it does not gate generated-output detection (generated runtime mirrors are always surfaced).

## Staging Scope

The producer may inspect:

- `git diff --numstat`
- `git diff --cached --name-status`
- `git status --porcelain`

It may infer broad staging risk from those facts, but it must not claim it observed the user running `git add .`.
