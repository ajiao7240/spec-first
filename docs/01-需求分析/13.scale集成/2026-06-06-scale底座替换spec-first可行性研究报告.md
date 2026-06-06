# SCALE 底座替换 spec-first 可行性研究报告

日期：2026-06-06
作者：leokuang
对象：把 `scale-engine` 当前运行底座作为 `spec-first` 的 runtime，拆除 `spec-first` 原有 CLI/治理逻辑，仅保留 skill / agent / workflow content

## 结论

可以做，但这不是“把 SCALE 集成进 spec-first”，而是把 `spec-first` 产品形态重构为 **SCALE Runtime 的 workflow / skill / agent content pack**。

短期不建议在 `spec-first` v1.x 主线直接替换。合理路径是开一个 v2/spike 分支验证：

```text
SCALE owns runtime:
  host hooks / gates / evidence / memory / context / governance files / upgrade

spec-first owns content:
  spec-driven workflow skills / reviewer agents / entrypoint semantics / knowledge docs / contracts as pack spec
```

只有当 SCALE 能稳定承担以下四件事后，才能删除 `spec-first` 当前 CLI 逻辑：

1. 等价投影 Claude / Codex 的 workflow 入口，并保留 `$spec-*` / `/spec:*` 用户心智。
2. 等价管理 source-of-truth 与 generated runtime 边界，避免 `.scale`、`.spec-first`、`.claude`、`.codex` 多真相源。
3. 等价承载 `spec-first` 的 skill / agent 格式、治理 registry、双宿主 delivery 差异。
4. 有可构建、可版本锁定、可回滚的 `scale-engine` runtime 包。

因此，本报告的建议是：

```text
不在 v1.x 主线“拆掉 spec-first 改用 SCALE”。
先做 spec-first-on-scale v2 spike：
  scale runtime + spec-first content pack + compatibility bridge。
验证通过后，再决定是否退役 spec-first CLI。
```

## 研究问题

用户提出的新思路是：

```text
能否把 scale-engine 当前运行底座集成到 spec-first 中，
拆除 spec-first 中原有逻辑，
spec-first 只保留 skill 和 agent + scale 底座？
```

这句话包含三个独立决策：

| 决策 | 含义 | 影响 |
| --- | --- | --- |
| SCALE 当运行底座 | runtime ownership 从 `spec-first` 转到 `scale-engine` | host config、hooks、gate、evidence、memory、upgrade 归 SCALE |
| 拆除 spec-first 原逻辑 | 删除或迁移 `src/cli/**` 的 init/doctor/clean/session/tasks/internal helper | `spec-first` 不再是独立 AI Coding Harness CLI |
| 只保留 skill / agent | `skills/`、`agents/` 成为内容资产 | 需要 SCALE 能安装、投影、发现、调度这些资产 |

这不是局部技术集成，而是产品边界调整。原父方案的结论是“内化 SCALE 思想，不依赖 SCALE runtime”；本报告刻意换角度，评估“直接换 runtime”的可行性。

## 证据范围

### spec-first 本地证据

- `docs/10-prompt/结构化项目角色契约.md`：定义 `Light contract + Explicit boundaries + Let the LLM decide`，并明确反对中心化流程引擎。
- `docs/contracts/ai-coding-harness.md`：把 `spec-first` 定位为 AI Coding Harness，分为 Context / Execution / Evidence / Evaluation / Governance / Knowledge 六层。
- `package.json`：`spec-first` 是 CommonJS Node CLI，依赖极轻，发布 `src/`、`skills/`、`agents/`、`templates/`、`docs/contracts/**`。
- `src/cli/index.js`：当前 CLI 负责 `init`、`doctor`、`clean`、`tasks`、`session`、`internal` 等命令。
- `src/cli/commands/init.js` 和 `src/cli/plugin.js`：当前核心职责是 source-managed host runtime projection，把 `skills/`、`agents/`、`templates/claude/commands/spec/*.md` 投影到 Claude / Codex。
- `src/cli/contracts/dual-host-governance/skills-governance.json`：登记 workflow command / standalone skill / internal skill 的双宿主 delivery 规则。
- `templates/claude/commands/spec/*.md`：Claude slash command 模板只承载 command metadata，runtime command body 来自对应 `skills/*/SKILL.md`。
- `skills/*/SKILL.md` 和 `agents/*.agent.md`：`spec-first` 真实 workflow 与 reviewer persona 资产。
- `docs/01-需求分析/13.scale集成/spec-first内化集成scale-project-scaffold技术方案.md`：现有父方案明确不调用 SCALE CLI、不依赖 `@hongmaple0820/scale-engine`、不复制 `.scale` / hooks / 状态机。

### scale-engine 本地证据

