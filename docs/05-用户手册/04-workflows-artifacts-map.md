# `.spec-first/` 产物目录映射

本文说明当前 spec-first 会写入哪些 runtime/control-plane 产物、它们由谁生成、后续如何被使用，以及哪些目录不应提交到 Git。

## 总览

| 目录 | 写入阶段 | 触发方式 | 主要作用 | 写入/消费源码 | 主要产物 |
| --- | --- | --- | --- | --- | --- |
| `.spec-first/workspace/` | CRG workspace preflight 阶段 | `spec-first crg workspace scan/status/context --root=<workspace>` | 父目录 workspace 的 child repo registry、readiness 与 advisory candidates | 写入：`src/crg/workspace/*`、`src/crg/commands/workspace.js`；消费：workflow skills 与 LLM | `workspace-config.json`、`workspace-index.json`、`workspace-status.json` |
| `.spec-first/graph/` | CRG 图索引阶段 | `spec-first crg build --repo=<repo>` | 代码事实真源、repo-local topology 与低 token 导航索引 | 写入：`src/crg/cli/build.js`；消费：`src/crg/commands/*`、`src/crg/workflow-context/*` | `graph.db`、`repo-topology.json`、`graph-index-status.json`、`code-navigation.json`、`graph-operations.jsonl`、`work-runs/` |
| `.spec-first/workflows/verification/<slug>/` | verification evidence 产物阶段 | 上游 verification 流程写入，`doctor` 读取 | 作为 verification 证据投递目录 | 消费：`src/cli/commands/doctor.js` | `verification-evidence.json` |
| `.spec-first/workflows/quality-gates/ai-dev-quality-gate/` | AI Dev Quality Gate 阶段 | `npm run test:ai-dev:gate` | 记录质量门结果与反馈主题 | 写入：`scripts/run-ai-dev-quality-gate.js`；消费：`src/verification/quality-feedback.js` | `crg-runtime-contracts.junit.json`、`ai-dev-quality-gate-result.json`、`quality-feedback-topics.json` |
| `.spec-first/workflows/spec-work/<slug>/<run-id>/` | `spec-work` 执行阶段 | `spec-first crg hook before-work/after-work` 与 workflow contract | 记录一次 work run handoff，供 review 复用 | 写入/读取：`src/crg/work-runs.js`、`src/crg/hooks/*` | `run.json` |
| `.spec-first/workflows/spec-code-review/<run-id>/` | `spec-code-review` 执行阶段 | 运行可写 review 模式时写入 | 记录 review findings、applied fixes 与 residual work | contract：`skills/spec-code-review/SKILL.md` | review run artifact |

## 用途总览

| 目录类型 | 主要作用 | 典型后续用途 |
| --- | --- | --- |
| `workspace/` | 父目录 workspace 的 child repo 发现与候选输入 | `workspace context` 后由 LLM/user 选择 child repo，再运行 repo-local hooks |
| `graph/` | CRG 代码事实与查询控制面 | `locate`、`path`、`explain`、`impact`、`review-context`、workflow hooks |
| `verification/*` | 验证证据投递目录 | `doctor` 校验与汇总 |
| `quality-gates/*` | 质量门机器结果 | gate 结果留痕与失败主题沉淀 |
| `spec-work/*` | work run handoff | `before-review` 复用上游 work-run id |
| `spec-code-review/*` | review 留档 | 复盘、审计、残余工作 handoff |

## 阶段 → 读取方速查

| 产物目录 | 主要读取方 | 读取发生阶段 | 读取目的 |
| --- | --- | --- | --- |
| `workspace/` | `src/crg/commands/workspace.js`、workflow skills | graph-bootstrap / plan / work / review preflight | 防止父目录被误当成一个 repo graph，给出 child repo candidates |
| `graph/` | `src/crg/commands/*`、`src/crg/workflow-context/*` | plan / work / review | 查询候选修改点、影响面、调用路径、候选测试与图状态 |
| `graph/work-runs/` | `src/crg/hooks/before-review.js`、`src/crg/hooks/after-work.js` | work 完成后、review 开始前后 | 复用上游 work handoff，不靠口头总结 |
| `verification/<slug>` | `src/cli/commands/doctor.js` | `doctor` 检查阶段 | 校验 verification evidence 是否存在、有效、足够新 |
| `quality-gates/ai-dev-quality-gate` | `scripts/run-ai-dev-quality-gate.js`、`src/verification/quality-feedback.js` | AI gate 执行后 | 记录 gate 结果并提取失败主题 |

## 1. workspace/

| 项目 | 内容 |
| --- | --- |
| 阶段 | 父目录 workspace preflight |
| 触发 | `spec-first crg workspace scan/status/context --root=<workspace>` |
| 目录形状 | `.spec-first/workspace/` |
| 关键源码 | `src/crg/workspace/*`、`src/crg/commands/workspace.js`、`src/crg/artifact-paths.js` |
| 事实真源 | child repo registry/status；不是代码图 |

### 写入内容

