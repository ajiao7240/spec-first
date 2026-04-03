<概述>
测试代理本机应用程序需要与传统单元测试不同的方法。您正在测试代理是否实现结果，而不是测试它是否调用特定函数。本指南提供了具体的测试模式，用于验证您的应用程序是否真正是代理原生的。
</概述>

<测试哲学>
## 测试理念

### 测试结果，而不是程序

**传统（注重程序）：**
```typescript
// Testing that a specific function was called with specific args
expect(mockProcessFeedback).toHaveBeenCalledWith({
  message: "Great app!",
  category: "praise",
  priority: 2
});
```
**本地代理（注重结果）：**
```typescript
// Testing that the outcome was achieved
const result = await agent.process("Great app!");
const storedFeedback = await db.feedback.getLatest();

expect(storedFeedback.content).toContain("Great app");
expect(storedFeedback.importance).toBeGreaterThanOrEqual(1);
expect(storedFeedback.importance).toBeLessThanOrEqual(5);
// We don't care exactly how it categorized—just that it's reasonable
```
### 接受变化

代理每次可能会以不同的方式解决问题。您的测试应该：
- 验证最终状态，而不是路径
- 接受合理的范围，而不是精确的值
- 检查是否存在必需的元素，而不是确切的格式
</测试哲学>

<can_agent_do_it_test>
## “特工能做到吗？”测试

对于每个 UI 功能，编写一个测试提示并验证代理是否可以完成它。

＃＃＃ 模板
```typescript
describe('Agent Capability Tests', () => {
  test('Agent can add a book to library', async () => {
    const result = await agent.chat("Add 'Moby Dick' by Herman Melville to my library");

    // Verify outcome
    const library = await libraryService.getBooks();
    const mobyDick = library.find(b => b.title.includes("Moby Dick"));

    expect(mobyDick).toBeDefined();
    expect(mobyDick.author).toContain("Melville");
  });

  test('Agent can publish to feed', async () => {
    // Setup: ensure a book exists
    await libraryService.addBook({ id: "book_123", title: "1984" });

    const result = await agent.chat("Write something about surveillance themes in my feed");

    // Verify outcome
    const feed = await feedService.getItems();
    const newItem = feed.find(item => item.bookId === "book_123");

    expect(newItem).toBeDefined();
    expect(newItem.content.toLowerCase()).toMatch(/surveillance|watching|control/);
  });

  test('Agent can search and save research', async () => {
    await libraryService.addBook({ id: "book_456", title: "Moby Dick" });

    const result = await agent.chat("Research whale symbolism in Moby Dick");

    // Verify files were created
    const files = await fileService.listFiles("Research/book_456/");
    expect(files.length).toBeGreaterThan(0);

    // Verify content is relevant
    const content = await fileService.readFile(files[0]);
    expect(content.toLowerCase()).toMatch(/whale|symbolism|melville/);
  });
});
```
### “写入位置”测试

关键的试金石：代理能否在特定的应用程序位置创建内容？
```typescript
describe('Location Awareness Tests', () => {
  const locations = [
    { userPhrase: "my reading feed", expectedTool: "publish_to_feed" },
    { userPhrase: "my library", expectedTool: "add_book" },
    { userPhrase: "my research folder", expectedTool: "write_file" },
    { userPhrase: "my profile", expectedTool: "write_file" },
  ];

  for (const { userPhrase, expectedTool } of locations) {
    test(`Agent knows how to write to "${userPhrase}"`, async () => {
      const prompt = `Write a test note to ${userPhrase}`;
      const result = await agent.chat(prompt);

      // Check that agent used the right tool (or achieved the outcome)
      expect(result.toolCalls).toContainEqual(
        expect.objectContaining({ name: expectedTool })
      );

      // Or verify outcome directly
      // expect(await locationHasNewContent(userPhrase)).toBe(true);
    });
  }
});
```
</can_agent_do_it_test>

<惊喜测试>
##“惊喜测试”

精心设计的代理原生应用程序可以让代理找出创造性的方法。通过提出开放式请求来测试这一点。

