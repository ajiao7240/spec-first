# spec-first 集成 GBrain / Graphify / CodeGraph 技术方案

> 本文是 `spec-first内化集成scale-project-scaffold技术方案.md` 的专项子方案。
> 父方案负责定义总边界、优先级和实施节奏；本文只展开 GBrain / Graphify / CodeGraph 三个 optional provider 的安装、启动、刷新、workflow 使用和验收口径。

---

## 0. 校准结论

三者**不平级集成**。校准后的核心结论是：把交付面从「三 provider 平级集成」收敛为 **CodeGraph 单点 opt-in pilot（先测量再默认）+ Graphify 降为手动 artifact-doc + GBrain 后置**，且任何一个都不能作为独立的 `Context Intelligence Plane` 覆盖当前 `spec-first` Harness。

### 0.0 先读：GitNexus 前史与「这次为什么不同」

`docs/plans/2026-06-02-001-refactor-remove-gitnexus-integration-plan.md`（status: completed）已把 GitNexus 这一图谱 provider 从 active product surface **硬删除**，明文「删除后的默认上下文路径是 bounded direct source reads、`rg`、ast-grep、git diff、tests/logs……**本期不新增替代 graph provider，也不保留 provider-neutral graph-bootstrap 空壳**」。

这是仓库里关于「再加图谱 provider」最强的本地经验信号——同类能力刚被试过并否决。因此本方案的首要前提不是「CodeGraph 是不是好工具」，而是**论证这次架构本质不同**：

- GitNexus 当年失败于**深度耦合、非可选**——它横跨 setup registry、host instruction、startup reminder、workflow routing、`spec-graph-bootstrap` public workflow、review-pre-facts helper、contracts、CI gate 和 package allowlist。
- 本方案把 provider 钉死为 **P3 / optional / 非阻塞 / minimal 不装 / 缺失即 fallback / opt-in pilot 先测量**，且不新增 public workflow、不注入 startup reminder、不进 baseline gate。这正是对 GitNexus 教训的正确回应。
- 时序上：GitNexus 移除明文「本期不加替代」，本方案落在其后的 **v1.16（父方案最后一批，当前未开始）**，链路不冲突；但重引入必须以「可选、可降级、先有实测增益」为硬前提，不得默认。

### 0.1 收敛后的定位

```text
CodeGraph = Code evidence candidate provider（唯一 pilot，opt-in，先测量再默认）
Graphify  = 架构 artifact-doc（刷新归 Graphify 自身 hook/手动；spec-first 移出 readiness loop、不接管、不进 recommended）
GBrain    = 后置（defer）；先强化 file-first docs/solutions，出现实测 recall 缺口再评估
```

它们进入 `spec-first` 的方式是：

```text
Provider readiness / freshness / fallback facts
  -> existing context-bundle / artifact-summary / run artifact
  -> workflow LLM judgment
  -> source-read / test / log / review confirmation
  -> optional durable knowledge promotion
```

明确不是：

```text
不是新增中心化 Context Intelligence Plane。
不是新增强 Query Router 替代 workflow 判断。
不是默认安装、默认刷新、默认写长期记忆。
不是让 provider 输出直接成为 finding、root cause、scope authority 或 confirmed truth。
不是把外部工具 README 当作 spec-first 当前 source-of-truth。
不是三 provider 平级集成；不是在 Claude Code 内重建一层 grep/检索；不是移植上游 SCALE 的硬编码 confidence / vanity ROI 模型。
```

父方案优先级更高：

```text
P0: dependency readiness / verification summary / honest closeout
P1: governance lens
P2: six-layer Knowledge Harness
P3: optional providers
P4: platform baseline
```

因此，本文中的 provider 集成必须排在 readiness、verification、honest closeout、governance lens foundation 和 Knowledge Harness 基线之后。

---

## 1. 本地证据基础

本方案依据本地 source，不使用远端 GitHub 页面作为 `spec-first` 当前状态依据。

| 来源 | 本地证据 | 对本文的约束 |
| --- | --- | --- |
| `spec-first` role contract | `docs/10-prompt/结构化项目角色契约.md` | 必须保持 `Light contract + Explicit boundaries + Scripts prepare, LLM decides` |
| Harness contract | `docs/contracts/ai-coding-harness.md` | External tools/providers 在 source/test/log/schema/contract 或用户确认前都是 advisory |
| Context bundle | `docs/contracts/context-bundle.md`、`src/cli/helpers/context-bundle.js` | 不实现中心化 router；上下文传递走 bounded envelope |
| Runtime setup | `skills/spec-mcp-setup/SKILL.md`、`mcp-tools.json`、setup scripts | `spec-runtime-setup`（alias `spec-mcp-setup`）owns deterministic readiness facts，不 owns semantic code understanding |
| Doctor | `src/cli/commands/doctor.js` | v1.12 起 `doctor --json` 已从 `tool-facts.json` 计算 `decision_input_health` + basis；provider readiness 是其增量消费，不从零建 contract |
| Run artifact | `docs/contracts/workflows/spec-work-run-artifact.schema.json`、`src/cli/helpers/spec-work-run-artifact.js` | 已有 `provider_untrusted`、`direct_evidence_used`、`script_confirmed`，不先造平行 evidence truth |
| **provider-readiness（已落地）** | `docs/contracts/provider-readiness.{md,schema.json}`、producer `src/cli/helpers/setup-facts.js`、consumer `src/cli/helpers/spec-work-run-artifact.js` | `provider-readiness.v1` schema/producer/consumer 已 shipped；v1.16 是**增量消费**，复用既有 schema，不重建 readiness 合同 |
| **GitNexus 移除前史（关键）** | `docs/plans/2026-06-02-001-refactor-remove-gitnexus-integration-plan.md`（completed） | 同类图谱 provider 三天前已硬删除且明文「本期不加替代」；重引入必须论证「这次为何不同」（见 §0.0），并守住 optional/非阻塞 |
| SCALE Code Intelligence | `/Users/kuang/xiaobu/scale-engine/src/codegraph/CodeIntelligence.ts` | 可借鉴 provider + fallback；不要复制 `.scale` truth |
| SCALE Memory | `/Users/kuang/xiaobu/scale-engine/src/memory/MemoryProviders.ts` | GBrain external write 默认 disabled，recall 是 evidence candidate |
| SCALE Bootstrap | `/Users/kuang/xiaobu/scale-engine/src/bootstrap/DependencyBootstrap.ts` | GBrain / Graphify / CodeGraph 属于 pack/profile item，安装需要 explicit apply |
| project-scaffold | `/Users/kuang/xiaobu/project-scaffold/.scale/code-intelligence.json` | CodeGraph/Graphify 是 enabled provider + fallback 样板，不是 spec-first 默认强路径 |

