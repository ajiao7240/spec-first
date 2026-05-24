# GitNexus 刷新策略与 Provider 直接平替决策

本文回答四个问题：

1. GitNexus 官方支持哪些刷新方式，默认是哪种方式。
2. 当前 `spec-first` 如何执行刷新，哪些节点会刷新。
3. 结合项目全景、目标和当前实现，GitNexus 刷新最佳实践是什么。
4. GitNexus 是否可以直接平替 `code-review-graph`，以及要怎样完成平替。

结论先行：

```text
GitNexus 官方刷新：
  默认入口是 `npx gitnexus analyze`。
  `analyze --force` 是强制 full re-index。
  不带 `--force` 的 `analyze` 才可能使用 GitNexus 内部 cache / selective writeback。
  `status` / `query` / `context` / `impact` / `detect-changes` 是读取或分析入口，不是刷新入口。

spec-first 当前刷新：
  `spec-first init` 不刷新 graph。
  `$spec-mcp-setup` 只刷新 setup-owned provider projection。
  `$spec-graph-bootstrap` 是唯一默认 canonical refresh 入口。
  当前默认 refresh mode 是 full；clean single-repo incremental 只是显式 opt-in fast path。
  下游 plan/work/debug/review 只消费 readiness，不自动运行 provider mutation。

直接平替判断：
  能力层：GitNexus 已具备直接平替 CRG 主要默认用途的上游能力面，包括 query/context、impact、detect-changes、process/resource/cypher。
  工程层：当前 spec-first 还不能“只删 CRG 配置”完成平替，因为 canonical impact/review contract 仍把 impact_context、impact_radius、review_support 和 `$spec-code-review` preflight 绑定到 CRG。
  推荐目标态：GitNexus 直接平替 CRG；CRG 从默认 required/provider path 中删除，而不是保留为长期降级路径。
  推荐做法：先补 GitNexus compiled impact adapter 和 contract/tests，再切换 canonical provider，最后删除 CRG 默认路径。
```

## 分析范围

本文基于当前仓库 source-of-truth、本地可执行事实和外部上游资料：

| 领域 | 证据 |
| --- | --- |
| GitNexus 官方 CLI | `npx -y gitnexus@1.6.5 --help`, `analyze --help`, `impact --help`, `detect-changes --help` |
| GitNexus 上游说明 | npm package metadata、GitHub README、GitNexus CLI help |
| CRG 官方 CLI | `uvx code-review-graph@2.3.3 --help`, `detect-changes --help` |
| CRG 上游说明 | PyPI package metadata、GitHub README |
| spec-first provider projection | `skills/spec-mcp-setup/mcp-tools.json` |
| spec-first refresh implementation | `skills/spec-graph-bootstrap/SKILL.md`, `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh` |
| downstream consumer | `skills/spec-plan/SKILL.md`, `skills/spec-work/SKILL.md`, `skills/spec-code-review/SKILL.md`, `skills/spec-debug/SKILL.md` |
| graph evidence contracts | `docs/contracts/graph-evidence-policy.md`, `docs/contracts/graph-provider-consumption.md`, `docs/contracts/downstream-graph-evidence-consumption.md` |
| 当前 artifacts | `.spec-first/graph/graph-facts.json`, `.spec-first/graph/provider-status.json`, `.spec-first/impact/bootstrap-impact-capabilities.json` |

外部参考：

- GitNexus npm: <https://www.npmjs.com/package/gitnexus>
- GitNexus GitHub: <https://github.com/abhigyanpatwari/GitNexus>
- GitNexus homepage: <https://gitnexus.vercel.app>
- code-review-graph PyPI: <https://pypi.org/project/code-review-graph/>
- code-review-graph GitHub: <https://github.com/tirth8205/code-review-graph>
- code-review-graph homepage: <https://code-review-graph.com>

本文不修改运行时行为，不删除 provider。它是刷新策略、平替可行性和迁移验收标准文档。

## 1. GitNexus 官方刷新方式

### 1.1 `gitnexus analyze` 是默认刷新入口

GitNexus 官方 CLI 把 `analyze [path]` 定义为索引入口：

```bash
npx gitnexus analyze
```

它的默认语义是：

