# project-scaffold 依赖安装逻辑分析

> 分析日期：2026-06-03
> 分析对象：`/Users/kuang/xiaobu/project-scaffold`
> 分析方式：只读检查 `Makefile`、`scripts/**`、`.agent/project.json`、`.scale/*.json`、`.scale/config.yaml`、`.claude/settings.json`、`.claude/workflow.json`、`.codex/*`、`docs/workflow/README.md`、`AGENTS.md`
> 目标：明确 `project-scaffold` 哪些依赖会被显式安装，哪些只做 readiness 检查，哪些由 host runtime 拉起，哪些只是工具/技能候选，不应误认为默认安装清单。

---

## 结论先行

`project-scaffold` 的依赖逻辑不是“打开项目后默认安装一批依赖”，而是 **locked bootstrap + profile readiness + optional provider + degraded fallback**：

1. **唯一明确的自动安装入口是 SCALE Engine CLI**：`make bootstrap-scale-install` / `make bootstrap-scale-latest` 调用 `scripts/bootstrap-scale.ps1 -AutoInstall`，通过 `npm install -g @hongmaple0820/scale-engine@<target>` 安装全局 `scale`。
2. **默认 `make bootstrap-scale` 只检查不安装**：缺失或版本不一致时退出 `2`，打印安装命令；只有显式传 `-AutoInstall` 才改动用户环境。
3. **脚手架自身没有业务依赖清单**：项目根下未发现 `package.json`、`go.mod`、`requirements.txt`、`pyproject.toml` 等业务包清单；只有 `Makefile` 和治理脚本。依赖主要来自 shell/PowerShell/Node/Python 基础工具、SCALE CLI、host MCP、以及派生项目的业务栈。
4. **`.agent/project.json` 是验证 profile 的 required tools 来源**：当前 `scaffold` stack 需要 `bash`、`python3`；模板 stack 还声明 Go、Node、Python 项目的 `go`、`golangci-lint`、`gosec`、`npm`、`ruff`、`pytest`、`bandit` 等工具，但这些是按派生项目/服务触发，不是脚手架默认全装。
5. **`.scale/tools.json` / `.scale/skills.json` 是工具和技能治理策略，不是安装脚本**：它们声明哪些场景需要 evidence、哪些 skill recommended/required、策略为 warn，但没有执行安装。
6. **CodeGraph / Graphify 是 advisory provider**：`.scale/code-intelligence.json` 声明 `codegraph` CLI 与 `graphify-out/GRAPH_REPORT.md` artifact，并配置 `internal-scan`、`rg`、`read` fallback。缺失时应降级说明，不应阻塞轻量核心。
7. **Claude/Codex runtime hooks 会实际调用 `scale`**：`.claude/settings.json`、`.codex/hooks.json` 的 hooks 调 `scale gate ...`、`scale context inject`、`scale session end`；如果 host runtime 启用这些配置，`scale` 不只是可选工具，而是 runtime readiness 依赖。

核心借鉴：spec-first 可以吸收它的 **显式 bootstrap、版本锁、profile required tools、optionalToolsWarnOnly、provider fallback、runtime configured dependency report**；不宜照搬 `.scale` 作为 truth、全局默认安装 provider、或把 inline hook 变成不可见硬门禁。

---

## 安装逻辑总览

| 层级 | 来源 | 依赖类型 | 是否自动安装 | 缺失行为 | spec-first 借鉴判断 |
|------|------|----------|--------------|----------|---------------------|
| SCALE Engine bootstrap | `Makefile` + `scripts/bootstrap-scale.ps1` + `.scale/governance.lock.json` | `@hongmaple0820/scale-engine@0.43.0` 或 latest | 仅 `-AutoInstall` 时安装 | 默认检查失败并打印安装命令 | 可借鉴：locked + explicit auto-install |
| 脚手架自检 | `scripts/validate-config.sh`、`scripts/preflight/all.sh`、`scripts/workflow/lint-scaffold.sh`、`scripts/tests/run.sh` | `bash`、`python3`、基础 shell 工具 | 不安装 | fail-fast 或 skip | 可借鉴：required files/scripts/JSON/LF 检查 |
| 验证 profile | `.agent/project.json`、`scripts/workflow/verify.sh` | 按 stack 声明 required tools | 不安装 | `command -v` 检测缺失并跳过命令执行 | 可借鉴：profile-driven readiness |
| Quality gates | `scripts/gates/G0-G22` | `go`、`golangci-lint`、`gosec`、`node`、`git`、PowerShell 等 | 不安装 | 部分阻塞，部分 warn/skip/fallback | 可借鉴：按 level enforcement |
| Host MCP | `.claude/settings.json` | `npx -y` 拉起 MCP server | runtime 可能拉起 | 取决于 host/MCP 启动 | 可借鉴：runtime dependency inventory |
| Skill / tool policy | `.scale/tools.json`、`.scale/skills.json`、`.claude/workflow.json` | skill、browser、UI、E2E、Graphify 等候选 | 默认不安装 | warn / evidence required | 可借鉴 metadata，不借默认全装 |
| Code intelligence | `.scale/code-intelligence.json` | `codegraph`、Graphify artifact、fallback | 不安装 | fallback 到 `internal-scan`、`rg`、`read` | 可借鉴 advisory provider contract |

