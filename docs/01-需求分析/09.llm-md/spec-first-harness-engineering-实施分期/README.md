# spec-first Harness Engineering 实施分期索引

本文档集是主方案 [spec-first-harness-engineering-改造技术方案.md](../spec-first-harness-engineering-%E6%94%B9%E9%80%A0%E6%8A%80%E6%9C%AF%E6%96%B9%E6%A1%88.md) 的实施分期展开稿。

定位约束：

- 主方案继续作为全局 source of truth，负责系统目标、硬决策、全局边界、风险与总体验收。
- 本目录下 3 份文档只负责展开各阶段的实现技术方案，不重写主方案中的全局裁决。
- 若阶段文档与主方案冲突，应以主方案为准，并回收阶段文档表述。

## 文档清单

| # | 文档 | 对应主方案章节 | 阶段目标 |
| --- | --- | --- | --- |
| 1 | [阶段1-高ROI基础改造实施技术方案.md](./%E9%98%B6%E6%AE%B51-%E9%AB%98ROI%E5%9F%BA%E7%A1%80%E6%94%B9%E9%80%A0%E5%AE%9E%E6%96%BD%E6%8A%80%E6%9C%AF%E6%96%B9%E6%A1%88.md) | 第 13.1 节 | 建立最小可用闭环：`bootstrap -> plan -> work`，让 `reference-first`、`preflight-first`、`instruction-context`、`proposal/design/tasks` 与 repo-local knowledge init 能落地 |
| 2 | [阶段2-反馈回流与记忆增强实施技术方案.md](./%E9%98%B6%E6%AE%B52-%E5%8F%8D%E9%A6%88%E5%9B%9E%E6%B5%81%E4%B8%8E%E8%AE%B0%E5%BF%86%E5%A2%9E%E5%BC%BA%E5%AE%9E%E6%96%BD%E6%8A%80%E6%9C%AF%E6%96%B9%E6%A1%88.md) | 第 13.2 节 | 把 `review / compound / history / retrieval` 接成复利链，而不是只留下单次执行痕迹 |
| 3 | [阶段3-系统自进化实施技术方案.md](./%E9%98%B6%E6%AE%B53-%E7%B3%BB%E7%BB%9F%E8%87%AA%E8%BF%9B%E5%8C%96%E5%AE%9E%E6%96%BD%E6%8A%80%E6%9C%AF%E6%96%B9%E6%A1%88.md) | 第 13.3 节 | 新增 `spec-improve`，把 readiness、过程指标、结果指标和 Highest ROI gaps 收敛为持续优化能力 |

## 推荐阅读顺序

1. 先读主方案中的硬决策、全局原则、Projection Matrix 与风险章节。
2. 再读阶段 1，确认第一条最小闭环怎么落地。
3. 阶段 1 稳定后，再读阶段 2，理解 feedback loop 与 knowledge routing 如何接入。
4. 最后再读阶段 3，避免过早把系统做成 `control-heavy` 或 `knowledge-platform-first`。

## 分期边界总览

| 阶段 | 核心目标 | 主要触达节点 | 不做什么 |
| --- | --- | --- | --- |
| 阶段 1 | 建立最小可用交付闭环 | `spec-graph-bootstrap` `spec-brainstorm` `spec-ideate` `spec-plan` `spec-work` | 不引入自动治理闭环，不做重型知识平台 |
| 阶段 2 | 建立反馈回流与记忆复利 | `spec-code-review` `spec-compound` `history` `knowledge retrieval` | 不自动写回主资产，不做万能规则引擎 |
| 阶段 3 | 建立系统自进化能力 | `spec-improve` | 不把 improve 变成自动修复器 |

## 运行时路径约定

本目录下所有阶段文档统一使用 `.context/spec-first/` 作为控制面资产的根路径。

**决策依据：**

- `.claude/` 是 spec-first CLI 管理的 workflow 资产（skills、agents、commands）的输出目录，语义是"可随时由 `spec-first init` 重新同步的工具资产"。
- `.context/` 是 workflow 在具体项目执行过程中产生的运行时状态（bootstrap analysis、work 持久化、history、knowledge），语义是"项目执行过程的累积状态，不应被 init 覆盖"。

两者分离，避免 CLI 同步操作意外覆盖运行时状态。

`.context/spec-first/` 目录层级设计：

```text
.context/spec-first/
├── bootstrap/<slug>/analysis/   # bootstrap 控制面资产
├── work/<run-id>/               # work 单次执行持久化
├── spec-code-review/<run-id>/        # review 单次执行输出
├── history/<spec-id>/           # history 决策记录
└── knowledge/                   # repo-local knowledge 入口
```

## 跨阶段 ID 规范

### spec_id

`spec_id` 是 plan 文档的稳定标识符，用于关联同一需求下的多次 work/review 执行。

