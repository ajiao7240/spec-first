# spec-req：Stage -1 需求录入 Workflow 设计方案

> 方案性质：需求设计稿
> 适用范围：新增 `spec-req` skill，联动 `spec-plan`、`spec-ideate`、`spec-brainstorm`、`spec-code-review`
> 撰写日期：2026-04-04
> 参考方法论：Shape Up (Basecamp)、Amazon PRFAQ、RFC Process、BDD/Gherkin、ADR

---

## 1. 问题诊断

当前 spec-first 的隐含假设是：需求在 `spec-plan` 运行前已经存在于某处。实际上需求活在对话、消息、Issue 里，每次 spec-plan 都从零理解一遍，且无法追溯"这个 plan 解决了什么需求"。

业界研究揭示了三层模糊来源：

| 层面 | 症状 | 对应方法 |
|---|---|---|
| 商业模糊 | "为什么要做？"不清晰 | Amazon PRFAQ |
| 需求模糊 | "要做什么？"不具体 | BDD + Shape Up Rabbit Holes |
| 技术模糊 | "怎么做？"有多个选项 | ADR + RFC Unresolved Questions |

`spec-req` 的职责是解决**前两层模糊**，第三层交给 `spec-plan`。

---

## 2. 核心设计原则（来自业界综合）

### 2.1 Working Backwards（Amazon）
**从成功状态出发**，而不是从当前能力出发。`spec-req` 的第一个问题永远是：
> "这个功能完成后，用户能做到什么之前做不到的事？"

### 2.2 Appetite 作为范围约束（Shape Up）
**时间预算不是估算，是决策**。需求录入时必须声明 appetite（S/M/L），它决定后续 spec-plan 的输出深度：

| Appetite | 时间 | spec-plan 输出 |
|---|---|---|
| S（小） | 1–3 天 | tasks 列表，无需 proposal |
| M（中） | 1–2 周 | proposal + design + tasks |
| L（大） | 2–4 周 | proposal + design + tasks + 拆分子需求建议 |

### 2.3 验收标准可执行化（BDD）
AC 不写"系统应该……"，写 **Given / When / Then**：

```
- Scenario: 用户登录成功
  Given 用户在登录页，且账号已注册
  When 输入正确的用户名和密码
  Then 跳转到工作台，显示欢迎提示
```

这让 spec-code-review 能直接对照 AC 评审，而不是靠主观判断。

### 2.4 Rabbit Holes 预先声明（Shape Up）
在需求阶段就标出可能让 Agent 陷入复杂度的区域，spec-plan 看到后列入 doubt points，spec-work 列入 preflight 检查。

### 2.5 开放问题显式化（RFC）
未决策的点不隐藏，在需求文档中明确列出，自动流转成 spec-plan 的 `doubt points`，而不是让 Agent 自行填充假设。

---

## 3. 需求文档格式

写入位置：`spec-docs/<project-slug>/requirements/features/<req-id>-<slug>.md`

```markdown
---
id: req-2026-04-04-001
type: feature          # feature | epic | bug | refactor
status: draft          # draft | ready | in-progress | done
appetite: M            # S | M | L
project: project-A
created: 2026-04-04
author: kuang
refs_adr: []           # 关联架构决策记录
---

# 功能名称

## 成功画面（Working Backwards）
完成后，用户能做什么？与现在有什么不同？用一段话描述用户视角的世界。

## 背景与动机
为什么现在要做？用户或业务遇到了什么具体问题？

## 目标用户与场景
谁在什么情况下使用？

## 核心需求（What，不写 How）
要提供什么能力，用用户语言描述。

## 验收标准（BDD）

- Scenario: [主路径]
  Given ...
  When ...
  Then ...

- Scenario: [异常路径]
  Given ...
  When ...
  Then ...

## Appetite
S / M / L —— 这个需求值多少时间投入，为什么？

## Rabbit Holes
可能陷入的复杂区域，需要在 plan 阶段提前决策，避免实现时扩散。

## No-gos
明确不做什么，即使看起来相关。

## 开放问题（→ spec-plan doubt points）
- [ ] 问题一：...
- [ ] 问题二：...
```

Epic 级（跨多个 plan）写入 `requirements/epics/`，格式相同，额外包含 `features` 字段列出关联 feature 列表。

---

## 4. 交互模式设计

### 4.1 Express 模式（推荐，日常使用）

用户提供任意形式的原始输入（口述、消息截图、Issue 链接），`spec-req` 通过**最多 3 轮提问**完成澄清，生成草稿。

**3 个必问问题（顺序固定）**：

1. **成功画面**：这个功能完成后，用户能做到什么之前做不到的事？
2. **Appetite**：你愿意为这个需求投入多少时间？（S=1-3天 / M=1-2周 / L=2-4周）
3. **核心 AC**：最重要的 1-3 个验收标准是什么？

有了这三个答案，Agent 自动生成：
- Rabbit Holes（分析描述中可能的复杂点）
- No-gos（基于 appetite 和描述推断）
- 开放问题（识别描述中的模糊词汇和未决策点）

### 4.2 Structured 模式（评审场景）

