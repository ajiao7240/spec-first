# spec-first 进化提升最终综合报告

日期：2026-06-19  
输入范围：`docs/11-业界调研/` 下 4 份调研文档  
角色视角：Spec-First Evolution Architect  
目标：把多份业界对标报告收敛为一份可执行的 spec-first 演进判断，不再平铺竞品能力。

## 0. 最终结论

`spec-first` 当前不是缺更多 agent、更多 skill、更多宿主 adapter，也不是缺一个更强的中心 workflow engine。它真正需要进化的是把现有强过程治理升级为：

> **行为真相可累积、artifact 质量可测试、完成声明可证据化、agent 行为可评测、用户价值可外部验证的工程闭环。**

四份调研文档形成了高度一致的方向：

- `spec-first` 已经在 **source/runtime 边界、Scripts prepare / LLM decides、honest closeout、51 agents、compound knowledge、双宿主投影** 上建立了明显护城河。
- 最大结构性缺口是 **被开发系统的行为真相单源缺失**。当前 requirements / plan / tasks 是横向一次性 artifact，缺少纵向累积的 living behavior contract。
- 但“活契约 + Delta”不能孤立落地。若没有 artifact quality gate、honest closeout producer integration、eval corpus 和 fresh review，它会变成又一层漂亮文档，而不是工程闭环。
- 因此 P0 不应只写成“做 Delta”，而应写成 **Contract-backed Evidence Loop v1**：行为契约、Delta、质量门、运行证据、最小 eval 同步落地。

最终优先级：

| 优先级 | 主题 | 核心产物 | 判断 |
| --- | --- | --- | --- |
| P0 | Contract-backed Evidence Loop v1 | behavior contracts + delta preview/apply + artifact checklist + closeout integration + eval fixtures | 最高杠杆，补“状态治理”和“证据闭环”的根 |
| P1 | Context and Review Hardening | context/progress ledger + fresh review protocol + contract-aware review | 让长任务和多 agent 执行不丢上下文、不丢 spec intent |
| P1 | Adoption and External Proof | guide/next + demo loop + replay reports | 把“内部能力强”转成“外部可试、可评估” |
| P2 | Workflow Extensibility | schema/profile/extension/preset | 等核心 contracts 稳定后再开放，避免先做平台化 |
| P2 | Runtime Observability | optional run ledger / cost / timeout / stuck / crash | 做 evidence，不做 agent runtime app |

## 1. 输入文档与证据边界

本报告综合以下 4 份本地文档：

| 文档 | 主要价值 | 在本报告中的用途 |
| --- | --- | --- |
| `2026-06-19-spec-first-最大杠杆点-活契约层与-delta-累积演进.md` | 将“活契约 + Delta”论证为最大杠杆项 | P0 根机制来源 |
| `2026-06-19-openspec-vs-spec-first-源码级深度对比分析.md` | 深拆 OpenSpec 的 filesystem-as-state-machine、delta apply、schema.yaml，并确认 spec-first 护城河 | 行为契约与 Delta 机制来源 |
| `2026-06-19-spec-first-架构对标分析-业界-sdd-工具全景对比与提升路线.md` | 汇总 OpenSpec / spec-kit / superpowers / gsd 五维缺口 | 进化维度框架来源 |
| `2026-06-19-sdd-ai-coding-harness-benchmark.md` | 扩展到 Superpowers、Spec Kit、OpenSpec、GSD、BMAD、scale-engine、cc-sdd、sdd-riper 等 | 横向能力矩阵和 P0/P1/P2 排序校准 |

证据边界：

- 这些文档本身已包含源码级路径、行号、量化数据和 checkout 限制。
- 本报告不重新声明所有竞品源码细节，只提炼架构判断。
- 既有调研中部分远端状态为 dirty/behind，结论应理解为基于当时本地 checkout 的机制分析，不是对远端最新版本的声明。
- Graphify 等 provider 输出只作 advisory，不作为本报告的 confirmed truth。

