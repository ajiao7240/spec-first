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

本计划的 v1 交付 shared pre-facts foundation 和 `spec-doc-review` 默认路径：在 dispatch reviewer agents 之前，先用 canonical graph readiness artifacts 判断 provider freshness 和 query surface，再通过 fact-contract-verified provider facts 或 target-aware direct reads 提取代码库事实，注入 agent prompt 的 `{codebase_facts}` 变量，让 agent 不需要（或极少需要）重复做 runtime file reads。`spec-code-review` 先进入 baseline/proceed gate；只有 gate 通过后，才把同一 foundation 接入 code-review 默认 dispatch path，否则作为 follow-up 延后。

设计保持三级输出路径：graph-fresh facts → bounded-reads facts → 空 block（当前行为不变）。Pre-facts 是 advisory evidence，不是 hard gate；agent 始终保留工具权限作为 fallback。共享 helper 通过隐藏的 package CLI internal command 暴露给 source checkout、Codex runtime 和 Claude runtime；runtime workflow prose 不直接引用 `src/cli/helpers/*`。

## 问题框架

当前 review orchestrators 在 dispatch 时不传递任何代码库事实。Agent 必须自己做 runtime file reads 来验证技术声明。实测数据：

- `spec-doc-review` 的 feasibility reviewer 做了 19 次文件读取，耗时 114s，占总审查时间的 87%
- `spec-code-review` 的 correctness/architecture/testing reviewers 各自独立读取相同的 changed files + callers/dependencies，产生大量重复 I/O
- 多个 agent 读取相同文件但互不共享结果

GitNexus graph 和 code-review-graph 已经暴露 query surface（architecture map、dependency map、execution flow、impact capabilities、related tests 等能力），且当前 provider `query_ready=true`。但 review orchestrators 没有在 dispatch 前统一提取 facts；各 reviewer 仍重复读取文件或自行查询。当前 normalized artifacts 主要是 readiness / capability envelope 和 query surface pointer，不应被假定为已包含 per-symbol、per-caller 或 related-test 语义事实。

## 目标

- G1. 让 `spec-doc-review` 在 dispatch 前提取代码库事实并注入 agent prompt；`spec-code-review` 只有在 baseline/proceed gate 通过后进入同一默认路径。
- G2. 优先消费 canonical graph readiness artifacts 和 provider query surface（当 fresh 时）；语义 facts 必须来自符合 fact contract 的 normalized artifact、script-callable provider adapter result，或 orchestrator 执行的 bounded live MCP query result。
- G3. Graph stale、provider unavailable、provider query 不可用 / 失败 / 返回无 usable semantic facts 但存在可读 targets 时，降级到 helper-owned target-aware bounded direct reads，仍优于 agent 自己读。
- G4. 完全降级时（无 targets、读取全部失败或 provider/query surface 不可用且无法直接读取）输出空 `{codebase_facts}` block，保持当前行为不变，不引入质量退化。
- G5. Pre-facts 是 advisory evidence，不替代 agent 的验证判断，不成为 dispatch hard gate。
- G6. 多个 agent 共享同一份 pre-facts，但 prompt 明确 persona relevance boundary，避免非代码 persona 被无关代码 facts 锚定。
- G7. 明确 helper runtime reachability：source checkout 使用 `node bin/spec-first.js internal review-pre-facts ...`，installed Codex/Claude runtime 使用 `spec-first internal review-pre-facts ...`；隐藏 internal command 不进入用户可见 workflow 菜单。

## 非目标

- 不修改 GitNexus graph 本身的索引逻辑或 bootstrap 流程。
- 不新增用户可见 CLI 命令；允许新增隐藏的 `spec-first internal review-pre-facts` 只读入口、helper script 与共享 reference contract，避免两个 workflow 复制 readiness、tier、provenance 和 truncation 规则。
- 不把 helper 设计成 generic MCP client；live MCP query 只能是 orchestrator 在当前 session 中按 helper 产出的 bounded query plan 执行的 session-local evidence，不回写 compiled readiness。
- 不要求 code-review pre-facts 与 doc-review 同步默认上线；baseline/proceed gate 未通过时 code-review U4/U5 延后。
- 不修改 `docs/contracts/graph-provider-consumption.md` 或 `docs/contracts/graph-evidence-policy.md` 的规则。
- 不让 pre-facts 成为 dispatch 的 hard gate 或 reviewer 选择条件。
- 不修改 agent persona 文件的审查逻辑。
- 不修改 `.claude/`、`.codex/`、`.agents/skills/` generated runtime mirrors。
- 不做 token 计量平台或成本评分系统；`prompt token delta` 只能在现有 host / transcript log 已直接可得时作为可选观察项。

## 需求

