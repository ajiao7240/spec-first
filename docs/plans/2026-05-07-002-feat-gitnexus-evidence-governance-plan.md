---
title: feat: 收紧 GitNexus 证据层与全流程图谱治理
type: feat
status: completed
date: 2026-05-07
spec_id: 2026-05-07-002-gitnexus-evidence-governance
last_updated: 2026-05-14T00:45+08:00
---

# feat: 收紧 GitNexus 证据层与全流程图谱治理

## 概览

把 GitNexus 作为贯穿 `Codebase → Graph → Spec → Plan → Tasks → Code → Review → Knowledge` 的外部证据层来治理，而不是做单点命令修补。

核心问题不是"`gitnexus analyze` 会改写 `AGENTS.md`/`CLAUDE.md`"这一个症状，而是**图谱层向 host source 注入 prose 这一类"上下文投入产物"在 spec-first 中没有 ownership 模型**：

- 当前 `<!-- gitnexus:start -->` block 由 GitNexus CLI 写入，`src/cli/runtime-tools-index.js:70` 仅以"非 spec-first 管理但需保留"的方式识别。它既不是 spec-first managed slice，也不是 generated runtime mirror，落在 source/runtime 边界之外，违反角色契约 §6。
- 图谱证据规则（freshness、definitions-only、live MCP、fallback）当前散落在 5 个 SKILL.md 中，且 `spec-plan` 已实现而其他 4 个 workflow 仅停留在 prose 层，是典型的多真相源（角色契约 §8 反模式）。
- bootstrap argv allowlist、host prose、downstream skill prose 之间没有派生关系，每改一处都要在多文件同步漂移。

正确的解法是把图谱证据策略做成 **single source of truth (policy)**，让 host prose / skill prose / provider argv 都成为 policy 的派生件，并显式定义 GitNexus host block 的 ownership 模型。这样每个 unit 都不再是"加一段措辞"，而是"实现 policy 第 X 条"。

## 目标

- 建立 `docs/contracts/graph-evidence-policy.md` 作为图谱证据的 single source of truth。
- 明确 GitNexus host instruction block 的 ownership 模型，让 `spec-first init` 可重建，GitNexus 升级不会反向覆盖。
- 防止 provider bootstrap 反向写入已纳入版本控制的 host source 文档（preview-first / source-first）。
- 把 `spec-plan` 已有的 freshness 比较逻辑（`source_revision` / `worktree_dirty`）抽到 policy 集中，再让 `spec-work`、`spec-debug`、`spec-code-review`、`spec-work-beta` 显式调用同一规则。
- 保留 GitNexus-first 的代码理解优势，同时支持 `stale` / `degraded-fallback` / `definitions-only` / `session-local` 的明确降级与合并语义。
- 让 `gitnexus_detect_changes()` 成为 review evidence，而不是无法解释的自动阻断器。
- 保持 Claude / Codex 双宿主 parity；保持多仓 workspace 的 child repo ownership。

## 非目标

### 产品边界

- 不重写 GitNexus 或 fork provider。
- 不恢复 retired internal CRG runtime。
- 不把 GitNexus group mode 纳入默认核心路径。
- 不直接编辑 `.claude/`、`.codex/`、`.agents/skills/` 等 generated runtime mirrors。

### 角色分工

- 不让 scripts 做业务语义判断或语义范围选择。
- 不让 LLM 假装执行确定性校验、伪造命令结果。
- 不把 advisory facts 当 confirmed truth。
- 不把 graph facts 做成第二份 plan 或中心化 workflow state。

## 图谱就绪状态

按 `spec-plan` 已有 status enum (`primary | degraded-fallback | stale | blocked | setup-not-ready | unavailable`) 表述：

- target_repo: `spec-first`
- status: `stale`
- reason: dirty worktree fingerprint 与 compiled graph facts 不一致
- source_revision: `052c94ba77ef4a5a5de9f98f2fb065a1e11e4c5d`
- current_revision: `052c94ba77ef4a5a5de9f98f2fb065a1e11e4c5d`
- primary_providers: `gitnexus`, `code-review-graph`
- runtime_mcp_evidence: `session-local-available`（live GitNexus MCP 可用，但仅作 session-local 证据，不更新 compiled `query_ready`）
- fallback_capabilities: `serena`, `ast-grep`, bounded direct repo reads
- confidence: medium
- limitations: 实施阶段在编辑 shared symbol 前必须重新运行聚焦 impact analysis；提交前必须运行 final change detection；本计划自身的 plan-phase 评估接受 `stale` 证据。

## 前置 spike

### SP1. GitNexus pinned package 行为验证

`docs/plans/.../execution-log` 必须先记录以下命令的实际输出，再进入 D1 路径选择。当前 source-of-truth pin 为 `gitnexus@1.6.5` official stable（spec-first `v1.8.2`，从 `1.6.4` 升级 stable 的决策已记录在 `CHANGELOG.md` 和本文执行日志）：

```bash
npx -y gitnexus@1.6.5 analyze --help
npx -y gitnexus@1.6.5 --version
```

观察项：

- 是否存在 `--skip-agents-md` 或等效 flag（`--no-agents-md`、`--skip-host-instructions`、env var 等）。
- 是否提供"分析后不写入 host instruction"的任何 deterministic 路径。
- 如需审计 RC 通道风险，可把 npm `dist-tags.rc` 指向的 RC 版本作为历史对照 spike；它不再是当前 plan 的 source-of-truth pin。

SP1 的输出已经驱动过 D1 路径选择：截至 2026-05-13，当前执行口径是 **路径 C 稳定化**，并保留 GitNexus stable pin 作为 provider version governance 与未来路径 A 迁移的能力证据。后续实施不得再把 `--skip-agents-md` 投影当作当前 U2/U3 的默认待办，除非显式重开 D1 并把 managed marker migration 作为新的实施范围。

