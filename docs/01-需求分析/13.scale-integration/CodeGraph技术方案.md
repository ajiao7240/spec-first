# spec-first 与 CodeGraph / Graphify 的 capability-aware 协同方案

> 本文是 `spec-first内化集成scale-project-scaffold技术方案.md` 的专项子方案。
> 父方案定义总边界、优先级和版本节奏；本文确定 **code-intelligence 能力工具如何与 spec-first 协同**。
>
> **本文主干（spine）**：spec-first 是 AI coding 的 **workflow harness（编排 + 证据治理）**；CodeGraph / Graphify 是研发人员工具箱里的 **capability tools**。核心边界是 **「install 帮装（setup + gate + 用户同意）、消费不耦合（capability-aware）」**——
> `定位(§1) → 消费能力类别(§2) → install 做什么/消费做什么/不做什么(§3) → 三个工具落点(§4) → 边界纪律含 ladder + 两轴(§5) → 真实证据(§6) → 与 GitNexus 的区别(§7) → 落地与反模式(§8)`。

---

## 0. 校准结论

**核心边界不是「装 vs 不装」，而是「setup 时机帮装（显式、过 gate、配成 provider-native MCP/CLI 工具接口）可以；运行期消费耦合禁止」。** spec-first 本就通过 `spec-runtime-setup` + install safety gate 帮用户装第三方 helper（gh/jq/ast-grep 等）；CodeGraph / Graphify 走同一条「detect → 用户同意 → install」路径，**但消费侧保持 capability-aware 不耦合**：spec-first 不认具体工具名、不注入 routing/reminder/instruction block、不拥有刷新。

三者最终处置（不平级、不对称）：

```text
CodeGraph = code-graph 能力工具：setup 里帮装(过 gate+用户同意),经 `mcp-tools.json` + `install-mcp` 配 MCP + 首次 index；status 有 Pending Changes 时有界 sync 一次；大仓影响面增强,小仓默认 rg
Graphify  = project-graph 能力工具：setup 里帮装 CLI 和 project skill(过 gate)并做 provider-native 首次生成；后续刷新/查询走 Graphify 原生能力，产物默认是项目根 `graphify-out/`，是否提交由团队决定
GBrain    = 删除。memory 能力与 spec-first 自有 docs/solutions/ 直接重叠，默认不集成（见 §4.3 决策记录）
```

为什么帮装是安全的、且能解开消费方死锁：CodeGraph 装成 MCP server 后，在 Claude Code / Codex 工具层**原生可见**，LLM 直接可调——**既不需要注入 instruction block（不耦合），又能被 workflow 消费（不死锁）**。GitNexus 的死因从来不是 install，而是消费侧深度耦合（见 §0.1）。

### 0.1 这次为什么不同于 GitNexus（先读）

`docs/plans/2026-06-02-001-refactor-remove-gitnexus-integration-plan.md`（status: completed）三天前把 GitNexus 这一图谱 provider 从 active product surface **硬删除**，明文「删除后的默认上下文路径是 bounded direct source reads、`rg`、ast-grep、git diff、tests/logs……**本期不新增替代 graph provider，也不保留 provider-neutral graph-bootstrap 空壳**」。

GitNexus 的死因不是「图谱能力不好」，**也不是「装了第三方工具」**，而是 **消费侧 provider-specific 深度耦合**：spec-first 到处写死 `gitnexus` 这个名字——host instruction block 提它、startup reminder 推它、workflow routing 依赖它、`spec-graph-bootstrap` public workflow 为它而建、review-pre-facts helper 消费它的产物 schema、contracts/CI gate/package allowlist 全都焊死。工具和**消费/编排层**焊在一起，**非可选**。

本方案是对这个教训的**结构性回应**，而不是话术承诺「这次我们克制」：

- 不是「再加一个 provider，并把它焊进 routing/reminder/instruction block」——那是把 GitNexus 的耦合路径重走一遍。
- 而是**把 install 与 consumption 拆开**：install 走既有 setup + gate（与帮装 gh/jq 同构，安全）；consumption 只认**能力类别**（code-graph / project-graph），不认任何具体工具名、不消费工具内部 schema、不注入任何编排面、不拥有刷新。研发人员用 CodeGraph 还是别的 code-graph 工具，spec-first 的消费侧不关心——它通过 provider-native MCP/CLI 工具接口获取「影响面候选」这类**能力输出抽象**，不经 spec-first 注入。

消费侧只认能力类别、不认 provider，**从结构上不可能**重新长成 GitNexus 的消费耦合。这是与 GitNexus 真正的架构差异。

### 0.2 本文不是什么

```text
不是把 install + 消费耦合 + adapter + fusion 打包成 provider 集成全链路。
不是在消费侧写死工具名 / 注入 routing/reminder/instruction block / review-pre-facts 硬依赖工具产物 schema。
不是 init 自动装 / 运行时 lazy 自动装 / spec-first 代刷新。
不是新增中心化 Context Intelligence Plane 或 Query Router、elaborate adapter envelope、context fusion summary、7 态机。
不是让工具输出直接成为 finding / root cause / scope authority / confirmed truth。
不是把外部工具 README 当作 spec-first 当前 source-of-truth。
不是让下游 workflow 自动运行 `graphify .`、Runtime Setup silent 安装 Graphify hook、或自动把 Graphify 产物写进长期 docs。
```

### 0.3 三层协作不是线性 pipeline

2026-06-07 决策记录：最佳版本不是 `源码 -> CodeGraph -> Graphify` 的硬线性 pipeline，而是分层协作结构：

```text
源码       = 唯一 confirmed truth
直接 source read / rg / ast-grep = confirmed evidence lane
CodeGraph = tactical index，用来缩小源码读取面、给出调用链/影响面/受影响测试/ownership 候选
Graphify  = strategic project map，综合源码证据 + 可选 CodeGraph candidates，给当前项目提供 provider-owned 高层导航
```

