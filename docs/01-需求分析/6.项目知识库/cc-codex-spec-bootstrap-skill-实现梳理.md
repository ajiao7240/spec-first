# `cc-codex-spec-bootstrap` Skill 实现梳理

本文基于以下两个源文件，对 `cc-codex-spec-bootstrap` 的当前实现做完整拆解：

- `/Users/kuang/Downloads/spec-first-1.3.11/marketplace/skills/cc-codex-spec-bootstrap/SKILL.md`
- `/Users/kuang/Downloads/spec-first-1.3.11/marketplace/skills/cc-codex-spec-bootstrap/references/mcp-setup.md`

目标不是复述文案，而是回答 6 个问题：

1. 这个 skill 到底做了什么事情
2. 它是怎么做的
3. 它依赖什么
4. 它会产生什么产物
5. 它有哪些执行规范
6. 如果要在别的项目里新增一个类似 skill，哪些实现模式值得复用

---

## 1. 一句话结论

`cc-codex-spec-bootstrap` 不是“脚本型自动化 skill”，而是一个**文档驱动的多 Agent 编排协议**。

它本身几乎不提供任何可执行代码，而是通过：

- 在 `SKILL.md` 中定义完整流程
- 在 `references/mcp-setup.md` 中定义环境安装与 MCP 配置
- 借助外部工具 `spec-first + GitNexus + ABCoder + Codex CLI`
- 明确区分 `Claude Code` 与 `Codex` 的职责

来完成“为代码仓库批量生成高质量 spec 文件”的 bootstrap 工作。

换句话说，这个 skill 的核心实现不在脚本里，而在**流程设计、职责划分、上下文约束、PRD 模板和验收标准**里。

---

## 2. 文件结构与职责分工

当前 skill 目录非常小，只有 2 个核心文件：

```text
cc-codex-spec-bootstrap/
├── SKILL.md
└── references/
    └── mcp-setup.md
```

### 2.1 `SKILL.md`

这是主入口，负责定义：

- skill 名称与触发描述
- 整体目标
- 三阶段执行流程
- Claude Code 与 Codex 的角色分工
- 任务拆分策略
- PRD 必填内容
- 并行执行方式
- 完成后的检查清单

### 2.2 `references/mcp-setup.md`

这是依赖说明文件，负责定义：

- GitNexus 的安装、索引、MCP 配置
- ABCoder 的安装、解析、MCP 配置
- 两类 MCP 工具的能力边界
- Claude Code 和 Codex 的环境验证方式

### 2.3 当前实现没有的东西

这个 skill **没有**：

- 独立脚本
- 自动创建任务的程序
- 自动生成 PRD 的模板渲染器
- 自动拉起多个 Codex worker 的 shell 脚本
- 自动验收或自动合并的逻辑
- 测试文件

所以它的实现重心是“指导如何做”，不是“替用户把步骤全部执行完”。

---

## 3. 这个 Skill 做了什么事情

它要解决的问题是：

> 给一个真实仓库初始化一套高质量、带项目上下文的 spec-first 规范文档，并且把这件事拆成多个可并行执行的小任务，交给 Codex agents 去补全。

更具体地说，它完成的是下面这条链路：

1. 由 `Claude Code` 先分析代码仓库
2. 借助 `GitNexus` 理解架构、模块群、执行流、依赖图
3. 借助 `ABCoder` 获取精确 AST、签名、类型、跨文件依赖
4. 按 `(package, layer)` 维度拆任务
5. 为每个任务生成一个包含丰富上下文的 `PRD`
6. 把这些任务并行交给 `Codex agents`
7. 让每个 Codex agent 只补自己负责的 spec 目录
8. 最后检查所有 spec 文件是否真的被填充为“项目真实规范”，而不是模板占位符

### 3.1 它的产出目标不是代码，而是知识资产

这个 skill 的目标产物不是：

- 新功能代码
- 重构后的模块
- 测试用例

而是：

- 面向项目的 coding specs
- 项目真实模式的例子
- 反模式说明
- 目录级知识索引

这是一种“知识基建 bootstrap” skill。

---

## 4. 它是怎么做的

这个 skill 的实现方法可以概括成一句话：

> 用 Claude Code 做重分析和任务编排，用 Codex 做大规模并行填表式执行。

### 4.1 角色分工

#### Claude Code 的职责

`Claude Code` 负责：

