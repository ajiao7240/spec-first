---
name: onboarding
description: “生成或重新生成 ONBOARDING.md 以帮助新贡献者理解代码库。当用户要求‘创建入职文档’、‘生成 ONBOARDING.md’、‘为新开发人员记录此项目’、‘编写入职文档’、‘vonboard’、‘vonboarding’、‘为新贡献者准备此存储库’、‘刷新入职文档’时使用，或者“更新 ONBOARDING.md”。当有人需要加入新的团队成员并想要一份书面工件时，或者当代码库缺乏加入文档而用户想要生成一个时，也可以使用。
---
# 生成入职文档

抓取存储库并在存储库根目录生成 `ONBOARDING.md`——该文档可以帮助新贡献者理解代码库，而不需要创建者进行解释。

入职培训是软件中的一个普遍问题，但在快速移动的代码库中，这个问题更为严重，因为代码的编写速度比文档的速度更快——无论是通过人工智能辅助开发、快速原型设计，还是仅仅通过团队比文档的交付速度更快。这项技能从代码本身重建心理模型。

此技能总是从头开始重新生成文档。它不会读取或比较以前的版本。如果 `ONBOARDING.md` 已存在，则会被覆盖。

## 核心原则1. **首先为人类写作**——新开发人员可以阅读和理解的清晰散文。主体效用是良好人类写作的副作用，而不是一个单独的目标。
2. **展示，而不仅仅是讲述** -- 使用 ASCII 图表表示架构和流程，使用 Markdown 表表示结构化信息，并使用反引号格式表示所有文件路径、命令和代码引用。
3. **六个部分，每个部分都占有一席之地**——每个部分都回答新贡献者在第一个小时内会提出的问题。没有投机部分。对于没有消费受众的纯基础设施，可以跳过第 2 部分，产生五个部分。
4. **陈述您可以观察到的内容，而不是您必须推断的内容** -- 不要捏造设计原理或评估脆弱性。如果代码没有揭示做出决定的原因，请不要猜测。
5. **切勿包含机密** -- 入职文档已提交到存储库。切勿包含 API 密钥、令牌、密码、带有凭据的连接字符串或任何其他秘密值。引用环境变量*名称* (`STRIPE_SECRET_KEY`)，而不是它们的*值*。如果 `.env` 文件包含实际机密，则仅提取变量名称。
6. **链接，不要重复** -- 当现有文档很好地涵盖某个主题时，内联链接到该主题而不是重新解释。

## 执行流程

### 第 1 阶段：收集库存

运行捆绑的库存脚本 (`scripts/inventory.mjs`) 以获取存储库的结构图，而无需读取每个文件：
```bash
node scripts/inventory.mjs --root .
```
解析 JSON 输出。这提供了：
- 项目名称、语言、框架、包管理器、测试框架
- 目录结构（顶级+一级到源目录）
- 每个检测到的生态系统的入口点
- 可用的脚本/命令
- 现有文档文件（带有用于分类的第一标题）
- 测试基础设施
- 基础设施和外部依赖项（env 文件、docker 服务、检测到的集成）
- Monorepo 结构（如果适用）

如果脚本失败或返回错误字段，请向用户报告问题并停止。请勿尝试从不完整的数据写入 `ONBOARDING.md`。

### 第 2 阶段：读取关键文件

在清单的指导下，阅读对于理解代码库至关重要的文件。使用本机文件读取工具（不是 shell 命令）。

**读什么以及为什么：**

并行批量读取文件，其中文件之间不存在依赖关系。例如，将 README.md、入口点和 AGENTS.md/CLAUDE.md 一起批量批量处理，因为它们都不依赖于彼此的内容。

仅读取其内容需要以具体、具体的细节编写六个部分的文件。该清单已经提供了结构、语言、框架、脚本和入口点路径——不要仅仅为了确认清单已经说明的内容而重新读取文件。不同的repo需要不同的阅读量；一个小型 CLI 工具可能需要 4 个文件，一个复杂的 monorepo 可能需要 20 个文件。让这些部分驱动您阅读的内容，而不是任意计数。

