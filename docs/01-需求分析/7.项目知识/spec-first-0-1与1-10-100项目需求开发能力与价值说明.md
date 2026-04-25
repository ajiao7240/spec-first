# spec-first 在 0-1 新项目与 1-10-100 存量项目中的需求开发能力与价值说明

> 文档性质：场景化能力说明
> 适用范围：`spec-graph-bootstrap`、`spec-ideate`、`spec-brainstorm`、`spec-plan`、`spec-work`、`spec-code-review`、`spec-compound`
> 关联文档：
> - `docs/01-需求分析/7.项目知识/spec-first-harness-engineering-改造技术方案.md`
> - `docs/05-用户手册/02-核心概念.md`
> 修订日期：2026-04-04

---

## 1. 写这份文档的目的

在前面的技术方案里，`spec-first` 被定义成一套同时包含：

- `Spec Runtime`
- `Shared Knowledge`
- `Reference`
- `Harness`
- `Memory`

的 Agent 交付系统。

但这套设计天然更容易让人联想到“已有代码库的优化系统”，从而产生两个常见疑问：

1. 它对 `0-1` 的新项目到底有没有价值？
2. 一旦强调 `reference-first`、`history-first`，是不是就削弱了从零开始做需求开发的能力？

这份文档专门回答这两个问题，并给出更清晰的场景化判断。

---

## 2. 两类项目，不是一个问题

这里讨论的其实是两类完全不同的需求开发环境。

### 2.1 `0-1` 新项目

特征通常是：

- 没有现成代码，或只有很薄的初始化骨架
- 历史需求、历史方案、历史 review 都很少
- 最重要的问题不是“怎么复用”，而是“先把正确的骨架搭起来”
- 最大风险不是局部返工，而是架构方向、边界和验证口径一开始就错

对这类项目，`spec-first` 的核心价值应是：

- 帮团队更早把需求讲清楚
- 把系统边界、模块职责、验证口径先定下来
- 用少量模板和约束替代拍脑袋实现
- 尽快把第一个版本做成“后续可持续演进的骨架”

### 2.2 `1-10-100` 存量项目

这里的 `1-10-100` 指的是：

- 已经有一批功能、模块、约束、坑和历史决策
- 需求开发不是从零起步，而是在已有系统上持续迭代
- 最大风险不是“没有东西可写”，而是“改坏已有系统”

对这类项目，`spec-first` 的核心价值应是：

- 帮团队减少重复分析
- 帮 Agent 先找到最像的已有实现
- 在动手前发现结构性违规
- 把 review、compound、历史方案和坑沉淀成可复用资产

---

## 3. 先给结论

一句话结论：

> 当前方案不会削弱 `0-1` 的能力，但它目前对 `1-10-100` 的收益更直接、更大；  
> 对 `0-1` 项目则更像“先把骨架、约束和验证搭起来”的系统，而不是“靠历史资产复用”的系统。

再说得更直白一点：

- `0-1` 项目最依赖的是 `Spec Runtime + Harness + 最小模板`
- `1-10-100` 项目最依赖的是 `Reference + Shared Knowledge + Feedback Loop`

所以它们不是“能不能用”的区别，而是“主要价值来源不同”的区别。

---

## 4. 当前方案对 0-1 项目的真实能力

### 4.1 能力是存在的，而且不弱

当前主方案已经明确了几件事：

- `spec-graph-bootstrap` 仍是 Stage-0 supporting workflow，不是硬前置
- `spec-work` 必须支持 `Harness-enabled` 和 `Reduced-harness`
- 找不到强本地 reference 时，`spec-plan` 必须显式写出 `No strong local reference found`
- `spec-brainstorm` / `spec-ideate` 在没有 bootstrap 资产时，也必须走轻量降级路径

这意味着：

- 没有历史代码，系统仍然可以工作
- 没有 bootstrap 资产，系统仍然可以工作
- 没有本地样板，系统仍然可以工作

也就是说，当前方案并没有把 `0-1` 项目排除在外。

### 4.2 0-1 项目里最有价值的部分

对新项目而言，真正有价值的不是 `reference-index` 本身，而是下面这些能力：

1. `spec-ideate`
   用来做候选方向发散和早期筛选，避免一开始就陷入局部实现。
2. `spec-brainstorm`
   用来澄清需求、范围、边界、非目标和核心用户路径。