> 入口命名约定（全文适用）：required harness runtime setup workflow 的 canonical 入口名是 `spec-runtime-setup` / `/spec:runtime-setup`，`spec-mcp-setup` 为迁移期 deprecated alias（以父方案 §0.4.2 为准）。本文下文出现的 `spec-mcp-setup` 一律指代该 workflow，等同 `spec-runtime-setup`；`skills/spec-mcp-setup/**` 等 source 实体路径在后续 source 重命名 work 任务落地前保持现状。

### 1.1 外部工具现状校准（`gh` 实测，2026-06-05）

下表用 `gh api` + README 实测，纠正「这三个是冷门/偏门工具」的误判。**结论：三者都不冷门，CodeGraph 甚至是当前最贴合 Claude Code 的选择**；真实风险不在「没人用」，而在 single-maintainer bus-factor、2026 AI-tooling 爆红未沉淀、商业化 pivot 与第三方代码执行/供应链面。

| 工具 | stars | 语言 / License | 关键机制（README 实读） | 真实风险 |
| --- | --- | --- | --- | --- |
| colbymchenry/codegraph | ~41k | TypeScript / MIT | tree-sitter→SQLite+FTS5；**native file-watcher 增量 auto-sync + ⚠️ staleness banner + 连接时 content-hash 重对齐**；100% local；自带 MCP server；README 附 Opus-4.8 benchmark（16% cheaper / 47% fewer tokens / 58% fewer tool calls，self-reported 应打折看） | 单人维护；「platform is coming」商业化路线；tree-sitter syntax-inference 语义天花板（非 LSP type-resolved） |
| safishamsi/graphify | ~59k | Python / MIT（YC S26） | 产 `graph.json/GRAPH_REPORT.md/graph.html`；自带 MCP server + git post-commit hook 自动重建 + 可检入 portable manifest；33 语言 | 单人维护；Python runtime 依赖与 Node 轻契约冲突；静态快照天然 stale |
| garrytan/gbrain | ~21k | TypeScript / MIT | 非「embedding 小工具」，是 PGLite/pgvector+BM25+RRF+reranker+自连接知识图谱+synthesis（`gbrain think`）+OAuth 的完整知识平台；强耦合 OpenClaw/Hermes/gstack 生态 | 单人维护；功能面远超 spec-first 当前 memory 需求；外部平台 + 可选 Postgres 运维/供应链面 |

校准要点：

- **「偏门选型」不成立**——这是事实纠正，不是为方案背书。高 star 在 2026 这个炒作周期里，作为「长期可维护性」的信号强度**远低于** ast-grep / ripgrep 的同等 star（三者全是单人仓库、全在 2026 集中爆红、README 互相交叉引用同一套 agent 生态）。
- 因此全文落地一律：**version pin + 全 optional + 绝不 hard-depend**，任一停更不影响主链路。
- 外部工具的命令/能力以 provider registry fixture + `--help` 复核为准，不把 README 当 spec-first 当前 source-of-truth（见 §4.2）。

---

## 2. 三个 Provider 的分工

## 2.1 CodeGraph：代码结构候选层

适合回答：

```text
哪个 symbol / file 相关？
调用链和依赖边界在哪里？
diff 可能影响哪些调用方？
哪些测试可能受影响？
review 是否需要补看某条调用链？
debug 错误路径可能经过哪些实现？
```

在 `spec-first` 中的近期定位：

```text
Code evidence candidate provider
```

边界：

- 可以替代盲目探索的一部分成本。
- 可以产出 related files、symbols、callers/callees、impact、affected-test candidates。
- 不替代 source-read confirmation。
- 不拥有 finding/root-cause/scope authority。
- stale / dirty / repo-misaligned 时必须降级。

## 2.2 Graphify：项目语义图谱候选层

适合回答：

```text
当前系统有哪些业务概念？
代码、文档、SQL、脚本之间有什么语义关系？
某个 PRD 涉及哪些模块、文档、接口或数据面？
是否存在文档-代码描述不一致？
哪些模块是 god nodes 或跨域连接点？
```

在 `spec-first` 中的近期定位：

```text
Project semantic graph artifact provider
```

边界：

- Graphify artifact 可以辅助 PRD / plan / doc review 的 current-state 理解。
- Graphify result 必须带 source paths 或 artifact provenance。
- stale graph 只能作为 advisory gap，不产生 confirmed context。
- `graphify-out/` 是否提交由项目 profile 决定，不进入 spec-first minimal 默认。
- 不在普通 workflow 中 silent refresh。

## 2.3 GBrain：长期团队记忆候选层

适合回答：

```text
过去为什么拒绝这个方案？
类似 bug 的 RCA 是什么？
某个模块历史上踩过什么坑？
团队规范或架构决策里是否有相关约束？
当前方案是否重复历史争议？
```

在 `spec-first` 中的近期定位：

```text
Optional institutional memory provider
```

边界：

- GBrain recall 是 historical / memory candidate。
- 召回内容必须带 citation、freshness、gap 或 limitation。
- current source/test/log 仍是当前任务事实依据。
- 长期写入只能来自 verified learning、reviewed decision、RCA 或用户显式导入。
- 不自动把会话临时推理写进长期记忆。

---

## 3. Provider 生命周期与信任等级

父方案定义的核心判断：

```text
安装不等于可用。
可用不等于新鲜。
新鲜不等于 confirmed truth。
confirmed truth 仍需要 source/test/log/contract/user evidence。
```

## 3.1 生命周期

```text
detect
  检查 provider CLI / artifact / host config / server reachability。

plan
  输出 install plan、refresh plan、post-check plan 和 fallback。

apply
  只有用户显式请求或 profile 明确允许时安装、初始化或刷新。

verify
  执行 provider health / status / artifact checks，写 setup facts。

consume
  workflow 读取 setup facts 和 provider candidates，由 LLM 判断是否使用。

confirm
  source-read / tests / logs / review / user confirmation 把 candidate 升级。

promote
  verified learning 才进入 docs/solutions 或 optional memory provider。
```

## 3.2 信任等级（两轴，见父方案 §5.4 / §0.4）

provider 的"机械可用性"与"证据语义信任"是两件事，必须拆成两轴，不混进一个 L0–L6 阶梯：

**轴 A — Provider Readiness（机械，单字段 5 值，复用现有 schema enum）**

