# `.spec-first/workflows/` 产物目录映射

本文说明 `.spec-first/workflows/` 下各子目录**在什么阶段写入、如何触发写入、由哪些源码负责写入或消费、主要产物是什么、这些产物的作用是什么，以及后续会在哪里被用到**。

## 总览

| 目录 | 写入阶段 | 触发方式 | 主要作用 | 后续消费位置 | 写入/消费源码 | 主要产物 |
| --- | --- | --- | --- | --- | --- | --- |
| `.spec-first/workflows/bootstrap/<slug>/` | `spec-graph-bootstrap` / Stage-0 编译阶段 | 运行 graph-bootstrap 主链时写入 | 作为 Stage-0 控制面，沉淀 repo 事实、风险、测试面、路由与 minimal context，供后续 workflow 作为结构化输入使用 | `spec-plan` / `spec-work` / `spec-review` 的 Stage-0 上下文消费链；`src/context-routing/*` 路由层 | 写入：`src/bootstrap-compiler/run-bootstrap.js` | `fact-inventory.json`、`risk-signals.json`、`test-surface.json`、`database-routing.json`、`context-routing.json`、`artifact-manifest.json`、`freshness.json`、`lint-report.json`、`contradictions.json`、`verification-profile.json`、`ownership.json`、`review-queue.json`、`minimal-context/{plan,work,review}.json` |
| `.spec-first/workflows/verification/<slug>/` | verification evidence 产物阶段 | 上游 verification 流程先写入，后续 runtime / doctor 消费 | 作为 verification 证据真源，沉淀验证结论与证据项 | runtime 的 `verification_evidence.evidence_items`；`doctor` 校验/汇总链路 | 消费：`src/context-routing/verification-evidence.js`、`src/cli/commands/doctor.js` | `verification-evidence.json` |
| `.spec-first/workflows/quality-gates/ai-dev-quality-gate/` | AI Dev Quality Gate 阶段 | `npm run test:ai-dev:gate` | 记录 AI Dev Quality Gate 的机器结果与反馈主题，作为质量门信号输入 | `src/context-routing/quality-gate-result.js` 读取主结果；后续 workflow/runtime 可据此感知 gate 状态与反馈主题 | 写入：`scripts/run-ai-dev-quality-gate.js`；消费：`src/context-routing/quality-gate-result.js` | `stage0-contracts.junit.json`、`crg-regression.json`、`ai-dev-quality-gate-result.json`、`quality-feedback-topics.json` |
| `.spec-first/workflows/quality-gates/crg-benchmark-evidence/` | CRG benchmark evidence 阶段 | `npm run test:crg:benchmark-evidence` | 沉淀 review / repo-qa / context-efficiency benchmark 的证据层结果，便于回归对比与质量审计 | 当前更偏 benchmark 证据归档、回归跟踪与审计，不像 ai-dev gate 那样有明确 runtime 读取入口 | 写入：`scripts/run-crg-benchmark-evidence.js` | `review-benchmark.json`、`repo-qa-benchmark.json`、`context-efficiency-benchmark.json`、`crg-benchmark-evidence.json` |
| `.spec-first/workflows/spec-work/<slug>/<run-id>/` | `spec-work` 执行阶段 | 运行 `/spec:work` 时按 workflow contract 写入 | 记录一次 work 执行的 machine-truth run artifact，供回看、交接与后续 review 使用 | 上游 work 执行留痕；后续 `spec-review` 等流程可消费该 run artifact 上下文 | contract：`skills/spec-work/SKILL.md` | `run.json`、可选 `closure-summary.md` |
| `.spec-first/workflows/spec-review/<run-id>/` | `spec-review` 执行阶段 | 运行 `/spec:review mode:autofix` 等允许写入产物的模式时写入 | 记录一次 review 的 findings、applied fixes 与 residual work，形成结构化 review 留档 | review 复盘、审计与后续 handoff；尤其用于说明“发现了什么、自动修了什么、还剩什么” | contract：`skills/spec-review/SKILL.md` | review run artifact（总结 findings、applied fixes、residual work 等） |

## 用途总览

| 目录类型 | 主要作用 | 典型后续用途 |
| --- | --- | --- |
| `bootstrap/*` | 给后续 workflow 提供事实化上下文输入 | `spec-plan` / `spec-work` / `spec-review` 的 Stage-0 context 注入 |
| `verification/*` | 给 runtime / doctor 提供验证证据真源 | verification evidence 消费、doctor 校验与汇总 |
| `quality-gates/*` | 给质量门与 benchmark 留下结构化质量信号 | gate 状态读取、benchmark 回归审计 |
| `spec-work/*` | 给执行阶段留下 machine-truth run artifact | 交接、回看、后续 review 消费 |
| `spec-review/*` | 给评审阶段留下结构化 review 留档 | 复盘、审计、残余工作 handoff |

