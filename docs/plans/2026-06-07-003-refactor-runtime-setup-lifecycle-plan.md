---
spec_id: 2026-06-07-003-runtime-setup-lifecycle
status: active
type: refactor
slice: Runtime Setup 命名迁移 + provider 接入生命周期
origin: 用户对话决策（2026-06-07，基于 Runtime Setup 目标模型）
depth: large
created: 2026-06-07
---

# refactor: Runtime Setup 命名迁移与 provider 接入生命周期重梳理

## 摘要

把当前 `spec-mcp-setup` 重新收敛为 **Runtime Setup**。本计划以 `docs/01-需求分析/13.scale集成/Runtime-Setup目标.md` 为指导方向：

```text
Runtime Setup = 安装 + 配置 + 首次初始化/首次生成 + 输出工具说明
Provider 原生能力 = 后续刷新 + 查询 + 使用接口 + 内部缓存/产物管理
下游 skill = 读取工具说明,按当前任务自行决策是否调用 provider 原生能力
```

这意味着 Runtime Setup 不是只装工具，也不是长期接管 provider。它可以在显式 setup/install-init 模式下完成 provider-native first generation；之后刷新、查询、解释和日常使用都交还给 CodeGraph / Graphify / 其他 provider 自己的 MCP/CLI 能力。

> 2026-06-08 deep-research 收敛(详见目标文档 §2.1 与 §10 证据基线):「后续刷新交还 provider」按形态分档——daemon 式(CodeGraph)由 provider 原生 watcher/MCP 代管刷新;快照式 CLI(Graphify)无默认 steady-state daemon,「刷新」= 用户显式重跑或 opt-in hook,默认形态下不存在 Runtime Setup 可代管的 steady-state。本 plan 中凡 Graphify 的「steady-state refresh policy」措辞,均指其 on-demand 重跑/opt-in hook 语义,不是 Runtime Setup 持久同步。

> 2026-06-08 第二轮 doc-review 收敛(4 persona fresh-source 评审,一致判定本 plan 在 2 个 optional provider 现实下 over-build,据此收敛范围):
> - **B1 manifest 并入既有 facts**:`runtime-tooling-manifest.json` 双产物净增量仅 `first_generation.*`/`requirement_workspace_path`/`artifact_root`/`steady_state.*`/`native_interfaces`/`usage_note` 几个字段,其余(lifecycle 7 位/capability/freshness/fallback/next_actions)已在 `provider_readiness[]`(`provider-readiness-renderer.cjs` 实证产出)。**默认且唯一路径 = 把净增字段并入既有 `provider_readiness[]`,schema 升 v2,不新建独立 manifest.json**。`runtime-tooling-summary.md` 降为 optional human-facing 渲染,**删除「summary 缺失→下游不得推断/degraded」硬验证**(machine facts 在即够,canonical machine surface 仍是 `provider_readiness[]`)。
> - **B2 Graphify first-generation 可行性**:setup 时点通常无 requirement workspace,且现状 `provider-tools.json:install_effect` = 「project graph generation remains a user action」。**执行 U4 前必须先核实 Graphify 是否有可被 setup 非交互定向调用到指定 workspace 的 generation 命令**:有则按受控 case 写入 registry 并保留 workspace resolver(无法解析即 skip,不退回 repo-root);无则 U4 退化为「只装 CLI + 探测接口 + 输出 next_action 让用户在持有 requirement workspace 时自跑」,并同步改 §3/§7 Graphify 示例与 source `install_effect` 口径。
> - **B3 §5.1 准入门槛 vs 现状 recommended 冲突**:CodeGraph(新 first-gen `codegraph init`+global-npx+pre-1.0)与 Graphify(新 first-gen+name-bin-mismatch+single-maintainer+global-uv)按 §5.1「边际成本陡升不进 recommended」规则本应只进 optional,但现状两者 source `profile: recommended`。**U0/U3 必须做一次回溯决策:要么降为 optional+保留 explicit opt-in gate,要么在目标文档/registry 显式记录三问豁免理由**;不能让测试锁定的「准入门槛」与 registry 实际 profile 自相矛盾。
> - **B4 砍 team/user overlay**:source 中 `team`/`user`/`overlay` 零消费者(仅 `recommended` 在用,helper 另用 `minimal/platform`)。**本批砍 team/user overlay**,只保留 registry 现有 profile;team/user 降为目标文档一句「未来 policy 输入方向」备注,不进 U3 schema/loader/test。
> - **B5 命名迁移 defer**:U8(alias,13 文件+governance schema 改 `command_aliases`)/U9(physical rename)是纯改名、0 功能收益、自引 split-brain 风险,核心价值(lifecycle 边界)不依赖它。**U8/U9 整体 defer 为独立 cosmetic 切片**;本批文档统一用「Runtime Setup(入口仍 `/spec:mcp-setup`)」口径,不动 governance schema。
> - **B6 切片重排**:depth 已改 large。本批最小可交付 = U0(文档自洽,含 B3 决策/B4 砍 overlay)+ U1(skill contract 文案)+ U4(first-generation execution + workspace resolver,唯一真有写盘安全风险)+ provider_readiness 字段扩展(替代 U5 双产物)。U2 降到「`--only` 安装前确认摘要 + workspace resolver」(`--plan`/`--verify-only` 当前不存在,完整三态 UX/TTY checkbox/`--profile team` 全 defer);U3 砍 overlay 保留 additive 字段;U6 下游文案微调可搭车;U7 uninstall 对称性 defer;U8/U9 defer。

