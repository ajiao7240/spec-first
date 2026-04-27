---
date: 2026-04-28
topic: spec-graph-bootstrap-readiness-compiler
spec_id: 2026-04-28-001-spec-graph-bootstrap-readiness-compiler
---

# spec-graph-bootstrap Readiness Compiler 需求

## Problem Frame

`spec-mcp-setup` 已经收敛为 Required Harness Runtime Setup：它安装和配置 MCP / helper / graph provider 前置环境，初始化 `.spec-first/config/graph-providers.json`，并建立 host readiness ledger v2 的 `baseline_ready`。

但 `mcp-setup` 完成后，当前项目仍缺少项目级 graph readiness 编译层。系统只能知道工具和 provider projection 已准备好，不能稳定回答：

- GitNexus 是否已经 analyze 当前仓库；
- external `code-review-graph` 是否已经 build 当前仓库；
- 当前 workflow 应该以 `primary` 还是 `degraded-fallback` 运行；
- 后续 `spec-plan`、context selection、impact check、review 应该读取哪些标准化 graph facts；
- provider raw log、status、normalized facts 和 downstream canonical artifacts 的边界在哪里。

本阶段目标是把 `spec-graph-bootstrap` 从简单 provider build runner 收敛为项目级 **Graph Readiness Compiler**：脚本执行确定性 provider bootstrap、日志捕获、状态聚合和标准产物写入；LLM 后续只消费这些 facts 并做语义判断。

这不是恢复旧内置 CRG runtime，也不是建设完整 Glue Coding 平台。2026-04-27 的 CRG / graph-bootstrap 删除计划属于旧切换背景；本需求重新确认当前方向为 external GitNexus + external `code-review-graph` 的项目级 readiness 编译，不重新引入 `src/crg/`、`graph.db` 主路径或旧 Stage-0 context 生成链。

---

## Actors

- A1. Developer: 在目标仓库完成 `spec-mcp-setup` 后运行 `$spec-graph-bootstrap`，希望下游 workflow 能获得可信 graph readiness facts。
- A2. `spec-mcp-setup`: 宿主与项目 projection 前置准备者，只写 setup/readiness/projection 事实、runtime capability facts 和 provider artifact contract，不运行 graph build。
- A3. `spec-graph-bootstrap`: 项目级 Graph Readiness Compiler，读取 setup 产物、运行 provider build、生成 canonical facts。
- A4. GitNexus provider: external global knowledge provider，负责 repository analysis、architecture map、execution flow、query graph 能力。
- A5. `code-review-graph` provider: external impact/context provider，负责 build 当前仓库的 review / impact / minimal context graph。
- A6. Downstream spec workflows: 第一版以 `spec-plan` 作为首个消费方，后续 `spec-write-tasks`、context-select / impact-check / code-review 再逐步读取 canonical artifacts；下游不直接解析 provider raw log。

---

## Key Flows

- F1. Setup-not-ready / blocked preflight flow
  - **Trigger:** Developer 在 `baseline_ready=false`、ledger 缺失、`.spec-first` 缺失、repo 不可读或 required config/schema 不可读时运行 `spec-graph-bootstrap`。
  - **Actors:** A1, A2, A3
  - **Steps:** `spec-graph-bootstrap` resolve repo root；读取 host ledger / `.spec-first/config/*`；`baseline_ready=false` 时写 `setup-not-ready`；repo/config/schema 缺失或不可读时写 `blocked`；停止 provider bootstrap。
  - **Outcome:** 不运行 `gitnexus analyze` 或 `code-review-graph build`；`.spec-first` 可写时落盘最小 report，hard blocked 且无法写入 repo artifact 时以 stdout JSON 作为权威输出。
  - **Covered by:** R2, R3, R4, R17

