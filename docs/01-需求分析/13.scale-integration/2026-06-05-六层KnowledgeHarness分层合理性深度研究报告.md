# 六层 Knowledge Harness 分层合理性深度研究报告

日期：2026-06-05
作者：leokuang
对象：`spec-first` v1.15 Knowledge Harness / SCALE 集成 Phase D

## 结论

六层分层作为 **Knowledge / Context / Capability 的全局能力地图** 是合理的；作为 v1.15 一次性落地的 **六层实现栈** 不合理，存在范围外溢和过度设计风险。

更准确的定位应是：

```text
六层 = AI coding harness 的知识相关能力地图
v1.15 = 最小 Knowledge 闭环切片
```

v1.15 应重点落：

- L2 的 summary-first handoff 消费纪律，但不重建 Context Harness。
- L4 的 `docs/solutions` recall boundary，把历史经验标成 advisory candidate。
- L6 的 verified promotion gate，把已验证经验沉淀为 durable knowledge。

L1 已由现有项目上下文和 PRD/plan/doc-review 入口覆盖；L3 应延后到 v1.16 capability-aware code intelligence；L5 只能作为 advisory capability lens，不能成为 v1.15 completion gate。

因此，推荐把当前命名从“六层 Knowledge Harness”收敛为 **“Knowledge Harness 六层协同地图”**，并在落地计划中明确：六层表是边界地图，不是新平台、新状态机或六个并行 contract。

## 研究依据

### 本地 source evidence

- `docs/10-prompt/结构化项目角色契约.md`：定义核心链路 `Codebase -> Context -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge`，并要求 `Light contract + Explicit boundaries + Let the LLM decide`。
- `docs/contracts/ai-coding-harness.md`：已有 Context / Execution / Evidence / Evaluation / Governance / Knowledge 六层 Harness 总图，要求新 contract 只补最小 durable mechanism。
- `docs/contracts/context-bundle.md`：已有 context request/bundle envelope、included/excluded reason、budget、full read triggers 与 `source_reads_required` 消费规则。
- `docs/contracts/artifact-summary.md`：已有 summary-first handoff contract，明确 summary 不是 source-of-truth，consumer 必须按 trigger 回源。
- `skills/spec-compound/references/schema.yaml`：已经声明自己是 `docs/solutions/` frontmatter canonical contract。
- `docs/01-需求分析/13.scale集成/spec-first内化集成scale-project-scaffold技术方案.md` §5.3：给出六层表，并明确 provider 输出只是 candidate、setup facts 不替代语义判断、未验证经验不进 durable knowledge。
- `docs/plans/2026-06-05-003-feat-knowledge-harness-plan.md`：把 v1.15 拆为 context budget、summary-first handoff、docs/solutions promotion、memory recall boundary、capability lens。
- `package.json.files`：当前列出具体 `docs/contracts/*` 路径，尚未包含未来的 `docs/contracts/knowledge/`，说明新增 contract 必须同步发布清单。

### 外部 grounding

- `Lost in the Middle: How Language Models Use Long Contexts`（arXiv:2307.03172）显示长上下文模型对中间位置相关信息使用不稳定，支持 L2 context budget 和 summary-first，而不是“给越多越好”。
- `Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection`（arXiv:2310.11511）指出不加判别地检索和纳入固定数量 passages 会降低质量，支持 L4 recall-as-advisory。
- `Corrective Retrieval Augmented Generation`（arXiv:2401.15884）通过 retrieval evaluator 给检索文档质量打 confidence，再触发不同知识动作，支持 recall 需要评价和回源。
- `Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory`（arXiv:2504.19413）支持长期记忆对多会话 agent 有价值，但其 graph/vector memory 面向可扩展多会话体系，不构成当前 17 篇 `docs/solutions` 默认引入外部 memory 平台的理由。
- Anthropic `Contextual Retrieval in AI Systems` 体现 retrieval 可以结合 semantic embeddings、BM25 等方法，说明业界是 hybrid posture；file-first 只能按当前规模、审计性和写入摩擦成立，不应写成“embedding 已过时”。
- NIST AI 100-2e2025 DOI 指向正式 PDF，能作为知识库投毒威胁模型背景，但不能被表述为“官方推荐 candidate -> review -> promote”。

