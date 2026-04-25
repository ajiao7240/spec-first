---
title: "spec-graph-bootstrap 阶段 3B：Stage-0 上下文消费接入方案"
status: completed
created: 2026-04-13
ticket: FSREQ-GRAPH-3B
---

# spec-graph-bootstrap 阶段 3B：Stage-0 上下文消费接入方案

> 本文是 `spec-graph-bootstrap` 阶段 3B 的完整实施方案。
> 依赖文档：`docs/01-需求分析/spec-graph-bootstrap需求/阶段3-相关文档消费需求.md`

## 1. 目标

把 `spec-graph-bootstrap` 阶段 2 生成的 Stage-0 产物接入 `spec-plan`、`spec-work`、`spec-code-review` 三个 workflow，以**最小侵入、最稳降级**为核心约束。

- **不修改**任何现有 Phase 的逻辑
- **不新增**命令层入口
- **不依赖**产物存在作为主任务前置
- 只在三个 SKILL.md 最前面各插入一个独立的「Stage-0 上下文预载块」

---

## 2. 架构决策

### 2.1 插入位置

| Skill | 插入位置 | 说明 |
|-------|---------|------|
| `spec-plan` | `## Workflow` 标题之前 | Phase 0 开始前读取，供全流程参考 |
| `spec-work` | `## Execution Workflow` 之前、`### Phase 1` 正上方 | Input Document 声明后、执行开始前预载上下文 |
| `spec-code-review` | `# Code Review` 主标题之后、`## When to Use` 之前 | scope 确定前读取，供 reviewer 参考 |

### 2.2 Slug 解析策略

v1 唯一方式：`slug = basename(git rev-parse --show-toplevel)`

- 命令失败或输出为空 → 跳过整个预载步骤（Level 3）
- v1 不支持用户显式指定 slug（增加解析复杂度但无明确 v1 用例，留待 v2）
- **v1 使用前提**：skill 运行在目标仓库内部。跨仓库调用（如用 spec-plan 分析另一个仓库）时此假设不成立，slug 解析结果无意义 → 自动 Level 3 降级。

### 2.3 三级降级契约

```
Level 1 (部分降级): injection-index.yaml 存在，但某些文件缺失
  → 跳过缺失文件，继续加载其余文件，主工作流不受影响

Level 2 (固定集降级): injection-index.yaml 不存在或解析失败
  → 改为加载固定最小集合（见下方定义）

Level 3 (完全跳过): docs/contexts/<slug>/ 目录不存在
  → 跳过整个预载步骤，直接进入主工作流
```

**固定最小集合（Fallback Level 2）**：
- `docs/contexts/<slug>/00-summary.md`
- `docs/contexts/<slug>/pitfalls/index.md`
- `docs/contexts/<slug>/code-facts/public-entrypoints.md`
- `docs/contexts/<slug>/code-facts/test-map.md`

这 4 个文件是跨所有 stage 最普遍有用的最小公约：summary 提供项目全貌，pitfalls 提供历史坑点，entrypoints 提供代码入口，test-map 提供测试覆盖面。它们不等于任何 stage 的最优消费集合，只是 yaml 不可用时的保底兜底。

**已知降级损失**：`context-packs/review-change.md` 对 spec-code-review 很重要，但不在 Level 2 固定集中，因为它是 review 语义专属文件，不符合"跨 stage 普遍有用"的设计约束。当 yaml 不可用时，spec-code-review 会缺少变更风险上下文，这是已知的、可接受的 v1 降级损失。v2 可考虑引入 stage 差异化的 Level 2 降级集合。

### 2.4 消费与主任务的关系

```
Stage-0 预载 ──→ [可选增强上下文] ──→ 主工作流 Phase 0/1/Stage 1
     ↓ 任何失败
  降级通知（一行）──→ 主工作流照常运行
```

Stage-0 预载产物只作为**阅读参考**注入到 LLM 上下文，不影响任何判断分支。

### 2.5 预载执行流程（通用）

