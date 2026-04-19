# spec-graph-bootstrap v2 总体方案

> 本文是 `spec-graph-bootstrap` v2 的主方案文档。
> 它统一收束以下主题：
>
> - 为什么 v1 不够
> - v2 的目标与边界
> - v2 的产物模型
> - v2 的 worker 与 PRD 升级方向
> - v2 的通用性要求
> - v2 的分阶段落地路径

---

## 1. 方案结论

`spec-graph-bootstrap` v2 应从“项目上下文生成”升级为“研发质量资产生成”。

也就是说，Stage-0 的职责不再只是帮助后续节点读懂仓库，而是要提前生产后续研发阶段真正需要的高价值资产：

1. `Understanding`
2. `Rules`
3. `Patterns`
4. `Decisions`
5. `Risks`

一句话概括：

> v2 的 `spec-graph-bootstrap` 不是文档生成器，而是研发质量资产生产器。

---

## 2. 为什么要升级

## 2.1 v1 的价值

v1 已经建立了 Stage-0 的基本形态，能够生成：

- 项目总览
- 系统结构
- 模块地图
- 集成边界
- 风险入口
- 分层文档
- 数据库 ER 概览

这套产物解决了“项目不再完全依赖口头传递”的问题，也让后续阶段具备了一个最低成本的认知入口。

## 2.2 v1 的核心不足

如果目标是提升研发质量，v1 还存在 5 个关键问题：

1. 偏介绍型，缺任务导向
2. 缺独立规则层，硬约束不够显式
3. 缺独立样板层，最值得抄的实现没有被系统沉淀
4. 缺关键决策层，“为什么这样做”不可见
5. 高价值结论的证据、可信度和时效性表达不够

结果是：

> 后续节点也许能理解项目，但仍然可能高原创、低一致性、易犯规、易误判。

### 2.3 胶水编程提供的额外验证

外部“胶水编程”实践进一步验证了这个方向：  
真正提升研发质量的关键，不是继续强化抽象描述，而是把团队已有的规范、样板、领域知识和任务规格组合起来，让 AI 尽量“抄 + 改”而不是“从零写”。

这对 `spec-graph-bootstrap v2` 的直接启发是：

1. `rules/` 必须成为一级资产
2. `patterns/` 必须成为一级资产
3. 文档要优先提供最近似参考实现，而不是停留在架构概览
4. 研发质量目标应显式包含“降低无必要原创”

---

## 3. v2 的目标与边界

## 3.1 目标

v2 的目标是：

1. 生成长期可复用的研发质量资产
2. 降低后续阶段的原创比例
3. 降低违反项目约束的概率
4. 提高命中既有代码模式的概率
5. 提升对风险和历史取舍的感知能力
6. 为 `plan / work / review / compound` 提供高质量上游资产

## 3.2 非目标

v2 当前不做：

1. 不自动把全部资产注入后续阶段
2. 不做完整自动双向同步
3. 不替代人工架构判断
4. 不要求所有高价值规则和样板都自动生成
5. 不要求一次性做完全部知识治理能力

边界很明确：

> v2 先把“该产什么资产”定义对，再逐步解决“如何消费这些资产”。

---

## 4. 核心设计原则

1. **从认知资产升级为执行资产**  
文档不只回答“是什么”，还要回答“接下来该怎么做”。

2. **Rules 与 Patterns 独立成层**  
“什么不能写错”和“最该抄什么”必须是一等公民。

3. **证据先于结论**  
高价值结论尽量附文件路径、符号、配置键、schema 或参考实现。

4. **显式可信度**  
统一标注 `Verified / Inferred / Unknown`。

5. **面向任务入口**  
每份关键文档都要回答“遇到什么任务时该先看我”。

6. **自动生成与人工策展分层**  
机械事实自动扫，高价值规则、样板、决策允许人工补强。

7. **默认降低原创比例**  
研发质量提升的核心不是“让 AI 多写”，而是“让 AI 少原创、少走偏”。

8. **优先沉淀最像的参考实现**  
抽象原则重要，但在高频研发场景下，最有价值的往往是“最值得抄的那份代码”。

---

## 5. v2 的产物模型

## 5.1 两层架构保持不变

