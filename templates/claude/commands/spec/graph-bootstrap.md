---
description: "Run the Spec-First graph bootstrap workflow (Phase 0–4 fact extraction)"
argument-hint: "[target repo path or context slug]"
---

# Spec-First Graph Bootstrap

You are running the `spec:graph-bootstrap` workflow.

Before doing anything else, read `.claude/spec-first/workflows/spec-graph-bootstrap/SKILL.md` and execute that workflow as the primary contract for this command.

Rules:
- Treat `.claude/spec-first/workflows/spec-graph-bootstrap/SKILL.md` as the source of truth for phase execution, artifact paths, and handoff behavior.
- Run this against the **target project** — the project you want to generate graph-informed context for.
- Phase 0 will detect the CRG graph state and select Full / Enhanced / Basic mode automatically.
- Generate control-plane artifacts under `.spec-first/workflows/bootstrap/<slug>/` and docs under `docs/contexts/<slug>/` in the target project.
- This workflow is the Stage-0 bootstrap entrypoint for graph-informed context generation.
- If `.claude/spec-first/workflows/spec-graph-bootstrap/SKILL.md` is missing, stop and tell the user to run `spec-first init --claude`.