```
┌─────────────────────────────────────────────────────────────┐
│                   Stage-0 上下文预载                         │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
  ┌─────────────┐   解析失败
  │  解析 slug  │──────────────────────────────────┐
  │ (git root)  │                                  │
  └──────┬──────┘                                  │
         │ slug = "spec-first"                     │
         ▼                                         │
  ┌──────────────────────┐  不存在                  │
  │ docs/contexts/<slug>/│─────────────────────────┼──→ Level 3
  │   目录是否存在？      │                          │    跳过整步
  └──────────┬───────────┘                          │
             │ 存在                                  │
             ▼                                      │
  ┌──────────────────────┐  不存在/解析失败           │
  │ injection-index.yaml │──────────────┐           │
  │    是否可用？         │              │           │
  └──────────┬───────────┘              │           │
             │ 可用                     ▼           │
             │                  ┌──────────────┐   │
             │                  │   Level 2    │   │
             │                  │  固定最小集合 │   │
             │                  │ 00-summary   │   │
             │                  │ pitfalls     │   │
             │                  │ entrypoints  │   │
             │                  │ test-map     │   │
             │                  └──────┬───────┘   │
             │                         │           │
             ▼                         │           │
  ┌──────────────────────────────┐      │           │
  │  按 yaml 路由加载文件         │      │           │
  │  always[] + stages.<stage>[] │      │           │
  │  + selection_rules 静态子集  │      │           │
  │  (output_exists.*求值)       │      │           │
  │  fact.* v1 跳过              │      │           │
  └──────────────┬───────────────┘      │           │
             │                         │           │
             ▼                         │           │
  ┌──────────────────────┐             │           │
  │  逐文件读取           │             │           │
  │  ┌──────────────┐    │             │           │
  │  │ 文件存在？    │    │             │           │
  │  └──┬───────┬───┘    │             │           │
  │     │ 是    │ 否(Level 1:文件缺失)  │           │
  │     ▼       ▼        │             │           │
  │  [读取]  [跳过此文件] │             │           │
  └──────────┬───────────┘             │           │
             │                         │           │
             └──────────┬──────────────┘           │
                        │                          │
                        ▼                          │
             ┌─────────────────────┐               │
             │  上下文注入完成      │               │
             │  [降级时输出一行说明] │               │
             └──────────┬──────────┘               │
                        │                          │
                        │◄─────────────────────────┘
                        ▼
             ┌─────────────────────┐
             │   进入主工作流       │
             │  Phase 0 / Phase 1  │
             │  Stage 1            │
             └─────────────────────┘
```

### 2.6 各 Skill 与 injection-index.yaml 的关系

Skill 只声明自己的 stage 标识，路由由 yaml 驱动。v1 执行子集（4 步）：

```
  spec-plan   →  stage: "plan"
               → always[] + stages.plan[] + selection_rules(output_exists.*) + advice.plan

  spec-work   →  stage: "work"
               → always[] + stages.work[] + selection_rules(output_exists.*) + advice.work

  spec-code-review →  stage: "review"
               → always[] + stages.review[] + selection_rules(output_exists.*) + advice.review

  三个 skill 预载块逻辑完全一致，唯一差异：stage 标识字符串
  fact.* 类 selection_rules 显式跳过（需运行时状态，留 v2）
```

**优化决策：移除 `task_types` 字段**

原 `task_types` 与 `stages` 完全重复（无额外价值），唯一有用的 `task_types.unknown`
迁移到 `stages.unknown`。三个 skill 各自固定 stage，不存在"stage 未知"场景；
`stages.unknown` 保留作为未来扩展点，v1 不主动加载。

`injection-index.yaml` 是路由声明真源；v1 执行 `always + stages + output_exists 静态规则`，`fact.*` 留待 v2。

---

## 3. 消费模型

### 3.1 设计原则：yaml 驱动，skill 无感知

各 SKILL.md **不枚举具体文件名**。文件列表、阅读优先级均从 `injection-index.yaml` 读取：

| yaml 字段 | 作用 | v1 处理 |
|-----------|------|---------|
| `always[]` | 所有 stage 都加载的基础文件 | ✅ 执行 |
| `stages.<stage>[]` | 当前 stage 专属文件（含 `unknown` 兜底） | ✅ 执行 |
| `selection_rules[]` 静态子集 | `output_exists.*` 条件扩展 | ✅ 执行 |
| `selection_rules[]` 动态子集 | `fact.*` 条件扩展 | ⏭ v2（需运行时状态） |
| `advice.<stage>` | 阅读优先级提示 | ✅ 执行 |
| ~~`task_types`~~ | ~~与 stages 完全重复~~ | 🗑 已删除 |

### 3.2 加载顺序（v1，三个 skill 一致）

