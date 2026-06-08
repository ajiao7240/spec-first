# spec-first 内化集成 `scale-engine` / `project-scaffold` 技术方案

## 0. 方案定位

### 0.0 定位 thesis（先读这一段）

本方案是 `spec-first` v1.x 的**横向基建层**，不是某个功能交付。它把 context / knowledge / memory / governance 沉淀为确定性 facts，目的是抬高**所有下游 workflow** 的输入质量，而不是交付某个面向用户的能力。

2026-06-06 后，本方案的适用范围需要明确限定：

```text
本方案 = v1.x source-first 内化路线
  spec-first owns CLI / source-managed runtime projection
  SCALE / project-scaffold 提供可借鉴能力

不包含 = v2/spec-first-on-scale 换底座路线
  SCALE owns deterministic runtime
  spec-first 降为 skill / agent / workflow content pack
```

换底座可行性见 `2026-06-06-scale底座替换spec-first可行性研究报告.md`；强状态机与轻合同的行业判断见 `2026-06-06-强状态机vs轻合同行业实践调研报告.md`。这两份报告不推翻本方案作为 v1.x 主线的价值，只把“是否让 SCALE 当 runtime owner”提升为独立 v2/spike 决策，禁止与本方案混写。

由此推出三条贯穿全文的判断口径：

- **服务对象是 workflow，不是 end feature**：每个能力的价值，体现在 `spec-prd / plan / work / review / debug / compound` 消费它之后行为变好，而不是 facts 本身被生产出来。
- **两条轴分开看：优先级轴 vs 构建顺序轴**。
  - 优先级轴（哪根柱子最该补）：四问（要解决什么 / 影响哪些文件服务文档 / 哪些验证真跑过 / 哪些该沉淀）是基建四根柱子的质量探针。证据柱（Q3：verification / honest-closeout）优先级最高，因为它当前最具体地缺、且最容易被滥用（谎报验证）。
  - 构建顺序轴（先铺哪块地基）：本方案采用 **infra-first / 先把 readiness 平面铺平，再上应用** 的构建顺序——先建立 dependency/provider readiness baseline 与 doctor 消费（v1.11–v1.12），再在其上交付 verification + honest-closeout（v1.13），最后治理 / 知识 / provider。
  - 两轴的张力是**有意接受的**：优先级最高的证据柱，在构建顺序上排在 readiness 平面之后。原因是 honest-closeout 的诚实 "not-run" 披露依赖工具存在性 readiness 与真实 exit_code capture，把 readiness 平面一次铺平可避免 verification 阶段反复回填零散 readiness。代价是 v1.11–v1.12 本身不是独立兑现信任的里程碑，必须按下一条明确标注。精确的阻塞依赖边（哪部分 readiness 真正硬阻塞 honest-closeout、哪部分只是同批/可并行）以 README「开发顺序的依赖与验收约束」为准：honest-closeout 的硬前置只是 v1.11 的**工具存在性子集**，install safety / configured dependency scan 的完整度不阻塞 honest-closeout。
- **成功标准分两层；不要把 direct consumer 和 workflow consumer 混成一层**：一个 capability 最终只有当至少一个 named workflow 因消费它而产生可观察行为变化时才算兑现 workflow 价值（验收口径见 §9.0.1）。但 **readiness baseline（v1.11–v1.12）是 enabling infrastructure**：v1.11 的 facts 必须先在 v1.12 被 `doctor`（检查命令）直接消费，形成 `decision_input_health` / `decision_input_health_basis`，否则就是无人消费的 facts；随后它面向 workflow 的消费门槛在 v1.13（verification + honest-closeout 接入 `spec-work` closeout）闭合。因此 v1.11 不得单独宣称完成；v1.11+v1.12 可以作为 direct deterministic producer→consumer 切片验收，但不得包装成已独立兑现 workflow 价值的最终里程碑。只生产、且到消费阶段仍无 workflow 行为变化的 facts，视为空转。

读后续章节时，请用"这条能力让哪个 workflow 的输入质量变好"来检验，而不是用"这是不是一个功能"。

### 0.0.1 集成目标与不做项

本方案目标是把 `scale-engine` 的工程治理能力和 `project-scaffold` 的真实项目落地样板，重构为 `spec-first` 的原生能力：

```text
scale-engine 源码能力
+
project-scaffold 项目治理基线
+
spec-first 当前 AI Coding Harness / 双宿主 / workflow contract
=
spec-first Native Governance Facts + Knowledge Harness
```

明确不是：

```text
不是 spec-first 调用 scale CLI。
不是 spec-first 依赖 @hongmaple0820/scale-engine。
不是复制 .scale / .agent / scripts / hooks / 状态机。
不是新增中心化 runtime 来替代 LLM 判断。
```

内化后的核心形态是：

```text
Source contracts
  定义 schema、边界、source/runtime/provider 关系。

Deterministic helpers
  产出路径、hash、readiness、freshness、exit code、reason_code、artifact refs。

Workflow consumption
  spec-prd / plan / work / review / debug / compound 读取 facts，再由 LLM 做语义判断。
```

这与当前 `spec-first` 角色契约保持一致：`Light contract + Explicit boundaries + Scripts prepare, LLM decides`。

## 0.1 本轮校准方法

用户要求“不要抽查代码”，因此本轮校准不以少量示例文件作结论，而采用：

| 范围 | 已建立的证据方式 | 用途 |
| --- | --- | --- |
| `spec-first` 当前仓库 | 覆盖 `src/cli`、`src/verification`、`docs/contracts`、`skills`、`agents`、`docs/10-prompt` 等 source/contract/skill 承载面 | 判断当前可承载边界、不能重复建设的 runtime truth |
| `/Users/kuang/xiaobu/scale-engine/src` | 全量 inventory：306 个 TypeScript 文件；按章节精读 workflow/runtime/context/bootstrap/codegraph/guardrails/evolution/memory/knowledge/skills/adapters/cortex/shield 等关键实现 | 提取可借鉴能力和不可照搬的强 runtime 部分 |
| `/Users/kuang/xiaobu/project-scaffold` | 覆盖仓库文件清单和隐藏治理目录；精读 README、AGENTS、CONTEXT、`.agent/project.json`、`.scale/*.json`、workflow/gates/bootstrap 脚本 | 提取真实项目治理基线、安装/验证/门禁语义 |

本方案中的“证据”均指本地源码路径，不再用外部 GitHub 页面作为判断依据。

## 0.2 逐章校准矩阵

| 章节 | 校准结论 | 当前源码证据 | 改造口径 |
| --- | --- | --- | --- |
| 1 总体架构 | 不能新增 `Native Governance Runtime` 中心层 | `docs/contracts/ai-coding-harness.md` 已有 Context / Execution / Evidence / Evaluation / Governance / Knowledge 六层 Harness；`docs/10-prompt/结构化项目角色契约.md` 拒绝中心化流程引擎 | 架构改为 Harness contracts + facts producers + optional providers |
| 2 能力拆解 | SCALE 能力可吸收，但要分为 current / near-term / future | `scale-engine/src/runtime/*`、`src/context/*`、`src/bootstrap/*`、`src/codegraph/*`、`src/guardrails/*`、`src/memory/*`；`project-scaffold/.agent/project.json`、`.scale/*.json`、`scripts/gates/*` | 每个能力标注 source 证据、spec-first 映射、成熟度和不做项 |
| 3 源码结构 | 近期不创建大顶层 `src/runtime`、`src/context-intelligence` | `spec-first` 当前相关实现集中在 `src/cli/commands`、`src/cli/helpers`、`src/verification`、`docs/contracts` | 先扩展 helper/contract；顶层模块作为 contract 稳定后的晋升候选 |
| 4 核心模块 | task level、verification、ledger、guard 都应是 facts/lens | `TaskLevelDetector.ts` 会直接 classify；`spec-first` 需要保留 LLM 裁决；`spec-work-run-artifact.js` 已有 immutable artifact | 改为 signals、run summary、honest closeout、gate lens，不建平行 truth |
| 5 Context Intelligence | code-graph / project-graph 是研发人员自管的 capability tools，spec-first 不拥有其生命周期（详见 `CodeGraph技术方案.md`） | `scale-engine/src/codegraph/CodeIntelligence.ts` 明确 provider + fallback；`spec-runtime-setup`（alias `spec-mcp-setup`）只 owns setup facts；memory 能力与 `docs/solutions/` 重叠，默认不集成 | spec-first 只认能力类别、不认具体 provider；外部能力输出是 advisory candidate，source-read 才确认 |
| 6 Workflow 接入 | 接入现有公开 workflow 名称，不引入不存在的统一 review workflow | 当前 skills 有 `spec-code-review` / `spec-doc-review` / `spec-work` / `spec-compound` 等 | 每个 workflow 消费同一 facts envelope，不新建流程状态机 |
| 7 Contract / Schema | 第一批 contract 要少而硬 | 当前已有 `context-bundle`、`artifact-summary`、`verification-evidence`、`spec-work-run-artifact` | 先加 readiness / verification / governance signals / honest closeout，其他后置 |
| 8 实施路线 | 原六阶段太像一次性平台化 | 当前 `doctor`、`init`、`mcp-setup` 已承载 setup/readiness；路线文档已规划 v1.11-v2.0 | 路线重排为 readiness -> verification -> governance lens -> knowledge -> provider -> platform |
| 9 测试策略 | 不应先测试不存在的 JSONL ledger | 当前测试结构是 unit/smoke/integration，schema 在 `docs/contracts/**`、`src/cli/contracts/**` | 第一批测试锁定 schema、doctor/mcp-setup facts、run artifact、not-run reason |
| 10 优先级 | 先解决交付可信度，再做智能 provider | `project-scaffold` 四问强调“真实运行过什么”；`spec-first doctor` 已有 workflow_runnability/evidence freshness | P0 是 dependency readiness、verification summary、honest closeout |
| 11 结论 | 可整体借骨架，不可整体搬 runtime | `scale-engine/docs/workflow/知识相关.md` 是层次说明；`project-scaffold` 是可复制治理基线 | 内化为 spec-first 六层 Knowledge Harness 与治理 facts |

## 0.3 Source / Runtime / Provider 边界

本方案所有落地都必须遵守当前 `spec-first` 边界：

| 边界 | 规则 |
| --- | --- |
| Source-of-truth | 修改 `skills/`、`agents/`、`templates/`、`src/cli/`、`src/verification/`、`docs/contracts/`、`docs/`、`README*`、`AGENTS.md`、`CLAUDE.md` |
| Generated runtime | 不手改 `.claude/`、`.codex/`、`.agents/skills/`；需要刷新时运行 `spec-first init` |
| Workflow artifacts | `.spec-first/workflows/**`、`docs/validation/**`、`docs/solutions/**` 是 evidence / knowledge，不是行为 source |
| Provider facts | code-graph / project-graph / memory 能力、MCP / browser / shell 输出默认都是 advisory，必须带 freshness、fallback、limitations 和 source-read requirements；setup 可帮装（过 gate），但消费侧只认能力类别、不注入编排面、刷新归工具 |
| LLM judgment | scope、架构、review finding、root cause、是否足够验证，由 workflow LLM 和用户最终判断 |

## 0.4 产物归属与命名总表（single source map）

本表是父方案与两份子方案（`CodeGraph技术方案.md`、`project-scaffold依赖安装流程与spec-first-setup优化技术方案.md`）共享的**唯一命名与路径事实源**。三份文档若与本表冲突，以本表为准；新增产物必须先在此登记，避免出现第二套路径或第二套词表。

### 0.4.1 产物路径归属（四类）

| 产物类别 | owner | canonical 路径 | 是否 checked-in | gitignore |
| --- | --- | --- | --- | --- |
| Contract schema | 父方案 §7.1 | `docs/contracts/**/*.schema.json`（唯一 schema source） | 是 | 否 |
| Tool/provider registry | project-scaffold 子方案 §4.2/§4.3 | `skills/spec-mcp-setup/helper-tools.json`、`skills/spec-mcp-setup/provider-tools.json` | 是 | 否 |
| Verification profile 实例 | project-scaffold 子方案 §4.4 | `spec-first.verification.json`（repo root） | 是（团队 source） | 否 |
| Profile 本地覆盖 | project-scaffold 子方案 §4.4 | `.spec-first/verification-profile.local.json` 或 `.spec-first/config.local.yaml` | 否 | 是 |
| 生成/本地 facts | `spec-runtime-setup`（alias `spec-mcp-setup`） | `.spec-first/config/*.json`（`tool-facts`、`runtime-capabilities`） | 否 | 是 |
| Workflow run evidence | `spec-work` | `.spec-first/workflows/**` | 否 | 是 |

### 0.4.2 统一命名（避免三份漂移）

