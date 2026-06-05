---
title: "feat: Knowledge Harness（v1.15，分批落地）"
type: feat
status: planned
date: 2026-06-05
spec_id: 2026-06-05-003-feat-knowledge-harness
depth: deep
origin:
  - docs/01-需求分析/13.scale集成/spec-first内化集成scale-project-scaffold技术方案.md
  - docs/01-需求分析/13.scale集成/README.md
host: claude+codex
slice: v1.15（父方案 Phase D / P2 六层 Knowledge Harness；本计划覆盖完整设计，执行分两批）
implements_schemas:
  - docs/contracts/knowledge/knowledge-harness.md（新增：六层 Harness map + recall boundary）
  - skills/spec-compound/references/schema.yaml（扩展既有 canonical frontmatter，不新建第二套 truth）
  - docs/contracts/artifact-summary.md（已落地 v1，本计划只铺 producer/consumer 不重建 schema）
  - docs/contracts/context-bundle.md（已落地 v1，本计划复用既有字段表达 budget，不新增字段）
---

# feat: Knowledge Harness（v1.15）

**Target repo:** `spec-first`

## Summary

把 SCALE 集成父方案 Phase D 的「六层 Knowledge Harness」内化为 spec-first 的 **knowledge 闭环 facts/contract 层**：让「经验沉淀给下一次」从靠人手写、靠 grep 碰运气，变成 **可预算（context budget）、可摘要传递（summary-first handoff）、可结构化检索与失效（docs/solutions promotion）、可控信任边界（recall as advisory）、可感知能力（capability lens）** 的工程闭环。全部以 **file-first + deterministic facts + LLM judgment** 实现，**不引入向量库/SQLite/外部 memory 平台作默认 source truth**（GBrain 已删除，memory 完全靠 `docs/solutions/`）。

设计已经 deep-research best-practice 对抗验证（父方案 Phase D「设计依据校准」小节）：context budget / summary-first handoff / file-first memory / recall-as-advisory 四支柱有 Anthropic 工程博客 + Lost-in-the-Middle / Self-RAG / CRAG / Mem0 一手背书，整体 sound、无 blocking flaw；promotion gate 定位为**噪声/质量控制**（非反注入）。

兑现的 named workflow 行为变化（无消费方=不交付）：

- **`[CON-SUM-001]`**：`spec-plan` / `spec-work` / `spec-code-review` 之间的 handoff 从「复制/重读完整上游 artifact」变为「先消费 `artifact-summary.v1` 摘要 + 精确 path，仅命中 `full_artifact_read_triggers` 才展开」——出现可观察的 summary-first 消费 + expand-on-trigger 记录。
- **`[CON-SOL-001]`**：`spec-compound` promote 时，新 solution 必须带扩展后 `schema.yaml` 的结构化字段（含 `domain` / `pattern` / `rejected_alternatives` / `applicable_versions` / `invalidation_condition` + 必填 `source_refs`），且只有 verified learning 进 durable store——promote 行为从「自由 markdown」变为「过扩展后 schema 的 new-required 校验 + verified gate」（**扩展既有 canonical schema.yaml，不新建第二套 truth**）。
- **`[CON-REC-001]`**：`spec-plan` / `spec-debug` 消费 `docs/solutions` recall 时，recall 命中标为 advisory candidate + 回源要求，结论需 source/test/doc 确认才升 confirmed——出现「recall→reconfirm」的可观察区分，而非把历史经验直接当事实。

本计划**覆盖 v1.15 落在本期的范围**——六层 Harness 中的 **L2 / L4 / L6 三层 + L5 advisory（不入 gate）**（L1 已由现有 `spec-prd`/host docs 覆盖、L3 归 v1.16 capability-aware 协同）对应交付物，加六层 Harness 文档骨架。**执行分两批**：批 1 = knowledge-harness 文档骨架 + summary-first handoff 铺开 + recall boundary（最 deterministic、复用已落地 `artifact-summary.v1`、高频过 consumer gate）；批 2 = 扩展 `schema.yaml` 结构化字段 + `spec-compound` 接入。capability lens（L5）移出 completion gate 作 follow-up。context budget 复用既有 `context-bundle.v1` 字段贯穿，不新建 bundle 合同、不新增字段。

