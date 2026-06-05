# spec-first 集成 CodeGraph / Graphify / GBrain 技术方案

> 本文是 `spec-first内化集成scale-project-scaffold技术方案.md` 的专项子方案。
> 父方案负责定义总边界、优先级和实施节奏；本文展开 CodeGraph / Graphify / GBrain 三个 optional provider 的**集成 → 安装 → 刷新 → 可用**全链路、workflow 使用与验收口径。
>
> **本文主干（spine）**：一个 provider 从「能进 spec-first」到「真正能用」要走的完整生命周期——
> `集成判定(§2-3) → 安装/初始化(§4 安装使用流程) → 刷新(§5 归属) → 可用判定(§6) → workflow 消费(§7-8)`，
> 由 §9 边界不变量 + install gate 守护，§12-13 验收/测试兜底。

---

## 0. 校准结论

三者**不平级集成**。核心结论是把交付面从「三 provider 平级集成」收敛为 **CodeGraph 单点 opt-in pilot（先测量再默认）+ Graphify 降为手动 artifact-doc + GBrain 后置**；任何一个都不能作为独立的 `Context Intelligence Plane` 覆盖当前 `spec-first` Harness。

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

它们进入 `spec-first` 的方式（这条链路就是本文 spine 的语义版）：

```text
集成判定（值不值得进）
  -> 安装 / 配置 / 初始化（spec-runtime-setup --install，过 install gate）
  -> 刷新（provider 自管，spec-first 不代刷）
  -> 可用判定（lifecycle ladder 到 query_verified，仅机械）
  -> workflow 消费 candidate
  -> source-read / test / log / review confirmation（才升 confirmed）
  -> optional durable knowledge promotion
```

明确不是：

```text
不是新增中心化 Context Intelligence Plane。
不是新增强 Query Router 替代 workflow 判断。
不是 init 自动装 / 默认刷新 / 默认写长期记忆 / 运行时 lazy 自动装。
不是让 provider 输出直接成为 finding、root cause、scope authority 或 confirmed truth。
不是把外部工具 README 当作 spec-first 当前 source-of-truth。
不是三 provider 平级集成；不是在 Claude Code 内重建一层 grep/检索；不是移植上游 SCALE 的硬编码 confidence / vanity ROI 模型。
```

父方案优先级轴（哪根柱子最该补，见父方案 §0.0「优先级轴」）——本文 provider 集成排在末位：

```text
P0: dependency readiness / verification summary / honest closeout（证据柱，最该早补）
P1: governance lens
P2: 六层 Knowledge Harness
P3: optional providers   ← 本文
```

> 注：P 轴是父方案的「优先级轴」（哪根柱子最该补），与「构建顺序轴 / 版本线 v1.11–v1.16」是两条不同的轴（父方案 §0.0）。本文按构建顺序落在 v1.16，按优先级属 P3。

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
| **provider-readiness（已落地）** | `docs/contracts/provider-readiness.{md,schema.json}`、producer `src/cli/helpers/setup-facts.js`、consumer `src/cli/helpers/spec-work-run-artifact.js` | `provider-readiness.v1` schema + producer 已 shipped；consumer(run-artifact)**镜像** `readiness_status` 5 值子集(`provider_untrusted`,字段白名单 `{readiness_status, summaries}`,5 值硬编码),不 import 完整 schema。v1.16 是**增量消费**,复用既有 readiness 词表,不重建 |
| **provider registry（空，待填）** | `skills/spec-mcp-setup/provider-tools.json`（当前 `providers: []`） | provider 命令/profile/safety 进此注册表（数据），不硬编码进脚本（见 §10） |
| **GitNexus 移除前史（关键）** | `docs/plans/2026-06-02-001-refactor-remove-gitnexus-integration-plan.md`（completed） | 同类图谱 provider 三天前已硬删除且明文「本期不加替代」；重引入必须论证「这次为何不同」（见 §0.0），并守住 optional/非阻塞 |
| SCALE Code Intelligence | `/Users/kuang/xiaobu/scale-engine/src/codegraph/CodeIntelligence.ts` | 可借鉴 provider + fallback；**不要复制** `.scale` truth、硬编码数值 confidence、vanity ROI |
| SCALE Dependency Bootstrap | `/Users/kuang/xiaobu/scale-engine/src/bootstrap/DependencyBootstrap.ts` | 借鉴 `needs-init` 显式态 + install/initialize 命令分离 + pack 选择 + apply 三态；**砍轻**，不引入 7 态全集 |
| SCALE Memory | `/Users/kuang/xiaobu/scale-engine/src/memory/MemoryProviders.ts` | GBrain external write 默认 disabled，recall 是 evidence candidate |
| project-scaffold | `/Users/kuang/xiaobu/project-scaffold/.scale/code-intelligence.json` | CodeGraph/Graphify 是 enabled provider + fallback 样板，不是 spec-first 默认强路径 |

> 入口命名约定（全文适用）：required harness runtime setup workflow 的 canonical 入口名是 `spec-runtime-setup` / `/spec:runtime-setup`，`spec-mcp-setup` 为迁移期 deprecated alias（以父方案 §0.4.2 为准）。本文出现的 `spec-mcp-setup` 一律等同 `spec-runtime-setup`；`skills/spec-mcp-setup/**` 等 source 实体路径在后续 source 重命名 work 任务落地前保持现状。

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
- 外部工具的命令/能力以 provider registry fixture + `--help` 复核为准，不把 README 当 spec-first 当前 source-of-truth（见 §4）。

### 1.2 业界对标：spec-kit 与 scale-engine（`gh`/读源实测）

本文的安装使用流程不是凭空设计，而是综合两个已验证的同类，取其语义、弃其重量：

| 维度 | GitHub spec-kit（108k★，官方） | scale-engine（`DependencyBootstrap`） | spec-first 取舍 |
| --- | --- | --- | --- |
| 分层 | CLI 投影 / `/speckit.*` slash 入口 / `scripts/{bash,powershell}` 双宿主 | 单 `scale` 巨型 CLI + SetupWizard + Bootstrap 引擎 | **取 spec-kit 薄四层**；弃 scale 巨型单 CLI |
| 「装≠用」 | 隐式（init 写文件） | **显式 `needs-init` 态 + `initializeCommands` 独立于 `installCommand`** | **取 scale 这条语义**，映射到已落地 5 值 `readiness_status`，不引 7 态 |
| 三态 mode | `self upgrade` check / preview / apply | `apply` flag + `onlyIds` 选择 | spec-first 用已有 `--check / --plan / --verify-only / --install`（SKILL workflow mode，非脚本 flag，见 §4.1） |
| install 默认 | 裸 `self upgrade` **默认执行**（装的是**自己**，可信） | explicit `--apply` | **不照搬默认执行**——spec-first 装**第三方**，必须 explicit + 过 install gate |
| provider 命令归属 | — | **硬编码**进 `DependencyBootstrap.ts` 常量 | **改进**：放 `provider-tools.json` 注册表（数据） |
| init 装不装 | `specify init` 只拷 bundled 模板 + `check_tool` agent（缺则 warn，**不装**） | `scale init` ≠ `scale bootstrap deps`（两条命令） | **双重印证 INV-3**：init 只投影 + 提示，装走 setup workflow |
| 安装触发 | 显式 `extension add` | 显式 `bootstrap deps --apply`（按 pack，**eager 一次装齐**；无运行时 lazy） | **显式 + 范围内一次装齐**，不 init 自动、不运行时 lazy |
| 运行期刷新 | provider 自管 | provider 自管（scale 只 init + `status` 探） | **一致**：provider 自管，spec-first 不代刷 |

