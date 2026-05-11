---
title: "feat: graph-backed pre-facts injection for review orchestrators"
type: feat
status: active
date: 2026-05-11
spec_id: 2026-05-11-007-review-pre-facts-injection
origin: performance analysis of spec-doc-review and spec-code-review runtime behavior
---

# feat: graph-backed pre-facts injection for review orchestrators

## 摘要

本计划为 `spec-doc-review` 和 `spec-code-review` 两个 workflow orchestrator 增加 pre-facts extraction 层：在 dispatch reviewer agents 之前，从 GitNexus graph normalized artifacts 或 bounded direct reads 中提取代码库事实，注入 agent prompt 的 `{codebase_facts}` 变量，让 agent 不需要（或极少需要）runtime file reads。

设计保持三级降级：graph fresh → bounded direct reads → 当前行为不变。Pre-facts 是 advisory evidence，不是 hard gate；agent 始终保留工具权限作为 fallback。

## 问题框架

当前 review orchestrators 在 dispatch 时不传递任何代码库事实。Agent 必须自己做 runtime file reads 来验证技术声明。实测数据：

- `spec-doc-review` 的 feasibility reviewer 做了 19 次文件读取，耗时 114s，占总审查时间的 87%
- `spec-code-review` 的 correctness/architecture/testing reviewers 各自独立读取相同的 changed files + callers/dependencies，产生大量重复 I/O
- 多个 agent 读取相同文件但互不共享结果

GitNexus graph 已经索引了代码结构（architecture-facts、dependency map、execution flows、impact-capabilities），且当前 `query_ready=true`。但 review orchestrators 没有消费这些 pre-indexed facts——它们只在 graph-evidence-policy 层面声明了 advisory 消费规则，没有在 dispatch 前实际提取并注入。

## 目标

- G1. 让 review orchestrators 在 dispatch 前提取代码库事实，注入 agent prompt，减少 agent runtime reads。
- G2. 优先消费 GitNexus graph normalized artifacts（当 fresh 时），减少 token 消耗和延迟。
- G3. Graph stale/unavailable 时降级到 orchestrator bounded direct reads，仍优于 agent 自己读。
- G4. 完全降级时（无法预读）保持当前行为不变，不引入质量退化。
- G5. Pre-facts 是 advisory evidence，不替代 agent 的验证判断，不成为 dispatch hard gate。
- G6. 多个 agent 共享同一份 pre-facts，消除重复读取。

## 非目标

- 不修改 GitNexus graph 本身的索引逻辑或 bootstrap 流程。
- 不新增 CLI 命令或脚本。
- 不修改 `docs/contracts/graph-provider-consumption.md` 或 `docs/contracts/graph-evidence-policy.md` 的规则。
- 不让 pre-facts 成为 dispatch 的 hard gate 或 reviewer 选择条件。
- 不修改 agent persona 文件的审查逻辑。
- 不修改 `.claude/`、`.codex/`、`.agents/skills/` generated runtime mirrors。
- 不做 token 计量平台或成本评分系统。

## 需求

