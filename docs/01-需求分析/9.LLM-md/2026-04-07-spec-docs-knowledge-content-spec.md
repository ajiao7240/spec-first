# spec-docs 知识库内容规范

> 文档性质：知识库**内容定义**——记什么、长什么样、怎么组织
> 版本：2.0（综合 LLM Wiki + 胶水编程实践）
> 日期：2026-04-07
> 范围：本文只讨论知识库存什么，不讨论 CLI 实现、配置绑定、路径解析

---

## 一、设计哲学

### 三个基础认知

**编译一次，不重新推导（LLM Wiki）**

知识在写入时综合，消费时直接加载。spec-bootstrap 分析代码库一次，产出结构化知识；spec-plan/work/review 启动时直接读取，不重复分析原始代码。

**90% 抄，10% 写（胶水编程）**

AI 写代码时，绝大部分参照已有的代码和规范，只在业务差异点写胶水。知识库的职责是"让 AI 有东西可抄"，而不是"让 AI 更好地从零创作"。

**内容准入标准：AI 能从公开资料获取吗？**

```
AI 能从公开训练数据获取？
  → 能：不放进知识库（React API、通用算法、公开框架用法）
  → 不能：核心知识，必须放进来
         ├── 内部库 / 私有组件的 API 和用法
         ├── 项目特有的编码约定和禁忌
         ├── 只在这个代码库里才会踩的坑
         └── 团队已经做过但 AI 看不到的决策
```

这是知识库每一条内容的取舍依据，也是防止知识库膨胀失效的关键约束。

### 为什么这两个来源能相互印证

| 维度 | LLM Wiki | 胶水编程 |
|---|---|---|
| 知识形态 | Markdown wiki，持久复利 | 四层物料，按需注入 |
| 核心主张 | 编译一次，跨时间复用 | 有东西可抄，AI 做拟合不做创作 |
| 消费方式 | 查 index → 读相关页面 | 静态注入 or 动态检索 |
| 共同结论 | **知识必须被显式外化；隐性知识不被 AI 消费** | 同左 |

胶水编程补充了 LLM Wiki 没有的一点：**加载方式决定效果**——关键规则必须静态在场，不能依赖 AI 主动检索。

---

## 二、目录结构

```
spec-docs/
├── _shared/                          ← 跨项目共享（Phase 2+）
│
└── <slug>/
    │
    ├── README.md                     ← 项目身份卡（init 写入）
    ├── CLAUDE.md                     ← wiki schema（init 骨架，bootstrap 补充）
    ├── index.md                      ← 全量内容目录（每次写入后更新）
    ├── log.md                        ← 操作时间线（append-only）
    │
    ├── contexts/                     ← 项目知识（spec-bootstrap 产物）
    │   │
    │   ├── summary.md                ★ 静态加载：项目一句话定位 + 技术栈 + 模块清单
    │   ├── conventions.md            ★ 静态加载：规矩层（最高优先级）
    │   │
    │   ├── internal-apis/            ◆ 动态检索：内部库/私有组件文档
    │   │   └── <module-name>.md      ← 每个内部模块一个文件
    │   │
    │   ├── architecture/             ◆ 动态读取：结构理解
    │   │   ├── overview.md           ← 宏观运行机制、数据流、关键不变式
    │   │   └── module-map.md         ← 模块清单、依赖关系、参考实现指针
    │   │
    │   ├── pitfalls/                 ◆ 动态检索：已知陷阱
    │   │   └── index.md
    │   │
    │   └── layers/                   ◆ 动态读取：各层内部结构
    │       ├── <layer>/index.md
    │       └── database/index.md     ← ER 图、表关系（从顶层移入）
    │
    └── solutions/                    ← 团队经验（spec-compound 产物）
        ├── build-errors/
        ├── test-failures/
        ├── runtime-errors/
        └── architecture-decisions/
```

**★ 静态加载**：skill 启动时必读，体积小，始终在场。
**◆ 动态检索**：按任务相关性读取，避免上下文过载。

---

## 三、加载策略

胶水编程实践数据：将关键规则静态注入后，通过率从 53% → 100%；依赖 AI 主动检索时，56% 场景下 AI 根本不会主动调用。