## 2. 四份报告的共同结论

### 2.1 spec-first 的战略定位是对的

所有报告都收敛到同一判断：AI coding 正从 prompt / agent collection 走向 harness engineering。`spec-first` 已经站在正确层级：

- 它不是 prompt collection。
- 它不是 agent marketplace。
- 它不是强状态机 workflow engine。
- 它是 repo-backed AI coding harness：用 artifact、evidence、review、knowledge 把模型推理放进工程闭环。

这与角色契约的核心链路一致：

```text
Codebase -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge
```

### 2.2 spec-first 的护城河不是数量，而是边界

调研反复确认，`spec-first` 的强项不是“51 agents”这个数字本身，而是这些能力围绕同一信任模型组织：

- source-of-truth 与 generated runtime 分离。
- scripts/tools 准备 deterministic facts。
- LLM / agents 负责语义判断。
- provider facts 不越权为 semantic authority。
- closeout 必须引用证据，不允许 fake completion。
- compound 只提升 verified、可复用、有 invalidation condition 的知识。

这套边界比许多对标项目清楚。Superpowers 行为纪律强，但 deterministic contract 弱；OpenSpec delta 强，但 trust model 弱；Spec Kit scaffold 强，但 workflow engine 和 Markdown template 复杂度更高；GSD-2 runtime 强，但容易变成 agent app。

### 2.3 最大结构性缺口是“状态治理”

三份文档都把 OpenSpec-style living contract / delta 放在最高层级。原因不是 spec-first 没有 requirements，而是 requirements 的权威形态不对：

- 当前 `brainstorms`、`plans`、`tasks` 是一次性横向 artifact。
- `spec_id` 解决同一次工作链路追溯，不解决系统行为随时间的纵向累积。
- prior plans 多为 advisory，不能作为系统当前行为的 source of truth。
- `contract-drift-guard` 当前守护的是 spec-first 工具自身能力声明，不是被开发系统行为契约。

因此 review、verification、compound 都缺一个稳定根基准：

- Review 主要对照本次 plan，难发现本次 plan 范围外的回归破坏。
- Verification 证明“跑了某些测试”，但不一定证明“覆盖了受影响行为契约”。
- Compound 沉淀“怎么解决”，但没有同步沉淀“系统行为变成了什么”。

### 2.4 但 Delta 本身不是完整答案

最新横向 benchmark 对前几份报告形成了必要修正：如果只做 behavior delta，会得到一个更好的 spec archive，但不一定得到更强的 engineering loop。

要让 Delta 成为 spec-first 的乘数项，必须同时接上：

- artifact quality gate，保证契约、PRD、plan、task 本身可测试。
- honest closeout producer integration，保证完成声明和契约覆盖声明有证据。
- eval corpus，保证 skill/workflow prompt 的行为不是靠自信描述。
- fresh review protocol，保证实现先接受 spec compliance 再接受 code quality。

所以最终 P0 是一个最小闭环，而不是单点功能。

## 3. 最终能力模型：从 Artifact Trail 到 Contract-backed Evidence Loop

当前 spec-first 的核心产物链可以概括为：

```text
Request -> Requirements/PRD -> Plan -> Tasks -> Work -> Review -> Knowledge
```

需要进化为：

```text
Request
  -> Behavior Delta
  -> Artifact Quality Gate
  -> Plan / Tasks
  -> Work
  -> Verification Run Summary
  -> Honest Closeout
  -> Contract Apply / Archive
  -> Review / Knowledge
```

关键变化：

- Requirements 不再只是一次性说明，而可以升格为 behavior delta。
- Delta 不直接覆盖主契约，必须经过脚本解析、预校验、preview、apply。
- Plan 和 tasks 必须对照 behavior contract，并携带 affected contracts。
- Verification 不只记录命令是否跑过，还记录 contract coverage claim。
- Review 不只问代码质量，还先问 spec compliance / contract regression。
- Compound 不只沉淀 learning，也能触发 contract archive 或记录未合并原因。

