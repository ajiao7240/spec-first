---
artifact_kind: skill-comparison
status: complete
created: 2026-06-01
source_paths:
  - skills/spec-brainstorm/
  - skills/spec-prd/
evidence_grade: confirmed-source
---

# spec-brainstorm 与 spec-prd Skill 深度对比

## 结论先行

`spec-brainstorm` 和 `spec-prd` 都服务 `Codebase -> Graph -> Spec -> Plan -> Tasks -> Code -> Review -> Knowledge` 链路中的 **Spec 前置定义**，共同目标是让 `spec-plan` 不再发明 WHAT。但二者不是同一层能力：

| 结论 | spec-brainstorm | spec-prd |
| --- | --- | --- |
| 核心定位 | 通过协作式探索把模糊想法收敛为 right-sized requirements brief | 把已有系统增量、粗糙 PRD 或现有 PRD 校验为 PRD-grade requirements |
| 主要问题 | “我们到底要解决什么、做什么、不做什么？” | “在现有系统上，这个增量相对当前状态改了什么，证据够不够交给 planning？” |
| 适用域 | 软件 brainstorm，也可路由到 non-software universal brainstorming | Brownfield 软件/系统增量；已有产品/系统 surface 已锚定 |
| 交互形态 | 一轮一个问题，探索和收敛并重，Phase 2.5 必须先做 synthesis checkpoint | create/refine/validate 三种内部 intent，强调 current-state evidence、change delta、readiness |
| Artifact 强度 | 可轻可重；轻量场景可只留 brief 或不写文档 | 默认写 PRD-grade Markdown，带 `artifact_kind: prd-requirements` |
| 最大差异 | 发现并确定 WHAT | 校准 brownfield WHAT 与现状证据 |

如果要一句话区分：**brainstorm 是“需求发现器”，prd 是“brownfield 需求校准器”。**

## 分析范围与证据

| 证据层 | 已读取/核实 | 说明 |
| --- | --- | --- |
| 角色基线 | `docs/10-prompt/结构化项目角色契约.md` | 使用 Light contract、Explicit boundaries、Scripts prepare / LLM decides 作为判断基线 |
| Workflow 路由 | `skills/using-spec-first/SKILL.md` | 明确 brainstorm 与 PRD 的 tie-break；本次产物写入按 `$spec-work` 执行 |
| Source 文件 | `skills/spec-brainstorm/**`、`skills/spec-prd/**` | 逐层读取 `SKILL.md`、references、templates、evals、script |
| Governance | `src/cli/contracts/dual-host-governance/skills-governance.json`、`templates/claude/commands/spec/*.md` | 两者均为 dual-host public workflow command：Claude command、Codex skill |
| Tests | `tests/unit/spec-brainstorm-contracts.test.js`、`tests/unit/spec-prd-contracts.test.js` 等 | 对入口契约、template/runtime 打包、routing、readiness、glossary drift 有回归断言 |
| GitNexus | session-local `query` | graph facts 为 `dirty-advisory`，只作定位；结论以当前 source 直接读取为准 |

## 第 0 层：资产拓扑

| 维度 | spec-brainstorm | spec-prd | 差异含义 |
| --- | --- | --- | --- |
| 主入口 | `skills/spec-brainstorm/SKILL.md` | `skills/spec-prd/SKILL.md` | 都是 workflow orchestrator，不是内部 agent |
| Source 文件数量 | 6 个 | 14 个 | PRD 明显更工程化、模板化、验证化 |
| Source 行数 | 897 行 | 1724 行 | PRD 的额外复杂度主要来自模板、evidence、glossary script、eval |
| References | `handoff`、`requirements-capture`、`synthesis-summary`、`universal-brainstorming`、`visual-communication` | `intent-routing`、`current-state-analysis`、`domain-language-and-decision-ledger`、`domain-lenses`、`prd-output-template`、`prd-readiness-lens` | Brainstorm 拆交互与文档捕获；PRD 拆 intent、证据、模板、readiness |
| Templates | 无独立模板目录，模板在 `requirements-capture.md` 内 | `templates/standard/` 下有 generic/App/Admin/Backend/README | PRD 需要可打包、可复用的 PRD skeleton |
| Scripts | 无 | `scripts/check-glossary-drift.js` | PRD 增加确定性术语 drift 检测，但只产出 advisory facts |
| Evals | 无 `evals/` 目录 | `evals/examples.json` | PRD 有 fresh-source eval 用例上下文 |
| Artifact 路径 | `docs/brainstorms/*-requirements.md` | `docs/brainstorms/*-requirements.md` | 两者共用 Spec 链路入口目录，不新增 `docs/prds/` |
| Artifact 标记 | 普通 requirements frontmatter：`date/topic/spec_id` | PRD frontmatter：`spec_id/artifact_kind/target_surface/status/evidence_grade/created` | PRD 有更强 machine-readable contract |

