# 阶段1：高 ROI 基础改造实施技术方案

本文是主方案第一阶段的展开稿，对应主方案第 13.1 节。

适用范围：

- `spec-bootstrap`
- `spec-brainstorm`
- `spec-ideate`
- `spec-plan`
- `spec-work`
- repo-local knowledge 初始化

本文不覆盖：

- `spec-review` 的候选回流体系
- `spec-compound` 的信号驱动沉淀
- `spec-improve`

## 1. 阶段定位

阶段 1 的唯一目标，是先把 `spec-first` 从“文档化 workflow”推进到“可执行的最小交付闭环”。

这个闭环必须满足：

```text
bootstrap
-> brainstorm / ideate 轻量感知上下文
-> plan 生成可执行 Spec
-> work 按 reference-first + preflight-first 执行
-> 结果可被后续 review / compound 消费
```

如果阶段 1 做完后，系统仍然只能“写出更完整的文档”，而不能减少原创、返工和上下文漂移，那么阶段 1 就失败。

## 2. 阶段目标

### 2.1 业务目标

- 让 `bootstrap` 产出可被下游消费的结构化资产，而不是只产出 Markdown。
- 让 `brainstorm / ideate` 不再完全脱离项目现实。
- 让 `plan` 成为可执行中间表示，而不是泛化说明文档。
- 让 `work` 具备显式的 `reference-first + preflight-first + verification persistence` 路线。
- 让 `0-1` 与存量项目都能走通同一条主链，只是默认策略不同。

### 2.2 技术目标

- 建立 `.context/spec-first/bootstrap/<slug>/analysis/*` 最小控制面。
- 建立 `.context/spec-first/work/<run-id>/*` 最小执行持久化。
- 初始化 `.context/spec-first/knowledge/*` 的 repo-local 入口。
- 保持 instruction file single writer，不让 Stage-0 接管 repo-root writer。

## 3. 范围与边界

### 3.1 In Scope

1. `analysis.json`
2. `reference-index.json`
3. `verify-hints.json`
4. `instruction-context.json/.md`
5. `knowledge/sources.json`
6. `knowledge/points.json`
7. `knowledge/retrieval-policy.json`
8. `proposal / design / tasks / doubt points` 的 plan 结构契约
9. `Historical Analogs` 与 `References / Differences / Structural Constraints / Verification Mapping`
10. `spec-work` 的 `Harness-enabled / Reduced-harness`
11. `meta.json`
12. `preflight.json`
13. `verification.json`
14. `signals.json`

### 3.2 Out of Scope

- `rule-candidates.json`（阶段 2 `spec-review` 首次产出，非阶段 1 继承）
- `pattern-candidates.json`（同上）
- `fast-track-proposals.json`（同上）
- `decision-notes.md` 的长期沉淀闭环（阶段 1 只写入，阶段 2 建立召回链）
- `history-spec-index.json` 的双向召回能力
- `spec-improve`
- 自动写回任何主资产

## 4. 阶段架构原则

1. `workflow first`
   任何新增资产都必须直接改善 `brainstorm / plan / work` 主链，而不是先满足知识平台抽象。
2. `reference-first over rule-first`
   阶段 1 的重点是让系统更会“找对参考并在其上改写”，不是先堆更多 guardrail。
3. `single writer`
   Stage-0 只产出 `instruction-context`，实际写 `CLAUDE.md` / `AGENTS.md` 仍由 runtime/CLI 完成。
4. `proposal source-of-truth`
   WHAT 层真源默认来自 `spec-brainstorm` handoff；`spec-plan` 负责消费与归一化，不重新发明需求。
5. `greenfield is first-class`
   Greenfield 不是 Reduced-harness 的别名。阶段 1 必须让 greenfield 至少拥有 `template-first` 的可用主链。

## 5. 关键实现对象

### 5.1 `spec-bootstrap`

#### 新职责

- 继续生成 `docs/contexts/<slug>/`
- 生成下游消费用结构化资产
- 初始化 repo-local knowledge 入口
- 为 Greenfield / Brownfield 输出不同语义但同名的 analysis asset

#### Brownfield contract

- 重点是 repo mining、reference discovery、pitfall extraction、verified hints
- 必须产出真实路径、真实命令、真实 evidence

#### Greenfield contract

