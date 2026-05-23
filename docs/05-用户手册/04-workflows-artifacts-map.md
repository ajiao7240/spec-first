# `.spec-first/` 产物目录映射

本文说明当前 `spec-first` 会写入哪些 project-local runtime/control-plane 产物、它们由谁生成、后续如何被使用，以及哪些目录不应提交到 Git。

当前版本的图相关产物是 **external graph-provider readiness facts**，不是内置代码图库。App consistency audit、skill audit 和 quality gate 等目录也是可重建的执行产物。脚本负责写入确定性事实，LLM 根据这些事实判断下一步是否使用 GitNexus、code-review-graph、bounded direct repo reads 或专项审查报告。

## 总览

| 目录 | 写入阶段 | 触发方式 | 主要作用 | 主要产物 |
| --- | --- | --- | --- | --- |
| `.spec-first/config/` | `spec-mcp-setup` setup facts 阶段 | `/spec:mcp-setup` 或 `$spec-mcp-setup` | 记录 host baseline、graph provider 配置、setup-inferred GitNexus capability discovery、candidate tools/resources、fallback 能力和 artifact path contract；不是 query-ready graph evidence 或 live MCP proof | `runtime-capabilities.json`、`graph-providers.json`、`provider-artifacts.json` |
| `.spec-first/providers/<provider>/` | `spec-graph-bootstrap` provider evidence 阶段 | `/spec:graph-bootstrap` 或 `$spec-graph-bootstrap` | 保存 provider 原始日志、provider 状态和规范化能力事实 | `raw/*.log`、`status.json`、`normalized/*.json` |
| `.spec-first/graph/` | `spec-graph-bootstrap` canonical graph readiness 阶段 | `/spec:graph-bootstrap` 或 `$spec-graph-bootstrap` | 提供下游 workflow 读取的 graph readiness 真相源与用户报告 | `provider-status.json`、`graph-facts.json`、`bootstrap-report.md` |
| `.spec-first/impact/` | `spec-graph-bootstrap` capability envelope 阶段 | `/spec:graph-bootstrap` 或 `$spec-graph-bootstrap` | 表达 context selection、impact radius、review support 的 primary/fallback 支持情况 | `bootstrap-impact-capabilities.json` |
| `.spec-first/workspace/` | parent workspace advisory 阶段 | 父 workspace 下的 `spec-mcp-setup`、`spec-graph-bootstrap` 或 read-only resolver | 保存跨 child repo 候选、批量维护 summary 和只读 graph target 建议 | `project-config-bootstrap-summary.json`、`mcp-setup-summary.json`、`mcp-verify-summary.json`、`graph-bootstrap-summary.json`、`graph-targets.json` |
| `.spec-first/audits/skill-audit/` | `spec-skill-audit` source skill audit 阶段 | `/spec:skill-audit`、`$spec-skill-audit` 或直接运行 `write-audit-artifacts.js` | 保存 source skill inventory、scorecard、安全/治理/runtime drift 信号和改进计划 | `latest/skill-audit-summary.md`、`latest/skill-improvement-plan.md`、`latest/*.json`、`latest/patch-preview/*` |
| `.spec-first/app-audit/runs/<run-id>/` | `spec-app-consistency-audit` App 一致性审查阶段 | `/spec:app-consistency-audit` 或 `$spec-app-consistency-audit`；headless 自动化下亦可直接调用 `node skills/spec-app-consistency-audit/scripts/run-audit.js mode:headless base:<ref>` | 保存移动 App PRD / Figma / source / route / architecture / analytics / i18n 静态一致性审查证据；`issue_synthesis_status` 三态(`not_run` / `llm_provided` / `fixture_provided`)区分确定性 runner 产物与上游 LLM/fixture 注入的语义 issue；markdown 摘要由下游 Report Writer 产出，不由 runner 直接生成 | 由 runner 产出: `metadata.json`、`preflight.json`、`impact-facts.json`、`issues.json`、`audit-report.json`、`app-audit-context.json`、`merged-context.json`、`artifact-manifest.json`、`headless-envelope.txt`；由下游 Report Writer 产出: `app-consistency-audit.md`、`app-consistency-audit.summary.md` |
| `.spec-first/workflows/verification/<slug>/` | verification evidence 阶段 | 上游 verification 流程写入，`doctor` 读取 | 作为验证证据投递目录 | `verification-evidence.json` |
| `.spec-first/workflows/quality-gates/ai-dev-quality-gate/` | AI Dev Quality Gate 阶段 | `npm run test:ai-dev:gate` | 记录质量门结果与失败主题，供后续诊断和知识沉淀 | `ai-dev-quality-gate-result.json`、`quality-feedback-topics.json`、JUnit 输出 |

