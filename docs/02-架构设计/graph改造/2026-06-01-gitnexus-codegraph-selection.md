---
title: GitNexus vs CodeGraph 对比选型
lifecycle: historical-input
date: 2026-06-01
author: reviewer
status: research-decision
target: spec-first graph provider
---

# GitNexus vs CodeGraph 对比选型

## 0. 结论

当前 `spec-first` 更适合继续以 **GitNexus 作为主图谱 provider**。

核心原因不是 GitNexus 在所有维度都更强，而是它更贴近 `spec-first` 当前的核心链路和治理模型：

```text
Codebase -> Graph -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge
```

GitNexus 已经覆盖 `spec-first` 最需要的 workflow evidence：execution process、impact、detect_changes、API route impact、shape_check、tool_map、Cypher、multi-repo group contract。它也已经被当前 `spec-first` 的 `mcp-setup`、`graph-bootstrap`、review-pre-facts、workspace readiness、graph evidence policy 等契约体系接住。

CodeGraph 的优势集中在另一个方向：本地安装体验、MIT license、自带 Node runtime、SQLite/FTS5、watcher 自动同步、低 token/code context 读取成本、更多语言和框架覆盖。它很适合作为 **可选的 context acceleration provider** 或 **商业友好备选 provider**，但不适合在当前阶段直接替换 GitNexus 成为 `spec-first` 的 canonical graph provider。

| 决策项 | 结论 | 原因 |
|---|---|---|
| 当前主 provider | GitNexus | 与现有 readiness artifact、review/plan/work evidence、multi-repo group、API/shape/tool contract 高度对齐 |
| CodeGraph 当前定位 | Optional / experimental context provider | 适合快速代码理解、上下文压缩、自动 fresh session evidence,但需要先补 spec-first adapter contract |
| 是否立即替换 | 不建议 | 会重写 provider artifact、dirty gate、workflow prose、review-pre-facts、workspace group contract,收益不足以覆盖迁移成本 |
| 是否值得继续跟踪 | 值得 | MIT、自包含安装、auto-sync、语言/框架覆盖和 benchmark 方法值得吸收 |
| 下一步 | 保持 GitNexus primary,另立 CodeGraph optional spike | 先做只读 proof，不进入 required provider，不改变现有 canonical artifacts |

## 1. 证据边界

本报告是选型研究文档，不是 provider readiness refresh，也不是 benchmark 复现报告。

| 证据 | 来源 | 等级 | 用途 | 限制 |
|---|---|---|---|---|
| spec-first 角色契约 | `docs/10-prompt/结构化项目角色契约.md` | confirmed-source | 判断是否符合 `Light contract + Explicit boundaries + Scripts prepare, LLM decides` | 只给架构判断基线 |
| spec-first graph facts | `.spec-first/graph/graph-facts.json` | confirmed artifact, dirty-advisory | 当前 repo 的 GitNexus 可用性事实 | worktree dirty,只能作为 advisory graph evidence |
| graph evidence policy | `docs/contracts/graph-evidence-policy.md` | confirmed-source | provider 证据等级和刷新边界 | 不评价具体 provider 质量 |
| graph provider consumption | `docs/contracts/graph-provider-consumption.md` | confirmed-source | canonical artifact 与 consumer 字段边界 | 当前契约以 GitNexus 为中心 |
| workspace GitNexus consumption | `docs/contracts/workspace-gitnexus-consumption.md` | confirmed-source | parent workspace / group evidence 边界 | 未覆盖 CodeGraph |
| GitNexus 本地源码 | `/Users/kuang/xiaobu/GitNexus`, commit `4870879b216a070b4be0c56cbd7fd5a0c7496fdd` | confirmed local source | 产品能力、架构、工具、license、group pipeline | 本地 `gitnexus/package.json` 为 `1.6.5`; spec-first pin 为 `1.6.6-rc.76` |
| GitNexus MCP session | `list_repos`, `query`, `gitnexus://repos` | session-local | 验证当前 MCP surface 与多仓 registry 形态 | 不回写 compiled readiness |
| CodeGraph 本地源码 | `/Users/kuang/xiaobu/codegraph`, commit `8629f7ab4cf09c7542a86166a9ca9e22ac52acb7` | confirmed local source | 产品能力、架构、工具、license、daemon/watch 行为 | 未在本轮对 `spec-first` 建索引实测 |
| CodeGraph benchmark docs | `/Users/kuang/xiaobu/codegraph/docs/benchmarks/*` | advisory | 了解设计目标和自测指标 | 未独立复现,不能作为 confirmed performance claim |

