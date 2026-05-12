# Spec-First 用户手册

这套手册对应当前 `spec-first` npm CLI 模型。

`spec-first` 不是单点命令集合，而是一套把 AI 辅助开发收敛成工程闭环的项目级工作流系统。它通过 `doctor / init (--claude|--codex) / clean (--claude|--codex)` 把 Claude Code 的 `/spec:*` 命令、Codex 的 `$spec-*` skills、workflow skills、agents、agent support files、项目级 `.developer` 和受管状态安装到当前项目中。

完成 `doctor`、`init` 和宿主重启后，轻量任务可以先走 no-graph fast path：docs-only、小 bugfix、首次试用、轻量 plan/work/review 可以直接进入匹配的 `/spec:*` 或 `$spec-*` workflow。`spec-mcp-setup`、`spec-graph-bootstrap` 和 `spec-standards` 是增强 readiness 路径，适合需要 MCP provider、graph evidence、standards baseline 或跨模块/跨仓影响分析的任务。

GitNexus / code-review-graph refresh 的默认策略是“自动 freshness check，显式 graph-bootstrap refresh”。`spec-mcp-setup` 只刷新 setup-owned provider projection；`spec-graph-bootstrap` 才写 canonical `.spec-first/graph/*`、`.spec-first/providers/*` 和 `.spec-first/impact/*` readiness artifacts。切换分支、pull、rebase、merge、dirty worktree 变化或 provider fingerprint mismatch 只会让下游 consumer 判定 stale / bootstrap-required；普通 plan/work/debug/review 不会自动运行 GitNexus analyze、provider repair、默认 hooks、watchers 或 daemons。轻量任务继续 bounded direct repo reads；graph-heavy 任务再显式运行 `spec-graph-bootstrap`。

当前推荐的事实准备、专项审查与知识沉淀入口：

- `spec-mcp-setup`：required harness runtime、MCP servers、graph providers 和 helper tools 的安装与验证入口
- `spec-graph-bootstrap`：external graph-provider readiness facts 编译入口
- [`spec-standards`](./11-项目规范与胶水基线.md)：项目规范、freshness check、bounded refresh、shared standards alignment 和 glue/reuse capability baseline 的 preview-first 编译入口
- `spec-app-consistency-audit`：移动 App 的 PRD / Figma / source / route / architecture / analytics / i18n 静态一致性审查入口
- `spec-skill-audit`：source skill 质量、治理投递、runtime drift 与安全信号审计入口
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
- 当前推荐的 graph readiness 事实入口 `spec-graph-bootstrap`、项目规范 baseline/refresh/import 入口 [`spec-standards`](./11-项目规范与胶水基线.md)、App 一致性审查入口 `spec-app-consistency-audit`、source skill 审计入口 `spec-skill-audit`，以及知识沉淀入口 `spec-compound`
- 一条 `Ideate -> Brainstorm -> Plan -> Work -> Review -> Compound` 的标准闭环
- 项目级 `.claude/commands/spec`
- 项目级 `.claude/skills`、`.claude/spec-first/workflows` 与 `.claude/agents`
- 项目级 `.agents/skills` 与 `.codex/agents`
- 项目级 `.claude/spec-first/.developer` / `.codex/spec-first/.developer`
- 严格 schema 的 `.claude/spec-first/state.json` / `.codex/spec-first/state.json`
- `init` 自动维护的 `.gitignore` spec-first managed block，用于忽略可重建 runtime 和本地 readiness facts
- 一份代码图谱 provider 作用域说明，区分 GitNexus 的全局代码知识与 code-review-graph 的变更审查影响证据
- 可更新、可恢复、可清理的受管资产模型
- 一条面向首次使用者的 workflow 走查，说明从一个需求句子到 requirements / plan / task pack 的真实产物链路
- 一份 workflow 产物目录，说明每类文档和 generated runtime assets 的生成者、读取方与 Git 边界

## 当前工程闭环

主链路可以从 `Ideate -> Brainstorm -> Plan -> Work -> Review -> Compound` 理解，但当前用户手册覆盖的是更完整的工程闭环：

```text
mcp-setup / graph-bootstrap / standards
  -> ideate
  -> brainstorm
  -> doc-review
  -> plan
  -> write-tasks
  -> work / debug / optimize / polish
  -> code-review / app-consistency-audit
  -> compound / compound-refresh / sessions / slack-research / skill-audit
  -> 反哺项目知识、文档、skills 和下一次 workflow 选择
```

这不是必须顺序执行的命令链。用户应从当前状态最匹配的节点进入；当下一步不清楚时，在宿主会话里询问即可由入口治理推荐一个公开 workflow。`write-tasks` 是 standalone skill，不是 `/spec:*` 或 `$spec-*` command-backed workflow。

当 graph readiness 缺失或过期时，轻量 workflow 可以用 bounded direct repo reads 继续，但必须把 graph evidence 视为 degraded 或 unavailable；不要把缺失 graph 包装成成功证据，也不要把 setup/bootstrap 当成所有 workflow 的硬前置。

