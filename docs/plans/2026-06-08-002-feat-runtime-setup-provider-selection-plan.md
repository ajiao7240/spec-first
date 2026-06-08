---
spec_id: 2026-06-07-003-runtime-setup-lifecycle
plan_depth: standard
status: completed
type: feat
slice: U2.5 optional provider selection / apply summary
origin: docs/plans/2026-06-07-003-refactor-runtime-setup-lifecycle-plan.md#u2-guided-install-selection
created: 2026-06-08
current_revision: 687df33e
---

# feat: 统一 Runtime Setup optional provider selection / apply summary

## 摘要

本计划是 `docs/plans/2026-06-07-003-refactor-runtime-setup-lifecycle-plan.md` 的窄 follow-up,专门补齐 U2 未闭合的用户入口体验:用户只执行裸 `$spec-mcp-setup` workflow skill,skill 内展示 CodeGraph/Graphify provider pack、workspace 写入面和不会做的事,确认一次即直接 install-init；`--only codegraph,graphify` 保留为 `$spec-mcp-setup` 的非交互/CI/子集选择参数；`--plan` 是可选只读预览。默认执行 target 是当前项目 workspace,provider 的安装/cache/artifact 写入面默认落在 workspace 下。

当前底层生命周期能力已经基本接上:CodeGraph 走 optional MCP route,Graphify 走 optional provider helper route 并支持 project workspace first generation。但 public selection 还分裂:CodeGraph 用 `--only codegraph`,Graphify 仍要求用户知道 `SPEC_FIRST_PROVIDER_GRAPHIFY_CONSENT=approved`。这偏离了 Runtime Setup 的原始目标:`$spec-mcp-setup` skill 应该提供统一、preview-first、显式 opt-in 的用户入口,而不是让用户直接操作底层脚本或 env gate。这里的 preview-first 不等于 mandatory plan-first:裸 `$spec-mcp-setup` 的交互确认一次就是 explicit opt-in；非交互显式传入 `$spec-mcp-setup --only graphify` 或 `$spec-mcp-setup --only codegraph,graphify` 时,`--only` 本身就是授权边界。

> 2026-06-08 follow-up correction：本计划完成后，用户进一步确认 Runtime Setup 目标是“安装初始化后，后续自动保持可用”。因此 Graphify “只装 CLI + first generation”不再足够；后续实施应把项目级 `graphify hook install` 纳入确认后的 provider pack install-init。Graphify SKILL/MCP 仍不默认安装，`graphify watch` 仍不默认启动；hook 是 provider-native auto-refresh setup，不是 spec-first 代刷新。当前计划中“Graphify hook 不装/未来接入”的句子按本 correction 理解为旧边界，已被 supersede。

## Problem Frame

Runtime Setup 的目标不是“只装 CLI”,也不是“自动生成所有上下文”。它负责安装、配置、首次初始化/首次生成,并输出 setup-owned deterministic facts；provider 后续使用与刷新归 provider；workflow 决定是否消费 provider-native MCP/CLI advisory candidates 并回源确认。

现在的问题是 orchestration 层缺口:

- CodeGraph 的 optional 选择已经有 `--only codegraph` 底层参数,但 `$spec-mcp-setup` skill 仍缺少 guided confirm 路径。
- Graphify 的安装/first generation 已可执行,但 public opt-in 仍是低层 env consent。
- `skills/spec-mcp-setup/SKILL.md` 已写 `--plan`,但 skill 内尚未把 `install-mcp.*`/`install-helpers.*` 编排成统一 plan/apply summary。
- 用户无法从同一摘要里看清楚:会安装什么、会写哪里、会不会 first generation、不会做什么。
- 普通 setup 不应要求用户额外提供 requirement workspace；默认就是 resolved project workspace。`--requirement-workspace` 只用于把 Graphify input scope 收窄到项目内某个 repo-relative 子目录。

## Goals

