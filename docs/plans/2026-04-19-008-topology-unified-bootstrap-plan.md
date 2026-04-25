---
title: Topology Unified Bootstrap Plan
created: 2026-04-19
updated: 2026-04-20
status: completed
owner: engineering
origin: 统一支持 workspace 多 git 工程、单 git 多 module、单 git 单项目的 spec-graph-bootstrap / Stage-0 拓扑方案
scope: topology contract 收口、stage0 output contract 统一、workspace 正式支持与治理、monorepo multi-module 检测、nested topology 收口、bootstrap success 语义收紧、下游 workflow 文档与测试对齐
---

# Topology Unified Bootstrap Plan

> 2026-04-20 更新：本计划对应的 topology / stage0 output contract 主实现已落地，计划在此收口为完成态。围绕“bootstrap 产物升级时采用覆盖更新还是删除后重建”的后续治理，转入 `docs/plans/2026-04-20-013-refactor-bootstrap-delete-and-regenerate-plan.md`。

## 1. 目标

把 `spec-graph-bootstrap` 与 Stage-0 下游消费链统一到一个轻量但稳定的拓扑模型上，正式支持以下三类场景：

1. 父目录下多个独立 git 工程
2. 单个 git 工程下多个 module
3. 单个 git 工程单项目

同时允许嵌套拓扑：

- workspace 根目录是 `workspace_multi_repo`
- child repo 自身仍可被识别为 `monorepo_multi_module`

本计划的核心目标不是引入新的 orchestration 层，而是让 runtime 产出更诚实、更统一、更可解释的决策输入，让 `spec-plan`、`spec-work`、`spec-code-review` 在不同仓库形态下都能读到正确上下文边界，并让 `stage0-context` 成为三类场景下统一的运行时入口。

## 2. 问题定义

当前仓库已经分别具备两部分基础能力，但尚未统一为一个正式 contract：

1. `workspace` 能力已经存在于运行器与下游 resolver 中，但对外 skill 契约仍偏单目标路径语义。
2. `single-repo` 主链已稳定，但 `monorepo / multi-module` 还没有成为一等拓扑对象。

这导致当前系统存在五个现实问题：

1. 运行器实现能力与 `skills/spec-graph-bootstrap/SKILL.md` 的对外语义不一致。
2. `repo_shape` 仍然承担过多含混职责，既像展示字段，又被拿来隐式表达仓库形态。
3. bootstrap 即使“生成了文档”，也可能因为缺少 `context-routing.json`、`minimal-context/*` 等关键 contract，而无法被后续 workflow 稳定消费。
4. `stage0-context` 在不同场景下虽然能工作，但对外 JSON 仍不够统一，LLM 往往知道“读哪些资产”，却不知道“为什么命中这些资产”。
5. workspace 根级仍缺少 slug 治理、child readiness snapshot 边界与 nested topology 显式表达，影响多仓场景的稳定性与可解释性。

### 2.1 当前“中断确认”问题的根因

本计划还需要显式处理一个产品体验问题：在聚合目录触发 `spec-graph-bootstrap` 时，当前系统容易在执行中途发现“目标目录并不是单一 git repo”，从而暂停并向用户确认。

这类中断并不完全是错误，它通常来自三个真实边界：

1. 当前目录不是 git repo，而是 workspace / 聚合目录。
2. 下层存在多个 child repo，且 agent 无法从现有 contract 中判断“默认应该分析哪个目标”。
3. skill 文本仍然偏向单 `target-repo-path` 语义，没有把 workspace 作为正式一等支持面写清楚。

因此，这类中断的根因不是“缺一个 docs 索引文件”，而是：

1. 目标解析策略不完整
2. workspace 支持面未正式化
3. workspace 根级与 child repo 级产物边界未在对外 contract 中明确

### 2.2 需要达到的默认决策行为

本轮方案应把“何时默认继续、何时必须确认”写成稳定策略，而不是留给 agent 临场猜测。

建议固定如下：

1. 当前目录是单 git repo
   - 默认直接对当前 repo 执行 bootstrap

2. 当前目录不是 git repo，但已存在有效 `workspace-registry.json`
   - 默认按 workspace 模式继续，不再中断确认

3. 当前目录不是 git repo，且可稳定发现多个 child repo
   - 若调用者明确传入 `repoRoots`，默认按 workspace 模式继续
   - 若未传 `repoRoots`，但自动发现结果大于 1 个 child repo，允许按 workspace 模式继续
   - 只有在发现结果为空、存在冲突 registry、或当前目录与历史 slug 产物明显不一致时，才中断确认

