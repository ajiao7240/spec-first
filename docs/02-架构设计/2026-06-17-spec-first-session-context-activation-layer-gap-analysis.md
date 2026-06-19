# spec-first 会话上下文激活层缺口分析

> 说明：本文记录的是分析结论，不是 runtime contract，也不是新的 source-of-truth 规则。它的目标是把“SessionStart 注入到底还缺哪一层”沉淀成可复用的架构判断。

## 0. 结论先行

`spec-first` 当前不缺 `SessionStart hook`，也不缺持久知识沉淀。真正缺的不是“把更多东西塞进启动注入”，而是 **按需上下文激活层**：

- 在 session start 之上，只保留最小常驻锚点。
- 在 workflow 深读之前，先做一层轻量候选筛选。
- 由脚本准备 deterministic candidates，由 LLM 判断相关性、展开范围和确认级别。

换句话说，`spec-first` 缺的是 **scoped context activation layer**，不是更厚的 SessionStart。

## 1. 现有层次

从当前 source 看，`spec-first` 已经有四块基础能力：

1. **SessionStart 最小注入层**
   - `src/cli/instruction-bootstrap.js`
   - `templates/codex/hooks/session-start`
   - `templates/claude/hooks/session-start`

   这一层的职责是放最小入口锚点：workflow 路由提醒、runtime 排除提醒、角色契约指针、host entrypoint spelling 等。

2. **上下文治理层**
   - `docs/contracts/context-governance.md`
   - `src/cli/helpers/context-bundle.js`

   这一层负责默认排除 generated/runtime/audit artifacts、summary-first、budget accounting 和 path-backed evidence，但它只做路径/预算/排除，不做语义激活。

3. **知识回召层**
   - `docs/contracts/knowledge/knowledge-harness.md`
   - `skills/spec-learnings-researcher.agent.md`
   - `skills/spec-compound/SKILL.md`
   - `CONCEPTS.md`

   这一层已经能从 `docs/solutions/` 召回历史经验，但 recall 被明确定义为 advisory candidate，必须回源确认。

4. **workflow 消费层**
   - `skills/spec-work/SKILL.md`
   - `skills/spec-debug/SKILL.md`
   - `skills/spec-plan/SKILL.md`
   - `skills/spec-code-review/SKILL.md`

   这些 workflow 已经会按需读 source、diff、tests、artifact summary 和 learnings，但规则是分散在各个 workflow prose 里，不是一个统一的 activation 层。

## 2. 业界同类工具通常怎么分层

和 Claude Code、Cursor、Cline、aider 这类工具相比，常见设计并不是“启动时注入更多内容”，而是分成五层：

| 层 | 作用 | `spec-first` 现状 |
| --- | --- | --- |
| 常驻指令层 | 项目规则、入口约束、用户偏好 | 已有 |
| 生命周期 hook 层 | session start / compact / clear 时注入短指针 | 已有 |
| scoped activation 层 | 按路径、任务、阶段激活相关规则或知识 | **缺失** |
| memory / retrieval 层 | 历史决策、经验、摘要、检索结果 | 已有，但只做 advisory recall |
| evidence 层 | source/test/diff/log/summary 作为确认依据 | 已有 |

`spec-first` 现在在 1、2、4、5 上都比较完整，但第 3 层还没有统一出来。这个缺口就是当前的关键空白。

## 3. 缺口具体是什么

缺的不是一个中心化 context router，也不是一个全量 memory 平台，而是一个很薄的 **候选上下文激活器**。

当前分散在各处的能力有三个问题：

- `context-bundle.v1` 只做 path/budget/exclusion，不做语义候选选择。
- `docs/solutions/` 的 recall 只有 advisory 意义，没有统一的 activation manifest。
- `CONCEPTS.md` 只是词汇表，不是激活入口。

结果就是：

- workflow 自己要重复写“该看哪些 learnings / summaries / rules”的说明。
- session start 只能给一个短指针，不能帮 workflow 预先筛候选。
- 轻量问题和高风险问题之间，缺一个中间层把上下文精确“点亮”。

## 4. 为什么不把 SessionStart 变厚

把缺口直接补成更厚的 SessionStart，不是更好的方向：

- token 成本会持续抬高，轻量问答也要付重规则成本。
- stale 风险会变大，启动注入越长，越容易把历史判断误当当前合同。
- 这会和 `docs/contracts/context-governance.md` 的 summary-first、source-first 方向冲突。
- 也会逐步滑向中心化 router，而这正是当前 contract 明确不要做的事。

所以正确补法不是“加长注入”，而是“加一层候选激活”。

## 5. 最小可维护补法

建议新增一个只读、轻合同的内部 helper 或 contract，例如：

```text
context-activation.v1
activation-candidates.v1
```

输入保持很小：

```json
{
  "stage": "work|debug|plan|review",
  "intent": "...",
  "changed_files": [],
  "mentioned_paths": [],
  "artifact_summaries": [],
  "diff_summary": "optional compact text"
}
```

输出只给候选，不给结论：

```json
{
  "schema_version": "spec-first.activation-candidates.v1",
  "candidates": [
    {
      "type": "solution_learning",
      "path": "docs/solutions/...",
      "reason_code": "keyword_path_stage_match",
      "trigger": "changed_files + intent",
      "authority_level": "advisory",
      "freshness": "unknown|current|stale",
      "tokens_estimated": 800,
      "source_reads_required": ["..."],
      "limitations": ["must confirm against current source"]
    }
  ]
}
```

推荐候选类型保持少而稳定：

- `host_instruction`
- `path_rule`
- `solution_learning`
- `concept_vocabulary`
- `artifact_summary`
- `provider_hint`

消费方式也要轻：

- `script` 只做确定性预筛和预算控制。
- `LLM` 决定是否相关、是否展开、是否确认。
- 默认只读 top N 候选，不做全量注入。
- 不读 generated mirrors，不默认引入 vector DB / SQLite，不做 daemon 化。

## 6. 为什么这层最值得补

这层正好补在 `SessionStart` 和 workflow 深读之间：

- 不污染常驻 token。
- 不让每个 workflow 重新发明 recall 逻辑。
- 不把 `docs/solutions/` 误写成 confirmed truth。
- 也不会把 `context-bundle` 升级成中心路由器。

它符合 `spec-first` 一贯的边界：

> Scripts prepare, LLM decides.

脚本准备候选事实，LLM 做语义判断。

## 7. 结论

`spec-first` 目前最缺的那一层，不是更多 SessionStart 内容，而是一个 **按路径、任务、阶段激活的薄上下文候选层**。

如果这层补上，SessionStart 仍然可以保持短而稳；workflow 也能在更小的 token 成本下拿到更准的上下文候选。

