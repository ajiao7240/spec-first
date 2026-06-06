# SCALE 集成方案索引

本目录用于收敛 `scale-engine` / `project-scaffold` / `scale-os-config-claude-code` 对 `spec-first` 的可借鉴能力，重点关注 dependency readiness、verification evidence、governance lens、Knowledge Harness 与 optional provider 的 source-first 内化。

2026-06-06 的深度调研后，本目录按两条路线阅读：

```text
v1.x 主线：spec-first 继续 owns CLI / source-managed runtime projection，
          把 SCALE 能力内化为 light contract + deterministic facts。

v2/spike 研究线：SCALE owns deterministic runtime，
                spec-first 降为 skill / agent / workflow content pack。
```

两条路线不能混写到同一实现方案里。v1.x 主线仍不复制 `.scale` runtime / hooks / FSM；v2/spike 若启动，则必须让 SCALE 单独 owning runtime，不能形成 `.scale` 与 `.spec-first` 双 runtime truth。

## 阅读顺序

| 顺序 | 文档 | 定位 |
| --- | --- | --- |
| 1 | `2026-06-06-强状态机vs轻合同行业实践调研报告.md` | 架构判断镜片，结论为「强运行底座 + 轻语义合同」；用于判断哪些能力该交给 runtime，哪些语义必须留给 LLM/workflow |
| 2 | `2026-06-06-scale底座替换spec-first可行性研究报告.md` | v2/spike 研究线，评估把 `scale-engine` 当运行底座、`spec-first` 降为 content pack 的可行性；不是 v1.x 直接实施方案 |
| 3 | `spec-first内化集成scale-project-scaffold技术方案.md` | v1.x 主线父方案，定义 source-first 内化边界、产物归属、版本路线和优先级 |
| 4 | `project-scaffold依赖安装流程与spec-first-setup优化技术方案.md` | v1.x setup / doctor / verification 子方案，细化 v1.11-v1.13 的 dependency readiness、install safety、verification profile 和 honest closeout |
| 5 | `CodeGraph技术方案.md` | v1.x capability-aware 协同子方案，核心边界「install 帮装、消费不耦合」：`spec-runtime-setup` 过 install gate + 用户同意帮装 code-graph / project-graph 能力工具（与帮装 gh/jq 同构），消费侧只认能力类别（不写死工具名、经原生 MCP、advisory 回源）、刷新归工具；含 `gh`/本地源码/`curl` 实测证据与「为何不重蹈 GitNexus」论证 |
| 6 | `2026-06-05-六层KnowledgeHarness分层合理性深度研究报告.md` | v1.15 Knowledge Harness 分层复盘，确认六层是协同地图，不是六个并行实现栈 |
| 7 | `2026-06-05-scale-engine架构思想对标spec-first可借鉴性深度研究报告.md` | 早期对标报告，用作历史分析输入；结论以父方案和 2026-06-06 两份新报告校准后的表述为准 |
| 8 | `2026-06-06-SCALE集成方案优化评审报告.md` | 对上述全部方案的优化评审（10-agent 并行：深读 + 对抗 + 一手 web 证据 + 计划-vs-真实仓库漂移核验）；结论为「方向站得住、需收敛后再推进」，P0 硬前置为 P0-1 Phase E 标题缺失；P0-2 经 v1.16 plan 审查回源码核实后降为 P2（`gate-lens-taxonomy.v1` 是 task/resource governance 的共享词表，不是 gate 执行器或孤儿 schema；`rule-maturity.v1` 是有意 shadow，含更正记录）；含 v1.16/spike 前瞻裂缝与三个高风险架构论点的一手证据裁决 |

`../bak/`（`docs/01-需求分析/bak/`）下文件只作为历史分析输入，不作为当前 source-of-truth。

## 路线关系

### v1.x source-first 内化主线

下列三份文档不是并行实现入口，应按“父方案定边界、setup 子方案先落地、optional provider 最后接入”的顺序进入开发。