---

## Problem Frame

v1.11–v1.14 已把 readiness / verification / honest-closeout / governance lens 做成 deterministic facts 并接入 `doctor` / `spec-work` closeout / `spec-plan`。但 spec-first 的 **Knowledge Harness 层（角色契约六层之一：把经验沉淀给下一次）仍是半成品**：

- **handoff 无 summary-first 纪律**：`artifact-summary.v1` 合同已落地（`docs/contracts/artifact-summary.md`），但**没有 named workflow 真正按它消费**——plan→work→review 之间仍倾向重读/复制完整上游 artifact。Anthropic「subagent 只回传 1000-2000 token 摘要 + 维护 file-path 标识符按需加载」、Lost-in-the-Middle U 型曲线都指向必须铺开这条纪律。
- **docs/solutions 结构不统一**：现有 17 篇 solution 的 frontmatter 字段**各不相同**（已直接核对：有的 `title/category/problem_type/applies_when/tags`、有的加 `related_components/symptoms/root_cause`、有的加 `related_plan/tracker`），**无一篇**有 v1.15 拟定的 `domain` / `pattern` / `rejected_alternatives` / `applicable_versions` / `invalidation_condition`。检索靠 grep 碰运气、无失效标记、无统一 promote gate。
- **recall 无信任边界**：召回的历史经验没有「advisory candidate vs confirmed」的明确区分契约。Self-RAG/CRAG 证明：检索内容必须被 critique/confidence-grade 后再用，不能默认可信；且 Self-RAG 证明**模型自评不可靠**→ 必须回源到权威 source，不靠自评。
- **capability 不可感知**：任务来了，没有「手头有哪些 skill/MCP/CLI 能力可用」的统一提示（L5）。

父方案 §5.3 给出的桥是六层 Harness（L1 Project Context / L2 Context Budget / L3 Code Intelligence / L4 Memory / L5 Skill Capability / L6 Evidence Promotion），其中 **L3 由 v1.16 capability-aware 协同承担（本计划不做）**，L1 已由现有 `spec-prd`/host docs 覆盖。v1.15 落 **L2 / L4 / L5 / L6 的 spec-first 自有机制**。

关键约束（父方案 + deep-research 钉死）：

- **file-first 只按「规模（<500 条）+ 写入摩擦 + 可审计 + 零运维」论证，不得声称「embeddings 已过时」**——业界是 hybrid 立场（小库/导航用 file，大模糊语料仍用 embedding）。OQ-2 给出转 hybrid 的门槛信号，但默认 file+grep。
- **promotion gate 定位噪声/质量控制，非反注入防御**——内部策展（人/LLM curated file store）的注入面低于 NIST 研究的可优化 RAG 对手。不得引用被对抗验证驳倒的 4 条 claim（父方案 Phase D 已列）。
- **不重建已落地资产**：复用 `artifact-summary.v1`、`context-bundle.v1`、`provider_untrusted` advisory 模式、`schema-validator.js`、`internal.js` 子命令派发范式、docs/solutions 现有目录结构。
- **v1.15 以 provider-absent 为默认设计，不依赖 v1.16**：所有路径以 source-scan / docs/solutions / direct read 为 fallback。

### 当前 source 现状（已直接核对）

- `docs/contracts/knowledge/` 目录**不存在**；`knowledge-harness.md` 零实现（本计划新增,加入 npm files）。**不新建** `solution-promotion.{md,schema.json}`——docs/solutions frontmatter 的 canonical 合同已是 `skills/spec-compound/references/schema.yaml`（本计划扩展它）。
- `docs/contracts/artifact-summary.md`（v1 合同）**已存在**，含完整 `artifact-summary.v1` JSON 形态 + Producer/Consumer 规则；本计划只铺 producer/consumer，不改 schema。
- `docs/contracts/context-bundle.md`、`src/cli/helpers/context-bundle.js` **已存在**；context budget 是对它的增强（included/omitted accounting），非新合同。
- `skills/spec-compound/SKILL.md` **已引用 `docs/solutions`**（现有 promote 流程的接入点，CON-SOL-001 的 consumer 真实存在）；`skills/spec-compound-refresh` 存在。
- docs/solutions 17 篇，5 个分类目录（workflow-issues/architecture-patterns/documentation-gaps/tooling-decisions/developer-experience），frontmatter 字段不统一（见上）。
- 复用范式：`src/contracts/schema-validator.js`（唯一校验器）、`src/cli/commands/internal.js`（子命令派发）、`src/cli/helpers/honest-closeout.js`（validator helper：stdout 出 verdict + reason_code，不落盘第二份 durable artifact）。