不在 `.spec-first/` 下、但容易被误解的临时 handoff：

| 路径 | 写入阶段 | 触发方式 | 主要作用 | Git 边界 |
| --- | --- | --- | --- | --- |
| `<os-temp>/spec-first/spec-code-review/<run-id>/` | `spec-code-review` interactive / autofix / headless run | `/spec:code-review` 或 `$spec-code-review`，report-only 除外 | 保存当前 run 的 reviewer JSON、detail enrichment、safe_auto 结果和 residual handoff，供 orchestrator 当前会话读取 | 临时 session/orchestrator handoff，不提交；实际路径由当前 OS temp root 解析，例如 macOS/Linux `$TMPDIR` 或 Windows `%TEMP%`；需要长期保留时只通过 PR Known Residuals 或 `docs/residual-review-findings/<branch-or-head-sha>.md` 写 concise summary |

不在 `.spec-first/` 下、但属于长期协作文档层的 durable artifacts：

| 路径 | 写入阶段 | 触发方式 | 主要作用 | Git 边界 |
| --- | --- | --- | --- | --- |
| `docs/ideation/*-ideation.md` | 主动想法探索与候选方向收敛 | `/spec:ideate` 或 `$spec-ideate` | 保存候选想法、批判、排序、被拒原因和进入 brainstorm 的 handoff；不是 requirements、plan 或代码 | 通常提交，作为后续 brainstorm/plan 的背景输入 |
| `docs/brainstorms/*-requirements.md` | 需求成型 | `/spec:brainstorm` 或 `$spec-brainstorm` | 保存一个已选想法的问题框架、actors、flows、边界、非目标和验收样例 | 通常提交，作为 plan 的上游输入 |
| `docs/plans/*-plan.md` | 实施规划 | `/spec:plan` 或 `$spec-plan` | 保存实施单元、取舍、验证范围、风险、非目标，以及必要时紧邻 `Graph Readiness` 的 `Graph / GitNexus Evidence` posture | 通常提交，作为 work 或 write-tasks 的上游输入 |
| `docs/tasks/*-tasks.md` | 任务包派生 | standalone `write-tasks` skill | 保存从 plan 派生的 executable handoff、依赖、任务身份和 freshness contract | 视团队协作需要提交 |
| `docs/solutions/**/*` | 知识沉淀 | `/spec:compound` 或 `$spec-compound` | 保存已解决问题的可复用工程经验 | 通常提交 |

## 用途总览

| 目录类型 | 主要作用 | 典型后续用途 |
| --- | --- | --- |
| `docs/ideation/` | 候选方向与想法排序 | `spec-brainstorm` 选择一个想法继续成型；维护者回看被拒绝方向与取舍理由 |
| `docs/brainstorms/` | 需求成型 brief | `spec-plan`、doc review、后续维护者复核 scope 和 acceptance examples |
| `docs/plans/` / `docs/tasks/` | 计划与可执行任务交接 | `spec-work`、standalone `write-tasks`、code/doc review；计划中的 `Graph / GitNexus Evidence` block 说明 `native_tool_or_resource`、`capability_status`、`evidence_grade`、`evidence_posture`、`freshness_state`、`source_tags` 和源码验证要求 |
| `docs/solutions/` | 可复用工程知识 | 后续 brainstorm/plan/work/debug/review 复用经验 |
| `config/` | setup-owned machine facts | graph-bootstrap 前置校验、host readiness 指针、setup-inferred GitNexus availability/discovery facts、candidate `native_tools[]` / `native_resources[]`、fallback 能力判断 |
| `providers/<provider>/` | provider-local evidence | 失败诊断、原始日志追踪、provider 规范化事实复核 |
| `graph/` | canonical readiness facts | `spec-plan` 等下游 workflow 判断 graph facts 是否 primary、degraded、blocked 或 stale |
| `impact/` | impact/review capability envelope | 下游 workflow 决定是否使用 provider 影响分析，或回退 bounded direct repo reads |
| `workspace/` | parent workspace advisory summaries | 多仓父目录下展示 child repo readiness、批量维护结果和只读候选；不作为 repo-local truth |
| `audits/skill-audit/` | skill audit execution artifacts | 维护者读取审计摘要、P0/P1 evidence、score signals 和改进计划 |
| `app-audit/runs/` | App consistency audit execution artifacts | 评审者读取静态一致性报告、degraded modes、issues 和 runtime follow-up 建议 |
| `verification/*` | 验证证据投递目录 | `doctor` 校验与汇总 |
| `quality-gates/*` | 质量门机器结果 | gate 结果留痕与失败主题沉淀 |
| `<os-temp>/spec-first/spec-code-review/*` | Code review 临时 handoff | 当前 run 的 reviewer/orchestrator 协调，不作为 repo-local durable artifact |

