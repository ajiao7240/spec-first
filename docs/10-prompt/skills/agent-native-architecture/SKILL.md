---
name: agent-native-architecture
description: 构建让代理成为一等公民的应用程序。在设计自主代理、创建 MCP 工具、实现自我修改系统或构建应用程序时使用此技能，其中功能是由代理在循环中运行所实现的结果。
---
<为什么现在>
## 为什么现在

软件代理现在可以可靠地工作。 Claude Code 证明，能够访问 bash 和文件工具的法学硕士可以循环操作直到实现目标，可以自主完成复杂的多步骤任务。

令人惊讶的发现：**一个真正好的编码代理实际上是一个非常好的通用代理。** 让 Claude Code 重构代码库的相同架构可以让代理组织您的文件、管理您的阅读列表或自动化您的工作流程。

Claude Code SDK 可以实现这一点。您可以构建应用程序，其中的功能不是您编写的代码，而是您描述的结果，由具有工具的代理实现，循环运行直到达到结果。

这开辟了一个新领域：以 Claude Code 的方式工作的软件，其应用范围远远超出了编码范围。
</为什么现在>

<核心原则>
## 核心原则

### 1. 奇偶校验

**无论用户可以通过 UI 做什么，代理都应该能够通过工具来实现。**

这是基本原则。没有它，其他一切都不重要。

想象一下，您构建了一个具有漂亮界面的笔记应用程序，用于创建、组织和标记笔记。用户询问客服人员：“创建一个笔记来总结我的会议并将其标记为紧急。”

如果您构建了用于创建笔记的 UI，但没有代理执行相同操作的功能，则代理会被卡住。它可能会道歉或提出澄清问题，但它无济于事——即使这个动作对于使用界面的人来说是微不足道的。

**修复：** 确保代理拥有可以完成 UI 可以完成的任何操作的工具（或工具组合）。

这并不是要创建 UI 按钮到工具的 1:1 映射。这是为了确保代理能够**实现相同的结果**。有时这是一个单一的工具（`create_note`）。有时它会组合基元（`write_file`到具有正确格式的注释目录）。

**纪律：** 添加任何 UI 功能时，询问：代理能否实现此结果？如果没有，请添加必要的工具或基元。

能力图有助于：

|用户操作 |代理如何实现这一目标|
|----------|------------------------|
|创建笔记 | `write_file` 到笔记目录，或 `create_note` 工具 |
|将注释标记为紧急 | `update_file`元数据，或`tag_note`工具|
|搜索笔记 | `search_files` 或 `search_notes` 工具 |
|删除笔记 | `delete_file` 或 `delete_note` 工具 |

**测试：** 选择用户可以在您的 UI 中执行的任何操作。向代理描述一下。能达到这样的结果吗？

---

### 2. 粒度

**更喜欢原子原语。特征是由循环运行的代理实现的结果。**

工具是一种原始功能：读取文件、写入文件、运行 bash 命令、存储记录、发送通知。

**功能**不是您编写的函数。这是您在提示中描述的结果，由拥有工具并循环运行直到达到结果的代理实现。

**粒度较小（限制代理）：**
```
Tool: classify_and_organize_files(files)
→ You wrote the decision logic
→ Agent executes your code
→ To change behavior, you refactor
```
**更细粒度（授权代理）：**
```
Tools: read_file, write_file, move_file, list_directory, bash
Prompt: "Organize the user's downloads folder. Analyze each file,
        determine appropriate locations based on content and recency,
        and move them there."
Agent: Operates in a loop—reads files, makes judgments, moves things,
       checks results—until the folder is organized.
→ Agent makes the decisions
→ To change behavior, you edit the prompt
```
**关键转变：** 智能体通过判断来追求结果，而不是执行精心设计的序列。它可能会遇到意外的文件类型、调整其方法或提出澄清问题。循环继续，直到达到结果。

您的工具越原子，代理可以更灵活地使用它们。如果您将决策逻辑捆绑到工具中，那么您就将判断移回了代码中。

**测试：** 要更改功能的行为方式，您是否编辑散文或重构代码？

---

### 3.可组合性

**使用原子工具和奇偶校验，您只需编写新提示即可创建新功能。**

