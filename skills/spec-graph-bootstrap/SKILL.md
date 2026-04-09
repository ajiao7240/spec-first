---
name: spec-graph-bootstrap
description: "Stage-0 graph bootstrap validation workflow. Stage 1 only guarantees install, discovery, and minimal invocation; it does not yet generate graph-informed context assets."
---

# Spec-First Graph Bootstrap

`spec-graph-bootstrap` 是新的 Stage-0 并行验证入口。

当前阶段只完成以下 contract：

- 可被 `spec-first init` 安装到 Claude / Codex runtime
- 可被宿主发现
- 可被用户显式调用
- 可清楚说明它还不是默认稳定入口

## 当前阶段边界

- `spec-bootstrap` 仍然是默认稳定入口
- `spec-graph-bootstrap` 当前只用于并行验证
- 本阶段不执行事实抽取、图谱构建、文档生成或 refresh
- 不会替代现有 `spec-bootstrap` 产物链路

## Claude / Codex 入口

- Claude command: `/spec:graph-bootstrap [target-repo-path-or-slug]`
- Codex 兼容 command: `/spec:graph-bootstrap [target-repo-path-or-slug]`
- Codex skill 入口: `$spec-graph-bootstrap [target-repo-path-or-slug]`

## 调用时的最小行为

当用户调用此 workflow 时：

1. 明确告知当前处于阶段 1 安装集成期
2. 明确告知 `spec-bootstrap` 仍是默认稳定 Stage-0 入口
3. 如果用户只是验证入口是否可用，确认入口已安装并可调用即可
4. 如果用户要真正生成项目上下文，指引其改用 `spec-bootstrap`
5. 不要伪装成已经具备 graph-informed bootstrap 能力

建议输出风格：

> `spec-graph-bootstrap` 已安装并可调用。当前仓库处于阶段 1 安装集成期，这个入口仅用于并行验证。
> 生产可用的 Stage-0 入口仍是 `spec-bootstrap`。如果你现在要为项目生成上下文，请改用 `spec-bootstrap`。

## 缺失运行时时的处理

如果当前运行时中缺少此文件，停止并提示用户先执行：

```bash
spec-first init --claude
```

或：

```bash
spec-first init --codex
```