- F2. Primary graph bootstrap flow
  - **Trigger:** `baseline_ready=true`，GitNexus 和 `code-review-graph` 均 configured / enabled / setup ready。
  - **Actors:** A1, A3, A4, A5, A6
  - **Steps:** 运行 `npx -y gitnexus@latest analyze`；运行 `uvx code-review-graph build`；执行 provider status/query probe；捕获 raw logs；写 provider `status.json`；生成 normalized provider artifacts；聚合 canonical graph facts 和 impact capabilities；更新 runtime/config readiness。
  - **Outcome:** 两个 provider `query_ready=true`，`workflow_mode=primary`，downstream workflows 有标准 facts 入口。
  - **Covered by:** R5, R6, R8, R10, R11, R12, R13, R14, R15, R16, R17

- F3. Degraded fallback flow
  - **Trigger:** 任一 primary provider bootstrap 失败、跳过或 `query-unverified`，但 Serena 与 `ast-grep` fallback facts ready。
  - **Actors:** A1, A3, A6
  - **Steps:** 记录失败 provider 的 raw/status；保持失败 provider `query_ready=false` 或 `query-unverified`；检查 machine-readable fallback readiness；写 `workflow_mode=degraded-fallback`；保留 ready/failed primary provider 列表；按 capability 写 fallback support、confidence 和 limitations。
  - **Outcome:** workflow 可继续，但 downstream 能区分哪些 primary provider 仍可用、哪些 capability 只是降级可用或不可用。
  - **Covered by:** R7, R11, R12, R13, R17

- F4. Downstream consumption flow
  - **Trigger:** `spec-plan` 需要判断当前 repo 的 graph facts 是否 primary / degraded / stale；后续 `spec-write-tasks`、context / impact / review workflow 再接入同一 canonical facts。
  - **Actors:** A3, A6
  - **Steps:** `spec-plan` 读取 `.spec-first/graph/provider-status.json`、`.spec-first/graph/graph-facts.json`、`.spec-first/impact/bootstrap-impact-capabilities.json`；必要时按 artifact pointer 追溯 provider status/raw log；在计划输出中说明使用 primary 还是 fallback graph facts。
  - **Outcome:** 第一版下游闭环不是“只生成文件”，而是至少让 `spec-plan` 基于 canonical facts 调整上下文判断。
  - **Covered by:** R11, R12, R13, R20

---

## Requirements

**Responsibility Boundary**

- R1. `spec-graph-bootstrap` 只负责项目级 graph bootstrap readiness 编译：读取 `mcp-setup` 产物，运行 configured graph providers，沉淀 provider status、canonical graph facts、impact capabilities 和 bootstrap report。
- R2. `spec-graph-bootstrap` 必须读取并校验 `.spec-first`、host readiness ledger v2、`.spec-first/config/graph-providers.json`、`.spec-first/config/runtime-capabilities.json` 和 `.spec-first/config/provider-artifacts.json`；`runtime-capabilities.json` 和 `provider-artifacts.json` 由 `spec-mcp-setup` 生成，本阶段必须同步补齐对应 writer、v1 schema 和测试。`spec-graph-bootstrap` 不负责创建这些 setup-owned config，缺失或 schema 不受支持时必须 fail closed，并提示重新运行 `spec-mcp-setup`。
- R3. `baseline_ready=false`、repo 不可读、`.spec-first` 缺失或 required config 缺失时必须 fail closed：不执行 provider bootstrap，不伪造任何 provider `query_ready`；`baseline_ready=false` 写 `workflow_mode=setup-not-ready`，repo/config/schema 缺失或不可读写 `workflow_mode=blocked`。当 `.spec-first` 或 repo artifact path 不可写时，stdout JSON 是权威输出，且至少包含 `schema_version`、`workflow_mode`、`reason_code`、`baseline_ready`、`repo_root`、`writable_artifact_root`、`missing_inputs`、`next_action` 和 `generated_at`；只有 `.spec-first` 可写时才要求写最小 bootstrap report。
- R4. `spec-graph-bootstrap` 不得安装工具、修改 MCP host config、生成 glue-contract、生成 context-pack、生成 task 级 impact-facts、生成 review-evidence、直接修改业务代码，或恢复内置 CRG runtime；`code-review-graph` 只表示 external provider command / MCP provider，不表示 `src/crg/`、旧 `spec-first crg` 或旧 graph.db 生命周期。

**Provider Execution And Evidence**

