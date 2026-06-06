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

兑现的可观察行为变化：`spec-runtime-setup` 帮装 provider（install 闭环；**验收分层:CI 验 registry/gate/lifecycle 结构断言,real-env 以 `query_verified=true` 验真可用——`installed=true` 不充当成功证明,详见 Completion Criteria 与 U9**）+ `spec-plan`/`spec-code-review`/`spec-debug` 的 capability-class 消费引导（U10 可观察）。其中消费侧的可观察行为变化由本计划在父方案 §9.0.1 新登记 `CON-CAP-001`(consumer=三 workflow、行为变化=prose 含 capability-class 引导句且经原生 MCP 不耦合,U10 断言捕获),不引用未定义合同。

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

### v1.16 install 侧实现主体（CodeGraph 方案 §3.1 / §8.1；**三轮审查 P1-B 架构决策:按安装形态分流**）

> **P1-B 决策（三轮架构审查）**:CodeGraph 本质是 **MCP server**,Graphify 是**纯 CLI**——两者安装形态根本不同,不应套同一条管线。源码实证:`install-mcp.sh`(685 行)+ `configure-host.sh` + `uninstall-mcp.{sh,ps1}` 已是 host 级 MCP install/configure/uninstall 的 **source of truth**(sequential-thinking/context7 走此路);`install-helpers.{sh,ps1}` 是**纯 CLI 装机器、零 MCP 概念**(`grep configure-host/mcpServers install-helpers.sh`=0)。把 CodeGraph 塞进 install-helpers 等于重造 install-mcp 已有的 configure/host 探测/scope/回滚,双宿主 parity 成本翻倍。**决策:按形态分流**——CodeGraph→install-mcp 管线(opt-in MCP entry),Graphify→install-helpers,index 单独承载。

- **R7.（install registry,按形态分流）CodeGraph 落 `mcp-tools.json`(opt-in MCP entry)、Graphify 落 `provider-tools.json`(CLI provider entry)。**
  - **CodeGraph(MCP)→ `mcp-tools.json`**:作为 **opt-in MCP entry** 落 `skills/spec-mcp-setup/mcp-tools.json`(schema v6,现有 sequential-thinking/context7 同结构:`installation`/`host_config`/`detection`/`project_bootstrap`)。**需放宽 `install-mcp.sh:594` 的 required-only 拒绝**(现状非 required tool 直接 `registry_not_required` failed),新增 `opt_in`/`explicit_consent` 准入位,使 CodeGraph 这类 optional MCP 可经既有 install-mcp 编排装。index(`codegraph init -i`)落 `project_bootstrap` 字段(该字段正为此设计)。
  - **Graphify(CLI)→ `provider-tools.json`**:纯 CLI 无 MCP configure,走 `install-helpers`/`provider-tools.json` 天然合身。detect 命令、install 命令、`safety`、fallback。
  - **(S2)`provider-tools-registry.v1` schema 文件当前不存在**,R7 必须先建 `docs/contracts/provider-tools-registry.schema.json`。**(跨切片修正)** schema root **必须显式声明 `generic_provider_readiness` 属性**——现有 `provider-tools.json` 顶层有 `schema_version`/`providers`/`generic_provider_readiness` 三键,若机械比照 `helper-tools-registry.schema.json`(`additionalProperties:false` 且只列 schema_version+helpers)会反而 reject 现有文件、撞 R7 自己的完成标准;且 `dependency-readiness-baseline.test.js:150` 硬断言该字段不可删。schema 须按 provider 实际语义裁字段,不机械照搬 helper 的 13 required 字段(profiles/surface_overlays 等 helper 专属语义勿强填 provider required)。`generic_provider_readiness` 的角色:无具名 entry 时的 generic 默认 readiness 词表,与 per-provider entry 并存不冲突。
  - **(G1 发布缺口,v1.14 教训复发)新建的 `provider-tools-registry.schema.json` 必须加入 `package.json` 的 `files` + `package-install-contracts.test.js` 断言**——`helper-tools-registry.schema.json` 已在 files(先例),provider 侧不加则安装后 schema 缺失、任何安装后校验崩溃,重演 v1.14 漏加 governance 致安装崩溃。
  - **(G2 校验执行点明示)** registry 的 schema 校验是 **test-time**(对标 helper:`dependency-readiness-baseline.test.js:112` 校验 helper registry 过 schema),`install-helpers`/`install-mcp` **运行时裸 jq 读不做 schema 校验**——plan 不得让读者以为运行时会拦不合规 entry;运行时只读取既有结构,schema 守护靠 contract test。
  - **(S3 供应链)`version_pin` 保留为结构化字段**(有确定性消费:install 取 pinned 版本作默认 install target,如 CodeGraph 0.9.8);**`personal_scope` / `name_bin_mismatch` 降为 `safety.risk_flags` 自由文本项**(对齐过度设计修正:它们是无外部对标的启发式提示、只服务单一个案,既有 helper safety 结构本就有 risk_flags 文本数组可承载,如 `['name-bin-mismatch:graphifyy->graphify','single-maintainer-bus-factor']`),gate 文案照样 surface,但不进 schema 一等字段。
- **R7b.（provider readiness PRODUCER,P1-A/P1-B 架构决策:按形态双路产出)新增 provider_readiness facts 的生产环节——这是 R6 复活的 stale 通路在真实管道里能点火的前提。**
  - **P1-A 实证**:`provider_readiness[]` 全链**只有 passthrough、从无 producer**(`detect-tools.sh` 产=0、`write-setup-facts.sh:131` 是 `($facts[0].provider_readiness // [])` 兜底、全仓零处构造 entry)。所谓「v1.11 既有产出」实际只是 schema+normalize+computeProviderCounts+doctor projection 这套**消费管道**,填充它的 source 从未建造。R6/U6 苦心复活的「stale→`computeProviderCounts.stale`→doctor warn→CON-PROV-001 fallback」在 `provider_readiness[]` 恒为 `[]` 时**全部不点火**——消费侧补齐了,producer 侧对称缺席。
  - **决策(P1-B 分流后双路 producer,四轮修订)**:P1-B 把 CodeGraph(MCP)与 Graphify(CLI)分流后,readiness 产出也必须分两路,但统一写入同一个 `provider_readiness[]`(消费侧 `computeProviderCounts`/doctor 不区分来源):
    - **Graphify(CLI)→ helper verify-only 产法**:`install-helpers.sh --verify-only`(现产 `helper_tools`,见 install-helpers.sh:926)对称扩展产出 Graphify readiness 探测结果。
    - **CodeGraph(MCP)→ MCP-side read-only detection / ledger / probe 产法**:CodeGraph **不经 install-helpers**(该线零 MCP 概念),其 lifecycle(`installed/configured/indexed/server_reachable/query_verified`)由 MCP 侧探测产出:installed/configured 复用 `detect-tools`/host config 读路径,indexed/server_reachable/query_verified 由 project_bootstrap/index 状态与 probe 读路径产出。注意当前 `install-mcp.sh` 没有 `--verify-only` 模式,执行期不得把「verify producer」误写成再次跑 install;若新增 install-mcp read-only verify 子命令,必须只读、不写 host config、不安装。
    - **汇聚点**:`verify-tools.sh`(:534 调 `install-helpers --verify-only` 拿 HELPER_JSON,:627 当前只 passthrough `provider_readiness`)从单纯 passthrough **扩展为合并 helper-source(Graphify)与 MCP-source(CodeGraph)两路** entry,统一按 R6 规则(detect 命中且自报 fresh→`readiness_status=unknown`、自报 stale→`readiness_status=stale`、填 lifecycle 布尔位)写入 readiness ledger / tool-facts。**不新建 provider 专属独立管线;Graphify 复用 install-helpers verify-only,CodeGraph 复用/新增 MCP 只读探测与 probe 聚合点。**
  - **end-to-end 断言(非手喂 fixture,双路覆盖)**:补「注册 provider 经 detect/verify 后 `provider_readiness[]` 非空、自报 stale 真能流到 `computeProviderCounts.stale`→doctor warn」的端到端测试,**Graphify(helper 路)与 CodeGraph(MCP 路)各覆盖一条**。U6 现有「手喂 `readiness_status=stale` fixture 测 computeProviderCounts+1」只测消费者、掩盖 producer 空洞,必须补真实管道断言。
