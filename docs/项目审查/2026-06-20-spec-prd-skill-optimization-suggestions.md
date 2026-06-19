---
date: 2026-06-20
topic: spec-prd-skill-optimization-suggestions
source_skill: skills/spec-prd
review_method: yao-meta-skill
review_pass: yao-gate adversarial (8 gate / 22 raw finding → 14 refuted / 8 confirmed)
status: advisory
---

# spec-prd Skill 优化建议文档（yao-meta-skill gate 复审）

## 结论

`spec-prd` 不是“缺规则”的 skill，而是**已经成熟、且对 yao-meta-skill 工程意图高度对齐的精简范本**：164/170 行入口（同族最瘦）、4 个 trigger-gated reference、2 个边界清晰的 advisory 脚本、诚实的 `not_run` eval 纪律、contract test 机械锁死 topology 膨胀。

本次以 yao-meta-skill 的 skill-engineering 各 gate 为 rubric 做复审：8 个 gate 共产出 22 条原始 finding，对抗式验证（adversarial verify，默认倾向 REFUTE）**否决 14 条**——多为把 yao **打包件（standalone package）规范**硬套到**内部 workflow skill** 的 overreach，或源码中已覆盖；**确认/修订 8 条**。

核心判断：

- **不要回退**精简入口和 topology discipline——它们是这个 skill 最大的资产。
- **优先闭合 2 个 P1 证据/归属缺口**：缺 with-skill vs baseline output eval（打分器已存在，只缺对比 harness）；closeout 事实归属“半迁移”。
- 其余 6 条为 P2 健壮性/可审计性打磨，全部可在 170 行上限和 7 文件 + evals topology 锁内完成，无需触碰 `.claude/`、`.codex/`、`.agents/` mirror。

> **被本次对抗式验证否决的“看似缺口”（不要按它们改）**
> - 把 Trust Report / Runtime Permission Probes / Operations Loop / Registry lifecycle 列为 spec-prd 的待补 gate——这些是 yao **standalone 打包件**的发布 gate；spec-prd 是 dual-host **内部 workflow skill**，其可审计性已由 evals + contract tests + advisory scripts 满足。按打包件 gate 评判属 overreach。
> - 提交 `skills/spec-prd/evals/output/` baseline/with-skill 树——**无任何同族 skill 这么做**；本仓方法论 `docs/solutions/workflow-issues/routing-skill-eval-methodology-2026-06-08.md` 刻意把 eval artifact 留**仓外**作一次性证据。把它写进仓内 source 是反模式。
> - 给 spec-prd 加 per-skill `manifest.json` / owner / review-cadence 元数据——见 P2-5，属“第二套 artifact topology”，被 topology 锁与本仓优化文档禁止。

## 审查范围

源资产（source-of-truth，未读取/修改 `.claude/`、`.codex/`、`.agents/` generated mirror；graph/code-index 输出若用仅作 `provider_untrusted` navigation）：

- `skills/spec-prd/SKILL.md`（164 行，入口）
- `skills/spec-prd/references/{evidence-and-topology,prd-output-template,prd-readiness-lens,domain-language-and-decision-ledger}.md`
- `skills/spec-prd/evals/examples.json`（examples-as-context，约 50 case）
- `skills/spec-prd/scripts/check-glossary-drift.js`
- `skills/spec-prd/scripts/check-prd-artifact.js`（**第 7 source file**，2026-06-20 02:43 落地，CHANGELOG v1.11.4）
- `tests/unit/spec-prd-contracts.test.js`
- `src/cli/contracts/dual-host-governance/skills-governance.json`（spec-prd entry 仅描述 host delivery）
- `docs/validation/spec-prd/*.md`（fresh-source eval 记录）

rubric：yao-meta-skill `references/` 的 skill-engineering-method、resource-boundaries、output-eval-method、review-studio-method、prompt-engineering-doctrine、authoring-discipline、artifact-design-doctrine、skillops-decision-policy。

## Goals

- 让这个旗舰需求 skill **能证明**自己提升 PRD 输出质量，而不仅是 route 正确。
- 把可确定性计数的 closeout 事实从 LLM 自报迁移到 script-owned facts。
- 在不破坏精简入口与 topology discipline 的前提下，补齐 trigger 路由、size 度量、可发现性等健壮性面。
- 始终区分 script-owned deterministic facts 与 LLM-owned readiness judgment。