- 首次运行时创建本地 `.gitnexus/` 索引。
- 后续运行时复用 provider-local state。
- 不带 `--force` 时，由 GitNexus 自己判断索引是否 up to date，以及能否复用 cache / selective writeback。

这是 GitNexus 的官方默认刷新方式。

### 1.2 `gitnexus analyze --force` 是强制 full re-index

GitNexus `analyze --help` 明确定义：

```bash
npx gitnexus analyze --force
```

语义是强制 full re-index。它适合：

- provider 版本升级后建立 baseline。
- 本地 `.gitnexus/` 状态怀疑损坏。
- schema、graph semantics、command projection 或 bootstrap safety contract 变化。
- 需要 correctness-first readiness proof。

它不适合成为高频小改动的性能最优路径。

### 1.3 不带 `--force` 的 `analyze` 才可能走官方增量

`gitnexus@1.6.5` 没有单独的 `incremental` 子命令。官方增量隐藏在普通 `analyze` 内部。

已确认的行为边界：

- GitNexus 仍会进入完整 analysis pipeline。
- 它会复用 parse / embedding cache。
- 它会基于文件状态判断 changed / added / deleted。
- 满足条件时，只选择性改写 DB 中受影响 file rows。
- `Community` / `Process` 等全局图谱结果仍可能重新计算。

因此 GitNexus 官方增量不是“只解析一个文件”，而是“full pipeline + cache reuse + selective DB writeback”。这个设计优先保证跨文件关系正确性。

### 1.4 `status`、`query`、`context`、`impact`、`detect-changes` 不是刷新入口

这些命令是读取或分析入口：

```bash
npx gitnexus status
npx gitnexus query <q>
npx gitnexus context <symbol>
npx gitnexus impact <symbol-or-file>
npx gitnexus detect-changes
```

它们可以证明或使用索引，但不应被当作刷新动作。

本地验证显示：

- `gitnexus impact <target>` 是 blast radius analysis，支持 `--direction`、`--repo`、`--depth`、`--include-tests`。
- `gitnexus detect-changes` 可把 git diff hunks 映射到 indexed symbols 和 affected execution flows，支持 `--scope unstaged|staged|all|compare`、`--base-ref`、`--repo`。

这两类能力是平替 CRG 的关键输入，但它们仍是读取/分析，不是刷新。

### 1.5 `clean` / `remove` 是 repair，不是普通刷新

GitNexus 支持删除 provider state 的恢复动作，例如：

```bash
npx gitnexus clean
npx gitnexus remove <target>
```

在 spec-first 语义里，这类命令必须是显式 repair：

- 不由普通 plan/work/debug/review 自动触发。
- 不作为 graph-bootstrap 的静默补救。
- 需要 preview-first、reason_code、raw log、recommended_action。

### 1.6 `index` 是注册已有索引，不是重建索引

GitNexus 的 `index` 用于把已有 `.gitnexus/` 注册到 global registry。它不是 re-analysis，不能替代 `analyze` 或 `$spec-graph-bootstrap`。

## 2. 当前 spec-first 如何刷新

### 2.1 生命周期

当前链路是：

```text
spec-first init
  -> 生成 host instruction / runtime mirror / .gitignore managed block
  -> 不运行 GitNexus analyze

$spec-mcp-setup
  -> 验证 package、host MCP config 和 provider projection
  -> 写 .spec-first/config/graph-providers.json
  -> 写 .spec-first/config/runtime-capabilities.json
  -> 写 .spec-first/config/provider-artifacts.json
  -> 不运行 GitNexus analyze/status/query

$spec-graph-bootstrap
  -> 读取 setup-owned config
  -> 校验 provider command arrays
  -> 运行 GitNexus analyze/status/query proof
  -> 运行 CRG build/status/query proof
  -> 写 canonical readiness artifacts

downstream workflows
  -> 读取 readiness
  -> 披露 stale / dirty / degraded limitation
  -> 必要时建议 graph-bootstrap
  -> 不自动 rebuild provider index
```

这个分工符合项目角色契约：

```text
Scripts prepare deterministic facts.
LLM decides semantic relevance.
Advisory facts are not confirmed truth.
```

### 2.2 `init` 不刷新 GitNexus

`spec-first init --claude|--codex` 做的是 host/runtime 入口准备：

