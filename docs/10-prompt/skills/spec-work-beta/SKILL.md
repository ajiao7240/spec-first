---
name: work-beta-workflow
description: “[BETA] 在外部委托支持下执行工作计划。与 spec:work 相同，但包括用于令牌保护代码实现的实验性 Codex 委托模式。”
argument-hint: "[plan file, specification, or todo file path]"
disable-model-invocation: true
---
# 工作计划执行命令

高效执行工作计划，同时保持质量和精加工功能。

## 简介

该命令获取工作文档（计划、规范或待办事项文件）并系统地执行它。重点是通过快速了解需求、遵循现有模式并始终保持质量来**交付完整的功能**。

## 输入文档

<input_document> #$ARGUMENTS </input_document>

## 执行工作流程

### 第 1 阶段：快速启动

1. **阅读计划并澄清**- 完整阅读工作文件
   - 将计划视为决策工件，而不是执行脚本
   - 如果计划包含 `Implementation Units`、`Work Breakdown`、`Requirements Trace`、`Files`、`Test Scenarios` 或 `Verification` 等部分，请使用这些部分作为执行的主要来源材料
   - 检查每个实施单元上的 `Execution note` — 这些包含该单元的计划执行状态信号（例如，测试优先或表征优先）。创建任务时请注意它们。
   - 检查 `Deferred to Implementation` 或 `Implementation-Time Unknowns` 部分 - 这些是规划者在执行过程中故意留给您解决的问题。在开始之前记下它们，以便它们告知您的方法，而不是在任务中让您感到惊讶
   - 检查 `Scope Boundaries` 部分 - 这些是明确的非目标。如果实施开始将您拉向相邻的工作，请回头参考它们
   - 查看计划中提供的任何参考资料或链接
   - 如果用户在此会话中明确要求 TDD、测试优先或表征优先执行，请尊重该请求，即使计划没有 `Execution note`
   - 如果有任何不清楚或不明确的地方，请立即提出澄清问题
   - 获得用户批准才能继续
   - **不要跳过这个** - 现在提出问题比构建错误的东西更好

2. **设置环境**

   首先，检查当前分支：

   ```bash
   current_branch=$(git branch --show-current)
   default_branch=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')

   # Fallback if remote HEAD isn't set
   if [ -z "$default_branch" ]; then
     default_branch=$(git rev-parse --verify origin/main >/dev/null 2>&1 && echo "main" || echo "master")
   fi
   ```**如果已经在功能分支**（不是默认分支）：
   - 问：“继续在 `[current_branch]` 上工作，还是创建一个新分支？”
   - 如果继续，请继续步骤 3
   - 如果创建新的，请按照下面的选项 A 或 B 操作

   **如果在默认分支上**，选择如何继续：

   **选项A：创建一个新分支**
   ```bash
   git pull origin [default_branch]
   git checkout -b feature-branch-name
   ```
   Use a meaningful name based on the work (e.g., `功能/用户身份验证`, `修复/电子邮件验证`).

   **Option B: Use a worktree (recommended for parallel development)**
   ```bash
   skill: git-worktree
   # The skill will create a new branch from the default branch in an isolated worktree
   ```

   **选项 C：在默认分支上继续**
   - 需要明确的用户确认
   - 仅在用户明确表示“是的，提交到 [default_branch]”后才继续
   - 未经明确许可，切勿直接提交到默认分支

   **建议**：在以下情况下使用工作树：
   - 您想要同时处理多个功能
   - 你想在实验时保持默认分支干净
   - 您打算经常在分行之间切换3. **创建待办事项列表**
   - 使用可用的任务跟踪工具（例如，TodoWrite、任务列表）将计划分解为可操作的任务
   - 从计划的实施单元、依赖关系、文件、测试目标和验证标准中派生任务
   - 当存在时，将每个单位的`Execution note`带入任务
   - 对于每个单元，在实施之前阅读 `Patterns to follow` 字段 — 这些指向要镜像的特定文件或约定
   - 使用每个单位的 `Verification` 字段作为该任务的主要“完成”信号
   - 不要期望计划包含实现代码、微步 TDD 指令或精确的 shell 命令
   - 包括任务之间的依赖关系
   - 根据需要首先完成的事情确定优先级
   - 包括测试和质量检查任务
   - 保持任务具体且可完成

