# OpenSpec 与 spec-first：存量项目规范初始化、阶段适配与演进补齐报告

> 日期：2026-06-21  
> 范围：汇总本轮围绕 OpenSpec、spec-first、历史存量项目、`hszq-app` 大型 App 文档库的连续分析。  
> 目标：回答 OpenSpec 是否只适合 0-1、spec-first 当前处于什么项目阶段、历史 spec 如何初始化，以及 spec-first 应借鉴 OpenSpec 哪些机制来补齐 1-10 / 10-100 项目的能力规范治理。  
> 证据来源：本目录既有 OpenSpec 对比调研、OpenSpec `docs/concepts.md` / `docs/getting-started.md` / `openspec/specs/openspec-conventions/spec.md` / `sync-specs` / `archive-change` workflow、spec-first 角色契约、`spec-prd` / `spec-plan` / `spec-work`、context / knowledge / project-graph contracts，以及 `hszq-app/wiki-zread-v1` 目录只读统计。

## 0. 结论先行

OpenSpec 不是只适合 0-1 项目。它适合 **从现在开始治理增量变更**，尤其擅长把一次 change 的 delta spec 合并到 main spec，形成当前能力行为真相。但它对大型历史项目缺一段关键前置能力：**历史 baseline 初始化**。

spec-first 当前也不是单纯的 0-1 需求工具。它更像已经成型的 **1-10 brownfield workflow harness**，并且具备部分 10-100 大型工程治理基础：PRD 当前态证据、plan/work/review/knowledge 闭环、source/runtime 边界、summary-first handoff、provider_untrusted 图谱消费边界。但 spec-first 仍缺 OpenSpec 强项中的一个关键层：

```text
当前项目能力真相层
docs/specs/<capability>/spec.md
```

也就是：某个业务能力当前到底承诺什么行为、有哪些场景、边界、异常、权限、状态流转，以及这些行为由哪些代码 / wiki / 测试 / owner 确认支持。

本轮分析的核心判断：

1. OpenSpec 的 `openspec/specs/<capability>/spec.md` 是当前能力规范，不是某次需求文档。
2. OpenSpec 的 `openspec/changes/<change>/specs/<capability>/spec.md` 是本次 change 的 delta spec，才与某次需求强绑定。
3. spec-first 已有 `docs/brainstorms/*-requirements.md`、`docs/plans/*`、`docs/tasks/*`、`docs/contracts/*`、`docs/solutions/*`，但缺一个统一的“当前能力行为真相”层。
4. 对历史存量工程，不应直接把 AI 从代码推断出的内容写进主 spec；应先生成 baseline evidence 和 baseline change，再经确认提升为主 spec。
5. 对 `hszq-app` 这种大型 App，不能把 821 份 wiki markdown 全部转 spec，也不能默认全量注入上下文；应按 capability map 选择高价值能力逐步 baseline。

推荐方向：

```text
Code / Wiki / Tests / Graph
  -> Capability Inventory
  -> Baseline Evidence Pack
  -> Baseline Change Spec
  -> Reviewed Current Capability Spec
  -> Future Change Delta
  -> Archive / Sync Back To Main Spec
```

这不是照搬 OpenSpec，而是在 spec-first 的证据边界、summary-first、Scripts prepare / LLM decides、Knowledge Harness 之上，补上 OpenSpec 最有价值的“能力规范生命周期”。

## 1. OpenSpec 中的“spec”到底是什么

OpenSpec 的关键不是“有一堆 Markdown 文档”，而是它把 spec 分成两个层次：

| 路径 | 含义 | 是否绑定单次需求 | 角色 |
| --- | --- | --- | --- |
| `openspec/specs/<capability>/spec.md` | 当前系统能力的行为规范 | 否 | 当前能力 source of truth |
| `openspec/changes/<change>/specs/<capability>/spec.md` | 本次 change 对能力规范的变更 | 是 | delta spec / proposed modification |
| `openspec/changes/archive/YYYY-MM-DD-<change>/` | 已完成 change 的历史记录 | 是 | 审计历史 |

