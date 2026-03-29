# Agent 命名空间错误修复指南

## 问题概述

当前 `spec-first` 项目里，`skill -> agent` 调用存在一个**运行态命名空间失配**问题。

典型现象：

- Agent 被调用后显示 `0 tool uses`
- Agent 没有执行任何工具就直接退出
- `/spec:plan`、`/spec:review`、`/resolve-pr-feedback` 等流程里，子 agent 看起来“被调起了”，但没有实际工作

这不是“agent 文件没打包进去”，也不是 `name:` 字段本身写错，而是：

- **源码层**的 skill 使用了 canonical fully-qualified agent 名称
- **目标项目运行态**却是 `spec-first init --claude` 生成的本地展开目录
- 当前代码里还没有把这两层自动适配起来

## 当前代码事实

### 1. 发布包包含完整资产

当前 npm 包会打包：

- `skills/`
- `agents/`
- `templates/`
- `.claude-plugin/plugin.json`

这说明问题不是“发布产物缺失 agent”。

### 2. `init --claude` 的最终产物路径

用户执行：

```bash
spec-first init --claude
```

后，目标项目里会生成：

```text
.claude/
├── commands/spec/
├── skills/
└── agents/
```

也就是说，当前真正的运行态是**本地目录模型**，不是“真正注册好的 `spec-first` 插件命名空间”。

### 3. 当前源码里的 canonical 命名仍然是 fully-qualified

例如 skill 源码里会出现：

```text
spec-first:research:repo-research-analyst
spec-first:research:learnings-researcher
spec-first:review:correctness-reviewer
spec-first:workflow:pr-comment-resolver
spec-first:design:design-iterator
spec-first:document-review:coherence-reviewer
```

而目标项目里实际落盘的 agent 文件是：

```text
.claude/agents/research/repo-research-analyst.md
.claude/agents/research/learnings-researcher.md
.claude/agents/review/correctness-reviewer.md
.claude/agents/workflow/pr-comment-resolver.md
.claude/agents/design/design-iterator.md
.claude/agents/document-review/coherence-reviewer.md
```

agent frontmatter 里通常也是裸名，例如：

```yaml
name: repo-research-analyst
name: learnings-researcher
```

因此，当前 bug 的本质不是“源码里的 `spec-first:` 一定错误”，而是：

**当前 Claude 本地运行态还没有 namespace adapter，把源码 canonical 名称转换成运行态可解析形式。**

## 错误理解与正确理解

### 错误理解

“只要把所有 `spec-first:` 前缀全删掉，就修好了。”

这个结论过于粗暴，原因有两点：

1. 仓库源码仍把 `spec-first:<group>:<agent>` 当作 canonical 名称
2. 未来如果接入 `Codex` 等平台，源码层仍然需要保留统一插件资产模型

### 正确理解

应当区分两层：

1. **源码 canonical 层**
   - 可以保留 `spec-first:<group>:<agent>`
   - 这是插件资产源文件的统一表示

2. **Claude 本地运行态层**
   - 由 `spec-first init --claude` 生成
   - 短期方案里，**计划**转换成当前平台可解析的本地形式，例如：
     - `research:repo-research-analyst`
     - `review:correctness-reviewer`
     - `workflow:pr-comment-resolver`
   - 注意：这些是**Claude adapter 的目标输出格式**，不是当前代码里已经完成验证的既成事实

## 根本原因

### 当前短期根因

当前 `init --claude` 只是简单复制：

- `templates/claude/commands/spec/` -> `.claude/commands/spec/`
- `skills/` -> `.claude/skills/`
- `agents/` -> `.claude/agents/`

但没有做任何命名空间转换。

因此，目标项目里的运行态 skill 仍然保留了源码层 fully-qualified agent 引用，而当前本地目录运行态并不保证能解析这些名字。

### 为什么会出现 `0 tool uses`

因为表面上看像是 agent 被调用了，但实际运行时可能找不到对应 agent 类型，结果是：

- agent 没有真正进入执行逻辑
- 没有使用任何工具
- 最终显示 `0 tool uses`

## 影响范围

当前**已确认出现 fully-qualified 运行态引用**的命名空间包括：

- `spec-first:research:`
- `spec-first:review:`
- `spec-first:workflow:`
- `spec-first:design:`
- `spec-first:document-review:`

从当前 `agents/` 目录看，仓库还包含这些分类：

- `research/`
- `review/`
- `workflow/`
- `design/`
- `document-review/`
- `docs/`

处理原则应分两层：

1. **已确认受影响分类**
   - 先修复当前已经发现 fully-qualified 运行态引用的分类
   - 即 `research / review / workflow / design / document-review`

2. **全量扫描范围**
   - `agents/` 目录下所有分类都不能长期遗漏
   - 但只有当某个分类在运行态 skill 中被引用时，才需要进入本轮命名空间适配

这意味着：

- `docs/` 这类当前未发现同类引用的分类，应进入扫描清单
- 但不应在没有代码证据时，直接被当成“已确认受影响分类”

当前已知高风险 skill 包括：