- R5. 当 GitNexus configured / enabled / setup ready 时，脚本必须在 repo root 执行 `npx -y gitnexus@latest analyze`，写 `.spec-first/providers/gitnexus/raw/analyze.log`，并捕获 status probe / command output 到 `.spec-first/providers/gitnexus/raw/status.log`。这里允许的是 `mcp-setup` 已验证依赖后的 transient provider command execution，不等同于 persistent install。
- R6. 当 external `code-review-graph` configured / enabled / setup ready 时，脚本必须在 repo root 执行 `uvx code-review-graph build`，写 `.spec-first/providers/code-review-graph/raw/build.log`，并捕获 status probe / command output 到 `.spec-first/providers/code-review-graph/raw/status.log`。这里允许的是 `mcp-setup` 已验证依赖后的 transient provider command execution，不等同于 persistent install。
- R7. `query_ready` 必须由 bootstrap command 与 provider status/query probe 共同决定，只能来自真实 provider command/probe 成功结果；不得只因 bootstrap command exit 0 就设置 `query_ready=true`。若 command 成功但无法验证 query readiness，provider `status` 必须为 `query-unverified` 且 `query_ready=false`，并写明确 diagnostic、confidence 和 limitation；完全失败路径可直接写 `status=failed` / `query_ready=false`。失败、跳过、前置缺失或不确定状态必须保持 `query_ready=false`。
- R8. 每个 provider 必须写独立 `status.json`，至少包含 provider name、configured/enabled/setup readiness、command、exit code、status、query_ready、confidence、limitations、generated_at、repo_root、source_revision、worktree_dirty、raw log paths 和 normalized artifact paths。

**Provider Projection Paths**

- R9. provider-specific artifacts 必须统一落在 `.spec-first/providers/<provider>/` 下，按 `raw/`、`normalized/` 和 provider-level `status.json` 分层；不得继续新增 `.spec-first/graph/raw/<provider>/` 这种旧路径。
- R10. normalized provider artifacts 必须至少包含 GitNexus 的 `.spec-first/providers/gitnexus/normalized/architecture-facts.json` / `.spec-first/providers/gitnexus/normalized/reuse-candidates.json`，以及 `code-review-graph` 的 `.spec-first/providers/code-review-graph/normalized/impact-capabilities.json`；第一版允许这些文件是 conservative capability envelope，只抽取 status、capability、artifact pointer、available query surfaces、confidence 和 limitations，不得编造 architecture facts、reuse candidates 或 impact facts，也不得凭空生成未由 provider 输出或项目事实支持的语义结论。

**Canonical Project Artifacts**

- R11. `spec-graph-bootstrap` 必须生成 `.spec-first/graph/provider-status.json`，聚合两个 provider 的 readiness、query_ready、commands、diagnostics、confidence、limitations、artifact pointers、`partial_primary_available`、`ready_primary_providers` 和 `failed_primary_providers`；其中 `failed_primary_providers` 覆盖 failed、skipped、query-unverified 等所有未达到 `query_ready=true` 的 primary provider，并保留对应 reason/status。
- R12. `spec-graph-bootstrap` 必须生成 `.spec-first/graph/graph-facts.json`，作为下游 graph facts 入口，包含 repo identity、source_revision、worktree_dirty、workflow_mode、provider summary、canonical artifact pointers、available graph capabilities、partial primary summary、staleness hints、confidence 和 limitations。`.spec-first/graph/provider-status.json` 与 `.spec-first/graph/graph-facts.json` 是 compiled graph readiness 的权威来源。
- R13. `spec-graph-bootstrap` 必须生成 `.spec-first/impact/bootstrap-impact-capabilities.json`，表达项目级 impact capability 是否可用、由哪个 provider 支撑、fallback 能力、limitations 和 downstream use guidance；在 degraded mode 下必须按 `context_selection`、`impact_radius`、`review_support` 写 per-capability fallback envelope，分别包含 `supported`、supporting tools、confidence 和 limitations，没有可证明替代事实的 capability 必须标记为 unsupported。
- R14. `spec-graph-bootstrap` 必须生成 `.spec-first/graph/bootstrap-report.md`，面向用户说明执行结果、workflow_mode、成功/失败 provider、next actions、confidence/limitations 和 canonical artifact paths。