- R1. `spec-doc-review` orchestrator 必须在 Phase 1（文档分析）和 Phase 2（dispatch）之间增加 pre-facts extraction 步骤。
- R2. `spec-code-review` orchestrator 只有在 baseline/proceed gate 通过后，才在 Stage 4 的 Runtime readiness preflight 之后、Dispatch capability gate / Spawning 之前增加 pre-facts extraction 步骤，并消费 runtime readiness preflight 结果后再尝试 provider facts。
- R3. Pre-facts extraction 必须先读取 canonical readiness artifacts：`.spec-first/graph/provider-status.json`、`.spec-first/graph/graph-facts.json`、`.spec-first/impact/bootstrap-impact-capabilities.json`，并比较 `source_revision`、`worktree_dirty`、`worktree_status_hash` 与当前 repo snapshot；只在 target provider `query_ready=true` 且 snapshot 匹配时判定 graph readiness 为 `graph-fresh`。
- R4. Graph fresh 时，normalized artifacts 先用于验证 provider capability、定位 `normalized_artifacts` 指针、确认 query surface 和做 field inventory；per-symbol、relationship、caller、callee、related-test facts 必须来自符合 fact contract 的 normalized semantic payload、script-callable provider adapter result，或 orchestrator 按 helper query plan 执行的 bounded live MCP query result。Normalized artifact 缺少 semantic payload 不直接触发 bounded direct reads；只有可执行 query 不可用、失败或返回无 usable semantic facts 时才降级。
- R5. Graph stale、provider unavailable、provider query 不可用 / 失败 / 返回无 usable semantic facts 但存在可读 targets 时，helper 做 target-aware bounded direct reads（max 15 targets，按 source/changed-file relevance 排序，提取 heading / changed hunk / symbol / export 周边窗口，而不是固定前 80 行）。
- R6. 无法预读时（无文件路径可提取、读取全部失败、无 query surface 且无 direct-read target），设置空 `{codebase_facts}` block 并标注 output tier 与 reason，不阻塞 dispatch。
- R7. `{codebase_facts}` 作为新变量注入 subagent-template，所有 dispatched agents 共享同一份 facts block；doc-review 使用单 repo entry，code-review 在 multi-repo diff 时必须使用 repo-scoped entries，每个 entry 独立记录 `target_repo`、readiness、tier、reason、targets、omitted targets 和 facts。
- R8. Agent prompt 中必须包含 pre-facts-usage 指令：优先把预注入 facts 用作定向阅读和低风险背景；仅当 facts 与当前 persona lens 相关时使用，非代码 persona 可忽略该 block；任何 P0/P1 或高置信代码判断仍需源码、graph query 或明确降级说明支撑。
- R9. Pre-facts block 必须标注 tier 和 reason，agent 可据此判断是否需要补充验证。
- R10. Pre-facts extraction 失败不阻塞 dispatch；agent 始终保留 Read/Grep/Glob/Bash 工具权限。
- R11. Doc-review 的 fact extraction targets 从文档的 `Sources & References`、`Context & Research`、`Context & Evidence`、`Patterns to follow`、`Files:` / `文件：`、`上下文与依据`、`上下文与研究`、`来源与参考`、`参考资料` 列表中提取；实施单元中的 `**文件：**` / `**Patterns to follow：**` 也必须覆盖。
- R12. Code-review 的 fact extraction targets 从 diff 的 changed files 提取，包括 callers/callees 和 related tests。
- R13. Token budget：doc-review ~4000 tokens，code-review ~6000 tokens；超出时先按 relevance ordering 截断（source-of-truth / changed files / implementation files 优先于 references / tests / docs），并在 block 中列出 omitted targets summary。
- R14. `<codebase-facts>` 必须区分 `readiness` 与 `tier`：`readiness` 取 `graph-fresh` / `graph-stale` / `provider-unavailable` / `no-targets`，`tier` 取 `graph-fresh` / `bounded-reads` / `unavailable` / `no-targets`；当全部读取失败时保留实际 readiness，只把 tier 置为 `unavailable` 并记录具体 reason。
- R15. Coverage section 必须记录 `Pre-facts tier: <tier> (<reason>)`，其中 Coverage 指 orchestrator 最终 review output 的 `Coverage` 小节；code-review multi-repo case 必须记录 per-repo tier 行或明确的 mixed-repo summary。
- R16. Shared base contract 必须定义 pre-facts trust model：按 tier、provenance、source excerpt、line/window 或 symbol anchor、provider freshness 区分哪些判断可由预注入 facts 支撑，哪些判断必须补充 Read/graph query；性能收益目标只适用于 trust model 允许减少重复读取的判断类别。
- R17. Provider fact 产出的每条 fact 必须满足最小 fact contract：包含 `provider`、`query` 或 `target`、artifact/tool source、`source_path`、line/window 或 symbol anchor、readiness、tier、`reason_code` 和 excerpt；provider 只能返回非结构化 narrative 或缺少 provenance 时必须降级为 pointer，并走 bounded direct reads 或 unavailable。
- R18. Pre-facts extraction 的 snapshot hashing、artifact parsing、target extraction、query plan rendering、script-callable provider result normalization、direct-read truncation、omitted-target accounting 和 block rendering 必须由共享只读 helper 执行；helper 通过隐藏的 `spec-first internal review-pre-facts` 入口调用。LLM / workflow prose 只执行 bounded live MCP query（如可用）、把结果交回 helper 验证，并做语义判断。
- R19. 功能验证必须定义轻量 measurement protocol：wall time 起止点、agent read count 统计来源、pre-facts tier 采集位置、findings parity 比较标准，以及 `prompt token delta` 不可得时的降级记录方式。`read_count_unavailable` 时不得声明 read-count target pass，只能声明 wall-time/advisory improvement。
- R20. Code-review pre-facts 默认进入 v1 前必须有 baseline/proceed gate：先持久化 `docs/validation/review-pre-facts/code-review-baseline-YYYY-MM-DD.md`，记录当前 code-review read count、read count source、wall time、findings parity、dirty snapshot behavior、重复读取样本和 runtime readiness behavior。Gate 只有在 read count 可采集、wall time 可比较、至少两个 reviewer 重复读取同一 changed file/caller/test、P0/P1 findings parity 可人工核对、dirty snapshot 行为被记录时才 `passed`；否则记为 `inconclusive`，U4/U5 作为 follow-up 延后，不阻塞 doc-review pre-facts 交付。