- 重点是 starter context、template-first、最小架构边界、初始 verify skeleton
- 缺少本地代码资产不是失败条件

**template-first 最小约定：** Greenfield 模式下，`spec-bootstrap` 或 `spec-work` 只需能按顺序查找可用起点：

1. `docs/contexts/<slug>/templates/` — 用户已有的本地自定义模板（最高优先级）
2. 当前仓库已有的 starter / pattern 文档与 validated references
3. `spec-first` CLI 内置的 `templates/` 目录下同语言/框架的起点模板（最后兜底）

若三类来源均无匹配，不阻断执行；下游 `spec-work` 退回最小骨架生成，并在 `Reduced-harness` 或 greenfield 上下文里显式提示“未找到强模板锚点”。

#### 本阶段最小产物

- `.context/spec-first/bootstrap/<slug>/analysis/analysis.json`
- `.context/spec-first/bootstrap/<slug>/analysis/reference-index.json`
- `.context/spec-first/bootstrap/<slug>/analysis/verify-hints.json`
- `.context/spec-first/bootstrap/<slug>/analysis/instruction-context.json`
- `.context/spec-first/bootstrap/<slug>/analysis/instruction-context.md`
- `.context/spec-first/knowledge/sources.json`
- `.context/spec-first/knowledge/points.json`
- `.context/spec-first/knowledge/retrieval-policy.json`

**knowledge init 消费方说明（阶段 1 范围内）：**
- `sources.json` / `points.json` / `retrieval-policy.json` 在阶段 1 仅由 `spec-bootstrap` 写入，作为 repo-local knowledge 入口初始化
- 阶段 1 内这三个文件的消费方仅为 `spec-plan`（读取 `retrieval-policy.json` 判断知识类型）和 `spec-work`（读取 `points.json` 中 `failure` 类作为背景上下文）
- 完整双路召回（语义召回 + 索引导航）属于阶段 2 范畴，阶段 1 只保证文件存在且格式合法

### 5.2 `spec-brainstorm` 与 `spec-ideate`

#### 新职责

- 在不把 bootstrap 变成强前置的前提下，做轻量 context scan
- 输出或消费 `proposal-equivalent handoff`

#### 最小接入方式

- 先读 instruction file 中的 managed block
- 若存在 bootstrap 资产，再读取 `instruction-context` 的关键约束
- 仅在话题涉及架构、跨层、公共接口、高风险区时再按需扩大加载

#### 降级要求

- bootstrap 缺失时只能显式提示，不得报硬错误
- 最低可用路径是 instruction file + 轻量 repo scan

### 5.3 `spec-plan`

#### 新职责

- 消费 `proposal-equivalent handoff`
- 产出 `design / tasks`
- 把 reference、differences、structural constraints、verification mapping 固定进 plan
- 明确 doubt points，而不是把不确定性留给 work 临场猜

#### 阶段 1 的存储形态

- 继续沿用 `docs/plans/*.md` 单文件主入口
- `proposal / design / tasks / doubt points` 先作为一级 section
- `proposal` section 默认是只读投影或归一化摘录，不得独立演化为 WHAT 真源

**`proposal` 只读投影约束：** WHAT 层真源来自 `spec-brainstorm` handoff 产物（`docs/brainstorms/*-requirements.md`）。`spec-plan` 生成的 `proposal` section 只能摘录或归一化该内容，不得新增、删改需求意图。若无 brainstorm handoff（direct-to-plan 例外），须在 plan 文件中标记 `proposal_source: direct`，并在 proposal section 注明内容为当次直接输入。任何与 `docs/brainstorms/` 原文冲突的内容，以 brainstorm 文件为准。

#### 阶段 1 必须新增的 section

1. `References`
2. `Historical Analogs`
3. `Differences`
4. `Structural Constraints`
5. `Verification Mapping`
6. `Doubt Points`

**`Historical Analogs` 的阶段 1 最小数据源约束：**

- 只允许来自：
  - `docs/plans/` 中已有的历史 plan
  - `docs/contexts/<slug>/patterns/index.md`
  - 当前仓库已登记的 `validated references`
- 不要求、也不得隐式依赖：
  - `history-spec-index.json` 的双向召回
  - `decision-notes.md` 的稳定索引
  - 阶段 2 的双路召回能力

也就是说，阶段 1 的 `Historical Analogs` 更接近“本地历史与模式的保守引用”，不是完整 history system。

