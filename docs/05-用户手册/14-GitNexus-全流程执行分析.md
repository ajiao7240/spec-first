# GitNexus 全流程执行分析

本文基于当前仓库源码，说明 GitNexus 在 spec-first 中从安装、配置、生成、使用、更新到修复的完整执行链路。

结论先行：

```text
spec-first init        生成 host 入口与项目治理提示
$spec-mcp-setup       安装/配置 MCP 与 helper runtime，写 setup-owned projection
$spec-graph-bootstrap 运行 GitNexus provider commands，写 canonical graph readiness
downstream workflows  读取 readiness / session-local evidence，由 LLM 判断是否使用
```

GitNexus 在本项目中不是独立的“搜索插件”，而是 `Codebase -> Graph -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge` 链路中的 global knowledge provider。它提供代码图谱、symbol/context、execution flow、impact、route/API evidence、workspace registry/group 等事实输入；spec-first 负责把这些输入治理成可验证、可降级、可复用的工程证据闭环。

## 分析范围

本文覆盖：

- GitNexus 如何被声明、安装、写入 host MCP 配置。
- setup 阶段如何生成 `.spec-first/config/*` 投影。
- graph bootstrap 阶段如何运行 `analyze` / `status` / `query` 并生成 readiness artifacts。
- 下游 plan/work/review/debug 如何消费 GitNexus 证据。
- 单仓、多仓 workspace、incremental、stale、dirty、repair、mutation-gated capability 的边界。
- 当前 `spec-first` 仓库中的实际 artifact 状态。

本文不覆盖：

- GitNexus provider 内部索引算法。
- GitNexus npm 包自身的实现细节。
- code-review-graph 的完整流程。本文只在对比边界处提到它。
- 用户手动使用 GitNexus MCP tool 的完整操作教程。

## Source Of Truth

GitNexus 流程的 source-of-truth 分散在以下文件中：

| 领域 | Source |
| --- | --- |
| MCP/tool registry 与 GitNexus package pin | `skills/spec-mcp-setup/mcp-tools.json` |
| setup projection writer | `skills/spec-mcp-setup/scripts/write-provider-config.sh` |
| graph bootstrap workflow contract | `skills/spec-graph-bootstrap/SKILL.md` |
| graph bootstrap implementation | `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh` |
| workspace GitNexus readiness compiler | `src/cli/helpers/compile-workspace-gitnexus-readiness.js` |
| GitNexus host instruction block | `src/cli/gitnexus-instruction-block.js` |
| init 入口与 next steps | `src/cli/commands/init.js` |
| graph evidence 政策 | `docs/contracts/graph-evidence-policy.md` |
| graph artifact 消费契约 | `docs/contracts/graph-provider-consumption.md` |
| GitNexus capability catalog | `docs/contracts/gitnexus-capability-catalog.md` |
| workspace GitNexus 消费契约 | `docs/contracts/workspace-gitnexus-consumption.md` |
| downstream evidence 消费契约 | `docs/contracts/downstream-graph-evidence-consumption.md` |

Generated runtime assets 不是 source-of-truth：

```text
.claude/
.codex/
.agents/skills/
```

这些路径由 `spec-first init --claude|--codex` 从 source 重新生成。普通修复不能手改这些 runtime mirrors 来“刷新”GitNexus 行为。

## 总体生命周期

```text
1. init
   - 生成 AGENTS.md / CLAUDE.md managed blocks
   - 生成 host runtime assets
   - 写 .gitignore managed block，忽略本地图谱 artifacts

2. mcp setup
   - 根据 mcp-tools.json 安装/预热 GitNexus
   - 写 host MCP 配置
   - 生成 .spec-first/config/graph-providers.json
   - 生成 .spec-first/config/runtime-capabilities.json
   - 生成 .spec-first/config/provider-artifacts.json

3. graph bootstrap
   - 读取 setup-owned config
   - 校验 baseline、provider id、command array、query probe policy
   - 运行 GitNexus analyze/status/query
   - 写 .spec-first/providers/gitnexus/**
   - 写 .spec-first/graph/**
   - 写 .spec-first/impact/**

4. downstream consumption
   - plan/work/review/debug 读取 canonical artifacts
   - 可使用 live MCP 作为 session-local evidence
   - LLM 决定语义相关性、风险、scope 与 fallback

5. update / refresh / repair
   - package pin 或 source 改动先改 source
   - setup 重新投影配置
   - bootstrap 显式刷新 readiness
   - repair 必须 preview-first，不在普通 workflow 中静默执行
```

