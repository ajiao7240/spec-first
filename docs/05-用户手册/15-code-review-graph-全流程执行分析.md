# code-review-graph 全流程执行分析

> Retired / historical archive: 本文记录 GitNexus-only 迁移前的 CRG 链路，仅用于理解历史设计和手动清理背景。当前 spec-first 不再安装、配置、刷新或消费 `code-review-graph`。

本文基于迁移前仓库源码，说明 `code-review-graph` 在 spec-first 中曾经从安装、配置、生成、使用、更新到修复的完整执行链路。

结论先行：

```text
spec-first init        生成 host 入口与 .gitignore provider artifact 边界
$spec-mcp-setup       安装/预热 code-review-graph CLI，写 setup-owned provider projection
$spec-graph-bootstrap 运行 code-review-graph build/status/query proof，写 impact readiness
$spec-code-review     用它做 diff impact / review context evidence，LLM/reviewers 决定是否形成 finding
```

`code-review-graph` 在本项目中的角色不是全局架构知识库，而是聚焦 `$spec-code-review` 的 `impact_context` provider。它更靠近链路后半段：

```text
Code -> Review -> Knowledge
```

它回答的是“这次改动影响什么”，而不是“这个代码库整体怎么工作”。spec-first 把它治理为可刷新、可降级、可追溯的 review / impact evidence provider。

## 分析范围

本文覆盖：

- `code-review-graph` 如何被声明、安装和预热。
- setup 阶段如何生成 provider commands 与 readiness projection。
- graph bootstrap 阶段如何运行 `build` / `update` / `status` / query proof。
- `.spec-first/providers/code-review-graph/*`、`.spec-first/impact/*` 和 `.spec-first/graph/*` 如何生成与消费。
- 下游 `spec-code-review` 与 review pre-facts 如何使用它，以及 `spec-plan` / `spec-work` / `spec-debug` 为什么默认不把 CRG 当图谱 fallback。
- 更新、incremental、dirty/stale、fallback、repair 和 anti-pattern 边界。
- 当前 `spec-first` 仓库中的实际 artifact 快照。

本文不覆盖：

- `code-review-graph` 上游 Python package 的内部实现。
- 已退役的内置图运行时实现、历史本地图库主路径或早期实验设计细节。
- 把 `code-review-graph` 变成 reviewer agent 或替代 `spec-code-review`。

## Source Of Truth

`code-review-graph` 流程的当前 source-of-truth 包括：

| 领域 | Source |
| --- | --- |
| MCP/tool registry 与 package pin | `skills/spec-mcp-setup/mcp-tools.json` |
| setup projection writer | `skills/spec-mcp-setup/scripts/write-provider-config.sh` |
| graph bootstrap workflow contract | `skills/spec-graph-bootstrap/SKILL.md` |
| graph bootstrap implementation | `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh` |
| graph artifact 消费契约 | `docs/contracts/graph-provider-consumption.md` |
| graph evidence 政策 | `docs/contracts/graph-evidence-policy.md` |
| downstream graph evidence 消费 | `docs/contracts/downstream-graph-evidence-consumption.md` |
| code review workflow | `skills/spec-code-review/SKILL.md` |
| review pre-facts helper | `src/cli/helpers/review-pre-facts.js` |
| provider 作用域说明 | `docs/05-用户手册/13-代码图谱Provider作用域与差异化.md` |

Generated runtime assets 不是 source-of-truth：

```text
.claude/
.codex/
.agents/skills/
```

本地 provider storage 与 readiness artifacts 也不是手工 source：

```text
.code-review-graph/
.spec-first/providers/code-review-graph/
.spec-first/impact/
.spec-first/graph/
```

它们是可重建 control-plane evidence。修复应优先改 source 或重新运行对应 workflow，不应手改这些 artifacts 来制造 ready 状态。

## 总体生命周期

