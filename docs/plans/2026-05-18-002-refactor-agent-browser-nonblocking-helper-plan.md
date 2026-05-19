---
title: refactor: agent-browser 降级为非 baseline 阻塞 helper
type: refactor
status: completed
date: 2026-05-18
spec_id: 2026-05-18-002-agent-browser-nonblocking-helper
---

# refactor: agent-browser 降级为非 baseline 阻塞 helper

## Summary

本计划把 `agent-browser` 从 `spec-mcp-setup` 的 baseline 阻塞条件中移出，保留为 browser automation helper capability。`spec-mcp-setup` 仍可安装、验证并报告 `agent-browser` CLI、upstream/global skill 与浏览器 runtime 状态，但 `agent-browser install` 下载 Chrome runtime 失败、缺少 `~/.agent-browser/spec-first-install.json` marker、CLI 未安装或 global skill 未安装，都不应让 Required Harness Runtime 的 `baseline_ready=false`。

核心取舍是：不要通过直接降级 `agent-browser` npm 版本来解决 setup 失败。当前失败点是 Chrome-for-Testing 大文件下载链路超时，不是 `agent-browser` CLI 本体损坏；降级版本不能稳定解决网络正文下载，也会制造 version drift。durable 修复应降级 readiness 语义，而不是降级工具版本。

进一步优化：默认 setup 不应在所有项目里主动下载 browser runtime。只有当前项目具备 browser-visible surface，或用户显式调用/准备调用 `test-browser`、`spec-polish-beta`、`feature-video`、`frontend-design`、设计截图类 agent 等 browser workflow 时，才进入 `agent-browser` 安装/修复路径。这里不要用“前端项目”作为唯一条件，因为 Rails/Django/Phoenix/Laravel/Storybook/docs site 等也可能需要浏览器证据；更稳的判断是 browser capability demand，而不是技术栈标签。

最终用户心智应变为：

- `spec-mcp-setup` baseline 证明 spec-first 的核心 harness/runtime/provider projection 可用。
- `agent-browser` 是 browser-visible workflow 的按需能力增强；默认 setup 可报告 unavailable/skipped/degraded 和 next action，但不主动为非浏览器项目下载 Chrome runtime，也不阻断 graph/setup/standards/work/review 的非浏览器主路径。
- 真正需要浏览器自动化的 workflow 自己决定 fail closed、fallback、打印 URL、使用项目自带 Playwright/Cypress，或记录 browser evidence unavailable。

---

## Problem Frame

当前失败案例显示：

- `agent-browser` CLI 已安装且 `doctor` 通过。
- 本机系统 Chrome 可启动。
- 失败发生在 `agent-browser install` 下载内置 Chrome runtime 的大文件正文阶段。
- `spec-mcp-setup` 仍主要依赖 `~/.agent-browser/spec-first-install.json` marker 判断 browser runtime 安装完成。
- marker 只有 `agent-browser install` 成功退出后才写入，因此下载超时会让 `baseline_ready=false`。

现状中 `install-helpers.sh` / `install-helpers.ps1` 已经存在 Windows-only 局部豁免：当 `agent-browser` CLI 与 global skill 就绪、仅 browser runtime marker 缺失或 `agent-browser install` 失败时，Windows 会写 `result=degraded` + `baseline_blocking=false`。本计划是把这个豁免泛化为跨平台、跨场景的统一语义，而不是从零引入新行为。

这把 browser automation helper 的 managed runtime marker 变成了整个 spec-first setup baseline gate。该语义过重：browser automation 只服务浏览器可见测试、截图、设计迭代、feature video 等局部 workflows，不应阻断 graph readiness、standards、plan、work、debug 或 code review 的核心闭环。

该问题也不应通过手动伪造 marker 解决。marker 是 install provenance，不是“系统 Chrome 可用”的通用证明；伪造 marker 会污染 deterministic facts。

---

## Goals