## 节点一：init

`spec-first init --claude|--codex` 不安装 GitNexus provider，也不运行 GitNexus 索引。它做的是 host/runtime 入口准备：

- 同步当前 host 的 runtime assets。
- 生成或更新 `AGENTS.md` / `CLAUDE.md` managed blocks。
- 调用 `normalizeGitNexusInstructionBlock` 维护 `<!-- gitnexus:start -->` block。
- 写入 `.gitignore` managed block，忽略 `.gitnexus/`、`.code-review-graph/`、`.spec-first/config/*.json`、`.spec-first/graph/`、`.spec-first/providers/`、`.spec-first/impact/`、`.spec-first/workspace/` 等本地 artifacts。
- 输出 next steps：重启宿主；需要增强 readiness 时先运行 `$spec-mcp-setup`，若 graph bootstrap pending 再运行 `$spec-graph-bootstrap`。

GitNexus instruction block 的作用是提醒 agent 使用前读取 readiness artifacts。单仓 block 指向：

```text
.spec-first/graph/graph-facts.json
.spec-first/graph/provider-status.json
.spec-first/providers/gitnexus/status.json
```

多仓 workspace block 指向：

```text
.spec-first/workspace/graph-targets.json
.spec-first/workspace/gitnexus-readiness.json
```

这个 block 是 host prose guidance，不是 readiness proof。它被更新或创建，不代表 GitNexus index 已经 fresh，也不代表 `query_ready=true`。

## 节点二：GitNexus 安装与 MCP 配置

GitNexus 的安装声明来自 `skills/spec-mcp-setup/mcp-tools.json`：

| 字段 | 当前值 |
| --- | --- |
| `id` | `gitnexus` |
| `required` | `true` |
| `category` | `graph-provider` |
| `provider_role` | `global_knowledge` |
| `package` | `gitnexus` |
| `version` | `1.6.5` |
| install warmup | `npx -y gitnexus@1.6.5 --help` |
| MCP command | `npx -y gitnexus@1.6.5 mcp` |
| `enabled_for_bootstrap` | `true` |
| `query_ready_after_setup` | `false` |

`$spec-mcp-setup` 负责：

- 检查 `node` / `npm` / `npx`。
- 通过 warmup 命令验证 GitNexus package 可运行。
- 将 GitNexus MCP server 写入 Claude 或 Codex host 配置。
- 写 host readiness ledger。
- 调用 provider writer 生成 setup-owned facts。

`$spec-mcp-setup` 明确不负责：

- 运行 `gitnexus analyze`。
- 运行 `gitnexus status`。
- 运行 `gitnexus query`。
- 删除或修复 `.gitnexus/`。
- 编译 canonical graph readiness。
- 判定当前代码图谱是否足够支撑 plan/review 的语义结论。

因此 setup 结束后，GitNexus capability 可能显示 `available`，同时项目 graph readiness 仍是 `not-bootstrapped`。这不是冲突：前者是 setup-inferred native surface 可发现，后者是 durable graph-backed evidence 尚未 ready。

## 节点三：setup projection 生成

`skills/spec-mcp-setup/scripts/write-provider-config.sh` 生成三类 setup-owned artifacts：

```text
.spec-first/config/graph-providers.json
.spec-first/config/runtime-capabilities.json
.spec-first/config/provider-artifacts.json
```

### graph-providers.json

这个文件声明 provider 配置、命令数组、query probe policy、capability projection 和 derived readiness。

GitNexus command arrays 当前由 package pin 生成：