## 需求追踪

- **R1**. `docs/contracts/graph-evidence-policy.md` 是图谱证据的 single source of truth；`readiness_status` 与 `spec-plan` 现有 status enum 完全一致，`evidence_class` 与 `scope_requirement` 必须作为独立字段治理，不得混入 readiness enum。
- **R2**. GitNexus host instruction block 必须有明确 ownership 模型（当前为 legacy marker + spec-first normalizer；future 可迁移到 spec-first managed slice），由 D1 决定。
- **R3**. Provider bootstrap 与 setup 不得反向写入已 commit 的 host source 文档；任何 host source 变更必须经由 spec-first source 与 generator 显式表达。
- **R4**. Setup 与 bootstrap 职责必须保持分离：setup 投影 facts，bootstrap 运行 provider commands。
- **R5**. `query_ready=true` 必须要求 analyze/build、status 和 query-surface proof 都通过。
- **R6**. Definitions-only GitNexus evidence 只能作为 pointer-level evidence，不能作为 process/query readiness。
- **R7**. Live MCP evidence 永远不得反写 compiled graph readiness；compiled stale + live MCP success 共存时按 D5 合并语义分别附加。
- **R8**. 下游 workflow 在把 graph facts 当 primary evidence 前，必须比较 `source_revision`、`worktree_dirty`，并在 policy 与 schema 升版后比较 `worktree_status_hash`；不一致时降级到 `stale`。
- **R9**. Parent workspace 的只读 routing 可以使用 `workspace-graph-targets.v1`；写入 workflow 仍必须有 explicit `target_repo`。
- **R10**. GitNexus HIGH/CRITICAL risk 必须通过解释和验证来处理；不允许盲目接受、忽略或自动阻断。
- **R11**. 任何 source 变更必须保持 Claude / Codex 双宿主 parity：argv allowlist、host prose、generated runtime expectations 在两宿主下行为一致。
- **R12**. 每个实施 unit 落地时必须按 `CLAUDE.md` 铁律同步追加 `CHANGELOG.md` 一条记录；PR 合并前可整合为最终条目。

## 关键决策

### D1. GitNexus host block 的 ownership 模型（核心架构决策）

SP1 结果已经完成首轮路径选择。当前 source 采用 **路径 C：legacy marker + spec-first normalizer 收敛**；`gitnexus@1.6.5` stable pin 是 provider 版本治理事实，不等同于当前必须迁移到路径 A。

| 路径 | 触发条件 | 实施要点 |
|---|---|---|
| **A. spec-first 接管 + provider 不写入** | Future migration：团队决定完全迁移到 spec-first managed marker，并愿意同步更新 init/clean/doctor/runtime-tools-index 双宿主测试 | 引入新 managed marker `<!-- spec-first:gitnexus-prose:start -->` / `:end -->`；由独立的 GitNexus/provider instruction renderer 渲染（例如 `src/cli/gitnexus-instruction-block.js` 或同等 source module），不得塞入 `src/cli/instruction-bootstrap.js` 的 workflow-entry bootstrap renderer；迁移时才把 GitNexus bootstrap argv 改为 `--skip-agents-md`，并补 managed-marker cleanup / drift tests。 |
| **B. provider version governance** | 当前落地：spec-first `v1.8.2` 把 source-of-truth pin 显式设为 `gitnexus@1.6.5` official stable | `mcp-tools.json` provider registry 是唯一 pin 来源；CHANGELOG 与 plan execution log 必须显式声明通道、理由、回归范围和生效 pin。该路径不再自动意味着继续走路径 A。 |
| **C. legacy marker + normalizer 收敛** | **当前选定路径**：保留 `<!-- gitnexus:start -->` 兼容 provider 写入，再由 spec-first `gitnexus-instruction` normalizer 收敛最终 source | GitNexus 可写入 legacy block；`spec-first init --claude|--codex` 与 `spec-graph-bootstrap` 末段把 block 覆写为 stable evidence contract；provider argv 保持 `analyze --force`；doctor drift detection 可作为后续增强，不阻塞当前路径 C。 |

无论选哪条路径，**block prose 内容**统一为 freshness-aware + scope-aware 软规则（见 D7），并指向 policy 文件。

### D2. policy 居中，所有派生件单向引用

`docs/contracts/graph-evidence-policy.md` 定义 vocabulary、consumption 规则、ownership 决策、drift triage、合并语义。`AGENTS.md` / `CLAUDE.md` GitNexus block、5 个 SKILL.md graph 段落、provider argv 配置都引用 policy；不在多处重复表述。

Provider instruction prose 与 workflow-entry bootstrap 分属不同 source boundary。`instruction-bootstrap.js` 继续只渲染 `<!-- spec-first:bootstrap:start -->` workflow 入口提醒；GitNexus block 接管必须通过独立 renderer、init writer hook 或 runtime-tools boundary 完成，避免把 provider evidence policy 混进入口治理模块。

### D3. 角色保持

`gitnexus` 保持 `global_knowledge`，`code-review-graph` 保持 `impact_context`。

### D4. 不默认启用 GitNexus group mode

多仓基础策略仍是 per-repo bounded fan-out + `workspace-graph-targets.v1` 只读 advisory。

### D5. compiled facts + live MCP + fallback 的合并语义

- compiled stale + live MCP success → 表述为 `stale-compiled + session-local-live`，下游 finding 必须分别附加两份证据来源，不得合并为单一 readiness label。
- live MCP definitions-only → 标记 `runtime_mcp_evidence: partial-definitions-only`，仅作 pointer。
- compiled primary + live MCP success → 仍以 compiled 为 primary，live 作 supplementary。
- compiled unavailable + live MCP success → 表述为 `compiled-unavailable + session-local-live`，下游可在 finding 中标注证据强度但不能写回 compiled readiness。

