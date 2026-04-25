# `spec-graph-bootstrap` 当前产物清单与消费关系审查

## 一句话结论

以当前代码为准，`spec-graph-bootstrap` 现在稳定生成一套 Stage-0 控制面产物与上下文文档，但“当前真实实现”仍比 `skills/spec-graph-bootstrap/SKILL.md` 声明的目标 contract 更轻。

- 单仓模式下，当前真实落盘产物为 `24` 个
- workspace 模式下，workspace 根目录会额外生成 `8` 个聚合产物
- 单仓控制面真实产物是：
  - `fact-inventory.json`
  - `risk-signals.json`
  - `test-surface.json`
  - `database-routing.json`
  - `context-routing.json`
  - `artifact-manifest.json`
  - `freshness.json`
  - `lint-report.json`
  - `contradictions.json`
  - `verification-profile.json`
  - `ownership.json`
  - `review-queue.json`
  - `minimal-context/review.json`
  - `minimal-context/plan.json`
  - `minimal-context/work.json`
- 单仓上下文文档真实产物是：
  - `00-summary.md`
  - `README.md`
  - `architecture/module-map.md`
  - `code-facts/public-entrypoints.md`
  - `code-facts/test-map.md`
  - `code-facts/high-risk-modules.md`
  - `pitfalls/index.md`
  - `context-packs/review-change.md`
  - `injection-index.yaml`

真正被下游 workflow skill 明确直接消费的核心产物，仍主要集中在：

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

同时，`SKILL.md` 中声明的更重 contract 仍有若干未完全按当前实现落地，尤其包括：

- Phase 0 的 `artifact-manifest.json` 两段式写入（当前实现仍是单次最终写入）
- workspace `workspace-readiness-summary.json` 已落地，但内容结构与 `SKILL.md` 里的 advisory snapshot 目标不同
- workspace `README.md` / `00-summary.md` 当前仍是极简文本，不是重内容 overview
- `ownership.json` / `review-queue.json` 仍是 sample generator 产物，而不是 repo facts 推导结果
- `SKILL.md` 里的 Phase 2 PRD task contract 仍未在 `src/bootstrap-compiler/` 中形成对应的真实落盘面

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

- 主管线：`src/bootstrap-compiler/orchestrator.js`
- 单仓真实写盘：`src/bootstrap-compiler/run-bootstrap.js:75`、`src/bootstrap-compiler/run-bootstrap.js:108`
- workspace 真实写盘：`src/bootstrap-compiler/run-bootstrap.js:121`、`src/bootstrap-compiler/run-bootstrap.js:192`
- machine artifacts 编译：`src/bootstrap-compiler/compile-machine-artifacts.js:10`
- minimal context 编译：`src/bootstrap-compiler/compile-minimal-context.js:110`
- human docs 渲染：`src/bootstrap-compiler/compile-human-assets.js:139`
- routing / manifest / injection index / database-routing：`src/bootstrap-compiler/compile-routing.js:155`、`src/bootstrap-compiler/compile-routing.js:219`、`src/bootstrap-compiler/compile-routing.js:272`
- workspace registry / routing：`src/bootstrap-compiler/workspace-registry.js:105`、`src/bootstrap-compiler/workspace-registry.js:139`
- runtime 读取 control plane：`src/context-routing/loader.js:35`
- workspace runtime 入口解析：`src/context-routing/entry-resolver.js:72`、`src/context-routing/entry-resolver.js:177`

说明：本次更新以当前源码实现为准，不再沿用旧文档中已经失准的“估算数量”与“Phase 级理想 contract 已完全落地”口径。

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
│               ├── database-routing.json
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

单仓真实总数：`24` 个产物（控制面 `15` + 文档 `9`）。

其中新增且旧文档漏掉的关键控制面产物是 `database-routing.json`。

### 2. workspace 模式

```text
<workspaceRoot>/
├── .spec-first/
│   └── workflows/
│       └── bootstrap/
│           ├── <workspaceSlug>/
│           │   ├── workspace-registry.json
│           │   ├── workspace-routing.json
│           │   ├── artifact-manifest.json
│           │   └── workspace-readiness-summary.json
│           └── <childSlug>/                # 每个 child repo 再各自产生单仓产物
│               └── ...
└── docs/
    └── contexts/
        ├── <workspaceSlug>/
        │   ├── 00-summary.md
        │   ├── README.md
        │   ├── injection-index.yaml
        │   └── workspace/
        │       ├── routing-overview.md
        │       └── repo-registry.md
        └── <childSlug>/                    # 每个 child repo 再各自产生单仓上下文文档
            └── ...
```