## 阶段 → 读取方速查

| 产物目录 | 主要读取方 | 读取发生阶段 | 读取目的 |
| --- | --- | --- | --- |
| `config/` | `skills/spec-graph-bootstrap/scripts/bootstrap-providers.*`、`spec-plan` | graph-bootstrap preflight / Plan availability selection | 校验 baseline、provider command arrays、artifact path contract、setup-inferred GitNexus native capability discovery 和 fallback 能力；不把 discovery facts 当 query-ready evidence |
| `providers/<provider>/` | graph-bootstrap 报告、维护者排障 | bootstrap 后诊断 | 查看 provider 原始输出和规范化结果 |
| `graph/` | `spec-plan`，后续 graph-aware workflow | plan / work / review 前置判断 | 判断 graph readiness、provider 覆盖、confidence、limitations 与 staleness；`spec-plan` 可把这些 facts 派生为 Plan-local GitNexus evidence posture，但不写回 readiness artifacts |
| `impact/` | `spec-plan`，后续 impact-aware workflow | plan / work / review 前置判断 | 判断 impact radius、review support 与 context selection 是否有可信 provider 支持 |
| `workspace/` | 父 workspace 下的 LLM workflow、维护者 | workspace 只读定位或批量维护后 | 查看 child repo 候选、per-child readiness 和 next action；不替代 child repo canonical artifacts |
| `audits/skill-audit` | 维护者、`spec-skill-audit` 后续 LLM 审查 | skill 审计后 | 查看 deterministic facts、score signals、P0/P1 evidence 和 patch preview 建议 |
| `app-audit/runs/<run-id>` | 评审者、`spec-code-review` headless 调用、后续 QA / runtime validation | App 一致性审查后 | 查看 PRD/Figma/source 一致性问题、证据链、降级范围和运行时验证建议 |
| `verification/<slug>` | `src/cli/commands/doctor.js` | `doctor` 检查阶段 | 校验 verification evidence 是否存在、有效、足够新 |
| `quality-gates/ai-dev-quality-gate` | `scripts/run-ai-dev-quality-gate.js`、`src/verification/quality-feedback.js` | AI gate 执行后 | 记录 gate 结果并提取失败主题 |

## 1. config/

| 项目 | 内容 |
| --- | --- |
| 阶段 | Required Harness Runtime setup facts |
| 触发 | `/spec:mcp-setup` 或 `$spec-mcp-setup` |
| 目录形状 | `.spec-first/config/` |
| 关键源码 | `skills/spec-mcp-setup/scripts/write-provider-config.*`、`skills/spec-mcp-setup/scripts/verify-tools.*` |
| 事实边界 | setup-owned config facts；不是 graph-bootstrap 的结果真相源 |

### 写入内容

| 文件 | 角色 |
| --- | --- |
| `runtime-capabilities.json` | host ledger 指针、baseline 摘要、fallback tool 能力、`project_graph_readiness` 派生摘要和 `gitnexus_capability_discovery` setup-inferred availability summary |
| `graph-providers.json` | provider 配置、受限 command arrays、GitNexus `native_capabilities` projection（含公共 `source_tags[]`、candidate tools/resources、limitations）、derived readiness 投影和下一步提示 |
| `provider-artifacts.json` | provider raw/normalized/status 路径与 canonical graph/impact artifact path contract |