## 范围边界

- Pre-facts 是 orchestrator 层的 advisory enrichment，不改变 agent persona 的审查逻辑。
- Graph consumption 规则不变：fresh 时优先，stale 时 advisory，unavailable 时 fallback；readiness facts 不等同于 semantic review facts。
- Scripts/helper 负责确定性 extraction facts：snapshot 比对、artifact inventory、bounded query plan、script-callable provider result normalization、target-aware snippets、budget truncation、omitted-targets summary 和 block rendering；LLM/agents 负责执行可用的 bounded live MCP query、判断 facts 与当前 persona lens 是否相关、是否需要补充验证，以及 finding 是否成立。
- Hidden internal CLI 是 helper 的 runtime boundary：workflow prose 调用 `spec-first internal review-pre-facts ...`，不直接调用 `src/cli/helpers/review-pre-facts.js`，也不依赖 host path rewrite 把 `src/cli/` 投射到 `.agents/skills/` 或 `.claude/spec-first/workflows/`。
- Subagent template 的其他变量（persona、schema、document_content、diff 等）不变。
- 现有 graph-provider-consumption.md 和 graph-evidence-policy.md 的规则不变。
- Agent 的 read-only 约束不变；pre-facts 不授权 agent 写入任何文件。

### Deferred to Follow-Up Work

- Unbounded / ad hoc MCP research 作为 pre-facts 补充源；v1 只允许 bounded provider queries，且必须由 readiness 和 target list 限定。
- Generic MCP client inside helper；v1 live MCP 只由 orchestrator 在 session 中按 query plan 调用，返回结果经 helper 验证后才进入 facts block。
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
- D9. 新增共享只读 helper script，并通过隐藏 internal CLI 暴露，而不是让 runtime workflow 直接引用 `src/cli/helpers/*`。理由：Codex/Claude runtime path rewrite 只处理 `skills/<skill>/...`，package CLI 才是 source checkout、Codex runtime 和 Claude runtime 都可达的边界。
- D10. Provider query 必须落到最小 fact contract，且 helper 不直接调用 live MCP。理由：review prompt 不应依赖 provider narrative 或内部实现细节；live MCP 是 session-local evidence，缺少 provenance 的 query 结果只能作为 pointer，不能作为 pre-facts evidence。
- D11. Code-review pre-facts 先做 baseline/proceed gate，并在 multi-repo diff 中使用 repo-scoped facts entries。理由：code-review 与 doc-review 的 scope authority、dirty snapshot 和跨 repo readiness 边界不同，不能用单一 tier 覆盖所有 repo。
- D12. Measurement protocol 把 read-count pass 与 read-count availability 绑定。理由：如果 host transcript 不暴露 read count，计划只能证明 wall-time 或 reviewer-quality 不退化，不能声称 runtime reads 达标。

## 过度设计防线

### v1 必须完成

- 一个共享 pre-facts extraction base contract、一个共享只读 helper script、一个隐藏 internal CLI command，doc-review 增加薄的 pre-facts extraction 步骤；code-review 先完成 baseline/proceed gate，只有 gate 通过后增加薄的 pre-facts extraction 步骤。
- Subagent template 增加 `{codebase_facts}` 变量和 pre-facts-usage 指令。
- Graph readiness 与 output tier 明确分离，降级路径有 tier 与 reason 标注。
- Graph-fresh 路径先做 normalized artifact field inventory；如果 artifact 没有语义 payload 且 query surface 可用，helper 先产出 bounded query plan，orchestrator 只在当前 session 按计划调用 live MCP 或 script-callable adapter；只有 query 不可用、失败或返回无 usable semantic facts 时才降级到 bounded direct reads。
- Provider facts 满足最小 provenance contract；缺 provenance 的 provider narrative 不进入 graph-fresh facts tier。
- Pre-facts trust model 和 measurement protocol 写入 contract，避免性能收益与高置信验证要求互相抵消。
- Code-review baseline artifact 与 gate 阈值进入 shared contract；multi-repo facts 以 repo-scoped entries 表达，Coverage 支持 per-repo tier 或 mixed summary，但 default path 注入受 baseline gate 控制。
- 契约测试覆盖 pre-facts 相关 prose。
- CHANGELOG.md 更新。

### v1 必须延后

- Per-persona targeted facts。
- Unbounded / ad hoc MCP research。
- Helper 内置 generic MCP client。
- Adaptive token budget。
- Cross-round facts caching。
- Token 消耗度量和报告。
- 无 code-review baseline 时默认扩展 code-review pre-facts。

### 停止条件