## 4. P0：Contract-backed Evidence Loop v1

### 4.1 Goals

P0 的目标不是一次性做完整 OpenSpec，也不是重写 spec-first workflow。目标是让 spec-first 获得最小可用的纵向行为真相与证据闭环：

- 有一个明确的 behavior contract source surface。
- 有最小 Delta 语法和 deterministic preview/apply。
- 有 artifact checklist gate。
- 有 closeout evidence 能声明“本次对哪些 contract 有覆盖/未覆盖”。
- 有少量 eval fixtures 防止 prompt/workflow 语义回退。

### 4.2 Non-goals

P0 明确不做：

- 不把所有 brainstorm/PRD 强制迁移到 contract delta。
- 不把 workflow 变成 OpenSpec 式中心 archive state machine。
- 不直接让 LLM 写主契约。
- 不做 intelligent partial merge。
- 不用 Delta 替代 plan/task/review/compound。
- 不复制 Spec Kit 的大 workflow engine。
- 不复制 GSD-2 的 runtime app。

### 4.3 Source-of-truth 设计

前几份报告建议 `docs/contracts/<domain>/spec.md`。最终建议做一个更清晰的边界调整：

```text
docs/behavior-contracts/<domain>/spec.md
docs/behavior-contracts/<domain>/changes/<change-id>/delta.md
```

理由：

- `docs/contracts/**` 在 spec-first 仓库内已承载 governance / workflow / provider contracts。
- 直接把“被开发系统行为契约”混入 `docs/contracts/**`，会弱化 source-of-truth 边界。
- `behavior-contracts` 名称能清楚区分：这是产品/系统行为真相，不是 spec-first 工具自身治理契约。

对于使用 spec-first 的下游项目，可通过 config 允许改名为 `specs/`、`openspec/specs/` 或团队已有目录；但 spec-first 自身默认应保持边界显式。

### 4.4 Delta 最小语法

P0 只支持四类：

```markdown
## ADDED Requirements
## MODIFIED Requirements
## REMOVED Requirements
## RENAMED Requirements
```

每个 requirement 推荐但不强制完整成熟格式：

```markdown
### Requirement: <name>
The system MUST ...

#### Scenario: <name>
- GIVEN ...
- WHEN ...
- THEN ...
```

严格度分两层：

- v1 parser 必须能识别 sections、requirement headers、scenario headers。
- RFC 2119 / GIVEN-WHEN-THEN 完整质量作为 checklist finding，不作为第一版硬阻断。

这样能避免一上来把 retrofit / brownfield 场景卡死。

### 4.5 Script-owned facts

CLI 或脚本负责：

- 发现 affected behavior contracts。
- 解析 delta sections。
- 检查同一 delta 内重复 requirement。
- 检查跨段冲突，例如 MODIFIED 与 REMOVED 同名。
- 生成 preview summary。
- 按确定顺序 apply：RENAMED -> REMOVED -> MODIFIED -> ADDED。
- 原子写入主契约。
- 输出 machine-readable contract-sync-summary。

脚本禁止：

- 判断需求是否合理。
- 决定一个 requirement 应属于 ADDED 还是 MODIFIED。
- 解决语义冲突。
- 自动重写模糊需求。

### 4.6 LLM-owned judgment

LLM / reviewer 负责：

- 判断用户意图是否应升格为 behavior contract。
- 将需求分类成 ADDED / MODIFIED / REMOVED / RENAMED。
- 判断 Delta 是否忠实表达业务行为。
- 判断冲突是否需要改 plan、改 delta、回到 brainstorm，还是记录 deferred。
- 判断哪些 checklist finding 是 blocking，哪些是 advisory。

### 4.7 Consumers

P0 至少要接入以下 consumers：

