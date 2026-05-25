# CodeGraph 对 GitNexus 与 CRG 的平替评估

> Retired / historical archive: 本文记录 GitNexus-only 迁移前的 CodeGraph / GitNexus / CRG 对比评估。当前默认 provider path 以 GitNexus 为准，CRG 只作为历史背景。

本文回答当前问题：

1. `colbymchenry/codegraph` 是否可以直接平替 GitNexus。
2. `colbymchenry/codegraph` 是否可以直接平替 `code-review-graph`。
3. 是否可以只保留 CodeGraph，删除 GitNexus 与 CRG。
4. 在当前 `spec-first` 项目里，推荐的 provider 收敛路径是什么。

结论先行：

```text
CodeGraph 不能直接平替 GitNexus。
CodeGraph 目前也不能无降级直接平替 CRG 的 spec-first 角色。
CodeGraph 更不能同时替掉 GitNexus + CRG。

GitNexus OSS 当前仍是 spec-first 最合适的主图谱 provider。
GitNexus OSS 具备作为 CRG 平替目标的能力面，但当前项目仍需完成 adapter / contract / tests 迁移后才能删除 CRG。
CodeGraph 可作为实验性的单仓代码探索与影响分析 provider 候选，不应进入当前默认 required provider path。
```

这里的“直接平替”按用户的严格口径理解：不是“能接入”“能做一部分”“可作为 fallback”，而是替换后不能丢失当前 CRG / GitNexus 在 `spec-first` 中已经承担的能力、产物、刷新治理、多仓语义和 downstream workflow 契约。

## 分析范围

本文基于以下证据：

| 领域 | 证据 |
| --- | --- |
| spec-first 角色与 provider 边界 | `docs/10-prompt/结构化项目角色契约.md`, `AGENTS.md` |
| 当前 graph readiness | `.spec-first/graph/graph-facts.json`，状态为 `dirty-advisory`，所以关键结论以源码直读交叉验证 |
| GitNexus / CRG 现有决策 | `docs/05-用户手册/14-GitNexus-全流程执行分析.md`, `15-code-review-graph-全流程执行分析.md`, `16-GitNexus-增量刷新机制与spec-first刷新策略评估.md`, `17-GitNexus-刷新策略与Provider收敛决策.md` |
| spec-first provider registry | `skills/spec-mcp-setup/mcp-tools.json` |
| spec-first graph consumption contract | `docs/contracts/graph-evidence-policy.md`, `docs/contracts/graph-provider-consumption.md`, `docs/contracts/downstream-graph-evidence-consumption.md`, `docs/contracts/workspace-gitnexus-consumption.md` |
| CodeGraph upstream | GitHub `colbymchenry/codegraph`, npm `@colbymchenry/codegraph@0.9.4`, 本地临时 clone `/tmp/codegraph-deep-compare` commit `1f3625a3e94441b5e9e72f2b03f3ba4f42d5e860e` |
| GitNexus upstream | 本地源码 `/Users/kuang/xiaobu/GitNexus`, npm/package 当前项目 pin `gitnexus@1.6.5` |
| Context7 交叉验证 | `/abhigyanpatwari/gitnexus`, `/colbymchenry/codegraph` |

本文不做 provider 行为修改，不删除 CRG，不接入 CodeGraph。它是替换判断与后续迁移建议。

## 1. 直接平替的验收标准

在 `spec-first` 里，graph provider 不是“某个 MCP 工具能搜索代码”这么简单。直接平替至少要满足五层标准。

| 层级 | 直接平替必须满足 |
| --- | --- |
| 能力面 | 覆盖被替换 provider 的默认用途，包括全局代码理解、impact、review context、related tests、多仓 orientation 等 |
| 产物面 | 写入 `.spec-first/graph/*`、`.spec-first/providers/*`、`.spec-first/impact/*` 的 canonical readiness / normalized facts |
| 刷新面 | 遵守 `$spec-graph-bootstrap` 显式刷新，不在 plan/work/debug/review 中静默 rebuild、watch、repair 或 daemon mutation |
| downstream 面 | `spec-plan`、`spec-work`、`spec-debug`、`spec-code-review` 能按现有字段消费，不扩大 scope，不把 session-local evidence 写成 primary truth |
| 多仓面 | 支持 parent workspace、child repo、workspace advisory、repo registry / group readiness 或等价能力，不把“手动指定另一个路径”伪装成统一跨仓图谱 |