- 先做仓库分析
- 用 GitNexus 看架构和数据流
- 用 ABCoder 看 AST 和符号级细节
- 总结出足够强的架构上下文
- 创建多个 spec-first tasks
- 给每个 task 写好完整 PRD
- 在 PRD 中明确工具、范围、限制和验收标准

它扮演的是：

- 总设计师
- 任务拆分器
- 上下文打包器
- 流程 orchestrator

#### Codex 的职责

`Codex agents` 负责：

- 读取某一个 task 的 `prd.md`
- 用相同的 GitNexus + ABCoder MCP 工具进一步分析代码
- 补全该任务负责的 spec 文件
- 删除不适用模板
- 增补缺失文件
- 更新 `index.md`

它扮演的是：

- 并行 worker
- 局部执行者
- 规范内容填充器

### 4.2 三阶段流程

#### 阶段 1：Analyze the Repository

这一阶段的目标是建立足够强的架构认知。

执行方式：

1. 跑 `npx gitnexus analyze`
2. 用 GitNexus MCP 获取：
   - 执行流
   - 调用关系
   - 模块聚类
   - 影响范围
3. 跑 `abcoder parse ...`
4. 用 ABCoder MCP 获取：
   - repo 结构
   - file 结构
   - AST node 详情
   - 跨文件依赖与引用
5. 把结果整理成可以写进 PRD 的“架构上下文”

这一阶段要求 Claude Code 输出的不是“零碎观察”，而是：

- package 边界
- module clusters
- 核心模式
- 数据流
- 错误传播模式
- 状态管理方式

#### 阶段 2：Create spec-first Tasks

这一阶段的目标是把大问题拆成多个可并行执行的小问题。

拆分原则：

- 一个 `(package, layer)` 对应一个 task
- 常见层包括：
  - backend
  - frontend
  - cross-layer-guide

创建方式：

```bash
python3 .spec-first/scripts/task.py create "Fill <package> <layer> spec" --slug <package>-<layer>-spec
```

然后为每个 task 写 `prd.md`。

这个 skill 把 `PRD` 视为 Codex agent 的全部上下文容器，因此 PRD 结构是它最核心的实现之一。

#### 阶段 3：Launch Codex Agents

这一阶段的目标是把 task 并行执行掉。

执行方式：

- 每个 task 用一个 Codex 会话
- 每个 Codex 会话读取一个 `prd.md`
- 每个会话只处理自己的 spec 目录

建议命令：

```bash
codex -q "Read .spec-first/tasks/<task-slug>/prd.md and execute the task. Use GitNexus and ABCoder MCP tools to analyze the codebase, then fill all spec files listed in the PRD."
```

这里依然没有“自动调度器脚本”，skill 采用的是**命令约定 + 人工并行拉起**的模型。

---

## 5. 当前实现里最关键的协议设计

如果只看表面，这个 skill 只是几段步骤说明；但真正决定它质量的，是下面这些协议。

### 5.1 PRD 是核心控制面

这个 skill 的关键不是 task 目录本身，而是 `prd.md`。

每个 PRD 必须包含：

- `Goal`
- `Context`
- `Tools Available`
- `Files to Fill`
- `Important Rules`
- `Acceptance Criteria`
- `Technical Notes`

这意味着 Codex 不是“凭空发挥”，而是在一个约束完整的任务合同里工作。

### 5.2 工具模板内嵌在 PRD 里

这是个很重要的设计点。

skill 没有假设 Codex agent 会自然知道如何使用 GitNexus 和 ABCoder，而是要求在每个 PRD 里显式内嵌：

- MCP server 名称
- 每个 tool 的用途
- 调用示例
- 建议工作顺序

这解决了两个问题：

1. worker 不需要回到 skill 文档里重新找工具用法
2. task 上下文可以独立传播，减少执行歧义

### 5.3 “Spec files are NOT fixed”

这是当前 skill 最好的规则之一。

它明确告诉 Codex：

- 模板不是圣经
- 不适用的文件可以删
- 模板覆盖不到的模式可以新建文件
- 文件名可以按项目实际情况调整
- `index.md` 必须跟最终结构对齐

这让这个 skill 不是“模板填空器”，而是“项目语义适配器”。

### 5.4 并行执行中的写入边界非常明确

skill 对 Codex 的写入边界控制很严格：