- `../scale-engine/package.json`：`@hongmaple0820/scale-engine@0.48.0`，ESM TypeScript 包，bin 为 `scale`，发布依赖 `dist`。
- `../scale-engine/docs/AI_ENGINEERING_OS_POSITIONING.md`：明确定位为 Agent Governance Runtime / AI Engineering OS，核心是 workflow FSM、hard gates、hook interception、artifact persistence、context budgets、memory provider routing、skill/tool orchestration。
- `../scale-engine/src/adapters/CodexAdapter.ts`：会写 `.scale/`、`.codex/hooks.json`、`.codex/config.toml`、`AGENTS.md`，并注册 `scale gate pre-tool/post-tool`。
- `../scale-engine/src/adapters/ClaudeCodeAdapter.ts`：会写 `.scale/`、`.claude/settings.json`、`CLAUDE.md`，并注册 SessionStart、PreToolUse、PostToolUse、Stop、SessionEnd hooks。
- `../scale-engine/src/runtime/AiOsRuntime.ts`：提供 `createAiOsPlan/run/status/doctor/adopt`，聚合 context budget、memory、skill plan、governance、runtime evidence。
- `../scale-engine/src/workflow/GovernanceTemplates.ts`：生成 `.scale/verification.json`、`.scale/skills.json`、`.scale/tools.json`、resource/output/product-smoke/standards/frameworks 等治理文件。
- `../scale-engine/src/workflow/GovernanceTemplatePacks.ts`：已有 governance pack 机制，支持 `standard`、`project-scaffold`、`scale-engine-repo`、`node-library` 等。
- `../scale-engine/src/skills/SkillMdStandard.ts`：能解析带 frontmatter 的 `SKILL.md`，但字段较通用。
- `../scale-engine/src/skills/SkillDiscovery.ts`：能扫描不同平台 skills 目录，也有 phase-based `skills/DEFINE|PLAN|...` 扫描逻辑。
- `../scale-engine/src/agents/AgentSourceLoader.ts`：主要加载 YAML agent definition，字段包括 `id/name/domain/inheritsRole/capabilities` 等。
- `../scale-engine/src/runtime/RuntimeEvidenceLedger.ts` 和 `FinalReportGuard.ts`：提供 runtime evidence record 与 final-report readiness。

### 本地运行状态

在 `../scale-engine` 执行只读验证：

```text
node_modules-missing
dist-missing
npm run typecheck -> failed
```

失败主因是本地未安装依赖和类型定义，例如 `@types/node`、`citty`、`better-sqlite3`、`js-yaml` 等缺失；输出中也出现后续 TypeScript 严格类型问题。这个结果不能证明 npm 发布包不可用，但证明当前本地源码不能直接作为 `spec-first` 可替换底座。

## 当前两种系统模型的根本差异

### spec-first 当前模型

```text
source skills / agents / templates / docs
  -> spec-first init projects runtime assets
  -> host exposes /spec:* or $spec-* workflows
  -> LLM reads bounded evidence and decides
  -> helpers only prepare facts
```

`spec-first` 的核心不是强 runtime，而是：

- workflow 入口与方法论。
- source-managed runtime projection。
- 双宿主 delivery 规则。
- deterministic helpers 产出 readiness / evidence / reason_code。
- LLM 做语义判断。

它故意避免成为中心化状态机。

### SCALE 当前模型

```text
scale init
  -> writes .scale governance runtime
  -> writes host settings / hooks / knowledge docs
  -> intercepts tools through gates
  -> persists runtime evidence / memory / artifacts
  -> runs ai-os plan/run/status/doctor
```

SCALE 的核心是 runtime ownership：

- hook 拦截。
- workflow/gate/FSM。
- `.scale` 状态与治理文件。
- runtime evidence ledger。
- memory/context/skill/tool routing。
- upgrade/governance pack。

它的价值是把 prompt 纪律下沉到系统约束。

### 关键冲突

两者不是简单上下游，而是都在试图拥有 host runtime。

| 面 | spec-first 当前 owner | SCALE 当前 owner | 冲突 |
| --- | --- | --- | --- |
| Host instruction | `AGENTS.md` / `CLAUDE.md` managed blocks | adapter 生成 `AGENTS.md` / `CLAUDE.md` | 双写同一入口文档 |
| Host settings/hooks | `spec-first init` 管理 runtime assets，不手改 generated mirror | `scale init` 写 `.codex/hooks.json` / `.claude/settings.json` | runtime ownership 冲突 |
| Workflow entrypoints | `/spec:*` + `$spec-*` | `scale define/plan/build/verify/review/ship/run/ai-os` | 用户入口心智冲突 |
| Evidence | `.spec-first/workflows/**` + docs contracts | `.scale/evidence/**` + runtime doctor | evidence truth 冲突 |
| Setup/readiness | `$spec-runtime-setup` / `doctor` facts | `scale setup/bootstrap/doctor` | readiness schema 冲突 |
| Knowledge | `docs/solutions/` + promotion boundary | memory providers / Memory Brain / Graphify KB | durable knowledge owner 冲突 |
| Skill/agent assets | `skills/` / `agents/*.agent.md` + governance registry | skill registry / phase skills / YAML agent loader | asset format不完全兼容 |

