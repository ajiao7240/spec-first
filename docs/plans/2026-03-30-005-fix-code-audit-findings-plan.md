---
title: fix: 清理代码审计发现
type: fix
status: active
date: 2026-03-30
origin: docs/brainstorms/2026-03-30-code-audit-report.md
---

# 清理代码审计发现

## Overview

代码审计报告发现了 5 处死代码、1 处文档错误和若干代码质量问题。本计划按优先级逐一修复，使代码库保持干净、无陷阱。

## Problem Frame

审计发现项目中存在多个未使用模块（`agents.js`、`skills.js`、`templates.js`、`spec-commands.js`），它们是早期重构遗留的包装层。当前主流程已直接调用 `plugin.js`，但这些死代码模块仍保留在源码中，构成"陷阱"——未来开发者可能误引用它们导致运行时崩溃。同时 `postinstall.js` 展示了不完整的命令示例，`init.js` 解析了未使用的 `--force` 标志。

## Requirements Trace

- R1. 删除所有未使用的包装模块，消除死代码陷阱 (C1, H1)
- R2. 修复 postinstall.js 文档错误 (H2)
- R3. 删除未使用的 `--force` 解析和死代码函数 (M1, M2)
- R4. 重构 doctor.js 脆弱的 splice 索引计算 (M4)
- R5. 统一 claude.js 的 require 风格 (M5)
- R6. 冒烟测试全部通过，无回归

## Scope Boundaries

- 不新增单元测试框架（L4 需要更大范围的决策）
- 不引入日志/调试模式（L3 是独立特性）
- 不处理 ASCII 框宽度硬编码（L1，极低优先级）
- 不处理 `transformSkillContent` 命名语义问题（M3，当前行为正确，仅命名不清晰）

## Context & Research

### Relevant Code and Patterns

- 死代码验证：`agents.js`、`skills.js`、`templates.js`、`spec-commands.js` 在整个 `src/` 和 `tests/` 中零导入
- `adaptClaudeRuntimeContent` 仅在 `plugin.js:280` 自身定义处出现，未被调用或导出
- `--force` 仅在 `init.js:158` 出现
- `doctor.js:72` splice 使用 `3 + runtimeChecks.length` 硬编码索引
- `claude.js:50-51` 在 `inspect()` 方法内部 require `node:fs` 和 `node:path`
- 冒烟测试 `tests/smoke/cli.sh` 覆盖双平台 init/doctor/clean 全流程

### Institutional Learnings

- Codex 迁移经验表明：发布后必须跑完整 `init → doctor → clean` 链路验证
- 改动后需同时验证 Claude 和 Codex 双平台

## Key Technical Decisions

- **直接删除而非修复签名**：`agents.js`/`skills.js`/`templates.js` 的包装函数在主流程中从未被引用，修复签名反而增加维护负担。删除是更干净的选择。
- **doctor.js 改用 push + sort 替代 splice**：将检查项标记优先级后统一 push，最后按优先级排序。消除对前面检查项数量的硬编码依赖。
- **保留 `spec-commands.js` 的功能但改为延迟加载**：如果未来需要列出可用命令，应该在 `plugin.js` 中按需调用，不需要独立模块。当前确认零引用后直接删除。

## Implementation Units

- [ ] **Unit 1: 删除死代码模块**

**Goal:** 移除 4 个未使用的模块文件，消除死代码陷阱

**Requirements:** R1

**Dependencies:** None

**Files:**
- Delete: `src/cli/agents.js`
- Delete: `src/cli/skills.js`
- Delete: `src/cli/templates.js`
- Delete: `src/cli/spec-commands.js`

**Approach:**
- 直接删除 4 个文件
- 再次验证无任何导入引用

**Patterns to follow:**
- 当前项目直接使用 `plugin.js` 中的函数

**Test scenarios:**
- Happy path: 删除后 `bash tests/smoke/cli.sh` 全部通过
- Edge case: grep 确认无残留引用

**Verification:**
- `grep -r "require.*agents\.js\|require.*skills\.js\|require.*templates\.js\|require.*spec-commands" src/ tests/` 返回空
- 冒烟测试通过

- [ ] **Unit 2: 删除死代码函数和未使用参数**

**Goal:** 清理 `plugin.js` 中的死代码函数和 `init.js` 中的 `--force` 解析

**Requirements:** R3

**Dependencies:** Unit 1

