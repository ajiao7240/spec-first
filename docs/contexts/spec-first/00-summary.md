# spec-first · 项目概览

**版本**: 1.5.9  
**语言**: JavaScript (Node.js CommonJS)  
**类型**: CLI 工具包（单一仓库）  
**分析时间**: 2026-04-23 | 模式: Full | 图: local-available

## 项目定位

`spec-first` 是一个 Node.js CLI，为 Claude Code 和 Codex 提供 spec 驱动工程工作流。

核心价值主张：
- **安装阶段**：`spec-first init --claude/--codex` 把 source of truth 资产同步到宿主运行时
- **图索引**：`spec-first crg build` 构建 SQLite + FTS5 Code Review Graph，支撑 symbol/flow/community 分析
- **Stage-0 上下文**：`spec-first stage0-context` 编译 LLM 输入质量提升产物，注入宿主工作流

## 核心模块

| 模块 | 路径 | 职责 |
|------|------|------|
| crg | `src/crg/` | Code Review Graph：AST 解析（tree-sitter）、SQLite 图存储、flow/community/risk 分析 |
| bootstrap-compiler | `src/bootstrap-compiler/` | Stage-0 编译流水线：事实提取、minimal-context、routing、verification profile |
| cli | `src/cli/` | CLI 控制面：doctor/init/clean 命令、Claude/Codex 双宿主 adapter、plugin 清单 |
| context-routing | `src/context-routing/` | Stage-0 路由：evaluator、verification gate、fallback、quality feedback |
| skills | `skills/` | Workflow/standalone skill 源码真相源（runtime 由 init 同步） |

## 关键入口

- `bin/spec-first.js` → `src/cli/index.js#runCli`（CLI 主分发）
- `spec-first crg build` → `src/crg/cli/build.js#run`（图构建）
- `spec-first stage0-context` → `src/cli/commands/stage0-context.js#runStage0Context`
- 内部 bootstrap 主编排 → `src/bootstrap-compiler/compile-machine-artifacts.js#compileMachineArtifacts`

## 依赖特征

- **tree-sitter**（17 语言语法）：AST 解析，唯一重型依赖
- **better-sqlite3**（optional）：CRG 图存储，内部工具库不对外暴露
- **simple-git**：git diff/log 支撑变更检测
- **ignore**：.gitignore 风格文件过滤

## 测试覆盖

- 114 Jest 单测（`tests/unit/*.test.js`）
- 4 shell 单测（`tests/unit/*.sh`）
- 2 集成测试（`tests/integration/`）
- 2 E2E 测试（`tests/e2e/`）+ 4 烟雾测试（`tests/smoke/`）