```text
docs/contexts/<slug>/          ← 长期质量资产
.context/spec-first/bootstrap/ ← 执行期控制面
```

## 5.2 长期资产升级为五类资产族

```text
docs/contexts/<slug>/
├── README.md
├── 00-summary.md
├── architecture/
├── rules/
├── patterns/
├── decisions/
├── pitfalls/
├── layers/
├── guides/
└── database/
```

### `Understanding`
作用：帮助理解系统结构、主链路、关键边界和稳定区域

### `Rules`
作用：明确硬约束、底线规则、域规则和测试/数据约束

### `Patterns`
作用：沉淀最该抄的骨架、标准组合方式和 review 高频偏差

### `Decisions`
作用：显性化关键设计取舍、历史兼容原因和必须尊重的约束

### `Risks`
作用：提前暴露高风险区域、高频错误、过时区域和危险假设

---

## 6. 产物清单总览

## 6.1 固定产物

固定产物应至少包括：

- `README.md`
- `00-summary.md`
- `architecture/system-overview.md`
- `architecture/module-map.md`
- `architecture/integration-boundaries.md`
- `rules/index.md`
- `rules/coding-rules.md`
- `rules/integration-rules.md`
- `patterns/index.md`
- `patterns/review-hotspots.md`
- `decisions/index.md`
- `decisions/key-decisions.md`
- `pitfalls/index.md`
- `pitfalls/hard-gotchas.md`
- `pitfalls/frequent-mistakes.md`

## 6.2 条件产物

按项目实际信号生成：

- `layers/*`
- `guides/*`
- `database/*`
- `rules/domain-constraints.md`
- `rules/testing-rules.md`
- `rules/data-rules.md`
- `patterns/screen-flow.md`
- `patterns/ui-crud.md`
- `patterns/api-integration.md`
- `patterns/state-management.md`
- `patterns/background-jobs.md`
- `patterns/client-platform.md`
- `patterns/cli-patterns.md`
- `patterns/testing-patterns.md`
- `decisions/tradeoffs.md`
- `decisions/historical-constraints.md`
- `pitfalls/stale-areas.md`
- `pitfalls/unsafe-assumptions.md`

---

## 7. 文档结构统一要求

所有核心文档都应尽量具备以下特征：

- 有明确适用范围
- 有任务入口
- 有真实证据
- 有 `Verified/Inferred`
- 有推荐参考实现
- 有风险或限制说明
- 有 freshness 提示

建议的统一章节骨架：

- `Purpose`
- `When To Read`
- `Scope`
- `Verified Facts`
- `Inferred Conclusions`
- `Hard Rules`
- `Recommended Patterns`
- `Entry Points`
- `Closest Examples`
- `Hotspots`
- `Evidence`
- `Freshness`

这会让文档从“介绍型”升级为“执行型”。

---

## 8. v2 的 worker 模型

## 8.1 固定 worker

固定 worker 建议升级为：

- `summary-context`
- `architecture-context`
- `rules-context`
- `patterns-context`
- `decisions-context`
- `pitfalls-context`

## 8.2 条件 worker

条件 worker 由项目信号驱动，例如：

- `<layer>-context`
- `guide-context`
- `database-context`
- `domain-rules-context`
- `testing-rules-context`
- `data-rules-context`
- `screen-patterns-context`
- `ui-patterns-context`
- `api-patterns-context`
- `state-patterns-context`
- `client-platform-patterns-context`
- `jobs-patterns-context`
- `cli-patterns-context`
- `testing-patterns-context`
- `tradeoffs-context`
- `historical-constraints-context`
- `stale-risk-context`
- `unsafe-assumptions-context`
- `write-sensitive-context`

固定 worker 保证 v2 的基础盘，条件 worker 保证场景适配能力。

---

## 9. PRD 合同升级

v2 的 PRD 不应再只是“这个 worker 写哪些文件”，而应升级为“质量资产合同”。

建议在 PRD 中新增：

- `Primary Questions`
- `Candidate Signals`
- `Required Evidence`
- `Task Entry Expectations`
- `Confidence Policy`
- `Freshness Risks`

这会强制 worker 回答以下问题：

- 我到底要解决什么问题
- 我必须拿出什么证据
- 我可以推断到什么程度
- 我的文档如何帮助后续任务起步
- 我如何标明可信度

