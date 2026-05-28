---
name: ai-coding-harness-positioning
description: spec-first 微信公众号系列第 2 篇正文：什么是 AI Coding Harness，解释 spec-first 的定位升级和六层 Harness
metadata:
  type: article
  series_index: 02
  status: draft
---

# 什么是 AI Coding Harness：spec-first 的定位升级

**把不稳定的 AI 推理，放进可重复、可观察、可约束、可验证的工程闭环**

---

上一篇我写的是：

> **AI Coding 不是 Prompt 问题，而是 Workflow 问题。**

那篇文章想表达的核心很简单：

如果 AI coding 的关键判断只停留在聊天窗口里，那么再强的模型，也很难在真实工程里稳定交付。

因为真实工程里的问题不是“能不能生成一段代码”。

真实工程里的问题是：

* 模型拿到的上下文是否可靠
* 需求是否被显式表达
* 计划和实现是否会漂移
* Review 是否有结构
* 这次踩过的坑，下一次是否还会再踩

所以我当时用了一个词：

**Workflow。**

但这几天继续梳理 `spec-first` 的定位时，我发现 “workflow” 还不够准确。

Workflow 说明了“有一条流程”。

但 `spec-first` 真正想做的，不只是把步骤排成：

```text
Spec -> Plan -> Work -> Review -> Knowledge
```

它更想解决的是：

**怎样把不稳定的 AI 推理，放进一个可重复、可观察、可约束、可验证、可沉淀的工程环境里。**

这个更准确的词，是：

> **AI Coding Harness**

![AI coding 从 Prompt 到 Workflow 再到 Harness 的演进](pic/02-ai-coding-harness-evolution.png)

---

## 一、什么是 Harness

先说我对 Harness 的理解。

Harness 不是“再套一层流程”。

也不是“写一堆更复杂的 prompt”。

它更像是在 AI 和真实工程之间，放一层承载结构。

这层结构负责几件事：

* 给 AI 正确上下文，而不是无限上下文
* 让任务目标和边界显式化
* 让执行过程可追踪
* 让结论有证据来源
* 让失败有降级路径
* 让经验能沉淀到下一次任务里

换句话说：

**Harness 的目标不是替模型思考，而是让模型在更好的工程条件下思考。**

这点非常关键。

如果你把 AI coding 的问题理解成“模型还不够聪明”，你会自然走向两个方向：

* 找更强模型
* 写更长 prompt

这两件事当然有价值。

但在真实工程里，它们通常只能解决一部分问题。

一个模型再强，如果它不知道当前代码库的真实结构，它还是会猜。

一个 prompt 再长，如果里面混着过期文档、生成产物、未验证的 provider 结果，它还是会被污染。

一个 agent 再能执行，如果计划没有边界、review 没有证据、失败没有记录，它还是会把任务做成一段不可复盘的临时对话。

所以我越来越觉得：

**AI coding 进入真实工程后的关键，不是继续追问“怎么让模型更会写代码”，而是追问“怎么让模型的每一次判断都在可治理的环境里发生”。**

这就是 Harness。

---

## 二、为什么不是 Prompt 框架

我不想把 `spec-first` 做成一个 prompt collection。

原因不是 prompt 不重要。

恰恰相反，prompt 很重要。

但 prompt 的问题在于：它很容易变成瞬时输入。

今天你在一个会话里写了一段很好的约束：

> 你要先看代码结构，再给计划，再改文件，最后跑测试。

这当然有用。

但下一次呢？

下一个会话呢？

另一个 teammate 的机器上呢？

Claude Code 和 Codex 同时使用时呢？

如果这些约束只存在于聊天窗口里，那么它们很难成为工程系统的一部分。

`spec-first` 想做的事情，是把这些关键约束变成项目内可复用的结构：

* 需求要变成 requirements brief
* 计划要变成 plan
* 任务要变成 task pack
* review 要有结构化 findings
* debug 要有 hypothesis ledger
* 经验要沉淀进 `docs/solutions/`
* host runtime 要从 source 生成，而不是手工维护副本

这不是 prompt 技巧。

这是工程承载层。

所以我现在更愿意这样定义 `spec-first`：

> **spec-first = AI Coding Harness for spec-driven software engineering**

它不是要替代模型。

它也不是要替工程师做所有决定。

它只是把 AI coding 从一次性对话，放进一个更可治理的工程闭环。

---

## 三、为什么不是复杂状态机

另一种误解是：

既然要治理 AI，那是不是应该把所有步骤都写死？

比如：

```text
第一步必须读 A
第二步必须读 B
第三步必须输出 C
第四步必须调用 D
```

我不这么看。

真实软件工程里，很多判断是语义判断。

比如：

* 这次改动到底算 bug fix，还是行为变更？
* 这个 review finding 是否真的成立？
* Graph 结果只是 pointer，还是已经足够影响计划？
* 一个旧 learning 现在还适用吗？
* 当前任务应该继续做，还是回到 brainstorm 澄清 scope？

这些问题不适合交给脚本硬编码。

脚本擅长做确定性工作：