```json
{
  "bootstrap": ["npx", "-y", "gitnexus@1.6.5", "analyze", "--force", "--skip-agents-md", "--no-stats"],
  "incremental": ["npx", "-y", "gitnexus@1.6.5", "analyze", "--skip-agents-md", "--no-stats"],
  "status": ["npx", "-y", "gitnexus@1.6.5", "status"],
  "query_probe": ["npx", "-y", "gitnexus@1.6.5", "query", "<probe-token>", "--repo", "<repo-name>"]
}
```

这些是 JSON array，不是 shell 字符串。`spec-graph-bootstrap` 后续按 array 执行，避免 shell interpolation。

GitNexus repo label 的解析顺序是：

1. setup facts 中显式字段，例如 `gitnexus_repo_name`。
2. `.gitnexus/meta.json` 的 remote URL。
3. 当前 Git remote URL。
4. repo basename fallback。

query probe policy 由 tracked source files 确定性生成。脚本优先选择 entrypoint、workflow、`src/**` 中高信号 symbol，最多保留有界候选；没有候选时退回静态 token，并标记 `expected_hit=false`。

### native capabilities projection

GitNexus checked-in baseline 当前包含这些 native capabilities：

| Capability | 典型 native tool/resource | Mutation boundary |
| --- | --- | --- |
| `query` | `query` | `read-only` |
| `context` | `context`, `gitnexus://repo/{name}/context` | `read-only` |
| `impact` | `impact`, `detect_changes`, process resources | `read-only` |
| `route_api_evidence` | `route_map`, `api_impact` | `read-only` |
| `shape_check` | `shape_check` | `read-only` |
| `cypher` | `cypher`, `gitnexus://repo/{name}/schema` | `read-only` |
| `tool_map` | `tool_map` | `read-only` |
| `repo_registry` | `list_repos`, `gitnexus://repos` | `read-only` |
| `workspace_group` | `group_list`, group resources | `read-only` |

writer 对 baseline 做 fail-closed 校验：

- `meaning`、`fallback_posture`、`mutation_boundary` 必须存在。
- `native_tools[]` 和 `native_resources[]` 必须是数组。
- `source_tags[]` 只能来自 registry baseline：`checked-in-baseline`、`provider-pin`。
- setup projection 只能追加 `setup-projection`。
- setup 不得写 `live-mcp-tool`、`live-mcp-resource`、`session-local-inference` 或 `user-decision`。
- `policy-blocked` 会映射为 `mutation-gated` 可用性，不会被误写为 read-only。

### runtime-capabilities.json

这个文件是 setup-owned runtime 摘要。它可以包含：

- `baseline_summary`
- `fallback_tools`
- `fallback_capabilities`
- `project_graph_readiness`
- `gitnexus_capability_discovery`

这里的 `project_graph_readiness` 是投影摘要，只指向 canonical artifacts，不是 canonical readiness truth。下游判断仍以 `.spec-first/graph/provider-status.json`、`.spec-first/graph/graph-facts.json` 和 `.spec-first/impact/bootstrap-impact-capabilities.json` 为准。

### provider-artifacts.json

这个文件声明 provider raw、normalized、status、canonical graph/impact artifact 路径。它帮助 bootstrap 和 consumer 找到 artifacts，但不代表这些 artifacts 已经 fresh 或 query-ready。

## 节点四：graph bootstrap 生成

`$spec-graph-bootstrap` 是默认本地 workflow 中唯一可以刷新 canonical graph readiness artifacts 的入口。

它读取：

```text
.spec-first/config/runtime-capabilities.json
host readiness ledger v2
.spec-first/config/graph-providers.json
.spec-first/config/provider-artifacts.json
```

它写入：

```text
.spec-first/providers/gitnexus/raw/**
.spec-first/providers/gitnexus/normalized/**
.spec-first/providers/gitnexus/status.json
.spec-first/graph/provider-status.json
.spec-first/graph/graph-facts.json
.spec-first/graph/bootstrap-report.md
.spec-first/impact/bootstrap-impact-capabilities.json
```

执行顺序：