- G1. `agent-browser` 缺失、下载失败或 runtime marker 缺失时，`spec-mcp-setup` 仍能在其他 required MCP / graph provider / required helper 就绪时给出 `baseline_ready=true`。
- G2. `agent-browser` 仍由 `spec-mcp-setup` 统一安装、检测和报告，保持 external helper ownership，不重新引入本地 `skills/agent-browser/**`。
- G3. helper facts 明确区分 deterministic install facts 与 browser workflow 可用性建议，保留 `next_action`、reason 和 degraded status。
- G4. 默认 setup 避免在非 browser-capability-demand 场景主动安装 `agent-browser` 或下载 Chrome runtime；需要浏览器证据时再按需安装或修复。
- G5. browser-specific workflows 按自身语义消费该能力：强依赖的 fail closed，可 fallback 的降级，可人工检查的打印 URL 或记录 skipped visual verification。
- G6. 不把 browser automation 伪装成 MCP server，不把 `agent-browser` 加入 `mcp-tools.json`，不新增 browser MCP baseline。
- G7. 保持 source-first；不手改 `.claude/`、`.codex/`、`.agents/skills/` generated runtime mirrors。

## Non-Goals

- 不删除 `agent-browser` 能力。
- 不把 `agent-browser` 迁回本仓库 source skill。
- 不把所有 browser workflows 改成 Playwright、Puppeteer 或 host browser MCP。
- 不让 setup 静默伪造 `~/.agent-browser/spec-first-install.json`。
- 不把 `agent-browser doctor` 的结果升级为 spec-first 全局 baseline truth。
- 不在本计划中解决所有设计类 agent 的 broader write-authority 问题；只处理 missing browser helper 的表述和降级边界。
- 不因为本机网络问题永久 pin 老版本；临时 pin 只能作为已验证 upstream regression 的应急策略，并必须满足 **pin 退路四条件**：
  1. 已抓到 upstream regression 证据（issue 链接、失败 commit 范围、可复现命令）；
  2. `CHANGELOG.md` 写明 `Rollback:` 段，包含目标版本、判断恢复的信号、最迟回滚日期；
  3. pin 范围限于 `agent-browser` 自身 npm 版本，不引入 transitive lock；
  4. 同步在本计划或后续 plan 登记一条 `pin-followup` action，跟进 upstream 修复后取消 pin。
- 不把“前端项目”作为唯一安装条件；真实条件是 browser-visible surface 或明确 browser evidence/capture workflow demand。
- 不让脚本对“是否前端项目”做二元判断：browser-demand 由 raw signals + explicit opt-in 共同决定，脚本只产出 evidence，不替 LLM 做架构判断。

---

## Key Decisions

| Question | Decision | Rationale |
| --- | --- | --- |
| 能否直接降级 `agent-browser`？ | 不作为主方案。只允许作为临时、证据驱动的应急 pin。 | 当前失败是 Chrome runtime 下载超时；降级 CLI 版本不稳定，也会引入版本漂移。 |
| 是否接受系统 Chrome + `doctor` pass 作为 `baseline_ready`？ | 不作为 baseline 条件。可作为 browser capability hint。 | baseline 应证明 spec-first core harness；browser runtime 是下游能力，不应进入核心 gate。 |
| 是否继续安装 `agent-browser`？ | 是，但默认改为 demand-aware best-effort。 | 只有 browser-visible surface 或明确 browser workflow demand 时才主动安装/修复，避免非浏览器项目被 Chrome runtime 下载拖住。 |
| 是否用“前端项目”判断安装？ | 不直接使用。改用 browser capability demand。 | 许多后端框架也有网页；许多前端仓库也可能当前任务不需要浏览器证据。 |
| 是否修改 `mcp-tools.json`？ | 不修改。 | `agent-browser` 是 helper CLI + upstream/global skill，不是 MCP server。 |
| 是否新增复杂 capability registry？ | 暂不新增。优先复用现有 `helper_tools.*.baseline_blocking=false`。 | Light contract：现有 `verify-tools.*` 已支持 non-blocking degraded helper。 |

---

## Current Consumers

当前 source 中会直接或间接使用 `agent-browser` 的入口如下：

