---
title: "feat: Improve spec-bootstrap PRD quality and orchestrator guidance"
type: feat
status: completed
date: 2026-04-03
origin: docs/01-需求分析/6.项目知识库/spec-bootstrap-补丁建议.md
---

# feat: Improve spec-bootstrap PRD quality and orchestrator guidance

## Overview

补丁建议文档（经过代码审查和方向修正）识别出两层问题：一是 worker subagent 从 PRD 拿到的工具信息不够用（缺少调用示例）；二是编排器在 Phase 2 创建 PRD 时缺少动态决策指引（Files to Fill 裁剪策略、task-specific AC 注入、文档推荐骨架）。本计划针对这两层依次修复。

## Problem Frame

spec-bootstrap 的执行链路是：orchestrator 读 SKILL.md → 按 prd-template.md 创建 PRD → worker subagent 只读 PRD。当前：

1. `prd-template.md` 的 Tools Available 节只列工具名，无调用示例，也无推荐工作流。Worker 拿到的 PRD 提供的信息不足以高质量使用 MCP 工具。
2. ABCoder 调用链在 `prd-template.md` 和 `SKILL.md` 中不一致（`get_package_structure` vs `get_file_structure`）。
3. Phase 2 编排器缺少以下指引：
   - 哪些 Files to Fill 可以按项目实际省略（避免生成空壳文档）
   - pitfalls/layer/database 任务需要额外 AC 条目（当前通用 AC 不覆盖）
   - 各任务类型有哪些推荐章节结构（当前 worker 只能自由发挥）

(see origin: docs/01-需求分析/6.项目知识库/spec-bootstrap-补丁建议.md)

## Requirements Trace

- R1a. SKILL.md Tool Usage Guide 补全遗漏工具（+gitnexus_impact, +find_referencing_symbols）
- R1b. prd-template.md 的 Tools Available 节包含调用示例和推荐工作流（Full/Enhanced/Basic 三模式），内容严格从 SKILL.md 复制
- R2. ABCoder 调用链统一为 `get_file_structure`（消除 prd-template.md vs SKILL.md 不一致）
- R2b. prd-template.md 内容变更补充 grep 级 smoke 断言
- R3. SKILL.md Phase 2.4 增加 Files to Fill 动态策略：编排器依据项目规模省略不适用的文件
- R3b. Phase 2.1 Fixed Tasks 表注释条件产物、Phase 3.5 动态化、Completion Checklist 对齐、L619-621 收紧为 section 级
- R4. SKILL.md Phase 2.4 增加 task-specific AC 注入规则：pitfalls/layer 追加 anti-pattern 条目，database 追加凭证保护条目
- R5. SKILL.md Phase 2.4 增加 Technical Notes 推荐骨架：各任务类型有参考章节结构，但不强制
- R6. SKILL.md Phase 2 增加 pitfalls 发现策略（代码/架构/业务/历史信号）
- R7. SKILL.md Phase 2 增加 architecture 三文件边界说明（system-overview vs module-map vs integration-boundaries 的职责分工）

## Scope Boundaries

- 不修改 prd-template.md 的 Important Rules 节（文件级灵活性属编排器职责，不下放给 worker）
- 不修改 prd-template.md 的通用 Acceptance Criteria（task-specific 条目通过编排器注入，不进通用模板）
- 不修改 `references/database-prd-template.md`（database worker 有独立模板）
- 不直接编辑 `.claude/skills/` 运行时副本；每个 Unit 完成后通过手动 cp 或 `spec-first init --claude` 同步
- P2 补丁（U3/U4）不做破坏性重构，仅在现有 Phase 2 中追加 Technical Notes 内容

## Context & Research

### Relevant Code and Patterns

- `skills/spec-bootstrap/references/prd-template.md:47-69` — 当前 Tools Available 节（仅工具名列表，无示例）
- `skills/spec-bootstrap/SKILL.md:69-120` — Tool Usage Guide（含完整表格+示例，是修改 prd-template.md 的内容来源）
- `skills/spec-bootstrap/SKILL.md:453-479` — 当前 Phase 2.4 PRD Content（需追加三个子章节）
- `skills/spec-bootstrap/SKILL.md:419-451` — Phase 2.1-2.3 固定/条件/数据库任务表（了解任务类型）
- `skills/spec-bootstrap/SKILL.md:487-511` — Phase 3.1 文件归属规则（理解 Files to Fill contract 边界）
- `skills/spec-bootstrap/SKILL.md:619-623` — "Context Files Are Not Fixed" 章节（骨架建议必须与此保持一致）