```
1. always[]                    ← 基础上下文，必加载
2. stages.<stage>[]            ← 当前 stage 专属（skill 固定知道自己的 stage）
3. selection_rules 静态子集    ← output_exists.* 求值，命中则追加
4. advice.<stage>              ← 阅读优先级提示
```

**selection_rules v1 求值规则**：

```
output_exists.*  → 检查该规则 inject[] 中每个文件路径是否存在于 docs/contexts/<slug>/
                   存在则追加，不存在则跳过（Level 1）
                   若 inject[] 中全部文件均不存在：整条规则跳过，不追加任何内容，不阻断
                   条件名称只是标签，文件路径由 inject[] 决定，不从条件名推导
fact.*           → v1 跳过，记录"跳过 fact.* 条件，已使用 stages 基线"
```

> 注：`stage == 'work'` 条件已从 yaml 中删除（与 stages.work 完全重复）。

### 3.3 `injection-index.yaml` 结构（已修正）

优化后的完整 yaml 结构（`docs/contexts/spec-first/injection-index.yaml` 已更新）：

```yaml
always:
  - 00-summary.md
  - README.md

stages:
  plan:
    - architecture/module-map.md
    - code-facts/public-entrypoints.md
  work:
    - code-facts/public-entrypoints.md  # 语义修正：移除 review-change.md
    - code-facts/test-map.md
  review:
    - code-facts/high-risk-modules.md
    - pitfalls/index.md
    - context-packs/review-change.md    # 补入
    - code-facts/test-map.md            # 补入
  unknown:                              # 从 task_types.unknown 迁移，保留扩展点
    - README.md

selection_rules:
  - condition: "output_exists.code_facts_public_entrypoints"
    inject:
      - code-facts/public-entrypoints.md
  - condition: "fact.graph_support_state == 'local-available'"
    inject:
      - architecture/module-map.md
      - code-facts/high-risk-modules.md
  # 已删除：stage == 'work'（与 stages.work 完全重复）

advice:
  review: "优先 code-facts 和 risk signals，而非 narrative"
  work: "优先 context-packs 和 test-map，而非 architecture"
  plan: "优先 architecture/module-map 和 code-facts/public-entrypoints"
```

**变更摘要**（相较原 yaml）：
- 删除整个 `task_types` 字段（与 `stages` 完全重复）
- `task_types.unknown` → 迁移为 `stages.unknown`（保留扩展点，v1 不主动加载）
- `stages.work` 移除 `review-change.md`，改为 `public-entrypoints.md`
- `stages.review` 补入 `review-change.md` 和 `test-map.md`
- `selection_rules` 删除冗余的 `stage == 'work'` 条目

**5.0b：spec-graph-bootstrap 生成模板同步修正**

`skills/spec-graph-bootstrap/SKILL.md` Phase 4 中将 `stages`、`task_types`、`selection_rules` 的 `[...]` 占位符替换为上方明确结构，**删除 `task_types` 块**，确保未来用户项目生成正确的 yaml。

---

## 4. 实施单元

### 4.0 通用预载块模板

三个 skill 使用**同一模板**，唯一差异是第一行的 stage 标识。

```markdown
## Stage-0 上下文预载（可选增强，不阻断主工作流）

> 此步骤读取 `spec-graph-bootstrap` 生成的 Stage-0 产物作为增强上下文。
> 任何文件缺失、YAML 解析失败、目录不存在均只触发降级，不中止主工作流。

**本 workflow stage 标识**：`<stage>`   <!-- plan | work | review -->

### 预载步骤

1. **解析 slug**
   - 取当前仓库根目录名：`slug = basename(git rev-parse --show-toplevel)`
   - context 路径：`docs/contexts/<slug>/`
   - 若命令失败或路径不存在 → 跳过整个预载步骤（Level 3）

2. **读取路由索引**
   - 读取 `docs/contexts/<slug>/injection-index.yaml`
   - 解析失败或文件不存在 → 进入 Level 2 降级

3. **按 yaml 路由加载文件**
   - 加载 `always[]` 列表的所有文件
   - 加载 `stages.<stage>[]` 列表的所有文件
   - 执行 `selection_rules[]` 中的 `output_exists.*` 条件：检查该规则 `inject[]` 中每个文件是否存在，存在则追加
   - `fact.*` 类条件 v1 跳过，记录"跳过 fact.* 条件，已使用 stages 基线"
   - 参考 `advice.<stage>` 字段确定阅读优先级
   - 每个文件：存在则读取，缺失则跳过（Level 1）

4. **Level 2 固定最小集合**（`injection-index.yaml` 不可用时）
   - `docs/contexts/<slug>/00-summary.md`
   - `docs/contexts/<slug>/pitfalls/index.md`
   - `docs/contexts/<slug>/code-facts/public-entrypoints.md`
   - `docs/contexts/<slug>/code-facts/test-map.md`

5. **降级说明**
   - 触发降级时，在响应中一句话说明原因
   - 不要求用户先补 bootstrap 产物，主任务继续执行
```

