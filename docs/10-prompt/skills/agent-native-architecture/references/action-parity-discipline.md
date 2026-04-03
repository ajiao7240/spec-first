<概述>
确保代理可以完成用户可以做的所有事情的结构化规则。每个 UI 操作都应该有一个等效的代理工具。这不是一次性检查，而是集成到您的开发工作流程中的持续实践。

**核心原则：** 添加UI功能时，在同一个PR中添加相应的工具。
</概述>

<为什么奇偶校验>
## 为什么行动平等很重要

**失败案例：**
```
User: "Write something about Catherine the Great in my reading feed"
Agent: "What system are you referring to? I'm not sure what reading feed means."
```
用户可以通过 UI 发布到他们的提要。但特工没有`publish_to_feed`工具。解决方法很简单——添加工具。但其中的见解却是深刻的：

**用户可以通过 UI 执行的每个操作都必须有代理可以调用的等效工具。**

如果没有这个奇偶校验：
- 用户要求代理商做他们不能做的事情
- 代理询问有关他们应该理解的功能的澄清问题
- 与直接使用应用程序相比，代理感觉受到限制
- 用户对代理的能力失去信任
</why_parity>

<能力映射>
## 能力图

维护 UI 操作到代理工具的结构化映射：

|用户界面操作 |用户界面位置 |代理工具|系统提示参考|
|------------|-------------|------------|------------------------|
|查看图书馆 |图书馆选项卡 | `read_library` | “查看书籍和亮点”|
|添加图书 |图书馆 → 添加 | `add_book` | “将书籍添加到图书馆” |
|发表见解 |分析视图| `publish_to_feed` | “为 Feed 选项卡创建见解”|
|开始研究 |图书详情 | `start_research` | “通过网络搜索研究书籍”|
|编辑个人资料 |设置 | `write_file(profile.md)` | “更新阅读资料”|
|截图|相机 |不适用（用户操作）| — |
|搜索网页 |聊天 | `web_search` | “搜索互联网” |

**每当添加功能时更新此表。**

### 您的应用程序模板
```markdown
# Capability Map - [Your App Name]

| UI Action | UI Location | Agent Tool | System Prompt | Status |
|-----------|-------------|------------|---------------|--------|
| | | | | ⚠️ Missing |
| | | | | ✅ Done |
| | | | | 🚫 N/A |
```
状态含义：
- ✅ 完成：工具存在并记录在系统提示中
- ⚠️ 缺失：UI 操作存在，但没有等效的代理
- 🚫 N/A：仅限用户执行的操作（例如生物识别身份验证、相机捕获）
</能力映射>

<奇偶校验工作流程>
## Action Parity 工作流程

### 添加新功能时

在合并任何添加 UI 功能的 PR 之前：
```
1. What action is this?
   → "User can publish an insight to their reading feed"

2. Does an agent tool exist for this?
   → Check tool definitions
   → If NO: Create the tool

3. Is it documented in the system prompt?
   → Check system prompt capabilities section
   → If NO: Add documentation

4. Is the context available?
   → Does agent know what "feed" means?
   → Does agent see available books?
   → If NO: Add to context injection

5. Update the capability map
   → Add row to tracking document
```
### 公关清单

添加到您的 PR 模板：
```markdown
## Agent-Native Checklist

- [ ] Every new UI action has a corresponding agent tool
- [ ] System prompt updated to mention new capability
- [ ] Agent has access to same data UI uses
- [ ] Capability map updated
- [ ] Tested with natural language request
```
</parity_工作流程>

<奇偶校验>
## 奇偶校验

定期审核您的应用程序是否存在操作平等差距：

### 第 1 步：列出所有 UI 操作

浏览每个屏幕并列出用户可以执行的操作：
```
Library Screen:
- View list of books
- Search books
- Filter by category
- Add new book
- Delete book
- Open book detail

Book Detail Screen:
- View book info
- Start research
- View highlights
- Add highlight
- Share book
- Remove from library

Feed Screen:
- View insights
- Create new insight
- Edit insight
- Delete insight
- Share insight

Settings:
- Edit profile
- Change theme
- Export data
- Delete account
```
### 第 2 步：检查工具覆盖范围

对于每个操作，验证：
```
✅ View list of books      → read_library
✅ Search books            → read_library (with query param)
⚠️ Filter by category     → MISSING (add filter param to read_library)
⚠️ Add new book           → MISSING (need add_book tool)
✅ Delete book             → delete_book
✅ Open book detail        → read_library (single book)

✅ Start research          → start_research
✅ View highlights         → read_library (includes highlights)
⚠️ Add highlight          → MISSING (need add_highlight tool)
⚠️ Share book             → MISSING (or N/A if sharing is UI-only)

✅ View insights           → read_library (includes feed)
✅ Create new insight      → publish_to_feed
⚠️ Edit insight           → MISSING (need update_feed_item tool)
⚠️ Delete insight         → MISSING (need delete_feed_item tool)
```
### 第 3 步：确定差距的优先顺序

并非所有间隙都是相等的：

**高优先级（用户会要求这样做）：**
- 添加新书
- 创建/编辑/删除内容
- 核心工作流程操作

**中优先级（偶尔请求）：**
- 过滤/搜索变体
- 导出功能
- 分享功能

**低优先级（很少通过代理请求）：**
- 主题更改
- 帐户删除
- UI 偏好设置
</parity_audit>

<奇偶校验工具设计>
## 设计奇偶校验工具

### 将工具粒度与 UI 粒度相匹配