用户按模板填写，`spec-req` 做**完整性验证**：
- AC 是否可测试（有 Given/When/Then 结构）
- Rabbit Holes 是否有对应缓解思路
- 开放问题是否影响 appetite 判断
- 与已有需求是否重复或冲突（扫描 docs repo）

---

## 5. 与下游 skill 的联动

### 5.1 spec-plan（变化最大）

```
spec-plan 运行时：
  1. 扫描 docs repo requirements/ 中 status: ready 的文档
  2. 用户选择或自动匹配对应需求
  3. appetite → 决定 plan 输出深度
  4. AC scenarios → 生成 tasks 的验收条件
  5. Rabbit Holes → 自动列入 doubt points
  6. 开放问题 → 列入 doubt points
  7. plan 文件头部写入 refs_req: req-xxx
```

plan 若找不到关联需求，不静默跳过，显式提示：
> `⚠ 未找到 status: ready 的需求文档，建议先运行 spec-req`

### 5.2 spec-ideate / spec-brainstorm

可选消费需求文档：读取"成功画面"和"核心需求"作为探索锚点，避免脱离问题边界的自由发挥。

### 5.3 spec-code-review

评审时对照 AC scenarios 逐条检查，而不是主观评判"功能是否完整"：
- AC 中每个 Scenario → 检查是否有对应测试
- 评审结论反写需求文档（`verified: true/false`）

### 5.4 spec-compound

知识沉淀时附带 req-id，让 pattern/solution 能追溯到最初解决的是什么需求。

---

## 6. 需求生命周期

状态由各 skill 驱动，不需要人工维护：

```
spec-req 完成录入    → status: draft
人工确认（或自动）   → status: ready
spec-plan 引用       → status: in-progress
spec-work 完成       → （保持 in-progress）
spec-code-review 通过 AC  → status: done
```

done 之后需求文档作为只读的历史记录，不再修改。

---

## 7. 完整可追溯链路

```
requirements/features/req-001.md          ← spec-req 写入，appetite=M，AC=3条
    ↓ refs_req
plans/2026-04-04-001-feat-xxx-plan.md     ← spec-plan，doubt_points 来自 rabbit holes
    ↓ refs_plan
work/2026-04-04-001/meta.json             ← spec-work，execution artifact
    ↓
reviews/2026-04-04-001-review.md          ← spec-code-review，对照 AC scenarios
    ↓
knowledge/patterns/xxx.md                 ← spec-compound，带 source_req: req-001
```

任意节点向上可追溯到需求，向下可找到实现结果和验收记录。

---

## 8. 跨项目需求（`_shared/requirements/`）

写入 `spec-docs/_shared/requirements/` 的类型：

| 类型 | 示例 |
|---|---|
| 设计规范 | UI 组件行为标准、无障碍要求 |
| API 契约 | 跨服务接口约定、错误码规范 |
| 合规要求 | 安全、隐私、数据保留策略 |
| 平台约定 | 通用权限模型、审计日志要求 |

项目级 spec-plan 可以 `refs_shared_req` 引用，`spec-code-review` 可检查实现是否符合 org 级要求。

---

## 9. 与现有方案的关系

| 方案 | 关系 |
|---|---|
| 独立文档仓库方案 | `requirements/` 是 docs repo 中的新目录，与 contexts/plans/reviews/knowledge 并列 |
| Harness 改造技术方案 | spec-req 的 Rabbit Holes → spec-plan doubt points → spec-work preflight，形成完整预检链 |
| Greenfield / Brownfield 区分 | Greenfield 需求从零录入；Brownfield 需求可从现有代码反向生成草稿（spec-graph-bootstrap 分析结果辅助） |

---

## 10. 实施分期

### 第一阶段：需求文档格式 + spec-req Express 模式
- 定义格式规范（frontmatter + 7 个固定 section）
- spec-req 实现 3 问澄清 + 草稿生成 + 写入 docs repo
- **收益**：需求有了标准化的写入入口，不再散落在对话里

### 第二阶段：spec-plan 联动
- spec-plan 读取 requirements/，按 appetite 调整输出深度
- Rabbit Holes → doubt points 自动流转
- **收益**：plan 有了可追溯的需求来源，doubt points 不再靠 Agent 自行推断

### 第三阶段：spec-code-review AC 对照 + 生命周期闭环
- spec-code-review 对照 BDD scenarios 评审
- 状态自动流转（in-progress → done）
- **收益**：需求验收有了客观标准，不再依赖主观评审

---

## 11. 关键决策记录

| 决策 | 选择 | 理由 |
|---|---|---|
| 格式：MD 还是 JSON | MD + YAML frontmatter | 人类可读优先，机器通过 frontmatter 解析 |
| AC 格式：自由文本还是 BDD | BDD Given/When/Then | 可执行，spec-code-review 可直接对照 |
| 首问：问题还是成功画面 | 成功画面（Working Backwards） | 问题容易发散，成功画面锚定目标 |
| Appetite：估算还是决策 | 决策（Shape Up） | 估算是预测，决策是承诺，后者驱动范围收敛 |
| 开放问题：需求层处理还是 plan 层 | 需求层标记，plan 层处理 | 需求层只识别，不假设答案；plan 层决策并记录 |