## 阶段 → 读取方速查

| 产物目录 | 主要读取方 | 读取发生阶段 | 读取目的 |
| --- | --- | --- | --- |
| `bootstrap/<slug>` | `spec-plan` / `spec-work` / `spec-review`，以及 `src/context-routing/*` | Stage-0 下游 planning / work / review 阶段 | 注入 repo 事实、风险、测试面与 minimal context |
| `verification/<slug>` | `src/context-routing/verification-evidence.js`、`src/cli/commands/doctor.js` | runtime verification 汇总与 `doctor` 检查阶段 | 读取 verification evidence，组装 evidence items 并做校验/汇总 |
| `quality-gates/ai-dev-quality-gate` | `src/context-routing/quality-gate-result.js` | runtime / workflow 读取质量门状态时 | 读取 quality gate 主结果与反馈主题 |
| `quality-gates/crg-benchmark-evidence` | benchmark 回归/审计流程 | benchmark evidence 回看阶段 | 作为 benchmark 比较、归档与审计证据 |
| `spec-work/<slug>/<run-id>` | 后续 `spec-review` / handoff 场景 | work 完成后、review 开始前后 | 复用上游 work run artifact，避免只靠口头总结 |
| `spec-review/<run-id>` | review 复盘 / handoff 场景 | review 完成后 | 查看 findings、applied fixes 与 residual work |

## 判断这些目录有没有“后续用途”的方法

| 判断问题 | 如果答案是“是” | 说明 |
| --- | --- | --- |
| 是否有明确 reader？ | 如 `quality-gate-result.js`、`verification-evidence.js`、`doctor.js` | 说明它不是纯留痕，而是后续机器输入 |
| 是否被 workflow contract 声明为 machine-truth artifact？ | 如 `spec-work/run.json` | 说明它服务于后续 handoff / review / 回看 |
| 是否承载 Stage-0 / gate / evidence / handoff 语义？ | 如 `bootstrap/*`、`verification/*` | 说明它是工作流控制面的一部分，而非随手落盘 |
| 即使暂未定位到 reader，是否承担 benchmark / 审计证据职责？ | 如 `crg-benchmark-evidence/*` | 说明它至少是质量回归与证据对比的归档面 |

## 1. bootstrap/<slug>

| 项目 | 内容 |
| --- | --- |
| 阶段 | `spec-graph-bootstrap` 的控制面 / Stage-0 产物编译阶段 |
| 触发 | 执行 graph-bootstrap 主链时，由 bootstrap 编译器统一生成 |
| 目录形状 | `.spec-first/workflows/bootstrap/<slug>/` |
| 关键源码 | `src/bootstrap-compiler/run-bootstrap.js` |
| 关键写入函数 | `writeControlPlaneArtifacts(controlPlaneDir, artifacts)` |

### 写入内容

| 文件 | 来源 |
| --- | --- |
| `fact-inventory.json` | `artifacts.machine_artifacts.fact_inventory` |
| `risk-signals.json` | `artifacts.machine_artifacts.risk_signals` |
| `test-surface.json` | `artifacts.machine_artifacts.test_surface` |
| `database-routing.json` | `artifacts.routing.database_routing` |
| `context-routing.json` | `artifacts.routing.context_routing` |
| `artifact-manifest.json` | `artifacts.routing.artifact_manifest` |
| `freshness.json` | `artifacts.machine_artifacts.freshness` |
| `lint-report.json` | `artifacts.machine_artifacts.lint_report` |
| `contradictions.json` | `artifacts.machine_artifacts.contradictions` |
| `verification-profile.json` | `artifacts.machine_artifacts.verification_profile` |
| `ownership.json` | `buildOwnershipRegistrySample()` |
| `review-queue.json` | `buildReviewQueueSample(...)` |
| `minimal-context/review.json` | `artifacts.machine_artifacts.minimal_context.review` |
| `minimal-context/plan.json` | `artifacts.machine_artifacts.minimal_context.plan` |
| `minimal-context/work.json` | `artifacts.machine_artifacts.minimal_context.work` |

### 作用与后续用途

| 维度 | 内容 |
| --- | --- |
| 主要作用 | 作为 Stage-0 控制面，把 repo 事实、风险、测试面、路由与 minimal context 结构化落盘 |
| 后续用途 | 为 `spec-plan`、`spec-work`、`spec-review` 等 workflow 提供更稳定的事实输入，而不是每次都重新从 narrative docs 推断 |
| 典型消费面 | `src/context-routing/*` 路由层，以及消费 Stage-0 context 的 workflow skill |

### 说明