- **R8.（install 执行,按形态分流)CodeGraph 复用 install-mcp/configure-host/uninstall-mcp,Graphify 扩 install-helpers;index 单独承载。**
  - **CodeGraph(MCP)**:install/configure(host MCP)/uninstall **复用既有 install-mcp 管线**(放宽 :594 开 opt-in 准入后),**不在 install-helpers 里重造** configure/host 探测/scope/回滚。configure 写 host 级(`managed-mcp.json`/`$HOME/.claude.json`/`$HOME/.codex/config.toml`),与 sequential-thinking/context7 同档;回滚走既有 `uninstall-mcp`。**(故障模式)configure 前置保护**:写入前若 host config 已存在同 id 但 command/args 不匹配的 entry(用户手工配过),**不静默覆盖**——gate 提示并要求显式同意覆盖或保留+skip(code-graph 是 power user 最可能已手配的工具,clobber 风险真实);补 contract/smoke 断言「预存不同 args 的同名 entry 在未确认时不被覆盖」。
  - **index(codegraph init -i)**:这步是既有管线没有的新动作,经 `project_bootstrap` 承载。**(故障模式)index 超时/半成品语义**:首次 index 在大仓可合法 >>900s(包安装超时),plan 明确 index 的超时来源(独立 env 或显式沿用并标大仓风险),且定义超时/OOM 后半成品 index 产物处置(标 `indexed=false` + next_action 指引重建/清理,不留模糊状态)。
  - **Graphify(CLI)**:扩 `install-helpers.{sh,ps1}` 读 `provider-tools.json` 执行 install。**(故障模式)`uv` 前置**:`uv tool install graphifyy` 的 `uv` 在 scripts 中零引用(与已知 jq 同类隐含前置)——detect 缺 uv 时 gate 提示先装 uv(给指引)或纳入帮装清单,fallback/next_action 覆盖 uv 缺失态。
  - **(执行模型注入面)** R7 把命令存 registry 数据,但现状 `run_install_command`(install-helpers.sh:322-355)是写死 case、registry 命令仅"展示近似"(lib-helper-registry.sh:47 明示执行真相源是 case)。U8 须**显式选执行模型**:沿用「每 provider 受控 case 分支(命令在脚本内,registry 只存 detect/safety/fallback 元数据)」,**不走 registry 命令串 eval**(避免「执行 JSON 里任意命令串」的注入面);若必须 registry-string 执行则固定 argv 数组/白名单/不做 shell 插值。
- **R9.（install gate + ladder）detect 缺失 → 过 install gate → 用户同意后装;CodeGraph 经 install-mcp gate、Graphify 经 install-helpers gate。** 触发只在 setup workflow,**不在 plan/work/review 主动弹**（§7 复发信号）。gate 提示说清「装≠配≠用」安装阶梯 + 供应链风险(无 pin / 个人维护 / 包名 bin 不一致,承 R7 risk_flags)。
  - **(可观测性)gate 状态可见+可重置**:对标 deep-research 指出的 Claude Code `reset-project-choices` + `Pending approval`/`Rejected` 模式,gate 须**下一个决策并写进 Completion**:(a) 记录 gate 选择(approved/rejected)+ 提供 reset 入口,或 (b) 显式声明 gate 为 setup-explicit-mode 下无状态重问并说明为何可接受。当前 silent undecided 是真实决策缺口。**(P2)该 reset 机制是 Claude 特有,Codex 侧等价口径见 U9 执行期确认项,不假设其在 Codex 成立。**
  - **(故障模式)ladder 中途断点续跑需持久化状态**:R8/U8「逐 rung 续跑」非既有能力——`install-helpers.sh:567-628` 单阶段、从不写/读 lifecycle 布尔位。U8/R7b 须设计:每 rung 完成后 lifecycle 布尔位写到哪个文件、下次 detect 从哪读回判定续跑起点、谁是 mid-ladder 状态 SoT;补断言「install 后 configure 失败→记 installed=true/configured=false,重跑从 configure rung 起、不重装 CLI」。
  - **双宿主 MCP scope(B2/NEW-3 实证)**:两宿主**都无 project-level MCP scope**——Claude 写 `managed`/`user`、Codex 写 `user`/`system`;gate 与 ladder **不得**出现「MCP 默认项目级」(两宿主都不成立);双宿主 parity 断言为「行为对称、scope 落点按宿主能力差异化」。
  - **ladder 口径与 display-only 定性**:用既有 `provider-readiness.v1` lifecycle 布尔位表达「装≠用」ladder,行使 `installed/configured/indexed/server_reachable/query_verified` 子集(`initialized/artifact_exists/fallback_used` 不参与,见 OQ-4)。**(跨切片对齐 NEW 标准)这 5 个 lifecycle 子集本身只 display/passthrough、无 decision consumer**(`setup-facts.js` 纯归一不据其决策、`verify-tools` 只展示部分、doctor 只看 `readiness_status` 派生的 `provider_counts`)——须像 `repo_aligned` 一样**显式定性为 display-only ladder 可读位、不进 decision path**;capability provider 唯一进决策的状态是 `readiness_status`。**(可观测性)`verify-tools` Provider tools 表当前只列 installed/configured/query_verified,漏 indexed/server_reachable** 两个 U8 显式处理的 CodeGraph 失败态对应 rung——U9 须补这两列,否则「卡在哪个 rung」对 index/server 失败答不出。
  - **(可观测性)query_verified 真达成验收**:Completion 不能只验「rung 可达」——须加 smoke 级验收:install+configure+index 后跑 registry 的 probe 命令,成功置 `query_verified=true` 并 surface(CI/离线跑不了则显式标注为 deferred-to-real-env 的唯一验收并点名它是 canonical「真可用」信号,区别于 `installed=true`)。这是 install-success 信号(机械、现可做),与 S-5 的 consumption-value eval 债(deferred)是两条轴,不可让 `installed=true` 默认充当成功证明。
  - **(可观测性)doctor 可见性 routing**:plan 反复把 `doctor.decision_input_health` 当 provider readiness 可见性背书,但实测 `doctor.js:72-98` text 模式只渲染 common/platform checks,`decision_input_health` **仅 `--json` 可见**。U9/U12 须二选一:把 provider warn 的 reason_code/provider_counts 渲染为一条 doctor text check,或显式声明「provider 逐 rung 诊断归 verify-tools setup ledger、doctor 只给 JSON rollup」并把 routing 写进 R4/Completion。

### v1.16 消费侧实现主体（CodeGraph 方案 §3.1 消费侧 / §2）

- **R10.（capability-class 引导）`spec-plan` / `spec-code-review` / `spec-debug` 各加一句 capability-class 引导。** 只认能力类别（code-graph / project-graph），**绝不写死工具名或工具内部命令**（`codegraph_callers`/`graphify` 不得出现在 prose——这是 §7 防 GitNexus 复发的承重墙）。装成 MCP 后工具在 Claude Code/Codex 工具层原生可见，LLM 直接调，**不经 instruction block 注入**。引导句句式见 §2：「若工具箱里存在 <能力类别> 能力，可在 <节点> 优先利用其产出作为 advisory candidate；缺失则走 fallback；任何此类输出都是 candidate，结论仍需 source/test/log/contract/user evidence 回源确认」。两处强化:
  - **(承 R6/B-2)新鲜度确认**:引导句须显式要求「采纳前先确认该能力产出相对当前 worktree 的新鲜度(provider 自报的 fresh 不构成 spec-first 确认)」——在无 spec-first 可信新鲜度位之前,防止把可能 stale 的图当 fresh 用。
  - **(承 S4 signal-4)never-block 语义**:引导句须含 never-block/缺失走 fallback,且**不得**出现「缺失即 warn/降级/阻断」措辞(advisory→confirmed creep 是 §7 复发信号 4);U10 测试补反向断言。
  - **(转述差异说明)CodeGraph §3.1 列 4 节点(含 knowledge),本计划只覆盖 spec-plan/code-review/debug 前 3 个**:knowledge 节点的 memory 能力走 `docs/solutions/`(v1.15),不是 code-graph/project-graph 能力,故有意不在此加 code-intelligence 引导,避免把 memory 能力与 code-graph 能力混淆。
- **R11.（复用 evidence enum）复用既有 `provider_untrusted` 记机械 readiness + 候选，不新建第二套 evidence enum。** 轴 A 复用现有 5 值 readiness enum，轴 B（advisory / evidence_candidate）是 workflow 语义晋升维度、不写进 readiness 字段。`readiness_status=fresh` 永不等于 confirmed（§5.2 两轴模型，与父方案 contract test 锁定一致）。**(跨切片澄清)never-block fallback 的双结构分工**:never-block fallback 的记录走**消费侧** `provider_untrusted`(本 R11),`provider-readiness.lifecycle.fallback_used` 是 **setup 侧** provider 自报/未来 producer 维度、**v1.16 不行使**——故 `fallback_used` 排除出 ladder 是对的,但须写清双结构分工(setup-side lifecycle vs consumption-side provider_untrusted),消除「fallback_used 看似该承载 never-block 实则孤儿」的歧义。

### 同步

- **R12.（文档/测试同步）** 父方案 Phase E / README 版本线（v1.16→进行中/已完成）/ CodeGraph 子方案 / project-scaffold 子方案 / CHANGELOG 同步；GBrain 删除表述一致（memory 走 `docs/solutions/`，不写成具名待集成 provider）；focused contract tests + `npm test` 全绿；双宿主 parity 回归。**(G1)新建 schema 加入 `package.json` files + 安装断言。**

---

## Scope Boundaries

**本计划做（v1.16）：** 治理前置（R1-R5）+ 裂缝 A 定位（R6）+ install 侧 registry/helpers/gate/ladder（R7-R9）+ 消费侧 capability-class 引导（R10-R11）+ 同步（R12）。