* 文件发现
* 路径解析
* git 状态读取
* schema 校验
* hash 计算
* readiness 检查
* runtime asset 同步
* reason code 输出
* artifact path 输出

但脚本不应该假装自己是架构师。

LLM 和 agent 擅长做语义判断：

* 需求理解
* 架构取舍
* 计划拆分
* review 判断
* 风险解释
* fallback 决策
* 下一步建议

所以 `spec-first` 里有一个非常重要的原则：

> **Scripts prepare, LLM decides.**

脚本准备事实。

LLM 做判断。

这不是一句口号。

它决定了整个系统的边界。

![Scripts prepare facts, LLM decides meaning](pic/02-ai-coding-harness-boundary.png)

如果反过来，让脚本模拟架构判断，系统会变成脆弱的规则引擎。

如果让 LLM 假装自己跑过确定性校验，系统会变成不可验证的幻觉。

Harness 的价值，是把这两边接起来：

* 事实来自可复验的工具和脚本
* 判断来自 LLM
* 中间用 evidence、artifact、reason code、limitations 连接

这样系统既不会变成全自动幻觉，也不会变成僵硬状态机。

---

## 四、spec-first 的六层 Harness

如果把 `spec-first` 这套东西拆开看，它大致有六层。

![spec-first 的六层 AI Coding Harness](pic/02-ai-coding-harness-layers.png)

### 1. Context Harness

第一层是 Context。

AI coding 最常见的问题之一，是模型拿到的上下文不稳定。

很多人会自然想到一个解法：

> 那就多给点上下文。

但我现在越来越不认同这个方向。

真正重要的不是“更多上下文”。

而是“正确上下文”。

在 `spec-first` 里，Context Harness 要解决的是：

* 哪些项目指令已经被宿主加载过，不需要重复读
* 哪些源码、测试、diff 和 plan 是当前任务必须读的
* 哪些 provider facts 只是 advisory
* 哪些 graph evidence 已经 stale
* 哪些 generated runtime mirror 默认不该当 source-of-truth

它的目标不是广播整个 repo。

它的目标是让 LLM 拿到有界、相关、可追溯的决策输入。

下一篇我会专门写这个主题：

> **正确上下文不是无限上下文。**

### 2. Execution Harness

第二层是 Execution。

很多 AI coding 的失败，不是第一步就错了。

而是执行中慢慢漂移。

一开始任务说的是“修复登录错误提示”。

做着做着，模型可能开始重构认证模块、改 UI 组件、顺手调整样式，最后变成另一个任务。

Execution Harness 的作用，是让任务在 plan、task、work、review 之间能传递 scope、task identity、repo scope 和 handoff evidence。

它不是状态机。

它不规定每个任务必须走同样路线。

但它要求关键边界留下来：

* 要做什么
* 不做什么
* 影响哪些文件
* 怎么验证
* 失败怎么处理
* 完成后交给谁消费

AI 可以执行。

但执行不能变成黑箱。

### 3. Evidence Harness

第三层是 Evidence。

这是我认为 AI coding 走向工程化时最重要的一层。

很多时候，AI 的回答听起来很合理。

但你继续追问：

> 这个结论从哪里来？

就会发现它只是“看起来像”。

Evidence Harness 要求结论必须带来源。

在 `spec-first` 里，证据不是一个模糊词。

它会区分：

* `confirmed`：来自源码、测试、schema、exit code、compiled readiness facts
* `session-local`：当前会话 live 查询得到的事实
* `advisory`：候选线索、fallback summary、definitions-only result
* `stale`：与当前 checkout 不一致的旧事实

这很重要。

因为 GitNexus、ast-grep、MCP provider、session history 都很有价值，但它们不能自动变成真相。

Provider evidence 只能提供线索。

最终 finding、root cause、scope change 仍然要由 source、test、log、schema、contract 或用户确认来支撑。

这也是为什么我反复强调：

**可信证据优先于自动化便利。**

### 4. Evaluation Harness

第四层是 Evaluation。

很多 AI 工具会告诉你：

* 用了多少次
* 节省了多少时间
* 自动生成了多少代码

这些指标有用，但不够。

`spec-first` 更关心的是：

* review 质量有没有提高
* debug 命中率有没有提高
* graph evidence 是否真的帮助减少误判
* workflow 产物是否被下游消费
* 新增规则是否减少了重复失败

也就是说，Evaluation Harness 不只是统计使用量。

它应该回答：

> 这套 AI coding workflow 有没有真的让工程质量变好？

这件事很难。

但如果不开始记录，AI coding 就很容易停留在“感觉有效”。

### 5. Governance Harness

第五层是 Governance。

这层听起来最像“流程负担”，但它其实是在保护系统长期可用。

比如：

* source-of-truth 和 generated runtime 的边界
* Claude Code 和 Codex 双宿主的 runtime 生成边界
* provider readiness 的 freshness 和 degraded mode
* mutation capability 必须 preview-first
* raw provider output 不进入 durable docs
* secret、credential、internal host 不进入持久产物

这些东西在 demo 里不显眼。

