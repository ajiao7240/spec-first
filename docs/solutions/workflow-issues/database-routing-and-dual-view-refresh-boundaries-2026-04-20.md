---
title: "在同一轮 contract 收口里，把静态候选、运行时路由和 dual-view refresh 分开表达"
date: "2026-04-20"
category: "workflow-issues"
module: "spec-first"
problem_type: "workflow_issue"
component: "tooling"
severity: "high"
applies_when:
  - "需要为 spec-graph-bootstrap 设计或调整静态发现事实与运行时路由事实的边界"
  - "需要决定 database worker 应消费哪个 artifact 作为 route / fallback / provenance 真源"
  - "需要让 docs/solutions 的双视角内容同时服务人类交接与 LLM 检索复用"
  - "需要刷新已有 compound learning，且只更新受影响 section 而非整篇重写"
symptoms:
  - "fact-inventory.database[] 同时承载静态候选发现与运行时路由语义，导致 contract 边界混合"
  - "database worker 与下游消费者需要从多个位置猜测 route、fallback 和 provenance"
  - "learnings-researcher 对双视角文档的复用优先级不稳定，refresh 缺少 section-aware 规则"
root_cause: "logic_error"
resolution_type: "workflow_improvement"
related_components:
  - "spec-graph-bootstrap"
  - "spec-compound"
  - "spec-compound-refresh"
  - "learnings-researcher"
tags: ["spec-graph-bootstrap", "database-routing", "fact-inventory", "llm-reuse-context", "spec-compound-refresh", "section-aware", "provenance", "contract-boundary"]
---

# 在同一轮 contract 收口里，把静态候选、运行时路由和 dual-view refresh 分开表达

## Context

这次改造要解决的不是一个孤立报错，而是一轮 contract 收口里两处边界都开始变得含混：数据库侧的静态候选发现和运行时选路混在了一起，compound 侧的 dual-view 检索顺序和 refresh 粒度也没有写实。

第一条线发生在 `spec-graph-bootstrap`。原先数据库链路容易把“仓库里有哪些数据库候选连接”和“当前运行时到底能走哪条 route、为什么 fallback、失败卡在哪一层”混在同一个事实层里。`fact-inventory.database[]` 适合承载静态候选发现，不适合继续背 secret 解析、probe 历史、route 决策和 blocker provenance。当前 runtime routing 的直接支持也仍以 MySQL 为主；其他数据库类型多数还停留在 discovery-only 或 `unsupported-db-type` 边界。

第二条线发生在 `spec-compound` / `spec-compound-refresh`。仓库已经有 `Human Summary` 和 `LLM Reuse Context` 的双视角结构，但它们之前更像模板章节，不是真正的消费 contract。`learnings-researcher` 在命中并完整读取相关 learning 后，还没有把 `LLM Reuse Context` 稳定地作为优先复用面；refresh 也缺少“哪类 drift 应该改哪个 section”的明确规则。

这篇 learning 记录的主问题不是“bootstrap 和 compound 是同一个模块”，而是它们在同一轮改造里暴露出同一种边界问题：下游消费者需要从多个位置猜测真实语义。数据库侧需要猜 route 和 fallback；compound 侧需要猜哪个 section 更适合复用、哪些 drift 该局部更新。

## Guidance

### 1. 静态发现事实、候选快照和运行时路由事实要分清主次

对数据库链路，扫描阶段只回答这些问题：

- 仓库里发现了哪些候选连接
- 证据来自哪些配置文件或环境变量引用
- 推断的 `db_type`、`confidence`、`static_access_hints` 是什么

运行时阶段再回答这些问题：

- 当前环境里哪些 credential key 真正解析到了
- MCP / CLI 各自的 probe 状态是什么
- 最终选中了哪条 route
- 为什么 fallback
- 没有 route 时卡在哪一层

这次收口后的边界是：

- `fact-inventory.database[]`：静态候选连接事实
- `database-routing.json`：route / fallback / provenance 的运行时真源，同时携带一份按连接展开的候选快照，避免消费者回读 `fact-inventory` 才能解释 route 决策
- `database-worker.md`：worker 如何消费 routing artifact 的执行规范

这样做以后，静态事实层保持轻量、稳定、可复用；runtime 失败也能被解释，而不是继续污染静态事实。

### 2. 双视角必须有明确分工

`Human Summary` 和 `LLM Reuse Context` 应继续共存在同一个 durable file，但两者必须服务不同消费面：

- `Human Summary`：给人类快速交接 outcome、关键决策、验证结果和剩余风险
- `LLM Reuse Context`：给 agent 提供高密度的 constraints、code touchpoints、patterns、anti-patterns 和 provenance

