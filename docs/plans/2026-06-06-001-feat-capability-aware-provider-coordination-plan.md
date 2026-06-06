---
spec_id: 2026-06-06-001-capability-aware-provider-coordination
status: active
type: feat
slice: v1.16（父方案 Phase E / capability-aware 协同）
origin: docs/01-需求分析/13.scale集成/2026-06-06-SCALE集成方案优化评审报告.md
depth: deep
created: 2026-06-06
---

# feat: Capability-aware Provider 协同（v1.16）

## Summary

落地 SCALE 集成主线的 v1.16 切片：让 `spec-runtime-setup` 能在 explicit install mode 下过 gate + 用户同意帮装 code-graph（CodeGraph）/ project-graph（Graphify）能力工具，消费侧保持 **capability-aware 不耦合**（只认能力类别、经原生 MCP、advisory 回源、never-block）。

本计划把《2026-06-06-SCALE集成方案优化评审报告》的发现固化为可执行 Requirements：**先做评审报告的治理前置（docs-only,消除会导致 v1.16 schema 校验失败的术语漂移等）+ 裂缝 A（provider-readiness 轴 A 定位拍板），再做 v1.16 install 侧实现主体 + 消费侧 capability-class 引导**。核心边界一句话:**install 帮装、消费不耦合,不重蹈 GitNexus**。

兑现的可观察行为变化：`spec-runtime-setup` 帮装 provider（install 闭环,验收见 Completion Criteria）+ `spec-plan`/`spec-code-review`/`spec-debug` 的 capability-class 消费引导（U10 可观察）。其中消费侧的可观察行为变化由本计划在父方案 §9.0.1 新登记 `CON-CAP-001`(consumer=三 workflow、行为变化=prose 含 capability-class 引导句且经原生 MCP 不耦合,U10 断言捕获),不引用未定义合同。

---

## Problem Frame

v1.11–v1.15 基线已闭合（readiness / verification / governance / knowledge，经 git + source 核验;其中 v1.11-v1.13 有对应 commit 落地、v1.14/v1.15 的测试全绿为 CHANGELOG/commit message 声称,**本计划起点未重跑 `npm test` 重新锚定**——见 U12 起点验证）。v1.16 是路线表上唯一就绪的下一块，但**不能直接跳进 `provider-tools.json` 实现**——评审报告用方案自己的规则（§9.0.1「无消费方=不交付」、§7.3「有 producer+consumer 再创建合同」）发现了若干收敛项,其中 **P0-1 Phase E 标题缺失** 是 grep 实证的「方案违反自己」、**P1-3 术语漂移会直接导致 v1.16 填 registry 时 schema 校验失败**——这两项必须在写第一个 provider entry 前堵掉。

> **更正记录(2026-06-06,plan 审查后)**:本计划初版称评审报告「6 处自相矛盾,其中 2 处 grep 实证违反自己」,第二处指 P0-2「gate-lens/rule-maturity 零 producer 零 consumer」。回源码核实(plan 审查 B-1)发现评审报告该判断 grep 漏扫 `src/cli/helpers/`:`gate-lens-taxonomy.v1` 实有 producer(`task-governance-signals.js:263` 产出 `recommended_gate_lenses`),**不是孤儿**;只有 `rule-maturity.v1` 零消费,且那是 README 明示、`governance-contracts.test.js:39` 已锁定的有意 shadow。故原 P0-2 已降为 P2(见 R2 重写),不再是 install 硬前置。真正的 install 技术硬前置只有 **R3(防 schema 校验失败)+ R6(readiness 语义)**;R1/R2/R4/R5 是与 install 零技术耦合的治理 hygiene(见 Scope 的批次拆分说明)。

### GitNexus 教训（承重背景，必读）

`docs/plans/2026-06-02-001-refactor-remove-gitnexus-integration-plan.md`（completed）三天前硬删除了 GitNexus。死因**不是 install，而是消费侧 provider-specific 深度耦合**：spec-first 到处写死 `gitnexus` 名字——host instruction block、startup reminder、workflow routing、`spec-graph-bootstrap` public workflow、review-pre-facts helper 消费其产物 schema、contracts/CI gate/package allowlist 全焊死。v1.16 是对这个教训的**结构性回应**：把 install（走成熟 setup+gate，安全）与 consumption（capability-aware 不耦合）拆开。消费侧只认能力类别、不认 provider，从结构上不可能重新长成 GitNexus 的消费耦合。

### 当前 source 现状（已直接核对）

- `skills/spec-mcp-setup/provider-tools.json`：`providers: []` 空壳，`schema_version: provider-tools-registry.v1` 已声明(但**对应 schema 文件 `docs/contracts/provider-tools-registry.schema.json` 缺失**,见下条 S2)。
- `skills/spec-mcp-setup/scripts/`：`install-helpers.{sh,ps1}`、`install-mcp.{sh,ps1}`、`lib-helper-registry.{sh,ps1}` 等存在（扩展点）。
- `docs/contracts/workflows/spec-work-run-artifact.schema.json`：`provider_untrusted.readiness_status` enum = `["fresh","stale","degraded","not-run","unknown"]`（5 值，复用）。
- `docs/contracts/provider-readiness.schema.json` L21：`kind` enum = `["code-structure","project-graph","memory","generic"]`，**无 code-graph**。
- `src/cli/helpers/setup-facts.js:283`：`normalizeProviderReadiness` 只做 enum 归一，无新鲜度探测（裂缝 A 证据点）。
- 父方案初评时行 1070「目标:setup 帮用户装好…」曾是孤儿正文；本轮 docs 修复已补 `## Phase E：Capability-aware 协同（code-intelligence 能力工具）` 标题（R1 已由 source 兑现，测试守护见 `scale-provider-doc-contracts.test.js`）。
- `docs/contracts/governance/`：`gate-lens-taxonomy.{md,schema.json}` + `rule-maturity.{md,schema.json}` 已落盘。**注意(B-1 更正)**:`grep gate.lens skills/` = 0 **但** `src/cli/helpers/task-governance-signals.js:263/329` 是 gate-lens 的 producer——初版只扫 `skills/` 得出「gate-lens 零 producer」是错的(见下条与 R2);只有 `rule-maturity` 在 `src/cli/`+`skills/` 真零引用(有意 shadow)。
- `skills/spec-runtime-setup` 不存在（仍是 `spec-mcp-setup`）；`templates/.../runtime-setup.md` 不存在（P1-5 证据）。
- **`docs/contracts/` 下无 `provider-tools-registry.schema.json`**（helper 侧有 `helper-tools-registry.schema.json`,provider 侧缺,非对称）——「过 `provider-tools-registry.v1` schema 校验」当前无 schema 文件可校验(S2)。
- `tests/unit/dependency-readiness-baseline.test.js:149` 硬断言 `expect(providerTools.providers).toEqual([])`——U7 一填 entry 该断言必红(S1,U7/U12 必须纳入并改写)。
- `src/cli/helpers/task-governance-signals.js:263/329`：产出 `recommended_gate_lenses`(发射 gate-lens-taxonomy 家族名)——证明 `gate-lens-taxonomy.v1` **有 producer**(R2 拆分依据);`rule-maturity` 在 `src/cli/`+`skills/` 零引用且 `governance-contracts.test.js:39` 已锁定其有意 shadow。

---

## Requirements

> R1–R6 = 评审报告治理前置 + 裂缝 A（治理 hygiene + 架构决策，docs-only 为主）。其中**只有 R3(术语漂移防 schema 校验失败)+ R6(readiness 语义)是 install 实现的技术硬前置**;R1/R2/R4/R5 与 install 零技术耦合,是治理 hygiene,可独立成轻量 docs-PR 先行(见 Scope 批次拆分)。R7–R11 = v1.16 install/消费实现主体。R12 = 同步。

### 治理前置 + 架构决策（评审报告 1-5 + 裂缝 A）