```
skill 启动
    │
    ├─ 必读（静态，始终在场）
    │   ├── log.md          → 知识库最近动态，几行即可掌握上下文时效
    │   ├── index.md        → 全量页面目录，定位后续需读哪些页
    │   ├── summary.md      → 项目是什么，30 秒定向
    │   └── conventions.md  → 规矩，不能依赖 AI 主动查
    │
    └─ 按需读（动态，任务相关时加载）
        ├── internal-apis/<module>.md    → 用到该内部模块时
        ├── architecture/overview.md     → 理解运行机制时
        ├── architecture/module-map.md   → 确认改哪些文件时
        ├── pitfalls/index.md            → 涉及高风险模块时
        ├── layers/<layer>/index.md      → 深入某一层时
        └── solutions/ 相关条目          → 搜索历史经验时
```

---

## 四、文件规范

### 4.1 导航层

#### index.md

```markdown
---
slug: <project-slug>
updated_at: <ISO 8601>
total_contexts: <number>
total_solutions: <number>
last_bootstrap_commit: <git-sha>
---

# Knowledge Index — <project-name>

## 项目知识（contexts/）

| 文件 | 描述 | 加载方式 | 更新时间 |
|---|---|---|---|
| [summary](contexts/summary.md) | 项目定位、技术栈、核心模块 | 静态 | 2026-04-07 |
| [conventions](contexts/conventions.md) | 编码约定、禁用项、特有规则 | 静态 | 2026-04-07 |
| [internal/state](contexts/internal-apis/state.md) | state.js 读写 API | 动态 | 2026-04-07 |
| [overview](contexts/architecture/overview.md) | 系统运行机制 | 动态 | 2026-04-07 |
| [module-map](contexts/architecture/module-map.md) | 模块清单与依赖 | 动态 | 2026-04-07 |
| [pitfalls](contexts/pitfalls/index.md) | 已知陷阱（N 条） | 动态 | 2026-04-07 |

## 团队经验（solutions/）

| 文件 | 类型 | 严重程度 | 日期 |
|---|---|---|---|
| [fix-circular-dep](solutions/build-errors/fix-circular-dep.md) | build-error | high | 2026-04-06 |
```

#### log.md

```markdown
# Knowledge Log — <project-name>

## [2026-04-07] bootstrap | commit abc1234 | 9 pages updated
- updated: summary.md, conventions.md, module-map.md, overview.md, pitfalls/index.md
- added: internal-apis/state.md, internal-apis/plugin.md, layers/cli/index.md
- diff_from_prev: +2 pages, 4 pages revised

## [2026-04-06] compound | fix-circular-dep | solutions/build-errors/
- source_commit: def5678
- severity: high, affected: [core, adapters]
```

#### CLAUDE.md（wiki schema）

```markdown
# spec-docs Wiki Schema — <project-name>

## 结构
- contexts/ — 项目知识，spec-bootstrap 写入
- solutions/ — 团队经验，spec-compound 追加
- index.md — 内容目录，每次写入后更新
- log.md — 操作时间线，只追加

## 内容准入标准
只存 AI 从公开资料无法获取的知识：
- 内部库 API → internal-apis/
- 项目特有约定 → conventions.md
- 项目特有陷阱 → pitfalls/index.md
- 团队解题经验 → solutions/

## 加载规则
- 始终加载（静态）：summary.md + conventions.md
- 按需加载（动态）：internal-apis/ + architecture/ + pitfalls/ + solutions/

## 写入规则
- 所有文件必须有 YAML frontmatter
- 写入后更新 index.md
- 写入后追加 log.md
- 文件间用相对路径互相引用

## 项目特有说明
<spec-bootstrap 填充>
```

---

### 4.2 contexts/ 通用 frontmatter

```yaml
---
slug: <project-slug>
page_type: summary | conventions | internal-api | overview | module-map | pitfalls | layer | database
source_commit: <bootstrap 时代码库 HEAD SHA>
updated_at: <ISO 8601>
generated_by: spec-bootstrap
confidence: high | medium | low
---
```

---

### 4.3 contexts/summary.md ★

**目的**：30 秒定向。始终静态加载，体积控制在 1-2 屏。

