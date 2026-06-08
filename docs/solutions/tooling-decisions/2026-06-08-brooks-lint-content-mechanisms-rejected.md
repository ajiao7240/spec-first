# brooks-lint 内容机制借鉴:①出处引用 / ③健康分 / ⑤命名词表 的带证据否决

> 日期:2026-06-08
> 类型:solution(决策依据沉淀,供后续 review/plan/brainstorm 检索,避免重复纠结)
> 触发:多轮探讨"是否借鉴 brooks-lint 提升 spec-first review Agent 质量",经 deep-research 外部证据裁决
> 证据来源:deep-research workflow(103 agents、5 角度、3 票对抗验证),run `wf_12fb0d5f-900`

---

## 结论先行

把 brooks-lint 的三个**内容机制**集成进 spec-first review,对前沿模型(Opus 4.x 级)**冗余或有害,不做**。这三个是:

- **① 经典著作出处引用**(把发现锚定到 Fowler/Brooks 等)
- **③ 数值健康分**(0-100 health score,LLM 心算)
- **⑤ 命名 code-smell 词表**(Divergent Change / Assertion Roulette 等)

下次再有人提议"spec-first 要不要也加 brooks-lint 这套",直接引用本文,不重新辩论。

## 为什么否决(2024-2026 实证)

### ① 出处/角色锚定 — 装饰性,可能有害(证据:强反向,3-0 ×5)
- persona/role 命名在客观任务上**不优于无 persona 基线**,单个 persona 效应"largely random"(Zheng et al. EMNLP 2024 Findings;PLOS ONE 20(6):e0325664 "none of the personas outperform the no persona baseline")。
- **模型越强越不敏感**:GPT-4 跨 persona 差距 4.58pp vs GPT-3.5 的 20.77pp(约 4.5×缩小)→ 前沿模型对 framing 更冗余。
- 引文锚定的一条相关主张被对抗验证 **0-3 反驳**为可能触发 **authority bias**——引文可能是漏洞而非质量信号。

### ③ 数值健康分 — 不可靠且易 gaming(证据:强反向,3-0 ×7)
- 即便最强模型也**显著低于人类间一致性**,有宽松/长度/位置偏差,高百分比一致可掩盖巨大分差(Judging the Judges, arXiv:2406.12624)。
- 无 ground-truth 参照时,judge **仅在自己能答对的题上**与专家对齐(No Free Labels, arXiv:2503.05061)。
- 含义:LLM 自估数值分本身不稳定、易操纵。**反向印证 spec-first "刻意不做心算健康分、用离散 confidence anchor" 是对的。**

### ⑤ 命名词表 — 对已知概念冗余,增益不均匀(证据:强反向,3-0 ×6)
- 命名 smell 检测增益"类型相关、非均匀",且**所有研究都没做"有词表 vs 无词表"消融**,无法证明对已掌握概念的前沿模型有增量(MLCQ 数据集 doi 10.1007/978-3-031-86149-9_42)。
- 部分 smell 本身存疑:控制实验(n=42, doi 10.1109/vlhcc.2022)发现 Assertion Roulette 对代码质量影响极小,"不再是 smell"。

### 元证据:few-shot 对已知任务为何冗余(3-0 ×2)
- few-shot 只在范例**与模型先验矛盾**时才改变前沿模型行为(Wei et al. arXiv:2303.03846 "Larger LMs do ICL differently")。
- **单纯命名模型已掌握的概念/引文不构成矛盾范例 → 对已知任务冗余。** 这是 ①⑤ 冗余的根本机制。

## 什么没有被否(方向有证据)

- **④ 减少误报的聚焦/护栏机制** = **唯一证据最强(3-0 ×2)**:工业研究证实 LLM review 误报真实高代价(ICSE 2025 SEIP, PR 关闭 5h52m→8h20m);CodeAgent QA-Checker 消融提升精确率(确认率 73.23%→92.96%)。spec-first 对应动作见 [[reviewer-guard-coverage-audit-plan]]。
- **② 维度分解原理**(非 R1-R6 具体框架)有中等证据(FLASK, ICLR 2024:分解优于整体)。spec-first 的 persona 体系已是维度分解。

## 证据边界(诚实标注)

- persona / LLM-judge 证据多来自 QA/MMLU 任务,**非 code-review 专属**;"expert code reviewer"类比合理但未实测。
- 多数实证用 GPT-3.5/4 代;但"模型越强越不敏感"趋势意味着对 2026 前沿模型,①⑤ 的冗余性**只会更强不会更弱**。
- 无 code-review 专属的"有词表/引文 vs 无"直接消融——否决基于间接外推 + 元证据(few-shot 冗余),非直接实验。

## 关联

- 降误报方向的 spec-first 落地:[[reviewer-guard-coverage-audit-plan]]
- 上游 brainstorm:`docs/brainstorms/2026-06-08-002-brooks-lint-integration-two-skills-requirements.md`