**instruction file single-writer 实现要求：**

阶段 1 的 repo-root instruction file（`CLAUDE.md` 或 `AGENTS.md`）写入模型：

- `spec-bootstrap` 产出 `instruction-context.json`（机器消费）与 `instruction-context.md`（人类可读），但 **不直接写** repo-root instruction file
- repo-root instruction file 的 managed block 仅由 CLI `spec-first init`（或 `sync-instruction` helper）写入
- managed block 边界标记为：
  ```
  <!-- spec-first:context:start -->
  ...bootstrap/skill 管理的内容...
  <!-- spec-first:context:end -->
  ```
- managed block 外的用户自定义内容，`sync-instruction` 不得覆盖
- 若 managed block 缺失（首次或被手工删除），`sync-instruction` 在文件末尾追加；不修改文件其他内容

### 5.4 `spec-work`

#### 新职责

- 显式区分 `Harness-enabled` 与 `Reduced-harness`
- 固定执行顺序：`read plan -> load references -> structural preflight -> implement glue code -> build -> lint-arch -> test -> verify`
- 持久化 preflight 与 verification 结果

> **注：** `decision-notes.md` 的稳定写入语义与 history index 召回能力属于阶段 2 范畴。阶段 1 的 `spec-work` 只需能写入 `meta.json`、`preflight.json`、`verification.json`、`signals.json`；若实现过程中确实发生显著偏离，可以自由记录备注，但不要求格式化写入 `.context/spec-first/history/`。

#### 模式要求

##### `Harness-enabled`

前置：

- `analysis.json`
- `reference-index.json`
- `verify-hints.json`

行为：

- reference-first
- preflight-first
- verification persistence

##### `Reduced-harness`

行为：

- 轻量 repo scan
- instruction file 感知
- 就地搜索最像 reference
- 显式提示建议跑 bootstrap

#### `Micro / Adhoc` 轻路径

阶段 1 还必须显式支持一条面向小修、热修、一次性 adhoc 任务的轻路径，避免把完整闭环误用成所有任务的默认流程。

适用条件建议为同时满足：

- 影响 1-2 个非测试文件
- 不新增 public API / route / command
- 不新增跨层依赖或新的结构性动作
- 不需要长 checklist 才能完成

行为：

- 允许跳过 `spec-brainstorm`
- 允许跳过正式 `spec-plan`，直接进入 `spec-work`
- 由 `spec-work` 生成 `adhoc-*` `spec_id`
- 默认走 `Reduced-harness`
- 仍要求最小 verification persistence

升级条件：

- 一旦触发结构性动作、命中 `high_risk_areas`、或影响范围超过轻路径阈值，必须升级回完整主路

这条轻路径的目标不是绕开体系，而是避免 small change 被过度流程化。

#### Greenfield 特别要求

- 优先 `template-first`
- preflight 重点保护目录、入口、公共接口与最小架构边界
- verify 重点确认骨架可运行与主链可验证

## 6. 关键数据契约

### 6.1 `analysis.json`

最小字段：

- `schema_version`
- `slug`
- `project_state`
- `generated_at`
- `analysis_mode`
- `primary_language`
- `frameworks`
- `layers`
- `entrypoints`
- `commands`
- `evidence`

### 6.2 `reference-index.json`

最小字段：

- `schema_version`
- `generated_at`
- `references[]`
  - `kind`
  - `path`
  - `reason`
  - `confidence`
  - `quality_status`
  - `quality_signals`

消费要求：

- `spec-plan` 优先引用 `validated`
- `spec-work` 可读取 `candidate` 作为搜索锚点，但不能把它当成照抄许可

### 6.3 `verify-hints.json`

最小字段：

- `schema_version`
- `file_creation_zones`
- `public_interface_zones`
- `risk_rules`

消费要求：

- `verified` 可参与 `VALID/INVALID`
- `inferred-from-structure` 最多触发 `WARN`

### 6.4 `instruction-context.json`

最小字段：

- `schema_version`
- `managed_block_title`
- `quick_links`
- `build_commands`
- `test_commands`
- `high_risk_areas`

### 6.5 `preflight.json`

最小字段：

- `schema_version`
- `mode`
- `action_type`
- `status`
- `matched_rules`
- `overrides[]`

#### VALID / INVALID 触发条件

