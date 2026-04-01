---
title: "feat: Strengthen spec-bootstrap prompt contracts and documentation"
type: feat
status: active
date: 2026-04-01
origin: docs/brainstorms/2026-04-01-spec-bootstrap-improvements-requirements.md
---

# feat: Strengthen spec-bootstrap prompt contracts and documentation

## Overview

对 `spec-bootstrap` 的 6 个改进点进行文档和提示词补强：Worker Dispatch Contract 形式化、PRD 自检主动化、PRD 质量门引入、数据库过滤参考 SQL 补充、PRD 模板 few-shot 示例、隐式设计模式显式化为架构文档。所有变更均为文档补强，不修改 Phase 1 分析逻辑和 Phase 3 失败恢复逻辑。

## Problem Frame

`spec-bootstrap` 已可执行，核心设计成立。但 6 个契约细节的缺位会降低跨 session 执行一致性，并限制设计模式向其他 workflow 复用：worker 被 dispatch 时接收到的最小信息集未明文规定、PRD 验收标准使用被动语气、Phase 2→3 缺少质量门、数据库过滤策略仅有文字描述无参考 SQL、PRD 模板全为占位符缺少 few-shot、设计模式散落在单个 skill 文档中无法跨 workflow 引用。(see origin: docs/brainstorms/2026-04-01-spec-bootstrap-improvements-requirements.md)

## Requirements Trace

- R1 (P1). 在 `SKILL.md` §3.2 增加平台无关 Worker Dispatch Contract，明确最小信息集（task id、PRD 路径、文件所有权边界、执行护栏、完成回报格式）
- R2 (P1). 在 `references/prd-template.md` Acceptance Criteria 之后增加 Self-Check 节，使用主动语气，覆盖全部 6 项检查；检查失败须先修复再报告
- R3 (P2). 在 `SKILL.md` Phase 2 末尾增加轻量 PRD Quality Gate（§2.5），阻止上下文不足的 PRD 进入 Phase 3；失败时补充 Context 后重跑，不引入人工审批
- R4 (P2). 在 `references/database-prd-template.md` §2.2 补充"Reference SQL — optional"，覆盖后缀/前缀/日期/stale 四类过滤场景，注明 MySQL 版本元数据差异
- R5 (P2). 在 `references/prd-template.md` 末尾增加精简填充示例（来自真实 spec-bootstrap 执行记录，可脱敏但须保留具体性）
- R6 (P2). 新建 `docs/02-架构设计/03-agent-workflow-patterns.md`，提取 5 个隐式设计模式为显式规范

## Scope Boundaries

- 不修改 Phase 1 分析逻辑（Full/Enhanced/Basic 检测流程）
- 不修改 Phase 3 失败恢复逻辑（backup/restore 策略）本身；R6 可完整文档化该策略的现有行为，无需限制描述深度，但不修改实际逻辑实现
- R6 仅提取现有 spec-bootstrap 已实现的模式，不新增功能
- 不修改 spec-bootstrap 命令入口 `.claude/commands/spec/bootstrap.md`
- 不修改 Phase 3 parallel dispatch 机制本身，只补强 §3.2 的契约描述

## Context & Research

### Relevant Code and Patterns

- `skills/spec-bootstrap/SKILL.md` — 主 skill 文件，416 行。§3.2 Worker Dispatch 当前只有 3 行文字描述，无结构化契约；§2.4 PRD Content 为最后一个 Phase 2 子节（line ~273）
- `skills/spec-bootstrap/references/prd-template.md` — 126 行。Acceptance Criteria 在 lines 103-111（6 项 checkbox）；无 Self-Check 节；无 filled example
- `skills/spec-bootstrap/references/database-prd-template.md` — 379 行。§2.2 Apply Backup/Stale Table Filters 在 lines 146-165，仅有文字描述规则，无 SQL 查询示例
- `docs/02-架构设计/` — 已有 `01-整体架构.md` 和 `02-目录结构.md`；编号 `03` 可用

### Institutional Learnings

- **spec-bootstrap 深度审查** (docs/solutions/logic-errors/spec-bootstrap-deep-review.md)：P1-1 确认 §3.2 缺少最小契约字段；P1-2 确认 Acceptance Criteria 是被动 checklist 而非主动触发语言；P2-1/P2-2/P2-3/P2-4 提供了各项改进的建议文案和边界说明

### External References

- 无需外部研究——改动均为提示词工程文档补强，本仓库已有足够的局部模式可遵循

## Key Technical Decisions

