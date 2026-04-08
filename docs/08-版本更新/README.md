# 版本更新

本目录用于记录 `spec-first` 近期的重要能力迭代。结合当前仓库版本信息，以下内容可作为 `v1.4.0` 阶段的核心更新摘要。

## 最近更新速览

| 日期 | 类型 | 主题 | 价值 |
|------|------|------|------|
| 2026-04-08 | feat | `mcp-setup` | 增加 Windows PowerShell 7+ 支持，补齐 detect/check/install/verify 的 .ps1 入口，并把技能合同改成按平台选择脚本 |
| 2026-04-08 | fix | `mcp-setup/spec-bootstrap` | 让 MCP 安装与引导流程按当前宿主自适应，自动区分 Claude Code / Codex 的配置文件与 host-setup 标记路径，并补齐双宿主 unit 测试与文档同步 |
| 2026-04-08 | refactor | `graphify` | 全局删除 graphify skill、命令模板和运行时引用，移除 spec-first 中的 graphify 入口 |
| 2026-04-08 | fix | `mcp-setup/spec-bootstrap` | 删除 GitNexus / ABCoder 安装链与 Full mode 引用，收缩为 Serena / Sequential Thinking / Context7 基础 MCP 套件，并同步重写 host schema、验证脚本和 PRD 模板 |
| 2026-04-01 | feat | `version-reminder` | CLI 执行真实命令前自动检查 npm 最新版本，有更新时输出提醒，降低用户使用旧版本的概率 |
| 2026-04-01 | feat | `lang-governance` | `spec-first init` 将语言和 Changelog 治理规则写入 CLAUDE.md/AGENTS.md，并修复 lang 优先级（项目 > 全局 > 默认） |
| 2026-04-01 | feat | `mcp-setup` | 把 MCP 工具安装、检测、配置合并为一条一键化路径，降低 Full mode 落地门槛 |
| 2026-03-31 | fix | `spec-bootstrap` | 基于 review 结论补强原子备份、失败恢复、MCP 连接校验等关键可靠性能力 |
| 2026-03-31 | feat | `spec-bootstrap` | 新增 Stage-0 上下文引导工作流，为后续 brainstorm / plan / work / review / compound 提供稳定上下文资产 |

---

## 2026-04-08 `feat(mcp-setup)`

### 更新内容

`mcp-setup` 现在除了 bash 入口，还提供了 Windows PowerShell 7+ 的 `.ps1` 入口，覆盖依赖检测、宿主识别、工具检测、安装协调和宿主验证。

### 主要变化

- 新增 `check-deps.ps1`、`detect-host.ps1`、`detect-tools.ps1`、`install-coordinator.ps1`、`verify-tools.ps1`
- `mcp-setup` 技能文档改成按平台选择脚本
- `check-deps` 的 Windows 兜底建议改为 `winget`
- 单元测试补充 Windows 脚本文件存在性断言

### 版本意义

这次改动把 `mcp-setup` 从 Unix-only 扩展到了 Windows PowerShell 入口，降低了 Windows 用户必须依赖 Git Bash/WSL 的门槛。

---

## 2026-04-08 `fix(mcp-setup+spec-bootstrap)`

### 更新内容

`mcp-setup` 和 `spec-bootstrap` 现在按当前宿主自适应处理 MCP 配置与就绪标记，Claude Code 和 Codex 会分别使用各自的配置文件与 `host-setup.json` 路径。

### 主要变化

- `mcp-setup` 自动识别宿主并写入对应的 MCP 配置文件
- `verify-tools.sh` 输出宿主字段与 v4 schema 的 `host-setup.json`
- `spec-bootstrap` 按宿主选择 marker 和 `mcp list` 探针
- unit tests 增加 Claude / Codex 双宿主覆盖

### 版本意义

这次改动把 MCP 工具安装与后续引导彻底从 Claude-only 变成了双宿主一致的流程，减少了在 Codex 会话中误读 Claude 配置的风险。

---

## 2026-04-08 `refactor(graphify)`

### 更新内容

删除 `graphify` skill、命令模板、测试和运行时引用，移除 `spec-first` 中对 graphify 的安装与分析入口。

### 主要变化

- 删除 `skills/graphify/`
- 删除 `templates/claude/commands/spec/graphify.md`
- 删除 `tests/unit/graphify-skill.sh`
- 从 `.claude-plugin/plugin.json`、`package.json`、`tests/smoke/cli.sh`、`CLAUDE.md` 中移除 graphify 入口