### Institutional Learnings

- 审查结论明确：文件级灵活性属编排器职责，在 prd-template.md Rule 5 加文件级权限会与 AC 第一条冲突
- Task-specific AC 必须在编排器 Phase 2 注入，不能进通用模板（summary-context 不应被 anti-pattern 条目卡住）
- 推荐骨架必须以"参考"形式出现，不能成为强制 schema（与"Context files are not fixed"原则兼容）

### External References

- 无（纯文档编辑，本地模式已充分）

## Key Technical Decisions

- **Tools Available 格式**：使用 `| Tool | Purpose | Example Call |` 三列表格替换现有列表。在 prd-template.md 中以填充后的格式呈现（非占位符），因为编排器会按当前 mode 选择适用的表格注入 PRD。实际 PRD 中编排器只填写检测到的 mode 对应的那一块。
- **Phase 2.4 追加位置**：在现有七节列表之后、Phase 2.5（Quality Gate）之前，追加三个编号子章节（2.4.1/2.4.2/2.4.3）。保持 Phase 2.5 不动。
- **推荐骨架形式**：以 `**Suggested structure** (adapt freely):` 标头加 markdown 注释块形式写入 Technical Notes 填充示例，避免出现"必须"或"required"措辞。
- **P2 内容插入位置**：pitfalls 发现策略插入 Phase 2 的 pitfalls-context PRD 创建说明附近；architecture 边界说明插入 Phase 2 的 architecture-context PRD 创建说明附近。两者均以"编排器在填写 Technical Notes 时参考"的形式呈现，不作为强制规则。
- **CHANGELOG.md**：每个 Unit 完成后追加一条记录，统一格式 `- vX.Y.Z YYYY-MM-DD kuang: 摘要`。

## Open Questions

### Resolved During Planning

- **Q: 补丁3/4/6 应分开编辑还是合并？** → 合并为 Unit 2 单次编辑，都落在 Phase 2.4，减少合并冲突风险。
- **Q: `.claude/` 副本如何处理？** → 所有 Unit 只编辑 `skills/` 源文件，`.claude/` 通过 Sync Protocol 同步。详见 Sync Protocol 节。
- **Q: gitnexus_impact 和 find_referencing_symbols 是否存在？** → 是。GitNexus 实际提供 7 个 MCP 工具（含 impact），Serena 提供 find_referencing_symbols。SKILL.md Tool Usage Guide 遗漏了这两个工具，Unit 1 Step 1 先补全。
- **Q: SKILL.md L619-621 和 L608 的矛盾如何处理？** → L619 给 worker 文件级跳过权，L608 要求所有文件产出，两者矛盾。Unit 2 Step 5 将 L619 收紧为 section 级灵活性，L608 改为 PRD-listed 语义。

### Deferred to Implementation

- 无待决问题。

## Implementation Units

- [x] **Unit 1 (P0): SKILL.md Tool Usage Guide 补全 + 替换 prd-template.md Tools Available + smoke 断言**

**Goal:** 先补全 SKILL.md 工具清单（source of truth），再将 prd-template.md Tools Available 从抽象工具名改为含调用示例的结构化表格，同步修正 ABCoder 调用链，并补充 grep 级自动化验证。

**Requirements:** R1a, R1b, R2, R2b

**Dependencies:** 无

**Files:**
- Modify: `skills/spec-bootstrap/SKILL.md` （L71-119 Tool Usage Guide — 添加 gitnexus_impact + find_referencing_symbols）
- Modify: `skills/spec-bootstrap/references/prd-template.md` （L47-70 Tools Available 节）
- Modify: `tests/smoke/cli.sh` 或新建 `tests/unit/prd-content.sh` （grep 级内容断言）
- Modify: `CHANGELOG.md`

**Approach:**

**Step 1: 更新 SKILL.md Tool Usage Guide（前置）**

