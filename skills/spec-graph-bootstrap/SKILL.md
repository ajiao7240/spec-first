---
name: spec-graph-bootstrap
description: "Build and verify the local CRG graph index, then hand workflows query-first graph evidence instead of pre-generated context packs."
---

# Spec-First Graph Bootstrap

`spec-graph-bootstrap` 的目标是把当前仓库准备成 **CRG query-first** 状态：

```text
source files
  -> spec-first crg build
  -> graph-index-status.json + code-navigation.json + graph-operations.jsonl
  -> locate / path / explain / impact / review-context / lifecycle hooks
  -> LLM reads evidence and decides
```

边界必须保持清晰：

- 脚本只做确定性事实准备：解析源码、更新图索引、写健康状态、返回候选证据。
- LLM 负责语义判断：选择修改点、取舍影响面、决定验证范围。
- Hook 输出是 advisory input，不是 hard gate，也不是状态机。
- 当 graph 不可用时，恢复路径是 direct repo reads 或重新 build graph，不读取旧文档包作为 fallback。

## 调用方式

```bash
$spec-graph-bootstrap [target-repo-path]
```

`target-repo-path` 省略时使用当前工作目录。宿主 workflow 入口是 `/spec:graph-bootstrap` 或 `$spec-graph-bootstrap`；package CLI 入口是 `spec-first crg <subcommand>`，不是 `spec-first graph-bootstrap`。

## Phase 0: Target And Readiness

1. 解析目标仓库绝对路径。
2. 如存在 host setup marker，读取 `host-setup.json` 的 readiness ledger v1：
   - `overall_status`
   - `baseline_ready`
   - `tools.<tool>.host_config_status`
   - `tools.<tool>.project_status`
   - `crg.cli_status`
   - `crg.native_modules_status`
   - `next_actions[]`
3. `fallback-active` 只表示 host config 可用但可能由 fallback scope 提供；它不等于项目 graph 已 ready。
4. 若 ledger 不存在或不可读，只报告 limitation，继续用本地 CLI probe。

CRG probe:

```bash
spec-first crg --help
spec-first crg stats --repo=<target>
```

判定：

- `stats` ready 且 node count > 0：进入 Phase 2。
- graph 缺失、为空、打不开、或原生模块不可用：进入 Phase 1。

## Phase 1: Build Graph Index

询问或直接执行图构建：

```bash
spec-first crg build --repo=<target>
```

构建成功后必须确认 control-plane 产物：

```text
.spec-first/graph/graph-index-status.json
.spec-first/graph/code-navigation.json
.spec-first/graph/graph-operations.jsonl
```

`graph.db` 是代码事实真源；JSON 文件只提供状态、导航和审计线索。若 operation log 写入失败，不得阻断 graph build 主产出。

## Phase 2: Query Smoke

至少执行一组低成本查询，确认 query-first 面可用：

```bash
spec-first crg workflow-context --stage=plan --repo=<target>
spec-first crg locate --repo=<target> --query="<task or area>" --limit=5
spec-first crg explain --repo=<target> --id="<node-or-file-id>"
```

如果没有具体任务，`locate` query 可使用仓库入口、主要模块、测试入口等中性问题。查询结果只作为候选事实，不要把第一个候选当最终答案。

## Phase 3: Workflow Handoff

完成 bootstrap 后，把后续工作引导到 CRG lifecycle hooks：

```bash
spec-first crg hook before-plan --repo=<target> --task="<task>"
spec-first crg hook before-work --repo=<target> --plan=<plan.md>
spec-first crg hook after-work --repo=<target> --work-run=<id>
spec-first crg hook before-review --repo=<target> --since=<base>
```

Hook 内部会读取 stage-specific workflow context，并建议后续 `locate` / `path` / `explain` / `review-context` 查询。LLM 必须结合计划、diff、本地源码和测试结果做最终判断。

## Phase 4: Fallback And Limitations

当 graph unavailable：

- 明确写出 fallback mode：`direct_repo_reads`。
- 读取当前任务需要的源码、测试、配置和 README。
- 不把旧静态上下文包当事实层。
- 不发明 graph evidence；只能说明 graph 缺失、不可打开或为空。

当 query 输出不足：

- 继续用 targeted local reads 补证据。
- 记录 limitation，例如 parser coverage、unresolved edges、missing graph, empty graph。
- 不用规则引擎替 LLM 做语义裁决。

## Done Signals

完成本 workflow 时应向用户报告：

- graph state：ready / degraded / unavailable / missing。
- control-plane 产物是否存在。
- 至少一条可用的后续 query 或 hook 命令。
- 如果 fallback，被建议读取的 direct repo paths。
- 如果 build 失败，错误原因和下一步修复命令。
