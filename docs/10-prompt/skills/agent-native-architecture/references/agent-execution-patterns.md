<概述>
用于构建健壮代理循环的代理执行模式。这涵盖了代理如何发出完成信号、跟踪恢复的部分进度、选择适当的模型层以及处理上下文限制。
</概述>

<完成信号>
## 完成信号

代理需要一种明确的方式来表达“我已经完成了”。

### 反模式：启发式检测

通过启发式检测完成情况是脆弱的：

- 无需工具调用的连续迭代
- 检查预期的输出文件
- 跟踪“无进展”状态
- 基于时间的超时

这些在边缘情况下会崩溃并产生不可预测的行为。

### 模式：显式完成工具

提供一个 `complete_task` 工具：
- 总结已完成的工作
- 返回停止循环的信号
- 所有代理类型的工作方式相同
```typescript
tool("complete_task", {
  summary: z.string().describe("Summary of what was accomplished"),
  status: z.enum(["success", "partial", "blocked"]).optional(),
}, async ({ summary, status = "success" }) => {
  return {
    text: summary,
    shouldContinue: false,  // Key: signals loop should stop
  };
});
```
### ToolResult 模式

结构工具结果将成功与延续分开：
```swift
struct ToolResult {
    let success: Bool           // Did tool succeed?
    let output: String          // What happened?
    let shouldContinue: Bool    // Should agent loop continue?
}

// Three common cases:
extension ToolResult {
    static func success(_ output: String) -> ToolResult {
        // Tool succeeded, keep going
        ToolResult(success: true, output: output, shouldContinue: true)
    }

    static func error(_ message: String) -> ToolResult {
        // Tool failed but recoverable, agent can try something else
        ToolResult(success: false, output: message, shouldContinue: true)
    }

    static func complete(_ summary: String) -> ToolResult {
        // Task done, stop the loop
        ToolResult(success: true, output: summary, shouldContinue: false)
    }
}
```
### 关键见解

**这与成功/失败不同：**

- 工具可以**成功**并发出**停止**（任务完成）的信号
- 工具可能**失败**并发出**继续**信号（可恢复的错误，尝试其他方法）
```typescript
// Examples:
read_file("/missing.txt")
// → { success: false, output: "File not found", shouldContinue: true }
// Agent can try a different file or ask for clarification

complete_task("Organized all downloads into folders")
// → { success: true, output: "...", shouldContinue: false }
// Agent is done

write_file("/output.md", content)
// → { success: true, output: "Wrote file", shouldContinue: true }
// Agent keeps working toward the goal
```
###系统提示引导

告诉代理何时完成：
```markdown
## Completing Tasks

When you've accomplished the user's request:
1. Verify your work (read back files you created, check results)
2. Call `complete_task` with a summary of what you did
3. Don't keep working after the goal is achieved

If you're blocked and can't proceed:
- Call `complete_task` with status "blocked" and explain why
- Don't loop forever trying the same thing
```
</完成信号>

<部分完成>
## 部分完成

对于多步骤任务，跟踪任务级别的进度以恢复功能。

### 任务状态跟踪
```swift
enum TaskStatus {
    case pending      // Not yet started
    case inProgress   // Currently working on
    case completed    // Finished successfully
    case failed       // Couldn't complete (with reason)
    case skipped      // Intentionally not done
}

struct AgentTask {
    let id: String
    let description: String
    var status: TaskStatus
    var notes: String?  // Why it failed, what was done
}

struct AgentSession {
    var tasks: [AgentTask]

    var isComplete: Bool {
        tasks.allSatisfy { $0.status == .completed || $0.status == .skipped }
    }

    var progress: (completed: Int, total: Int) {
        let done = tasks.filter { $0.status == .completed }.count
        return (done, tasks.count)
    }
}
```
### UI进度显示

向用户展示正在发生的事情：
```
Progress: 3/5 tasks complete (60%)
✅ [1] Find source materials
✅ [2] Download full text
✅ [3] Extract key passages
❌ [4] Generate summary - Error: context limit exceeded
⏳ [5] Create outline - Pending
```
### 部分完成场景

