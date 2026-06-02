# spec-first / CRG 统一开发执行清单

> Lifecycle: historical-input / external-reference. 本文保留旧架构、方案、迁移或研究记录；当前 source of truth 以 `docs/README.md`、根目录 README、`docs/05-用户手册/`、`docs/contracts/`、`skills/`、`src/cli/` 和 `CHANGELOG.md` 为准。

日期：2026-04-16  
适用范围：`spec-first` 当前工作树  
文档性质：统一执行清单，不替代分析文档  

---

## 0. 文档定位

本文不是新的分析报告，而是把下面两份已校准文档，收敛成一份**可直接进入开发排期的统一执行清单**：

- `docs/02-架构设计/全局分析/2026-04-16-spec-first-体系完整性与skill执行链路深度审查.md`
- `docs/02-架构设计/全局分析/2026-04-16-crg-代码数据索引基座全局审查与优化方案.md`

这份清单只做三件事：

1. 统一平台级排序与 `CRG` 子系统排序。
2. 把建议落到真实模块、真实文件、真实测试面。
3. 给出可以执行的阶段目标、验收标准、禁止事项。

---

## 1. 输入依据与约束

### 1.1 输入依据

本文只建立在以下事实上：

1. `bin/spec-first.js`、`src/cli/**`、`src/bootstrap-compiler/**`、`src/context-routing/**`、`src/crg/**` 的当前代码实现
2. 当前仓库已有测试与 E2E
3. 当前两份分析文档已经统一口径后的结论

### 1.2 执行约束

当前阶段应遵守下面 6 条约束：

1. 先补底层事实质量，后补平台化外壳。
2. 不以向下兼容为第一约束，当前仍处于开发阶段。
3. 不先扩命令面，不先加更多 workflow 名称。
4. 不先上重型向量基础设施，不先做“看起来很平台”的空壳能力。
5. 每一阶段都必须有代码级验收，不接受纯文档完成。
6. 所有阶段都要避免把 sample/scaffold 进一步固化为长期接口。

补充一条硬约束：

1. `src/`、`skills/`、`templates/`、`agents/`、`.claude-plugin/` 才是源码真源；`.spec-first/`、`.claude/`、`.codex/` 里的运行时副本只能作为验证面，不能作为主要改动目标。

### 1.3 正确总顺序

统一后的正确总顺序只有一条：

```text
[Phase 1 CRG 底座质量]
          |
          v
[Phase 2 Stage-0 真实编译闭环]
          |
          v
[Phase 3 Workflow Runtime 接入]
          |
          v
[Phase 4 Platform 观测与治理]
          |
          v
[Phase 5 研究项 / 终局增强]
```

含义很明确：

1. 没有 `CRG` 高质量事实，就不要先做 Stage-0 智能化。
2. 没有 Stage-0 真实编译闭环，就不要先做统一 runtime registry。
3. 没有统一运行时接入，就不要先做漂亮的 status/dashboard。

---

## 2. 统一阶段总览

| 阶段 | 目标 | 当前优先级 | 结果类型 |
| --- | --- | --- | --- |
| Phase 1 | 把 `CRG` 从“结构可用”提升到“事实质量可靠” | P0 | 代码事实底座 |
| Phase 2 | 把 bootstrap/compiler 从 sample 化推进到真实编译闭环 | P0 | Stage-0 控制面 |
| Phase 3 | 把 Stage-0 / routing / telemetry 接进 workflow 主链 | P1 | 运行时闭环 |
| Phase 4 | 建立统一 registry / status / retention | P2 | 平台治理与观测 |
| Phase 5 | 推进终局研究项，但不阻塞主线交付 | Research | 增强项 |

### 2.1 阶段交接 Contract

为了避免阶段之间直接耦合源码内部实现，这份方案要求每个阶段都输出**稳定、machine-readable 的交接契约**。

