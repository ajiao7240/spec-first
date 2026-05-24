# GitNexus 增量刷新机制与 spec-first 刷新策略评估

本文回答三个问题：

1. `gitnexus@1.6.5` 官方项目在代码增量更新后如何刷新图谱。
2. 当前 `spec-first` 项目如何刷新 GitNexus 图谱。
3. 当前策略是否需要优化，以及是否符合最佳实践。

结论先行：

```text
GitNexus 官方默认路径：
  gitnexus analyze
  -> 若 HEAD 与 meta.lastCommit 相同且 worktree clean，直接 already up to date
  -> 否则运行全量 analysis pipeline
  -> 若满足增量条件，则只选择性改写 DB 中受影响 file rows
  -> 成功后更新 .gitnexus/meta.json 的 lastCommit / fileHashes / schemaVersion

spec-first 当前默认路径：
  $spec-mcp-setup       只生成 provider command projection，不运行 analyze
  $spec-graph-bootstrap 默认 full refresh
  -> npx -y gitnexus@1.6.5 analyze --force --skip-agents-md --no-stats
  -> status + query proof
  -> 写 .spec-first/providers/gitnexus/status.json 与 .spec-first/graph/*

最佳实践判断：
  治理边界基本正确：显式刷新、canonical readiness、dirty-advisory、下游不静默 rebuild。
  性能策略仍可优化：默认 --force 绕过 GitNexus 官方增量，适合 correctness-first，不是最快路径。
  推荐下一步：把 clean single-repo incremental 从 diagnostic mode 提升为经过验证的 opt-in fast path，而不是让普通 plan/work/review 自动刷新。
```

## 分析范围

本文基于当前本地仓库与 `gitnexus@1.6.5` npm 包源码核对。

已核对的 upstream 事实：

| 事实 | 当前值 |
| --- | --- |
| npm package | `gitnexus@1.6.5` |
| npm `latest` dist-tag | `1.6.5` |
| npm `rc` dist-tag | `1.6.6-rc.48` |
| repository | `https://github.com/abhigyanpatwari/GitNexus.git` |
| repository directory | `gitnexus` |
| 关键官方文件 | `dist/cli/index.js`, `dist/cli/analyze.js`, `dist/core/run-analyze.js`, `dist/cli/status.js`, `dist/core/git-staleness.js`, `skills/gitnexus-cli.md` |

本文不覆盖：

- GitNexus 每种语言 parser 的完整实现。
- GitNexus query ranking、embedding、community/process 生成质量评估。
- code-review-graph 的增量算法。它的流程见 [code-review-graph 全流程执行分析](./15-code-review-graph-全流程执行分析.md)。
- 直接替换当前 spec-first graph-bootstrap contract 的实施方案。

## 官方 GitNexus 的刷新模型

### CLI 入口

`gitnexus analyze [path]` 是官方刷新入口。`--force` 的语义是强制 full re-index。

关键路径：

| 阶段 | 官方文件 | 行为 |
| --- | --- | --- |
| CLI 定义 | `dist/cli/index.js` | 定义 `analyze [path]`，`--force` 表示强制全量重建 |
| option 传递 | `dist/cli/analyze.js` | 把 `options.force || options.skills` 传给 `runFullAnalysis` |
| 实际刷新 | `dist/core/run-analyze.js` | 决定 already-up-to-date、full pipeline、incremental writeback、meta 保存 |

因此，官方增量能力不是一个单独的 `gitnexus incremental` 子命令，而是普通 `gitnexus analyze` 在未传 `--force` 时的内部路径。

### already-up-to-date 快路径

官方 `runFullAnalysis` 会先读取 `.gitnexus/meta.json`。

如果满足以下条件，会直接返回 `alreadyUpToDate`：

- 已存在 meta。
- 未传 `--force`。
- `existingMeta.lastCommit === currentCommit`。
- 当前 repo 是 Git repo。
- worktree clean。

官方 dirty 检查会排除 GitNexus 自己写入的路径，例如 `.gitnexus/`、`.claude/`、`.cursor/`、`AGENTS.md`、`CLAUDE.md`，避免上一轮 analyze 写出的文件反复打破快路径。

重要边界：官方 `gitnexus status` 只比较 current commit 与 `meta.lastCommit`，不检查 dirty worktree。也就是说，`status` 显示 up-to-date 不等于“clean source revision 的 primary evidence”。