| 维度 | 唯一取值 | 反例（不再使用） |
| --- | --- | --- |
| 依赖/能力 profile | `minimal` / `recommended` / `platform` | 不使用 `team`（统一为 `platform`） |
| Provider readiness（机械轴 A，§5.4） | `fresh` / `stale` / `degraded` / `not-run` / `unknown` | 不使用 `unavailable`（归入 `not-run`）、不使用 9 值生命周期词表 |
| Provider 生命周期阶段 | 各自布尔位，完整集合以父方案 §7.1 canonical 的 `lifecycle` 对象为准（`installed` / `configured` / `initialized` / `indexed` / `server_reachable` / `artifact_exists` / `query_verified` / `fallback_used`） | 不塞进 readiness enum、不在引用处私自增减位 |
| Evidence trust（语义轴 B，§5.4） | `advisory` / `evidence_candidate` / `confirmed_context` / `durable_knowledge` / `governance_rule` | 不写进 readiness 字段、不与轴 A 混用 |
| 场景能力 | scenario overlay（`surface-ui` / `surface-data-security`），与 profile 正交 | 不把场景能力塞进 profile |
| 入口命令名（required harness runtime setup workflow） | canonical：`$spec-runtime-setup` / `/spec:runtime-setup`；deprecated alias：`$spec-mcp-setup` / `/spec:mcp-setup`（迁移期保留） | 不再把 `spec-mcp-setup` 作为 canonical 入口名；不引入第三个入口别名 |

> 关键收敛：verification-profile 实例统一为 repo root 的 `spec-first.verification.json`（不是 `.spec-first/config/*.json`，因为后者已被 gitignore 用于生成 facts）。Provider readiness 统一为轴 A 5 值，生命周期用布尔位表达，二者不混。第三个 profile 统一叫 `platform`。

> 入口命令名重命名边界（钉死）：本轮采纳把 required harness runtime setup workflow 的 **canonical 入口名**定为 `spec-runtime-setup`，理由是它治理的是 spec-first required harness runtime readiness（MCP + helper + provider + host config），不只是 MCP；`spec-mcp-setup` 降级为迁移期 deprecated alias。**入口命令名**与 **source 实体路径**分两层处理：
> - 入口命令名（用户在 workflow 入口键入的 `$...` / `/spec:...`）：三份文档统一引用 canonical 新名，旧名只在迁移说明里出现。
> - source 实体路径（当前磁盘真实路径，如 `skills/spec-mcp-setup/SKILL.md`、`skills/spec-mcp-setup/*.json`、`templates/claude/commands/spec/mcp-setup.md`）：在实际 source 重命名 work 任务落地前，**文档继续引用现有真实路径**，不预先改成尚不存在的 `skills/spec-runtime-setup/` 路径，避免文档引用失真。
> - source 目录 / command 文件 / CLI adapter / bootstrap 锚点的实体重命名是后续独立 work 任务（中型，需双宿主验证 + 测试回归），不在本轮文档修订范围。

### 0.4.3 Schema 单一定义规则

为防止"同名 versioned schema 在不同章节被各写一遍、字段形状漂移"，三份文档遵守：

- **每个 `*.v1` schema 只有一处 canonical 字段定义**，由下表登记 owner；其余位置只能引用，不得重写字段。
- canonical 定义给出完整字段；引用处只描述消费方式或落点，不复制字段结构。
- 若需要扩展字段，改 canonical 定义并 bump 版本，不在引用处私自加字段。

| Schema | canonical 定义位置 | 引用位置（不得重定义字段） |
| --- | --- | --- |
| `verification-profile.v1` | `docs/contracts/verification/verification-profile.schema.json` | 父方案 §4.3、project-scaffold 子方案 §4.4 |
| `verification-run-summary.v1` | `docs/contracts/verification/verification-run-summary.schema.json` | 父方案 §4.4、project-scaffold 子方案 §4.5 |
| `honest-closeout.v1`（claim 校验模型） | `docs/contracts/workflows/honest-closeout.schema.json` | 父方案 §4.6、project-scaffold 子方案 §4.6（字段映射面） |
| `provider-readiness.v1` | 父方案 §7.1（落盘到 `docs/contracts/provider-readiness.md` / `.schema.json`） | project-scaffold 子方案 §4.3、CodeGraph 子方案 §5.1/§7 |
| `decision_input_health_basis` | project-scaffold 子方案 §5.3 | project-scaffold 子方案 §4.1.1 |
| `helper-tools-registry.v1` | 字段 canonical 现为 project-scaffold 子方案 §4.2；落盘到 `docs/contracts/helper-tools-registry.schema.json`（v1.11 实现后按 schema 文件转 canonical、§4.2 转引用） | Setup_Scripts、`check-health`、`verify-tools`（从 registry 派生，不重定义字段） |
| `tool-facts.v2` | 落盘到 `docs/contracts/tool-facts.schema.json`（v1.11 新增；含 v1 兼容说明） | `write-setup-facts`、Facts_Normalizer、`doctor` decision_input_health rollup |
| `spec-work-run-artifact/v2` | `docs/contracts/workflows/spec-work-run-artifact.schema.json`（v2 写入；v1 read/prune 兼容） | 父方案 §4.5、project-scaffold 子方案 §4.6 |
| `task-governance-signals.v1` | `docs/contracts/governance/task-governance-signals.schema.json` | 父方案 §4.1、`spec-plan` Phase 0.6、`spec-work` / `spec-code-review` diff-time advisory |
| `gate-lens-taxonomy.v1` | `docs/contracts/governance/gate-lens-taxonomy.schema.json` | 父方案 §4.7、task/resource governance advisory 命名 |
| `rule-maturity.v1` | `docs/contracts/governance/rule-maturity.schema.json` | 父方案 §4.7、v1.17 Governance Maturity |
| `resource-governance-lens.v1` | `docs/contracts/governance/resource-governance-lens.schema.json` | 父方案 §4.8、`spec-work` closeout、`spec-code-review` resource advisory |

---

# 1. 总体架构

## 1.1 校准后的分层

```text
┌────────────────────────────────────────────────────────────┐
│ spec-first Workflow Layer                                  │
│ spec-prd / spec-plan / spec-work / spec-code-review         │
│ spec-doc-review / spec-debug / spec-compound / setup/update │
└──────────────────────────────┬─────────────────────────────┘
                               │ consumes
┌──────────────────────────────▼─────────────────────────────┐
│ Native Governance Facts                                      │
│ task signals / verification summary / readiness / evidence   │
│ gate lens / rule maturity / honest closeout / resource facts │
└──────────────────────────────┬─────────────────────────────┘
                               │ references
┌──────────────────────────────▼─────────────────────────────┐
│ AI Coding Harness Contracts                                 │
│ Context / Execution / Evidence / Evaluation / Governance /   │
│ Knowledge contracts, schemas, source-runtime boundaries      │
└──────────────────────────────┬─────────────────────────────┘
                               │ optionally enriched by
┌──────────────────────────────▼─────────────────────────────┐
│ Capability tools（setup 帮装,消费 capability-aware 不耦合）   │
│ code-graph / project-graph 能力 / source-scan fallback       │
│ advisory candidate facts only; spec-first 只认能力类别        │
└──────────────────────────────┬─────────────────────────────┘
                               │ projected through
┌──────────────────────────────▼─────────────────────────────┐
│ Host / Project Baseline                                      │
│ AGENTS / CLAUDE / skills / agents / templates / init / doctor│
│ optional project context map / optional provider profile     │
└────────────────────────────────────────────────────────────┘
```

## 1.2 与当前 `spec-first` 的对齐

当前 `spec-first` 已经不是 prompt pack，而是 AI Coding Harness：

- `docs/contracts/ai-coding-harness.md` 已定义六层 Harness。
- `src/cli/commands/init.js` 负责 source-managed host runtime 投影。
- `src/cli/commands/doctor.js` 已区分 install health、runtime asset health、host readiness、workflow runnability 和 verification evidence freshness。
- `src/cli/helpers/spec-work-run-artifact.js` 已有 immutable run artifact、`script_confirmed`、`provider_untrusted`、`direct_evidence_used`。
- `src/cli/helpers/context-bundle.js` 已有 runtime/generated path exclusion、budget、reason_code。
- `skills/spec-mcp-setup/SKILL.md` 已把 MCP/helper setup 定位为 deterministic readiness facts，而非语义代码理解权威。

因此，SCALE 融合的正确方向是增强这些 Harness 层，而不是新增一套平行的 `.scale` runtime。

> v2 分叉说明：如果未来启动 `spec-first-on-scale`，则不是“新增一套平行 `.scale` runtime”，而是产品边界切换为 **SCALE 单独 owns runtime、spec-first owns content**。该分叉必须单独做 manifest / dry-run projection / compatibility bridge，不属于本文 v1.x 内化实施范围。

---

# 2. 能力拆解：哪些该内化进 spec-first

## 2.1 从 `scale-engine` 内化的能力

| scale-engine 能力 | 本地源码证据 | spec-first 内化方式 | 优先级 | 不照搬项 |
| --- | --- | --- | --- | --- |
| Task Level | `src/workflow/TaskLevelDetector.ts` | `task-governance-signals.v1`：输出 signals / candidate_level / reason_codes | P1 | 不让脚本直接决定最终任务等级 |
| Verification Commands/Profile | `src/workflow/VerificationCommands.ts`、`VerificationProfile.ts` | `verification-profile.v1` + `verification-run-summary.v1` | P0 | 不硬编码业务命令，不把 dry-run 写成通过 |
| Runtime Evidence | `src/runtime/RuntimeEvidenceLedger.ts`、`ExecutionLedger.ts`、`SessionLedger.ts` | 先扩展 `spec-work-run-artifact` 与 verification evidence；缺口明确后再做事件 ledger | P1 | 不建与 run artifact 竞争的 truth |
| Final Report Guard | `src/runtime/FinalReportGuard.ts`、`RuntimeDoctor.ts` | `honest-closeout.v1`，检查 claim 是否有 evidence refs | P0 | 不用自然语言正则替代 evidence model |
| Dependency Bootstrap | `src/bootstrap/DependencyBootstrap.ts` | `spec-runtime-setup`（alias `spec-mcp-setup`）/ `doctor` 的 install plan、explicit apply、post-check facts | P0 | 不默认全装 memory/knowledge/ui/full pack |
| Context Budget/Compiler | `src/context/ContextBudget.ts`、`ContextCompiler.ts`、`ContextBuilder.ts`、`ProjectAnatomy.ts` | 增强 `context-bundle` / `artifact-summary` 的 budget、included/omitted reason | P1 | 不把 ContextBuilder 变成强 system rules 注入器 |
| Code Intelligence | `src/codegraph/CodeIntelligence.ts` | 通用 `provider-readiness.v1` 槽位先服务 v1.11/v1.12；code-graph 能力（如研发人员自管的 CodeGraph）按 capability-class 协同，spec-first 不拥有其生命周期（见 `CodeGraph技术方案.md`） | P0 通用 readiness / capability-aware 协同 | 只认能力类别不认 provider；外部输出不拥有 finding/root-cause authority |
| Memory Providers | `src/memory/MemoryProviders.ts`、`GbrainRuntime.ts` | file-first memory boundary 服务 Knowledge Harness；memory 能力默认走 `docs/solutions/`，外部 memory 工具不集成（与 docs/solutions 重叠，见 `CodeGraph技术方案.md` §4.3） | P2 harness | 不自动写长期记忆，不把 recall 当事实 |
| KnowledgeBase/Graphify | `src/knowledge/KnowledgeBase.ts`、`GraphifyKnowledgeBase.ts` | `docs/solutions/` promotion 属 Knowledge Harness；project-graph 能力（如研发人员按当前需求 workspace 临时生成的 Graphify 上下文）当 run-scoped 架构导航读，spec-first 不拥有其生命周期 | P2 harness / capability-aware 协同 | 不引入 SQLite 作为默认 source truth；不把 run-scoped 产物升级为 source truth |
| Guardrails/Gates | `src/guardrails/GateEvaluator.ts`、`ReviewEnforcer.ts`、`OWASPDetector.ts` | governance lens + RuleMaturity | P1 | 不默认 blocking，不把安全正则当最终审计 |
| Rule Evolution | `src/evolution/RuleMaturity.ts` | shadow/advisory 先服务 v1.14 foundation；required-evidence / blocking candidate 到 v1.17 maturity | v1.14 foundation / v1.17 maturity | blocking 必须有人审和误报证据 |
| Out-of-scope | `src/workflow/OutOfScopeStore.ts` | rejected/out-of-scope rationale 作为 plan/review advisory boundary evidence | P1 | 不当 workflow 状态或 approval |
| Diff Test Selector | `src/testing/DiffTestSelector.ts` | affected-test candidate facts | P2 | 不把未确认依赖图当测试覆盖证明 |
| Cross-model Review | `src/review/CrossModelReviewer.ts` | 可借鉴 consensus/dedup 思路到 review synthesis | P3 | 不默认多模型外部调用 |
| Agent/Skill Runtime | `src/agents/*`、`src/skills/*` | 借鉴 skill registry / radar 元数据；继续使用 spec-first source skills/agents | P2 | 不引入强 skill router 替代 workflow 判断 |
| Cortex 自进化 | `src/cortex/InstinctExtractor.ts`、`ReflexionEngine.ts`、`SessionInjector.ts`、`GovernanceMetrics.ts` | **non-goal（近期不内化为 runtime）**：拒绝 observe→reflect→extract→SessionStart 自动注入闭环。理由：（1）自动写长期记忆 + 自动注入 system 违反本方案 source-first / 不自动写长期记忆原则；（2）spec-first 已有 `docs/contracts/workflows/self-reflection-capability-upgrade.md` 承载自反思能力，按"先验证再沉淀"走人审 promotion，不需要平行 runtime；（3）`GovernanceMetrics` 的治理 ROI 度量思路可在 P2+ 借鉴为 advisory metrics（见 §10 量化验收），但不引入 daemon | non-goal / P2-advisory | 不引入 Instinct daemon、不自动注入 SessionStart、不把 reflection 当 durable knowledge |
| Shield 钩子拦截 | `src/shield/PolicyCompiler.ts`、`ProtectedPaths.ts`、`ShieldProtocol.ts` | **non-goal（不内化为 blocking hook 引擎）**：拒绝 compile policy→hook 脚本→拦截。理由：（1）blocking pre-tool hook 与本方案 advisory-first / `blocking 默认关闭`（§4.7）和角色契约"不替代 LLM 判断"冲突；（2）`ProtectedPaths` 的 path containment 思路已由 `spec-work-run-artifact` 的 containment 校验和 secret-deny-patterns 覆盖（见 §3.4）；（3）双宿主下拦截应由各 host 自己的 hook 机制承担，不由 spec-first 建中心拦截引擎 | non-goal | 不复制 policy-compiled blocking hook、不建中心拦截引擎、不接管 host hook |

