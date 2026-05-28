---
title: Skill / Agent Audit Fix Log
date: 2026-05-05
branch: leo-2026-05-05-update-self
source_commit_at_start: fa49220c
mode: append-per-fix
---

# Skill / Agent Audit Fix Log

本文件记录本轮 skill / agent 审计后的逐项修复。每修复一个问题，就追加一条独立记录；审计脚本信号、语义判断、修复范围、验证和剩余风险必须分开写。

## 追加规则

- 每条记录只覆盖一个已确认修复问题。
- 脚本发现的信号必须标明是否为 confirmed、downgraded 或 false positive。
- 修复只能改 source-of-truth；不得手改 `.claude/`、`.codex/`、`.agents/skills/` runtime mirrors。
- 脚本只提供事实和检测信号；是否构成能力缺口或修复完成由 LLM / review 判断。
- 每条记录必须写明验证状态；如果验证仍在运行，先标记 `pending`，结果出来后追加验证更新。

## FIX-001: 移除 setup dependency suggestion 中的远程脚本直通 shell 建议

### 时间

2026-05-05 15:37:30 +0800

### 审计信号

- 来源：`.spec-first/audits/skill-audit/latest/security-risk-report.json`
- 原始等级：P0
- 原始标题：`Remote script pipe execution`
- 命中文件：
  - `skills/spec-mcp-setup/scripts/check-deps.sh`
  - `skills/spec-mcp-setup/scripts/check-deps.ps1`

### 语义判断

Confirmed issue。命中的字符串是 dependency checker 返回的 `install_suggestion`，不是自动执行路径；但它会把 `curl | bash/sh` 和 `irm | iex` 作为可复制建议暴露给用户，仍然会鼓励远程脚本未经检查直接进入 shell。该问题应修复，但不需要新增 skill、agent、script 或 runtime workflow。

### 修复范围

- `skills/spec-mcp-setup/scripts/check-deps.sh`
- `skills/spec-mcp-setup/scripts/check-deps.ps1`
- `skills/spec-mcp-setup/SKILL.md`
- `tests/unit/mcp-setup.sh`
- `tests/unit/mcp-setup-powershell-contracts.test.js`

### 修复内容

- Linux / WSL 的 `fnm` 建议改为下载到临时文件、用 `less` 人工检查后再执行。
- Unix `uv` 建议改为下载到临时文件、用 `less` 人工检查后再执行。
- Windows `uv` 建议改为 `Invoke-WebRequest -OutFile` 下载到临时脚本、用 `notepad` 人工检查后再用 `-File` 执行。
- 单测改为断言不再包含 `install.ps1 | iex` 和 `curl ... | sh` 直通 shell 模式。

### Source / Runtime 边界

只修改 checked-in source 与测试文件；未修改 generated runtime mirrors。

### 验证状态

Pending。当前正在运行：

- `bash tests/unit/mcp-setup.sh`
- `npm run test:unit -- --runTestsByPath tests/unit/mcp-setup-powershell-contracts.test.js`

已知限制：本机缺少 `pwsh`，无法直接用 PowerShell 解释器做语法解析；PowerShell 侧先依赖 Jest contract test 做静态验证。

### 剩余风险

- 安装建议仍会执行远程下载内容，只是加入人工检查步骤。若后续要进一步降低风险，应优先链接官方安装文档或包管理器安装路径，而不是新增自动安装决策。

### 验证更新

2026-05-05 15:38 +0800：

- `bash tests/unit/mcp-setup.sh` passed。
- `npm run test:unit -- --runTestsByPath tests/unit/mcp-setup-powershell-contracts.test.js` passed。
- 该 `npm` 命令按仓库脚本实际执行了 developer/lang-policy/mcp-setup/graph-bootstrap/version-reminder/unit Jest 链路，并包含目标 `mcp-setup-powershell-contracts.test.js`。
- `pwsh` 在本机不可用，PowerShell 解释器级语法解析未执行；静态 contract test 已覆盖不再使用 `install.ps1 | iex` 和 `curl ... | sh`。

## FIX-002: 降低 skill-audit runtime governance P0 误报

### 时间

2026-05-05 15:40:19 +0800

### 审计信号

- 来源：`.spec-first/audits/skill-audit/latest/security-risk-report.json`
- 原始等级：P0
- 原始标题：`Generated runtime assets may be modified directly`
- 命中文件：
  - `skills/spec-standards/SKILL.md`
  - `skills/spec-update/SKILL.md`
  - `skills/spec-update/scripts/currently-loaded-version.sh`
  - `skills/spec-update/scripts/marketplace-name.sh`

### 语义判断

Confirmed scanner issue，not confirmed runtime governance issue。命中内容不是要求手改 runtime mirrors，而是禁止性 guardrail、marketplace cache layout 注释、state 文件路径说明、`spec-update` skill 文件名。旧规则把路径里的 `update` 当成写操作动词，导致 P0 噪音。修复应在确定性 scanner 中降低误报，但不能让脚本做语义审查结论。

### 修复范围

- `skills/spec-skill-audit/scripts/lib/security-patterns.js`
- `tests/unit/skill-audit-scripts.test.js`

### 修复内容

- 将 English runtime write verb 匹配收窄为必须出现在行首或空白 / 引号 / 括号之后，避免把 `spec-update`、`update.md` 这类路径片段识别成写操作。
- 增加 `will not` 禁止性语境提示。
- 新增单测覆盖 runtime guardrail 和纯 runtime path reference 不应升级为 P0。
- 保留真实动作检测，例如 `modify .claude/`、中文 `修改`、以及 path 后的 `edit it` 仍会命中。

### Source / Runtime 边界

只修改 source scanner 和单测；未修改 generated runtime mirrors。scanner 仍只准备风险信号，最终是否为真实治理问题仍由 LLM / review 判断。

### 验证状态

Pending。待执行：

- `node --check skills/spec-skill-audit/scripts/lib/security-patterns.js`
- `npx jest tests/unit/skill-audit-scripts.test.js --runInBand`
- `node skills/spec-skill-audit/scripts/write-audit-artifacts.js --repo . --runtime`

### 剩余风险

- 更严格的 English verb 边界可能漏掉极少数无空格拼接的异常写法；这类写法本身不应作为规范 skill 指令出现。真实 runtime 写操作仍由中文动词、明确 English 动词和 review 复核覆盖。

### 验证更新

2026-05-05 15:41 +0800：

- `node --check skills/spec-skill-audit/scripts/lib/security-patterns.js` passed。
- `node --check skills/spec-skill-audit/scripts/scan-instruction-security.js` passed。
- `npx jest tests/unit/skill-audit-scripts.test.js --runInBand` passed，21 tests passed。
- `node skills/spec-skill-audit/scripts/write-audit-artifacts.js --repo . --runtime` passed。
- 复跑后 `.spec-first/audits/skill-audit/latest/security-risk-report.json` 的 `p0_count` 为 `0`。

## FIX-003: 允许已治理的内部 skill runtime name alias

### 时间

2026-05-05 15:44:07 +0800

### 审计信号

- 来源：`.spec-first/audits/skill-audit/latest/skill-audit-report.json`
- 原始等级：P1
- 原始标题：`Frontmatter name does not match directory name`
- 命中 skill：
  - `spec-dhh-rails-style`
  - `spec-session-extract`
  - `spec-session-inventory`

### 语义判断

Confirmed linter issue，not confirmed skill identity drift。`spec-session-extract` 和 `spec-session-inventory` 的 runtime frontmatter 名称被 smoke tests 明确要求为 `session-extract` / `session-inventory`；`spec-dhh-rails-style` 也由 agents 以 `dhh-rails-style` 引用。直接修改 frontmatter 会破坏 runtime 使用契约，因此应在审计 linter 中显式承认这些已治理的内部别名。

### 修复范围

- `skills/spec-skill-audit/scripts/lint-skill-structure.js`
- `tests/unit/skill-audit-scripts.test.js`

### 修复内容

- 新增 `ALLOWED_FRONTMATTER_NAME_ALIASES`，只允许 3 个已有内部别名。
- `lintSingleSkill` 在 name mismatch 前先调用 `isAcceptedFrontmatterName`。
- 新增单测，覆盖 internal skill alias 不应产生 `Frontmatter name does not match directory name`。

### Source / Runtime 边界

没有修改 `skills/spec-dhh-rails-style/SKILL.md`、`skills/spec-session-extract/SKILL.md` 或 `skills/spec-session-inventory/SKILL.md` 的 frontmatter，也未修改 generated runtime mirrors。修复点只在审计 source linter。

### 验证状态

Pending。待执行：

- `node --check skills/spec-skill-audit/scripts/lint-skill-structure.js`
- `npx jest tests/unit/skill-audit-scripts.test.js --runInBand`
- `node skills/spec-skill-audit/scripts/write-audit-artifacts.js --repo . --runtime`

### 剩余风险

- 这是显式白名单，不是通用别名推断。未来新增别名必须有 governance / smoke test / agent reference 证据，否则仍应被审计为 drift。

### 验证更新

2026-05-05 15:45 +0800：

- `node --check skills/spec-skill-audit/scripts/lint-skill-structure.js` passed。
- `npx jest tests/unit/skill-audit-scripts.test.js --runInBand` passed，22 tests passed。
- `node skills/spec-skill-audit/scripts/write-audit-artifacts.js --repo . --runtime` passed。
- 复跑后 P1 frontmatter mismatch findings 为 `0`；总 P1 从 `196` 降为 `193`。

## FIX-004: 避免把 `process.env` 误判为 `.env` 文件读取

### 时间

2026-05-05 15:45:38 +0800

### 审计信号

- 来源：`.spec-first/audits/skill-audit/latest/security-risk-report.json`
- 原始等级：P1
- 原始标题：`Potential secret or credential access`
- 命中文件：`skills/spec-app-consistency-audit/scripts/build-run-metadata.js`
- 命中片段：`host: options.host || process.env.SPEC_FIRST_HOST || 'unknown',`

### 语义判断

Confirmed scanner issue，not confirmed credential access。`process.env.SPEC_FIRST_HOST` 是读取进程环境变量，不是读取 `.env` 文件、SSH key、浏览器 profile 或 credential store。旧正则直接匹配 `.env` 子串，导致把正常 Node.js 环境变量访问升为 P1。

### 修复范围

- `skills/spec-skill-audit/scripts/lib/security-patterns.js`
- `tests/unit/skill-audit-scripts.test.js`

### 修复内容

- 将 `.env` 风险匹配收窄为文件路径 / 文件名上下文，例如 `.env`、`.env.local`、`.env*`。
- 新增单测确认 `process.env.SPEC_FIRST_HOST` 不产生 credential finding，同时 `.env.local` 仍会触发 P1。

### Source / Runtime 边界

只修改审计 scanner source 和单测；未修改 app-audit runtime 逻辑或 generated runtime mirrors。

### 验证状态

Pending。待执行：

