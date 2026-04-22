# CRG Benchmark Governance

## 1. 文档目标

本文档定义 `CRG + spec-graph-bootstrap` 的 benchmark / regression baseline 治理最小流程，避免出现以下问题：

- 指标变了，但 baseline 静默漂移
- gate 失败后直接调阈值，没有记录原因
- retrieval / routing / telemetry 改动没有可解释的回归判断

## 2. 历史背景（已退役）

> 说明：本文件记录的是 benchmark / regression baseline 曾经存在时的治理思路。`test:crg:gate`、`benchmarks/**`、`scripts/update-crg-baselines.js` 与相关 baseline 机制已在当前实现中退役，以下内容仅用于历史追溯，不再是当前仓库可执行的操作说明。

当时的 `test:crg:gate` 曾聚合以下三类 benchmark：

- `benchmarks/review/run-review-benchmark.js`
- `benchmarks/repo-qa/run-repo-qa.js`
- `benchmarks/context-efficiency/run-context-efficiency.js`

并由 `benchmarks/regression/run-regression.js` 输出以下核心指标：

- `review_average_hit_rate`
- `repo_qa_average_hit_rate`
- `context_efficiency_irrelevant_ratio`
- `fallback_rate`

当时的说明：

- `fallback_rate` 统计的是硬 fallback 比例，即 `evaluation.level != L0`
- `freshness_stale` 这类 `L0` 软降级不会计入 `fallback_rate`

## 3. baseline 更新规则

只有在以下条件同时满足时，才允许更新 `benchmarks/regression/baselines.json`：

1. benchmark 数据集已同步更新，且不是单纯为了抬高分数
2. 变更说明中明确写出为什么指标变动是合理的
3. 至少跑过一次本地 `npm run test:crg:gate`
4. baseline 更新通过 `scripts/update-crg-baselines.js` 生成，而不是手工编辑数值

## 4. dry-run 与正式更新

查看当前建议 baseline：

```bash
node scripts/update-crg-baselines.js --dry-run
```

正式回写 baseline：

```bash
node scripts/update-crg-baselines.js
```

## 5. 审查要求

以下情况默认不接受 baseline 上调：

- 只是为了让当前 gate 通过
- 没有对应 benchmark case 变更说明
- 无法解释 fallback rate 上升原因
- context efficiency 明显恶化，但没有主链或任务类型变化作为依据

以下情况可接受 baseline 重算：

- benchmark 样本集扩大，旧 baseline 已不具可比性
- workflow 默认链发生结构性变化
- retrieval profile 调整后，指标整体改善，需要收紧下限或上限

## 6. 当前治理口径

当前 baseline 是 `P4-B` 阶段的“无回归基线”，不是 `P4` 终局目标。

这意味着：

- 允许 baseline 暂时高于终局目标
- 不允许把临时 baseline 误写成最终质量目标
- 进入 `P4-C Retrieval v2` 后，应优先用真实 benchmark 改善结果，再收紧 baseline