不是“源码服务于 CodeGraph”，而是 CodeGraph 服务于更快找到该读的源码，Graphify 服务于更快理解项目结构和变化影响，源码始终服务于验证结论是否成立。Graphify 可以消费源码证据和可选 CodeGraph candidates，但 CodeGraph 产物只能帮助 Graphify 缩小候选范围，不能成为 Graphify 的事实来源。Graphify 输出默认是 provider-owned 项目根 `graphify-out/`：可在后续需求、plan、review、debug 中作为架构导航使用，但 `$spec-mcp-setup` 不自动 add/commit、不进入团队 source-of-truth、不替代 `docs/solutions/` 或项目文档。只有经过人工 promotion、补齐 source refs 与 invalidation condition 的内容，才可以沉淀为长期 docs/knowledge。

### 0.4 Runtime Setup 只做 provider onboarding

2026-06-07 决策更新：`spec-runtime-setup`（迁移期 alias：`spec-mcp-setup`）的正确边界不是“接管 CodeGraph/Graphify 能力”，而是 **provider onboarding + readiness facts**。

```text
Runtime Setup 负责:
  - 检测 host/runtime state
  - 过 explicit gate 安装/配置 provider
  - 执行 provider setup 所需的 bootstrap
  - 写入 setup-owned readiness facts
  - 输出 next_action

Provider 自己负责:
  - 索引 / 图谱生成
  - watcher / hook / refresh
  - query surface
  - provider 内部 schema 与缓存

Workflow 负责:
  - 优先通过 provider-native MCP/CLI 工具接口获取 advisory candidates
  - 不直接消费 provider 内部 schema 或全量 artifact
  - artifact 只作为 provider-owned backing store；无工具接口时可有界读取摘要段作 fallback
  - 缺失或 stale 时 fallback
  - 用 source/test/log/contract/user evidence 回源确认结论
```

具体到两类 provider：

- **CodeGraph**：Runtime Setup 可负责 opt-in、MCP host config、`codegraph init`、readiness probe；若 `codegraph status` 报 `Pending Changes`，setup 有界执行一次 `codegraph sync` 并复查。之后 `.codegraph` 索引刷新、file watcher、MCP 工具面由 CodeGraph 自己维护。
- **Graphify**：Runtime Setup 可负责安装 `graphify` CLI 和当前 host 的 project-scoped Graphify assistant skill，并在显式 setup/init gate 后执行 Graphify 原生首次 project-graph 生成，随后为当前项目执行 `graphify hook install` 作为 provider-native 自动刷新 setup，并检测工具接口、artifact 与 hook readiness；`graphify-out/`、post-commit/post-checkout hook、后续刷新/查询由 Graphify 原生能力负责。Graphify MCP server 仍是可选 extra，不默认安装；`graphify watch` 是长运行进程，不作为默认 setup 动作。

因此，下游 `spec-plan` / `spec-work` / `spec-code-review` / `spec-debug` 的决策对象是“是否调用已有 provider-native MCP/CLI 工具接口获取 advisory candidates”，不是“是否在 workflow 内生成 provider artifact”，也不是“是否直接读取 provider 全量产物”。

---

## 1. 定位：harness 编排 capability tools；setup 帮装，消费不耦合

| 维度 | spec-first 做 | spec-first 不做 |
| --- | --- | --- |
| **接入准备** | `spec-runtime-setup` detect 缺失 → install gate → 用户同意 → 安装/配置/执行 provider setup bootstrap（与帮装 gh/jq 同构） | init 自动装、运行期 lazy 自动装、跳过 gate 静默装 |
| **消费** | provider-native MCP/CLI 工具接口可用时，workflow LLM 按能力类别调用接口获取 advisory candidates + 回源确认；artifact 仅作 backing store / bounded fallback | 写死工具名、注入 routing/reminder/instruction block、review-pre-facts 硬依赖其产物 schema，直接读取全量 artifact，或在 workflow 内生成 provider artifact |
| **刷新** | 记录 freshness/readiness facts，并把 watcher / hook / refresh 交给 provider 自己 | 代刷新、silent 装 hook、重建并行 drift 检测 |

这个定位有两个要点：

1. **衡量 code-graph 价值的标尺是研发人员的目标项目（target repo），不是 spec-first 这个工具仓自己。** spec-first 自身是 <500 文件的 CLI，用 `rg`/ast-grep 足够；但研发人员完全可能在百万行 monorepo 上用 spec-first——那里 code-graph 是真实增强。所以 setup 帮装是有价值的：它服务的是用户的大仓，不是 spec-first 自己。
2. **install 与 consumption 是两件事**。install 走既有 setup + gate（spec-first 一直在帮装第三方 helper，这条路成熟、安全）；consumption 保持 capability-aware（只认能力类别、经 provider-native MCP/CLI 工具接口、不注入编排）。把两者拆开，既兑现「帮用户装好」，又不重蹈 GitNexus 的消费耦合。

消费侧的姿态不是新发明。spec-first 的 `CLAUDE.md` 早已对 ast-grep 持同样姿态：

> ast-grep、browser tooling 和其他 MCP providers 是外部或辅助能力。Downstream workflows 应消费 source refs、direct evidence、readiness facts，不应依赖 provider 内部实现细节。

**把 CodeGraph / Graphify 当成和 ast-grep 同一类的「外部辅助能力」**——这就是本文的定位，且它已是 spec-first 的既有哲学，不需要新造 provider 协议。

---

## 2. 能力类别（抽象层，不写死工具名）

spec-first 只在 workflow prose 里引导**能力类别**，绝不点名具体工具或工具内部命令（点名即退回 provider-specific，GitNexus 死因复活）：

| 能力类别 | 回答的问题 | 现状 fallback（缺失时的等价路径） | 对应工具示例（不写进 prose） |
| --- | --- | --- | --- |
| **code-graph** | 谁调用我？改这个符号影响谁？diff 的影响面/受影响测试候选？ | `rg` + ast-grep + 多轮 agentic search + direct read | CodeGraph |
| **project-graph** | 业务概念、模块语义关系、架构总览、god nodes、doc-code 不一致 | `docs/`、direct read、ast-grep | Graphify（MCP/CLI query；artifact 是 backing store / summary fallback） |
| **memory** | 历史决策、类似 RCA、已拒绝方案、团队约束 | **`docs/solutions/`**（file-first，可审计、零运维） | —（默认不集成，见 §4.3） |

