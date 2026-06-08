# spec-first Harness 改造技术方案 · 最终架构审查报告

> 审查对象：`docs/01-需求分析/7.项目知识/spec-first-harness-engineering-改造技术方案.md`
> 审查基准：以未来主路线 source-of-truth 候选标准评审
> 审查日期：2026-04-04

---

## 总体判断

**方向正确，主叙事成立，但有一个基础前提需要被承认，两条 P1 问题如果不在实现前修复，正确的战略会被实现歪。**

方案是目前少数能同时抓住"缺参考"、"缺约束"、"缺知识沉淀"三个真实问题的 Agent 交付系统设计，优于多数只堆 prompt、堆规则或堆知识库的方案。没有发现 fatal contradiction。当前状态是：主叙事成立，但有几处容易把正确战略实现歪。

---

## 基础前提：Prompt Harness 的可靠性上限

方案把大量"代码工作流"的设计意图，架在了"提示词指令"的实现机制上。

| 设计意图 | 实际机制 |
|---|---|
| 执行链 8 步按序强制完成 | Agent 遵从指令则执行，不遵从则跳过 |
| preflight 拦截不合理结构动作 | Agent 看到 WARN 后自主决定是否继续 |
| doubt points 在 work 前消化 | Agent 可"记录假设"后继续 |
| Harness-enabled 模式自动触发 | Agent 自行判断资产是否满足条件 |

整个方案里**唯一具有硬约束力的机制**是验证链末端（build / lint / test）——因为这些是真实命令，要么通过要么报错。其余所有机制都是概率性改善，不是确定性保障。

这不是设计失误，是当前 Agent 系统的技术边界。但方案需要在某处明确承认这一点，否则实现者会在"软引导"上寄予"硬约束"的期望，并在系统不稳定时做出错误的调试判断。

---

## P1：实现前必须修复

### P1-A　Greenfield 战略 first-class，运行时 second-class

方案在场景层已明确区分 Greenfield / Brownfield（§2.1），但核心 contract 仍全面按 brownfield 假设设计：

- `analysis.json` 假设存在现成框架、入口、命令（§6.2）
- Assembly verify 假设 `module-map`、`pitfalls`、路径可校验（§6.7）
- 验收标准默认 bootstrap 后会存在完整分析资产（§15）

这不是逻辑矛盾，但会让实现者把 Greenfield 自然做成"缺资产时的特例"——也就是 `Reduced-harness` 的别名——而不是独立的第一等模式。

`Reduced-harness` 解决的是"bootstrap 资产缺失时仍可运行"的兼容底线；`Greenfield Mode` 要解决的是"没有存量代码时怎么跑得最好"。两者目标不同，不能共用同一套 contract。

**修复方向**：为 Greenfield 单独定义 Stage-0 contract，目标是"初始化骨架 / 约束 / 模板索引"，而不是 brownfield bootstrap 的弱化版。`analysis.json` 在 greenfield 下应有独立的字段结构（面向"即将建立"而不是"已经存在"），Assembly verify 在 greenfield 下应跳过路径真实性校验，转而验证模板完整性。

---

### P1-B　proposal 放入 spec-plan，正在打穿 WHAT/HOW 主边界

现有设计已建立清晰边界：

- `spec-brainstorm` = 解决产品决策，明确要做什么
- `spec-plan` = 解决实现方式，明确怎么做

当前方案把 `proposal → doubt points → design → tasks` 整体放入 Spec Runtime，并要求 spec-plan 先回答"proposal 阶段还缺什么"（§7.1、§7.6）。这让 plan 重新承担了一部分需求澄清职责，WHAT/HOW 边界被重新打穿。后果是：用户将无法判断某个问题该在 brainstorm 还是 plan 阶段处理，两个 workflow 的职责在实际使用中会趋向混同。

**修复方向**：`proposal` 应是 brainstorm 的输出产物，或 brainstorm/plan 之间的 handoff artifact。spec-plan 只消费已有 proposal，补充 `design / tasks / doubt points`——其中 doubt points 只包含实现层的疑问（如何做），不包含需求层的疑问（做不做、做什么）。后者应在 brainstorm 阶段消化。

---

## P2：不阻断，但不补会导致长期漂移

### P2-A　Reference 质量是 reference-first 的载荷点，但没有质量门

`reference-index.json` 由 LLM 分析仓库生成，没有人工或程序验证其推荐的代码是否真的"值得复用"。对于有技术债的仓库，reference-first 会系统性地把坏模式传播到新实现里。Phase 2 的 review 可以反向修正 reference 候选，但这意味着 Phase 1 已经把问题写进去了才能被发现。

**修复方向**：增加最小质量门——每条 reference 增加 `trusted` 字段，默认 `false`。经过一次 spec-code-review 验证后方可标记为 `trusted: true`。spec-work 在 Harness-enabled 模式下，只将 `trusted: true` 的 reference 作为主要蓝本，未标记的仅作参考。

---

### P2-B　Shared Knowledge Substrate 在文档中的中心地位过高