OpenSpec 的 `docs/concepts.md` 明确把 `specs/` 描述为 source of truth：描述系统当前如何工作。`changes/` 描述 proposed modifications：每个 change 一个目录，完成后归档并合并回主 spec。

OpenSpec 的 `openspec/specs/openspec-conventions/spec.md` 进一步规定了行为规范格式：

```markdown
### Requirement: ...

The system SHALL ...

#### Scenario: ...

- **WHEN** ...
- **THEN** ...
```

这说明 OpenSpec 的 main spec 不是 PRD、不是实现设计、不是 wiki 知识库，而是更窄的东西：**当前能力行为合同**。

## 2. OpenSpec 的优势与隐藏前提

OpenSpec 的优势在于生命周期清晰：

```text
propose / new
  -> change artifacts
  -> delta specs
  -> apply
  -> sync / archive
  -> main specs updated
```

它的强项：

- 把当前能力和本次变更隔离。
- 让需求不是一次性文档，而是可以合并进当前能力规范。
- 通过 `ADDED` / `MODIFIED` / `REMOVED` / `RENAMED` 表达行为变化。
- archive 时比较 delta spec 与 main spec，提示是否同步。
- main specs 形成长期可读的项目能力地图。

但它有一个隐藏前提：

```text
当前 main specs 已存在，或者当前要改的能力可以被局部写清楚。
```

对 0-1 项目，这个前提自然成立：从第一天开始写 spec，main specs 随每次 change 累积。

对 1-10 已有项目，这个前提部分成立：可以先围绕当前要改的能力写 delta，顺手补一个 main spec。

对 10-100 大型历史项目，这个前提通常不成立：系统已有大量能力、历史兼容、灰度开关、bug-like behavior、废弃代码、过期 wiki、缺测试路径。此时 OpenSpec 的 change/delta/archive 模型有价值，但还缺一个历史初始化阶段。

## 3. OpenSpec 是否只适合 0-1

不是。更准确的阶段判断如下：

| 项目阶段 | OpenSpec 适配度 | 判断 |
| --- | --- | --- |
| 0-1 新项目 | 高 | main spec 从第一天随 change 累积，模型天然顺滑。 |
| 1-10 已有项目 | 中高 | 对新需求增量治理很有效，但历史能力需要逐步补 baseline。 |
| 10-100 大型历史项目 | 中 | 可管住未来 change，但不能自动把历史系统变成可信主 spec。 |
| 多团队长期演化 | 中 | spec 生命周期清晰，但缺更强 evidence、context、review、knowledge governance。 |

所以 OpenSpec 不是“只适合 0-1”，而是更准确地说：

```text
OpenSpec 适合 brownfield 的未来增量治理，
但不完整覆盖大型历史项目的存量能力 baseline 初始化。
```

大型历史项目需要额外补三类机制：

1. Capability inventory：先知道系统有哪些能力边界。
2. Baseline evidence：从代码、wiki、测试、接口中抽取证据，不直接生成权威规范。
3. Confidence / authority：区分 confirmed-by-test、confirmed-by-owner、inferred-from-code、inferred-from-wiki、conflict-detected。

## 4. spec-first 当前项目阶段

spec-first 当前更适合描述为：

```text
1-10 brownfield workflow harness 已成型，
正在向 10-100 engineering governance harness 演进，
缺口是 capability spec store + baseline initialization。
```

它已经强于 OpenSpec 的地方：

