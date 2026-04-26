---
title: feat: Add CRG Workspace Topology Support
type: feat
status: completed
date: 2026-04-26
origin: docs/plans/2026-04-19-008-topology-unified-bootstrap-plan.md
---

# feat: Add CRG Workspace Topology Support

## Overview

Add CRG-native topology support for the three repository shapes that matter to agent workflows:

- Parent-directory workspace containing multiple independent git repositories
- Single git repository containing multiple modules/packages
- Single git repository containing one project

The implementation must not restore the retired Stage-0 stack. The current CRG query-first model remains the source of truth: child repositories own their own `.spec-first/graph/graph.db`, and a parent workspace only owns lightweight discovery, status, and candidate-selection facts.

Delivery must be explicitly phased. Phase 1 validates the parent-workspace workflow because that is the immediate Codex/Claude failure mode: discover scoped child repos, report readiness, return advisory candidates, and hand off to one repo-local CRG run. Phase 2 adds repo-local module topology once workspace scan/status/context is stable. Bulk all-repo maintenance and additional ecosystem detectors are follow-up work, not Phase 1 completion criteria.

---

## Problem Frame

The previous topology plan correctly identified the product problem: users often open Codex or Claude at a parent workspace directory that contains multiple independent git projects, while the current CRG runtime assumes one `--repo=<path>` maps to one repository graph. If the parent directory is treated as a repo, graph facts, git diff, work-run handoff, and review context can all point at the wrong boundary.

The earlier plan was written for Stage-0 outputs (`fact-inventory.json`, `stage0-context`, `minimal-context`, `context-routing`). Those surfaces are now retired. The useful part to carry forward is the model: topology facts, selection facts, and readiness facts are deterministic inputs; LLMs choose the target repo/module and verification strategy.

---

## Requirements Trace

### Workspace Boundaries

- R1. A parent directory with multiple child git repos must be recognized as a workspace without building one mixed parent graph.
- R2. Each child repo must keep its own CRG artifacts under the child repo, including `graph.db`, generation pointers, status, navigation, operation log, and work runs.
- R3. Workspace root artifacts must be lightweight control-plane facts: explicit scope, child repo registry, per-child graph readiness, and candidate repo recommendations.

### Repo-Local Topology

- R4. Single git repo multi-module projects must be represented as repo-local topology units, not as fake child repos.
- R5. Single git repo single-project behavior must remain the default and must not regress.

### Workflow Behavior

- R6. Workflow skills must guide agents differently when they are opened at a workspace root: first identify candidate child repos, then run repo-local CRG hooks for the selected child repo. Phase 1 does not run one combined workflow over multiple child repos.
- R7. Readiness summaries and candidate scores are advisory only; they must not become gates or hard routing state machines.

### Governance And Retirement

- R8. Generated schemas, tests, and docs must make the unsupported Stage-0 surfaces stay retired.

---

## Scope Boundaries

- Do not restore `src/bootstrap-compiler/`, `src/context-routing/`, `stage0-context`, `minimal-context`, `docs/contexts`, or `docs/contracts/spec-graph-bootstrap`.
- Do not create a parent-level `graph.db` that merges multiple independent child repos.
- Do not make modules independent repo graphs or give them repo-level generation pointers.
- Do not build a general cross-repo dependency graph in this iteration.
- Do not treat a multi-child workspace task as one implicit combined work run in Phase 1. If a task spans multiple child repos, the workflow must decompose it into explicit sequential repo-local runs or defer multi-child orchestration to follow-up work.
- Do not auto-decide the semantic target repo for a task; scripts may rank candidates, but LLMs choose.

### Deferred to Follow-Up Work

- Cross-repo semantic edges and dependency inference across child repos: defer until workspace registry and per-child graph readiness prove stable.
- `crg workspace build --all` bulk maintenance: defer until selected-child workspace handoff is proven. Phase 1 may mention it as follow-up, but does not need aggregate exit semantics or all-child mutation.
- Cross-child workflow orchestration for tasks spanning multiple repos: defer until repo-local handoff semantics and work-run reporting are stable.
- JavaScript workspace detectors beyond the Phase 2 MVP, Gradle, Cargo, and arbitrary ecosystem module detectors: defer after the first repo-topology detector is in place.
- Optional visualization of workspace topology: defer until CLI JSON contracts are stable.
- Full module-unit rollout is after the parent-workspace release. The first release must not block on Maven/npm/pnpm module detection unless implementation proves the workspace UX depends on it.

---

## Context & Research

### Relevant Code and Patterns

- `src/crg/cli/router.js` is the CRG command dispatcher and should gain a `workspace` command handler.
- `src/crg/artifact-paths.js` centralizes path constants and should gain workspace artifact path resolvers.
- `src/crg/cli/build.js` owns repo-local graph generation and should remain repo-local.
- `src/crg/generations/paths.js` resolves active repo graph DBs and should not be reused for parent-level mixed graphs.
- `src/crg/workflow-context/stage.js` builds stage-specific decision inputs and currently assumes one repo root.
- `src/crg/hooks/*` provide advisory lifecycle hooks and are the right model to preserve.
- `src/crg/input-convergence.js` already handles large monorepo file collection inside a single git repo; topology units should layer above it.
- `tests/unit/stage0-context-command.test.js`, `tests/unit/stage0-context-monorepo.test.js`, and `tests/unit/workspace-nested-topology.test.js` currently assert Stage-0 retirement. New tests should keep that invariant.