- R1. `spec-doc-review` orchestrator 必须在 Phase 1（文档分析）和 Phase 2（dispatch）之间增加 pre-facts extraction 步骤。
- R2. `spec-code-review` orchestrator 必须在 Stage 3b（standards paths）和 Stage 4（spawn）之间增加 pre-facts extraction 步骤。
- R3. Pre-facts extraction 必须先检查 graph readiness（`provider-status.json` + `source_revision` vs HEAD），判定 tier: `graph-fresh` / `graph-stale` / `unavailable`。
- R4. Graph fresh 时，从 normalized artifacts（`architecture-facts.json`、`impact-capabilities.json`）提取相关 facts。
- R5. Graph stale/unavailable 时，orchestrator 做 bounded direct reads（前 80 行 × max 15 files）。
- R6. 无法预读时（无文件路径可提取、读取全部失败），设置空 `{codebase_facts}` block 并标注原因，不阻塞 dispatch。
- R7. `{codebase_facts}` 作为新变量注入 subagent-template，所有 dispatched agents 共享同一份 facts。
- R8. Agent prompt 中必须包含 pre-facts-usage 指令：优先使用预注入 facts，仅在需要验证额外假设时才做 runtime reads。
- R9. Pre-facts block 必须标注 tier 和 reason，agent 可据此判断是否需要补充验证。
- R10. Pre-facts extraction 失败不阻塞 dispatch；agent 始终保留 Read/Grep/Glob/Bash 工具权限。
- R11. Doc-review 的 fact extraction targets 从文档的 `Sources & References`、`Context & Research`、`Patterns to follow`、`Files:` 列表中提取。
- R12. Code-review 的 fact extraction targets 从 diff 的 changed files 提取，包括 callers/callees 和 related tests。
- R13. Token budget：doc-review ~4000 tokens，code-review ~6000 tokens；超出时按出现顺序截断。

## 范围边界

- Pre-facts 是 orchestrator 层的 advisory enrichment，不改变 agent persona 的审查逻辑。
- Graph consumption 规则不变：fresh 时优先，stale 时 advisory，unavailable 时 fallback。
- Subagent template 的其他变量（persona、schema、document_content、diff 等）不变。
- 现有 graph-provider-consumption.md 和 graph-evidence-policy.md 的规则不变。
- Agent 的 read-only 约束不变；pre-facts 不授权 agent 写入任何文件。

### Deferred to Follow-Up Work

- Live MCP query 作为 pre-facts 补充源（等 MCP startup 延迟优化后再评估）。
- Per-persona targeted facts（不同 persona 收到不同 facts subset）——v1 先共享同一份。
- Adaptive token budget（根据文档/diff 规模动态调整）——v1 先用固定上限。
- Pre-facts caching across rounds（doc-review round 2+ 复用 round 1 的 facts）——v1 每轮重新提取。

## 设计决策

- D1. 新增 `{codebase_facts}` 变量而非修改现有变量。理由：backward compatible，空 block 等同于当前行为。
- D2. 所有 agent 共享同一份 pre-facts。理由：v1 简单；per-persona targeting 是优化但增加复杂度。
- D3. Graph readiness check 复用 spec-plan 的模式（读 provider-status.json + 比对 source_revision）。理由：已有验证过的 pattern，不重新发明。
- D4. Bounded direct reads 限制前 80 行。理由：函数签名、imports、exports、class 结构通常在文件头部；80 行覆盖大部分 CommonJS/ESM 模块的 public surface。
- D5. Token budget 硬上限而非动态计算。理由：v1 简单可预测；动态计算需要 tokenizer 依赖。
- D6. Pre-facts block 使用 XML-like tag（`<codebase-facts tier="..." reason="...">`）。理由：与现有 subagent template 的 `<review-context>`、`<output-contract>` 风格一致。
- D7. 每个 orchestrator 各有独立的 `references/pre-facts-extraction.md`。理由：doc-review 和 code-review 的 extraction targets 不同（文档路径 vs diff 路径），共享一份会增加条件分支。
- D8. Pre-facts extraction 记录 tier 到 Coverage section。理由：可审计，便于后续优化评估。

## 过度设计防线

### v1 必须完成

- 两个 orchestrator 各增加 pre-facts extraction 步骤。
- Subagent template 增加 `{codebase_facts}` 变量和 pre-facts-usage 指令。
- 三级降级路径明确且有 tier 标注。
- 契约测试覆盖 pre-facts 相关 prose。
- CHANGELOG.md 更新。

### v1 必须延后

- Per-persona targeted facts。
- Live MCP query 作为补充源。
- Adaptive token budget。
- Cross-round facts caching。
- Token 消耗度量和报告。

### 停止条件

实施中如果需要新增 tokenizer 依赖、修改 graph bootstrap 流程、改变 agent persona 的审查逻辑、或让 pre-facts 成为 dispatch 的 blocking condition，应停止并回到 plan/doc-review。