```text
1. init
   - 写 host 入口文档和 managed runtime assets
   - 写 .gitignore managed block，忽略 .code-review-graph/ 与 .spec-first readiness artifacts

2. mcp setup
   - 验证 uv / uvx
   - 预热 uvx code-review-graph@2.3.3 --help
   - 默认不要求 host MCP ready
   - 写 .spec-first/config/graph-providers.json
   - 写 .spec-first/config/runtime-capabilities.json
   - 写 .spec-first/config/provider-artifacts.json

3. graph bootstrap
   - 校验 setup-owned config
   - full: uvx code-review-graph@2.3.3 build
   - incremental: uvx code-review-graph@2.3.3 update --base <last_indexed_commit>
   - status: uvx code-review-graph@2.3.3 status
   - query proof: uvx code-review-graph@2.3.3 status --repo <repo-root>
   - 写 provider status、normalized impact capabilities、aggregate graph facts

4. downstream consumption
   - code review 读取 impact readiness 和 provider status
   - review pre-facts 可渲染 bounded query plan
   - plan/work/debug 默认使用 GitNexus 或 bounded direct reads，不直接读取 CRG provider facts 扩大职责

5. update / repair
   - package pin 或 commands 改动先改 source
   - setup 重新 projection
   - graph-bootstrap 显式刷新
   - repair 必须有 reason_code、recommended_action 和用户可见边界
```

## 节点一：init

`spec-first init` 不安装 `code-review-graph`，也不运行 `build` 或 `update`。它只准备 host/runtime 入口与本地 artifact 边界。

与 `code-review-graph` 直接相关的 init 行为：

- `.gitignore` managed block 忽略 `.code-review-graph/`。
- 同一 block 也忽略 `.spec-first/config/*.json`、`.spec-first/graph/`、`.spec-first/providers/`、`.spec-first/impact/`、`.spec-first/workspace/` 等 readiness/control-plane artifacts。
- `AGENTS.md` / `CLAUDE.md` 的 GitNexus instruction block 会提醒读取 graph readiness；它覆盖 GitNexus 和 `code-review-graph` 的 canonical readiness artifacts，但本身不是 proof。
- init next steps 指向 `$spec-mcp-setup`，再由 setup 的 graph pending 状态 handoff 到 `$spec-graph-bootstrap`。

因此 init 完成只表示 runtime entrypoints 已生成，不表示 `code-review-graph` CLI 可用，也不表示 impact evidence ready。

## 节点二：安装与可选 MCP 配置

`code-review-graph` 的 registry 声明来自 `skills/spec-mcp-setup/mcp-tools.json`：

| 字段 | 当前值 |
| --- | --- |
| `id` | `code-review-graph` |
| `required` | `true` |
| `category` | `graph-provider` |
| `provider_role` | `impact_context` |
| `dependencies` | `uv`, `uvx` |
| `package` | `code-review-graph` |
| `version` | `2.3.3` |
| install warmup | `uvx code-review-graph@2.3.3 --help` |
| `access_mode` | `cli_artifact` |
| `host_config_required` | `false` |
| `optional_live_mcp` | `true` |
| `enabled_for_bootstrap` | `true` |
| `query_ready_after_setup` | `false` |

这里最重要的边界是：`code-review-graph` 是 required graph provider，但它默认不要求 host MCP 配置 ready。

它的 optional live MCP command 仍被 registry 声明：

```bash
uvx code-review-graph@2.3.3 serve --tools get_minimal_context_tool,get_impact_radius_tool,get_review_context_tool,query_graph_tool,detect_changes_tool,list_graph_stats_tool
```

但 setup 默认把它当 `host_config_status=not-required`，而不是像 GitNexus 那样要求 live MCP server 可启动。原因是当前默认路径使用 CLI artifact provider：

```text
spec-mcp-setup -> graph-providers.json -> spec-graph-bootstrap -> .spec-first/providers/code-review-graph/**
```

可选 MCP surface 只适合当前 session 做 read-only enhancement，不能替代 canonical readiness。

## 节点三：setup projection 生成

