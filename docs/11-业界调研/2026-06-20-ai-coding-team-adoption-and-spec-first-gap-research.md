# AI 编程团队落地阻力与 spec-first 需求开发短板研究简报

日期：2026-06-20  
作者：leokuang  
研究对象：AI 编程团队落地阻力、`spec-first` 辅助研发做需求开发的能力短板  
目标读者：spec-first 项目 owner / 总架构师  
研究方法：storm-research 风格 multi-lens 综合；主线程读取本仓 README、skills、docs、业界调研材料，并结合 5 个 lens subagent 的独立分析结果。  

## 0. 证据边界

本报告优先使用截至 2026-06-20 可确认的 2026 材料。未能确认正式 2026 年度版发布的材料，不作为主证据。

### 本仓 confirmed evidence

- `README.md`：`spec-first` 定位为 AI Coding Harness，把一次性 AI coding chat 转为 repo-backed engineering loop；核心信任模型是 `Scripts prepare. LLMs make semantic judgments. Evidence stays in your repository.`。
- `skills/spec-prd/SKILL.md`：`spec-prd` 面向 brownfield PRD，目标是让 PRD 先沉淀 WHAT/WHY、current-state evidence、acceptance、scope boundary，避免 `spec-plan` 发明产品行为。
- `skills/spec-plan/SKILL.md`：已包含 PRD handoff entropy check；当 planning 仍需发明 load-bearing WHAT 时，应 route to PRD refine 或输出 inline PRD feedback candidate。
- `skills/spec-write-tasks/SKILL.md`：task pack 已有 `spec_id`、`source_plan_hash`、identity/freshness/structure validation，但 deterministic validation 不证明语义质量。
- `skills/spec-work/SKILL.md`、`skills/spec-code-review/SKILL.md`、`skills/spec-doc-review/SKILL.md`：已有 direct evidence、verification-run-summary、honest closeout、multi-persona/origin-aware review 边界。
- `docs/10-prompt/结构化项目角色契约.md`：六层 AI Coding Harness、`Scripts prepare, LLM decides`、硬 gate vs 轻判断、可采纳性/可外部验证性/表达可信度是一等守护结果。
- `docs/11-业界调研/2026-06-19-*`：OpenSpec/spec-kit/superpowers/GSD/BMAD 等对标，以及 6/19 综合报告对 P0/P1 的排序校准。
- `docs/brainstorms/2026-06-02-002-spec-prd-quality-feedback-loop-requirements.md`：PRD miss feedback loop、`spec-plan` 不应默默发明 load-bearing WHAT。
- `docs/02-架构设计/2026-06-17-spec-first-session-context-activation-layer-gap-analysis.md` 与 `docs/brainstorms/2026-06-19-001-docs-solutions-recall-activation-layer-requirements.md`：缺 scoped context activation layer；`spec-work` / `spec-debug` 对 `docs/solutions/` 召回缺显式 wiring。
- `docs/06-待办事项/2026-05-28-spec-first-用户体感提升路线图.md`：P-friction 是用户体感路线图第一目标，后续 task-pack default / inline review / graph-primary 应由真实摩擦证据驱动。

### 2026 external evidence

- Anthropic 2026 Agentic Coding Trends Report：将软件开发变化描述为从写代码转向 orchestrating agents，并指出 engineering leaders 正在处理从早期实验到组织级采用之间的 gap，核心权衡包括 oversight、quality、security。来源：<https://resources.anthropic.com/2026-agentic-coding-trends-report>。
- DORA / Google Cloud AI-assisted software development：DORA AI 页面提供 AI-assisted software development ROI framework；Google Cloud State of DevOps 页面强调 successful AI adoption 是 systems problem, not tools problem，并把 Value Stream Management 作为把局部生产率转为产品绩效的放大器。来源：<https://dora.dev/research/ai/>、<https://cloud.google.com/devops/state-of-devops>。
- Sonar 2026 State of Code / AI code trust figures：上一轮 web lookup 记录过 AI-generated committed code、developer trust 与 pre-commit verification 的数据点，但本轮未稳定取得可归档的原始报告 URL；以下只作为待核验证据，不作为本报告主支柱。
- METR 2026：本轮确认 METR 2026 blog 主要集中在 Anthropic risk / agent monitoring / sabotage risk review 等安全评测材料；未确认新的 2026 AI coding productivity 正式更新。相关 productivity 结论只作为背景，不作主证据。
- Stack Overflow / DORA 正式 2026 年度报告：截至本次研究未确认正式 2026 年度报告发布；不作为主证据。