workspace 根级真实总数：额外 `8` 个聚合产物（控制面 `4` + 文档 `4`）。

### 3. workspace 模式的真实执行方式

workspace 不是“只生成 workspace 聚合文档”。当前实现会先为每个 child repo 调一次 `runBootstrap(...)`，然后再发布 workspace 根级聚合产物。

代码依据：

- `src/bootstrap-compiler/run-bootstrap.js` 中 workspace 分支会先对子仓逐个执行 bootstrap，再写 workspace 根级聚合产物
- `src/bootstrap-compiler/run-bootstrap.js` 中 `writeWorkspaceControlPlaneArtifacts(...)`、`writeWorkspaceOverviewArtifacts(...)` 负责 workspace 根级落盘

补充说明：旧文档引用的具体行号已经过期，本次统一改成以当前函数与职责片段为准，避免下一次小改动再次让文档失真。

这意味着：

- workspace 模式会放大 `spec-graph-bootstrap` 的总产物规模
- workspace 根级产物目前主要是“路由与索引”
- 真正被后续 `plan/work/review` 消费的，仍主要是 child repo 的单仓 Stage-0 产物

## 单仓模式：控制面产物表

| 产物 | 落盘路径 | 类型 | 内容描述 | 作用域 | 当前直接消费方 | 代码依据 |
|---|---|---|---|---|---|---|
| `fact-inventory.json` | `.spec-first/workflows/bootstrap/<slug>/fact-inventory.json` | control plane / machine-readable | 仓库事实主表，包含 `project_identity`、`entrypoints`、`modules`、`integrations`、`testing_surface` 等输入事实 | single-repo，基础事实层 | 未发现 skill 直接读取；当前主要被编译阶段继续派生为 minimal-context 与 docs | `src/bootstrap-compiler/run-bootstrap.js:75-76`，`src/bootstrap-compiler/compile-machine-artifacts.js:21-29` |
| `risk-signals.json` | `.spec-first/workflows/bootstrap/<slug>/risk-signals.json` | control plane / machine-readable | 风险信号集合，供高风险模块、pitfalls、review-change 等产物派生 | single-repo，风险事实层 | 未发现 skill 直接读取；当前主要被编译阶段继续派生 | `src/bootstrap-compiler/run-bootstrap.js:77`，`src/bootstrap-compiler/compile-machine-artifacts.js:28-29` |
| `test-surface.json` | `.spec-first/workflows/bootstrap/<slug>/test-surface.json` | control plane / machine-readable | 测试文件、测试目标与测试覆盖关系输入 | single-repo，测试事实层 | 未发现 skill 直接读取；当前主要被编译阶段继续派生 | `src/bootstrap-compiler/run-bootstrap.js:78`，`src/bootstrap-compiler/compile-machine-artifacts.js:29-30` |
| `database-routing.json` | `.spec-first/workflows/bootstrap/<slug>/database-routing.json` | control plane / machine-readable | 数据库 handoff contract，包含 `hint_summary`、`runtime_capabilities`、`candidate_readiness`、兼容性 `recommended_action/blockers` | single-repo，数据库 handoff 层 | 当前未发现 workflow skill 直接读取；主要作为后续 LLM / runtime 的数据库只读路径提示 | `src/bootstrap-compiler/run-bootstrap.js:79`，`src/bootstrap-compiler/compile-routing.js:155-217` |
| `context-routing.json` | `.spec-first/workflows/bootstrap/<slug>/context-routing.json` | control plane / machine-readable | Stage 到资产集合的路由 contract，定义 `always`、`stages.*`、`selection_rules`、`advice` | single-repo，Stage-0 路由层 | `spec-plan`、`spec-work`、`spec-code-review`、`spec-work-beta` 都明确要求优先读取 | `src/bootstrap-compiler/run-bootstrap.js:80`，`src/bootstrap-compiler/compile-routing.js:220-270`，`skills/spec-plan/SKILL.md:79-101`，`skills/spec-work/SKILL.md:38-48`，`skills/spec-code-review/SKILL.md:35-39`，`skills/spec-work-beta/SKILL.md:50-53` |
| `artifact-manifest.json` | `.spec-first/workflows/bootstrap/<slug>/artifact-manifest.json` | control plane / machine-readable | 输入版本、schema 版本、输出清单、依赖关系、生成时间的总 manifest | single-repo，产物账本层 | `spec-plan`、`spec-work`、`spec-code-review`、`spec-work-beta` 都明确要求优先读取；runtime loader 也直接读取 | `src/bootstrap-compiler/run-bootstrap.js:81`，`src/context-routing/loader.js:35-46` |
| `freshness.json` | `.spec-first/workflows/bootstrap/<slug>/freshness.json` | control plane / machine-readable | 基于 manifest 输入时间与输出时间构建的 freshness 报告 | single-repo，产物新鲜度层 | 未发现 direct skill 读取；runtime loader 会加载 | `src/bootstrap-compiler/run-bootstrap.js:82`，`src/bootstrap-compiler/compile-machine-artifacts.js:58-65`，`src/context-routing/loader.js:43-45` |
| `lint-report.json` | `.spec-first/workflows/bootstrap/<slug>/lint-report.json` | control plane / machine-readable | 对 required assets 与 context assets 的存在性/一致性做 lint 报告 | single-repo，产物质量层 | 未发现 direct skill 明确读取；但 `context-routing.json` 的 `work/review` stage 会把它列入可选注入资产 | `src/bootstrap-compiler/run-bootstrap.js:83`，`src/bootstrap-compiler/compile-machine-artifacts.js:66-84`，`src/bootstrap-compiler/compile-routing.js:233-245` |
| `contradictions.json` | `.spec-first/workflows/bootstrap/<slug>/contradictions.json` | control plane / machine-readable | 记录 bootstrap 检测到的矛盾资产结果 | single-repo，矛盾/冲突层 | 未发现 direct skill 明确读取；但 `review` stage 路由里已纳入 | `src/bootstrap-compiler/run-bootstrap.js:84`，`src/bootstrap-compiler/compile-machine-artifacts.js:85-88`，`src/bootstrap-compiler/compile-routing.js:238-246` |
| `verification-profile.json` | `.spec-first/workflows/bootstrap/<slug>/verification-profile.json` | control plane / machine-readable | 默认必跑验证、可选验证、平台关注点等验证基线 | single-repo，验证基线层 | 未发现 direct skill 明确读取原文件；当前更多通过 `minimal-context/*.json` 被间接消费；runtime loader 也会加载 | `src/bootstrap-compiler/run-bootstrap.js:85-88`，`src/bootstrap-compiler/compile-machine-artifacts.js:39-57`，`src/context-routing/loader.js:44-46` |
| `ownership.json` | `.spec-first/workflows/bootstrap/<slug>/ownership.json` | control plane / machine-readable | 当前不是从仓库事实推导，而是 sample generator 生成的 ownership 示例数据 | single-repo，控制面附加层 | 未发现 direct skill 消费证据 | `src/bootstrap-compiler/run-bootstrap.js:89` |
| `review-queue.json` | `.spec-first/workflows/bootstrap/<slug>/review-queue.json` | control plane / machine-readable | 当前也是 sample generator 生成的 review queue 示例数据 | single-repo，控制面附加层 | 未发现 direct skill 消费证据 | `src/bootstrap-compiler/run-bootstrap.js:90-93` |
| `minimal-context/review.json` | `.spec-first/workflows/bootstrap/<slug>/minimal-context/review.json` | control plane / machine-readable | review Stage 的高优先 machine context，给出 `selected_assets`、`risk_focus`、`candidate_tests`、`verification_gaps_to_check` 等 | single-repo，review Stage 核心卡片 | `spec-code-review` 直接消费 | `src/bootstrap-compiler/run-bootstrap.js:94-97`，`src/bootstrap-compiler/compile-minimal-context.js:110-141`，`skills/spec-code-review/SKILL.md:35-39` |
| `minimal-context/plan.json` | `.spec-first/workflows/bootstrap/<slug>/minimal-context/plan.json` | control plane / machine-readable | plan Stage 的高优先 machine context，给出 `selected_assets`、`entrypoint_focus`、`module_focus`、`required_verifications` 等 | single-repo，plan Stage 核心卡片 | `spec-plan` 直接消费 | `src/bootstrap-compiler/run-bootstrap.js:98-101`，`src/bootstrap-compiler/compile-minimal-context.js:143-174`，`skills/spec-plan/SKILL.md:97-103` |
| `minimal-context/work.json` | `.spec-first/workflows/bootstrap/<slug>/minimal-context/work.json` | control plane / machine-readable | work Stage 的高优先 machine context，给出 `selected_assets`、`impacted_modules`、`candidate_tests`、`required_verifications` 等 | single-repo，work Stage 核心卡片 | `spec-work`、`spec-work-beta` 直接消费 | `src/bootstrap-compiler/run-bootstrap.js:102-105`，`src/bootstrap-compiler/compile-minimal-context.js:176-218`，`skills/spec-work/SKILL.md:45-52`，`skills/spec-work-beta/SKILL.md:50-57` |