在 GitNexus 表格（L75-79）追加一行：

| `gitnexus_impact` | Blast radius | `gitnexus_impact({target: "UserModel", direction: "downstream"})` |

在 Serena 表格（L113-117）追加一行：

| `mcp__serena__find_referencing_symbols` | Find references | `mcp__serena__find_referencing_symbols({name_path: "AuthService", relative_path: "src/auth/service.ts"})` |

更新后 GitNexus 4 工具、Serena 4 工具，与 prd-template.md 目标内容对齐。

**Step 2: 替换 prd-template.md Tools Available**

用以下结构替换当前 L47-69 的内容（内容严格从 Step 1 更新后的 SKILL.md 复制）：

```text
### Tools Available

> The orchestrator fills this section based on the detected analysis mode.
> Include only the block(s) matching the detected mode.

**Analysis mode: [Full | Enhanced | Basic]**

--- Full Mode ---
GitNexus 表格（4 行：gitnexus_query / gitnexus_context / gitnexus_cypher / gitnexus_impact）
ABCoder 表格（4 行：list_repos / get_repo_structure / get_file_structure / get_ast_node）
Recommended Workflow（4 步）

--- Enhanced Mode ---
Serena 表格（4 行：get_symbols_overview / find_symbol / search_for_pattern / find_referencing_symbols）
Recommended Workflow（5 步）

--- Basic Mode ---
工具列表（Read / Grep / Glob）
Recommended Workflow（4 步）
```

**Step 3: 补充 smoke 断言**

在 `tests/smoke/cli.sh` 的 prd-template.md 存在性检查（L92）之后追加：

```bash
grep -q 'get_file_structure' "$TMP_DIR/.claude/skills/spec-bootstrap/references/prd-template.md"
! grep -q 'get_package_structure' "$TMP_DIR/.claude/skills/spec-bootstrap/references/prd-template.md"
grep -q 'gitnexus_query' "$TMP_DIR/.claude/skills/spec-bootstrap/references/prd-template.md"
grep -q 'Example' "$TMP_DIR/.claude/skills/spec-bootstrap/references/prd-template.md"
```

**Patterns to follow:**
- `skills/spec-bootstrap/SKILL.md:69-120` — Tool Usage Guide 的表格格式和调用示例（更新后的版本）

**Test scenarios:**
- Happy path: 从 prd-template.md 生成的 Full mode PRD 中，worker 能看到 `gitnexus_query({query: "..."})` 格式的调用示例
- Edge case: Enhanced mode PRD 中只包含 Serena 表格，不包含 GitNexus/ABCoder 内容
- Correctness: ABCoder 调用链中出现 `get_file_structure` 而非 `get_package_structure`
- Consistency: SKILL.md 和 prd-template.md 的工具列表数量完全一致（GitNexus 4 + Serena 4）
- Regression: smoke 断言在 `npm run test:smoke` 中通过

**Verification:**
- SKILL.md Tool Usage Guide 包含 GitNexus 4 工具（含 gitnexus_impact）和 Serena 4 工具（含 find_referencing_symbols）
- prd-template.md 中 ABCoder 调用链的 `get_package_structure` 已替换为 `get_file_structure`
- 三种模式（Full/Enhanced/Basic）各有独立表格，每行均包含 Tool、Purpose、Example Call
- prd-template.md 工具列表 ≤ SKILL.md 工具列表（无超范围工具）
- 推荐工作流以有序列表形式出现在各模式块末尾
- smoke 断言通过（`npm run test:smoke`）

---

- [x] **Unit 2 (P1): SKILL.md 编排器指引 + 多点一致性修复**

**Goal:** 在 Phase 2.4 追加编排器决策指引（Files to Fill 动态策略、task-specific AC、推荐骨架），同步修复 Phase 2.1/3.5/Completion Checklist/L619 中与动态裁剪冲突的语义。

**Requirements:** R3, R3b, R4, R5

**Dependencies:** Unit 1（概念上独立，但建议在 U1 完成后执行以确保调用示例已统一）