| 能力 | spec-first 当前基础 | 对大型项目的价值 |
| --- | --- | --- |
| Brownfield PRD | `spec-prd` 明确先做 Current System Snapshot，并要求 current-state claim 有 evidence tag | 避免 plan 发明现状 |
| Plan | `spec-plan` 继承 requirements，记录 source refs、scope、test paths、risks | 把 WHAT 转成可执行 HOW |
| Work | `spec-work` 守住 plan / task scope、反馈回路、验证、review | 防止执行期扩散 |
| Review | `spec-code-review` / `spec-doc-review` | 把质量判断做成 workflow 节点 |
| Knowledge | `docs/solutions` + `spec-compound` | 把经验沉淀为可召回知识 |
| Context Governance | `docs/contracts/context-governance.md` | 防止大工程上下文爆炸 |
| Project Graph Consumption | `docs/contracts/project-graph-consumption.md` | 允许图谱导航，但保持 `provider_untrusted` |
| Source / Runtime Boundary | 角色契约和 AGENTS/CLAUDE 规则 | 防止 generated runtime mirror 被当 source 修 |

spec-first 缺的不是“需求文档能力”。它已经有需求、计划、任务、评审、知识文档。缺的是：

```text
当前项目业务能力的累积行为规范。
```

也就是 OpenSpec main spec 这一层。

## 5. 当前 spec-first 中已有的“规范”与缺口

spec-first 里已经有很多“规范类文档”，但它们不是同一种东西：

| 当前资产 | 记录什么 | 是否等价 OpenSpec main spec |
| --- | --- | --- |
| `docs/brainstorms/*-requirements.md` | 单次需求 / PRD-grade WHAT | 否，需求维度，绑定一次工作 |
| `docs/plans/*` | 单次实现计划 / HOW | 否，执行维度 |
| `docs/tasks/*` | 从 plan 派生的任务包 | 否，执行拆分 |
| `docs/contracts/*` | spec-first 自身 workflow / harness / schema contract | 否，是工具自身工程合同 |
| `docs/solutions/*` | 经验、模式、问题解决知识 | 否，是经验知识，不是能力行为真相 |
| graphify / codegraph / wiki | 代码结构、架构关系、实现知识 | 否，是理解代码的证据或导航 |

因此，“当前 spec-first 也有 spec 文档”这句话是对的，但它们大多是 **workflow artifact**，不是 **current capability spec**。

OpenSpec 的关键点在于：

```text
openspec/specs/<capability>/spec.md
= 当前能力真相
= 累积后的系统行为合同
= 不绑定单个需求
```

这正是 spec-first 当前缺失的规范类型。

## 6. 需求 spec 与主 spec 不能共用同一路径

本轮讨论中曾出现一个容易混淆的路径建议：

```text
需求开始建立需求维度的 docs/specs/<capability>/spec.md
需求开发完成后合并到项目级别 docs/specs/<capability>/spec.md
```

如果要借鉴 OpenSpec，这个路径不应共用。否则会把“本次需求”与“当前能力真相”混成一个 source-of-truth。

更稳的路径设计是：

```text
docs/spec-changes/<change>/specs/<capability>/spec.md
  = 本次需求 / change 的 delta spec

docs/specs/<capability>/spec.md
  = 当前能力主 spec

docs/spec-baselines/<date>/<capability>/evidence.md
  = 历史初始化证据包
```

对应关系：

| spec-first 当前资产 | OpenSpec 类比 | 建议角色 |
| --- | --- | --- |
| `docs/brainstorms/*-requirements.md` | `proposal.md` + 部分 delta spec 输入 | PRD / 需求真相 |
| `docs/spec-changes/<change>/specs/...` | `changes/<change>/specs/...` | change-level behavior delta |
| `docs/specs/<capability>/spec.md` | `specs/<capability>/spec.md` | current capability truth |
| `docs/spec-baselines/.../evidence.md` | OpenSpec 未完整覆盖 | 存量工程 baseline evidence |

## 7. 历史存量项目的 spec 如何初始化

历史项目不要“回放历史需求”来补 spec。正确目标是建立当前行为基线：

```text
不是补历史账，
而是把当前系统能力从“只能靠代码猜”提升为“有证据、有边界、有置信度的当前能力规范”。
```

推荐流程：

```text
1. Capability Inventory
2. Evidence Pack
3. Baseline Change Spec
4. Review / Confirmation
5. Promote To Main Spec
6. Future Change Delta
```

### 7.1 Capability Inventory

先生成能力地图，不直接写大 spec。

