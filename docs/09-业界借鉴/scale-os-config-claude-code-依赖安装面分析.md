# scale-os-config-claude-code 依赖安装面分析

> 分析日期：2026-06-03
> 分析对象：`/Users/kuang/xiaobu/scale-os-config-claude-code`
> 分析方式：只读检查 `INSTALL-GUIDE.md`、`.claude/settings.json`、`.agent/project.json`、`.agent/report.json`、`.scale/skills-registry.json`、`SCALE-REPORT.md` 和 `scripts/**`
> 目标：明确这套 Claude Code 配置会涉及哪些依赖安装，哪些是真正会被 runtime 配置调用，哪些只是 registry 候选，哪些不应默认安装进 spec-first

---

## 结论先行

`scale-os-config-claude-code` 不是一个简单的三件套安装包。GBrain / Graphify / CodeGraph 只是其知识与代码理解方向的核心候选依赖；从配置包实际内容看，依赖安装面至少分成六类：

1. **SCALE Engine CLI**：安装指引明确推荐全局安装 `@hongmaple0820/scale-engine`，并运行 `scale init --agent claude-code --scenario critical`、`scale doctor`。
2. **Claude runtime 已配置 MCP**：`.claude/settings.json` 已配置 7 个 MCP server，会通过 `npx -y` 在运行时拉起。
3. **项目验证 required tools**：`.agent/project.json` 当前 stack 为 `go`，要求 `pnpm`、`go`、`golangci-lint`、`gosec`、`jq`。
4. **Skill registry 候选依赖**：`.scale/skills-registry.json` 有 177 条记录，其中 65 条 `installable`、112 条 `reference`。这些不是默认全装清单，而是按任务触发、安装前审查的候选 registry。
5. **Hook / gate 隐含工具**：settings hooks 和 scripts 依赖 `bash`、`node`、`grep`、`find`、`head`、`tail` 等基础工具；PostToolUse hook 里还直接调用了 `ruff check`，但当前 `.agent/project.json` 顶层 required tools 未把 `ruff` 列入 go stack 必需工具。
6. **场景型外部工具**：Agent Browser、OpenCLI、web-access、awesome-design-md、ui-ux-pro-max、Matt Pocock skills、Agent Skills、MCP provider、role preset 等仅应按任务和安全审查 opt-in。

核心判断：如果 spec-first 借鉴这套依赖策略，应该借它的 **registry metadata + install safety + runtime capability report + not-run disclosure**，不应照搬"177 个技能可见 + 大量 reference 安装方式 + 全局安装命令"为默认路径。

---

## 证据摘要

| 证据文件 | 关键事实 | 判断 |
|----------|----------|------|
| `INSTALL-GUIDE.md` | 推荐 `npm install -g @hongmaple0820/scale-engine`，再 `scale init --agent claude-code --scenario critical`、`scale doctor`；列出大量已选技能与 MCP | 指南层安装面很宽，但不是自动执行脚本 |
| `.claude/settings.json` | 配置 7 个 MCP server：memory、filesystem、fetch、sequential-thinking、playwright、context7、postgres | 这是最接近"runtime 会调用"的依赖面 |
| `.agent/project.json` | 顶层 required tools：`pnpm`、`go`、`golangci-lint`、`gosec`、`jq`；同时内置 node/python/rust/cpp/java/dotnet/generic stack 模板 | 当前项目验证依赖与模板依赖需要分开 |
| `.scale/skills-registry.json` | 177 entries；65 installable，112 reference；风险标记：unknown-source 96、manual-review 76、installer-script 20、global-install 8 | registry 是候选能力库，不是默认安装清单 |
| `SCALE-REPORT.md` | Must Run：`validate-config.sh`、`tests/run.sh`、`gates/all.sh --dry-run`、`workflow/verify.sh default`；Unsupported none | 生成报告给出验证入口，但没有安装依赖 |
| `scripts/**` | gates/verify 脚本通过 `bash -lc` 执行项目命令；validate/tests 用 `node` 解析 JSON；安全 gate 用 grep/find/head | 脚本依赖基础 shell 工具和 Node |

---

## 会被 runtime 配置拉起的 MCP

`.claude/settings.json` 中实际配置的 MCP server 如下。这些不是 registry 中"可能安装"的条目，而是 Claude Code 运行时配置已经声明的服务：

| 名称 | 命令 |
|------|------|
| memory | `npx -y @modelcontextprotocol/server-memory` |
| filesystem | `npx -y @modelcontextprotocol/server-filesystem ./Java_Spring_Boot` |
| fetch | `npx -y @modelcontextprotocol/server-fetch` |
| sequential-thinking | `npx -y @modelcontextprotocol/server-sequential-thinking` |
| playwright | `npx -y @playwright/mcp` |
| context7 | `npx -y @upstash/context7-mcp` |
| postgres | `npx -y @modelcontextprotocol/server-postgres` |

借鉴判断：