关键约束：

- 本报告不把 provider 输出当 confirmed truth。
- 本报告不建议普通 workflow 静默运行 provider refresh、watcher、daemon 或 mutation tool。
- 本报告不修改 source/runtime 生成逻辑。

## 2. spec-first 的选型问题

`spec-first` 不是通用 IDE 插件，也不是单纯代码搜索工具。它需要 graph provider 服务 AI coding harness 的证据链。

| 需求层 | spec-first 需要什么 | 为什么重要 | GitNexus 适配 | CodeGraph 适配 |
|---|---|---|---|---|
| Evidence Harness | graph facts 有 freshness、reason_code、artifact path、query_ready、impact capability | 下游 workflow 不能把 provider 输出误读成事实 | 高,现有契约已围绕 GitNexus 建好 | 中,需新增 adapter 和 readiness artifact |
| Context Harness | 快速定位相关 symbol/file/flow | 降低 LLM 盲读和 token 浪费 | 高,query/context/process/resource 可用 | 高,context/explore/node 目标很明确 |
| Review Harness | detect_changes、impact、related-test candidate、API/shape mismatch | code review 需要变更影响面和 consumer 证据 | 高,已有 detect_changes、impact、api_impact、shape_check | 中,有 impact/affected,但缺现有 review contract 对接 |
| Governance Harness | mutation boundary、provider refresh ownership、dirty/stale 降级 | 防止 hidden rebuild、silent write、source/runtime 污染 | 高,现有 graph-bootstrap 已加 allowlist/skip-agents-md/dry-run normalizer | 低到中,watcher/daemon/installer 默认行为需重新收敛 |
| Multi-repo | parent workspace registry/group/contract bridge | spec-first 已支持多仓 workspace 和 group evidence | 高,group_list/group_sync/resources/cross impact 已有 | 低到中,projectPath 支持跨项目查询,但无 group contract registry |
| Source/runtime boundary | provider 不能拥有 AGENTS/CLAUDE source truth | spec-first host docs 由 init/generator 管理 | 中,GitNexus 原生会写 host docs,但 spec-first 已用 `--skip-agents-md` 约束 | 中,CodeGraph 不写 AGENTS/CLAUDE,但 MCP initialize instructions 会进 agent prompt |
| Distribution | 用户容易安装,商业使用风险可控 | spec-first 是外部用户工具 | 中,Node/native deps 和 Noncommercial license 是风险 | 高,MIT + self-contained bundle 是明显优势 |

## 3. L0 总览对比

