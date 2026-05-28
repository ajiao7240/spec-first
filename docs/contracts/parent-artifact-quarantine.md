# Parent Artifact Quarantine Contract

`parent-artifact-quarantine.v1` is a setup-owned advisory artifact for parent multi-repo workspaces. It marks repo-local graph/setup/index artifacts that exist at the parent workspace root, where downstream workflows could otherwise mistake them for current child-repo truth.

## Producer

- Producer: `spec-mcp-setup` verify phase (`verify-tools.sh` / `verify-tools.ps1`)
- Artifact path: `.spec-first/workspace/parent-artifact-quarantine.json`
- Topology: `multi-repo-workspace`
- Freshness: generated at verify time
- Authority: advisory evidence only

The producer may write an empty `quarantined_paths[]` list when a parent workspace was scanned and no parent-local pollution was found. Single-repo setup does not write this artifact.

## Schema

```json
{
  "schema_version": "parent-artifact-quarantine.v1",
  "topology": "multi-repo-workspace",
  "advisory": true,
  "authority_level": "advisory",
  "freshness": "generated",
  "generated_at": "2026-05-28T00:00:00Z",
  "generated_by": "spec-mcp-setup",
  "consumers": [
    "spec-first clean --workspace-orphans",
    "LLM workflow degraded-evidence judgment"
  ],
  "quarantined_paths": [
    {
      "path": ".spec-first/graph/graph-facts.json",
      "reason_code": "parent-workspace-must-not-have-repo-local-graph",
      "stale_indicator": "parent-workspace-repo-local-artifact-present",
      "last_generated_at": "2026-05-28T00:00:00Z",
      "fingerprint_origin": "/path/to/child-or-foreign-repo"
    }
  ]
}
```

`path` is always POSIX-style and repo-relative to the parent workspace. Consumers must reject absolute paths, backslashes, and parent traversal.

## Reason Codes

- `parent-workspace-must-not-have-repo-local-graph`: parent root contains repo-local graph/setup facts.
- `parent-workspace-must-not-have-graph-index`: parent root contains a GitNexus index directory.
- `foreign-absolute-path-stat-failed`: an embedded absolute path no longer exists and does not live under the current user home.
- `retired-provider-residue`: retired provider residue exists under the parent workspace.
- `repo_root-mismatches-workspace-root`: an embedded `repo_root` / provider index path points somewhere other than the parent workspace root.

## Consumers

`spec-first clean --workspace-orphans` is read-only in this release. It lists `quarantined_paths[]` and prints `Deletion is not implemented in this release`; it must not delete files.

LLM workflows may use the artifact as degraded-evidence context when deciding whether parent workspace graph/config facts are trustworthy. They must not treat quarantine as confirmed deletion truth or as child repo readiness truth.

## Failure Mode

If the artifact is missing, unreadable, or has an unknown `schema_version`, cleanup consumers should ask the user to rerun `$spec-mcp-setup` from the parent workspace. Setup must warn-and-continue if quarantine writing fails, except when the shared workspace summary path itself is rejected as a symlink escape.