所以如果采用 SCALE 底座，必须明确：**SCALE 是 runtime owner，spec-first 不能继续拥有 runtime projection**。否则会产生三套状态：source、`.spec-first`、`.scale`。

## 换底座的三种架构选项

### 选项 A：维持现有父方案，SCALE 思想内化

```text
spec-first keeps CLI/runtime projection
SCALE provides architecture inspiration only
```

特点：

- 不依赖 `@hongmaple0820/scale-engine`。
- 不复制 `.scale` runtime / hooks / FSM。
- 把 SCALE 的 dependency readiness、verification evidence、context budget、knowledge harness、governance lens 转成 `spec-first` 自有 contracts/helpers。

优点：

- 与现有角色契约完全一致。
- 迁移成本最低。
- 不破坏已落地的 v1.11-v1.15 路线。
- 保持 `spec-first` 小、轻、source-first。

缺点：

- runtime 能力弱于 SCALE。
- 很多 evidence/gate/memory 能力需要在 `spec-first` 里重复建设轻量版。
- 长期可能把 `spec-first` 变成“轻量 SCALE”，出现重复造轮子。

适用：

- v1.x 主线。
- 继续保持 `spec-first` 是独立 AI Coding Harness。

### 选项 B：SCALE 作为 optional runtime provider

```text
spec-first keeps current CLI
scale is optional provider:
  setup detects scale
  workflows may consume scale facts as advisory
```

特点：

- `spec-first` 不依赖 SCALE。
- `scale doctor/status/ai-os` 输出可作为 external-tool advisory evidence。
- `spec-first doctor` 可显示 SCALE readiness，但不把它变成 minimal baseline blocker。

优点：

- 能吃到 SCALE runtime 能力。
- 不强制所有用户安装更重的 runtime。
- 可逐步验证哪些 SCALE facts 真能改善 `spec-plan/work/review/debug`。

缺点：

- `spec-first` 和 SCALE 仍各有 runtime owner。
- 如果消费侧偷懒依赖 SCALE 内部字段，会重演 provider 耦合问题。
- 用户会困惑：什么时候用 `spec-first`，什么时候用 `scale`？

适用：

- 作为过渡阶段。
- 评估 SCALE facts 对 workflow 成果的真实提升。

### 选项 C：SCALE 成为底座，spec-first 变成 content pack

```text
scale owns runtime
spec-first package contains:
  skills/
  agents/
  workflow entrypoint manifest
  compatibility docs/contracts
```

特点：

- `spec-first` 删除大部分 CLI runtime 逻辑。
- `scale init --governance-pack spec-first` 或等价命令安装 spec-first workflows。
- `/spec:*` / `$spec-*` 只是由 SCALE 投影出来的 content entrypoints。

优点：

- 避免 `spec-first` 重建 runtime evidence、gate、memory、context、upgrade。
- SCALE 的运行层能力更完整。
- 长期产品边界更清晰：SCALE 是 OS，spec-first 是 spec-driven workflow distribution。
- 可以减少 `spec-first` 自身的 CLI 维护面。

缺点：

- 这是产品重构，不是 v1.x feature。
- 违背当前父方案和角色契约中“非中心化 runtime”的默认姿态，除非明确将 `spec-first` 重新定位。
- 要求 SCALE 成熟到能稳定承接双宿主 projection、pack upgrade、content versioning、skill/agent compatibility。
- 当前本地 `scale-engine` 未 build 验证，不能立即承载。

适用：

- v2/spike。
- 目标是把 `spec-first` 归并成 SCALE 生态中的官方 workflow pack。

## 如果采用 SCALE 底座，spec-first 应保留什么

“只保留 skill 和 agent”方向基本对，但严格说不够。至少还要保留一层轻量 pack metadata / contracts，否则 SCALE 不知道如何投影和治理这些内容。

建议保留：

| 保留项 | 理由 | 归属 |
| --- | --- | --- |
| `skills/**/SKILL.md` | workflow 方法论本体 | spec-first content |
| `agents/*.agent.md` | review/research persona 本体 | spec-first content |
| workflow entrypoint manifest | `$spec-*` / `/spec:*` 名称、description、argument-hint、host delivery | spec-first pack metadata |
| dual-host alias map | Claude command vs Codex skill 的投影差异 | spec-first pack metadata，SCALE runtime 消费 |
| `docs/contracts/**` 的核心合同 | 作为 content pack 的语义合同和兼容说明 | spec-first docs，SCALE 不应内联复制 |
| `docs/solutions/**` | durable knowledge corpus | spec-first knowledge content，SCALE 可索引但不改写 |
| README / CHANGELOG / migration docs | 用户理解和版本迁移需要 | spec-first package docs |
| 最小 package manifest | 发布、版本锁定、pack discovery | spec-first distribution |

可以删除或迁移：