| 开发顺序 | 文档 | 角色 | 实施时机 |
| --- | --- | --- | --- |
| 1 | `spec-first内化集成scale-project-scaffold技术方案.md` | 全局 source-of-truth，定义 goals / non-goals、版本线、artifact contract、source/runtime/provider 边界 | 所有切片开发前先以此文档校准范围；不直接跳过父方案进入子方案实现 |
| 2 | `project-scaffold依赖安装流程与spec-first-setup优化技术方案.md` | 第一批实现子方案,负责 dependency readiness、install safety、doctor consumption、verification profile 和 honest closeout | v1.11-v1.13 已落地;v1.11+v1.12 producer→consumer plan 与 v1.13 verification/honest-closeout plan 均已完成 |
| 3 | `CodeGraph技术方案.md` | 最后一批 capability-aware 协同子方案，确定 code-graph（如 CodeGraph）/ project-graph（如 Graphify）能力工具与 spec-first 的协同边界；memory 能力默认走 `docs/solutions/`、不集成外部 memory 工具（GBrain 删除） | 等 v1.11-v1.15 的 readiness、verification、governance 和 Knowledge Harness 基线闭合后，在 v1.16 再进入实现；不作为 v1.11/v1.12 通用 readiness 槽位的实施依据 |

因此，开发入口不是“先做 CodeGraph”，而是先完成从父方案抽取出的 v1.11+v1.12 最小可维护切片，再逐步推进到 verification/governance/knowledge/provider。

### v2/spec-first-on-scale 研究线

2026-06-06 两份新报告不改变 v1.x 已完成和已规划的内化主线。它们新增的是一条单独研究线：

```text
SCALE owns deterministic runtime:
  hooks / gates / checkpoint / evidence / permission / recovery / setup

spec-first owns semantic content:
  skills / agents / workflow entrypoints / artifact contracts / knowledge promotion boundary
```

这条线只有在单独 spike 中验证，不直接进入 v1.11-v1.17 版本表，也不允许把 SCALE hook/FSM 逐步塞进 v1.x 主线。若启动，第一步应是只读 manifest / projection dry-run，而不是删除 `src/cli/**` 或运行 `scale init`。

启动 v2/spike 前必须先有 `spec-first-on-scale-v2-spike.md` 或等价 kill-criteria artifact，并同时满足三道门：

- **Evaluation 指标 gate**：不能只做 capability parity；必须预先定义 closeout 诚实度、review 漏判率、debug 命中率等至少一个可观察增益指标。parity 通过但指标不改善时关闭该线。
- **零 SCALE source/schema 耦合门禁**：spike 前不得向 `src/`、`docs/contracts/` 或 checked-in source 写入 SCALE-specific schema / pack manifest / evidence mapping；这些只能先停留在隔离 spike artifact。
- **runtime-without-FSM 能力确认**：必须先确认 SCALE 能提供不绑定 FSM/G0-G22/hook blocking 的 deterministic runtime；拿不到即默认重定义为 OPT-B（SCALE 仅作为 optional provider），而不是 OPT-C 换底座。

## 开发顺序

当前一致性校准后的推荐版本线：

> 开发进展取值：`未开始` / `计划中`（已拆 plan/tasks 未实现）/ `进行中`（实现中）/ `已完成`（实现 + 对应版本 gate + 测试通过）/ `阻塞`。进展必须基于真实 source/测试状态如实更新，不得用方案定稿冒充实现进展。