`$spec-mcp-setup` 会验证 `uv` / `uvx` 和 warmup 命令，然后通过 `skills/spec-mcp-setup/scripts/write-provider-config.sh` 生成 setup-owned projection：

```text
.spec-first/config/graph-providers.json
.spec-first/config/runtime-capabilities.json
.spec-first/config/provider-artifacts.json
```

### graph-providers.json

`code-review-graph` 的 command arrays 当前由 package pin 生成：

```json
{
  "bootstrap": ["uvx", "code-review-graph@2.3.3", "build"],
  "incremental": ["uvx", "code-review-graph@2.3.3", "update", "--base", "__SPEC_FIRST_LAST_INDEXED_COMMIT__"],
  "status": ["uvx", "code-review-graph@2.3.3", "status"],
  "query_probe": ["uvx", "code-review-graph@2.3.3", "status", "--repo", "<repo-root>"]
}
```

这些命令是 JSON array，不是 shell 字符串。`spec-graph-bootstrap` 后续按 array 执行，并对 package、subcommand 和参数 shape 做 fail-closed 校验。

setup projection 中的关键字段：

| 字段 | 含义 |
| --- | --- |
| `configured=true` | setup 发现依赖和配置满足 provider projection 条件 |
| `enabled_for_bootstrap=true` | graph-bootstrap 可以使用该 provider |
| `access_mode=cli_artifact` | 默认通过 CLI 生成 artifacts |
| `host_config_required=false` | host MCP 不阻塞 baseline |
| `mcp_server=null` | 默认不把它作为 required live MCP server |
| `capabilities[]` | `detect_changes`, `blast_radius`, `minimal_context`, `review_context`, `related_tests`, `graph_stats` |
| `query_probe_policy=null` | CRG 不使用 GitNexus 那套 source-derived probe candidate policy |

setup 结束后，`derived_readiness.providers["code-review-graph"].query_ready` 仍可能是 false，且 `bootstrap_required=true`。这是正确状态：setup 只准备命令和 projection，不运行 provider build/status/query proof。

### runtime-capabilities.json

`runtime-capabilities.json` 会暴露 fallback capabilities，例如 ast-grep 的 context/impact/review fallback。它也指向 canonical graph artifacts，但不替代 canonical readiness。

下游判断 `code-review-graph` 是否可用于 impact evidence，应看：

```text
.spec-first/graph/provider-status.json
.spec-first/graph/graph-facts.json
.spec-first/impact/bootstrap-impact-capabilities.json
.spec-first/providers/code-review-graph/status.json
```

### provider-artifacts.json

该 artifact 声明 provider 路径：

```text
.spec-first/providers/code-review-graph/raw/
.spec-first/providers/code-review-graph/normalized/
.spec-first/providers/code-review-graph/status.json
.spec-first/providers/code-review-graph/raw/build.log
.spec-first/providers/code-review-graph/raw/status.log
.spec-first/providers/code-review-graph/raw/query.log
.spec-first/providers/code-review-graph/normalized/impact-capabilities.json
```

路径存在不等于 provider ready。readiness 仍要看 provider status 与 aggregate graph facts。

## 节点四：graph bootstrap 生成

`$spec-graph-bootstrap` 是默认本地 workflow 中唯一可以刷新 canonical graph readiness artifacts 的入口。

它读取 setup-owned inputs：

```text
.spec-first/config/runtime-capabilities.json
host readiness ledger v2
.spec-first/config/graph-providers.json
.spec-first/config/provider-artifacts.json
```

它为 `code-review-graph` 写入：

```text
.code-review-graph/
.spec-first/providers/code-review-graph/raw/build.log
.spec-first/providers/code-review-graph/raw/status.log
.spec-first/providers/code-review-graph/raw/query.log
.spec-first/providers/code-review-graph/status.json
.spec-first/providers/code-review-graph/normalized/impact-capabilities.json
.spec-first/graph/provider-status.json
.spec-first/graph/graph-facts.json
.spec-first/impact/bootstrap-impact-capabilities.json
.spec-first/graph/bootstrap-report.md
```