---

## SCALE Engine bootstrap

`Makefile` 暴露三种 bootstrap 入口：

| 命令 | 实际动作 | 安装行为 |
|------|----------|----------|
| `make bootstrap-scale` | `powershell ... scripts/bootstrap-scale.ps1 -Version locked` | 只检查，不安装 |
| `make bootstrap-scale-install` | `powershell ... scripts/bootstrap-scale.ps1 -Version locked -AutoInstall` | 安装 locked 版本 |
| `make bootstrap-scale-latest` | `powershell ... scripts/bootstrap-scale.ps1 -Version latest -AutoInstall` | 安装 latest |

`scripts/bootstrap-scale.ps1` 的确定性逻辑：

1. 读取 `.scale/governance.lock.json` 的 `scaleVersion`。
2. 当前 locked 版本为 `0.43.0`，package 为 `@hongmaple0820/scale-engine`。
3. 用 `Get-Command scale` 和 `scale --version` 检测已安装版本。
4. 版本满足时退出 `0`。
5. 未传 `-AutoInstall` 时打印安装指引并退出 `2`。
6. 传 `-AutoInstall` 时要求 `npm` 存在，执行 `npm install -g @hongmaple0820/scale-engine@<target>`。
7. 传 `-UseNpmMirror` 时追加 `--registry https://registry.npmmirror.com`。
8. locked 目标安装后再次读取 `scale --version`，不匹配则抛错。

这是一条比较好的治理边界：**检查命令默认无副作用，安装命令显式 opt-in，全局安装有版本锁，安装后做版本确认**。

对 spec-first 的直接借鉴：

- `spec-first mcp-setup` / `doctor` 可采用同样的 `check` 与 `--install` 分离。
- 默认输出 `missing`、`installed`、`mismatch`、`install_command`、`reason_code`，不静默安装。
- 对 `npx -y`、global npm、pip、go install 这类会改环境的动作，必须显式确认或 `--auto-install`。
- 安装成功只代表 tool available，不代表 provider 结论可信。

---

## 工作流升级依赖

`Makefile` 的升级相关目标全部依赖 `scale`：

| 命令 | SCALE 调用 | 依赖性质 |
|------|------------|----------|
| `make workflow-upgrade-check` | `scale upgrade check --dir .` | 需要 `scale` |
| `make workflow-upgrade-plan` | `scale upgrade plan --dir . --html` | 需要 `scale`，生成审阅计划 |
| `make workflow-upgrade-apply` | `scale upgrade apply --dir . --confirm` | 需要 `scale`，会写入 |
| `make workflow-upgrade-rollback` | `scale upgrade rollback --dir .` | 需要 `scale`，会写入 |
| `make workflow-upgrade-verify` | `scale preflight --dir . --service all --preflight-profile quick` | 需要 `scale` |

`docs/workflow/README.md` 明确建议：没有 SCALE 或版本不一致时，先 `make bootstrap-scale` 检查，再用 `make bootstrap-scale-install` 安装 locked 版本，或 `make bootstrap-scale-latest` 显式安装最新版。

借鉴判断：

- `check/plan/apply/rollback/verify` 是可借鉴的升级路径。
- `apply` 必须保持 preview-first，不能和 `check` 或 `plan` 混成一个默认动作。
- `latest` 安装应保留为显式命令，不应成为默认。

---

## 验证 profile 与 required tools

`.agent/project.json` 是验证依赖声明的核心。当前仓库的 `services.scaffold` 指向根目录，`stack=scaffold`。

### 当前 scaffold stack