这是前两个原则的回报。当您的工具是原子的并且代理可以执行用户可以执行的任何操作时，新功能只是新提示。

想要“每周回顾”功能来总结活动并建议优先事项吗？这是一个提示：
```
"Review files modified this week. Summarize key changes. Based on
incomplete items and approaching deadlines, suggest three priorities
for next week."
```
代理使用 `list_files`、`read_file` 及其判断来完成此操作。您没有编写每周审查代码。您描述了一个结果，代理将循环运行直到实现该结果。

**这适用于开发人员和用户。** 您可以通过添加提示来发布新功能。用户可以通过修改提示或创建自己的提示来自定义行为。 “当我说‘归档此文件’时，请始终将其移至我的操作文件夹并将其标记为紧急”成为扩展应用程序的用户级提示。

**约束：**只有当工具足够原子化，能够以您意想不到的方式组合，并且代理与用户具有同等地位时，这才有效。如果工具编码太多逻辑，或者代理无法访问关键功能，组合就会崩溃。

**测试：** 你能否通过编写新的提示部分来添加新功能，而不添加新代码？

---

### 4. 新兴能力

**代理可以完成您未明确设计的任务。**

当工具是原子的、奇偶性得到维护并且提示是可组合的时，用户将向代理询问您从未预料到的事情。通常，代理人可以解决这个问题。

*“将我的会议记录与我的任务列表交叉引用，并告诉我我已承诺但尚未安排的内容。”*

您没有构建“承诺跟踪器”功能。但是，如果智能体能够阅读笔记、阅读任务并对它们进行推理（循环操作直到得到答案），它就可以实现这一目标。

**这揭示了潜在需求。** 您无需猜测用户想要什么功能，而是观察他们要求代理做什么。当模式出现时，您可以使用特定于领域的工具或专用提示来优化它们。但你不必预见它们——你发现了它们。

**飞轮：**
1. 使用原子工具和奇偶校验进行构建
2. 用户询问你没有预料到的事情
3. 代理编写工具来完成这些任务（或者失败，暴露差距）
4. 您观察所请求内容的模式
5. 添加领域工具或提示，使常用模式变得高效
6. 重复

这会改变您构建产品的方式。您不会试图预先想象每个功能。您正在创建一个有能力的基础并从出现的情况中学习。

**测试：** 向代理提供与您的域相关的开放式请求。它能找出一个合理的方法，循环运行直到成功吗？如果它只是说“我没有这方面的功能”，那么您的架构就太受限了。

---

### 5. 随着时间的推移不断改进

**代理本机应用程序通过积累上下文和及时改进而变得更好。**

与传统软件不同，代理本机应用程序无需交付代码即可改进：

**累积上下文：**代理可以跨会话维护状态——存在什么、用户做了什么、什么有效、什么无效。代理读取和更新的 `context.md` 文件是第一层。更复杂的方法涉及结构化记忆和学习偏好。

**多层次及时细化：**
- **开发人员级别：** 您发布更新的提示，更改所有用户的代理行为
- **用户级别：** 用户为其工作流程自定义提示
- **代理级别：**代理根据反馈修改自己的提示（高级）

**自我修改（高级）：** 可以编辑自己的提示甚至自己的代码的代理。对于生产用例，请考虑添加安全栏——批准门、回滚自动检查点、运行状况检查。这就是事情的发展方向。改进机制仍在探索中。上下文和及时改进已得到证实。自我改造正在兴起。显而易见的是：该架构支持以传统软件无法做到的方式变得更好。

**测试：** 即使没有更改代码，应用程序在使用一个月后是否比第一天运行得更好？
</核心原则>

<摄入量>
## 您需要代理本机架构的哪些方面的帮助？

1. **设计架构** - 从头开始规划一个新的代理原生系统
2. **文件和工作空间** - 使用文件作为通用界面，共享工作空间模式
3. **工具设计** - 构建原始工具、动态能力发现、CRUD完整性
4. **领域工具** - 知道何时添加领域工具而不是保留原语
5. **执行模式** - 完成信号、部分完成、上下文限制
6. **系统提示** - 在提示中定义座席行为，判断标准
7. **上下文注入** - 将运行时应用程序状态注入代理提示中
8. **操作对等** - 确保代理可以做用户可以做的所有事情
9. **自我修改** - 使智能体能够安全地自我进化
10. **产品设计** - 渐进披露、潜在需求、审批模式
11. **移动模式** - iOS 存储、后台执行、检查点/恢复
12. **测试** - 测试代理本机应用程序的功能和奇偶校验
13. **重构** - 使现有代码更加代理原生

