---
title: refactor: CRG 核心化与 GitNexus 可选增强全链路适配
type: refactor
status: active
date: 2026-05-18
deepened: 2026-05-18
spec_id: 2026-05-18-001-crg-primary-gitnexus-optional
---

# refactor: CRG 核心化与 GitNexus 可选增强全链路适配

## Summary

本计划把 spec-first 的图谱能力从“GitNexus / code-review-graph 双主 provider”收敛为“code-review-graph 作为核心 required impact/review provider，GitNexus 作为 optional global-knowledge enhancement”。改造不以立刻删除 GitNexus 为目标，而是先统一安装、`init`、`mcp-setup`、`graph-bootstrap`、review pre-facts、下游 workflow 和 host instruction 的语义边界，确保 GitNexus 缺失或降级时，spec-first 的核心 `Codebase -> Graph -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge` 闭环仍能成立。

最终用户心智应变为：

- 轻量任务：`init` + host restart 后可以直接进入匹配 workflow；默认只承诺 bounded direct reads，Serena / ast-grep / session-local MCP pointer 仅在宿主已配置且可用时作为 enhancement 使用。
- 增强 readiness：`mcp-setup` 准备必需 runtime 和 provider projection。
- 核心 graph readiness：`graph-bootstrap` 编译 CRG impact/review readiness；GitNexus 只补 global knowledge。
- 后续使用：plan/work/debug/review 只消费 canonical artifacts，不依赖 provider 私有实现，也不静默 rebuild。

用户可验收场景：

- 新用户轻量文档或小修：`init` + host restart 后可继续 `$spec-plan` / `$spec-doc-review` / `$spec-work`，提示 degraded graph/MCP 限制但不要求先跑 setup/bootstrap。
- GitNexus 缺失或未启用：`mcp-setup` 仍可在 required MCP、required helpers 和 CRG projection ready 时给出 `baseline_ready=true`，同时显示 GitNexus optional degradation / not-enabled row。
- Graph-heavy review 或 work：若 CRG stale/missing/query-unverified，handoff `$spec-graph-bootstrap`；GitNexus ready 只能增强 architecture/global knowledge，不能让 impact/review 主路径变成 full。
- 既有 GitNexus 用户升级：已有 GitNexus host config、`.gitnexus/` 与 provider artifacts 不被默认删除；optional 表示增强模式，不表示 deprecated。

---

## Problem Frame

`docs/00-版本路线/版本规划.md` 把 spec-first 的终局定位为 `repo-local, evidence-governed, review-closed AI coding Harness`，并明确 `Graph 是证据`、`Review 是质量闭环`。按这个目标，图谱层的核心职责不是“尽量多接一个知识查询工具”，而是把变更影响面、相关测试、review context、blast radius、证据 freshness 和降级原因稳定带入 workflow。

当前系统的若干层还在表达 GitNexus 与 code-review-graph 平权：