3. `spec-plan`
   用来产出 `proposal / design / tasks / doubt points`，把模糊需求编译成可执行 spec。
4. `spec-work`
   用来按照 `build -> lint-arch -> test -> verify` 的节奏实现，而不是边写边猜。
5. `spec-code-review`
   用来在第一批实现里尽早发现架构错误、验证缺口、边界问题。
6. `spec-compound`
   用来把第一批踩坑尽快沉淀成 pattern、procedure、failure memory。

换句话说，`0-1` 项目里最值钱的不是“复用过去”，而是：

- 少走弯路
- 少返工
- 少把错误结构写进第一版代码

### 4.3 0-1 项目里哪些设计暂时收益不大

在新项目早期，下面这些能力通常不是第一优先：

- 大量 `history-spec-index`
- 高命中率的本地 `reference-index`
- `pitfalls-specialist` 这种强依赖存量坑库的专项 reviewer
- 复杂的 `domain-pack` / `platform-pack` 路由
- 很细的运营指标体系

原因很简单：

- 还没有足够历史
- 还没有足够模式
- 还没有足够坑

所以 `0-1` 项目不是“不需要这套系统”，而是：

> 一开始主要吃 `Spec Runtime` 和 `Harness` 的价值；  
> `Reference`、`History`、`Memory` 的价值会在前几轮需求后快速变大。

---

## 5. 当前方案对 1-10-100 存量项目的真实能力

### 5.1 这才是当前方案收益最集中的场景

一旦项目已经存在：

- 已有目录结构
- 已有页面、服务、接口、测试
- 已有 review 经验
- 已有踩坑
- 已有架构边界

当前方案的很多设计就开始产生复利：

1. `spec-graph-bootstrap`
   生成 `docs/contexts/<slug>/`、`analysis.json`、`reference-index.json`、`verify-hints.json`
2. `spec-plan`
   不再从零分析仓库，而是优先走 `reference-first + history-first`
3. `spec-work`
   先找参照、再 preflight、再写 glue code
4. `spec-code-review`
   在已有 pitfall / high-risk area 基础上做更精准的专项检查
5. `spec-compound`
   把每次需求交付进一步回流成更强的知识和样板

这时系统的目标不再是“把第一版做出来”，而是：

- 更快
- 更稳
- 更少破坏
- 更符合原项目自己的写法

### 5.2 存量项目里最关键的收益

存量项目的收益可以直接概括成 5 条：

1. **减少重复分析**
   已有上下文、历史 spec、pattern、pitfalls 都不需要每次重建。
2. **减少原创代码比例**
   有 reference 时，Agent 应该主要改已有模式，而不是新发明。
3. **降低结构性错误**
   preflight 和 verify-hints 会把一些错误前移，而不是在 review 才暴露。
4. **提升 review 命中率**
   评审不只是读 diff，而是拿着历史风险和高风险区域去查。
5. **形成知识复利**
   每次需求完成后，系统会变得更懂这个仓库，而不是每次都重新 cold start。

---

## 6. 三个实施阶段，对两类项目分别有没有价值

### 6.1 第一阶段：高 ROI 基础改造

对 `0-1` 项目：**非常有价值**

原因：

- 它补的是 `proposal / design / tasks / doubt points`
- 补的是 `instruction-context`
- 补的是最小 preflight 和验证链
- 补的是 `spec-brainstorm` / `spec-ideate` 的轻量接入

这些能力在没有历史代码时照样成立，甚至更重要。

对 `1-10-100` 项目：**同样非常有价值**

原因：

- 除上面这些之外，它还能马上吃到 `reference-index`、`verify-hints`、`patterns`

结论：

> 第一阶段对两类项目都是高价值，但 0-1 更偏“把骨架搭对”，存量项目更偏“马上降本增效”。

### 6.2 第二阶段：反馈回流与记忆增强

对 `0-1` 项目：**中高价值，但不是起步必需**

原因：

- 第一轮功能时，pattern 和 history 还不够多
- 但从第二、第三个需求开始，`decision-notes`、review candidates、知识路由就会开始明显变值钱

对 `1-10-100` 项目：**高价值**

原因：

- 已经有大量历史资产可回流
- 这阶段最容易体现“越用越懂仓库”的效果

结论：

