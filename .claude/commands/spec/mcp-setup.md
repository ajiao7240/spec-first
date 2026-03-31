---
description: "One-click MCP tools installation and configuration for spec-first workflows"
argument-hint: "[quick|custom]"
---

# MCP Setup

You are running the `spec:mcp-setup` workflow.

Before doing anything else, read `skills/mcp-setup/SKILL.md` and execute that workflow as the primary contract for this command.

Rules:
- Treat `skills/mcp-setup/SKILL.md` as the source of truth for phase execution, tool configuration, and verification behavior.
- This workflow installs and configures MCP tools needed for spec-first Full mode.
- If `skills/mcp-setup/SKILL.md` is missing, stop and tell the user to run `spec-first init --claude`.