两条最强的跨项目共识（三方一致，含 spec-first 已定 INV）：**① 没有一个在 `init` 默认装第三方；② 没有一个运行时 lazy 自动装**。两家都是「**用户选范围 + 显式命令 + 范围内一次装齐**」。spec-first 额外多压一道 install gate，因为它装的是第三方单人工具而非装自己。

---

## 2. 三个 Provider 的分工（集成判定：各自答什么问题、边界在哪）

### 2.1 CodeGraph：代码结构候选层（唯一 pilot）

适合回答：

```text
哪个 symbol / file 相关？调用链和依赖边界在哪里？
diff 可能影响哪些调用方？哪些测试可能受影响？
review 是否需要补看某条调用链？debug 错误路径可能经过哪些实现？
```

定位：`Code evidence candidate provider`。它填的是**真实 gap**——ast-grep 是 structural search + codemod，做不了全局 callers/callees/impact；Claude Code agentic grep 能做但靠多轮搜索、token 贵。这是三者里唯一指向高频高价值 workflow 节点（plan/work/review 影响面 + affected-test）的 provider。

边界：

- 可替代盲目探索的一部分成本；产出 related files、symbols、callers/callees、impact、affected-test candidates。
- **不替代 source-read confirmation；不拥有 finding/root-cause/scope authority。**
- 是 tree-sitter **syntax-inference**（同名启发式），不是 LSP type-resolved——callers/impact 绝不等同 LSP find-references，必须标 `inference_method: syntax`。
- stale / dirty / repo-misaligned 时必须降级。

### 2.2 Graphify：项目语义图谱（降为 artifact-doc）

适合回答：业务概念、代码/文档/SQL/脚本语义关系、PRD 涉及面、doc-code 不一致、god nodes。

定位：**架构 artifact-doc**（非 always-on provider）。它的卖点是 episodic 架构分析，不是持续 readiness 需求。

边界：

- artifact 可辅助 PRD / plan / doc review 的 current-state 理解，但必须带 source paths / artifact provenance。
- 静态快照天然 stale；**stale graph 只能作为 advisory gap，禁止晋升为 evidence_candidate**。
- 刷新归 Graphify 自身（其 post-commit hook 或用户手动）；spec-first 不 silent 装 hook、不接管刷新、移出 readiness loop。
- Python runtime 依赖与 Node 轻契约冲突——降 artifact-doc 正是为去掉这个 readiness 负担。

### 2.3 GBrain：长期团队记忆（后置）

适合回答：过去为何拒绝某方案、类似 bug 的 RCA、模块历史坑、团队规范约束、是否重复历史争议。

定位：`Optional institutional memory provider`，**后置**。反对当前形态默认集成的理由是**系统边界 + 规模 + 供应链**，不是工具质量：

- spec-first 已有等价 file-first 能力（`docs/solutions/` verified-learning gate + Claude Code memory）；file-first 可审计、零运维、写入摩擦本身防污染。
- 当前规模（<500 条结构化 Markdown）远未到 embedding 召回相对 grep 有 ROI 的门槛。
- GBrain 是完整 opinionated 知识平台 + 可选 Postgres，外部平台运维与供应链面大。

边界：recall 是 historical candidate，必须带 citation/freshness/gap；current source/test/log 仍是事实依据；长期写入只来自 verified learning / reviewed decision / RCA / 用户显式导入；不自动把会话推理写进长期记忆；**不外包 spec-first 自有 Knowledge 节点**（`docs/solutions/` 仍是第一 durable store）。

---

## 3. Provider 生命周期与信任等级

核心判断（父方案）：

```text
安装不等于可用。可用不等于新鲜。
新鲜不等于 confirmed truth。confirmed truth 仍需要 source/test/log/contract/user evidence。
```

### 3.1 生命周期阶段

```text
detect   检查 provider CLI / artifact / host config / server reachability（只读）
plan     输出 install / refresh / post-check plan 和 fallback（不执行）
apply    仅用户显式请求或 profile 明确允许时安装、初始化（过 install gate）
verify   执行 provider health / status / artifact / bounded query，写 setup facts
consume  workflow 读取 facts 和 candidates，由 LLM 判断是否使用
confirm  source-read / tests / logs / review / user confirmation 把 candidate 升级
promote  verified learning 才进入 docs/solutions 或 optional memory provider
```

### 3.2 信任等级（两轴，见父方案 §5.4 / §0.4）

provider 的「机械可用性」与「证据语义信任」是两件事，拆成两轴，不混进一个 L0–L6 阶梯。

**轴 A — Provider Readiness（机械，单字段 5 值，复用现有 schema enum）**

| `readiness_status` | 含义 | 可用动作 |
| --- | --- | --- |
| `not-run` | 未安装/未配置/artifact 缺失/server 不可达 | fallback 到 `rg` / source-read |
| `degraded` | 可用但部分能力缺失或降级（**含「装了但没建索引」**，见 §3.3） | 限定用途，标 limitation |
| `stale` | 可用但 index/graph/memory 与当前 repo 不对齐 | 提示 refresh；结果只能 advisory |
| `fresh` | 与当前 repo/source 对齐 | 可作为 evidence candidate 来源 |
| `unknown` | 无法判定 | 按 not-run 保守处理 |

**轴 B — Evidence Trust（语义晋升，workflow 判断，不写进 readiness 字段）**

语义晋升只能发生在 workflow 语义晋升判断中，由 source/test/log/contract/user evidence 确认；Adapter 输出只写机械 readiness 和候选证据要求。

| 信任档 | 含义 |
| --- | --- |
| `advisory` | 探索方向、上下文候选、历史线索 |
| `evidence_candidate` | 有 path/symbol/citation + source requirement，可触发 direct source read |
| `confirmed_context` | 已由 source/test/log/contract/user evidence 直接确认 |
| `durable_knowledge` | 已沉淀到 `docs/solutions/**` 或 reviewed memory |
| `governance_rule` | 经 RuleMaturity 与人工批准成为 required/blocking policy |

`confirmed_context` 不是 provider 自报状态，而是 workflow 在直接证据确认后给出的消费状态；`readiness_status=fresh` 本身永不等于 `confirmed_context`。轴 B 不得回填进 readiness 字段。**近期收敛**：轴 B 落地先用 `evidence_candidate` / `confirmed_context` 两档（父方案 §0.4.2 canonical 词，schema/prompt 统一用此名、不引入 `candidate`/`confirmed` 新词条），其余三档（advisory / durable_knowledge / governance_rule）作 prose 语义参照；某条 workflow 真依赖中间档时再扩展。

### 3.3 install→usable lifecycle ladder（「装≠用」的可操作化）

借 scale `DependencyBootstrap` 的 `needs-init` 语义，落到 spec-first **已 shipped** 的 `provider-readiness.v1` lifecycle 布尔位上——**不新增第 7 态**：「装了但没建索引」直接表达为 `readiness_status=degraded` + `lifecycle.indexed=false` + `next_actions=["codegraph init -i"]`。

| rung | lifecycle 布尔位 | readiness_status | executor（谁执行） | 「装≠用」语义 |
| --- | --- | --- | --- | --- |
| install | `installed=true` | `not-run`→… | spec-first apply（`--install`，过 gate） | 装了 CLI 本体 |
| configure | `configured=true` | … | spec-first apply | 写了 host MCP config / 连 agent |
| initialize | `initialized=true` | `degraded` | spec-first apply | 建了目录/库（one-shot） |
| **首次 index/build** | `indexed`/`artifact_exists=true` | `degraded`→… | spec-first apply（**bootstrap 一次**） | ★装完到这步才有内容可查 |
| serve | `server_reachable=true` | … | **host 自拉起** | spec-first 不主动拉 server |
| probe | `query_verified=true` | `fresh` | spec-first verify（只读 bounded query） | **真正可用** |
| 持续 refresh | （provider 自管） | provider 报 `stale` | **provider daemon/hook** | spec-first 不代刷（见 §5） |

