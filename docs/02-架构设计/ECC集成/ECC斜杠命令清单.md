# ECC Commands 斜杠命令清单

本文档基于仓库源码自动整理，扫描范围为 `commands/*.md`。

## 暴露规则

`.claude-plugin/plugin.json` 中声明了 `"commands": ["./commands/"]`，因此 `commands/` 目录下的 Markdown 命令会作为插件命令导出。根目录 `agent.yaml` 也维护了一份 `commands:` 清单，可作为 gitagent/导出表面的辅助声明。

## 统计

- 源码命令定义总数：68
- 插件安装后对外可用：68
- 出现在 `agent.yaml` commands 清单中：68

## 准确性校验

校验日期：2026-05-05。

- `commands/*.md` 当前共 68 个。
- `.claude-plugin/plugin.json` 当前声明 `"commands": ["./commands/"]`。
- `agent.yaml` 当前声明 68 个 command，且与 `commands/*.md` 文件名一一对应，没有缺失或多余项。

## 字段说明

| 字段 | 来源 | 说明 |
|---|---|---|
| 暴露状态 | `.claude-plugin/plugin.json` | `commands/` 目录整体导出，因此目录下命令对外可用 |
| 命令 | 文件名 | `commands/<name>.md` 对应 `/<name>` |
| 分类 | 分析辅助字段 | 基于命令名和描述关键词归类，不是官方元数据 |
| 描述 | 中文整理 | 基于 frontmatter `description` 和正文用途归纳的中文说明 |
| 参数提示 | frontmatter `argument-hint` | 命令可接受参数的提示；为空表示未声明 |
| agent.yaml | 根目录 `agent.yaml` | 是否出现在辅助导出清单中 |

## 斜杠命令总表

