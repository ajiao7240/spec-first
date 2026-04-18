# Epic Decomposition Capture

This content is loaded when Phase 0.3a determines the request should be decomposed into multiple sub-project brainstorms before detailed requirements capture.

Use this file only for epic-level decomposition. Do **not** treat it as the final requirements document for a single sub-project.

## When to Use It

Use decomposition when a single request spans multiple independent subsystems, operating surfaces, or user journeys such that planning would otherwise need to invent product structure.

The outcome of this step is:
- one epic decomposition document
- one chosen first sub-project
- a return to the normal `spec-brainstorm` flow for that first sub-project

## File Contract

Write the epic decomposition document to:

`docs/brainstorms/YYYY-MM-DD-<epic-slug>-decomposition.md`

Rules:
- `<epic-slug>` must be stable and kebab-cased
- The document frontmatter `topic` must exactly equal `<epic-slug>`
- If later sub-project requirements docs belong to this epic, they must use frontmatter `epic: <epic-slug>`

## Template

```markdown
---
date: YYYY-MM-DD
topic: <epic-slug>
type: epic-decomposition
---

# <Epic Title>

## Epic Goal
[One sentence describing the overall outcome]

## Sub-projects
| ID | Name | Responsibility | Depends on | Priority |
|----|------|----------------|------------|----------|
| SP1 | ... | ... | - | P0 |
| SP2 | ... | ... | SP1 | P1 |

## Build Order
SP1 -> SP2 -> ... [brief reason]

## Cross-cutting Concerns
- Authentication / authorization
- Data isolation
- Observability

## Open Questions
- ...

## Next Steps
-> Start `spec:brainstorm` for SP1
```

## Sub-project Requirements Contract

When you later write the requirements doc for a sub-project that belongs to this epic:

```markdown
---
date: YYYY-MM-DD
topic: <sub-project-slug>
epic: <epic-slug>
---
```

Rules:
- Frontmatter `epic` is the only structured source of truth for downstream planning
- Do not duplicate the epic slug in Key Decisions or freeform body text just to make it machine-readable
- `spec-plan` may look up `docs/brainstorms/*-<epic-slug>-decomposition.md` from this frontmatter value
- If multiple decomposition docs exist for the same slug, keep the slug stable so the latest dated file can be selected deterministically

## Interaction Guidance

During decomposition:
- Keep the epic document concise
- Focus on responsibilities, sequencing, and shared concerns
- Do not fully brainstorm every sub-project yet
- After writing the decomposition doc, ask which sub-project should go first and return to the normal brainstorm flow for that sub-project
