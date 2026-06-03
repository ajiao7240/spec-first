# Markdown Rendering

This reference describes how to render canonical markdown brainstorm requirements documents. Pair it with `brainstorm-sections.md`, which defines what the document contains, and `requirements-capture.md`, which remains the concrete markdown template.

## Hard Invariants

- YAML frontmatter appears at the top and carries `date`, `topic`, and `spec_id` when applicable.
- File paths are repo-relative, never absolute.
- Markdown stays markdown. Do not mix in HTML layout, inline CSS, or hidden metadata.
- Stable IDs appear as visible plain prefixes, not bolded prefixes.
- The document remains readable in raw text and stable in diffs.

## Format Principles

- Use prose for Summary, Problem Frame, decision rationale, and assumptions.
- Use bullets for requirements, actors, flows, acceptance examples, scope boundaries, and open questions.
- Use bold leader labels inside bullets for structured flow fields such as `**Trigger:**`, `**Actors:**`, `**Steps:**`, `**Outcome:**`, and `**Covered by:**`.
- Use tables only for genuinely comparative or uniform-shape data where a table improves scanning.
- Group Requirements under bold inline concern labels when they span distinct concerns; keep R-IDs continuous across groups.
- Use horizontal rules between top-level H2 sections for Standard and Deep documents; omit for compact Lightweight documents.

## Diagrams

When visual communication is warranted, markdown renders diagrams as fenced Mermaid or as simple tables plus prose. A diagram is an on-ramp to the prose it illustrates, not a substitute for requirements, decisions, or acceptance examples.

## Post-Write Audit

Before declaring the markdown requirements document complete, scan for:

- required frontmatter fields;
- plain stable ID prefixes;
- repo-relative paths only;
- no HTML elements or hidden metadata;
- no process exhaust or next-workflow instructions in the artifact body;
- confirmed decisions, inferred assumptions, and out-of-scope items kept distinct;
- behavioral-conditional requirements covered by acceptance examples.