---

## Requirements

- **R1.** 新增 `docs/contracts/knowledge/knowledge-harness.md`：把父方案 §5.3 六层表内化为 spec-first 的 canonical Harness map（每层职责 / 可用 skill / 边界 / 对应 v1.15 交付物或既有覆盖）。明确 **L1 已覆盖、L3 归 v1.16、L2/L4/L5/L6 本计划落**。它是**文档骨架 + 边界声明**，不是执行引擎、不新建状态机。
- **R2.（context budget，L2）复用既有 context-bundle 字段，不新增字段（修 P2-A）**：`context-bundle.v1` / `context-bundle.js` 已输出 `related_paths` / `artifact_summaries` / `evidence_paths` / `excluded_context` + `budget{max_files,max_tokens}` + `files`/`estimated_tokens`。v1.15 的「included/omitted accounting」**直接映射到既有字段**：included≈`related_paths`/`evidence_paths`、omitted≈`excluded_context`（带 reason）、budget≈既有 `budget` 块。**只补 prose 纪律 + 必要时让 `excluded_context` 带 reason**，不新增 `included`/`omitted` 新字段、不版本化 schema。framing 按 Anthropic「context 是有限资源、找最小高信号 token 集」。
- **R3.（summary-first handoff，L2）producer + consumer 双侧（修 P1-B）** 铺开 `artifact-summary.v1` 的真实 producer/consumer：
  - **consumer 侧**：`spec-plan` / `spec-work` / `spec-code-review` 之间 handoff 先传 summary + 精确 path，命中 `full_artifact_read_triggers` 才展开 full artifact。
  - **producer 侧（P1-B，artifact-summary.md:54 是独立要求）**：明确每个 workflow 的 outgoing handoff **如何产出 summary**（plan/work/review/compound 各按 Producer 规则汇总 goal/scope/findings/changed-files 等），以及**可断言信号**：summary 缺失时标 `summary_missing`、展开 full artifact 时记 `full_artifact_read_reason`（对应 trigger）。这两个信号让 CON-SUM-001 从「prose 描述」变为「可断言/可测」。
  - **合同已存在，本 R 是 prose 接入（producer+consumer）+ 可断言信号**，不改 schema。**必须定义 expand-on-trigger 的具体条件**（OQ-1）。
- **R4.（docs/solutions promotion，L6）扩展既有 canonical schema，不新建第二套 truth（修 P1-A）**：spec-compound 已有 canonical frontmatter 合同 `skills/spec-compound/references/schema.yaml`（含 bug/knowledge track、required/optional、backward-compat、validation_rules）+ `SKILL.md:72` 明文 canonical。v1.15 **在该 schema 上扩展** 知识检索字段（新增 `optional_fields`：`domain` / `pattern` / `rejected_alternatives` / `applicable_versions` / `invalidation_condition`、新增必填依据见 P1-E），**不新建** `docs/contracts/knowledge/solution-promotion.{md,schema.json}`。
  - **存量语义（修 P1-D）**：现有 17 篇缺新字段，不标「已 verified」（自相矛盾——它们没过新 gate）。复用 schema.yaml 既有「Backward compatibility」段语义，标为 **`legacy_unstructured_advisory`**：可被 recall 但作 advisory，**最小回填** `domain`/`pattern`/`invalidation_condition`/`source_refs` 后才升结构化（回填是可选 follow-up，不阻塞）。
  - **新 promote 必填（修 P1-E）**：新 promote 的 solution 必填 `source_refs`（或 `source_reads_required`），给 recall 回源（R5/OQ-3）提供抓手；`invalidation_condition` 必填。`provenance` 仍可选。
  - 定义 promote gate：candidate→review→promote，只有 verified learning 进 durable store。**gate 定位噪声/质量控制**（非反注入，OQ-4）。
  - 新字段加入 schema.yaml 的 `validation_rules`（沿用既有 enum/array 规则风格），不引入第二套校验器。
