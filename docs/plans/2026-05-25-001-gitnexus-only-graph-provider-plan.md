---
title: refactor: GitNexus-only graph provider hard cut and CRG removal
type: refactor
status: completed
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

### D7. `related_tests` must be proven, not guessed; candidate-only is the expected default

Source-of-truth check（锚点 `docs/contracts/gitnexus-capability-catalog.md`、`skills/spec-mcp-setup/mcp-tools.json` 中 `gitnexus.impact` capability）显示 GitNexus 当前原生暴露 `impact` 与 `detect_changes`，**未声明** `--include-tests` flag 或任何 `related_tests` capability。R17a 的 candidate-only 分支因此是 U1 实施时的**预期默认路径**，而非例外 fallback；plan 必须把完整 parity 视为有条件的成功路径，candidate-only 视为 upstream GitNexus 补齐 related-test provenance 之前的入口状态。

GitNexus parity for review support requires related-test evidence. The adapter should prefer GitNexus `impact --include-tests` or an equivalent native result with test provenance. If the current GitNexus surface cannot prove related tests in fixtures, the migration must not claim no-downgrade completion; it must block CRG removal or mark related-test support as candidate-only and keep U1/U5 incomplete.

**R17a triggered: operational branching**

如果 U1 在 fixtures 中无法证明 GitNexus related-test evidence（按 source-of-truth check 这是当前预期默认路径，而非 R17a 例外触发）：

