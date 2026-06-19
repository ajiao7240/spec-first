# AI 编程团队落地阻力与 spec-first 需求开发短板：STORM 多视角研究简报

日期：2026-06-20
作者：leokuang
目标读者：spec-first owner / 总架构师
研究场景：`general_research` + code-aware report review
研究方法：按用户提供的外部本地 `storm-research` skill 做 inline STORM 多视角扫描、矛盾地图、综合判断和同行评审自检。未使用 subagents/personas/parallel agents；本文不声称有独立 agent 评审。

## 0. 本次修订结论

这份报告的核心结论仍成立：AI 编程团队落地的主要阻力不是“模型会不会写代码”，而是团队能否持续信任、监督、复用、验证和度量 AI 参与的软件工程过程。`spec-first` 的战略位置也正确：它把一次性 AI coding chat 收进 repo-backed engineering loop。

但原报告有 4 个必须修正的问题：

1. 不能写“结合 5 个 lens subagent 的独立分析结果”。本次没有用户授权 subagent/persona dispatch，也没有可回放的 agent 输出证据；改为 inline STORM 多视角编排。
2. 不能引用“上一轮 web lookup 记录过”的外部数据。所有外部事实必须在本文列出可归档来源；无法稳定核验的数据降级为待核验。
3. 不能把仓库能力写成旧状态。`spec-prd` 已有 deterministic recorded-fixture checker delta；`spec-plan` 已有 PRD handoff entropy check；`spec-debug` 已默认直接扫描 `docs/solutions/` frontmatter；这些都要反映进报告。
4. 不能把“机制就位”写成“效果已证明”。`verification-run-summary.v1`、`honest-closeout.v1`、PRD checker、recall 边界都是重要机制，但还需要 live workflow / model-executed / user-friction evidence 才能证明需求开发质量显著提升。

最终建议：下一阶段优先级应是 **P0 证据质量闭环 + PRD live semantic eval + P-friction 审计**，然后再推进 **context activation hardening** 和 **behavior contract + Delta**。不要先扩更多 agent、更多 workflow，或新增重 source-of-truth 表面。

## 1. 研究边界

### 1.1 证据等级

| 等级 | 含义 | 本文用法 |
| --- | --- | --- |
| `confirmed-source` | 已从当前 worktree source / docs / tests / scripts 直接确认 | 用于判断 `spec-first` 当前能力与边界 |
| `external-current` | 2026-06-20 本次联网核验到的外部来源 | 用于判断行业趋势、采用阻力和信任缺口 |
| `inference` | 基于 confirmed evidence 的架构推断 | 用于路线排序和风险判断 |
| `gap` | 当前缺可验证材料 | 用于后续核验清单，不作为结论支柱 |

### 1.2 本仓 confirmed-source