`status` 字段取值规则如下：

| 检查项 | 触发 VALID 条件 | 触发 INVALID 条件 |
| --- | --- | --- |
| 文件路径冲突 | 目标路径不在 `verify-hints.json` 的 `file_creation_zones` 禁区内 | 目标路径命中 `file_creation_zones` 禁区且无 override |
| 公共接口变更 | 变更未触及 `public_interface_zones` 任何项 | 变更触及 `public_interface_zones` 且风险等级为 `high` 且无 override |
| 风险规则命中 | `risk_rules` 中所有 `confidence >= validated` 的规则均未命中 | 任一 `confidence == verified` 且 `blocking == true` 的规则被命中且无 override |
| bootstrap 缺失 | `Reduced-harness` 模式下，`mode == reduced-harness` 字段存在即为合规 | 不适用（bootstrap 缺失不触发 INVALID，只降级到 Reduced-harness） |

`overrides[]` 语义：

- override 表示用户或上层调用方显式豁免某条 INVALID 判定
- 每条 override 必须记录 `rule_id`、`reason`、`override_by`、`timestamp`
- override 不清除 INVALID 状态，只在 `preflight.json` 中追加记录；`status` 仍保留 `invalid`，由消费方读取 override 决定是否继续

**LLM 执行约束：** preflight check 的最终 VALID/INVALID 判定由 skill prompt 中的显式条件分支控制，不依赖 LLM 语义推断。若 `verify-hints.json` 的 `confidence` 字段为 `inferred-from-structure`，则对应规则最多触发 `WARN`，不得触发 `INVALID`。

### 6.6 `verification.json`

最小字段：

- `schema_version`
- `mode`
- `build`
- `lint_arch`
- `test`
- `verify`

### 6.7 `signals.json`

最小字段：

- `schema_version`
- `warn_count`
- `verification_retries`
- `reference_expansion_searches`
- `overrides`

### 6.8 `meta.json`

`spec-work` 每次执行时写入 `.context/spec-first/work/<run-id>/meta.json`，记录本次执行的基本上下文。

最小字段：

- `schema_version`
- `run_id`
- `spec_id`（关联 plan 文档标识，供 history-spec-index 索引用）
- `mode`（`harness-enabled` | `reduced-harness`）
- `analysis_mode`（`brownfield` | `greenfield`，继承自 bootstrap analysis.json；无 bootstrap 时为 `unknown`）
- `plan_path`（消费的 plan 文档路径）
- `started_at`
- `completed_at`
- `outcome`（`success` | `partial` | `failed`）
- `bootstrap_slug`（对应 bootstrap 产出目录；无 bootstrap 时为 `null`）

## 7. Projection Matrix 在阶段 1 的落地要求

阶段 1 至少要落实以下几项投影关系：

| 字段 | 真源 | 投影位置 |
| --- | --- | --- |
| WHAT 层 `proposal` | `docs/brainstorms/*-requirements.md` 或 direct-to-plan 例外 | `docs/plans/*.md` `proposal` section |
| `quick_links` | `instruction-context.json` | `instruction-context.md` 与 repo-root managed block |
| `high_risk_areas` | `instruction-context.json` | repo-root managed block、work metadata、review 上下文 |
| `build/test/verify` 命令 | `instruction-context.json` | repo-root managed block、plan verification mapping、verification persistence |
| reference 元数据 | `reference-index.json` | `patterns/index.md`、plan references、work 消费上下文 |

验收要求：

- 任何一个字段都不能在两个可编辑位置同时承担真源角色
- skill prompt 只能读取或摘要，不得演化成隐式规则存储面

## 8. 需要改动的资产

### 8.1 Skill / prompt

- `skills/spec-bootstrap/SKILL.md`
- `skills/spec-brainstorm/SKILL.md`
- `skills/spec-ideate/SKILL.md`
- `skills/spec-plan/SKILL.md`
- `skills/spec-work/SKILL.md`
- `skills/spec-bootstrap/references/prd-template.md`
- `skills/spec-bootstrap/references/database-prd-template.md`

### 8.2 CLI / runtime

- `src/cli/commands/init.js`
- `src/cli/lang-policy.js`
- `src/cli/commands/doctor.js`
- `src/cli/state.js`

重点职责：