| Consumer | Current Dependency | Desired Missing-Tool Behavior |
| --- | --- | --- |
| `skills/test-browser/SKILL.md` | 强依赖，明确只用 `agent-browser` 做浏览器自动化。 | fail closed：提示运行当前 host 的 MCP setup entrypoint，然后停止；不替换成其它 browser tool。 |
| `skills/spec-polish-beta/SKILL.md` | 只在用户要求 agent 检查页面时使用；普通 polish loop 可打印 URL 让用户浏览。 | 降级：提示 setup，无法自动截图时继续人工 polish loop。 |
| `skills/feature-video/SKILL.md` + `references/tier-browser-reel.md` + `tier-static-screenshots.md` | browser reel / web static screenshot tier 依赖。 | fallback：preflight 不可用时不推荐 browser tier；runtime 失败时降到 static/terminal/skipped。 |
| `skills/frontend-design/SKILL.md` | 第三优先级 fallback；优先项目自带 Playwright/Cypress/Puppeteer，再 host browser MCP。 | fallback：无浏览器访问时做 mental review 并明确 visual verification skipped。 |
| `skills/spec-debug/SKILL.md` | browser bug 首选 `agent-browser`。 | fallback：可用 MCP browser tools、direct URL、截图或其它反馈环；记录无法复现条件。 |
| `agents/spec-figma-design-sync.agent.md` | 用 `agent-browser` 捕获实现截图。 | report limitation：缺失时输出 browser capture unavailable，不把 setup baseline 判为失败。 |
| `agents/spec-design-implementation-reviewer.agent.md` | 用 `agent-browser` 截图、hover、对比实现。 | report limitation：缺失时标注无法执行 browser screenshot phase。 |
| `agents/spec-design-iterator.agent.md` | 迭代截图流程强使用 `agent-browser`。 | fail or defer：缺失时停止迭代并要求 setup，不影响非设计 workflow。 |
| `skills/spec-mcp-setup/**` | 负责安装/检测 helper facts。 | owner：输出 degraded/non-blocking facts 和 repair next actions。 |

历史 docs 中也有 `agent-browser` 引用，但不作为当前 runtime contract；实现时只更新仍被 README、skill、agent、tests 或 current docs 消费的 source。

---

## Requirements

### Setup Baseline Semantics

- R1. `agent-browser` 必须继续保留在 `helper_tools` facts 中，方便用户看到 browser automation capability 的状态和修复建议。
- R2. `agent-browser` 不再阻塞 `baseline_ready`；非 ready 状态应使用 `baseline_blocking=false` + `result=degraded` 或等价 non-blocking representation。
- R3. `verify-tools.sh` / `verify-tools.ps1` 中现有 helper readiness 聚合逻辑应继续支持 `baseline_blocking=false && result=degraded` 的 ready-for-baseline 语义，不引入第二套 baseline 聚合。
- R4. `agent-browser` 的 `dependency_status`、`install_status`、`skill_status` 仍要如实表达 missing/action-required/ready；不能因为 baseline non-blocking 就假报 ready。
- R5. `next_action` 必须保留具体修复建议，例如重跑 `agent-browser install`、设置 `AGENT_BROWSER_EXECUTABLE_PATH`、安装 upstream/global skill 或安装 CLI。
- R6. `~/.agent-browser/spec-first-install.json` 只表示 managed install 成功；缺失 marker 不再表示 spec-first harness baseline 失败。
- R7. helper facts 应能表达 `skipped` 或等价 reason_code：当前没有 browser capability demand，因此未尝试安装/修复 `agent-browser`。

### Install / Verify Behavior

- R8. `install-helpers.* --verify-only` 仍保持 read-only：不安装 CLI、不运行 `agent-browser install`、不写 marker、不安装 global skill。
- R9. 默认 install mode 不应无条件安装 `agent-browser` 或下载 browser runtime；只有满足 **Browser Demand Handoff Contract** 中的 explicit opt-in 条件，或检测到非空 demand evidence 且用户已通过 opt-in 授权时，才进入 install/repair path。
- R10. Browser-demand evidence 由 deterministic raw signals 组成，脚本只产出证据，不做二元 "是否前端项目" 判定。Raw signals 至少包含：package scripts/deps 出现 Playwright/Cypress/Puppeteer/Storybook，常见 web framework 配置文件（Vite/Next/Nuxt/Astro/Remix/SvelteKit/Rails/Django/Phoenix/Laravel）存在，或 web surface 目录（`src/app`、`pages`、`app/views`、`templates`、`public`、`storybook` 等）非空。脚本将命中信号原样写入 helper facts 的 `browser_capability_demand_signals[]`，由 LLM/用户结合 opt-in flag 决定是否安装。
- R11. 当未传入 explicit opt-in flag 时，setup 默认 skip `agent-browser` 安装，无论 raw signals 是否命中；helper fact 的 `next_action` 必须告诉用户如何 opt-in（参见 **Browser Demand Handoff Contract**）。
- R12. 当 demand 存在时，install mode 可以 best-effort 安装 `agent-browser` CLI、browser runtime 和 upstream/global skill；任何 `agent-browser` 子步骤失败都应收敛为 non-blocking degraded fact，而不是让整个 setup 缺少机器可读 ledger。
- R13. macOS、Linux、Windows 三个平台应采用同一 baseline non-blocking 语义；不要只在 Windows 放宽 browser runtime 失败。Windows 现有局部豁免应被泛化吸收，而不是与新语义并存。
- R14. 若实现选择运行 `agent-browser doctor --offline --json` 作为可选 browser capability probe，必须把它标为 runtime capability hint，不能把结果写成 managed install marker，也不能让 doctor 失败阻塞 baseline。
- R15. `check-health.*` 的 preflight 输出应与 install helper 语义一致：`agent-browser` 不可用时为 skipped/degraded/non-blocking helper，而不是 required preflight failure。