| 上游阶段 | 下游阶段 | 必须交接的稳定产物 | 说明 |
| --- | --- | --- | --- |
| Phase 1 `CRG` | Phase 2 Stage-0 compiler | `.spec-first/graph/current.json`、`.spec-first/graph/last-known-good.json`、`input-fingerprints.json`、新增 `stage0-handoff.json` | Phase 2 不应直接把 `graph.db` 表结构当契约 |
| Phase 2 Stage-0 compiler | Phase 3 Workflow Runtime | `context-routing.json`、`artifact-manifest.json`、`freshness.json`、`ownership.json`、`review-queue.json`、`minimal-context/*.json`、`docs/contexts/<slug>/*` | Phase 3 只消费 control-plane 与 durable docs，不直接回推 sample 逻辑 |
| Phase 3 Workflow Runtime | Phase 4 Platform Governance | telemetry records、selected assets contract、fallback reason contract、workflow artifact classification | Phase 4 只聚合稳定运行时语义，不自造另一套 workflow 状态语义 |

### 2.2 `CRG -> Stage-0` 交接契约

这是当前整套方案最关键的新增要求。

Phase 1 结束前，必须新增一份稳定 handoff artifact，建议位置：

- `.spec-first/graph/stage0-handoff.json`

该 artifact 在当前代码中**尚不存在**，因此它是本清单新增要求，不是现状描述。

该交接契约最少应包含：

1. `schema_version`
2. `generated_at`
3. `generation_id`
4. `graph_current_pointer`
5. `last_known_good_pointer`
6. `graph_last_built`
7. `db_path`
8. `node_count`
9. `edge_count`
10. `community_count`
11. `flow_count`
12. `unresolved_edge_count`
13. `parse_quality`
14. `code_role_coverage`
15. `health_status`
16. `support_state`

硬规则：

1. Phase 2 优先消费该 handoff artifact，而不是直接读取 `graph.db` 内部表结构作为跨阶段契约。
2. `graph.db` 可以继续作为实现层数据源，但不能再充当阶段边界上的唯一 contract。
3. 若 handoff artifact 缺失或降级，Phase 2 必须显式进入降级语义，而不是隐式兜底。

### 2.3 全局测试矩阵

为了让这份清单可以直接执行，测试矩阵统一收敛为 5 层：

| 层级 | 目标 | 当时入口（历史） |
| --- | --- | --- |
| Unit | 守住模块级行为与 contract | `tests/unit/*.test.js` |
| Contract | 守住 machine-readable 输出约束 | `tests/contracts/*.test.js`、`tests/unit/spec-graph-bootstrap-contracts.test.js` |
| Smoke | 守住 CLI/runtime 主入口可用性 | `npm run test:smoke` |
| E2E | 守住主链编排与真实运行 | `tests/e2e/*.sh`、`npm run test:e2e:crg` |
| Benchmark / Regression | 守住 AI 效能不退化（历史方案，当前已退役） | `npm run test:crg:gate`、`npm run test:crg:benchmarks` |

### 2.4 全局量化 Quality Gates

从这一版起，方案不再只接受“定性提升”，还必须接受量化 gate。

当前仓库已有的 baseline gate 来源于：

- `benchmarks/regression/baselines.json`
- `npm run test:crg:gate`
- `npm run test:crg:benchmarks`

当前 baseline 为：

1. `review_average_hit_rate >= 0.75`
2. `repo_qa_average_hit_rate >= 0.70`
3. `context_efficiency_irrelevant_ratio <= 0.85`
4. `fallback_rate <= 0.10`

规则：

1. Phase 1 结束时，`test:e2e:crg` 与 `test:crg:gate` 都必须通过。
2. 涉及 routing / retrieval / Stage-0 选路语义的变更，不允许使上述 4 个指标退化出 baseline。
3. 若引入更高质量 baseline，必须同步更新 `benchmarks/regression/baselines.json`，并在文档里记录是“抬高标准”，不是“放宽标准”。

---

## 3. Phase 1：CRG 底座质量

### 3.1 阶段目标

把当前 `src/crg` 从“结构完整的 v1 基座”推进到“可作为上层 Stage-0 / review / routing 可靠输入”的事实底座。

本阶段只做 4 件大事：

1. 补强语义关系生产
2. 引入 `code_role` 分层
3. 强化 generation health gate
4. 控制热点文件复杂度

### 3.2 主要改动模块