| `readiness_status` | 含义 | 可用动作 |
| --- | --- | --- |
| `not-run` | 未安装/未配置/artifact 缺失/server 不可达 | fallback 到 `rg` / source-read |
| `degraded` | 可用但部分能力缺失或降级 | 限定用途，标 limitation |
| `stale` | 可用但 index/graph/memory 与当前 repo 不对齐 | 提示 refresh；结果只能 advisory |
| `fresh` | 与当前 repo/source 对齐 | 可作为 evidence candidate 来源 |
| `unknown` | 无法判定 | 按 not-run 保守处理 |

**轴 B — Evidence Trust（语义晋升，workflow 判断，不写进 readiness 字段）**

| 信任档 | 含义 |
| --- | --- |
| `advisory` | 探索方向、上下文候选、历史线索 |
| `evidence_candidate` | 有 path/symbol/citation + source requirement，可触发 direct source read |
| `confirmed_context` | 已由 source/test/log/contract/user evidence 直接确认 |
| `durable_knowledge` | 已沉淀到 `docs/solutions/**` 或 reviewed memory |
| `governance_rule` | 经 RuleMaturity 与人工批准成为 required/blocking policy |

注意：`confirmed_context` 不是 provider 自报状态，而是 workflow 在直接证据确认后给出的消费状态；`readiness_status=fresh` 本身永不等于 `confirmed_context`。轴 B 不得回填进 readiness 字段。

---

## 4. 安装、启动与刷新策略

> **归属总则（先读，全 §4 适用）**：generation / index / refresh / watch / write 全部归 **provider 自身机制**（CodeGraph 的 file-watcher daemon、Graphify 的 post-commit hook、GBrain 的 ingest）。spec-first **不接管、不重建、不代执行**这些**运行期产/刷**机制。spec-first 的机械职责是三件：**detect**（读 readiness/freshness facts，产 JSON）、**install/apply**（由 `spec-runtime-setup`（alias `spec-mcp-setup`）在 explicit `--install` 下真正执行安装/配置 provider 及 helper，`--plan`/`--check`/`--verify-only` 只检不装）、**consume**（workflow LLM 用 candidate 并回源确认）。即：**装由 `spec-runtime-setup` 显式执行，刷新由 provider 自管,spec-first 不代刷**。`spec-first init` 只做 source→runtime projection，不装 provider（装在 `spec-runtime-setup`，不在 `init`）。
>
> 注意：角色契约中脚本负责的「runtime asset 同步与 drift 检测」指 spec-first **自己的** `.claude/` / `.codex/` 镜像,**不是 provider 的索引/图谱/记忆**——provider 的新鲜度由 provider 自管,这两者不可混。

## 4.1 Profile

收敛后三者**不再平级进 profile**：`recommended` 只在「先测量证明增益」后纳入 CodeGraph；Graphify 走手动 artifact-doc（任何 profile 都不自动装/不进 readiness loop）；GBrain 后置，不进任何 profile 默认。

| Profile | 默认状态 | Provider 策略 | 适用场景 |
| --- | --- | --- | --- |
| `minimal` | 默认 | 不安装任何 provider；只检测已声明 provider；缺失不阻塞 | 个人轻量使用、普通 workflow |
| `recommended` | 显式选择 | **仅 CodeGraph**，且作为 opt-in pilot（需先有实测 token/质量增益才升入，见 §8 Phase 1-2）；Graphify 不进 recommended（改手动 artifact-doc）；GBrain 不进 recommended（后置） | 正式项目，需要更强 code-structure context |
| `platform` | 显式选择 | CodeGraph 纳入团队标准；Serena 仅在「精确 rename/references」真实需求出现时作可选补充（不替代 CodeGraph）；Graphify/GBrain 仍按手动/后置处理 | 团队/部门级治理 |

## 4.2 安装和启动

| Provider | 安装依赖 | 初始化/启动 | spec-first 近期口径 |
| --- | --- | --- | --- |
| CodeGraph | Node/npm（自带 bundled runtime，亦可 `npm i -g`）；安装命令以 provider registry snapshot 为准 | `codegraph init -i <repo>` 建索引；`codegraph serve --mcp` 起 MCP server（自带 file-watcher 增量 sync） | 唯一 pilot；`spec-runtime-setup --install` 才执行安装/配置，`--check`/`--verify-only` 只写 readiness/freshness/fallback facts；近期 opt-in 先测量 |
| Graphify | Python 3.10+ 和 `uv`/`pipx`；具体包名落地前以官方 README/`graphify --help` 复核 | `/graphify .` 生成 artifact；**自带 `graphify hook install` 的 git post-commit hook 可自动重建**（纯 AST，无 API 成本） | **不进 readiness loop**：刷新归 Graphify 自己（用户可选用其 hook）；spec-first 不 silent 装 hook、不接管刷新，只把 `GRAPH_REPORT.md` 当普通文档读（见 §7.2 / §8 Phase 3） |
| GBrain | Node 或 Bun（TS 项目）；安装命令以 provider registry snapshot 为准 | `gbrain init --pglite`、`gbrain serve`、`gbrain search/think` | **后置**：先强化 file-first；若引入只作用户侧外部 MCP，spec-first 仅消费其 refs |

外部工具命令不是 `spec-first` 当前 contract。落地到 setup 脚本前必须通过 provider registry fixture 和 `--help` / status command 复核，避免把过期 README 命令固化进 source。

## 4.3 启动和刷新边界

下表按「谁拥有这个动作」分两类。**前半归 provider 自身机制,spec-first 不接管不代执行;后半才是 spec-first 的机械职责**。

| 动作 | 含义 | owner | spec-first 的角色 |
| --- | --- | --- | --- |
| 索引/图谱/记忆的 generation·refresh·watch·write | 建/刷/盯/写 `.codegraph/`、`graphify-out/`、GBrain store | **provider 自身**（watcher daemon / post-commit hook / ingest） | **不碰**：不接管、不重建、不代执行、不 silent 触发 |
| Host 自动拉起 server | Claude/Codex 按 MCP config 启动 provider server | host runtime projection | 旁观；拉起只代表 callable，不代表 fresh |
| install / apply（执行安装·配置 provider/helper） | 真正跑 `npm i -g` / `uv tool` / 写 host config 等 | **`spec-runtime-setup`（alias `spec-mcp-setup`）** | **用户显式 `--install`/apply 时真正执行**；`--plan`/`--check`/`--verify-only` 只检不装；`spec-first init` 不在此列（只做 runtime projection） |
| readiness/freshness **detect** | 读 installed/configured/reachable/fresh/repo-aligned，产 JSON facts | `spec-runtime-setup`（alias `spec-mcp-setup`）/ setup helper | **应自动检测**（这是 spec-first 的机械职责之一） |
| candidate **consume** | workflow LLM 用 provider candidate，回源确认 | workflow skills | **消费 + 回源**（另一机械职责） |
| 写长期记忆的 promotion | 把 verified learning / RCA 沉淀为 durable knowledge | `spec-compound` / promotion flow（写 `docs/solutions/`） | 显式 promote，不默认自动；GBrain external write 默认 disabled |