```markdown
# Capability Map

| Capability | Scope | Source Evidence | Status |
| --- | --- | --- | --- |
| market-monitor | 行情监控、悬浮窗、监控目标、开关配置 | wiki-zread-v1/market-monitor, market-monitor module | draft |
| trade-order | 普通交易下单、撤单、委托状态 | wiki-zread-v1/trade-order, trade-order module | missing |
| quotes-watchlist | 自选股列表、分组、同步、排序 | wiki-zread-v1/quotes-watchlist | missing |
```

作用：先确定“有哪些能力”，再决定哪些值得 baseline。

### 7.2 Evidence Pack

每个 capability 先产出证据包，而不是权威 spec：

```text
docs/spec-baselines/2026-06-21/market-monitor/evidence.md
```

证据包记录：

- 相关 wiki 文档。
- 相关代码模块。
- 页面入口、路由、ViewModel、UseCase、API。
- 本地存储、feature flag、权限、配置。
- 测试存在或缺失。
- 从代码推断出的行为。
- 文档与代码冲突。
- 不确定问题。

这一步可以高度自动化，但自动化只产出 evidence / candidate，不产出 confirmed truth。

### 7.3 Baseline Change Spec

把历史初始化当成一个特殊 change：

```text
docs/spec-changes/baseline-market-monitor/
├── proposal.md
└── specs/
    └── market-monitor/
        └── spec.md
```

`proposal.md` 写清楚：

```markdown
# Proposal: Baseline Market Monitor

## Intent

把当前已存在的行情监控能力登记为主 spec，不改变产品行为和代码。

## Scope

- 行情监控目标
- 悬浮窗展示条件
- 开关配置
- 状态保存与同步

## Non-goals

- 不重构代码
- 不定义新需求
- 不还原历史迭代原因
- 不覆盖行情模块全部能力

## Evidence

- wiki-zread-v1/market-monitor/...
- market-monitor module
- related storage/config files

## Confidence

baseline-draft，来源为 wiki + code inference，待 owner 或运行证据确认。
```

delta spec 写成：

```markdown
# Delta for Market Monitor

## ADDED Requirements

### Requirement: 监控目标选择

系统 SHALL 允许用户选择一个行情对象作为当前监控目标。

#### Scenario: 用户切换监控目标

- **GIVEN** 用户已进入行情监控设置
- **WHEN** 用户选择新的证券对象
- **THEN** 系统保存该对象为当前监控目标
- **AND** 后续监控展示使用新的目标
```

然后再合并为：

```text
docs/specs/market-monitor/spec.md
```

### 7.4 Authority / Confidence

主 spec 不能默认为全 confirmed。至少需要显式标注来源级别：

| 状态 | 含义 |
| --- | --- |
| `confirmed-by-test` | 有测试或可复现实验证据确认 |
| `confirmed-by-owner` | 有业务 / 技术 owner 确认 |
| `confirmed-by-runtime` | 有运行路径或日志确认 |
| `inferred-from-code` | 从代码推断，尚未人工确认 |
| `inferred-from-wiki` | 从 wiki 推断，可能过期 |
| `conflict-detected` | 代码、wiki、测试或 owner 说法冲突 |
| `unknown` | 证据不足 |

这样可以避免把历史代码中的 bug、废弃逻辑、临时兼容误提升为业务规范。

## 8. `hszq-app` 案例：为什么不能全量转换 wiki

用户指定的文档目录：

```text
/Users/kuang/xiaobu/hszq-app/wiki-zread-v1
```

只读统计结果：

| 项 | 结果 |
| --- | --- |
| 总体大小 | 16M |
| 文件总数 | 988 |
| Markdown 文件 | 821 |
| 一级领域目录 | 28 |

一级目录包括：

```text
android-foundation
android-full-app
biz-common-core
community-domain
feed-core
live-domain
market-monitor
message-center
news-domain
post-domain
quotes-detail
quotes-flow-trade-entry
quotes-option
quotes-rankings
quotes-watchlist
search-domain
trade-account
trade-flow-auth-order
trade-order
user-domain
wealth-domain
```