| 维度 | GitNexus | CodeGraph | 当前 spec-first 取舍 |
|---|---|---|---|
| 产品定位 | Graph-powered code intelligence,偏 agent 代码图谱和影响分析 | Semantic code intelligence,偏减少 Read/Grep 和加速结构理解 | spec-first 更需要治理型 evidence,不只是低成本探索 |
| License | `PolyForm-Noncommercial-1.0.0` | MIT | CodeGraph 对商业分发更友好;GitNexus 只能作为外部 provider 并保留 license notice |
| 存储 | LadybugDB 图数据库 | SQLite + FTS5 | GitNexus 更像 queryable graph DB;CodeGraph 更轻更易分发 |
| 索引目录 | `.gitnexus/` + global registry `~/.gitnexus/registry.json` | `.codegraph/codegraph.db` | spec-first 现有 dirty gate 已支持 `.gitnexus/`,未支持 `.codegraph/` |
| Freshness | `analyze/status/staleness`,spec-first 显式 bootstrap 管理 | watcher auto-sync + staleness banner + connect-time catch-up | CodeGraph 用户体感更好,但与 spec-first explicit refresh 模型冲突 |
| MCP 工具 | query/context/impact/detect_changes/cypher/route_map/api_impact/shape_check/tool_map/group | search/context/trace/callers/callees/impact/node/explore/files/status | GitNexus 工具面更贴 review/plan/API contract;CodeGraph 更贴 context/read displacement |
| Multi-repo | registry + group + contract bridge + cross-impact | projectPath 跨项目查询 | GitNexus 明显更适合 parent workspace 和微服务 contract |
| 当前集成 | 已是 required graph-provider | 无集成 | 替换成本高 |
| 最强场景 | review impact、execution process、route/API/shape、多仓 contract | local context acceleration、large repo code exploration、install/license | 不同赛道,不是简单同类替换 |

## 4. L1 能力地图

### 4.1 MCP 工具能力映射

| 能力 | GitNexus 工具/资源 | CodeGraph 工具 | 对 spec-first 的意义 | 更适合者 |
|---|---|---|---|---|
| Repo discovery | `list_repos`, `gitnexus://repos` | `projectPath` 参数, `codegraph_status` | parent workspace 定位 | GitNexus |
| 自然语言图谱查询 | `query` | `codegraph_context` | plan/debug 初始定位 | 接近,CodeGraph 更省上下文,GitNexus 带 process |
| 单 symbol 上下文 | `context`, `gitnexus://repo/{name}/context` | `codegraph_node`, `codegraph_callers`, `codegraph_callees` | work/debug 聚焦读取 | 接近 |
| Trace / execution flow | `Process`, `STEP_IN_PROCESS`, `gitnexus://repo/{name}/process/*` | `codegraph_trace` | “怎么从 X 到 Y” | CodeGraph trace 更直接;GitNexus process 更契约化 |
| Blast radius | `impact` | `codegraph_impact` | plan/review 影响面 | GitNexus,因为已接入 risk/depth/process/module |
| Git diff impact | `detect_changes` | `codegraph affected` CLI 侧重 affected tests | commit/review 前检查 | GitNexus |
| Route map | `route_map` | 框架 route nodes,但无同等 route_map tool | API handler/consumer 定位 | GitNexus |
| API impact | `api_impact` | 无同等一体工具 | 修改 API 前的 consumer 风险 | GitNexus |
| Response shape check | `shape_check` | 无同等工具 | contract drift review | GitNexus |
| Tool surface map | `tool_map` | 无同等工具 | MCP/RPC 工具治理 | GitNexus |
| Schema-aware graph query | `cypher`, `gitnexus://repo/{name}/schema` | SQLite 可查,但 MCP 不暴露通用 SQL query | 高级结构分析 | GitNexus |
| Multi-repo group | `group_list`, group resources, group-aware query/context/impact | 无 group contract registry | parent workspace / 微服务 | GitNexus |
| Source snippets in one call | `query/include_content`, `context/include_content` | `codegraph_explore`, `codegraph_node` | 减少 Read | CodeGraph |
| File tree | resources / Cypher / query | `codegraph_files` | 快速结构扫描 | CodeGraph |
| Rename mutation | `rename` dry-run | 无主工具 | mutation-gated maintenance | GitNexus,但普通 workflow 不自动用 |

结论：如果问题是 “让 agent 少读文件”，CodeGraph 更强。如果问题是 “让 workflow 有可治理、可追溯、可降级的工程证据”，GitNexus 更强。

### 4.2 CLI 能力对比