启动不等于刷新，刷新不等于可信，**且刷新不归 spec-first 管**。

## 4.4 freshness 检测归属矩阵

本矩阵回答「freshness 由谁产生、spec-first 如何只检测/消费」——**没有任何一格是 spec-first 去执行刷新**。

| Provider | freshness 由谁产生 | spec-first detect 方式 | spec-first 绝不做 | stale 时边界 |
| --- | --- | --- | --- | --- |
| CodeGraph | **provider 自带 daemon**（native file-watcher 增量 sync + ⚠️ staleness banner + 连接时 content-hash 重对齐） | **直接消费 `codegraph status` / staleness banner**，不另造检测 | 不重造 git-hash drift 检测、不新增「无消费方」drift schema 字段、不代触发 sync | stale 不升 confirmed；banner 提示就回源 Read |
| Graphify | **provider 自带**（`graphify hook` 的 post-commit 重建）或用户手动 `/graphify` | 读 artifact 是否存在 + `git log --follow` 看 commit 落后 | 不 silent 装 hook、不接管刷新、不 silent write `graphify-out/` | stale artifact 禁止晋升为 evidence_candidate |
| GBrain | provider 自管（后置，不集成为 spec-first 自有节点） | 后置；若用户自带则探连接/citation 可达性 | 不自动写长期记忆、不外包 Knowledge 节点 | recall 必带 citation，否则只 advisory |

CodeGraph 这条「provider 自带 freshness + staleness banner 让 agent 回源确认」与本方案 grounding 哲学天然契合——这正是优先选它、且**把刷新完全留给 provider、spec-first 只消费其信号**的理由。

## 4.5 边界不变量、install 执行前置 gate 与信任假设

§4.1–§4.4 的边界若只活在 prose 里会被逐步侵蚀（本方案起草过程本身就发生过把「装/刷」职责写错的回归）。本节把它钉成**可测试的不变量 + 执行前置 gate**，并显式命名一个信任假设。落地时由 §10 contract test 守护，不靠人工记忆。

### 4.5.1 边界不变量（INV，可测试）

- **INV-1（唯一 mutation）**：spec-first 对 provider 执行的唯一写动作是 `spec-runtime-setup --install`（含其 host-config 写入）。generation / index / refresh / watch / write **一律不由 spec-first 触发**——这些归 provider 自身 daemon/hook/ingest。
- **INV-2（detect 只读）**：`--check` / `--verify-only` / `--plan` 不安装、不写 host config、不触发 provider 刷新；只读 readiness/freshness facts。
- **INV-3（init 不装 provider）**：`spec-first init` 只做 source→runtime projection，不安装/初始化 provider。
- **INV-4（不重造 freshness）**：spec-first 不为已自报 freshness 的 provider（如 CodeGraph）重建并行 drift 检测，也不新增无消费方的 drift schema 字段。
- **INV-5（candidate 不自晋升）**：provider 输出止于 candidate，`confirmed_context` 只能由 source/test/log/contract/user evidence 达成（`readiness_status=fresh` 永不等于 confirmed）。

### 4.5.2 install 执行前置 gate（spec-first 唯一真正执行的高 blast-radius 步骤）

install 是本集成里 spec-first 实际执行的最高风险写操作（真跑 `npm i -g` / `uv tool` 装一个**单人维护、可能商业化 pivot** 的外部工具）。因此把最严的闸放在这一步，作为**执行 install 的前置 gate**，而非事后建议。Gate 复用既有 `helper-tools-registry.v1` 的 `safety` 形状（不新造词表），把它扩展到 provider registry entry：

```text
执行 spec-runtime-setup --install <provider> 前必须满足：
  1. safety.source / safety.source_repo 存在且可核对（来源校验）。
  2. safety.version_policy.pin_status ∈ {pinned, manual}；
     pin_status=latest / unpinned 对 provider 默认【阻断执行】，需 explicit 风险确认才放行
     （helper 既有口径可保留 latest；provider 因 bus-factor/供应链面更严）。
  3. safety.review_required=true 时，先 surface risk_flags 再 apply（沿用 install-safety lens）。
  4. blocked install-safety 结果直接 skip，不执行。
  5. minimal profile 不进入该 gate（不装任何 provider）。
```

要点：**刷新可以放心交给 provider，但「装」这一步反而要比 explicit apply 更严**——pin + 来源校验是执行前置条件，不是 next-action 建议。

### 4.5.3 显式信任假设：消费 provider 自报 freshness

INV-4 让 spec-first 直接信任 CodeGraph 自报的 `fresh/stale`。这是一个被显式命名的信任假设，而非默认：

- `readiness_status=fresh` 只是**机械新鲜度提示**，不等于 `confirmed_context`（见 §3.2 轴 B、INV-5）。
- `stale` / staleness banner 出现时**一律回源 Read**，不消费 provider 当前结论。
- 对单人维护工具，「信它的 banner」是一个小但真实的供应链信任面；接受它的前提是 freshness 仅为机械信号且 stale 默认降级，不让它跨越到语义结论。

### 4.5.4 pilot 退场判据（kill-criterion，防永久 limbo）

CodeGraph 作为 §8 Phase 1 的 opt-in pilot，必须带可证伪的退场判据，否则 pilot 会卡在「不毕业也不下线」的中间态：

- **测量者**：`spec-plan` / `spec-work` 在真实任务中开/关 CodeGraph 的对照插桩（见 §8 Phase 1）。
- **毕业判据**：在 N（建议 ≥3）个真实 plan/work 任务上，开启 CodeGraph 后 agentic-grep 的 token 消耗有显著下降且候选命中质量不降 → 升 `recommended`。
- **退场判据**：达不到上述增益，或维护/供应链风险触发 → 退回 opt-in 或**移除**，不保留空壳（对齐 GitNexus 移除时「不留 provider 骨架」的口径）。

## 5. Contract / Schema 收敛

## 5.1 复用已落地的 readiness schema（不重建）

