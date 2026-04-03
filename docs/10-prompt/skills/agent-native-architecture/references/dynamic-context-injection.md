<概述>
如何将动态运行时上下文注入代理系统提示中。代理需要知道应用程序中存在什么才能知道它可以使用什么。静态提示是不够的——代理需要看到与用户看到的相同的上下文。

**核心原则：** 用户的上下文就是代理的上下文。
</概述>

<为什么上下文很重要>
## 为什么要动态上下文注入？

静态系统提示告诉代理它可以做什么。动态上下文告诉它现在可以用用户的实际数据做什么。

**失败案例：**
```
User: "Write a little thing about Catherine the Great in my reading feed"
Agent: "What system are you referring to? I'm not sure what reading feed means."
```
代理失败是因为它不知道：
- 用户的图书馆中有哪些书籍
- 什么是“阅读提要”
- 有哪些工具可以在那里发布

**修复：** 将有关应用程序状态的运行时上下文注入系统提示符中。
</why_context_matters>

<模式名称=“上下文注入”>
## 上下文注入模式

动态构建系统提示符，包括当前应用程序状态：
```swift
func buildSystemPrompt() -> String {
    // Gather current state
    let availableBooks = libraryService.books
    let recentActivity = analysisService.recentRecords(limit: 10)
    let userProfile = profileService.currentProfile

    return """
    # Your Identity

    You are a reading assistant for \(userProfile.name)'s library.

    ## Available Books in User's Library

    \(availableBooks.map { "- \"\($0.title)\" by \($0.author) (id: \($0.id))" }.joined(separator: "\n"))

    ## Recent Reading Activity

    \(recentActivity.map { "- Analyzed \"\($0.bookTitle)\": \($0.excerptPreview)" }.joined(separator: "\n"))

    ## Your Capabilities

    - **publish_to_feed**: Create insights that appear in the Feed tab
    - **read_library**: View books, highlights, and analyses
    - **web_search**: Search the internet for research
    - **write_file**: Save research to Documents/Research/{bookId}/

    When the user mentions "the feed" or "reading feed", they mean the Feed tab
    where insights appear. Use `publish_to_feed` to create content there.
    """
}
```
</模式>

<要注入什么>
## 注入什么上下文

### 1. 可用资源
代理可以访问哪些数据/文件？
```swift
## Available in User's Library

Books:
- "Moby Dick" by Herman Melville (id: book_123)
- "1984" by George Orwell (id: book_456)

Research folders:
- Documents/Research/book_123/ (3 files)
- Documents/Research/book_456/ (1 file)
```
### 2.现状
用户最近做了什么？目前的背景是什么？
```swift
## Recent Activity

- 2 hours ago: Highlighted passage in "1984" about surveillance
- Yesterday: Completed research on "Moby Dick" whale symbolism
- This week: Added 3 new books to library
```
### 3. 能力映射
什么工具对应什么 UI 功能？使用用户的语言。
```swift
## What You Can Do

| User Says | You Should Use | Result |
|-----------|----------------|--------|
| "my feed" / "reading feed" | `publish_to_feed` | Creates insight in Feed tab |
| "my library" / "my books" | `read_library` | Shows their book collection |
| "research this" | `web_search` + `write_file` | Saves to Research folder |
| "my profile" | `read_file("profile.md")` | Shows reading profile |
```
### 4. 领域词汇
解释用户可能使用的特定于应用程序的术语。
```swift
## Vocabulary

- **Feed**: The Feed tab showing reading insights and analyses
- **Research folder**: Documents/Research/{bookId}/ where research is stored
- **Reading profile**: A markdown file describing user's reading preferences
- **Highlight**: A passage the user marked in a book
```
</要注入什么>

<实现模式>
## 实现模式

### 模式 1：基于服务的注入 (Swift/iOS)
```swift
class AgentContextBuilder {
    let libraryService: BookLibraryService
    let profileService: ReadingProfileService
    let activityService: ActivityService

    func buildContext() -> String {
        let books = libraryService.books
        let profile = profileService.currentProfile
        let activity = activityService.recent(limit: 10)

        return """
        ## Library (\(books.count) books)
        \(formatBooks(books))

        ## Profile
        \(profile.summary)

        ## Recent Activity
        \(formatActivity(activity))
        """
    }

    private func formatBooks(_ books: [Book]) -> String {
        books.map { "- \"\($0.title)\" (id: \($0.id))" }.joined(separator: "\n")
    }
}

// Usage in agent initialization
let context = AgentContextBuilder(
    libraryService: .shared,
    profileService: .shared,
    activityService: .shared
).buildContext()

let systemPrompt = basePrompt + "\n\n" + context
```
### 模式 2：基于 Hook 的注入 (TypeScript)
```typescript
interface ContextProvider {
  getContext(): Promise<string>;
}

class LibraryContextProvider implements ContextProvider {
  async getContext(): Promise<string> {
    const books = await db.books.list();
    const recent = await db.activity.recent(10);

    return `