4. **选择执行策略**

   创建任务列表后，根据计划的大小和依赖结构决定如何执行：

   |战略|何时使用 |
   |----------|-------------|
   | **内嵌** | 1-2 个小任务，或飞行中需要用户交互的任务 |
   | **系列子代理** | 3 个以上任务之间存在依赖关系。每个子代理都会获得一个专注于一个单元的新上下文窗口 - 防止许多任务中的上下文退化 |
   | **并行子代理** | 3 个以上的任务，其中某些单元没有共享依赖项并接触非重叠文件。同时调度独立单元，在其先决条件完成后运行相关单元 |**子代理调度**使用可用的子代理或任务生成机制。对于每个单位，给出子代理：
   - 完整的计划文件路径（用于整体上下文）
   - 特定单元的目标、文件、方法、执行说明、模式、测试场景和验证
   - 与该单元相关的任何已解决的延迟问题
   - 在编写测试之前检查单元的测试场景是否涵盖所有适用类别（快乐路径、边缘情况、错误路径、集成）并补充差距的说明

   每个子代理完成后，在调度下一个从属单元之前更新计划复选框和任务列表。

   对于真正需要持续代理间通信的大型计划（代理相互挑战彼此的方法，跨 10 多个任务共享协调），请参阅下面使用代理团队的群体模式。

### 第 2 阶段：执行

1. **任务执行循环**

   对于按优先级顺序排列的每个任务：

   ```
   while (tasks remain):
     - Mark task as in-progress
     - Read any referenced files from the plan
     - Look for similar patterns in codebase
     - Implement following existing conventions
     - Write tests for new functionality
     - Run System-Wide Test Check (see below)
     - Run tests after changes
     - Mark task as completed
     - Evaluate for incremental commit (see below)
   ```

   When a unit carries an `执行说明`, honor it. For test-first units, write the failing test before implementation for that unit. For characterization-first units, capture existing behavior before changing it. For units without an `执行说明`，务实进行。执行姿势的护栏：
   - 当测试优先时，不要在同一步骤中编写测试和实现
   - 在实施修复或功能之前，不要跳过验证新测试是否失败
   - 当进行测试优先时，不要过度实现超出当前行为切片的内容
   - 跳过琐碎的重命名、纯配置和纯样式工作的测试优先原则

   **测试场景完整性** — 在为包含功能的单元编写测试之前，请检查计划的 `Test scenarios` 是否涵盖适用于该单元的所有类别。如果类别缺失或场景模糊（例如，“正确验证”而没有命名输入和预期结果），请在编写测试之前从单元自身的上下文中进行补充：

   |类别 |何时适用 |如果缺失如何导出 |
   |----------|----------------|------------------------|
   | **幸福之路** |始终适用于具有特征的单元 |阅读该单元的核心输入/输出对的目标和方法 |
   | **边缘情况** |当单元具有有意义的边界（输入、状态、并发）时 |识别边界值、空/零输入和并发访问模式 |
   | **错误/失败路径** |当单元出现故障模式时（验证、外部调用、权限） |枚举单元应拒绝的无效输入、应强制执行的权限/身份验证拒绝以及应处理的下游故障 |
   | **整合** |当单元跨层时（回调、中间件、多服务） |识别跨层链并编写一个无需模拟即可执行它的场景 |

   **系统范围的测试检查** - 在将任务标记为完成之前，暂停并询问：|问题 |该怎么办 |
   |----------|------------|
   | **运行时会触发什么？**回调、中间件、观察者、事件处理程序 - 从您的更改中跟踪两个级别。 |阅读实际代码（不是文档），了解您接触的模型的回调、请求链中的中间件、`after_*` 挂钩。 |
   | **我的测试是否运用了真正的链？** 如果每个依赖项都被模拟，则测试证明您的逻辑*独立*工作 - 它没有说明交互。 |至少编写一个通过完整回调/中间件链使用真实对象的集成测试。交互层没有模拟。 |
   | **失败会留下孤立状态吗？** 如果您的代码在调用外部服务之前保留状态（数据库行、缓存、文件），那么当服务失败时会发生什么？重试是否会产生重复项？ |用真实的物体追踪故障路径。如果在有风险的调用之前创建状态，请测试故障是否已清除或重试是否幂等。 |
   | **还有哪些其他接口公开了这一点？** Mixins、DSL、替代入口点（Agent、Chat 与 ChatMethods）。 | Grep 查找相关类中的方法/行为。如果需要奇偶校验，请立即添加，而不是后续添加。 |
   | **错误策略是否跨层一致？** 重试中间件 + 应用程序回退 + 框架错误处理 - 它们是否冲突或造成双重执行？ |列出每一层的具体错误类别。验证您的救援列表是否与下层实际提出的内容相匹配。 |

   **何时跳过：** 叶节点更改时没有回调、没有状态持久性、没有并行接口。如果更改纯粹是附加的（新的辅助方法、新的视图部分），则检查需要 10 秒，答案是“没有任何触发，跳过”。**当这最重要时：**涉及回调模型、回退/重试错误处理或通过多个接口公开的功能的任何更改。


