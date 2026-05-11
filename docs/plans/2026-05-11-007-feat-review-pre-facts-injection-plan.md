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

本计划为 `spec-doc-review` 和 `spec-code-review` 两个 workflow orchestrator 增加 pre-facts extraction 层：在 dispatch reviewer agents 之前，先用 canonical graph readiness artifacts 判断 provider freshness 和 query surface，再通过 bounded provider queries 或 target-aware direct reads 提取代码库事实，注入 agent prompt 的 `{codebase_facts}` 变量，让 agent 不需要（或极少需要）重复做 runtime file reads。

设计保持三级输出路径：graph-fresh facts → bounded-reads facts → 空 block（当前行为不变）。Pre-facts 是 advisory evidence，不是 hard gate；agent 始终保留工具权限作为 fallback。

## 问题框架

当前 review orchestrators 在 dispatch 时不传递任何代码库事实。Agent 必须自己做 runtime file reads 来验证技术声明。实测数据：

- `spec-doc-review` 的 feasibility reviewer 做了 19 次文件读取，耗时 114s，占总审查时间的 87%
- `spec-code-review` 的 correctness/architecture/testing reviewers 各自独立读取相同的 changed files + callers/dependencies，产生大量重复 I/O
- 多个 agent 读取相同文件但互不共享结果

GitNexus graph 和 code-review-graph 已经暴露 query surface（architecture map、dependency map、execution flow、impact capabilities、related tests 等能力），且当前 provider `query_ready=true`。但 review orchestrators 没有在 dispatch 前统一提取 facts；各 reviewer 仍重复读取文件或自行查询。当前 normalized artifacts 主要是 readiness / capability envelope 和 query surface pointer，不应被假定为已包含 per-symbol、per-caller 或 related-test 语义事实。

## 目标

- G1. 让 review orchestrators 在 dispatch 前提取代码库事实，注入 agent prompt，减少 agent runtime reads。
- G2. 优先消费 canonical graph readiness artifacts 和 provider query surface（当 fresh 时），再用 bounded provider queries 提取语义 facts，减少 token 消耗和延迟。
- G3. Graph stale、provider unavailable 或 semantic payload 缺失但存在可读 targets 时，降级到 orchestrator target-aware bounded direct reads，仍优于 agent 自己读。
- G4. 完全降级时（无 targets、读取全部失败或 provider/query surface 不可用且无法直接读取）输出空 `{codebase_facts}` block，保持当前行为不变，不引入质量退化。
- G5. Pre-facts 是 advisory evidence，不替代 agent 的验证判断，不成为 dispatch hard gate。
- G6. 多个 agent 共享同一份 pre-facts，但 prompt 明确 persona relevance boundary，避免非代码 persona 被无关代码 facts 锚定。

## 非目标

- 不修改 GitNexus graph 本身的索引逻辑或 bootstrap 流程。
- 不新增用户可见 CLI 命令；允许新增共享 reference contract 来避免两个 workflow 复制 readiness、tier 和 truncation 规则。
- 不修改 `docs/contracts/graph-provider-consumption.md` 或 `docs/contracts/graph-evidence-policy.md` 的规则。
- 不让 pre-facts 成为 dispatch 的 hard gate 或 reviewer 选择条件。
- 不修改 agent persona 文件的审查逻辑。
- 不修改 `.claude/`、`.codex/`、`.agents/skills/` generated runtime mirrors。
- 不做 token 计量平台或成本评分系统。

## 需求