### D6. `worktree_status_hash` 是 schema 增量

R8 引入新字段，需在 graph readiness artifact schema 升版（`schema_version` bump）并通过 contract test 校验向后兼容；旧 artifact 缺该字段时降级到 `worktree_dirty` 比较，给 limitation。

### D7. host prose 软规则取代官方 hard-gate

GitNexus 官方 prose（"MUST run impact"、"NEVER edit a function..."）在 spec-first 仓库内替换为：

- production function/class/method/API/shared contract changes 需要 attempted impact analysis 并解释结果；
- docs-only / prose / changelog / fixture / test fixture 变更走 scoped review；
- stale / unavailable GitNexus 必须记录 fallback evidence；
- HIGH / CRITICAL risk 需要 explanation 和 verification，不自动停止；
- 每条规则都引用 policy。

### D8. 角色分工（重申，对齐角色契约 §4）

- 脚本输出 deterministic facts：readiness、reason_code、raw logs、artifact paths、argv shape、CHANGELOG 时间戳。
- LLM 输出 semantic judgment：target repo relevance、implementation scope、risk interpretation、fallback choice、prose drift triage。

## 实施单元

实施单元彼此引用同一份 policy，不在 SKILL.md / host prose / 测试中重复表述图谱证据规则。

### U1. 编写 graph evidence policy + ownership 模型

文件：

- `docs/contracts/graph-evidence-policy.md`（Create or extend；截至 2026-05-10 当前 source 已有初版文件，但仅覆盖基础证据等级、GitNexus 使用边界、provider 职责、冲突处理与 host block 口径，仍需补全本 U1 下列 contract 内容）
- `README.md`、`README.zh-CN.md`（添加 policy 引用，不复述）

内容：

- vocabulary 分层：
  - `readiness_status`：与 `spec-plan` 现有 status enum 完全一致，仅包含 `primary | degraded-fallback | stale | blocked | setup-not-ready | unavailable`。
  - `evidence_class`：描述证据来源与强度，例如 `confirmed | session-local | advisory | definitions-only | fallback`；`definitions-only` 和 `session-local` 不能作为 readiness status。
  - `scope_requirement`：描述写入/执行前的目标范围要求，例如 `target_repo-required | per-child-target-required | none`；`target_repo required` 不能作为 readiness status。
- consumption 规则：compiled facts vs live MCP vs fallback reads 的优先级、合并语义（D5）。
- ownership 模型：记录 D1 选定路径与触发条件；预留 drift triage 流程（GitNexus 升级带来 prose 漂移时的 diff/吸收/重写决策步骤）。
- schema 版本管理：`worktree_status_hash` 引入说明、向后兼容策略。
- provider 边界：明确 setup vs bootstrap、scripts vs LLM 的职责切分（对齐角色契约 §4）。
- 验证 hook：列出 policy 派生件清单（U2-U6 涉及的文件路径），便于 reviewer 检查派生关系。
- landed-state 标注：如果 policy 已存在但未覆盖上述字段，不得在 execution log 或 PR 中宣称 U1 完成；应标为 `partially landed`，并列出缺口（`readiness_status` / `evidence_class` / `scope_requirement` 分层、`worktree_status_hash`、README 引用、派生件清单、contract tests）。

测试：

- 现有 docs contracts / README contracts 中新增断言：policy 文件存在；README 引用 policy 路径；`readiness_status` 字段集合与 `spec-plan` SKILL.md 一致；`definitions-only`、`session-local`、`target_repo-required` 等 evidence/scope 词汇不得出现在 readiness enum 中。

CHANGELOG：U1 land 时追加一条记录。

### U2. 实施 D1 选定的 host block ownership

文件：

- `AGENTS.md`、`CLAUDE.md`（GitNexus block prose 重写为 D7 软规则；marker 由 D1 路径决定）
- Create or Modify: `src/cli/gitnexus-instruction-block.js`（或同等独立 provider prose renderer；当前路径 C 提供 stable block renderer / normalizer；future 路径 A 才渲染新 managed marker）
- `src/cli/runtime-tools-index.js`（识别规则随 D1 路径调整）
- `tests/unit/runtime-tools-index.test.js`、`tests/unit/clean-dry-run.test.js`（marker 识别 / cleanup 行为）
- Do not modify: `src/cli/instruction-bootstrap.js`，除非仅为调用独立 renderer 而增加明确边界注释；不得把 GitNexus prose body 写入该模块。

变更：

- 按当前 D1 路径 C：保留 GITNEXUS_START legacy marker，`src/cli/gitnexus-instruction-block.js` 或同等独立 renderer 负责 stable block 内容；`spec-first init --claude|--codex` 和 `spec-graph-bootstrap` 后置 normalizer 负责把 provider prose 收敛回 policy-linked contract。
- 路径 A managed marker migration 不在当前 U2 默认范围内；只有显式重开 D1 时，才引入 `<!-- spec-first:gitnexus-prose:start -->` / `:end -->` 并翻转 cleanup / runtime-tools-index 规则。
- 路径 B 只保留为 GitNexus RC pin 和通道治理事实，不再作为“必须继续走路径 A”的执行前提。
- 不论哪条路径，block prose 都引用 `docs/contracts/graph-evidence-policy.md`，不复述规则。
- 当前 source 已有 `init` / `graph-bootstrap` normalizer tests 时，不要重复创建同名 renderer；U2 应先核对现有 `src/cli/gitnexus-instruction-block.js` 与 `tests/unit/gitnexus-instruction-block.test.js`，再只补缺口（例如 doctor drift detection 或 README/policy 派生断言）。