## 实施单元

### U1. Pre-facts extraction contract（参考文档）

**目标：** 定义 pre-facts extraction 的 graph readiness check、extraction targets、bounding rules 和 output format。

**需求：** R3, R4, R5, R6, R9, R10, R11, R12, R13

**依赖：** 无

**文件：**
- Create: `skills/spec-doc-review/references/pre-facts-extraction.md`
- Create: `skills/spec-code-review/references/pre-facts-extraction.md`

**Approach：**
- Doc-review 版本：定义从文档 sections 提取路径的规则、graph-fresh 时从 architecture-facts.json 提取 symbol/signature facts 的方式、bounded reads 的 80 行 × 15 files 限制。
- Code-review 版本：定义从 changed files 提取路径的规则、graph-fresh 时从 impact-capabilities.json 提取 blast radius/callers/tests 的方式、bounded reads 的 grep/glob fallback。
- 两份文档共享 graph readiness check 模式和 output format 规范。

**Patterns to follow：**
- `skills/spec-plan/SKILL.md` 中 Graph Readiness 消费模式（读 provider-status.json + 比对 source_revision）。
- `docs/contracts/graph-provider-consumption.md` 中 readiness truth table。

**Test scenarios：**
- Contract 文档定义了三级降级路径。
- Contract 文档明确 pre-facts 是 advisory，不是 hard gate。
- Contract 文档定义了 token budget 和 bounding rules。

**Verification：**
- `npm run test:unit` 或 targeted contract tests。

---

### U2. doc-review SKILL.md 增加 Phase 1b

**目标：** 在文档分析和 dispatch 之间插入 pre-facts extraction 步骤。

**需求：** R1, R3, R6, R9, R10

**依赖：** U1

**文件：**
- Modify: `skills/spec-doc-review/SKILL.md`
- Modify: `tests/unit/spec-doc-review-contracts.test.js`

**Approach：**
- 在 Phase 1（Get and Analyze Document）和 Phase 2（Announce and Dispatch）之间插入 Phase 1b。
- Phase 1b 读取 `references/pre-facts-extraction.md`，执行 graph readiness check，提取 facts，格式化为 `<codebase-facts>` block。
- 记录 extraction tier 到 Coverage section。

**Test scenarios：**
- SKILL.md 包含 Phase 1b pre-facts extraction 描述。
- Phase 1b 在 Phase 1 之后、Phase 2 之前。
- Pre-facts 描述为 advisory evidence，不阻塞 dispatch。
- 降级路径明确：graph-fresh → bounded-reads → unavailable。

**Verification：**
- `npx jest tests/unit/spec-doc-review-contracts.test.js --runInBand`

---

### U3. doc-review subagent-template.md 增加 {codebase_facts}

**目标：** 让 dispatched agents 收到预编译的代码库事实。

**需求：** R7, R8, R9

**依赖：** U1, U2

**文件：**
- Modify: `skills/spec-doc-review/references/subagent-template.md`
- Modify: `tests/unit/spec-doc-review-contracts.test.js`

**Approach：**
- 在 `<review-context>` section 中 `Document content:` 之前增加 `{codebase_facts}`。
- 在 `<output-contract>` 中增加 `<pre-facts-usage>` 指令块。
- 指令明确：优先使用 pre-facts，仅在需要验证额外假设时才做 runtime reads；pre-facts 是 advisory evidence。

**Test scenarios：**
- subagent-template.md 包含 `{codebase_facts}` 变量。
- subagent-template.md 包含 pre-facts-usage 指令。
- 指令不禁止 agent 使用工具（保留 fallback）。

**Verification：**
- `npx jest tests/unit/spec-doc-review-contracts.test.js --runInBand`

---

### U4. code-review SKILL.md 增加 Stage 3c

**目标：** 在 standards paths discovery 和 spawn 之间插入 pre-facts extraction 步骤。