## 单仓模式：上下文文档产物表

| 产物 | 落盘路径 | 类型 | 内容描述 | 作用域 | 当前直接消费方 | 代码依据 |
|---|---|---|---|---|---|---|
| `00-summary.md` | `docs/contexts/<slug>/00-summary.md` | context docs / human-readable | 项目总览，聚合主语言、框架、入口数、模块数、风险数、测试数、默认必跑验证 | single-repo，通用总览层 | `spec-plan`、`spec-work`、`spec-code-review`、`spec-work-beta` 在 fallback 或 always 视角都会用到 | `src/bootstrap-compiler/run-bootstrap.js:108-118`，`src/bootstrap-compiler/compile-human-assets.js:2-31,146-174` |
| `README.md` | `docs/contexts/<slug>/README.md` | context docs / human-readable | 标记该目录是 Stage-0 Context，并声明 control-plane 真源路径 | single-repo，目录入口层 | 未见 skill 显式优先读取；但 `always` 与 fallback 均会保留它 | `src/bootstrap-compiler/run-bootstrap.js:108-118`，`src/bootstrap-compiler/compile-human-assets.js:33-55,146-174` |
| `architecture/module-map.md` | `docs/contexts/<slug>/architecture/module-map.md` | context docs / human-readable | 模块路径列表，帮助 plan 阶段建立模块边界与结构心智 | single-repo，架构层 | `spec-plan` 直接消费 | `src/bootstrap-compiler/compile-human-assets.js:57-70,146-174`，`skills/spec-plan/SKILL.md:97-100` |
| `code-facts/public-entrypoints.md` | `docs/contexts/<slug>/code-facts/public-entrypoints.md` | context docs / human-readable | 公共入口列表 | single-repo，入口事实层 | `spec-plan` 直接消费；`spec-work`、`spec-code-review`、`spec-work-beta` 在 Level 2 fallback 中消费 | `src/bootstrap-compiler/compile-human-assets.js:72-80,146-174`，`skills/spec-plan/SKILL.md:98-100`，`skills/spec-work/SKILL.md:66-67`，`skills/spec-code-review/SKILL.md:55-57`，`skills/spec-work-beta/SKILL.md:69-71` |
| `code-facts/test-map.md` | `docs/contexts/<slug>/code-facts/test-map.md` | context docs / human-readable | 测试文件到目标代码的映射，包含测试种类和 target | single-repo，测试映射层 | `spec-code-review`、`spec-work`、`spec-work-beta` 直接消费；`spec-plan` 在 fallback 中消费 | `src/bootstrap-compiler/compile-human-assets.js:82-93,146-174`，`skills/spec-code-review/SKILL.md:37-39`，`skills/spec-work/SKILL.md:46-48`，`skills/spec-work-beta/SKILL.md:51-53`，`skills/spec-plan/SKILL.md:112-115` |
| `code-facts/high-risk-modules.md` | `docs/contexts/<slug>/code-facts/high-risk-modules.md` | context docs / human-readable | 以风险信号为源列出高风险模块、严重级别、风险类型与摘要 | single-repo，风险映射层 | `spec-code-review` 直接消费；`spec-work`、`spec-work-beta` 通过 `minimal-context/work.json.selected_assets` 间接使用 | `src/bootstrap-compiler/compile-human-assets.js:95-103,146-174`，`skills/spec-code-review/SKILL.md:36-39`，`skills/spec-work/SKILL.md:48-49`，`skills/spec-work-beta/SKILL.md:53-54` |
| `pitfalls/index.md` | `docs/contexts/<slug>/pitfalls/index.md` | context docs / human-readable | 只筛出高严重度风险，作为 pitfalls 列表 | single-repo，风险提示层 | `spec-plan`、`spec-work`、`spec-code-review`、`spec-work-beta` 都在 Level 2 fallback 里列为候选输入 | `src/bootstrap-compiler/compile-human-assets.js:105-115,146-174` |
| `context-packs/review-change.md` | `docs/contexts/<slug>/context-packs/review-change.md` | context docs / human-readable | 聚合风险热点、候选测试、默认验证，服务于 review/work 的快速决策 | single-repo，变更评审包 | `spec-code-review`、`spec-work`、`spec-work-beta` 直接消费 | `src/bootstrap-compiler/compile-human-assets.js:117-137,146-174`，`skills/spec-code-review/SKILL.md:39-40`，`skills/spec-work/SKILL.md:47-48`，`skills/spec-work-beta/SKILL.md:52-53` |
| `injection-index.yaml` | `docs/contexts/<slug>/injection-index.yaml` | context docs / human-readable-ish routing view | 人类可读的注入索引，表达 always/stages/selection_rules/advice；当前不再是唯一运行时真源 | single-repo，注入索引层 | `spec-plan`、`spec-work`、`spec-code-review`、`spec-work-beta` 都明确提到它只作为人类视图，不是唯一判定逻辑 | `src/bootstrap-compiler/run-bootstrap.js:115-118`，`src/bootstrap-compiler/compile-routing.js:273-319`，`skills/spec-plan/SKILL.md:101`，`skills/spec-work/SKILL.md:49`，`skills/spec-code-review/SKILL.md:40`，`skills/spec-work-beta/SKILL.md:54` |

