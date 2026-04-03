<概述>
用于构建代理本机系统的架构模式。这些模式源自五个核心原则：奇偶性、粒度、可组合性、突发能力和随时间改进。

功能是由代理在循环中运行所实现的结果，而不是您编写的函数。工具是原子原语。代理人适用判决；提示定义了结果。

另请参阅：
- [files-universal-interface.md](./files-universal-interface.md) 用于文件组织和 context.md 模式
- [agent-execution-patterns.md](./agent-execution-patterns.md) 用于完成信号和部分完成
- [product-implications.md](./product-implications.md) 用于渐进式披露和批准模式
</概述>

<模式名称=“事件驱动代理”>
## 事件驱动代理架构

代理作为响应事件的长期进程运行。事件变成提示。
```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Loop                                │
├─────────────────────────────────────────────────────────────┤
│  Event Source → Agent (Claude) → Tool Calls → Response      │
└─────────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌─────────┐    ┌──────────┐    ┌───────────┐
    │ Content │    │   Self   │    │   Data    │
    │  Tools  │    │  Tools   │    │   Tools   │
    └─────────┘    └──────────┘    └───────────┘
    (write_file)   (read_source)   (store_item)
                   (restart)       (list_items)
```
**主要特征：**
- 事件（消息、网络钩子、计时器）触发代理轮流
- Agent根据系统提示决定如何响应
- 工具是 IO 的原语，而不是业务逻辑
- 通过数据工具在事件之间保持状态

**示例：Discord 反馈机器人**
```typescript
// Event source
client.on("messageCreate", (message) => {
  if (!message.author.bot) {
    runAgent({
      userMessage: `New message from ${message.author}: "${message.content}"`,
      channelId: message.channelId,
    });
  }
});

// System prompt defines behavior
const systemPrompt = `
When someone shares feedback:
1. Acknowledge their feedback warmly
2. Ask clarifying questions if needed
3. Store it using the feedback tools
4. Update the feedback site

Use your judgment about importance and categorization.
`;
```
</模式>

<模式名称=“两层-git”>
## 两层 Git 架构

对于自修改代理，将代码（共享）与数据（特定于实例）分开。
```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub (shared repo)                     │
│  - src/           (agent code)                              │
│  - site/          (web interface)                           │
│  - package.json   (dependencies)                            │
│  - .gitignore     (excludes data/, logs/)                   │
└─────────────────────────────────────────────────────────────┘
                          │
                     git clone
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Instance (Server)                           │
│                                                              │
│  FROM GITHUB (tracked):                                      │
│  - src/           → pushed back on code changes             │
│  - site/          → pushed, triggers deployment             │
│                                                              │
│  LOCAL ONLY (untracked):                                     │
│  - data/          → instance-specific storage               │
│  - logs/          → runtime logs                            │
│  - .env           → secrets                                 │
└─────────────────────────────────────────────────────────────┘
```
**为什么这有效：**
- 代码和站点受版本控制（GitHub）
- 原始数据保留在本地（特定于实例）
- 网站是根据数据生成的，因此可重复
- 通过git历史记录自动回滚
</模式>

<模式名称=“多实例”>
## 多实例分支

每个代理实例都有自己的分支，同时共享核心代码。
```
main                        # Shared features, bug fixes
├── instance/feedback-bot   # Every Reader feedback bot
├── instance/support-bot    # Customer support bot
└── instance/research-bot   # Research assistant
```
**更改流程：**
|更改类型 |继续工作|然后|
|----------|---------|------|
|核心特点|主要|合并到实例分支 |
|错误修复 |主要|合并到实例分支 |
|实例配置|实例分支 |完成 |
|实例数据 |实例分支 |完成 |

**同步工具：**
```typescript
tool("self_deploy", "Pull latest from main, rebuild, restart", ...)
tool("sync_from_instance", "Merge from another instance", ...)
tool("propose_to_main", "Create PR to share improvements", ...)
```
</模式>

<模式名称=“站点作为输出”>
## 站点作为代理输出

代理生成并维护网站作为自然输出，而不是通过专门的网站工具。
```
Discord Message
      ↓
Agent processes it, extracts insights
      ↓
Agent decides what site updates are needed
      ↓
Agent writes files using write_file primitive
      ↓
Git commit + push triggers deployment
      ↓
Site updates automatically
```
**关键见解：** 不要构建网站生成工具。为代理提供文件工具并在提示中教它如何创建良好的站点。
```markdown
## Site Management

You maintain a public feedback site. When feedback comes in:
1. Use write_file to update site/public/content/feedback.json
2. If the site's React components need improvement, modify them
3. Commit changes and push to trigger Vercel deploy

The site should be:
- Clean, modern dashboard aesthetic
- Clear visual hierarchy
- Status organization (Inbox, Active, Done)

You decide the structure. Make it good.
```
</模式>