### 增量不是局部 parse

`gitnexus@1.6.5` 的增量刷新不是“只解析改动文件”。

官方逻辑仍会：

1. 加载 parse cache。
2. 运行 full analysis pipeline。
3. 从 pipeline 的 `File` nodes 计算所有文件 content hash。
4. 用新的 hash map 与 `existingMeta.fileHashes` 做 diff。
5. 在 DB 写入阶段决定走 selective writeback 还是 full rebuild。

这意味着官方增量的主要优化点是：

- parse cache 复用未变内容的解析结果。
- embedding cache 复用已有 embedding。
- LadybugDB 写回时保留未受影响 file rows。

它不是跳过全仓语义图构建。这个设计更偏 correctness-first：全量 pipeline 可以重新计算跨文件 resolution、community、process 等全局结果，避免局部 parse 造成图谱不一致。

### 官方增量触发条件

官方增量写回条件在 full pipeline 之后判断。必须同时满足：

- 未传 `--force`。
- 已存在 meta。
- `existingMeta.schemaVersion === INCREMENTAL_SCHEMA_VERSION`。
- `existingMeta.fileHashes` 存在且非空。
- 当前 repo 有 Git。
- 本轮 pipeline 产出了 `File` nodes。

满足后，GitNexus 会 diff 新旧 file hashes，得到：

- `changed`
- `added`
- `deleted`
- `toWrite`

然后进入增量 DB writeback。

### 官方增量写回逻辑

官方增量写回不是简单地“删 changed 文件再写 changed 文件”。它会扩大 writable set：

1. 以 changed / added / deleted 文件作为初始集合。
2. 对 changed/deleted 文件查旧 DB 的 importers，并做有界 BFS 扩展。
3. 对 added 文件计算 shadow candidates，处理新增文件抢占旧 module resolution 的情况。
4. 从新图谱中计算 effective write set，覆盖跨 writable boundary 的边。
5. 删除 effective write set 与 deleted 文件对应的旧 file rows。
6. 删除 graph-wide `Community` / `Process`。
7. 从 full pipeline 结果中抽取 changed subgraph 写回 DB。
8. 重新创建 FTS indexes，恢复或生成 embeddings。
9. 成功后写回 `.gitnexus/meta.json`，清除 `incrementalInProgress`。

这个模型的含义：

- 增量路径追求“尽量少写 DB”，不是“尽量少分析代码”。
- `Community` / `Process` 仍被整体重算并重新写入。
- importer BFS 与 effective write set 是官方为跨文件正确性做的保护。
- 如果上次增量中途失败，`incrementalInProgress` dirty flag 会让下一次强制 full rebuild。

### 官方 full rebuild 路径

只要不满足增量条件，或传了 `--force`，官方会走 full rebuild：

1. 关闭 LadybugDB handle。
2. 删除 DB 文件、`.wal`、`.lock`。
3. 重新初始化 DB。
4. 写入完整 pipeline graph。
5. 重建索引并保存 meta。

因此 `--force` 是明确的“绕过增量写回”开关。

### 官方 staleness 与 hooks 建议

官方 staleness 主要有两层：

| 入口 | 判断 |
| --- | --- |
| `gitnexus status` | 比较 current commit 与 `meta.lastCommit` |
| `git-staleness` helper | 用 `git rev-list lastCommit..HEAD` 判断落后多少 commit |

官方 skills 文档建议：首次、重大代码变更或 staleness 提示后运行 `npx gitnexus analyze`。Claude Code hook 只提示 stale，不自动运行 analyze；原因是避免长时间阻塞 agent，并降低超时或 DB corruption 风险。

这点和 spec-first 的“显式 graph-bootstrap refresh，不让普通 workflow 静默 rebuild”方向一致。

## 当前 spec-first 的刷新模型

### setup 不刷新图谱

`$spec-mcp-setup` 只负责 required harness runtime 和 provider projection：

- 安装或预热 `gitnexus@1.6.5`。
- 写 host MCP 配置。
- 生成 `.spec-first/config/graph-providers.json`。
- 生成 `.spec-first/config/runtime-capabilities.json`。
- 生成 `.spec-first/config/provider-artifacts.json`。

它不运行：

- `gitnexus analyze`
- `gitnexus status`
- `gitnexus query`
- `gitnexus clean`