- `src/crg/artifact-paths.js`
- `src/crg/parser.js`
- `src/crg/graph.js`
- `src/crg/migrations.js`
- `src/crg/cli/build.js`
- `src/crg/generations/health.js`
- `src/crg/generations/paths.js`
- `src/crg/generations/rollback.js`
- `src/crg/cli/postprocess.js`
- `src/crg/retrieval/*.js`
- `src/crg/commands/*.js`

### 3.3 任务拆解

#### 任务 1：补语义关系生产

目标：

1. 让 `CRG` 不再只有 `imports_from / contains / calls / defined_in`
2. 先把最有价值、最容易被上层直接消费的语义边补齐

第一批建议边：

1. `inherits`
2. `implements`
3. `tested_by`
4. `exports`
5. `route_to`

执行要求：

1. 先从现有 `parser.js` 拆出 relation extraction 边界
2. 先保证 JS/TS 路径落地
3. 再为 Python / Go / Java / Ruby / Swift / Kotlin / C# 补“最小可用调用边”

#### 任务 2：引入 `code_role`

目标：

把“是否入图”升级为“入图后属于什么代码角色”。

第一版角色集：

1. `product`
2. `test`
3. `fixture`
4. `tooling`
5. `workflow_runtime`
6. `knowledge_script`

执行要求：

1. `nodes` 或关联表中必须有稳定角色信息
2. `context / review-context / retrieval pack` 默认按角色加权
3. 不采用“简单排除 tests/skills”这种破坏完整性的做法

#### 任务 3：强化 generation health gate

目标：

让 generation 真正成为质量门，而不是只看 `db exists + nodeCount > 0`。

最少纳入指标：

1. `node_count > 0`
2. `edge_count > 0`
3. `unresolved_edge_rate`
4. `parse_error_count / no_parser_count / module_only_count`
5. `fts_row_mismatch == 0`
6. `orphan_edges == 0`
7. `community_count > 0`
8. `flow_count > 0` 或显式允许为空的条件

运行时要求：

1. 健康通过才 `promote`
2. 健康失败要接入 `discardFailedGeneration()`
3. 失败原因写入结构化输出

#### 任务 4：拆热点模块

目标：

避免 `parser.js`、`cli/build.js`、`cli/query.js` 继续膨胀。

最小拆分边界：

1. `parser` 拆为语言提取层与 relation extraction 层
2. `build` 拆为输入收敛、增量检测、图写入、后处理、健康评估
3. `query` 拆为 pattern-specific handlers

#### 任务 5：新增 `CRG -> Stage-0` 稳定 handoff contract

目标：

让 `CRG` 不再只通过 `graph.db` 和 CLI 临时输出向 Stage-0 暴露事实，而是形成稳定交接面。

最少要求：

1. 在 `.spec-first/graph/` 下新增稳定 handoff artifact
2. handoff artifact 字段覆盖图状态、质量状态、支撑状态
3. `build` 主链写出该 artifact
4. generation promote / rollback 语义与 handoff artifact 对齐

禁止做法：

1. 让 Phase 2 直接绑定 `graph.db` 表结构
2. 让 compiler 依赖 `crg stats` 的字符串摘要当契约

### 3.4 本阶段禁止事项

1. 不先引入重型 vector DB
2. 不先做“统一平台引擎”抽象
3. 不先扩更多 `crg` 命令
4. 不先做 UI dashboard

### 3.5 测试与验收

必须补的测试面：

1. `tests/unit/crg-*.test.js`
2. `tests/contracts/crg-cli-v1.test.js`
3. `tests/e2e/crg-all-commands.sh`
4. `tests/e2e/crg-sqlite-audit.sh`
5. `npm run test:crg:gate`
6. `npm run test:crg:benchmarks`

通过标准：

1. 新增边可被 query / architecture / review-context 消费
2. `review-context` 输出中，非核心角色噪声显著下降
3. generation 健康失败时不会 promote 失败产物
4. `stage0-handoff.json` 或等价稳定 handoff artifact 可被下游直接消费
5. `test:e2e:crg`、`test:crg:gate`、相关 benchmark 不退化
6. 相关单测、E2E、SQLite 审计全通过

---

## 4. Phase 2：Stage-0 真实编译闭环

### 4.1 阶段目标