- **R1.（P0-1，评审报告 §1）补 Phase E 章节标题。** 父方案 §8 在行 1069 后补 `## Phase E：Capability-aware 协同（code-intelligence 能力工具）`，与 §8.1 行 1113 相位表表述一致，把行 1070 起的孤儿正文收编为正式章节。它是 provider-coupling 边界（install 帮装 vs 消费不耦合）的唯一落点，读者当前按目录定位不到。docs-only。
- **R2.（P2,原 P0-2 降级,plan 审查 B-1 修正）分别处理 `gate-lens-taxonomy.v1` 与 `rule-maturity.v1`,不再一刀切「二选一」。** 评审报告初版称两者都零 producer/consumer,经回源码核实(grep 漏扫 `src/cli/helpers/`)后**已更正并降为 P2**。两套 schema 状态不同,必须分别处理:
  - **`gate-lens-taxonomy.v1`:有 producer,不豁免、不推迟。** `task-governance-signals.js:263` 产出 `recommended_gate_lenses`,`recommendedGateLenses()`(L329)发射 taxonomy 家族名(planning/exploration/verification/review/preflight),md:3 自述是 task/resource advisory 的命名词表。**核对 §9.0.1 L1165 已登记**其 producer(「由 `task-governance-signals.recommended_gate_lenses` 与 `resource-governance-lens.items[].lens_family` 复用,不单独主张 workflow consumer gate」)——故 U2 无须新增登记,只须**核实该既有登记表述准确**(已落盘);`recommended_gate_lenses` 字段当前未证实有下游 workflow consumer 读取(spec-plan 只消费 `candidate_level`/`reason_codes`,不读该字段)——作为 P2 follow-up 跟踪(接一个 consumer,或显式标为 producer-only advisory 字段),**不在 v1.16 强行制造 consumer**。**(对称补充)`recommended_artifacts`(schema required,task-governance-signals.js:262 产出)处境完全相同——同为 required 但零下游 consumer;P2 follow-up 须把两字段并列处理(一起接 consumer、一起标 producer-only advisory、或一起在 schema 降 optional),不可只跟踪 gate_lenses 一个而漏 artifacts,否则造成「治理已覆盖」的错觉。
  - **`rule-maturity.v1`:零消费,但是有意 shadow,登记豁免即可。** `src/cli/`+`skills/` 零引用,`governance-contracts.test.js:39/67` 已锁定「schema 允许 reserved stages 但 source 不注册 producer helper」。处理=在 README/父方案 §9.0.1 显式登记为「shadow schema,故意无 consumer,§7.3 豁免,producer 待 v1.17」,把隐式例外转为显式登记。
  - 不再把 `task-governance-signals.v1` 当「对照组证明 gate-lens 漏了」——它**正是** gate-lens 的 producer,初版表述自相矛盾,已删。docs/标注调整。
- **R3.（P1-3，评审报告 §2）对齐 `code-graph`(prose 类别词) ↔ `code-structure`(schema kind enum)术语漂移。** `provider-readiness.schema.json` L21 kind enum 是 `code-structure`，但 CodeGraph 方案/README L106/六层报告全程用 `code-graph`；v1.16 填 `provider-tools.json` 写 `kind:code-graph` 会 schema 校验失败。**这是唯一会导致 v1.16 落地第一天就撞墙的项，优先级等同 P0。** 取齐方式见 OQ-1（默认倾向 prose 加映射注，零 schema 改动风险）。
- **R4.（P1-4，评审报告 §2）`CON-PROV-001` 钉死 direct consumer + consuming phase。** provider_readiness facts 在 v1.11 产出，当前已通过 `setup-facts.js` projection 进入 `doctor.decision_input_health` direct rollup；但行为改变型 named workflow consumer 要到 v1.16。比照 `CON-READY-001` 标注 enabling-infra + direct consumer=`doctor.decision_input_health` + workflow consuming phase=v1.16，并明确 v1.16 前停在 advisory。§9.0.1 表内补 phase 标注。
- **R5.（P1-5，评审报告 §2）`spec-runtime-setup` 重命名排期/标注。** canonical 入口名全文引用但 source 实体仍是 `spec-mcp-setup` 且重命名未排期，文档读起来像 canonical 名已存在。在 README 版本线给该重命名分配版本，或显式标注「未排期,迁移期持续用 alias」。本计划**不做实际重命名**（中型重命名触及双宿主+测试），只消除「未来式写成完成式」的文档时态欺骗。
- **R6.（裂缝 A，评审报告 §3,plan 审查 B-2 + 二轮 NEW-1/NEW-2 修正）provider-readiness 轴 A 填值责任 + stale 必须用既有 deterministic 消费通路。** `normalizeProviderReadiness`（`setup-facts.js:283`）只做 enum 归一,无确定性新鲜度判断手段,而方案把轴 A 称为「deterministic 机械字段」——「两头都占」。`readiness_status` 本身就是 `fresh/stale/...` 新鲜度 enum、是 schema 里唯一的新鲜度字段。**二轮审查实证(NEW-1/NEW-2)**:`computeProviderCounts`(`setup-facts.js:385-389`)只按 `readiness_status` 计数,`computeDecisionInputHealth`(:437-439)的 warn 分支触发于 `provider_counts.{missing,stale,degraded}>0` **但不含 unknown**;且 `repo_aligned` 只被 `verify-tools.{sh,ps1}` 当**展示列**读取,**无任何 decision-path / gate consumer**(doctor 健康判断只看 readiness_status 派生的 provider_counts)。因此初版「installed-but-stale 一律写 unknown + 只用 repo_aligned 表达」会(a)让 doctor 的 stale 告警通路对 capability provider 变死代码,(b)把 stale 路由到无 decision consumer 的展示字段(实质等于不进入决策,违反 §9.0.1「无消费方=不交付」精神),(c)与 U4 钉死的 CON-PROV-001「stale→fallback」验收口径冲突(stale 永不可写)。**重解(按 NEW-1 方案 a)**:
  - **fresh 不可信任 → 不写**:spec-first 不代探新鲜度,provider **自报 `fresh` 不可信**(夸高可用性),`readiness_status` 写 `unknown`,**不得**把自报 fresh 写进去冒充 deterministic。
  - **stale 可安全采信 → 写 `readiness_status=stale`**:provider 自报 stale 是「把可用性夸低」,不破坏 advisory 红线(宁可保守),应写入 `readiness_status=stale`,**复活既有 doctor stale 通路**(`computeProviderCounts.stale` / warn 分支)与 CON-PROV-001 的 stale fallback trigger。这是已有 deterministic 消费链,不新增机制。
  - **`repo_aligned`/`limitations` 作辅助说明,非唯一落点**:可附带填(`repo_aligned` 会进 `verify-tools` 展示表),但 stale 的**可进入决策**表达走 `readiness_status=stale`(有 decision consumer:provider_counts→doctor warn→CON-PROV-001 fallback),不依赖无 decision-path consumer 的 `repo_aligned`。
  - **消费侧连带(R10)**:引导句仍要求采纳前确认新鲜度(尤其 readiness_status=unknown 时,fresh 未知)。

### v1.16 install 侧实现主体（CodeGraph 方案 §3.1 / §8.1）

- **R7.（install registry）填 `provider-tools.json` 的 CodeGraph / Graphify entry,并先建缺失的 registry schema。** detect 命令、`lifecycle_commands`（install / configure / index / probe）、`safety`（复用 `helper-tools-registry.v1` 的 safety 结构）、fallback。kind 取值遵循 R3 对齐结果。两处硬约束:
  - **(S2)`provider-tools-registry.v1` 的 schema 文件当前不存在**(`docs/contracts/` 只有 helper 侧)。R7 必须先建 `docs/contracts/provider-tools-registry.schema.json`(比照 `helper-tools-registry.schema.json`,kind 引用 provider-readiness enum),否则「过 provider-tools-registry.v1 schema 校验」无文件可校验。
  - **(S3 供应链)`safety` 支持可选 `version_pin`**:即便默认 latest 也留 pin 入口,registry 钉一个已审版本(如 CodeGraph 0.9.8)作默认 install target——「flag 漂移」(靠 `--help` 复核)与「版本 pin」是两件事,不可混为「所以不 pin」。新增 `personal_scope` / `name_bin_mismatch` 标记(graphifyy 包名 ↔ graphify bin 名,CLAUDE.md 点名的 typosquatting 特征),供 gate 提示 surface。
- **R8.（install 执行）扩 `install-helpers.{sh,ps1}` 读 registry 执行 provider install + configure MCP + 首次 index;configure 走 host 级路径(B1 修正)。** 比 helper「只装 CLI」多 configure/index 两步,**双宿主 parity**。识别「CLI 已全局装(用户级)、当前项目未配/未建索引」跨级别状态逐 rung 续跑（§5.1 ladder）。**configure 生命周期归属诚实化(plan 审查 B1 实证)**:现有 `configure-host.sh:143` 写的是 **host 级**配置(`managed-mcp.json`/`$HOME/.claude.json`/`$HOME/.codex/config.toml`),`clean.js` 对 MCP 配置零触碰、回滚走独立的 `uninstall-mcp.{sh,ps1}`。因此:
  - 删除「写既有项目级 .claude/.codex 投影层 + spec-first clean 可回滚 + 零新增基础设施」表述——CodeGraph MCP entry 写 **host config**,与 sequential-thinking/context7 同档,blast-radius 是 host/user 级。
  - 回滚必须把 CodeGraph 接进 `uninstall-mcp` 的 provider 分支,并把 `uninstall-mcp.{sh,ps1}` 列入 U8 Files;明确 clean **不卸全局 CLI、不删项目级 index 产物**,需提供 uninstall/卸索引的 next_action。