### Storm-research / multi-lens 证据缺口

仓库内未找到明确命名的 `storm-research` public workflow、skill 或专项设计文档。可确认的对应机制是：

- `spec-doc-review` 的 multi-persona / conditional lens / origin-aware review；
- `spec-code-review` 的 tiered persona agents、confidence-gated findings、merge/dedup pipeline；
- 2026-06-19 多份 industry benchmark / multi-lens 对标报告；
- `docs/validation/2026-06-19-origin-calibration-eval.md` 对 origin-aware lens 的 fresh-source eval。

因此本文把 `storm-research` 作为研究方法称谓使用，不把它声明为已落地的 spec-first 能力。

## 1. 适合的 lens

本题不适合按“产品 / 技术 / 测试 / 运营”机械拆分。AI 编程团队落地的主要阻力跨越组织采用、需求语义、上下文继承、验证可信度和外部可采纳性。采用以下 5 个 lens：

| Lens | 关注问题 | 为什么适合 |
| --- | --- | --- |
| 组织采纳与流程经济 | 团队为何用不起来、用不久、用不敢 | 2026 外部材料把 adoption gap 定位在 oversight、quality、security、systems problem，而非单点工具能力 |
| 需求开发与 PRD 语义质量 | PRD 是否减少 downstream invention | 用户目标是提升 spec-first 辅助研发做需求开发的质量 |
| 上下文与知识激活 | 历史知识、项目规则、上下文是否及时进入 run | AI coding 的常见失败是会话上下文不可继承、长任务丢意图 |
| 质量门禁与可验证性 | 证据、review、verification 是否能让团队信任 | spec-first 的护城河正在 evidence loop；短板也在 eval / closeout / artifact quality 尚未 fully confirmed |
| 行业 harness / multi-lens 对标 | spec-first 相对 Codex/Copilot/Sonar/OpenSpec/spec-kit 的位置 | 行业方向正在从 prompt / codegen 转向 agent orchestration、context、review、governed workflow |

## 2. 五个视角的分析

### 2.1 组织采纳与流程经济 lens

**结论：** AI 编程团队落地的主阻力不是模型不会写代码，而是组织无法稳定信任、监督、复用和度量 AI 产出。

外部 2026 材料显示，工程团队正在从 early experiments 进入 organization-wide adoption。这个阶段的核心问题是：

- 谁监督 agent？
- 代码质量、安全与合规如何被证明？
- 局部生产率是否转化为产品绩效，而不是制造 downstream chaos？
- 团队成员是否愿意把关键决策交给或交给一部分给 AI？

`spec-first` 已经把这些问题压到 repo-backed artifact trail 上：requirements、PRDs、plans、task packs、work evidence、review findings、debug notes、solutions。它避免“决策和证据随 chat window 消失”。

**当前短板：**

- 缺真实 P-friction 审计，无法证明用户最痛的摩擦点在 plan、task-pack、review、context 还是 verification。
- 外部可采纳性弱于内部治理能力。6/19 综合报告已明确“内部能力强，但首次体验和外部证明弱于 Spec Kit / BMAD”。
- 当前 workflow 的价值更容易被架构 owner 理解，不一定被普通开发者快速感知。

**推断：** 下一阶段若只继续加强治理机制而不降低采用摩擦，会强化 owner 视角的正确性，但不一定提升团队真实采用率。

### 2.2 需求开发与 PRD 语义质量 lens

**结论：** `spec-prd` 的方向正确，但需求开发质量目前缺少 live-output eval 与系统化反馈闭环。

`spec-prd` 已有明确定位：面向 existing-system increment，把 rough product note / low-quality PRD 转成 planning-ready PRD。核心机制包括：

- current-state evidence；
- Change Delta；
- Scope Boundaries；
- Acceptance Examples；
- Evidence And Assumptions；
- planning-invention risk / handoff entropy check。