### Institutional Learnings

- `docs/plans/2026-04-19-008-topology-unified-bootstrap-plan.md` provides the correct conceptual split between workspace, monorepo, and single repo, but its implementation units target retired Stage-0 files.
- Current CRG cutover work established that `graph.db` is the code fact source and JSON control-plane artifacts are navigation/status/advisory surfaces.

### External References

- VS Code multi-root workspaces use an explicit workspace file listing root folders and group search/source-control behavior by folder. This supports a workspace registry model rather than treating the parent folder as one project. Source: https://code.visualstudio.com/docs/editing/workspaces/multi-root-workspaces
- Nx affected uses Git changes plus a project graph to identify affected projects. This supports deterministic changed-file-to-unit mapping with LLM judgment on final action. Source: https://nx.dev/docs/features/ci-features/affected
- Turborepo separates package graph from task graph and derives the package graph from the package manager workspace. This supports keeping module/package topology distinct from execution decisions. Source: https://turborepo.com/repo/docs/core-concepts/package-and-task-graph
- Maven reactor collects modules, sorts them by declared module relationships, and supports building selected projects with dependencies/dependents. This makes Maven `<modules>` a high-confidence module unit signal. Source: https://maven.apache.org/guides/mini/guide-multiple-modules.html
- npm workspaces are declared in `package.json` and allow running commands in one or all configured workspaces. This supports reading JavaScript workspace declarations as module/package units. Source: https://docs.npmjs.com/cli/v7/using-npm/workspaces

---

## Key Technical Decisions

- Use `crg workspace <action>` instead of overloading `crg build --repo=<workspace-root>`: this keeps repo-local graph behavior intact and makes parent-directory semantics explicit.
- Store parent workspace artifacts under `.spec-first/workspace/`, not `.spec-first/graph/`: this avoids confusing workspace facts with repo graph facts.
- Keep child graph artifacts in each child repo: parent workspace status references child graph status rather than copying or merging child DBs.
- Represent monorepo modules as repo-local topology units: modules improve selection and review focus but do not get independent graph generations.
- Prefer declarative module signals first when module detectors are implemented: Maven `pom.xml <modules>`, npm `package.json workspaces`, and pnpm `pnpm-workspace.yaml` are stronger than directory naming heuristics.
- Use advisory candidate ranking only: `workspace context` can rank child repos by path/name/graph/git signals, but it must return candidates and recommended commands rather than making the decision.
- Parent workspace discovery must not stop just because the root itself is a git repo. Umbrella repos and superprojects can still contain independent child repos, so discovery should surface the root repo and nested child repos as candidates instead of silently choosing the parent.
- Workspace discovery must have an explicit scope contract. If `.spec-first/workspace/workspace-config.json` exists, scan uses its include/exclude/max-depth rules first; otherwise it falls back to bounded discovery with clear `scope_fallback_bounded_scan` signals.
- Discovered git roots must expose their relationship to the workspace root: `root_repo`, `nested_independent_repo`, `submodule`, or `worktree`. Submodules and worktrees are advisory records by default; they become normal candidates only when explicit scope includes them or a workflow/user selects them.
- Bulk workspace build is not part of Phase 1. The primary first-run path is `scan -> status -> context -> selected child repo build/hook`; building every child repo requires a later explicit maintenance command such as `--all`.

---

## Open Questions

### Resolved During Planning

- Should this revive Stage-0 topology? No. The plan must be CRG-native because Stage-0 runtime files are intentionally retired.
- Should parent workspaces have a combined graph DB? No. Independent git repos keep independent graph DBs; the parent owns only registry/status/candidate facts.
- Should monorepo modules become child repos? No. Modules remain repo-local topology units.

### Deferred to Implementation

- Exact candidate scoring weights for `workspace context`: defer to implementation after fixture data exists; the contract should expose reasons, not depend on one fragile score.
- Exact Maven XML parser strategy for the Phase 2 detector: default to a narrow, dependency-free extractor for simple reactor POMs unless implementation chooses to add and justify an XML parser dependency.
- Exact JavaScript workspace parser strategy: defer until the JavaScript detector is selected for a Phase 2 follow-up.
- Whether to expose `--json` flags separately: current CRG commands already output JSON envelopes, so only add if implementation reveals ambiguity.

---

## Output Structure

```text
src/crg/
  commands/
    workspace.js
  workspace/
    artifacts.js
    discovery.js
    status.js
    context.js
  topology/
    modules.js
docs/contracts/crg/
  workspace-config.schema.json
  workspace-index.schema.json
  workspace-status.schema.json
  repo-topology.schema.json
tests/unit/
  crg-workspace-artifacts.test.js
  crg-workspace-discovery.test.js
  crg-workspace-command.test.js
  crg-topology-modules.test.js
tests/e2e/
  crg-workspace-mainline.sh
```

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```mermaid
flowchart TD
  A[Codex/Claude opened at workspace root] --> B[crg workspace scan --root]
  B --> C[.spec-first/workspace/workspace-index.json]
  C --> D[crg workspace status --root]
  D --> E[child repo graph status references]
  E --> F[crg workspace context --task]
  F --> G[LLM chooses one child repo]
  G --> H[crg hook before-plan --repo child]
  H --> I[repo-local graph queries and workflow hooks]

  J[Single git repo] --> K[crg build --repo repo]
  K --> L[repo-local graph.db]
  L --> M[repo topology units if multi-module]
```

