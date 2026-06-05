---
title: "feat: Governance Lens Foundation（v1.14，分批落地）"
type: feat
status: active
date: 2026-06-05
spec_id: 2026-06-05-001-feat-governance-lens-foundation
depth: deep
origin:
  - docs/01-需求分析/13.scale集成/spec-first内化集成scale-project-scaffold技术方案.md
  - docs/01-需求分析/13.scale集成/project-scaffold依赖安装流程与spec-first-setup优化技术方案.md
  - docs/01-需求分析/13.scale集成/README.md
host: claude+codex
slice: v1.14（父方案 Phase C / P1 治理 lens；本计划覆盖完整设计，执行分两批）
implements_schemas:
  - docs/contracts/governance/task-governance-signals.schema.json
  - docs/contracts/governance/resource-governance-lens.schema.json
  - docs/contracts/governance/gate-lens-taxonomy.schema.json
  - docs/contracts/governance/rule-maturity.schema.json
---

# feat: Governance Lens Foundation（v1.14）

**Target repo:** `spec-first`

## Summary

把 SCALE 集成父方案 Phase C 的「治理 lens」内化为 spec-first 的 **advisory 治理 facts 层**：脚本采集确定性的任务规模/资源/上下文信号，产出 candidate 等级、resource advisory 和 lens taxonomy，由 workflow LLM 在 `spec-plan`（plan depth 建议）与 `spec-work`/`spec-code-review`（resource advisory）消费并保留最终判断权。v1.14 只交付 **shadow / advisory** 成熟度，blocking 默认关闭且无实现（留到 v1.17，需先沉淀误报证据 + 人审）。

兑现两处 named workflow 行为变化：
- **`[CON-TASK-001]`**：`spec-plan` 的 plan depth 评估从纯 LLM 自判，变为在 deterministic `candidate_level`（signals + reason_codes）基础上确认或显式 override（记理由）。
- **`[CON-RES-001]`**：`spec-work` closeout / `spec-code-review` 命中 large file / generated output / raw log / staging-scope 越界时，出现对应 resource advisory 项（reason_code 优先，不 blocking）。

本计划**完整覆盖** v1.14 设计（task-governance-signals + resource-governance-lens + gate-lens taxonomy + RuleMaturity shadow/advisory），但**执行分两批**：批 1 = task-governance-signals + `spec-plan` 接入（最 deterministic、`spec-plan` 高频、最易过 consumer gate）；批 2 = resource-governance-lens + `spec-work`/`spec-code-review` 接入。gate-lens taxonomy 与 RuleMaturity shadow 作为支撑 contract 贯穿两批，**不做独立执行引擎**。

---

## Problem Frame

v1.11–v1.13 已经把 readiness facts、verification facts、honest-closeout 做成 deterministic facts 并接入 `doctor` / `spec-work` closeout。但 spec-first 当前对「这次任务有多大、该用多深的 plan、提交了哪些不该提交的资源」仍**完全靠 LLM 临场判断**，没有确定性信号支撑：

- `spec-plan` 的 plan depth（Lightweight/Standard/Deep）是纯 LLM 自判（`skills/spec-plan/SKILL.md:233-241` Phase 0.6），唯一的确定性升降级先例是 Phase 1.4b（外部 contract surface 触发 Lightweight→Standard，`:386-396`），没有规模信号输入。
- `spec-work` closeout / `spec-code-review` 已有 diff 规模阈值（Tier 2 升级 `>=400 行/>3 目录`、`>=1000 行`），但全是 **LLM 从内联 `git diff` 输出口算**，没有确定性 helper，也没有 large file / generated output / staging-scope 的统一 resource advisory。

父方案 §4.1/§4.7/§4.8 给出的桥是：

`确定性信号采集 -> candidate facts + reason_code -> workflow LLM 确认/升降级 -> 用户最终判断`

关键约束（父方案钉死）：**spec-first 借鉴 SCALE 的信号采集，不借鉴它的自动裁决**。`scale-engine/src/workflow/TaskLevelDetector.ts` 把正交信号折叠成单一 score 再自动判 S/M/L/CRITICAL + 伪 confidence；`RuleMaturity.ts` 用固定阈值自动晋升到 blocking。这些都违反「Scripts prepare facts, LLM decides」与「非强状态机 / 非中心化规则引擎」边界，**不可照搬**。

### 当前 source 现状（已直接核对）

- `docs/contracts/governance/` 目录**不存在**；task-governance-signals / resource-governance-lens / gate-lens / RuleMaturity 在 `src/cli`、`src/contracts`、`docs/contracts`、`skills`、`tests` 中**零实现**（能力名只出现在 roadmap/规划文档）。v1.14 是真空白，不与现有实现重复。
- **无现成 git-diff 信号 helper**：全仓 `src/` 没有跑 `git diff --numstat` / `--name-only` 产 file_count/line_delta 的可复用模块。唯一的 git 调用是 `src/cli/helpers/target-repo.js:19` 与 `context-bundle.js:474` 的 `rev-parse --show-toplevel`（只解析 repo root）。`spec-code-review` 的 Stage 1/Stage 3 scale preflight 内联跑 `git diff` 是 LLM/shell 编排，非 helper。
- v1.13 已确立可复用范式：`src/cli/helpers/target-repo.js`（containment）、`src/contracts/schema-validator.js`（唯一校验器）、`src/cli/commands/internal.js`（子命令派发）、`src/cli/helpers/honest-closeout.js`（validator helper：stdout 出 verdict + reason_code，不落盘第二份 durable artifact）。

### 必须先 reconcile 的 roadmap 口径漂移

`docs/00-版本路线/2026-06-03-scale-engine-fusion-version-split.md:34/37` 把 **v1.14 写成 "Six-Layer Knowledge Harness"**、v1.17 = Evidence & Rule Maturity。但**较新的** source-of-truth——父方案 §8.1 相位对照表 + `docs/01-需求分析/13.scale集成/README.md` + `CHANGELOG.md:22`（"把 RuleMaturity 明确拆成 v1.14 foundation 与 v1.17 maturity"）——已收敛为 **v1.14 = Governance Lens Foundation、v1.15 = Knowledge Harness、v1.17 = Governance Maturity**。

本计划**以父方案 §8.1 + README 为准**（较新且为 source-of-truth）。`docs/00-版本路线/...split.md` 的滞后口径作为 **U8 docs 同步项**修正，不阻塞本计划实现。

---

## Requirements