```markdown
---
slug: spec-first
page_type: summary
source_commit: abc1234
updated_at: 2026-04-07T10:00:00Z
generated_by: spec-bootstrap
confidence: high
entry_points: [bin/spec-first.js, src/cli/commands/init.js]
tech_stack: {language: JavaScript, runtime: "Node 18+", package_manager: npm}
core_modules:
  - {name: plugin, path: src/cli/plugin.js, role: 资产同步核心}
  - {name: init, path: src/cli/commands/init.js, role: init 命令入口}
  - {name: doctor, path: src/cli/commands/doctor.js, role: 运行时检查}
---

# 项目概览 — spec-first

一句话：Node.js CLI，将 workflow 资产（skills/agents/commands）安装到 `.claude/` 目录。

## 核心模块
| 模块 | 路径 | 职责 |
|---|---|---|
| plugin | src/cli/plugin.js | 加载 manifest，同步资产 |
| init | src/cli/commands/init.js | init 命令入口 |
| doctor | src/cli/commands/doctor.js | 运行时完整性检查 |
| adapters/claude | src/cli/adapters/claude.js | canonical name 重写 |

→ 模块依赖详见 [module-map](architecture/module-map.md)
→ 编码规矩详见 [conventions](conventions.md)
```

---

### 4.4 contexts/conventions.md ★（最高优先级）

**目的**：AI 写代码的底线约束，始终静态在场。

**内容标准**：只写 AI 从公开资料学不到的项目特有规矩。不写"用 const 而非 let"这类通用规范。

```markdown
---
slug: spec-first
page_type: conventions
source_commit: abc1234
updated_at: 2026-04-07T10:00:00Z
generated_by: spec-bootstrap
confidence: high
---

# 编码约定 — spec-first

## 必须用的内部模块
- 状态读写：`readState()` / `writeState()` / `buildState()`（src/cli/state.js）
  ❌ 禁止直接 JSON.parse/stringify state 文件
- docs 字段读写：`readDocsFields()` / `writeDocsFields()`（src/cli/state.js）
  ❌ 禁止通过 normalizeState 写入 docs 字段（会被 schema 过滤）

## 请求 / IO 约定
- 所有写文件操作必须先写 `.tmp` 再 `renameSync`（原子写入）
- git URL 存储前必须经过 `normalizeGitUrl()` 规范化

## 禁止项
- 禁止在 normalizeState 里新增字段（污染未配置 docs 的项目）
- 禁止 skill 自动重写 docs-local.json（CLI 是唯一写入方）

## 测试约定
- 集成测试用 `git init` 创建 bare repo，不 mock git
- smoke test 验证 CLI 输出，不验证文件内容

## 参考实现（可抄的代码）
- init 流程：src/cli/commands/init.js
- state 读写：src/cli/state.js（readDocsFields 是新增字段的标准模式）
- 测试骨架：tests/unit/mcp-setup.sh（assert_contains / assert_output 模式）
```

---

### 4.5 contexts/internal-apis/\<module\>.md ◆

**目的**：AI 从公开训练数据学不到的内部模块 API。

**准入判断**：这个模块/库的用法，AI 在 Google 上能搜到吗？搜不到 → 必须写。

```markdown
---
slug: spec-first
page_type: internal-api
module: state
source_commit: abc1234
updated_at: 2026-04-07T10:00:00Z
generated_by: spec-bootstrap
confidence: high
---

# state.js — 内部 API

## 函数清单

### readState(projectRoot, adapter) → StateObject
读取 `.claude/spec-first/state.json`，经过 normalizeState 过滤。
⚠️ 注意：normalizeState 有固定字段集，新字段不走这里。

### writeState(projectRoot, adapter, state)
序列化时调用 `normalizeState(state)` 过滤，确保不写入未声明字段。

### readDocsFields(projectRoot, adapter) → { docsRepo?, docsProjectSlug? }
绕过 normalizeState，直接读取原始 JSON 中的 docs 字段。

### writeDocsFields(projectRoot, adapter, { docsRepo, docsProjectSlug })
原子写入（.tmp + renameSync）。空值时删除对应键，不写空字符串。

## 典型用法

```js
// 读取 docs 字段
const { docsRepo } = readDocsFields(projectRoot, adapter)

