# spec-first 生态集成优化方案

> 分析基准：spec-first v1.5.x（截至 2026-04-03）
> 参考：Harness Engineering 指南 × spec-bootstrap Harness 优化建议
> 范围：spec-bootstrap / spec-brainstorm / spec-plan / spec-work / spec-review / spec-compound / spec-ideate

---

## 一、问题诊断

### 1.1 spec-bootstrap 是生态孤岛

spec-bootstrap 生成了 `docs/contexts/<slug>/` 下的全套上下文资产，但下游五阶段工作流没有任何消费路径：

| Skill | 启动时读什么 | 是否读 `docs/contexts/` |
|-------|-------------|------------------------|
| spec-brainstorm | `AGENTS.md` / `CLAUDE.md` | ✗ |
| spec-plan | `AGENTS.md` + `repo-research-analyst` | ✗ |
| spec-work | `AGENTS.md` | ✗ |
| spec-review | `AGENTS.md` / `CLAUDE.md` | ✗ |
| spec-compound | `MEMORY.md` | ✗ |
| spec-ideate | `AGENTS.md` + 目录扫描 | ✗ |

SKILL.md 里标注的"Automatic injection into the five-stage workflow is a future capability"，这个断层正是本方案要修复的。

### 1.2 知识库双轨不联动

当前存在两套平行的知识库：

```
spec-bootstrap  →  docs/contexts/<slug>/pitfalls/    （已知架构风险，一次性快照）
spec-compound   →  docs/solutions/                   （已解决的问题，持续累积）
```

两者互不感知：review 时看不到 pitfalls，compound 记录的根因不回写 pitfalls，导致 pitfalls 库只是初始快照，不会随项目演化。

### 1.3 spec-plan 重复分析浪费

spec-plan Phase 1.1 每次启动都并行发起 `repo-research-analyst`（仓库架构分析）。如果项目已跑过 spec-bootstrap，等于把同样的分析做了两遍，浪费 token 且结论可能有偏差。

---

## 二、核心修复：AGENTS.md 作为全局注入点

### 2.1 设计原理

所有 6 个下游 skill 都读 `AGENTS.md`。Harness Engineering 的关键洞见：**AGENTS.md 是 Agent 的项目操作系统入口**，Agent 打开项目自动读取。

因此，spec-bootstrap 写入 AGENTS.md = 同时接通全部下游 skill，无需修改任何下游 skill 的逻辑。

### 2.2 级联价值链

```
spec-bootstrap 生成 docs/contexts/<slug>/
        ↓
spec-bootstrap 写入/更新 AGENTS.md
        ↓ （AGENTS.md 是所有 skill 的入口）
brainstorm    plan       work      review     ideate     compound
约束更准确  跳过重分析  遵循层级  命中pitfall  建议有依据  根因回写
```

---

## 三、各节点详细改动方案

### 3.1 spec-bootstrap：新增 `agents-md-context` 固定任务

**改动位置：** `skills/spec-bootstrap/SKILL.md` → Phase 2.1 Fixed Tasks

**现状：** 固定任务只有三个（summary / architecture / pitfalls），生成的上下文资产对下游不可达。

**方案：** 新增第四个固定任务 `agents-md-context`，作为连接 spec-bootstrap 与下游 skill 生态的桥梁。

#### 产物规范

产物路径：目标项目根目录 `AGENTS.md`（注意：是目标项目，不是 spec-first 仓库本身）

写入内容（追加 section，不覆盖现有内容）：