- **R1.** 新增 `task-governance-signals.v1` source contract（schema + docs）。输出模型以父方案 §4.1 为准：`{schema_version, candidate_level, signals, risk_domains, recommended_artifacts, recommended_gate_lenses, reason_codes}`。**关键去除项**：不输出 SCALE 的折叠 `score`、不输出伪 `confidence` 数值。`candidate_level` 是 candidate 不是 final。
- **R2.** `candidate_level` 枚举对齐 `spec-plan` 的 **plan depth**（`lightweight` / `standard` / `deep`），不是 SCALE 的 `S/M/L/CRITICAL`（CON-TASK-001 的 consumer 是 spec-plan，等级语言必须与 consumer 一致）。`critical` 风险作为独立的 `risk_domains` / `reason_codes` 信号表达，不挤进 depth 枚举。
- **R3.** task-governance-signals 的信号采集**分两个来源**，分别对应两个 workflow 阶段（架构性约束，不可混）：
  - **plan-declared 来源（`spec-plan`，pre-code 默认无 git diff）**：从 plan 声明面采集——implementation unit 的 Files 清单计数、unit 数、cross-module 路径前缀(`>=2` 顶层目录)、request/plan 文本关键词命中。
  - **git-diff 来源（`spec-work`/`spec-code-review`，代码已写）**：从 `git diff --numstat` 采集 file_count/line_delta；这条来源主要喂 resource-governance-lens（R5），task-signals 在此可作可选增强。
  - 每个 signals 对象标 `signal_source: "plan-declared" | "git-diff"`，缺信号时用 reason_code 标注，不伪造。
- **R4.** 信号采集是 **deterministic script**：file_count/line_delta 用 `git diff --numstat`（每行 `<added>\t<deleted>\t<file>`，**不用** SCALE 的 insertion/deletion 正则——该正则有缺陷使 lineDelta 恒为 0）；cross-module 用纯 JS 路径前缀分组；keyword_hits 用纯 JS 扫描且**补中文关键词**与项目相关路径（`skills/` `agents/` `src/cli/contracts/` `docs/contracts/`）。git 调用用 `execFileSync('git', [...])` 数组式（不拼 shell 字符串、不吞 error/exit-code）。
- **R5.** 新增 `resource-governance-lens.v1` source contract（schema + docs）。输入父方案 §4.8 + project-scaffold `resource-policy.json`：大文件阈值（默认 `maxGitFileSizeBytes=5MB`）、generated output / retained runtime 目录白名单、raw log retention/redaction、staging-scope（`git add .` 风险 / 不应入暂存的 generated mirror）。输出 advisory facts + reason_code，**不 blocking**。
- **R6.** 新增 `gate-lens-taxonomy.v1` source contract（schema + docs）：把 G0-G22 压缩成 7 个 lens family（Preflight/Exploration/Planning/Execution/Verification/Review/Summary）的**命名词表**，供 task-governance-signals 的 `recommended_gate_lenses` 与 resource-governance-lens 的维度命名共享。**它是 taxonomy 词表，不是 gate 执行器**（父方案"不机械 JS 化 G0-G22"）。
- **R7.** 新增 `rule-maturity.v1` source contract（schema + docs）：借鉴 `RuleMaturity.ts` 的**数据模型 + 阶段枚举**（`shadow` / `advisory` / `required-evidence` / `blocking`，对齐父方案 §4.7），含 `shadow_hits` / `defect_evidence_refs` / `false_positive_refs` / `rollback` 字段。v1.14 **只实现 `shadow` / `advisory` 两阶段**；`required-evidence` / `blocking` 是 schema 预留枚举但**无升级逻辑、无自动晋升**（留 v1.17）。
- **R8.** 四个 capability 全部照搬 v1.13 范式：schema 落 `docs/contracts/governance/**`、复用 `src/contracts/schema-validator.js`、复用 `src/cli/helpers/target-repo.js` containment、`src/cli/commands/internal.js` 子命令派发。task-governance-signals / resource-governance-lens 是 **producer/validator helper**（stdout 出 facts + reason_code），不落盘第二份 durable artifact。
- **R9.** `spec-plan` Phase 0.6 接入（CON-TASK-001）：plan depth 评估在 `candidate_level` 基础上确认或显式 override 并记理由；脚本只产信号 + 候选等级，LLM 保留最终 depth 判断权。
- **R10.** `spec-work` closeout / `spec-code-review` 接入（CON-RES-001）：命中 resource lens 项时产 advisory facts（large file added / generated output committed / raw log 体积 / staging-scope 越界），与 honest-closeout 并列，reason_code 优先、不 blocking。复用现有 Tier 2 diff 阈值口径，不另起一套。
- **R11.** 不引入 blocking：所有 lens 默认 `shadow`/`advisory`。任何 gate 都不在 git add / closeout 时自动 block。blocking 路径是 v1.17 的显式 non-goal。
- **R12.** 不新增长驻 daemon / 后台 shadow-runner 自增计数：`shadow_hits` 重框为「各 workflow 检查点的离散、带证据引用的观察」，在 workflow 节点离散采集，不靠常驻进程。
- **R13.**（§0.4.3 单一定义收敛，钉死）schema 落盘后必须把 canonical 字段定义转到 schema 文件：四份 governance schema 登记进父方案 §0.4.3 单一定义表，并把父方案 §4.1（`candidate_level` enum、删除 `score`/`confidence`、`recommended_gate_lenses` 词汇）/§4.7/§4.8 的字段定义改为对 schema 文件的引用（照 v1.13 `spec-work-run-artifact/v1` 既有做法，见 `docs/plans/2026-06-04-003-...:498`）。否则 §4.1 的 `candidate_level:"L"`+`confidence:0.74` 与新 schema 的 `lightweight/standard/deep`+无 confidence 形成两份矛盾 canonical，违反 §0.4.3。
- **R14.** rule-maturity.v1 在 v1.14 是**无 consumer 的 schema 预留**：§9.0.1 consumer-gate 表无 CON-RULEMATURITY，本切片不为它主张 consumer gate（它是 §8 Phase C 明列交付物 + v1.17 enabler，不是空转）。task-governance-signals / resource-governance-lens 可选地 emit 一条带 `evidence_ref` 的 shadow 观察，但不构成 v1.14 验收门槛。

**Origin acceptance examples:**（来自父方案 §9.0.1 consumer gate，作为本计划测试锚点）
- **AE-CON-TASK（`[CON-TASK-001]`）**：`spec-plan` 显示 candidate level 与 reason_codes，且 LLM 可记录理由升/降级（candidate 真正进入决策，而非被忽略）。
- **AE-CON-RES（`[CON-RES-001]`）**：命中 large file / generated output / raw log 时 closeout 或 review 出现对应 advisory 项。

