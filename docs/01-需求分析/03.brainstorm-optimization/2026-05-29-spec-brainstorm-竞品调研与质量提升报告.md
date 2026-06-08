---
date: 2026-05-29
author: leokuang
topic: spec-brainstorm-competitive-research
type: analysis-report
status: completed
scope: docs-only
source_refs:
  - skills/spec-brainstorm/SKILL.md
  - skills/spec-brainstorm/references/requirements-capture.md
  - skills/spec-brainstorm/references/synthesis-summary.md
  - skills/spec-brainstorm/references/handoff.md
  - docs/01-需求分析/brainstorm优化/spec-brainstorm-能力升级方案.md
  - docs/10-prompt/结构化项目角色契约.md
external_refs:
  - https://github.com/obra/superpowers/blob/main/skills/brainstorming/SKILL.md
  - https://github.com/bmad-code-org/BMAD-METHOD/tree/main/src/core-skills/bmad-brainstorming
  - https://github.com/SuperClaude-Org/SuperClaude_Framework
  - https://github.com/snarktank/ai-dev-tasks
  - https://github.com/anombyte93/prd-taskmaster
  - https://github.com/eyaltoledano/claude-task-master
  - https://github.com/github/spec-kit
  - https://kiro.dev/docs/specs/
  - https://github.com/Fission-AI/OpenSpec
  - https://github.com/buildermethods/agent-os
  - https://github.com/tomasmihalyi/living-spec-skill
  - https://github.com/raylenmargono/prd-generator
---

# spec-brainstorm 竞品调研与质量提升报告

## 0. Owner 结论

`spec-brainstorm` 当前方向是对的：它不是一个“多给几个点子”的 prompt，而是 `Codebase -> Graph -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge` 链路里负责把 WHAT 说清楚的前置治理层。对比 Superpowers、BMAD、SuperClaude、AI Dev Tasks、Task Master、GitHub Spec Kit、Kiro、OpenSpec、Agent OS、Living Spec 和 prd-generator 后，真正的差距不在“技巧数量”或“模板丰满度”，而在三个质量机制：

1. **Requirements quality gate 不够正式。** 当前已有 finalization checklist，但它更像收尾自检；还缺一个命名清晰、可复用、可评估的 requirements 质量门，专门检查歧义、可测试性、行为边界、证据等级和 planning invention risk。
2. **Traceability 还不够系统。** 当前有 R/A/F/AE ID 和 synthesis buckets，但 problem frame、actor、flow、requirement、acceptance example、success criteria、scope boundary、handoff 之间的覆盖关系仍主要依赖 LLM 语义纪律。
3. **分层模式不够显式。** Lightweight / Standard / Deep 已存在，但还可以更清楚地区分“快速对齐”“标准需求捕获”“深度产品塑形”“技术/架构 brainstorm”四种执行姿态，避免同一个流程在小任务中过重、在大任务中过轻。

推荐的最小高价值路线是：**新增 requirements quality gate reference，强化 requirements-capture finalization checklist，引入可选 EARS-style acceptance 写法，补 Phase 1.1 standards/reference scan，增加轻量 technique palette，并用 fresh-source eval fixtures 守住 prompt/prose 行为。**

本报告只是调研与 owner 判断文档，不修改 `skills/spec-brainstorm/`，也不修改 `.claude/`、`.codex/`、`.agents/skills/` 等 generated runtime mirror。

---

## 1. 证据边界

**本地 source evidence**

- `skills/spec-brainstorm/SKILL.md`：确认当前 workflow contract、Interaction Rules、scope 分层、Phase 1.1 context scan、Phase 1.2 product pressure test、Phase 2 approach exploration、Phase 2.5 synthesis、Phase 3 requirements capture 的边界。
- `skills/spec-brainstorm/references/requirements-capture.md`：确认现有 requirements doc section matrix、R/A/F/AE ID、acceptance examples、finalization checklist、spec_id 规则。
- `skills/spec-brainstorm/references/synthesis-summary.md`：确认 Stated / Inferred / Out of scope 的 synthesis checkpoint。
- `docs/01-需求分析/brainstorm优化/spec-brainstorm-能力升级方案.md`：确认 2026-04-17 已有方案已覆盖 Superpowers、ce-brainstorm 方向上的 decomposition、分节确认、用户本人 review gate、terminal state lock、context pulse、preflight self-check 等建议。
- `docs/10-prompt/结构化项目角色契约.md`：作为本次判断的 source-of-truth，约束本报告必须服务 light contract、explicit boundaries、scripts prepare / LLM decides。