真正的收口不在于多了两个标题，而在于：当 dual-view 同时存在、且相关 learning 已经被命中并完整读取后，`learnings-researcher` 会优先看 `LLM Reuse Context`；`Human Summary` 主要用于人工交接。只有这样，双视角才不是装饰，而是明确的复用顺序。

### 3. refresh 应该按 drift 类型更新最小 section

不是所有漂移都值得整篇重写。更稳的规则是：

- 路径 / 模块漂移：优先改 `Code Touchpoints`
- 证据 / 引用漂移：优先改 `Provenance`
- 复用建议漂移：优先改 `Patterns to Reuse` / `Anti-patterns to Avoid`
- 结论变化：才改 `Human Summary`

缺少 dual-view section 的旧文档是 upgrade opportunity，不是 schema error。只有在已有足够证据时，才做机会式补齐；不要无证据脑补。

### 4. 新 contract 要用 source、mirror 和不同粒度的测试一起收口

只写 skill prose 不够。像 `database-routing.json` 这样的新 artifact，必须同时落到：

- schema
- manifest output
- sample generator
- compiler 输出
- unit tests
- integration / e2e coverage

同样，高风险 skill 和 agent 的关键锚点也要同时出现在 source 和 `docs/10-prompt` mirror，并由一致性测试守住。这样可以把“源码 contract”“prompt mirror”“runtime / compiler 行为验证”分开管理，而不是让它们互相替代。

## Why This Matters

如果把静态候选、runtime 选路、下游生成混在一起，失败时只能看到笼统结论，看不到到底是 secret 没解析到、MCP 不可用、CLI 缺失，还是根本不支持该数据库类型。把这些事实拆开后，下游消费者能直接读到 route、fallback 和 blocker，而不用自己拼装。

知识库这边也是同一个道理。没有明确的优先复用 section，`Human Summary` 和 `LLM Reuse Context` 只是形式上的双视角；没有 section-aware refresh，任何小漂移都可能被放大成整篇重写，既增加噪音，也更容易把 repo-factual details 写散。

这次收口的直接收益是：artifact 各自回答各自的问题，检索器和 refresh 规则也各自有了更明确的输入边界。这正符合仓库的工程原则：`轻 contract + 明确边界 + 让 LLM 决策`。

## When to Apply

- 当一个 artifact 同时想表达“静态发现事实”和“运行时决策事实”时
- 当 workflow 需要解释 fallback、blocker 或 provenance，而不是只给一个成功/失败结论时
- 当文档既要服务人类交接，又要服务 agent 检索复用时
- 当旧 learning 的 drift 只落在路径、证据或模式层，而不是整篇结论失效时
- 当 source skill、prompt mirror、schema / sample、contract tests 之间已经出现或可能出现语义漂移时
- 当数据库路由直接支持仍以 MySQL 为主，需要避免把当前 contract 误读成所有数据库类型都已落地时

## Examples

### 例 1：数据库路由分层

以前容易把数据库发现、secret 解析和 route 选择揉进同一个事实层。现在：

- [fact-inventory.schema.json](../../contracts/spec-graph-bootstrap/fact-inventory.schema.json) 里的 `database[]` 只保留静态候选字段
- [database-routing.schema.json](../../contracts/spec-graph-bootstrap/database-routing.schema.json) 承载 `candidate_connections`、`secret_resolution`、`probe_attempts`、`route_decisions`、`selected_connections`、`generation_blockers`

对应实现入口分别在：

- [derive-bootstrap-facts.js](../../../src/bootstrap-compiler/derive-bootstrap-facts.js)
- [compile-routing.js](../../../src/bootstrap-compiler/compile-routing.js)
- [run-bootstrap.js](../../../src/bootstrap-compiler/run-bootstrap.js)

### 例 2：LLM 复用面收口

以前双视角更像模板占位。现在：

- [skills/spec-compound/SKILL.md](../../../skills/spec-compound/SKILL.md) 明确 `LLM Reuse Context` 是优先复用 section
- [agents/research/learnings-researcher.md](../../../agents/research/learnings-researcher.md) 在命中并完整读取相关 learning 后优先消费它
- `Human Summary` 保持为最快的人类概览

### 例 3：refresh 从整篇重写转为 section-aware

以前轻微路径漂移容易演变成整篇文档重写。现在 [skills/spec-compound-refresh/SKILL.md](../../../skills/spec-compound-refresh/SKILL.md) 直接把 drift 类型映射到 section：

- 路径 / 模块漂移改 `Code Touchpoints`
- 证据漂移改 `Provenance`
- 复用建议漂移改 reusable patterns
- 结论变化才改 `Human Summary`

### 例 4：验证要钉在 contract 上

这次改造没有停在 prose，而是把关键结论固化到了测试：