> **executor 语义澄清（守 §4.0 / INV-1）**：install/configure/initialize/首次 index 行的「spec-first apply」指 **spec-first 在 install 模式下代调 registry `lifecycle_commands` 里的 provider 命令**（如 `codegraph init -i`），**provider 自己执行实际的建索引/生成**——不是 spec-first 自造 generation 逻辑。即 spec-first 只负责「在 explicit install 时触发一次 provider 的 init 命令」，generation/index 的实现与后续刷新都归 provider（§4.0）。「首次 index」与「持续 refresh」的区别仅在触发者：前者由 install 模式一次性代调，后者由 provider daemon/hook 自管，spec-first 全程不碰其实现。

**Light-contract 关键收益**：scale 需要第 7 态 `needs-init`，spec-first 不需要——已落地的 5 值枚举 + 8 个布尔位已足够表达整条 ladder。这是「取 scale 语义、弃 scale 重量」的具体兑现。

三个 provider 的 ladder 终点不同（所以必须声明式 registry，不能硬编码一条线）：

```text
CodeGraph(server+index): … → query_verified（走完全程）；持续刷新=file-watcher 自管
Graphify(artifact):      … → artifact_exists + 可读（终点，无 serve/probe）；刷新=post-commit hook/手动
GBrain(memory,后置):     … → populated(user-only ingest;非 lifecycle 位,见下注) → query_verified；ingest 永不自动
```

> **GBrain `populated` 不是新增的 lifecycle 布尔位**（`provider-readiness.v1.lifecycle` 是**固定 8 布尔 + `additionalProperties: false`**，不可扩；扩它会直接违反 §7.1「不重建」+ §14 反模式「新增无消费方 schema 字段」）。`populated`（库里有没有数据）是 **registry / prose 层的语义 rung，executor=user-only**，落到既有字段时复用 `query_verified`（一次成功 recall ⇒ 既已安装初始化、库也非空）+ `next_actions`（如 `gbrain ingest …`）表达「装了库但没喂数据」。GBrain 是 Phase 4 后置，落地时务必把 `populated` 留在 registry/prose，**绝不为它动 lifecycle schema**。

---
## 4. 安装使用流程（集成→安装→可用 的命令面）

本节是 spine 的执行层：从用户视角，一个 provider 怎么从「没装」走到「能用」。设计综合 spec-kit 四层 + scale 三态 + spec-first 已落地 facts（见 §1.2）。

### 4.0 归属总则（先读，全 §4-§5 适用）

generation / index / refresh / watch / write 全部归 **provider 自身机制**（CodeGraph 的 file-watcher daemon、Graphify 的 post-commit hook、GBrain 的 ingest）。spec-first **不接管、不重建、不代执行**这些**运行期产/刷**机制。

spec-first 的机械职责是三件：

- **detect**：读 readiness/freshness facts，产 JSON（只读）。
- **install/apply**：由 `spec-runtime-setup` 在 explicit `--install` 下真正执行安装/配置/首次初始化（`--plan`/`--check`/`--verify-only` 只检不装），且过 §9.2 install gate。
- **consume**：workflow LLM 用 candidate 并回源确认。

即：**装由 `spec-runtime-setup` 显式执行，刷新由 provider 自管、spec-first 不代刷，运行时不 lazy 自动装**。`spec-first init` 只做 source→runtime projection，不装 provider。

> 注意：角色契约中脚本负责的「runtime asset 同步与 drift 检测」指 spec-first **自己的** `.claude/` / `.codex/` 镜像，**不是 provider 的索引/图谱/记忆**——provider 的新鲜度由 provider 自管，两者不可混。

### 4.1 四层架构（spec-kit 同构）

```text
① CLI（node,薄）       spec-first init / doctor / clean
     职责:init=source→runtime projection(含投影 provider MCP config 模板);
           doctor=读 facts 报健康;clean=移除。【绝不装 provider】
② slash workflow 入口   /spec:runtime-setup [--check|--plan|--verify-only|--install] [--claude|--codex] [--repo]
     职责:薄 router。透传 mode 给 SKILL,不含逻辑。【当前 drift:command 模板 argument-hint 为空,见 §4.5】
③ SKILL(语义编排)     skills/spec-mcp-setup/SKILL.md
     职责:定义四个 workflow mode(--check/--plan/--verify-only/--install,见 SKILL `## Workflow Modes`);
           把 mode 翻译成 detect→gate→apply→initialize→verify 循环;
           LLM 判断该不该装、degraded 可不可接受、卡点要不要补。
④ 双宿主确定性脚本      install-helpers.{sh,ps1} / install-mcp.* / detect-tools.* / check-health
     职责:真执行 install/configure/initialize/probe,产 readiness facts;可独立在 shell/CI 跑。
   provider 自身          codegraph watcher / graphify hook / gbrain ingest —— 运行期自管,③④不碰
```

**关键澄清（名实，已核源码）**：

- 四个 mode（`--check`/`--plan`/`--verify-only`/`--install`）是 **layer③ SKILL 的 workflow mode**（`SKILL.md ## Workflow Modes` 定义），不是 layer④ 任一脚本的通用 CLI flag。实测 `install-helpers.sh` 的 arg-parse **只识别 `--install` 与 `--verify-only`**，其余 flag 走 `*) shift` 静默丢弃且脚本默认 `MODE=install`——**因此绝不能直接把 `--check`/`--plan` 当脚本参数传**（那样会落回 install 模式、真的执行安装）。正确路径是：SKILL 在 `--check`/`--plan` 模式下**不向 `install-helpers.*` 透传该 flag**，而是改走 `detect-tools.*` 或以 `--verify-only` 调用，由 SKILL 层保证「只读/只预览」语义，不依赖脚本解析这两个 mode。
- 用户敲的是 `/spec:runtime-setup`（workflow 入口），不是收 `--install` 的 CLI binary。本文凡写 `spec-runtime-setup --install` 均指「该 workflow 的 install 模式」——SKILL 在该 mode 下调 `install-helpers.* --install` 真正执行。
- 脚本可独立在 shell/CI 跑(用于 contract test 与 §9 gate 验证),但其入参是脚本自己识别的子集(`--install`/`--verify-only`),不是上面四个 workflow mode 的全集。

### 4.2 端到端流程（用户到底敲什么）

```text
【Day-0,零 provider】
$ spec-first init                    ← node CLI,投影 runtime 镜像(含 /spec:runtime-setup 命令 +
                                        provider MCP config 模板),但不装任何 provider
  → minimal profile,plan/work/review 全走 rg+ast-grep fallback,完全可用

【想要 provider —— opt-in,在 Claude Code 里】
> /spec:runtime-setup                ← 默认 = check 模式(只读探测,SKILL 走 detect-tools.*/--verify-only 路径,不调安装)
  → 读 lifecycle 布尔位 → 报 readiness ladder + 卡点
    "codegraph: installed=false → not-run;fallback=rg。要装吗?"   ← LLM 语义判断 + 问用户

> /spec:runtime-setup --plan         ← 预览:渲染 install+initialize 命令 + gate 结果,执行 0 个

> /spec:runtime-setup --install      ← explicit apply:跑 detect→gate→apply→initialize→verify 循环
  → 过 install gate(§9.2:pin+来源校验)→ 装 → configure → 首次 index → probe
  → 写 query_verified=true facts;required 项一次装齐,不逐个问"要装吗"
```

**与 init 的硬边界**：装到能用全程在 `/spec:runtime-setup`（低频、过 gate、explicit）；`spec-first init` 永远只投影（高频、幂等）。这是 INV-3，也是 spec-kit/scale 双重印证（§1.2）。

### 4.3 required vs optional：满足「必备能力别让用户逐个挑」

