# Context Loading Map

## 总体地图

当前链路：

```text
mcp-setup
→ graph-bootstrap
→ brainstorm
→ doc-review
→ plan
→ write-tasks
→ work/debug/optimize/polish
→ code-review/app-consistency-audit
→ compound/compound-refresh
→ sessions
→ skill-audit
```

## Workflow 节点地图

| stage | 读取什么 | 是否必须 | 可否摘要 | 可否只引用路径 | 可否延迟/按需 | 可否脚本预处理 | context bundle 替代 | 重复/过期风险 | 建议 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mcp-setup | host runtime、provider config、package pin、managed state、doctor/init 结果 | 必须读 readiness facts，不必读全部 runtime | 是 | 是 | provider repair recipe 可按需 | 是 | 是 | runtime mirror 与 source 同时读会重复 | 输出 `setup-summary.v1`，raw logs path-only |
| graph-bootstrap | provider status、raw logs、normalized facts、graph facts | readiness 必须，raw log 非必须 | 是 | 是 | 失败诊断按需 | 是 | 是 | `.spec-first/providers/*/raw` 可能过大 | 默认只给 provider summary、reason_code、artifact paths |
| brainstorm | 用户问题、相关 docs、业务/产品背景、可能的 prior artifacts | 用户问题必须，repo/docs 只在问题要求时读 | 是 | 是 | 是 | 部分可由 search/context-request | 是 | 容易“全面理解项目” | 默认不读全仓；只请求 problem frame bundle |
| doc-review | 被审文档、persona files、pre-facts、decision primer、schema | document 必须；persona/schema 可按需 | document 可 section map | 是 | walkthrough/bulk refs 已延迟 | pre-facts 已脚本化 | 是 | 当前会把 full document 传给每个 reviewer | document section bundle + reviewer-specific slices |
| plan | requirements/spec、repo patterns、standards、graph facts、prior plan examples | spec 必须；patterns/standards 按 scope | 是 | 是 | research refs 按需 | graph/search 可预处理 | 是 | 计划文档常复制需求全文 | plan 生成 decision summary 和 requirement refs |
| write-tasks | source plan、task-pack schema、validation output | plan summary + implementation units 必须 | 是 | 是 | full plan 只在冲突时读 | validator 已脚本化 | 是 | task-pack 可能复制 plan 正文 | task cards 引用 requirement id，不复制全文 |
| work | task-pack/plan、changed files、tests、standards、graph facts、shipping refs | 当前 task slice 必须 | 是 | 是 | branch/shipping/review refs 按需 | tests/git facts 可脚本化 | 是 | `spec-work` 自身很长，handoff 易带全文 | current task bundle + evidence refs + residual summary |
| debug | failure output、logs、source、tests、history | failure summary 必须，完整日志非必须 | 是 | 是 | deeper logs 按需 | test/log summarizer | 是 | tool output 原样进入上下文 | failed-test summary + full log path |
| optimize | metric definition、experiments、worktree outputs、judge results | metric 和 result summary 必须 | 是 | 是 | experiment details 按需 | score aggregation | 是 | 多实验输出乘法放大 | leaderboard + top deltas + failed hypotheses |
| polish | running app evidence、screenshots、browser logs、design input | screenshots/issue summary 必须 | 是 | 是 | browser traces 按需 | screenshot diff/script | 是 | browser logs 和 screenshots 可能过量 | visual issue bundle + artifact paths |
| code-review | diff、pre-facts、persona catalog、selected agents、findings schema、tests | diff + selected context 必须 | 是 | 是 | reviewer refs 按需 | pre-facts/validator | 是 | reviewer fanout + per-agent JSON | selective dispatch + merged finding summary |
| app-consistency-audit | PRD、Figma context、source routes、rule packs、impact facts、issues | available inputs 必须，remote Figma 非必须 | 是 | 是 | expert prompts/rule packs 按需 | scripts 已较成熟 | 是 | PRD/Figma/source 多源重复 | planner 选择 experts，issue cap，summary-first |
| compound | conversation, code diff, session history, related docs, docs/solutions | verified solution 必须，session/history 可选 | 是 | 是 | full mode opt-in | related docs search | 是 | 知识沉淀重复和 session 膨胀 | default lightweight + compound delta/index |
| compound-refresh | docs/solutions、codebase evidence、citations、replacement/merge refs | target docs 必须，broad sweep 非默认 | 是 | 是 | per-action refs 已可按需 | citation search | 是 | full report 要求过长 | narrow scope + report summary + action appendix |
| sessions | session metadata、skeleton、error extracts | filtered extracts 必须，不读原 session | 是 | 是 | tail/errors 按需 | scripts 已有 | 是 | session files 1-7MB | 保持 extraction-only，增加 digest budget |
| skill-audit | skills/agents/source/runtime inventory、scorecard、reports | source inventory 必须，历史 run 非必须 | 是 | 是 | runtime mode opt-in | scripts 已有 | 是 | `.spec-first/audits` 多份大 JSON | retention cap + latest summary only |

## Context 类别治理

| context type | 当前问题 | 默认策略 |
| --- | --- | --- |
| skill instructions | 高频 core 太长 | core < 3k tokens，details refs |
| agent instructions | broad/researcher agent 偏大 | required inputs + output schema + forbidden behaviors |
| repo docs | docs 约 54MB | search/index first，full doc on demand |
| graph facts | readiness 有 summary 但 raw/provider 输出大 | graph summary + reason_code + path |
| diff/source | review 和 work 需要真实代码 | changed files + direct deps first |
| test/tool output | stdout/stderr 易超量 | failed summary + full log path |
| previous artifacts | reports 可能被全文 handoff | summary + artifact path + ids |
| standards/compound | 长期知识会堆积 | index + confirmed delta |
| runtime mirrors | source 重复且大 | 默认 excluded，只有 drift/diagnostic workflow 可读 |