- 只能修改自己负责的 spec 目录
- 不能改源代码
- 不能改别的 spec 目录
- 不能改 task 文件
- 不能跑 git 命令
- 可以自由读取任意源码做分析

这让并行执行具备了最基本的安全性和可控性。

### 5.5 验收标准不是抽象口号，而是可检查条件

当前 skill 的 acceptance criteria 明确要求：

- 必须有真实代码示例
- 必须记录 anti-pattern
- 不能残留 placeholder
- `index.md` 要反映最终文件集合

同时在 review 阶段还给了几个简易启发式检查：

- 看行数，低于阈值可能还是空模板
- grep 占位文本
- spot-check 是否真有代码例子

虽然这套检查不算强自动化，但足够实用。

---

## 6. 依赖梳理

这个 skill 的依赖可以分为 4 层。

### 6.1 直接运行依赖

| 依赖 | 作用 | 在 skill 中如何出现 |
| --- | --- | --- |
| `spec-first` | 提供 `.spec-first/` 目录、task 机制、spec 目录结构 | `task.py create`、`get_context.py` |
| `GitNexus` | 生成知识图谱，提供架构级查询能力 | `npx gitnexus analyze`、GitNexus MCP |
| `ABCoder` | 生成 AST 结构，提供符号级精确查询 | `abcoder parse`、ABCoder MCP |
| `Codex CLI` | 并行执行 task | `codex -q ...` |
| `Claude Code` | 上游分析与编排者 | skill 主体默认执行者 |

### 6.2 命令级依赖

从文档可见，它隐含依赖以下命令环境：

- `python3`
- `npx`
- `npm`
- `abcoder`
- `codex`
- `grep`
- `find`
- `wc`
- `ls`

也就是说，这不是一个“零依赖文本 skill”，而是一个高度依赖宿主命令行环境的 orchestrator skill。

### 6.3 MCP 依赖

这个 skill 非常依赖 MCP。

#### GitNexus MCP

主要能力：

- `gitnexus_query`
- `gitnexus_context`
- `gitnexus_impact`
- `gitnexus_cypher`

定位：

- 架构层
- 模块关系层
- 执行流层
- 影响分析层

#### ABCoder MCP

主要能力：

- `list_repos`
- `get_repo_structure`
- `get_package_structure`
- `get_file_structure`
- `get_ast_node`

定位：

- 文件层
- 符号层
- AST 层
- 精确代码提取层

### 6.4 环境前提依赖

这个 skill 默认假设宿主仓库已经满足下面条件：

1. 仓库已经初始化过 `spec-first`
2. 仓库里存在 `.spec-first/scripts/task.py`
3. 仓库里存在 `.spec-first/scripts/get_context.py`
4. 当前项目允许创建 `.spec-first/tasks/` 与 `.spec-first/spec/`
5. Claude Code 与 Codex 都能访问同一份代码仓库
6. Claude Code 与 Codex 都配置好了 GitNexus 和 ABCoder MCP
7. 代码库足够大，值得用架构分析 + 任务并行的方式处理

### 6.5 产物型依赖

它还依赖两个中间产物已经存在或可被创建：

- `.gitnexus/`
- `~/abcoder-asts/*.json`

没有这两个产物，后续 MCP 查询能力就会显著缩水。

---

## 7. 它会产生哪些产物

这个 skill 的产物可以分为 3 类。

### 7.1 外部工具产物

这些不是 skill 直接写的，但属于流程中必须生成的产物。

#### GitNexus 产物

```text
.gitnexus/
```

包含：

- KuzuDB 图数据库
- meta 信息
- 节点 / 边 / cluster / flow 数据

#### ABCoder 产物

```text
~/abcoder-asts/<repo-name>-ast.json
```

包含：

- repo AST
- package/file/node 层级结构
- 依赖与引用信息

### 7.2 task 级产物

这是 skill 间接驱动产生的最核心中间产物。

```text
.spec-first/tasks/<task-slug>/
└── prd.md
```

可能还会有：

- task 元数据
- task 描述
- 与任务相关的上下文文件

但从当前 skill 文案看，最关键的是 `prd.md`。

### 7.3 spec 级最终产物

这是流程真正想要的结果。

```text
.spec-first/spec/<package>/<layer>/*.md
```

具体会包括：

- 被填充后的 spec markdown
- 被删掉的不适用模板
- 新增的项目特有模式说明文件
- 被更新过的 `index.md`

