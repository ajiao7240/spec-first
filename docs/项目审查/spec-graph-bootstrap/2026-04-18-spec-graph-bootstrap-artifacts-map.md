# `spec-graph-bootstrap` 当前产物清单与消费关系审查

## 一句话结论

以当前代码为准，`spec-graph-bootstrap` 已经不只是“生成几份说明文档”的轻量 bootstrap，而是会稳定写出一套 Stage-0 控制面产物与上下文文档：

- 单仓模式下，当前真实落盘产物为 `23` 个
- workspace 模式下，workspace 根目录会额外生成 `7` 个聚合产物
- 真正被下游 workflow skill 直接消费的核心产物，主要集中在：
  - `context-routing.json`
  - `artifact-manifest.json`
  - `minimal-context/plan.json`
  - `minimal-context/work.json`
  - `minimal-context/review.json`
  - `architecture/module-map.md`
  - `code-facts/public-entrypoints.md`
  - `code-facts/test-map.md`
  - `code-facts/high-risk-modules.md`
  - `context-packs/review-change.md`
  - `00-summary.md`
  - `pitfalls/index.md`

同时，`SKILL.md` 里声明的多阶段 contract 仍明显宽于当前实现，尤其是 Phase 2/3 中更重的 PRD task contract、数据库相关上下文和“两段式 manifest 写入”，在当前 `src/bootstrap-compiler/` 的真实代码里并未完整落地。

## 审查边界与证据口径

本审查严格区分三层事实：

1. `skills/spec-graph-bootstrap/SKILL.md`
   - 这是 workflow contract 与目标设计
   - 可以证明“应该生成什么”
   - 不能单独证明“当前代码已经真的写出了什么”

2. `src/bootstrap-compiler/*.js`
   - 这是当前实现真源
   - 可以证明“当前真实会写出什么、内容从哪里来、写到哪里”

3. 下游 `skills/*/SKILL.md`
   - 这是当前 workflow 消费这些产物的直接证据
   - 可以证明“哪些 skill 明确依赖这些产物”

本文件优先以第 2 类和第 3 类代码为事实依据。若 `SKILL.md` 声明与当前实现不一致，默认以实现为准，并单独列出差异。

## 关键代码依据

- 主管线：`src/bootstrap-compiler/orchestrator.js:19-73`
- 单仓真实写盘：`src/bootstrap-compiler/run-bootstrap.js:75-118`、`src/bootstrap-compiler/run-bootstrap.js:436-520`
- workspace 真实写盘：`src/bootstrap-compiler/run-bootstrap.js:120-148`、`src/bootstrap-compiler/run-bootstrap.js:283-420`
- machine artifacts 编译：`src/bootstrap-compiler/compile-machine-artifacts.js:11-86`
- minimal context 编译：`src/bootstrap-compiler/compile-minimal-context.js:55-165`
- human docs 渲染：`src/bootstrap-compiler/compile-human-assets.js:3-153`
- routing / manifest / injection index：`src/bootstrap-compiler/compile-routing.js:6-312`
- runtime 读取 control plane：`src/context-routing/loader.js:36-46`
- runtime fallback 资产：`src/context-routing/fallback.js:6-58`
- workspace runtime 入口解析：`src/context-routing/entry-resolver.js:73-188`
- workspace routing 结构：`src/bootstrap-compiler/workspace-registry.js:126-140`

## 当前真实产物结构图

### 1. 单仓模式

```text
<repo>/
├── .spec-first/
│   └── workflows/
│       └── bootstrap/
│           └── <slug>/
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
        └── <slug>/
            ├── 00-summary.md
            ├── README.md
            ├── injection-index.yaml
            ├── architecture/
            │   └── module-map.md
            ├── code-facts/
            │   ├── public-entrypoints.md
            │   ├── test-map.md
            │   └── high-risk-modules.md
            ├── context-packs/
            │   └── review-change.md
            └── pitfalls/
                └── index.md
```

### 2. workspace 模式

```text
<workspaceRoot>/
├── .spec-first/
│   └── workflows/
│       └── bootstrap/
│           ├── <workspaceSlug>/
│           │   ├── workspace-registry.json
│           │   ├── workspace-routing.json
│           │   └── artifact-manifest.json
│           └── <childSlug>/                # 每个 child repo 再各自产生单仓产物
│               └── ...
└── docs/
    └── contexts/
        ├── <workspaceSlug>/
        │   ├── 00-summary.md
        │   ├── README.md
        │   └── workspace/
        │       ├── routing-overview.md
        │       └── repo-registry.md
        └── <childSlug>/                    # 每个 child repo 再各自产生单仓上下文文档
            └── ...
```