### command shape safety

Bootstrap 对 `code-review-graph` command shape 做严格校验：

- package 必须形如 `code-review-graph@<version>`。
- `bootstrap` 只能是 `build`。
- `incremental` 只能是 `update --base __SPEC_FIRST_LAST_INDEXED_COMMIT__`。
- `status` 只能是 `status`。
- `query_probe` 只能是 `status --repo <repo-root>`。
- 参数不能含 shell metacharacters。
- `@latest`、任意 package、额外参数、混用版本或把 concrete SHA 写进 projection 都会 fail closed。

普通 plan/work/debug/review 不得绕过这个 gate 自己执行 `code-review-graph build`、`update`、provider repair、watcher 或 daemon。CRG 的主要 downstream consumer 是 `$spec-code-review`；plan/work/debug 只读取 GitNexus evidence 或直接源码/测试/日志证据。

### full refresh

默认或显式 full refresh 运行：

```bash
uvx code-review-graph@2.3.3 build
uvx code-review-graph@2.3.3 status
uvx code-review-graph@2.3.3 status --repo <repo-root>
```

`build` 是 provider bootstrap；`status` 是 graph readiness probe；`status --repo` 是 conservative query-surface proof。

CRG 的 query proof 与 GitNexus 不同：在当前 Bash 实现中，`query_probe_verified` 对非 GitNexus provider 只要求 command exit 0。也就是说，`code-review-graph` 的 `query_ready=true` 表示 provider command surface 可运行，不表示已经产出了某个语义 query 结论。

normalized artifact 也明确写出这一限制：

```text
code-review-graph query-surface proof is conservative and should be treated as provider readiness, not semantic evidence.
```

### incremental refresh

clean single-repo 显式 incremental 可以运行：

```bash
bash skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh --incremental
```

当 preflight 通过时，CRG incremental 命令会被 materialize 为：

```bash
uvx code-review-graph@2.3.3 update --base <last_indexed_commit>
```

`last_indexed_commit` 来自 provider status，而不是 aggregate `graph-facts.json.source_revision`。它只有在 prior provider status 同时满足以下条件时才可信：

- `schema_version=provider-status.v1`
- `graph_ready=true`
- `query_ready=true`
- prior snapshot 是 clean
- `repo_snapshot.source_revision` 等于该 commit
- `bootstrap_fingerprint.repo_snapshot.source_revision` 等于该 commit
- commit 存在且是当前 `SOURCE_REVISION` 的 ancestor

不满足时会降级 full，并记录 reason code，例如：

- `incremental-base-ref-unset`
- `incremental-base-ref-invalid-format`
- `incremental-base-status-untrusted`
- `incremental-base-ref-missing`
- `incremental-base-ref-not-ancestor`
- `fingerprint-spec-first-changed`
- `fingerprint-projection-changed`
- `fingerprint-provider-changed`
- `clean-full-refresh-required`

`--all-repos --incremental` 不支持；父 workspace all-repos 路径必须走 full 或显式选择单个 child repo。

### provider status

`.spec-first/providers/code-review-graph/status.json` 是 provider 级诊断。关键字段：

- `status`
- `graph_ready`
- `query_ready`
- `readiness_source`
- `refresh_mode`
- `fallback_from_incremental`
- `last_indexed_commit`
- `requires_clean_full_refresh`
- `reuse_eligible`
- `reuse_ineligible_reason`
- `bootstrap_fingerprint`
- `reason_code`
- `failure_class`
- `recommended_action`
- `limitations[]`
- `command_results[]`
- `raw_logs`
- `normalized_artifacts`

不要只看 `status=ready`。最低消费条件是 `status=ready && query_ready=true`，并且还要通过 graph freshness 检查。

### normalized impact capabilities

`.spec-first/providers/code-review-graph/normalized/impact-capabilities.json` 当前是 provider-normalized envelope。它暴露：