- `init` 或共享 helper 承担 `sync-instruction` writer
- runtime 能辨识 `.context/spec-first/` 控制面资产
- `doctor` 能初步诊断缺失的 bootstrap / knowledge 初始资产

### 8.3 文档

- `docs/05-用户手册/02-核心概念.md`
- `docs/01-需求分析/4.五阶段工作流详解.md`
- bootstrap / plan / work 相关需求分析文档

## 9. 阶段验收标准

1. `spec-bootstrap` 运行后能生成四类 analysis asset 与三类 knowledge init asset。
2. `spec-brainstorm` 与 `spec-ideate` 在有无 bootstrap 两种情况下都能运行，且有显式降级提示。
3. `spec-plan` 能在单文件 plan 中稳定产出 `proposal / design / tasks / doubt points`，并包含 `References / Differences / Structural Constraints / Verification Mapping`。
4. `spec-plan` 明确支持 `Historical Analogs`，且 greenfield 下不会把“无本地 reference”误判为“无参考可用”。
5. `spec-work` 能区分 `Harness-enabled` 与 `Reduced-harness`，并显式持久化 `meta.json`、`preflight.json`、`verification.json`、`signals.json`。
6. `INVALID` 有固定阻断与 override 语义，override 会写入 `preflight.json`。
7. repo-root instruction file 能通过 `sync-instruction` 基于 `instruction-context` 做幂等更新，且不破坏用户手写内容。
8. 小修 / 热修 / adhoc 任务能通过 `Micro / Adhoc` 轻路径完成，且不会被强迫走完整 Spec Runtime。

## 10. 阶段风险与缓解

### 10.1 风险：bootstrap 又被实现成强前置

缓解：

- 所有下游 skill 必须保留 bootstrap 缺失时的显式降级路径
- 文档和实现都不得把缺 bootstrap 资产解释成硬失败

### 10.2 风险：plan 重新占有 WHAT 层

缓解：

- `proposal` section 只允许 handoff preservation / normalization
- 冲突时 requirements 文档优先

### 10.3 风险：reference-first 退化为文件列表

缓解：

- `reason + confidence + quality_status + quality_signals` 缺一不可
- `validated` 与 `candidate` 必须区分消费方式

### 10.4 风险：greenfield 被误用为 reduced-harness

缓解：

- 阶段文档明确 `template-first`
- Greenfield contract 不以 repo mining 成功为前提

### 10.5 风险：所有任务都被强迫走完整主路

缓解：

- 明确 `Micro / Adhoc` 轻路径
- 仅在满足低复杂度且无结构性动作时允许直达 work
- 一旦任务越界，立即升级为完整主路

## 11. 本阶段完成标志

完成阶段 1 的标志不是”多了几份 JSON”，而是下面三件事同时成立：

1. `spec-plan` 与 `spec-work` 真的能消费 bootstrap 资产，而不是只在文档里提到它们。
2. 走一条 greenfield 需求和一条 brownfield 需求，都能得到清晰且不自相矛盾的执行路径。
3. `reference-first + preflight-first + verification persistence` 真正降低了 work 阶段的原创量和返工风险。
4. 一条 micro/hotfix 类任务能不经过过度流程化而顺利完成，同时不破坏核心治理边界。

**操作验收标准（可观测指标）：**

| 标志 | 可观测验证方式 |
| --- | --- |
| spec-plan 消费了 bootstrap 资产 | plan 文档的 `Historical Analogs` section 内容来自 `analysis.json` 或 `reference-index.json`，而非空占位或泛化说明 |
| spec-work Harness-enabled 模式运行 | `.context/spec-first/work/<run-id>/preflight.json` 存在且 `matched_rules` 非空；`meta.json` 的 `mode` 为 `harness-enabled` |
| spec-work Reduced-harness 模式降级有提示 | 执行日志中出现显式降级消息（如”bootstrap 资产未找到，切换到 Reduced-harness 模式”），且 `meta.json` 的 `mode` 为 `reduced-harness` |
| Greenfield 路径可走通 | 在无本地代码的新目录中运行 bootstrap，`analysis.json` 的 `project_state` 为 `greenfield` 或 `greenfield-no-template`，且后续 spec-work 不报硬错误 |
| Brownfield preflight 有效 | spec-work 在 Harness-enabled 模式下，至少命中一条来自 `verify-hints.json` 的规则并写入 `preflight.json` 的 `matched_rules` |
