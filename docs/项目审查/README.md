# 项目审查文档索引

本目录用于沉淀对 `spec-first` 项目的阶段性代码审查、专项分析与整改路线图。  
这里的文档默认分为三类：

- 仓库级总审查
- 专项深挖审查
- 整改路线图

本目录不是需求文档目录，不是实施日志目录，也不是 changelog。

## 当前审查主题

当前主线审查聚焦于两件事：

1. `spec-first` 是否正在沿“轻 contract + 明确边界 + 让 LLM 决策”的方向演进。
2. `spec-graph-bootstrap` 是否为下游 workflow 提供了足够真实、可追溯、可降级的高质量决策输入。

## 阅读顺序

1. [2026-04-18-spec-first-code-audit-report.md](/Users/kuang/xiaobu/spec-first/docs/项目审查/2026-04-18-spec-first-code-audit-report.md)  
   作用：仓库级总审查，回答项目本质、系统定位、核心风险、总体优先级。

2. [2026-04-18-spec-first-strengths-weaknesses-summary.md](/Users/kuang/xiaobu/spec-first/docs/项目审查/2026-04-18-spec-first-strengths-weaknesses-summary.md)  
   作用：补充摘要，聚焦项目优缺点、`caution over speed` 取向，以及从软件工程 / AI workflow / specification engineering 三个视角的判断。

3. [2026-04-18-spec-first-principle-aligned-rereview.md](/Users/kuang/xiaobu/spec-first/docs/项目审查/2026-04-18-spec-first-principle-aligned-rereview.md)  
   作用：原则对齐版复审，专门检查整改建议是否符合“轻 contract + 明确边界 + 让 LLM 决策”，并防止后续优化滑向强编排 / 状态机。

4. [2026-04-18-spec-graph-bootstrap-audit.md](/Users/kuang/xiaobu/spec-first/docs/项目审查/spec-graph-bootstrap/2026-04-18-spec-graph-bootstrap-audit.md)  
   作用：专项深挖，聚焦 `spec-graph-bootstrap` 对 Stage-0 决策输入和 `plan/work/review` 下游链路的影响。

5. [2026-04-18-spec-graph-bootstrap-optimization-roadmap.md](/Users/kuang/xiaobu/spec-first/docs/项目审查/spec-graph-bootstrap/2026-04-18-spec-graph-bootstrap-optimization-roadmap.md)  
   作用：整改路线图，把专项审查结论转成可执行的优化顺序。

## 文档类型说明

- `audit-report`
  - 仓库级结论文档
  - 面向技术负责人 / 平台负责人
  - 输出整体判断、总分、成熟度、优先级

- `专项审查` / `deep-dive`
  - 面向关键模块或关键链路
  - 输出证据链、局部问题、优化方向

- `roadmap`
  - 面向整改实施
  - 输出任务分组、顺序、阶段目标、验收门

## 当前状态

- 仓库级总审查：已完成
- `spec-graph-bootstrap` 专项审查：已完成
- `spec-graph-bootstrap` 整改路线图：已形成
- 实施跟踪：尚未建立

## 目录治理规则

1. 一个审查周期内，只保留一份仓库级主报告。
2. 每份专项报告必须显式声明它服务于哪份主报告。
3. 每份路线图必须显式声明来源专项报告，不独立悬空存在。
4. 路线图进入实施后，应新增实施跟踪文档，不把执行日志写回审查结论文档。
5. 新文档优先补链路关系，再补内容，避免目录逐渐演变成“报告堆积区”。
