# spec-graph-bootstrap v2 验收标准清单

> 本文定义 `spec-graph-bootstrap v2` 的验收标准。
> 目标是把前面的方案、产物模型和外部方法论启发，收敛成实现阶段可直接使用的检查清单。

---

## 1. 使用方式

本清单用于以下场景：

1. 评估 v2 设计是否已收敛到可实现状态
2. 评估某一轮实现是否达到了 v2 目标
3. 评估后续迭代是否偏离了 v2 的核心设计原则

建议使用顺序：

1. 先读 `spec-graph-bootstrap-v2-需求与实施方案.md`
2. 再用本文逐项检查设计和实现
3. 对未满足项标注：
   - `P0 必须补齐`
   - `P1 本轮建议补齐`
   - `P2 后续增强`

---

## 2. 总体验收标准

### A1. 定位正确

`spec-graph-bootstrap v2` 必须明确被定义为：

- 研发质量资产生成器

而不是仅仅：

- 项目上下文文档生成器

### A2. 目标正确

设计必须显式面向以下结果：

- 降低后续阶段原创比例
- 降低违反项目约束概率
- 提高命中既有模式概率
- 提升风险感知能力

### A3. 边界正确

v2 必须明确：

- 当前不负责完整消费编排
- 当前不负责完整自动双向同步
- 当前不替代人工架构判断

---

## 3. 产物模型验收

### B1. 两层产物架构保留

必须同时存在：

- `docs/contexts/<slug>/`
- `.context/spec-first/bootstrap/`

### B2. 长期资产升级为五类资产族

必须显式存在以下资产族定义：

- `Understanding`
- `Rules`
- `Patterns`
- `Decisions`
- `Risks`

### B3. 理解类资产保留并增强

至少保留：

- `README.md`
- `00-summary.md`
- `architecture/system-overview.md`
- `architecture/module-map.md`
- `architecture/integration-boundaries.md`

### B4. 规则资产显式存在

至少定义：

- `rules/index.md`
- `rules/coding-rules.md`
- `rules/integration-rules.md`

### B5. 模式资产显式存在

至少定义：

- `patterns/index.md`
- `patterns/review-hotspots.md`

### B6. 决策资产显式存在

至少定义：

- `decisions/index.md`
- `decisions/key-decisions.md`

### B7. 风险资产结构化

至少定义：

- `pitfalls/index.md`
- `pitfalls/hard-gotchas.md`
- `pitfalls/frequent-mistakes.md`

---

## 4. 文档质量验收

### C1. 核心文档任务导向

核心文档不能只讲“是什么”，还必须尽量讲：

- 遇到什么任务先看我
- 看完之后改哪里
- 先读什么规则
- 最像的参考实现在哪里

### C2. 核心文档具备证据

高价值结论应尽量附：

- 路径
- 符号
- 配置键
- schema
- 参考实现

### C3. 核心文档具备可信度标记

必须支持：

- `Verified`
- `Inferred`
- `Unknown`

### C4. 核心文档具备 freshness 意识

至少应有：

- 生成时间
- 可能过时区域

### C5. 核心文档不能大面积泛化空话

以下情况视为不通过：

- 只写框架常识，不写项目内模式
- 只写原则，不写路径
- 只写风险，不写如何识别和规避

---

## 5. 胶水编程一致性验收

本节用于检查 v2 是否真正吸收了“胶水编程”的高价值启发。

### D1. Rules 是一等公民

规则不能埋在架构文档中，必须可单独定位、单独消费。

### D2. Patterns 是一等公民

必须能明确回答：

- 最值得抄什么
- 哪些骨架最稳定
- 哪些模式最容易被 review 打回

### D3. 文档默认支持“抄 + 改”

产物应优先帮助后续节点：

- 命中最近似参考实现
- 理解可替换部分
- 避免无必要原创

### D4. 成功指标包含“降低原创比例”

如果验收口径里完全没有“降低无必要原创”，说明没有真正吸收胶水编程方法论。

### D5. 领域知识不能只被等同于“坑”

设计中应体现：

- 内部约束
- 平台规则
- 业务语义
- 高价值经验

