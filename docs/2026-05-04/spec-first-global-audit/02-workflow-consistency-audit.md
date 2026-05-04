# 全流程闭环一致性审查

## 闭环判断

当前主链路已经基本闭合：

```text
mcp-setup / graph-bootstrap
  -> standards
  -> ideate
  -> brainstorm
  -> doc-review
  -> plan
  -> write-tasks
  -> work / debug / optimize / polish
  -> code-review / app-consistency-audit
  -> compound / compound-refresh / sessions / slack-research / skill-audit
```

但这条链路不是强状态机。正确形态是：用户按当前任务进入最合适节点，scripts 准备 facts，LLM 做语义判断，durable artifacts 让下一轮不会从零开始。

## Workflow 节点矩阵

| Workflow 节点 | 当前职责 | 输入 | 输出 | 上游依赖 | 下游消费者 | 当前问题 | 风险等级 | 优化建议 |
|---|---|---|---|---|---|---|---|---|
| `mcp-setup` | 安装/验证 required harness runtime，写 setup-owned provider projection | host、repo target、Serena language、tool registry | `.spec-first/config/runtime-capabilities.json`、`graph-providers.json`、`provider-artifacts.json`、host MCP config | `spec-first init`、`mcp-tools.json` | `graph-bootstrap`、`doctor/update`、下游 workflow | 成功引导已补 standards，但 `init`/README expected output 仍未同步；script 体量大 | P1 | 对齐 init 下一步；拆分 provider projection helper |
| `graph-bootstrap` | 编译 external graph-provider readiness facts | setup-owned config、provider command arrays、repo/workspace target | `.spec-first/providers/*`、`.spec-first/graph/*`、`.spec-first/impact/*` | `mcp-setup` | `plan/work/code-review/app-audit` | 架构边界清晰；历史 docs 仍有旧 CRG 口径 | P2 | 归档旧 CRG docs；增加 provider fixture/eval |
| `standards` | 编译项目规范、glue/reuse capability baseline，preview-first | graph facts、project files、shared standards import | `.spec-first/standards/*`、`standards-preview.md` | `graph-bootstrap` 可选，直接 repo reads | brainstorm/plan/work/review/compound-refresh | 产物 Git 策略复杂，confirmed/imported/observed/suggested 需要用户理解 | P2 | 在 quickstart 中明确 graph ready 后优先跑 standards |
| `ideate` | 生成和批判性评估候选想法 | topic、repo context 或 elsewhere context、可选 web/slack | `docs/ideation/*` 或 Proof；scratch `/tmp/spec-first/spec-ideate/*` | 用户意图、可选 repo facts | brainstorm | `docs/ideation/` 未纳入主要 artifact catalog；agent count 成本较高 | P2 | 将 ideation 纳入 durable artifact map；默认显示成本 |
| `brainstorm` | 澄清 WHAT，产出 requirements brief | 模糊需求、现有 brainstorm、用户上下文 | `docs/brainstorms/*-requirements.md` | ideate 可选 | plan/doc-review | 边界清楚；仍需避免变成默认入口 | P3 | 继续用 using-spec-first guide mode 控制入口 |
| `doc-review` | 审查 requirements/plan/task/doc，发现清晰度、完整性和范围问题 | doc path、mode | findings、Open Questions，可对文档做 safe auto | brainstorm/plan/write-tasks | plan/work | 会把 deferred/open questions 写回原文，轻量但可能污染原文 | P2 | 对 machine-readable report path 做可选化，减少原文污染 |
| `plan` | 将目标转成 HOW，含 implementation units、trace、tests、Graph Readiness | requirements、用户目标、graph facts、standards | `docs/plans/*-plan.md` | brainstorm/standards/graph facts | write-tasks/work/code-review | 强制 doc-review 与 confidence check 正确；但历史 plan 未统一 active/superseded | P2 | 增 plan lifecycle/frontmatter status |
| `write-tasks` | 从 settled plan 派生 executable task pack，或验证已有 task pack | plan path/task pack path | `docs/tasks/*-tasks.md`、Task Pack Contract | plan | work | standalone 入口易被误认为 `$spec-write-tasks`；validator 只校验 identity/freshness/structure | P2 | README/手册继续强调 “standalone skill”；不要夸大 CLI validator 语义能力 |
| `work` | 执行 plan/task/bare prompt，保持 scope 与质量门 | plan、task pack、明确任务 | 代码变更、测试、shipping summary；可能调用 code-review | plan/tasks/standards | code-review/compound | 有 run artifact schema 但 runtime 未写 `run.json`；大任务易扩 scope | P1 | 实现或撤销 `spec-work` run artifact contract；oversized 默认回 plan/tasks |
| `work-beta` | 带外部 delegate 的执行实验 | 可拆分任务 | 多 worker 输出与整合 | work/task pack | review | beta 成本和冲突风险高 | P2 | 保持显式 opt-in，不进入默认 guide |
| `debug` | 复现、根因、最小修复、验证 | bug、错误、日志、issue | root cause、fix、tests、prevention | tests/runtime/code | compound/review | 边界健康；默认询问是否修而非立刻修适合 debug，但在 Codex 默认模式可能显得慢 | P3 | 保持 causal chain gate |
| `optimize` | 以指标驱动实验循环 | optimization spec、metric、budget | `.spec-first/workflows/spec-optimize/<spec>/spec.yaml`、`experiment-log.yaml` | measurement harness | work/review | 成本高、时间长；`.spec-first/workflows/` 未被 gitignore 覆盖 | P1/P2 | 先修 Git 边界；保留 admission/budget gate |
| `polish-beta` | 启动 dev server，用 browser/用户反馈迭代 UI | PR/branch/current branch、dev server | UI fixes、URL、可能截图 | work | review | beta；依赖 browser/dev server 检测 | P3 | 保持 beta，不作为主 workflow |
| `code-review` | diff/PR/branch 多 persona 审查、safe_auto、residual handoff | git diff、plan/task/work artifacts、mode | findings、`/tmp/spec-first/spec-code-review/<run-id>/` | work/PR | work/PR/compound | artifact 在 `/tmp`，不 repo-local；默认 6 reviewers 成本较高 | P1/P2 | 为 headless/autofix 提供 repo-local summary 或明确 tmp-only 设计；强化 cost note |
| `app-consistency-audit` | 移动 App PRD/Figma/source/static consistency audit | `prd:<path>`、`figma-context:<path>`、source、industry | `.spec-first/app-audit/runs/<run-id>/` | plan/tasks/source artifacts | work/code-review | 产物协议厚、无单一 top-level `run-audit.js` orchestrator；Git ignore 未覆盖 `.spec-first/app-audit/` | P1/P2 | 增单命令 headless runner 或更清楚的 script sequence；修 `.gitignore` |
| `compound` | 将已解决问题沉淀为 `docs/solutions` | 已解决问题、diff、上下文 | `docs/solutions/<category>/<file>.md` | work/debug/review | future workflows | 使用 subagents，轻量模式可能跳过 overlap | P3 | 保持 narrow refresh hint |
| `compound-refresh` | 刷新/合并/替换/删除 stale `docs/solutions` | scope hint、docs/solutions | 更新或删除 learning docs，report | compound/future work | future workflows | autofix 可以删除文件，需严格 scope | P2 | 强制 narrow scope；commit 前列删除证据 |
| `sessions` | 查询过去 agent session history | session query | research digest | session inventory/extract internal skills | plan/debug | 无 durable repo artifact，主要是 context retrieval | P3 | 保持 internal helper 不暴露 |
| `slack-research` | 搜索组织讨论，合成上下文 | Slack query | research digest | Slack tools | brainstorm/plan | 外部工具和权限不稳定 | P3 | 输出必须标注无法检索或样本限制 |
| `skill-audit` | 审查 skill/source/runtime governance | repo or skill path | `.spec-first/audits/skill-audit/latest/*` | skills/governance/runtime | skill evolution | audit artifacts 被忽略是合理的；score 只是信号 | P3 | 定期运行，P0/P1 要人工复核 |
| `update` | 检查版本和 host runtime stale | host/runtime state、npm/GitHub | update/init/restart guidance | startup reminder | all workflows | host 分支复杂但边界清楚 | P3 | 不自动升级，保持用户决策 |
| `release-notes` | 查询 spec-first releases | release query/version/topic | release digest | GitHub releases | users/maintainers | 依赖网络，非主链路 | P3 | 失败时明确降级 |