- `node --check skills/spec-skill-audit/scripts/lib/security-patterns.js`
- `npx jest tests/unit/skill-audit-scripts.test.js --runInBand`
- `node skills/spec-skill-audit/scripts/write-audit-artifacts.js --repo . --runtime`

### 剩余风险

- 该修复不会降低对真实 `.env` 文件路径的提示。读取 `.env` 只为端口解析或复制 worktree 环境时仍会保留 P1 signal，后续需要逐项语义复核。

### 验证更新

2026-05-05 15:46 +0800：

- `node --check skills/spec-skill-audit/scripts/lib/security-patterns.js` passed。
- `npx jest tests/unit/skill-audit-scripts.test.js --runInBand` passed，23 tests passed。
- `node skills/spec-skill-audit/scripts/write-audit-artifacts.js --repo . --runtime` passed。
- 复跑后 `skills/spec-app-consistency-audit/scripts/build-run-metadata.js` 不再产生 P1 credential finding。
- 复跑后 security P1 从 `50` 降为 `47`，总 P1 从 `193` 降为 `190`。

## FIX-005: 修复 doc-review / code-review 的二次 subagent 确认降级

### 时间

2026-05-05 15:52:18 +0800

### 审计信号

- 来源：用户反馈与 source grep。
- 命中文件：
  - `skills/spec-doc-review/SKILL.md`
  - `skills/spec-code-review/SKILL.md`
  - `tests/unit/spec-doc-review-contracts.test.js`
  - `tests/unit/spec-code-review-contracts.test.js`
  - `docs/validation/2026-05-05-ce-dispatch-boundary-audit-matrix.md`

### 语义判断

Confirmed workflow capability issue。Codex host 支持 `spawn_agent`，Claude host 支持 `Agent` / `Task`；旧 dispatch gate 把 workflow 自己的 documented reviewer phase 和“用户是否额外确认 subagent use”混在一起，导致 `$spec-doc-review` / `$spec-code-review` 在 Codex 下可能误降级为 single-agent report-only fallback。

正确边界是 capability / safety gate：直接进入当前 host 的 review workflow 即授权其 documented reviewer phase；只有 dispatch primitive 不存在、runtime 无法调用、用户显式要求 no-agents/report-only，或 mutating safety 条件不满足时才 fallback。

### 修复范围

- `skills/spec-doc-review/SKILL.md`
- `skills/spec-code-review/SKILL.md`
- `tests/unit/spec-doc-review-contracts.test.js`
- `tests/unit/spec-code-review-contracts.test.js`
- `docs/validation/2026-05-05-ce-dispatch-boundary-audit-matrix.md`
- `docs/validation/2026-05-05-ce-06a7cee0-sync-ledger.md`
- `docs/validation/2026-05-05-self-reflection-contract-doc-review.md`

### 修复内容

- 将 reviewer dispatch gate 从 authorization wording 改为 capability / safety wording。
- 明确 direct workflow invocation authorizes documented reviewer phase，不再要求第二句“use subagents”。
- 保留 bounded parallelism、capacity backpressure、orchestrator-owned synthesis / artifact / fix 路径。
- single-agent fallback 原因改为 `unavailable, explicitly disabled, or unsafe`。
- 对历史 validation 文档追加 correction，避免继续传播“Codex 需要额外 subagent 授权”的错误解释。

### Source / Runtime 边界

只修改 checked-in source skills、tests 和 docs；未修改 `.claude/`、`.codex/`、`.agents/skills/` runtime mirrors。

### 验证状态

Pending。待执行：

- `npx jest tests/unit/spec-doc-review-contracts.test.js tests/unit/spec-code-review-contracts.test.js --runInBand`
- `rg` stale dispatch authorization grep

### 剩余风险

- `mode:autofix` / `mode:headless` 仍涉及 mutating fixer，fallback 仍必须保留 isolation / artifact 边界。此次修复只移除“缺少二次 subagent 确认”的误降级，不放宽 mutating safety。

### 验证更新

2026-05-05 16:03 +0800：

- `npx jest tests/unit/spec-doc-review-contracts.test.js tests/unit/spec-code-review-contracts.test.js tests/unit/spec-plan-contracts.test.js tests/unit/spec-ideate-contracts.test.js tests/unit/resolve-pr-feedback-contracts.test.js tests/unit/spec-dispatch-boundary-contracts.test.js tests/unit/fresh-source-eval-contracts.test.js tests/unit/runtime-plan-contracts.test.js --runInBand` passed，其中 doc/code review 合同覆盖在内；8 suites passed，47 tests passed。
- `rg` 检查 source skills / docs contracts / validation docs / adapter / host entry docs 中不再存在旧式授权门禁、旧 Codex anti-dispatch 口径和旧 fallback 词组。

## FIX-006: 修复 planning / ideation / resolver / helper dispatch 的同类授权口径

### 时间

2026-05-05 15:52:18 +0800

### 审计信号

- 来源：全量 source grep：`authorized|authorization|session policy|when authorized|disallowed|spawn_agent`。
- 命中文件：
  - `skills/spec-plan/SKILL.md`
  - `skills/spec-ideate/SKILL.md`
  - `skills/resolve-pr-feedback/SKILL.md`
  - `skills/agent-native-audit/SKILL.md`
  - `docs/contracts/workflows/fresh-source-eval-checklist.md`
  - `docs/contracts/workflows/self-reflection-capability-upgrade.md`
  - `AGENTS.md`
  - `CLAUDE.md`

### 语义判断

Confirmed same-class issue。上述 skill / contract 不是都失败在 Codex，但都保留了“session policy authorizes / when authorized / disallowed”这类容易被执行者理解为需要用户再次确认 subagent 的口径。按最新治理规则，workflow-owned documented dispatch phase 默认可用；是否派发由能力缺口、host capability、文件重叠、预算和安全检查决定。

### 修复范围

- `skills/spec-plan/SKILL.md`
- `skills/spec-ideate/SKILL.md`
- `skills/resolve-pr-feedback/SKILL.md`
- `skills/agent-native-audit/SKILL.md`
- `tests/unit/spec-plan-contracts.test.js`
- `tests/unit/spec-ideate-contracts.test.js`
- `tests/unit/resolve-pr-feedback-contracts.test.js`
- `tests/unit/spec-dispatch-boundary-contracts.test.js`
- `tests/unit/fresh-source-eval-contracts.test.js`
- `docs/contracts/workflows/fresh-source-eval-checklist.md`
- `docs/contracts/workflows/self-reflection-capability-upgrade.md`
- `AGENTS.md`
- `CLAUDE.md`

### 修复内容

- `spec-plan`：direct plan workflow invocation authorizes documented read-only research dispatch；fallback 改为 unavailable / explicitly disabled / non-capacity failure。
- `spec-ideate`：direct ideation workflow invocation authorizes documented grounding / ideation subagent phases；fallback 改为 unavailable / explicitly disabled。
- `resolve-pr-feedback`：resolver dispatch 改为 available-and-safe 默认路径，仍由 file overlap 和 orchestrator-owned integration 控制 mutating safety。
- `agent-native-audit`：内部 helper 被上游明确委托时按 host capability 启动 8 个 read-only explorer；无 capability 或显式禁用时 sequential fallback。
- `fresh-source eval` 及入口文档：未执行原因改为缺 dispatch primitive、runtime 无法调用或用户显式禁用 helper agents；不得把“没有二次确认”当作未执行原因。

### Source / Runtime 边界

只修改 checked-in source skills、contracts、入口文档和单测；未修改 generated runtime mirrors。

### 验证状态

Pending。待执行：

- `npx jest tests/unit/spec-plan-contracts.test.js tests/unit/spec-ideate-contracts.test.js tests/unit/resolve-pr-feedback-contracts.test.js tests/unit/spec-dispatch-boundary-contracts.test.js tests/unit/fresh-source-eval-contracts.test.js --runInBand`
- `rg` stale dispatch authorization grep

### 剩余风险

- Slack context 和 `spec-work-beta` delegation 仍有产品级 opt-in 语义；这些不是“subagent confirmation gate”，而是外部 context / beta execution route 的边界，未在本修复中移除。

### 验证更新

2026-05-05 16:03 +0800：

- `npx jest tests/unit/spec-doc-review-contracts.test.js tests/unit/spec-code-review-contracts.test.js tests/unit/spec-plan-contracts.test.js tests/unit/spec-ideate-contracts.test.js tests/unit/resolve-pr-feedback-contracts.test.js tests/unit/spec-dispatch-boundary-contracts.test.js tests/unit/fresh-source-eval-contracts.test.js tests/unit/runtime-plan-contracts.test.js --runInBand` passed；8 suites passed，47 tests passed。
- `rg` stale dispatch authorization grep passed（无 source 命中）。

## FIX-007: 修复 Codex adapter 的 legacy `Task spec-*` 渲染口径

### 时间

2026-05-05 15:52:18 +0800

### 审计信号

- 来源：全量 source grep 与 contract tests。
- 命中文件：
  - `src/cli/adapters/codex.js`
  - `tests/unit/runtime-plan-contracts.test.js`
  - `tests/unit/spec-dispatch-boundary-contracts.test.js`

### 语义判断

Confirmed runtime projection issue。`transformCodexContent()` 将 legacy `Task spec-*` shorthand 渲染为 “when Codex dispatch is authorized”，会把 Codex `spawn_agent` 支持误表达成额外授权依赖。该函数只负责 host-specific 文本投影，不应制造语义降级。

### 修复范围

- `src/cli/adapters/codex.js`
- `tests/unit/runtime-plan-contracts.test.js`
- `tests/unit/spec-dispatch-boundary-contracts.test.js`

### 修复内容

- Codex legacy `Task spec-*` 渲染改为 `when Codex dispatch is available`。
- inline fallback 条件改为 `spawn_agent is unavailable or explicitly disabled`。
- 保留 agent path rewrite、source/runtime path rewrite 和 workflow skill runtime 投影边界。

### Source / Runtime 边界

只修改 source adapter 和单测；未运行 `spec-first init --codex`，未手改 runtime mirrors。

### GitNexus impact

- target: `transformCodexContent`
- risk: LOW
- direct callers: `CodexAdapter.transformSkillContent`, `CodexAdapter.transformAgentContent`
- affected processes: 0

### 验证状态

Pending。待执行：

- `node --check src/cli/adapters/codex.js`
- `npx jest tests/unit/runtime-plan-contracts.test.js tests/unit/spec-dispatch-boundary-contracts.test.js --runInBand`

### 剩余风险

- 该修复只改变 runtime projection wording，不主动刷新 `.agents/skills/`。如需要让当前 host runtime mirror 立即反映新文案，应在 source 验证后运行 `spec-first init --codex`，不能手改 mirror。

### 验证更新

2026-05-05 16:03 +0800：

- `node --check src/cli/adapters/codex.js` passed。
- `npx jest tests/unit/runtime-plan-contracts.test.js tests/unit/spec-dispatch-boundary-contracts.test.js --runInBand` 随本轮 dispatch 合同测试 passed。
- GitNexus impact 已在编辑前执行：`transformCodexContent` upstream risk LOW，2 个直接调用者，0 affected processes。