- **R9.（install gate + ladder）detect 缺失 → 过 install gate → 用户同意后装;MCP 写入落点分宿主表述(B2 修正)。** 触发只在 setup workflow,**不在 plan/work/review 主动弹**（§7 复发信号）。gate 提示说清「装≠配≠用」的安装阶梯 + 供应链风险(无 pin / 个人维护 / 包名 bin 不一致,承 R7 的 safety 标记)。**双宿主 MCP scope 差异(plan 审查 B2 + 二轮 NEW-3 实证,以 `mcp-tools.json` 为准)**:两宿主**都没有 project-level MCP scope**——Claude 写 `managed`/`user` 级、Codex 写 `user`/`system` 级(`mcp-tools.json` scope 字段)。因此**不得**说「MCP 默认项目级」(对两宿主都不成立,Claude 默认是 `managed` 不是 project);差异是 **scope 命名/落点级别**(Claude managed/user ↔ Codex user/system),非「Claude 有项目级、Codex 没有」。U8/U9 双宿主 parity 断言为「行为对称但 scope 落点按宿主能力差异化」,不得断言任何项目级 MCP。用已落地 `provider-readiness.v1` 的 lifecycle 布尔位表达「装≠用」ladder（见 §5.1,本计划行使其中 `installed/configured/indexed/server_reachable/query_verified` 子集,其余 `initialized/artifact_exists/fallback_used` 不参与本 ladder——统一 8-vs-子集口径,见 OQ),**不新增态、不新建 schema**。

### v1.16 消费侧实现主体（CodeGraph 方案 §3.1 消费侧 / §2）

- **R10.（capability-class 引导）`spec-plan` / `spec-code-review` / `spec-debug` 各加一句 capability-class 引导。** 只认能力类别（code-graph / project-graph），**绝不写死工具名或工具内部命令**（`codegraph_callers`/`graphify` 不得出现在 prose——这是 §7 防 GitNexus 复发的承重墙）。装成 MCP 后工具在 Claude Code/Codex 工具层原生可见，LLM 直接调，**不经 instruction block 注入**。引导句句式见 §2：「若工具箱里存在 <能力类别> 能力，可在 <节点> 优先利用其产出作为 advisory candidate；缺失则走 fallback；任何此类输出都是 candidate，结论仍需 source/test/log/contract/user evidence 回源确认」。两处强化:
  - **(承 R6/B-2)新鲜度确认**:引导句须显式要求「采纳前先确认该能力产出相对当前 worktree 的新鲜度(provider 自报的 fresh 不构成 spec-first 确认)」——在无 spec-first 可信新鲜度位之前,防止把可能 stale 的图当 fresh 用。
  - **(承 S4 signal-4)never-block 语义**:引导句须含 never-block/缺失走 fallback,且**不得**出现「缺失即 warn/降级/阻断」措辞(advisory→confirmed creep 是 §7 复发信号 4);U10 测试补反向断言。
  - **(转述差异说明)CodeGraph §3.1 列 4 节点(含 knowledge),本计划只覆盖 spec-plan/code-review/debug 前 3 个**:knowledge 节点的 memory 能力走 `docs/solutions/`(v1.15),不是 code-graph/project-graph 能力,故有意不在此加 code-intelligence 引导,避免把 memory 能力与 code-graph 能力混淆。
- **R11.（复用 evidence enum）复用既有 `provider_untrusted` 记机械 readiness + 候选，不新建第二套 evidence enum。** 轴 A 复用现有 5 值 readiness enum，轴 B（advisory / evidence_candidate）是 workflow 语义晋升维度、不写进 readiness 字段。`readiness_status=fresh` 永不等于 confirmed（§5.2 两轴模型，与父方案 contract test 锁定一致）。

### 同步

- **R12.（文档/测试同步）** 父方案 Phase E / README 版本线（v1.16→进行中/已完成）/ CodeGraph 子方案 / project-scaffold 子方案 / CHANGELOG 同步；GBrain 删除表述一致（memory 走 `docs/solutions/`，不写成具名待集成 provider）；focused contract tests + `npm test` 全绿；双宿主 parity 回归。

---

## Scope Boundaries

**本计划做（v1.16）：** 治理前置（R1-R5）+ 裂缝 A 定位（R6）+ install 侧 registry/helpers/gate/ladder（R7-R9）+ 消费侧 capability-class 引导（R10-R11）+ 同步（R12）。

> **批次拆分:PR 切片建议,非两份独立 plan(plan 审查 S-2 + 二轮澄清)**:纯文档治理(R1/R2/R4/R5)与真实供应链 install(R7-R9,按角色契约 §8 是 provider 协议变更**大任务**)风险档、review 强度、可逆性完全不同,且 R1/R2/R4/R5 与 install **零技术耦合**(Dependencies 均为「无」)。真正的 install 技术硬前置只有 **R3 + R6**。**本计划仍是单一 plan 单批执行**(Implementation Units 按单 plan 列全);批次拆分是**落地时的 PR 切片建议**——若团队偏好,可把 R1/R2/R4/R5 切成轻量 docs-PR 先合(小任务 review),再以 install-PR 承载 R3+R6+R7-R11。**注意批 1(R1/R2/R4/R5)已落地 working tree(见 Direct Evidence),实际「步骤 1」多为核实落盘 + 提交,而非从零起草**。此处不设「执行前必须先拆」的硬 gate,只标明切片优先级。

**本计划不做：**

| 不做 | 归属 / 理由 |
| --- | --- |
| 消费侧写死工具名 / 工具内部命令 / 注入 routing/reminder/instruction block | GitNexus 死因，承重墙（CodeGraph 方案 §3.2/§7/§8.2） |
| elaborate adapter envelope / context fusion summary / 7 态机 / Context Intelligence Plane | 过度设计，消费走原生 MCP + 既有 provider_untrusted 足够 |
| init 自动装 / 运行期 lazy 自动装 / 运行期主动弹装 | install 只在 setup explicit mode |
| spec-first 代刷新 / silent 装 file-watcher hook / 重建并行 drift 检测 | 刷新归工具自带 file-watcher，spec-first 只旁观 freshness 信号 |
| GBrain / 外部 memory 工具集成 | memory 走 `docs/solutions/`（v1.15），CodeGraph 方案 §4.3 |
| `spec-runtime-setup` 实际重命名（source 实体 rename） | 中型重命名触及双宿主+测试，R5 只排期/标注，实际 rename 是独立 work |
| 裂缝 B（honest-closeout verified 限定） | honest-closeout(v1.13) 自身诚实度，与 v1.16 capability-aware 主题正交；见 OQ-3 决议=不纳入本计划，留 follow-up |
| RuleMaturity required-evidence / blocking 晋升 | v1.17 Governance Maturity |

### Deferred to Follow-Up Work

- 裂缝 B（honest-closeout 的 `verified` 限定为 honest-but-transcribed，或加 caller-independent 校验）：v1.13 honest-closeout 自身加固，独立 follow-up，不阻塞 v1.16。
- `spec-runtime-setup` 实体重命名：R5 只标注排期，实际 source rename（含双宿主 + 测试）作为独立 work 任务。
- 评审报告 §6 的横向增益 gate（超越单 fact 单 reader 的整体研发增益度量）：战略性度量改进，绑定到真实使用数据，不在 v1.16 实现切片。
- **(S-5 度量债,显式记录)Evaluation Harness 指标**:本计划 Completion Criteria 全是 parity/结构断言(registry 过 schema、prose 含引导句、不含工具名),无一条回答「capability-class 消费是否真改善影响面分析/review/debug」——这正是评审报告 §5/§6 批评 v2 的缺口。v1.16 **接受该度量债**并显式记录与角色契约 §7 的张力;建议执行期至少命名一个轻量 eval 信号(如接入前后在一个真实任务上对比 review/debug 的 source-read 命中或漏判),不让结构化 parity 默认充当价值证明。

---

## Completion Criteria