- 这是 `.spec-first/workflows/` 下**最明确、最完整的写入链路**。
- `docs/contexts/<slug>/` 的人类可读上下文文档与这里的 control-plane JSON 是同一轮 bootstrap 的两组输出。
- workspace 模式下，`runWorkspaceBootstrap(...)` 也会把 workspace 级控制面写到 `.spec-first/workflows/bootstrap/<workspace-slug>/`。
- 它的核心价值不是“保存一份中间文件”，而是为后续 LLM workflow 提供**可路由、可追溯、可检查 freshness 的结构化输入**。

## 2. verification/<slug>

| 项目 | 内容 |
| --- | --- |
| 阶段 | verification evidence 证据层 |
| 触发 | 由上游 verification 流程先写入，随后被 runtime / doctor 读取 |
| 目录形状 | `.spec-first/workflows/verification/<slug>/` |
| 关键源码 | `src/context-routing/verification-evidence.js`、`src/cli/commands/doctor.js` |
| 关键文件 | `verification-evidence.json` |

### 当前能确认的边界

| 类型 | 结论 |
| --- | --- |
| 写入方 | 当前这次梳理里未定位到单一集中 writer |
| 读取方 | `loadVerificationEvidence(...)` 会从该目录读取 `verification-evidence.json` |
| runtime 用途 | 作为 `verification_evidence.evidence_items` 的事实来源 |
| doctor 用途 | `doctor` 会读取该目录中的 evidence 文件进行校验/汇总 |

### 作用与后续用途

| 维度 | 内容 |
| --- | --- |
| 主要作用 | 作为 verification 证据真源，沉淀验证阶段产出的证据项与相关元信息 |
| 后续用途 | 被 runtime 读取后，转化为 `verification_evidence.evidence_items` 一类事实输入；也供 `doctor` 做校验与汇总 |
| 典型消费面 | `src/context-routing/verification-evidence.js`、`src/cli/commands/doctor.js` |

### 说明

- 这个目录的特征是：**消费链路很明确，写入链路不是在本次定位到的几个集中脚本里完成的**。
- 所以更准确的表述是：它是一个**上游 verification 证据投递目录**，后续由 runtime 和 `doctor` 消费。
- 它的价值在于把“验证通过/失败”的叙述，收敛成可被程序与 workflow 后续读取的证据层输入。

## 3. quality-gates/ai-dev-quality-gate

| 项目 | 内容 |
| --- | --- |
| 阶段 | AI Dev Quality Gate |
| 触发 | `npm run test:ai-dev:gate` |
| 目录形状 | `.spec-first/workflows/quality-gates/ai-dev-quality-gate/` |
| 关键源码 | 写入：`scripts/run-ai-dev-quality-gate.js`；读取：`src/context-routing/quality-gate-result.js` |
| package script | `package.json` → `test:ai-dev:gate` |

### 写入内容

| 文件 | 说明 |
| --- | --- |
| `stage0-contracts.junit.json` | Stage-0 contract Jest 套件输出 |
| `crg-regression.json` | CRG regression benchmark 结果 |
| `ai-dev-quality-gate-result.json` | quality gate 主结果 |
| `quality-feedback-topics.json` | 质量反馈主题 |

### 作用与后续用途

| 维度 | 内容 |
| --- | --- |
| 主要作用 | 记录 AI Dev Quality Gate 的机器结果、回归结果与反馈主题 |
| 后续用途 | 作为质量门信号输入，供 runtime / workflow 感知 gate 状态、失败主题与质量反馈 |
| 典型消费面 | `src/context-routing/quality-gate-result.js` |

### 触发链

| 步骤 | 行为 |
| --- | --- |
| 1 | `npm run test:ai-dev:gate` |
| 2 | 进入 `scripts/run-ai-dev-quality-gate.js` |
| 3 | `resolveWorkflowArtifactDir(repoRoot, 'quality-gates', 'ai-dev-quality-gate')` 定位目录 |
| 4 | 写入各类 gate artifacts |
| 5 | runtime 通过 `src/context-routing/quality-gate-result.js` 读取 `ai-dev-quality-gate-result.json` |
| 6 | 后续 workflow/runtime 可据此感知质量门结果与反馈主题 |

## 4. quality-gates/crg-benchmark-evidence

| 项目 | 内容 |
| --- | --- |
| 阶段 | CRG benchmark evidence |
| 触发 | `npm run test:crg:benchmark-evidence` |
| 目录形状 | `.spec-first/workflows/quality-gates/crg-benchmark-evidence/` |
| 关键源码 | `scripts/run-crg-benchmark-evidence.js` |
| package script | `package.json` → `test:crg:benchmark-evidence` |

### 写入内容