4. 当前目录不是 git repo，但仅发现 1 个 child repo
   - 不要静默塌缩为 single-repo
   - 仍按 workspace 语义建模，避免后续目录结构变化后行为突变

## 3. 范围边界

### 3.1 本轮纳入范围

1. 为 Stage-0 引入统一 `topology` contract
2. 正式化 `workspace_multi_repo`
3. 正式化 `monorepo_multi_module`
4. 保持 `single_repo` 兼容
5. 让 `stage0-context` 与 workspace / repo / module 选择逻辑接入拓扑真源
6. 统一 `stage0-context` 对外输出 contract
7. 明确 nested topology 的轻量表达方式
8. 收紧 bootstrap 成功语义，避免“生成不完整但 status=complete”
9. 补强 workspace slug 治理与 child readiness snapshot 边界

### 3.2 本轮明确不做

1. 任意深度递归拓扑推导
2. workspace 根级高知识密度决策包设计
3. 通用 cross-repo 知识库或重 orchestrator
4. 一次性补齐所有生态的 monorepo 检测
5. 把 module 做成独立 repo 级产物目录
6. 把质量门升级成多状态流转的强编排状态机

本轮优先支持：

1. workspace 多独立 git 子仓
2. Maven 多 module 单 git 项目
3. 现有单仓单项目

## 4. 设计原则

1. `workspace` 与 `monorepo` 不是同一个概念，不能混建。
2. `topology` 是 machine-readable 真源，`repo_shape` 降级为 display-only 兼容字段。
3. workspace 根级只负责注册、匹配、聚合；主要决策输入仍来自 child repo 或 module。
4. 单仓主链的 `selected_assets` 顺序与下游行为必须保持兼容，除非新的 topology contract 明确要求不同。
5. 不把质量提升建立在更多状态机上，而建立在更真实的边界、命中和输入事实之上。
6. `stage0-context` 应优先暴露 selection facts 与 readiness facts，而不是把执行路径写死成 orchestrator。
7. `selected_assets` 作为兼容简化视图保留，但新的解释层应逐步以 `selection_subject` 与 `selected_contexts` 为主。

## 5. 目标 contract

### 5.1 `fact-inventory.json`

新增稳定 `topology` 字段：

```json
{
  "topology": {
    "schema_version": "v1",
    "kind": "workspace_multi_repo | monorepo_multi_module | single_repo",
    "container_kind": "workspace | git_repo",
    "selection_granularity": "repo | module | project",
    "root_path": ".",
    "units": [
      {
        "id": "hs-kaz-crm-service",
        "kind": "repo | module | project",
        "path": "hs-kaz-crm-service",
        "git_root": "hs-kaz-crm-service",
        "build_system": "maven",
        "signals": ["child-git-root"]
      }
    ]
  }
}
```

### 5.2 三类拓扑语义

1. `workspace_multi_repo`
   - 容器是非 git workspace 根目录
   - `units` 是 child repo
   - 选择粒度是 `repo`

2. `monorepo_multi_module`
   - 容器是单 git root
   - `units` 是 module
   - 选择粒度是 `module`

3. `single_repo`
   - 容器是单 git root
   - `units` 只有一个 project
   - 选择粒度是 `project`

### 5.3 兼容策略

1. `project_identity.repo_shape` 保留，但只作为展示字段，不再作为运行时唯一真源。
2. 现有 `modules` 字段保留为人类可读辅助信息；运行时逐步迁移到 `topology.units`。
3. workspace 根级继续保留 `workspace-registry.json` 与 `workspace-routing.json`，但 child repo 决策仍依赖 child Stage-0。
4. `topology` 优先作为 `fact-inventory v1` 的向后兼容增量字段落地，除非现有 schema 明确无法承载，否则不单独升级另一套 schema 主版本。

### 5.4 docs 索引镜像策略

当前实现里，workspace 根级 runtime 真源已经是：

1. `.spec-first/workflows/bootstrap/<workspaceSlug>/workspace-registry.json`
2. `.spec-first/workflows/bootstrap/<workspaceSlug>/workspace-routing.json`

因此，本轮不应在 `docs/` 下再发明一个“唯一真源的大 YAML 文件”。

如果为了人类阅读与审查需要提供总索引，建议采用“镜像产物”策略：

1. 可选新增：
   - `docs/contexts/<workspaceSlug>/workspace/repo-registry.yaml`

2. 其内容必须来自 `workspace-registry.json` 的单向渲染，不允许反向成为 runtime 读取真源。

