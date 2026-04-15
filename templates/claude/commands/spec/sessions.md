---
description: "Search and summarize prior coding agent sessions"
argument-hint: "[question or topic]"
---

# Spec-First Sessions

You are running the `spec:sessions` workflow.

Before doing anything else, read `.claude/spec-first/workflows/spec-sessions/SKILL.md` and execute that workflow as the primary contract for this command.

Rules:
- Treat `.claude/spec-first/workflows/spec-sessions/SKILL.md` as the source of truth for session-history lookup behavior.
- Use the workflow to gather and summarize relevant prior sessions without exposing raw session data unnecessarily.
- If `.claude/spec-first/workflows/spec-sessions/SKILL.md` is missing, stop and tell the user to run `spec-first init --claude`.
