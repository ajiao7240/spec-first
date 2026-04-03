<概述>
代理本机架构会影响产品的感觉，而不仅仅是它们的构建方式。本文档涵盖了复杂性的逐步披露、通过代理使用发现潜在需求以及设计与利益和可逆性相匹配的审批流程。
</概述>

<渐进式披露>
## 逐步揭示复杂性

最好的代理本机应用程序启动简单，但功能无穷。

### Excel 类比

Excel 是典型的示例：您可以将其用于购物清单，也可以构建复杂的财务模型。同样的工具，使用深度却截然不同。

Claude Code 具有这样的品质：修复拼写错误，或重构整个代码库。界面是相同的（自然语言），但功能随要求而扩展。

### 模式

代理本机应用程序应该追求以下目标：

**简单输入：** 基本请求立即生效，无需学习曲线
```
User: "Organize my downloads"
Agent: [Does it immediately, no configuration needed]
```
**可发现的深度：** 用户发现他们在探索时可以做更多事情
```
User: "Organize my downloads by project"
Agent: [Adapts to preference]

User: "Every Monday, review last week's downloads"
Agent: [Sets up recurring workflow]
```
**没有上限：**高级用户可以以您意想不到的方式推动系统
```
User: "Cross-reference my downloads with my calendar and flag
       anything I downloaded during a meeting that I haven't
       followed up on"
Agent: [Composes capabilities to accomplish this]
```
### 这是如何出现的

这不是您直接设计的东西。它**从架构中自然出现：**

1. 当功能是提示并且工具是可组合的时......
2. 用户可以从简单开始（“组织我的下载”）...
3.并逐渐发现复杂性（“每周一，回顾上周的……”）……
4. 无需明确构建每个级别

代理在用户所在的地方与他们会面。

### 设计意义

- **不要强制预先配置** - 让用户立即开始
- **不要隐藏功能** - 让它们可以通过使用被发现
- **不要限制复杂性** - 如果代理可以做到，就让用户提出要求
- **提供提示** - 帮助用户发现可能性
</progressive_disclosure>

<潜在需求_发现>
## 潜在需求发现

传统的产品开发：想象用户想要什么，构建它，看看你是否正确。

代理原生产品开发：建立一个有能力的基础，观察用户要求代理做什么，形式化出现的模式。

### 转变

**传统方法：**
```
1. Imagine features users might want
2. Build them
3. Ship
4. Hope you guessed right
5. If wrong, rebuild
```
**代理本机方法：**
```
1. Build capable foundation (atomic tools, parity)
2. Ship
3. Users ask agent for things
4. Observe what they're asking for
5. Patterns emerge
6. Formalize patterns into domain tools or prompts
7. Repeat
```
### 飞轮
```
Build with atomic tools and parity
           ↓
Users ask for things you didn't anticipate
           ↓
Agent composes tools to accomplish them
(or fails, revealing a capability gap)
           ↓
You observe patterns in what's being requested
           ↓
Add domain tools or prompts to optimize common patterns
           ↓
(Repeat)
```
### 你学到了什么

**当用户询问且代理成功时：**
- 这是一个真正的需要
- 你的架构支持它
- 如果常见，请考虑使用领域工具进行优化

**当用户询问且代理失败时：**
- 这是一个真正的需要
- 你有能力差距
- 修复差距：添加工具、修复奇偶校验、改进上下文

**当用户不要求某事时：**
- 也许他们不需要它
- 或者也许他们不知道这是可能的（能力隐藏）

### 实施

**记录代理请求：**
```typescript
async function handleAgentRequest(request: string) {
  // Log what users are asking for
  await analytics.log({
    type: 'agent_request',
    request: request,
    timestamp: Date.now(),
  });

  // Process request...
}
```
**跟踪成功/失败：**
```typescript
async function completeAgentSession(session: AgentSession) {
  await analytics.log({
    type: 'agent_session',
    request: session.initialRequest,
    succeeded: session.status === 'completed',
    toolsUsed: session.toolCalls.map(t => t.name),
    iterations: session.iterationCount,
  });
}
```
**审查模式：**
- 用户最需要什么？
- 出了什么问题？为什么？
- 领域工具有什么好处？
- 什么需要更好的上下文注入？

