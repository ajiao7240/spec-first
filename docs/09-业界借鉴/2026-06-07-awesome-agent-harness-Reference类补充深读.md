---
title: "awesome-agent-harness Reference 类(68 项目)补充深读 × spec-first 提升分析"
date: "2026-06-07"
type: 业界借鉴分析
related_source:
  - "./2026-06-07-awesome-agent-harness-236项目对标-spec-first提升分析.md"
  - "./2026-06-07-Harness-Engineering对照-spec-first架构分析.md"
verification: "Reference Harness Implementations 类 68 项目经 triage 全分层;16 个 high/clone_worthy 项目 git clone --depth 1 后源码级深读(24 条机制发现,evidence 字段逐项记录文件/行号);全部 cloned=true(本批无 clone 超时)。spec-first 侧边界判断依据 CLAUDE.md 角色契约。"
note: "业界借鉴 artifact / 主报告的 Reference 类增量补充;不改 source、不计入 CHANGELOG;任何后续实现必须回到 source skills/agents/CLI contracts/tests/docs 或新 plan/task-pack,不得从本文直接推导 runtime 行为"
---

# awesome-agent-harness Reference 类补充深读 × spec-first 提升分析

## 本文定位与缘起

主报告 [`2026-06-07-awesome-agent-harness-236项目对标-spec-first提升分析.md`](./2026-06-07-awesome-agent-harness-236项目对标-spec-first提升分析.md) 在 workflow 执行中,**第 8 类 Reference Harness Implementations(68 项目,占 236 的 29%,最大一类)的 deepdive 阶段因 agent stall 连续 6 次失败而未纳入**——主报告第七节已诚实补标此缺口。

本文是该类的补跑增量:复用主 workflow 已成功的 Reference 类 triage(68 项全分层,16 个 high/clone_worthy),拆 4 路并行重跑 deepdive(降单 agent 负载,**本批 16 项全部 clone 成功、无 stall**),产出 24 条源码级机制发现。

**Reference 类是 spec-first 最该对标的同域参考实现**——它们就是 Claude Code / Codex CLI 宿主本体、以及 oh-my-codex / Compound Engineering / OpenClaw.NET / aider / AI-DLC 等同类 coding-agent harness。因此本类的发现密度与对题度高于主报告其余 7 类。

---

## 结论先行

1. **Reference 类深读没有动摇主报告的核心判断,反而强化"克制即差异化、借机制拒形态"**:同域 SOTA(mini-swe-agent ~100 行取代 SWE-agent)正反向印证 spec-first 的 80/20 抗膨胀;VK / ZeroClaw / codex-autorunner 的 daemon/gateway/SQLite 形态均被判 `reject-out-of-bounds`,与主报告 anti-pattern 清单一致。

2. **发现一个主报告未触及的重磅事实:Compound Engineering(`EveryInc/compound-engineering-plugin`)是 spec-first 的直系上游同源项目**——其 `skills/ce-*` 与 spec-first 的 `spec-*` 几乎一一对应,spec-first 近似它的 fork+rebrand。真正值得借的是 spec-first **尚未对齐的两个上游锚点**:`STRATEGY.md`(产品方向 grounding)+ `CONCEPTS.md`(共享术语表)。

3. **Reference 类带来 4 个主报告 12 gap 未覆盖的新机制 gap(R1-R4),全部 `adapt` 且边界安全**,集中在 spec-first 链路的两个薄弱段:**Codebase→Context 的确定性 codebase map**(aider repomap / oh-my-codex codebase-map)、**证据闭环与自演化治理 schema**(OpenClaw.NET Evidence Bundle / Harness Evolution Proposal)。

4. **两个发现直接关联本仓库正在进行的工作**:(a) oh-my-codex 的 `AGENTS.md` runtime overlay + 多 hook fail-open 纪律,正是 spec-first 刚落地的 Codex SessionStart hook(commit `21cea55d`)的成熟参照;(b) Codex CLI `plan.md` 的 "decision-complete" 终止判据 + "discoverable-facts vs preferences" 二分法,直接收紧 spec-brainstorm Requirements Readiness Gate。

**Goals**:补齐主报告缺失的最大类、提取 Reference 类独有的增量 gap。**Non-goals**:不产实施计划;不改 source;不重复主报告已列的 12 gap / 10 anti-pattern。

---

## 一、Reference 类可借鉴机制表(16 项 clone 深读)

`adopt`=直接采纳;`adapt`=改写为 spec-first 形态;`reference-only`=仅设计参考;`reject`=越界拒绝。全部 `cloned=true`,evidence 见 `/tmp/aah/ref-findings.json`(本次运行)。