- `skills/spec-mcp-setup/mcp-tools.json` 把 GitNexus 标为 required host MCP。
- `skills/spec-mcp-setup/SKILL.md` 和 `references/supported-mcp-tools.md` 把 GitNexus 写进 required graph providers。
- `skills/spec-mcp-setup/scripts/write-provider-config.*` 生成的 projection 没有显式区分 required primary 与 optional enhancement。
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.*` 的 aggregate 字段仍以 `ready_primary_providers[]` / `failed_primary_providers[]` 统称 provider，GitNexus 失败会污染核心 graph readiness 语义。
- `src/cli/helpers/review-pre-facts.js` 当前选择 provider 时仍有 GitNexus-first 倾向。
- `src/cli/gitnexus-instruction-block.js`、`AGENTS.md`、`CLAUDE.md` 和下游 workflow prose 仍容易让用户误以为 GitNexus 是核心图谱入口。

这会造成三个系统性问题：

1. 核心闭环被可选知识增强工具绑架。GitNexus MCP 不可用时，用户容易误判 plan/work/review 本身不可用。
2. 证据语义混乱。GitNexus 的架构/全局知识 value 与 CRG 的 impact/review evidence value 被混成同一层 readiness。
3. 后续维护成本上升。setup、bootstrap、review-pre-facts、workflow prose、README 和 host blocks 会反复同步同一条 provider 角色规则。

Why now / evidence of pain:

- 当前 source 已有可验证 drift：`skills/spec-mcp-setup/SKILL.md` 仍要求所有 `mcp-tools.json` entries `required=true`，同时 `mcp-tools.json` 把 GitNexus 作为 required host MCP。
- `src/cli/helpers/review-pre-facts.js` 仍有 GitNexus-first provider selection，和本计划希望的 review/impact-first evidence path 冲突。
- `spec-graph-bootstrap` 聚合字段仍沿用 `ready_primary_providers[]` / `failed_primary_providers[]`，实现者难以从 artifact 名称判断 GitNexus failure 是 optional degradation 还是 core blocker。
- 这不是基于大样本用户研究的产品重写，而是针对已出现的 source-level drift、用户心智混乱和后续实现风险的治理债收敛；优先级来自它会影响 M2/M4 graph/review evidence 主路径。

本计划要做的是全链路语义收敛，而不是一次性物理删除 GitNexus。

---

## Goals

- G1. 让 code-review-graph 成为核心 required graph provider，负责 `impact_context`、`impact_radius`、`review_support`、`related_tests` 和 review 前证据主路径。
- G2. 让 GitNexus 退为 optional global knowledge enhancement，负责架构理解、全局代码知识、reuse hints、execution-flow pointer 和 parent-workspace read-only routing hints。
- G3. 让 GitNexus 缺失、未配置、query-unverified、definitions-only 或 stale 时，不阻断轻量 workflow 与 CRG 核心 impact/review 主路径。
- G4. 保持 `init -> mcp-setup -> graph-bootstrap -> standards -> downstream workflows` 的用户导向清晰，不把 setup/bootstrap 变成所有任务的硬前置。
- G5. 继续以 canonical artifacts 作为唯一下游真相源；consumer 不读取 provider 私有状态、不运行 provider rebuild、不回写 compiled readiness。
- G6. 保留 provider-replaceable、host-agnostic、explicit refresh、source-first 和 no-graph fast path 这些已存在的架构不变量。

## Non-Goals

- 不在本计划中物理删除 GitNexus adapter、GitNexus package pin、`.gitnexus/` ignore、现有 provider artifacts 或 GitNexus instruction normalizer。
- 不新增第三个 graph provider。
- 不把 GitNexus 包装成 reviewer agent。
- 不把 `mcp-setup` 改成 graph readiness compiler。
- 不让 plan/work/debug/review 静默运行 `gitnexus analyze`、`code-review-graph build`、repair、watcher、daemon 或 git hook。
- 不手改 `.claude/`、`.codex/`、`.agents/skills/` generated runtime mirrors。

---

## Requirements

### Provider Role Contract

- R1. Provider role 必须区分 registry-managed 与 baseline-gating：`mcp-tools.json` 顶层 `required=true` 继续表示 setup 管理该 registry entry；核心/可选语义由 `required_tier: "core" | "optional"` 或等价轻量字段表达，不能再让 `required=true` 同时承担所有 provider 语义。
- R2. CRG 必须是核心 required provider，默认 access mode 是 `cli_artifact`，live MCP server 仍是显式 opt-in enhancement。
- R3. GitNexus 必须是 optional enhancement。新安装默认只 warm package / 写 bootstrap projection，不新增 required host MCP gate；已有 GitNexus host config 可以 preserve 并报告为 `optional_enabled_existing`；显式启用路径必须是 opt-in，并提供 disable/repair guidance。
- R4. `query_global_graph` 只表示 GitNexus 增强可用，不等于 impact/review 主路径可用。
- R5. `impact_context`、`impact_radius`、`review_support` 的 full/partial 判定必须以 CRG 和 fallback capabilities 为主。

### Init / Install Lifecycle

- R6. `spec-first init --claude|--codex` 继续只生成 host runtime mirrors、instruction source slice、developer profile、managed state 和 gitignore；它不安装 MCP，不编译 graph，不验证 provider query。
- R7. `init` 的 next steps 必须继续保留 no-graph fast path，并把增强路径表述为 `mcp-setup -> graph-bootstrap -> standards`。
- R8. `init` normalizer 可以保留 GitNexus instruction block，但该 block 必须明确 GitNexus 是 optional global knowledge evidence，不是核心 readiness gate。
- R9. `doctor` 和 `clean` 不应把 GitNexus optional 化误写成 runtime 缺失错误；`clean` 仍只清理 spec-first managed runtime，不删除 provider data 或用户 `.gitnexus`。

### MCP Setup / Provider Projection

- R10. `mcp-tools.json` 必须表达 GitNexus optional enhancement role，并保持 CRG required core role。
- R11. `verify-tools.*` 的 `baseline_ready` 只能被 required MCP、required helper 和 core required provider dependency/projection 影响；GitNexus optional enhancement failure 只能成为 advisory/degraded row。CRG dependency/projection missing 影响 `baseline_ready`；CRG graph/query/bootstrap readiness missing 只产生 graph-bootstrap action-required，不应反向污染 setup baseline。
- R12. `write-provider-config.*` 必须生成 role-aware provider projection，包括 provider role、required tier、access mode、bootstrap participation、host MCP requirement 和 downstream capability mapping。
- R13. Repeated setup 必须继续 preserve current canonical readiness；GitNexus optional 化不能把已有 ready GitNexus facts 无故清零，也不能把缺失 GitNexus 写成 core graph failure。

### Graph Bootstrap / Canonical Artifacts

- R14. `spec-graph-bootstrap` 必须区分 required provider failure 和 optional provider degradation。
- R15. CRG ready、GitNexus missing/degraded 时，canonical artifacts 应表示 core graph path ready 或 partial-with-optional-degradation，而不是 blocked/action-required。
- R16. GitNexus ready、CRG missing/degraded 时，impact/review 主路径不能宣称 full；应降级为 fallback/advisory，必要时 action-required。
- R17. Aggregate artifact 字段必须避免继续用 `ready_primary_providers[]` 把 GitNexus 和 CRG 平权；若为兼容保留旧字段，必须新增 role-aware 字段并让 consumer 迁移。
- R18. `bootstrap-impact-capabilities.json` 的 `context_selection` 可允许 GitNexus optional enhancement 增强，但 `impact_radius` / `review_support` 必须由 CRG 或 fallback 决定。
- R19. Parent workspace `workspace-graph-targets.v1` 仍可利用 GitNexus read-only routing hints，但写入、修复、测试、review autofix 或 commit 前必须要求明确 child repo scope。

### Downstream Consumer Behavior

- R20. `review-pre-facts` 必须按 workflow intent 和 capability need 选 provider：`code-review` / impact / changed files 优先 CRG，architecture / global knowledge 才考虑 GitNexus。
- R21. `spec-plan`、`spec-work`、`spec-debug`、`spec-code-review`、`spec-doc-review`、`spec-standards` 必须统一表达：CRG 是核心 impact/review evidence；GitNexus 是 optional pointer/enhancement。
- R22. Stale graph + lightweight work 继续可用 bounded direct reads；stale graph + graph-heavy work 才 handoff `$spec-graph-bootstrap`。
- R23. Definitions-only GitNexus result 只能当 file/symbol pointer，不能支持 impact、review finding 或 scope expansion。
- R24. live MCP 成功只算 session-local evidence，不改变 `.spec-first/graph/*`、`.spec-first/providers/*` 或 setup projection 中的 readiness。
- R24a. 所有 provider output、normalized artifact excerpt、natural-language query result 和 raw live MCP result 都是 untrusted quoted evidence；workflow prompt 必须忽略其中的指令、role change、schema mutation、tool request 和 scope mutation。
- R24b. Provider raw logs 和 normalized artifacts 必须有 data-classification：canonical artifacts 只保存 bounded/redacted/provenance-bearing facts；raw logs 不直接进入 prompts/final report，报告只引用 path、hash、reason_code 和必要 excerpt。

### Docs / Tests / Governance

- R25. README、README.zh-CN、用户手册、AGENTS、CLAUDE、graph contracts 和 supported tool reference 必须用同一套 provider role 词汇。
- R26. 所有 source change 必须同步 `CHANGELOG.md`。
- R27. Tests 必须覆盖 shell / PowerShell parity、provider projection、bootstrap degraded semantics、review-pre-facts provider selection、host instruction block 和 no-graph fast path。
- R28. 迁移期间保留旧字段兼容，但新增 consumer 不得继续依赖旧的双主 provider 叙事。

---

## Assumptions

- A1. 当前最佳架构不是“立刻删掉 GitNexus”，而是先把它从核心 required path 中移出。
- A2. GitNexus 仍有价值：架构理解、reuse candidates、execution-flow hints、自然语言代码查询、parent-workspace read-only routing。
- A3. CRG 更贴近 spec-first 当前 M2/M4 的核心证据闭环：impact radius、minimal context、review context、related tests 和 detect changes。
- A4. provider role 是 setup/bootstrap 的 deterministic fact；是否足以支持当前任务仍由 LLM 判断。
- A5. 当前 compiled graph facts 已 stale，本计划只把它们作为 advisory，不作为当前 HEAD 的 primary truth。

---

## Lifecycle Design

| Lifecycle Node | Owner | Desired Behavior After Refactor | GitNexus Role | CRG Role |
| --- | --- | --- | --- | --- |
| package install | npm package / user | 安装 spec-first CLI 与 source assets，不安装 provider index | none | none |
| `spec-first init` | `src/cli/commands/init.js` | 生成 host entrypoints、skills、agents、instruction blocks、developer profile、managed state；提示 lightweight fast path + enhanced readiness | optional instruction boundary only | no direct action |
| `spec-first doctor` | `src/cli/commands/doctor.js` | 检查 generated runtime drift、developer profile、entrypoints；不判定 provider query readiness | 不因缺失 GitNexus optional readiness 报 core error | 不判定 CRG query readiness |
| `$spec-mcp-setup` | `skills/spec-mcp-setup/*` | 安装/验证 required MCP/helpers，写 setup-owned provider projection 和 readiness ledger | optional enhancement projection；host MCP 不 gate baseline | core provider projection；CLI/backend readiness gate |
| `$spec-graph-bootstrap` | `skills/spec-graph-bootstrap/*` | 执行 validated provider commands，写 canonical graph/provider/impact artifacts | 可运行 bootstrap/query proof；失败为 optional degradation | 核心 readiness；失败影响 impact/review support |
| `$spec-standards` | `skills/spec-standards/*` | 消费 graph readiness 与 fallback facts 编译 standards/glue | optional repo knowledge hint | primary impact/review context hint |
| plan/work/debug/review | public workflows | 读取 canonical artifacts + bounded source evidence；不 rebuild provider | optional pointer / global knowledge | primary impact/review evidence |
| clean/update | `clean` / `update` workflows | 清理或刷新 generated runtime；不删除 provider data，不改变 source truth | provider data 不归 clean 默认所有 | provider data 不归 clean 默认所有 |

---

## Key Technical Decisions

### D1. 保留 GitNexus，但从 required baseline 中移出

GitNexus 不适合继续作为 required host MCP。原因是 spec-first 的核心闭环需要 repo-local、可复验、review-oriented evidence；GitNexus 的主要价值是全局理解和知识增强。把它放在 required baseline 会让一个可选知识工具影响用户能否进入核心 workflow。

Consequence:

- `mcp-tools.json` 顶层 `required=true` 继续表示该 entry 由 setup registry 管理；新增 role/tier 字段表达 baseline-gating，避免 `required=false` 触发现有 install/verify fail-closed guard。
- `verify-tools.*` 和相关 tests 需要允许 optional provider degraded。
- supported tools docs 需要从 “Required Graph Providers” 改为 “Core Graph Provider + Optional Graph Enhancements”。
- GitNexus enhanced mode 必须有清晰路径：新项目默认不要求 host MCP；已有 host MCP config preserve；用户可显式启用/禁用 live MCP；setup/bootstrap 用 `optional_not_enabled`、`optional_enabled_existing`、`optional_enabled_explicit`、`optional_degraded` 等 reason_code 表达状态。

### D2. CRG 是 core graph provider，但 live MCP 仍 optional

CRG 的 core status 指的是 CLI/provider artifact path，不是 host MCP server。默认仍应保持 `host_config_required=false`、`provider_config.access_mode="cli_artifact"`、`optional_live_mcp=true`。

Consequence:

- setup 应 warm CRG package 并写 provider commands。
- graph-bootstrap 执行 CRG build/status/query-proof。
- downstream consumer 通过 canonical artifacts 消费 CRG readiness，而不是要求 host live CRG MCP。
- 在 U1/U3 进入大范围 workflow/docs 改造前，必须先用代表性场景验证 CRG 是否能产出 `impact_radius`、`review_context`、`related_tests` 和 `minimal_context`；若不能稳定覆盖，回退为 capability-first 或双 provider advisory 路径。

### D3. Canonical artifacts 继续是唯一下游真相源

无论 GitNexus 或 CRG 是 live MCP、CLI、normalized artifact 还是 raw log，plan/work/debug/review 都不能直接耦合 provider 私有输出。它们只能读取：

- `.spec-first/graph/provider-status.json`
- `.spec-first/graph/graph-facts.json`
- `.spec-first/impact/bootstrap-impact-capabilities.json`
- `.spec-first/providers/<provider>/status.json`
- `providers[].normalized_artifacts` 指针

Provider 输出进入 LLM 上下文前必须满足：

- 作为 untrusted quoted evidence 渲染，明确不能携带可执行指令、role change、schema mutation、tool request 或 scope mutation。
- 带 source path、line/symbol anchor、provenance、readiness/tier、reason_code 和 excerpt cap。
- credential-like values、env var values、tokens、absolute secret paths 和 provider-private diagnostics 必须脱敏或只以 raw log path/hash 呈现。
- Final report 不粘贴 raw logs；只引用路径、hash、reason_code 和必要 bounded excerpt。

### D4. Provider selection 是 intent-aware，不是 provider-first

`review-pre-facts` 不应先找 GitNexus。它应先判断 workflow intent 和所需 capability：

- `code-review`、changed files、impact、related tests、review context -> CRG。
- architecture docs、reuse decisions、global code understanding -> GitNexus if fresh and enabled; if live MCP is not session-local available, consume normalized canonical artifacts or bounded direct reads instead of emitting an unexecutable live query plan。
- no targets、stale graph、provider unavailable -> bounded direct reads。

### D5. Backward compatibility 先保留，consumer 逐步迁移

为了降低迁移风险，第一阶段可保留 `ready_primary_providers[]` 等旧字段，但新增 role-aware 字段，并让 contract tests 防止新 consumer 继续依赖双主 provider 叙事。

Candidate role-aware fields:

- `core_required_providers[]`
- `ready_core_providers[]`
- `failed_core_providers[]`
- `optional_enhancements[]`
- `ready_optional_enhancements[]`
- `degraded_optional_enhancements[]`
- `provider_roles.<id>.required_tier`
- `provider_roles.<id>.capability_owner`

这些字段最终形状在实施时可按现有 schema 最小增量确定，但必须表达 required/optional 分层。

### Alternatives Considered

| Alternative | Why not now |
| --- | --- |
| Do nothing / minimal wording fix | 无法修复 `mcp-tools.json`、setup projection、bootstrap aggregate、review-pre-facts selection 的 machine-level drift。 |
| 立刻物理删除 GitNexus | 反转成本高，且会切断已有 architecture/global knowledge、reuse hints、parent-workspace routing 用户路径。 |
| 继续双 provider advisory | 能降低迁移风险，但仍保留 baseline/readiness 语义混乱，无法回答“哪个 provider 决定 impact/review 主路径”。 |
| Capability-first provider routing | 长期更 provider-replaceable，但当前已有 CRG artifact/impact/review 方向和 GitNexus global knowledge 分工；本计划先以轻量 role/tier contract 约束实现，避免引入完整 provider router。若 CRG falsification gate 未通过，回退到 capability-first。 |
| CRG named core + GitNexus optional | 当前推荐路径；前提是 U1/U3 前通过 CRG core evidence gate，并保持 role/tier contract 足够轻量。 |

---

## Implementation Units

### U0. 锁定 provider role 词汇与兼容策略

**Goal:** 先建立统一词汇，避免后续文件各自发明 required/optional 语义。

**Requirements:** R1-R5, R25, R28

**Files:**

- Modify: `docs/contracts/graph-evidence-policy.md`
- Modify: `docs/contracts/graph-provider-consumption.md`
- Modify: `docs/contracts/source-runtime-customization-boundary.md`
- Test: `tests/unit/graph-provider-consumption-contracts.test.js`
- Test: `tests/unit/repository-guidance-contracts.test.js`

**Approach:**

- 在 graph evidence policy 中定义 `core_required_provider`、`optional_enhancement_provider`、`fallback_capability`、`session-local evidence` 的边界。
- 明确 registry semantics：top-level `required=true` 表示 setup-managed registry entry；`required_tier` / `baseline_required` / `capability_owner` 表示 core/optional 与 baseline gate。
- 在 consumption contract 中新增 role-aware consumption rules，并标注旧 `ready_primary_providers[]` 兼容读法。
- 明确：CRG failure 是 core evidence degradation；GitNexus failure 是 optional enhancement degradation。
- 明确 capability-first fallback：如果 CRG core evidence gate 失败，consumer 按 capability support 而不是 provider name 降级。

**Test Scenarios:**

- Contract docs 明确 CRG core / GitNexus optional。
- Forbidden reads 仍禁止旧 graph paths 和 graph-facts top-level pseudo-fields。
- 新 contract 不把 optional GitNexus missing 描述成 workflow blocker。

**Verification:** `npm run test:jest -- tests/unit/graph-provider-consumption-contracts.test.js tests/unit/repository-guidance-contracts.test.js --runInBand`

### U1. 调整 runtime registry 与 setup 投影

**Goal:** 让 `mcp-setup` 的 machine registry 和 projection 真正表达 GitNexus optional，而不是只改文案。

**Requirements:** R10-R13

**Dependencies:** U0

**Files:**

- Modify: `skills/spec-mcp-setup/mcp-tools.json`
- Modify: `skills/spec-mcp-setup/SKILL.md`
- Modify: `skills/spec-mcp-setup/references/supported-mcp-tools.md`
- Modify: `skills/spec-mcp-setup/scripts/install-mcp.sh`
- Modify: `skills/spec-mcp-setup/scripts/install-mcp.ps1`
- Modify: `skills/spec-mcp-setup/scripts/verify-tools.sh`
- Modify: `skills/spec-mcp-setup/scripts/verify-tools.ps1`
- Modify: `skills/spec-mcp-setup/scripts/write-provider-config.sh`
- Modify: `skills/spec-mcp-setup/scripts/write-provider-config.ps1`
- Test: `tests/unit/mcp-setup.sh`
- Test: `tests/unit/mcp-setup-powershell-contracts.test.js`
- Test: `tests/unit/doctor-runtime-tools.test.js`

**Approach:**

- Extend registry semantics with a lightweight field such as `required_tier: "core" | "optional"` or `provider_required: "core" | "optional"`.
- Keep top-level `required=true` for all setup-managed entries in v1; do not set GitNexus top-level `required=false` unless the Bash/PowerShell non-required fail-closed guards and tests are intentionally redesigned in the same unit.
- Set CRG to core required provider.
- Set GitNexus to optional enhancement provider while keeping package/version/projection available.
- Update install/verify logic so optional provider warmup/config failure does not flip `baseline_ready=false`.
- Keep GitNexus commands in `graph-providers.json` when dependency/projection is available; absent GitNexus should be represented explicitly as optional degraded/skipped.
- Default GitNexus access mode: warm package and project bootstrap projection only; do not write new required host MCP config by default. Preserve existing GitNexus host config and expose explicit opt-in / opt-out guidance.
- Preserve repeated setup behavior: do not reset existing canonical readiness when payload is semantically unchanged.

**Test Scenarios:**

- Happy path: CRG ready + GitNexus ready -> `baseline_ready=true`, projection includes both roles.
- Edge: CRG ready + GitNexus missing -> `baseline_ready=true`, optional degradation row visible, graph bootstrap still prompted.
- Error: CRG dependency/projection missing -> `baseline_ready=false`; CRG graph/query/bootstrap readiness missing -> `baseline_ready=true` plus graph-bootstrap action-required.
- Edge: Existing GitNexus host config -> preserved and reported as optional existing enhancement, not silently removed or treated as core gate.
- Edge: New install with GitNexus package unavailable -> `baseline_ready=true` when CRG core is ready, with optional degraded/not-enabled row and explicit opt-in repair.
- Parity: Bash and PowerShell produce equivalent provider roles.
- Regression: setup still does not run `gitnexus analyze` or `code-review-graph build`.

**Verification:** `npm run test:mcp-setup`

### U2. 收敛 `init` / `doctor` / `clean` 的用户可见 lifecycle

**Goal:** 让安装初始化路径的提示与 provider role 新语义一致，避免用户以为 GitNexus 是核心必需。

**Requirements:** R6-R9, R25, R26

**Dependencies:** U0

**Files:**

- Modify: `src/cli/commands/init.js`
- Inspect/Modify-if-needed: `src/cli/commands/doctor.js`
- Inspect/Modify-if-needed: `src/cli/commands/clean.js`
- Modify: `src/cli/gitnexus-instruction-block.js`
- Modify: `src/cli/runtime-tools-index.js`
- Inspect/Modify-if-needed: `README.md`
- Inspect/Modify-if-needed: `README.zh-CN.md`
- Modify: `docs/05-用户手册/01-快速开始.md`
- Modify: `docs/05-用户手册/README.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Test: `tests/unit/no-graph-fast-path-contracts.test.js`
- Test: `tests/unit/gitnexus-instruction-block.test.js`
- Test: `tests/unit/runtime-tools-index.test.js`
- Test: `tests/unit/init-dry-run.test.js`
- Test: `tests/unit/clean-dry-run.test.js`
- Test: `tests/unit/repository-guidance-contracts.test.js`

**Approach:**

- Keep `init` source/runtime boundary unchanged: it generates runtime assets and instruction blocks only.
- Update next-step wording: lightweight work can start after host restart with bounded direct reads and already configured host tools; enhanced readiness uses setup/bootstrap; graph-heavy work needs current core graph readiness.
- Update GitNexus block wording to “optional global knowledge evidence”，remove impact/review primary implications.
- Keep `clean` from deleting `.gitnexus/` or `.code-review-graph/` by default; if docs mention provider cleanup, route it to explicit repair/bootstrap path.
- Confirm `doctor` remains runtime drift checker, not graph provider query checker.
- U2 may draft narrow README wording only when needed for lifecycle hints; final README/README.zh-CN ownership stays in U6.

**Test Scenarios:**

- `init --dry-run` still previews managed runtime writes only.
- `init` next steps mention no-graph fast path and enhanced readiness without GitNexus-as-gate.
- GitNexus host block mentions optional enhancement and canonical readiness checks.
- `clean` removes managed runtime blocks but preserves provider data and custom assets.

**Verification:** `npm run test:jest -- tests/unit/no-graph-fast-path-contracts.test.js tests/unit/gitnexus-instruction-block.test.js tests/unit/init-dry-run.test.js tests/unit/clean-dry-run.test.js --runInBand`

### U3. 重构 graph-bootstrap readiness 与降级语义

**Goal:** 让 `spec-graph-bootstrap` 在 GitNexus 不可用时仍能完成 CRG 核心 readiness，并在 CRG 不可用时正确降级 impact/review 主路径。

**Requirements:** R14-R19

**Dependencies:** U1

**Files:**

- Modify: `skills/spec-graph-bootstrap/SKILL.md`
- Modify: `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`
- Modify: `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`
- Modify: `skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.sh`
- Modify: `skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.ps1`
- Test: `tests/unit/spec-graph-bootstrap.sh`
- Test: `tests/unit/mcp-setup-powershell-contracts.test.js`

**Approach:**

- Before changing downstream workflow prose, add a CRG core evidence gate that exercises representative code-review, plan/work/debug, and review-pre-facts scenarios for `impact_radius`, `review_context`, `related_tests`, and `minimal_context`. If it fails, stop before U5/U6 and revise the plan toward capability-first fallback.
- During provider aggregation, classify provider statuses by role/tier before computing workflow mode.
- Compute core graph readiness from CRG + fallback capabilities.
- Compute optional enhancement readiness from GitNexus independently.
- Add role-aware aggregate fields while preserving legacy mirrors for compatibility.
- Validate provider commands from setup projection against source-owned registry facts: provider id allowlist, executable/package/subcommand shape, schema version, package version/pin, projection fingerprint/hash, and repo snapshot. Unknown provider, hand-edited `.spec-first/config/graph-providers.json`, stale projection, or unsupported command shape must fail closed before execution with reason_code.
- Make `bootstrap-impact-capabilities.json` use:
  - `impact_radius.full` only when CRG query-ready.
  - `review_support.partial/full` only from CRG or fallback, never from GitNexus alone.
  - `context_selection` may include GitNexus when fresh, but should distinguish global knowledge from impact context.
- Parent workspace summaries should report optional GitNexus degraded separately from core child repo readiness.

**Test Scenarios:**

- CRG ready + GitNexus ready -> core ready + optional ready.
- CRG ready + GitNexus missing/degraded -> core ready; optional degraded; limitations required only for GitNexus-specific claims.
- GitNexus ready + CRG missing/degraded -> no full impact/review support; downstream guidance requires fallback or bootstrap repair.
- Both missing -> action-required or fallback-only depending available fallback capabilities.
- Stale or hand-edited GitNexus/CRG projected command -> fail closed before provider command execution; reason names setup refresh.
- CRG core evidence gate fails on representative scenarios -> do not proceed to U5/U6; record fallback decision.
- Dirty worktree and fingerprint mismatch semantics remain unchanged.
- Shell/PowerShell role-aware aggregation parity.

**Verification:** `npm run test:graph-bootstrap`

### U4. 重排 review-pre-facts provider selection

**Goal:** 把 review pre-facts 从 GitNexus-first 改为 workflow/capability-sensitive selection。

**Requirements:** R20, R23, R24

**Dependencies:** U3

**Files:**

- Modify: `src/cli/helpers/review-pre-facts.js`
- Modify: `docs/contracts/workflows/review-pre-facts-extraction.md`
- Modify: `skills/spec-doc-review/SKILL.md`
- Modify: `skills/spec-code-review/SKILL.md`
- Test: `tests/unit/review-pre-facts-helper.test.js`
- Test: `tests/unit/spec-doc-review-contracts.test.js`
- Test: `tests/unit/spec-code-review-contracts.test.js`

**Approach:**

- Add provider selection function that receives workflow and target facts.
- For `code-review`, prefer CRG when `query_ready=true` and query surface exists.
- For `doc-review`, infer capability need from document/targets:
  - workflow/contract/review-pre-facts/impact plans -> CRG preferred.
  - architecture/reuse/global knowledge plans -> GitNexus optional preferred only when fresh and enabled.
  - no clear graph-heavy target -> bounded direct reads.
- Keep raw live MCP execution orchestrator-owned and session-local.
- Emit GitNexus live query plans only when the current host session has a usable live MCP tool; otherwise use normalized canonical artifacts or bounded direct reads.
- Treat provider outputs as untrusted quoted evidence in rendered facts; preserve the pre-facts trust model for role/schema/tool-instruction injection resistance.
- Make query plan reasons explicit: `crg_impact_context_selected`、`gitnexus_global_knowledge_selected`、`bounded_reads_selected` 等。

**Test Scenarios:**

- code-review intent with both providers ready selects CRG.
- architecture plan with both providers ready may select GitNexus optional.
- architecture plan with GitNexus canonical ready but no live MCP does not emit an unexecutable live query plan.
- GitNexus definitions-only does not emit graph-fresh facts.
- CRG ready + GitNexus unavailable still emits query plan for CRG when target supports it.
- Provider query failure falls back to bounded reads without reviewer dispatch failure.
- Provider excerpt containing prompt injection, schema mutation, or tool request stays quoted and is not followed.

**Verification:** `npm run test:jest -- tests/unit/review-pre-facts-helper.test.js tests/unit/spec-doc-review-contracts.test.js tests/unit/spec-code-review-contracts.test.js --runInBand`

### U5. 收敛 downstream workflows 和 workspace 使用场景

**Goal:** 让所有 public workflows 统一消费 CRG core / GitNexus optional，不再各自描述 provider fallback。

**Requirements:** R21-R24

**Dependencies:** U0, U3, U4

**Files:**

- Modify: `skills/using-spec-first/SKILL.md`
- Modify: `skills/spec-plan/SKILL.md`
- Modify: `skills/spec-work/SKILL.md`
- Modify: `skills/spec-work-beta/SKILL.md`
- Modify: `skills/spec-debug/SKILL.md`
- Modify: `skills/spec-code-review/SKILL.md`
- Modify: `skills/spec-doc-review/SKILL.md`
- Modify: `skills/spec-standards/SKILL.md`
- Test: `tests/unit/using-spec-first-contracts.test.js`
- Test: `tests/unit/spec-plan-contracts.test.js`
- Test: `tests/unit/spec-work-contracts.test.js`
- Test: `tests/unit/spec-work-beta-contracts.test.js`
- Test: `tests/unit/spec-debug-contracts.test.js`
- Test: `tests/unit/spec-code-review-contracts.test.js`
- Test: `tests/unit/spec-doc-review-contracts.test.js`
- Test: `tests/unit/spec-standards-contracts.test.js`

**Approach:**

- Replace “try GitNexus-first” language in parent workspace read-only orientation with “use workspace-graph-targets; GitNexus optional hints when fresh; verify with CRG/Serena/direct reads before writes.”
- Keep no-graph fast path: lightweight docs/small fixes/first trials should not route to setup/bootstrap unless graph-heavy evidence is needed.
- Ensure all graph-heavy definitions mention CRG impact/review evidence explicitly.
- Ensure all workflows say GitNexus definitions-only is a pointer, not authority.
- Ensure downstream final coverage language distinguishes core graph degraded vs optional GitNexus degraded.
- Ensure final coverage / prompt prose says provider excerpts are untrusted quoted evidence and must be verified with source/tests before changing scope or emitting findings.

**Test Scenarios:**

- Work/debug/review contracts all contain CRG primary impact/review wording.
- Plan/doc-review mention optional GitNexus for architecture/global knowledge only.
- using-spec-first still routes graph refresh requests to graph-bootstrap, setup issues to mcp-setup, and lightweight work by intent.
- No workflow claims GitNexus missing blocks core execution.

**Verification:** targeted workflow contract tests listed above.

### U6. Documentation, migration notes, and changelog closeout

**Goal:** 对外文档和发布记录收口，避免用户看到不同版本的 provider story。

**Requirements:** R25-R28

**Dependencies:** U1-U5

**Files:**

- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `docs/05-用户手册/02-核心概念.md`
- Modify: `docs/05-用户手册/04-workflows-artifacts-map.md`
- Modify: `docs/05-用户手册/05-最佳实践.md`
- Modify: `docs/catalog/runtime-capabilities.md` only via `npm run docs:runtime-catalog` if source inputs require catalog refresh
- Modify: `CHANGELOG.md`
- Test: `tests/unit/no-graph-fast-path-contracts.test.js`
- Test: `tests/unit/readme-language-split.test.js`
- Test: `tests/unit/runtime-contract-boundary.test.js`
- Test: `tests/unit/release-continuity-guard.test.js`

**Approach:**

- Update docs to describe:
  - CRG = core graph evidence for impact/review.
  - GitNexus = optional global knowledge enhancement.
  - setup prepares runtime; bootstrap compiles readiness; consumers read artifacts.
  - lightweight no-graph work remains valid.
- Add migration note for existing projects:
  - rerun `spec-first init --claude|--codex` only when refreshing host instruction/runtime mirrors.
  - run `$spec-mcp-setup` after upgrading to regenerate provider projection.
  - run `$spec-graph-bootstrap` to refresh canonical role-aware readiness.
  - existing GitNexus users can keep enhanced mode; optional means not baseline-blocking, not deprecated.
- Add changelog entry with `(user-visible)`.
- `docs/catalog/runtime-capabilities.md` is generated by `scripts/generate-runtime-capability-catalog.js`; do not hand patch it. If U5/U6 source inputs affect the catalog, regenerate with `npm run docs:runtime-catalog` and verify the diff.

**Verification:** docs/readme contract tests and changelog presence.

---

## Migration Strategy

1. **Phase 1 stop/go gate:** update provider role vocabulary, registry/projection semantics, and graph-bootstrap role-aware artifacts only. Do not change downstream workflow prose broadly until CRG core evidence and GitNexus optional compatibility gates pass.
2. **Setup projection second:** make machine facts role-aware before changing bootstrap consumers; preserve top-level registry-managed `required=true` unless U1 intentionally redesigns install/verify guards.
3. **Bootstrap semantics third:** write role-aware canonical readiness and compatibility mirrors, with command-source validation before provider execution.
4. **CRG core evidence gate:** run representative code-review, plan/work/debug, review-pre-facts, and related-tests scenarios. If CRG cannot support the core claims, stop and revise toward capability-first or dual advisory provider consumption.
5. **Consumer selection fourth:** migrate review-pre-facts and workflows to role-aware consumption only after the stop/go gate passes.
6. **Docs/runtime guidance last:** update README, host instruction blocks, quickstart, changelog, and any generated runtime catalog via its source generator.
7. **Runtime regeneration after source validation:** only then run `spec-first init --claude|--codex` if release or local runtime refresh requires it.

Backward compatibility rule:

- Existing artifacts without role-aware fields are consumed as legacy/stale/advisory.
- New bootstrap artifacts should include role-aware fields.
- New downstream code should read role-aware fields first and fall back to old fields only with explicit `legacy` reason code.
- Existing GitNexus users:
  - Existing host MCP config is preserved unless the user explicitly disables it.
  - New default setup does not require GitNexus live MCP for `baseline_ready`.
  - GitNexus status should surface as `optional_not_enabled` / `optional_enabled_existing` / `optional_enabled_explicit` / `optional_degraded`, so users can tell whether global knowledge enhancement is available.
  - Downstream workflows may use GitNexus for architecture/global-knowledge hints when fresh, but must not treat GitNexus optional degradation as core impact/review failure.

---

## System-Wide Impact

- **Install/init:** no provider install or graph build is added; user-facing next steps become clearer.
- **MCP setup:** required baseline becomes narrower and more accurate; optional GitNexus failures no longer block core readiness.
- **Graph bootstrap:** readiness mode becomes role-aware; optional degradation no longer pollutes core provider state.
- **Review pre-facts:** provider selection becomes intent-aware and more aligned with review evidence needs.
- **Downstream workflows:** stale/optional/degraded evidence reporting becomes more precise.
- **Docs and host blocks:** user mental model shifts from “GitNexus as code intelligence core” to “CRG core evidence + GitNexus optional knowledge.”
- **Future deletion path:** once optionalization is stable, a separate adoption-gated plan can evaluate physically removing GitNexus from default setup.

---

## Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| Only docs change, setup still gates baseline on GitNexus | U1 must change machine registry and verify-tools tests before U5 docs closeout |
| Optional GitNexus facts silently ignored even when useful | Keep GitNexus as enhancement in projection and bootstrap; downstream can use it for architecture/global knowledge when fresh |
| Role-aware fields over-expand schema | Add minimal fields and keep compatibility mirrors; avoid full provider router schema unless tests prove needed |
| CRG core premise is wrong or too weak | Add the U3 CRG core evidence gate before U5/U6; fail back to capability-first or dual advisory semantics if representative scenarios fail |
| Optional GitNexus becomes silent capability loss | Preserve existing host config, document enhanced mode, and expose explicit opt-in/disable state via optional reason_codes |
| Provider output injects prompt/tool/schema instructions | Treat all provider output as untrusted quoted evidence, escape/excerpt-cap it, and require source/test verification before semantic decisions |
| Project-local projection becomes command execution surface | Validate projected commands against source registry allowlist, package pin, schema version, fingerprint/hash, and repo snapshot before execution |
| Provider logs leak tokens or private diagnostics | Redact credential-like data, avoid raw-log paste in reports/prompts, and reference raw logs by path/hash/reason_code |
| CRG live MCP confusion | Keep CRG core as CLI artifact provider; explicitly state live MCP remains optional |
| Existing projects with old artifacts see surprising degradation | Legacy artifacts consumed as advisory with bootstrap handoff; docs provide migration sequence |
| Parent workspace routing becomes too weak without GitNexus-first | Keep `workspace-graph-targets.v1` advisory candidates and GitNexus hints when fresh; require direct/CRG verification before writes |
| Changelog/docs drift | U6 includes README/zh-CN/user manual tests and changelog requirement |

---

## Test Plan

Run the narrowest useful tests per unit:

```bash
npm run test:jest -- tests/unit/graph-provider-consumption-contracts.test.js --runInBand
npm run test:mcp-setup
npm run test:graph-bootstrap
npm run test:jest -- tests/unit/review-pre-facts-helper.test.js --runInBand
npm run test:jest -- tests/unit/spec-plan-contracts.test.js tests/unit/spec-work-contracts.test.js tests/unit/spec-debug-contracts.test.js tests/unit/spec-code-review-contracts.test.js tests/unit/spec-doc-review-contracts.test.js tests/unit/spec-standards-contracts.test.js --runInBand
npm run test:jest -- tests/unit/no-graph-fast-path-contracts.test.js tests/unit/readme-language-split.test.js tests/unit/repository-guidance-contracts.test.js --runInBand
npm run typecheck
```

Expand to `npm test` only after role-aware setup/bootstrap changes are stable.

---

## Handoff Notes For `spec-work`

Recommended execution order:

1. U0 -> U1, because all later code depends on provider role vocabulary and setup projection.
2. U3 up to the CRG core evidence gate, because canonical artifacts are downstream truth and the premise must be falsifiable before broad prose changes.
3. If the gate passes, continue U3 role-aware aggregation, then U4 -> U5 because review-pre-facts and workflows consume the canonical shape.
4. U2 can start after U0/U1 for narrow lifecycle/source wording, but `doctor.js` / `clean.js` / README changes are inspect-or-finalize only when needed.
5. U6 may draft after U0/U1, but final README/user-manual/catalog/changelog closeout must happen after U3-U5 and any generated catalog refresh.

Before implementation, inspect current tests for assumptions that all tools in `mcp-tools.json` have `required=true`; preserve top-level `required=true` as registry-managed unless U1 explicitly redesigns install/verify guards. Replace baseline-gating assertions with role-aware assertions rather than broadly deleting tests.

Do not hand patch `docs/catalog/runtime-capabilities.md`; if source inputs require a catalog update, run `npm run docs:runtime-catalog` and review the generated diff.

Do not hand-edit generated runtime mirrors. If host guidance needs refresh after source validation, run:

```bash
spec-first init --codex
spec-first init --claude
```

only as a runtime regeneration step and record it separately.

---

## Sources & References

- `docs/00-版本路线/版本规划.md`
- `docs/10-prompt/结构化项目角色契约.md`
- `docs/contracts/graph-evidence-policy.md`
- `docs/contracts/graph-provider-consumption.md`
- `docs/contracts/source-runtime-customization-boundary.md`
- `docs/contracts/workflows/review-pre-facts-extraction.md`
- `docs/plans/2026-05-07-002-feat-gitnexus-evidence-governance-plan.md`
- `docs/plans/2026-05-12-002-feat-gitnexus-refresh-trigger-policy-plan.md`
- `docs/plans/2026-05-07-003-feat-code-review-graph-evidence-preflight-plan.md`
- `skills/spec-mcp-setup/SKILL.md`
- `skills/spec-mcp-setup/mcp-tools.json`
- `skills/spec-mcp-setup/references/supported-mcp-tools.md`
- `skills/spec-graph-bootstrap/SKILL.md`
- `src/cli/commands/init.js`
- `src/cli/gitnexus-instruction-block.js`
- `src/cli/helpers/review-pre-facts.js`