## 第 1 层：入口契约对比

| Contract 字段 | spec-brainstorm | spec-prd |
| --- | --- | --- |
| When To Use | 产品行为、问题框架、用户目标、成功标准或边界仍开放，planning 会发明 WHAT | Brownfield increment PRD authoring、已有 PRD refine、code-aware PRD validation，且现有系统 surface 已锚定 |
| When Not To Use | 已 settled 的实现、debug、review、setup/update/runtime repair、窄事实查询 | 0-1 product exploration、产品形态未定、implementation planning、task execution、debug、PRD/Figma/source audit、轻量直接修复 |
| Inputs | feature idea、problem statement、模糊改进、已有 brainstorm、产品上下文、用户逐问决策 | increment request、existing PRD/draft、rough notes、source/docs evidence、current-system context、domain terms、owner decisions |
| Outputs | right-sized requirements doc 或 brief alignment summary | PRD-grade requirements、compact bypass/handoff、split-decision summary、validation/refine report |
| Artifacts | durable handoff 有价值时写 `docs/brainstorms/` | 默认 `docs/brainstorms/`，且 `artifact_kind: prd-requirements`；可有 split summary / child PRD |
| Failure Modes | 缺 feature description；合理提问后产品选择仍未解；非软件 universal flow；实际已 execution-ready | 缺 target surface；产品 identity 未解；现状 claim 无证据；owner decision 会改 scope；stale graph 被当 confirmed；planning 仍要 invent WHAT |
| Workflow | assess scope/domain -> focused questions -> synthesize -> write requirements -> hand off to planning | classify intent/input -> gather current-state evidence -> confirm change delta -> ask minimal questions -> draft/refine -> readiness -> handoff |
| Downstream Consumers | `spec-plan`、product owner、doc-review、future work/review | `spec-plan`、`spec-doc-review`、product owner、implementation reviewers、future work/review |

## 第 2 层：意图模型

| 维度 | spec-brainstorm | spec-prd |
| --- | --- | --- |
| Public model | 单一 brainstorm flow，内部按 software/non-software、scope tier 分支 | 单一 PRD workflow，内部 intent 为 `create` / `refine` / `validate` |
| 模糊输入处理 | 适合模糊、ambitious、multiple valid solutions 的需求发现 | 只适合已有系统锚点；0-1 或 identity 未解时 route out 到 brainstorm/ideate |
| 已清晰输入处理 | Phase 0.2 fast path：brief synthesis，可不强行长 brainstorm | Lightweight Bypass：compact PRD / plan / work 三选一，不强行完整 PRD |
| 非软件输入 | 有 `universal-brainstorming.md` 路由 | 不支持；PRD 是软件/系统增量 workflow |
| 已有文档输入 | 可 resume obvious recent matching requirements doc | 明确区分 `artifact_kind: prd-requirements`、普通 Markdown、plan/design/task、pure text |
| 大范围输入 | Deep feature/product tier；超过 15-20 requirements 触发拆分提醒 | Oversized initial PRD 走 split-decision gate，owner 确认后才写 split summary/child PRD |
| Wrong-stage 防护 | 已 execution-ready 时简短确认下一步，不强制 brainstorm | plan/design/task 文档不伪装成 PRD；PRD/Figma/source audit route to app-consistency-audit |

## 第 3 层：交互策略

| 维度 | spec-brainstorm | spec-prd |
| --- | --- | --- |
| 问题节奏 | 强约束：每轮一个问题；默认使用 blocking question tool | 最小阻塞；允许合并少量强相关问题，避免拆分浪费轮次 |
| 问题类型 | single-select 为主，multi-select 少用；诊断/内省问题用 prose | owner confirmation、scope/acceptance/current-state contradiction 决策问题为主 |
| AI 主动性 | thinking partner：提 alternative、challenge assumptions、what-if | PRD editor / validator：补 evidence、指出 gaps、给 evidence-backed default |
| 推荐答案 | narrowing/decision 问题应带推荐答案与理由；opening/rigor probe 不带 | source/user 冲突时给 recommended default，但让 owner 确认 |
| Rigor probes | evidence/specificity/counterfactual/attachment/durability 等，按 scope 和 engineering-evolution 例外触发 | bounded scenario grill：1-3 个具体场景，只在 domain 边界否则模糊时触发 |
| 对话出口 | Phase 2.5 synthesis 被确认后才写 durable doc | readiness outcome 决定 ready/revise/ask-owner/doc-review/route-out |

