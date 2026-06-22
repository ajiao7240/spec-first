# Loading And Consumption

Use this reference for `query` mode and for workflow handoffs.

1. Read `docs/contracts/team-standards.md`.
2. Read `docs/standards/index.md`.
3. Build query tags from workflow, artifact type, changed paths, declared surface/layer/capability, changed file types and requested rule IDs.
4. Match only `trust=confirmed,lifecycle_state=active` rules.
5. Read only matched files and sections.
6. Return matched, excluded, uncertainty, fallback, limitations and source refs used.

Unknown scope, missing index, stale index and conflict-present modes are fallback states. They must not trigger a full `docs/standards/**` scan.

AI rules, review checklist, query summary and workflow handoff snippets are derived artifacts. They must cite source rule IDs or reviewable proposal IDs and cannot become independent source truth.
