<概述>
移动是代理原生应用程序的一流平台。它具有独特的限制和机会。本指南涵盖了为什么移动很重要、iOS 存储架构、检查点/恢复模式和成本意识设计。
</概述>

<为什么_手机>
## 为什么移动很重要

移动设备为代理本机应用程序提供了独特的优势：

### 文件系统
代理可以自然地处理文件，使用与其他地方相同的原语。文件系统是通用接口。

### 丰富的上下文
您可以进入一个有围墙的花园。健康数据、位置、照片、日历——桌面或网络上不存在的上下文。这可以实现深度个性化的座席体验。

### 本地应用程序
每个人都有自己的应用程序副本。这带来了尚未完全实现的机会：可以自我修改、自我分叉、按用户进化的应用程序。如今，App Store 政策限制了其中一些，但基础已经存在。

### 跨设备同步
如果您将文件系统与 iCloud 一起使用，则所有设备共享相同的文件系统。代理在一台设备上的工作会出现在所有设备上，而无需构建服务器。

### 挑战

**代理是长期运行的。移动应用程序则不然。**

代理可能需要 30 秒、5 分钟或 1 小时才能完成任务。但 iOS 会在您的应用程序几秒钟不活动后将其置于后台，并可能完全终止它以回收内存。用户可能会在执行任务时切换应用程序、接听电话或锁定手机。

这意味着移动代理应用程序需要：
- **检查点** — 保存状态，这样工作就不会丢失
- **继续** — 中断后从上次中断的地方继续
- **后台执行** — 明智地利用 iOS 给你的有限时间
- **设备上与云决策** — 本地运行与需要服务器的内容
</wh_mobile><ios_存储>
## iOS 存储架构

> **需要验证：** 这是一种效果很好的方法，但可能存在更好的解决方案。

对于代理本机 iOS 应用程序，请使用 iCloud Drive 的文档文件夹作为共享工作区。这为您提供**免费、自动的多设备同步**，无需构建同步层或运行服务器。

### 为什么选择 iCloud 文档？

|方法|成本|复杂性 |离线 |多设备|
|----------|------|------------|---------|----------------|
|自定义后端+同步| $$$ |高|手册|是的 |
| CloudKit数据库|免费套餐限制 |中等|手册|是的 |
| **iCloud 文档** |免费（用户的存储空间）|低|自动|自动|

iCloud 文档：
- 使用用户现有的 iCloud 存储空间（免费 5GB，大多数用户有更多）
- 在所有用户设备之间自动同步
- 离线工作，在线同步
- 文件在 Files.app 中可见以实现透明度
- 无服务器成本，无需维护同步代码

### 实施：iCloud-First 和本地后备
```swift
// Get the iCloud Documents container
func iCloudDocumentsURL() -> URL? {
    FileManager.default.url(forUbiquityContainerIdentifier: nil)?
        .appendingPathComponent("Documents")
}

// Your shared workspace lives in iCloud
class SharedWorkspace {
    let rootURL: URL

    init() {
        // Use iCloud if available, fall back to local
        if let iCloudURL = iCloudDocumentsURL() {
            self.rootURL = iCloudURL
        } else {
            // Fallback to local Documents (user not signed into iCloud)
            self.rootURL = FileManager.default.urls(
                for: .documentDirectory,
                in: .userDomainMask
            ).first!
        }
    }

    // All file operations go through this root
    func researchPath(for bookId: String) -> URL {
        rootURL.appendingPathComponent("Research/\(bookId)")
    }

    func journalPath() -> URL {
        rootURL.appendingPathComponent("Journal")
    }
}
```
### iCloud 中的目录结构
```
iCloud Drive/
└── YourApp/                          # Your app's container
    └── Documents/                    # Visible in Files.app
        ├── Journal/
        │   ├── user/
        │   │   └── 2025-01-15.md     # Syncs across devices
        │   └── agent/
        │       └── 2025-01-15.md     # Agent observations sync too
        ├── Research/
        │   └── {bookId}/
        │       ├── full_text.txt
        │       └── sources/
        ├── Chats/
        │   └── {conversationId}.json
        └── context.md                # Agent's accumulated knowledge
```
### 处理 iCloud 文件状态