## 2.2 从 `project-scaffold` 内化的能力

| project-scaffold 能力 | 本地源码证据 | spec-first 内化方式 | 优先级 | 不照搬项 |
| --- | --- | --- | --- | --- |
| Closeout 四问 | `README.md` | final response / work artifact 必须回答目标、影响面、验证、沉淀边界 | P0 | 不生成冗长流程负担 |
| S/M/L/CRITICAL | `README.md`、`AGENTS.md` | task governance signals + workflow-confirmed level | P1 | 不让等级成为强状态 |
| Verification profile | `.agent/project.json` | `verification-profile.v1`，服务、profile、checks、required_tools 分离 | P0 | 不把 `.agent` 作为 source |
| Verify runner | `scripts/workflow/verify.sh` | missing tool -> not-run/failed reason；command log refs | P0 | 不自动安装工具 |
| Gates G0-G22 | `scripts/gates/*.sh`、`scripts/gates/all.sh` | 归并为 gate lens families + RuleMaturity | P1 | 不机械 JS 化 23 个 gate |
| Dry-run 语义 | `scripts/gates/all.sh --dry-run` | dry-run 只能是 `schedulable` / syntax evidence | P0 | 不写成验证通过 |
| Bootstrap install | `scripts/bootstrap-scale.ps1` | preview/check-only 默认；`--apply` / `--yes` 才安装 | P0 | 不 silent global install |
| Context map | `CONTEXT.md`、`docs/CONTEXT-MAP.md` | optional `project-context-map` / context bundle input | P1 | 不强制默认 `CONTEXT.md` |
| Resource policy | `.scale/resource-policy.json` | resource-governance lens：大文件、generated outputs、owners、retention | P1 | 不复制 `.scale` truth |
| Tools policy | `.scale/tools.json` | tool registry metadata：`requiredFor` / `recommendedFor` / `destructiveActions` / `evidenceRequired`，进入 helper/provider readiness 与 install safety | P0 | 不把 `requiredFor` 直接当 minimal baseline blocker |
| Skills/domain policy | `.scale/skills.json` | skill/domain hints + evidence-required，进入 surface overlay 与 skill evidence advisory lens | P2 | 不强制 Skill Radar 自动路由 |
| Code intelligence config | `.scale/code-intelligence.json` | 通用 provider readiness/fallback 槽位进入 v1.11/v1.12；code-graph / project-graph 能力按 capability-class 协同（研发人员自管），不进 spec-first 内置 provider | P0 通用 readiness / capability-aware 协同 | 不默认安装和刷新，spec-first 不拥有工具生命周期 |
| Governance lock | `.scale/governance.lock.json` | source/runtime managed asset drift report；hash/ownership 可借鉴 | P2 | 不引入 `.scale/governance.lock.json` |
| Product smoke | `.scale/product-smoke.json` | 真实跨边界 smoke probe 作为 verification profile 的可选 check（默认 `enabled:false`，空 probe = block，require command runtime evidence） | P1 | 不默认启用 example probe，不把空探针写成通过 |
| Output policy | `.scale/output-policy.json` | report-template / artifact handoff 思路接入现有 `artifact-summary`；`detectSecrets`、`allowRemoteScripts:false`、`defaultGitPolicy:review` 复用现有 redaction/secret-deny；HTML sidecar/manifest 延后 | P2/P3 | 不引入平行 artifact 渲染管线，不绕过现有 summary-first |
| Engineering standards | `.scale/engineering-standards.json`、`scale-engine/src/workflow/EngineeringStandards.ts` | maxFileLines、approved loggers、sensitive fields、layering、console allowlist 作为 governance lens 的 advisory 规则源 | P2 | 默认 advisory（SCALE 默认 `mode:warn`），blocking 需人审 + 误报证据（§4.7） |
| Frameworks / architecture | `.scale/frameworks.json` | 架构层次、依赖方向、banned imports、设计系统提示作为 L1 domain context candidate | P3 | 不强制框架探测，缺失是 advisory gap |
| Workspace topology | `.scale/workspace.json` | topology / repositories / branchPolicy / finishPolicy 思路对齐现有多仓 `target_repo` 与 git safety；只读对照 | P3 | 不引入平行 workspace 状态机，不接管分支策略 |
| Assets registry | `.scale/assets.json` | 受管资产清单思路，已被现有 managed-state（`adapter.stateFile`）和 plugin manifest 覆盖 | non-goal | 不新增平行 asset registry |
| Host configured dependencies / hooks | `.claude/settings.json`、`.codex/hooks.json` | configured dependency report：MCP、hook、allowlist、script command；hook policy 只做 advisory risk | P0/P1 | 不复制 inline shell hook / blocking Stop gate |

> 盘点说明：上表已覆盖 `project-scaffold/.scale/` 下的全部 checked-in 治理文件（`resource-policy` / `tools` / `skills` / `code-intelligence` / `verification` / `governance.lock` / `product-smoke` / `output-policy` / `engineering-standards` / `frameworks` / `workspace` / `assets`，外加 `config.yaml` 作为这些文件的聚合入口）。其中 `assets.json` 判为 non-goal（已被现有 managed-state 覆盖），其余按 P0–P3 / advisory 内化。`config.yaml` 是 `.scale` 的总装配清单，spec-first 不复制，只在 §3.4 边界下按需读取对照。

## 2.3 当前 `spec-first` 已有承载面

| 当前能力 | 本地源码证据 | 对本方案的含义 |
| --- | --- | --- |
| 双宿主 source/runtime 投影 | `src/cli/adapters/*`、`src/cli/commands/init.js`、`src/cli/plugin.js` | SCALE host adapter 思路要进入当前 adapter/projection，不另建平台 |
| Doctor readiness | `src/cli/commands/doctor.js` | dependency/provider readiness 应先扩展 doctor/mcp-setup facts |
| MCP/helper setup | `skills/spec-mcp-setup/SKILL.md`、`scripts/check-deps.sh`、`install-mcp.sh`、`verify-tools.sh` | 安装流程已有 required harness runtime owner |
| Workflow run artifact | `src/cli/helpers/spec-work-run-artifact.js`、schema | Evidence ledger 先复用 run artifact |
| Context bundle | `src/cli/helpers/context-bundle.js`、`docs/contracts/context-bundle.md` | Context Intelligence 先进入 bundle/freshness/fallback，而不是新 prompt 注入器 |
| Knowledge compounding | `skills/spec-compound/SKILL.md`、`docs/solutions/` | Memory/Knowledge 沉淀先走 verified solution docs |
| Review evidence boundary | `skills/spec-code-review/SKILL.md`、`skills/spec-doc-review/SKILL.md` | Provider 只能触发 investigation，finding 仍需 direct evidence |
| Doctor decision-input rollup | `src/cli/commands/doctor.js`（当前 `decision_input_health` 仍是 `not_checked`） | `decision_input_health` 应演进为消费 setup facts 的 deterministic readiness rollup（`pass/warn/error/stale/missing/not_checked`），是本方案 readiness facts 的主要 doctor 汇总面；详见 project-scaffold 子方案 §5.3 |

---

# 3. spec-first 源码结构设计

## 3.1 近期结构：扩展现有 owner

第一阶段不新增大顶层 `src/runtime/`、`src/context-intelligence/`、`src/governance/`。优先放在当前 owner 下：

```text
src/
  cli/
    commands/
      doctor.js                 # 增加 dependency/provider readiness summary
      init.js                   # 增加 generation report / configured dependency hint
      internal.js               # 暴露内部 deterministic helper
    helpers/
      task-governance-signals.js      # CLI-facing deterministic helper wrapper
      verification-profile.js         # CLI-facing wrapper; parsing lives in src/verification/profile-loader.js
      verification-run-summary.js     # capture/write wrapper; does not execute commands
      provider-readiness.js           # CLI-facing readiness projection wrapper
      honest-closeout.js              # structured claim validator wrapper
      resource-governance-lens.js     # advisory resource lens wrapper

  verification/
    artifact-paths.js
    quality-feedback.js
    profile-loader.js                 # verification-profile parsing/source resolution

docs/contracts/
  verification/
  governance/
  provider-readiness.md
  workflows/honest-closeout.md
```

目录规范：`src/verification/*` 承载 verification-specific parsing、artifact path 与质量反馈逻辑；`src/cli/helpers/*` 只暴露 CLI / workflow 可调用的 deterministic wrapper、path containment、schema validation 和 artifact writer。不得在两个目录各写一套 profile loader 或 run-summary schema 解释。

## 3.2 中期结构：contract 稳定后晋升

当 helper 有 2 个以上 workflow consumer，且 schema/测试稳定后，再考虑晋升为更清晰的模块：

```text
src/
  governance/
    task-governance-signals.js
    rule-maturity.js        # v1.17+ 才考虑 producer / promotion
    gate-lens.js
    resource-policy.js

  context/
    context-budget.js
    context-pack-builder.js
    project-context-map.js

  providers/
    provider-readiness.js
    codegraph.js
    graphify.js
    gbrain.js
    source-scan.js
```

## 3.3 后置 platform surface

这些目录/命令仅作为 v2.0 platform 候选，不应进入 P0/P1：

```text
src/baseline/
src/runtime/
src/context-intelligence/
spec-first baseline plan/apply/verify
Makefile.spec-first 默认生成
CONTEXT.md 默认生成
```

原因：

- 当前 `spec-first` 的 source/runtime 边界已经由 `init` 和 `doctor` 管理。
- 平行 runtime ledger 会与 `spec-work-run-artifact` 竞争 truth。
- `CONTEXT.md` 在 `project-scaffold` 是有用样板，但 `spec-first` 不应要求每个项目固定这个文件名。

## 3.4 新 helper 的统一前置契约（target-repo containment）

§3.1 的全部新 helper（`task-governance-signals` / `verification-profile` / `verification-run-summary` / `provider-readiness` / `honest-closeout` / `resource-governance-lens`）必须复用 `spec-work-run-artifact.js` 已建立的多仓安全前置，不得各自重造：

| 前置 | 规则 | 复用来源 |
| --- | --- | --- |
| Explicit target repo | 任何读写都必须显式接收 `--target-repo`，不依赖隐式 `process.cwd()` | `spec-work-run-artifact.js` `parseArgs` 强制 `--target-repo` |
| Git root 校验 | `--target-repo` 必须 resolve 到 git toplevel，且 realpath 一致才接受 | `resolveTargetRepoRoot()` 的 `git rev-parse --show-toplevel` + realpath 比对 |
| 输出 containment | 写入路径必须经 ancestor 遍历 + symlink 拒绝 + realpath 越界检查，限定在 target repo 内 | `validateOutputContainment()` |
| Runtime/generated 排除 | source refs 不得包含 `.claude/`、`.codex/`、`.agents/skills/`，artifact 路径限定在 `.spec-first/config/**` 或 `.spec-first/workflows/**` | run-artifact schema 的 path pattern + `GENERATED_RUNTIME_PREFIXES` |
| Secret 拒绝 | 写入前对路径与内容套用 secret-deny | `helpers/secret-deny-patterns.js` |

约束：

- 这些前置是**库级复用**，不是每个 helper 复制一遍。建议抽出 `helpers/target-repo.js`（containment + git root + path 校验）供所有新 helper import，避免散点实现漂移。
- 父级多仓 workspace 下，helper 不得跨子仓写入；缺少 `target_repo` 时返回 `rejected` + reason_code，不做 best-effort 猜测。
- 只读 helper（如 `provider-readiness` 探测）同样必须声明 target repo 假设，不得隐式扫描父目录。

---

# 4. 核心模块详细设计

## 4.1 Task Governance Signals

`scale-engine/src/workflow/TaskLevelDetector.ts` 会基于 diff、文件数、行数、关键路径和关键词直接返回 S/M/L/CRITICAL。`spec-first` 应借鉴信号采集，不借鉴最终裁决方式。

### 输出模型

canonical 字段定义已落盘到 `docs/contracts/governance/task-governance-signals.schema.json`（§0.4.3 登记）；本节只说明消费口径，不重写字段形状。