- `README.md`：`spec-first` 定位是 “AI Coding Harness for Claude Code and Codex”，把一次性 AI coding chat 转为 repo-backed engineering loop；核心信任模型是 “Scripts prepare facts. LLMs make semantic judgments. Evidence stays in your repository.”
- `docs/10-prompt/结构化项目角色契约.md`：确认六层 Harness、`Scripts prepare, LLM decides`、source/runtime 边界、强 gate vs 轻判断，以及“可采纳性 / 可外部验证性 / 表达可信度”是一等守护结果。
- `skills/spec-prd/SKILL.md`：`spec-prd` 面向 brownfield PRD；默认 artifact 是 `docs/brainstorms/*-requirements.md` + `artifact_kind: prd-requirements`，目标是沉淀 WHAT/WHY、current-state evidence、acceptance、scope boundary，避免 `spec-plan` 发明产品行为。
- `skills/spec-prd/scripts/check-prd-artifact.js` 与 `docs/validation/spec-prd/output-eval-2026-06-20-checker-delta.md`：已有 deterministic PRD artifact checker 和 5 个 recorded fixture 的 checker delta；它证明 checker 能区分低质量 PRD 结构，不证明 live LLM 生成质量。
- `skills/spec-plan/SKILL.md`：当 origin 是 PRD-grade requirements 时，已有 PRD handoff entropy check；如果 plan 仍需发明 canonical term、source-of-truth、domain ownership、slice acceptance/source/scope，应 route to PRD refine 或输出 inline PRD feedback candidate。
- `skills/spec-work/SKILL.md`：有 recall trust boundary、direct evidence boundary、capability-class evidence boundary、`verification-run-summary.v1` / `honest-closeout.v1` closeout 集成边界；但 `docs/solutions` 召回在 work 里仍主要是“消费/信任边界”，不是像 debug 那样默认直接扫描的入口步骤。
- `skills/spec-debug/SKILL.md`：已默认把 `docs/solutions/` recall 作为 orientation source，直接扫描 frontmatter；只在 trivial bug fast-path 跳过。
- `skills/spec-code-review/SKILL.md` 与 `skills/spec-doc-review/SKILL.md`：坚持 direct evidence boundary；code review 具备 `spec-learnings-researcher`、reviewer tier、verification/honest closeout 边界；doc review 对代码/现状声明要求 bounded direct reads。
- `docs/contracts/verification/verification-run-summary.md` 与 `docs/contracts/workflows/honest-closeout.md`：验证结果必须记录 passed / failed / not-run；空 evidence、自然语言 “tests passed” 或引用未覆盖子集会被降级。
- `docs/contracts/knowledge/knowledge-harness.md`：`docs/solutions/**` recall 是 advisory candidate，必须回源到 `source_refs` / `source_reads_required` 或当前 source/test/doc 才能升为 confirmed。
- `docs/11-业界调研/2026-06-19-spec-first-进化提升最终综合报告.md`：已把 P0 排为 Artifact Quality + Honest Closeout + Eval Loop，把 Behavior Contract + Delta 降为 P1 乘数项。
- `docs/06-待办事项/2026-05-28-spec-first-用户体感提升路线图.md`：P-friction 是用户体感路线图第一候选；真实 run evidence / session evidence 应驱动后续 task-pack default、inline review、graph-primary 等方向。

### 1.3 外部 current evidence

- Anthropic 2026 Agentic Coding Trends Report：报告把 agentic coding 的变化描述为从“写代码”转向“orchestrating agents”，并强调 setup、supervision、validation、human judgment。来源：<https://resources.anthropic.com/2026-agentic-coding-trends-report>。
- DORA / Google Cloud AI adoption 材料：DORA 提供 AI-assisted software development ROI framework，并在 2026 insight 中把 AI 采用描述为需要平衡 productivity、flow、stability、team/system impact 的 tensions。来源：<https://dora.dev/ai/>、<https://dora.dev/insights/balancing-ai-tensions/>。
- Sonar State of Code 2026：报告给出 AI-generated code 进入 commit 流程、开发者信任不足、验证不足等数据；其中“绝大多数开发者没有完全信任 AI code”“始终验证 AI code 的比例不足半数”直接支撑 trust/verification gap。来源：<https://www.sonarsource.com/blog/state-of-code-developer-survey-report-the-current-reality-of-ai-coding> 与 PDF <https://www.sonarsource.com/state-of-code-developer-survey-report.pdf>。
- Stack Overflow 2025 Developer Survey：AI tool 使用/计划使用比例高，但 trust 仍低；本文只把它作为 adoption/trust 背景，不冒充 2026 数据。来源：<https://survey.stackoverflow.co/2025/ai>、<https://stackoverflow.blog/2026/02/18/closing-the-developer-ai-trust-gap/>。
- METR 2025/2026：早期 2025 受控研究显示有经验开源开发者在所测任务上使用 AI 反而变慢；2026 调研材料继续提醒自报告提效估计存在口径和校准问题。它提醒我们不要把“主观提速”直接等同团队级 throughput。来源：<https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/>、<https://metr.org/blog/2026-05-11-ai-usage-survey/>。

### 1.4 降级或未使用证据

- Graphify：本次 `graphify query` 只返回泛概念节点，未能支撑 load-bearing 结论；按 provider_untrusted advisory 处理。
- `storm-research`：用户指定的是外部本地 skill 方法；本仓内没有同名 public workflow/source artifact。本文只把它作为研究方法，不声明它已是 spec-first 能力。
- 真实用户 P-friction：当前仍缺 10-20 个真实 run/session 样本和用户访谈/录像证据，不能证明哪一类摩擦最痛。