## 判定标准

本报告按以下标准判断“分层是否合理”：

1. 是否服务核心链路，而不是生成架构装饰。
2. 是否让 LLM 获得更高质量输入，或让输出更可验证、可复用。
3. 是否明确 source/runtime、provider/workflow、script/LLM 边界。
4. 是否避免把 advisory facts 当 confirmed truth。
5. 是否复用已有合同，而不是制造第二套 source-of-truth。
6. 是否有直接 consumer；无消费方则不交付。
7. 是否能以最小 durable mechanism 解决高频问题。

## 总体评价

六层本身是合理的，因为它把 AI coding 中经常混在一起的六类问题拆开：

| 层 | 解决的问题 | 正确定位 |
| --- | --- | --- |
| L1 Project Context / Domain | 项目是什么，术语和 source-of-truth 在哪 | domain/source context |
| L2 Context Budget / Bundle | 本次任务该给 AI 哪些上下文，哪些不读 | context economy |
| L3 Code Intelligence | 哪些代码、调用链、测试可能受影响 | code navigation candidate |
| L4 Memory / Prior Decisions | 过去有没有类似修复、RCA、拒绝方案 | historical advisory recall |
| L5 Skill / Tool Capability | 当前有哪些 skill/MCP/CLI 能力可用 | capability awareness |
| L6 Evidence / Promotion | 什么经验可以沉淀为长期知识或治理规则 | durable knowledge promotion |

这张表的价值在于 **防混淆**：

- 不把“项目背景”当成“历史结论”。
- 不把“检索命中”当成“confirmed truth”。
- 不把“工具已安装”当成“工具输出可信”。
- 不把“summary”当成“原始 artifact 的替代 source”。
- 不把“经验文档存在”当成“已经验证”。

但是，六层如果被实现为六个新系统，就会违反 `spec-first` 的演化原则。它不能变成中心化 Context Router、Knowledge Runtime、Skill Radar、graph provider adapter、memory platform 或 hard state machine。正确做法是让每层成为已有 workflow 的边界语言和最小 contract 增量。

## L1 Project Context / Domain

### 作用

L1 负责回答：

- 这个项目的目标、术语、角色、架构禁忌是什么？
- 当前 source-of-truth 在哪里？
- 哪些文件是历史参考，哪些文件是当前治理 source？

它让 LLM 不必从零解释项目，也降低“拿历史计划当当前执行 contract”的风险。

### 边界

- Source-of-truth 主要来自 `README`、`AGENTS.md` / `CLAUDE.md` source slice、`docs/contracts/**`、当前 PRD/plan 和用户明确给定文档。
- 不强制新增 `CONTEXT.md`。
- 不把历史 plans、validation reports 或 generated mirrors 当 runtime truth。
- L1 缺失时是 advisory gap，不应阻塞普通轻量任务。

### 能带来的效果

- 减少术语漂移。
- 让 plan/review 能以项目真实边界判断 scope。
- 降低“LLM 用错 source-of-truth”的概率。

### 过度设计风险

L1 如果新建固定 project-context-map、强制 glossary、强制 ADR 目录，会变成重型治理前置。当前 `spec-first` 已有足够 source context，v1.15 不应新增 L1 实现。

### 判断

L1 分层合理；v1.15 只引用，不交付。

## L2 Context Budget / Bundle

### 作用

L2 负责回答：

- 本次任务应读哪些上下文？
- 哪些上下文被排除，原因是什么？
- 是否先用 summary，再按 trigger 展开全文？
- budget 超限或 evidence degraded 时，如何诚实说明？

这层直接回应长上下文并不等于高质量上下文的问题。`Lost in the Middle` 的结论支持“上下文位置和选择会影响表现”，所以需要 budget、summary-first 和 precise path。

### 边界

- L2 属于 Context Harness，不是 Knowledge Harness 本体。
- 已有 `context-bundle.v1` 和 `artifact-summary.v1`，不要重建第二套 bundle/schema。
- 脚本只能准备路径、预算、reason_code、exclusion facts；LLM 判断语义 relevance 和是否展开 full artifact。
- Summary 是 handoff，不是 source-of-truth；consumer 必须能回到 `source_path`、`evidence_paths` 或 `source_reads_required`。