术语映射（钉死，避免 v1.16 registry 写错）：上表的 `code-graph` 是 prose capability class，用于 workflow prompt 和人读方案；落到 `provider-readiness.v1` / `mcp-tools.json` provider metadata 的机械 schema 时，CodeGraph entry 的 `kind` 必须写 `code-structure`，因为 `docs/contracts/provider-readiness.schema.json` 只允许 `code-structure|project-graph|memory|generic`。不要在 registry 里写 `kind:"code-graph"`。

引导句的统一形态（写进 workflow prompt 时按节点裁剪）：

> 若工具箱里存在 \<能力类别\> 能力（如用户自管的 MCP / CLI 工具接口），可在 \<对应节点\> 优先通过 provider-native 工具接口获取 advisory candidates；缺失则走 fallback。artifact 只是 provider-owned backing store，只有无可用工具接口时才有界读取摘要段。采纳前先确认该产出相对当前 worktree 的新鲜度；任何此类输出都是 candidate，结论仍需 source/test/log/contract/user evidence 回源确认。

注意：引导句里只有「code-graph 能力」这样的**类别词**，没有 `codegraph_callers` 这种**工具内部命令名**。这条抽象层级是 §7 防 GitNexus 复发的承重墙，不可破。

---

## 3. spec-first 做什么 / 不做什么

### 3.1 该做：install 帮装（setup 时机）+ 消费引导（capability-aware）

**安装侧（复用既有 setup + gate 机制）**：

- CodeGraph 是 MCP server：落 `mcp-tools.json` explicit opt-in entry，复用 `install-mcp.{sh,ps1}` / `configure-host.*` / project bootstrap，完成 warmup、host MCP config、首次 index 和 probe readiness。
- Graphify 是 CLI + artifact-backed provider：落 `provider-tools.json`，复用 `install-helpers.{sh,ps1}` 安装 CLI 和 project skill；Runtime Setup 在显式 setup/init gate 后可执行 Graphify 原生首次 project-graph 生成，并检测工具接口、项目根 artifact readiness 与 hook readiness。
- `spec-runtime-setup` detect 到缺失 → 过 install gate → 用户同意后装。**触发只在 setup workflow 里**，不在 plan/work/review 主动弹（见 §7 复发信号）。
- Graphify project hook onboarding 属于确认后的 provider pack 目标：preview-first + explicit gate 后执行 `graphify hook install`，刷新仍归 provider hook 自己；禁止 silent/baseline hook install。

**消费侧（capability-aware，不耦合）**：

- 在 `spec-plan` / `spec-code-review` / `spec-debug` / knowledge 节点各加**一句 capability-class 引导**（§2 句式），把「工具箱若有这类能力就利用其 advisory 产出 + 回源 + fallback」写进 prose——**只认能力类别，不写工具名**。
- 这些 workflow 只判断是否调用已有 provider-native MCP/CLI 工具接口获取 advisory candidates；缺失或 stale 时 fallback 或给 next_action，**不在 workflow 内生成 provider artifact，也不直接读取 provider 全量产物**。
- 装成 MCP 后工具在 Claude Code / Codex 工具层原生可见，LLM 直接调，**不经 instruction block 注入**。
- 复用既有 `provider_untrusted`（`spec-work-run-artifact.js` 已有）记机械 readiness + 候选，一视同仁不做特例。

### 3.2 不该做（消费耦合 + 过度设计，全部砍掉）

| 反模式动作 | 为什么砍 |
| --- | --- |
| 消费侧在 prose 写死工具名 / 工具内部命令（`codegraph_callers`） | 退回 provider-specific，GitNexus 死因复活 |
| 注入 routing / reminder / instruction block / review-pre-facts 硬依赖工具产物 schema | 这才是 GitNexus 真正死因（消费耦合，非 install） |
| 在 plan/work/review 运行期主动弹安装 / 运行期 lazy 装 / init 自动装 | install 只在 setup 显式 mode；运行期主动弹会长成 reminder 耦合 |
| 代刷新 / silent 或 baseline 装 hook / 重建并行 drift 检测 / 自动 `graphify .` | Graphify 项目 hook 只能在 `$spec-mcp-setup` guided confirmation 或显式 `--only graphify` 后安装；刷新执行归 provider hook/CLI，spec-first 只记录 freshness/readiness 信号 |
| elaborate adapter envelope / context fusion summary / 7 态机 / Context Intelligence Plane | 过度设计；消费走 provider-native MCP/CLI 工具接口 + 既有 `provider_untrusted` 足够 |
| 让工具输出直接成为 finding / root cause / confirmed truth | 顺从 CodeGraph「别回源」注入，违反证据契约 |

**关键拆分**：install 侧复用成熟的 setup + gate（与帮装 gh/jq 同构，**该做**）；消费侧保持 capability-aware（**不耦合**）。把两者拆开，是「帮用户装好」与「不重蹈 GitNexus」能同时成立的原因。

---

## 4. 三个工具各自的落点

### 4.1 CodeGraph：setup 帮装的 code-graph MCP

- **形态**：always-on MCP server（`gh` 实测 41.5k★ / MIT / TypeScript / 自带 MCP server，本地源码核实 tree-sitter→SQLite+FTS5 + file-watcher 增量 sync + staleness banner 属实；npm 已复核到 v0.9.9，仍未到 1.0，命令会漂移）。
- **安装协同**：`spec-runtime-setup` detect → install gate（用户同意）→ `mcp-tools.json` opt-in MCP entry 经 `install-mcp` warmup + 配 MCP + 首次 `codegraph init`。`codegraph init` 已源码核实（本地 `src/bin/codegraph.ts:420-448`）：默认即建初始索引，`-i/--index` 为 deprecated no-op（仅向后兼容），**用 `init` 即可**。若 `codegraph status` 继续报告 `Pending Changes`，Runtime Setup 只做一次 provider-native `codegraph sync` 并复查，不创建 spec-first sync loop。一处落地注意：`codegraph init` 在 watcher 可用环境基本非交互，但在 watcher-disabled 环境（WSL2 `/mnt/*`）会弹 hook-vs-manual 的 `@clack/prompts` 选择（可取消降级，不硬阻塞），setup 无人值守路径需处理。**装≠用**用既有 `provider-readiness.v2` 的 lifecycle 布尔位表达（`installed → configured → indexed → server_reachable → query_verified`，见 §5.2）。
- **消费协同**：装成 MCP 后在工具层原生可见，workflow LLM 按 §2 code-graph 引导利用其影响面候选——**经原生 MCP 工具面，不经 spec-first 注入**。advisory + 回源。
- **何时有真实增益**：大仓的 `spec-plan` / `spec-code-review` 影响面分析（谁调我、改这影响谁、affected-test 候选）——这是 `rg`/ast-grep 给不了的全局反向闭包。小仓默认 `rg`，**不是降级，是等价更优**（CodeGraph 自己的 A/B benchmark 承认 tiny repos 上带它反而更慢、成本更高，见 §6）。
- **必须守的信任边界**：CodeGraph 的 MCP server 在会话初始化时注入 `"Trust codegraph's results — don't re-verify them with grep"`（`src/mcp/server-instructions.ts` 实证）。这与 spec-first「结论性消费必须回源确认」冲突——但**官方同一份 instructions 自己也写明** `"No live correctness validation — that's still the compiler/test/linter's job. Codegraph supplements those with structural context"`。即官方承认 codegraph 给的是**结构上下文,不是正确性验证**。spec-first 据此区分：**探索性导航**（找相关符号、缩小读取范围）可信 codegraph 不复核（与官方一致）；**结论性消费**（finding/root-cause/scope/merge）必须回源（官方的 "no correctness validation" 正好背书）。详见 §4.1.2 与 §5。

