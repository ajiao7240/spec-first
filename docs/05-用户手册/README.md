# Spec-First 用户手册

这套手册对应当前 `spec-first` npm CLI 模型。

`spec-first` 不是单点命令集合，而是一套把 AI 辅助开发收敛成工程闭环的项目级工作流系统。它通过 `doctor / init (--claude|--codex) / clean (--claude|--codex)` 把 Claude Code 的 `/spec:*` 命令、Codex 的 `$spec-*` skills、workflow skills、agents、agent support files、项目级 `.developer` 和受管状态安装到当前项目中。

当前推荐的事实准备与知识沉淀入口：

- `spec-graph-bootstrap`：CRG 图索引与 query-first 决策输入入口
- `spec-compound`：工作完成后的稳定知识捕获入口

当前功能状态：

- `spec-first init --claude / --codex`：已支持
- `spec-first doctor`：支持自动检测，也支持 `--claude` / `--codex`
- `spec-first clean --claude / --codex`：已支持

`init` 支持显式传入 `-u/--user` 和 `--lang`。如果没有传用户名，它会优先回退到全局 `~/.spec-first/.developer`，再回退到 `git config user.name`。

关于升级：

- 如果 `doctor` 报告 `legacy managed state`，直接重新运行对应平台的 `spec-first init`
- `init` 会执行 managed hard reset 并按当前版本全量重建运行时
- `clean` 只清理当前受管资产，不承担 legacy 迁移

![Spec-First 总览图](../assets/svg/spec-first-overview.svg)

## 你会得到什么

- 一个前置的 `/spec:ideate` 候选发散入口
- Claude Code 的 `/spec:*` 命令入口
- Codex 的 `$spec-*` skill 入口
- 当前推荐的 CRG 事实入口：`spec-graph-bootstrap`，以及知识沉淀入口 `spec-compound`
- 一条 `Ideate -> Brainstorm -> Plan -> Work -> Review -> Compound` 的标准闭环
- 项目级 `.claude/commands/spec`
- 项目级 `.claude/skills`、`.claude/spec-first/workflows` 与 `.claude/agents`
- 项目级 `.agents/skills` 与 `.codex/agents`
- 项目级 `.claude/spec-first/.developer` / `.codex/spec-first/.developer`
- 严格 schema 的 `.claude/spec-first/state.json` / `.codex/spec-first/state.json`
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
7. [内部培训使用讲稿](./07-内部培训使用讲稿.md)

## 建议阅读路径

- 如果你第一次使用，先看 [快速开始](./01-快速开始.md)
- 如果你要理解运行模型和前置 ideate + 五阶段闭环，先看 [核心概念](./02-核心概念.md)
- 如果你要确认真实执行过程，看 [完整示例](./03-完整示例.md)
- 如果你在排障，看 [常见问题](./04-常见问题.md)
- 如果你关注 CRG 图索引、runtime/control-plane 与 Git 协作边界，重点看 [核心概念](./02-核心概念.md)、[最佳实践](./05-最佳实践.md) 和 [常见问题](./04-常见问题.md)
- 如果你在做本地调试或仓库维护，看 [本地源码安装](./06-本地源码安装.md)
- 如果你在做团队内部分享或培训，先看 [内部培训使用讲稿](./07-内部培训使用讲稿.md)

## 版本

当前版本：`v1.5.1`