实施中如果需要新增 tokenizer 依赖、修改 graph bootstrap 流程、改变 agent persona 的审查逻辑、让 pre-facts 成为 dispatch 的 blocking condition，或需要把 bounded query plan / live MCP query 扩展为开放式代码研究，应停止并回到 plan/doc-review。

## 实施单元

### U1. Pre-facts extraction contract + helper

**目标：** 定义 pre-facts extraction 的 shared base contract，并实现共享只读 helper + hidden internal CLI：canonical graph readiness check、normalized artifact field inventory、bounded query plan、provider fact contract、target-aware direct reads、relevance ordering、trust model、tier/reason output format、measurement protocol 和 Coverage 记录格式。

**需求：** R3, R4, R5, R6, R9, R10, R11, R12, R13, R14, R15, R16, R17, R18, R19

**依赖：** 无

**文件：**
- Create: `docs/contracts/workflows/review-pre-facts-extraction.md`
- Create: `skills/spec-doc-review/references/pre-facts-extraction.md`
- Create: `skills/spec-code-review/references/pre-facts-extraction.md`
- Create: `src/cli/helpers/review-pre-facts.js`
- Create: `src/cli/commands/internal.js`
- Modify: `src/cli/index.js`
- Create: `tests/unit/review-pre-facts-helper.test.js`
- Create: `tests/unit/review-pre-facts-internal-command.test.js`

**Approach：**
- Shared base contract：定义 canonical readiness artifacts、snapshot freshness 比对、readiness state、output tier enum、`<codebase-facts>` block schema、omitted-targets summary、Coverage 行格式。
- Shared base contract：定义 helper CLI modes：`--mode prepare` 产出 `review-pre-facts-query-plan.v1` 与 direct-read candidates；`--mode render --provider-results <path>` 验证 `review-pre-facts-provider-results.v1` 并渲染 `<codebase-facts>`；`--mode one-shot` 在无 provider results 时直接走 bounded direct reads / unavailable。默认 mode 为 `one-shot`，避免 workflow 必须执行 live MCP。
- Shared base contract：要求先通过 provider-status 的 `normalized_artifacts` 指针做 field inventory，记录哪些 artifact 字段可直接消费；当前 artifact 只有 capability/query-surface 时，不得声称已有 semantic facts。
- Shared base contract：graph-fresh 且 query surface 可用时，helper 先产出 bounded query plan；runtime orchestrator 只可按该 plan 调用 live MCP，或让 helper 调用明确注册的 script-callable provider adapter。Normalized artifacts 缺语义 payload 不直接降级，只有 query 不可用、失败或返回无 usable semantic facts 时才降级到 target-aware direct reads。
- Script-callable provider adapter contract：只有显式注册的 adapter 可由 helper 执行，命令输入必须是 `review-pre-facts-query-plan.v1`，输出必须是 `review-pre-facts-provider-results.v1`，每个 provider 默认 timeout 10s，可配置但必须有上限；失败必须输出 reason_code：`provider_adapter_unavailable`、`provider_query_timeout`、`provider_query_failed`、`provider_result_invalid` 或 `provider_result_no_usable_facts`。
- Shared base contract：定义最小 provider fact contract；每条 fact 必须携带 provider、query/target、source_path、line/window 或 symbol anchor、readiness/tier、reason_code、excerpt 和 provenance source。Provider 只能返回 narrative 或 provenance 不完整时，helper 将其视为 pointer 并降级到 bounded direct reads 或 unavailable。
- Shared base contract：定义 pre-facts trust model；只有带 excerpt + path/line/window/symbol anchor 且 freshness 匹配的 facts 可支撑低风险背景或定向阅读。P0/P1 或高置信代码判断若只依赖 pre-facts，必须满足 trust model；否则补充 Read/graph query 或在 finding 中降级说明。
- Shared helper：只读读取 readiness artifacts、当前 repo snapshot、provider normalized pointers 和 targets；执行 field inventory、query plan rendering、optional provider result normalization、target-aware direct reads、relevance truncation、omitted-target summary 和 `<codebase-facts>` block rendering。Helper 只产出 facts，不决定 reviewer 结论、不选择 persona、不阻塞 dispatch、不直接调用 live MCP。
- Hidden internal CLI：`spec-first internal review-pre-facts` 不出现在 `--help` 用户命令列表中；source checkout 可用 `node bin/spec-first.js internal review-pre-facts ...` 调用，installed Codex/Claude runtime 可用 `spec-first internal review-pre-facts ...` 调用。Workflow prose 只能调用 CLI 入口，不能直接调用 helper source path。
- Doc-review 薄 reference：只定义从文档 `Sources & References`、`Context & Research`、`Context & Evidence`、`Patterns to follow`、`Files:` / `文件：`、`上下文与依据`、`上下文与研究`、`来源与参考`、`参考资料` 列表，以及实施单元 `**文件：**` / `**Patterns to follow：**` 提取 targets 的规则。
- Code-review 薄 reference：只定义从 changed files、callers/callees 和 related tests 提取 targets 的规则；multi-repo diff 必须输出 repo-scoped entries，并明确 staged/unstaged dirty snapshot freshness 如何进入每个 repo entry 的 readiness reason。