### 7.4 这个 skill 明确不应该产生的东西

它明确限制 worker **不应该**产出下面这些东西：

- 源码修改
- 跨目录 spec 修改
- git 历史变更
- 其他 task 的副作用

这说明这个 skill 的目标是“知识文档生成”，不是“代码改造”。

---

## 8. 它有哪些规范

这是你后续复用时最值得保留的部分。

### 8.1 任务拆分规范

- 以 `(package, layer)` 为最小任务单元
- 每个 task 必须可独立执行
- 尽量避免两个 task 写同一目录
- 没有 frontend/backend 的包就跳过该层

### 8.2 PRD 结构规范

每个 task 的 PRD 必须有统一章节，不允许自由发挥到失控：

- 目标
- 上下文
- 工具说明
- 文件列表
- 规则
- 验收标准
- 技术备注

### 8.3 工具使用规范

推荐顺序被写死为：

1. 先 GitNexus
2. 再 ABCoder
3. 再回源文件精读
4. 最后写 spec

这实际上是在约束分析层次：

- 先宏观
- 再微观
- 最后落笔

### 8.4 写入边界规范

worker 必须遵守：

- 只写自己的 spec 目录
- 不写源码
- 不写其他 task 目录
- 不跑 git
- 可以读任意文件

这是并行执行安全性的基础。

### 8.5 内容质量规范

每份 spec 要满足：

- 用真实代码例子
- 标注真实文件路径
- 记录 anti-pattern
- 不留模板占位符
- `index.md` 与实际文件同步

### 8.6 模板适配规范

skill 强调：

- 模板不是固定结构
- 要以项目现实为准
- 可以删、改、增

这条规范非常关键，因为它防止生成结果退化成“复制模板”。

### 8.7 环境验证规范

在 `references/mcp-setup.md` 中，还定义了 setup 完成后的验证：

- `claude mcp list`
- `codex mcp list`
- `ls .gitnexus/meta.json`
- `ls ~/abcoder-asts/*.json`

说明这个 skill 不把“配置成功”当作默认前提，而是要求显式验证。

---

## 9. 这个 Skill 的真实实现边界

这里必须讲清楚，否则很容易误判它的复杂度。

### 9.1 它显式实现了什么

它显式实现了：

- 一个 frontmatter 完整的 skill 入口
- 一个三阶段 bootstrap 流程
- 一套 task decomposition 策略
- 一份 PRD 结构合同
- 一份 MCP tools 模板
- 一套 review checklist
- 一份依赖安装说明

### 9.2 它没有显式实现什么

它没有显式实现：

- repo 自动分析脚本
- task 自动拆分程序
- PRD 自动生成程序
- worker pool 自动调度器
- 成果聚合器
- 失败重试机制
- 质量评分器
- 自动修补 placeholder 的流程

### 9.3 所以它本质上是什么

它本质上是一个：

**“强约束流程规范 + 外部工具编排说明”型 skill**

而不是：

**“内置自动化逻辑”型 skill**

如果你要在其他项目参考它来新增 skill，第一步不是问“抄哪些脚本”，而是先决定：

> 你想做的是说明型 skill，还是脚本型 skill？

---

## 10. 当前实现的优点

### 10.1 职责切分非常清楚

Claude Code 负责分析与规划，Codex 负责执行与填充，边界明确，不会互相抢角色。

### 10.2 上下文传播设计很好

把 MCP tool 说明直接塞进 PRD，使 task 可以独立执行，不依赖 worker 再回头读总 skill。

### 10.3 并行安全边界足够明确

只允许写自己的 spec 目录，能大幅降低并行冲突。

### 10.4 模板适配而不是模板服从

允许删改增模板，这比很多“规范生成器”更接近真实项目。

### 10.5 验收标准务实

它没有追求复杂评分系统，而是用：

- 行数
- placeholder 检查
- spot check

做低成本质量把关，实际可落地。

---

## 11. 当前实现的局限与隐患

如果你要在别的项目里复用，这部分也要一起继承。

### 11.1 自动化程度低

整个 skill 大量依赖人工执行命令和人工判断：

- 人工分析架构
- 人工写 PRD
- 人工拉起多个 Codex
- 人工 review 结果

所以它更像“专家作业流程模板”，不是“一键 bootstrap”。

### 11.2 质量高度依赖上游 PRD 质量