方案把 Shared Knowledge Substrate 列为八个硬决策之一（§2.8），并在目标系统形态里作为横向能力层重点展开（§5.4）。这会给实现团队一个强暗示：knowledge substrate 也是 Phase 1 核心骨架，pack / connected source / source registry 是先手工程。实际上 Phase 1 只需要三个静态 JSON 文件，背后不需要任何 pack 体系。

**修复方向**：将表述降为"必要抽象，首版仅 repo-local 最小子集"。在 §2.8 和 §5.4 补充明确说明：Phase 1 实现边界是三个静态文件，pack 体系、connected source、source registry 均属 Phase 2 以后范畴。

---

### P2-C　三个真相源分层定义了，但投影规则未硬化

文档已建立文档层、控制面、instruction file 的分层，并意识到"三套真相源"的风险。但没有定义关键字段的投影规则，例如：

- `high_risk_areas`：以 `verify-hints.json` 为权威，还是以 `instruction-context.json` 为权威？
- `quick_links`：人工维护还是从 `docs/contexts/` 自动投影？
- `pattern maturity`：由谁计算、写到哪个文件？

这些未定义的投影点会在 runtime、bootstrap、skill prompt 三处缓慢漂移，最终形成事实上的三套真相源。

**修复方向**：补充一张投影矩阵，每个关键字段明确：权威来源是哪个文件、谁负责写入、其他地方的同名字段如何处理（只读投影 / 禁止存在 / 允许覆盖）。

---

### P2-D　反馈回路太慢，缺少紧急知识更新路径

系统的增值路径是 `work → signals → compound → memory → improve → 更好的下次 work`，在 Phase 3 前不闭环。但现实中最有价值的反馈回路是最短的那条。当 spec-code-review 发现了高频、高危的结构性问题，等待 Phase 3 代价极高。目前方案没有定义快速通道。

**修复方向**：定义"紧急知识更新路径"——spec-code-review 发现的高优 finding（高信心 rule-candidate）可以直接触发 SKILL.md 或 `verify-hints.json` 的更新提案，不需要经过完整的 compound → improve 链路。这条路径在 Phase 1 就应存在，初期人工执行。

---

### P2-E　运营指标全是过程代理指标，缺北极星指标

§11.4 的 8 个指标（`reference_anchor_rate`、`doubt_resolution_rate`、`rewrite_ratio` 等）全部衡量过程信号。系统会越来越擅长优化这些代理变量，而不一定让需求开发的真实结果更好。`spec-improve` 若只消费这些指标，会成为过程优化器，不是交付优化器。

**修复方向**：补充两类 outcome 指标：

- **首次实现通过率**：从 spec-work 完成到 spec-code-review 首次通过，中间无重大返工
- **交付 lead time**：从 brainstorm 启动到 review 通过的总耗时

两者均可从 `meta.json` 的时间戳推算，成本低。

---

## 准确性问题

| 位置 | 问题 |
|---|---|
| §6.3 `confidence` 字段 | 浮点置信度由谁生成、基于什么逻辑未说明，容易退化成无意义装饰字段 |
| §7.2 三段式 Spec | "先作为 plan 文档一级 section"与 §8.7 引用独立 `design.md` 存在两义性，实现时需选定一种形态并禁止另一种 |

---

## 设计亮点

| 设计 | 价值 |
|---|---|
| 验证链持久化 `verification.json`（§8.5）| 成本低，确定性高，是方案里最接近代码级约束的机制 |
| `evidence_level: verified / inferred` 区分（§6.5）| 防止推断被包装成规则，应贯穿所有 JSON 资产 |
| `spec_id` 生成规范（§5.3）| 复用 plan 文件名 stem，不引入新依赖，与现有约定对齐 |
| 非目标列表（§3.2）| 边界清晰是此类方案最稀缺的品质，优先级高于功能完整 |
| 三段式 Spec 结构（§7.2）| 把"不确定性在 work 前显式处理"变成文档结构契约，对 Agent 行为约束力最强 |
| `sync-instruction` 单一 writer 语义（§2.2、§6.4）| 防止 instruction file 所有权冲突，幂等性和冲突处理逻辑清晰 |

---

## 优先级行动清单

| 优先级 | 问题 | 行动 |
|---|---|---|
| 基础 | Prompt Harness 可靠性上限未被承认 | 在方案中说明哪些机制是硬约束（验证链），哪些是软引导（其余） |
| P1 | Greenfield contract 缺失 | 为 Greenfield Stage-0 单独定义产物结构，不共用 brownfield bootstrap 的 Assembly verify |
| P1 | proposal 职责归属模糊 | 将 proposal 定义为 brainstorm 输出 / handoff artifact，spec-plan 只消费不生成 |
| P2 | Reference 质量门缺失 | 增加 `trusted` 标记，review 验证后方可作为主要蓝本 |
| P2 | Knowledge substrate 定位过高 | 降为"必要抽象，首版 repo-local 最小子集"，Phase 1 边界是三个静态文件 |
| P2 | 投影矩阵未定义 | 补充关键字段的权威来源、写入责任方和冲突处理规则 |
| P2 | 紧急知识更新路径缺失 | 定义 review → SKILL.md / verify-hints 的快速更新通道，Phase 1 起人工执行 |
| P2 | 缺北极星指标 | 补充首次实现通过率和交付 lead time 两个 outcome 指标 |