- 生成或更新 `AGENTS.md` / `CLAUDE.md` managed blocks。
- 更新 host runtime mirrors。
- 更新 `.gitignore` managed block，忽略 `.gitnexus/`、`.code-review-graph/`、`.spec-first/graph/`、`.spec-first/providers/`、`.spec-first/impact/` 等本地可重建 artifacts。
- 输出 next steps。

它不运行：

- `gitnexus analyze`
- `gitnexus status`
- `gitnexus query`
- `gitnexus clean`

GitNexus host instruction block 只是使用边界提醒，不是 readiness proof。

### 2.3 `$spec-mcp-setup` 不刷新图谱

`$spec-mcp-setup` 负责 required harness runtime 与 provider projection。

它会：

- 预热或验证 `gitnexus@1.6.5`。
- 写 Claude/Codex host MCP 配置。
- 生成 `.spec-first/config/graph-providers.json`。
- 生成 `.spec-first/config/runtime-capabilities.json`。
- 生成 `.spec-first/config/provider-artifacts.json`。

它不运行：

- GitNexus analyze/status/query。
- CRG build/status/query。
- provider repair。
- branch switch / pull / rebase 后的 refresh。

setup-owned facts 能说明工具和命令面可构造，但不能证明当前 repo graph query-ready。

### 2.4 `$spec-graph-bootstrap` 是唯一默认 canonical refresh 入口

`$spec-graph-bootstrap` / `bootstrap-providers.sh` 当前是唯一默认本地 workflow，可以刷新：

```text
.spec-first/providers/gitnexus/**
.spec-first/providers/code-review-graph/**
.spec-first/graph/provider-status.json
.spec-first/graph/graph-facts.json
.spec-first/graph/bootstrap-report.md
.spec-first/impact/bootstrap-impact-capabilities.json
```

GitNexus 当前 setup projection：

```json
{
  "bootstrap": ["npx", "-y", "gitnexus@1.6.5", "analyze", "--force", "--skip-agents-md", "--no-stats"],
  "incremental": ["npx", "-y", "gitnexus@1.6.5", "analyze", "--skip-agents-md", "--no-stats"],
  "status": ["npx", "-y", "gitnexus@1.6.5", "status"],
  "query_probe": ["npx", "-y", "gitnexus@1.6.5", "query", "<probe-token>", "--repo", "<repo-name>"]
}
```

关键点：

- 默认 `bootstrap` 带 `--force`，所以是 full refresh。
- 显式 `--incremental` 才使用不带 `--force` 的 command。
- provider commands 都是 JSON array，不是 shell string。
- bootstrap 对 provider id、package spec、subcommand shape 做 allowlist 校验。
- GitNexus analyze 成功后，会做 host instruction normalizer dry-run，只记录 advisory drift，不写 host instruction 文件。
- `query_ready=true` 必须满足 analyze 成功、status 成功、bounded query proof 返回 process-level evidence。

### 2.5 当前默认 refresh mode

当前脚本默认值：

```text
DEFAULT_REFRESH_MODE_SINGLE_REPO=full
DEFAULT_REFRESH_MODE_ALL_REPOS=full
```

模式语义：

| 模式 | 触发 | 行为 |
| --- | --- | --- |
| full | 默认、`--full`、`--force` | GitNexus `analyze --force --skip-agents-md --no-stats` |
| incremental | 显式 `--incremental` 且通过 preflight | GitNexus `analyze --skip-agents-md --no-stats` |
| incremental fallback | incremental command 失败后 full 成功 | 写 `refresh_mode=incremental-fallback-full` |
| all-repos full | parent workspace 默认或 `--all-repos` | 对每个 child repo 运行 child-scoped full bootstrap |
| all-repos incremental | `--all-repos --incremental` | 不支持，返回 `incremental-all-repos-unsupported` |

### 2.6 spec-first incremental preflight 比 GitNexus 官方更严格

GitNexus 官方会基于 `.gitnexus/` 内部状态决定是否复用 cache 或 selective writeback。

spec-first 不直接信任 provider-local meta。显式 `--incremental` 只有在 prior provider status 可信时才会真正跑 incremental command。

关键条件包括：

- prior status 是 `provider-status.v1`。
- prior status `graph_ready=true && query_ready=true`。
- prior status 是 clean worktree 生成的。
- `last_indexed_commit` 存在、格式合法，并且是当前 HEAD ancestor。
- `bootstrap_fingerprint` 中 spec-first source、provider projection、provider package 未变化。
- `requires_clean_full_refresh != true`。