3. runtime 继续只读取 `.spec-first/workflows/bootstrap/<workspaceSlug>/workspace-registry.json` 与 `workspace-routing.json`。

这样可以同时满足两件事：

1. 人类在 `docs/` 中能快速看到 workspace 内有哪些 repo
2. 系统不会因为 docs YAML 与 control-plane JSON 漂移而出现双真源问题

### 5.5 `stage0-context` 统一输出 contract

建议在不破坏兼容性的前提下，把 Stage-0 对外 contract 明确拆成两层：

1. `selection_subject` 与 `selected_contexts`
   - 解释型真源
   - 回答“命中了谁、为什么命中、当前上下文边界是什么”
2. `selected_assets` / `fallback_reason` / `level` / `skipped_rules`
   - 兼容视图
   - 保留给现有 workflow 与 runtime mirror 消费
   - 必须由解释层单向派生，不允许反向把兼容字段重新当成命中主体真源

这层拆分的目标是提升 LLM 的决策输入质量，而不是发明新的执行树。

#### A. `selection_subject`

```json
{
  "selection_subject": {
    "kind": "workspace | repo | module | project",
    "owner_slug": "crm-workspace",
    "subject_slug": "repo-a",
    "unit_id": "member-center",
    "path": "services/member-center",
    "match_reason": "cwd | targetPath | changedFiles | repoRoots | default",
    "provenance": "workspace-routing | topology.units | single-repo-default"
  }
}
```

设计要求：

1. single repo 场景也输出它，只是 `kind=project`
2. workspace 场景先表达命中的 repo subject
3. monorepo 场景允许表达 `kind=module`
4. nested 场景允许通过 `owner_slug + unit_id` 表达“命中的 module 隶属于哪个 repo”
5. `kind=workspace` 不是常规执行主体，只允许用于 `workspace-overview-only` 或 unresolved fallback
6. 只要 `selection_subject.kind=workspace`：
   - `level` 不得为 `L0`
   - `fallback_reason` 必须非空
   - `selected_contexts` 只能表达 workspace overview 资产
7. 只要是可执行的 `L0` 主体，`selection_subject.kind` 只能是 `project | repo | module`

#### B. `selected_contexts`

```json
{
  "selected_contexts": [
    {
      "scope": "workspace | repo | module | project",
      "slug": "repo-a",
      "repo_root": "/abs/path/repo-a",
      "unit_id": "member-center",
      "asset_path": "minimal-context/plan.json",
      "reason": "stage-default | output_exists.code_facts_public_entrypoints | workspace-overview-default",
      "priority": 100
    }
  ]
}
```

设计要求：

1. single repo / monorepo / workspace 三类场景都输出同形结构
2. `selected_assets` 继续保留为兼容字段
3. `selected_assets` 视为简化视图，`selected_contexts` 视为解释型真源
4. 兼容视图的顺序和内容必须由 `selected_contexts` 单向派生，不允许下游 workflow 自己重建命中语义

#### C. 公开 consumer 迁移边界

Unit 2 的完成标准不是“核心实现新增字段成功”，而是所有公开 Stage-0 consumer 都收口到同一口径。

至少包括：

1. workflow skills：
   - `spec-plan`
   - `spec-work`
   - `spec-work-beta`
   - `spec-code-review`
2. runtime-generated workflow mirrors 与 `using-spec-first` 注入链路
3. contract consistency / runtime consumption tests：
   - `tests/unit/using-spec-first-runtime-contracts.test.js`
   - `tests/unit/workflow-stage0-consumption.test.js`
   - `tests/unit/asset-consistency.test.js`
   - `tests/unit/spec-work-beta-contracts.test.js`

### 5.6 workspace child readiness snapshot

workspace 根级除了保留 `workspace-registry.json` 与 `workspace-routing.json` 外，可以额外暴露 child readiness snapshot，但这层必须与 routing 真源分离。

推荐新增独立 summary artifact：

1. `.spec-first/workflows/bootstrap/<workspaceSlug>/workspace-readiness-summary.json`

其 child record 至少包含：

```json
{
  "childSlug": "repo-a",
  "topology_kind": "single_repo | monorepo_multi_module",
  "build_system": "maven | unknown",
  "module_count": 4,
  "data_quality": "fact-backed | partial | empty",
  "freshness_status": "healthy | stale | unknown",
  "fallback_reason": null,
  "observed_at": "2026-04-20T00:00:00.000Z",
  "source": "bootstrap-summary"
}
```

设计要求：