## 本轮补充验证汇总

2026-05-05 16:04 +0800：

- `node --check skills/spec-skill-audit/scripts/lib/security-patterns.js && node --check skills/spec-skill-audit/scripts/lint-skill-structure.js && node --check skills/spec-skill-audit/scripts/scan-instruction-security.js` passed。
- `npx jest tests/unit/skill-audit-scripts.test.js --runInBand` passed，23 tests passed。
- `bash tests/unit/mcp-setup.sh` passed。
- `npx jest tests/unit/mcp-setup-powershell-contracts.test.js --runInBand` passed，15 tests passed。
- `node skills/spec-skill-audit/scripts/write-audit-artifacts.js --repo . --runtime` passed，最新 `security-risk-report.json` summary 为 `p0_count: 0`、`p1_count: 47`。

## FIX-008: 修复 durable learning 中残留的旧授权边界口径

### 时间

2026-05-05 16:11:42 +0800

### 审计信号

- 来源：fresh-source eval。
- 原始等级：P2 / P3。
- 命中文件：
  - `docs/solutions/workflow-issues/doc-review-codex-multi-agent-dispatch-boundary-2026-05-05.md`
  - `tests/unit/spec-dispatch-boundary-contracts.test.js`

### 语义判断

Confirmed stale durable knowledge issue。核心 skill source 已修复，但旧 solution learning 仍把 dispatch 降级原因表述为会话授权、当前会话规则许可或更严格授权边界。这样的旧口径会污染后续 agent 的知识检索结果，让已修复根因重新进入下一轮工作。

### 修复范围

- `docs/solutions/workflow-issues/doc-review-codex-multi-agent-dispatch-boundary-2026-05-05.md`
- `tests/unit/spec-dispatch-boundary-contracts.test.js`
- `CHANGELOG.md`

### 修复内容

- 将 durable learning 的 `applies_when`、Context、Guidance、示例和验证命令改为 capability / safety gate 口径。
- 明确 workflow invocation authorizes documented reviewer phase by default，不再要求第二次 subagent confirmation。
- fallback 原因统一为 dispatch unavailable、explicitly disabled、runtime call failure 或 unsafe。
- 新增 dispatch-boundary durable learnings 防回归测试，扫描 `docs/solutions/workflow-issues` 中涉及 dispatch / subagent / `spawn_agent` 的文档，禁止旧授权口径回流。

### Source / Runtime 边界

只修改 durable docs、contract test 和 changelog；未修改 generated runtime mirrors。

### 验证状态

Pending。待执行：

- `npx jest tests/unit/spec-dispatch-boundary-contracts.test.js --runInBand`
- `rg` stale dispatch authorization grep

### 剩余风险

- 该测试只扫描 `docs/solutions/workflow-issues` 下 dispatch 相关 Markdown。若其他历史目录继续保留旧口径，应在后续 compound-refresh 或文档审计中扩展扫描范围。

### 验证更新

2026-05-05 16:12 +0800：

- `npx jest tests/unit/spec-dispatch-boundary-contracts.test.js --runInBand` passed，6 tests passed。
- `rg` stale dispatch authorization grep passed，扫描 `docs/solutions/workflow-issues`、source skills、workflow contracts、validation docs、adapter、AGENTS/CLAUDE 后无旧口径命中。
- `git diff --name-only -- .claude .codex .agents` 无输出，确认未手改 generated runtime mirrors。

## FIX-009: 修复 docs/plans 中残留的 dispatch 用户确认旧口径

### 时间

2026-05-05 16:19:33 +0800

### 审计信号

- 来源：全量 stale dispatch authorization grep。
- 原始等级：P2。
- 命中文件：
  - `docs/plans/2026-05-05-003-docs-self-reflection-contract-plan.md`
  - `docs/plans/2026-05-05-002-fix-ce-dispatch-boundary-audit-plan.md`

### 语义判断

Confirmed stale planning-doc issue。两个文件不是 runtime 行为入口，但仍属于 source docs，会被后续自我审视、plan handoff 或 session / solution research 检索到。旧口径把 workflow documented reviewer / research phase 写成需要额外用户授权或会话授权，与当前跨 Claude / Codex 的 capability/safety gate 冲突。

### 修复范围

- `docs/plans/2026-05-05-003-docs-self-reflection-contract-plan.md`
- `docs/plans/2026-05-05-002-fix-ce-dispatch-boundary-audit-plan.md`
- `tests/unit/spec-dispatch-boundary-contracts.test.js`
- `CHANGELOG.md`

### 修复内容

- 将 self-reflection contract plan 的 review plan 改为：直接进入当前 host 的 doc-review workflow 时，documented persona-reviewer phase 默认由 workflow invocation 授权；仅在 dispatch primitive 不可用、runtime 无法调用、用户显式 no-agents / report-only 或安全边界不满足时才 single-agent fallback。
- 将 CE dispatch boundary plan 的旧会话授权词组改为 `workflow-owned documented phase authorization` 与显式 no-agents / report-only override。
- 增加 docs/plans 防回归测试，禁止 dispatch 相关计划文档重新引入旧会话授权或“用户未显式授权 reviewer subagents”口径。

### Source / Runtime 边界

只修改 checked-in docs 和 tests；未修改 generated runtime mirrors。

### 验证状态

Pending。待执行：

- `npx jest tests/unit/spec-dispatch-boundary-contracts.test.js --runInBand`
- 全量 stale dispatch authorization grep

### 剩余风险

历史分析文档中仍可能出现与第三方同步历史有关的 `用户明确要求` 或 `confirmation` 表述；本次只修复会直接误导 workflow-owned agent dispatch 的 source planning docs。Slack / org context 的 opt-in 规则不属于本缺陷。

### 验证更新

2026-05-05 16:24 +0800：

- `npx jest tests/unit/spec-dispatch-boundary-contracts.test.js --runInBand` passed，7 tests passed。
- 排除 tests 后的 stale dispatch grep passed，无旧会话授权、用户未显式授权 reviewer subagents、用户未请求 subagents 或 Codex 不支持 dispatch 这类旧口径命中。
- `git diff --name-only -- .claude .codex .agents` 无输出，确认未手改 generated runtime mirrors。

## FIX-010: 修复 resolve-pr-feedback Targeted Mode 默认假设 dispatch 存在

### 时间

2026-05-05 16:26:38 +0800

### 审计信号

- 来源：fresh-source eval。
- 原始等级：P1。
- 命中文件：
  - `skills/resolve-pr-feedback/SKILL.md`

### 语义判断

Confirmed edge-path dispatch issue。Full Mode 已有 mutating resolver dispatch boundary，但 Targeted Mode 仍直接写 `Spawn a single spec-pr-comment-resolver agent`，没有重复说明 dispatch unavailable / explicitly disabled / unsafe 时的 current-agent fallback。该路径会让执行者在无 dispatch primitive 或 mutating safety 不满足时误以为必须 spawn。

### 修复范围

- `skills/resolve-pr-feedback/SKILL.md`
- `tests/unit/resolve-pr-feedback-contracts.test.js`

### 修复内容

- Targeted Mode 改为复用 Full Mode 的 Mutating resolver dispatch boundary。
- 明确仅在 host exposes dispatch primitive、用户未禁用 delegation、single-thread unit 可隔离时 spawn resolver。
- 明确 fallback 为当前 agent 顺序处理该 thread。
- 增加 targeted-mode contract test，防止旧句式回归。

### Source / Runtime 边界

只修改 source skill 和 unit test；未修改 generated runtime mirrors。

### 验证状态

Pending。待执行：

- `npx jest tests/unit/resolve-pr-feedback-contracts.test.js --runInBand`

### 剩余风险

Targeted Mode 仍是 mutating workflow，后续实际执行时必须由 orchestrator 统一 validate、commit、push、reply 和 resolve thread。

### 验证更新

2026-05-05 16:27 +0800：

- `npx jest tests/unit/resolve-pr-feedback-contracts.test.js --runInBand` 随聚焦 dispatch 合同测试 passed。
- 聚焦测试命令：`npx jest tests/unit/spec-dispatch-boundary-contracts.test.js tests/unit/resolve-pr-feedback-contracts.test.js tests/unit/spec-code-review-contracts.test.js tests/unit/spec-plan-contracts.test.js --runInBand` passed，4 suites / 34 tests passed。

## FIX-011: 修复 spec-code-review 末尾 Fallback 与 Stage 4 fallback 冲突

### 时间

2026-05-05 16:26:38 +0800

### 审计信号

- 来源：fresh-source eval。
- 原始等级：P1。
- 命中文件：
  - `skills/spec-code-review/SKILL.md`

### 语义判断

Confirmed fallback wording issue。Stage 4 已规定 dispatch unavailable / disabled / unsafe 时走 single-agent report-only fallback，但末尾 Fallback 仍写“平台不支持 parallel sub-agents 时 sequential reviewers”，容易把“无 dispatch primitive”也解释成可以 sequential persona dispatch。

### 修复范围

- `skills/spec-code-review/SKILL.md`
- `tests/unit/spec-code-review-contracts.test.js`

### 修复内容

- 将 fallback 分为两层：
  - 支持 dispatch 但不支持 parallel 时，使用 Stage 4 scheduler 顺序 dispatch reviewers。
  - 完全没有 dispatch primitive、显式禁用或不安全时，走 Stage 4 single-agent report-only fallback。
- 增加 contract test 覆盖该区分。

### Source / Runtime 边界

只修改 source skill 和 unit test；未修改 generated runtime mirrors。

### 验证状态

Pending。待执行：

- `npx jest tests/unit/spec-code-review-contracts.test.js --runInBand`

### 剩余风险

该修复只校准 fallback 文案；`spec-code-review` 仍是超长 skill，后续应拆 reference 降低维护成本。

### 验证更新

2026-05-05 16:27 +0800：

- `npx jest tests/unit/spec-code-review-contracts.test.js --runInBand` 随聚焦 dispatch 合同测试 passed。
- 聚焦测试命令：`npx jest tests/unit/spec-dispatch-boundary-contracts.test.js tests/unit/resolve-pr-feedback-contracts.test.js tests/unit/spec-code-review-contracts.test.js tests/unit/spec-plan-contracts.test.js --runInBand` passed，4 suites / 34 tests passed。

## FIX-012: 修复 spec-plan deepening reference 的 dispatch fallback 缺口

### 时间

2026-05-05 16:26:38 +0800

### 审计信号

- 来源：fresh-source eval。
- 原始等级：P1。
- 命中文件：
  - `skills/spec-plan/references/deepening-workflow.md`

### 语义判断

Confirmed reference drift issue。`skills/spec-plan/SKILL.md` 主流程已明确 dispatch unavailable / disabled 时 inline current-agent fallback，但 deepening reference 仍只写“不支持 parallel dispatch 时 sequential”，没有区分 host dispatch primitive 缺失。

### 修复范围