- 这些 MCP 可以作为 `platform` profile 的默认推荐集，但不应全部进入 spec-first 轻量核心。
- `postgres` 需要连接串和权限边界；默认配置不应无凭据启动后再让 agent 猜。
- `filesystem` 绑定了 `./Java_Spring_Boot`，说明该配置是特定项目投影；spec-first 不能复制固定路径。
- `npx -y` 是运行时拉取/执行模式，必须在报告中标注 package name、version pin 状态、network dependency、失败 fallback。

---

## 当前项目验证 required tools

`.agent/project.json` 顶层当前 `stack` 为 `go`，但项目命令混合了 `pnpm` 与 Go 工具：

| 用途 | 工具 | 命令来源 |
|------|------|----------|
| build | `pnpm` | `pnpm build` |
| lint | `golangci-lint` | `golangci-lint run --out-format=json > .agent/logs/lint.json` |
| test | `go` | `go test ./... -race -json > .agent/logs/test.json` |
| typecheck | `pnpm` | `pnpm tsc --noEmit` |
| coverage | `go` | `go test -coverprofile=.agent/logs/coverage.out ./...` |
| security | `gosec`、`jq` | `gosec -fmt json -out .agent/logs/gosec.json ./...` |

隐含依赖：

- `scripts/validate-config.sh` 和 `scripts/tests/run.sh` 需要 `node` 解析 JSON。
- `scripts/gates/*` 需要 `bash`、`grep`、`find`、`head` 等常见 shell 工具。
- `.claude/settings.json` 的 PostToolUse hook 调用 `ruff check "$FILEPATH"`，但当前 go stack 顶层 required tools 没列 `ruff`。这属于配置不一致风险：hook 可执行面和 required tools 声明没有完全对齐。

借鉴判断：

- spec-first 可借 `required_tools` / `verification_profiles` 的声明方式。
- 但必须补 "hook-required tools" 检查，避免 runtime hook 调了一个未声明、未安装、不可降级的工具。
- 验证依赖必须按当前 stack 计算，不应把 `.agent/project.json` 内所有 stack 模板工具都当作当前项目必装。

---

## Skill registry 安装面

`.scale/skills-registry.json` 统计结果：

| 维度 | 统计 |
|------|------|
| 总 entries | 177 |
| status = `installable` | 65 |
| status = `reference` | 112 |
| tier = `core` | 23 |
| tier = `recommended` | 52 |
| tier = `optional` | 102 |
| riskFlag = `unknown-source` | 96 |
| riskFlag = `manual-review` | 76 |
| riskFlag = `installer-script` | 20 |
| riskFlag = `global-install` | 8 |

高风险安装模式：

| 风险 | 代表命令 |
|------|----------|
| global install | `npm install -g openwolf`、`npm install -g agent-browser`、`npm install -g @hongmaple0820/scale-engine` |
| installer script | `./scripts/install.sh --tool claude-code`、ECC full profile installer |
| reference-only install | "参照 xxx README 安装"、"参照官方文档安装" |
| host plugin install | `/plugin marketplace add ...`、`/plugin install ...` |
| unpinned npx | `npx skills@latest add ...`、`npx code-review-graph install` |

这份 registry 的价值不在于"一次性全装"，而在于：

- 给每个 skill/tool 一条 metadata：id、name、category、tier、sourceRepo、trigger、safety、installCommand、riskFlags、recommendedAction。
- 任务开始时只读 metadata，按 trigger 选择最小能力集。
- 安装前审查 source、脚本、postinstall、网络下载、二进制、全局安装和权限。
- 中高风险任务在 summary 中记录 skills_used、tool_outputs、skipped_reason。

---

## 知识 / 记忆 / 代码理解相关候选

| 依赖 | registry 状态 | 安装方式 | 判断 |
|------|---------------|----------|------|
| OpenWolf | installable / recommended；重复出现两条 | `npm install -g openwolf && openwolf init` 或参考 README | memory/context 优化候选；global install 需版本锁定 |
| GBrain | installable / core | 参考 GBrain README | 长期记忆候选；默认写入必须关闭或走 candidate -> review |
| MemOS | installable / recommended | 参考 MemOS README | 可选 persistent memory；不应作为 spec-first truth |
| Graphify | reference / recommended | `pip install graphifyy && graphify install` | 代码/知识图谱候选；这里是 reference，不是当前配置自动安装 |
| CodeGraph | installable / core | 参考 CodeGraph README | 代码图谱候选；unknown-source + manual-review，需要 freshness/degraded 标注 |
| code-review-graph | installable / recommended | `npx code-review-graph install` | 大型 code review 候选；不应替代源码 diff 与 reviewer 判断 |

借鉴判断：

- `recommended` profile 可以强推荐 memory provider + code provider，但安装必须 preview-first。
- `platform` profile 可以团队默认安装这些 provider，但 provider facts 仍必须是 advisory。
- 与源码、diff、测试结果冲突时，provider 结论必须降级。