**Graph evidence**

- `.spec-first/graph/graph-facts.json` 显示 `capabilities.query_global_graph=true` 且 primary provider 包含 `gitnexus`，但当前 `freshness_state=dirty-advisory`，且 `impact_context_status=unavailable`，只适合作为 definitions-only orientation。
- 本次 GitNexus query 对 `spec-brainstorm` 返回的主要是弱相关 code pointers，因此本报告不声称有 graph-backed impact evidence；实际结论以直接读取 source files 和外部公开材料为准。

**外部 comparison evidence**

外部材料均作为竞品/同类 workflow 参考，不作为 spec-first 的 source-of-truth。它们能提供可借鉴机制，但不能替代本仓库的角色契约、source/runtime 边界和下游 workflow contract。

---

## 2. 当前 spec-brainstorm 基线

`spec-brainstorm` 已经有几个强项，不能在“吸收竞品”时被破坏。

**WHAT before HOW**

当前 skill 明确把 brainstorm 定义为回答 WHAT 的 workflow，把 implementation、schema、endpoint、file layout、library choice 等细节默认留给 `spec-plan`。这比很多 PRD generator 更接近 spec-first 的核心边界：先把用户价值、行为、范围和成功标准稳定下来，再让 planning 处理 HOW。

**Right-sized requirements**

当前 requirements capture 已按 Lightweight / Standard / Deep-feature / Deep-product 分层，避免所有任务都进入重 PRD。这个方向优于“一律完整 PRD + design + tasks”的工具，因为 spec-first 面向的是日常 AI coding harness，不是单一大型项目管理系统。

**One-question-at-a-time**

当前 Interaction Rules 强制一次只问一个问题，并优先用 blocking question tool。这一点非常重要：它把 brainstorm 从“问卷式提需求”拉回 collaborative dialogue，减少用户同时处理多个抽象问题的负担。

**Product rigor probes**

当前 Phase 1.2 已有 evidence / specificity / counterfactual / attachment / durability 等产品压力测试。竞品里不少工具能生成漂亮 PRD，但很少明确要求 agent 在进入方案前挑战“这个需求是否真的成立”。

**Phase 2.5 synthesis**

当前 synthesis summary 用 Stated / Inferred / Out of scope 做落盘前校准，这是非常符合 spec-first 的机制：让 LLM 的推断显性化，不把 agent inference 伪装成用户确认过的事实。

**Requirements template with IDs**

现有 `requirements-capture.md` 支持 R/A/F/AE ID、acceptance examples、success criteria、scope boundaries、outstanding questions 和 spec_id。这为下游 plan/task traceability 打了基础。

**已有本地升级方案**

2026-04-17 的 `spec-brainstorm-能力升级方案.md` 已经把 Superpowers 的若干强项转译为 spec-first 语境，包括 scope decomposition、requirements 分节确认、用户本人 review gate、terminal state lock、context pulse 和 preflight self-check。本次报告不重复立项这些内容，而是补全更宽竞品视角下的新缺口。

---

## 3. 竞品矩阵