- **平台无关 Dispatch Contract**：R1 描述最小信息集为纯文本字段，不写死 `Agent(...)` API 调用形式——spec-bootstrap 同时支持 Claude 和 Codex 入口，写死宿主 API 会破坏跨平台能力
- **PRD Quality Gate 重试上限为 2 次**：失败时补充 Context 并重新检查，最多 2 轮。第 3 次仍未通过则在 PRD 头部追加 `> ⚠️ PRD_QUALITY_WARN: Context 仍不足` 警告行，并继续 Phase 3——不阻断整个任务，但让警告可被 worker 和人工审查发现。上限设为 2 次是保守起点，可根据后续实测失败率调整
- **Reference SQL 定位为"可选参考"而非规范**：数据库 worker 可按能力选用，不替代现有文字描述。注明 MySQL 5.7 vs 8.x `information_schema.tables.update_time` 可用性差异
- **Filled example 数据来源**：使用已有 spec-bootstrap 运行记录（spec-first 自身项目）。脱敏规则：保留真实路径格式和类名格式，替换具体项目特有业务名词为 `<project>` 占位符
- **R6 无 Failure Recovery 提取限制**：需求文档 §Scope Boundaries 明确指出"R6 对该模式的文档化提取不受此限制"，可完整描述 backup/restore 策略

## Open Questions

### Resolved During Planning

- **R3 重试上限**：设为 2 次。超限后追加 `PRD_QUALITY_WARN` 行继续执行，不引入阻断式人工审批
- **R6 目录编号**：`docs/02-架构设计/` 已有 01、02 两个文件，`03-agent-workflow-patterns.md` 无冲突
- **R5 数据来源**：使用 spec-first 自身项目首次 spec-bootstrap 运行产出的 PRD 记录（`summary-context` 任务），脱敏后作为示例

### Deferred to Implementation

- 各 Unit 内具体的 Markdown 措辞——这些是提示词质量判断，应在实现时按规范对标决定，不适合在计划阶段预写
- Filled example 的最终内容长度——取决于找到的历史 PRD 记录详细程度；计划无法预先规定

## Implementation Units

- [ ] **Unit 1: 形式化 Worker Dispatch Contract（R1）**

**Goal:** 在 `SKILL.md` §3.2 中将现有 3 行描述替换为结构化 Worker Dispatch Contract，明确编排器向 worker 传递的最小信息集和完成报告格式。

**Requirements:** R1

**Dependencies:** 无

**Files:**
- Modify: `skills/spec-bootstrap/SKILL.md`（§3.2 Worker Dispatch 节，lines ~294-301）

**Approach:**
- 保留现有内容的语义，改为结构化列表形式
- Dispatch Contract 最小信息集：① task id、② PRD 的绝对路径或 repo 相对路径、③ 文件所有权边界（"只写 Files to Fill"）、④ 执行护栏（"不改源码、不跑 git 命令"）、⑤ 完成回报格式（produced files 列表 + 任何 missing evidence 说明）
- 并行条件：无共享文件的 worker 可并行
- 超时标准：超过 20 分钟视为失败，触发 §3.4 partial failure policy
- 格式：增加 `### 3.2 Worker Dispatch Contract` 标题，用代码块风格列出 Contract 字段

**Test scenarios:**
- 核查 Contract 节包含全部 5 个字段（task id / PRD path / ownership boundary / execution guardrails / completion contract）
- 核查超时处理和并行条件在同一节中有明确描述
- 核查无任何宿主平台 API（`Agent(...)` / `spawn()`）硬编码

**Verification:** 在 §3.2 中可见结构化 Contract 节，涵盖 5 字段 + 并行条件 + 20 分钟超时规则；全文无宿主 API 硬编码

---

- [ ] **Unit 2: 为 prd-template.md 添加 Self-Check 节（R2）**

**Goal:** 在 Acceptance Criteria 之后插入 Self-Check 节，使用主动语气将现有 6 条验收标准转换为执行前强制自检动作。

**Requirements:** R2

**Dependencies:** 无（与 Unit 5 同文件，应先于 Unit 5 完成）

**Files:**
- Modify: `skills/spec-bootstrap/references/prd-template.md`（Acceptance Criteria 节之后，line ~111）

**Approach:**
- 不重写现有 Acceptance Criteria，只在其后新增一节
- 标题：`### Self-Check`
- 引导语：`Before reporting completion, verify:`
- 6 项检查（与 Acceptance Criteria 一一对应，但措辞为主动指令）：
  1. every owned file is present and non-empty
  2. no placeholder text remains
  3. each file references at least 2 concrete project artifacts (file paths, class names, config keys)
  4. all files use structured Markdown (at least one `#` heading and two `##` sections)
  5. no source code file was modified
  6. `index.md` (if produced) only links to files that actually exist