- **R5.（memory recall boundary，L4）** 新增 recall 信任边界契约（并入 `knowledge-harness.md` 或独立小节）：recall 命中是 **advisory candidate**，必须回源 source/test/doc 确认才升 confirmed。**复用 `provider_untrusted` 的 advisory 范式语义**（不新建第二套 evidence enum）。**reconfirm 操作化（OQ-3）**：回源到权威 source（人工 reviewer 或既有 deterministic check），**不依赖模型自评**（Self-RAG 证模型自评不可靠）。**回源抓手 = R4 的必填 `source_refs`**：recall 命中的 solution 带 `source_refs`/`source_reads_required`，consumer 回到这些 path 的 source/test/doc 确认——这是 P1-E（新 promote 必填 source_refs）与 R5 回源的闭环。
- **R6.（skill/tool capability lens，L5）降为 v1.15 可选 / 不入 completion gate（修 P2-B）** capability lens：按任务域提示可用 skill / MCP / CLI 能力，复用既有 `tool-facts` / `runtime-capabilities` / skills registry（setup facts），不新建 Skill Radar、不强制、setup facts 不替代语义判断。**它是 L5 advisory，动机最弱、无干净 consumer gate**，因此**移出 v1.15 completion gate**，作为 v1.15 可选附加项或 follow-up（不阻塞 v1.15 收尾，见 Scope）。
- **R7.** 每个**计入 completion 的**交付物兑现至少一个 named workflow 可观察行为变化（CON-SUM-001 / CON-SOL-001 / CON-REC-001，见 Summary）；context budget（R2）作为 summary-first 的 accounting 支撑随 CON-SUM-001 兑现；capability lens（R6）不计入 completion gate（无干净 consumer，降 advisory follow-up）。
- **R8.** 全程 file-first，**零向量库 / 零 SQLite / 零外部 memory 平台**作默认 source truth。docs/solutions promote / recall / capability lens 全走 markdown + grep + deterministic facts。
- **R9.（npm package delivery，修 P1-C）** 新增的 `docs/contracts/knowledge/knowledge-harness.md` 必须加入 `package.json` 的 `files` 数组并补 `package-install-contracts.test.js` 断言（与既有 `docs/contracts/governance/`、`docs/contracts/verification/` 等同级）——v1.14 governance 曾因漏加 `docs/contracts/governance/` 致安装后 schema 缺失崩溃，本计划不得重演。**schema.yaml 在 `skills/spec-compound/` 下，已随包发布**（spec-compound skill 资产），扩展它**无新增 npm delivery 风险**——这也是选「扩展既有 schema 而非新建 docs/contracts 合同」的附带收益。

---

## Scope Boundaries

**本计划做（v1.15）：** knowledge-harness 文档骨架 + npm delivery（R1/R9）、context budget 复用既有字段（R2）、summary-first handoff producer+consumer（R3）、扩展 schema.yaml 结构化字段（R4）、recall boundary（R5）。**capability lens（R6）移出 completion gate，作 follow-up。**

**本计划不做：**

| 不做 | 归属 |
| --- | --- |
| L3 Code Intelligence（影响面/affected-test 候选） | v1.16 capability-aware 协同 |
| 向量库 / embedding / SQLite / 外部 memory 平台 | 明确否决（file-first + hybrid 门槛留 OQ-2 信号，不实现 hybrid） |
| RuleMaturity required-evidence / blocking 晋升 | v1.17 Governance Maturity |
| 重建 `artifact-summary.v1` / `context-bundle.v1` schema | 复用已落地，只铺 producer/consumer + 增强字段 |
| 删除/重写现有 17 篇 solution 的既有字段 | 向后兼容,只叠加新结构化字段(可分批回填) |
| 自动 promote / 自动写长期记忆 | 违反「不自动写长期记忆」;promote 必经 verified gate + 人/workflow 确认 |

