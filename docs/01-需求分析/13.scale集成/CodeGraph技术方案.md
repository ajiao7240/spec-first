# spec-first 集成 GBrain / Graphify / CodeGraph 技术方案

> 本文是 `spec-first内化集成scale-project-scaffold技术方案.md` 的专项子方案。
> 父方案负责定义总边界、优先级和实施节奏；本文只展开 GBrain / Graphify / CodeGraph 三个 optional provider 的安装、启动、刷新、workflow 使用和验收口径。

---

## 0. 校准结论

三者可以集成，但不能作为独立的 `Context Intelligence Plane` 覆盖当前 `spec-first` Harness。

校准后的定位是：

```text
CodeGraph = Code evidence candidate provider
Graphify  = Project semantic graph artifact provider
GBrain    = Optional institutional memory provider
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
| Doctor | `src/cli/commands/doctor.js` | 当前 `decision_input_health` 仍是 `not_checked`；provider readiness 需要先扩展 contract |
| Run artifact | `docs/contracts/workflows/spec-work-run-artifact.schema.json`、`src/cli/helpers/spec-work-run-artifact.js` | 已有 `provider_untrusted`、`direct_evidence_used`、`script_confirmed`，不先造平行 evidence truth |
| SCALE Code Intelligence | `/Users/kuang/xiaobu/scale-engine/src/codegraph/CodeIntelligence.ts` | 可借鉴 provider + fallback；不要复制 `.scale` truth |
| SCALE Memory | `/Users/kuang/xiaobu/scale-engine/src/memory/MemoryProviders.ts` | GBrain external write 默认 disabled，recall 是 evidence candidate |
| SCALE Bootstrap | `/Users/kuang/xiaobu/scale-engine/src/bootstrap/DependencyBootstrap.ts` | GBrain / Graphify / CodeGraph 属于 pack/profile item，安装需要 explicit apply |
| project-scaffold | `/Users/kuang/xiaobu/project-scaffold/.scale/code-intelligence.json` | CodeGraph/Graphify 是 enabled provider + fallback 样板，不是 spec-first 默认强路径 |

> 入口命名约定（全文适用）：required harness runtime setup workflow 的 canonical 入口名是 `spec-runtime-setup` / `/spec:runtime-setup`，`spec-mcp-setup` 为迁移期 deprecated alias（以父方案 §0.4.2 为准）。本文下文出现的 `spec-mcp-setup` 一律指代该 workflow，等同 `spec-runtime-setup`；`skills/spec-mcp-setup/**` 等 source 实体路径在后续 source 重命名 work 任务落地前保持现状。

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

## 4.1 Profile

| Profile | 默认状态 | Provider 策略 | 适用场景 |
| --- | --- | --- | --- |
| `minimal` | 默认 | 不安装 GBrain / Graphify / CodeGraph；只检测已声明 provider；缺失不阻塞 | 个人轻量使用、普通 workflow |
| `recommended` | 显式选择 | 生成三者 install plan；CodeGraph 可受控 refresh；Graphify/GBrain 只提示 refresh/import | 正式项目，需要更强 context |
| `platform` | 显式选择 | provider pack 纳入团队标准能力；refresh/import 仍需 provenance 和 policy | 团队/部门级治理 |

## 4.2 安装和启动

| Provider | 安装依赖 | 初始化/启动 | spec-first 近期口径 |
| --- | --- | --- | --- |
| CodeGraph | Node/npm；安装命令以 provider registry snapshot 为准 | `codegraph init -i <repo>` 建索引；需要 MCP 时 `codegraph serve --mcp` | optional provider；setup 只写 readiness/freshness/fallback |
| Graphify | Python 3.10+ 和 `uv`/`pipx`/`pip` 等安装器；具体包名落地前以官方 README/`graphify --help` 复核 | `graphify install --platform <host>`、`graphify update <repo> --no-cluster` 或等价命令 | artifact provider；默认不 silent refresh |
| GBrain | Bun；安装命令以 provider registry snapshot 为准 | `gbrain init --pglite --no-embedding`、`gbrain serve`、`gbrain search/think` | optional memory provider；external write disabled |

外部工具命令不是 `spec-first` 当前 contract。落地到 setup 脚本前必须通过 provider registry fixture 和 `--help` / status command 复核，避免把过期 README 命令固化进 source。

## 4.3 启动和刷新边界

| 动作 | 含义 | owner | 默认自动 |
| --- | --- | --- | --- |
| Host 自动拉起 server | Claude/Codex 根据 MCP config 启动 provider server | host runtime projection | 可以配置，但只代表 callable |
| Readiness/freshness 检测 | 检查 installed/configured/reachable/fresh/repo aligned | `spec-runtime-setup`（alias `spec-mcp-setup`）/ setup helper | 应自动检测 |
| 刷新索引/图谱 | 更新 `.codegraph/`、`graphify-out/` 或 provider index | provider setup / explicit refresh | 不在 minimal 默认执行 |
| 写长期记忆 | 导入 verified learning / RCA / reviewed decision | `spec-compound` / promotion flow | 不能默认自动 |

启动不等于刷新，刷新不等于可信。

## 4.4 自动刷新矩阵

| Provider | 自动检测 freshness | Host 自动拉起 | 默认自动刷新 | 允许自动刷新的 profile | 边界 |
| --- | --- | --- | --- | --- | --- |
| CodeGraph | 是 | 可配置 | `minimal` 否；`recommended` 可提示或受控执行 | `recommended` / `platform` | 记录 commit/hash/changed files；stale 不升 confirmed |
| Graphify | 是 | 可配置 | 否 | `platform` 或 explicit refresh | 不 silent write `graphify-out/`；输出带 source paths |
| GBrain | 是 | 可配置 | 否 | explicit promote/import only | 不自动写长期记忆；只导入 verified learning |

---

## 5. Contract / Schema 收敛

## 5.1 近期只新增一个核心合同

> `provider-readiness.v1` 的 canonical 字段定义归父方案 §7.1，落盘目标是 `docs/contracts/provider-readiness.md` / `.schema.json`。本文只在 Phase E / v1.16 展开 CodeGraph / Graphify / GBrain 的 provider-specific examples、adapter 输出和 workflow 消费，不作为 v1.11/v1.12 通用 readiness 槽位、schema 或 doctor projection 的实施依据。

父方案 Phase A / project-scaffold 子方案应先建立：

```text
docs/contracts/provider-readiness.md
```

用途：

- 统一表达 CodeGraph / Graphify / GBrain 的 lifecycle 布尔位、readiness freshness、repo alignment 与 fallback。
- 供 `spec-runtime-setup`（alias `spec-mcp-setup`）、`doctor`、workflow skills 读取。
- 不表达 workflow 结论，不表达 finding/root-cause，不表达 final scope。

Provider-specific 示例（字段以父方案 §7.1 canonical 为准）：

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
- `lifecycle.*`（生命周期布尔位）：各自独立布尔，**不塞进 `readiness_status` enum**。字段集合以父方案 §7.1 为准；本文示例只展示 provider-specific consumption——
  - `installed`：命令存在或 package 可运行。
  - `configured`：host / project 配置指向 provider。
  - `initialized`：provider 项目初始化完成（如 `codegraph init`）。
  - `indexed`：provider 索引 / artifact 存在。
  - `server_reachable`：MCP / server 形态 provider 可达（非 server 形态填 `false` 或视为 not-applicable）。
  - `artifact_exists`：artifact 形态 provider 的产物存在（如 `graphify-out/`）。
  - `query_verified`：至少一次 bounded query 成功。
  - `fallback_used`：使用 source-scan / rg / read 替代。
- 轴 B（Evidence Trust：`advisory` / `evidence_candidate` / `confirmed_context` / ...）是 workflow 语义晋升判断，**不得写入本 schema 任何字段**（见父方案 §5.4、§3.2）。`readiness_status=fresh` 永不等于 `confirmed_context`。

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

## 8. 分阶段落地路线

本文不改写父方案版本路线；只在父方案 Phase E 下拆 provider 专项。

## Stage 0：Provider-specific Readiness Foundation

> 相位归属（以父方案 §8.1 为准）：本文 Stage 0 只属于父方案 **Phase E / v1.16 Optional Provider Pack**。`provider-readiness.v1` schema / docs / fixture、通用 registry shape、missing/stale/degraded/fallback projection 与 doctor 消费展示是 Phase A（v1.11 producer / v1.12 consumer）的前置输入，由父方案 + project-scaffold 子方案承担；本文不把这些通用槽位列为 CodeGraph 子方案交付。

前置条件（已由父方案 Phase A / v1.11-v1.12 线提供）：

- 父方案 Phase A readiness baseline 已建立。
- `provider-readiness.v1` 有父方案 §7.1 canonical shape、schema / docs / fixture。
- `spec-runtime-setup`（alias `spec-mcp-setup`）能输出 provider `not-run`/stale/degraded/fallback facts。

交付（父方案 Phase E / v1.16 具体 provider 部分）：

- 具体 provider registry entries（消费父方案 Phase A 的通用 registry/schema）。
- provider-specific install plan / explicit apply / post-check。
- provider-specific configured dependency entries（通用 host configured dependency report 属 v1.11/v1.12 setup/doctor 线）。
- no-provider fallback 行为。

## Stage 1：CodeGraph Candidate Integration

交付：

- CodeGraph detection / status / freshness。
- CodeGraph candidate adapter。
- `spec-plan` / `spec-code-review` / `spec-debug` 读取 candidate facts。
- stale / dirty / repo mismatch 降级规则。

不包含：

- 默认全仓刷新。
- provider result 直接进入 finding。
- `doctor` 将 CodeGraph 缺失报成 baseline failure。

## Stage 2：Graphify Artifact Integration

交付：

- Graphify artifact detection。
- `GRAPH_REPORT.md` / graph artifact summary-first intake。
- stale graph refresh plan。
- `spec-prd` / `spec-plan` / `spec-doc-review` 的 semantic candidate 消费。

不包含：

- minimal 默认生成 `graphify-out/`。
- 默认提交 graph artifact。
- silent hook install。

## Stage 3：GBrain Recall / Promotion Integration

交付：

- GBrain connectivity / recall readiness。
- historical decision / RCA / rejected scope candidate。
- `docs/solutions` -> GBrain import candidate。
- promotion gate。

不包含：

- 默认 external write。
- session transcript 自动导入。
- recall 直接作为当前事实。

## Stage 4：Context Fusion Summary（后置）

只有当 Stage 1-3 都有真实 workflow consumer 后，再考虑：

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

## 10.1 Contract Tests

- `provider-readiness.v1` schema valid / invalid。
- unknown provider kind rejected。
- stale provider requires reason / next action。
- consumer / fusion 层若标 `confirmed_context`，必须有 direct source refs 或 confirmation evidence；`provider-readiness.v1` 自身不承载该字段。
- generated runtime paths 不得进入 source refs。

## 10.2 Setup Tests

- verify-only 不安装 provider。
- install plan 输出命令但不执行。
- explicit apply 才允许安装 / 初始化 / refresh。
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

- 把 GBrain / Graphify / CodeGraph 写成 minimal 默认依赖。
- 把 provider result 直接写成 confirmed truth。
- 用 `Context Intelligence Plane` 替代 existing Harness contracts。
- 新增 `src/cli/context-intelligence/` 作为近期 P0/P1 实现。
- 新增 provider CLI 命令时不先建立 source contract 和测试。
- 在 ordinary workflow 中自动安装、自动刷新 Graphify、自动写 GBrain。
- 把远端 spec-first 分支或外部 README 当作当前本地 source-of-truth。

允许：

- 在 recommended/platform profile 中显式安装 provider。
- 用 CodeGraph 降低盲读成本。
- 用 Graphify 辅助 brownfield current-state。
- 用 GBrain 召回历史约束。
- 用 provider candidates 触发 source-read、test/log、review confirmation。
- 在 verified learning 后做 optional memory promotion。

---

## 12. 最终结论

GBrain / Graphify / CodeGraph 值得集成，但它们应作为父方案下的 `Optional Context Intelligence Providers`，而不是新的中心化上下文底座。

正确顺序是：

```text
先完成父方案 readiness / verification / governance / Knowledge Harness 基线，
再进入 v1.16 provider-specific readiness / freshness / fallback，
再让 workflow 消费 candidate facts，
再用 source-read / test / log / review 确认，
必要时才显式 promotion 到 durable knowledge 或 optional memory。
```

一句话方案：

> 以 `provider-readiness` 和 existing Harness contracts 管住 GBrain / Graphify / CodeGraph，把它们变成可降级、可追溯、可确认的上下文候选提供者，而不是替代 `spec-first` workflow judgment 的平台核心。