---

### 4.1 修改 `skills/spec-plan/SKILL.md`

**插入位置**：`## Plan Quality Bar` 之后、`## Workflow` 之前

**stage 标识**：`plan`

**差异**：无，直接套用 §4.0 模板，`<stage>` 替换为 `plan`

---

### 4.2 修改 `skills/spec-work/SKILL.md`

**插入位置**：`## Execution Workflow` 之前、`### Phase 1: Quick Start` 正上方

**stage 标识**：`work`

**差异**：无，直接套用 §4.0 模板，`<stage>` 替换为 `work`

---

### 4.3 修改 `skills/spec-code-review/SKILL.md`

**插入位置**：主标题描述段之后、`## When to Use` 之前

**stage 标识**：`review`

**差异**：描述行补充"在 reviewer 召唤前注入，扩展风险感知范围"

**完整插入内容**：

```markdown
## Stage-0 上下文预载（可选增强，不阻断主工作流）

> 此步骤读取 `spec-graph-bootstrap` 生成的 Stage-0 产物作为增强上下文，
> 在 reviewer 召唤前注入，扩展 review 的风险感知范围。
> 任何文件缺失、YAML 解析失败、目录不存在均只触发降级，不中止主工作流。

**本 workflow stage 标识**：`review`

### 预载步骤

1. **解析 slug**
   - 取当前仓库根目录名：`slug = basename(git rev-parse --show-toplevel)`
   - context 路径：`docs/contexts/<slug>/`
   - 命令失败或路径不存在 → 跳过整个预载步骤（Level 3）

2. **读取路由索引**
   - 读取 `docs/contexts/<slug>/injection-index.yaml`
   - 解析失败或文件不存在 → 进入 Level 2 降级

3. **按 yaml 路由加载文件**
   - 加载 `always[]` 列表的所有文件
   - 加载 `stages.review[]` 列表的所有文件
   - 执行 `selection_rules[]` 中的 `output_exists.*` 条件：检查 inject[] 中每个文件路径是否存在，存在则追加
   - `fact.*` 类条件 v1 跳过，记录"跳过 fact.* 条件，已使用 stages 基线"
   - 参考 `advice.review` 字段确定阅读优先级
   - 每个文件：存在则读取，缺失则跳过（Level 1）

4. **Level 2 固定最小集合**（`injection-index.yaml` 不可用时）
   - `docs/contexts/<slug>/00-summary.md`
   - `docs/contexts/<slug>/pitfalls/index.md`
   - `docs/contexts/<slug>/code-facts/public-entrypoints.md`
   - `docs/contexts/<slug>/code-facts/test-map.md`

5. **降级说明**
   - 触发降级时，在响应中一句话说明原因
   - 不要求用户先补 bootstrap 产物，主任务继续执行
```

---

## 5. 实施清单

> **执行时序说明**：
> - `5.0a / 5.0b`：yaml 语义修正，与 3A gate **独立**——是技术前置，可提前完成，不需等待 3A 验证
> - `5.1 / 5.2 / 5.3`：SKILL.md 修改，受 3A gate 管控——必须在 3A 验证通过后才可执行

### 3A 准入 gate（仅管控 5.1–5.3，不管控 5.0a/5.0b）

> 需求原文：**"只有 3A 验证通过的规则，才允许进入 3B 固化。不得跳过验证，直接把未经验证的路由规则写入 workflow 主契约。"**

3A 准入条件（参考需求 §5.2.2 验证记录模板）：

- [x] `spec-plan` 完成至少一组真实任务验证记录，`allow_enter_3b = yes`
- [x] `spec-work` 完成至少一组真实任务验证记录，`allow_enter_3b = yes`
- [x] `spec-code-review` 完成至少一组真实任务验证记录，`allow_enter_3b = yes`
- [x] 验证记录中确认：主路径可工作、降级可解释、无关键误导

