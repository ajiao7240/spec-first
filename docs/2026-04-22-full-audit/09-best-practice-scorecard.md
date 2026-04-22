# 最佳实践评分卡

## 评分说明

- 评分区间：`1-10`
- 评分依据：代码事实、contract、测试执行结果
- 评分不是裁决本身，只是帮助排序

## 评分表

| 维度 | 分数 | 事实依据 | 判断 |
| --- | ---: | --- | --- |
| 哲学一致性 | 8 | `项目角色.md`、薄 CLI、advisory verification、CRG 可解释 retrieval | 方向对 |
| 显式边界 | 6 | selection subject、fallback、marker 注入清楚；但 review-context 越界、setup/MCP route drift | 中上，但有实质缺口 |
| 单一真相源 | 5 | plugin/skills-governance 真源清楚；但 manifest 双语义、sample/live drift、命名漂移存在 | 明显偏弱 |
| 双宿主治理 | 5 | contract 存在且较完整；但入口、route、mirror、命名 drift 真实存在 | 中等偏弱 |
| 测试与可验证性 | 8 | `npm test` 实跑通过，多层测试真实存在 | 整体强 |
| 验证语义准确度 | 6 | doctor 分层很好；但 `verified` 仍属推断 | 中上但需纠偏 |
| CRG 输入质量增强 | 8 | parser/graph/retrieval/generations 清楚，可解释 | 强 |
| 文档与代码一致性 | 4 | `项目治理-agent.md` 未跟踪，mirror drift，文档未覆盖真实治理缺口 | 偏弱 |
| 演化可维护性 | 6 | 架构可延展；但 sample/live、假接口、prompt prose anchor 增耦合 | 中等 |

## 综合判断

- 综合建议分：`6.2 / 10`

## 解释

### 强项

- 哲学基线明确
- 多数关键实现不是强编排
- 测试和发布链真实可运行
- CRG 内核与 verification read model 有清晰价值

### 短板

- 文档定位与真相源边界不稳
- dual-host 与 docs mirror 治理 drift 明显
- single source of truth 被多个局部实现削弱

## 对被审文档的评分

| 维度 | 分数 | 判断 |
| --- | ---: | --- |
| 哲学质量 | 9 | 高 |
| 现状贴合度 | 4 | 低 |
| 可作为正式治理真源的成熟度 | 3 | 目前不够 |
| 可作为审计手册的可用性 | 8 | 高 |

## 结论

- 这份文档更适合被评分为“高质量治理草案”，而不是“已可直接生效的正式治理真源”。