这正好对应 brownfield 需求开发的常见失败：用户只说“加个功能”，AI 不理解当前系统边界，plan 阶段发明行为，work 阶段实现了错误的产品语义。

**当前短板：**

- PRD quality 主要靠 orchestrator readiness lens 和 examples-as-context；缺稳定的 live-output eval 证明“用了 spec-prd 比不用更少 downstream invention”。
- PRD miss feedback 目前主要在 `spec-plan` inline advisory candidate，不会系统进入 `spec-doc-review`、`spec-code-review`、`spec-work` closeout。
- H5 / PC / CLI / Backend / Mixed surface 的泛化能力尚需更多 fixture 与真实样本证明。
- `spec-prd` 能发现 current-state 缺口，但还没有“被开发系统行为真相单源”可对照；很多现状仍靠当次 direct source reads 重建。

**证据缺口：** 需要一组真实 PRD 输入，对比 `spec-prd` output、普通 brainstorm output、human rough PRD output，再由 `spec-plan` / doc-review 评估 planning invention risk。

### 2.3 上下文与知识激活 lens

**结论：** `spec-first` 不缺 durable knowledge，缺的是 scoped context activation 的可靠入口。

本仓已有：

- `docs/solutions/` 作为 verified learning store；
- `knowledge-harness.md` 定义 file-first、summary-first、recall-as-advisory；
- `spec-learnings-researcher` 可 grep-first 召回历史经验；
- `artifact-summary.v1` / `context-bundle.v1` 的 summary-first handoff 姿态。

但 6/17 gap analysis 与 6/19 recall requirements 都指出：activation layer 缺失或不完整。尤其是：

- `spec-plan` / `spec-code-review` 已有较强 recall 调度；
- `spec-work` / `spec-debug` 仍更多是 advisory prose，没有显式 `docs/solutions` recall wiring；
- `docs/solutions` 中 `source_refs`、`invalidation_condition` 等新结构化字段覆盖稀疏，只有少数文档具备强回源抓手；
- recall 必须保持 advisory，不能因为命中过往 solution 就当成 confirmed truth。

**当前短板：**

- 相关历史经验“该被召回但未召回”的 missed-recall trace 尚不足。
- 召回质量优化不能靠引入向量库解决；当前 23 篇量级下，frontmatter 回填与 workflow wiring 的 ROI 更高。

**推断：** 对真实研发质量而言，work/debug 阶段的 recall miss 影响可能大于 plan 阶段，因为实现和诊断阶段更容易重犯历史 bug 或忽略既有约定。

### 2.4 质量门禁与可验证性 lens

**结论：** `spec-first` 的强项是 evidence-first，但下一阶段必须把“机制就位”推进到“质量可外部验证”。

当前已具备的硬能力：

- `verification-run-summary.v1` 记录实际 passed / failed / not-run；
- `honest-closeout.v1` 降级 unsupported / natural-language-only claims；
- code review 与 doc review 坚持 direct source / diff / test / artifact evidence；
- task-pack deterministic validation 检查 identity、freshness、structure；
- `spec_id` 链接 PRD / plan / task / work / review。

但 6/19 综合报告已把 P0 排为：

1. Artifact Quality Gate；
2. Honest Closeout Producer Integration；
3. Evaluation Harness v1 / eval corpus。

这说明当前问题不是没有机制，而是机制尚未充分兑现为可持续评估体系。

**当前短板：**

- task-pack ID coverage 不检测“ID 仍引用但语义被缩窄”的 semantic drift。
- benchmark / examples-as-context 不能等同真实端到端 workflow 质量度量。
- review/verification 多以本次 plan 为基准，缺纵向系统行为真相导致回归破坏盲区。
- artifact quality gate 还未成为 PRD / plan / task / review 的共同前置质量语言。

**推断：** 如果没有 P0 证据质量闭环，贸然引入 behavior contract + Delta 会增加新的 source-of-truth 表面，但不能保证它被正确消费。

### 2.5 行业 harness / multi-lens 对标 lens