这些 wiki 是大型代码知识库，不等于主 spec。它们适合作为 source evidence，不适合直接变成 `docs/specs/`。

原因：

- wiki 多数解释实现、模块、架构、依赖关系，不一定描述外部可观察行为。
- wiki 可能包含历史、设计、代码结构，主 spec 应 current-state-only。
- 821 份 Markdown 若全部注入上下文，会制造新的上下文问题。
- 大量实现知识不应变成规范义务。
- 代码现状可能包含 bug、临时逻辑、灰度开关，不应自动升格为业务真相。

对 `hszq-app` 的合理做法是先选 pilot capability：

| 优先级 | 能力 | 原因 |
| --- | --- | --- |
| P0 | `trade-order` | 交易下单 / 撤单高风险 |
| P0 | `trade-flow-auth-order` | 鉴权、下单流程和风险边界关键 |
| P0 | `trade-account` | 账户和资产相关，高风险 |
| P1 | `quotes-watchlist` | 高频用户能力，状态与同步复杂 |
| P1 | `market-monitor` | 悬浮窗、权限、开关、监控目标多状态 |
| P1 | `search-domain` | 跨域入口和结果类型复杂 |
| P1 | `message-center` | 推送、状态、已读、跳转等行为复杂 |

一个 `market-monitor` 主 spec 可以拆为：

```text
docs/specs/market-monitor/spec.md
docs/specs/market-monitor/float-window.md
docs/specs/market-monitor/target-subscription.md
docs/specs/market-monitor/switch-settings.md
docs/specs/market-monitor/push-sync.md
```

但默认应先从一个 compact `spec.md` 开始，只有文档变大或消费路径需要时再拆子文件。

## 9. 主 spec 应记录什么

主 spec 负责“当前能力真相”，但不能变成百科全书。它只记录会影响需求、计划、实现、review、测试判断的行为约束。

主 spec 应包括：

- Scope：这个 capability 覆盖什么，不覆盖什么。
- Requirements：当前能力必须满足的行为。
- Scenarios：典型、异常、边界、权限、状态流转场景。
- Business rules：业务规则和状态约束。
- Interfaces / observable behavior：用户、外部系统、API、UI 可观察结果。
- Error / permission handling：错误、权限不足、不可用状态。
- Source refs：证据路径。
- Authority / confidence：确认级别和待确认项。
- Last reviewed：最后确认时间。

主 spec 不应包括：

- 具体类名、函数名、ViewModel 细节。
- 完整架构说明。
- 历史需求过程。
- 代码调用链解释。
- 所有 wiki 内容。
- 所有测试细节。
- 一次性方案讨论。
- 经验总结。

业务系统示例：

```markdown
# Order Cancellation Spec

## Scope

本 spec 描述普通用户取消订单的当前行为。覆盖未支付订单、已支付未发货订单、优惠券恢复和幂等请求。不覆盖售后退货、后台强制取消、支付渠道退款到账时间。

## Requirements

### Requirement: 取消未支付订单

系统 SHALL 允许用户取消未支付订单。

#### Scenario: 用户取消未支付订单

- **GIVEN** 订单状态为待支付
- **WHEN** 用户提交取消订单请求
- **THEN** 订单状态变为已取消
- **AND** 系统不得发起退款

### Requirement: 拒绝取消已发货订单

系统 SHALL 拒绝普通用户取消已发货订单。

#### Scenario: 用户取消已发货订单

- **GIVEN** 订单状态为已发货
- **WHEN** 用户提交取消订单请求
- **THEN** 系统拒绝该请求
- **AND** 返回可展示的失败原因

## Evidence

- wiki-zread-v1/trade-order/...
- trade-order module
- order status tests

## Authority

- confirmed-by-owner: 取消已发货订单拒绝
- inferred-from-code: 优惠券恢复顺序
```

这个文档不会记录订单模块所有实现，只记录当前能力行为合同。