## 2. 结论先行

### 2.1 60 秒摘要

AI 编程团队落地已经越过“能不能生成代码”的阶段，进入“能不能信任工程过程”的阶段。外部材料共同指向同一矛盾：AI coding 使用率和主观收益在上升，但团队级质量、安全、验证、监督和 ROI 证明仍是主要瓶颈。

`spec-first` 的定位正好切中这个 gap：它不追求更多 agent，而是把需求、计划、任务、实现、验证、review 和知识沉淀成 repo-local evidence loop。它的最大优势是 source/runtime 边界、direct evidence、honest closeout、PRD/plan/task/work/review/knowledge 链路。

当前最大短板不是“没有 PRD workflow”或“没有 review workflow”，而是证据闭环尚未从机制层兑现为外部可验证质量：PRD 只有 recorded-fixture checker delta，还缺 live model-executed / blind A/B eval；closeout 和 verification 有合同，还需更多 workflow-integrated 使用证据；P-friction 仍缺真实样本；context activation 在 debug 已强化，work 仍需更明确默认入口。

因此路线排序应是：先把 PRD 质量、artifact 质量、closeout 可信度、review/verification coverage 和用户摩擦做成可回归证据，再引入 behavior contract + Delta 这类新增 source-of-truth 表面。

### 2.2 关键判断

| 判断 | 支持证据 | 反对/限制 | 置信度 |
| --- | --- | --- | --- |
| AI coding 落地的主阻力是 trust / oversight / verification / ROI，而非代码生成能力 | Anthropic / DORA / Sonar / Stack Overflow / METR 外部证据一致 | 各报告口径不同，不可直接合并成单一量化结论 | 8 |
| `spec-first` 战略层级正确，属于 AI Coding Harness 而非 prompt pack | README、角色契约、work/review/debug/compound 证据链 | 外部用户未必能从首次体验感知这套价值 | 8 |
| `spec-prd` 方向正确，但需求开发质量尚未被 live eval 证明 | `spec-prd` source + checker delta | checker delta 是 deterministic recorded fixture，不是 live LLM eval | 8 |
| P0 应先做 evidence quality loop，而非立刻做 behavior contract + Delta | 6/19 综合报告、honest-closeout、verification-run-summary、PRD checker 已有 surface | Delta 长期杠杆高，延后可能错过系统行为真相积累 | 7 |
| 用户体感改善必须先做 P-friction 审计 | 05/28 路线图 + 角色契约可采纳性要求 | 当前真实样本不足，审计本身也可能偏 owner 使用模式 | 7 |

## 3. Lens 选择

本题用普通研究 lens，但按主题改名为更贴近 AI 编程团队的 5 个视角：

| Lens | 核心追问 | 适用原因 |
| --- | --- | --- |
| 一线工程师 | 日常使用是否少返工、少解释、少被流程拖慢 | 决定团队是否真的愿意用 |
| 工程经理 / 组织采纳 | 局部提效是否转化为团队 throughput 和可控风险 | 对应 DORA / Anthropic 的 systems problem |
| 需求开发 / 产品语义 | PRD 是否让 downstream 不再发明 WHAT | 用户明确关心 spec-first 辅助研发做需求开发 |
| 质量 / 安全 / 验证负责人 | AI 产出能否被证明、review 和测试是否可信 | 对应 Sonar trust/verification gap |
| 架构治理 / 长期演化 | 是否保持 light contract、source/runtime 边界和知识闭环 | 对应 spec-first 自身使命 |

## 4. 5 视角扫描