> **现状（已验证）**：`provider-readiness.v1` 的 schema / docs / producer / consumer **已 shipped**——`docs/contracts/provider-readiness.{md,schema.json}`、producer `src/cli/helpers/setup-facts.js`（`normalizeProviderReadiness` 产 `schema_version: 'provider-readiness.v1'`）、consumer `src/cli/helpers/spec-work-run-artifact.js`（校验 `provider_untrusted.readiness_status` 5 值）。本文 v1.16 是**增量消费**，不再「新增核心合同」，也不重建 readiness 词表；只展开 CodeGraph 的 provider-specific 字段消费。canonical 字段归父方案 §7.1。

复用既有 `provider-readiness.v1`（schema 字段以已落地 `provider-readiness.schema.json` 为准）：

- 统一表达 provider 的 lifecycle 布尔位、readiness freshness、repo alignment 与 fallback。
- 供 `spec-runtime-setup`（alias `spec-mcp-setup`）、`doctor`、workflow skills 读取。
- 不表达 workflow 结论，不表达 finding/root-cause，不表达 final scope。

Provider-specific 示例（字段以已落地 schema + 父方案 §7.1 canonical 为准）：

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

字段消费说明（避免与父方案 canonical 漂移）：

- `readiness_status`（轴 A，机械新鲜度）：只取 `fresh / stale / degraded / not-run / unknown` 5 值，是唯一的 readiness enum 字段（见父方案 §5.4）。
- `repo_aligned` 已是 enum `yes/no/unknown/not-applicable`（**不是 bool**，以 `provider-readiness.schema.json` 与 `setup-facts.js` 为准）。对 CodeGraph，**优先消费 provider 自带的 `codegraph status` / staleness banner 来判定对齐，不在 spec-first 新增 `drift_commits` 等无消费方字段**（避免方案自己反对的过度设计）。
- `lifecycle.*`（生命周期布尔位）：各自独立布尔，**不塞进 `readiness_status` enum**。字段集合以已落地 schema 为准；本文示例只展示 provider-specific consumption——
  - `installed`：命令存在或 package 可运行。
  - `configured`：host / project 配置指向 provider。
  - `initialized`：provider 项目初始化完成（如 `codegraph init`）。
  - `indexed`：provider 索引 / artifact 存在。
  - `server_reachable`：MCP / server 形态 provider 可达（非 server 形态填 `false` 或视为 not-applicable）。
  - `artifact_exists`：artifact 形态 provider 的产物存在（如 `graphify-out/`）。
  - `query_verified`：至少一次 bounded query 成功。
  - `fallback_used`：使用 source-scan / rg / read 替代。
- 轴 B（Evidence Trust）是 workflow 语义晋升判断，**不得写入本 schema 任何字段**（见父方案 §5.4、§3.2）。`readiness_status=fresh` 永不等于 `confirmed_context`。**近期收敛**：轴 B 在落地时先坍缩为 `candidate / confirmed` 二值（advisory→evidence_candidate→confirmed_context→durable_knowledge→governance_rule 五档是 prose 判断词汇，留在 §3.2 作语义参照；只有当某条具体 workflow 代码路径真的依赖中间档区分时，再扩展那一档）。把「candidate 必须 cite source file+line 才晋升」写进 workflow prompt（可执行约束），比放进 schema 枚举（装饰）更有约束力。

### 5.1.1 confidence 表达：拒绝移植 SCALE 数值模型

上游 `scale-engine/src/codegraph/CodeIntelligence.ts` 用 `.includes()` 子串匹配 + 硬编码 `0.35~0.95` confidence + 「省了几次读」的 vanity ROI 指标。这**直接违反角色契约**「脚本产可验证事实、不编造、advisory 不是 confirmed truth」，是要主动避开的反模式样板（见 §11）。

落地口径：

- 不输出数值 confidence；若必须表达，用分类 `confidence_basis: exact_symbol_match | substring_match | path_heuristic`，且**仅当 CodeGraph pilot 真正消费该字段时才落到 adapter 输出**（无消费方不进 schema）。
- 给 CodeGraph 候选标注 `inference_method: syntax`（tree-sitter syntax-inference，非 LSP type-resolved），让 LLM 用正确 epistemic 预期消费 callers/impact——它绝不等同 LSP find-references。同样仅在 pilot 消费时落字段。
- 不产出「省了多少次文件读」这类 ROI 估算字段；ROI 用 §8 Phase 1 的真实插桩测量,不靠脚本编造。

## 5.2 复用既有合同

| 既有合同 | 本文如何消费 |
| --- | --- |
| `docs/contracts/context-bundle.md` | provider candidates 转成 related paths / evidence summaries / source-read requirements |
| `docs/contracts/artifact-summary.md` | Graphify report、GBrain recall、provider result 使用 summary-first handoff |
| `docs/contracts/workflows/spec-work-run-artifact.schema.json` | `provider_untrusted` 记录 provider readiness；`direct_evidence_used` 记录确认依据 |
| `docs/contracts/verifiers/verification-evidence.schema.json` | provider affected-test 只能变成 verification recommendation，不是验证已运行 |
| `docs/contracts/source-runtime-customization-boundary.md` | 不手改 generated runtime mirror；provider host projection 由 init/setup source 管理 |

## 5.3 后置候选合同

这些合同只有在 `provider-readiness` 有稳定 producer，且至少两个 workflow 真实消费后再创建：

```text
docs/contracts/context-intelligence/provider-context-result.md
docs/contracts/context-intelligence/context-fusion-summary.md
docs/contracts/knowledge/memory-promotion.md
```

不建议近期创建：

```text
docs/contracts/context-intelligence-plane.md
src/cli/context-intelligence/query-router.js
src/cli/context-intelligence/context-pack-builder.js
```

原因：当前 `context-bundle` 已明确不是中心化 router；新增 Plane 容易形成第二套 context truth。

---

## 6. Workflow / Skill 接入矩阵

## 6.0 推荐接入顺序

```text
1. spec-runtime-setup（alias spec-mcp-setup）
2. spec-plan
3. spec-code-review
4. spec-debug
5. spec-prd
6. spec-work
7. spec-compound / spec-compound-refresh
```

## 6.1 Skill 矩阵

下表的 `E0` / `E1` / `E2` / `E3` 是 **Phase E provider 内部接入顺序**，不是父方案全局 P0/P1/P2/P3 优先级。父方案全局优先级仍是：P0 可信交付基线、P1 governance lens、P2 Knowledge Harness、P3 optional providers。