| 当前 spec-first 逻辑 | 迁移后 owner | 删除前提 |
| --- | --- | --- |
| `src/cli/commands/init.js` | SCALE adapter / pack installer | SCALE 能投影 spec-first pack 到 Claude/Codex，并支持 preview-first |
| `src/cli/commands/doctor.js` | `scale doctor` + spec-first pack doctor | SCALE 能检查 pack assets、host projection、readiness、drift |
| `src/cli/commands/clean.js` | `scale clean/uninstall pack` | SCALE 能只移除 spec-first-owned assets，不误删用户 runtime |
| `src/cli/plugin.js` | SCALE pack manifest loader | SCALE 能读取 `skills-governance.json` 等价信息 |
| `src/cli/contracts/dual-host-governance/**` | spec-first pack manifest or SCALE pack schema | SCALE schema 覆盖 entry_surface / host_scope / host_delivery |
| `src/cli/helpers/context-bundle.js` | `scale context pack` 或 content-aware context compiler | SCALE 输出能保留 source-read requirements、generated mirror exclusion、summary-first |
| `src/cli/helpers/spec-work-run-artifact.js` | SCALE runtime evidence / run report | SCALE evidence 能映射 honest-closeout、not-run、provider_untrusted 等语义 |
| `src/cli/commands/session.js` | SCALE session ledger | SCALE 能提供多 actor advisory、不会强状态机化 |
| `src/cli/commands/tasks.js` | SCALE artifact/task validation | SCALE 能验证 task pack hash/spec_id 或 spec-first 放弃该模式 |
| `scripts/*` tests/build helpers | SCALE package tests + pack tests | 有新的 pack-level CI |

不能直接删除：

| 不能直接删除的语义 | 原因 |
| --- | --- |
| `source-of-truth -> generated runtime` 边界 | 删除后会失去“改 source，不手改 runtime”的治理纪律 |
| 双宿主 entrypoint parity | `spec-first` 的用户入口价值依赖 Claude/Codex 一致性 |
| workflow command vs standalone/internal skill 区分 | 否则所有 skill 都会被错误暴露为用户入口 |
| advisory vs confirmed evidence 词义 | SCALE 的 runtime evidence 更强，但 external provider 输出仍不能自动变成 confirmed truth |
| summary-first / 回源纪律 | SCALE 的 context pack 不能替代 source-read confirmation |
| `docs/solutions` promotion gate | memory provider 或 recall 命中不能替代 verified durable knowledge |

## 关键技术缺口

### 1. host runtime projection 缺口

SCALE 现在的 adapter 会直接生成通用 SCALE 文案和 hooks：

- Codex：`.codex/hooks.json`、`.codex/config.toml`、`AGENTS.md`。
- Claude：`.claude/settings.json`、`CLAUDE.md`。

这不是 `spec-first` 的 current behavior。`spec-first` 需要：

- Claude `/spec:*` command templates。
- Codex `$spec-*` skill entrypoints。
- internal helper skills 不暴露。
- managed block 与 source mirror 可追踪。
- runtime regeneration 可重复、可 clean。

因此需要新增 `spec-first` governance/content pack：

```text
scale init --governance-pack spec-first
  -> read spec-first pack manifest
  -> preview host writes
  -> project /spec:* and $spec-* entrypoints
  -> install or link skills and agents
  -> record pack lock
```

没有这个 pack，SCALE 只能接管项目为 SCALE 项目，不能等价接管为 spec-first 项目。

### 2. skill 格式基本兼容，但 trigger/argument 语义会丢

`spec-first` skill frontmatter 常见字段：

```yaml
name: spec-work
description: ...
argument-hint: ...
```

SCALE `SkillMdStandard` 支持：

```yaml
name
description
version
preamble-tier
allowed-tools
triggers
type
```

基础 `name/description` 可读，但 `argument-hint`、workflow command metadata、Codex/Claude delivery 规则不在 SCALE 标准字段中。若直接扫描，只会把 spec-first skill 当普通 skill，不会得到正确 entrypoint。

### 3. agent 格式不兼容

`spec-first` agents 是 Markdown agent 文件：

```text
agents/spec-architecture-strategist.agent.md
frontmatter: name / description / model / tools
body: persona and review protocol
```

SCALE `AgentSourceLoader` 主要加载 YAML：

```yaml
id
name
domain
inheritsRole
capabilities
preferredModel
...
```

所以 agent 需要二选一：

1. SCALE 扩展 loader，支持 `.agent.md`。
2. `spec-first` pack build 时生成 SCALE YAML shadow profiles。

不建议手工维护两套 agent source。正确方向是保留 `agents/*.agent.md` 为 source，由 pack build 生成 SCALE 可消费格式。

### 4. evidence 语义不等价

SCALE `RuntimeEvidenceLedger` 有 `kind/status/command/exitCode/summary/artifacts`，很适合承载实际执行证据。

但 `spec-first` 还有一些语义必须保留：

