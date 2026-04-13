---
description: "Run the Spec-First bootstrap workflow to generate project context assets"
argument-hint: "[target repo path or context slug]"
---

# Spec-First Bootstrap

You are running the `spec:bootstrap` workflow.

Before doing anything else, read `.claude/spec-first/workflows/spec-bootstrap/SKILL.md` and execute that workflow as the primary contract for this command.

Rules:
- Treat `.claude/spec-first/workflows/spec-bootstrap/SKILL.md` as the source of truth for phase execution, artifact paths, and handoff behavior.
- Run this against the **target project** — the project you want to generate context for, not the spec-first framework itself.
- Generate long-lived context assets under `docs/contexts/<slug>/` in the target project.
- This is a Stage-0 supporting workflow. It does not replace the five-stage workflow — it prepares context for it.
- If `.claude/spec-first/workflows/spec-bootstrap/SKILL.md` is missing, stop and tell the user to run `spec-first init --claude`.
