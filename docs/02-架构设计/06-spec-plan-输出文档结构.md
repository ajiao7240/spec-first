# spec-plan 输出的 plan 技术方案文档 · 目录结构说明

> 本文说明 `spec-plan` skill 生成的 plan 技术方案文档包含哪些章节、各章节承载什么、以及"接口/架构/模块/数据库"这类技术设计在 plan 里的落点。
>
> **真相源**:本文是对以下源文件的导读，不是新的契约。结构以源文件为准，冲突时改本文：
> - `skills/spec-plan/references/plan-template.md` —— 权威 Markdown 骨架
> - `skills/spec-plan/references/plan-sections.md` —— 内容契约（哪些章节earn their place、哪些 metadata 稳定）
> - `skills/spec-plan/references/deepening-workflow.md` —— 各章节的深化判据
>
> **状态提示**：文末"端覆盖（Surface Coverage）"一节是 `docs/plans/2026-06-12-005-refactor-spec-plan-surface-coverage-lens-plan.md` 的**目标态**，该 plan 仍 DEFERRED、Gate 未开，当前 `spec-plan` 输出中**尚不包含**该子块。本文标注 ★(005·目标态) 以区分。

---

## 1. 核心前提：plan 不是固定全量模板

`spec-plan` 生成的 plan **不是**一个每次都填满的固定模板，而是 **"必备地板（Hard Floor）+ 按需可选（Include When Material）"** 的结构。一份真实 plan 的章节数量随 `plan_depth`（Lightweight / Standard / Deep）和实际内容裁剪。

两条由此而来的判断：

- **必备地板 7 项始终在场**：缺任何一项，plan 不完整。
- **可选章节"earn their place"**：只有当它承载真实信息时才出现；空section是padding，应省略。

另一条核心哲学（来自 `plan-template.md` 的 High-Level Technical Design 自我约束）：

> plan 是 **决策制品（decision artifact）**，不是 **实现规格（implementation spec）**。

plan 记录"为什么这样设计、边界在哪、有哪些待决"；它**不**记录接口的确切签名、表的确切 DDL、类的确切结构——后者留给 `spec-work` 执行阶段，避免过早写死、实现时返工。

---

## 2. 完整目录结构（目标态）

图例：`【必备·地板】` 始终在场 · `【可选】` 按需 · `【可选·Deep】` 仅 Deep plan · `★` 技术设计落点 · `★(005·目标态)` 端覆盖 lens 落地后才有。

```
# [Plan 标题]
│   frontmatter: title / type / status / date / spec_id / origin?
│
├── ## Summary 摘要                                        【必备·地板】
│       1-3 行：这份 plan 提议做什么、怎么做
│
├── ## Decision Brief 决策速览                             【可选·Standard/Deep】
│       推荐方案 / 关键决策 / 验证重点 / 最大风险，供人快速首读
│
├── ## Problem Frame 问题框定                              【必备·地板】
│       为什么做、改变什么现状，引用 origin 需求文档
│
├── ## Requirements 需求                                   【必备·地板】
│   │   R1, R2, … 稳定 R-ID + 可验证成功判据
│   └─ Origin actors / flows / acceptance examples（有 origin 才带）
│
├── ## Assumptions 假设                                    【可选】
├── ## Scope Boundaries 范围边界                           【可选】
│   └─ ### Deferred to Follow-Up Work 延后到后续工作
│
├── ## Completion Criteria 完成判据                        【可选】
│
├── ## Direct Evidence Readiness 直接证据就绪度            【必备·地板】
│       target_repo / 证据源 / source_refs / 信心 / 局限
├── ## Direct Evidence 直接证据                            【必备·地板】
│       实际读了什么、关键发现、对 plan 的影响
│
├── ## Context & Research 背景与调研                       【可选】
│   ├─ ### Relevant Code and Patterns 相关代码与模式
│   ├─ ### Institutional Learnings institutional 经验（docs/solutions）
│   └─ ### External References 外部参考
│
├── ## Key Technical Decisions 关键技术决策                【必备·地板】 ★ 接口/架构决策
│       每条决策 + 理由 + 被否方案
│
├── ## Open Questions 待决问题                             【可选】
│   ├─ ### Resolved During Planning 规划期已解决
│   └─ ### Deferred to Implementation 留待实施
│
├── ## Output Structure 产出目录结构                       【可选】 ★ 模块/目录设计
│       greenfield 的目录树 / 包结构
│
├── ## High-Level Technical Design 高层技术设计            【可选】 ★ 架构图/数据流/schema 草图
│       图 / 伪代码 / 数据流草图 ——「方向性指引，非实现规格」
│
├── ## Implementation Units 实施单元                       【必备·地板】 ★ 模块设计
│   └─ ### U1. [名称]
│         Goal / Requirements / Dependencies
│         Files（Create/Modify/Test）/ Approach / Patterns to follow
│         Technical design（可选·单元级伪代码）/ Test scenarios / Verification
│
├── ## System-Wide Impact 系统级影响                       【可选】 ★ 接口/数据/状态影响面
│       Interaction graph / Error propagation
│       State lifecycle risks（数据生命周期）/ API surface parity（接口对等）
│       Integration coverage / Unchanged invariants
│       │
│       └─ Surface Coverage 端覆盖                         ★(005·目标态)·条件触发
│             仅当 plan 触及 >1 个端时出现；默认作为 System-Wide Impact 的增量：
│             逐端标记 in-scope / out-of-scope:<原因> / deferred
│             例：App✓ / H5 out-of-scope:本期不做分享 / Admin✓ / 埋点 deferred
│             单端或轻量 plan → 干净省略，不出现
│
├── ## Risks & Dependencies 风险与依赖                     【可选】
├── ## Documentation / Operational Notes 文档/运维注记     【可选】
│
└── ## Sources & References 来源与引用                     【必备·地板】

──────── Deep plan 才扩展的可选尾部 ────────
   ## Alternative Approaches Considered 备选方案
   ## Success Metrics 成功指标
   ## Dependencies / Prerequisites 依赖/前置
   ## Risk Analysis & Mitigation 风险分析与缓解（带 likelihood/impact）
   ## Phased Delivery 分阶段交付（Phase 1 / Phase 2）
   ## Documentation Plan 文档计划
   ## Operational / Rollout Notes 运维/上线注记
```