1. 解析 repo scope。单仓直接处理当前 repo；父 workspace 默认 all-child maintenance，或通过 `--repo <child>` 收窄。
2. 校验 setup-owned input schema 与 host ledger，`baseline_ready=false` 时 fail closed。
3. 校验 provider id 只能是 `gitnexus` 或 `code-review-graph`。
4. 校验 command arrays 和 GitNexus query probe policy shape。
5. 根据 refresh mode 决定 full 或 incremental。
6. 运行 GitNexus bootstrap 命令。
7. bootstrap 成功后运行 GitNexus status。
8. status 成功后运行 bounded query probe。
9. 根据 query probe 结果分类 `query_ready`。
10. 写 provider status、aggregate provider status、graph facts、impact capabilities、bootstrap report。

### GitNexus bootstrap 命令

默认 full refresh：

```bash
npx -y gitnexus@1.6.5 analyze --force --skip-agents-md --no-stats
```

显式 incremental 可能使用：

```bash
npx -y gitnexus@1.6.5 analyze --skip-agents-md --no-stats
```

status：

```bash
npx -y gitnexus@1.6.5 status
```

query probe：

```bash
npx -y gitnexus@1.6.5 query <probe-token> --repo <repo-name>
```

这些命令都来自 `.spec-first/config/graph-providers.json`，bootstrap 会校验 shape。普通 plan/work/review/debug 不得静默运行这些命令。

### query proof 分类

GitNexus query probe 不是“随便查一下”。bootstrap 会根据日志和 JSON 结果分类：

| Result class | 含义 | 下游处理 |
| --- | --- | --- |
| `process-results` | 返回 process 或 process_symbols | 可支持 `query_ready=true` |
| `definitions-only` | 只有 definitions，没有 process/BM25 结果 | 只能作为 file/symbol pointer |
| `diagnostic` | 出现 FTS/read-only/missing-index 等诊断 | query-unverified / failure reason |
| `empty-or-unparseable` | 没有可解析有效结果 | query-unverified |
| `command-failed` | query 命令失败 | query-unverified |

如果第一个 candidate 是 `definitions-only`，bootstrap 会继续尝试有界候选，直到拿到 `process-results` 或候选耗尽。

### provider status

`.spec-first/providers/gitnexus/status.json` 是 GitNexus provider 级诊断。关键字段包括：

- `status`
- `graph_ready`
- `query_ready`
- `readiness_source`
- `refresh_mode`
- `fallback_from_incremental`
- `last_indexed_commit`
- `requires_clean_full_refresh`
- `reason_code`
- `failure_class`
- `recommended_action`
- `limitations[]`
- `query_probe_policy`
- `query_probe_attempts[]`
- `raw_logs`
- `normalized_artifacts`

不要用文件存在来判断 GitNexus ready。必须看 `status=ready && query_ready=true`，并结合 freshness。

### aggregate graph artifacts

`.spec-first/graph/provider-status.json` 聚合所有 primary providers：

- `workflow_mode`
- `ready_primary_providers[]`
- `failed_primary_providers[]`
- `partial_primary_available`
- `providers[]`

`.spec-first/graph/graph-facts.json` 是项目级 graph facts：

- `workflow_mode`
- `provider_summary`
- `capabilities.query_global_graph`
- `capabilities.impact_context`
- `source_revision`
- `worktree_dirty`
- `worktree_status_hash`
- `dirty_classification`
- `freshness_state`
- `limitations[]`

`.spec-first/impact/bootstrap-impact-capabilities.json` 是 context selection、impact radius、review support 的 readiness envelope。它只说明能力支持级别，不替 reviewer 或 LLM 判断当前任务是否真的需要这些证据。

### normalized GitNexus artifacts

GitNexus normalized artifacts 当前包括：

```text
.spec-first/providers/gitnexus/normalized/architecture-facts.json
.spec-first/providers/gitnexus/normalized/reuse-candidates.json
```

下游应从 provider status 的 `normalized_artifacts` 指针进入，不应读取旧路径如 `.spec-first/graph/architecture-facts.json` 或 `.spec-first/graph/reuse-candidates.json`。

### host instruction normalization

GitNexus bootstrap 成功后，脚本可以调用 source CLI 收敛 `AGENTS.md` / `CLAUDE.md` 的 GitNexus instruction block。

这是 advisory host prose cleanup：