## workspace 模式：额外产物表

说明：以下是 workspace 根级额外产物。每个 child repo 仍会再各自产生一套单仓模式的 `24` 个产物。

| 产物 | 落盘路径 | 类型 | 内容描述 | 作用域 | 当前直接消费方 | 代码依据 |
|---|---|---|---|---|---|---|
| `workspace-registry.json` | `.spec-first/workflows/bootstrap/<workspaceSlug>/workspace-registry.json` | control plane / machine-readable | workspace 子仓注册表，记录 child slug、repoRoot、relativePath 等 | workspace-root，聚合注册层 | 未发现 direct skill 消费；runtime `entry-resolver` 直接读取 | `src/bootstrap-compiler/run-bootstrap.js:438-439`，`src/bootstrap-compiler/workspace-registry.js:105-137`，`src/context-routing/entry-resolver.js:72-112` |
| `workspace-routing.json` | `.spec-first/workflows/bootstrap/<workspaceSlug>/workspace-routing.json` | control plane / machine-readable | workspace 级匹配优先级、overview 资产清单、无匹配时 fallback 策略 | workspace-root，聚合路由层 | 未发现 direct skill 消费；runtime `entry-resolver` 直接读取 | `src/bootstrap-compiler/run-bootstrap.js:438-439`，`src/bootstrap-compiler/workspace-registry.js:139-154`，`src/context-routing/entry-resolver.js:102-112` |
| `workspace-readiness-summary.json` | `.spec-first/workflows/bootstrap/<workspaceSlug>/workspace-readiness-summary.json` | control plane / machine-readable | workspace 子仓 freshness/data_quality/fallback 摘要快照 | workspace-root，聚合健康摘要层 | 未发现 direct skill 消费证据 | `src/bootstrap-compiler/run-bootstrap.js:363-367`，`src/bootstrap-compiler/run-bootstrap.js:438-439` |
| workspace `artifact-manifest.json` | `.spec-first/workflows/bootstrap/<workspaceSlug>/artifact-manifest.json` | control plane / machine-readable | workspace 根级产物账本，仅记录聚合产物输出 | workspace-root，聚合账本层 | 未发现 direct skill 消费证据 | `src/bootstrap-compiler/run-bootstrap.js:121-137` |
| workspace `00-summary.md` | `docs/contexts/<workspaceSlug>/00-summary.md` | context docs / human-readable | 当前仅写入 `# <workspaceSlug>` 的极简 summary | workspace-root，聚合概览层 | 未发现 direct skill 消费；workspace routing 会把它列为 overview asset | `src/bootstrap-compiler/run-bootstrap.js:192-206` |
| workspace `README.md` | `docs/contexts/<workspaceSlug>/README.md` | context docs / human-readable | 当前仅写入 workspace overview 标题 | workspace-root，聚合入口层 | 未发现 direct skill 消费证据 | `src/bootstrap-compiler/run-bootstrap.js:192-206` |
| `workspace/routing-overview.md` | `docs/contexts/<workspaceSlug>/workspace/routing-overview.md` | context docs / human-readable | child slug 到相对路径的列表 | workspace-root，聚合路由说明层 | 未发现 direct skill 消费；workspace routing 会把它列为 overview asset | `src/bootstrap-compiler/run-bootstrap.js:192-206` |
| `workspace/repo-registry.md` | `docs/contexts/<workspaceSlug>/workspace/repo-registry.md` | context docs / human-readable | child slug 到 repoRoot 的列表 | workspace-root，聚合索引层 | 未发现 direct skill 消费证据 | `src/bootstrap-compiler/run-bootstrap.js:199-206` |