2. **增量提交**

   完成每个任务后，评估是否创建增量提交：

   |提交时... |当...时不要承诺
   |----------------|---------------------|
   |完整的逻辑单元（模型、服务、组件）|较大单元的一小部分 |
   |测试通过+有意义的进展|测试失败 |
   |即将切换上下文（后端 → 前端）|纯粹的脚手架，没有行为|
   |即将尝试有风险/不确定的改变 |需要“WIP”提交消息 |

   **启发式：**“我可以编写一条提交消息来描述完整的、有价值的更改吗？如果可以，请提交。如果消息是“WIP”或“部分 X”，请等待。”

   如果计划有实施单元，请使用它们作为提交边界的起始指南 - 但根据您在实施过程中发现的内容进行调整。如果一个单元比预期大，则可能需要多次提交，或者小型相关单元可能会合并在一起。使用每个单元的目标来通知提交消息。

   **提交工作流程：**
   ```bash
   # 1. Verify tests pass (use project's test command)
   # Examples: bin/rails test, npm test, pytest, go test, etc.

   # 2. Stage only files related to this logical unit (not `git add .`)
   git add <files related to this logical unit>

   # 3. Commit with conventional message
   git commit -m "feat(scope): description of this unit"
   ```

   **处理合并冲突：** 如果在变基或合并过程中出现冲突，请立即解决。增量提交使冲突解决变得更容易，因为每次提交都很小且重点突出。**注意：** 增量提交使用干净的常规消息，没有归属页脚。最终的第 4 阶段提交/PR 包括完整的归属。

3. **遵循现有模式**

   - 该计划应引用类似的代码 - 首先阅读这些文件
   - 完全匹配命名约定
   - 尽可能重用现有组件
   - 遵循项目编码标准（请参阅 AGENTS.md；仅当存储库仍保留兼容性垫片时才使用 CLAUDE.md）
   - 如有疑问，请 grep 查找类似的实现

4. **持续测试**

   - 在每次重大更改后运行相关测试
   - 不要等到结束才进行测试
   - 立即修复故障
   - 添加新功能的新测试
   - **使用模拟的单元测试单独证明逻辑。与真实对象的集成测试证明这些层可以协同工作。**如果您的更改涉及回调、中间件或错误处理 - 您两者都需要。

5. **随心所欲地简化**

   完成一组相关的实现单元（或每 2-3 个单元）后，检查最近更改的文件以寻找简化机会 - 合并重复的模式、提取共享帮助程序并提高代码重用和效率。这在使用子代理时尤其有价值，因为每个代理都在隔离的上下文中工作，并且无法看到跨单元出现的模式。

   不要在每个单元之后都进行简化——早期的模式可能看起来重复，但在后面的单元中故意有所不同。等待自然相边界或当您注意到累积的复杂性时。

   如果有 `/simplify` 技能或同等技能可用，请使用它。否则，请自行检查更改的文件以获得重用和整合的机会。

6. **Figma 设计同步**（如果适用）

   对于 Figma 设计的 UI 工作：- 按照设计规范实施组件
   - 迭代使用figma-design-sync代理进行比较
   - 修复发现的视觉差异
   - 重复直到实现与设计匹配

7. **前端设计指南**（如果适用）

   对于没有 Figma 设计的 UI 任务——其中实现涉及视图、模板、组件、布局或页面文件，创建用户可见的路线，或者计划包含显式 UI/前端/设计语言：

   - 在实施之前加载`frontend-design`技能
   - 遵循其检测、指导和验证流程
   - 如果该技能生成了验证屏幕截图，则它满足第 4 阶段的屏幕截图要求 - 无需单独捕获。如果技能退回到心理审查（无法访问浏览器），则第 4 阶段的屏幕截图仍然适用

8. **跟踪进度**
   - 完成任务时保持任务列表更新
   - 注意任何阻碍或意外发现
   - 如果范围扩大则创建新任务
   - 让用户了解主要里程碑

### 第 3 阶段：质量检查