#### 4.1.1 安装落点：三层分属不同级别（核源码确认）

CodeGraph 的安装**不是「装到用户级 or 项目级」二选一**，而是三层各落不同级别（本地源码 `src/directory.ts` 核实 `.codegraph/codegraph.db` 是 per-project；CLI bin 是 global npm）：

| 层 | 内容 | 级别 | owner / 回滚 |
| --- | --- | --- | --- |
| ① CLI 本体 | `npm i -g @colbymchenry/codegraph` 可执行文件 | **用户级**（global npm，一机一份，跨项目复用） | 用户机器；`codegraph uninstall` 自卸 |
| ② 索引数据 | `.codegraph/codegraph.db`（tree-sitter 解析结果） | **项目级**（每 repo 一份） | 工具/用户；`codegraph uninit` 清，工具自写 `.codegraph/.gitignore` 不入库 |
| ③ MCP 配置 | 告诉 host「有这个 server」 | **默认项目级，可选用户级**（见下） | **spec-first 投影**（唯一 spec-first 写、`spec-first clean` 清的那层） |

**③ MCP 配置默认项目级**，因为：(a) 复用 spec-first 既有的 `.claude/`/`.codex/` host runtime 项目级投影 + `spec-first clean` 回滚，零新增基础设施；(b) 匹配「按项目特征决定用不用」——大仓 repo 配、小仓 repo 不配，精准；(c) 不污染用户全局环境（用户级是更高 blast-radius 写操作，且 `clean` 够不着）。**setup 同意时允许用户显式选「配到用户级跨项目复用」**（用户级 host config），但默认项目级。

**install gate 的同意提示必须说清三层级别**，而非含糊问「装吗」：

```text
将安装 CodeGraph(code-graph 能力):
  ① CLI 本体 → 用户级 global(一机一份,跨项目复用)
  ② 当前项目索引 .codegraph/ → 项目级(只影响此 repo,不入 git)
  ③ MCP 配置 → 项目级(默认;此 repo 可调。可选: 配到用户级跨项目复用)
来源: npm @colbymchenry/codegraph (单人维护, pinned 0.9.9, pre-1.0)
要继续吗? [y/N]
```

#### 4.1.2 agent 高效读取协议（官方最佳实践 + spec-first 纪律）

CodeGraph 官方（本地 clone `src/mcp/server-instructions.ts` 全文 + Context7 `/colbymchenry/codegraph` 一致）对 agent 的最佳实践是**按 intent 选工具 + 一次组合调用 + 信 banner**。它通过 MCP `initialize` 把这套 playbook 注入 agent system prompt——这正是「装成 MCP 即原生可见、不需 spec-first 注入」的机制本身（§4.1 消费协同）。官方**按 intent 组织的工具集**（共 10 个 `codegraph_*`，下表按意图归类，`node`/`files` 见末行注）与推荐用法：

| 意图 | 官方推荐工具 | 高效要点 |
| --- | --- | --- |
| 这个 task/feature/area 是怎么回事？ | `codegraph_context`（**PRIMARY**） | 一次组合 search+node+callers+callees，**别 chain `search`+`node`** |
| X 怎么到达 Y / 追调用流 | `codegraph_trace` | 一次返回整条路径含动态分发跳（callback/JSX）——**别用 search+callers 手动重建** |
| 改这个会 break 什么 | `codegraph_impact` | blast-radius 一次出，**别手动 walk callers** |
| 谁调我 / 我调谁 | `codegraph_callers` / `codegraph_callees` | 单跳关系 |
| 看多个相关符号源码 | `codegraph_explore`（一次 capped） | **别 loop `codegraph_node`**（每次重读上下文，贵） |
| 查单个符号名 | `codegraph_search` | **别先 grep** |
| 索引就绪/新鲜度 | `codegraph_status` | 列 pending sync 文件 |
| 看单个符号源码/签名 / 看项目文件布局 | `codegraph_node` / `codegraph_files` | 单符号用 `node`（别 loop，多符号走 `explore`）；`files` 出索引文件树 |

> 上表 8 行覆盖全部 10 个 `codegraph_*` 工具（`callers`/`callees` 合一行、末行含 `node`/`files`）。

官方核心姿态是 **"Answer directly — don't delegate exploration"**：onboarding/架构/trace 类问题用 2-3 个 codegraph 调用直接答（`context` 打头，必要时一个 `explore`），不要再起 grep+read 循环、也不要派子 agent 重做 codegraph 已做的事。

**spec-first 套用 + 叠加纪律**（与 §4.2.1 Graphify 同构对称）：