- [tests/unit/spec-compound-contracts.test.js](../../../tests/unit/spec-compound-contracts.test.js)
- [tests/unit/spec-graph-bootstrap-contracts.test.js](../../../tests/unit/spec-graph-bootstrap-contracts.test.js)
- [tests/unit/spec-graph-bootstrap-compiler.test.js](../../../tests/unit/spec-graph-bootstrap-compiler.test.js)
- [tests/unit/asset-consistency.test.js](../../../tests/unit/asset-consistency.test.js)

## Human Summary

### Outcome

本次改造把 bootstrap 的数据库链路和 compound 的双视角知识链路都写实成更清晰的 contract。数据库侧新增了 `database-routing.json`，把候选快照与 route / fallback / provenance 放到同一个可解释的 routing artifact 里；compound 侧明确了 `LLM Reuse Context` 的优先复用顺序，并把 refresh 收口为 section-aware 更新。

### Key Decisions

- `fact-inventory.database[]` 只表达静态候选发现，不承载 secret 值、probe 历史或 fallback 历史
- `database-routing.json` 以 route / fallback / provenance 为主，同时携带按连接展开的候选快照，并允许逐连接记录成功、失败和 blocker
- `Human Summary` 与 `LLM Reuse Context` 必须共存于同一个 durable file，不能拆 sidecar
- `learnings-researcher` 在双视角存在时优先消费 `LLM Reuse Context`
- refresh 优先做局部 section 更新，而不是默认整篇重写
- source、mirror、schema / sample、contract tests 一起收口，避免治理链路断裂

### Validation / Result

仓库内已经把这次收口拆成不同粒度的验证守卫，而不是只停留在 prose。

- `spec-compound` contract test 主要提供文档合同守卫，确保双视角、template 和 agent 文案包含必要锚点
- `asset consistency` test 主要提供 source / mirror / agent 的关键锚点一致性守卫
- `spec-graph-bootstrap` contract 与 compiler tests 覆盖 `database-routing.json` 的 schema、sample、compiler 输出和 CLI fallback 语义
- `tests/e2e/spec-graph-bootstrap-mainline.sh` 覆盖 `database-routing.json` 在主链里的产物存在性，并由 `tests/integration/e2e.sh` 间接执行
- 本次改造已通过 `npm run test:unit`、`npm run test:smoke`、`npm run test:integration`

### Remaining Risks

- 当前 direct route 的硬化明显以 MySQL 为主，非 MySQL 仍主要停留在 discovery-only / unsupported-db-type 边界
- refresh 已经有 section-aware contract，但旧文档升级仍是“命中即升级、无证据不脑补”的渐进式策略，不是全库一次性补齐
- `LLM Reuse Context` 已经成为 primary reuse surface，但它的长期质量仍取决于后续新 learning 是否持续写入 repo-factual details，而不是退回泛化总结

## LLM Reuse Context
[Prefer repo-factual details. If a subsection is unknown, say so explicitly rather than guessing.]
### Constraints

- 继续遵守 `轻 contract + 明确边界 + 让 LLM 决策`，不要把 route、reuse、refresh 合并成一个强编排对象
- `fact-inventory.database[]` 只保留静态候选连接事实；runtime secret、probe、fallback、selected route 不回流到静态事实层
- secret 解析只能记录 key 名与状态，不能把密码、用户名、连接串明文落盘
- `Human Summary` 和 `LLM Reuse Context` 必须留在同一个 durable file；不要新增第二持久化副本
- 缺失 dual-view section 的旧文档是 upgrade opportunity，不是 schema error
- refresh 应优先局部修正事实漂移，不要把轻微 drift 升级为整篇重写

### Code Touchpoints

- [src/bootstrap-compiler/derive-bootstrap-facts.js](../../../src/bootstrap-compiler/derive-bootstrap-facts.js) — 从仓库文件系统推导数据库候选，按 connection name 聚合 credential keys，推断 `db_type`、`confidence`、`static_access_hints`
- [src/bootstrap-compiler/compile-routing.js](../../../src/bootstrap-compiler/compile-routing.js) — 基于 `factInventory.database` 和 runtime `env/tooling` 生成 `secret_resolution`、`probe_attempts`、`route_decisions`、`selected_connections`、`generation_blockers`
- [src/bootstrap-compiler/run-bootstrap.js](../../../src/bootstrap-compiler/run-bootstrap.js) — 把 `database-routing.json` 纳入默认 bootstrap 产物集合并写入 control plane
- [docs/contracts/spec-graph-bootstrap/fact-inventory.schema.json](../../contracts/spec-graph-bootstrap/fact-inventory.schema.json) — 约束 `database[]` 只包含静态候选字段
- [docs/contracts/spec-graph-bootstrap/database-routing.schema.json](../../contracts/spec-graph-bootstrap/database-routing.schema.json) — 约束候选快照与 runtime route / fallback / provenance 的结构
- [skills/spec-compound/SKILL.md](../../../skills/spec-compound/SKILL.md) — 固定 single durable file 和 dual-view durable contract
- [agents/research/learnings-researcher.md](../../../agents/research/learnings-researcher.md) — 在命中并完整读取相关 learning 后，把 `LLM Reuse Context` 作为优先复用 section
- [skills/spec-compound-refresh/SKILL.md](../../../skills/spec-compound-refresh/SKILL.md) — 固定 section-aware refresh 规则
- [docs/plans/2026-04-20-011-feat-database-doc-and-compound-dual-view-hardening-plan.md](../../plans/2026-04-20-011-feat-database-doc-and-compound-dual-view-hardening-plan.md) — 记录本轮三项收口点及边界约束

