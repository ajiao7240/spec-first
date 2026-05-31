
---

# Spec-First：AI Coding 不是 Prompt 问题，而是 Workflow 问题

**把 AI coding 从 ad-hoc chat，升级为 governed engineering loop**

---

> **AI coding is not a prompt problem — it is a workflow problem.**
>
> **Spec-first turns AI coding from ad-hoc chat into a governed engineering loop:**
> **Codebase → Graph → Spec → Plan → Code → Review → Knowledge**
>
> **Spec > Code. Systems > Prompts.**

---

## 一、为什么我越来越觉得，AI Coding 的问题不在 Prompt

过去一段时间，越来越多人开始用 AI 写代码。

一开始，这种体验非常惊艳。

你给一个 prompt，模型很快吐出一段代码；
你再补一句，它继续改；
再补一句，它继续 patch。

在 demo 阶段，这样的方式很有效。

但一旦进入真实工程，问题就会逐渐暴露出来：

* 模型拿到的上下文并不稳定
* 需求没有被显式表达
* 计划和实现不断漂移
* Review 变成零散、主观、不可复用的对话
* 上一次踩过的坑，下一次还会再踩一遍

所以我越来越确定一件事：

**AI coding 的核心问题，不是 prompt 不够好，而是 workflow 不够好。**

更准确地说，很多 AI coding 的失败，并不是模型本身不够强，而是**模型拿到的决策输入已经退化了**。

`spec-first` 的出发点，就是解决这个问题：

**在 AI coding 交付闭环的每个阶段，为模型提供结构化、可追踪的上下文，并把从 ideation 到 compound learning 的整个过程治理起来。**

---

## 二、我在做什么：Spec-First

`spec-first` 不是一个 prompt 技巧库。
它也不是一个试图用复杂状态机替代模型判断的 orchestration 框架。

它是一个**面向 Claude Code 和 Codex 的开源 workflow CLI**。

它想解决的事情很简单：

**把 AI coding 从临时对话，升级成一个可安装、可治理、可复用的工程工作流。**

我想做的，不是再发明一套新的“神奇 prompt”，
而是建立一个更稳定的工程闭环。

在 `spec-first` 里，这个闭环大致分成两层：

**Codebase → Graph → Context**
**Ideate → Brainstorm → Plan → Work → Review → Compound**

如果把它压缩成一句更适合传播的话，那就是：

> **Spec-first turns AI coding from ad-hoc chat into a governed engineering loop.**

这意味着，AI coding 不再只是“聊一聊然后生成代码”，而是开始拥有：

* 更可靠的上下文基础
* 更显式的需求与计划工件
* 更结构化的 review
* 更可沉淀、可复用的知识输出

---

## 三、为什么 Prompt-Driven Coding 很难扩展

我并不否认 prompt 的价值。

Prompt 很重要，而且会一直重要。
但 prompt 的问题在于：它天然是**瞬时的**。

它适合触发一次生成，
却不适合作为工程系统的长期承载层。

如果意图、约束、review 逻辑和知识沉淀都只存在于聊天窗口里，那么系统很快就会遇到几个瓶颈。

### 1）上下文从空白开始

很多时候，模型面对的是一个“blank-slate codebase context”。

也就是说，它并不知道：

* 项目真实结构
* 关键依赖
* 系统边界
* 可信事实
* 相关历史决策

结果就是：

**模型看似在写代码，实际上是在猜代码。**

### 2）需求没有被显式表达

很多任务其实“能开始做”，但没有形成可检查、可交付、可复用的工件。

于是 AI 只能不断根据对话去猜测真实意图。

### 3）计划和实现很容易漂移

很多 AI coding 的失败，不是“不会写代码”，而是“写着写着偏题了”。

一开始目标很清楚，
但随着多轮对话推进，计划逐渐脱离原始意图，最后实现出来的是另一件事。

### 4）Review 没有结构