| 版本 | 主题 | 主要依据文档 | 范围 | 开发进展 |
| --- | --- | --- | --- | --- |
| v1.11 | Dependency Readiness Baseline | 父方案 + project-scaffold 子方案 | helper/provider registry、`tool-facts.v2` normalizer、configured dependency scan facts producer、install safety、status renderer | 已完成（plan：`docs/plans/2026-06-04-001-feat-dependency-readiness-baseline-plan.md`；与 v1.12 同切片；`npm test` 通过） |
| v1.12 | Host Projection / Doctor Consumption | 父方案 + project-scaffold 子方案 | `init` generation report、`doctor.decision_input_health`、`decision_input_health_basis`、setup/configured dependency facts consumption | 已完成（同上 plan；`doctor --codex --json` 已从 `tool-facts.json` 计算 `decision_input_health` 并输出 basis） |
| v1.13 | Verification + Honest Closeout | 父方案 + project-scaffold 子方案 | `verification-profile.v1`、`verification-run-summary.v1`、`honest-closeout.v1`、run artifact ref mapping | 已完成（plan：`docs/plans/2026-06-04-003-feat-verification-honest-closeout-plan.md`；commit `3fc4dbda`；`spec-work-run-artifact` bump v2；`npm test` 通过） |
| v1.14 | Governance Lens Foundation | 父方案 | task-governance-signals、resource governance、`gate-lens-taxonomy.v1` 共享词表（被 `task-governance-signals.recommended_gate_lenses` 与 `resource-governance-lens.items[].lens_family` 使用，不是 gate 执行器）、`rule-maturity.v1` schema/docs-only shadow 例外（无 producer/helper，v1.17 前不做 promotion/blocking） | 已完成（plan：`docs/plans/2026-06-05-001-feat-governance-lens-foundation-plan.md`；focused governance tests + `npm test` 通过） |
| v1.15 | Knowledge Harness | 父方案 | context budget、artifact-summary、`docs/solutions` promotion、memory recall boundary；skill/tool capability lens 降为 advisory follow-up（设计已经 deep-research best-practice 对抗验证：4 支柱有一手背书、整体 sound、无 blocking flaw；plan 已答父方案 Phase D 的 OQ-1~4） | 已完成（plan：`docs/plans/2026-06-05-003-feat-knowledge-harness-plan.md`；新增 `docs/contracts/knowledge/knowledge-harness.md`，铺开 summary-first handoff / recall boundary，扩展 spec-compound schema + verified promote gate，focused tests/typecheck/skill-entrypoint lint 通过，fresh read-only reviewer findings 已修复；L5 不计 completion gate） |
| v1.16 | Capability-aware 协同 | 父方案 + CodeGraph 子方案 | **「install 帮装、消费不耦合」**：`spec-runtime-setup` 过 gate + 用户同意帮装 CodeGraph（prose capability class：`code-graph`；`provider-readiness.kind`：`code-structure`；经 `mcp-tools.json` opt-in entry + `install-mcp` 配 MCP + 首次 index）+ Graphify（`project-graph`，CLI；经 `provider-tools.json` + `install-helpers` 帮装，生成由用户触发、产物当 doc 读）；消费侧只认能力类别、经原生 MCP、advisory 回源、刷新归工具；memory 走 `docs/solutions/`、**GBrain 删除**；消费侧不注入编排面/不建 adapter/fusion | 进行中 |
| v1.17 | Governance Maturity | 父方案 | RuleMaturity required-evidence candidate、governance ROI、resource/output hardening | 未开始 |

v1.11+v1.12 已作为同一 P0 producer→consumer 切片完成,v1.13 verification / honest-closeout 已在独立 plan(`docs/plans/2026-06-04-003-...`)中落地并兑现 `spec-work` closeout 的可观察行为变化;v1.14 Governance Lens Foundation 与 v1.15 Knowledge Harness 已完成;下一步开发应推进到 v1.16 capability-aware 协同及后续版本线,不直接从三份方案跳进实现。

### 进入 v1.16 前的评审收敛 gate

v1.16 不能只按版本表进入 `provider-tools.json` 实现。启动第一个 provider entry 前，必须先完成或显式登记以下收敛项：