```text
available_query_surfaces:
  - status
  - query_graph_tool
  - get_impact_radius_tool

capabilities:
  - detect_changes
  - blast_radius
  - minimal_context
  - review_context
  - related_tests
  - graph_stats
```

它的 `confidence` 当前为 `medium`，因为它只证明 provider readiness surface，不证明某条 semantic fact 已确认。

### aggregate graph facts

`.spec-first/graph/graph-facts.json` 会把 `code-review-graph` readiness 汇总到：

```text
provider_summary.ready_primary_providers[]
capabilities.impact_context
freshness_state
source_revision
worktree_dirty
worktree_status_hash
dirty_classification
limitations[]
```

当 `code-review-graph.query_ready=true` 时：

```text
capabilities.impact_context=true
```

但这只说明 impact-context provider 可用，不说明当前任务一定需要 graph evidence。

### bootstrap impact capabilities

`.spec-first/impact/bootstrap-impact-capabilities.json` 是下游最关心的 impact readiness envelope：

| Capability | CRG ready 时 |
| --- | --- |
| `context_selection.support_level` | `full`，primary providers 包含 `code-review-graph` 和可能的 GitNexus |
| `impact_radius.support_level` | `full`，primary provider 是 `code-review-graph` |
| `review_support.support_level` | `partial`，primary provider 是 `code-review-graph` |

`review_support` 故意是 `partial`：它表示 CRG 可提供 review evidence，不表示 review 已经通过，也不替代 reviewer synthesis。

## 节点五：下游 workflow 如何使用

### spec-code-review

`$spec-code-review` 是 `code-review-graph` 的主要 consumer。

它在 review orientation 中先读取：

```text
.spec-first/graph/provider-status.json
.spec-first/graph/graph-facts.json
.spec-first/impact/bootstrap-impact-capabilities.json
```

然后按 freshness 和 `query_ready` 判断 graph evidence posture。关键边界：

- `code-review-graph` 是 primary diff impact provider when available。
- stale / degraded / unavailable 只限制 graph evidence，不禁用 reviewer dispatch。
- Code Review 不得运行 `code-review-graph build` 或 `update`。
- provider degradation 在 Coverage 里记录一次，避免每个 reviewer 重复探测。
- CRG output 是 supporting evidence；finding 必须由 diff/source/test/contract evidence 确认。
- CRG risk signal 不能单独决定 severity、autofix class 或 release gate。

### review pre-facts

`src/cli/helpers/review-pre-facts.js` 会读取 provider normalized artifacts，构建 `normalized_artifact_inventory`。当 readiness 是 `graph-fresh` 且 target provider 有 query surface 时，它可以为 changed/readable targets 渲染 bounded query plan。

如果 target provider 是 `code-review-graph`，query plan 中的 tool name 是：

```text
code-review-graph.query
```

这仍是 query plan / pre-facts evidence，不是 final finding。consumer 需要继续 direct source reads 或 reviewer synthesis。

### spec-plan / spec-work / spec-debug

这三个 workflow 默认使用 GitNexus 作为图谱能力：

- `$spec-plan` 用 GitNexus 做 architecture、API/route、symbol、execution flow、workspace/group orientation，并在 `## Graph / GitNexus Evidence` 中记录四轴 posture。
- `$spec-work` 消费 plan/task-pack scope 与 GitNexus evidence，使用 bounded direct reads 和测试确认实现事实。
- `$spec-debug` 用 GitNexus 辅助定位可能的执行链路或 blast radius，但 root cause 必须由 reproduction、source、log、test 或 contract check 关闭。

当 GitNexus stale、degraded、definitions-only 或 unavailable 时，这三个 workflow 的 fallback 是 bounded direct repo reads、ast-grep、git diff、测试或日志，不是 code-review-graph。CRG 保持在 `$spec-code-review` 的 review/diff-impact 节点，避免把为 review 设计的 provider 扩散成全局知识库。

`$spec-work` 可以消费 `$spec-code-review` 已经产出的 review handoff 摘要；这属于 review artifact consumption，不等于 Work 直接读取或刷新 CRG provider artifacts。