**优先顺序：**1. **README.md**（如果存在）--用于项目目的和设置说明
2. **主要入口点** -- 库存中 `entryPoints` 中列出的文件。这些揭示了应用程序启动时的行为。
3. **路由/控制器文件** - 从清单结构中查找 `routes/`、`app/controllers/`、`src/routes/`、`src/api/` 或类似目录。阅读主路由文件，了解主流程。
4. **显示架构和外部依赖关系的配置文件** - `docker-compose.yml`、`.env.example`、`.env.sample`、数据库配置、`next.config.*`、`vite.config.*` 或类似文件。仅当库存中存在这些内容时才阅读它们。 **切勿阅读 `.env` 本身** -- 仅阅读 `.env.example` 或 `.env.sample` 模板。仅提取变量名称，从不提取值。
5. **AGENTS.md 或 CLAUDE.md** （如果存在）——用于已记录的项目约定和模式。
6. **发现的文档** -- 库存的 `docs` 列表包括每个文件的标题（第一个标题）。使用这些标题来确定哪些文档与这五个部分相关，而无需先阅读它们。仅阅读标题表明直接相关的文档的完整内容。跳过过时的头脑风暴/计划文件，除非焦点提示特别需要它们。

不要推测性地读取文件。每个读取的文件都应该由库存输出来证明是合理的，并且可以追溯到需要它的部分。

### 第 3 阶段：编写 ONBOARDING.md

将清单数据和关键文件内容综合到下面定义的部分中。将文件写入存储库根目录。

**标题**：使用`# {Project Name} Onboarding Guide`作为文档标题。从清单中得出项目名称。不要使用文件名作为标题。**写作风格——文档读起来应该像知识渊博的队友一边喝咖啡一边解释项目，而不是像生成的文档一样。**

声音和语气：
- 以第二人称（“你”）书写——直接与新贡献者交谈
- 使用主动语态和现在时：“路由器将请求发送给处理程序”而不是“请求由路由器发送给处理程序”
- 直接一点。引导句子包含重要内容，而不是设置：“运行 `bun dev` 来启动服务器”而不是“为了启动开发服务器，您将需要运行以下命令”
- 匹配代码库的形式。一个斗志旺盛的原型变得随意散文。企业系统获得更精确的语言。阅读自述文件和现有文档以获取音调提示。

清晰度：
- 每句话都应该教给读者一些东西或告诉他们该怎么做。删去任何不符合的句子。
- 更喜欢具体而不是抽象：“`src/services/billing.ts`向客户的卡收费”而不是“计费模块处理与支付相关的业务逻辑”
- 介绍术语时，立即在上下文中对其进行定义。不要让读者滚动到术语表。
- 使用最简单、最准确的词语。 “使用”而不是“利用”。 “开始”而不是“初始化”。 “发送”不是“传送”。

要避免什么：
- 填充和清喉咙：“重要的是要注意”，“如上所述”，“在本节中我们将”
- 模糊总结：“这个模块处理……的各个方面”——具体说明它的作用
- 陈述事实时使用回避语：“这本质上是作为”、“这基本上是”——如果你知道它的作用，就直白地说出来
- 最高级和营销语言：“稳健”、“强大”、“全面”、“无缝”
- 关于文档本身的元评论：“本文档旨在……”——只管做事**格式要求——始终如一地适用：**
- 对所有文件名 (`package.json`)、路径 (`src/routes/`)、命令 (`bun test`)、函数/类名称、环境变量和技术术语使用反引号
- 每个部分使用 markdown 标题 (`##`)
- 使用下面指定的 ASCII 图表和降价表
- 谨慎使用粗体来强调
- 保持段落简短——2-4 句话

**部分分隔符** -- 在每个 `##` 部分之间插入水平线 (`---`)。这些文档非常密集，并且在扫描时受益于强烈的视觉中断。

**代码块的宽度限制 - 最多 80 列。** Markdown 代码块使用 `white-space: pre` 渲染并且从不换行，因此宽行会导致 GitHub、平板电脑和窄视口上的水平滚动。表格很好——降价渲染器包装它们。将这些规则应用于 ``` fences:

- **ASCII architecture diagrams**: Stack boxes vertically instead of laying them out horizontally. Never place more than 2 boxes on the same horizontal line, and keep each box label under 20 characters. This caps diagrams at ~60 chars wide.
- **Flow diagrams**: Keep file path + annotation under 80 chars. If a description is too long, move it to a line below or shorten it.
- **Directory trees**: Keep inline `# comments` under 30 characters. Prefer brief role descriptions ("Editor plugins") over exhaustive lists ("marks, heatmap, suggestions, collab cursors, etc.").

#### Section 1: What Is This?

Answer: What does this project do, who is it for, and what problem does it solve?