1. **运行核心质量检查**

   始终在提交之前运行：

   ```bash
   # Run full test suite (use project's test command)
   # Examples: bin/rails test, npm test, pytest, go test, etc.

   # Run linting (per AGENTS.md)
   # Use linting-agent before pushing to origin
   ```

2. **Consider Code Review** (Optional)

   Use for complex, risky, or large changes. Load the `规范：审查` skill with `模式：自动修复` to fix safe issues and flag the rest before shipping. When the plan file path is known, pass it as `计划：<路径>`。3. **最终验证**
   - 所有任务标记为已完成
   - 所有测试均通过
   - Linting 通行证
   - 代码遵循现有模式
   - Figma 设计匹配（如果适用）
   - 没有控制台错误或警告
   - 如果计划有 `Requirements Trace`，请验证已完成的工作是否满足每项要求
   - 如果发现任何 `Deferred to Implementation` 问题，请确认这些问题在执行过程中得到解决

4. **准备操作验证计划**（必需）
   - 在每次更改的 PR 描述中添加 `## Post-Deploy Monitoring & Validation` 部分。
   - 包括混凝土：
     - 记录查询/搜索词
     - 需要观察的指标或仪表板
     - 预期的健康信号
     - 故障信号和回滚/缓解触发器
     - 验证窗口和所有者
   - 如果确实没有生产/运行时影响，仍包含以下部分：`No additional operational monitoring required` 和一行原因。

### 第 4 阶段：发货

1. **创建提交**

   ```bash
   git add .
   git status  # Review what's being committed
   git diff --staged  # Check the changes

   # Commit with conventional format
   git commit -m "$(cat <<'EOF'
   feat(scope): description of what and why

   Brief explanation if needed.

   🤖 Generated with [MODEL] via [HARNESS](HARNESS_URL) + Spec-First v[VERSION]

   Co-Authored-By: [MODEL] ([CONTEXT] context, [THINKING]) <noreply@anthropic.com>
   EOF
   )"
   ```

   **在提交/PR 时填写：**|占位符 |价值|示例|
   |------------|--------|---------|
   |占位符 |价值|示例|
   |------------|--------|---------|
   | `[MODEL]` |型号名称 |克劳德作品 4.6，GPT-5.4 |
   | `[CONTEXT]` |上下文窗口（如果已知）| 20万、1M |
   | `[THINKING]` |思维水平（如果已知）|延伸思考|
   | `[HARNESS]` |运行你的工具|克劳德代码、Codex、Gemini CLI |
   | `[HARNESS_URL]` |链接到该工具 | `https://claude.com/claude-code` |
   | `[VERSION]` | `plugin.json` → `version` | 2.40.0 |

   创建提交/PR 的子代理同样对准确归因负责。

2. **捕获并上传 UI 更改的屏幕截图**（任何 UI 工作都需要）

   对于**任何**设计更改、新视图或 UI 修改，您必须捕获并上传屏幕截图：

   **第 1 步：启动开发服务器**（如果未运行）
   ```bash
   bin/dev  # Run in background
   ```

   **Step 2: Capture screenshots with agent-browser CLI**
   ```bash
   agent-browser open http://localhost:3000/[route]
   agent-browser snapshot -i
   agent-browser screenshot output.png
   ```
   See the `代理浏览器` skill for detailed usage.

   **Step 3: Upload using imgup skill**
   ```bash
   skill: imgup
   # Then upload each screenshot:
   imgup -h pixhost screenshot.png  # pixhost works without API key
   # Alternative hosts: catbox, imagebin, beeimg
   ```

   **要捕捉什么：**
   - **新屏幕**：新用户界面的屏幕截图
   - **修改的屏幕**：屏幕截图之前和之后
   - **设计实现**：显示 Figma 设计匹配的屏幕截图

   **重要**：始终在 PR 描述中包含上传的图像 URL。这为审阅者提供了视觉上下文并记录了更改。