把当前 `bootstrap-compiler` 从“控制面骨架已存在，但内容仍有 sample/scaffold 痕迹”推进到“真实消费 `CRG` 事实生成 Stage-0 产物”。

### 4.2 主要改动模块

- `src/bootstrap-compiler/run-bootstrap.js`
- `src/bootstrap-compiler/orchestrator.js`
- `src/bootstrap-compiler/compile-machine-artifacts.js`
- `src/bootstrap-compiler/compile-human-assets.js`
- `src/bootstrap-compiler/compile-minimal-context.js`
- `src/bootstrap-compiler/compile-routing.js`
- `src/bootstrap-compiler/freshness.js`
- `src/bootstrap-compiler/lint.js`
- `src/bootstrap-compiler/contradictions.js`
- `src/bootstrap-compiler/ownership.js`
- `src/bootstrap-compiler/ownership-registry.js`
- `src/bootstrap-compiler/review-queue.js`
- `src/bootstrap-compiler/review-queue-state.js`
- `src/bootstrap-compiler/rollback.js`
- `src/bootstrap-compiler/schema-loader.js`
- `src/bootstrap-compiler/workspace-compiler.js`
- `src/bootstrap-compiler/sample-generator.js`

### 4.3 任务拆解

#### 任务 1：用真实 `CRG` 输入替换 sample manifest

目标：

让 `artifact-manifest.json` 不再主要依赖 sample 数据，而是来自真实图事实。

最小要求：

1. 接入 `graph_last_built`
2. 接入 `node_count / edge_count / unresolved metrics`
3. 接入主要 communities / flows / risk 指标
4. 接入最小可用的 quality / support 状态，避免 manifest 继续只表达“有图”而不表达“图是否可信”

#### 任务 2：用真实分析结果替换 placeholder docs

目标：

让 `docs/contexts/<slug>/` 的内容不再只是占位式结构，而是可持续消费的真实上下文。

最少应生成：

1. `00-summary.md`
2. `architecture/*`
3. `code-facts/*`
4. `pitfalls/*`
5. `injection-index.yaml`

要求：

1. 文档内容必须和编译输入一一对应
2. 不再依赖 `DEFAULT_CONTEXT_DOCS` 风格的 placeholder

#### 任务 3：基于真实产物生成 routing

目标：

让 `compileRouting()` 不再直接生成 sample routing。

最少输入：

1. 真实产物存在性
2. freshness 信息
3. 风险信号
4. `CRG` 支撑状态

#### 任务 4：把 ownership / review-queue 从 sample 化推进到真实编译结果

目标：

让 control-plane 里的 `ownership.json`、`review-queue.json` 不再由 sample generator 直接兜底，而是基于真实产物与真实状态生成。

最少要求：

1. `ownership.json` 通过 `ownership-registry.js` 的结构校验
2. `review-queue.json` 基于真实 asset、freshness、contradictions 构建
3. 不再把 ownership / review-queue 视为“次要附属物”，而是视为 Stage-0 control-plane 的正式组成部分

#### 任务 5：统一 freshness / lint / contradictions / rollback

目标：

让 Stage-0 编译器也有和 `CRG generation` 类似的质量门。

执行要求：

1. freshness 枚举值与 schema 完全一致
2. lint 失败时阻断不健康产物
3. contradictions 成为真实输入，不再只是存在一个报告壳
4. rollback 路径真实可用

### 4.4 本阶段禁止事项

1. 不在 sample generator 上继续叠逻辑
2. 不把 placeholder markdown 当长期稳定接口
3. 不跳过 lint / freshness contract 对齐

### 4.5 测试与验收

必须补的测试面：

1. `tests/e2e/spec-graph-bootstrap-mainline.sh`
2. `tests/unit/spec-graph-bootstrap-compiler.test.js`
3. `tests/unit/spec-graph-bootstrap-contracts.test.js`
4. `tests/unit/stage0-freshness.test.js`
5. 文档产物结构校验

通过标准：