| 视角 | 核心立场 | 最强证据 | 独有提醒 | 可能误判 |
| --- | --- | --- | --- | --- |
| 一线工程师 | 如果 spec-first 让小任务变慢、让开发者反复读长文档，团队会绕过它。 | 05/28 P-friction 路线图已把真实摩擦审计列为第一候选。 | 必须区分 high-risk full harness 与 small-change lite profile；不要让“正确治理”吞掉日常速度。 | 可能低估 artifact trail 对长任务、交接和 review 的价值。 |
| 工程经理 / 组织采纳 | 团队 adoption 需要可解释 ROI、监督机制和质量证据，而不是单次 demo 提速。 | DORA ROI / balancing tensions、Anthropic agent orchestration、METR 实证谨慎信号。 | run evidence 和 replay report 比宏大路线图更能说服团队。 | 可能把可测性过度管理化，忽略 creative coding 的即时收益。 |
| 需求开发 / 产品语义 | `spec-prd` 是正确节点，但还没证明 live 场景下能稳定减少 planning invention。 | `spec-prd` source、`spec-plan` PRD handoff entropy check、2026-06-20 checker delta。 | checker delta 只能证明结构检查器有用，不能证明 PRD 语义质量或模型输出稳定。 | 可能把 PRD 质量问题都归因于 workflow，低估产品 owner 输入质量。 |
| 质量 / 安全 / 验证负责人 | spec-first 护城河在 evidence-first；短板在 coverage claim 和完成声明仍需更多真实闭环证据。 | `verification-run-summary.v1`、`honest-closeout.v1`、Sonar 2026 trust/verification data。 | “测试跑过”不等于 acceptance 覆盖；需要把 AE/R/NFR 与 review/verification summary 建立更明确映射。 | 可能把风险控制做得过重，导致小任务 review friction 过高。 |
| 架构治理 / 长期演化 | 先兑现已有证据机制，再新增 behavior contract + Delta。 | 6/19 综合报告把 evidence loop 放 P0、Delta 放 P1；角色契约强调更清晰边界优先。 | 新 source-of-truth 表面一旦加错，回退成本高；必须有 P-friction/replay 证据支撑。 | 可能过度保守，延后了纵向系统行为真相的建设。 |

## 5. 矛盾地图

| 冲突点 | 相关视角 | 各方主张 | 冲突根因 | 当前证据强弱 | 要补的关键证据 |
| --- | --- | --- | --- | --- | --- |
| 提速 vs 可信 | 一线工程师 / 质量负责人 | 工程师希望少步骤；质量负责人要求 evidence 和 review | 局部速度与团队风险口径不同 | 外部强，本仓机制强，真实体感弱 | P-friction 样本 + not-run/review residual 分布 |
| PRD 结构检查 vs 语义质量 | 需求开发 / 架构治理 | checker 能抓结构问题；语义质量仍由 LLM/readiness 判断 | script-owned facts 与 LLM-owned judgment 边界 | 本仓 confirmed | live model-executed PRD eval + blind doc-review |
| Context recall vs 上下文噪声 | 一线工程师 / 架构治理 | 召回历史经验可减少重复错误；过量召回会污染上下文 | recall 是候选，不是 confirmed truth | knowledge contract 强，work 入口证据中等 | work/debug missed-recall trace 与 precision/false-positive 样本 |
| Behavior contract + Delta 先做还是后做 | 架构治理 / 质量负责人 | Delta 解决纵向系统行为真相；证据 loop 未稳前新增 source surface 风险高 | 长期乘数项与短期可验证性冲突 | 6/19 同源调研强，用户实证弱 | replay report 证明 behavior truth 缺失是高频痛点 |
| Full harness vs lite profile | 一线工程师 / 组织采纳 | 高风险任务需要完整链路；小任务需要低摩擦 | 风险分层和用户意图识别尚不够产品化 | 路线图 confirmed，实测弱 | 按任务类型统计 workflow cost / residual risk |

### 最大待解问题

如果只能回答一个问题来消解最大分歧，这个问题是：

> 在真实团队日常使用中，`spec-first` 最常造成或减少返工的环节是哪一个：PRD 语义、上下文召回、task-pack、review/verification，还是入口摩擦？

没有这个答案，路线图很容易继续由 owner 架构直觉驱动，而不是由用户体感和质量结果驱动。

### 高一致性结论

- `spec-first` 的核心差异化应继续放在 evidence loop、source/runtime 边界、review/knowledge 闭环，而不是 agent 数量。
- `spec-prd` 是需求开发链路中正确的前置节点，但需要更强的 live output eval。
- 完成声明、验证声明和 review coverage 必须结构化，否则团队不会长期信任 AI 产出。
- 行业 adoption gap 与 spec-first 的定位高度匹配，但外部可采纳性和首次试用路径仍弱。