```markdown
## spec-first Context

> 由 spec-bootstrap 生成于 <ISO-date>。上下文基于生成时的仓库状态，不自动同步代码变更。

### 架构上下文
- [项目总览](docs/contexts/<slug>/00-summary.md) — 技术栈、核心职责
- [系统架构](docs/contexts/<slug>/architecture/system-overview.md) — 分层策略、关键决策
- [模块地图](docs/contexts/<slug>/architecture/module-map.md) — 顶层目录职责映射
- [已知风险](docs/contexts/<slug>/pitfalls/index.md) — 代码/架构/业务风险点

### 分层规则
<来自 Phase 1.4 layer detection 的实际检测结论，每层一行>
Layer 0: <path> — 纯类型/常量，无内部依赖
Layer N: <path> — <职责>，仅依赖 Layer 0~N-1
...

### 关键约束
<来自 pitfalls 分析提炼的最关键 3~5 条可执行规则，每条一行>
- 禁止 <具体模式>（见 pitfalls/index.md#<section>）
- 新增 <类型文件> 必须放在 <path>
- ...
```

#### Worker 边界规则

| 情况 | 处理方式 |
|------|----------|
| 目标项目已有 `AGENTS.md` | 追加 `## spec-first Context` section；如该 section 已存在则替换 |
| 目标项目无 `AGENTS.md` | 创建最小可用的 `AGENTS.md`，包含 spec-first Context section |
| 内容来源 | 必须来自 Phase 1 分析结论，禁止模板占位符 |
| 文件长度约束 | 此 section 不超过 50 行，保持 AGENTS.md 整体 ~100 行的地图定位 |

#### PRD 特殊规范（Technical Notes）

- 简短原则：每个子 section 不超过 10 行
- 地图原则：只写路径和规则，不写解释性散文
- 证据原则：分层规则来自 Phase 1.4 实际检测结果，不推断

#### 所有权归属

`agents-md-context` worker 独占写 `AGENTS.md`。Orchestrator 不写此文件。

---

### 3.2 spec-bootstrap：Phase 1.4 Layer Detection → lint hint 骨架

**改动位置：** `skills/spec-bootstrap/SKILL.md` → Phase 1.4 Layer Detection 输出 + Phase 2.4.3 Technical Notes

**现状：** Layer detection 结论只用于"决定创建哪些条件任务"，检测到的依赖方向没有后续利用。

**方案：** Phase 1.4 完成后，编排器额外输出 `layer_lint_hints` 结构，写入两处：

1. `agents-md-context` PRD 的 Context（生成 AGENTS.md 分层规则节）
2. `pitfalls-context` PRD 的 Technical Notes（作为补充发现材料）

`layer_lint_hints` 格式示例：

```text
## Layer Lint Hints（来自 Phase 1.4 自动检测）

依赖方向约束：
- types/, shared/types/  → Layer 0：无内部依赖
- utils/, lib/           → Layer 1：仅依赖 Layer 0
- services/, core/       → Layer 3：仅依赖 Layer 0-2
- api/, cli/, ui/        → Layer 4：仅依赖 Layer 0-3，彼此不互相引用

可机械检测的违规模式（bash/grep 骨架）：
grep -r "from.*api.*import\|require.*api" services/ && echo "VIOLATION: services→api"
grep -r "from.*ui.*import\|require.*ui" services/ && echo "VIOLATION: services→ui"
```

---

### 3.3 spec-bootstrap：Phase 2.4.2 pitfalls AC 追加 lint hint 要求

**改动位置：** `skills/spec-bootstrap/SKILL.md` → Phase 2.4.2 Task-specific Acceptance Criteria

**现状：** pitfalls AC 要求每个 pitfall 含 `file + line range + risk type + mitigation`，已具体，但停留在软知识层面。

**方案：** 在现有 pitfalls AC 末尾追加：

```
- [ ] 对于可机械化检测的 pitfall（循环依赖、函数体 > 100 行、
      God class > 500 行、裸 try-catch），在文档末尾附
      ## Lint Hints section，包含 bash/grep 检测骨架
      （方向正确即可，不要求生产可用）
```

---

### 3.4 spec-bootstrap：Phase 3.4 加入 verify step

**改动位置：** `skills/spec-bootstrap/SKILL.md` → Phase 3.4 Assembly 末尾

