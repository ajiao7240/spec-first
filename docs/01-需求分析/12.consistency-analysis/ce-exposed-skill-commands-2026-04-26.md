# Compound Engineering 暴露 Skill 命令说明

本文说明当前仓库安装后，用户在 Claude Code CLI 和 Codex CLI 中实际可以使用的入口。重点区分：

- **宿主 CLI 命令**：例如 `compound-plugin install`，这是 shell 里的管理命令。
- **插件用户入口**：例如 `ce-plan`、`ce-work`，这是安装插件后在 Claude/Codex 会话中使用的 skill。
- **内部 primitive**：虽然位于 `skills/` 目录中，但设计上不应展示给普通用户直接调用。

## 当前结论

`plugins/compound-engineering` 当前没有单独的 `commands/` 目录。它对用户暴露的入口主要来自：

```text
plugins/compound-engineering/skills/*/SKILL.md
```

因此，对 Claude Code 和 Codex 来说，当前 CE 的用户入口本质上是一组 skills，而不是一组独立 command 文件。

Codex 插件 manifest 中声明了：

```json
"skills": "./skills/"
```

这意味着 Codex native plugin 安装会发现该目录下的 skills。Claude Code 安装插件时也会加载插件目录中的 skills。

## 暴露入口总览

当前 `compound-engineering` 插件包含 **36 个 skill 目录**：

- **33 个** Claude 与 Codex 都可用的普通/高级 skills
- **1 个** Claude-only skill：`ce-update`
- **2 个** 内部 primitive：`ce-session-inventory`、`ce-session-extract`
- **9 个** 带 `disable-model-invocation: true`，适合手动调用或特殊场景，不适合模型自动触发

## Claude Code 与 Codex 都可用的入口

以下 skills 在当前仓库语义下可被 Claude Code 和 Codex 使用。

### 核心工作流

| Skill | 当前项目 skill | 功能 | 用户何时使用 |
|---|---|---|---|
| `ce-ideate` | `spec-ideate` | 生成和评估改进方向、候选想法、探索性方案 | 用户想要“给我一些想法”“有什么可以改进”“surprise me” |
| `ce-brainstorm` | `spec-brainstorm` | 通过对话澄清需求、收敛范围、产出 requirements | 用户有模糊需求、想先想清楚做什么 |
| `ce-plan` | `spec-plan` | 将需求或目标拆成结构化实施计划 | 已有需求/问题定义，准备进入实现前 |
| `ce-work` | `spec-work` | 执行计划或明确工作项 | 已经有 plan 或明确任务，需要改代码 |
| `ce-code-review` | `spec-code-review` | 多 persona、置信度门控、去重合并的代码评审 | 提 PR 前、实现完成后、需要质量检查 |
| `ce-debug` | `spec-debug` | 系统化复现、定位根因、修复 bug | 测试失败、线上问题、错误堆栈、issue |
| `ce-compound` | `spec-compound` | 将已解决问题沉淀为 `docs/solutions/` 知识 | 复杂问题解决后，需要复用经验 |
| `ce-compound-refresh` | `spec-compound-refresh` | 刷新、合并、替换或清理过期 learnings | `docs/solutions/` 可能过期或冲突 |
| `ce-optimize` | `spec-optimize` | 指标驱动的多轮并行优化实验 | 搜索质量、聚类质量、性能、prompt 质量等可测目标 |

### Git 与 PR 工作流

| Skill | 当前项目 skill | 功能 | 用户何时使用 |
|---|---|---|---|
| `ce-commit` | `git-commit` | 创建符合项目约定的 commit | 用户说“commit this”“保存这些改动” |
| `ce-commit-push-pr` | `git-commit-push-pr` | commit、push、创建或更新 PR | 用户说“ship this”“open a PR” |
| `ce-pr-description` | `spec-pr-description` | 生成或刷新 PR title/body | 需要单独写 PR 描述，或被 `ce-commit-push-pr` 调用 |
| `ce-resolve-pr-feedback` | `resolve-pr-feedback` | 处理 PR review comments / review threads | 用户要解决 GitHub PR 反馈 |
| `ce-clean-gone-branches` | `git-clean-gone-branches` | 清理远端已删除的本地分支 | 用户要清理 stale branches |
| `ce-worktree` | `git-worktree` | 创建隔离 worktree | 需要并行开发、隔离 review、避免污染当前 checkout |

