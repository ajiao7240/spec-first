---
name: source-of-truth
title: Spec-First：不要修生成物，要修 Source-of-Truth
description: spec-first 微信公众号系列第 6 篇：AI coding 中最隐蔽的系统漂移，来自"修了眼前读到的文件"，但没有修真正的 source-of-truth。
metadata:
  type: article
  series_index: 06
  status: draft
---

**能被 AI 读到的文件，不一定就是应该被你修改的文件。**

> **导读**
> 这篇文章讨论 AI coding 里最隐蔽的一类错误：AI 建议修改一个"看起来对"的文件，但那个文件其实是生成产物，不是真正的 source-of-truth。
> 修了它，短期看有效，长期会制造系统漂移。

上一篇我们讨论了 Graph 如何改变决策输入。

这篇讨论一个更基础的问题：

> **当 AI 找到了"需要修改的文件"，它找到的是真源头，还是只是当前被消费的副本？**

---

## 01 为什么"直接改它现在读到的文件"很危险

让 AI 修一个 bug，它会先读相关文件，然后建议修改。

这个过程看起来很自然。

但有一类文件，AI 很容易读到，却不应该直接修改：

**Generated runtime mirror。**

比如 `.agents/skills/spec-code-review/SKILL.md`。

这个文件存在，AI 能读到它，它的内容也确实描述了 `spec-code-review` 的行为。

但它是从 `skills/spec-code-review/SKILL.md` 生成出来的运行时副本。

如果你直接修改它，会发生什么？

短期：修改生效，AI 读到了新内容，任务通过。

长期：下次运行 `spec-first init`，生成链会把 source 重新同步到 runtime，你的手改被覆盖。

更糟的是：source 和 runtime 开始漂移。source 说一套，runtime 跑一套，review 看另一套。

这就是 AI coding 里最隐蔽的系统漂移来源。

---

## 02 一个真实的案例

这不是假设的场景。

在 `spec-first` 的开发过程中，这个问题真实发生过，并被记录在 `docs/solutions/workflow-issues/modify-source-not-artifacts-2026-04-13.md` 里。

**场景：** 修复 `injection-index.yaml` 中 `advice.work` 的语义错误。

**直觉动作：** 直接打开 `docs/contexts/spec-first/injection-index.yaml` 修改。

**问题：** 这个文件是由 `spec-graph-bootstrap` 运行时生成的产物，真正的 source-of-truth 在 `skills/spec-graph-bootstrap/SKILL.md` 的 Phase 4 模板里。

修了产物，下次 `/spec:graph-bootstrap` 运行，产物会被重新生成，手改消失。

**正确动作：**

```bash
# 错误：修改产物
vi docs/contexts/spec-first/injection-index.yaml

# 正确：修改生成源头
vi skills/spec-graph-bootstrap/SKILL.md  # 找到 Phase 4 yaml 模板
```

修改源头后，再通过 `/spec:graph-bootstrap` 重新生成产物，让 runtime 和 source 保持一致。

**另一个案例：** `spec-code-review` 的 runtime 副本落后。

用户通过 `$spec-code-review` 读到了 `.agents/skills/spec-code-review/SKILL.md`，发现内容是旧的。

**错误判断：** "源码还没开发完"。

**正确判断：** 先审 `skills/spec-code-review/SKILL.md`（source-of-truth），确认源码是否已正确修改。如果源码正确，而 runtime 副本落后，问题是"runtime 副本未刷新"，不是"源码缺陷"。

这两个判断，处理方式完全不同。

---

## 03 source、runtime、artifact 三者分工

要避免这类错误，需要先理解三种文件的分工。

### 03.1 Source-of-Truth：长期维护的真实来源

这是你应该修改的地方。

在 `spec-first` 里，source-of-truth 包括：

- `skills/`：workflow 与 standalone skill 源码
- `agents/`：agent profile 源码
- `templates/`：host runtime templates
- `src/cli/`：CLI implementation
- `docs/`：需求、计划、架构说明

这些文件是 checked-in 的，经过 review，有版本历史，可以被追溯。

### 03.2 Generated Runtime：宿主实际消费的生成副本

这是从 source 生成出来的，不应该直接修改。

在 `spec-first` 里，generated runtime 包括：

- `.claude/`：Claude generated runtime mirror
- `.codex/`：Codex generated runtime mirror
- `.agents/skills/`：Codex-facing generated skill mirror

`spec-first` 的 `src/cli/plugin.js` 里有明确的生成链：

```javascript
syncBundledAssets()  // 把 skills/ 和 agents/ 同步到 runtime 目录
syncSkills()         // 同步 skill 文件
syncAgents()         // 同步 agent 文件
```

`src/cli/adapters/codex.js` 明确把 Codex 的 `skillsRoot` 和 `workflowsRoot` 都指向 `.agents/skills`。

这意味着：`.agents/skills/` 里的内容，是由 `skills/` 生成的，不是独立维护的。

### 03.3 Durable Artifact：workflow 运行后留下的证据

这是 workflow 执行的产物：plan、task pack、review findings、debug ledger、`docs/solutions/` 里的 learning。

它们是证据，不是 source。

可以被引用、被刷新、被废弃，但不应该成为治理源头。

---

## 04 spec-first 的边界规则

`spec-first` 把这条原则固化成了四步判断顺序：

**第一步：识别当前文件是 source-of-truth 还是 runtime artifact。**