本计划同时处理命名迁移：`/spec:runtime-setup` / `$spec-runtime-setup` 是目标规范入口，`/spec:mcp-setup` / `$spec-mcp-setup` 是兼容入口。第一阶段先建立公共兼容入口和文档口径，不在同一切片强行物理重命名 `skills/spec-mcp-setup/**`，避免 source/runtime/test 大搬迁遮蔽生命周期边界调整。

> 注:按上方 B5/B6 收敛,命名迁移(U8/U9)已从本批移出为独立 defer 切片;本段描述的迁移意图保留为方向记录,实际 alias delivery 不在本批执行。

## 问题框架

当前 source 已经出现三种状态并存：

- `skills/spec-mcp-setup/SKILL.md` 标题是 `Runtime Setup`，并说明目标用户入口是 `/spec:runtime-setup` / `$spec-runtime-setup`。
- README、runtime catalog 和命令模板仍使用 `/spec:mcp-setup` / `$spec-mcp-setup`。
- v1.16 引入 CodeGraph / Graphify 后，setup 的 provider 生命周期边界仍未统一成“first generation 属 setup，steady-state 属 provider”的模型。

需要修正的核心误区：

- 不能把 Runtime Setup 收缩成“只安装、只检测 artifact”。这样会导致下游 skill 看到工具已安装但无法直接使用。
- 不能让 `spec-plan` / `spec-work` / `spec-review` / `spec-debug` 发现缺失后主动安装、生成或刷新。那会把生命周期耦合带回 workflow。
- 不能把 Graphify / CodeGraph 的 artifact 或内部 schema 当主消费接口。下游应优先调用 provider-native MCP/CLI 工具接口。
- 不能把首次生成和后续刷新混为一谈。前者是 Runtime Setup 的一次性 onboarding 动作，后者归 provider 原生机制。

### Source 依据

- `docs/01-需求分析/13.scale集成/Runtime-Setup目标.md`：本计划的指导方向。
- `skills/spec-mcp-setup/SKILL.md`：当前 runnable entrypoint 是 `spec-mcp-setup`，目标名是 `spec-runtime-setup`。
- `templates/claude/commands/spec/mcp-setup.md`：Claude command template 仍是 legacy `/spec:mcp-setup` 兼容入口。
- `README.md` / `README.zh-CN.md`：公共入口表仍列 `/spec:mcp-setup` / `$spec-mcp-setup`。
- `docs/catalog/runtime-capabilities.md`：catalog 仍登记 `mcp-setup`。
- `docs/01-需求分析/13.scale集成/CodeGraph技术方案.md`：CodeGraph / Graphify 是 capability tools，消费侧 capability-aware，输出 advisory 且必须回源。
- `docs/contracts/provider-readiness.md`：`readiness_status` 是进入 setup 决策健康判断的 provider readiness 字段，lifecycle 只是展示/解释位。

## 目标

- 把 `spec-mcp-setup` 的语义升级为 Runtime Setup：安装、配置、provider-native 首次初始化/首次生成、readiness probe、工具说明输出。
- 提供 `/spec:runtime-setup` / `$spec-runtime-setup` 规范公共入口，并保留旧 `/spec:mcp-setup` / `$spec-mcp-setup` 兼容入口。
- 明确三类生命周期：
  - setup-owned：安装、配置、provider bootstrap / first generation、readiness facts、runtime tooling manifest / summary。
  - provider-owned：watcher、hook、refresh、MCP/CLI query surface、内部 cache/index/artifact。
  - workflow-owned：读取 setup 输出的工具说明，判断当前任务是否调用 provider-native 工具接口，回源确认结论。
- 让 CodeGraph / Graphify / 后续 provider 都声明统一 lifecycle：install、configure、first generation、native interfaces、refresh owner、artifact refs、freshness、next actions。
- 将外部 agent、skill、MCP、CLI helper、provider 等接入点集中到少数 registry/config 文件，支持后续 profile / overlay 插拔和统一审计。
- Runtime Setup 安装采用两步式：`Plan / Preview` 展示候选、推荐原因、风险、写入面和 first generation 行为；`Apply / Confirm` 只执行用户勾选或 profile policy 显式授权的项目。
- 保持 provider 输出 advisory，不新增 provider adapter / fusion / context intelligence plane。

## 非目标

- 不在 `spec-plan` / `spec-work` / `spec-review` / `spec-debug` 运行期安装、生成或刷新 provider。
- 不 silent 运行 first generation；optional provider 必须显式 opt-in / gate。
- 不让 LLM 根据当前任务静默安装 optional provider。
- 不在 `Plan / Preview` 阶段安装、配置或执行 first generation。
- 不默认安装 Graphify post-commit hook；hook onboarding 必须另有 preview-first gate。
- 不把 Graphify 产物自动写入 `docs/` 或 promotion 为长期 source truth。
- 不建立 CodeGraph -> Graphify pipeline。
- 不新增 provider adapter / fusion summary。
- 不把 provider output 写成 `confirmed_context`。
- 不在第一阶段物理重命名 `skills/spec-mcp-setup/**`、`.claude/spec-first/workflows/spec-mcp-setup/**`、`.agents/skills/spec-mcp-setup/**`。
- 不手改 generated runtime mirrors；需要 runtime regeneration 时由 `spec-first init` 处理。