registry 可标 provider 为 `required`（= scale 的 pack 概念），表达「这是策展过的必备能力」。但**「必备」不等于「init 静默自动装第三方」**（spec-kit 连自己支持的 agent 都只 check+warn 不装）。落地：

```text
registry 标 required: true
        ↓
spec-first init           仍只投影;detect 到 required provider 缺失 → 提示
        ↓ "codegraph 是必备 provider,未安装。运行 /spec:runtime-setup --install 一键装齐"
/spec:runtime-setup --install   一条命令把所有 required 的【一次装齐】(= scale --apply one-pass)
        ↓ 仍过 install gate;required 项默认 apply=true,不再逐个问;非 required 仍逐个确认
```

即：用户体验上等同「一条命令装齐必备」，但保住 init 纯投影、gate 不废、第三方安装有一次 explicit 批准点。**不 init 自动装，不运行时 lazy 装**——与 spec-kit/scale/INV 三方一致。

### 4.4 detect→gate→apply→initialize→verify 循环（SKILL 内部）

这就是「装到能用」的链路本身——逐 rung 推进、幂等可续跑：

```text
detect(只读,产 facts)
  → 找第一个未满足 rung(见 §3.3 ladder)
    ├ executor=spec-first apply 且 mode=--install 且过 gate → 执行该 rung → 回 detect(续跑)
    ├ executor=host(serve)                                 → 不执行,产 next_action,报 degraded
    └ executor=user-only(gbrain ingest)                    → 不执行,产 next_action,永不自动
  → emit provider-readiness.v1(readiness_status + 布尔位 + next_actions + fallback)
  → 走到 query_verified=true → readiness_status=fresh(仅机械,≠ confirmed)
```

`detect` 即状态本身 → **幂等可续跑**：装一半中断，再跑 `--install` 自动从卡点续上，不需额外记进度（借 scale 的 re-detect 思路）。

### 4.5 已知 drift（落地时先修）

- **command 模板 `argument-hint` 为空**：`templates/claude/commands/spec/mcp-setup.md` 的 `argument-hint: ""`，而 `SKILL.md` 的是 `[--claude|--codex] [--repo <path>] [--check|--verify-only|--plan|--install]`。落地时把入口 `argument-hint` 对齐 SKILL，否则 `--install` 模式对用户不可见，「装到能用」无入口。

---

## 5. 刷新归属（provider 自管，spec-first 不代刷）

本节是 spine 的「刷新」环节。核心：**spec-first 没有任何一格去执行刷新**。

### 5.1 启动和刷新边界（谁拥有这个动作）

| 动作 | 含义 | owner | spec-first 的角色 |
| --- | --- | --- | --- |
| 索引/图谱/记忆的 generation·refresh·watch·write | 建/刷/盯/写 `.codegraph/`、`graphify-out/`、GBrain store | **provider 自身**（watcher daemon / post-commit hook / ingest） | **不碰**：不接管、不重建、不代执行、不 silent 触发 |
| Host 自动拉起 server | Claude/Codex 按 MCP config 启动 provider server | host runtime projection | 旁观；拉起只代表 callable，不代表 fresh |
| install / apply（执行安装·配置·首次初始化） | 真跑 `npm i -g` / `uv tool` / `codegraph init` / 写 host config | **`spec-runtime-setup` install 模式** | 用户显式 `--install` 时真正执行（过 gate）；`--plan`/`--check`/`--verify-only` 只检不装；`spec-first init` 不在此列 |
| readiness/freshness **detect** | 读 lifecycle 布尔位，产 JSON facts | `spec-runtime-setup` / setup helper | **应自动检测**（机械职责之一） |
| candidate **consume** | workflow LLM 用 provider candidate，回源确认 | workflow skills | **消费 + 回源**（机械职责之一） |
| 写长期记忆的 promotion | verified learning / RCA 沉淀为 durable knowledge | `spec-compound` / promotion flow（写 `docs/solutions/`） | 显式 promote，不默认自动；GBrain external write 默认 disabled |

启动不等于刷新，刷新不等于可信，**且刷新不归 spec-first 管**。

### 5.2 freshness 检测归属矩阵

| Provider | freshness 由谁产生 | spec-first detect 方式 | spec-first 绝不做 | stale 时边界 |
| --- | --- | --- | --- | --- |
| CodeGraph | **provider 自带 daemon**（file-watcher 增量 sync + ⚠️ staleness banner + 连接时 content-hash 重对齐） | **直接消费 `codegraph status` / staleness banner** | 不重造 git-hash drift 检测、不新增「无消费方」drift schema 字段、不代触发 sync | stale 不升 confirmed；banner 提示就回源 Read |
| Graphify | **provider 自带**（`graphify hook` post-commit 重建）或用户手动 `/graphify` | 读 artifact 是否存在 + `git log --follow` 看 commit 落后 | 不 silent 装 hook、不接管刷新、不 silent write `graphify-out/` | stale artifact 禁止晋升为 evidence_candidate |
| GBrain | provider 自管（后置，不集成为 spec-first 自有节点） | 后置；若用户自带则探连接/citation 可达性 | 不自动写长期记忆、不外包 Knowledge 节点 | recall 必带 citation，否则只 advisory |

CodeGraph 这条「provider 自带 freshness + staleness banner 让 agent 回源确认」与本方案 grounding 哲学天然契合——这正是优先选它、且把刷新完全留给 provider、spec-first 只消费其信号的理由。

### 5.3 卸载 / 回滚归属（install 的逆操作）

INV-1 定义了「唯一 mutation 是 install」，其逆操作必须同样有明确 owner，否则 §9.4 的「退场/移除」无落点。install 在三处写入，卸载按归属分别处理：

| install 写入的东西 | 卸载 owner | spec-first 怎么做 |
| --- | --- | --- |
| provider CLI 本体（global npm / uv tool / bun） | **provider 自身 uninstall 命令**（如 `codegraph uninstall`，已核实真实存在） | spec-first 不代卸全局包；`/spec:runtime-setup`（check/plan 模式）**出 plan、提示用户跑 provider 自带 uninstall**，preview-first，不自动卸 |
| per-project 索引/artifact（`.codegraph/`、`graphify-out/`） | provider（`codegraph uninit`，已核实）或用户 | spec-first 不直接删；提示用 provider 命令清 |
| host MCP config（`.claude/` / `.codex/` 里 spec-first 投影的 provider 块） | **spec-first** | `spec-first clean` 清除 spec-first 投影的那部分 config（不碰 provider 自管的 `.codegraph/` 数据） |

原则：**spec-first 只回滚自己写过的东西（host config 投影，经 `spec-first clean`），provider 全局包/索引交还 provider 自带 uninstall**；卸载与安装对称——都 explicit、preview-first，不静默。「退场不留空壳」（§9.4）= `spec-first clean` 清 host config 投影 + 移除 registry 标记，并提示用户用 provider uninstall 清全局包/索引。

> 注：本文不新增 `/spec:runtime-setup` 的 remove/uninstall mode（§4 mode 列表与 SKILL `## Workflow Modes` 只有 `--check/--plan/--verify-only/--install`）。provider 全局包/索引的卸载归 provider 自带 uninstall，host config 投影的清除走既有 `spec-first clean`——不为卸载新造 workflow mode。

### 5.4 双宿主（Claude / Codex）parity

provider 集成必须同时覆盖两个宿主（角色契约：runtime generation 变化需同时考虑 Claude 与 Codex）。落地 parity 清单：

