---
description: "Run the Spec-First debug workflow"
argument-hint: "[issue reference, error message, test path, or description of broken behavior]"
---

# Spec-First Debug

You are running the `spec:debug` workflow.

Before doing anything else, read `.claude/spec-first/workflows/spec-debug/SKILL.md` and execute that workflow as the primary contract for this command.

Rules:
- Treat `.claude/spec-first/workflows/spec-debug/SKILL.md` as the source of truth for root-cause analysis, fix discipline, and close-out behavior.
- Trace the full causal chain before proposing a fix.
- Prefer targeted reproduction, minimal changes, and explicit test recommendations.
- If `.claude/spec-first/workflows/spec-debug/SKILL.md` is missing, stop and tell the user to run `spec-first init --claude`.