## 节点六：可选 live MCP 边界

Registry 中保留了 `code-review-graph serve` optional MCP command，工具包括：

- `get_minimal_context_tool`
- `get_impact_radius_tool`
- `get_review_context_tool`
- `query_graph_tool`
- `detect_changes_tool`
- `list_graph_stats_tool`

但当前默认治理模型是：

```text
CLI artifact provider is required.
Live MCP server is optional.
```

因此：

- setup baseline 不因 CRG MCP 未配置而失败。
- 可选 MCP startup failure 不应被当成项目代码 finding。
- live MCP 成功只算 session-local evidence。
- live MCP 不得回写 `.spec-first/graph/*` 或 `.spec-first/impact/*`。
- live MCP 不得扩大 review scope；plan/work/debug 默认不以 CRG live MCP 作为图谱 fallback。

## 节点七：更新与刷新

### 更新 package pin

`code-review-graph` package pin 当前在 `skills/spec-mcp-setup/mcp-tools.json`：

```json
{
  "package": "code-review-graph",
  "version": "2.3.3"
}
```

升级顺序：

1. 修改 `mcp-tools.json` 的 package/version 和必要 capability/host config 描述。
2. 同步 Bash/PowerShell setup projection tests 与 graph-bootstrap tests。
3. 运行 `$spec-mcp-setup` 重新生成 `.spec-first/config/*` projection。
4. 运行 `$spec-graph-bootstrap` 重新编译 provider readiness。
5. 下游 workflow 重新读取 canonical artifacts。

如果 graph-bootstrap 发现 configured package 与 bundled package 不一致，或 CRG 命令仍是 floating `uvx --upgrade code-review-graph` / `uvx --refresh code-review-graph`，它会在 provider commands 执行前 fail closed：

- `code-review-graph-provider-projection-stale`
- `code-review-graph-provider-version-unverifiable`

### 刷新 graph readiness

普通刷新：

```bash
bash skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh
```

显式 full：

```bash
bash skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh --full
bash skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh --force
```

clean single-repo diagnostic incremental：

```bash
bash skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh --incremental
```

父 workspace 全 child maintenance：

```bash
bash skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh --all-repos
```

父 workspace 单 child：

```bash
bash skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh --repo <child>
```

### stale / dirty 判断

下游消费前必须比较：

- 当前 `HEAD` 与 `graph-facts.source_revision`。
- 当前 dirty 状态与 `graph-facts.worktree_dirty`。
- 当前 dirty hash 与 `graph-facts.worktree_status_hash`。
- provider `query_ready`。
- provider projection / fingerprint。

`dirty-advisory` 表示 provider artifacts 可能基于未提交磁盘状态，不能当 fresh primary evidence。CRG 在 dirty-advisory 状态下仍可作为 pointer，但最终结论必须用当前源码或测试确认。

## 节点八：多仓 workspace

多仓 workspace 下，parent 只拥有 advisory summaries；child repo 拥有自己的 provider artifacts。

父 workspace 可写：

```text
.spec-first/workspace/graph-bootstrap-summary.json
.spec-first/workspace/graph-targets.json
.spec-first/workspace/gitnexus-readiness.json
```

child repo 拥有：

```text
<child>/.spec-first/providers/code-review-graph/**
<child>/.spec-first/impact/**
<child>/.spec-first/graph/**
```

`code-review-graph` 没有 GitNexus group 概念。它的 readiness 和 impact evidence 必须按 child repo 读取和解释。跨仓 review 可以用 GitNexus group 做只读 orientation，但 CRG impact、changed files、related tests 和 findings 仍必须 scoped to owning repo。

写入、测试、review autofix 或 commit 前必须明确 `target_repo` 或 per-child scope。

## 节点九：失败模式与 repair

常见失败模式：

