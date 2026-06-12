---
date: 2026-06-12
topic: context-injection-progressive-disclosure
spec_id: 2026-06-12-002-context-injection-progressive-disclosure
---

# Context Injection Progressive Disclosure Requirements

## Summary

将 `spec-first` 的会话启动与常驻上下文从“更多治理规则在场”转向“最小常驻锚点 + source-backed progressive disclosure”。新方向保留 workflow 入口治理、source/runtime 边界、CHANGELOG gate、provider advisory 和 verification honesty，但把长规则、长历史和 provider 细节移到按需读取的 source、summary、eval 或 planning 阶段。

---

## Problem Frame

`docs/brainstorms/2026-06-08-001-using-spec-first-injection-redesign-requirements.md` 曾主张把 `using-spec-first` 启动注入扩大到约 80 行核心决策集，以解决漏路由问题。后续实践和 `docs/10-prompt/context-token-audit/12-context-injection-optimization-notes.md` 暴露了相反方向的成本：常驻上下文过重、重复注入、Graphify 触发过宽、CHANGELOG 记录与消费过重、skill trigger 与 workflow route 容易互相放大。

因此本需求作为 successor，不改写旧文档，而是把当前产品方向明确为：常驻注入只承载必须当场生效的治理锚点；完整策略仍由 source-of-truth 文件和按需 workflow 负责；工具和图谱结果只能作为 advisory navigation，不能替代 source/test/diff 证据。

---

## Actors

- A1. 顶层 Codex / Claude orchestrator：在用户请求进入实现、评审、计划或治理判断前，判断是否需要 public workflow，并决定是否按需展开 source。
- A2. 轻量问答用户：提出事实问答、当前上下文解释、窄定位查询或已有材料整理，希望得到低摩擦回答。
- A3. spec-first maintainer：维护 host bootstrap、skills、contracts、tests、CHANGELOG 和 generated runtime projection。
- A4. 下游 planner / reviewer：消费本需求，规划具体 source 改动、验证策略和 runtime 刷新边界。
- A5. Optional provider / helper tool：Graphify、code graph、browser、git-worktree 等提供候选证据或辅助能力，但不拥有语义结论。

---

## Key Flows

- F1. 轻量请求直接回答
  - **Trigger:** 用户提出问候、当前上下文解释、窄定位查询、已有文档整理等轻量请求。
  - **Actors:** A1, A2
  - **Steps:** A1 使用已加载的最小治理锚点判断请求无 workflow 产物价值；不读取完整高频 workflow skill；必要时做 bounded direct read；直接回答。
  - **Outcome:** 轻量请求不被拖入 `$spec-work`、`$spec-plan` 或 Graphify/provider 流程。
  - **Covered by:** R1, R3, R7, R8, R15

- F2. Substantial work 按需展开治理 source
  - **Trigger:** 用户请求写文件、修复、评审、计划、prompt/workflow/contract 判断或 durable artifact 产出。
  - **Actors:** A1, A3, A4
  - **Steps:** A1 先用常驻锚点判断需要 public workflow；当任务涉及架构/prompt/workflow/contract 时读取角色契约；进入对应 `$spec-*` workflow 后按 source-of-truth 和 references 读取完整规则。
  - **Outcome:** 高风险治理任务仍有完整边界和证据要求，但这些长规则不默认压到每个轻量回合。
  - **Covered by:** R2, R4, R5, R6, R14, R16

- F3. Provider-assisted navigation without authority inflation
  - **Trigger:** 请求涉及架构关系、跨文件关系、影响面或代码库导航，且 Graphify 或其他 capability-class provider 可用。
  - **Actors:** A1, A5, A4
  - **Steps:** A1 只把 provider 输出当作候选导航；把未确认结果记录为 `provider_untrusted` 或等价 advisory evidence；关键结论回到 source 文件、测试、diff、日志或用户材料确认。
  - **Outcome:** Provider 提升定位效率，但不会把图谱 freshness、query success 或 helper 输出误报为 confirmed truth。
  - **Covered by:** R9, R10, R11, AE4

- F4. Source 变更记录与消费
  - **Trigger:** 后续计划或执行修改 source、skill、agent、template、contract、docs 或 tests。
  - **Actors:** A3, A4
  - **Steps:** 继续追加根 `CHANGELOG.md`；entry 保持 compact，长设计理由放在需求/计划/评审 artifact；普通 workflow 只消费 changelog 顶部窗口或索引，历史追溯任务再扩大读取。
  - **Outcome:** Source governance 不弱化，但 changelog 不再成为常驻上下文和 review 的长文本负担。
  - **Covered by:** R12, R13, AE5

---

## Requirements