- **Phase E 标题补齐**：父方案 §8 必须有 `## Phase E：Capability-aware 协同（code-intelligence 能力工具）`，把现有 provider-coupling 孤儿正文收编到正式章节。
- **code-graph / code-structure 映射**：文档 prose 可继续用 `code-graph` 表示 capability class，但 `provider-readiness.v1.kind` 的 schema 取值是 `code-structure`；v1.16 registry entry 必须按 schema 写 `kind: "code-structure"`。
- **CON-PROV-001 enabling infra 口径**：provider readiness 已由 `doctor.decision_input_health` 作为 direct rollup 消费，但 named workflow 的行为改变 consuming phase 是 v1.16；v1.16 前只能标 advisory，不得宣称已兑现 workflow 价值。
- **provider freshness 填值责任**：进入 install 实现前二选一登记：要么引入最小 deterministic 探针写 `fresh/stale`，要么承认 provider 自报新鲜度只作 advisory，不能把自报 `fresh` 当 confirmed 或 deterministic truth。**实现口径以 v1.16 plan R6 为权威**：provider 自报 `fresh`→写 `readiness_status=unknown`（不冒充 deterministic）；自报 `stale`→写 `readiness_status=stale`，进既有 `computeProviderCounts.stale`→doctor warn→CON-PROV-001 fallback 决策链；`repo_aligned`/`limitations` 仅作附带展示（无 decision-path consumer，不可作 stale 唯一落点）。
- **runtime-setup 实体重命名边界**：`$spec-runtime-setup` 是目标 canonical 入口名，当前 source 实体仍是 `skills/spec-mcp-setup/**` 与 `templates/.../mcp-setup.md`。实体重命名是独立中型 work；未落地前不得把不存在的 source path 写成当前事实。
- **governance v1.14 例外登记**：`gate-lens-taxonomy.v1` 是共享词表，不需要独立 producer/helper；`rule-maturity.v1` 是有意 shadow/schema-only 例外，producer/helper 与 required-evidence/blocking promotion 留到 v1.17。

### 开发顺序的依赖与验收约束（钉死，避免按版本号机械串行）

版本号给出**粗粒度落地批次**，但下列约束决定真实的依赖边界与验收口径，规划计划时以这些为准（与父方案 §8 / §9.0.1 / §10 对齐）：

- **direct consumer gate：v1.11 + v1.12 是不可分割的 producer→consumer 对。** v1.11 只产 facts（registry / `tool-facts.v2` / configured scan / install safety / status renderer），其 deterministic consumer 是 v1.12 的 `doctor.decision_input_health` rollup。按父方案 §9.0.1「无消费方 = 不交付」，**v1.11 不单独宣称完成**；只有当 `doctor --json` 能从 setup facts 计算 `decision_input_health` 并输出 `decision_input_health_basis.artifact_refs` 时，v1.11+v1.12 这个 direct deterministic 切片才算过 gate。
- **workflow consumer gate 延迟到 v1.13。** `doctor` 是 CLI 汇总面，不是 §6 named workflow consumer；§6 named workflow（`spec-plan` / `spec-work` 等）要等 v1.12 的 `doctor --json` projection 落地后才能读取这些 facts，并在 v1.13 verification / honest-closeout 接入 `spec-work` closeout 时兑现可观察行为变化。不得把 v1.12 doctor rollup 包装成已独立兑现 workflow 价值的最终里程碑。
- **honest-closeout 的硬前置只是 v1.11 的工具存在性子集。** v1.13 的 `verification-run-summary` / `honest-closeout` 真正依赖的是 v1.11 中**工具存在性检测**（填 `not-run: missing_dependency`），而非 install safety、configured dependency scan 的完整度。后两者可与 v1.13 并行或紧随，**不阻塞 honest-closeout 落地**——honest-closeout 是父方案 §0.0 标注「最该早堵的谎报洞」，不应被 v1.11 全宽 baseline 串行推迟。
- **v1.15 Knowledge Harness 以 provider-absent 为默认设计，不预设 v1.16。** v1.15 的 context budget / `docs/solutions` promotion / memory recall **boundary** / capability lens 均以 fallback（source-scan / `docs/solutions` / direct read）为默认路径；父方案 §5.3 六层表中 L3/L4 列出的 code-graph 能力是 v1.16 的**可选增强（setup 帮装、用户同意）**，缺失时 v1.15 仍完整可用，**v1.15 不依赖 v1.16**。memory 能力本就由 v1.15 的 `docs/solutions/` 承担，不依赖任何外部 memory 工具。
- **v1.14 与 v1.17 的 governance 分两批是有意的。** v1.17 的 RuleMaturity required-evidence / blocking 候选需要 v1.14 foundation 先运行、沉淀**误报证据 + 人审**（父方案 §4.7），中间隔开 v1.15 / v1.16 不影响该依赖。