**等待回复后再继续。**
</摄入量>

<路由>
|回应 |行动|
|----------|--------|
| 1、“设计”、“建筑”、“规划” |阅读 `references/architecture-patterns.md`，然后应用下面的架构清单 |
| 2、“文件”、“工作空间”、“文件系统”|阅读 `references/files-universal-interface.md` 和 `references/shared-workspace-architecture.md` |
| 3、“工具”、“mcp”、“原始”、“增删改查”|阅读 `references/mcp-tool-design.md` |
| 4、“域名工具”、“何时添加” |阅读`references/from-primitives-to-domain-tools.md` |
| 5、“执行”、“完成”、“循环”|阅读`references/agent-execution-patterns.md` |
| 6、“提示”、“系统提示”、“行为”|阅读`references/system-prompt-design.md` |
| 7、“上下文”、“注入”、“运行时”、“动态”|阅读 `references/dynamic-context-injection.md` |
| 8、“比价”、“ui操作”、“能力图” |阅读`references/action-parity-discipline.md` |
| 9、“自我修改”、“进化”、“git”|阅读`references/self-modification.md` |
| 10、“产品”、“进步”、“认可”、“潜在需求”|阅读`references/product-implications.md` |
| 11、“移动”、“ios”、“android”、“后台”、“检查点”|阅读`references/mobile-patterns.md` |
| 12、“测试”、“测试”、“验证”、“验证”|阅读`references/agent-native-testing.md` |
| 13、“审查”、“重构”、“现有”|阅读`references/refactoring-to-prompt-native.md` |

**阅读参考资料后，将这些模式应用到用户的特定上下文中。**
</路由>

<架构检查表>
## 架构审查清单

在设计原生代理系统时，请在**实施之前验证这些**：

### 核心原则
- [ ] **奇偶校验：** 每个UI操作都有对应的代理能力
- [ ] **粒度：** 工具是原语；特征是即时定义的结果
- [ ] **可组合性：** 可以仅通过提示添加新功能
- [ ] **紧急能力：** 代理可以处理您域中的开放式请求### 工具设计
- [ ] **动态与静态：** 对于代理应具有完全访问权限的外部 API，请使用动态功能发现
- [ ] **CRUD 完整性：** 每个实体都有创建、读取、更新和删除
- [ ] **原语而非工作流程：**工具启用功能，不编码业务逻辑
- [ ] **API 作为验证器：** 在 API 验证时使用 `z.string()` 输入，而不是 `z.enum()`

### 文件和工作区
- [ ] **共享工作空间：** 代理和用户在同一数据空间中工作
- [ ] **context.md 模式：** 代理读取/更新上下文文件以积累知识
- [ ] **文件组织：** 具有一致命名的实体范围目录

### 代理执行
- [ ] **完成信号：** 代理具有显式的 `complete_task` 工具（不是启发式检测）
- [ ] **部分完成：** 多步骤任务跟踪恢复进度
- [ ] **上下文限制：** 从一开始就为有界上下文而设计

### 上下文注入
- [ ] **可用资源：**系统提示包括存在的资源（文件、数据、类型）
- [ ] **可用功能：** 带有用户词汇的系统提示文档工具
- [ ] **动态上下文：** 长时间会话的上下文刷新（或提供 `refresh_context` 工具）

### 用户界面集成
- [ ] **代理 → UI：** 代理更改反映在 UI 中（共享服务、文件监视或事件总线）
- [ ] **无静默操作：** 代理立即写入触发 UI 更新
- [ ] **能力发现：** 用户可以了解代理可以做什么

### 手机（如果适用）
- [ ] **检查点/恢复：** 优雅地处理 iOS 应用程序暂停
- [ ] **iCloud 存储：** iCloud 优先，具有多设备同步的本地回退功能
- [ ] **成本意识：** 模型层选择（俳句/十四行诗/作品）