| 类别 | GitNexus CLI | CodeGraph CLI | 判断 |
|---|---|---|---|
| 初始化 | `gitnexus analyze`, `setup` | `codegraph init -i`, `install` | CodeGraph 更轻,GitNexus 更像 provider lifecycle |
| 查询 | `query`, `context`, `impact`, `cypher`, `detect-changes` | `query`, `context`, `callers`, `callees`, `impact`, `affected`, `files` | GitNexus 更覆盖 review/graph DB;CodeGraph 更贴常用 exploration |
| 服务 | `mcp`, `serve` | `serve --mcp` + daemon/proxy | CodeGraph daemon 改善启动成本,但增加治理变量 |
| 清理 | `clean`, `remove` | `uninit`, `unlock`, `uninstall` | 两者都有 |
| 文档/wiki | `wiki` | 无同等主要能力 | GitNexus |
| 多仓 | `group create/add/sync/contracts/query/status` | `projectPath` 查询 | GitNexus |
| 自动 agent 配置 | `setup`, `analyze` 安装 skills/hooks/AGENTS/CLAUDE | `install` 配 MCP, server initialize instructions | 两者都会影响 host surface,都需 spec-first 接管边界 |

## 5. L2 架构与数据模型

| 维度 | GitNexus | CodeGraph | 对 spec-first 的影响 |
|---|---|---|---|
| 解析管线 | 12 phase DAG: scan/structure/markdown/cobol/parse/routes/tools/orm/crossFile/mro/communities/processes | extraction + resolution + graph traversal + context builder | GitNexus 阶段更贴 artifact 化 evidence;CodeGraph 更贴快速工具响应 |
| 图模型 | 分类型 node table + 单一 `CodeRelation` rel table,包含 `Community`、`Process`、`Route`、`Tool`、`Section` | SQLite `nodes` / `edges` / `files` / `unresolved_refs` + FTS5 | GitNexus schema 更适合 Cypher 和 process evidence;CodeGraph schema 更简单 |
| Search | BM25 + optional embeddings + RRF | FTS5 + context/explore 排序 | CodeGraph 更强调 token budget;GitNexus 更强调 graph query |
| Process 抽象 | 一等 `Process` node 和 `STEP_IN_PROCESS` | `trace` 工具按 from/to 查路径 | GitNexus 更适合 durable workflow evidence |
| API/route/tool 抽象 | 一等 `Route` / `Tool` node,有 route/shape/tool tools | route/component/framework 支持多,但缺 spec-first 需要的一体 contract tools | GitNexus 更适合 review/API contract |
| Multi-repo contract | group.yaml, Contract Registry, bridge.lbug, cross-impact | 无同等 group registry | GitNexus 明显胜出 |
| Incremental/freshness | Git commit staleness + analyze refresh;spec-first 编译 graph-facts | watcher auto-sync、pending banner、connect-time catch-up | CodeGraph 用户体验更好,但需要 spec-first 重新定义 freshness truth |
| Runtime footprint | Node >=22, native LadybugDB/tree-sitter/optional grammars | self-contained bundle, bundled Node, WASM grammars, SQLite | CodeGraph 安装和跨平台更友好 |

## 6. L3 与 spec-first 契约的适配

### 6.1 Light contract

| 判断点 | GitNexus | CodeGraph | 结论 |
|---|---|---|---|
| provider 输出能否收敛为轻量 facts | 已有 `provider-status.json`、`graph-facts.json`、`impact-capabilities.json` | 需要新建 adapter | GitNexus 更适合当前 |
| 是否需要把 provider 内部 schema 泄漏给 workflow | 已通过 canonical artifacts 隔离一部分,但 GitNexus-specific 命名仍较重 | 若接入可从 status/context/impact 取较轻 facts | CodeGraph 可做轻,但尚未实现 |
| 是否能避免第二套 readiness enum | 当前已有 GitNexus 专用 vocab,继续复用成本低 | 直接接入会引入 `.codegraph` freshness/watcher/daemon 新状态 | GitNexus 更稳 |

### 6.2 Explicit boundaries