**Config Updates**

- R15. `spec-graph-bootstrap` 必须更新 `.spec-first/config/graph-providers.json` 中每个 provider 的 `query_ready`、`bootstrap_required`、`last_bootstrap_status`、`last_bootstrapped_at`、diagnostic summary 和 artifact pointers；这些字段是 canonical graph artifacts 的派生 summary，不得成为第二真相源。
- R16. `spec-graph-bootstrap` 必须更新 `.spec-first/config/runtime-capabilities.json`，写入 project graph readiness summary、workflow_mode、canonical artifact pointers、staleness summary 和 fallback limitations；不得重定义或覆盖 `baseline_ready` 的来源语义，也不得让 config summary 与 canonical graph artifacts 冲突。

**Workflow Mode**

- R17. `workflow_mode` 判定必须遵循：GitNexus 和 `code-review-graph` 均 `query_ready=true` 时为 `primary`；任一 primary provider 失败、跳过或 `query-unverified`，但 Serena + `ast-grep` fallback facts ready 时为 `degraded-fallback`；provider 不 ready 且 fallback 不 ready 时为 `blocked`，并写 `reason_code=graph-not-ready`；`baseline_ready=false` 时为 `setup-not-ready`；repo / `.spec-first` / required config / schema 缺失或不可读时为 `blocked`。fallback readiness 必须从 `runtime-capabilities.json` 中 machine-readable Serena / `ast-grep` readiness 字段读取，不得通过自然语言推断。`degraded-fallback` 不代表失败，默认允许后续 workflow 继续，但 canonical artifacts 和 report 必须写 confidence / limitations。

**Skill, Tests, And Documentation**

- R18. `skills/spec-graph-bootstrap/SKILL.md`、`bootstrap-providers.sh` 和 `bootstrap-providers.ps1` 必须对齐项目级 Graph Readiness Compiler 职责边界，并保持 shell / PowerShell 行为等价，覆盖 repo root resolve、baseline gate、provider execution、raw log 写入、status 写入、canonical artifact 聚合、config update 和 workflow_mode 判定。
- R19. 必须补充 `tests/unit/spec-graph-bootstrap.sh` 或等价单测，并更新 README / 当前用户文档 / `CHANGELOG.md`；测试至少覆盖 baseline blocked、primary success、provider failure + fallback ready、路径统一、no fake query_ready、config update 和 report 生成；测试入口必须接入 `package.json` / CI test script，确保 `spec-graph-bootstrap` 单测实际运行。
- R20. 第一版 downstream adoption 必须以 `spec-plan` 为首个消费方：`spec-plan` 在存在 canonical graph artifacts 时读取 `.spec-first/graph/graph-facts.json` 和 `.spec-first/impact/bootstrap-impact-capabilities.json`，并在计划输出中说明使用 `primary`、`degraded-fallback`、`stale` 或 `blocked` graph facts；本阶段不要求完整实现 context-select、impact-check 或 review-evidence pipeline。

---

## Acceptance Examples

