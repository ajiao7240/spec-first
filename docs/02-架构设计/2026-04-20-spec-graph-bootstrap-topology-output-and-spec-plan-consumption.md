# spec-graph-bootstrap 三类拓扑产物与 spec-plan Stage-0 消费对照说明

> Lifecycle: historical-input / external-reference. 本文保留旧架构、方案、迁移或研究记录；当前 source of truth 以 `docs/README.md`、根目录 README、`docs/05-用户手册/`、`docs/contracts/`、`skills/`、`src/cli/` 和 `CHANGELOG.md` 为准。

**说明日期**：2026-04-20  
**适用范围**：`spec-graph-bootstrap`、`stage0-context`、`spec-plan`  
**说明目标**：回答三类仓库形态下，最终产物目录如何落地，以及后续 `spec-plan` 实际先读哪些文件  
**分析基线**：以当前仓库头状态实现为准，必要处补充“目标方案”说明，不把规划态伪装成已实现能力

---

## 一、结论先看

当前实现下，三类场景的物理产物目录可以概括为：

1. 父目录下多个独立 git 工程
   - 产物锚定在父目录根下
   - 目录层级是“workspace 一套 + 每个 child repo 一套”
   - `spec-plan` 先通过 workspace 根级 registry/routing 识别目标 child，再读取 child repo 的 Stage-0 control-plane

2. 单个 git 工程下多个 module
   - 当前物理目录仍只有“一套 repo 级产物”
   - module 不是单独的产物根目录，不会生成 `docs/contexts/<module>/`
   - 当前实现里 `spec-plan` 仍按单 repo Stage-0 消费；module-aware 主要是目标方案，不是已完全落地能力

3. 单个 git 工程单项目
   - 最简单，就是“一套 repo 级产物”
   - `spec-plan` 直接读取该 repo 的 Stage-0 control-plane 和选中的上下文文档

一句话区分：

```text
多个独立 git 工程 = workspace 根级路由 + 多个 repo 级产物
单 git 多 module     = 单个 repo 级产物，module 写在内容里，不另起目录
单 git 单项目        = 单个 repo 级产物，project 粒度
```

---

## 二、三类场景产物目录总对照图

```text
场景 A：父目录下多个独立 git 工程
workspace-root/
├── .spec-first/workflows/bootstrap/<workspaceSlug>/         # workspace 根级 control-plane
├── .spec-first/workflows/bootstrap/<repo-a-slug>/           # child repo A control-plane
├── .spec-first/workflows/bootstrap/<repo-b-slug>/           # child repo B control-plane
├── docs/contexts/<workspaceSlug>/                           # workspace 根级 overview docs
├── docs/contexts/<repo-a-slug>/                             # child repo A docs
└── docs/contexts/<repo-b-slug>/                             # child repo B docs

场景 B：单个 git 工程下多个 module
repo-root/
├── .spec-first/workflows/bootstrap/<repoSlug>/             # 单套 repo control-plane
└── docs/contexts/<repoSlug>/                               # 单套 repo docs

场景 C：单个 git 工程单项目
repo-root/
├── .spec-first/workflows/bootstrap/<repoSlug>/             # 单套 repo control-plane
└── docs/contexts/<repoSlug>/                               # 单套 repo docs
```

核心差异不在于 `docs/contexts/` 下目录数量本身，而在于：

1. workspace 场景有单独的 workspace 根级 control-plane 真源
2. multi-module 场景当前不单独起 module 目录，而是把 module 语义写进 repo 级产物内容
3. single-project 场景最直接，没有额外拓扑层

---

## 三、真实路径真源

当前实现里，产物路径的真源由两个 resolver 决定：

1. control-plane：`.spec-first/workflows/<workflow>/<slug>/`
2. human-facing docs：`docs/contexts/<slug>/`

对应实现见：

1. [`src/crg/artifact-paths.js`](/Users/kuang/xiaobu/spec-first/src/crg/artifact-paths.js)
2. [`src/bootstrap-compiler/run-bootstrap.js`](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/run-bootstrap.js)

其中最关键的一点是：

- 只要传入 `artifactAnchorRoot`，control-plane 和 docs 都会锚定到这个根目录
- workspace 场景下，child repo 的产物不是写回 child repo 自己目录，而是统一写到 workspace 根下