| 边界 | GitNexus 当前状态 | CodeGraph 当前状态 | 风险 |
|---|---|---|---|
| Source vs runtime | GitNexus 原生 `analyze` 会写 AGENTS/CLAUDE/skills;spec-first 用 `--skip-agents-md` 和 normalizer dry-run 收束 | CodeGraph 不写 AGENTS/CLAUDE,但 MCP initialize instructions 自动进入 agent context | 两者都需 host-surface 管理 |
| Provider refresh ownership | spec-first 已规定只有 `$spec-graph-bootstrap` 可写 canonical graph readiness | CodeGraph watcher/daemon 自动 sync,不是当前 bootstrap-owned | CodeGraph 若作为 primary 会冲突 |
| Dirty gate | `.gitnexus/` 已在 setup-owned dirty ignore | `.codegraph/` 未纳入 | CodeGraph 接入前必须补 dirty-ignore 和 artifact policy |
| Mutation | GitNexus 有 `rename`、`group_sync`,已标 mutation-gated | CodeGraph 主 MCP 工具读为主,CLI 有 install/uninstall/uninit | GitNexus mutation 风险已治理;CodeGraph installer/uninstaller 仍需外置 |

### 6.3 Scripts prepare, LLM decides

| 点 | GitNexus | CodeGraph | 判断 |
|---|---|---|---|
| 确定性脚本准备 facts | `spec-graph-bootstrap` 已能运行 provider command、归一化 status、写 reason_code | 尚无 spec-first adapter | GitNexus |
| LLM 做语义判断 | 当前契约明确 definitions-only/advisory/session-local 等 | CodeGraph server instructions 要求“trust results, don't re-verify with grep” | CodeGraph 默认姿态与 spec-first 冲突 |
| Provider 不拥有结论 | GitNexus 在 spec-first 内被降级为 evidence input | CodeGraph 原生提示更鼓励直接信任 provider output | 需要改写/包裹 CodeGraph 使用说明 |

CodeGraph 最大的不兼容点不是工具能力，而是它的 MCP server-level instructions。其本地源码 `src/mcp/server-instructions.ts` 明确指导 agent “Trust codegraph's results, don't re-verify them with grep”。这对减少成本有价值，但与 `spec-first` 的证据政策冲突：provider facts 不能单独支撑 finding、root cause、scope expansion、merge decision。若接入 CodeGraph，必须在 spec-first 层把它重新归类为 `session-local/advisory evidence`。

## 7. L4 Workflow 逐层适配

| Workflow 节点 | 需要的 graph 能力 | GitNexus 适配 | CodeGraph 适配 | 选型 |
|---|---|---|---|---|
| `using-spec-first` | 判断 graph-ready / fallback / target repo | 已读 `.spec-first/graph/*` 和 workspace facts | 无现成 readiness facts | GitNexus |
| `$spec-mcp-setup` | provider package pin、host config、native capabilities projection | 已在 `skills/spec-mcp-setup/mcp-tools.json` 定义 GitNexus required provider | 需新增 optional provider,不能直接 required | GitNexus |
| `$spec-graph-bootstrap` | 运行 provider command,产出 canonical graph facts | 已完整支持 GitNexus | 需新增 bootstrap adapter、status parser、dirty rules | GitNexus |
| `$spec-plan` / brainstorm | codebase orientation、impact on plan、risk/follow-up | GitNexus query/context/impact/process/group 可用 | CodeGraph context/explore/trace 很强,但 evidence envelope 缺失 | GitNexus primary,CodeGraph optional |
| `$spec-work` | bounded source read,shared symbol impact risk | GitNexus impact session-local 可作为 risk check | CodeGraph context/node/explore 可减少 Read,但不能扩大 scope | CodeGraph 可辅助,GitNexus 管 evidence |
| `$spec-debug` | call chain、suspect symbol、blast radius | GitNexus context/process/impact | CodeGraph trace/context 很适合快速定位 | 双方接近,CodeGraph 可做辅助 |
| `$spec-code-review` | diff impact、affected processes、related tests、API/shape | GitNexus detect_changes/api_impact/shape_check 是强项 | CodeGraph affected/impact 可补 test candidate,但缺现有 review parity | GitNexus |
| `$spec-doc-review` | review-pre-facts,codebase facts block | 已支持 GitNexus query/context/impact/detect_changes | 无接入 | GitNexus |
| Knowledge / compound | 复用 evidence、沉淀 solution | GitNexus evidence 已有 vocabulary | CodeGraph benchmark/coverage 方法可作为学习素材 | GitNexus current,CodeGraph methodology |
| Parent workspace | registry、group、per-child query_usability | GitNexus 一等支持 | CodeGraph 仅 projectPath 查询,没有 group contract | GitNexus |

