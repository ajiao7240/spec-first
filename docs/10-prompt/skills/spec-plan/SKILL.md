---
name: plan-workflow
description: “将功能描述或需求转化为基于回购模式和研究的结构化实施计划。当用户说‘计划这个’、‘创建计划’、‘编写技术计划’、‘计划实施’、‘我们应该如何构建’、‘方法是什么’、‘分解这个’，或者当头脑风暴/需求文档准备好进行技术规划时使用。最好是在需求至少被粗略定义时使用；对于探索性或模糊的请求，更喜欢规格：首先进行头脑风暴。”
argument-hint: "[feature description, requirements doc path, or improvement idea]"
---
# 创建技术计划

**注意：当前年份是 2026 年。** 在约会计划和搜索最近的文档时使用此选项。

`spec:brainstorm` 定义了要构建的**内容**。 `spec:plan` 定义了构建它的**方式**。 `spec:work` 执行计划。

此工作流程会产生持久的实施计划。它**不**实现代码、运行测试或从执行时结果中学习。如果答案取决于更改代码并查看会发生什么，那么那属于 `spec:work`，而不是这里。

## 交互方式

如果可用，请使用平台的问题工具。当向用户提问时，最好使用平台的屏蔽提问工具（如果存在）（Claude Code 中的 `AskUserQuestion`、Codex 中的 `request_user_input`、Gemini 中的 `ask_user`。否则，在聊天中显示编号选项并等待用户回复后再继续。

一次问一个问题。当存在自然选项时，更喜欢简洁的单选选择。

## 功能描述

<功能描述> #$ARGUMENTS </功能描述>

**如果上面的功能描述为空，请询问用户：**“您想要计划什么？请描述您想要的功能、错误修复或改进。”

在您有明确的计划输入之前不要继续。

## 核心原则1. **使用需求作为事实来源** - 如果`spec:brainstorm`生成了需求文档，那么规划应该根据它来构建，而不是重新发明行为。
2. **决策，而不是代码** - 捕获方法、边界、文件、依赖项、风险和测试场景。不要预先编写实现代码或 shell 命令编排。传达高级技术设计的伪代码草图或 DSL 语法在帮助审阅者验证方向时受到欢迎，但它们必须明确地构建为方向指导，而不是实现规范。
3. **构建之前进行研究** - 在最终确定计划之前，在必要时探索代码库、机构学习和外部指导。
4. **调整工件大小** - 小工作得到紧凑的计划。大型工作变得更加结构化。这一理念在每个深度上都保持不变。
5. **将计划与执行发现分开** - 在此解决计划时间问题。明确地将执行时间未知数推迟到实现。
6. **保持计划可移植** - 计划应作为动态文档、审查工件或问题主体，而不嵌入特定于工具的执行器指令。
7. **在重要时轻松执行执行姿势** - 如果请求、原始文档或存储库上下文明确暗示测试优先、特征优先或其他非默认执行姿势，请在计划中将其反映为轻量级信号。不要把计划变成一步一步的执行编排。

## 计划质量栏每个计划应包含：
- 清晰的问题框架和范围边界
- 具体需求可追溯至请求或原始文档
- 所提议工作的确切文件路径
- 具有功能的实现单元的显式测试文件路径
- 有理由的决定，而不仅仅是任务
- 遵循现有模式或代码参考
- 枚举每个功能承载单元的测试场景，足够具体，使实施者确切地知道要测试什么，而无需自己发明覆盖范围
- 清晰的依赖关系和顺序

当实施者可以自信地开始而不需要计划为他们编写代码时，计划就准备好了。

## 工作流程

### 第 0 阶段：简历、来源和范围

#### 0.1 适当时恢复现有计划工作

如果用户引用现有计划文件或`docs/plans/`中有明显的最近匹配计划：
- 阅读它
- 确认是否就地更新或创建新计划
- 如果更新，保留已完成的复选框并仅修改仍然相关的部分

**重新深化快速路径：** 如果计划看起来完整（所有主要部分均已存在，已定义实施单位，`status: active`）并且用户的请求具体是关于深化或加强计划 - 通过“深化”、“加强”、“信心”、“差距”等信号词检测到，或明确要求重新深化 - 直接短路至阶段 5.3（置信度检查和深化）。这避免了仅仅为了评估深化而重新运行完整的规划工作流程。

正常的编辑请求（例如，“更新测试场景”、“添加新的实现单元”）不应触发快速路径 - 它们遵循标准恢复流程。如果计划已经有 `deepened: YYYY-MM-DD` frontmatter 字段并且没有明确的用户请求重新深化，则快速路径仍然应用相同的置信差距评估 - 它不会强制深化。

#### 0.2 查找上游需求文档

在提出规划问题之前，请搜索 `docs/brainstorms/` 匹配 `*-requirements.md` 的文件。

**相关性标准：** 如果满足以下条件，则需求文档是相关的：
- 主题在语义上与功能描述相匹配
- 它是在过去 30 天内创建的（如果文档明显仍然相关或明显过时，请使用判断来覆盖）
- 它似乎涵盖了相同的用户问题或范围

如果多个源文档匹配，请使用平台的阻塞问题工具（如果可用）询问使用哪一个（请参阅交互方法）。否则，在聊天中显示编号选项并等待用户回复后再继续。

#### 0.3 使用源文档作为主要输入

如果存在相关要求文档：
1. 仔细阅读
2、宣布作为规划原始文件
3. 继承以下所有内容：
   - 问题框架
   - 要求和成功标准
   - 范围边界
   - 关键决策和理由
   - 依赖性或假设
   - 未解决的问题，保留它们是否被阻止或推迟