## 三层消费边界总览

为避免把 bootstrap 输入层与 CRG runtime 图存储层混成一个“统一大池子”，这里把消费关系明确拆成三层：

1. 存储层：CRG graph runtime 自己生成并消费的底层图表与索引。
2. 表层：`spec-graph-bootstrap` 生成的 Stage-0 控制面产物与上下文文档。
3. skill 层：`spec-plan` / `spec-work` / `spec-code-review` / `spec-work-beta` 等 workflow skill 对 Stage-0 产物的直接消费。

### 第一层：CRG 图产物 / 存储层消费表

这一层只讨论 CRG runtime 自己生成并消费的图产物，不把它和 bootstrap 产物混写。

| 生产 | 内容 | 消费节点 | 如何消费 |
|---|---|---|---|
| `crg build` / graph compiler 写入 `nodes` | 符号节点主表，包含 `id`、`name`、`file_path`、`kind`、`line_start`、`line_end`、`retrieval_text` 等 AST/符号事实 | `crg context`、`crg impact`、`retrieveContext(...)`、`searchNodes(...)` | `crg context` 直接基于 `nodes` 统计 top hubs 与 summary，并把节点送入 retrieval pipeline；`crg impact` 先在 `nodes` 中定位目标 symbol，再回装受影响节点详情；retrieval/search 再按节点文本与元信息做召回与打包 |
| `crg build` / graph compiler 写入 `edges` | 图边主表，记录 `calls`、`imports_from` 等关系边 | `crg context`、`crg impact`、`expandSeedSet(...)` | `crg context` 通过 `nodes + edges` 统计入度 hub；`crg impact` 用 `calls` / `imports_from` 建反向邻接表并做 reverse BFS；retrieval expand 阶段按邻接边扩展 seed set |
| `crg build` / chunking 写入 `chunks` | 以 `parent_symbol_id` 挂载到 symbol 的内容块，提供更细粒度 retrieval 文本切片 | `expandSeedSet(...)`、`retrieveContext(...)` | retrieval 扩展阶段按 `parent_symbol_id` 拉取 chunk，把 symbol 级 seed 扩成可打包上下文块，再交给 rerank / pack |
| `rebuildFTS()` 从 `nodes` 派生 `fts_nodes` | FTS5 全文索引，不是独立真相源，而是 `nodes` 的 lexical retrieval 投影 | `searchNodes(...)`、retrieval seed 搜索 | 通过 `fts_nodes` + `nodes` join 做 FTS match 与 `bm25` 评分，召回候选 node 作为 lexical seeds |
| `writeCommunities` 写入 `communities` | 社区划分结果，提供 `community_id`、`label`、`file_count` 等聚类摘要 | `crg context` | `crg context` 直接查询 `communities`，输出 top communities，作为 repository architecture / review context 的补充视图 |
| `writeFlows` 写入 `flows` | flow 级摘要，记录 `entry_node_id`、`criticality`、`node_count` 等流程聚合结果 | `crg context` | `crg context` 直接查询 `flows`，输出 top flows，作为关键路径与高 criticality 流的摘要输入 |