## 8. L5 加权评分

评分只针对“当前 spec-first 应选择哪个作为主 provider”，不是通用优劣排名。满分 10 分，权重总计 100。

| 维度 | 权重 | GitNexus 分 | GitNexus 理由 | CodeGraph 分 | CodeGraph 理由 |
|---|---:|---:|---|---:|---|
| 与 spec-first 现有契约对齐 | 15 | 9 | 已有 graph/provider/impact/workspace/review-pre-facts 契约 | 6 | 能力可映射,但无 adapter |
| 当前集成成本 | 14 | 10 | 已是 required provider | 3 | 需重建 setup/bootstrap/dirty/review 接入 |
| Evidence governance | 12 | 9 | query_ready、reason_code、definitions-only、dirty-advisory 已有 | 5 | status/staleness 有,但不符合现有 canonical artifacts |
| Workflow-specific 能力 | 12 | 10 | API/shape/tool/group/detect_changes/process 覆盖高 | 6 | context/trace 强,review/API/multi-repo 弱 |
| Freshness 用户体感 | 8 | 6 | 显式 analyze/bootstrap,更可治理但重 | 9 | watcher/daemon/banner/catch-up 体验好 |
| 安装/分发 | 8 | 5 | native deps、Node 22、npx pin、Noncommercial notice | 9 | self-contained bundle、MIT、跨平台 |
| License / 商业友好 | 8 | 3 | PolyForm Noncommercial,商业需审查 | 10 | MIT |
| Multi-repo / contract | 9 | 10 | group registry / cross-impact 一等支持 | 4 | projectPath 不是 group contract |
| 语言/框架覆盖 | 6 | 7 | 主流语言 + Vue/Dart/Cobol 等,但较少 | 9 | 更多语言/框架和 cross-language 设计 |
| 可维护性与边界清晰 | 8 | 8 | provider 特定但已治理 | 6 | 工具轻,但 auto daemon 和 trust instructions 需收束 |
| **加权总分** | **100** | **811 / 1000** | 当前主 provider 适配度最高 | **626 / 1000** | 适合 optional provider,不适合直接替换 |

如果把问题改成“给一个商业用户默认推荐一个轻量本地代码理解 MCP”，CodeGraph 的 license/install/freshness 分会显著提高，甚至可能胜出。但在 `spec-first` 当前主链路下，GitNexus 更合适。

## 9. 风险清单

### 9.1 GitNexus 风险

| 风险 | 影响 | 当前缓解 | 剩余问题 |
|---|---|---|---|
| Noncommercial license | spec-first 不能把它当无条件商业依赖 | `license_notice.required=true` | 用户商业使用仍需显式审查 |
| Provider 原生会写 host docs/skills/hooks | 可能污染 source/runtime 边界 | `--skip-agents-md`, spec-first normalizer dry-run | 需要持续防回归 |
| Native deps / LadybugDB / tree-sitter | 安装与跨平台问题 | pin + setup/bootstrap diagnostics | 用户环境仍可能失败 |
| Refresh 重 | 用户可能觉得 graph-bootstrap 成本高 | explicit refresh + dirty-advisory 降级 | 体感不如 watcher |
| provider-specific contract 多 | `spec-first` 与 GitNexus 耦合 | canonical artifacts 隔离 | 长期可能需要 provider abstraction |
| Mutation tools | `rename` / `group_sync` 可能误用 | mutation-gated, preview-first | workflow prose 需持续强调 |

### 9.2 CodeGraph 风险