---

## Scope Boundaries

- **不借鉴 SCALE 的自动裁决**：不做 score 折叠、不输出伪 confidence、不固定阈值自动晋升、不 blocking 执行。脚本只产正交信号 + 候选 + reason_code。
- **gate-lens 是 taxonomy 不是执行器**：不机械 JS 化 G0-G22，不复制 `all.sh` 的中心化 blocking 聚合器，不引入 inline pre/post-tool hook。
- **RuleMaturity 只到 advisory**：v1.14 不实现 `required-evidence` 降级 closeout、不实现 `blocking`、不实现自动 promotion 状态机（父方案明确 v1.17 才做，且需误报证据 + 人审）。
- **不接管 git / 不自动 block**：resource-governance-lens 是 advisory facts，不在 `git add` 时拦截、不阻断 commit / closeout。
- **不新建中心 governance runtime**：不新增 `src/governance/` 顶层模块作为近期实现（父方案 §3 顶层模块是 contract 稳定后的晋升候选）；helper 落 `src/cli/helpers/`。
- **不实现 v1.15 Knowledge Harness / v1.16 provider**：六层知识体系、context budget、provider adapter 不在本切片。

### Deferred to Follow-Up Work

- **批 2 的 resource-governance-lens 与 `spec-work`/`spec-code-review` 接入**：本计划完整设计，但执行排在批 1（task-governance-signals + spec-plan）之后；批 1 过 CON-TASK-001 gate 后再启动批 2。
- **RuleMaturity required-evidence / blocking**（v1.17）：需要 v1.14 foundation 先运行、沉淀误报证据 + 人审（父方案 §4.7）。本计划只落 schema 预留枚举 + shadow/advisory 记录。
- **git-diff 信号 producer 在 `spec-debug` 等其他 workflow 的复用**：本切片只接 spec-plan / spec-work / spec-code-review；其他 workflow 的接入留到各自切片。
- **`docs/00-版本路线/...split.md` 的 v1.14 整体重写**：本计划只在 U8 修正 v1.14/v1.15/v1.17 命名与 RuleMaturity 拆分口径，不重写整篇版本路线叙述。

---

## Completion Criteria

本计划涉及 source-owned contract schema + workflow prose 行为，`status` 移到 `completed` 前必须满足：

**批 1（task-governance-signals + spec-plan，CON-TASK-001）：**
- `task-governance-signals.v1` + `gate-lens-taxonomy.v1` + `rule-maturity.v1` schema 落 `docs/contracts/governance/**`，经 `src/contracts/schema-validator.js` 校验，valid/invalid fixture 测试通过。
- git-diff 信号 producer（`--numstat` + 纯 JS cross-module/keyword）与 plan-declared 信号采集实现，`signal_source` 正确区分两来源；空 diff / pre-code / base-ref 解析失败有 reason_code，不崩溃。
- **§0.4.3 收敛（批 1 三份 schema 部分）**：task-governance-signals / gate-lens-taxonomy / rule-maturity 登记进父方案 §0.4.3 表，§4.1 的 `candidate_level` enum + 删 score/confidence 已转为 schema 引用（U7）。
- `spec-plan`（source skill `skills/spec-plan/**`，generated runtime 由 `spec-first init` 同步）Phase 0.6 真实消费 `candidate_level`，consuming gate `[CON-TASK-001]` 有一条断言捕获行为变化（candidate level + reason_codes 进入决策、override 记理由）。
- README v1.14 进展→`进行中`，批 1 CHANGELOG 条目已写（U8 第一段）。

**批 2（resource-governance-lens + spec-work/code-review，CON-RES-001）：**
- `resource-governance-lens.v1` schema 落地并经校验；resource advisory 项（含 §4.8 全五项，含 owner/module-path-hint）产出 + reason_code。
- **§0.4.3 收敛（批 2 部分）**：resource-governance-lens 登记进 §0.4.3 表，§4.8 字段转 schema 引用（U7 补做）。
- `spec-work` closeout / `spec-code-review` 接入，consuming gate `[CON-RES-001]` 有断言捕获 advisory 行为变化。
- README v1.14 进展→`已完成`，批 2 CHANGELOG 条目已写（U8 第二段）。

**两批共同：**
- `npm test`（unit + smoke + integration）全绿；父方案 §9.0 REG-* 回归门槛（REG-SUITE-001 等）保持绿。
- `CHANGELOG.md` 按格式追加 `(user-visible)`（plan depth 建议 + resource advisory 对用户可见）。
- README / docs 同步：`docs/01-需求分析/13.scale集成/README.md` v1.14 进展更新；`docs/00-版本路线/...split.md` v1.14/v1.15/v1.17 命名口径 reconcile。

---

## Direct Evidence Readiness

- target_repo: `spec-first`（当前 cwd，git toplevel 一致）
- evidence_sources: 直接源码读取（scale-engine `TaskLevelDetector.ts`/`RuleMaturity.ts` 全文、project-scaffold `resource-policy.json`/`gates/all.sh` 全文、v1.13 plan 全文、spec-plan/spec-work/spec-code-review skill prose、v1.13 helper/schema 模式）、并行 research workflow（3 agent）、rg 结构搜索、git log/status
- source_refs: `skills/spec-plan/SKILL.md`、`skills/spec-work/references/shipping-workflow.md`、`skills/spec-work/SKILL.md`、`skills/spec-code-review/SKILL.md`、`src/cli/helpers/target-repo.js`、`src/cli/helpers/honest-closeout.js`、`src/cli/helpers/spec-work-run-artifact.js`、`src/cli/helpers/context-bundle.js`、`src/cli/commands/internal.js`、`src/contracts/schema-validator.js`、`src/cli/helpers/secret-deny-patterns.js`、`docs/contracts/verification/verification-run-summary.schema.json`
- external_refs（snapshot，落地前 `--help` 复核）: `/Users/kuang/xiaobu/scale-engine/src/workflow/TaskLevelDetector.ts`、`/Users/kuang/xiaobu/scale-engine/src/evolution/RuleMaturity.ts`、`/Users/kuang/xiaobu/project-scaffold/.scale/resource-policy.json`、`/Users/kuang/xiaobu/project-scaffold/scripts/gates/all.sh`
- current_revision: `f9f4944d`（branch `leo-2026-06-03-ceupdate`）
- worktree_status: dirty（v1.11/v1.13 加固改动未提交、`output/` untracked、`bak/` 删除未提交；均与本计划无关，本计划只新增 plan 文件不碰工作区）
- confidence: high（接入点与可复用 helper/schema 模式已逐文件确认；scale/scaffold 源已全文读）
- limitations: 未实际运行 helper（尚未实现）；plan-declared 信号的「implementation unit Files 清单」解析口径需实现时与 plan-template 实际结构对齐；spec-code-review Stage 3 preflight 的确定性化需实现时与现有口算字段逐项对齐