3. **创建拉取请求**```bash
   git push -u origin feature-branch-name

   gh pr create --title "Feature: [Description]" --body "$(cat <<'EOF'
   ## Summary
   - What was built
   - Why it was needed
   - Key decisions made

   ## Testing
   - Tests added/modified
   - Manual testing performed

   ## Post-Deploy Monitoring & Validation
   - **What to monitor/search**
     - Logs:
     - Metrics/Dashboards:
   - **Validation checks (queries/commands)**
     - `命令或查询此处`
   - **Expected healthy behavior**
     - Expected signal(s)
   - **Failure signal(s) / rollback trigger**
     - Trigger + immediate action
   - **Validation window & owner**
     - Window:
     - Owner:
   - **If no operational impact**
     - `无需额外的操作监控：<原因>`

   ## Before / After Screenshots
   | Before | After |
   |--------|-------|
   | ![before](URL) | ![after](URL) |

   ## Figma Design
   [Link if applicable]

   ---

   [![Spec First v[VERSION]](https://img.shields.io/badge/Spec_First-v[VERSION]-6366f1)](https://github.com/sunrain520/spec-first)
   🤖 Generated with [MODEL] ([CONTEXT] context, [THINKING]) via [HARNESS](HARNESS_URL)
   EOF
   )"
   ```

4. **Update Plan Status**

   If the input document has YAML frontmatter with a `状态` field, update it to `已完成`:
   ```
   status: active  →  status: completed
   ```

5. **通知用户**
   - 总结已完成的工作
   - 公关链接
   - 记下所需的任何后续工作
   - 建议后续步骤（如果适用）

---

## 代理团队的集群模式（可选）对于真正的大型计划，代理需要相互沟通、挑战方法或通过持续的专业角色协调 10 多个任务，请使用代理团队功能（如果可用）（例如，Claude Code 中的代理团队、Codex 中的多代理工作流程）。

**代理团队通常是实验性的，需要选择加入。** 不要尝试使用代理团队，除非用户明确请求群体模式或代理团队，并且平台支持它。

### 何时使用代理团队与子代理

|代理团队|子代理（标准模式）|
|------------------------|----------------------------|
|代理需要讨论和挑战彼此的方法 |每个任务都是独立的——只有结果才重要 |
|持续的专业角色（例如，持续运行的专用测试人员）|工人汇报并完成 |
| 10 多项具有复杂跨领域协调的任务 | 3-8 个具有清晰依赖链的任务 |
|用户明确请求“群体模式”或“代理团队” |大多数计划的默认设置 |

大多数计划应使用标准模式下的子代理调度。代理团队会增加大量的令牌成本和协调开销 - 当代理间通信真正改善结果时使用它们。

### 代理团队工作流程

1. **创建团队** — 使用您可用的团队创建机制
2. **创建任务列表**——将实施单元解析为具有依赖关系的任务
3. **产生团队成员** — 根据计划的需要分配专门的角色（实施者、测试者、审阅者）。为每个队友提供计划文件路径及其具体任务分配
4. **协调** - 领导者监控任务完成情况，如果有人陷入困境，则重新分配工作，并在阶段解锁时产生更多工作人员
5. **清理** — 关闭所有队友，然后清理团队资源

---## 外部委托模式（可选）

对于令牌保护很重要的计划，将代码实施委托给外部委托（当前为 Codex CLI），同时在当前代理中保留规划、审查和 git 操作。

此模式与现有的第 1 阶段第 4 步策略选择集成作为**任务级修饰符** - 策略（内联/串行/并行）仍然适用，但每个标记任务中的实现步骤委托给外部工具而不是直接执行。

### 何时使用外部委派

|外部代表团|标准模式 |
|--------------------|----------------------------|
|任务是纯代码实现 |任务需要研究或探索|
|计划有明确的验收标准|任务不明确或需要迭代 |
|代币保护很重要（例如 Max20 计划）|无限的计划或小任务|
|要更改的文件范围明确 |更改涉及许多相互关联的文件 |

### 启用外部委派

当满足以下任何条件时，外部委派将激活：
- 用户说“使用 codex 来完成这项工作”、“委托给 codex”或“委托模式”
- 计划实施单元在其执行注释中包含`Execution target: external-delegate`（由spec:plan设置）

具体的委托工具在执行时解析。目前唯一受支持的委托是 Codex CLI。可以在不更改计划文件的情况下添加未来的代表。

### 环境卫士

在尝试委派之前，请检查当前代理是否已在委派的沙箱内运行。沙箱内的委派将默默失败或递归。检查已知的沙箱指标：
- 设置`CODEX_SANDBOX`环境变量
- 设置`CODEX_SESSION_ID`环境变量
- 文件系统在 `.git/` 处是只读的（Codex 沙箱阻止 git 写入）

如果检测到任何指示器，则打印“已在委托沙箱内运行 - 使用标准模式”。并继续执行该任务的标准执行。

### 外部委派工作流程

当外部委派处于活动状态时，请针对每个标记的任务遵循此工作流程。不要因为任务看起来“小”、“简单”或“内联更快”而跳过委派。用户或计划明确请求授权。