## Non-Goals

- 不新增 `docs/prds/`，不把 `spec-prd` 变成 planning / task execution / PRD-Figma-source audit workflow。
- 不暴露 readiness helper / reviewer / checker 为公开 workflow 或 agent type。
- 不为 PRD 建第二套目录、`manifest.json`、packet manifest、trace ledger 或仓内 `evals/output/` 树。
- 不把 source-candidate、Graphify/code-graph/retrieval hit 当作 confirmed-source。
- 不让 deterministic script 决定 `ready-for-planning`，不把 advisory 脚本结论升级为 hard release gate。

## 当前强项（必须守住，不得回退）

| # | 强项 | source 证据 |
| --- | --- | --- |
| S1 | **精简入口**：SKILL.md 164/170 行，同族最瘦；细节真正下沉到 4 个 trigger-gated reference（Reference Trigger Map） | `SKILL.md:73-80`；上限测试 `spec-prd-contracts.test.js:137` |
| S2 | **Topology 锁是可审计资产，非官僚主义**：钉死 7 source files + 4 reference + evals，机械阻断“文件越多越好”与 per-skill manifest 蔓延 | `spec-prd-contracts.test.js:112-127`；Core Principle 6「No second artifact topology」`SKILL.md:71` |
| S3 | **Scripts/LLM 边界画对且被测**：两脚本只出 `facts[]`/`reason_code`，从不裁决 `ready-for-planning`；都优雅降级；都被 `execFileSync` 对真实临时文件测试（非字符串守护） | script header `check-prd-artifact.js:4-5`；`prd-readiness-lens.md:22,64`；`spec-prd-contracts.test.js:807-988` |
| S4 | **诚实的 not_run eval 纪律**：fresh-source-eval 记录带 typed provenance，且被 contract 断言**不得**声称 `status: passed`；06-03 domain-grill 展示过真实 not_run→passed 晋升 | `spec-prd-contracts.test.js:752,782`；`docs/validation/spec-prd/fresh-source-eval-2026-06-03-domain-grill.md` |
| S5 | **scope/near-neighbor 纪律是强制非口号**：`code-align is validation posture, not a fourth public intent`；路由集中由 using-spec-first 拥有并被字符串守护 | `SKILL.md:113`；`spec-prd-contracts.test.js:540-552` |
| S6 | **artifact 先按类型路由再设计**：Output Shape 表 + Surface Lenses + Conditional Sections，domain-specific 标题，critique 不混入 durable requirements，placeholder/HOW/invented-metric 均有确定性守护 | `prd-output-template.md:24-35,51-88,193-208` |

## 经验证缺口（按 yao gate 分组）

### P1-1 · output-eval · 缺 with-skill vs baseline 输出评测

**gap**：唯一 eval 资产 `examples.json` 自述为 “Examples-as-context … not a runtime state machine”（`examples.json:3`）。它证明的是**路由/边界分诊**，从未证明 skill-guided 的 PRD 比无指引 PRD **更少**遗漏 current-state evidence / acceptance / scope / trace gap。yao `output-eval-method.md:3,7` 要求 production/library 级 skill 晋升前展示正向 with-skill vs baseline 信号。`spec-prd` 的核心质量主张（`SKILL.md:11`「让 spec-plan 无需发明产品行为」）**未被验证**——一次削弱 evidence-tagging 或 acceptance-trace 纪律的 prose 回退，会通过全部 contract test 却真实劣化输出。
**关键利好**：打分器**已存在**——`check-prd-artifact.js` 已输出 `core_section_missing`、`requirement_without_acceptance_ref`、`placeholder_or_todo_present`、`feature_slice_missing_acceptance_trace`（`check-prd-artifact.js:148-211`）。**只差对比 harness**。
**yao_principle**：「Output Eval Lab proves whether a skill improves the final user-facing result, not only whether it routes correctly … production and above should show a positive with-skill vs baseline signal before promotion」
**recommendation**：复用现有 `check-prd-artifact.js`（+ `check-glossary-drift.js`）作 deterministic 差值打分器，按本仓**已有方法论** `docs/solutions/workflow-issues/routing-skill-eval-methodology-2026-06-08.md` 把对比做成**仓外（out-of-repo）一次性证据**，**不**提交 `evals/output/` 树。约 5 个 case 偏向**强区分度硬场景**：PRD Sanitization 技术建议 vs 需求、REMOVE 的 Negative-Acceptance + Producer/Artifact/Consumer no-empty-shell、Feature-Slice 逐 slice acceptance trace、trace-gap 暴露、brownfield current-state-evidence；每个**多跑几轮**捕捉“纪律固着”方差（强模型上教科书 case 区分度低）。信号 = baseline 与 skill-guided PRD 之间 checker finding 数差值。**接受“无可落地 source 缺口”为合法结论**，不为凑 PR 强改 prose。
**smallest_surface**：仓外 eval run，复用两脚本作打分器；结果落 dated `docs/validation/spec-prd/` artifact。无需改 SKILL.md/reference/topology，不提交 PRD pair。

