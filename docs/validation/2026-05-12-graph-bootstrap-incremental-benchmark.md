# graph-bootstrap incremental refresh validation

## Scope

- Plan: `docs/plans/2026-05-12-003-feat-graph-bootstrap-incremental-refresh-plan.md`
- Rollout posture: explicit operator opt-in / expert escape hatch only
- Default refresh mode: `full`
- A4 coordination: Assumed serial with `2026-05-09-003`
- Redaction policy: tracked validation notes record command metadata and summarized outcomes only; raw provider stdout/stderr and raw logs are not pasted.

## U0a Extraction Surface Discovery

Date: 2026-05-14

Disposable repo:

- temp repo path: `/tmp/spec-first-u0a.xPjuuu/spec-first-u0a-repo`
- source revision: `8605e514d4706c72e8dca60ecba5677cf28179c3`
- teardown expectation: disposable temp clone; not a canonical project artifact

GitNexus surface:

- bootstrap command metadata: `npx -y gitnexus@1.6.4 analyze`
- extraction interface: `npx -y gitnexus@1.6.4 cypher <query> --repo .`
- repo selector observed in temp clone: `.`
- node query metadata: `MATCH (n:Function) RETURN "Function" AS kind, n.name, n.filePath, n.startLine, n.endLine LIMIT 5`
- edge query metadata: `MATCH (n)-[r:CodeRelation]->(m) WHERE r.type IN ["CALLS","IMPORTS","IMPORTS_FROM"] RETURN r.type, n.filePath, n.name, m.filePath, m.name LIMIT 5`
- result: pass; both queries returned rows
- stability note: repo selector was not the clone basename; helper callers must pass or discover a selector instead of assuming basename.

code-review-graph surface:

- storage path: `.code-review-graph/graph.db`
- extraction interface: `sqlite3 -json`
- node query metadata: `select kind,name,file_path,line_start,line_end from nodes where kind in ("Function","Class","Method","Interface") limit 5;`
- edge query metadata: `select kind,source_qualified,target_qualified,file_path,line from edges where kind in ("CALLS","IMPORTS_FROM","REFERENCES") limit 5;`
- result: pass; both queries returned rows
- stability note: SQLite table names and columns were observed directly in the temp clone.

U0a conclusion: pass. Both enabled providers expose node and edge anchor extraction surfaces with temp-clone provenance. U0b helper creation may proceed.

## U0b Helper Status

`tests/benchmark/extract-graph-anchors.sh` was added as a benchmark-only helper. It does not write canonical `.spec-first/graph/`, `.spec-first/providers/`, provider native storage, or runtime mirror assets.

The helper emits JSON with:

- `nodes[]`
- `edges[]`
- per-provider `metadata`
- extraction `diagnostics[]`

Important correction: early helper runs used `--gitnexus-repo .`, which can resolve to a stale globally registered GitNexus `.` alias instead of the current disposable clone. `tests/benchmark/extract-graph-anchors.sh` now defaults GitNexus extraction to the physical repo path from `--repo`. GitNexus anchor conclusions from the early U0b attempt, diagnostic attempt, and U4 attempts 1-2 are superseded where they depended on the stale `.` selector.

### U0b Provider-Native Proof Attempt (superseded selector)

Date: 2026-05-14

Disposable repo:

- temp repo path: `/tmp/spec-first-u0b.5b7tGK/repo`
- source revision A: `8605e514d4706c72e8dca60ecba5677cf28179c3`
- source revision B: `ce7790fd5ec1ac8db5e2d2673f703e564437b946`
- source revision C: `f16fae6d92ed9973278849c0e14d3dbe1e23df91`
- source: local clone of current repository HEAD; benchmark helper was invoked from the current working tree
- teardown: disposable temp clone removed after recording this summary; not a canonical project artifact

Controlled diff:

- B added `src/cli/graph-incremental-proof-alpha.js` with `graphProofAlpha`
- C added `src/cli/graph-incremental-proof-workflow.js` importing and calling `graphProofAlpha`

Provider-native command metadata:

| Step | GitNexus command | code-review-graph command |
| --- | --- | --- |
| A full | `npx -y gitnexus@1.6.4 analyze --force` | `uvx code-review-graph@2.3.3 build` |
| B incremental | `npx -y gitnexus@1.6.4 analyze` | `uvx code-review-graph@2.3.3 update --base <A>` |
| B full checkpoint | `npx -y gitnexus@1.6.4 analyze --force` | `uvx code-review-graph@2.3.3 build` |
| C incremental | `npx -y gitnexus@1.6.4 analyze` | `uvx code-review-graph@2.3.3 update --base <B>` |
| C full checkpoint | `npx -y gitnexus@1.6.4 analyze --force` | `uvx code-review-graph@2.3.3 build` |

Timing summary:

| Step | GitNexus duration | code-review-graph duration |
| --- | ---: | ---: |
| A full | 12123ms | 5062ms |
| B incremental | 11902ms | 1517ms |
| B full checkpoint | 11865ms | 5324ms |
| C incremental | 11547ms | 1488ms |
| C full checkpoint | 11568ms | 7802ms |

Anchor extraction summary:

| Run | Provider | Helper status | Nodes | Edges | Proof nodes | Proof edges |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| A full | GitNexus | `ok` | 1780 | 2889 | 0 | 0 |
| A full | code-review-graph | `ok` | 1853 | 34392 | 0 | 0 |
| B incremental | GitNexus | `ok` | 1780 | 2889 | 0 | 0 |
| B incremental | code-review-graph | `ok` | 1854 | 34393 | 1 | 1 |
| B full checkpoint | GitNexus | `ok` | 1780 | 2889 | 0 | 0 |
| B full checkpoint | code-review-graph | `ok` | 1854 | 34393 | 1 | 1 |
| C incremental | GitNexus | `ok` | 1780 | 2889 | 0 | 0 |
| C incremental | code-review-graph | `ok` | 1855 | 34396 | 2 | 4 |
| C full checkpoint | GitNexus | `ok` | 1780 | 2889 | 0 | 0 |
| C full checkpoint | code-review-graph | `ok` | 1855 | 34396 | 2 | 4 |