### Downstream Workflow Contract

- R16. `test-browser` 保持强依赖 `agent-browser`，缺失即停止；但错误应指向 browser capability 缺失，而不是说整个 spec-first setup baseline failed。
- R17. `spec-polish-beta`、`feature-video`、`frontend-design`、`spec-debug` 必须显式保留各自 fallback / skipped / human loop 行为。
- R18. 设计类 agents 中的 `agent-browser` 缺失应写成 screenshot/browser capture limitation；不要暗示 parent workflow 必须先修复 global setup baseline。
- R19. Downstream prompts 不应读取 provider 内部 marker；只检查可执行命令、可用截图能力或上游 workflow facts 摘要。
- R20. Browser workflows 触发 setup install/repair 的契约由独立的 **Browser Demand Handoff Contract** 节定义；该 flag 只影响 helper install/repair，不改变 baseline semantics。

### Docs / Governance

- R21. `README.md` / `README.zh-CN.md` 中 required harness runtime 列表要把 `agent-browser` 改写为 browser automation helper capability，避免与 required MCP/graph provider 平权。
- R22. `skills/spec-mcp-setup/SKILL.md` 和 `references/supported-mcp-tools.md` 要明确：`agent-browser` 不在 `mcp-tools.json`，不生成 browser MCP server，缺失时 baseline 不阻塞。
- R23. 用户手册 FAQ 要解释“系统 Chrome 可用但 managed install marker 缺失”的含义和修复路径。
- R24. `CHANGELOG.md` 必须记录 source/doc/test 变更，并标注 user-visible。
- R25. 不手改 generated runtime mirrors；需要刷新 runtime 时由后续实现使用 `spec-first init --claude|--codex`。

---

## Browser Demand Handoff Contract

为了避免每个下游 skill 写出不同的 opt-in wording，所有 install/repair 触发点必须遵循同一份契约。本节是 R9/R11/R20/U4/U5 共同引用的 source-of-truth。

### Opt-in flag

- 名称：`SPEC_FIRST_BROWSER_HELPER_REQUIRED`
- 形式：环境变量；只接受 `1` / `true` / `yes`（大小写不敏感）作为启用值，其它值或缺省都视为未启用。
- 作用域：仅影响 `agent-browser` helper 的 install / repair / runtime download 路径；不改变 `baseline_ready` 聚合规则、不影响其它 helper、不写入 `mcp-tools.json`。
- 选择 env var 而非 CLI flag 的原因：跨 host (Claude / Codex) 一致，可由用户、上游 workflow、agent prompt 透明传递；setup CLI/PowerShell helper 都已支持 env 透传。
- 实现允许同时识别 `--browser-helper-required` 风格 CLI flag 作为同义形式，但 env var 是 normative 名称；helper facts 与 docs 引用 env var。

### Install / repair 行为表

| 场景 | opt-in flag | demand signals | 行为 |
| --- | --- | --- | --- |
| 默认 setup | 未设置 | 任意 | skip install；helper fact 输出 `result=skipped`、`baseline_blocking=false`、`browser_capability_demand_signals=[...]`、`next_action="set SPEC_FIRST_BROWSER_HELPER_REQUIRED=1 and rerun setup if browser automation is needed"` |
| 用户授权 | 已设置 | 任意 | 进入 install/repair path；任何子步骤失败收敛为 `result=degraded` + `baseline_blocking=false`，并保留具体修复 next_action |
| 显式跳过 | 未设置 | 空 | 同 “默认 setup”；helper fact 仍展示 `result=skipped` 与 opt-in 引导，不报错 |
| `--verify-only` | 任意 | 任意 | 保持 read-only；不安装、不下载、不写 marker；按当前观察输出 ready/degraded/missing；缺失 marker 时输出固定 `next_action="set SPEC_FIRST_BROWSER_HELPER_REQUIRED=1 and rerun spec-mcp-setup install"`，不在 verify-only 路径内自动安装 |