- 父方案含 `## Phase E` 标题（`grep '^## Phase E'` 命中），孤儿正文被收编（R1）。
- `gate-lens-taxonomy.v1` 在 §9.0.1 登记**既有 producer**(task-governance-signals,不豁免);`rule-maturity.v1` 登记为 shadow/§7.3 豁免;不再出现「两者都零 producer」表述（R2,B-1 修正）。
- `docs/contracts/provider-tools-registry.schema.json` 已创建;`provider-tools.json` 的 CodeGraph/Graphify entry 能过该 registry schema **且** kind 取值过 `provider-readiness` enum（R3+R7+S2）。
- `dependency-readiness-baseline.test.js` 的 `providers).toEqual([])` 断言已改写为对两 entry 的结构/kind/safety 断言,填值不致开工即红（R7/S1）。
- `CON-PROV-001` 与 `CON-READY-001` 同口径标注 consuming phase=v1.16 + v1.16 前停 advisory（R4）。
- README 版本线对 `spec-runtime-setup` 重命名有版本条目或「未排期/迁移期 alias」明确标注（R5）。
- provider-readiness 轴 A 填值责任在合同/代码钉死单一来源:provider 自报 `fresh`→`readiness_status=unknown`(不冒充 deterministic);provider 自报 `stale`→`readiness_status=stale`,进既有 `computeProviderCounts.stale`→doctor warn→CON-PROV-001 fallback 决策链(非死代码);`repo_aligned`/`limitations` 仅附带展示(R6/OQ-2,二轮 NEW-1/NEW-2 修正)。
- `install-helpers.{sh,ps1}` 读 registry 执行 install/configure/index,ladder rung 可达;**configure 写 host config(非项目级投影)、回滚接 `uninstall-mcp` 分支**;双宿主 parity 断言为「行为对称、scope 落点按宿主能力差异化」(两宿主都无项目级 MCP:Claude managed/user、Codex user/system);过 install gate（R8/R9,B1/B2 修正）。
- `spec-plan`/`spec-code-review`/`spec-debug` prose 含 capability-class 引导句、含新鲜度确认与 never-block 语义、**不含** `codegraph_*`/`graphify` 工具名、**不含**「缺失即 warn/降级/阻断」措辞、**不注入** reminder（R10,含 signal-4 反向断言）。
- 复用既有 `provider_untrusted`，无第二套 evidence enum（R11）。
- 父方案 §9.0.1 登记 `CON-CAP-001`(consumer=三 workflow,行为变化可由 U10 断言捕获),Summary 不再引用未定义合同。
- `npm test` 全绿（新增 contract tests + 现有不回归）；双宿主 prose parity；CHANGELOG/README/父方案/子方案同步（R12）。

---

## Open Questions

### Resolved During Planning（架构决策拍板）

- **OQ-1（R3 取齐方式）→ 决议倾向 prose 加映射注。** 在 CodeGraph 方案 §2 或 §5.1 补「prose capability-class `code-graph` 映射到 provider-readiness `kind=code-structure`」。**理由**：零 source 改动、schema enum 不动、最小风险；schema 改名需 downstream 兼容 + 测试。执行期按「schema 是否已有 consumer 依赖 `code-structure`」最终确认——若无依赖且团队偏好字面统一，可改为 schema 增 `code-graph`，但默认 prose 映射。
- **OQ-2（R6 裂缝 A 填值责任）→ 初版「降 advisory」与 B-2 解均自相矛盾,已按二轮 NEW-1/NEW-2 三度重解。** 初版说「provider 自报 fresh/stale 不进 readiness 字段」——但 `readiness_status` **就是**唯一新鲜度 enum、无独立轴 B 字段,「不进字段」无处落。B-2 改为「installed-but-stale 一律写 unknown + 用 repo_aligned=no 表达」——但二轮回源码实证(`computeProviderCounts:385-389` 只数 readiness_status、warn 分支 `:437-439` 不含 unknown、`repo_aligned` 仅 `verify-tools` 展示无 decision consumer)发现这会让 doctor stale 通路对 capability provider 变死代码、把 stale 路由到无人决策的字段、与 CON-PROV-001「stale→fallback」冲突。**三度重解(R6/U6 已写入)**:(1) provider 自报 `fresh` 不可信→`readiness_status=unknown`(不冒充 deterministic);(2) provider 自报 `stale` 可安全采信(夸低可用性、不破 advisory)→写 `readiness_status=stale`,复活既有 `computeProviderCounts.stale`→doctor warn→CON-PROV-001 fallback **deterministic 消费链**;(3) `repo_aligned`/`limitations` 仅作附带展示/说明,非 stale 唯一落点。**理由**:守「消费不耦合」红线 + 给 stale 一个**有 decision consumer** 的落点(非死代码) + 零新增机制。最小只读探针(artifact mtime vs git HEAD)仍是 Deferred,默认不引入,守 80/20。
- **OQ-3（裂缝 B 是否纳入 v1.16）→ 决议不纳入。** honest-closeout 的 `verified` 牙齿问题属 v1.13 自身诚实度，与 v1.16 capability-aware 主题正交。**理由**：避免 v1.16 范围蔓延；裂缝 B 是真实问题但有独立修复路径（限定 verified 语义 / 加 caller-independent 校验），作为 follow-up 单独处理更清晰。

- **OQ-4（5-vs-8 lifecycle ladder 口径,引用对账 SF-2 + 上轮评审 R4）→ 决议:ladder 行使 8 布尔位的明确子集。** provider-readiness schema 有 8 个 lifecycle 布尔位,本计划 ladder 行使其中 `installed/configured/indexed/server_reachable/query_verified` 子集,其余 `initialized/artifact_exists/fallback_used` 不参与本 ladder。**理由**:消除「说 8、列 4」的并列歧义(初版 U9 称「8 布尔位」但 Completion/R9 列 4-rung);8 是 schema 总数、子集是本 ladder 实际行使,二者不矛盾但须写清。已写入 R9/U9。

### Deferred to Implementation

- CodeGraph/Graphify 的精确 `lifecycle_commands`：v0.9.8 pre-1.0，落地时 `--help` 复核实际命令，存 registry 数据不硬编码（R7）。
- install gate 的 CodeGraph 默认拦截阈值表述：落地时按 unpinned-latest + 单人维护 bus-factor 的实际 safety 字段填（R9）。
- capability-class 引导句在各 workflow 节点的精确裁剪措辞：落地时按 §2 句式 + 各节点语境定（R10）。

---

## Implementation Units

> 批 1a = U1/U2/U4/U5（治理 hygiene,docs-only,与 install 零技术耦合,建议独立成轻量 docs-PR 先合,见 Scope 批次拆分）；批 1b = U3（术语对齐,虽形式上是 docs 改动但属 install 的 schema 校验前置,随 install-PR 或紧前于它落）；批 2 = U6（裂缝 A 定位决策落地）；批 3 = U7-U9（install 侧实现，真实代码增量）；批 4 = U10-U11（消费侧引导）；U12 同步贯穿。**install 实现的真实技术硬前置只有 U3(术语对齐防 schema 校验失败)+ U6(readiness 语义)**;U1/U2/U4/U5 是与 install 零技术耦合的治理 hygiene(Dependencies 均为「无」),不是 install 的编译期/校验期前置——初版「批1+U6 是 install 硬前置」措辞已按 plan 审查 SF-2 修正。U3 因此从「批 1 docs-only」析出为「批 1b install 前置」,消除与 Scope PR 切片(R3 归 install-PR)的归属冲突。
>
> **⚠ 批 1 已落地状态(二轮审查实证,执行前必读)**:U1-U5 的 docs 改动**已在 working tree 落盘**(未提交),且 `scale-provider-doc-contracts.test.js` 已加机器守护(green)。各 U 下「Goal/Approach」按「从零写」语气写成,执行时应**先 disk-diff 幂等核对**——批 1 实际剩余工作量多为「核实已落盘表述准确 + 删除评审报告/README/本 plan 残留的『两者都零 producer』等误判表述 + 确认机器断言」,**不要把已落盘内容重写一遍**。

### U1. 补父方案 Phase E 标题（批 1，P0-1）

- **Goal**：消除父方案 §8 的 Phase E 物理缺失，收编行 1070 孤儿正文。
- **Requirements**：R1。
- **Dependencies**：无。
- **Files**：`docs/01-需求分析/13.scale集成/spec-first内化集成scale-project-scaffold技术方案.md`。
- **Approach**：在行 1069 后（Phase D 校准表与孤儿正文之间）插入 `## Phase E：Capability-aware 协同（code-intelligence 能力工具）`，与 §8.1 相位表（行 1113）的「Phase E」表述一致。仅补标题，不改孤儿正文内容。
- **Test scenarios**：`Covers R1 (machine-guarded).` 把 `grep '^## Phase E'` 命中升级为 `scale-provider-doc-contracts.test.js` 的断言(该 doc-contract 测试已存在,SF-3 建议把易静默回归的 Phase E 标题缺失从人工 grep 升级为机器守护);并验证 §8.1 相位表与 §8 章节标题对账一致。
- **Verification**：测试断言 Phase E 标题存在;目录可定位该章。

### U2. 分别登记 gate-lens(有 producer)与 rule-maturity(shadow 豁免)（批 1，原 P0-2 降 P2，B-1 修正）

