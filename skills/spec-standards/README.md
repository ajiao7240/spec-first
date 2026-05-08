# spec-standards

`spec-standards` is the source workflow for the Graph-backed Project Standards & Glue Compiler.

It prepares local project baseline artifacts under `.spec-first/standards/` so downstream brainstorm, plan, work, review, and knowledge workflows can reuse project facts and confirmed standards without re-discovering the same context every time. `spec-first init` gitignores this local workspace by default; confirmed standards that should travel with the team must be promoted to an explicit source path.

## Supported Scope

The implementation is preview-first:

- Detect project shape with deterministic facts.
- Plan enabled standards domains.
- Write a `standards-plan.json` synthesis contract for candidate shape, status vocabulary, evidence limits, writeback policy, and downstream consumers.
- Build a lightweight glue capability map.
- Check existing baseline freshness with `--quick`.
- Refresh bounded domains/modules/repos with `--refresh`.
- Prepare deeper graph query plans with `--deep`.
- Import shared standards from a locked source with `--import-source`.
- Let the LLM synthesize standards candidates from facts and evidence.
- Render `standards-preview.md`.
- Validate generated candidates and preview artifacts before trusted downstream consumption.
- Do not write `.spec-first/specs/repo-profile.yaml`.
- Write parent workspace advisory artifacts when invoked from a multi-repo parent workspace.

Repo-profile patch apply, monorepo module outputs, and drift checks remain explicit future boundaries.

For parent workspaces, the default run writes advisory artifacts under the parent `.spec-first/standards/`. These artifacts summarize child repo shapes and shared alignment questions, but they are not confirmed policy for any child repo. `--repo <child>` selects a child repo as the target root and writes default artifacts under that child repo's `.spec-first/standards/`.

## Deterministic Script

Run from the target repo root:

```bash
node skills/spec-standards/scripts/prepare-baseline.js --mode baseline
node skills/spec-standards/scripts/prepare-baseline.js --quick
node skills/spec-standards/scripts/prepare-baseline.js --refresh --domain <name>
node skills/spec-standards/scripts/prepare-baseline.js --deep
node skills/spec-standards/scripts/prepare-baseline.js --baseline --import-source <path>
node skills/spec-standards/scripts/prepare-baseline.js --workspace
node skills/spec-standards/scripts/prepare-baseline.js --repo <child>
```

The baseline script writes:

```text
.spec-first/standards/project-shape.json
.spec-first/standards/standards-plan.json
.spec-first/standards/glue-map.json
```

Mode-support artifacts include `standards-update-decision.json`, `graph-query-index.json`, `standards-sources.json`, `import-lock.json`, and `imported-standards.json`.

The script does not write standards candidates, previews, or repo-profile changes. Those require semantic judgment. Downstream workflow usage is described in `standards-plan.json` and `glue-map.json`; only `confirmed` candidates are hard constraints.

## Artifact Validator

After the LLM has written `standards-candidates.json` and `standards-preview.md`, run:

```bash
node skills/spec-standards/scripts/validate-artifacts.js --standards-dir .spec-first/standards --json
```

The validator checks artifact handoff quality only: JSON shape, status/source vocabulary, status-specific support, conflict/unknown visibility, preview writeback status, and patch safety. It does not decide whether a proposed standard is semantically correct.

Exit code `0` is a trusted pass. Exit code `4` is a degraded pass, such as explicit fallback vocabulary use or parent workspace artifacts with `consumption_boundary=advisory_only`; downstream workflows may treat that as advisory structure only, not as a trusted baseline. Validation failure uses stable `reason_code` values so downstream workflows can explain what blocked trusted consumption.

Candidate statuses and consumption modes stay separate: `confirmed` is hard context, `observed` / `imported` / `suggested` are advisory, `conflict` is risk context, and `unknown` is question context.

Candidate ids must be unique because conflict lists, unknown lists, confirmation attestation, and patch safety all reference candidates by id. When attestation files live outside `.spec-first/standards/`, pass them explicitly with `--confirmations <path>` or `--patch <path>`.

## Example Artifacts

The `examples/` directory contains artifact shape examples for supported modes and optional artifacts. They are examples, not generated truth.