// 写入 docs 字段（不影响 normalizeState 管理的其他字段）
writeDocsFields(projectRoot, adapter, { docsRepo: 'github.com/org/spec-docs' })
```

## 已知陷阱
→ [normalizeState 字段过滤](../pitfalls/index.md#normalizestate)
```

---

### 4.6 contexts/architecture/overview.md ◆

**目的**：宏观运行机制——请求/数据如何在系统里流动。

```markdown
---
slug: spec-first
page_type: overview
source_commit: abc1234
updated_at: 2026-04-07T10:00:00Z
generated_by: spec-bootstrap
confidence: high
---

# 系统运行机制

## init 主流程

```
用户: spec-first init --claude
    ↓
parseInitArgs()           → 解析 CLI 参数
detectWorkspace(cwd)      → 识别 pnpm/npm/turbo/single
promptDocsRepo()          → 交互获取 docs repo（若未配置）
resolveDocsInput(input)   → URL or 本地路径 → { repo, localPath }
    ↓ workspace 分叉
runWorkspaceInit()        → 多项目：发现子项目、推断 slug、建骨架
runSingleProjectInit()    → 单项目：安装 skills/agents/commands
    ↓
syncBundledAssets()       → plugin.js 执行资产同步
rewriteAgentNames()       → claude adapter 重写 canonical name
writeState()              → 写入 state.json
```

## 关键不变式
- git 操作（pull/push）必须在所有本地文件写入之前完成
- CLAUDE.md 语言策略由 lang-policy.js 管理，用标记块，不全量覆盖
```

---

### 4.7 contexts/architecture/module-map.md ◆

**目的**：改这个功能要动哪些文件。

```markdown
---
slug: spec-first
page_type: module-map
source_commit: abc1234
updated_at: 2026-04-07T10:00:00Z
generated_by: spec-bootstrap
confidence: high
modules:
  - {name: plugin, path: src/cli/plugin.js, api: [syncBundledAssets]}
  - {name: state, path: src/cli/state.js, api: [readState, writeState, readDocsFields, writeDocsFields]}
  - {name: adapters/claude, path: src/cli/adapters/claude.js, api: [rewriteAgentNames]}
---

# 模块地图

## 依赖关系
```
init.js → plugin.js → adapters/claude.js
       → state.js
       → developer.js
       → lang-policy.js
       → docs-config.js（Phase 1 新增）
       → workspace.js（Phase 1 新增）
```

## 模块职责表

| 模块 | 路径 | 职责 | 关键 API |
|---|---|---|---|
| plugin | src/cli/plugin.js | 加载 manifest，资产同步 | `syncBundledAssets()` |
| state | src/cli/state.js | state.json 读写 | `readState()` `writeDocsFields()` |
| adapters/claude | src/cli/adapters/claude.js | canonical name 重写 | `rewriteAgentNames()` |

## 参考实现
- 新增 CLI 命令参考：`src/cli/commands/init.js`
- 新增 state 字段参考：`src/cli/state.js` 中的 `readDocsFields`
```

---

### 4.8 contexts/pitfalls/index.md ◆

**目的**：项目特有的高风险点，每条必须有触发条件和缓解方案。

**内容标准**：只写只在这个项目才会踩的坑，通用 JS 问题不写。

```markdown
---
slug: spec-first
page_type: pitfalls
source_commit: abc1234
updated_at: 2026-04-07T10:00:00Z
generated_by: spec-bootstrap
pitfall_count: 4
---

# 已知陷阱

## normalizeState 字段过滤 {#normalizestate}
**触发**：在 normalizeState 里新增字段
**后果**：所有未配置 docs 的项目 state.json 出现空值
**缓解**：新字段用 readDocsFields / writeDocsFields 独立管理
→ [state.js API](../internal-apis/state.md)

## normalizeGitUrl 凭证泄露
**触发**：传入带 userinfo 的 URL（https://token@github.com/...）
**后果**：凭证进入 state.json 并被 commit
**缓解**：normalizeGitUrl 必须正则提取 host+path，遇 userinfo 抛错

## git pull --ff-only 后本地写入
**触发**：在 git pull 之前写入本地文件，pull 失败后状态不一致
**缓解**：不变式——所有 git 操作必须先于任何本地文件写入

## docs-local.json 失效无自愈
**触发**：localPath 变更后 docs-local.json 未更新
**后果**：skill 降级运行但无提示，用户不知道
**缓解**：检测失效时必须打印 WARNING，唯一修复方式是 re-init
```