Observed result:

- code-review-graph B incremental vs B full checkpoint: proof node capture/equivalence passed.
- code-review-graph C incremental vs C full checkpoint: proof node and edge capture/equivalence passed.
- GitNexus B/C incremental vs full checkpoints: superseded by the corrected selector runs below; this attempt used the stale `.` selector and is no longer valid GitNexus capture evidence.
- U0b conclusion: superseded for GitNexus. code-review-graph observations remain useful, but final GitNexus capture evidence comes from the corrected selector runs below.

### GitNexus Capture Diagnostic Attempt (superseded selector)

Date: 2026-05-14

This follow-up was not a full U4 rerun. It tested whether GitNexus capture would work if the controlled diff modified a file already observed in GitNexus anchors.

Disposable repo:

- temp repo path: `/tmp/spec-first-gitnexus-capture.MWvt0x/repo`
- source revision A: `8605e514d4706c72e8dca60ecba5677cf28179c3`
- source revision B: `b7998870593ff71c22e887d776b7a5e020491bdd`
- source revision C: `6d3fa8b2a782646131678b22b8b5012dc9df46c3`
- teardown: disposable temp clone removed after recording this summary; not a canonical project artifact

Setup:

- A full GitNexus `cypher` sample exposed existing anchors from `scripts/typecheck-js.js`, including `listJavaScriptFiles`, `walk`, and `main`.
- B appended `graphProofExistingAlpha` to `scripts/typecheck-js.js`.
- C appended `graphProofExistingWorkflow`, which calls `graphProofExistingAlpha`, to the same file.

GitNexus timing summary:

| Step | Command metadata | Duration |
| --- | --- | ---: |
| A full | `npx -y gitnexus@1.6.4 analyze --force` | 13117ms |
| B incremental | `npx -y gitnexus@1.6.4 analyze` | 11757ms |
| B full checkpoint | `npx -y gitnexus@1.6.4 analyze --force` | 11527ms |
| C incremental | `npx -y gitnexus@1.6.4 analyze` | 11342ms |
| C full checkpoint | `npx -y gitnexus@1.6.4 analyze --force` | 11633ms |

GitNexus anchor summary:

| Run | Helper status | Nodes | Edges | Proof nodes | Proof edges |
| --- | --- | ---: | ---: | ---: | ---: |
| A full | `ok` | 1780 | 2889 | 0 | 0 |
| B incremental | `ok` | 1780 | 2889 | 0 | 0 |
| B full checkpoint | `ok` | 1780 | 2889 | 0 | 0 |
| C incremental | `ok` | 1780 | 2889 | 0 | 0 |
| C full checkpoint | `ok` | 1780 | 2889 | 0 | 0 |

Diagnostic conclusion:

- Superseded for GitNexus capture: this attempt also used the stale `.` selector. The corrected selector run below shows GitNexus does capture the controlled symbols when the helper targets the physical disposable repo path.
- The duration ratio observation remains directionally consistent with later corrected runs: GitNexus incremental is close to full duration.

Historical formal A->B benchmark attempts are recorded below. Attempts 1-2 do not pass rollout gates; their GitNexus anchor conclusions are superseded where they depended on the stale `.` selector.

## U4 Benchmark Attempts

Date: 2026-05-14

### Attempt 1

- temp repo path: `/private/tmp/spec-first-u4-real.pVAYJN/repo`
- source revision A: `8605e514d4706c72e8dca60ecba5677cf28179c3`
- source revision B: `db45b796075e41ee8094229abf8ac9b70aa7be17`
- source: local clone of the current repository HEAD; current working tree source scripts were used to drive bootstrap
- teardown: disposable temp clone removed after recording this summary; not a canonical project artifact

Controlled diff:

- added `src/graph_incremental_benchmark/alpha.js`
- added `src/graph_incremental_benchmark/workflow.js`
- added `src/graph_incremental_benchmark/orphan.js`

Run summary:

| Run | Exit | Workflow | code-review-graph | GitNexus |
| --- | --- | --- | --- | --- |
| A full | 0 | `primary` | `ready`, `query_ready=true`, `readiness_source=cold-run`, `refresh_mode=full`, `duration_ms=7860` | `ready`, `query_ready=true`, `readiness_source=cold-run`, `refresh_mode=full`, `duration_ms=18237` |
| B incremental | 0 | `primary` | `ready`, `query_ready=true`, `readiness_source=incremental-update`, `refresh_mode=incremental`, `fallback_from_incremental=false`, `duration_ms=2729` | `ready`, `query_ready=true`, `readiness_source=incremental-update`, `refresh_mode=incremental`, `fallback_from_incremental=false`, `duration_ms=18920` |
| B full | 0 | `primary` | `ready`, `query_ready=true`, `readiness_source=cold-run`, `refresh_mode=full`, `duration_ms=5776` | `ready`, `query_ready=true`, `readiness_source=cold-run`, `refresh_mode=full`, `duration_ms=18222` |

Anchor extraction summary:

| Run | Provider | Helper status | Nodes | Edges |
| --- | --- | --- | ---: | ---: |
| A full | GitNexus | `ok` but no parsed anchors | 0 | 0 |
| A full | code-review-graph | `ok` | 1853 | 34392 |
| B incremental | GitNexus | `ok` but no parsed anchors | 0 | 0 |
| B incremental | code-review-graph | `ok` | 1857 | 34395 |
| B full | GitNexus | `ok` but no parsed anchors | 0 | 0 |
| B full | code-review-graph | `ok` | 1857 | 34395 |