| 失败 | 典型 reason | 正确处理 |
| --- | --- | --- |
| `uv` / `uvx` 缺失 | dependency not ready | 修复 setup 依赖，重跑 `$spec-mcp-setup` |
| setup 运行了 build | policy violation | setup 只能 warmup，不得 build；修 setup 脚本或测试 |
| command shape 被改坏 | `unsupported-provider-command` | 修 source projection，不手改 generated config |
| package pin stale | `code-review-graph-provider-projection-stale` | 重跑 `$spec-mcp-setup`，再 bootstrap |
| floating package | `code-review-graph-provider-version-unverifiable` | 使用 pinned `code-review-graph@<version>` |
| cache 权限失败 | `provider-cache-permission-denied` | 修 UV/Python cache 权限，再 bootstrap |
| package registry 找不到 | `provider-package-not-found` | 修 `UV_INDEX_URL` / `PIP_INDEX_URL` 或 package source |
| build 失败 | provider command failure | 查看 raw build log 和 recommended action |
| status/query proof 失败 | `query-unverified` | 降级 direct reads / ast-grep，必要时重新 bootstrap |
| incremental base 不可信 | incremental base reason codes | 降级 full，不把它当 provider 故障 |

Repair 原则：

- 优先修 source-of-truth 或环境依赖。
- `.code-review-graph/` 是 provider storage，不是手工维护 source。
- 删除 provider storage、raw artifacts 或 canonical readiness artifacts 必须是显式 recovery action。
- 普通 plan/work/review/debug 不得隐藏执行 repair。

## Artifacts 与 ownership

| Path | Producer | Ownership | Consumer |
| --- | --- | --- | --- |
| `skills/spec-mcp-setup/mcp-tools.json` | source | package pin、capability、optional MCP declaration | setup writer / tests / docs |
| `.spec-first/config/graph-providers.json` | `$spec-mcp-setup` | command arrays、projection、derived readiness | `$spec-graph-bootstrap` |
| `.spec-first/config/runtime-capabilities.json` | `$spec-mcp-setup` | fallback tools/capabilities, pointer facts | bootstrap / downstream pointer |
| `.spec-first/config/provider-artifacts.json` | `$spec-mcp-setup` | provider artifact path contract | bootstrap |
| `.code-review-graph/` | provider CLI | local provider storage | code-review-graph |
| `.spec-first/providers/code-review-graph/raw/build.log` | `$spec-graph-bootstrap` | raw bootstrap log | diagnostics |
| `.spec-first/providers/code-review-graph/raw/status.log` | `$spec-graph-bootstrap` | raw status log | diagnostics |
| `.spec-first/providers/code-review-graph/raw/query.log` | `$spec-graph-bootstrap` | raw query proof log | diagnostics |
| `.spec-first/providers/code-review-graph/status.json` | `$spec-graph-bootstrap` | provider status/readiness/diagnostics | downstream diagnostics |
| `.spec-first/providers/code-review-graph/normalized/impact-capabilities.json` | `$spec-graph-bootstrap` | normalized impact capability envelope | code-review impact readiness |
| `.spec-first/graph/provider-status.json` | `$spec-graph-bootstrap` | aggregate provider readiness | plan/work/review/debug |
| `.spec-first/graph/graph-facts.json` | `$spec-graph-bootstrap` | graph freshness/capabilities | plan/work/review/debug |
| `.spec-first/impact/bootstrap-impact-capabilities.json` | `$spec-graph-bootstrap` | impact/context/review support envelope | plan/work/review/debug |

## 当前仓库快照

本次分析以当前源码直接读取为 primary evidence。当前 compiled graph artifacts 对当前 checkout 不能当 fresh primary evidence：

