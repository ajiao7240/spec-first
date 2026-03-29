---
description: "Run the Spec-First review workflow"
argument-hint: "[branch, PR, or change summary]"
---

# Spec-First Review

You are running the `spec:review` workflow.

Before doing anything else, read `.claude/skills/spec-review/SKILL.md` and execute that workflow as the primary contract for this command.

Rules:
- Treat `.claude/skills/spec-review/SKILL.md` as the source of truth for reviewer selection, severity rules, and output structure.
- Inspect the change for correctness, regressions, coverage gaps, and maintainability.
- Prioritize blocking issues and concrete file references.
- If no issues are found, say so explicitly and note any residual risk.
- If `.claude/skills/spec-review/SKILL.md` is missing, stop and tell the user to run `spec-first init --claude`.