代码依据：

- `src/crg/cli/context.js`：直接查询 `nodes` / `edges` / `communities` / `flows`，再调用 `retrieveContext(...)`
- `src/crg/commands/impact.js`：从 `nodes` 定位 symbol，读取 `edges` 的 `calls` / `imports_from` 做 reverse BFS，再回装 `nodes`
- `src/crg/retrieval/api.js`：统一编排 `buildQueryPlan -> buildSeedSet -> expandSeedSet -> rerank -> semanticRerank -> packContext`
- `src/crg/retrieval/expand.js`：直接消费 `edges`、`nodes`、`chunks`
- `src/crg/search.js`：从 `nodes` 重建 `fts_nodes`，并通过 FTS5 + `bm25` 消费它

补充说明：

- 这里的“消费节点”主要是 CRG runtime / CLI 自己，不是 Stage-0 workflow skills。
- 上面的 `spec-plan` / `spec-work` / `spec-code-review` 等 skill，当前直接消费的是 bootstrap 产物，不是 `nodes` / `edges` / `chunks` 这些 CRG 底层表。
- 因此边界应写成两层：`spec-graph-bootstrap` 负责给 workflow 提供 Stage-0 输入；CRG 负责生成并消费图事实，服务图查询、impact、context retrieval 等运行时能力。