**Files:**
- Modify: `skills/spec-bootstrap/SKILL.md`
  - Phase 2.1 Fixed Tasks 表（L414-420）— 注释条件产物
  - Phase 2.4 PRD Content（L453-464）— 追加三个子章节
  - Phase 3.4 Assembly README（L571）— Architecture 描述行动态化
  - Phase 3.5 Execution Summary（L585-599）— 动态文件列表
  - Completion Checklist（L608）— 对齐 PRD-listed 语义
  - "Context Files Are Not Fixed"（L619-623）— 收紧为 section 级
- Modify: `CHANGELOG.md`

**Approach:**

**Step 1: Phase 2.1 Fixed Tasks 表 — 注释条件产物**

`architecture-context` 行的 Produces 列改为：

`system-overview.md`, `module-map.md`, `integration-boundaries.md`（条件：项目有外部集成点时创建）

**Step 2: Phase 2.4 — 追加三个子章节**

在 Phase 2.4 的七节列表之后、`### 2.5 PRD Quality Gate` 之前，插入三个子章节：

**2.4.1 Files to Fill 动态策略**

```text
- 编排器依据 Phase 1 分析结果，动态决定每个 worker 的 Files to Fill 列表
- 示例省略条件：
  - architecture-context：项目无明显外部集成点 → 可省略 integration-boundaries.md
  - layer-context：该层代码 < 3 个文件 → 可降级合并进 00-summary.md，不单独建 worker
- 原则：Files to Fill 只列编排器有把握生成高质量内容的文件；宁可省略，不要产出空壳文档
```

注意：已删除原方案中的"pitfalls 降级为 summary 的小节"建议。pitfalls-context 是固定任务，不应被消除；小项目可产出薄文档但不应省略任务本身。

**2.4.2 Task-specific Acceptance Criteria 注入规则**

```text
pitfalls-context / layer-context 追加：
  - [ ] Each pitfall includes: file + line range, risk type, why risky, recommended mitigation
  - [ ] At least 3 concrete examples documented with real code from the codebase
```

> 注意：database-context 不经过 Phase 2.4（L453 明确 2.4 只服务 non-database tasks）。database 专项 AC（凭证保护、Mermaid erDiagram）已在 `references/database-prd-template.md` 独立模板中覆盖，不在此注入。

**2.4.3 Technical Notes 推荐骨架**

```text
summary-context 注入：
  Suggested structure (adapt freely):
  - ## 技术栈、## 顶层结构、## 核心职责、## 已知限制

architecture-context 注入：
  system-overview: ## 整体结构 / ## 关键架构决策 / ## 系统边界
  module-map: 每个顶层目录一行（`目录/ — 一句话职责`）
  integration-boundaries: ## 模块间接口 / ## 外部依赖 / ## 通信协议

pitfalls-context 注入：
  ## 代码层风险 / ## 架构层风险 / ## 业务逻辑风险 / ## 历史热点
```

**Step 3: Phase 3.4 Assembly README — 动态 Architecture 描述**

当前 L571 硬编码 `— system structure, module map, integration boundaries`。改为根据实际产出的 architecture 文件动态生成描述行（如省略 integration-boundaries.md 则不提及 "integration boundaries"）。

**Step 4: Phase 3.5 Execution Summary — 动态化**

当前模板硬编码 `architecture/ (3 files)`，改为 `architecture/ (N files)`，N 从实际产出文件列表中计算。

**Step 5: Completion Checklist L608**

从 "All fixed-task files produced and non-empty" 改为 "All PRD-listed Files to Fill produced and non-empty"（与 prd-template.md AC L105 语义对齐）。

**Step 6: "Context Files Are Not Fixed" L619-621 — 收紧为 section 级**

从当前的 "If a planned file has no meaningful content for this project, the worker should skip it and note why" 改为：

"Workers must adapt **section content** to the real project — not fill in placeholder text. If a planned section has no meaningful content, skip it and note why. File-level decisions (which files to create or omit) are the orchestrator's responsibility in Phase 2."

**Patterns to follow:**
- Phase 2.3 的 database-context PRD 内容说明（L441-451）作为 task-specific 注入写法的参考
- `prd-template.md:105` 的 AC 措辞（"All files listed in Files to Fill"）作为 checklist 对齐参考