**3A gate 通过后，方可执行 5.1–5.3。**

---

- [x] **5.0a（已完成）** `docs/contexts/spec-first/injection-index.yaml` 已更新
  - 删除 `task_types` 字段，`unknown` 迁移至 `stages.unknown`
  - `stages.work` 修正为 `[public-entrypoints.md, test-map.md]`
  - `stages.review` 补入 `review-change.md`、`test-map.md`
  - 删除冗余的 `stage == 'work'` selection_rule

- [x] **5.0b（前置）** 更新 `skills/spec-graph-bootstrap/SKILL.md` Phase 4 yaml 生成模板
  - 按 §3.3 的最终结构替换全部 `[...]` 占位符
  - **删除 `task_types` 块**（不再生成）
  - `stages.unknown: [README.md]` 保留
  - `selection_rules` 移除 `stage == 'work'` 条目

- [x] **5.1** `skills/spec-plan/SKILL.md`：`## Plan Quality Bar` 之后、`## Workflow` 之前插入 §4.0 模板（stage=`plan`）
- [x] **5.2** `skills/spec-work/SKILL.md`：`## Execution Workflow` 之前、`### Phase 1` 正上方插入 §4.0 模板（stage=`work`）
- [x] **5.3** `skills/spec-code-review/SKILL.md`：主标题描述段之后、`## When to Use` 之前插入 §4.3 完整内容（stage=`review`）
- [x] **5.4** 更新 `CHANGELOG.md`
- [x] **5.5** 同步运行时 skill 文件
  - Claude 宿主：`spec-first init --claude` → 同步至 `.claude/spec-first/workflows/`
  - Codex 宿主：`spec-first init --codex` → 同步至 `.agents/skills/`

---

## 6. 验收标准

### 6.1 yaml 路由语义正确性

- [x] `stages.work` 不包含 `review-change.md`（语义不属于 work 阶段）
- [x] `stages.review` 包含 `review-change.md` 和 `test-map.md`
- [x] `advice.plan` 字段存在且有阅读优先级提示
- [x] `advice.work` 字段存在且有阅读优先级提示
- [x] `advice.review` 字段存在且有阅读优先级提示
- [x] yaml 合法（可被解析器读取，无语法错误）
- [x] spec-graph-bootstrap 生成模板与修正后的 yaml 一致

### 6.2 skill 消费契约完整性

- [x] 三个插入块均包含 5 个预载步骤：slug 解析、yaml 读取、yaml 路由加载、Level 2 降级机制、降级说明
- [x] yaml 路由加载步骤遵循 4 步顺序：`always[] → stages.<stage>[] → output_exists.* → advice.<stage>`
- [x] 插入块包含 `output_exists.*` 静态求值说明（检查 inject[] 中每个文件路径是否存在）
- [x] `fact.*` 类条件明确标注"v1 跳过"
- [x] yaml 路由加载步骤中**不出现**具体产物文件名（路径由 yaml 的 inject[] 决定）
- [x] Level 2 降级步骤中明确列出 4 个固定文件名（这是有意的硬编码 fallback，不受上条约束）
- [x] 插入块**不包含** `task_types` 相关内容（已从 yaml 移除）

### 6.3 无侵入性
- [x] 未修改任何现有 Phase 标题或逻辑
- [x] 未新增 command 层文件
- [x] 插入块不包含"必须先完成 bootstrap"等强依赖词句

### 6.4 三级降级完整
- [x] Level 1（文件缺失）、Level 2（yaml 不可用）、Level 3（目录不存在）均有说明
- [x] Level 2 固定最小集合（4 个文件）在三个 skill 块的 step 4 中完全一致（本设计跨 stage 统一，无 stage 差异化）
- [x] 降级时只输出一行说明，不中止主工作流

---

## 7. 不包含项（明确排除）

- 修改 command 层入口文件（`templates/claude/commands/spec/`）
- 新增复杂的上下文装配框架或自动分类器
- `brainstorm` / `compound` 的消费接入（属阶段 4+ 范畴）
- 性能优化或缓存机制
- `selection_rules[]` 中 `fact.*` 类动态规则的执行（留 v2，见 §10.2）

> 注：`skills/spec-graph-bootstrap/SKILL.md` Phase 4 生成模板的修改已纳入本阶段（§5.0b），属于 yaml 路由真源修正的一部分，不在排除范围内。