## 支持的开发模式

当前文档按仓库拓扑区分三种开发模式：

1. 单仓单项目
2. 单仓多模块
3. 多仓工作区

核心边界是：`.spec-first` 的权威事实属于 **selected Git repo root**。单仓多模块不在每个 module 下拆多套 `.spec-first`；多仓工作区的父目录只拥有 advisory workspace summaries，不拥有 child repo 的 `.spec-first/config/*`、`.spec-first/graph/*`、`.spec-first/impact/*`、`.spec-first/providers/*` 或 `.serena/*` canonical artifacts。详见 [三种开发模式](./08-三种开发模式.md)。

## App 一致性审查

移动 App 的产品、设计和代码在进入模拟器、真机或打包验证前，可以使用专项入口做静态一致性审查：

```text
/spec:app-consistency-audit prd:<path> figma-context:<path> source:<path>
$spec-app-consistency-audit prd:<path> figma-context:<path> source:<path>
```

它适合检查 PRD、materialized Figma context、本地源码、页面路由、KMP / Clean Architecture、组件复用、埋点、i18n 和行业规则之间是否一致。审查产物写入 `.spec-first/app-audit/runs/<run-id>/`，默认是 runtime/control-plane evidence，不作为长期手工维护文档提交。

边界：

- `figma-context:<path>` 是可抽取 evidence；`figma-ref:<id-or-url>` 只是 reference。
- Figma MCP 是宿主可选能力，只在默认交互模式下用于 materialize 本地 JSON；它不是 `spec-mcp-setup` 的 required baseline。
- 缺 PRD、Figma 或 graph readiness 时应降级披露能力范围，不把缺失输入直接当作整个审查失败。

![Spec-First 五阶段工作流](../assets/svg/spec-first-workflow.svg)

![Spec-First 运行模型总览](../assets/svg/spec-first-runtime-assets.svg)

![三层工程概念](../assets/svg/three-layer-architecture.svg)

## 阅读顺序

1. [快速开始](./01-快速开始.md)
2. [首次工作流走查](./09-首次工作流走查.md)
3. [核心概念](./02-核心概念.md)
4. [完整示例](./03-完整示例.md)
5. [Workflows 与产物地图](./04-workflows-artifacts-map.md)
6. [项目规范与胶水基线](./11-项目规范与胶水基线.md)
7. [产物目录](./10-产物目录.md)
8. [Gitignore 参考](./12-gitignore参考.md)
9. [代码图谱 Provider 作用域与差异化](./13-代码图谱Provider作用域与差异化.md)
10. [常见问题](./04-常见问题.md)
11. [最佳实践](./05-最佳实践.md)
12. [三种开发模式](./08-三种开发模式.md)
13. [本地源码安装](./06-本地源码安装.md)
14. [内部培训使用讲稿](./07-内部培训使用讲稿.md)

## 建议阅读路径

- 如果你第一次使用，先看 [快速开始](./01-快速开始.md)，再看 [首次工作流走查](./09-首次工作流走查.md)
- 如果你要理解运行模型、工程闭环和 graph readiness 边界，先看 [核心概念](./02-核心概念.md)
- 如果你要建立或刷新项目规范 baseline，先看 [项目规范与胶水基线](./11-项目规范与胶水基线.md)
- 如果你要判断单仓、多模块或多仓 workspace 怎么使用，先看 [三种开发模式](./08-三种开发模式.md)
- 如果你要确认真实执行过程，看 [完整示例](./03-完整示例.md)
- 如果你要判断某个文档或 runtime 目录该不该手改、该不该提交，先看 [产物目录](./10-产物目录.md)
- 如果你要理解 GitNexus 与 code-review-graph 的分工、边界和差异化，先看 [代码图谱 Provider 作用域与差异化](./13-代码图谱Provider作用域与差异化.md)
- 如果你要给业务项目配置 `.gitignore`，先看 [Gitignore 参考](./12-gitignore参考.md)
- 如果你在排障，看 [常见问题](./04-常见问题.md)
- 如果你关注 graph readiness、runtime/control-plane 与 Git 协作边界，重点看 [核心概念](./02-核心概念.md)、[Workflows 与产物地图](./04-workflows-artifacts-map.md)、[最佳实践](./05-最佳实践.md) 和 [常见问题](./04-常见问题.md)
- 如果你在做本地调试或仓库维护，看 [本地源码安装](./06-本地源码安装.md)
- 如果你在做团队内部分享或培训，先看 [内部培训使用讲稿](./07-内部培训使用讲稿.md)

## 版本

当前版本线：`v1.8.2`

> 说明：本手册对应当前 `spec-first` 代码与运行时资产布局；遇到行为疑问时，优先以 source-of-truth 文件、CLI contract 和本手册当前章节为准。