### 3. workspace 模式的真实执行方式

workspace 不是“只生成 workspace 聚合文档”。当前实现会先为每个 child repo 调一次 `runBootstrap(...)`，然后再发布 workspace 根级聚合产物。

代码依据：

- `src/bootstrap-compiler/run-bootstrap.js:356-363`
- `src/bootstrap-compiler/run-bootstrap.js:370-371`

这意味着：

- workspace 模式会放大 `spec-graph-bootstrap` 的总产物规模
- workspace 根级产物目前主要是“路由与索引”
- 真正被后续 `plan/work/review` 消费的，仍主要是 child repo 的单仓 Stage-0 产物

## 单仓模式：控制面产物表

| 产物 | 落盘路径 | 类型 | 内容描述 | 作用域 | 当前直接消费方 | 代码依据 |
|---|---|---|---|---|---|---|
| `fact-inventory.json` | `.spec-first/workflows/bootstrap/<slug>/fact-inventory.json` | control plane / machine-readable | 仓库事实主表，包含 `project_identity`、`entrypoints`、`modules`、`integrations`、`testing_surface` 等输入事实 | single-repo，基础事实层 | 未发现 skill 直接读取；当前主要被编译阶段继续派生为 minimal-context 与 docs | `run-bootstrap.js:75-76`，`compile-machine-artifacts.js:22-38` |
| `risk-signals.json` | `.spec-first/workflows/bootstrap/<slug>/risk-signals.json` | control plane / machine-readable | 风险信号集合，供高风险模块、pitfalls、review-change 等产物派生 | single-repo，风险事实层 | 未发现 skill 直接读取；当前主要被编译阶段继续派生 | `run-bootstrap.js:77`，`compile-machine-artifacts.js:28-30` |
| `test-surface.json` | `.spec-first/workflows/bootstrap/<slug>/test-surface.json` | control plane / machine-readable | 测试文件、测试目标与测试覆盖关系输入 | single-repo，测试事实层 | 未发现 skill 直接读取；当前主要被编译阶段继续派生 | `run-bootstrap.js:78`，`compile-machine-artifacts.js:29-30` |
| `context-routing.json` | `.spec-first/workflows/bootstrap/<slug>/context-routing.json` | control plane / machine-readable | Stage 到资产集合的路由 contract，定义 `always`、`stages.*`、`selection_rules`、`advice` | single-repo，Stage-0 路由层 | `spec-plan`、`spec-work`、`spec-review`、`spec-work-beta` 都明确要求优先读取 | `run-bootstrap.js:79`，`compile-routing.js:6-57`，`skills/spec-plan/SKILL.md:77-90`，`skills/spec-work/SKILL.md:36-49`，`skills/spec-review/SKILL.md:27-40`，`skills/spec-work-beta/SKILL.md:41-54` |
| `artifact-manifest.json` | `.spec-first/workflows/bootstrap/<slug>/artifact-manifest.json` | control plane / machine-readable | 输入版本、schema 版本、输出清单、依赖关系、生成时间的总 manifest | single-repo，产物账本层 | `spec-plan`、`spec-work`、`spec-review`、`spec-work-beta` 都明确要求优先读取；runtime loader 也直接读取 | `run-bootstrap.js:80`，`compile-routing.js:251-312`，`loader.js:40-46`，四个 skill 同上 |
| `freshness.json` | `.spec-first/workflows/bootstrap/<slug>/freshness.json` | control plane / machine-readable | 基于 manifest 输入时间与输出时间构建的 freshness 报告 | single-repo，产物新鲜度层 | 未发现 direct skill 读取；runtime loader 会加载 | `run-bootstrap.js:81`，`compile-machine-artifacts.js:58-65`，`loader.js:44` |
| `lint-report.json` | `.spec-first/workflows/bootstrap/<slug>/lint-report.json` | control plane / machine-readable | 对 required assets 与 context assets 的存在性/一致性做 lint 报告 | single-repo，产物质量层 | 未发现 direct skill 明确读取；但 `context-routing.json` 的 `work/review` stage 会把它列入可选注入资产 | `run-bootstrap.js:82`，`compile-machine-artifacts.js:66-80`，`compile-routing.js:19-31` |
| `contradictions.json` | `.spec-first/workflows/bootstrap/<slug>/contradictions.json` | control plane / machine-readable | 记录 bootstrap 检测到的矛盾资产结果 | single-repo，矛盾/冲突层 | 未发现 direct skill 明确读取；但 `review` stage 路由里已纳入 | `run-bootstrap.js:83`，`compile-machine-artifacts.js:81-84`，`compile-routing.js:24-32` |
| `verification-profile.json` | `.spec-first/workflows/bootstrap/<slug>/verification-profile.json` | control plane / machine-readable | 默认必跑验证、可选验证、平台关注点等验证基线 | single-repo，验证基线层 | 未发现 direct skill 明确读取原文件；当前更多通过 `minimal-context/*.json` 被间接消费；runtime loader 也会加载 | `run-bootstrap.js:84-87`，`compile-machine-artifacts.js:39-57`，`loader.js:45` |
| `ownership.json` | `.spec-first/workflows/bootstrap/<slug>/ownership.json` | control plane / machine-readable | 当前不是从仓库事实推导，而是 sample generator 生成的 ownership 示例数据 | single-repo，控制面附加层 | 未发现 direct skill 消费证据 | `run-bootstrap.js:88`，`sample-generator.js` 中 `buildOwnershipRegistrySample` |
| `review-queue.json` | `.spec-first/workflows/bootstrap/<slug>/review-queue.json` | control plane / machine-readable | 当前也是 sample generator 生成的 review queue 示例数据 | single-repo，控制面附加层 | 未发现 direct skill 消费证据 | `run-bootstrap.js:89-92`，`sample-generator.js` 中 `buildReviewQueueSample` |
| `minimal-context/review.json` | `.spec-first/workflows/bootstrap/<slug>/minimal-context/review.json` | control plane / machine-readable | review Stage 的高优先 machine context，给出 `selected_assets`、`risk_focus`、`candidate_tests`、`verification_gaps_to_check` 等 | single-repo，review Stage 核心卡片 | `spec-review` 直接消费 | `run-bootstrap.js:93-96`，`compile-minimal-context.js:55-84`，`skills/spec-review/SKILL.md:28-40` |
| `minimal-context/plan.json` | `.spec-first/workflows/bootstrap/<slug>/minimal-context/plan.json` | control plane / machine-readable | plan Stage 的高优先 machine context，给出 `selected_assets`、`entrypoint_focus`、`module_focus`、`required_verifications` 等 | single-repo，plan Stage 核心卡片 | `spec-plan` 直接消费 | `run-bootstrap.js:97-100`，`compile-minimal-context.js:86-115`，`skills/spec-plan/SKILL.md:79-90` |
| `minimal-context/work.json` | `.spec-first/workflows/bootstrap/<slug>/minimal-context/work.json` | control plane / machine-readable | work Stage 的高优先 machine context，给出 `selected_assets`、`impacted_modules`、`candidate_tests`、`required_verifications` 等 | single-repo，work Stage 核心卡片 | `spec-work`、`spec-work-beta` 直接消费 | `run-bootstrap.js:101-104`，`compile-minimal-context.js:117-157`，`skills/spec-work/SKILL.md:38-49`，`skills/spec-work-beta/SKILL.md:43-54` |

