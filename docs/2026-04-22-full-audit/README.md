# 2026-04-22 Full Audit

本目录是对 `spec-first` 仓库执行的一次**完整审计模式 + 最佳实践辩论模式 + 多 Agent 协作模式**的全量代码审查草案。

## 审计目标

- 以代码为第一事实来源评估项目当前实现
- 禁止抽查，先建立代码地图，再逐层审查
- 判断项目与 `Light contract / Explicit boundaries / Let the LLM decide` 的一致性
- 给出可执行的演化建议、优先级路线图与裁决理由

## 覆盖范围

已覆盖以下层面：

- 源码层：`src/cli/`、`src/bootstrap-compiler/`、`src/context-routing/`、`src/crg/`
- 工程层：`bin/`、`scripts/`、`package.json`
- 测试层：`tests/unit/`、`tests/smoke/`、`tests/integration/`、`tests/e2e/`
- workflow 资产层：`skills/`、`agents/`、`templates/`、`.claude-plugin/`
- 文档/契约/知识层：`docs/contracts/`、`docs/solutions/`、`docs/contexts/`
- 排除层：`vendor/` 第三方受控依赖、宿主 runtime 副本目录（非源码真源）

## 结论概览

- 项目整体方向**基本正确**，且明显贯彻了“脚本做确定性流程，LLM 做语义决策”的核心哲学。
- 最接近最佳实践的部分，是 **Stage-0 / context-routing / verification summary / runtime installer** 这些把输入质量与边界做成显式 contract 的实现。
- 当前最主要的问题不是“方向错误”，而是**复杂度持续堆叠到少数共享枢纽**，并且 source / mirror / runtime / sample 的同步成本越来越高。
- 项目应优先做**复杂度收口与关键枢纽解耦**，而不是继续扩展治理面。
- 如果负责人只读一份文件，先看 [`00-executive-summary.md`](00-executive-summary.md)。
- 如果要直接看行动次序，先看 [`08-priority-roadmap.md`](08-priority-roadmap.md)。
- 如果要看裁决依据，先看 [`13-decision-rationale.md`](13-decision-rationale.md)。

## 文档索引

- [00-executive-summary](00-executive-summary.md)
- [01-codebase-map](01-codebase-map.md)
- [02-layer-review](02-layer-review.md)
- [03-critical-flow-review](03-critical-flow-review.md)
- [04-test-and-quality-review](04-test-and-quality-review.md)
- [05-best-practice-debate](05-best-practice-debate.md)
- [06-evolution-opportunities](06-evolution-opportunities.md)
- [07-integration-proposals](07-integration-proposals.md)
- [08-priority-roadmap](08-priority-roadmap.md)
- [09-best-practice-scorecard](09-best-practice-scorecard.md)
- [10-actionable-tasks](10-actionable-tasks.md)
- [11-agent-execution-overview](11-agent-execution-overview.md)
- [12-agent-findings-matrix](12-agent-findings-matrix.md)
- [13-decision-rationale](13-decision-rationale.md)