### 研究与上下文

| Skill | 当前项目 skill | 功能 | 用户何时使用 |
|---|---|---|---|
| `ce-sessions` | `spec-sessions` | 查询 Claude Code、Codex、Cursor 历史会话 | 想知道过去做过什么、之前怎么排查过 |
| `ce-slack-research` | `spec-slack-research` | 搜索 Slack 并综合组织上下文 | 需要团队历史决策、讨论、约束背景 |

### 验证与交付辅助

| Skill | 当前项目 skill | 功能 | 用户何时使用 |
|---|---|---|---|
| `ce-demo-reel` | `feature-video` | 捕获 GIF、终端录制、截图等 PR evidence | UI/CLI/可观察行为变化需要展示证据 |
| `ce-test-browser` | `test-browser` | 对 PR 影响页面做浏览器测试 | Web 页面或交互变更需要浏览器验证 |
| `ce-test-xcode` | `test-xcode` | 使用 XcodeBuildMCP 构建和测试 iOS app | iOS 项目变更需要 simulator 验证 |

### 专项能力

| Skill | 当前项目 skill | 功能 | 用户何时使用 |
|---|---|---|---|
| `ce-agent-native-architecture` | `agent-native-architecture` | 设计 agent-native 应用架构 | 设计 agent、MCP tools、自主循环系统 |
| `ce-agent-native-audit` | `agent-native-audit` | 对 agent-native 架构做评分审查 | 需要系统性评估 agent-native 设计质量 |
| `ce-dhh-rails-style` | `spec-dhh-rails-style` | 按 DHH / 37signals 风格写 Ruby/Rails | Ruby/Rails 项目，用户要求 DHH 风格 |
| `ce-frontend-design` | `frontend-design` | 高质量前端 UI 实现与截图验证 | 页面、组件、dashboard、landing page 等 |
| `ce-doc-review` | `spec-doc-review` | 多 persona 文档/计划评审 | requirements、plan、spec 文档需要评审 |
| `ce-proof` | `proof` | 通过 Proof 协作编辑器分享、评论、编辑 markdown | 需要 human-in-the-loop 文档评审 |
| `ce-gemini-imagegen` | `gemini-imagegen` | 使用 Gemini API 生成或编辑图片 | 需要图片生成、风格迁移、mockup、logo |

### 插件维护与实验入口

| Skill | 当前项目 skill | 功能 | 用户何时使用 |
|---|---|---|---|
| `ce-setup` | `spec-setup` | 环境诊断、工具安装、项目配置初始化 | 第一次使用、换项目、工具缺失、环境异常 |
| `ce-release-notes` | `spec-release-notes` | 查询 compound-engineering release notes | 想知道最近版本变化 |
| `ce-report-bug` | `report-bug` | 报告 compound-engineering 插件 bug | 使用插件遇到问题 |
| `ce-polish-beta` | `spec-polish-beta` | 启动 dev server、打开浏览器、协同 polish | 实验性 polish 流程 |
| `ce-work-beta` | `spec-work-beta` | 实验性 Codex delegation 执行流 | 试用 Codex delegation 模式 |
| `lfg` | `lfg` | 全自动工程工作流 | 实验性端到端自动执行 |

## Claude-only 入口

| Skill | 当前项目 skill | 平台 | 原因 |
|---|---|---|---|
| `ce-update` | `spec-update` | CE 为 Claude Code only；当前项目已扩展为 Claude Code + Codex | CE frontmatter 标记了 `ce_platforms: [claude]`；当前项目保留 Claude marketplace 插件缓存版本检查，并为 Codex 增加 npm CLI 版本检查与 runtime asset refresh 指引 |