**设计架构时，明确解决计划中的每个复选框。**
</架构_清单>

<快速开始>
## 快速入门：构建代理本机功能

**第 1 步：定义原子工具**
```typescript
const tools = [
  tool("read_file", "Read any file", { path: z.string() }, ...),
  tool("write_file", "Write any file", { path: z.string(), content: z.string() }, ...),
  tool("list_files", "List directory", { path: z.string() }, ...),
  tool("complete_task", "Signal task completion", { summary: z.string() }, ...),
];
```
**第二步：在系统提示符中写入行为**
```markdown
## Your Responsibilities
When asked to organize content, you should:
1. Read existing files to understand the structure
2. Analyze what organization makes sense
3. Create/move files using your tools
4. Use your judgment about layout and formatting
5. Call complete_task when you're done

You decide the structure. Make it good.
```
**第3步：让代理循环工作**
```typescript
const result = await agent.run({
  prompt: userMessage,
  tools: tools,
  systemPrompt: systemPrompt,
  // Agent loops until it calls complete_task
});
```
</快速开始>

<参考索引>
## 参考文件

`references/`中的所有参考文献：

**核心模式：**
- `references/architecture-patterns.md` - 事件驱动、统一编排器、代理到 UI
- `references/files-universal-interface.md` - 为什么文件、组织模式、context.md
- `references/mcp-tool-design.md` - 工具设计、动态能力发现、CRUD
- `references/from-primitives-to-domain-tools.md` - 何时添加域工具，升级到代码
- `references/agent-execution-patterns.md` - 完成信号、部分完成、上下文限制
- `references/system-prompt-design.md` - 作为提示、判断标准的功能

**特工本土学科：**
- `references/dynamic-context-injection.md` - 运行时上下文，注入什么
- `references/action-parity-discipline.md` - 能力映射、奇偶校验工作流程
- `references/shared-workspace-architecture.md` - 共享数据空间，UI集成
- `references/product-implications.md` - 渐进披露、潜在需求、批准
- `references/agent-native-testing.md` - 测试结果、奇偶校验测试

**特定于平台：**
- `references/mobile-patterns.md` - iOS 存储、检查点/恢复、成本意识
- `references/self-modification.md` - 基于Git的进化，护栏
- `references/refactoring-to-prompt-native.md` - 迁移现有代码
</参考索引>

<反模式>
## 反模式

### 不完全代理原生的常见方法

这些不一定是错误的——它们可能适合您的用例。但值得注意的是它们与本文档描述的架构不同。

**代理作为路由器** — 代理找出用户想要什么，然后调用正确的函数。特工的情报用于制定路线，而不是采取行动。这可行，但您使用的只是代理功能的一小部分。

**构建应用程序，然后添加代理** - 您以传统方式（作为代码）构建功能，然后将它们公开给代理。代理只能执行您的功能已经执行的操作。你不会获得紧急能力。

**请求/响应思维** - 代理获取输入，做一件事，返回输出。这错过了循环：代理获得要实现的结果，一直运行直到完成，并在此过程中处理意外情况。

**防御性工具设计** — 您过度限制工具输入，因为您习惯于防御性编程。严格的枚举，每一层的验证。这是安全的，但它可以防止代理执行您未预料到的操作。

**代码中的快乐路径，代理只需执行** - 传统软件处理代码中的边缘情况 - 您编写 X 出错时发生的情况的逻辑。代理原生让代理能够通过判断来处理边缘情况。如果您的代码处理所有边缘情况，则代理只是调用者。

---

### 特定反模式

**大罪：代理执行您的代码而不是弄清楚事情**
```typescript
// WRONG - You wrote the workflow, agent just executes it
tool("process_feedback", async ({ message }) => {
  const category = categorize(message);      // Your code decides
  const priority = calculatePriority(message); // Your code decides
  await store(message, category, priority);   // Your code orchestrates
  if (priority > 3) await notify();           // Your code decides
});

// RIGHT - Agent figures out how to process feedback
tools: store_item, send_message  // Primitives
prompt: "Rate importance 1-5 based on actionability, store feedback, notify if >= 4"
```
**工作流程型工具** — `analyze_and_organize` 将判断捆绑到工具中。将其分解为基元并让代理组合它们。

