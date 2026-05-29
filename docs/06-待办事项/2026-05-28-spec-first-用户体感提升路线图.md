# spec-first 用户体感质量提升路线图

- 日期：`2026-05-28`
- 状态：`active backlog (owner 路线图骨架，不是承诺)`
- 来源：`docs/plans/2026-05-28-004-feat-spec-work-run-evidence-and-invariant-lens-plan.md` 落地讨论中 owner 关于"真正能让用户体感流程质量大幅提升"的判断
- 性质：**路线图骨架**，不是 plan，不是 backlog ticket 列表，不进入 release scope 直到具体 candidate 升格为 plan
- 所有权：`Spec-First Evolution Architect`（owner）

---

## 路线图定位

`docs/plans/2026-05-28-004` 解决的是 spec-first 自身的"已设计未实装"清债 + 立护栏问题，是必要前置。但**它不会显著提升用户单次研发的速度或体感**——这是 owner 已诚实承认的边界（见该 plan 讨论 §诚实标记）。

要让用户**体感**研发流程质量明显提升，需要在 `2026-05-28-004` 落地之后串行启动 4 个独立 plan candidate。本路线图的作用是：

1. 把这 4 个方向骨架化、固化、可被未来开发者按文件读取
2. 明确依赖关系与启动条件，避免并发推进引发架构冲突
3. 显式声明每个候选的"可能不做"判断，避免路线图变成"必须做完所有"的承诺
4. 作为 reverse guard：当未来某次 review 提出"把 X 加进 `2026-05-28-004` 一起做"时，本文件是 owner 的拒绝依据

---

## 核心论断（为什么不合并到一个 plan）

| 维度 | 4 个候选的差异 |
| --- | --- |
| 验证方式 | 产品 metric / 工程 metric / 协议演进 / UX 试错 各不相同 |
| 时间常数 | 短（审计 2-3 周）vs 长（协议级 6-8 周） |
| 风险等级 | 可逆审计 / 半可逆 UX / 协议级不可逆 |
| 责任归属 | 用户体验 / CLI 工程 / workflow 架构 / provider 协议 |
| 失败影响 | 一条卡住不影响其他三条 |

把它们捆进一个 plan 等于复制 `2026-05-11-001` 的失败模式（U3 滞留 6 个月的根因之一就是范围过大）。**owner 的纪律是：每个候选独立 plan，串行启动，明确拒绝合并。**

---

## 4 个 Plan Candidate

每个候选只给定位 / scope 边界 / 依赖 / ROI / 主要风险 / 关键约束 / 预期周期 / 可能不做的判断。**不在这里展开完整 plan**——升格时由对应 plan 文件承担完整契约。

### P-friction：spec-first 用户摩擦实证审计

**定位**：用 `2026-05-28-004` 落地后产生的真实 run.json + host session history + 真实用户 session 录像，做 evidence-based 摩擦审计。审计三条路径：

- `first-run`：从 `npm install -g spec-first` 到第一次成功 ship 的完整路径
- `daily-use`：日常 prompt → spec-work 直走的高频路径
- `advanced`：plan + task-pack + review + compound 的深度组合路径

**Scope 边界**：

- 只做审计 + 输出 finding doc，**不直接 fix**
- 每条 finding 必须有：复现 evidence path、分类 (UX / CLI / 文档 / host runtime / contract)、严重度、是否值得 fix plan 的 owner 判断
- 不做用户访谈调研——以可验证 evidence 为准

**依赖**：

- `2026-05-28-004` 必须先落地（run.json 是审计的关键 evidence 来源）
- 至少 2-4 周真实使用积累（让 run.json 数据有代表性）

**ROI**：高（直接对应"用户体感"维度）

**预期工作量**：中（2-3 周）

**主要风险**：

- 审计变成 product 评估而非工程动作
- 摩擦定义模糊导致 finding 不可消费
- evidence 样本偏向 owner 自己的使用模式，不代表多数用户

**关键约束**：

- 审计输出必须区分"高频低烈度摩擦"（值得 fix plan）vs "低频高烈度摩擦"（可能 documentation 解决而非 source）
- 不预判结论，允许"审计后发现 P-task-pack-default / P-review-inline / P-graph-primary 都不值得做"

**关键产出**：