---

## 3. 必备地板（Hard Floor）

一份 warranted 的 plan 文档至少包含这 7 项（出自 `plan-sections.md` Hard Floor）：

| 章节 | 作用 |
|------|------|
| Summary | 1-3 行说明 plan 提议什么 |
| Problem Frame | 为什么做、改变什么现状 |
| Requirements | 稳定 R-ID + 可被下游 review 校验的成功判据 |
| Key Technical Decisions | 约束实现的决策 + 理由 |
| Implementation Units | 稳定 U-ID、goal、files、test scenarios、verification、依赖、关联需求 |
| Direct Evidence Readiness / Direct Evidence | 实际读了/验证了什么 + 局限 |
| Sources & References | 有用的线索面包屑，不是流程废料 |

---

## 4. "接口 / 架构 / 模块 / 数据库"设计在 plan 里的落点

plan **承载**这四类技术设计，但形态是 **语义化的设计意图**，而非 **形式化的设计制品**（无固定的"## 接口设计""## 数据模型"硬性章节）。

| 传统技术设计维度 | plan 里的承载章节 | 形态 |
|------------------|-------------------|------|
| **接口设计（API）** | `Key Technical Decisions`（决策+理由）+ `System-Wide Impact` 的 *API surface parity* + 各 `U` 的 Approach/Files | 决策与影响面，**不是** OpenAPI/IDL |
| **系统架构** | `High-Level Technical Design`（图/伪代码/数据流）+ `Key Technical Decisions` + `Output Structure` | 方向性草图，**显式声明"指引而非实现规格"** |
| **模块设计** | `Implementation Units`（按单元切，每个带 Goal/Files/Approach/Patterns）+ `Output Structure` | 按"实施单元"切分，**不是** UML class 图 |
| **数据库设计** | `System-Wide Impact` 的 *state lifecycle risks* + `High-Level Technical Design`（schema/data-flow 草图） | 影响与风险层面；**无专门 DDL/ER 章节** |

### 为什么是"语义意图"而非"形式化制品"

`High-Level Technical Design` 模板自带约束：

> *"This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce."*

`deepening-workflow.md` 进一步规定：允许伪代码与 DSL 文法草图，**禁止**实现代码（imports、精确方法签名、框架特定语法）。

这与 spec-first 的核心哲学 **Scripts prepare, LLM decides** 一致：plan 锁定"决策与边界"，把"接口签名/DDL/类结构"等易变细节留给执行期，避免过早写死。

### 一个真实的覆盖边界（诚实标注）

若以**重后端/重数据**的业务系统 RFC 标准衡量，spec-plan 模板**没有**强制的：

- 接口契约章节（请求/响应/错误码）
- 数据模型章节（表/字段/索引/迁移）
- 时序图/部署架构图

它把这些折叠进了 `High-Level Technical Design`（可选）+ `Key Technical Decisions` + `System-Wide Impact`。对"轻量、决策为先、执行期定细节"的哲学这是自洽的；但若团队需要 **契约先行**（多端并行开发、plan 阶段就锁 API/schema），这是一个可独立评估的增强方向（与 005 的"横向端覆盖"互补，属"纵向技术深度"）。

---

## 5. 与 005 端覆盖 lens 的关系

- **005 的 lens = 横向覆盖**：多端工作别漏掉某个**端**（App/H5/Admin/埋点）。落点为 `System-Wide Impact` 下的条件触发子块（默认 enrich，非新顶级 section）。
- **本文 §4 末尾提到的 = 纵向深度**：每个端的**接口/架构/数据**设计是否充分。

二者是同一族问题的两个方向。lens 落地**不改变** §4 四类技术设计的承载结构，只补横向端覆盖。Gate 未开前，§2 中标 `★(005·目标态)` 的子块不在当前输出中。

---

## 6. 典型 plan 的章节激活示例

不同 depth 的 plan 激活不同章节子集（必备地板始终在）：

- **Lightweight plan**：Summary + Problem Frame + Requirements + Direct Evidence + Key Technical Decisions + Implementation Units + Sources。（Decision Brief、System-Wide Impact 等常省略）
- **Standard 多端业务功能 plan**：在上基础上激活 Decision Brief + System-Wide Impact（lens 落地后含 Surface Coverage 子块）+ Risks & Dependencies + Open Questions。
- **Deep plan**：再扩展 Alternative Approaches Considered / Success Metrics / Phased Delivery / Risk Analysis & Mitigation 等尾部章节。

---

## 来源与引用

- `skills/spec-plan/references/plan-template.md` —— 权威骨架与可选 Deep 扩展
- `skills/spec-plan/references/plan-sections.md` —— 内容契约（Hard Floor / Include When Material / Metadata）
- `skills/spec-plan/references/deepening-workflow.md` —— 章节深化判据
- `docs/plans/2026-06-12-005-refactor-spec-plan-surface-coverage-lens-plan.md` —— 端覆盖 lens（DEFERRED·目标态）
- `tests/unit/spec-plan-contracts.test.js` —— plan 结构契约测试
