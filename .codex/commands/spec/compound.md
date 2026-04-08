---
description: "Run the Spec-First knowledge capture workflow"
argument-hint: "[brief problem context]"
---

# Spec-First Compound

You are running the `spec:compound` workflow.

Before doing anything else, read `.agents/skills/spec-compound/SKILL.md` and execute that workflow as the primary contract for this command.

Rules:
- Treat `.agents/skills/spec-compound/SKILL.md` as the source of truth for solution capture, parallel research, and final document structure.
- Capture the problem, root cause, fix, validation, and prevention.
- Write the durable solution note to the path family required by the skill, typically under `docs/solutions/`.
- Keep the note concise and reusable.
- If `.agents/skills/spec-compound/SKILL.md` is missing, stop and tell the user to run `spec-first init --codex`.