### 无人覆盖的盲区

- 没有真实团队 adoption trial：当前多为 owner / source-level / workflow-level evidence。
- 没有端到端 PRD -> plan -> work -> review replay corpus。
- 没有按任务风险分层的成本/收益数据。
- 没有对“普通开发者是否理解 spec-first 价值”的外部可用性测试。

## 6. 对 spec-first 需求开发短板的深度审查

### 6.1 已有能力

`spec-first` 已覆盖需求开发主链路的关键节点：

```text
rough request
  -> spec-prd / brainstorm
  -> spec-plan
  -> spec-write-tasks
  -> spec-work
  -> spec-code-review / spec-doc-review
  -> spec-compound
```

其中最重要的能力不是“每一步都有一个 workflow”，而是每一步都有边界：

- PRD 负责 WHAT/WHY/acceptance/scope/evidence，不写 HOW。
- Plan 负责 HOW，不应发明 load-bearing WHAT。
- Task pack 有 `spec_id` / `source_plan_hash` / validation，但 deterministic validation 不证明语义质量。
- Work closeout 使用 verification/honest-closeout 边界，避免 freeform 完成声明。
- Review 强调 direct evidence，不能用外部 provider 或 recall candidate 直接生成 confirmed finding。
- Knowledge promotion 要 verified、可复用、有 invalidation condition。

### 6.2 当前短板

| 短板 | 当前真实状态 | 为什么重要 | 建议优先级 |
| --- | --- | --- | --- |
| PRD live semantic eval 缺失 | 已有 5-case recorded checker delta；缺 live model-executed / file-backed fixture / blind A/B review | 无法证明 `spec-prd` 在真实输入下减少 planning invention | P0 |
| Artifact quality gate 未统一 | PRD checker 已有；plan/task/review 质量语言仍分散 | 下游依赖 artifact，但 artifact 自身质量不稳定会放大错误 | P0 |
| Closeout/verification 机制需更多真实集成证据 | 合同和 producer 存在；需要更多 run/replay 使用证据 | 团队信任 AI 产出依赖完成声明可信 | P0 |
| P-friction 未审计 | 路线图存在；缺真实样本 | 不能判断该减流程、加默认 task-pack、还是改入口文案 | P0 |
| Work context activation 仍偏弱 | Debug 已默认扫 `docs/solutions`；Work 有 recall trust boundary，但缺类似默认扫描步骤 | work 阶段最容易重犯历史经验和忽略项目约定 | P1 |
| PRD miss feedback 只在 plan 边界 | `spec-plan` 可输出 inline PRD feedback candidate；review/work 尚无系统回链 | 需求问题往往到实现/review 才暴露 | P1 |
| Behavior truth 仍缺纵向 source | 6/19 报告已识别强过程、弱状态 | Review 只能对照本次 plan，难发现 plan 外行为回归 | P1，需 P0 证据后置 |
| 外部可采纳性弱 | README 已改善；仍缺 demo/replay/adoption playbook | owner 懂不代表团队愿意试 | P1/P2 |

### 6.3 不能再这样表述

- 不应写“缺 PRD eval”。应写“已有 deterministic recorded-fixture checker delta，缺 live model-executed semantic eval”。
- 不应写“work/debug 都缺 recall wiring”。应写“debug 已默认直接扫 `docs/solutions`；work 仍缺同等默认入口，只有 recall trust/consumer boundary”。
- 不应写“外部报告证明 AI coding 一定提效”。应写“外部报告显示 adoption 和主观收益强，但 trust/verification/ROI 和 METR 实证提醒仍要求谨慎”。
- 不应写“behavior contract + Delta 是立即最大杠杆”。应写“长期乘数项高，但新增 source-of-truth 表面，需 P0 evidence loop 和用户痛点证据先行”。

## 7. 综合简报

### 7.1 5 个关键发现