关键边界：

- `candidate_level` 使用 `spec-plan` depth 语言：`lightweight` / `standard` / `deep`。
- 不输出 SCALE 的 `S/M/L/CRITICAL` 终局等级，不输出折叠 `score`，不输出伪数值 `confidence`。
- `plan-declared` 来源只消费 pre-code / pre-plan planning context（用户请求、origin 文档、候选路径/模块和关键词），不得依赖尚未写出的 Implementation Units。
- `git-diff` 来源只消费 `git diff --numstat` 等确定性 diff facts。

### 消费规则

- Script 输出 candidate，不输出 final。
- `spec-plan` 或 `spec-work` 基于需求、diff、用户目标和直接源码证据确认等级。
- 用户或 workflow 可以降级/升级，但必须记录理由。
- CRITICAL 的人工确认、安全 review 和 rollback 仍由 workflow 决定，不由 helper 自动阻断。

## 4.2 Dependency Readiness / Install Plan

`scale-engine/src/bootstrap/DependencyBootstrap.ts` 提供 memory/knowledge/ui/external-cli/full pack、`apply`、post-check、version-drift、needs-init。`project-scaffold/scripts/bootstrap-scale.ps1` 默认 check-only，只有 `-AutoInstall` 才全局安装。

`spec-first` 应采用同样的 preview-first 语义：

```text
detect/check
  只检查 installed / configured / missing / stale / needs-init。

plan
  输出推荐安装命令、风险、写入路径、post-check。

apply
  只有用户显式请求才执行安装或配置。

verify
  执行工具自身 health check，写 setup facts。
```

### Profile

| Profile | 默认状态 | 内容 | 适用 |
| --- | --- | --- | --- |
| `minimal` | 默认 | Node/npm/npx/jq/python/git、required MCP、agent-browser/ast-grep helper readiness（ast-grep `baseline_blocking=true` 但允许 `rg` fallback degraded；agent-browser `baseline_blocking=false`，详见 project-scaffold 子方案 §2.4/§4.2） | 所有 spec-first workflow |
| `recommended` | 显式选择 | 在 minimal 基础上的额外 helper readiness + install plan（如 gh、vhs 等）；不默认写长期记忆。code-graph / project-graph 能力工具（CodeGraph/Graphify）可经 setup install gate 帮装（用户同意），消费侧 capability-aware（见 `CodeGraph技术方案.md`） | 需要额外 helper 或 code-intelligence 能力的团队 |
| `platform` | 显式选择 | helper install/apply/verify、host projection report、team policy | 团队级平台化治理 |

CodeGraph / Graphify 是研发人员工具箱里的 capability tools，可经 setup 帮装但不是 spec-first 依赖（memory 走 `docs/solutions/`、不集成外部 memory 工具，GBrain 删除）。SCALE full pack 还涉及 RTK、UI skills、browser/web tools、skill registry、runtime hooks、memory fallback 等。`spec-first` 只把自管 helper 表达成 readiness facts，不把第三方 code-intelligence 工具变成默认安装项或内置 provider。

### Scenario overlay（与 profile 正交）

profile 决定"默认装多少"，scenario overlay 决定"某类任务表面临时需要什么能力"，二者正交、不混（详见 project-scaffold 子方案 §4.3）：

| Overlay | 触发场景 | 能力 |
| --- | --- | --- |
| `surface-ui` | UI/E2E 任务表面 | agent-browser、Playwright MCP、Chrome DevTools MCP |
| `surface-data-security` | 数据库/安全任务表面 | postgres MCP、gosec、audit tools |

规则：overlay 由 workflow 按任务表面显式启用，不参与默认 profile 选择；即使 `platform` profile 推荐了这些能力，缺失也只让相关 overlay 降级，不让 unrelated workflow 进入 `error`。browser/e2e/data 能力一律走 overlay，不塞进 profile。

## 4.3 Verification Profile

`project-scaffold/.agent/project.json` 的关键价值是把 profiles、services、stacks、commands、required_tools 分离。`spec-first` 的 `verification-profile.v1` 应借鉴这个模型。

### 合同要点

```text
verification-profile 只引用项目已有命令或显式配置命令。
required_tools 缺失时输出 not-run/failed reason，不自动安装。
dry-run 只能表示 schedulable。
profile 选择是 workflow 语义判断，helper 只解析。
```

### 最小模型

> 字段引用边界（§0.4.3）：`verification-profile.v1` 的**完整 canonical 字段定义见 project-scaffold 子方案 §4.4**（`schema_version` / `default_profile` / `profiles` / `services.{path,stack,required}` / `stacks.{detect,commands,runner_kind,required_tools}`）。本节不重写字段形状，只说明消费口径与落地路径，避免出现两份字段略异的 JSON。
>
> 字段扩展提示：canonical 已含 stack `detect`（如 `["package.json"]` 用于 stack 自动探测）与 `runner_kind`、`services.required`。若后续需要 canonical 当前仍未含的新字段，按 §0.4.3 规则**改 §4.4 canonical 定义并 bump 版本**，不在本节私自加字段。

### 实例配置落地路径（钉死，见 §0.4 总表）

`project-scaffold` 把 profile 实例放在 checked-in 的 `.agent/project.json` + `.scale/verification.json`。`spec-first` 没有等价 location，必须明确，否则 Phase B 无法落地。架构判断如下（与 project-scaffold 子方案 §4.4 统一）：

- **canonical 路径是 repo root 的 `spec-first.verification.json`**（checked-in 团队 source，对标 scaffold 的根级 `.agent/project.json`，最易发现）。
- **不能放 `.spec-first/config/*.json`**：`src/cli/gitignore-policy.js` 已把 `.spec-first/config/*.json` 列入 gitignore（用于 `tool-facts.json`、`runtime-capabilities.json` 这类**生成/本地 facts**）。verification-profile 是团队手写、需 checked-in 的 source 配置，放进去会被忽略，语义也冲突。
- **解析优先级（preview-first，source-first）**：
  1. 显式配置文件 `spec-first.verification.json`（repo root，checked-in source，由用户维护）。
  2. 缺省时回退到**探测 `package.json` scripts**（沿用 `doctor` 现有 package-script 探测口径），输出 `profile_source: "inferred"`。
  3. 都没有则 `not-configured` + reason_code，由 workflow 决定是否补。
- **helper 只解析不裁决**：helper 解析上述来源产出 `verification-profile.v1` facts；选哪个 profile、是否够用是 workflow 语义判断。
- **本地覆盖**：本机路径/临时跳过用 `.spec-first/verification-profile.local.json` 或 `.spec-first/config.local.yaml`，落入 gitignore（与现有 `*.local.yaml` 模式一致），不作为团队共享事实源。

## 4.4 Verification Run Summary

`spec-first` 已有 `docs/contracts/verifiers/verification-evidence.schema.json` 和 `doctor` 对 verification evidence freshness 的读取。下一步应补一个 workflow 级 run summary，统一表达命令真实执行情况。

`verification-run-summary.v1` 的 canonical 字段定义已落盘到 `docs/contracts/verification/verification-run-summary.schema.json`（§0.4.3 登记）；子方案 §4.5 只引用，不重定义字段。下方 JSON 仅保留为历史设计示例，遇到差异以 schema 文件为 source of truth。字段命名与 `spec-work-run-artifact/v2` 对齐：逐 check 明细只在 `checks[]`，run-artifact 只保留聚合 `validation.run_summary_ref`。

```json
{
  "schema_version": "verification-run-summary.v1",
  "generated_at": "2026-06-03T00:00:00Z",
  "profile": "default",
  "checks": [
    {
      "id": "typecheck",
      "service": "app",
      "command": "npm run typecheck",
      "status": "passed",
      "exit_code": 0,
      "ran": true,
      "required_tools": ["node", "npm"],
      "missing_tools": [],
      "log_path": ".spec-first/workflows/spec-work/<run>/logs/typecheck.log",
      "reason_code": "completed"
    },
    {
      "id": "e2e",
      "service": "app",
      "command": "npm run test:e2e",
      "status": "not-run",
      "ran": false,
      "required_tools": ["node", "npm", "playwright"],
      "missing_tools": ["playwright"],
      "reason_code": "missing_dependency"
    }
  ]
}
```

字段规则：

- `status` 取 `passed/failed/not-run/degraded`；`status=passed` 必须 `ran=true` 且有 `exit_code` 和 `log_path`。
- `status=not-run` 必须有 `reason_code`（如 `missing_dependency`、`not_configured`），且 `ran=false`；`not-run` / `skipped` 不能被最终总结写成 `passed`。
- `service` 在单服务项目可省略或填 `root`；多服务项目用于区分。
- dry-run 只能映射成 `not-run` + `reason_code=schedulable`，不得写成 `passed`。
- `log_path` 是 redacted repo-relative 字符串；raw 日志的对象级 ref 仍由 `spec-work-run-artifact.script_confirmed.raw_log_ref` 承载。

### Runner 归属（钉死：谁产出真实 exit_code）

这是本合同最容易被忽略的结构性问题。`verification-run-summary` 的 `passed` 要求真实 `exit_code`，但 §3.3 已明确近期不建中心 runner（`src/runtime/` 后置）。当前 `spec-work-run-artifact.js` 的 `validateValidation` 也只校验 `exit_code` 是**整数**，并不执行命令——即 exit_code 是 caller 提交的，不是 spec-first 监督执行的。因此必须把"谁执行、谁记录、谁校验"分清，而不是假装有 runner：

| 角色 | 职责 | 边界 |
| --- | --- | --- |
| Host workflow（LLM + host shell） | 在宿主里**真实执行**验证命令（`npm test` 等），拿到真实 exit_code 与输出 | 这是双宿主架构的既定执行面；spec-first 不接管执行 |
| Thin capture helper（deterministic） | 提供一个 capture 入口（`spec-first internal verification-run-summary record`），workflow 把**刚执行命令的 command + exit_code + log path** 通过 stdin/参数交给它；helper 只做 schema 校验、redaction、path containment、写 artifact | helper 不重跑命令、不推断 exit_code、不解析自然语言"我跑过了" |
| Honest-closeout helper | 读取上面写入的结构化 check，校验 claim（§4.6） | 不信任未经 capture 入口的口头 exit_code |

结论与取舍：

- **近期不建监督式 runner**，§3.3 的结论保持不变。spec-first 只提供"执行后立即捕获"的 thin capture 约定，由 skill prompt（`spec-work`）指示 workflow 在跑完命令的同一步把退出码交给 capture helper，而不是事后凭记忆补写。
- **诚实边界**：capture helper 写出的 `exit_code` 的可信度 = "workflow 在执行当步如实转录"。这比"最终回复里自报测试通过"强（有结构化 check + log ref + redaction + 不可变 artifact），但**弱于**真正的进程级监督。该限制必须在合同里写明，不得包装成进程级保证。
- **何时才升级为真 runner**：只有当出现"workflow 谎报 exit_code"的真实误报证据，或团队显式要求进程级保证时，才把监督式 runner 作为 §3.3 platform surface 的 opt-in 能力引入；届时 capture helper 的 schema 不变，只是换成由 runner 填充。

### 与 `script_confirmed.validation` 的关系（消除 §4.5 的"或"）

为避免出现第二套验证证据 enum（违反 `ai-coding-harness.md` 边界规则 6），三者关系钉死为**单向引用，不并列竞争**：

- `verification-run-summary` 是**唯一的逐 check 明细 source**（每条命令的 command/exit_code/status/log ref）。
- `spec-work-run-artifact.script_confirmed.validation` **不复制**逐 check 明细，只保留聚合 `status`（passed/failed/not-run/degraded）+ `reason_code`，并通过 artifact ref 指向对应的 `verification-run-summary`。
- `doctor` 读取的 `verification-evidence.json`（freshness）保持现状，是 doctor 视角的 freshness 投影，不被本合同取代。

因此 §4.5 第 1 条的"扩展 `script_confirmed.validation.commands` **或** 引用 `verification-run-summary`"二选一被取消：统一为"`script_confirmed.validation` 引用 `verification-run-summary`"。

## 4.5 Evidence / Run Artifact

`scale-engine` 同时有 `RuntimeEvidenceLedger` 的 JSON records 和 `ExecutionLedger` 的 JSONL timeline。`spec-first` 当前已有更贴近自身边界的 `spec-work-run-artifact`：

- artifact 路径是 `.spec-first/workflows/spec-work/<workspace-slug>/<run-id>/run.json`。
- 同 workspace/run-id immutable，已存在则 `artifact-already-exists`。
- 区分 `script_confirmed`、`llm_asserted`、`provider_untrusted`、`direct_evidence_used`。
- 禁止 generated runtime mirror 路径进入关键 source refs。

因此第一阶段不要新增平行 `events.jsonl` truth。正确顺序是：

1. `script_confirmed.validation` 保留聚合 status + reason_code，并 ref 到 `verification-run-summary`（逐 check 明细的唯一 source，见 §4.4）；不在 run artifact 内复制逐命令明细。
2. 在 `provider_untrusted` 中表达 provider readiness/freshness/fallback。
3. 在 `direct_evidence_used` 中表达 source refs、checks/logs、limitations。
4. 只有当 run artifact 无法表达时，再设计 append-only event ledger。

