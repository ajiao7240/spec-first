# 代码图谱 Provider 作用域与差异化

本文说明 spec-first 中 `GitNexus` 与 `code-review-graph` 的分工，以及这套设计为什么构成项目对标业界 AI coding 工具时的核心差异化。

结论先行：

```text
GitNexus = 全局代码知识、架构关系、execution flow、symbol impact、reuse / navigation
code-review-graph = 当前变更的 review evidence、impact radius、minimal context、related tests、risk signal
spec-first = 把这些 provider 治理成可验证、可降级、可复用的工程闭环
```

核心竞争力不是“接入了两个代码图谱工具”。真正的差异化是：spec-first 把外部图谱能力放进 `Codebase -> Graph -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge` 链路里，并为它们定义 source/runtime 边界、readiness facts、freshness 检查、degraded mode、artifact contract 和 downstream consumer 规则。

## 为什么这是差异化

很多 AI coding 工具或插件的图谱能力停留在三种形态：

- 把图谱工具当成一个更强的搜索工具。
- 把代码审查做成一个更长的 prompt。
- 通过 hooks 或常驻 MCP 让图谱尽量保持最新，但缺少明确的 artifact、freshness 和 fallback 边界。

spec-first 的差异化在于把图谱能力纳入 workflow governance：

- **不是 prompt collection**：图谱能力服务 spec、plan、work、review 和 knowledge 的上下文传递。
- **不是 provider lock-in**：GitNexus、code-review-graph、Serena、ast-grep 和 bounded direct reads 都是 evidence source，各自有边界。
- **不是隐式自动化**：setup 只准备 provider config，graph-bootstrap 编译 readiness facts，下游 workflow 再决定是否使用。
- **不是把工具结果当结论**：provider 输出是 evidence，reviewer / LLM 才负责语义判断。
- **不是只看当前 diff**：review 可以结合全局代码知识和变更影响半径。
- **不是无边界全局状态**：`.spec-first/graph/*`、`.spec-first/impact/*` 和 `.spec-first/providers/*` 都是可重建 control-plane artifacts。

这让 spec-first 相比单点 AI review 插件更接近工程系统：它不仅让 AI “看得更多”，还让 AI 知道哪些证据可信、哪些证据过期、哪些证据只能作为提示。

## GitNexus 作用域

GitNexus 在 spec-first 中的角色是 `global_knowledge`。

它适合回答：

- 这个项目有哪些模块、入口、执行链路和功能社区？
- 某个 function / class / method 在哪里定义，谁调用它，它又调用谁？
- 某个 symbol 参与哪些 execution flow？
- 一个计划或需求可能影响哪些模块？
- 某个共享能力是否已有复用点？
- 多仓 workspace 下，哪些 child repo 可能与问题相关？

GitNexus 更靠近链路前半段：

```text
Codebase -> Graph -> Spec -> Plan -> Tasks -> Code
```

它帮助 LLM 形成全局代码认知，避免只靠关键词搜索或局部文件阅读来做计划、调试和实现判断。

GitNexus 不应该承担：

- 替用户决定需求范围。
- 替 reviewer 判断 finding 是否成立。
- 把 HIGH / CRITICAL impact 变成不可解释的硬阻断。
- 把 live MCP 调用结果反写成 compiled graph readiness。
- 隐式改写 `AGENTS.md`、`CLAUDE.md` 或 generated runtime assets。

如果 GitNexus 只返回 definitions-only 证据，下游 workflow 只能把它当作 file/symbol pointer，不能把它当成完整 execution-flow evidence。

### Capability catalog 与 provenance

GitNexus capability catalog 是 checked-in baseline，不是 readiness truth。它列出 capability 语义、candidate `native_tools[]`、candidate read-only `native_resources[]`、mutation boundary 和 fallback posture，并用 `source_tags[]` 区分 `checked-in-baseline`、`provider-pin`、`setup-projection`、`live-mcp-tool`、`live-mcp-resource`、`session-local-inference` 与 `user-decision`。

`spec-mcp-setup` 只能投影 setup-inferred availability/discovery facts；`$spec-plan` 需要在当前 session 复核 tool/resource surface 后，才能把某个 GitNexus tool 或 read-only resource 写成 live evidence。资源如 `gitnexus://repo/{name}/schema`、`gitnexus://repo/{name}/processes` 或 `gitnexus://group/{name}/status` 是 evidence surface，不等于执行能力，也不替代源码读取和 freshness limitations。

### 多仓 workspace group readiness

GitNexus group readiness 只适用于父目录下多个独立 Git repos 的 `multi-repo-workspace` 拓扑。单仓多 module 仍是 repo-local graph scope，不因为包含多个 packages/modules 就成为 GitNexus group。

