# `spec-standards` 存在价值与下一步判断

日期：2026-05-05

## 结论

`spec-standards` 有存在价值，但它当前的价值还停在“基础设施潜力”阶段。下一步不应扩展成完整规范平台，而应先把最小闭环跑通：

```text
prepare-baseline.js
  -> project-shape.json
  -> standards-plan.json
  -> glue-map.json
  -> standards-candidates.json
  -> standards-preview.md
  -> downstream workflows read as context
```

它真正要解决的问题不是“自动生成规范文档”，而是：

```text
让后续 plan / work / review 不再每次临时猜项目边界、已有能力和规范状态。
```

因此，当前推荐继续投入，但只投入轻量质量闭环，不推进 shared standards 平台、repo-profile 自动写回、多仓 workspace governance 或 drift engine。

## 为什么有价值

`spec-first` 的主链路是：

```text
Codebase -> Graph -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge
```

`spec-standards` 填的是 `Graph/Codebase -> Plan/Work/Review` 之间的空档。没有它时，agent 做计划、执行或审查时会反复临时判断：

- 这个项目是什么形态？
- 哪些目录是 source-of-truth？
- 哪些 generated runtime assets 不能手改？
- 现有 graph / bootstrap / runtime / contract 能力在哪里？
- 哪些是已确认规范，哪些只是 observed convention？
- 哪些 glue capability 应该复用，不能重复造？

这些判断如果每次都靠临时读代码，质量不稳定，也浪费上下文。`spec-standards` 的价值就是把这些判断前置成可复用、可审查的 artifacts。

它对 brownfield 项目尤其有价值。存量项目的规范通常不在一份文档里，而是散在代码、测试、README、CI、历史实现和团队习惯中。这个 skill 可以把隐性知识先编译成候选 baseline，但不直接当成 confirmed truth。

## 当前实现状态

当前实现已经做对了几件关键事：

- 已有独立 public workflow：`$spec-standards` / `/spec:standards`。
- 已有 deterministic fact script：`skills/spec-standards/scripts/prepare-baseline.js`。
- 已支持或计划生成：
  - `project-shape.json`
  - `standards-plan.json`
  - `glue-map.json`
  - `standards-update-decision.json`
  - `graph-query-index.json`
  - `standards-sources.json`
  - `import-lock.json`
  - `imported-standards.json`
- 已明确 `Scripts prepare, LLM decides`。
- 已明确 `Observed is not confirmed`。
- 已明确默认不写 `repo-profile.yaml`。
- 已有 contract tests 验证 baseline / quick / refresh / deep / import-source / child repo 边界。

所以它不是空想，骨架是成立的。

但用户强感知还不够，因为最关键的后半段还没有稳定闭环：

```text
standards-candidates.json
standards-preview.md
downstream workflows consume validated baseline
```

也就是说，现在它能准备事实，但还不能稳定交付一份用户和下游 workflow 都敢信的 standards baseline。

## 继续投入的边界

值得继续做，但只值得做最小闭环。

当前不值得做：

- shared standards 远程 Git 拉取和升级系统；
- monorepo module 级完整 standards；
- multi-repo workspace glue-map；
- drift engine；
- review / compound 自动反哺；
- repo-profile apply；
- domain lens 大全；
- standards 平台化目录。

这些会把它推向过度设计。

当前必须做的是 20% 的机制，解决 80% 的质量问题：

```text
fact artifacts
  -> candidate validator
  -> preview checker
  -> downstream consumption contract
```

## 下一步建议

下一阶段应按 `docs/plans/2026-05-05-001-feat-standards-artifact-quality-gates-plan.md` 执行，不扩大范围。

### 1. 先做 `validate-artifacts.js`

新增：

```text
skills/spec-standards/scripts/validate-artifacts.js
```

只校验：

- candidates 顶层字段；
- candidate required fields；
- allowed statuses；
- allowed source types；
- evidence 非空；
- `status_counts` 一致；
- `conflicts` / `unknowns` 引用一致；
- `confirmed` 只能来自 `repo_profile_confirmed` 或 `user_input`；
- 非 confirmed candidate 不能进入 patch。

不做语义判断。

### 2. 再做 preview checker

`standards-preview.md` 必须暴露：

- detected project shape；
- artifact plan；
- evidence quality；
- candidates by status；
- conflicts；
- unknowns；
- downstream consumption；
- writeback status。

关键是必须说明：

```text
repo-profile.yaml 未被修改
```

### 3. 补小型 fixtures

fixtures 应小而精准：

```text
valid-baseline
missing-graph
imported-standards
conflict-and-unknown
invalid-writeback
```

不要建立大型 standards repo mock。

### 4. 补下游消费 contract

`spec-plan`、`spec-write-tasks`、`spec-work`、`spec-code-review` 必须统一：

- `confirmed` 是 hard context；
- `observed` / `imported` / `suggested` 是 advisory；
- `conflict` / `unknown` 是风险、问题或待确认项；
- `glue-map.json` 用于 reuse-first，不是状态机；
- validator 未通过的 baseline 不能当可信 standards。

### 5. Dogfood 一次

用当前 `spec-first` 自己跑一轮：

```text
prepare-baseline -> LLM candidates/preview -> validate -> plan/work/review consume
```

这一步比继续设计 Phase 2-8 更重要。只有 dogfood 后才能判断哪些 fields 真有用，哪些是设计噪音。

## Go / No-Go 判断

继续投入的条件：

- plan / work / review 使用 standards artifacts 后，明显减少重复读代码；
- review findings 更贴近项目边界，而不是泛泛最佳实践；
- `glue-map.json` 能阻止重复造轮子或绕过 existing capability；
- validator 能挡住至少几类真实坏 candidate；
- 产物体积小，下游不需要全量读大文档。

如果 dogfood 后发现：

- 下游几乎不用这些 artifacts；
- candidates 总是空泛；
- preview 只是重复 `AGENTS.md`；
- validator 只能做形式主义；
- 维护成本高于节省的上下文成本；

那就应停止扩展，只保留 `project-shape.json` + `glue-map.json` 作为轻量 context artifact。

## 最终建议

`spec-standards` 的价值成立，但前提是守住边界：

```text
做：项目事实基线、glue 能力地图、候选规范 preview、质量门、下游消费边界
不做：规范平台、自动裁决、自动写回、多仓治理大系统
```

下一步最正确的动作不是继续讨论大架构，而是实现 `standards artifact quality gates` 这个最小质量闭环。这个闭环完成后，再用一次真实 dogfood 决定是否进入 shared standards、repo-profile apply 或 drift 方向。
