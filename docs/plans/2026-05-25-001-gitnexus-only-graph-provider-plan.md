---
title: refactor: GitNexus-only graph provider hard cut and CRG removal
type: refactor
status: active
date: 2026-05-25
origin: docs/brainstorms/2026-05-25-001-gitnexus-only-graph-provider-requirements.md
spec_id: 2026-05-25-001-gitnexus-only-graph-provider
---

# refactor: GitNexus-only graph provider hard cut and CRG removal

## Summary

本计划把 spec-first 的 active graph provider 从 GitNexus + code-review-graph 双路径硬切为 GitNexus-only。实施顺序不是“先删 CRG 再补洞”，而是先让 GitNexus 产出 `$spec-code-review` 和其他 downstream workflows 需要的 canonical impact/review facts，再删除 CRG 的安装、setup projection、graph-bootstrap refresh、provider artifacts、review-pre-facts routing、workflow guidance、docs 和测试期望。

迁移完成后：

- `$spec-mcp-setup` 只准备 GitNexus provider projection 与 setup-inferred capability metadata，不安装或投影 CRG。
- `$spec-graph-bootstrap` 是唯一 refresh owner，执行 GitNexus full / clean single-repo incremental / explicit non-git folder full indexing，并写 canonical graph/provider/impact artifacts。
- `$spec-code-review` 使用 GitNexus impact/review evidence；GitNexus 不可用时只降级到 direct source reads、git diff、ast-grep、tests/logs，不回退 CRG。
- 非 Git 目录通过 explicit target + GitNexus `analyze --skip-git` 建受限索引，不伪造 commit、branch、dirty 或 diff evidence。
- `.code-review-graph/`、旧 host MCP config、uv cache 和历史 `.spec-first/providers/code-review-graph/*` 只作为 residual cleanup advisory，不参与 readiness 或 fallback。

## Source Of Truth

- Origin requirements: `docs/brainstorms/2026-05-25-001-gitnexus-only-graph-provider-requirements.md`
- Provider consumption contract: `docs/contracts/graph-provider-consumption.md`
- Evidence policy: `docs/contracts/graph-evidence-policy.md`
- GitNexus capability catalog: `docs/contracts/gitnexus-capability-catalog.md`
- Setup source: `skills/spec-mcp-setup/mcp-tools.json`, `skills/spec-mcp-setup/scripts/write-provider-config.sh`, `skills/spec-mcp-setup/scripts/write-provider-config.ps1`, `skills/spec-mcp-setup/scripts/verify-tools.*`, `skills/spec-mcp-setup/references/supported-mcp-tools.md`
- Bootstrap source: `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`, `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`, `skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.*`
- Review pre-facts helper: `src/cli/helpers/review-pre-facts.js`
- Runtime/catalog source: `scripts/generate-runtime-capability-catalog.js`, `docs/catalog/runtime-capabilities.md`, `src/cli/runtime-tools-index.js`, checked-in host entry docs `AGENTS.md` and `CLAUDE.md`
- Quality gate source: `scripts/run-ai-dev-quality-gate.js`, `src/cli/contracts/quality-gates/branch-protection-policy.json`, `.github/workflows/ai-dev-quality-gate.yml`
- Public workflow prose: `skills/spec-code-review/SKILL.md`, `skills/spec-plan/SKILL.md`, `skills/spec-work/SKILL.md`, `skills/spec-debug/SKILL.md`, `skills/spec-doc-review/SKILL.md`, `skills/spec-graph-bootstrap/SKILL.md`, `skills/using-spec-first/SKILL.md`

Current compiled graph facts are `dirty-advisory`; they are useful for orientation only. Critical conclusions in this plan are based on focused source reads.

## Goals

- G1. Remove CRG from active install/setup/bootstrap/workspace-target/readiness/review/docs/tests without leaving hidden provider fallback.
- G2. Preserve or improve CRG-era review-impact capability through GitNexus-backed canonical impact/review facts.
- G3. Keep refresh ownership explicit: setup projects, graph-bootstrap refreshes, downstream consumes and handoffs.
- G4. Support explicit non-git folder indexing via GitNexus `analyze --skip-git` with content/folder freshness instead of fake Git metadata.
- G5. Keep provider output as evidence input only; source, diff, tests, schemas and logs remain the facts that support findings.

## Non-Goals

- No CRG fallback, legacy provider, optional provider, review-only provider or hidden compatibility provider.
- No CodeGraph or third-party new provider.
- No automatic GitNexus `repair`, `clean`, `group sync`, `rename`, hooks, watchers or daemons.
- No fake Git repo, fake commit, fake dirty hash or fake `last_indexed_commit` for non-git folders.
- No generated runtime mirror edits as source changes. Runtime regeneration, if needed after implementation, must use `spec-first init --claude|--codex`.
- No release claim that CRG was safely removed until GitNexus impact adapter, downstream consumption and tests pass.

## Current CRG Touchpoints