`spec-mcp-setup` 可以从 canonical artifacts 重建 setup-owned projection，但不运行 provider build，也不把自然语言 setup 输出当成 fallback readiness 真相源。

## Parent workspace advisory summaries

| 项目 | 内容 |
| --- | --- |
| 阶段 | parent workspace advisory summaries |
| 触发 | 父 workspace 下运行 `spec-mcp-setup`、`spec-graph-bootstrap`，或显式运行 `resolve-workspace-graph-targets.* --write-summary` |
| 目录形状 | `.spec-first/workspace/` |
| 关键源码 | `skills/spec-mcp-setup/scripts/*`、`skills/spec-graph-bootstrap/scripts/bootstrap-providers.*`、`skills/spec-graph-bootstrap/scripts/resolve-workspace-graph-targets.*` |
| 事实边界 | advisory workspace facts；不是任何 child repo 的 canonical truth |

### 写入内容

| 文件 | 角色 |
| --- | --- |
| `project-config-bootstrap-summary.json` | 父 workspace 下 project config bootstrap 的 per-child 汇总 |
| `mcp-setup-summary.json` | 父 workspace 下 install-mcp 的 per-child 汇总 |
| `mcp-verify-summary.json` | 父 workspace 下 verify-tools 的 per-child readiness 汇总 |
| `graph-bootstrap-summary.json` | 父 workspace 下 graph bootstrap all-child maintenance 的 per-child 汇总 |
| `graph-targets.json` | 只读 workspace graph target resolver 的候选 repo、status、artifact pointer 和 next action |
| `gitnexus-readiness.json` | `workspace-gitnexus-readiness.v1`，记录 GitNexus group-ready / bounded registry fallback 的只读 advisory routing facts |

`workspace/` 只帮助 LLM 或维护者看清候选、批量维护结果和 GitNexus group readiness fallback。它不能替代 child repo 内的 `.spec-first/config/`、`.spec-first/graph/`、`.spec-first/impact/`、`.spec-first/providers/`、prior GitNexus evidence、code-review-graph facts、ast-grep 或 bounded direct source reads，也不允许普通 plan/work/debug/review 隐式运行 `group_sync`。

## Code review temporary handoff

`spec-code-review` 的 full-detail run artifact 写到当前 OS temp root 下的 `<os-temp>/spec-first/spec-code-review/<run-id>/`，不是 `.spec-first/` 目录，也不是 repo-local durable truth。实际 `<os-temp>` 由运行环境解析，例如 macOS/Linux 的 `$TMPDIR` 或 Windows 的 `%TEMP%`。它的用途是让当前 session 中的 orchestrator、headless caller 或 shipping workflow 读取 reviewer JSON、detail enrichment、autofix residuals 和 metadata。

持久化边界：

- `mode:report-only` 不写 temp artifact。
- interactive、autofix 和 headless mode 写 OS temp artifact，但它默认不提交、不承诺长期保留。
- 如果 shipping 阶段接受 residual findings，PR 描述应写 `Known Residuals`；无 PR 提交路径才写 `docs/residual-review-findings/<branch-or-head-sha>.md` 这类 concise durable summary。
- 不默认把 full-detail per-reviewer JSON bundle 复制进 `docs/` 或 `.spec-first/`。

## 2. providers/&lt;provider&gt;/

| 项目 | 内容 |
| --- | --- |
| 阶段 | provider evidence capture |
| 触发 | `/spec:graph-bootstrap` 或 `$spec-graph-bootstrap` |
| 目录形状 | `.spec-first/providers/<provider>/` |
| 关键源码 | `skills/spec-graph-bootstrap/scripts/bootstrap-providers.*` |
| 事实边界 | provider-local 证据；下游 workflow 默认先读 canonical artifacts |

### 写入内容

| 文件 | 角色 |
| --- | --- |
| `raw/*.log` | provider build/status/query probe 原始输出 |
| `status.json` | 单 provider 的状态、query readiness、refresh mode、`last_indexed_commit`、diagnostics 和 raw log pointers |
| `normalized/*.json` | provider 规范化事实，例如 architecture facts、reuse candidates 或 impact capabilities |

