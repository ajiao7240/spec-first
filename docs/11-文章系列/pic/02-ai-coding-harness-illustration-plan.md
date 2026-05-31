---
type: mixed
density: balanced
style: blueprint
image_count: 5
article: ../02-ai-coding-harness.md
---

# 第 2 篇配图计划

## Illustration 1

**Position:** 开场定义 Harness 前后
**Purpose:** 把第一篇的 Prompt -> Workflow 叙事升级到 Harness。
**Visual Content:** 三阶段演进：Prompt、Workflow、Harness。
**Type Application:** flowchart + framework。
**Filename:** `02-ai-coding-harness-evolution.svg`

## Illustration 2

**Position:** “04 为什么不是 Prompt Collection”章节
**Purpose:** 论证 spec-first 是工程承载层而非 prompt collection；补 §03–§05 的图空档。
**Visual Content:** 左侧瞬时聊天约束（会蒸发）对照右侧持久工程产物（requirements brief、plan、task pack、findings、hypothesis ledger、docs/solutions）。
**Type Application:** infographic（before/after 对照）。
**Filename:** `02-ai-coding-harness-prompt-vs-harness.svg`

## Illustration 3

**Position:** “Scripts prepare, LLM decides”章节
**Purpose:** 展示脚本与 LLM 的职责边界，避免把 Harness 误解成状态机。
**Visual Content:** Scripts/Tools、Evidence Envelope（四轴 capability_status / evidence_grade / evidence_posture / freshness_state）、LLM/Agents 三段结构。
**Type Application:** comparison + flowchart。
**Filename:** `02-ai-coding-harness-boundary.svg`

## Illustration 4

**Position:** “spec-first 的六层 Harness”章节
**Purpose:** 让读者一次性建立六层地图，每层标注真实工程抓手。
**Visual Content:** Context、Execution、Evidence、Evaluation、Governance、Knowledge 六层（含真实标识符），以及核心链路。
**Type Application:** framework。
**Filename:** `02-ai-coding-harness-layers.svg`

## Illustration 5

**Position:** “09 一个简单自测”章节
**Purpose:** 把六个自测问题做成可截图转发的 checklist，并关联回对应 Harness 层；补全文后半段的图空档。回流资产对应内容路线图阶段 1「AI Coding Workflow 自测清单」。
**Visual Content:** 六个自测问题卡，每卡标注对应层（Execution / Context / Execution / Evidence / Governance / Knowledge），底部结论 banner。
**Type Application:** infographic（checklist）。
**Filename:** `02-ai-coding-harness-self-check.svg`

## Style Notes

- Blueprint 风格：深色背景、蓝色线框、轻量网格、工程系统感。
- 不做装饰性插画，只画方法论结构。
- 所有图都是 repo-native SVG，便于后续改字、复用到 README/官网或导出成 PNG。
- 五图分布：§02 演进、§04 对照、§05 边界、§06 六层、§09 自测，前后节奏均衡，避免全部集中在前半段。