- `skills/spec-plan/references/deepening-workflow.md`
- `tests/unit/spec-plan-contracts.test.js`

### 修复内容

- 将 deepening research 执行分为：
  - dispatch available but no parallel：通过 host dispatch primitive 顺序运行 selected agents。
  - dispatch unavailable / disabled / unsafe：读取对应 agent profiles，在当前 agent 顺序执行，并记录 `dispatch_fallback: inline-current-agent`。
- 增加 deepening reference contract test。

### Source / Runtime 边界

只修改 source reference 和 unit test；未修改 generated runtime mirrors。

### 验证状态

Pending。待执行：

- `npx jest tests/unit/spec-plan-contracts.test.js --runInBand`

### 剩余风险

Deepening 仍需要 orchestrator 控制 artifact-backed scratch directory，不能让 subagents 写 repo-local durable artifacts。

### 验证更新

2026-05-05 16:27 +0800：

- `npx jest tests/unit/spec-plan-contracts.test.js --runInBand` 随聚焦 dispatch 合同测试 passed。
- 聚焦测试命令：`npx jest tests/unit/spec-dispatch-boundary-contracts.test.js tests/unit/resolve-pr-feedback-contracts.test.js tests/unit/spec-code-review-contracts.test.js tests/unit/spec-plan-contracts.test.js --runInBand` passed，4 suites / 34 tests passed。

## FIX-013: 修复 agent-native-audit success criteria 与 sequential fallback 不一致

### 时间

2026-05-05 16:26:38 +0800

### 审计信号

- 来源：fresh-source eval。
- 原始等级：P2。
- 命中文件：
  - `skills/agent-native-audit/SKILL.md`

### 语义判断

Confirmed criteria wording issue。Workflow 已允许无 dispatch primitive 时在当前 agent 顺序执行 8 个 principle audits，但 Success Criteria 仍写 `All 8 sub-agents complete their audits`，会把合法 sequential fallback 误判为失败。

### 修复范围

- `skills/agent-native-audit/SKILL.md`
- `tests/unit/spec-dispatch-boundary-contracts.test.js`

### 修复内容

- Success Criteria 改为 `All 8 principle audits complete, whether via parallel sub-agents or sequential current-agent fallback`。
- 增加 contract test，断言新 criteria 存在且旧句式不存在。

### Source / Runtime 边界

只修改 source skill 和 unit test；未修改 generated runtime mirrors。

### 验证状态

Pending。待执行：

- `npx jest tests/unit/spec-dispatch-boundary-contracts.test.js --runInBand`

### 剩余风险

该 helper 仍缺标准 section 结构；后续可单独补 `When To Use` / `When Not To Use` / `Outputs`，不影响本轮 dispatch 根因。

### 验证更新

2026-05-05 16:27 +0800：

- `npx jest tests/unit/spec-dispatch-boundary-contracts.test.js --runInBand` 随聚焦 dispatch 合同测试 passed。
- 聚焦测试命令：`npx jest tests/unit/spec-dispatch-boundary-contracts.test.js tests/unit/resolve-pr-feedback-contracts.test.js tests/unit/spec-code-review-contracts.test.js tests/unit/spec-plan-contracts.test.js --runInBand` passed，4 suites / 34 tests passed。

## FIX-014: 修复历史 dispatch plan 中旧 Codex 反例原文污染

### 时间

2026-05-05 16:26:38 +0800

### 审计信号

- 来源：fresh-source eval。
- 原始等级：P2。
- 命中文件：
  - `docs/plans/2026-05-05-002-fix-ce-dispatch-boundary-audit-plan.md`

### 语义判断

Confirmed historical-doc contamination issue。旧 plan 中部分 code blocks 是在描述“禁止旧假设”，但仍逐字保留旧 Codex anti-dispatch、旧授权触发和旧 fallback 词组。由于 docs/plans 是 source docs，可能被后续 session / solution / plan research 检索并污染判断。

### 修复范围

- `docs/plans/2026-05-05-002-fix-ce-dispatch-boundary-audit-plan.md`
- `tests/unit/spec-dispatch-boundary-contracts.test.js`

### 修复内容

- 将旧反例原文改为中文 paraphrase，不再复述可被执行者误当指令的旧句式。
- 将 Codex adapter 示例改为：仅当 workflow documented dispatch phase 与 host capability 选择时使用 `spawn_agent`。
- 将 fallback 示例改为 `spawn_agent unavailable or explicitly disabled`。
- 扩展 docs/plans 防回归断言，覆盖旧 Codex anti-dispatch 原文和旧 fallback 词组。

### Source / Runtime 边界

只修改 source docs 和 unit test；未修改 generated runtime mirrors。

### 验证状态

Pending。待执行：

- `npx jest tests/unit/spec-dispatch-boundary-contracts.test.js --runInBand`
- docs/plans stale dispatch grep

### 剩余风险

历史 docs 中仍可能保留一般性的用户确认语句；只要它们不控制 workflow-owned agent dispatch，就不属于本缺陷。

### 验证更新

2026-05-05 16:27 +0800：

- `npx jest tests/unit/spec-dispatch-boundary-contracts.test.js --runInBand` 随聚焦 dispatch 合同测试 passed。
- 排除 tests 后的 stale dispatch grep passed，无旧 Codex inline-only、旧 Codex no-dispatch、旧授权触发或旧 fallback 词组命中。
- `git diff --name-only -- .claude .codex .agents` 无输出，确认未手改 generated runtime mirrors。

## 本轮最终验证汇总

2026-05-05 16:29 +0800：

- `npx jest tests/unit/spec-dispatch-boundary-contracts.test.js tests/unit/spec-doc-review-contracts.test.js tests/unit/spec-code-review-contracts.test.js tests/unit/spec-plan-contracts.test.js tests/unit/spec-ideate-contracts.test.js tests/unit/runtime-plan-contracts.test.js tests/unit/fresh-source-eval-contracts.test.js tests/unit/resolve-pr-feedback-contracts.test.js --runInBand` passed，8 suites / 51 tests passed。
- `node skills/spec-skill-audit/scripts/write-audit-artifacts.js --repo . --runtime` passed，latest summary 为：42 skills scanned，P0=0，P1=193，P2=120；security summary 为 P0=0，P1=47，P2=0，P3=40。
- 排除 tests 后的 stale dispatch grep passed，无旧 dispatch authorization / Codex anti-dispatch 口径命中。
- `git diff --name-only -- .claude .codex .agents` 无输出，确认未手改 generated runtime mirrors。

## FIX-015: 修复复审发现的历史 plan 与修复日志旧短语精确残留

### 时间

2026-05-05 16:50:22 +0800

### 审计信号

- 来源：再次复审 grep。
- 原始等级：P2。
- 命中文件：
  - `docs/plans/2026-05-05-002-fix-ce-dispatch-boundary-audit-plan.md`
  - `docs/2026-05-05-skill-agent-audit/fix-log.md`

### 语义判断

Confirmed source-doc contamination issue。历史 plan 中仍有一条旧 Codex-specific anti-pattern 原文；fix log 虽然是在描述已修问题，但也保留了多个精确旧短语。由于这些文件都是后续 self-review / session research 可读的 source docs，精确旧短语会增加误检索和误吸收风险。

### 修复范围

- `docs/plans/2026-05-05-002-fix-ce-dispatch-boundary-audit-plan.md`
- `docs/2026-05-05-skill-agent-audit/fix-log.md`
- `tests/unit/spec-dispatch-boundary-contracts.test.js`
- `CHANGELOG.md`

### 修复内容

- 将历史 plan 的旧 Codex-specific anti-pattern 原文改为中文描述，不再复述可被执行者误当指令的旧句式。
- 将替换 contract 改为当前最终口径：documented reviewer phase + host capability select dispatch。
- 将 fix log 中的精确旧短语改为中文 paraphrase，保留审计意义但降低检索污染。
- 扩展 dispatch-boundary contract test，扫描本轮 audit docs，防止本地复盘文档重新写入精确旧短语。

### Source / Runtime 边界

只修改 checked-in docs 和 unit test；未修改 generated runtime mirrors。

### 验证状态

Pending。待执行：

- `npx jest tests/unit/spec-dispatch-boundary-contracts.test.js --runInBand`
- source docs stale dispatch grep

### 剩余风险

一般性“用户确认”仍会出现在 review/fix workflow 中；只要不控制 workflow-owned agent dispatch，就不属于本缺陷。

### 验证更新

2026-05-05 16:52 +0800：

- `npx jest tests/unit/spec-dispatch-boundary-contracts.test.js --runInBand` passed，8 tests passed。
- `npx jest tests/unit/spec-dispatch-boundary-contracts.test.js tests/unit/spec-doc-review-contracts.test.js tests/unit/spec-code-review-contracts.test.js tests/unit/spec-plan-contracts.test.js tests/unit/spec-ideate-contracts.test.js tests/unit/runtime-plan-contracts.test.js tests/unit/fresh-source-eval-contracts.test.js tests/unit/resolve-pr-feedback-contracts.test.js --runInBand` passed，8 suites / 52 tests passed。
- source docs stale dispatch grep passed，扫描 `docs/plans`、`docs/2026-05-05-skill-agent-audit`、skills、agents、AGENTS、CLAUDE、src 后无精确旧口径命中。
- `git diff --name-only -- .claude .codex .agents` 无输出，确认未手改 generated runtime mirrors。

## FIX-016: 加固 `spec-mcp-setup` 跨平台依赖安装建议

### 时间

2026-05-05 17:06:57 +0800

### 审计信号

- 来源：深度审查 `spec-mcp-setup` 多平台安装路径。
- 原始等级：P1。
- 命中文件：
  - `skills/spec-mcp-setup/scripts/check-deps.sh`
  - `skills/spec-mcp-setup/scripts/check-deps.ps1`
  - `docs/10-prompt/skills/spec-mcp-setup/SKILL.md`

### 语义判断

Confirmed cross-platform robustness issue。上一版将 `curl | sh` / `irm | iex` 降级为“下载后用 `less` / `notepad` 查看并继续执行”，安全性有所提高，但在 CI、headless、Windows Server、最小 Linux 镜像或无 GUI 环境下不稳；同时 PowerShell 版在 Linux/macOS 返回 Bash-only 的 `tmp=$(mktemp)` 建议，当前 shell 与当前脚本语言不一致。

### 修复范围

- `skills/spec-mcp-setup/scripts/check-deps.sh`
- `skills/spec-mcp-setup/scripts/check-deps.ps1`
- `skills/spec-mcp-setup/SKILL.md`
- `tests/unit/mcp-setup.sh`
- `tests/unit/mcp-setup-powershell-contracts.test.js`
- `docs/10-prompt/skills/spec-mcp-setup/SKILL.md`
- `CHANGELOG.md`

### 修复内容

