---
name: s2-01-runtime-setup-outline
description: 第二季第 1 篇大纲：doctor、init 和 mcp-setup——runtime 就绪才是真正的起点
metadata:
  type: article-outline
  series: s2
  series_index: "s2-01"
---

# Spec-First：安装之后，第一件事是什么——doctor、init 和 mcp-setup

**状态：** 大纲
**内容类型：** 机制篇
**Harness 坐标：** Governance Harness（runtime 边界）

## 核心论点

工具安装完不等于可以用。runtime 就绪才是真正的起点：宿主 runtime assets 从 source 生成，MCP/helper 工具验证通过，provider 配置写入，才能进入真正的 workflow。

## Evidence Ticket

- 本地证据：`src/cli/commands/init.js`、`src/cli/commands/doctor.js`
- 本地证据：`skills/spec-mcp-setup/SKILL.md`
- 官网证据：`/Users/kuang/xiaobu/spec-first-official-website/website/docs/guide/getting-started.md`
- 官网证据：`/Users/kuang/xiaobu/spec-first-official-website/website/docs/guide/mcp-setup.md`
- 回流资产：环境就绪检查清单

## 大纲

### 1. 开场：为什么"安装完就能用"是个误解

### 2. 三个命令的分工

- `spec-first doctor`：检查当前 runtime 状态
- `spec-first init`：从 source 生成 host runtime assets
- `spec-mcp-setup`：安装并验证 MCP/helper runtime

### 3. doctor 看什么：runtime 健康度的五个维度

### 4. init 做什么：单向生成链的起点

### 5. mcp-setup 做什么：provider 配置和 helper 验证

### 6. 什么时候需要重新 init

### 7. 常见问题：legacy state、symlink 断链、drift 修复

### 8. 本篇小结：runtime 就绪是所有 workflow 的前提

## 可带走的判断

遇到 workflow 行为异常，先跑 `spec-first doctor`，再决定是否需要 `spec-first init`。