---

## Web / 浏览器 / UI 相关候选

| 依赖 | registry 状态 | 安装方式 | 判断 |
|------|---------------|----------|------|
| Agent Browser | installable / recommended | `npm install -g agent-browser` | 浏览器自动化强能力；global install，适合 UI/E2E profile |
| OpenCLI | installable / optional | `npx opencli setup` | 网站/桌面自动化候选；场景触发 |
| web-access | reference / optional | clone 到 `~/.claude/skills/web-access` | Web research 候选；不应默认安装 |
| awesome-design-md | reference / optional | clone 到 `~/.claude/skills/awesome-design-md` | UI/设计文档候选；按 UI 任务触发 |
| ui-ux-pro-max-skill | reference / optional | clone 到 `~/.claude/skills/ui-ux-pro-max` | UI/UX 审查候选；按 UI 任务触发 |
| html-anything | installable / optional | clone + `pnpm install` | 文档/HTML 生成候选；不属于核心 harness |
| animejs | installable / recommended | `npm install animejs` | 前端项目依赖，不应由 harness 默认安装进业务项目 |

借鉴判断：

- 这些能力应进入 `surface-specific` profile，而不是 knowledge provider profile。
- UI/browser 工具要和具体验证目标绑定：截图、DOM、console/network、E2E path，而不是"装了就算验证过"。

---

## 推荐安装分层

如果把这套配置思想收敛到 spec-first，建议采用以下安装 profile：

| Profile | 默认安装 / 配置 | 说明 |
|---------|-----------------|------|
| `minimal` | 不安装外部 provider；只检查 `node`、`bash`、`rg`、git、项目自身 test/lint 命令 | spec-first 轻量核心；适合个人和低风险项目 |
| `recommended` | 检测并推荐：SCALE-like runtime report、7 类 MCP 中的 memory/fetch/context7/sequential-thinking、一个 memory provider、一个 code provider | 用户显式确认后安装；所有 provider facts advisory |
| `platform` | 团队 profile 默认安装 MCP set、memory/code provider、browser evidence tool、skill registry metadata、自检脚本 | 面向组织级 agent platform；必须有版本锁定、审计和降级策略 |
| `surface-ui` | Playwright MCP、Agent Browser、Chrome DevTools MCP、UI/design skills | 只在 UI/浏览器验证任务触发 |
| `surface-data/security` | postgres MCP、gosec、dependency audit、security lens | 只在数据库/安全/发布任务触发，需凭据和权限边界 |

---

## 不建议照搬进 spec-first 的点

| 不建议项 | 原因 |
|----------|------|
| 把 177 个 registry 条目作为默认安装清单 | 上下文污染、供应链风险、安装面过大，且多数为 reference |
| 默认全局安装 CLI | `npm install -g` / `brew install` / `cargo install` 改变用户环境，需显式确认和版本锁定 |
| 把 `.scale/workflow.json` 作为任务状态 truth | 与 spec-first 的 LLM-driven workflow 和 source/runtime 边界冲突 |
| 复制 `.claude/settings.json` 中大段 inline shell hooks | hook 逻辑难测、隐含依赖多、跨宿主不可移植 |
| 把 MCP/provider 输出作为 confirmed truth | provider 可能 stale、缺权限、缺索引或与源码冲突 |
| 让前端业务依赖由 harness 默认安装 | 如 `animejs` 应由业务项目需求决定，不应由治理脚手架注入 |

---

## spec-first 可借鉴的最小落地

1. **依赖安装分析报告**：`doctor/setup` 输出 installed / missing / recommended / optional / unsupported / degraded。
2. **Provider profile**：`minimal` / `recommended` / `platform`，并允许项目级覆盖。
3. **Registry metadata**：只保留 id/name/category/tier/source/trigger/installCommand/riskFlags/recommendedAction，不加载 SKILL 全文。
4. **Install safety gate**：安装前检查 global install、installer script、unknown source、network download、postinstall、lockfile change。
5. **Runtime configured dependency check**：检查 `.claude/settings.json` / host runtime 中真正会调用的 MCP、hook 和 command 是否有声明依赖。
6. **Hook dependency consistency**：hook 调用的工具必须进入 required/degraded 报告；例如本配置中的 `ruff` 隐含依赖。
7. **Evidence posture**：安装成功只说明 provider available，不说明结果可信；workflow 消费时仍要标 freshness、source、confidence、fallback_used。

---

## 本次未执行

- 未运行任何安装命令。
- 未运行 `scale init`、`scale doctor` 或 registry 中的 `installCommand`。
- 未启动 MCP server。
- 未验证 registry 中第三方仓库是否仍可用或安装命令是否最新。

本报告只基于本地文件只读分析，适合作为 spec-first 后续设计 `provider install profile`、`skill registry metadata`、`runtime dependency report` 和 `install safety lens` 的输入。