| 竞品 / 同类 workflow | 最值得看的机制 | 对 spec-brainstorm 的启发 | 不能照搬的部分 |
|---|---|---|---|
| Superpowers brainstorming | 需求未对齐前不进入 implementation、上下文扫描、用户 review、严格出口 | 保留 hard gate 意图；继续强化 “brainstorm 只负责 WHAT” 的 terminal boundary | 不复制单一出口、强制 commit、强任务系统绑定 |
| BMAD `bmad-brainstorming` | 技法库、发散/收敛节奏、引导式 ideation | 可抽一个轻量 technique palette，在 Phase 2 需要非显然替代方案时使用 | 不把 100+ techniques 变成默认流程；不让技巧库盖过产品判断 |
| SuperClaude `/sc:brainstorm` | 把 brainstorming 当成命令 + mode，强调发散、探索、Socratic dialogue | 可以借鉴 “模式姿态” 的显式化，让用户知道当前是探索、收敛还是文档化 | 不变成通用 prompt collection；不把 persona/mode 数量当质量 |
| AI Dev Tasks | PRD → task list 的手工但清晰链路，可读、可执行 | 借鉴 agent-ready PRD 和 downstream taskability 的思路 | 不让 brainstorm 直接承担 task generation；task 属于 plan/tasks 层 |
| Task Master / prd-taskmaster | PRD 驱动任务拆分、依赖、复杂度分析、执行代理友好 | 强化 requirement 到 task 的 traceability 心智 | 不把 spec-brainstorm 绑定到某个任务数据库或任务 CLI |
| GitHub Spec Kit | `/specify`、`/clarify`、`/analyze`、spec template 和 checklist，强调 ambiguity analysis | 最值得借鉴的是 clarify/analyze 前置质量门和 ambiguity checklist | 不复制完整 command suite；spec-first 已有自己的 workflow 链路 |
| Kiro Specs | Requirements / Design / Tasks 三段式；requirements analysis；EARS-style acceptance | 最值得借鉴的是 requirements quality analysis 与 acceptance 语法纪律 | 不强制每次 brainstorm 都产 design/tasks；那会侵入 plan/work 边界 |
| OpenSpec | 轻量 spec/change/task artifact，强调 collaboration 和 proposal | 与 light contract 接近，可借鉴 artifact 轻量化和 change intent 表达 | 不引入另一套中心化 spec engine 或 schema-heavy 状态机 |
| Agent OS `shape-spec` | 先读 standards、reference docs、similar implementations，再塑形 spec | Phase 1.1 可补 product standards / reference implementation scan | 不让 brainstorm 过早下沉到实现设计；source scan 只服务 WHAT 的边界和先例 |
| Living Spec Skill | 让 spec 成为持续更新的协作 artifact，强调同步和可追溯 | 可借鉴 living traceability 与持续校准思想 | 不把 brainstorm 文档变成长期状态机；后续变化应由 plan/work/compound 链路承接 |
| prd-generator | 面向 agent implementation 的 PRD 结构、用户故事、验收标准 | 借鉴 “planning 不需要发明行为” 的输出标准 | 不把 PRD 章节堆满；spec-first 更需要 right-size |

---

## 4. 横向发现

### 4.1 成熟竞品都在补同一个洞：requirements 质量不是模板问题

Kiro、Spec Kit、AI Dev Tasks、Task Master 的共同点不是“文档更长”，而是它们都试图让需求在进入任务前变得更可执行：歧义要被标出，验收要能落到行为，任务拆分要有稳定来源。`spec-brainstorm` 目前也在做这件事，但质量机制仍偏隐性，主要散落在 finalization checklist 和 LLM workflow prose 中。

Owner 判断：下一步不应先加更多 sections，而应把现有 sections 之间的质量关系显性化。好的 gate 应该回答：如果现在交给 `spec-plan`，它还需要发明什么？

### 4.2 最强借鉴对象是 Kiro / Spec Kit，不是 ideation prompt 库

BMAD 和 SuperClaude 对“怎么想出更多方向”有价值，但 `spec-brainstorm` 当前的主要瓶颈不是缺发散，而是缺更硬的 requirement readiness 判断。Kiro 的 requirements analysis 和 Spec Kit 的 clarify/analyze 更接近 spec-first 的核心增益：在进入 HOW 之前降低歧义。

Owner 判断：Phase 2 可以变得更聪明，但 Phase 3 的 quality gate 更紧急。

### 4.3 Task-oriented 工具的价值在 traceability，不在把 task 系统前移

AI Dev Tasks、Task Master、prd-taskmaster 的优势是让 PRD 很快变成 agent 可执行任务。但 spec-first 已经有 `spec-plan`、task-pack、`spec-work` 等后续链路，把 task generation 提前塞进 brainstorm 会破坏 ownership 边界。

Owner 判断：应该吸收它们的 traceability 心智，而不是吸收它们的任务系统。

### 4.4 Lightweight artifact 是优势，不是缺陷

OpenSpec、Agent OS、Living Spec 都说明一个趋势：AI coding 需要 artifact，但 artifact 不能太重，否则用户不会持续使用。`spec-brainstorm` 的 right-sized requirements 是优势，应继续守住。质量提升应通过 checklist、trace links、acceptance examples、eval fixtures 这种轻机制完成，而不是引入大 schema 或中心化流程引擎。