**代理在完成之前达到最大迭代次数：**
- 一些任务已完成，一些待处理
- 使用当前状态保存检查点
- 从中断处继续，而不是从头开始

**代理在一项任务上失败：**
- 标记为 `.failed` 的任务，注释中有错误
- 其他任务可能会继续（代理决定）
- Orchestrator 不会自动中止整个会话

**任务中出现网络错误：**
- 当前迭代抛出
- 会话标记为 `.failed`
- 检查点保留该点之前的消息
- 可以从检查点恢复

### 检查点结构
```swift
struct AgentCheckpoint: Codable {
    let sessionId: String
    let agentType: String
    let messages: [Message]          // Full conversation history
    let iterationCount: Int
    let tasks: [AgentTask]           // Task state
    let customState: [String: Any]   // Agent-specific state
    let timestamp: Date

    var isValid: Bool {
        // Checkpoints expire (default 1 hour)
        Date().timeIntervalSince(timestamp) < 3600
    }
}
```
### 恢复流程

1. 在应用程序启动时，扫描有效的检查点
2. 向用户显示：“您有一个未完成的会话。要继续吗？”
3.关于简历：
   - 将消息恢复到对话中
   - 恢复任务状态
   - 从中断处继续代理循环
4. 解雇时：
   - 删除检查点
   - 如果用户再次尝试，则重新开始
</partial_completion>

<模型层选择>
## 型号等级选择

不同的特工需要不同的情报水平。使用实现结果的最便宜的模型。

### 等级指南

|代理类型 |推荐等级 |推理|
|------------|-----------------|------------|
|聊天/对话 |平衡（十四行诗）|反应快，推理好 |
|研究|平衡（十四行诗）|工具循环，而不是超复杂的综合 |
|内容生成|平衡（十四行诗）|有创意但不重综合 |
|复杂分析|强大（作品）|多文档综合，细致判断|
|档案生成 |强大（作品）|照片分析、复杂模式识别|
|快速查询 |快（俳句）|简单查找，快速转换 |
|简单分类 |快（俳句）|高容量，简单的决策 |

＃＃＃ 执行
```swift
enum ModelTier {
    case fast      // claude-3-haiku: Quick, cheap, simple tasks
    case balanced  // claude-sonnet: Good balance for most tasks
    case powerful  // claude-opus: Complex reasoning, synthesis

    var modelId: String {
        switch self {
        case .fast: return "claude-3-haiku-20240307"
        case .balanced: return "claude-sonnet-4-20250514"
        case .powerful: return "claude-opus-4-20250514"
        }
    }
}

struct AgentConfig {
    let name: String
    let modelTier: ModelTier
    let tools: [AgentTool]
    let systemPrompt: String
    let maxIterations: Int
}

// Examples
let researchConfig = AgentConfig(
    name: "research",
    modelTier: .balanced,
    tools: researchTools,
    systemPrompt: researchPrompt,
    maxIterations: 20
)

let quickLookupConfig = AgentConfig(
    name: "lookup",
    modelTier: .fast,
    tools: [readLibrary],
    systemPrompt: "Answer quick questions about the user's library.",
    maxIterations: 3
)
```
### 成本优化策略

1. **从平衡开始，质量不够就升级**
2. **对需要大量工具的循环使用快速层**，其中每个回合都很简单
3. **为综合任务保留强大的层**（比较多个来源）
4. **考虑每回合的代币限制**以控制成本
5. **缓存昂贵的操作**以避免重复调用
</model_tier_selection>

<上下文限制>
## 上下文限制

代理会话可以无限期延长，但上下文窗口则不能。从一开始就设计有界上下文。

＃＃＃ 问题
```
Turn 1: User asks question → 500 tokens
Turn 2: Agent reads file → 10,000 tokens
Turn 3: Agent reads another file → 10,000 tokens
Turn 4: Agent researches → 20,000 tokens
...
Turn 10: Context window exceeded
```
### 设计原则

**1.工具应支持迭代细化**