因此，“CodeGraph 有 `impact` 和 `projectPath`”不足以证明直接平替；它还必须能承担 spec-first 当前 provider contract。

## 2. CodeGraph 当前能力事实

### 2.1 项目与版本

当前上游事实：

| 项 | 当前值 |
| --- | --- |
| GitHub | `https://github.com/colbymchenry/codegraph` |
| npm package | `@colbymchenry/codegraph` |
| npm version | `0.9.4` |
| license | MIT |
| primary language | TypeScript |
| 本次分析 commit | `1f3625a3e94441b5e9e72f2b03f3ba4f42d5e860e` |
| GitHub pushedAt | `2026-05-24T09:52:46Z` |

CodeGraph 的定位很清晰：local-first code intelligence for AI agents，存储在项目本地 `.codegraph/codegraph.db`，用 SQLite + FTS5 + tree-sitter 生成符号图，重点是减少 agent 的 grep / glob / Read 成本。

### 2.2 CLI surface

CodeGraph CLI 当前核心命令：

```text
codegraph init [path]
codegraph index [path]
codegraph sync [path]
codegraph status [path]
codegraph query <search>
codegraph files
codegraph context <task>
codegraph callers <symbol>
codegraph callees <symbol>
codegraph impact <symbol>
codegraph affected [files...]
codegraph serve --mcp
```

含义：

- `index` 是全量索引入口，`--force` 会先 `clear()` 再 `indexAll()`。
- `sync` 是增量同步入口，基于 git status 或文件扫描计算 added / modified / removed，再更新 DB。
- `status --json` 输出 indexed files、nodes、edges、pending changes。
- `affected` 用 changed files 反向追踪 file dependents，并按 test file pattern 过滤受影响测试。
- `serve --mcp` 启动 MCP server，默认会尝试 watcher 自动同步；`--no-watch` 可禁用 watcher。

### 2.3 MCP surface

CodeGraph MCP tools：

```text
codegraph_search
codegraph_context
codegraph_callers
codegraph_callees
codegraph_impact
codegraph_node
codegraph_explore
codegraph_status
codegraph_files
codegraph_trace
```

每个 tool 都支持可选 `projectPath`。源码注释称它用于 cross-project queries：传入另一个已经 `codegraph init` 的项目路径，server 会打开并缓存该项目的 `.codegraph` DB。

这个能力有价值，但边界必须说清楚：

```text
projectPath = per-call 选择另一个 repo-local CodeGraph DB
不等于 repo registry
不等于 repository group
不等于 group contract registry
不等于跨仓统一 graph
不等于 cross-repo impact orchestration
```

### 2.4 存储 schema

CodeGraph DB schema 的核心表：

| 表 | 作用 |
| --- | --- |
| `nodes` | symbol / file / route / component 等节点 |
| `edges` | `contains`、`calls`、`imports`、`extends`、`implements`、`references` 等边 |
| `files` | file path、content hash、language、indexed timestamp、errors |
| `unresolved_refs` | 待解析引用 |
| `nodes_fts` | FTS5 全文搜索 |
| `project_metadata` | 项目元数据 |

这是一个强单仓代码图谱 schema。它没有发现 GitNexus group / contract / bridge / repo registry 等跨仓控制面表。

### 2.5 Impact 与 affected tests

CodeGraph impact 的核心逻辑：

- `getImpactRadius(nodeId, maxDepth)` 从目标节点沿 incoming edges 找依赖方。
- 对 class / interface / struct 等 container，会先进入 children，让 contained methods 的 callers 进入 impact。
- `callers` / `callees` 走 `calls`、`references`、`imports`。
- `trace` 可以找两个 symbol 间的 static call path，并对 callback/event 有部分桥接逻辑。
- `affected` 从 changed file 出发，用 `getFileDependents()` 做 BFS，再按 `.spec.`、`.test.`、`__tests__`、`tests/`、`e2e/` 等 pattern 找测试文件。

这说明 CodeGraph 在单仓影响面和测试候选选择上有真实能力。它可以覆盖 CRG 默认用途中的一部分“用户体验层能力”，但它目前没有 spec-first 所需的 canonical review-impact adapter。