- **Goal**：按两套 schema 各自真实状态分别处理,消除初版「两者都零 producer」的误判,不写假治理记录。
- **Requirements**：R2。
- **Dependencies**：无。
- **Files**：`docs/contracts/governance/rule-maturity.md`、`docs/contracts/governance/gate-lens-taxonomy.md`、父方案 §9.0.1 / §7.3 相关段、`docs/01-需求分析/13.scale集成/README.md`（governance 表述）、`tests/unit/governance-contracts.test.js`。
- **Approach**：
  - `gate-lens-taxonomy.v1`:**不豁免、不推迟**。它有 producer(`task-governance-signals.js:263/329` 发射家族名)。**§9.0.1 L1165 已登记**其既有 producer——U2 核实该登记准确,不重复写;`recommended_gate_lenses` 字段的下游 consumer 作为 P2 follow-up(接 consumer 或显式标 producer-only advisory 字段),不在 v1.16 强造 consumer。
  - `rule-maturity.v1`:**§9.0.1 L1166 已登记**为「v1.14 schema/docs-only shadow 例外,故意无 producer/helper,显式豁免 §7.3,producer 待 v1.17」(与 README + `governance-contracts.test.js:39/67` 已锁定的 shadow 态一致)——U2 核实该登记准确。
  - **删除**初版「对照 task-governance-signals.v1 证明 gate-lens 漏了」的表述——该「对照组」正是 gate-lens 的 producer,自相矛盾。
  - **本单元实际工作量**:两条 §9.0.1 登记均已落盘,U2 收敛为(a)核实两登记表述准确、(b)删除评审报告/README/本 plan 残留的「两者都零 producer」误判表述、(c)补/确认 `governance-contracts.test.js` 对两态的断言。
- **Test scenarios**：`Covers R2.` `governance-contracts.test.js` 已覆盖 gate-lens schema 校验(L15)与 rule-maturity shadow(L39/L67)。补:gate-lens 的 producer 登记断言(§9.0.1 含 task-governance-signals 为其 producer)、rule-maturity 的 §7.3 豁免登记断言。**删除**初版的条件式「否则 Test expectation: none」——该 harness 已存在,分支不成立。
- **Verification**：gate-lens 登记 producer(非豁免);rule-maturity 登记 shadow 豁免;无假治理记录;测试锁定。

### U3. 对齐 code-graph ↔ code-structure 术语（批 1，P1-3，等同 P0 优先级）

- **Goal**：消除 prose 类别词与 schema kind enum 的漂移，防 v1.16 填 registry 时 schema 校验失败。
- **Requirements**：R3（决议 OQ-1）。
- **Dependencies**：无（但 U7 填 registry 强依赖本单元先落）。
- **Files**：`docs/01-需求分析/13.scale集成/CodeGraph技术方案.md`（§2 或 §5.1 加映射注）；按 OQ-1 执行期确认结果可能涉及 `docs/contracts/provider-readiness.schema.json`。
- **Approach**：默认 prose 映射注——在 CodeGraph 方案补「prose capability-class `code-graph` 映射到 provider-readiness `kind=code-structure`」。执行期先 grep `code-structure` 在 schema/helper 是否已有 consumer 依赖：无依赖且团队偏字面统一→可改 schema 增 `code-graph`（需 downstream 兼容 + 测试）；有依赖→坚持 prose 映射。
- **Test scenarios**：`Covers R3.` 构造一个 `kind:code-structure`（或对齐后取值）的 provider entry 样例，断言能过 `provider-readiness` schema 校验；断言 prose 与 schema enum 无矛盾表述。
- **Verification**：provider entry 样例过 schema 校验;prose/schema 术语对账一致。

### U4. CON-PROV-001 钉 direct consumer + consuming phase（批 1，P1-4）

- **Goal**：让 provider_readiness 的 direct rollup 与 workflow consuming phase 像 CON-READY-001 一样钉死，消除 direct consumer 与 named workflow consumer 混写造成的「基建空转」表述。
- **Requirements**：R4。
- **Dependencies**：无。
- **Files**：父方案 §9.0.1 CON-* 表。
- **Approach**：比照 `CON-READY-001` 给 `CON-PROV-001` 补 enabling-infra 标注 + direct consumer=`doctor.decision_input_health` projection + workflow consuming phase=v1.16 + 「v1.16 前停 advisory」说明。
- **Test scenarios**：`Covers R4 (machine-guarded).` 把 CON-PROV-001 含 consuming-phase=v1.16 标注固化为 `scale-provider-doc-contracts.test.js` 断言(SF-3:此项可机器检测、易静默回归),验证与 CON-READY-001 同口径。
- **Verification**：CON-PROV-001 与 CON-READY-001 标注口径一致,测试守护。

### U5. spec-runtime-setup 重命名排期标注（批 1，P1-5）

- **Goal**：消除「canonical 名全文引用但 source 实体未重命名且未排期」的文档时态欺骗。
- **Requirements**：R5。
- **Dependencies**：无。
- **Files**：`docs/01-需求分析/13.scale集成/README.md` 版本线；父方案 §0.4.2（若有 alias 说明段）。
- **Approach**：README 版本线给该重命名分配版本条目，或显式标注「未排期,迁移期持续用 `spec-mcp-setup` alias,canonical 名 `spec-runtime-setup` 为目标命名」。本计划不做实体 rename。
- **Test scenarios**：`Test expectation: none -- 治理 prose 标注`；验证 README 含重命名排期或未排期标注。
- **Verification**：读者不再误以为 `spec-runtime-setup` 实体已存在。

### U6. provider-readiness 轴 A 填值责任钉死 + installed-but-stale 走既有 deterministic 通路（批 2，裂缝 A / R6，B-2 + 二轮 NEW-1/NEW-2 修正）

- **Goal**：终结「轴 A 两头都占」——明确填值责任,并让「装了但 index 过期」落到**有 decision consumer** 的既有通路,不变成死代码。
- **Requirements**：R6（OQ-2 重解）。
- **Dependencies**：U3（术语对齐后才好写 readiness 语义）；U4（软依赖:R6 的 stale 落点引用 U4 钉死的 CON-PROV-001「stale→fallback」口径,U4 应同批或先于 U6 落）。
- **Files**：`docs/contracts/provider-readiness.md`、`docs/01-需求分析/13.scale集成/CodeGraph技术方案.md` §5.2、`src/cli/helpers/setup-facts.js`（在 `normalizeProviderReadiness` 注释钉死「不探新鲜度、不把 provider 自报 fresh 写进 readiness_status」语义）。
- **Approach**：(1) **自报 fresh 不可信→不写**:工具存在/可达但 provider 自报 `fresh` 时 `readiness_status` 写 `unknown`,不把自报 fresh 写进去冒充 spec-first deterministic 判断;(2) **自报 stale 可安全采信→写 `readiness_status=stale`**:provider 自报 stale 是把可用性夸低、不破 advisory 红线,写入 stale 即复活既有 deterministic 消费链(`computeProviderCounts.stale`→`computeDecisionInputHealth` warn 分支→CON-PROV-001 fallback trigger),**不新增机制**;(3) `repo_aligned`/`limitations` 可附带填作展示/说明,但**不作 stale 的唯一落点**(它们无 decision-path consumer);(4) 在 provider-readiness 合同明示这套填值规则 + 「`fresh` 永不等于 confirmed」。守住父方案 contract test「readiness 只接受 5 值 enum」,**不新增字段、不引探针、不碰「不代刷新」边界**。
- **Test scenarios**：`Covers R6.` 断言合同含「`readiness_status` 不承载 provider 自报 fresh(自报 fresh→unknown) + 自报 stale→readiness_status=stale 进既有 doctor 通路 + fresh 非 confirmed」;单测断言 `normalizeProviderReadiness` 保持纯 enum 归一(不引入新鲜度探测逻辑),且对 `readiness_status=stale` 入参 `computeProviderCounts.stale` 计数+1(证明 stale 进决策、非死代码)。
- **Verification**：轴 A 不再「两头都占」;stale 落到有 decision consumer 的既有通路(非死代码、非零 consumer 展示字段);填值责任单一书面来源。

### U7. 建 registry schema + 填 provider-tools.json 的 CodeGraph/Graphify entry（批 3，R7）