**Successor posture**
- R1. 本需求必须作为 `docs/brainstorms/2026-06-08-001-using-spec-first-injection-redesign-requirements.md` 的 successor 方向：保留旧文档为历史决策证据，不直接改写旧文档。
- R2. 后续规划必须把核心方向从“扩大启动注入”改为“最小常驻锚点 + 按需 source 展开 + summary-first handoff”。
- R3. 常驻启动注入必须优先承载语言策略、target repo 写入边界、workflow-first 提醒、source/runtime 禁线和 `using-spec-first` source pointer，不应复制完整 route map、长反例或 provider 细节。

**Progressive disclosure and workflow routing**
- R4. `skills/using-spec-first/SKILL.md` 继续作为完整 routing policy source-of-truth；bootstrap block 只能是 faithful core subset，不成为第二套完整路由真相源。
- R5. 进入 substantial work、prompt/workflow/contract 设计或治理判断时，必须按需读取 `docs/10-prompt/结构化项目角色契约.md` 和相关 source skill；轻量请求不因此默认读取完整高频 skill。
- R6. 后续设计不得把 context router 或 bootstrap 做成强状态机；scripts/tools 只能提供确定性 facts、reason_code、path 和 validation outcome，LLM 继续做语义路由与取舍。
- R7. 必须明确 skill trigger 与 workflow admission 是两层判断：读取一个 skill 的方法论不自动等于进入 public `$spec-*` workflow。
- R8. `using-spec-first` 的合法输出必须包括 direct answer / normal execution；轻量事实问答和当前对话解释不得被强制升级为 brainstorm、plan 或 work。

**Provider and helper boundaries**
- R9. Graphify 默认只应用于架构关系、跨文件关系、影响面和代码库导航；已有单文档整理、当前对话总结、简单事实问答和用户明确给定材料不应默认触发 Graphify。
- R10. Graphify、code graph 和其他 capability-class provider 的结果必须记录为 advisory / `provider_untrusted`，不能作为 confirmed source truth。
- R11. 重要结论必须回源确认：source 文件、测试、diff、日志或用户提供材料优先于 provider query/path/explain 结果；无法回源时必须标注 limitation。

**Changelog and artifact consumption**
- R12. 任何项目 source 变更继续同步根 `CHANGELOG.md`；本改进不得削弱 source governance 或 user-visible 标记规则。
- R13. `CHANGELOG.md` entry 应 compact：记录用户可见影响、source 面、验证摘要和必要 caveat；完整设计理由放在需求、计划、评审或验证 artifact 中。
- R14. 普通 workflow 消费 changelog、plan、review、tool output 和 runtime facts 时应遵循 summary-first / latest-window / path-backed evidence，不默认读取完整历史、raw logs 或 generated runtime mirror。

**Validation and runtime boundary**
- R15. 后续实现必须补 routing negative examples，覆盖轻量问候、当前上下文解释、窄定位查询、当前对话整理不进入 public workflow 的场景。
- R16. 后续实现必须保持 source-first：修改 `skills/`、`templates/`、`docs/contracts/`、`AGENTS.md` / `CLAUDE.md` managed source slice 或 tests；不得手改 `.claude/**`、`.codex/**`、`.agents/skills/**` 作为 source fix。
- R17. 需要 runtime 刷新时，只能在 source 变更验证后通过 `spec-first init` 重新生成，并在 closeout 中说明 generated runtime impact。

---

## Acceptance Examples

- AE1. **Covers R1, R2.** Given 后续 planner 读取本需求和 2026-06-08 旧需求，when 判断当前 WHAT，then 以本需求的 progressive disclosure 方向为准，并把旧需求视为被新认知修正的历史证据。
- AE2. **Covers R3, R4, R8.** Given 用户只问“当前上下文注入了哪些内容”，when orchestrator 响应，then 它可以直接回答或做 bounded reads，不需要进入 `$spec-work`、`$spec-plan` 或读取完整 route map。
- AE3. **Covers R5, R6, R16.** Given 用户要求修改 prompt/workflow/contract 治理，when orchestrator 开始 substantial work，then 它读取角色契约和 source skill，并只修改 source-of-truth 文件。
- AE4. **Covers R9, R10, R11.** Given Graphify query 返回一个相关节点，when final 或 handoff 写出结论，then 结论要么附 source confirmation，要么明确标注 provider evidence 未确认。
- AE5. **Covers R12, R13, R14.** Given 后续执行改了 source docs 或 skills，when closeout，then 根 `CHANGELOG.md` 有 compact entry，长 reasoning 留在对应 artifact，普通消费者不需要读完整 changelog 历史。
- AE6. **Covers R15.** Given routing eval examples 中包含轻量请求负例，when focused tests / fresh-source eval 运行，then 这些负例不会被期望路由到 public workflow。

---

## Success Criteria