| 文件 | 角色 |
| --- | --- |
| `workspace-config.json` | 可选显式 scope：include roots、exclude globs、max depth |
| `workspace-index.json` | validated child git roots、relationship、signals、stale entries、limitations |
| `workspace-status.json` | 每个 child repo 的 graph readiness、stats、capabilities、limitations |

workspace 层只准备确定性输入事实，不做语义 repo 选择。`workspace context` 可以返回 candidates、reason codes 与推荐 repo-local commands，但不能输出 `selected_repo` / `target_repo` / `final_repo` 这类最终选择字段。父目录 workspace 不拥有合并 `graph.db`；child repo 的 CRG graph 仍写在各自 `<child>/.spec-first/graph/`。

典型流程：

```bash
spec-first crg workspace scan --root=<workspace>
spec-first crg workspace status --root=<workspace>
spec-first crg workspace context --root=<workspace> --task="<task>"
spec-first crg workspace build --root=<workspace> --repo=<child-slug-or-path>
spec-first crg hook before-plan --repo=<child-repo> --task="<task>"
```

如果任务跨多个 child repos，workflow 应拆成显式顺序 repo-local runs；当前不生成一个 combined workspace work-run。

## 2. graph/

| 项目 | 内容 |
| --- | --- |
| 阶段 | CRG 图索引与查询控制面 |
| 触发 | `spec-first crg build --repo=<repo>` |
| 目录形状 | `.spec-first/graph/` |
| 关键源码 | `src/crg/cli/build.js`、`src/crg/artifact-paths.js` |
| 事实真源 | `graph.db` |

### 写入内容

| 文件 | 角色 |
| --- | --- |
| `graph.db` | SQLite 代码图，作为 CRG 查询事实真源 |
| `current.json` / `generations/` / `last-known-good.json` | generation 生命周期与 last-known-good 管理 |
| `input-fingerprints.json` | 输入文件指纹，用于增量构建 |
| `graph-index-status.json` | 图状态、能力位、stats、limitations |
| `code-navigation.json` | 低 token 导航索引，帮助 LLM 决定下一步 query |
| `repo-topology.json` | repo-local module/package topology；module 不是独立 graph |
| `graph-operations.jsonl` | build/promote/degrade 等操作审计线索 |
| `work-runs/` | `spec-work` lifecycle handoff |

### 作用与后续用途

CRG 的职责是准备确定性代码事实；LLM 负责基于这些事实做工程判断。常见消费入口：

- `spec-first crg workflow-context --stage=plan|work|review`
- `spec-first crg hook before-plan|before-work|after-work|before-review`
- `spec-first crg locate/path/explain/impact/review-context`

单个 git repo 下的多 module 项目仍只有一个 repo-local graph。当前 module topology 首先支持 Maven `<modules>` detector，写入 `repo-topology.json` 作为 advisory decision input。

## 3. verification/<slug>

| 项目 | 内容 |
| --- | --- |
| 阶段 | verification evidence 证据层 |
| 触发 | 上游 verification 流程写入 |
| 目录形状 | `.spec-first/workflows/verification/<slug>/` |
| 关键消费源码 | `src/cli/commands/doctor.js` |
| 关键文件 | `verification-evidence.json` |

这个目录是验证证据投递目录。当前默认 workflow 不再通过 Stage-0 runtime 汇总它，但 `doctor` 仍可读取并校验 evidence 文件，帮助判断运行时验证是否可信。

## 4. quality-gates/ai-dev-quality-gate

| 项目 | 内容 |
| --- | --- |
| 阶段 | AI Dev Quality Gate |
| 触发 | `npm run test:ai-dev:gate` |
| 目录形状 | `.spec-first/workflows/quality-gates/ai-dev-quality-gate/` |
| 关键源码 | 写入：`scripts/run-ai-dev-quality-gate.js`；反馈主题：`src/verification/quality-feedback.js` |

### 写入内容

| 文件 | 说明 |
| --- | --- |
| `crg-runtime-contracts.junit.json` | CRG runtime contract Jest 套件输出 |
| `ai-dev-quality-gate-result.json` | quality gate 主结果 |
| `quality-feedback-topics.json` | 失败主题，供后续知识沉淀参考 |

## 5. spec-work/<slug>/<run-id>

| 项目 | 内容 |
| --- | --- |
| 阶段 | `spec-work` 执行阶段 |
| 触发 | `spec-first crg hook before-work` 创建 run，`after-work` 收口 |
| 目录形状 | `.spec-first/graph/work-runs/<run-id>.json` |
| 关键源码 | `src/crg/work-runs.js`、`src/crg/hooks/*` |

work run 是 CRG query-first 后的执行交接事实。它记录 work-start ref、planned surface 和 closure summary，`before-review --work-run=<id>` 可以复用这些输入。

## 6. Git 边界

- `.spec-first/workspace/`、`.spec-first/graph/` 与 `.spec-first/workflows/` 默认不进入 Git。
- `docs/solutions/`、`docs/plans/` 才是长期协作文档层。
- CRG 查询结果是当前代码事实的投影，不要把它改造成第二套手工维护事实源。