4. 使用源文件作为规划和研究的主要输入
5. 在计划中引用重要的结转决策`(see origin: <source-path>)`
6. 不要默默地省略源内容——如果原始文档讨论过它，计划必须解决它，即使是简短的。在最终确定之前，扫描原始文档的每个部分以验证没有任何内容丢失。如果没有相关的需求文件，则可以直接根据用户的请求进行规划。

#### 0.4 无要求文档后备

如果没有相关要求文件：
- 评估请求是否已经足够明确以进行直接技术规划
- 如果歧义主要是产品框架、用户行为或范围定义，则首先推荐 `spec:brainstorm`
- 如果用户无论如何都想继续这里，请运行一个简短的计划引导程序而不是拒绝

规划引导程序应建立：
- 问题框架
- 预期行为
- 范围边界和明显的非目标
- 成功标准
- 阻止问题或假设

保持这个引导程序简短。它的存在是为了保持直接输入的便利，而不是取代全面的头脑风暴。

如果引导程序发现主要的未解决的产品问题：
- 再次推荐`spec:brainstorm`
- 如果用户仍想继续，则在继续之前需要明确的假设

#### 0.5 在计划之前对悬而未决的问题进行分类

如果原始文档包含 `Resolve Before Planning` 或类似的阻止问题：
- 在继续之前检查每一项
- 将其重新分类为规划所属的工作**仅当**它实际上是技术、架构或研究问题时
- 如果它会改变产品行为、范围或成功标准，请将其作为阻碍因素

如果真正的产品阻碍仍然存在：
- 清晰地呈现它们
- 使用平台的屏蔽问题工具（如果可用）（请参阅交互方法）询问用户是否：
  1. 继续`spec:brainstorm`来解决它们
  2. 将它们转化为明确的假设或决策并继续
- 在真正的阻碍仍未解决时，不要继续计划

#### 0.6 评估计划深度

将工作分类为以下计划深度之一：- **轻量级** - 小、界限清楚、模糊性低
- **标准** - 正常功能或有限重构，并记录一些技术决策
- **深入** - 跨领域、战略性、高风险或高度模糊的实施工作

如果深度不清楚，请提出一个有针对性的问题，然后继续。

### 第 1 阶段：收集背景信息

#### 1.1 本地研究（始终运行）

准备一份简明的规划背景摘要（一两段）作为研究代理的输入：
- 如果存在原始文档，请总结该文档中的问题框架、要求和关键决策
- 否则直接使用功能描述

并行运行这些代理：

- 任务spec-first:research:repo-research-analyst(范围:技术、架构、模式。{规划上下文摘要})
- 任务规范-优先：研究：学习-研究员（规划背景摘要）

收集：
- 技术堆栈和版本（在第 1.2 节中用于做出更清晰的外部研究决策）
- 要遵循的架构模式和约定
- 实施模式、相关文件、模块和测试
- AGENTS.md 指导对计划产生重大影响，CLAUDE.md 仅在存在时用作兼容性后备
- 来自`docs/solutions/`的制度学习

#### 1.1b 检测执行状态信号

决定计划是否应该携带轻量级执行态势信号。寻找以下信号：
- 用户明确要求 TDD、测试优先或表征优先工作
- 原始文档要求测试优先实施或对遗留代码进行探索性强化
- 当地研究表明目标区域是遗留的、测试不力或历史上脆弱的，建议在改变行为之前进行特征覆盖
- 用户请求外部委托，说“使用codex”，“委托模式”，或者提到令牌保护——将`Execution target: external-delegate`添加到纯代码编写的实现单元

当信号明确后，在相关实施单位默默转发。

仅询问用户该姿势是否会严重改变顺序或风险且无法负责任地推断。

#### 1.2 决定外部研究

根据原始文件、用户信号和当地发现，决定外部研究是否增加价值。

**体会言外之意。** 注意目前对话中发出的信号：
- **用户熟悉度** — 他们是否指向特定文件或模式？他们可能很了解代码库。
- **用户意图** — 他们想要速度还是彻底性？探索还是执行？
- **主题风险** - 无论用户信号如何，安全、支付、外部 API 都需要更加谨慎。
- **不确定性** - 该方法是否明确或仍然是开放式的？

**利用回购研究分析师的技术背景：**

回购研究分析师的输出包括结构化的技术和基础设施摘要。用它来做出更明智的外部研究决策：- 如果检测到特定的框架和版本（例如，Rails 7.2、Next.js 14、Go 1.22），请将这些确切的标识符传递给framework-docs-researcher，以便它获取特定于版本的文档
- 如果该功能触及存储库中已建立的扫描技术层（例如，规划新后台作业时现有的 Sidekiq 作业），则倾向于跳过外部研究 - 本地模式可能就足够了
- 如果该功能触及扫描发现不存在或薄弱的技术层（例如，在规划新的 gRPC 服务时没有现有的原型文件），则倾向于外部研究 - 没有本地模式可遵循
- 如果扫描检测到部署基础设施（Docker、K8s、无服务器），请在传递给下游代理的规划上下文中记下它，以便他们可以考虑部署约束
- 如果扫描检测到单一存储库并限定特定服务，则将该服务的技术上下文传递给下游研究代理，而不是所有服务的聚合。如果扫描显示了工作区地图但未确定范围，请在继续研究之前使用功能描述来识别相关服务**在以下情况下始终倾向于外部研究：**
- 主题是高风险的：安全、支付、隐私、外部 API、迁移、合规性
- 代码库缺乏相关的本地模式——该计划所需模式的直接示例少于 3 个
- 相邻域存在本地模式，但不是确切的模式 - 例如，代码库有 HTTP 客户端，但没有 Webhook 接收器，或者有后台作业，但没有事件驱动的发布/订阅。相邻模式表明团队对技术层感到满意，但可能不知道特定领域的陷阱。当存在此信号时，专门围绕领域差距构建外部研究查询，而不是通用技术
- 用户正在探索不熟悉的领域
- 技术扫描发现代码库中相关层缺失或薄弱