Codex 的质量上限基本由 `prd.md` 决定。

如果 `Context` 写得弱，worker 很容易输出泛化 spec。

### 11.3 强依赖 MCP 环境完整性

一旦：

- GitNexus 没索引成功
- ABCoder AST 不完整
- Codex 没挂上 MCP

整个流程就会显著退化。

### 11.4 默认面向多 package / 多 layer 项目

这个 skill 对 monorepo 或复杂仓库更友好。

如果项目很小，`(package, layer)` 这套拆法可能过重。

### 11.5 验收没有机器强约束

目前的检查仍然偏启发式，没有：

- schema 校验
- 必填章节 lint
- 代码示例有效性验证
- anti-pattern 完整性校验

---

## 12. 如果你要在其他项目新增一个类似 Skill，哪些实现模式值得复用

这是最重要的复用结论。

### 12.1 可以直接复用的骨架

建议保留下面这个结构：

```text
your-skill/
├── SKILL.md
└── references/
    └── setup.md
```

适用场景：

- skill 自身主要是流程规范
- 依赖外部工具较多
- 需要把安装步骤和主流程分离

### 12.2 `SKILL.md` 里建议保留的章节

建议至少保留：

1. `Why This Exists`
2. `Prerequisites`
3. `Phase 1/2/3...`
4. `Task Decomposition Strategy`
5. `Rules`
6. `Acceptance Criteria`
7. `Checklist`

这 7 类内容基本构成了一个说明型 orchestrator skill 的最小骨架。

### 12.3 必须保留的设计思想

新增类似 skill 时，最值得保留的是：

- 明确上游 orchestrator 与下游 worker 的角色
- 用任务合同承载上下文，不靠口头传递
- 明确写入边界
- 明确允许模板适配现实
- 明确验收标准
- 明确依赖安装与验证步骤

### 12.4 建议增强的地方

如果你在别的项目里要做增强版，可以补：

- 自动 task 生成脚本
- PRD 模板渲染器
- 并行 worker 启动脚本
- spec lint 校验器
- placeholder 自动检测脚本
- 结果汇总脚本

这样就能把它从“说明型 skill”升级成“半自动 skill”。

### 12.5 命名与规范建议

如果放进 `spec-first` 这类体系中，建议延续当前仓库的规范：

- skill 目录名使用 `kebab-case`
- `SKILL.md` 里的 `name:` 与目录名一致
- 不要在 skill 正文里硬编码平台运行时路径
- 引用 agent 时优先使用 canonical 名称，而不是平台路径
- 源码资产维护在 canonical 目录，运行时目录只当生成物

这些规范可以参考本仓库已有文档《新增 Skill / Agent 标准操作清单》。

---

## 13. 复用时的判断准则

如果你准备在其他项目里新增一个 skill，可以先用下面 4 个问题判断是不是该参考这个实现：

### 13.1 适合参考它的情况

- 你要做的是“多阶段流程 skill”
- 你要编排多个 Agent 或多个工具
- 你需要上游分析、下游并行执行
- 你最终产物主要是文档、规范、计划或知识资产
- 你希望 worker 在强约束合同下运行

### 13.2 不适合直接照抄的情况

- 你要做的是单步工具 skill
- 你要的是脚本自动执行，而不是说明驱动
- 你没有 MCP 或代码情报依赖
- 你的项目很小，不需要并行拆 task
- 你的产物是代码变更而不是知识文档

---

## 14. 最终结论

`cc-codex-spec-bootstrap` 的实现价值，不在于它写了多少脚本，而在于它把下面这件事定义清楚了：

> 如何把“仓库架构分析 -> 任务拆分 -> PRD 上下文打包 -> 并行 worker 执行 -> 规范文档验收”串成一条稳定流程。

它的真正资产是：

- 流程分层
- 职责边界
- PRD 合同
- MCP tool 模板
- 写入边界
- 验收标准

如果你要在其他项目新增一个 skill，最值得借鉴的不是“复制这份 Markdown”，而是复制这套设计原则：

1. 把 skill 当成协议层，而不是只当说明文档
2. 把上下文写进 task 合同，而不是依赖 agent 自己猜
3. 把依赖安装说明拆到 `references/`
4. 把并行写入边界提前定义清楚
5. 把模板适配现实写成硬规则
6. 把验收标准从一开始就写死

这才是这个 skill 当前实现里最有价值的部分。