### P1-2 · scripts-determinism · closeout 事实归属“半迁移”

**gap**：Closeout Summary 要求 priority distribution、NFR count、assumption count、outstanding-question count 作 handoff 事实（`prd-output-template.md:287-290`；`SKILL.md:164`），但 `check-prd-artifact.js` 的 `facts{}`（`:197-208`）**一个都没算**——它已拥有更难的 requirement/acceptance 计数、`uncovered_requirements`、core sections、placeholder 计数、feature-slice trace gap。剩这 4 个计数**极易确定性化**（`NFR-\d+` 扫描；section 内表格行计数；Requirements 表内 priority token），却仍交给模型，导致**上报数字与文档漂移**。**半迁移比不迁移更糟**：它暗示这些计数已可信。
**yao_principle**：resource-boundaries scripts 放置准则——「deterministic, repetitive, brittle if rewritten from prose, easier to validate as code than as instructions」
**recommendation**：给 `facts{}` 增 `nfr_count`（unique `NFR-\d+`）、`assumption_row_count` 与 `outstanding_question_count`（各自 section 内表格数据行）、`priority_distribution`。**priority 计数务必 scope 到 Requirements 表 section**（复用现有 `sectionRange` helper）——全局 `P0/P1/P2` 正则会把 prose/Change-Delta/evidence 里的提及多计。Closeout 加一句：先以脚本 facts 播种计数，再叠加 LLM-owned 判断（planning 是否仍要发明 WHAT、accepted-risk）。**守硬线**：脚本只计数，**不得**标 blocker，**不得**输出 `ready-for-planning`。
**smallest_surface**：`check-prd-artifact.js`（加 4 字段 + helper，复用 `uniqueMatches`/`sectionRange`）+ `prd-output-template.md` Closeout 一句 + 扩展 `spec-prd-contracts.test.js:900-988` good-PRD 断言。SKILL.md 主体不增长。

### P2-1 · qualification-boundary · `validate` trigger 无 exclusion，却有已证实碰撞

**gap**：frontmatter description（`SKILL.md:3`）以 “or validate brownfield PRD-grade requirements” 结尾，argument-hint 含 “validation target”（`:4`），**无任何 exclusion**。skill 自己的 eval 已编码碰撞：`app-prd-figma-source-audit` 的 `intent:validate`、`input_shape: 'PRD plus Figma plus source consistency request'`、`expected: ['route to app consistency audit']`（`examples.json:152-158`）。消歧只活在 router **路由时不看**的地方：When-Not-To-Use 正文（`:25`）、using-spec-first tie-break、examples.json。
**blast radius 有界**：竞品 `spec-app-consistency-audit` 有强而独立的 trigger，三层防御兜底，最坏只是可恢复 misroute——故是**补齐唯一缺失那层**的健壮性加固，非 reliability blocker。
**yao_principle**：Phase 6 Trigger-First Authoring——「include exclusions when confusion is plausible」
**recommendation**：就地在 `SKILL.md:3` 追加 eval 已证实的**单条** exclusion，如：“… before implementation planning. Not for PRD-to-implementation/Figma/source consistency audits (use spec-app-consistency-audit).” 保持一句（不新增行；164/170）。**放弃** doc-review exclusion（eval 只证实 app-consistency-audit 碰撞，加 doc-review 属未证实扩张）。改后 `spec-first init` 重生 runtime，不手改 mirror。
**smallest_surface**：仅 `SKILL.md:3`。无 contract test 强制（唯一 PRD-description 字符串守护针对 command 文件，非 SKILL frontmatter）。