### 测试
```typescript
describe('Agent Creativity Tests', () => {
  test('Agent can handle open-ended requests', async () => {
    // Setup: user has some books
    await libraryService.addBook({ id: "1", title: "1984", author: "Orwell" });
    await libraryService.addBook({ id: "2", title: "Brave New World", author: "Huxley" });
    await libraryService.addBook({ id: "3", title: "Fahrenheit 451", author: "Bradbury" });

    // Open-ended request
    const result = await agent.chat("Help me organize my reading for next month");

    // The agent should do SOMETHING useful
    // We don't specify exactly what—that's the point
    expect(result.toolCalls.length).toBeGreaterThan(0);

    // It should have engaged with the library
    const libraryTools = ["read_library", "write_file", "publish_to_feed"];
    const usedLibraryTool = result.toolCalls.some(
      call => libraryTools.includes(call.name)
    );
    expect(usedLibraryTool).toBe(true);
  });

  test('Agent finds creative solutions', async () => {
    // Don't specify HOW to accomplish the task
    const result = await agent.chat(
      "I want to understand the dystopian themes across my sci-fi books"
    );

    // Agent might:
    // - Read all books and create a comparison document
    // - Research dystopian literature and relate it to user's books
    // - Create a mind map in a markdown file
    // - Publish a series of insights to the feed

    // We just verify it did something substantive
    expect(result.response.length).toBeGreaterThan(100);
    expect(result.toolCalls.length).toBeGreaterThan(0);
  });
});
```
### 失败是什么样子的
```typescript
// FAILURE: Agent can only say it can't do that
const result = await agent.chat("Help me prepare for a book club discussion");

// Bad outcome:
expect(result.response).not.toContain("I can't");
expect(result.response).not.toContain("I don't have a tool");
expect(result.response).not.toContain("Could you clarify");

// If the agent asks for clarification on something it should understand,
// you have a context injection or capability gap
```
</惊喜测试>

<奇偶校验测试>
## 自动奇偶校验测试

确保每个 UI 操作都有一个等效的代理。

### 能力图测试
```typescript
// capability-map.ts
export const capabilityMap = {
  // UI Action: Agent Tool
  "View library": "read_library",
  "Add book": "add_book",
  "Delete book": "delete_book",
  "Publish insight": "publish_to_feed",
  "Start research": "start_research",
  "View highlights": "read_library",  // same tool, different query
  "Edit profile": "write_file",
  "Search web": "web_search",
  "Export data": "N/A",  // UI-only action
};

// parity.test.ts
import { capabilityMap } from './capability-map';
import { getAgentTools } from './agent-config';
import { getSystemPrompt } from './system-prompt';

describe('Action Parity', () => {
  const agentTools = getAgentTools();
  const systemPrompt = getSystemPrompt();

  for (const [uiAction, toolName] of Object.entries(capabilityMap)) {
    if (toolName === 'N/A') continue;

    test(`"${uiAction}" has agent tool: ${toolName}`, () => {
      const toolNames = agentTools.map(t => t.name);
      expect(toolNames).toContain(toolName);
    });

    test(`${toolName} is documented in system prompt`, () => {
      expect(systemPrompt).toContain(toolName);
    });
  }
});
```
### 上下文奇偶校验测试
```typescript
describe('Context Parity', () => {
  test('Agent sees all data that UI shows', async () => {
    // Setup: create some data
    await libraryService.addBook({ id: "1", title: "Test Book" });
    await feedService.addItem({ id: "f1", content: "Test insight" });

    // Get system prompt (which includes context)
    const systemPrompt = await buildSystemPrompt();

    // Verify data is included
    expect(systemPrompt).toContain("Test Book");
    expect(systemPrompt).toContain("Test insight");
  });

  test('Recent activity is visible to agent', async () => {
    // Perform some actions
    await activityService.log({ action: "highlighted", bookId: "1" });
    await activityService.log({ action: "researched", bookId: "2" });

    const systemPrompt = await buildSystemPrompt();

    // Verify activity is included
    expect(systemPrompt).toMatch(/highlighted|researched/);
  });
});
```
</parity_testing>