The workspace root never owns a merged `graph.db`. It owns a registry and readiness view. Child repos own graph facts. Monorepo module units enrich a single repo graph.

---

## Robustness And Consumption Quality

The hard part is not adding more JSON files. The hard part is making the new topology facts precise enough to improve LLM decisions without letting scripts become semantic routers or letting workspace facts pollute repo graph lifecycle.

### Complexity Controls

- Use validation-based discovery: filesystem scan only produces candidates; git roots must be confirmed through `git -C <candidate> rev-parse --show-toplevel` or an equivalent helper before they can become ready child repo records.
- Treat `.git` directories and `.git` files as first-class discovery signals. Worktrees and submodule-like layouts must either validate as git roots or appear as limitations with stable reason codes.
- Continue scanning nested repos even when the workspace root itself is a git repo. A root repo plus nested independent repos is a candidate set, not an automatic single-repo decision.
- Apply explicit workspace scope before broad discovery. `workspace-config.json` can list included roots, excluded globs, and max depth. When no config exists, bounded scan is allowed but must be marked as fallback-derived.
- Classify every validated git root relationship as `root_repo`, `nested_independent_repo`, `submodule`, or `worktree`. Submodules and worktrees must not be silently treated as independent siblings.
- Keep the three lifecycle layers separate:
  - Workspace layer: `.spec-first/workspace/*` registry, status, freshness, candidate facts.
  - Repo graph layer: `<repo>/.spec-first/graph/*` graph DB, generations, navigation, status.
  - Repo topology layer: `<repo>/.spec-first/graph/repo-topology.json` module/package units inside one git repo.
- Make workspace `scan`, `status`, and `context` the normal first path. Phase 1 state-changing build is selected-child only; all-child bulk build is a later maintenance path.
- Prefer structured limitations over hard failure. One unreadable, invalid, stale, or graph-missing child repo should degrade that child record without hiding healthy siblings.

### Freshness Contract

`workspace-index.json` must not be treated as timeless truth. `workspace status` and `workspace context` must refresh discovery or compare a root fingerprint before returning recommended repo-local commands.

Minimum freshness fields:

```json
{
  "schema_version": "workspace-index/v1",
  "workspace_root": "/workspace",
  "generated_at": "2026-04-26T00:00:00.000Z",
  "scope": {
    "source": "workspace_config",
    "include_roots": ["repo-a", "repo-b"],
    "exclude_globs": ["vendor/**"],
    "max_depth": 3
  },
  "root_fingerprint": {
    "algorithm": "workspace-discovery/v1",
    "value": "<stable-hash-or-observation-token>"
  },
  "children": [],
  "stale_entries": [],
  "limitations": []
}
```

Deleted, renamed, or no-longer-valid child paths must not appear as ready candidates. They should be downgraded into `stale_entries` or `limitations`, and recommended commands must only point to child repo roots that still validate.

### Advisory Context Contract

`workspace context` may rank candidates and provide reasons, but it must not output a semantic final selection. The contract should prefer fields like:

```json
{
  "schema_version": "crg-cli/v1",
  "data": {
    "workspace_root": "/workspace",
    "candidates": [
      {
        "slug": "repo-a",
        "repo_root": "/workspace/repo-a",
        "relationship": "nested_independent_repo",
        "readiness": "ready",
        "signals": ["scope_config_applied", "git_root_verified", "graph_ready", "task_path_signal"],
        "limitations": [],
        "recommended_commands": [
          "spec-first crg hook before-plan --repo=/workspace/repo-a"
        ]
      }
    ],
    "limitations": []
  }
}
```

Avoid fields that imply the script has made the semantic choice, such as `selected_repo`, `target_repo`, or `final_repo`. If a single child repo exists under a non-git parent, the output may provide a direct repo-local recommendation, but it should still be represented as a candidate recommendation rather than a hidden selection.

### Stable Reason Codes

Use stable machine-readable reason codes alongside human-readable messages so workflow skills and LLMs can consume the output without parsing prose.

Initial reason code set:

- `git_root_verified`
- `git_root_invalid`
- `git_file_detected`
- `scope_config_applied`
- `scope_fallback_bounded_scan`
- `ignored_generated_directory`
- `root_repo_detected`
- `nested_repo_detected`
- `submodule_detected`
- `worktree_detected`
- `graph_ready`
- `graph_missing`
- `graph_degraded`
- `task_path_signal`
- `task_name_signal`
- `changed_files_under_repo`
- `stale_child_path`
- `child_unreadable`
- `slug_collision_resolved`
- `module_declaration_detected`
- `module_path_missing`
- `module_config_malformed`

The exact score weights for candidate ordering can evolve, but these reason codes should remain stable enough for tests and workflow prompts.

### Consumption Flow

Consumers should treat workspace topology as a preflight layer, not as a replacement for repo-local CRG.

