---
description: "Install and verify the required harness runtime for spec-first workflows"
argument-hint: ""
---

# MCP Setup

This source template defines Claude command metadata only.

During `spec-first init` for Claude Code, spec-first renders the runtime command by combining this frontmatter with the body of `skills/spec-mcp-setup/SKILL.md`.

The paired skill owns the multi-repo contract: when run from a parent workspace with no `--repo <child>`, setup defaults to all child repos. `--repo <child>` narrows the run, and `--all-repos` is the explicit equivalent of the parent-workspace default.

Edit the paired skill to change workflow behavior.