**Test scenarios:**
- Happy path: 编排器为 pitfalls-context 任务生成 PRD 时，AC 节包含"at least 3 concrete examples"条目
- Happy path: 编排器为 summary-context 生成 PRD 时，Technical Notes 包含推荐骨架但不包含 pitfalls AC 条目
- Edge case: 无外部集成的项目，architecture-context 的 Files to Fill 只有 2 个文件（无 integration-boundaries.md）
- Consistency: Completion Checklist 和 prd-template.md AC 使用相同语义（"PRD-listed" / "Files to Fill listed"）
- Consistency: L619-621 不再给 worker 文件级跳过权

**Verification:**
- Phase 2.1 Fixed Tasks 表中 architecture-context 的 integration-boundaries.md 标注为条件
- Phase 2.4 包含三个新子章节（2.4.1/2.4.2/2.4.3），2.4.2 不包含 database AC（database 走独立路径）
- 子章节出现在现有七节列表之后、`### 2.5 PRD Quality Gate` 之前
- Phase 3.4 Assembly README 的 Architecture 描述行不再硬编码 "integration boundaries"
- Phase 3.5 Execution Summary 不硬编码 "3 files"
- Completion Checklist 使用 "PRD-listed" 语义
- L619-621 已收紧为 section 级灵活性
- 推荐骨架带有"adapt freely"或类似的非强制措辞

---

- [x] **Unit 3 (P2): SKILL.md 补充 pitfalls-context 发现策略**

**Goal:** 为编排器创建 pitfalls-context PRD 提供具体的发现信号和输出格式指引，提升 pitfalls 产物质量。

**Requirements:** R6

**Dependencies:** Unit 2（需 2.4 结构稳定后再追加相关内容）

**Files:**
- Modify: `skills/spec-bootstrap/SKILL.md` （Phase 2 中 pitfalls-context 相关位置，约 Phase 2.1 表格附近或新增 Technical Notes 指引节）
- Modify: `CHANGELOG.md`

**Approach:**

在 Phase 2.1 的 pitfalls-context 行附近，或在 Phase 2.4 新增的 2.4.3 骨架节中，追加 pitfalls 发现策略：

```
Pitfall Discovery Strategy（编排器填 pitfalls PRD 的 Technical Notes 时参考）：

Code-level signals:
- TODO/FIXME/HACK 密集区
- 嵌套条件 > 3 层
- 函数体 > 100 行
- 裸 try-catch / swallowed exceptions

Architecture-level signals:
- 循环依赖
- God class (> 500 行 / > 20 方法)
- 高扇入扇出
- 相似模块间模式不一致

Business logic signals:
- 权限绕过路径
- 并发竞态
- 事务边界问题
- 数据验证缺口

Historical signals (if git available):
- 高频改动文件
- 集中 bug-fix 区域
- Reverted commits

Output per pitfall: location + risk type + why risky + recommended mitigation
```

**Patterns to follow:**
- Phase 3.3 数据库 worker 指令（L518-551）的详细策略写法作为参考格式

**Test scenarios:**
- Happy path: 编排器在为 pitfalls-context 填写 Technical Notes 时，参考了代码层/架构层/业务层三类信号
- Coverage: 生成的 pitfalls/index.md 包含至少一条带 risk type 标注的具体条目

**Verification:**
- SKILL.md 中存在 pitfalls 发现策略内容，包含代码/架构/业务/历史四类信号
- 策略以"编排器参考"形式呈现，非 worker 的强制执行步骤

---

- [x] **Unit 4 (P2): SKILL.md 补充 architecture 三文件边界说明**

**Goal:** 明确 system-overview / module-map / integration-boundaries 的内容边界，避免编排器生成的三个 worker PRD 出现职责重叠。

**Requirements:** R7

**Dependencies:** Unit 2

**Files:**
- Modify: `skills/spec-bootstrap/SKILL.md` （Phase 2.4 的 architecture-context 骨架附近，或 Phase 2.1 表格说明中）
- Modify: `CHANGELOG.md`

**Approach:**

在 architecture-context 相关的编排器指引中追加三文件边界说明：