- 结尾强制语："If any check fails, fix it before reporting completion."

**Test scenarios:**
- 核查节标题使用主动语气触发词（"Before reporting completion, verify:"）
- 核查所有 6 项对应 Acceptance Criteria 的每一条（含 structured Markdown 项）
- 核查强制修复语句存在（"fix it before reporting completion"）
- 核查未重复发明新规则（与 Acceptance Criteria 内容保持一一映射）

**Verification:** prd-template.md 中 Acceptance Criteria 之后出现 Self-Check 节，包含主动引导语 + 6 项 + 修复要求

---

- [ ] **Unit 3: 在 SKILL.md Phase 2 末尾插入 PRD Quality Gate（R3）**

**Goal:** 在 Phase 2 和 Phase 3 之间插入 §2.5 PRD Quality Gate，对每个 PRD 执行 4 项轻量检查，不足时补充 Context 后重试（最多 2 次），超限后追加警告行继续执行。

**Requirements:** R3

**Dependencies:** Unit 1（同文件，避免并行冲突；Unit 1 完成后再进行此 Unit）

**Files:**
- Modify: `skills/spec-bootstrap/SKILL.md`（在 Phase 2 末尾插入；以内容锚点定位：§2.4 末尾 `---` 分隔线前，即 `## Phase 3` 标题之前——不依赖行号，Unit 1 编辑同文件后行号会位移）

**Approach:**
- 插入位置：§2.4 PRD Content 节末尾 `---` 分隔线之前、`## Phase 3` 标题之前（以章节标题为锚点，不用行号）
- 标题：`### 2.5 PRD Quality Gate`
- 4 项检查：
  1. Goal 具体且针对本任务（不是通用描述）
  2. Context 包含来自 Phase 1 的具体项目证据（真实路径/类名/配置值，而非"分析了整个项目"）
  3. Files to Fill 是精确路径而非抽象分类（如 `docs/contexts/<slug>/architecture/system-overview.md`，格式示意，非规定路径；而非 "architecture docs"）
  4. Technical Notes 包含至少 1 条项目特有约束（不是通用格式提示）
- 失败处理：补充对应 Context 后重跑检查；最多 2 轮失败后在 PRD 头部追加 `> ⚠️ PRD_QUALITY_WARN: Context 仍不足，请人工核查` 并继续 Phase 3
- 明确不引入人工审批环节（警告行仅供后续审查，不阻断执行）
- 职责说明：Quality Gate 检查编排器生成的 PRD 内容质量（4 项，dispatch 前）；Self-Check（Unit 2）检查 worker 的输出完整性（6 项，完成前）；两者职责不重叠，可独立执行

**Test scenarios:**
- 核查 4 项检查覆盖 Goal / Context 证据 / Files 精确度 / Technical Notes 项目特有性
- 核查重试上限 = 2 次（第 3 次失败即追加警告）
- 核查警告行格式与检查项一致
- 核查不含"等待人工审批"或阻断性语言

**Verification:** SKILL.md §2.5 存在 PRD Quality Gate 节，包含 4 项检查 + 最多 2 次重试 + PRD_QUALITY_WARN 降级机制；不含人工审批阻断

---

- [ ] **Unit 4: 为 database-prd-template.md §2.2 补充 Reference SQL（R4）**

**Goal:** 在 §2.2 Apply Backup/Stale Table Filters 的现有文字描述之后，追加一个"Reference SQL — optional"代码块，覆盖 4 类过滤场景；注明 MySQL 5.7/8.x 元数据字段差异。

**Requirements:** R4

**Dependencies:** 无（独立文件）

**Files:**
- Modify: `skills/spec-bootstrap/references/database-prd-template.md`（§2.2，以节标题为锚点：`## 2.3` / `### 2.3` Schema Analysis 标题之前）

**Approach:**
- 追加位置：§2.2 末尾文字描述之后、`§2.3 Schema Analysis for Remaining Tables` 标题之前（以章节标题为锚点，不依赖行内文本）
- 标题：`#### Reference SQL — optional`
- 说明前缀：`The queries below are reference implementations. Use if available tools support them. Do not replace the heuristic descriptions above with SQL only.`
- SQL 1：后缀/前缀模式过滤（`INFORMATION_SCHEMA.TABLES` WHERE + REGEXP）
- SQL 2：日期模式过滤（REGEXP 匹配 `_20YYMMDD`, `_YYYY_MM`, `_YYYYMM`）
- SQL 3：stale heuristic（`INFORMATION_SCHEMA.TABLES.UPDATE_TIME < NOW() - INTERVAL 180 DAY` — 180 DAY 为示意值，注释中说明应按项目备份保留策略调整）
- MySQL 版本注：`update_time` 在 MySQL 8.0+ 对 InnoDB 表基本可靠；MySQL 5.7 可能为 NULL，此时 stale heuristic 仅依据 FK 引用判断
- FK 检查 SQL：查询 `INFORMATION_SCHEMA.KEY_COLUMN_USAGE` 确认无 FK 引用

