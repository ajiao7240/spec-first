# Team Standards Index

本目录是 confirmed team standards 的 source surface。先读 `docs/contracts/team-standards.md` 理解 authority semantics；本文件只提供 registry、索引和 summary-first 加载地图，不复制规则全文。

## Surface / Layer / Capability Registry

### Surfaces

- `shared`
- `app`
- `h5`
- `pc`
- `admin`
- `backend`
- `job-event`
- `data`

### Layers

- `domain`
- `application`
- `adapter`
- `ui`
- `api`
- `storage`
- `observability`
- `workflow`
- `runtime`
- `docs`

### Capabilities

- `*`
- `spec-first`
- `runtime-governance`
- `workflow-governance`
- `team-standards`
- `security`

## Owner Registry

| Owner | Scope | Resolution notes |
| --- | --- | --- |
| `spec-first-maintainers` | `shared`, `workflow-governance`, `runtime-governance`, `team-standards` | 默认维护者角色；具体人员不写入规范 |
| `security-owner` | `security`, secret/PII/path hygiene | 安全与隐私规则 owner role |

`owner=unresolved` 是合法值，但 high-impact 规则 fail-closed：不得进入 `confirmed-draft`、confirmed patch 或 hard context。

## Rule Index

| Rule ID | Trust | Lifecycle | Priority | Category | Applies To | Layer | Capability | Workflow | File | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `SHARED-SOURCE-001` | `confirmed` | `active` | `P0-blocking` | `architecture` | `shared` | `workflow,runtime,docs` | `spec-first,runtime-governance` | `plan,work,write-tasks,code-review,doc-review,debug` | `shared.md` | `spec-first-maintainers` |
| `SHARED-CHANGELOG-001` | `confirmed` | `active` | `P1-required` | `review` | `shared` | `docs,workflow` | `spec-first` | `plan,work,write-tasks,code-review,doc-review,debug` | `shared.md` | `spec-first-maintainers` |
| `ARCH-RUNTIME-001` | `confirmed` | `active` | `P0-blocking` | `architecture` | `shared` | `runtime,workflow` | `runtime-governance` | `plan,work,code-review,doc-review,debug` | `architecture.md` | `spec-first-maintainers` |
| `REVIEW-STANDARDS-001` | `confirmed` | `active` | `P1-required` | `review` | `shared` | `workflow` | `team-standards` | `code-review` | `review.md` | `spec-first-maintainers` |
| `SEC-CANDIDATE-001` | `confirmed` | `active` | `P0-blocking` | `security` | `shared` | `docs,workflow` | `security,team-standards` | `plan,work,code-review,doc-review,debug,standards-query` | `security.md` | `security-owner` |

## Loading Algorithm

1. Read `docs/contracts/team-standards.md`.
2. Read this index and derive query tags from workflow, artifact type, changed paths, declared surface/layer/capability, changed file types and requested rule IDs.
3. Open only the `File` values for matched rule IDs.
4. Treat only `trust=confirmed,lifecycle_state=active` and scope-matched rules as hard project context.
5. Return matched/excluded/uncertainty/fallback/limitations in the handoff.

If this index is missing, stale or too broad, consumer workflows must use the fallback modes in `docs/contracts/team-standards.md`. They must not scan the entire `docs/standards/**` tree as a replacement index.

## Standards Areas

| File | Purpose |
| --- | --- |
| `shared.md` | Shared source/runtime and changelog rules that apply across this repo |
| `architecture.md` | High-impact architecture and source/runtime ownership rules |
| `review.md` | Project-standards review enforcement rules |
| `security.md` | Candidate and derived-output hygiene rules |
| `candidates/README.md` | Proposal-only candidate boundary and brownfield initialization notes |

## Advisory Templates

Business-surface examples such as backend-owned business state, dependency direction, design note triggers and cross-surface error semantics belong in `suggested` candidates until a real project has owner, ADR/design note, source refs and conflict checks. Do not write them as confirmed rules by template alone.