测试：

- runtime-tools-index 双宿主 parity 断言（Claude/Codex 输出一致）。
- cleanup 不误删 spec-first managed marker；保留外部 GitNexus block 兼容路径。
- generator 重生成后 block 内容稳定（idempotent）。
- `instruction-bootstrap.js` 仍只包含 workflow-entry bootstrap 内容；contract test 防止 GitNexus prose body 落入该模块。

CHANGELOG：U2 land 时追加一条记录。

### U3. 收紧 provider bootstrap argv 与允许形态

文件：

- `skills/spec-mcp-setup/scripts/write-provider-config.sh`、`.ps1`
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`、`.ps1`
- `skills/spec-graph-bootstrap/SKILL.md`
- `skills/spec-mcp-setup/mcp-tools.json`（路径 B 已在 v1.8.0 landed pin；除非后续再次变更 pin，否则 U3 不应重复修改）

变更：

- 当前路径 C：argv 保持 `npx -y <gitnexus-package> analyze --force`；`bootstrap-providers.*` allowlist 继续只接受 `analyze` / `analyze --force` 的精确形态，不扩展 `--skip-agents-md`。host source 收敛由后置 `spec-first gitnexus-instruction normalize --write --quiet` 或等价 normalizer 负责。
- `--skip-agents-md` argv 投影与 allowlist 扩展只属于未来路径 A managed-marker migration；不得混入当前路径 C 的 U3 验收。
- 状态校准：v1.8.0 已完成 GitNexus RC pin 与 SP1 help/version/full-index 记录；`write-provider-config.*` 当前应继续投影 `analyze --force`，并通过 tests 断言 bootstrap 后 host block 被 normalizer 收敛。
- skill 文案统一引用 policy；解释 provider bootstrap 不得触碰 host source 的依据。

测试：

- `tests/unit/mcp-setup.sh`（probe candidate 选择仍然 bounded、source-derived）
- `tests/unit/spec-graph-bootstrap.sh`（当前路径 C：allowlist 继续拒绝 free-form / shell / string command，并断言 `analyze --force` 后执行 GitNexus host block normalizer；未来路径 A 才新增 `--skip-agents-md` fixture）
- `tests/unit/mcp-setup-powershell-contracts.test.js`（双宿主 parity）
- 新 fixture 场景：bootstrap 后 `AGENTS.md` / `CLAUDE.md` 的 legacy provider prose 被收敛为 stable evidence contract（路径 C）；如果未来切路径 A，再新增“provider 不写 host source”的 no-write fixture。

CHANGELOG：U3 land 时追加一条记录。

### U4. 把下游 workflow consumption 集中到 policy

文件：

- `skills/spec-plan/SKILL.md`（仅补 `worktree_status_hash` 字段与 policy 引用；现有 `source_revision` / `worktree_dirty` 比较保留）
- `skills/spec-work/SKILL.md`、`skills/spec-debug/SKILL.md`、`skills/spec-code-review/SKILL.md`、`skills/spec-work-beta/SKILL.md`（首次引入显式 freshness 比较步骤；引用 policy；按 D5 合并语义记录证据来源）

变更范围（按现状区分）：

- `spec-plan` 已实现 `source_revision` / `worktree_dirty` 比较（line 234），本 unit 仅补 `worktree_status_hash` 与 policy 引用，**不重做**。
- 其他 4 个 workflow 当前仅 prose 级别处理 `degraded` / `stale` / `unavailable`，未做显式字段比较；本 unit 在它们的 graph 段落中加入"读 graph readiness artifact → 比较 source_revision / worktree_dirty / worktree_status_hash → 按 policy `readiness_status` 标注 status"步骤。
- `runtime_mcp_evidence` 字段采用 `spec-plan` 已有命名，不发明新词。

测试：

- `tests/unit/spec-plan-contracts.test.js`、`tests/unit/spec-work-contracts.test.js`、`tests/unit/spec-debug-contracts.test.js`、`tests/unit/spec-work-beta-contracts.test.js`（如缺则新增）
- `tests/unit/spec-code-review-contracts.test.js`（已有则更新）
- 双宿主 parity：5 个 SKILL.md 通过 `spec-first init --claude|--codex` 写入两套 runtime mirror，验证两套行为一致。

CHANGELOG：U4 land 时追加一条记录。

### U5. 澄清 review 与 commit evidence semantics

文件：

- `skills/spec-code-review/SKILL.md`、`skills/spec-work/SKILL.md`
- `docs/contracts/graph-evidence-policy.md`（在 policy 内追加 detect_changes 段落）

变更：

- policy 定义 `gitnexus_detect_changes()` 预期用法：commit candidate 已 staged 时优先 staged scope；否则说明分析使用 all 或 uncommitted scope；HIGH/CRITICAL 结果通过 changed symbols/processes 与 task scope 解释；附 verification commands。
- 明确 detect_changes 是 evidence 不是 absolute gate；不覆盖 docs / changelog / fixture artifact。
- spec-code-review / spec-work 引用 policy，不复述规则。

测试：

- prose contract 断言：`detect_changes` 在两个 SKILL.md 中只出现"evidence not gate"的表述，不出现 absolute hard-gate 措辞。
- 历史 validation logs 不重写。

CHANGELOG：U5 land 时追加一条记录。

### U6. 强化 query probe golden cases + baseline 测量

文件：

- `skills/spec-graph-bootstrap/evals/*.json`
- `tests/unit/mcp-setup.sh`
- `tests/fixtures/`（如需）
- `docs/contracts/graph-evidence-policy.md`（追加 baseline 引用与基线快照路径）

变更：

- 在 U1 完成后，先采集 spec-first 自身仓库当前 candidate list + 一次 probe `result_class` 作为 baseline fixture。
- 增加场景：CLI repo（parse/validate methods）、Spring/Java controller-heavy、Android Activity/ViewModel、health-only、README-only / no-source、display-only frontend component。
- 验证 candidate selection 保持 bounded、source-derived；health/status/display-only token 不优先于 flow-bearing token。

测试：

- 现有 mcp-setup query probe candidate tests 保留并扩展。
- baseline fixture 与 golden case 对比，回归时差异要可解释。

CHANGELOG：U6 land 时追加一条记录。

### U7. 文档、changelog 集中化与 runtime regeneration 验证

文件：

- `README.md`、`README.zh-CN.md`（lifecycle 章节引用 policy）
- 相关用户手册文档
- `CHANGELOG.md`（合并 U1-U6 临时条目为最终条目，符合仓库格式）
- generated runtime expectations 通过 source templates 与 tests 验证

变更：

- 文档化更新后的 graph evidence lifecycle，引用 policy，不复述。
- 说明何时运行 `spec-mcp-setup`、`spec-graph-bootstrap` 与 downstream workflows。
- 不直接编辑 generated runtime mirrors；如需 regeneration，在 source validation 后用 `spec-first init --codex|--claude`，并验证两宿主输出 parity。

测试：

- `npm run lint:skill-entrypoints`
- README / dual-host governance tests（如存在则同步运行）
- 跑一次 `spec-first init` dry-run，确认 GitNexus block 在两宿主下输出一致。

CHANGELOG：U7 合并最终条目。

## 执行顺序

历史落地状态校准（2026-05-10，执行前快照）：

- SP1、路径 C renderer / normalizer、host block 收敛、`analyze --force` 后置 normalizer、RC.100 pin 已经历史落地，不能按“U1 未完成所以 U2/U3 不应存在”来回滚或重做。
- U1 policy 仍是 `partially landed`：`docs/contracts/graph-evidence-policy.md` 存在，但还缺 `readiness_status` / `evidence_class` / `scope_requirement` 分层、`worktree_status_hash` 说明、README 引用、派生件清单和 contract tests。
- 后续实施顺序是先关闭 U1 policy gap，再审计已落地 U2/U3 是否还有缺口；不是重新创建 renderer、重复 pin 或把 future 路径 A 的 `--skip-agents-md` 混回当前路径 C。

0. **SP1 spike**（历史硬门，pin 变更时重跑）：当前 RC.100 输出已记录；未来 GitNexus pin 变化必须重新跑 `analyze --help`、`--version` 和 forced analyze spike。
1. **U1 + D1 校准**（历史硬门）：policy gap closure；ownership 路径按当前路径 C 写入 policy，并把已落地 U2/U3 标为 policy 派生件。
2. **U2 audit / gap fill**：核对现有 host block ownership，补缺口（如 README/policy 派生断言或 doctor drift detection）；不得重复创建 renderer。
3. **U3 audit / gap fill**：确认 bootstrap argv 与 allowlist 仍是当前路径 C（继续 `analyze --force`，验证后置 normalizer；不引入 `--skip-agents-md`）。
4. **U4**：spec-plan 仅补字段；其他 4 个 workflow 引入显式比较步骤。
5. **U5**：review/commit evidence semantics 澄清。
6. **U6**：probe baseline + 6 类 golden cases。
7. **U7**：docs / changelog 合并 / runtime regeneration 验证。

上述顺序是执行前 handoff，不是 completed 状态下的当前 blocker。Completion closure 已将 remaining vocabulary cleanup、baseline fixture 和 runtime lifecycle 收敛为 follow-up 候选；若未来需要重开，必须新建 follow-up plan，而不是把本计划恢复为当前硬门。

## 验证计划

### 聚焦验证

```bash
npm run test:mcp-setup
npm run test:graph-bootstrap
npm run lint:skill-entrypoints
npm run typecheck
```

### 扩大验证

```bash
npm run test:unit
npm test
```

### Spike 验证

```bash
npx -y gitnexus@1.6.5 analyze --help
npx -y gitnexus@1.6.5 --version
```

如需审计 RC 通道风险，可对照 spike npm `dist-tags.rc` 指向的 RC 版本：

```bash
npm view gitnexus dist-tags --json
npx -y gitnexus@<rc-tag> analyze --help
```

输出抄录到 plan execution log；作为 D1 路径校准与 provider version governance 证据。**禁止静默升级或漂移 provider 通道**：当前 provider pin 以 `gitnexus@1.6.5` 为准，host block ownership 当前按路径 C 稳定化；任何未来 pin 变更都必须显式声明通道、理由、回归范围和生效 pin。

### 双宿主 parity 验证

- `spec-first init --claude` 与 `spec-first init --codex` 在 fixture 仓库下输出 GitNexus block 一致。
- `tests/unit/mcp-setup-powershell-contracts.test.js` 与 sh 等价测试同步通过。

### 图谱专项验证

- 编辑 shared JS functions 或 CLI behavior 前运行 GitNexus impact。
- 提交前运行 GitNexus change detection；HIGH/CRITICAL 必须按 D5/D7 解释。
- 记录是 expected broad contract impact 还是 unexpected blast radius。

### 运行时与 source 验证

- 不直接编辑 `.claude/`、`.codex/`、`.agents/skills/`。
- source 影响 generated runtime 时，tests 通过后通过 `spec-first init --codex|--claude` 重生成。

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 实施者误把 `--skip-agents-md` spike 当作当前 U3 默认待办 | U3 明确保持 `analyze --force` + 后置 normalizer；`--skip-agents-md` 仅在显式重开路径 A managed-marker migration 时进入范围，并需新增 no-write fixture。 |
| 路径 B 使用 RC 通道带来 SIGSEGV / FTS 等历史回归 | LOOP-045 (`8be33a5d`) 与 v1.6.0 (`2026-04-28`) 历史已记录 RC 通道 SIGSEGV；当前 `gitnexus@1.6.5` stable pin 已通过 package surface 与 query probe 验证，任何后续 pin 变更都必须附带 spec-first 自身仓库的回归 spike 输出，并把 pin 维护人显式写入 plan execution log。 |
| 静默版本通道反转再次发生（LOOP-045 → `852966b9` 那种 commit-level slip） | U3 升级 `mcp-tools.json` 的 contract test 必须断言"pin 修改的 commit 必须在 message 或同 PR 文档中显式说明通道（stable / rc）"；每个 unit 末尾 CHANGELOG 条目须列出生效 pin。 |
| GitNexus 升级反向覆盖 spec-first stable prose | 当前路径 C：provider 写入后由 `gitnexus-instruction normalize` 收敛；future 路径 A：managed marker + no-write fixture；policy 内 drift triage 流程明确升级时的 diff/吸收/重写步骤。 |
| 移除 hard-gate wording 弱化安全性 | 保留 symbol/API impact requirement（D7 第一条）；degraded fallback 显式记录；HIGH/CRITICAL 必须解释。 |
| 更多 workflow 报告 stale graph facts | 这是预期行为；policy 明确 stale → bounded direct reads + live MCP supplementary。 |
| 多文件重复 graph evidence 规则导致漂移 | policy 居中（D2）；派生件只引用不复述；U1 列出派生件清单便于 reviewer 巡检。 |
| 双宿主 parity 漂移 | R11 + 每个 unit 测试节列出 dual-host parity 验证；U7 用 `spec-first init` dry-run 收口。 |
| live MCP + stale compiled 合并语义混淆 | D5 集中定义合并规则；U4 在 SKILL.md 中引用 D5 而不是各自发明。 |
| CHANGELOG 节奏违反铁律 | R12 + 每个 unit 末尾 CHANGELOG 条目；U7 合并为最终条目，PR 阶段 reviewer 可校验完整性。 |
| GitNexus group mode 对多仓诱惑 | 延后到 follow-up；core path 保持 provider-neutral + per-repo bounded。 |
| `worktree_status_hash` schema 引入破坏旧 artifact 消费者 | D6 + schema_version 升版；旧 artifact 降级到 worktree_dirty 比较并附 limitation。 |

## 交接标准

以下交接标准是本计划执行前的历史 hard gate；本计划完成后不再作为当前 `$spec-work` blocker 使用。未来若重开 policy vocabulary cleanup、baseline fixture 或 runtime lifecycle 收敛，应迁移到新的 follow-up plan：

- SP1 spike 已执行，输出抄录到 plan execution log，D1 当前路径明确为路径 C；RC.100 pin 只作为 provider version governance 与未来路径 A 能力证据。
- U1 初版 policy 文件已存在时，实施者必须先核对是否已补齐 README 引用、`readiness_status` / `evidence_class` / `scope_requirement` 分层、`worktree_status_hash` 说明和派生件清单；未补齐则标记 U1 `partially landed`，不得把 policy 当作完成态。
- 实施目标确认为 `spec-first`。
- 现有 worktree 中无关变更已纳入 scope 或显式忽略。
- 实施者从已记录的 SP1 事实 → U1 gap closure → D1 路径 C 状态校准 → U2/U3 audit / gap fill 顺序进入，不先改孤立的 host prose，不把 future 路径 A 的 `--skip-agents-md` 混入当前路径 C。
- CHANGELOG 节奏已声明（每 unit 一条临时记录，PR 合并前合并）。
- 双宿主 parity 验证已纳入每个相关 unit。
- 最终 PR 包含：spike 输出、test output、GitNexus change-detection interpretation、generated runtime impact statement、CHANGELOG 终态条目。

## 执行日志

### 2026-05-24 — spec-first v1.8.2：GitNexus 1.6.5 official stable pin

执行人：leokuang。Maintainer of pin：leokuang。

**SP1 spike（macOS arm64, Node 22, npx）实测输出摘要**：

```text
$ npm view gitnexus version dist-tags --json
{
  "version": "1.6.5",
  "dist-tags": {
    "latest": "1.6.5",
    "rc": "1.6.6-rc.48"
  }
}

$ npx -y gitnexus@1.6.5 --version
1.6.5

$ npx -y gitnexus@1.6.5 analyze --help
Usage: gitnexus analyze [options] [path]
...
  --skip-agents-md                Skip updating the gitnexus section in
                                  AGENTS.md and CLAUDE.md
  --no-stats                      Omit volatile file/symbol counts from
                                  AGENTS.md and CLAUDE.md
...

$ npx -y gitnexus@1.6.5 query validateClaudeSettingsFile --repo spec-first
processes: RunInitForProject -> ValidateManifest, RunInitForProject -> ExistsSync,
RunInitForProject -> WalkAgentEntries, RunInitForProject -> NormalizeOperationPath,
RunInitForProject -> NormalizeDeveloper
definitions: src/cli/claude-settings.js, validateClaudeSettingsFile
```

- npm `latest` 已指向 `1.6.5`，`rc` 已进入 `1.6.6-rc.48`；本次继续使用 stable 通道，不采用 RC。
- `--version` 与 `analyze --help` 均通过；stable package 仍提供 `--skip-agents-md` 与 `--no-stats`，当前 provider command projection 不需要改变 argv shape。
- 代表性 query probe 返回 process results 和 definitions，证明当前 `.gitnexus` index 的 query surface 可被 `1.6.5` CLI 读取。
- 本次 source pin 更新到 `gitnexus@1.6.5`；随后通过 `MCP_SETUP_HOST=codex bash skills/spec-mcp-setup/scripts/install-mcp.sh --only sequential-thinking,context7,gitnexus` 写入 Codex host MCP 配置，通过 `verify-tools.sh` 刷新 setup projection，并通过 `bootstrap-providers.sh` 刷新 canonical graph readiness。
- 连续 / 并发 analyze 探针期间，本地 `.gitnexus` cache 曾出现 `libc++abi: terminating due to uncaught exception of type Napi::Error` 与 `lbug.wal` rename failure。该状态通过 provider 自带恢复命令 `npx -y gitnexus@1.6.5 clean --force` 清理本地 index 后重跑 bootstrap 恢复。
- 最终刷新结果为 `overall_status=ready-dirty-advisory`，GitNexus provider `status=ready`、`graph_ready=true`、`query_ready=true`，bootstrap/status/query commands 均使用 `gitnexus@1.6.5`；由于当前 worktree 存在 graph-affecting dirty paths，freshness 降级为 `dirty-advisory`。

### 2026-05-13 — Completion closure

执行人：leokuang。

完成状态：本计划按当前 source 状态标记为 `completed`。核心治理能力已经落地并由后续 contract tests 覆盖，包括 GitNexus host block normalizer、路径 C legacy marker + normalizer 收敛、`analyze --force` 后置 normalizer、`worktree_status_hash` freshness 边界、downstream workflow graph consumption guardrails、`detect_changes` evidence-not-gate 语义、GitNexus official stable pin 治理，以及 probe candidate / definitions-only / stale graph 边界测试。

收口说明：后续实现已把部分消费细节拆到 `docs/contracts/graph-provider-consumption.md`，并把 workflow 运行时必要 guardrails 保留在各 `SKILL.md` 中。因此本文 U1 原始的三层词表和“派生件只引用不复述”表述不再作为未完成 blocker 继续推进；若未来需要重开，将以新的 follow-up plan 处理 policy vocabulary cleanup、baseline fixture 或 runtime lifecycle 收敛。

### 2026-05-13 — spec-first v1.8.2：GitNexus 1.6.4 official stable pin

执行人：leokuang。Maintainer of pin：leokuang。

**SP1 spike（macOS arm64, Node 22, npx）实测输出摘要**：

```
$ npm view gitnexus@1.6.4 version --json
"1.6.4"

$ npm view gitnexus dist-tags --json
{
  "latest": "1.6.4",
  "rc": "1.6.5-rc.19"
}

$ npx -y gitnexus@1.6.4 --version
1.6.4

$ npx -y gitnexus@1.6.4 analyze --help
Usage: gitnexus analyze [options] [path]
...
  --skip-agents-md                Skip updating the gitnexus section in
                                  AGENTS.md and CLAUDE.md
...

$ npx -y gitnexus@1.6.4 query renderGitNexusInstructionBlock --repo spec-first
definitions: src/cli/gitnexus-instruction-block.js, renderGitNexusInstructionBlock,
normalizeGitNexusInstructionBlock, tests/unit/gitnexus-instruction-block.test.js
```

- npm `latest` 已指向 `1.6.4`，`rc` 已进入 `1.6.5-rc.19`；当前 source 不再使用 RC 通道。
- `--version` 与 `analyze --help` 均通过；stable package 仍提供 `--skip-agents-md`，future 路径 A 能力证据未退化。
- 代表性 query probe 命中 GitNexus instruction block definitions，证明当前 `.gitnexus` index 的 query surface 可被 stable CLI 读取。
- 本次未运行 full `analyze --force`，因为任务目标是 provider pin 回归 stable，且已有 `.gitnexus` index 可支撑只读 query probe；Windows 现场行为仍以 GitNexus stable release 自身修复为准。
- 当前 GitNexus provider pin 锁定在 `gitnexus@1.6.4`；下一次 pin 变更必须重新跑 SP1 spike，把输出抄录到本日志，并在 CHANGELOG 显式声明通道、理由、生效 pin、回归范围。

### 2026-05-09 — GitNexus host block ownership 收敛（路径 C 稳定化）

执行人：leokuang。

- 已新增 `src/cli/gitnexus-instruction-block.js` 作为 GitNexus host instruction block 的独立 renderer / normalizer；`src/cli/instruction-bootstrap.js` 未承载 GitNexus prose，继续只拥有 workflow-entry bootstrap。
- 已新增 `docs/contracts/graph-evidence-policy.md` 作为图谱证据消费规则 source of truth；host block 只保留轻量提醒并指向该 policy。
- `spec-first init --claude|--codex` 在保留既有 `<!-- gitnexus:start -->` block 时，会把 provider 写入的 legacy prose 收敛为稳定 spec-first evidence contract。
- `spec-graph-bootstrap` 在 GitNexus `analyze --force` 后调用 `spec-first gitnexus-instruction normalize --write --quiet`，允许 provider 刷新 block，但最终写入稳定版本。
- 稳定 block 移除 symbols / relationships / execution flows 动态计数、硬性 `MUST` / `NEVER` provider 规则和 `.claude/skills/gitnexus/*` host-specific runtime path；改为 freshness-aware / query-ready evidence contract。
- 本次未切换到 `--skip-agents-md` 路径 A；仍保留 `<!-- gitnexus:start -->` legacy marker 兼容外部 provider 写入，再由 spec-first 收敛最终 source。
- 后续如继续推进完全 managed marker，可在此基础上把 legacy marker 迁移到 `<!-- spec-first:gitnexus-prose:start -->`，并补 doctor drift detection。

### 2026-05-08 — spec-first v1.8.0：RC 通道反转生效（路径 B 落地）

执行人：leokuang。Maintainer of pin：leokuang。

**SP1 spike（macOS arm64, Node 22, npx）实测输出**：

```
$ npx -y gitnexus@1.6.4-rc.85 --version
1.6.4-rc.85

$ npx -y gitnexus@1.6.4-rc.85 analyze --help
Usage: gitnexus analyze [options] [path]

Index a repository (full analysis)

Options:
  -f, --force                     Force full re-index even if up to date
  --embeddings [limit]            Enable embedding generation for semantic
                                  search (off by default). ...
  --skip-agents-md                Skip updating the gitnexus section in
                                  AGENTS.md and CLAUDE.md
  ...
```

- `--version` 与 `analyze --help` 均无 SIGSEGV、无 FTS 报错；与 LOOP-045 / v1.6.0 历史 RC.21 SIGSEGV 现象不同。
- `--skip-agents-md` 选项在 RC.85 已经存在 → 证明 future 路径 A 的"provider 不写入 host prose"能力条件存在；该事实已被 2026-05-09 路径 C 稳定化记录重新校准，不再驱动当前 U2/U3。
- 未跑 `analyze` 真实索引（spec-first 自身仓库）做完整回归 spike：本次仅 land pin + schema 模板化（U3 等价工作）。完整索引 spike 与 D1 决策仍在 follow-up。
- implementation-readiness 历史校准：当时 source 只证明 RC.85 pin 与 SP1 option 可用；`write-provider-config.sh` / `.ps1` 仍生成 `analyze --force`，`bootstrap-providers.sh` / `.ps1` 仍只 allow `analyze` 或 `analyze --force`。截至 2026-05-10，这不再表示当前 U3 有 `--skip-agents-md` pending；当前 U3 验收目标是保留 `analyze --force` 并验证 host block normalizer，no-write fixture 仅属于 future managed-marker migration。
- ownership 边界校准：GitNexus provider prose 不应写进 `instruction-bootstrap.js`。该模块只拥有 workflow-entry bootstrap；后续 U2 必须通过独立 provider prose renderer 或 init writer hook 接管 GitNexus block。
- 跟踪机制：历史 `RC85-FULL-INDEX-SPIKE` 跟踪项要求在 D1 实施或下一次 GitNexus pin 变更前关闭；关闭时把真实索引输出摘要追加到本 execution log，并同步 CHANGELOG 记录。该项已由下方 RC.100 full-index spike 关闭。
- 受影响 source-of-truth：`skills/spec-mcp-setup/mcp-tools.json`（4 处 args 模板化 + 顶层 `package` / `version` 字段）。
- 受影响 consumer：4 个 PowerShell + 4 个 bash setup 脚本统一通过 `lib-template.{ps1,sh}` 展开占位符；测试 contract 同步。
- CHANGELOG 终态条目：`v1.8.0 2026-05-08`（schema bump + RC 通道反转 + helper 引入）。

### 2026-05-09 — spec-first v1.8.0：RC.100 Windows lbug open/reopen 修复 pin

执行人：leokuang。Maintainer of pin：leokuang。

**根因校准**：Windows 多仓 `spec-graph-bootstrap` 对每个 child 执行 `gitnexus analyze --force`。当 child 已存在 `.gitnexus/lbug` 时，GitNexus 会先打开旧 LadybugDB 读取缓存、关闭、删除，再立即重建同一路径。`gitnexus@1.6.4-rc.85` 的 `safeClose` 没有 Windows handle-release probe，`openLbugConnection` 也没有 constructor retry；在 Windows 文件句柄释放、Defender 扫描或 native lock 释放滞后时，后续 `new lbug.Database(<repo>/.gitnexus/lbug)` 会失败，表现为 `.gitnexus\lbug` open/write 错误。`gitnexus@1.6.4-rc.100` 在 `core/lbug/lbug-config.js` 增加 `openWithLockRetry`，并在 `core/lbug/lbug-adapter.js` 的 `safeClose` 增加 Windows `waitForWindowsHandleRelease`，是当前 pin 变更的直接依据。

**SP1 spike（macOS arm64, Node 22, npx）实测输出摘要**：

```
$ npx -y gitnexus@1.6.4-rc.100 --version
1.6.4-rc.100

$ npx -y gitnexus@1.6.4-rc.100 analyze --help
Usage: gitnexus analyze [options] [path]
...
  --skip-agents-md                Skip updating the gitnexus section in
                                  AGENTS.md and CLAUDE.md
...

$ GITNEXUS_HOME=<temp> npx -y gitnexus@1.6.4-rc.100 analyze --force --skip-agents-md --no-stats
Repository indexed successfully (12.6s)
27,260 nodes | 31,596 edges | 262 clusters | 300 flows
/Users/kuang/xiaobu/spec-first
```

- `--version` 与 `analyze --help` 均通过；`--skip-agents-md` 仍存在。
- 真实 forced analyze spike 通过，且 `--skip-agents-md --no-stats` 未修改 `AGENTS.md` / `CLAUDE.md`。
- 历史 `RC85-FULL-INDEX-SPIKE` 跟踪项以本次 RC.100 full-index spike 关闭；后续跟踪项改为“下一次 pin 变更前必须重新记录 package surface + forced analyze spike”。
- 该 spike 不能替代 Windows 现场验证；它证明 RC.100 package surface 与当前 spec-first 索引路径可用，Windows 根因依据来自 RC.85/RC.100 lbug close/open 代码差异。

**当时通道治理状态**：GitNexus provider pin 锁定在 `gitnexus@1.6.4-rc.100`；host block ownership 路线是路径 C 稳定化。下一次 pin 变更（无论 RC 升降级或回归 stable）必须重新跑 SP1 spike，把输出抄录到本日志，并在 CHANGELOG 显式声明通道、理由、生效 pin、回归范围。只有显式重开 D1 managed-marker migration 时，才把路径 A 的 `--skip-agents-md` 投影纳入实施范围。