注意：仓库自己的 converter 会按 `ce_platforms` 过滤该 skill；如果某个宿主 native plugin 直接读取整个 `skills/` 目录且不理解 `ce_platforms`，理论上可能仍显示该目录。因此二开时如果要严格控制 Codex 暴露面，应该在生成/安装阶段显式过滤。

## 不建议直接展示给用户的内部入口

以下两个 skill 在目录中存在，但语义是 agent-facing primitive，不应放进用户菜单或 README 主入口：

| Skill | 当前项目 skill | 用途 | 为什么不应直接展示 |
|---|---|---|---|
| `ce-session-inventory` | `spec-session-inventory` | 发现会话文件并提取元数据 | 描述中明确为 session-research agents 调用，不面向直接用户查询 |
| `ce-session-extract` | `spec-session-extract` | 从单个 session 文件抽取 conversation skeleton 或 error signals | 描述中明确由 session-research agents 深挖时调用 |

## 手动/特殊入口

以下 skills 带 `disable-model-invocation: true`。这表示它们不适合被模型根据描述自动触发，通常应由用户显式调用，或由上层流程在明确条件下调用：

| Skill | 当前项目 skill | 建议定位 |
|---|---|---|
| `ce-agent-native-audit` | `agent-native-audit` | 高级审查入口 |
| `ce-setup` | `spec-setup` | 手动初始化/诊断入口 |
| `ce-report-bug` | `report-bug` | 手动维护入口 |
| `ce-polish-beta` | `spec-polish-beta` | 实验入口 |
| `lfg` | `lfg` | 实验入口 |
| `ce-test-xcode` | `test-xcode` | 平台专用验证入口 |
| `ce-release-notes` | `spec-release-notes` | 手动查询入口 |
| `ce-work-beta` | `spec-work-beta` | 实验入口 |
| `ce-update` | `spec-update` | CE 为 Claude-only 手动维护入口；当前项目已扩展为双端更新入口 |

## 用户认知复杂度评估

当前 CE 暴露面较大。虽然能力完整，但对普通用户有明显认知成本：

1. **入口数量过多**：36 个 skill 对初次用户不友好。
2. **层级混杂**：核心流程、维护工具、实验能力、平台专用能力、内部 primitive 位于同一层。
3. **命令边界不够直观**：例如 `ce-work`、`ce-work-beta`、`lfg` 都与执行相关；`ce-code-review` 与 `ce-doc-review` 都是 review；`ce-compound` 与 `ce-compound-refresh` 都与知识沉淀相关。
4. **平台差异外泄**：`ce-update` Claude-only，`ce-test-xcode` iOS-only，`ce-slack-research` 依赖组织 Slack 环境。
5. **内部 primitive 外泄**：`ce-session-inventory` 与 `ce-session-extract` 不应出现在普通用户可见入口中。

## 建议的产品化暴露模型

如果二开目标是降低使用门槛，建议把对外默认入口收敛成一条清晰工作流：

```text
ce-setup
  -> ce-brainstorm
  -> ce-plan
  -> ce-tasks
  -> ce-work
  -> ce-review
  -> ce-ship
  -> ce-learn
```

### 推荐默认用户入口