- 不影响 `graph_ready`。
- 不影响 `query_ready`。
- 不替代 query proof。
- 会作为 `host_instruction_normalization` 写入 provider status。

## 节点五：更新与刷新

GitNexus 更新有三类，不应混在一起。

### 1. 更新 spec-first runtime assets

当 source skill、agent、template 或 host 入口发生变化时：

```bash
spec-first init --codex
spec-first init --claude
```

这会重新生成 host runtime mirrors。它不运行 GitNexus analyze，也不刷新 graph readiness。

### 2. 更新 GitNexus package pin 或 capability baseline

GitNexus package 版本当前写在 `skills/spec-mcp-setup/mcp-tools.json` 的 `version` 字段。升级时应按 source-first 顺序：

1. 修改 `mcp-tools.json` package pin、capability baseline 或 host config 声明。
2. 同步相关 contract/docs/tests。
3. 运行 `$spec-mcp-setup` 或底层 setup tests，重新生成 `.spec-first/config/*` projection。
4. 再运行 `$spec-graph-bootstrap` 重新编译 canonical readiness。

bootstrap 会检查 provider projection / package identity / fingerprint。投影 stale 或 package 不可验证时，不会继续信任旧 provider commands。

### 3. 刷新当前代码图谱 readiness

当分支切换、pull、rebase、merge、dirty worktree 变化、provider fingerprint mismatch 或 `source_revision` 不一致时，下游 workflow 应把它视为 freshness invalidation signal。

这不等于普通 workflow 自动 rebuild。正确路径是显式运行：

```bash
bash skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh
```

或通过当前 host 的 `$spec-graph-bootstrap` / `/spec:graph-bootstrap` 入口运行。

clean single-repo 可以显式尝试：

```bash
bash skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh --incremental
```

但当前 contract 把 incremental 定义为 clean single-repo diagnostic / validation-only expert mode。它不是已经证明 correctness-backed 的加速路径。`--all-repos --incremental` 不支持，会以 `reason_code=incremental-all-repos-unsupported` 在运行 provider commands 前退出。

## 节点六：dirty / stale / degraded 处理

freshness 判断不能只看 provider 是否 ready。下游 consumer 至少要比较：

- `.spec-first/graph/graph-facts.json.source_revision` 是否等于当前 `HEAD`。
- `worktree_dirty` 是否与当前工作树一致。
- `worktree_status_hash` 是否与当前 dirty hash 一致。
- provider `query_ready` 是否为 true。
- provider projection / fingerprint 是否 fresh。

dirty classification 的关键值：

| 值 | 含义 | 下游行为 |
| --- | --- | --- |
| `clean` | 当前 worktree clean | 可作为 fresh 候选 |
| `setup-owned-only` | dirty 只在 setup-owned runtime/readiness 路径 | 仍比较 status hash |
| `non-graph-only` | dirty 只在窄元数据豁免，例如 `CHANGELOG.md` | 仍比较 status hash |
| `graph-affecting-blocked` | dirty 命中会影响 graph 的路径 | bootstrap warn-and-continue，写 `freshness_state=dirty-advisory` |

`dirty-advisory` 不代表不可用，但它不是 fresh primary evidence。下游必须把它标记为 advisory，并用当前源码直接读取或测试验证关键结论。

stale 或 degraded 的常见策略：

- docs-only、窄 typo、小型本地 bug：披露限制，继续 bounded direct reads。
- shared helper、API、route、provider contract、核心 workflow、跨模块变更、依赖 execution flow 或 blast radius 的 review：建议先运行 `$spec-graph-bootstrap`，刷新前不要声称 primary graph-backed impact evidence。
- definitions-only GitNexus：只作为 file/symbol pointer。
- query-unverified/unavailable：降级到源码读取、ast-grep、git diff、code-review-graph 或其他 confirmed evidence。

## 节点七：下游 workflow 如何使用 GitNexus

### spec-plan

`$spec-plan` 是主要 graph readiness consumer。它可以读取：

- canonical graph artifacts。
- setup-owned projection pointers。
- workspace advisory facts。
- session-local GitNexus MCP evidence。