- **入口**：Claude `/spec:runtime-setup`、Codex `$spec-runtime-setup`（迁移期 alias `/spec:mcp-setup`、`$spec-mcp-setup`）。
- **command 模板**：`templates/claude/commands/spec/mcp-setup.md` 的 argument-hint drift（§4.5）落地时连带核对 Codex 侧入口投影是否一致。
- **脚本双实现**：`install-helpers.sh` ↔ `install-helpers.ps1` 必须 parity（含本节卸载、§9.2 gate 逻辑、provider 命令解析）；现有仓库已有 bash↔PowerShell 一致性回归，provider 落地须纳入同类回归。
- **provider MCP config 投影**：`spec-first init` 对 Claude `.claude/` 与 Codex `.codex/` 都要投影 provider MCP 模板（仍不安装 provider）。
- **平台差异显式登记**：Windows 下 codegraph 全局安装/PATH、Graphify 的 Python runtime、GBrain 的 bun——平台差异作为 KNOWN divergence 登记，不静默掩盖（沿用现有 setup 的做法）。

---

## 6. 可用判定与 fallback（spine 的「可用」环节）

「可用」不是布尔，而是 §3.3 ladder 上的位置 + 信任档。判定规则：

| 判定 | 条件 | workflow 可做什么 |
| --- | --- | --- |
| 不可用 | `readiness_status=not-run`（任一前置 rung 缺失） | **fallback 到 rg/ast-grep/direct-read**，主链路照走 |
| 部分可用 | `degraded`（如 `installed=true` 但 `indexed=false`） | 限定用途 + 标 limitation + 给 next_action（如 `codegraph init -i`） |
| 机械可用 | `fresh` + `query_verified=true` | 作为 **evidence candidate** 来源；仍需回源确认才升 confirmed |
| stale | `stale` | 只 advisory；CodeGraph 看 banner 回源，Graphify 禁升 evidence_candidate |

两条 fallback 纪律：

- **fallback 不是「降级」是「等价路径」**：在 spec-first 自身规模 + Claude Code 长上下文下，rg/direct-read 在很多场景等价甚至更优；prompt/UI 不应暗示「降级」。
- **never-block**：provider 链路任何断点都不阻塞主 workflow——这是 provider 作为 P3 optional 的硬要求，也是与 GitNexus（曾深耦合阻塞）的关键区别。

---

## 7. Contract / Schema（复用已落地，不重建）

### 7.1 复用 `provider-readiness.v1`（已 shipped）

> **现状（已验证）**：schema/docs/producer 都在——`docs/contracts/provider-readiness.{md,schema.json}`、producer `src/cli/helpers/setup-facts.js`（`normalizeProviderReadiness` 产完整 8-布尔 lifecycle）。consumer 侧 `src/cli/helpers/spec-work-run-artifact.js` 不 import 本 schema，而是**镜像** `readiness_status` 5 值子集（`provider_untrusted` 字段白名单 `{readiness_status, summaries}`，5 值硬编码与本 schema 一致）。即 producer↔consumer 靠 `readiness_status` 这一 enum 维系一致，不共享完整 schema 绑定。v1.16 是**增量消费**，不「新增核心合同」、不重建 readiness 词表。

```json
{
  "schema_version": "provider-readiness.v1",
  "provider": "codegraph",
  "kind": "code-structure|project-graph|memory",
  "profile": "minimal|recommended|platform",
  "readiness_status": "fresh|stale|degraded|not-run|unknown",
  "lifecycle": {
    "installed": false, "configured": false, "initialized": false, "indexed": false,
    "server_reachable": false, "artifact_exists": false, "query_verified": false, "fallback_used": false
  },
  "repo_aligned": "yes|no|unknown|not-applicable",
  "capabilities": [], "limitations": [], "source_read_required": true,
  "fallback": { "available": true, "methods": ["rg", "direct-source-read"], "reason_code": "provider-not-run" },
  "next_actions": []
}
```

字段消费说明：

- `readiness_status`（轴 A）：schema 约束为 5 值 enum，producer `normalizeProviderStatus` 强制落入 5 值（非法值兜底 `unknown`）；是唯一 readiness enum 字段。
- `repo_aligned`：**schema 约束为 enum** `yes/no/unknown/not-applicable`；但 producer 当前仅做缺省兜底（`entry.repo_aligned || 'unknown'`，不像 `readiness_status` 那样强制 enum 校验）——落地时若上游可能传非 enum 值，应在 producer 补 enum 归一。对 CodeGraph，**优先消费 `codegraph status` / staleness banner 判对齐，不新增 `drift_commits` 等无消费方字段**。
- `lifecycle.*` 各自独立布尔，不塞进 `readiness_status` enum，对应 §3.3 ladder 各 rung。
- 轴 B 不得写入本 schema 任何字段；落地坍缩为二值（语义上 = 父方案 §0.4.2 canonical 的 `evidence_candidate` / `confirmed_context` 两档，**schema/prompt 层统一用 canonical 词，不引入 `candidate`/`confirmed` 作为新词条**避免与父方案词表漂移）。「candidate 必须 cite source file+line 才晋升」写进 workflow prompt（可执行约束），比 schema 枚举更有约束力。

### 7.2 confidence 表达：拒绝移植 SCALE 数值模型

上游 `CodeIntelligence.ts` 用 `.includes()` 子串匹配 + 硬编码 `0.35~0.95` confidence + 「省了几次读」vanity ROI——**直接违反**「脚本产可验证事实、不编造」，是要主动避开的反模式（见 §14）。落地口径：

- 不输出数值 confidence；若必须表达，用分类 `confidence_basis: exact_symbol_match | substring_match | path_heuristic`，**仅当 pilot 真正消费才落字段**。
- 给 CodeGraph 候选标 `inference_method: syntax`（非 LSP type-resolved），仅 pilot 消费时落字段。
- 不产「省了多少次读」ROI 字段；ROI 用 §11 Phase 1 真实插桩测，不靠脚本编造。

### 7.3 复用既有合同

| 既有合同 | 本文如何消费 |
| --- | --- |
| `docs/contracts/context-bundle.md` | provider candidates → related paths / evidence summaries / source-read requirements |
| `docs/contracts/artifact-summary.md` | Graphify report、GBrain recall 用 summary-first handoff |
| `docs/contracts/workflows/spec-work-run-artifact.schema.json` | `provider_untrusted` 记 readiness；`direct_evidence_used` 记确认依据 |
| `docs/contracts/verifiers/verification-evidence.schema.json` | provider affected-test 只能变 verification recommendation，不是验证已运行 |
| `docs/contracts/source-runtime-customization-boundary.md` | 不手改 generated runtime mirror；provider host projection 由 init/setup source 管理 |

### 7.4 后置候选合同（不近期创建）

```text
有稳定 producer + ≥2 workflow 真实消费后再建：
  docs/contracts/context-intelligence/provider-context-result.md
  docs/contracts/context-intelligence/context-fusion-summary.md
  docs/contracts/knowledge/memory-promotion.md
不建议近期创建（会形成第二套 context truth）：
  docs/contracts/context-intelligence-plane.md
  src/cli/context-intelligence/query-router.js
```

其中 `context-fusion-summary` 的落地时机见 §11 Phase 5（CodeGraph pilot 有真实 consumer + 有第二个 provider 进入消费后才考虑）；`provider-context-result` 是 §8.3 adapter envelope 稳定后的固化目标。

---

## 8. Workflow / Skill 接入矩阵

### 8.1 推荐接入顺序

```text
1. spec-runtime-setup → 2. spec-plan → 3. spec-code-review → 4. spec-debug
→ 5. spec-prd → 6. spec-work → 7. spec-compound / spec-compound-refresh
```

### 8.2 Skill 矩阵

> **收敛口径（与 §0 / §11 对齐）**：本表是**最终态完整消费地图**，不是同批交付清单。实际落地受 §11 phase 约束：先只接 **CodeGraph 一个消费节点**（`spec-plan`/`spec-work` 的 impact + affected-test 候选）并实测增益，验证后再扩 `spec-code-review`/`spec-debug`；Graphify 列只在 Phase 3 以手动 artifact-doc 消费；GBrain 列整体后置 Phase 4。Graphify/GBrain 单元格在对应 phase 前是**目标态参照**。