**现状：** 完成标准只有"契约一致性"（文件已生成且非空、无占位符）。

**方案：** Assembly 后、Execution Summary 前，orchestrator 执行轻量产物核验：

| 验证项 | 验证方式 | 失败处理 |
|--------|----------|----------|
| `module-map.md` 列出的顶层目录实际存在 | Glob 核验 | 非阻断，记入 warnings |
| `pitfalls/index.md` 引用的文件路径真实存在 | Glob 核验 | 非阻断，记入 warnings |
| `00-summary.md` 识别的主框架能在 `package.json`/`go.mod`/`requirements.txt` 找到对应证据 | Grep 核验 | 非阻断，记入 warnings |
| `AGENTS.md` 中的分层规则路径在项目中存在 | Glob 核验 | 非阻断，记入 warnings |

verify 失败不触发 full restore，记入 Execution Summary 的 `⚠️ Verify Warnings` section，提示用户人工复查。

---

### 3.5 spec-bootstrap：Phase 3.4 失败记忆写入

**改动位置：** `skills/spec-bootstrap/SKILL.md` → Phase 3.4 Partial failure policy

**现状：** Worker 失败只触发 restore/preserve，原因仅出现在执行摘要文本中，下次重跑无法参考。

**方案：** partial failure 时额外写入：

```
.context/spec-first/bootstrap/<slug>/trace/failures/<ISO-timestamp>.json
```

结构：

```json
{
  "timestamp": "<ISO-timestamp>",
  "slug": "<slug>",
  "failed_tasks": [
    {
      "task_id": "pitfalls-context",
      "reason": "abcoder-parse-timeout",
      "analysis_mode": "Enhanced",
      "recommended_retry": "retry with Basic mode; add manual evidence to PRD context"
    }
  ],
  "analysis_mode": "Enhanced",
  "db_access_mode": "not detected"
}
```

重跑时，orchestrator 在 Phase 1 结束后检查 `trace/failures/` 最近一条记录，对失败任务的 PRD 注入 `## Previous Failure Notes` section。

---

### 3.6 spec-plan：Phase 1.1 加入 bootstrap context cache check

**改动位置：** `skills/spec-plan/SKILL.md` → Phase 1.1 Local Research 开头

**现状：** spec-plan Phase 1.1 每次无条件并行发起 `repo-research-analyst` + `learnings-researcher`，即使 spec-bootstrap 已为该项目生成了完整架构上下文。

**方案：** 在发起 `repo-research-analyst` 前，先执行 bootstrap context check：

```
Step 0（新增）: Bootstrap Context Check

1. 扫描 <project-root>/docs/contexts/*/README.md
2. 检查是否包含 <!-- spec-bootstrap --> 标记
3a. 找到 → bootstrap context 已存在：
    - 直接加载以下文件作为 planning context 的一部分：
      - docs/contexts/<slug>/00-summary.md
      - docs/contexts/<slug>/architecture/system-overview.md
      - docs/contexts/<slug>/architecture/module-map.md
      - docs/contexts/<slug>/pitfalls/index.md（如存在）
    - 将 repo-research-analyst 替换为 轻量增量分析（只扫描 feature 相关的具体模块）
    - 在 planning context summary 中注明：
      "架构上下文来自 spec-bootstrap（<生成日期>），增量分析范围：<feature相关模块>"
3b. 未找到 → 走现有完整 Phase 1.1 流程（无变化）
```

**关键约束：**

- bootstrap context 超过 90 天的，视为可能过时，降级为"参考"而非"替代"，仍发起完整 repo-research-analyst，但把 bootstrap context 作为额外输入传入
- 只加载 planning context 需要的文件，不全量加载 docs/contexts/，遵守上下文窗口经济原则

**收益：** 已有 spec-bootstrap context 的项目，spec-plan Phase 1 的 token 消耗可降低 40-60%，且架构认知来自同一份权威文档，不存在偏差。

---

