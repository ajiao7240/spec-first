---
date: 2026-05-25
topic: gitnexus-only-graph-provider
spec_id: 2026-05-25-001-gitnexus-only-graph-provider
---

# GitNexus-only Graph Provider 硬切平替需求

## Summary

本需求将 spec-first 的 graph provider 收敛为 GitNexus-only：删除 `code-review-graph` 作为 setup、bootstrap、readiness、impact context、review evidence 和文档默认路径中的 provider，不保留 CRG fallback，也不引入 CodeGraph 或第三方新 provider。GitNexus 必须直接平替 CRG 既有 review-impact 能力，同时支持非 Git 项目目录通过 `analyze --skip-git` 建立受限索引。

---

## Problem Frame

spec-first 当前已经把 GitNexus 接入为全局代码知识图谱，并逐步让 plan/work/debug/review 消费 GitNexus evidence。但 CRG 仍作为独立 provider 存在于 setup projection、graph-bootstrap、canonical impact readiness、review preflight 和用户文档中。这会让 graph provider contract 长期保持双路径：GitNexus 负责全局代码理解，CRG 负责 review-impact。用户的目标不是保留双 provider 兜底，而是让 GitNexus 完整承担 graph 与 review-impact 职责。

如果只删除 CRG 配置而不补齐 GitNexus 的 canonical impact adapter、review evidence contract 和下游消费边界，`$spec-code-review` 会失去 diff impact、affected tests、影响面说明等现有能力，形成降级。相反，正确目标是硬切平替：先把 GitNexus 能力映射到现有 workflow 需要的事实产物和 evidence posture，再移除 CRG 的 provider 身份、安装项、artifact 指针、fallback 文案和测试期望。

同时，真实使用中存在没有 Git 初始化的项目目录、解压源码包、临时代码目录或生成项目。CRG 本身不支持非 Git 目录，这类场景在双 provider 时期本就没有 graph coverage；GitNexus-only 迁移是补齐这一缺口的合适时机——GitNexus 官方支持 `analyze --skip-git`，但 spec-first 当前 graph target 与 freshness contract 仍以 Git repo 为默认边界。GitNexus-only 后应把非 Git 目录纳入显式 folder target，而不是把它伪装成 Git repo 或生成假的 commit / dirty 证据。

---

## Actors

- A1. Developer: 使用 spec-first 获取代码图谱、计划、实现、调试和 review evidence，希望只维护一个 graph provider。
- A2. `$spec-mcp-setup`: 安装和投影 required harness runtime 与 provider config，但不运行 provider refresh。
- A3. `$spec-graph-bootstrap`: 唯一默认 graph refresh owner，负责编译 GitNexus readiness、impact capability 和 canonical graph facts。
- A4. GitNexus provider: 唯一 graph provider，承担 global knowledge、impact context、review support、multi-repo orientation 和 non-git folder indexing。
- A5. Downstream workflows: `$spec-plan`、`$spec-work`、`$spec-debug`、`$spec-code-review`、`$spec-doc-review` 等，只消费 readiness/evidence，不隐式刷新 provider。
- A6. Non-git folder target: 没有 `.git` 的代码目录，可被 GitNexus 索引但缺少 commit、dirty、diff 和 incremental 语义。

---

## Key Flows

- F1. Initial full refresh
  - **Trigger:** setup baseline 已 ready 后，开发者首次运行 graph bootstrap，或显式请求 full/force refresh。
  - **Actors:** A1, A3, A4
  - **Steps:** graph-bootstrap 校验 setup-owned config；运行 GitNexus full analyze；运行 status/query proof；编译 provider status、graph facts、impact capability facts 和 bootstrap report。
  - **Outcome:** 当前 repo 或 folder target 拥有 GitNexus-backed canonical graph readiness，CRG 不参与。
  - **Covered by:** R1, R6, R8, R10, R18

