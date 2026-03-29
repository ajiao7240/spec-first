# Spec-First 用户手册

这套手册对应当前 `spec-first` npm CLI 模型。

`spec-first` 不是单点命令集合，而是一套把 AI 辅助开发收敛成工程闭环的项目级工作流系统。它通过 `doctor / init --claude / clean --claude` 把 `/spec:*` 命令、workflow skills 和 agents 安装到当前项目中。

![Spec-First 总览图](../assets/svg/spec-first-overview.svg)

## 你会得到什么

- 一套稳定的 `/spec:*` 项目命令
- 一条 `Brainstorm -> Plan -> Work -> Review -> Compound` 的标准闭环
- 项目级 `.claude/commands/spec`、`.claude/skills`、`.claude/agents`
- 可更新、可恢复、可清理的受管资产模型

![Spec-First 五阶段工作流](../assets/svg/spec-first-workflow.svg)

![Spec-First 运行模型总览](../assets/svg/spec-first-runtime-assets.svg)

![三层工程概念](../assets/svg/spec-first-engineering-layers.svg)

## 阅读顺序

1. [快速开始](./01-快速开始.md)
2. [核心概念](./02-核心概念.md)
3. [完整示例](./03-完整示例.md)
4. [常见问题](./04-常见问题.md)
5. [最佳实践](./05-最佳实践.md)
6. [本地源码安装](./06-本地源码安装.md)

## 建议阅读路径

- 如果你第一次使用，先看 [快速开始](./01-快速开始.md)
- 如果你要理解运行模型和五阶段闭环，先看 [核心概念](./02-核心概念.md)
- 如果你要确认真实执行过程，看 [完整示例](./03-完整示例.md)
- 如果你在排障，看 [常见问题](./04-常见问题.md)
- 如果你在做本地调试或仓库维护，看 [本地源码安装](./06-本地源码安装.md)

## 版本

当前版本：`v1.3.10`