> **收敛口径（与 §0 / §8 对齐，避免误读为三者平级铺开）**：本表是**最终态的完整消费地图**，不是同批交付清单。实际落地受 §8 phase 顺序约束：先只接 **CodeGraph 一个消费节点**（`spec-plan` / `spec-work` 的 impact + affected-test 候选）并实测增益；CodeGraph 列验证后再向 `spec-code-review` / `spec-debug` 扩。Graphify 列只在 Phase 3 以**手动 artifact-doc** 形式按需消费（不进 readiness loop）；GBrain 列整体后置到 Phase 4。在对应 phase 落地前，表中 Graphify / GBrain 单元格是**目标态参照**，不是 v1.16 首批交付。

| Provider 阶段 | Skill / Workflow | CodeGraph | Graphify | GBrain | 边界 |
| --- | --- | --- | --- | --- | --- |
| E0 | `spec-runtime-setup`（alias `spec-mcp-setup`） | 检测 CLI、索引、MCP config、freshness | 检测 artifact、refresh 建议 | 检测连接、citation/source 可达性 | 只产 readiness facts，不判断结论 |
| E1 | `spec-plan` | code impact candidates、related files、affected tests candidates | semantic/domain impact candidates | historical constraints / rejected rationale | 不自动扩大 scope |
| E1 | `spec-code-review` | changed symbols、callers/callees、blast-radius candidates | docs/code mismatch candidates、跨域关联 | 类似事故、历史规则候选 | finding 必须 direct evidence |
| E1 | `spec-debug` | 调用链、实现链、路径候选 | 业务流程语义候选 | 历史 RCA / workaround | root cause 必须由当前日志/源码/测试确认 |
| E2 | `spec-prd` | 必要时定位入口代码 | brownfield current-state / concept map | 历史背景、决策约束 | 只辅助 current-state，不编造 WHAT |
| E2 | `spec-work` | 缩小编辑候选、推荐验证候选 | 默认少用 | 默认少用 | 实现阶段避免上下文膨胀，不新增需求 |
| E2 | `spec-compound` | 非主要写入目标 | 可提示 graph refresh | verified learning 可导入 | `docs/solutions/` 仍是第一 durable store |
| E3 | `spec-doc-review` | 核查代码现状声明 | 核查语义现状声明 | 核查历史约束声明 | 最终仍需文本/源码直接证据 |
| E3 | `spec-app-consistency-audit` | 复杂 App impact 辅助 | 页面/模块语义辅助 | 历史产品/事故辅助 | 等 provider contract 稳定后再接 |

不建议直接接入：

| Skill / Workflow | 原因 |
| --- | --- |
| `using-spec-first` | 只做入口路由，不消费 provider 语义 |
| `spec-update` | 管 spec-first 更新/runtime repair，不初始化 provider |
| `spec-release-notes` | release truth 来自版本事实，不来自 provider recall |
| `spec-sessions` | 可以作为 GBrain 未来导入来源，但不混成同一 truth |

---

## 7. 各 Provider 接入设计

## 7.1 CodeGraph

近期接入目标：

```text
provider-readiness -> related paths/symbols candidates -> source-read requirements
```

Adapter 输出只写机械 readiness 和候选证据要求：`readiness_status` 只能取 `fresh/stale/degraded/not-run/unknown`；每个候选用 `source_read_required` / `limitations` 表达需要直接确认。`advisory`、`evidence_candidate`、`confirmed_context` 等 consumer trust 只能由消费 workflow 在自己的 closeout / artifact 中判断，不能写入 provider readiness 或 adapter JSON。

Adapter 输出应保持短、小、可追溯。其内嵌的 readiness 快照字段名以 §5.1 canonical(`readiness_status` + `lifecycle` 布尔位 + 顶层 `repo_aligned`)为准，不另立第二套 readiness 词汇；adapter 在此基础上追加 `candidates` / `gaps` / `limitations` 等查询输出：

```json
{
  "provider": "codegraph",
  "readiness_status": "fresh",
  "lifecycle": {
    "indexed": true,
    "fallback_used": false
  },
  "repo_aligned": "yes",
  "candidates": [
    {
      "type": "symbol_impact",
      "symbol": "submitOrder",
      "paths": ["src/order/service.ts"],
      "relationship": "caller",
      "confidence": "high",
      "source_read_required": true
    }
  ],
  "limitations": []
}
```

消费规则：

- `spec-plan` 用它减少盲读。
- `spec-work` 用它辅助定位和验证候选。
- `spec-code-review` 用它提醒 blast radius，但 finding 仍需 diff/source/test/log。
- `spec-debug` 用它形成假设路径，但 root cause 仍需当前 repro/log/source。

## 7.2 Graphify

近期接入目标：

```text
artifact readiness -> semantic candidates -> source/document confirmation
```

Adapter 输出示例：

```json
{
  "provider": "graphify",
  "readiness_status": "stale",
  "lifecycle": {
    "artifact_exists": true,
    "fallback_used": false
  },
  "repo_aligned": "no",
  "changed_files_since_build": ["docs/api.md"],
  "candidates": [
    {
      "type": "domain_concept",
      "concept": "订单提交流程",
      "paths": ["docs/order.md", "src/order/service.ts"],
      "source_read_required": true
    }
  ],
  "gaps": ["docs/api.md changed after graph build"]
}
```

消费规则：

- `spec-prd` 用它辅助 current-state。
- `spec-plan` 用它补 semantic/domain impact candidates。
- `spec-code-review` / `spec-doc-review` 用它发现 docs/code mismatch candidates。
- `spec-compound` 可以提示 refresh，但不 silent update graph。

## 7.3 GBrain

近期接入目标：

```text
memory readiness -> historical recall candidates -> citation/source confirmation -> optional promotion
```

Adapter 输出示例：

```json
{
  "provider": "gbrain",
  "readiness_status": "fresh",
  "items": [
    {
      "type": "historical_decision",
      "summary": "过去拒绝同步扣减库存方案，因为跨市场延迟不可控",
      "citations": ["brain://architecture/order-inventory-2025-11"],
      "freshness": "possibly_stale",
      "current_source_confirmation_required": true
    }
  ],
  "gaps": ["No recent note after 2026-02 migration"]
}
```

消费规则：

- `spec-plan` 用它识别历史约束和 rejected scope。
- `spec-debug` 用它寻找类似 RCA。
- `spec-code-review` 用它提示历史事故或团队规则候选。
- `spec-compound` 只把 verified learning 作为 import candidate。

---

## 8. 分阶段落地路线（收敛）