- Unix/Git Bash `check-deps.sh` 的 Node/uv 建议改为下载 installer 到本地临时文件，并打印“Review it, then run”后续命令，不自动执行远程 installer。
- Windows uv 建议移除 `notepad` 和自动 `-File` 执行，只下载脚本并打印复核后运行的命令。
- PowerShell `check-deps.ps1` 改为输出 PowerShell 可执行语法，不再返回 Bash-only `tmp=$(mktemp)`、`less "$tmp"` 或 pipe-to-shell。
- Prompt mirror 明确 `check-deps.*` 安装建议的 review-first、非交互、无 pipe-to-shell 边界。
- 补 Unix 与 PowerShell contract 测试，覆盖 no `curl | sh`、no `install.ps1 | iex`、no `less`、no `notepad`。

### Source / Runtime 边界

只修改 checked-in source scripts、tests、docs 和 `CHANGELOG.md`；未修改 generated runtime mirrors。

### 验证状态

Passed。已执行：

- `bash tests/unit/mcp-setup.sh`
- `npx jest tests/unit/mcp-setup-powershell-contracts.test.js --runInBand`
- `bash -n skills/spec-mcp-setup/scripts/*.sh skills/spec-mcp-setup/scripts/check-health`
- `rg -n 'install\.ps1 \| iex|curl .*\| (sh|bash)|less "\$tmp"|notepad \$script|tmp=\$\(mktemp\)' skills/spec-mcp-setup/scripts/check-deps.* tests/unit/mcp-setup*`

### 剩余风险

`install_suggestion` 仍是字符串而非结构化 `{download, review, run}` contract；本轮先保持 schema 兼容，避免扩大 downstream consumer 面。

## FIX-017: 补齐 `spec-mcp-setup` skill 审计 contract 章节

### 时间

2026-05-05 17:06:57 +0800

### 审计信号

- 来源：`spec-skill-audit` target audit。
- 原始等级：P1/P2 structural signal。
- 命中文件：
  - `skills/spec-mcp-setup/SKILL.md`

### 语义判断

Confirmed skill audit readability issue。`spec-mcp-setup` 已包含实际边界和执行步骤，但缺少标准 `Purpose`、`When To Use`、`When Not To Use`、`Inputs`、`Workflow`、`Outputs`、`Failure Modes` 章节，导致审查工具和后续人工审查需要从长文中推断 contract，降低跨宿主维护和多平台安装审查效率。

### 修复范围

- `skills/spec-mcp-setup/SKILL.md`
- `CHANGELOG.md`

### 修复内容

- 新增 `Purpose`，明确 setup 是 harness runtime 准备层，不替代语义判断。
- 新增适用/不适用边界，防止 setup 误运行 graph bootstrap、provider analyze/build 或 optional live MCP。
- 新增 inputs、workflow、outputs、failure modes，显式列出 parent workspace、Serena language、ledger/projection、权限失败和 precedence-blocked 等关键 contract。

### Source / Runtime 边界

只修改 source skill；未修改 generated runtime mirrors。

### 验证状态

Passed。已执行：

- `node skills/spec-skill-audit/scripts/write-audit-artifacts.js --repo . --target skills/spec-mcp-setup --runtime`
- `npx jest tests/unit/mcp-setup-powershell-contracts.test.js --runInBand`

### 剩余风险

Prompt mirror 只补充了本轮安装建议边界，未逐段复制新增章节；source-of-truth 仍是 `skills/spec-mcp-setup/SKILL.md`。

## FIX-018: 补齐 `check-deps` Linux/WSL 多包管理器安装建议

### 时间

2026-05-05 17:17:43 +0800

### 审计信号

- 来源：`spec-mcp-setup` 多平台安装深审。
- 原始等级：P1 robustness signal。
- 命中文件：
  - `skills/spec-mcp-setup/scripts/check-deps.sh`
  - `skills/spec-mcp-setup/scripts/check-deps.ps1`

### 语义判断

Confirmed cross-platform robustness issue。`check-health` 与 `install-helpers` 已按 `apt-get`、`dnf`、`yum`、`pacman`、`apk` 生成 Linux 安装路径，但 `check-deps` 在 `jq`、`python3`、`git` 缺失时仍主要返回 `apt-get` 建议；PowerShell 版还包含 `wsl` 分支，却没有实际检测 WSL。结果是 Fedora、RHEL、Arch、Alpine、WSL 等环境下，setup 的第一层依赖检查可能给出与当前平台不匹配的修复动作。

### 修复范围

- `skills/spec-mcp-setup/scripts/check-deps.sh`
- `skills/spec-mcp-setup/scripts/check-deps.ps1`
- `skills/spec-mcp-setup/SKILL.md`
- `tests/unit/mcp-setup.sh`
- `tests/unit/mcp-setup-powershell-contracts.test.js`
- `docs/10-prompt/skills/spec-mcp-setup/SKILL.md`
- `CHANGELOG.md`

### 修复内容

- Bash `check-deps.sh` 增加无 `jq` 阶段可用的 Linux/WSL 检测和包管理器建议函数。
- `jq` bootstrap、`python3`、`git` 缺失建议改为优先匹配本机 `apt-get`、`dnf`、`yum`、`pacman`、`apk`，没有可识别包管理器时才退到官方下载页。
- PowerShell `check-deps.ps1` 增加 WSL 检测，并将 Linux/WSL `git` 建议改为按本机包管理器生成。
- Source skill workflow contract 明确 `check-deps.*` 建议必须 current-platform aware。
- Prompt mirror 明确 `check-deps.*` 的建议必须匹配当前平台，而不是只满足 review-first。
- 补 Unix contract 测试覆盖 `dnf` 与缺失 `jq` bootstrap 场景；补 PowerShell contract 测试覆盖 WSL 检测和 Linux 包管理器分支。

### Source / Runtime 边界

只修改 checked-in source scripts、tests、docs 和 `CHANGELOG.md`；未修改 generated runtime mirrors。

### 验证状态

Passed。已执行：

- `bash tests/unit/mcp-setup.sh`
- `npx jest tests/unit/mcp-setup-powershell-contracts.test.js --runInBand`
- `bash -n skills/spec-mcp-setup/scripts/check-deps.sh`
- `git diff --check`

### 剩余风险

`install_suggestion` 仍保持字符串 schema；本轮继续维持兼容性，不引入结构化 installer contract。

## FIX-019: 固定 `using-spec-first` 下一步引导的用户可见格式

### 时间

2026-05-05 17:33:12 +0800

### 审计信号

- 来源：全局 UX / 用户引导审查。
- 原始等级：P1 UX guidance signal。
- 命中文件：
  - `skills/using-spec-first/SKILL.md`

### 语义判断

Confirmed user guidance issue。`using-spec-first` 已定义 User Next-Step Guide Mode，但只约束“一个入口、一个理由、一个动作”，没有固定用户可见格式。用户问“下一步？”或“该用哪个命令？”时，不同 host / agent 容易输出长解释、菜单或直接启动 workflow，增加新手选择成本。

### 修复范围

- `skills/using-spec-first/SKILL.md`
- `tests/unit/using-spec-first-contracts.test.js`
- `CHANGELOG.md`

### 修复内容

- 在 User Next-Step Guide Mode 中增加三行稳定格式：`推荐入口`、`理由`、`下一步`。
- 英文会话对应 `Recommended entrypoint`、`Reason`、`Next action`，保持跨语言可扫读。
- 明确 next action 应该是可直接复制的 workflow invocation，或“回复 `继续` 现在运行”的短动作。
- 补 contract test，防止后续把 guide mode 退回为松散说明。

### Source / Runtime 边界

只修改 source skill、测试和 `CHANGELOG.md`；未修改 generated runtime mirrors。`src/cli/instruction-bootstrap.js::buildBootstrapBlock` 的 GitNexus impact 为 HIGH，本轮不修改生成器，避免扩大 init/doctor/runtime drift 影响面。

### 验证状态

Passed。已执行：

- `npx jest tests/unit/using-spec-first-contracts.test.js --runInBand`
- `git diff --check`
- `node --check tests/unit/using-spec-first-contracts.test.js`

### 剩余风险

当前 checked-in `AGENTS.md` / `CLAUDE.md` bootstrap 仍是薄提醒，不复制完整 guide output template；完整格式以 `skills/using-spec-first/SKILL.md` 为 source-of-truth。

## FIX-020: 固定 `spec-work` / `spec-work-beta` 阻塞 handoff 的用户引导格式

### 时间

2026-05-05 17:34:43 +0800

### 审计信号

- 来源：全局 UX / 用户引导审查，结合 `spec-skill-audit` 对 `spec-work`、`spec-work-beta` 的 output contract 弱信号。
- 原始等级：P1 UX guidance signal。
- 命中文件：
  - `skills/spec-work/SKILL.md`
  - `skills/spec-work-beta/SKILL.md`

### 语义判断

Confirmed user guidance issue。`spec-work` 和 `spec-work-beta` 已经要求在 scope 不清、缺少 settled plan、task-pack 无法验证、`stop_if` 触发或 repo scope 缺失时回到上游 workflow，但原文多处只写“return to `spec-plan` / rerun `spec-write-tasks`”，没有统一要求输出阻塞原因、推荐入口、可复制下一步和需要携带的上下文。结果是 executor 可能正确停止，却让用户不知道下一步具体怎么继续，尤其影响新用户和跨 host 切换。

### 修复范围

- `skills/spec-work/SKILL.md`
- `skills/spec-work-beta/SKILL.md`
- `tests/unit/spec-work-contracts.test.js`
- `tests/unit/spec-work-beta-contracts.test.js`
- `CHANGELOG.md`

### 修复内容

- 在两个 work skill 的 oversized intake 后新增 `User-Facing Handoff Contract`。
- 固定阻塞 handoff 输出字段：`Blocking reason`、`Recommended entrypoint`、`Next action`、`Context to carry`。
- 要求 next action 必须是用户能立即运行或确认的动作，禁止只给 workflow 名称或完整菜单。
- beta 版本额外要求携带 delegation gate 结果，避免 delegation 退回 stable/local mode 时丢失原因。
- 补 contract tests，防止后续把阻塞 handoff 退回为松散说明。

### Source / Runtime 边界

只修改 checked-in source skill、测试和 `CHANGELOG.md`；未修改 generated runtime mirrors。

### 验证状态

Passed。已执行：

- `npx jest tests/unit/spec-work-contracts.test.js tests/unit/spec-work-beta-contracts.test.js --runInBand`
- `node --check tests/unit/spec-work-contracts.test.js`
- `node --check tests/unit/spec-work-beta-contracts.test.js`
- `git diff --check`

结果：

- `npx jest tests/unit/spec-work-contracts.test.js tests/unit/spec-work-beta-contracts.test.js --runInBand` passed，2 suites / 23 tests passed。
- 两个 contract test 文件 `node --check` passed。
- `git diff --check` passed。

### 剩余风险

该修复固定了阻塞 handoff 的用户可见形状，但没有把所有旧 prose 改成逐处调用模板；后续如果发现其他 workflow 也存在“正确停止但不给下一步动作”的问题，应按同一模式逐项修复并追加日志。

## FIX-021: 固定 `spec-work` / `spec-work-beta` 完成通知的用户可见输出 contract