| 维度 | 官方做法 | spec-first 动作 |
| --- | --- | --- |
| 工具选择 | 按 intent 选,`context`/`trace`/`impact` 优先组合调用 | 直接采用——这套 intent 映射写进 workflow prose 的 capability-class **语义引导**（描述意图，**不点工具名**，见下分歧） |
| 新鲜度 | staleness banner 列出的文件回源 Read；不在 banner 的仍 trust | 采用 banner 信号,映射到 `provider-readiness` 的 `stale`；但**banner 外的「仍 trust」对 spec-first 仍是 advisory**（见纪律分歧） |
| 回源 | **"Trust results — don't re-verify with grep"** | **反过来：finding/root-cause/scope 必须回源确认**，candidate 带 `file:loc` → Read 确认才升 `confirmed`（轴 B，§5.2） |
| 验证 | 官方明文 "No live correctness validation — that's the compiler/test/linter's job" | **官方自己背书了回源缺口**：结构上下文 ≠ 正确性验证，spec-first 的回源纪律与官方此条一致,不冲突 |

> 与官方的**两处有意分歧**（spec-first 在官方实践上叠加的证据纪律）：
> 1. **不在 prose 写死工具名**。官方 playbook 直接点 `codegraph_context`/`codegraph_trace`；spec-first 的 workflow prose **只描述意图类别**（如「需要调用链/影响面时优先用 code-graph 能力」），具体哪个工具由装好的 MCP server 自己的 `initialize` instructions 指导 LLM 选——这样不把工具名焊进 spec-first source（守 §7 capability-class，防 GitNexus 复发）。MCP 注入的 playbook 在「会话内」生效,spec-first source 里不固化,二者不矛盾。
> 2. **回源纪律压过「别 grep 复核」**。官方为省 token 让 agent 信结果别复核；spec-first 对 finding/root-cause/scope 这类**结论性**消费坚持回源——但探索性导航（找相关符号、缩小读取范围）可直接用 codegraph 不必复核,与官方一致。**区分点：探索可信工具、结论必回源。** 且这条恰好有官方 "No live correctness validation" 背书。

### 4.2 Graphify：setup 帮装 CLI，并执行首次生成

- **形态**：episodic 一次性生成静态图谱（`gh` 实测 59.5k★ / MIT / Python；包名 `graphifyy`、bin 名 `graphify`；核源码产出 `GRAPH_REPORT.md` + `graph.json` + `graph.html`，自带 post-commit/post-checkout hook 增量重建代码 AST、不调 LLM）。在 spec-first 的消费模型里，它是 provider-owned project graph，可作为 advisory navigation；是否提交 `graphify-out/` 由团队决定。
- **安装协同**：`spec-runtime-setup` 可帮装 Graphify CLI（pinned `graphifyy==0.8.36`，过 gate；`0.8.36` 已用 `pip index versions graphifyy` 实测为 PyPI 当前发布版本，默认不装 latest），并安装当前 host 的 project-scoped assistant skill（如 `graphify install --project --platform codex`）。首次生成先使用脚本化 provider-native CLI `graphify extract .`，输出项目根 `graphify-out/`；若 mixed docs/images 仓库在无语义 API key 时 full-pipeline extract 失败，默认项目根 scope 下 fallback 到 AST-only `graphify update .`，只要产出 `graphify-out/graph.json` 或 `GRAPH_REPORT.md` 即继续 hook 和 query probe。安装后的用户 UX 是 `$graphify .` / `/graphify .`。确认后的 provider pack 目标还包括项目级 `graphify hook install`，让后续代码 AST 增量刷新由 provider hook 触发；docs/images/papers 仍需 `$graphify --update` 或等价用户动作。spec-first 不在下游 workflow 运行期代生成、不启动 `graphify watch` 长运行进程、不代管 hook 内部刷新。
- **安装落点**：CLI 是用户 tool 环境（优先 `uv tool install graphifyy==0.8.36`，fallback `pipx`）；project skill/runtime 由 Graphify 写入当前仓库（如 `.codex/skills/graphify/`、`.codex/hooks.json`、`AGENTS.md` 或 `.claude/skills/graphify/`、`CLAUDE.md`）；产物是项目根 `graphify-out/`；git hook 是项目级 `.git/hooks/`。MCP server 是**可选 extra**（`graphifyy[mcp]`），默认不装。
- **唯一纪律**：静态快照天然 stale，是 **advisory 架构参照，以源码为准**，禁止当 confirmed evidence。

#### 4.2.1 agent 高效读取协议（tool-interface-first + spec-first 纪律）

Graphify 官方（`graphify/skill.md` L817-828 + Context7 `/safishamsi/graphify`）对 agent 读取的最佳实践是**分层、有界、带源行号**。spec-first 在此基础上补一条更强边界：**workflow 优先调用 Graphify MCP/CLI 工具接口获取结果**；`GRAPH_REPORT.md` / `graph.json` 是 provider-owned backing store 或 fallback summary，不是 workflow 的主要直接输入。它复用既有 `artifact-summary.v1` 的 summary-first handoff，**不为 Graphify 造专属 reader**（造专属 reader 正是 GitNexus 死因之一）：

| 层 | 官方做法 | spec-first 动作 |
| --- | --- | --- |
| 概览 | 只取 `GRAPH_REPORT.md` 的 **God Nodes / Surprising Connections / Suggested Questions** 三段，**不读全文**（官方明文 "Do NOT paste the full report"） | 若 Graphify MCP/CLI summary/query surface 可用，先通过接口取概览；只有无工具接口但已有 project-root `GRAPH_REPORT.md` 时，才有界读取这三段作 fallback |
| 定向 | 跨模块问答 prefer `graphify query "..." --budget N`（默认 2000）/ `path "A" "B"` / `explain "X"`，**别 grep** | 先调用 provider-native MCP/CLI query/path/explain 获取候选；随后对结论性 finding/scope 用 `rg`/ast-grep/Read 回源。缺失或 stale 时不运行生成，直接 fallback |
| 全图 | `graph.json` 由 query 脚本加载，做 **start-node 锚定 + BFS≤3/DFS≤6 深度限制 + token budget 截断** 后只输出有界子图 | **绝不 `cat graph.json` 全量**；只能经 MCP/CLI query 有界拿子图，或者完全 fallback 到源码读取 |
| 回源 | query 每个 NODE 输出带 `src=源文件 loc=行号`、每条 EDGE 带 `[relation][confidence]` | candidate 带 path → Read 该 `file:loc` 确认才进 finding/scope（轴 B `evidence_candidate`→`confirmed`，见 §5.2） |

一句话 agent 读取协议（写进 §8 workflow prose）：

