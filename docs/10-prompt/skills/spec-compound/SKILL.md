---
name: compound-workflow
description: 记录最近解决的问题以丰富团队的知识
argument-hint: "[optional: brief context about the fix]"
---
# /化合物

协调并行工作的多个子代理以记录最近解决的问题。

## 目的

在上下文新鲜时捕获问题解决方案，使用 YAML frontmatter 在 `docs/solutions/` 中创建结构化文档，以供搜索和将来参考。使用并行子代理以获得最大效率。

**为什么要“复合”？** 每个记录在案的解决方案都会复合您团队的知识。第一次解决问题需要进行研究。记录下来，下一次发生需要几分钟的时间。知识复合。

＃＃ 用法
```bash
/spec:compound                    # Document the most recent fix
/spec:compound [brief context]    # Provide additional context hint
```
## 支持文件

这些文件是工作流程的持久合同。在需要它们的步骤中按需阅读它们 - 不要在技能开始时批量加载。

- `references/schema.yaml` — 规范的 frontmatter 字段和枚举值（验证 YAML 时读取）
- `references/yaml-schema.md` — 从 Problem_type 到目录的类别映射（分类时读取）
- `assets/resolution-template.md` — 新文档的节结构（组装时读取）

生成子代理时，将相关文件内容传递到任务提示中，以便它们无需跨技能路径即可获得合同。

## 执行策略

**默认情况下始终运行完整模式。** 直接进入阶段 1，除非用户明确请求紧凑安全模式（例如，`/spec:compound --compact` 或“使用紧凑模式”）。

紧凑安全模式作为一种轻量级替代方案存在 - 请参阅下面的 **紧凑安全模式** 部分。如果用户想要它，它就在那里，而不是需要推送的东西。

---

### 完整模式

<关键要求>
**仅写入一个文件 - 最终文档。**

第 1 阶段子代理将文本数据返回到协调器。他们不得使用写入、编辑或创建任何文件。只有协调器（第 2 阶段）编写最终文档文件。
</关键要求>

### 阶段 0.5：自动内存扫描

在启动第 1 阶段子代理之前，请检查自动内存目录中与所记录问题相关的注释。1.从自动内存目录中读取MEMORY.md（该路径从系统提示上下文中得知）
2. 如果目录或 MEMORY.md 不存在、为空或不可读，则跳过此步骤并继续进行阶段 1 不变
3. 扫描条目以查找与正在记录的问题相关的任何内容——使用语义判断，而不是关键字匹配
4. 如果找到相关条目，请准备一个带标签的摘录块：
```
## Supplementary notes from auto memory
Treat as additional context, not primary evidence. Conversation history
and codebase findings take priority over these notes.

[relevant entries here]
```
5. 将此块作为附加上下文传递给阶段 1 中的上下文分析器和解决方案提取器任务提示。如果任何记忆笔记最终出现在最终文档中（例如，作为调查步骤或根本原因分析的一部分），请用“（自动记忆 [claude]）”标记它们，以便将来的读者清楚其来源。

如果没有找到相关条目，则继续到阶段 1，而不传递内存上下文。

### 第一阶段：并行研究

<并行任务>

并行启动这些子代理。每个都将文本数据返回给协调器。