- F2. Clean Git repo incremental refresh
  - **Trigger:** 开发者在单个 clean Git repo 中显式请求 incremental refresh，或后续经过验证后选择 auto-incremental mode。
  - **Actors:** A1, A3, A4
  - **Steps:** graph-bootstrap 验证 prior GitNexus query-ready baseline、clean source revision、provider fingerprint、incremental eligibility 和 last indexed commit；通过后运行 GitNexus no-force analyze；失败时按 contract fallback full 或 action-required。
  - **Outcome:** 增量刷新仍由 graph-bootstrap 拥有，且刷新的是 GitNexus index 与 canonical readiness，不产生 commit graph node。
  - **Covered by:** R11, R12, R13, R14, R15, R16

- F3. GitNexus review-impact consumption
  - **Trigger:** `$spec-code-review` 或其他 downstream workflow 需要 diff impact、affected tests、route/API/shape risk、execution flow 或 blast radius evidence。
  - **Actors:** A4, A5
  - **Steps:** workflow 读取 canonical readiness 和 GitNexus impact capability facts；在 fresh 或 session-local evidence 可用时使用 GitNexus native impact/review能力；用源码、diff、测试或日志验证关键结论；不可用时降级到 direct source reads、git diff、ast-grep、tests/logs。
  - **Outcome:** review-impact 能力由 GitNexus 直接平替，CRG 不作为 fallback。
  - **Covered by:** R17, R18, R19, R20

- F4. Non-git folder full indexing
  - **Trigger:** 开发者显式选择一个非 Git 代码目录作为 graph target。
  - **Actors:** A1, A3, A4, A6
  - **Steps:** graph-bootstrap 或其 target resolver 将目录标为 non-git folder target；运行 GitNexus `analyze --skip-git` full indexing；写入 folder-target freshness facts 和 limitations；拒绝 incremental、commit tracking、dirty hash 和 diff-based impact。
  - **Outcome:** 非 Git 目录可以获得 GitNexus query/context/architecture evidence，但不会伪造 Git metadata。
  - **Covered by:** R21, R22, R23, R24, R25

- F5. Downstream stale/degraded handling
  - **Trigger:** downstream workflow 发现 GitNexus stale、query-unverified、dirty-advisory、non-git limited 或 unavailable。
  - **Actors:** A4, A5
  - **Steps:** workflow 披露 limitations；必要时建议 `$spec-graph-bootstrap`；继续使用 bounded direct source reads、git diff、ast-grep、tests/logs 等可验证 fallback；不得回退到 CRG。
  - **Outcome:** GitNexus-only 不等于无降级说明；降级路径存在，但不再是 CRG provider fallback。
  - **Covered by:** R3, R4, R9, R24, R25, R31

---

## Requirements

**Provider Hard Cut**

- R1. spec-first 必须将 GitNexus 定义为唯一默认 graph provider，同时承担 `global_knowledge`、`impact_context`、context selection 和 review support 角色。
- R2. `code-review-graph` 必须从默认 setup、provider registry、graph-bootstrap allowlist、provider artifact contract、canonical readiness、downstream workflow guidance、README、用户手册和测试期望中移除。
- R3. CRG 不得作为 fallback、legacy compatibility provider、optional default provider、hidden provider 或 review-only provider 被任何当前 workflow 消费。
- R4. GitNexus 不可用时，fallback 只能是 bounded direct source reads、git diff、ast-grep、tests/logs、用户提供证据或 session-local 已验证事实；不得回退到 CRG。
- R5. 本次迁移不得引入 CodeGraph 或任何第三方新 provider；目标是 provider 收敛，不是 provider 替换组合。

**Setup And Bootstrap**

- R6. `$spec-mcp-setup` 必须只投影 GitNexus provider config 和 capability metadata，不再投影 CRG package、commands、artifacts、role 或 required provider status。
- R7. `$spec-mcp-setup` 不得运行 GitNexus analyze、status、query、impact、repair、clean、group sync、rename 或任何任务级 deep dive。
- R8. `$spec-graph-bootstrap` 是唯一默认 graph refresh owner，负责 GitNexus full/incremental/folder refresh、status/query proof、provider status、graph facts、impact capability facts 和 bootstrap report。
- R9. downstream workflows 不得隐式运行 GitNexus analyze、provider repair、clean、group sync、rename、watcher、daemon 或 hook；需要刷新时必须提示或进入 `$spec-graph-bootstrap`。