| Consumer | 消费什么 | 作用 |
| --- | --- | --- |
| `spec-prd` / `spec-brainstorm` | behavior delta template | 需求升格时产出 Delta |
| `spec-plan` | affected behavior contracts | plan 以契约为权威上下文之一 |
| `spec-work` | affected contracts + expected scenarios | 执行时建立验证候选 |
| `spec-code-review` | main contract + delta + diff | 先做 contract compliance，再做 code quality |
| `verification-run-summary` | contract coverage candidates | 记录覆盖、未跑、降级理由 |
| `honest-closeout` | contract_coverage claim | 防止只挑通过项声明完成 |
| `spec-compound` | contract-sync-summary | 沉淀 learning 时同步行为演进或记录未合并原因 |

### 4.8 P0 验收信号

P0 不以“功能很多”为完成标准，而以下列信号为准：

- 一个小型 brownfield feature 能产出 delta preview。
- apply 后主 behavior contract 发生确定性变更。
- plan 能引用 affected behavior contracts。
- review 能指出本次 diff 对 contract 的 compliance / regression 风险。
- closeout 能声明 contract coverage，并在证据不足时降级。
- 至少 10 个 eval fixtures 能回放：好 delta、冲突 delta、模糊 delta、未覆盖 contract claim、review 漏判场景。

## 5. P0 并行补齐：Artifact Quality Gate

Spec Kit 的 “Unit Tests for English” 是对 spec-first 最低成本、最高确定性的补强之一。它不验证实现，只验证 artifact 本身是否足够可执行、可评审、可追溯。

### 5.1 适用对象

第一版覆盖：

- PRD / requirements。
- Plan。
- Task pack。
- Behavior delta。

### 5.2 最小检查维度

| 维度 | 检查内容 | 归属 |
| --- | --- | --- |
| Traceability | 是否能追到 source request / requirement / affected contract | script + LLM |
| Scope | goals / non-goals 是否可区分 | LLM |
| Testability | 是否有可观察 behavior / acceptance / scenario | LLM |
| Ambiguity | 是否存在未量化词、悬空术语、隐含 actor | LLM |
| Handoff | 下游 consumer 是否知道读哪些 artifact | script + LLM |
| Verification | 是否有候选验证方式或 not-run reason | LLM |

### 5.3 输出形态

建议输出独立 artifact：

```text
docs/checklists/<date>-<slug>-artifact-quality.md
```

或作为当前 artifact 的 `Artifact Quality Checklist` 段落。初期推荐独立文件，减少对既有 brainstorm/plan 模板的侵入。

### 5.4 边界

不要把 checklist 变成审批流。它是质量反馈，不是中心状态机。硬阻断只放在非常少的 deterministic failures：

- 缺 source identity。
- 缺目标 repo / target scope。
- task pack hash 或 spec_id 不可验证。
- Delta parser 无法识别结构。

其他语义质量问题应进入 findings，由 LLM 决定是否需要回到 brainstorm/plan。

## 6. P0 并行补齐：Honest Closeout Producer Integration

当前 report 共识是：spec-first 有强信任模型，但 producer integration 覆盖仍窄。下一步不是再写一套 closeout 文案，而是把 closeout 结构化接入更多 workflow。

### 6.1 新增 claim 类型

建议新增或扩展：

| Claim | 含义 | 证据来源 |
| --- | --- | --- |
| `artifact_quality` | 声称 PRD/plan/task/delta 已通过质量检查 | artifact checklist |
| `contract_sync` | 声称 behavior delta 已 preview/apply/archive | contract-sync-summary |
| `contract_coverage` | 声称验证覆盖受影响 contract requirements | verification-run-summary |
| `review_contract_compliance` | 声称 review 已检查 contract compliance | review artifact |

### 6.2 防 cherry-pick 规则

沿用现有思想：如果 claim 声明 `passed`，不能只引用通过的子集。对 contract coverage，必须聚合所有 affected requirement/scenario 的状态：

- `passed`：所有 required coverage 都有 confirmed evidence。
- `degraded`：部分 coverage not-run / advisory / missing。
- `unsupported`：没有对应 evidence 或 evidence 与 claim 不匹配。