## 单仓模式：上下文文档产物表

| 产物 | 落盘路径 | 类型 | 内容描述 | 作用域 | 当前直接消费方 | 代码依据 |
|---|---|---|---|---|---|---|
| `00-summary.md` | `docs/contexts/<slug>/00-summary.md` | context docs / human-readable | 项目总览，聚合主语言、框架、入口数、模块数、风险数、测试数、默认必跑验证 | single-repo，通用总览层 | `spec-plan`、`spec-work`、`spec-review`、`spec-work-beta` 在 fallback 或 always 视角都会用到 | `run-bootstrap.js:107-117`，`compile-human-assets.js:3-26,124-152`，`compile-routing.js:10-17`，`fallback.js:6-29` |
| `README.md` | `docs/contexts/<slug>/README.md` | context docs / human-readable | 标记该目录是 Stage-0 Context，并声明 control-plane 真源路径 | single-repo，目录入口层 | 未见 skill 显式优先读取；但 `always` 与 fallback 均会保留它 | `compile-human-assets.js:28-39,124-152`，`compile-routing.js:10-17,33-35`，`fallback.js:10-12,26-28` |
| `architecture/module-map.md` | `docs/contexts/<slug>/architecture/module-map.md` | context docs / human-readable | 模块路径列表，帮助 plan 阶段建立模块边界与结构心智 | single-repo，架构层 | `spec-plan` 直接消费 | `compile-human-assets.js:41-49,132`，`compile-minimal-context.js:96-105`，`skills/spec-plan/SKILL.md:85-90` |
| `code-facts/public-entrypoints.md` | `docs/contexts/<slug>/code-facts/public-entrypoints.md` | context docs / human-readable | 公共入口列表 | single-repo，入口事实层 | `spec-plan` 直接消费；`spec-work`、`spec-review`、`spec-work-beta` 在 Level 2 fallback 中消费 | `compile-human-assets.js:51-59,133`，`compile-minimal-context.js:97-105`，`skills/spec-plan/SKILL.md:85-90,98-102`，`skills/spec-work/SKILL.md:61-65`，`skills/spec-review/SKILL.md:52-56`，`skills/spec-work-beta/SKILL.md:66-70` |
| `code-facts/test-map.md` | `docs/contexts/<slug>/code-facts/test-map.md` | context docs / human-readable | 测试文件到目标代码的映射，包含测试种类和 target | single-repo，测试映射层 | `spec-review`、`spec-work`、`spec-work-beta` 直接消费；`spec-plan` 在 fallback 中消费 | `compile-human-assets.js:61-72,134`，`compile-minimal-context.js:68-75,134-142`，`skills/spec-review/SKILL.md:35-38,53-56`，`skills/spec-work/SKILL.md:45-47,62-65`，`skills/spec-work-beta/SKILL.md:50-52,67-70`，`skills/spec-plan/SKILL.md:98-102` |
| `code-facts/high-risk-modules.md` | `docs/contexts/<slug>/code-facts/high-risk-modules.md` | context docs / human-readable | 以风险信号为源列出高风险模块、严重级别、风险类型与摘要 | single-repo，风险映射层 | `spec-review` 直接消费；`spec-work`、`spec-work-beta` 通过 `minimal-context/work.json.selected_assets` 间接使用 | `compile-human-assets.js:74-82,135`，`compile-minimal-context.js:66-76,133-143`，`skills/spec-review/SKILL.md:35-38`，`skills/spec-work/SKILL.md:45-49`，`skills/spec-work-beta/SKILL.md:50-54` |
| `pitfalls/index.md` | `docs/contexts/<slug>/pitfalls/index.md` | context docs / human-readable | 只筛出高严重度风险，作为 pitfalls 列表 | single-repo，风险提示层 | `spec-plan`、`spec-work`、`spec-review`、`spec-work-beta` 都在 Level 2 fallback 里列为候选输入 | `compile-human-assets.js:84-94,136`，`fallback.js:13-24`，四个 skill 的 Level 2 fallback 段落 |
| `context-packs/review-change.md` | `docs/contexts/<slug>/context-packs/review-change.md` | context docs / human-readable | 聚合风险热点、候选测试、默认验证，服务于 review/work 的快速决策 | single-repo，变更评审包 | `spec-review`、`spec-work`、`spec-work-beta` 直接消费 | `compile-human-assets.js:96-115,137-141`，`compile-minimal-context.js:69-75,135-142`，`skills/spec-review/SKILL.md:35-38`，`skills/spec-work/SKILL.md:45-47`，`skills/spec-work-beta/SKILL.md:50-52` |
| `injection-index.yaml` | `docs/contexts/<slug>/injection-index.yaml` | context docs / human-readable-ish routing view | 人类可读的注入索引，表达 always/stages/selection_rules/advice；当前不再是唯一运行时真源 | single-repo，注入索引层 | `spec-plan`、`spec-work`、`spec-review`、`spec-work-beta` 都明确提到它只作为人类视图，不是唯一判定逻辑 | `run-bootstrap.js:114-117`，`compile-routing.js:59-105,310`，四个 skill 的 “injection-index 仅作为人类视图” 段落 |