当使用 GitNexus 证据时，plan 输出 `## Graph / GitNexus Evidence` envelope。这个 envelope 是 plan 层证据摘要，不是新的 readiness artifact。它必须区分四个 axis：

```text
capability_status = available | partial | unavailable | mutation-gated
evidence_grade    = primary | session-local | advisory | stale
evidence_posture  = primary | fallback
freshness_state   = fresh | stale | dirty-advisory | query-unverified
```

Plan 不得运行 setup、bootstrap、provider refresh 或 GitNexus analyze。它可以推荐 `$spec-graph-bootstrap`。

### spec-work

`$spec-work` 消费 plan/task pack 中的 GitNexus evidence，用于：

- 缩小 source reads。
- 辅助 test selection。
- 识别 risk / follow-up。
- 在 closeout 或 run artifact 中记录 `graph_evidence_used`。

它不得用 GitNexus 发现的额外 repo、route、symbol、flow 自动扩大 implementation scope。scope authority 仍来自用户请求、plan/task pack、当前 diff 和明确 target repo。

### spec-code-review

`$spec-code-review` 使用 GitNexus 的方式是 review evidence preflight：

- fresh 或 session-local evidence 可帮助选择 `api_impact`、`shape_check`、`tool_map` 等 native capability。
- stale、advisory、definitions-only、unavailable 只能作为 pointer 或 limitation。
- 每条 finding 必须由 diff/source/test/contract evidence 确认，不能只凭 GitNexus 输出成立。
- provider degraded 时按 degraded-once rule 在 Coverage 里记录一次，不让每个 reviewer 重复探测。

### spec-debug

`$spec-debug` 可在 hypothesis ledger 中记录 GitNexus 对假设的贡献，但 root cause 不能只由 graph evidence 关闭。根因必须由 reproduction、source、log、test 或 schema/contract check 这类 non-graph evidence 确认。

### spec-doc-review

docs-only review 可在 stale graph 下继续 bounded direct reads。若文档审查结论依赖 execution flow、shared provider contract、cross-module blast radius 或 high-risk graph-heavy 证据，应先建议 `$spec-graph-bootstrap`。

## 节点八：live MCP 使用边界

当前会话如果加载了 GitNexus MCP，可以使用以下 read-only tools 或 resources 辅助理解：

- `query`
- `context`
- `impact`
- `detect_changes`
- `route_map`
- `api_impact`
- `shape_check`
- `cypher`
- `tool_map`
- `list_repos`
- `group_list`
- `gitnexus://repo/{name}/context`
- `gitnexus://repo/{name}/schema`
- `gitnexus://repo/{name}/processes`
- `gitnexus://repo/{name}/process/{processName}`
- `gitnexus://repos`
- `gitnexus://group/{name}/contracts`
- `gitnexus://group/{name}/status`

live MCP 成功只算 `session-local` evidence：

- 不能回写 `.spec-first/graph/*`。
- 不能把 setup projection 的 `query_ready` 改成 true。
- 不能替代 current source reads。
- 不能扩大 plan/work/review scope。
- 与源码、测试或 canonical readiness 冲突时，优先采用已验证事实。

Mutation-capable surfaces，例如 `group_sync`、`rename`、`symbol_rename`，属于 `mutation-gated`。普通 plan/work/review/debug 不得自动执行。用户明确要求维护动作时，必须走 preview-first、明确 scope、execute、verify、recover 的独立闭环。

## 节点九：多仓 workspace

多仓 workspace 指父目录包含多个独立 child Git repos。单仓多 module 不属于 GitNexus group。

父 workspace 只拥有 advisory control-plane artifacts：

```text
.spec-first/workspace/graph-bootstrap-summary.json
.spec-first/workspace/graph-targets.json
.spec-first/workspace/gitnexus-readiness.json
```

child repo 仍拥有自己的 canonical artifacts：

```text
<child>/.spec-first/graph/*
<child>/.spec-first/providers/*
<child>/.spec-first/impact/*
```

`workspace-gitnexus-readiness.v1` 区分：