**上下文匮乏** - 代理不知道应用程序中存在哪些资源。
```
User: "Write something about Catherine the Great in my feed"
Agent: "What feed? I don't understand what system you're referring to."
```
修复：将可用资源、功能和词汇注入系统提示中。

**孤立 UI 操作** — 用户可以通过 UI 执行代理无法完成的操作。修复：保持奇偶校验。

**静默操作** — 代理更改状态，但 UI 不更新。修复：使用具有反应式绑定或文件系统观察的共享数据存储。

**启发式完成检测** - 通过启发式检测代理完成情况（无需工具调用的连续迭代，检查预期的输出文件）。这是脆弱的。修复：要求代理通过 `complete_task` 工具明确发出完成信号。

**动态 API 的静态工具映射** — 当 `discover` + `access` 模式提供更大灵活性时，为 50 个 API 端点构建 50 个工具。
```typescript
// WRONG - Every API type needs a hardcoded tool
tool("read_steps", ...)
tool("read_heart_rate", ...)
tool("read_sleep", ...)
// When glucose tracking is added... code change required

// RIGHT - Dynamic capability discovery
tool("list_available_types", ...)  // Discover what's available
tool("read_health_data", { dataType: z.string() }, ...)  // Access any type
```
**不完整的 CRUD** — 代理可以创建，但不能更新或删除。
```typescript
// User: "Delete that journal entry"
// Agent: "I don't have a tool for that"
tool("create_journal_entry", ...)  // Missing: update, delete
```
修复：每个实体都需要完整的 CRUD。

**沙盒隔离** - 代理在与用户不同的数据空间中工作。
```
Documents/
├── user_files/        ← User's space
└── agent_output/      ← Agent's space (isolated)
```
修复：使用共享工作区，两者都操作相同的文件。

**无缘无故的关门** — 域工具是做某事的唯一方法，并且您无意限制访问。默认是打开的。保持原语可用，除非有特定的门控原因。

**人为能力限制** - 出于模糊的安全考虑而不是特定的风险来限制代理可以执行的操作。考虑限制能力。代理通常应该能够做用户​​能做的事情。
</反模式>

<成功标准>
## 成功标准

在以下情况下，您已构建了代理本机应用程序：

### 架构
- [ ] 代理可以实现用户可以通过 UI 实现的任何功能（奇偶校验）
- [ ] 工具是原子原语；领域工具是捷径，而不是门（粒度）
- [ ] 可以通过编写新提示来添加新功能（可组合性）
- [ ] 代理可以完成您未明确设计的任务（紧急能力）
- [ ] 改变行为意味着编辑提示，而不是重构代码

### 实施
- [ ] 系统提示包括有关应用程序状态的动态上下文
- [ ] 每个UI动作都有对应的代理工具（动作奇偶校验）
- [ ] 代理工具以用户词汇记录在系统提示中
- [ ] 代理和用户在同一数据空间（共享工作空间）中工作
- [ ] 代理操作立即反映在 UI 中
- [ ] 每个实体都有完整的 CRUD（创建、读取、更新、删除）
- [ ] 代理明确发出完成信号（无启发式检测）
- [ ] context.md 或等效的积累知识

### 产品
- [ ] 简单的请求立即生效，无需学习曲线
- [ ] 高级用户可以将系统推向意想不到的方向
- [ ] 通过观察用户要求代理做什么来了解用户想要什么
- [ ] 批准要求匹配赌注和可逆性

### 手机（如果适用）
- [ ] 检查点/恢复处理应用程序中断
- [ ] iCloud 优先存储，具有本地后备功能
- [ ] 后台执行明智地使用可用时间
- [ ] 模型层与任务复杂性相匹配

---

### 终极测试

**描述应用程序域内的代理的结果，但您没有为其构建特定功能。**

它能弄清楚如何完成它，循环运行直到成功吗？

如果是，那么您已经构建了代理原生的东西。

如果它说“我没有这方面的功能”，那么您的架构仍然受到太多限制。
</成功标准>