不应全部塞进 `pitfalls/`。

---

## 6. 通用性验收

### E1. 不过拟合前端 CRUD

v2 不得默认：

- 所有项目都是前端页面型项目
- 所有高频任务都是列表/表单

### E2. 显式覆盖多场景

方案至少应能解释并支持：

- 前端 Web
- 后端服务
- App
- PC/桌面端
- CLI
- 数据/ETL
- 异步任务

### E3. `patterns/` 按能力面扩展

至少应能覆盖：

- screen / flow
- UI
- API
- state
- client platform
- jobs
- CLI
- testing

### E4. worker 激活由项目信号驱动

不得通过固定前端模板假设所有项目。

---

## 7. worker 模型验收

### F1. 固定 worker 扩展完成

至少定义：

- `summary-context`
- `architecture-context`
- `rules-context`
- `patterns-context`
- `decisions-context`
- `pitfalls-context`

### F2. 条件 worker 设计合理

条件 worker 至少能承接：

- layer
- guide
- database
- domain rules
- testing rules
- data rules
- screen patterns
- UI patterns
- API patterns
- state patterns
- client-platform patterns
- jobs patterns
- CLI patterns
- testing patterns

### F3. 文件 ownership 明确

不得存在多个 worker 共写一个文件的设计。

### F4. orchestrator 负责 assembly

`README.md` 等共享导航文件必须仍由 orchestrator 串行写入。

---

## 8. PRD 合同验收

### G1. PRD 从写作说明升级为质量资产合同

PRD 必须不止写“写哪些文件”，还要写“解决什么问题、提供什么证据、如何帮助后续任务起步”。

### G2. PRD 具备关键字段

至少包含：

- `Primary Questions`
- `Candidate Signals`
- `Required Evidence`
- `Task Entry Expectations`
- `Confidence Policy`
- `Freshness Risks`

### G3. PRD 约束推断边界

worker 不能把弱推断包装成强事实。

### G4. PRD 明确任务入口要求

如果 PRD 不要求输出任务入口，最终文档大概率仍会退回说明书形态。

---

## 9. assembly 与 rerun 验收

### H1. assembly 具备质量检查

至少检查：

- 无证据强结论
- 缺 `Verified/Inferred`
- 缺 `Closest Examples`
- 规则与模式混写
- 缺任务入口

### H2. rerun 保护保留

v1 的备份恢复机制必须保留。

### H3. rerun 有 stale 意识

应逐步具备以下能力：

- 提示可能失效的参考实现
- 提示可能过时的区域
- 提示新增高风险热点

---

## 10. 指标验收

### I1. 不只看文件数量

验收不能只看：

- 生成了多少文件
- 目录是否完整

### I2. 必须看产物质量

至少应关注：

- 证据覆盖率
- `Verified` 比例
- 模式覆盖率
- 规则覆盖率

### I3. 必须看下游效果

至少应关注：

- 后续 plan 中内联示例代码长度是否下降
- work 中原创比例是否下降
- review 中风格/模式偏差是否下降
- review 中规则违反是否下降

---

## 11. 优先级建议

### P0 必须满足

- 两层产物架构保留
- 五类资产族成立
- `rules/`、`patterns/`、`decisions/` 成立
- 固定 worker 扩展完成
- PRD 新关键字段成立
- 文档任务导向成立
- 通用性约束成立

### P1 应尽快满足

- `Verified/Inferred/Unknown`
- freshness 标记
- `guides/task-playbooks.md`
- 高价值 patterns 细化
- 质量检查增强

### P2 后续增强

- 更强的 rerun 差异提示
- 失效参考实现检测
- 人工增强保留策略
- 更细的场景化指标

---

## 12. 最终判断

如果某一版实现不能通过以下四项，就不应视为真正的 `spec-graph-bootstrap v2`：

1. `rules/` 是否成立
2. `patterns/` 是否成立
3. 文档是否支持任务入口和参考实现
4. 设计是否显式面向“降低无必要原创”

只要这四项没有成立，再多文档也仍然只是“v1 的扩写版”，还不是 v2。