**在以下情况下跳过外部研究：**
- 代码库已经显示出强大的本地模式——多个直接示例（非相邻域），最近接触过，遵循当前约定
- 用户已经知道想要的形状
- 额外的外部背景几乎不会增加实际价值
- 技术扫描发现相关层已建立并具有可遵循的现有示例

在继续之前简要宣布决定。示例：
- “你的代码库对此有可靠的模式。无需外部研究即可继续。”
- “这涉及付款处理，所以我将首先研究当前的最佳实践。”

#### 1.3 外部研究（有条件）

如果步骤 1.2 表明外部研究有用，请并行运行这些代理：

- 任务规范第一：研究：最佳实践研究员（规划背景摘要）
- 任务spec-first：研究：framework-docs-researcher（规划上下文摘要）

#### 1.4 巩固研究总结一下：
- 相关代码库模式和文件路径
- 相关机构学习
- 外部参考和最佳实践（如果收集）
- 相关问题、PR 或现有技术
- 任何对计划有实质性影响的限制

#### 1.4b 当研究揭示外部接触面时重新分类深度

如果当前分类为 **轻量级** 并且第一阶段研究发现作品接触了任何这些外部接触面，则重新分类为 **标准**：

- 外部系统、CI 或其他存储库消耗的环境变量
- 导出的公共 API、CLI 标志或命令行界面合约
- CI/CD 配置文件（`.github/workflows/`、`Dockerfile`、部署脚本）
- 下游消费者导入的共享类型或接口
- 由外部 URL 引用或从其他系统链接的文档

这可确保流程分析（阶段 1.5）运行，并且置信度检查（阶段 5.3）应用关键部分奖励。简要宣布重新分类：“重新分类为标准 - 此更改涉及外部消费者的[环境变量/导出的 API/CI 配置]。”

#### 1.5 流程和边缘情况分析（有条件）

对于 **Standard** 或 **Deep** 计划，或者当用户流程完整性仍不清楚时，运行：

- 任务spec-first:workflow:spec-flow-analyzer(规划背景摘要、研究结果)

使用输出来：
- 识别缺失的边缘情况、状态转换或切换间隙
- 加强需求跟踪或验证策略
- 仅添加能够实质性改进计划的流程细节

### 第 2 阶段：解决规划问题

根据以下内容构建规划问题列表：
- 原始文件中推迟的问题
- 在回购或外部研究中发现的差距
- 制定有用计划所需的技术决策对于每个问题，决定是否应该：
- **在规划期间解决** - 答案可以从存储库上下文、文档或用户选择中得知
- **推迟到实现** - 答案取决于代码更改、运行时行为或执行时发现

仅当答案对架构、范围、排序或风险产生重大影响并且无法负责任地推断时才询问用户。如果可用，请使用平台的屏蔽问题工具（请参阅交互方法）。

**不要**在此阶段运行测试、构建应用程序或探测运行时行为。目标是一个强有力的计划，而不是部分执行。

### 第三阶段：构建计划

#### 3.1 标题和文件命名

- 使用传统格式（例如 `feat: Add user authentication` 或 `fix: Prevent checkout double-submit` 起草清晰、可搜索的标题
- 确定计划类型：`feat`、`fix` 或 `refactor`
- 按照存储库约定构建文件名：`docs/plans/YYYY-MM-DD-NNN-<type>-<descriptive-name>-plan.md`
  - 如果不存在则创建`docs/plans/`
  - 检查现有文件中的今天日期以确定下一个序列号（以零填充到 3 位数字，从 001 开始）
  - 保持描述性名称简洁（3-5 个单词）并采用短横线格式
  - 示例：`2026-01-15-001-feat-user-authentication-flow-plan.md`、`2026-02-03-002-fix-checkout-race-condition-plan.md`
  - 避免：缺少序列号、模糊名称（例如“新功能”）、无效字符（冒号、空格）

#### 3.2 利益相关者和影响意识

对于**标准**或**深度**计划，请简要考虑谁会受到此更改的影响 - 最终用户、开发人员、运营、其他团队 - 以及应如何制定计划。对于跨领域工作，请在“全系统影响”部分注明受影响的各方。#### 3.3 将工作分解为实施单元

将工作分解为逻辑实施单元。每个单元应该代表一个有意义的更改，实施者通常可以将其作为原子提交来实现。

好的单位有：
- 专注于一个组件、行为或集成接缝
- 通常接触一小群相关文件
- 按依赖关系排序
- 足够具体，无需预先编写代码即可执行
- 用复选框语法标记用于进度跟踪

避免：
- 2-5 分钟微步
- 跨越多个不相关问题的单元
- 单位如此模糊，实施者仍然必须发明计划

#### 3.4 高级技术设计（可选）

在详细说明实施单元之前，请确定概述是否有助于审阅者验证预期的方法。本节传达解决方案的“形状”——各个部分如何组合在一起——而不指定实施方式。

**何时包含它：**

|工作涉及... |最佳概述表|
|---|---|
| DSL或API表面设计|伪代码语法或合约草图 |
|多组件集成|美人鱼序列或组件图|
|数据管道或转换 |数据流示意图|
|状态重的生命周期 |状态图|
|复杂的分支逻辑 |流程图|
|模式/标志组合或多输入行为 |决策矩阵（输入 -> 结果）|
|形状不明显的单组分 |伪代码草图 |

**何时跳过它：**
- 格式良好的作品，散文和文件路径讲述了整个故事
- 简单的 CRUD 或遵循约定的更改
- 方法显而易见的轻量级计划

选择适合工作的媒介。当图表能够更好地传达信息时，不要默认使用伪代码，反之亦然。用以下内容构建每个草图：*“这说明了预期的方法，并且是审查的方向指导，而不是实施规范。实施代理应将其视为上下文，而不是要重现的代码。”*