- 为 Runtime Setup 增加统一 optional provider selection:裸 `$spec-mcp-setup` 交互路径通过 guided confirm 选择当前 optional provider pack；headless/CI 通过同一个 `--only <ids>` 同时选择 MCP optional provider 与 non-MCP provider helper。
- 用户只需要执行 `$spec-mcp-setup`;selection、confirm、install-init、verify/readiness facts、final summary 都在该 skill 内闭环完成。
- `--plan` 输出可选只读预览:候选 provider、选择结果、风险、写入面、first-generation 行为、缺少 workspace 时的 next action。
- 裸 `$spec-mcp-setup` 输出 guided confirmation,用户确认一次后直接 install-init,不再做每 provider 二次确认。
- 非交互/CI `$spec-mcp-setup --only <ids>` 直接执行显式选择的 optional provider install-init,不弹 prompt。
- 默认在 resolved project workspace 下执行 install-init；未传 `--requirement-workspace` 时,Graphify 以 project workspace 为 input scope,并把输出写到 workspace-local provider artifact root。
- provider 工具二进制/cache/wrapper 与 first-generation artifacts 默认写入 workspace-local `.spec-first/tools/`、`.spec-first/cache/`、`.spec-first/workspace/providers/`；host MCP config 仍是 host-owned config,只在 summary 中作为 host config write 单独列出。
- 输出 deterministic apply summary:将安装什么/已安装什么、会写/已写哪些 host/project 路径、会运行/已运行哪些 first-generation 命令、哪些动作被跳过。
- 选择 `graphify` 时由 orchestration 内部设置 helper consent,用户不需要知道 `SPEC_FIRST_PROVIDER_GRAPHIFY_CONSENT`。
- 保留 env consent 作为 CI/advanced escape hatch,但不再作为普通用户文档入口。
- 保持 `provider_readiness[]` 是 canonical machine facts;apply summary 是 stdout/human plan view,不是新的长期 source-of-truth。
- Bash 与 PowerShell 行为对齐。

## Non-Goals

- 不实现 TTY checkbox、富编号交互 UI、`--profile team --confirm-profile`;本批只做简单 guided confirmation(yes/no)和 headless flags。
- 不实现 U7 provider uninstall cleanup。
- 不实现 U8 alias migration 或 U9 physical rename。
- 不默认安装 Graphify skill/MCP；不启动 `graphify watch`。项目级 `graphify hook install` 已被 2026-06-08 follow-up correction 纳入确认后的 provider pack auto-refresh 目标，不再作为非目标。
- 不把 Graphify 产物 check-in 到 `docs/` 或晋升为 source truth。
- 不建立 CodeGraph -> Graphify pipeline。
- 不新增 provider fusion/adapters,也不让 setup 做语义代码理解判断。
- 不要求用户直接运行 `install-mcp.sh`、`install-helpers.sh`、`setup-plan-renderer.cjs`;这些只作为 `$spec-mcp-setup` 内部实现脚本。
- 不手改 generated runtime mirrors: `.claude/`、`.codex/`、`.agents/skills/`。

## Direct Evidence

- `skills/spec-mcp-setup/mcp-tools.json`: `codegraph` 是 optional MCP entry,`required:false`,explicit opt-in surface 当前是 `--only codegraph`;install/config/first generation 通过 MCP route 和 `codegraph init`。
- `skills/spec-mcp-setup/provider-tools.json`: `graphify` 是 optional provider,`install_route:"install-helpers"`,版本 pin `graphifyy==0.8.35`,native interface 为 CLI,first generation 由 Runtime Setup 拥有。
- `skills/spec-mcp-setup/scripts/install-mcp.sh`: 当前 internal MCP script 支持 `--only`/`--repo`/`--folder`/`--all-repos`,尚未支持 `--plan` 或 `--requirement-workspace`。
- `skills/spec-mcp-setup/scripts/install-helpers.sh`: 当前 Graphify install/first generation 已实现,但 gate 是 `SPEC_FIRST_PROVIDER_GRAPHIFY_CONSENT=approved`,workspace 参数只在 helper 层,且 current install command 仍是 global-looking `uv tool install`;本 U2.5 需要把 `$spec-mcp-setup` public path 改为 workspace-local install/cache/artifact root。
- `skills/spec-mcp-setup/scripts/setup-plan-renderer.cjs`: 已存在 helper install safety plan renderer,适合作为 provider-aware preview/apply summary 的最小扩展点。
- `tests/unit/dependency-readiness-baseline.test.js` 与 `tests/unit/mcp-setup-powershell-contracts.test.js`: 已覆盖 Graphify first generation、workspace escape、CodeGraph optional skip、provider-readiness v2 等底层事实,但尚未覆盖统一 public selection。
- `docs/01-需求分析/14.harness-engineering/gitnexus-graphify-codegraph-comparison.md`: advisory 对比材料显示 CodeGraph 适合日常频繁开发场景、Graphify 适合架构梳理/技术尽调,支持二者保持 optional 但在显式选择后直接 install-init。限制:该文末速查表仍写 `codegraph init -i` 与 `/graphify .`,与本计划已源码核实的 `codegraph init`、headless `graphify extract <workspace> --out <workspace>/graphify-out --no-cluster` 不一致,不能作为执行命令真相源。