## 产物规范

| 产物 | Canonical 位置 | 规则 |
| --- | --- | --- |
| helper registry | `skills/spec-mcp-setup/helper-tools.json` | 描述 helper readiness / install safety；`required` 不等于 `baseline_blocking` |
| provider registry | `skills/spec-mcp-setup/provider-tools.json` + `skills/spec-mcp-setup/mcp-tools.json` opt-in entries | Graphify 这类 CLI provider 走 `provider-tools.json` / `install-helpers`；CodeGraph 这类 MCP provider 走 `mcp-tools.json` / `install-mcp`；不单独新增 provider install profile contract |
| provider readiness contract | `docs/contracts/provider-readiness.md` | 字段 canonical 归父方案；只承载 lifecycle 布尔位、readiness freshness、repo alignment 与 fallback 等机械事实 |
| verification profile contract | `docs/contracts/verification/verification-profile.md` | 描述项目级 verification source contract |
| verification profile instance | `spec-first.verification.json` | repo root checked-in source；不放 `.spec-first/config/*.json` |
| local verification override | `.spec-first/verification-profile.local.json` 或 `.spec-first/config.local.yaml` | 本地覆盖，gitignored，不作为团队 truth |
| verification run summary | `docs/contracts/verification/verification-run-summary.md` | 逐 check 明细唯一 source |
| work run artifact | `docs/contracts/workflows/spec-work-run-artifact.schema.json` | 只保留 validation 聚合 status / reason_code / artifact ref，不复制逐命令明细 |
| setup facts | `.spec-first/config/tool-facts.json`、`.spec-first/config/runtime-capabilities.json` | generated local facts，由 `$spec-runtime-setup`（迁移期 alias `$spec-mcp-setup`）生产，供 `doctor` 消费 |

## 边界

- `spec-first init` 只做 source-managed runtime projection，不安装 MCP/helper/provider。
- `$spec-runtime-setup`（迁移期 alias `$spec-mcp-setup`）生产 deterministic readiness facts，不做语义判断。
- `doctor` 消费 setup facts 并输出 deterministic health rollup，不安装、不 repair。
- code-graph / project-graph 能力工具（如 CodeGraph / Graphify）可经 `spec-runtime-setup` 过 gate + 用户同意帮装；缺失或 stale 不阻塞 minimal workflow，消费侧 capability-aware（advisory 回源），刷新归工具。memory 能力默认走 `docs/solutions/`。
- Provider readiness 只表示机械新鲜度且不承载 `confirmed_context`；confirmed context 必须来自 source/test/log/contract/user evidence。
- v1.x 内化主线不复制 `.scale/workflow.json` 状态机、G0-G22 blocking gate、inline hook 或第三方技能全集。
- v2/spec-first-on-scale 若启动，必须明确 `SCALE owns runtime; spec-first owns content`，并先做 dry-run projection / compatibility bridge；不能让 `spec-first init` 与 `scale init` 双写 host runtime。
- required harness runtime setup workflow 的 canonical 入口名是 `$spec-runtime-setup` / `/spec:runtime-setup`，`$spec-mcp-setup` / `/spec:mcp-setup` 为迁移期 deprecated alias（详见父方案 §0.4.2）；`skills/spec-mcp-setup/**` 等 source 实体路径在后续 source 重命名 work 任务落地前保持现状。