iCloud 文件可能无法下载到本地。处理这个：
```swift
func readFile(at url: URL) throws -> String {
    // iCloud may create .icloud placeholder files
    if url.pathExtension == "icloud" {
        // Trigger download
        try FileManager.default.startDownloadingUbiquitousItem(at: url)
        throw FileNotYetAvailableError()
    }

    return try String(contentsOf: url, encoding: .utf8)
}

// For writes, use coordinated file access
func writeFile(_ content: String, to url: URL) throws {
    let coordinator = NSFileCoordinator()
    var error: NSError?

    coordinator.coordinate(
        writingItemAt: url,
        options: .forReplacing,
        error: &error
    ) { newURL in
        try? content.write(to: newURL, atomically: true, encoding: .utf8)
    }

    if let error = error { throw error }
}
```
### iCloud 的功能

1. **用户在 iPhone 上开始实验** → 代理创建配置文件
2. **用户在 iPad 上打开应用程序** → 相同的实验可见，无需同步代码
3. **代理在 iPhone 上记录观察结果** → 自动同步到 iPad
4. **用户在 iPad 上编辑日记** → iPhone 会看到编辑内容

### 所需权利

添加到您的应用程序的权利：
```xml
<key>com.apple.developer.icloud-container-identifiers</key>
<array>
    <string>iCloud.com.yourcompany.yourapp</string>
</array>
<key>com.apple.developer.icloud-services</key>
<array>
    <string>CloudDocuments</string>
</array>
<key>com.apple.developer.ubiquity-container-identifiers</key>
<array>
    <string>iCloud.com.yourcompany.yourapp</string>
</array>
```
### 何时不使用 iCloud 文档

- **敏感数据** - 使用钥匙串或加密的本地存储代替
- **高频写入** - iCloud 同步有延迟；使用本地+定期同步
- **大型媒体文件** - 考虑 CloudKit 资产或点播资源
- **在用户之间共享** - iCloud 文档是单用户的；使用CloudKit进行共享
</ios_存储>

<后台执行>
## 后台执行和恢复

> **需要验证：** 这些模式有效，但可能存在更好的解决方案。

移动应用程序可以随时暂停或终止。特工必须妥善处理此事。

### 挑战
```
User starts research agent
     ↓
Agent begins web search
     ↓
User switches to another app
     ↓
iOS suspends your app
     ↓
Agent is mid-execution... what happens?
```
### Checkpoint/Resume Pattern

在后台保存代理状态，在前台恢复：
```swift
class AgentOrchestrator: ObservableObject {
    @Published var activeSessions: [AgentSession] = []

    // Called when app is about to background
    func handleAppWillBackground() {
        for session in activeSessions {
            saveCheckpoint(session)
            session.transition(to: .backgrounded)
        }
    }

    // Called when app returns to foreground
    func handleAppDidForeground() {
        for session in activeSessions where session.state == .backgrounded {
            if let checkpoint = loadCheckpoint(session.id) {
                resumeFromCheckpoint(session, checkpoint)
            }
        }
    }

    private func saveCheckpoint(_ session: AgentSession) {
        let checkpoint = AgentCheckpoint(
            sessionId: session.id,
            conversationHistory: session.messages,
            pendingToolCalls: session.pendingToolCalls,
            partialResults: session.partialResults,
            timestamp: Date()
        )
        storage.save(checkpoint, for: session.id)
    }

    private func resumeFromCheckpoint(_ session: AgentSession, _ checkpoint: AgentCheckpoint) {
        session.messages = checkpoint.conversationHistory
        session.pendingToolCalls = checkpoint.pendingToolCalls

        // Resume execution if there were pending tool calls
        if !checkpoint.pendingToolCalls.isEmpty {
            session.transition(to: .running)
            Task { await executeNextTool(session) }
        }
    }
}
```
### 代理生命周期的状态机
```swift
enum AgentState {
    case idle           // Not running
    case running        // Actively executing
    case waitingForUser // Paused, waiting for user input
    case backgrounded   // App backgrounded, state saved
    case completed      // Finished successfully
    case failed(Error)  // Finished with error
}

class AgentSession: ObservableObject {
    @Published var state: AgentState = .idle

    func transition(to newState: AgentState) {
        let validTransitions: [AgentState: Set<AgentState>] = [
            .idle: [.running],
            .running: [.waitingForUser, .backgrounded, .completed, .failed],
            .waitingForUser: [.running, .backgrounded],
            .backgrounded: [.running, .completed],
        ]

        guard validTransitions[state]?.contains(newState) == true else {
            logger.warning("Invalid transition: \(state) → \(newState)")
            return
        }

        state = newState
    }
}
```
### Background Task Extension (iOS)