- R1. `spec-doc-review` orchestrator 必须在 Phase 1（文档分析）和 Phase 2（dispatch）之间增加 pre-facts extraction 步骤。
- R2. `spec-code-review` orchestrator 必须在 Stage 3b（standards paths）和 Stage 4（spawn）之间增加 pre-facts extraction 步骤。
- R3. Pre-facts extraction 必须先读取 canonical readiness artifacts：`.spec-first/graph/provider-status.json`、`.spec-first/graph/graph-facts.json`、`.spec-first/impact/bootstrap-impact-capabilities.json`，并比较 `source_revision`、`worktree_dirty`、`worktree_status_hash` 与当前 repo snapshot；只在 target provider `query_ready=true` 且 snapshot 匹配时判定 graph readiness 为 `graph-fresh`。
- R4. Graph fresh 时，normalized artifacts 只用于验证 provider capability、定位 `normalized_artifacts` 指针和确认 query surface；per-symbol、relationship、caller、callee、related-test facts 必须来自 bounded provider queries，或在 query 不可用/无语义 payload 时降级到 bounded direct reads。
- R5. Graph stale、provider unavailable、semantic payload 缺失或 query 失败但存在可读 targets 时，orchestrator 做 target-aware bounded direct reads（max 15 targets，按 source/changed-file relevance 排序，提取 heading / changed hunk / symbol / export 周边窗口，而不是固定前 80 行）。
- R6. 无法预读时（无文件路径可提取、读取全部失败、无 query surface 且无 direct-read target），设置空 `{codebase_facts}` block 并标注 output tier 与 reason，不阻塞 dispatch。
- R7. `{codebase_facts}` 作为新变量注入 subagent-template，所有 dispatched agents 共享同一份 facts。
- R8. Agent prompt 中必须包含 pre-facts-usage 指令：优先把预注入 facts 用作定向阅读和低风险背景；仅当 facts 与当前 persona lens 相关时使用，非代码 persona 可忽略该 block；任何 P0/P1 或高置信代码判断仍需源码、graph query 或明确降级说明支撑。
- R9. Pre-facts block 必须标注 tier 和 reason，agent 可据此判断是否需要补充验证。
- R10. Pre-facts extraction 失败不阻塞 dispatch；agent 始终保留 Read/Grep/Glob/Bash 工具权限。
- R11. Doc-review 的 fact extraction targets 从文档的 `Sources & References`、`Context & Research`、`Patterns to follow`、`Files:` / `文件：` 列表中提取。
- R12. Code-review 的 fact extraction targets 从 diff 的 changed files 提取，包括 callers/callees 和 related tests。
- R13. Token budget：doc-review ~4000 tokens，code-review ~6000 tokens；超出时先按 relevance ordering 截断（source-of-truth / changed files / implementation files 优先于 references / tests / docs），并在 block 中列出 omitted targets summary。
- R14. `<codebase-facts>` 必须区分 `readiness` 与 `tier`：`readiness` 取 `graph-fresh` / `graph-stale` / `provider-unavailable` / `no-targets`，`tier` 取 `graph-fresh` / `bounded-reads` / `unavailable` / `no-targets`。
- R15. Coverage section 必须记录 `Pre-facts tier: <tier> (<reason>)`，其中 Coverage 指 orchestrator 最终 review output 的 `Coverage` 小节。

## 范围边界

- Pre-facts 是 orchestrator 层的 advisory enrichment，不改变 agent persona 的审查逻辑。
- Graph consumption 规则不变：fresh 时优先，stale 时 advisory，unavailable 时 fallback；readiness facts 不等同于 semantic review facts。
- Subagent template 的其他变量（persona、schema、document_content、diff 等）不变。
- 现有 graph-provider-consumption.md 和 graph-evidence-policy.md 的规则不变。
- Agent 的 read-only 约束不变；pre-facts 不授权 agent 写入任何文件。

### Deferred to Follow-Up Work

- Unbounded / ad hoc MCP research 作为 pre-facts 补充源；v1 只允许 bounded provider queries，且必须由 readiness 和 target list 限定。
- Per-persona targeted facts（不同 persona 收到不同 facts subset）——v1 先共享同一份，但通过 persona relevance boundary 限制使用。
- Adaptive token budget（根据文档/diff 规模动态调整）——v1 先用固定上限。
- Pre-facts caching across rounds（doc-review round 2+ 复用 round 1 的 facts）——v1 每轮重新提取。

## 设计决策