**Refresh Modes**

| Mode | Target | Trigger | GitNexus action | Canonical posture |
| --- | --- | --- | --- | --- |
| Initial full | Git repo | first bootstrap / explicit full | analyze with force | fresh or dirty-advisory, depending on worktree |
| Fallback full | Git repo | invalid incremental baseline / fingerprint drift / incremental failure | analyze with force | full refresh with reason code |
| Incremental | clean single Git repo | explicit incremental, or future verified auto mode | analyze without force | incremental-update only after query proof |
| Folder full | non-git folder | explicit folder target | analyze with skip-git and force | content-fingerprint advisory |

- R10. 初始化全量刷新必须发生在 `$spec-graph-bootstrap`，而不是 `init`、`mcp-setup`、plan/work/debug/review 或 startup reminder。
- R11. 增量刷新也必须发生在 `$spec-graph-bootstrap`，作为同一 refresh contract 下的 refresh mode，而不是 downstream workflow 的隐式副作用。
- R12. 增量刷新只适用于单个 Git repo；当前不要求支持 all-repos incremental 或 non-git incremental。
- R13. 增量刷新必须有可信 clean baseline：prior GitNexus status 需要 query-ready，last indexed commit 需要存在、合法、可达且是当前 HEAD ancestor，provider projection/fingerprint 需要未漂移，且 prior status 必须明确 `requires_clean_full_refresh=false`。
- R14. graph-affecting dirty worktree 请求 incremental 时，必须降级为 full + dirty-advisory 或被明确阻止；不得制造 clean incremental 成功假象。
- R15. GitNexus incremental 不应被描述为“只解析改动文件”。它可以用 content hash 做 selective DB writeback，但仍可能运行完整解析 pipeline 以保证跨文件解析正确性。
- R16. GitNexus refresh 不刷新 commit graph node。commit 只作为 `source_revision`、`last_indexed_commit`、provider meta 或 staleness 判断的快照元数据。

**GitNexus Review-Impact Parity**

- R17. GitNexus 必须直接平替 CRG 既有 review-impact 能力，覆盖 diff impact、impacted files/symbols、execution flow、blast radius、related tests 或 test candidates、route/API/shape risk 和 review support posture。
- R17a. 若 GitNexus 无法提供来源可溯的 related-test evidence（通过 `impact --include-tests` 或等价原生接口输出且有测试来源标注），CRG 删除必须被阻止，或 canonical impact facts 中的 review-support parity 必须标记为 `candidate-only`；不得将 candidate-only 状态宣称为完整平替。
- R18. graph-bootstrap 必须产出 GitNexus-backed canonical impact capability facts，使 downstream workflows 不再需要读取 CRG normalized artifacts 才能判断 impact/context/review support。
- R19. `$spec-code-review` 的 graph evidence 入口必须从 CRG-first 或 CRG-required 改为 GitNexus-first/GitNexus-only；findings 仍必须由 diff、source reads、tests、contracts 或日志支持，不能只凭 provider output。
- R20. GitNexus impact evidence 不拥有 scope authority；发现额外影响面时只能进入 risk、follow-up、plan update 或用户确认路径，不得自动扩大实现或 autofix scope。

**Non-git Folder Target**