如果 review 只是：

> “你再检查一下”
> “你看看还有没有问题”

那它的质量、覆盖范围和稳定性都没有保障。

### 5）知识无法复利

最可惜的一点是：

很多已经解决过的问题，没有被沉淀成之后可以复用的知识。
下一次，同样的问题还会重复发生。

所以，真正限制 AI coding 规模化的，不是“模型还不够聪明”，而是：

**系统缺少一层稳定的 workflow layer。**

---

## 四、Spec-First 的核心判断

`spec-first` 背后有一个很简单，但我认为非常关键的判断：

> **AI coding 的质量，受限于 decision inputs 的质量，而不是 orchestration 的重量。**

这也是为什么我不想把项目做成一个过度工程化的状态机系统。

我更相信的是：

* 不要急着替模型做决定
* 先把模型做决定所需要的输入质量拉高
* 把上下文、约束、计划、review、知识沉淀变成一等工程对象

换句话说：

> **不要把“写 prompt”当成系统。**
> **要把“workflow”本身做成系统。**

---

## 五、Spec-First 是怎么工作的

如果把整个过程展开，`spec-first` 大致可以理解成两个互补部分。

### 第一部分：graph-bootstrap

这是基础层。

它的职责是把代码库变成结构化上下文，
通常在初始化时运行，或者在代码变化后增量运行。

它的意义在于：

**让模型不再从“空气”开始工作，
而是从结构化、可验证、可追踪的代码事实开始工作。**

### 第二部分：主 workflow

这部分负责完整交付闭环：

**Ideate → Brainstorm → Plan → Work → Review → Compound**

这不是一个“顺序更漂亮”的流程图，
而是一套明确规定输入、输出和阶段边界的交付方法。

它要解决的其实是这些问题：

* 想法如何被澄清
* 需求如何被显式化
* 计划如何约束实现
* Review 如何结构化
* 知识如何沉淀和复用

---

## 六、它适合什么样的人

`spec-first` 更适合这些场景：

* 希望从 prompt-driven coding 升级到 governed AI workflow 的团队
* 同时使用 Claude Code 和 Codex，希望统一工作方式的人
* 需要显式 specs、结构化 review、可复用 post-task learnings 的项目

它并不适合所有人。

例如，如果你的场景是：

* 完全不使用 Claude Code 或 Codex
* 只想零配置、一次性生成代码
* 任务足够短，完全不值得引入多阶段 workflow

那 `spec-first` 可能并不是最合适的工具。

我很认同一点：

> **一个产品成熟的标志之一，就是它知道自己不适合谁。**

---

## 七、Quick Start

如果你想快速上手，可以从这里开始。

### 运行前提

请先确认满足这些条件：

* **Node.js >= 20**
* **Git repository**

  * `spec-first init` 会读取 `git config user.name`
  * `graph-bootstrap` 依赖 `git ls-files`
  * 所以**非 Git 目录不支持**
* **Claude Code 或 Codex 至少安装一个**
* **磁盘空间**

  * 大约需要 **60–120 MB** 的 `node_modules`
  * 主要来自 **15 个 tree-sitter parser** 和 `better-sqlite3` 的原生构建

---

### 1）安装

```bash
npm install -g spec-first
spec-first -v
```

安装后会执行一个 `postinstall` 步骤：

* 运行 `bin/postinstall.js`
* 打印安装确认信息
* 裁剪掉当前平台以外的原生 tree-sitter 预构建文件

这个步骤**只会删除已安装 `node_modules/` 目录中的文件**，
**不会改动你的项目文件**。

---

### 2）检查环境

```bash
spec-first doctor
spec-first doctor --claude
spec-first doctor --codex
```

如果 `doctor` 提示存在 legacy managed state，
请直接重新运行 `init`。

这是当前**唯一支持的升级路径**：

**它会先执行一次受控的 hard reset，再重建 runtime。**

---

### 3）初始化项目