### 6.3 优先接入 workflow

顺序建议：

1. `spec-work`：最直接关系完成声明。
2. `spec-code-review`：最直接关系 contract compliance。
3. `spec-debug`：修复必须确认是否改变行为契约。
4. `spec-doc-review`：PRD/plan/delta quality gate。
5. `spec-compound`：knowledge promotion 与 contract sync 的交汇点。

## 7. P0 并行补齐：Evaluation Harness v1

角色契约已承认 Evaluation Harness 仍带 aspirational。四份报告都提示：没有 eval，spec-first 的 prompt/workflow/agent 质量只能靠经验判断。

### 7.1 v1 不做什么

- 不做模型排行榜。
- 不做大规模自动评分平台。
- 不把 LLM 自评分当结果。
- 不要求每次文档修改都跑全量 eval。

### 7.2 v1 做什么

建立小而硬的 fixture set：

| Fixture 类别 | 示例 |
| --- | --- |
| Delta parser | ADDED/MODIFIED/REMOVED/RENAMED 结构、重复 requirement、跨段冲突 |
| Artifact quality | 模糊 PRD、缺 non-goal plan、不可执行 task pack |
| Honest closeout | cherry-pick passed、not-run 被假称 passed、contract coverage 缺 evidence |
| Review behavior | reviewer 先看 code quality 却漏 spec compliance |
| Skill trigger | description 误写 workflow 导致不读 SKILL body |
| Context boundary | provider advisory 被错误当 confirmed |

### 7.3 输出

每次 eval 输出：

```text
docs/validation/<date>-eval-<topic>.md
```

包含：

- fixture path。
- expected behavior。
- observed behavior。
- source refs。
- pass / concerns / fail。
- invalidation condition。

## 8. P1：Context and Review Hardening

### 8.1 Progress ledger，而不是强 runtime state

GSD 和 Superpowers 都证明长任务需要防失忆，但 spec-first 不应复制 GSD-2 的 runtime app。建议只做文件化、轻量、append-friendly 的 evidence layer：

```text
.spec-first/progress.md
.spec-first/workflows/<workflow>/<run-id>/summary.md
```

用途：

- compaction / resume 后恢复当前目标、affected contracts、last verified evidence。
- 多 agent handoff 时传递 task brief / review package。
- closeout 时引用为 advisory progress evidence。

边界：

- progress ledger 不是 source scope authority。
- 不是 approval state。
- 不是任务完成数据库。
- 不替代 plan/task/source evidence。

### 8.2 Fresh review protocol

借鉴 Superpowers，但按 spec-first 的 dispatch boundary 降级：

- 有授权 subagents 时，任务级 review 顺序为：implementation diff -> contract/spec compliance -> code quality。
- 无授权时，主线程执行同一 checklist，并记录 `dispatch_authorization_missing`。
- 父 agent 必须提供 full task text 或 file handoff，不让 reviewer 猜 plan。
- review artifact 必须区分 P0/P1 actionable 与 advisory。

第一版可只用于：

- contract-affecting changes。
- security / data / migration / cross-module changes。
- 用户明确要求 reviewers / personas / subagents。

### 8.3 Context loading tiers

OpenSpec 的 hot/warm/cold 分层和 code_flow 的 path mapping 都说明：bounded direct reads 还需要更清楚的读取策略。

建议：

- Hot：当前 user request、active artifact summary、target diff。
- Warm：affected behavior contracts、source plan anchors、task pack cards。
- Cold：docs/solutions、historical plans、provider graph、external docs。

这些 tier 是 context policy，不是强状态机。目标是降低不必要读取，提升 handoff 质量。

## 9. P1：Adoption and External Proof

角色契约已经把“可采纳性 / 可外部验证性 / 表达可信度”升为一等守护结果。四份调研都说明：spec-first 内部能力强，但首次体验和外部证明弱于 Spec Kit / BMAD。

