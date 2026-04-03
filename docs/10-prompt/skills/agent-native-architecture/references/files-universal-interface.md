<概述>
文件是代理本机应用程序的通用接口。代理自然熟悉文件操作——他们已经知道如何读取、写入和组织文件。本文档介绍了文件为何如此有效、如何组织它们以及积累知识的 context.md 模式。
</概述>

<为什么文件>
## 为什么要文件

特工天生擅长档案。 Claude Code 之所以有效，是因为 bash + 文件系统是最久经考验的代理界面。在构建代理本机应用程序时，请考虑这一点。

### 特工已经知道如何做

您无需向代理传授您的 API，它已经知道 `cat`、`grep`、`mv`、`mkdir`。文件操作是它最熟悉的原语。

### 文件是可检查的

用户可以查看代理创建的内容，对其进行编辑、移动、删除。没有黑匣子。代理行为完全透明。

### 文件是可移植的

出口是微不足道的。备份是微不足道的。用户拥有自己的数据。没有供应商锁定，没有复杂的迁移路径。

### 应用程序状态保持同步

在移动设备上，如果您将文件系统与 iCloud 一起使用，则所有设备共享相同的文件系统。代理在一台设备上的工作会出现在所有设备上，而无需构建服务器。

### 目录结构就是信息架构

文件系统免费为您提供层次结构。 `/projects/acme/notes/` 是自我记录的，而 `SELECT * FROM notes WHERE project_id = 123` 则不然。
</why_files>

<文件组织>
## 文件组织模式

> **需要验证：** 这些惯例是迄今为止行之有效的一种方法，而不是处方。应考虑更好的解决方案。

代理原生设计的一般原则：**针对代理可以推理的内容进行设计。**最好的代理是对人类有意义的内容。如果人类可以查看您的文件结构并了解正在发生的情况，那么代理也可能可以。

### 实体范围目录

围绕实体组织文件，而不是参与者或文件类型：
```
{entity_type}/{entity_id}/
├── primary content
├── metadata
└── related materials
```
**示例：** `Research/books/{bookId}/` 包含有关一本书的所有内容 - 全文、注释、来源、代理日志。

### 命名约定

|文件类型 |命名模式|示例|
|------------|--------------|------|
|实体数据| `{entity}.json` | `library.json`、`status.json` |
|人类可读的内容 | `{content_type}.md` | `introduction.md`、`profile.md` |
|代理推理| `agent_log.md` |每个实体代理历史记录 |
|主要内容 | `full_text.txt` |下载/提取文本|
|多卷| `volume{N}.txt` | `volume1.txt`、`volume2.txt` |
|外部来源| `{source_name}.md` | `wikipedia.md`、`sparknotes.md` |
|检查站| `{sessionId}.checkpoint` |基于 UUID |
|配置| `config.json` |功能设置 |

### 目录命名

- **实体范围：** `{entityType}/{entityId}/`（例如，`Research/books/{bookId}/`）
- **类型范围：** `{type}/`（例如，`AgentCheckpoints/`、`AgentLogs/`）
- **约定：** 小写加下划线，而不是驼峰式命名

### 短暂的分离与持久的分离

将代理工作文件与用户的永久数据分开：
```
Documents/
├── AgentCheckpoints/     # Ephemeral (can delete)
│   └── {sessionId}.checkpoint
├── AgentLogs/            # Ephemeral (debugging)
│   └── {type}/{sessionId}.md
└── Research/             # Durable (user's work)
    └── books/{bookId}/
```
### 分裂：Markdown 与 JSON

- **Markdown：** 对于用户可能阅读或编辑的内容
- **JSON：** 对于应用程序查询的结构化数据
</file_organization>

<上下文_md_模式>
## context.md 模式

代理在每个会话开始时读取并在学习时更新的文件：
```markdown
# Context

## Who I Am
Reading assistant for the Every app.

## What I Know About This User
- Interested in military history and Russian literature
- Prefers concise analysis
- Currently reading War and Peace

## What Exists
- 12 notes in /notes
- 3 active projects
- User preferences at /preferences.md

## Recent Activity
- User created "Project kickoff" (2 hours ago)
- Analyzed passage about Austerlitz (yesterday)

## My Guidelines
- Don't spoil books they're reading
- Use their interests to personalize insights

## Current State
- No pending tasks
- Last sync: 10 minutes ago
```
### 好处

- **代理行为无需更改代码即可发展** - 更新上下文，行为发生变化
- **用户可以检查和修改** - 完全透明
- **积累背景的自然场所** - 学习在各个课程中持续存在
- **可跨会话移植** - 重新启动代理，保留知识

### 它是如何运作的

1. 代理在会话开始时读取 `context.md`
2. Agent在学习重要内容时更新它
3.系统还可以更新（最近活动、新资源）
4. 上下文在会话中持续存在

### 包含哪些内容