### 3.7 spec-review：Stage 3 加入 pitfalls 专项检查

**改动位置：** `skills/spec-review/SKILL.md` → Stage 3 Select reviewers

**现状：** spec-review 通过 `learnings-researcher` 检索 `docs/solutions/`（已解决的问题），但不检查 `docs/contexts/<slug>/pitfalls/`（已知风险）。

**方案：** 在 Stage 3 reviewer 选择逻辑中加入条件检查：

```
Conditional: pitfalls-context reviewer（新增）

触发条件：
- docs/contexts/*/pitfalls/index.md 存在（说明 spec-bootstrap 已跑过）
- AND diff 涉及 pitfalls 中列出的高风险文件或模块

触发后行为：
1. 加载 docs/contexts/<slug>/pitfalls/index.md
2. 对照 pitfalls 清单，检查本次变更是否触发了已知风险：
   - 是否修改了高扇入/高扇出模块
   - 是否在事务边界敏感区域新增了逻辑
   - 是否引入了 pitfalls 中记录的反模式
3. 输出：命中的 pitfall 条目 + 变更位置 + 风险等级评估

不触发时：跳过（不强制所有 review 都加载 pitfalls）
```

---

### 3.8 spec-compound：完成后提示 pitfalls 更新

**改动位置：** `skills/spec-compound/SKILL.md` → Phase 2 Assembly 末尾 / Phase 3 Optional Enhancement

**现状：** spec-compound 记录解决方案到 `docs/solutions/`，但不检查解决的根因是否应该更新 `docs/contexts/<slug>/pitfalls/`。

**方案：** Phase 2 写入 solution 文档后，orchestrator 执行一次轻量判断：

```
Pitfall Update Check（新增，非阻断）：

1. 检查 docs/contexts/*/pitfalls/index.md 是否存在
2. 分析本次 compound 记录的根因类型：
   - 架构层风险（循环依赖、God class、模块边界违反）
   - 业务逻辑风险（权限绕过、并发竞态、事务边界）
   以上两类 → 建议更新 pitfalls
   - 代码局部 bug、配置错误、环境问题
   以上类型 → 不提示更新 pitfalls

3. 若满足条件，在 Phase 3 Next Steps 中追加：
   "💡 本次修复揭示了架构级风险，建议同步更新 pitfalls：
   docs/contexts/<slug>/pitfalls/index.md
   相关条目建议：<具体内容片段>"
```

**目标：** 让 `pitfalls/index.md` 从初始快照演化为随项目实战持续更新的活文档，实现 Harness "失败 → 分析 → 更新规则"的自我进化闭环。

---

### 3.9 spec-ideate：context scan 感知 bootstrap 资产

**改动位置：** `skills/spec-ideate/SKILL.md` → Phase 1 Quick context scan 子 agent prompt

**现状：** ideate 的 quick context scan 读 AGENTS.md + 目录结构，但不感知 `docs/contexts/`。

**方案：** 修改 context scan 的 prompt，追加一条探针：

```
在读取 AGENTS.md 后，额外检查：
- docs/contexts/*/README.md 是否存在且含 <!-- spec-bootstrap --> 标记
- 若存在，加载 docs/contexts/<slug>/00-summary.md 和 pitfalls/index.md
  作为 ideation 的架构背景

注意：加载 pitfalls 的目的不是列出已知问题，而是让改进建议避开已知陷阱、
聚焦在真正有价值的方向上。
```

**收益：** 如果 AGENTS.md 已由 spec-bootstrap 更新（包含 context 链接），ideate 会自然发现并加载。如果 AGENTS.md 还未更新，这条探针作为兜底。

---

## 四、改动影响范围汇总

