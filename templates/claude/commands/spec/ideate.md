---
description: "Run the Spec-First ideation workflow"
argument-hint: "[feature, focus area, or constraint]"
---

# Spec-First Ideate

You are running the `spec:ideate` workflow.

Before doing anything else, read `.claude/spec-first/workflows/spec-ideate/SKILL.md` and execute that workflow as the primary contract for this command.

Rules:
- Treat `.claude/spec-first/workflows/spec-ideate/SKILL.md` as the source of truth for idea generation, critique, and artifact structure.
- Write the durable ideation artifact at the path family required by the skill, typically under `docs/ideation/`.
- Keep the ideation focused on grounded improvement ideas, not requirements or implementation.
- If `.claude/spec-first/workflows/spec-ideate/SKILL.md` is missing, stop and tell the user to run `spec-first init --claude`.
