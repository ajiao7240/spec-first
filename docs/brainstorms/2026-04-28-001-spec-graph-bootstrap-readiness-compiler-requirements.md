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
- A2. `spec-mcp-setup`: 宿主与项目 projection 前置准备者，只写 setup/readiness/projection 事实，不运行 graph build。
- A3. `spec-graph-bootstrap`: 项目级 Graph Readiness Compiler，读取 setup 产物、运行 provider build、生成 canonical facts。
- A4. GitNexus provider: external global knowledge provider，负责 repository analysis、architecture map、execution flow、query graph 能力。
- A5. `code-review-graph` provider: external impact/context provider，负责 build 当前仓库的 review / impact / minimal context graph。
- A6. Downstream spec workflows: `spec-plan`、`spec-write-tasks`、未来 context-select / impact-check / code-review，读取 canonical artifacts，不直接解析 provider raw log。

---

## Key Flows

- F1. Baseline blocked flow
  - **Trigger:** Developer 在 `baseline_ready=false`、ledger 缺失、`.spec-first` 缺失或 repo 不可读时运行 `spec-graph-bootstrap`。
  - **Actors:** A1, A2, A3
  - **Steps:** `spec-graph-bootstrap` resolve repo root；读取 host ledger / `.spec-first/config/*`；发现前置未 ready；写入 blocked status/report；停止 provider bootstrap。
  - **Outcome:** 不运行 `gitnexus analyze` 或 `code-review-graph build`，输出明确 next action。
  - **Covered by:** R2, R3, R4, R17

- F2. Primary graph bootstrap flow
  - **Trigger:** `baseline_ready=true`，GitNexus 和 `code-review-graph` 均 configured / enabled / setup ready。
  - **Actors:** A1, A3, A4, A5, A6
  - **Steps:** 运行 `npx -y gitnexus@latest analyze`；运行 `uvx code-review-graph build`；捕获 raw logs；写 provider `status.json`；生成 normalized provider artifacts；聚合 canonical graph facts 和 impact capabilities；更新 runtime/config readiness。
  - **Outcome:** 两个 provider `query_ready=true`，`workflow_mode=primary`，downstream workflows 有标准 facts 入口。
  - **Covered by:** R5, R6, R8, R10, R11, R12, R13, R14, R15, R16, R17

- F3. Degraded fallback flow
  - **Trigger:** 任一 primary provider bootstrap 失败，但 Serena 与 `ast-grep` fallback facts ready。
  - **Actors:** A1, A3, A6
  - **Steps:** 记录失败 provider 的 raw/status；保持失败 provider `query_ready=false`；检查 fallback readiness；写 `workflow_mode=degraded-fallback`；在 canonical artifacts 中写 confidence 和 limitations。
  - **Outcome:** workflow 可继续，但 downstream 必须知道证据质量和限制。
  - **Covered by:** R7, R17

- F4. Downstream consumption flow
  - **Trigger:** `spec-plan`、`spec-write-tasks` 或后续 context / impact / review workflow 需要 graph facts。
  - **Actors:** A3, A6
  - **Steps:** Downstream 读取 `.spec-first/graph/provider-status.json`、`.spec-first/graph/graph-facts.json`、`.spec-first/impact/bootstrap-impact-capabilities.json`；必要时按 artifact pointer 追溯 provider status/raw log。
  - **Outcome:** 下游不需要猜 provider readiness，也不直接依赖 provider raw 目录结构。
  - **Covered by:** R11, R12, R13

---

## Requirements

**Responsibility Boundary**

