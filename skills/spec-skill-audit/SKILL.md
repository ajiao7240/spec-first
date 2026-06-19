---
name: spec-skill-audit
description: Audit agent skills for trigger precision, scope boundaries, input/output contracts, workflow quality, progressive disclosure, eval readiness, safety, maintainability, and runtime governance. In spec-first repositories, also audit source skills, dual-host governance, generated runtime drift, and alignment with spec-first workflow principles. Do not use for installing third-party skills, creating new skills, or general code review.
argument-hint: "[target skill path or audit options]"
---

# Skill Audit

Audit agent skills as engineering protocols, not just prompt files.

## Invocation Boundary

This workflow is a source-quality auditor for skill assets. It reviews deterministic facts first, then asks the LLM to judge the semantic implications with evidence.

Do not invoke it through Agent/Task/subagent primitives. Use the current host's skill-audit entrypoint when the user wants a public workflow run.

## Workflow Contract Summary

### When To Use

Use when the user wants to audit skill source quality, workflow boundaries, public-surface governance, progressive disclosure, eval readiness, or runtime drift risk.

### When Not To Use

Do not use to install/create skills, perform ordinary code review, mine remote skill repositories, rewrite source automatically, or patch generated runtime mirrors. External methodology research belongs in a separate future workflow such as `spec-skill-mining`.

### Inputs

Target skill/path or audit options, deterministic release/governance guard results, skill/agent source, dual-host governance data, runtime/catalog facts, and repository role contracts.

### Outputs

Skill audit findings with trigger/boundary/contract/progressive-disclosure/runtime governance evidence, confidence, suggested action, and residual risk.
For spec-first self audits, also surface rule-maturity observation health facts when the local evidence file exists.

### Artifacts

Audit reports or patch-preview suggestions when explicitly requested; generated runtime mirrors remain evidence only, not source fixes.

### Failure Modes

Missing target source, unreadable governance/catalog facts, stale runtime evidence, ambiguous scope, unavailable deterministic guards, or unsafe generated-runtime edits.

### Workflow

Collect deterministic facts, inspect source skills/references/tests, compare public surface and runtime boundaries, apply semantic skill-quality judgment, and report prioritized findings.

### Downstream Consumers

`spec-work`, `spec-code-review`, release governance, skill maintainers, runtime setup/update decisions, and humans deciding remediation priority.

## Scenario Capability

Follows `docs/contracts/workflows/scenario-capability-matrix.md` (default).
Overrides: none

## Purpose

Use this workflow to make skill debt visible before it turns into workflow debt.

It reviews:

- source `SKILL.md` files
- skill directory structure
- trigger clarity
- scope boundaries
- input and output contracts
- workflow steps
- scripts, references, examples, assets, and eval organization
- failure modes
- eval readiness
- instruction and script safety
- runtime governance

In a spec-first repository, it also checks:

- `skills/` as the source of truth
- dual-host governance entries
- Claude/Codex delivery expectations
- generated runtime drift
- alignment with the spec-first principle: scripts prepare deterministic facts, LLMs make semantic judgments

## Progressive Disclosure Checks

Treat skill entry prompts as progressive-disclosure surfaces. Flag source skills whose main `SKILL.md` entrypoint carries long examples, duplicate rubrics, provider-specific details, large checklists, or operational reference material that should live in `references/`, `scripts/`, `assets/`, or eval files. The finding is an optimization/risk signal, not an automatic rewrite order.

Audit facts may identify public-surface or runtime drift, but scripts only report deterministic evidence. The LLM explains whether the drift affects governance, catalog, README/user-doc visibility, or source/runtime boundaries. Hard dependency gaps should point to setup/doctor/init repair commands; soft context gaps only lower confidence.

## Inputs And Outputs

Default input is the current spec-first repository root; optionally one local skill directory under `skills/`. This workflow does not accept remote repositories, package names, or marketplace identifiers. See the `### Inputs` / `### Outputs` summary above for the contract, the `## Workflow` CLI options below for invocation flags, and `references/report-format.md` for the full output-file set and the gitignored-artifact rule.

