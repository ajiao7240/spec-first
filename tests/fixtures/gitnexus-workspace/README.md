# GitNexus Workspace Fixtures

这些 fixtures 锁定 `workspace-gitnexus-readiness.v1` 的 multi-repo workspace 行为。它们是 sanitized examples，不是 provider raw logs。

| Fixture | Capture / source | Purpose |
| --- | --- | --- |
| `workspace-graph-targets.dirty-overlay.example.json` | captured 2026-05-22, GitNexus 1.6.4 shaped KAZ-like workspace | Dirty overlay with prior query-ready proof and stale-advisory candidates. |
| `workspace-graph-targets.carry-forward-broken.example.json` | synthetic 2026-05-22 | Carry-forward断裂场景：`requires_clean_full_refresh=true` makes a carried `last_indexed_commit` untrusted. |
| `topology-multi-repo-workspace.example.json` | synthetic 2026-05-22 | Minimal multi-repo workspace topology for script-mode classifier tests. |
| `topology-single-repo.example.json` | synthetic 2026-05-22 | Single-repo topology gate; no workspace readiness artifact should be written. |
| `topology-monorepo.example.json` | synthetic 2026-05-22 | Monorepo topology gate; modules are not GitNexus group members. |
| `registry-list.kaz.gitnexus-1.6.4.captured-2026-05-22.example.json` | captured 2026-05-22, GitNexus 1.6.4 shape | Sanitized `list_repos` overlay for KAZ-like workspace. |
| `registry-list.live-array.example.json` | captured live shape 2026-05-26 | Sanitized top-level array `list_repos` overlay. |
| `registry-list.invalid-shape.example.json` | synthetic 2026-05-22 | Fail-closed invalid registry root. |
| `registry-list.missing-required-field.example.json` | synthetic 2026-05-22 | Degraded registry evidence without global classifier failure. |
| `registry-list.unknown-extra-field.example.json` | synthetic 2026-05-22 | Forward-compatible unknown-field tolerance. |
| `group-list.ready.gitnexus-1.6.4.captured-2026-05-22.example.json` | captured 2026-05-22, GitNexus 1.6.4 shape | `group.status="group-ready"` overlay. |
| `group-list.empty.gitnexus-1.6.4.captured-2026-05-22.example.json` | captured 2026-05-22, GitNexus 1.6.4 shape | `group.status="group-missing"` bounded registry fallback. |
| `group-list.invalid-shape.example.json` | synthetic 2026-05-22 | Invalid group shape fixture reserved for fallback/error-path regression. |

Update this index when adding fixtures or when a GitNexus version changes the sanitized `list_repos` / `group_list` response shape.
