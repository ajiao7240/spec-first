# Runtime Setup 目标模型

> 本文记录 2026-06-07 的 Runtime Setup 设计意图，作为后续 `spec-mcp-setup` 迁移为 `spec-runtime-setup`、provider onboarding、CodeGraph / Graphify / 其他 runtime 工具接入的指导方向。它不是某个版本的执行清单；具体落地以对应 plan / task pack 为准。

## 1. 一句话目标

Runtime Setup 的目标不是“只装 MCP”，也不是接管外部工具生命周期，而是：

```text
Runtime Setup = 安装 + 配置 + 首次初始化/首次生成 + 输出工具说明
Provider 原生能力 = 后续刷新 + 查询 + 使用接口 + 内部缓存/产物管理
下游 skill = 读取工具说明,按当前任务自行决策是否调用 provider 原生能力
```

它应该让 agent 在进入 `spec-plan` / `spec-work` / `spec-code-review` / `spec-debug` 时知道当前 workspace 已经有哪些工具可用、哪些已经完成初始化、应该通过什么 MCP/CLI 接口使用、freshness 如何、缺失或 stale 时如何降级。

> 2026-06-09 执行校准：裸 `$spec-mcp-setup` 的目标不是“装完 CLI + 首次生成后让用户自己维护”，而是“确认后完成安装、初始化，并启用 provider-native 的项目级自动刷新机制，使后续节点默认可用”。CodeGraph 使用 verified package `@colbymchenry/codegraph@0.9.9` 安装出 `codegraph` CLI，再执行 `codegraph init` / `codegraph status`；若 status 报 `Pending Changes`，setup 做一次有界 `codegraph sync` 并复查 status。host MCP 命令是 `codegraph serve --mcp`，后续 freshness 交给 CodeGraph Auto-Sync watcher。Graphify 使用 `graphifyy==0.8.36` 安装 `graphify` CLI，执行 project-scoped `graphify install --project --platform <host>`、项目根 `graphify extract .`；若 mixed docs/images 仓库因缺语义 API key 导致 extract 失败，setup 自动降级到 AST-only `graphify update .`，只要产出 `graphify-out/graph.json` 或 `GRAPH_REPORT.md` 就继续安装 `graphify hook install` 作为代码图自动刷新 setup。`graphify watch` 和 Graphify MCP server 不作为默认动作。

## 2. 生命周期归属

| 归属 | 负责 | 不负责 |
| --- | --- | --- |
| Runtime Setup | 检测 host/runtime 状态；安装 skill / MCP / CLI / helper；配置 host/runtime；执行 provider-native 初次 init / bootstrap / first generation；在用户确认后启用 provider-native 项目级自动刷新 setup（如 Graphify hook）；验证工具接口；输出已安装、已初始化与自动刷新状态说明 | 在下游 workflow 运行期 lazy 安装；替 provider 自造长期刷新逻辑；启动长运行 watch/daemon；把 provider 输出晋升为 confirmed truth |
| Provider 原生能力 | steady-state 维护（按形态：daemon 式走原生 watcher / hook / refresh，快照式按需重跑）；MCP / CLI query surface；内部 index / cache / artifact；provider-native cleanup / uninstall 语义 | 代表 spec-first 做语义判断；替 workflow 决定当前任务是否应该使用它 |
| 下游 skill / workflow | 读取 Runtime Setup 输出的说明；根据当前任务判断是否调用可用工具；通过 provider-native MCP/CLI 接口获取 advisory candidates；回源确认结论 | 主动安装工具；主动生成/刷新 provider artifact；直接消费 provider 内部 schema 或全量产物 |

### 2.1 刷新归属按 provider 形态分档

“后续刷新交还 provider” 不是一刀切，必须按 provider 形态分档。这一点有外部一手证据支撑（见本文末「证据基线」）：重型 daemon 式索引器由 provider 原生代管刷新（Sourcegraph auto-indexing 由实例自身后台 scheduler 周期重建，集成方不逐次触发）；而库式 / 语言服务器形态的变更检测，业界（LSP 3.17、tree-sitter）反而把归属放在集成方而非每个 provider 自建 watcher。