## 第 4 层：上下文与证据模型

| 维度 | spec-brainstorm | spec-prd |
| --- | --- | --- |
| Context scan 深度 | Lightweight 短扫；Standard/Deep 做 Constraint Check + Topic Scan | Phase 1 Current-State Analysis 是核心必经阶段 |
| Source-first 规则 | 涉及 checkable infrastructure 或 absence claim 时必须 direct read 或标未验证 | current-state、Change Delta、scope/acceptance/compliance claim 必须 evidence-tag |
| GitNexus 使用边界 | 只用 `query` / `context` / read-only resource 作为 session-local pointer；不默认用 impact/detect_changes/Cypher/rename | stale/dirty/definitions-only/impact-unavailable 时只能写 `gitnexus-pointer`，不能写 confirmed |
| Evidence tags | synthesis 区分 Stated/Inferred/Out of scope；doc 中用 Assumptions/Key Decisions 承载 | 明确枚举 `confirmed-source`、`user-stated`、`gitnexus-pointer`、`external-research`、`assumption` |
| Script-owned facts | 无专属脚本 | `check-glossary-drift.js` 只报告 `avoid_term_used` 字面命中；是否真 drift 由 LLM 判断 |
| LLM-owned judgment | scope tier、approach selection、readiness gate、handoff | intent classification、current-state scope relevance、contradiction resolution、readiness outcome |

## 第 5 层：Artifact 结构

| 文档结构 | spec-brainstorm requirements | spec-prd requirements |
| --- | --- | --- |
| Frontmatter | `date`、`topic`、`spec_id` | `spec_id`、`artifact_kind: prd-requirements`、`target_surface`、`status`、`evidence_grade`、`created` |
| Core sections | Summary、Problem Frame、Requirements、Success Criteria、Scope Boundaries；按 scope 触发 Actors/Flows/Acceptance/Key Decisions 等 | Summary、Change Delta、Requirements、Acceptance Examples、Scope Boundaries、Evidence And Assumptions |
| 关键新增 section | Phase 2.5 的 Stated/Inferred/Out of scope 会映射到 Summary/Requirements/Key Decisions/Scope Boundaries | Current System Snapshot、Glossary、Interaction Requirements、Exception Handling、Data/Compliance、Release/Operation Readiness 等 |
| ID 规则 | Standard/Deep 使用 R/A/F/AE；Lightweight 可不用 R-ID | 保留/续接 R/AE/BR/NFR；可保留项目本地 `US-*` / `FEAT-*` / `NFR-*` 作为 auxiliary trace |
| 模板策略 | 内嵌轻量模板，按 section matrix right-size | Packaged runtime template set + surface lenses + project-local overlay |
| 视觉辅助 | 条件触发 Mermaid/ASCII/table，强调概念层 | 主要依赖 PRD 模板/lens；视觉不是主轴 |
| 非目标 | 不写 implementation details，除非 brainstorm 本身是 technical architecture decision | 不写 implementation units、schemas、exact API fields、database tables、task breakdown |

## 第 6 层：Readiness 与质量门

| Readiness 维度 | spec-brainstorm | spec-prd |
| --- | --- | --- |
| 基础 gate | `requirements-capture.md` 定义 Requirements Readiness Gate | `prd-readiness-lens.md` 复用 brainstorm gate，不复制第二套基础维度 |
| 基础维度 | Clarity、Evidence provenance、Traceability、Testability、Boundary integrity、Planning-invention/handoff | 同左，作为 Base Gate |
| PRD 增强项 | 无 | 11 项 PRD-specific checks：current-state accuracy、change delta clarity、exception coverage、interaction readiness、evidence provenance、planning invention risk、terminology ambiguity、code-claim contradiction、hard-decision unresolved、vague-wording、priority-completeness |
| 分解判断 | size heuristic 提醒可能不是一个 brainstorm；gate 不决定 split | split-decision gate 处理 oversized initial PRD，owner 确认才写 split artifacts |
| 术语治理 | Domain Language ledger 可记录 term decision，但不管理项目级 glossary | 可读取 `docs/contracts/domain-glossary.md`，并用 drift script 给 advisory signal |
| 通过标准 | `spec-plan` 不需要发明产品行为、边界、成功标准 | `spec-plan` 不需要发明 actors、flows、acceptance、scope、priority、current behavior |