| 阶段 | Skill / Workflow | CodeGraph | Graphify | GBrain | 边界 |
| --- | --- | --- | --- | --- | --- |
| E0 | `spec-runtime-setup` | 检测 CLI/索引/MCP config/freshness | 检测 artifact、refresh 建议 | 检测连接、citation 可达性 | 只产 readiness facts，不判结论 |
| E1 | `spec-plan` | code impact / related files / affected-test 候选 | semantic/domain impact 候选 | 历史约束 / rejected rationale | 不自动扩 scope |
| E1 | `spec-code-review` | changed symbols / callers/callees / blast-radius 候选 | docs/code mismatch 候选 | 类似事故 / 历史规则候选 | finding 必须 direct evidence |
| E1 | `spec-debug` | 调用链 / 实现链 / 路径候选 | 业务流程语义候选 | 历史 RCA / workaround | root cause 必须当前日志/源码/测试确认 |
| E2 | `spec-prd` | 必要时定位入口代码 | brownfield current-state / concept map | 历史背景 / 决策约束 | 只辅助 current-state，不编造 WHAT |
| E2 | `spec-work` | 缩小编辑候选 / 推荐验证候选 | 默认少用 | 默认少用 | 实现阶段避免上下文膨胀，不新增需求 |
| E2 | `spec-compound` | 非主要写入目标 | 可提示 graph refresh | verified learning 可导入 | `docs/solutions/` 仍是第一 durable store |
| E3 | `spec-doc-review` | 核查代码现状声明 | 核查语义现状声明 | 核查历史约束声明 | 最终仍需文本/源码直接证据 |

不建议直接接入：`using-spec-first`（只做入口路由）、`spec-update`（管更新/repair，不初始化 provider）、`spec-release-notes`（release truth 来自版本事实）、`spec-sessions`（可作 GBrain 未来导入来源，但不混同一 truth）。

### 8.3 各 Provider adapter 输出示例

> **落点说明（避免与已落地 schema 混淆）**：下面 JSON 是 **provider adapter 的查询输出**，是一个**独立于 `provider-readiness.v1` 的 envelope**——`candidates` / `inference_method` / `confidence_basis` / `changed_files_since_build` / `gaps` / `items` 等字段**不写入** `provider-readiness.v1`（其 `additionalProperties: false`，producer `normalizeProviderReadiness` 会丢弃未知键）。adapter 内嵌的 readiness 快照（`readiness_status` / `lifecycle` / `repo_aligned`）以 §7.1 canonical 为准；candidate 字段是 adapter 在 readiness 之外追加的查询结果，由 Phase 1 落地的 CodeGraph adapter 产出、workflow 直接消费（走 context-bundle / artifact-summary handoff，见 §7.3），不进 setup facts、不进 run-artifact 的 `provider_untrusted`。这个 adapter envelope 的稳定 schema 在 Phase 1 有真实 consumer 后再固化（§7.4 的 `provider-context-result` 候选），近期保持 adapter-local。

CodeGraph（adapter 在 readiness 快照基础上追加 candidates，readiness 字段以 §7.1 canonical 为准）：

```json
{
  "provider": "codegraph", "readiness_status": "fresh",
  "lifecycle": { "indexed": true, "fallback_used": false }, "repo_aligned": "yes",
  "inference_method": "syntax",
  "candidates": [
    { "type": "symbol_impact", "symbol": "submitOrder", "paths": ["src/order/service.ts"],
      "relationship": "caller", "confidence_basis": "exact_symbol_match", "source_read_required": true }
  ],
  "limitations": []
}
```

Graphify（stale 示例，禁升 evidence_candidate）：

```json
{
  "provider": "graphify", "readiness_status": "stale",
  "lifecycle": { "artifact_exists": true }, "repo_aligned": "no",
  "changed_files_since_build": ["docs/api.md"],
  "candidates": [ { "type": "domain_concept", "concept": "订单提交流程",
    "paths": ["docs/order.md", "src/order/service.ts"], "source_read_required": true } ],
  "gaps": ["docs/api.md changed after graph build"]
}
```

GBrain（recall 必带 citation）：

```json
{
  "provider": "gbrain", "readiness_status": "fresh",
  "items": [ { "type": "historical_decision",
    "summary": "过去拒绝同步扣减库存方案，因为跨市场延迟不可控",
    "citations": ["brain://architecture/order-inventory-2025-11"],
    "freshness": "possibly_stale", "current_source_confirmation_required": true } ],
  "gaps": ["No recent note after 2026-02 migration"]
}
```

---

## 9. 边界不变量、install gate 与信任假设

§4-§8 的边界若只活在 prose 里会被逐步侵蚀（本方案起草过程本身就发生过把「装/刷」职责写错的回归）。本节钉成**可测试不变量 + 执行前置 gate**，由 §13 test 守护。

### 9.1 边界不变量（INV，可测试）

- **INV-1（唯一新增-type mutation）**：spec-first 对 provider 的唯一**新增类**写动作是 `spec-runtime-setup` install 模式（含其 host-config 投影写入）。其对称逆操作（清除 spec-first 投影的 host config）由 `spec-first clean` 拥有（见 §5.3）——host config 投影的写/清是 spec-first 对称拥有的同一类边界。除此之外，generation/index/refresh/watch/write 一律不由 spec-first 触发；provider 全局包/索引的安装与卸载分别归 install 模式 plan 与 provider 自带 uninstall。
- **INV-2（detect 只读）**：`--check`/`--verify-only`/`--plan` 不安装、不写 host config、不触发 provider 刷新。
- **INV-3（init 不装 provider）**：`spec-first init` 只做 source→runtime projection，不安装/初始化 provider；不 init 自动装，不运行时 lazy 装。
- **INV-4（不重造 freshness）**：不为已自报 freshness 的 provider 重建并行 drift 检测，也不新增无消费方的 drift schema 字段。
- **INV-5（candidate 不自晋升）**：provider 输出止于 candidate，`confirmed_context` 只能由 source/test/log/contract/user evidence 达成。

### 9.2 install 执行前置 gate（spec-first 唯一真正执行的高 blast-radius 步骤）

install 真跑 `npm i -g` / `uv tool` 装**单人维护、可能商业化 pivot** 的第三方工具，是本集成最高风险写操作。把最严的闸放在这一步，**作为执行前置而非事后建议**。Gate 复用既有 `helper-tools-registry.v1` 的 `safety` 形状（不新造词表），扩展到 provider registry entry：

```text
执行 install <provider> 前必须满足:
  1. safety.source / safety.source_repo 存在且可核对(来源校验)。
  2. safety.version_policy.pin_status ∈ {pinned, manual};
     latest / unpinned 对 provider 默认【阻断执行】,需 explicit 风险确认才放行
     (helper 既有口径可保留 latest;provider 因 bus-factor/供应链面更严)。
  3. safety.review_required=true → 先 surface risk_flags 再 apply。
  4. blocked install-safety 结果 → skip,不执行。
  5. minimal profile → 不进入该 gate(不装任何 provider)。
```

为什么 spec-kit 没有而 spec-first 要有：spec-kit `self upgrade` 装的是**自己**（官方可信），敢裸命令默认执行；spec-first 装的是 41k★ 但**单人维护**的第三方，信任面不同，必须 gate。**刷新可放心交给 provider，但「装」反而要比 explicit apply 更严。**

### 9.3 显式信任假设：消费 provider 自报 freshness

INV-4 让 spec-first 直接信任 CodeGraph 自报的 `fresh/stale`——这是被显式命名的信任假设：