> 第二阶段对 0-1 是“复利准备”，对存量项目是“立即起效的增强层”。

### 6.3 第三阶段：系统自进化

对 `0-1` 项目：**有价值，但明显后置**

原因：

- 项目还太新时，readiness 评分和复杂运营指标不会立刻产生最大收益

对 `1-10-100` 项目：**有价值，且更容易落地**

原因：

- 已经有足够多的历史运行数据、review 结果、memory 和知识资产

结论：

> 第三阶段不是 0-1 起步必需，但对长期项目是合理的演进终点。

---

## 7. 这套方案会不会让 spec-first 不支持 0-1 需求开发

不会。

严格说，当前方案做的是：

- 给存量项目提供更强的 `reference-first / history-first` 能力
- 同时保留没有这些资产时的可运行路径

所以结果是：

- 它 **增强了** 对存量项目的支持
- 它 **没有取消** 对 0-1 项目的支持
- 但它 **还没有把 0-1 做成第一等模式**

这三句话必须分开看。

### 7.1 为什么说“没有取消”

因为当前方案里已经明确：

- `spec-graph-bootstrap` 不是强前置
- `spec-work` 有 `Reduced-harness`
- `spec-plan` 可以处理 `No strong local reference found`
- `spec-brainstorm` / `spec-ideate` 有无 bootstrap 的降级路径

这意味着新项目不会因为“没有历史资产”而无法开发。

### 7.2 为什么说“还没做成第一等模式”

因为当前很多关键设计默认仍然从“有存量资产”出发：

- `reference-index`
- `pitfalls`
- `history-spec-index`
- `decision-note reuse`
- `pattern memory`

这些都更像 `1-10-100` 项目的天然高收益项。

对 `0-1` 场景，目前更多是：

- 兼容
- 可用
- 可演进

但还没有被明确抽象成独立模式。

---

## 8. 最佳实践：应该把两类项目分成两种工作模式

最佳方案不是用一套表述硬覆盖所有项目，而是显式区分：

1. `Greenfield Mode`
   面向 `0-1` 新项目
2. `Brownfield Mode`
   面向 `1-10-100` 存量项目

### 8.1 Greenfield Mode（0-1）

目标：

- 把第一版系统骨架搭对
- 让需求澄清、边界、验证和最小架构先收口

优先级应为：

1. `spec-ideate`
2. `spec-brainstorm`
3. `spec-plan` 的 `proposal / design / tasks / doubt points`
4. `spec-work` 的 preflight 和统一验证链
5. 最小 `instruction-context`
6. 最小 starter patterns / verify skeleton

工作原则：

- `spec-first` 先于 `reference-first`
- `template-first` 优于 `history-first`
- `architecture-first` 优于 `repo-mining`

也就是说：

> 0-1 项目里，Agent 首先要做的是“按明确 spec 和最小架构骨架实施”，  
> 而不是拼命寻找并不存在的本地历史样板。

### 8.2 Brownfield Mode（1-10-100）

目标：

- 在不破坏现有系统的前提下持续加需求

优先级应为：

1. `spec-graph-bootstrap`
2. `reference-index`
3. `history-spec-index`
4. `verify-hints`
5. `pitfalls-specialist`
6. `decision-notes`
7. `compound` 路由和 memory

工作原则：

- `reference-first`
- `history-first`
- `preflight-first`
- `less-original-code`

也就是说：

> 存量项目里，Agent 首先要做的是“先找最像的东西，再在其上做差异化实现”，  
> 而不是把需求当成白纸重新设计。

---

## 9. 两类项目下，各 workflow 的价值差异

| Workflow | 0-1 新项目的核心价值 | 1-10-100 存量项目的核心价值 |
| --- | --- | --- |
| `spec-ideate` | 发散方向、筛掉伪需求 | 基于真实上下文提出更高 ROI 改进 |
| `spec-brainstorm` | 澄清目标、边界、范围 | 避免提出违反现有约束的方案 |
| `spec-plan` | 把模糊需求编译成可执行 spec | 把 reference/history 纳入差异说明 |
| `spec-graph-bootstrap` | 初始化最小上下文与规则骨架 | 抽取仓库结构、pitfalls、patterns、索引 |
| `spec-work` | 按 spec 落地，避免乱写第一版 | 先找参照、再写 glue code |
| `spec-code-review` | 尽早拦截错误骨架和验证缺口 | 基于已有高风险区域做精准审查 |
| `spec-compound` | 把最早的踩坑沉淀下来 | 持续把实战经验回流成团队资产 |

