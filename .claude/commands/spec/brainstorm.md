---
description: "Run the Spec-First brainstorm workflow"
argument-hint: "[feature idea or problem]"
---

# Spec-First Brainstorm

You are running the `spec:brainstorm` workflow.

Before doing anything else, read `.claude/skills/spec-brainstorm/SKILL.md` and execute that workflow as the primary contract for this command.

Rules:
- Treat `.claude/skills/spec-brainstorm/SKILL.md` as the source of truth for phases, artifact paths, and handoff behavior.
- If repository guidance such as `CLAUDE.md` conflicts with the workflow artifact path, follow the skill contract for this command.
- The durable artifact for non-trivial work is the requirements document described by the skill, typically under `docs/brainstorms/YYYY-MM-DD-<topic>-requirements.md`.
- Ask one focused question at a time when clarification is needed.
- Keep implementation details out unless the request is inherently technical.
- If `.claude/skills/spec-brainstorm/SKILL.md` is missing, stop and tell the user to run `spec-first init --claude`.