如果 UI 有单独的“编辑”和“删除”按钮，请考虑单独的工具：
```typescript
// Matches UI granularity
tool("update_feed_item", { id, content, headline }, ...);
tool("delete_feed_item", { id }, ...);

// vs. combined (harder for agent to discover)
tool("modify_feed_item", { id, action: "update" | "delete", ... }, ...);
```
### 在工具名称中使用用户词汇
```typescript
// Good: Matches what users say
tool("publish_to_feed", ...);  // "publish to my feed"
tool("add_book", ...);         // "add this book"
tool("start_research", ...);   // "research this"

// Bad: Technical jargon
tool("create_analysis_record", ...);
tool("insert_library_item", ...);
tool("initiate_web_scrape_workflow", ...);
```
### 返回 UI 显示的内容

如果 UI 显示包含详细信息的确认信息，该工具也应该：
```typescript
// UI shows: "Added 'Moby Dick' to your library"
// Tool should return the same:
tool("add_book", async ({ title, author }) => {
  const book = await library.add({ title, author });
  return {
    text: `Added "${book.title}" by ${book.author} to your library (id: ${book.id})`
  };
});
```
</tool_design_for_parity>

<上下文奇偶性>
## 上下文奇偶校验

无论用户看到什么，代理都应该能够访问。

＃＃＃ 问题
```swift
// UI shows recent analyses in a list
ForEach(analysisRecords) { record in
    AnalysisRow(record: record)
}

// But system prompt only mentions books, not analyses
let systemPrompt = """
## Available Books
\(books.map { $0.title })
// Missing: recent analyses!
"""
```
用户看到他们的阅读日记。代理没有。这会造成脱节。

### 修复
```swift
// System prompt includes what UI shows
let systemPrompt = """
## Available Books
\(books.map { "- \($0.title)" }.joined(separator: "\n"))

## Recent Reading Journal
\(analysisRecords.prefix(10).map { "- \($0.summary)" }.joined(separator: "\n"))
"""
```
### 上下文奇偶校验清单

对于应用程序中的每个屏幕：
- [ ] 该屏幕显示什么数据？
- [ ] 该数据可供代理使用吗？
- [ ] 代理可以访问相同级别的详细信息吗？
</context_parity>

<连续奇偶校验>
## 随着时间的推移保持平价

### Git Hooks/CI 检查
```bash
#!/bin/bash
# pre-commit hook: check for new UI actions without tools

# Find new SwiftUI Button/onTapGesture additions
NEW_ACTIONS=$(git diff --cached --name-only | xargs grep -l "Button\|onTapGesture")

if [ -n "$NEW_ACTIONS" ]; then
    echo "⚠️  New UI actions detected. Did you add corresponding agent tools?"
    echo "Files: $NEW_ACTIONS"
    echo ""
    echo "Checklist:"
    echo "  [ ] Agent tool exists for new action"
    echo "  [ ] System prompt documents new capability"
    echo "  [ ] Capability map updated"
fi
```
### 自动奇偶校验测试
```typescript
// parity.test.ts
describe('Action Parity', () => {
  const capabilityMap = loadCapabilityMap();

  for (const [action, toolName] of Object.entries(capabilityMap)) {
    if (toolName === 'N/A') continue;

    test(`${action} has agent tool: ${toolName}`, () => {
      expect(agentTools.map(t => t.name)).toContain(toolName);
    });

    test(`${toolName} is documented in system prompt`, () => {
      expect(systemPrompt).toContain(toolName);
    });
  }
});
```
### 定期审核

安排定期审查：
```markdown
## Monthly Parity Audit

1. Review all PRs merged this month
2. Check each for new UI actions
3. Verify tool coverage
4. Update capability map
5. Test with natural language requests
```
</连续奇偶校验>

<例子>
## 真实示例：饲料缺口

**之前：** 每个读者都有一个显示见解的提要，但没有可以在那里发布的代理工具。
```
User: "Write something about Catherine the Great in my reading feed"
Agent: "I'm not sure what system you're referring to. Could you clarify?"
```
**诊断：**
- ✅ UI 操作：用户可以从分析视图发布见解
- ❌代理工具：无`publish_to_feed`工具
- ❌系统提示：没有提及“feed”或如何发布
- ❌ 背景：特工不知道“feed”是什么意思

**修复：**
```swift
// 1. Add the tool
tool("publish_to_feed",
    "Publish an insight to the user's reading feed",
    {
        bookId: z.string().describe("Book ID"),
        content: z.string().describe("The insight content"),
        headline: z.string().describe("A punchy headline")
    },
    async ({ bookId, content, headline }) => {
        await feedService.publish({ bookId, content, headline });
        return { text: `Published "${headline}" to your reading feed` };
    }
);

// 2. Update system prompt
"""
## Your Capabilities

- **Publish to Feed**: Create insights that appear in the Feed tab using `publish_to_feed`.
  Include a book_id, content, and a punchy headline.
"""

// 3. Add to context injection
"""
When the user mentions "the feed" or "reading feed", they mean the Feed tab
where insights appear. Use `publish_to_feed` to create content there.
"""
```
**后：**
```
User: "Write something about Catherine the Great in my reading feed"
Agent: [Uses publish_to_feed to create insight]
       "Done! I've published 'The Enlightened Empress' to your reading feed."
```
</例子>

<清单>
## 行动对等清单

对于每个带有 UI 更改的 PR：
- [ ] 列出了所有新的 UI 操作
- [ ] 每个操作均存在经过验证的代理工具
- [ ] 使用新功能更新了系统提示
- [ ] 添加到能力地图
- [ ] 使用自然语言请求进行测试

对于定期审核：
- [ ] 走过每个屏幕
- [ ] 列出所有可能的用户操作
- [ ] 检查每个工具的覆盖范围
- [ ] 根据用户请求的可能性对差距进行优先排序
- [ ] 为高优先级差距创建问题
</清单>