**Patterns to follow：**
- `docs/contracts/graph-provider-consumption.md` 中 canonical artifacts、forbidden compatibility reads 和 readiness truth table。
- `skills/spec-plan/SKILL.md` 中 Graph Readiness 消费模式，但补齐 `worktree_status_hash` 比对。
- `docs/10-prompt/结构化项目角色契约.md` 中 Scripts prepare, LLM decides 的职责边界。

**Test scenarios：**
- Shared contract 定义 readiness state 与 output tier 两套枚举，且不混用。
- Shared contract 要求读取 provider-status、graph-facts、impact-capabilities 并比较 `source_revision`、`worktree_dirty`、`worktree_status_hash`。
- Shared contract 明确 normalized artifacts 可作为 capability/query-surface pointer，但不能无 inventory 地声明 semantic facts。
- Helper 测试覆盖 snapshot mismatch、query plan rendering、provider result provenance 缺失、query failure、target-aware snippets、budget truncation 和 omitted-targets summary。
- Helper 测试覆盖 `prepare` / `render` / `one-shot` modes、query-plan schema、provider-results schema、provider timeout/failure reason_code 和 invalid-result fallback。
- Internal command tests 覆盖 `spec-first internal review-pre-facts` 可调用、只读、不出现在 public help、source checkout 与 installed runtime 调用文案一致。
- Shared contract 定义 pre-facts trust model，并说明哪些 facts 可支撑低风险背景、哪些需要补充验证。
- Shared contract 定义 provider fact contract，缺 provenance 时不能进入 graph-fresh facts tier。
- Contract 文档明确 pre-facts 是 advisory，不是 hard gate。
- Contract 文档定义 token budget、relevance ordering、omitted-targets summary 和 target-aware bounding rules。
- Contract 文档定义 Coverage 行：`Pre-facts tier: <tier> (<reason>)`。

**Verification：**
- `npx jest tests/unit/review-pre-facts-helper.test.js --runInBand`
- `npx jest tests/unit/review-pre-facts-internal-command.test.js --runInBand`
- `npm run test:unit` 或 targeted contract tests。

---

### U2. doc-review SKILL.md 增加 Phase 1b

**目标：** 在文档分析和 dispatch 之间插入 pre-facts extraction 步骤。

**需求：** R1, R3, R6, R9, R10, R11, R13, R14, R15, R16, R18, R19

**依赖：** U1

**文件：**
- Modify: `skills/spec-doc-review/SKILL.md`
- Modify: `tests/unit/spec-doc-review-contracts.test.js`

**Approach：**
- 在 Phase 1（Get and Analyze Document）和 Phase 2（Announce and Dispatch）之间插入 Phase 1b。
- Phase 1b 读取 shared base contract 和 doc-review reference，调用 `spec-first internal review-pre-facts` 执行 graph readiness check、field inventory、query plan / target-aware direct reads，并格式化为 `<codebase-facts>` block；若 helper 返回 bounded live MCP query plan 且当前 host 暴露相应 MCP tool，orchestrator 可按 plan 执行查询并把结果交回 helper 验证渲染，否则直接使用 helper 的 bounded-reads / unavailable 输出。
- 记录 `Pre-facts tier: <tier> (<reason>)` 到最终 review output 的 Coverage section。

**Test scenarios：**
- SKILL.md 包含 Phase 1b pre-facts extraction 描述。
- Phase 1b 在 Phase 1 之后、Phase 2 之前。
- Pre-facts 描述为 advisory evidence，不阻塞 dispatch。
- Phase 1b 不直接引用 `src/cli/helpers/*`，并说明 source checkout、Codex runtime、Claude runtime 的 CLI 调用路径。
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

### U4a. code-review baseline / proceed gate

**目标：** 在修改 code-review 默认路径前取得自身基线，避免未验证收益拖慢 doc-review pre-facts 交付。

**需求：** R19, R20

**依赖：** U1

**文件：**
- Modify: `docs/contracts/workflows/review-pre-facts-extraction.md`
- Create: `docs/validation/review-pre-facts/code-review-baseline-YYYY-MM-DD.md`
- Modify: `tests/unit/spec-code-review-contracts.test.js`

**Approach：**
- 在 shared contract 中定义 code-review baseline/proceed gate，并把实际基线写入 `docs/validation/review-pre-facts/code-review-baseline-YYYY-MM-DD.md`：记录 target diff、repo snapshot、read count source、read count、wall time source、wall time、repeated-read samples、P0/P1 findings parity 方法、dirty snapshot behavior 和 existing runtime readiness behavior。
- Gate `passed` 条件：read count source 可采集且 baseline 有数字；wall time source 可比较；至少两个 reviewers 重复读取同一 changed file/caller/test；P0/P1 findings parity 可人工核对；dirty snapshot behavior 已记录；baseline artifact 路径写入 Coverage 或 validation summary。
- 任一条件不满足时标记 `Code-review pre-facts baseline: inconclusive (<reason>)`，U4/U5 作为 follow-up 延后；doc-review U2/U3 仍可继续交付。
- 如果 baseline 通过，进入 U4/U5，并在 Coverage 中标注 `Code-review pre-facts baseline: passed (<reason>)`。

**Test scenarios：**
- Contract tests 覆盖 code-review baseline gate 文案。
- 未通过 baseline 时，计划允许 doc-review pre-facts 独立交付，不要求同时修改 code-review。
- Baseline 通过后才允许 code-review default path 注入 pre-facts。
- `read_count_unavailable` 只能让 gate 进入 `inconclusive`，不得声明 code-review read-count target pass。