### 版本意义

`spec-first` 现在只保留当前仓库实际支持的技能与工作流。删除 graphify 后，不会再有用户通过旧命令进入已废弃的 graphify 路径。

---

## 2026-04-01 `feat(version-reminder)`

### 更新内容

在执行 `doctor`、`init`、`clean` 等真实命令前，CLI 会异步向 npm registry 查询 `spec-first` 的最新版本，若当前版本落后则通过 stderr 输出一行更新提醒。`--help` 和 `--version` 不触发检查，避免打扰只需信息查询的场景。

### 主要能力

- 版本比较实现零依赖：
  内置 `compareVersions` / `parseVersion`，完整支持 semver 核心版本号与预发布标识（`-beta.1` 等），无需引入 semver 包
- 查询有超时保护：
  默认 350 ms 超时，超时或网络失败时静默跳过，不阻塞命令执行
- 支持测试环境 override：
  通过 `SPEC_FIRST_VERSION_REMINDER_LATEST` 环境变量注入版本，测试无需真实网络请求
- 提醒输出到 stderr：
  不干扰命令的 stdout 输出，脚本管道场景不受影响

### 交付物

- `src/cli/version-reminder.js` — 版本查询、比较、格式化与提醒核心逻辑
- `src/cli/index.js` — 集成点，真实命令前 await 提醒检查
- `tests/unit/version-reminder.sh` — 覆盖版本比较、格式化、CLI 接线、静默超时等场景

### 版本意义

已安装 CLI 的用户在日常使用中会自然得到更新提示，无需手动查询版本差异。对于频繁迭代的工具型项目，这类低成本的自我更新通知能有效减少用户长期停留在旧版本的情况。

---

## 2026-04-01 `feat(lang-governance)`

### 更新内容

`spec-first init` 新增两项写入能力：将语言偏好与 Changelog 治理规则以受管理块的形式写入项目的 `CLAUDE.md`（Claude 平台）或 `AGENTS.md`（Codex 平台），并修复了 lang 优先级顺序。

### 主要能力

- 幂等写入语言治理块：
  通过 `<!-- spec-first:lang:start -->` / `<!-- spec-first:lang:end -->` 标记管理，支持多次 `init` 时安全覆盖，不影响用户自行添加的其他内容
- 写入 Changelog 铁律：
  在受管理块中注入"任何源码变更必须同步在 `CHANGELOG.md` 中记录，否则拒绝生成"的 prompt 层约束
- 修正 lang 优先级：
  `--lang` CLI 参数 > 当前项目 `.developer` 的 lang > 全局 `~/.spec-first/.developer` 的 lang > 默认 `zh`；重复 `init` 时项目已有语言设置不会被全局配置意外覆盖
- 自动引导 CHANGELOG：
  若项目根目录缺少 `CHANGELOG.md`，`init` 会创建格式头和初始 bootstrap 条目；已存在时不触碰

### 交付物

- `src/cli/lang-policy.js` — 受管理块写入与幂等更新逻辑
- `src/cli/developer.js` — lang 优先级修复 + 设计意图注释
- `src/cli/commands/init.js` — 集成 `writeLangPolicy` 与 `bootstrapChangelog`
- `tests/unit/lang-policy.sh` — 语言治理块写入、幂等性、多语言切换等场景
- `tests/unit/developer.sh` — lang fallback 4 个优先级场景

### 版本意义

语言治理落地后，项目的 AI 工具不再需要依赖用户记忆或手动配置来保持语言一致性。规则由 `spec-first init` 写入指令文件，每次会话自动生效。Changelog 铁律的引入则让代码变更历史的维护从"最佳实践"升格为"可执行的 AI 层约束"。

---

## 2026-04-01 `feat(mcp-setup)`

### 更新内容

新增 `skills/mcp-setup`，提供面向 `spec-first` 工作流的 MCP 工具一键安装与配置能力。该能力覆盖依赖检查、工具探测、配置合并、可选工具安装和最终验证，目标是把原本分散的环境准备工作收敛成一条标准化流程。

### 主要能力

- 支持安装和配置 6 个 MCP 相关工具：
  `Serena`、`GitNexus`、`ABCoder`、`Sequential Thinking`、`Context7`，以及可选的 `Playwright MCP`
- 提供依赖检测与分层处理：
  自动检查 `node`、`go`、`uv`、`jq`，区分可直接安装与需要风险提示的依赖