### 能带来的效果

- 降低跨 workflow 复制长 artifact 的 token 成本。
- 让 reviewer/worker 先看高信号摘要，再按需要回源。
- 让上下文遗漏从“沉默丢失”变成可记录的 `excluded_context` / `degraded` / trigger。
- 改善 plan -> work -> review 的 handoff 质量。

### 过度设计风险

如果 L2 被实现成中心化 Context Router、semantic ranker、provider fusion engine 或自动上下文决策器，就会越界。已有合同已经足够，v1.15 只需要让 named workflows 真的消费 summary-first，并记录 expand-on-trigger。

### 判断

L2 分层合理；但它不是 v1.15 的新 Knowledge contract。正确交付是消费纪律，不是新平台。

## L3 Code Intelligence

### 作用

L3 负责回答：

- 改某个符号或文件可能影响谁？
- 哪些测试可能相关？
- 哪些调用链、路由、组件、API contract 值得优先读？

它帮助缩小代码读取范围，尤其在大仓中有价值。

### 边界

- L3 输出是 code navigation candidate，不是 confirmed evidence。
- 外部 code-graph / project-graph 工具只提供 advisory candidate；finding、root cause、scope authority 必须来自 source/test/log/contract/user evidence。
- install 可以由 setup 帮装，但消费侧只认 capability class，不写死 provider 名，不依赖 provider 内部 schema。
- 缺失时 fallback 是 `rg`、ast-grep、direct source reads。

### 能带来的效果

- 在大仓中提高影响面定位效率。
- 减少盲目 broad read。
- 给 code-review/debug 提供更好的候选路径。

### 过度设计风险

L3 是最容易重蹈 GitNexus 错误的层：一旦把 provider 名、内部命令、产物 schema、startup reminder 或 review-pre-facts 焊进 workflow，能力工具就会变成核心编排依赖。

### 判断

L3 分层合理；但应归 v1.16 capability-aware 协同，不应放进 v1.15 Knowledge Harness 核心实现。

## L4 Memory / Prior Decisions

### 作用

L4 负责回答：

- 是否已有类似修复、RCA、架构取舍或团队约束？
- 是否曾拒绝过某种方案，原因是什么？
- 当前问题能否复用过去经验？

这是 Knowledge Harness 的核心层之一。它把“每次都从零开始”转为“先看已有经验，但不盲信经验”。

### 边界

- `docs/solutions/**` 是第一 durable store。
- Recall 命中只是 advisory candidate。
- 历史经验必须回源到 source/test/doc/log/user evidence 才能成为 confirmed context。
- session summaries、agent memory、外部 memory 工具都不能直接成为 durable truth。
- 存量 17 篇 solution 可以保留为 legacy knowledge，但不能因为 grandfathered 就自动宣称 verified。

### 能带来的效果

- 减少重复踩坑。
- 让 rejected alternatives 和 invalidation condition 能被下一次 plan/review 看见。
- 提高 debug 和 planning 的启动质量。
- 为 `spec-compound` / `spec-compound-refresh` 提供更明确的存量知识生命周期。

### 过度设计风险

L4 的风险是把小规模知识库做成重型 memory 平台。当前 `docs/solutions` 只有 17 篇，file-first + grep + structured frontmatter 的 ROI 高于默认引入向量库、SQLite 或外部 memory 服务。Mem0 这类长期记忆架构说明 persistent memory 有价值，但它面向多会话、大规模、动态 memory 系统，不是当前默认 source-of-truth。

### 判断

L4 分层合理，且是 v1.15 必须落的核心。最小机制是 recall advisory + source confirmation + legacy/current freshness 边界。

## L5 Skill / Tool Capability

### 作用

L5 负责回答：

- 当前任务有哪些 skill、agent、CLI、MCP、browser/tool capability 可用？
- 某个能力是否 fresh、stale、degraded、not-run 或 unknown？
- 缺失时是否有 fallback？

它的价值是减少 agent 忽略已有工具的情况，也防止“装了工具就默认可信”。

### 边界