### 9.1 Guide / next

建议增强 `using-spec-first` guide mode 或新增只读 CLI：

```bash
spec-first guide next
spec-first guide demo
```

它只回答：

- 当前 repo 可以跑什么入口。
- 会生成什么 artifact。
- 怎么判断成功。
- 当前缺少哪些 readiness facts。

不应变成菜单系统，不应暴露 internal helper。

### 9.2 Demo loop

需要一个最短可回放 demo：

```text
idea -> behavior delta -> artifact checklist -> plan -> work stub -> review -> closeout -> compound
```

Demo 不需要真实复杂 app。关键是展示 artifact/evidence path，而不是展示 agent “能写多少代码”。

### 9.3 Public proof

每个核心机制都应有 replay report：

- Delta apply replay。
- Checklist quality replay。
- Honest closeout cherry-pick prevention replay。
- Contract-aware review replay。

这比宣传“36 skills / 51 agents”更有说服力。

## 10. P2：Workflow Extensibility

Schema / extension / preset 是有价值的，但不应提前进入 P0。原因：

- 过早开放 workflow schema，会放大还不稳定的 artifact contracts。
- Spec Kit 的 workflow engine 已显示复杂度风险。
- OpenSpec schema.yaml 有启发，但 spec-first 的差异化是 trust model，不是 schema platform。

### 10.1 合适的切入点

等 P0 contracts 稳定后，再引入：

```text
schemas/<name>/schema.yaml
extensions/<name>/manifest.json
```

其中：

- schema 定义 artifact sequence / templates / consumers。
- manifest 定义 source files、hash、runtime projection。
- governance registry 继续定义 host delivery，不与 schema 混用。

### 10.2 hash-protected user modification

借鉴 Spec Kit integration manifest：

- 安装时记录 hash。
- 卸载/更新只覆盖未修改文件。
- 用户修改过的文件保留并给 drift notice。

这符合 source-first 和 preview-first。

## 11. P2：Runtime Observability

GSD-2 的 token/cost/stuck/crash ledger 有价值，但 spec-first 不应控制 agent runtime。正确落点是 optional evidence。

### 11.1 可记录字段

```json
{
  "run_id": "...",
  "workflow": "spec-work",
  "started_at": "...",
  "ended_at": "...",
  "status": "passed|failed|degraded|not-run",
  "affected_contracts": [],
  "verification_summary": "...",
  "closeout_summary": "...",
  "token_cost": {"status": "unavailable|observed", "value": null},
  "timeout_or_stuck": {"status": "none|observed|unknown", "reason_code": null}
}
```

### 11.2 边界

- 不自动 kill agent。
- 不自动 git commit / merge。
- 不绑定 Pi / Codex Cloud / Claude 内部 runtime。
- 不把 ledger 当 progress authority。

## 12. 反模式清单

最终报告明确反对以下路线：

| 反模式 | 为什么不做 |
| --- | --- |
| 复制 Superpowers 的 1% skill trigger | 会把轻量请求强行流程化，违背 using-spec-first direct-answer allowance |
| 复制 Spec Kit 大 workflow engine | 会把 spec-first 推向中心化流程引擎，增加 schema / runtime / test 矩阵成本 |
| 复制 OpenSpec 全量 archive state machine | Delta 是机制，不是全局流程；spec-first 仍应保持 fluid workflow |
| 复制 GSD-2 runtime app | 宿主 runtime 正在商品化，spec-first 应上移到 evidence/governance/knowledge |
| 堆更多 agents / skills | 数量不是护城河；没有 eval 与 contract，更多 prompt 只会增加噪声 |
| 把 provider graph 当真相源 | Graph/code provider 是 advisory，重要结论必须回源确认 |
| 让 LLM 直接改主行为契约 | 主契约 apply 必须是 deterministic script-owned operation |
| 把 behavior contract 混入现有 governance contracts | 会制造多真相源和概念污染，应显式分层 |

## 13. 建议执行顺序