### 2.6 刷新模型

CodeGraph 刷新模型是：

```text
codegraph index       # full index
codegraph sync        # changed files incremental sync
MCP file watcher      # native fs.watch + debounce auto-sync
git sync hooks        # watch 不适用时的可选 fallback
```

这和 spec-first 当前原则不同：

```text
spec-mcp-setup       只准备 setup-owned projection
spec-graph-bootstrap 才显式刷新 canonical graph readiness
downstream workflow  不隐藏运行 analyze/build/index/sync/watch/daemon
```

CodeGraph 的 watcher 是产品优势，但在 spec-first 默认路径里不能直接启用成“自动保持 canonical readiness fresh”。如果接入，必须禁用默认 watcher 或把它视为 session-local enhancement，不得让 watcher side effect 写成 `.spec-first/graph/*` primary truth。

## 3. GitNexus OSS 与 Enterprise 能力边界

### 3.1 GitNexus OSS 当前已支持的多仓能力

本地 GitNexus 源码与 Context7 均确认，GitNexus OSS 当前不只是单仓 query。它支持：

| 能力 | 证据 |
| --- | --- |
| repo registry | MCP `list_repos`、CLI `gitnexus list`、`gitnexus index` |
| per-repo query/context/impact | MCP `query`、`context`、`impact`、`detect_changes`，都支持 `repo` 参数 |
| repository groups | CLI `gitnexus group create/add/remove/list/sync/contracts/query/status` |
| group MCP tools | `group_list`、`group_sync`、`group_contracts`、`group_query`、`group_status` |
| group query | `groupQuery()` 对各 member repo query 后用 RRF-like score 合并 |
| group context | `groupContext()` 对 group member fan-out context |
| group contracts | `group_sync` 生成 contracts / crossLinks，`group_contracts` 读取 |
| group impact / cross-impact | `runGroupImpact()` 先做 local impact，再基于 bridge / contract links fan-out；当前 `MAX_SUPPORTED_CROSS_DEPTH = 1` |
| service / subgroup scope | group query/context/impact 支持 service prefix 或 subgroup 过滤 |

因此，GitNexus OSS 的多仓模型是：

```text
repo-local graph
  + global repo registry
  + repository group config
  + contract registry / cross-links
  + bounded group query/context/impact fan-out
```

它不是 Enterprise README 所说的“unified graph across repositories”，但它已经比 CodeGraph 的 `projectPath` per-call 打开另一个 DB 强得多。

### 3.2 Enterprise 与 OSS 的区别

GitNexus README 对 Enterprise 的公开描述包括：

- PR Review：pull request blast radius analysis。
- Auto-updating Code Wiki。
- Auto-reindexing。
- Multi-repo support：unified graph across repositories。
- OCaml support。
- priority feature / language support。

需要明确区分：

| 维度 | OSS 当前能力 | Enterprise 公开承诺 |
| --- | --- | --- |
| 多仓发现 | repo registry / list repos | 企业级多仓支持 |
| 多仓组织 | repository groups | unified graph across repositories |
| 跨仓影响 | group contracts + cross-impact，当前 cross depth 上限为 1 | 更完整的跨仓统一图谱语义 |
| 刷新 | 手动 analyze / spec-first 显式 bootstrap | auto-reindexing |
| PR | local detect_changes / impact 可支撑 review evidence | automated PR review |
| wiki | OSS 也有 Code Wiki | auto-updating Code Wiki |

对当前 `spec-first` 的结论是：OSS 已足够支撑当前项目的 GitNexus-first provider 目标和 GitNexus->CRG 平替目标；Enterprise 能力更强，但不是当前替换 CRG 的必要条件。

## 4. CRG 当前在 spec-first 中承担什么

`code-review-graph` 当前不是全局代码知识库。它在 `spec-first` 中的角色是 `impact_context`，集中服务 `$spec-code-review`。

当前 registry 能力：

```text
detect_changes
blast_radius
minimal_context
review_context
related_tests
graph_stats
```

当前工程位置：