| 排名 | 发现 | 支持视角 | 反对/质疑视角 | 置信度 | 依据类型 |
| --- | --- | --- | --- | --- | --- |
| 1 | AI coding adoption 的核心瓶颈是 trust / oversight / verification / ROI | 组织采纳、质量负责人 | 一线工程师可能只关心即时速度 | 8 | external-current |
| 2 | `spec-first` 战略层级正确，应该继续做 harness，而不是 agent collection | 架构治理、组织采纳 | 外部用户可能觉得入口重 | 8 | confirmed-source + inference |
| 3 | `spec-prd` 已有结构质量机制，但需求开发质量证明仍弱 | 需求开发、质量负责人 | checker delta 已是早期正信号 | 8 | confirmed-source |
| 4 | P0 应兑现 evidence loop，而非先加 behavior contract source surface | 架构治理、质量负责人 | Delta 长期价值很高 | 7 | confirmed-source + inference |
| 5 | P-friction 是路线图排序的必要前置 | 一线工程师、组织采纳 | 样本可能偏 owner 使用模式 | 7 | confirmed-source + gap |

### 7.2 隐藏连接

外部行业的 trust gap 和 spec-first 内部的 evidence loop 是同一个问题的两面：

- Sonar / Stack Overflow 看到的是开发者不完全信任 AI code。
- DORA / Anthropic 看到的是组织采用需要 system-level oversight。
- spec-first 的解法不是“再相信一个 agent”，而是让每个判断都能回到 repo-local artifact、source refs、verification summary、review finding 和 reusable learning。

这说明 spec-first 不应把自己宣传成“更聪明的 AI 编程助手”，而应表达为“让 AI coding 可交接、可复审、可验证、可复用的工程闭环”。

### 7.3 可行动建议

对 spec-first owner 而言，下一步应该按以下顺序推进：

1. **PRD live semantic eval**
   用 10-20 个 brownfield fixtures 跑 `spec-prd` live output，对比 baseline rough PRD / brainstorm / no-PRD output。评分维度：current-state accuracy、Change Delta clarity、Acceptance coverage、Scope Boundaries、planning-invention risk。保留 raw outputs 在仓外或受控路径，只把 scorecard 和 reviewer adjudication 落 source。

2. **P-friction 审计**
   选真实 run/session 样本，分类入口摩擦、上下文重复、PRD 过重、task-pack 成本、review 等待、verification not-run、final response 不清。只产 finding，不直接 fix。

3. **Artifact quality gate v1**
   以最小 checklist / checker facts 统一 PRD、plan、task-pack、review 的质量语言。保持 script-owned facts 与 LLM-owned judgment 边界，不做大 schema 平台。

4. **Work context activation 补齐**
   将 debug 的直接 frontmatter scan 思路校准后接入 work context orientation；召回仍为 advisory，必须回源确认。

5. **Replay report**
   选 3-5 个真实需求链路，从 PRD 到 plan/work/review 复盘：哪些 acceptance 被验证、哪些 closeout 降级、哪些 review finding 反推 PRD miss。

前提：

- 不把 checker/eval/report 写成业务 ROI 证明。
- 不新增 generated runtime patch。
- 不把 `docs/solutions` 命中当 confirmed truth。
- 不把外部报告的 adoption 数据直接等同 spec-first adoption。

代价：

- 这些工作短期不如新增 agent 或 demo flashy。
- 会暴露当前 workflow 质量缺口，可能推迟 behavior contract + Delta。
- 需要维护少量 eval/replay evidence，增加 owner 纪律成本。

### 7.4 前沿问题

如果被回答，会改变我们对 spec-first 路线排序的问题是：

> 在真实 brownfield 需求开发中，`spec-prd` + `spec-plan` 相比普通 AI coding prompt，能否显著降低 planning invention、实现返工和 unsupported closeout？

如果答案是“能”，spec-first 的 harness 价值就有外部可验证抓手；如果答案是“不能”，应优先简化 PRD/plan 体验，而不是继续叠治理机制。

## 8. 路线排序

### P0：0-2 周