- `provider_untrusted`
- `direct_evidence_used`
- `source_reads_required`
- `not-run: missing_dependency`
- `degraded`
- `script_confirmed.validation`
- run artifact 对 plan/task/review 的 traceability

这不是字段名偏好，而是防止 LLM 把 advisory output 写成 confirmed claim 的边界。迁移时不能简单用 SCALE evidence 替代，必须做 mapping。

### 5. memory/knowledge owner 冲突

SCALE 倾向于 memory provider routing、Memory Brain、GraphifyKnowledgeBase、Cerebrum、out-of-scope 等 runtime memory。

`spec-first` 当前方向是：

```text
docs/solutions promotion + recall-as-advisory + source-read confirmation
```

如果换底座，建议：

- SCALE 可索引 `docs/solutions`。
- SCALE 可提供 recall。
- durable write 仍走 spec-first promotion gate 或明确的人审流程。
- 不允许 memory provider 自动把会话经验写成 spec-first durable knowledge。

否则会把“可召回记忆”和“已验证工程知识”混为一谈。

### 6. 本地可运行性不足

当前 `../scale-engine`：

- 无 `node_modules`。
- 无 `dist`。
- `npm run typecheck` 失败。

如果把它作为底座，必须先把 runtime 作为外部版本化依赖验证，而不是直接引用本地源码。

最低要求：

```text
npm install -g @hongmaple0820/scale-engine@<pinned>
scale --version
scale init --governance-pack spec-first --dry-run --json
scale doctor --json
scale pack doctor spec-first --json
```

当前这些 spec-first pack 命令尚不存在。

## 是否过度设计

### 作为 v1.x 默认路线：过度设计

如果现在把 `spec-first` 主线改成 “skills/agents + SCALE runtime”，会同时引入：

- 新 runtime dependency。
- ESM/TS build 与发布链路。
- `.scale` runtime state。
- host hooks/gates。
- pack schema。
- agent format adapter。
- evidence mapping。
- migration/clean/rollback。
- 双宿主投影重写。

这远超 v1.15 Knowledge Harness 或 v1.16 capability-aware 协同的范围。对现有用户而言，收益不确定但迁移成本立刻发生。

### 作为 v2/spike：不算过度设计

如果目标是重新定位：

```text
SCALE = AI Engineering OS
spec-first = spec-driven workflow pack
```

那么用 SCALE 做 runtime 反而是边界清晰的。它能避免 `spec-first` 长期重复建设 runtime evidence、gate、memory、context、upgrade。

关键是不要半迁移。半迁移会最糟：

```text
spec-first init still writes runtime
scale init also writes runtime
workflows sometimes read .spec-first
gates sometimes read .scale
skills installed in both places
```

这会形成多真相源。

## 推荐决策

### 主线建议

保持 v1.x 父方案不变：

```text
spec-first v1.x:
  source-first harness
  scale ideas internalized
  no runtime dependency on scale-engine
```

原因：

- 当前 v1.11-v1.15 已沿 “Native Governance Facts + Knowledge Harness” 路线推进。
- 该路线符合角色契约。
- 用户可见入口稳定。
- 当前 `scale-engine` 本地源码未 build 验证，不适合作为 immediate base。

### 探索建议

新增 v2/spike：

```text
branch or doc line: spec-first-on-scale
goal: prove spec-first can be a SCALE governance/content pack
non-goal: do not delete spec-first CLI in main until parity is proven
```

成功标准必须是可运行的，而不是概念一致：

1. `scale` 能 dry-run 安装 spec-first pack，并展示将写入哪些 host assets。
2. Claude 能看到 `/spec:plan`、`/spec:work`、`/spec:doc-review` 等入口。
3. Codex 能看到 `$spec-plan`、`$spec-work`、`$spec-doc-review` 等入口。
4. internal-only skills 不被暴露。
5. `agents/*.agent.md` 能被 SCALE 注册或生成等价 profile。
6. `docs/solutions` 能被 recall，但 recall 结果标 advisory 且要求回源。
7. 一次 `spec-work` 类任务能产生 SCALE runtime evidence，并映射到 spec-first closeout 语义。
8. `scale clean/uninstall spec-first` 能只移除 pack-owned assets。

## 最小落地顺序

### Phase 0：不要动主线，只写 spike contract

产物：

- `docs/01-需求分析/13.scale集成/spec-first-on-scale-v2-spike.md`
- 定义 ownership：
  - SCALE owns runtime。
  - spec-first owns content pack。
  - Host assets owned by SCALE pack lock。
- 定义 non-goals：
  - 不让 `spec-first` 主线依赖 SCALE。
  - 不手改 generated runtime。
  - 不自动安装第三方 memory/codegraph provider。

验收：

- 文档审查通过。
- 没有 source/runtime owner 模糊表述。

### Phase 1：pack manifest 只读适配

在 SCALE 侧或 spike 脚本中读取：

- `skills/**/SKILL.md`
- `agents/*.agent.md`
- `templates/claude/commands/spec/*.md`
- `src/cli/contracts/dual-host-governance/skills-governance.json`