## 10. 主 spec 会不会越长越大

会，如果没有治理。

因此 spec-first 若引入 main specs，必须从第一天防止文档膨胀。建议规则：

1. Capability scoped：一个 spec 只管一个能力边界。
2. Current-state-only：只保留当前有效行为，历史进入 archive/change。
3. Behavior-first：只写可观察行为和约束，不写实现细节。
4. Summary-first：默认消费 index/summary，只有 affected capability 才展开 full spec。
5. Source-ref backed：不要求把所有证据复制进 spec，只保留路径和关键事实。
6. Split by pressure：只有当单个 spec 变大到影响维护和消费时，再按子能力拆分。
7. Confidence-aware：无法确认的行为不强写为 SHALL。
8. No whole-spec injection：任何 workflow 都不应默认注入全量 `docs/specs/**`。

主 spec 的消费方式应是：

```text
用户请求 / diff / plan
  -> affected capability detection
  -> docs/specs/index.md / capability-map.md
  -> selected docs/specs/<capability>/spec.md
  -> exact requirement / scenario sections
```

而不是：

```text
每次 workflow 全量读取 docs/specs/**
```

这与 spec-first 现有 `context-governance` 和 `summary-first handoff` 是一致的。

## 11. spec-first 应借鉴 OpenSpec 的内容

### 11.1 应借鉴：双层 spec 生命周期

推荐补齐：

```text
docs/spec-changes/<change>/specs/<capability>/spec.md
docs/specs/<capability>/spec.md
docs/spec-changes/archive/YYYY-MM-DD-<change>/
```

价值：

- 一次需求有自己的 delta，不污染当前主规范。
- 开发完成后，主规范被更新。
- archive 保留变更历史。
- review 可以检查 delta 是否准确表达本次行为变化。

### 11.2 应借鉴：Requirement / Scenario 结构

主 spec 和 delta spec 应至少支持：

```markdown
### Requirement: <name>

系统 SHALL ...

#### Scenario: <name>

- **GIVEN** ...
- **WHEN** ...
- **THEN** ...
- **AND** ...
```

价值：

- 可读。
- 可审查。
- 可作为测试 / verification / review checklist 输入。
- 比普通自然语言段落更稳定。

### 11.3 应借鉴：delta sections

delta spec 使用：

```markdown
## ADDED Requirements
## MODIFIED Requirements
## REMOVED Requirements
## RENAMED Requirements
```

价值：

- 对比本次需求改动更清晰。
- archive / sync 可以做 deterministic merge。
- review 能看到本次是新增、修改、删除还是改名。

### 11.4 应借鉴：archive 前 sync assessment

OpenSpec archive 会检查 delta specs 与 main specs 的同步状态。spec-first 可借鉴为：

```text
work closeout / compound closeout
  -> detect affected capability specs
  -> compare delta vs main spec
  -> report synced / unsynced / conflict / skipped
  -> archive change
```

但这不能一开始就做 hard gate。应先 report-only，积累真实案例后再决定哪些场景要硬阻断。

### 11.5 应借鉴但要改造：baseline change

OpenSpec 的主要流程面向 future change。spec-first 若要适配 10-100，必须补：

```text
baseline-<capability>
```

也就是把历史能力初始化建模为特殊 change，而不是直接生成主 spec。

## 12. spec-first 不应照搬 OpenSpec 的内容

### 12.1 不应把代码扫描结果直接当规范

OpenSpec 的 main spec 是行为 source of truth。历史工程里从代码推断出的结果只是 evidence candidate。spec-first 必须保留：

```text
provider_untrusted
source-candidate
inferred-from-code
confirmed-source
```

这类信任分层。

### 12.2 不应让脚本做语义判断

脚本可以做：

- 文件发现。
- 格式校验。
- header matching。
- delta conflict detection。
- deterministic merge。
- source refs inventory。

LLM / reviewer / owner 负责：

- 这个行为是否是业务规范。
- 这个 capability 边界是否正确。
- 代码现状是否是 bug 还是 feature。
- 哪些未确认内容可以进入主 spec。

