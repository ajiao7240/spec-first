---
description: "Compile graph readiness facts for external graph-provider workflows"
argument-hint: ""
---

# Graph Readiness Compiler

This source template defines Claude command metadata only.

During `spec-first init` for Claude Code, spec-first renders the runtime command by combining this frontmatter with the body of `skills/spec-graph-bootstrap/SKILL.md`.

The paired skill owns the multi-repo contract: `--repo <child>` selects one child repo, while parent-workspace no-argument execution defaults to all child repos and writes child-local canonical graph artifacts plus parent advisory summaries only. `--all-repos` remains as an explicit equivalent for maintenance scripts.

Edit the paired skill to change workflow behavior.
