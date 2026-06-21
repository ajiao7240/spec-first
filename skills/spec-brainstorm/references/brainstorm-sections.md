# Brainstorm Sections

This reference describes what a spec-first brainstorm requirements document contains. It does not prescribe page styling. Canonical markdown rendering lives in `markdown-rendering.md`; optional HTML sidecar guidance lives in `html-rendering.md`.

Current posture: Markdown requirements documents remain canonical for `spec-plan`, `spec-doc-review`, and future planning handoff. `requirements-capture.md` remains the concrete markdown template and readiness gate. Do not replace or delete it until every downstream consumer has focused tests for the replacement.

## Outcome

A strong brainstorm document enables three audiences to act:

- The planning agent or human can produce an implementation plan without inventing product behavior, scope boundaries, or success criteria.
- The reviewer can see framing choices, distinguish confirmed decisions from assumptions, and catch scope gaps before implementation planning.
- A future reader can trace why the proposed work matters, who it serves, and what success means.

Sections earn their place by serving one of those audiences. Omit padding.

## Prose Economy

Prose economy is artifact quality, not a style linter. Use it to make live decisions easier for `spec-plan`, reviewers, and future readers to find.

- One sentence carries one idea.
- One requirement carries one intent plus at most one necessary qualifier.
- Move unresolved forks to `Outstanding Questions`; do not bury them inside a requirement.
- Cut hedges, intensifiers, transcript residue, and process narration that do not change behavior, scope, evidence, or handoff.
- Prefer verbs over nominalizations when the requirement describes behavior.
- Resolve superseded text in place instead of layering "updated", "instead", or "actually" notes.
- Precision is not padding: keep exact IDs, actor names, thresholds, domain terms, conditions, and source-backed constraints when they affect planning.

## Decide Whether A Document Is Warranted

Skip durable document creation only when the user needs brief alignment and no durable decisions, scope boundaries, or acceptance criteria need to survive into planning, commits, or `docs/solutions/`.

Write a requirements document when the dialogue produced structural decisions, user-facing behavior, scope boundaries, acceptance examples, or unresolved questions that downstream consumers need in stable form.

## Hard Floor

When a brainstorm document is warranted, include:

- **Summary** - 1-3 lines stating what is being proposed.
- **Requirements** - stable R-IDs when downstream planning or review will reference them.
- **Scope Boundaries** - explicit non-goals or deferred areas when they affect planning.

Sparse Lightweight documents may collapse some sections when the bullets themselves are the summary. Standard and Deep documents should keep the sections explicit.

## Include When Material

- **Problem Frame** - why this proposal exists.
- **Assumptions** - unconfirmed inferred bets in headless or non-interactive runs.
- **Actors** - humans, agents, systems, or roles whose perspective changes the behavior.
- **Key Flows** - multi-step behavior with trigger, actors, outcome, and requirement coverage.
- **Acceptance Examples** - state-dependent or conditional behavior that prose alone could leave ambiguous.
- **Success Criteria** - human outcome, handoff quality, or measurable success not already covered by requirements.
- **Key Decisions** - pinned framing choices that constrain requirements or later planning.
- **Dependencies / Assumptions** - material dependencies or load-bearing assumptions.
- **Outstanding Questions** - split product blockers from planning-owned or research-owned unknowns.
- **Sources / Research** - only breadcrumbs that help the planner or reviewer, not process exhaust.
- **Visualizations** - diagrams when a picture makes a relationship, lifecycle, flow, comparison, or source-of-truth shape faster to understand.

## Metadata Fields

Brainstorm metadata is format-independent. In canonical markdown it appears in YAML frontmatter.

Required:

- `date` - creation date in `YYYY-MM-DD`.
- `topic` - kebab-case topic slug used for discovery and filename construction.
- `spec_id` - local spec-chain identity when the brainstorm feeds planning.

Brainstorm artifacts have no `active` to `completed` status lifecycle. Do not add a `status` field just because plan artifacts have one.

## ID And Content Rules

- Use stable visible prefixes such as `R1.`, `A1.`, `F1.`, and `AE1.`.
- Do not renumber IDs to clean up gaps.
- Requirements group by concern when distinct concerns exist.
- Diagrams complement prose; IDed text remains complete without them.
- Generated documents use repo-relative paths only.

## Rendering Boundary

Section content and rendering are separate decisions:

- `brainstorm-sections.md` defines what the requirements document contains.
- `requirements-capture.md` remains the concrete canonical markdown template and readiness gate.
- `markdown-rendering.md` defines markdown presentation rules.
- `html-rendering.md` defines optional HTML sidecar rules only. It is not an exclusive output mode and not a replacement for markdown planning handoff.