但在真实项目里非常重要。

一个例子：

如果 `.agents/skills/` 里的 runtime 副本过期了，最容易的修法是什么？

直接改它。

但这就是错的。

正确做法是回到 `skills/`、`agents/`、`templates/` 这些 source-of-truth，修源头，再通过 `spec-first init` 或生成链刷新 runtime。

否则系统会开始漂移：

* source 说一套
* runtime 跑一套
* review 看另一套
* 下次 init 又覆盖回来

Governance Harness 不是为了让流程变重。

它是为了让系统不因为一次“临时修一下”而失去可信边界。

### 6. Knowledge Harness

第六层是 Knowledge。

这也是我做 `spec-first` 时最在意的一层。

AI coding 最大的浪费之一，是每次任务都从零开始。

同一个坑，今天踩一次。

下周换个会话，再踩一次。

再过一周换个模型，又踩一次。

如果一次 bugfix、一次 review failure、一次 release 踩坑，最后只留在聊天记录里，它就没有进入工程系统。

Knowledge Harness 要做的是：

* 把已验证的经验沉淀下来
* 让它可以被后续 workflow 发现
* 允许它被刷新、合并、替换或废弃
* 不要求每次 workflow 都全量读取知识库

所以 `docs/solutions/` 对我来说不是文档堆。

它是团队和 AI 共同积累出来的工程记忆。

真正理想的状态是：

> 每次任务都让下一次任务更容易一点。

---

## 五、Harness 不是让人退出流程

这里还有一个误解需要澄清。

很多人讲 AI agent，会自然走向一个方向：

> 人越少介入越好。

我不完全认同。

在真实工程里，人不应该退出。

人的角色应该变化。

以前，人的主要价值是亲手写每一行代码。

现在，人的价值越来越多地体现在：

* 定义目标
* 明确边界
* 判断 tradeoff
* 审查证据
* 接受或拒绝风险
* 把经验沉淀成下一次输入

Harness 不是为了把人赶走。

Harness 是为了让人不用盯着每一行生成过程，而是可以站在更高层审查：

* 目标对不对
* 输入够不够
* 计划稳不稳
* 证据可信不可信
* 结果能不能交付
* 经验有没有留下来

这其实更接近真实软件工程的核心。

写代码只是其中一环。

决定该写什么、为什么这样写、怎么证明写对了、下次怎么少踩坑，才是更大的系统问题。

---

## 六、spec-first 想成为哪一层

所以，回到 `spec-first`。

它不是模型。

它不是 IDE。

它不是一个 agent 平台。

它也不是一个“万能自动开发系统”。

我现在更愿意把它放在这个位置：

```text
Codebase
  -> Graph
  -> Spec
  -> Plan
  -> Tasks
  -> Code
  -> Review
  -> Knowledge
```

`spec-first` 做的是这条链路上的 Harness：

* 在 Codebase 和 Graph 之间，帮助 AI 拿到更可靠的代码事实
* 在 Spec 和 Plan 之间，把模糊意图变成可审查的工程输入
* 在 Work 和 Review 之间，让实现、验证和风险都有记录
* 在 Review 和 Knowledge 之间，把一次经验沉淀成下一次优势

这也是为什么它要同时关心：

* CLI
* skills
* agents
* contracts
* generated runtime
* changelog
* docs/solutions
* graph readiness
* review evidence

这些东西单独看都不性感。

但合在一起，它们回答的是同一个问题：

> 怎样让 AI coding 从一次性对话，变成可治理、可验证、可复用、可沉淀的工程闭环？

这就是 AI Coding Harness。

---

## 七、你可以怎么判断自己是否需要 Harness

最后，给一个很简单的自测。

如果你现在的 AI coding 过程里，已经能稳定回答下面这些问题，那你可能暂时不需要 `spec-first` 这种 Harness：

* 当前任务的目标离开聊天窗口后，还能被别人读懂吗？
* AI 做计划时，是否知道哪些代码事实可信？
* 实现过程中，scope 是否会被显式约束？
* Review 结论是否能说明证据来源和残余风险？
* 工具或 provider 不可用时，workflow 是否会显式降级？
* 这次解决的问题，是否会成为下次任务的输入优势？

如果这些问题里，有一半以上答案是不确定的，那么问题大概率不是 prompt 不够好。

问题是：

**你还缺一层 AI Coding Harness。**

这也是 `spec-first` 接下来想持续做下去的事情。

下一篇，我想写：

> **为什么你不敢把任务真正交给 AI**

因为这可能是所有 AI coding 用户都绕不开的问题。

你不是不想委派。

你只是不知道该如何相信它。

而 Harness 要解决的，正是这个信任问题。

---

## 本篇小结

如果只用一句话总结：

> **AI Coding Harness 的价值，不是让模型替你做所有决定，而是让模型的每一次决定都发生在更好的工程条件里。**

这也是我理解的 `spec-first`：

不是 prompt pack。

不是 agent collection。

不是复杂状态机。

而是一层让 AI coding 可治理、可验证、可复用、可沉淀的工程 Harness。