<集成测试>
## 集成测试

测试从用户请求到结果的完整流程。

### 端到端流程测试
```typescript
describe('End-to-End Flows', () => {
  test('Research flow: request → web search → file creation', async () => {
    // Setup
    const bookId = "book_123";
    await libraryService.addBook({ id: bookId, title: "Moby Dick" });

    // User request
    await agent.chat("Research the historical context of whaling in Moby Dick");

    // Verify: web search was performed
    const searchCalls = mockWebSearch.mock.calls;
    expect(searchCalls.length).toBeGreaterThan(0);
    expect(searchCalls.some(call =>
      call[0].query.toLowerCase().includes("whaling")
    )).toBe(true);

    // Verify: files were created
    const researchFiles = await fileService.listFiles(`Research/${bookId}/`);
    expect(researchFiles.length).toBeGreaterThan(0);

    // Verify: content is relevant
    const content = await fileService.readFile(researchFiles[0]);
    expect(content.toLowerCase()).toMatch(/whale|whaling|nantucket|melville/);
  });

  test('Publish flow: request → tool call → feed update → UI reflects', async () => {
    // Setup
    await libraryService.addBook({ id: "book_1", title: "1984" });

    // Initial state
    const feedBefore = await feedService.getItems();

    // User request
    await agent.chat("Write something about Big Brother for my reading feed");

    // Verify feed updated
    const feedAfter = await feedService.getItems();
    expect(feedAfter.length).toBe(feedBefore.length + 1);

    // Verify content
    const newItem = feedAfter.find(item =>
      !feedBefore.some(old => old.id === item.id)
    );
    expect(newItem).toBeDefined();
    expect(newItem.content.toLowerCase()).toMatch(/big brother|surveillance|watching/);
  });
});
```
### 故障恢复测试
```typescript
describe('Failure Recovery', () => {
  test('Agent handles missing book gracefully', async () => {
    const result = await agent.chat("Tell me about 'Nonexistent Book'");

    // Agent should not crash
    expect(result.error).toBeUndefined();

    // Agent should acknowledge the issue
    expect(result.response.toLowerCase()).toMatch(
      /not found|don't see|can't find|library/
    );
  });

  test('Agent recovers from API failure', async () => {
    // Mock API failure
    mockWebSearch.mockRejectedValueOnce(new Error("Network error"));

    const result = await agent.chat("Research this topic");

    // Agent should handle gracefully
    expect(result.error).toBeUndefined();
    expect(result.response).not.toContain("unhandled exception");

    // Agent should communicate the issue
    expect(result.response.toLowerCase()).toMatch(
      /couldn't search|unable to|try again/
    );
  });
});
```
</集成测试>

<快照测试>
## 系统提示的快照测试

跟踪系统提示和上下文注入随时间的变化。
```typescript
describe('System Prompt Stability', () => {
  test('System prompt structure matches snapshot', async () => {
    const systemPrompt = await buildSystemPrompt();

    // Extract structure (removing dynamic data)
    const structure = systemPrompt
      .replace(/id: \w+/g, 'id: [ID]')
      .replace(/"[^"]+"/g, '"[TITLE]"')
      .replace(/\d{4}-\d{2}-\d{2}/g, '[DATE]');

    expect(structure).toMatchSnapshot();
  });

  test('All capability sections are present', async () => {
    const systemPrompt = await buildSystemPrompt();

    const requiredSections = [
      "Your Capabilities",
      "Available Books",
      "Recent Activity",
    ];

    for (const section of requiredSections) {
      expect(systemPrompt).toContain(section);
    }
  });
});
```
</快照_测试>

<手动测试>
## 手动测试清单

有些事情最好在开发过程中手动测试：

### 自然语言变异测试

针对同一请求尝试多种措辞：
```
"Add this to my feed"
"Write something in my reading feed"
"Publish an insight about this"
"Put this in the feed"
"I want this in my feed"
```
如果上下文注入正确，一切都应该有效。