**Files:**
- Modify: `src/cli/plugin.js` (删除 `adaptClaudeRuntimeContent` 函数)
- Modify: `src/cli/commands/init.js` (移除 `--force` 解析逻辑)

**Approach:**
- `plugin.js`: 删除 `adaptClaudeRuntimeContent` 函数定义（约第 280 行附近）
- `init.js`: 移除 `parseInitArgs` 中 `--force` 相关的解析分支和 `parsed.force` 赋值

**Test scenarios:**
- Happy path: 删除后冒烟测试通过
- Edge case: 确认 `init --force` 不再被识别（不会导致错误，只是被忽略，删除后行为一致）

**Verification:**
- `grep "adaptClaudeRuntimeContent" src/cli/plugin.js` 返回空
- `grep "force" src/cli/commands/init.js` 返回空
- 冒烟测试通过

- [ ] **Unit 3: 修复 postinstall.js 文档**

**Goal:** 修正 npm install 后展示的 init 命令示例

**Requirements:** R2

**Dependencies:** None

**Files:**
- Modify: `bin/postinstall.js`

**Approach:**
- 将 `spec-first init` 改为 `spec-first init --claude` 或 `spec-first init --codex`，并附上简短说明让用户选择平台

**Test scenarios:**
- Happy path: 输出包含 `--claude` 和/或 `--codex`

**Verification:**
- 读取修改后的文件确认命令示例正确

- [ ] **Unit 4: 重构 doctor.js 检查列表构建**

**Goal:** 消除 splice 硬编码索引，使检查项增减安全

**Requirements:** R4

**Dependencies:** None

**Files:**
- Modify: `src/cli/commands/doctor.js`

**Approach:**
- 将检查项构建改为：先 push 所有基础检查 → push runtime 检查 → 如果 adapter.hasCommands 则 push command 检查
- 用条件 push 替代 splice 插入
- 不改变输出顺序和内容

**Test scenarios:**
- Happy path: `doctor --claude` 和 `doctor --codex` 输出顺序与重构前一致
- Edge case: Codex (hasCommands=false) 不展示 command 检查

**Verification:**
- 冒烟测试通过
- 手动对比 doctor 输出确认无变化

- [ ] **Unit 5: 统一 claude.js require 风格**

**Goal:** 将 `inspect()` 内部的 `require` 移到文件顶部

**Requirements:** R5

**Dependencies:** None

**Files:**
- Modify: `src/cli/adapters/claude.js`

**Approach:**
- 将 `const fs = require('node:fs')` 和 `const path = require('node:path')` 从 `inspect()` 方法内部移到文件顶部（与其他文件风格一致）

**Test scenarios:**
- Happy path: 冒烟测试通过，inspect 行为不变

**Verification:**
- `grep "require" src/cli/adapters/claude.js` 只在文件顶部出现

- [ ] **Unit 6: 回归验证**

**Goal:** 确保所有修改无回归

**Requirements:** R6

**Dependencies:** Unit 1, 2, 3, 4, 5

**Files:**
- Test: `tests/smoke/cli.sh`

**Approach:**
- 运行完整冒烟测试
- 分别运行 `init --claude` 和 `init --codex` 验证双平台

**Test scenarios:**
- Happy path: 所有冒烟测试断言通过
- Integration: 双平台 init → doctor → clean 完整生命周期

**Verification:**
- `bash tests/smoke/cli.sh` 退出码 0

## System-Wide Impact

- **Interaction graph:** 删除的模块无调用者，不影响任何运行时路径
- **Error propagation:** 无变化，删除的代码不在错误链路中
- **State lifecycle risks:** 无，死代码不涉及状态管理
- **API surface parity:** postinstall 输出是唯一的用户可见变化

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| 删除模块被外部脚本引用 | grep 验证零引用；项目是 npm CLI，外部不会直接 require 内部模块 |
| doctor.js 重构改变输出格式 | 冒烟测试覆盖 doctor 输出验证 |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-03-30-code-audit-report.md](../brainstorms/2026-03-30-code-audit-report.md)
- Dead code modules: `src/cli/agents.js`, `src/cli/skills.js`, `src/cli/templates.js`, `src/cli/spec-commands.js`
- Dead function: `src/cli/plugin.js` (`adaptClaudeRuntimeContent`)
- Smoke test: `tests/smoke/cli.sh`
