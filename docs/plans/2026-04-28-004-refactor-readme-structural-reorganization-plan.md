---
title: "refactor: README progressive disclosure restructure"
type: refactor
status: active
date: 2026-04-28
spec_id: 2026-04-28-002-readme-structural-reorganization
origin: docs/brainstorms/2026-04-28-002-readme-structural-reorganization-requirements.md
---

# refactor: README progressive disclosure restructure

## Overview

重组 `README.md` 和 `README.zh-CN.md`，使章节顺序符合读者从"是什么 → 怎么装 → 能干什么 → 如何深入"的认知路径。内容不改，只调整结构和位置；同时精简 Runtime Assets 的硬编码计数数字。

---

## Problem Frame

两个 README 的章节顺序是按时间积累形成的，不反映读者路径：Workflow Entry Points 排在第 7 位，Design Boundary 夹在中间，Current Scope 和 Design Boundary 两节重复说明同一件事。（见 origin: docs/brainstorms/2026-04-28-002-readme-structural-reorganization-requirements.md）

---

## Requirements Trace

- R1. 两个文件采用渐进披露顺序：Title → Install → Workflow Entry Points → Context & Graph Readiness → CLI Reference → Runtime Assets → Development → Design Boundary
- R2. 删除独立 "Current Scope" 节，内容合并入标题段落，不超过 3~4 行
- R3. Workflow Entry Points 提升至 Install 之后
- R4. Context & Graph Readiness 保留独立节，位于 Workflow Entry Points 之后
- R5. Design Boundary 移至末尾
- R6. Runtime Assets 表格的 Capability layer 行去掉硬编码计数数字；Expected init output 块去掉具体文件数目行，保留 "下一步" 指引
- R7. Documentation 节合并进 Development 节末尾
- R8. 两个文件章节结构完全一致
- R9. 正文和表格文字保持现有翻译对应，不引入新内容

---

## Scope Boundaries

- 不更改任何保留内容的实质文字
- R6 精简仅限 Capability layer 行和 expected init output 的计数行；其他 Runtime Assets 内容不动
- 不修改 CLAUDE.md、AGENTS.md 或任何非 README 文件

---

## Graph Readiness

- status: stale
- source_revision: 5d191758552cc10962e93131254a79391092982f
- current_revision: cfba31b9162c246a0030490887ceeb052e5f963e
- stale: true
- primary_providers: code-review-graph, gitnexus
- degraded_providers: none
- fallback_capabilities: bounded direct repo reads
- confidence: high（纯文档重构，不涉及代码路径）
- limitations: 图谱分析对本任务无实质作用

---

## Context & Research

### Relevant Code and Patterns

- `README.md`：当前 140 行，10 个 H2 节
- `README.zh-CN.md`：当前 127 行，9 个 H2 节（缺 "Documentation" 节）

### 当前章节顺序 vs 目标顺序

| 当前位置 | README.md 章节 | README.zh-CN.md 章节 | 目标位置 | 操作 |
|---|---|---|---|---|
| 1 | Current Scope | 当前范围 | 折入标题段落 | 删除独立节，内容压缩为 3-4 行合入 intro |
| 2 | Install | 安装 | 2 | 保留，位置不变 |
| 3 | Context And Graph Readiness | 上下文与 Graph Readiness | 4 | 下移至 Workflow Entry Points 之后 |
| 4 | Main Commands | 主要命令 | 5 | 保留，重命名为 "CLI Reference" / "CLI 参考" |
| 5 | Runtime Assets | Runtime Assets | 6 | 保留，精简 Capability 行 + init output 计数行 |
| 6 | Workflow Entry Points | Workflow 入口 | 3 | 上移至 Install 之后 |
| 7 | Development | 开发与验证 | 7 | 保留，末尾追加 Documentation 内容 |
| 8 | Documentation | （不存在） | 合并入 7 | 合并进 Development 末尾；中文版补充同等链接列表 |
| 9 | Design Boundary | 设计边界 | 8（末尾） | 保留，已在末尾（中文版无需移动） |

---

## Key Technical Decisions

- **Runtime Assets 独立节**：R1 未显式列出 Runtime Assets，将其放在 CLI Reference 之后、Development 之前，作为参考材料的自然延伸。
- **R6 适用范围**：同时覆盖 Capability layer 表格行和 expected init output 块的计数行；保留"下一步"指引，仅删除文件数目行。
- **中文版 Documentation 内容**：README.zh-CN.md 缺少 Documentation 节。为满足 R8（结构完全一致），在 "开发与验证" 末尾追加同等中文文档链接列表（链接目标与英文版一致，内容已存在于仓库，符合 R9）。

---

## Open Questions

### Deferred to Implementation

- intro 段落的精确措辞：根据现有 Current Scope 内容和标题描述自行压缩，保持语义完整即可

---

## Implementation Units