### 下游 skill / agent 引用

R16-R18 涵盖的 browser consumer（`test-browser`、`spec-polish-beta`、`feature-video`、`frontend-design`、`spec-debug`、`spec-figma-design-sync`、`spec-design-implementation-reviewer`、`spec-design-iterator`）的 missing-tool 文案必须引用以下统一 wording 模板：

> Browser automation helper unavailable. To install/repair, set `SPEC_FIRST_BROWSER_HELPER_REQUIRED=1` and rerun `spec-mcp-setup` (or this host's MCP setup entrypoint). This does not block spec-first baseline.

各 skill 可在此基础上追加自身 fallback 行为（`test-browser` stop / `spec-polish-beta` human loop / `feature-video` fallback tier / `frontend-design` mental review / `spec-debug` smallest reproducible loop / 设计 agent 标注 screenshot phase unavailable），但 opt-in 引导段必须保持上述 wording。U4 验收依据是 prompt 与 helper fact `next_action` 文本的 round-trip 一致性。

### 不改的边界

- 不在 `--verify-only` 路径里读写 `agent-browser` 状态以外的环境，例如 npm / global skill cache。
- 不把 opt-in flag 作为 baseline gate；即使设置了 flag，install 失败仍是 non-blocking degraded helper。
- 不为 opt-in 行为新增 capability registry / schema；helper facts 已有的 `result` / `baseline_blocking` / `next_action` 字段继续承担表达。

---

## Implementation Units

### U1. 收敛 setup prose 和 public docs

**Goal:** 把 `agent-browser` 从 public wording 的 “required harness runtime blocker” 改为 “browser automation helper capability”。

**Files:**

- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `skills/spec-mcp-setup/SKILL.md`
- Modify: `skills/spec-mcp-setup/references/supported-mcp-tools.md`
- Modify: `docs/05-用户手册/04-常见问题.md`
- Test/update: `tests/unit/browser-helper-tool-contracts.test.js`
- Test/update: `tests/unit/repository-guidance-contracts.test.js` if guidance wording assertions cover setup/runtime text

**Approach:**

- Keep `agent-browser` documented under helper tooling, not MCP tools.
- Replace “required helper blocks baseline” language with “reported helper capability, non-baseline-blocking when degraded”.
- Add FAQ guidance:
  - `agent-browser install` failure usually means managed Chrome runtime download failed.
  - Existing system Chrome may still make browser automation usable.
  - Do not hand-write the marker.
  - Use setup next actions or `AGENT_BROWSER_EXECUTABLE_PATH` for repair.

**Test Scenarios:**

- README no longer lists `agent-browser` as equal to required MCP/graph baseline dependencies.
- `supported-mcp-tools.md` still excludes `agent-browser` from `mcp-tools.json`.
- Browser helper contract tests continue to assert `agent-browser` is external helper tooling, not bundled source skill.

### U2. Update shell install/preflight helper facts

**Goal:** Make Bash setup helpers demand-aware, and report `agent-browser` as non-blocking skipped/degraded whenever CLI, runtime marker, runtime install, or global skill is unavailable.

**Files:**

- Modify: `skills/spec-mcp-setup/scripts/install-helpers.sh`
- Modify: `skills/spec-mcp-setup/scripts/check-health`
- Test/update: `tests/unit/mcp-setup.sh`
- Test/update: `tests/unit/browser-helper-tool-contracts.test.js`

**Approach:**

- 实现一个轻量 raw-signal collector（不是二元判定器），位于 install helper scope 内：
  - 检查 explicit opt-in env var：`SPEC_FIRST_BROWSER_HELPER_REQUIRED` 是否为 `1`/`true`/`yes`（大小写不敏感）。
  - 收集 deterministic raw signals：browser test deps/scripts、Storybook、常见 web framework 配置文件（Vite/Next/Nuxt/Astro/Remix/SvelteKit/Rails/Django/Phoenix/Laravel）、web surface 目录非空。
  - signals 写入 helper fact 的 `browser_capability_demand_signals[]`，按命中标签字符串原样列出，例如 `package.json:devDependencies.@playwright/test`、`config-file:next.config.js`、`dir:src/app`。
  - 脚本不做"是否前端项目"二元判断；是否安装由 opt-in flag 单独决定。
- Decision tree（与 **Browser Demand Handoff Contract** 行为表一一对应）：
  - opt-in 未设置 → skip 所有 npm install / `agent-browser install` / 上游 skill 安装；helper fact `result=skipped`、`baseline_blocking=false`、`next_action` 走统一 wording。
  - opt-in 已设置 → 进入现有 install/repair path；任何失败收敛为 `result=degraded` + `baseline_blocking=false`，保留具体修复 next_action。
- 复用现有 `baseline_blocking` 字段，不新增 schema。
- 对 `agent-browser` helper fact，所有非 ready 路径都设置 `baseline_blocking=false`；现有 Windows-only 局部豁免逻辑被这个统一规则吸收，不再保留平台分支。
- 保留 sub-status 真实表达：
  - CLI missing → `dependency_status=missing`
  - marker/runtime missing → `install_status=action-required`
  - global skill missing → `skill_status=action-required`
  - install/download failure → `result=degraded` + 具体 next_action
  - skipped → `result=skipped` + opt-in next_action
- 确保 install mode 在 emit JSON helper facts 之前不会因 `agent-browser` 失败提前 abort。
- marker 仅在 `agent-browser install` 真正成功后写入。
- `--verify-only` 保持 read-only；缺失 marker 时按 Handoff Contract 输出固定 next_action。

**Test Scenarios:**

- 无 opt-in flag、无 web 信号 → 不执行 `npm install -g agent-browser@latest`、`agent-browser install`、global skill install；helper fact `result=skipped` + `baseline_blocking=false` + `next_action` 含 `SPEC_FIRST_BROWSER_HELPER_REQUIRED=1` 引导。
- 无 opt-in flag、命中 web 信号（如 `next.config.js`） → 行为与上一条相同，仍 skip 安装；`browser_capability_demand_signals[]` 包含命中条目，便于上游决策。
- 设置 opt-in flag、无 web 信号 → 触发现有 install/repair path；signals 数组可为空。
- 设置 opt-in flag、有 web 信号 → 触发 install/repair path；任何失败均为 `result=degraded` + `baseline_blocking=false`。
- macOS 缺失 marker（opt-in 已设置且 install 失败） → `result=degraded`、`baseline_blocking=false`，ledger `baseline_ready=true`（其它 required tools 已就绪时）。
- Linux 缺失 marker / `agent-browser install --with-deps` 失败 → 同上，non-blocking degraded。
- Windows 行为与 macOS/Linux 完全一致：跨平台 parity 显式断言，原 Windows-only 豁免分支已移除。
- CLI missing 或 global skill missing 在 install 与 verify-only 两种模式下都为 non-blocking helper fact，sub-status 仍标 missing/action-required。
- **Happy path**：opt-in 已设置 + 网络可用 → CLI/runtime/global skill 全部安装成功 → marker 写入 → `result=ready`、`baseline_blocking=false`（ready 状态下该字段语义保留），跨平台一致。
- `--verify-only` 在缺失 marker 时输出固定 `next_action="set SPEC_FIRST_BROWSER_HELPER_REQUIRED=1 and rerun spec-mcp-setup install"`，不写 marker、不安装。
- marker 不会在 `agent-browser install` 失败时被写入。

### U3. Update PowerShell parity

**Goal:** Keep Windows/PowerShell setup behavior aligned with Bash, including demand-aware skipped install.

**Files:**

- Modify: `skills/spec-mcp-setup/scripts/install-helpers.ps1`
- Modify: `skills/spec-mcp-setup/scripts/check-health.ps1`
- Test/update: `tests/unit/mcp-setup-powershell-contracts.test.js`

**Approach:**

- 镜像 U2 的 raw-signal collector：用 PowerShell 的文件系统检查与 package file 解析输出同形态 `browser_capability_demand_signals[]`，不做二元判定。
- 镜像 opt-in 行为：识别 `$env:SPEC_FIRST_BROWSER_HELPER_REQUIRED` 取值，与 Bash 完全一致。
- 镜像 U2 语义：所有 `agent-browser` 非 ready 路径均为 non-baseline-blocking。
- 保留现有 install 命令建议与 `AGENT_BROWSER_EXECUTABLE_PATH` 修复 wording。
- helper fact shape 与 Bash 输出保持兼容；JSON 字段顺序与字段集相同。
- 移除 PowerShell 中"仅 Windows 放宽"的现有局部豁免，改用统一规则。

**Test Scenarios:**

- PowerShell 契约测试覆盖：no-opt-in / opt-in × 有/无 web 信号 四象限的安装行为，与 Bash 在 helper fact 字段层面完全等价。
- Source contract test 验证 `agent-browser` facts 可携带 `baseline_blocking=false` 与 `browser_capability_demand_signals[]`。
- PowerShell helper 仍以 marker 作为 install provenance；install 失败不写 marker。
- PowerShell docs/tests 不再描述 Windows 是唯一的 non-blocking 例外；统一规则下不需要平台分支。
- `--verify-only` 在缺失 marker 时输出 Handoff Contract 规定的固定 `next_action`。

### U4. Align downstream browser consumers

**Goal:** Make every browser consumer’s missing-tool behavior explicit and consistent with the new setup baseline.

**Files:**

- Modify: `skills/test-browser/SKILL.md`
- Modify: `skills/spec-polish-beta/SKILL.md`
- Modify: `skills/feature-video/SKILL.md`
- Modify if needed: `skills/feature-video/references/tier-browser-reel.md`
- Modify if needed: `skills/feature-video/references/tier-static-screenshots.md`
- Modify: `skills/frontend-design/SKILL.md`
- Modify: `skills/spec-debug/SKILL.md`
- Modify: `agents/spec-figma-design-sync.agent.md`
- Modify: `agents/spec-design-implementation-reviewer.agent.md`
- Modify: `agents/spec-design-iterator.agent.md`
- Test/update: `tests/unit/browser-helper-tool-contracts.test.js`
- Test/update: `tests/unit/feature-video-contracts.test.js`
- Test/update: `tests/unit/spec-debug-contracts.test.js`
- Test/update: `tests/unit/spec-polish-beta-contracts.test.js`

**Approach:**

- 不替换 `agent-browser` CLI 命令示例。
- Browser workflow 的 missing-tool prose 必须引用 **Browser Demand Handoff Contract** 中的统一 wording 模板（包含 opt-in 引导那一段），不再在每个 skill 各写一份。
- 各 skill 在统一段落之上追加自身 fallback / skipped / human loop 行为：
  - `test-browser`: 立即停止，不替换为其它 browser tool。
  - `spec-polish-beta`: 继续人工 polish loop，仅自动截图不可用。
  - `feature-video`: preflight 阶段不推荐 browser tier；runtime 失败时降到 static / terminal / skipped。
  - `frontend-design`: 项目自带 Playwright/Cypress/Puppeteer → host browser MCP → `agent-browser` → mental review；最终缺失时显式写 visual verification skipped。
  - `spec-debug`: 任何最小可复现反馈环（MCP browser tools / direct URL / 截图 / 其它）。
  - 设计类 agents：标注 screenshot/browser capture phase unavailable，不暗示 parent workflow 必须先修 setup baseline。
- prompt 中不读取 `~/.agent-browser/spec-first-install.json` 或其它 provider 内部 marker；只检查命令是否可执行或 helper facts 摘要。

**Test Scenarios:**

- Downstream prompts 在需要时仍展示 `agent-browser open` / `snapshot` 命令示例。
- prompts 不再暗示存在本地 `skills/agent-browser` source。
- missing-tool 提示不再声称 spec-first 整体 baseline 失败。
- **Handoff round-trip**：每个 browser consumer 的 missing-tool 段落 wording 与 `install-helpers.*` skipped fact 的 `next_action` 文本一致（同一 opt-in 引导句），由 contract test 用字符串相等或 substring 断言锁定，避免后续 wording 漂移。

### U5. Verify ledger aggregation and no-registry boundary

**Goal:** Prove the setup ledger treats `agent-browser` degraded as baseline-ready while preserving all other required gates, and audit that no downstream consumer reads `agent-browser` ready status as a hard gate.

**Files:**

- Review/modify if needed: `skills/spec-mcp-setup/scripts/verify-tools.sh`
- Review/modify if needed: `skills/spec-mcp-setup/scripts/verify-tools.ps1`
- Review: `skills/spec-mcp-setup/scripts/render-status-block.cjs`
- Test/update: `tests/unit/mcp-setup.sh`
- Test/update: `tests/unit/mcp-setup-powershell-contracts.test.js`
- Test/update: `tests/unit/browser-helper-tool-contracts.test.js`

**Approach:**

- 优先不动 `verify-tools.*`：现有逻辑已支持 `baseline_blocking=false && result=degraded` ⇒ baseline-ready。
- 增加聚焦单测，证明 `agent-browser` skipped/degraded 不会翻转 `baseline_ready=false`。
- 增加 regression 测试，证明 required MCP/graph provider 失败仍会阻塞 baseline。
- 维持 `agent-browser` 不进入 `skills/spec-mcp-setup/mcp-tools.json`。
- **Downstream consumer audit**：在实现前以 grep 列出全仓所有读取 `helper_tools.agent-browser` 或断言 `agent-browser.*result.*ready` 的位点，分类标注：
  - 无需修改：仅展示，不参与决策；
  - 需要 wording 调整：例如 `render-status-block.cjs` 在 `result=skipped/degraded` 时的状态展示，不能让用户误判为 setup baseline 失败；
  - 需要断言更新：测试或脚本中把 `result=ready` 当作硬条件的位置，改为接受 `ready` 或 `skipped/degraded + baseline_blocking=false`。
- 审计结果作为 U5 实现的输入，列入 PR 描述与 changelog 条目。

**Test Scenarios:**

- 无 opt-in、`agent-browser` skipped 且其它工具 ready → `baseline_ready=true`。
- `helper_tools.agent-browser.result=degraded` + `baseline_blocking=false` + 其它 ready → `baseline_ready=true`。
- `jq` 或任一 required MCP provider missing → `baseline_ready=false`。
- `mcp-tools.json` 不包含 `agent-browser`。
- `render-status-block.cjs` 在 `agent-browser=skipped` 时的状态文案不出现 "baseline failed" 类措辞，且包含 opt-in 引导。
- Audit 列表中所有需要更新的位点都在本计划实现里被处理，无遗漏。

### U6. Changelog and runtime handoff

**Goal:** Record the user-visible behavior change and document runtime regeneration expectations without hand-editing generated mirrors.

**Files:**

- Modify: `CHANGELOG.md`
- No direct edits: `.claude/**`
- No direct edits: `.codex/**`
- No direct edits: `.agents/skills/**`

**Approach:**

- Add a `fix(spec-mcp-setup)` or `refactor(spec-mcp-setup)` changelog entry.
- If source skill/agent docs changed and runtime mirrors need refresh, implementation should run `spec-first init --claude|--codex` in the appropriate host context, then inspect generated drift rather than patching runtime mirrors manually.

---

## Verification Plan

按"narrowest first"运行；本计划改动了 `skills/spec-mcp-setup/SKILL.md` 等 source slice，runtime regen 必然触发，因此 `init --dry-run` 上移为默认 verification。

```bash
bash tests/unit/mcp-setup.sh
npm run test:jest -- tests/unit/browser-helper-tool-contracts.test.js tests/unit/mcp-setup-powershell-contracts.test.js tests/unit/feature-video-contracts.test.js tests/unit/spec-debug-contracts.test.js tests/unit/spec-polish-beta-contracts.test.js --runInBand
npm run typecheck
spec-first init --codex --dry-run
spec-first init --claude --dry-run
```

If README, governance docs, generated host guidance, or broader setup contracts change:

```bash
npm run lint:skill-entrypoints
npm run test:mcp-setup
npm run test:smoke
```

Only run full `npm test` when the implementation changes shared CLI/helpers, provider projection, or generated runtime behavior beyond this helper readiness surface.

---

## Risks

- **Silent capability loss:** Users may see `baseline_ready=true` and assume browser automation works. Mitigation: keep `agent-browser` in helper facts with degraded status and explicit next action.
- **Consumer drift:** A browser workflow may still say setup baseline failed. Mitigation: update downstream prompts and contract tests.
- **Over-broad downgrade:** Making all helper tools non-blocking would hide real setup failures. Mitigation: only `agent-browser` gets this treatment; `jq`, required MCP providers, and graph provider projection remain blockers.
- **Marker confusion:** Accepting system Chrome as managed install proof would corrupt provenance. Mitigation: do not write marker unless `agent-browser install` succeeds.
- **Plan/code mismatch:** Existing docs already say `baseline_blocking=false` degraded helpers are allowed; tests must prove the actual ledger behavior, not just prose.

---

## Handoff

Implementation should start with U2/U5 characterization tests: create the failing fixture where only `agent-browser` is degraded and prove current `baseline_ready=false`, then change the helper facts so it becomes `baseline_ready=true` without weakening other required tools.

Do not start by downgrading `agent-browser@latest`. If a future upstream release is proven broken, handle that as a separate temporary package pin with source evidence, changelog, and rollback criteria.