| # | 暴露状态 | 命令 | 分类 | 描述 | 参数提示 | agent.yaml | 源码路径 |
|---:|---|---|---|---|---|---|---|
| 1 | 对外可用 | `/aside` | 会话 / 记忆 / 学习 | 临时旁路工作流入口，用于把当前主任务之外的问题或想法单独处理，避免打断主线。 |  | 已声明 | `commands/aside.md` |
| 2 | 对外可用 | `/checkpoint` | 会话 / 记忆 / 学习 | 创建工作检查点，用于在重要阶段记录当前状态、验证结果和下一步。 |  | 已声明 | `commands/checkpoint.md` |
| 3 | 对外可用 | `/evolve` | 会话 / 记忆 / 学习 | 技能演进命令，用于迭代改进 skill 的提示、流程或质量。 |  | 已声明 | `commands/evolve.md` |
| 4 | 对外可用 | `/instinct-export` | 会话 / 记忆 / 学习 | 本能/行为规则导出命令，把已学习的行为模式导出为可复用配置。 |  | 已声明 | `commands/instinct-export.md` |
| 5 | 对外可用 | `/instinct-import` | 会话 / 记忆 / 学习 | 本能/行为规则导入命令，把外部规则或行为模式导入当前配置。 |  | 已声明 | `commands/instinct-import.md` |
| 6 | 对外可用 | `/instinct-status` | 会话 / 记忆 / 学习 | 本能/行为规则状态命令，查看当前已启用或已学习的行为规则。 |  | 已声明 | `commands/instinct-status.md` |
| 7 | 对外可用 | `/learn` | 会话 / 记忆 / 学习 | 学习命令，从当前或历史会话中提取可复用模式、规则或技能改进点。 |  | 已声明 | `commands/learn.md` |
| 8 | 对外可用 | `/projects` | 会话 / 记忆 / 学习 | 项目管理命令，用于查看或切换 Claude Code/ECC 项目相关上下文。 |  | 已声明 | `commands/projects.md` |
| 9 | 对外可用 | `/promote` | 会话 / 记忆 / 学习 | 晋升命令，用于把经验、规则或候选改动提升为更正式的配置/文档/技能。 |  | 已声明 | `commands/promote.md` |
| 10 | 对外可用 | `/prune` | 会话 / 记忆 / 学习 | 修剪命令，清理冗余上下文、无用配置或不再需要的工作产物。 |  | 已声明 | `commands/prune.md` |
| 11 | 对外可用 | `/resume-session` | 会话 / 记忆 / 学习 | 恢复会话命令，从保存的上下文或会话摘要继续之前的工作。 |  | 已声明 | `commands/resume-session.md` |
| 12 | 对外可用 | `/save-session` | 会话 / 记忆 / 学习 | 保存会话命令，把当前工作上下文保存为之后可恢复的会话状态。 |  | 已声明 | `commands/save-session.md` |
| 13 | 对外可用 | `/sessions` | 会话 / 记忆 / 学习 | 会话管理命令，查看、选择或管理已保存的工作会话。 |  | 已声明 | `commands/sessions.md` |
| 14 | 对外可用 | `/gan-design` | 多代理 / 自动化循环 | GAN Harness 设计命令，把需求扩展为产品规格、设计方向和评估标准。 |  | 已声明 | `commands/gan-design.md` |
| 15 | 对外可用 | `/loop-start` | 多代理 / 自动化循环 | 启动持续循环命令，让 agent 按目标反复执行、检查和推进任务。 |  | 已声明 | `commands/loop-start.md` |
| 16 | 对外可用 | `/loop-status` | 多代理 / 自动化循环 | 循环状态命令，查看持续循环的当前进度、阻塞点和下一步。 |  | 已声明 | `commands/loop-status.md` |
| 17 | 对外可用 | `/multi-backend` | 多代理 / 自动化循环 | 多代理后端开发命令，用多个 agent 并行推进后端相关任务。 |  | 已声明 | `commands/multi-backend.md` |
| 18 | 对外可用 | `/multi-frontend` | 多代理 / 自动化循环 | 多代理前端开发命令，用多个 agent 并行推进前端相关任务。 |  | 已声明 | `commands/multi-frontend.md` |
| 19 | 对外可用 | `/code-review` | 审查 / 质量 / 评估 | 代码审查命令，可审查本地未提交变更，也可传入 PR 编号或 URL 进入 GitHub PR 审查模式。 | [pr-number \| pr-url \| blank for local review] | 已声明 | `commands/code-review.md` |
| 20 | 对外可用 | `/cpp-review` | 审查 / 质量 / 评估 | C++ 代码审查命令，检查内存安全、现代 C++ 惯用法、并发和性能问题。 |  | 已声明 | `commands/cpp-review.md` |
| 21 | 对外可用 | `/cpp-test` | 审查 / 质量 / 评估 | C++ 测试命令，运行并分析 C++ 测试结果。 |  | 已声明 | `commands/cpp-test.md` |
| 22 | 对外可用 | `/flutter-review` | 审查 / 质量 / 评估 | Flutter/Dart 代码审查命令，检查 widget、状态管理、性能、无障碍和架构问题。 |  | 已声明 | `commands/flutter-review.md` |
| 23 | 对外可用 | `/go-review` | 审查 / 质量 / 评估 | Go 代码审查命令，检查 Go 惯用法、并发、错误处理和性能。 |  | 已声明 | `commands/go-review.md` |
| 24 | 对外可用 | `/go-test` | 审查 / 质量 / 评估 | Go 测试命令，运行并分析 Go 测试。 |  | 已声明 | `commands/go-test.md` |
| 25 | 对外可用 | `/harness-audit` | 审查 / 质量 / 评估 | Harness 审计命令，检查仓库中的 agents、skills、commands、hooks 和平台配置一致性。 |  | 已声明 | `commands/harness-audit.md` |
| 26 | 对外可用 | `/kotlin-review` | 审查 / 质量 / 评估 | Kotlin 代码审查命令，检查协程、Compose、KMP、架构和 Android 常见问题。 |  | 已声明 | `commands/kotlin-review.md` |
| 27 | 对外可用 | `/kotlin-test` | 审查 / 质量 / 评估 | Kotlin 测试命令，运行并分析 Kotlin/Gradle 测试。 |  | 已声明 | `commands/kotlin-test.md` |
| 28 | 对外可用 | `/learn-eval` | 审查 / 质量 / 评估 | 学习评估命令，用于评估 learn 提取出的模式是否有价值、是否应固化。 |  | 已声明 | `commands/learn-eval.md` |
| 29 | 对外可用 | `/multi-workflow` | 审查 / 质量 / 评估 | 多代理综合工作流入口，协调规划、执行、检查和整合。 |  | 已声明 | `commands/multi-workflow.md` |
| 30 | 对外可用 | `/python-review` | 审查 / 质量 / 评估 | Python 代码审查命令，检查 PEP 8、Pythonic 写法、类型提示、安全和性能。 |  | 已声明 | `commands/python-review.md` |
| 31 | 对外可用 | `/quality-gate` | 审查 / 质量 / 评估 | 质量门禁命令，在交付前运行审查、测试或检查，判断是否达到合入/发布标准。 |  | 已声明 | `commands/quality-gate.md` |
| 32 | 对外可用 | `/review-pr` | 审查 / 质量 / 评估 | PR 审查命令，读取并审查 GitHub PR 的变更、测试和风险。 |  | 已声明 | `commands/review-pr.md` |
| 33 | 对外可用 | `/rust-review` | 审查 / 质量 / 评估 | Rust 代码审查命令，检查所有权、生命周期、错误处理、unsafe 和惯用写法。 |  | 已声明 | `commands/rust-review.md` |
| 34 | 对外可用 | `/rust-test` | 审查 / 质量 / 评估 | Rust 测试命令，运行并分析 cargo test 结果。 |  | 已声明 | `commands/rust-test.md` |
| 35 | 对外可用 | `/santa-loop` | 审查 / 质量 / 评估 | Santa 方法循环命令，用持续评估和反馈循环推进任务。 |  | 已声明 | `commands/santa-loop.md` |
| 36 | 对外可用 | `/skill-health` | 审查 / 质量 / 评估 | 技能健康检查命令，评估 skill 的结构、触发条件、质量和可维护性。 |  | 已声明 | `commands/skill-health.md` |
| 37 | 对外可用 | `/test-coverage` | 审查 / 质量 / 评估 | 测试覆盖率命令，运行覆盖率检查并分析未覆盖的关键路径。 |  | 已声明 | `commands/test-coverage.md` |
| 38 | 对外可用 | `/hookify` | 工具配置 / 集成 | Hook 生成/改进命令，分析会话或需求，提炼可自动化的行为约束并生成 hook。 |  | 已声明 | `commands/hookify.md` |
| 39 | 对外可用 | `/hookify-configure` | 工具配置 / 集成 | Hookify 配置命令，用于配置 hookify 相关行为和运行参数。 |  | 已声明 | `commands/hookify-configure.md` |
| 40 | 对外可用 | `/hookify-help` | 工具配置 / 集成 | Hookify 帮助命令，说明 hookify 的用法、模式和示例。 |  | 已声明 | `commands/hookify-help.md` |
| 41 | 对外可用 | `/hookify-list` | 工具配置 / 集成 | Hookify 列表命令，用于列出已配置或可用的 hookify 规则/钩子。 |  | 已声明 | `commands/hookify-list.md` |
| 42 | 对外可用 | `/jira` | 工具配置 / 集成 | Jira 集成命令，用于读取、分析或推进 Jira 任务相关工作流。 |  | 已声明 | `commands/jira.md` |
| 43 | 对外可用 | `/model-route` | 工具配置 / 集成 | 模型路由命令，按任务复杂度、成本和质量需求选择合适模型策略。 |  | 已声明 | `commands/model-route.md` |
| 44 | 对外可用 | `/pm2` | 工具配置 / 集成 | PM2 进程管理命令，用于管理后台服务、开发服务器或长期运行进程。 |  | 已声明 | `commands/pm2.md` |
| 45 | 对外可用 | `/setup-pm` | 工具配置 / 集成 | 包管理器设置命令，检测或配置 npm、pnpm、yarn、bun 等项目包管理器偏好。 |  | 已声明 | `commands/setup-pm.md` |
| 46 | 对外可用 | `/update-codemaps` | 文档 / 代码地图 | 代码地图更新命令，生成或刷新项目结构、依赖和关键路径文档。 |  | 已声明 | `commands/update-codemaps.md` |
| 47 | 对外可用 | `/update-docs` | 文档 / 代码地图 | 文档更新命令，根据代码变化更新 README、指南或项目文档。 |  | 已声明 | `commands/update-docs.md` |
| 48 | 对外可用 | `/auto-update` | 构建 / 测试 / 修复 | 自动更新 ECC 或相关配置的命令入口，用于检查并应用可用更新。 |  | 已声明 | `commands/auto-update.md` |
| 49 | 对外可用 | `/build-fix` | 构建 / 测试 / 修复 | 构建修复命令，定位并修复构建、类型检查或编译失败。 |  | 已声明 | `commands/build-fix.md` |
| 50 | 对外可用 | `/cpp-build` | 构建 / 测试 / 修复 | C++ 构建命令，运行 C++ 项目的构建流程并处理常见构建失败。 |  | 已声明 | `commands/cpp-build.md` |
| 51 | 对外可用 | `/flutter-build` | 构建 / 测试 / 修复 | Flutter/Dart 构建命令，运行分析、编译和依赖检查。 |  | 已声明 | `commands/flutter-build.md` |
| 52 | 对外可用 | `/flutter-test` | 构建 / 测试 / 修复 | Flutter/Dart 测试命令，运行并分析 Flutter 或 Dart 测试。 |  | 已声明 | `commands/flutter-test.md` |
| 53 | 对外可用 | `/gan-build` | 构建 / 测试 / 修复 | GAN Harness 构建命令，通过生成器和评估器循环实现并验证目标。 |  | 已声明 | `commands/gan-build.md` |
| 54 | 对外可用 | `/go-build` | 构建 / 测试 / 修复 | Go 构建命令，运行 go build/go vet 等检查并修复失败。 |  | 已声明 | `commands/go-build.md` |
| 55 | 对外可用 | `/gradle-build` | 构建 / 测试 / 修复 | Gradle 构建命令，用于 Java/Kotlin/Android 项目的构建与错误分析。 |  | 已声明 | `commands/gradle-build.md` |
| 56 | 对外可用 | `/kotlin-build` | 构建 / 测试 / 修复 | Kotlin/Gradle 构建命令，运行构建并分析 Kotlin 编译或依赖问题。 |  | 已声明 | `commands/kotlin-build.md` |
| 57 | 对外可用 | `/rust-build` | 构建 / 测试 / 修复 | Rust 构建命令，运行 cargo build/check 并分析编译或依赖问题。 |  | 已声明 | `commands/rust-build.md` |
| 58 | 对外可用 | `/feature-dev` | 规划 / 研发流程 | 功能开发工作流入口，围绕需求、实现、验证和交付推进标准开发流程。 |  | 已声明 | `commands/feature-dev.md` |
| 59 | 对外可用 | `/multi-execute` | 规划 / 研发流程 | 多代理执行命令，按计划分派多个 agent 并行执行任务。 |  | 已声明 | `commands/multi-execute.md` |
| 60 | 对外可用 | `/multi-plan` | 规划 / 研发流程 | 多代理规划命令，使用多个 agent 从不同角度生成或评审实施计划。 |  | 已声明 | `commands/multi-plan.md` |
| 61 | 对外可用 | `/plan` | 规划 / 研发流程 | 规划命令，在写代码前复述需求、评估风险、拆分步骤，并等待用户确认后再执行。 |  | 已声明 | `commands/plan.md` |
| 62 | 对外可用 | `/prp-commit` | 规划 / 研发流程 | PRP 流程提交命令，围绕产品需求提示完成提交准备。 | [target description] (blank = all changes) | 已声明 | `commands/prp-commit.md` |
| 63 | 对外可用 | `/prp-implement` | 规划 / 研发流程 | PRP 流程实现命令，根据 PRP 规格执行具体实现。 | <path/to/plan.md> | 已声明 | `commands/prp-implement.md` |
| 64 | 对外可用 | `/prp-plan` | 规划 / 研发流程 | PRP 流程规划命令，把需求转化为可执行的 PRP 实施计划。 | <feature description \| path/to/prd.md> | 已声明 | `commands/prp-plan.md` |
| 65 | 对外可用 | `/prp-pr` | 规划 / 研发流程 | PRP 流程 PR 命令，准备或创建与 PRP 相关的拉取请求材料。 | [base-branch] (default: main) | 已声明 | `commands/prp-pr.md` |
| 66 | 对外可用 | `/prp-prd` | 规划 / 研发流程 | PRP 流程 PRD 命令，生成或完善产品需求文档。 | [feature/product idea] (blank = start with questions) | 已声明 | `commands/prp-prd.md` |
| 67 | 对外可用 | `/refactor-clean` | 通用 / 其他 | 重构清理命令，移除死代码、重复代码和不必要复杂度。 |  | 已声明 | `commands/refactor-clean.md` |
| 68 | 对外可用 | `/skill-create` | 通用 / 其他 | 技能创建命令，根据需求或历史实践生成新的 Claude Code skill。 |  | 已声明 | `commands/skill-create.md` |