在关键操作期间处于后台时请求额外时间：
```swift
class AgentOrchestrator {
    private var backgroundTask: UIBackgroundTaskIdentifier = .invalid

    func handleAppWillBackground() {
        // Request extra time for saving state
        backgroundTask = UIApplication.shared.beginBackgroundTask { [weak self] in
            self?.endBackgroundTask()
        }

        // Save all checkpoints
        Task {
            for session in activeSessions {
                await saveCheckpoint(session)
            }
            endBackgroundTask()
        }
    }

    private func endBackgroundTask() {
        if backgroundTask != .invalid {
            UIApplication.shared.endBackgroundTask(backgroundTask)
            backgroundTask = .invalid
        }
    }
}
```
### 用户沟通

让用户知道发生了什么：
```swift
struct AgentStatusView: View {
    @ObservedObject var session: AgentSession

    var body: some View {
        switch session.state {
        case .backgrounded:
            Label("Paused (app in background)", systemImage: "pause.circle")
                .foregroundColor(.orange)
        case .running:
            Label("Working...", systemImage: "ellipsis.circle")
                .foregroundColor(.blue)
        case .waitingForUser:
            Label("Waiting for your input", systemImage: "person.circle")
                .foregroundColor(.green)
        // ...
        }
    }
}
```
</background_execution>

<权限>
## 权限处理

移动代理可能需要访问系统资源。优雅地处理权限请求。

### 通用权限

|资源 | iOS 权限 |使用案例|
|----------|--------------|----------|
|图片库| PH照片库 |从照片生成个人资料 |
|文件|文档选择器 |阅读用户文档 |
|相机 | AV 捕获设备 |扫描书籍封面|
|地点 | CL位置管理器|位置感知推荐 |
|网络| （自动）|网页搜索、API 调用 |

### 权限感知工具

执行前检查权限：
```swift
struct PhotoTools {
    static func readPhotos() -> AgentTool {
        tool(
            name: "read_photos",
            description: "Read photos from the user's photo library",
            parameters: [
                "limit": .number("Maximum photos to read"),
                "dateRange": .string("Date range filter").optional()
            ],
            execute: { params, context in
                // Check permission first
                let status = await PHPhotoLibrary.requestAuthorization(for: .readWrite)

                switch status {
                case .authorized, .limited:
                    // Proceed with reading photos
                    let photos = await fetchPhotos(params)
                    return ToolResult(text: "Found \(photos.count) photos", images: photos)

                case .denied, .restricted:
                    return ToolResult(
                        text: "Photo access needed. Please grant permission in Settings → Privacy → Photos.",
                        isError: true
                    )

                case .notDetermined:
                    return ToolResult(
                        text: "Photo permission required. Please try again.",
                        isError: true
                    )

                @unknown default:
                    return ToolResult(text: "Unknown permission status", isError: true)
                }
            }
        )
    }
}
```
### 优雅的降级