- `fresh` 只是机械新鲜度提示，不等于 `confirmed_context`。
- `stale` / staleness banner 出现时一律回源 Read。
- 对单人维护工具，「信它的 banner」是小但真实的供应链信任面；接受前提是 freshness 仅机械信号、stale 默认降级，不让它跨成语义结论。

### 9.4 pilot 退场判据（kill-criterion，防永久 limbo）

CodeGraph 作为 §11 Phase 1 pilot 必须带可证伪退场判据：

- **测量者**：`spec-plan`/`spec-work` 在真实任务中开/关 CodeGraph 的对照插桩。
- **毕业判据**：N（≥3）个真实任务上，开启后 agentic-grep token 显著下降且候选命中质量不降 → 升 `recommended`。
- **退场判据**：达不到增益，或维护/供应链风险触发 → 退回 opt-in 或**移除**，不留空壳（对齐 GitNexus「不留 provider 骨架」）。

---

## 10. Provider Registry Shape（`provider-tools.json`，当前为空）

provider 命令是**数据**，进注册表，不硬编码进脚本（改进 scale 的硬编码常量）。shape 合成 scale `DependencyBootstrapDefinition`（砍轻）+ helper-tools `safety` + spec-first profile/fallback：

```json
{
  "schema_version": "provider-tools-registry.v1",
  "providers": [
    {
      "id": "codegraph",
      "kind": "code-structure",
      "profile": "recommended-pilot",
      "required": false,
      "detect": { "command": "codegraph", "paths": [".codegraph/"] },
      "lifecycle_commands": {
        "install":    "npm i -g @colbymchenry/codegraph",
        "configure":  "codegraph install",
        "initialize": "codegraph init -i",
        "probe":      "codegraph status --json"
      },
      "self_managed": ["serve", "refresh", "watch"],
      "safety": {
        "source": "npm",
        "source_repo": "https://github.com/colbymchenry/codegraph",
        "version_policy": { "pin_status": "unpinned" },
        "review_required": true,
        "install_effect": "global-cli + per-project .codegraph index",
        "risk_flags": ["global-npm-install", "single-maintainer", "unpinned-latest"]
      },
      "fallback": { "methods": ["rg", "direct-source-read"] }
    }
  ]
}
```

> **此样例按 §9.2 install gate 默认阻断**：`pin_status: unpinned` + `review_required: true` 反映 codegraph 在 npm 上的真实状态（unpinned-latest）。registry 的职责是**如实记录 provider 状态**，gate 的职责是**据此拦截**——二者不矛盾。落地时要么 pin 到具体版本（`pin_status: pinned` + 版本号）让其放行，要么保留 unpinned 但每次安装需 explicit 风险确认。这个 entry 正是 §13.0 `provider-install-gate.test.js` 的 **blocked-fixture**（断言 unpinned 默认阻断、review_required 先 surface risk_flags）。

三个关键合成字段：

- **`lifecycle_commands.install` vs `.initialize` 分离** ← 来自 scale，是「装≠用」的落点（对应 §3.3 ladder rung）。
- **`self_managed: [serve,refresh,watch]`** ← 显式声明 spec-first **不碰**什么，把 INV-1/INV-4 编码成数据（scale/spec-kit 都没这么显式）。
- **`safety`** ← 复用 `helper-tools-registry.v1`，不另造词表，喂给 §9.2 install gate。

形状差异（所以必须声明式 registry）：Graphify entry 终点在 `artifact_exists`（无 serve/probe，`self_managed` 含 `post-commit-hook`）；GBrain 多一节 `populated`（`executor: user-only`，**registry/prose 语义 rung，不是 lifecycle 布尔位**，见 §3.3 注——绝不为它扩 `provider-readiness.v1.lifecycle`）。

### 10.1 落地前置（当前尚不存在，必须作为 Phase 0/1 交付项）

「provider 命令是数据、不硬编码」目前仍是设计意图,落地前有两个硬前置必须先做,否则填完 registry entry 仍要改脚本:

- **`provider-tools-registry.v1` schema 文件不存在**（`docs/contracts/` 下无）。Phase 0 必须先落 `docs/contracts/provider-tools-registry.{md,schema.json}`,明确 `lifecycle_commands` / `self_managed` / `safety`（复用 `helper-tools-registry.v1` 的 safety 子结构,用 `$ref` 或 anyOf 扩展,不复制定义）/ `fallback` 的字段约束,并挂上 validator——否则 §13.0 `provider-install-gate.test.js` 无校验依据。
- **`install-helpers.{sh,ps1}` 当前不读 `provider-tools.json`**（实测:它读 helper-registry,无任何 provider-tools 引用,ps1 同）。Phase 1 必须把「扩 `install-helpers.{sh,ps1}` 读取 registry `lifecycle_commands` 并按 mode 执行」列为明确交付,且双宿主 parity——否则「数据驱动不硬编码」不成立。

---

## 11. 分阶段落地路线（收敛）

不三者平级铺开。每个 phase 必须满足父方案 §9.0.1「无消费方=不交付」。

**Phase 0 — 复用已落地底座 + 建 registry 合同（不集成任何工具）**：复用既有 `provider-readiness.v1` 做 provider-specific 消费约定（**不重建** readiness 词表）；落 `provider-tools-registry.{md,schema.json}`（§10.1，新 registry 合同，safety 子结构 `$ref` 复用 `helper-tools-registry.v1`）；轴 B 坍缩为 `evidence_candidate/confirmed_context` canonical 二值；「candidate 必 cite source+line」写进 workflow prompt；「无消费方=不交付」钉为硬验收。修 §4.5 的 `argument-hint` drift,验证用 `npm run lint:skill-entrypoints`（已存在）或补 contract test。*不含*：重建 `provider-readiness.v1`、新增无消费方字段、引入外部工具。

**Phase 1 — CodeGraph 唯一 pilot（opt-in，不进 recommended）**：扩 `install-helpers.{sh,ps1}` 读 registry `lifecycle_commands` 并按 mode 执行（§10.1，双宿主 parity）；填 `provider-tools.json` 的 codegraph entry；detect 消费 `codegraph status`/banner（不重造 drift；`codegraph status --json` 的字段结构以 Phase 1 `--help`/fixture 复核为准,不写死进 source）；adapter 标 `inference_method: syntax`、不输出数值 confidence；**只接一个**消费节点（`spec-plan`/`spec-work` impact + affected-test）；stale/dirty 降级到 rg/ast-grep（呈现为等价路径）；**插桩实测** token 与命中质量,**测量结果落点必须明确**（建议:run-artifact 增一个 measurement 字段或独立 `docs/` measurement log,供 Phase 2 决策；命中质量指标在 Phase 1 task 内定义）。*不含*：默认安装、进 recommended、result 直进 finding、`doctor` 把缺失报成 baseline failure。

**Phase 2 — 用真实数据决策**：插桩显示实测增益 → CodeGraph 升 `recommended`；否则保持 opt-in 或移除。Serena（LSP-via-MCP）仅在「精确 rename/references」真实需求出现时作 `platform` 补充评估——**不替代 CodeGraph、不在本期引入**（需为每语言常驻 language server，比刚移除的 GitNexus 更重，同级 bus-factor）。

**Phase 3 — Graphify 降 artifact-doc（移出 readiness loop）**：仅当 brainstorm/plan 暴露「direct-read + ast-grep 填不了的全局架构地图」缺口才启用。用户手动 `/graphify .`；`GRAPH_REPORT.md` 检入；workflow 当普通文档读；stale 禁升 evidence_candidate。doc-code 一致性用 `rg` diff + ast-grep + `/spec:doc-review` fresh read。*不含*：进 readiness loop、minimal 默认生成 `graphify-out/`、silent hook install、Python runtime 作 spec-first 依赖。