| Lifecycle node | Current active CRG surface | Replacement target |
| --- | --- | --- |
| Registry/install | `skills/spec-mcp-setup/mcp-tools.json` defines `code-review-graph`, `uv`/`uvx`, package pin, warmup and optional live MCP | Remove CRG tool entry; GitNexus remains the only graph-provider registry entry |
| Setup projection | `write-provider-config.*` reads CRG package/version, emits CRG commands, command hash, artifacts, derived readiness and `selection.impact_context` | Emit GitNexus-only projection and GitNexus impact/review capability mapping |
| Setup detection | `detect-tools.*`, `verify-tools.*`, `configure-host.*`, `install-mcp.*`, `uninstall-mcp.*` can treat CRG as setup subject | Remove CRG from baseline and normal install flow; residual host config is explicit cleanup advisory |
| Setup reference catalog | `skills/spec-mcp-setup/references/supported-mcp-tools.md` describes CRG as required graph provider and pinned setup path | Update to GitNexus-only graph provider catalog |
| Bootstrap preflight | `bootstrap-providers.*` allows provider id `code-review-graph`, validates `uvx` command shapes, checks CRG pin/fingerprint | Remove CRG branch and reason codes; unsupported provider ids fail closed |
| Bootstrap refresh | CRG `build`, `update --base`, `status`, `status --repo` can run and write provider status | GitNexus owns full/incremental/folder refresh |
| Workspace target resolver | `resolve-workspace-graph-targets.*` can carry CRG configured/query-ready/status facts into parent workspace advisory output | Emit GitNexus-only provider readiness and ignore historical CRG artifacts for readiness |
| Provider artifacts | `.spec-first/providers/code-review-graph/raw/*`, `status.json`, `normalized/impact-capabilities.json` | No active CRG artifacts; GitNexus normalized impact/review envelope replaces it |
| Canonical artifacts | `graph-facts.capabilities.impact_context` and `bootstrap-impact-capabilities.impact_radius/review_support` key off CRG readiness | Compute from GitNexus query-ready impact surfaces plus explicit fallback capability |
| Review pre-facts | `review-pre-facts.js` can emit `tool_name="code-review-graph.query"` | GitNexus-only query plan or bounded direct reads |
| Workflow prose | `$spec-code-review` calls CRG primary diff-impact provider | GitNexus-only provider evidence, direct-read fallback |
| Tests / CI | shell, Jest and quality gate tests assert CRG setup/bootstrap behavior | Rewrite tests to assert no active CRG provider path and GitNexus parity |
| Runtime/catalog/docs/evals | Runtime capability catalog, generator, checked-in host entry docs, active user manuals, setup reference docs and workflow eval fixtures describe CRG as current provider/tool fact source | Regenerate GitNexus-only catalog/guidance wording and update generator/tests/evals |
| Upgrade projection | Existing `.spec-first/config/graph-providers.json` can still contain CRG commands after upgrade | setup rewrites to GitNexus-only; graph-bootstrap rejects stale CRG projection before command execution |

## Key Decisions

### D1. Add GitNexus impact adapter before deleting CRG

CRG currently supplies the mental and artifact slot for diff impact, blast radius, review context, related tests and graph stats. Deleting it before GitNexus has equivalent canonical facts would downgrade `$spec-code-review`. The first implementation unit therefore extends GitNexus normalized artifacts and `bootstrap-impact-capabilities.v1`; only then should active CRG setup/bootstrap paths be removed.

### D2. Keep `bootstrap-impact-capabilities.v1` as the downstream seam

Downstream workflows already know how to read `.spec-first/impact/bootstrap-impact-capabilities.json`. The migration should preserve that canonical artifact path and evolve producer semantics, instead of forcing every consumer to learn provider-private GitNexus output shapes.

### D3. Remove CRG from setup and bootstrap, not only from prose

CRG is active through registry entries, command arrays, artifact paths, provider fingerprint logic, workspace target readiness facts, shell tests and workflow guidance. A successful migration must make CRG impossible to execute from default setup/bootstrap paths and impossible to appear as active workspace readiness, not merely stop recommending it.

### D4. Treat non-git folders as folder targets, not degraded Git repos

GitNexus OSS supports `analyze --skip-git`; spec-first should expose that as an explicit folder target. The resulting facts need separate identity and freshness fields, and must not write Git fields with invented values.

### D5. Residual cleanup is not part of default migration

Old `.code-review-graph/`, host MCP entries, uv cache and historical provider artifacts may exist on user machines. Default setup/bootstrap/review must ignore them. Removing them belongs to explicit preview-first maintenance guidance, not automatic migration.

### D6. Stale CRG projection is rejected, not tolerated

After U2, source setup emits GitNexus-only `graph-providers.v1`. If a user runs graph-bootstrap against an older `.spec-first/config/graph-providers.json` that still contains CRG, bootstrap should fail closed with an action-required setup refresh message before executing any provider command. This is stricter than silently ignoring CRG because a stale projection is evidence that setup-owned config and source provider registry disagree.

### D7. `related_tests` must be proven, not guessed

GitNexus parity for review support requires related-test evidence. The adapter should prefer GitNexus `impact --include-tests` or an equivalent native result with test provenance. If the current GitNexus surface cannot prove related tests in fixtures, the migration must not claim no-downgrade completion; it must block CRG removal or mark related-test support as candidate-only and keep U1/U5 incomplete.

**R17a triggered: operational branching**

如果 U1 在 fixtures 中无法证明 GitNexus related-test evidence（即 R17a gate 触发）：

1. **U1 + U5 Phase 1 仍执行**：写入 GitNexus normalized facts，但 `related_tests="candidate-only"`，并在 `bootstrap-impact-capabilities.review_support.primary_providers` 标记为 `candidate-only` 而非 ready。
2. **U2 / U3 / U6 / U7 暂停**：CRG 删除阻塞，因为它会让 review-support parity 从已有完整覆盖降级为 candidate-only。U4（non-git folder support）独立于 review-impact parity，可在 U1 完成后单独推进。
3. **创建 follow-up brainstorm**（建议命名 `gitnexus-related-test-evidence`）追踪 GitNexus `impact --include-tests` 或等价能力补齐；该 follow-up 完成并通过 R17a 验证后，才恢复 U2-U9。
4. **CHANGELOG.md 记录**：candidate-only 状态、阻断原因、follow-up 链接；release notes 不得宣称完整 review-impact parity。
5. 此分支不重写 Sequencing；恢复执行时仍按 step 3 (U2) → step 4 (U3) → step 5 (U5 complete) 顺序进行。

### D8. Keep `graph-providers.v1` for this migration