## 设计

### 1. 执行流程逻辑图

```text
用户
  |
  v
/spec:runtime-setup or $spec-runtime-setup
兼容入口: /spec:mcp-setup or $spec-mcp-setup
  |
  v
解析 host + target repo + workspace scope
  |
  v
读取 registry
  +-- skills-governance.json -> workflow / standalone / internal skill delivery
  +-- agents-governance.json -> bundled / external agent governance
  +-- mcp-tools.json       -> required MCP + optional MCP provider
  +-- helper-tools.json    -> required helper tool
  +-- provider-tools.json  -> non-MCP provider helper
  +-- runtime profile/overlay -> registry profiles(minimal / recommended / platform) + policy overlays(team / user)
  |
  v
选择 mode
  |
  +-- --check
  |     只读检测
  |     不安装,不写 host config,不执行 first generation
  |
  +-- --plan
  |     Plan / Preview
  |     渲染候选工具、推荐原因、风险、写入位置、first-generation 行为
  |     不安装,不写 host config,不执行 first generation
  |
  +-- --verify-only / --refresh-facts
  |     刷新 setup-owned readiness facts
  |     不安装,不写 host config,不执行 first generation
  |
  +-- --install
        install-init mode: explicit gate 后可执行 provider-native first generation
        |
        v
        Plan / Preview
        展示候选工具清单
        支持 TTY checkbox / 非 TTY 编号 / profile 预选
        解析 requirement workspace
        |
        v
        Apply / Confirm
        用户勾选或显式 profile policy 授权
        二次确认写入面和不会做的事
        |
        v
        安装 required baseline MCP/helper tools
        |
        v
        是否选择 optional provider?
          |
          +-- no
          |     记录 optional-capability-not-selected
          |     继续 baseline setup
          |
          +-- yes
                |
                v
                explicit gate 是否批准 install/config/first generation?
                  |
                  +-- no
                  |     记录 action-required / rejected
                  |     不安装 provider,不执行 first generation
                  |
                  +-- yes
                        |
                        +-- CodeGraph 路径（MCP provider）
                        |     warm package
                        |     配置 host MCP
                        |     provider-native first generation: codegraph init
                        |     probe MCP/query surface
                        |     后续 refresh/use 交给 CodeGraph MCP/watcher
                        |
                        +-- Graphify 路径（CLI + artifact-backed provider）
                              安装 graphify CLI
                              provider-native first generation:
                                为解析后的 requirement workspace 生成 run-scoped project graph
                              probe CLI/MCP query surface
                              默认不安装 hook
                              后续 refresh/use 交给 Graphify CLI/MCP/hook
  |
  v
写入 setup-owned facts + 工具说明
  |
  +-- tool-facts.json
  +-- runtime-capabilities.json
  +-- scenario-fingerprint-setup.json
  +-- runtime-tooling-summary.md          (canonical consumer surface)
  +-- runtime-tooling-manifest.json       (machine facts;可新增或并入既有 facts)
  |
  v
下游 workflow
  |
  +-- 读取 runtime tooling 说明
  +-- 按当前任务判断是否使用某 capability
  +-- 调用 provider-native MCP/CLI 工具接口获取 advisory candidates
  +-- 缺失/stale/unknown 时 fallback 到 source read / rg / ast-grep
  +-- 结论必须由 source/test/log/contract/user evidence 确认
```

### 2. Runtime Setup 职责模型

```text
Runtime Setup
  - 检测 host/runtime state
  - 安装 required baseline MCP/helper tools
  - 显式 opt-in optional providers
  - 配置 host/runtime targets
  - 执行 provider-native first generation/bootstrap
  - 验证 MCP/CLI/query surface
  - 写入 setup-owned facts
  - 输出 runtime tooling manifest/summary

Provider
  - 维护 steady-state index/cache/artifact
  - 维护 watcher/hook/refresh,或提供 CLI/MCP 按需刷新/使用面
  - 提供 MCP/CLI query/path/explain/native use surface
  - 提供 provider-native cleanup/uninstall 语义

Workflow
  - 读取 runtime tooling summary/manifest
  - 判断当前任务是否需要某 capability
  - 优先通过 provider-native MCP/CLI 工具接口获取 advisory candidates
  - 不直接消费 provider 内部 schema 或全量 artifact
  - 使用前检查 readiness/freshness/limitations
  - 缺失/stale/unknown 时 fallback
  - 结论必须由 source/test/log/contract/user evidence 确认
```

### 3. Runtime tooling 说明产物

新增或等价扩展一份 setup-owned 工具说明。下游 workflow 的 canonical consumer surface 是 human-readable `runtime-tooling-summary.md`；machine facts 可以新增 `runtime-tooling-manifest.json`，也可以并入既有 `tool-facts.json` / `runtime-capabilities.json`，但 summary 必须稳定存在并从同一组 deterministic facts 渲染。

- canonical summary：`.spec-first/config/runtime-tooling-summary.md`
- machine facts：`.spec-first/config/runtime-tooling-manifest.json` 或既有 setup facts 的等价扩展

读取顺序：

1. 下游 skill 先读 `.spec-first/config/runtime-tooling-summary.md`，获取可用 capability、native interface、freshness、limitations 和 fallback guidance。
2. 需要机器字段时再读取 manifest；如果 manifest 未单独存在，读取 summary 标注的 machine facts source。
3. summary 缺失时，下游不得推断 provider 可用；按 degraded setup facts 处理并 fallback 到 direct source evidence。