这正是为什么“父目录下多个独立 git 工程”最终会在父目录根下看到全部产物。

---

## 四、场景 A：父目录下多个独立 git 工程

### 4.1 最终目录结构

假设目录是：

```text
/workspace-root/
├── repo-a/
└── repo-b/
```

当前实现的最终产物目录是：

```text
/workspace-root/
├── .spec-first/
│   └── workflows/
│       └── bootstrap/
│           ├── <workspaceSlug>/
│           │   ├── workspace-registry.json
│           │   ├── workspace-routing.json
│           │   └── artifact-manifest.json
│           ├── repo-a/
│           │   ├── fact-inventory.json
│           │   ├── risk-signals.json
│           │   ├── test-surface.json
│           │   ├── context-routing.json
│           │   ├── artifact-manifest.json
│           │   ├── freshness.json
│           │   ├── lint-report.json
│           │   ├── contradictions.json
│           │   ├── verification-profile.json
│           │   ├── ownership.json
│           │   ├── review-queue.json
│           │   └── minimal-context/
│           │       ├── plan.json
│           │       ├── work.json
│           │       └── review.json
│           └── repo-b/
│               └── ... 同 repo-a
└── docs/
    └── contexts/
        ├── <workspaceSlug>/
        │   ├── README.md
        │   ├── 00-summary.md
        │   └── workspace/
        │       ├── routing-overview.md
        │       └── repo-registry.md
        ├── repo-a/
        │   ├── README.md
        │   ├── 00-summary.md
        │   ├── architecture/module-map.md
        │   ├── code-facts/public-entrypoints.md
        │   ├── code-facts/test-map.md
        │   ├── code-facts/high-risk-modules.md
        │   ├── pitfalls/index.md
        │   ├── context-packs/review-change.md
        │   └── injection-index.yaml
        └── repo-b/
            └── ... 同 repo-a
```

### 4.2 这个目录为什么这样落

原因是 workspace bootstrap 会：

1. 先生成 workspace 根级 `workspace-registry.json` 和 `workspace-routing.json`
2. 再对每个 child repo 调用一次 `runBootstrap`
3. 但 child repo 产物目录解析时，把 `artifactAnchorRoot` 统一设为 `workspaceRoot`

对应实现证据：

