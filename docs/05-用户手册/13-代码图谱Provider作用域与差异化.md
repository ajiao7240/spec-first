# 代码图谱 Provider 作用域与差异化

本文说明当前 spec-first 的 GitNexus-only 图谱 provider 作用域，以及它为什么不是简单的“搜索工具接入”。

结论先行：

```text
GitNexus = 全局代码知识、架构关系、execution flow、symbol impact、review-impact evidence
spec-first = 把 provider facts 治理成可验证、可降级、可复用的工程闭环
LLM / reviewers = 负责语义判断、scope 判断和 finding 判断
```

核心竞争力不是“接入某个代码图谱工具”。真正的差异化是：spec-first 把外部图谱能力放进 `Codebase -> Graph -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge` 链路里，并为它定义 source/runtime 边界、readiness facts、freshness 检查、degraded mode、artifact contract 和 downstream consumer 规则。

## 为什么这是差异化

很多 AI coding 工具或插件的图谱能力停留在三种形态：

- 把图谱工具当成一个更强的搜索工具。
- 把代码审查做成一个更长的 prompt。
- 通过 hooks 或常驻 MCP 让图谱尽量保持最新，但缺少明确的 artifact、freshness 和 fallback 边界。

spec-first 的差异化在于把图谱能力纳入 workflow governance：

- **不是 prompt collection**：图谱能力服务 spec、plan、work、review 和 knowledge 的上下文传递。
- **不是 provider lock-in**：GitNexus、ast-grep、测试、日志、git diff 和 bounded direct reads 都是 evidence source，各自有边界。
- **不是隐式自动化**：setup 只准备 provider config，graph-bootstrap 编译 readiness facts，下游 workflow 再决定是否使用。
- **不是把工具结果当结论**：provider 输出是 evidence，reviewer / LLM 才负责语义判断。
- **不是无边界全局状态**：`.spec-first/graph/*`、`.spec-first/impact/*` 和 `.spec-first/providers/*` 都是可重建 control-plane artifacts。

这对应项目的核心分工：**Scripts prepare, LLM decides**。脚本准备确定性 facts、artifact path、reason_code 和 raw log；LLM 决定这些 facts 是否与当前需求、计划、实现或 review finding 有语义关系。

这让 spec-first 相比单点 AI review 插件更接近工程系统：它不仅让 AI “看得更多”，还让 AI 知道哪些证据可信、哪些证据过期、哪些证据只能作为提示。

## GitNexus 作用域

GitNexus 在 spec-first 中的角色是 `global_knowledge` 与 review-impact evidence source。

它适合回答：

- 这个项目有哪些模块、入口、执行链路和功能社区？
- 某个 function / class / method 在哪里定义，谁调用它，它又调用谁？
- 某个 symbol 参与哪些 execution flow？
- 一个计划或需求可能影响哪些模块？
- 某个共享能力是否已有复用点？
- 多仓 workspace 下，哪些 child repo 可能与问题相关？
- 当前 diff 的 changed symbols、impact radius、related-test candidates 和 blast-radius pointers 是什么？

GitNexus 帮助 LLM 形成全局代码认知，避免只靠关键词搜索或局部文件阅读来做计划、调试、实现和 review 判断。

GitNexus 不应该承担：

- 替用户决定需求范围。
- 替 reviewer 判断 finding 是否成立。
- 把 HIGH / CRITICAL impact 变成不可解释的硬阻断。
- 把 live MCP 调用结果反写成 compiled graph readiness。
- 隐式改写 `AGENTS.md`、`CLAUDE.md` 或 generated runtime assets。
- 在普通 plan/work/debug/review 中自动运行 analyze、index refresh、repair、watcher 或 daemon。

如果 GitNexus 只返回 definitions-only 证据，下游 workflow 只能把它当作 file/symbol pointer，不能把它当成完整 execution-flow evidence。

## Review-Impact 边界

当前 `$spec-code-review` 使用 GitNexus 作为 diff-impact / review evidence source。GitNexus evidence 仍只是 supporting evidence：

- finding 必须由 diff、源码、tests、contracts 或 logs 确认。
- related-test parity 只有在 source-owned `impact_probe` 证明 test provenance 后才是 supported。
- 当 related tests 只有 candidate-only evidence 时，review Coverage 必须写明 `related_tests=candidate-only (provider-unverified)`。
- GitNexus extra impact 只能作为 test-candidate、follow-up 或审查优先级线索，不得自动扩大 implementation/autofix scope。

