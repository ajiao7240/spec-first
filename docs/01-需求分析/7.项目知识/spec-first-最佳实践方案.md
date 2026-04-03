# spec-first 最佳实践方案

> 综合来源：Harness Engineering 指南 × 胶水编程最佳实践 × 生态集成优化分析
> 基准版本：spec-first v1.5.x（2026-04-04）
> 范围：spec-bootstrap / spec-plan / spec-work / spec-review / spec-compound / spec-brainstorm / spec-ideate

---

## 一、现状诊断

### 三层递进：spec-first 停在了第二层

胶水编程定义了 AI 编码的三级可控性递进：

| 层级 | 解决的问题 | spec-first 现状 |
|------|-----------|----------------|
| **Vibe Coding** | AI 能写代码 | — |
| **SPEC Coding** | AI 写对的代码 | ✅ brainstorm + plan 体系完善 |
| **Glue Coding** | AI 写出"你的"代码 | ❌ 缺物料层，Agent 从零创作 |

Glue Coding 的核心是让 AI "抄"而非"写"：90% 来自已有物料，10% 才是业务差异点的胶水代码。spec-first 目前有完善的 SPEC 层，但缺乏让 Agent 有东西可抄的物料体系。

### 四层物料：spec-first 缺最有执行力的那层

| 物料层 | 作用 | spec-first 现状 |
|--------|------|----------------|
| 任务规格（做什么）| 意图侧 | ✅ brainstorm → plan → docs/plans/ |
| 开发规范（规矩是什么）| 底线约束 | ✅ AGENTS.md / CLAUDE.md 注入 |
| 领域知识（有什么约束）| 经验侧 | ✅ spec-bootstrap → pitfalls / architecture |
| **代码模式（有什么可以抄）** | **执行侧骨架** | **❌ 完全缺失** |

> 胶水编程数据：给 AI 看一份 500 行的标准实现，比写 50 条规则有效得多。代码模式缺位的证据：plan 文档里出现大量内联样板代码（本该只写差异点）。

### spec-bootstrap 是生态孤岛

所有下游 skill（brainstorm / plan / work / review / compound / ideate）均不读取 `docs/contexts/<slug>/`，bootstrap 生成的上下文资产无法被任何下游 skill 消费。AGENTS.md 是唯一的全局入口——六个 skill 都读它——但 spec-bootstrap 目前不写 AGENTS.md。

### 知识库双轨不联动

```
spec-bootstrap  → docs/contexts/<slug>/pitfalls/    已知风险（一次性快照）
spec-compound   → docs/solutions/                   已解决问题（持续累积）
```

两者互不感知：review 看不到 pitfalls，compound 的根因不回写 pitfalls，pitfalls 库不随项目演化。

---

## 二、设计哲学

### 核心原则

**1. 仓库是 Agent 的操作系统（Harness）**
所有约束必须编码进仓库。不在仓库里，Agent 就看不见。AGENTS.md 是入口，~100 行，只做地图不做手册，细节按需加载。

**2. AI 应该抄而不是写（Glue）**
AI 的核心优势是在有参照物时精准拟合。物料体系的目标不是"让 AI 更聪明"，而是"给 AI 更好的东西可以抄"。原创比例越低，说明物料体系越完善。

**3. 静态注入 vs 动态检索（Glue × Harness）**
不可违反的规则必须静态注入（始终在场），参考资料按需检索。
Vercel 数据：同样内容，动态检索 53% 通过率，静态注入 100% 通过率。关键规则不能依赖 AI 主动调用。

**4. 协调者不写代码（Harness）**
上下文窗口是最贵的资源。orchestrator 只规划/委派/汇总，子 agent 从干净上下文开始执行。

**5. 知识资产复利（Glue）**
代码可以推翻，模型会换代，但团队的代码模式、领域知识、开发规范只会越积越厚。投资应在知识资产上，而非脚手架。

### 物料注入策略

```
静态注入（AGENTS.md 正文）：
  - 分层规则：Layer 0→N 的依赖方向约束
  - 禁止模式：不可逾越的底线（禁用依赖、请求规范）
  - 关键约束：3-5 条最关键的可执行规则

动态检索（AGENTS.md 只写链接）：
  - 架构文档：docs/contexts/<slug>/architecture/
  - 领域知识：docs/contexts/<slug>/pitfalls/
  - 代码模式：docs/contexts/<slug>/patterns/
  - 决策历史：docs/contexts/<slug>/tracks/（新增）
```