This workflow is an explicit exception to the ordinary runtime context exclusion in `docs/contracts/context-governance.md`: it may read `.spec-first/audits/skill-audit/**` for the current audit summary, scorecard, and drift evidence. For repo-wide spec-first audits it may also read `.spec-first/governance/rule-maturity.json` to write `rule-maturity-observations.json`; that artifact reports periodic governance health facts and does not trigger human review, adjudication, or promotion. Other workflows should treat `.spec-first/audits/**` and `.spec-first/governance/**` as excluded runtime artifacts unless the user names a precise path or the task is explicitly about audit/runtime/governance evidence.

## Workflow

1. Confirm the target is local. Default to the current repository's `skills/`.
2. Run deterministic fact collection:

   ```bash
   node skills/spec-skill-audit/scripts/write-audit-artifacts.js --repo .
   ```

3. If the user asked for runtime checks, include runtime drift:

   ```bash
   node skills/spec-skill-audit/scripts/write-audit-artifacts.js --repo . --runtime
   ```

4. If the user explicitly asked for patch preview, include preview artifacts:

   ```bash
   node skills/spec-skill-audit/scripts/write-audit-artifacts.js --repo . --patch-preview
   ```

5. If the user targets one source skill, pass the target explicitly:

   ```bash
   node skills/spec-skill-audit/scripts/write-audit-artifacts.js --repo . --target skills/<skill-name>
   ```

6. Read `skill-audit-summary.md`, `skill-improvement-plan.md`, and the JSON reports relevant to the user's question. For repo-wide spec-first source audits, read `reviewer-guard-coverage-report.json` before judging reviewer-agent guard completeness, and read `rule-maturity-observations.json` before judging whether rule-maturity evidence is empty, degraded, or awaiting later human adjudication.
7. Review the deterministic findings and reviewer guard coverage facts using `references/expert-audit-rubric.md`.
8. Security matches inside an audited skill's own `evals/`, `examples/`, or `references/` are expected `scope_limited` fixtures (see `references/security-threat-model.md`): treat them as counter-evidenced P3 noise and do not surface them as review items unless an executable code path actually performs the action.
9. Treat scorecards as signals, not gates.
10. For each P0/P1 finding you surface to the user, include signal, file/section evidence, counter-evidence status, decision, reason, recommendation, and confidence.
11. Do not modify source files unless the user separately asks to apply a specific fix.

### Advanced Options

Two additional flags are accepted by `write-audit-artifacts.js` and are documented here for contract completeness:

- `node skills/spec-skill-audit/scripts/write-audit-artifacts.js --repo . --no-governance` skips the governance-drift checks during a repo-wide self audit. `governance-drift-report.json` is still written, but its body records a skipped status rather than drift findings.
- `node skills/spec-skill-audit/scripts/write-audit-artifacts.js --repo . --run-id <name>` overrides the run-directory name under `.spec-first/audits/skill-audit/` instead of the default timestamped directory. Use it for reproducible or test runs.

## Governance

This workflow is read-only by default with respect to reviewed source and runtime assets.

It may write audit reports under:

- `.spec-first/audits/skill-audit/`

It must not modify these paths without explicit user confirmation:

- `skills/`
- `agents/`
- `templates/`
- `src/cli/contracts/`
- `.claude/`
- `.codex/`
- `.agents/skills/`

Generated runtime assets must be repaired by rerunning `spec-first init` with the target host selected, not by hand-editing generated copies.

Deterministic failure reason codes (`NO_SKILLS_FOUND`, deferred generic-collection audit, governance-validation-fails, runtime `not_initialized`, runtime drift) and their handling live in `references/report-format.md`; the `### Failure Modes` summary above states the contract.

## References

Use these files only when needed:

- `references/expert-audit-rubric.md`
- `references/report-format.md`
- `references/security-threat-model.md`
- `references/source-vs-runtime-contract.md`