| 项目 | 可借机制(源码证据) | 映射 spec-first | verdict |
|---|---|---|---|
| **Compound Engineering** | `ce-strategy` 生成维护 `STRATEGY.md`(产品方向锚点,被 ce-ideate/brainstorm/plan 作 upstream grounding 读取);`CONCEPTS.md` 由 ce-compound 持续 accrete 的共享术语表 | Codebase→Context→Spec 最上游 grounding;Knowledge 节点的项目级术语层 | **adapt** |
| **Claude Code** | `feature-dev.md` Phase4 **并行 launch 2-3 个 code-architect,各锁不同 trade-off 焦点**(minimal/clean/pragmatic)→ 主 agent 形成对比让用户选;Phase2 subagent 探索结果回流主上下文 | spec-plan 缺的"多方案架构对比节点";多 lens reviewer 对标 50+ spec-*-reviewer | **adapt** |
| **Codex CLI** | `plan.md` **"decision-complete" 可证伪终止判据** + **discoverable-facts(必须探索)vs preferences(才问用户)二分法** + explore-before-ask;`context-fragments` 注入带 token 预算硬截断(1000)+ 标记可回收 | spec-brainstorm Readiness Gate + spec-plan 何时停止追问;Context 证据注入预算 | **adapt** |
| **aider** | `repomap.py` **tree-sitter tag + PageRank 图中心度 + token 预算**产出排序 codebase map(脚本产确定性事实,LLM 判语义);architect/editor 双模型分工 | Codebase→Context 的确定性 facts(对标 CodeGraph/Graphify provider) | **adapt** |
| **OpenClaw.NET** | **Evidence Bundles**(run 后 checks/risks/assumptions/untested-areas/human-review/confidence 结构化);**Harness Evolution Proposals**(invariants+falsificationTests+applyMode=manual_only+requiresRegression,绝不静默改 runtime);Learning Proposals 8 维质量门 | 证据闭环显式 artifact 化;自演化治理 schema(契约核心:可治理可验证);spec-compound 去噪 | **adapt** |
| **AI-DLC Workflows** | 纯 prose 自适应 phase(ALWAYS/CONDITIONAL + "Execute IF/Skip IF" 清单);Extensions `.opt-in.md` 懒加载;`audit.md` 原始输入留痕"never summarize, append not overwrite";`overconfidence-prevention.md` 把提问反模式沉淀为治理文档;独立 `aidlc-traceability`(req→story→unit→component→code gap/orphan 检测) | 任务分级可执行化;progressive disclosure;证据留痕;Readiness Gate 提问哲学;**spec→code 可追溯矩阵** | **adapt** |
| **codex-autorunner** | `STATE_ROOTS.md` **canonical root + 每类状态唯一 owner + 显式 "does NOT store" 负向清单**;"Files are truth/Leave evidence/Reload reality" onboarding;phase-artifact"仅凭 artifact 恢复";ticket"another agent can prove completion without guesswork" | source/runtime 边界 + 单一 owner;证据闭环;resume/handoff;spec-write-tasks 可验证完成标准 | **adapt** |
| **Harness (revfactory)** | CLAUDE.md pointer 治理(只放 trigger+变更历史,显式禁放 agent/skill 列表);drift 审计"声明 vs 实际资产";反馈类型→修改对象路由表;with/without-skill + near-miss trigger eval | CLAUDE.md managed block 轻量化;doctor drift 扩展;spec-compound/skill-audit;fresh-source-eval | **adapt** |
| **oh-my-claudecode** (learner) | knowledge 提取 **3-of-3 质量门**("能 Google 到吗→否/本库特定吗→是/真有调试成本吗→是")+ BAD-vs-GOOD 对照;remember 把发现路由到正确 surface | Knowledge 节点 spec-compound 触发门 + MEMORY/solutions/CLAUDE 路由分类 | **adapt** |
| **oh-my-codex** (codebase-map) | `git ls-files` + regex export 扫描(不全读)+ 按目录分组 + **git-index-signature 缓存失效**,token 上限 1000,出错返空不阻塞 | Codebase→Context 的轻量始终在线确定性 map(区别于重型 graph provider) | **adapt** |
| **oh-my-codex** (AGENTS.md overlay) | marker-bounded **临时 session overlay** 注入 AGENTS.md 启动前、结束后 strip(幂等,3500 上限),与 durable managed 块用不同 marker 分离 | **Codex 端 SessionStart 注入的成熟形态**(对标 commit `21cea55d`);双宿主 source/runtime | **adapt** |
| **learn-claude-code** | s09 memory **4 类 taxonomy**(user/feedback/project/reference)+ "索引常驻可缓存 / 内容按需 side-query 注入上限5 + 失败 fallback 关键词";s08 大 tool_result 落盘留 `<persisted-output>` 标记+预览 | MEMORY.md 自动记忆设计(已同构,可强化加载契约);证据留存 artifact path | **adapt** |
| **oh-my-claudecode** (SessionStart) | 多 hook **fail-open + timeout-bounded(5s)+ matcher-scoped**;additionalContext 注入非打印 | 印证 spec-first 刚落地 SessionStart hook 的成熟纪律 | reference-only |
| **oh-my-codex** (task-size) | 任务分级纯分类器 + **显式标注"Claude 可 PreToolUse 强制 / Codex 仅 advisory"** 的双宿主能力诚实 | 任务分级;advisory≠confirmed 的诚实标注 | reference-only |
| **oh-my-codex** (session search) | JSONL 流式 + 行号 + 结构化 per-match provenance(transcript_path+line_number) | spec-sessions / `spec-first session`(已覆盖,借引用质量) | reference-only |
| **SWE-agent** | `review_on_submit` 提交前 deterministic checklist gate;`state_command` 脚本产 diff 事实 | spec-work 提交前自检脚本化;已有的 Scripts-prepare-facts(印证) | reference-only |
| **mini-swe-agent** | ~100 行循环 match 并取代 SWE-agent → **抗膨胀强外部印证**;trajectory 序列化+版本号+截断 | 80/20 原则;artifact 最小契约 | reference-only |
| **mini-coding-agent** | WorkspaceContext 一次性采集 repo facts;stable-prefix/KV-cache 分离;三桶 memory;**repeated_tool_call 连续同参熔断** | Codebase→Context facts;反卡死机制("失败两次换思路"工程化) | reference-only |
| **ZeroClaw** (memory) | 相似度>阈值且内容异→标 **superseded**(自动 staleness);cadence-gated hygiene + 机读 report;reserved-prefix 排除出 context | Knowledge 衰减/冲突(compound-refresh);runtime-context 排除规则 | reference-only |
| **Vibe Kanban** (logs) | `NormalizedEntry/NormalizedConversation` **统一 typed schema 归一化 9 种异构 agent 输出**(downstream 依赖 schema 非 provider 内部) | Explicit boundaries;Review/Knowledge 消费 host-agnostic facts | reference-only |
| **Vibe Kanban** (server) | kanban daemon + worktree-manager + relay + DB | — | **reject-out-of-bounds** |
| **ZeroClaw** (runtime) | 单二进制 agent runtime + 20 provider gateway + 30 channel | — | **reject-out-of-bounds** |