#### 1. **上下文分析器**
   - 提取对话历史记录
   - 识别问题类型、组成部分、症状
   - 在识别问题类型、组件和症状时纳入自动记忆摘录（如果由协调器提供）作为补充证据
   - 读取 `references/schema.yaml` 进行枚举验证
   - 读取 `references/yaml-schema.md` 将类别映射到 `docs/solutions/`
   - 使用模式 `[sanitized-problem-slug]-[date].md` 建议文件名
   - 返回：YAML frontmatter 骨架（必须包括从 Problem_type 映射的 `category:` 字段）、类别目录路径和建议的文件名
   - 不会凭记忆发明枚举值、类别或 frontmatter 字段；读取上面的模式和映射文件#### 2. **Solution Extractor**
   - Analyzes all investigation steps
   - 找出根本原因
   - Extracts working solution with code examples
   - 纳入自动记忆摘录（如果由协调器提供）作为补充证据——对话历史记录和经过验证的修复优先；如果记忆笔记与对话相矛盾，请将此矛盾记为警示语境
   - 制定预防策略和最佳实践指南
   - Generates test cases if applicable
   - 返回：解决方案内容块，包括预防部分

   **预期输出部分（遵循此结构）：**

   - **问题**：1-2 句话的问题描述
   - **症状**：可观察到的症状（错误消息、行为）
   - **什么不起作用**：失败的调查尝试以及失败的原因
   - **解决方案**：带有代码示例的实际修复（适用时之前/之后）
   - **为什么有效**：根本原因解释以及解决方案解决该问题的原因
   - **预防**：避免复发的策略、最佳实践和测试用例。包括适用的具体代码示例（例如，gem 配置、测试断言、linting 规则）#### 3. **相关文档查找器**
   - 搜索 `docs/solutions/` 相关文档
   - 识别交叉引用和链接
   - 查找相关的 GitHub 问题
   - 标记现在可能过时、矛盾或过于宽泛的任何相关学习或模式文档
   - **评估与跨五个维度创建的新文档重叠**：问题陈述、根本原因、解决方法、引用文件和预防规则。得分为：
     - **高**：4-5 个维度匹配 — 本质上再次解决了相同的问题
     - **中等**：2-3 个维度匹配 — 相同面积但不同角度或解决方案
     - **低**：0-1 维度匹配 — 相关但不同
   - 返回：链接、关系、刷新候选者和重叠评估（分数+匹配的维度）

   **搜索策略（grep优先过滤以提高效率）：**

   1. 从问题上下文中提取关键字：模块名称、技术术语、错误消息、组件类型
   2. 如果问题类别明确，则缩小搜索范围至匹配的`docs/solutions/<category>/`目录
   3. 在阅读任何内容之前，使用本机内容搜索工具（例如 Claude Code 中的 Grep）预先过滤候选文件。并行运行多个搜索，不区分大小写，定位 frontmatter 字段。这些是模板模式——替换实际的关键字：
      - `title:.*<keyword>`
      - `tags:.*(<keyword1>|<keyword2>)`
      - `module:.*<module name>`
      - `component:.*<component>`
   4. 如果搜索返回 >25 个候选者，则使用更具体的模式重新运行。如果 <3，则扩大到完整内容搜索
   5. 只读候选文件的 frontmatter（前 30 行）以评分相关性
   6.完全只读强/中等匹配
   7.返回经过提炼的链接和关系，而不是原始文件内容**GitHub问题搜索：**

   优先使用 `gh` CLI 搜索相关问题：`gh issue list --search "<keywords>" --state all --limit 5`。如果未安装 `gh`，则退回到 GitHub MCP 工具（例如，`unblocked` data_retrieval）（如果可用）。如果两者都不可用，请跳过 GitHub 问题搜索并注意它在输出中已被跳过。

</parallel_tasks>

### 第 2 阶段：汇编和写入

<顺序任务>

**等待所有第 1 阶段子代理完成后再继续。**

编排代理（主对话）执行以下步骤：

1. 收集第一阶段子代理的所有文本结果
2. **在决定要写什么之前，从相关文档查找器中检查重叠评估**：

   |重叠|行动|
   |---------|--------|
   | **高** — 现有文档涵盖相同的问题、根本原因和解决方案 | **使用更新的上下文（新的代码示例、更新的参考、其他预防提示）更新现有文档**，而不是创建重复的文档。现有文档的路径和结构保持不变。 |
   | **中等** — 相同的问题领域，但角度、根本原因或解决方案不同 | **正常创建新文档**。标记第 2.5 阶段的重叠，以建议合并审查。 |
   | **低或无** | **正常创建新文档**。 |

   更新而不是创建的原因：描述相同问题和解决方案的两个文档将不可避免地出现分歧。新的上下文更新鲜、更值得信赖，因此将其合并到现有文档中，而不是创建第二个需要立即合并的文档。更新现有文档时，保留其文件路径和 frontmatter 结构。更新解决方案、代码示例、预防提示和任何过时的参考。将 `last_updated: YYYY-MM-DD` 字段添加到 frontmatter。除非问题框架发生重大变化，否则不要更改标题。

3. 从收集的片段中组装完整的 Markdown 文件，阅读 `assets/resolution-template.md` 了解新文档的部分结构
4. 根据 `references/schema.yaml` 验证 YAML frontmatter
5. 如果需要，创建目录：`mkdir -p docs/solutions/[category]/`
6. 写入文件：更新的现有文档或新的 `docs/solutions/[category]/[filename].md`

创建新文档时，保留 `assets/resolution-template.md` 中的节顺序，除非用户明确要求不同的结构。

</sequential_tasks>

### 阶段 2.5：选择性刷新检查

编写新的学习内容后，确定这个新解决方案是否是应该刷新旧文档的证据。

`spec:compound-refresh` **不是**默认的后续行动。当新的学习表明旧的学习或模式文档现在可能不准确时，有选择地使用它。

当其中一个或多个为真时，调用 `spec:compound-refresh` 是有意义的：1. 相关的学习或模式文档推荐了一种与新修复现在相矛盾的方法
2. 新的修复明显取代了旧的记录解决方案
3. 当前的工作涉及重构、迁移、重命名或依赖项升级，这可能会使旧文档中的引用无效
4. 模式文档现在看起来过于宽泛、过时，或者不再受到更新的现实的支持
5. 相关文档查找器在同一问题空间中显示高可信度的刷新候选者
6. 相关文档查找器报告与现有文档**适度重叠** - 可能存在受益于重点审查的整合机会