- R21. spec-first 必须支持显式 non-git folder target，让没有 `.git` 的项目目录可通过 GitNexus `analyze --skip-git` 建立索引；该入口必须与 Git repo target 明确区分，按计划采用 `--folder <path>` / `-Folder <path>` 或等价显式 folder flag。
- R22. non-git folder target 不得伪装成 Git repo，不得生成假的 commit、branch、dirty hash、last indexed commit、git status 或 source revision。
- R23. non-git folder target 的 freshness 必须使用 folder/content snapshot 或 content fingerprint 表达；具体字段由计划的 Target Artifact Contract 约束，且语义必须与 Git revision 明确分离。
- R24. non-git folder target 不支持 incremental refresh、commit tracking、branch/rebase/pull freshness、Git diff based impact 或 clean/dirty gate；downstream 必须披露这些 limitations。
- R25. non-git folder target 可以用于 query、context、architecture orientation、symbol/file discovery 和 bounded source-read focus；不能宣称 Git-backed review-impact 或 commit-aware evidence。

**Mutation Boundary**

- R26. GitNexus `repair`、`clean`、`group sync`、`rename` 等 mutation-capable 操作不得由 setup、bootstrap 默认路径或 downstream workflow 自动执行。
- R27. mutation-capable GitNexus 操作只能在用户明确提出维护动作、scope 明确、preview-first、可恢复建议清楚时进入单独的 maintenance/work plan。
- R28. `$spec-graph-bootstrap` 可以运行 read/index/status/query-proof 类 provider commands；provider storage repair、global registry mutation、group mutation 和 symbol rename 不属于默认 refresh。

**Documentation And Migration**

- R29. docs、README、用户手册、contracts、skills 和 tests 必须统一使用 GitNexus-only 口径；不得残留“CRG 是默认 impact provider / fallback provider / required provider”的说法。
- R30. 删除 CRG 后，`.code-review-graph/` 或历史 CRG artifacts 最多作为可清理本地残留被提及；不得作为当前 readiness、impact、review 或 fallback evidence 使用。
- R31. 迁移文档必须明确 GitNexus-only 的 degraded behavior：provider unavailable 时仍能继续 bounded direct reads，但不能宣称 full graph-backed evidence。
- R32. release notes / changelog 不得在 GitNexus impact adapter、non-git target、contract tests 和 downstream review consumption 完成前宣称“CRG 已安全删除”。

**CRG Lifecycle Removal**