保持草图简洁——足以验证方向，但不足以复制粘贴到生产中。

#### 3.5 定义各个实施单元对于每个单元，包括：
- **目标** - 该单位完成的任务
- **要求** - 它提出了哪些要求或成功标准
- **依赖关系** - 首先必须存在的东西
- **文件** - 要创建、修改或测试的确切文件路径
- **方法** - 关键决策、数据流、组件边界或集成说明
- **执行注释** - 可选，仅当单元受益于非默认执行状态（例如测试优先、表征优先或外部委派）时
- **技术设计** - 当单元的方法不明显并且单独的散文会使它变得模糊时，可选的伪代码或图表。明确框架作为方向性指导，而不是实施规范
- **要遵循的模式** - 要镜像的现有代码或约定
- **测试场景** - 枚举实施者应编写的特定测试用例，并根据单元的复杂性和风险调整大小。考虑下面的每个类别，并包括适用于本单元的每个类别的场景。一个简单的配置更改可能需要一种场景；一个支付流程可能需要十几个。质量信号是特异性的——每个场景都应该指定输入、操作和预期结果，这样实施者就不必发明覆盖范围。
  - **快乐路径行为** - 具有预期输入和输出的核心功能
  - **边缘情况**（当单元具有有意义的边界时） - 边界值、空输入、nil/null 状态、并发访问
  - **错误和故障路径**（当设备具有故障模式时） - 无效输入、下游服务故障、超时行为、权限拒绝
  - **集成场景**（当单元跨层时） - 单独模拟的行为无法证明，例如，“创建 X 触发回调 Y 并持久保留 Z”。包括任何单元接触回调、中间件或多层交互
- **验证** - 实施者应该如何知道单元是完整的，表示为结果而不是 shell 命令脚本每个功能承载单元都应在 `**Files:**` 中包含测试文件路径。

谨慎使用 `Execution note`。好的用途包括：
- `Execution note: Start with a failing integration test for the request/response contract.`
- `Execution note: Add characterization coverage before modifying this legacy parser.`
- `Execution note: Implement new domain behavior test-first.`
- `Execution note: Execution target: external-delegate`

不要将单位扩展为文字 `RED/GREEN/REFACTOR` 子步骤。

#### 3.6 将计划时间和实施时间的未知因素分开

如果某件事很重要但尚不可知，请将其明确记录在推迟的实施说明中，而不是假装在计划中解决它。

示例：
- 确切的方法或助手名称
- 接触真实代码后的最终 SQL 或查询详细信息
- 运行时行为取决于看到实际的测试失败
- 一旦实施开始，重构可能变得不必要

### 第 4 阶段：编写计划

在所有深度上使用一种规划理念。改变细节的数量，而不是计划和执行之间的界限。

#### 4.1 计划深度指导

**轻量级**
- 保持计划紧凑
- 通常有2-4个实施单位
- 省略几乎没有增加价值的可选部分

**标准**
- 使用完整的核心模板，省略对本特定工作没有任何价值的可选部分（包括高级技术设计）
- 通常有3-6个实施单位
- 包括风险、延迟问题和相关的系统范围影响

**深**
- 使用完整的核心模板以及必要的可选分析部分
- 通常有4-8个实施单位
- 将单元分为几个阶段，以提高清晰度
- 包括考虑的替代方案、记录影响以及必要时更深入的风险处理#### 4.1b 可选的深度计划扩展

对于足够大、有风险或交叉的工作，请添加真正有帮助的部分：
- **考虑替代方法**
- **成功指标**
- **依赖项/先决条件**
- **风险分析与缓解**
- **分阶段交付**
- **文档计划**
- **操作/推出说明**
- **未来考虑因素** 仅当它们对当前设计产生重大影响时

不要将它们添加为样板。仅当它们提高执行质量或利益相关者一致性时才包含它们。

#### 4.2 核心计划模板

