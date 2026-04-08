---
description: "Run the Spec-First planning workflow"
argument-hint: "[requirements doc path or topic]"
---

# Spec-First Plan

You are running the `spec:plan` workflow.

Before doing anything else, read `.agents/skills/spec-plan/SKILL.md` and execute that workflow as the primary contract for this command.

Rules:
- Treat `.agents/skills/spec-plan/SKILL.md` as the source of truth for planning depth, research, file naming, and handoff behavior.
- Write or update the implementation plan at the path format required by the skill, typically `docs/plans/YYYY-MM-DD-NNN-<type>-<descriptive-name>-plan.md`.
- Do not write code in this step.
- If `.agents/skills/spec-plan/SKILL.md` is missing, stop and tell the user to run `spec-first init --codex`.