1. `workspace-registry.json` 只承载稳定 identity / discovery facts，不混入易漂移 readiness 真相
2. `workspace-readiness-summary.json` 只表达 advisory-only snapshot，不引入 gate machine
3. runtime routing 与 gate 判定不得依赖 readiness summary；如与运行时动态聚合冲突，以 runtime 事实为准
4. 这层 snapshot 的作用是提升 workspace overview 的可观测性与 LLM 决策输入质量，而不是驱动 reroute / auto-block

### 5.7 slug 命名空间治理

建议把 slug 治理写成正式 contract：

1. child slug 必须唯一于 siblings
2. child slug 不得等于 `workspaceSlug`
3. child slug 不得落入保留名：
   - `workspace`
   - `bootstrap`
   - `contexts`
4. 冲突时使用稳定、可重建的 deterministic suffix

这层治理的目标是：

1. 防止 workspace 根级与 child repo 级产物路径冲突
2. 让 workspace rerun / prune / telemetry 行为可重建、可解释

### 5.8 迁移与边界约束

本轮迁移必须坚持“轻 contract + 明确边界 + 让 LLM 决策”，因此额外约束如下：

1. 不引入第二套 workspace/runtime orchestrator；新增内容只允许补强现有 control-plane contract。
2. 不把 module 伪装成 child repo，也不把单 child workspace 静默塌缩成 `single_repo`。
3. workspace 负责注册、匹配、聚合；repo/module 负责提供决策输入与验证输入。
4. `minimal-context`、`change-surface`、`verification_summary` 必须与 topology 命中语义同步升级，避免 resolver 已命中 module，但下游仍只产出 repo 级上下文卡片。
5. nested topology 通过 `selection_subject` 与 `selected_contexts` 表达层次关系，不新增第二套嵌套状态机。

## 6. 架构方向

整体路径分为三层 facts，而不是多阶段 flow-control：

1. `topology facts`
   - 判断当前目录是 workspace、monorepo 还是 single repo
   - 产出稳定 `topology`

2. `selection facts`
   - 回答这次 Stage-0 命中了哪个 repo / module / project
   - 产出 `selection_subject` 与 `selected_contexts`

3. `readiness facts`
   - 回答当前上下文的 freshness、data quality、fallback reason、child readiness

这套分层能保证：

1. 不把 workspace 伪装成 monorepo
2. 不把 module 伪装成 child repo
3. 不破坏现有单仓路径
4. 不把质量门升级成强编排状态机

## 7. 实施顺序

### Unit 1：收口 topology contract

**Goal:** 为三类仓库形态建立单一拓扑真源。

**Files:**
- Modify: `skills/spec-graph-bootstrap/SKILL.md`
- Modify: `src/bootstrap-compiler/derive-bootstrap-facts.js`
- Modify: `src/bootstrap-compiler/sample-generator.js`
- Modify: `docs/contracts/spec-graph-bootstrap/**`
- Test: `tests/unit/spec-graph-bootstrap-compiler.test.js`
- Test: `tests/unit/spec-graph-bootstrap-contracts.test.js`

**Approach:**
- 在 `derive-bootstrap-facts.js` 中引入 `topology.kind` 与 `topology.units` 产出。
- 优先把 `topology` 作为 `fact-inventory v1` 的增量字段写入 sample、schema 与 checked-in fixtures，先守住向后兼容。
- 将 `repo_shape` 明确降为兼容展示字段。
- 在 `skills/spec-graph-bootstrap/SKILL.md` 中正式写明三类支持场景与边界。

**Test scenarios:**
- 普通单仓输出 `single_repo`
- workspace 根输出 `workspace_multi_repo`
- Maven parent repo 输出 `monorepo_multi_module`

**Verification:**
- `pnpm test -- --runInBand tests/unit/spec-graph-bootstrap-compiler.test.js`
- `pnpm test -- --runInBand tests/unit/spec-graph-bootstrap-contracts.test.js`

### Unit 2：统一 `stage0-context` 输出 contract

**Goal:** 让三类场景下的 Stage-0 对外 JSON 更统一、更可解释。