---

## 三、目标架构：完整物料体系下的工作流

```
一次性准备（每个项目跑一次，重大架构变更后刷新）
─────────────────────────────────────────────────
spec-bootstrap
  Phase 1: 分析仓库（工具探针 + layer detection + DB detection + 代码模式识别）
  Phase 2: 生成 PRD → 并行 worker
    固定任务: summary / architecture / pitfalls / agents-md（新）
    条件任务: layer-context / guides / database / patterns（新）
  Phase 3: 装配 + verify + 失败记忆
  产物写入:
    docs/contexts/<slug>/         ← 知识文档
    AGENTS.md（目标项目根目录）   ← 静态注入规则 + 动态检索链接

─────────────────────────────────────────────────
每次需求交付（五阶段工作流）
─────────────────────────────────────────────────

spec-brainstorm（有 bootstrap context 时更有依据）
  → 读 AGENTS.md → 发现 spec-first Context section → 按需加载 architecture
  → 约束更准：brainstorm 不会提出超出架构边界的方案
  → 产物：docs/brainstorms/<date>-<topic>-requirements.md

spec-plan（跳过重复分析）
  → Phase 1.1 Step 0: 检查 docs/contexts/<slug>/README.md
  → 存在 → 直接加载 summary + module-map + pitfalls 作为 planning context
           轻量增量分析（只扫 feature 相关模块），不重跑全量 repo-research-analyst
  → 不存在 → 走现有完整流程
  → Implementation Unit 新增 `参考样板` 字段：指向最接近的现有实现
  → 产物：docs/plans/<date>-<topic>-plan.md

spec-work（先找参照，再写胶水）
  → Phase 1 Quick Start 新增 Reference Anchoring：
    1. 读 plan 中的 `参考样板` 字段
    2. 回退：查 docs/contexts/<slug>/patterns/index.md
    3. 再回退：Glob 扫描仓库找最相似现有实现
  → 执行：骨架来自参照，只在差异点写胶水代码
  → 完成后写入 Track：plan 路径 + 关键设计决策

spec-review（命中 pitfalls 专项检查）
  → Stage 3: 检查 docs/contexts/<slug>/pitfalls/index.md 是否存在
  → 存在 → 触发 pitfalls-specialist reviewer：变更是否命中已知风险
  → 产物：review report + pitfalls 命中条目

spec-compound（根因回写 pitfalls 建议）
  → Phase 2 完成后：判断根因类型
  → 架构级根因 → 提示更新 pitfalls / 补充新条目
  → Track 中记录此次修复对历史设计决策的影响
```

---

## 四、各 Skill 具体改动方案

### 4.1 spec-bootstrap（改动最多，影响最大）

#### 4.1.1 新增固定任务：`agents-md-context`

**改动位置：** Phase 2.1 Fixed Tasks

**Worker 产物：** 目标项目根目录 `AGENTS.md`

**Worker 行为：**

```
已有 AGENTS.md → 追加 ## spec-first Context section（已存在则替换）
无 AGENTS.md   → 创建最小可用 AGENTS.md，包含 spec-first Context section
```

**section 内容规范（严格遵守静态/动态注入分层）：**

```markdown
## spec-first Context

> 由 spec-bootstrap 生成于 <ISO-date>，基于生成时的仓库状态。

### 分层规则（静态约束）
<!-- 来自 Phase 1.4 layer detection 实际检测结论 -->
- Layer 0: <path>  — 纯类型/常量，无内部依赖
- Layer N: <path>  — <职责>，仅依赖 Layer 0~N-1
<!-- 如无明确分层证据，省略此节 -->

### 关键约束（静态约束）
<!-- 来自 pitfalls 分析提炼的最关键 3~5 条可执行规则 -->
- 禁止 <具体模式>（详见 pitfalls/index.md#<section>）
- 新增 <类型文件> 必须放在 <path>

### 上下文资产（动态链接）
- [项目总览](docs/contexts/<slug>/00-summary.md)
- [模块地图](docs/contexts/<slug>/architecture/module-map.md)
- [架构决策](docs/contexts/<slug>/architecture/system-overview.md)
- [已知风险](docs/contexts/<slug>/pitfalls/index.md)
- [代码模式](docs/contexts/<slug>/patterns/index.md)  <!-- 如存在 -->
```

**长度约束：** 此 section 不超过 50 行，AGENTS.md 整体保持 ~100 行地图定位。内容必须来自 Phase 1 实际分析结论，禁止模板占位符。