- L5 是 capability awareness，不是强路由。
- Setup facts 只能说明机械 readiness，不替代语义判断。
- 不新增 Skill Radar，不让 capability lens 变成 public workflow selector。
- 不在 plan/work/review 运行期主动弹安装。
- 不把 tool output 当 confirmed truth。

### 能带来的效果

- 提升工具利用率。
- 让 degraded mode 更诚实。
- 让 optional provider 与 workflow consumption 解耦。

### 过度设计风险

L5 的动机比 L4/L6 弱。如果为了它新增 registry schema、router、自动 skill selection 或 setup-to-work 强状态链，就会得不偿失。当前最合理形态是短 prose：如果工具箱存在某类 capability，可作为 advisory candidate 使用；缺失则 fallback。

### 判断

L5 分层合理；但 v1.15 只能 advisory，最好不进入 completion gate。若无干净 consumer，应砍到 follow-up。

## L6 Evidence / Promotion

### 作用

L6 负责回答：

- 哪些经验可以从 session-local 过程产物晋升为 durable knowledge？
- 哪些 evidence 足以支持 promotion？
- 什么时候只是 candidate，什么时候可进入 `docs/solutions`？
- 什么情况下从 knowledge 晋升为 governance rule？

这是 Knowledge Harness 的另一个核心层。没有 L6，L4 会变成“召回一堆未经验证的历史笔记”；有 L6，经验沉淀才可治理。

### 边界

- Promotion gate 定位为噪声/质量控制，不是安全防御。
- 未验证经验不进 durable knowledge。
- Blocking governance rule 需要人工批准，不能由 LLM 自动晋升。
- `spec-compound` 当前已有 canonical frontmatter schema；新增 `solution-promotion.v1` 不能制造第二套 truth。
- Candidate -> review -> promote 是 workflow 语义；schema 只能校验结构，不能证明经验正确。

### 能带来的效果

- 防止 raw transcript archive。
- 防止把临时结论、模型猜测和未验证经验写入长期知识。
- 让每条 solution 有适用范围、失效条件、证据路径和拒绝方案。
- 支持后续 `spec-compound-refresh` 识别 stale knowledge。

### 过度设计风险

L6 容易把 promotion gate 做成重型审批系统、签名系统或安全沙箱。当前需要的是最小 durable mechanism：结构化 frontmatter + provenance/source refs + invalidation condition + verified gate。不要声称 NIST 或 Anthropic 明文推荐这套流程；外部依据只支持“需要质量/威胁边界”，具体 workflow 由 spec-first 自己负责。

### 判断

L6 分层合理，且是 v1.15 必须落的核心。但它必须复用或迁移现有 `spec-compound` schema，避免双真相源。

## 六层之间的正确关系

六层不是线性流水线，而是任务中会被不同 workflow 按需调用的能力地图：

```text
L1 提供项目语义边界
L2 控制上下文预算与 handoff 形态
L3 提供代码影响面候选
L4 提供历史经验候选
L5 提供可用能力候选
L6 决定哪些候选能沉淀为 durable knowledge / governance
```

其中 L3/L4/L5 的共同点是 candidate；L2 提供 candidate 的传递方式；L6 决定 candidate 是否能晋升；L1 提供判断 candidate 是否适用于当前项目的背景。

必须保持两条正交信任轴：

1. Provider readiness：工具是否 installed/configured/fresh/degraded。这是机械事实，归 setup/doctor/helper。
2. Evidence trust：输出是否 advisory、evidence_candidate、confirmed_context、durable_knowledge、governance_rule。这是语义判断，归 workflow/LLM + source/test/log/user confirmation。

这两条轴不能合并。工具 fresh 只表示工具状态新鲜，不表示结论正确。

## 可以带来的整体效果

如果按轻量地图落地，六层能带来五类效果：

1. **上下文更少但更准**：L2 让下游先读 summary 和 paths，减少 full artifact 广播。
2. **历史经验可复用但不盲信**：L4 让 `docs/solutions` 被召回，L6 要求 verified 才沉淀。
3. **外部能力更可用但不耦合**：L3/L5 允许 capability-aware use，避免 provider-specific 深度绑定。
4. **证据链更清晰**：candidate、confirmed、durable knowledge、governance rule 各自有边界。
5. **知识闭环更可维护**：解决问题后的经验能通过 `spec-compound` 进入下一次 plan/debug/review，而不是留在会话 transcript。