- **Goal**：先建缺失的 provider registry schema,再把空壳 registry 填上两个 provider entry。
- **Requirements**：R7。
- **Dependencies**：U3（kind 取值）、U6（readiness 语义）。
- **Files**：**新建 `docs/contracts/provider-tools-registry.schema.json`**(S2,当前缺,比照 `docs/contracts/helper-tools-registry.schema.json`)；`skills/spec-mcp-setup/provider-tools.json`；**`tests/unit/dependency-readiness-baseline.test.js`**(S1,L149 的 `providers).toEqual([])` 必须改写)；参考 `skills/spec-mcp-setup/helper-tools.json`（safety 结构复用)。
- **Approach**：(S2)先建 `provider-tools-registry.schema.json`,kind 字段对齐 provider-readiness enum,否则「过 schema 校验」无文件可校验。填 CodeGraph（prose capability class=code-graph,**registry `kind` 字面写 `code-structure`**——遵循 U3 映射,registry 里**绝不**写 `kind:"code-graph"`(会 schema 校验失败);detect=`codegraph --version`、`lifecycle_commands`={install:`npm i -g @colbymchenry/codegraph`、configure:写 **host** MCP、index:`codegraph init -i`、probe:只读 query}、safety=复用 helper-tools-registry.v1 结构 + **(S3)`version_pin` 钉已审版本(如 0.9.8) + `personal_scope` + 默认拦截**、fallback=`rg`/ast-grep）+ Graphify（prose class=project-graph,registry `kind` 写 `project-graph`(该值已在 enum 内,无漂移);detect=`graphify --version`、install=`uv tool install graphifyy`、**(S3)`name_bin_mismatch` 标记 graphifyy↔graphify**、无 configure/index 默认层、fallback=`docs/`/direct read）。命令存数据,flag 漂移靠 `--help` 复核(与 version_pin 解耦);kind 字面取值遵循 U3。
- **Test scenarios**：`Covers R7.` provider-tools.json 合法 JSON、过新建 `provider-tools-registry.v1` schema、两 entry kind 过 provider-readiness enum、safety 含 version_pin/personal_scope/name_bin_mismatch;**`dependency-readiness-baseline.test.js` 的 `providers).toEqual([])` 改为对两 entry 的结构/kind/safety 断言**(防开工即红)。
- **Verification**：registry schema 文件存在且校验通过;两 entry 字段完整;基线测试不红。

### U8. 扩 install-helpers 执行 provider install/configure(host级)/index（批 3，R8，B1 修正）

- **Goal**：让 install-helpers 读 provider registry 执行比 helper 多两步（configure MCP + 首次 index）的安装,configure 走 host 级并接 uninstall 回滚。
- **Requirements**：R8。
- **Dependencies**：U7。
- **Files**：`skills/spec-mcp-setup/scripts/install-helpers.sh`、`install-helpers.ps1`、`install-mcp.{sh,ps1}`、`configure-host.sh`/对应 ps1、**`uninstall-mcp.{sh,ps1}`(B1:回滚分支接 CodeGraph)**、`lib-helper-registry.{sh,ps1}`。
- **Approach**：读 `provider-tools.json` 的 `lifecycle_commands`，按 rung 执行 install→configure→index；识别跨级别状态（CLI 全局已装、项目未配/未索引）逐 rung 续跑。双宿主 parity（sh + ps1 对称）。**(B1 实证)configure 写 host 级配置**(`configure-host.sh:143` 写 `managed-mcp.json`/`$HOME/.claude.json`/`$HOME/.codex/config.toml`),与 sequential-thinking/context7 同档;**回滚走 `uninstall-mcp` 的 CodeGraph 分支**(`clean.js` 不碰 MCP 配置、不卸全局 CLI、不删 index)。**删除**初版「写既有项目级投影层 + spec-first clean 可回滚」表述。
- **Execution note**：Start with a failing focused test for「registry-driven provider install reads lifecycle_commands and runs configure(host-level)+index」on at least one host script path.
- **Test scenarios**：`Covers R8.` 各 rung 可达单测/smoke；跨级别续跑;sh/ps1 parity;命令来自 registry;**configure 写 host config(非项目 mirror) 且 uninstall-mcp 能回滚该 entry**;过 install gate（不绕过）。
- **Verification**：registry-driven install+configure(host)+index;双宿主对称;回滚走 uninstall-mcp;gate 不被绕过。

### U9. install gate + ladder 表达(MCP scope 落点分宿主)（批 3，R9，B2 + 二轮 NEW-3 修正）

- **Goal**：setup detect 缺失→过 gate(安装阶梯 + 供应链风险)→用户同意→装；用 lifecycle 布尔位表达「装≠用」,MCP scope 落点按宿主能力差异化。
- **Requirements**：R9。
- **Dependencies**：U8。
- **Files**：`skills/spec-mcp-setup/SKILL.md`（setup workflow prose）；install gate 提示文案落点。
- **Approach**：detect → install gate（CodeGraph 默认拦截、显式确认）→ 同意提示说清「装≠配≠用」安装阶梯 + **供应链风险(无 pin/个人维护/包名 bin 不一致,承 U7 safety)** → 装。触发只在 setup workflow，**不在 plan/work/review 主动弹**。**(B2 + NEW-3 实证,以 `mcp-tools.json` scope 字段为准)两宿主都无 project-level MCP scope**:Claude 写 `managed`/`user`、Codex 写 `user`/`system`;gate 文案与 ladder **不得**出现「MCP 默认项目级」(对两宿主都不成立),差异表述为 scope 命名/落点级别差异。用既有 `provider-readiness.v1` lifecycle 布尔位表达 ladder:行使 `installed/configured/indexed/server_reachable/query_verified` 子集(统一 5-vs-8 口径,见 OQ),其余 `initialized/artifact_exists/fallback_used` 不参与;不新增态、不新建 schema。
- **Test scenarios**：`Covers R9.` gate 提示含安装阶梯(装≠配≠用) + 供应链风险;detect→gate→install 序列;触发限定 setup（断言 plan/work/review prose 不含主动弹装）;ladder 用既有 lifecycle 子集不新增态;双宿主断言为「行为对称、scope 落点按宿主差异化」,**断言 prose 不含「项目级 MCP」字样**(两宿主都没有)。
- **Verification**：gate 说清安装阶梯 + 风险;触发限定 setup;ladder 复用既有位;两宿主 MCP scope 落点诚实(无虚报项目级)。

### U10. workflow capability-class 消费引导（批 4，R10）

- **Goal**：spec-plan/code-review/debug 各加一句 capability-class 引导，消费经原生 MCP 不耦合。
- **Requirements**：R10。
- **Dependencies**：无（与 install 侧解耦，可并行）。
- **Files**：`skills/spec-plan/SKILL.md`、`skills/spec-code-review/SKILL.md`、`skills/spec-debug/SKILL.md`。
- **Approach**：各节点按 §2 句式加一句**能力类别**引导（code-graph 用于影响面/调用链、project-graph 用于架构总览），描述意图**不点工具名**、不点工具内部命令（`codegraph_callers`/`graphify` 严禁出现）、不注入 routing/reminder/instruction block。装成 MCP 后 LLM 经原生工具面调用。explore 可信工具、结论必回源（§4.1.2/§4.2.1 纪律的语义版,不写工具名）。**(承 R6/B-2)引导句须含「采纳前先确认产出相对当前 worktree 的新鲜度」**(provider 自报 fresh 不构成 spec-first 确认);**(承 S4 signal-4)须含 never-block,且不得出现「缺失即 warn/降级/阻断」措辞**(advisory→confirmed creep)。
- **Test scenarios**：`Covers R10.` 三 SKILL 含 capability-class 引导句（能力类别词）；`not.toContain('codegraph_')`、`not.toContain('graphify')`、不含 reminder 注入措辞；含「advisory candidate / 回源确认 / fallback / 新鲜度确认」语义;**反向断言:不含「缺失即 warn/降级/阻断」措辞(signal-4)**。
- **Verification**：三 SKILL 有能力类别引导、零工具名、零 reminder 注入、含新鲜度确认与 never-block;复发信号(§7,含 signal-4)全不触发。

### U11. 复用 provider_untrusted 记 readiness + 候选（批 4，R11）

- **Goal**：消费侧机械 readiness + 候选证据复用既有 `provider_untrusted`，不新建第二套 evidence enum。
- **Requirements**：R11。
- **Dependencies**：U10。
- **Files**：消费侧 prose（U10 同文件）的两轴说明落点；参考 `src/cli/helpers/spec-work-run-artifact.js`（已有 `provider_untrusted`）。
- **Approach**：消费 prose 引用既有 `provider_untrusted.readiness_status`（5 值）记机械 readiness；轴 B（advisory/evidence_candidate）是 workflow 语义晋升、不写进 readiness 字段。不新建 enum、不造特例。
- **Test scenarios**：`Covers R11.` 断言消费 prose 引用既有 5 值 readiness enum、无新增 evidence enum 定义、含「fresh 非 confirmed / 轴 B 不回填 readiness 字段」表述。
- **Verification**：无第二套 evidence enum;两轴模型与 §5.2/父方案一致。

### U12. docs / CHANGELOG / README / 子方案 / 测试同步（贯穿，R12）