| Opened Location | First Consumer Action | Decision Owner | Next Consumer Action |
|-----------------|-----------------------|----------------|----------------------|
| Parent workspace with child repos | Run `crg workspace scan/status/context --root=<workspace>` | LLM/user chooses one child repo from advisory candidates | Run repo-local `crg build` or `crg hook ... --repo=<child>` |
| Parent workspace task spanning multiple child repos | Run `crg workspace context --root=<workspace> --task="<task>"` | LLM/user decomposes into explicit repo-local runs | Run each child repo workflow separately; no combined graph/work-run in Phase 1 |
| Single git repo with modules | Run normal repo-local CRG build/hook | LLM uses `repo-topology.json` to focus scope | Continue repo-local graph queries and work-runs |
| Single git repo single project | Run normal repo-local CRG build/hook | Existing workflow judgment | Continue existing repo-local CRG path |

Workflow-specific rules:

- `spec-graph-bootstrap`: at workspace root, prepare workspace facts and child readiness; do not build a parent graph.
- `spec-plan`: at workspace root, consume candidates first, then run `before-plan` only after a child repo is chosen.
- `spec-work`: at workspace root, require an explicit child repo or workspace context candidate choice before editing files. If multiple child repos are needed, decompose into sequential repo-local work runs.
- `spec-code-review`: at workspace root, choose the child repo review boundary before collecting diff/review evidence.
- `using-spec-first`: identify whether the user is in repo-local or parent-workspace mode; do not become a state machine.

---

## Implementation Units

- U1. **Add CRG Workspace Artifact Paths And Schemas**

**Goal:** Establish the durable parent-workspace control-plane layout.

**Requirements:** R1, R2, R3, R7

**Dependencies:** None

**Files:**
- Modify: `src/crg/artifact-paths.js`
- Create: `src/crg/workspace/artifacts.js`
- Create: `docs/contracts/crg/workspace-config.schema.json`
- Create: `docs/contracts/crg/workspace-index.schema.json`
- Create: `docs/contracts/crg/workspace-status.schema.json`
- Test: `tests/unit/crg-workspace-artifacts.test.js`

**Approach:**
- Add resolvers for `.spec-first/workspace/`, `workspace-config.json`, `workspace-index.json`, `workspace-status.json`, and optional workspace operation log.
- Define `workspace-config/v1` as optional explicit scope: include roots, exclude globs, max depth, and config source. Absence means fallback bounded discovery, not an error.
- Define `workspace-index/v1` as stable discovery facts: workspace root, scope source, discovered child repos, child slug, child repo root, git root, relationship classification, discovery signals, ignored candidates, generated time, root fingerprint, stale entries, and limitations.
- Define `workspace-status/v1` as advisory readiness facts: child graph state, active DB path if available, node/edge counts, freshness state, stable reason codes, limitations, observed time.
- Keep artifact paths separate from `.spec-first/graph/` so parent workspace facts cannot be mistaken for repo graph facts.

**Patterns to follow:**
- `src/crg/artifact-paths.js`
- `docs/contracts/crg/graph-index-status.schema.json`
- `tests/unit/crg-artifact-paths.test.js`

**Test scenarios:**
- Happy path: resolving workspace artifact paths for a root returns `.spec-first/workspace/*` paths.
- Edge case: child slug normalization is deterministic and prevents path traversal.
- Error path: invalid or empty workspace root is rejected by public helpers if helper validation is added.
- Contract: sample workspace config/index/status payloads validate against schemas.
- Contract: schemas require stable arrays for `signals`, `limitations`, and stale child entries so downstream workflow prompts do not parse free-form prose.

**Verification:**
- Workspace artifacts are path-isolated from repo graph artifacts.
- Schemas can validate representative parent workspace and child readiness payloads.

---

- U2. **Implement Workspace Discovery And Status**

**Goal:** Let a parent directory discover child git repos and summarize their graph readiness without building a mixed graph.

**Requirements:** R1, R2, R3, R7

**Dependencies:** Existing repo-local CRG build/status helpers. U1 is only needed if the shared `docs/contracts/crg/` schema directory conventions are introduced there first.

**Files:**
- Create: `src/crg/workspace/discovery.js`
- Create: `src/crg/workspace/status.js`
- Test: `tests/unit/crg-workspace-discovery.test.js`

**Approach:**
- Start candidate discovery from explicit scope if `.spec-first/workspace/workspace-config.json` exists. If no config exists, use bounded filesystem scan and mark records with `scope_fallback_bounded_scan`.
- Validate git roots instead of assuming `.git` is always a directory. Candidate detection should recognize both `.git` directories and `.git` files, then confirm roots with `git -C <candidate> rev-parse --show-toplevel` or an equivalent helper.
- Skip generated and dependency directories using the same spirit as CRG input convergence: `.spec-first`, `.git`, `node_modules`, `dist`, `build`, `coverage`, `vendor`, `.claude`, `.codex`, `.agents`.
- Always scan for nested child repos, even when the workspace root itself has `.git`. If both the root repo and nested independent repos exist, classify the container as a parent workspace with a root-repo candidate and child-repo candidates rather than silently selecting the root.
- Classify discovered git-root relationships as `root_repo`, `nested_independent_repo`, `submodule`, or `worktree`. Detect `.gitmodules` and `.git` file indirection where practical; if relationship is unclear, include a limitation instead of promoting the record as an independent child candidate.
- Treat submodules and worktrees as advisory records by default. They may appear in candidates only when explicit scope includes them or the user/LLM explicitly selects them.
- For each child repo, read graph readiness using existing graph status helpers rather than opening or copying child DBs manually.
- If exactly one child repo is discovered under a non-git parent, keep parent-workspace artifact semantics but return a direct repo-local recommendation for the only child. There is no semantic candidate choice to make, but the parent still must not become the graph root.
- Define a freshness contract for `workspace-index.json`: `status` and `context` should rescan or compare a root fingerprint before returning commands, and stale/deleted/renamed child paths must appear as limitations rather than ready candidates.