看文件路径：

| 路径 | 类型 |
|---|---|
| `skills/`、`agents/`、`templates/`、`src/cli/`、`docs/` | Source-of-truth |
| `.claude/`、`.codex/`、`.agents/skills/` | Generated runtime mirror |
| `docs/contexts/`、`.spec-first/workflows/` | Generated artifact |

**第二步：如果是 runtime artifact，先回溯它来自哪个源目录。**

```bash
# 查看 spec-first 的生成链
grep -n "syncBundledAssets\|syncSkills\|syncAgents" src/cli/plugin.js
grep -n "skillsRoot\|workflowsRoot" src/cli/adapters/codex.js
```

**第三步：只在源目录做持久修改。**

修改 `skills/spec-code-review/SKILL.md`，而不是 `.agents/skills/spec-code-review/SKILL.md`。

**第四步：通过安装/同步链路刷新运行时副本，再验证。**

```bash
spec-first init  # 从 source 重新生成 host runtime assets
```

---

## 05 这条原则不只适用于 spec-first

Source/runtime 边界不是 `spec-first` 独有的问题。

任何有生成链的系统都有这个边界：

- **OpenAPI client**：`openapi.yaml` 是 source，生成的 client SDK 是 artifact
- **GraphQL schema**：`.graphql` 文件是 source，生成的 types 是 artifact
- **Protobuf**：`.proto` 文件是 source，生成的 `*.pb.go` 是 artifact
- **docs site**：markdown 是 source，`_site/` 或 `dist/` 是 artifact
- **compiled assets**：TypeScript 是 source，`dist/` 里的 JS 是 artifact

这些场景里，AI 都很容易犯同样的错误：

> 读到了 artifact，建议直接修改 artifact。

因为 artifact 就在那里，可读，可改，改了立刻生效。

但这种修法不持久，也不可追溯。

**AI agent 尤其容易忽略这个边界。**

因为 agent 的工作方式是：读到什么，就在什么上面操作。

它不会主动问"这个文件是生成的吗？它的上游在哪里？"

除非 Harness 在任务开始前就把这个边界显式化。

---

## 06 Harness 如何让这个边界显式化

`spec-first` 的 Governance Harness 把 source/runtime 边界固化在了几个地方。

**第一：context-governance.md 的 Default Exclusions。**

普通 workflow 默认排除 `.claude/**`、`.codex/**`、`.agents/skills/**`，reason_code 是 `generated_runtime_mirror_excluded`。

这不是说这些文件没有价值，而是说：普通 workflow 不应该把它们当作 source-of-truth 来读和修改。

**第二：CLAUDE.md 和 AGENTS.md 里的明确说明。**

```text
Generated runtime assets 包括：
- .claude/
- .codex/
- .agents/skills/

优先修改 source，不手改 generated runtime assets 来强制修复。
source 变更后需要修复 runtime drift 时，使用 spec-first init。
```

**第三：review 阶段的 source/runtime 边界检查。**

`spec-code-review` 在审查时会区分：

- 源码是否已正确修改（source-of-truth 层）
- runtime 副本是否已刷新（generated runtime 层）

这两个问题独立判断，不能混为一谈。

---

## 07 Source/runtime 边界卡

在让 AI 修改一个文件之前，可以用这张清单快速判断。

**五个问题：**

1. **这个文件是人维护的，还是生成的？**
   看路径：`skills/`、`src/cli/`、`docs/` → 人维护；`.claude/`、`.codex/`、`.agents/skills/` → 生成的

2. **它的上游模板或 generator 在哪里？**
   如果是生成的，找到生成它的 source 文件和生成命令

3. **修改后如何重新生成或同步？**
   `spec-first init`？还是重新运行某个 workflow？

4. **消费者读的是 source，还是 runtime mirror？**
   Claude Code 读 `.claude/`，Codex 读 `.agents/skills/`，但 source 在 `skills/`

5. **需要把 drift 记录为 failure / learning 吗？**
   如果 source 和 runtime 已经漂移，这是一个值得记录的 workflow issue

---

## 08 本篇小结

AI coding 里最隐蔽的系统漂移，常常来自一个看起来无害的动作：

> 直接修改 AI 读到的文件。

这个动作短期有效，长期制造 source/runtime drift。

`spec-first` 把这条原则固化成了三层防线：

- **context-governance.md**：默认排除 generated runtime mirror，不让它进入普通 workflow 的 source context
- **CLAUDE.md / AGENTS.md**：明确说明 source 和 runtime 的边界，以及正确的修复路径
- **review 阶段**：区分"源码是否正确"和"runtime 是否已刷新"，不混为一谈

如果你下次遇到 AI 建议修改一个文件，可以先问一句：

> **这是真源头，还是只是当前被消费的副本？**

如果是副本，找到它的上游，修源头，再刷新 runtime。

这就是 Governance Harness 的核心之一：

> **让 source-of-truth 在执行前就清晰可见，而不是在 drift 发生后才去追溯。**

下一篇，我想写：

> **Spec 不是文档负担，是给 Agent 的压缩上下文**

很多人觉得写 Spec 是额外负担。

但 Spec 的真正价值，是把任务目标、边界、非目标压缩成一个可被 Agent 精确消费的输入。

---

`spec-first` 是开源项目，欢迎试用、提 issue、提建议。

**GitHub：** http://github.com/sunrain520/spec-first

**官网：** http://spec-first.cn/
