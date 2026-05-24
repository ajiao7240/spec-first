# GitNexus 刷新策略与 Provider 收敛决策

本文回答四个问题：

1. GitNexus 官方支持哪些刷新方式，默认推荐哪种方式。
2. 当前 `spec-first` 如何刷新 GitNexus 产物，哪些节点会刷新。
3. 结合项目全景与目标，当前 GitNexus 刷新最佳实践是什么。
4. 是否可以只保留 GitNexus，删除 `code-review-graph`。

结论先行：

```text
GitNexus 官方默认：
  npx gitnexus analyze
  -> 不带 --force，由 GitNexus 自己判断 already-up-to-date / 增量写回 / full rebuild。

spec-first 当前默认：
  $spec-graph-bootstrap
  -> npx -y gitnexus@1.6.5 analyze --force --skip-agents-md --no-stats
  -> status + bounded query proof
  -> 写 canonical .spec-first/graph/* / providers/* / impact/* readiness artifacts。

最佳实践：
  保持显式 graph-bootstrap refresh。
  默认 full 作为 correctness-first baseline。
  clean single-repo incremental 只作为经过验证的 opt-in fast path。
  dirty / stale evidence 可做只读定向，不能当 fresh primary evidence。

是否删除 code-review-graph：
  不建议当前直接删除。
  当前 GitNexus 已覆盖大量全局代码理解与 impact 能力，但 spec-first 的 canonical impact/readiness contract
  仍把 impact_radius 与 review_support 绑定到 code-review-graph。
  推荐先做 GitNexus impact adapter 与双轨对比，再把 code-review-graph 降级为 optional fallback，
  最后再考虑删除。
```

## 分析范围

本文基于当前仓库 source-of-truth 与本地可执行事实：

| 领域 | 证据 |
| --- | --- |
| GitNexus 官方 CLI | `npx -y gitnexus@1.6.5 --help`, `analyze --help`, `status --help`, `query --help`, npm README |
| spec-first provider projection | `skills/spec-mcp-setup/mcp-tools.json`, `skills/spec-mcp-setup/scripts/write-provider-config.sh` |
| spec-first refresh implementation | `skills/spec-graph-bootstrap/SKILL.md`, `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh` |
| downstream consumer | `skills/spec-plan/SKILL.md`, `skills/spec-work/SKILL.md`, `skills/spec-code-review/SKILL.md`, `skills/spec-debug/SKILL.md` |
| graph evidence contracts | `docs/contracts/graph-evidence-policy.md`, `docs/contracts/graph-provider-consumption.md`, `docs/contracts/downstream-graph-evidence-consumption.md` |
| 当前 artifacts | `.spec-first/graph/graph-facts.json`, `.spec-first/graph/provider-status.json`, `.spec-first/impact/bootstrap-impact-capabilities.json` |

本文不修改运行时行为，不改变 provider 配置，也不删除任何 provider。它是刷新策略与 provider 收敛的分析和建议文档。

## 1. 官方 GitNexus 支持的刷新方式

### 1.1 `gitnexus analyze` 是官方默认刷新入口

GitNexus 官方 README 与 CLI help 都把 `analyze [path]` 定义为索引入口：

```bash
npx gitnexus analyze
```

官方语义是：

- 首次运行时创建 `.gitnexus/` 本地索引。
- 后续运行时更新 stale index。
- 不带 `--force` 时，GitNexus 自己决定是否 already up to date、是否可走内部增量写回、或是否需要 full rebuild。

这也是官方默认刷新方式。它不是 spec-first 当前默认方式，因为 spec-first 额外追求 canonical readiness、query proof、source/runtime 边界和可降级 artifact contract。

### 1.2 `gitnexus analyze --force` 是强制 full re-index

官方 `analyze --help` 明确定义：

```bash
npx gitnexus analyze --force
```

语义是强制 full re-index。它会绕过 GitNexus 自己的 already-up-to-date / incremental decision path。

适合场景：

- provider 版本刚升级。
- 本地索引怀疑损坏。
- schema 或 graph semantics 可能变化。
- 需要一个 correctness-first baseline。

不适合场景：

- 高频、小改动、clean worktree 的日常快速刷新。
- 多仓批量刷新时追求最低耗时。