分档的**主轴是「steady-state 刷新由谁拥有」**，不是「provider 长什么样」：provider 自动代管 / 用户显式触发 / spec-first 不托管。下表的形态列只是这条主轴的常见落点示例，遇到不规整的 provider（如持久 server 但不自带 watcher 的 LSP-style 服务、远端 SaaS）时，按「刷新归谁」归位，不必强塞进某个形态名。**不变量：形态分档仅是 setup-side onboarding 元数据，绝不下放成下游分支键——下游 manifest/说明只暴露 `capability_class` + `readiness_status` + `native_interfaces`，下游不以 provider 形态做调用分支，也不新增 `provider_form` registry enum（守 capability-aware 解耦，防 GitNexus 复发）。**

| Provider 形态 | 代表 | steady-state 归属 | spec-first 边界 |
| --- | --- | --- | --- |
| daemon 式（持久 server + 自带 watcher 做增量同步） | CodeGraph（MCP serve + `.codegraph/codegraph.db`；file-watcher 增量 sync 经本地源码核实，见 CodeGraph 子方案 §4.1 形态实证） | provider 原生 watcher / MCP 代管刷新 | Runtime Setup 只做 first generation；刷新完全交还 provider，spec-first 不背 stale 责任 |
| 快照式 CLI（无持久 daemon，产出 provider-owned project artifact） | Graphify（CLI 产 `graphify-out/`） | Graphify 原生 CLI/MCP/hook 负责后续 refresh/use；无默认 steady-state daemon；裸 `$spec-mcp-setup` 确认 provider pack 后应安装项目级 hook 自动刷新 | Runtime Setup 做 first generation + project hook onboarding；不启动 `watch`，不代管 hook 内部刷新逻辑；下游缺/旧时 fallback 或提示用户修复 provider-native refresh |
| 进程内 / 库式（无独立生命周期） | tree-sitter 类原语 | 变更检测归宿主调用方，非 provider 自建 watcher | 不作为 Runtime Setup 托管的 steady-state provider |

关键判断：生命周期二分（first-generation 属 setup / steady-state 属 provider）对 daemon 式是干净的；对快照式 CLI，setup 不能启动长运行 watcher，但可以在用户确认的 provider pack 内启用 provider-native project hook，使后续刷新由 hook 代管。Graphify 的 hook（如 post-commit / post-checkout）仍归 provider 原生而非 Runtime Setup；Runtime Setup 只负责安装/验证/记录 hook 状态，失败时输出 action-required。不要用“provider watcher 代管刷新”框架硬套快照式工具。

## 3. 首次生成规则

Runtime Setup 可以负责首次初始化或首次生成，但必须满足这些边界：

- 只发生在用户显式进入 Runtime Setup / install-init mode 时。
- 对 optional provider 必须经过 explicit gate / opt-in。
- 执行的是 provider-native init / generate / bootstrap 命令，不由 spec-first 自造生成逻辑。
- 目标 scope 必须明确，例如当前 repo、默认 project workspace、当前需求 workspace 或用户指定 workspace。
- 生成物默认是本地 provider-owned 上下文，不自动 check-in，不自动 promotion 到长期 docs；具体 scope 由 provider 形态决定，Graphify 默认是项目根 `graphify-out/`。
- Graphify 生成物默认写入 provider-native 项目根目录 `graphify-out/`；缺少 `--requirement-workspace` 时 input scope 默认是 resolved project workspace。
- requirement workspace resolver 的显式 `--requirement-workspace <repo-relative-path>` 只是 input-scope override；绝对路径、`..` escape、缺失或 symlink escape 的显式 override 必须跳过 Graphify first generation 并输出 resolver reason_code。即使 input scope 被收窄，默认输出仍应回到项目根 `graphify-out/`，以匹配 Graphify skill/query/hook 的快速路径。
- 首次生成完成后，Runtime Setup 应为已选择 provider 尽最大努力启用 provider-native 自动刷新机制：daemon 式交给 watcher/MCP；Graphify 这类快照式 CLI 走项目级 `graphify hook install`。若 hook 安装或验证失败，写入 action-required facts，由 LLM 在 `$spec-mcp-setup` 流程内做有界修复或明确 next action。
- 下游 `spec-plan` / `spec-work` / `spec-review` / `spec-debug` 只能读取说明并调用已有工具接口；不能在运行期补装、补生成或补刷新。