## Decisions

| Question | Recommended Answer | Consequence |
| --- | --- | --- |
| 用户入口是什么? | 只有 `$spec-mcp-setup` skill。脚本是内部执行单元,不作为用户 handoff。 | 用户体验在一个 workflow 内闭环,避免把底层脚本泄漏成新入口。 |
| selection 入口用什么? | `$spec-mcp-setup` 交互路径默认 guided confirm 当前 provider pack;headless/CI/子集选择继续用 `--only <comma-list>`。 | 普通用户不用拼 flag,自动化仍可确定性执行。 |
| Graphify 是否继续暴露 env consent? | 普通用户路径不暴露;`--only graphify` 由 orchestration 内部转成 helper consent。 | 用户看到同一 Runtime Setup 入口;env 仅作 CI/advanced escape hatch。 |
| `--plan` 是否写文件? | 不写文件、不写 facts、不安装、不改 host config。 | 满足 preview-first,避免把 plan view 误当 source-of-truth。 |
| 裸 `$spec-mcp-setup` 是否直接安装? | 是。先展示 guided confirmation,用户确认一次后直接 install-init。 | 防止 silent install,也避免过度审批流。 |
| `$spec-mcp-setup --only ...` 是否需要二次确认? | 不需要。`--only` 是 headless explicit opt-in;apply summary 是非阻塞说明。 | CI/高级用户显式选择后直接得到可用工具。 |
| 默认 workspace 怎么定? | 使用 `resolve-project-target` 得到的 project workspace/root；普通单仓调用不需要额外 workspace 参数。 | 符合“默认都在项目 workspace 下执行”,避免把 requirement workspace 变成必填门槛。 |
| `--requirement-workspace` 还要吗? | 保留为 repo-relative input-scope override,不是普通安装必填项。 | 架构梳理/单需求运行可收窄 Graphify input,默认仍扫项目 workspace。 |
| 安装路径是什么意思? | provider package cache/wrapper/tool dir 和 artifacts 是 workspace-local；host MCP config 是宿主配置写入,不称为 workspace install。 | 保持用户写入预期清晰,也不伪造第三方 host config 的归属。 |
| apply summary 是否成为新 artifact? | 不新增长期 artifact;stdout summary + existing JSON result/facts 足够。 | 保持 light contract;canonical machine surface 仍是 `provider_readiness[]`。 |
| 是否新增 renderer? | 优先扩展 `setup-plan-renderer.cjs`。 | 避免 helper plan 与 provider selection 双份 summary 漂移。 |
| Graphify 缺 requirement workspace 时是否阻塞安装? | 不阻塞,也不跳过默认 first generation；默认 input scope 是 project workspace。只有显式 override 非法时才 skipped。 | 普通用户可直接裸 `$spec-mcp-setup`;仍拒绝绝对路径/escape。 |

## Implementation Units

### U2.5-1. Selection contract 与 preview model

**Goal**:定义一个最小 selection/apply summary model,统一 MCP optional provider 和 non-MCP provider helper 的选择、风险与写入说明。

**Files**:

- `skills/spec-mcp-setup/scripts/setup-plan-renderer.cjs`
- `skills/spec-mcp-setup/mcp-tools.json`
- `skills/spec-mcp-setup/provider-tools.json`
- `docs/contracts/provider-readiness.md`(仅在现有 contract 说明不足时补一句;不新增 schema)
- `tests/unit/dependency-readiness-baseline.test.js`

**Approach**:

- 扩展 `setup-plan-renderer.cjs`,读取 `mcp-tools.json` + `provider-tools.json` + helper registry,输出包含 selected/unselected optional providers 的 plan。
- 支持参数: optional `--only <comma-list>`, optional `--requirement-workspace <repo-relative-path>`, `--repo-root <path>`, `--mode plan|guided-confirm|preflight-summary|result-summary`。
- 对每个 optional provider 输出:
  - `provider` / `kind` / `profile`
  - `selected`
  - `selection_source`
  - `requires_confirmation`
  - `confirmation_prompt`
  - `install_route`
  - `risk_flags`
  - `writes_display`
  - `workspace_root`
  - `tool_install_root`
  - `cache_root`
  - `artifact_root`
  - `first_generation_display`
  - `native_interfaces`
  - `next_actions`
- plan model 只作为 stdout renderer contract,不写入 `.spec-first/config/`。
- 未知 id 必须 blocked,reason_code 建议 `unknown-optional-provider-selection`。

**Test Scenarios**:

- `--only codegraph,graphify` 同时选中 CodeGraph 和 Graphify。
- interactive guided mode 默认展示 CodeGraph + Graphify provider pack,需要用户确认一次才进入 mutation。
- guided confirm declined 时 optional providers skipped,required baseline 可继续或按 workflow surface 返回 skipped summary。
- `--only graphify` 输出 Graphify CLI install 与 first generation plan,但不包含 CodeGraph host MCP config write。
- Graphify 未传 `--requirement-workspace` 时,plan 显示 input scope 为 project workspace,artifact root 为 workspace-local provider path。
- Graphify 显式传入非法 `--requirement-workspace` 时,plan 显示 first generation 将 skip,`next_action=requirement-workspace-absolute|escape|missing`。
- `--only unknown` 返回 action-required/blocked summary,不继续 apply。

### U2.5-2. Internal Bash orchestration

**Goal**:让 `$spec-mcp-setup` 的内部 Bash path 能用同一 selection model 驱动 CodeGraph + Graphify,支持可选 `--plan` 和非阻塞 apply summary。

**Files**:

- `skills/spec-mcp-setup/scripts/install-mcp.sh`
- `skills/spec-mcp-setup/scripts/install-helpers.sh`
- `skills/spec-mcp-setup/SKILL.md`
- `tests/unit/mcp-setup.sh`
- `tests/unit/dependency-readiness-baseline.test.js`

**Approach**:

- `install-mcp.sh` 增加 `--plan` 与 `--requirement-workspace <repo-relative-path>` 参数解析,但仍作为 `$spec-mcp-setup` 内部脚本。
- `--plan` 调用 `setup-plan-renderer.cjs` 后退出;不得 warm package、写 host config、运行 helper install、创建 Graphify artifact。
- 裸 `$spec-mcp-setup` 进入 skill 默认 guided setup mode,内部可映射到 existing install mode,但不要求用户传 `--install`。
- 交互式 `$spec-mcp-setup` 且未传 `--only` 时,先渲染 guided confirmation:默认候选为当前 optional provider pack(CodeGraph + Graphify),展示 workspace-local install/cache/artifact roots、host config writes、first-generation 命令和不会做的事。用户确认后直接执行 install-init;用户拒绝则跳过 optional providers。
- `$spec-mcp-setup --only <ids>` 直接执行显式选择的 optional provider;不得在脚本内新增 blocking confirm prompt。非 TTY/CI 路径也不需要额外 env confirm。
- 非交互 `$spec-mcp-setup` 未传 `--only` 且无法 prompt 时,不得安装 optional providers;返回 baseline-only summary 和 next_action 指向 `$spec-mcp-setup --only codegraph,graphify` 或交互重跑。
- 所有 provider install-init 命令默认在 resolved project workspace 下执行。Bash path 必须把 workspace-local roots 传给 helper/MCP route,例如 tool root `.spec-first/tools/`,cache root `.spec-first/cache/`,provider artifact root `.spec-first/workspace/providers/<provider>/...`。
- CodeGraph route 不做 global npm install；继续使用 pinned `npx -y @colbymchenry/codegraph@0.9.9`,但 npm cache 应优先指向 workspace-local cache。`codegraph init` 在 project workspace cwd 运行,artifact 仍是 workspace 下 `.codegraph/`。
- Apply/install path 在执行前打印 preflight summary,执行后返回 result summary;summary 必须包含:
  - selected optional providers
  - required baseline MCP/helper actions
  - host config writes
  - project bootstrap writes
  - Graphify artifact root
  - first generation run/skip reason
  - explicit “will not install Graphify skill/MCP; will not run graphify .; will not promote artifacts to docs”; follow-up correction 还要求展示 project hook auto-refresh setup