Observed equivalence:

- code-review-graph B incremental vs B full node anchors: pass
- code-review-graph B incremental vs B full edge anchors: pass
- GitNexus B incremental vs B full anchors: inconclusive, because the helper did not parse non-empty GitNexus node or edge anchors in this repository run

Outcome: invalid for GitNexus correctness gating. The helper incorrectly assumed GitNexus `cypher` output would always be JSON-wrapped and did not parse raw markdown table output. This helper bug was fixed by parsing both JSON-wrapped and raw markdown output, and by querying GitNexus node labels explicitly instead of using `labels(n)[0]`.

### Attempt 2

Disposable repo:

- temp repo path: `/private/tmp/spec-first-u4-real.Ml0k7g/repo`
- source revision A: `8605e514d4706c72e8dca60ecba5677cf28179c3`
- source revision B: `c5072763ddc3fa8365c5fb9a68bd1ef9b0d1fc43`
- source: local clone of the current repository HEAD; current working tree source scripts were used to drive bootstrap
- teardown: disposable temp clone removed after recording this summary; not a canonical project artifact

Controlled diff:

- added `scripts/graph_incremental_benchmark/alpha.js`
- added `scripts/graph_incremental_benchmark/workflow.js`
- added `scripts/graph_incremental_benchmark/orphan.js`

Run summary:

| Run | Exit | Workflow | code-review-graph | GitNexus |
| --- | --- | --- | --- | --- |
| A full | 0 | `primary` | `ready`, `query_ready=true`, `readiness_source=cold-run`, `refresh_mode=full`, `duration_ms=6421` | `ready`, `query_ready=true`, `readiness_source=cold-run`, `refresh_mode=full`, `duration_ms=19714` |
| B incremental | 0 | `primary` | `ready`, `query_ready=true`, `readiness_source=incremental-update`, `refresh_mode=incremental`, `fallback_from_incremental=false`, `duration_ms=2637` | `ready`, `query_ready=true`, `readiness_source=incremental-update`, `refresh_mode=incremental`, `fallback_from_incremental=false`, `duration_ms=19608` |
| B full | 0 | `primary` | `ready`, `query_ready=true`, `readiness_source=cold-run`, `refresh_mode=full`, `duration_ms=5647` | `ready`, `query_ready=true`, `readiness_source=cold-run`, `refresh_mode=full`, `duration_ms=19615` |

Anchor extraction summary:

| Run | Provider | Helper status | Nodes | Edges |
| --- | --- | --- | ---: | ---: |
| A full | GitNexus | `ok` | 1780 | 2889 |
| A full | code-review-graph | `ok` | 1853 | 34392 |
| B incremental | GitNexus | `ok` | 1780 | 2889 |
| B incremental | code-review-graph | `ok` | 1857 | 34395 |
| B full | GitNexus | `ok` | 1780 | 2889 |
| B full | code-review-graph | `ok` | 1857 | 34395 |

Observed capture / equivalence:

- code-review-graph A full vs B incremental node capture: 4 added node anchors.
- code-review-graph B incremental vs B full node anchors: pass.
- code-review-graph B incremental vs B full edge anchors: pass.
- GitNexus B incremental vs B full node anchors: pass.
- GitNexus B incremental vs B full edge anchors: pass.
- GitNexus A full vs B incremental capture: inconclusive. The controlled added files were tracked by git, but GitNexus did not expose anchors for `scripts/graph_incremental_benchmark/*` in either B incremental or B full. Therefore same-commit equivalence is usable, but node/edge capture for GitNexus is not proven by this diff.

Gate decision:

- Correctness gate: superseded for GitNexus by the corrected selector run below. code-review-graph capture/equivalence passed for this attempt, but this attempt is not the final gate source.
- Minimum speed-benefit gate: failed. code-review-graph `2637ms` was not `<= 5647ms / 3`; GitNexus `19608ms` was not `<= 19615ms / 3`.
- Speed claim gate: failed. No `~3-5s` claim is made.
- Rollout status: `$spec-graph-bootstrap --incremental` remains implemented and contract-tested as a clean single-repo diagnostic / validation-only expert path. It is not validated as a correctness-backed acceleration path, and default refresh mode remains `full`.

### Attempt 3 (corrected GitNexus selector)

Disposable repo:

- temp repo path: `/tmp/spec-first-u4-corrected.lZ9lJX/repo`
- physical repo selector used by helper: `/private/tmp/spec-first-u4-corrected.lZ9lJX/repo`
- source revision A: `8605e514d4706c72e8dca60ecba5677cf28179c3`
- source revision B: `eaba0587d1042ece7591b27eab986aa9e40ac3b3`
- source revision C: `71aac93615eebba6ea53b151507ec78323e62133`
- source: local clone of current repository HEAD; current working tree source scripts and corrected benchmark helper were used
- setup note: the temp clone's `spec-mcp-setup` baseline was temporarily marked ready to bypass unrelated Serena project readiness for this benchmark; the host ledger was restored after the run
- teardown: disposable temp clone removed after recording this summary; not a canonical project artifact

Controlled diff:

- B appended `graphProofBootstrapAlpha` to already-indexed `scripts/typecheck-js.js`
- C appended `graphProofBootstrapWorkflow`, which calls `graphProofBootstrapAlpha`, to the same file

Run summary:

| Run | Provider | Status | Query ready | Readiness source | Refresh mode | Fallback | Duration |
| --- | --- | --- | --- | --- | --- | --- | ---: |
| A full | code-review-graph | `ready` | true | `cold-run` | `full` | false | 6048ms |
| A full | GitNexus | `ready` | true | `cold-run` | `full` | false | 18706ms |
| B incremental | code-review-graph | `ready` | true | `incremental-update` | `incremental` | false | 2762ms |
| B incremental | GitNexus | `ready` | true | `incremental-update` | `incremental` | false | 18323ms |
| B full | code-review-graph | `ready` | true | `cold-run` | `full` | false | 7638ms |
| B full | GitNexus | `ready` | true | `cold-run` | `full` | false | 18193ms |
| C incremental | code-review-graph | `ready` | true | `incremental-update` | `incremental` | false | 3072ms |
| C incremental | GitNexus | `ready` | true | `incremental-update` | `incremental` | false | 18568ms |
| C full | code-review-graph | `ready` | true | `cold-run` | `full` | false | 7854ms |
| C full | GitNexus | `ready` | true | `cold-run` | `full` | false | 18751ms |

Anchor extraction summary:

| Run | Provider | Helper status | Nodes | Edges | Proof nodes | Proof edges |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| A full | GitNexus | `ok` | 1780 | 2889 | 0 | 0 |
| A full | code-review-graph | `ok` | 1853 | 34392 | 0 | 0 |
| B incremental | GitNexus | `ok` | 1781 | 2889 | 1 | 0 |
| B incremental | code-review-graph | `ok` | 1854 | 34392 | 1 | 0 |
| B full | GitNexus | `ok` | 1781 | 2889 | 1 | 0 |
| B full | code-review-graph | `ok` | 1854 | 34392 | 1 | 0 |
| C incremental | GitNexus | `ok` | 1782 | 2890 | 2 | 1 |
| C incremental | code-review-graph | `ok` | 1855 | 34393 | 2 | 1 |
| C full | GitNexus | `ok` | 1782 | 2890 | 2 | 1 |
| C full | code-review-graph | `ok` | 1855 | 34393 | 2 | 1 |

Corrected gate decision:

- Correctness evidence improved: for this already-indexed file scenario, both providers captured the controlled proof node and call-edge deltas, and B/C incremental anchors matched same-commit full checkpoints.
- Full U4 correctness remains narrower than planned at this point: this corrected run does not cover the original three-category matrix's file lifecycle add/delete case, because earlier add-file attempts used the stale selector and are not valid GitNexus capture evidence.
- Minimum speed-benefit gate failed. code-review-graph B incremental `2762ms` was not `<= 7638ms / 3`, code-review-graph C incremental `3072ms` was not `<= 7854ms / 3`, and GitNexus incremental remained close to full in both B and C.
- Speed claim gate failed. No `~3-5s` claim is made.
- Rollout status: `$spec-graph-bootstrap --incremental` remains diagnostic / validation-only. It is not validated as the plan's correctness-backed acceleration path, and default refresh mode remains `full`.

### Attempt 4 (corrected lifecycle add/delete)

Disposable repo:

- temp repo path: `/tmp/spec-first-u4-lifecycle.1b1x7M`
- physical repo selector used by helper: `/private/tmp/spec-first-u4-lifecycle.1b1x7M/repo`
- source revision A: `1b4483d6f0fb0abe95c777afa0174bf91db61483`
- source revision B: `4887cbe7e601becd1b9b03b29f229d00bcb2ec42`
- source: local clone of current repository HEAD; current working tree source scripts and corrected benchmark helper were used
- setup note: the host readiness ledger was placed under ignored temp-clone config state so the benchmark worktree stayed clean before provider refresh
- teardown expectation: disposable temp clone; not a canonical project artifact

Controlled diff:

- A added `scripts/graph_lifecycle_obsolete.js` with `graphLifecycleObsolete`
- B deleted `scripts/graph_lifecycle_obsolete.js`
- B added `scripts/graph_lifecycle_added.js` with `graphLifecycleAdded`
- B added `scripts/graph_lifecycle_consumer.js` with `graphLifecycleConsumeAdded`, importing and calling `graphLifecycleAdded`

Run summary:

| Run | Provider | Status | Query ready | Readiness source | Refresh mode | Fallback | Duration |
| --- | --- | --- | --- | --- | --- | --- | ---: |
| A full | code-review-graph | `ready` | true | `cold-run` | `full` | false | 6047ms |
| A full | GitNexus | `ready` | true | `cold-run` | `full` | false | 19241ms |
| B incremental | code-review-graph | `ready` | true | `incremental-update` | `incremental` | false | 2792ms |
| B incremental | GitNexus | `ready` | true | `incremental-update` | `incremental` | false | 20281ms |
| B full | code-review-graph | `ready` | true | `cold-run` | `full` | false | 7270ms |
| B full | GitNexus | `ready` | true | `cold-run` | `full` | false | 18377ms |

Anchor extraction summary:

| Run | Provider | Helper status | Nodes | Edges | Lifecycle nodes | Lifecycle edges |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| A full | GitNexus | `ok` | 1781 | 2889 | 1 | 0 |
| A full | code-review-graph | `ok` | 1854 | 34393 | 1 | 1 |
| B incremental | GitNexus | `ok` | 1782 | 2890 | 2 | 1 |
| B incremental | code-review-graph | `ok` | 1855 | 34396 | 2 | 4 |
| B full | GitNexus | `ok` | 1782 | 2890 | 2 | 1 |
| B full | code-review-graph | `ok` | 1855 | 34396 | 2 | 4 |

Observed capture / equivalence:

- GitNexus B incremental vs B full node anchors: pass (`node_symdiff=0`).
- GitNexus B incremental vs B full edge anchors: pass (`edge_symdiff=0`).
- code-review-graph B incremental vs B full node anchors: pass (`node_symdiff=0`).
- code-review-graph B incremental vs B full edge anchors: pass (`edge_symdiff=0`).
- GitNexus A full vs B incremental capture: `node_symdiff=3`, `edge_symdiff=1`, matching deletion of `graphLifecycleObsolete` plus addition of `graphLifecycleAdded` / `graphLifecycleConsumeAdded` and the call edge.
- code-review-graph A full vs B incremental capture: `node_symdiff=3`, `edge_symdiff=5`, matching the same lifecycle node delta plus provider-specific `CALLS` / `REFERENCES` edge deltas.

Lifecycle gate decision:

- File lifecycle add/delete evidence is now covered with the corrected GitNexus selector.
- Cross-file import/call evidence is covered by the added consumer file calling the added provider file.
- At this point in the run sequence, the exact planned intra-file signature-modification and intra-file function-deletion subcases had not yet been separately rerun; Attempt 5 below covers them. This lifecycle attempt remains a validation note rather than a completion claim because the mandatory speed-benefit gate still fails.
- Minimum speed-benefit gate failed again. code-review-graph B incremental `2792ms` was not `<= 7270ms / 3`, and GitNexus B incremental `20281ms` was slower than B full `18377ms`.
- Rollout status remains unchanged: `$spec-graph-bootstrap --incremental` is diagnostic / validation-only, not a correctness-backed acceleration path.

### Attempt 5 (corrected intra-file signature/delete)

Disposable repo:

- temp repo path: `/tmp/spec-first-u4-intrafile.TNez44`
- physical repo selector used by helper: `/private/tmp/spec-first-u4-intrafile.TNez44/repo`
- source revision A: `88765fe5bb38e289fb6ecc8ba47b8dea5b51eac4`
- source revision B: `88959a9d55e6ea64614bca0a6a3ce0cc7d7992b0`
- source: local clone of current repository HEAD; current working tree source scripts and corrected benchmark helper were used
- setup note: the host readiness ledger was placed under ignored temp-clone config state so the benchmark worktree stayed clean before provider refresh
- teardown expectation: disposable temp clone; not a canonical project artifact

Controlled diff:

- A added `scripts/graph_intra_benchmark.js` with `graphIntraAlpha(value)` and `graphIntraDelete(value)`
- B changed `graphIntraAlpha(value)` to `graphIntraAlpha(value, suffix)` and expanded its body so the normalized node span changes
- B deleted `graphIntraDelete`
- B added `graphIntraUseAlpha`, which calls `graphIntraAlpha`

Run summary:

| Run | Provider | Status | Query ready | Readiness source | Refresh mode | Fallback | Duration |
| --- | --- | --- | --- | --- | --- | --- | ---: |
| A full | code-review-graph | `ready` | true | `cold-run` | `full` | false | 6780ms |
| A full | GitNexus | `ready` | true | `cold-run` | `full` | false | 19078ms |
| B incremental | code-review-graph | `ready` | true | `incremental-update` | `incremental` | false | 2625ms |
| B incremental | GitNexus | `ready` | true | `incremental-update` | `incremental` | false | 20236ms |
| B full | code-review-graph | `ready` | true | `cold-run` | `full` | false | 6944ms |
| B full | GitNexus | `ready` | true | `cold-run` | `full` | false | 18618ms |

Anchor extraction summary:

| Run | Provider | Helper status | Nodes | Edges | Intra-file nodes | Intra-file edges |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| A full | GitNexus | `ok` | 1782 | 2889 | 2 | 0 |
| A full | code-review-graph | `ok` | 1855 | 34394 | 2 | 2 |
| B incremental | GitNexus | `ok` | 1782 | 2890 | 2 | 1 |
| B incremental | code-review-graph | `ok` | 1855 | 34397 | 2 | 5 |
| B full | GitNexus | `ok` | 1782 | 2890 | 2 | 1 |
| B full | code-review-graph | `ok` | 1855 | 34397 | 2 | 5 |

Observed capture / equivalence:

- GitNexus B incremental vs B full node anchors: pass (`node_symdiff=0`).
- GitNexus B incremental vs B full edge anchors: pass (`edge_symdiff=0`).
- code-review-graph B incremental vs B full node anchors: pass (`node_symdiff=0`).
- code-review-graph B incremental vs B full edge anchors: pass (`edge_symdiff=0`).
- GitNexus A full vs B incremental capture: `node_symdiff=4`, `edge_symdiff=1`, matching the `graphIntraAlpha` span/signature-body change, deletion of `graphIntraDelete`, addition of `graphIntraUseAlpha`, and the new call edge.
- code-review-graph A full vs B incremental capture: `node_symdiff=4`, `edge_symdiff=7`, matching the same node delta plus provider-specific `CALLS` / `REFERENCES` edge deltas.

Intra-file gate decision:

- Intra-file signature/body-span modification and function deletion are now covered with the corrected GitNexus selector.
- Across attempts 3-5, corrected-selector evidence now covers already-indexed file updates, cross-file call/file lifecycle add-delete, and intra-file signature/delete subcases. These are split across disposable runs rather than one combined A->B run, but each run used the same current source scripts and corrected helper.
- Minimum speed-benefit gate failed again. code-review-graph B incremental `2625ms` was not `<= 6944ms / 3`, and GitNexus B incremental `20236ms` was slower than B full `18618ms`.
- Rollout status remains unchanged: `$spec-graph-bootstrap --incremental` is diagnostic / validation-only, not a correctness-backed acceleration path.

## Speed Gate Provider Version / Option Probe

Date: 2026-05-14

This probe checks whether the remaining U4 speed-benefit blocker has an obvious stable-provider or documented-option fix inside the current plan scope.

Command metadata and summarized findings:

| Probe | Finding |
| --- | --- |
| `npm view gitnexus version versions --json` | npm stable latest is `1.6.4`, matching the current source pin. Newer published builds are `1.6.5-rc.*`, not stable release candidates to silently adopt in this plan. |
| `python3 -m pip index versions code-review-graph` | PyPI latest is `2.3.3`, matching the current source pin. |
| `npx -y gitnexus@1.6.4 analyze --help` | No documented incremental speed flag beyond the default `analyze` behavior; `--skip-agents-md --no-stats` is already projected to avoid host-instruction writes. `--skip-git` only changes root discovery and is not plausible as a 3x speed-gate fix. |
| `uvx code-review-graph@2.3.3 update --help` / `build --help` | Both expose `--skip-flows` and `--skip-postprocess`; using them only on incremental would change graph/postprocess semantics relative to full, and using them on both paths would not support the plan's full-readiness equivalence claim. They are not a low-risk speed-gate fix for this plan. |
| `pip download code-review-graph==2.3.3` source inspection | `code_review_graph/cli.py` maps `--skip-flows` / `--skip-postprocess` to `postprocess=minimal` / `postprocess=none`, while normal build/update uses full postprocess. `code_review_graph/postprocessing.py` runs signatures, FTS, flows, and communities after both full and incremental graph updates. `status` only exposes `--repo` / `--data-dir`, so there is no documented lower-cost readiness proof replacement. |

Conclusion:

- There is no stable provider pin upgrade available for the current source-owned pins.
- There is no documented low-risk provider flag that can satisfy `B_incremental <= B_full / 3` while preserving the plan's full-readiness equivalence posture.
- The speed-benefit gate remains failed. The plan has been explicitly revised to diagnostic-only completion scope; speed-backed opt-in now requires a separate provider speed/pin investigation that is allowed to evaluate RC packages and changed graph semantics.

### Out-of-Scope GitNexus RC Probe

This exploratory probe did **not** change the source pin and does **not** count as current-plan gate evidence. It checks whether the latest published GitNexus RC is promising enough to justify a separate provider speed/pin plan.

Disposable repo:

- temp repo path: `/tmp/spec-first-gitnexus-rc-speed.aQkZDc`
- physical repo selector used by helper: `/private/tmp/spec-first-gitnexus-rc-speed.aQkZDc/repo`
- package: `gitnexus@1.6.5-rc.28`
- source revision A: `faf9fb1e1bb66aa04748cd8e50e7e70bdb0d524a`
- source revision B: `abf29fb7dad59d604a7d5d58d60268626fae93c3`

Controlled diff:

- A added `scripts/graph_rc_probe.js` with `graphRcProbeAlpha`
- B changed `graphRcProbeAlpha` and added `graphRcProbeBeta`, which calls `graphRcProbeAlpha`

Timing and stability summary:

| Run | Command metadata | Exit | Duration |
| --- | --- | ---: | ---: |
| A full | `npx -y gitnexus@1.6.5-rc.28 analyze --force --skip-agents-md --no-stats` | 0 | 39511ms |
| B incremental | `npx -y gitnexus@1.6.5-rc.28 analyze --skip-agents-md --no-stats` | 0 | 7149ms |
| B full first attempt | `npx -y gitnexus@1.6.5-rc.28 analyze --force --skip-agents-md --no-stats` | 134 | 2084ms |
| B full retry | same as above | 0 | 10588ms |

Anchor summary after the successful full retry:

| Comparison | Result |
| --- | --- |
| B incremental vs B full retry node anchors | pass (`symdiff=0`) |
| B incremental vs B full retry edge anchors | pass (`symdiff=0`) |
| A full vs B incremental node capture | `symdiff=1` |
| A full vs B incremental edge capture | `symdiff=1` |

RC probe conclusion:

- The RC shows a faster GitNexus incremental path than stable `1.6.4`, but it still fails the current ratio gate: `7149ms` is not `<= 10588ms / 3`.
- The first B full checkpoint aborted with exit `134` before succeeding on retry, so the RC is not a drop-in low-risk source pin for the current plan.
- A future provider speed/pin plan may investigate RC behavior further; this plan does not claim speed-backed opt-in under stable pinned providers.

### Out-of-Scope GitNexus RC Source Inspection

Date: 2026-05-14

This follow-up inspected the latest published GitNexus version sequence and the `gitnexus@1.6.5-rc.28` package source without changing the source pin.

Command metadata and summarized findings:

| Probe | Finding |
| --- | --- |
| `npm view gitnexus versions --json` | Latest published versions still end at `1.6.5-rc.28`; no newer stable package exists beyond `1.6.4`. |
| `npm view gitnexus dist-tags --json` | `latest` remains `1.6.4`; `rc` points to `1.6.5-rc.28`. The RC is not the stable/latest distribution tag. |
| `git ls-remote --heads --tags https://github.com/abhigyanpatwari/GitNexus.git` | Latest observed tag is `v1.6.5-rc.28`; no stable `v1.6.5` tag was observed. |
| `npm pack gitnexus@1.6.5-rc.28` source inspection | `dist/core/run-analyze.js` contains an incremental DB writeback path (`diffFileHashes`, `extractChangedSubgraph`, `computeEffectiveWriteSet`) and an `incrementalInProgress` crash-recovery flag. However, the RC still calls `runPipelineFromRepo(...)` before deciding incremental vs full DB writeback, so it does not avoid the full parse pipeline cost. |

Conclusion:

- The latest RC contains real graph-storage incremental work that stable `1.6.4` lacks, but it is still not an in-scope rescue for this plan: it is not a stable pin, the prior RC benchmark failed the current 3x ratio gate, and the source-visible design still runs the full parse pipeline before incremental DB writeback.
- This reinforces the closure posture: the current plan is completed only as diagnostic-only scope, and satisfying speed-backed opt-in requires a separate provider speed/pin plan.

## Duration Metric Audit

Date: 2026-05-14