这保持 spec-first 的核心哲学：

```text
Scripts prepare facts, LLM decides.
```

### 12.3 不应把 main specs 变成默认全量上下文

OpenSpec 项目通常轻量，main specs 全量读取压力较低。`hszq-app` 这种项目不一样。spec-first 必须延续 context governance：

- 只读 affected capability。
- 先读 index / summary。
- full spec 只在触发条件满足时展开。
- wiki / graph / codegraph 永远是 evidence / navigation，不是 truth。

### 12.4 不应把 Behavior Contract + Delta 直接排成当前唯一 P0

本目录既有 README 已收敛出当前整体优先级：Evidence Quality Loop、Closeout / verification producer integration、P-friction + Work context activation 是更靠前的基础工程。Behavior Contract + Delta 是长期乘数项。

本报告的判断是：

```text
在 OpenSpec 借鉴专题内，capability spec store + baseline 是最高价值方向；
在 spec-first 全局 roadmap 内，它应作为 P1 乘数项，依赖 P0 证据闭环和用户摩擦审计提供落地时机。
```

## 13. 推荐落地路线

### Phase 0：文档化设计，不改 workflow 行为

目标：先把概念边界写清楚。

产物：

```text
docs/contracts/capability-specs.md
docs/examples/capability-specs/
```

内容：

- main spec / change spec / baseline evidence 的定义。
- 路径建议。
- authority / confidence 标注。
- 不与 `docs/contracts/*` 工具自身 contract 混淆。
- 不与 `docs/solutions/*` 经验文档混淆。

### Phase 1：建立 capability map 和模板

目标：不做 merge engine，先支持人工 / AI 规范化写法。

产物：

```text
docs/specs/index.md
docs/specs/<capability>/spec.md
docs/spec-changes/<change>/proposal.md
docs/spec-changes/<change>/specs/<capability>/spec.md
docs/spec-baselines/<date>/<capability>/evidence.md
```

优先支持：

- compact spec template。
- evidence template。
- baseline proposal template。
- no full context injection policy。

### Phase 2：试点 baseline workflow

目标：选 1-2 个能力做历史初始化试点。

候选：

- `market-monitor`
- `quotes-watchlist`
- `trade-order`

流程：

```text
wiki/code bounded read
  -> evidence pack
  -> baseline draft
  -> owner/test/reviewer confirmation
  -> main spec
```

退出标准：

- 每个 spec 不超过少量核心 requirements。
- 每条 requirement 有 source refs。
- 未确认行为不写成 confirmed SHALL。
- workflow 不需要全量 wiki 注入。

### Phase 3：接入 PRD / plan / review 的消费

目标：先消费，不合并。

改造方向：

- `spec-prd` Current System Snapshot 优先查 affected `docs/specs/<capability>/spec.md`。
- `spec-plan` frontmatter 增加 `affects_specs` 或等价轻字段。
- `spec-code-review` 在受影响能力存在 main spec 时，把它作为回归行为基准。
- `spec-work` closeout 报告是否有 spec delta 未同步，但不硬阻断。

### Phase 4：实现 delta validate / sync

目标：把 deterministic 部分交给 CLI。

可能命令：

```text
spec-first specs validate
spec-first specs diff <change>
spec-first specs sync <change>
spec-first specs archive <change>
```

脚本负责：

- requirement header uniqueness。
- delta section parsing。
- ADDED / MODIFIED / REMOVED / RENAMED conflict detection。
- main spec 更新 preview。
- dry-run report。

LLM 负责：

- 变更语义是否合理。
- 是否应合并。
- 冲突如何解释。
- 未确认行为是否降级。

### Phase 5：与 evidence / closeout / knowledge 汇合

目标：让 capability specs 成为现有 harness 的乘数项，而不是新孤岛。

连接方式：