- `skills/spec-mcp-setup/mcp-tools.json` 把 CRG 声明为 required graph provider。
- 默认 `access_mode=cli_artifact`，host MCP 不是 required。
- `$spec-graph-bootstrap` 运行 CRG build/status/query proof。
- `.spec-first/impact/bootstrap-impact-capabilities.json` 把 CRG 编译成 review / impact readiness。
- `skills/spec-code-review/SKILL.md` 仍明确说 CRG 是 primary diff impact provider。
- `src/cli/helpers/review-pre-facts.js` 会围绕 CRG 渲染 review pre-facts / query plan。

所以 CRG 的替换不是“找一个也有 impact 的工具”就结束。必须替掉的是：

```text
provider registry
-> bootstrap command shape
-> normalized impact capability artifacts
-> review-pre-facts
-> spec-code-review prose
-> downstream tests
-> README / 用户手册
```

## 5. 三方能力矩阵

| 维度 | GitNexus OSS | code-review-graph | CodeGraph |
| --- | --- | --- | --- |
| 当前 spec-first 角色 | `global_knowledge` primary provider | `impact_context` review provider | 未接入 |
| 当前 required path | 是 | 是 | 否 |
| 单仓 symbol search | 强，process-grouped hybrid query | 有 query_graph / review context 面 | 强，FTS + exact / fuzzy / context |
| 源码片段上下文 | `context` / resources / process | minimal/review context | `context` / `explore` / `node`，源代码直接返回 |
| call graph | 是 | 是 | 是 |
| impact radius | `impact`，支持 direction/depth/includeTests | blast radius | `impact`，incoming dependents |
| git diff change detection | `detect_changes` | `detect_changes` | 需要外部传 changed files；`affected` 找测试，不等价完整 diff impact |
| related tests | `impact --include-tests` / detect_changes evidence | `related_tests` | `affected` 基于 file dependents + test pattern |
| review context | 能力面可支撑，17 号文档建议迁移成 canonical adapter | 当前 primary | 有上下文能力，但未接入 spec-first review contract |
| route/API evidence | `route_map` / `api_impact` / `shape_check` | 不是核心 | README 声称 framework-aware routes；无 spec-first route/API contract |
| Cypher / schema query | 是 | 非默认 | 否 |
| repo registry | 是 | 否 | 否，只有 `projectPath` |
| repository group | 是 | 否 | 否 |
| contract registry / cross-links | 是 | 否 | 否 |
| cross-repo impact | group impact，bounded cross depth | 否 | 未发现等价机制 |
| monorepo path/service scope | group service/subgroup | 非核心 | 能索引 monorepo / nested git repos，但不是 group readiness |
| refresh 默认 | `analyze`; spec-first 默认 full bootstrap | `build` / `update`; spec-first bootstrap | `index` / `sync` / watcher |
| spec-first 显式 refresh 兼容 | 已接入 | 已接入 | 未接入；watcher 需治理 |
| canonical `.spec-first` artifacts | 已接入 | 已接入 | 未接入 |
| dirty/stale/fingerprint governance | 已接入 | 已接入 | 未接入 |
| license / commercial | README 提醒商业许可/Enterprise | 当前未在本文复核 | MIT |

## 6. 是否可以直接平替 GitNexus

结论：不支持。

CodeGraph 不能直接平替 GitNexus，原因不是 CodeGraph 弱，而是两者在 `spec-first` 中要解决的问题不同。

GitNexus 当前承担：

- required `global_knowledge` provider。
- project graph readiness 的主 provider。
- natural language query -> process / symbol / definitions。
- `context`、`impact`、`detect_changes`、`route_map`、`api_impact`、`shape_check`、`cypher`。
- repo registry / workspace group / group readiness。
- parent workspace 下的 GitNexus-first read-only orientation。
- `.spec-first/graph/*` / `.spec-first/providers/gitnexus/*` canonical readiness。

CodeGraph 当前没有：

- spec-first provider registry pin。
- graph-bootstrap adapter。
- canonical readiness artifacts。
- GitNexus host instruction / graph-facts contract。
- repo registry。
- group readiness。
- contract registry / cross-links。
- group query/context/impact。
- Cypher/resource/schema surface。
- route/API/shape evidence 的 spec-first contract。

`projectPath` 只能说明它能查询另一个项目的本地 DB，不能替代 GitNexus OSS 的 group/cross-impact，更不能替代 Enterprise 的 unified graph across repositories。