### 时间

2026-05-05 17:37:13 +0800

### 审计信号

- 来源：全局 UX / 用户引导审查，继续复核高频执行入口的收尾路径。
- 原始等级：P1 UX guidance signal。
- 命中文件：
  - `skills/spec-work/references/shipping-workflow.md`
  - `skills/spec-work-beta/references/shipping-workflow.md`

### 语义判断

Confirmed user guidance issue。两个 work workflow 的 shipping reference 只要求最终 “Summarize / Link / Note follow-up / Suggest next steps”，没有明确要求说明验证命令是否执行、review tier 或 residual 状态、产物路径和用户是否还需要动作。用户可能看到“完成了”的笼统回复，却无法判断这次交付是否经过测试、是否还有已接受残留风险、PR/plan/task-pack 等证据在哪里。

### 修复范围

- `skills/spec-work/references/shipping-workflow.md`
- `skills/spec-work-beta/references/shipping-workflow.md`
- `tests/unit/spec-work-contracts.test.js`
- `tests/unit/spec-work-beta-contracts.test.js`
- `CHANGELOG.md`

### 修复内容

- 在两个 shipping workflow 的 `Notify User` 下新增 `Completion Response Contract`。
- 固定最终用户可见字段：`Completed`、`Verification`、`Review`、`Artifacts`、`Next action`。
- 明确未执行检查必须写 `not run` 和具体原因。
- 明确没有用户动作时省略 `Next action`，不要编造 follow-up。
- 补 contract tests，防止最终通知退回为无验证细节的笼统总结。

### Source / Runtime 边界

只修改 checked-in source references、测试和 `CHANGELOG.md`；未修改 generated runtime mirrors。

### 验证状态

Passed。已执行：

- `npx jest tests/unit/spec-work-contracts.test.js tests/unit/spec-work-beta-contracts.test.js --runInBand`
- `node --check tests/unit/spec-work-contracts.test.js`
- `node --check tests/unit/spec-work-beta-contracts.test.js`
- `git diff --check`

结果：

- `npx jest tests/unit/spec-work-contracts.test.js tests/unit/spec-work-beta-contracts.test.js --runInBand` passed，2 suites / 25 tests passed。
- 两个 contract test 文件 `node --check` passed。
- `git diff --check` passed。

### 剩余风险

该修复约束最终通知格式，但不改变 `git-commit-push-pr` 或 `spec-code-review` 的 artifact 生成逻辑；最终回复仍必须如实反映实际执行过的检查，不能用模板假装验证已完成。

## FIX-022: 将 ECC replacement 文档纳入当前修复 index

### 时间

2026-05-05 18:45:20 +0800

### 审计信号

- 来源：`$spec-code-review` 复核 finding F1。
- 原始等级：P1 source truth / commit-shape issue。
- 命中文件：
  - `docs/02-架构设计/ECC集成/ECC 专家能力整合技术方案.md`
  - `docs/02-架构设计/ECC集成/ECC专家能力整合技术方案.md`
  - `docs/02-架构设计/ECC集成/ECCAgent重叠治理V1技术方案.md`
  - `docs/02-架构设计/ECC集成/ECC子代理清单.md`
  - `docs/02-架构设计/ECC集成/ECC技能清单.md`
  - `docs/02-架构设计/ECC集成/ECC斜杠命令清单.md`
  - `docs/02-架构设计/ECC集成/ECC治理后专家能力包集成说明.md`
  - `docs/02-架构设计/ECC集成/SpecFirst与ECC全量能力集成路线图.md`
  - `docs/02-架构设计/ECC集成/SpecFirst集成ECC技术方案.md`

### 语义判断

Confirmed。旧空格文件名被删除，而替代 ECC 文档仍处于 untracked 状态；若直接提交，会丢失 intended source replacement。

### 修复范围

- 将 8 份 ECC replacement 文档加入 git index。
- 保留旧空格文件名删除，形成 tracked delete + tracked add 的迁移形态。
- 同步 `CHANGELOG.md`。

### 修复内容

- 已执行 targeted `git add -- docs/02-架构设计/ECC集成/...`，只纳入 F1 指定的 ECC replacement 文档。
- 未 stage 其他 untracked docs。

### Source / Runtime 边界

只处理 checked-in docs source 的 index 形态；未修改 generated runtime mirrors。

### 验证状态

Passed。已执行：

- `git ls-files --others --exclude-standard docs/02-架构设计/ECC集成`
- `rg -n "ECC 专家能力整合技术方案|ECC专家能力整合技术方案" docs README.md README.zh-CN.md`
- `git status --porcelain docs/02-架构设计/ECC集成`

结果：

- 8 份 replacement 文档已显示为 `A`。
- 旧空格文件显示为删除。
- ECC 引用已指向无空格 replacement 文件名。

### 剩余风险

该修复只解决 git tracking 形态；未审查 ECC 文档本身的内容质量或绝对路径引用。若后续需要清理 ECC 文档内容，应作为独立 finding 处理。

## FIX-023: 修复 PR feedback 回复示例的 shell 插值风险

### 时间

2026-05-05 18:46:33 +0800

### 审计信号

- 来源：`$spec-code-review` 复核 finding F2。
- 原始等级：P1 command safety issue。
- 命中文件：
  - `skills/resolve-pr-feedback/SKILL.md`
  - `tests/unit/resolve-pr-feedback-contracts.test.js`

### 语义判断

Confirmed。PR review text 属于不可信输入；把 reply body 放进 shell 双引号参数或 `echo "..."` 会允许命令替换、引号截断等 shell 注入风险。

### 修复范围

- `skills/resolve-pr-feedback/SKILL.md`
- `tests/unit/resolve-pr-feedback-contracts.test.js`
- `CHANGELOG.md`

### 修复内容

- 在 reply/resolve 章节明确：不要把 review text 粘贴进 shell-quoted arguments。
- 将 review thread reply 示例改为 literal heredoc 写入 temp file，再通过 stdin 传给 `scripts/reply-to-pr-thread`。
- 将 top-level PR comment 示例改为 `gh pr comment --body-file "$reply_file"`。
- 增加 contract test，断言安全文件/stdin模式存在，并阻止旧 unsafe 示例回归。

### Source / Runtime 边界

只修改 checked-in skill source、unit contract test 和 `CHANGELOG.md`；未修改 generated runtime mirrors。

### 验证状态

Passed。已执行：

- `npx jest tests/unit/resolve-pr-feedback-contracts.test.js --runInBand`
- `node --check tests/unit/resolve-pr-feedback-contracts.test.js`
- `rg -n 'echo "REPLY_TEXT"|--body "REPLY_TEXT"' skills/resolve-pr-feedback/SKILL.md tests/unit/resolve-pr-feedback-contracts.test.js`

结果：

- Jest passed，1 suite / 4 tests passed。
- `node --check` passed。
- 旧 unsafe 字符串只存在于测试负断言中，不存在于 `skills/resolve-pr-feedback/SKILL.md` 示例。

### 剩余风险

该修复覆盖文档示例和 contract 防回归；没有新增脚本级参数解析。后续如果 `scripts/reply-to-pr-thread` 自身处理 stdin 的方式存在问题，应单独审查脚本实现。

## FIX-024: 让 Linux/WSL node/npm/npx 缺失依赖建议优先使用平台包管理器

### 时间

2026-05-05 18:51:17 +0800

### 审计信号

- 来源：`$spec-code-review` 复核 finding F3。
- 原始等级：P2 multi-platform setup guidance issue。
- 命中文件：
  - `skills/spec-mcp-setup/scripts/check-deps.sh`
  - `skills/spec-mcp-setup/scripts/check-deps.ps1`
  - `tests/unit/mcp-setup.sh`
  - `tests/unit/mcp-setup-powershell-contracts.test.js`
  - `docs/10-prompt/skills/spec-mcp-setup/SKILL.md`

### 语义判断

Confirmed。`skills/spec-mcp-setup/SKILL.md` 要求 Linux/WSL 缺失依赖建议优先匹配当前平台包管理器；旧实现对 node/npm/npx 直接输出 fnm installer，绕过了已有 `apt-get` / `dnf` / `yum` / `pacman` / `apk` helper。

### 修复范围

- `skills/spec-mcp-setup/scripts/check-deps.sh`
- `skills/spec-mcp-setup/scripts/check-deps.ps1`
- `tests/unit/mcp-setup.sh`
- `tests/unit/mcp-setup-powershell-contracts.test.js`
- `docs/10-prompt/skills/spec-mcp-setup/SKILL.md`
- `CHANGELOG.md`

### 修复内容

- shell 版 `node` 缺失建议改为通过 `linux_package_install_command nodejs ...` 生成。
- shell 版 `npm` / `npx` 缺失建议改为通过 `linux_package_install_command npm ...` 生成。
- PowerShell 版同步使用 `Get-LinuxPackageInstallCommand`。
- 仅当没有支持的 Linux package manager 时，保留 review-first 的 fnm installer fallback。
- 增加 shell fixture，覆盖 dnf 存在时 node/npm/npx 走 package-manager，以及无 package-manager 时回落 fnm review-first。
- 恢复 `docs/10-prompt/skills/spec-mcp-setup/SKILL.md` prompt mirror 的当前语义，因为 PowerShell contract 仍把它作为 checked-in source 文档读取；该恢复是为解除测试 ENOENT 阻塞。

### Source / Runtime 边界

只修改 checked-in scripts、tests、docs prompt mirror 和 `CHANGELOG.md`；未修改 generated runtime mirrors。

### 验证状态

Passed。已执行：

- `bash -n skills/spec-mcp-setup/scripts/check-deps.sh`
- `node --check tests/unit/mcp-setup-powershell-contracts.test.js`
- `bash tests/unit/mcp-setup.sh`
- `npx jest tests/unit/mcp-setup-powershell-contracts.test.js --runInBand`

结果：

- `bash tests/unit/mcp-setup.sh` passed。
- PowerShell contract passed，1 suite / 15 tests passed。
- `bash -n` 和 `node --check` passed。

### 剩余风险

package name 选择采用当前最小可维护映射：`node` 使用 `nodejs`，`npm` / `npx` 使用 `npm`。不同发行版可能仍有更细粒度推荐，但 scripts 不做语义判断，只根据已知包管理器输出 deterministic handoff。

## FIX-025: 移除 pacman partial-upgrade 风险建议

### 时间

2026-05-05 18:51:17 +0800

### 审计信号

- 来源：`$spec-code-review` 复核 finding F4。
- 原始等级：P2 setup safety issue。
- 命中文件：
  - `skills/spec-mcp-setup/scripts/check-deps.sh`
  - `skills/spec-mcp-setup/scripts/check-deps.ps1`
  - `tests/unit/mcp-setup.sh`
  - `tests/unit/mcp-setup-powershell-contracts.test.js`

### 语义判断

Confirmed。旧建议 `sudo pacman -Sy --noconfirm` 会引导 partial upgrade，和多平台安装健壮性目标冲突。

