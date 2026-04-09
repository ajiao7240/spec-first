---
description: "Run the Spec-First graph bootstrap validation workflow"
argument-hint: "[target repo path or context slug]"
---

# Spec-First Graph Bootstrap

You are running the `spec:graph-bootstrap` workflow.

Before doing anything else, read `.claude/skills/spec-graph-bootstrap/SKILL.md` and execute that workflow as the primary contract for this command.

Rules:
- Treat `.claude/skills/spec-graph-bootstrap/SKILL.md` as the source of truth for current-stage behavior.
- This is a Stage-0 parallel validation entry. It does not replace `spec-bootstrap`.
- Stage 1 only guarantees install, discovery, and minimal invocation. Do not pretend graph-informed bootstrap is already implemented.
- If the user needs production Stage-0 project context generation today, direct them to `spec-bootstrap`.
- If `.claude/skills/spec-graph-bootstrap/SKILL.md` is missing, stop and tell the user to run `spec-first init --claude`.