任一条件不满足，spec-first 会改跑 full，并记录 reason_code，例如：

- `fingerprint-spec-first-changed`
- `fingerprint-projection-changed`
- `fingerprint-provider-changed`
- `clean-full-refresh-required`
- `incremental-base-ref-unset`
- `incremental-base-status-untrusted`
- `incremental-base-ref-not-ancestor`

这是 spec-first 的治理层选择。它牺牲部分性能，换取 readiness provenance 可解释。

### 2.7 dirty worktree 处理

当前 dirty 分类：

| dirty 类型 | 行为 |
| --- | --- |
| setup-owned only | 继续 provider commands，写 setup-owned dirty breakdown |
| non-graph metadata only | 继续 provider commands |
| graph-affecting dirty | warn-and-continue，继续 provider commands，写 `freshness_state=dirty-advisory` |

当前仓库快照就是 graph-affecting dirty：

```text
freshness_state=dirty-advisory
dirty_classification=graph-affecting-blocked
ready_primary_providers=[code-review-graph, gitnexus]
capabilities.query_global_graph=true
capabilities.impact_context=true
```

这表示 provider CLI readiness 成功，但证据绑定的是当前未提交磁盘状态。关键结论仍需要直接读当前源码或跑测试确认。

### 2.8 下游 workflow 不刷新 provider

下游节点只消费 readiness，不刷新 provider：

| Workflow | 行为 |
| --- | --- |
| `$spec-plan` | 读取 graph facts，生成 `Graph / GitNexus Evidence` envelope；stale 时降级或建议 bootstrap |
| `$spec-work` | 读取 plan/work graph evidence，收窄 source reads / test selection；不得运行 analyze/build |
| `$spec-debug` | 可在 hypothesis ledger 记录 graph evidence；root cause 必须由非图谱证据确认 |
| `$spec-code-review` | 使用 GitNexus/CRG 作为 review evidence；不得运行 provider rebuild |
| `$spec-doc-review` | graph-heavy 文档审查可建议 bootstrap；不得刷新 provider |

branch switch、pull、rebase、merge、dirty worktree 变化、provider fingerprint mismatch 都是 stale / bootstrap-required signal，不是自动 rebuild trigger。

### 2.9 live MCP 只是 session-local evidence

如果当前会话加载了 GitNexus MCP，workflow 可以做 bounded live probe。

但 live MCP 成功不允许：

- 回写 `.spec-first/graph/*`。
- 把 compiled `query_ready` 改成 true。
- 修改 `.spec-first/config/graph-providers.json`。
- 替代 canonical graph-bootstrap。

live MCP 只用于当前会话定向，最终结论仍要按 freshness 与 source/test evidence 判断。

## 3. GitNexus 刷新最佳实践

### 3.1 总原则

推荐策略：

```text
显式刷新，不隐式刷新。
默认 full，不默认 incremental。
clean single-repo 才允许 opt-in incremental。
dirty / stale 只作 advisory。
repair preview-first。
下游 workflow 不 rebuild provider。
```

这不是纯性能最优策略，而是 spec-first 当前阶段的治理最优策略。

原因：

- spec-first 的目标不是让图谱随时自动最新，而是让 AI coding 证据可治理、可验证、可复用、可沉淀。
- provider-local up-to-date 不等于 canonical query-ready。
- dirty worktree 下没有稳定 clean source revision，不能把结果伪装成 fresh primary evidence。
- 普通 workflow 隐式运行 provider mutation 会制造长耗时、DB 竞争和证据来源漂移。

### 3.2 日常推荐操作

首次准备或 provider projection 变化：

```text
$spec-mcp-setup
$spec-graph-bootstrap
```

需要 graph-heavy plan/work/debug/review 前：

```text
$spec-graph-bootstrap
```

当前 worktree dirty，但只需要只读定向：

```text
可以使用 dirty-advisory graph evidence。
必须披露 limitation。
关键判断直接读源码 / tests / logs 确认。
```

需要 release / merge / 高风险 review 的 fresh graph evidence：

```text
先让 worktree clean。
再跑 full graph-bootstrap。
确认 freshness_state=fresh。
```

clean single-repo 且已有可信 clean base，需要加速：