**Test scenarios:**
- 核查 SQL 覆盖后缀/前缀/日期/stale 四类（与文字描述规则完全对应）
- 核查 MySQL 5.7/8.0 差异注释存在
- 核查"Reference SQL — optional"标题和说明前缀明确其非规范性
- 核查原有文字描述未被删除（SQL 仅追加）

**Verification:** §2.2 末尾出现 Reference SQL 节，SQL 覆盖 4 类场景 + 版本注，原文字描述完整保留

---

- [ ] **Unit 5: 为 prd-template.md 添加 Filled Example（R5）**

**Goal:** 在 prd-template.md 末尾追加一个精简填充示例，示范 Goal、Context、Tools Available、Files to Fill、Technical Notes 五个字段应填充到何种具体程度；数据来自真实 spec-bootstrap 执行记录。

**Requirements:** R5

**Dependencies:** Unit 2（同文件，Unit 2 完成后再进行此 Unit）

**Files:**
- Modify: `skills/spec-bootstrap/references/prd-template.md`（末尾追加）

**Approach:**
- 标题：`---\n## Example — Filled PRD`
- 说明行：`> Desensitized from a real spec-bootstrap run. Names are anonymized but path formats and class name patterns are real.`
- 示例来源：spec-first 自身项目的 `summary-context` 任务 PRD（或 `architecture-context`，取决于哪个有更典型的 Context 字段示例）
- 只覆盖以上 5 个字段（Goal / Context / Tools Available / Files to Fill / Technical Notes）；prd-template.md 中的 Important Rules 和 Acceptance Criteria 节无需示例，因其内容是固定规则，不因项目而变化
- 脱敏规则：真实路径格式保留（如 `src/cli/commands/init.js` 格式），具体项目名称替换为 `<project>`；类名格式保留（如 `McpSetupCommand`），具体业务名词脱敏为 `<ServiceName>`
- Context 示例须展示"来自 Phase 1 的具体证据"：至少 1 个真实路径引用、1 个真实配置值或类名

**Test scenarios:**
- 核查 5 个字段均有示例内容（Goal / Context / Tools Available / Files to Fill / Technical Notes）
- 核查 Context 示例包含至少 1 个具体路径格式和 1 个具体类名格式（非通用描述）
- 核查示例说明行注明数据来源和脱敏规则
- 核查示例不包含 Important Rules / Acceptance Criteria 字段（这些是模板固定内容，无需示范）

**Verification:** prd-template.md 末尾出现 Filled PRD 示例，包含 5 字段 + 脱敏说明，Context 字段有具体项目证据

---

- [ ] **Unit 6: 创建 agent-workflow-patterns.md 架构文档（R6）**

**Goal:** 新建 `docs/02-架构设计/03-agent-workflow-patterns.md`，将 spec-bootstrap 中的 5 个隐式设计模式提取为显式规范，供其他 workflow 引用。

**Requirements:** R6

**Dependencies:** 无（独立新文件）

**Files:**
- Create: `docs/02-架构设计/03-agent-workflow-patterns.md`