| 文件 | 说明 |
| --- | --- |
| `review-benchmark.json` | review benchmark 结果 |
| `repo-qa-benchmark.json` | repo QA benchmark 结果 |
| `context-efficiency-benchmark.json` | context efficiency benchmark 结果 |
| `crg-benchmark-evidence.json` | benchmark evidence 汇总结果 |

### 作用与后续用途

| 维度 | 内容 |
| --- | --- |
| 主要作用 | 沉淀 CRG benchmark 证据，用于 review / repo-qa / context-efficiency 的结果留档 |
| 后续用途 | 更偏 benchmark 回归对比、质量审计与证据归档，而不是直接作为主 workflow 的运行态输入 |
| 典型消费面 | 当前在本次梳理范围内未看到像 ai-dev gate 那样明确的 runtime reader |

### 触发链

| 步骤 | 行为 |
| --- | --- |
| 1 | `npm run test:crg:benchmark-evidence` |
| 2 | 进入 `scripts/run-crg-benchmark-evidence.js` |
| 3 | `resolveWorkflowArtifactDir(repoRoot, 'quality-gates', 'crg-benchmark-evidence')` 定位目录 |
| 4 | 分别运行 review / repo-qa / context-efficiency benchmark |
| 5 | 写入单项结果与汇总 evidence |
| 6 | 后续用于 benchmark 回归跟踪、比较与审计 |

## 5. spec-work/<slug>/<run-id>

| 项目 | 内容 |
| --- | --- |
| 阶段 | `spec-work` 执行阶段 |
| 触发 | 运行 `/spec:work` 时，按 workflow contract 预留并写入 run artifact |
| 目录形状 | `.spec-first/workflows/spec-work/<slug>/<run-id>/` |
| 关键源码 | `skills/spec-work/SKILL.md` |
| 机器真源 | `run.json` |

### contract 约定的主要文件

| 文件 | 角色 |
| --- | --- |
| `run.json` | 单一 machine-truth artifact |
| `closure-summary.md` | 可选的人类可读投影，不是第二真源 |

### 作用与后续用途

| 维度 | 内容 |
| --- | --- |
| 主要作用 | 记录一次 `spec-work` 执行的 machine-truth run artifact |
| 后续用途 | 供执行回看、交接与后续 `spec-review` 等流程消费上游 work artifact 上下文 |
| 典型消费面 | `skills/spec-work/SKILL.md` 约定的 handoff 语义，以及后续 review/handoff 场景 |

### 说明

- 这里目前看到的是**workflow contract 已明确规定必须写入的位置和文件形状**。
- 因此它属于“**由 workflow 执行期按 contract 落盘**”的目录，而不是像 quality gate 那样由一个独立 Node.js 脚本集中写入。
- 它的重点是把一次执行过程沉淀成**单一 machine truth**，避免后续只能依赖口头总结或零散上下文回忆。

## 6. spec-review/<run-id>

| 项目 | 内容 |
| --- | --- |
| 阶段 | `spec-review` 执行阶段 |
| 触发 | 运行 `/spec:review` 的可写模式（尤其 `mode:autofix`） |
| 目录形状 | `.spec-first/workflows/spec-review/<run-id>/` |
| 关键源码 | `skills/spec-review/SKILL.md` |
| 主要内容 | review run artifact |

### 模式差异

| 模式 | 是否写 `.spec-first/workflows/spec-review/<run-id>/` |
| --- | --- |
| Interactive / Autofix 可写模式 | 会写 |
| `mode:report-only` | 不写 |

### 作用与后续用途

| 维度 | 内容 |
| --- | --- |
| 主要作用 | 记录一次 `spec-review` 的 findings、applied fixes、residual work 等结构化结果 |
| 后续用途 | 供 review 复盘、审计与后续 handoff，尤其用于说明“发现了什么、自动修了什么、还剩什么” |
| 典型消费面 | `skills/spec-review/SKILL.md` 约定的 review run artifact 语义 |

### 说明

- `spec-review` 对该目录的写入是**模式敏感**的。
- `mode:report-only` 明确禁止写 review artifact，因此不是所有 `/spec:review` 调用都会落盘。
- 它的价值主要在于把 review 阶段的结果收敛成可回放、可审计、可交接的结构化留档。

## 结论

| 结论 | 说明 |
| --- | --- |
| 最确定的集中写入链 | `bootstrap/*`、`quality-gates/ai-dev-quality-gate/*`、`quality-gates/crg-benchmark-evidence/*` |
| contract 驱动的运行产物 | `spec-work/*`、`spec-review/*` |
| 证据投递再消费目录 | `verification/*` |
| 核心判断原则 | 先区分“脚本直接写入”与“workflow contract 约定写入”，再区分“谁写”和“谁读” |