- R1. `spec-graph-bootstrap` 只负责项目级 graph bootstrap readiness 编译：读取 `mcp-setup` 产物，运行 configured graph providers，沉淀 provider status、canonical graph facts、impact capabilities 和 bootstrap report。
- R2. `spec-graph-bootstrap` 必须读取并校验 `.spec-first`、host readiness ledger v2、`.spec-first/config/graph-providers.json`、`.spec-first/config/runtime-capabilities.json` 和 `.spec-first/config/provider-artifacts.json`；`provider-artifacts.json` 由 `spec-mcp-setup` 生成，`spec-graph-bootstrap` 不负责创建该文件，缺失或 schema 不受支持时必须 fail closed，并提示重新运行 `spec-mcp-setup`。
- R3. `baseline_ready=false`、repo 不可读、`.spec-first` 缺失或 required config 缺失时必须 fail closed：不执行 provider bootstrap，不伪造任何 provider `query_ready`，并写 blocked / setup-not-ready facts。
- R4. `spec-graph-bootstrap` 不得安装工具、修改 MCP host config、生成 glue-contract、生成 context-pack、生成 task 级 impact-facts、生成 review-evidence、直接修改业务代码，或恢复内置 CRG runtime；`code-review-graph` 只表示 external provider command / MCP provider，不表示 `src/crg/`、旧 `spec-first crg` 或旧 graph.db 生命周期。

**Provider Execution And Evidence**

- R5. 当 GitNexus configured / enabled / setup ready 时，脚本必须在 repo root 执行 `npx -y gitnexus@latest analyze`，写 `.spec-first/providers/gitnexus/raw/analyze.log`，并捕获 status probe / command output 到 `.spec-first/providers/gitnexus/raw/status.log`。
- R6. 当 external `code-review-graph` configured / enabled / setup ready 时，脚本必须在 repo root 执行 `uvx code-review-graph build`，写 `.spec-first/providers/code-review-graph/raw/build.log`，并捕获 status probe / command output 到 `.spec-first/providers/code-review-graph/raw/status.log`。
- R7. `query_ready` 必须由 bootstrap command 与 provider status/query probe 共同决定，只能来自真实 provider command/probe 成功结果；若 command 成功但无法验证 query readiness，状态必须为 `query-unverified` 或 `query_ready=false`，并写明确 diagnostic、confidence 和 limitation。失败、跳过、前置缺失或不确定状态必须保持 `query_ready=false`。
- R8. 每个 provider 必须写独立 `status.json`，至少包含 provider name、configured/enabled/setup readiness、command、exit code、status、query_ready、confidence、limitations、generated_at、raw log paths 和 normalized artifact paths。

**Provider Projection Paths**

- R9. provider-specific artifacts 必须统一落在 `.spec-first/providers/<provider>/` 下，按 `raw/`、`normalized/` 和 provider-level `status.json` 分层；不得继续新增 `.spec-first/graph/raw/<provider>/` 这种旧路径。
- R10. normalized provider artifacts 必须至少包含 GitNexus 的 `.spec-first/providers/gitnexus/normalized/architecture-facts.json` / `.spec-first/providers/gitnexus/normalized/reuse-candidates.json`，以及 `code-review-graph` 的 `.spec-first/providers/code-review-graph/normalized/impact-capabilities.json`；第一版允许这些文件是 conservative capability envelope，只抽取 status、capability、artifact pointer、available query surfaces、confidence 和 limitations，不得编造 architecture facts、reuse candidates 或 impact facts，也不得凭空生成未由 provider 输出或项目事实支持的语义结论。

**Canonical Project Artifacts**

- R11. `spec-graph-bootstrap` 必须生成 `.spec-first/graph/provider-status.json`，聚合两个 provider 的 readiness、query_ready、commands、diagnostics、confidence、limitations 和 artifact pointers。
- R12. `spec-graph-bootstrap` 必须生成 `.spec-first/graph/graph-facts.json`，作为下游 graph facts 入口，包含 repo identity、workflow_mode、provider summary、canonical artifact pointers、available graph capabilities、confidence 和 limitations。
- R13. `spec-graph-bootstrap` 必须生成 `.spec-first/impact/bootstrap-impact-capabilities.json`，表达项目级 impact capability 是否可用、由哪个 provider 支撑、fallback 能力、limitations 和 downstream use guidance。
- R14. `spec-graph-bootstrap` 必须生成 `.spec-first/graph/bootstrap-report.md`，面向用户说明执行结果、workflow_mode、成功/失败 provider、next actions、confidence/limitations 和 canonical artifact paths。

**Config Updates**