- D1. 新增 `{codebase_facts}` 变量而非修改现有变量。理由：backward compatible，空 block 等同于当前行为。
- D2. 所有 agent 共享同一份 pre-facts，但 pre-facts-usage 必须声明 persona relevance boundary。理由：v1 不做 per-persona targeting，但要避免无关代码 facts 锚定 product/coherence 等非代码 reviewer。
- D3. Graph readiness check 复用 canonical graph-provider consumption contract（读 provider-status、graph-facts、impact-capabilities，并比较 `source_revision`、`worktree_dirty`、`worktree_status_hash`）。理由：只比较 HEAD 会误判 dirty checkout。
- D4. Bounded direct reads 使用 target-aware extraction。理由：本计划主要修改 Markdown workflow contracts，关键内容经常在前 80 行之后；对源码也应优先抓取 changed hunk、exports、symbols、近邻 tests，而不是固定文件头。
- D5. Token budget 硬上限而非动态计算。理由：v1 简单可预测；动态计算需要 tokenizer 依赖。
- D6. Pre-facts block 使用 XML-like tag（`<codebase-facts readiness="..." tier="..." reason="...">`）。理由：与现有 subagent template 的 `<review-context>`、`<output-contract>` 风格一致。
- D7. 新增一个共享 pre-facts extraction base contract，再让两个 orchestrator 各有薄的 workflow-specific reference。理由：readiness、tier、budget 和 truncation 是共享确定性规则；doc-review 和 code-review 只在 target extraction 上不同。
- D8. Pre-facts extraction 记录 `Pre-facts tier: <tier> (<reason>)` 到最终 review output 的 Coverage section。理由：可审计，便于后续优化评估。

## 过度设计防线

### v1 必须完成

- 一个共享 pre-facts extraction base contract，两个 orchestrator 各增加薄的 pre-facts extraction 步骤。
- Subagent template 增加 `{codebase_facts}` 变量和 pre-facts-usage 指令。
- Graph readiness 与 output tier 明确分离，降级路径有 tier 与 reason 标注。
- Graph-fresh 路径先做 normalized artifact field inventory；如果 artifact 没有语义 payload，使用 bounded provider query 或降级到 bounded direct reads。
- 契约测试覆盖 pre-facts 相关 prose。
- CHANGELOG.md 更新。

### v1 必须延后

- Per-persona targeted facts。
- Unbounded / ad hoc MCP research。
- Adaptive token budget。
- Cross-round facts caching。
- Token 消耗度量和报告。

### 停止条件

实施中如果需要新增 tokenizer 依赖、修改 graph bootstrap 流程、改变 agent persona 的审查逻辑、让 pre-facts 成为 dispatch 的 blocking condition，或需要把 bounded provider query 扩展为开放式代码研究，应停止并回到 plan/doc-review。

## 实施单元

### U1. Pre-facts extraction contract（参考文档）

**目标：** 定义 pre-facts extraction 的 shared base contract：canonical graph readiness check、normalized artifact field inventory、bounded provider query、target-aware direct reads、relevance ordering、tier/reason output format 和 Coverage 记录格式。

**需求：** R3, R4, R5, R6, R9, R10, R11, R12, R13, R14, R15

**依赖：** 无

**文件：**
- Create: `docs/contracts/workflows/review-pre-facts-extraction.md`
- Create: `skills/spec-doc-review/references/pre-facts-extraction.md`
- Create: `skills/spec-code-review/references/pre-facts-extraction.md`

**Approach：**
- Shared base contract：定义 canonical readiness artifacts、snapshot freshness 比对、readiness state、output tier enum、`<codebase-facts>` block schema、omitted-targets summary、Coverage 行格式。
- Shared base contract：要求先通过 provider-status 的 `normalized_artifacts` 指针做 field inventory，记录哪些 artifact 字段可直接消费；当前 artifact 只有 capability/query-surface 时，不得声称已有 semantic facts。
- Shared base contract：graph-fresh 且 query surface 可用时，使用 bounded provider queries 获取 symbol/relationship/caller/callee/related-test facts；query 不可用、无语义 payload 或失败时降级到 target-aware direct reads。
- Doc-review 薄 reference：只定义从文档 `Sources & References`、`Context & Research`、`Patterns to follow`、`Files:` / `文件：` 列表提取 targets 的规则。
- Code-review 薄 reference：只定义从 changed files、callers/callees 和 related tests 提取 targets 的规则，并明确 staged/unstaged dirty snapshot freshness 如何进入 readiness reason。