父 workspace 的 `.spec-first/workspace/gitnexus-readiness.json` 是 `workspace-gitnexus-readiness.v1` advisory artifact：

- `group.status="group-ready"`：优先使用 GitNexus group query 做只读跨仓定向。
- `group.status="group-missing"`：使用 bounded registry/per-repo fan-out fallback；这不是 provider failure。
- `group.status="not-evaluated-no-mcp-input"`：durable script run 没有 live MCP overlay；下游 workflow 应披露限制，或在当前 session 读取 live registry/group facts。

普通 plan/work/debug/review 不得静默运行 `group_sync`，也不得把 live `list_repos` / `group_list` 结果写回 durable readiness。dirty-advisory 或 stale GitNexus evidence 不等于 query 完全不可用；但涉及当前源码或测试事实的结论必须用当前源码直接验证。

## code-review-graph 作用域

`code-review-graph` 在 spec-first 中的角色是 `impact_context`。

它适合回答：

- 当前 diff 改了哪些 symbol？
- 这些改动影响哪些 callers、flows 或测试？
- review 前应该优先看哪些上下文？
- 这次变更的 impact radius 是什么？
- 哪些 related tests 可能需要运行？
- review 是否需要从 minimal context 升级到更深影响分析？

`code-review-graph` 更靠近链路后半段：

```text
Code -> Review -> Knowledge
```

它不是全局架构判断者，而是 review evidence provider。它最有价值的使用方式是 minimal-first：

```text
get_minimal_context
  -> detect_changes(detail_level=minimal)
  -> high-risk or uncertainty only: get_impact_radius / get_review_context / tests_for / callers_of
```

`code-review-graph` 不应该承担：

- `code-review-graph` 本身作为 reviewer agent 加入 persona 队列。
- 替代 `spec-code-review` 的 synthesis。
- 单独决定 finding severity、autofix class 或 release gate。
- 默认通过 hooks 在每次编辑后修改 graph state。
- 默认安装 live `code-review-graph serve` host MCP。
- 承担 GitNexus 的全局 architecture / execution-flow discovery 职责。

## 两者如何配合

两者都会涉及 graph、call relation 和 impact，但粒度不同。

| 维度 | GitNexus | code-review-graph |
| --- | --- | --- |
| 项目角色 | `global_knowledge` | `impact_context` |
| 主要问题 | 这个代码库怎么工作？ | 这次改动影响什么？ |
| 主要阶段 | plan / work / debug / architecture orientation | code-review / pre-merge / diff impact |
| 证据粒度 | symbol、process、module、flow、architecture | diff、changed symbols、impact radius、related tests |
| 默认接入 | required live MCP + graph provider | required CLI artifact provider，live MCP optional |
| 主要产物 | `.spec-first/graph/*`、live session evidence | `.spec-first/impact/*`、review evidence |
| 是否做最终判断 | 否 | 否 |

推荐心智模型：

```text
GitNexus 看全局结构。
code-review-graph 看当前变更。
spec-first 管 evidence lifecycle。
LLM / reviewers 做语义判断。
```

## 在 spec-code-review 中的边界

当前版本的 `spec-code-review` 已经把 `code-review-graph` 作为 review orientation / fallback evidence source，但还没有把它完整产品化为默认 evidence preflight。

推荐演进方向是新增 `Graph / Impact Evidence Preflight`：

```text
spec-code-review
  Stage 1: diff scope
  Stage 1.5: graph / impact evidence preflight
    - read .spec-first/graph/graph-facts.json
    - read .spec-first/impact/bootstrap-impact-capabilities.json
    - classify evidence as fresh / stale / degraded / unavailable
    - if live CRG MCP is available, run bounded read-only minimal-first probes
    - produce <graph-review-context>
  Stage 3/4: reviewer personas consume diff + graph-review-context
    - evaluate whether spec-graph-impact-reviewer should run
    - dispatch it only when graph evidence shows meaningful blast-radius risk
  Stage 6: synthesis reports findings and evidence limitations
```

这个设计故意不把 `code-review-graph` 包装成 agent。原因是：agent 应该负责语义审查，provider 应该负责事实准备。把 provider 包成 agent 会让 CRG risk signal 看起来像 review conclusion，反而破坏 `Scripts prepare, LLM decides` 的边界。

### graph-impact reviewer

`spec-graph-impact-reviewer` 是建议新增的条件触发 reviewer。它不是 `code-review-graph` 的包装层，而是消费 `<graph-review-context>` 的图谱影响面审查专家。

它回答的问题是：