- 当 `--only` 包含 `graphify` 时,由 orchestration 调用 `install-helpers.sh --install --requirement-workspace <path>` 并注入 `SPEC_FIRST_PROVIDER_GRAPHIFY_CONSENT=approved`。
- 当 `--only` 包含 `graphify` 且未传 `--requirement-workspace` 时,helper 默认把 input scope 设为 project workspace,artifact root 设为 `.spec-first/workspace/providers/graphify/graphify-out`。不得写 repo-root `graphify-out/`。
- Graphify install route 必须从 global-looking `uv tool install` 收敛到 workspace-local tool/cache path。实现前先探测当前 `uv tool install --help` 支持的 local bin/tool dir 参数;若本机 uv 不支持 local tool dir,使用 workspace-local `uvx`/wrapper/cache 方案,不要退回 user-global install。
- 当 `--only` 不含 `graphify` 时,不得设置 Graphify consent,不得安装 Graphify。
- 保留直接调用 `install-helpers.sh` + env consent 的 advanced/CI escape hatch。
- `--all-repos` 子 repo 调用要透传 `--only` 与 `--requirement-workspace` 时必须明确语义;若 workspace 是 repo-relative,只在每个 child repo 内解析,不能从 parent workspace 逃逸。

**Test Scenarios**:

- `$spec-mcp-setup --plan` 经内部 script 输出 plan JSON/summary,不调用 `uv`、`npx`、`graphify`,不写 host config;summary 显示 project workspace input scope 与 workspace-local artifact root。
- interactive `$spec-mcp-setup` 显示 guided confirmation;输入 yes 后安装 CodeGraph + Graphify provider pack 并运行 workspace-local first generation。
- interactive `$spec-mcp-setup` 输入 no 后 optional providers skipped,不触发 Graphify consent。
- non-interactive `$spec-mcp-setup` 未传 `--only` 时不安装 optional providers,输出 next_action。
- `$spec-mcp-setup --only graphify` 能安装 Graphify path,调用 helper 时由 skill 内部设置 Graphify consent,调用者 env 不需要 `SPEC_FIRST_PROVIDER_GRAPHIFY_CONSENT`。
- `$spec-mcp-setup --only graphify` 不等待二次确认,直接进入 Graphify install-init 路径。
- Graphify package/cache/wrapper 不写 user-global tool dir；测试用 fake HOME/path 证明输出路径在 project workspace `.spec-first/` 下。
- 默认 `install-mcp.sh` 不安装 CodeGraph 或 Graphify optional provider。
- `--only codegraph` 仍只走 CodeGraph MCP route,不触发 Graphify helper。
- `--only codegraph,graphify` 两条 route 都出现,且 provider artifacts 写入 project workspace。
- `--only graphify --requirement-workspace bad/escape` 时 CLI install 可继续,first generation skipped,summary/facts 给出 workspace resolver reason_code。

### U2.5-3. PowerShell parity

**Goal**:PowerShell 入口与 Bash 在 selection、plan、非阻塞 apply summary、Graphify consent internalization 上保持一致。

**Files**:

- `skills/spec-mcp-setup/scripts/install-mcp.ps1`
- `skills/spec-mcp-setup/scripts/install-helpers.ps1`
- `tests/unit/mcp-setup-powershell-contracts.test.js`

**Approach**:

- 增加 `-Plan`、`-Only` comma-list、`-RequirementWorkspace` 对齐 Bash。
- `-Plan` 只渲染 summary,不执行 mutation。
- 交互式 `-Install` 未传 `-Only` 时显示 guided confirmation;确认后直接执行 provider pack install-init。
- `-Install -Only <ids>` 直接执行显式选择的 optional provider,不新增 blocking confirm prompt。
- 默认 target、tool/cache/artifact root 与 Bash 相同:resolved project workspace 下的 `.spec-first/tools/`、`.spec-first/cache/`、`.spec-first/workspace/providers/`。
- 选择 Graphify 时内部传递 helper consent,不要求用户设置 env。
- PowerShell safety classification 继续与 `setup-plan-renderer.cjs` 对齐,避免 Bash/PowerShell 风险摘要漂移。

**Test Scenarios**:

- PowerShell plan mode 不安装、不写配置、不运行 first generation。
- interactive PowerShell install confirm yes 后安装 provider pack;confirm no 后跳过 optional providers。
- `-Only graphify` 不需要外部 Graphify consent env,默认在 project workspace 下 install-init。
- `-Only graphify` 不等待二次确认。
- `-Only codegraph,graphify` summary 与 Bash 字段语义一致。
- 未选择 optional provider 时 CodeGraph/Graphify 都不出现为 action-required baseline blocker。

### U2.5-4. Skill prose 与 registry user-facing next actions

**Goal**:把文档入口从低层 env consent 收敛到 public Runtime Setup selection,避免继续误导用户手动设置 Graphify env。

**Files**:

- `skills/spec-mcp-setup/SKILL.md`
- `skills/spec-mcp-setup/provider-tools.json`
- `skills/spec-mcp-setup/references/supported-mcp-tools.md`
- `CHANGELOG.md`
- 必要时 `docs/01-需求分析/13.scale-integration/Runtime-Setup目标.md`

**Approach**:

- `SKILL.md` 的 Workflow Modes 明确:
  - public guided path: `$spec-mcp-setup`,展示 CodeGraph/Graphify provider pack + workspace writes + 不会做的事,确认一次后直接 install-init。
  - public preview path: `$spec-mcp-setup --plan`。
  - headless/subset apply path: `$spec-mcp-setup --only codegraph,graphify`;显式 `--only` 后直接 install-init,不要求二次确认。
  - optional scoped path: add `--requirement-workspace <repo-relative-path>` only when the user wants Graphify input scope narrower than the project workspace。
  - helper env consent 是 internal/advanced escape hatch,不是普通用户入口。
- `provider-tools.json` 的 `next_action` 从 “设置 `SPEC_FIRST_PROVIDER_GRAPHIFY_CONSENT=approved`” 改为 “run `$spec-mcp-setup` and confirm the provider pack; use `$spec-mcp-setup --only graphify` for headless/subset install; add `--requirement-workspace <path>` only for scoped graph generation”。
- `SKILL.md` frontmatter `argument-hint` 必须把裸 `$spec-mcp-setup` 标为 primary path;`--check`/`--verify-only`/`--plan`/`--only`/`--requirement-workspace` 标为 advanced optional flags,不再把 `--install` 放进普通用户入口提示。
- 保留 version pin `graphifyy==0.8.35`,不改成 latest。
- 不改 generated runtime mirrors。

**Test Scenarios**:

- contract tests 不再要求用户-facing next_action 暴露 Graphify consent env。
- docs/tests 仍保留 env consent 作为 advanced helper gate,但不作为 public setup instruction。

### U2.5-5. Verification matrix

**Goal**:用最窄测试锁住 public selection 行为,再扩到 setup contract 与语法检查。

**Files**:

- `tests/unit/dependency-readiness-baseline.test.js`
- `tests/unit/mcp-setup-powershell-contracts.test.js`
- `tests/unit/mcp-setup.sh`
- `tests/unit/scale-provider-doc-contracts.test.js`