如果未授予权限，请提供替代方案：
```swift
func readPhotos() async -> ToolResult {
    let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)

    switch status {
    case .denied, .restricted:
        // Suggest alternative
        return ToolResult(
            text: """
            I don't have access to your photos. You can either:
            1. Grant access in Settings → Privacy → Photos
            2. Share specific photos directly in our chat

            Would you like me to help with something else instead?
            """,
            isError: false  // Not a hard error, just a limitation
        )
    // ...
    }
}
```
### 权限请求时序

在需要之前不要请求权限：
```swift
// BAD: Request all permissions at launch
func applicationDidFinishLaunching() {
    requestPhotoAccess()
    requestCameraAccess()
    requestLocationAccess()
    // User is overwhelmed with permission dialogs
}

// GOOD: Request when the feature is used
tool("analyze_book_cover", async ({ image }) => {
    // Only request camera access when user tries to scan a cover
    let status = await AVCaptureDevice.requestAccess(for: .video)
    if status {
        return await scanCover(image)
    } else {
        return ToolResult(text: "Camera access needed for book scanning")
    }
})
```
</权限>

<成本意识>
## 成本意识设计

移动用户可能使用蜂窝数据或担心 API 成本。设计高效的代理。

### 模型层选择

使用实现结果的最便宜的模型：
```swift
enum ModelTier {
    case fast      // claude-3-haiku: ~$0.25/1M tokens
    case balanced  // claude-3-sonnet: ~$3/1M tokens
    case powerful  // claude-3-opus: ~$15/1M tokens

    var modelId: String {
        switch self {
        case .fast: return "claude-3-haiku-20240307"
        case .balanced: return "claude-3-sonnet-20240229"
        case .powerful: return "claude-3-opus-20240229"
        }
    }
}

// Match model to task complexity
let agentConfigs: [AgentType: ModelTier] = [
    .quickLookup: .fast,        // "What's in my library?"
    .chatAssistant: .balanced,  // General conversation
    .researchAgent: .balanced,  // Web search + synthesis
    .profileGenerator: .powerful, // Complex photo analysis
    .introductionWriter: .balanced,
]
```
### 代币预算

限制每个代理会话的令牌：
```swift
struct AgentConfig {
    let modelTier: ModelTier
    let maxInputTokens: Int
    let maxOutputTokens: Int
    let maxTurns: Int

    static let research = AgentConfig(
        modelTier: .balanced,
        maxInputTokens: 50_000,
        maxOutputTokens: 4_000,
        maxTurns: 20
    )

    static let quickChat = AgentConfig(
        modelTier: .fast,
        maxInputTokens: 10_000,
        maxOutputTokens: 1_000,
        maxTurns: 5
    )
}

class AgentSession {
    var totalTokensUsed: Int = 0

    func checkBudget() -> Bool {
        if totalTokensUsed > config.maxInputTokens {
            transition(to: .failed(AgentError.budgetExceeded))
            return false
        }
        return true
    }
}
```
### 网络感知执行

将繁重的操作推迟到 WiFi：
```swift
class NetworkMonitor: ObservableObject {
    @Published var isOnWiFi: Bool = false
    @Published var isExpensive: Bool = false  // Cellular or hotspot

    private let monitor = NWPathMonitor()

    func startMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.isOnWiFi = path.usesInterfaceType(.wifi)
                self?.isExpensive = path.isExpensive
            }
        }
        monitor.start(queue: .global())
    }
}

class AgentOrchestrator {
    @ObservedObject var network = NetworkMonitor()

    func startResearchAgent(for book: Book) async {
        if network.isExpensive {
            // Warn user or defer
            let proceed = await showAlert(
                "Research uses data",
                message: "This will use approximately 1-2 MB of cellular data. Continue?"
            )
            if !proceed { return }
        }

        // Proceed with research
        await runAgent(ResearchAgent.create(book: book))
    }
}
```
### 批量API调用