### Deferred to Follow-Up Work

- 现有 17 篇 solution 的新字段回填:本计划只定义合同 + 让**新 promote** 走结构化;旧文件回填作为可选 follow-up(grep 仍可用,不阻塞)。
- hybrid 索引(向量/BM25):仅当 OQ-2 的规模/查询模式信号触发才评估,不在 v1.15。

---

## Completion Criteria

- `docs/contracts/knowledge/knowledge-harness.md` 存在,六层表 + 边界 + v1.15 交付物映射齐全,过 doc 一致性自检,**且在 `package.json` files 内 + `package-install-contracts.test.js` 有断言(R9/P1-C)**。
- **扩展后的 `skills/spec-compound/references/schema.yaml`**(非新建合同)含新字段 + validation_rules,过既有 schema 校验流程;新 promote 必填 `invalidation_condition`+`source_refs`;现有 17 篇按 backward-compat(`legacy_unstructured_advisory`)不报 break。
- `artifact-summary.v1` 的 **producer + consumer** 在 `spec-plan`/`spec-work`/`spec-code-review` SKILL prose 中有明确接入 + expand-on-trigger 条件 + `summary_missing`/`full_artifact_read_reason` 可断言信号(CON-SUM-001 可观察可测)。
- context budget 复用既有 `context-bundle.v1` 字段(related_paths/excluded_context),无新字段。
- recall boundary 契约明确「advisory candidate→回源→confirmed」,回源走 `source_refs` 到权威 source 非模型自评(CON-REC-001 可观察)。
- `spec-compound` promote 接入扩展后 schema 的 new-required 校验 + verified gate(CON-SOL-001 可观察)。
- 4 个 OQ 在「Open Questions / Resolved」中给出落地决议。
- `npm test` 全绿(新增 contract/unit tests + package-install 断言 + 现有不回归);双宿主(Claude/Codex)prose parity。
- CHANGELOG / README v1.15 进展 / 父方案 Phase D 同步;framing 守住(file-first 按规模论证、promotion gate 噪声控制)。
- **capability lens(R6/U6)不计入 completion gate**(移出,作 follow-up;修 P2-B)。

---

## Open Questions

### Resolved During Planning（4 个 deep-research OQ 的落地决议）

- **OQ-1（summary-first expand-on-trigger 条件）→ 决议**:复用 `artifact-summary.v1` 已有的 `full_artifact_read_triggers` 字段(合同已含两条示例),v1.15 把它**具体化为可判定条件清单**写进 consumer prose:① summary 缺下游所需的 requirement/task/finding/evidence detail;② reviewer 需精确 prose 或 line reference 才能成 finding;③ **互依赖任务**——下游 unit 的输入依赖上游 unit 的具体实现细节(非仅结论)时,保留精确 path 并展开(正面回应 Cognition 的碎片化警告)。阈值不是行数,是「缺 detail 即展开」的语义触发,由 consumer LLM 判断。
- **OQ-2（file-first 转 hybrid 门槛）→ 决议**:v1.15 **不实现 hybrid**,但在 `knowledge-harness.md` 登记**转 hybrid 的信号(非硬阈值)**:docs/solutions 条目数持续增长到 grep 召回精度下降(单关键词命中过多需多轮过滤)、或出现「语义近但用词不同」的 recall miss 反复发生。默认 file+grep;`<500 条` 是当前规模事实(17 篇,远低于),不是 benchmark 阈值。framing:按规模/写入摩擦论证,不称 embeddings 过时。
- **OQ-3（recall 回源操作化）→ 决议**:reconfirm **走权威 source(既有 deterministic check / 人工 reviewer),不依赖模型自评**(Self-RAG 实证模型自评不可靠)。具体:recall 命中 → 标 advisory candidate + `source_reads_required`(复用 artifact-summary evidence 范式)→ consumer 回到 docs/solutions 引用的 source path / test / doc 确认 → 才升 confirmed。无自动 promote、无模型自评晋升。
- **OQ-4（promotion gate 最小机制）→ 决议**:最小 durable 机制 = **结构化 frontmatter(`invalidation_condition` 必填 + 可选 `provenance`)+ verified gate(只有 verified learning 进 durable store)**,定位**噪声/质量控制**非反注入。不引入签名/完整性校验/沙箱(过度设计,内部策展注入面低)。promote 经 `spec-compound` 既有人/workflow 确认点,不自动。