建议 manifest 结构：

```json
{
  "schema_version": "runtime-tooling-manifest.v1",
  "generated_at": "2026-06-07T00:00:00Z",
  "target_repo": "<repo>",
  "host": "claude|codex",
  "tools": [
    {
      "name": "graphify",
      "capability_class": "project-graph",
      "provider_kind": "cli",
      "native_interfaces": ["cli", "mcp?"],
      "lifecycle": {
        "installed": true,
        "configured": false,
        "initialized": true,
        "indexed": false,
        "server_reachable": false,
        "artifact_exists": true,
        "query_verified": true
      },
      "first_generation": {
        "owner": "runtime-setup",
        "status": "completed",
        "scope": "run-scoped-workspace",
        "requirement_workspace_path": ".spec-first/workspace/requirements/<slug-or-run-id>",
        "artifact_root": ".spec-first/workspace/requirements/<slug-or-run-id>/graphify-out",
        "artifact_refs": [".spec-first/workspace/requirements/<slug-or-run-id>/graphify-out/GRAPH_REPORT.md"]
      },
      "steady_state": {
        "refresh_owner": "provider-native",
        "refresh_mode": "cli-mcp-hook-on-demand",
        "hook_default": false,
        "usage_owner": "downstream-skill"
      },
      "freshness": "fresh|stale|degraded|not-run|unknown",
      "usage_note": "Use Graphify MCP/CLI query/path/explain for project-graph candidates; treat GRAPH_REPORT.md as backing store or bounded fallback."
    }
  ]
}
```

该产物不是 source-of-truth，也不是 workflow routing 指令。它只说明“有哪些工具已安装/初始化、怎么调用、当前 freshness 如何、缺失时怎么降级”。

### 4. 引导式安装交互

Runtime Setup 安装流程拆成两个 phase。

`Plan / Preview`：

- 读取 registry、profile、overlay。
- 检测当前 installed/configured/initialized/readiness。
- 解析 requirement workspace：显式 `--requirement-workspace <repo-relative-path>` 优先；其次读取 active plan/spec/task-pack 的 `spec_id` / workspace hint；再其次交互询问；无人值守且无法解析时必须拒绝 Graphify first generation。
- 对候选工具给出 recommended defaults，但不执行任何 mutation。
- 展示 capability class、推荐原因、风险、安装位置、first generation 行为、后续 refresh owner、uninstall/cleanup 边界。

`Apply / Confirm`：

- TTY 下支持 checkbox / numbered multi-select。
- 非 TTY / chat host 输出 numbered plan，用户回复编号或传 `--only codegraph,graphify`。
- CI / team policy 只接受显式 policy file / env allowlist / 等价配置；若未来新增 `--profile team --confirm-profile`，必须先补 CLI/schema/help/tests。
- 执行前必须汇总“将安装什么、会写哪里、会不会 first generation、不会做什么”。
- 用户确认后执行受控 command case。

推荐默认项可以由 LLM 或 deterministic heuristic 解释，但最终安装选择必须来自用户确认或显式 profile policy。

Requirement workspace resolver contract：

- 输入来源优先级：`--requirement-workspace <path>` → explicit policy/env allowlist → 当前 plan/spec/task-pack 的 `spec_id` 或 workspace hint → TTY/聊天确认。
- 输出必须是 repo-relative path，默认形态为 `.spec-first/workspace/requirements/<slug-or-run-id>/`。
- resolver 必须拒绝绝对路径、`..` escape、symlink escape、repo 外路径和空 scope。
- 无人值守模式缺少 workspace 时，Graphify first generation 必须跳过并输出 `next_action=requirement-workspace-required`，不能退回 repo-root `graphify-out/`。
- 用户显式把 repo-root 声明为 requirement workspace 时才允许写 repo-root `graphify-out/`，且 confirmation summary 必须显示该写入面。

示例确认摘要：

```text
将安装:
- CodeGraph
- Graphify

会写入:
- host MCP config
- .codegraph/
- .spec-first/workspace/requirements/<slug-or-run-id>/graphify-out/

不会:
- 自动 check-in
- 默认安装 hook
- 让下游 workflow 运行期继续生成或刷新

继续? [y/N]
```

### 5. Runtime component registry 分类

外部 agent、skill、MCP、CLI helper、provider 不应该散落在安装脚本和 workflow prose 中。Runtime Setup 应读取少数 registry/config 文件，并把实际已安装/已初始化状态渲染到 runtime tooling manifest/summary。

| 配置类别 | 当前或目标文件 | 说明 |
| --- | --- | --- |
| Skill registry / governance | `src/cli/contracts/dual-host-governance/skills-governance.json` | public workflow、standalone skill、internal helper skill 的 source/runtime delivery 归属 |
| Agent registry / governance | `src/cli/contracts/dual-host-governance/agents-governance.json` | bundled/external agent profile、manual-only/dispatch posture、orphan governance |
| MCP registry | `skills/spec-mcp-setup/mcp-tools.json` | required MCP 与 optional MCP provider 的 install/config/bootstrap/first-generation metadata |
| Helper registry | `skills/spec-mcp-setup/helper-tools.json` | CLI/helper dependency、install safety、baseline/profile readiness |
| Provider registry | `skills/spec-mcp-setup/provider-tools.json` | non-MCP provider、native interfaces、first generation、artifact scope、refresh owner |
| Runtime profile / overlay | 现有 registry profile 字段 + 后续 team/user policy overlay | registry schema 仍只表达 minimal/recommended/platform；team/user 是外层 policy，解析后映射为现有 profile 或显式 item allowlist |