本文不改写父方案版本路线；只在父方案 Phase E / v1.16 下拆 provider 专项。收敛口径：**不三者平级铺开**，而是 CodeGraph 单点 opt-in pilot → 先测量 → 再决策，Graphify 降 artifact-doc，GBrain 后置。每个 phase 必须满足父方案 §9.0.1「无消费方=不交付」。

## Phase 0：复用已落地底座（不集成任何工具）

前提（已 shipped，见 §1 / §5.1）：`provider-readiness.v1` schema/producer(`setup-facts.js`)/consumer(`spec-work-run-artifact.js`) 已存在；`doctor --json` 已消费 setup facts 出 `decision_input_health`。

交付：

- 复用既有 schema 做 provider-specific 消费约定，**不重建 readiness 合同**。
- 轴 B 落地坍缩为 `candidate / confirmed`（见 §5.1）。
- 把「provider candidate 必须 cite source file+line 才晋升」写进 workflow prompt（可执行约束）。
- 把「无消费方=不交付」钉为 v1.16 硬验收条件。

不包含：新建 schema、新增 `drift_commits`/`inference_method` 等无消费方字段、引入任何外部工具。

## Phase 1：CodeGraph 作为唯一 pilot（opt-in，不进 recommended）

交付：

- CodeGraph detection / status / freshness——**直接消费 provider 自带的 `codegraph status` / staleness banner**，不重造 git-hash drift。
- CodeGraph candidate adapter（标 `inference_method: syntax`；不输出数值 confidence / vanity ROI）。
- **只接一个**消费节点起步（`spec-plan` / `spec-work` 的 impact + affected-test 候选），验证后再扩到 `spec-code-review` / `spec-debug`。
- stale / dirty / repo mismatch 降级规则（fallback 到 rg/ast-grep，呈现为**等价路径**而非「降级」）。
- **插桩实测**：开/关 CodeGraph 时 agentic-grep 的 token 消耗与命中质量（真实测量，不靠脚本估算 ROI）。

不包含：默认安装、进 recommended、provider result 直接进入 finding、`doctor` 将 CodeGraph 缺失报成 baseline failure。

## Phase 2：用真实数据决策

- Phase 1 插桩显示**实测 token/质量增益** → CodeGraph 升 `recommended`；否则保持 opt-in 或移除。
- Serena（LSP-via-MCP）仅在出现「精确 rename / find-references」真实需求时，作为 `platform` profile 补充评估——**不替代 CodeGraph，也不在本期引入**（它需为每语言常驻 language server，比刚移除的 GitNexus 更重，且同级 bus-factor）。

## Phase 3：Graphify 降级为 artifact-doc（移出 readiness loop）

仅当 brainstorm/plan 暴露「direct-read + ast-grep 填不了的全局架构地图」缺口时才启用：

- 用户手动 `/graphify .`；`GRAPH_REPORT.md` 检入版本库；workflow 当普通文档读。
- staleness 靠 `git log --follow` 可见；stale artifact **禁止晋升为 evidence_candidate**。
- doc-code 一致性用 `rg` diff + ast-grep 规则 + `/spec:doc-review` fresh read 三级覆盖，不依赖图谱。

不包含：进 readiness loop、minimal 默认生成 `graphify-out/`、silent hook install、把 Python runtime 作为 spec-first 依赖。

## Phase 4：GBrain 后置

- 先强化 `docs/solutions/` 结构化字段（`domain` / `pattern` / `rejected_alternatives` / `applicable_versions` / `invalidation_condition`）+ grep-friendly 索引。
- 只有出现**实测 recall 缺口**才评估轻量选项；若引入，永远作**用户侧外部 MCP** 消费其带 citation 的 refs，**不作为 spec-first 自有 knowledge 节点**（`docs/solutions/` 仍是第一 durable store）。

不包含：默认 external write、session transcript 自动导入、recall 直接作为当前事实、把 Knowledge 节点外包给外部平台。

## Phase 5：Context Fusion Summary（最后置）

只有当 CodeGraph pilot 有真实 workflow consumer、且确有第二个 provider 进入消费后，再考虑：

```text
context-fusion-summary.v1
```

它应该是 compact summary，不是中心化 router：

```json
{
  "schema_version": "context-fusion-summary.v1",
  "providers_used": ["codegraph"],
  "confirmed": [],
  "candidates": [],
  "conflicts": [],
  "gaps": [],
  "source_read_required": []
}
```

---

## 9. 验收标准

> 消费侧验收门槛（继承父方案 §9.0.1）：本文每个 provider capability 除了下列 readiness/contract 验收（证明 facts 正确），还必须有至少一个 §6.1 矩阵中的 named workflow 因消费它产生**可观察行为变化**（证明 facts 有用），否则停在 advisory，不计入 Phase E 完成。示例断言：`spec-plan` 因 CodeGraph candidate 减少盲读范围；`spec-debug` 因 provider `not-run/stale` 明确走 source-scan fallback 而非阻塞。无 named consumer 或消费后无行为变化的 provider facts 视为空转。

## 9.1 Readiness 验收

- `minimal` profile 不安装三者。
- missing provider 输出 `not-run` + fallback。
- stale provider 输出 `stale` + refresh next action。
- provider install plan 不执行安装，除非 explicit apply。
- setup facts 不替代语义代码理解。

## 9.2 CodeGraph 验收

- 未初始化索引时，provider readiness 报 `not-run` 或 `stale`，不阻塞 ordinary workflow。
- status 可读时，输出 index/repo alignment/freshness facts。
- `spec-plan` 能拿到 related files/symbol candidates。
- `spec-code-review` 能拿到 blast-radius candidates。
- affected-test 只能进入 verification recommendation，不能写成验证已运行。
- stale index 不能产生 `confirmed_context`。

## 9.3 Graphify 验收

- graph artifact 缺失时报 `not-run`，不阻塞 minimal。
- report 或 graph artifact 存在时，以 summary-first 方式进入 context。
- stale graph 必须提示 refresh next action。
- Graphify result 必须带 source paths / artifact refs / limitations。
- 不 silent write `graphify-out/`。

## 9.4 GBrain 验收

- GBrain 不可用时不阻塞 plan/work/review/debug。
- recall result 必须带 citation 或 limitation。
- stale/conflicting memory 必须显示 gap。
- `spec-compound` 只能把 verified learning 作为 import candidate。
- 不自动写长期记忆。

## 9.5 Fusion 验收

