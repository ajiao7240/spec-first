---
generated_at: 2026-05-05T05:50:09+08:00
source_commit: fa49220c2442c86d6082b1480a6641d66000adaa
branch: leo-2026-05-05-update-self
dirty_state: true
reviewed_inputs:
  - docs/2026-05-05-self-reflection-upgrade/04-capability-upgrade-decisions.md
  - docs/2026-05-05-self-reflection-upgrade/02-capability-gaps.md
  - docs/10-prompt/自我进化.md
---

# Prioritized Roadmap

This roadmap is based only on Accepted CUDs from Cycle 0. It is advisory plan input, not an implementation plan.

## Landed Follow-up

Cycle 0 follow-up completed the minimal docs-only handoff for CUD-001 through CUD-005:

- `docs/plans/2026-05-05-003-docs-self-reflection-contract-plan.md`
- `docs/contracts/workflows/self-reflection-capability-upgrade.md`
- `docs/validation/2026-05-05-self-reflection-contract-doc-review.md`
- `docs/solutions/workflow-issues/self-reflection-cud-contract-loop-2026-05-05.md`

The follow-up stayed docs-only and source-first. It did not add `spec-evolve`, a new agent, a script, a command, or generated runtime changes.

These items are no longer pending roadmap work:

1. Create or refine a lightweight self-reflection composition contract.
   - Completed by: `docs/contracts/workflows/self-reflection-capability-upgrade.md`.
   - Covers: report set, evidence intake, CUD, best-practice absorption, plan handoff, review validation, compound feedback, next-cycle input.
   - Linked CUD: CUD-001.

2. Add CUD feedback expectations to the self-reflection report pattern.
   - Completed by: the CUD contract, lifecycle vocabulary, plan handoff, review expectations, and compound expectations in the source contract.
   - Remains human-readable and advisory; no central state engine was added.
   - Linked CUD: CUD-003.

3. Standardize external/local evidence intake in prose.
   - Completed by: the Evidence Intake table and rules in the source contract.
   - Include source type, freshness, evidence quality, counter-signal, linked gap, decision.
   - Linked CUD: CUD-002.

4. Require graph/provider evidence classification in self-reflection reports.
   - Completed by: the Provider Freshness Classification section in the source contract.
   - Use `current`, `stale`, `partial`, `definitions-only`, `unavailable`, `not-used`.
   - Require fallback evidence for degraded states.
   - Linked CUD: CUD-004.

5. Bind fresh-source eval expectation to CUDs that change skill/agent/workflow prose.
   - Completed by: the Review Expectations section in the source contract.
   - Do not require fresh-source eval for pure report-only artifacts.
   - Linked CUD: CUD-005.

## Remaining / Future

No additional implementation is recommended yet.

Possible future P2, only after review/dogfood:

- Minimal structural verifier for self-reflection report completeness.
- Lightweight fixture for CUD traceability.
- Graph metadata freshness helper if provider staleness repeats.

These remain outside the Cycle 0 Accepted implementation scope unless `spec-plan` narrows and justifies them.

## P3

No P3 implementation is recommended in this cycle.

Possible future P3 watchlist:

- Macro release-readiness audit for self-upgrade cycles.
- Best-practice watchlist refresh automation.
- Evolution memory index.

None of these should be built without repeated evidence from the 30-cycle loop.

## Not Doing

- No `spec-evolve`.
- No new self-reflection agent.
- No auto-rewrite system.
- No runtime workflow engine.
- No SQLite memory layer.
- No mandatory external GitHub mining script.
- No machine semantic judge deciding Accepted/Skipped/Deferred.
- No generated runtime patching.

## Dependencies

- Any source change requires `CHANGELOG.md`.
- Any skill/agent prose change requires source-first edit and fresh-source eval when semantic behavior matters.
- Any runtime regeneration must use `spec-first init --claude|--codex`, only after source validation and only if runtime drift repair is in scope.
- Any script/eval work must keep scripts to deterministic facts only.

## Verification Expectations

Commands discovered:

- `npm run lint:skill-entrypoints`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:smoke`
- `npm run test:integration`
- `npm test`
- `npm run test:mcp-setup`
- `npm run test:graph-bootstrap`

Commands run in Cycle 0:

- git metadata commands
- package script discovery
- source and artifact discovery commands
- web/GitHub/local reference discovery commands

Commands not run:

- `npm run lint:skill-entrypoints`
- `npm run typecheck`
- `npm test`
- `spec-first doctor --codex`
- `spec-first doctor --claude`

Reason:

- Cycle 0 is report-only and changed docs/changelog only.
- No implementation, skill source, CLI source, runtime generation, or tests were changed in the self-upgrade implementation sense.

Manual verification needed:

- Confirm all 8 report files exist.
- Confirm no files outside allowed report directory were changed except required `CHANGELOG.md` and pre-existing target prompt fix.
- Confirm roadmap items trace only to Accepted CUDs.