| 文件 | 写什么 | 不写什么 |
|------|--------|---------|
| system-overview.md | 分层策略、架构风格、关键设计决策 | 具体模块列表（→ module-map） |
| module-map.md | 每个顶层目录职责、所属层级 | 模块间调用关系（→ integration-boundaries） |
| integration-boundaries.md | 模块间接口、外部依赖、通信协议 | 模块内部实现（→ layer 文档） |

**Patterns to follow:**
- Phase 2.3 数据库任务的 PRD 内容说明（L441-451）作为多文件职责分工的写法参考

**Test scenarios:**
- Happy path: architecture-context worker PRD 包含三个文件的职责说明
- Edge case: system-overview.md 不包含模块列表（那属于 module-map）
- Edge case: integration-boundaries.md 不包含模块内部实现

**Verification:**
- SKILL.md 中存在 architecture 三文件的"写什么/不写什么"说明
- 三个文件职责不重叠（可通过阅读说明验证无交叉描述）

---

## Sync Protocol（跨 Unit）

`skills/` 是 source of truth，`.claude/` 和 `.agents/` 是生成物（CLAUDE.md 明确规定）。所有 Unit 只编辑 `skills/` 源文件，不直接编辑 `.claude/` 或 `.agents/` 副本。

每个 Unit 完成后，执行以下同步步骤：

```bash
# 方式 1：spec-first init（推荐，会执行 canonical name 重写等转换）
spec-first init --claude

# 方式 2：手动 cp（若 init 不可用）
cp skills/spec-bootstrap/SKILL.md .claude/skills/spec-bootstrap/SKILL.md
cp skills/spec-bootstrap/references/prd-template.md .claude/skills/spec-bootstrap/references/prd-template.md
```

同步后验证：`diff skills/spec-bootstrap/SKILL.md .claude/skills/spec-bootstrap/SKILL.md` 应无差异（或仅有 canonical name 转换差异）。

## System-Wide Impact

- **变更链路**：`skills/spec-bootstrap/SKILL.md` 和 `references/prd-template.md` 是编排器行为的指令来源；修改这两个文件直接影响所有 spec-bootstrap 运行时生成的 PRD 质量
- **向后兼容**：所有变更为追加/替换，不删除现有 Phase 或 Rules；Unit 2 修改 Completion Checklist 和 L619-621 是语义收紧（消除预存矛盾），不改变 worker 的实际行为
- **运行时副本**：遵循 Sync Protocol — 只编辑 `skills/` 源文件，每个 Unit 后同步
- **不影响范围**：`references/database-prd-template.md`、`commands/`、`agents/`、`templates/` 均不涉及；`tests/smoke/cli.sh` 仅在 Unit 1 追加断言

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Phase 2.4 新增内容过长导致 SKILL.md 编排器 context 膨胀 | 各子章节保持简洁，以列表/表格为主，避免散文式描述 |
| 推荐骨架被 worker 解读为强制要求 | 所有骨架说明使用"Suggested structure (adapt freely)"标头，并在骨架前加"参考"措辞 |
| `.claude/` 副本与源文件不同步 | 每个 Unit 完成后立即手动 cp 或 `spec-first init --claude`；将此列为每个 Unit 的 Verification 步骤 |
| ABCoder 调用链修正后与其他文档不一致 | 修正 prd-template.md 后，检查 SKILL.md 中其余提及 `get_package_structure` 的位置 |

## Documentation / Operational Notes

- `CHANGELOG.md` 每个 Unit 完成后追加一条，格式：`- vX.Y.Z YYYY-MM-DD kuang: feat(spec-bootstrap): 摘要 (user-visible)`
- Unit 1 和 2 属于用户可见变更（worker 产物质量提升），追加 `(user-visible)`
- Unit 3/4 属于编排器内部指引，视版本管理习惯决定是否标 user-visible

## Sources & References

- **Origin document:** [spec-bootstrap 补丁建议](../01-需求分析/6.项目知识库/spec-bootstrap-补丁建议.md)
- Tool Usage Guide: `skills/spec-bootstrap/SKILL.md:69-120`
- Phase 2.4 current: `skills/spec-bootstrap/SKILL.md:453-479`
- prd-template.md Tools Available: `skills/spec-bootstrap/references/prd-template.md:47-69`
- "Context Files Are Not Fixed": `skills/spec-bootstrap/SKILL.md:619-623`