- `honest-closeout` 增加 spec sync / spec coverage report-only claim。
- `verification-run-summary` 可引用 requirement / scenario IDs。
- `spec-compound` 继续沉淀经验，不替代 specs 更新。
- `docs/solutions` recall 可指向 spec source refs，但不能成为 spec truth。

## 14. 竞争优势：这个工程资产解决什么问题

如果 spec-first 补上 capability spec store + baseline initialization，会解决以下问题：

### 14.1 AI 上下文漂移

没有主 spec 时，AI 每次靠当前聊天、旧 plan、wiki、代码临时拼接系统现状。主 spec 提供稳定入口：

```text
这次改动影响 market-monitor
先读 market-monitor 当前能力规范
再读本次 PRD / plan / code
```

### 14.2 回归审查没有基准

当前 review 主要对照本次 plan。主 spec 加入后，review 可以问：

```text
本次 diff 是否破坏了当前能力 spec 中未被本需求修改的 requirement？
```

### 14.3 大型项目 onboarding 成本

新 agent / 新工程师不需要先读 821 个 wiki 文件，而是先读 capability map 和相关主 spec，再按 source refs 下钻。

### 14.4 历史知识碎片化

`docs/solutions` 解决“怎么做过”的经验问题；main specs 解决“现在系统承诺什么”的状态问题。二者互补。

### 14.5 需求完成后的知识断裂

没有主 spec，需求完成后会留下 PRD、plan、task、review、solution，但系统能力本身没有被更新。main spec 让“需求完成”变成：

```text
代码变了
测试过了
review 过了
当前能力规范也更新了
```

## 15. 关键风险与反模式

| 风险 | 表现 | 应对 |
| --- | --- | --- |
| 文档膨胀 | spec 变成百科全书 | capability scoped、current-state-only、split by pressure |
| 伪权威 | AI 从代码推断的 bug 被写成 SHALL | authority / confidence 标注，baseline draft 不等于 confirmed |
| 多真相源 | PRD、wiki、main spec 同时描述同一行为且冲突 | 明确 PRD 是 change input，wiki 是 evidence，main spec 是当前行为真相 |
| 上下文爆炸 | 每次 workflow 全量注入 specs/wiki | affected capability routing + summary-first |
| 过度自动化 | 脚本决定业务规范 | 脚本只 validate / merge，LLM 和 owner 做语义裁决 |
| 路径混淆 | 本次需求和主 spec 共用 `docs/specs` | change spec 放 `docs/spec-changes`，main spec 才放 `docs/specs` |
| 与 docs/contracts 混淆 | capability spec 被误认为 spec-first 工具合同 | 文档命名和 README 明确：`docs/contracts` 是 harness contract，`docs/specs` 是被开发系统能力规范 |

## 16. 最终建议

spec-first 应借鉴 OpenSpec，但不要把自己变成 OpenSpec。

OpenSpec 最值得借鉴的是：

```text
current specs + change delta + archive/sync
```

spec-first 应补上的差异化能力是：

```text
baseline evidence + confidence-aware promotion + large-project context governance
```

因此最小可维护方案不是一次性引入完整状态机，而是：

1. 先定义 capability spec store 的边界和路径。
2. 再做 capability map 与模板。
3. 选择 1-2 个大型存量项目能力做 baseline pilot。
4. 把主 spec 作为 PRD / plan / review 的可选输入。
5. 有真实使用证据后，再实现 deterministic delta validate / sync。

最终目标不是“多一个文档目录”，而是让 spec-first 的核心链路从：

```text
Codebase -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge
```

进一步补齐为：

```text
Codebase -> Baseline Evidence -> Current Capability Spec
Current Capability Spec + Change Spec -> Plan -> Tasks -> Code -> Review
Review + Verification -> Sync Current Capability Spec -> Knowledge
```

这会让 spec-first 在 10-100 大型历史工程中形成比 OpenSpec 更强的竞争优势：OpenSpec 管住未来 change，spec-first 则可以在管住未来 change 的同时，把历史工程的代码知识、证据边界、上下文治理和经验沉淀连接成一个可持续演进的工程闭环。