- R15. `spec-graph-bootstrap` 必须更新 `.spec-first/config/graph-providers.json` 中每个 provider 的 `query_ready`、`bootstrap_required`、`last_bootstrap_status`、`last_bootstrapped_at`、diagnostic summary 和 artifact pointers。
- R16. `spec-graph-bootstrap` 必须更新 `.spec-first/config/runtime-capabilities.json`，写入 project graph readiness summary、workflow_mode、canonical artifact pointers 和 fallback limitations；不得重定义或覆盖 `baseline_ready` 的来源语义。

**Workflow Mode**

- R17. `workflow_mode` 判定必须遵循：GitNexus 和 `code-review-graph` 均 `query_ready=true` 时为 `primary`；任一 primary provider 失败但 Serena + `ast-grep` fallback facts ready 时为 `degraded-fallback`；`baseline_ready=false` 时为 `setup-not-ready`；repo / `.spec-first` / required config / schema 缺失或不可读时为 `blocked`。fallback readiness 必须从 `runtime-capabilities.json` 中 machine-readable Serena / `ast-grep` readiness 字段读取，不得通过自然语言推断。`degraded-fallback` 不代表失败，默认允许后续 workflow 继续，但 canonical artifacts 和 report 必须写 confidence / limitations。

**Skill, Tests, And Documentation**

- R18. `skills/spec-graph-bootstrap/SKILL.md`、`bootstrap-providers.sh` 和 `bootstrap-providers.ps1` 必须对齐项目级 Graph Readiness Compiler 职责边界，并保持 shell / PowerShell 行为等价，覆盖 repo root resolve、baseline gate、provider execution、raw log 写入、status 写入、canonical artifact 聚合、config update 和 workflow_mode 判定。
- R19. 必须补充 `tests/unit/spec-graph-bootstrap.sh` 或等价单测，并更新 README / 当前用户文档 / `CHANGELOG.md`；测试至少覆盖 baseline blocked、primary success、provider failure + fallback ready、路径统一、no fake query_ready、config update 和 report 生成；测试入口必须接入 `package.json` / CI test script，确保 `spec-graph-bootstrap` 单测实际运行。

---

## Acceptance Examples

- AE1. **Covers R2, R3, R17.** Given host ledger v2 exists but `baseline_ready=false`, when `bootstrap-providers.sh` runs, then neither provider command is executed, provider `query_ready` remains false, report says setup is not ready, and `workflow_mode=setup-not-ready`; given repo/config/schema is missing or unreadable, then `workflow_mode=blocked`.
- AE2. **Covers R5, R6, R7, R8, R10, R11, R12, R13, R14, R15, R16, R17.** Given both providers are configured and their build commands exit 0 and query probes verify readiness, when bootstrap completes, then raw logs exist under `.spec-first/providers/**/raw/`, provider `status.json` files exist, canonical artifacts exist, graph-providers/runtime-capabilities are updated, and `workflow_mode=primary`.
- AE3. **Covers R7, R17.** Given GitNexus succeeds, `code-review-graph build` fails, and machine-readable Serena + `ast-grep` fallback facts in `runtime-capabilities.json` are ready, when bootstrap completes, then `code-review-graph.query_ready=false`, `workflow_mode=degraded-fallback`, and all canonical artifacts include confidence / limitations rather than claiming full impact readiness.
- AE4. **Covers R9, R10.** Given bootstrap writes provider evidence, when the output tree is inspected, then provider raw and normalized files are under `.spec-first/providers/<provider>/...` and no new provider raw evidence is written under `.spec-first/graph/raw/<provider>/`.
- AE5. **Covers R15, R16.** Given repeated bootstrap after previous success, when provider setup remains ready, then `graph-providers.json` preserves accurate query readiness and refreshes bootstrap timestamps/status without changing setup-only ownership facts into host setup facts.
- AE6. **Covers R1, R4.** Given bootstrap runs in a repo with external providers ready, when file changes are inspected, then no MCP host config is modified, no `src/crg/` or old CRG runtime path is recreated, and no task-level glue/context/review artifacts are generated.
- AE7. **Covers R19.** Given the new graph-bootstrap unit test exists, when the repository test scripts are inspected, then the test is reachable from `package.json` and CI so it cannot be bypassed by normal validation.

---

