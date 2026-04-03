<概述>
自我修改是代理本机工程的高级层：可以发展自己的代码、提示和行为的代理。并非每个应用程序都需要，但未来的很大一部分。

这就是“开发商能做什么，代理商也能做什么”的逻辑延伸。
</概述>

<为什么自我修改>
## 为什么要自我修改？

传统软件是静态的——它只做你所写的事情，仅此而已。自改性剂可以：

- **修复自己的错误** - 看到错误，修补代码，重新启动
- **添加新功能** - 用户请求新功能，代理实现它
- **进化行为** - 从反馈中学习并调整提示
- **自行部署** - 推送代码、触发构建、重新启动

代理成为一个随着时间的推移而改进的活系统，而不是冻结的代码。
</why_self_modification>

<能力>
## 自我修改可以实现什么

**代码修改：**
- 阅读并理解源文件
- 编写修复程序和新功能
- 提交并推送到版本控制
- 触发构建并验证它们是否通过

**迅速进化：**
- 根据反馈编辑系统提示
- 添加新功能作为提示部分
- 细化无效的判断标准

**基础设施控制：**
- 从上游拉取最新代码
- 从其他分支/实例合并
- 更改后重新启动
- 如果出现问题则回滚

**站点/输出生成：**
- 生成和维护网站
- 创建文档
- 根据数据构建仪表板
</功能>

<护栏>
## 所需的护栏

自我改造的力量是强大的。它需要安全机制。

**代码更改的批准门：**
```typescript
tool("write_file", async ({ path, content }) => {
  if (isCodeFile(path)) {
    // Store for approval, don't apply immediately
    pendingChanges.set(path, content);
    const diff = generateDiff(path, content);
    return { text: `Requires approval:\n\n${diff}\n\nReply "yes" to apply.` };
  }
  // Non-code files apply immediately
  writeFileSync(path, content);
  return { text: `Wrote ${path}` };
});
```
**更改前自动提交：**
```typescript
tool("self_deploy", async () => {
  // Save current state first
  runGit("stash");  // or commit uncommitted changes

  // Then pull/merge
  runGit("fetch origin");
  runGit("merge origin/main --no-edit");

  // Build and verify
  runCommand("npm run build");

  // Only then restart
  scheduleRestart();
});
```
**构建验证：**
```typescript
// Don't restart unless build passes
try {
  runCommand("npm run build", { timeout: 120000 });
} catch (error) {
  // Rollback the merge
  runGit("merge --abort");
  return { text: "Build failed, aborting deploy", isError: true };
}
```
**重启后健康检查：**
```typescript
tool("health_check", async () => {
  const uptime = process.uptime();
  const buildValid = existsSync("dist/index.js");
  const gitClean = !runGit("status --porcelain");

  return {
    text: JSON.stringify({
      status: "healthy",
      uptime: `${Math.floor(uptime / 60)}m`,
      build: buildValid ? "valid" : "missing",
      git: gitClean ? "clean" : "uncommitted changes",
    }, null, 2),
  };
});
```
</护栏>

<git_架构>
## 基于Git的自我修改

使用git作为自我修改的基础。它提供：
- 版本历史（回滚能力）
- 分支（安全实验）
- 合并（与其他实例同步）
- 推/拉（部署和协作）

**基本的 git 工具：**
```typescript
tool("status", "Show git status", {}, ...);
tool("diff", "Show file changes", { path: z.string().optional() }, ...);
tool("log", "Show commit history", { count: z.number() }, ...);
tool("commit_code", "Commit code changes", { message: z.string() }, ...);
tool("git_push", "Push to GitHub", { branch: z.string().optional() }, ...);
tool("pull", "Pull from GitHub", { source: z.enum(["main", "instance"]) }, ...);
tool("rollback", "Revert recent commits", { commits: z.number() }, ...);
```
**多实例架构：**
```
main                      # Shared code
├── instance/bot-a       # Instance A's branch
├── instance/bot-b       # Instance B's branch
└── instance/bot-c       # Instance C's branch
```
每个实例可以：
- 从主库拉取更新
- 将改进推回主干（通过 PR）
- 同步其他实例的功能
- 维护特定于实例的配置
</git_架构>