### Patterns to Reuse

- 先把“静态候选发现”和“runtime 决策事实”拆成两个 artifact，再让下游 worker 消费 runtime artifact
- 用 schema + manifest + sample generator + compiler test 一起收口新 artifact，而不是只补 README 或 skill prose
- 给同一份 durable doc 提供双视角，但明确一个是 handoff view，一个是 primary reuse surface
- refresh 时按 section drift 做最小必要更新，把事实维护和文案重写分开
- 用 source / mirror / tests 三点锚定高风险 skill 和 agent，减少治理漂移

### Anti-patterns to Avoid

- 把 secret 解析、probe 历史、fallback 历史塞回 `fact-inventory.database[]`
- 发生 `MCP -> CLI` 切换却不记录 `fallback_reason` 和 provenance，只给最终 route
- 为 `LLM Reuse Context` 再发明一个 sidecar machine file 或第二 durable 目录
- 把缺少 dual-view section 的旧文档当成 schema error，强制全量改写
- 把路径漂移、证据漂移这类局部 drift 处理成整篇重写
- 只改 source skill，不改 `docs/10-prompt` mirror 和 contract tests，导致治理链路分叉

### Provenance

- 设计意图与边界约束来自 [docs/plans/2026-04-20-011-feat-database-doc-and-compound-dual-view-hardening-plan.md](../../plans/2026-04-20-011-feat-database-doc-and-compound-dual-view-hardening-plan.md)
- 数据库静态候选发现实现来自 [src/bootstrap-compiler/derive-bootstrap-facts.js](../../../src/bootstrap-compiler/derive-bootstrap-facts.js)
- runtime routing / fallback / blocker 实现来自 [src/bootstrap-compiler/compile-routing.js](../../../src/bootstrap-compiler/compile-routing.js)
- control-plane 落盘与 manifest 纳管来自 [src/bootstrap-compiler/run-bootstrap.js](../../../src/bootstrap-compiler/run-bootstrap.js)
- dual-view durable contract 来自 [skills/spec-compound/SKILL.md](../../../skills/spec-compound/SKILL.md)
- retrieval primary reuse surface 来自 [agents/research/learnings-researcher.md](../../../agents/research/learnings-researcher.md)
- section-aware refresh contract 来自 [skills/spec-compound-refresh/SKILL.md](../../../skills/spec-compound-refresh/SKILL.md)
- 一致性与 contract 守卫来自 [tests/unit/spec-compound-contracts.test.js](../../../tests/unit/spec-compound-contracts.test.js), [tests/unit/spec-graph-bootstrap-contracts.test.js](../../../tests/unit/spec-graph-bootstrap-contracts.test.js), [tests/unit/spec-graph-bootstrap-compiler.test.js](../../../tests/unit/spec-graph-bootstrap-compiler.test.js), [tests/unit/asset-consistency.test.js](../../../tests/unit/asset-consistency.test.js)

## Related

- [修改生成产物而非源头模板](modify-source-not-artifacts-2026-04-13.md) — 同样强调 source-of-truth 与 runtime / generated artifact 分层，本次与其形成中等重叠，但问题面更聚焦 database routing 与 compound dual-view contract
- [spec-graph-bootstrap MySQL 预校验当前 contract：移除 @@hostname，DATABASE() 不匹配仅告警](../documentation-gaps/spec-graph-bootstrap-mysql-consistency-precheck-contract-2026-04-19.md) — 同属 `spec-graph-bootstrap` 数据库 contract 面；这次新增的 `database-routing.json` 让它的边界描述存在轻度 stale by omission，后续适合做一次窄 scope refresh
- GitHub issues：当前未找到 `sunrain520/spec-first` 仓库下与本次改造直接对应的 issue