- AE1. **Covers R2, R3, R17.** Given host ledger v2 exists but `baseline_ready=false`, when `bootstrap-providers.sh` runs, then neither provider command is executed, provider `query_ready` remains false, report says setup is not ready, and `workflow_mode=setup-not-ready`; given repo/config/schema is missing or unreadable, then `workflow_mode=blocked`, and stdout JSON is authoritative when `.spec-first` cannot be written, including `reason_code`, `missing_inputs`, `writable_artifact_root=false` and `next_action`.
- AE2. **Covers R5, R6, R7, R8, R10, R11, R12, R13, R14, R15, R16, R17.** Given both providers are configured and their build commands exit 0 and query probes verify readiness, when bootstrap completes, then raw logs exist under `.spec-first/providers/**/raw/`, provider `status.json` files include `source_revision` and `worktree_dirty`, canonical artifacts exist, graph-providers/runtime-capabilities are updated as derived summaries, and `workflow_mode=primary`.
- AE3. **Covers R7, R11, R12, R13, R17.** Given GitNexus succeeds, `code-review-graph build` fails, and machine-readable Serena + `ast-grep` fallback facts in `runtime-capabilities.json` are ready, when bootstrap completes, then `code-review-graph.query_ready=false`, `workflow_mode=degraded-fallback`, canonical artifacts include confidence / limitations, `partial_primary_available=true`, `ready_primary_providers=["gitnexus"]`, `failed_primary_providers=["code-review-graph"]`, and unsupported fallback capabilities are explicitly marked unsupported.
- AE4. **Covers R9, R10.** Given bootstrap writes provider evidence, when the output tree is inspected, then provider raw and normalized files are under `.spec-first/providers/<provider>/...` and no new provider raw evidence is written under `.spec-first/graph/raw/<provider>/`.
- AE5. **Covers R15, R16.** Given repeated bootstrap after previous success, when provider setup remains ready, then `graph-providers.json` preserves accurate query readiness and refreshes bootstrap timestamps/status without changing setup-only ownership facts into host setup facts.
- AE6. **Covers R1, R4.** Given bootstrap runs in a repo with external providers ready, when file changes are inspected, then no MCP host config is modified, no `src/crg/` or old CRG runtime path is recreated, and no task-level glue/context/review artifacts are generated.
- AE7. **Covers R19.** Given the new graph-bootstrap unit test exists, when the repository test scripts are inspected, then the test is reachable from `package.json` and CI so it cannot be bypassed by normal validation.
- AE8. **Covers R7, R17.** Given GitNexus analyze exits 0 but the GitNexus status/query probe fails or is unavailable, when bootstrap completes, then GitNexus status is `query-unverified`, `query_ready=false`, and diagnostics explain that command success did not verify query readiness; if fallback is ready, `workflow_mode=degraded-fallback`; if fallback is not ready, `workflow_mode=blocked` with `reason_code=graph-not-ready`; canonical artifacts include limitations.
- AE9. **Covers R2, R16, R19.** Given `spec-mcp-setup` runs in a git repo, when setup completes, then `.spec-first/config/runtime-capabilities.json` and `.spec-first/config/provider-artifacts.json` exist with v1 schemas and machine-readable Serena / `ast-grep` readiness fields consumed by `spec-graph-bootstrap`.
- AE10. **Covers R12, R20.** Given `spec-plan` runs after successful graph bootstrap, when canonical graph artifacts exist, then the plan reads `graph-facts.json` and `bootstrap-impact-capabilities.json` and states whether it is using primary, degraded, stale, or blocked graph facts.
- AE11. **Covers R12.** Given the repo HEAD or dirty-worktree state differs from the recorded `source_revision` / `worktree_dirty`, when a downstream workflow reads graph facts, then the corresponding provider capability is treated as stale until `spec-graph-bootstrap` is rerun.

---

## Success Criteria

- Downstream workflows can decide primary vs fallback by reading canonical `.spec-first/graph/*` and `.spec-first/impact/*` artifacts, without scraping provider raw logs.
- `spec-plan` is the first downstream consumer and visibly reports whether it used primary, degraded, stale, or blocked graph facts.
- A failed provider does not silently degrade evidence quality; every fallback path carries explicit confidence and limitations.
- A partially available primary provider remains visible through `partial_primary_available`, ready provider lists, failed provider lists, and per-capability support envelopes.
- Stale graph facts are detectable through recorded source revision and worktree state.
- Hard blocked runs still produce machine-readable stdout JSON when repo artifacts cannot be written, so callers are not forced to parse prose failures.
- `spec-mcp-setup` remains a setup/projection workflow and does not absorb project graph build responsibilities.
- `spec-graph-bootstrap` remains deterministic: scripts run commands, capture logs, write machine facts; LLMs interpret those facts later.
- The implementation can be verified by unit tests without requiring real GitNexus or `code-review-graph` network/build execution in every test path.

---

## Scope Boundaries