### 第二层：表层产物消费边界

这一层对应上文已经列出的单仓控制面产物表、上下文文档产物表，以及 workspace 额外产物表。它们的职责是给 workflow 提供 Stage-0 输入，属于 bootstrap 的表层产物，而不是 CRG 底层图表。

#### 2.1 控制面产物

对应：`单仓模式：控制面产物表` 与 workspace 根级 control plane 聚合产物。它们主要承担 routing、manifest、minimal-context、freshness、verification 等 machine-readable 输入职责。

#### 2.2 上下文文档产物

对应：`单仓模式：上下文文档产物表` 与 workspace 根级 overview 文档。它们主要承担 summary、module map、test map、high-risk、review-change 等 human-readable 输入职责。

### 第三层：skill 层消费映射总表

这里仅统计“有直接代码证据”的消费关系，不把推测性“可能会读”写成事实。

| skill | 明确直接消费的 Stage-0 产物 | 证据 |
|---|---|---|
| `spec-plan` | `context-routing.json`、`artifact-manifest.json`、`minimal-context/plan.json`、`architecture/module-map.md`、`code-facts/public-entrypoints.md`；fallback 还会用 `00-summary.md`、`pitfalls/index.md`、`code-facts/test-map.md` | `skills/spec-plan/SKILL.md:88-107` |
| `spec-work` | `context-routing.json`、`artifact-manifest.json`、`minimal-context/work.json`、`code-facts/test-map.md`、`context-packs/review-change.md`；fallback 还会用 `00-summary.md`、`pitfalls/index.md`、`code-facts/public-entrypoints.md` | `skills/spec-work/SKILL.md:42-67` |
| `spec-code-review` | `context-routing.json`、`artifact-manifest.json`、`minimal-context/review.json`、`code-facts/high-risk-modules.md`、`code-facts/test-map.md`、`context-packs/review-change.md`；fallback 还会用 `00-summary.md`、`pitfalls/index.md`、`code-facts/public-entrypoints.md` | `skills/spec-code-review/SKILL.md:33-58` |
| `spec-work-beta` | `context-routing.json`、`artifact-manifest.json`、`minimal-context/work.json`、`code-facts/test-map.md`、`context-packs/review-change.md`；fallback 还会用 `00-summary.md`、`pitfalls/index.md`、`code-facts/public-entrypoints.md` | `skills/spec-work-beta/SKILL.md:48-72` |

补充说明：

- `spec-graph-bootstrap` 也大量引用 `docs/contexts/<slug>/` 路径，但它不是当前 Stage-0 产物的“直接运行时消费方”，更像另一路 bootstrap 体系中的设计/文档级关联。
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

- 单仓模式会生成 `24` 个产物
- workspace 根级会额外生成 `8` 个聚合产物
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