### P2-2 · trigger-description · description 相对同族过简，直连描述路由的宿主上欠触发

**gap**：spec-prd description（`SKILL.md:3`，约 130 字符，单句裸句）零 trigger 短语、零 exclusion；需求族每个兄弟都有（spec-plan ~700 字符含 “plan this”/“break this down” + spec-brainstorm exclusion；spec-brainstorm/spec-ideate 带 “Triggers on phrases like…”）。这**很大程度是刻意分工**——路由由 using-spec-first 拥有（`:222,229,246`）。残余风险只在**绕过 using-spec-first、按 description 文本路由的宿主**这一二阶场景，那里 “write a PRD”/“refine requirements” 可能漏给 spec-brainstorm/spec-plan。低成本族一致性 + 健壮性打磨，非活 mis-route。
**recommendation**：从正文上提一段紧凑 trigger+exclusion 进 description（仍守上限），并**与 P2-1 的 `validate` exclusion 同一行一起改**，两处 trigger 编辑作为一次落地。定位为低成本直连描述健壮性 + 族一致性。
**smallest_surface**：仅 `SKILL.md:3`，与 P2-1 合并为单次编辑。无 reference/script/test 强制。

### P2-3 · resource-boundary · size 守护只有行数，缺 doctrine 货币（token）口径

**gap**：doctrine 的 initial-load 预算是 **token** 制（library=1300，`resource-boundaries.md:17`）。按 yao 口径（len/4），SKILL.md = 13,768 字符 ≈ 3,442 token，约 library tier 2.6×。唯一强制 size 守护只锁**行数**（≤170，`spec-prd-contracts.test.js:137`），故入口可在满足行上限的同时 prose 变密、token 漂移而**不被察觉**——货币错配。
**注意**：超标**部分合理**——入口承载 dual-host governance prose + 4-phase contract surface，大量 load-bearing 且被 test 钉住；yao 本身对 body 重量是 warn-then-judge。可落地核心是**补对货币的度量**，不是强制约 62% 重写。
**recommendation**：在 `spec-prd-contracts.test.js` 行≤170 旁加一条确定性 char/word-proxy size 断言，并把行上限定位为粗代理。上限按**当前 load-bearing 内容现实地**设定，让守护抓**未来致密化漂移**而非逼重写。**不要**把 1300 当硬目标；仅对真正非路由 prose 做机会式精简。
**smallest_surface**：仅 `tests/unit/spec-prd-contracts.test.js` 加断言。无需改 SKILL.md。

### P2-4 · scripts-determinism · `check-prd-artifact.js` 在 SKILL.md 中不可见

**gap**：SKILL.md Phase 4 / Closeout（`:156-164`）要求 requirement count、acceptance count、trace gap，却**从不提** `check-prd-artifact.js`——而该脚本恰好算这些；它只在 trigger-gated reference `prd-readiness-lens.md:22` 可见。对照 `SKILL.md:143` **内联点名了兄弟脚本** `check-glossary-drift.js`——真实不对称。CHANGELOG v1.10.0（`:217`）记录本项目**刚为 glossary 脚本修过这个“脚本在 SKILL 主体零提及”的 discoverability gap**，如今对新脚本又重现。LLM 可全靠自报产出整个 closeout 而不知有确定性 checker。
**yao_principle**：resource-boundaries Heuristics——「SKILL.md should mention any optional directory/script that materially affects execution」
**recommendation**：在 SKILL.md Phase 4（约 `:157`）加一句 advisory，镜像 `:143` 的 glossary 措辞：当存在 PRD artifact 路径时，先跑 `scripts/check-prd-artifact.js <prd-path>` 播种确定性 closeout 计数与 trace gap，再由 readiness lens 裁决。保持 advisory（script-owned facts，LLM owns `ready-for-planning`），**非** gate。守 170 行（当前 164）。**与 P1-2 同批落地**（同一 Phase 4 closeout、同一脚本）。
**smallest_surface**：`SKILL.md` Phase 4 约 `:157` 一句，单行、在上限内。

### P2-5 · governance-lifecycle · 任何 lifecycle 元数据若要建，必须 once-central-advisory，绝不 per-skill