### 边缘情况提示
```
"What can you do?"
→ Agent should describe capabilities

"Help me with my books"
→ Agent should engage with library, not ask what "books" means

"Write something"
→ Agent should ask WHERE (feed, file, etc.) if not clear

"Delete everything"
→ Agent should confirm before destructive actions
```
### 混淆测试

询问应该存在但可能未正确连接的事物：
```
"What's in my research folder?"
→ Should list files, not ask "what research folder?"

"Show me my recent reading"
→ Should show activity, not ask "what do you mean?"

"Continue where I left off"
→ Should reference recent activity if available
```
</手动测试>

<ci_集成>
## CI/CD 集成

将代理本机测试添加到您的 CI 管道中：
```yaml
# .github/workflows/test.yml
name: Agent-Native Tests

on: [push, pull_request]

jobs:
  agent-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup
        run: npm install

      - name: Run Parity Tests
        run: npm run test:parity

      - name: Run Capability Tests
        run: npm run test:capabilities
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

      - name: Check System Prompt Completeness
        run: npm run test:system-prompt

      - name: Verify Capability Map
        run: |
          # Ensure capability map is up to date
          npm run generate:capability-map
          git diff --exit-code capability-map.ts
```
### 成本意识测试

代理测试需要花费 API 令牌。管理策略：
```typescript
// Use smaller models for basic tests
const testConfig = {
  model: process.env.CI ? "claude-3-haiku" : "claude-3-opus",
  maxTokens: 500,  // Limit output length
};

// Cache responses for deterministic tests
const cachedAgent = new CachedAgent({
  cacheDir: ".test-cache",
  ttl: 24 * 60 * 60 * 1000,  // 24 hours
});

// Run expensive tests only on main branch
if (process.env.GITHUB_REF === 'refs/heads/main') {
  describe('Full Integration Tests', () => { ... });
}
```
</ci_integration>

<测试实用程序>
## 测试实用程序

### 代理测试工具
```typescript
class AgentTestHarness {
  private agent: Agent;
  private mockServices: MockServices;

  async setup() {
    this.mockServices = createMockServices();
    this.agent = await createAgent({
      services: this.mockServices,
      model: "claude-3-haiku",  // Cheaper for tests
    });
  }

  async chat(message: string): Promise<AgentResponse> {
    return this.agent.chat(message);
  }

  async expectToolCall(toolName: string) {
    const lastResponse = this.agent.getLastResponse();
    expect(lastResponse.toolCalls.map(t => t.name)).toContain(toolName);
  }

  async expectOutcome(check: () => Promise<boolean>) {
    const result = await check();
    expect(result).toBe(true);
  }

  getState() {
    return {
      library: this.mockServices.library.getBooks(),
      feed: this.mockServices.feed.getItems(),
      files: this.mockServices.files.listAll(),
    };
  }
}

// Usage
test('full flow', async () => {
  const harness = new AgentTestHarness();
  await harness.setup();

  await harness.chat("Add 'Moby Dick' to my library");
  await harness.expectToolCall("add_book");
  await harness.expectOutcome(async () => {
    const state = harness.getState();
    return state.library.some(b => b.title.includes("Moby"));
  });
});
```
</测试实用程序>

<清单>
## 测试清单

自动化测试：
- [ ]“特工可以吗？”测试每个 UI 操作
- [ ] 位置感知测试（“写入我的提要”）
- [ ] 奇偶校验测试（工具存在，记录在提示中）
- [ ] 上下文奇偶校验测试（代理查看 UI 显示的内容）
- [ ] 端到端流量测试
- [ ] 故障恢复测试

手动测试：
- [ ] 自然语言变化（多个短语有效）
- [ ] 边缘情况提示（开放式请求）
- [ ] 混淆测试（代理知道应用程序词汇）
- [ ]惊喜测试（代理可发挥创意）

持续集成集成：
- [ ] 在每个 PR 上运行奇偶校验测试
- [ ] 使用 API 密钥运行功能测试
- [ ] 系统提示完整性检查
- [ ] 能力图漂移检测
</清单>
