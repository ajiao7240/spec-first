# HTML Rendering Sidecar

This reference is for an optional HTML sidecar derived from a canonical markdown plan. It is not an exclusive output mode and does not make HTML a replacement source for `spec-work`, `spec-write-tasks`, or `spec-doc-review`.

Do not generate an HTML-only plan unless a future contract migration adds focused downstream consumer tests for HTML parsing, review, status updates, and task-pack handoff. Until then, write the markdown plan first and treat HTML as a human-readable sidecar.

## Sidecar Invariants

- The file is a single self-contained HTML5 document.
- CSS is inline in `<style>`; do not require external CSS or JavaScript for readability.
- The sidecar visibly names the canonical markdown plan path.
- Metadata is visible to humans. Do not create hidden machine-readable metadata that can drift from the markdown source.
- Stable IDs appear as visible text and as anchor IDs where useful.
- Prose remains authoritative when a visualization and prose disagree.

## Style Guidance

- Optimize for long-form reading, not full-bleed app UI.
- Keep prose width comfortable, roughly 65-80 characters per line.
- Let wide tables or diagrams use more horizontal space when needed.
- Prefer restrained typography, clear hierarchy, and high contrast over decorative styling.
- If project instructions or a repo-local design document provide document styling guidance, apply the compatible parts without making the sidecar depend on unavailable assets.

## Parity Gate

An HTML sidecar is acceptable only when it preserves the same section content, IDs, metadata meaning, scope boundaries, requirements, decisions, implementation units, and sources as the markdown plan. It may improve presentation, but it must not add or omit load-bearing content.
