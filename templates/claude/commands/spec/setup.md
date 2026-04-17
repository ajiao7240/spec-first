---
description: "Run the unified spec-first setup workflow"
argument-hint: "[optional issue or tool]"
---

# Spec-First Setup

You are running the `spec:setup` workflow.

Before doing anything else, read `.claude/spec-first/workflows/setup/SKILL.md` and execute that workflow as the primary contract for this command.

Rules:
- Treat `.claude/spec-first/workflows/setup/SKILL.md` as the source of truth for environment diagnosis, repo-local config bootstrap, and MCP handoff behavior.
- This workflow owns helper tool diagnostics and `.spec-first/config.local*.yaml` bootstrap.
- If `.claude/spec-first/workflows/setup/SKILL.md` is missing, stop and tell the user to run `spec-first init --claude`.