|部分|目的|
|---------|---------|
|我是谁 |代理身份和角色|
|我对该用户的了解 |了解偏好、兴趣 |
|存在什么 |可用资源、数据|
|最近的活动 |连续性的背景|
|我的指导方针|学到的规则和约束|
|当前状态 |会话状态、待处理项目 |
</context_md_pattern>

<文件与数据库>
## 文件与数据库

> **需要验证：** 此框架是由移动开发通知的。对于网络应用程序来说，权衡是不同的。

|使用文件... |使用数据库... |
|------------------|---------------------|
|用户应该阅读/编辑的内容 |海量结构化数据|
|受益于版本控制的配置|需要复杂查询的数据 |
|代理生成的内容 |短暂状态（会话、缓存）|
|任何受益于透明度的事物 |具有关系的数据 |
|大文字内容|需要索引的数据 |

**原则：** 文件用于易读，数据库用于结构。当有疑问时，文件更加透明，用户可以随时检查它们。

### 文件何时发挥最佳作用

- 规模小（一个用户的库，不是数百万条记录）
- 透明度比查询速度更重要
- 云同步（iCloud、Dropbox）可以很好地处理文件

### 混合方法

即使您需要数据库来提高性能，也请考虑维护代理使用的基于文件的“事实来源”，并同步到 UI 的数据库：
```
Files (agent workspace):
  Research/book_123/introduction.md

Database (UI queries):
  research_index: { bookId, path, title, createdAt }
```
</files_vs_database>

<冲突模型>
## 冲突模型

如果代理和用户写入相同的文件，则需要冲突模型。

### 当前现实

大多数实现通过原子写入使用**last-write-wins**：
```swift
try data.write(to: url, options: [.atomic])
```
这很简单，但可能会丢失更改。

### 选项

|战略|优点 |缺点 |
|----------|------|------|
| **最后写入获胜** |简单|更改可能会丢失 |
| **写作前代理检查** |保留用户编辑|更加复杂 |
| **独立空间** |没有冲突|减少协作 |
| **仅附加日志** |永不覆盖 |文件永远增长|
| **文件锁定** |安全并发访问 |复杂，可以阻塞|

### 推荐方法

**对于文件代理频繁写入（日志、状态）：** Last-write-wins 就可以了。冲突很少见。

**对于用户编辑的文件（配置文件、注释）：** 考虑显式处理：
- 代理在覆盖之前检查修改时间
- 或者将代理输出与用户可编辑内容分开
- 或者使用仅附加模式

### iCloud 注意事项

iCloud 同步增加了复杂性。当发生同步冲突时，它会创建 `{filename} (conflict).md` 文件。监控这些：
```swift
NotificationCenter.default.addObserver(
    forName: .NSMetadataQueryDidUpdate,
    ...
)
```
###系统提示引导

告诉代理有关冲突模型的信息：
```markdown
## Working with User Content

When you create content, the user may edit it afterward. Always read
existing files before modifying them—the user may have made improvements
you should preserve.

If a file has been modified since you last wrote it, ask before overwriting.
```
</冲突模型>

<例子>
## 示例：读取应用程序文件结构
```
Documents/
├── Library/
│   └── library.json              # Book metadata
├── Research/
│   └── books/
│       └── {bookId}/
│           ├── full_text.txt     # Downloaded content
│           ├── introduction.md   # Agent-generated, user-editable
│           ├── notes.md          # User notes
│           └── sources/
│               ├── wikipedia.md  # Research gathered by agent
│               └── reviews.md
├── Chats/
│   └── {conversationId}.json     # Chat history
├── Profile/
│   └── profile.md                # User reading profile
└── context.md                    # Agent's accumulated knowledge
```
**它是如何工作的：**

1. 用户添加书籍→在`library.json`中创建条目
2. Agent下载文本→保存到`Research/books/{id}/full_text.txt`
3. 代理研究→保存到`sources/`
4. 代理生成简介 → 保存到 `introduction.md`
5. 用户编辑简介 → 代理在下次读取时看到更改
6. 代理通过学习更新 `context.md`
</例子>

<清单>
## 文件作为通用接口清单

### 组织
- [ ] 实体范围目录 (`{type}/{id}/`)
- [ ] 一致的命名约定
- [ ] 短暂与持久分离
- [ ] Markdown 用于人类内容，JSON 用于结构化数据

### 上下文.md
- [ ] 代理在会话开始时读取上下文
- [ ] 代理在学习时更新上下文
- [ ] 包括：身份、用户知识、存在内容、指南
- [ ] 跨会话持续存在

### 冲突处理
- [ ] 定义冲突模型（最后写入获胜、写入前检查等）
- [ ] 系统提示中的座席指导
- [ ] iCloud 冲突监控（如果适用）

### 整合
- [ ] UI 观察文件更改（或共享服务）
- [ ] 代理可以读取用户编辑
- [ ] 用户可以检查代理输出
</清单>