## workspace 模式：额外产物表

说明：以下是 workspace 根级额外产物。每个 child repo 仍会再各自产生一套单仓模式的 `23` 个产物。

| 产物 | 落盘路径 | 类型 | 内容描述 | 作用域 | 当前直接消费方 | 代码依据 |
|---|---|---|---|---|---|---|
| `workspace-registry.json` | `.spec-first/workflows/bootstrap/<workspaceSlug>/workspace-registry.json` | control plane / machine-readable | workspace 子仓注册表，记录 child slug、repoRoot、relativePath 等 | workspace-root，聚合注册层 | 未发现 direct skill 消费；runtime `entry-resolver` 直接读取 | `run-bootstrap.js:120-121`，`entry-resolver.js:73-88,116-123,185-188` |
| `workspace-routing.json` | `.spec-first/workflows/bootstrap/<workspaceSlug>/workspace-routing.json` | control plane / machine-readable | workspace 级匹配优先级、overview 资产清单、无匹配时 fallback 策略 | workspace-root，聚合路由层 | 未发现 direct skill 消费；runtime `entry-resolver` 直接读取 | `run-bootstrap.js:121-123`，`workspace-registry.js:126-140`，`entry-resolver.js:103-113,185-188` |
| workspace `artifact-manifest.json` | `.spec-first/workflows/bootstrap/<workspaceSlug>/artifact-manifest.json` | control plane / machine-readable | workspace 根级产物账本，仅记录聚合产物输出 | workspace-root，聚合账本层 | 未发现 direct skill 消费证据 | `run-bootstrap.js:123-135` |
| workspace `00-summary.md` | `docs/contexts/<workspaceSlug>/00-summary.md` | context docs / human-readable | 仅写入 `# <workspaceSlug>` 的极简 summary | workspace-root，聚合概览层 | 未发现 direct skill 消费；workspace routing 会把它列为 overview asset | `run-bootstrap.js:137-143`，`workspace-registry.js:136-139` |
| workspace `README.md` | `docs/contexts/<workspaceSlug>/README.md` | context docs / human-readable | 仅写入 workspace overview 标题 | workspace-root，聚合入口层 | 未发现 direct skill 消费证据 | `run-bootstrap.js:138-139` |
| `workspace/routing-overview.md` | `docs/contexts/<workspaceSlug>/workspace/routing-overview.md` | context docs / human-readable | child slug 到相对路径的列表 | workspace-root，聚合路由说明层 | 未发现 direct skill 消费；workspace routing 会把它列为 overview asset | `run-bootstrap.js:140-143`，`workspace-registry.js:136-139` |
| `workspace/repo-registry.md` | `docs/contexts/<workspaceSlug>/workspace/repo-registry.md` | context docs / human-readable | child slug 到 repoRoot 的列表 | workspace-root，聚合索引层 | 未发现 direct skill 消费证据 | `run-bootstrap.js:144-147` |