- R33. CRG 删除必须覆盖完整生命周期，而不是只删除用户文案：setup registry、dependency check、warmup install、optional live MCP host config、provider projection、workspace target resolver、bootstrap command allowlist、provider fingerprint、raw/normalized artifact contract、canonical graph facts、impact capabilities、review-pre-facts provider selector、workflow guidance、setup reference catalog、checked-in host entry docs、active user manual pages、eval fixtures、contract tests、shell tests 和 CI quality gate 都必须迁移或删除。
- R34. `skills/spec-mcp-setup/mcp-tools.json` 不得继续包含 `code-review-graph` tool entry、`uv`/`uvx` dependency gate、`uvx code-review-graph@... --help` warmup command、host MCP `serve --tools ...` config 或 `impact_context` provider role。
- R35. `skills/spec-mcp-setup/scripts/write-provider-config.sh` 和 `.ps1` 不得继续生成 `.spec-first/config/graph-providers.json.providers["code-review-graph"]`、CRG command hashes、CRG artifact paths、CRG derived readiness、`selection.impact_context="code-review-graph"`、`selection.context_selection="code-review-graph"` 或 `does_not_run_code_review_graph_build` 这类 active boundary 字段；新的 selection 必须指向 GitNexus 或 explicit fallback capability。
- R36. `skills/spec-mcp-setup/scripts/detect-tools.*`、`verify-tools.*`、`configure-host.*`、`install-mcp.*`、`uninstall-mcp.*`、`skills/spec-mcp-setup/references/supported-mcp-tools.md` 和相关 setup tests 必须不再把 CRG 当作 required/optional setup subject；如果发现用户宿主残留 CRG MCP config，只能作为 cleanup advisory 或 explicit uninstall target，不能参与 baseline readiness。
- R37. `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh` 和 `.ps1` 必须删除 CRG provider execution branch：不再允许 provider id `code-review-graph`、不再校验 `uvx code-review-graph build/update/status` shape、不再运行 CRG build/status/query_probe/incremental、不再写 `.spec-first/providers/code-review-graph/*` raw logs/status/normalized artifacts，也不再产生 CRG projection stale/version-unverifiable reason code。
- R38. `.spec-first/impact/bootstrap-impact-capabilities.json` 的 `context_selection`、`impact_radius` 和 `review_support` primary provider 必须由 GitNexus-backed canonical impact facts 或 non-provider fallback 表达；不得继续要求 CRG normalized `impact-capabilities.json` 才能给出 full/partial 判断。
- R39. `.spec-first/graph/graph-facts.json.capabilities.impact_context` 必须改为 GitNexus impact/review capability readiness 或 fallback capability readiness 的派生结果；不得继续用 `providers[].provider == "code-review-graph"` 作为 true 条件。
- R40. `src/cli/helpers/review-pre-facts.js` 必须删除 CRG query tool routing，不再生成 `tool_name="code-review-graph.query"` 的 query plan；review pre-facts 只能用 GitNexus query/impact/detect-changes/session-local evidence 或 bounded direct reads。
- R41. `skills/spec-code-review/SKILL.md` 必须把 CRG-first / CRG-required / CRG primary diff impact 文案迁移为 GitNexus-only：GitNexus 是唯一 provider evidence path；provider 不可用时降级到 direct source reads、git diff、ast-grep、tests/logs，而不是 CRG fallback。
- R42. `skills/spec-plan/SKILL.md`、`skills/spec-work/SKILL.md`、`skills/spec-debug/SKILL.md`、`skills/spec-doc-review/SKILL.md`、`skills/spec-graph-bootstrap/SKILL.md`、`skills/using-spec-first/SKILL.md`、`skills/spec-mcp-setup/references/supported-mcp-tools.md`、`skills/spec-graph-bootstrap/evals/expected-behavior-cases.json`、`AGENTS.md`、`CLAUDE.md`、active `docs/05-用户手册/*.md` 和 Claude command templates 中的 graph refresh / evidence guidance 必须统一移除 active CRG role，保留 CRG 仅限历史迁移说明。
- R43. Tests 必须从“CRG 外部 provider 仍允许”改为“active source/runtime 不再依赖 CRG”：更新 `tests/unit/mcp-setup.sh`、`tests/unit/spec-graph-bootstrap.sh`、PowerShell parity tests、`graph-provider-consumption` tests、`runtime-tools-index` tests、`runtime-capability-catalog` tests、`user-manual` tests、`readme-language-split` tests、`resolve-workspace-graph-targets` tests、`workspace-nested-topology` tests、`no-graph-fast-path` tests、`no-crg-runtime` tests 和 CI quality gate covers，确保 source 不再出现 CRG active install/refresh/use path。
- R44a. 现有 package/install guard 防止退役内部 `src/crg/` runtime 回归，属于维护性保障；本次迁移只需验证该 guard 继续有效，不需要新增工作。
- R44b. 本次迁移必须新增或改造 no-CRG-provider contract，拒绝 `mcp-tools.json`、setup writer、bootstrap scripts、runtime tool catalog、README 和 active workflow prose 重新引入 CRG provider。
- R45. 迁移不得默认删除用户机器上的 `.code-review-graph/`、uv cache、host MCP CRG config 或历史 `.spec-first/providers/code-review-graph/*` 文件；clean-up 只能作为显式 maintenance guidance，并且 active readiness compiler 必须忽略这些残留。
- R46. Runtime capability catalog、runtime tools index、branch protection / quality gate covers、README managed blocks、checked-in host entry docs、setup reference catalog、workflow eval fixtures 和 generated documentation sources 不得继续把 CRG 描述为 current provider/tool fact source；如需提及，只能标记为 historical/retired/residual cleanup。
- R47. 对升级用户已有的 `.spec-first/config/graph-providers.json` 中 CRG provider projection，setup 必须 source-first 重写为 GitNexus-only projection；若用户直接运行 graph-bootstrap 命中过期 CRG projection，bootstrap 必须 fail closed 并提示重跑 setup，不得执行旧 CRG command。
- R48. 任何 runtime mirror 中残留 CRG 文案都不能通过手改 `.claude/`、`.codex/` 或 `.agents/skills/` 修复；必须先修改 source，再按需运行 `spec-first init --claude|--codex` 重新生成。