例子：

- CodeGraph（daemon 式）：Runtime Setup 安装 scoped npm package `@colbymchenry/codegraph@0.9.9`，配置 MCP 为 `codegraph serve --mcp`，执行首次 `codegraph init` 并用 `codegraph status` 验证；之后索引同步与查询走 CodeGraph 原生 MCP / Auto-Sync watcher 代管刷新。
- Graphify（快照式 CLI + assistant skill）：Runtime Setup 可安装 CLI（PyPI 包 `graphifyy==0.8.36`，bin `graphify`），执行当前 host 的 project-scoped skill install（例如 Codex: `graphify install --project --platform codex`），并为当前 project workspace 执行首次 project-graph 生成。setup 内部先使用脚本化 CLI 路径 `graphify extract .` 生成项目根 `graphify-out/`；若 full-pipeline semantic extract 因缺 API key 或 mixed docs/images 失败，默认 project-root scope 下自动 fallback 到 `graphify update .`（AST-only/no LLM）。`$graphify .` / `/graphify .` 是安装后 assistant UX。裸 `$spec-mcp-setup` 确认 provider pack 后应继续执行项目级 `graphify hook install` 让后续代码 AST 刷新由 provider hook 触发；docs/images/papers 仍需 `$graphify --update` 或等价用户动作。`graphify watch` 是长运行进程，不作为默认 setup 动作；Graphify MCP server 是可选 extra，不默认安装。
- 其他 helper / MCP / provider：按 §2.1 形态分档声明 install、configure、first generation、query surface、refresh owner（daemon 式才有 refresh owner，快照式标注“按需重跑”）。

## 4. 工具说明产物

Runtime Setup 应输出 setup-owned 工具说明，给后续 skill 读取。canonical machine consumer surface 是既有 `.spec-first/config/tool-facts.json` 内的 `provider_readiness[]`（`provider-readiness.v2`）；`runtime-tooling-summary.md` 只是从同一组 deterministic facts 派生的人类可读视图，可缺失，缺失本身不触发 degraded。下游不得从 registry 或 provider artifact 推断能力可用，只能读取 `provider_readiness[]`，并在缺失、`not-run`、`unknown`、`stale` 或 `degraded` 时 fallback 到 direct source evidence。

建议 `provider_readiness[]` v2 entry 结构：

```json
{
  "schema_version": "provider-readiness.v2",
  "provider": "codegraph",
  "kind": "code-structure",
  "profile": "optional",
  "readiness_status": "fresh|stale|degraded|not-run|unknown",
  "native_interfaces": ["mcp", "cli"],
  "lifecycle": {
    "installed": true,
    "configured": true,
    "initialized": true,
    "indexed": true,
    "server_reachable": true,
    "artifact_exists": true,
    "query_verified": true,
    "fallback_used": false
  },
  "first_generation": {
    "owner": "runtime-setup",
    "status": "completed",
    "scope": "project",
    "requires_explicit_gate": true,
    "requirement_workspace_path": null,
    "artifact_root": ".codegraph",
    "artifact_refs": [".codegraph/codegraph.db"]
  },
  "steady_state": {
    "refresh_owner": "provider-native",
    "refresh_mode": "watcher",
    "hook_default": false,
    "usage_owner": "downstream-skill"
  },
  "usage_note": "Use provider-native MCP tools for impact/call graph candidates; confirm conclusions from source/test/log/contract/user evidence."
}
```