---

## 二、Reference 类新增 gap(主报告 12 gap 未覆盖)

主报告已有 G1-G12。本类深读新增 4 个、强化 2 个既有。新 gap 编号 R 前缀避免与主报告冲突。

| # | gap | 证据项目 | value | cost | 边界安全 | 建议动作 |
|---|---|---|---|---|---|---|
| **R1** | **上游产品方向锚点 `STRATEGY.md` + 共享术语层 `CONCEPTS.md`**:链路最上游缺一份耐久、被 brainstorm/plan 复用的 WHAT 锚点;Knowledge 缺 accrete 式术语表(spec-compound 应产却未产) | Compound Engineering(直系上游)/ codex-autorunner(contextspace 三件套)/ AI-DLC(audit 留痕) | high | low | ✅ | **plan-next** |
| **R2** | **Codebase→Context 确定性 codebase map facts**:脚本产出 token 预算内、按图中心度/git-index 缓存的结构 map,补 "Scripts prepare facts" 在该段的空白(轻量版,非重型 graph provider) | aider repomap / oh-my-codex codebase-map / mini-coding-agent WorkspaceContext | high | medium | ✅(作 facts,不内化 PageRank 引擎) | **plan-next** |
| **R3** | **Evidence Bundle 结构化 schema**:一次 run 的 checks/command-results/risks/assumptions/untested-areas/human-review/confidence 固化为机读 artifact 供下游消费(当前证据散在 review 输出+audits) | OpenClaw.NET / codex-autorunner / SWE-agent state_command | high | low-medium | ✅ | **plan-next** |
| **R4** | **spec→code 可追溯矩阵**:requirement↔story↔task↔code 的 gap/orphan 确定性检测 artifact(spec-first 各阶段间无 traceability)。注:与主报告 G3"requirement 覆盖映射"部分重叠,R4 是其全链路扩展 | AI-DLC aidlc-traceability / OpenClaw.NET | high | medium | ✅ | **dogfood-first**(先验证痛点量级) |
| R5(强化 G2) | Knowledge **自动 supersession + 提取质量门**:新知识标记旧冲突项 superseded + "3-of-3 可 Google/本库特定/真调试成本"过滤门 + 目的地分类器 | ZeroClaw / oh-my-claudecode learner / Harness 反馈路由表 | high | low | ✅ | plan-next(并入 G2) |
| R6(强化 G9/双宿主) | **Codex 端 SessionStart 注入成熟化**:多 hook fail-open + timeout-bounded + matcher-scoped;`AGENTS.md` 临时 overlay(marker 幂等、size-cap、与 managed 块分离) | oh-my-codex / oh-my-claudecode | high | low | ✅(须保持 advisory/幂等,勿成 run-state 引擎) | **do-now 候选**(直接接 commit `21cea55d` 的 hook 工作) |