**Execution note:** Characterize discovery before integrating it into CLI routing; false positives here can poison downstream planning.

**Patterns to follow:**
- `src/crg/workflow-context/status.js`
- `src/crg/input-convergence.js`
- `tests/unit/workspace-nested-topology.test.js`

**Test scenarios:**
- Happy path: parent with `repo-a/.git` and `repo-b/.git` produces two child repo records.
- Happy path: explicit `workspace-config.json` limits discovery to configured include roots and records `scope_config_applied`.
- Edge case: parent root with its own `.git` plus nested independent child repos returns both the root repo and child repos as candidates.
- Edge case: child repo with a `.git` file, such as a worktree or submodule shape, is discovered after git-root validation.
- Edge case: submodule and worktree records are relationship-labeled and not silently promoted as independent sibling repos.
- Edge case: parent with one child repo remains parent-workspace controlled when parent has no `.git`, but `context` recommends the only child repo directly.
- Edge case: nested generated directories such as `node_modules/pkg/.git` are ignored.
- Edge case: slug collision between `repo-a` and another path with the same basename is resolved deterministically.
- Error path: unreadable child directories produce limitations without failing the entire scan.
- Error path: invalid `.git` files or failed `rev-parse` checks produce limitations without failing the entire scan.
- Stale path: added, removed, and renamed child repos after an existing workspace index are reflected in refreshed status/context output.
- Integration: a child repo with ready CRG graph contributes ready status; a child without graph contributes missing status.

**Verification:**
- Discovery produces deterministic output order and stable slugs.
- Status summarizes child graph readiness without creating parent `.spec-first/graph/graph.db`.

---

- U3. **Add Phase 1 `crg workspace` CLI Actions**

**Goal:** Expose workspace scan/status/context and selected-child build as CRG query-first commands.

**Requirements:** R1, R2, R3, R6, R7

**Dependencies:** U1, U2

**Files:**
- Modify: `src/crg/cli/router.js`
- Create: `src/crg/commands/workspace.js`
- Create: `src/crg/workspace/context.js`
- Test: `tests/unit/crg-workspace-command.test.js`
- Test: `tests/e2e/crg-workspace-mainline.sh`

**Approach:**
- Add `workspace` to CRG subcommands with action dispatch:
  - `spec-first crg workspace scan --root=<workspace>`
  - `spec-first crg workspace status --root=<workspace>`
  - `spec-first crg workspace build --root=<workspace> --repo=<child-slug-or-path>`
  - `spec-first crg workspace context --root=<workspace> --task="<task>"`
- `scan` writes `workspace-index.json`.
- `status` reads or refreshes discovery facts and emits child readiness.
- `build` is state-changing and must require `--repo=<child>`. It builds one selected child repo and preserves that child `.spec-first/graph/`.
- Do not implement `workspace build --all` in Phase 1. Reserve it for follow-up maintenance once selected-child workflow quality is proven.
- `context` returns candidate child repos, stable match reason codes, readiness, limitations, and recommended repo-local hook commands.
- `context` must not emit `selected_repo`, `target_repo`, or any equivalent field that implies the script made the semantic decision.
- All actions return the existing `crg-cli/v1` envelope shape.

**Patterns to follow:**
- `src/crg/commands/hook.js`
- `src/crg/commands/workflow-context.js`
- `src/crg/cli/envelope.js`
- `tests/e2e/crg-all-commands.sh`

**Test scenarios:**
- Happy path: `workspace scan` writes index and returns child repo list.
- Happy path: `workspace status` returns missing/degraded/ready per child.
- Happy path: `workspace build --repo=<child>` builds one selected child repo and does not create parent graph DB.
- Happy path: `workspace context --task="api"` returns candidates with recommended `crg hook before-plan --repo=<child>` commands.
- Edge case: no child repos returns a clear limitation and non-ready context rather than treating the parent as a repo.
- Edge case: workspace with unrelated discovered repos can run scan/status/context without mutating any child.
- Error path: missing or ambiguous `--repo` for `workspace build` exits with a user error and does not build all children implicitly.
- Error path: invalid `--root` exits with user error.
- Contract: every action returns `schema_version: crg-cli/v1`.
- Contract: `workspace context` returns advisory candidates and recommended commands but no final semantic target field.

**Verification:**
- Parent workspace commands can be used from Codex/Claude opened at the parent directory.
- Recommended commands always point to child repo roots, never the parent root, when child repos are detected.

---

- U4. **Add Repo-Local Topology Plumbing And First Detector**

**Goal:** Represent multi-module single git repos as one graph with topology units without making all ecosystem detectors a single deliverable.

**Requirements:** R4, R5

**Dependencies:** U1

**Files:**
- Create: `src/crg/topology/modules.js`
- Modify: `src/crg/cli/build.js`
- Modify: `src/crg/workflow-context/stage.js`
- Create: `docs/contracts/crg/repo-topology.schema.json`
- Test: `tests/unit/crg-topology-modules.test.js`
- Test: `tests/unit/crg-generation-build.test.js`