**结论：** 行业方向正在从“AI 写代码”转向“AI coding harness / agent orchestration / verification / context engineering”。`spec-first` 的战略层级正确，但要补齐可采纳性与外部证明。

2026 外部和本仓对标材料共同显示：

- Codex / Copilot 类产品正在把 issue-to-PR、background task、agent review、parallel work 变成产品表面；
- Sonar 类工具把 verify AI code、context augmentation、AI code review 变成 agentic workflow 配套；
- OpenSpec / Spec Kit / BMAD / GSD 等工具强化 spec、delta、template、task ledger 或 agent runtime；
- `spec-first` 的差异化不在 agent 数量，而在 source/runtime 边界、artifact trail、direct evidence、review/compound loop。

**当前短板：**

- `storm-research` 命名未形成 source artifact，方法论资产还不稳定。
- 6/19 “活契约 + Delta 是最大杠杆”文档与 6/19 综合报告的优先级排序不同；综合报告已校准为 P0 先证据质量闭环，P1 再 behavior contract + Delta。
- 行业工具在用户入口和 demos 上更直接，`spec-first` 内部治理强但外部试用路径还弱。

## 3. 矛盾地图：团队落地阻力 vs spec-first 当前能力错位

| 团队落地阻力 | spec-first 已有能力 | 当前错位 | 证据等级 | 补强方向 |
| --- | --- | --- | --- | --- |
| AI 代码越来越多，但团队不完全信任 | repo-backed artifact trail、direct evidence、review、honest closeout | 证据机制存在，但 artifact quality / closeout producer / eval corpus 未完全兑现 | confirmed-source + 2026 external | P0 evidence quality loop |
| 需求不清导致 agent 编错方向 | `spec-prd`、Change Delta、planning-invention risk、PRD handoff entropy check | PRD 输出质量缺 live eval；PRD miss feedback 未系统进入 review/work | confirmed-source | live PRD eval + feedback loop |
| 长任务、多 agent 丢上下文 | artifact-summary、context-bundle、docs/solutions、summary-first recall | 缺 scoped activation；work/debug recall wiring 不完整 | confirmed-source | work/debug recall wiring + frontmatter 回填 |
| 回归破坏难发现 | spec_id、source_plan_hash、review、verification-run-summary | 横向 trace 强，纵向系统行为真相弱；review 基准仍多来自本次 plan | confirmed-source + 推断 | P1 behavior contract + Delta |
| 团队嫌流程重 | workflow routing、task-pack、review tiers | 缺真实摩擦数据，不知道该默认轻量还是完整 | confirmed-source | P-friction + risk-tier profile |
| 局部速度无法转化为产品绩效 | run artifacts、closeout、review findings | 缺 workflow-level outcome metric，无法稳定证明“需求开发更少返工” | evidence gap | replay report + end-to-end workflow eval |
| 多 lens 有价值但易噪声 | doc-review/code-review persona 与 lens 体系 | `storm-research` 命名和研究产物契约未稳定；lens 结果还缺统一可复用沉淀形态 | evidence gap | research artifact contract / multi-lens synthesis pattern |
| 外部工具强调 agent autonomy | spec-first 强 human-in-the-loop governance | 用户可能觉得 spec-first 慢、重、不如一键 agent 直接 | 推断 | guide/demo/next + lite profile |

## 4. 面向项目 owner 的研究简报

### 4.1 一句话结论

`spec-first` 下一阶段最值得补强的不是更多 agent 或更多 workflow，而是把需求开发链路从“有治理设计”推进到“PRD 质量、上下文激活、完成声明、review 结论和用户价值都可外部验证”。

### 4.2 当前优势

`spec-first` 已经站在正确层级：它不是 prompt collection，不是 agent marketplace，也不是中心化 workflow engine，而是 AI Coding Harness。

它的护城河包括：

- repo-backed artifact trail；
- source/runtime 边界；
- `Scripts prepare, LLM decides`；
- direct evidence；
- honest closeout；
- PRD / plan / task / work / review / compound 主链路；
- multi-persona review 与 origin-aware review；
- verified learning store。

这些能力正好对应 2026 外部材料指出的 adoption gap：监督、质量、安全、上下文、流程和信任。

### 4.3 当前最大错位