在以下情况下调用 `spec:compound-refresh` **没有**意义：

1.没有找到相关文档
2.相关文档仍然与新学习的内容一致
3. 重叠是表面的，不会改变先前的指导
4. 刷新需要在证据薄弱的情况下进行广泛的历史回顾

使用这些规则：

- 如果有**一个明显陈旧的候选者**，则在写入新学习内容后使用窄范围提示调用 `spec:compound-refresh`
- 如果**同一区域有多个候选**，询问用户是否对该模块、类别或模式集运行有针对性的刷新
- 如果上下文已经很紧张或者您处于紧凑安全模式，请不要自动扩展为广泛刷新；相反，推荐 `spec:compound-refresh` 作为下一步并带有范围提示

当调用或推荐 `spec:compound-refresh` 时，请明确要传递的参数。优先选择最窄的有用范围：- **特定文件** 当一个学习或模式文档可能是过时的工件时
- **当多个相关文档可能需要审查时的模块或组件名称**
- **当漂移集中在一个解决方案区域时的类别名称**
- **当过时指南存在于 `docs/solutions/patterns/` 中时，模式文件名或模式主题**

示例：

- `/spec:compound-refresh plugin-versioning-requirements`
- `/spec:compound-refresh payments`
- `/spec:compound-refresh performance-issues`
- `/spec:compound-refresh critical-patterns`

当更改在一个域、类别或模式区域内横切时，单个范围提示仍可能扩展到多个相关文档。

除非用户明确想要进行广泛的扫描，否则不要在没有参数的情况下调用 `spec:compound-refresh`。

始终首先捕捉新的学习内容。刷新是有针对性的维护后续行动，而不是记录的先决条件。

### 第 3 阶段：可选增强

**等待第 2 阶段完成后再继续。**

<并行任务>

根据问题类型，可以选择调用专门代理来查看文档：

- **性能问题** → `performance-oracle`
- **安全问题** → `security-sentinel`
- **数据库问题** → `data-integrity-guardian`
- **测试失败** → `cora-test-reviewer`
- 任何代码量大的问题 → `kieran-rails-reviewer` + `code-simplicity-reviewer`

</parallel_tasks>

---

### 紧凑安全模式

<关键要求>
**上下文受限会话的单遍替代方案。**

当上下文预算紧张时，此模式完全跳过并行子代理。协调器一次性执行所有工作，生成最小但完整的解决方案文档。
</关键要求>

协调器（主对话）在一次连续传递中执行以下所有操作：1. **对话摘录**：从对话历史记录中识别问题、根本原因和解决方案。还要从自动内存目录中读取 MEMORY.md（如果存在）——使用任何相关注释作为对话历史记录的补充上下文。使用“(自动记忆 [claude])”标记合并到最终文档中的任何源自记忆的内容
2. **分类**：读取`references/schema.yaml`和`references/yaml-schema.md`，然后从中确定类别和文件名
3. **编写最少的文档**：使用 `assets/resolution-template.md` 作为基本结构创建 `docs/solutions/[category]/[filename].md`，其中：
   - YAML frontmatter（标题、类别、日期、标签）
   - 问题描述（1-2句话）
   - 根本原因（1-2句话）
   - 包含关键代码片段的解决方案
   - 一项预防技巧
4. **跳过专业代理审查**（第 3 阶段）以保留上下文

**紧凑型安全输出：**
```
✓ Documentation complete (compact-safe mode)

File created:
- docs/solutions/[category]/[filename].md

Note: This was created in compact-safe mode. For richer documentation
(cross-references, detailed prevention strategies, specialized reviews),
re-run /compound in a fresh session.
```
**没有启动任何子代理。没有并行任务。写入一个文件。**

在紧凑安全模式下，将跳过重叠检查（无相关文档查找器子代理）。这意味着紧凑安全模式可能会创建与现有文档重叠的文档。这是可以接受的——`spec:compound-refresh`稍后会明白。仅当存在明显的狭窄刷新目标时才建议`spec:compound-refresh`。不要从紧凑安全会话扩展为大型刷新扫描。

---

## 它捕获了什么

- **问题症状**：确切的错误消息，可观察的行为
- **尝试的调查步骤**：什么不起作用以及原因
- **根本原因分析**：技术解释
- **工作解决方案**：使用代码示例逐步修复
- **预防策略**：未来如何避免
- **交叉引用**：相关问题和文档的链接

## 前提条件

