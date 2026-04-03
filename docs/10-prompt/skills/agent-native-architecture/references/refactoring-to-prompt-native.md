<概述>
如何重构现有代理代码以遵循提示本机原则。目标：将行为从代码转移到提示中，并将工具简化为原语。
</概述>

<诊断>
## 诊断非提示本机代码

标志您的代理不是本地提示：

**编码工作流程的工具：**
```typescript
// RED FLAG: Tool contains business logic
tool("process_feedback", async ({ message }) => {
  const category = categorize(message);        // Logic in code
  const priority = calculatePriority(message); // Logic in code
  await store(message, category, priority);    // Orchestration in code
  if (priority > 3) await notify();            // Decision in code
});
```
**代理调用函数而不是弄清楚事情：**
```typescript
// RED FLAG: Agent is just a function caller
"Use process_feedback to handle incoming messages"
// vs.
"When feedback comes in, decide importance, store it, notify if high"
```
**对代理能力的人为限制：**
```typescript
// RED FLAG: Tool prevents agent from doing what users can do
tool("read_file", async ({ path }) => {
  if (!ALLOWED_PATHS.includes(path)) {
    throw new Error("Not allowed to read this file");
  }
  return readFile(path);
});
```
**提示指定 HOW 而不是 WHAT：**
```markdown
// RED FLAG: Micromanaging the agent
When creating a summary:
1. Use exactly 3 bullet points
2. Each bullet must be under 20 words
3. Format with em-dashes for sub-points
4. Bold the first word of each bullet
```
</诊断>

<重构工作流程>
## 逐步重构

**第 1 步：识别工作流程工具**

列出你所有的工具。标记任何：
- 具有业务逻辑（分类、计算、决定）
- 协调多个操作
- 代表代理人做出决定
- 包含条件逻辑（if/else 基于内容）

**第2步：提取基元**

对于每个工作流程工具，确定底层原语：

|工作流程工具|隐藏的原语 |
|--------------|--------------------|
| `process_feedback` | `store_item`、`send_message` |
| `generate_report` | `read_file`、`write_file` |
| `deploy_and_notify` | `git_push`、`send_message` |

**第 3 步：将行为移至提示**

从工作流程工具中获取逻辑并用自然语言表达：
```typescript
// Before (in code):
async function processFeedback(message) {
  const priority = message.includes("crash") ? 5 :
                   message.includes("bug") ? 4 : 3;
  await store(message, priority);
  if (priority >= 4) await notify();
}
```

```markdown
// After (in prompt):
## Feedback Processing

When someone shares feedback:
1. Rate importance 1-5:
   - 5: Crashes, data loss, security issues
   - 4: Bug reports with clear reproduction steps
   - 3: General suggestions, minor issues
2. Store using store_item
3. If importance >= 4, notify the team

Use your judgment. Context matters more than keywords.
```
**第 4 步：将工具简化为基元**
```typescript
// Before: 1 workflow tool
tool("process_feedback", { message, category, priority }, ...complex logic...)

// After: 2 primitive tools
tool("store_item", { key: z.string(), value: z.any() }, ...simple storage...)
tool("send_message", { channel: z.string(), content: z.string() }, ...simple send...)
```
**步骤 5：消除人为限制**
```typescript
// Before: Limited capability
tool("read_file", async ({ path }) => {
  if (!isAllowed(path)) throw new Error("Forbidden");
  return readFile(path);
});

// After: Full capability
tool("read_file", async ({ path }) => {
  return readFile(path);  // Agent can read anything
});
// Use approval gates for WRITES, not artificial limits on READS
```
**第 6 步：用结果而不是程序进行测试**

不要测试“它是否调用了正确的函数？”，而是测试“它是否达到了结果？”
```typescript
// Before: Testing procedure
expect(mockProcessFeedback).toHaveBeenCalledWith(...)

// After: Testing outcome
// Send feedback → Check it was stored with reasonable importance
// Send high-priority feedback → Check notification was sent
```
</重构_工作流程>

<之前_之后>
## 之前/之后示例

**示例 1：反馈处理**