<模式名称=“批准门”>
## 批准门模式

对于危险操作，将“建议”与“申请”分开。
```typescript
// Pending changes stored separately
const pendingChanges = new Map<string, string>();

tool("write_file", async ({ path, content }) => {
  if (requiresApproval(path)) {
    // Store for approval
    pendingChanges.set(path, content);
    const diff = generateDiff(path, content);
    return {
      text: `Change requires approval.\n\n${diff}\n\nReply "yes" to apply.`
    };
  } else {
    // Apply immediately
    writeFileSync(path, content);
    return { text: `Wrote ${path}` };
  }
});

tool("apply_pending", async () => {
  for (const [path, content] of pendingChanges) {
    writeFileSync(path, content);
  }
  pendingChanges.clear();
  return { text: "Applied all pending changes" };
});
```
**需要批准的内容：**
- src/*.ts（代理代码）
- package.json（依赖项）
- 系统提示更改

**什么不：**
- data/*（实例数据）
- site/*（生成的内容）
- docs/*（文档）
</模式>

<模式名称=“统一代理架构”>
## 统一代理架构

一种执行引擎，多种代理类型。所有代理都使用相同的协调器，但具有不同的配置。
```
┌─────────────────────────────────────────────────────────────┐
│                    AgentOrchestrator                         │
├─────────────────────────────────────────────────────────────┤
│  - Lifecycle management (start, pause, resume, stop)        │
│  - Checkpoint/restore (for background execution)            │
│  - Tool execution                                            │
│  - Chat integration                                          │
└─────────────────────────────────────────────────────────────┘
          │                    │                    │
    ┌─────┴─────┐        ┌─────┴─────┐        ┌─────┴─────┐
    │ Research  │        │   Chat    │        │  Profile  │
    │   Agent   │        │   Agent   │        │   Agent   │
    └───────────┘        └───────────┘        └───────────┘
    - web_search         - read_library       - read_photos
    - write_file         - publish_to_feed    - write_file
    - read_file          - web_search         - analyze_image
```
**执行：**
```swift
// All agents use the same orchestrator
let session = try await AgentOrchestrator.shared.startAgent(
    config: ResearchAgent.create(book: book),  // Config varies
    tools: ResearchAgent.tools,                 // Tools vary
    context: ResearchAgent.context(for: book)   // Context varies
)

// Agent types define their own configuration
struct ResearchAgent {
    static var tools: [AgentTool] {
        [
            FileTools.readFile(),
            FileTools.writeFile(),
            WebTools.webSearch(),
            WebTools.webFetch(),
        ]
    }

    static func context(for book: Book) -> String {
        """
        You are researching "\(book.title)" by \(book.author).
        Save findings to Documents/Research/\(book.id)/
        """
    }
}

struct ChatAgent {
    static var tools: [AgentTool] {
        [
            FileTools.readFile(),
            FileTools.writeFile(),
            BookTools.readLibrary(),
            BookTools.publishToFeed(),  // Chat can publish directly
            WebTools.webSearch(),
        ]
    }

    static func context(library: [Book]) -> String {
        """
        You help the user with their reading.
        Available books: \(library.map { $0.title }.joined(separator: ", "))
        """
    }
}
```
**好处：**
- 所有代理类型的一致生命周期管理
- 自动检查点/恢复（对于移动设备至关重要）
- 共享工具协议
- 轻松添加新的代理类型
- 集中的错误处理和日志记录
</模式>

<pattern name="agent-to-ui-communication">
## 代理到 UI 通信

当代理采取行动时，用户界面应立即反映它们。用户应该看到代理做了什么。

**模式 1：共享数据存储（推荐）**

代理通过 UI 观察到的同一服务进行写入：
```swift
// Shared service
class BookLibraryService: ObservableObject {
    static let shared = BookLibraryService()
    @Published var books: [Book] = []
    @Published var feedItems: [FeedItem] = []

    func addFeedItem(_ item: FeedItem) {
        feedItems.append(item)
        persist()
    }
}

// Agent tool writes through shared service
tool("publish_to_feed", async ({ bookId, content, headline }) => {
    let item = FeedItem(bookId: bookId, content: content, headline: headline)
    BookLibraryService.shared.addFeedItem(item)  // Same service UI uses
    return { text: "Published to feed" }
})

// UI observes the same service
struct FeedView: View {
    @StateObject var library = BookLibraryService.shared

    var body: some View {
        List(library.feedItems) { item in
            FeedItemRow(item: item)
            // Automatically updates when agent adds items
        }
    }
}
```
**模式2：文件系统观察**

对于基于文件的数据，观察文件系统：
```swift
class ResearchWatcher: ObservableObject {
    @Published var files: [URL] = []
    private var watcher: DirectoryWatcher?

    func watch(bookId: String) {
        let path = documentsURL.appendingPathComponent("Research/\(bookId)")

        watcher = DirectoryWatcher(path: path) { [weak self] in
            self?.reload(from: path)
        }

        reload(from: path)
    }
}

// Agent writes files
tool("write_file", { path, content }) -> {
    writeFile(documentsURL.appendingPathComponent(path), content)
    // DirectoryWatcher triggers UI update automatically
}
```
**模式 3：事件总线（跨组件）**

对于具有多个独立组件的复杂应用程序：
```typescript
// Shared event bus
const agentEvents = new EventEmitter();

// Agent tool emits events
tool("publish_to_feed", async ({ content }) => {
    const item = await feedService.add(content);
    agentEvents.emit('feed:new-item', item);
    return { text: "Published" };
});

// UI components subscribe
function FeedView() {
    const [items, setItems] = useState([]);

    useEffect(() => {
        const handler = (item) => setItems(prev => [...prev, item]);
        agentEvents.on('feed:new-item', handler);
        return () => agentEvents.off('feed:new-item', handler);
    }, []);

    return <FeedList items={items} />;
}
```
**要避免什么：**
```swift
// BAD: UI doesn't observe agent changes
// Agent writes to database directly
tool("publish_to_feed", { content }) {
    database.insert("feed", content)  // UI doesn't see this
}

// UI loads once at startup, never refreshes
struct FeedView: View {
    let items = database.query("feed")  // Stale!
}
```
</模式>

<模式名称=“模型层选择”>
## 型号等级选择

不同的特工需要不同的情报水平。使用实现结果的最便宜的模型。

|代理类型 |推荐等级 |推理|
|------------|-----------------|------------|
|聊天/对话 |平衡 |反应快，推理好 |
|研究|平衡 |工具循环，而不是超复杂的综合 |
|内容生成|平衡 |有创意但不重综合 |
|复杂分析|强大|多文档综合，细致判断|
|简介/入职 |强大|照片分析、复杂模式识别|
|简单查询 |快/俳句 |快速查找，简单转换 |

**执行：**
```swift
enum ModelTier {
    case fast      // claude-3-haiku: Quick, cheap, simple tasks
    case balanced  // claude-3-sonnet: Good balance for most tasks
    case powerful  // claude-3-opus: Complex reasoning, synthesis
}

struct AgentConfig {
    let modelTier: ModelTier
    let tools: [AgentTool]
    let systemPrompt: String
}

// Research agent: balanced tier
let researchConfig = AgentConfig(
    modelTier: .balanced,
    tools: researchTools,
    systemPrompt: researchPrompt
)

// Profile analysis: powerful tier (complex photo interpretation)
let profileConfig = AgentConfig(
    modelTier: .powerful,
    tools: profileTools,
    systemPrompt: profilePrompt
)

// Quick lookup: fast tier
let lookupConfig = AgentConfig(
    modelTier: .fast,
    tools: [readLibrary],
    systemPrompt: "Answer quick questions about the user's library."
)
```
**成本优化策略：**
- 从平衡层开始，仅在质量不足时升级
- 使用快速层进行需要大量工具的循环，其中每个回合都很简单
- 为综合任务保留强大的层（比较多个来源）
- 考虑每回合的代币限制以控制成本
</模式>

<设计问题>
## 设计时要问的问题

1. **什么事件触发代理轮流？**（消息、webhooks、计时器、用户请求）
2. **代理需要什么原语？**（读、写、调用API、重启）
3. **代理应该做出什么决定？**（格式、结构、优先级、行动）
4. **哪些决策应该硬编码？**（安全边界、批准要求）
5. **代理如何验证其工作？**（健康检查、构建验证）
6. **代理如何从错误中恢复？**（git回滚，批准门）
7. **UI 如何知道代理何时更改状态？**（共享存储、文件监视、事件）
8. **每种代理类型需要什么模型层？**（快速、平衡、强大）
9. **代理如何共享基础设施？**（统一编排器，共享工具）
</设计问题>