1. **U1 + U5 Phase 1 仍执行**：写入 GitNexus normalized facts，但 `related_tests="candidate-only"`，并在 `bootstrap-impact-capabilities.review_support.primary_providers` 标记为 `candidate-only` 而非 ready。Producer 写入条件与 consumer 披露义务详见 [Target Artifact Contract → Candidate-only consumer semantics](#candidate-only-consumer-semantics)。
2. **U2 / U3 / U6 / U7 暂停**：CRG 删除阻塞，因为它会让 review-support parity 从已有完整覆盖降级为 candidate-only。U4（non-git folder support）独立于 review-impact parity，可在 U1 完成后单独推进；但 U4 单飞期间**不得弱化或修改** `tests/unit/mcp-setup.sh`、`tests/unit/spec-graph-bootstrap.sh` 中现存的 CRG-side assertions——CRG-side test edits 仍属 U2/U3 owner，待 R17a 解锁后再修改，避免出现 R17a 解锁后 U2/U3 测试 baseline 已被 U4 改写的混乱状态。
3. **上报阻断 + CHANGELOG 正向披露**：在 `CHANGELOG.md` Unreleased 段记录 candidate-only 状态、阻断原因、阻断范围（U2/U3/U6/U7 暂停）。Release notes 必须**正向披露** review-impact parity 处于 candidate-only 状态及其对 `$spec-code-review` 的影响（仅"不得过度宣称"是不够的，必须主动告知 user）。是否、何时创建 follow-up brainstorm（占位命名建议 `docs/brainstorms/<date>-gitnexus-related-test-evidence-requirements.md`）由项目维护者裁定，不在 plan 自动触发——避免 plan 文档越界发起其它 spec-first workflow。
4. **Release / version posture（best-judgment 默认）**：触发 candidate-only 时**默认 hold release**——本迁移版本（GitNexus-only）不打 tag、不发布；U1 留在 main 作为中间产物，待 follow-up 验收 R17a 通过后再恢复 U2-U9 并发布。如项目维护者另有判断（例如以 `-rc` + candidate-only label 发布中间版本），需在 PR 与 CHANGELOG 中显式覆写本默认。该选择是 plan 层面的 best-judgment 默认，非硬性约束。
5. 此分支不重写 Sequencing；恢复执行时仍按 step 3 (U2) → step 4 (U3) → step 5 (U5 complete) 顺序进行。

### D8. Keep `graph-providers.v1` for this migration

The schema name can remain `graph-providers.v1` even when only GitNexus is present. Renaming the schema would add avoidable migration work and distract from provider removal. The implementation should instead make the v1 content GitNexus-only and reject unknown provider keys.

### D9. Keep `.code-review-graph/` ignored as residual data for one migration window

Managed `.gitignore` must keep `.code-review-graph/` temporarily so old provider storage does not pollute user diffs. Tests and docs must label it as residual local artifact ignore, not active provider support.

Exit criterion: remove the `.code-review-graph/` ignore entry in the first minor release after this migration ships, once users have had one release cycle to run setup. Track the cleanup as a follow-up item in `CHANGELOG.md` Unreleased notes immediately when this migration version is released.

**Mechanical guard for exit criterion**：U7 必须以代码形式守护 exit criterion，不能仅靠 prose + Unreleased note。具体在 `src/cli/gitignore-policy.js`（或对应 metadata 表）为 `.code-review-graph/` 条目附 `residual-ignore-expiry` 字段（按当前 minor 版本号 + 1 计算 expiry，例如本迁移随 `1.X` 发布则 expiry 为 `1.(X+1)`）。`tests/unit/no-crg-runtime-contracts.test.js` 在加载时读取当前 `package.json` 版本：当版本 ≥ expiry 且条目仍存在 → 强制 fail，强迫下一 minor PR 必须触碰这条 ignore（移除条目或显式延长 expiry 并在 CHANGELOG 解释延长理由）。仅靠 Unreleased note 不形成持续保障；机械 guard 是 exit criterion 的兑现机制。

### D10. Legacy CRG uninstall: drop command path, ship manual cleanup guidance

`skills/spec-mcp-setup/scripts/uninstall-mcp.sh|.ps1` 当前完全由 `mcp-tools.json` 的 `tools[].id`/`host_config`/`config_path`/`uninstall_targets` 驱动；U2 移除 CRG 入口后，`uninstall-mcp --tool code-review-graph` 任何参数查询都会返回 null。把"静态 cleanup allowlist 脱离 mcp-tools.json"改造成跨 4 OS × 2 host 的并行数据表，是把面向 user 的清理决策推迟到 U2 implementer 在时间压力下临时拍板，违反 spec-first 的 source/runtime 边界与 D5 "残留清理不属于默认迁移" 决策粒度。

因此本迁移**直接选择 manual-guidance fallback**，不再保留尝试性的静态 allowlist 路径：

- 在 U2 删除 `uninstall-mcp --tool code-review-graph` 命令路径，命令对该 tool id 报 unsupported（与其它未注册 tool 一致）。
- 在 U6 的 `docs/05-用户手册/` 加显式手动清理章节，覆盖 Claude `~/.claude.json` 与 Codex `~/.codex/config.toml` 残留 `[mcp_servers."code-review-graph"]` 的删除步骤（Bash + PowerShell + Windows 路径），以及 `.code-review-graph/`、uv/uvx cache、`.spec-first/providers/code-review-graph/**` 的可选清理建议。
- U2 测试明确断言 `uninstall-mcp --tool code-review-graph` 报 unsupported tool 而非执行清理，并断言用户手册存在对应章节（防止"删除命令但忘了写手册"的退化）。

放弃 attempt-allowlist 的代价是少一个 one-shot 命令；好处是 plan 层面没有未决决策、user UX 在 plan 阶段已定稿、与 D5/G5 的 evidence-input-only posture 一致。该决策不再延迟到 implementer。

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

`.spec-first/graph/graph-facts.json.capabilities.impact_context` must no longer depend on `provider == "code-review-graph"`. The `impact_context` field remains a boolean for compatibility with existing Bash/PowerShell consumers. It should be true only when GitNexus impact/review support is query-ready enough for primary graph-backed review evidence. When GitNexus is stale, unavailable, non-git limited, query-unverified, or related-tests are only candidate evidence, it should be `false` with explicit status/limitations metadata such as `impact_context_status: "limited"` and `limitations:["related_tests_unverified"]`.

### Canonical impact capabilities

`.spec-first/impact/bootstrap-impact-capabilities.json` remains the downstream entrypoint:

- `context_selection.primary_providers[]` can include GitNexus when query-ready.
- `impact_radius.primary_providers[]` can include only GitNexus when GitNexus impact surfaces are query-ready.
- `review_support.primary_providers[]` can include only GitNexus when GitNexus review support posture is query-ready.
- fallback support remains direct source reads, git diff, ast-grep, tests/logs; not CRG.

### Candidate-only consumer semantics

D7 R17a 引入 `candidate-only` 作为 `review_support` 的新公开 readiness 状态。该状态在 producer 与 consumer 之间必须有显式契约，否则 downstream workflows 会把 `gitnexus` 出现在 `review_support.primary_providers[]` 解读为完整 ready，使 candidate-only 静默退化为 false-positive parity。

**Producer 写入条件**（U1 实现）：

- `providers/gitnexus/normalized/impact-capabilities.json.review_support.related_tests` ∈ `{ "supported", "candidate-only", "unavailable" }`，由 GitNexus query 输出是否含 test provenance 决定。
- 当 `related_tests == "candidate-only"`：
  - `bootstrap-impact-capabilities.review_support.primary_providers[]` 仍可包含 `gitnexus`，但必须在同对象内附 `related_tests_status: "candidate-only"` 与 `limitations: ["related_tests_unverified"]`。
  - `graph-facts.capabilities.impact_context` 保持 boolean contract，设为 `false`；另写 `graph-facts.capabilities.impact_context_status: "limited"`（或同级兼容 metadata）并附 limitation `related_tests_unverified`。不要把 `impact_context` 改成字符串，避免 PowerShell `[bool]` 强转把 `"limited"` 误读成 `true`。

**Consumer 必有的披露行为**（U5 + U6 实现，consumer contract 落在 `docs/contracts/graph-provider-consumption.md` 与 `docs/contracts/graph-evidence-policy.md`）：

- `$spec-code-review` 读取 `review_support.related_tests_status == "candidate-only"` 时，**不得**在 final response 宣称 GitNexus 完整 review-impact parity；必须在 Coverage 显式标注 `related_tests=candidate-only (provider-unverified)` 并提示 reviewer 自行结合 diff/源码/tests 验证 related-test 范围。
- `$spec-plan` / `$spec-work` / `$spec-debug` 读取 `impact_context == false` 且 `impact_context_status == "limited"`（或 limitations 含 `related_tests_unverified`）时，按 stale graph + bounded-reads 等价处理，不在 plan/work/debug 输出中声称 graph-fresh evidence。
- workflow 在 candidate-only 状态下**不得**自动扩大 implementation/autofix scope（与 U5 既有 "no auto-expansion" 约束对齐）。

**测试落点**：U1 fixture 覆盖 producer 写入路径；U5 fixture 覆盖 `$spec-code-review` 在 candidate-only 状态下的 Coverage 披露行为；U6 contract test 覆盖 graph-provider-consumption.md / graph-evidence-policy.md 含 candidate-only 章节。

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

- **Pre-work (baseline scan):** 在开始任何删除操作前，运行 Verification Plan 中的 rg 扫描命令，记录当前 CRG 全量出现位置，与 [Current CRG Touchpoints 表](#current-crg-touchpoints) 对账。解决未覆盖的差异（包括 workspace 层、generated template、checked-in host entry docs 中的路径）后再进入实现；确保 Surface Inventory 不遗漏任何活跃 CRG 路径。该 baseline scan 同时枚举 `tests/` 下所有含 CRG 字符串的 fixture，并按 positive / negative / historical 分类，避免 U2 删除 source CRG 知识后 negative-test fixture "为错误的原因测过"。
- Extend `write_normalized_artifacts` for `gitnexus` to write `normalized/impact-capabilities.json`.
- Fill GitNexus capabilities from setup catalog plus query proof: `detect_changes`, `impact`, `execution_flow`, `route_api_evidence`, `shape_check`, `related_tests` when supported by checked-in baseline and query-ready provider status.
- Require related-test proof through GitNexus `impact --include-tests` or equivalent fixture-backed native output before marking review-support parity complete (R17a gate: if proof is unavailable, mark `related_tests="candidate-only"` and block CRG deletion for review-support surfaces).
- Change aggregate `graph-facts.capabilities.impact_context` to read GitNexus impact support, not CRG readiness。当 `related_tests == "candidate-only"` 时保持 `impact_context=false`，并通过 `impact_context_status:"limited"` / `limitations:["related_tests_unverified"]` 披露受限状态（按 [Candidate-only consumer semantics](#candidate-only-consumer-semantics) 的 producer 写入条件）。
- Change `bootstrap-impact-capabilities.v1` producer so `impact_radius` and `review_support` primary providers come from GitNexus；当处于 candidate-only 时附 `related_tests_status` 与 `limitations` 字段，schema 详见 [Candidate-only consumer semantics](#candidate-only-consumer-semantics)。
- **Candidate-only contract（强约束）**：U1 修改 `docs/contracts/graph-provider-consumption.md` 与 `docs/contracts/graph-evidence-policy.md` 时**必须**新增 candidate-only 章节，定义 producer 写入条件 + consumer 必有的披露行为（与 U5 / U6 同步）。U1 在两份 contracts 中只新增 candidate-only 章节与 GitNexus impact adapter 章节；既有 prose（CRG 相关、provider 通用规则）的 GitNexus-only 重写归 U6 owner，U1 在保留 CRG-mention 处加 `<!-- TODO(U6): migrate to GitNexus-only prose -->` 注释，避免 U1/U6 同文件 split 不清。
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
- 按 D10 决策**直接走 manual-guidance 路径**：U2 删除 `uninstall-mcp.sh|.ps1` 中针对 `code-review-graph` 的执行分支（registry-driven 查不到 CRG 后命令对该 tool id 报 unsupported；与其它未注册 tool 行为一致），不实现静态 cleanup allowlist。U6 在 `docs/05-用户手册/` 加显式手动清理章节覆盖 host MCP 残留 + `.code-review-graph/` + uv cache + 历史 provider artifacts。

**Test scenarios:**

- Tool ids are `sequential-thinking,context7,gitnexus` plus non-provider managed tools only; no `code-review-graph`.
- Setup command log has no `uvx code-review-graph`.
- `graph-providers.json.providers | keys == ["gitnexus"]`.
- `provider-artifacts.json.providers` has no `code-review-graph`.
- Setup baseline does not mention CRG as pending, ready, skipped or optional.
- `verify-tools.*` output and supported tools reference do not describe CRG as required, optional, pending, ready, skipped or warmable.
- `uninstall-mcp --tool code-review-graph` reports the tool as unsupported (与其它未注册 tool 一致)，不再执行清理路径；测试同时断言 `docs/05-用户手册/` 存在显式 CRG 手动清理章节，防止"删除命令但忘了写手册"的退化。

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
- **混合版本 workspace 处理**：父级 multi-repo workspace 中可能存在尚未升级到本迁移版本的子仓，这些子仓会**合法地**产出新鲜 CRG `status.json`。U3 不读取 host runtime config marker；当前 resolver 已有的 source-of-truth 是子仓 `.spec-first/config/graph-providers.json` 与 `.spec-first/providers/code-review-graph/status.json`。因此必须区分两种情况，emit 不同 reason_code：(a) 子仓 setup-owned `graph-providers.v1` 仍含 `providers["code-review-graph"]` 且 CRG `status.json` 新鲜 → reason_code `child-on-legacy-spec-first-version`，建议用户在该子仓内升级 spec-first 并重跑 `$spec-mcp-setup`；(b) 仅有历史 `.spec-first/providers/code-review-graph/**`，但 setup-owned projection 不含 CRG 或已超过最近 refresh 窗口 → reason_code `crg-residue-ignored`（按已有 residual 处理）。两种 reason_code 的修复指引不同，不能合并。
- Update dirty ignore policy per D9: keep `.code-review-graph/` ignored for one migration window as residual artifact protection; tests and prose must explicitly label this as residual ignore, not active provider support. D9 的 exit criterion 在迁移版本发布后的下一个 minor release 移除该 ignore 条目，机械保障由 U7 的 `tests/unit/no-crg-runtime-contracts.test.js` 通过 `residual-ignore-expiry` 元数据守护（详见 D9）。
- Update bootstrap report and final response examples so they list GitNexus-only readiness.
- **Stale projection gate（D6 决策；U3 implementer，U8 verifier）**：D6 决策本 gate 的存在与设计；U3 在此实现 gate 代码；U8 验证 setup 重写 projection 后无残留 stale state 并写 SKILL.md upgrade 指引。如果 `.spec-first/config/graph-providers.json` 含 `gitnexus` 以外的任何 provider key，bootstrap 在执行任何 provider 命令前 emit `action-required`，message: "provider projection is stale; run `$spec-mcp-setup` to update before running graph-bootstrap"。
- **Concurrent setup + bootstrap atomic-write 边界（advisory，非本 unit 强约束）**：本 gate 仅按 provider-key 扫描，无法防御 hand-edited `graph-providers.json`（用户手动删除 CRG key 即可绕过 gate）以及 setup 与 bootstrap 并发写入时的中间态。是否给 `graph-providers.v1` 加 setup-owned fingerprint 字段或要求原子写（temp + rename）属于 contract surface 决策，已 defer 到 [Open Questions](#deferred--open-questions)。U3 实现 gate 时按 provider-key 扫描即可，不在本 unit 引入 fingerprint。

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
- Mixed-version workspace fixture：父仓 + 子仓 A（已升级至迁移版本，gitnexus-only）+ 子仓 B（尚未升级，`graph-providers.v1` 仍含 `providers["code-review-graph"]` 且 CRG `status.json` 新鲜）+ 子仓 C（仅含历史 CRG residue，无 active setup projection）；U3 输出对子仓 B emit `child-on-legacy-spec-first-version`，对子仓 C emit `crg-residue-ignored`，二者不互相吞没。

### U4. Implement explicit non-git folder target support

**Goal:** Allow GitNexus indexing in non-git directories without fake Git evidence.

**Requirements:** R11, R12, R15, R16, R21, R22, R23, R24, R25, R26, R28

**Files:**

- Modify: `skills/spec-mcp-setup/scripts/resolve-project-target.sh`
- Modify: `skills/spec-mcp-setup/scripts/resolve-project-target.ps1`
- Modify: `skills/spec-mcp-setup/scripts/detect-tools.sh`
- Modify: `skills/spec-mcp-setup/scripts/detect-tools.ps1`
- Modify: `skills/spec-mcp-setup/scripts/install-mcp.sh`
- Modify: `skills/spec-mcp-setup/scripts/install-mcp.ps1`
- Modify: `skills/spec-mcp-setup/scripts/verify-tools.sh`
- Modify: `skills/spec-mcp-setup/scripts/verify-tools.ps1`
- Modify: `skills/spec-mcp-setup/scripts/bootstrap-project-config.sh`
- Modify: `skills/spec-mcp-setup/scripts/bootstrap-project-config.ps1`
- Modify: `skills/spec-mcp-setup/scripts/write-provider-config.sh`
- Modify: `skills/spec-mcp-setup/scripts/write-provider-config.ps1`
- Modify: `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`
- Modify: `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`
- Modify: `skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.sh`
- Modify: `skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.ps1`
- Modify: `docs/contracts/graph-provider-consumption.md`
- Modify: `docs/contracts/workspace-gitnexus-consumption.md`
- Test: `tests/unit/mcp-setup.sh`
- Test: `tests/unit/mcp-setup-powershell-contracts.test.js`
- Test: `tests/unit/spec-graph-bootstrap.sh`
- Test: `tests/unit/resolve-workspace-graph-targets-powershell-contracts.test.js`
- Test: `tests/unit/workspace-nested-topology.test.js`

**Approach:**

- Add explicit target mode `non-git-folder` only when the user names `--folder <path>` / `-Folder <path>` or an equivalent explicit folder flag. Do not silently treat every parent workspace as non-git source.
- Plumb that explicit folder flag through the public setup entry chain, not only the resolver: `install-mcp.*` argument parsing, `detect-tools.*` target facts, `verify-tools.*` verification, `bootstrap-project-config.*` project config bootstrap, and `write-provider-config.*` must all preserve `target_kind="non-git-folder"` and the selected folder path.
- For folder targets, setup may write provider config because state_write_allowed is explicit, but must mark `target_kind="non-git-folder"`.
- `write-provider-config.*` must relax the current `repo_status == "git-repo"` gate only for explicit `target_kind="non-git-folder"` with `state_write_allowed=true`; implicit parent workspaces remain no-write/action-required.
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

- Phase 1（dual-registry 窗口路由策略）：选择**option (a) 硬写死 `gitnexus.query`**——直接删除 `readiness.target_provider?.provider === "code-review-graph" ? "code-review-graph.query" : ...` 这条 conditional，无论 readiness 上游 `target_provider` 选 CRG 还是 gitnexus，query plan 都 emit `gitnexus.query`（gitnexus query-unverified 时降级为 bounded direct-read）。option (b)（修改 readiness target_provider selector 让其优先 gitnexus）需要扩大 U5 Files 到 readiness 计算路径，与"Phase 1 不得侵入 CRG 删除领地"的边界冲突，故不取。该选择仅对 Phase 1 dual-registry 窗口安全因为 U2 在 Sequencing step 3 紧接其后，CRG-as-target_provider 不会在 production runtime 长期共存。
- Always emit GitNexus query plan when graph-fresh GitNexus has a query surface; otherwise emit bounded direct-read candidates.
- For code review, map GitNexus `detect_changes` / `impact --include-tests` / route/API/shape surfaces into a bounded `<graph-review-evidence>` or equivalent evidence block. 当 `review_support.related_tests_status == "candidate-only"` 时，`$spec-code-review` 在 final response Coverage 显式标注 `related_tests=candidate-only (provider-unverified)`（详见 [Candidate-only consumer semantics](#candidate-only-consumer-semantics)），并提示 reviewer 自行结合 diff/源码/tests 验证 related-test 范围；不得宣称 GitNexus 完整 review-impact parity。
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
- Modify: `docs/05-用户手册/15-code-review-graph-全流程执行分析.md`（添加 retired/historical front-matter banner，开头 prose 时态从"当前仓库源码"改为"迁移前历史链路"；不删除内容，作为历史档案保留）
- Modify: `docs/05-用户手册/17-GitNexus-刷新策略与Provider收敛决策.md`（同上：retired/historical 标签 + 时态校正）
- Modify: `docs/05-用户手册/18-CodeGraph-GitNexus-CRG-平替评估.md`（同上：retired/historical 标签 + 时态校正）
- Add: `docs/05-用户手册/<N>-旧 CRG 残留手动清理指引.md`（按 D10 决策；覆盖 host MCP `[mcp_servers."code-review-graph"]` 删除步骤、`.code-review-graph/`、uv/uvx cache、`.spec-first/providers/code-review-graph/**` 的可选清理；Bash + PowerShell + Windows 路径）
- Modify: `docs/contracts/graph-evidence-policy.md`（U6 owner：CRG-mention 全量重写为 GitNexus-only；与 U1 已新增的 candidate-only 章节合并定稿）
- Modify: `docs/contracts/graph-provider-consumption.md`（U6 owner：同上 prose 重写；U1 留下的 `<!-- TODO(U6): migrate to GitNexus-only prose -->` 注释作为对账锚点）
- Modify: `docs/contracts/source-runtime-customization-boundary.md`（仅当 baseline scan 在该文件发现 CRG active provider 引用时才修改；如未发现 CRG 引用，从 Files 列表删除该条目，避免 opportunistic scope）
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
- `docs/contracts/graph-provider-consumption.md` 与 `docs/contracts/graph-evidence-policy.md` 中**不再含**任何 `<!-- TODO(U6): migrate to GitNexus-only prose -->` 注释（U1 留下的 cross-unit handoff 锚点必须在 U6 完成 prose 重写后清除；测试断言这两份 contract 文件不再含该 TODO marker，防止 U6 漏改残留）。

### U7. Update no-CRG-provider tests and CI quality gate

**Goal:** Prevent CRG provider paths from returning.

**Requirements:** R29, R30, R43, R44a, R44b, R45, R46

**Files:**

- Modify: `scripts/run-ai-dev-quality-gate.js`
- Modify: `.github/workflows/ai-dev-quality-gate.yml`
- Modify: `src/cli/contracts/quality-gates/branch-protection-policy.json`
- Modify: `src/cli/gitignore-policy.js`
- Modify or retire active CRG extraction: `tests/benchmark/extract-graph-anchors.sh`
- Audit/classify CRG mentions from source scan: `tests/smoke/install-tarball.sh`, `tests/smoke/cli.sh`, `tests/integration/verification-gate.integration.test.js`, `tests/unit/docs-lifecycle-contracts.test.js`, `tests/unit/spec-write-tasks-contracts.test.js`, `tests/unit/workflow-artifact-paths.test.js`, `tests/unit/package-install-contracts.test.js`, `tests/unit/cli-entry-contracts.test.js`, `tests/unit/multi-actor-worktree-governance-contracts.test.js`
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
- Test (new, continuous coverage): `tests/unit/init-source-path-coverage.test.js`（调用 `src/cli/plugin.js` 的实际 asset selection 路径，例如 `buildFilteredAssetSet()`，对照 governance/command manifest 与 `skills/`、`agents/`、`templates/` 下的 source paths；source 文件未被当前 generator 覆盖时 fail。把 U9 一次性 audit 升级为持续 test，覆盖 Risks 节"Source generator path coverage risk"，避免未来加 source path 时 runtime mirror drift 静默累积）

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
- Source scan hits in benchmark/smoke/integration/lifecycle tests must be classified explicitly before the guard ships. Default outcome: remove active CRG extraction from `tests/benchmark/extract-graph-anchors.sh`; if any benchmark-only historical comparison is intentionally retained, mark it with a dedicated historical/benchmark banner and add an explicit allowlist assertion so it cannot be mistaken for runtime provider support.
- Keep `.code-review-graph/` in managed `.gitignore` for one migration window as residual local artifact protection. Tests must explain it as residual ignore, not active provider support.
- **D9 exit criterion 机械保障**：在 `src/cli/gitignore-policy.js` 为 `.code-review-graph/` 条目附 `residual-ignore-expiry` 元数据（按 当前 minor + 1 计算 expiry，本迁移随 `1.X` 发布则 expiry 为 `1.(X+1)`）。`tests/unit/no-crg-runtime-contracts.test.js` 加 assertion：读取 `package.json` `version` 与该条目 expiry 比较，当 version ≥ expiry 且条目仍存在 → 强制 fail。下一 minor PR 必须移除该 ignore 条目，或显式延长 expiry 并在 CHANGELOG 记录延长理由。
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
- **Ownership 锚点（D6 决策；U3 implementer；U8 verifier）**：D6 决定 stale-projection gate 的存在与设计，U3 在 bootstrap 路径中实现 gate 代码（按 provider-key 扫描）。U8 仅负责：(1) 验证 setup 的 projection rewrite 能消除 stale state，使升级用户在 setup→bootstrap 顺序下不再触发 gate；(2) 在 `skills/spec-mcp-setup/SKILL.md` 与 `skills/spec-graph-bootstrap/SKILL.md` 中描述升级流程（先跑 setup 再跑 bootstrap），不重复实现 gate 逻辑。
- The recommended action for stale CRG projection is rerun `$spec-mcp-setup`, not manually edit `.spec-first/config/graph-providers.json`.
- Document residual cleanup separately: old `.code-review-graph/`, host MCP config and uv cache can be removed only through explicit maintenance guidance（按 D10 决策走用户手册手动清理章节，无 `uninstall-mcp --tool code-review-graph` 命令路径）。

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
- Run: `spec-first init --claude` followed by `spec-first init --codex` as local runtime regeneration/audit only (required after U6; the CLI rejects both flags in one call — `src/cli/commands/init.js` mutual-exclusion check; see Approach for details)
- Test: `npm run lint:skill-entrypoints`
- Test: `npm run typecheck`
- Test: `npm run test:mcp-setup`
- Test: `npm run test:graph-bootstrap`
- Test: `npm run test:unit`

**Approach:**

- Add changelog entries for each source-visible migration stage.
- Do not claim “CRG removed” until U1-U7 pass.
- Include U8 stale-projection behavior in release notes so upgrade users know to rerun setup before bootstrap if they hit an old projection.
- **R17a candidate-only 强制披露**：当 R17a gate 触发（按 D7 当前预期默认路径）且 plan 项目维护者选择 ship intermediate 而非 hold release 时，CHANGELOG (user-visible) 条目**必须**含 candidate-only 字样（"review-impact parity 处于 candidate-only：related-tests 证据未达完整可溯标准；详见 follow-up"），release notes 必须正向披露对 `$spec-code-review` 的影响。仅"不得过度宣称"是不够的；缺正向披露的 release 不得发布。
- **Required after U6:** Since U6 modifies 7+ SKILL.md files and templates, run `spec-first init --claude` and then `spec-first init --codex` (two sequential calls; the CLI rejects both flags simultaneously) after U6 completes to repair local runtime drift and audit generated mirrors. Do **not** commit generated mirror diffs from `.claude/`、`.codex/`、`.agents/skills/` as source changes; they are gitignored runtime outputs. Commit only source-of-truth changes such as `AGENTS.md`、`CLAUDE.md`、`skills/`、`templates/`、`src/cli/`、`docs/` and `CHANGELOG.md`. Do not skip this step — U6 without runtime regeneration leaves local runtime mirrors carrying stale CRG content during verification.
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

**Preamble（R17a 分支说明）**：以下编号默认 R17a gate 不触发（即 GitNexus 已在 fixtures 中证明 related-test evidence）。但按 D7 source-of-truth check，candidate-only 是当前**预期默认路径**，多数实施场景下 R17a 会触发；触发后按 D7 第 2-5 条执行——U1 + U5 Phase 1 仍 ship、U2 / U3 / U6 / U7 暂停、U4 可独立推进、release 默认 hold；本节编号在恢复执行时仍按 step 3 (U2) → step 4 (U3) → step 5 (U5 complete) 顺序。Sequencing 不重写。

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

**Three-state invariant（rollback 边界）**：每一步落地后，系统必须处于 `{CRG-only, both-ready, GitNexus-only}` 三态之一，绝不允许出现第四种中间态（例如"CRG 已删除但 GitNexus query 路由未启用"）。U5 Phase 1 在 U2/U3 已 land 后被 revert 时**不得独立 revert**——会留下 review-pre-facts 既无 CRG routing 也无 gitnexus query plan 的不一致中间态；正确做法是 forward-fix（修正 Phase 1 的具体问题，重新 ship），或同时 revert U2/U3 回退到 both-ready 状态。该不变量由 U7 的 active-provider denylist + GitNexus query plan 默认路由测试共同守护。

**U6 单元拆分（强制）**：U6 文件量 ~30 个 source files，**必须**拆为 U6a (contracts + workflow prose + checked-in host entry docs + skill SKILL.md) 与 U6b (user manuals + templates + runtime catalog + setup reference + eval fixtures) 两个独立 PR 提交（不再是建议）。U6a / U6b 之间不强制顺序，但每个 PR 必须独立通过其覆盖文件的一致性测试与 Verification Plan source scan（rg 命令）；U6b 合并前还须确认 U6a 已落地或同步落地。如果 U7 的 active-source 扫描在 U6a 与 U6b 之间运行，测试中允许 U6b 待修改路径作为 known-pending 列表，避免误报阻塞，但 known-pending 列表必须在 PR 描述中显式枚举，不得静默泛过。

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

Add focused scan checks。**两条命令，用途互斥**：

(1) Source scan：扫 source-of-truth 文件，确认 active CRG 引用已清理。

```bash
rg -n "code-review-graph|CRG|crg|\\.code-review-graph" \
  AGENTS.md CLAUDE.md README.md README.zh-CN.md \
  docs/contracts "docs/05-用户手册" docs/catalog \
  skills src/cli templates tests scripts .github \
  --glob '!docs/plans/**' --glob '!docs/brainstorms/**' \
  --glob '!CHANGELOG.md'
```

Allowed matches in source scan（实施后允许残留）：
- `docs/05-用户手册/15-code-review-graph-全流程执行分析.md`、`17-GitNexus-刷新策略与Provider收敛决策.md`、`18-CodeGraph-GitNexus-CRG-平替评估.md`：历史分析文档，已通过 U6 添加 retired/historical front-matter banner，scan 检查含 banner 标识方算合法（由 `tests/unit/user-manual-contracts.test.js` assert）。
- `docs/05-用户手册/<N>-旧 CRG 残留手动清理指引.md`：D10 manual-guidance 路径产物，整篇是清理指引，CRG 字符串属合法。
- `tests/unit/no-crg-runtime-contracts.test.js` 等显式 no-CRG-guard 测试文件名与 assertion。
- `tests/benchmark/extract-graph-anchors.sh` 只有在被明确改成 historical benchmark fixture、且文件内含 dedicated historical/benchmark banner 时才可残留 CRG 字符串；默认目标是删除 `--provider code-review-graph` 与 `.code-review-graph/graph.db` extraction branch。
- smoke / integration / lifecycle / package / workflow-artifact tests 中的 CRG 字符串必须逐项归类为 `no-crg guard`、`historical fixture` 或 `remove`; source scan guard 不得用 broad glob 跳过这些目录。
- `src/cli/gitignore-policy.js` 中 `.code-review-graph/` 条目（D9 residual ignore + `residual-ignore-expiry` 元数据）。

`docs/plans/**`、`docs/brainstorms/**`、`CHANGELOG.md` 已通过 `--glob` 排除；它们的 CRG 提及作为历史记录管理，不在 source scan 范围。

(2) Runtime mirror audit：U9 一次性，确认 `spec-first init --claude/--codex` 后 generated mirrors 不残留 CRG（覆盖 Risks 节"Source generator path coverage risk"）。

```bash
rg -n "code-review-graph|CRG|crg|\\.code-review-graph" \
  .claude .codex .agents/skills
```

Runtime mirror audit 应空输出（generator 应已不产 CRG 字符串）。**该 audit 仅在 U9 验收时跑一次**；持续守护改由 U7 新增的 `tests/unit/init-source-path-coverage.test.js` 承担（通过实际 `buildFilteredAssetSet()` / governance / command manifest selection 对照 source paths，避免未来加 source path 时 runtime drift 静默累积）。两条命令用途不同，不要混用：source scan 不会覆盖 generated mirrors，runtime audit 不能替代 source scan。

## Risks

- **Review downgrade risk:** If GitNexus impact adapter is too thin, `$spec-code-review` loses related tests or blast-radius evidence. Mitigation: U1 before deletion and acceptance tests for impact/review support.
- **Over-broad string deletion risk:** Removing all CRG mentions blindly may delete historical context or no-regression tests. Mitigation: explicit allowlist for historical docs and no-CRG tests.
- **Setup baseline regression:** Removing CRG from `mcp-tools.json` can break scripts that assume all graph providers have entries. Mitigation: update setup writer, detector, shell tests and PowerShell tests together.
- **Bootstrap schema drift:** Existing consumers may read `ready_primary_providers[]`. Mitigation: keep compatible aggregate fields temporarily while changing capability semantics and tests.
- **Non-git evidence confusion:** Folder target could accidentally look like Git readiness. Mitigation: separate `target_kind`, content/folder snapshot fields and limitations; no fake Git fields.
- **Residual artifact confusion:** Old `.spec-first/providers/code-review-graph/*` may remain on disk. Mitigation: active compilers ignore it and tests prove readiness does not derive from it.
- **Source generator path coverage risk:** `spec-first init --claude` / `spec-first init --codex` 不会自动捕获 U6 新增 source path 未进入实际 asset selection 的情况，可能导致 source 已无 CRG 但 runtime mirror 仍含旧字符串。Mitigation 双层：
  - U9 一次性 audit：跑 Verification Plan (2) 节的 runtime mirror audit 命令扫 `.claude/`、`.codex/`、`.agents/skills/`，作为本迁移版本发布前的 release gate（属 audit evidence，不纳入持续 context）。若发现残留先修 generator/source-path 映射，再重新运行 `spec-first init`（两次顺序调用），**禁止**手改 runtime mirror。
  - 持续守护：U7 新增 `tests/unit/init-source-path-coverage.test.js`，调用实际 `src/cli/plugin.js` asset selection（例如 `buildFilteredAssetSet()`）并对照 governance/command manifest 与 `skills/`、`agents/`、`templates/` source paths；未覆盖 → fail。把"加 source path 但忘进入 generator selection"变成持续 CI 信号，避免后续无关 PR 加 source path 时静默累积 drift。仅靠 U9 一次性 audit 不够。

## Deferred / Open Questions

### From 2026-05-25 doc-review (round 1)

以下两项是 doc-review 发现的 plan-外 hardening 决策；纳入本迁移会扩大 contract surface scope，scope-guardian 风险显著。defer 给项目维护者裁定是否在本迁移内解决、作为 follow-up，或显式接受当前威胁模型：

- **D6 stale-projection gate vs hand-edited `graph-providers.json`**：U3 实现的 stale-projection gate 仅按 provider-key 扫描，无法防御用户/部分迁移脚本/调试会话**手动**编辑 `.spec-first/config/graph-providers.json` 删除 CRG key（绕过 gate）但 host MCP config / 残留 `.code-review-graph/` / uv cache 仍处于迁移前状态的场景。是否给 `graph-providers.v1` schema 加 setup-owned fingerprint（source registry hash + setup version）使 bootstrap 能验证完整性（不仅 provider-key 扫描）？还是显式声明 hand-edit 不在威胁模型内？任一选择都属 contract surface 决策，超出本迁移范围。
  - 来源：adversarial-001 (anchor=75)
  - 影响：若选 fingerprint，需在 U2/U3 同步加 fingerprint 写入与校验逻辑；若选接受现状，需在 D6 显式记录"手动编辑视为有意旁路，不防御"。
- **并发 setup + bootstrap 原子写语义**：当前 plan 未声明 `.spec-first/config/graph-providers.json` 是否需要原子写（write-temp + rename），也未要求 bootstrap 在读取时按 single-shot 处理 partial-content。一旦 setup 与 graph-bootstrap 并发执行，可能出现：(a) bootstrap 读到半写入文件 → 误报 action-required；(b) bootstrap 读到 clean GitNexus-only projection 但 host MCP config 仍在 mid-rewrite。是否在本迁移范围内引入 atomic-write 要求 + U8 半写入 fixture？还是作为后续 hardening 任务单独处理？
  - 来源：adversarial-002 (anchor=75)
  - 影响：若纳入本迁移，需扩 U2/U8 Files 与 Test scenarios，增加跨 4 OS 文件锁/原子写实现；若作为 follow-up，需在 Risks 加显式条目说明并发风险已知未决。

两项均不属 plan 外编辑可消化的范畴，需要项目维护者明确取舍后再做后续工作。