**gap**：这是**反过度工程的护栏，不是现在要修的缺陷**。yao `governance.md` 的 owner/cadence/maturity 元数据是为 standalone 打包 skill（per-skill `manifest.json`）写的；天真照搬会变成 per-`spec-*` manifest——正是 topology 锁（`tests:112-127`）和本仓优化文档明确禁止的“第二套 artifact topology”。约 18 个 `workflow_command` skill 共享同一 lifecycle 盲点，任何 per-skill 修法都是 18× surface 解决同一需求。standalone owner/cadence/maturity 三条原始 finding **已被对抗式验证否决**（yao 打包件 overreach；spec-prd 可审计性已由 evals + contract tests + scripts 满足）。值得钉住的只是**未来若建该面时的 HOW 约束**，以免后人用 topology-discipline 回退去换一个元数据缺口。
**recommendation**：**不要**给 `skills/spec-prd/` 加 `manifest.json`，**不要**加宽 dual-host delivery schema（其刻意 delivery-only，`additionalProperties:false`）。**若**未来真要 lifecycle 面，scope 为**单一 central advisory contract** 覆盖所有 `workflow_command` skill（spec-prd 先种），list/read-only，阻断阶段后置，显式**复刻仓内 `src/cli/helpers/rule-maturity.js` 先例**（record + list，advisory shadow-only，无 promotion 状态机）。最轻诚实兜底：把 spec-prd 的 owner+review_cadence+maturity_tier 作 tracked decision 记进本文档，日后复盘。两种路径都：`skills/spec-prd/` 零改动、delivery-schema 零改动。
**smallest_surface**：spec-prd source 零改动。若真要做：一份 central contract + registry + test（覆盖全 workflow），仿 `rule-maturity.js`；或在本文档记三字段。

### P2-6 · fresh-source-eval · 最高价值 prose 行为（PRD Sanitization + Feature Slices）停在 not_run

**gap**：PRD Sanitization（`SKILL.md:119-121`）与 Feature Slices（`prd-output-template.md:210-214`）是纯 load-bearing prose 语义——fresh-source eval 这一类正为防 cached-session 漂移而设——但其最近一次专项 eval（`fresh-source-eval-2026-06-05-sanitization-feature-slices.md`）诚实记为 not_run。06-03 domain-grill 记录证明在 Claude Code 宿主下可达成 passing dispatch。
**重要定性**：这里的 not_run 是 `fresh-source-eval-checklist.md` 规定的**合规、受治理状态**（dispatch 未授权时合法；禁止冒称 passed）——**可审计性成功，不是违规**。缺口只是两条最高风险行为的语义覆盖偏薄，待有 dispatch-capable 会话时可闭合。
**recommendation**：可选 follow-up，非质量违规。当存在暴露 dispatch primitive 的 Claude Code 会话时，派 fresh read-only general-purpose reviewer，只喂**当前磁盘**片段（SKILL.md Phase 1、prd-output-template Feature Slices、evidence-and-topology Calibration Source Boundary）+ checklist 问题，**不要**调用 spec-prd skill。若通过，写**新的 dated artifact**（如 06-03），**不要**覆盖 06-05，并**同步**更新 `spec-prd-contracts.test.js:782` 指向新通过 artifact（not_run 断言是 contract-pinned，“无需 source 编辑”说法有误）。在此之前保留 06-05 not_run 记录作合规边界。
**smallest_surface**：`docs/validation/spec-prd/`（加一份替代 dated 记录）；`spec-prd-contracts.test.js:782` 仅在出现 passing artifact 替换 not_run 引用时同步更新。除非 reviewer 发现漂移，否则无 SKILL.md/reference source 编辑。

## 建议落地顺序