```bash
bash skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh --incremental
```

但当前建议仍把它当 opt-in fast path，不作为普通 workflow 自动动作。

### 3.3 何时必须 full refresh

以下情况应使用 full：

- GitNexus package pin 变化。
- `graph-providers.json` projection 变化。
- bootstrap script 或 provider command safety contract 变化。
- prior status 缺失或不可信。
- `requires_clean_full_refresh=true`。
- worktree dirty 且 dirty path 影响图谱。
- parent workspace all-repos。
- provider storage 曾出现 native write/open failure。

full refresh 命令：

```bash
bash skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh --full
```

### 3.4 何时可以 incremental

只建议在这些条件同时满足时使用：

- 单仓。
- worktree clean。
- prior provider status clean query-ready。
- `last_indexed_commit` 是当前 HEAD ancestor。
- provider projection fingerprint 未变化。
- 没有 `requires_clean_full_refresh=true`。
- 本次目标是加速 refresh，不是 provider repair 或版本升级 baseline。

incremental 失败时，应允许 fallback full。不要在普通 workflow 里重试循环，不要自动 clean `.gitnexus/`。

### 3.5 当前仓库的下一步刷新建议

当前 artifacts 显示：

```text
GitNexus query_ready=true
code-review-graph query_ready=true
freshness_state=dirty-advisory
dirty_classification=graph-affecting-blocked
```

建议：

1. 当前继续把 graph evidence 当 dirty-advisory 使用。
2. 不在当前 dirty worktree 下评估 clean incremental 性能。
3. 等当前改动提交、暂存隔离或切到 clean worktree 后，运行一次 full graph-bootstrap。
4. 观察 GitNexus provider status：
   - `worktree_dirty=false`
   - `query_ready=true`
   - `last_indexed_commit=<current HEAD>`
   - `requires_clean_full_refresh=false`
5. 再用一个小改动验证 `--incremental` fast path。

## 4. GitNexus 是否可以直接平替 CRG

### 4.1 短结论

目标上可以，而且建议把它定为目标态：

```text
GitNexus 直接平替 code-review-graph。
CRG 从默认 required provider、默认 bootstrap path、默认 review evidence contract 中删除。
不要把 CRG 设计成长期 fallback 或长期双轨依赖。
```

但当前不能通过“只删除 CRG 配置”完成平替：

```text
当前 GitNexus 上游能力面已经足够成为平替候选。
当前 spec-first 工程 contract 还没有把这些能力编译成 canonical impact/review artifacts。
因此正确动作不是保留 CRG 降级，而是实施 GitNexus-first direct replacement migration。
```

### 4.2 平替必须分层判断

“能不能平替”不能只看上游工具是否有类似命令。必须分六层：

| 层级 | 判断问题 | 当前结论 |
| --- | --- | --- |
| 上游能力 | GitNexus 是否有 CRG 默认用途对应能力 | 基本具备：`query/context/impact/detect-changes/processes/cypher` |
| CLI/MCP 可调用 | 当前环境是否能调用这些能力 | 可调用；本地 `impact` 与 `detect-changes` 已跑出结果 |
| canonical artifacts | spec-first 是否已把 GitNexus impact 编译进 `.spec-first/impact/*` | 尚未 |
| review evidence | `$spec-code-review` 是否能用 GitNexus 作为 primary review-impact provider | 尚未，当前 prose 仍指定 CRG |
| failure/freshness 治理 | GitNexus impact evidence 是否有 reason_code、raw log、freshness、limitations | 尚未形成完整 adapter |
| tests/docs 迁移 | setup/bootstrap/review/docs/tests 是否已解除 CRG 默认假设 | 尚未 |

所以最终判断是：

```text
能力层可以直接平替。
工程层需要迁移后才能直接平替。
迁移目标应是删除 CRG 默认路径，而不是让 CRG 长期作为 fallback。
```

### 4.3 CRG 已有能力与 GitNexus 平替矩阵