1. 建 `spec-prd` live semantic eval v1。
2. 做 P-friction 样本定义和首批审计。
3. 扩 PRD checker scorecard 到 report-friendly closeout，不把它升级成语义 gate。
4. 把 PRD miss feedback 从 `spec-plan` 当前边界记录成可 replay 的 report item。
5. 更新 README / docs 的对外表达：强调 evidence loop，不宣传“自动提效”。

### P1：1-2 个月

1. Work context orientation 默认接入 `docs/solutions` recall 候选，保持 advisory + 回源确认。
2. 将 AE/R/NFR 与 verification-run-summary / review finding 建弱映射，先做 report，不做硬 gate。
3. 建 fresh review protocol：先查 origin faithfulness / spec compliance，再查一般代码质量。
4. 形成 lite/full risk-tier profile，final response 明确 review/verification tier。
5. 输出 3-5 个 replay reports，评估需求开发质量是否真的提升。

### P1/P2：证据稳定后

1. Behavior contract + Delta：只有当 replay/P-friction 证明纵向行为真相缺失是高频痛点时再进入。
2. Adoption proof：demo repo、case study、team adoption playbook。
3. Workflow profile / extension：等核心 contracts 稳定后再平台化。

## 9. 同行评审自检

| 检查项 | 结论 |
| --- | --- |
| 最强结论 | `spec-first` 的 harness 定位与行业 adoption/trust gap 高度匹配。 |
| 最弱结论 | Behavior contract + Delta 的长期杠杆仍主要来自同源调研和架构推断，缺真实用户痛点证据。 |
| 最可能的偏置 | owner / 架构治理偏见：容易高估 artifact/contract 的价值，低估普通开发者对低摩擦的需求。 |
| 缺失第 6 视角 | 企业安全 / 法务 / 合规采购视角；本文只触及安全验证，没有评估企业引入门槛。 |
| 最需要核验的事实 | `spec-prd` live output 是否减少 planning invention；P-friction 的最大来源到底是哪一环。 |
| 总体可靠性 | 7/10。仓库 source 证据强，外部趋势证据中等，真实采用与 live eval 证据不足。 |

### 需要降级的表述

- 原表述：`spec-prd` 缺 eval。
  降级为：已有 deterministic recorded-fixture checker delta；缺 live model-executed semantic eval 和 blind A/B review。

- 原表述：work/debug recall wiring 不完整。
  降级为：debug 已默认直接扫描 `docs/solutions`；work 仍缺同等默认入口，当前主要是 recall trust/consumer boundary。

- 原表述：外部材料证明 AI coding 团队提效。
  降级为：外部材料显示 adoption 和主观收益强，但 trust/verification/ROI 和 METR 实证提醒要求谨慎。

- 原表述：5 个 lens subagent 独立分析。
  降级为：本报告使用 inline STORM 多视角编排，未执行独立 subagent/persona review。

### 后续核验清单

1. `spec-prd` live model-executed output eval：至少 10-20 个真实 brownfield 输入。
2. Blind doc-review / code-aware review：判断 PRD 是否减少 downstream invention。
3. P-friction audit：至少 10 个真实 run/session 样本。
4. Work recall missed-trace：找 2-3 个相关 `docs/solutions` 存在但 work 未召回的真实案例。
5. Verification / review coverage replay：AE/R/NFR 到 test/review finding 的覆盖情况。
6. Behavior contract + Delta 前置证据：证明系统行为真相缺失是高频痛点。
7. 企业 adoption 视角：安装、权限、安全、artifact 泄露、合规和培训成本。

## 10. 最终建议

本报告建议 owner 把下一阶段目标从“继续扩 capability”改为：

> 证明 spec-first 真的让需求开发更少发明、更少返工、更可验证、更容易被团队采纳。

立即推进：

1. PRD live semantic eval。
2. P-friction 审计。
3. Artifact quality + honest closeout + verification replay。
4. Work context activation 补齐。

暂缓但保留设计：

1. Behavior contract + Delta。
2. Workflow/profile/extension 生态。
3. Graph evidence primary upgrade。

最终判断标准：凡是能让团队更快判断“这个需求、计划、实现、验证是否可信”的能力，优先；凡是只让 harness 更完整但不能降低采用摩擦或提升可验证性的能力，后置。