| check | 命令 | required tools |
|-------|------|----------------|
| `validate` | `bash scripts/validate-config.sh` | `bash`、`python3` |
| `lint` | `bash scripts/workflow/lint-scaffold.sh` | `bash`、`python3` |
| `gates-dry-run` | `bash scripts/gates/all.sh --dry-run` | `bash` |
| `test` | `bash scripts/tests/run.sh` | `bash`、`python3` |

注意：`scripts/workflow/verify.sh --profile scaffold` 存在一个 special-case，当前不是按 `.agent/project.json` 的 `scaffold.checks=["lint"]` 执行，而是直接运行：

```bash
bash scripts/validate-config.sh
bash scripts/gates/all.sh --dry-run
```

因此 `make verify PROFILE=scaffold` 的含义更接近“配置与 gate 可调度检查”，不是完整 `lint-scaffold`。完整自测需要看 `make lint-scaffold`、`make test-scaffold` 或 `PROFILE=all`。

### 派生项目 stack 模板

| stack | detect | 典型 required tools | 安装策略 |
|-------|--------|---------------------|----------|
| `go` | `go.mod` | `go`、`golangci-lint`、`gosec` | 只检查；G4 可 fallback 到 `go vet`；G7 缺 `gosec` 时给 `go install ...` 提示 |
| `node` | `package.json` | `npm` | 只检查 `npm`；命令运行时若有 `pnpm-lock.yaml` 且 `pnpm` 可用则优先 `pnpm` |
| `python` | `pyproject.toml`、`requirements.txt`、`setup.py` | `python`、`ruff`、`pytest`、`bandit` | 只检查，不安装 |

`scripts/workflow/verify.sh` 对非 `scaffold` special-case 的处理方式是：

1. 用 Python 读取 `.agent/project.json`，按 profile/service/check 生成执行计划。
2. 对每个 check 的 `required_tools` 做 `command -v`。
3. 工具缺失时打印 `[VERIFY] missing tool ...`，设置失败状态，但不安装。
4. 工具齐备时用 `bash -lc "$command"` 执行，并写入 `.agent/logs/<service>/<check>.profile.log`。
5. Go 工具有一个 Windows 兼容特例：required tool 为 `go` 时接受 `go.exe`。

这是 spec-first 可借鉴的核心模式：**profile 决定验证面，required tools 是 readiness facts，命令执行和缺失工具必须分离记录**。

---

## Gate / preflight 隐含依赖

`project-scaffold` 的很多依赖不在安装脚本中，而藏在 gate 和 preflight 执行路径里。

| Gate / 脚本 | 依赖 | 缺失行为 |
|-------------|------|----------|
| `scripts/preflight/all.sh` | `git`、`python3`、`bash` | 缺失计入 error；调用 validate 和 gate dry-run |
| `scripts/validate-config.sh` | `bash`、`python3`、`chmod`、基础 shell | 缺 `python3` 时 JSON 校验失败 |
| `scripts/workflow/lint-scaffold.sh` | `bash`、`python3` | `bash -n` 检查脚本，`python3 -m py_compile` 检查 helper |
| `scripts/tests/run.sh` | `bash`、`python3`、`mktemp`、`grep`、`cp` | 自测缺 `python3` 的部分 test 会 skip |
| `G0` | `python3` / `python` / `py` | 缺 Python 直接失败 |
| `G1` / `G2` | `python3`、可选 `powershell` / `pwsh` | 缺 PowerShell 时 G2 只做 bash heading 检查 |
| `G3` | `git` | 非 git 仓库时 enforced 模式失败，非 enforced 可放过 |
| `G4` | `go`、可选 `golangci-lint` | 缺 Go 失败；缺 `golangci-lint` fallback 到 `go vet` |
| `G5` / `G6` | `go` | 缺 Go 失败 |
| `G7` | `gosec`、可选 `node` 或 `python3` 解析 JSON | 缺 `gosec` 时输出 `go install github.com/securego/gosec/v2/cmd/gosec@latest`；enforced 才失败 |
| `G8` | `git`、`grep` | 文档标准检查 |
| `G9` / `G10` | 可选 `scale` | 缺 `scale` 时 G10 skip；G9 仅安装后做版本一致性检查 |
| `G14` | `find`、`wc` | 检查根目录临时文件 |
| `G15` | `git` | 检查 staged runtime/cache 污染 |
| `G17` | `node` | 读取 `.scale/workspace.json`，缺 Node 会失败 |
| `G19` | `git`、`grep -P` | 检测空 catch |
| `G13/G18/G20/G21/G22` | 无实质外部依赖 | advisory pass |

