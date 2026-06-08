# spec-prd Skill × 侠客汇 AI-Native 工作流——改进分析报告

> 参考文章：[侠客汇 AI-Native 之路：如何打造「可自进化」的端到端 AI 工作流](https://mp.weixin.qq.com/s/0kwBtcPqwpPwaRnGt6Ppqw)
> 分析日期：2026-06-08
> 前置文档：[spec-code-review 集成分析](./14.code-review/technical-proposal-brooks-lint-integration.md)

---

## 一、差距总览

spec-prd 已经是一份高度工程化的 PRD 工作流 skill（6 条核心原则、4 阶段流程、10 种 Topology 类型、18 个 Conditional Sections、5 级证据标签、5 套 Readiness Pack），但与侠客汇 AI-Native 工作流之间仍存在**范式层**的差距——spec-prd 是"工具化"的，侠客汇是"自进化"的。

| 维度 | spec-prd 现状 | 侠客汇做法 | 差距性质 |
|------|-------------|-----------|---------|
| 输入策略 | 接受任意输入形式，Phase 0 做意图分类 | 强制弃 BRD 保会议纪要，从源头降噪 | **范式缺失** |
| 生成模式 | Phase 3 一次性起草（按 output_shape） | 分步生成 + 逐段确认，人在关键节点把关 | **架构差距** |
| 纠错反馈 | 无。人工纠正只在当次生效 | 每次纠错自动沉淀为规则门禁（错题本） | **核心缺失** |
| 知识漏斗 | 无。所有 refs 全量注入 AI 上下文 | 三级漏斗精准收敛，一次只装 3-5 条 | **工程差距** |
| 知识进化 | 术语 ≥2 PRD → preview 晋升 glossary | 引用账本驱动成熟度升级（draft→verified→proven） | **机制差距** |
| 知识淘汰 | 无 | 连续 3 月零引用 → 移出活跃库 | **缺失** |
| 角色收敛 | Phase 2 问 owner（最多 3 个问题） | 6 角色收敛为产品-技术 1+1 协作 | **覆盖度差距** |
| 产品-技术闭环 | Phase 4 单向下游移交 spec-plan | 双线联动，知识库是两条线的共享记忆 | **架构差距** |

---

## 二、逐项改进建议

### 2.1 输入策略：引入"会议纪要优先"的投喂原则

**侠客汇做法**：实测 BRD vs 会议纪要作为 AI 输入的效果——BRD 噪音多（背景与目标混杂、方案越界、共识模糊），会议纪要信息纯净（只记双向确认后的结论、共识强绑定）。最终确立"需求输入标准化：会议 → AI 飞书纪要 → PRD"这条 pipeline。

**spec-prd 现状**：Phase 0 的 `input_posture` 判定接受任意输入形式（PRD 文档 / 口头描述 / 会议记录 / 已有代码），但没有对输入信噪比进行任何区分或降级提示。证据标签 `user-stated` 的来源没有被进一步分解为"会议记录中的双向确认"和"运营单方面口述"。

**改进方案**：

1. **新增输入来源质量等级**：在 Phase 1 的 `quality_diagnosis` 中增加 `input_fidelity` 维度，分级如下：

   | 等级 | 来源 | 可信度 |
   |------|------|--------|
   | `consensus-confirmed` | 多方参与的需求会议纪要（含结论和责任人） | 最高 |
   | `single-source-stated` | 单一方提供的需求文档或口述 | 中 |
   | `hybrid-inferred` | 混合来源 + 推断补充 | 低 |

   影响：`consensus-confirmed` 时放宽 evidence_depth；`single-source-stated` 时强制在 Phase 2 增加至少 1 个验证性问题。

2. **当检测到 `input_posture` 为 BRD 样式输入时**（含以下特征：方案越界、"我要这个功能"而非"要解决什么问题"、无明确 trade-off 记录），Phase 1 结束时输出一个 `noise_warning`，建议转会议纪要模式。这不是拒绝 BRD，而是提示风险。

3. **在 references 中新增 `meeting-to-brd-prompt.md`**：固化一句标准指令，让 AI 从会议逐字稿/纪要提取结构化 BRD，作为 spec-prd 的前置管道。skill 层面不要把这个流程塞进 Phase 0-4，而是作为外部可调用的 utilities。

---

### 2.2 生成模式：从"一次起草"到"分步生成 + 逐段确认"

**侠客汇做法**：PRD 不是一键生成，而是"AI 分步起草、人工逐段把关"——六个迭代阶段（尝鲜→规范→拆解→寻源→降噪→进化），最终锁定的最优模式是 AI 起草每个 section → 人确认方向 → AI 继续下一节。

**spec-prd 现状**：Phase 3 按 output_shape 一次性输出完整 PRD，人工确认节点只在 Phase 2（Bounded Scenario Grill ≤3 个 owner 问题）和 Phase 4（Readiness Lens）。Phase 3 内部没有中断确认点。这意味着如果 AI 在 Phase 3 的 Core Section 中写偏了方向，要等到整个 PRD 产出后才能发现。

**改进方案**：

1. **在 Phase 3 内部增加 `section_anchor` 机制**（针对 `normal-prd` 和 `topology-heavy-prd`）：

   ```
   Phase 3 拆分执行：
   3a. Draft Core Sections（仅 Summary + Change Delta + Requirements 大纲）
       → [Section Anchor 1: 等待 owner 确认方向]
   3b. Draft Core Sections 全文 + Evidence And Assumptions
       → [Section Anchor 2: 等待 owner 确认 evidence 无编造]
   3c. Draft Conditional Sections（根据 output_shape 按需）
       → [Section Anchor 3: 等待 owner 确认范围无遗漏/过度]
   3d. Draft Feature Slices + Acceptance Examples
   3e. 最终合成
   ```

   `compact-prd` 跳过 Section Anchor 机制（保持快速路径）；`bypass` 完全跳 Phase 3。

2. **Section Anchor 的交互格式**：每到一个 anchor，输出当前产出的摘要（不是全文）+ 1 个决策问题。"继续"→ 进入下一节；"改 XXX"→ 只改 XXX 后继续；"全部重来"→ 重新起草当前阶段。

3. **在 Decision Card 中新增 `stepwise_sections` 字段**：记录本次 PRD 是否启用了分步确认、哪些 section 在哪个 anchor 被修正过——这为后续错题本（§2.3）提供数据源。

---

### 2.3 纠错闭环：建立"错题本"自进化机制（核心改进）

**侠客汇做法**：产品线踩了 6 个阶段才走到"进化期"——人工纠错自动沉淀为规则门禁，下一次工作流主动规避。例如：用户纠正了一个 AI 编造的业务规则，这条规则自动写入 knowledge base 的"禁止凭空推断列表"，后续 PRD 生成前自动检索。

**spec-prd 现状**：完全缺失。如果 owner 在 Readiness Lens 阶段纠正了一个编造的需求，这个纠正只影响当次 PRD。下一次新的 PRD，AI 仍然可能犯同样的错误。

**改进方案**：

1. **新增 `references/prd-correction-ledger.md`**（结构性知识存储）：

   ```markdown
   ## Correction Ledger

   ### C-001 | Date: 2026-06-08 | PRD: feat-member-upgrade
   **What was wrong**: AI 编造了"会员升级后积分清零"的业务规则
   **Corrected to**: 会员升级不影响积分，积分体系独立
   **Rule type**: business-rule-guard
   **Affects**: 所有涉及会员和积分的 PRD
   **Source**: owner 在 Phase 4 纠正
   ```

   分类支持：`business-rule-guard`（业务规则纠正）/ `term-correction`（术语纠正）/ `topology-error`（拓扑判断错误）/ `scope-error`（范围判断错误）。

2. **Phase 1 新增 `load-correction-ledger` 步骤**：在 evidence collection 之前，检索与当前 PRD 领域相关的 correction 条目，注入到上下文。检索逻辑：基于 PRD 关键词（通过 `detected_terms`）匹配 ledger 条目的 `affects` 字段。

3. **Phase 4 新增 `capture-corrections` 步骤**：当 owner 给出修正反馈时，自动生成 ledger 条目草稿，owner 确认后写入 `prd-correction-ledger.md`。

4. **Self-check 前置**：Phase 3 起草前，AI 必须先跑一遍 correction-ledger 中匹配的规则门禁，输出 `pre-draft self-check: 已核对 X 条历史纠正，未命中任何禁止模式`。

---

### 2.4 知识漏斗：从"全量加载"到"三级精准投喂"

**侠客汇做法**：基础认知一次性全装（项目定位 + 团队红线 + 架构快照），专业知识按阶段精准投喂（写需求分析前装一类、写技术方案前装一类、写代码前装一类），靠"三级漏斗"（目录页→卡片→整条经验）从几百条知识中锁定 3-5 条。

**spec-prd 现状**：没有分阶段知识注入机制。refs 目录下的 4 个 references 是 AI 上下文中的"全量背景"，无法按当前 PRD 的实际需要做过滤。evidence-and-topology.md 的 10 种 Topology 类型、18 个 Conditional Sections 的触发规则全部在 Phase 3 时靠 AI 自行判断——判断本身也消耗上下文容量。

**改进方案**：

1. **新增 `references/knowledge-directory.md`**（一页目录）：作为漏斗第一层。结构：

   ```markdown
   | 知识卡片 ID | 标题 | 触发关键词 | 成熟度 | 适用阶段 |
   | K-001 | 会员积分体系解耦 | 会员、积分、等级、权益 | proven | Phase 1, Phase 3 |
   | K-002 | 支付回调幂等设计 | 支付、回调、重试、幂等 | verified | Phase 2, Phase 3 |
   ```

2. **Phase 0 结束时跑漏斗收敛**：

   ```
   Phase 0 结束 → 提取 detected_terms → 匹配 directory → 输出 top-5 知识卡片 ID → 仅加载这 5 条到 Phase 1-3 上下文
   ```

3. **各阶段按需二次检索**：Phase 2（Change Delta + Domain Language）触发时，基于 Grill 结果再跑一次关键词匹配，补充加载相关卡片。

4. **Context budget 显式管理**：在 Decision Card 中新增 `context_budget` 字段（loaded_knowledge_cards / total_chars），当加载的知识卡片总量超过阈值时，自动降级为更精简的加载策略。

---

### 2.5 知识进化：引入引用账本 + 成熟度机制

**侠客汇做法**：每条知识有一个成熟度标签，升级靠真实引用次数：draft(0-1次) → verified(2-4次) → proven(5+次)。同时有淘汰机制：连续 3 个月零引用 → 移出活跃库。

**spec-prd 现状**：术语晋升机制是唯一的"进化"行为——≥2 个 PRD 磨锐 → preview 式晋升到 `domain-glossary.md`。但这个机制仅覆盖术语，不覆盖业务规则、拓扑判断、evidence 策略等更重要的知识类型。且晋升只看"被多少个 PRD 使用"，不看"使用的质量"（是否正确帮助了决策）。

**改进方案**：

1. **扩展 `domain-glossary.md` 为 `project-knowledge-base.md`**（或独立文件），支持多种知识类型：

   ```markdown
   ## K-001 | 会员积分体系解耦
   - Type: business-rule
   - Maturity: proven（被 7 个 PRD 引用）
   - Created: 2026-03-15 (PRD #feat-points-v2)
   - Last cited: 2026-06-01 (PRD #feat-member-upgrade)
   - 引用记录:
     - #feat-member-upgrade, 2026-06-01, used-at: Phase 2 domain-grill
     - #feat-points-refactor, 2026-05-20, used-at: Phase 1 evidence-collection
   ```

2. **引用记录自动写入**：每次 spec-prd 运行结束后，提取 Decision Card 中实际使用的 knowledge cards，自动追加引用记录。

3. **成熟度升级规则**：

   | 级别 | 条件 | 表现 |
   |------|------|------|
   | draft | 新创建 / 引用 0-1 次 | 加载时可被 context_budget 裁剪 |
   | verified | 被 2-4 个不同 PRD 引用 | 加载优先级提升 |
   | proven | 被 5+ 个不同 PRD 引用 | 强制加载，不受 context_budget 限制 |

4. **淘汰巡检（Phase 0 末尾）**：扫描 knowledge base 中连续 3 个月零引用的条目，输出 `staleness_warning`（不自动删除，只提醒 owner）。

---

### 2.6 跨角色收敛：显式检测"信息衰减路径"

**侠客汇做法**：将 6 种角色（运营/产品/UI/前端/后端/测试）收敛为"产品端 + 技术端"的 1+1 协作。关键创新：不是取消角色，而是用 AI 替代跨角色的信息传递——运营的意图直接进入会议纪要（消除产品和运营之间的转述衰减），产品 AI 直出 Figma（消除产品-UI 之间的对齐衰减）。

**spec-prd 现状**：Phase 2 的 Bounded Scenario Grill 最多问 3 个 owner 问题，但这些问题不区分是问产品 owner、运营 owner、还是开发 owner。Topology 10 种类型覆盖了技术侧的变更模式，但没有覆盖"跨角色信息传递"这一维度的衰减风险。

**改进方案**：

1. **在 Phase 1 的 quality_diagnosis 中新增 `role_attenuation_risk` 维度**：

   | 信号 | 风险等级 | 建议动作 |
   |------|---------|---------|
   | 需求来源为运营口述，无会议记录 | 高 | Phase 2 至少 1 个问题需运营方确认 |
   | PRD 中出现了"前端实现建议"等越界内容 | 中 | 标注为 `scope-spill`，在移交 spec-plan 时提示 |
   | 涉及 UI 变更但无设计稿引用 | 中 | 建议先完成 UI audit 再走技术规划 |

2. **在 Topology Framing Gate 中新增 `role_crossing` 字段**：标记这个变更会跨越哪些角色边界（运营→产品 / 产品→UI / 产品→开发 / 开发→测试），每个边界自动触发 1 个验证问题。

3. **移交 spec-plan 时附带 `role-attenuation-summary`**：汇总本次 PRD 在角色传递过程中识别出的衰减点，让技术侧知道哪些需求描述可能存在"转述失真"。

---

### 2.7 产品-技术双线闭环：PRD ↔ Plan 不再是单向移交

**侠客汇做法**：产品线和知识线共享同一个知识库——产品侧踩出的"精炼知识 + 自动纠错"直接作为技术侧的"项目知识库"维形。两条线在知识沉淀层面握手。

**spec-prd 现状**：Phase 4 移交 spec-plan 是单向的——PRD 写完传给 plan，plan 不往回写任何反馈。如果技术侧在规划时发现 PRD 的需求不可行，不会触发 PRD 的 revise 流程（除非人手动触发）。

**改进方案**：

1. **建立 spec-prd ↔ spec-plan 的回流通道**：在 `honest-closeout.md` 契约中新增一条——spec-plan 结束时，如果识别到 PRD 层面的问题（需求不可行 / 范围边界冲突 / 拓扑类型误判），生成 `prd-feedback` 条目，自动触发 PRD 的 revise 模式。

2. **在 knowledge-base 中标记知识的来源**：产品侧沉淀的业务规则（type: business-rule）和技术侧沉淀的实现约束（type: implementation-constraint）在同一个 knowledge base 中共存，PRD 生成时优先加载 `type: business-rule` 条目，Plan 生成时优先加载 `type: implementation-constraint` 条目——但两者都可以交叉引用。

3. **PRD 的 Correction Ledger 与 Plan 的知识库共享成熟度体系**：PRD 中被验证 5+ 次正确的业务规则，自动晋升为 proven，Plan 侧可以直接信任引用；同理，Plan 中形成的最佳实践 pattern，也可以在 PRD 阶段作为 feasibility 约束注入。

---

## 三、改进实施优先级

### P0：影响 PRD 质量的范式层改进（立即收益）

| 项 | 改动范围 | 预期效果 |
|----|---------|---------|
| 错题本机制（§2.3） | 新增 `prd-correction-ledger.md` + Phase 1/4 流程改动 | 同一类编造错误不再犯第二次 |
| 分步生成确认（§2.2） | Phase 3 内部新增 section_anchor（`normal-prd` 和 `topology-heavy-prd` 形状） | 降低 PRD 整体返工率（发现方向偏差的窗口从 PRD 完成后提前到起草中） |
| 输入降噪策略（§2.1） | Phase 0/1 新增 `input_fidelity` + `noise_warning` | 从源头减少 AI 基于噪音多的 BRD 做出错误推断 |

### P1：知识管理机制（积累收益）

| 项 | 改动范围 | 预期效果 |
|----|---------|---------|
| 知识漏斗（§2.4） | 新增 `knowledge-directory.md` + Phase 0 收敛逻辑 | 精确注入相关知识,减少上下文浪费和幻觉 |
| 引用账本+成熟度（§2.5） | 扩展 glossary 为 knowledge-base + 自动引用记录 | 知识"越用越准",团队经验不随人员流失 |
| 跨角色衰减检测（§2.6） | quality_diagnosis 新增 `role_attenuation_risk` + role_crossing | 显式识别转述失真,减少上游到下游的信息损耗 |

### P2：跨 skill 协同（生态收益）

| 项 | 改动范围 | 预期效果 |
|----|---------|---------|
| PRD ↔ Plan 回流通道（§2.7） | `honest-closeout.md` 新增 + knowledge-base 双向标记 | 形成产品-技术双线闭环的信息回路 |

---

## 四、与 code-review 路线的协同

前一轮中 spec-code-review 引入了 brooks-lint 的衰减风险框架（R1-R6+T1-T6）和 Health Score。PRD 侧的改进与 code-review 侧共享同一个底层模式：

| 维度 | code-review 侧 | PRD 侧（本报告） |
|------|---------------|----------------|
| 知识沉淀 | review-knowledge-ledger（findings 复用追踪） | prd-correction-ledger + project-knowledge-base |
| 成熟度体系 | findings 的 confidence/severity 量化 | 引用次数驱动 draft→verified→proven |
| 质量闸门 | decay-tagger + health-calculator + 门禁 | section_anchor + readiness-lens + input_fidelity |
| 退化信号 | health_score 趋降 / delta < -10 | staleness_warning / knowledge 零引用淘汰 |

**协同机会**：code-review 和 PRD 可以共享同一份 `project-knowledge-base.md`——PRD 沉淀业务规则和术语，code-review 沉淀架构约束和衰减模式。当 code-review 发现某个技术衰减模式（如 R5 依赖混乱）高频出现时，可以反向推动 PRD 侧增加对应的 evidence 收集策略。

---

## 五、实施路线图

```
Week 1-2: P0 快速落地
├── prd-correction-ledger.md 创建 + Phase 1 加载 + Phase 4 写入
├── Phase 3 section_anchor 机制（仅 normal/topology-heavy 形状）
└── Phase 0 input_fidelity 判定 + noise_warning

Week 3-4: P1 知识管理
├── knowledge-directory.md + 三级漏斗加载
├── project-knowledge-base.md（扩展现有 glossary）
├── 引用记录自动写入
└── role_attenuation_risk 维度

Week 5+: P2 闭环
├── PRD-Plan 回流通道契约
└── knowledge-base 双向标记
```
*（内容由AI生成，仅供参考）*