---

## Acceptance Examples

- AE1. **Covers R1, R2, R3, R5.** Given a fresh spec-first setup, when provider config is generated, then GitNexus is the only required/default graph provider and CRG/CodeGraph are absent from provider projection.
- AE2. **Covers R6, R7, R8, R9.** Given setup has completed, when a developer runs graph bootstrap, then setup has not run provider refresh and graph-bootstrap owns the GitNexus analyze/status/query proof sequence.
- AE3. **Covers R10, R11, R12, R13, R14.** Given a clean Git repo with prior query-ready GitNexus status, when incremental graph bootstrap is requested, then bootstrap may run GitNexus no-force analyze and records incremental-update only if query proof succeeds.
- AE4. **Covers R12, R21, R22, R23, R24.** Given a non-git folder target, when graph bootstrap indexes it, then the result records folder/content freshness and limitations, with no fake commit, dirty, branch or last indexed commit fields.
- AE5. **Covers R17, R17a (positive), R18, R19.** Given a review diff changes shared behavior and GitNexus provides provenance-backed related-test evidence, when `$spec-code-review` runs with GitNexus ready, then it uses GitNexus impact/review evidence and canonical impact capability facts; CRG is not invoked or named as fallback.
- AE6. **Covers R4, R19, R25, R31.** Given GitNexus is stale or unavailable during a graph-heavy review, when the workflow continues, then it falls back to direct source reads, git diff, ast-grep, tests or logs and explicitly states that graph-backed evidence is degraded.
- AE7. **Covers R20, R26, R27, R28.** Given GitNexus impact finds additional affected files or a group sync would help, when the current workflow is review or work, then it records the risk or follow-up and does not auto-expand scope or run mutation operations.
- AE8. **Covers R29, R30, R32.** Given the migration is complete, when docs and tests are scanned, then CRG appears only in historical migration notes or cleanup guidance and not as an active provider, fallback, artifact contract or workflow dependency.
- AE9. **Covers R33-R37.** Given setup, verify-tools, workspace target resolver and graph bootstrap source are inspected after migration, when provider lifecycle code is scanned, then there is no CRG install/warmup/host MCP/projection/workspace-readiness/command allowlist/fingerprint/bootstrap/status/query path.
- AE10. **Covers R38-R41.** Given `$spec-code-review` needs impact evidence after migration, when GitNexus is query-ready, then canonical impact capabilities and review pre-facts use GitNexus-only evidence; when GitNexus is unavailable, the workflow reports degraded direct-read fallback without invoking CRG.
- AE11. **Covers R42-R45.** Given a user upgrades from an older version with CRG artifacts or host config still on disk, when setup/bootstrap/review run, then residual CRG data is ignored for readiness and only explicit cleanup guidance mentions it.
- AE12. **Covers R46-R48.** Given an older checkout had CRG in generated runtime docs, checked-in host entry docs, workflow eval fixtures, setup reference docs or `.spec-first/config/graph-providers.json`, when source setup/init regeneration runs, then active runtime/docs/config are GitNexus-only; if graph-bootstrap sees the stale CRG projection before setup, it fails closed without executing CRG.
- AE13. **Covers R17a (blocking).** Given GitNexus can only provide candidate-only related-test output (no provenance-backed evidence via `impact --include-tests` or equivalent), when U1 impact adapter validation runs, then CRG deletion is blocked or canonical impact facts mark review-support parity as `candidate-only`; no release claim may assert full review-impact parity until related-test proof is established.

---

## Success Criteria