### 修复范围

- `skills/spec-mcp-setup/scripts/check-deps.sh`
- `skills/spec-mcp-setup/scripts/check-deps.ps1`
- `tests/unit/mcp-setup.sh`
- `tests/unit/mcp-setup-powershell-contracts.test.js`
- `CHANGELOG.md`

### 修复内容

- shell 和 PowerShell helper 中的 pacman 建议改为 `sudo pacman -Syu --needed <pkg>`。
- shell test 增加 pacman fixture，断言 node 缺失建议使用 full-sync/needed install。
- PowerShell contract 更新为断言 `-Syu --needed`，并显式禁止旧 `-Sy --noconfirm`。

### Source / Runtime 边界

只修改 checked-in scripts、tests 和 `CHANGELOG.md`；未修改 generated runtime mirrors。

### 验证状态

Passed。已执行：

- `bash -n skills/spec-mcp-setup/scripts/check-deps.sh`
- `bash tests/unit/mcp-setup.sh`
- `npx jest tests/unit/mcp-setup-powershell-contracts.test.js --runInBand`
- `rg -n "pacman -Sy --noconfirm" skills/spec-mcp-setup/scripts tests/unit/mcp-setup.sh tests/unit/mcp-setup-powershell-contracts.test.js`

结果：

- mcp-setup shell tests passed。
- PowerShell contract passed，1 suite / 15 tests passed。
- 旧 `pacman -Sy --noconfirm` 只保留在测试负断言中。

### 剩余风险

`pacman -Syu` 是更安全的 handoff，但仍可能执行系统升级；当前脚本只输出建议，不自动执行该命令。若未来把建议变成自动安装动作，必须重新审查权限和非交互策略。

## FIX-026: 扩展 skill-audit scanner 覆盖 PowerShell 远程脚本管道执行

### 时间

2026-05-05 18:53:58 +0800

### 审计信号

- 来源：`$spec-code-review` 复核 finding F5。
- 原始等级：P2 security scanner gap。
- 命中文件：
  - `skills/spec-skill-audit/scripts/lib/security-patterns.js`
  - `tests/unit/skill-audit-scripts.test.js`

### 语义判断

Confirmed。旧 `REMOTE_SCRIPT_PIPE` 只检测 `curl|wget | bash|sh`，无法覆盖 PowerShell 的 `irm/iwr/Invoke-WebRequest | iex/Invoke-Expression`。

### 修复范围

- `skills/spec-skill-audit/scripts/lib/security-patterns.js`
- `tests/unit/skill-audit-scripts.test.js`
- `CHANGELOG.md`

### 修复内容

- 扩展 `REMOTE_SCRIPT_PIPE` regex，覆盖：
  - `irm ... | iex`
  - `iwr ... | iex`
  - `Invoke-RestMethod ... | Invoke-Expression`
  - `Invoke-WebRequest ... | Invoke-Expression`
- 增加 PowerShell positive fixture，断言上述模式仍按 P0 remote script pipe execution 报告。

### Source / Runtime 边界

只修改 checked-in scanner source、unit tests 和 `CHANGELOG.md`；未修改 generated runtime mirrors。

### 验证状态

Passed。已执行：

- `node --check skills/spec-skill-audit/scripts/lib/security-patterns.js`
- `node --check tests/unit/skill-audit-scripts.test.js`
- `npx jest tests/unit/skill-audit-scripts.test.js --runInBand`

结果：

- Jest passed，1 suite / 24 tests passed。
- 两个 `node --check` passed。

### 剩余风险

该 scanner 仍是 deterministic pattern detector，不判断 installer 是否可信；语义处置继续由 LLM / reviewer 完成。

## FIX-027: 扩展 `.env` secret scanner 边界并保留 `process.env` 负例

### 时间

2026-05-05 18:53:58 +0800

### 审计信号

- 来源：`$spec-code-review` 复核 finding F6。
- 原始等级：P2 security scanner gap。
- 命中文件：
  - `skills/spec-skill-audit/scripts/lib/security-patterns.js`
  - `tests/unit/skill-audit-scripts.test.js`

### 语义判断

Confirmed。旧 `.env` regex 只覆盖部分 Unix-ish 前缀，会漏 `C:\repo\.env`、`--env-file=.env` 等常见 secret path / option forms。

### 修复范围

- `skills/spec-skill-audit/scripts/lib/security-patterns.js`
- `tests/unit/skill-audit-scripts.test.js`
- `CHANGELOG.md`

### 修复内容

- 将 `.env` 前置边界扩展到 backslash 和 `=`。
- 增加测试覆盖：
  - `.env.local`
  - `C:\\repo\\.env`
  - `--env-file=.env`
  - `process.env` 不误报

### Source / Runtime 边界

只修改 checked-in scanner source、unit tests 和 `CHANGELOG.md`；未修改 generated runtime mirrors。

### 验证状态

Passed。已执行：

- `node --check skills/spec-skill-audit/scripts/lib/security-patterns.js`
- `node --check tests/unit/skill-audit-scripts.test.js`
- `npx jest tests/unit/skill-audit-scripts.test.js --runInBand`

结果：

- Jest passed，1 suite / 24 tests passed。
- 两个 `node --check` passed。

### 剩余风险

更宽的 `.env` 边界可能增加少量文档示例命中；现有 When Not To Use / reference context 会按 scanner 既有降级规则处理记录型风险。

## FIX-028: 补齐 Codex Task shorthand 的 unsafe fallback 条件

### 时间

2026-05-05 18:58:24 +0800

### 审计信号

- 来源：`$spec-code-review` 复核 finding F7。
- 原始等级：P2 runtime projection wording gap。
- 命中文件：
  - `src/cli/adapters/codex.js`
  - `tests/unit/spec-dispatch-boundary-contracts.test.js`
  - `tests/unit/runtime-plan-contracts.test.js`

### 语义判断

Confirmed。source skills 的 dispatch fallback 已包含 unavailable、explicitly disabled、unsafe 三类条件，但 Codex adapter 将 legacy `Task spec-*` shorthand 投影为 runtime 文案时遗漏 unsafe。

### 修复范围

- `src/cli/adapters/codex.js`
- `tests/unit/spec-dispatch-boundary-contracts.test.js`
- `tests/unit/runtime-plan-contracts.test.js`
- `CHANGELOG.md`

### 修复内容

- 将 legacy `Task spec-*` shorthand 的 Codex runtime 输出改为：
  - `fallback: read the profile and apply it inline in the current agent only when spawn_agent is unavailable, explicitly disabled, or unsafe`
- contract tests 同步断言新文案，并拒绝旧的 `unavailable or explicitly disabled` 完整条件。

### Source / Runtime 边界

只修改 checked-in adapter source、unit tests 和 `CHANGELOG.md`；未修改 generated runtime mirrors。

### 验证状态

Passed。已执行：

- `node --check src/cli/adapters/codex.js`
- `npx jest tests/unit/spec-dispatch-boundary-contracts.test.js tests/unit/runtime-plan-contracts.test.js tests/unit/using-spec-first-contracts.test.js tests/unit/spec-update-contracts.test.js --runInBand`

结果：

- Jest passed，4 suites / 27 tests passed。
- `node --check` passed。

### 剩余风险

该修复只覆盖 legacy shorthand 投影；source skill 中更具体的 dispatch 安全判断仍由各 workflow prose 和当前 host 工具策略共同决定。

## FIX-029: 移除 Codex adapter 全局 `--claude` 改写并保留双宿主 init 文案

### 时间

2026-05-05 18:58:24 +0800

### 审计信号

- 来源：`$spec-code-review` 复核 finding F8。
- 原始等级：P2 dual-host runtime projection drift。
- 命中文件：
  - `src/cli/adapters/codex.js`
  - `tests/unit/using-spec-first-contracts.test.js`

### 语义判断

Confirmed。`rewriteSharedPaths` 的全局 `.replace(/--claude\b/g, '--codex')` 会把 host-comparative prose 投影成 `spec-first init --codex or spec-first init --codex`，破坏双宿主 source/runtime 边界。

### 修复范围

- `src/cli/adapters/codex.js`
- `tests/unit/using-spec-first-contracts.test.js`
- `CHANGELOG.md`

### 修复内容

- 移除 Codex adapter 的全局 `--claude` → `--codex` 改写。
- 保留现有 runtime path rewrite 和 Codex-specific startup reminder rewrite。
- 新增 direct adapter contract，断言 Codex runtime：
  - 保留 `spec-first init --claude or spec-first init --codex`
  - 不产生 `spec-first init --codex or spec-first init --codex`
  - 仍把 legacy `.claude/commands/spec/work.md` 路径投影到 `.agents/skills/spec-work/SKILL.md`

### Source / Runtime 边界

只修改 checked-in adapter source、unit tests 和 `CHANGELOG.md`；未修改 generated runtime mirrors。

### 验证状态

Passed。已执行：

- `node --check src/cli/adapters/codex.js`
- `npx jest tests/unit/spec-dispatch-boundary-contracts.test.js tests/unit/runtime-plan-contracts.test.js tests/unit/using-spec-first-contracts.test.js tests/unit/spec-update-contracts.test.js --runInBand`

结果：

- Jest passed，4 suites / 27 tests passed。
- `node --check` passed。

### 剩余风险

如果未来需要把 Claude-only command examples 自动投影为 Codex-only examples，应新增上下文明确的 narrow rewrite，而不是恢复全局 flag rewrite。

## FIX-030: 为 self-reflection capability upgrade contract 增加防漂移测试锚点

### 时间

2026-05-05 19:00:20 +0800

### 审计信号

- 来源：`$spec-code-review` 复核 finding F9。
- 原始等级：P2 contract test gap。
- 命中文件：
  - `docs/contracts/workflows/self-reflection-capability-upgrade.md`
  - `tests/unit/self-reflection-contracts.test.js`

### 语义判断

Confirmed。self-reflection capability upgrade contract 是新的 source contract，但此前没有 unit test 锁定 required report set、frontmatter、provider freshness vocabulary、script/LLM 边界和 non-goals。

### 修复范围

- `tests/unit/self-reflection-contracts.test.js`
- `CHANGELOG.md`

### 修复内容

- 新增 focused contract test，断言：
  - 8 份 self-reflection cycle report 文件名保持稳定。
  - 每份 report 需要 `generated_at`、`source_commit`、`branch`、`dirty_state`、`reviewed_inputs` frontmatter 字段。
  - provider freshness vocabulary 包含 `current`、`stale`、`partial`、`definitions-only`、`unavailable`、`not-used`。
  - structural checks 不得判断 semantic quality 或 upgrade priority。
  - contract 不要求新增 `spec-evolve`、self-reflection agent 或 auto-rewrite 行为。
  - 当前 Cycle 0 report set 作为 reviewable evidence 存在。

### Source / Runtime 边界

只新增 checked-in unit test 并更新 `CHANGELOG.md`；未修改 contract source 本身，未修改 generated runtime mirrors。

### 验证状态

Passed。已执行：