**需求：** R2, R3, R6, R9, R10, R12

**依赖：** U1

**文件：**
- Modify: `skills/spec-code-review/SKILL.md`
- Modify: `tests/unit/spec-code-review-contracts.test.js`

**Approach：**
- 在 Stage 3b（standards paths discovery）和 Stage 4（spawn）之间插入 Stage 3c。
- Stage 3c 读取 `references/pre-facts-extraction.md`，从 changed files 提取 callers/dependencies/tests facts。
- 记录 extraction tier 到 Coverage section。

**Test scenarios：**
- SKILL.md 包含 Stage 3c pre-facts extraction 描述。
- Stage 3c 在 Stage 3b 之后、Stage 4 之前。
- Pre-facts 不替代 diff scope rules。
- 降级路径明确。

**Verification：**
- `npx jest tests/unit/spec-code-review-contracts.test.js --runInBand`

---

### U5. code-review subagent-template.md 增加 {codebase_facts}

**目标：** 让 code-review dispatched agents 收到预编译的代码库事实。

**需求：** R7, R8, R9

**依赖：** U1, U4

**文件：**
- Modify: `skills/spec-code-review/references/subagent-template.md`
- Modify: `tests/unit/spec-code-review-contracts.test.js`

**Approach：**
- 与 U3 相同模式：在 review-context 中增加 `{codebase_facts}` 变量，在 output-contract 中增加 pre-facts-usage 指令。

**Test scenarios：**
- subagent-template.md 包含 `{codebase_facts}` 变量。
- subagent-template.md 包含 pre-facts-usage 指令。
- 指令不禁止 agent 使用工具。

**Verification：**
- `npx jest tests/unit/spec-code-review-contracts.test.js --runInBand`

---

### U6. CHANGELOG 与最终校验

**目标：** 记录变更，确认无 runtime mirror 修改。

**需求：** 项目 changelog 治理规则

**依赖：** U1-U5

**文件：**
- Modify: `CHANGELOG.md`

**Approach：**
- 使用当前 host developer profile 格式记录变更。
- 确认未修改 generated runtime mirrors。

**Verification：**
- `npx jest tests/unit/changelog-format.test.js --runInBand`
- `git diff --check`

## 降级设计

| 条件 | 行为 | Agent 体验 |
|------|------|-----------|
| `provider-status.json` 存在 + target provider `query_ready=true` + `source_revision` = current HEAD | 从 normalized artifacts 提取 structured facts | `<codebase-facts tier="graph-fresh">` 包含 symbols/signatures/relationships |
| `provider-status.json` 存在但 stale（revision mismatch 或 worktree dirty） | Orchestrator bounded direct reads（前 80 行 × max 15 files） | `<codebase-facts tier="bounded-reads" reason="graph stale">` 包含 file snippets |
| `provider-status.json` 不存在 / `query_ready=false` / 读取失败 | 不做预读，agent 自己读 | `<codebase-facts tier="unavailable" reason="...">` 空 block，agent 正常使用工具 |
| 文档/diff 中没有可提取的文件路径 | 不做预读 | `<codebase-facts tier="no-targets">` 空 block |

**关键约束：**
- Pre-facts extraction 失败不阻塞 dispatch。
- Agent 始终保留 Read/Grep/Glob/Bash 工具权限。
- Pre-facts 标记 tier 和 reason，agent 可据此判断是否需要补充验证。
- Graph stale 时 pre-facts 标记为 advisory，agent 可选择 re-verify。

## 预期效果

| 场景 | 当前耗时 | 优化后耗时 | 原因 |
|------|---------|-----------|------|
| doc-review feasibility (graph fresh) | 114s (19 reads) | ~35s (0-2 reads) | Facts 预注入，无需 I/O |
| doc-review feasibility (graph stale) | 114s (19 reads) | ~50s (0-5 reads) | 大部分 facts 预读，少量补充 |
| doc-review feasibility (unavailable) | 114s (19 reads) | 114s (19 reads) | 完全降级，无退化 |
| code-review correctness+architecture | ~80s each (10+ reads) | ~40s each (0-3 reads) | Callers/tests 预注入 |
| code-review total (4 agents sharing facts) | ~120s | ~60s | 共享 facts 消除重复读取 |