## 4.6 Honest Closeout

目标是防止最终回复夸大事实：

```text
没跑测试却说测试通过。
dry-run 被说成验证通过。
provider stale 被说成影响面已确认。
只读 summary 却说已确认源码。
```

第一阶段实现为 `honest-closeout.v1`，检查 closeout claims 与 evidence refs 的关系：

| Claim | 需要的证据 |
| --- | --- |
| 验证通过 | `verification-run-summary` 中对应 check `passed`，或 `script_confirmed.validation.status=passed` |
| 未运行验证 | `not-run` + `reason_code` |
| 影响面已检查 | diff/source-read refs；provider 只能作为 candidate |
| review 已完成 | review artifact、review summary 或明确 not-run reason |
| 长期知识已沉淀 | `docs/solutions/**` source path（第一 durable store）；recall 不算沉淀 |

### Claim 载体形式（钉死）

`honest-closeout.v1` 的校验对象**必须是结构化 claim 对象，不是自然语言回复文本**。deterministic helper 无法可靠地把"测试通过"这句话映射到证据，因此分工固定为：

- **Workflow（LLM）产出结构化 claim 对象**：每条 claim 是 `{ claim_type, asserted_status, evidence_refs[] }`，其中 `claim_type` 取自固定枚举（`validation` / `impact_surface` / `review` / `knowledge_promotion`），`evidence_refs` 指向 run artifact 字段、`verification-run-summary` check id、`docs/solutions/**` 路径或 review artifact。
- **Helper（script）只做 schema 级关系校验**：校验每条 claim 的 `asserted_status` 是否被其 `evidence_refs` 支撑（例如 `validation=passed` 必须指向一条 `status=passed` 且带 `exit_code` 的 check）。校验是确定性的，输出 `consistent` / `unsupported` / `degraded` + reason_code，不解析自然语言。
- **自然语言层是 advisory，不是 claim model**：对最终回复文本做的 NL lint（如检测"测试通过"字样但无结构化 claim）只能作为 advisory warning，**不能**单独判定通过或失败，也不替代结构化 claim 对象。

`honest-closeout.v1` 的 canonical claim 校验模型（完整字段；引用处只描述四问字段映射，见 project-scaffold 子方案 §4.6，不重写本结构）：

```json
{
  "schema_version": "honest-closeout.v1",
  "claims": [
    {
      "claim_type": "validation",
      "asserted_status": "passed",
      "evidence_refs": ["verification-run-summary:typecheck"],
      "verdict": "consistent",
      "reason_code": "evidence-supported"
    },
    {
      "claim_type": "impact_surface",
      "asserted_status": "checked",
      "evidence_refs": [],
      "verdict": "unsupported",
      "reason_code": "missing-evidence-ref"
    }
  ],
  "overall": "degraded",
  "overall_reason_code": "claim-unsupported"
}
```

字段说明（canonical）：

| 字段 | 含义 |
| --- | --- |
| `claims[].claim_type` | 固定枚举：`validation` / `impact_surface` / `review` / `knowledge_promotion`。 |
| `claims[].asserted_status` | workflow 声称的状态（如 `passed` / `not-run` / `checked` / `completed` / `promoted`）。 |
| `claims[].evidence_refs` | 指向 run artifact 字段、`verification-run-summary` check id、`docs/solutions/**` 路径或 review artifact 的引用列表；为空即无证据支撑。 |
| `claims[].verdict` | helper 确定性判定：`consistent` / `unsupported` / `degraded`。 |
| `claims[].reason_code` | 判定理由码（如 `evidence-supported` / `missing-evidence-ref` / `evidence-status-mismatch`）。 |
| `overall` | 整体结论：任一 claim `unsupported` 则不得为 verified；仅有自然语言无结构化 claim 时为 `degraded`。 |
| `overall_reason_code` | 整体理由码。 |

边界结论：`honest-closeout` 的"牙齿"完全建立在结构化 claim 对象 + 其指向的 deterministic evidence（尤其 §4.4 的 `verification-run-summary` 真实 `exit_code`）之上。若某次 closeout 只有自然语言、没有结构化 claim 对象，helper 返回 `degraded`（honest-but-unverifiable），不得标记为 verified。

## 4.7 Governance Lens / RuleMaturity

`project-scaffold/scripts/gates/all.sh` 实际调度 G0-G22，且 `--dry-run` 只做 `bash -n`，输出 `schedulable`。部分 gate 明确是 advisory。`scale-engine/src/evolution/RuleMaturity.ts` 提供 shadow、candidate-hook、approved-blocking 的成熟度思路。

`spec-first` 应把 G0-G22 压缩成 lens families。canonical 词表定义见 `docs/contracts/governance/gate-lens-taxonomy.schema.json`；下表只描述来源语义和近期消费口径，不重定义字段：

| Lens | 来自 project-scaffold 的 gate 语义 | spec-first 近期行为 |
| --- | --- | --- |
| Preflight | G0、G9、G10、G16 | repo/runtime/version/managed asset facts |
| Exploration | G1、G15 | source-read coverage、context pollution |
| Planning | G2、G11、G17 | scope、rollback、architecture consistency |
| Execution | G3、G14、G19 | TDD/implementation/resource/error handling advisory |
| Verification | G4-G8、G21、G22 | lint/test/coverage/security/docs/dependency evidence |
| Review | G12、G13 | evidence quality、skill/tool use evidence |
| Summary | closeout 四问 | honest closeout |

### 成熟度

`rule-maturity.v1` 的 canonical 字段定义见 `docs/contracts/governance/rule-maturity.schema.json`。v1.14 只落 schema/docs-only 边界和 shadow/advisory 语义，不注册 producer/helper，不实现自动 promotion；`required-evidence` / `blocking` 留到 v1.17 Governance Maturity，且必须有人审批准、误报证据和 rollback 策略。

## 4.8 Resource / Output Governance

`resource-governance-lens.v1` 的 canonical 字段定义见 `docs/contracts/governance/resource-governance-lens.schema.json`。`spec-first` 拥有默认 policy；`project-scaffold/.scale/resource-policy.json` 和 README 的“什么能提交 / 默认不提交”只作为参考样例，不成为 spec-first 的 source-of-truth。

resource lens 覆盖：

- 大文件阈值。
- generated output / screenshots / coverage / Playwright report / logs 的默认提交策略。
- owner / module path hint。
- raw log retention 与 redaction status。
- `git add .` 风险提示（只能基于 staged/status facts 推断，不声称观察到用户命令）。

这应接入 `spec-work` closeout、`spec-code-review` project standards reviewer 和 release/PR handoff，而不是作为全局 blocking pre-commit。

---

# 5. Knowledge / Context Intelligence：capability tools 与六层体系

## 5.1 能力边界（install 帮装，消费不耦合）

`scale-engine/src/codegraph/CodeIntelligence.ts` 的关键点是 provider + fallback：

```text
code-graph 能力（如 CodeGraph）
project-graph 能力（如 Graphify 文档）
fallback: internal-scan / rg / read
```

在 spec-first 中，核心边界是 **「install 帮装、消费不耦合」**：`spec-runtime-setup` 在 explicit mode 下过 gate 帮用户装这些工具（与帮装 gh/jq 同构），但消费侧 capability-aware——只认能力类别、经原生 MCP、不注入编排面、刷新归工具自带 file-watcher（完整定位见 `CodeGraph技术方案.md`）。memory 能力（如 GBrain）与 spec-first 自有的 `docs/solutions/` 重叠，**默认不集成**。

无论能力来自哪个工具，证据边界一致：

```text
安装不等于可用。
可用不等于新鲜。
新鲜不等于 confirmed truth。
confirmed truth 仍需要 source/test/log/contract/user evidence。
```

## 5.2 安装走 setup（帮装、过 gate、用户同意），刷新归工具

核心边界是 **「install 帮装、消费不耦合」**：`spec-runtime-setup` 在 explicit install mode 下帮用户装这些工具（detect → install gate → 用户同意 → install/configure/index，与帮装 gh/jq 同构）。CodeGraph 这类 MCP provider 走 `mcp-tools.json` opt-in entry + `install-mcp`，Graphify 这类 CLI provider 走 `provider-tools.json` + `install-helpers`；命令按各自 registry/脚本受控分支维护（不硬编码到消费侧，落地前 `--help` 复核）。但**刷新归工具自带 file-watcher，消费侧 capability-aware 不耦合**（详见 `CodeGraph技术方案.md` §3/§5）：

| 能力工具 | setup 帮装（过 gate） | 启动/生成 | 刷新归属 |
| --- | --- | --- | --- |
| CodeGraph（code-graph，MCP） | `mcp-tools.json` opt-in entry 经 `install-mcp` warmup + host MCP config + 首次 `codegraph init` | MCP server 由 host 拉起 | 工具自带 file-watcher 自管；spec-first 不代刷 |
| Graphify（project-graph，run-scoped 上下文） | setup 可帮装 pinned `graphifyy==0.8.35` 的 workspace-local CLI wrapper（包名 `graphifyy`、bin 名 `graphify`，落点 `.spec-first/tools/` + `.spec-first/cache/uv`） | Runtime Setup 在 guided confirmation 或 `--only graphify` 后可运行 headless `graphify extract <path> --out .spec-first/workspace/providers/graphify/graphify-out --no-cluster` 做首次生成；缺少 `--requirement-workspace` 时 input scope 默认 project workspace，富媒体 `/graphify .` 仍是**用户动作** | `graphify update`、`--watch`、post-commit hook 或用户手动；spec-first 不代刷、不自动沉淀 |

spec-first 的 `spec-plan`/`spec-work`/`spec-code-review`/`spec-debug` 在工具装好后，按 capability-class 引导利用其 advisory 产出（经原生 MCP / run-scoped project-graph 上下文，缺失即 fallback），**不在运行期主动弹装、不把输出当语义证据**。

> 命令 snapshot 说明：上表命令与 `scale-engine/src/bootstrap/DependencyBootstrap.ts` 常量存在历史对应，但 CodeGraph 已按 npm 0.9.9 复核，`init -i` 已弃用，当前 bootstrap 使用 `codegraph init`。CodeGraph MCP 路径必须存入 `mcp-tools.json` opt-in entry，Graphify CLI 路径存入 `provider-tools.json`，并在落地前用 `--help` 复核，不把 provider 命令硬编码进消费侧 workflow。

## 5.3 六层 Knowledge Harness

SCALE 的 `docs/workflow/知识相关.md` 可以整体借“骨架”，但要压缩成适合 `spec-first` 的六层 Knowledge Harness。每层都必须标注使用的 skill、agent 和边界。

| 层 | 职责 | 可用 spec-first skill | 可用 agent/reviewer | Provider / 产物 | 边界 |
| --- | --- | --- | --- | --- | --- |
| L1 Project Context / Domain | 项目背景、术语、source-of-truth、禁忌和当前系统理解 | `spec-prd`、`spec-brainstorm`、`spec-plan`、`spec-doc-review` | `spec-product-lens-reviewer`、`spec-project-standards-reviewer`、`spec-feasibility-reviewer` | README、AGENTS、CLAUDE、docs/contracts、可选 project-context-map | 不强制 `CONTEXT.md`；术语缺失是 advisory gap |
| L2 Context Budget / Bundle | 选择上下文、用既有字段记录 included/omitted 语义、summary-first handoff | `spec-plan`、`spec-work`、`spec-code-review`、`spec-doc-review`、`spec-debug` | 各 workflow leaf reviewers/worker agents | `context-bundle.v1` 的 `related_paths`/`evidence_paths`/`excluded_context`、`artifact-summary.v1` | 不新增 included/omitted schema；不广播 raw logs、generated mirrors、全量 provider dump |
| L3 Code Intelligence | 缩小代码读取范围、影响面候选、affected tests candidate | `spec-plan`、`spec-work`、`spec-code-review`、`spec-debug`、`spec-app-consistency-audit` | `spec-correctness-reviewer`、`spec-testing-reviewer`、`spec-api-contract-reviewer`、`spec-security-reviewer`、`spec-performance-reviewer` | code-graph 能力（研发人员自管，如 CodeGraph）、source-scan fallback | 外部能力 result 是 candidate；finding/root cause 必须 direct evidence |
| L4 Memory / Prior Decisions | 召回历史修复、RCA、已拒绝方案、团队经验 | `spec-sessions`、`spec-compound`、`spec-compound-refresh`、`spec-plan`、`spec-debug` | `spec-learnings-researcher`、session historian 类 agent | `docs/solutions/**`（第一 durable store）、session summaries、out-of-scope rationale；外部 memory 工具仅研发人员自管时作 candidate | recall 不等于事实；长期写入走 candidate -> review -> promote |
| L5 Skill / Tool Capability | 根据任务域提示可用 skill、MCP、CLI、browser/tool evidence | `spec-runtime-setup`（alias `spec-mcp-setup`）、`spec-plan`、`spec-work`、`spec-code-review`、`spec-app-consistency-audit`、`spec-skill-audit` | `spec-agent-native-reviewer`、`spec-cli-readiness-reviewer`、UX/UI/browser 相关 reviewers | tool-facts、runtime-capabilities、skills/tool registry | advisory follow-up；不强制 Skill Radar；setup facts 不替代语义判断 |
| L6 Evidence / Promotion | 把验证、review、解决方案沉淀为可复用知识或治理规则 | `spec-work`、`spec-code-review`、`spec-doc-review`、`spec-compound`、`spec-compound-refresh`、`spec-release-notes` | review synthesis、`spec-learnings-researcher` | run artifact、verification summary、review finding、docs/solutions、RuleMaturity | 未验证经验不进 durable knowledge；blocking rule 需人工批准 |