1. `artifact-manifest.json` 明确可追溯到真实 `CRG` 输入
2. `context-routing.json` 不再是 sample 输出
3. `ownership.json`、`review-queue.json`、`lint-report.json`、`contradictions.json` 进入真实编译链，而不是继续主要依赖 sample 输出
4. `docs/contexts/<slug>/` 产物能支撑 plan/work/review 直接消费
5. freshness、lint、ownership、review-queue、rollback 主链可验证
6. compiler 对上游 handoff contract 的消费是稳定字段消费，而不是直接耦合 `graph.db` 内部结构

---

## 5. Phase 3：Workflow Runtime 接入

### 5.1 阶段目标

把 Stage-0 选择、上下文加载、telemetry 记录，从 `SKILL.md` contract 级约定推进到统一运行时默认能力。

### 5.2 主要改动模块

- `src/context-routing/evaluator.js`
- `src/context-routing/fallback.js`
- `src/context-routing/loader.js`
- `src/context-routing/profiles.js`
- `src/context-routing/telemetry.js`
- `src/context-routing/workspace-loader.js`
- `templates/claude/commands/spec/plan.md`
- `templates/claude/commands/spec/work.md`
- `templates/claude/commands/spec/code-review.md`
- `skills/spec-plan/SKILL.md`
- `skills/spec-work/SKILL.md`
- `skills/spec-code-review/SKILL.md`
- `skills/spec-graph-bootstrap/SKILL.md`
- `skills/spec-graph-bootstrap/SKILL.md`
- `src/cli/adapters/codex.js`
- `src/cli/plugin.js`

### 5.3 任务拆解

#### 任务 1：让 evaluator 真正支持 `fact.*`

目标：

从“按 `stage + output_exists` 降级”升级到“按事实裁剪上下文”。

第一批建议规则：

1. `fact.graph_support_state`
2. `fact.code_facts_confidence`
3. `fact.risk_hotspot_exists`

#### 任务 2：提供统一 preload helper

目标：

让 `spec-plan / spec-work / spec-code-review` 调用同一条 Stage-0 装配路径。

要求：

1. 统一调用 `evaluateContextForRepo()`
2. 统一记录 `recordWorkflowTelemetry()`
3. 统一 fallback reason 与 level 语义
4. Claude wrapper、Codex 路径改写、workflow skill 三层入口保持一致，不允许只改 `skills/` 而放任 wrapper / adapter 漂移

#### 任务 3：统一 workflow 产物边界

目标：

让 workflow 对 Stage-0 输入和自身产物有稳定接口。

最少应统一：

1. selected assets
2. telemetry schema
3. fallback reason
4. durable artifact vs ephemeral artifact

#### 任务 4：收敛单仓与 workspace 路径的上下文加载语义

目标：

让 `evaluateContextForRepo()` 与 `workspace-loader` 在 slug 解析、退化语义、状态表达上保持一致。

最少要求：

1. 单仓与 workspace 场景共用同一套 level / fallback reason 语义
2. workspace 下的 repo slug 解析不能偏离单仓路径约定
3. 不让 workspace 支持长期停留在“附属功能、缺少验收”的状态

### 5.4 本阶段禁止事项

1. 不先做复杂 orchestration engine
2. 不先把所有 workflow 都改成 JS 执行器
3. 不先追求“完美统一”，先收敛 plan/work/review 主链

### 5.5 测试与验收

必须补的测试面：

1. `tests/unit/context-routing-evaluator.test.js`
2. `tests/unit/spec-graph-bootstrap-contracts.test.js`
3. `tests/e2e/spec-graph-bootstrap-mainline.sh`
4. `tests/unit/workflow-telemetry.test.js`
5. `tests/unit/workspace-context.test.js`
6. `npm run test:smoke`
7. routing / retrieval 语义变更时同步跑 `npm run test:crg:gate`

通过标准：

1. `spec-plan / spec-work / spec-code-review` 的 Stage-0 预载行为可追踪、可复现
2. `fact.*` 规则至少有一批真实实现，而不是继续进入 `skipped_rules`
3. Claude wrapper、Codex 路径改写、workflow skill 三层入口对同一 Stage-0 语义保持一致
4. workflow telemetry 能统一说明“为什么选了这些上下文”
5. workspace loader 与单仓 loader 使用一致的退化语义
6. 相关 benchmark 指标不低于 baseline