| CRG 现有能力 | GitNexus 对应能力 | 平替判断 | spec-first 还缺什么 |
| --- | --- | --- | --- |
| `build` full graph build | `analyze --force` | 可直接替代 | 默认 command 已存在 |
| `update` incremental update | `analyze` 不带 `--force` | 可替代，但语义不同 | 保持 spec-first incremental preflight |
| `status` graph statistics | `status`、resources、`cypher` | 可替代 | 需要 normalized stats/readiness adapter |
| `detect-changes` diff impact | `detect-changes --scope ...` | 最接近直接替代 | 需要固定 output schema 与 raw log contract |
| blast radius / impact radius | `impact <target> --depth --include-tests` | 可替代 | 需要 target resolution、multi-target batching、confidence mapping |
| minimal context | `query`、`context`、process resources | 可替代 | 需要 canonical context envelope |
| review context | `detect-changes` + `impact` + `query/context` | 可替代 | 需要 `$spec-code-review` preflight 改造 |
| related tests / test gaps | `impact --include-tests` + `detect-changes` affected flows | 可能替代 | 需要 fixture 质量验证和 test suggestion schema |
| graph stats | `status` / `schema` / `cypher` | 可替代 | 需要 normalized summary |
| watch / daemon | GitNexus 不是同等默认 watch provider | 非目标 | spec-first 默认不应依赖 watchers/daemons |
| wiki / visualize | GitNexus community/process resources、query | 非默认目标 | 用户手册和默认 workflow 不依赖 |
| live MCP `serve` tools | GitNexus MCP tools/resources | 可替代 | live evidence 仍不能替代 compiled readiness |

关键判断：

- 对 spec-first 默认链路来说，CRG 的 `watch`、`daemon`、`wiki`、`visualize` 不是必须保留的默认能力。
- 真正必须平替的是 `detect-changes`、impact radius、minimal/review context、related tests、risk signal。
- GitNexus 已有对应能力，但 spec-first 需要把这些能力编译成稳定 artifact，而不是让 workflow 临时解释 raw CLI 输出。

### 4.4 当前为什么不能只删 CRG

当前 CRG 仍承担 canonical impact contract。

`skills/spec-mcp-setup/mcp-tools.json` 当前定义：

| Provider | role | required | access |
| --- | --- | --- | --- |
| GitNexus | `global_knowledge` | true | live MCP + CLI bootstrap |
| code-review-graph | `impact_context` | true | CLI artifact，live MCP optional |

`skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh` 当前写：

```text
capabilities.query_global_graph = GitNexus query_ready
capabilities.impact_context = code-review-graph query_ready
```

当前 `.spec-first/impact/bootstrap-impact-capabilities.json` 写：

```text
context_selection.primary_providers = [code-review-graph, gitnexus]
impact_radius.primary_providers = [code-review-graph]
review_support.primary_providers = [code-review-graph]
```

`skills/spec-code-review/SKILL.md` 当前语义仍是：

```text
Code-review-graph is the review/diff-impact provider for this workflow.
GitNexus native routing may provide global orientation, route/API/shape, symbol, Cypher, or tool-surface supporting evidence,
but it does not replace code-review-graph's review-impact role.
```

`src/cli/helpers/review-pre-facts.js` 当前还会在 readiness target 是 CRG 时输出：

```text
tool_name = code-review-graph.query
```

因此当前“直接删除 CRG”的实际结果不是 GitNexus 平替，而是：

- `impact_context` 变 false 或只剩 heuristic fallback。
- `impact_radius` / `review_support` 没有 canonical primary provider。
- `$spec-code-review` 的 review-impact contract 断裂。
- setup/bootstrap/review/docs/tests 大量旧假设失效。

这不是目标态平替，只是删除依赖造成能力断层。

### 4.5 直接平替的验收门槛

要宣称 GitNexus 已直接平替 CRG，至少需要满足：

```text
.spec-first/impact/bootstrap-impact-capabilities.json:
  impact_radius.primary_providers = ["gitnexus"]
  review_support.primary_providers = ["gitnexus"]
  context_selection.primary_providers includes gitnexus, and no longer requires CRG

.spec-first/graph/graph-facts.json:
  capabilities.query_global_graph derives from GitNexus query proof
  capabilities.impact_context derives from GitNexus impact/detect-changes proof

skills/spec-code-review/SKILL.md:
  GitNexus is the primary review/diff-impact provider
  CRG is not required and not named as the default impact provider

src/cli/helpers/review-pre-facts.js:
  default query/preflight plan emits GitNexus impact/detect-changes surfaces
  no default `code-review-graph.query` assumption

skills/spec-mcp-setup/mcp-tools.json:
  CRG is removed from required baseline and default provider projection
  GitNexus role covers global_knowledge + impact_context or a new combined role

tests/docs:
  setup projection tests, graph-bootstrap tests, code-review contracts, user manual contracts, README contracts all pass
```