---

## Key Technical Decisions

- **candidate_level 用 plan depth 语言（lightweight/standard/deep），不用 S/M/L/CRITICAL**：CON-TASK-001 的 consumer 是 spec-plan，等级语言必须与 consumer 的既有词汇一致才能被自然消费；`critical` 风险走 `risk_domains`/`reason_codes` 而非挤进 depth 枚举。这是与 SCALE 最大的语义分歧点。
- **信号采集分 plan-declared / git-diff 两来源**：plan time 通常 pre-code（无 git diff），强行用 numstat 会得到空信号；plan 阶段信号来自 plan 声明面，git-diff 信号属 work/review 阶段。两来源用 `signal_source` 显式区分，不混。这是 research 挖出的架构性 nuance，决定了批 1/批 2 的信号源切分。
- **丢弃 SCALE 的 score/confidence**：脚本只暴露原始正交信号 + 透明分桶 + reason_code，不暴露 opaque score、不输出伪 confidence。任务分级是 LLM 语义判断（对齐 CLAUDE.md「不让脚本模拟语义范围/review 结论」）。
- **git 信号用 `--numstat` + execFileSync 数组式**：SCALE 的 insertion/deletion 正则有缺陷（per-file 行不含该字样、汇总行被过滤，lineDelta 恒为 0），改用 `git diff --numstat`（`<added>\t<deleted>\t<file>`）；execFileSync 数组式避免 shell 注入与吞 error。
- **gate-lens 是 taxonomy 词表不是执行器**：7 lens family 只提供共享命名维度（task-signals 的 recommended_gate_lenses + resource-lens 维度命名），不复制 23 个 G 脚本、不做 blocking 聚合器。
- **RuleMaturity v1.14 只到 advisory**：借数据模型 + 阶段枚举，shadow/advisory 两阶段可记录；required-evidence/blocking 是预留枚举但无逻辑。把「脚本算 eligibility，人工记名才晋升」的职责切分留到 v1.17。
- **lens helper 是 validator/producer，不落盘第二份 durable artifact**：照 honest-closeout 范式（stdout 出 verdict + reason_code）；若将来 RuleMaturity 误报证据需要 ledger，再按 spec-work-run-artifact 的 atomic immutable 范式落（v1.17）。

---

## Open Questions

### Resolved During Planning

- v1.14 是 Governance Lens 还是 Knowledge Harness？→ Governance Lens Foundation（以父方案 §8.1 + README + CHANGELOG:22 为准；`docs/00-版本路线` 滞后口径在 U8 reconcile）。
- candidate_level 用什么等级词？→ plan depth（lightweight/standard/deep），与 spec-plan consumer 一致，不用 S/M/L/CRITICAL。
- plan 阶段没有 git diff 怎么采信号？→ 分 plan-declared / git-diff 两来源，plan 阶段用声明面信号。
- v1.14 要不要做 blocking？→ 否，只到 shadow/advisory；blocking 是 v1.17（需误报证据 + 人审）。
- 执行一次全做还是分批？→ 完整设计、分两批执行（用户拍板）；批 1 = task-signals + spec-plan，批 2 = resource-lens + work/review。

### Deferred to Implementation

- plan-declared 信号的「implementation unit Files 清单 / unit 数」解析口径：实现时读 `skills/spec-plan/references/plan-template.md` 实际结构对齐，不假设字段名。
- `candidate_level` 的分桶阈值（多少 unit / 多少 cross-module 前缀 → 建议哪档 depth）：实现时给**透明分桶**（非 opaque score），并写进 docs 让 LLM 可质疑；阈值是 advisory 建议非裁决。
- resource-governance-lens 与 spec-code-review Stage 3 preflight 既有口算字段（changed_file_count / sensitive_diff 等）的确定性化对接点：实现时逐字段对齐，复用不另起。
- `rule-maturity.v1` 的 `shadow_hits` 离散观察的具体记录落点（是否进 run-artifact 字段 vs 纯 stdout）：实现时定，倾向纯 stdout advisory（v1.14 不落第二份 durable artifact）。

---

## Implementation Units

> 执行顺序：U1 → U2 → U3 → U6 →（U7 批 1 段 + U8 批 1 段）（批 1，过 CON-TASK-001）；批 1 验收后 U4 → U5 →（U7 批 2 段 + U8 批 2 段）（批 2，过 CON-RES-001）。U1 是两批共享前置。U7（§0.4.3 canonical 收敛）随各批 schema 落盘后立即做对应部分，不拖到最后——避免双定义漂移期过长。

### U1. `gate-lens-taxonomy.v1` 词表 + 共享前置确认

**Goal:** 落 `gate-lens-taxonomy.v1`（7 lens family 命名词表）作为后续 capability 的共享维度，并确认 v1.13 `target-repo.js` containment 模块可直接被 governance helper 复用（无需再抽取）。

**Requirements:** R6, R8

**Dependencies:** None

**Files:**
- Create: `docs/contracts/governance/gate-lens-taxonomy.schema.json`
- Create: `docs/contracts/governance/gate-lens-taxonomy.md`
- Read-for-reference: `src/cli/helpers/target-repo.js`（确认 `resolveTargetRepoRoot`/`validateOutputContainment` 可复用，v1.13 U1 已抽为库级）

**Approach:**
- taxonomy 固定枚举 7 family：`preflight`/`exploration`/`planning`/`execution`/`verification`/`review`/`summary`，每个 family 带 `description` 与映射来源说明（对应 project-scaffold G 编号语义，仅作注释不作执行）。
- schema `additionalProperties:false`，description 写明「naming taxonomy only, not a gate executor; no blocking」。
- 不写任何执行逻辑、不引入 gate 脚本调度。

**Patterns to follow:**
- `docs/contracts/verification/verification-run-summary.schema.json`（schema 范式 + 诚实边界 description）

**Test scenarios:**
- Happy path: 合法 taxonomy 文档经 schema-validator 通过。
- Edge case: 未知 lens family 名 → schema reject（`[CT-002]` 风格）。
- Test expectation: taxonomy 枚举与父方案 §4.7 七 family 完全一致（contract test 锁定）。