## 上下游关系和断点

| 关系 | 当前状态 | 证据 | 断点 |
|---|---|---|---|
| setup -> graph-bootstrap | 基本闭合 | `skills/spec-mcp-setup/SKILL.md:410-414`、`skills/spec-graph-bootstrap/SKILL.md:57-75` | 无代码断点；first-run 文案还需统一 |
| graph-bootstrap -> plan/work/review | 闭合且 degraded mode 明确 | `skills/spec-plan/SKILL.md:200-233`、`skills/spec-work/SKILL.md:17-21` | 历史 docs 仍混入旧 CRG |
| standards -> brainstorm/plan/work/review | 新增闭合 | `skills/spec-standards/SKILL.md:11-58`、`:237-363` | 用户成本和 Git 策略需要更清楚 |
| brainstorm -> plan | 闭合 | `skills/spec-brainstorm/SKILL.md:11-15`、`:214-220` | 无 |
| plan -> write-tasks -> work | 闭合且 task pack validator 存在 | `src/cli/task-pack.js:271-416`、`skills/spec-work/SKILL.md:72-83` | validator 不能代表语义质量 |
| work -> code-review -> residual | 部分闭合 | `skills/spec-work/references/shipping-workflow.md:21-43`、`skills/spec-code-review/SKILL.md:54-72` | code-review artifact tmp-only，work run artifact 未落地 |
| app audit -> work/review | 部分闭合 | `skills/spec-app-consistency-audit/SKILL.md:79-101` | 产物目录未被 `.gitignore` 覆盖；单命令执行弱 |
| work/debug/review -> compound | 闭合 | `skills/spec-compound/SKILL.md:240-282` | 需要避免为机械问题过度沉淀 |
| compound -> compound-refresh | 闭合但有副作用 | `skills/spec-compound-refresh/SKILL.md:23-30`、`:83-85` | autofix 删除需要 scope 和证据 |