---

### 4.9 solutions/ — 团队经验条目

**frontmatter schema**：

```yaml
---
slug: <project-slug>
problem_type: build-error | test-failure | runtime-error | architecture-decision | integration-issue
severity: critical | high | medium | low
confidence: high | medium | low
affected_modules: [module-a, module-b]
pattern_type: incident | antipattern | best-practice
source_commit: <git-sha>
created_at: <ISO 8601>
updated_at: <ISO 8601>
---
```

**正文结构**（每个字段对应胶水编程的一层物料）：

```markdown
# <问题标题>（动词开头）

## 问题描述
<什么情境下触发，复现条件>

## 根因
<为什么会发生>

## 解决方案
<做了什么，关键代码或操作步骤>

## 验证方式
<怎么确认已解决>

## 关联
→ [相关陷阱](../../contexts/pitfalls/index.md#...)
→ [相关模块 API](../../contexts/internal-apis/...)
```

---

## 五、产出方与消费方

| Skill | 角色 | 读/写 |
|---|---|---|
| spec-bootstrap | 生产方（全量刷新） | 写 contexts/ 全部文件；更新 index.md；追加 log.md |
| spec-compound | 生产方（增量追加） | 写 solutions/ 新条目；更新 index.md；追加 log.md |
| spec-plan | 消费方 | 静态：summary + conventions；动态：architecture + solutions |
| spec-work | 消费方 | 静态：summary + conventions；动态：internal-apis + pitfalls + solutions |
| spec-review | 消费方 | 静态：summary + conventions；动态：architecture + pitfalls + solutions |
| doctor | 巡检方 | 读 log.md（新鲜度）；读 index.md（孤立页面）；检查 conventions.md 存在性 |

---

## 六、设计边界

### 不存什么

| 内容 | 原因 |
|---|---|
| 公开框架 / 语言 API | AI 已知，放进来只增加噪声（降低采纳率） |
| plans / brainstorms | 面向特定需求，生命周期短 |
| review findings | 面向特定 PR，短命；recurring patterns 通过 compound 进入 solutions/ |
| 执行层资产（meta.json、preflight.json、signals.json） | 单次执行产物，高频，留在本地 `.context/spec-first/work/` |
| 代码模式（样板间） | 是实际可运行代码，不是文档；留在代码仓库 `reference/` 目录；module-map.md 提供指针 |

### 关于代码模式（样板间）

胶水编程说给 AI 看 500 行实际代码比写 50 条规则有效。这是对的，但代码模式（样板间）本质是**可运行的参考代码**，不是文档，不适合放进 spec-docs。

正确的位置是代码仓库的 `reference/` 目录（或类似），spec-docs 里的 `conventions.md` 和 `module-map.md` 明确指向这些参考实现：

```markdown
## 参考实现（可抄的代码）
- init 命令扩展参考：src/cli/commands/init.js（runWorkspaceInit 模式）
- 单元测试骨架：tests/unit/mcp-setup.sh
```

---

## 附录：与上游方案的关系

| 方案 | 关系 |
|---|---|
| `spec-first-独立文档仓库方案-v2.md` | 存储基础设施（git、slug、workspace）——本文不覆盖，直接继承 |
| `2026-04-07-spec-docs-independent-knowledge-repo-technical-spec.md` | CLI Phase 1 实施（Task 1-6）——本文替代其中的"一、产出内容"节 |
| Harness Engineering 实施分期 | 执行层 JSON（meta/preflight/signals）不进 wiki；bootstrap 产出的项目理解在 contexts/ 用 Markdown+frontmatter 表达 |
| 胶水编程（天猫实践） | conventions.md 对应开发规范层；internal-apis/ 对应领域知识层（60-70% 用量）；静态/动态加载策略直接采用 |