- 轻量用户交互的上下文负载下降：普通问答、定位和当前材料整理不再默认加载完整高频 workflow skill 或 Graphify。
- 高风险治理任务的边界不下降：prompt/workflow/contract/source-runtime 判断仍读取角色契约和 source-of-truth。
- 下游 planning 不需要重新决定 WHAT：它能直接围绕 progressive disclosure、provider advisory、compact changelog 和 negative routing eval 做实现方案。
- 双宿主行为保持一致：Claude 与 Codex 的 bootstrap / runtime projection 差异只体现在 host entrypoint spelling 和宿主能力边界，不形成两套路由政策。
- 变更可验证：后续实现能通过 focused contract tests、routing eval examples、runtime projection tests 和 `git diff --check` 证明核心边界未回退。

---

## Scope Boundaries

- 不直接实现代码、模板、runtime projection 或 tests；本文件只定义 successor requirements。
- 不改写或删除 `docs/brainstorms/2026-06-08-001-using-spec-first-injection-redesign-requirements.md`。
- 不取消 `using-spec-first`，不取消 public `$spec-*` workflow routing。
- 不削弱 `CHANGELOG.md` 必填规则、verification honesty、degraded-mode reason_code 或 source/runtime gate。
- 不把 Graphify、code graph、browser、git-worktree 等 helper 暴露成新的 public workflow 入口。
- 不新增中心化强状态机、强制全拦截器或“每条消息都必须 workflow route”的机制。
- 不手改 generated runtime mirrors；runtime 刷新属于后续 source 验证后的 `spec-first init` 步骤。

---

## Key Decisions

- **Successor over rewrite:** 选择新建 successor requirements，而不是改写旧的 2026-06-08 文档。理由是旧文档记录了当时“扩注入”的真实决策路径，后续读者需要看到认知反转的来源。
- **Minimal anchor over expanded bootstrap:** 当前方向反转为最小常驻锚点。理由是路由漏判问题可以通过关键锚点、negative eval、按需 source 展开解决；把更多长规则常驻会放大普通轻量任务成本。
- **Provider as navigation, not authority:** Graphify 等 provider 的价值在于加速定位，不在于提供 confirmed truth。这个边界延续 `docs/contracts/project-graph-consumption.md` 和角色契约中的 advisory discipline。
- **Keep changelog gate, compress consumption:** `CHANGELOG.md` 是 source governance gate，不能因 token 成本取消；正确优化点是 entry 粒度、latest-window consumption 和 artifact path-backed rationale。
- **Skill trigger is not workflow admission:** 全局 skill 触发规则和 `using-spec-first` 可以共存，但必须明确 skill 使用是方法论选择，public workflow admission 是产物/验证/交付边界选择。

---

## Dependencies / Assumptions

- 本需求依赖已加载的 `AGENTS.md` 语言与 changelog 治理规则：默认中文、source 变更必须更新根 `CHANGELOG.md`。
- 本需求依赖 `docs/10-prompt/context-token-audit/12-context-injection-optimization-notes.md` 作为直接输入材料。
- 本需求依赖 `docs/10-prompt/结构化项目角色契约.md` 作为架构判断基线。
- 本需求假设后续 planning 会检查 `docs/contracts/context-governance.md`、`docs/contracts/project-graph-consumption.md` 和 `skills/using-spec-first/SKILL.md` 的当前 source，而不是从 generated runtime mirror 推断实现。
- 本需求不假设 Graphify 或其他 provider readiness 必然可用；provider 证据缺失时，后续 workflow 应回退到 bounded direct source reads。

---

## Sources / Research

- `docs/10-prompt/context-token-audit/12-context-injection-optimization-notes.md`
- `docs/brainstorms/2026-06-08-001-using-spec-first-injection-redesign-requirements.md`
- `docs/contracts/context-governance.md`
- `skills/using-spec-first/SKILL.md`
- `docs/10-prompt/结构化项目角色契约.md`

---

## Outstanding Questions

### Resolve Before Planning

- (空)当前 WHAT 已确认：新建 successor requirements，方向为 progressive disclosure，不改写旧需求。

### Deferred to Planning

- [Affects R3, R4][Technical] 具体哪些 bootstrap 句子保留为常驻锚点，哪些移动到 source skill 或 references。
- [Affects R7, R8, R15][Technical] routing negative eval 应落在现有 examples fixture、fresh-source eval，还是新增 focused contract test。
- [Affects R9, R10, R11][Technical] Graphify 触发收窄应落在 `graphify` skill trigger、AGENTS managed guidance、`project-graph-consumption` contract，还是 downstream workflow prose。
- [Affects R12, R13, R14][Technical] changelog compact entry 和 latest-window consumption 是否需要新 contract test，或只需文档治理与 workflow prose。
- [Affects R16, R17][Technical] 如果后续修改 managed bootstrap source slice，是否需要同步 runtime projection tests，并在何时运行 `spec-first init`。