1. workspace 根级写入：[`run-bootstrap.js#L120`](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/run-bootstrap.js#L120)
2. workspace overview docs：[`run-bootstrap.js#L137`](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/run-bootstrap.js#L137)
3. child repo 产物锚定 workspace 根：[`run-bootstrap.js#L154`](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/run-bootstrap.js#L154)
4. child repo 实际调用 bootstrap：[`run-bootstrap.js#L356`](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/run-bootstrap.js#L356)

### 4.3 这个场景里 spec-plan 实际先读哪个文件

当前实现下，`spec-plan` 的最佳路径不是直接扫 `docs/contexts/`，而是先走 runtime helper：

```text
spec-plan
  -> spec-first stage0-context --stage plan --workflow spec-plan --format json
     -> resolveStage0Entry(...)
        -> 若识别到 workspace：
           先读 .spec-first/workflows/bootstrap/<workspaceSlug>/workspace-registry.json
           再读 .spec-first/workflows/bootstrap/<workspaceSlug>/workspace-routing.json
           再匹配 child repo
           再对命中的 child repo 读取：
              - context-routing.json
              - artifact-manifest.json
              - freshness.json
              - verification-profile.json
           然后按 selected_assets 组织输出
```

也就是说，这个场景里“最先被读”的是 workspace 根级控制面文件：

1. `.spec-first/workflows/bootstrap/<workspaceSlug>/workspace-registry.json`
2. `.spec-first/workflows/bootstrap/<workspaceSlug>/workspace-routing.json`

然后才进入命中的 child repo：

1. `.spec-first/workflows/bootstrap/<repoSlug>/context-routing.json`
2. `.spec-first/workflows/bootstrap/<repoSlug>/artifact-manifest.json`
3. `.spec-first/workflows/bootstrap/<repoSlug>/freshness.json`
4. `.spec-first/workflows/bootstrap/<repoSlug>/verification-profile.json`
5. 若存在，则把 `minimal-context/plan.json` 作为最高优先级 machine context 插到最前面

对应实现证据：

1. workspace entry 探测和 registry/routing 读取：[`src/context-routing/entry-resolver.js#L178`](/Users/kuang/xiaobu/spec-first/src/context-routing/entry-resolver.js#L178)
2. workspace 上下文编译入口：[`src/bootstrap-compiler/workspace-compiler.js#L63`](/Users/kuang/xiaobu/spec-first/src/bootstrap-compiler/workspace-compiler.js#L63)
3. repo 级 runtime state 读取：[`src/context-routing/loader.js#L27`](/Users/kuang/xiaobu/spec-first/src/context-routing/loader.js#L27)
4. evaluator 把 `minimal-context/plan.json` 插到最前：[`src/context-routing/evaluator.js#L169`](/Users/kuang/xiaobu/spec-first/src/context-routing/evaluator.js#L169)
5. `spec-plan` workflow 明确写了 control-plane 优先级：[`skills/spec-plan/SKILL.md#L88`](/Users/kuang/xiaobu/spec-first/skills/spec-plan/SKILL.md#L88)

### 4.4 这一场景的 machine-first / human-facing 分层

```text
machine-first 真源
├── workspace-registry.json
├── workspace-routing.json
├── context-routing.json
├── artifact-manifest.json
└── minimal-context/plan.json

human-facing 辅助文档
├── docs/contexts/<workspaceSlug>/workspace/repo-registry.md
├── docs/contexts/<workspaceSlug>/workspace/routing-overview.md
├── docs/contexts/<repoSlug>/architecture/module-map.md
└── docs/contexts/<repoSlug>/code-facts/public-entrypoints.md
```

这里要特别注意：

- `repo-registry.md` 不是 runtime 真源
- `injection-index.yaml` 也不是唯一判定真源
- 真正决定 `spec-plan` 读什么的是 `stage0-context` 生成出的 `selected_assets`

---

## 五、场景 B：单个 git 工程下多个 module

### 5.1 当前实现下的物理目录结构

这个场景当前物理目录仍然是单套 repo 级产物，不会为每个 module 建一份独立目录：

```text
/repo-root/
├── .spec-first/
│   └── workflows/
│       └── bootstrap/
│           └── <repoSlug>/
│               ├── fact-inventory.json
│               ├── risk-signals.json
│               ├── test-surface.json
│               ├── context-routing.json
│               ├── artifact-manifest.json
│               ├── freshness.json
│               ├── lint-report.json
│               ├── contradictions.json
│               ├── verification-profile.json
│               ├── ownership.json
│               ├── review-queue.json
│               └── minimal-context/
│                   ├── plan.json
│                   ├── work.json
│                   └── review.json
└── docs/
    └── contexts/
        └── <repoSlug>/
            ├── README.md
            ├── 00-summary.md
            ├── architecture/module-map.md
            ├── code-facts/public-entrypoints.md
            ├── code-facts/test-map.md
            ├── code-facts/high-risk-modules.md
            ├── pitfalls/index.md
            ├── context-packs/review-change.md
            └── injection-index.yaml
```

### 5.2 当前实现的真实边界

当前仓库头状态下：

1. 物理目录是单 repo 一套
2. `compile-minimal-context.js` 仍然主要按 repo 级 facts 组织卡片
3. multi-module 正式成为一等 topology unit，仍属于目标方案而不是完全落地能力

这也是为什么当前不能把这个场景理解成：

```text
docs/contexts/module-a/
docs/contexts/module-b/
```

那样会把 module 伪装成 child repo，破坏 git 边界和 telemetry 语义。

### 5.3 目标方案下希望表达什么

目标方案不是增加 module 级根目录，而是让 repo 级产物内容带上 module unit 语义：

1. `fact-inventory.json` 中表达 `topology.kind=monorepo_multi_module`
2. `topology.units[]` 列出 module
3. `architecture/module-map.md` 展示真实 module 边界
4. `minimal-context/plan.json`
5. `verification_summary`
6. `change-surface`

这些内容应该按 module 命中，而不是继续只按 repo 粒度表达。

### 5.4 这个场景里 spec-plan 实际先读哪个文件

当前实现下，它的入口仍然是单 repo Stage-0：

```text
spec-plan
  -> spec-first stage0-context --stage plan --workflow spec-plan --format json
     -> 读取 .spec-first/workflows/bootstrap/<repoSlug>/
        - context-routing.json
        - artifact-manifest.json
        - freshness.json
        - verification-profile.json
     -> 若存在 minimal-context/plan.json，优先把它插到 selected_assets 最前
     -> 再补 always[] / stages.plan[] / selection_rules 命中的文档
```

也就是说，当前这个场景下最先读的仍是 repo 级 control-plane：

1. `.spec-first/workflows/bootstrap/<repoSlug>/context-routing.json`
2. `.spec-first/workflows/bootstrap/<repoSlug>/artifact-manifest.json`
3. `.spec-first/workflows/bootstrap/<repoSlug>/freshness.json`
4. `.spec-first/workflows/bootstrap/<repoSlug>/verification-profile.json`
5. `.spec-first/workflows/bootstrap/<repoSlug>/minimal-context/plan.json`（如果存在）

然后才是 docs：

1. `docs/contexts/<repoSlug>/architecture/module-map.md`
2. `docs/contexts/<repoSlug>/code-facts/public-entrypoints.md`
3. `docs/contexts/<repoSlug>/00-summary.md`
4. `docs/contexts/<repoSlug>/README.md`

这里最重要的事实是：

- 当前实现里，module 不是先通过单独目录命中
- 而是先通过 repo 级 Stage-0，再在内容层表达 module 边界

---

## 六、场景 C：单个 git 工程单项目

### 6.1 最终目录结构

这是最简单的一种：

```text
/repo-root/
├── .spec-first/
│   └── workflows/
│       └── bootstrap/
│           └── <repoSlug>/
│               ├── fact-inventory.json
│               ├── risk-signals.json
│               ├── test-surface.json
│               ├── context-routing.json
│               ├── artifact-manifest.json
│               ├── freshness.json
│               ├── lint-report.json
│               ├── contradictions.json
│               ├── verification-profile.json
│               ├── ownership.json
│               ├── review-queue.json
│               └── minimal-context/
│                   ├── plan.json
│                   ├── work.json
│                   └── review.json
└── docs/
    └── contexts/
        └── <repoSlug>/
            ├── README.md
            ├── 00-summary.md
            ├── architecture/module-map.md
            ├── code-facts/public-entrypoints.md
            ├── code-facts/test-map.md
            ├── code-facts/high-risk-modules.md
            ├── pitfalls/index.md
            ├── context-packs/review-change.md
            └── injection-index.yaml
```

### 6.2 这个场景里 spec-plan 实际先读哪个文件

跟单 git 多 module 的当前入口基本一致，只是这里不存在 module 额外语义：

```text
spec-plan
  -> spec-first stage0-context --stage plan --workflow spec-plan --format json
     -> 读取 repo 级 control-plane
        - context-routing.json
        - artifact-manifest.json
        - freshness.json
        - verification-profile.json
     -> 若存在 minimal-context/plan.json，则把它排在最前
     -> 再按 routing 追加：
        - always[]
        - stages.plan[]
        - selection_rules(output_exists.*)
```

按当前 `spec-plan` 文档和 evaluator 合起来，plan 阶段实际优先顺序可以概括为：

```text
1. minimal-context/plan.json                      # 如果存在，最高优先级 machine context
2. routing.always[]                               # 例如 00-summary.md、README.md
3. routing.stages.plan[]                          # 例如 architecture/module-map.md
4. routing.selection_rules(output_exists.*)       # 例如 code-facts/public-entrypoints.md
5. advice.plan                                    # 作为消费建议，不是目录资产
```

这个顺序有历史验证记录，也和当前 `spec-plan` 文档一致：

1. [`skills/spec-plan/SKILL.md#L88`](/Users/kuang/xiaobu/spec-first/skills/spec-plan/SKILL.md#L88)
2. [`docs/validation/graph-bootstrap-3a-logs/2026-04-13-spec-plan-stage0-consumption.md`](/Users/kuang/xiaobu/spec-first/docs/validation/graph-bootstrap-3a-logs/2026-04-13-spec-plan-stage0-consumption.md)

---

## 七、三类场景下 spec-plan 读取链总对照图

```text
场景 A：父目录下多个独立 git 工程
spec-plan
  -> stage0-context
     -> workspace-registry.json
     -> workspace-routing.json
     -> 命中 child repo
     -> child context-routing.json
     -> child artifact-manifest.json
     -> child freshness.json
     -> child verification-profile.json
     -> child minimal-context/plan.json
     -> child docs assets

场景 B：单个 git 工程下多个 module
spec-plan
  -> stage0-context
     -> repo context-routing.json
     -> repo artifact-manifest.json
     -> repo freshness.json
     -> repo verification-profile.json
     -> repo minimal-context/plan.json
     -> repo docs assets
     -> 内容层表达 module 边界

场景 C：单个 git 工程单项目
spec-plan
  -> stage0-context
     -> repo context-routing.json
     -> repo artifact-manifest.json
     -> repo freshness.json
     -> repo verification-profile.json
     -> repo minimal-context/plan.json
     -> repo docs assets
```

---

## 八、哪个文件是“真源”，哪个只是展示

### 8.1 machine-first 真源

对 `spec-plan` 真正有决策意义的是：

1. `workspace-registry.json`
2. `workspace-routing.json`
3. `context-routing.json`
4. `artifact-manifest.json`
5. `minimal-context/plan.json`
6. `freshness.json`
7. `verification-profile.json`

其中：

- workspace 场景先依赖 `workspace-registry.json` / `workspace-routing.json`
- repo 场景主要依赖 `context-routing.json` / `artifact-manifest.json` / `minimal-context/plan.json`

### 8.2 human-facing 辅助文档

这些文档很重要，但它们不是 runtime 真源：

1. `README.md`
2. `00-summary.md`
3. `architecture/module-map.md`
4. `code-facts/public-entrypoints.md`
5. `workspace/repo-registry.md`
6. `workspace/routing-overview.md`
7. `injection-index.yaml`

尤其要强调：

- `injection-index.yaml` 在当前 `spec-plan` 文档里已经明确只是 human view，不再是唯一运行时判定逻辑
- `docs/contexts/<workspaceSlug>/workspace/repo-registry.md` 只是人类概览，不应该升级为第二真源

---

## 九、为什么“docs 下一个大 YAML 文件”不是正确答案

很多人看到 workspace 场景，直觉会问：

```text
docs/contexts/<workspaceSlug>/workspace/repo-registry.yaml
是不是应该成为统一入口？
```

答案是否定的。原因有三点：

1. 当前 runtime 已经有 machine-first 真源：
   - `workspace-registry.json`
   - `workspace-routing.json`

2. `spec-plan` 当前真实读取链路走的是 `stage0-context -> resolver -> evaluator`
   - 不是直接扫 docs

3. 如果再把 docs 下 YAML 变成 runtime 真源，就会形成双真源
   - control-plane JSON 一套
   - docs YAML 又一套
   - 最终违反仓库“轻 contract + 明确边界 + 让 LLM 决策”的原则

因此，docs 下如要补 YAML，也只能是镜像视图，而不能反向成为 runtime 入口。

---

## 十、最终判断

如果只看“目录数量”，这三类场景会给人一种复杂度差异不大的错觉；但真正的差异在 Stage-0 的决策入口：

1. 多独立 git 工程
   - 先路由，再消费 child repo
   - 目录上是“两层结构”

2. 单 git 多 module
   - 当前仍是“单层目录 + 内容表达多 module”
   - 正确方向是 module-aware 内容升级，不是多建目录

3. 单 git 单项目
   - 单层目录，单项目粒度

从 `spec-plan` 的视角看，真正优先级最高的并不是 docs，而是：

1. `stage0-context` 返回的 JSON 结果
2. 这个 JSON 背后的 control-plane 真源
3. 然后才是选中的 human-facing docs

这也是为什么后续所有优化，应该优先优化：

1. `workspace-registry.json` / `workspace-routing.json`
2. `context-routing.json` / `artifact-manifest.json`
3. `minimal-context/plan.json`

而不是优先去发明新的 docs 索引真源。