**Approach:**
- Detect `single_repo` vs `monorepo_multi_module` inside a single git repo.
- Split Phase 2 implementation internally:
  - U4a topology plumbing: `repo-topology.json` schema, `single_repo` fallback, build integration, workflow-context summary.
  - U4b first detector MVP: Maven root `pom.xml` with `<modules>` and child module paths.
  - U4c JavaScript detector follow-up: npm `package.json` `workspaces` and pnpm `pnpm-workspace.yaml` package globs after U4a/U4b are stable.
- Persist repo topology as a JSON control-plane artifact under `.spec-first/graph/repo-topology.json`.
- Include `topology` summary in `workflow-context` so plan/work/review can see module units.
- Do not create per-module graph directories.
- Keep U4 as the second phase unless implementation shows it is required by the parent-workspace release. This prevents ecosystem-specific module parsing from delaying the main workspace-root fix.
- For Maven, choose one explicit parser strategy before coding. The default plan is a narrow dependency-free extractor for simple reactor POMs that supports comments and multiline `<modules>` blocks, returns limitations for malformed XML or missing module paths, and avoids adding a package dependency unless implementation justifies it.

**Execution note:** Add characterization tests for module detection before wiring it into `build`.

**Patterns to follow:**
- `src/crg/cli/build.js`
- `src/crg/workflow-context/navigation.js`
- `tests/unit/stage0-context-monorepo.test.js` as a retirement boundary, not as an implementation pattern

**Test scenarios:**
- Happy path: Maven parent with two `<module>` entries yields `topology.kind=monorepo_multi_module`.
- Follow-up happy path: npm `workspaces: ["packages/*"]` yields package units with paths and package names.
- Follow-up happy path: pnpm workspace globs include package directories and respect basic negation.
- Edge case: no recognized module declarations yields `single_repo`.
- Edge case: Maven `<modules>` is empty, malformed, or contains a missing child path and produces limitations.
- Edge case: Maven module extraction handles comments and multiline module blocks in the supported narrow format.
- Edge case: declared module path missing on disk is reported as a limitation, not a hard failure.
- Contract: `repo-topology.json` validates against schema.

**Verification:**
- Single repo single-project output remains unchanged except for an advisory topology artifact.
- Multi-module repos expose units without splitting graph lifecycle.

---

- U5. **Update Workflow Skill Handoffs For Workspace Roots**

**Goal:** Make public workflow instructions use workspace context when agents are opened at a parent directory.

**Requirements:** R6, R7, R8

**Dependencies:** U3 for parent-workspace handoff. U4 is only required for module-specific workflow context and must not block the first parent-workspace release.

**Files:**
- Modify: `skills/spec-graph-bootstrap/SKILL.md`
- Modify: `skills/spec-plan/SKILL.md`
- Modify: `skills/spec-work/SKILL.md`
- Modify: `skills/spec-work-beta/SKILL.md`
- Modify: `skills/spec-code-review/SKILL.md`
- Modify: `skills/using-spec-first/SKILL.md`
- Test: `tests/unit/spec-plan-contracts.test.js`
- Test: `tests/unit/spec-work-contracts.test.js`
- Test: `tests/unit/spec-work-beta-contracts.test.js`
- Test: `tests/unit/spec-code-review-contracts.test.js`
- Test: `tests/unit/using-spec-first-contracts.test.js`

**Approach:**
- Update `spec-graph-bootstrap` to detect parent-directory workspace roots and run `crg workspace scan/status/context` instead of `crg build --repo=<parent>`. Workspace build should run only after an explicit child repo is selected.
- Update `spec-plan` CRG planning anchor:
  - If opened at a ready child repo, use `crg hook before-plan --repo=<child>`.
  - If opened at a workspace root, use `crg workspace context --root=<workspace> --task="<task>"` first, then use repo-local hooks after LLM selects candidate repo.
- Update `spec-work` and `spec-code-review` to require an explicit child repo or ask the LLM/user to choose from advisory workspace candidates before running repo-local hooks. Scripts must not auto-select the semantic target repo.
- For tasks that appear to span multiple child repos, workflow text should instruct the LLM/user to decompose the task into explicit sequential repo-local runs. Phase 1 must not imply a combined cross-repo work-run.
- Keep all text free of retired Stage-0 fallback instructions.

**Patterns to follow:**
- Current CRG anchors in `skills/spec-plan/SKILL.md`
- Stage-0 retirement assertions in workflow contract tests

**Test scenarios:**
- Contract: workflow skill text mentions `crg workspace context` for parent workspace roots.
- Contract: workflow skill text still mentions repo-local `crg hook` for child repo execution.
- Contract: workflow skill text does not reintroduce `stage0-context`, `minimal-context`, or `docs/contexts`.
- Edge case: instructions say candidate workspace output is advisory and LLM chooses target repo.
- Edge case: instructions say multi-child workspace tasks are decomposed into repo-local runs rather than executed as one hidden combined run.

**Verification:**
- Agents opened at workspace roots receive explicit first-step guidance.
- Existing single repo CRG instructions remain intact.

---

- U6a. **Add Phase 1 Workspace End-To-End Coverage And Runtime Governance**

**Goal:** Lock the parent-workspace selected-child workflow and prevent regression to retired Stage-0 behavior.