省略明显不适用的可选部分，尤其是对于轻量级计划。
```markdown
---
title: [Plan Title]
type: [feat|fix|refactor]
status: active
date: YYYY-MM-DD
origin: docs/brainstorms/YYYY-MM-DD-<topic>-requirements.md  # include when planning from a requirements doc
deepened: YYYY-MM-DD  # optional, set when the confidence check substantively strengthens the plan
---

# [Plan Title]

## Overview

[What is changing and why]

## Problem Frame

[Summarize the user/business problem and context. Reference the origin doc when present.]

## Requirements Trace

- R1. [Requirement or success criterion this plan must satisfy]
- R2. [Requirement or success criterion this plan must satisfy]

## Scope Boundaries

- [Explicit non-goal or exclusion]

## Context & Research

### Relevant Code and Patterns

- [Existing file, class, component, or pattern to follow]

### Institutional Learnings

- [Relevant `docs/solutions/` insight]

### External References

- [Relevant external docs or best-practice source, if used]

## Key Technical Decisions

- [Decision]: [Rationale]

## Open Questions

### Resolved During Planning

- [Question]: [Resolution]

### Deferred to Implementation

- [Question or unknown]: [Why it is intentionally deferred]

<!-- Optional: Include this section only when the work involves DSL design, multi-component
     integration, complex data flow, state-heavy lifecycle, or other cases where prose alone
     would leave the approach shape ambiguous. Omit it entirely for well-patterned or
     straightforward work. -->
## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

[Pseudo-code grammar, mermaid diagram, data flow sketch, or state diagram — choose the medium that best communicates the solution shape for this work.]

## Implementation Units

- [ ] **Unit 1: [Name]**

**Goal:** [What this unit accomplishes]

**Requirements:** [R1, R2]

**Dependencies:** [None / Unit 1 / external prerequisite]

**Files:**
- Create: `path/to/new_file`
- Modify: `path/to/existing_file`
- Test: `path/to/test_file`

**Approach:**
- [Key design or sequencing decision]

**Execution note:** [Optional test-first, characterization-first, external-delegate, or other execution posture signal]

**Technical design:** *(optional -- pseudo-code or diagram when the unit's approach is non-obvious. Directional guidance, not implementation specification.)*

**Patterns to follow:**
- [Existing file, class, or pattern]

**Test scenarios:**
<!-- Include only categories that apply to this unit. Omit categories that don't. -->
- [Scenario: specific input/action -> expected outcome. Prefix with category — Happy path, Edge case, Error path, or Integration — to signal intent]

**Verification:**
- [Outcome that should hold when this unit is complete]

## System-Wide Impact

- **Interaction graph:** [What callbacks, middleware, observers, or entry points may be affected]
- **Error propagation:** [How failures should travel across layers]
- **State lifecycle risks:** [Partial-write, cache, duplicate, or cleanup concerns]
- **API surface parity:** [Other interfaces that may require the same change]
- **Integration coverage:** [Cross-layer scenarios unit tests alone will not prove]
- **Unchanged invariants:** [Existing APIs, interfaces, or behaviors that this plan explicitly does not change — and how the new work relates to them. Include when the change touches shared surfaces and reviewers need blast-radius assurance]

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| [Meaningful risk] | [How it is addressed or accepted] |

## Documentation / Operational Notes

- [Docs, rollout, monitoring, or support impacts when relevant]

## Sources & References

- **Origin document:** [docs/brainstorms/YYYY-MM-DD-<topic>-requirements.md](path)
- Related code: [path or symbol]
- Related PRs/issues: #[number]
- External docs: [url]
```
对于较大的 `Deep` 计划，仅在对以下部分有用时才扩展核心模板：
```markdown
## Alternative Approaches Considered

- [Approach]: [Why rejected or not chosen]

## Success Metrics

- [How we will know this solved the intended problem]

## Dependencies / Prerequisites

- [Technical, organizational, or rollout dependency]

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| [Risk] | [Low/Med/High] | [Low/Med/High] | [How addressed] |

## Phased Delivery

### Phase 1
- [What lands first and why]

### Phase 2
- [What follows and why]

## Documentation Plan

- [Docs or runbooks to update]

## Operational / Rollout Notes

- [Monitoring, migration, feature flag, or rollout considerations]
```
#### 4.3 规划规则

- 优先选择路径加上类/组件/模式引用而不是脆弱的行号
- 使用 `- [ ]` 语法保持实施单元可检查以进行进度跟踪
- 不包含实现代码——没有导入、精确的方法签名或特定于框架的语法
- 在传达设计方向时，高级技术设计部分和每单元技术设计字段中允许使用伪代码草图和 DSL 语法。将它们明确地构建为方向性指导，而不是实施规范
- 当美人鱼图阐明单独的散文很难理解的关系或流程时，我们鼓励使用美人鱼图——用于数据模型更改的 ERD、用于多服务交互的序列图、用于生命周期转换的状态图、用于复杂分支逻辑的流程图
- 不包含 git 命令、提交消息或精确的测试命令配方
- 不要将执行单元扩展为微步`RED/GREEN/REFACTOR`指令
- 不要假装执行时问题已经解决，只是为了让计划看起来很完整

### 第 5 阶段：最终审查、编写文件和移交

#### 5.1 写作前回顾在最终确定之前，请检查：
- 该计划没有发明应在 `spec:brainstorm` 中定义的产品行为
- 如果没有原始文档，有界规划引导程序会建立足够的产品清晰度来负责任地进行规划
- 每个重大决策均以原始文件或研究为基础
- 每个实现单元都是具体的、依存顺序的且可实现
- 如果测试优先或表征优先的姿势是明确的或强烈暗示的，相关单位会以轻量级的`Execution note`来推进它
- 每个承载功能的单元都有来自每个适用类别的测试场景（快乐路径、边缘情况、错误路径、集成）——大小适合单元的复杂性，而不是填充或精简
- 测试场景命名特定的输入、操作和预期结果，但不会成为测试代码
- 延期项目是明确的，不会被隐藏为虚假的确定性
- 如果包含高级技术设计部分，则它使用正确的工作媒介，携带非规定性框架，并且不包含实现代码（无导入、精确签名或特定于框架的语法）
- 每个单元的技术设计字段（如果存在）是简洁且有方向性的，而不是复制粘贴就绪的

如果计划源自需求文档，请重新阅读该文档并验证：
- 所选择的方法仍然符合产品意图
- 保留范围边界和成功标准
- 阻塞问题要么被解决，要么被明确假设，要么被发送回`spec:brainstorm`
- 原始文档的每个部分都在计划中得到解决 - 扫描每个部分以确认没有任何内容被悄悄丢弃

#### 5.2 编写计划文件

**必需：在提供任何选项之前将计划文件写入磁盘。**使用写入工具将完整计划保存到：
```text
docs/plans/YYYY-MM-DD-NNN-<type>-<descriptive-name>-plan.md
```
确认：
```text
Plan written to docs/plans/[filename]
```
**管道模式：** 如果从自动化工作流程（例如 LFG、SLFG 或任何 `disable-model-invocation` 上下文中调用），请跳过交互式问题。自动做出所需的选择并继续编写计划。

#### 5.3 置信度检查和深化

编写计划文件后，自动评估计划是否需要加强。此阶段的运行无需请求用户批准。用户可以看到正在加强的内容，但不需要做出决定。

`document-review` 和这个置信度检查是不同的：
- 当文档需要清晰、简化、完整性或范围控制时，使用 `document-review` 技能
- 当计划结构合理但仍需要更坚实的基础时，这种信心检查会加强理由、排序、风险处理和全系统思维