---

## 10. 通用性要求

v2 必须显式避免过拟合单一研发场景。

不能默认：

- 项目一定是前端 Web
- 高频任务一定是列表页/表单页
- 规则一定围绕组件和接口
- 模式一定围绕 CRUD 页面

v2 应覆盖的主场景包括：

- 前端 Web
- 后端服务
- 移动端 App
- 桌面端 PC
- CLI 工具
- 数据与 ETL
- 异步任务与后台作业

落地方式：

1. 产物先按资产类型组织，不按某个业务场景组织
2. `patterns/` 允许按能力面专题化
3. worker 激活由项目类型信号驱动
4. `layers/` 覆盖前端、后端、mobile、desktop、cli、data

---

## 11. 治理模型

建议采用两层治理：

## 11.1 自动生成层

适合自动化的内容：

- `summary`
- `architecture`
- `layers`
- `database`
- `evidence`
- `freshness`

## 11.2 人工策展层

适合人工补强的内容：

- `rules`
- `patterns`
- `decisions`
- 高价值 `pitfalls`

原因很简单：

- 机械事实适合自动化
- 高价值规则和样板不适合完全依赖推断

---

## 12. 成功指标

v2 的成功不应只看“是否多生成了几篇文档”，而要看是否减少了下游误差。

## 12.1 产物侧指标

- 高价值结论有证据的比例
- 标记 `Verified` 的比例
- 高价值任务的样板覆盖率
- 高价值规则覆盖率

## 12.2 下游效果指标

- 后续 `plan` 中内联示例代码长度下降
- 后续 `work` 的原创比例下降
- `review` 中风格偏差类问题下降
- `review` 中违反规则类问题下降
- 参考实现命中率上升

## 12.3 治理指标

- stale 文档比例
- rerun 后失效参考实现数
- 新规则/样板回灌速度

---

## 13. 分阶段落地

## Phase A：产物模型升级

先完成：

- `rules/`
- `patterns/`
- `decisions/`
- `pitfalls/` 重构
- 核心文档章节统一

目标：

- 先把“该产什么”定义正确

## Phase B：worker 与 PRD 升级

再完成：

- 固定 worker 扩展
- 条件 worker 扩展
- PRD v2 模板
- assembly 质量检查增强

目标：

- 把“怎么稳定地产”做起来

## Phase C：证据与 freshness 升级

再补：

- `Verified/Inferred/Unknown`
- freshness 提示
- rerun 差异提示
- 失效参考实现提示

目标：

- 提高资产可信度

## Phase D：消费对接

最后再接入：

- `brainstorm`
- `plan`
- `work`
- `review`
- `compound`

目标：

- 让正确的资产真正被用起来

---

## 14. 本轮明确不做

为了避免 v2 范围失控，本轮不做：

1. 不做完整知识运营系统
2. 不做自动双向同步闭环
3. 不要求自动识别全部历史决策
4. 不要求所有项目类型第一版都支持到极致
5. 不要求一次性解决所有 stale 问题

---

## 15. 当前知识库中的文档关系

建议阅读顺序如下：

1. `spec-graph-bootstrap-v2-总体方案.md`
2. `spec-graph-bootstrap-v2-演进决策稿.md`
3. `spec-graph-bootstrap-v2-产物清单明细表.md`
4. `spec-graph-bootstrap-v2-worker-任务拆分与PRD模板升级稿.md`
5. `spec-graph-bootstrap-产物文档全览.md`（v1 历史版）

它们的定位分别是：

- `总体方案`：主入口
- `演进决策稿`：为什么这样升级
- `产物清单`：到底产什么
- `worker/PRD`：怎么稳定地产
- `v1 历史版`：旧模型对照

---

## 16. 最终判断

`spec-graph-bootstrap` 下一版真正要解决的问题，不是“把现在的文档写得更细”，而是：

> 把 Stage-0 从项目认知准备阶段，升级为研发质量准备阶段。

只有当 Stage-0 能稳定产出规则、样板、决策、风险和证据时，后续阶段才可能真正做到：

- 少原创
- 少犯规
- 少误判
- 少返工

这才是 v2 的核心价值。