**Patterns to follow：**
- `docs/contracts/graph-provider-consumption.md` 中 canonical artifacts、forbidden compatibility reads 和 readiness truth table。
- `skills/spec-plan/SKILL.md` 中 Graph Readiness 消费模式，但补齐 `worktree_status_hash` 比对。

**Test scenarios：**
- Shared contract 定义 readiness state 与 output tier 两套枚举，且不混用。
- Shared contract 要求读取 provider-status、graph-facts、impact-capabilities 并比较 `source_revision`、`worktree_dirty`、`worktree_status_hash`。
- Shared contract 明确 normalized artifacts 可作为 capability/query-surface pointer，但不能无 inventory 地声明 semantic facts。
- Contract 文档明确 pre-facts 是 advisory，不是 hard gate。
- Contract 文档定义 token budget、relevance ordering、omitted-targets summary 和 target-aware bounding rules。
- Contract 文档定义 Coverage 行：`Pre-facts tier: <tier> (<reason>)`。

**Verification：**
- `npm run test:unit` 或 targeted contract tests。

---

### U2. doc-review SKILL.md 增加 Phase 1b

**目标：** 在文档分析和 dispatch 之间插入 pre-facts extraction 步骤。

**需求：** R1, R3, R6, R9, R10, R11, R13, R14, R15

**依赖：** U1

**文件：**
- Modify: `skills/spec-doc-review/SKILL.md`
- Modify: `tests/unit/spec-doc-review-contracts.test.js`

**Approach：**
- 在 Phase 1（Get and Analyze Document）和 Phase 2（Announce and Dispatch）之间插入 Phase 1b。
- Phase 1b 读取 shared base contract 和 doc-review reference，执行 graph readiness check、field inventory、bounded provider query / target-aware direct reads，格式化为 `<codebase-facts>` block。
- 记录 `Pre-facts tier: <tier> (<reason>)` 到最终 review output 的 Coverage section。

**Test scenarios：**
- SKILL.md 包含 Phase 1b pre-facts extraction 描述。
- Phase 1b 在 Phase 1 之后、Phase 2 之前。
- Pre-facts 描述为 advisory evidence，不阻塞 dispatch。
- 降级路径明确：graph-fresh → bounded-reads → unavailable/no-targets。
- Contract tests 覆盖 Coverage 行格式与 readiness/tier 枚举分离。

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
- 指令明确：pre-facts 用于定向阅读和低风险背景；仅在与当前 persona lens 相关时使用；非代码 persona 可忽略；P0/P1 或高置信代码判断必须补充源码/graph 直接验证或在 finding 中降级说明。

**Test scenarios：**
- subagent-template.md 包含 `{codebase_facts}` 变量。
- subagent-template.md 包含 pre-facts-usage 指令。
- 指令不禁止 agent 使用工具（保留 fallback）。
- 指令包含 persona relevance boundary 和 high-confidence verification boundary。

**Verification：**
- `npx jest tests/unit/spec-doc-review-contracts.test.js --runInBand`

---

### U4. code-review SKILL.md 增加 Stage 3c

**目标：** 在 standards paths discovery 和 spawn 之间插入 pre-facts extraction 步骤。

**需求：** R2, R3, R6, R9, R10, R12, R13, R14, R15

**依赖：** U1

**文件：**
- Modify: `skills/spec-code-review/SKILL.md`
- Modify: `tests/unit/spec-code-review-contracts.test.js`

**Approach：**
- 在 Stage 3b（standards paths discovery）和 Stage 4（spawn）之间插入 Stage 3c。
- Stage 3c 读取 shared base contract 和 code-review reference，从 changed files 提取 targets，按 clean/staged/unstaged snapshot 记录 freshness reason，并通过 bounded provider query / target-aware direct reads 提取 callers/dependencies/tests facts。
- 记录 `Pre-facts tier: <tier> (<reason>)` 到最终 review output 的 Coverage section。