**Verification：**
- `npx jest tests/unit/spec-code-review-contracts.test.js --runInBand`

---

### U4. code-review SKILL.md 增加 Stage 4a

**目标：** 仅在 U4a baseline/proceed gate 通过后，在 Runtime readiness preflight 之后、dispatch/spawn 之前插入 pre-facts extraction 步骤。

**需求：** R2, R3, R6, R9, R10, R12, R13, R14, R15, R16, R17, R18, R19, R20

**依赖：** U1, U4a

**文件：**
- Modify: `skills/spec-code-review/SKILL.md`
- Modify: `tests/unit/spec-code-review-contracts.test.js`

**Approach：**
- 只有 U4a 记录 `Code-review pre-facts baseline: passed` 后，才在 Stage 4 的 Runtime readiness preflight 之后、Dispatch capability gate / Spawning 之前插入 Stage 4a；若 baseline 为 `inconclusive`，本单元延后。
- Stage 4a 消费 runtime readiness preflight 结果；若 required MCP/server startup 已降级或不可用，直接按 provider-unavailable / bounded-reads / unavailable path 处理，不重复探测同一失败 provider。
- Stage 4a 调用 `spec-first internal review-pre-facts`，从 changed files 提取 targets，按 clean/staged/unstaged snapshot 记录 freshness reason；helper 先产出 query plan 或 bounded direct reads。若当前 host 暴露相应 MCP tool，orchestrator 只按 query plan 执行 bounded live MCP query，并把结果交回 helper 验证渲染；helper 不直接调用 live MCP。
- Multi-repo diff 输出 repo-scoped entries；每个 repo entry 独立记录 readiness、tier、reason、targets、omitted targets 和 facts。
- 记录 `Pre-facts tier: <tier> (<reason>)` 到最终 review output 的 Coverage section；multi-repo case 使用 per-repo tier lines 或 mixed summary。

**Test scenarios：**
- SKILL.md 包含 Stage 4a pre-facts extraction 描述。
- Stage 4a 在 Runtime readiness preflight 之后、Dispatch capability gate / Spawning 之前。
- Stage 4a 消费 preflight 结果，不在 preflight 之前发起 provider query。
- Stage 4a 只有在 U4a baseline gate `passed` 后才进入 default path；`inconclusive` 时 U4/U5 延后。
- Pre-facts 不替代 diff scope rules。
- 降级路径明确，并覆盖 clean/staged/unstaged dirty diff review case。
- Multi-repo diff 下 Coverage 支持 per-repo tier 或 mixed summary。
- Contract tests 覆盖 Coverage 行格式与 readiness/tier 枚举分离。

**Verification：**
- `npx jest tests/unit/spec-code-review-contracts.test.js --runInBand`

---

### U5. code-review subagent-template.md 增加 {codebase_facts}

**目标：** 让 code-review dispatched agents 收到预编译的代码库事实。

**需求：** R7, R8, R9

**依赖：** U1, U4a, U4

**文件：**
- Modify: `skills/spec-code-review/references/subagent-template.md`
- Modify: `tests/unit/spec-code-review-contracts.test.js`

**Approach：**
- 与 U3 相同模式：在 review-context 中增加 `{codebase_facts}` 变量，在 output-contract 中增加 pre-facts-usage 指令；指令必须说明 pre-facts 不替代 diff scope rules、changed-file ownership、repo-scoped evidence boundary 或 reviewer 的直接验证。

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

**依赖：** U1-U3 与 U4a；U4/U5 仅在 U4a baseline/proceed gate 通过时纳入当前 v1，否则记录为 follow-up。

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
| canonical artifacts 存在，target provider `query_ready=true`，`source_revision`、`worktree_dirty`、`worktree_status_hash` 与当前 snapshot 匹配 | 有可提取 targets，normalized artifact 或 provider result 已满足 fact contract | helper 做 field inventory / provider result normalization 后消费 semantic facts | `<codebase-facts readiness="graph-fresh" tier="graph-fresh" reason="provider-fact">` |
| graph fresh 且 normalized artifact 无语义 payload | 有可提取 targets，provider query surface 可用 | helper 产出 bounded query plan；orchestrator 只按 plan 执行 live MCP query，或 helper 调用已注册 script-callable adapter；结果经 helper 验证满足 fact contract 后进入 graph-fresh tier | `<codebase-facts readiness="graph-fresh" tier="graph-fresh" reason="provider-query-plan">` |
| graph stale / dirty hash mismatch / provider unavailable / provider query 不可用 / query 失败 / query 返回无 usable semantic facts | 有可读 targets | helper 做 target-aware bounded direct reads：source-of-truth 和 changed files 优先，提取 heading、changed hunk、symbol、export、nearby tests 周边窗口，max 15 targets | `<codebase-facts readiness="<actual-readiness>" tier="bounded-reads" reason="...">` |
| 任意 readiness | 文档/diff 中没有可提取路径 | 不做预读 | `<codebase-facts readiness="no-targets" tier="no-targets" reason="no extraction targets">` 空 block |
| 任意 readiness | targets 全部读取失败且无可用 query surface | 不做预读，agent 自己读；保留实际 readiness，只把输出 tier 置为 unavailable | `<codebase-facts readiness="<actual-readiness>" tier="unavailable" reason="all pre-reads failed">` 空 block |