## Success Criteria

- Downstream workflows can decide primary vs fallback by reading canonical `.spec-first/graph/*` and `.spec-first/impact/*` artifacts, without scraping provider raw logs.
- A failed provider does not silently degrade evidence quality; every fallback path carries explicit confidence and limitations.
- `spec-mcp-setup` remains a setup/projection workflow and does not absorb project graph build responsibilities.
- `spec-graph-bootstrap` remains deterministic: scripts run commands, capture logs, write machine facts; LLMs interpret those facts later.
- The implementation can be verified by unit tests without requiring real GitNexus or `code-review-graph` network/build execution in every test path.

---

## Scope Boundaries

- Do not install GitNexus, `code-review-graph`, Serena, `ast-grep`, `uvx`, `npx`, or any MCP/helper tool.
- Do not write Claude/Codex MCP host config.
- Do not reintroduce `spec-first crg`, `src/crg/`, old internal CRG runtime, old graph.db ownership, or old CRG native dependency lifecycle.
- Do not generate `glue-contract.json`; that belongs to the later `spec-write-tasks` stage.
- Do not generate task-level context-pack, impact-facts, review-evidence, or glue-evidence.
- Do not implement `spec-material-sync`, glue metrics, automatic rule generation, multi-domain material router, cloud material distribution, or a full review evidence pipeline.
- Do not make `workflow_mode` a heavy state machine or central gate; it is a compiled readiness fact for LLM consumption.

---

## Key Decisions

- **Graph Readiness Compiler over platform buildout:** This stage compiles provider readiness facts and canonical artifacts only; it does not start a broader graph platform or Glue Coding implementation.
- **External providers over internal CRG:** GitNexus and external `code-review-graph` are the primary provider pair; old internal CRG remains retired.
- **Canonical facts over raw provider coupling:** Downstream workflows should read `.spec-first/graph/provider-status.json`, `.spec-first/graph/graph-facts.json` and `.spec-first/impact/bootstrap-impact-capabilities.json` first, using provider raw logs only for diagnostics.
- **Fail closed for setup, degrade for provider quality:** Missing setup blocks provider bootstrap; provider bootstrap failures can fall back when Serena + `ast-grep` are ready, but must carry limitations.
- **Light contract:** Scripts write bounded JSON/Markdown facts. They do not decide which graph evidence matters for a task; downstream LLM workflows make that semantic decision.

---

## Dependencies / Assumptions

- `spec-mcp-setup` remains the source of host ledger v2 and `.spec-first/config/graph-providers.json`.
- `.spec-first/config/runtime-capabilities.json` and `.spec-first/config/provider-artifacts.json` are expected by this design. `provider-artifacts.json` is owned by `spec-mcp-setup`; planning must verify or define its schema before implementation, not move ownership to `spec-graph-bootstrap`.
- Provider command availability is established by `mcp-setup`; `spec-graph-bootstrap` can report missing commands as action-required but should not install them.
- Fallback readiness depends on machine-readable Serena and `ast-grep` facts being available from `runtime-capabilities.json`; natural-language setup output is not a valid fallback readiness source.
- PowerShell parity is required because current bootstrap already has `.sh` and `.ps1` implementations.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R2][Technical] Confirm the intended schema for `.spec-first/config/provider-artifacts.json` and the exact `spec-mcp-setup` writer change if the file is absent today.
- [Affects R16, R17][Technical] Confirm the exact machine-readable Serena and `ast-grep` readiness field names in `runtime-capabilities.json`, and the `spec-mcp-setup` writer change if those fields are absent today.
- [Affects R7, R8][Technical] Define provider status probe commands and minimal success conditions after `gitnexus analyze` / `code-review-graph build`, so `query_ready` is not based solely on process exit when that would be insufficient.
- [Affects R10][Technical] Define the conservative normalized artifact schema for architecture facts, reuse candidates, and impact capabilities without requiring semantic extraction that belongs to LLM workflows.
- [Affects R19][Technical] Decide test strategy for shell/PowerShell parity: fixture fake commands, temp repo config, and expected output tree assertions.

---

## Next Steps

-> `$spec-plan` for structured implementation planning.