约束：

- Registry 只声明 deterministic metadata，不写任意 shell 字符串。
- 脚本只执行受控 command case，例如 `codegraph-init`、`graphify-first-generation`。
- 下游 workflow 不直接解析 registry；它只读取 Runtime Setup 输出的 tooling manifest/summary。
- registry profile 用于内置分层；team/user overlay 不新增 registry enum，除非同一切片同步 schema、loader、fixtures 和 tests。
- profile / overlay 用于插拔和禁用能力，不改 workflow prose。
- 新增工具优先走 configuration-first；只有复用现有 kind、installer 和 controlled action case 时才可只改 registry/config。需要新 first-generation、host delivery、权限、包管理器或 destructive cleanup 时，必须补脚本 case、safety gate 和 tests。

### 6. CodeGraph 生命周期

Runtime Setup 可以负责：

- explicit opt-in gate;
- package warmup;
- host MCP config;
- provider-native first generation via `codegraph init`;
- probe/readiness rows: `installed`, `configured`, `initialized`, `indexed`, `server_reachable`, `query_verified`;
- runtime tooling manifest/summary rows;
- host config uninstall.

CodeGraph 自己负责：

- `.codegraph/codegraph.db` steady-state maintenance;
- file watcher and incremental sync;
- MCP tools and internal schema;
- cache cleanup / `codegraph uninit` unless a future explicit destructive cleanup action is added.

Runtime Setup 不得解析 CodeGraph DB、融合 CodeGraph 输出，或把 CodeGraph candidates 当作 confirmed evidence。

### 7. Graphify 生命周期

Runtime Setup 可以负责：

- explicit opt-in gate;
- `uv tool install graphifyy==0.8.33`;
- `graphify` command detection;
- provider-native first generation for current requirement workspace;
- tool interface and artifact readiness detection;
- CLI/MCP query probe when available;
- runtime tooling manifest/summary rows;
- CLI uninstall via `uv tool uninstall graphifyy` when a provider uninstall route is added.

Graphify 自己负责：

- first generation command semantics;
- `graphify-out/` contents;
- MCP/CLI query/path/explain surface;
- `GRAPH_REPORT.md` / `graph.json` internal format;
- post-commit hook behavior when explicitly enabled;
- CLI/MCP/hook refresh/use surface；hook 默认不启用，refresh 是 provider-native on-demand 语义。

Runtime Setup 不得在下游 workflow 运行期自动运行 `graphify .`、自动阅读全文、自动 check-in artifact，或自动把 project graph promotion 到长期文档。Runtime Setup 可以在显式 setup/init 阶段运行 Graphify 原生 first generation；这不是 steady-state refresh，也不是 workflow-owned generation。

### 8. Provider readiness 语义

Provider readiness 继续使用现有 `readiness_status` 5 值：

```text
fresh|stale|degraded|not-run|unknown
```

新增或扩展 lifecycle / manifest 字段表达 first generation：

- `initialized=true|false`
- `first_generation.owner=runtime-setup`
- `first_generation.status=completed|not-run|failed|skipped`
- `first_generation.scope=project|run-scoped-workspace|user-specified`
- `first_generation.requirement_workspace_path=<repo-relative workspace path>` when scope is `run-scoped-workspace`
- `first_generation.artifact_root=<repo-relative provider artifact root>` when first generation writes artifacts
- `steady_state.refresh_owner=provider-native`
- `steady_state.refresh_mode=watcher|cli-mcp-hook-on-demand|manual-only|none`
- `steady_state.hook_default=true|false`
- `steady_state.usage_owner=downstream-skill`
- `native_interfaces=["mcp","cli"]`

解释：

- CLI / MCP 缺失：`readiness_status=not-run`。
- 已安装但未完成 first generation：`readiness_status=not-run` 或 `degraded`，并给 next_action。
- first generation 完成但 provider 自报 stale：映射为 `stale`。
- provider 自报 fresh：除非 spec-first 有 deterministic proof，否则仍可映射为 `unknown` 或带 limitation 的 `fresh`，具体以 provider-readiness 合同实现为准。
- `readiness_status=fresh` 仍只是 advisory candidate 可用，不等于 confirmed truth。

### 9. 命名迁移

采用两阶段迁移。

阶段 A：公共规范入口与兼容入口。

- 增加 `/spec:runtime-setup` 和 `$spec-runtime-setup` 作为公共规范入口。
- 保留 `/spec:mcp-setup` 和 `$spec-mcp-setup` 作为 deprecated 兼容入口。
- 当前 governance/manifest 是一个 `skill_name` 对一个 `command_name` 的精确匹配模型，不能仅在 README 中写新入口。阶段 A 必须先选择并实现一种 alias delivery 机制：
  - 首选：扩展 governance/manifest/source generator 支持 `command_aliases:["runtime-setup"]`，由同一 `skills/spec-mcp-setup/SKILL.md` 渲染两个公共入口；
  - 备选：新增受控 alias stub，只做入口转发/说明，不复制 runtime setup 逻辑。