### Deferred to Implementation

- knowledge-harness.md 与 ai-coding-harness.md(目录级 map)的引用关系细化。
- capability lens 是否需独立 consumer gate,还是并入 spec-plan Phase 0 advisory(实现时按是否有干净 consumer 决定;无则降 advisory prose,明确标注,守「无消费方=不交付」)。

---

## Implementation Units

> 批 1 = U1+U2+U3(文档骨架 + summary-first + recall boundary,复用已落地合同、最易过 gate);批 2 = U4+U5(扩展 schema.yaml + compound 接入)。U6 capability lens 移出 gate 作 follow-up。U7 docs/npm 同步贯穿。

### U1. `knowledge-harness.md` 六层骨架 + 边界声明 + npm delivery（批 1 前置）

- 新增 `docs/contracts/knowledge/knowledge-harness.md`:六层表(L1-L6)+ 每层职责/可用 skill/边界 + v1.15 交付物映射(L1 已覆盖、L3 归 v1.16、L2/L4/L5/L6 本计划,L5 移出 completion gate)。
- 内嵌 recall boundary 小节(R5)的契约定义 + OQ-1/2/3/4 决议锚点。
- framing 守卫:file-first 按规模论证、promotion gate 噪声控制(写进文档)。
- **npm delivery(修 R9/P1-C)**:把 `docs/contracts/knowledge/knowledge-harness.md`(若用目录则 `docs/contracts/knowledge/`)加入 `package.json` 的 `files` 数组。
- 验证:doc 存在 + 六层齐全 + 与父方案 §5.3 一致 + 不含被驳倒的 4 条 claim + 在 `package.json` files 内。

### U2. summary-first handoff producer + consumer 铺开 + context budget accounting（兑现 CON-SUM-001）— 批 1

- **consumer 侧**：`spec-plan` / `spec-work` / `spec-code-review` SKILL prose 接入 `artifact-summary.v1` 消费——先读 summary + 精确 path，命中 OQ-1 决议的 expand-on-trigger 条件才展开 full artifact。
- **producer 侧（修 P1-B）**：明确各 workflow outgoing handoff 如何**产出** summary（按 artifact-summary.md:54 Producer 规则汇总）+ **可断言信号** `summary_missing` / `full_artifact_read_reason`，使 CON-SUM-001 可测。
- 不改 `artifact-summary.v1` schema；补 expand-on-trigger 具体条件清单（含互依赖任务的保留精确 path 纪律）。
- **context budget accounting（R2，修 P2-A）**：映射到 **既有 `context-bundle.v1` 字段**——included≈`related_paths`/`evidence_paths`、omitted≈`excluded_context`（带 reason）、budget≈既有 `budget` 块。**不新增 `included`/`omitted` 字段**，只补 prose 纪律 + 必要时 `excluded_context` 带 reason。
- 验证：三 SKILL prose 含 summary-first 消费句 + producer 产出规则 + expand-on-trigger 条件 + `summary_missing`/`full_artifact_read_reason` 信号；context budget 复用既有字段（无新字段）；contract test；双宿主 parity。

### U3. recall boundary 契约（兑现 CON-REC-001）— 批 1

- 在 `knowledge-harness.md`(或独立小节)定义 recall 信任边界:advisory candidate → 回源(权威 source,非模型自评)→ confirmed。复用 `provider_untrusted` advisory 语义,不新建 evidence enum。
- `spec-plan` / `spec-debug` prose 接入:recall 命中标 advisory + `source_refs`/`source_reads_required`(对应 R4 新 promote 必填字段),结论需回源确认。
- 验证:prose 含「recall 是 candidate / 回源确认 / 非模型自评」;contract test;双宿主 parity。

### U4. 扩展 spec-compound 既有 schema.yaml（修 P1-A，不新建第二套 truth）（批 2 前置）