- 支持幂等安装与配置探测：
  已存在的工具会被自动跳过，避免重复写入
- 提供原子化配置合并：
  通过备份、加锁、`jq` 校验和原子替换，把 `~/.claude.json` 的配置变更风险降到最低
- 支持安装后验证：
  会重新探测工具状态，并输出完整安装结果

### 交付物

- `skills/mcp-setup/SKILL.md`
- `skills/mcp-setup/mcp-tools.json`
- `skills/mcp-setup/scripts/check-deps.sh`
- `skills/mcp-setup/scripts/detect-tools.sh`
- `skills/mcp-setup/scripts/install-coordinator.sh`

### 版本意义

这次迭代解决的不是单个 skill 的功能问题，而是 `spec-first` Full mode 的环境落地问题。它把 MCP 准备过程标准化之后，`spec-bootstrap` 等后续工作流就有了更低的使用门槛和更稳定的前置条件。

---

## 2026-03-31 `fix(spec-bootstrap)`

### 更新内容

在 `spec-bootstrap` 首版上线后，围绕 review 反馈进行了一轮可靠性加固，重点补齐“上下文生成流程是否足够安全、可恢复、可验证”这条链路。

### 主要改进

- 补强备份原子性：
  写入前使用时间戳目录备份，并通过文件数校验避免半覆盖状态
- 明确部分失败策略：
  `summary-context` 失败时整体验证回滚，其他 worker 失败时保留部分产物并显式报告
- 强化超时约束：
  为 worker 执行增加 20 分钟建议时限，避免子任务无限拖延
- 修正 MCP 校验方式：
  改为通过 `execute_query("SELECT 1")` 判断真实数据库连通性，而不是仅判断服务存在
- 优化无阻塞 slug 决策：
  多候选上下文目录时自动选取并在总结中说明，避免人工确认卡住流程

### 版本意义

这次修复说明 `spec-bootstrap` 已经从“能跑”推进到“可作为长期工作流底座来跑”。对于要把上下文文档持续沉淀到项目内的场景，这类可靠性补强比新增表面功能更关键。

---

## 2026-03-31 `feat(spec-bootstrap)`

### 更新内容

新增 `skills/spec-bootstrap`，把它定义为 `spec-first` 五阶段主流程之前的 Stage-0 支撑工作流。它负责分析目标项目，并在 `docs/contexts/<slug>/` 下生成可长期复用的项目上下文资产。

### 主要能力

- 引入 Stage-0 上下文引导模型：
  在 brainstorm / plan / work / review / compound 之前，先沉淀项目级稳定上下文
- 支持三档分析模式：
  `Full`、`Enhanced`、`Basic`，根据 `GitNexus`、`ABCoder`、`Serena` 等工具可用性自动降级
- 支持仓库结构与分层识别：
  自动识别前端、后端、移动端、桌面端、CLI、shared、data 等层
- 支持数据库配置检测：
  面向 MySQL 提供配置识别、连通性验证和数据库上下文生成入口
- 支持 PRD 任务合同与 worker 执行模型：
  先生成任务 PRD，再由子 agent 按文件所有权分工产出上下文文档
- 提供上下文模板资产：
  包含通用 PRD 模板和数据库 PRD 模板，便于后续稳定复用

### 交付物

- `skills/spec-bootstrap/SKILL.md`
- `skills/spec-bootstrap/references/prd-template.md`
- `skills/spec-bootstrap/references/database-prd-template.md`

### 版本意义

`spec-bootstrap` 的引入，补上了 `spec-first` 过去在“冷启动项目理解”上的空档。它不是新增一个普通 skill，而是在五阶段流程之前增加了一个可复用的项目上下文生产层，让后续每次需求分析都能站在更稳定的基础上开展。

---

## 总结

这几个迭代串起来，可以看出 `spec-first` 当前版本的演进方向很明确：

- 先用 `spec-bootstrap` 补齐项目上下文基础设施
- 再用 review 驱动的修复把这套基础设施做稳
- 用 `mcp-setup` 把所需工具链安装配置标准化
- 用 `lang-governance` 让语言和变更治理规则通过指令文件自动生效
- 用 `version-reminder` 让已安装用户在日常使用中自然得到版本更新提示

整体上，这一轮更新不是零散加功能，而是在继续把 `spec-first` 从”技能集合”推进成”可落地、可复用、可持续演进的工程工作流系统”。