**Files:**
- Modify: `src/cli/commands/stage0-context.js`
- Modify: `src/bootstrap-compiler/workspace-compiler.js`
- Modify: `src/context-routing/workspace-loader.js`
- Modify: `skills/spec-plan/SKILL.md`
- Modify: `skills/spec-work/SKILL.md`
- Modify: `skills/spec-work-beta/SKILL.md`
- Modify: `skills/spec-code-review/SKILL.md`
- Modify: `tests/unit/stage0-context-command.test.js`
- Modify: `tests/unit/spec-plan-contracts.test.js`
- Modify: `tests/unit/spec-work-contracts.test.js`
- Modify: `tests/unit/spec-work-beta-contracts.test.js`
- Modify: `tests/unit/spec-review-contracts.test.js`
- Modify: `tests/unit/using-spec-first-runtime-contracts.test.js`
- Modify: `tests/unit/workflow-stage0-consumption.test.js`
- Modify: `tests/unit/asset-consistency.test.js`

**Approach:**
- 新增 `selection_subject` 与统一 `selected_contexts`
- 明确 `selection_subject / selected_contexts` 是解释型真源
- 保持 `selected_assets` / `fallback_reason` / `level` / `skipped_rules` 不删除，但把它们降格为 compatibility view
- compatibility view 必须由解释层单向派生，不允许 workflow 或 runtime mirror 继续把旧四元组当成命中主体真源
- 把公开 consumer 迁移范围显式扩展到 `spec-work-beta`、runtime-generated mirrors、`using-spec-first` 注入链路与 contract consistency tests
- 明确 `selection_subject.kind=workspace` 只允许用于 overview / unresolved fallback，不允许作为常规 `L0` 执行主体

**Test scenarios:**
- single repo 输出 `selection_subject.kind=project`
- workspace 输出 `selection_subject.kind=repo`
- workspace overview / unresolved fallback 时才允许 `selection_subject.kind=workspace`
- `selected_contexts` 与 `selected_assets` 顺序保持兼容

**Verification:**
- `pnpm test -- --runInBand tests/unit/stage0-context-command.test.js`
- `pnpm test -- --runInBand tests/unit/spec-plan-contracts.test.js`
- `pnpm test -- --runInBand tests/unit/spec-work-contracts.test.js`
- `pnpm test -- --runInBand tests/unit/spec-work-beta-contracts.test.js`
- `pnpm test -- --runInBand tests/unit/spec-review-contracts.test.js`
- `pnpm test -- --runInBand tests/unit/using-spec-first-runtime-contracts.test.js`
- `pnpm test -- --runInBand tests/unit/workflow-stage0-consumption.test.js`
- `pnpm test -- --runInBand tests/unit/asset-consistency.test.js`

### Unit 3：正式化 workspace 多 git 工程支持与治理

**Goal:** 把当前已有的 workspace 能力收敛成正式支持面，同时补齐 slug 治理与 child readiness snapshot 边界。

**Files:**
- Modify: `src/bootstrap-compiler/run-bootstrap.js`
- Modify: `src/bootstrap-compiler/workspace-compiler.js`
- Modify: `src/bootstrap-compiler/workspace-registry.js`
- Modify: `src/context-routing/entry-resolver.js`
- Modify: `src/context-routing/workspace-loader.js`
- Modify: `tests/unit/workspace-context.test.js`
- Modify: `tests/unit/stage0-context-command.test.js`
- Modify: `tests/unit/spec-graph-bootstrap-compiler.test.js`

**Approach:**
- 保持 `workspace-registry.json` / `workspace-routing.json` 作为 workspace 根级 control plane。
- registry 中的 child record 只增补稳定 discovery facts：
  - `topology_kind`
  - `build_system`
  - `module_count`
- 新增独立 `workspace-readiness-summary.json`：
  - `data_quality`
  - `freshness_status`
  - `fallback_reason`
  - `observed_at`
  - `source`
- 明确 `workspace-readiness-summary.json` 只是 advisory-only snapshot：
  - 不参与 routing 真源判定
  - 不参与 gate block/allow 判定
  - 与 runtime 动态聚合冲突时，以 runtime 事实为准
- 把 `workspaceSlug` 纳入 child slug 保留命名空间
- 明确 workspace 触发规则：
  - 显式 `repoRoots` 优先
  - 自动发现 child git repo 作为可选能力，不直接成为唯一主链
- 明确 workspace 默认决策规则：
  - 已存在有效 registry 时不再中断确认
  - 自动发现多个 child repo 时允许默认进入 workspace 模式
  - 只有目标歧义无法消解时才中断确认
- 显式修正当前 `workspace-compiler.js` 中“`repoRoots.length === 1 && entry.mode !== 'workspace-registered'` 即回落 single-repo”的塌缩路径：
  - 对非 git 聚合目录 + 单 child repo 仍保持 workspace 语义
  - 只有调用方明确就是单 repo 目标时才进入 `single-repo`