<提示进化>
## 自修改提示

系统提示符是代理可以读写的文件。
```typescript
// Agent can read its own prompt
tool("read_file", ...);  // Can read src/prompts/system.md

// Agent can propose changes
tool("write_file", ...);  // Can write to src/prompts/system.md (with approval)
```
**系统提示为活文件：**
```markdown
## Feedback Processing

When someone shares feedback:
1. Acknowledge warmly
2. Rate importance 1-5
3. Store using feedback tools

<!-- Note to self: Video walkthroughs should always be 4-5,
     learned this from Dan's feedback on 2024-12-07 -->
```
代理人可以：
- 给自己添加注释
- Refine judgment criteria
- Add new feature sections
- Document edge cases it learned
</prompt_evolution>

<何时使用>
## When to Implement Self-Modification

**好的候选人：**
- Long-running autonomous agents
- Agents that need to adapt to feedback
- Systems where behavior evolution is valuable
- Internal tools where rapid iteration matters

**不需要：**
- 简单的单任务代理
- Highly regulated environments
- Systems where behavior must be auditable
- One-off or short-lived agents

从非自修改提示本机代理开始。 Add self-modification when you need it.
</when_to_use>

<示例工具>
## 完整的自我修改工具集
```typescript
const selfMcpServer = createSdkMcpServer({
  name: "self",
  version: "1.0.0",
  tools: [
    // FILE OPERATIONS
    tool("read_file", "Read any project file", { path: z.string() }, ...),
    tool("write_file", "Write a file (code requires approval)", { path, content }, ...),
    tool("list_files", "List directory contents", { path: z.string() }, ...),
    tool("search_code", "Search for patterns", { pattern: z.string() }, ...),

    // APPROVAL WORKFLOW
    tool("apply_pending", "Apply approved changes", {}, ...),
    tool("get_pending", "Show pending changes", {}, ...),
    tool("clear_pending", "Discard pending changes", {}, ...),

    // RESTART
    tool("restart", "Rebuild and restart", {}, ...),
    tool("health_check", "Check if bot is healthy", {}, ...),
  ],
});

const gitMcpServer = createSdkMcpServer({
  name: "git",
  version: "1.0.0",
  tools: [
    // STATUS
    tool("status", "Show git status", {}, ...),
    tool("diff", "Show changes", { path: z.string().optional() }, ...),
    tool("log", "Show history", { count: z.number() }, ...),

    // COMMIT & PUSH
    tool("commit_code", "Commit code changes", { message: z.string() }, ...),
    tool("git_push", "Push to GitHub", { branch: z.string().optional() }, ...),

    // SYNC
    tool("pull", "Pull from upstream", { source: z.enum(["main", "instance"]) }, ...),
    tool("self_deploy", "Pull, build, restart", { source: z.enum(["main", "instance"]) }, ...),

    // SAFETY
    tool("rollback", "Revert commits", { commits: z.number() }, ...),
    tool("health_check", "Detailed health report", {}, ...),
  ],
});
```
</示例_工具>

<清单>
## 自我修改清单

启用自我修改之前：
- [ ] 基于 Git 的版本控制设置
- [ ] 代码更改的批准门
- [ ] 重启前构建验证
- [ ] 可用回滚机制
- [ ] 健康检查端点
- [ ] 实例标识已配置

实施时：
- [ ] 代理可以读取所有项目文件
- [ ] 代理可以写入文件（经过适当的批准）
- [ ] 代理可以提交和推送
- [ ] 代理可以拉取更新
- [ ] 代理可以自行重启
- [ ] 代理可以根据需要回滚
</清单>
