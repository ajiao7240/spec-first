<概述>
从纯原语开始：bash、文件操作、基本存储。这证明了该架构的有效性并揭示了代理的实际需求。随着模式的出现，有意识地添加特定于领域的工具。本文档涵盖了何时以及如何从原语发展为领域工具，以及何时升级为优化代码。
</概述>

<start_with_primitives>
## 从纯原语开始

使用尽可能原子的工具开始每个代理本机系统：

- `read_file` / `write_file` / `list_files`
- `bash`（对于其他所有内容）
- 基本存储（`store_item` / `get_item`）
- HTTP 请求 (`fetch_url`)

**为什么从这里开始：**

1. **证明架构** - 如果它适用于原语，则您的提示正在完成其工作
2. **揭示实际需求** - 您将发现哪些领域概念很重要
3. **最大的灵活性** - 代理可以做任何事情，而不仅仅是您期望的
4. **强制提供良好的提示** - 你不能依靠工具逻辑作为拐杖

### 示例：启动原语
```typescript
// Start with just these
const tools = [
  tool("read_file", { path: z.string() }, ...),
  tool("write_file", { path: z.string(), content: z.string() }, ...),
  tool("list_files", { path: z.string() }, ...),
  tool("bash", { command: z.string() }, ...),
];

// Prompt handles the domain logic
const prompt = `
When processing feedback:
1. Read existing feedback from data/feedback.json
2. Add the new feedback with your assessment of importance (1-5)
3. Write the updated file
4. If importance >= 4, create a notification file in data/alerts/
`;
```
</start_with_primitives>

<何时添加域工具>
## 何时添加域工具

随着模式的出现，您将需要添加特定于领域的工具。这很好——但是要刻意去做。

### 词汇锚定

**在以下情况下添加域工具：** 代理需要了解域概念。

`create_note` 工具告诉代理“注释”在系统中的含义比“用这种格式将文件写入注释目录”更好。
```typescript
// Without domain tool - agent must infer structure
await agent.chat("Create a note about the meeting");
// Agent: writes to... notes/? documents/? what format?

// With domain tool - vocabulary is anchored
tool("create_note", {
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()).optional(),
}, async ({ title, content, tags }) => {
  // Tool enforces structure, agent understands "note"
});
```
### 护栏

**在以下情况下添加域工具：** 某些操作需要验证或约束，不应将其留给代理判断。
```typescript
// publish_to_feed might enforce format requirements or content policies
tool("publish_to_feed", {
  bookId: z.string(),
  content: z.string(),
  headline: z.string().max(100),  // Enforce headline length
}, async ({ bookId, content, headline }) => {
  // Validate content meets guidelines
  if (containsProhibitedContent(content)) {
    return { text: "Content doesn't meet guidelines", isError: true };
  }
  // Enforce proper structure
  await feedService.publish({ bookId, content, headline, publishedAt: new Date() });
});
```
### 效率

**在以下情况下添加域工具：** 常见操作将需要许多原始调用。
```typescript
// Primitive approach: multiple calls
await agent.chat("Get book details");
// Agent: read library.json, parse, find book, read full_text.txt, read introduction.md...

// Domain tool: one call for common operation
tool("get_book_with_content", { bookId: z.string() }, async ({ bookId }) => {
  const book = await library.getBook(bookId);
  const fullText = await readFile(`Research/${bookId}/full_text.txt`);
  const intro = await readFile(`Research/${bookId}/introduction.md`);
  return { text: JSON.stringify({ book, fullText, intro }) };
});
```
</when_to_add_domain_tools>

<规则>
## 领域工具的规则

**领域工具应该代表从用户角度来看的一种概念性操作。**

它们可以包括机械验证，但**关于做什么或是否做的判断属于提示**。

### 错误：捆绑判断
```typescript
// WRONG - analyze_and_publish bundles judgment into the tool
tool("analyze_and_publish", async ({ input }) => {
  const analysis = analyzeContent(input);      // Tool decides how to analyze
  const shouldPublish = analysis.score > 0.7;  // Tool decides whether to publish
  if (shouldPublish) {
    await publish(analysis.summary);            // Tool decides what to publish
  }
});
```
### 右：一个动作，代理决定
```typescript
// RIGHT - separate tools, agent decides
tool("analyze_content", { content: z.string() }, ...);  // Returns analysis
tool("publish", { content: z.string() }, ...);          // Publishes what agent provides

// Prompt: "Analyze the content. If it's high quality, publish a summary."
// Agent decides what "high quality" means and what summary to write.
```
### 测试

问：“谁在这里做决定？”

- 如果答案是“工具代码”→你已经编码了判断，重构
- 如果答案是“根据提示进行代理”→ 好
</规则>

<保持基元可用>
## 保持原语可用

**领域工具是捷径，而不是大门。**

除非有特定原因限制访问（安全性、数据完整性），否则代理仍然应该能够针对边缘情况使用底层原语。
```typescript
// Domain tool for common case
tool("create_note", { title, content }, ...);

// But primitives still available for edge cases
tool("read_file", { path }, ...);
tool("write_file", { path, content }, ...);

// Agent can use create_note normally, but for weird edge case:
// "Create a note in a non-standard location with custom metadata"
// → Agent uses write_file directly
```
### 何时登机

门控（使领域工具成为唯一的方法）适用于：

- **安全性：** 用户身份验证、支付处理
- **数据完整性：** 必须保持不变量的操作
- **审核要求：** 必须以特定方式记录的操作