这份说明的语义边界：

- 它是 advisory setup fact，不是 source-of-truth。
- 它是 spec-first setup-owned 的 application-layer 工具说明，不对标也不宣称等同 MCP 原生 capability negotiation / `tools/list` 机制。MCP 一手规范只提供 init 期能力类声明 + 运行时动态发现 + model-controlled 自决，其 `tools/list` 载荷不含 freshness 字段，也不是“setup 一次产出、多个下游静态读取”的 manifest；freshness / 调用说明是 spec-first 自加的便利层，须如实标注来源，不得包装成协议原生能力。
- 它告诉 skill “有什么能力可用、怎么调用、当前是否初始化”，不告诉 skill “必须使用哪个工具”。
- 它可以携带 artifact refs，但 artifact refs 只是 backing store 或 fallback summary，不是主要消费接口。
- 它必须携带 freshness / readiness / limitation，让下游 skill 能做 fallback。

## 5. 配置文件分类

外部 agent、skill、MCP 工具、CLI helper、provider 等能力应该集中到少数 registry/config 文件中，避免散落在脚本分支、workflow prose 或 host runtime mirror 里。

建议分类：

| 配置类别 | 内容 | 主要 owner | 典型消费方 |
| --- | --- | --- | --- |
| Skill registry / governance | public workflow、standalone skill、internal helper skill 的 source path、host delivery、visibility、entrypoint alias | spec-first source | `init`、`doctor`、Runtime Setup、workflow entry governance |
| Agent registry / governance | bundled agent profile、外部 agent profile、allowed dispatch posture、source/runtime projection | spec-first source | `init`、review/debug/workflow dispatch |
| MCP registry | required MCP、optional MCP provider、host config template、install/config/bootstrap metadata | Runtime Setup | `install-mcp.*`、host configure、tooling manifest |
| Helper tool registry | `rg`、ast-grep、jq、gh、agent-browser 等 CLI/helper dependency、install safety、baseline/profile | Runtime Setup | `install-helpers.*`、readiness renderer |
| Provider registry | non-MCP provider、first generation、native interfaces、artifact scope、refresh owner、uninstall route | Runtime Setup | provider onboarding、runtime tooling manifest |
| Runtime profile / overlay | registry profiles(当前 source 实用 minimal/optional/recommended/platform) | 用户/团队 + setup | Runtime Setup plan/check/install mode |

配置文件只声明 deterministic metadata：安装来源、版本 pin、风险标记、是否 optional、first generation 命令类别、native interface、refresh owner、cleanup owner。脚本只能执行受控 case，不执行 registry 内的任意 shell 字符串。

这套分类的目标是插拔和管理：

- 新增 provider 时先加 registry item，再接受控脚本 case 和 tests。
- 禁用 provider 时改 profile，不改 workflow prose。
- `team` / `user` 不是当前 registry enum，**也不在本批实现**:source 中 `team`/`user`/`overlay` 当前零消费者。provider registry 只新增 `optional` 作为「不进 recommended baseline、必须 explicit opt-in」的轻量姿态；team/user 仅作为「未来 policy 输入方向」备注保留。真要做时它们是外层 policy overlay,解析后映射到现有 profile 或显式 item allowlist,且必须同步改 schema、loader、fixtures 和 tests,作为独立切片执行。
- 下游 skill 只读 Runtime Setup 输出的工具说明，不直接解析 registry。
- host runtime mirror 不作为 source；需要刷新由 `spec-first init` 或 Runtime Setup 执行。

新增工具的理想路径是 **configuration-first**，但不是所有工具都能只改配置：