---

## 6. Phase 4：Platform 观测与治理

### 6.1 阶段目标

在底座质量和主链接入成立之后，再做统一 registry、status、retention。

### 6.2 主要改动模块

- `.claude-plugin/plugin.json`
- `src/cli/plugin.js`
- `src/cli/index.js`
- `src/cli/commands/*`
- `src/cli/state.js`
- `src/cli/adapters/*`
- `templates/claude/commands/spec/*.md`
- `skills/spec-*.md`

说明：

1. Phase 4 的源码真源是 `src/`、`templates/`、`skills/`、`.claude-plugin/`
2. `.spec-first/workflows/**`、`.claude/**`、`.codex/**` 只作为运行时验证面和观测面，不作为主要改动目标

### 6.3 任务拆解

#### 任务 1：补 workflow runtime registry

registry 最少应声明：

1. workflow 名
2. backing skill
3. stable artifacts
4. telemetry schema
5. required Stage-0 stage
6. allowed sub-skills / agents

#### 任务 2：新增 `spec-first status`

最少聚合：

1. runtime 同步状态
2. bootstrap freshness
3. graph freshness
4. 最近 workflow telemetry
5. docs/contexts 缺失情况
6. review artifacts / todos 积压

#### 任务 3：统一 retention / cleanup

目标：

让 `clean`、`doctor`、`status` 对 runtime assets、workflow artifacts、telemetry 有统一认识。

### 6.4 测试与验收

必须补的测试面：

1. `npm run test:smoke`
2. `npm run test:integration`
3. 与 `status / registry / cleanup` 对应的新增单测
4. 运行时生成资产的只读校验，确保平台层没有反向修改运行时副本真源语义

通过标准：

1. `status` 能回答“系统当前是否健康”
2. registry 能被 machine-readable 地消费
3. cleanup 不误删 durable artifacts

---

## 7. Phase 5：研究项与终局增强

这一阶段不阻塞主线交付，只能在前四阶段达标后进入。

### 7.1 可进入的方向

1. 真正的 semantic rerank
2. 更强的 hybrid retrieval
3. 入口驱动 flow 建模
4. 跨 repo / workspace / polyrepo 扩展
5. 更细粒度 contract-level dependency extraction

### 7.2 暂不提前进入的方向

1. 重型向量平台化
2. 复杂多宿主统一 orchestration runtime
3. 大规模 UI 产品化壳层

---

## 8. 统一验收口径

整套执行清单完成，不以“代码量”判断，而以 5 个问题回答是否成立判断：

1. `CRG` 产出的事实，是否足够支撑 Stage-0 不再 sample 化。
2. Stage-0 产物，是否足够支撑 plan/work/review 稳定消费。
3. workflow 主链，是否能解释“为什么装配这些上下文”。
4. 平台层，是否能统一说明“当前系统是否健康、哪里退化了”。
5. 整体顺序，是否避免了“先做平台壳、后补底层事实”的过度设计。

只有这 5 个问题都能回答“是”，这条主线才算真正完成。

补充一条最终门：

6. 量化 gate 是否全部通过，且没有通过“放宽 baseline”来制造虚假达标。

---

## 9. 一页式执行图

```text
Phase 1  CRG Fact Quality
  - semantic relations
  - code_role
  - generation gate
  - hotspot split
          |
          v
Phase 2  Stage-0 Real Compiler
  - real manifest
  - real context docs
  - real routing
  - freshness/lint/rollback
          |
          v
Phase 3  Workflow Runtime Integration
  - fact-based evaluator
  - preload helper
  - telemetry normalization
          |
          v
Phase 4  Platform Governance
  - workflow registry
  - spec-first status
  - retention / cleanup
          |
          v
Phase 5  Endgame Research
  - stronger retrieval
  - better flow model
  - cross-repo expansion
```

---

## 10. 最终执行原则

这份清单最后只强调一句话：

**不要把“统一平台外壳”当成当前第一优先级；当前第一优先级始终是底层事实质量。**

如果顺序错了，后面所有 registry、status、dashboard、workflow runtime，都只是在放大底层噪声。  
如果顺序对了，平台层自然会变成对高质量事实的稳定放大器。