This audit checks whether the failed speed-benefit gate is only an artifact of counting fixed readiness proof overhead (`status` / `query_probe`) in provider-level `timing.duration_ms`.

Latest corrected runs expose per-command durations in `command_results[]`:

| Attempt | Provider | B incremental bootstrap command | B full bootstrap command | Bootstrap-only ratio gate | Provider end-to-end gate |
| --- | --- | ---: | ---: | --- | --- |
| Attempt 4 lifecycle | code-review-graph | 1785ms | 6269ms | pass (`1785 <= 6269 / 3`) | fail (`2792 > 7270 / 3`) |
| Attempt 4 lifecycle | GitNexus | 14771ms | 12842ms | fail | fail |
| Attempt 5 intra-file | code-review-graph | 1681ms | 5964ms | pass (`1681 <= 5964 / 3`) | fail (`2625 > 6944 / 3`) |
| Attempt 5 intra-file | GitNexus | 13883ms | 13263ms | fail | fail |

Conclusion:

- The current validation doc uses provider end-to-end `timing.duration_ms`, which includes the readiness proof commands and matches the plan's "canonical readiness refresh" framing.
- Even under a narrower bootstrap-command-only interpretation, GitNexus still fails the ratio gate in corrected runs.
- Therefore changing the metric interpretation alone cannot make U4 pass for all enabled providers.

## Post-Audit Command Hardening

After the corrected selector run, an additional timing probe checked whether GitNexus output-side flags could plausibly change the speed-gate result. The probe used a disposable temp clone and recorded summarized timing only:

| Step | Command metadata | Duration |
| --- | --- | ---: |
| full with stable host-output flags | `npx -y gitnexus@1.6.4 analyze --force --skip-agents-md --no-stats` | 14017ms |
| incremental without stable host-output flags | `npx -y gitnexus@1.6.4 analyze` | 13781ms |

The probe did not complete a valid `incremental --skip-agents-md --no-stats` comparison because raw GitNexus `analyze` rewrote `AGENTS.md` / `CLAUDE.md` in the temp clone before the second probe commit, and the repo hook blocked continuation on the resulting diff. That finding is not a speed-gate pass; it motivated hardening the projected GitNexus full/incremental commands to include `--skip-agents-md --no-stats`, leaving stable host instruction updates under the existing spec-first `gitnexus-instruction normalize` owner.

### Stable GitNexus Host-Output Flags Follow-Up

Date: 2026-05-14

This follow-up closes the incomplete comparison above by running both GitNexus full and incremental commands with the projected stable host-output flags in a disposable temp clone with git hooks disabled for benchmark commits.

Disposable repo:

- temp repo path: `/tmp/spec-first-gitnexus-flags-speed.cFHmlM`
- source revision A: `c158ba18d204864732511ff66f224696f5e1d6d0`
- source revision B: `dfe44815547f51c9104323c99eee9f9f2bcf1936`
- controlled diff: B appended `graphFlagsProbeBeta`, which calls `graphFlagsProbeAlpha`, in `scripts/graph_flags_probe.js`
- host instruction diff after probe: none (`AGENTS.md` / `CLAUDE.md` unchanged)

Timing summary:

| Run | Command metadata | Exit | Duration |
| --- | --- | ---: | ---: |
| A full | `npx -y gitnexus@1.6.4 analyze --force --skip-agents-md --no-stats` | 0 | 13885ms |
| B incremental | `npx -y gitnexus@1.6.4 analyze --skip-agents-md --no-stats` | 0 | 14090ms |
| B full | `npx -y gitnexus@1.6.4 analyze --force --skip-agents-md --no-stats` | 0 | 13821ms |

Conclusion:

- The projected stable host-output flags prevent host instruction writes in this probe.
- The flags do not improve GitNexus stable incremental speed enough to affect U4: `14090ms` is not `<= 13821ms / 3`.
- This is not a full correctness benchmark; it is a speed-gate rescue probe. Speed rollout status remains unchanged.

### Stable GitNexus `--skip-git` Follow-Up

Date: 2026-05-14

This follow-up tests the remaining documented GitNexus stable option that could plausibly reduce wrapper overhead while preserving graph semantics when invoked from the repo root. It is still a speed-gate rescue probe, not a full U4 correctness benchmark.

Disposable repo:

- temp repo path: `/tmp/spec-first-gitnexus-skipgit-speed.5iHydV`
- source revision A: `2baf8b330d38828874f8588d5da199c04b762e5f`
- source revision B: `10e66ae1b821b1e65547422736fdefc4f68f3fb3`
- controlled diff: B appended `graphSkipGitProbeBeta`, which calls `graphSkipGitProbeAlpha`, in `scripts/graph_skipgit_probe.js`
- host instruction diff after probe: none (`AGENTS.md` / `CLAUDE.md` unchanged)

Timing summary:

| Run | Command metadata | Exit | Duration |
| --- | --- | ---: | ---: |
| A full | `npx -y gitnexus@1.6.4 analyze --force --skip-agents-md --no-stats --skip-git` | 0 | 13517ms |
| B incremental | `npx -y gitnexus@1.6.4 analyze --skip-agents-md --no-stats --skip-git` | 0 | 13381ms |
| B full | `npx -y gitnexus@1.6.4 analyze --force --skip-agents-md --no-stats --skip-git` | 0 | 13383ms |

Conclusion:

- `--skip-git` does not provide a material GitNexus stable incremental speedup in this repo-root probe.
- It does not affect the U4 decision: `13381ms` is not `<= 13383ms / 3`.
- No documented GitNexus stable CLI option tested so far can rescue the current plan's 3x speed gate.

### Stable GitNexus Source Inspection

Date: 2026-05-14