Draw from `README.md`, manifest descriptions (e.g., `package.json` 描述字段中的所有内容，以及入口点揭示的应用程序用途。如果无法从代码中清楚地确定项目的目的，请明确说明：“该项目的目的没有记录。根据代码结构，它似乎是......”

保持 1-3 段。

#### 第 2 部分：如何使用

回答：这个项目的消费方看起来怎么样？

在贡献者能够推理架构之前，他们需要从外部了解项目“做什么”。本节连接了“这是什么”（第 1 节）和“它是如何构建的”（第 3 节）。本节的受众（与文档的其余部分一样）是团队中的新开发人员。目标是从消费者的角度向他们展示产品是什么样子，以便后面部分中的架构和代码流具有直观意义。

根据项目的使用者在输出中为该部分添加标题：

- **最终用户产品**（网络应用程序、移动应用程序、消费者工具）--标题：**“用户体验”**。描述用户看到的内容和主要工作流程（例如，“注册、创建项目、邀请协作者、查看实时更新”）。根据路线、入口点和自述文件进行绘制。
- **开发人员工具**（SDK、库、开发 CLI、框架）-- 标题：**“开发人员体验”**。描述开发人员如何使用该工具：安装、显示主要 API 界面的最小使用示例以及 2-3 个最常见的命令或模式。这与第 6 节（开发人员指南）不同，第 6 节介绍了对“此代码库”的贡献——本节介绍了“使用”代码库生成的内容。
- **两者**（具有面向消费者的产品和开发人员 API/SDK 的平台）-- 标题：**“用户和开发人员体验”**。涵盖两个视角，从最终用户体验开始，然后是面向开发人员的界面。每个受众保持 1-3 个段落或简短的流程。如果存在全面的用户或开发人员文档，请链接到它们并用一句话总结关键工作流程。不要重复现有文档。

仅对于没有消费受众的代码库（纯基础设施、没有直接交互的内部部署工具）跳过此部分。

---

#### 第 3 部分：它是如何组织的？

答：架构是怎样的，关键模块有哪些，它们之间是如何联系的，系统对外依赖什么？

本节涵盖**内部结构**和**系统边界**——应用程序与外部对话的内容。

**系统架构** -- 有两种图表可以帮助新贡献者，系统的复杂性决定是否使用一种或两种：

1. **架构图** -- 组件、它们如何连接以及它们使用什么协议或传输。开发人员通过查看此内容来了解​​代码所在的位置以及各部分如何相互通信。使用交互类型（HTTP、WebSocket、网桥、队列等）标记边缘。从顶部面向用户的表面开始，中间是内部管道，底部是数据存储和外部服务。

2. **用户交互流程**——用户通过产品所经历的逻辑旅程。不是关于基础设施，而是关于从用户的角度发生的事情——操作的顺序以及系统的响应。**何时使用一种或两种：**
- 对于简单的系统（单个 Web 应用程序、CLI 工具、简单的 API），架构图已经讲述了用户的故事 - 一张图就足够了。通过组件的请求路径*是*用户流。
- 对于多表面产品（本机应用程序 + Web + API，或具有多种不同用户类型的系统），请同时包含两者。架构图向开发人员展示了各部分的连接方式；用户交互流程显示了这些部分的逻辑产品体验。这些是同一系统上的不同镜头。

使用垂直堆叠将图表保持在 80 列以下。

架构图示例：
```
       User / Browser
            |
            |  HTTP / WebSocket
            v
+------------------+    bridge    +------------------+
| Browser Client   |<----------->| Native macOS App |
| (Vite bundle)    |             | (Swift/WKWebView)|
+--------+---------+             +--------+---------+
         |                                |
         |  WebSocket                     |  bridge
         v                               v
+------------------------------------------+
|            Express Server                |
|  routes -> services -> models            |
+--------------------+---------------------+
                     |
                     |  SQL / Yjs sync
                     v
              +--------------+
              | SQLite + Yjs |
              +--------------+
```
用户交互流程示例（相同系统，不同镜头）：
```
User opens app
  |
  v
Writes/edits document
  (Milkdown editor)
  |
  v
Changes sync in real-time
  (Yjs CRDT)
  |                \
  v                 v
Document persists   Other connected
  to SQLite         clients see edits
  |
  v
User shares doc
  -> generates link
  |
  v
Recipient opens
  in browser client
```
对于简单项目（单一用途库、CLI 工具），请跳过这两个项目，其中目录树已经讲述了整个故事。

**内部结构** -- 包括显示高级布局的 ASCII 目录树：
```
project-name/
  src/
    routes/       # HTTP route handlers
    services/     # Business logic
    models/       # Data layer
  tests/          # Test suite
  config/         # Environment and app configuration
```
用简短的注释来解释目录的作用。仅包含重要的目录——跳过构建工件、配置文件和样板文件。

当存在具有明确职责的不同模块或组件时，将它们呈现在表格中：
```
| Module | Responsibility |
|--------|---------------|
| `src/routes/` | HTTP request handling and routing |
| `src/services/` | Core business logic |
| `src/models/` | Database models and queries |
```
描述模块如何连接——什么叫什么，数据在它们之间流动。

**外部依赖项和集成** - 显示系统与其自身代码库之外的所有内容。对于尝试运行该项目的新贡献者来说，这通常是最大的障碍。在以下位置寻找信号：
- `docker-compose.yml`（数据库、缓存、消息队列）
- 配置文件或 `.env.example` 中的环境变量引用
- 客户端库的导入语句（数据库驱动程序、API SDK、云存储）
- 清单检测到的框架（例如，Prisma 意味着数据库）

当存在多个依赖项时以表形式呈现：
```
| Dependency | What it's used for | Configured via |
|-----------|-------------------|---------------|
| PostgreSQL | Primary data store | `DATABASE_URL` |
| Redis | Session cache and job queue | `REDIS_URL` |
| Stripe API | Payment processing | `STRIPE_SECRET_KEY` |
| S3 | File uploads | `AWS_*` env vars |
```
如果未检测到外部依赖项，请说明：“该项目看起来是独立的，没有外部服务依赖项。”

#### 第 4 部分：关键概念和抽象

回答：人们需要理解哪些词汇和模式才能谈论这个代码库？

本节涵盖两件事：

**领域术语** -- 特定于项目的词汇：实体名称、API 资源名称、数据库表、配置概念以及新读者无法立即识别的术语。

**架构抽象**——代码库中的结构模式，决定了代码的组织方式以及贡献者应如何考虑进行更改。这些在代码库中尤其重要，因为原始作者可能没有有意识地选择这些模式——它们可能是由人工智能引入的，或者是在没有文档的情况下从模板中采用的。

值得展示的架构抽象示例：
- “业务逻辑位于服务层（`src/services/`），而不是路由处理程序中”
- “在每个受保护的路由之前通过 `src/middleware/auth.ts` 中的中间件进行身份验证”
- “数据库访问使用存储库模式——每个模型都有一个相应的存储库类”
- “后台作业在 `src/jobs/` 中定义并通过 Redis 支持的队列调度”

在单个表中呈现领域术语和抽象：
```
| Concept | What it means in this codebase |
|---------|-------------------------------|
| `Widget` | The primary entity users create and manage |
| `Pipeline` | A sequence of processing steps applied to incoming data |
| Service layer | Business logic in `src/services/`, not handlers |
| Middleware chain | Requests flow through `src/middleware/` first |
```
目标是 5-15 个条目。仅包含会让新读者感到困惑的概念或代表不明显的架构决策的概念。跳过普遍理解的术语。

#### 第 5 节：主要流程

回答：当这个应用程序所做的主要事情实际发生时会发生什么？

根据不同的表面或用户类型跟踪一个流量。 “表面”是进入系统的有意义的不同入口路径——本机应用程序、Web UI、API 使用者、CLI 用户。每个流程都应该揭示以前的流程未涵盖的架构部分。当下一个流程主要回溯已显示的文件时停止。

对于简单的库或 CLI，这就是一个流程。对于具有 Web UI 和 API 的全栈应用程序来说，这是两个。对于具有本机 + Web + 代理界面的产品来说，这是三个。让架构驱动计数，而不是任意数字。

包括最重要流程的 ASCII 流程图：
```
User Request
  |
  v
src/routes/widgets.ts
  validates input, extracts params
  |
  v
src/services/widget.ts
  applies business rules, calls DB
  |
  v
src/models/widget.ts
  persists to PostgreSQL
  |
  v
Response (201 Created)
```
在每个步骤中，引用特定的文件路径。将文件路径 + 注释保持在 80 个字符以内 - 如果需要，请将注释放在下一行（如上所示）。

如果第一个图已经建立了结构模式，则其他流程可以使用编号列表而不是完整图。

#### 第 6 部分：开发人员指南

答：如何设置项目、运行项目并进行常见更改？

涵盖这些领域：

1. **安装** -- 先决条件、安装步骤、环境配置。从自述文件和清单的脚本中提取。代码块中的格式命令：
   ```
   bun install
   cp .env.example .env
   bun dev
   ```

2. **Running and testing** -- How to start the dev server, run tests, lint. Use the inventory's detected scripts.

3. **Common change patterns** -- Where to go for the 2-3 most common types of changes. For example:
   - "To add a new API endpoint, create a route handler in `src/routes/` and register it in `src/routes/index.ts`"
   - "To add a new database model, create a file in `src/models/` and run `bun迁移`"

4. **Key files to start with** (for complex projects) -- A table mapping areas of the codebase to specific entry-point files with a brief "why start here" note. This gives a new contributor a concrete reading list instead of staring at a large directory tree. For example:

   ```
   | Area | File | Why |
   |------|------|-----|
   | Editor core | `src/editor/index.ts` | All editor wiring |
   | Data model | `src/formats/marks.ts` | The annotation system everything builds on |
   | Server entry | `server/index.ts` | Express app setup and route mounting |
   ```

   对于源文件少于 10 个的项目，目录树已经是足够的阅读列表，请跳过此步骤。5. **实用技巧**（对于复杂的项目）——如果代码库中有特别大、复杂或有不明显问题的区域，请将它们作为简短的贡献者提示显示出来。这些传达真实的态势感知，帮助新贡献者避免陷阱。例如：
   - “编辑器模块约为 450KB。大多数行为是通过 `src/editor/plugins/` 中的插件连接的 - 在进行编辑器更改之前了解插件架构。”
   -“协作子系统有许多防护和纪元检查。阅读测试名称以了解维护了哪些不变量。”

   对于代码库小到足以记住的简单项目，请跳过此步骤。

#### 内联文档链接

在编写每个部分时，检查清单的 `docs` 列表中的任何文件是否与该部分所解释的内容直接相关。如果是这样，请内联链接：

> 身份验证使用基于令牌的中间件 - 请参阅 [`docs/solutions/auth-pattern.md`](docs/solutions/auth-pattern.md) 了解完整模式。

不要创建单独的参考文献或进一步阅读部分。如果某个部分不存在相关文档，则该部分是独立的 - 不要提及它们的缺失。

### 第 4 阶段：质量检查

在写入文件之前，请验证：- [ ] 每个部分都回答其问题，无需填充或填充
- [ ] 文档中任何位置都没有机密、API 密钥、令牌、密码或凭证值
- [ ] 没有捏造的设计原理（“我们选择 X 因为......”）
- [ ] 无脆弱性或风险评估
- [ ] 文档中引用的文件路径对应于清单中的真实文件
- [ ] 所有文件名、路径、命令、代码引用和技术术语均使用反引号格式
- [ ] 文档标题使用“# {Project Name} Onboarding Guide”格式，而不是文件名
- [ ] 包含多表面项目的系统级架构图（简单库/CLI 则跳过）
- [ ] 所有代码块内容（图表、树、流程跟踪）适合 80 列
- [ ] ASCII 图出现在架构和/或主要流程部分中
- [ ] 每个不同表面或用户类型一个流（架构驱动计数，而不是任意数字）
- [ ] 外部依赖项和集成出现在架构部分（或明确指出不存在）
- [ ] 表用于模块职责、领域术语/抽象和外部依赖项
- [ ] Markdown 样式始终保持一致（标题、粗体、代码块、表格）
- [ ] 现有文档仅在直接相关的情况下内联链接
- [ ] 写作直接而具体——没有填充物、没有修饰词、没有关于文档的元评论
- [ ] 语气与代码库匹配（对于杂乱的项目来说是休闲的，对于企业来说是精确的）
- [ ]“如何使用”部分，标题适合受众（用户体验/开发人员体验/两者），仅针对没有消费受众的纯基础设施跳过
- [ ] 架构图具有标记的边缘（协议/传输），并在系统具有多个表面或用户类型时包括用户交互流程图将文件写入存储库根目录为 `ONBOARDING.md`。

### 第 5 阶段：呈现结果

写入后，通知用户`ONBOARDING.md`已生成。使用平台的阻塞问题工具（如果可用）提供后续步骤（Claude Code 中的 `AskUserQuestion`、Codex 中的 `request_user_input`、Gemini 中的 `ask_user`。否则，在聊天中显示编号选项。

选项：
1. 打开文件进行审阅
2. 分享证明
3. 完成

根据选择：
- **打开供审查** -> 使用当前平台的文件打开或编辑器机制打开 `ONBOARDING.md`
- **分享到证明** -> 上传文档：
  ```bash
  CONTENT=$(cat ONBOARDING.md)
  TITLE="Onboarding: <project name from inventory>"
  RESPONSE=$(curl -s -X POST https://www.proofeditor.ai/share/markdown \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg title "$TITLE" --arg markdown "$CONTENT" --arg by "ai:compound" '{title: $title, markdown: $markdown, by: $by}')")
  PROOF_URL=$(echo "$RESPONSE" | jq -r '.tokenUrl')
  ```
  Display `在校样中查看和协作：<PROOF_URL>`如果成功，则返回到选项
- **完成** -> 没有进一步的操作