**关键约束：**
- Pre-facts extraction 失败不阻塞 dispatch。
- Agent 始终保留 Read/Grep/Glob/Bash 工具权限。
- Pre-facts 同时标记 readiness、tier 和 reason，agent 可据此判断是否需要补充验证。
- Graph stale、bounded-reads、provider-unavailable 和 no-targets 都是 advisory；P0/P1 或高置信代码判断必须 re-verify 或在 finding 中明确降级。
- Code-review 的 dirty worktree 必须比较 dirty snapshot identity；若 graph bootstrap 不是同一 dirty snapshot，不能标记为 `graph-fresh`。
- Code-review multi-repo case 中，上表按 repo entry 独立应用；一个 repo 的 graph-fresh 不得提升另一个 repo 的 stale / unavailable entry。
- Pre-facts helper 失败、live MCP 未按 query plan 执行、或 provider narrative 缺少 provenance 时，不得伪造 graph-fresh semantic facts；只能输出 pointer、bounded-reads 或 unavailable tier。

## Pre-facts Trust Model

| Fact 条件 | 可用于 | 仍需补充验证 |
|------|------|------|
| `tier="graph-fresh"`，fact 满足 provider fact contract，包含 provider、target/query、source_path、line/window 或 symbol anchor、reason_code、excerpt，且 snapshot 匹配；live MCP result 仅作为本 session evidence | 低风险背景、定向阅读、P2/P3 技术 finding 的 supporting evidence | P0/P1 或高置信代码 judgment 仍需源码 excerpt、graph query evidence 或 finding 中的降级说明 |
| `tier="bounded-reads"`，fact 来自 target-aware direct reads，包含 source_path、line/window 或 heading/symbol anchor、excerpt | 定向阅读、局部代码事实、减少重复 file reads | 跨文件 caller/callee、related-test、impact claim 需要补充 graph query 或 direct source reads |
| `tier="unavailable"` / `no-targets` 或缺 provenance 的 provider narrative | 只作为 degraded status / pointer | 不得作为代码事实支撑 finding；agent 正常使用工具验证 |

Trust model 是 agent prompt 指令的一部分，但由 shared helper 输出 provenance fields 支撑。性能目标只适用于 trust model 允许复用 pre-facts 的判断类别；不要求 reviewer 为 P0/P1 放弃必要验证。

## 预期效果

| 场景 | 当前耗时 | 优化后目标 | 原因 / 门槛 |
|------|---------|-----------|------|
| doc-review feasibility (graph fresh + provider facts usable) | 114s (19 reads) | read count source 可用时 runtime reads 降低 ≥70%，总耗时降低 ≥30% | Facts 预注入，agent 只做补充验证；read count 不可得时只声明 wall-time / advisory improvement |
| doc-review feasibility (bounded-reads) | 114s (19 reads) | read count source 可用时 runtime reads 降低 ≥40%，总耗时不退化 | Target-aware snippets 预读，少量补充；read count 不可得时不声明 read-count target pass |
| doc-review feasibility (unavailable/no-targets) | 114s (19 reads) | 不退化 | 完全降级，保持当前行为 |
| code-review baseline gate | 待采集 | `passed` 或 `inconclusive`，决定 U4/U5 是否进入 v1 default path | 先持久化 baseline artifact，记录 read count、wall time、findings parity、dirty snapshot behavior、repeated-read samples |
| code-review clean/staged snapshot matches graph | baseline 通过后启用 | read count source 可用时 runtime reads 降低 ≥50%，findings parity 通过 | Provider facts / related tests 预注入；read count 不可得时 gate 不得 pass |
| code-review dirty snapshot mismatch | baseline 通过后启用 | 只声明 bounded-reads 收益，不声明 graph-fresh 收益 | Dirty worktree 不能误标 graph-fresh |

## System-Wide Impact