This follow-up inspected the published `gitnexus@1.6.4` npm package source after the stable CLI probes failed. It is not a benchmark, but it explains why the stable provider does not show a changed-commit graph speedup.

Inspection metadata:

- package: `gitnexus@1.6.4`
- unpacked source path: `/tmp/spec-first-gitnexus-src.CG49oY/package`
- inspected files: `dist/core/run-analyze.js`, `dist/cli/analyze.js`, `dist/cli/index.js`

Observed source behavior:

- `dist/cli/index.js` exposes `analyze [path]` options including `--force`, `--skip-agents-md`, `--no-stats`, `--skip-git`, file-size / worker-timeout options, and embedding options. It does not expose a changed-file graph update command or flag.
- `dist/core/run-analyze.js` has an early-return path only when prior metadata exists, `--force` is absent, and `existingMeta.lastCommit === currentCommit`.
- When the commit changed, stable `analyze` continues into `runPipelineFromRepo(repoPath, ...)`, then reloads LadybugDB and FTS indexes. This is a full graph pipeline path, not a changed-file graph update path.
- The source comments using "incremental" in this area refer to embedding cache preservation / generation for changed nodes, not provider graph parsing/indexing.

Conclusion:

- The speed-gate failure is consistent with stable GitNexus source behavior: for changed commits, `analyze` without `--force` still runs the full graph pipeline.
- There is no source-visible stable GitNexus graph-level incremental switch that can satisfy this plan's `B_incremental <= B_full / 3` gate while preserving the current full-readiness equivalence posture.
- A speed-backed expert opt-in is out of scope after the diagnostic-only plan revision; it requires a provider change or pin investigation outside this plan.

Speed rollout status remains unchanged: no corrected U4 attempt currently satisfies the minimum speed-benefit gate.

## Redaction Checklist

- raw stdout/stderr pasted: no
- provider raw logs pasted: no
- credentialed URL / token / API key / `Authorization:` / `Cookie:` included: no
- private registry URL included: no
- tracked absolute user home path included: no
- `redaction_checklist_completed`: yes

## Completion Audit Closure After Plan Revision

Date: 2026-05-14

This audit maps the revised plan requirements to current evidence. The original speed-backed opt-in gate failed; `docs/plans/2026-05-12-003-feat-graph-bootstrap-incremental-refresh-plan.md` was explicitly revised on 2026-05-14 to complete as a clean single-repo diagnostic / validation-only `--incremental` path, with speed-backed opt-in and provider speed/pin investigation deferred to follow-up work.

| Plan item | Current evidence | Completion status |
| --- | --- | --- |
| U0 extraction surface and benchmark helper | U0a/U0b sections above; `tests/benchmark/extract-graph-anchors.sh`; `tests/unit/graph-anchor-extraction-helper.test.js` | Implemented, with corrected GitNexus selector proof recorded |
| U1 provider incremental command projection | `skills/spec-mcp-setup/scripts/write-provider-config.sh`; `skills/spec-mcp-setup/scripts/write-provider-config.ps1`; mcp-setup contract tests | Implemented |
| U2 Bash refresh-mode implementation | `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`; `tests/unit/spec-graph-bootstrap.sh` | Implemented and contract-tested |
| U3 PowerShell parity | `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`; PowerShell parity contract tests | Implemented and contract-tested |
| R11 contract / validation docs | `docs/contracts/graph-provider-consumption.md`; `docs/contracts/graph-evidence-policy.md`; this validation document; `CHANGELOG.md` | Implemented with diagnostic-only rollout wording |
| Public README / user manual posture | README and user manual no longer mention `$spec-graph-bootstrap --incremental`; `tests/unit/graph-provider-consumption-contracts.test.js` guards this while speed gate remains failed | Corrected after audit |
| U4 correctness gate | Corrected selector runs prove already-indexed file node/edge capture, lifecycle add/delete + cross-file call equivalence, and intra-file signature/delete equivalence for both providers | Covered across split disposable runs; sufficient for diagnostic-only posture, not sufficient for speed-backed opt-in |
| U4 minimum speed-benefit gate | Corrected selector runs show CRG and GitNexus incremental durations do not satisfy `B_incremental <= B_full / 3` | Failed; speed-backed documented opt-in deferred |
| U4 speed claim gate | Minimum speed-benefit gate failed; cumulative incremental duration also exceeds 5s | Failed; no `~3-5s` claim |
| Provider speed escape hatch | Stable provider version and documented option probes above | No low-risk in-scope path found |
| Stable GitNexus host-output flags | Follow-up probe shows `--skip-agents-md --no-stats` prevents host instruction writes but B incremental `14090ms` is not `<= 13821ms / 3` | Does not rescue speed gate |
| Stable GitNexus `--skip-git` option | Follow-up probe shows B incremental `13381ms` vs B full `13383ms` with `--skip-git` | Does not rescue speed gate |
| Stable GitNexus source behavior | Published `gitnexus@1.6.4` source early-returns only when `lastCommit === currentCommit`; changed commits fall through to full graph pipeline | Explains why stable GitNexus cannot satisfy changed-commit 3x gate |
| GitNexus RC exploratory path | Out-of-scope `gitnexus@1.6.5-rc.28` probe above | Faster but still ratio-failing; first full checkpoint aborted once |
| Duration metric interpretation | Per-command `command_results[]` audit above | Metric reinterpretation cannot pass all enabled providers because GitNexus bootstrap-only timing still fails |

Completion decision after explicit plan revision:

- The implementation remains a clean single-repo diagnostic / validation-only path.
- The plan is now explicitly revised to that diagnostic-only deliverable and may be marked `status: completed`.
- Speed-backed documented opt-in, README/user-manual promotion, and any default switch remain blocked until a future follow-up satisfies the speed-benefit gate under stable provider pins or an explicitly reviewed provider speed/pin plan.
