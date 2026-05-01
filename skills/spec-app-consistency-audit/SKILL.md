---
name: spec-app-consistency-audit
description: Audit mobile App consistency across PRD, Figma, local source, page routes, KMP/Clean Architecture, components, analytics, i18n, engineering quality, and industry rule packs before runtime validation.
argument-hint: "[prd path] [source path] [figma context or options]"
---

# App Consistency Audit

Run a static-first consistency audit for mobile App work before simulator, real-device, or package validation.

## Purpose

Use this workflow to compare product intent, design states, page routes, KMP / Clean Architecture boundaries, App engineering quality, component and module reuse, analytics, i18n, and industry-specific rules from the available local inputs.

The workflow improves review input quality. It does not replace runtime verification, automated tests, QA, or real-device validation.

## When To Use

Use this workflow when:

- App PRD, Figma context, or local source exists and cross-source consistency matters.
- Android / iOS behavior may drift.
- KMP shared logic, Clean Architecture boundaries, page routes, or navigation contracts need review.
- Loading, empty, error, permission, confirmation, rollback, or weak-network states need static review.
- Analytics, i18n, accessibility, component reuse, or industry-specific risks should be surfaced before QA.

## When Not To Use

Do not use this workflow when:

- The user only wants to run tests, lint, build, simulator, or real-device checks.
- There is no PRD, Figma context, or source input to inspect.
- The task is only code formatting or a mechanical refactor.
- The user wants this workflow to edit product code or project standards directly.

## Default Mode

Default to `static_only`.

Do not start a simulator, real device, package build, Appium, Maestro, cloud device run, or equivalent runtime workflow unless the user explicitly asks for that follow-up.

## Source And Runtime Boundaries

Source truth for this workflow lives in the repository source tree: the app-audit skill source, the Claude command template, the dual-host governance contract, and the project docs.

Generated runtime assets are not source truth:

- `.claude/`
- `.codex/`
- `.agents/skills/`

Do not hand-edit generated runtime assets. Runtime refresh belongs to the host-specific `spec-first init` invocation.

## Expert Prompt Boundary

App-audit experts and ECC-derived lenses are skill-local prompt assets:

```text
skills/spec-app-consistency-audit/prompts/
```

Do not copy app-audit-specific experts or ECC-derived lenses into `agents/` during MVP implementation. `agents/` is reserved for cross-workflow stable generic experts.

ECC-derived content may be used only as read-only lens, checklist, or evidence pattern material. It must not bring write, edit, repair, build, cleanup, or final-verdict authority into this workflow.

## Workflow

1. Run preflight and record degraded modes.
2. Extract product contract from PRD or equivalent product input.
3. Extract Figma design contract when Figma context is available.
4. Extract codebase contract from local source.
5. Extract page route contract.
6. Extract KMP / Clean Architecture contract.
7. Extract App engineering-quality candidate facts.
8. Extract component, module, reuse, interaction, analytics, and i18n contracts.
9. Build industry profile as preview-only advisory input.
10. Select rule packs as rationale context, not project facts.
11. Run expert review with evidence-backed issue output.
12. Apply evidence gate.
13. Generate final report, regression suggestions, and writeback preview.

## Figma MCP Materialization

Figma extraction consumes a local JSON context file. A Figma node or file reference is not the same as an extractable context.

If the user provides a Figma node/file reference rather than `--figma-context`:

1. Use the available host Figma MCP tool to fetch the design context.
2. Write the normalized raw MCP response to:

   ```text
   .spec-first/app-audit/input/figma-context.json
   ```

3. Run `extract-figma-contract.js` with:

   ```bash
   node skills/spec-app-consistency-audit/scripts/extract-figma-contract.js \
     --source . \
     --figma-context .spec-first/app-audit/input/figma-context.json \
     --output .spec-first/app-audit/figma-design-contract.json
   ```

Do not mark Figma design evidence as materialized until the local context JSON exists and is readable. Preflight distinguishes `has_figma_reference` from `has_figma_materialized_context`.

## Figma Redaction Policy

Default to `--redaction internal`.

- `strict`: keep only hashes and metadata; omit raw labels and text.
- `internal`: keep short non-sensitive screen, component, and text labels for PRD/Figma/Code matching; hash every label.
- `none`: keep full labels/text only when the user explicitly allows it.

Do not retain long text or sensitive-looking text by default.

## Outputs

Default outputs are local audit artifacts that separate final review results from preview-only writeback suggestions.

The final report should include evidence-backed consistency issues, degraded-mode notes, runtime-verification recommendations, real-device follow-ups, and regression suggestions.

Preview-only writeback outputs may be written under:

```text
.spec-first/app-audit/writeback-preview/repo-profile.patch.yaml
.spec-first/app-audit/writeback-preview/suggested-standards.md
```

These outputs do not modify product source, generated runtime assets, durable project standards, or `.spec-first/specs/repo-profile.yaml` unless the user explicitly confirms a separate apply step.

## Evidence Policy

No evidence, no issue.

Confirmed issues must cite at least one project-specific evidence source such as PRD, Figma, code, route, architecture, analytics, i18n, or extracted contract evidence.

Rule packs can explain risk and rationale, but they cannot be the only evidence for a confirmed project issue.

## Issue Protocol

Every issue must include:

- `static_confirmed`
- `requires_runtime_verification`
- `requires_real_device`
- `contract_status`
- `confidence`
- `provenance`

Weak evidence may be reported as risk, candidate, or follow-up. It must not be promoted to a confirmed issue.

## Writeback Policy

Default to preview-only writeback.

Allowed preview outputs include:

```text
.spec-first/app-audit/writeback-preview/repo-profile.patch.yaml
.spec-first/app-audit/writeback-preview/suggested-standards.md
```

Do not modify `.spec-first/specs/repo-profile.yaml` or other durable standards unless the user explicitly confirms apply behavior.

## Implementation Assets

Deterministic helpers live under:

```text
skills/spec-app-consistency-audit/scripts/
```

Use scripts for preflight, artifact validation, contract extraction, industry profiling, rule-pack selection, evidence gating, and report assembly. Scripts produce structured candidate or preview artifacts; LLM experts make semantic judgments.

Expert prompts and supporting lenses live under:

```text
skills/spec-app-consistency-audit/prompts/
```

Rule packs live under:

```text
skills/spec-app-consistency-audit/rule-packs/
```