| 新增类型 | 是否只改 registry/config | 还需要什么 |
| --- | --- | --- |
| 已有 kind、已有 installer、已有 first-generation case 的同类工具 | 通常可以 | 补 registry item、profile/overlay、doc/test fixture |
| 已有 installer，但需要新的 first-generation / cleanup 行为 | 不够 | 新增受控脚本 case、preview 文案、回归测试 |
| 新的 host 配置类型或新的 MCP/agent/skill delivery 方式 | 不够 | 扩展 generator / host adapter / governance schema 和测试 |
| 需要新权限、新包管理器或 destructive cleanup 的工具 | 不够 | 新增 safety gate、风险标记、确认文案、卸载/cleanup 合同 |
| 只作为下游手动使用的外部能力，不需要 Runtime Setup 安装 | 可以只登记为 advisory capability | registry 标注 `install_owner=user`，Runtime Setup 只展示说明/next_action |

因此，registry 是接入入口和管理面，不是任意工具执行引擎。新增工具应先问：它是否复用现有 kind + installer + controlled action case？如果是，新增配置即可；如果不是，必须补最小脚本 case 和验证。

### 5.1 Provider 准入门槛

configuration-first 把“装”的技术门槛降到很低，这恰恰抬高了“该不该装、该不该进 recommended baseline”的治理门槛。每接一个 provider 的真实成本是：registry item + safety gate + readiness 映射 + 双宿主生成 + 下游 prose + 测试矩阵 + 上下文噪声。外部一手证据（VS Code extension recommendations 可忽略不强装、devcontainer Features opt-in）支持“装得轻、用户可拒”，但不支持“能装就默认装进 baseline”。抗膨胀是本项目生死线，因此任何 provider 进入 registry 前必须显式回答：

- 它服务核心 workflow 链路（Codebase → Spec → Plan → Tasks → Code → Review → Knowledge）的哪个明确节点，或改善哪一项输入质量 / 证据链 / 复用 / 审查闭环 / 知识沉淀？
- 有无真实研发增益证据（dogfood 或一手对标），而不是“看起来有用”？
- 它的边际成本是否陡升（新 first-generation / 新权限 / 新包管理器 / 新 host 配置类型 / destructive cleanup）？

判定规则：

- 三问都过且边际成本不陡升 → 可进 `recommended`，仍须 opt-in gate。
- 增益真实但边际成本陡升，或增益证据偏弱 → 只进 optional / degraded / explicit opt-in，不进 `recommended` baseline。
- 不服务核心链路 → 不进 registry，最多登记为 `install_owner=user` 的 advisory capability，由用户自行安装。

没有这道门槛，“快速集成优秀能力”会退化成“快速膨胀”。

这道门槛也必须回溯校验存量：CodeGraph（新 first-generation `codegraph init` + global-npx + pre-1.0）与 Graphify（新 first-generation + `name-bin-mismatch` + single-maintainer + global-uv）按上面「边际成本陡升不进 recommended」的规则都命中陡升项，因此 registry 将两者降为 `profile: optional` 并保留 explicit opt-in gate（CodeGraph 使用 `opt_in.explicit_consent_required`，Graphify 使用 consent env / install gate）。`optional` 是现有 provider 接入姿态，不是 team/user overlay；准入门槛是 plan/review 时由人回答的判断 checklist（Let the LLM decide），不生成校验脚本、不进 CI gate；落地测试只锁「门槛文档存在」与存量 provider 不在 `recommended` baseline，不构造准入校验器或 `admission-gate` schema。

## 6. 引导式安装流程

Runtime Setup 安装外部能力应采用两步式：

```text
1. Plan / Preview
   展示可安装工具清单、推荐原因、风险、安装位置、是否会首次生成产物

2. Apply / Confirm
   用户勾选要安装的工具后，再执行安装/配置/首次初始化
```

Plan / Preview 阶段只读：

- 读取 registry/profile/overlay。
- 检测当前 installed/configured/initialized/readiness 状态。
- 生成推荐默认项，但不安装、不配置、不执行 first generation。
- 展示每个候选工具的 capability、收益、风险、scope、写入位置、first generation 行为、steady-state owner。

Apply / Confirm 阶段才允许变更：

