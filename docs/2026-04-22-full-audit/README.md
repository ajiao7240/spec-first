# 2026-04-22 Full Audit

## 审计对象

- 主审对象：`docs/10-prompt/项目治理-agent.md`
- 强制基线：`docs/10-prompt/项目角色.md`
- 审计方式：完整审计模式 + 最佳实践辩论模式 + 多 Agent 协作模式

## 前提事实

- 本次审计以代码为第一事实来源，文档只作为辅助证据。
- 被审文档 `docs/10-prompt/项目治理-agent.md` 当前是 `git` 未跟踪文件，不是已提交治理真源。
- 主线程实际运行了 `npm test`，`unit + smoke + integration + e2e:crg` 全部通过。
- 本次启用了 5 个分域 agent 和 1 个主裁决 agent，主线程承担文档辩论与集成写作。

## 总结论

- 该文档的哲学方向与 `项目角色.md` 一致，值得保留。
- 该文档不能直接作为“现行治理真源”落地；更准确的定位应是“审计作战手册 / 候选治理草案”。
- 仓库当前的主要治理缺口不在理念，而在落地细节：dual-host 入口漂移、sample/live 漂移、manifest 双语义、review-context 越界、mirror drift、verification 语义偏强、部分测试层未接线。
- 最合理的收口方式不是一次性大重写，而是：
  1. 先修文档定位与检查清单。
  2. 再修单一真相源、freshness、入口治理与测试接线。
  3. 最后再实验化高成本 full-audit workflow 与 runnable probe。

## 文档索引

- `00-executive-summary.md`：给项目负责人快速阅读的高层摘要
- `01-codebase-map.md`：全量代码地图与覆盖证明
- `02-layer-review.md`：分层审查结果
- `03-critical-flow-review.md`：关键链路全流程审查
- `04-test-and-quality-review.md`：测试、质量与工程成熟度审查
- `05-best-practice-debate.md`：最佳实践辩论纪要
- `06-evolution-opportunities.md`：演化机会清单
- `07-integration-proposals.md`：详细集成提案
- `08-priority-roadmap.md`：优先级路线图
- `09-best-practice-scorecard.md`：量化评分卡
- `10-actionable-tasks.md`：可执行任务清单
- `11-agent-execution-overview.md`：多 Agent 执行总览
- `12-agent-findings-matrix.md`：Agent 发现矩阵
- `13-decision-rationale.md`：主裁决逻辑与未采纳原因

## 产出原则

- 每份文档都区分 `事实层`、`判断层`、`建议动作`。
- 所有重要结论都优先引用代码、contract、测试或执行结果。
- 所有建议均按以下分类输出：
  - `应保留`
  - `应强化`
  - `应轻量化`
  - `应重构`
  - `应删除`
  - `应实验化`

## 建议使用方式

- 先读 `00-executive-summary.md` 与 `13-decision-rationale.md`。
- 再读 `08-priority-roadmap.md` 与 `10-actionable-tasks.md`，决定是否拆成多轮治理任务。
- 若要把 `项目治理-agent.md` 纳入正式基线，必须先完成本审计中标记为 `P0` 的文档定位与治理清单修正。