### 示例：发现“每周回顾”
```
Week 1: Users start asking "summarize my activity this week"
        Agent: Composes list_files + read_file, works but slow

Week 2: More users asking similar things
        Pattern emerges: weekly review is common

Week 3: Add prompt section for weekly review
        Faster, more consistent, still flexible

Week 4: If still common and performance matters
        Add domain tool: generate_weekly_summary
```
你不必猜测每周评论会很受欢迎。你发现了它。
</latent_demand_discovery>

<批准和机构>
## 批准和用户代理

当代理主动采取行动（自行做事而不是响应明确的请求）时，您需要决定授予多少自主权。

> **注意：** 此框架适用于未经请求的代理操作。如果用户明确要求代理执行某项操作（“发送该电子邮件”），则表示已获得批准 - 代理就会执行此操作。

### 赌注/可逆性矩阵

考虑两个维度：
- **风险：** 如果出了问题，有多大影响？
- **可逆性：**撤消有多容易？

|赌注 |可逆性|图案|示例|
|--------|-------------|---------|---------|
|低|简单| **自动应用** |整理文件|
|低|硬| **快速确认** |发布到私人提要 |
|高|简单| **建议+申请** |代码更改与撤消 |
|高|硬| **明确批准** |发送电子邮件、付款 |

### 模式详细信息

**自动申请（低风险，轻松逆转）：**
```
Agent: [Organizes files into folders]
Agent: "I organized your downloads into folders by type.
        You can undo with Cmd+Z or move them back."
```
用户不需要批准——很容易撤消，而且并不重要。

**快速确认（低风险，硬逆转）：**
```
Agent: "I've drafted a post about your reading insights.
        Publish to your feed?"
        [Publish] [Edit first] [Cancel]
```
一键确认，因为赌注很低，但很难取消发布。

**建议+申请（高风险，容易逆转）：**
```
Agent: "I recommend these code changes to fix the bug:
        [Shows diff]
        Apply? Changes can be reverted with git."
        [Apply] [Modify] [Cancel]
```
显示将会发生什么，使逆转变得清晰。

**明确批准（高风险，硬逆转）：**
```
Agent: "I've drafted this email to your team about the deadline change:
        [Shows full email]
        This will send immediately and cannot be unsent.
        Type 'send' to confirm."
```
需要明确的行动，使后果明确。

＃＃＃ 执行
```swift
enum ApprovalLevel {
    case autoApply       // Just do it
    case quickConfirm    // One-tap approval
    case suggestApply    // Show preview, ask to apply
    case explicitApproval // Require explicit confirmation
}

func approvalLevelFor(action: AgentAction) -> ApprovalLevel {
    let stakes = assessStakes(action)
    let reversibility = assessReversibility(action)

    switch (stakes, reversibility) {
    case (.low, .easy): return .autoApply
    case (.low, .hard): return .quickConfirm
    case (.high, .easy): return .suggestApply
    case (.high, .hard): return .explicitApproval
    }
}

func assessStakes(_ action: AgentAction) -> Stakes {
    switch action {
    case .organizeFiles: return .low
    case .publishToFeed: return .low
    case .modifyCode: return .high
    case .sendEmail: return .high
    case .makePayment: return .high
    }
}

func assessReversibility(_ action: AgentAction) -> Reversibility {
    switch action {
    case .organizeFiles: return .easy  // Can move back
    case .publishToFeed: return .hard  // People might see it
    case .modifyCode: return .easy     // Git revert
    case .sendEmail: return .hard      // Can't unsend
    case .makePayment: return .hard    // Money moved
    }
}
```
### 自我修改注意事项

当客服人员可以修改自己的行为（更改提示、更新偏好、调整工作流程）时，目标是：