- 用户明确勾选或通过显式 profile policy 预授权。
- Runtime Setup 渲染最终安装计划。
- 用户二次确认后执行受控 install/config/first-generation case。
- 输出 runtime tooling manifest/summary。

交互形态按运行环境分层：

| 环境 | 交互方式 | 规则 |
| --- | --- | --- |
| TTY | checkbox / numbered multi-select | 可预选 recommended defaults，但必须用户确认 |
| 非 TTY / chat host | 输出 numbered plan，用户回复编号或传 `--only codegraph,graphify` | 不接受静默默认安装 |
| CI / team policy | 显式 policy file / env allowlist / 等价配置 | 只能安装 policy 已授权项，仍输出 plan 和结果；若未来新增 `--profile team --confirm-profile`，必须先补 CLI/schema/help/tests |

示例展示：

```text
Runtime Setup 检测到可选能力:

[ ] CodeGraph
    类型: MCP / code-graph
    推荐原因: 当前仓库较大,可提供调用链/影响面/候选测试
    安装: npm install -g @colbymchenry/codegraph@0.9.9
    MCP: codegraph serve --mcp
    产物: .codegraph/codegraph.db 项目级 SQLite 索引
    首次初始化: codegraph init
    状态验证: codegraph status；如有 Pending Changes，setup 有界执行一次 codegraph sync 并复查
    后续刷新: CodeGraph Auto-Sync watcher/MCP

[ ] Graphify
    类型: CLI / project-graph
    推荐原因: 当前任务需要项目级架构导航
    安装: uv tool install graphifyy==0.8.36
    Project skill: graphify install --project --platform <current-host>
    产物: graphify-out/graph.json + graphify-out/GRAPH_REPORT.md
    首次生成: graphify extract .；失败时默认项目根 fallback 到 graphify update .（code-only）
    后续刷新: Graphify project hook (`graphify hook install`) + `$graphify --update`; 不启动 watch
```

确认摘要必须列出写入面和不会做的事：

```text
将安装:
- CodeGraph
- Graphify

会写入:
- host MCP config
- .codegraph/
- graphify-out/
- .codex/skills/graphify/ 或 .claude/skills/graphify/（按当前 host）
- AGENTS.md 或 CLAUDE.md（按 Graphify project install）
- .git/hooks/ (Graphify provider-native project hook)

不会:
- 自动 check-in
- 自动忽略整个 graphify-out/（团队决定是否提交；默认只忽略 graphify-out/cost.json 与 graphify-out/.graphify_python）
- 默认安装 Graphify MCP server
- 启动 Graphify watch/daemon
- 让下游 workflow 运行期继续生成或刷新

继续? [y/N]
```

LLM 可以解释和推荐，但不能替用户静默安装。无人值守安装必须来自显式 profile policy，而不是 LLM 临场判断。

## 7. 下游消费方式

下游 skill 的正确流程：

```text
读取 Runtime Setup 工具说明
  |
  v
判断当前任务是否受益于某类 capability
  |
  +-- 不受益 / 缺失 / stale / unknown
  |     fallback 到 source read / rg / ast-grep / docs/solutions
  |
  +-- 受益且已初始化
        通过 provider-native MCP/CLI 工具接口获取 advisory candidates
        |
        v
        用 source/test/log/contract/user evidence 回源确认结论
```

这保持了 `Scripts prepare, LLM decides`：

- Runtime Setup 脚本准备 deterministic facts。
- Provider 原生工具提供 advisory candidates。
- Workflow LLM 决定当前任务是否使用这些 candidates。
- confirmed context 仍只能来自源码、测试、日志、合同或用户证据。

## 8. 反模式