输出：

```json
{
  "pack": "spec-first",
  "commands": [],
  "skills": [],
  "agents": [],
  "warnings": []
}
```

验收：

- 不写文件。
- 能准确区分 workflow command / standalone skill / internal-only。
- 能发现 unsupported agent fields。

### Phase 2：host projection dry-run

新增或验证：

```text
scale init --governance-pack spec-first --dry-run --json
```

输出所有计划写入：

- `AGENTS.md` managed block。
- `CLAUDE.md` managed block。
- `.claude/commands/spec/*.md` 或 SCALE 等价 host command assets。
- Codex skill entrypoints。
- agent profiles。
- `.scale/governance.lock.json` pack ownership。

验收：

- 不直接覆盖现有 `spec-first` source-managed blocks。
- 输出 clean/uninstall plan。

### Phase 3：兼容运行

在独立 worktree 或 sandbox repo 里安装：

```text
scale init --governance-pack spec-first --agent codex
scale init --governance-pack spec-first --agent claude-code
```

验收：

- 两个 host 入口都能触发 spec-first workflows。
- SCALE gates 不阻止正常 read-only research/review。
- Stop gate 不强迫所有轻量 docs 任务跑重测试。
- runtime evidence 能记录 command exit code。

### Phase 4：迁移判断

只有当 Phase 1-3 都通过，才评估删除 `spec-first/src/cli`。

删除策略：

```text
v2:
  spec-first package may become content pack
  current CLI commands deprecated
  spec-first init prints migration guide or delegates to scale

v3:
  remove CLI runtime logic if adoption and parity are stable
```

不建议一步到位删除。

## 需要重写的产品定位

如果采纳 SCALE 底座，`spec-first` README 不能再说自己是完整 AI Coding Harness CLI。更准确的定位是：

```text
spec-first is a spec-driven workflow pack for SCALE Runtime.

It provides:
  - spec-first workflow skills
  - reviewer/researcher agents
  - spec/plan/work/review/knowledge contracts
  - Claude/Codex entrypoint semantics

SCALE provides:
  - host runtime installation
  - gates/hooks/evidence/session/context/memory
  - pack upgrade/clean/doctor
```

这会让品牌关系变成：

```text
SCALE: operating layer
spec-first: opinionated workflow distribution
```

这条路更像生态合并，不像普通 feature。

## 最终判断

我认为“把 SCALE 当 spec-first 底座”在长期架构上有吸引力，但在当前阶段不应替换主线。

理由：

1. 它解决的是 `spec-first` 未来可能重复造 runtime 的问题，不是 v1.15/v1.16 当前最紧的交付可信度问题。
2. 它要求 SCALE 拥有全部 runtime truth，否则会产生 `.scale` 与 `.spec-first` 双真相源。
3. 当前 SCALE 已有足够 runtime 骨架，但缺少 `spec-first` pack 级适配、agent loader 兼容、host entrypoint parity 和本地 build 验证。
4. 直接删除 `spec-first` 原逻辑会丢掉最核心的双宿主投影语义和 source/runtime 边界，除非 SCALE 先等价实现。

推荐路线：

```text
v1.x:
  继续走父方案：内化 SCALE 能力，保持 spec-first 独立。

v2 spike:
  建 spec-first-on-scale content pack。
  证明 SCALE 可以完整接管 runtime。

v2/v3 决策:
  如果 spike 证明成本低、稳定性高、用户心智清晰，再让 spec-first 退役 CLI runtime。
```

一句话：

> 可以把 SCALE 变成 spec-first 的运行底座，但前提是承认 `spec-first` 不再是独立 runtime，而是 SCALE 上的 spec-driven workflow pack。这个方向值得 v2/spike，不适合现在直接拆主线。

## 已执行验证

- 读取 `spec-first` 角色契约、AI Coding Harness 合同、SCALE 集成父方案、CLI init/plugin/skills-governance、skill/agent/template source。
- 读取 `scale-engine` package、AI OS 定位、Codex/Claude adapter、AiOsRuntime、GovernanceTemplates/GovernanceTemplatePacks、SkillMdStandard、SkillDiscovery、AgentSourceLoader、RuntimeEvidenceLedger、FinalReportGuard。
- 执行 `spec-first session list --json`：`active_count=0`。
- 执行 `../scale-engine` 本地状态检查：`node_modules-missing`、`dist-missing`。
- 执行 `npm run typecheck` 于 `../scale-engine`：失败，主要因依赖/类型缺失并伴随后续 TS 类型错误。

未执行：

- 未安装 `scale-engine` 依赖。
- 未运行 `scale init`，因为当前研究不应改写 host runtime。
- 未做 fresh-source eval 或多 agent 审查，本轮用户未显式要求多 agent 调度。

---

## 增补：多 Agent 对抗复核（2026-06-05，5 视角尽调 + 5 方案红队）