- spec-first has a single graph provider mental model: GitNexus is the only default provider for graph knowledge, impact context and review support.
- Removing CRG does not reduce review-impact capability: `$spec-code-review` still has impact/context/test-selection/risk evidence, now sourced from GitNexus and verified by source/diff/test facts.
- GitNexus related-test parity is proven with provenance before CRG deletion; if unproven, the deletion is explicitly gated (R17a) rather than silently completed.
- Graph refresh ownership remains simple: graph-bootstrap owns full and incremental refresh; downstream workflows consume evidence and recommend refresh instead of running it.
- Incremental refresh is correctly scoped as a clean single-Git-repo fast path, with full refresh fallback and clear reason codes.
- Non-git directories can be indexed for code intelligence without fake Git metadata or misleading freshness claims.
- Users and future agents can read requirements and know exactly what is excluded: CRG fallback, CodeGraph/new providers, automatic GitNexus mutation operations and commit-node refresh semantics.
- Implementers can trace every CRG lifecycle surface that must be removed: install, setup projection, refresh, artifacts, scripts, workflow consumption, tests and docs.
- Upgrade behavior is deterministic: old CRG projection is overwritten by setup or rejected by bootstrap, and runtime mirror drift is repaired by source regeneration only.
- Planning can proceed without inventing product behavior around refresh modes, non-git limitations, CRG deletion boundaries or GitNexus review-impact parity.

---

## CRG Removal Surface Inventory

| Surface | Current CRG responsibility | Required replacement |
| --- | --- | --- |
| Tool registry | `skills/spec-mcp-setup/mcp-tools.json` defines CRG package pin, `uvx` warmup, dependencies, optional live MCP and `impact_context` role | Remove CRG entry; GitNexus registry owns graph provider capability catalog; direct reads/ast-grep remain fallback tools |
| Setup detection / install | setup scripts iterate CRG as a tool/provider and may configure/uninstall optional host MCP | Stop treating CRG as setup subject; residual host CRG config is cleanup advisory only |
| Setup reference catalog | `skills/spec-mcp-setup/references/supported-mcp-tools.md` documents CRG as required graph provider and pinned setup path | Update to GitNexus-only graph provider catalog |
| Provider projection | `write-provider-config.*` emits CRG commands, command hash, artifact paths, derived readiness and selection fields | Emit GitNexus-only provider projection and GitNexus impact/review capability mapping |
| Refresh scripts | graph-bootstrap validates and runs CRG `build`, `update`, `status`, `status --repo`; checks CRG projection/version freshness | Remove CRG branch and unsupported-provider allowlist entry; GitNexus owns full/incremental/folder refresh |
| Workspace target resolver | `resolve-workspace-graph-targets.*` can carry CRG configured/query-ready/status facts into parent workspace advisory output | Emit GitNexus-only provider readiness and treat historical CRG artifacts as ignored residuals |
| Provider artifacts | `.spec-first/providers/code-review-graph/raw/*`, `status.json`, `normalized/impact-capabilities.json` | No active CRG artifacts; GitNexus normalized artifacts include impact/review capability facts |
| Canonical artifacts | `graph-facts.capabilities.impact_context` and `bootstrap-impact-capabilities.impact_radius/review_support` currently key off CRG readiness | Recompute from GitNexus query-ready impact surfaces plus explicit fallback capability |
| Review pre-facts | helper can route fresh query plan to `code-review-graph.query` | Route to GitNexus-only or bounded direct reads |
| Workflow prose | `$spec-code-review` still describes CRG as primary diff-impact provider | GitNexus-only provider evidence; no CRG fallback |
| Tests / CI | shell, Jest and quality gate tests assert CRG setup/bootstrap/doc behavior | Replace with no-active-CRG-provider assertions and GitNexus parity tests |
| Runtime/catalog/docs/evals | `docs/catalog/runtime-capabilities.md`, runtime capability generator, checked-in `AGENTS.md` / `CLAUDE.md`, setup reference docs, active user manuals, workflow eval fixtures and runtime tools tests mention CRG as current provider fact source | Regenerate and test GitNexus-only catalog/guidance wording; keep CRG only as historical/residual cleanup where explicitly labeled |
| Upgrade projection | Existing `.spec-first/config/graph-providers.json` may still contain CRG provider commands | setup rewrites projection; bootstrap rejects stale CRG projection without executing it |
| Local residual data | `.code-review-graph/`, old host MCP entries, uv cache, historical provider artifacts | Ignore for readiness; explicit preview cleanup only |