> **批次拆分:PR 切片建议,非两份独立 plan(plan 审查 S-2 + 二轮澄清)**:纯文档治理(R1/R2/R4/R5)与真实供应链 install(R7-R9,按角色契约 §8 是 provider 协议变更**大任务**)风险档、review 强度、可逆性完全不同,且 R1/R2/R4/R5 与 install **零技术耦合**(Dependencies 均为「无」)。真正的 install 技术硬前置只有 **R3 + R6**。**本计划仍是单一 plan 单批执行**(Implementation Units 按单 plan 列全);批次拆分是**落地时的 PR 切片建议**——若团队偏好,可把 R1/R2/R4/R5 切成轻量 docs-PR 先合(小任务 review),再以 install-PR 承载 R3+R6+R7-R11。**注意批 1(R1/R2/R4/R5)已落地 working tree(见 Direct Evidence),实际「步骤 1」多为核实落盘 + 提交,而非从零起草**。此处不设「执行前必须先拆」的硬 gate,只标明切片优先级。

> **install-PR 内部再切:CodeGraph-MCP 独立 review gate(四轮 P1-B 涟漪)**:install-PR 不应把 Graphify(CLI,中等任务)与 CodeGraph(放宽 `install-mcp.sh:594` MCP 准入口、影响所有 MCP 准入,按角色契约 §8 是 provider 协议变更**大任务**)混在同一 review 焦点。建议把 CodeGraph 的 `mcp-tools.json` opt-in entry / install-mcp 准入口放宽 / configure clobber guard / index lifecycle(U7 的 CodeGraph 分支、U8 的 MCP 分支、U9 的 MCP ladder)从 Graphify CLI 切片中**拆出为独立 review gate**;Graphify 先行验证整条 producer→consumer 通路(对应 RR-6 的 MCP 准入回归面、Deferred 区「先 Graphify 再 CodeGraph」建议)。此处仍不设硬 gate,但 CodeGraph-MCP 的 review 强度须按大任务对待。

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
- `docs/contracts/provider-tools-registry.schema.json` 已创建且**加入 `package.json` files + 安装断言**(G1);**CodeGraph 落 `mcp-tools.json` opt-in MCP entry、Graphify 落 `provider-tools.json` CLI entry**(P1-B 分流);Graphify kind 过 `provider-readiness` enum;schema root 显式含 `generic_provider_readiness`(不被 additionalProperties:false reject)（R3+R7+S2+G1）。
- `dependency-readiness-baseline.test.js` 的 `providers).toEqual([])` 改写为对 Graphify entry 的结构/kind/risk_flags 断言、保留 generic_provider_readiness:150 断言,填值不致开工即红（R7/S1）。
- **`provider_readiness[]` 有真实 producer 双路(R7b/U7b,P1-B 分流):Graphify 经 `install-helpers --verify-only`、CodeGraph 经 install-mcp 各 rung 探测,`verify-tools` 合并两路构造 entry 写入;end-to-end 断言「自报 stale 真流到 computeProviderCounts.stale→computeDecisionInputHealth warn」(非手喂 fixture,双路各覆盖一条),证明 R6 通路活、非死代码。**
- `CON-PROV-001` 与 `CON-READY-001` 同口径标注 consuming phase=v1.16 + v1.16 前停 advisory（R4）。
- README 版本线对 `spec-runtime-setup` 重命名有版本条目或「未排期/迁移期 alias」明确标注（R5）。
- provider-readiness 轴 A 填值责任在合同/代码钉死单一来源:provider 自报 `fresh`→`readiness_status=unknown`(不冒充 deterministic);provider 自报 `stale`→`readiness_status=stale`,进既有 `computeProviderCounts.stale`→doctor warn→CON-PROV-001 fallback 决策链(非死代码);`repo_aligned`/`limitations` 仅附带展示(R6/OQ-2,二轮 NEW-1/NEW-2 修正)。
- **CodeGraph(MCP)复用 install-mcp/configure-host/uninstall-mcp(放宽 :594 opt-in 准入 + `SKILL.md` L32/L38 source contract 同步重定义为「required baseline + explicit opt-in MCP」、无 `opt_in`/`explicit_consent` 位的 non-required MCP 仍被拒、configure clobber 保护不覆盖用户手配)、index 经 project_bootstrap(超时/半成品语义明确);Graphify(CLI)扩 install-helpers(uv 前置处理);执行走受控 case 非 registry eval**;ladder rung 可达;双宿主 parity「行为对称、scope 落点差异化」(两宿主都无项目级 MCP);过 install gate（R8/R9,P1-B）。
- **install gate 有状态决策(记录 approved/rejected + reset 入口,或显式声明无状态重问);ladder 续跑有持久化状态(configure 失败→重跑从 configure 起不重装 CLI);verify-tools Provider 表含 indexed/server_reachable 五列;lifecycle 5 子集定性 display-only(唯 readiness_status 进决策);query_verified 真达成验收(probe 成功置 true,或 deferred-to-real-env 标注);doctor 可见性 routing(text check 或 routing 声明)（R9,三轮可观测性）。**
- `spec-plan`/`spec-code-review`/`spec-debug` prose 含 capability-class 引导句、含新鲜度确认与 never-block 语义、**不含** `codegraph_*`/`graphify` 工具名、**不含**「缺失即 warn/降级/阻断」措辞、**不注入** reminder（R10,含 signal-4 反向断言）。
- 复用既有 `provider_untrusted`，无第二套 evidence enum;**`fallback_used` 双结构分工写清(never-block 走消费侧 provider_untrusted,setup 侧 lifecycle.fallback_used v1.16 不行使)**（R11）。
- 父方案 §9.0.1 登记 `CON-CAP-001`(consumer=三 workflow,行为变化可由 U10 断言捕获),Summary 不再引用未定义合同。
- `npm test` 全绿（新增 contract tests + 现有不回归）；双宿主 prose parity；CHANGELOG/README/父方案/子方案同步（R12）。

---

## Open Questions

### Resolved During Planning（架构决策拍板）

- **OQ-1（R3 取齐方式）→ 决议:v1.16 一律 prose 加映射注,收死分叉（四轮修订）。** 在 CodeGraph 方案 §2 或 §5.1 补「prose capability-class `code-graph` 映射到 provider-readiness `kind=code-structure`」。**理由**：零 source 改动、schema enum 不动、最小风险。**收死分叉(原「执行期可改 schema 增 `code-graph` enum」已撤销)**:schema 增 enum 触及 downstream 兼容 + 测试,属中型变更,**不得混进 install-PR**(违反抗膨胀原则);若未来确需字面统一,作为独立 follow-up work,不在 v1.16 切片内。registry 一律字面写 `code-structure`。
- **OQ-2（R6 裂缝 A 填值责任）→ 初版「降 advisory」与 B-2 解均自相矛盾,已按二轮 NEW-1/NEW-2 三度重解。** 初版说「provider 自报 fresh/stale 不进 readiness 字段」——但 `readiness_status` **就是**唯一新鲜度 enum、无独立轴 B 字段,「不进字段」无处落。B-2 改为「installed-but-stale 一律写 unknown + 用 repo_aligned=no 表达」——但二轮回源码实证(`computeProviderCounts:385-389` 只数 readiness_status、warn 分支 `:437-439` 不含 unknown、`repo_aligned` 仅 `verify-tools` 展示无 decision consumer)发现这会让 doctor stale 通路对 capability provider 变死代码、把 stale 路由到无人决策的字段、与 CON-PROV-001「stale→fallback」冲突。**三度重解(R6/U6 已写入)**:(1) provider 自报 `fresh` 不可信→`readiness_status=unknown`(不冒充 deterministic);(2) provider 自报 `stale` 可安全采信(夸低可用性、不破 advisory)→写 `readiness_status=stale`,复活既有 `computeProviderCounts.stale`→doctor warn→CON-PROV-001 fallback **deterministic 消费链**;(3) `repo_aligned`/`limitations` 仅作附带展示/说明,非 stale 唯一落点。**理由**:守「消费不耦合」红线 + 给 stale 一个**有 decision consumer** 的落点(非死代码) + 零新增机制。最小只读探针(artifact mtime vs git HEAD)仍是 Deferred,默认不引入,守 80/20。
- **OQ-3（裂缝 B 是否纳入 v1.16）→ 决议不纳入。** honest-closeout 的 `verified` 牙齿问题属 v1.13 自身诚实度，与 v1.16 capability-aware 主题正交。**理由**：避免 v1.16 范围蔓延；裂缝 B 是真实问题但有独立修复路径（限定 verified 语义 / 加 caller-independent 校验），作为 follow-up 单独处理更清晰。

- **OQ-4（5-vs-8 lifecycle ladder 口径,引用对账 SF-2 + 上轮评审 R4）→ 决议:ladder 行使 8 布尔位的明确子集。** provider-readiness schema 有 8 个 lifecycle 布尔位,本计划 ladder 行使其中 `installed/configured/indexed/server_reachable/query_verified` 子集,其余 `initialized/artifact_exists/fallback_used` 不参与本 ladder。**理由**:消除「说 8、列 4」的并列歧义(初版 U9 称「8 布尔位」但 Completion/R9 列 4-rung);8 是 schema 总数、子集是本 ladder 实际行使,二者不矛盾但须写清。已写入 R9/U9。

### Deferred to Implementation