---

#### 4.1.2 新增条件任务：`patterns-context`

**改动位置：** Phase 2.2 Conditional Tasks

**触发条件：** 仓库中存在重复出现的实现结构（同类型文件 ≥ 3 个，如多个 list/detail/form 页面，或多个 handler/service/repository 组合）

**Worker 产物：** `docs/contexts/<slug>/patterns/index.md`

**内容规范（重要：不复制代码，只做索引）：**

```markdown
# 代码模式索引

> 本文档索引仓库中可复用的代码骨架。在开始新功能开发前，
> 先查找是否有可参照的现有实现。

## 列表页模式
最佳参照：`src/modules/order/list/`
文件结构：index.tsx（入口）/ Form.tsx（筛选）/ Table.tsx（表格）/ services.ts（接口）
适用场景：标准 CRUD 列表，含筛选、分页、操作列

## API Handler 模式
最佳参照：`src/api/handlers/user.go`
文件结构：handler.go / service.go / repository.go / dto.go
注意：所有 handler 必须经过 middleware/auth.go 的鉴权中间件

## [其他检测到的模式...]
```

**Worker 约束：**
- 每个模式只指向一个最佳参照，不列举所有类似文件
- 说明"为什么这个是最佳参照"（测试覆盖最好、最新、最规范）
- 注明该模式的核心组合方式（文件结构 + 关键 hook/pattern）

---

#### 4.1.3 Phase 1.4 扩展：Layer Detection → lint hint 输出

**改动位置：** Phase 1.4 Layer Detection 产出结构

Phase 1.4 完成后，在内部控制面额外输出 `layer_lint_hints`，写入两处：
1. `agents-md-context` PRD 的 Context（生成 AGENTS.md 分层规则节）
2. `pitfalls-context` PRD 的 Technical Notes（补充材料）

**格式：**

```text
## Layer Lint Hints（Phase 1.4 自动检测）
依赖方向：types/ → utils/ → services/ → api/（单向，不可反向）
可机械检测的违规（bash/grep 骨架）：
grep -r "from.*api.*import" services/ && echo "VIOLATION: services→api"
```

---

#### 4.1.4 Phase 2.4.2 pitfalls AC 追加 lint hint 要求

**改动位置：** Phase 2.4.2 Task-specific Acceptance Criteria，pitfalls-context 追加项

在现有 AC 末尾新增：

```
- [ ] 对于可机械化检测的 pitfall（循环依赖、函数体 > 100 行、
      God class > 500 行、裸 try-catch、无鉴权路由），
      在文档末尾附 ## Lint Hints section，
      包含 bash/grep/ast 检测骨架（方向正确即可，供用户演化为真实脚本）
```

---

#### 4.1.5 Phase 3.4 新增：Assembly 后 verify step

**改动位置：** Phase 3.4 Assembly 末尾，Execution Summary 前

轻量产物核验（4 项，全部非阻断）：

| 验证项 | 验证方式 | 失败处理 |
|--------|----------|----------|
| `module-map.md` 列出的顶层目录实际存在于项目 | Glob 核验 | 记入 warnings |
| `pitfalls/index.md` 引用的文件路径真实存在 | Glob 核验 | 记入 warnings |
| `00-summary.md` 识别的主框架在配置文件中有对应证据 | Grep 核验 | 记入 warnings |
| `AGENTS.md` 中分层规则的路径在项目中存在 | Glob 核验 | 记入 warnings |

verify 警告记入 `⚠️ Verify Warnings` section，不触发 restore，提示用户人工复查。

---

#### 4.1.6 Phase 3.4 新增：失败记忆写入 trace

**改动位置：** Phase 3.4 Partial failure policy

partial failure 时额外写入：

```
.context/spec-first/bootstrap/<slug>/trace/failures/<ISO-timestamp>.json
{
  "timestamp": "<ISO>",
  "slug": "<slug>",
  "failed_tasks": [{
    "task_id": "pitfalls-context",
    "reason": "abcoder-parse-timeout",
    "analysis_mode": "Enhanced",
    "recommended_retry": "降级 Basic mode，手动补充分析证据"
  }],
  "analysis_mode": "Enhanced"
}
```

重跑时 Phase 1 结束后检查此记录，对失败任务的 PRD 注入 `## Previous Failure Notes`。

---

### 4.2 spec-plan（效率 + 质量双提升）