provider raw logs 只服务诊断。下游 workflow 不应直接耦合 raw logs 来判断工程决策。

## 3. graph/

| 项目 | 内容 |
| --- | --- |
| 阶段 | canonical graph readiness |
| 触发 | `/spec:graph-bootstrap` 或 `$spec-graph-bootstrap` |
| 目录形状 | `.spec-first/graph/` |
| 关键源码 | `skills/spec-graph-bootstrap/scripts/bootstrap-providers.*` |
| 事实真源 | graph readiness aggregate；不是长期知识库 |

### 写入内容

| 文件 | 角色 |
| --- | --- |
| `provider-status.json` | provider readiness 聚合，包含 ready/failed/skipped providers、workflow mode、confidence 和 limitations |
| `graph-facts.json` | 下游 graph facts 入口，包含 repo identity、snapshot、provider summary、capabilities 和 staleness hints |
| `bootstrap-report.md` | 面向用户的 bootstrap 结果、next actions、limitations 和 artifact paths |

`graph/` 是可重建 runtime/control-plane。它回答“当前 provider readiness 是否可用”，不承载手工维护的设计知识。

## 4. impact/

| 项目 | 内容 |
| --- | --- |
| 阶段 | fallback-aware impact capability envelope |
| 触发 | `/spec:graph-bootstrap` 或 `$spec-graph-bootstrap` |
| 目录形状 | `.spec-first/impact/` |
| 关键源码 | `skills/spec-graph-bootstrap/scripts/bootstrap-providers.*` |

### 写入内容

| 文件 | 角色 |
| --- | --- |
| `bootstrap-impact-capabilities.json` | 表达 `context_selection`、`impact_radius`、`review_support` 的 support level、primary/fallback 来源、confidence 和 limitations |

没有 query-ready provider 时，capability envelope 必须明确 `partial` 或 `none`，不能凭空声明 provider impact 可用。

## 5. audits/skill-audit/

| 项目 | 内容 |
| --- | --- |
| 阶段 | source skill audit |
| 触发 | `/spec:skill-audit`、`$spec-skill-audit`，或直接运行 `node skills/spec-skill-audit/scripts/write-audit-artifacts.js --repo .` |
| 目录形状 | `.spec-first/audits/skill-audit/<run-id>/` 与 `.spec-first/audits/skill-audit/latest/` |
| 关键源码 | `skills/spec-skill-audit/scripts/write-audit-artifacts.js` |
| 事实边界 | 审计执行产物；不是 source truth，不进入 Git |

### 写入内容

| 文件 | 角色 |
| --- | --- |
| `skill-source-inventory.json` | source skill inventory、frontmatter、heading、declared input/output 和资源目录事实 |
| `skill-audit-report.json` | P0/P1/P2/P3 finding 聚合，P0/P1 必须保留 signal、evidence、counter-evidence、decision、reason、recommendation、confidence |
| `expert-scorecard.json` | 12 维评分信号；评分是 review signal，不是 gate |
| `security-risk-report.json` | remote script、secret access、runtime hand-edit、destructive command 等安全信号 |
| `promise-implementation-report.json` | 文档承诺、CLI 参数和脚本实际写出产物的一致性信号 |
| `governance-drift-report.json` | `skills/` 与 dual-host governance contract 的漂移信号 |
| `runtime-drift-report.json` | 生成 runtime 缺失或漂移信号；修复方式是重新 `spec-first init` |
| `trigger-routing-report.json` | trigger wording 和 workflow reference 的确定性信号 |
| `boundary-overlap-matrix.json` | skill 职责重叠候选；最终是否冲突由 LLM 判断 |
| `skill-audit-summary.md` | 面向维护者的摘要入口 |
| `skill-improvement-plan.md` | 按 P0/P1/P2 分层的改进计划 |
| `patch-preview/*` | 仅在显式传 `--patch-preview` 时生成的建议，不会修改源码 |

协作规则：