因此，如果把 GitNexus 删除、只保留 CodeGraph，当前项目会丢失：

```text
global_knowledge provider contract
workspace GitNexus readiness
repo registry/group evidence
cross-repo impact orientation
GitNexus native capabilities
existing graph-bootstrap readiness path
host instruction GitNexus-first policy
```

这属于明确降级，不是直接平替。

## 7. 是否可以直接平替 CRG

结论：当前不支持无降级直接平替；未来可以做成候选 provider。

CodeGraph 与 CRG 的能力重叠比与 GitNexus 更高：

- 都能做 symbol / call graph / impact。
- CodeGraph 有 `affected`，可以输出受影响测试文件。
- CodeGraph `context` / `explore` 对 reviewer 拿源码上下文很友好。
- CodeGraph MIT license 和 self-contained runtime 对工程接入有吸引力。

但它仍不能直接替掉 CRG 的当前 spec-first 角色，因为 CRG 已经被治理成 canonical `impact_context` provider：

```text
CRG build/status/query proof
-> .spec-first/providers/code-review-graph/status.json
-> .spec-first/providers/code-review-graph/normalized/*
-> .spec-first/impact/bootstrap-impact-capabilities.json
-> review-pre-facts
-> spec-code-review Coverage / impact context
```

CodeGraph 当前缺少这些迁移件：

| 缺口 | 为什么影响直接平替 |
| --- | --- |
| provider registry | `mcp-tools.json` 允许 provider id 目前只有 `gitnexus` 和 `code-review-graph` |
| bootstrap command shape | 没有 `codegraph init/index/sync/status/query proof` 的 allowlist 与 reason_code |
| normalized impact adapter | `affected` / `impact` 输出还没有映射到 `context_selection`、`impact_radius`、`review_support` |
| review-pre-facts | `$spec-code-review` 当前围绕 CRG 输出 review-impact query plan |
| dirty/stale contract | CodeGraph watcher / sync 未纳入 `worktree_status_hash`、provider fingerprint、dirty-advisory |
| no hidden daemon | MCP watcher 默认 auto-sync，必须被显式治理 |
| related tests 语义 | `affected` 是 file dependent + test pattern，不等价 CRG/GitNexus 的 diff-symbol/process 影响证据 |

因此，CodeGraph 可以成为“替换 CRG 的实验候选”，但不是“现在直接删除 CRG 并平替”。

## 8. 是否可以同时替掉 GitNexus 和 CRG

结论：不支持。

只保留 CodeGraph 会把当前两类 provider 压成一个单仓探索工具：

```text
GitNexus global_knowledge
  + CRG impact_context
  -> CodeGraph local single-repo code intelligence
```

这会丢失至少四类能力：

1. GitNexus 的 workspace/repo registry/group/cross-impact 语义。
2. GitNexus 已接入的 canonical graph readiness 与 host instruction policy。
3. CRG 已接入的 canonical impact readiness 与 review-pre-facts。
4. spec-first 的显式 refresh / no hidden watcher / downstream evidence contract。

所以答案不是“CodeGraph 是否优秀”，而是“它是否覆盖当前两个 provider 的系统角色”。当前答案是否定的。

## 9. 与 GitNexus 平替 CRG 目标的关系

17 号文档的结论仍成立：

```text
GitNexus OSS 能力层已具备平替 CRG 的主要默认用途。
当前工程层不能只删 CRG；需要先补 GitNexus compiled impact adapter、review preflight contract、canonical impact readiness 和 tests/docs。
```

和 CodeGraph 的比较后，推荐不变：

```text
主路径：GitNexus 直接平替 CRG
非主路径：CodeGraph 作为实验性第三 provider 观察
不推荐：CodeGraph 替换 GitNexus
不推荐：CodeGraph 同时替换 GitNexus + CRG
```

原因：

- GitNexus 已是当前项目 required provider。
- GitNexus 已有 `detect_changes` / `impact --include-tests` / route/API/shape/cypher/group 能力。
- GitNexus 已接入 setup / graph-bootstrap / host instruction / graph-facts。
- GitNexus OSS 的多仓 group 能力已能覆盖 spec-first 当前 workspace orientation 目标。
- 用 GitNexus 替 CRG 是 provider 收敛；用 CodeGraph 替 GitNexus 是 provider 重建。