#### 4.2.1 Phase 1.1 新增 Step 0：Bootstrap Context Check

**改动位置：** Phase 1.1 Local Research 开头，在发起 `repo-research-analyst` 之前

```
Step 0: Bootstrap Context Check

1. 扫描 <project-root>/docs/contexts/*/README.md
2. 检查是否含 <!-- spec-bootstrap --> 标记

存在（且生成时间 ≤ 90 天）→ Bootstrap Context 可信：
  - 直接加载：00-summary.md + architecture/module-map.md + pitfalls/index.md
  - 以上文件内容作为 planning context summary 的一部分
  - repo-research-analyst 降级为轻量增量分析：
    只扫与本次 feature 直接相关的模块，不做全量架构分析
  - planning context summary 注明：
    "架构上下文来自 spec-bootstrap（<生成日期>），增量分析范围：<feature 相关模块>"

存在（生成时间 > 90 天）→ Bootstrap Context 可参考：
  - 加载为"历史背景"，仍发起完整 repo-research-analyst
  - 在 planning context 中标注：context 可能与当前代码存在偏差

不存在 → 走现有完整 Phase 1.1 流程（无变化）
```

---

#### 4.2.2 Implementation Unit 新增 `参考样板` 字段

**改动位置：** Phase 3.5 Define Each Implementation Unit 的字段列表

在现有字段（Goal / Requirements / Dependencies / Files / Approach / Patterns to follow / Test scenarios / Verification）中，在 `Patterns to follow` 前新增：

```
- **参考样板** — 可选。指向最接近本 unit 的现有实现：
  - 文件/目录路径（优先指向完整模块目录，而非单个文件）
  - 一句话说明"为什么参照它"和"差异点在哪里"
  - 若 docs/contexts/<slug>/patterns/index.md 存在，优先从中选取
  - 示例：
    参考样板: src/modules/order/list/
    差异点: 新增批量操作栏、状态标签改为 5 态、列表行支持展开子项
```

---

### 4.3 spec-work（从"写代码"到"先找参照再写胶水"）

#### 4.3.1 Phase 1 Quick Start 新增 Reference Anchoring

**改动位置：** Phase 1 Step 1 "Read Plan and Clarify" 之后，Step 2 "Setup Environment" 之前

```
1.5 Reference Anchoring（新增）

目标：在写任何代码之前，先确定每个 Implementation Unit 的骨架参照物。

对 plan 中的每个 Implementation Unit 依次执行：

Step A：检查 plan 中是否有 `参考样板` 字段
  → 有：加载对应文件/目录，记录为该 unit 的 reference anchor

Step B（若 Step A 未找到）：检查 docs/contexts/<slug>/patterns/index.md
  → 找到匹配的模式：加载对应参照文件，记录为 reference anchor

Step C（若 Step B 未找到）：Glob 扫描仓库
  → 找到结构最相似的现有实现（同类型文件、相似目录结构）
  → 记录为 reference anchor，并在执行时告知用户"参照自 <path>"

没有任何参照物：直接进入实现，这是正常的（全新模块）。

执行原则：
- 有参照物时：先理解参照的文件结构和关键 pattern，再开始写代码
- 执行时：骨架来自参照，只在业务差异点写新逻辑（胶水）
- 判断标准：这段代码是"改现有模式"还是"发明新模式"？前者占比越高越好
```

---

#### 4.3.2 完成后写入 Track（新机制）

**改动位置：** Phase 3 Quality Check 通过后，commit 前

```
Track 写入（新增）：

路径：docs/contexts/<slug>/tracks/<plan-filename>/
文件：
  spec.md   — 指向原始 plan 文档的软链接或摘要（不重复内容）
  notes.md  — 本次执行的关键设计决策

notes.md 格式（精简，只写非显而易见的决策）：
---
plan: docs/plans/2026-04-04-order-list-plan.md
executed: 2026-04-04
---
## 关键决策
- 选用 useProTableRequest 替代手写 useState：因为 patterns/index.md 里记录此为团队标准
- 文件拆为 4 个独立模块（而非 Plan 建议的 2 个）：实际依赖图要求更细粒度分离
- 跳过 X 功能：Phase 1 发现已在 src/utils/shared.ts 中存在，直接复用

## 与 Plan 的偏差
- Plan 建议用 ComponentA，实际用了 ComponentB（原因：ComponentA 已废弃，见 pitfalls#deprecated-components）
```