**Requirements:** R1, R2, R3, R6, R7, R8

**Dependencies:** U1, U2, U3, and the parent-workspace part of U5

**Files:**
- Create: `tests/e2e/crg-workspace-mainline.sh`
- Modify: `tests/e2e/spec-graph-bootstrap-mainline.sh`
- Modify: `tests/e2e/spec-graph-bootstrap-installed-runtime.sh`
- Modify: `tests/unit/stage0-context-command.test.js`
- Modify: `tests/unit/workspace-nested-topology.test.js`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `docs/05-用户手册/04-workflows-artifacts-map.md`
- Modify: `CHANGELOG.md`

**Approach:**
- Add an e2e fixture with a parent directory containing two independent child git repos.
- Verify `crg workspace build --repo=<child>` creates child graph artifacts and no parent `graph.db`.
- Verify `crg workspace context` returns candidate repos and repo-local recommended commands.
- Verify workspace context exposes stable reason codes and does not expose `selected_repo` or equivalent semantic target fields.
- Verify explicit scope config narrows discovery and fallback bounded scan is labeled when config is absent.
- Verify submodule/worktree records are relationship-labeled and not silently treated as independent siblings.
- Keep retirement tests that assert `stage0-context` remains unavailable.
- Update user-facing docs to describe support tiers honestly:
  - Single repo single project: full repo-local support
  - Parent workspace multi repo: workspace registry/status plus child repo graphs
  - Single repo multi-module: Phase 2 topology support

**Patterns to follow:**
- `tests/e2e/crg-all-commands.sh`
- `tests/e2e/spec-graph-bootstrap-mainline.sh`
- `tests/unit/workspace-nested-topology.test.js`

**Test scenarios:**
- Happy path: parent workspace with two child repos scans, builds, and produces context recommendations.
- Happy path: single repo project still builds and hooks normally.
- Edge case: workspace root with one child repo stays parent-workspace controlled but recommends the only child directly.
- Edge case: git root containing nested independent repos is treated as a parent workspace candidate set, not silently as a single repo.
- Edge case: child repo represented by a `.git` file is discovered or explicitly reported unsupported with a limitation.
- Edge case: submodule/worktree child records are relationship-labeled and only promoted by explicit scope or selection.
- Edge case: child repo missing graph appears as missing in workspace status but does not break other children.
- Edge case: broad parent folder discovery can be narrowed by workspace config.
- Edge case: multi-child tasks are reported as requiring decomposition into repo-local runs.
- Regression: no command or runtime output tells users to run `stage0-context`.
- Regression: no parent `.spec-first/graph/graph.db` is created by workspace commands.
- Regression: stale, deleted, renamed, invalid, or unreadable child repos degrade into structured limitations without removing healthy sibling candidates.

**Verification:**
- Parent-workspace Phase 1 behavior is covered by repeatable tests.
- User docs and runtime skill contracts match the implemented Phase 1 support level.

---

- U6b. **Add Phase 2 Module Topology Coverage**

**Goal:** Lock repo-local topology support after U4 lands without blocking Phase 1 workspace release.

**Requirements:** R4, R5, R8

**Dependencies:** U4 and the module-specific part of U5

**Files:**
- Modify: `tests/unit/stage0-context-monorepo.test.js`
- Test: `tests/unit/crg-topology-modules.test.js`
- Modify: `tests/e2e/spec-graph-bootstrap-mainline.sh`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `docs/05-用户手册/04-workflows-artifacts-map.md`
- Modify: `CHANGELOG.md`

**Approach:**
- Add a monorepo fixture for the selected Phase 2 detector MVP, starting with Maven reactor modules.
- Verify `repo-topology.json` validates against schema and remains under the repo graph control plane.
- Verify single repo single-project behavior remains unchanged except for optional advisory topology.
- Add JavaScript workspace fixtures only after the JavaScript detector is explicitly selected for a follow-up.

**Test scenarios:**
- Happy path: single repo Maven multi-module produces repo topology units.
- Happy path: single repo single-project remains `single_repo`.
- Regression: module roots do not receive their own graph DBs or generation pointers.
- Regression: Stage-0 monorepo context surfaces remain retired.

**Verification:**
- Module topology is covered without changing repo graph lifecycle.
- Phase 1 workspace tests remain green when module topology is absent.

---

## System-Wide Impact