| 风险 | 影响 | 接入前必须做 |
|---|---|---|
| MCP initialize instructions 要求 trust results | 与 spec-first “provider evidence is not semantic authority” 冲突 | 在 spec-first contract 中覆盖为 session-local/advisory evidence;必要时限制自动使用 |
| watcher/daemon 自动 sync | 与 explicit refresh ownership 冲突 | 不能直接写 canonical readiness;先作为 session-local evidence |
| `.codegraph/` 未纳入 dirty ignore | 一旦接入会污染 graph-affecting dirty 判断 | 增加 source-owned dirty-ignore contract 和 tests |
| 无 route_map/api_impact/shape_check/tool_map/group contract | review/API/workspace 能力缺口 | 只能用于 context lane,不能替换 GitNexus review lane |
| benchmark 是自报 | 不能作为 spec-first 选型 confirmed fact | 需在 spec-first repo 和用户代表仓库独立复测 |
| install/uninstall 写 host config | 可能绕过 spec-first init/setup ownership | 只允许 spec-first setup 生成 config,不让 installer 成为 source |
| projectPath 不是 target_repo authority | 多仓写入边界仍需 spec-first 判断 | workspace contract 必须保留 target_repo / per-child scope gate |

## 10. 选型决策树

| 场景 | 推荐 |
|---|---|
| 当前 `spec-first` 主 provider | GitNexus |
| 需要 review blast radius / API consumer / response shape / tool handler map | GitNexus |
| 需要 parent workspace / multi-repo contract / group cross-impact | GitNexus |
| 需要用户首次安装最少摩擦,且商业使用友好 | CodeGraph 值得优先评估 |
| 需要大仓快速理解、少 Read/Grep、单 repo flow trace | CodeGraph 可作为辅助 |
| graph facts stale 或 dirty-advisory | 直接源码读取 + GitNexus/CodeGraph session-local pointer,不声称 primary graph evidence |
| 没有明确 target_repo 的写入/测试/commit | 两者都不能替代 scope 决策 |

## 11. 推荐落地顺序

### 11.1 现在不做的事

| 不做 | 原因 |
|---|---|
| 不把 CodeGraph 加成 required provider | 需要重建 setup/bootstrap/readiness/review 契约,成本过高 |
| 不把 GitNexus 替换掉 | 会丢失 API/shape/group/review-pre-facts 等现有工作流能力 |
| 不引入抽象化 provider 平台 | 目前只有一个真实 primary provider consumer,过早抽象会加重 contract |
| 不让普通 workflow 自动运行 CodeGraph watcher/daemon/init | 违反 explicit refresh / source-runtime 边界 |
| 不把 CodeGraph benchmark 写成 spec-first 性能结论 | 未复现,只能作为 advisory |

### 11.2 推荐短期路线

| 步骤 | 动作 | 目标 | 验证 |
|---|---|---|---|
| 1 | 保持 GitNexus required primary provider | 不扰动现有 workflow | 现有 graph-bootstrap/review-pre-facts tests |
| 2 | 新建 CodeGraph optional spike 文档或计划,不改 runtime | 明确只读 context lane 目标 | docs-only review |
| 3 | 若 spike 通过,在 `mcp-tools.json` 增加 optional provider 而不是 required | 让用户显式选择 | setup contract tests |
| 4 | 只接 `status/search/context/node/explore/files` 作为 session-local context evidence | 避免错误替换 review evidence | evidence envelope tests |
| 5 | 不使用 `codegraph_impact` 作为 full review parity,直到证明与 diff/test 相关性 | 防止 blast radius 误读 | representative repos eval |
| 6 | 增加 `.codegraph/` dirty-ignore 规则和 source/runtime 文档 | 防止 generated provider state 污染 | dirty gate contract tests |
| 7 | 独立 A/B 复测 token/read savings | 判断是否值得扩展 | fixed prompt + fixed repo + median report |

### 11.3 如果未来要让 CodeGraph 成为 primary 的最低门槛

