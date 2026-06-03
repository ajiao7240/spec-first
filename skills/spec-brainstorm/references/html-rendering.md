# HTML Rendering Sidecar

This reference is for an optional HTML sidecar derived from a canonical markdown brainstorm requirements document. It is not an exclusive output mode and does not replace the markdown artifact consumed by `spec-plan` and `spec-doc-review`.

Do not generate an HTML-only requirements document unless a future contract migration adds focused downstream consumer tests for planning handoff, review, and artifact discovery. Until then, write the markdown requirements document first and treat HTML as a human-readable sidecar.

## Sidecar Invariants

- The file is a single self-contained HTML5 document.
- CSS is inline in `<style>`; do not require external CSS or JavaScript for readability.
- The sidecar visibly names the canonical markdown requirements path.
- Metadata is visible to humans. Do not create hidden machine-readable metadata that can drift from the markdown source.
- Stable IDs appear as visible text and as anchor IDs where useful.
- Prose remains authoritative when a visualization and prose disagree.

## Style Guidance

- Optimize for long-form reading and fast review.
- Keep prose width comfortable, roughly 65-80 characters per line.
- Use tables, callouts, and diagrams only when they improve comprehension.
- Prefer restrained typography, clear hierarchy, and high contrast over decorative styling.

## Parity Gate

An HTML sidecar is acceptable only when it preserves the same summary, problem frame, requirements, scope boundaries, assumptions, decisions, examples, IDs, metadata meaning, and sources as the markdown document. It may improve presentation, but it must not add or omit load-bearing content.