- **Interaction graph：** orchestrator 在 dispatch 前调用 `spec-first internal review-pre-facts`，helper 消费 `.spec-first/graph/`、`.spec-first/impact/` 和 `.spec-first/providers/` artifacts 判断 readiness/query surface，产出 query plan、normalized provider facts 或 bounded direct-read facts 后注入 dispatched agents。Live MCP query 仅由 orchestrator 按 query plan 在当前 session 执行，结果必须交回 helper 验证。Code-review 先消费 Stage 4 runtime readiness preflight 和 U4a baseline gate 结果，再决定是否进入 pre-facts extraction。
- **Error propagation：** pre-facts extraction 失败是 silent degradation，不是 workflow failure。
- **State lifecycle：** 不引入新的 durable runtime state；pre-facts 是 session-scoped，不持久化。Code-review baseline gate 允许创建 `docs/validation/review-pre-facts/code-review-baseline-YYYY-MM-DD.md` 作为人工可审计 validation artifact。Measurement protocol 只读取当前 run transcript / reviewer returns / helper output，不新增长期计量平台。
- **API surface：** subagent template 增加一个 optional 变量；空 block 等同于当前行为。
- **Graph dependency：** 不新增 bootstrap/index 依赖；graph unavailable 或 dirty-stale 时降级到 bounded direct reads 或空 block。
- **Unchanged invariants：** agent persona 逻辑不变；findings schema 不变；synthesis pipeline 不变；graph-evidence-policy 不变。

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| Pre-facts 过时导致 agent 基于错误事实审查 | Readiness + tier + reason + provenance 标注；trust model 要求 P0/P1 或高置信代码 finding re-verify 或降级说明 |
| Token budget 不够覆盖关键 facts | Relevance ordering：source-of-truth / changed files / implementation files 优先；输出 omitted-targets summary |
| Pre-facts extraction 本身耗时过长 | Bounded: max 15 targets；query plan、live MCP query 和 direct reads 都必须有 target list，不做开放式研究 |
| Agent 忽略 pre-facts 仍然做大量 runtime reads | Pre-facts-usage 指令要求优先用于定向阅读；验证策略用 read-count 和 wall-time gate 检查收益 |
| Agent 被无关 shared facts 锚定 | Persona relevance boundary：非代码 persona 可忽略 pre-facts，不得用 pre-facts 替代自身 lens 判断 |
| Graph artifacts 格式变化导致 extraction 失败 | Field inventory 失败则 silent fallback 到 bounded reads 或 unavailable，并在 Coverage 记录 tier/reason |
| Provider result narrative 缺 provenance | 最小 fact contract 要求 source_path、line/window 或 symbol anchor、excerpt；缺失则降级为 pointer / bounded-reads |
| Helper 在 runtime 中不可达 | 通过 hidden package CLI 暴露，不直接引用 `src/cli/helpers/*`；contract tests 覆盖 source checkout 与 installed runtime 调用文案 |
| Read count source 不可得却误判性能目标 | Measurement protocol 明确 `read_count_unavailable` 不能 pass read-count target，只能记录 wall-time/advisory improvement |
| Code-review 多 repo readiness 混淆 | Code-review facts block 使用 repo-scoped entries，Coverage per-repo tier 或 mixed summary |
| Code-review 收益未验证导致 v1 过宽 | U4a baseline/proceed gate；未通过时 U4/U5 延后，不阻塞 doc-review pre-facts |

## Measurement Protocol

- Wall time：从 orchestrator 完成 Phase 1 / Stage 1 scope 分析后、pre-facts extraction 开始前计时，到 synthesis 完成前停止；同时记录 pre-facts helper 自身耗时。
- Agent read count：优先从 host transcript / reviewer tool summaries 统计 Read/Grep/Glob/Bash 文件读取调用；不可得时记录 `read_count_unavailable`，不编造数字，且不得声明 read-count target pass。
- Pre-facts tier：从 helper 输出和最终 Coverage 行采集；code-review multi-repo case 记录 per-repo tier。
- Findings parity：对比 pre-facts 模式与当前模式的 P0/P1 findings 是否丢失、P2+ 是否出现明显质量退化；若 read count 降低但 P0/P1 丢失，视为失败。
- Prompt token delta：仅当 host 或 transcript 已直接提供 token usage 时记录；不可得时记录 `prompt_token_delta_unavailable`，不要求新增 tokenizer 依赖或计量平台。

## 验证策略

最小验证：
- `npx jest tests/unit/review-pre-facts-helper.test.js --runInBand`
- `npx jest tests/unit/review-pre-facts-internal-command.test.js --runInBand`
- `npx jest tests/unit/spec-doc-review-contracts.test.js --runInBand`
- `npx jest tests/unit/spec-code-review-contracts.test.js --runInBand`
- `npx jest tests/unit/changelog-format.test.js --runInBand`
- `npm run typecheck`
- `git diff --check`

功能验证：
- 对同一份 plan 文档在 graph-fresh 条件下运行 `spec-doc-review`，按 Measurement Protocol 记录 wall time、agent read count、pre-facts tier、可选 prompt token delta 和 findings parity；read count source 可用时目标是 runtime reads 降低 ≥70%，总耗时降低 ≥30%，且 synthesized findings 无明显质量损失；read count source 不可得时只评价 wall-time、tier 与 findings parity。
- 先执行 code-review baseline/proceed gate，并生成 `docs/validation/review-pre-facts/code-review-baseline-YYYY-MM-DD.md`；通过后再对同一份 code-review diff 分别覆盖 clean/staged snapshot match 与 dirty snapshot mismatch，按 Measurement Protocol 记录 wall time、agent read count、pre-facts tier、可选 prompt token delta 和 findings parity；dirty mismatch 不得标记为 `graph-fresh`。未通过或 `read_count_unavailable` 时，U4/U5 延后为 follow-up。
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
- Runtime path rewrite evidence：`src/cli/adapters/codex.js` 与 `src/cli/adapters/claude.js` 的 `rewriteSourceSkillRuntimePaths()` 只重写 `skills/<skill>/...`，不投射 `src/cli/helpers/*`；因此 helper 必须通过 package CLI internal command 暴露。

## Handoff

推荐下一步：

```text
$spec-doc-review docs/plans/2026-05-11-007-feat-review-pre-facts-injection-plan.md
```

审查通过后进入执行：

```text
$spec-work docs/plans/2026-05-11-007-feat-review-pre-facts-injection-plan.md
```