| 建议入口 | 对应 CE 能力 | 对应当前项目能力 | 说明 |
|---|---|---|---|
| `ce-setup` | `ce-setup`、部分 `ce-update` | `spec-setup`、部分 `spec-update` | 初始化与诊断 |
| `ce-brainstorm` | `ce-ideate`、`ce-brainstorm` | `spec-ideate`、`spec-brainstorm` | 从模糊想法到明确需求 |
| `ce-plan` | `ce-plan` | `spec-plan` | 制定技术方案 |
| `ce-tasks` | 新增或从 `ce-plan` 拆分 | 当前项目暂无独立入口，可从 `spec-plan` 拆分 | 将方案编译为可执行任务单元 |
| `ce-work` | `ce-work`、必要时 `ce-worktree` | `spec-work`、必要时 `git-worktree` | 执行任务 |
| `ce-review` | `ce-code-review`、`ce-doc-review` | `spec-code-review`、`spec-doc-review` | 检查质量 |
| `ce-debug` | `ce-debug` | `spec-debug` | 旁路 bug 修复入口 |
| `ce-ship` | `ce-commit`、`ce-commit-push-pr`、`ce-pr-description`、`ce-demo-reel` | `git-commit`、`git-commit-push-pr`、`spec-pr-description`、`feature-video` | 交付 PR |
| `ce-learn` | `ce-compound`、`ce-compound-refresh` | `spec-compound`、`spec-compound-refresh` | 沉淀经验 |

### 建议隐藏或降级为高级入口

| 当前入口 | 当前项目 skill | 建议处理 |
|---|---|---|
| `ce-pr-description` | `spec-pr-description` | 作为 `ce-ship` 内部能力，保留高级直达入口 |
| `ce-clean-gone-branches` | `git-clean-gone-branches` | 高级维护入口 |
| `ce-worktree` | `git-worktree` | 默认由 `ce-work` 按需调用 |
| `ce-compound-refresh` | `spec-compound-refresh` | 默认由 `ce-learn` 按需调用 |
| `ce-polish-beta`、`ce-work-beta`、`lfg` | `spec-polish-beta`、`spec-work-beta`、`lfg` | 实验入口，不默认展示 |
| `ce-session-inventory`、`ce-session-extract` | `spec-session-inventory`、`spec-session-extract` | 内部 primitive，不展示 |
| `ce-update`、`ce-release-notes`、`ce-report-bug` | `spec-update`、`spec-release-notes`、`report-bug` | 插件维护入口，不放主工作流 |
| `ce-slack-research`、`ce-proof`、`ce-gemini-imagegen`、`ce-test-xcode` | `spec-slack-research`、`proof`、`gemini-imagegen`、`test-xcode` | 按组织/项目能力启用 |

## Claude Code 与 Codex 使用差异

### Claude Code

Claude Code 安装插件后，skills 通常以 slash-style 入口被用户调用，例如：

```text
/ce-plan
/ce-work
/ce-code-review
```

Claude 侧还可以使用 `ce-update`，因为该 skill 专门依赖 Claude Code 插件缓存路径和 Claude 插件更新命令。

### Codex

Codex native plugin 读取 `.codex-plugin/plugin.json` 中的 `skills` 目录。当前 CE 的 skills 安装后可作为 Codex skills 使用。

但当前仓库 README 中说明：Codex native plugin 当前主要处理 skills；自定义 agents 仍需要 companion Bun converter 补充安装。因此，涉及 specialized reviewer/research agents 的能力，在 Codex 中需要同时满足：

1. Codex native plugin 已安装 skills。
2. Bun converter 已安装 CE agents。

否则，像 `ce-code-review`、`ce-plan`、`ce-work` 这类会调用 specialized agents 的流程可能出现 agent 缺失。

## 建议结论

当前 CE 的能力面很强，但默认暴露过宽。若二开目标是降低用户门槛，应采用：

1. **少量主入口**：默认只展示 8-9 个命令。
2. **底层 skill 内部化**：PR 描述、session inventory、worktree、compound refresh 等由主流程按需调用。
3. **平台能力显式分层**：Claude-only、iOS-only、Slack-only、Proof-only 不进入默认主工作流。
4. **新增 `ce-tasks` 阶段**：补齐从 plan 到 work 的粒度转换，提升执行质量和可验证性。
5. **安装阶段过滤**：不要仅依赖 skill frontmatter 描述；应在安装/生成逻辑中明确决定哪些入口对用户可见。
