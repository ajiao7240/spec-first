# Markdown Rendering

This reference describes how to render the canonical markdown plan. Pair it with `plan-sections.md`, which defines what the plan contains.

## Hard Invariants

- YAML frontmatter appears at the top of the file and carries the plan metadata contract.
- File paths are repo-relative, never absolute.
- Markdown stays markdown. Do not mix in `<div>`, inline `<style>`, hidden HTML metadata, or HTML-only layout.
- Stable IDs appear as visible plain prefixes, not bolded prefixes.
- The document remains useful in raw text diffs.

## Format Principles

- Use prose for narrative context and rationale.
- Use bullets for parallel items that need short explanation.
- Use tables only when several items share a uniform structure and the table improves scanning.
- For Standard or Deep plans with material choices, place `## Decision Brief` immediately after `## Summary` as visible Markdown. Keep it short and raw-diff friendly; use it to summarize the recommended approach, key decisions, validation focus, and largest risks before the detailed sections.
- Use H3 headings for implementation units: `### U1. [Name]`.
- Use bold leader labels inside bullets for structured subfields such as `**Goal:**`, `**Files:**`, `**Test scenarios:**`, or flow fields.
- Use horizontal rules between top-level H2 sections for Standard and Deep plans; omit them for compact Lightweight plans.

## Diagrams

When a visualization helps, markdown renders it as fenced Mermaid or as a table plus prose when Mermaid is not appropriate. Diagrams complement prose and never replace IDed requirements, decisions, or unit descriptions.

Use `flowchart TB` as the default direction for simple flowcharts because it stays readable in narrow rendered views.

## Post-Write Audit

Before declaring the markdown plan complete, scan for:

- required frontmatter fields;
- plain stable ID prefixes;
- repo-relative paths only;
- no HTML elements or hidden metadata;
- any material `## Decision Brief` summarizes lower sections without replacing requirements, decisions, evidence, or implementation units;
- no `## Next Steps` or phase/process exhaust;
- feature-bearing units with test scenarios or an explicit non-behavioral test expectation;
- links and sources that help implementation or review rather than restating the workflow.