质量门槛：

- GitNexus `detect-changes` 能稳定输出 changed symbols / affected flows。
- GitNexus `impact --include-tests` 能给出足够 review 使用的 blast radius 和 test hints。
- normalized adapter 有 raw log、exit code、reason_code、freshness、limitations。
- `$spec-code-review` 的 findings 仍必须由 diff/source/test/contract evidence 确认，不能只凭 graph output 出 finding。
- live MCP 成功仍只能作为 session-local evidence，不能替代 compiled readiness。

### 4.6 推荐迁移路径：Direct Replacement，不是 Fallback

#### Phase 1：GitNexus compiled impact adapter

目标：

```text
GitNexus query_ready=true
GitNexus impact_ready=true
GitNexus detect_changes_ready=true
```

最小实现：

- graph-bootstrap 在 GitNexus provider 成功后运行 bounded `impact` proof。
- graph-bootstrap 在有 diff 时运行 bounded `detect-changes` proof，或在无 diff 时记录 not-applicable reason。
- 写 `.spec-first/providers/gitnexus/normalized/impact-capabilities.json`。
- 把 raw output、exit code、reason_code、limitations 写入 provider status。
- 不让 live MCP 结果回写 compiled readiness。

这一阶段 CRG 可以短暂保留用于 parity measurement，但不是目标架构的一部分。

#### Phase 2：CRG parity measurement

目标不是设计长期双轨，而是证明删除 CRG 不会破坏默认 workflow。

对比维度：

| 维度 | GitNexus 需要证明什么 |
| --- | --- |
| changed symbol 定位 | 能覆盖当前 diff 的核心函数/类/文件 |
| affected flow | 能返回 caller/process/flow 级影响 |
| related tests | 能给出 tests 或明确说明不可得 |
| risk signal | 能支撑 review prioritization，但不替代 reviewer 判断 |
| output schema | raw output 可被 deterministic adapter 转成 stable envelope |
| failure mode | 失败有 reason_code、raw log、recommended_action |

这一步可以用真实仓库 diff、fixture repo、当前 spec-first dirty worktree 做多样本验证。

#### Phase 3：切换 canonical provider 到 GitNexus

完成 adapter 和 parity 后，切换默认 contract：

- `graph-facts.capabilities.impact_context` 改由 GitNexus impact/detect-changes proof 计算。
- `.spec-first/impact/bootstrap-impact-capabilities.json` 的 `impact_radius.primary_providers` 改为 `["gitnexus"]`。
- `review_support.primary_providers` 改为 `["gitnexus"]`。
- `$spec-code-review` 改为 GitNexus-first review-impact preflight。
- `review-pre-facts` 默认计划改发 GitNexus surfaces。
- setup baseline 不再要求 CRG。

CRG 在这一阶段最多作为迁移验证开关存在，不进入默认 readiness。

#### Phase 4：删除 CRG 默认路径

最终删除：

- CRG package pin。
- CRG provider registry entry 的默认 required 路径。
- CRG graph-bootstrap default commands。
- CRG normalized impact artifact default contract。
- README / 用户手册 / code-review prose 中的默认 CRG 角色。
- 固化 CRG requiredness 的 tests。

保留：

- 历史迁移说明。
- 如果用户自带 CRG，可作为 external optional provider 文档化，但不作为默认 fallback。

### 4.7 推荐决策

推荐决策是：

```text
把 GitNexus 直接平替 CRG 定为目标态。
不要把 CRG 设计成长期降级路径。
不要当前只删 CRG 配置。
先补 GitNexus compiled impact adapter 和 review preflight contract。
达到验收门槛后删除 CRG 默认 required/provider path。
```

这比“CRG optional fallback”更符合当前目标，因为：

- 用户心智最终只需要一个 graph provider。
- setup/bootstrap 成本会下降。
- `global_knowledge` 与 `impact_context` 的 provider 分裂会消失。
- source/runtime/provider 边界仍可通过 GitNexus adapter 保持清晰。
- 删除发生在 contract 和 tests 已迁移之后，而不是靠临时降级掩盖能力断层。

