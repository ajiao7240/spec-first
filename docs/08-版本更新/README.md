# 版本更新

本目录用于记录 `spec-first` 近期的重要能力迭代。结合当前仓库版本信息，以下内容可作为 `v1.4.0` 阶段的核心更新摘要。

## 最近更新速览

| 日期 | 类型 | 主题 | 价值 |
|------|------|------|------|
| 2026-04-01 | feat | `mcp-setup` | 把 MCP 工具安装、检测、配置合并为一条一键化路径，降低 Full mode 落地门槛 |
| 2026-03-31 | fix | `spec-bootstrap` | 基于 review 结论补强原子备份、失败恢复、MCP 连接校验等关键可靠性能力 |
| 2026-03-31 | feat | `spec-bootstrap` | 新增 Stage-0 上下文引导工作流，为后续 brainstorm / plan / work / review / compound 提供稳定上下文资产 |

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
- 最后用 `mcp-setup` 把所需工具链安装配置标准化

整体上，这一轮更新不是零散加功能，而是在继续把 `spec-first` 从“技能集合”推进成“可落地、可复用、可持续演进的工程工作流系统”。