- `node --check tests/unit/self-reflection-contracts.test.js`
- `npx jest tests/unit/self-reflection-contracts.test.js --runInBand`

结果：

- Jest passed，1 suite / 5 tests passed。
- `node --check` passed。

### 剩余风险

该测试只锁定结构和边界不变量，不评判 CUD 质量、优先级或 best-practice 适用性；这些语义判断仍由 LLM / review 完成。

## FIX-031: 修正 self-reflection roadmap 已完成与待办状态矛盾

### 时间

2026-05-05 19:01:44 +0800

### 审计信号

- 来源：`$spec-code-review` 复核 finding F10。
- 原始等级：P2 roadmap status contradiction。
- 命中文件：
  - `docs/2026-05-05-self-reflection-upgrade/05-prioritized-roadmap.md`

### 语义判断

Confirmed。roadmap 已列出 plan、source contract、review、compound follow-up evidence，但同一文件仍把 CUD-001..005 作为 P0/P1 pending roadmap items，容易让下一轮重复执行已落地工作。

### 修复范围

- `docs/2026-05-05-self-reflection-upgrade/05-prioritized-roadmap.md`
- `CHANGELOG.md`

### 修复内容

- 将 `Follow-up Handoff Status` 改为 `Landed Follow-up`。
- 明确 CUD-001..005 的 docs-only follow-up 已完成，并逐项标注 `Completed by`。
- 删除 P0/P1 待办标题，把后续建议收敛到 `Remaining / Future` watchlist。
- 保持 roadmap 为 advisory plan input，不引入执行状态机。

### Source / Runtime 边界

只修改 checked-in docs source 和 `CHANGELOG.md`；未修改 generated runtime mirrors。

### 验证状态

Passed。已执行：

- `rg -n "Follow-up Handoff Status|^## P0|^## P1|^## P2|completed|Completed by|Remaining / Future|CUD-00[1-5]|pending roadmap" docs/2026-05-05-self-reflection-upgrade/05-prioritized-roadmap.md`
- `npx jest tests/unit/self-reflection-contracts.test.js --runInBand`

结果：

- `rg` 显示 CUD-001..005 均为 completed follow-up，且无旧 `## P0` / `## P1` / `## P2` 标题。
- Jest passed，1 suite / 5 tests passed。

### 剩余风险

该 roadmap 仍是报告产物而非权威状态存储；下一轮 self-reflection 应读取 plan/review/compound artifacts 共同判断是否确实落地。

## FIX-032: 修正大需求拆分方案中的 host entrypoint 与未来 skill 口径

### 时间

2026-05-05 19:04:33 +0800

### 审计信号

- 来源：`$spec-code-review` 复核 finding F11。
- 原始等级：P2 user-facing entrypoint drift。
- 命中文件：
  - `docs/02-架构设计/需求拆分/大需求拆分.md`
  - `tests/unit/workflow-invocation-boundary.test.js`

### 语义判断

Confirmed。大需求拆分方案用 Claude-only `/spec:*` 主链路描述双宿主项目，并把 standalone `spec-write-tasks` 写成 `/spec:write-tasks`，同时把尚未实现的 `spec-requirements` 描述为 `/spec:requirements` command。

### 修复范围

- `docs/02-架构设计/需求拆分/大需求拆分.md`
- `tests/unit/workflow-invocation-boundary.test.js`
- `CHANGELOG.md`

### 修复内容

- 将主链路改为双宿主示例：
  - Claude Code 使用 `/spec:*`。
  - Codex 使用 `$spec-*`。
  - `spec-write-tasks` 保持 standalone skill，不写成 `/spec:*` 或 `$spec-*`。
- 将 `spec-requirements` 改为后续拟议维护型 skill / capability API。
- 明确当前不存在 `/spec:requirements` 或 `$spec-requirements` 入口。
- 增加 workflow invocation boundary contract，锁定该文档不再暴露 invalid entrypoints。

### Source / Runtime 边界

只修改 checked-in docs source、unit test 和 `CHANGELOG.md`；未修改 generated runtime mirrors。

### 验证状态

Passed。已执行：

- `node --check tests/unit/workflow-invocation-boundary.test.js`
- `npx jest tests/unit/workflow-invocation-boundary.test.js tests/unit/spec-work-contracts.test.js tests/unit/spec-work-beta-contracts.test.js tests/unit/using-spec-first-contracts.test.js --runInBand`
- `npm run lint:skill-entrypoints`
- `rg -n "/spec:write-tasks|\\$spec-write-tasks|/spec:requirements|\\$spec-requirements|/spec:brainstorm|\\$spec-brainstorm|spec-requirements|spec-write-tasks" "docs/02-架构设计/需求拆分/大需求拆分.md"`

结果：

- Jest passed，4 suites / 35 tests passed。
- skill entrypoint lint passed，167 files scanned。
- `rg` 显示无 `/spec:write-tasks` 或 `$spec-write-tasks`；`/spec:requirements` / `$spec-requirements` 仅出现在“当前不存在”说明中。

### 剩余风险

该文档仍是终态技术方案，不是已排期 implementation plan；未来真正新增 `spec-requirements` 时必须重新走 spec-plan、review 和 changelog。

## FIX-033: 清理 helper/check-health pacman partial-upgrade 与 agent-native-audit fallback 残留

### 时间

2026-05-05 19:13:37 +0800

### 审计信号

- 来源：最终扫尾 `rg` 复核 F4/F7 同类残留。
- 原始等级：P2 follow-up。
- 命中文件：
  - `skills/spec-mcp-setup/scripts/install-helpers.sh`
  - `skills/spec-mcp-setup/scripts/install-helpers.ps1`
  - `skills/spec-mcp-setup/scripts/check-health`
  - `skills/agent-native-audit/SKILL.md`
  - `tests/unit/mcp-setup.sh`
  - `tests/unit/mcp-setup-powershell-contracts.test.js`
  - `tests/unit/spec-dispatch-boundary-contracts.test.js`

### 语义判断

Confirmed。F4 已修复 `check-deps.*`，但 helper 安装建议、实际 helper install 路径和 preflight `check-health` 仍有 `pacman -Sy --noconfirm` partial-upgrade 残留。F7 已修复 Codex adapter fallback，但 internal helper `agent-native-audit` 仍写成 unavailable or explicitly disabled，缺少 unsafe。

### 修复范围

- `skills/spec-mcp-setup/scripts/install-helpers.sh`
- `skills/spec-mcp-setup/scripts/install-helpers.ps1`
- `skills/spec-mcp-setup/scripts/check-health`
- `skills/agent-native-audit/SKILL.md`
- `tests/unit/mcp-setup.sh`
- `tests/unit/mcp-setup-powershell-contracts.test.js`
- `tests/unit/spec-dispatch-boundary-contracts.test.js`
- `CHANGELOG.md`

### 修复内容

- 将 helper/check-health 的 pacman user-facing suggestion 改为 `sudo pacman -Syu --needed <pkg>`。
- 将实际 helper install 的 pacman 调用改为 full sync 路径：`pacman -Syu --needed --noconfirm <pkg>`。
- 增加 shell tests，覆盖 `check-health` 和 `install-helpers.sh --verify-only` 的 pacman suggestion。
- 增加 PowerShell contract，拒绝旧 `-Sy --noconfirm` suggestion 和 invoke args。
- 将 `agent-native-audit` sequential fallback 条件改为 unavailable、explicitly disabled、unsafe 三类，并补 contract 断言。

### Source / Runtime 边界

只修改 checked-in source scripts、skill source、unit tests 和 `CHANGELOG.md`；未修改 generated runtime mirrors。

### 验证状态

Passed。已执行：

- `bash -n skills/spec-mcp-setup/scripts/install-helpers.sh`
- `bash -n skills/spec-mcp-setup/scripts/check-health`
- `bash -n tests/unit/mcp-setup.sh`
- `node --check tests/unit/mcp-setup-powershell-contracts.test.js`
- `node --check tests/unit/spec-dispatch-boundary-contracts.test.js`
- `bash tests/unit/mcp-setup.sh`
- `npx jest tests/unit/mcp-setup-powershell-contracts.test.js tests/unit/spec-dispatch-boundary-contracts.test.js --runInBand`
- `rg -n "pacman -Sy --noconfirm|@\\('-Sy', '--noconfirm'|unavailable or explicitly disabled" skills/spec-mcp-setup/scripts skills/agent-native-audit/SKILL.md tests/unit`

结果：

- mcp-setup shell tests passed。
- Jest passed，2 suites / 23 tests passed。
- `rg` 仅剩测试中的 negative assertions。

### 剩余风险

`pacman -Syu` 仍可能执行系统升级；当前脚本仅在显式 helper install 路径中执行，且 verify/preflight 只输出建议。未来若新增自动安装路径，需要重新审查权限、交互和 OS-specific package policy。

## FIX-034: 恢复 ECC replacement docs 的 index/worktree 一致性

### 时间

2026-05-05 19:18:18 +0800

### 审计信号

- 来源：最终 `git status` 复核 F1 commit-shape。
- 原始等级：P1 follow-up。
- 命中文件：
  - `docs/02-架构设计/ECC集成/ECC专家能力整合技术方案.md`
  - `docs/02-架构设计/ECC集成/SpecFirst与ECC全量能力集成路线图.md`
  - `docs/02-架构设计/ECC集成/SpecFirst集成ECC技术方案.md`
  - `docs/02-架构设计/ECC集成/ECC 专家能力整合技术方案.md`

### 语义判断

Confirmed。F1 replacement docs 已进入 index，但并行改动后 3 个 replacement docs 在 worktree 中显示为 deleted，旧空格文件删除未 staged。若直接提交，会留下 index/worktree 不一致，影响后续继续编辑和验证。

### 修复范围

- 仅针对 ECC 集成目录的 replacement docs 和旧空格文件删除。

### 修复内容

- 从 index 恢复 3 个已 staged replacement docs 到 worktree。
- 将旧空格文件删除 staged，形成 `R100` rename 到无空格文件。
- 保留并行新增的 `Codex安装后ECC执行逻辑分析.md` 为 untracked，不纳入本次 F1 范围。

### Source / Runtime 边界

只调整 checked-in docs source 的 index/worktree consistency；未修改 generated runtime mirrors。

### 验证状态

Passed。已执行：

- `git status --short -- "docs/02-架构设计/ECC集成"`
- `git diff --cached --name-status -- "docs/02-架构设计/ECC集成"`
- `git diff --name-status -- "docs/02-架构设计/ECC集成"`
- `ls -1 "docs/02-架构设计/ECC集成"`

结果：

- replacement docs 均存在于 worktree。
- cached diff 显示旧空格文件到无空格文件的 `R100` rename，并保留 7 个新增 ECC docs。
- unstaged diff 只剩并行修改过的两个 ECC docs。

### 剩余风险

ECC 目录仍有一个并行 untracked 文档和两个并行 modified docs；它们不属于本次 11 项 finding 的必要修复，未被回滚或自动纳入。