之前：
```typescript
tool("handle_feedback", async ({ message, author }) => {
  const category = detectCategory(message);
  const priority = calculatePriority(message, category);
  const feedbackId = await db.feedback.insert({
    id: generateId(),
    author,
    message,
    category,
    priority,
    timestamp: new Date().toISOString(),
  });

  if (priority >= 4) {
    await discord.send(ALERT_CHANNEL, `High priority feedback from ${author}`);
  }

  return { feedbackId, category, priority };
});
```
后：
```typescript
// Simple storage primitive
tool("store_feedback", async ({ item }) => {
  await db.feedback.insert(item);
  return { text: `Stored feedback ${item.id}` };
});

// Simple message primitive
tool("send_message", async ({ channel, content }) => {
  await discord.send(channel, content);
  return { text: "Sent" };
});
```
系统提示：
```markdown
## Feedback Processing

When someone shares feedback:
1. Generate a unique ID
2. Rate importance 1-5 based on impact and urgency
3. Store using store_feedback with the full item
4. If importance >= 4, send a notification to the team channel

Importance guidelines:
- 5: Critical (crashes, data loss, security)
- 4: High (detailed bug reports, blocking issues)
- 3: Medium (suggestions, minor bugs)
- 2: Low (cosmetic, edge cases)
- 1: Minimal (off-topic, duplicates)
```
**示例 2：报告生成**

之前：
```typescript
tool("generate_weekly_report", async ({ startDate, endDate, format }) => {
  const data = await fetchMetrics(startDate, endDate);
  const summary = summarizeMetrics(data);
  const charts = generateCharts(data);

  if (format === "html") {
    return renderHtmlReport(summary, charts);
  } else if (format === "markdown") {
    return renderMarkdownReport(summary, charts);
  } else {
    return renderPdfReport(summary, charts);
  }
});
```
后：
```typescript
tool("query_metrics", async ({ start, end }) => {
  const data = await db.metrics.query({ start, end });
  return { text: JSON.stringify(data, null, 2) };
});

tool("write_file", async ({ path, content }) => {
  writeFileSync(path, content);
  return { text: `Wrote ${path}` };
});
```
系统提示：
```markdown
## Report Generation

When asked to generate a report:
1. Query the relevant metrics using query_metrics
2. Analyze the data and identify key trends
3. Create a clear, well-formatted report
4. Write it using write_file in the appropriate format

Use your judgment about format and structure. Make it useful.
```
</之前_之后>

<常见挑战>
## 常见的重构挑战

**“但是代理可能会犯错误！”**

是的，你可以迭代。更改提示以添加指导：
```markdown
// Before
Rate importance 1-5.

// After (if agent keeps rating too high)
Rate importance 1-5. Be conservative—most feedback is 2-3.
Only use 4-5 for truly blocking or critical issues.
```
**“工作流程很复杂！”**

复杂的工作流程仍然可以通过提示来表达。经纪人很聪明。
```markdown
When processing video feedback:
1. Check if it's a Loom, YouTube, or direct link
2. For YouTube, pass URL directly to video analysis
3. For others, download first, then analyze
4. Extract timestamped issues
5. Rate based on issue density and severity
```
**“我们需要确定性行为！”**

某些操作应该保留在代码中。没关系。提示本地化并不是全有或全无。

保留在代码中：
- 安全验证
- 速率限制
- 审计日志记录
- 准确的格式要求

移至提示：
- 分类决策
- 优先判断
- 内容生成
- 工作流程编排

**“测试怎么样？”**

测试结果，而不是程序：
- “根据这个输入，智能体是否能得到正确的结果？”
- “存储的反馈是否具有合理的重要性评级？”
- “是否为真正高优先级的项目发送通知？”
</common_challenges>

<清单>
## 重构清单

诊断：
- [ ] 列出了所有具有业务逻辑的工具
- [ ] 确定对代理能力的人为限制
- [ ] 发现微观管理如何进行的提示

重构：
- [ ] 从工作流程工具中提取基元
- [ ] 将业务逻辑移至系统提示符
- [ ] 删除了人为限制
- [ ] 简化工具对数据的输入，而不是决策

验证：
- [ ] 代理与基元实现相同的结果
- [ ] 可以通过编辑提示来更改行为
- [ ] 无需新工具即可添加新功能
</清单>