- `docs/audits/spec-first-friction-audit-<date>.md`
- 分类的 finding 列表
- 每条 finding 的"是否值得 fix plan"判断
- 对路线图后续 3 个候选的"建议优先级 / 建议砍掉"反向输入

**可能不做的判断**：审计本身投入产出比足够高，几乎一定要做；但审计后 80% 概率会让后续 3 个候选**至少缩减 1 个**——这是审计的核心价值。

---

### P-task-pack-default：task-pack 编译成本降到 medium/large 任务的默认路径

**定位**：让 medium / large 任务从"prompt → spec-work 直走"自然过渡到"prompt → 隐式编译 task-pack → spec-work 消费"，不显式增加用户步骤；small / trivial 任务保持直走，不被 task-pack 摩擦化。

**Scope 边界**：

- `spec-write-tasks` 自动触发条件（基于 prompt 复杂度 / 文件数量 / scope 信号）
- `spec-work` 路径检测与降级
- task-pack validation 在 small task 上的零摩擦降级
- **保留显式 opt-out**：用户拒绝 task-pack 必须能一键退回 prompt 直走

**依赖**：

- `P-friction` 提供的真实摩擦数据 —— 不能凭直觉决定"哪些任务该自动 task-pack"
- `2026-05-28-004` 落地（task-pack 落 evidence 的下游 closeout 必须先就位）

**ROI**：极高 —— task-pack 是 evidence 闭环的真正源头；如果用户路径自然走它，evidence 闭环会自然形成；如果不走，`2026-05-28-004` 的 run.json 就只覆盖 advanced 用户

**预期工作量**：大（4-6 周）

**主要风险**：

- 自动化让 task-pack 变成隐藏强制，违反 explicit dispatch 纪律
- validation 失败时降级路径设计错误会卡死小任务
- 触发条件过严 → 还是 advanced-only；过松 → 把简单任务也卷进 task-pack 摩擦

**关键约束**：

- **explicit dispatch 不可妥协**：自动触发后必须给用户明示窗口决定是否走
- task-pack 编译成本必须实测降到 < 30 秒（否则用户会拒绝）
- 必须在 P-friction finding 中找到"我每次写 prompt 都重复同样背景"或"小修改也要先 plan 太烦"这类高频摩擦作为依据，否则不做

**可能不做的判断**：如果 P-friction 显示用户摩擦根本不在 task-pack 编译成本，而在 plan / brainstorm 上层，本候选直接砍掉。

---

### P-review-inline：small/medium 任务的 closeout 内联轻量 review

**定位**：small / medium 任务在 `spec-work` Phase 4 内做轻量 review，不开 `spec-code-review` 整套 workflow；high-stakes / 大改动 / migration / 安全相关仍走 full review。

**Scope 边界**：

- `spec-work` closeout 内的 lightweight review 段
- 与 `spec-code-review` autofix mode 的边界界定
- review tier 决策树（小 / 中 / 大 → inline / autofix / full review）
- inline review 必须在 final response 显式声明 tier，禁止暗示"完整 review 已通过"

**依赖**：

- `2026-05-28-004` 落地（run.json 提供 inline review 的结构化输入：not-run reason / deferred / degraded）
- `P-task-pack-default` 落地（task-pack 自然带 review focus 字段）

**ROI**：中高（减少 review 摩擦，但有 missing-finding 风险）

**预期工作量**：中（3-4 周）

**主要风险**：

- 轻量 review 漏判率显著高于 full review
- 用户误把 inline 当 full，质量错判
- review tier 决策树设计不当，导致"大改动悄悄走 inline"
- 与 spec-code-review autofix mode 边界不清，重复 review 或 review 漂移

**关键约束**：

- Inline review tier 必须在 final response 用结构化字段声明（不能只在 prose 中暗示）
- 高风险路径（auth / payment / migration / shared-helper）即使是小改动也强制 full review
- **inline review 不允许声称"等价于 full review"**——必须保留"如需深度 review，请运行 spec-code-review"指引

**可能不做的判断**：如果 P-friction 显示用户体感的真正摩擦在 review 之前（比如 plan / brainstorm 节点），review 内联收益可能 < 风险，本候选可延后或缩减。

---

### P-graph-primary：graph evidence advisory → primary 升级