这是正确边界：setup-owned facts 只能说明工具可发现、命令可构造，不能证明当前 graph query-ready。

### graph-bootstrap 才是 canonical readiness 写入入口

`$spec-graph-bootstrap` / `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh` 是当前唯一 canonical graph readiness 写入入口。

它写入：

```text
.spec-first/providers/gitnexus/status.json
.spec-first/providers/gitnexus/raw/*
.spec-first/providers/gitnexus/normalized/*
.spec-first/graph/provider-status.json
.spec-first/graph/graph-facts.json
.spec-first/impact/bootstrap-impact-capabilities.json
```

下游 plan/work/debug/review 应读这些 artifacts 判断 graph evidence posture，而不是直接从 `.gitnexus/` 或 raw log 推断 readiness。

### 当前命令 projection

当前 `skills/spec-mcp-setup/mcp-tools.json` 已 pin 到 `gitnexus@1.6.5`。setup projection 中 GitNexus commands 是：

```json
{
  "bootstrap": ["npx", "-y", "gitnexus@1.6.5", "analyze", "--force", "--skip-agents-md", "--no-stats"],
  "incremental": ["npx", "-y", "gitnexus@1.6.5", "analyze", "--skip-agents-md", "--no-stats"],
  "status": ["npx", "-y", "gitnexus@1.6.5", "status"],
  "query_probe": ["npx", "-y", "gitnexus@1.6.5", "query", "<probe-token>", "--repo", "spec-first"]
}
```

关键点：

- 默认 full 使用 `--force`，因此一定绕过官方增量写回。
- 显式 incremental 不带 `--force`，才可能进入官方 `runFullAnalysis` 的增量路径。
- command 以 JSON array 存储并执行，不是 shell 字符串。
- graph-bootstrap 对 command shape 做 allowlist 校验，避免 provider command 被任意替换。

### 默认为什么是 full

`bootstrap-providers.sh` 的 refresh mode 决策是：

- 传 `--incremental`：请求 incremental。
- 传 `--full` 或 `--force`：请求 full。
- 都不传：单仓默认 `DEFAULT_REFRESH_MODE_SINGLE_REPO`，当前为 full。
- dirty worktree 命中 graph-affecting path 时，即使请求 incremental，也会降级为 full，并写 `freshness_state=dirty-advisory`。

这个设计偏 correctness-first 和 evidence-first：

- 默认生成一个完整可解释的 cold-run readiness。
- dirty 时继续 warn-and-continue，避免硬阻塞用户，但降级为 advisory。
- 下游必须用源码直读、diff、测试或 contract check 验证关键结论。

### spec-first incremental preflight 更严格

spec-first 并不直接相信 `.gitnexus/meta.json` 来决定是否可增量。

显式 `--incremental` 只有在 prior provider status 可信时才会真正走 incremental command。关键条件包括：

- prior status 存在且 `schema_version=provider-status.v1`。
- provider incremental command 存在且 command shape 受支持。
- bootstrap fingerprint 中 spec-first、provider projection、provider 自身未变化。
- prior status 没有 `requires_clean_full_refresh=true`。
- `last_indexed_commit` 存在且是 40 位 commit。
- prior status `graph_ready=true && query_ready=true`。
- prior status 的 `repo_snapshot.worktree_dirty=false`。
- prior status 与 bootstrap fingerprint 的 source revision 都等于 `last_indexed_commit`。
- base commit 存在且是当前 HEAD 的 ancestor。

如果任一条件不满足，spec-first 会把本次请求降级为 full，并用 `reason_code` 记录过程原因，例如：

- `fingerprint-spec-first-changed`
- `fingerprint-projection-changed`
- `fingerprint-provider-changed`
- `clean-full-refresh-required`
- `incremental-base-ref-unset`
- `incremental-base-status-untrusted`
- `incremental-base-ref-not-ancestor`

这个 preflight 是 spec-first 的治理层选择，不是 GitNexus 官方的必要条件。它牺牲部分性能，换取明确的 readiness provenance。

### 当前项目快照

当前仓库已经升级到 `gitnexus@1.6.5`：

- `skills/spec-mcp-setup/mcp-tools.json`：`version=1.6.5`
- `.spec-first/config/graph-providers.json`：GitNexus command arrays 使用 `gitnexus@1.6.5`
- `.spec-first/providers/gitnexus/status.json`：`status=ready`, `graph_ready=true`, `query_ready=true`
- `.spec-first/graph/graph-facts.json`：`freshness_state=dirty-advisory`