## 10. 推荐路径

### 10.1 当前不要引入 CodeGraph 默认路径

短期建议：

- 保持 `gitnexus` 为 required `global_knowledge` provider。
- 保持 CRG，直到 GitNexus adapter 完成。
- 不把 CodeGraph 加入 required provider。
- 不让 CodeGraph watcher 参与 canonical readiness。

### 10.2 先完成 GitNexus -> CRG 收敛

最小可维护顺序：

1. 为 GitNexus 增加 compiled impact adapter，把 `detect_changes` / `impact --include-tests` 映射到 `.spec-first/impact/bootstrap-impact-capabilities.json`。
2. 修改 `review-pre-facts.js`，让 `$spec-code-review` 优先消费 GitNexus review-impact facts。
3. 更新 `skills/spec-code-review/SKILL.md`，把 CRG primary 改成 GitNexus primary。
4. 补齐 fixture tests：diff impact、related tests、dirty-advisory、stale、definitions-only、provider failure。
5. 更新 contracts、README、用户手册。
6. 删除 CRG required/provider path、命令 projection、旧 normalized artifacts 读取和相关 tests。

这条路径是“收敛 provider 数量”，不是新增第三套图谱治理。

### 10.3 如果要试验 CodeGraph，应作为 optional experimental provider

如果后续确实要评估 CodeGraph，建议只做实验路径：

| 规则 | 建议 |
| --- | --- |
| provider role | `impact_context_experimental` 或 `code_exploration_experimental`，不要替换 `global_knowledge` |
| package pin | `@colbymchenry/codegraph@0.9.4` 或后续明确版本，不用 floating latest |
| refresh | 只允许 `$spec-graph-bootstrap` 调 `codegraph index/sync/status`，默认禁用 watcher |
| MCP | live MCP 只能算 `session-local` evidence |
| artifacts | 写 `.spec-first/providers/codegraph/status.json` 与 normalized impact facts |
| tests | 先证明 status/query proof、dirty/stale/fingerprint、affected tests 和 review Coverage |
| fallback | 不作为长期 fallback 写进主流程，避免 provider proliferation |

实验成功的验收标准不是“CodeGraph MCP 好用”，而是：

```text
同一 diff 下，它能稳定产出不弱于 CRG 的 review-impact facts；
这些 facts 能被 `$spec-code-review` 消费；
失败时 reason_code / degraded mode 清晰；
不会隐藏 watcher / sync side effect；
不会破坏 GitNexus global_knowledge 主路径。
```

## 11. 反模式

不要做这些事：

- 看到 CodeGraph 有 `projectPath` 就把它当多仓统一图谱。
- 让 MCP watcher 自动刷新后，把结果当 canonical `.spec-first/graph/*` readiness。
- 在 plan/work/debug/review 中自动运行 `codegraph index` / `sync`。
- 在没有 adapter 和 tests 的情况下删除 CRG。
- 用 CodeGraph 替换 GitNexus host instruction block。
- 把 CodeGraph 的 `affected` 当成完整 diff impact / process impact。
- 为了“兼容三套 provider”扩大 spec-first graph contract；这会违背 light contract。

## 12. 最终判定

| 问题 | 判定 |
| --- | --- |
| CodeGraph 能否直接平替 GitNexus | 不支持 |
| CodeGraph 能否直接平替 CRG | 当前不支持；未来可作为实验候选 |
| CodeGraph 能否同时替掉 GitNexus + CRG | 不支持 |
| GitNexus OSS 是否足以作为 CRG 平替目标 | 能力层足以；工程层需迁移后才能删除 CRG |
| 当前最佳实践 | 保留 GitNexus 主路径，推进 GitNexus->CRG 收敛；CodeGraph 暂不进默认路径 |

一句话结论：

```text
CodeGraph 是一个有价值的单仓 AI 代码探索加速器，但不是当前 spec-first 的 GitNexus/CRG 直接平替方案。
当前真正符合“不降级直接平替 CRG”目标的路线，仍是把 GitNexus OSS 的 impact / detect_changes 能力编译进 spec-first 的 canonical review-impact contract，然后删除 CRG。
```