**生成规则：** 复用 plan 主文件名 stem，并去掉结尾 `-plan`（例：文件名 `2026-04-04-001-add-api-endpoint-plan.md` → spec_id `2026-04-04-001-add-api-endpoint`）。

**direct-to-work 例外：** 若用户绕过 plan 直接进入 `spec-work`，生成 `adhoc-YYYYMMDD-HHMMSS-<slug>`，并在 `meta.json` 标记 `spec_origin: "adhoc"`。

**一致性要求：** `work/meta.json` 和 `spec-code-review/findings.json` 中的 `spec_id` 必须使用相同推导逻辑。两个 skill 各自独立推导时，应从同一个 `plan_path` 字段派生，而非从运行时环境中读取。

### run_id

`run_id` 是单次 work 或 review 执行的唯一标识符，用作 `.context/spec-first/work/<run-id>/` 和 `.context/spec-first/spec-code-review/<run-id>/` 的目录名。

**生成规则：** ISO 时间戳前缀 + 4 位随机后缀，格式 `YYYYMMDDTHHmmss-XXXX`（例：`20260404T153020-a1b2`）。由 skill 在首次写入任何文件前生成，写入第一个文件的同时写入对应目录下的 `meta.json`。

**去重要求：** 若同一秒内有两次执行，随机后缀保证唯一性。不允许使用自增序号（无法在并发环境中保证唯一）。

### schema_version 版本策略

所有新增 JSON 资产的 `schema_version` 按主方案当前约定使用字符串版本（如 `\"1.0\"`）。

- 向后兼容字段新增：版本不变
- 字段重命名或语义变更：主版本递增，例如 `1.0 -> 2.0`
- 消费方读取到高于自身预期的版本时，应输出 `warn` 而非硬失败

## spec-graph-bootstrap 路径迁移决策

**当前状态：** 现有 `spec-graph-bootstrap SKILL.md` 将产物写入 `docs/contexts/<slug>/`（VCS 追踪的 Markdown）。本方案要求新增结构化控制面资产写入 `.context/spec-first/bootstrap/<slug>/analysis/`（运行时状态，建议 `.gitignore`）。

**两条路径并存的问题：** 若同时维护两套路径，下游 skill（`spec-plan`、`spec-work`、`doctor`）需要知道从哪里加载控制面资产，造成歧义。

**当前采用：双路径分工。**

- `docs/contexts/<slug>/` 继续存放人类可读的 Markdown 文档（供 review、archive）
- `.context/spec-first/bootstrap/<slug>/analysis/` 存放机器消费的 JSON 控制面资产
- 两套路径职责不同，不互相替代
- 下游 skill 只从 `.context/` 读取机器格式资产
- `doctor` 检查时区分两套路径的职责

## 阶段门控说明

三个阶段的完成标志使用行为语言（"真的能消费"、"开始影响"），以避免陷入"文件计数"的形式主义。但行为标志无法被机器自动验证，因此每个阶段退出时应附加以下操作验证：

**阶段1 操作验收触发点：**
- 跑一条 greenfield 需求，验证 spec-plan 输出中 `Historical Analogs` section 至少来自本地 plan / patterns / validated references，而非空白占位
- 跑一条 brownfield 需求，验证 spec-work 执行日志中 preflight.json 被写入且包含至少一条 `matched_rules`

**阶段2 操作验收触发点：**
- review 产物目录下存在 findings.json + rule-candidates.json，且 findings.json 中至少一条 `is_recurring: true`（来自 history-spec-index 交叉比对）

**阶段3 操作验收触发点：**
- spec-improve 在 Harness-enabled 模式下能读取全部6个 readiness 维度的输入，在 Reduced-harness 模式下能输出降级的 readiness 报告而非失败

## 统一约束

- `spec-graph-bootstrap` 仍是 supporting workflow，不得在阶段文档里被重新解释成强前置。
- instruction file 仍保持 single writer 语义。实施时通过 `<!-- spec-first:context:start -->` / `<!-- spec-first:context:end -->` 标记管理 block，CLI `init` 是唯一 writer，bootstrap 只产出 `instruction-context.json`。
- `proposal` 的 WHAT 层真源仍归 `spec-brainstorm` handoff 或 direct-to-plan 例外。direct-to-plan 例外应在 plan frontmatter / metadata 中显式标记 direct 来源，以保证 review 和 improve 知晓来源差异。
- 所有新增 JSON 资产都应保留 `schema_version`（版本策略见上）。
- 所有 candidate / proposal / improve 输出默认都是建议，不自动写回主资产。**automation candidate 不是此约束的例外**，见阶段2 §5.5 中的人工确认要求。

## 分期验收方式

- 每个阶段文档都有自己的阶段验收标准。
- 同时必须保持对主方案第 15 节总体验收标准的兼容。
- 若某阶段文档的验收项会破坏更高层边界，应判定该阶段方案失真并回修文档。