**定位**：让 GitNexus 的 `impact` / `api-route` / `detect-changes` / `query` 等 evidence 在满足 freshness + fresh-source 验证后，从 advisory 升级到 primary，能直接驱动 plan / debug / review 决策，而不必每次都用源码直读重新验证。

**Scope 边界**：

- fresh-source 验证机制 deterministic 化
- `docs/contracts/graph-evidence-policy.md` v2 升级
- GitNexus 上游协作（如需协议增强）
- provider readiness 协议增强

**依赖**：

- **独立轨道**，不依赖前面三条
- 可能需要 GitNexus 上游 PR 协作（外部依赖，时间不可控）

**ROI**：中（对深度用户 / 复杂场景显著，对一般用户不明显）

**预期工作量**：大（6-8 周，可能更长，受外部 provider 协作影响）

**主要风险**：

- 协议级变更回退成本高
- GitNexus 是外部 provider，本仓库控制力有限
- 升级后如果 provider 实际 quality 不达 primary 标准，需要再降级，反复横跳代价大
- 与 spec-first "scripts prepare facts, LLM decides" 角色契约的边界要重新校准（graph 升 primary 后是否仍是 advisory？）

**关键约束**：

- 升级必须有 fresh-source 验证机制兜底——不允许"信任 graph 不读源码"
- 必须保留 fall-through 路径：graph stale / unavailable 时自动降级到 advisory
- v2 evidence policy 必须经过 contract test 守护
- **GitNexus 上游协作必须有明确触发条件**——本仓库不主导 provider 协议演进

**可能不做的判断**：如果 P-friction 显示用户摩擦不集中在"graph evidence 不够强"，本候选应延后甚至不做。owner 当前估计：**这是 4 个候选中最容易被砍掉的一个**——因为大多数用户使用场景中 advisory + 源码直读已经够用。

---

## 业界对标衍生观察项（2026-05-29，未升格为候选）