## 下游 skill 消费映射总表

这里仅统计“有直接代码证据”的消费关系，不把推测性“可能会读”写成事实。

| skill | 明确直接消费的 Stage-0 产物 | 证据 |
|---|---|---|
| `spec-plan` | `context-routing.json`、`artifact-manifest.json`、`minimal-context/plan.json`、`architecture/module-map.md`、`code-facts/public-entrypoints.md`；fallback 还会用 `00-summary.md`、`pitfalls/index.md`、`code-facts/test-map.md` | `skills/spec-plan/SKILL.md:77-102` |
| `spec-work` | `context-routing.json`、`artifact-manifest.json`、`minimal-context/work.json`、`code-facts/test-map.md`、`context-packs/review-change.md`；fallback 还会用 `00-summary.md`、`pitfalls/index.md`、`code-facts/public-entrypoints.md` | `skills/spec-work/SKILL.md:36-65` |
| `spec-review` | `context-routing.json`、`artifact-manifest.json`、`minimal-context/review.json`、`code-facts/high-risk-modules.md`、`code-facts/test-map.md`、`context-packs/review-change.md`；fallback 还会用 `00-summary.md`、`pitfalls/index.md`、`code-facts/public-entrypoints.md` | `skills/spec-review/SKILL.md:27-56` |
| `spec-work-beta` | `context-routing.json`、`artifact-manifest.json`、`minimal-context/work.json`、`code-facts/test-map.md`、`context-packs/review-change.md`；fallback 还会用 `00-summary.md`、`pitfalls/index.md`、`code-facts/public-entrypoints.md` | `skills/spec-work-beta/SKILL.md:41-70` |

补充说明：