**Test scenarios：**
- SKILL.md 包含 Stage 3c pre-facts extraction 描述。
- Stage 3c 在 Stage 3b 之后、Stage 4 之前。
- Pre-facts 不替代 diff scope rules。
- 降级路径明确，并覆盖 clean/staged/unstaged dirty diff review case。
- Contract tests 覆盖 Coverage 行格式与 readiness/tier 枚举分离。

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
- 与 U3 相同模式：在 review-context 中增加 `{codebase_facts}` 变量，在 output-contract 中增加 pre-facts-usage 指令；指令必须说明 pre-facts 不替代 diff scope rules、changed-file ownership 或 reviewer 的直接验证。

**Test scenarios：**
- subagent-template.md 包含 `{codebase_facts}` 变量。
- subagent-template.md 包含 pre-facts-usage 指令。
- 指令不禁止 agent 使用工具。
- 指令包含 persona relevance boundary 和 high-confidence verification boundary。

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

| Readiness 条件 | Target 条件 | 行为 | Agent 体验 |
|------|------|------|-----------|
| canonical artifacts 存在，target provider `query_ready=true`，`source_revision`、`worktree_dirty`、`worktree_status_hash` 与当前 snapshot 匹配 | 有可提取 targets，provider query surface 可用 | 先做 normalized artifact field inventory；若 artifact 已含语义 facts 则消费；否则执行 bounded provider query 获取 symbol/relationship/caller/callee/related-test facts | `<codebase-facts readiness="graph-fresh" tier="graph-fresh" reason="provider-query">` |
| graph stale / dirty hash mismatch / provider unavailable / bounded query 失败 / normalized artifact 无语义 payload | 有可读 targets | Orchestrator 做 target-aware bounded direct reads：source-of-truth 和 changed files 优先，提取 heading、changed hunk、symbol、export、nearby tests 周边窗口，max 15 targets | `<codebase-facts readiness="graph-stale|provider-unavailable" tier="bounded-reads" reason="...">` |
| 任意 readiness | 文档/diff 中没有可提取路径 | 不做预读 | `<codebase-facts readiness="no-targets" tier="no-targets" reason="no extraction targets">` 空 block |
| 任意 readiness | targets 全部读取失败且无可用 query surface | 不做预读，agent 自己读 | `<codebase-facts readiness="provider-unavailable" tier="unavailable" reason="all pre-reads failed">` 空 block |

**关键约束：**
- Pre-facts extraction 失败不阻塞 dispatch。
- Agent 始终保留 Read/Grep/Glob/Bash 工具权限。
- Pre-facts 同时标记 readiness、tier 和 reason，agent 可据此判断是否需要补充验证。
- Graph stale、bounded-reads、provider-unavailable 和 no-targets 都是 advisory；P0/P1 或高置信代码判断必须 re-verify 或在 finding 中明确降级。
- Code-review 的 dirty worktree 必须比较 dirty snapshot identity；若 graph bootstrap 不是同一 dirty snapshot，不能标记为 `graph-fresh`。

## 预期效果

| 场景 | 当前耗时 | 优化后目标 | 原因 / 门槛 |
|------|---------|-----------|------|
| doc-review feasibility (graph fresh + bounded query usable) | 114s (19 reads) | runtime reads 降低 ≥70%，总耗时降低 ≥30% | Facts 预注入，agent 只做补充验证 |
| doc-review feasibility (bounded-reads) | 114s (19 reads) | runtime reads 降低 ≥40%，总耗时不退化 | Target-aware snippets 预读，少量补充 |
| doc-review feasibility (unavailable/no-targets) | 114s (19 reads) | 不退化 | 完全降级，保持当前行为 |
| code-review clean/staged snapshot matches graph | 待 baseline | runtime reads 降低 ≥50%，findings parity 通过 | Provider query / related tests 预注入 |
| code-review dirty snapshot mismatch | 待 baseline | 只声明 bounded-reads 收益，不声明 graph-fresh 收益 | Dirty worktree 不能误标 graph-fresh |

## System-Wide Impact