**Test scenarios:**
- 显式 `repoRoots` 场景生成 workspace registry/routing
- child repo cwd 命中 workspace child，不退化为 single-repo fallback
- child repo 缺关键 contract 时，workspace 返回 `workspace_child_partial_degraded`
- 非 git 聚合目录自动发现多个 child repo 时，不再因为“不是单 git repo”而中断主链
- 非 git 聚合目录存在有效 workspace registry 时，默认进入 `workspace-registered`
- readiness summary 缺失或陈旧时，不影响 runtime routing 主链
- child slug 与 `workspaceSlug` 冲突时，被稳定规避

**Verification:**
- `pnpm test -- --runInBand tests/unit/workspace-context.test.js`
- `pnpm test -- --runInBand tests/unit/stage0-context-command.test.js`
- `pnpm test -- --runInBand tests/unit/spec-graph-bootstrap-compiler.test.js`

### Unit 4：支持单 git 多 module

**Goal:** 让单 git 多 module 成为正式拓扑对象，而不是目录启发式。

**Files:**
- Modify: `src/bootstrap-compiler/derive-bootstrap-facts.js`
- Modify: `src/bootstrap-compiler/compile-human-assets.js`
- Modify: `src/bootstrap-compiler/compile-minimal-context.js`
- Create: `tests/unit/monorepo-topology.test.js`
- Create: `tests/unit/spec-graph-bootstrap-monorepo.test.js`

**Approach:**
- 优先支持 Maven 多 module：
  - 根 `pom.xml` 存在 `<modules>`
  - child module 自身有 `pom.xml`
- `topology.kind=monorepo_multi_module` 时，`topology.units` 输出稳定 module 列表。
- `module-map.md` 与 summary 文案基于 module units，而不是只打印目录切片。
- `compile-minimal-context.js` 同步消费 module units，确保 Stage-0 卡片不是只保留 repo 粒度的旧语义。
- 明确 multi-module 仍然只落一套 repo 级目录，不新增 `docs/contexts/<module>/`

**Test scenarios:**
- Maven parent repo 正确识别 module 数量
- `topology.units[].kind` 为 `module`
- human assets 中能看到真实 module 边界

**Verification:**
- `pnpm test -- --runInBand tests/unit/monorepo-topology.test.js`
- `pnpm test -- --runInBand tests/unit/spec-graph-bootstrap-monorepo.test.js`

### Unit 5：让 Stage-0 resolver 接 topology，并显式支持 nested topology

**Goal:** 让下游 workflow 按拓扑单元选择上下文，并让“workspace child repo 本身是 monorepo”成为正式 contract。

**Files:**
- Modify: `src/bootstrap-compiler/workspace-compiler.js`
- Modify: `src/bootstrap-compiler/compile-minimal-context.js`
- Modify: `src/context-routing/entry-resolver.js`
- Modify: `src/context-routing/change-surface.js`
- Modify: `src/context-routing/verification-summary.js`
- Modify: `src/cli/commands/stage0-context.js`
- Modify: `tests/unit/change-surface.test.js`
- Create: `tests/unit/stage0-context-monorepo.test.js`
- Create: `tests/unit/verification-summary-topology.test.js`
- Create: `tests/unit/workspace-nested-topology.test.js`

**Approach:**
- workspace 场景优先选择 repo unit。
- monorepo 场景根据 `cwd` / `target` / `changedFiles` 命中 module unit。
- single repo 保持当前行为。
- `minimal-context`、`change-surface`、`verification_summary` 与 `selected_contexts` 的命中来源统一切换到 `topology.units`，避免出现“resolver 命中 module，但 context card / verification 仍是 repo 级”的半升级状态。
- nested topology 通过 `selection_subject` 与 `selected_contexts` 表达“先选 repo，再表达 optional subunit”，不新增第二套嵌套状态机。

**Test scenarios:**
- monorepo 改动单个 module 文件时，只命中对应 module
- workspace child repo 命中仍保留 workspace overview 资产
- workspace child repo 本身是 monorepo 时，既能命中 repo，又能表达 subunit
- single repo `selected_assets` 顺序保持不变

**Verification:**
- `pnpm test -- --runInBand tests/unit/change-surface.test.js`
- `pnpm test -- --runInBand tests/unit/stage0-context-monorepo.test.js`
- `pnpm test -- --runInBand tests/unit/stage0-context-command.test.js`
- `pnpm test -- --runInBand tests/unit/verification-summary-topology.test.js`
- `pnpm test -- --runInBand tests/unit/workspace-nested-topology.test.js`

### Unit 6：收紧 bootstrap 成功语义