借鉴判断：

- 依赖报告不能只读 `.agent/project.json`，还要扫描 gate/hook 中实际调用的工具。
- `dry-run` 只证明 gate 脚本语法可调度，不代表业务验证运行过。`project-scaffold` 自测里也专门断言 dry-run 文案不能写成 `[GATE] passed`。
- fallback 需要写清楚：例如 G4 fallback 到 `go vet` 是降级验证，不等价于 `golangci-lint run`。

---

## Host runtime 与 MCP 依赖

### Claude Code runtime

`.claude/settings.json` 当前配置 5 个 MCP server：

| MCP | 命令 |
|-----|------|
| `memory` | `npx -y @modelcontextprotocol/server-memory` |
| `filesystem` | `npx -y @anthropic/mcp-filesystem .` |
| `context7` | `npx -y @upstash/context7-mcp` |
| `fetch` | `npx -y @modelcontextprotocol/server-fetch` |
| `sequential-thinking` | `npx -y @modelcontextprotocol/server-sequential-thinking` |

`.claude/settings.json` 还允许 `Bash(pip install: *)`、`Bash(npm install: *)`、`Bash(graphify: *)`，但这是 permission surface，不是自动安装行为。

实际 hook 调用中，`scale` 是核心 runtime 依赖：

- `SessionStart`: `scale context inject --session-id $CLAUDE_SESSION_ID`
- `PreToolUse`: `scale gate pre-tool Bash ...`
- `PostToolUse`: `scale gate post-tool Edit ...`
- `Stop`: `scale gate before-stop --session-id ...`
- `SessionEnd`: `scale session end --session-id ...`

此外，PostToolUse 对 Go 文件调用 `gofmt -w "${CLAUDE_FILE_PATH}"`，Stop hook 调用 `git diff`。这些都属于 runtime hook dependency surface。

### Codex runtime

`.codex/config.toml` 设置：

- `SCALE_AGENT=codex`
- `auto_approve = ["scale *"]`

`.codex/hooks.json` 中：

- `pre-exec`: `scale gate pre-tool Bash ...`
- `post-exec`: `scale gate post-tool Bash ...`

借鉴判断：

- 如果 host runtime 已配置 hooks，`scale` 不能只标成 optional；至少应在 runtime readiness 中显示为 `configured-required`。
- MCP 的 `npx -y` 模式应报告 network/package/version pin 状态。默认拉起不等于默认全局安装，但仍是 runtime 依赖。
- permission allowlist 不等于安装计划。文档和 setup report 要分清 `allowed command`、`configured command`、`executed command`、`installed tool`。

---

## Skill / Graphify 安装建议不是默认安装链路

`.claude/workflow.json` 的 `skills.required` 中列出：

| skill | install | verify |
|-------|---------|--------|
| `superpowers` | `git clone --depth 1 --branch v2.1.0 https://github.com/obra/superpowers ~/.claude/skills/superpowers && touch ~/.claude/skills/superpowers/installed.flag` | `test -f ~/.claude/skills/superpowers/installed.flag` |
| `graphify` | `pip install graphifyy && graphify install` | `command -v graphify` |

`CONFIG_WEBSITE_OPTIMIZATION.md` 也提出过 Graphify 集成方案和 MCP 模板。但这些不是当前 `Makefile` 默认安装路径，也没有被 `scripts/bootstrap-scale.ps1` 自动执行。

更准确的分类：

- `superpowers` / `graphify` 是 skill/config proposal 或 older workflow config 中的 required skill。
- `make graphify` 只是优化文档里的建议片段，当前 `Makefile` 没有真实 `graphify` target。
- `.scale/code-intelligence.json` 使用 Graphify artifact `graphify-out/GRAPH_REPORT.md`，不是安装 Graphify。

借鉴判断：

- spec-first 可借“skill install metadata”结构，但必须有 authority 标注：`active runtime`、`checked-in proposal`、`historical config`、`generated report`。
- 不应把 `.claude/workflow.json` 中的 install 字段直接当成 setup 默认动作。
- Graphify / CodeGraph 适合做 recommended/platform profile，而不是 minimal 默认安装。

---

## Code intelligence provider 策略

`.scale/code-intelligence.json` 声明：

| provider | 类型 | 依赖 | capabilities | fallback |
|----------|------|------|--------------|----------|
| `codegraph` | external-cli | `codegraph` command | symbols、callers、callees、impact、context | 可 fallback |
| `graphify` | artifact | `graphify-out/GRAPH_REPORT.md` | summary、module-map、context | 可 fallback |
| fallback | built-in | `internal-scan`、`rg`、`read` | 直接源码证据 | enabled |