### 4.5 External reference scan 应服务 scope，不应 back-drive implementation

Agent OS 的 standards/reference scan 值得借鉴，但在 `spec-brainstorm` 中必须保持边界：看 standards、相似实现和既有文档，是为了避免重复造轮子、确认产品约束、识别既有行为；不是为了在 brainstorm 阶段决定 schema、endpoint、类名或文件布局。

---

## 5. Gap 分析

| Gap | 严重度 | 当前表现 | 影响 | 推荐补法 |
|---|---|---|---|---|
| Requirements quality gate 不成体系 | P0 | finalization checklist 已有，但没有命名 gate、没有 ambiguity/readiness 分级、没有 planning invention risk 结果 | 下游 plan 仍可能补写产品行为；review 难以判断文档是否 ready | 新增 `references/requirements-quality-gate.md`，Phase 3 finalization 显式调用 |
| Traceability 不够系统 | P0 | R/A/F/AE ID 已有，但 success criteria、scope boundaries、key decisions、handoff 与 R-ID 的关系不稳定 | task/plan/review 难回溯某行为为什么存在 | 在 requirements capture 增加 optional traceability map 或 coverage checklist |
| Acceptance example 语法纪律不足 | P1 | AE 已存在，但何时用 Given/When/Then、If/When 条件如何覆盖还不够明确 | 条件行为容易留在模糊 prose 里 | 引入 optional EARS-style acceptance guidance，触发而非强制 |
| 分层执行姿态不够显式 | P1 | Lightweight/Standard/Deep 有，但用户和 agent 不一定能感知当前为何轻/重 | 小任务可能过重，大任务可能漏问 | 在 Phase 0.3 输出内部 mode decision，并在文档中记录 right-size rationale |
| Reference / standards scan 不完整 | P1 | Phase 1.1 已有 topic scan，但对 standards、reference implementation、industry prior 的触发不够明确 | 容易错过本仓库已有决策或竞品成熟惯例 | Standard/Deep 增加 product standards / reference implementation / external prior scan 触发规则 |
| Ideation technique 选择偏隐性 | P2 | Phase 2 要求至少一个非显然角度，但没有具体 technique menu | agent 可能只给 baseline 的轻微变体 | 增加 6-8 个轻量 technique palette，只在 Phase 2 卡住或深度 brainstorm 使用 |
| Fresh-source eval fixture 缺口 | P2 | prose 变更主要靠阅读和人工 review | skill 行为漂移难验证，尤其宿主会缓存 skill | 增加 eval fixtures：small clear request、vague product、technical architecture、over-scoped epic、headless mode |
| Downstream consumer contract 未完全闭合 | P2 | requirements doc 足够人读，但 `spec-plan` 能否稳定消费依赖 prompt 纪律 | Plan 可能忽略 assumptions、scope boundary、outstanding questions | 在 `spec-plan` 或合同测试里加 minimal consumer expectations，不让 brainstorm 单向自嗨 |

---

## 6. 推荐实施路线

### U1. 新增 `requirements-quality-gate.md`

建议新增 `skills/spec-brainstorm/references/requirements-quality-gate.md`，作为 Phase 3 落盘前加载的 lightweight gate。它不应成为复杂 schema，只应回答几个高价值问题：

- **Clarity:** 每个核心 requirement 是否能被下游 planner 解释成唯一行为，或至少明确了未决问题？
- **Evidence:** 关键需求来自用户已说事实、repo context、外部先例、还是 agent inference？
- **Traceability:** 重要 actor、flow、success criteria、scope boundary 是否能追到 requirement 或 key decision？
- **Testability:** 行为型 requirement 是否有 acceptance example，条件型 requirement 是否覆盖条件与结果？
- **Boundary:** 是否有 implementation detail 泄漏，或者把 planning 技术问题误写成 product decision？
- **Planning invention risk:** 如果现在进入 `spec-plan`，planner 还必须发明哪些 WHAT？若存在，brainstorm 未完成或必须显式记录为 assumption / outstanding question。

输出不需要 durable JSON；在 skill prose 中要求 agent 用该 gate 修正文档即可。若未来要做 eval，再把 fixture 预期写成 examples。

### U2. 强化 `requirements-capture.md` finalization checklist

现有 checklist 已经不错，但应补三类检查：

