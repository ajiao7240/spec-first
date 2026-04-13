# 业界分析索引

这里汇总的是围绕 `compound-engineering`、`spec-first` 和 `compound-workflows` 的流程、机制、飞轮化能力分析。

## 推荐阅读顺序

1. [0.流程门禁与状态流转分析.md](./0.流程门禁与状态流转分析.md)
2. [1.Review机制详细设计.md](./1.Review机制详细设计.md)
3. [2.各阶段稳定产物与交接机制分析.md](./2.各阶段稳定产物与交接机制分析.md)
4. [3.需求交付飞轮与系统自我进化机制.md](./3.需求交付飞轮与系统自我进化机制.md)

## 现有对比材料

- [详细对比分析.md](./详细对比分析.md)
- [对比分析.md](./对比分析.md)
- [6.spec-first相对compound-engineering-plugin总目录页.md](./6.spec-first相对compound-engineering-plugin总目录页.md)
- [4.spec-first相对compound-engineering-plugin能力缺口分析.md](./4.spec-first相对compound-engineering-plugin能力缺口分析.md)
- [5.spec-first相对compound-engineering-plugin平台与生态能力缺口分析.md](./5.spec-first相对compound-engineering-plugin平台与生态能力缺口分析.md)
- [7.skill-agent-映射核对与升级同步指南.md](./7.skill-agent-映射核对与升级同步指南.md)
- [8.核心链路逐commit同步矩阵-v1.md](./8.核心链路逐commit同步矩阵-v1.md)

## 文档定位

- `0.流程门禁与状态流转分析`：分析 brainstorm -> plan -> work -> review -> compound 的状态流转规则
- `1.Review机制详细设计`：分析 review 的评分、通过机制和产物落盘路径
- `2.各阶段稳定产物与交接机制分析`：分析每阶段是否有稳定产物文件，以及下一阶段如何消费
- `3.需求交付飞轮与系统自我进化机制`：从长期目标出发，抽象需求交付飞轮和自我进化闭环
- `7.skill-agent-映射核对与升级同步指南`：给后续同步升级提供 skill / agent 的全量映射基线、分叉判断与升级优先级
- `8.核心链路逐commit同步矩阵-v1`：把上游核心链路相关 commit 映射到当前仓库具体文件，直接指导升级批次划分

## 目标

这组文档的核心目标不是罗列 skill，而是回答一个更大的问题：

- 系统如何让交付越来越快
- 系统如何让质量越来越好
- 系统如何沉淀经验并减少重复劳动
- 系统如何把每个需求变成下一个需求的铺路石
