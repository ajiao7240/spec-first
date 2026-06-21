# Evaluation And Governance Status

Deferred governance detail for `spec-brainstorm`. The `SKILL.md` entry keeps only route-critical trigger, output, and reference-routing guidance.

## Maturity

Current posture: production, team-reused workflow command.

This package is not governed-ready and not public-claim-ready. Do not claim governed status until trust, output-quality, blind holdout, and reviewer-scored output evidence exists.

Owner: Spec-First maintainers.

Review cadence: per release, or whenever trigger, routing, requirements artifact, or handoff contracts change.

## Eval Status

`skills/spec-brainstorm/evals/routing-cases.json` is examples-as-context for trigger and near-neighbor route-out coverage. It is structural fixture evidence, not a deterministic router and not semantic output-quality proof.

Focused Jest tests check the source package contract, route-out reason code lockstep, and canonical eval fixture shape. These are file-backed fixture checks, not provider-backed model execution.

LLM judgment still owns route choice, question selection, evidence sufficiency, scope synthesis, product tradeoff evaluation, and downstream handoff judgment.

## Governed-Package Evidence Labels

- `file-backed fixture`: current evidence includes the canonical routing fixture and focused Jest contract tests.
- `input_files`: user prompt, optional existing brainstorm or requirements document, repo source/docs read during context scan, and user decisions gathered during dialogue.
- `output contract`: right-sized requirements document, brief alignment summary, route-out shape, or planning handoff summary.
- `rollback boundary`: source-only changes here; generated runtime mirrors refresh through `spec-first init`.
- `trust report`: `missing evidence`.
- `reports/output_quality_scorecard.md`: `missing evidence`.

## Promotion Boundary

Treat routing fixtures and focused contract tests as readiness evidence only. They do not replace fresh-source eval, blind output review, or human-owner acceptance for semantic quality claims.

Do not add a per-skill `manifest.json` unless spec-first adopts that as a source truth; lifecycle delivery currently lives in the dual-host governance contract.