- **Interaction graph:** `spec-graph-bootstrap`, `spec-plan`, `spec-work`, `spec-work-beta`, and `spec-code-review` all gain a parent-workspace preflight path before repo-local hooks.
- **Error propagation:** Workspace-level failures should be per-child limitations where possible; one broken child repo should not hide healthy siblings.
- **State lifecycle risks:** Parent workspace index can go stale when child repos are added/removed. `workspace status` and `workspace context` should rescan or compare a root fingerprint before returning recommended commands, and stale child paths should be downgraded with limitations.
- **Scope quality risks:** Broad parent folders can contain unrelated repos. Explicit workspace config must narrow scan scope when present, and fallback discovery must label itself so LLMs know the candidate set is broad.
- **Relationship quality risks:** Submodules and worktrees can validate as git roots without being independent projects. Workspace records must expose relationship classification before workflow prompts use them as ordinary sibling candidates.
- **API surface parity:** CLI help, skill docs, README, e2e tests, and generated runtime assets must all expose the same workspace terminology.
- **Integration coverage:** Unit tests alone cannot prove parent/child artifact separation; e2e must assert no parent graph DB is created.
- **Unchanged invariants:** Repo-local `crg build`, `graph.db`, generation promotion, `workflow-context`, and lifecycle hooks remain the authoritative path once a child repo is selected. Multi-child tasks are explicit sequential repo-local runs in Phase 1.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Parent workspace scan accidentally indexes generated directories | Use explicit ignore rules and bounded depth; test `node_modules`, `.spec-first`, and nested `.git` exclusions. |
| Broad parent folders produce noisy candidate sets | Support optional workspace config with include/exclude/max-depth; label fallback bounded scan in signals and tests. |
| Workspace context becomes a hidden semantic router | Return candidates, reasons, and commands only; document that LLM chooses the target. |
| Multi-repo tasks are silently narrowed to one child | Phase 1 docs and workflow prompts require explicit decomposition into sequential repo-local runs. |
| Submodules or worktrees are mistaken for independent projects | Classify relationship as `submodule` or `worktree`; keep them advisory unless explicit scope or user selection promotes them. |
| Module detection becomes ecosystem sprawl | Split topology plumbing from detectors; start with one detector MVP and defer JavaScript/additional ecosystems. |
| Parent and child artifacts collide | Store parent facts in `.spec-first/workspace/` and child graph facts in each child `.spec-first/graph/`. |
| Root repo with nested child repos is misclassified as a single repo | Always scan for nested repos and surface root repo plus child repos as candidates when both exist. |
| Bulk workspace build mutates unrelated child repos | Defer `workspace build --all`; keep Phase 1 scan/status/context read-mostly and selected-child build explicit. |
| Local global `spec-first` install is older than repo code | Tests and docs should prefer repo-local command examples in development docs where relevant, while released docs keep package CLI examples. |
| Existing Stage-0 retirement tests conflict with new topology work | Keep tests framed around Stage-0 command retirement; add new CRG workspace tests instead of rewriting old tests to Stage-0 semantics. |

---

## Documentation / Operational Notes

- Update `CHANGELOG.md` when implementing code changes, per repository governance.
- Update user docs with explicit support semantics rather than saying all three modes are equivalent.
- Document that the normal first-run workspace flow is scan/status/context, followed by repo-local build or hooks for the selected child.
- Document that Phase 1 does not execute one combined multi-repo work-run. Multi-child tasks must be decomposed into explicit repo-local runs.
- Document that `crg workspace build --all` is not a Phase 1 command; when later added, it is explicit bulk maintenance and may be expensive.
- Document that monorepo modules are advisory topology units inside one graph, not independent projects with separate graph lifecycles, and that module topology is Phase 2.

---

## Success Metrics

### Phase 1 Parent Workspace

- Opening Codex or Claude at a parent workspace directory no longer leads agents to build a mixed parent graph.
- `spec-graph-bootstrap` can report child repo graph readiness from the parent directory.
- `spec-plan` can obtain candidate child repo commands before planning from a parent workspace.
- Workspace scan can be narrowed by explicit workspace config, and fallback bounded scan is visible in signals.
- Submodule/worktree records are relationship-labeled rather than silently treated as independent sibling repos.
- Multi-child tasks are surfaced as decomposition-required instead of silently narrowing to one repo.
- Stage-0 retired surfaces remain absent from CLI help, workflow skills, and runtime fallback paths.

### Phase 2 Repo-Local Topology

- Maven reactor repos expose module units in CRG workflow context without splitting graph lifecycle.
- JavaScript workspace repos expose module/package units only after the JavaScript detector follow-up is explicitly selected.
- Single repo single-project behavior remains the default and does not require workspace commands.

---

## Alternative Approaches Considered

- Restore the Stage-0 topology implementation: rejected because the current architecture intentionally retired `stage0-context`, `bootstrap-compiler`, and static context packs.
- Build one parent-level graph across all child repos: rejected because git diff, generations, work-runs, and review context are repo-local contracts.
- Require users to always pass `--repo=<child>` manually: rejected as insufficient for the stated Codex/Claude parent-directory workflow.
- Make every monorepo module a child repo: rejected because it pollutes git boundaries and creates false graph lifecycle semantics.
- Treat any directory with its own `.git` as a single repo without scanning children: rejected because umbrella repos and superprojects can still contain independent nested repos, which is the same boundary-confusion failure in another shape.

---

## Sources & References

- **Origin document:** `docs/plans/2026-04-19-008-topology-unified-bootstrap-plan.md`
- Related code: `src/crg/cli/router.js`
- Related code: `src/crg/artifact-paths.js`
- Related code: `src/crg/cli/build.js`
- Related code: `src/crg/workflow-context/stage.js`
- Related code: `src/crg/hooks/`
- Related tests: `tests/unit/stage0-context-command.test.js`
- Related tests: `tests/unit/workspace-nested-topology.test.js`
- External docs: https://code.visualstudio.com/docs/editing/workspaces/multi-root-workspaces
- External docs: https://nx.dev/docs/features/ci-features/affected
- External docs: https://turborepo.com/repo/docs/core-concepts/package-and-task-graph
- External docs: https://maven.apache.org/guides/mini/guide-multiple-modules.html
- External docs: https://docs.npmjs.com/cli/v7/using-npm/workspaces