**Goal:** 解决“生成了部分文件但下游仍不可消费”的成功假象。

**Files:**
- Modify: `src/bootstrap-compiler/run-bootstrap.js`
- Modify: `src/bootstrap-compiler/compile-routing.js`
- Modify: `src/bootstrap-compiler/compile-machine-artifacts.js`
- Modify: `tests/e2e/spec-graph-bootstrap-mainline.sh`
- Modify: `tests/unit/spec-graph-bootstrap-compiler.test.js`
- Modify: `tests/unit/spec-graph-bootstrap-contracts.test.js`

**Approach:**
- 明确定义 bootstrap 的最小成功集合：
  - `fact-inventory.json`
  - `risk-signals.json`
  - `test-surface.json`
  - `artifact-manifest.json`
  - `context-routing.json`
  - `freshness.json`
  - `minimal-context/plan.json`
  - `minimal-context/work.json`
  - `minimal-context/review.json`
  - `verification-profile.json`
- 缺少关键 control-plane 文件时，不得写 `status=complete`。

**Test scenarios:**
- bootstrap complete 时，evaluator 不再返回 `routing_missing`
- 缺关键 contract 时，bootstrap 应失败或显式降级
- child repo 的 workspace 发布不能只写 overview 而缺 Stage-0 主控制面

**Verification:**
- `bash tests/e2e/spec-graph-bootstrap-mainline.sh`
- `pnpm test -- --runInBand tests/unit/spec-graph-bootstrap-compiler.test.js`
- `pnpm test -- --runInBand tests/unit/spec-graph-bootstrap-contracts.test.js`

### Unit 7：文档与技能链路收口

**Goal:** 让实现能力、技能文案、合同文档三者一致。

**Files:**
- Modify: `skills/spec-plan/SKILL.md`
- Modify: `skills/spec-work/SKILL.md`
- Modify: `skills/spec-work-beta/SKILL.md`
- Modify: `skills/spec-code-review/SKILL.md`
- Modify: `docs/10-prompt/skills/spec-plan/SKILL.md`
- Modify: `docs/10-prompt/skills/spec-work/SKILL.md`
- Modify: `docs/10-prompt/skills/spec-work-beta/SKILL.md`
- Modify: `docs/10-prompt/skills/spec-code-review/SKILL.md`
- Modify: `docs/contracts/spec-graph-bootstrap/**`
- Modify: `docs/02-架构设计/2026-04-20-spec-graph-bootstrap-topology-output-and-spec-plan-consumption.md`
- Modify: `docs/项目审查/spec-graph-bootstrap/**`

**Approach:**
- 把 Stage-0 下游文档中的单仓假设调整为：
  - 默认单仓消费
  - workspace / monorepo / nested topology 在 runtime entry 命中后按拓扑单元展开
- 清理 `spec-graph-bootstrap` 相关文档里“实现已支持但 skill 未声明”的口径漂移。
- 为 workspace 根级补一个人类可读镜像索引：
  - `docs/contexts/<workspaceSlug>/workspace/repo-registry.md` 保持现有
  - 可选新增 `docs/contexts/<workspaceSlug>/workspace/repo-registry.yaml`
- 明确文档定位：
  - `workspace-registry.json` / `workspace-routing.json` 是 machine-first 真源
  - `workspace-readiness-summary.json` 是 advisory-only summary，不是 routing / gate 真源
  - `repo-registry.md` / `repo-registry.yaml` 是 human-facing 镜像，不参与 runtime 判定
- 明确 `stage0-context` 是首要运行时入口，而不是在 workflow 文档中继续硬编码 repo-only 路径预载
- 明确 Stage-0 对外 contract 的分层：
  - `selection_subject / selected_contexts` 是解释型真源
  - `selected_assets / fallback_reason / level / skipped_rules` 是兼容视图
- 明确 `selection_subject.kind=workspace` 仅用于 overview / unresolved fallback
- 文档与镜像测试必须覆盖 `spec-work-beta` 与 runtime-generated mirrors，避免再次出现“计划已升级、公开 contract 仍双口径”

**Test scenarios:**
- 文档说明与实际 runtime 行为不再冲突
- workspace / monorepo / nested topology 不再只存在于实现或审查文档里
- docs 镜像索引存在时，不会被 runtime 当成新的 routing 真源

**Verification:**
- 文档人工审查
- 相关 contract / runtime 单测全部通过

## 8. 测试矩阵

本计划完成后，至少要覆盖以下矩阵：