## 5.4 Provider 信任等级

原方案的 7 级阶梯把**两件不同的事**混在一个词表里：provider 的机械 readiness，和 evidence 的语义信任/晋升。直接新增 7 个枚举会与现有 `spec-work-run-artifact.schema.json` 里 `provider_untrusted.readiness_status` 的 5 值 enum（`fresh / stale / degraded / not-run / unknown`）冲突，制造第二套 evidence enum（违反 `ai-coding-harness.md` 边界规则 6）。因此拆成两个正交轴，**机械轴复用现有 enum，不新增**：

### 轴 A — Provider Readiness（机械，复用现有 5 值 enum）

直接复用 `provider_untrusted.readiness_status`，不引入新词：

| 值 | 含义 |
| --- | --- |
| `not-run` | 没安装、没配置、命令不可用或 artifact 缺失（吸收原 `unavailable`） |
| `stale` | 可用但 index/graph/memory 与当前 worktree/source 时间不匹配 |
| `degraded` | 可用但部分能力缺失或降级运行 |
| `fresh` | 可用且与当前 source 时间一致 |
| `unknown` | 无法判定 readiness |

### 轴 B — Evidence Trust（语义晋升阶梯，非 enum、不入 readiness 字段）

这是 LLM/workflow 的语义判断维度，不写进 readiness 字段，而是体现在证据如何被消费和晋升：

| 信任档 | 含义 | 晋升前置 |
| --- | --- | --- |
| advisory | 搜索方向、上下文候选、历史线索 | provider readiness 至少非 `not-run` |
| evidence_candidate | 有 provider path/symbol/summary，可触发 direct source read | advisory + 指向可读 source |
| confirmed_context | 已被 source/test/log/contract 直接确认 | direct evidence lane 确认（见 `ai-coding-harness.md`） |
| durable_knowledge | 已进入 `docs/solutions/**` 或经审查的长期记忆 | confirmed + review/promote |
| governance_rule | 经 RuleMaturity 和人工批准成为 required/blocking policy | durable + 人审 + 误报证据（见 §4.7） |

### 两轴映射（原 7 级 → 现有结构）

| 原 7 级词 | 落到哪个轴 |
| --- | --- |
| `unavailable` | 轴 A `not-run` |
| `stale` | 轴 A `stale` |
| `advisory` | 轴 B advisory |
| `evidence_candidate` | 轴 B evidence_candidate |
| `confirmed_context` | 轴 B confirmed_context |
| `durable_knowledge` | 轴 B durable_knowledge |
| `governance_rule` | 轴 B governance_rule |

规则：轴 A 是 deterministic helper 写入的机械字段，只能取现有 5 值；轴 B 是 workflow 的语义晋升判断，**不得**回填进 readiness enum。`confirmed_context` 及以上只能由 direct evidence 达成，provider readiness=`fresh` 本身永远不等于 `confirmed_context`。

---

# 6. Workflow 接入设计

## 6.1 `spec-runtime-setup`（deprecated alias：`spec-mcp-setup`）

> 入口命令名以 §0.4.2 为准：canonical = `$spec-runtime-setup` / `/spec:runtime-setup`，`spec-mcp-setup` 为迁移期 alias。下文 source 实体路径（`skills/spec-mcp-setup/**`）保持现状，待后续 source 重命名 work 任务再改。

近期最先接入：

- 读取 helper registry / `provider-tools.json` / install profile。
- 输出 dependency readiness、helper/provider readiness、freshness、install plan。
- 可显式 apply（过 install gate + 用户同意）：spec-first 自管 helper，以及 code-graph / project-graph 能力工具（CodeGraph 走 MCP install/configure/index；Graphify 走 CLI install + provider-native first generation）。
- 写 `.spec-first/config/tool-facts.json`、`runtime-capabilities.json`、setup scenario fingerprint。
- 不在 plan/work/review 运行期主动弹装，不运行期 lazy 装，不代刷新（刷新归工具自带 file-watcher），不把外部能力 facts 当语义证据。

## 6.2 `spec-prd`

接入方式：

- L1 Project Context：读取 source docs、domain glossary、当前系统证据。
- 可选 L3/L4：研发人员自管的 run-scoped project-graph 上下文、`docs/solutions/` 历史决策仅作为 current-state / historical-decision candidates。
- 输出 PRD 时新增或强化：

```markdown
## Current System Evidence
## Domain Terms / Source Of Truth
## Historical Decisions / Rejected Scope
## Provider Candidates Requiring Source Confirmation
```

## 6.3 `spec-plan`

接入方式：

- 读取 task governance signals，LLM 确认 task level。
- 选择 verification profile 和 gate lens candidates。
- 若工具箱存在 code-graph / project-graph 能力（研发人员自管），按 capability-class 引导利用其影响面候选；缺失即 `rg`/ast-grep/direct-read fallback。
- 把外部能力输出写成 candidate facts 和 source-read requirements。
- 对 out-of-scope / prior decisions 做 advisory boundary evidence。

## 6.4 `spec-work`

接入方式：

- 执行计划或 task-pack 前读取 task level、verification profile、resource lens。
- 若有 code-graph 能力则用其缩小读取候选，但仍 direct source read；缺失即 source-scan fallback。
- 运行真实验证并产出 `verification-run-summary` 或更新 run artifact。
- closeout 使用 honest-closeout，明确 passed/failed/not-run/degraded。
- durable trigger 触发时写 `spec-work-run-artifact`。

## 6.5 `spec-code-review` / `spec-doc-review`

接入方式：

- 外部能力 result 可以触发 investigation。
- Review finding 必须由 diff/source/test/log/contract/artifact 直接支撑。
- run-scoped project-graph 上下文、`docs/solutions/` 历史召回可用于语义一致性或历史事故线索，但未确认时只能进 residual risk / test candidate。
- 对文档 review，外部能力输出只能作为 evidence path / premise challenge，不替代逐章文本审查。

## 6.6 `spec-debug`

接入方式：

- error/log -> direct repro -> code-graph path candidate（若有）-> source-read -> focused command/log confirmation。
- `docs/solutions/` / session recall 只补历史线索。
- 输出必须区分 confirmed root cause、unconfirmed hypotheses、not-run probes。

## 6.7 `spec-compound` / `spec-compound-refresh`

接入方式：

- 只沉淀已解决、已验证、可复用的知识。
- `docs/solutions/**` 仍是第一 durable knowledge store。
- 外部 memory 工具写入（若研发人员自管）是 optional promotion，不是默认 closeout。
- project-graph 文档 refresh 是研发人员的 next action，不在 compound 中静默执行。

## 6.8 `using-spec-first` / `spec-update` / `spec-release-notes`

- `using-spec-first` 只做入口路由，不消费 provider 语义。
- `spec-update` 可提醒 runtime/setup facts stale，但不接管 provider 初始化。
- `spec-release-notes` 只引用已发布版本事实，不使用 provider recall 生成 release truth。

---

# 7. Contract / Schema 清单

## 7.1 第一批合同

第一批只补能关闭 P0 可信交付缺口的合同：

```text
docs/contracts/verification/
  verification-profile.md
  verification-run-summary.md

docs/contracts/governance/
  task-governance-signals.md
  resource-governance-lens.md
  gate-lens.md

docs/contracts/provider-readiness.md

docs/contracts/workflows/
  honest-closeout.md
```

`provider-readiness.v1` 的 canonical 最小字段形状归父方案所有，避免 v1.11 readiness baseline 反向依赖 v1.16 CodeGraph 子方案：

```json
{
  "schema_version": "provider-readiness.v1",
  "provider": "codegraph",
  "kind": "code-structure|project-graph|memory",
  "profile": "minimal|recommended|platform",
  "readiness_status": "fresh|stale|degraded|not-run|unknown",
  "lifecycle": {
    "installed": false,
    "configured": false,
    "initialized": false,
    "indexed": false,
    "server_reachable": false,
    "artifact_exists": false,
    "query_verified": false,
    "fallback_used": false
  },
  "repo_aligned": "yes|no|unknown|not-applicable",
  "capabilities": [],
  "limitations": [],
  "source_read_required": true,
  "fallback": {
    "available": true,
    "methods": ["rg", "direct-source-read"],
    "reason_code": "provider-not-run"
  },
  "next_actions": []
}
```

字段规则：

- `readiness_status` 只取 `fresh / stale / degraded / not-run / unknown`，不使用 `unavailable`。
- `lifecycle.*` 是 lifecycle 布尔位全集，引用处不得另建 `readiness{}`、`installed/configured` 顶层散字段或第二套状态词表。
- `source_read_required` 和 `fallback` 只表达 provider 输出需要 direct source confirmation；`advisory` / `evidence_candidate` / `confirmed_context` 等语义信任等级不得写入本 schema。

配套 schema 的**单一 source location 与校验器复用**（钉死，避免双写漂移）：

```text
docs/contracts/verification/*.schema.json     # 唯一 schema source
docs/contracts/governance/*.schema.json        # 唯一 schema source
docs/contracts/provider-readiness.schema.json  # 唯一 schema source
docs/contracts/workflows/honest-closeout.schema.json
```

规则：

- **单一 schema source**：所有新 schema 只落在 `docs/contracts/**`，与现有 `verification-evidence.schema.json`、`spec-work-run-artifact.schema.json` 同一模式。`src/cli/contracts/**` 不放第二份 schema 文件，只在需要时 `require()` 引用 `docs/contracts/**` 下的 JSON（参照 `spec-work-run-artifact.js` 用 `ARTIFACT_SCHEMA_PATH` 指向 `docs/contracts/workflows/...` 的做法）。
- **复用现有校验器**：所有新 helper 一律通过现有 `src/contracts/schema-validator.js` 的 `validateAgainstSchema()` 校验，不自带第二套校验实现（`spec-work-run-artifact.js` 与 `doctor.js` 都已是这个模式）。
- 不新增 `src/contracts/schemas/` 作为第二套 schema location，除非现有 schema owner 确实无法承载并在本文件登记原因。

## 7.2 复用既有合同

| 已有合同 | 本方案如何复用 |
| --- | --- |
| `docs/contracts/ai-coding-harness.md` | 总分层和边界 source |
| `docs/contracts/context-governance.md` | runtime/generated exclusion 和 summary-first policy |
| `docs/contracts/context-bundle.md` | context pack / budget envelope |
| `docs/contracts/artifact-summary.md` | artifact handoff summary |
| `docs/contracts/knowledge/knowledge-harness.md` | 六层 Knowledge Harness map、recall advisory 边界和 promotion boundary |
| `docs/contracts/verifiers/verification-evidence.schema.json` | doctor workflow evidence freshness |
| `docs/contracts/workflows/spec-work-run-artifact.schema.json` | work run evidence truth |
| `docs/contracts/source-runtime-customization-boundary.md` | source/runtime/provider 边界 |

## 7.3 后续候选合同

```text
docs/contracts/knowledge/
  memory-promotion.md
  out-of-scope-rationale.md

docs/contracts/context-intelligence/
  context-query.md
  context-fusion-summary.md
  provider-freshness.md

docs/contracts/baseline/
  governance-baseline.md
  baseline-plan-apply-verify.md

docs/contracts/runtime/
  event-ledger.md
```

后续合同只有在有明确 producer 和至少一个 consumer 后再创建。

---

# 8. 实施路线

## Phase A：Dependency Readiness Baseline

目标：扩展 `doctor` / `spec-runtime-setup`（alias `spec-mcp-setup`）的 deterministic setup facts。

交付：

- `minimal/optional/recommended/platform` profile。
- required harness runtime 与 optional provider readiness。
- 通用 provider install-plan shape / explicit-apply boundary / post-check result shape。
- configured dependency scan facts：host hooks、MCP、helper、provider command、project artifact（v1.11 producer；v1.12 doctor/host projection consumer）。

边界：Phase A 只建立通用 provider readiness 槽位、registry shape、missing/stale/fallback projection，以及“已配置但未验证”的 configured dependency facts；不交付 code-graph / project-graph 能力的 capability-class 协同 prose 与 workflow 引导。这些属于 Phase E。

验收：

- 没有 explicit apply 时不安装、不改外部环境。
- missing/stale/degraded/fallback 有 reason_code。
- 普通 workflow 可在 provider `not-run` 时继续使用 direct evidence。

## Phase B：Verification Profile + Run Summary + Honest Closeout

目标：把 project-scaffold 的 verification profile 内化成 source contract，并在同阶段闭合 honest closeout（因为 honest-closeout 的 deterministic 牙齿依赖 verification-run-summary 的真实 exit_code，二者必须同阶段交付，不能拆到后面的 governance 阶段）。

交付：