- 更新 README、README.zh-CN、runtime catalog、using-spec-first guide mode、init closeout text、doctor/clean guidance 和 instruction bootstrap anchors，优先推荐 Runtime Setup，并同时标明 legacy aliases。
- 本阶段保留 source path `skills/spec-mcp-setup/**` 与 runtime support path `spec-mcp-setup`。

阶段 B：可选的物理 source rename。

- 只有在 aliases、runtime projection 和 package install tests 稳定后，才把 `skills/spec-mcp-setup/**` 重命名为 `skills/spec-runtime-setup/**`。
- 如果 host cache 行为需要，保留一个 release 周期的兼容 runtime copies 或 alias stubs。
- 在同一个 physical rename slice 中同步更新 branch protection、package files、smoke tests、public workflow registry 和 source-path coverage。

## 实施单元

### U0. 目标文档与方案自洽

文件：

- `docs/01-需求分析/13.scale集成/Runtime-Setup目标.md`
- `docs/01-需求分析/13.scale集成/README.md`
- `docs/01-需求分析/13.scale集成/CodeGraph技术方案.md`
- `docs/plans/2026-06-07-003-refactor-runtime-setup-lifecycle-plan.md`
- `tests/unit/scale-provider-doc-contracts.test.js`

工作：

- 固化 Runtime Setup 目标模型。
- 将 CodeGraph / Graphify 文档改为 first-generation 属 Runtime Setup、steady-state 属 provider。
- 落地 2026-06-08 deep-research 三处收敛(目标文档已改,CodeGraph 子方案 / README 须同步对齐):
  - **刷新归属按形态分档**:daemon 式(CodeGraph)→ provider 原生 watcher/MCP 代管;快照式 CLI(Graphify)→ 无可代管 steady-state,刷新 = 用户显式重跑;进程内/库式不作为 Runtime Setup 托管 provider。子方案不得保留「Graphify 之后刷新走 provider 原生」这类暗示持久同步的措辞。
  - **manifest 不宣称协议原生**:runtime-tooling-manifest/summary 是 spec-first setup-owned application-layer 工具说明,freshness/调用说明是自加便利层,不对标 MCP 原生 `tools/list`/capability negotiation(MCP 载荷无 freshness)。
  - **Provider 准入门槛**:任何 provider 进 registry/`recommended` 前回答三问(服务哪个核心链路节点 / 有无真实增益证据 / 边际成本是否陡升);陡升或证据弱只进 optional/degraded,不进 baseline。
- 测试锁定 tool-interface-first、first-generation-owned-by-runtime-setup、no downstream generation、形态分档、manifest application-layer 定性、准入门槛存在。

验证：

- focused doc-contract tests 通过。

### U1. Runtime Setup skill contract 文案

文件：

- `skills/spec-mcp-setup/SKILL.md`
- `docs/contracts/provider-readiness.md`

工作：

- 将 Runtime Setup 边界重写为 install/config/first-generation/readiness/manifest。
- 明确 Runtime Setup 的安装流程是 `Plan / Preview` + `Apply / Confirm` 两阶段。
- 明确 `--check` / `--plan` / `--verify-only` 不执行 first generation。
- 明确当前真实 CLI flag 仍是 `--install`；`install-init mode` 是 `--install` 内 explicit gate 通过后的语义，不在本单元新增 `--init` flag。
- 明确 downstream workflows 读取 manifest/summary，自行判断是否调用 provider-native MCP/CLI。

验证：

- public workflow contract summary / mcp-setup focused tests 更新并通过。

### U2. Guided install selection

文件：

- `skills/spec-mcp-setup/SKILL.md`
- `skills/spec-mcp-setup/scripts/install-mcp.sh`
- `skills/spec-mcp-setup/scripts/install-mcp.ps1`
- `skills/spec-mcp-setup/scripts/install-helpers.sh`
- `skills/spec-mcp-setup/scripts/install-helpers.ps1`
- 必要时新增 selection renderer/helper
- `tests/unit/mcp-setup.sh`
- `tests/unit/mcp-setup-powershell-contracts.test.js`

工作：

- `--plan` 渲染候选工具清单、推荐原因、风险、写入位置、first generation 行为，不执行 mutation。
- TTY 支持 checkbox / numbered multi-select；非 TTY 输出 numbered plan 并接受 `--only`。
- CI/team 支持显式 policy file / env allowlist / 等价配置；若选择新增 `--profile team --confirm-profile` 作为真实 CLI，必须在同一实现单元补入口解析、help、schema 和 tests。
- 为 Graphify first generation 增加 requirement workspace resolver surface，例如 `--requirement-workspace <repo-relative-path>` 或等价 policy/env；无法解析时只跳过 Graphify first generation，不阻塞 baseline setup。
- Apply 前输出最终确认摘要：将安装什么、会写哪里、是否 first generation、不会做什么。
- LLM 推荐只能影响默认展示/解释，不能绕过用户确认。

验证：

- `--plan` 不安装、不写 host config、不执行 first generation。
- 未传 `--only` / 未确认时 optional provider 不安装。
- policy allowlist 只安装已授权项；若实现 `--profile team --confirm-profile`，测试必须覆盖该 flag。
- requirement workspace resolver 拒绝绝对路径、`..` escape、symlink escape 和空 scope。

### U3. Runtime component registry / profile metadata

文件：