**Approach:**
- 文档结构：标题 + 概述段 + 5 个模式各一节（H2），每个模式包含：定义、动机、应用场景、spec-bootstrap 中的实现示例
- 5 个模式：

  **1. PRD Task Contract**
  - 定义：主控生成任务合同（PRD），worker 只消费合同，不接受口头指令
  - 动机：合同是唯一事实来源，消除编排器和 worker 之间的歧义；worker 不需要了解编排上下文
  - 实现：`.context/spec-first/bootstrap/<slug>/tasks/<task-id>/prd.md`
  - SKILL.md 位置：`§2 PRD Generation`（Phase 2 整体）和 `§3.2 Worker Dispatch Contract`

  **2. File Ownership Boundary**
  - 定义：用输出文件边界替代口头职责边界；每个 worker 声明且独占其输出文件列表
  - 动机：防止多个 worker 写入同一文件导致冲突；边界违规可机械检测
  - 实现：§3.1 File Ownership Rules 表格
  - SKILL.md 位置：`§3.1 File Ownership Rules`

  **3. Conditional Generation**
  - 定义：检测驱动输出，先验证存在性，再生成；不生成空模板
  - 动机：避免生成无内容的占位文件；确保每个生成的文件都有实质内容
  - 实现：Phase 1 层检测 → Phase 2 条件任务创建（只在检测到对应层时创建对应 PRD）
  - SKILL.md 位置：`§1 Analysis Phase`（检测逻辑）和 `§2.1–§2.4`（条件 PRD 生成）

  **4. Multi-Level Degradation**
  - 定义：工具能力不足时按能力退化到下一级，不整体失败；每级有明确标记
  - 动机：外部工具可用性不稳定，降级链确保在最差情况下仍产出部分结果
  - 实现：Full (GitNexus+ABCoder) → Enhanced (Serena MCP) → Basic (Read/Grep/Glob)；DB: Level 1 (MCP) → Level 2 (CLI) → Level 3 (ORM inference)
  - SKILL.md 位置：`§1.2 Analysis Modes`（代码降级）和 `§4 DB Analysis`（数据库降级）

  **5. Failure Recovery**
  - 定义：rerun 时先 backup 已有产物，成功后删除 backup，失败时选择 restore 或 preserve partial
  - 动机：防止重跑时破坏已有产物；提供可回滚的安全网
  - 实现：Phase 3.4 partial failure policy 和 rerun backup/restore 策略
  - SKILL.md 位置：`§3.4 Partial Failure Policy`（失败处理）和 `§5 Rerun Recovery`（重跑恢复）

- 末尾段：说明这些模式可被其他 workflow（如 spec-review、spec-work）参照引用

**Test scenarios:**
- 核查文件存在于 `docs/02-架构设计/03-agent-workflow-patterns.md`
- 核查 5 个模式各有独立 H2 节（定义 + 动机 + 实现示例）
- 核查每个模式的"实现示例"指向 spec-bootstrap 中的真实位置（非虚构引用）
- 核查文档末尾有跨 workflow 引用说明

**Verification:** 文件存在，5 个模式完整，所有实现引用可在 spec-bootstrap 源文件中验证

---

## Sequencing

```
Wave 1:  Unit 1 ──┐   Unit 4 (独立)   Unit 6 (独立)
                  │
Wave 2:  Unit 2   Unit 3 (依赖 Unit 1)
           │
Wave 3:  Unit 5 (依赖 Unit 2)
```

**依赖关系：**
- Unit 3 仅依赖 Unit 1（同文件，避免行号位移冲突）
- Unit 5 仅依赖 Unit 2（同文件）
- Unit 4、Unit 6 无依赖

**建议执行顺序：** [Unit 1, Unit 4, Unit 6] 并行 → [Unit 2, Unit 3] 并行（Unit 3 仅等待 Unit 1，无需等待 Unit 2）→ [Unit 5]

## System-Wide Impact

- `skills/spec-bootstrap/SKILL.md`：§3.2 内容替换（结构化 Contract 节）+ §2.5 新节插入
- `skills/spec-bootstrap/references/prd-template.md`：Self-Check 节插入 + Filled Example 追加
- `skills/spec-bootstrap/references/database-prd-template.md`：Reference SQL 追加至 §2.2
- `docs/02-架构设计/03-agent-workflow-patterns.md`：新文件
- 无源码变更，无测试文件变更，无 CLI 行为变更

## Risk Analysis

- **风险 1：SKILL.md 同时被 Unit 1 和 Unit 3 修改**。缓解：Unit 3 明确声明依赖 Unit 1，按顺序执行，或在同一 pass 内完成两处修改
- **风险 2：prd-template.md 同时被 Unit 2 和 Unit 5 修改**。缓解：Unit 5 明确声明依赖 Unit 2，按顺序执行
- **风险 3：Filled Example 找不到合适的历史 PRD 记录**。缓解：实现者可使用 spec-first 项目 mcp-setup 任务 PRD 作为替代来源；最低要求是保留真实路径格式和类名格式。若 mcp-setup PRD Context 字段同样不足，可用已知真实路径（如 `src/cli/commands/init.js`、`skills/spec-bootstrap/SKILL.md`）构造说明示例，并在文件头注明 `> Illustrative example — path formats are real, content is reconstructed`

## Deferred Implementation Notes

- Self-Check 第 3 项（"至少 2 个具体工件"）的措辞应与 Acceptance Criteria 第 3 条保持精确一致，实现时对齐
- Reference SQL 的具体 REGEXP 语法需在实现时针对 MySQL REGEXP 方言验证（非 PCRE）
- Filled Example 的最终长度和字段内容取决于找到的历史记录质量，无需与计划完全对齐
