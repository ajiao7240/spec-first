<概述>
如何按照提示本机原则设计 MCP 工具。工具应该是支持功能的原语，而不是编码决策的工作流程。

**核心原则：** 用户能做的事，代理也应该能做。不要人为地限制代理——为其提供与高级用户相同的原语。
</概述>

<原理名称=“primitives-not-workflows”>
## 工具是原语，而不是工作流程

**错误的方法：** 编码业务逻辑的工具
```typescript
tool("process_feedback", {
  feedback: z.string(),
  category: z.enum(["bug", "feature", "question"]),
  priority: z.enum(["low", "medium", "high"]),
}, async ({ feedback, category, priority }) => {
  // Tool decides how to process
  const processed = categorize(feedback);
  const stored = await saveToDatabase(processed);
  const notification = await notify(priority);
  return { processed, stored, notification };
});
```
**正确的方法：** 支持任何工作流程的原语
```typescript
tool("store_item", {
  key: z.string(),
  value: z.any(),
}, async ({ key, value }) => {
  await db.set(key, value);
  return { text: `Stored ${key}` };
});

tool("send_message", {
  channel: z.string(),
  content: z.string(),
}, async ({ channel, content }) => {
  await messenger.send(channel, content);
  return { text: "Sent" };
});
```
代理根据系统提示决定类别、优先级以及何时通知。
</原理>

<原理名称=“描述性名称”>
## 工具应该有描述性的、原始的名称

名称应该描述功能，而不是用例：

|错误 |对|
|--------|--------|
| `process_user_feedback` | `store_item` |
| `create_feedback_summary` | `write_file` |
| `send_notification` | `send_message` |
| `deploy_to_production` | `git_push` |

提示告诉代理*何时*使用原语。该工具仅提供*功能*。
</原理>

<原理名称=“简单输入”>
## 输入应该简单

工具接受数据。他们不接受决定。

**错误：** 工具接受决策
```typescript
tool("format_content", {
  content: z.string(),
  format: z.enum(["markdown", "html", "json"]),
  style: z.enum(["formal", "casual", "technical"]),
}, ...)
```
**右：** 工具接受数据，代理决定格式
```typescript
tool("write_file", {
  path: z.string(),
  content: z.string(),
}, ...)
// Agent decides to write index.html with HTML content, or data.json with JSON
```
</原理>

<原理名称=“丰富的输出”>
## 输出应该丰富

返回足够的信息供代理验证和迭代。

**错误：**最小输出
```typescript
async ({ key }) => {
  await db.delete(key);
  return { text: "Deleted" };
}
```
**右：**丰富的输出
```typescript
async ({ key }) => {
  const existed = await db.has(key);
  if (!existed) {
    return { text: `Key ${key} did not exist` };
  }
  await db.delete(key);
  return { text: `Deleted ${key}. ${await db.count()} items remaining.` };
}
```
</原理>

<设计模板>
## 工具设计模板
```typescript
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

export const serverName = createSdkMcpServer({
  name: "server-name",
  version: "1.0.0",
  tools: [
    // READ operations
    tool(
      "read_item",
      "Read an item by key",
      { key: z.string().describe("Item key") },
      async ({ key }) => {
        const item = await storage.get(key);
        return {
          content: [{
            type: "text",
            text: item ? JSON.stringify(item, null, 2) : `Not found: ${key}`,
          }],
          isError: !item,
        };
      }
    ),

    tool(
      "list_items",
      "List all items, optionally filtered",
      {
        prefix: z.string().optional().describe("Filter by key prefix"),
        limit: z.number().default(100).describe("Max items"),
      },
      async ({ prefix, limit }) => {
        const items = await storage.list({ prefix, limit });
        return {
          content: [{
            type: "text",
            text: `Found ${items.length} items:\n${items.map(i => i.key).join("\n")}`,
          }],
        };
      }
    ),

    // WRITE operations
    tool(
      "store_item",
      "Store an item",
      {
        key: z.string().describe("Item key"),
        value: z.any().describe("Item data"),
      },
      async ({ key, value }) => {
        await storage.set(key, value);
        return {
          content: [{ type: "text", text: `Stored ${key}` }],
        };
      }
    ),

    tool(
      "delete_item",
      "Delete an item",
      { key: z.string().describe("Item key") },
      async ({ key }) => {
        const existed = await storage.delete(key);
        return {
          content: [{
            type: "text",
            text: existed ? `Deleted ${key}` : `${key} did not exist`,
          }],
        };
      }
    ),

    // EXTERNAL operations
    tool(
      "call_api",
      "Make an HTTP request",
      {
        url: z.string().url(),
        method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET"),
        body: z.any().optional(),
      },
      async ({ url, method, body }) => {
        const response = await fetch(url, { method, body: JSON.stringify(body) });
        const text = await response.text();
        return {
          content: [{
            type: "text",
            text: `${response.status} ${response.statusText}\n\n${text}`,
          }],
          isError: !response.ok,
        };
      }
    ),
  ],
});
```
</设计模板>