**管道模式：** 此阶段使用下面描述的相同门逻辑以管道/禁用模型调用模式运行。无需用户交互。

##### 5.3.1 对计划深度和主题风险进行分类

从文档中确定计划深度：
- **轻量级** - 小、有界、低歧义，通常 2-4 个实现单元
- **标准** - 中等复杂性，一些技术决策，通常 3-6 个单元
- **深度** - 跨领域、高风险或具有战略重要性的工作，通常为 4-8 个单元或分阶段交付

建立风险概况。将这些视为高风险信号：
- 身份验证、授权或安全敏感行为
- 付款、账单或资金流
- 数据迁移、回填或持久数据更改
- 外部 API 或第三方集成
- 隐私、合规性或用户数据处理
- 跨接口奇偶校验或多表面行为
- 重大的部署、监控或运营问题##### 5.3.2 Gate：决定是否深化

- **轻量级**计划通常不需要深化，除非它们是高风险的
- 当一个或多个重要部分看起来仍然很薄弱时，**标准**计划通常会受益
- **深度**或高风险计划通常受益于有针对性的第二遍
- **薄局部接地覆盖：** 如果阶段 1.2 因局部模式薄（少于 3 个直接示例或相邻域匹配）而触发外部研究，则无论计划看起来如何接地，始终继续评分。当计划建立在不熟悉的领域时，有关系统行为的主张更有可能是假设，而不是经过验证的事实。得分传球很便宜——如果计划确实可靠，得分什么也找不到并很快退出

如果该计划已经显得足够接地气并且薄接地覆盖不适用，则报告“置信度检查已通过 - 没有部分需要加强”并继续到阶段 5.4。

##### 5.3.3 分数置信度差距

使用检查表优先、风险加权的评分方式。

对于每个部分，计算：
- **触发计数** - 适用的清单问题数量
- **风险奖励** - 如果主题是高风险且本节与该风险密切相关，则加 1
- **关键部分奖励** - 为 `Standard` 或 `Deep` 计划中的 `Key Technical Decisions`、`Implementation Units`、`System-Wide Impact`、`Risks & Dependencies` 或 `Open Questions` 添加 1

如果满足以下条件，则将节视为候选节：
- 达到 **2+ 总分**，或
- 在高风险领域达到**1+点**，并且该部分非常重要

仅选择按分数排名最高的 **2-5** 部分。如果深化轻量级计划（高风险例外），则上限为 **1-2** 部分。如果计划已有 `deepened:` 日期：
- 如果分数具有可比性，则优先选择尚未大幅强化的部分
- 只有当它的分数仍然明显高于其他部分时，才重新访问已经加深的部分

**部分清单：**

**需求跟踪**
- 要求模糊或与实施单位脱节
- 成功标准缺失或未反映在下游
——单位未明确推进追溯要求
- 原产地要求没有明确延续

**背景与研究/来源与参考文献**
- 相关的回购模式被命名但从未在决策或实施单元中使用
- 引用的经验或参考文献不会对计划产生实质性影响
- 高风险工作缺乏适当的外部或内部接地
- 研究是通用的，而不是与此存储库或此计划相关

**关键技术决策**
- 做出的决定没有任何理由
- 基本原理没有解释权衡或被拒绝的替代方案
- 该决策与范围、需求或原始上下文无关
- 存在明显的设计分叉，但该计划从未解决为什么一条路径获胜的原因

**开放问题**
- 产品阻碍因素被隐藏为假设
- 规划问题被错误地推迟到实施
- 已解决的问题在回购背景、研究或来源决策中没有明确的基础
- 推迟的项目太模糊，以后没有用处

**高级技术设计（如果存在）**
- 草图使用了错误的作品媒介
- 草图包含实现代码而不是伪代码
- 非规定性框架缺失或薄弱
- 草图与关键技术决策或实施单位没有联系**高级技术设计（缺席时）** *（仅限标准或深度计划）*
- 工作涉及 DSL 设计、API 表面设计、多组件集成、复杂数据流或状态密集的生命周期
- 通过视觉或伪代码表示更容易验证关键技术决策
- 实施单元的方法部分很薄弱，更高级别的技术设计将提供背景

**实施单位**
- 依赖顺序不明确或可能错误
- 文件路径或测试文件路径在应该明确的地方丢失
- 单位太大、太模糊或被分解为微步骤
- 方法注释很薄或者没有指定要遵循的模式
- 测试场景模糊（不指定输入和预期结果），跳过适用的类别（例如，具有故障模式的单元没有错误路径，跨层单元没有集成场景），或者与单元的复杂性不成比例
- 验证结果含糊不清或未表达为可观察的结果

**全系统影响**
- 受影响的接口、回调、中间件、入口点或奇偶校验表面丢失
- 故障传播尚未得到充分探索
- 不存在相关的状态生命周期、缓存或数据完整性风险
- 跨层工作的集成覆盖率较弱

**风险和依赖性/文档/操作说明**
- 列出风险但未采取缓解措施
- 在必要时缺少推出、监控、迁移或支持影响
- 外部依赖性假设薄弱或未说明
- 在明显适用的地方不存在安全、隐私、性能或数据风险使用计划自己的`Context & Research`和`Sources & References`作为证据。如果这些部分引用的模式、学习或风险从不影响决策、实施单元或验证，请将其视为置信差距。

##### 5.3.4 报告和发送有针对性的研究

在派遣特工之前，报告正在加强哪些部分以及原因：
```text
Strengthening [section names] — [brief reason for each, e.g., "decision rationale is thin", "cross-boundary effects aren't mapped"]
```
对于每个选定的部分，选择最小的有用代理集。 **不要**运行每个代理。 **每部分最多使用 1-3 个药剂**，通常总共不超过 **8 个药剂**。