| 改动点 | 文件 | 改动类型 | 影响 |
|--------|------|----------|------|
| 新增 `agents-md-context` 固定任务 | `spec-bootstrap/SKILL.md` | 新增 Phase 2 任务 + worker 规范 | 接通全部下游 skill |
| Layer detection → lint hint 输出 | `spec-bootstrap/SKILL.md` | Phase 1.4 输出格式扩展 | agents-md / pitfalls 质量提升 |
| pitfalls AC 追加 lint hint | `spec-bootstrap/SKILL.md` | 一行 AC 追加 | pitfalls 向硬规则迁移 |
| Assembly 后加 verify step | `spec-bootstrap/SKILL.md` | Phase 3.4 新增环节 | 产物真实性保障 |
| 失败记忆写入 trace | `spec-bootstrap/SKILL.md` | Phase 3.4 partial failure 扩展 | 重跑质量提升 |
| Bootstrap context cache check | `spec-plan/SKILL.md` | Phase 1.1 开头新增 Step 0 | plan 效率 + bootstrap ROI |
| pitfalls 专项检查 | `spec-review/SKILL.md` | Stage 3 条件 reviewer 新增 | review 深度 |
| pitfalls 更新提示 | `spec-compound/SKILL.md` | Phase 2 末尾非阻断检查 | pitfalls 库活化 |
| context scan 感知 bootstrap | `spec-ideate/SKILL.md` | Phase 1 scan prompt 追加 | ideation 有据可依 |

---

## 五、实施路径

### 第一轮：接通生态（最高优先级，改 spec-bootstrap）

改动集中在 spec-bootstrap 一个文件，但效果影响全部下游。

```
1. Phase 2.1：新增 agents-md-context 固定任务（含 worker 规范）
2. Phase 1.4：扩展 layer_lint_hints 输出结构
3. Phase 2.4.2：pitfalls AC 追加 lint hint 要求
```

完成后：spec-bootstrap 生成的资产能通过 AGENTS.md 被所有下游 skill 自动发现。

### 第二轮：提升下游消费质量

```
4. spec-plan Phase 1.1：加入 bootstrap context cache check
5. spec-review Stage 3：加入 pitfalls 专项检查
6. spec-ideate Phase 1：context scan 感知 bootstrap 资产
```

完成后：下游 skill 能主动利用 bootstrap 资产，而不仅是"被动发现"。

### 第三轮：自我进化闭环

```
7. spec-bootstrap Phase 3.4：加入 verify step
8. spec-bootstrap Phase 3.4：失败记忆写入 trace
9. spec-compound Phase 2：加入 pitfalls 更新提示
```

完成后：pitfalls 库从初始快照变成随实战演化的活文档，bootstrap 重跑质量随失败记录累积而提升。

---

## 六、预期收益

### 效率

- spec-plan 在有 bootstrap context 时，Phase 1 token 消耗降低 40-60%
- spec-brainstorm / spec-work / spec-review 无需额外改动，通过 AGENTS.md 自动获益

### 质量

- spec-plan 的架构认知来自同一份权威文档，消除重复分析的偏差
- spec-review 能命中 pitfalls 中记录的已知风险，不遗漏
- spec-ideate 的改进建议与真实架构约束对齐，减少无效提案

### 知识复利

- pitfalls 库从一次性快照变为随实战持续更新的活文档
- bootstrap 失败记忆积累后，重跑 PRD 质量逐渐提升
- 对应 Harness 的"Agent 执行 → 验证抓问题 → 分析模式 → 更新规则"自我进化闭环

---

## 七、边界说明（不做的事）

| 项目 | 原因 |
|------|------|
| 生成真实可运行的 lint 脚本 | 不同语言/框架差异极大，强行生成易产生错误脚本；lint hint 骨架是可落地的边界 |
| spec-bootstrap 自动触发 spec-plan 重分析 | spec-bootstrap 只负责生成上下文，不驱动下游 skill 行为 |
| pitfalls 自动更新（无人工确认） | pitfalls 是知识库，自动写入有污染风险；compound 只提示不自动写入 |
| Phase 1 委派 analysis-worker | 架构改动大，当前版本不实施；列为下一版规划方向 |
