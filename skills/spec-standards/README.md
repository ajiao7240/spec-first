# spec-standards

`spec-standards` is the source workflow for the Graph-backed Project Standards & Glue Compiler.

It prepares durable project baseline artifacts under `.spec-first/standards/` so downstream brainstorm, plan, work, review, and knowledge workflows can reuse project facts and confirmed standards without re-discovering the same context every time.

## Supported Scope

The implementation is preview-first:

- Detect project shape with deterministic facts.
- Plan enabled standards domains.
- Build a lightweight glue capability map.
- Check existing baseline freshness with `--quick`.
- Refresh bounded domains/modules/repos with `--refresh`.
- Prepare deeper graph query plans with `--deep`.
- Import shared standards from a locked source with `--import-source`.
- Let the LLM synthesize standards candidates from facts and evidence.
- Render `standards-preview.md`.
- Do not write `.spec-first/specs/repo-profile.yaml`.

Repo-profile patch apply, monorepo module outputs, workspace outputs, and drift checks remain explicit future boundaries.

## Deterministic Script

Run from the target repo root:

```bash
node skills/spec-standards/scripts/prepare-baseline.js --mode baseline
node skills/spec-standards/scripts/prepare-baseline.js --quick
node skills/spec-standards/scripts/prepare-baseline.js --refresh --domain <name>
node skills/spec-standards/scripts/prepare-baseline.js --deep
node skills/spec-standards/scripts/prepare-baseline.js --baseline --import-source <path>
```

The baseline script writes:

```text
.spec-first/standards/project-shape.json
.spec-first/standards/standards-plan.json
.spec-first/standards/glue-map.json
```

Mode-support artifacts include `standards-update-decision.json`, `graph-query-index.json`, `standards-sources.json`, `import-lock.json`, and `imported-standards.json`.

The script does not write standards candidates, previews, or repo-profile changes. Those require semantic judgment.

## Example Artifacts

The `examples/` directory contains artifact shape examples for supported modes and optional artifacts. They are examples, not generated truth.