**Verification:**
- valid/invalid fixture 经 `schema-validator.js`；taxonomy contract test 绿。

---

### U2. `task-governance-signals.v1` 合同 + git-diff/plan-declared 信号 producer

**Goal:** 落 `task-governance-signals.v1` schema + docs，并实现 deterministic 信号 producer：plan-declared 来源（plan 声明面）+ git-diff 来源（`--numstat`），产出 `candidate_level`（plan depth 语言）+ signals + reason_codes，不裁决、不输出 score/confidence。

**Requirements:** R1, R2, R3, R4, R8, AE-CON-TASK

**Dependencies:** U1

**Files:**
- Create: `docs/contracts/governance/task-governance-signals.schema.json`
- Create: `docs/contracts/governance/task-governance-signals.md`
- Create: `src/cli/helpers/task-governance-signals.js`（producer/validator，`runCli` + stdout JSON）
- Create: `src/cli/helpers/git-diff-signals.js`（确定性 git numstat 信号采集，复用 `target-repo.js` resolveTargetRepoRoot + execFileSync 模式）
- Modify: `src/cli/commands/internal.js`（注册 `task-governance-signals` subcommand）
- Test: `tests/unit/task-governance-signals.test.js`、`tests/unit/git-diff-signals.test.js`

**Approach:**
- schema canonical 以父方案 §4.1 为准，**去除 `score`，去除 `confidence`**；`candidate_level` ∈ `lightweight|standard|deep`；signals 含 `signal_source`、`file_count`、`line_delta`、`unit_count`(plan-declared)、`cross_module`、`top_dirs`、`critical_path_hits`、`keyword_hits`；顶层含 `risk_domains`、`recommended_artifacts`、`recommended_gate_lenses`（取自 U1 taxonomy）、`reason_codes`。
- git-diff 信号：`execFileSync('git', ['-C', root, 'diff', '--numstat', base], {encoding:'utf8'})`，每行 `<added>\t<deleted>\t<file>` 解析 file_count/line_delta；base ref 解析失败 / 空 diff / 非 git → reason_code（`no-diff-base`/`empty-diff`/`not-a-repo`），不崩溃、不吞 error。
- plan-declared 信号：从传入的 plan 声明面（unit Files 清单 / unit 数 / 路径前缀 / 文本）算 unit_count/cross_module/keyword_hits；`signal_source:"plan-declared"`，`file_count` 来自声明文件清单而非 git。
- cross_module：纯 JS 路径前缀分组 `>=2` 顶层目录。keyword_hits：纯 JS 扫描，**关键词清单补中文** + 项目路径（`skills/`/`agents/`/`src/cli/contracts/`/`docs/contracts/`）；无否定语义识别的局限写进 docs（advisory，不自动判 critical）。
- candidate_level 用**透明分桶**（如 unit_count + cross_module 组合 → 建议档），分桶规则写进 docs 让 LLM 可质疑；明确是 candidate 非 final。

**Patterns to follow:**
- `src/cli/helpers/honest-closeout.js`（validator helper：runCli/parseArgs/buildOutput {schema_version, generated_at, ...}/rejected reason_code/stdout JSON）
- `src/cli/helpers/target-repo.js`（resolveTargetRepoRoot + execFileSync git 模式）

**Test scenarios:**
- Happy path（git-diff）: 多文件跨目录 diff → file_count/line_delta 正确（numstat），cross_module=true，candidate_level 给出建议 + reason_codes（AE-CON-TASK）。
- Happy path（plan-declared）: 给定 plan unit Files 清单 → unit_count/cross_module 正确，`signal_source:"plan-declared"`，无 git 依赖。
- Edge case: 空 diff / pre-code / base 解析失败 → reason_code，不崩溃。
- Edge case: 中文关键词命中 → keyword_hits 收录（验证补中文生效）。
- Error path: 非 git 目录走 git-diff 来源 → `not-a-repo` reason_code。
- 越界: producer 不输出 score/confidence 字段（schema additionalProperties:false 拒绝）。

**Verification:**
- valid/invalid fixture 经 schema-validator；numstat 解析 + 两 signal_source + reason_code 测试绿。

---

### U3. `rule-maturity.v1` 合同（shadow/advisory 预留，无升级逻辑）

**Goal:** 落 `rule-maturity.v1` schema + docs，借鉴 RuleMaturity 数据模型 + 阶段枚举，v1.14 只支持 shadow/advisory 两阶段记录，required-evidence/blocking 为预留枚举无逻辑。

**Requirements:** R7, R11, R12, R14, R8

**Dependencies:** U1

**Files:**
- Create: `docs/contracts/governance/rule-maturity.schema.json`
- Create: `docs/contracts/governance/rule-maturity.md`
- Test: `tests/unit/rule-maturity-contract.test.js`

**Approach:**
- schema：`{schema_version, rule_id, stage, shadow_hits, defect_evidence_refs[], false_positive_refs[], rollback, evidence_refs[], reason_code}`；`stage` ∈ `shadow|advisory|required-evidence|blocking`（后两者预留）。
- **无 consumer 边界（R14，显式声明）**：v1.14 不为 rule-maturity 主张 consumer gate（§9.0.1 表无 CON-RULEMATURITY）。它是 §8 Phase C 明列交付物 + v1.17 enabler 的 schema 预留，**不是空转**。docs 写明这一边界，避免被误判为「造了没人消费的 facts」。
- docs 写明：v1.14 只实现 shadow/advisory；`shadow_hits` 是「各 workflow 检查点的离散、带证据引用的观察」，**不靠常驻 daemon 自增**（R12）；required-evidence 降级 closeout / blocking / 自动 promotion 是 v1.17 的显式 non-goal。
- 不实现 promotion 状态机、不实现自动晋升函数；本切片是 contract-only（schema + 边界文案），无 helper 执行逻辑。

**Patterns to follow:**
- `docs/contracts/workflows/honest-closeout.schema.json`（schema + 诚实边界 description）

**Test scenarios:**
- Happy path: shadow/advisory record 经 schema-validator 通过。
- Edge case: blocking stage 出现但无 approver/evidence → schema 允许枚举值但 docs 标注 v1.14 不产生该值（contract test 断言 v1.14 helper 不输出 blocking/required-evidence）。
- Test expectation: 无自动 promotion 逻辑（grep 确认无 promotion/approve 函数）。

**Verification:**
- valid/invalid fixture 经 schema-validator；contract test 锁定 v1.14 只产 shadow/advisory。

---