- Do not persistently install GitNexus, `code-review-graph`, Serena, `ast-grep`, `uvx`, `npx`, or any MCP/helper tool. `npx -y gitnexus@latest analyze` and `uvx code-review-graph build` are allowed only as transient provider command execution after `spec-mcp-setup` has verified command availability.
- Do not write Claude/Codex MCP host config.
- Do not reintroduce `spec-first crg`, `src/crg/`, old internal CRG runtime, old graph.db ownership, or old CRG native dependency lifecycle.
- Do not generate `glue-contract.json`; that belongs to the later `spec-write-tasks` stage.
- Do not generate task-level context-pack, impact-facts, review-evidence, or glue-evidence.
- Do not implement `spec-material-sync`, glue metrics, automatic rule generation, multi-domain material router, cloud material distribution, or a full review evidence pipeline.
- Do not require all downstream workflows to consume graph facts in this stage; only `spec-plan` is the first explicit consumer.
- Do not make `workflow_mode` a heavy state machine or central gate; it is a compiled readiness fact for LLM consumption.

---

## Key Decisions

- **Graph Readiness Compiler over platform buildout:** This stage compiles provider readiness facts and canonical artifacts only; it does not start a broader graph platform or Glue Coding implementation.
- **External providers over internal CRG:** GitNexus and external `code-review-graph` are the primary provider pair; old internal CRG remains retired.
- **Canonical facts over raw provider coupling:** Downstream workflows should read `.spec-first/graph/provider-status.json`, `.spec-first/graph/graph-facts.json` and `.spec-first/impact/bootstrap-impact-capabilities.json` first, using provider raw logs only for diagnostics.
- **Fail closed for setup, degrade for provider quality:** Missing setup blocks provider bootstrap; provider bootstrap failures can fall back when Serena + `ast-grep` are ready, but must carry limitations.
- **Partial primary over all-or-nothing primary:** `workflow_mode=degraded-fallback` can coexist with ready primary providers; canonical artifacts preserve provider-level and capability-level availability instead of flattening everything into failure.
- **Freshness is part of readiness:** Graph readiness facts describe a specific repo snapshot; stale facts remain readable but cannot be treated as current primary evidence.
- **Light contract:** Scripts write bounded JSON/Markdown facts. They do not decide which graph evidence matters for a task; downstream LLM workflows make that semantic decision.

---

## Dependencies / Assumptions

- `spec-mcp-setup` remains the source of host ledger v2 and `.spec-first/config/graph-providers.json`.
- `.spec-first/config/runtime-capabilities.json` and `.spec-first/config/provider-artifacts.json` are owned by `spec-mcp-setup` and are in scope for this same implementation chain; planning must define their v1 schemas and writer tests before `spec-graph-bootstrap` consumes them as fail-closed inputs.
- Provider command availability is established by `mcp-setup`; `spec-graph-bootstrap` can report missing commands as action-required but should not install them.
- Fallback readiness depends on machine-readable Serena and `ast-grep` facts being available from `runtime-capabilities.json`; natural-language setup output is not a valid fallback readiness source.
- PowerShell parity is required because current bootstrap already has `.sh` and `.ps1` implementations.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R2, R16, R17][Technical] Define the exact v1 schemas for `.spec-first/config/runtime-capabilities.json` and `.spec-first/config/provider-artifacts.json`, including machine-readable Serena / `ast-grep` readiness fields and provider artifact pointers.
- [Affects R7, R8][Technical] Define provider status probe commands and minimal success conditions after `gitnexus analyze` / `code-review-graph build`, so `query_ready` is not based solely on process exit when that would be insufficient.
- [Affects R10][Technical] Define the conservative normalized artifact schema for architecture facts, reuse candidates, and impact capabilities without requiring semantic extraction that belongs to LLM workflows.
- [Affects R19][Technical] Decide test strategy for shell/PowerShell parity: fixture fake commands, temp repo config, and expected output tree assertions.
- [Affects R20][Technical] Define the smallest `spec-plan` consumption behavior that proves adoption without expanding into full context-select / impact-check implementation.

---

## Next Steps

-> `$spec-plan` for structured implementation planning.