合并多个小请求：
```swift
// BAD: Many small API calls
for book in books {
    await agent.chat("Summarize \(book.title)")
}

// GOOD: Batch into one request
let bookList = books.map { $0.title }.joined(separator: ", ")
await agent.chat("Summarize each of these books briefly: \(bookList)")
```
### 缓存

缓存昂贵的操作：
```swift
class ResearchCache {
    private var cache: [String: CachedResearch] = [:]

    func getCachedResearch(for bookId: String) -> CachedResearch? {
        guard let cached = cache[bookId] else { return nil }

        // Expire after 24 hours
        if Date().timeIntervalSince(cached.timestamp) > 86400 {
            cache.removeValue(forKey: bookId)
            return nil
        }

        return cached
    }

    func cacheResearch(_ research: Research, for bookId: String) {
        cache[bookId] = CachedResearch(
            research: research,
            timestamp: Date()
        )
    }
}

// In research tool
tool("web_search", async ({ query, bookId }) => {
    // Check cache first
    if let cached = cache.getCachedResearch(for: bookId) {
        return ToolResult(text: cached.research.summary, cached: true)
    }

    // Otherwise, perform search
    let results = await webSearch(query)
    cache.cacheResearch(results, for: bookId)
    return ToolResult(text: results.summary)
})
```
### 成本可见性

向用户展示他们的支出：
```swift
struct AgentCostView: View {
    @ObservedObject var session: AgentSession

    var body: some View {
        VStack(alignment: .leading) {
            Text("Session Stats")
                .font(.headline)

            HStack {
                Label("\(session.turnCount) turns", systemImage: "arrow.2.squarepath")
                Spacer()
                Label(formatTokens(session.totalTokensUsed), systemImage: "text.word.spacing")
            }

            if let estimatedCost = session.estimatedCost {
                Text("Est. cost: \(estimatedCost, format: .currency(code: "USD"))")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }
}
```
</成本意识>

<离线处理>
## 离线优雅降级

优雅地处理离线场景：
```swift
class ConnectivityAwareAgent {
    @ObservedObject var network = NetworkMonitor()

    func executeToolCall(_ toolCall: ToolCall) async -> ToolResult {
        // Check if tool requires network
        let requiresNetwork = ["web_search", "web_fetch", "call_api"]
            .contains(toolCall.name)

        if requiresNetwork && !network.isConnected {
            return ToolResult(
                text: """
                I can't access the internet right now. Here's what I can do offline:
                - Read your library and existing research
                - Answer questions from cached data
                - Write notes and drafts for later

                Would you like me to try something that works offline?
                """,
                isError: false
            )
        }

        return await executeOnline(toolCall)
    }
}
```
### 离线优先工具

有些工具应该完全离线工作：
```swift
let offlineTools: Set<String> = [
    "read_file",
    "write_file",
    "list_files",
    "read_library",  // Local database
    "search_local",  // Local search
]

let onlineTools: Set<String> = [
    "web_search",
    "web_fetch",
    "publish_to_cloud",
]

let hybridTools: Set<String> = [
    "publish_to_feed",  // Works offline, syncs later
]
```
### 排队操作

需要连接的队列操作：
```swift
class OfflineQueue: ObservableObject {
    @Published var pendingActions: [QueuedAction] = []

    func queue(_ action: QueuedAction) {
        pendingActions.append(action)
        persist()
    }

    func processWhenOnline() {
        network.$isConnected
            .filter { $0 }
            .sink { [weak self] _ in
                self?.processPendingActions()
            }
    }

    private func processPendingActions() {
        for action in pendingActions {
            Task {
                try await execute(action)
                remove(action)
            }
        }
    }
}
```
</offline_handling>

<电池感知>
## 电池感知执行