- Fusion summary 区分 confirmed / candidate / advisory / conflict / gap。
- Context bundle 不塞 raw graph、raw provider dump、大日志或全文 brain pages。
- provider result 与 source-read 冲突时，source-read 优先。
- 所有 provider facts 有 provenance、freshness、confidence、limitations。

---

## 10. 测试策略

## 10.0 边界不变量与 install gate Tests（守 §4.5）

§4.5 的不变量与 gate 必须由 test 守护，否则会像起草过程那样被 prose 漂移侵蚀。建议测试（命名沿用现有风格，如 `dependency-readiness-baseline.test.js` / `scale-provider-doc-contracts.test.js`）：

- `provider-boundary-invariants.test.js`
  - INV-1/INV-2：`--check`/`--verify-only`/`--plan` 不产生 provider 安装、host-config 写入或刷新副作用（断言 dry-run 路径无 mutation）。
  - INV-3：`spec-first init` 路径不含 provider 安装/初始化调用。
  - INV-4：readiness producer 不为已自报 freshness 的 provider 输出并行 drift 字段（schema additionalProperties=false 已部分兜底，补断言无 `drift_*`）。
  - INV-5：consumer 标 `confirmed_context` 必须带 direct source refs；`provider-readiness.v1` 不承载轴 B 字段。
- `provider-install-gate.test.js`
  - provider entry 缺 `safety.source` / `safety.source_repo` → install 被 gate 阻断。
  - `version_policy.pin_status ∈ {latest, unpinned}` 的 provider → 默认阻断，需 explicit 风险确认标志才放行。
  - `review_required=true` → apply 前必须先 surface `risk_flags`。
  - `blocked` install-safety 结果 → skip，不执行安装。
  - `minimal` profile → 不进入 install gate（不装任何 provider）。

## 10.1 Contract Tests

- `provider-readiness.v1` schema valid / invalid。
- unknown provider kind rejected。
- stale provider requires reason / next action。
- consumer / fusion 层若标 `confirmed_context`，必须有 direct source refs 或 confirmation evidence；`provider-readiness.v1` 自身不承载该字段。
- generated runtime paths 不得进入 source refs。
- provider registry entry 的 `safety` 形状复用 `helper-tools-registry.v1`（`source` / `source_repo` / `version_policy.pin_status` / `review_required` / `install_effect` / `risk_flags`），不新造平行 install-safety 词表。

## 10.2 Setup Tests

- verify-only 不安装 provider。
- install plan 输出命令但不执行。
- explicit apply 才允许安装 / 初始化 / refresh，且必须先过 §4.5.2 install gate（来源校验 + pin 要求）。
- provider-specific configured dependency entries 区分 installed/configured/reachable/fresh；通用 host report 由 v1.11/v1.12 setup/doctor 线验证。
- project setup facts path containment 生效。

## 10.3 Workflow Tests

- `spec-plan` provider candidate 不扩大 scope。
- `spec-code-review` provider candidate 不能直接生成 finding。
- `spec-debug` historical RCA 不能直接变成 root cause。
- `spec-work` affected-test candidate 不能写成测试已运行。
- `spec-compound` 只导入 verified learning candidate。

---

## 11. 反模式

禁止：

- 把 GBrain / Graphify / CodeGraph 写成 minimal 默认依赖；把三者平级铺开集成。
- 把 provider result 直接写成 confirmed truth。
- 用 `Context Intelligence Plane` 替代 existing Harness contracts。
- 新增 `src/cli/context-intelligence/` 作为近期 P0/P1 实现。
- 新增 provider CLI 命令时不先建立 source contract 和测试。
- 在 ordinary workflow 中自动安装、自动刷新 Graphify、自动写 GBrain。
- 把远端 spec-first 分支或外部 README 当作当前本地 source-of-truth。
- **移植上游 SCALE `CodeIntelligence.ts` 的硬编码数值 confidence（0.35~0.95）、`.includes()` 子串匹配伪装成图谱、或「省了几次读」的 vanity ROI 指标**（违反「脚本产可验证事实、不编造」）。
- **在 Claude Code 内重建一层 grep/检索 + 自造 confidence + 自造 router**；provider 唯一正当性是 ADD host 做不到的（精确 cross-file 图谱）。
- **新增无消费方的 schema 字段**（如未被 pilot 消费就先落 `drift_commits` / `inference_method`）；reconstruct 已落地的 `provider-readiness.v1`。
- **在 GitNexus 移除「本期不加替代」的语境下，不论证「这次为何不同」就把 provider 做成深耦合/非可选**（见 §0.0）。

允许：

- 在 `recommended`（仅 CodeGraph，先测量后纳入）/ `platform` profile 中**显式** opt-in provider。
- 用 CodeGraph 降低盲读成本（标 `inference_method: syntax`，回源确认）。
- 用 Graphify（手动 artifact-doc 模式）辅助 brownfield current-state。
- 在出现实测 recall 缺口后，用外部 GBrain 召回历史约束（作用户侧 MCP，消费带 citation 的 refs）。
- 用 provider candidates 触发 source-read、test/log、review confirmation。
- 在 verified learning 后做 optional memory promotion。

---

## 12. 最终结论

CodeGraph / Graphify / GBrain 都不是冷门工具（41k/59k/21k★，MIT，Claude-Code-native），但**值得做的不是三者平级集成**，而是收敛交付面、先测量再默认：

```text
CodeGraph：唯一 pilot，opt-in，先实测 token/质量增益再升 recommended。
Graphify：降为手动 artifact-doc，移出 readiness loop，无 Python runtime 依赖负担。
GBrain：后置；先强化 file-first docs/solutions，出现实测 recall 缺口再评估，永不外包 Knowledge 节点。
```

正确顺序是：

```text
复用已落地的 provider-readiness.v1 schema/producer/consumer（不重建），
先论证「GitNexus 刚移除、这次为何不同」（optional/非阻塞 vs 深耦合），
让一个 named workflow 真正消费 CodeGraph candidate 并产生可观察行为变化，
用 source-read / test / log / review 确认（candidate 必 cite source+line），
借 CodeGraph 自带的 freshness 而非重造 drift，拒绝移植硬编码 confidence，
必要时才显式 promotion 到 durable knowledge 或 optional memory。
```

一句话方案：

> 以已落地的 `provider-readiness` 和 existing Harness contracts 管住三者，把交付面收敛为 **CodeGraph 单点 opt-in pilot + Graphify artifact-doc + GBrain 后置**，让它们成为可降级、可追溯、可确认的上下文候选提供者，而不是替代 `spec-first` workflow judgment 的平台核心，更不是 GitNexus 的换皮重来。