## Scope Boundaries

- No CRG fallback, no legacy CRG compatibility provider, no hidden CRG review provider.
- No CodeGraph or third-party new provider.
- No automatic GitNexus repair, clean, group sync, rename or other mutation operation.
- No fake Git metadata for non-git folders.
- No commit graph node refresh design.
- No downstream workflow implicit provider refresh.
- No provider abstraction platform beyond what is necessary for GitNexus-only readiness/evidence contracts.
- No guarantee that non-git folder targets support Git diff, commit-aware review, branch freshness or incremental refresh.
- Multi-repo workspace 层的 CRG 清理（workspace-level readiness、`workspace-gitnexus-readiness.v1`、workspace-graph targets）在本次迁移范围内；若发现 workspace 层有独立 CRG provider path，视同 R2/R3 范围内必须清理。但 workspace bootstrap 的 GitNexus canonical facts 机制由现有 workspace contracts 约束，不在本需求额外定义。

---

## Key Decisions

- **Hard cut over compatibility:** CRG is removed rather than kept as fallback, because retaining it would keep dual-provider contract complexity and weaken the GitNexus-only goal.
- **GitNexus as both knowledge and impact provider:** GitNexus owns global knowledge and impact context so downstream workflows have one provider posture to reason about.
- **Graph-bootstrap owns all refresh modes:** Initial full refresh and later incremental refresh both live under graph-bootstrap, preserving explicit refresh ownership.
- **Incremental is a mode, not a node type:** GitNexus incremental refresh updates file/symbol/edge rows and graph-level derived nodes; commit remains metadata.
- **Non-git is first-class but limited:** non-git folder indexing is useful enough to support, but it must be a clearly labeled folder/content-snapshot mode.
- **Degrade without CRG:** GitNexus unavailable means source/diff/test/tool fallback, not provider fallback.

---

## Dependencies / Assumptions

- GitNexus OSS exposes sufficient read/index/query/impact capabilities to cover CRG's active review-impact role once spec-first adds the necessary adapter and canonical artifact mapping.
- Current GitNexus non-git behavior supports `analyze --skip-git`, while commit tracking and incremental updates are disabled for no-`.git` directories.
- Existing graph-bootstrap freshness, provider status and impact capability contracts can be evolved additively or migrated cleanly without requiring a second provider.
- Historical CRG docs and artifacts may remain in git history, but active source docs/tests/contracts should not present CRG as current behavior.

---

## Constraints on the Implementation Plan

以下约束在需求阶段已预解析，计划文档必须遵守；若计划与以下任意一条冲突，以需求文档为准，实现方案须相应调整。

- GitNexus impact parity uses a new GitNexus normalized `impact-capabilities.json` plus the existing canonical `.spec-first/impact/bootstrap-impact-capabilities.json` entrypoint; downstream workflows do not read CRG normalized artifacts.
- `$spec-code-review` preflight consumes GitNexus query / impact / detect-changes evidence as bounded provider evidence and must support every finding with diff, source, tests, contracts or logs.
- Non-git support uses an explicit folder target and content/folder freshness fields; it does not overload Git repo identity or write fake Git fields.
- Incremental remains an explicit clean single-Git-repo graph-bootstrap mode; non-git and all-repos incremental stay unsupported.
- Active CRG references are removed from setup, bootstrap, workspace target resolver, provider artifacts, workflow prose, checked-in host entry docs, setup reference catalog, active user manuals, runtime catalog, workflow eval fixtures and tests; historical docs may mention CRG only with retired/historical or residual cleanup framing.