```text
概览: 优先调用 Graphify MCP/CLI summary/query surface; 无接口但有 project-root GRAPH_REPORT.md 时,
       才有界读取 God Nodes/Surprising Connections/Suggested Questions 三段(不读全文)
定向: 具体"A连B/谁调谁" → 调用 provider-native query/path/explain 获取候选;
       缺失/stale 时 fallback 到 ast-grep/rg/source read,不运行生成
有界: 绝不 cat graph.json 全量; 只能经 MCP/CLI query 取 start-node+深度+budget 有界子图
回源: query/report 输出带 src=file:loc → Read 该位置确认才升 confirmed (advisory 回源)
```

> 与官方的一处**有意分歧**：官方建议「跨模块 prefer query over grep」；spec-first 接受 query 作为探索入口，但把它限制在 advisory candidate 层。结论性 finding/scope 仍必须回源；缺失/stale 时不在 workflow 内运行 `graphify .` 补产物，而是 fallback。

### 4.3 GBrain：删除（降为决策记录）

GBrain（`gh` 实测 21k★ / MIT / TypeScript，PGLite/pgvector + BM25 + RRF + reranker 的完整知识平台）**不集成**，理由是三者里最强的，而且不是工具质量问题：

- **能力重叠**：memory 类能力与 spec-first 自有的 `docs/solutions/` file-first knowledge **直接重叠**。`docs/solutions/` 在关键维度上更优——可审计、零运维、**写入摩擦本身防污染**（GBrain 的自动 ingest 反而易把噪声沉淀成「记忆」）。
- **成本最重**：完整 opinionated 平台 + 可选 Postgres + OAuth + 生态耦合，外部运维与供应链面是三者最大；规模上 spec-first（<500 条结构化 markdown）远未到 embedding 召回相对 grep 有 ROI 的门槛。
- **capability-class 已覆盖**：§2 的 memory 类引导本就 provider-neutral——研发人员若自管 GBrain，其带 citation 的召回照样能作 advisory candidate 被消费。**不需要把 GBrain 写成具名待集成 provider**（写了反而违反 §2「不写死工具名」）。

**决策记录（替代原 provider 内容）**：memory 类能力默认走 `docs/solutions/`。正确的精力投入是强化 `docs/solutions/` 的结构化字段（`domain` / `pattern` / `rejected_alternatives` / `applicable_versions` / `invalidation_condition`）+ grep 索引——这是 v1.15 Knowledge Harness 的工作，模型再强也替代不了。只有出现**实测的 recall 缺口**（grep `docs/solutions/` 真的找不到该找到的历史决策）才重新评估外部 memory 工具，且届时仍作研发人员自管能力、不作 spec-first 自有节点。

---

## 5. 边界纪律（capability-aware 下依然要守的不变量）

无论叫「集成」还是「协同」，下列纪律对所有外部能力一视同仁——它们是「install 可帮、消费不耦合」边界的具体化，也是 §6 真实风险（尤其 CodeGraph 的「别回源」注入）的正面回应：

1. **install / onboarding / first generation / auto-refresh setup 走 Runtime Setup + gate，消费不拥有运行期生命周期**：安装、配置、provider setup bootstrap / first generation、Graphify project hook onboarding 在 `spec-runtime-setup` 显式 mode 下过 gate 执行；但 downstream workflow 运行期不代安装、不代生成、不代刷新、不重建并行 drift 检测（刷新归工具自带 file-watcher / hook / provider-native 机制）。workflow 只在 provider-native MCP/CLI 工具接口已可用时调用它获取 advisory candidates。
2. **输出一律 advisory，回源确认**：任何外部能力（含自称可信的 CodeGraph）的输出都止于 candidate；`confirmed_context` 只能由 source/test/log/contract/user evidence 达成。
3. **自适应 fallback，never-block**：项目特征（大仓/小仓）决定用不用，不是二元开关；缺失即走 `rg`/ast-grep/`docs/solutions`/direct read，主链路从不阻塞。fallback 是等价路径，不是降级。
4. **消费侧 capability-class 抽象**：prose 只认能力类别，不写死工具名或工具内部命令；消费经 provider-native MCP/CLI 工具接口，不经 instruction block 注入。

### 5.1 install→usable ladder（「装≠用」，复用已落地 `provider-readiness.v1`）

CodeGraph 与 `gh` 不同：`gh` 装完即用，CodeGraph **装了 ≠ 能用**（还要配 MCP + 建索引）。这一步用**已落地**的 `provider-readiness.v1` 的 8 个 lifecycle 布尔位表达，**不新增第 7 态、不新建 schema**。注意**各 rung 落在不同级别**（见 §4.1.1）：

| rung | lifecycle 布尔位 | 级别 | readiness_status | 谁执行 |
| --- | --- | --- | --- | --- |
| install | `installed=true` | **用户级**（global CLI） | `not-run`→… | spec-first setup（过 gate，代调 `lifecycle_commands.install`） |
| configure | `configured=true` | **项目级**（默认；可选用户级 host config） | … | spec-first setup（写 host MCP config，走既有投影 + `clean` 回滚） |
| 首次 index | `indexed=true` | **项目级**（`.codegraph/`） | `degraded`→… | spec-first setup（一次性代调 `codegraph init`） |
| serve | `server_reachable=true` | （随 config 级别） | … | host 自拉起（spec-first 不主动拉 server） |
| probe | `query_verified=true` | 项目级 | `fresh` | spec-first verify（只读 bounded probe） |
| 持续 refresh | （工具自管） | 项目级 | 工具报 `stale` | 工具 file-watcher（spec-first 不代刷） |

「spec-first setup 执行」指 **setup 在 explicit install mode 下代调 registry 里的工具命令**（工具自己建索引），不是 spec-first 自造 generation 逻辑。**跨级别含义**：第二个项目 setup 时 detect 会发现 `installed=true`（用户级 CLI 已在），只需补 configure + index（项目级）——install-helpers 必须能识别「CLI 已全局装、当前项目未配/未建索引」这一跨级别状态，逐 rung 续跑。

### 5.2 两轴模型（机械 readiness vs 语义 trust，不可混为一谈）

外部能力的「机械可用性」与「证据语义信任」是两件正交的事，必须拆开，否则会制造第二套 evidence enum（违反 `ai-coding-harness.md` 边界规则）。本模型与父方案 §5.4 一致，**capability-aware 下依然适用**（它正是「外部输出 advisory、回源才 confirmed」的形式化）：