不要全有或全无，而是进行总结 → 细节 → 完整的设计：
```typescript
// Good: Supports iterative refinement
tool("read_file", {
  path: z.string(),
  preview: z.boolean().default(true),  // Return first 1000 chars by default
  full: z.boolean().default(false),    // Opt-in to full content
}, ...);

tool("search_files", {
  query: z.string(),
  summaryOnly: z.boolean().default(true),  // Return matches, not full files
}, ...);
```
**2.提供整合工具**

为代理提供一种在会话中巩固所学知识的方法：
```typescript
tool("summarize_and_continue", {
  keyPoints: z.array(z.string()),
  nextSteps: z.array(z.string()),
}, async ({ keyPoints, nextSteps }) => {
  // Store summary, potentially truncate earlier messages
  await saveSessionSummary({ keyPoints, nextSteps });
  return { text: "Summary saved. Continuing with focus on: " + nextSteps.join(", ") };
});
```
**3.截断设计**

假设协调器可能会截断早期消息。重要的背景应该是：
- 在系统提示中（始终存在）
- 在文件中（可以重新读取）
- 总结在context.md中

### 实施策略
```swift
class AgentOrchestrator {
    let maxContextTokens = 100_000
    let targetContextTokens = 80_000  // Leave headroom

    func shouldTruncate() -> Bool {
        estimateTokens(messages) > targetContextTokens
    }

    func truncateIfNeeded() {
        if shouldTruncate() {
            // Keep system prompt + recent messages
            // Summarize or drop older messages
            messages = [systemMessage] + summarizeOldMessages() + recentMessages
        }
    }
}
```
###系统提示引导
```markdown
## Managing Context

For long tasks, periodically consolidate what you've learned:
1. If you've gathered a lot of information, summarize key points
2. Save important findings to files (they persist beyond context)
3. Use `summarize_and_continue` if the conversation is getting long

Don't try to hold everything in memory. Write it down.
```
</context_limits>

<协调器模式>
## 统一代理协调器

一种执行引擎，多种代理类型。所有代理都使用具有不同配置的相同编排器。
```swift
class AgentOrchestrator {
    static let shared = AgentOrchestrator()

    func run(config: AgentConfig, userMessage: String) async -> AgentResult {
        var messages: [Message] = [
            .system(config.systemPrompt),
            .user(userMessage)
        ]

        var iteration = 0

        while iteration < config.maxIterations {
            // Get agent response
            let response = await claude.message(
                model: config.modelTier.modelId,
                messages: messages,
                tools: config.tools
            )

            messages.append(.assistant(response))

            // Process tool calls
            for toolCall in response.toolCalls {
                let result = await executeToolCall(toolCall, config: config)
                messages.append(.toolResult(result))

                // Check for completion signal
                if !result.shouldContinue {
                    return AgentResult(
                        status: .completed,
                        output: result.output,
                        iterations: iteration + 1
                    )
                }
            }

            // No tool calls = agent is responding, might be done
            if response.toolCalls.isEmpty {
                // Could be done, or waiting for user
                break
            }

            iteration += 1
        }

        return AgentResult(
            status: iteration >= config.maxIterations ? .maxIterations : .responded,
            output: messages.last?.content ?? "",
            iterations: iteration
        )
    }
}
```
### 好处

- 所有代理类型的一致生命周期管理
- 自动检查点/恢复（对于移动设备至关重要）
- 共享工具协议
- 轻松添加新的代理类型
- 集中的错误处理和日志记录
</orchestrator_pattern>

<清单>
## 代理执行检查表

### 完成信号
- 提供[ ] `complete_task`工具（显式完成）
- [ ] 无启发式完成检测
- [ ] 工具结果包括 `shouldContinue` 标志
- [ ]系统提示指导何时完成

### 部分完成
- [ ] 跟踪任务的状态（待处理、进行中、已完成、失败）
- [ ] 为恢复保存检查点
- [ ] 用户可见进度
- [ ] 从上次中断的地方继续

### 模型层
- [ ] 根据任务复杂性选择层级
- [ ] 考虑成本优化
- [ ] 快速层级，操作简单
- [ ] 为综合保留的强大层

### 上下文限制
- [ ] 工具支持迭代细化（预览与完整）
- [ ] 可用的整合机制
- [ ] 重要上下文保留到文件中
- [ ] 定义截断策略
</清单>