## 第 7 层：Handoff 行为

| Handoff | spec-brainstorm | spec-prd |
| --- | --- | --- |
| 入口菜单 | Phase 4 动态菜单：plan、doc-review、Proof、work、more questions、done | 不强调菜单；按 readiness outcome handoff |
| Plan handoff | 默认推荐 current host 的 plan entrypoint | ready-for-planning 时 hand off 到 current host plan workflow |
| Review handoff | 可直接进入 `spec-doc-review`，review 后回到 Phase 4 | broad/subtle risk 或 PRD 需要独立 critique 时 outcome 为 `doc-review` |
| Work handoff | 只在 direct-to-work gate 通过且 lightweight 时允许 skip planning | lightweight bugfix/settled task 可 bypass 到 plan/work，不强行 PRD |
| Proof | 支持 Proof HITL review | 未在 PRD 主契约中作为核心 handoff |
| Paused/blocked | `Resolve Before Planning` 非空时隐藏 plan/work，支持 paused summary | `ask-owner` / `revise-prd` / outstanding questions 明确阻断或风险 |

## 第 8 层：双宿主与 runtime delivery

| 维度 | spec-brainstorm | spec-prd |
| --- | --- | --- |
| Governance | `entry_surface: workflow_command`、`command_name: brainstorm`、`host_scope: dual_host` | `entry_surface: workflow_command`、`command_name: prd`、`host_scope: dual_host` |
| Claude delivery | `templates/claude/commands/spec/brainstorm.md` 元数据 + skill body 渲染 | `templates/claude/commands/spec/prd.md` 元数据 + skill body 渲染 |
| Codex delivery | workflow skill `$spec-brainstorm` | workflow skill `$spec-prd` |
| Source/runtime 边界 | 修改 `skills/spec-brainstorm/**` 和 template source，不能手改 `.claude/.codex/.agents` mirror | 同左；packaged templates 也属于 `skills/spec-prd/templates/standard/**` source |
| Tests | `spec-brainstorm-contracts.test.js` 锁定 GitNexus 边界、synthesis checkpoint、readiness gate、host wording | `spec-prd-contracts.test.js` 锁定 artifact_kind、governance、routing、templates、readiness、eval、glossary script |

## 第 9 层：路线图中的相互关系

| 关系 | 说明 |
| --- | --- |
| PRD 不是 brainstorm 的替代 | PRD 处理已有系统增量；当产品 identity/actor/outcome 未定时，应 route 到 brainstorm/ideate |
| PRD 复用 brainstorm 的 readiness 基础 | `prd-readiness-lens.md` 明确复用 brainstorm Requirements Readiness Gate，再追加 PRD checks |
| 两者共享 artifact 目录 | 都写 `docs/brainstorms/*-requirements.md`，避免新增 `docs/prds/` 第二拓扑 |
| 两者共同服务 plan | `spec-plan` 消费普通 requirements，也识别 `artifact_kind: prd-requirements` 的更强 PRD origin |
| PRD 引入更强证据纪律 | Current System Snapshot、Change Delta、Evidence And Assumptions、Glossary drift 均服务 brownfield accuracy |
| Brainstorm 保留更强探索能力 | Non-software universal flow、product pressure test、approach exploration、synthesis correction loop 是 PRD 不承担的能力 |

## 第 10 层：选择规则

| 用户输入/场景 | 应选 workflow | 理由 |
| --- | --- | --- |
| “我有个想法，帮我想想怎么做” | `spec-brainstorm` 或 `spec-ideate` | 问题框架、actor、value 仍开放 |
| “已有系统上增加一个 Admin 导出/审核/权限能力” | `spec-prd` | Brownfield surface 已锚定，需要现状 + delta + acceptance |
| “这份 PRD 能不能交给 plan？” | `spec-prd validate` 或 `spec-doc-review` | 如果重点是 PRD readiness/code-aware validation，走 PRD；如果是独立文档 critique，走 doc-review |
| “这份 PRD + Figma + 源码是否一致？” | `spec-app-consistency-audit` | PRD 明确 route out，不做跨 PRD/Figma/source consistency audit |
| “这是一个明确 bug，有复现和期望” | `spec-debug` 或 `spec-work` | PRD/brainstorm 都不应强行介入 |
| “非软件人生/活动/创意决策 brainstorm” | `spec-brainstorm` universal flow | Brainstorm 有 non-software facilitation reference |
| “已有 implementation plan/task pack” | `spec-work` | PRD 明确不把 plan/design/task 当 PRD source |
| “初始 PRD 过大，多模块多 release” | `spec-prd` split-decision | 需要 owner 确认 semantic split，再写 split summary/child PRD |

