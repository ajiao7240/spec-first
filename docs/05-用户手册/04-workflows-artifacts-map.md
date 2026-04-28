# `.spec-first/` 产物目录映射

本文说明当前 `spec-first` 会写入哪些 project-local runtime/control-plane 产物、它们由谁生成、后续如何被使用，以及哪些目录不应提交到 Git。

当前版本的图相关产物是 **external graph-provider readiness facts**，不是内置代码图库。脚本负责写入确定性事实，LLM 根据这些事实判断下一步是否使用 GitNexus、code-review-graph 或 bounded direct repo reads。

## 总览

| 目录 | 写入阶段 | 触发方式 | 主要作用 | 主要产物 |
| --- | --- | --- | --- | --- |
| `.spec-first/config/` | `spec-mcp-setup` setup facts 阶段 | `/spec:mcp-setup` 或 `$spec-mcp-setup` | 记录 host baseline、graph provider 配置、fallback 能力和 artifact path contract | `runtime-capabilities.json`、`graph-providers.json`、`provider-artifacts.json` |
| `.spec-first/providers/<provider>/` | `spec-graph-bootstrap` provider evidence 阶段 | `/spec:graph-bootstrap` 或 `$spec-graph-bootstrap` | 保存 provider 原始日志、provider 状态和规范化能力事实 | `raw/*.log`、`status.json`、`normalized/*.json` |
| `.spec-first/graph/` | `spec-graph-bootstrap` canonical graph readiness 阶段 | `/spec:graph-bootstrap` 或 `$spec-graph-bootstrap` | 提供下游 workflow 读取的 graph readiness 真相源与用户报告 | `provider-status.json`、`graph-facts.json`、`bootstrap-report.md` |
| `.spec-first/impact/` | `spec-graph-bootstrap` capability envelope 阶段 | `/spec:graph-bootstrap` 或 `$spec-graph-bootstrap` | 表达 context selection、impact radius、review support 的 primary/fallback 支持情况 | `bootstrap-impact-capabilities.json` |
| `.spec-first/workflows/verification/<slug>/` | verification evidence 阶段 | 上游 verification 流程写入，`doctor` 读取 | 作为验证证据投递目录 | `verification-evidence.json` |
| `.spec-first/workflows/quality-gates/ai-dev-quality-gate/` | AI Dev Quality Gate 阶段 | `npm run test:ai-dev:gate` | 记录质量门结果与失败主题，供后续诊断和知识沉淀 | `ai-dev-quality-gate-result.json`、`quality-feedback-topics.json`、JUnit 输出 |

## 用途总览

| 目录类型 | 主要作用 | 典型后续用途 |
| --- | --- | --- |
| `config/` | setup-owned machine facts | graph-bootstrap 前置校验、host readiness 指针、fallback 能力判断 |
| `providers/<provider>/` | provider-local evidence | 失败诊断、原始日志追踪、provider 规范化事实复核 |
| `graph/` | canonical readiness facts | `spec-plan` 等下游 workflow 判断 graph facts 是否 primary、degraded、blocked 或 stale |
| `impact/` | impact/review capability envelope | 下游 workflow 决定是否使用 provider 影响分析，或回退 bounded direct repo reads |
| `verification/*` | 验证证据投递目录 | `doctor` 校验与汇总 |
| `quality-gates/*` | 质量门机器结果 | gate 结果留痕与失败主题沉淀 |

## 阶段 → 读取方速查

| 产物目录 | 主要读取方 | 读取发生阶段 | 读取目的 |
| --- | --- | --- | --- |
| `config/` | `skills/spec-graph-bootstrap/scripts/bootstrap-providers.*` | graph-bootstrap preflight | 校验 baseline、provider command arrays、artifact path contract 和 fallback 能力 |
| `providers/<provider>/` | graph-bootstrap 报告、维护者排障 | bootstrap 后诊断 | 查看 provider 原始输出和规范化结果 |
| `graph/` | `spec-plan`，后续 graph-aware workflow | plan / work / review 前置判断 | 判断 graph readiness、provider 覆盖、confidence、limitations 与 staleness |
| `impact/` | `spec-plan`，后续 impact-aware workflow | plan / work / review 前置判断 | 判断 impact radius、review support 与 context selection 是否有可信 provider 支持 |
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
| `runtime-capabilities.json` | host ledger 指针、baseline 摘要、fallback tool 能力和 `project_graph_readiness` 派生摘要 |
| `graph-providers.json` | provider 配置、受限 command arrays、derived readiness 投影和下一步提示 |
| `provider-artifacts.json` | provider raw/normalized/status 路径与 canonical graph/impact artifact path contract |

`spec-mcp-setup` 可以从 canonical artifacts 重建 setup-owned projection，但不运行 provider build，也不把自然语言 setup 输出当成 fallback readiness 真相源。

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
| `status.json` | 单 provider 的状态、query readiness、diagnostics 和 raw log pointers |
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

## 5. verification/&lt;slug&gt;

| 项目 | 内容 |
| --- | --- |
| 阶段 | verification evidence 证据层 |
| 触发 | 上游 verification 流程写入 |
| 目录形状 | `.spec-first/workflows/verification/<slug>/` |
| 关键消费源码 | `src/cli/commands/doctor.js` |
| 关键文件 | `verification-evidence.json` |

这个目录是验证证据投递目录。`doctor` 可读取并校验 evidence 文件，帮助判断运行时验证是否可信。

## 6. quality-gates/ai-dev-quality-gate

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

## 7. Git 边界

- `.spec-first/config/`、`.spec-first/providers/`、`.spec-first/graph/`、`.spec-first/impact/` 与 `.spec-first/workflows/` 默认不进入 Git。
- `docs/solutions/`、`docs/plans/` 和 `docs/brainstorms/` 才是长期协作文档层。
- provider readiness facts 是当前代码和工具状态的投影，不要把它改造成第二套手工维护事实源。
- 若 graph facts stale、blocked 或 degraded，下游 workflow 应说明限制，并回退到 bounded direct repo reads 或其他已配置 provider。