1. **检查可用性**

   验证委托 CLI 是否已安装。如果未找到，则打印“未安装代理 CLI - 继续使用标准模式”。并正常进行。

2. **构建提示** — 对于每项任务，从计划的实施单元（项目 CLAUDE.md/AGENTS.md 中的目标、文件、方法、约定）收集提示。包含规则：无 git 提交、无 PR、完成后运行 `git status` 和 `git diff --stat`。切勿在提示中嵌入凭据或令牌 - 通过环境变量传递身份验证。

3. **将提示写入文件** — 将组装的提示保存到唯一的临时文件中，以避免 shell 引用问题和跨任务竞争。每个任务使用唯一的文件名。

4. **委托** — 运行委托 CLI，通过 stdin 管道传输提示文件（不是 argv 扩展，在大型提示上会点击 `ARG_MAX`）。省略模型标志以使用委托的默认模型，该模型无需手动更新即可保持最新状态。

5. **检查差异** — 委托完成后，验证差异是否非空且在范围内。运行项目的 test/lint 命令。如果差异为空或超出范围，则回退到该任务的标准模式。6. **提交** — 当前代理处理所有 git 操作。委托的沙箱会阻止 `.git/index.lock` 写入，因此委托无法提交。阶段更改并使用常规消息提交。

7. **错误处理** — 在任何委托失败（速率限制、错误、空差异）时，回退到该任务的标准模式。跟踪连续失败 - 连续 3 次失败后，禁用剩余任务的委派并打印“连续 3 次失败后委派禁用 - 以标准模式完成剩余任务”。

### 混合模型归因

当某些任务由委托执行而另一些任务由当前代理执行时，请在第 4 阶段使用以下属性：

- 如果所有任务都使用 delegate: 委托模型的属性
- 如果所有任务都使用标准模式：属性为当前代理的模型
- 如果混合：使用 `Generated with [CURRENT_MODEL] + [DELEGATE_MODEL] via [HARNESS]` 并注意 PR 描述中委派了哪些任务

---

## 关键原则

### 快速启动，执行更快

- 一开始就得到澄清，然后执行
- 不要等待完全理解 - 提出问题并行动
- 目标是**完成功能**，而不是创建完美的流程

### 计划是你的指南

- 工作文档应引用类似的代码和模式
- 加载这些参考文献并遵循它们
- 不要重新发明 - 匹配现有的

### 边走边测试

- 在每次更改后运行测试，而不是在最后运行测试
- 立即修复故障
- 持续测试可防止出现重大意外

### 质量是内置的

- 遵循现有模式
- 为新代码编写测试
- 在推送之前运行 linting
- 仅对复杂/有风险的变更使用审阅者代理

### 提供完整的功能- 在继续之前标记所有已完成的任务
- 不要让功能完成 80%
- 已发布的已完成功能胜过未发布的完美功能

## 质量检查表

在创建 PR 之前，请验证：

- [ ] 所有提出和回答的澄清问题
- [ ] 所有任务标记为已完成
- [ ] 测试通过（运行项目的测试命令）
- [ ] Linting 通行证（使用 linting-agent）
- [ ] 代码遵循现有模式
- [ ] Figma 设计匹配实现（如果适用）
- [ ] 捕获和上传屏幕截图之前/之后（用于 UI 更改）
- [ ] 提交消息遵循常规格式
- [ ] PR 描述包括部署后监控和验证部分（或明确的无影响理由）
- [ ] PR 描述包括摘要、测试说明和屏幕截图
- [ ] PR 描述包括具有准确模型、线束和版本的复合工程徽章

## 何时使用审阅代理

**默认情况下不要使用。** 仅在以下情况下使用审阅者代理：

- 影响许多文件的大型重构（10+）
- 安全敏感的更改（身份验证、权限、数据访问）
- 性能关键的代码路径
- 复杂的算法或业务逻辑
- 用户明确要求彻底审查

对于大多数功能：测试 + linting + 以下模式就足够了。

## 要避免的常见陷阱

- **分析瘫痪** - 不要想太多，阅读计划并执行
- **跳过澄清问题** - 现在就问，而不是在构建错误的东西之后
- **忽略计划参考** - 该计划有链接是有原因的
- **最后测试** - 持续测试或稍后受苦
- **忘记跟踪进度** - 随时更新任务状态或忘记已完成的工作
- **80% 完成综合症** - 完成功能，不要过早继续
- **过度审查简单的更改** - 节省审阅者代理的复杂工作