当前可观察状态：

| Artifact | 关键状态 |
| --- | --- |
| `.spec-first/graph/graph-facts.json` | `source_revision=314115815864544f749030d23fa78a6f87a80c19`, `worktree_dirty=true`, `freshness_state=dirty-advisory` |
| `.spec-first/providers/gitnexus/status.json` | `refresh_mode=full`, `readiness_source=cold-run`, `query_ready=true`, `requires_clean_full_refresh=true` |
| `.spec-first/providers/gitnexus/status.json.last_indexed_commit` | `9641ff5cd69d6b50ef92c7ff2fba7d1424e9d5a5` |
| `.gitnexus/meta.json` | `lastCommit=314115815864544f749030d23fa78a6f87a80c19`, `schemaVersion=1`, `fileHashes` 已存在 |

这里存在一个容易误解但合理的差异：

- GitNexus 自己的 `.gitnexus/meta.json.lastCommit` 已经是当前 HEAD，因为本轮 analyze 成功完成。
- spec-first 的 `provider-status.v1.last_indexed_commit` 仍保留上一轮 clean query-ready commit，因为本轮 worktree dirty；该字段被定义为 clean readiness carry-forward base，而不是 GitNexus meta 的镜像。
- `requires_clean_full_refresh=true` 也会让下一次 spec-first `--incremental` preflight 继续降级到 full，直到出现一次 clean 且 query-ready 的成功 full refresh。

这不是数据损坏，但需要在文档和报告里讲清楚。否则用户会看到 GitNexus status up-to-date，同时 spec-first incremental 又被 `clean-full-refresh-required` 降级，误以为两套系统互相矛盾。

## 是否需要优化

需要优化，但不应推翻当前边界。

### 应保留的设计

以下设计符合 spec-first 的最佳实践，应保留：

| 设计 | 评价 |
| --- | --- |
| setup 与 graph-bootstrap 分离 | 正确。setup 只产出 deterministic projection，bootstrap 才证明 query readiness。 |
| 普通 plan/work/review/debug 不自动 analyze | 正确。避免隐式长任务、DB 竞争和证据来源漂移。 |
| canonical `.spec-first/graph/*` / `.spec-first/providers/*` artifacts | 正确。下游消费统一 readiness contract，不耦合 provider raw log。 |
| dirty worktree warn-and-continue + `dirty-advisory` | 正确。兼顾不中断工作流与证据降级披露。 |
| command arrays + allowlist shape 校验 | 正确。防止 shell interpolation 和任意 provider command 注入。 |
| `last_indexed_commit` 只代表 clean query-ready base | 正确。它不应简单镜像 `.gitnexus/meta.json.lastCommit`。 |

这些点符合项目角色契约里的原则：

```text
Scripts prepare deterministic facts.
LLM decides semantic relevance.
Advisory facts are not confirmed truth.
```

### 不建议的优化

以下方向不建议做：

| 不建议 | 原因 |
| --- | --- |
| 让 `$spec-work` / `$spec-plan` / `$spec-code-review` 自动运行 `gitnexus analyze` | 会把语义 workflow 和 provider mutation 混在一起，破坏 preview-first 与 source/runtime 边界。 |
| 默认把所有 graph-bootstrap 改成 incremental | 当前 spec-first 还没有把 GitNexus 1.6.5 官方增量作为 correctness-backed fast path 验证完；默认切换会把性能优化变成隐式语义风险。 |
| dirty worktree 下允许 incremental | GitNexus 可以 hash-diff 当前磁盘，但 spec-first 无法把 dirty index 绑定到一个 clean source revision；应保持 full + advisory。 |
| 直接把 `.gitnexus/meta.json` 当作 spec-first incremental base | `.gitnexus/meta.json` 是 provider-local storage，不是 canonical readiness proof；只能作为诊断输入。 |
| 使用 hooks/watchers/daemon 自动 refresh | GitNexus 官方也避免 hook 自动 analyze；spec-first 更应保持显式 refresh。 |

### 推荐优化一：正式化 clean single-repo incremental fast path

当前手册把 `--incremental` 定位为 clean single-repo diagnostic / validation-only expert mode。基于 `gitnexus@1.6.5` 的官方实现，可以把它提升为“经过验证的 opt-in fast path”，但需要先补齐验证。