- Runtime Setup 只安装不做首次初始化，导致后续 skill 看到工具但无法使用。
- 外部 agent / skill / MCP / provider 配置散落在脚本和 workflow prose 里，无法插拔或统一审计。
- registry 里保存任意 shell 命令并由脚本直接 eval。
- LLM 根据当前任务静默安装 optional provider。
- Runtime Setup preview 阶段直接执行安装、配置或 first generation。
- 下游 workflow 发现工具缺失就主动安装、生成或刷新。
- spec-first 写 provider-specific adapter / fusion 层，接管外部工具 schema。
- 直接读取 `graph.json` / provider DB / 全量 report 当主上下文。
- 把 provider 输出直接写成 finding / root cause / scope authority / confirmed truth。
- 把 provider 生成物自动 check-in 或 promotion 成长期 docs。

## 9. 成功标准

- 用户运行 Runtime Setup 后，能看到一份清楚的“已安装、已配置、已初始化、可调用接口、freshness、next action”说明。
- 外部 agent、skill、MCP、helper、provider 的接入点能从少数 registry/config 文件查到，并可通过 profile / overlay 插拔。
- 用户能在 Plan / Preview 阶段看到候选工具、推荐原因、风险、写入位置和 first generation 行为，并在 Apply / Confirm 阶段明确选择要安装的工具。
- 下游 skill 能从说明中知道有哪些 provider-native 工具可用，但仍由当前任务语义自行决定是否使用。
- CodeGraph / Graphify / 未来 provider 的后续刷新与使用都走其原生 MCP/CLI 能力，不由 Runtime Setup 接管。
- 缺失、stale、unknown 时主 workflow 不阻塞，回退到 direct source evidence。

## 10. 证据基线

本模型的关键边界有 2026-06-08 deep-research(18 一手源、25 claims 对抗验证、23 confirmed / 2 killed)支撑。被支持与被纠偏的点：

- **刷新归属按形态分档(§2.1)** — Sourcegraph auto-indexing 官方文档证实重型 daemon 索引器由 provider 实例后台 scheduler 代管刷新(集成方不逐次触发);LSP 3.17 规范明确“不推荐每个 server 自建 file watcher，该问题更适合在 client 侧解决”,tree-sitter 只暴露增量重解析原语、变更检测归宿主。故“全交还 provider watcher”仅对 daemon 式成立。
  - https://sourcegraph.com/docs/code-search/code-navigation/auto_indexing
  - https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/
  - https://tree-sitter.github.io/tree-sitter/using-parsers/3-advanced-parsing.html
- **下游按需自决调用** — MCP 2025-06-18 规范:`tools/list` 运行时动态发现 + tools 为 model-controlled、协议不强制交互模型 + init 期 capability negotiation(3-0 一致确认)。但 `tools/list` 不含 freshness 字段,且“provider 经 listChanged 广播 freshness、consumer 被动反应”被 0-3 否决——故 §4 的 manifest/freshness 是 application-layer 便利,非协议原生。
  - https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- **advisory + 回源确认 + fallback** — Aider repo map 一手印证“best-effort 上下文、不够时 LLM 据 map 打开真实文件确认、按任务即时重算而非持久同步”。属成熟代表性实践,跨工具“普遍共识”广度证据仍偏弱,表述宜为“有代表性实践支持”。
  - https://aider.chat/docs/repomap.html
- **registry + overlay + opt-in 插拔(§5)** — devcontainer Features(id + semver + manifest schema)、VS Code Profiles(per-workspace overlay 自动激活)、`.vscode/extensions.json` recommendations(首开提示、可忽略、不强装)全 3-0 确认。支持 overlay 机制与“可拒不强装”姿态,不背书“现在就要做满多档 overlay”。
  - https://containers.dev/implementors/features/
  - https://code.visualstudio.com/docs/configure/profiles
  - https://code.visualstudio.com/docs/configure/extensions/extension-marketplace
- **解耦、不消费 provider 内部领域模型** — LSP 奠定的边界:client 复用 provider 的语言领域模型实现、协议工作在高抽象层(不传 AST / 编译符号),直接支持 §8 反模式“不直接读 graph.json / provider DB / 全量 report”。
  - https://microsoft.github.io/language-server-protocol/overviews/lsp/overview/