1. **Batch 1（P1，最高价值，共享 surface）**：闭合 closeout 证据/归属缺口——给 `check-prd-artifact.js` 增 `priority_distribution`（Requirements 表 scope）+ `nfr_count` + `assumption_row_count` + `outstanding_question_count`，`prd-output-template.md` Closeout 加一句，**同一次**编辑顺带在 SKILL.md Phase 4 加一行指向 `check-prd-artifact.js`（P2-4 共享同一 Phase 4 closeout）。扩展 good-PRD contract 断言。一次让 closeout 既确定性又可发现。
2. **Batch 2（P1，仓外，无 source 风险）**：用增强后的 `check-prd-artifact.js` + `check-glossary-drift.js` 作差值打分器，跑约 5 个硬区分 case、多轮、仓外一次性证据，落 dated `docs/validation/spec-prd/`。接受“无 source 缺口”为合法结论。放在 Batch 1 之后，打分器已出更全 fact 集。
3. **Batch 3（P2，单行 trigger surface）**：一次性改 `SKILL.md:3`，合并 `validate` exclusion（→ spec-app-consistency-audit）与上提的 trigger+exclusion 子句，守 170 行；`spec-first init` 重生 runtime。两条 trigger finding、一次编辑。
4. **Batch 4（P2，仅 test 守护）**：在 `tests/unit/spec-prd-contracts.test.js` 加 char/word-proxy size 断言、现实上限，把行上限定位为粗代理。无 SKILL.md 改动。
5. **Batch 5（P2，延后/有条件）**：(a) 有 dispatch-capable Claude Code 会话时，跑延后的 sanitization/feature-slices fresh-source eval，写新 dated artifact 并同步 contract test；(b) governance 护栏仅作为**钉住的约束**——现在不建；若未来要 lifecycle 面，once-central-advisory、仿 `rule-maturity.js`。

## 反模式（明确不要做）

- 为把 SKILL.md 压到字面 1300-token library tier 而做约 62% 重写——入口合法承载 dual-host governance + 4-phase contract surface 且 load-bearing/contract-pinned；yao 对 body 重量是 warn-then-judge。**补度量，别上断头台**。
- 提交 yao 式 `skills/spec-prd/evals/output/` baseline/with-skill 树进仓——无同族 skill 这么做，本仓方法论刻意把 eval artifact 留仓外。
- 给 skill 加 per-skill `manifest.json` 或加宽 dual-host delivery schema 承载 owner/cadence/maturity——topology 锁与优化文档禁止的“第二套 artifact topology”。
- 把 Trust Report / Runtime Permission Probes / Operations Loop 等 yao **打包件发布 gate** 当作 spec-prd 待补项——spec-prd 是内部 workflow skill，按打包件 gate 评判属 overreach（本次已否决）。
- 给 40+ 条 examples.json case 加新 prompt 字段，或加第二个 route-confusion fixture——已否决，属重复 using-spec-first 集中路由真相源的未消费 prose。
- 把 Run-Local Decision Card 或 9 子节 Workflow Contract Summary 移出 SKILL.md——二者是 yao 规定放 SKILL.md 的 branch-selection/output-contract surface 且被 test 钉住（`tests:140-151,160-162`）。
- 把任何 `check-prd-artifact.js`/`check-glossary-drift.js` finding 升级为 hard release gate——二者按设计 advisory，readiness 裁决归 LLM。
- 声称延后的 fresh-source eval 是“docs-only、无 source 编辑”——not_run 断言 contract-pinned 于 `tests:782`；也**不要**把当前 not_run 重新定性为质量违规——它是规定的合规态。
- 手改 `.claude/`/`.codex/`/`.agents/` runtime mirror “刷新”行为——从 source 经 `spec-first init` 重生。

## 第一批最小 surface

```
skills/spec-prd/scripts/check-prd-artifact.js      # P1-2 加 4 个 fact 字段
skills/spec-prd/references/prd-output-template.md   # P1-2 closeout 一句
skills/spec-prd/SKILL.md                            # P2-4 Phase 4 一行 + (Batch 3) line 3 trigger
tests/unit/spec-prd-contracts.test.js              # P1-2 断言扩展 + P2-3 size 守护
CHANGELOG.md                                        # source 变更必更
```

## 本次落地记录

2026-06-20 按本报告完成第一批 source 优化:

- Batch 1: `check-prd-artifact.js` 新增 `priority_distribution`、`nfr_ids` / `nfr_count`、`assumption_row_count`、`outstanding_question_count` advisory facts。
- Batch 1 / P2-4: `SKILL.md` Phase 4 明确当 PRD artifact path 存在时先运行 `scripts/check-prd-artifact.js <prd-path>` 播种 closeout counts 与 trace facts,readiness 仍归 LLM 裁决。
- Batch 1: `prd-output-template.md` Closeout Summary 明确用 checker facts 播种确定性计数,再叠加 LLM-owned readiness judgment。
- Batch 3: `SKILL.md` description 收窄为 planning-readiness validation,并排除 PRD/Figma/source consistency audit 到 `spec-app-consistency-audit`。
- Batch 4: `tests/unit/spec-prd-contracts.test.js` 增加 entrypoint char-budget 守护,防止入口在 170 行内继续致密化漂移。
- Batch 2 smoke: 新增 `docs/validation/spec-prd/output-eval-2026-06-20-checker-delta.md`,记录 5 个 out-of-repo recorded fixture 的 checker delta。该记录不是 model-executed evidence,也不是 file-backed fixture evidence。
- Runtime refresh: source 验证后运行 `spec-first init --codex -y --lang zh`，由 CLI managed hard reset 并重生 Codex runtime mirrors；未手改 `.codex/` 或 `.agents/skills/`。

## 不要触碰

- `.claude/`、`.codex/`、`.agents/skills/` runtime mirror——generated，经 `spec-first init` 重生，绝不手改。
- `skills/spec-prd/` source topology 越过锁定的 7 source files + 4 reference + evals——不加第 5 reference、新脚本、`manifest.json` 或第二套 artifact 树（`spec-prd-contracts.test.js:112-127`）。
- `src/cli/contracts/dual-host-governance/skills-governance.json` 及其 schema——刻意 delivery-only（`additionalProperties:false`），不注入 lifecycle/maturity/owner 元数据。
- 170 行 SKILL.md 上限（`tests:137`）与 contract-pinned 入口面：9 子节 Workflow-Contract（`tests:140-151`）、前 120 行内 `input_posture`/`output_shape`/`quality_diagnosis` enum（`tests:160-162`）、Run-Local Decision Card、Core Principle 6。
- 诚实的 not_run fresh-source-eval 记录及其 contract 断言（`tests:752,782`）——不覆盖 06-05、不把 not_run 改标 passed（需真实 dispatch 重跑 + 同步改 test）。
- examples.json case schema（id/intent/input_shape/expected/coverage_tags）与其 examples-as-context scope——不加 prompt 字段或并行 route fixture。

## 验证记录

本审查与落地阶段已执行：

```bash
ls -la skills/spec-prd/scripts/                       # 确认 check-prd-artifact.js 已存在(02:42/02:43)
node --check skills/spec-prd/scripts/check-prd-artifact.js
node --check skills/spec-prd/scripts/check-glossary-drift.js
node -e "JSON.parse(require('fs').readFileSync('skills/spec-prd/evals/examples.json','utf8'))"
sed -n '106,135p' tests/unit/spec-prd-contracts.test.js  # topology 锁: 7 source files
npx jest tests/unit/spec-prd-contracts.test.js --runInBand
spec-first init --codex -y --lang zh
spec-first doctor --codex
```

结果：

- `check-prd-artifact.js` 确认已落地，为 contract-locked 第 7 source file；本次已补 priority/NFR/assumption/outstanding deterministic facts。
- 两脚本语法检查通过；`examples.json` 解析通过；topology 锁断言 7 source files + 4 reference，与本文档一致。
- `tests/unit/spec-prd-contracts.test.js`: 17/17 通过。
- `docs/validation/spec-prd/output-eval-2026-06-20-checker-delta.md` 记录 5-case recorded-fixture checker delta: baseline findings 26, with-skill findings 0。
- `spec-first init --codex -y --lang zh` 完成 managed runtime refresh；`spec-first doctor --codex` 全部 PASS。

**未执行**：本次未派 fresh-source reviewer；`docs/validation/spec-prd/output-eval-2026-06-20-checker-delta.md` 是 recorded-fixture smoke,不是 provider-backed model evidence 或 blind A/B review。

工作流证据：yao-gate 复审 8 gate / 22 原始 finding，对抗式验证否决 14、确认/修订 8（35 subagent，1 次 synthesis）。

## Changelog 判断

本文档与 `spec-prd` source / tests / validation artifact 均有修改,需更新根目录 `CHANGELOG.md`。本次通过 `spec-first init --codex -y --lang zh` 刷新 generated Codex runtime mirror,不手改 runtime source。