```text
这次 diff 改到的 symbol / file / API / flow，会不会影响调用者、执行流、相关测试或下游模块？
```

计划落地后的默认行为：

- `$spec-code-review` 将默认执行 graph / impact evidence preflight。
- `$spec-code-review` 将默认评估是否需要 `spec-graph-impact-reviewer`。
- `spec-graph-impact-reviewer` 不是 always-on reviewer，不是每次 review 都派发。
- 只有 graph evidence 显示 medium/high risk、多 callers、多 affected flows、related tests gaps、public/shared symbol change、inheritance / implementation 影响、rename / move 风险时，才条件触发。

它可以帮助发现：

- 改动本身看起来正确，但 impacted caller 仍按旧签名、旧返回值或旧错误语义调用。
- 某个 affected flow 经过 changed symbol，但 review 没有覆盖该用户路径。
- `tests_for` 或 related tests 显示关键 changed function 缺少覆盖。
- 公共工具、exported API、继承关系或移动/重命名造成 downstream 使用点遗漏。

它不能做：

- 运行 `code-review-graph build`、`update` 或 `build_or_update_graph`。
- 调用 CRG 自带 `/review-delta`、`/review-pr` 或 MCP prompt 来替代 `$spec-code-review`。
- 只凭 CRG risk score 生成 finding。
- 在 graph stale / degraded 时制造高置信 finding。

它的 finding 仍进入 `spec-code-review` 现有 merge / dedup / confidence gate，由 synthesis 统一决定 severity、routing 和 verdict。

相关计划见：

- `docs/plans/2026-05-07-003-feat-code-review-graph-evidence-preflight-plan.md`

## 产物边界

图谱相关产物都是 control-plane evidence，不是长期手工维护文档。

| 路径 | 生成者 | 作用 |
| --- | --- | --- |
| `.spec-first/config/graph-providers.json` | `spec-mcp-setup` | provider command arrays、setup-owned projection、derived readiness pointers |
| `.spec-first/providers/<provider>/` | `spec-graph-bootstrap` | provider raw logs、status 和 normalized facts |
| `.spec-first/graph/graph-facts.json` | `spec-graph-bootstrap` | graph readiness、repo snapshot、provider summary、staleness hints |
| `.spec-first/impact/bootstrap-impact-capabilities.json` | `spec-graph-bootstrap` | context selection、impact radius、review support 的 capability envelope |
| `.spec-first/workspace/gitnexus-readiness.json` | `spec-graph-bootstrap` parent all-repos / readiness classifier | parent workspace GitNexus group-ready / bounded registry fallback advisory facts |

下游 workflow 使用这些产物前必须检查 freshness。artifact 存在不等于当前 checkout 已覆盖，尤其在 dirty worktree 或切换分支后。

## 反模式

避免以下设计：

- 把 `code-review-graph` 包装成默认 reviewer agent。
- 把 `spec-graph-impact-reviewer` 当成 always-on reviewer；它应默认评估、条件派发。
- 让 GitNexus 或 CRG 输出直接成为 final finding。
- 在 `spec-code-review` 默认运行 graph build/update。
- 默认启用 provider hooks，让工具在用户未感知时持续写状态。
- 把 `.spec-first/graph/*` 或 `.spec-first/impact/*` 当成长期 source truth。
- 用 provider readiness 替代 tests、reviewer judgment 或用户 scope。
- 在 parent workspace 中让 graph target facts 替用户选择写入哪个 child repo。

## 使用建议

首次准备图谱能力：

```text
$spec-mcp-setup
$spec-graph-bootstrap
```

进入计划或实现前：

- 用 GitNexus 理解全局结构、execution flow、symbol impact 和复用点。
- 如果 graph facts stale 或 unavailable，披露限制并回退到 Serena、ast-grep 或 bounded direct reads。

进入 review 前：

- 用 `code-review-graph` 的 impact capability 判断当前 diff 的影响范围。
- 把 `spec-graph-impact-reviewer` 理解为条件触发的影响面审查专家，不是默认每次派发的 reviewer。
- 优先 minimal context，只有高风险或不确定时升级分析。
- reviewer findings 必须能被 diff、源码、测试或明确 evidence 支撑。

完成工作后：

- `spec-code-review` 的临时 run artifact 默认只在当前 OS temp root 下的 `<os-temp>/spec-first/spec-code-review/<run-id>/`，实际路径由 macOS/Linux `$TMPDIR` 或 Windows `%TEMP%` 等环境解析。
- 需要长期沉淀时，使用 PR Known Residuals、`docs/residual-review-findings/*` 或 `spec-compound`，不要把 provider raw logs 当知识文档提交。
