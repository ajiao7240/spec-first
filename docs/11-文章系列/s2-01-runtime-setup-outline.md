---
name: s2-01-env-ready-outline
description: 第二季第 1 篇大纲：开始第一个任务之前的三件事——doctor/init/mcp-setup + graph-bootstrap
metadata:
  type: article-outline
  series: s2
  series_index: "s2-01"
---

# Spec-First：开始第一个任务之前，你需要做这三件事

**状态：** 大纲
**内容类型：** 机制篇
**Harness 坐标：** Governance Harness（runtime 边界）+ Context Harness（代码事实）

## 核心论点

"装完就能用"是最常见的误解。spec-first 需要三件事就绪才能真正开始工作：runtime 从 source 生成（init）、MCP/helper 工具验证通过（mcp-setup）、代码图谱 readiness facts 写入（graph-bootstrap）。三件事有顺序依赖，缺一不可。

## Evidence Ticket

- 本地证据：`src/cli/commands/init.js`、`src/cli/commands/doctor.js`
- 本地证据：`skills/spec-mcp-setup/SKILL.md`
- 本地证据：`skills/spec-graph-bootstrap/SKILL.md`
- 本地证据：`.spec-first/graph/graph-facts.json`（freshness_state、limitations、capabilities）
- 官网证据：`/Users/kuang/xiaobu/spec-first-official-website/website/docs/guide/getting-started.md`
- 官网证据：`/Users/kuang/xiaobu/spec-first-official-website/website/docs/guide/mcp-setup.md`
- 官网证据：`/Users/kuang/xiaobu/spec-first-official-website/website/docs/guide/graph-bootstrap.md`
- 回流资产：环境就绪三步检查清单

## 大纲

### 1. 开场：为什么"装完就能用"是个误解

### 2. 第一件事：doctor + init——让 runtime 从 source 生成

- `spec-first doctor`：检查当前 runtime 状态
- `spec-first init`：从 source 生成 host runtime assets
- source/runtime 边界：为什么不能手改 `.claude/` 和 `.agents/skills/`
- 什么时候需要重新 init

### 3. 第二件事：mcp-setup——让 MCP/helper 工具就绪

- mcp-setup 做什么：安装并验证 required MCP servers、graph providers、helper tools
- setup facts 写入 `.spec-first/config/`
- 常见问题：provider 配置失败、helper 工具缺失

### 4. 第三件事：graph-bootstrap——让 AI 知道你的代码库

- graph-bootstrap 产出什么：readiness facts 而不是"代码地图"
- `graph-facts.json` 的关键字段：freshness_state、limitations、capabilities
- 四种 freshness 状态：fresh / dirty-advisory / stale / query-unverified
- definitions-only 是什么意思：能用和不能用的边界
- 图谱不可用时如何降级

### 5. 三件事的顺序和依赖关系

```
spec-first init
  → spec-mcp-setup（依赖 init 产出的 runtime）
  → spec-graph-bootstrap（依赖 mcp-setup 产出的 provider 配置）
```

### 6. 什么时候需要重新做

- 升级 spec-first 版本后
- 换宿主（Claude Code ↔ Codex）
- 代码库有大量变更后（graph-bootstrap）
- MCP 工具配置变化后（mcp-setup）

### 7. 本篇小结：就绪是所有 workflow 的前提

## 可带走的判断

遇到 workflow 行为异常，先跑 `spec-first doctor`，再按顺序重做三件事。