### U6. `spec-plan` Phase 0.6 接入（兑现 CON-TASK-001）— 批 1 收尾

**Goal:** `spec-plan` plan depth 评估接入 `candidate_level`：Phase 0.6 从纯 LLM 自判，变为在 deterministic candidate（signals + reason_codes）基础上确认或显式 override 记理由。

**Requirements:** R9, AE-CON-TASK, `[CON-TASK-001]`

**Dependencies:** U2

**Files:**
- Modify: `skills/spec-plan/SKILL.md`（Phase 0.6 `:233-241` 注入 candidate_level 消费；Phase 1.4b `:386-396` 把外部 contract surface 升级与 candidate_level 升降级统一表述）
- Read-for-reference: `skills/spec-plan/references/plan-template.md`（确认 unit Files 清单结构供 plan-declared 信号对齐）
- Test: `tests/unit/spec-plan-governance-signals-contract.test.js`（断言 SKILL prose 含 candidate_level 消费 + override 记理由口径）
- 注：generated runtime（`.claude/`/`.codex/` 的 spec-plan command）由 `spec-first init` 同步，不手改

**Approach:**
- Phase 0.6 注入：「读 `task-governance-signals` 的 candidate_level 作为 plan depth 建议；LLM 可确认或显式 override 并记理由（Scripts prepare signals, LLM decides depth）」。镜像 Phase 1.4b 既有的 Lightweight→Standard reclassify 模式。
- 明确 plan time pre-code：candidate_level 来自 plan-declared 信号（声明面），不是 git diff。
- prose 措辞对齐 spec-first「candidate 不替代 LLM 判断」「override 记理由」。
- 不引入自动判级、不让脚本决定最终 depth。

**Patterns to follow:**
- `skills/spec-work/references/shipping-workflow.md`（v1.13 honest-closeout 接入 prose 范式：调用 helper → 消费结构化 verdict → 保留 LLM 判断）
- `skills/spec-plan/SKILL.md:386-396`（既有 reclassify 先例）

**Test scenarios:**
- Covers AE-CON-TASK: SKILL.md Phase 0.6 prose 含 candidate_level 消费 + override-记理由口径（contract test 断言关键短语存在）。
- Edge case: prose 明确 candidate 是建议非裁决、LLM 保留最终 depth 判断权。
- Integration: 现有 spec-plan contract tests 全绿（prose 改动不破坏既有断言）。

**Verification:**
- `tests/unit/spec-plan-*.test.js` 全绿；新 contract test 捕获 CON-TASK-001 行为变化；`spec-first init` 后 generated runtime 一致（不手改）。

---

### U4. `resource-governance-lens.v1` 合同 + lens producer — 批 2

**Goal:** 落 `resource-governance-lens.v1` schema + docs，并实现 advisory resource lens producer：从 git-diff + resource-policy 输入算 large file / generated output / raw log / staging-scope advisory facts + reason_code，不 blocking。

**Requirements:** R5, R8, R11, R14, AE-CON-RES

**Dependencies:** U1, U2（复用 git-diff-signals.js）

**Files:**
- Create: `docs/contracts/governance/resource-governance-lens.schema.json`
- Create: `docs/contracts/governance/resource-governance-lens.md`
- Create: `src/cli/helpers/resource-governance-lens.js`
- Modify: `src/cli/commands/internal.js`（注册 `resource-governance-lens` subcommand）
- Modify: `src/cli/helpers/spec-work-run-artifact.js`（**仅当**选择复用其 secret-scan：把私有 `scanUnsafeStrings`（`:1095`，当前未导出）加入 `module.exports`；否则不碰此文件，改走 `secret-deny-patterns.js` 直连——见 Approach）
- Test: `tests/unit/resource-governance-lens.test.js`

**Approach:**
- 输入：git-diff 文件清单（复用 U2 `git-diff-signals.js`）+ resource policy 默认值（大文件阈值 5MB、generated/retained 目录白名单、staging-scope 模式、**owner/module-path-hint map**）。
- 输出 advisory items：`{lens_family, dimension, severity, reason_code, evidence_ref}`。**维度命名澄清（修 FLAG 1）**：`resource` 不是 U1 gate-lens taxonomy 的 family（它是父方案 §4.8 的独立轴）。resource-lens 用自有 `dimension` 名（`large-file`/`generated-output`/`raw-log`/`staging-scope`/`owner-hint`），仅在需要归类时把 item 映射到 U1 的 `summary`/`verification` family，**不声称取自 taxonomy 的 `resource` family**。severity 只到 advisory，不 blocking。
- 检测项（覆盖父方案 §4.8 全五项）：large file added（`>maxGitFileSizeBytes`）、generated output committed（命中 generated mirror / 非 retained 白名单的生成物）、raw log 体积+redaction、**owner / module path hint（来自 resource-policy `owners`/`modules` map，对命中文件标 ownership advisory）**、staging-scope（`git add .` 风险 / `.claude/`·`.codex/`·`.agents/skills/` 入暂存）。
- secret/large 内容扫描：**优先直连 `secret-deny-patterns.js`**（独立可导出模块，最干净）；若确需 `spec-work-run-artifact` 的 `scanUnsafeStrings`，须先在该文件 `module.exports` 导出它（已列入 Files）。fail-closed，不冒充内容级深扫保证（对齐 v1.13 redaction 边界文案）。
- 复用 spec-work Tier 2 既有 diff 阈值口径（`>=400 行/>3 目录`、`>=1000 行`），不另起一套。

**Patterns to follow:**
- `src/cli/helpers/honest-closeout.js`（validator/advisory，stdout verdict + reason_code）
- `src/cli/helpers/secret-deny-patterns.js`（独立可导出 secret-scan，首选复用路径）

**Test scenarios:**
- Covers AE-CON-RES: large file added → advisory 项 + reason_code。
- Happy path: generated output committed（`.claude/` 入暂存）→ advisory + reason_code。
- Edge case: raw log 超阈值 → advisory；retained 白名单目录不误报。
- Edge case: owner/module map 命中变更文件 → ownership advisory（覆盖 §4.8 第三项）。
- Edge case: `git add .` 范围越界 → staging-scope advisory。
- 越界: 所有 severity 只到 advisory，无 blocking 字段值（schema 约束）；item 不声称 `resource` 为 gate-lens family。

**Verification:**
- valid/invalid fixture 经 schema-validator；advisory 检测项 + reason_code 测试绿。

---

### U5. `spec-work` closeout / `spec-code-review` 接入（兑现 CON-RES-001）— 批 2 收尾