## System-Wide Impact

- **Interaction graph：** orchestrator 在 dispatch 前消费 `.spec-first/graph/` 和 `.spec-first/providers/` artifacts，提取 facts 后注入所有 dispatched agents。
- **Error propagation：** pre-facts extraction 失败是 silent degradation，不是 workflow failure。
- **State lifecycle：** 不引入新的 durable state；pre-facts 是 session-scoped，不持久化。
- **API surface：** subagent template 增加一个 optional 变量；空 block 等同于当前行为。
- **Graph dependency：** 不新增 graph 依赖；graph unavailable 时完全降级。
- **Unchanged invariants：** agent persona 逻辑不变；findings schema 不变；synthesis pipeline 不变；graph-evidence-policy 不变。

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| Pre-facts 过时导致 agent 基于错误事实审查 | Tier 标注让 agent 知道 facts 的新鲜度；agent 保留工具权限可 re-verify |
| Token budget 不够覆盖关键 facts | 按文档/diff 中出现顺序优先提取最相关文件；v2 可做 adaptive budget |
| Pre-facts extraction 本身耗时过长 | Bounded: max 15 files × 80 lines；graph-fresh 路径只读 JSON artifacts（<1s） |
| Agent 忽略 pre-facts 仍然做大量 runtime reads | Pre-facts-usage 指令明确优先级；但不强制禁止工具使用（保留质量） |
| Graph artifacts 格式变化导致 extraction 失败 | 读取失败 silent fallback 到 bounded reads 或 unavailable |
| 共享 facts 对某些 persona 无用（如 coherence reviewer） | 无害：coherence reviewer 不需要代码 facts，会忽略 pre-facts block |

## 验证策略

最小验证：
- `npx jest tests/unit/spec-doc-review-contracts.test.js --runInBand`
- `npx jest tests/unit/spec-code-review-contracts.test.js --runInBand`
- `npx jest tests/unit/changelog-format.test.js --runInBand`
- `npm run typecheck`
- `git diff --check`

功能验证：
- 对同一份 plan 文档在 graph-fresh 条件下运行 `spec-doc-review`，观察 feasibility reviewer 的工具调用次数是否显著减少。
- 对比 findings 质量：pre-facts 模式 vs 当前模式应产出相同或更好的 findings。

扩展验证：
- `npm run test:unit`
- Fresh-source eval for changed skill prose。

## 上下文与依据

- 性能数据来源：本会话中对 `docs/plans/2026-05-11-006-feat-task-pack-review-gate-plan.md` 的实际 doc-review 执行。
- Graph consumption contract：`docs/contracts/graph-provider-consumption.md`。
- Graph evidence policy：`docs/contracts/graph-evidence-policy.md`。
- 现有 graph artifacts：`.spec-first/graph/graph-facts.json`、`.spec-first/providers/gitnexus/normalized/architecture-facts.json`。
- Doc-review orchestrator：`skills/spec-doc-review/SKILL.md`。
- Code-review orchestrator：`skills/spec-code-review/SKILL.md`。
- Subagent templates：`skills/spec-doc-review/references/subagent-template.md`、`skills/spec-code-review/references/subagent-template.md`。
- Graph readiness check pattern：`skills/spec-plan/SKILL.md` 中 Graph Readiness 消费模式。

## Handoff

推荐下一步：

```text
$spec-doc-review docs/plans/2026-05-11-007-feat-review-pre-facts-injection-plan.md
```

审查通过后进入执行：

```text
$spec-work docs/plans/2026-05-11-007-feat-review-pre-facts-injection-plan.md
```