尊重设备电池状态：
```swift
class BatteryMonitor: ObservableObject {
    @Published var batteryLevel: Float = 1.0
    @Published var isCharging: Bool = false
    @Published var isLowPowerMode: Bool = false

    var shouldDeferHeavyWork: Bool {
        return batteryLevel < 0.2 && !isCharging
    }

    func startMonitoring() {
        UIDevice.current.isBatteryMonitoringEnabled = true

        NotificationCenter.default.addObserver(
            forName: UIDevice.batteryLevelDidChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.batteryLevel = UIDevice.current.batteryLevel
        }

        NotificationCenter.default.addObserver(
            forName: NSNotification.Name.NSProcessInfoPowerStateDidChange,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.isLowPowerMode = ProcessInfo.processInfo.isLowPowerModeEnabled
        }
    }
}

class AgentOrchestrator {
    @ObservedObject var battery = BatteryMonitor()

    func startAgent(_ config: AgentConfig) async {
        if battery.shouldDeferHeavyWork && config.isHeavy {
            let proceed = await showAlert(
                "Low Battery",
                message: "This task uses significant battery. Continue or defer until charging?"
            )
            if !proceed { return }
        }

        // Adjust model tier based on battery
        let adjustedConfig = battery.isLowPowerMode
            ? config.withModelTier(.fast)
            : config

        await runAgent(adjustedConfig)
    }
}
```
</电池意识>

<设备上与云上>
## 设备端与云端

了解移动代理本机应用程序中的运行位置：

|组件|设备上 |云|
|------------|------------|--------|
|编排| ✅ | |
|工具执行 | ✅（文件操作、照片访问、HealthKit）| |
| LLM 电话 | | ✅（人择 API）|
|检查站| ✅（本地文件）|可选通过 iCloud |
|长期代理|受 iOS 限制 |可以通过服务器 |

### 影响

**推理所需网络：**
- 该应用程序需要网络连接才能进行 LLM 调用
- 设计工具在网络不可用时优雅地降级
- 考虑对常见查询进行离线缓存

**数据保留在本地：**
- 文件操作发生在设备上
- 除非明确同步，否则敏感数据永远不会离开设备
- 默认情况下保留隐私

**长期代理：**
对于真正长时间运行的代理（数小时），请考虑可以无限期运行的服务器端编排器，并使用移动应用程序作为查看器和输入机制。
</on_device_vs_cloud>

<清单>
## 移动代理-本机检查表

**iOS 存储：**
- [ ] iCloud Documents 作为主存储（或有意识的替代方案）
- [ ] 当 iCloud 不可用时本地文档回退
- [ ] 处理 `.icloud` 占位符文件（触发下载）
- [ ] 使用 NSFileCoordinator 进行冲突安全写入

**后台执行：**
- [ ] 为所有代理会话实施检查点/恢复
- [ ] 代理生命周期的状态机（空闲、运行、后台等）
- [ ] 关键保存的后台任务扩展（30 秒窗口）
- [ ] 后台代理的用户可见状态**权限：**
- [ ] 仅在需要时请求权限，而不是在启动时请求
- [ ] 权限被拒绝时优雅降级
- [ ] 使用设置深层链接清除错误消息
- [ ] 权限不可用时的替代路径

**成本意识：**
- [ ] 模型层与任务复杂性相匹配
- [ ] 每个会话的代币预算
- [ ] 网络感知（将繁重的工作推迟到 WiFi）
- [ ] 缓存昂贵的操作
- [ ] 用户的成本可见性

**离线处理：**
- [ ] 识别出具有离线功能的工具
- [ ] 仅在线功能的优雅降级
- [ ] 在线同步的操作队列
- [ ] 清除有关离线状态的用户通信

**电池意识：**
- [ ] 重型操作的电池监控
- [ ] 低功耗模式检测
- [ ] 根据电池状态推迟或降级
</清单>