1. `workspace_multi_repo`
   - workspace 根级 bootstrap
   - child repo 完整 Stage-0
   - child cwd 命中 repo unit
   - child readiness summary 可读

2. `monorepo_multi_module`
   - Maven parent repo
   - module unit 正确识别
   - changed file 命中 module
   - `selection_subject.kind=module`

3. `single_repo`
   - 现有主链不回归
   - `selected_assets` 顺序不变
   - `selection_subject.kind=project`

4. 嵌套场景
   - workspace child repo 本身是 multi-module
   - 先命中 repo，再在 repo 内表达 module facts
   - `selected_contexts` 能表达层次关系

5. 降级场景
   - workspace child 缺关键 contract
   - monorepo 缺 module facts
   - single repo 缺 control-plane

6. 治理场景
   - child slug 与 `workspaceSlug` 冲突时稳定规避
   - docs 镜像存在时不引入双真源
   - `selection_subject.kind=workspace` 只出现在 overview / unresolved fallback
   - readiness summary 不参与 routing 真源

## 9. 风险与取舍

1. 不要把 monorepo module 生成为伪 child repo slug；这会污染 git 边界与 telemetry 语义。
2. 不要让 workspace 根级文档承担 child repo 的主要决策输入职责；workspace 根级仍以索引为主。
3. 不要为了统一三类场景，引入另一套重状态机；`topology`、`selection_subject`、`selected_contexts` 都只负责表达边界和命中对象。
4. Java Maven 多 module 是本轮优先场景，Gradle / pnpm workspace / Cargo workspace 可后续增量补齐。
5. `selected_assets` 作为兼容字段要持续保留一段时间，避免一次性切断下游 workflow。
6. 不要把 `workspace-registry.json` 做成 identity、routing、readiness、gate 的混合真源文件。

## 10. 完成标准

满足以下条件时，本计划视为完成：

1. KAZ 这类父目录 workspace 能生成正式 workspace bootstrap，并让后续 workflow 自动命中 child repo。
2. Maven 多 module 单 git 项目能稳定输出 `topology.kind=monorepo_multi_module` 与 module units。
3. 普通单仓单项目行为不回归。
4. bootstrap complete 后，下游 evaluator 不再因为缺关键 contract 退化到 `L2/L3`。
5. 在聚合目录触发 workspace bootstrap 时，不再因为“根目录不是 git repo”而频繁中断确认。
6. 如新增 `docs/contexts/<workspaceSlug>/workspace/repo-registry.yaml`，其角色仅为人类镜像，不引入双真源。
7. 非 git 聚合目录即使只发现 1 个 child repo，也不会被静默塌缩成 `single-repo`。
8. monorepo 命中 module unit 后，`minimal-context`、`change-surface`、`verification_summary` 与 `selected_contexts` 保持同一粒度。
9. `stage0-context` 在三类场景下输出统一、可解释的 `selection_subject` 与 `selected_contexts`。
10. workspace 根级如需持久化 child readiness，只通过 `workspace-readiness-summary.json` 暴露 advisory-only snapshot，不把它混入 registry / routing 真源。
11. workspace child repo 本身是 monorepo 时，能够表达 nested topology，而不引入第二套嵌套状态机。
12. `workspaceSlug` 与 `childSlug` 不会发生路径覆盖级冲突。
13. `selection_subject.kind=workspace` 只出现在 overview / unresolved fallback，不能作为常规 `L0` 执行主体。
14. 所有公开 Stage-0 consumer，包括 `spec-work-beta`、runtime mirrors、`using-spec-first` 注入链路与 contract consistency tests，均收口到同一 contract 口径。

## 11. 建议执行顺序

建议严格按以下顺序执行：

1. Unit 1：topology contract
2. Unit 2：统一 `stage0-context` 输出 contract
3. Unit 3：workspace 正式化与治理
4. Unit 4：Maven multi-module
5. Unit 5：resolver 接 topology 并显式支持 nested topology
6. Unit 6：bootstrap success 语义
7. Unit 7：文档与技能链路收口

这个顺序的原因是：

1. 没有 `topology` 真源，就没有统一命中语义。
2. 没有统一的 `stage0-context` 输出 contract，下游 workflow 很难稳定消费三类场景。
3. workspace 是当前最急迫的真实用户场景，且 slug / readiness 问题最影响实际可用性。
4. monorepo 支持应建立在 contract 已稳定的前提下。
5. nested topology 必须建立在 repo / module 都已有清晰输出面之后。
6. 成功语义收紧必须放在主链行为稳定之后，否则会把调试与演进混在一起。