## 是否过度设计

### 不过度的部分

- 六层表作为 map 不过度。
- L2 summary-first 消费纪律不过度，因为已有 `artifact-summary.v1`。
- L4 recall advisory boundary 不过度，因为直接解决“历史经验被盲信”的风险。
- L6 verified promotion gate 不过度，因为直接解决“长期知识污染”的风险。

### 过度的部分

- 把 L1-L6 都当 v1.15 必须实现的 deliverable。
- 给 L2 重新设计 context bundle。
- 给 L3 在 v1.15 接 provider/code graph。
- 给 L5 建 Skill Radar 或强 capability router。
- 在 `docs/solutions` 上新建与 `spec-compound/references/schema.yaml` 并列的第二套 frontmatter truth。
- 把 legacy docs 自动标成 verified。
- 新增 `docs/contracts/knowledge/` 后不更新 `package.json.files`。

## 推荐落地形态

### v1.15 最小正确切片

1. 新增 `knowledge-harness.md`，但只作为六层协同地图和边界声明。
2. 不重建 `context-bundle.v1` / `artifact-summary.v1`；只让 `spec-plan` / `spec-work` / `spec-code-review` 有可观察 summary-first 消费。
3. 在 `spec-plan` / `spec-debug` 明确 `docs/solutions` recall 是 advisory candidate，必须回源确认。
4. 在 `spec-compound` 的 canonical schema 上扩展 promotion 字段，或明确迁移 canonical ownership；不要并列两套 schema。
5. 存量 17 篇 solution 标为 `legacy_advisory` 或 `legacy_structurally_accepted`，不要自动称 verified。
6. L5 capability lens 作为可选 prose；无 consumer 就 defer。
7. 若新增 `docs/contracts/knowledge/`，同步 `package.json.files` 与 contract tests。

### v1.16 以后

- L3 code intelligence 进入 capability-aware 协同。
- 只认 capability class，不认具体 provider。
- 外部工具输出始终回源确认。
- 大仓或 repeated recall miss 出现后，再评估 hybrid retrieval 或外部 memory。

## 反模式清单

- 把六层做成中心化 Knowledge Runtime。
- 用脚本决定语义 relevance、root cause、scope authority。
- 让 LLM 假装执行过 source/test/log confirmation。
- 把 `fresh` readiness 当作 confirmed evidence。
- 自动 promote 长期记忆。
- 默认预读整个 `docs/solutions`。
- 把 raw transcript/archive 写入 durable docs。
- 为 Graphify/CodeGraph/GBrain 建 provider-specific workflow surface。
- 把 hidden reviewer/subagent 输出直接当 durable knowledge。

## 最终建议

保留六层，但改写实施口径：

```text
六层是正确的分类法。
v1.15 只实现最小 Knowledge 闭环。
L2 复用已有 Context Harness。
L3 延后。
L5 advisory 或砍掉。
L4/L6 是核心。
```

这样既能保留 SCALE 方案的结构优势，又不违背 spec-first 的核心哲学：轻合同、清晰边界、脚本准备事实、LLM 做语义判断。

## 验证状态

- 已直接阅读本地 source：角色契约、AI Coding Harness、context-bundle、artifact-summary、父方案六层表、Phase D 校准、v1.15 plan、spec-compound schema、package 发布清单。
- 已联网核对外部一手来源：arXiv 2307.03172、2310.11511、2401.15884、2504.19413，Anthropic Contextual Retrieval 页面元信息，NIST AI 100-2e2025 DOI/PDF 跳转。
- 未运行 `npm test`：本次为 docs-only 研究报告，不改变 runtime、CLI、skill 行为。

## 参考链接

- https://arxiv.org/abs/2307.03172
- https://arxiv.org/abs/2310.11511
- https://arxiv.org/abs/2401.15884
- https://arxiv.org/abs/2504.19413
- https://www.anthropic.com/engineering/contextual-retrieval
- https://doi.org/10.6028/NIST.AI.100-2e2025