建议的最小落地顺序：

1. 保持默认 full 不变。
2. 为 `bootstrap-providers.sh --incremental` 增加 focused regression tests：
   - clean prior status + same fingerprint + ancestor base 时调用 incremental command。
   - dirty worktree 请求 incremental 时降级 full 并写 `dirty-advisory`。
   - `requires_clean_full_refresh=true` 时降级 full。
   - incremental 失败后 fallback full 成功时写 `refresh_mode=incremental-fallback-full`。
3. 增加一个真实小仓或 fixture 级 smoke：
   - 先 full bootstrap。
   - 修改一个 source file。
   - 提交或保持 clean revision。
   - 跑 `--incremental`。
   - 断言 `query_ready=true` 且 query proof 命中变更相关 symbol。
4. 文档将 `--incremental` 从 diagnostic-only 调整为：
   - `clean single-repo opt-in`
   - `not all-repos`
   - `not dirty`
   - `fallback full on failure`
   - `still advisory until source/test confirms task-specific conclusions`

这样既利用 GitNexus 官方增量，又不把它变成下游 workflow 的隐式副作用。

### 推荐优化二：增加 GitNexus native meta 与 spec-first status 的差异诊断

当前差异是合理的，但不够直观。

建议 graph-bootstrap 在 report 或 provider status limitations 中增加诊断字段或文案：

```text
provider_native_meta.lastCommit = 3141158...
spec_first_clean_base.last_indexed_commit = 9641ff5...
divergence_reason = dirty-run-clean-base-carried-forward
```

或用更轻量的 `diagnostics[]` 文案：

```text
GitNexus meta is current, but spec-first incremental base remains the last clean query-ready commit because this run was dirty-advisory.
```

边界要求：

- 该字段只能是 diagnostic。
- 不作为 query readiness 判断。
- 不替代 `provider-status.v1.last_indexed_commit`。

### 推荐优化三：provider refresh 加 repo-local serialization

本地升级验证中，连续或并发 `analyze --force` 曾触发 native DB/cache 错误，最后通过 `gitnexus@1.6.5 clean --force` 重建恢复。GitNexus 官方 server 路径有 repo lock 思路，但 CLI `analyze` 之间仍可能被多个 agent session 同时触发。

建议在 spec-first graph-bootstrap 层增加轻量 repo-local lock：

```text
.spec-first/providers/gitnexus/refresh.lock
```

要求：

- lock 只覆盖 provider refresh command，不覆盖普通下游读取。
- 记录 pid、started_at、command、repo root。
- stale lock 需要有明确 timeout 和用户可见 repair action。
- lock conflict 返回 reason_code，例如 `provider-refresh-in-progress`。
- 不引入 daemon，不自动 kill 其他进程。

这符合 Light contract：脚本只保护确定性写入边界，不做语义调度。

### 推荐优化四：把 clean-full-refresh-required 的恢复路径写清楚

当前 `requires_clean_full_refresh=true` 的语义是：至少需要一次 clean full refresh 成功，才能重新信任 incremental base。

建议在用户手册和 bootstrap report 中明确恢复命令：

```bash
# 在 worktree clean 后运行
bash skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh --full
```

成功条件：

- `worktree_dirty=false`
- GitNexus `graph_ready=true`
- GitNexus `query_ready=true`
- `requires_clean_full_refresh=false`
- `last_indexed_commit=<current HEAD>`

这比让用户手动删除 `.gitnexus/` 更安全。只有 full refresh 仍失败或 provider-local storage 明显损坏时，才推荐 preview-first repair / clean。

### 推荐优化五：保留 full refresh 作为版本升级后的默认策略

升级 GitNexus package pin、schema、provider projection 或 bootstrap script 后，应继续默认 full。

原因：

- GitNexus 官方增量依赖 `schemaVersion` 和 `fileHashes`，但 provider 版本变化可能改变 graph semantics。
- spec-first 还要验证 query proof 与 readiness contract，不只是 DB 写入成功。
- full refresh 能重建 provider-local storage，减少旧版本 artifact 影响。

因此，升级到 `gitnexus@1.6.5` 后当前选择 full bootstrap 是合理的。

## 是否符合最佳实践

### GitNexus 官方最佳实践角度