在你的 Git 项目目录中执行：

```bash
spec-first init --claude
# or
spec-first init --codex
```

如果你希望显式指定开发者身份：

```bash
spec-first init --claude -u <name> --lang <zh|en>
spec-first init --codex -u <name> --lang <zh|en>
```

**Identity resolution order：**

1. `-u` 参数
2. `~/.spec-first/.developer`
3. `git config user.name`

**Language resolution order：**

1. `--lang` 参数
2. 项目已有 `.developer` profile
3. 默认 `zh`

---

## 八、我为什么想做这个项目

因为我越来越觉得，AI coding 下一阶段的竞争，不会只发生在模型层。

模型当然会继续变强。
上下文窗口会更大，推理会更深，工具调用会更丰富。

但如果 workflow 依旧停留在：

> “想到什么就 prompt 一句”

那么再强的模型，也会被糟糕的输入和混乱的交付方式拖慢。

我想做的事情其实很简单：

> **把 AI coding 从“临时会话体验”，变成“工程系统能力”。**

不是让每次输出都更炫，
而是让整个过程：

* 更稳定
* 更可解释
* 更可 review
* 更可复用
* 更容易持续变好

我相信，真正重要的不是：

> AI 能不能生成代码

而是：

> **AI 生成代码之后，这套系统能不能持续交付。**

---

## 九、我希望它最终变成什么

我希望 `spec-first` 最终不是一个只服务单次任务的小工具，
而是一个能让团队建立 AI 工程工作方式的基础设施层。

它更像一个 workflow OS：

* 对上，连接 Claude Code、Codex 这样的 AI coding host
* 对下，连接真实代码库、上下文事实、阶段工件和知识资产
* 在中间，建立起一个稳定的 delivery loop

这样，AI coding 才不再只是：

> 谁 prompt 写得更花

而会变成：

> **谁能更稳定地把需求变成交付，并把交付经验转成未来的输入优势。**

---

## 十、如果你也在思考同一个问题

如果你也觉得：

* AI coding 的痛点不在“少一个 prompt”
* 而在“缺一层 workflow”
* 需要的不只是代码生成
* 而是结构化上下文、显式工件、review 和知识复利

欢迎看看 `spec-first`：

**GitHub：**
`http://github.com/sunrain520/spec-first`

我会继续把它做下去，也会持续公开分享设计、实践、踩坑和迭代过程。

因为我相信：

> **AI coding is not a prompt problem — it is a workflow problem.**
> **Spec > Code. Systems > Prompts.**

---

## 十一、致谢

最后，也想特别说明一点。

`spec-first` 并不是凭空出现的。
它参考了不少优秀的开源项目，也受到了很多前人工作的启发。

无论是 AI coding、工程工作流、结构化上下文、代码图谱、review 机制，还是“如何把一次性对话变成可复用系统”这件事，本质上都不是一个人凭空发明出来的。

很多想法、方法和工程实践，早已经由开源社区里的开发者们不断探索、验证和推进。

`spec-first` 也是站在这些前人的肩膀上，结合我自己的理解、取舍和实践，继续往前走的一步。

非常感谢所有开源作者、贡献者和项目维护者。
是你们持续公开代码、公开思考、公开经验，才让后来者有机会少走很多弯路，也让新的尝试成为可能。

我也希望 `spec-first` 能继续保持这种开放精神：

* 一边学习，一边创造
* 一边受益于开源，一边把新的经验再反馈回开源

感谢每一位先行者。

---

## 结尾引导

如果你也在探索 AI coding、Claude Code、Codex、spec-driven engineering 或 workflow design，欢迎交流。

也欢迎试用、提 issue、提建议。
一起把这件事做得更扎实一些。

---

`spec-first` 是开源项目，欢迎试用、提 issue、提建议。

**GitHub：** http://github.com/sunrain520/spec-first

**官网：** http://spec-first.cn/