### 1.3 不带 `--force` 的 `analyze` 才可能利用官方增量

`gitnexus@1.6.5` 没有独立的 `gitnexus incremental` 子命令。官方增量路径隐藏在普通 `analyze` 内部。

关键点：

- GitNexus 仍会运行完整 analysis pipeline。
- 它会复用 parse / embedding cache。
- 它会基于 file hash 判断 changed / added / deleted files。
- 满足条件时，只选择性改写 DB 中受影响 file rows。
- `Community` / `Process` 这类全局图谱结果仍会重新计算。

因此官方增量不是“只解析一个文件”，而是“full pipeline + cache reuse + selective DB writeback”。这个设计优先保证跨文件关系正确性。

### 1.4 `status`、`query`、`context`、`impact`、`detect-changes` 不是刷新入口

这些命令是读取或分析入口：

```bash
npx gitnexus status
npx gitnexus query <q>
npx gitnexus context <symbol>
npx gitnexus impact <symbol-or-file>
npx gitnexus detect-changes
```

它们可以证明或使用索引，但不应被当作刷新动作。`status` 只说明 provider-local index 状态，不等于 spec-first canonical readiness。

### 1.5 `clean` / `remove` 是显式 repair，不是普通刷新

官方支持：

```bash
npx gitnexus clean
npx gitnexus remove <target>
```

这类命令会删除 provider index state。它们是显式恢复动作，不能被普通 plan/work/review/debug 自动调用。

在 spec-first 语义里，删除 `.gitnexus/` 或 provider raw artifacts 必须 preview-first，并 tied to reason_code / raw log / recommended_action。

### 1.6 `index` 是注册已有 `.gitnexus/`，不是重建索引

GitNexus 还支持：

```bash
npx gitnexus index
```

该命令用于把已有 `.gitnexus/` 注册到 global registry。它不做 re-analysis，不能替代 `analyze` 或 `$spec-graph-bootstrap`。

## 2. 当前 spec-first 如何执行刷新

### 2.1 总生命周期

当前链路是：

```text
spec-first init
  -> 生成 host instruction / runtime mirror / .gitignore managed block
  -> 不运行 GitNexus analyze

$spec-mcp-setup
  -> 验证 GitNexus package 与 MCP config
  -> 写 .spec-first/config/graph-providers.json
  -> 写 .spec-first/config/runtime-capabilities.json
  -> 写 .spec-first/config/provider-artifacts.json
  -> 不运行 GitNexus analyze/status/query

$spec-graph-bootstrap
  -> 读取 setup-owned config
  -> 校验 provider command arrays
  -> 运行 GitNexus analyze/status/query proof
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

### 2.3 `$spec-mcp-setup` 不刷新图谱，只刷新 setup projection

`$spec-mcp-setup` 负责 required harness runtime 与 provider projection。

它会：

- 预热或验证 `gitnexus@1.6.5`。
- 写 Claude/Codex host MCP 配置。
- 生成 `.spec-first/config/graph-providers.json`。
- 生成 `.spec-first/config/runtime-capabilities.json`。
- 生成 `.spec-first/config/provider-artifacts.json`。

它不运行：

- GitNexus analyze/status/query。
- code-review-graph build/status/query。
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
- 显式 `--incremental` 才会使用不带 `--force` 的 command。
- 所有 provider commands 都是 JSON array，不是 shell string。
- bootstrap 对 provider id、package spec、subcommand shape 做 allowlist 校验。
- GitNexus analyze 成功后，会做 host instruction normalizer dry-run，只记录 advisory drift，不写 host instruction 文件。
- `query_ready=true` 必须满足 analyze 成功、status 成功、bounded query proof 返回 process-level evidence。

### 2.5 默认 refresh mode

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

GitNexus 官方会基于 `.gitnexus/meta.json` 和内部状态决定是否增量。

spec-first 不直接信任 provider-local meta。显式 `--incremental` 只有在 prior provider status 可信时才会真正跑 incremental command。

关键条件包括：

- prior status 是 `provider-status.v1`。
- prior status `graph_ready=true && query_ready=true`。
- prior status 是 clean worktree 生成的。
- `last_indexed_commit` 存在、格式合法，并且是当前 HEAD ancestor。
- `bootstrap_fingerprint` 中 spec-first source、provider projection、provider package 未变化。
- `requires_clean_full_refresh != true`。

任一条件不满足，spec-first 会降级 full，并记录 reason_code，例如：

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

graph-affecting dirty 不再硬阻塞 bootstrap，但生成的 graph facts 不能当 fresh primary evidence。

当前仓库快照就是这种状态：

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

## 3. GitNexus 刷新最佳实践推荐

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

### 3.5 当前仓库的下一步建议

当前 artifacts 显示：

```text
GitNexus query_ready=true
code-review-graph query_ready=true
freshness_state=dirty-advisory
GitNexus requires_clean_full_refresh=true
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