### 对主报告核心建议的影响

- **主报告 do-now(G9 init realpath 守卫)与最高优先级第一梯队(G1/G2/G4)不变**。
- **R6 应并入正在进行的 Codex SessionStart hook 工作**:本 session 已落地 hook(commit `21cea55d`),oh-my-codex 的 fail-open/matcher-scoped/overlay 纪律是现成的成熟化参照,边际成本极低。
- **R1(STRATEGY.md/CONCEPTS.md)优先级建议提到第一梯队**:因 Compound Engineering 是直系上游,这是"对齐上游已验证设计"而非"凭空新增",边界与膨胀风险都最低。

---

## 三、Reference 类 anti-patterns(强化主报告防膨胀清单)

主报告已列 10 类。本类深读提供 3 个**同域**的清晰边界标尺(因为它们是 coding-agent harness,越界示范更直接):

1. **kanban 编排 daemon + worktree-manager + relay + DB**(Vibe Kanban):VK 为协调 agent 付出常驻 daemon + DB + relay 基建;spec-first 的赌注是相反的(source-of-truth 资产 + 脚本产 facts,无 daemon)。**警惕追"orchestration 功能"时漂向 worktree/preview/relay daemon 所有权**。
2. **单二进制 agent runtime + LLM gateway + 多 channel**(ZeroClaw):最清晰的"这不是 spec-first"——它 own model dispatch/channels/persistent runtime,spec-first 全不 own,而是骑现有宿主(Claude Code/Codex)。
3. **hub/daemon + 中心 SQLite store + 多 surface 编排**(codex-autorunner):即便其 artifact 治理哲学极好(STATE_ROOTS/Files-are-truth 值得借),其 hub/daemon/orchestration.sqlite3 形态仍是 CLAUDE.md 明令的"强状态机/中心化引擎/常驻 daemon"。**借 artifact 治理与边界声明,拒 runner/hub 形态**。

共性教训(对主报告"克制即差异化"的强化):**这些同域项目无一例外用"重运行时形态"换取能力,而 spec-first 与 mini-swe-agent 走的减法路线证明同域 SOTA 的演化方向恰恰是做减法。** 抗膨胀不是保守,是被同域 SOTA 验证的正确方向。

---

## 四、诚实标注

- **证据强度**:本批 16 项**全部 `cloned=true`**,evidence 字段有文件/行号(如 aider `repomap.py:365-555`、OpenClaw.NET `docs/HARNESS_EVOLUTION.md`、Codex CLI `plan.md:77-90`、oh-my-codex `src/hooks/codebase-map.ts`)。无 clone 超时降级。
- **覆盖口径**:深读 16 个 high/clone_worthy 项,Reference 类其余 52 项(triage 已分层,多为 OpenClaw/Hermes/Cline/Gemini CLI 等宿主本体或更小变体)未逐一深读;主报告全局口径(236 全分层、高价值深读)在本类同样适用。
- **gap 价值/成本是判断非实测**:R1-R6 的 value/cost 是源码核验+spec-first 现状对照的工程判断,落地成本须在各自 brainstorm/plan 重估。R4 标 dogfood-first 因可追溯矩阵痛点量级未量化、膨胀风险中等。
- **边界判断主观性**:`adapt vs reject` 依据 CLAUDE.md 角色契约;Compound Engineering 作"直系上游"的判断基于 skills/agents 目录的近 1:1 对应,若该判断有误,R1"对齐上游"的论证强度需下调为"借鉴同类"。
- **不替代既有排位**:本文与主报告均为机制级输入,SCALE v1.15/v1.16/v1.17 排位与 brownfield onboarding dogfood-first 裁决优先。R1/R6 提优先级是建议,非排位决定。