---

## 8. 与上下游的关系

| 上游 | 本阶段依赖内容 |
|------|--------------|
| 阶段 2B | `docs/contexts/<slug>/injection-index.yaml` 路径与 schema 稳定 |
| 阶段 2B | `stages.*` 与 `always` 文件列表已在实际仓库生成并可验证 |
| `spec-graph-bootstrap` | Phase 4 生成模板须在本阶段 5.0b 修正后才能保证用户项目 yaml 正确 |

| 下游 | 本阶段输出 |
|------|----------|
| 阶段 4（刷新策略） | 消费路径固定后，刷新策略不得重命名 `docs/contexts/<slug>/` 下的产物文件 |
| 宿主项目（已安装） | 完成 5.1–5.3 后须执行 `spec-first init --claude/--codex` 同步运行时 skill |
| 宿主项目（新安装） | 安装新版 spec-first 后，三个 workflow 自动具备 Stage-0 消费能力，无需额外配置 |

---

## 9. 需求偏离说明

### 9.0 task_type 契约的有意简化

**上游需求定义**：需求文档 §4.1 把 `task_type` 集合列为最小消费单位，§4.4 要求 workflow 至少能判定 `unknown`。

**本方案的偏离**：v1 不实现 task_type 动态判定与路由，直接按 stage 加载 `stages.<stage>[]`。

**偏离理由**：
1. 原 yaml 中 `task_types.*` 字段与 `stages.*` 完全重复，无额外分流价值
2. 三个 skill 各有固定 stage（plan / work / review），不存在"stage 未知"场景
3. task_type 的真正价值在于**同 stage 内的细分路由**（如 work 阶段里 bug-fix vs feature），这需要更丰富的产物分类，超出 v1 范围
4. `stages.unknown` 作为扩展点保留在 yaml 中，v2 可平滑扩展

**v1 验收替代方案**：不验证 task_type 判定逻辑；验证 `stages.<stage>[]` 路由在三个 skill 中正确执行即视为满足需求 §4.1 的 stage 集合要求。

### 9.1 output_exists.* 求值协议

`selection_rules` 中的 `output_exists.*` 条件在 v1 执行，求值协议如下：

```
对于每条 selection_rule：
  condition: "output_exists.XXX"
  inject: [file-path-1, file-path-2]

求值方式：检查 inject[] 中每个文件在 docs/contexts/<slug>/ 下是否存在
  → 文件存在：追加到加载列表
  → 文件不存在：跳过（Level 1 降级）
  → inject[] 全部文件不存在：整条规则跳过，不阻断

注意：条件名称（output_exists.XXX）只是人可读标签，
      实际文件路径由 inject[] 列表决定，不需要从条件名推导。
```

---

## 10. 延后到 v2 的能力

以下能力明确不纳入阶段 3B v1 验收，统一延后到 v2 处理：

### 10.1 用户显式指定 `slug`

当前 v1 仅支持：

- `slug = basename(git rev-parse --show-toplevel)`

不支持用户在命令参数、计划文件或运行时上下文中显式传入 `slug`。原因是：

- 会引入额外解析与冲突处理逻辑
- 当前阶段 3B 没有明确用例证明该能力是必须项
- 现有仓库场景下，仓库根目录名足以稳定映射到 `docs/contexts/<slug>/`

### 10.2 `selection_rules[]` 中 `fact.*` 动态规则

v1 执行子集：

- `always[]`
- `stages.<stage>[]`
- `selection_rules[]` 中的 `output_exists.*` 静态规则（文件是否存在，零成本）
- `advice.<stage>`

延后到 v2 的仅为：

- `fact.*` 类条件（如 `fact.graph_support_state == 'local-available'`）
- 原因：需要读取运行时状态文件（README.md / fact-inventory.json），引入额外解析逻辑

`output_exists.*` **不延后**：其求值只需检查 `inject[]` 中每个文件路径是否存在，是纯静态判断。

### 10.3 不应默认写成 v2 承诺的内容

以下内容当前仅定义为“阶段 3B 不包含”，不自动进入 v2 承诺清单：

- command 层入口改造
- 复杂上下文装配框架
- 自动分类器
- `brainstorm` / `compound` 的消费接入
- 性能优化或缓存机制

这些能力是否进入 v2，应在阶段 3B 完成验证后根据收益与复杂度重新评估，而不是在本方案中预先承诺。