Track 的作用：下次 AI 改同一模块时，读取历史 notes.md 理解"为什么这样设计"，避免推翻合理决策。

---

### 4.4 spec-review（pitfalls 专项检查）

#### 4.4.1 Stage 3 新增 pitfalls-specialist reviewer

**改动位置：** Stage 3 Select reviewers，条件 reviewer 列表

```
Conditional: pitfalls-specialist（新增）

触发条件（AND）：
  - docs/contexts/<slug>/pitfalls/index.md 存在
  - diff 涉及 pitfalls 中标记为"高风险"的文件或模块

触发后任务：
  1. 加载 pitfalls/index.md
  2. 检查本次变更是否触发已知风险：
     - 是否修改了高扇入/扇出模块
     - 是否在事务边界敏感区域新增逻辑
     - 是否引入了 pitfalls 中记录的反模式
     - 是否命中 lint hints 中的检测模式
  3. 输出结构化结果：
     - 命中的 pitfall 条目（标题 + 文件位置 + 本次变更触发点）
     - 风险等级：high / medium / info
     - 建议：如何规避或接受该风险

不触发：不加载 pitfalls，不影响 review 性能
```

---

### 4.5 spec-compound（根因回写 pitfalls）

#### 4.5.1 Phase 2 Assembly 后新增 Pitfall Update Check

**改动位置：** Phase 2 Assembly 末尾，Phase 3 Optional Enhancement 前

```
Pitfall Update Check（新增，非阻断）：

1. 检查 docs/contexts/<slug>/pitfalls/index.md 是否存在

2. 分析本次 compound 记录的根因类型：
   架构级风险（循环依赖、God class、模块边界违反、并发竞态、事务边界）
   → 建议更新 pitfalls
   代码局部 bug、配置错误、环境问题
   → 不提示

3. 若满足条件，在 Phase 3 Next Steps 追加：
   💡 本次修复揭示了架构级风险，建议同步更新：
      docs/contexts/<slug>/pitfalls/index.md
   建议新增条目：
   ### [根因摘要]
   位置：<file>:<line-range>
   风险类型：<type>
   为什么危险：<reason>
   规避建议：<mitigation>
   [来自 spec-compound <ISO-date>]

4. 同时检查 Track：本次修复是否与某个历史 plan 的决策有关？
   → 如有关联，提示更新对应的 track/notes.md
```

---

### 4.6 spec-brainstorm（有 context 时更有依据）

#### 4.6.1 Phase 1.1 Existing Context Scan 感知 bootstrap 资产

**改动位置：** Phase 1.1 Standard and Deep 模式的 Constraint Check

在读取 AGENTS.md 后，追加：

```
Bootstrap Context Check（新增，Standard/Deep 模式）：
- AGENTS.md 中是否有 ## spec-first Context section？
  → 有：上下文资产已就绪，brainstorm 可直接引用架构约束
  → 无：无需额外操作

如有 ## spec-first Context：
- 读取"关键约束"节（静态规则，直接用于 Constraint Check）
- 如 brainstorm 方向涉及架构层面（新模块、跨层调用、引入新依赖），
  按需加载 architecture/system-overview.md 了解已有分层决策
- brainstorm 提出的方案不应违反 AGENTS.md 中的分层规则
```

---

### 4.7 spec-ideate（grounded 建议）

#### 4.7.1 Quick Context Scan 感知 bootstrap 资产

**改动位置：** Phase 1 Quick context scan 子 agent prompt

在读取 AGENTS.md 后，追加探针：

```
额外检查：
- docs/contexts/*/README.md 是否存在且含 <!-- spec-bootstrap --> 标记？
- 若存在：加载 00-summary.md 和 pitfalls/index.md 作为 ideation 背景
  目的：让改进建议避开已知陷阱，聚焦在真正有价值的方向上
- 存在 patterns/index.md：加载后了解当前物料体系完善度，
  优先建议补充缺失的代码模式（采纳率提升空间最大的方向）
```

---

## 五、物料飞轮：自我进化闭环

### 飞轮机制

```
每次需求交付：
  spec-work 发现无参照物  → 交付完成后，好的实现提炼为 patterns-context 更新
  spec-review 命中 pitfall  → spec-compound 记录 → pitfalls/index.md 补充新条目
  spec-work 发现规范缺失  → 补充到 AGENTS.md 关键约束节
  spec-bootstrap 失败记忆 → 下次重跑时 PRD 自动优化

飞轮效果：
  物料越丰富 → Agent 原创比例越低 → 产出质量越稳定
  pitfalls 越详细 → review 命中率越高 → 真实风险越少被合入
  Track 越完整 → 历史决策越可追溯 → AI 越不会推翻合理设计
```