- 当前 `HEAD`：`314115815864544f749030d23fa78a6f87a80c19`
- `.spec-first/graph/graph-facts.json.source_revision`：`5628d728dea3544af58e5c88856f5ccac621ea1a`
- `.spec-first/graph/graph-facts.json.freshness_state`：`dirty-advisory`
- `.spec-first/graph/graph-facts.json.worktree_dirty`：`true`
- `.spec-first/graph/graph-facts.json.dirty_classification`：`graph-affecting-blocked`
- `.spec-first/graph/provider-status.json.workflow_mode`：`primary`
- `code-review-graph` provider status：`status=ready`、`graph_ready=true`、`query_ready=true`
- `code-review-graph` refresh mode：`readiness_source=cold-run`、`refresh_mode=full`
- `code-review-graph` bootstrap command：`uvx code-review-graph@2.3.3 build`
- `code-review-graph` status command：`uvx code-review-graph@2.3.3 status`
- `code-review-graph` query proof command：`uvx code-review-graph@2.3.3 status --repo /Users/kuang/xiaobu/spec-first`
- normalized artifact：`.spec-first/providers/code-review-graph/normalized/impact-capabilities.json`
- impact capability envelope：`impact_radius.support_level=full`，primary provider 为 `code-review-graph`；`review_support.support_level=partial`

这说明 CRG provider 曾经 query-ready，但 artifact 对当前 checkout 是 stale / dirty-advisory。当前文档结论因此以源码直接读取为准；compiled graph facts 只作为 artifact shape 与现状快照。

## 最小操作手册

### 首次准备

```text
$spec-mcp-setup
$spec-graph-bootstrap
```

Claude host 对应 `/spec:mcp-setup` 和 `/spec:graph-bootstrap`。

### 判断 CRG 是否可消费

读取：

```text
.spec-first/graph/provider-status.json
.spec-first/graph/graph-facts.json
.spec-first/impact/bootstrap-impact-capabilities.json
.spec-first/providers/code-review-graph/status.json
.spec-first/providers/code-review-graph/normalized/impact-capabilities.json
```

最低条件：

- 当前 `HEAD` 与 `graph-facts.source_revision` 一致，或明确降级为 advisory。
- 当前 dirty 状态和 `worktree_status_hash` 与 artifact 一致。
- provider `status=ready`。
- provider `query_ready=true`。
- `graph-facts.capabilities.impact_context=true`。
- `bootstrap-impact-capabilities.capabilities.impact_radius.support_level=full`，或明确 fallback。

### 刷新 readiness

```bash
bash skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh
```

### 尝试 clean single-repo incremental

```bash
bash skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh --incremental
```

### 升级 provider

1. 修改 `skills/spec-mcp-setup/mcp-tools.json` 的 `code-review-graph` `version`。
2. 同步 setup / graph-bootstrap / PowerShell parity tests。
3. 运行 `$spec-mcp-setup`。
4. 运行 `$spec-graph-bootstrap`。
5. 再让 downstream workflows 消费新 artifacts。

### 普通 workflow 中禁止

不要在 plan/work/review/debug 中静默执行：

- `code-review-graph build`
- `code-review-graph update`
- 删除 `.code-review-graph/`
- 删除 `.spec-first/providers/code-review-graph/`
- 删除 `.spec-first/impact/*`
- provider repair
- watcher / daemon / hooks 自动刷新
- 把 CRG risk signal 直接写成 final finding
- 把 CRG 包装成默认 reviewer agent

## 设计判断

`code-review-graph` 的价值在于给 code review / pre-merge 节点提供低噪音影响面事实，而不是替代 reviewer 或扩散成 plan/work/debug 的全局图谱。

正确心智模型：

```text
code-review-graph 看当前变更影响，聚焦 $spec-code-review。
spec-first 编译并治理 readiness。
plan/work/debug 使用 GitNexus 或直接证据；work 只消费 review handoff 摘要。
LLM / reviewer synthesis 决定最终结论。
```

这符合本仓库的核心边界：

- Scripts prepare：setup 和 bootstrap 产出 package pin、command arrays、readiness、raw log pointer、reason_code。
- LLM decides：workflow 判断证据是否相关，是否需要 fallback，是否足以支撑 finding。
- Light contract：canonical artifacts 只承载 readiness 和 capability envelope，不泄漏 provider 内部实现。
- Explicit boundaries：CLI artifact provider、optional live MCP、canonical readiness、provider storage、review evidence 各有 owner。
