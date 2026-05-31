---
name: s2-00-full-journey-outline
description: 第二季第 0 篇大纲：用一个真实需求走完 spec-first 完整链路，建立全局地图；包含三种研发模式（0-1/1-10/10-100）、三种仓库拓扑（单仓单项目/单仓多模块/多仓工作区）和 spec-prd 的位置
metadata:
  type: article-outline
  series: s2
  series_index: "s2-00"
---

# Spec-First：从一句话到上线，我用 spec-first 跑完了整个流程

**状态：** 大纲
**内容类型：** 总览篇
**目标读者：** 已认同 Harness 理念、想真正上手 spec-first 的开发者

## 核心论点

spec-first 的价值不在于多跑命令，而在于把 AI coding 的每个关键判断显式化。这篇文章建立两张地图：一张是**需求模式地图**（0-1 / 1-10 / 10-100），一张是**仓库拓扑地图**（单仓单项目 / 单仓多模块 / 多仓工作区）。两张地图决定了你该走哪条链路、用哪些工具。

## Evidence Ticket

- 本地证据：`skills/spec-prd/SKILL.md`
- 官网证据：`/Users/kuang/xiaobu/spec-first-official-website/website/docs/guide/development-modes.md`（三种开发模式权威定义）
- 官网证据：`/Users/kuang/xiaobu/spec-first-official-website/website/docs/guide/first-workflow.md`
- 官网证据：`/Users/kuang/xiaobu/spec-first-official-website/website/docs/guide/best-practices.md`
- 回流资产：完整工作流链路图 + 两张地图对照表

## 大纲

### 1. 开场：为什么需要两张地图

- 第一张：需求模式地图——你在做什么阶段的产品？
- 第二张：仓库拓扑地图——你的代码库是什么结构？
- 两张地图决定链路，不是所有人都走同一条路

---

### 2. 第一张地图：三种需求模式

spec-first 按产品阶段区分三种需求模式，核心差别在需求工具的选择：

| 模式 | 场景 | 需求工具 | 产出物 |
|---|---|---|---|
| **0-1** | 全新产品/功能，方向未定，需要探索 | `spec-ideate` → `spec-brainstorm` | requirements brief |
| **1-10** | 已有产品，增量功能，需求较清晰 | `spec-brainstorm` 或 `spec-prd` | requirements brief 或 PRD 需求文档 |
| **10-100** | 存量系统，增量需求，需要 PRD 级文档 | `spec-prd`（brownfield increment） | PRD 级需求文档（`artifact_kind: prd-requirements`） |

**关键区别：**
- `brainstorm`：把模糊意图收敛成可审查的 requirements brief，适合方向还不确定时
- `spec-prd`：在已有系统上描述变化的 delta，让 plan 不用猜 WHAT，适合存量系统增量需求

---

### 3. 第二张地图：三种仓库拓扑

spec-first 的项目边界按 Git 拓扑判断，不按 workflow 参数判断：

| 模式 | 形态 | `.spec-first` 权威边界 | 关键约束 |
|---|---|---|---|
| **单仓单项目** | 一个 Git repo = 一个应用/SDK/CLI/服务 | 当前 repo root | 最稳定的基础模式，所有 workflow 以当前 repo 为边界 |
| **单仓多模块** | 一个 Git repo 含多个 app/package/service | 同一个 repo root | 不为每个 module 拆多套 `.spec-first`；由 plan/task pack/work/review 按 module 边界拆分 |
| **多仓工作区** | 父目录下有多个独立 child Git repos | 每个 child repo 自己的 root | 父 workspace 只做候选发现和 advisory summary；写文件/测试/commit 前必须有明确 `target_repo` |

**多仓工作区的关键规则：**
- 父目录的 `.spec-first/workspace/*summary.json` 是 advisory facts，不是任何 child repo 的 canonical truth
- 操作单个 child：`/spec:mcp-setup --repo project-a`
- 批量操作：`/spec:graph-bootstrap --all-repos`
- 普通 plan/work/review 不能默认跨所有 child repos 写入

---

### 4. 完整链路走查（以单仓单项目 + 1-10 模式为例）

用一个真实小需求（改进 CLI 首次使用体验）走完完整链路：

#### 第零步：环境就绪（三件事有顺序依赖）

```
spec-first init
  → spec-mcp-setup（依赖 init 产出的 runtime）
  → spec-graph-bootstrap（依赖 mcp-setup 产出的 provider 配置）
```