| 门槛 | 必须证明 |
|---|---|
| Canonical artifacts | 能产出等价 `provider-status`, `graph-facts`, `impact-capabilities` 或明确的新 schema |
| Freshness truth | watcher/daemon 状态能被确定性采样,且不会被当成 confirmed truth |
| Review parity | `impact/affected` 能覆盖 diff impact、related tests、API/shape 的至少一部分,并有 fallback 规则 |
| Host boundary | MCP server instructions 与 spec-first evidence policy 不冲突 |
| Dirty gate | `.codegraph/` 和 host config 写入有明确 source/runtime 分类 |
| Multi-repo | parent workspace 不因 projectPath 查询绕过 target_repo scope |
| License | MIT 是优势,但也要确认 bundled runtime / optional packages 的许可证链 |

## 12. 可借鉴能力

CodeGraph 有几项值得吸收,但应“借方法,不借形态”。

| CodeGraph 能力 | 借鉴方式 | 不直接照搬的原因 |
|---|---|---|
| `codegraph_explore` 输出预算和 skeletonization | 可作为 review-pre-facts/context bundle 的 token-budget 设计参考 | spec-first 不应把 provider 输出当 Read 等价 confirmed source |
| watcher staleness banner | 可借鉴“pending file 明示”这个交互信号 | 不应让 watcher 成为 canonical readiness truth |
| self-contained bundle | 可启发 spec-first provider install 体验 | spec-first 当前 provider pin 仍由 setup owns |
| benchmark matrix | 可借鉴 read displacement / tool-call reduction 指标 | 需在 spec-first 自己的 workflow eval 中复现 |
| dynamic-dispatch coverage playbook | 可作为 graph quality roadmap 参考 | 不应把 provider 内部解析路线变成 spec-first contract |

GitNexus 也有需要继续守住的能力：

| GitNexus 能力 | 当前价值 | 需要继续治理 |
|---|---|---|
| `detect_changes` | review/commit 前影响面 evidence | candidate-only 与 stale 必须披露 |
| `api_impact` / `shape_check` | API contract drift 审查 | 不能替代源码/测试确认 |
| group contract bridge | parent workspace 和多服务影响面 | group_sync 必须 mutation-gated |
| `cypher` | 高级结构查询 | 必须 schema-first、bounded、redacted |
| route/tool map | workflow/tool ownership 分析 | 不自动扩大 implementation scope |

## 13. 最终建议

### Recommended

维持现状：`GitNexus = spec-first primary graph provider`。

理由：

1. 当前 source contracts、runtime setup、graph-bootstrap、review-pre-facts、workspace readiness 都已经以 GitNexus 为事实生产者。
2. GitNexus 工具面覆盖 `spec-first` 高价值节点：Plan 的 impact reasoning、Review 的 diff/API/shape evidence、Workspace 的 group contract、Knowledge 的 evidence replay。
3. CodeGraph 的最大优势在 context efficiency 和 install/license,这些是重要产品体验,但不是当前 `spec-first` 主 provider 的第一约束。
4. 直接替换会把 `spec-first` 从“已有 governance harness”拉回“重新定义 provider contract”的大工程,短期收益不足。

### Conditional Future

把 CodeGraph 作为 optional provider spike 跟踪：

- 定位：只读 context lane。
- 权威等级：session-local/advisory。
- 禁止：不写 canonical graph readiness,不替换 review impact,不自动 init/watch/sync。
- 成功标准：在 `spec-first` 自身和 2-3 个代表仓库中,证明能减少 Read/Grep/tool calls,且不破坏 evidence policy。

### Anti-pattern

不要把这次选型变成 “GitNexus vs CodeGraph 二选一的工具偏好”。正确分层是：

```text
GitNexus: governance-grade graph evidence provider
CodeGraph: context-efficiency graph assistant candidate
Direct source/tests/rg: conflict resolution and confirmed truth
LLM: semantic judgment owner
```

当前 `spec-first` 的主问题不是缺一个更快搜索工具，而是确保 graph evidence 在正确节点、正确等级、正确边界内被消费。按这个标准，GitNexus 仍是当前更合适的主线。