> 本节由一次多 agent workflow 补强：5 路并行尽职调查（拆除影响面 / scale 底座能力 / 集成摩擦 / 战略哲学 / 方案空间）+ 对 5 个候选方案逐个红队对抗裁决。它**补上本报告原「未执行」中标注的「多 agent 审查」缺口**，结论与本报告主体一致并强化，新增「逐 file:line 源码取证」与「OPT-D/OPT-E 显式裁决」两层增量。advisory 性质，落地前以 plan 再取证为准。

### 增-1 方案空间扩展（3 → 5）与红队裁决

本报告原文给了 3 选项（A 内化 / B provider / C 全替换）。对抗复核把它扩为 5 个互斥方案并逐个红队，结论：

| 方案 | 定位 | 技术可行性 | 所有权风险 | 哲学冲突 | 可逆性 | 红队裁决 |
| --- | --- | --- | --- | --- | --- | --- |
| **OPT-A 全替换**（= 本报告选项 C，用户原始设想） | scale 当唯一底座，spec-first 降为 content pack | barely-feasible（且须先重建 scale 缺失的投影/证据链能力 = 逻辑自噬） | 演化主导权完全外移 | **全面冲突**（5 条立身之本逐条违背） | hard-to-reverse | **not-recommend** |
| **OPT-B scale 作 optional provider**（= 本报告选项 B） | readiness gate 后接入，只消费 advisory facts | feasible（CLI shell-out 绕开 ESM/CJS，最干净） | 留在 spec-first（install-level 耦合） | 基本通过，1 个渗漏点需硬约束 | reversible | **conditional**（有界实验，非默认开启） |
| **OPT-C 抽取式 bounded library** | 只吸收 Cortex/RuntimeEvidenceLedger 等引擎为受控库 | barely-feasible（5 模块都不在公共 export 面，只能走 unsupported 内部路径或带 TS 管线 vendoring） | 中高（耦合上游未支持内部 API） | 多处冲突（Shield=blocking 执行器、ReflexionEngine 需 gate 事件流） | hard-to-reverse | **conditional**（唯一可接受实现即退化为 OPT-D） |
| **OPT-D 维持底座 + 持续内化**（= 本报告选项 A / 父方案现行路线） | 不引入 scale code，把思想重写为自有轻量 contract | feasible（已被 v1.11–v1.15 执行本身证明） | **近乎为零** | **零正面冲突** | reversible | **recommend（主线）** |
| **OPT-E 纯维持现状（冻结内化）** | scale 仅作竞品对标，不再主动借鉴 | trivially feasible（零改动） | 零 | 不违背，但 80/20 反向张力 | reversible | **not-recommend（温和）**：把「拒绝换底座」过度泛化成「拒绝一切借鉴」，被 OPT-D 严格支配 |

**核心判断**：四轴（可行性 / 所有权 / 差异化 / 可逆性）同时为正、且与立身之本零冲突的**只有 OPT-D**，应为主线；OPT-B 是 OPT-D 之后可选的有界实验（用来实证 scale facts 是否真改善 workflow 成果）；OPT-A/OPT-C 代码级耦合不推荐；OPT-E 过度保守、被 OPT-D 支配。

### 增-2 红队对 OPT-A（全替换）的逐条源码取证

本报告主体已论证全替换不可取；对抗复核进一步用 scale 源码 file:line 钉死了几个**致命阻塞**：

1. **scale 的 gate 是 `process.exit(2)` 物理阻断**：`scale-engine/src/cli/gateInlineCommands.ts:17-23` 实测 gate block 即 `process.exit(2)`；`gateBeforeStop` 对所有会话停止做 phase 检查（读 `.scale/workflow.json` currentPhase），**无法选择性禁用 FSM 而保留其他能力**。把 advisory content 跑在 blocking runtime 上需持续反向施力。
2. **projection「皇冠明珠」缺口（致命）**：scale 没有 init.js 双宿主 source→runtime 投影的等价物——`cortex/adapters/*` 只是 hook stdin parser，`generate-skeleton.mjs` 是硬编码 Windows 路径的过时内部工具，`SetupVerification` 只等价 doctor 不等价 init。要全替换必须先在 scale 上重建这块——**那 scale 到底替换了什么？逻辑自噬**。
3. **本地不可 build**：`scale-engine/dist` 与 `node_modules` 均不存在，typecheck 失败。parity 未证明就做不可逆动作，风险更高。
4. **格式不兼容**：spec-first 51 个 `.agent.md`（frontmatter + md prose）vs scale AgentSourceLoader 的 YAML（id/domain/inheritsRole/capabilities），需全量转换。
5. **诚实修正一处误判**：对抗复核实测 spec-first 的核心 SKILL.md（spec-work/spec-plan/spec-brainstorm/using-spec-first）**已带 YAML frontmatter**，原研究中「SKILL.md 无 frontmatter = critical 迁移阻塞」的说法被推翻——但**不改变总裁决**，因为真正的阻塞在 projection / 证据链 / 哲学 / 所有权层，与 frontmatter 无关。