**Verification Commands**:

```bash
npx jest tests/unit/dependency-readiness-baseline.test.js tests/unit/mcp-setup-powershell-contracts.test.js tests/unit/scale-provider-doc-contracts.test.js --runInBand
bash tests/unit/mcp-setup.sh
npm run typecheck
git diff --check
```

Broader validation (`npm run test:mcp-setup` or `npm test`) only becomes necessary if implementation touches shared setup facts normalization, doctor projection, runtime generation, or dual-host governance.

## Source / Runtime Boundary

Source-of-truth changes belong in:

- `skills/spec-mcp-setup/**`
- `docs/contracts/**` if existing contract prose needs clarification
- `docs/01-需求分析/13.scale-integration/**` if target docs mention public setup commands
- `tests/unit/**`
- `CHANGELOG.md`

Generated runtime mirrors are out of scope:

- `.claude/**`
- `.codex/**`
- `.agents/skills/**`

If runtime regeneration is needed after implementation, run `spec-first init` from source; do not patch mirrors.

## Risks & Mitigation

| Risk | Mitigation |
| --- | --- |
| Graphify env consent remains in user-facing docs and selection stays split. | U2.5-4 rewrites public next_action and tests against regression. |
| `--plan` accidentally mutates host config or project artifacts. | U2.5-2/U2.5-3 tests stub commands and assert no writes/no command calls. |
| Direct install-init becomes baseline silent install. | Bare interactive `$spec-mcp-setup` requires one guided confirmation; non-interactive invocation without `--only` stays baseline-only/action-required. |
| Summary becomes a second canonical facts source. | Plan explicitly keeps summary as stdout/human view; `provider_readiness[]` remains canonical machine surface. |
| Provider registry starts executing arbitrary JSON commands. | Renderer may display registry commands; execution remains controlled script cases. |
| Local install path quietly falls back to user-global package install. | Tests set HOME/cache outside repo and assert selected provider package/cache/wrapper paths are under project workspace `.spec-first/`; host MCP config is the only expected non-workspace write. |
| Missing Graphify scoped workspace silently writes repo-root `graphify-out/`. | Default artifact root is `.spec-first/workspace/providers/graphify/graphify-out`; invalid explicit override skips first generation with resolver reason_code. |
| Bash/PowerShell drift. | U2.5-3 parity tests compare behavior and safety classification. |

## Handoff Summary

artifact-summary.v1:

- goal: 统一 Runtime Setup optional provider selection 与 apply summary。
- scope: U2.5 follow-up over existing Runtime Setup lifecycle plan; bare `$spec-mcp-setup` owns the full loop, interactive guided confirmation, public/headless `--only`, optional `--plan`, direct install-init after confirmation or explicit flags, non-blocking apply summary, Graphify consent internalization, Bash/PowerShell parity。
- non_goals: TTY checkbox、profile overlay、U7 uninstall、U8 alias、U9 physical rename、Graphify skill/MCP install、provider fusion；Graphify project hook install 已由 2026-06-08 follow-up correction 改为后续目标。
- implementation_units: U2.5-1 selection model; U2.5-2 Bash orchestration; U2.5-3 PowerShell parity; U2.5-4 prose/next_action; U2.5-5 verification。
- validation_focus: plan no mutation; selected Graphify no user env; optional unselected no install; default project workspace install-init; workspace-local tool/cache/artifact paths; invalid scoped workspace skip; Bash/PowerShell parity。
- evidence_paths: `skills/spec-mcp-setup/mcp-tools.json`, `skills/spec-mcp-setup/provider-tools.json`, `skills/spec-mcp-setup/scripts/install-mcp.sh`, `skills/spec-mcp-setup/scripts/install-helpers.sh`, `skills/spec-mcp-setup/scripts/setup-plan-renderer.cjs`, `tests/unit/dependency-readiness-baseline.test.js`, `tests/unit/mcp-setup-powershell-contracts.test.js`。
- recommended_next_action: 进入 `$spec-work` 执行本 U2.5 plan,不要继续实现 alias/rename/uninstall 延期项。