## 反模式清单

| 反模式 | 为什么错 | 正确边界 |
| --- | --- | --- |
| 把 brainstorm 当所有不清楚请求的默认入口 | `using-spec-first` 明确不要 blanket brainstorm-first | 按 immediate intent 路由；brownfield PRD 用 PRD，bug 用 debug，plan-ready 用 plan/work |
| 在 brainstorm requirements 写数据库表、接口字段、文件结构 | Brainstorm 负责 WHAT/WHY，会让 planning 被浅层实现细节绑架 | 技术实现进入 `spec-plan`，除非 brainstorm 主题本身就是架构决策 |
| 用 stale GitNexus 事实写 PRD confirmed current state | PRD evidence model 只允许 stale graph 作 pointer | 直接读 source/docs/tests 或标 `gitnexus-pointer` / `assumption` |
| 把普通 Markdown 当 `prd-requirements` 续写 | 会破坏 `spec_id`、R/AE ID、artifact contract | 普通 Markdown 只能作为 reference material |
| 给 PRD 新建 `docs/prds/` | 破坏 spec-first 单一 artifact 链 | 继续写 `docs/brainstorms/*-requirements.md`，用 `artifact_kind` 区分 |
| 让 `check-glossary-drift.js` 决定术语是否错误 | 脚本只做确定性字面命中 | LLM/readiness 判断引用、定义、讨论还是误用 |
| PRD 代替 app consistency audit | PRD 是 author/refine/validate，不是 PRD+Figma+source 多面一致性审计 | route to `spec-app-consistency-audit` |
| Brainstorm 跳过 synthesis 直接写文档 | 失去用户低成本纠偏窗口 | Phase 2.5 synthesis 必须先于 Phase 3 capture |

## 演化建议

| 建议 | 对 brainstorm | 对 PRD | 原因 |
| --- | --- | --- | --- |
| 不合并两个 workflow | 保留探索、对话、universal flow | 保留 brownfield evidence/template/readiness | 合并会让入口变模糊，增加上下文噪声和 ceremony |
| PRD 可继续复用 brainstorm gate | 作为基础 requirements readiness source | 在其上追加 PRD lens | 避免第二套基础 gate drift |
| Brainstorm 不应默认接入 PRD templates | 仅在技术/产品复杂度需要时 right-size | PRD 保持模板化 | Brainstorm 的价值在轻量探索，模板会增加 carrying cost |
| Domain glossary 可逐步让 brainstorm 作为 consumer | 读取 canonical terms 可减少术语漂移 | PRD 仍是 primary provider | `docs/contracts/domain-glossary.md` 当前路线图也暗示 brainstorm 未来可作为 consumer |
| PRD script 继续保持 facts-only | 无需新增脚本 | drift script 只报告字面事实 | 符合 Scripts prepare, LLM decides |
| Packaged templates 只留通用 surface | 不适用 | 保持 industry overlay project-local | 防止把行业规则误写成通用 runtime contract |

## 最小可维护结论

| 问题 | 建议答案 |
| --- | --- |
| 两者是否重叠？ | 有重叠：都产出 WHAT requirements，并阻止 plan invent；但重叠是链路接口重叠，不是职责重叠。 |
| 两者是否应该收敛为一个？ | 不建议。Brainstorm 是探索型；PRD 是 brownfield 校准型。职责边界清晰比入口数量减少更重要。 |
| PRD 是否只是更正式的 brainstorm？ | 不是。PRD 的核心不是“更正式”，而是 current-state evidence、change delta、surface lens、readiness 和 trace discipline。 |
| Brainstorm 是否可以产出 PRD？ | 只能产出 lightweight PRD-like requirements brief；如果需要 brownfield PRD-grade artifact，应 route 到 `spec-prd`。 |
| 对 plan 的最大价值差异是什么？ | Brainstorm 给 plan 稳定的 problem/scope/success criteria；PRD 给 plan 稳定的 current-state/delta/evidence/acceptance/priority。 |

## 验证状态

| 检查 | 状态 |
| --- | --- |
| Source files direct read | 已完成：入口、references、templates、evals、script 均已读取 |
| GitNexus | 已使用 session-local query；由于 graph facts `dirty-advisory`，未作为 confirmed evidence |
| Contract tests read | 已读取关键断言，未修改 skill source |
| Generated runtime | 未读取/修改 `.claude/`、`.codex/`、`.agents/skills/` mirror |
| CHANGELOG | 本文档写入需要同步追加 |