- `.spec-first/audits/` 已被 `.gitignore` 忽略，提交时不带这些产物
- 需要审单个 skill 时使用 `--target skills/<skill-name>` 或宿主入口后跟 `skills/<skill-name>`
- runtime drift finding 的修复方式是 `spec-first init --claude` 或 `spec-first init --codex`，不是手改 `.claude/`、`.codex/`、`.agents/skills/`

## 6. app-audit/runs/

| 项目 | 内容 |
| --- | --- |
| 阶段 | App consistency audit |
| 触发 | `/spec:app-consistency-audit` 或 `$spec-app-consistency-audit` |
| 目录形状 | `.spec-first/app-audit/runs/<run-id>/`，并可带 `latest-summary.json` 指针 |
| 关键源码 | `skills/spec-app-consistency-audit/scripts/*` |
| 事实边界 | 审计执行产物；不是 source truth，不进入 Git |

### 写入内容

| 文件 | 角色 |
| --- | --- |
| `metadata.json` | run id、scope、head sha、diff hash、worktree fingerprint 和审查模式 |
| `artifact-manifest.json` | 本次 run 写出的 artifact 清单、hash 和 path contract |
| `preflight.json` | 输入可用性、degraded modes、Figma reference/context 状态 |
| `impact-facts.json` | source、diff、route、interaction 和候选影响面机器事实 |
| `app-audit-context.json` | LLM 专家使用的聚合上下文和 capability coverage |
| `issues.json` | 通过 deterministic evidence gate 后的结构化 issue 集合 |
| `audit-report.json` | 机器可读审查报告 |
| `app-consistency-audit.md` | 面向用户的静态一致性审查报告 |

协作规则：

- `.spec-first/app-audit/` 默认不进入 Git，报告需要共享时应摘录结论或另存为团队约定的 durable doc。
- `figma-context:<path>` 才是可抽取 evidence；`figma-ref:<id-or-url>` 只是 reference。
- Figma MCP 是宿主可选能力，用来 materialize 本地 JSON，不属于 required harness setup。
- `mode:headless` 供 `spec-code-review` 等父流程消费；`mode:report-only` 不写 run artifacts。

## 7. verification/&lt;slug&gt;

| 项目 | 内容 |
| --- | --- |
| 阶段 | verification evidence 证据层 |
| 触发 | 上游 verification 流程写入 |
| 目录形状 | `.spec-first/workflows/verification/<slug>/` |
| 关键消费源码 | `src/cli/commands/doctor.js` |
| 关键文件 | `verification-evidence.json` |

这个目录是验证证据投递目录。`doctor` 可读取并校验 evidence 文件，帮助判断运行时验证是否可信。

## 8. quality-gates/ai-dev-quality-gate

| 项目 | 内容 |
| --- | --- |
| 阶段 | AI Dev Quality Gate |
| 触发 | `npm run test:ai-dev:gate` |
| 目录形状 | `.spec-first/workflows/quality-gates/ai-dev-quality-gate/` |
| 关键源码 | `scripts/run-ai-dev-quality-gate.js`、`src/verification/quality-feedback.js` |

### 写入内容

| 文件 | 说明 |
| --- | --- |
| `ai-dev-quality-gate-result.json` | quality gate 主结果 |
| `quality-feedback-topics.json` | 失败主题，供后续知识沉淀参考 |
| JUnit 输出 | 单测/契约测试的机器可读结果 |

## 9. Git 边界

- `.spec-first/config/`、`.spec-first/providers/`、`.spec-first/graph/`、`.spec-first/impact/`、`.spec-first/workspace/`、`.spec-first/audits/`、`.spec-first/app-audit/` 与 `.spec-first/workflows/` 默认不进入 Git。
- `docs/ideation/`、`docs/brainstorms/`、`docs/plans/`、`docs/tasks/` 和 `docs/solutions/` 才是长期协作文档层。
- provider readiness facts 是当前代码和工具状态的投影，不要把它改造成第二套手工维护事实源。
- 若 graph facts stale、blocked 或 degraded，下游 workflow 应说明限制，并回退到 bounded direct repo reads 或其他已配置 provider。
- 切换分支、pull、rebase、merge、dirty worktree 变化和 provider fingerprint mismatch 是 freshness invalidation signal；只有 `spec-graph-bootstrap` 显式刷新 canonical graph readiness artifacts。