这说明 `project-scaffold` 不把代码图谱 provider 当作唯一真相源。provider 不可用时，仍允许回退到直接源码读取。

对 spec-first 的借鉴：

- provider readiness 应输出 `available / missing / stale / degraded / fallback_used`。
- provider facts 是 advisory，不能替代源码、diff、测试和人工/LLM review 判断。
- 缺 CodeGraph/Graphify 不应阻断 docs-only 或小任务；大型影响分析可提示 degraded evidence。

---

## UI / E2E / Browser 工具策略

`.scale/tools.json` 声明了工具治理面：

| 工具 | 状态 | 场景 | 命令 |
|------|------|------|------|
| `web-access` | enabled | webResearch / browserAutomation | 未声明命令 |
| `frontend-design` | enabled | ui | skill/tool capability |
| `ui-ux-pro-max` | enabled | ui | skill/tool capability |
| `agent-browser` | enabled | browserAutomation / ui / e2e | `agent-browser` |
| `playwright` | enabled | e2e / browserAutomation / ui | `npx playwright` |
| `mcp-chrome-devtools` | enabled | browserAutomation / ui / e2e | `chrome-devtools` MCP tool |
| `desktop-cua` | disabled | desktopAutomation | `cua` |
| `codex-cli` / `gemini-cli` / `opencode-cli` | disabled | externalCli / review | 对应 CLI |

`.scale/skills.json` 的 policy 为 `warn`，并要求 M/L/CRITICAL 等级有 skill plan。典型场景：

- `ui`: 推荐 `ui-ux-pro-max`、`frontend-design`、`design-review`，要求 screenshot / responsive-check。
- `e2e`: 推荐 `playwright`、`playwright-interactive`，要求 browser-run。
- `db` / `security`: 要求 `security-review`、rollback/threat-model/migration-test。
- `release`: 推荐 verification / code-review，要求 preflight。

这些不是安装指令，而是任务场景的 tool/skill/evidence policy。

借鉴判断：

- spec-first 可以借“surface-specific capability”分类：UI/E2E/DB/Security/Release 按场景触发。
- 安装前必须区分 tool command、MCP tool name、skill name、human review artifact。
- `evidenceRequired=true` 不等于工具必须默认安装；它说明使用该场景时必须留下证据。

---

## Product smoke 与 Node 隐性依赖

`.scale/product-smoke.json` 定义产品 smoke probe，但默认 `probes[].enabled=false`，且 `emptyProbeBehavior=block`。`scripts/qa/product-smoke.sh` 和 `.ps1` 用 Node 读取配置并执行 probe command：

- 缺 `.scale/product-smoke.json` 会失败。
- 没有 enabled probe 时，根据配置失败或跳过；当前配置会失败。
- enabled probe 使用 shell 执行 `probe.command`，结果写 `.agent/logs/product-smoke.json`。

这类依赖不在 `.agent/project.json` 的 scaffold required tools 中显式出现，但真实运行 product smoke 时需要 `node`。

借鉴判断：

- readiness report 应包含 `profile-specific hidden tools`：例如 product smoke 需要 Node。
- `emptyProbeBehavior=block` 是好的诚实性约束：未配置真实产品路径，不能声称 product smoke 通过。
- 但对 docs-only / scaffold self-check，不应默认运行 product smoke。

---

## 当前依赖安装清单分级