- **Goal**：四文档一致 + 测试全绿 + 双宿主 parity。
- **Requirements**：R12。
- **Dependencies**：U1-U11。
- **Files**：`CHANGELOG.md`、`docs/01-需求分析/13.scale集成/README.md`（v1.16 进展）、父方案 Phase E + **§9.0.1(登记 CON-CAP-001 + gate-lens producer + rule-maturity 豁免)**、CodeGraph 子方案、project-scaffold 子方案、相关 `tests/unit/*`(含 `dependency-readiness-baseline.test.js`、`scale-provider-doc-contracts.test.js`、`governance-contracts.test.js`)。
- **Approach**：CHANGELOG 按格式追加（作者读 `~/.spec-first/.developer` profile,当前为 leokuang，user-visible）；README v1.16 进展（未开始→进行中→已完成）；父方案 §9.0.1 **登记 `CON-CAP-001`**(consumer=spec-plan/spec-code-review/spec-debug、行为变化由 U10 断言捕获)消除 Summary 幽灵 id;父方案/子方案对齐；GBrain 删除表述一致；新增/更新 contract tests；`npm test` 全绿 + 双宿主 parity 回归。
- **Test scenarios**：`Covers R12.` `npm test` 全绿;新增 contract tests 通过;双宿主 prose parity 不回归;CHANGELOG 格式校验（若有 changelog-skill-contracts 测试）;**§9.0.1 含 CON-CAP-001 登记行**。
- **Verification**：四文档一致;全量测试绿;双宿主对称;CON-CAP-001 已登记。

---

## Requirements → Units 覆盖矩阵

| Requirement | Units |
| --- | --- |
| R1 Phase E 标题（P0-1） | U1 |
| R2 gate-lens 登记 producer + rule-maturity 豁免（原 P0-2 降 P2，B-1） | U2 |
| R3 code-graph↔code-structure（P1-3） | U3 |
| R4 CON-PROV-001 phase（P1-4） | U4 |
| R5 spec-runtime-setup 排期（P1-5） | U5 |
| R6 裂缝 A 轴 A 定位 | U6 |
| R7 provider-tools.json entry | U7 |
| R8 install-helpers 扩展 | U8 |
| R9 install gate + ladder | U9 |
| R10 capability-class 引导 | U10 |
| R11 复用 provider_untrusted | U11 |
| R12 同步 | U12（贯穿） |
| OQ-1~4 决议 | U3(OQ-1) / U6(OQ-2) / Scope+OQ-3(裂缝 B 不纳入) / U9(OQ-4 ladder 口径) |

---

## System-Wide Impact

| 受影响面 | 影响 | 单元 |
| --- | --- | --- |
| 父方案 / 子方案 / README（docs source-of-truth） | 治理 prose 收敛 + v1.16 进展 | U1/U2/U4/U5/U12 |
| `provider-tools.json` + 新建 registry schema + install-helpers（setup runtime install） | 真实代码增量，双宿主 | U7/U8/U9 |
| **host 级 MCP 配置**(`managed-mcp.json`/`$HOME/.claude.json`/`$HOME/.codex/config.toml`)+ `uninstall-mcp` | configure 写 host 级(非项目投影)、回滚走 uninstall-mcp;blast-radius host/user 级 | U8 |
| `spec-plan`/`spec-code-review`/`spec-debug`（workflow source） | 消费 prose +1 句引导，触发 runtime 重生成 | U10/U11 |
| generated runtime（`.claude`/`.codex`） | source 改动后需 `spec-first init` 重生成 | 合并后动作 |
| 用户大仓 target repo | install 后影响面分析增强（advisory） | 运行期价值 |

---

## Risk Analysis & Mitigation

- **RR-1 GitNexus 消费耦合复发**：最大风险。缓解=消费侧只认能力类别（U10 严禁工具名）、§7 四个复发早期信号写进验收、contract test `not.toContain('codegraph_'/'graphify')` + signal-4「缺失即 warn/降级/阻断」反向断言机器守护。**缓解非消除,且机器守护是必要非充分**——`not.toContain` 只拦字面工具名,GitNexus 真正死因向量(review-pre-facts 消费 provider 产物 schema、具名 public workflow、CI gate/allowlist 焊死)**不在本测试射程内**(R10/R11 也未碰),须靠后续 plan 评审守。
- **RR-2 CodeGraph v0.9.8 pre-1.0 命令漂移**：缓解=命令存 registry 数据 + `--help` 复核 flag 漂移 + **version_pin 钉已审版本**(S3,flag 漂移与版本 pin 解耦);持续维护成本诚实标注（中型任务）。
- **RR-3 裂缝 A 决策**：OQ-2 经二轮重解(provider 自报 fresh→`readiness_status=unknown`、自报 stale→`readiness_status=stale` 进既有 doctor/CON-PROV-001 决策链、`repo_aligned`/`limitations` 仅附带 + R10 强制新鲜度确认),给了 stale 一个**有 decision consumer** 的落点。最小只读探针仍 Deferred;若执行期引入会逼近「不代刷新」边界,需重新过 §7 信号。
- **RR-4 双宿主 parity 漂移**：install-helpers sh/ps1 + workflow prose Claude/Codex 投影,缓解=U8/U12 parity 断言 + smoke。**注意两宿主都无项目级 MCP scope**(B2/NEW-3:Claude managed/user、Codex user/system),parity 断言为「行为对称、scope 落点按宿主差异化」而非「落点完全相同」。

---

## 边界与反模式自检（落地前确认）

- [ ] 消费侧 prose 零工具名、零工具内部命令（`codegraph_callers`/`graphify` 不出现）。
- [ ] 不注入 routing/reminder/instruction block;不在 plan/work/review 运行期主动弹装。
- [ ] 不代刷新、不 silent 装 file-watcher hook、不重建并行 drift 检测。
- [ ] 不建 adapter envelope / fusion / 7 态机 / Context Intelligence Plane。
- [ ] 不新建第二套 evidence enum;复用 provider_untrusted 5 值。
- [ ] GBrain/外部 memory 不写成具名待集成 provider;memory 走 docs/solutions/。
- [ ] install 走既有 setup+gate（与帮装 gh/jq 同构）;消费 capability-aware 零耦合。
- [ ] configure 写 host 级 MCP 配置(非项目投影)、回滚走 `uninstall-mcp`(不靠 clean);prose 不出现「项目级 MCP」(两宿主都无,Claude managed/user、Codex user/system)。
- [ ] registry safety 含 version_pin / personal_scope / name_bin_mismatch;gate 文案 surface 供应链风险。
- [ ] 只改 source,不手改 generated runtime;合并后 `spec-first init` 修 drift。

---

## Test Plan

- **Contract tests**：新建 `provider-tools-registry.schema.json` + provider-tools.json 过该 schema + kind 过 provider-readiness enum（U3/U7）；`dependency-readiness-baseline.test.js` 空数组断言改写为两 entry 断言（U7/S1）；provider-readiness 轴 A 填值语义 + stale 落点断言（U6）；三 SKILL capability-class 引导 + `not.toContain` 工具名 + signal-4 反向断言 + 新鲜度确认 + 无新 enum（U10/U11）；install-helpers rung 可达 + host 级 configure + uninstall-mcp 回滚 + 双宿主 parity（U8/U9）；governance gate-lens producer 登记 + rule-maturity shadow 豁免（U2）；Phase E 标题 + CON-PROV-001 phase 的 `scale-provider-doc-contracts.test.js` 机器断言（U1/U4/SF-3）。
- **Smoke**：setup detect→gate→install 序列;install gate 安装阶梯(装≠配≠用)提示。
- **回归**：`npm test` 全绿;`scale-provider-doc-contracts` 不回归;`lint:skill-entrypoints` 通过;双宿主 prose parity。
- **fresh-source eval**（SKILL prose 变更，U9/U10/U11）：按 `docs/contracts/workflows/fresh-source-eval-checklist.md` 对改动 SKILL 做 fresh read-only reviewer;host 缺 dispatch primitive 时记录未执行原因。

---

## Direct Evidence

