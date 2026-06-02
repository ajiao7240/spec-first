# Spec-PRD Intent Routing

Load this reference during Phase 0.

## Public Intent Model

`spec-prd` has one public workflow and three internal intents:

| Intent | Use when | Output |
| --- | --- | --- |
| `create` | The user has a brownfield increment, one-line requirement, or rough change request for an existing system. | New PRD-grade requirements under `docs/brainstorms/*-requirements.md`, or a compact bypass/handoff when full PRD ceremony is wasteful. |
| `refine` | The user provides an existing PRD or low-quality requirements draft and asks to improve, complete, or make it planning-ready. | Updated PRD, structured gap list, or minimal blocking questions. |
| `validate` | The user asks whether a PRD is ready for plan/work, or wants code-aware validation of PRD claims. | Readiness report, contradictions, missing evidence, and handoff recommendation. |

`code-align` is not a fourth intent. Treat source/code alignment as validation posture. It may produce mismatch findings, but it does not create a separate public workflow or command.

## Input Mode Table

| Input mode | Detection | Handling |
| --- | --- | --- |
| Existing PRD requirements draft | Markdown with frontmatter `artifact_kind: prd-requirements`. | Resume in place when requested, preserve `spec_id`, preserve existing R/AE/BR/NFR IDs, and continue numbering from the maximum existing ID. |
| Other Markdown reference | Markdown without PRD frontmatter, meeting notes, screenshots text, raw product notes. | Treat as reference input; extract claims, gaps, and assumptions before producing PRD-grade requirements. |
| Plan/design/task handoff | Frontmatter or content indicates implementation plan, design, task pack, issue, or execution checklist. | Do not treat it as PRD. Hand off to plan/work/task flow or ask whether the user wants a PRD rebuilt from it. |
| Pure text create | One-line or paragraph increment with existing-system anchor. | Create a right-sized PRD after current-state analysis and minimal owner questions. |
| No input | Blank argument. | Ask for the target increment or existing PRD path. |

## Lightweight Bypass

Full PRD ceremony is often too heavy for:

- obvious bug fixes with reproduction and expected behavior already clear
- small scripts or docs-only edits
- implementation-ready tasks with a settled plan
- already approved technical方案 where PRD would only restate known scope

In these cases, offer one concise route:

- compact PRD if a durable WHAT record is still useful
- current host's plan workflow if HOW is the missing piece
- current host's work workflow if execution is already ready

## Tie-Break Rules

- 0-1 product idea, unclear actor, unresolved product identity, or "what should we build" -> current host's brainstorm or ideation workflow.
- Brownfield increment with existing product/system anchor -> PRD workflow.
- Existing PRD path plus "完善/优化/补齐/ready for planning" -> PRD refine or validate.
- PRD/Figma/source/route/analytics/i18n consistency audit -> App consistency audit workflow, not PRD authoring.
- Existing implementation plan or task pack ready to execute -> work workflow.

## Split-Decision Gate

Use split-decision when the input is an oversized initial PRD or multi-module feature with cross-surface ownership, multiple independent release tracks, or more than one coherent PRD scope.

The LLM may recommend semantic split boundaries using source input, existing docs, code, and directly inspected evidence. Tools provide facts; the product owner confirms the actual split boundary, priority, and release order.

Only after owner confirmation may the workflow write:

- a split summary PRD requirements artifact
- child PRD requirements artifacts
- by-reference links back to the original PRD/source input

Do not create extra grouping directories, manifest files, integration-contract files, trace-ledgers, or external task topologies.