## 4. 是否可以只保留 GitNexus，删除 code-review-graph

### 4.1 短结论

不建议当前直接删除 `code-review-graph`。

更准确的结论是：

```text
产品方向上，可以把 GitNexus 提升为唯一长期图谱 provider 候选。
工程落地上，当前不能直接删除 code-review-graph。
需要先把 GitNexus impact / review evidence 编译成 canonical impact artifacts，
再把 code-review-graph 降级为 optional fallback，
最后经过一个迁移窗口后再删除。
```

### 4.2 为什么不能直接删

当前 `code-review-graph` 不只是历史依赖。它仍承担 canonical impact contract。

#### 1. provider role 仍是 source truth

`skills/spec-mcp-setup/mcp-tools.json` 当前定义：

| Provider | role | required | access |
| --- | --- | --- | --- |
| GitNexus | `global_knowledge` | true | live MCP + CLI bootstrap |
| code-review-graph | `impact_context` | true | CLI artifact，live MCP optional |

setup projection 也明确写：

```text
global_knowledge: gitnexus
impact_context: code-review-graph
context_selection: code-review-graph
```

直接删除 CRG 会改变 provider role contract。

#### 2. `graph-facts.capabilities.impact_context` 现在硬绑定 CRG

当前 `bootstrap-providers.sh` 写 `graph-facts.v1` 时：

```text
capabilities.query_global_graph = GitNexus query_ready
capabilities.impact_context = code-review-graph query_ready
```

如果删 CRG，但不新增 GitNexus impact adapter，那么 `impact_context` 会变成 false，或者只能靠 fallback。下游 graph-heavy review 的 impact evidence 会退化。

#### 3. `bootstrap-impact-capabilities` 的 impact/review primary provider 仍是 CRG

当前 `.spec-first/impact/bootstrap-impact-capabilities.json`：

```text
context_selection.primary_providers = [code-review-graph, gitnexus]
impact_radius.primary_providers = [code-review-graph]
review_support.primary_providers = [code-review-graph]
```

也就是说，GitNexus 已经进入 context selection，但还没有成为 canonical impact_radius / review_support provider。

#### 4. `$spec-code-review` 当前明确把 CRG 定位为 review/diff-impact provider

`skills/spec-code-review/SKILL.md` 当前语义：

```text
Code-review-graph is the review/diff-impact provider for this workflow.
GitNexus native routing may provide global orientation, route/API/shape, symbol, Cypher, or tool-surface supporting evidence,
but it does not replace code-review-graph's review-impact role.
```

这意味着直接删除 CRG 会让 code review workflow 的 evidence contract 发生实质变化。

#### 5. review pre-facts 与测试中仍有 CRG 语义

`src/cli/helpers/review-pre-facts.js` 仍把 CRG 作为 query plan / review evidence 的一部分。

测试与文档也固化了这些边界：

- `tests/unit/spec-graph-bootstrap.sh`
- `tests/unit/spec-code-review-contracts.test.js`
- `tests/unit/user-manual-contracts.test.js`
- `tests/unit/gitignore-policy.test.js`

直接删除 CRG 不是删一个 package entry，而是一次跨 setup、bootstrap、impact contract、review workflow、docs、tests 的迁移。

### 4.3 只保留 GitNexus 的收益

长期收敛到 GitNexus-only 有真实收益：