### 物料质量度量（借鉴胶水编程四象限分析）

```
patterns-context 质量指标：
  - 被 spec-plan 引用率（`参考样板` 字段使用频率）
  - plan 中内联样板代码行数（越少说明 patterns 越完善）

pitfalls 质量指标：
  - spec-review 命中率（被 pitfalls-specialist 触发的频率）
  - 命中后实际修改率（命中但不修改 → 该条目可能需要重新评估）

AGENTS.md 质量指标：
  - spec-work Reference Anchoring 找到参照的比例
  - spec-plan Bootstrap Context Check 命中率
```

---

## 六、实施路径

### 第一轮：接通生态（仅改 spec-bootstrap，撬动全部下游）

改动范围：`skills/spec-bootstrap/SKILL.md`

```
1. Phase 2.1：新增 agents-md-context 固定任务（含静态/动态注入规范）
2. Phase 2.2：新增 patterns-context 条件任务（触发条件 + 内容规范）
3. Phase 1.4：扩展 layer_lint_hints 输出结构
4. Phase 2.4.2：pitfalls AC 追加 lint hint 要求
```

完成后：spec-bootstrap 生成的资产通过 AGENTS.md 被所有下游 skill 自动发现；patterns 骨架就位，为第二轮提供基础。

### 第二轮：改变执行范式（改 spec-plan + spec-work，核心质量提升）

```
5. spec-plan Phase 1.1：加入 Bootstrap Context Check（Step 0）
6. spec-plan Phase 3.5：Implementation Unit 新增 `参考样板` 字段
7. spec-work Phase 1：加入 Reference Anchoring（1.5 步骤）
8. spec-work Phase 3 后：加入 Track 写入机制
```

完成后：spec-work 从"写代码"变为"先找参照再写胶水"，plan 与 work 之间有明确的物料传递链路。

### 第三轮：知识复利（改 spec-review + spec-compound，让知识库活化）

```
9.  spec-review Stage 3：加入 pitfalls-specialist 条件 reviewer
10. spec-compound Phase 2：加入 Pitfall Update Check
11. spec-brainstorm Phase 1.1：感知 bootstrap 资产
12. spec-ideate Phase 1：context scan 感知 bootstrap 资产
```

完成后：pitfalls 库从初始快照变为随实战持续更新的活文档；brainstorm 和 ideate 的建议与真实架构约束对齐。

### 第四轮：自动化与稳定性（bootstrap 内部改进）

```
13. spec-bootstrap Phase 3.4：加入 verify step
14. spec-bootstrap Phase 3.4：失败记忆写入 trace
```

---

## 七、不做的事（边界说明）

| 项目 | 原因 |
|------|------|
| 生成真实可运行的 lint 脚本 | 不同语言/框架差异极大，强行生成易产生错误脚本；lint hint 骨架是安全边界 |
| 自动更新 pitfalls（无人工确认）| pitfalls 是知识库，自动写入有污染风险；compound 只提示不自动写入 |
| spec-bootstrap 驱动下游 skill | bootstrap 只生成资产，不驱动下游行为；下游 skill 主动消费 |
| Track 自动与 git commit 绑定 | 强绑定带来维护负担；手动触发、AI 辅助是成本最低的务实选择 |
| Phase 1 委派 analysis-worker | 架构改动大；列为下一版规划，当前版本不实施 |
| 双向 spec-代码自动同步 | 在完全自动化被证明可行前，手动触发规格同步是成本最低的选择 |

---

## 八、预期收益

| 维度 | 当前 | 目标 |
|------|------|------|
| bootstrap 产物可达性 | 下游 0 个 skill 消费 | 6 个 skill 通过 AGENTS.md 自动发现 |
| spec-plan Phase 1 成本 | 每次全量 repo 分析 | 有 bootstrap context 时降低 40-60% |
| spec-work 原创代码比例 | 无度量 | 建立度量基线，逐步降低 |
| pitfalls 活跃度 | 一次性快照 | 随 compound 实战持续更新 |
| 跨 session 决策延续性 | 无（每次 cold start）| Track 机制保留关键设计决策 |
| review 架构违规发现率 | 依赖 reviewer 经验 | pitfalls-specialist 系统性检查 |