- `verification-profile.v1`。
- `verification-run-summary.v1`。
- `honest-closeout.v1`（结构化 claim 对象 + schema 级关系校验，见 §4.6）。
- not-run reason、`log_path`（run-summary，redacted repo-relative）、run-artifact `raw_log_ref` 的 redaction status。
- `doctor` 或 internal helper 可读取最近验证 evidence。

验收：

- dry-run 不能被写成 verified。
- required_tools 缺失不会自动安装。
- final response 的测试/验证 claim 可追溯到结构化 claim 对象与其 evidence refs。
- 缺结构化 claim 对象时 closeout 返回 `degraded`（honest-but-unverifiable），不静默通过。

## Phase C：Governance Lens

目标：把 task signals、gate lens、resource lens 和 final report guard 思路串成 advisory 治理层（honest-closeout 已在 Phase B 交付，本阶段只消费它）。

交付：

- `task-governance-signals.v1`。
- gate lens families。
- RuleMaturity 最小模型。
- governance lens 消费 Phase B 的 honest-closeout 结果作为 summary lens。

验收：

- task level 是 candidate，不替代 LLM 判断。
- blocking 默认关闭。
- `required-evidence` 缺失会降级 closeout，而不是静默通过。

## Phase D：Knowledge Harness

目标：把 SCALE 知识体系压缩为 spec-first 六层 Knowledge Harness。

交付：

- `docs/contracts/knowledge/knowledge-harness.md`：六层 map、L2/L4/L6 v1.15 gate、L5 advisory follow-up、recall advisory 边界。
- `artifact-summary.v1` producer/consumer prose：`summary_missing` 与 `full_artifact_read_reason` 信号，按 trigger 展开 full artifact。
- `skills/spec-compound/references/schema.yaml` 扩展：新 promote required `invalidation_condition` + `source_refs`，旧文档保留 `legacy_unstructured_advisory`。
- context bundle budget 复用既有 `related_paths` / `evidence_paths` / `excluded_context`，不新增字段。

验收：

- stable knowledge 与 session-local 过程产物可区分。
- 外部 memory / project-graph 工具写入（若研发人员自管）都是 optional promotion。
- `spec-compound` 不变成 raw transcript archive。

### Phase D 设计依据校准（2025-2026 best-practice 验证，deep-research 对抗核实）

下表是对 v1.15 五支柱的外部最佳实践验证（25 条 claim 经 3 票对抗验证，21 确认 / 4 驳倒）。**结论：整体 sound、无过时或被业界否决的选择，无 blocking design flaw**；但有 2 处 framing 必须收敛、4 条论据不得引用。

| 支柱 | 验证 | 一手依据（已逐字核对的） |
| --- | --- | --- |
| context budget（L2） | ✅ 公认最佳实践 | Anthropic「context 是有限资源、有 context rot / attention budget」「context window 是最该管理的资源」；*Lost in the Middle*（TACL 2024, arXiv:2307.03172）U 型位置曲线——大窗口≠用得好 |
| summary-first / progressive disclosure handoff（L2/L5） | ✅ 业界推荐模式非新发明 | Anthropic「subagent 独立 context、只回传 1000-2000 token 摘要」+「维护轻量标识符(file paths)按需加载」——正是 summary+精确 path |
| file-first 而非向量库（<500 条，L4） | ✅ 按规模论证成立 | Anthropic 出 file-based memory tool + just-in-time file 引用；Mem0(arXiv:2504.19413)重型向量+图记忆**明确为大规模多会话**，非小库 |
| recall 当 advisory 必回源（L4） | ✅ grounding 文献强支持 | Self-RAG(ICLR 2024, arXiv:2310.11511) 反对「不加判别纳入检索内容」；CRAG(ICML 2024, arXiv:2401.15884) retrieval evaluator 给 confidence 再用 |
| verified-only promotion gate（L6） | ⚠️ 威胁模型确认，直接背书弱 | NIST AI 100-2e2025 确认知识库投毒（单篇毒文档即可）→ 验证了「为何要 gate」；但「业界明文推荐 candidate→review→promote」的背书 claim **被驳倒**（见下） |

**两处 framing 必须收敛（否则 overreach）**：

1. **file-first 只按「规模 + 写入摩擦 + 可审计」论证，不得写「embeddings 已过时/被淘汰」**——业界是 **hybrid 立场**（小库/导航用 file，大模糊语料仍用 embedding）。当前 §2.1/§5.3 按规模论证，正确；守住即可。
2. **promotion gate 的 rationale 靠「投毒威胁模型 + RAG 质量门槛类比」成立，不得声称有 NIST/Anthropic 一手「do this」背书**；落地配显式 provenance / `invalidation_condition` 字段补强。注意：内部策展（人/LLM curated file store）的注入面**低于** NIST 研究的可优化 RAG 对手，故 gate 应定位为**噪声/质量控制**，非反注入防御。

**不得引用的被驳倒 claim（对抗验证 0-3 / 1-2）**：① 「NIST 推荐 sanitize/validate/attest 后才入库、直接背书 promotion gate」(0-3)；② 「Anthropic canonical 持久知识就是 markdown、全程无向量」(0-3，实为 hybrid)；③ 「安全上应假设注入、外部资源不可信」作为 recall 边界依据(1-2)；④ 「Anthropic 命名 trust-then-verify gap 并推 fresh-context 对抗 review」(1-2)。

**v1.15 plan 必答的 4 个 open question（来自 deep-research）**：

- **OQ-1（summary-first）**：expand-on-trigger 的**具体条件**是什么？如何调阈值避免 Cognition 警告的「互依赖任务丢上下文」碎片化？
- **OQ-2（file-first 规模门槛）**：到多大语料 / 什么查询模式，file + grep 不再够、需转 hybrid 索引？（<500 条是断言，无外部 benchmark）
- **OQ-3（recall 回源操作化）**：reconfirm 是人工 reviewer / 自动检查 / 模型自评？（Self-RAG 证明模型自评不可靠 → 倾向回源到权威 source，不靠自评）
- **OQ-4（promotion gate 最小机制）**：是否需显式 provenance / integrity / `invalidation_condition` 控制？达到噪声控制目标的**最小 durable 机制**是什么（防过度设计）？

> 验证环境局限（诚实标注）：多数 live URL 被网络策略挡，靠 `curl` 直取 + 逐字引文核对（claude-code-best-practices / Self-RAG / CRAG / Mem0 / NIST 已逐字确认），少数精确措辞置信度略降但实质成立；grounding 文献(Self-RAG/CRAG)对 v1.15 recall 边界是**外部 RAG→内部 recall 的类比迁移**（原理可泛化，非字面命中）。



## Phase E：Capability-aware 协同（code-intelligence 能力工具）

目标：setup 帮用户装好 code-graph / project-graph 能力工具（过 gate + 用户同意），消费侧 capability-aware 不耦合（完整定位见 `CodeGraph技术方案.md`）。

交付：

- 安装侧：CodeGraph 落 `mcp-tools.json` opt-in MCP entry 并复用 `install-mcp` / host config / project bootstrap；Graphify 落 `provider-tools.json` CLI entry 并复用 `install-helpers.{sh,ps1}`；两路过 install gate，并用 `provider-readiness.v1` lifecycle 布尔位表达「装≠用」ladder。
- 消费侧：workflow prose 的 capability-class 引导（只认能力类别、不写死工具名、经原生 MCP、不注入 reminder）；复用既有 `provider_untrusted` 记 readiness + 候选，不新建第二套 evidence enum。

边界：install 走既有 setup + gate（**该做**）；消费侧不写死工具名、不注入 routing/reminder/instruction block、不建 elaborate adapter envelope / context fusion / 7 态机（**不做**）；运行期不主动弹装、不代刷（刷新归工具）。memory 能力默认走 `docs/solutions/`，外部 memory 工具（如 GBrain）不集成。外部能力缺失即 fallback，不升级为 ordinary workflow failure。

验收：

- stale 外部能力输出不产生 confirmed context。
- source-read confirmation required 明确。
- provider conflict/gap 可见。

## Phase F：Platform Baseline

目标：团队级 opt-in platform profile。

交付候选：

- `spec-first baseline plan/apply/verify`。
- optional `Makefile.spec-first`。
- optional project-context-map generator。
- multi-host adapter projection report。

验收：

- preview-first。
- 不覆盖手写 source。
- host runtime projection 有 drift report。
- platform profile 不影响 minimal 默认体验。

## 8.1 三份文档相位对照（single phase map）

三份文档使用不同相位命名，本表是它们与版本路线的唯一对照（避免跨文档拼时序）：

| 父方案 Phase | project-scaffold 子方案 | CodeGraph 子方案 | 版本路线 | 主要交付 |
| --- | --- | --- | --- | --- |
| Phase A：Dependency Readiness Baseline | Phase 1（registry/safety facts producer）+ Phase 3（plan/apply split）+ Phase 2（doctor 消费，v1.12） | —（CodeGraph 子方案不作为 v1.11/v1.12 实施依据；通用 provider readiness 槽位归父方案 + project-scaffold 子方案） | v1.11 producer + v1.12 consumer | readiness facts、registry shape、install safety、configured dependency scan facts、`provider-readiness.v1` 通用槽位、doctor rollup |
| Phase B：Verification Profile + Run Summary + Honest Closeout | Phase 4：Verification Profile | — | v1.13 | `verification-profile.v1`、`verification-run-summary.v1`、`honest-closeout.v1` |
| Phase C：Governance Lens | —（治理 lens 不在本子方案范围） | — | v1.14（foundation）+ v1.17（maturity） | task-governance-signals、gate lens、RuleMaturity |
| Phase D：Knowledge Harness | — | — | v1.15 | 六层 Knowledge Harness、promotion rules |
| Phase E：Capability-aware 协同（code-intelligence 能力工具） | —（project-scaffold 子方案只保留边界预留，不作为 v1.16 主要实施依据） | install 侧按形态分流：CodeGraph 走 `mcp-tools.json` + `install-mcp`，Graphify 走 `provider-tools.json` + `install-helpers`（过 gate）；消费侧 capability-class 引导 + advisory + fallback（CodeGraph code-graph / Graphify project-graph；memory 走 docs/solutions） | v1.16 | setup 帮装过 gate；消费经原生 MCP 不注入编排面；不代刷、不建 adapter/fusion |
| Phase F：Platform Baseline | — | — | v2.0 | baseline plan/apply/verify、multi-host projection |

口径：相位与 P0 归属以父方案 §8 / §10 为准；两份子方案的 Phase/Stage 编号只是各自视角的细化，必须落进本表对应的父方案 Phase。

> CodeGraph 子方案归属说明（钉死，消除相位归属歧义）：`CodeGraph技术方案.md` 只属于 Phase E / v1.16，定位是 **「install 帮装、消费不耦合」**（setup 过 gate + 用户同意帮装 + 配 MCP + 首次 index；消费侧 capability-aware，不注入编排面、不代刷新），不是 provider 集成全链路、也不是「完全不碰安装」。Phase A 的通用 `provider-readiness.v1` schema / docs / fixture、missing/stale/degraded/fallback projection 由父方案与 project-scaffold 子方案承担；CodeGraph 子方案在其上按安装形态分流：CodeGraph 具体 entry 写入 `mcp-tools.json` 并复用 `install-mcp`，Graphify 具体 entry 写入 `provider-tools.json` 并复用 `install-helpers`。消费侧**不写死工具名、不注入 routing/reminder/instruction block、不建 elaborate adapter/fusion**；memory 能力（如 GBrain）默认走 `docs/solutions/`、不集成。

---

# 9. 测试策略

## 9.0 现状不回归（Regression Guard）

内化改动属"大型任务"，落地前后必须证明未破坏现有已验证行为。以下回归项每个 Phase 结束都要跑：

| 用例编号 | 回归断言 | 现有 source 锚点 |
| --- | --- | --- |
| REG-DOCTOR-001 | `doctor --json` 仍输出 `workflow_runnability` ∈ `{verified, simulated, not_verified}` 且 `workflow_runnability_basis` 字段不缺失 | `src/cli/commands/doctor.js` `computeWorkflowRunnability` |
| REG-DOCTOR-002 | verification evidence 7 天 freshness 阈值与 `fresh/stale/unknown/missing` 判定不变 | `doctor.js` `determineEvidenceFreshness` |
| REG-RUNART-001 | 同 workspace/run-id 重复写入仍返回 `artifact-already-exists`（immutable 不被破坏） | `spec-work-run-artifact.js` `writeSpecWorkRunArtifact` |
| REG-RUNART-002 | `script_confirmed`/`llm_asserted`/`provider_untrusted`/`direct_evidence_used` 四分区与 schema enum 不被新字段污染 | `spec-work-run-artifact.schema.json` |
| REG-RUNART-003 | generated runtime 路径（`.claude/`、`.codex/`、`.agents/skills/`）仍被 source refs 拒绝 | schema path pattern |
| REG-SUITE-001 | `npm test`（unit + smoke + integration）在每个 Phase 后保持绿；新增 schema/helper 不破坏现有 contract test | `tests/unit`、`tests/smoke`、`tests/integration` |

要求：REG-* 用例在引入 `verification-run-summary` 对 `spec-work-run-artifact` 的引用时尤其关键——若该引用构成 schema 变更，必须 bump schema 版本并补 downstream consumer test，不得静默改动现有 schema。