**Goal:** resource-governance-lens advisory 接入 `spec-work` closeout 与 `spec-code-review`，命中时出现对应 advisory 项，与 honest-closeout 并列，reason_code 优先、不 blocking。

**Requirements:** R10, R11, AE-CON-RES, `[CON-RES-001]`

**Dependencies:** U4

**Files:**
- Modify: `skills/spec-work/references/shipping-workflow.md`（Phase 4 verification closeout 同相区域注入 resource lens advisory，与 honest-closeout 并列）
- Modify: `skills/spec-code-review/SKILL.md`（Stage 3 scale-aware preflight `:457-491` 把口算字段对接确定性 lens；Stage 6 落 advisory 结论段落）
- Test: `tests/unit/spec-work-resource-lens-contract.test.js`、`tests/unit/spec-code-review-resource-lens-contract.test.js`
- 注：generated runtime 由 `spec-first init` 同步

**Approach:**
- spec-work closeout：Phase 4 区域调用 resource-governance-lens → 命中项作 advisory facts（large file / generated output / raw log / staging-scope），与 honest-closeout claims 并列；reason_code 优先；明确不 blocking。
- spec-code-review：Stage 3 preflight 把现有 LLM 口算（changed_file_count / sensitive_diff）对接确定性 lens 来源；Stage 6 落 advisory 段落。两处共享 U1 gate-lens taxonomy 命名，避免各造口径。
- prose 措辞对齐：advisory != blocking，facts + reason_code，LLM 呈现判断。

**Patterns to follow:**
- `skills/spec-work/references/shipping-workflow.md`（v1.13 closeout 接入范式）
- `skills/spec-code-review/SKILL.md:457-491`（既有 scale preflight 口算字段）

**Test scenarios:**
- Covers AE-CON-RES: spec-work closeout prose 含 resource advisory 消费 + reason_code 口径。
- Covers AE-CON-RES: spec-code-review Stage 3/6 prose 含 lens advisory 对接。
- Edge case: prose 明确 advisory 不 blocking、不在 git add 时拦截。
- Integration: 现有 spec-work / spec-code-review contract tests 全绿。

**Verification:**
- 相关 contract tests 全绿;新 contract test 捕获 CON-RES-001 行为变化;`spec-first init` 后 runtime 一致。

---

### U7. §0.4.3 单一定义收敛（canonical 转换，修 BLOCK）

**Goal:** 四份 governance schema 落盘后，把 canonical 字段定义收敛到 schema 文件，消除父方案 §4.1/§4.7/§4.8 与新 schema 的双定义漂移（照 v1.13 `spec-work-run-artifact/v1` 既有做法）。

**Requirements:** R13

**Dependencies:** U1, U2, U3（批 1 三份 schema 落盘后即可做批 1 部分）；U4（批 2 resource-lens schema 落盘后补做）

**Files:**
- Modify: `docs/01-需求分析/13.scale集成/spec-first内化集成scale-project-scaffold技术方案.md`
  - §0.4.3 单一定义表（`:139-148`）新增 4 行：`task-governance-signals.v1` / `resource-governance-lens.v1` / `gate-lens-taxonomy.v1` / `rule-maturity.v1`，canonical 指向各自 `docs/contracts/governance/*.schema.json`
  - §4.1（`:376-393`）：`candidate_level` enum 改为 `lightweight/standard/deep`、**删除 `score`/`confidence`**、`recommended_gate_lenses` 词汇对齐 U1 taxonomy；字段结构改为「引用 schema 文件」而非内联 JSON 定义
  - §4.7 / §4.8：lens family 与 resource 维度字段定义转为对 schema 文件的引用

**Approach:**
- 严格按 §0.4.3 规则：canonical 定义只在 schema 文件，方案章节转引用、不重写字段。
- §4.1 的旧例子（`candidate_level:"L"`+`confidence:0.74`）是本次收敛要消除的过期 canonical——改写为新 enum + 删 confidence，并注明「字段 canonical 见 `docs/contracts/governance/task-governance-signals.schema.json`」。
- 这是 source-of-truth 文档变更，属父方案修订；改后三处（§0.4.3 表 / §4.1 / 新 schema）字段形状必须一致。

**Patterns to follow:**
- `docs/plans/2026-06-04-003-...:498`（v1.13 三份 schema 落盘后转 canonical、方案章节转引用的既有做法）
- 父方案 §0.4.3（`:131-148`）单一定义规则原文

**Test scenarios:**
- Test expectation: 若有方案一致性 contract test（如 scale-provider-doc-contracts 类），保持绿；§4.1 不再出现 `score`/`confidence`/`S/M/L/CRITICAL` 作为 canonical 字段。

**Verification:**
- §0.4.3 表含 4 份 governance schema；§4.1/§4.7/§4.8 无内联字段定义残留（grep 确认 `confidence`/`score` 不再作为 task-signals canonical）；schema 文件与方案引用一致。

---

### U8. docs / CHANGELOG / 版本路线 reconcile（两段式）

**Goal:** 同步 README 进展、reconcile `docs/00-版本路线` 的 v1.14/v1.15/v1.17 命名口径漂移、按格式分两批追加 CHANGELOG。

**Requirements:** Completion Criteria docs 项

**Dependencies:** 批 1：U6 完成后做第一段；批 2：U5 完成后做第二段（**两段式，各批独立提交**）

**Files:**
- Modify: `docs/01-需求分析/13.scale集成/README.md`（v1.14 进展：批 1 完成后→`进行中`，批 2 完成后→`已完成`）
- Modify: `docs/00-版本路线/2026-06-03-scale-engine-fusion-version-split.md`（`:34/37` v1.14 = Governance Lens Foundation、v1.15 = Knowledge Harness、v1.17 = Governance Maturity，对齐父方案 §8.1 + CHANGELOG:22 的拆分意图；顺手标注 §8 Phase C 验收里 `required-evidence` 降级属 v1.17 部分）
- Modify: `CHANGELOG.md`（**每批一条**，作者 `leokuang`，`(user-visible)`）
- Modify（可选）: `README.md` / `README.zh-CN.md`（若 governance lens 对最终用户面有可见说明）

**Approach:**
- **两段式（修 FLAG 5）**：批 1 收尾时 README→`进行中` + 写批 1 CHANGELOG（task-signals + spec-plan）；批 2 收尾时 README→`已完成` + 写批 2 CHANGELOG（resource-lens + work/review）。批 1 即使单独停下，CHANGELOG 也不漏（CLAUDE.md「任何 source 变更必须更新 CHANGELOG」）。
- README 进展严格按真实 source/测试状态更新，不用方案定稿冒充实现进展。
- 版本路线 reconcile 只改 v1.14/v1.15/v1.17 命名与 RuleMaturity 拆分口径，不重写整篇叙述（重写留 follow-up）。