- target_repo: spec-first（当前仓）
- source_refs: `skills/spec-mcp-setup/provider-tools.json`(providers:[]空壳)、`skills/spec-mcp-setup/scripts/install-helpers.{sh,ps1}`、`docs/contracts/provider-readiness.schema.json:21`(kind enum 无 code-graph)、`docs/contracts/workflows/spec-work-run-artifact.schema.json:235`(readiness 5 值 enum)、`src/cli/helpers/setup-facts.js:283`(normalizeProviderReadiness 纯 enum 归一)、`src/cli/helpers/task-governance-signals.js:263/329`(gate-lens **有 producer**)、父方案 §8(Phase E 初评缺失,本轮已补标题)、`docs/contracts/governance/rule-maturity.*`(零消费,有意 shadow)、`CodeGraph技术方案.md`(全文)、评审报告(全文,P0-2 已回源码更正)
- current_revision: `3c8da872`（v1.15 提交后）；**批 1（U1-U5）已落地到 working tree 但未提交**(见下 worktree_dirty)
- worktree_dirty: **是**(二轮审查实证)。批 1 的治理 hygiene 已落盘且 `git status` 显示未提交 `M`:父方案 Phase E 标题(L1070)+ CON-PROV-001 v1.16 标注(L1160)+ rule-maturity §7.3 豁免登记(L1166)+ gate-lens producer 登记(L1165)、CodeGraph 方案 code-structure 映射注、README 重命名排期/收敛 gate、`scale-provider-doc-contracts.test.js` 已加 v1.16 收敛 gate 机器断言(green)。**故 U1-U5 执行时应先 disk-diff 幂等核对**(多为「核实已落盘 + 删残留误判表述」,非从零写)。未提交项:`CHANGELOG.md`/CodeGraph/README/父方案/`scale-provider-doc-contracts.test.js`(均 `M`)+ 评审报告/本 plan(`??`)
- discovery_methods: `grep`/`find`/`node -e JSON.parse`/`git log` 直接核验;评审报告 P0-1/P1-3/P1-4/P1-5/§5 论断独立复核属实;**P0-2 经 plan 审查 B-1 回源码复核发现初版 grep 漏扫 `src/cli/helpers/`、gate-lens 实有 producer,已更正并降为 P2**
- tests_or_logs: 上轮健康审查 1043 unit + E2E + smoke + mcp-setup(28) 全绿(v1.11-v1.13 有 commit;v1.14/v1.15 全绿为 CHANGELOG/commit 声称);本轮未重跑(plan 不执行),U12 起点应重跑锚定
- confidence: 中-高(治理前置 + Phase E + 术语漂移 + 现状均磁盘证实;B1/B2 边界问题经源码反证已修;裂缝 A/B 与运行期行为属设计判断)
- limitations: 裂缝 A/B 的运行期行为属设计判断,plan 阶段无法证实;CodeGraph/Graphify 精确命令需执行期 `--help` 复核;OQ-1/OQ-2 的执行期最终确认依赖当时 schema consumer 依赖检查;`recommended_gate_lenses` 字段是否有真实下游 workflow consumer 未逐跳核实(P2 follow-up)

---

## Implementation Validation / Review Follow-Up

本计划 `status: active`，待执行。规划依据：评审报告（已逐条 grep 核验）+ CodeGraph技术方案全文 + 父方案 Phase E + provider-tools.json/install-helpers/enum 现状直接核对。未手改 generated runtime mirrors。架构决策（OQ-1 术语取齐、OQ-2 裂缝 A 定位+stale 落点(经二轮重解)、OQ-3 裂缝 B 不纳入、OQ-4 ladder 口径）已在 plan 给出决议 + 执行期确认条件。

### Plan 审查修订记录（2026-06-06,第一轮 4-agent 审查后）

本计划初版经 4-agent 审查(plan-checker / 对抗 / 边界耦合 / 引用对账)后逐项修订:

- **B-1（推翻初版前提)**:R2/U2 初版「gate-lens 零 producer 零 consumer」错误,源于上游评审报告 grep 漏扫 `src/cli/helpers/`。`task-governance-signals.js:263` 实为 gate-lens producer。已把 R2 拆为「gate-lens 登记 producer(不豁免) + rule-maturity 登记 shadow 豁免」,P0-2 降为 P2,并同步更正上游评审报告 §1/§0/§7/§8 与 README 索引。
- **B-2（初版,已被二轮 NEW-1/NEW-2 取代)**:OQ-2「裂缝 A 降 advisory」与 schema(readiness_status 即新鲜度 enum、无轴 B 字段)自相矛盾,首轮重解为「readiness_status 一律写 unknown、installed-but-stale 经 `repo_aligned=no`+`limitations` 表达」。**此首轮解已被二轮推翻**(见下 NEW-1/NEW-2)——因 `repo_aligned` 无 decision consumer、unknown 不触 doctor warn,该解会造死代码。最终解见 NEW-1。
- **B1（边界)**:U8 初版「MCP 配置写项目级投影 + clean 回滚」与磁盘机制矛盾(configure-host.sh 写 host 级、clean.js 不碰 MCP)。已改为 host 级 configure + 回滚接 uninstall-mcp 分支,删「项目级投影/clean 回滚/零新增基础设施」。
- **B2（边界)**:初版「三层级别 / MCP 默认项目级」表述错误——二轮 NEW-3 以 `mcp-tools.json` scope 字段核实,**两宿主都无 project-level MCP scope**(Claude managed/user、Codex user/system),「默认项目级」对两宿主都不成立。已改为 scope 命名/落点差异表述,双宿主断言「行为对称、scope 落点按宿主差异化」,prose 断言不含「项目级 MCP」。
- **S1/S2**:U7 纳入 `dependency-readiness-baseline.test.js:149` 改写(防开工即红)+ 新建缺失的 `provider-tools-registry.schema.json`。
- **S3**:registry safety 加 `version_pin`/`personal_scope`/`name_bin_mismatch`,gate 文案 surface 供应链风险。
- **S-2（范围)**:批次拆分定位为 PR 切片建议(非两份独立 plan),本计划单批执行;批次「硬前置」措辞修正为「仅 R3+R6 是 install 技术硬前置」。
- **S-5**:显式记录 Evaluation Harness 度量债与角色契约 §7 张力。
- **CON-CAP-001 幽灵 id / 5-vs-8 ladder / SF-3 机器守护**:U12 登记 CON-CAP-001;OQ-4 澄清 ladder 口径;U1/U4 docs-only 验证升级为 `scale-provider-doc-contracts.test.js` 机器断言。
- **作者**:U12 改为读 `~/.spec-first/.developer` profile(不硬编码)。

### Plan 二轮审查修订记录（2026-06-06,2-agent 再审 + 源码反证后）

第一轮修订后再审(对抗 + 引用对账),发现首轮 B-2 修复引入新问题,并发现批次落地状态漂移。均经 Bash 回源码独立核实后修订:

- **NEW-1/NEW-2（推翻首轮 B-2 解,最高 severity)**:首轮 B-2「installed-but-stale 写 `repo_aligned=no` + readiness_status=unknown」经源码核实是死代码——`computeProviderCounts`(`setup-facts.js:385-389`)只按 `readiness_status` 计数、`computeDecisionInputHealth`(:437-439)warn 分支触发于 `{missing,stale,degraded}>0` **不含 unknown**、`repo_aligned` 仅 `verify-tools.{sh,ps1}` 当展示列读取**无 decision consumer**。**重解(R6/U6/OQ-2/Completion 已改)**:provider 自报 `fresh`→`unknown`(不冒充 deterministic);自报 `stale`→写 `readiness_status=stale`(夸低可用性不破 advisory),复活既有 `computeProviderCounts.stale`→doctor warn→CON-PROV-001 fallback 决策链;`repo_aligned`/`limitations` 仅附带,非 stale 唯一落点。
- **NEW-3（B2 精化)**:R9/U9 初版「MCP 默认项目级只适用于 Claude」错误——`mcp-tools.json` scope 字段证实两宿主**都无**项目级 MCP(Claude managed/user、Codex user/system),Claude 默认是 managed 非 project。已把差异更正为 scope 命名/落点,RR-4/Completion/System-Wide Impact/自检表同步去除「Codex 无项目级」的误导框架(改「两宿主都无」)。
- **R2-followup（引用对账)**:R2/U2 初版「在 §9.0.1 补一条登记 gate-lens producer」与磁盘矛盾——§9.0.1 L1165 **已登记**该 producer、L1166 已登记 rule-maturity §7.3 豁免。已把 U2 收敛为「核实既有登记准确 + 删残留误判表述 + 确认机器断言」,不重复写。
- **con-drift(批次落地状态,important)**:Direct Evidence 初版 `worktree_dirty: 否` 与 `git status` 矛盾——批 1(U1-U5)docs 改动**已落盘未提交**且 `scale-provider-doc-contracts.test.js` 已加 v1.16 收敛 gate 机器断言(实跑 green)。已改 `worktree_dirty: 是` + 列已落盘项 + 在 Implementation Units 头加「批 1 已落地、执行前 disk-diff 幂等核对」警示。
- **residual**:line 35 补「provider-tools-registry.schema.json 缺失」交叉引用;U7 Approach 明确 registry `kind` 字面写 `code-structure`(非 `code-graph`),Graphify 写 `project-graph`。
- **验证**:本轮所有 severity≥med 的源码论断(computeProviderCounts/warn 分支/repo_aligned consumer/mcp-tools.json scope/§9.0.1 既有登记/批 1 落盘)均经 Bash 实测核实,未盲信 agent findings;`scale-provider-doc-contracts.test.js` 实跑 2 passed。