以下两项来自对 `2026-05-28-004` plan 的业界一手对标（[Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) + [github/spec-kit](https://github.com/github/spec-kit)）。它们是**观察项，不是候选**——尚未达到候选成熟度（都依赖 `2026-05-28-004` 的 U-A 先落地、产生真实 run.json 后才能评估），现在升格为正式候选会过度承诺。记录于此防止丢失，待 P-friction 后与 evidence 一起判断是否升格。

- **O-compaction：run.json 对接 host compaction 信号**。Anthropic 把 compaction 列为 long-horizon 第一杠杆，Claude Code 实际会触发 compaction，但 spec-first 的 run.json `resume_evidence` 不感知。观察方向：长会话被 host compaction 后，spec-work 是否应主动写 run.json 作为 resume anchor。依赖：U-A 落地 + host 暴露 compaction 信号。对应 `2026-05-28-004` Open Question C-compaction。
- **O-workflow-metric：workflow-level 结果级质量度量**。业界（SWE-bench / Terminal-bench）停在任务级 pass/fail，workflow 级质量度量是公认空白；spec-first 已在生产 run.json 这个天然度量原料，本可像 invariant lens（self-governance as tests）那样在空白处领先。观察方向：run.json 的 evidence 价值如何度量（"调用 ≠ 价值"缺口）。依赖：U-A 落地 + P-friction 积累真实样本。对应 `2026-05-28-004` Open Question C-workflow-metric。

这两项与现有 4 个候选的关系：都更靠近 `P-friction` 之后的评估期；O-workflow-metric 若升格，可能与 `P-review-inline`（inline review 消费 run.json）共享 evidence 消费验证。

---

## 依赖关系图

```text
docs/plans/2026-05-28-004 (run evidence + invariant lens + completion taxonomy)
        │
        │ ━━ 必须先 ship，提供 run.json evidence ━━
        ▼
P-friction (用户摩擦实证审计)
        │
        │ ━━ 输出 finding 决定后续优先级，可能砍掉某些候选 ━━
        ▼
P-task-pack-default (task-pack 默认路径)
        │
        │ ━━ task-pack 默认化后，inline review 才有 task-pack focus 输入 ━━
        ▼
P-review-inline (closeout 内联轻量 review)


P-graph-primary (graph evidence 升级)
   ※ 独立轨道，可与上面任一条并行或后置
   ※ 是否做需等 P-friction 给出 evidence
```

---

## 推荐起草顺序与启动条件

| 顺序 | 候选 | 启动条件 | 不启动条件 |
| --- | --- | --- | --- |
| 1 | `P-friction` | `2026-05-28-004` Stage 6 完成 + 真实使用积累 ≥ 2 周 + run.json 样本 ≥ 10 条 | run.json 样本 < 10 条；本路线图被 owner 整体作废 |
| 2 | `P-task-pack-default` 或 `P-graph-primary`（独立轨道）| `P-friction` finding 中含相关高频摩擦，且 owner 判断 ROI > 风险 | `P-friction` finding 显示该方向不在 top 摩擦内 |
| 3 | `P-review-inline` | `P-task-pack-default` 落地 + `P-friction` 中含 review 摩擦 | 前置任一条未达成 |

**owner 当前判断**：第一个起草目标必然是 `P-friction`；后续三个候选是否启动、按什么顺序，由 `P-friction` finding 决定，**不在本路线图预设**。

---

## 反向 Guard（路线图不做什么）

1. 不把 4 个候选合并到任何单一 plan
2. 不把本路线图当承诺——任何候选都可能在 `P-friction` 后被砍掉
3. 不在 `2026-05-28-004` 落地前启动任何后续候选
4. 不为 `P-graph-primary` 主动联系 GitNexus 上游——除非 `P-friction` 给出明确驱动需求
5. 不在路线图层面引入新的 schema、contract、artifact——这是 plan 才能做的
6. 不把"用户体感"等同于"用户速度"——可靠性 / 不退步 / 可恢复性同样是体感维度
7. 不让本文件变成 plan-template 的镜像——保持骨架级，避免重复 plan 该承担的契约

---

## 路线图复审与作废条件

**何时复审**：

- 每次 `P-*` candidate 升格为 plan 时：检查路线图依赖是否仍准确
- 每次 `P-friction` 输出新 finding 时：根据 evidence 调整后续 candidate 优先级
- 每个季度（每 3 个月）：owner 重新审视路线图整体是否仍代表用户体感方向

**何时作废**：

- `P-friction` 输出显示路线图整体方向错误（用户摩擦集中在路线图未覆盖的领域）
- spec-first 整体战略发生重大转向（比如不再支持双宿主、或转向其他工程化范式）
- 4 个候选全部完成或全部判断为不做

**作废处理**：

- 不删除本文件
- 在顶部 frontmatter 加 `superseded_by:` 或 `archived_at:` 字段
- 保留作为 historical reference 与 owner 决策记录

---

## 与其他文档的关系

- **依赖**：`docs/plans/2026-05-28-004-feat-spec-work-run-evidence-and-invariant-lens-plan.md`（必须前置 ship）
- **复用对照**：`docs/09-业界借鉴/2026-05-27-Trellis-纵向钻探与spec-first质量提升分析.md`（路线图与对标文档 §10 真实未消费 delta 的对照源）
- **角色契约依据**：`docs/10-prompt/结构化项目角色契约.md`（路线图判断"是否值得做"的判准源）
- **路线图独立性**：本文件不替代 `docs/00-版本路线/版本规划.md` 的整体 release 路线，只是用户体感质量提升这一垂直维度的 owner 工作骨架

---

## Owner 备注

本路线图是 **owner 的工作骨架，不是项目承诺**。它存在的目的是：

1. 让"4 个真正能提升用户体感的方向"不在对话中消失
2. 给未来 review / brainstorm / plan 提供一个可引用的判断锚点
3. 防止某次 review 提出"把 X 塞进当前 plan"时，owner 没有现成的拒绝依据

如果未来某次 plan 起草违反本路线图的依赖顺序或反向 guard，本文件是 owner 重新决策的依据——但不是不可推翻的法律。owner 可以基于新 evidence 调整路线图，但调整必须留 trace（修改本文件 + CHANGELOG 记录）。

---

## 引用方式

未来 plan 引用本路线图的标准格式：

```markdown
本 plan 属于 `docs/06-待办事项/2026-05-28-spec-first-用户体感提升路线图.md` 中的 `P-<候选名>` 候选，已升格为正式 plan。
```

或在反向 guard 中引用：

```markdown
本 plan 不扩大到 `P-<其他候选>` 的范围（依据：路线图依赖关系图与启动条件）。
```