**Phase 4 — GBrain 后置**：先强化 `docs/solutions/` 结构化字段（`domain`/`pattern`/`rejected_alternatives`/`applicable_versions`/`invalidation_condition`）+ grep 索引。只有实测 recall 缺口才评估；若引入，作**用户侧外部 MCP** 消费带 citation 的 refs，不作 spec-first 自有 knowledge 节点。*不含*：默认 external write、session transcript 自动导入、recall 直作当前事实、外包 Knowledge 节点。

**Phase 5 — Context Fusion Summary（最后置）**：CodeGraph pilot 有真实 consumer 且有第二个 provider 进入消费后再考虑 `context-fusion-summary.v1`（compact summary，区分 confirmed/candidate/conflict/gap，不是中心化 router）。

---

## 12. 验收标准

> 消费侧验收门槛（继承父方案 §9.0.1）：每个 provider capability 除 readiness/contract 验收外，还必须有 §8.2 矩阵中至少一个 named workflow 因消费它产生**可观察行为变化**，否则停在 advisory、不计入完成。示例：`spec-plan` 因 CodeGraph candidate 减少盲读；`spec-debug` 因 provider `not-run/stale` 明确走 fallback 而非阻塞。

- **Readiness**：`minimal` 不装三者；missing → `not-run` + fallback；stale → `stale` + refresh next action；install plan 不执行安装除非 explicit apply 且过 gate；setup facts 不替代语义代码理解。
- **CodeGraph**：未建索引时报 `not-run`/`degraded` 不阻塞；status 可读时输出 index/alignment/freshness facts；`spec-plan`/`spec-code-review` 拿到 related/blast-radius 候选；affected-test 只进 verification recommendation；stale index 不产 `confirmed_context`。
- **Graphify**：artifact 缺失报 `not-run` 不阻塞 minimal；存在时 summary-first 进 context；stale 提示 refresh；result 必带 source paths/refs/limitations；不 silent write。
- **GBrain**：不可用不阻塞 plan/work/review/debug；recall 必带 citation/limitation；stale/conflict 显示 gap；`spec-compound` 只把 verified learning 作 import candidate；不自动写长期记忆。
- **可用判定（§6）**：fallback 呈现为等价路径而非降级；provider 链路任何断点不阻塞主 workflow；provider result 与 source-read 冲突时 source-read 优先。

---

## 13. 测试策略

### 13.0 边界不变量与 install gate Tests（守 §9）

命名沿用现有风格（`dependency-readiness-baseline.test.js` / `scale-provider-doc-contracts.test.js`）：

- `provider-boundary-invariants.test.js`：INV-1/2（`--check/--verify-only/--plan` 无 provider 安装/host-config/刷新副作用）；INV-3（`spec-first init` 路径不含 provider 安装/初始化调用）；INV-4（readiness producer 不输出并行 drift 字段）；INV-5（标 `confirmed_context` 必带 direct source refs）。
- `provider-install-gate.test.js`：缺 `safety.source`/`source_repo` → 阻断；`pin_status ∈ {latest,unpinned}` → 默认阻断需 explicit 确认；`review_required=true` → 先 surface risk_flags；`blocked` → skip；`minimal` profile → 不进 gate。

### 13.1 Contract Tests

- `provider-readiness.v1` schema valid/invalid；unknown provider kind rejected；stale 要求 reason/next action；标 `confirmed_context` 必带 direct source refs（schema 自身不承载该字段）；generated runtime paths 不进 source refs；**`provider-tools-registry.v1` schema valid/invalid（Phase 0 新建,见 §10.1）**,其 `safety` 子结构 `$ref` 复用 `helper-tools-registry.v1`、不复制定义。

### 13.2 Setup Tests

- verify-only 不安装；install plan 输出命令但不执行；explicit apply 才允许安装/初始化/refresh 且必须先过 §9.2 gate；provider-specific configured dependency entries 区分 installed/configured/reachable/fresh；project setup facts path containment 生效。

### 13.3 Workflow Tests

- `spec-plan` candidate 不扩 scope；`spec-code-review` candidate 不直接生成 finding；`spec-debug` historical RCA 不直接变 root cause；`spec-work` affected-test candidate 不写成测试已运行；`spec-compound` 只导入 verified learning candidate。

---

## 14. 反模式

禁止：

- 把三者写成 minimal 默认依赖 / 平级铺开集成 / init 自动装 / 运行时 lazy 自动装。
- 把 provider result 直接写成 confirmed truth。
- 用 `Context Intelligence Plane` 替代 existing Harness contracts；近期新增 `src/cli/context-intelligence/`。
- 新增 provider CLI 命令时不先建 source contract 和测试。
- ordinary workflow 中自动安装/自动刷新 Graphify/自动写 GBrain。
- 把远端分支或外部 README 当作当前本地 source-of-truth。
- **移植 SCALE `CodeIntelligence.ts` 的硬编码数值 confidence（0.35~0.95）、`.includes()` 伪装图谱、vanity ROI 指标**。
- **在 Claude Code 内重建一层 grep/检索 + 自造 confidence + 自造 router**（provider 唯一正当性是 ADD host 做不到的精确 cross-file 图谱）。
- **新增无消费方的 schema 字段**（未被 pilot 消费就先落 `drift_commits`/`inference_method`）；reconstruct 已落地的 `provider-readiness.v1`。
- **在 GitNexus 移除「本期不加替代」语境下，不论证「这次为何不同」就把 provider 做成深耦合/非可选**。

允许：

- `recommended`（仅 CodeGraph，先测量后纳入）/ `platform` 中**显式** opt-in provider；required 标记 + 一键批量装（过 gate）。
- 用 CodeGraph 降低盲读成本（标 `inference_method: syntax`，回源确认）。
- 用 Graphify（手动 artifact-doc）辅助 brownfield current-state。
- 实测 recall 缺口后用外部 GBrain 召回历史约束（作用户侧 MCP，消费带 citation 的 refs）。
- 用 provider candidates 触发 source-read / test/log / review confirmation；verified learning 后做 optional memory promotion。

---

## 15. 最终结论

CodeGraph / Graphify / GBrain 都不是冷门工具（41k/59k/21k★，MIT，Claude-Code-native），但**值得做的不是三者平级集成**，而是收敛交付面、先测量再默认，并把「集成→安装→刷新→可用」做成可治理的链路：

```text
集成: 只 CodeGraph 进 pilot,论证"GitNexus 刚移除、这次为何不同"(optional/非阻塞 vs 深耦合)
安装: spec-runtime-setup --install 显式 one-pass 装齐 required,过 install gate(pin+来源校验);
      init 只投影、不装;不运行时 lazy 装
刷新: 全交还 provider 自管(CodeGraph watcher / Graphify hook / GBrain ingest),spec-first 不代刷
可用: lifecycle ladder 到 query_verified 仅代表机械可用;缺失/stale 一律 fallback,never-block;
      candidate 必经 source/test/log/review 才升 confirmed
```

设计取两家之长、砍两家之重：**用 spec-kit 的四层薄骨架装载 scale 的 `needs-init`+`initializeCommands` 引擎语义，落到 spec-first 已 shipped 的 `provider-readiness.v1` 上（`degraded`+`indexed=false` 替代 scale 第 7 态），provider 命令进 `provider-tools.json` 注册表而非硬编码，并多压一道第三方 install gate**——在信任面上比两家都更严。

一句话方案：

> 以已落地的 `provider-readiness` 和 existing Harness contracts 管住三者，把交付面收敛为 **CodeGraph 单点 opt-in pilot + Graphify artifact-doc + GBrain 后置**，安装走显式 `/spec:runtime-setup --install`（过 gate）、刷新交还 provider、可用判定走 lifecycle ladder 且永不阻塞主链路，让它们成为可降级、可追溯、可确认的上下文候选提供者，而不是替代 `spec-first` workflow judgment 的平台核心，更不是 GitNexus 的换皮重来。