`spec-first` 内部治理强，但用户和团队感知到的是：

- “这个 PRD 是否真的比我自己写更少漏？”
- “AI 实现时有没有读到该读的上下文？”
- “测试和 review 真的覆盖了风险，还是只是形式上跑过？”
- “这套流程会不会太重？”
- “我怎么向团队证明它提升了需求开发质量？”

当前能力对这些问题有方向正确的机制，但证据闭环不够硬。

### 4.4 优先级判断

6/19 “活契约 + Delta”文档指出的“强过程、弱状态”判断成立：`spec-first` 缺被开发系统的行为真相单源。这是长期乘数项。

但我不建议把 behavior contract + Delta 放到立即 P0。理由：

- 它是新增 source-of-truth 表面，回退成本高；
- 当前缺真实用户痛点证据证明这是最痛问题；
- 如果 P0 evidence quality loop 未稳定，新增 contract 也可能变成又一个未被正确消费的 artifact；
- 6/19 综合报告已更稳妥地把 artifact quality + honest closeout + eval loop 放到 P0。

因此排序应是：

1. **P0：证据质量闭环兑现**。先让 PRD / plan / work / review 的质量可测、完成声明可信、eval 可回归。
2. **P1：上下文激活与 review hardening**。让相关经验、source refs、PRD intent 在 work/debug/review 中稳定进入上下文。
3. **P1：behavior contract + Delta**。在 P0 稳定并取得真实痛点后补纵向行为真相。
4. **P1/P2：adoption proof / demos / profiles**。把内部能力变成用户能试、能理解、能比较的价值。

## 5. 可行动改进建议

### 5.1 短期：1-2 周

1. 建立 `spec-prd` live-output eval。
   - 选 10-20 个真实 brownfield fixtures。
   - 对比 `spec-prd` output、普通 brainstorm output、rough human PRD。
   - 评分维度：current-state accuracy、Change Delta clarity、Acceptance coverage、Scope Boundaries、planning-invention risk。
   - 输出不要宣称 business metric，只宣称 workflow quality delta。

2. 启动 P-friction 审计。
   - 消费已有 run.json 样本。
   - 分类摩擦：入口选择、上下文重复、PRD 过重、plan 过长、task-pack 编译成本、review 等待、verification not-run、final response 不够清晰。
   - 后续 task-pack default / inline review / graph-primary 的优先级由 finding 驱动。

3. 把 `docs/solutions` recall 接进 `spec-work` / `spec-debug`。
   - v1 只做 frontmatter scan + `spec-learnings-researcher` 调度。
   - 召回命中必须回源到 `source_refs` / 当前 source/test/doc。
   - 成功标准是入口步骤存在且被调度，不宣称 guaranteed recall。

4. 回填 `docs/solutions` 关键 frontmatter。
   - 优先 `source_refs`、`invalidation_condition`、`domain`、`pattern`。
   - 不引入向量库或新索引，当前语料规模还不需要。

5. 统一 fresh-source eval 诚实口径。
   - examples-as-context 不能写成已执行 eval。
   - 未运行 fresh-source eval 必须写 `not_run` 与原因。

6. 修 artifact quality checklist 的最小版本。
   - PRD、plan、task-pack 各保留最小质量字段。
   - 不新增重 schema；先作为 report/checklist artifact。

### 5.2 中期：1-2 个月

1. 把 PRD miss feedback 扩展到 doc-review / code-review / work closeout。
   - 仍保持 advisory candidate。
   - 不自动改 PRD，不新增 feedback registry。
   - 当 review/work 发现实现被迫发明 WHAT，应能回链到 PRD quality gap。

2. 建 R/AE 到 verification-run-summary / review finding 的映射。
   - 让 `Covers AE<N>` 不只停在 plan/test scenario。
   - review closeout 能说清哪些 acceptance 被验证、哪些只是未覆盖 residual。

3. 建 fresh review protocol。
   - review 顺序先检查 spec compliance / origin faithfulness，再检查一般代码质量。
   - 对 PRD-origin plan，优先抓 plan-introduced scope drift 与 upstream WHAT 被改写。