**Test scenarios:**
- Test expectation: none（docs-only）；但若有 README 进展/版本线 contract test，保持绿。

**Verification:**
- 文档 lint / 相关 doc contract test 绿；进展与真实 source 一致；两批各有 CHANGELOG 条目。

---

## Requirements → Units 覆盖矩阵

| Requirement | Units |
| --- | --- |
| R1 task-governance-signals.v1 合同 | U2 |
| R2 candidate_level = plan depth 语言 | U2, U6 |
| R3 plan-declared / git-diff 双信号源 | U2 |
| R4 deterministic numstat + 纯 JS + 中文关键词 | U2 |
| R5 resource-governance-lens.v1 | U4 |
| R6 gate-lens-taxonomy（词表非执行器） | U1 |
| R7 rule-maturity.v1（shadow/advisory 预留） | U3 |
| R8 复用 v1.13 范式（schema-validator/containment/internal 派发） | U1, U2, U3, U4 |
| R9 spec-plan Phase 0.6 接入（CON-TASK-001） | U6 |
| R10 spec-work/code-review 接入（CON-RES-001） | U5 |
| R11 不引入 blocking | U3, U4, U5 |
| R12 无 daemon / 离散观察 | U2, U3 |
| R13 §0.4.3 canonical 收敛 | U7 |
| R14 rule-maturity 无 consumer 边界声明 | U3, U4 |
| AE-CON-TASK | U2, U6 |
| AE-CON-RES | U4, U5 |

> 文档/收尾单元：U8（README 进展 + 版本路线 reconcile + 两段式 CHANGELOG）覆盖 Completion Criteria docs 项，不绑定单条 R。

---

## Test Plan

**Contract Tests（schema 正确性，父方案 §9.1）：**
- `[CT-001]` 四份新 schema valid/invalid fixture 经 `schema-validator.js`。
- `[CT-002]` unknown enum（lens family / stage / candidate_level）rejected。
- `[CT-003]` 缺 reason_code 的 not-applicable 信号 rejected。
- `[CT-006]` generated runtime path 不进 evidence refs（复用 target-repo 校验）。
- `[CT-007]` 所有新 schema 经唯一 `schema-validator.js`，无第二套校验。

**Governance Signal Tests：**
- numstat 解析正确（对比 SCALE 缺陷正则）；空 diff / pre-code / base 失败 reason_code。
- 两 signal_source 区分正确；中文关键词命中；无 score/confidence 输出。
- candidate_level 透明分桶可复现。

**父方案 §9.5 Governance Lens Tests 锚点 reconcile（修 FLAG 6）：**
- `[GL-001]`：原文「S/M/L/CRITICAL signals 只作为 candidate」→ 本切片改写为「`candidate_level`（lightweight/standard/deep）是 candidate 非 final，LLM 保留终判」（等级词汇变更已在 R2/U7 收敛）。
- `[GL-002]`（gate dry-run schedulable）：v1.14 **N/A**——gate-lens 是 taxonomy 词表非执行器，无 dry-run 行为。显式标注 N/A，避免 verifier 对不上锚点。
- `[GL-003]`：v1.14 只到 shadow/advisory；required-evidence/blocking 锚点留 v1.17。

**Resource Lens Tests：**
- large file / generated output / raw log / owner-hint / staging-scope 各检测项 + reason_code；retained 白名单不误报；severity 只到 advisory；item 不声称 `resource` 为 gate-lens family。

**Consumer Gate Tests（父方案 §9.0.1，行为变化）：**
- `[CON-TASK-001]`：spec-plan Phase 0.6 prose 消费 candidate_level + override 记理由（contract test 捕获行为变化）。
- `[CON-RES-001]`：spec-work closeout / spec-code-review 出现 resource advisory 项。

**Regression（父方案 §9.0）：**
- REG-SUITE-001：`npm test`（unit+smoke+integration）每批后全绿。
- 现有 spec-plan / spec-work / spec-code-review contract tests 不被 prose 改动破坏。

**Maturity Boundary Test：**
- v1.14 helper 不输出 `blocking` / `required-evidence` stage；无自动 promotion 逻辑（grep + contract 断言）。

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```text
批 1（CON-TASK-001）:
  spec-plan Phase 0.6 "Assess Plan Depth"（LLM）
    │ 调用 task-governance-signals（plan-declared 来源）
    ▼
  task-governance-signals.js  ──uses──► git-diff-signals.js（work/review 阶段才有 diff）
    产出: {candidate_level: lightweight|standard|deep,
           signals{signal_source, unit_count, cross_module, keyword_hits, ...},
           recommended_gate_lenses[]（取自 gate-lens-taxonomy）,
           reason_codes[]}  ── 无 score / 无 confidence
    │
    ▼
  LLM 确认 depth 或显式 override 记理由（Scripts prepare signals, LLM decides）

批 2（CON-RES-001）:
  spec-work closeout Phase 4 / spec-code-review Stage 3
    │ 调用 resource-governance-lens（git-diff + resource-policy）
    ▼
  resource-governance-lens.js
    产出: advisory items[{lens, severity:advisory, reason_code, evidence_ref}]
           （large file / generated output / raw log / staging-scope）
    │ 与 honest-closeout 并列，reason_code 优先，不 blocking
    ▼
  closeout / review 出现对应 advisory 项

贯穿: gate-lens-taxonomy.v1（7 family 命名词表，非执行器）
      rule-maturity.v1（shadow/advisory 记录，blocking 预留无逻辑 → v1.17）
```

---

## 边界与反模式自检（落地前确认）

- ✅ 脚本只产信号 / advisory facts + reason_code，不裁决 depth、不输出 score/confidence、不 blocking。
- ✅ gate-lens 是 taxonomy 词表，不是 23 gate 执行器，不复制 blocking 聚合器 / inline hook。
- ✅ RuleMaturity 只到 advisory，无自动晋升、无 daemon。
- ✅ schema 落 `docs/contracts/governance/**` 单一 source，复用唯一 schema-validator，不建第二套。
- ✅ 不手改 generated runtime（`.claude/`/`.codex/`/`.agents/skills/`）；prose 改 source skill，runtime 走 `spec-first init`。
- ✅ 完整设计、分两批执行；批 1 过 CON-TASK-001 后再启动批 2。