**轴 A — Provider Readiness（机械，复用现有 5 值 enum，不新增词表）**

复用 `spec-work-run-artifact.schema.json` 中 `provider_untrusted.readiness_status` 的现有枚举：

```text
"readiness_status": "fresh|stale|degraded|not-run|unknown"
```

| 值 | 含义 | 可用动作 |
| --- | --- | --- |
| `not-run` | 工具未安装/未配置/不可达（研发人员未自管该能力） | fallback 到 `rg` / source-read |
| `degraded` | 可用但部分能力缺失或降级 | 限定用途，标 limitation |
| `stale` | 可用但 index/graph 与当前 repo 不对齐 | 提示以源码为准；结果只能 advisory |
| `fresh` | 与当前 repo 对齐 | 可作为 advisory evidence candidate 来源 |
| `unknown` | 无法判定 | 按 not-run 保守处理 |

**轴 B — Evidence Trust（语义晋升，workflow 判断，不入 readiness 字段）**

轴 B 是 LLM/workflow 的语义晋升维度，体现在证据如何被消费与晋升，**不写进 readiness 字段**：

| 信任档 | 含义 |
| --- | --- |
| `advisory` | 探索方向、上下文候选、历史线索 |
| `evidence_candidate` | 有 path/symbol/citation，可触发 direct source read |

轴 B 的语义晋升只能发生在 **workflow 语义晋升判断**中，由 source/test/log/contract/user evidence 确认；外部能力的输出只写机械 readiness 和候选证据要求。`readiness_status=fresh` 本身**永不等于** confirmed——轴 B **不得回填进 readiness 字段**。这条与父方案 contract test 锁定的「readiness 字段只接受现有 5 值 enum」「provider readiness=`fresh` 不得单独产生 confirmed」完全一致。

---

## 6. 真实证据（`gh` + 本地源码 clone + `curl` 实测，2026-06-05）

本方案的处置不是凭印象，而是用真实通道核实三个工具的关键声称（非工具 README 自述）：

| 声称 | 核实结果 | 通道 / 强度 |
| --- | --- | --- |
| 三工具是冷门/偏门 | **不成立**：CodeGraph 41.5k★、Graphify 59.5k★、GBrain 21k★，全 MIT、近 30 天均 100+ commits | `gh api` / 强 |
| single-maintainer 停更风险 | **部分证伪**：当前高度活跃；但 codegraph/gbrain 近期提交几乎全是仓主一人，**bus-factor 坐实** | `gh api` / 强 |
| CodeGraph 自报 benchmark（省 token） | **self-reported，且其原文反证小仓负收益**：A/B matrix 自承「tiny repos 上 with-arm 反而更慢、成本 marginally higher」，省读优势只在 medium/large repos thrashing 时出现 | 本地 `docs/benchmarks/codegraph-ab-matrix.md` / 强 |
| tree-sitter syntax-inference 精度天花板 | **真实 zero-recall 漏报**：issue 区实证 `codegraph_callers` 漏 Python module-attribute 调用、漏匿名/lambda 调用边、PHP include 不入图 | `gh issue` / 强 |
| CodeGraph「别用 grep 复核」的设计姿态 | **源码坐实且更细**：`server-instructions.ts` 明文 `"Trust codegraph's results — don't re-verify them with grep"`,但**同文件又写** `"No live correctness validation — that's the compiler/test/linter's job"`——官方自承给的是结构上下文非正确性验证,正好为 spec-first「结论性消费回源」纪律背书(探索可信、结论必验) | 本地源码 / 强 |
| 商业化 pivot（"platform is coming"） | **公开层未证实**：README / homepage 检索不到 platform/pricing 信号；npm latest 已复核到 `0.9.9`（仍未到 1.0，API 不稳定信号） | `curl` / 中 |

**综合**：三工具不冷门，但「漏报 + 别复核」的组合恰好放大 review 漏判，而 review 漏判正是 spec-first 最在乎的。这反而强化 §5 纪律——**外部能力输出一律 advisory、回源确认**，CodeGraph 的「信我别复核」在 spec-first 这里不享受特权。

### 6.1 大模型趋势参照（基于知识推断，非实时检索，标注）

业界主线是 agentic grep + 长上下文正在赢过预建索引（主流 agent 集体从 embedding/graph 索引退回 agentic search）；code-graph 真正幸存的场景是大 monorepo + 精确重构，**全部需要规模**。模型越强，「小仓 agentic grep 就够」的上界越高，code-graph 正收益区间被持续挤压。这进一步支持本方案：**不把 code-graph 做成 spec-first 内置依赖，而是留作研发人员按项目规模自取的外部能力**；spec-first 自己的护城河是验证闭环（v1.13 已落地）与知识沉淀（v1.15），那是模型替代不了的工程治理层。

---

## 7. 与 GitNexus 的区别：capability-class，不是 provider-specific

这是整个方案的承重墙，也是 GitNexus 死因的精确解药：

| 维度 | GitNexus（已硬删除） | 本方案 |
| --- | --- | --- |
| 消费抽象层级 | provider-specific：消费侧到处写死 `gitnexus` 名字与内部 schema | capability-class：消费只认 code-graph / project-graph 类别，经 provider-native MCP/CLI 工具接口 |
| 安装 | spec-first setup 注册 + 帮装 | spec-first setup 帮装（过 gate + 用户同意）——**这一项两者相同，install 从不是死因** |
| 刷新 | spec-first bootstrap 代刷新 | 工具自带 file-watcher 自管，spec-first 不代刷 |
| workflow 消费耦合 | routing/reminder/instruction block/review-pre-facts 全依赖它 | prose 只有 capability-class 引导，消费经 provider-native MCP/CLI 工具接口，不注入编排面 |
| 公开入口 | `spec-graph-bootstrap` public workflow | 无；不新增任何 provider public workflow |
| 可选性 | 非可选，深度耦合 | 工具缺失即 fallback，主链路从不感知 |

**关键澄清**：GitNexus 与本方案在「setup 帮装」这一项**相同**——install 从来不是 GitNexus 死因。真正的差异在**消费侧**：GitNexus 把工具焊进 routing/reminder/instruction block/review-pre-facts，本方案消费只认能力类别、经 provider-native MCP/CLI 工具接口。

