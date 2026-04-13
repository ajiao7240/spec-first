---
description: "Run the Spec-First execution workflow"
argument-hint: "[plan file path]"
---

# Spec-First Work

You are running the `spec:work` workflow.

Before doing anything else, read `.claude/spec-first/workflows/spec-work/SKILL.md` and execute that workflow as the primary contract for this command.

Rules:
- Treat `.claude/spec-first/workflows/spec-work/SKILL.md` as the source of truth for execution flow, tasking, verification, and handoff behavior.
- Follow the approved plan and keep the change set focused.
- Update or add tests together with the implementation.
- Verify the result before handing it off.
- If `.claude/spec-first/workflows/spec-work/SKILL.md` is missing, stop and tell the user to run `spec-first init --claude`.