- U1. **重构 README.md（英文版）**

**Goal:** 按渐进披露顺序重新组织 `README.md`，精简 Runtime Assets 计数

**Requirements:** R1, R2, R3, R4, R5, R6, R7

**Dependencies:** None

**Files:**
- Modify: `README.md`

**Approach:**

目标章节顺序（H2 标题）：

```
# spec-first
[语言切换链接]
[intro 段落：当前标题描述 + Current Scope 内容压缩为 3-4 行]

## Install
[原内容不变]

## Workflow Entry Points
[原 Workflow Entry Points 表格不变]

## Context and Graph Readiness
[原 Context And Graph Readiness 内容不变]

## CLI Reference
[原 Main Commands 代码块不变，仅重命名节标题]

## Runtime Assets
[表格：Capability layer 行去掉 `39`/`51`/`18` 等计数数字，
 改为 "Bundled source assets ship with skills, agents, and templates.
 Runtime delivery is host-filtered by governance. Run `spec-first doctor` to see current counts."
 其余三行（Claude runtime / Codex runtime / Readiness）不变]

[Expected Claude init output 块：删除计数行（📦 / 🧩 / 🤖 开头的三行），只保留"下一步"指引段]
[Expected Codex init output 块：删除计数行（🧩 / 🤖 开头的两行），只保留"下一步"指引段]

## Development
[原命令列表和说明不变]

### Documentation
[原 Documentation 节的 4 个链接，移至此处作为 Development 末尾子节]

## Design Boundary
[原内容不变]
```

**Test scenarios:**

Test expectation: none — 纯文本重组，无代码路径，无行为变化

**Verification:**
- 读取 `README.md`，按顺序确认：Install → Workflow Entry Points → Context and Graph Readiness → CLI Reference → Runtime Assets → Development → Design Boundary
- 确认无 "## Current Scope" 独立节
- 确认无 "## Documentation" 独立节（内容已在 Development 内）
- 确认 Runtime Assets Capability layer 行中无反引号数字（`39`、`51`、`18`、`22` 等）
- 确认 expected init output 块中无 📦/🧩/🤖 计数行

---

- U2. **重构 README.zh-CN.md（中文版）**

**Goal:** 按与 U1 相同的渐进披露结构重组中文版，确保两文件章节结构完全一致

**Requirements:** R1, R2, R3, R4, R5, R6, R8, R9

**Dependencies:** None（可与 U1 并行）

**Files:**
- Modify: `README.zh-CN.md`

**Approach:**

目标章节顺序（H2 标题）：

```
# spec-first
[语言切换链接]
[intro 段落：对应英文版 intro 的中文翻译，压缩当前范围内容为 3-4 行]

## 安装
[原内容不变]

## Workflow 入口
[原 Workflow 入口表格不变]

## 上下文与 Graph Readiness
[原内容不变]

## CLI 参考
[原 主要命令 代码块不变，重命名节标题]

## Runtime Assets
[表格：Capability layer 行（**能力层资产**）去掉 `39`/`51`/`18`/`22` 等计数数字，
 改为 "仓库内置 skills、agents 和 templates。运行时按双宿主治理过滤。运行 `spec-first doctor` 查看当前数量。"
 其余三行不变]

[Expected Claude init output 块：删除计数行（📦 / 🧩 / 🤖 开头的行，如有），保留"下一步"指引]
[Expected Codex init output 块：删除计数行（🧩 / 🤖 开头的行），保留"下一步"指引]

## 开发与验证
[原命令列表和说明不变]

### 文档
- [架构设计概览](./docs/02-架构设计/01-整体架构.md)
- [开发规范](./docs/03-实施方案/06-开发规范.md)
- [测试方案](./docs/03-实施方案/04-测试方案.md)
- [版本更新说明](./docs/08-版本更新/README.md)

## 设计边界
[原内容不变，位置已在末尾]
```

注：中文版目前无 "当前范围" 之后的 "图谱上下文" 单独段落，intro 段落合并时也一并吸收该段落的含义。

**Test scenarios:**

Test expectation: none — 纯文本重组

**Verification:**
- 读取 `README.zh-CN.md`，按顺序确认：安装 → Workflow 入口 → 上下文与 Graph Readiness → CLI 参考 → Runtime Assets → 开发与验证 → 设计边界
- 与 `README.md` 对比章节数（均为 8 个 H2 节）
- 确认无 "## 当前范围" 独立节
- 确认 Runtime Assets Capability layer 行中无反引号计数数字
- 确认 expected init output 块中无文件计数行

---

## System-Wide Impact

- **Unchanged invariants:** 所有外部链接（docs/、README 语言切换链接）路径不变；命令示例、表格数据（计数行除外）不变

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-28-002-readme-structural-reorganization-requirements.md](docs/brainstorms/2026-04-28-002-readme-structural-reorganization-requirements.md)
