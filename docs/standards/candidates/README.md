# Standards Candidates

This directory is proposal-only. Files here are not hard project context and must not be enforced by downstream workflows.

## V1 Boundary

V1 allows lightweight, manually reviewable notes:

- explicit rules inventory from current source docs or configs
- observed patterns with source refs
- suggested candidates from repeated review/debug/workflow feedback
- conflict records
- promotion proposals or patch previews

V1 does not create empty fact ledgers, lineage ledgers, owner decision queues, PR replay fixtures or role interview notes. Those belong to V2 after a real repo/capability/surface pilot has samples, owner availability and privacy boundaries.

## V2 获取层

V2 可以写入获取任务包和 ledger，但前提是存在真实 single-target pilot。每个 V2 run 必须绑定一个 repo、surface、capability/sub-domain slice、include/exclude scope、time window、evidence sources、privacy boundary、owner candidates、output mode 和 non-goals。

当前 pilot 是 `team-standards-v2-pilot-20260623`，目标为 `spec-first/shared/team-standards`。它只验证 acquisition output shape，并记录 replay/owner 输入不足：

- `acquisition-task-pack.md`
- `source-matrix.md`
- `fact-ledger.md`
- `evidence-quality-ledger.md`
- `lineage-ledger.md`
- `owner-decision-queue.md`
- `promotion-log.md`
- `output-risk-profile.md`
- `role-interview-notes.md`

这些文件仍属于 proposal/evidence 区，不是 hard project context。

## Single Extraction Target

Each candidate extraction must name one target:

- `target_repo`
- one `surface` from `docs/standards/index.md`
- optional `sub_domain`
- one capability slice
- include/exclude scope
- output mode: `candidate-only` or `promotion-proposal`

Mixed-surface, mixed-domain or unrelated-capability input must be split before formal promotion. Do not do a full-repo summary and call it standards.

## Candidate Card Minimum

```yaml
candidate_id: CAND-TEAM-STANDARDS-001
candidate_type: suggested-rule
authority_tier: repeated-review-or-incident
source_refs:
  - docs/standards/index.md
privacy_review: checked
redaction_status: not-needed
promotion_state: proposed
owner: unresolved
why_not_confirmed: "No owner decision and no confirmed source refs yet."
prewrite_gate:
  secrets: pass
  pii: pass
  absolute_paths: pass
  prompt_injection: pass
```

`promotion_state: none` is invalid in candidates because every file here is already in a promotion or advisory flow.

## Pre-Write Gate

Before writing git-tracked candidate content, run or perform a deterministic hygiene check for:

- common secrets and credentials
- PII patterns
- local absolute paths
- prompt-injection text such as "ignore higher instructions", "skip validation" or "modify generated runtime mirrors"

If a check fails, do not commit the raw candidate. Output a report-only limitation such as `redaction-blocked`, `path-hygiene-blocked` or `needs-sanitization`.

## Brownfield Initialization Notes

Start from explicit sources:

1. `AGENTS.md`, `CLAUDE.md`, README/contributing docs and architecture docs.
2. Lint, formatter, typecheck, schema, CI and test configuration.
3. Current PR review norms only when they have source refs.
4. Code, graphify/codegraph, tests and `docs/solutions/**` only as advisory candidate evidence.

Graph/code evidence must be marked `provider_untrusted` until reconfirmed from current source/test/doc/log evidence. Code scanning cannot auto-confirm team policy.