在任务调用中使用完全限定的代理名称。

**确定性部分到代理的映射：**

**需求跟踪/开放问题分类**
- `spec-first:workflow:spec-flow-analyzer` 用于丢失用户流、边缘情况和切换间隙
- `spec-first:research:repo-research-analyst`（范围：`architecture, patterns`）用于基于回购的模式、约定和实施现实检查

**背景和研究/来源和参考文献的差距**
- `spec-first:research:learnings-researcher` 机构知识和过去解决的问题
- `spec-first:research:framework-docs-researcher` 用于官方框架或库行为
- `spec-first:research:best-practices-researcher`了解当前的外部模式和行业指导
- 仅当历史原理或现有技术严重缺失时添加`spec-first:research:git-history-analyzer`

**关键技术决策**
- `spec-first:review:architecture-strategist` 用于设计完整性、边界和架构权衡
- 当决策需要回购证据之外的外部依据时，添加 `spec-first:research:framework-docs-researcher` 或 `spec-first:research:best-practices-researcher`**高级技术设计**
- `spec-first:review:architecture-strategist` 用于验证技术设计是否准确地代表了预期方法并识别差距
- `spec-first:research:repo-research-analyst`（范围：`architecture, patterns`）将技术设计扎根于现有的回购模式和惯例中
- 当技术设计涉及 DSL、API 表面或受益于外部验证的模式时添加 `spec-first:research:best-practices-researcher`

**实施单位/验证**
- `spec-first:research:repo-research-analyst`（范围：`patterns`）用于具体文件目标、要遵循的模式以及特定于存储库的排序线索
- `spec-first:review:pattern-recognition-specialist` 的一致性、重复风险以及与现有模式的一致性
- 当排序取决于用户流程或切换完整性时添加 `spec-first:workflow:spec-flow-analyzer`

**全系统影响**
- `spec-first:review:architecture-strategist` 用于跨界效果、界面表面和建筑连锁影响
- 添加与风险匹配的特定专家：
  - `spec-first:review:performance-oracle` 用于可扩展性、延迟、吞吐量和资源风险分析
  - `spec-first:review:security-sentinel` 用于身份验证、验证、漏洞利用表面和安全边界审查
  - `spec-first:review:data-integrity-guardian` 用于迁移、持久状态安全性、一致性和数据生命周期风险**风险和依赖性/操作说明**
- 使用与实际风险相匹配的专家：
  - `spec-first:review:security-sentinel` 用于安全、身份验证、隐私和利用风险
  - `spec-first:review:data-integrity-guardian` 用于持久数据安全、约束和事务边界
  - `spec-first:review:data-migration-expert` 用于迁移现实性、回填和生产数据转换风险
  - `spec-first:review:deployment-verification-agent` 用于推出清单、回滚计划和启动验证
  - `spec-first:review:performance-oracle` 解决容量、延迟和扩展问题

**代理提示形状：**

对于每个选定的部分，传递：
- 当代理支持范围调用时，上面映射中的范围前缀
- 简短的计划摘要
- 确切的部分文本
- 为什么选择该部分，包括触发哪些清单触发器
- 计划深度和风险状况
- 要回答的具体问题

指示代理返回：
- 改变规划质量的发现
- 更有力的理由、排序、验证、风险处理或参考
- 没有实现代码
- 没有 shell 命令

##### 5.3.5 选择研究执行模式

使用可行的最轻模式：

- **直接模式** - 默认。当所选部分集较小并且家长可以安全地内联读取代理输出时使用。
- **工件支持模式** - 仅当所选研究范围足够大以至于内联返回会产生不必要的上下文压力时才使用。证明工件支持模式合理的信号：
- 超过 5 个代理可能会返回有意义的发现
- 所选部分摘录足够长，在多个代理输出中重复它们会很浪费
- 该主题风险较高，可能会吸引大量来源支持的分析

如果没有明确保证工件支持模式，请保持直接模式。

工件支持模式使用 `.context/spec-first/spec-plan/deepen/` 下的每次运行暂存目录。

##### 5.3.6 进行有针对性的研究

使用上面选择的执行模式并行启动选定的代理。如果当前平台不支持并行调度，请改为按顺序运行它们。

首先优先考虑本地回购和机构证据。仅当无法从回购上下文或已引用的来源负责任地缩小差距时，才使用外部研究。

如果可以通过更仔细地阅读原始文档来改进所选部分，请在派遣外部代理之前执行此操作。

**直接模式：** 让每个选定的代理将其结果直接返回给父级。保持返回有效载荷的重点：仅最强的发现、重要的证据或来源、发现所暗示的具体规划改进。

**工件支持模式：** 对于每个选定的代理，指示它在暂存目录中写入一个紧凑的工件文件，并仅返回一个简短的完成摘要。每个工件应包含：目标部分、选择原因、3-7 个发现、来源支持的基本原理、每个发现隐含的具体计划变更。没有实现代码，没有 shell 命令。

如果工件丢失或明显畸形，请重新运行该代理或回退到该部分的直接模式推理。如果代理输出冲突：
- 与一般建议相比，更喜欢基于回购和起源的证据
- 当冲突与库行为有关时，优先选择官方框架文档而不是次要最佳实践摘要
- 如果仍然存在真正的权衡，请将其明确记录在计划中

##### 5.3.7 综合和更新计划

仅加强选定的部分。保持计划的连贯性并保持其整体结构。