<示例名称=“反馈服务器”>
## 示例：反馈存储服务器

该服务器提供用于存储反馈的原语。它不决定如何对反馈进行分类或组织——这是代理通过提示进行的工作。
```typescript
export const feedbackMcpServer = createSdkMcpServer({
  name: "feedback",
  version: "1.0.0",
  tools: [
    tool(
      "store_feedback",
      "Store a feedback item",
      {
        item: z.object({
          id: z.string(),
          author: z.string(),
          content: z.string(),
          importance: z.number().min(1).max(5),
          timestamp: z.string(),
          status: z.string().optional(),
          urls: z.array(z.string()).optional(),
          metadata: z.any().optional(),
        }).describe("Feedback item"),
      },
      async ({ item }) => {
        await db.feedback.insert(item);
        return {
          content: [{
            type: "text",
            text: `Stored feedback ${item.id} from ${item.author}`,
          }],
        };
      }
    ),

    tool(
      "list_feedback",
      "List feedback items",
      {
        limit: z.number().default(50),
        status: z.string().optional(),
      },
      async ({ limit, status }) => {
        const items = await db.feedback.list({ limit, status });
        return {
          content: [{
            type: "text",
            text: JSON.stringify(items, null, 2),
          }],
        };
      }
    ),

    tool(
      "update_feedback",
      "Update a feedback item",
      {
        id: z.string(),
        updates: z.object({
          status: z.string().optional(),
          importance: z.number().optional(),
          metadata: z.any().optional(),
        }),
      },
      async ({ id, updates }) => {
        await db.feedback.update(id, updates);
        return {
          content: [{ type: "text", text: `Updated ${id}` }],
        };
      }
    ),
  ],
});
```
然后，系统提示告诉代理*如何*使用这些原语：
```markdown
## Feedback Processing

When someone shares feedback:
1. Extract author, content, and any URLs
2. Rate importance 1-5 based on actionability
3. Store using feedback.store_feedback
4. If high importance (4-5), notify the channel

Use your judgment about importance ratings.
```
</示例>

<原理名称=“动态能力发现”>
## 动态能力发现与静态工具映射

**此模式专门针对代理本机应用程序**，您希望代理拥有对外部 API 的完全访问权限 - 与用户拥有的访问权限相同。它遵循代理原生的核心原则：“用户能做什么，代理就能做什么。”

如果您正在构建功能有限的受限代理，则静态工具映射可能是有意的。但对于与 HealthKit、HomeKit、GraphQL 或类似 API 集成的代理本机应用程序：

**静态工具映射（代理本机的反模式）：**
为每个 API 功能构建单独的工具。总是过时的，将代理限制为您所期望的。
```typescript
// ❌ Static: Every API type needs a hardcoded tool
tool("read_steps", async ({ startDate, endDate }) => {
  return healthKit.query(HKQuantityType.stepCount, startDate, endDate);
});

tool("read_heart_rate", async ({ startDate, endDate }) => {
  return healthKit.query(HKQuantityType.heartRate, startDate, endDate);
});

tool("read_sleep", async ({ startDate, endDate }) => {
  return healthKit.query(HKCategoryType.sleepAnalysis, startDate, endDate);
});

// When HealthKit adds glucose tracking... you need a code change
```
**动态能力发现（首选）：**
构建一个可以发现可用内容的元工具，以及一个可以访问任何内容的通用工具。
```typescript
// ✅ Dynamic: Agent discovers and uses any capability

// Discovery tool - returns what's available at runtime
tool("list_available_capabilities", async () => {
  const quantityTypes = await healthKit.availableQuantityTypes();
  const categoryTypes = await healthKit.availableCategoryTypes();

  return {
    text: `Available health metrics:\n` +
          `Quantity types: ${quantityTypes.join(", ")}\n` +
          `Category types: ${categoryTypes.join(", ")}\n` +
          `\nUse read_health_data with any of these types.`
  };
});

// Generic access tool - type is a string, API validates
tool("read_health_data", {
  dataType: z.string(),  // NOT z.enum - let HealthKit validate
  startDate: z.string(),
  endDate: z.string(),
  aggregation: z.enum(["sum", "average", "samples"]).optional()
}, async ({ dataType, startDate, endDate, aggregation }) => {
  // HealthKit validates the type, returns helpful error if invalid
  const result = await healthKit.query(dataType, startDate, endDate, aggregation);
  return { text: JSON.stringify(result, null, 2) };
});
```
**何时使用每种方法：**

|动态（代理本机）|静态（受约束代理）|
|------------------------------------|----------------------------------------|
|代理应该访问用户可以访问的任何内容 |代理有意限制范围|
|具有许多端点的外部 API（HealthKit、HomeKit、GraphQL）|具有固定操作的内部域 |
| API 的发展独立于您的代码 |紧密耦合的领域逻辑 |
|您想要全面的行动平价 |你想要严格的护栏|