### 增-3 拆除影响面的确定性清单（拆掉后会发生什么）

对抗复核逐 file 核实了「拆除 spec-first CLI 只留 skill+agent」的后果（spec-first 仓库 file:line）：

| 被拆组件 | 后果 | 严重度 |
| --- | --- | --- |
| `init.js` 双宿主投影（`plugin.js:1154-1156` + `adapters/claude.js:51-60`） | **Claude Code 内所有 `/spec:*` slash command 物理消失**（命令体来自 skills/*/SKILL.md 注入，无投影即空壳） | critical |
| `internal.js` 五步取证链（`internal.js:29-49`） | spec-work Phase 4 closeout 无法写 `run.json`，无 honest-closeout 结构化结论，无跨 run 证据 | critical |
| `doctor.js`（1034 行） | spec-update 整个 workflow 失效（无法判断 runtime stale / bootstrap 完整性） | critical |
| `tasks.js`（SHA-256 hash） | spec-work 遇任务包即被迫 stop，spec-write-tasks 无法填 source_plan_hash | critical |
| `session.js` / `task-governance-signals` | spec-plan governance 输入消失；并发检测降级（有显式 fallback） | high/medium |
| **纯 prose 方法论 skill（约 8 个）** | spec-brainstorm/spec-prd/spec-ideate/spec-compound 等无 CLI 调用，**可独立存活**（但仍需宿主能 dispatch） | low |

结论印证本报告：**只留 skill+agent 而拆掉 CLI，等于拆掉「让 skill 能被 Claude Code 调用」和「让结论有持久证据」这两条命脉**；纯 prose 部分能活，但失去 spec-first 之所以为 harness 的一切。

### 增-4 集成摩擦的四层结构性技术债（源码取证）

1. **语言栈二元性**：scale `"type":"module"` + 327 个 `.ts` + 14 依赖含 better-sqlite3 原生编译；spec-first `"type":"commonjs"` + 2 依赖。CJS `require()` ESM 触发 `ERR_REQUIRE_ESM`，只能 dynamic import() 把 async 边界传染调用方。`scale-engine/package.json:14`、`tsconfig.json:4-5`、`spec-first/package.json:108-113`
2. **外部所有权**：`@hongmaple0820/scale-engine@0.48.0` 独立发布节奏；pin 后 spec-first 修任何 contract bug 须等上游发布；直接 import `FSMAgentBridge/AiOsRuntime/GovernanceTemplates` 会让 scale 内部类型进入 spec-first contract surface（违背「provider 内部实现不泄漏成 contract」）。
3. **FSM + G0-G22 + hook 不可分离**：`src/artifact/fsmDefinitions.ts`（11 FSM）+ `src/workflow/types.ts`（GateStage G0..G22）+ `ClaudeCodeAdapter.ts:84-104`（5 hook 全调 scale CLI）是一个整体，无官方 API 允许「只用 runtime 不启用 FSM/gate」。
4. **多真相源**：scale `writeGovernanceTemplates()` 声明 `.scale/verification.json` 为 source of truth + 写 `.claude/settings.json` hooks；与 spec-first 的 44 contracts、双宿主 projection 在 settings.json/CLAUDE.md/AGENTS.md 上**双写冲突**（scale mergeSettings 仅检查 command 含 'scale '，不保 spec-first hook 完整性）。

### 增-5 增补结论

对抗复核**完全支持本报告主体结论且更强**：

> **技术上**：全替换 barely-feasible（须先重建 scale 缺失的投影/证据链 = 逻辑自噬，且本地不可 build）。
> **战略上**：不该做——它删掉 spec-first 唯一的 durable 差异化（轻量信任-LLM 的 harness runtime + 双宿主投影 + 边界主导权），保留的 skills/agents prose 恰是任何 harness 都能复制的 commodity，结果是把 spec-first 溶解成 scale 的一个 content pack/skin，演化主导权移交哲学相反、快速移动的外部包。
> **正确路径**：主线走 **OPT-D（思想内化，= 本报告选项 A / 父方案）**，已被 v1.11–v1.15 落地 + npm test 全绿背书；**OPT-B（advisory provider）**作为可随时撤的有界实验做增量实证；全替换严格关进不碰主线、不删 CLI、带 kill switch 的 v2 spike。

> **本增补已执行验证**：5 路尽调 agent 读取 spec-first（init.js/plugin.js/internal.js/doctor.js/tasks.js/session.js/skills/agents/contracts）与 scale-engine（package.json/tsconfig/gateInlineCommands.ts/fsmDefinitions.ts/adapters/AgentSourceLoader.ts/SkillFrontmatter.ts/OrchestratorDaemon.ts 等）源码取证；5 方案逐个红队对抗裁决。**未执行**：未安装 scale 依赖、未运行 scale init、未做隔离 v2 spike 实际验证（属未来 explore 建议，非本轮范围）。