- CodeGraph/Graphify 的精确 `lifecycle_commands`：v0.9.8 pre-1.0，落地时 `--help` 复核实际命令，存 registry 数据不硬编码（R7）。
- install gate 的 CodeGraph 默认拦截阈值表述：落地时按 unpinned-latest + 单人维护 bus-factor 的实际 safety 字段填（R9）。
- capability-class 引导句在各 workflow 节点的精确裁剪措辞：落地时按 §2 句式 + 各节点语境定（R10）。

---

## Implementation Units

> 批 1a = U1/U2/U4/U5（治理 hygiene,docs-only,与 install 零技术耦合,建议独立成轻量 docs-PR 先合,见 Scope 批次拆分）；批 1b = U3（术语对齐,虽形式上是 docs 改动但属 install 的 schema 校验前置,随 install-PR 或紧前于它落）；批 2 = U6（裂缝 A 定位决策落地）；批 3 = U7/U7b/U8/U9（install 侧实现,真实代码增量;**三轮 P1-B 已按形态分流:CodeGraph→install-mcp、Graphify→install-helpers**;U7b 是 P1-A 新增的 provider readiness producer)；批 4 = U10-U11（消费侧引导）；U12 同步贯穿。**install 实现的真实技术硬前置只有 U3(术语对齐防 schema 校验失败)+ U6(readiness 语义)**;U1/U2/U4/U5 是与 install 零技术耦合的治理 hygiene(Dependencies 均为「无」),不是 install 的编译期/校验期前置——初版「批1+U6 是 install 硬前置」措辞已按 plan 审查 SF-2 修正。U3 因此从「批 1 docs-only」析出为「批 1b install 前置」,消除与 Scope PR 切片(R3 归 install-PR)的归属冲突。**U7b(producer)是 R6 stale 通路真实点火的前提——无 producer 则 R6/CON-PROV-001 在真实管道里是死代码(三轮 P1-A)。**
>
> **⚠ 批 1 已落地状态(四轮 2026-06-07 `git log` 核实,执行前必读)**:U1-U5 的 docs 改动**已提交**(父方案/评审报告在 `4385a64a`、plan 在 `06041d55`,非「落盘未提交」——二轮「未提交」表述已过期),且 `scale-provider-doc-contracts.test.js` 已加机器守护(green)。各 U 下「Goal/Approach」按「从零写」语气写成,执行时应**先 disk-diff 幂等核对**——批 1 实际剩余工作量多为「核实已提交表述准确 + 删除评审报告/README/本 plan 残留的『两者都零 producer』等误判表述 + 确认机器断言」,**不要把已提交内容重写一遍**。

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
- **Files**：`docs/01-需求分析/13.scale集成/CodeGraph技术方案.md`（§2 或 §5.1 加映射注）。**(OQ-1 收死)不改 `docs/contracts/provider-readiness.schema.json`——schema 字面统一是独立 follow-up,不在本单元。**
- **Approach**：prose 映射注——在 CodeGraph 方案补「prose capability-class `code-graph` 映射到 provider-readiness `kind=code-structure`」;registry 一律字面写 `code-structure`。**(OQ-1 收死)本单元不动 schema enum**,不再保留「执行期可改 schema 增 `code-graph`」分叉(schema 增 enum 属中型变更,触及 downstream 兼容 + 测试,不得混进 install-PR)。
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
- **Approach**：README 版本线给该重命名分配版本条目，或显式标注「未排期,迁移期持续用 `spec-mcp-setup` alias,canonical 名 `spec-runtime-setup` 为目标命名」。本计划不做实体 rename。**(P1 命名边界)本 PR 不新增 `skills/spec-runtime-setup/**`、不新增 `templates/.../runtime-setup.md`,所有真实 source path/脚本/测试仍指 `spec-mcp-setup`;除非另起 rename work,prose 的 canonical 名仅为目标命名标注,不得诱导创建实体。**
- **Test scenarios**：`Covers R5 (machine-guarded).` 验证 README 含重命名排期或未排期标注;**(P1 命名边界反向断言)断言仓内不存在 `skills/spec-runtime-setup/` 目录与 `templates/**/runtime-setup.md` 文件(防 canonical prose 诱导创建实体)**。
- **Verification**：读者不再误以为 `spec-runtime-setup` 实体已存在;无 `spec-runtime-setup/**` 实体被提前创建。

### U6. provider-readiness 轴 A 填值责任钉死 + installed-but-stale 走既有 deterministic 通路（批 2，裂缝 A / R6，B-2 + 二轮 NEW-1/NEW-2 修正）

- **Goal**：终结「轴 A 两头都占」——明确填值责任,并让「装了但 index 过期」落到**有 decision consumer** 的既有通路,不变成死代码。
- **Requirements**：R6（OQ-2 重解）。
- **Dependencies**：U3（术语对齐后才好写 readiness 语义）；U4（软依赖:R6 的 stale 落点引用 U4 钉死的 CON-PROV-001「stale→fallback」口径,U4 应同批或先于 U6 落）。
- **Files**：`docs/contracts/provider-readiness.md`、`docs/01-需求分析/13.scale集成/CodeGraph技术方案.md` §5.2、`src/cli/helpers/setup-facts.js`（在 `normalizeProviderReadiness` 注释钉死「不探新鲜度、不把 provider 自报 fresh 写进 readiness_status」语义）。
- **Approach**：(1) **自报 fresh 不可信→不写**:工具存在/可达但 provider 自报 `fresh` 时 `readiness_status` 写 `unknown`,不把自报 fresh 写进去冒充 spec-first deterministic 判断;(2) **自报 stale 可安全采信→写 `readiness_status=stale`**:provider 自报 stale 是把可用性夸低、不破 advisory 红线,写入 stale 即复活既有 deterministic 消费链(`computeProviderCounts.stale`→`computeDecisionInputHealth` warn 分支→CON-PROV-001 fallback trigger),**不新增机制**;(3) `repo_aligned`/`limitations` 可附带填作展示/说明,但**不作 stale 的唯一落点**(它们无 decision-path consumer);(4) 在 provider-readiness 合同明示这套填值规则 + 「`fresh` 永不等于 confirmed」。守住父方案 contract test「readiness 只接受 5 值 enum」,**不新增字段、不引探针、不碰「不代刷新」边界**。
- **Test scenarios**：`Covers R6.` 断言合同含「`readiness_status` 不承载 provider 自报 fresh(自报 fresh→unknown) + 自报 stale→readiness_status=stale 进既有 doctor 通路 + fresh 非 confirmed」;单测断言 `normalizeProviderReadiness` 保持纯 enum 归一(不引入新鲜度探测逻辑),且对 `readiness_status=stale` 入参 `computeProviderCounts.stale` 计数+1(证明 stale 进决策、非死代码)。
- **Verification**：轴 A 不再「两头都占」;stale 落到有 decision consumer 的既有通路(非死代码、非零 consumer 展示字段);填值责任单一书面来源。

### U7. registry 按形态分流:CodeGraph→mcp-tools.json(opt-in MCP)、Graphify→provider-tools.json(CLI)+ 建 provider registry schema（批 3，R7，三轮 P1-B）