The schema name can remain `graph-providers.v1` even when only GitNexus is present. Renaming the schema would add avoidable migration work and distract from provider removal. The implementation should instead make the v1 content GitNexus-only and reject unknown provider keys.

### D9. Keep `.code-review-graph/` ignored as residual data for one migration window

Managed `.gitignore` may keep `.code-review-graph/` temporarily so old provider storage does not pollute user diffs. Tests and docs must label it as residual local artifact ignore, not active provider support.

Exit criterion: remove the `.code-review-graph/` ignore entry in the first minor release after this migration ships, once users have had one release cycle to run setup. Track the cleanup as a follow-up item in `CHANGELOG.md` Unreleased notes immediately when this migration version is released.

### D10. Legacy CRG uninstall: attempt static cleanup allowlist; fall back to manual guidance

Attempt to preserve `uninstall-mcp --tool code-review-graph` as a legacy cleanup command by routing it through a static cleanup allowlist detached from `mcp-tools.json` registry iteration and baseline readiness. If implementation requires any change to `mcp-tools.json` tool entries or active setup detection scripts to support this path, remove the command path entirely and replace it with manual cleanup guidance in the user manual. The implementer for U2 makes this call and documents the outcome in CHANGELOG.md.

## Target Artifact Contract

### GitNexus provider status

`provider-status.v1` for GitNexus remains the per-provider diagnostic source. It should gain or preserve:

- `provider="gitnexus"`
- `graph_ready`
- `query_ready`
- `readiness_source`
- `refresh_mode`
- `fallback_from_incremental`
- `last_indexed_commit` only for Git repo clean baselines
- `target_kind="git-repo" | "non-git-folder"`
- `folder_snapshot` or equivalent only for non-git targets
- `normalized_artifacts.impact_capabilities`
- `normalized_artifacts.architecture_facts`
- `normalized_artifacts.reuse_candidates`

### GitNexus normalized impact facts

Add `.spec-first/providers/gitnexus/normalized/impact-capabilities.json` as a provider-normalized envelope. It should not copy CRG's private schema. It should expose only what downstream needs:

- `schema_version`
- `provider`
- `source_status_path`
- `available_query_surfaces`
- `capabilities`
- `impact_evidence_surfaces`: GitNexus `detect_changes`, `impact`, `query`, route/API/shape tools where supported
- `review_support`: support level and limitations
- `related_tests`: supported / candidate-only / unavailable
- `source_raw_logs` pointers, not raw log content
- `confidence`
- `limitations`

### Canonical graph facts

`.spec-first/graph/graph-facts.json.capabilities.impact_context` must no longer depend on `provider == "code-review-graph"`. It should be true when GitNexus impact/review support is query-ready enough for primary graph-backed review evidence. When GitNexus is stale, unavailable, non-git limited, or query-unverified, it should be false or limited with explicit limitations.

### Canonical impact capabilities

`.spec-first/impact/bootstrap-impact-capabilities.json` remains the downstream entrypoint:

- `context_selection.primary_providers[]` can include GitNexus when query-ready.
- `impact_radius.primary_providers[]` can include only GitNexus when GitNexus impact surfaces are query-ready.
- `review_support.primary_providers[]` can include only GitNexus when GitNexus review support posture is query-ready.
- fallback support remains direct source reads, git diff, ast-grep, tests/logs; not CRG.

### Residual CRG data

CRG residual paths are non-canonical:

- `.code-review-graph/`
- `.spec-first/providers/code-review-graph/**`
- host config `[mcp_servers."code-review-graph"]`
- uv/uvx caches

They may be named only in cleanup docs or migration warnings, never in readiness truth.

### Active-source cleanup scope

The migration must treat these as active source, not generated runtime mirrors:

- `AGENTS.md` and `CLAUDE.md`
- `skills/spec-mcp-setup/references/supported-mcp-tools.md`
- `skills/spec-graph-bootstrap/evals/expected-behavior-cases.json`
- active user manual pages under `docs/05-用户手册/`

Generated mirrors under `.claude/`, `.codex/` and `.agents/skills/` remain excluded from source edits and are regenerated only through `spec-first init --claude|--codex` when needed.

## Implementation Units

以下 U1-U9 为本次迁移的执行单元；需求覆盖矩阵（Requirement Traceability Matrix）见 U9 之后。

### U1. Add GitNexus canonical impact adapter

**Goal:** Give GitNexus the canonical impact/review slot before CRG removal.

**Requirements:** R1, R4, R5, R17, R17a, R18, R19, R20, R38, R39

**Files:**

- Modify: `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`
- Modify: `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`
- Modify: `docs/contracts/graph-provider-consumption.md`
- Modify: `docs/contracts/graph-evidence-policy.md`
- Test: `tests/unit/spec-graph-bootstrap.sh`
- Test: `tests/unit/spec-graph-bootstrap-contracts.test.js`
- Test: `tests/unit/bootstrap-providers-powershell-contracts.test.js`
- Test: `tests/unit/graph-provider-consumption-contracts.test.js`

**Approach:**