- **Interaction graph：** orchestrator 在 dispatch 前消费 `.spec-first/graph/`、`.spec-first/impact/` 和 `.spec-first/providers/` artifacts 判断 readiness/query surface，再用 bounded provider query 或 bounded direct reads 提取 facts 后注入 dispatched agents。
- **Error propagation：** pre-facts extraction 失败是 silent degradation，不是 workflow failure。
- **State lifecycle：** 不引入新的 durable state；pre-facts 是 session-scoped，不持久化。
- **API surface：** subagent template 增加一个 optional 变量；空 block 等同于当前行为。
- **Graph dependency：** 不新增 bootstrap/index 依赖；graph unavailable 或 dirty-stale 时降级到 bounded direct reads 或空 block。
- **Unchanged invariants：** agent persona 逻辑不变；findings schema 不变；synthesis pipeline 不变；graph-evidence-policy 不变。

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| Pre-facts 过时导致 agent 基于错误事实审查 | Readiness + tier + reason 标注；P0/P1 或高置信代码 finding 必须 re-verify 或降级说明 |
| Token budget 不够覆盖关键 facts | Relevance ordering：source-of-truth / changed files / implementation files 优先；输出 omitted-targets summary |
| Pre-facts extraction 本身耗时过长 | Bounded: max 15 targets；provider query 和 direct reads 都必须有 target list，不做开放式研究 |
| Agent 忽略 pre-facts 仍然做大量 runtime reads | Pre-facts-usage 指令要求优先用于定向阅读；验证策略用 read-count 和 wall-time gate 检查收益 |
| Agent 被无关 shared facts 锚定 | Persona relevance boundary：非代码 persona 可忽略 pre-facts，不得用 pre-facts 替代自身 lens 判断 |
| Graph artifacts 格式变化导致 extraction 失败 | Field inventory 失败则 silent fallback 到 bounded reads 或 unavailable，并在 Coverage 记录 tier/reason |

## 验证策略

最小验证：
- `npx jest tests/unit/spec-doc-review-contracts.test.js --runInBand`
- `npx jest tests/unit/spec-code-review-contracts.test.js --runInBand`
- `npx jest tests/unit/changelog-format.test.js --runInBand`
- `npm run typecheck`
- `git diff --check`

功能验证：
- 对同一份 plan 文档在 graph-fresh 条件下运行 `spec-doc-review`，记录 wall time、agent read count、pre-facts tier、prompt token delta 和 findings parity；目标是 runtime reads 降低 ≥70%，总耗时降低 ≥30%，且 synthesized findings 无明显质量损失。
- 对同一份 code-review diff 分别覆盖 clean/staged snapshot match 与 dirty snapshot mismatch，记录 wall time、agent read count、pre-facts tier、prompt token delta 和 findings parity；dirty mismatch 不得标记为 `graph-fresh`。
- 构造 budget-exhaustion case，验证 omitted-targets summary 出现，且 relevance ordering 优先 source-of-truth / changed files / implementation files。
- 对比 findings 质量：pre-facts 模式 vs 当前模式应产出相同或更好的 findings；若 read count 降低但 P1/P0 finding 丢失，视为失败并回到 plan/doc-review。

扩展验证：
- `npm run test:unit`
- Fresh-source eval for changed skill prose。

## 上下文与依据

- 性能数据来源：本会话中对 `docs/plans/2026-05-11-006-feat-task-pack-review-gate-plan.md` 的实际 doc-review 执行。
- Graph consumption contract：`docs/contracts/graph-provider-consumption.md`。
- Graph evidence policy：`docs/contracts/graph-evidence-policy.md`。
- 现有 graph artifacts：`.spec-first/graph/provider-status.json`、`.spec-first/graph/graph-facts.json`、`.spec-first/impact/bootstrap-impact-capabilities.json`、`.spec-first/providers/gitnexus/normalized/architecture-facts.json`、`.spec-first/providers/code-review-graph/normalized/impact-capabilities.json`。
- 当前 normalized artifacts 需要 field inventory；不能预设其包含 per-symbol、caller/callee 或 related-test semantic payload。
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