**默认是开放的。** 当你做某件事时，请使其成为一个有明确理由的有意识的决定。
</keep_primitives_available>

<毕业代码>
## 毕业到编码

为了性能或可靠性，某些操作需要从代理编排转向优化代码。

### 进展
```
Stage 1: Agent uses primitives in a loop
         → Flexible, proves the concept
         → Slow, potentially expensive

Stage 2: Add domain tools for common operations
         → Faster, still agent-orchestrated
         → Agent still decides when/whether to use

Stage 3: For hot paths, implement in optimized code
         → Fast, deterministic
         → Agent can still trigger, but execution is code
```
### 进展示例

**阶段 1：纯原语**
```markdown
Prompt: "When user asks for a summary, read all notes in /notes,
        analyze them, and write a summary to /summaries/{date}.md"

Agent: Calls read_file 20 times, reasons about content, writes summary
Time: 30 seconds, 50k tokens
```
**第二阶段：领域工具**
```typescript
tool("get_all_notes", {}, async () => {
  const notes = await readAllNotesFromDirectory();
  return { text: JSON.stringify(notes) };
});

// Agent still decides how to summarize, but retrieval is faster
// Time: 10 seconds, 30k tokens
```
**第三阶段：优化代码**
```typescript
tool("generate_weekly_summary", {}, async () => {
  // Entire operation in code for hot path
  const notes = await getNotes({ since: oneWeekAgo });
  const summary = await generateSummary(notes);  // Could use cheaper model
  await writeSummary(summary);
  return { text: "Summary generated" };
});

// Agent just triggers it
// Time: 2 seconds, 5k tokens
```
### 警告

**即使操作已完成编码，代理也应该能够：**

1. 触发优化操作本身
2. 对于优化路径无法处理的边缘情况，回退到基元

毕业就是效率。 **奇偶校验仍然成立。** 当您优化时，代理不会失去功能。
</毕业代码>

<决策框架>
## 决策框架

### 我应该添加域工具吗？

|问题 |如果是的话 |
|----------|--------|
|代理人是否对这个概念的含义感到困惑？ |添加词汇锚定 |
|此操作是否需要验证，代理不应决定？ |加装护栏 |
|这是常见的多步骤操作吗？ |添加以提高效率 |
|改变行为是否需要更改代码？ |改为保留提示 |

### 我应该从代码毕业吗？

|问题 |如果是的话 |
|----------|--------|
|这个操作调用得非常频繁吗？ |考虑毕业 |
|延迟很重要吗？ |考虑毕业 |
|代币成本有问题吗？ |考虑毕业 |
|您需要确定性行为吗？ |毕业到编码 |
|操作是否需要复杂的状态管理？ |毕业到编码 |

### 我应该访问吗？

|问题 |如果是的话 |
|----------|--------|
|有安全要求吗？ |适当的门 |
|此操作必须保持数据完整性吗？ |适当的门 |
|是否有审计/合规要求？ |适当的门 |
|它只是“更安全”而没有特定的风险吗？ |保持原语可用 |
</决策框架>

<例子>
## 示例

### 反馈处理的演变

**第 1 阶段：仅限基元**
```typescript
tools: [read_file, write_file, bash]
prompt: "Store feedback in data/feedback.json, notify if important"
// Agent figures out JSON structure, importance criteria, notification method
```
**第二阶段：词汇领域工具**
```typescript
tools: [
  store_feedback,      // Anchors "feedback" concept with proper structure
  send_notification,   // Anchors "notify" with correct channels
  read_file,           // Still available for edge cases
  write_file,
]
prompt: "Store feedback using store_feedback. Notify if importance >= 4."
// Agent still decides importance, but vocabulary is anchored
```
**阶段 3：分级热路径**
```typescript
tools: [
  process_feedback_batch,  // Optimized for high-volume processing
  store_feedback,          // For individual items
  send_notification,
  read_file,
  write_file,
]
// Batch processing is code, but agent can still use store_feedback for special cases
```
### 何时不添加域工具

**不要只是为了让事情变得“更干净”而添加域工具：**
```typescript
// Unnecessary - agent can compose primitives
tool("organize_files_by_date", ...)  // Just use move_file + judgment

// Unnecessary - puts decision in wrong place
tool("decide_file_importance", ...)  // This is prompt territory
```
**如果行为可能发生变化，请勿添加域工具：**
```typescript
// Bad - locked into code
tool("generate_standard_report", ...)  // What if report format evolves?

// Better - keep in prompt
prompt: "Generate a report covering X, Y, Z. Format for readability."
// Can adjust format by editing prompt
```
</例子>

<清单>
## 清单：从原语到领域工具

### 开始
- [ ] 从纯原语开始（读、写、列表、bash）
- [ ] 在提示中写入行为，而不是工具逻辑
- [ ] 让模式从实际使用中显现出来

### 添加域工具
- [ ] 明确的原因：词汇锚定、护栏或效率
- [ ] 工具代表一种概念性的动作
- [ ] 判断停留在提示中，而不是工具代码中
- [ ] 原语与领域工具一起仍然可用

### 毕业学习编程
- [ ] 已识别的热路径（频繁、延迟敏感或昂贵）
- [ ] 优化版本不会删除代理功能
- [ ] 边缘情况回退到基元仍然有效

### 门控决策
- [ ] 每个门的具体原因（安全性、完整性、审核）
- [ ] 默认为开放获取
- [ ] 盖茨是有意识的决定，而不是默认
</清单>