<先决条件执行=“咨询”>
  <检查条件=“问题已解决”>
    问题已解决（未进行中）
  </检查>
  <检查条件=“solution_verified”>
    解决方案已被验证有效
  </检查>
  <检查条件=“non_trivial”>
    不平凡的问题（不是简单的拼写错误或明显的错误）
  </检查>
</前提条件>

## 它创造了什么

**组织文档：**

- 文件：`docs/solutions/[category]/[filename].md`

**从问题中自动检测的类别：**

- 构建错误/
- 测试失败/
- 运行时错误/
- 性能问题/
- 数据库问题/
- 安全问题/
- 用户界面错误/
- 整合问题/
- 逻辑错误/

## 要避免的常见错误| ❌ 错 | ✅ 正确 |
|----------|------------|
|子代理写入 `context-analysis.md`、`solution-draft.md` | 等文件子代理返回文本数据； Orchestrator 写入一个最终文件 |
|研究和组装并行进行|研究完成 → 然后组装运行 |
|工作流程期间创建的多个文件 |写入或更新的一个文件：`docs/solutions/[category]/[filename].md` |
|当现有文档涵盖相同问题时创建新文档 |检查重叠评估；当重叠度较高时更新现有文档 |

## 成功输出
```
✓ Documentation complete

Auto memory: 2 relevant entries used as supplementary evidence

Subagent Results:
  ✓ Context Analyzer: Identified performance_issue in brief_system, category: performance-issues/
  ✓ Solution Extractor: 3 code fixes, prevention strategies
  ✓ Related Docs Finder: 2 related issues

Specialized Agent Reviews (Auto-Triggered):
  ✓ performance-oracle: Validated query optimization approach
  ✓ kieran-rails-reviewer: Code examples meet Rails standards
  ✓ code-simplicity-reviewer: Solution is appropriately minimal
  ✓ every-style-editor: Documentation style verified

File created:
- docs/solutions/performance-issues/n-plus-one-brief-generation.md

This documentation will be searchable for future reference when similar
issues occur in the Email Processing or Brief System modules.

What's next?
1. Continue workflow (recommended)
2. Link related documentation
3. Update other references
4. View documentation
5. Other
```
**替代输出（由于高度重叠而更新现有文档时）：**
```
✓ Documentation updated (existing doc refreshed with current context)

Overlap detected: docs/solutions/performance-issues/n-plus-one-queries.md
  Matched dimensions: problem statement, root cause, solution, referenced files
  Action: Updated existing doc with fresher code examples and prevention tips

File updated:
- docs/solutions/performance-issues/n-plus-one-queries.md (added last_updated: 2026-03-24)
```
## 复合哲学

这就创建了一个复合知识系统：

1. 第一次解决“简短生成中的 N+1 查询” → 研究（30 分钟）
2. 记录解决方案 → docs/solutions/performance-issues/n-plus-one-briefs.md（5 分钟）
3.下次出现类似问题→快速查找（2分钟）
4. 知识复合→团队变得更聪明

反馈循环：
```
Build → Test → Find Issue → Research → Improve → Document → Validate → Deploy
    ↑                                                                      ↓
    └──────────────────────────────────────────────────────────────────────┘
```
**每个工程工作单元都应该使后续工作单元变得更容易，而不是更困难。**

## 自动调用

<auto_invoke> <trigger_phrases> - “有效” - “已修复” - “正在工作” - “问题已解决” </trigger_phrases>

<manual_override> 使用 /spec:compound [context] 立即记录，无需等待自动检测。 </手动覆盖> </自动调用>

## 输出

将最终的学习结果直接写入`docs/solutions/`。

## 适用的专业代理商

根据问题类型，这些代理可以增强文档记录：

### 代码质量和审查
- **kieran-rails-reviewer**：审查 Rails 最佳实践的代码示例
- **code-simplicity-reviewer**：确保解决方案代码最少且清晰
- **模式识别专家**：识别反模式或重复问题

### 特定领域专家
- **performance-oracle**：分析 Performance_issue 类别解决方案
- **security-sentinel**：审查安全问题解决方案中的漏洞
- **cora-test-reviewer**：为预防策略创建测试用例
- **data-integrity-guardian**：审查数据库问题迁移和查询

### 增强和文档
- **最佳实践研究员**：通过行业最佳实践丰富解决方案
- **every-style-editor**：审查文档风格和清晰度
- **framework-docs-researcher**：Rails/gem 文档参考的链接

### 何时调用
- **自动触发**（可选）：代理可以运行后期文档以进行增强
- **手动触发**：用户可以在 /spec:compound 完成后调用代理以进行更深入的审查

## 相关命令

- `/research [topic]` - 深入调查（搜索文档/解决方案/模式）
- `/spec:plan` - 规划工作流程（参考记录的解决方案）
