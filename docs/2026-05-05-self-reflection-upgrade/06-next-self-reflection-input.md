---
generated_at: 2026-05-05T05:50:09+08:00
source_commit: fa49220c2442c86d6082b1480a6641d66000adaa
branch: leo-2026-05-05-update-self
dirty_state: true
reviewed_inputs:
  - docs/2026-05-05-self-reflection-upgrade/00-summary.md
  - docs/2026-05-05-self-reflection-upgrade/04-capability-upgrade-decisions.md
  - docs/2026-05-05-self-reflection-upgrade/05-prioritized-roadmap.md
---

# Next Self-Reflection Input

## What To Inspect Next Cycle

Next cycle should inspect:

- Whether the CUD-001 through CUD-005 handoff in `docs/plans/2026-05-05-003-docs-self-reflection-contract-plan.md` stayed within docs-only scope.
- Whether `docs/contracts/workflows/self-reflection-capability-upgrade.md` actually made the next self-reflection cycle more comparable and reviewable.
- Whether review validated effectiveness instead of only format.
- Whether `CHANGELOG.md` and source links stayed synchronized.
- Whether compound captured real learnings after evidence.
- Whether graph/provider facts were refreshed or still degraded.
- Whether local references continued to influence decisions safely.

## What Evidence Was Missing This Cycle

- No fresh repo-wide `spec-skill-audit` run was executed.
- Original Cycle 0 did not run `spec-doc-review`; follow-up review evidence now lives at `docs/validation/2026-05-05-self-reflection-contract-doc-review.md`.
- Original Cycle 0 had no compound record; follow-up compound evidence now lives at `docs/solutions/workflow-issues/self-reflection-cud-contract-loop-2026-05-05.md`.
- No fresh `spec-graph-bootstrap` was run during Cycle 0.
- No runtime `spec-first doctor --codex|--claude` was run.
- External repositories were not cloned or tested; GitHub metadata and README/docs were used only as reference evidence.
- Local reference projects were only read with bounded search; their test suites were not run.

## What External Practices Need Re-check

| Practice | Re-check trigger |
|---|---|
| OpenAI/Anthropic skills docs | when spec-first considers skill packaging or hosted/local skill semantics |
| OpenAI eval best practices | when self-reflection CUD failures repeat and L3 eval is reconsidered |
| code-review-graph / GitNexus | when graph evidence is expected to influence review or planning |
| OpenSpec artifact graph | when CUD lifecycle fields become too informal |
| GSD gap closure plans | when review findings need to generate plan handoff systematically |
| pro-workflow self-correction memory | only if compound retrieval fails repeatedly |
| Superpowers plan handoff | when plan quality regressions appear |
| CodeStable accept/learn loop | when compound feedback lacks acceptance evidence |

## What Risks Remain Unresolved

- Report-only output can still become shelfware if not reviewed.
- Accepted L1/L2 CUDs can bloat docs if `spec-plan` does not aggressively minimize.
- Graph/provider staleness may hide code-level changes relevant to future cycles.
- External best-practice watchlist can grow without changing decisions.
- 30-cycle loop may become ceremony unless each cycle names what changed from the previous one.

## What Would Trigger Reconsideration

Reconsider skipped/deferred upgrades if:

- Three consecutive cycles fail to produce comparable CUD evidence.
- Accepted CUDs repeatedly vanish before review/compound.
- Manual evidence intake repeatedly misses stale or unsafe external practice.
- Future review finds self-reflection reports cannot be validated without structural tooling.
- Compound lessons are not retrieved by future plan/work/review despite being relevant.

## What Should Be Compounded As Pattern / Anti-pattern

Potential patterns:

- Evidence-backed CUD before upgrade.
- External practices are watchlist until linked to current gaps.
- Graph facts must carry freshness/trust labels.
- Plan handoff is advisory context, not implementation plan.
- Review and compound close the loop; a report alone does not.

Potential anti-patterns:

- Adding a new workflow because the prompt is long.
- Treating local reference projects as source truth.
- Treating generated runtime artifacts as source.
- Accepting a CUD with weak evidence.
- Using scripts to make semantic upgrade decisions.

## What Should Not Be Repeated

- Do not restart every cycle from the full target prompt if prior report artifacts exist.
- Do not rescan all local reference repos unless a new gap needs them.
- Do not include GitHub projects in roadmap without linked CG and Accepted CUD.
- Do not rerun graph/bootstrap just to improve a report unless graph evidence is required.
- Do not write implementation plans inside self-reflection reports.

## What Capability Should Remain Intentionally Not Upgraded

- `spec-evolve` command: intentionally not added.
- self-reflection agent profile: intentionally not added.
- automatic skill evolution / rewrite: intentionally not added.
- hidden memory runtime: intentionally not added.
- state-machine gate engine: intentionally not added.

## Next Cycle Prompt Seed

Use this as the next cycle input:

```text
Review docs/2026-05-05-self-reflection-upgrade/.

Check whether Accepted CUDs were handed to spec-plan, whether plan/review/compound feedback exists, and whether any Deferred item now has stronger evidence.

Do not add a new workflow by default.
Do not treat external practices as roadmap unless linked to a current capability gap and accepted by a CUD.
Classify graph/provider evidence freshness before using it.
Output changed gaps, changed CUDs, updated best-practice watchlist, updated roadmap, and next-cycle input.
```