- **在 `skills/spec-compound/references/schema.yaml` 扩展**（不新建 `docs/contracts/knowledge/solution-promotion.*`）:新增 `optional_fields` `domain` / `pattern` / `rejected_alternatives` / `applicable_versions` / `invalidation_condition` + `source_refs`;新增对应 `validation_rules`（沿用既有 enum/array 规则风格 + 数组引号规则）。
- **新 promote required（修 P1-E）**:`invalidation_condition` + `source_refs` 对**新 promote** 必填(给 R5 回源抓手);`provenance` 可选。约束「new required」落在 **promote 路径(spec-compound prose)** + schema.yaml `validation_rules` 文字,沿用既有「NEW docs follow track rules / legacy harmless」的 backward-compat 表达,不引入第二套校验器。
- **存量语义(修 P1-D)**:现有 17 篇标 **`legacy_unstructured_advisory`**(复用 schema.yaml 既有 backward-compat 段),可 recall 作 advisory,最小回填 domain/pattern/invalidation_condition/source_refs 后才升结构化;回填是可选 follow-up,不阻塞、不报 break。
- 验证:schema.yaml 扩展后既有 spec-compound schema 校验(`yaml-schema.md` 流程)对新字段 valid/invalid;现有 17 篇按 backward-compat 不报 break;framing(噪声控制非反注入)写进 schema.yaml 注释或 knowledge-harness.md。

### U5. `spec-compound` promote gate 接入扩展后的 schema（兑现 CON-SOL-001）— 批 2 收尾

- `spec-compound` / `spec-compound-refresh` SKILL prose 接入:promote **新** solution 时走扩展后 schema.yaml 的 new-required 校验(`invalidation_condition`+`source_refs` 必填)+ verified gate;无 verified evidence 不进 durable store。存量 17 篇 `legacy_unstructured_advisory` 不被阻塞。
- 复用 spec-compound 既有 docs/solutions 接入点 + 既有 schema 校验流程(`references/yaml-schema.md`),**不重建 promote 流程、不引入第二套 validator**。
- 验证:spec-compound prose 含 new-solution 必填字段 + verified gate + 存量 legacy advisory 说明;contract test;双宿主 parity。

### U6. capability lens（L5 advisory）— **移出 v1.15 completion gate，降 follow-up（修 P2-B）**

- **范围调整(修 P2-B)**:L5 动机最弱、无干净 consumer gate,**不计入 v1.15 completion criteria**(见 Completion/矩阵)。作为 v1.15 可选附加项或独立 follow-up/v1.16 候选,**不阻塞 v1.15 收尾**。
- 若实现:按任务域提示可用 skill/MCP/CLI,复用 `tool-facts`/`runtime-capabilities`/skills registry(setup facts),advisory 接入 `spec-plan` Phase 0;不新建 Skill Radar、不强制、setup facts 不替代语义判断。
- 验证(若实现):prose 含 capability advisory + 「不替代语义判断」边界,明确标 advisory contract。

### U7. docs / CHANGELOG / README / 父方案 / npm 同步 — 贯穿

- CHANGELOG 按格式追加(作者 leokuang,user-visible)。
- README v1.15 进展:未开始→计划中(本 plan)→各批完成后更新。
- 父方案 Phase D 交付清单与本 plan 对齐(若有 canonical 字段定义,回填 §0.4.3 登记)。
- ai-coding-harness.md 目录级 map 补 knowledge-harness 锚点。
- **npm delivery test(修 R9/P1-C)**:`tests/unit/package-install-contracts.test.js` 补断言 `pkg.files` 含 `docs/contracts/knowledge/knowledge-harness.md`(与既有 governance/verification 断言同级)。
- 验证:四文档一致;`scale-provider-doc-contracts` 不回归;`package-install-contracts` 新断言通过。

---

## Requirements → Units 覆盖矩阵