推荐心智模型：

```text
GitNexus 准备全局结构与 review-impact 证据。
spec-first 管 evidence lifecycle。
LLM / reviewers 做语义判断。
```

默认 workflow 边界：

- `$spec-plan`、`$spec-work`、`$spec-debug` 使用 GitNexus 做图谱/全局代码理解；GitNexus 不可用或 definitions-only 时降级到 bounded direct reads、ast-grep、git diff、测试或日志。
- `$spec-code-review` 使用 GitNexus changed-symbol impact、review context、related-test candidates 和 blast-radius pointers；finding 仍必须独立确认。
- `$spec-work` 可以消费 `$spec-code-review` 产出的 review handoff 摘要，但不直接刷新 provider artifacts 作为 implementation scope authority。
- 普通 workflow 都不得运行 GitNexus analyze/build/index refresh、provider repair、watcher 或 daemon；刷新只属于 `$spec-graph-bootstrap`。

## Capability Catalog 与 Provenance

GitNexus capability catalog 是 checked-in baseline，不是 readiness truth。它列出 capability 语义、candidate `native_tools[]`、candidate read-only `native_resources[]`、mutation boundary 和 fallback posture，并用 `source_tags[]` 区分 `checked-in-baseline`、`provider-pin`、`setup-projection`、`live-mcp-tool`、`live-mcp-resource`、`session-local-inference` 与 `user-decision`。

`spec-mcp-setup` 只能投影 setup-inferred availability/discovery facts；`$spec-plan` 需要在当前 session 复核 tool/resource surface 后，才能把某个 GitNexus tool 或 read-only resource 写成 live evidence。资源如 `gitnexus://repo/{name}/schema`、`gitnexus://repo/{name}/processes` 或 `gitnexus://group/{name}/status` 是 evidence surface，不等于执行能力，也不替代源码读取和 freshness limitations。

## 多仓 Workspace Group Readiness

GitNexus group readiness 只适用于父目录下多个独立 Git repos 的 `multi-repo-workspace` 拓扑。单仓多 module 仍是 repo-local graph scope，不因为包含多个 packages/modules 就成为 GitNexus group。

父 workspace 的 `.spec-first/workspace/gitnexus-readiness.json` 是 `workspace-gitnexus-readiness.v1` advisory artifact：

- `group.status="group-ready"`：优先使用 GitNexus group query 做只读跨仓定向。
- `group.status="group-missing"`：使用 bounded registry/per-repo fan-out fallback；这不是 provider failure。
- `group.status="not-evaluated-no-mcp-input"`：durable script run 没有 live MCP overlay；下游 workflow 应披露限制，或在当前 session 读取 live registry/group facts。

普通 plan/work/debug/review 不得静默运行 `group_sync`，也不得把 live `list_repos` / `group_list` 结果写回 durable readiness。dirty-advisory 或 stale GitNexus evidence 不等于 query 完全不可用；但涉及当前源码或测试事实的结论必须用当前源码直接验证。

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

- 把 GitNexus 包装成默认 reviewer agent。
- 让 GitNexus 输出直接成为 final finding。
- 在普通 workflow 默认运行 graph build/update。
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

进入计划、实现或调试前：

- 用 GitNexus 理解全局结构、execution flow、symbol impact 和复用点。
- 如果 graph facts stale 或 unavailable，披露限制并回退到 ast-grep、git diff、测试、日志或 bounded direct reads。

进入 review 前：

- 用 GitNexus impact capability 判断当前 diff 的影响范围。
- candidate-only related tests 只作为测试候选和 Coverage 限制，不是完整 parity。
- reviewer findings 必须能被 diff、源码、测试或明确 evidence 支撑。

完成工作后：

- `spec-code-review` 的临时 run artifact 默认只在当前 OS temp root 下的 `<os-temp>/spec-first/spec-code-review/<run-id>/`，实际路径由 macOS/Linux `$TMPDIR` 或 Windows `%TEMP%` 等环境解析。
- 需要长期沉淀时，使用 PR Known Residuals、`docs/residual-review-findings/*` 或 `spec-compound`，不要把 provider raw logs 当知识文档提交。