## 用户研发增益表

| Workflow | 用户收益 | 当前是否实现 | 使用成本 | 增益是否大于成本 | 建议 |
|---|---|---|---|---|---|
| `mcp-setup` | 减少工具配置不确定性 | 是 | 中 | 是 | 保持一次性 setup；补更强 next step |
| `graph-bootstrap` | 让 AI 有当前代码库 facts 和 impact readiness | 是 | 中 | 是 | 保持 degraded mode，不强绑定 provider |
| `standards` | 把项目规范、glue 能力显性化 | 是 | 中 | 是，但需用户理解 confirmed/suggested | 将其放入 first-run 推荐 |
| `ideate` | 在动手前拓宽方案空间 | 是 | 高 | 视场景 | 只在用户要 idea 时触发 |
| `brainstorm` | 需求更清楚，避免 plan 发明产品行为 | 是 | 中 | 是 | 保持 right-size，不默认拉长 |
| `doc-review` | 在执行前发现文档漏洞 | 是 | 中 | 是 | 保留 headless/autofix 但避免污染主文档 |
| `plan` | 方案可审查，实施边界清楚 | 是 | 中 | 是 | 增 plan lifecycle |
| `write-tasks` | 大计划可交接、可验证 freshness | 是 | 中 | 大计划中是，小任务中否 | 继续 optional |
| `work` | 执行更可控，验证更明确 | 是 | 中 | 是 | 补 run artifact |
| `debug` | 少走 shotgun debugging | 是 | 中 | 是 | 保持 causal chain gate |
| `optimize` | 对可度量目标系统迭代 | 是 | 高 | 只在指标明确时是 | admission gate 必须保留 |
| `polish-beta` | UI 可视反馈更快 | 部分 | 中/高 | beta 场景中是 | 保持 beta |
| `code-review` | 更高质量评审和 safe_auto | 是 | 高 | 高风险 diff 中是，小 diff 中成本偏高 | 成本提示和 fallback |
| `app-consistency-audit` | App PRD/Figma/source 对齐 | 部分 | 高 | 移动 App 高价值，普通项目成本高 | 限定适用范围 |
| `compound` | 经验沉淀，减少重复踩坑 | 是 | 中 | 是 | 不为机械修复滥写 |
| `compound-refresh` | 避免知识库变 stale | 是 | 高 | 需要明确 scope 时是 | 默认 narrow |
| `sessions` | 跨会话复用历史 | 是 | 低/中 | 是 | 保持 digest，不写假事实 |
| `slack-research` | 引入组织决策上下文 | 条件实现 | 中 | 依赖工具/权限 | 标注检索限制 |
| `skill-audit` | 防止 skill debt 变 workflow debt | 是 | 中 | 对维护者是 | 定期而非默认 |

## Workflow 风险矩阵

| 风险 | 涉及节点 | 级别 | 说明 |
|---|---|---|---|
| 产物 Git 边界冲突 | app-audit、workspace、workflows、optimize | P1 | 文档声称不进 Git，但 `.gitignore` 未覆盖 |
| runtime/source truth 残留 | init、docs、AGENTS/CLAUDE | P1 | `.claude-plugin/plugin.json` 已退休但仍在 source truth 列表 |
| 执行闭环 telemetry 缺口 | work、code-review | P1 | work run schema 未写盘；code-review tmp-only |
| 新用户入口成本 | init、mcp-setup、graph-bootstrap、standards | P1 | first-run next steps 不完全一致 |
| 过厚 workflow 成本 | app-audit、code-review、ideate、optimize | P2 | 有价值但需显式适用场景和成本提示 |