---

## 10. 对当前主方案的建议

如果要让主方案同时真正覆盖两类项目，最好的做法不是推翻现有方案，而是在其上再补一层”模式分化”。

> **说明**：以下 4 条是对主方案的**新增需求建议**，不是对现有能力的描述。
> 它们依赖尚不存在的资产（starter patterns、greenfield bootstrap、模板库），需要单独立项实现，不能当作当前主方案已涵盖的内容来执行。

建议新增 4 项：

### 10.1 明确 `Greenfield Mode`

不要再把 0-1 场景只挂在 `Reduced-harness` 名下。

`Reduced-harness` 解决的是”资产缺失也能跑”——它是一个**降级兜底**，目标是最低可用。
`Greenfield Mode` 要解决的是”没有资产时怎么跑得最好”——它是一个**主动模式**，目标是 0-1 场景的最优路径。

两者的区别不是有无资产，而是有没有针对 0-1 场景的专门优化策略。

**实现代价**：需要在 spec-work、spec-plan、spec-brainstorm 的 SKILL.md 中显式定义 `Greenfield Mode` 触发条件与执行逻辑，当前版本无此内容。

### 10.2 给 `spec-graph-bootstrap` 增加 greenfield bootstrap

**当前状态**：`spec-graph-bootstrap` 的 Stage-0 分析逻辑全部面向已有代码库（repo mining），没有存量代码时强跑会产出空或低质量资产。

没有存量代码时，不要强做 repo mining，而应优先生成：

- 最小 `instruction-context`
- 最小 `verify-hints`（基于目标技术栈的通用约定，而非 repo 扫描结果）
- starter `patterns`（基于框架最佳实践，而非仓库现有代码）
- starter `knowledge points`
- starter `verification mapping`

**实现代价**：需要在 `spec-graph-bootstrap` 中新增 greenfield 分支逻辑，并建立一套按技术栈分组的 starter 模板库，当前两者均不存在。

### 10.3 给 `spec-plan` 增加 template-first 路径

**当前状态**：`spec-plan` 在找不到本地 reference 时，只能输出 `No strong local reference found` 并将问题转交 spec-work 处理，没有进一步的兜底路径。

当没有本地 reference 时，不应停留在此，而应继续往下走：

- 使用平台模板（框架官方脚手架、项目自定义 starter）
- 使用通用模式（社区公认的架构惯例）
- 使用 starter architecture（在 spec-graph-bootstrap greenfield 产物中定义）

**实现代价**：依赖 10.2 的 starter 模板库建立后才能落地；同时需要更新 `spec-plan/SKILL.md` 的 reference 消费逻辑。

### 10.4 给 `spec-work` 增加 starter pattern 支持

**当前状态**：`spec-work` 的 reference-first 执行链在 0-1 项目下没有可消费的本地 reference，目前只能静默退化为就地搜索。

在 0-1 项目里，`reference-first` 应该自然退化为：

- `starter-pattern-first`

也就是：

- 先基于标准骨架实施（消费 10.2 产出的 starter patterns）
- 再把第一次实现沉淀成该项目自己的 pattern（接入 spec-compound）

这样第二个需求开始，项目就逐步从 `Greenfield Mode` 过渡到 `Brownfield Mode`。

**实现代价**：依赖 10.2 的 starter 模板库；需要更新 `spec-work/SKILL.md` 的 load references 逻辑，使其能识别并消费 starter patterns。

---

## 11. 最终判断

最终可以把结论压缩成 4 句话：

1. 当前三阶段方案对 `0-1` 项目有价值，尤其是第一阶段。
2. 当前三阶段方案对 `1-10-100` 存量项目的收益更直接、更明显。
3. 这套方案不会让 `spec-first` 失去从 `0-1` 做需求开发的能力。
4. 但如果想让它真正同时服务好两类项目，下一步最好显式增加 `Greenfield Mode / Brownfield Mode` 的场景化设计。

一句话总结：

> 当前方案已经让 `spec-first` 同时具备“从零搭骨架”和“在存量系统中稳态迭代”的能力，  
> 只是前者现在更多是“可用能力”，后者已经更接近“高收益能力”。