| 字段 | 含义 |
| --- | --- |
| `refresh_eligibility` | child 是否适合刷新 |
| `index_snapshot` | child index 当前快照状态 |
| `query_usability` | 当前 read-only query 可用性 |
| `group.status` | group-ready / group-missing / group-sync-required / unavailable / not-evaluated-no-mcp-input |

脚本模式不能接收 live `list_repos` / `group_list` 输入，也不能把 live MCP overlay 写入 durable artifact。skill-prose mode 可以使用 registry/group snapshot 做 session-local overlay，但不能持久化。

多仓写入、测试、review autofix 或 commit 前必须明确 `target_repo` 或 per-child scope。GitNexus group evidence 只能帮助只读定向，不授予跨 repo 修改权限。

## 节点十：repair 与失败模式

常见失败模式：

| 失败 | 典型 reason | 正确处理 |
| --- | --- | --- |
| setup baseline 未 ready | `baseline_not_ready` | 修复 MCP/helper setup，重跑 `$spec-mcp-setup` |
| provider command shape 不支持 | `unsupported-provider-command` | 修 source projection 或 package pin，不手改 generated config |
| projection stale | projection/fingerprint stale | 重跑 setup projection，再 bootstrap |
| bootstrap 命令失败 | provider-specific failure | 查看 provider status / raw log 摘要，按 recommended action 修复 |
| query proof 失败 | query-unverified / diagnostic | 降级使用 direct reads，必要时 repair GitNexus storage |
| repo label mismatch | GitNexus repo 名不匹配 | 修 repo label source，重跑 setup/bootstrap |
| dirty/stale | source revision/hash mismatch | 作为 advisory，必要时显式 graph bootstrap |
| all-repos incremental | `incremental-all-repos-unsupported` | 改跑 all-repos full 或单个 child incremental |

GitNexus repair 必须 preview-first。删除 `.gitnexus/`、provider raw artifacts 或 canonical readiness artifacts 都是显式恢复动作，不能被普通 plan/work/review/debug 隐藏执行。

## Artifacts 与 ownership

| Path | Producer | Ownership | Consumer |
| --- | --- | --- | --- |
| `skills/spec-mcp-setup/mcp-tools.json` | source | GitNexus package pin / capability baseline | setup writer / tests / docs |
| `.spec-first/config/graph-providers.json` | `$spec-mcp-setup` | setup-owned projection | `$spec-graph-bootstrap`, downstream pointer |
| `.spec-first/config/runtime-capabilities.json` | `$spec-mcp-setup` | setup-owned runtime summary | bootstrap / plan pointer |
| `.spec-first/config/provider-artifacts.json` | `$spec-mcp-setup` | artifact path contract | bootstrap |
| `.gitnexus/` | GitNexus provider | provider local storage | GitNexus CLI/MCP |
| `.spec-first/providers/gitnexus/raw/*` | `$spec-graph-bootstrap` | bounded raw logs | diagnostics only |
| `.spec-first/providers/gitnexus/status.json` | `$spec-graph-bootstrap` | provider-level readiness/diagnostics | downstream diagnostics |
| `.spec-first/providers/gitnexus/normalized/*` | `$spec-graph-bootstrap` provider adapter | normalized provider facts | downstream via pointers |
| `.spec-first/graph/provider-status.json` | `$spec-graph-bootstrap` | aggregate provider readiness | plan/work/review/debug |
| `.spec-first/graph/graph-facts.json` | `$spec-graph-bootstrap` | canonical graph freshness/capabilities | plan/work/review/debug |
| `.spec-first/impact/bootstrap-impact-capabilities.json` | `$spec-graph-bootstrap` | impact/context/review support envelope | plan/work/review/debug |
| `.spec-first/workspace/*` | parent workspace bootstrap/resolver | advisory workspace facts | read-only routing |
| `AGENTS.md` / `CLAUDE.md` GitNexus block | init/bootstrap normalizer | host guidance source slice | agents/users |

## 当前仓库快照

本次分析以源码直接读取为 primary evidence，并已在升级 `gitnexus@1.6.5` 后重新运行 setup projection 与 graph bootstrap。当前 compiled graph artifacts 可作为 `dirty-advisory` readiness evidence，但不能当作 clean-HEAD fresh evidence：