| 级别 | 依赖 | 安装/检查方式 | 是否建议 spec-first 默认安装 |
|------|------|---------------|------------------------------|
| 必要基础 | `bash`、`python3`、`git`、基础 shell 工具 | preflight / validate / verify 检查 | 不安装，只检查 |
| Bootstrap 必需 | `powershell`、`npm` | 只有运行 `make bootstrap-scale-install` 时需要 | 不默认安装；提示用户先安装 Node/npm |
| Locked CLI | `@hongmaple0820/scale-engine@0.43.0` | `npm install -g ...` | spec-first 不照搬包；可借 locked bootstrap 模式 |
| Host runtime 必需 | `scale` | Claude/Codex hooks 已配置调用 | 若启用对应 hooks，应在 runtime readiness 中标 required |
| MCP runtime | `npx` + 5 个 MCP package | Claude runtime 拉起 | 可作为 recommended/platform，不进 minimal |
| Scaffold self-check | `bash`、`python3`、可选 `node` | validate/lint/test/gate | 只检查，不安装 |
| Go 派生项目 | `go`、`golangci-lint`、`gosec` | profile/gates 检查；`gosec` 提示 go install | 按 stack 触发 |
| Node 派生项目 | `npm`，可选 `pnpm` | required tools 检查 npm；pnpm opportunistic | 按 stack 触发 |
| Python 派生项目 | `python`、`ruff`、`pytest`、`bandit` | profile 检查 | 按 stack 触发 |
| Code provider | `codegraph`、Graphify artifact | provider readiness / fallback | recommended/platform；advisory |
| UI/E2E provider | `agent-browser`、`npx playwright`、Chrome DevTools MCP | `.scale/tools.json` 场景声明 | surface-ui/e2e only |
| Skill proposals | `superpowers`、`graphify` install commands | `.claude/workflow.json` / optimization doc | 不默认；需 source/risk 审查 |

---

## 可借鉴到 spec-first 的 mcp-setup 逻辑

从 `project-scaffold` 的安装逻辑看，spec-first 的 `mcp-setup` 更适合走下面的优化方向：

1. **默认 check-only**：先输出缺什么、谁配置会调用、哪个 workflow 会受影响，不默认改环境。
2. **显式 install mode**：例如 `--install` / `--auto-install` 才执行 npm/pip/go install/npx package prefetch。
3. **版本锁与来源标注**：locked provider 给版本；latest/provider README 安装必须标 `unpinned` 或 `manual-review`。
4. **runtime configured dependency report**：扫描 host runtime 中实际会调用的 MCP、hooks、commands，区分 configured 与 merely allowed。
5. **profile 化安装**：`minimal` 不安装 CodeGraph/Graphify/GBrain；`recommended` 提供一键建议；`platform` 可团队默认安装但仍有审计。
6. **安装后验证不等于可信**：安装后只写 `tool_available=true`，provider 输出仍需 `freshness/source/confidence/fallback_used`。
7. **缺失降级要可见**：比如 CodeGraph/Graphify 缺失时写 `fallback=rg/read`，不能把 fallback 结果包装成 provider 已验证。
8. **hook 依赖一致性检查**：如果 runtime hooks 调 `scale`、`gofmt`、`git`，或 product-smoke 这类 runtime 脚本调 `node`，setup report 必须列出这些工具，而不只列 MCP。

关键边界：`project-scaffold` 的“直接启动拉起”主要发生在 `npx -y` MCP 和 active hooks 上；这不是默认安装全量依赖的理由，而是要求 setup/doctor 把 runtime 会触发的依赖透明列出来。

---

## 不建议照搬的点

| 不建议项 | 原因 |
|----------|------|
| 默认安装 `@hongmaple0820/scale-engine` 或其他全局 CLI | spec-first 不应把外部 SCALE CLI 变成自身 runtime truth |
| 把 `.scale/*.json` 当成 spec-first source-of-truth | spec-first 的 source/runtime 边界不同，`.scale` 在这里是外部项目治理配置 |
| 复制 `.claude/settings.json` inline hooks | 隐含依赖多，跨宿主难验证，容易形成不可见阻塞 |
| 把 `.claude/workflow.json` 的 skill install 当默认安装链路 | 它更像历史/host workflow 配置，不是当前 Makefile bootstrap |
| CodeGraph/Graphify/GBrain 默认全装 | provider 成本和供应链风险较高，应 profile/opt-in |
| 把 dry-run 当完整验证 | `gates/all.sh --dry-run` 只是语法可调度检查 |
| 把 permission allowlist 当 installed dependency | allow 只是允许命令，不代表安装、配置或执行过 |
| 业务 stack 工具全量安装 | Go/Node/Python 工具应由派生项目实际 stack 触发 |

---

## 本次未执行

- 未运行 `make bootstrap-scale-install`、`make bootstrap-scale-latest` 或任何安装命令。
- 未运行 `npm install -g`、`pip install`、`go install`、`npx -y` MCP 启动。
- 未运行 `scale upgrade apply`、`scale preflight`、`scale ai-os run`。
- 未启动 Claude/Codex runtime hooks 或 MCP server。
- 未验证外部 package、第三方 skill repo 或 provider 当前可安装性。

本报告只基于本地文件只读分析，适合作为 spec-first 后续完善 `mcp-setup`、provider install profile、runtime dependency report、hook dependency consistency 和 optional provider degraded mode 的设计输入。