| 收益 | 说明 |
| --- | --- |
| 降低安装复杂度 | 移除 Python / `uvx` provider 路径，减少 package index 和 cache 问题 |
| 降低 refresh 成本 | 少跑一个 provider，减少 graph-bootstrap 时间和 raw artifacts |
| 收敛用户心智 | 一个 graph provider，source/runtime 边界更简单 |
| 强化 GitNexus-first 差异化 | GitNexus 已覆盖 query/context/impact/detect_changes/group 等全局能力 |
| 降低 contract 分叉 | 少一套 provider status、normalized artifacts、failure modes |

这些收益值得进入中长期演进方向。

### 4.4 直接删除的风险

| 风险 | 影响 |
| --- | --- |
| impact readiness 退化 | `impact_radius` 与 `review_support` 没有 canonical primary provider |
| code review 质量下降 | changed-symbol impact、related tests、review context 缺少当前稳定 provider |
| contract tests 大面积失效 | 需要同步改 setup、bootstrap、docs、tests |
| GitNexus live MCP 与 compiled readiness 混淆 | 若直接用 live MCP 替代 CRG artifact，会破坏 session-local / canonical 边界 |
| downstream consumers 模糊 | plan/work/debug/review 会混用 GitNexus global knowledge 与 review-impact 角色 |
| fallback 变弱 | CRG 当前是 GitNexus query degraded 时的局部 impact fallback之一 |

### 4.5 删除前必须先补的能力

要删除 CRG，至少需要先完成这些工程条件：

1. GitNexus impact canonical proof
   - graph-bootstrap 不能只证明 `query` process results。
   - 还需要证明 GitNexus impact / detect_changes 或等价 native capability 可用于 current repo。

2. GitNexus impact adapter
   - 写 `.spec-first/providers/gitnexus/normalized/impact-capabilities.json` 或扩展现有 normalized artifacts。
   - 把 GitNexus impact readiness 编译进 `.spec-first/impact/bootstrap-impact-capabilities.json`。

3. `graph-facts.v1` capability 映射调整
   - `capabilities.impact_context` 不能再硬绑定 CRG。
   - 可以改为 GitNexus impact proof 或 fallback support。

4. `$spec-code-review` evidence preflight 改造
   - GitNexus-first impact evidence。
   - CRG 作为 optional fallback。
   - Coverage 明确 provider、freshness、limitations。

5. review-pre-facts 解除 CRG 假设
   - 不能默认输出 `code-review-graph.query`。
   - 需要支持 GitNexus impact / detect_changes 的 query plan。

6. setup registry 迁移
   - CRG 从 `required=true` 改为 optional 或移出默认 registry。
   - `baseline_ready` 不能再依赖 CRG。

7. tests 与用户文档迁移
   - 更新 graph-bootstrap shell tests。
   - 更新 setup projection tests。
   - 更新 code-review contracts。
   - 更新 README / 用户手册 / changelog。

### 4.6 推荐迁移路径

#### Phase 0：保持现状，记录决策

当前阶段：

- GitNexus 继续是 `global_knowledge`。
- CRG 继续是 `impact_context`。
- 默认 graph-bootstrap 继续跑两个 provider。
- 文档明确“不能直接删除 CRG”。

#### Phase 1：GitNexus impact adapter

新增 GitNexus impact readiness 编译，不改变 CRG 默认角色。

目标：

```text
GitNexus query_ready=true
GitNexus impact_ready=true
impact_capabilities.impact_radius.primary_providers includes gitnexus
review_support can cite gitnexus as supporting provider
```

注意：这一步仍不能把 live MCP 成功写回 compiled readiness。必须由 bootstrap 脚本用 deterministic CLI / raw log / normalized envelope 产出。

#### Phase 2：双轨对比

在若干真实 review 或 fixture 中对比：

| 维度 | GitNexus | code-review-graph |
| --- | --- | --- |
| changed symbol 定位 | 是否稳定 |
| impacted caller / flow | 是否覆盖 |
| related tests | 是否可得 |
| false positive | 是否可控 |
| raw output 可控性 | 是否可 schema 化 |
| runtime failure mode | 是否更简单 |

这一步的目标不是证明 GitNexus 永远更强，而是证明 GitNexus 足以承担 spec-first 默认 impact contract。