## 9.0.1 基建消费侧验收门槛（Consumer Gate）

本方案是横向基建（§0.0），其最大失败模式不是"方向错"，而是**造了没人消费的 facts** 或 **facts 被消费了却不改变行为**。因此每个 capability 除了 contract test（证明 facts 正确），还必须通过**消费侧验收**（证明 facts 有用），否则只计为 advisory，不计入对应 Phase 的 P0/P1 完成。

门槛定义：

> 每个 capability 最终至少有一个 §6 中 named workflow，因消费它而产生**可观察的行为变化**；该变化必须能被一条具体断言捕获。
>
> 行为变化的兑现 Phase 分两类：
> - **直接 capability**（如 verification-run-summary、honest-closeout、task-governance-signals）：在**自身 Phase 内**由 named workflow 兑现行为变化。
> - **enabling infrastructure**（如 v1.11–v1.12 的 readiness baseline / doctor rollup）：先在同一 producer→consumer 切片内通过 direct deterministic consumer gate（`doctor --json` 从 setup facts 计算 `decision_input_health`，非 §6 named workflow），再在**指定的 consuming Phase**兑现 named workflow 行为变化（readiness baseline 的 workflow consuming Phase 是 v1.13 verification + honest-closeout）。enabling infra 必须同时登记 direct consumer 与 workflow consuming Phase；direct gate 通过前不得宣称切片完成，workflow consuming Phase 落地前不得宣称已兑现最终 workflow 价值。

| 用例编号 | capability | consumer / consuming phase | 可观察行为变化（断言） |
| --- | --- | --- | --- |
| `[CON-READY-001]` | readiness baseline / `decision_input_health` | direct consumer：`doctor`（v1.12）；workflow consuming Phase：v1.13 `spec-work` closeout | `doctor --json` 的 `decision_input_health` 从 setup facts 计算且 basis 指向 facts；v1.13 closeout 能基于该 projection 区分 missing / not-run / degraded |
| `[CON-VPROF-001]` | verification-profile | `spec-work` | 有 profile 时验证命令来自 profile 解析；无 profile 时回退 package.json 探测并标 `profile_source:"inferred"`（行为随输入可见切换） |
| `[CON-VRUN-001]` | verification-run-summary | `spec-work` closeout | closeout 的验证结论从"自述"变为引用 run-summary 的 `passed/failed/not-run`；`not-run` 必带 reason_code |
| `[CON-HONEST-001]` | honest-closeout | `spec-work` closeout | 缺结构化 claim 或证据时，closeout 输出从"通过"降级为 `degraded`，而非静默通过 |
| `[CON-TASK-001]` | task-governance-signals | `spec-plan` | plan 显示 candidate level 与 reason_codes，且 LLM 可记录理由升/降级（candidate 真正进入决策，而非被忽略） |
| `[CON-PROV-001]` | provider-readiness | direct consumer：`doctor.decision_input_health`（v1.12 projection）；workflow consuming Phase：v1.16 `spec-plan`/`spec-debug` capability-aware fallback | `doctor --json` 的 `decision_input_health_basis.provider_counts` 从 setup facts 计算；v1.16 前 provider facts 只算 advisory，v1.16 workflow 在 provider `not-run/stale` 时明确走 fallback 并继续，而非阻塞或假装已确认 |
| `[CON-RES-001]` | resource-governance-lens | `spec-work` closeout / `spec-code-review` | 命中 large file / generated output / raw log 时 closeout 或 review 出现对应 advisory 项 |

登记说明：

- `gate-lens-taxonomy.v1` 是 governance lens family 共享词表，不是独立 capability、gate 执行器或 permission boundary。它由 `task-governance-signals.recommended_gate_lenses` 与 `resource-governance-lens.items[].lens_family` 复用，不单独主张一个 workflow consumer gate。
- `rule-maturity.v1` 是 v1.14 schema/docs-only shadow 例外：故意无 producer/helper、无自动 promotion，`required-evidence` / `blocking` 留到 v1.17 Governance Maturity。此例外显式豁免 §7.3 的“有 producer+consumer 再创建合同”普通规则；v1.17 前不得把它包装成已消费的 workflow capability。

规则：

- **无消费方 = 不交付**：某 direct facts producer 找不到 deterministic consumer，或某 capability 到其指定 workflow consuming Phase 仍无断言可捕获的行为变化，则停在 advisory，不计入对应 gate 完成，避免基建空转。
- **消费侧验收与 contract test 并列**：contract test 证明 facts 正确（schema/边界），consumer gate 证明 facts 有用（行为变化）。enabling infra 的 direct gate 与 workflow gate 必须分别标注，不得互相冒充。
- **§6 接入矩阵是 workflow consumer 的唯一登记处**：新增 capability 必须在 §6 登记至少一个 workflow consumer，否则不进入路线；enabling infra 还须登记 direct consumer 与 workflow consuming Phase。

## 9.1 Contract Tests

- `[CT-001]` schema valid / invalid。
- `[CT-002]` unknown enum rejected。
- `[CT-003]` `not-run` requires reason。
- `[CT-004]` `passed` requires command + exit_code + evidence/log ref。
- `[CT-005]` consumer / fusion 层若标 `confirmed_context`，必须有 source refs；`provider-readiness.v1` 自身不承载该字段。
- `[CT-006]` generated runtime path 不得进入 source refs。
- `[CT-007]` 所有新 schema 经 `schema-validator.js` 校验，不存在第二套校验实现（呼应 §7.1）。

## 9.2 Setup / Readiness Tests

- `spec-runtime-setup`（alias `spec-mcp-setup`）verify-only 不安装。
- install plan 输出 commands，但不执行。
- missing provider 输出 `not-run`。
- stale provider 输出 `stale` + next action。
- helper facts 写入 `.spec-first/config/**` 时 path containment 生效。

## 9.3 Verification Tests

- `[VT-001]` package scripts detect。
- `[VT-002]` missing required tool -> not-run/failed + reason_code。
- `[VT-003]` command fail -> failed + exit_code。
- `[VT-004]` dry-run -> schedulable，不是 passed（越界检测：dry-run 不得被写成 verified）。
- `[VT-005]` raw logs 只以 redacted ref 进入 durable artifact。
- `[VT-006]` capture helper 不重跑命令、不推断 exit_code：未经 capture 入口提交的 exit_code 不进入 `verification-run-summary`（越界检测，呼应 §4.4 runner 归属）。
- `[VT-007]` `script_confirmed.validation` 只保留聚合 status + ref，不复制逐 check 明细（越界检测：不产生第二套 evidence enum，呼应 §4.4/§4.5）。

## 9.4 Run Artifact / Closeout Tests

- `[CO-001]` `spec-work-run-artifact` 引用 verification summary（引用即触发 REG-RUNART-002 校验）。
- `[CO-002]` same run-id immutable。
- `[CO-003]` provider raw output 不进入 durable artifact（越界检测）。
- `[CO-004]` final claim without evidence -> violation（越界检测：结构化 claim 缺 evidence_refs 即 unsupported）。
- `[CO-005]` 只有自然语言、无结构化 claim 对象 -> `degraded`，不得标记 verified（越界检测，呼应 §4.6）。
- `[CO-006]` not-run validation closeout 可以 honest but degraded。

## 9.5 Governance Lens Tests

- `[GL-001]` S/M/L/CRITICAL signals 只作为 candidate，不写成 final（越界检测：helper 不得输出 final level）。
- `[GL-002]` gate dry-run only schedulable。
- `[GL-003]` RuleMaturity shadow/advisory/required/blocking 状态转换。
- `[GL-004]` blocking 默认关闭（越界检测：未经人审 + 误报证据不得进入 blocking）。
- `[GL-005]` resource lens 检出 generated output / large file / raw log。

## 9.6 Provider Tests

- `[PV-001]` CodeGraph `not-run` -> source-scan fallback。
- `[PV-002]` CodeGraph stale -> degraded + source-read required。
- `[PV-003]` Graphify artifact missing -> advisory gap。
- `[PV-004]` memory recall（`docs/solutions/` 或研发人员自管的外部 memory 工具）-> advisory unless source/docs confirms。
- `[PV-005]` provider conflict -> fusion.conflicts。
- `[PV-006]` no provider -> workflow still proceeds with direct evidence。
- `[PV-007]` readiness 字段只接受现有 5 值 enum（`fresh/stale/degraded/not-run/unknown`）；轴 B 语义档不得回填 readiness（越界检测，呼应 §5.4 两轴）。
- `[PV-008]` provider readiness=`fresh` 不得单独产生 `confirmed_context`（越界检测：confirmed 必须 direct evidence）。

## 9.7 文档验证

文档-only 变更至少运行：

```bash
git diff --check -- CHANGELOG.md docs/01-需求分析/13.scale集成/spec-first内化集成scale-project-scaffold技术方案.md
```

同时检查文档没有外部仓库页面引用、没有旧的单一 current-state truth 路径口径，且章节表仍覆盖 0-11 章。

---

# 10. 最终落地优先级

## P0：可信交付基线

```text
1. dependency / provider readiness facts          (Phase A)
2. verification-profile                            (Phase B)
3. verification-run-summary                        (Phase B)
4. honest closeout                                 (Phase B，依赖 #3 的真实 exit_code)
5. spec-work-run-artifact integration              (Phase B)
```

理由：直接回答 project-scaffold 四问中的“哪些验证真实运行过，哪些没有运行”。

两轴说明（与 §0.0 一致）：本清单是**构建顺序**（infra-first：readiness 平面先铺，#1 Phase A → #2–#5 Phase B），不是**优先级排序**。按优先级，证据柱（#3 verification-run-summary + #4 honest-closeout）最高——它是"先修最漏的柱子"。#1 readiness facts 是 **enabling infrastructure**：其消费门槛在 Phase B 接入 `spec-work` closeout 时才闭合，不单独作为兑现信任的里程碑（精确阻塞边见 README「开发顺序的依赖与验收约束」：honest-closeout 的硬前置只是 #1 的工具存在性子集）。

依赖顺序（与 §8 对齐）：honest closeout（#4）的 deterministic 校验依赖 verification-run-summary（#3）的真实 exit_code，因此二者同属 Phase B、同列 P0，不拆到 P1 治理阶段。P0 内部按 1→5 的构建依赖顺序落地，且 #1（Phase A / v1.11–v1.12）必须与 #2–#5（Phase B / v1.13）作为同一 P0 可信交付单元规划，不在 Phase B 落地前对外宣称 readiness 已闭合消费门槛。

## P1：治理 lens

```text
1. task-governance-signals
2. gate lens families
3. resource-governance-lens
4. RuleMaturity minimal
5. out-of-scope rationale
```

理由：让 workflow 不只生成文档，还能以轻合同表达风险和缺证据。

## P2：六层 Knowledge Harness

```text
1. project-context-map optional
2. context budget enhancement
3. docs/solutions promotion rules
4. memory recall boundary
5. skill/tool capability lens
```

理由：让知识沉淀和上下文复用进入可治理闭环。

## P3：Capability-aware 协同（外部能力工具）

```text
1. workflow prose 的 capability-class 引导（code-graph / project-graph）
2. 研发人员自管工具的 advisory 输出消费 + 回源确认
3. memory 能力默认走 docs/solutions/（外部 memory 工具不集成）
4. 外部能力 conflict/gap summary
```

理由：研发人员自管的能力工具能提升效率（尤其大仓影响面分析），但 spec-first 只认能力类别、不拥有 provider 生命周期，且必须建立在 readiness、verification、governance/Knowledge Harness 基线和 source confirmation 之后。

## P4：Platform Baseline

```text
1. baseline plan/apply/verify
2. Makefile.spec-first opt-in
3. platform provider profiles
4. multi-host projection report
```

理由：这是团队平台化能力，不应压到 minimal 默认路径。

---

# 11. 最终结论

这次集成应命名为：

```text
spec-first Native Governance Facts + Knowledge Harness Integration
```

核心判断：

- `scale-engine` 告诉 `spec-first`：AI 工程治理可以包含 runtime evidence、verification profile、dependency bootstrap、context budget、code intelligence、memory provider、rule maturity 和 guardrails。
- `project-scaffold` 告诉 `spec-first`：这些能力落到真实项目里时，应该体现为任务分级、探索/计划/验证证据、profile、gate、资源治理、Agent 协作规则和发布前 evidence check。
- `spec-first` 当前代码告诉我们：这些能力必须内化到 existing Harness contracts、`doctor/init/mcp-setup` readiness、`spec-work-run-artifact`、`context-bundle`、`docs/solutions` 和 workflow skills 中。

因此，正确落地不是“把 SCALE 搬进 spec-first”，而是：

```text
先让事实可见，
再让 workflow 消费，
最后才让 provider 和 platform profile 提效。
```

最终成功标准是人和 Agent 都能稳定回答：

1. 这次任务要解决什么问题？
2. 改动影响哪些文件、服务和文档？
3. 哪些验证真实运行过，哪些没有运行？
4. 哪些结论应该沉淀，哪些只是临时过程产物？

并且这些答案不是靠最终回复自述，而是能追溯到 source contracts、deterministic facts、run artifacts、verification summaries、review findings 和 durable knowledge。