当前 spec-first 的默认 full refresh 与 GitNexus 官方“普通变化后运行 `gitnexus analyze`”并不完全一致：

- 官方常规刷新建议是 `npx gitnexus analyze`，让工具自行选择 already-up-to-date / incremental / full。
- spec-first 默认运行 `npx -y gitnexus@1.6.5 analyze --force --skip-agents-md --no-stats`，强制 full rebuild。

所以从纯 GitNexus 性能最佳实践看，当前 spec-first 没有充分利用官方 1.6.5 增量机制。

但从工程治理角度看，当前默认 full 有合理性：

- provider package 刚升级时，full refresh 更稳。
- dirty worktree 下，full + advisory 比 incremental + clean-base 假象更清晰。
- spec-first 需要 canonical readiness proof，而不是只追求 provider-local up-to-date。

### spec-first 最佳实践角度

当前策略总体符合 spec-first 的最佳实践：

| 维度 | 判断 |
| --- | --- |
| Light contract | 基本符合。刷新入口少，artifact contract 明确。 |
| Explicit boundaries | 符合。setup / bootstrap / downstream consumption 分工清楚。 |
| Scripts prepare, LLM decides | 符合。脚本产出 readiness facts，LLM 不假装刷新图谱。 |
| Preview-first | 基本符合。普通 workflow 不静默 clean/rebuild；repair 需显式动作。 |
| Source-first | 符合。版本 pin 在 source，runtime/config 由 setup/bootstrap 生成。 |
| 性能最佳 | 仍可优化。默认 `--force` 绕过官方增量。 |

综合判断：

```text
当前策略是治理最佳实践优先，不是性能最佳实践优先。
这在 GitNexus 1.6.5 升级后的稳定期是合理的。
下一步应把官方 incremental 做成受验证、显式、clean-only 的 fast path，而不是改成全自动刷新。
```

## 建议决策

### 短期

短期不改默认行为。

继续使用：

```bash
bash skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh --full
```

或通过 `$spec-graph-bootstrap` 触发当前默认 full refresh。

原因：

- 当前 worktree dirty，compiled graph facts 已是 `dirty-advisory`。
- GitNexus 已升级到 `1.6.5`，需要一次 clean full refresh 才能重置 `requires_clean_full_refresh`。
- 下游 graph-heavy 结论仍需直接源码验证。

### 中期

把 `--incremental` 提升为 supported opt-in fast path：

```bash
bash skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh --incremental
```

适用条件：

- 单仓。
- worktree clean。
- prior provider status clean query-ready。
- provider projection fingerprint 未变。
- `last_indexed_commit` 是当前 HEAD ancestor。
- 不是 package/schema/contract 升级后的首次 refresh。

### 长期

如果后续 GitNexus 官方提供更明确的 CLI-level locking、status dirty 检测或 incremental correctness guarantees，spec-first 可以把默认策略调整为：

```text
clean + same provider projection + no clean-full-required -> incremental
otherwise -> full
```

但这应通过 contract tests、fixture smoke、用户手册和 changelog 一起落地，而不是只改 command array。

## 操作清单

当前仓库建议：

1. 保持 `gitnexus@1.6.5` pin，不需要再升级。
2. 不在 dirty worktree 下评估 clean incremental 性能。
3. 在合适时机清理或提交当前改动，让 worktree clean。
4. 运行一次 clean full graph-bootstrap，确认：
   - `freshness_state=fresh`
   - `requires_clean_full_refresh=false`
   - `last_indexed_commit=<current HEAD>`
5. 再用 `--incremental` 做一次小改动后的 opt-in 验证。
6. 若验证稳定，再把 incremental 从 diagnostic-only 文档口径提升为 supported clean fast path。

## 最终心智模型

```text
GitNexus 官方：
  analyze 是刷新入口。
  不传 --force 才可能利用官方增量。
  官方增量 = full pipeline + selective DB writeback + cache reuse。

spec-first：
  mcp-setup 只准备 provider projection。
  graph-bootstrap 才刷新 canonical readiness。
  默认 full 是 correctness-first。
  incremental 应作为 clean single-repo opt-in fast path 被验证后推广。

下游 workflow：
  读取 readiness。
  披露 freshness。
  用 graph evidence 辅助判断。
  不自动 rebuild，不把 advisory facts 当 confirmed truth。
```
