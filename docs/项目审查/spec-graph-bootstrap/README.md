# `spec-graph-bootstrap` 专题文档索引

本目录用于集中存放 `spec-graph-bootstrap` 的专项审查与整改规划文档。  
主题聚焦于一个核心问题：

`spec-graph-bootstrap` 当前是否正在为 `spec-plan`、`spec-work`、`spec-code-review` 提供足够真实、可追溯、可降级的 Stage-0 决策输入。

## 阅读顺序

1. [2026-04-18-spec-graph-bootstrap-audit.md](/Users/kuang/xiaobu/spec-first/docs/项目审查/spec-graph-bootstrap/2026-04-18-spec-graph-bootstrap-audit.md)  
   作用：专项深挖审查，分析这个 skill 会生成哪些产物、这些产物如何被下游消费，以及当前“装配完成度”与“事实真实性”之间的落差。

2. [2026-04-18-spec-graph-bootstrap-artifacts-map.md](/Users/kuang/xiaobu/spec-first/docs/项目审查/spec-graph-bootstrap/2026-04-18-spec-graph-bootstrap-artifacts-map.md)  
   作用：基于当前代码真实写盘逻辑，梳理 `spec-graph-bootstrap` 会生成哪些产物、产物结构图、每个产物的内容/作用域/下游 skill 消费关系，以及 workspace 模式的额外产物边界。

3. [2026-04-18-spec-graph-bootstrap-target-model-and-migration-plan.md](/Users/kuang/xiaobu/spec-first/docs/项目审查/spec-graph-bootstrap/2026-04-18-spec-graph-bootstrap-target-model-and-migration-plan.md)  
   作用：给出面向未来的目标产物模型与迁移路线图，回答哪些产物应保留为真源、哪些应降级为 runtime cache、哪些应退出默认核心集合。

4. [2026-04-29-graph-blast-radius-product-capability-map-and-roadmap.md](/Users/kuang/xiaobu/spec-first/docs/项目审查/spec-graph-bootstrap/2026-04-29-graph-blast-radius-product-capability-map-and-roadmap.md)  
   作用：定义 Graph Blast Radius 的产品定位、能力边界、成熟度判断与阶段路线图，并明确它与 graph readiness、live MCP probe、下游 workflow 消费之间的关系。

5. [2026-04-18-spec-graph-bootstrap-optimization-roadmap.md](/Users/kuang/xiaobu/spec-first/docs/项目审查/spec-graph-bootstrap/2026-04-18-spec-graph-bootstrap-optimization-roadmap.md)  
   作用：整改路线图，把专项审查中的问题转成可执行的优化顺序、任务组和阶段目标。

6. [2026-04-18-graphify-integration-analysis.md](/Users/kuang/xiaobu/spec-first/docs/项目审查/spec-graph-bootstrap/2026-04-18-graphify-integration-analysis.md)  
   作用：分析 `graphify` 的项目思想、架构逻辑及其与 `spec-graph-bootstrap` 的集成边界，明确哪些能力适合以 sidecar 方式接入，哪些不应进入 Stage-0 主合同与主 gate。

7. [2026-04-18-integration-decision-checklist.md](/Users/kuang/xiaobu/spec-first/docs/项目审查/spec-graph-bootstrap/2026-04-18-integration-decision-checklist.md)  
   作用：把“哪些必须集成、哪些可选增强、哪些不要进入主路径”收敛成一份可执行清单，便于后续按高质量编码目标做取舍。

## 文档角色

- `audit`
  - 作用：建立证据链，判断问题是否成立、影响有多大、优先级如何排序

- `roadmap`
  - 作用：定义修复顺序、实施边界和验收方向，不重复证明问题本身

- `artifacts-map`
  - 作用：回答“当前代码真实会生成什么、谁在消费这些产物”，用于区分合同声明与当前实现

- `target-model-and-migration-plan`
  - 作用：定义更轻、更清晰的目标产物结构，并给出从当前实现迁移到目标结构的阶段化路径

- `product-capability-map-and-roadmap`
  - 作用：定义 Graph Blast Radius 的产品能力边界、用户价值、阶段路线图，以及它与 `spec-graph-bootstrap` / external graph provider readiness 的关系

- `graphify-integration-analysis`
  - 作用：定义 `graphify` 在 `spec-first` 中的正确角色，避免把语义图旁路误接成主事实合同或主质量门

- `integration-decision-checklist`
  - 作用：给后续设计评审与实施排序提供决策清单，避免讨论反复和过度设计

## 与上层目录的关系

- 上位主报告见：
  [2026-04-18-spec-first-code-audit-report.md](/Users/kuang/xiaobu/spec-first/docs/项目审查/2026-04-18-spec-first-code-audit-report.md)
- 父级索引见：
  [docs/项目审查/README.md](/Users/kuang/xiaobu/spec-first/docs/项目审查/README.md)

## 当前状态

- 专项审查：已完成
- 整改路线图：已形成
- 产品能力地图：已形成
- 实施跟踪：尚未建立

## 目录治理规则

1. 本目录只放 `spec-graph-bootstrap` 相关的专题文档。
2. 新增文档时，优先说明它是 `audit`、`roadmap` 还是后续 `implementation-tracker`。
3. 进入实施阶段后，应新增跟踪文档，而不是把执行日志混入审查结论文档。