- `src/cli/contracts/dual-host-governance/skills-governance.json`
- `src/cli/contracts/dual-host-governance/agents-governance.json`
- `skills/spec-mcp-setup/mcp-tools.json`
- `skills/spec-mcp-setup/provider-tools.json`
- `skills/spec-mcp-setup/helper-tools.json`
- `docs/contracts/provider-tools-registry.schema.json`
- `docs/contracts/helper-tools-registry.schema.json`
- `tests/unit/dependency-readiness-baseline.test.js`

工作：

- 确认外部 agent、skill、MCP、CLI helper、provider 分别落到少数 registry/config 文件，不散落在脚本和 workflow prose。
- 明确新增工具的配置边界：同类工具可配置接入；新行为必须新增受控脚本 case 和测试。
- 为 runtime component registry 扩展或记录：
  - `native_interfaces`
  - `first_generation`
  - `first_generation.scope`
  - `first_generation.requires_explicit_gate`
  - `steady_state.refresh_owner`
  - `steady_state.usage_owner`
  - `artifact_scope`
  - `uninstall_route`
- 增加或明确 runtime profile / overlay 语义：registry enum 只表达 minimal、recommended、platform；team、user 是外层 policy overlay，解析后映射到现有 profile 或显式 optional item allowlist。
- CodeGraph：first generation 为 `codegraph init`。
- Graphify：first generation 为 Graphify provider-native project-graph generation，scope 为 run-scoped workspace，并写明 `requirement_workspace_path` / `artifact_root` 的 repo-relative 解析规则。
- registry execution 仍由脚本受控，不执行任意 JSON command eval。

验证：

- schema 接受 first generation metadata。
- schema/loader/tests 不接受未声明的 `team` / `user` registry enum；team/user 只能作为 overlay/policy 输入。
- skill/agent/MCP/helper/provider 的接入点可从 registry/config 查到。
- tests 拒绝 optional provider 无 gate 的 first generation。

### U4. Runtime Setup execution: first generation

文件：

- `skills/spec-mcp-setup/scripts/install-mcp.sh`
- `skills/spec-mcp-setup/scripts/install-mcp.ps1`
- `skills/spec-mcp-setup/scripts/install-helpers.sh`
- `skills/spec-mcp-setup/scripts/install-helpers.ps1`
- `tests/unit/mcp-setup.sh`
- `tests/unit/mcp-setup-powershell-contracts.test.js`

工作：

- CodeGraph install/config/init 继续走 MCP route。
- Graphify install/first-generation 继续走 helper/provider route。
- first generation 必须满足 explicit gate、preview-first、workspace scope 明确。
- run-scoped Graphify artifact 必须写入解析后的 requirement workspace，例如 `.spec-first/workspace/requirements/<slug-or-run-id>/graphify-out/`；缺少 workspace scope 时拒绝 first generation 并输出 next_action。
- 缺少 requirement workspace 时，Graphify first generation 写 `skipped/degraded` + `next_action=requirement-workspace-required`，baseline setup 继续。
- first generation 失败写 degraded / next_action，不阻塞 baseline setup。
- 默认不安装 Graphify hook；hook onboarding 作为单独 explicit action。

验证：

- setup script 不含无 gate 的 `graphify .`。
- first generation 只在 install/init mode 执行。
- Graphify first generation 不写 repo-root `graphify-out/`，除非用户显式把 repo-root 声明为 requirement workspace。
- 缺 workspace 的无人值守安装不会生成 Graphify artifact，并给出可执行 next_action。
- check/plan/verify-only 不变更状态。

### U5. Runtime tooling manifest / summary

文件：

- `skills/spec-mcp-setup/scripts/provider-readiness-renderer.cjs`
- `skills/spec-mcp-setup/scripts/verify-tools.sh`
- `skills/spec-mcp-setup/scripts/verify-tools.ps1`
- `src/cli/helpers/setup-facts.js`
- `docs/contracts/provider-readiness.md`
- 必要时新增 `docs/contracts/runtime-tooling-manifest.schema.json`
- `tests/unit/dependency-readiness-baseline.test.js`

工作：

- 输出或扩展 `runtime-tooling-manifest.v1`。
- 渲染 human-readable runtime tooling summary，且 summary 是下游 workflow 的 canonical consumer surface。
- 在说明里列出 capability class、provider、native interfaces、first-generation status、artifact refs、freshness、refresh owner、usage note、next actions。
- 若 machine manifest 未单独新增，summary 必须写出 machine facts source，供下游有界读取。
- 保持 doctor health 行为：只有 `readiness_status` 驱动 provider counts；manifest 不做语义判断。

验证：

- manifest / summary 中 Graphify first generation completed 时不要求 check-in。
- manifest / summary 中 provider 输出仍标 advisory，需要 source confirmation。
- summary 缺失时 downstream workflow 不能从 registry 或 provider artifact 推断能力可用，只能 degraded fallback。

### U6. Downstream workflow consumption

文件：

- `skills/spec-plan/SKILL.md`
- `skills/spec-work/SKILL.md`
- `skills/spec-code-review/SKILL.md`
- `skills/spec-debug/SKILL.md`
- `tests/unit/capability-aware-provider-contracts.test.js`
- `tests/unit/scale-provider-doc-contracts.test.js`

工作：

- workflow prose 读取 Runtime Setup 工具说明作为 advisory setup facts。
- workflow 根据当前任务判断是否使用 `code-graph` / `project-graph` 等 capability。
- workflow 调用 provider-native MCP/CLI 工具接口；缺失/stale/unknown 时 fallback。
- workflow 不执行 install、first generation、refresh。
- workflow 不直接读取 provider 内部 DB / `graph.json` 全量 / 全量 report。