- **Coverage check:** Actors / Flows / Requirements / Acceptance Examples / Success Criteria / Scope Boundaries 是否互相覆盖。
- **Inference check:** Stated / Inferred / Out of scope 的 synthesis 是否被正确分流到 doc sections；未确认 inference 不得伪装成 user-confirmed requirement。
- **Handoff check:** `Resolve Before Planning` 是否为空；如果不为空，必须继续 brainstorm、转为 assumption，或明确用户选择带风险继续。

这比新增一整套 schema 更符合 light contract。

### U3. 引入 optional EARS-style acceptance guidance

Kiro 的 EARS-style requirements 值得借鉴，但不应强制所有 requirement 都改成固定语法。建议写成触发规则：

- 当 requirement 是 conditional behavior，用 `When/If ... then ...` 或 Given/When/Then 风格的 AE 固定条件和结果。
- 当 requirement 是 always-on behavior，用简洁 observable statement。
- 当 requirement 是 structural / governance rule，允许非行为句，但必须写出为什么它是 structural。

目标是减少歧义，不是把中文需求文档改造成英文需求语法练习。

### U4. Phase 1.1 增加 standards / reference implementation / external prior scan

建议在 Standard 和 Deep 的 context scan 中增加一个小段规则：

- 若仓库已有 standards、contracts、prior plans、solutions、similar workflow docs，先读最相关的 1-3 个。
- 若需求明显落在成熟工具范式中，允许做轻量 external prior scan，但只总结 product/workflow constraints，不把外部实现细节写成默认方案。
- 若 graph/MCP 证据 stale 或 definitions-only，必须标记为 advisory，关键 claims 用 source reads 确认。

这会把 Agent OS 的强项转化为 spec-first 的 source-first/context-first 能力。

### U5. 增加轻量 technique palette

BMAD 和 SuperClaude 的 ideation 能力可以转译为 6-8 个低负担 technique，而不是完整方法库：

- Inversion：如果反着做，会暴露什么假设？
- Constraint removal：如果某个限制不存在，真正想要的形状是什么？
- Smaller proof：最小能证明价值的版本是什么？
- Adjacent product trap：我们可能误建成哪个相邻产品？
- Counterfactual workflow：不做这个功能，用户今天怎么绕？
- Standards reuse：现有项目标准是否已经隐含了答案？
- Failure-first：什么情况下这个需求上线也没用？
- Trace-first：哪个 requirement 最难被验收，为什么？

Phase 2 只在需要非显然方案或 Deep scope 时使用，不应让每次 brainstorm 都跑完整 technique menu。

### U6. 增加 fresh-source eval fixtures

Skill/prose 变更不能依赖当前会话缓存的 typed skill 来验证。建议新增或扩展 eval fixtures，至少覆盖：

- **Clear lightweight request:** 需求已清楚时不强行长流程，输出 brief alignment 或短 requirements。
- **Vague product request:** 触发 evidence/specificity/counterfactual/attachment probes，不能直接写 PRD。
- **Over-scoped epic:** 提醒 decomposition 或至少记录合并风险。
- **Technical architecture brainstorm:** 允许技术取舍作为 WHAT，但仍不提前写 implementation plan。
- **Headless/non-interactive:** Inferred bets 进入 Assumptions，不进入 Key Decisions 或 Requirements。
- **Conditional requirement:** 必须产生 acceptance example 或明确为何不需要。

这些 eval 应读取当前磁盘 source，而不是调用会话中可能缓存旧内容的 skill。

### U7. 下游 consumer check

为避免 brainstorm 自我感觉良好，建议加一个最小 consumer expectation：`spec-plan` 在读取 brainstorm requirements 时应关注 `spec_id`、requirements IDs、scope boundaries、outstanding questions、assumptions、acceptance examples。首版不需要复杂 parser，可用 contract/prose test 锁定关键 prompt 要求。

---

## 7. 建议优先级

**P0：先做质量门和 traceability**

1. 新增 `requirements-quality-gate.md`。
2. 更新 `requirements-capture.md` finalization checklist。
3. 给 conditional requirements 增加 acceptance example / EARS-style guidance。
4. 补最小 fresh-source eval fixtures。

这组改动能直接降低 `spec-plan` 发明 WHAT 的概率，收益最高。

**P1：再做 Phase 1.1 和 Phase 2 增强**