| Requirement | Units |
| --- | --- |
| R1 knowledge-harness 文档 | U1 |
| R2 context budget(L2,复用既有 context-bundle 字段) | U2(映射 related_paths/excluded_context,无新字段) |
| R3 summary-first handoff(L2,producer+consumer) | U2 |
| R4 扩展 schema.yaml(L6,非新合同) | U4 |
| R5 recall boundary(L4,source_refs 回源) | U3 |
| R6 capability lens(L5,移出 gate) | U6(follow-up,不计 completion) |
| R7 named workflow 行为变化 | U2(CON-SUM-001)/ U5(CON-SOL-001)/ U3(CON-REC-001) |
| R8 file-first 零向量库 | U1/U4/U5(全程)|
| R9 npm package delivery | U1(knowledge-harness 加 files)+ U7(test 断言);schema.yaml 已随 skills 包发布 |
| OQ-1~4 决议 | U1(登记)+ U2(OQ-1)+ U3(OQ-3)+ U4(OQ-4)|

---

## Test Plan

- **Contract tests**:扩展后 `schema.yaml` 的新字段 valid/invalid(新 promote 必填 `invalidation_condition`+`source_refs`、knowledge-track 其余 optional);现有 17 篇按 backward-compat(`legacy_unstructured_advisory`)不报 break;`knowledge-harness.md` 六层齐全 + 不含被驳倒 claim + 在 `package.json` files 内;`artifact-summary.v1` expand-on-trigger 条件清单 + `summary_missing`/`full_artifact_read_reason` 信号存在;context budget 复用既有 context-bundle 字段(无新字段)。
- **package-install test(R9/P1-C)**:`package-install-contracts.test.js` 断言 `pkg.files` 含 `docs/contracts/knowledge/knowledge-harness.md`。
- **Prose contract tests**(沿用 spec-* contract test 范式):`spec-plan`/`spec-work`/`spec-code-review` 含 summary-first 消费 + expand-on-trigger;`spec-plan`/`spec-debug` 含 recall advisory + 回源;`spec-compound` 含结构化 promote + verified gate。
- **双宿主 parity**:Claude / Codex 投影 prose 一致(沿用现有 parity 回归)。
- **回归**:`npm test` 全绿;`scale-provider-doc-contracts.test.js` 不回归;`npm run lint:skill-entrypoints` 通过。
- **fresh-source eval**(agent/skill prose 变更):按 `docs/contracts/workflows/fresh-source-eval-checklist.md`,对改动的 SKILL 做 fresh read-only reviewer 评估;host 缺 dispatch primitive 时记录未执行原因。

---

## Residual Risks（设计权衡，缓解非消除）

- **RR-1 summary-first 漏 detail（F3）**:summary-first handoff 省 token 与「漏掉下游需要的 detail」是固有 tradeoff。OQ-1 的 expand-on-trigger 缓解它,但触发是 **LLM 判断**——LLM 可能误判「不缺 detail」而漏展开关键证据(Cognition 警告的核心)。**缓解非消除**:互依赖任务强制保留精确 path + 「缺 detail 即展开」语义触发 + reviewer 需精确 prose/line ref 时必展开;残留风险接受,因有 Anthropic/best-practice 背书且 path 始终可回源。
- **RR-2 capability lens 弱消费(F4)**:L5 若无干净 consumer 则降级 advisory,可能停在「写了没人真消费」。已标 U6 最低优先/可砍,不阻塞 v1.15 核心闭环。

---

## 边界与反模式自检（落地前确认）

- ✅ file-first,零向量库/SQLite/外部 memory 平台作默认 source truth。
- ✅ 复用 `artifact-summary.v1` / `context-bundle.v1` / `provider_untrusted` 范式,不重建。
- ✅ 不自动 promote / 不自动写长期记忆;promote 经 verified gate + 人/workflow 确认。
- ✅ recall 回源走权威 source,不靠模型自评(Self-RAG 教训)。
- ✅ framing:file-first 按规模/写入摩擦论证,不称 embeddings 过时;promotion gate 噪声控制非反注入。
- ✅ 不引用被对抗验证驳倒的 4 条 claim。
- ✅ 每交付物有 named workflow consumer(无干净 consumer 的降级为 advisory 并标注)。
- ✅ 双宿主 parity;不手改 generated runtime mirror。
- ✅ v1.15 provider-absent 默认,不依赖 v1.16。