1. **可见性：** 用户可以看到发生了什么变化
2. **理解：** 用户了解效果
3. **回滚：** 用户可以撤消更改

审批流程是实现这一目标的一种方式。易于回滚的审计日志可能是另一个。 **原则是：使其清晰易读。**
```swift
// When agent modifies its own prompt
func agentSelfModify(change: PromptChange) async {
    // Log the change
    await auditLog.record(change)

    // Create checkpoint for rollback
    await createCheckpoint(currentState)

    // Notify user (could be async/batched)
    await notifyUser("I've adjusted my approach: \(change.summary)")

    // Apply change
    await applyChange(change)
}
```
</approval_and_agency>

<能力_可见性>
## 能力可见性

用户需要发现代理可以做什么。隐藏的功能导致未充分利用。

＃＃＃ 问题
```
User: "Help me with my reading"
Agent: "What would you like help with?"
// Agent doesn't mention it can publish to feed, research books,
// generate introductions, analyze themes...
```
代理可以做这些事情，但用户不知道。

### 解决方案

**入职提示：**
```
Agent: "I can help you with your reading in several ways:
        - Research any book (web search + save findings)
        - Generate personalized introductions
        - Publish insights to your reading feed
        - Analyze themes across your library
        What interests you?"
```
**上下文建议：**
```
User: "I just finished reading 1984"
Agent: "Great choice! Would you like me to:
        - Research historical context?
        - Compare it to other books in your library?
        - Publish an insight about it to your feed?"
```
**逐步揭示：**
```
// After user uses basic features
Agent: "By the way, you can also ask me to set up
        recurring tasks, like 'every Monday, review my
        reading progress.' Just let me know!"
```
### 平衡

- **不要压倒**，预先提供所有功能
- **通过使用自然地揭示**功能
- **不要假设**用户会自己发现事物
- **务必在相关时使**功能可见
</能力_可见性>

<为信任而设计>
## 为信任而设计

代理本机应用程序需要信任。用户正在赋予人工智能重要的能力。通过以下方式建立信任：

### 透明度

- 显示代理正在做什么（工具调用、进度）
- 在重要的时候解释推理
- 使所有代理工作可检查（文件、日志）

### 可预测性

- 类似请求的一致行为
- 需要批准时的清晰模式
- 代理可以访问的内容并不令人意外

### 可逆性

- 轻松撤消代理操作
- 重大变化之前的检查点
- 清除回滚路径

### 控制

- 用户可以随时停止代理
- 用户可以调整代理行为（提示、偏好）
- 如果需要，用户可以限制功能

### 实施
```swift
struct AgentTransparency {
    // Show what's happening
    func onToolCall(_ tool: ToolCall) {
        showInUI("Using \(tool.name)...")
    }

    // Explain reasoning
    func onDecision(_ decision: AgentDecision) {
        if decision.needsExplanation {
            showInUI("I chose this because: \(decision.reasoning)")
        }
    }

    // Make work inspectable
    func onOutput(_ output: AgentOutput) {
        // All output is in files user can see
        // Or in visible UI state
    }
}
```
</为信任而设计>

<清单>
## 产品设计清单

### 渐进式披露
- [ ] 基本请求立即生效（无配置）
- [ ] 深度可通过使用发现
- [ ] 复杂性没有人为上限
- [ ] 提供能力提示

### 潜在需求发现
- [ ] 代理请求被记录
- [ ] 跟踪成功/失败
- [ ] 定期审查模式
- [ ] 常见模式形式化为工具/提示

### 批准和代理
- [ ] 每种行动类型的风险评估
- [ ] 评估每种操作类型的可逆性
- [ ] 批准模式匹配赌注/可逆性
- [ ] 自我修改清晰（可见、可理解、可逆）

### 能力可见性
- [ ] 入职揭示了关键功能
- [ ] 提供了上下文建议
- [ ] 用户不应该猜测什么是可能的

### 信任
- [ ] 代理操作透明
- [ ] 行为是可预测的
- [ ] 动作是可逆的
- [ ] 用户拥有控制权
</清单>