## Library
${books.map(b => `- "${b.title}" (${b.id})`).join('\n')}

## Recent
${recent.map(r => `- ${r.description}`).join('\n')}
    `.trim();
  }
}

// Compose multiple providers
async function buildSystemPrompt(providers: ContextProvider[]): Promise<string> {
  const contexts = await Promise.all(providers.map(p => p.getContext()));
  return [BASE_PROMPT, ...contexts].join('\n\n');
}
```
### 模式 3：基于模板的注入
```markdown
# System Prompt Template (system-prompt.template.md)

You are a reading assistant.

## Available Books

{{#each books}}
- "{{title}}" by {{author}} (id: {{id}})
{{/each}}

## Capabilities

{{#each capabilities}}
- **{{name}}**: {{description}}
{{/each}}

## Recent Activity

{{#each recentActivity}}
- {{timestamp}}: {{description}}
{{/each}}
```

```typescript
// Render at runtime
const prompt = Handlebars.compile(template)({
  books: await libraryService.getBooks(),
  capabilities: getCapabilities(),
  recentActivity: await activityService.getRecent(10),
});
```
</实现模式>

<上下文新鲜度>
## 上下文新鲜度

上下文应该在代理初始化时注入，并且可以选择在长时间会话期间刷新。

**初始化时：**
```swift
// Always inject fresh context when starting an agent
func startChatAgent() async -> AgentSession {
    let context = await buildCurrentContext()  // Fresh context
    return await AgentOrchestrator.shared.startAgent(
        config: ChatAgent.config,
        systemPrompt: basePrompt + context
    )
}
```
**在长时间会议期间（可选）：**
```swift
// For long-running agents, provide a refresh tool
tool("refresh_context", "Get current app state") { _ in
    let books = libraryService.books
    let recent = activityService.recent(10)
    return """
    Current library: \(books.count) books
    Recent: \(recent.map { $0.summary }.joined(separator: ", "))
    """
}
```
**不应该做什么：**
```swift
// DON'T: Use stale context from app launch
let cachedContext = appLaunchContext  // Stale!
// Books may have been added, activity may have changed
```
</context_freshness>

<例子>
## 现实世界的例子：每个读者

Every Reader 应用程序为其聊天代理注入上下文：
```swift
func getChatAgentSystemPrompt() -> String {
    // Get current library state
    let books = BookLibraryService.shared.books
    let analyses = BookLibraryService.shared.analysisRecords.prefix(10)
    let profile = ReadingProfileService.shared.getProfileForSystemPrompt()

    let bookList = books.map { book in
        "- \"\(book.title)\" by \(book.author) (id: \(book.id))"
    }.joined(separator: "\n")

    let recentList = analyses.map { record in
        let title = books.first { $0.id == record.bookId }?.title ?? "Unknown"
        return "- From \"\(title)\": \"\(record.excerptPreview)\""
    }.joined(separator: "\n")

    return """
    # Reading Assistant

    You help the user with their reading and book research.

    ## Available Books in User's Library

    \(bookList.isEmpty ? "No books yet." : bookList)

    ## Recent Reading Journal (Latest Analyses)

    \(recentList.isEmpty ? "No analyses yet." : recentList)

    ## Reading Profile

    \(profile)

    ## Your Capabilities

    - **Publish to Feed**: Create insights using `publish_to_feed` that appear in the Feed tab
    - **Library Access**: View books and highlights using `read_library`
    - **Research**: Search web and save to Documents/Research/{bookId}/
    - **Profile**: Read/update the user's reading profile

    When the user asks you to "write something for their feed" or "add to my reading feed",
    use the `publish_to_feed` tool with the relevant book_id.
    """
}
```
**结果：** 当用户说“在我的阅读提要中写一些关于叶卡捷琳娜大帝的事情”时，代理：
1.看到“阅读提要”→知道使用`publish_to_feed`
2.查看可用书籍→查找相关书籍ID
3. 为 Feed 选项卡创建适当的内容
</例子>

<清单>
## 上下文注入清单

启动代理之前：
- [ ]系统提示包含当前资源（书籍、文件、数据）
- [ ] 代理可以看到最近的活动
- [ ] 功能映射到用户词汇表
- [ ] 领域特定术语的解释
- [ ] 上下文是新鲜的（在代理启动时收集，未缓存）

添加新功能时：
- [ ] 新资源包含在上下文注入中
- [ ] 新功能记录在系统提示符中
- [ ] 映射该功能的用户词汇
</清单>