4. 建 risk-tier / lite-full profile。
   - 小改和 docs-only 不强制完整链路。
   - 高风险 workflow/contract/source-runtime/security/release 走 full harness。
   - final response 必须声明当前 review/verification tier，避免“轻量检查”被误读为完整 review。

5. 建 workflow replay reports。
   - 选一批真实需求，从 PRD 到 work/review 复盘。
   - 记录返工、missed context、not-run verification、review findings、PRD quality gaps。
   - 目标是证明或否定 spec-first 对需求开发质量的实际提升。

### 5.3 长期：1-2 个季度

1. 引入 behavior contract + Delta。
   - 前置条件：P0 evidence loop 稳定，且 P-friction / replay report 证明系统行为真相缺失是高频痛点。
   - 最小形态：behavior contract source surface + deterministic delta preview/apply + contract sync summary。
   - 避免把它变成刚性 workflow state machine。

2. 做 contract-aware review / verification / compound。
   - review 对照本次 diff + 本次 plan + 系统行为契约。
   - verification 能声明受影响 contract MUST/Scenario 的覆盖状态。
   - compound 不只沉淀经验，也能沉淀 contract evolution lesson。

3. 建端到端 workflow eval corpus。
   - 覆盖 PRD -> plan -> task -> work -> review -> compound。
   - 指标不只 pass/fail，还包括 planning invention、context miss、unsupported closeout、review residual、acceptance coverage。

4. 建可采纳性产品表面。
   - `spec-first guide` / next-step assistant；
   - demo repo；
   - replayable case study；
   - team adoption playbook；
   - lite/full profile templates。

5. 再考虑 workflow/profile/extension 生态。
   - 等核心 contracts 稳定后再开放。
   - 避免先平台化，后补治理。

## 6. 最弱结论、偏见与待核验材料

### 6.1 最弱结论

“活契约 + Delta 是长期最大杠杆”是逻辑上最强、但实证上最弱的结论。

它来自本仓同源调研和 OpenSpec 对标，能很好解释“强过程、弱状态”，但缺真实 spec-first 用户痛点证据。它应作为 P1 乘数项，不应压过 P0 evidence quality loop。

### 6.2 主要偏见

- **owner / 架构治理偏见**：容易高估 contract、artifact、schema、review 的价值，低估普通开发者对速度、少问问题、少读长文档的需求。
- **同源研究偏见**：6/19 多份报告由同一作者同一日产生，结论收敛不等于独立佐证。
- **spec-first 内部视角偏见**：本报告更熟悉 spec-first 的治理资产，可能低估 Codex / Copilot / Sonar 等产品在低摩擦入口上的优势。
- **证据可得性偏见**：本仓 source evidence 强，外部 2026 材料存在部分页面不可稳定抓取，导致外部数据更偏定性。

### 6.3 需要继续核验

1. Sonar 2026 State of Code 原始报告 URL 与 AI code trust / verification 数据点。
2. 正式 2026 DORA / Stack Overflow 年度报告是否发布，以及其对 AI adoption / trust / productivity 的最新结论。
3. 真实 P-friction 样本：至少 10-20 个真实 run.json + 用户访谈/会话记录。
4. `spec-prd` live-output eval：是否真的减少 planning invention。
5. work/debug missed-recall traces：是否确有相关 `docs/solutions` 存在却未被召回。
6. 端到端 workflow benchmark：spec-first 是否减少需求误实现、返工和 unsupported closeout。
7. `storm-research` 是否需要成为 source-level methodology artifact，还是保持为研究风格即可。

## 7. 最终建议

下一阶段 owner 应把路线图从“继续扩 capability”转成“证明 capability 真的提升需求开发质量”。

建议立即推进：

1. P0 evidence quality loop：artifact quality + honest closeout integration + eval corpus。
2. PRD live-output eval 与 PRD miss feedback。
3. P-friction 审计。
4. work/debug context activation wiring。

暂缓但保持设计：

1. behavior contract + Delta。
2. workflow/profile/extension 生态。
3. graph-primary 升级。

判断标准很简单：凡是能让团队更快判断“这个需求、计划、实现、验证是否可信”的能力，优先；凡是只让 harness 更完整但不能降低采用摩擦或提升可验证性的能力，后置。