允许的更改：
- 澄清或强化决策理由
- 收紧追踪或起源保真度要求
- 当排序较弱时重新排序或拆分实施单元
- 添加缺失的模式引用、文件/测试路径或验证结果
- 在合理的情况下扩大全系统的影响、风险或推出处理
- 当证据支持更改时，重新分类 `Resolved During Planning` 和 `Deferred to Implementation` 之间的未决问题
- 当工作需要且当前代表性较弱时，加强、替换或添加高级技术设计部分
- 加强或增加单位方法不明显的单位技术设计领域
- 当计划得到实质性改进时，在frontmatter中添加或更新`deepened: YYYY-MM-DD`

**不要**：
- 添加实现代码 - 无需导入、精确的方法签名或特定于框架的语法。允许使用伪代码草图和 DSL 语法
- 添加 git 命令、提交编排或精确的测试命令配方
- 在各处添加通用 `Research Insights` 小节
- 从头开始重写整个计划
- 发明新的产品要求、范围变更或成功标准，但未明确提出如果研究揭示了产品层面的模糊性，应该改变行为或范围：
- 不要在这里默默决定
- 将其记录在`Open Questions`下
- Recommend `spec:brainstorm` if the gap is truly product-defining

##### 5.3.8 最终检查和清理

在继续进行后生成选项之前：
- 确认计划在特定方面更强大，而不仅仅是更长
- 确认规划边界完好无损
- 当原始文档存在时，确认保留原始决策

如果使用工件支持模式：
- 计划安全更新后清理临时暂存目录
- 如果清理在当前平台上不可行，请记下工件残留的位置

#### 5.4 生成后选项

**管道模式：** 如果从自动化工作流程（例如 LFG 或任何 `disable-model-invocation` 上下文中调用），请跳过下面的交互式菜单并立即将控制权返回给调用者。计划文件已经写入并且置信度检查已经运行 - 调用者（例如 lfg）确定下一步。

置信度检查完成（或跳过）后，使用平台的阻止问题工具（如果可用）呈现选项（请参阅交互方法）。否则，在聊天中显示编号选项并等待用户回复后再继续。

**问题：**“计划已在 `docs/plans/YYYY-MM-DD-NNN-<type>-<name>-plan.md` 准备好。接下来您想做什么？”

**选项排序取决于计划特征。** 当满足以下任何条件时，领导进行文档审查：- **深度**计划
- 存在高风险信号
- 置信度检查加深了 3+ 个部分
- **标准**计划，其中第 1.2 阶段由于局部基础薄弱（少于 3 个直接示例或相邻域匹配）而触发了外部研究 - 当计划建立在不熟悉的领域时，对抗性审查者的假设浮出水面，捕获了结构评分无法验证的有关系统行为的事实主张

包括解释原因的建议：

“该计划具有[重大架构决策/高风险安全问题/跨领域影响/关键领域的局部基础薄弱]。其敌对审查者将在实施之前对前提和决策进行压力测试。”

**建议进行文档审查时的选项：**
1. **运行 `document-review` 技能** - 通过结构化文档审查对前提和决策进行压力测试（推荐）
2. **在编辑器中打开计划** - 打开计划文件进行审查
3. **分享到证明** - 上传计划以供协作审查和共享
4. **开始`/spec:work`** - 在当前环境中开始实施此计划
5. **在另一个会话中启动 `/spec:work` - 当当前平台支持时，在单独的代理会话中开始实施
6. **创建问题** - 在配置的跟踪器中创建问题**标准或轻量级计划的选项：**
1. **在编辑器中打开计划** - 打开计划文件进行审查
2. **运行`document-review`技能** - 通过结构化文档审查改进计划
3. **分享到证明** - 上传计划以供协作审查和共享
4. **开始`/spec:work`** - 在当前环境中开始实施此计划
5. **在另一个会话中启动 `/spec:work` - 当当前平台支持时，在单独的代理会话中开始实施
6. **创建问题** - 在配置的跟踪器中创建问题根据选择：
- **在编辑器中打开计划** → 使用当前平台的文件打开或编辑器机制打开 `docs/plans/<plan_filename>.md`（例如，macOS 上的 `open`、Linux 上的 `xdg-open` 或 IDE 的文件打开 API）
- **`document-review`技能** → 使用计划路径加载`document-review`技能
- **分享到证明** → 上传计划：
  ```bash
  CONTENT=$(cat docs/plans/<plan_filename>.md)
  TITLE="Plan: <plan title from frontmatter>"
  RESPONSE=$(curl -s -X POST https://www.proofeditor.ai/share/markdown \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg title "$TITLE" --arg markdown "$CONTENT" --arg by "ai:compound" '{title: $title, markdown: $markdown, by: $by}')")
  PROOF_URL=$(echo "$RESPONSE" | jq -r '.tokenUrl')
  ```
  Display `在校样中查看和协作： <PROOF_URL>` if successful, then return to the options
- **`/spec:work`** → Call `/spec:work` with the plan path
- **`/spec:work` in another session** → If the current platform supports launching a separate agent session, start `/spec:work` with the plan path there. Otherwise, explain the limitation briefly and offer to run `/spec:work` in the current session instead.
- **Create Issue** → Follow the Issue Creation section below
- **Other** → Accept free text for revisions and loop back to options

## Issue Creation

When the user selects "Create Issue", detect their project tracker from `AGENTS.md` or, if needed for compatibility, `CLAUDE.md`:

1. Look for `project_tracker： github` or `project_tracker：线性`
2. If GitHub:

   ```bash
   gh issue create --title "<type>: <title>" --body-file <plan_path>
   ```

3. If Linear:

   ```bash
   linear issue create --title "<title>" --description "$(cat <plan_path>)"
   ```4. 如果没有配置Tracker：
   - 使用平台的阻止问题工具（如果可用）询问他们使用哪个跟踪器（请参阅交互方法）
   - 建议将跟踪器添加到 `AGENTS.md` 以供将来运行

创建问题后：
- 显示问题 URL
- 询问是否继续`/spec:work`

永远不要编码！研究、决定并编写计划。