多仓工作区时：先在父 workspace 跑 `--all-repos`，再进入具体 child repo 工作。

#### 第一步：需求收敛（按模式选工具）

- **0-1 模式**：`ideate` → `brainstorm` → requirements brief
- **1-10 模式**：`brainstorm` 或 `spec-prd` → requirements brief 或 PRD 需求文档
- **10-100 模式**：`spec-prd` → PRD 级需求文档（current-state evidence + change delta）

#### 第二步：计划形成（plan → plan doc）

- 输入：requirements brief 或 PRD 需求文档
- 输出：scope、验证方式、风险、handoff
- 多仓时：plan 必须标明 `target_repo` 或 per-unit `target_repo`

#### 第三步：计划 review（doc-review → findings）

- plan 写完立即 review，发现问题成本最低
- 单仓多模块时：review 按变更文件和影响面分组

#### 第四步：任务切片（write-tasks → task pack，可选）

- 复杂任务、跨模块、有依赖时使用
- task pack 必须带 `spec_id` / `source_plan_hash` / `target_repo`

#### 第五步：执行（work → code changes + verification）

- 五个控制点：scope 验证、task identity、vertical tracer bullet、review gate、handoff evidence
- 多仓时：写入前确认 `target_repo`，不能让 cwd 或 graph 结果自动选择 child repo

#### 第六步：代码审查（code-review → findings）

- review-pre-facts 准备证据
- actionable finding：evidence + severity + owner + verification

#### 第七步：经验沉淀（compound → docs/solutions/）

- 任务结束时触发，上下文最新鲜
- 沉淀的 learning 按 component/tags 可被后续 workflow 发现

---

### 5. 两张地图的组合：不同场景走不同链路

| 需求模式 × 仓库拓扑 | 链路特点 |
|---|---|
| 0-1 × 单仓单项目 | 最简单，ideate → brainstorm → plan → work → review → compound |
| 10-100 × 单仓多模块 | spec-prd 写清楚 delta，plan 按 module 拆 units，review 按影响面分组 |
| 1-10 × 多仓工作区 | 父 workspace 发现候选 repo，进入 child repo 后走标准链路，每步都要明确 target_repo |

---

### 6. 每个节点的输入/输出总结表

| 节点 | 输入 | 输出 | 适用模式 | 适用拓扑 |
|---|---|---|---|---|
| doctor/init | — | runtime assets | 全部 | 全部 |
| mcp-setup | runtime assets | provider 配置 | 全部 | 全部（多仓用 --repo 或 --all-repos） |
| graph-bootstrap | provider 配置 | readiness facts | 全部 | 全部（多仓用 --repo 或 --all-repos） |
| ideate | 模糊想法 | 方向候选 | 0-1 | 全部 |
| brainstorm | 方向/想法 | requirements brief | 0-1 / 1-10 | 全部 |
| spec-prd | 存量系统 + 变更请求 | PRD 级需求文档 | 1-10 / 10-100 | 全部（多仓需标明 target_repo） |
| plan | 需求文档 | plan doc | 全部 | 全部（多仓需标明 target_repo） |
| doc-review | plan doc | findings | 全部 | 全部 |
| write-tasks | plan doc | task pack | 复杂任务 | 全部（多仓 task 需带 target_repo） |
| work | plan / task pack | code + verification | 全部 | 全部（多仓写入前确认 target_repo） |
| code-review | diff | findings | 全部 | 全部 |
| compound | 已解决问题 | docs/solutions/ | 全部 | 全部 |

---

### 7. 什么时候可以跳过某些步骤

- **小任务**（单文件、typo、局部修复）：跳过 write-tasks，直接 work
- **方向已清晰**：跳过 ideate，直接 brainstorm 或 spec-prd
- **简单增量**：用 brainstorm 代替 spec-prd
- **低风险改动**：doc-review 可以轻量化
- **单仓单项目小需求**：brainstorm → plan → work → compound，四步完成

---

### 8. 本篇小结：先选地图，再走链路

spec-first 不是一条固定的流水线，而是一套可以按场景组合的工具链。

先判断需求模式（0-1 / 1-10 / 10-100），再判断仓库拓扑（单仓单项目 / 单仓多模块 / 多仓工作区），然后按对应链路推进。

每一步都留下下一步能读取的高质量上下文——这才是 spec-first 的核心价值。

## 可带走的判断

两个问题先于一切：我在做什么阶段的产品（需求模式）？我的代码库是什么结构（仓库拓扑）？答案决定了你该走哪条链路。