- 当前 `HEAD`：`314115815864544f749030d23fa78a6f87a80c19`
- `.spec-first/graph/graph-facts.json.source_revision`：`314115815864544f749030d23fa78a6f87a80c19`
- `.spec-first/graph/graph-facts.json.freshness_state`：`dirty-advisory`
- `.spec-first/graph/graph-facts.json.worktree_dirty`：`true`
- `.spec-first/graph/graph-facts.json.dirty_classification`：`graph-affecting-blocked`
- `.spec-first/graph/provider-status.json.workflow_mode`：`primary`
- GitNexus provider status：`status=ready`、`graph_ready=true`、`query_ready=true`
- GitNexus query probe：第一个 candidate `parseCleanArgs` 为 `definitions-only`，第二个 `validateClaudeSettingsFile` 返回 `process-results`
- 本地 cache 恢复：升级验证中曾触发连续 analyze native error，已通过 `npx -y gitnexus@1.6.5 clean --force` 清理 `.gitnexus` 并重建

这说明 GitNexus provider 已用当前磁盘状态 query-ready，但 compiled artifact 仍被当前 dirty worktree 降级为 `dirty-advisory`。下游 workflow 可以把它作为当前会话的 graph evidence 起点，但需要继续用源码、diff 和测试结果验证关键结论。

## 最小操作手册

### 首次安装

```bash
spec-first init --codex
# 或
spec-first init --claude
```

重启宿主后运行：

```text
$spec-mcp-setup
$spec-graph-bootstrap
```

Claude host 对应 `/spec:mcp-setup` 和 `/spec:graph-bootstrap`。

### 判断是否可用

先读：

```text
.spec-first/graph/graph-facts.json
.spec-first/graph/provider-status.json
.spec-first/providers/gitnexus/status.json
```

可作为 fresh primary graph evidence 的最低条件：

- 当前 `HEAD` 与 `graph-facts.source_revision` 一致。
- 当前 dirty 状态和 `worktree_status_hash` 与 artifact 一致。
- GitNexus provider `status=ready`。
- GitNexus provider `query_ready=true`。
- `freshness_state=fresh`，或 dirty-advisory 已明确降级并完成源码验证。

### 刷新 readiness

```bash
bash skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh
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

### 升级 GitNexus 版本

1. 修改 `skills/spec-mcp-setup/mcp-tools.json` 的 `version` 与相关 capability baseline。
2. 更新 contracts/docs/tests。
3. 运行 focused setup projection tests。
4. 运行 `$spec-mcp-setup`。
5. 运行 `$spec-graph-bootstrap`。
6. 下游 workflow 重新读取 canonical artifacts。

### 普通 workflow 中的禁止动作

不要在 plan/work/review/debug 中静默执行：

- `gitnexus analyze`
- GitNexus provider repair
- 删除 `.gitnexus/`
- 删除 `.spec-first/graph/*`
- 删除 `.spec-first/providers/*`
- `group_sync`
- GitNexus `rename`
- hook / watcher / daemon 自动刷新
- 手改 `.claude/`、`.codex/`、`.agents/skills/`

## 设计判断

GitNexus 流程的关键不是“尽量自动刷新图谱”，而是保持边界：

- Scripts prepare：setup 和 bootstrap 产出 deterministic facts、artifact path、reason_code、exit code、raw log pointer。
- LLM decides：plan/work/review/debug 判断证据是否与当前任务相关，是否需要 fallback，是否需要刷新，是否构成 finding 或 root cause。
- Light contract：artifact schema 只承载必要 readiness 与 provenance，不把 provider 内部细节泄露给所有 consumer。
- Explicit boundaries：setup projection、canonical graph readiness、session-local live MCP、workspace advisory facts、generated runtime mirrors 各自有独立 owner。

因此，GitNexus 在 spec-first 中的正确心智模型是：

```text
GitNexus 提供全局代码知识。
spec-first 编译并治理证据生命周期。
downstream workflow 消费证据但不扩大 scope。
最终工程结论仍由源码、测试、契约和 LLM 判断共同确认。
```