### Phase 0：准备和裁边界

1. 定义 behavior contract source surface：推荐 `docs/behavior-contracts/**`。
2. 定义 `contract-sync-summary.v1` schema 草案。
3. 明确与现有 `docs/contracts/**`、`src/cli/contracts/**` 的边界。
4. 写 5-10 个 eval fixtures，先覆盖 parser / conflict / closeout claim。

完成信号：不用实现 workflow，也能用 fixture 说明好坏 delta 和应有 closeout 行为。

### Phase 1：P0 最小闭环

1. 实现 delta parser + preview。
2. 实现 deterministic apply。
3. 增加 artifact quality checklist v1。
4. 增加 contract_coverage / contract_sync closeout claim。
5. 接入 `spec-code-review` 的 contract compliance checklist。
6. 输出 replay validation report。

完成信号：一个小功能可以从 Delta 到 apply 到 review 到 closeout 全链路留证据。

### Phase 2：P1 加固

1. 引入 progress ledger / file handoff。
2. 增强 fresh review protocol。
3. 增强 guide / next。
4. 做 demo loop。

完成信号：长任务 resume、review handoff、首次试用都有可观察改善。

### Phase 3：P2 扩展

1. schema/profile。
2. extension/preset。
3. optional runtime ledger。
4. hash-protected installation / update。

完成信号：核心 contracts 稳定后，团队能安全定制而不破坏 source/runtime 边界。

## 14. 一页路线图

| 时间序 | 机制 | 产物 | 最小验证 |
| --- | --- | --- | --- |
| 1 | Behavior contract boundary | `docs/behavior-contracts/**` contract doc | fixture: existing governance contracts 不受影响 |
| 2 | Delta parser / preview | `contract-sync-summary.v1` | fixture: conflict/no-conflict |
| 3 | Deterministic apply | updated `spec.md` | fixture: atomic apply / no partial write |
| 4 | Artifact quality gate | checklist artifact | fixture: ambiguous PRD 被标出 |
| 5 | Closeout integration | contract claims | fixture: cherry-pick passed 被 degraded |
| 6 | Contract-aware review | review section | fixture: spec compliance finding before quality |
| 7 | Eval corpus | replay reports | fixture: 10-20 cases |
| 8 | Progress ledger | `.spec-first/progress.md` or run summary | resume scenario |
| 9 | Guide / demo | `spec-first guide` or docs demo | new-user replay |
| 10 | Schema/profile | `schemas/*.yaml` | schema validate |

## 15. 最终架构判断

`spec-first` 下一阶段要避免两个方向的诱惑：

- 向外扩：更多宿主、更多 commands、更多 agents、更多插件。
- 向内硬化：更强状态机、更重 workflow engine、更自动 runtime control。

正确方向是向下扎根：

> 用行为契约建立系统状态真相，用 artifact quality gate 保证输入质量，用 honest closeout 保证完成声明诚实，用 eval corpus 保证 prompt/workflow 可回归，用 guide/demo 把能力转化成可采纳价值。

这条路线同时满足角色契约的判断矩阵：

- 服务核心链路：Spec -> Plan -> Tasks -> Code -> Review -> Knowledge。
- 提升 LLM 输入质量：contract / checklist / handoff 都是更好的上下文。
- 保持 scripts prepare / LLM decides：parser/apply/summary 归脚本，语义分类和取舍归 LLM。
- 保持 light contract：只 gate 出口和副作用，不画死思考路径。
- 保持 explicit boundaries：behavior contract、governance contract、runtime artifact 分层。
- 提升用户真实研发增益：更少回归盲区，更可信完成声明，更可试用 demo。

最终一句话：

> `spec-first` 不需要成为第二个 OpenSpec、Spec Kit、Superpowers 或 GSD。它应该吸收它们最强的机制，但把这些机制放进自己的信任模型里，进化成“行为真相 + 证据闭环 + 知识沉淀”的跨宿主 AI Coding Harness。

