---
description: "Run the Spec-First update and runtime repair workflow"
argument-hint: "[check|repair]"
---

# Spec-First Update

You are running the `spec:update` workflow.

Before doing anything else, read `.claude/spec-first/workflows/spec-update/SKILL.md` and execute that workflow as the primary contract for this command.

Rules:
- Treat `.claude/spec-first/workflows/spec-update/SKILL.md` as the source of truth for CLI version checks, runtime drift diagnosis, and repair guidance.
- Check both the installed CLI version and any managed runtime present in the current project.
- Prefer `spec-first init --claude|--codex` for stale runtime repair, and `spec-first clean --... && spec-first init --...` only for partial or invalid state.
- If `.claude/spec-first/workflows/spec-update/SKILL.md` is missing, stop and tell the user to run `spec-first init --claude`.