- **Goal**：按安装形态把两工具分流到正确 registry,并建缺失的 provider registry schema(含 G1 发布、generic_provider_readiness 纳入)。
- **Requirements**：R7。
- **Dependencies**：U3（kind 取值)、U6（readiness 语义)。
- **Files**：`skills/spec-mcp-setup/mcp-tools.json`(CodeGraph opt-in MCP entry)；**新建 `docs/contracts/provider-tools-registry.schema.json`**(S2)；`skills/spec-mcp-setup/provider-tools.json`(Graphify CLI entry)；**`skills/spec-mcp-setup/SKILL.md`**(P1#2:L32/L38 source contract 从「required MCP only」重定义,见 Approach)；**`package.json`**(G1:新 schema 加 files)；**`tests/unit/package-install-contracts.test.js`**(G1:新 schema 安装断言)；**`tests/unit/dependency-readiness-baseline.test.js`**(S1,L149/L150 `providers).toEqual([])` 与 generic 断言)；**周边 docs 分流旧口径修正**:`docs/01-需求分析/13.scale集成/README.md`、父方案、`docs/01-需求分析/13.scale集成/CodeGraph技术方案.md`；参考 `skills/spec-mcp-setup/helper-tools.json`、现有 `mcp-tools.json` sequential-thinking entry。
- **Approach**：
  - **CodeGraph→`mcp-tools.json`**:作为 opt-in MCP entry,沿用现有 schema v6 结构(`installation`/`host_config`/`detection`/`project_bootstrap`);index(`codegraph init -i`)落 `project_bootstrap`。需配合 U8 放宽 `install-mcp.sh:594` required-only 拒绝、加 opt-in 准入位。
  - **(P1#2 source contract 同步)改 `SKILL.md` source-of-truth prose**:当前 L32(registry of **required MCP servers**)、L38(**owns required MCP server definitions only** + Required helper tooling **must not** be added)是声明该契约的 source。加 CodeGraph opt-in MCP 必须把它重定义为「**required baseline MCP + explicit opt-in MCP capability entries**」,否则放宽 `install-mcp.sh:594`(脚本层)与 `SKILL.md`(source 契约层)自相矛盾——这是 source/runtime 边界遗漏,只改脚本不改声明契约的 source 不算闭合。
  - **Graphify→`provider-tools.json`**:CLI entry,`kind` 写 `project-graph`(已在 provider-readiness enum,无漂移);detect=`graphify --version`、install=`uv tool install graphifyy`、fallback=`docs/`/direct read。
  - **(S2)建 `provider-tools-registry.schema.json`**:schema root **显式声明 `generic_provider_readiness`**(否则 `additionalProperties:false` reject 现有文件、撞自身完成标准;`dependency-readiness-baseline.test.js:150` 断言该字段不可删);按 provider 语义裁字段,不照搬 helper 13 required;`kind` 引用 provider-readiness enum。
  - **(G1)** 新 schema 加入 `package.json` files + `package-install-contracts.test.js` 安装断言(helper schema 已在 files 是先例;不加则安装后缺失崩溃,重演 v1.14)。
  - **(S3)** `version_pin` 保留结构化字段(有确定性消费:install 取 pinned 版本);`personal_scope`/`name_bin_mismatch` 降为 `safety.risk_flags` 文本项(无外部对标启发式、helper safety 结构本有 risk_flags 数组可承载)。
  - **(P1#3 周边 docs 前置,四轮/五轮修订)写 install 代码前,先修周边方案 docs 的分流前旧口径**:README:79、父方案 §8 Phase E 交付正文、§8.1 相位表、**CodeGraph 子方案 §3.1/§8.1/成本说明等仍写「CodeGraph/Graphify 都填 `provider-tools.json` + 扩 install-helpers configure MCP」**(P1-B 分流前设计),会诱导执行人按旧路径实现。这部分**从 U12 析出、提前为 U7 前置或并行验收**,并加 doc-contract test(对标 `scale-provider-doc-contracts.test.js`)锁定「CodeGraph→mcp-tools.json/install-mcp、Graphify→provider-tools.json/install-helpers」,不等 U12 末尾兜底。
- **Test scenarios**：`Covers R7.` `provider-tools.json` 合法 JSON 且**含 generic_provider_readiness** 过新 schema;Graphify entry kind 过 provider-readiness enum;CodeGraph 在 mcp-tools.json 过 schema v6 + opt-in 位;新 schema 在 `pkg.files`(G1 正断言)+ npm pack 实际打包(G1 实测);`dependency-readiness-baseline.test.js` 的 `providers).toEqual([])` 改为对 Graphify entry 的结构/kind/risk_flags 断言、保留 generic_provider_readiness:150 断言;**(P1#2 反向断言)`SKILL.md` prose 含「required baseline + explicit opt-in MCP」重定义、不再是「required only」措辞**;**(P1#3 doc-contract)README/父方案/CodeGraph 子方案不再出现「CodeGraph 写 provider-tools.json」或「install-helpers configure MCP」旧口径,正向锁定 CodeGraph→mcp-tools.json/install-mcp、Graphify→provider-tools.json/install-helpers**。
- **Verification**：CodeGraph 在 mcp-tools.json、Graphify 在 provider-tools.json;新 schema 存在且随包发布;generic_provider_readiness 不被 schema reject;基线测试不红。

### U7b. provider readiness PRODUCER:双路产 provider_readiness[]（Graphify→helper verify-only、CodeGraph→MCP read-only probe）（批 3，R7b，三轮 P1-A + 四轮/五轮 P1-B 分流）

- **Goal**：建造 `provider_readiness[]` 的 producer(全链现无),让 R6 复活的 stale→doctor warn→CON-PROV-001 fallback 在真实管道里能点火,而非恒空死代码。
- **Requirements**：R7b。
- **Dependencies**：U6（R6 填值规则）、U7（registry entry）、U8（CodeGraph 的 MCP-source readiness 由 MCP 只读探测/project_bootstrap/probe 状态产出,与 U8 同源）。
- **Files**：`skills/spec-mcp-setup/scripts/install-helpers.sh`/`.ps1`(Graphify:`--verify-only` 对称扩展产 provider readiness,参照 :926 helper_tools 产法)；`skills/spec-mcp-setup/scripts/detect-tools.sh`/`.ps1`、`skills/spec-mcp-setup/scripts/install-mcp.sh`/`.ps1`、`configure-host.sh`/`.ps1`(CodeGraph:MCP installed/configured/index/probe 状态来源;若新增 read-only verify 子命令须只读)；`skills/spec-mcp-setup/scripts/verify-tools.sh`/`.ps1`(:534 调 helper verify-only、:627 现 passthrough provider_readiness→改为**合并两路**构造 entry)；`src/cli/helpers/setup-facts.js`(消费侧已就绪,只读)。
- **Approach**：**双路产出,统一写入 `provider_readiness[]`**:(a) Graphify(CLI)——`install-helpers.sh --verify-only` 对称扩展,对已注册 provider 做 detect + 自报新鲜度探测;(b) CodeGraph(MCP)——通过 MCP 侧 read-only detection / host config 读取 / project_bootstrap index 状态 / probe 命令聚合 lifecycle,**不经 install-helpers,也不得在 verify-only 语义下重跑 install/configure**;(c) `verify-tools.sh` 按 R6 规则**合并** helper-source 与 MCP-source 构造 entry(detect 命中→填 lifecycle 布尔位;自报 fresh→`readiness_status=unknown`;自报 stale→`readiness_status=stale`)写入 readiness ledger / tool-facts。**不新建 provider 专属独立管线;允许为 install-mcp 增加只读 verify 子命令,但它必须与 install/apply 路径隔离。**
- **Test scenarios**：`Covers R7b.` **end-to-end(非手喂 fixture,双路各一条)**:注册 provider entry → 经 detect/verify → 断言 `provider_readiness[]` 非空;构造「自报 stale」→ 断言 `readiness_status=stale` 真流到 `computeProviderCounts.stale` 计数+1 → `computeDecisionInputHealth` warn 分支触发(证明 R6 通路活、非死代码);自报 fresh → 断言写 `unknown` 不写 fresh。**Graphify(helper 路)与 CodeGraph(MCP 路)各覆盖一条端到端**;CodeGraph 路额外断言 read-only verify/probe 不安装、不写 host config、不覆盖 existing MCP entry;U6 手喂 fixture 测试保留但不足以替代。
- **Verification**：provider_readiness[] 有真实 producer;R6 stale 通路 end-to-end 点火;消费侧测试不再靠手喂 fixture 掩盖 producer 空洞。

### U8. install 执行按形态分流:CodeGraph 复用 install-mcp、Graphify 扩 install-helpers、index 单独承载（批 3，R8，三轮 P1-B）

- **Goal**：CodeGraph 走成熟 install-mcp 管线(不重造 MCP 能力)、Graphify 走 install-helpers、index 经 project_bootstrap 承载,并处理 configure clobber / index 超时 / uv 前置 / 执行模型注入面。
- **Requirements**：R8。
- **Dependencies**：U7。
- **Files**：`skills/spec-mcp-setup/scripts/install-mcp.sh`/`.ps1`(放宽 :594 required-only、加 opt-in 准入)、`configure-host.sh`/`.ps1`(clobber 保护)、`uninstall-mcp.{sh,ps1}`(CodeGraph 回滚分支)、`install-helpers.{sh,ps1}`(Graphify CLI install + uv 前置)、`lib-helper-registry.{sh,ps1}`。
- **Approach**：
  - **CodeGraph(MCP)**:install/configure(host MCP)/uninstall **复用 install-mcp/configure-host/uninstall-mcp**,放宽 `install-mcp.sh:594` required-only 拒绝、加 `opt_in`/`explicit_consent` 准入位,**不在 install-helpers 重造** configure/host 探测/scope/回滚。
  - **(故障模式)configure clobber 保护**:写 host config 前若已存在同 id 但 command/args 不匹配 entry(用户手配)→不静默覆盖,gate 提示显式同意覆盖或保留+skip;补断言「预存不同 args 同名 entry 未确认不被覆盖」。
  - **index(`codegraph init -i`)经 `project_bootstrap`**:**(故障模式)** 明确超时来源(独立 env 或显式沿用 900s + 标大仓 >>900s 风险);超时/OOM 后半成品 index 标 `indexed=false` + next_action 重建/清理,不留模糊状态。
  - **Graphify(CLI)→ install-helpers**:**(故障模式)uv 前置**——`uv tool install graphifyy` 的 `uv` 在 scripts 零引用(与 jq 同类),detect 缺 uv → gate 提示先装 uv(给指引)或纳入帮装,fallback/next_action 覆盖 uv 缺失。
  - **(执行模型注入面)** 沿用「每 provider 受控 case 分支(命令在脚本内,registry 只存 detect/safety/fallback 元数据)」,**不走 registry 命令串 eval**(避免执行 JSON 任意命令串注入面);现状 `run_install_command`(install-helpers.sh:322-355)正是写死 case、registry 命令仅展示近似(lib-helper-registry.sh:47)。
- **Execution note**：Start with a failing focused test for「CodeGraph routes through install-mcp opt-in admission (not install-helpers); Graphify routes through install-helpers; configure clobber guard refuses to overwrite mismatched user entry」.
- **Test scenarios**：`Covers R8.` CodeGraph 经 install-mcp opt-in 准入(断言不走 install-helpers configure);Graphify 经 install-helpers;configure clobber 保护;index 超时→indexed=false + next_action;uv 缺失 gate;sh/ps1 parity;命令来自受控 case 非 registry eval;过 install gate;**(P1#2/RR-6 反向断言)无 `opt_in`/`explicit_consent` 位的 non-required MCP 仍被 install-mcp 拒绝(`registry_not_required`),放宽不退化为「所有非 required 自动装」**。
- **Verification**：CodeGraph 复用 install-mcp(无重造)、Graphify 走 install-helpers;clobber 不静默;index 半成品语义明确;uv 前置处理;双宿主对称。

### U9. install gate(状态可见/可重置) + ladder 表达(展示补 indexed/server_reachable + display-only 定性 + query_verified 验收)（批 3，R9，三轮多项）

- **Goal**：gate 含状态可见/可重置决策 + 供应链风险;ladder 补展示缺口、定性 display-only、加 query_verified 真达成验收、doctor 可见性 routing。
- **Requirements**：R9。
- **Dependencies**：U8。
- **Files**：`skills/spec-mcp-setup/SKILL.md`(setup prose + gate 文案)、`skills/spec-mcp-setup/scripts/verify-tools.{sh,ps1}`(Provider tools 表补列)、`src/cli/commands/doctor.js`(可见性 routing,二选一)。
- **Approach**：detect → install gate(CodeGraph 默认拦截、显式确认)→ 同意提示说清「装≠配≠用」阶梯 + 供应链风险(无 pin/个人维护/包名 bin 不一致,承 R7 risk_flags)→ 装。触发只在 setup workflow。
  - **(可观测性)gate 状态可见+可重置**:下决策并写 Completion——(a) 记录 gate 选择(approved/rejected)+ reset 入口(对标 Claude Code `reset-project-choices`),或 (b) 显式声明 gate 为 setup-explicit 无状态重问并说明为何可接受。不留 silent undecided。**(P2 双宿主 Codex 口径)reset 入口不得只引用 Claude `reset-project-choices`:执行期须确认 Codex 侧等价 reset/forget 机制(若有)或显式声明「Codex 无等价机制→走 (b) 无状态重问」并说明可接受理由;双宿主 gate 状态 parity 与 MCP scope 同理——按宿主能力差异化,不假设 Claude 机制在 Codex 成立。**
  - **(故障模式)ladder 续跑状态**:与 U7b/R7b 联动——每 rung 完成后 lifecycle 布尔位写持久文件、下次 detect 读回判续跑起点、明确 mid-ladder SoT;断言「configure 失败→installed=true/configured=false,重跑从 configure 起不重装 CLI」。
  - **双宿主 MCP scope**:两宿主都无 project-level scope(Claude managed/user、Codex user/system);gate/ladder 不得出现「MCP 默认项目级」;parity 断言「行为对称、scope 落点按宿主差异化」。
  - **ladder 口径 + display-only 定性**:行使 `installed/configured/indexed/server_reachable/query_verified` 子集(`initialized/artifact_exists/fallback_used` 不参与,见 OQ-4)。**这 5 子集只 display/passthrough、无 decision consumer**——像 `repo_aligned` 一样显式定性为 display-only ladder 可读位、不进 decision path;唯一进决策的是 `readiness_status`。
  - **(可观测性)verify-tools 表补列**:Provider tools 表当前只列 installed/configured/query_verified,**补 indexed/server_reachable**(U8 处理的 CodeGraph 失败态对应 rung),否则「卡在哪个 rung」对 index/server 失败答不出。
  - **(可观测性)query_verified 真达成验收**:Completion 加 smoke 级——install+configure+index 后跑 probe,成功置 `query_verified=true` 并 surface;CI/离线跑不了则显式标 deferred-to-real-env 唯一验收 + 点名它是 canonical「真可用」信号(区别 `installed=true`)。与 S-5 consumption-value 债分开。
  - **(可观测性)doctor 可见性 routing**:`doctor.js:72-98` text 模式不渲染 `decision_input_health`(仅 --json)。二选一:把 provider warn 的 reason_code/provider_counts 渲染为 doctor text check,或显式声明「provider 逐 rung 诊断归 verify-tools ledger、doctor 只给 JSON rollup」并写进 R4/Completion。
- **Test scenarios**：`Covers R9.` gate 含阶梯+供应链风险+状态(approved/rejected 记录或无状态声明);detect→gate→install 序列;触发限定 setup;ladder 用既有子集不新增态;verify-tools 表含 indexed/server_reachable 五列;display-only 定性 prose;query_verified 验收(或 deferred 标注);doctor 可见性 routing(text check 或 routing 声明);双宿主断言 scope 落点差异化、prose 不含「项目级 MCP」。
- **Verification**：gate 有状态决策;ladder 5 rung 全可观察;display-only 定性一致;query_verified 真验收;doctor 可见;双宿主诚实。

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
- **Approach**：消费 prose 引用既有 `provider_untrusted.readiness_status`（5 值）记机械 readiness；轴 B（advisory/evidence_candidate）是 workflow 语义晋升、不写进 readiness 字段。不新建 enum、不造特例。**同步写清 `fallback_used` 双结构分工**:never-block fallback 的消费记录走 `provider_untrusted`(本单元),`provider-readiness.lifecycle.fallback_used` 是 setup 侧 provider 自报/未来 producer 维度,v1.16 ladder 不行使,不得把二者混成同一事实来源。
- **Test scenarios**：`Covers R11.` 断言消费 prose 引用既有 5 值 readiness enum、无新增 evidence enum 定义、含「fresh 非 confirmed / 轴 B 不回填 readiness 字段」表述;断言 prose 明确 never-block fallback→消费侧 `provider_untrusted`、setup 侧 `lifecycle.fallback_used` v1.16 不行使。
- **Verification**：无第二套 evidence enum;两轴模型与 §5.2/父方案一致;`fallback_used` 不再看似承载 never-block fallback。

### U12. docs / CHANGELOG / README / 子方案 / 测试同步（贯穿，R12）

- **Goal**：四文档一致 + 测试全绿 + 双宿主 parity。
- **Requirements**：R12。
- **Dependencies**：U1-U11。
- **Files**：`CHANGELOG.md`、`docs/01-需求分析/13.scale集成/README.md`（v1.16 进展）、父方案 Phase E + **§9.0.1(登记 CON-CAP-001 + gate-lens producer + rule-maturity 豁免)**、CodeGraph 子方案、project-scaffold 子方案、相关 `tests/unit/*`(含 `dependency-readiness-baseline.test.js`、`scale-provider-doc-contracts.test.js`、`governance-contracts.test.js`)。
- **Approach**：CHANGELOG 按格式追加（作者读 `~/.spec-first/.developer` profile,当前为 leokuang，user-visible）；README v1.16 进展（未开始→进行中→已完成）；父方案 §9.0.1 **登记 `CON-CAP-001`**(consumer=spec-plan/spec-code-review/spec-debug、行为变化由 U10 断言捕获)消除 Summary 幽灵 id;**父方案/子方案对齐——其中分流口径(CodeGraph→mcp-tools.json、Graphify→provider-tools.json)修正已按 P1#3 提前至 U7 前置并由 doc-contract test 锁定,U12 仅做最终一致性回归,不重复修**;GBrain 删除表述一致；新增/更新 contract tests；`npm test` 全绿 + 双宿主 parity 回归。
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
| R7 registry 按形态分流(CodeGraph→mcp-tools.json、Graphify→provider-tools.json)+ schema(P1-B/G1/S2) | U7 |
| R7b provider readiness producer(对称复用 helper verify-only,P1-A) | U7b |
| R8 install 按形态分流(CodeGraph 复用 install-mcp、Graphify 扩 install-helpers、index 承载)(P1-B) | U8 |
| R9 install gate(状态可见/重置)+ ladder(展示补全/display-only/query_verified/doctor 可见) | U9 |
| R10 capability-class 引导 | U10 |
| R11 复用 provider_untrusted | U11 |
| R12 同步 | U12（贯穿） |
| OQ-1~4 决议 | U3(OQ-1) / U6(OQ-2) / Scope+OQ-3(裂缝 B 不纳入) / U9(OQ-4 ladder 口径) |

---

## System-Wide Impact

| 受影响面 | 影响 | 单元 |
| --- | --- | --- |
| 父方案 / 子方案 / README（docs source-of-truth） | 治理 prose 收敛 + v1.16 进展 | U1/U2/U4/U5/U12 |
| **Graphify CLI 路径**:`provider-tools.json` + 新建 provider registry schema + `install-helpers`（setup runtime install） | 真实代码增量,双宿主,中等任务 | U7/U7b/U8/U9 |
| **CodeGraph MCP 路径(主路径源文件,P1-B)**:`mcp-tools.json` opt-in entry + `install-mcp.sh`(放宽 :594 准入) + `configure-host.sh`(clobber guard) + `uninstall-mcp` | provider 协议变更**大任务**;放宽 MCP 准入口影响所有 MCP 准入(RR-6) | U7/U8/U9 |
| **host 级 MCP 配置写入面**(`managed-mcp.json`/`$HOME/.claude.json`/`$HOME/.codex/config.toml`) | configure 写 host 级(非项目投影)、回滚走 uninstall-mcp;blast-radius host/user 级 | U8 |
| `spec-plan`/`spec-code-review`/`spec-debug`（workflow source） | 消费 prose +1 句引导，触发 runtime 重生成 | U10/U11 |
| generated runtime（`.claude`/`.codex`） | source 改动后需 `spec-first init` 重生成 | 合并后动作 |
| 用户大仓 target repo | install 后影响面分析增强（advisory） | 运行期价值 |

---

## Risk Analysis & Mitigation

- **RR-1 GitNexus 消费耦合复发**：最大风险。缓解=消费侧只认能力类别（U10 严禁工具名）、§7 四个复发早期信号写进验收、contract test `not.toContain('codegraph_'/'graphify')` + signal-4「缺失即 warn/降级/阻断」反向断言机器守护。**缓解非消除,且机器守护是必要非充分**——`not.toContain` 只拦字面工具名,GitNexus 真正死因向量(review-pre-facts 消费 provider 产物 schema、具名 public workflow、CI gate/allowlist 焊死)**不在本测试射程内**(R10/R11 也未碰),须靠后续 plan 评审守。
- **RR-2 CodeGraph v0.9.8 pre-1.0 命令漂移**：缓解=命令存 registry 数据 + `--help` 复核 flag 漂移 + **version_pin 钉已审版本**(S3,flag 漂移与版本 pin 解耦);持续维护成本诚实标注（中型任务）。
- **RR-3 裂缝 A 决策**：OQ-2 经二轮重解(provider 自报 fresh→`readiness_status=unknown`、自报 stale→`readiness_status=stale` 进既有 doctor/CON-PROV-001 决策链、`repo_aligned`/`limitations` 仅附带 + R10 强制新鲜度确认),给了 stale 一个**有 decision consumer** 的落点。最小只读探针仍 Deferred;若执行期引入会逼近「不代刷新」边界,需重新过 §7 信号。
- **RR-4 双宿主 parity 漂移**：install-helpers sh/ps1 + workflow prose Claude/Codex 投影,缓解=U8/U12 parity 断言 + smoke。**注意两宿主都无项目级 MCP scope**(B2/NEW-3:Claude managed/user、Codex user/system),parity 断言为「行为对称、scope 落点按宿主差异化」而非「落点完全相同」。
- **RR-5 producer 空洞致 R6 通路死代码(三轮 P1-A,最高)**：若 U7b producer 未落,`provider_readiness[]` 恒空、R6/CON-PROV-001 的 stale→fallback 永不点火,plan 的 readiness 消费层全部空转。缓解=U7b 对称复用 helper verify-only 产 entry + end-to-end(非手喂 fixture)断言「stale 真流到 computeProviderCounts.stale」。**这是 install 之外最易被当『既有产出』忽略的承重前提。**
- **RR-6 MCP 分流准入口放宽的回归面(三轮 P1-B)**：放宽 `install-mcp.sh:594` required-only 拒绝以容纳 CodeGraph opt-in,可能误让其他非 required MCP 被装。缓解=准入限定 `opt_in`/`explicit_consent` 显式位 + gate 同意,不放开「所有非 required 自动装」;补断言「无 opt-in 位的非 required tool 仍被拒」。configure clobber 保护(U8)防覆盖用户手配 MCP。

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
- [ ] registry safety 含结构化 `version_pin`;`personal_scope` / `name_bin_mismatch` 只作为 `safety.risk_flags` 文本项 surface,不进 schema 一等字段;gate 文案 surface 供应链风险。
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
- current_revision: `4ed42cb2`(五轮 2026-06-07 `git log` 核实;四轮修订已提交为 HEAD)；**批 1（U1-U5）+ 本 plan 四轮修订 + 评审报告均已提交**(父方案/评审报告在 `4385a64a`,四轮 plan 在 `4ed42cb2`)
- worktree_dirty: **是,但与 v1.16 plan 实现面无关**(五轮 2026-06-07 `git status --short` 核实):当前仅有 `docs/09-业界借鉴/2026-06-06-Harness-Engineering...md` 及同名 `.assets/` 未跟踪;本次五轮 plan/changelog 编辑期间会另显示 `M docs/plans/...` 与 `M CHANGELOG.md`,属当前修订预期。**执行 U1-U5 时仍应对已提交内容做 disk-diff 幂等核对 + 删残留误判表述,并在真正开工前重跑 `git status --short` 刷新 Direct Evidence,不要把无关 docs/09 资产误判为 v1.16 source 改动。**
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

### 外部证据校准（2026-06-06 deep-research,5 路搜索 + 3 票对抗验证,17 confirmed / 8 killed,全一手来源逐字）

对 plan 四维(UX/合理性/完整性/准确性)做 2025-2026 业界一手证据对标。**结论:四维方向全部被一手证据支持**,plan 当前措辞已天然规避两个易犯纠偏。

**支持方案的一手证据(强化 grounding,非新需求)**:

- 三层 scope ← VS Code(user profile / workspace)、Claude Code(Local/Project/User)官方文档,user-vs-project 选择是成熟模式。
- install consent gate + **可重置批准** ← Claude Code `claude mcp reset-project-choices` + `⏸ Pending approval`/`✗ Rejected` 状态。**对 R9/U9 的增量建议**:gate 不仅一次性同意,还应配套「批准状态可见 + 可重置」(plan 当前只描述首次 gate,执行期可参考此模式)。
- 供应链风险 advisory never-block ← gh CLI(扩展未认证、建议审计源码、不阻断安装)+ OpenSSF Scorecard(unpinned=Medium、缺活跃维护=High、90天每周≥1提交 deterministic 操作化)。印证 R7/R9「surface 风险但 never-block」。
- 解耦消费方向 ← MCP 2025-06-18:tools 是 model-controlled、tools/list 运行时动态发现、structured output(`structuredContent`/`outputSchema`)、resource links(URI 回源)。其中 structured output + resource links 是「advisory 回源(指回 source ref 不耦合 payload)」的**协议原生机制**,印证 R11 消费走结构化 advisory + 回源。
- code-graph 增益 ← KGCompass(SWE-bench Lite single-LLM 修复 SOTA 58.3%)、RepoGraph(plug-in 四框架平均相对 +32.8%,ICLR 2025)。为「大仓 advisory 增强」提供正向证据。

**三个纠偏(plan 已天然规避,落地与未来 prose 勿引入)**:

1. **MCP 协议级 capability negotiation 是 coarse/binary**(只协商「支不支持 tools 这一类」),**协议无语义级 capability-class 概念**(无「code-graph 能力类」)。6 条把 capability-class 挂到 MCP 协议原生协商的声明被 **0-3 全推翻**。plan/CG 现用「工具层原生可见 / 经原生 MCP 工具面」措辞——「capability-class」始终定位为 **spec-first 的 application-layer prose 抽象**(基于 tools/list 枚举 + description/inputSchema 检视),**未宣称协议原生**,正确。**勿在未来 prose 把 capability-class 说成 MCP 协议提供**。
2. **pinning 不防 typosquatting**(0-3 推翻):`version_pin` 防版本漂移 / dependency-confusion,typosquatting(graphifyy↔graphify)对策是包名校验(`name_bin_mismatch`)。plan R7/L73 已分列两者,正确——勿把 version_pin 当 typosquatting 对策。
3. **OpenSSF Maintained check 测活跃度非 maintainer 数量**,真正 bus-factor/单人维护对应 **Contributors check**(活跃单人项目在 Maintained 反而满分)。R7/R9 surface「单人维护 bus-factor」时勿误用 Maintained 信号,应走 contributor 数量维度。

**4 个 open question(无一手对标,并入 Deferred 度量债跟踪)**:

- `installed-but-stale` 的 deterministic 表达无直接业界对标(IDE/构建系统/code-index 工具如何建模暴露索引过期,本轮未覆盖)——R6/U6 的 stale 落点决策是 spec-first 自有推导,无外部同域背书(HTTP cache RFC9111 仅类比)。
- code-graph vs agentic grep+长上下文的增益边界无定论:一手论文停在 GPT-4/4o + SWE-bench Lite,RepoGraph 32.8% 是相对均值(per-framework 方差极大:RAG +99.63% vs Agentless +8.56%),无 2025-2026 前沿模型 head-to-head——印证 S-5 把 eval 列度量债的合理性,也是其缺口(small/large repo 分级阈值无精确外部依据)。
- typosquatting 检测与 surface UX 无一手最佳实践对标(`name_bin_mismatch` 是 plan 自创启发式)。
- uninstall/rollback UX 一手证据不足(gh/VS Code/Claude Code 文档重 install 轻 rollback)——R8 的 `uninstall-mcp` 回滚分支无外部 UX 对标。

外部证据详见会话记忆 `project_v116_external_evidence`。本校准不改 plan 的技术决策(均被支持或已规避),仅补 grounding 与 4 个 Deferred open question;不构成 plan 重写。

### Plan 三轮架构审查修订记录（2026-06-06,4 视角对抗 workflow:故障模式/可观测性/跨切片/过度设计）

前两轮聚焦措辞/一致性/证据 grounding。三轮从「装完之后端到端能否跑通」的架构完整性视角审,发现两个 P1(经源码核实)+ 一批 P2,并由用户拍定两个架构决策后重写 R7-R9/U7-U9、新增 R7b/U7b。

- **P1-A(producer 缺失,跨切片视角,conf 100)→ 决策:对称复用 helper verify-only**:源码实证 `provider_readiness[]` 全链只 passthrough、从无 producer(`detect-tools.sh` 产=0、`write-setup-facts.sh:131` 兜底、全仓零处构造 entry)。所谓「v1.11 既有产出」实为消费管道(schema+normalize+computeProviderCounts+doctor projection),填充它的 source 从未建造——R6/U6 复活的 stale→doctor warn→CON-PROV-001 fallback 在 `[]` 恒空时全不点火。**新增 R7b/U7b**:provider 走 `install-helpers.sh --verify-only`(对称 helper_tools 产法)→`verify-tools.sh` 按 R6 规则构造 entry 写入,补 end-to-end producer→consumer 断言(替代 U6 手喂 fixture)。
- **P1-B(MCP 管线错配,过度设计视角,conf 75)→ 决策:按安装形态分流**:源码实证 `install-mcp.sh`(685行)+configure-host+uninstall-mcp 已是 host MCP install/configure/uninstall 的 SoT,`install-helpers.sh` 零 MCP 概念(configure-host/mcpServers grep=0)。CodeGraph 是 MCP 却被塞进 install-helpers,需重造 MCP 能力、双宿主成本翻倍。**重写 R7/R8/U7/U8**:CodeGraph→`mcp-tools.json` opt-in MCP entry(放宽 `install-mcp.sh:594` required-only)、复用 install-mcp 管线、index 经 `project_bootstrap` 承载;Graphify(纯 CLI)→`provider-tools.json`/install-helpers。
- **P2 群(已并入相应 U)**:G1 新 schema 加 package.json files+安装断言(v1.14 教训复发)、G2 校验执行点明示 test-time(运行时裸 jq 不校验)、G3+uv 安装器前置、configure clobber 保护(不静默覆盖用户手配 MCP)、index 超时/半成品语义、registry 执行模型注入面(受控 case 非 eval 命令串)、gate 状态可见/可重置(对标 reset-project-choices)、ladder 续跑持久化状态机、verify-tools 表补 indexed/server_reachable、lifecycle 5 子集 display-only 定性(对齐 NEW 标准)、query_verified 真达成验收(区别 installed=true)、doctor text 可见性 routing、generic_provider_readiness schema 纳入(防 additionalProperties:false reject)、fallback_used 双结构分工澄清、name_bin_mismatch/personal_scope 降 risk_flags 文本。
- **可接受的 deferred(未改决策,记录)**:同批落两工具(建议先 Graphify 验证模式再 CodeGraph,但同批可接受)、detect 版本兼容校验、uninstall 部分回滚结构化状态、Graphify 的 artifact_exists 新鲜度位——均 deferred 到实现期判断。
- **验证**:两个 P1 经 Bash 源码核实(detect-tools 产=0、install-mcp.sh:594 required-only、install-helpers 零 configure-host、helper verify-only producer 模式存在);本轮为 plan 重构,`status: active` 仍未执行。

### Plan 四轮审查修订记录（2026-06-07,P1-B 涟漪收敛 + 文档一致性,11 项）

三轮拍定 P1-B 形态分流后,本轮聚焦「P1-B 决策的二阶影响是否扫干净」+ plan 文档自洽。用户逐条核到证据后修订 11 项(原列 12 项,GitNexus 负向空间测试经讨论判定为低 ROI 过度防御、撤销;RR-1 维持工具名断言 + 残余风险诚实标注)。统一根因:**P1-B 正文已重写,但 producer 落点、source contract、周边 docs、影响面表的涟漪未同步收敛**。

- **(文档缺陷)删重复块**:R10/R11/R12 连同小标题被粘贴两遍,删简版保完整版。
- **(P1-B 涟漪 1)producer 双路**:R7b/U7b 原只说 `install-helpers --verify-only`(仅 Graphify 路),CodeGraph(MCP)readiness 无 producer。改为双路——Graphify→helper verify-only、CodeGraph→install-mcp 各 rung,`verify-tools.sh:627` 从 passthrough 扩为合并两路;Completion 同步。
- **(P1-B 涟漪 2)source contract**:`SKILL.md:32/38` 仍写 `mcp-tools.json` owns required-only,与 CodeGraph opt-in 矛盾。U7/U8 加 SKILL.md 重定义为「required baseline + explicit opt-in MCP」+ 反向断言「无 opt-in 位 non-required MCP 仍被拒」。
- **(P1-B 涟漪 3)周边 docs 前置**:README:79、父方案 §8 Phase E/§8.1 相位表仍写「都填 provider-tools.json + install-helpers configure MCP」(分流前),从 U12 析出提前为 U7 前置 + doc-contract test 锁定分流。
- **(P1-B 涟漪 4)影响面表**:System-Wide Impact 拆为 Graphify CLI 路径 + CodeGraph MCP 路径(mcp-tools.json + install-mcp/configure-host/uninstall-mcp)两行,blast radius 对称呈现。
- **(切片)CodeGraph-MCP 独立 review gate**:Scope 批次拆分增设——CodeGraph MCP(放宽准入口、影响所有 MCP,大任务)从 Graphify CLI PR 拆出独立 review,Graphify 先行验通路。
- **(验收口径)Summary 收敛**:install 闭环验收明确分层——CI 验结构,real-env 以 `query_verified=true` 验真可用,`installed=true` 不充当成功证明。
- **(双宿主)Gate Codex 口径**:R9/U9 gate reset 不只引用 Claude `reset-project-choices`,加执行期确认 Codex 等价机制或显式无状态重问。
- **(命名边界)硬验收**:U5/R5 加反向断言——本 PR 不新增 `skills/spec-runtime-setup/**` 与 `templates/.../runtime-setup.md`,source path 仍指 `spec-mcp-setup`。
- **(抗膨胀)OQ-1 收死**:撤销「执行期可改 schema 增 `code-graph` enum」分叉,v1.16 一律 prose 映射、registry 字面写 `code-structure`,schema 字面统一作独立 follow-up。
- **(状态刷新)Direct Evidence 去过期**:`git log` 核实批 1(U1-U5)+ plan + 评审报告均已提交(`4385a64a`/`06041d55`),`worktree_dirty` 从「是」改「否」(仅 CHANGELOG.md modified),Implementation Units 头警示同步从「未提交」改「已提交」。
- **(撤销,非修订)GitNexus 负向空间测试**:经讨论判定为低 ROI 过度防御(真正死因向量难精确表达、易误报、高维护),不新增全仓结构性负向断言;RR-1 维持 U10 工具名 `not.toContain` 断言 + 残余风险诚实标注。
- **验证**:5 个证据点(`SKILL.md:32/38`、`verify-tools.sh:627`、`install-mcp.sh:594`、`README:79`、技术方案 `:1076/:1115`)+ git 提交状态均经 Read/Bash 实测核实;本轮为 plan 修订,`status: active` 仍未执行,U12 起点应重跑 `npm test` 锚定。

### Plan 五轮审查修订记录（2026-06-07,执行前收口 5 项）

四轮后再次按最新 source 逐项核对,发现若干「plan 已补但执行期仍易误读」的收口点,本轮仅修 plan/changelog,不执行 v1.16 代码实现:

- **CodeGraph readiness producer 口径收紧**:R7b/U7b 不再暗示 `install-mcp` 现成有 `--verify-only`;改为 CodeGraph 走 MCP-side read-only detection / host config 读取 / project_bootstrap index 状态 / probe 聚合,并要求若新增 install-mcp read-only verify 子命令,必须只读、不安装、不写 host config、不覆盖 existing MCP entry。
- **周边 docs 旧口径范围补全**:U7 的 P1#3 前置修复不只覆盖 README 与父方案,也覆盖 `CodeGraph技术方案.md` 中仍写「CodeGraph/Graphify 都填 provider-tools.json + install-helpers configure MCP」的旧路径;doc-contract 正向锁定 CodeGraph→mcp-tools.json/install-mcp、Graphify→provider-tools.json/install-helpers。
- **U11 执行单元补 `fallback_used` 双结构分工**:R11/Completion 已写的 never-block fallback→消费侧 `provider_untrusted`、setup 侧 `lifecycle.fallback_used` v1.16 不行使,同步进入 U11 Approach/Test/Verification,避免执行时漏掉。
- **旧字段残留清理**:自检表把 `personal_scope/name_bin_mismatch` 从一等字段口径改为 `safety.risk_flags` 文本项,与 R7/S3 一致。
- **Direct Evidence 刷新**:current_revision 更新为 `4ed42cb2`;worktree_dirty 改为「是,但与 v1.16 plan 实现面无关」,点名当前仅有 `docs/09-业界借鉴/...` 未跟踪项,并要求真正开工前重跑 `git status --short`。
- **验证**:本轮为 docs-source 修订;只读核验了 `git status --short`、`git log --oneline`、`install-mcp.sh` 无 `--verify-only`、`CodeGraph技术方案.md` 旧口径残留、`SKILL.md` required-only source contract 仍待执行期修改;未运行 `npm test`。