1. 增加 standards/reference implementation scan。
2. 增加 technique palette。
3. 明确 mode/right-size rationale。

这组改动提升 brainstorm 的探索质量，但若先做它们，可能只会让输出更丰富，却不一定更可执行。

**P2：最后考虑下游 contract**

1. 补 `spec-plan` consumer prompt/test。
2. 评估是否需要 doc-review 或 code-review 把 brainstorm traceability 纳入检查。

这组改动涉及跨 workflow contract，应该等 P0 形态稳定后再做。

---

## 8. 反模式清单

本次调研最容易误导的方向如下，应明确避免：

- **不要把 brainstorm 变成 prompt collection。** 技法库只能辅助 Phase 2，不能成为 workflow 主体。
- **不要强制所有需求都走 design + tasks。** 这会侵入 `spec-plan` / task-pack / `spec-work` 边界。
- **不要追求 100+ ideas。** spec-first 的目标是让用户更快得到可治理工程闭环，不是最大化发散数量。
- **不要把 endpoint/schema/file layout 写进普通 product brainstorm。** 技术/架构 brainstorm 例外，但普通产品需求不应提前决定 HOW。
- **不要引入重 schema 状态机。** Requirements quality gate 应是 LLM-owned judgment，由 checklist 和 eval 守住，而不是脚本假装能判定语义质量。
- **不要让 provider internal details 进入 workflow contract。** GitNexus、browser、ast-grep 等只能提供 evidence 或 degraded status，不能决定 brainstorm 输出结构。
- **不要通过手改 runtime mirror 修复行为。** Source 变更应发生在 `skills/`、`templates/`、`src/cli/` 或 docs；runtime drift 用 `spec-first init`。

---

## 9. 后续落地验证建议

若后续决定实施本报告建议，建议按 `$spec-work` 执行，并至少完成以下验证：

- `npm run lint:skill-entrypoints`：确保 workflow entrypoint governance 未漂移。
- 聚焦 unit/contract tests：覆盖 `spec-brainstorm` prose contract、requirements quality gate 触发、headless inference 分流、conditional acceptance examples。
- Fresh-source eval：按 `docs/contracts/workflows/fresh-source-eval-checklist.md` 用当前磁盘 source 验证 prompt/prose 行为；若 dispatch primitive 不可用，应在 closeout 记录未执行原因。
- Source/runtime boundary check：确认没有手改 `.claude/`、`.codex/`、`.agents/skills/`。
- `CHANGELOG.md`：任何 source/doc/test 变更必须追加 user-visible 或非 user-visible 记录，作者从 `~/.spec-first/.developer` 读取。

本次报告只创建分析文档和 changelog，不运行测试链路；验证以文件写入和 diff 检查为主。

---

## 10. 外部参考速记

| 来源 | 用途 |
|---|---|
| Superpowers brainstorming | 对照 hard gate、用户确认、terminal state、上下文脉冲 |
| BMAD brainstorming | 对照 ideation technique library 和 facilitation 节奏 |
| SuperClaude brainstorm mode | 对照 mode / command 形态与探索姿态 |
| AI Dev Tasks | 对照 PRD 到 tasks 的清晰链路 |
| Task Master / prd-taskmaster | 对照 PRD-driven task decomposition 与 agent-ready tasking |
| GitHub Spec Kit | 对照 clarify / analyze / checklist 式 spec readiness |
| Kiro Specs | 对照 requirements / design / tasks、requirements analysis、EARS-style 验收纪律 |
| OpenSpec | 对照 lightweight spec/change/task artifact |
| Agent OS shape-spec | 对照 standards/reference scan before shaping spec |
| Living Spec Skill | 对照 living traceability 和持续校准 |
| prd-generator | 对照 agent implementation-ready PRD 输出 |

---

## 11. 最小可维护结论

`spec-brainstorm` 不需要变成更大的 brainstorm。它需要变成一个更可靠的 requirements readiness compiler：脚本和工具提供 context facts，LLM 负责产品判断，但判断必须经由明确的 quality gate、traceability discipline 和 eval fixtures 留下可复用证据。

最小下一步不是重写 workflow，而是新增一个小的 requirements quality gate，并把它接到现有 Phase 3。这个改动小、边界清晰、收益直接，符合 `Light contract + Explicit boundaries + Let the LLM decide`。