#### Phase 3：CRG 降级为 optional fallback

当 GitNexus impact adapter 稳定后：

- `mcp-tools.json` 中 CRG 改为 optional provider。
- setup 不再把 CRG 计入 required baseline。
- graph-bootstrap 默认可只跑 GitNexus，或通过 explicit flag 启用 CRG。
- `.spec-first/impact/*` 把 GitNexus 作为 primary provider。
- CRG failure 不再让 graph readiness degraded。

#### Phase 4：移除 CRG 默认路径

在一个发布周期后，如果没有关键能力回退：

- 删除 CRG 默认 package pin。
- 删除 CRG provider projection。
- 删除 CRG normalized artifact contract。
- 清理 README / 用户手册 / tests。
- 保留历史文档说明迁移原因。

### 4.7 迁移决策门槛

只有满足以下条件，才建议真正删除 CRG：

```text
GitNexus 能提供 compiled impact readiness，不只是 session-local MCP evidence。
GitNexus impact/detect_changes 能覆盖 code-review 的 changed-symbol / blast-radius / related-test 主要场景。
$spec-code-review Coverage 能稳定披露 GitNexus impact evidence 与 limitations。
.spec-first/impact/bootstrap-impact-capabilities.json 不再依赖 CRG 才能 support impact_radius。
setup baseline 不再要求 CRG。
graph-bootstrap tests、code-review tests、README/user manual contracts 全部通过。
至少一个真实 review 流程验证 GitNexus-only 没有明显质量倒退。
```

### 4.8 推荐决策

当前推荐：

```text
不要立即删除 code-review-graph。
把“只保留 GitNexus”作为中期收敛目标。
先做 GitNexus impact adapter + 双轨对比。
再把 CRG 从 required provider 降级为 optional fallback。
最后再删除默认 CRG 路径。
```

这符合 80/20：

- 先得到最大收益：减少 provider 心智负担，明确 GitNexus-first 方向。
- 保住现有质量：不破坏 review impact readiness。
- 避免过度设计：不引入新状态机，只调整 provider evidence contract。
- 保持 source-first：先改 source contracts 和 tests，再生成 runtime/projection。

## 5. 最小落地顺序

如果后续要推进 GitNexus-only，建议按这个顺序计划：

1. 写计划
   - 明确目标：GitNexus 承担 primary graph + impact provider。
   - 非目标：不让普通 workflow 自动运行 provider mutation。

2. 增加 GitNexus impact adapter
   - 在 graph-bootstrap 中新增 deterministic impact proof。
   - 写 normalized impact artifact。
   - 不改变 CRG 默认状态。

3. 更新 impact capability contract
   - 允许 GitNexus 成为 `impact_radius.primary_providers[]`。
   - 明确 live MCP 与 compiled readiness 分离。

4. 改造 `$spec-code-review`
   - GitNexus-first impact preflight。
   - CRG fallback。
   - Coverage 一次性披露 graph limitation。

5. 做双轨 benchmark / fixture
   - 比较 GitNexus-only 与 CRG 对同一 diff 的 evidence quality。

6. 降级 CRG requiredness
   - `required=false` 或 explicit optional provider。
   - setup / graph-bootstrap / tests 同步。

7. 清理默认 CRG
   - 删除默认 install/projection/bootstrap。
   - 更新 README、用户手册、contracts、tests、changelog。

## 6. 最终心智模型

```text
GitNexus 官方：
  analyze 是默认刷新入口。
  analyze --force 是 full refresh。
  不带 --force 才可能用官方增量。
  status/query/context/impact/detect_changes 是读取或分析，不是刷新。

spec-first 当前：
  init 不刷新。
  mcp-setup 不刷新 graph，只刷新 setup projection。
  graph-bootstrap 是唯一默认 canonical refresh。
  默认 full，incremental 是 clean single-repo opt-in。
  downstream workflow 只消费 readiness，不 rebuild provider。

Provider 收敛：
  GitNexus 是长期主 provider 方向。
  code-review-graph 当前仍承担 canonical impact/review contract。
  直接删除会破坏 impact_context 和 code-review evidence。
  推荐先 GitNexus impact adapter，再 CRG optional fallback，最后删除。
```