验证：

- tests 拒绝 downstream workflow 中出现无 gate `graphify .`、provider-specific command hardcode、adapter/fusion language 或 confirmed-context promotion。

### U7. Provider uninstall / cleanup 对称性

文件：

- `skills/spec-mcp-setup/scripts/uninstall-mcp.sh`
- `skills/spec-mcp-setup/scripts/uninstall-mcp.ps1`
- 必要时新增 helper uninstall scripts
- `tests/unit/mcp-setup.sh`
- `tests/unit/mcp-setup-powershell-contracts.test.js`

工作：

- CodeGraph uninstall 默认只移除 host MCP config；`.codegraph/` cleanup 需要显式 destructive cleanup action。
- Graphify uninstall 默认只移除 CLI package route；run-scoped artifacts cleanup 需要显式 action。
- provider-native cleanup next_action 可显示，但不 silent 删除。

验证：

- uninstall 不删除 provider artifacts，除非显式 destructive cleanup gate 通过。

### U8. 公共入口 alias 迁移

文件：

- `README.md`
- `README.zh-CN.md`
- `docs/catalog/runtime-capabilities.md`
- `src/cli/contracts/dual-host-governance/skills-governance.json`
- `src/cli/contracts/dual-host-governance/skills-governance.schema.json`
- `src/cli/plugin.js`
- `src/cli/instruction-bootstrap.js`
- `src/cli/commands/init.js`
- `src/cli/commands/doctor.js`
- `src/cli/commands/clean.js`
- `skills/using-spec-first/SKILL.md`
- `templates/claude/commands/spec/mcp-setup.md`

工作：

- 增加规范 Runtime Setup 入口口径，同时保留 legacy aliases。
- 在现有一 skill 对一 command 限制下，先实现 alias delivery 机制：优先 `command_aliases` schema/generator/manifest 支持；若选择 alias stub，必须写明 stub source、projection 和去重测试。
- 增加或登记 `/spec:runtime-setup` 和 `$spec-runtime-setup` delivery，不在同一步删除 legacy `mcp-setup`。
- 更新 routing guidance，优先推荐 Runtime Setup，并把 legacy aliases 标为兼容入口。

验证：

- init dry-run tests 证明规范入口和 legacy 引用都能正确渲染。
- public workflow summary tests 证明 Runtime Setup 是 preferred entrypoint。
- governance tests 证明 `spec-mcp-setup` 未被重复登记成两个 workflow record，且 alias 与 primary command 指向同一 source contract。
- 不手改 generated runtime mirrors。

### U9. 物理 source rename 决策 gate

文件：

- `skills/spec-mcp-setup/**`
- `templates/claude/commands/spec/mcp-setup.md`
- `src/cli/contracts/dual-host-governance/skills-governance.json`
- `tests/smoke/install-tarball.sh`
- `tests/smoke/cli.sh`
- `tests/unit/init-dry-run.test.js`
- `tests/unit/init-source-path-coverage.test.js`
- `tests/unit/package-install-contracts.test.js`

工作：

- U0-U7 不做物理 rename。
- alias migration 和 lifecycle tests 通过后，再决定 physical rename 是否值得承担影响面。
- 若接受，作为独立 refactor slice 执行，并提供 compatibility stubs 与 release-note callout。

验证：

- 物理 rename 前：package 仍包含当前 source paths，aliases 可用。
- 若执行物理 rename：不得把 stale generated runtime path 当 source。

## 测试计划

聚焦测试：

- `npm run test:mcp-setup`
- `npx jest tests/unit/dependency-readiness-baseline.test.js tests/unit/capability-aware-provider-contracts.test.js tests/unit/scale-provider-doc-contracts.test.js --runInBand`
- `npx jest tests/unit/init-dry-run.test.js tests/unit/runtime-capability-catalog.test.js tests/unit/public-workflow-contract-summary.test.js --runInBand`
- `npm run typecheck`
- `git diff --check`

入口投递、first-generation execution 或 physical rename 影响面扩大时：

- `npm run test:unit`
- `npm run test:smoke`
- `npm run build`
- `spec-first init --claude --dry-run`
- `spec-first init --codex --dry-run`

## 风险

- First generation 被误解为 downstream workflow 可自动补生成。缓解：contract tests 锁定 downstream no install/no generation/no refresh。
- Graphify first generation 可能变成 silent mutation。缓解：explicit gate + preview-first + workspace scope。
- runtime tooling manifest 新增产物可能与既有 `tool-facts.json` / `runtime-capabilities.json` 重叠。缓解：实现时允许等价扩展，先保证 single source facts，再决定是否新增文件。
- alias migration 可能造成 split-brain docs：README 偏向 Runtime Setup，但 generated runtime 仍只暴露 `mcp-setup`。缓解：保留 legacy alias，并对两个名字都加测试。
- physical path rename 会横跨 runtime generation、package install、tests、host cache。缓解：alias 证明稳定前延后。

## 交接

推荐下一步：对本 plan 运行 `$spec-doc-review` 或 `$spec-code-review` 的 docs-only 审查，然后先执行 U0-U5，形成一个窄 Runtime Setup lifecycle / manifest 切片。U6 downstream workflow consumption 与 U8 alias migration 可作为第二批；U9 physical rename 保留为后续 decision gate。