- **Pre-work (baseline scan):** 在开始任何删除操作前，运行 Verification Plan 中的 rg 扫描命令，记录当前 CRG 全量出现位置，与 [Current CRG Touchpoints 表](#current-crg-touchpoints) 对账。解决未覆盖的差异（包括 workspace 层、generated template、checked-in host entry docs 中的路径）后再进入实现；确保 Surface Inventory 不遗漏任何活跃 CRG 路径。
- Extend `write_normalized_artifacts` for `gitnexus` to write `normalized/impact-capabilities.json`.
- Fill GitNexus capabilities from setup catalog plus query proof: `detect_changes`, `impact`, `execution_flow`, `route_api_evidence`, `shape_check`, `related_tests` when supported by checked-in baseline and query-ready provider status.
- Require related-test proof through GitNexus `impact --include-tests` or equivalent fixture-backed native output before marking review-support parity complete (R17a gate: if proof is unavailable, mark `related_tests="candidate-only"` and block CRG deletion for review-support surfaces).
- Change aggregate `graph-facts.capabilities.impact_context` to read GitNexus impact support, not CRG readiness.
- Change `bootstrap-impact-capabilities.v1` producer so `impact_radius` and `review_support` primary providers come from GitNexus.
- Preserve limitations: provider readiness is not semantic proof; review findings still require diff/source/test/log support.

**Test scenarios:**

- GitNexus query-ready writes `providers/gitnexus/normalized/impact-capabilities.json`.
- `bootstrap-impact-capabilities.capabilities.impact_radius.primary_providers == ["gitnexus"]` when GitNexus impact support is available.
- GitNexus query-unverified yields impact/review support partial or none with limitations.
- No canonical artifact references `.spec-first/providers/code-review-graph/normalized/impact-capabilities.json`.

### U2. Remove CRG from setup registry and provider projection

**Goal:** Stop installing, warming, configuring or projecting CRG as a graph provider.

**Requirements:** R1, R2, R3, R4, R5, R6, R7, R33, R34, R35, R36

**Files:**

- Modify: `skills/spec-mcp-setup/mcp-tools.json`
- Modify: `skills/spec-mcp-setup/scripts/write-provider-config.sh`
- Modify: `skills/spec-mcp-setup/scripts/write-provider-config.ps1`
- Modify: `skills/spec-mcp-setup/scripts/detect-tools.sh`
- Modify: `skills/spec-mcp-setup/scripts/detect-tools.ps1`
- Modify: `skills/spec-mcp-setup/scripts/verify-tools.sh`
- Modify: `skills/spec-mcp-setup/scripts/verify-tools.ps1`
- Modify: `skills/spec-mcp-setup/scripts/configure-host.sh`
- Modify: `skills/spec-mcp-setup/scripts/configure-host.ps1`
- Modify: `skills/spec-mcp-setup/scripts/install-mcp.sh`
- Modify: `skills/spec-mcp-setup/scripts/install-mcp.ps1`
- Modify: `skills/spec-mcp-setup/scripts/uninstall-mcp.sh`
- Modify: `skills/spec-mcp-setup/scripts/uninstall-mcp.ps1`
- Modify: `skills/spec-mcp-setup/references/supported-mcp-tools.md`
- Test: `tests/unit/mcp-setup.sh`
- Test: `tests/unit/mcp-setup-powershell-contracts.test.js`

**Approach:**

- Remove the CRG entry from `mcp-tools.json`.
- `supported-mcp-tools.md` 在 U2 中仅删除 CRG tool 描述行（与 mcp-tools.json 的 entry 一一对应）；GitNexus 行的完整 prose 改写在 U6 完成。两次编辑互不重叠，U6 不重新引入 CRG active provider 引用。
- Remove CRG package/version extraction and command hash computation from setup writers.
- Emit only `providers.gitnexus` in `graph-providers.v1`.
- Change `selection` to GitNexus-only or explicit fallback capability: `global_knowledge="gitnexus"`, `impact_context="gitnexus"`, `context_selection="gitnexus"`.
- Remove CRG artifact path generation from `provider-artifacts.v1`.
- Remove `does_not_run_code_review_graph_build`; replace with provider-neutral `does_not_run_provider_refresh` or explicit `does_not_run_gitnexus_analyze`.
- Ensure setup still does not run GitNexus analyze/status/query/impact.
- For residual host CRG MCP config, preserve `uninstall-mcp --tool code-review-graph` only as an explicit legacy cleanup path when it can run from a static cleanup allowlist outside normal registry iteration. If that cannot be implemented without keeping CRG in `mcp-tools.json` or active setup detection, remove the command path and document manual cleanup outside baseline.

**Test scenarios:**

- Tool ids are `sequential-thinking,context7,gitnexus` plus non-provider managed tools only; no `code-review-graph`.
- Setup command log has no `uvx code-review-graph`.
- `graph-providers.json.providers | keys == ["gitnexus"]`.
- `provider-artifacts.json.providers` has no `code-review-graph`.
- Setup baseline does not mention CRG as pending, ready, skipped or optional.
- `verify-tools.*` output and supported tools reference do not describe CRG as required, optional, pending, ready, skipped or warmable.

### U3. Remove CRG from graph-bootstrap execution

**Goal:** Make `$spec-graph-bootstrap` unable to execute CRG in default or incremental paths.

**Requirements:** R8, R9, R10, R11, R12, R13, R14, R15, R16, R26, R28, R37, R45

**Files:**

- Modify: `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`
- Modify: `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`
- Modify: `skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.sh`
- Modify: `skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.ps1`
- Modify: `skills/spec-graph-bootstrap/SKILL.md`
- Test: `tests/unit/spec-graph-bootstrap.sh`
- Test: `tests/unit/bootstrap-providers-powershell-contracts.test.js`
- Test: `tests/unit/spec-graph-bootstrap-contracts.test.js`
- Test: `tests/unit/resolve-workspace-graph-targets-powershell-contracts.test.js`
- Test: `tests/unit/workspace-nested-topology.test.js`

**Approach:**

- Change provider allowlist from `gitnexus|code-review-graph` to `gitnexus` only.
- Remove CRG command shape validation, package identity functions, projection stale failures and version-unverifiable reason codes.
- Remove CRG incremental sentinel replacement logic.
- Remove CRG raw log and normalized artifact writing.
- Remove CRG from workspace target advisory provider summaries; parent workspace target facts must not expose CRG configured/query-ready/status fields as active readiness.
- Update dirty ignore policy per D9: keep `.code-review-graph/` ignored for one migration window as residual artifact protection; tests and prose must explicitly label this as residual ignore, not active provider support. D9 的 exit criterion 在迁移版本发布后的下一个 minor release 移除该 ignore 条目。
- Update bootstrap report and final response examples so they list GitNexus-only readiness.
- **Pull stale projection gate from U8:** Add stale CRG projection rejection logic here so the gate is live immediately after U3 ships. If `.spec-first/config/graph-providers.json` contains any provider key other than `gitnexus`, emit `action-required` with message "provider projection is stale; run `$spec-mcp-setup` to update before running graph-bootstrap" before executing any provider commands.

**Test scenarios:**

- A projected `providers["code-review-graph"]` fixture fails with `unsupported-provider-command`.
- Stale `.spec-first/config/graph-providers.json` containing CRG provider key causes bootstrap to emit `action-required` before any provider command is executed, with recommendation to rerun `$spec-mcp-setup`.
- Full bootstrap runs only GitNexus analyze/status/query proof.
- Incremental bootstrap runs only GitNexus no-force analyze after clean baseline checks.
- Incremental requires prior query-ready GitNexus status, valid ancestor `last_indexed_commit`, unchanged projection/fingerprint and `requires_clean_full_refresh=false`.
- Graph-affecting dirty incremental request downgrades to full dirty-advisory or action-required; it never reports clean incremental success.
- Bootstrap report has no CRG row.
- Existing `.spec-first/providers/code-review-graph/**` does not make bootstrap ready.
- Workspace graph target output has no active `providers["code-review-graph"]` block and ignores old `.spec-first/providers/code-review-graph/status.json` as residual data.

### U4. Implement explicit non-git folder target support

**Goal:** Allow GitNexus indexing in non-git directories without fake Git evidence.

**Requirements:** R11, R12, R15, R16, R21, R22, R23, R24, R25, R26, R28

**Files:**

- Modify: `skills/spec-mcp-setup/scripts/resolve-project-target.sh`
- Modify: `skills/spec-mcp-setup/scripts/resolve-project-target.ps1`
- Modify: `skills/spec-mcp-setup/scripts/write-provider-config.sh`
- Modify: `skills/spec-mcp-setup/scripts/write-provider-config.ps1`
- Modify: `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`
- Modify: `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`
- Modify: `skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.sh`
- Modify: `skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.ps1`
- Modify: `docs/contracts/graph-provider-consumption.md`
- Modify: `docs/contracts/workspace-gitnexus-consumption.md`
- Test: `tests/unit/mcp-setup.sh`
- Test: `tests/unit/spec-graph-bootstrap.sh`
- Test: `tests/unit/resolve-workspace-graph-targets-powershell-contracts.test.js`
- Test: `tests/unit/workspace-nested-topology.test.js`

**Approach:**

- Add explicit target mode `non-git-folder` only when the user names `--folder <path>` / `-Folder <path>` or an equivalent explicit folder flag. Do not silently treat every parent workspace as non-git source.
- For folder targets, setup may write provider config because state_write_allowed is explicit, but must mark `target_kind="non-git-folder"`.
- GitNexus full command for folder target uses `analyze --skip-git --force --skip-agents-md --no-stats`.
- No incremental command is emitted or accepted for non-git folder targets.
- Canonical facts use `folder_snapshot` or `content_fingerprint` fields. They omit or null out Git-only fields with explicit limitations rather than fake values.
- Downstream guidance says non-git supports query/context/architecture orientation but not Git diff-based review-impact or commit-aware freshness.

**Test scenarios:**

- Non-git folder setup does not emit `source_revision`, `branch`, `dirty hash`, `last_indexed_commit` or git status.
- Non-git graph bootstrap invokes GitNexus with `--skip-git`.
- Non-git incremental request is action-required with a clear reason.
- Downstream facts include limitations for no commit, no branch, no Git diff and no incremental.

### U5. Migrate review pre-facts and code-review workflow to GitNexus-only

**Goal:** Replace CRG review-impact consumption with GitNexus evidence plus source/diff/test verification.

**Requirements:** R4, R9, R17, R19, R20, R26, R27, R40, R41

**Files:**

- Modify: `src/cli/helpers/review-pre-facts.js`
- Modify: `skills/spec-code-review/SKILL.md`
- Modify: `docs/contracts/workflows/review-pre-facts-extraction.md`
- Modify: `docs/contracts/downstream-graph-evidence-consumption.md`
- Test: `tests/unit/review-pre-facts-helper.test.js`
- Test: `tests/unit/review-pre-facts-internal-command.test.js`
- Test: `tests/unit/spec-code-review-contracts.test.js`

**Approach:**

> **分阶段执行（对应 Sequencing 中的 U5 partial / U5 complete）：**
> - Phase 1（step 2，U2/U3 之前）：在 CRG 仍存在于 registry 的情况下，添加 GitNexus query plan 发射逻辑和 related-tests 映射，并加入测试门控。此阶段的测试必须在 CRG 还在时通过。
> - Phase 2（step 5，U3 完成后）：移除 `code-review-graph.query` 路由和 `$spec-code-review` 中的 CRG prose。此阶段的测试要求 CRG 已不存在于 source。
> 两个阶段不得合并为一次 PR；Phase 1 通过后才能进行 U2/U3 的 CRG 删除。

- Remove `readiness.target_provider?.provider === "code-review-graph" ? "code-review-graph.query" : ...`.
- Always emit GitNexus query plan when graph-fresh GitNexus has a query surface; otherwise emit bounded direct-read candidates.
- For code review, map GitNexus `detect_changes` / `impact --include-tests` / route/API/shape surfaces into a bounded `<graph-review-evidence>` or equivalent evidence block.
- Keep findings confidence-gated: provider output can suggest affected files/symbols/tests, but every finding must be backed by diff/source/tests/contracts/logs.
- Record degraded-once Coverage when GitNexus is stale/unavailable/query-unverified.
- Do not let GitNexus extra impact auto-expand implementation or autofix scope.

**Test scenarios:**

- Query plan never contains `code-review-graph.query`.
- Fresh GitNexus query-ready emits `gitnexus.query`.
- Stale GitNexus emits bounded direct reads with reason code.
- Code-review prose says GitNexus-only provider evidence and direct-read fallback, with no CRG fallback.

### U6. Migrate graph contracts, workflow prose, README and user manuals

**Goal:** Make user and agent guidance match the GitNexus-only runtime.

**Requirements:** R5, R9, R26, R27, R28, R29, R30, R31, R32, R42, R46

**Files:**

- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `docs/05-用户手册/README.md`
- Modify: `docs/05-用户手册/01-快速开始.md`
- Modify: `docs/05-用户手册/02-核心概念.md`
- Modify: `docs/05-用户手册/04-workflows-artifacts-map.md`
- Modify: `docs/05-用户手册/04-常见问题.md`
- Modify: `docs/05-用户手册/05-最佳实践.md`
- Modify: `docs/05-用户手册/08-三种开发模式.md`
- Modify: `docs/05-用户手册/09-首次工作流走查.md`
- Modify: `docs/05-用户手册/12-gitignore参考.md`
- Modify: `docs/05-用户手册/13-代码图谱Provider作用域与差异化.md`
- Modify: `docs/05-用户手册/14-GitNexus-全流程执行分析.md`
- Modify: `docs/05-用户手册/16-GitNexus-增量刷新机制与spec-first刷新策略评估.md`
- Modify: `docs/contracts/graph-evidence-policy.md`
- Modify: `docs/contracts/graph-provider-consumption.md`
- Modify: `docs/contracts/source-runtime-customization-boundary.md`
- Modify: `docs/catalog/runtime-capabilities.md`
- Modify: `scripts/generate-runtime-capability-catalog.js`
- Modify: `skills/spec-mcp-setup/references/supported-mcp-tools.md`
- Modify: `skills/spec-plan/SKILL.md`
- Modify: `skills/spec-work/SKILL.md`
- Modify: `skills/spec-debug/SKILL.md`
- Modify: `skills/spec-doc-review/SKILL.md`
- Modify: `skills/spec-graph-bootstrap/SKILL.md`
- Modify: `skills/spec-mcp-setup/SKILL.md`
- Modify: `skills/using-spec-first/SKILL.md`
- Modify: `skills/spec-graph-bootstrap/evals/expected-behavior-cases.json`
- Modify: `templates/claude/commands/spec/graph-bootstrap.md`
- Modify: `templates/claude/commands/spec/mcp-setup.md`
- Test: `tests/unit/graph-provider-consumption-contracts.test.js`
- Test: `tests/unit/spec-plan-contracts.test.js`
- Test: `tests/unit/spec-work-contracts.test.js`
- Test: `tests/unit/spec-debug-contracts.test.js`
- Test: `tests/unit/spec-doc-review-contracts.test.js`
- Test: `tests/unit/spec-graph-bootstrap-contracts.test.js`
- Test: `tests/unit/using-spec-first-contracts.test.js`
- Test: `tests/unit/user-manual-contracts.test.js`
- Test: `tests/unit/readme-language-split.test.js`
- Test: `tests/unit/runtime-contract-boundary.test.js`
- Test: `tests/unit/runtime-capability-catalog.test.js`
- Test: `tests/unit/init-dry-run.test.js`

**Approach:**

- Replace “GitNexus/code-review-graph readiness” with “GitNexus readiness”.
- Replace “code-review-graph build” in no-refresh boundaries with provider-neutral “provider index rebuild” or GitNexus-only wording where appropriate.
- Keep historical user manuals, but add retired/historical labels where they discuss CRG as active behavior.
- Sweep active user manual pages, checked-in host entry docs and workflow eval fixtures; do not rely only on README / 04 / 05 edits.
- Codex runtime regeneration 完全从 skill source 派生，本仓库不存在 host-specific codex templates；本单元因此不列 `templates/codex/*`。如基线扫描（U1 Pre-work）发现 codex 侧确有 host-specific templates，需补回 Files 列表并重新跑 U6 测试，不得跳过。
- Update graph evidence policy provider roles: GitNexus is graph/impact/review provider; ast-grep/direct reads/tests/logs are fallback; CRG is historical only.
- Update `$spec-graph-bootstrap` prose to describe GitNexus full/incremental/folder modes and no CRG execution.
- Regenerate or edit `docs/catalog/runtime-capabilities.md` through its source generator so runtime catalog facts no longer list CRG as current provider fact source.

**Test scenarios:**

- Public docs do not describe CRG as current required/default/fallback provider.
- `AGENTS.md`, `CLAUDE.md`, setup reference docs and eval fixtures do not describe CRG as current provider or current test surface.
- Workflow prose does not say “use code-review-graph”.
- Historical analysis docs can still mention CRG with retired/historical labels.
- README quickstart recommends GitNexus-only graph readiness.
- Runtime capability catalog says provider facts come from GitNexus, browser/MCP tools, package managers and shell commands; CRG appears only as retired/historical if mentioned.

### U7. Update no-CRG-provider tests and CI quality gate

**Goal:** Prevent CRG provider paths from returning.

**Requirements:** R29, R30, R43, R44a, R44b, R45, R46

**Files:**

- Modify: `scripts/run-ai-dev-quality-gate.js`
- Modify: `.github/workflows/ai-dev-quality-gate.yml`
- Modify: `src/cli/contracts/quality-gates/branch-protection-policy.json`
- Modify: `src/cli/gitignore-policy.js`
- Test (assertions updated and run): `tests/unit/no-crg-runtime-contracts.test.js`
- Test (assertions updated and run): `tests/unit/runtime-tools-index.test.js`
- Test (assertions updated and run): `tests/unit/no-graph-fast-path-contracts.test.js`
- Test (assertions updated and run): `tests/unit/runtime-capability-catalog.test.js`
- Test (assertions updated and run): `tests/unit/resolve-workspace-graph-targets-powershell-contracts.test.js`
- Test (assertions updated and run): `tests/unit/workspace-nested-topology.test.js`
- Test (assertions updated and run): `tests/unit/branch-protection-policy.test.js`
- Test (assertions updated and run): `tests/unit/init-dry-run.test.js`
- Test (assertions updated and run): `tests/unit/gitignore-policy.test.js`
- Test (assertions updated and run): `tests/unit/npm-install-matrix-smoke.test.js`

**Approach:**

- Keep existing guard that `src/crg/` and `spec-first crg` do not reappear.
- Add active-provider denylist checks for:
  - `skills/spec-mcp-setup/mcp-tools.json`
  - `skills/spec-mcp-setup/scripts/write-provider-config.*`
  - `skills/spec-mcp-setup/scripts/verify-tools.*`
  - `skills/spec-mcp-setup/references/supported-mcp-tools.md`
  - `skills/spec-graph-bootstrap/scripts/bootstrap-providers.*`
  - `skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.*`
  - `skills/spec-graph-bootstrap/evals/expected-behavior-cases.json`
  - `src/cli/helpers/review-pre-facts.js`
  - active workflow prose
  - README / checked-in host entry docs / runtime tools catalog
- Allow CRG mentions only in historical docs, migration docs, cleanup docs, changelog and test names that explicitly enforce no-CRG behavior.
- Keep `.code-review-graph/` in managed `.gitignore` for one migration window as residual local artifact protection. Tests must explain it as residual ignore, not active provider support.
- Keep no-CRG-provider coverage in branch-protection/quality-gate policy so changes to workflow, setup, review or provider contracts continue to run the guard.

**Test scenarios:**

- Active source scan finds no CRG install/refresh/use path.
- Active source scan finds no CRG workspace readiness, setup reference or eval-fixture provider path.
- Historical docs are excluded only with explicit allowlist.
- CI quality gate runs no-CRG-provider tests.
- Branch-protection policy still covers no-CRG-provider guard paths.

### U8. Handle upgrade projection and residual cleanup guidance

**Goal:** Make old CRG config safe during upgrade without automatic deletion.

**Requirements:** R13, R14, R16, R45, R47

**Files:**

- Modify: `skills/spec-mcp-setup/scripts/write-provider-config.sh`
- Modify: `skills/spec-mcp-setup/scripts/write-provider-config.ps1`
- Modify: `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`
- Modify: `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`
- Modify: `skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.sh`
- Modify: `skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.ps1`
- Modify: `skills/spec-mcp-setup/SKILL.md`
- Modify: `skills/spec-graph-bootstrap/SKILL.md`
- Test: `tests/unit/mcp-setup.sh`
- Test: `tests/unit/spec-graph-bootstrap.sh`
- Test: `tests/unit/bootstrap-providers-powershell-contracts.test.js`
- Test: `tests/unit/resolve-workspace-graph-targets-powershell-contracts.test.js`

**Approach:**

- Setup rewrites older `graph-providers.v1` projections to contain only GitNexus when source registry no longer has CRG.
- The bootstrap action-required gate for stale CRG projection is implemented in U3; U8 validates that setup's projection rewrite eliminates the stale state for upgrade users, and documents the expected upgrade flow in SKILL.md.
- The recommended action for stale CRG projection is rerun `$spec-mcp-setup`, not manually edit `.spec-first/config/graph-providers.json`.
- Document residual cleanup separately: old `.code-review-graph/`, host MCP config and uv cache can be removed only through explicit maintenance guidance.

**Test scenarios:**

- Existing projection fixture with CRG is overwritten by setup output.
- Direct bootstrap with stale CRG projection fails before command execution.
- Old `.spec-first/providers/code-review-graph/**` is ignored when compiling current readiness.
- Parent workspace target resolution ignores old `.spec-first/providers/code-review-graph/**` when compiling current workspace advisory facts.
- Cleanup guidance does not run by default.

### U9. Preserve source/runtime boundary and changelog

**Goal:** Ship the migration without editing generated runtime mirrors as source and with accurate release notes.

**Requirements:** R29, R32, R48

**Files:**

- Modify: `CHANGELOG.md`
- Run: `spec-first init --claude --codex` (required after U6; see Approach for details)
- Test: `npm run lint:skill-entrypoints`
- Test: `npm run typecheck`
- Test: `npm run test:mcp-setup`
- Test: `npm run test:graph-bootstrap`
- Test: `npm run test:unit`

**Approach:**

- Add changelog entries for each source-visible migration stage.
- Do not claim “CRG removed” until U1-U7 pass.
- Include U8 stale-projection behavior in release notes so upgrade users know to rerun setup before bootstrap if they hit an old projection.
- **Required after U6:** Since U6 modifies 7+ SKILL.md files and templates, run `spec-first init --claude --codex` after U6 completes to repair runtime drift. Review generated diffs before committing them separately. Do not skip this step — U6 without runtime regeneration leaves `.claude/`/`.codex/`/`.agents/skills/` carrying stale CRG content.
- Avoid hand editing `.claude/`, `.codex/` or `.agents/skills/`; runtime regeneration must use the source generator only.

## Requirement Traceability Matrix

| Requirements | Covered by |
| --- | --- |
| R1-R5 Provider hard cut and no new provider | U1, U2, U3, U5, U6, U7 |
| R6-R9 setup/bootstrap ownership and no downstream refresh | U2, U3, U5, U6 |
| R10-R16 refresh modes, incremental baseline and commit metadata boundary | U3, U4, U8 |
| R17, R17a GitNexus review-impact parity and related-test gate | U1, U5 |
| R18-R20 canonical impact facts and scope authority | U1, U5 |
| R21-R25 non-git folder target | U4 |
| R26-R28 mutation boundary | U3, U4, U5, U6 |
| R29-R32 docs, migration and release claim boundary | U6, U9 |
| R33-R37 CRG lifecycle removal from setup/bootstrap/workspace target readiness | U2, U3, U8 |
| R38-R41 canonical impact/readiness and review pre-facts migration | U1, U5 |
| R42-R44b workflow prose, tests and no-CRG-provider guard | U6, U7 |
| R45-R48 residual data, runtime catalog, stale projection and source/runtime boundary | U6, U7, U8, U9 |

## Sequencing

1. U1: Add GitNexus impact adapter and canonical artifact mapping.
2. U5 partial: Make review-pre-facts able to consume GitNexus-only impact facts while CRG still exists, behind tests.
3. U2: Remove CRG from setup registry and provider projection.
4. U3: Remove CRG execution from graph-bootstrap.
5. U5 complete: Remove CRG from code-review workflow prose and query routing.
6. U4: Add non-git folder target mode. This can run after U2/U3 because it touches target resolution and GitNexus command shape.
7. U6: Update contracts, workflow prose, checked-in host entry docs, setup references, eval fixtures, README and user manuals.
8. U7: Tighten no-CRG-provider tests and CI gate.
9. U8: Handle stale projection upgrade and residual cleanup guidance.
10. U9: Changelog, broad validation, required runtime regeneration after U6.

The key dependency is U1 before U2/U3 deletion. The rest can be split into smaller PRs only if each intermediate state keeps CRG from being removed before GitNexus impact parity is usable.

U6 文件量较大（~30 个 source files），建议执行时拆为 U6a (contracts + workflow prose + checked-in host entry docs + skill SKILL.md) 与 U6b (user manuals + templates + runtime catalog + setup reference + eval fixtures) 两个 PR 提交。U6a / U6b 之间不强制顺序，但 U6b 合并前一致性测试和 Verification Plan 的扫描命令必须全过。如果 U7 的 active-source 扫描在 U6a 与 U6b 之间运行，应在测试中允许 U6b 待修改路径作为已知 known-pending 列表，避免误报阻塞。

## Verification Plan

Run the narrow tests as each unit lands:

- `npm run test:mcp-setup`
- `npm run test:graph-bootstrap`
- `npx jest tests/unit/review-pre-facts-helper.test.js tests/unit/review-pre-facts-internal-command.test.js --runInBand`
- `npx jest tests/unit/graph-provider-consumption-contracts.test.js tests/unit/spec-code-review-contracts.test.js --runInBand`
- `npx jest tests/unit/no-crg-runtime-contracts.test.js tests/unit/runtime-tools-index.test.js tests/unit/user-manual-contracts.test.js --runInBand`
- `npx jest tests/unit/runtime-capability-catalog.test.js tests/unit/resolve-workspace-graph-targets-powershell-contracts.test.js tests/unit/workspace-nested-topology.test.js --runInBand`
- `npx jest tests/unit/branch-protection-policy.test.js tests/unit/runtime-contract-boundary.test.js --runInBand`

Before claiming migration complete:

- `npm run typecheck`
- `npm run lint:skill-entrypoints`
- `npm run test:unit`
- `npm run test:mcp-setup`
- `npm run test:graph-bootstrap`
- `npm test` if the work touches package/install, CLI entrypoints, runtime projection or broad docs.

Add focused scan checks:

```bash
rg -n "code-review-graph|CRG|crg|\\.code-review-graph" \
  AGENTS.md CLAUDE.md README.md README.zh-CN.md \
  docs/contracts "docs/05-用户手册" docs/catalog \
  skills src/cli templates tests scripts .github \
  --glob '!docs/plans/**' --glob '!docs/brainstorms/**' \
  --glob '!CHANGELOG.md'
```

Allowed matches after implementation should be limited to: historical docs (with retired/historical labels), explicit residual cleanup guidance, no-CRG-provider test file names and assertions, and `.gitignore` residual artifact entry (per D9). CHANGELOG.md is excluded from the scan; its CRG mentions are expected and managed separately.

## Risks

- **Review downgrade risk:** If GitNexus impact adapter is too thin, `$spec-code-review` loses related tests or blast-radius evidence. Mitigation: U1 before deletion and acceptance tests for impact/review support.
- **Over-broad string deletion risk:** Removing all CRG mentions blindly may delete historical context or no-regression tests. Mitigation: explicit allowlist for historical docs and no-CRG tests.
- **Setup baseline regression:** Removing CRG from `mcp-tools.json` can break scripts that assume all graph providers have entries. Mitigation: update setup writer, detector, shell tests and PowerShell tests together.
- **Bootstrap schema drift:** Existing consumers may read `ready_primary_providers[]`. Mitigation: keep compatible aggregate fields temporarily while changing capability semantics and tests.
- **Non-git evidence confusion:** Folder target could accidentally look like Git readiness. Mitigation: separate `target_kind`, content/folder snapshot fields and limitations; no fake Git fields.
- **Residual artifact confusion:** Old `.spec-first/providers/code-review-graph/*` may remain on disk. Mitigation: active compilers ignore it and tests prove readiness does not derive from it.
- **Source generator path coverage risk:** `spec-first init --claude --codex` 不会自动捕获 U6 新增 source path 在 generator 配置中缺失的情况，可能导致 source 已无 CRG 但 runtime mirror 仍含旧字符串。Mitigation：U9 验证步骤中补一次性 audit 扫描 `.claude/`、`.codex/`、`.agents/skills/` 是否仍含 `code-review-graph`；扫描结果属于 audit evidence，不纳入持续 context。若发现残留，先修 generator/source-path 映射，再重新运行 `spec-first init --claude --codex`，**禁止** 手改 runtime mirror。