- `skills/spec-plan/SKILL.md`
- `skills/spec-review/SKILL.md`
- `skills/spec-review/references/persona-catalog.md`
- `skills/orchestrating-swarms/SKILL.md`
- `skills/resolve-pr-feedback/SKILL.md`
- `skills/todo-resolve/SKILL.md`
- `skills/frontend-design/SKILL.md`
- `skills/document-review/SKILL.md`

## 正确的短期修复方案

### 方案结论

短期正确修法不是手工批量改源码，也不是让用户自己 `sed` `.claude/skills/`。

正确修法是：

1. 保留仓库源码中的 canonical fully-qualified 名称
2. 在 `spec-first init --claude` 阶段增加 **Claude 运行态适配**
3. 把复制到目标项目 `.claude/skills/` 里的 agent type 引用转换成本地可解析格式
4. 保持 `templates/claude/commands/spec/*.md` 到 `.claude/commands/spec/*.md` 的同步链路不变，确保 `/spec:*` 仍然是稳定入口

### 期望的转换方向

运行态适配时，目标项目中的 skill 应被转换为：

```text
spec-first:research:repo-research-analyst   -> research:repo-research-analyst
spec-first:review:correctness-reviewer      -> review:correctness-reviewer
spec-first:workflow:pr-comment-resolver     -> workflow:pr-comment-resolver
spec-first:design:design-iterator           -> design:design-iterator
spec-first:document-review:coherence-reviewer -> document-review:coherence-reviewer
```

注意：

- 这里只是**Claude 本地运行态适配**
- 不是要求你回改源码 canonical 层
- `templates/` 仍然要同步到目标项目命令目录，不能遗漏
- 当前默认转换对象是运行态 `skills/`，不是命令模板
- 只有当未来确认 `templates/` 中也出现运行态 agent type 引用时，才把对应模板纳入适配范围
- `agents/` 目录下所有分类都应纳入扫描和校验，但实现优先级以“已确认受影响分类”为准

## 不推荐的做法

### 1. 不要全仓库直接删除 `spec-first:`

不推荐：

```bash
find skills -name "*.md" -exec sed -i '' 's/spec-first://g' {} \;
```

原因：

- 会破坏源码层 canonical 资产
- 会影响未来多平台接入
- 会让源码层和插件清单模型继续失真

### 2. 不要让用户手工改 `.claude/skills/`

不推荐：

```bash
find .claude/skills -name "*.md" -exec sed -i '' 's/spec-first://g' {} \;
```

原因：

- 这是生成产物，不是长期维护源文件
- 一旦重新执行 `spec-first init --claude`，手工修改会被覆盖
- 正确修复点应在 CLI 的生成层

## 验证方法

### 1. 验证生成产物是否仍残留 fully-qualified 引用

在目标项目执行：

```bash
rg -n "spec-first:(research|review|workflow|design|document-review):" .claude/skills
```

如果仍然命中，说明当前运行态还没有完成命名空间适配。

### 2. 验证关键运行态文件

重点检查：

```bash
rg -n "spec-first:" .claude/skills/spec-plan
rg -n "spec-first:" .claude/skills/spec-review
rg -n "spec-first:" .claude/skills/resolve-pr-feedback
rg -n "spec-first:" .claude/skills/document-review
```

### 3. 验证关键流程

建议重点验证：

- `/spec:plan`
- `/spec:review`
- `/resolve-pr-feedback`

如果相关子 agent 不再出现 `0 tool uses`，说明修复方向是对的。

## 后续落地建议

正确的实施顺序应是：

1. 在 `src/cli/plugin.js` 或独立 adapter 模块中增加 Claude 运行态命名空间转换
2. 保持 `templates/claude/commands/spec/*.md` -> `.claude/commands/spec/*.md` 的同步逻辑稳定，避免修 agent 适配时打断 `/spec:*` 命令入口
3. 给 smoke test 增加断言，确保生成后的 `.claude/skills/` 不再残留关键 `spec-first:` agent type
4. 给 `doctor` 增加运行态一致性检查
5. 再更新用户手册和架构文档

## 与长期方案的关系

### 短期方案

- 保留 canonical 插件资产
- `init --claude` 负责运行态适配
- 当前继续使用本地目录运行态模型

### 长期方案

- 真正把 `spec-first` 变成 plugin-first 安装模型
- 让 Claude 或其他平台能直接解析 `spec-first:<group>:<agent>`
- 到那时才不需要当前这种运行态适配层

## 最终结论

当前问题真实存在，但不应被表述为：

> “`spec-first:` 前缀本身就是错误。”

更准确的结论是：

> 当前 bug 是**源码 canonical 命名**与**Claude 本地运行态目录模型**之间缺少适配层。

因此，正确修复方式是：

> **在 `spec-first init --claude` 阶段增加 Claude 运行态命名空间适配，而不是手工全局删除源码中的 `spec-first:`。**

---

**更新时间**：2026-03-29  
**适用范围**：当前 `spec-first` npm CLI + `init --claude` 本地运行态模型  
**不适用范围**：未来真正 plugin-first 安装完成后的运行时命名空间模型