**代理本机默认值为动态。** 仅当您有意限制代理的功能时才使用静态。

**完整的动态模式：**
```swift
// 1. Discovery tool: What can I access?
tool("list_health_types", "Get available health data types") { _ in
    let store = HKHealthStore()

    let quantityTypes = HKQuantityTypeIdentifier.allCases.map { $0.rawValue }
    let categoryTypes = HKCategoryTypeIdentifier.allCases.map { $0.rawValue }
    let characteristicTypes = HKCharacteristicTypeIdentifier.allCases.map { $0.rawValue }

    return ToolResult(text: """
        Available HealthKit types:

        ## Quantity Types (numeric values)
        \(quantityTypes.joined(separator: ", "))

        ## Category Types (categorical data)
        \(categoryTypes.joined(separator: ", "))

        ## Characteristic Types (user info)
        \(characteristicTypes.joined(separator: ", "))

        Use read_health_data or write_health_data with any of these.
        """)
}

// 2. Generic read: Access any type by name
tool("read_health_data", "Read any health metric", {
    dataType: z.string().describe("Type name from list_health_types"),
    startDate: z.string(),
    endDate: z.string()
}) { request in
    // Let HealthKit validate the type name
    guard let type = HKQuantityTypeIdentifier(rawValue: request.dataType)
                     ?? HKCategoryTypeIdentifier(rawValue: request.dataType) else {
        return ToolResult(
            text: "Unknown type: \(request.dataType). Use list_health_types to see available types.",
            isError: true
        )
    }

    let samples = try await healthStore.querySamples(type: type, start: startDate, end: endDate)
    return ToolResult(text: samples.formatted())
}

// 3. Context injection: Tell agent what's available in system prompt
func buildSystemPrompt() -> String {
    let availableTypes = healthService.getAuthorizedTypes()

    return """
    ## Available Health Data

    You have access to these health metrics:
    \(availableTypes.map { "- \($0)" }.joined(separator: "\n"))

    Use read_health_data with any type above. For new types not listed,
    use list_health_types to discover what's available.
    """
}
```
**好处：**
- 代理可以使用任何 API 功能，包括代码发布后添加的功能
- API 是验证器，而不是您的枚举定义
- 更小的刀具表面（2-3 个刀具与 N 个刀具）
- 代理通过询问自然地发现能力
- 可与任何具有内省功能的 API（HealthKit、GraphQL、OpenAPI）配合使用
</原理>

<原理名称=“crud-completeness”>
## CRUD 完整性

代理可以创建的每种数据类型都应该能够读取、更新和删除。不完整的 CRUD = 操作奇偶校验被破坏。

**反模式：仅创建工具**
```typescript
// ❌ Can create but not modify or delete
tool("create_experiment", { hypothesis, variable, metric })
tool("write_journal_entry", { content, author, tags })
// User: "Delete that experiment" → Agent: "I can't do that"
```
**正确：每个实体的完整 CRUD**
```typescript
// ✅ Complete CRUD
tool("create_experiment", { hypothesis, variable, metric })
tool("read_experiment", { id })
tool("update_experiment", { id, updates: { hypothesis?, status?, endDate? } })
tool("delete_experiment", { id })

tool("create_journal_entry", { content, author, tags })
tool("read_journal", { query?, dateRange?, author? })
tool("update_journal_entry", { id, content, tags? })
tool("delete_journal_entry", { id })
```
**CRUD 审核：**
对于应用程序中的每个实体类型，验证：
- [ ] 创建：代理可以创建新实例
- [ ] 读取：代理可以查询/搜索/列出实例
- [ ] 更新：代理可以修改现有实例
- [ ] 删除：代理可以删除实例

如果缺少任何操作，用户最终会要求执行该操作，并且代理将失败。
</原理>

<清单>
## MCP 工具设计清单

**基础知识：**
- [ ] 工具名称描述功能，而不是用例
- [ ] 输入是数据，而不是决策
- [ ] 输出丰富（足以供代理验证）
- [ ] CRUD 操作是单独的工具（不是一个大型工具）
- [ ] 工具实现中没有业务逻辑
- [ ] 通过 `isError` 清楚地传达错误状态
- [ ] 描述解释该工具的用途，而不是何时使用它

**动态能力发现（适用于代理本机应用程序）：**
- [ ] 对于代理应具有完全访问权限的外部 API，请使用动态发现
- [ ] 为每个 API 表面包含一个 `list_*` 或 `discover_*` 工具
- [ ] 当 API 验证时使用字符串输入（而不是枚举）
- [ ] 在运行时将可用功能注入系统提示符中
- [ ] 如果有意限制代理范围，则仅使用静态工具映射

**CRUD 完整性：**
- [ ] 每个实体都有创建、读取、更新、删除操作
- [ ] 每个UI动作都有对应的代理工具
- [ ] 测试：“代理可以撤消刚刚所做的事情吗？”
</清单>