## 5. 最小落地顺序

如果后续推进 GitNexus 直接平替 CRG，建议按这个顺序实施：

1. 写 migration plan
   - 目标：GitNexus 承担 primary graph + impact provider。
   - 非目标：普通 workflow 自动运行 provider mutation、引入 watcher/daemon、让 graph output 直接成为 finding。

2. 新增 GitNexus impact adapter
   - 在 graph-bootstrap 中新增 deterministic `impact` / `detect-changes` proof。
   - 写 normalized impact artifact。
   - 增加 raw log / exit code / reason_code / limitations。

3. 更新 impact capability contract
   - 允许 GitNexus 成为 `impact_radius.primary_providers[]` 和 `review_support.primary_providers[]`。
   - `capabilities.impact_context` 改为 GitNexus impact proof。
   - 明确 live MCP 与 compiled readiness 分离。

4. 改造 `$spec-code-review`
   - GitNexus-first impact preflight。
   - Coverage 一次性披露 graph limitation。
   - findings 仍由 source/diff/test/contract 证据确认。

5. 做 parity measurement
   - 用 fixture 和真实 diff 比较 GitNexus 与 CRG。
   - 目标是删除 CRG 的风险可控，不是长期双轨运行。

6. 切换默认 provider
   - setup baseline 不再要求 CRG。
   - graph-bootstrap 默认只需要 GitNexus 满足 query + impact readiness。
   - `.spec-first/impact/*` 以 GitNexus 为 primary。

7. 删除 CRG 默认路径
   - 删除默认 install/projection/bootstrap。
   - 更新 README、用户手册、contracts、tests、changelog。
   - 如需保留 CRG，只作为用户显式选择的 external optional provider，不作为默认 fallback。

## 6. 多轮审查记录

### Round 1：事实与可追溯性审查

审查问题：

- 文档是否区分官方 GitNexus 刷新、spec-first canonical refresh 和 downstream consumption。
- 是否把 `status/query/impact/detect-changes` 误写成刷新入口。
- 是否准确描述当前 artifacts 和 source contract 对 CRG 的绑定。
- 是否避免把 dirty-advisory graph evidence 当成 fresh truth。

结论：

- 通过。文档保留 `analyze` / `--force` / no-force incremental 的边界。
- 通过。当前 `graph-facts` 与 `bootstrap-impact-capabilities` 的 CRG 绑定已明确列出。
- 修正。旧稿“先 CRG optional fallback 再考虑删除”的目标被改为“GitNexus 直接平替，CRG 从默认路径删除”。

### Round 2：产品目标与架构边界审查

审查问题：

- 是否响应“直接平替 CRG，不是降级”的目标。
- 是否把当前不能只删 CRG 的工程事实误解成“不应该平替”。
- 是否仍符合 `Light contract + Explicit boundaries + Scripts prepare, LLM decides`。
- 是否给出可执行验收门槛，而不是泛泛建议。

结论：

- 通过。目标态明确为 GitNexus direct replacement。
- 通过。文档把“能力层可平替”和“工程层需迁移”分开。
- 通过。迁移要求 deterministic adapter 产出 canonical artifacts，不让 live MCP 或 LLM 临时判断替代 readiness。
- 通过。验收门槛覆盖 artifacts、skills、setup registry、review preflight、tests/docs。

## 7. 最终心智模型

```text
GitNexus 官方：
  analyze 是默认刷新入口。
  analyze --force 是 full refresh。
  不带 --force 才可能用官方增量。
  status/query/context/impact/detect-changes 是读取或分析，不是刷新。

spec-first 当前：
  init 不刷新。
  mcp-setup 不刷新 graph，只刷新 setup projection。
  graph-bootstrap 是唯一默认 canonical refresh。
  默认 full，incremental 是 clean single-repo opt-in。
  downstream workflow 只消费 readiness，不 rebuild provider。

Provider 平替：
  GitNexus 已具备平替 CRG 默认用途的上游能力面。
  当前 spec-first 还没有把 GitNexus impact/detect-changes 编译成 canonical impact/review readiness。
  目标态应是 GitNexus 直接平替 CRG，删除 CRG 默认路径。
  正确迁移顺序是 adapter -> contract -> review preflight -> parity -> switch -> delete。
```