- `spec-bootstrap` 也大量引用 `docs/contexts/<slug>/` 路径，但它不是当前 Stage-0 产物的“直接运行时消费方”，更像另一路 bootstrap 体系中的设计/文档级关联。
- workspace 根级产物目前没有在 `skills/*/SKILL.md` 中发现 direct consumer；它们主要服务 runtime 侧的 workspace entry resolving。

## `SKILL.md` 合同声明 vs 当前代码实现

### 已落地的部分

1. 主管线三段式已存在
   - machine artifacts
   - human assets
   - routing / manifest / injection-index

2. control plane 与 context docs 双平面写盘已存在
   - `.spec-first/workflows/bootstrap/<slug>/`
   - `docs/contexts/<slug>/`

3. minimal context 已实装
   - `plan`
   - `work`
   - `review`

4. human docs 不是占位壳子
   - 当前 `compile-human-assets.js` 已经真实渲染 summary、module map、entrypoints、test map、high-risk、pitfalls、review-change

### 尚未按 `SKILL.md` 完整落地的部分

1. Phase 2/3 中更重的 PRD task contract 没有完整落盘
   - `SKILL.md` 里描述了更重的“任务规划 + 文档生成 + 路由生成”合同
   - 当前 `src/bootstrap-compiler/` 真实实现里，没有看到对应的一组 PRD task contract 产物写盘

2. `artifact-manifest.json` 的“两段写入”没有落地
   - `SKILL.md` 期望：
     - Phase 0 先写 `status: in_progress`
     - Phase 3 结束再写 `status: complete`
   - 当前实现：
     - 单仓模式只在最终写一次 complete manifest

3. `ownership.json` 与 `review-queue.json` 当前不是 repo-fact 驱动
   - 这两者目前来自 sample generator，而不是从 `fact-inventory` / `risk-signals` / `test-surface` 真实推导
   - 因此它们更像“控制面占位产物”，而不是高可信度事实产物

4. workspace 根级产物偏索引，不偏决策
   - `workspace-registry.json` 与 `workspace-routing.json` 对 runtime 路由有价值
   - 但 workspace 根级文档本身还比较薄，不足以替代 child repo 的 Stage-0 决策输入

## 对后续流程质量的影响判断

按照“轻 contract + 明确边界 + 让 LLM 决策”的标准，当前实现有三点是正向的：

1. 它已经把下游真正需要的 Stage-0 输入收敛出来了
   - `minimal-context/*.json`
   - `module-map`
   - `public-entrypoints`
   - `test-map`
   - `high-risk-modules`
   - `review-change`

2. 它没有把下游 workflow 硬绑成强状态机
   - 下游 skill 普遍把这些产物当作增强上下文和 baseline
   - 缺失时允许降级，不中止主流程

3. 它已经在向“让 LLM 决策”靠拢
   - `minimal-context/*.json` 不是强编排脚本
   - 它们提供的是较高质量的决策输入：关注面、候选测试、验证基线、优先资产

但也有三点会限制产物质量：

1. 合同面比实现面重很多
   - 容易让人误以为当前系统已经完整具备更重的 PRD-contract 能力

2. 一部分控制面产物仍然不是 repo-fact 驱动
   - `ownership.json`
   - `review-queue.json`

3. workspace 聚合层当前仍偏薄
   - 它解决了“如何找到 child repo”
   - 但还没有形成高质量的 workspace 决策输入包

## 最终结论

如果问题是“`spec-graph-bootstrap` 当前真实会生成哪些产物”，那么答案应以 `src/bootstrap-compiler/run-bootstrap.js` 为准，而不是只看 `skills/spec-graph-bootstrap/SKILL.md`。

当前真实结论是：

- 单仓模式会生成 `23` 个产物
- workspace 根级会额外生成 `7` 个聚合产物
- 当前最关键、最有价值、也确实被下游 skill 直接消费的，是：
  - `context-routing.json`
  - `artifact-manifest.json`
  - `minimal-context/*.json`
  - `architecture/module-map.md`
  - `code-facts/public-entrypoints.md`
  - `code-facts/test-map.md`
  - `code-facts/high-risk-modules.md`
  - `context-packs/review-change.md`
  - `00-summary.md`
  - `pitfalls/index.md`

因此，若后续要继续优化这个 skill，重点不应该是再堆更多状态流转，而应该是：

1. 提高这些核心产物的真实性与密度
2. 收紧“合同声明”与“当前实现”之间的差距
3. 让 workspace 层也能给下游 LLM 提供更高质量的决策输入，而不是只提供索引