**复发早期信号（出现任一即应纠偏）**：
1. 消费侧 prose 出现具体工具名或工具内部命令（如 `codegraph_callers`）——退回 provider-specific。
2. 在 plan/work/review 运行期主动弹安装、或把工具状态注入 startup reminder/instruction block——install 越出 setup 显式 mode，长成 reminder 耦合。
3. spec-first 开始代刷新、silent 装 file-watcher hook、或重建并行 drift 检测——越界拥有运行期生命周期。
4. review-pre-facts 类 helper 从「可选利用外部产出」变成「无该产出即 warn/降级」——advisory 正在变 confirmed，这正是 GitNexus 第四个死因面。

---

## 8. 落地与反模式

### 8.1 落地最小事（中型任务——install 侧有真实代码增量）

```text
安装侧:
1. 填 mcp-tools.json 的 CodeGraph opt-in MCP entry + provider-tools.json 的 Graphify CLI entry → 验证: schema 校验通过; safety/risk_flags 可见
2. 扩 install-mcp.{sh,ps1} 的 optional opt-in 准入 + install-helpers.{sh,ps1} 的 Graphify 受控安装分支 → 验证: 双宿主 parity; 过 install gate; 执行走脚本受控 case 而非 registry eval
3. setup 用 provider-readiness.v1 lifecycle 布尔位表达装≠用 ladder → 验证: installed/configured/indexed/query_verified 各 rung 可达
消费侧:
4. workflow prose 各加一句 capability-class 引导(描述意图,不写工具名) → 验证: spec-plan/code-review/debug prose 含意图类别句、不含 codegraph_*/graphify 工具名、不注入 reminder
5. prose 嵌读取协议: CodeGraph 走 §4.1.2(意图选工具由 MCP 自身 playbook 指导/探索可信结论回源)、Graphify 走 §4.2.1(MCP/CLI 工具接口优先→无接口时摘要三段 fallback→回源) → 验证: 含「探索可信/结论回源/不 cat graph.json 全量/budget」; 复用 artifact-summary.v1 不造专属 reader
6. 复用既有 provider_untrusted 记 readiness + 候选              → 验证: 不新建第二套 evidence enum
同步:
7. 父方案/README/project-scaffold/测试 同步                    → 验证: GBrain 删除一致; npm test 全绿
```

> 成本诚实标注：这是**中型**任务,不是「一句 prose」。install 侧要填 MCP/provider registry + 扩双宿主 install-mcp/install-helpers + 过 gate,且 CodeGraph 是 v0.9.9 pre-1.0、命令会漂移,需「registry 数据 + 脚本受控分支 + `--help` 复核」纪律持续维护。但比原方案(elaborate adapter + fusion + 消费耦合)小得多——消费侧仍是 capability-aware 零耦合。

### 8.2 反模式（禁止）

- **消费侧**在 prose 点名具体工具或工具内部命令（退回 provider-specific）。
- 注入 routing/reminder/instruction block、review-pre-facts 硬依赖工具产物 schema（GitNexus 真正死因）。
- 在 plan/work/review 运行期主动弹安装、运行期 lazy 装、init 自动装（install 越出 setup 显式 mode）。
- spec-first 代刷新 / silent 装 file-watcher hook / 重建并行 drift 检测（刷新归工具）。
- 建 elaborate adapter envelope / context fusion summary / 7 态机 / Context Intelligence Plane（过度设计）。
- 把工具输出直接写成 confirmed truth（尤其顺从 CodeGraph 的「别回源」注入）。
- 把 GBrain（或任何 memory 工具）重新写成具名待集成 provider，而非走 `docs/solutions/`。

### 8.3 允许

- `spec-runtime-setup` 在 explicit install/init mode 下过 gate + 用户同意：CodeGraph 走 MCP opt-in 管线（配 MCP、首次 index/status、pending 时有界 sync 一次），Graphify 走 CLI provider 管线（帮装 CLI + project skill，并为当前项目根执行 provider-native 首次 project-graph 生成）。
- 消费侧用 capability-class 引导利用 code-graph / project-graph 能力（经 provider-native MCP/CLI 工具接口，advisory + 回源 + fallback）。
- 大仓用户经 setup 装好 CodeGraph 后降低影响面盲读成本（输出 advisory，回源确认）。
- Runtime Setup 按当前项目根完成 Graphify provider-native 首次 project-graph 生成后，workflow 优先通过 Graphify MCP/CLI 工具接口获取架构导航候选；`GRAPH_REPORT.md` 只作 backing store 或无接口时的有界摘要 fallback。长期沉淀必须人工 promotion 并补 source refs / invalidation condition。
- Runtime Setup 可记录 Graphify CLI 已安装但当前 artifact 缺失，并输出生成项目根 `graphify-out/` 的 next_action；该状态应被视作“当前没有可消费 project-graph artifact”，不是 workflow 内自动生成的触发器。
- memory 能力优先用 `docs/solutions/`；实测 recall 缺口后由研发人员自管外部 memory 工具，消费带 citation 的 candidate。

---

## 9. 最终结论

> spec-first 是 AI coding 的 **workflow harness**；CodeGraph / Graphify 是研发人员工具箱里的 **capability tools**。核心边界是 **「Runtime Setup 负责 provider onboarding，provider 自己负责运行与刷新，workflow 通过 provider-native MCP/CLI 工具接口获取 advisory candidates」**——`spec-runtime-setup` 在 explicit mode 下过 gate + 用户同意帮装（与帮装 gh/jq 同构），但消费侧保持 capability-aware（只认能力类别、经工具接口、artifact 仅作 backing store / bounded fallback、advisory 回源、never-block）。
>
> 落点：**CodeGraph = setup 帮装的 code-graph MCP（大仓增强，小仓默认 rg）；Graphify = setup 帮装 CLI + project skill 并执行 provider-native 首次生成，默认产物为项目根 `graphify-out/`，后续代码刷新由 provider hook 负责；GBrain = 删除，memory 走 docs/solutions/。** install 从来不是 GitNexus 死因——把 install/first generation（走成熟 setup+gate）与 consumption（capability-aware 不耦合）拆开，既兑现「帮用户装好、用户选择是否同意」，又从结构上不重蹈 GitNexus 的消费耦合死法。
