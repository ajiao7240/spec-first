---
title: "awesome-agent-harness 236 项目对标 × spec-first 提升分析"
date: "2026-06-07"
type: 业界借鉴分析
related_source: "./2026-06-07-Harness-Engineering对照-spec-first架构分析.md"
verification: "236 项目经 8 维 triage(relevance/clone_worthy/boundary)分层;33 个 high/medium 项目 git clone 后深读源码(evidence 字段逐项记录读取文件);Promptfoo 因仓库过大 clone 超时,降级为 README/设计层判断;spec-first 侧边界判断依据 CLAUDE.md 角色契约与既有 source"
note: "业界借鉴 artifact / 增量对照分析;不改动 source,不计入 CHANGELOG;任何后续实现必须回到 source skills/agents/CLI contracts/tests/docs 或新的 plan/task-pack,不得从本文直接推导 runtime 行为"
---

# awesome-agent-harness 236 项目对标 × spec-first 提升分析

对照对象:awesome-agent-harness 语料库 236 个 agent harness / orchestration / context / sandbox / protocol / eval / observability / governance 类项目,与本仓库 spec-first 的系统设计。

本文是 [`2026-06-07-Harness-Engineering对照-spec-first架构分析.md`](./2026-06-07-Harness-Engineering对照-spec-first架构分析.md) 的**横向扩展增量**:基线报告纵向核验了单篇 Harness Engineering 文章的主张可信度与 3 个工程细节缺口;本文横向扫描 236 个真实项目源码,把"可借鉴机制 vs 越界形态"按 spec-first 角色契约判断基线系统化。**两文不重复**——基线报告的 per-需求 dossier、反空测试条件、failure-mode→gate 映射三个缺口在本文按同一边界纪律收编进跨类 gap 清单。

---

## 结论先行

1. **spec-first 的核心赌注被 236 项目反复独立印证为正确方向,且 spec-first 比绝大多数项目更克制**。`source-of-truth ↔ generated-runtime 清晰投射边界` 有 Trellis(几乎同构 peer)、oh-my-agent(近 1:1)两个直接同构验证;`Scripts prepare facts, LLM decides` 被 auto-harness 的 gate-as-fact、Sponsio 的 pure-verdict/enforcement 分离、Haft 的 SpecCoverage 确定性检查三条独立收敛;`Light contract 的克制` 被 GitAgentProtocol 的 manifest 膨胀反面印证。

2. **差异化护城河不在"能编排多 agent"(人人都做),而在"投射边界 + scripts/LLM 分工 + 证据闭环"**。236 项目里高 out-of-bounds 比例(Execution Substrates 19/25、Eval 17/27、Observability 11/14)集中在 spec-first 明确不做的基础设施形态——**克制本身就是被验证的差异化**。

3. **真正可借鉴的是 12 个机制级 gap,几乎全部是"轻量 frontmatter / 确定性脚本检查 / 设计纪律"级别**,不引入任何 server/DB/daemon/runner。其中仅 1 项 do-now(init realpath 守卫 + 幂等块替换)、1 项 dogfood-first(regression 成功标准 artifact,膨胀风险最高),其余 10 项 plan-next。

4. **必须坚决拒绝的是 10 类形态(非机制)**:memory server / 图数据库 / YAML 状态机引擎 / observability 平台 / sandbox 执行底座 / eval benchmark 平台 / 运行时拦截器 / 中心 manifest 规则引擎 / 重造开放格式 / 常驻多 agent daemon。借的是机制,拒的是形态。

**Goals**:为 spec-first 演化提供经源码核验的"可借机制 + 反膨胀边界"清单。**Non-goals**:不产出实施计划(任何 gap 落地须各自走 brainstorm/plan);不改 source;不替代 SCALE 路线(v1.15/v1.16/v1.17)既有排位。

---

## 一、覆盖说明与证据分层

### 1.1 236 全覆盖与分层依据

全部 236 项目按 8 维 triage 分层(relevance / mechanism / clone_worthy / boundary_note),归入 7 个主题簇。分层逻辑遵循 80/20:**把深读预算投向高价值同域项目,把基础设施形态批量归类为越界**。

| 主题簇 | 代表项目数(triage) | 深 clone 项 | out-of-bounds 占比信号 |
|---|---|---|---|
| Harness Architecture & Orchestration | 44 | 11 | 中(多为重运行时引擎) |
| Context & Working-State Engineering | 17 | 9 | 低-中(膨胀诱因最密集) |
| Execution Substrates & Sandboxing | 25 | 1 | **高 19/25** |
| Protocols, Tool Interfaces & Agent Contracts | 22 | 7 | 低 |
| Evaluation Harnesses & Benchmarks | 27 | 3 | **高 17/27** |
| Observability & Reliability Operations | 14 | 1 | **高 11/14** |
| Guardrails, Security & Governance | 20 | 2 | 中-高(gateway/proxy 密集) |

> 覆盖口径诚实标注:7 个主题簇的 triage 名单是各簇内 **clone-worthy 候选 + 边界代表**的样本展示,不是 236 的逐条枚举;但 236 全部经过 relevance/boundary 分层判断,本文按"高价值深读 + 越界批量归类"组织,未深读的低 relevance 项不单独列证据。

### 1.2 证据可信度三级(诚实标注)

- **clone 深读证据(33 项,可信度最高)**:`cloned:true` 且 evidence 字段逐项记录了实际读取的源文件、行号与机制(如 Superpowers 的 hooks/session-start、Trellis 的 .template-hashes.json、auto-harness 的 gating.py:L253-330、Haft 的 internal/artifact/decision.go)。本文所有 borrowable mechanism 均出自此层。
- **README/设计层证据(1 项,可信度中)**:**Promptfoo** 两次 clone 均超时被 kill(exit=143),工作树为空,WebFetch 被网络策略阻断。其 deterministic-vs-model-graded 断言分层结论是**设计原则层判断,非源码层证据**,可移植性结论保守。
- **triage 层(README/web,可信度依赖外部材料)**:未深 clone 的项目仅有 relevance + mechanism 概述,不作为机制借鉴依据。**ECC 的 README 自称"182K stars"与实际不符,已按营销夸大处理,只采源码事实**。
- **未验证**:236 中低 relevance 项的内部实现未逐一核验;out-of-bounds 项只验证"形态越界",未深究其实现细节。

---

## 二、按类别的可借鉴机制表

每行 = 一个深读项目的可借机制 + boundary_verdict。`adopt`=直接采纳;`adapt`=改写为 spec-first 形态;`reference-only`=仅设计参考;`reject`=越界拒绝。

### 2.1 Harness Architecture & Orchestration

| 项目 | 可借机制(clone 深读) | 映射 spec-first | verdict |
|---|---|---|---|
| Superpowers | SessionStart hook 全文注入入口 SKILL + "1% 命中即必须 invoke" 硬 gate;implementer 四状态码(DONE/DONE_WITH_CONCERNS/NEEDS_CONTEXT/BLOCKED)+ coordinator 显式分诊;verification 的"无本消息内新鲜证据不得声称完成"Iron Law | managed bootstrap block + using-spec-first 入口治理;spec-work/code-review 派发;CLAUDE.md 目标驱动执行 | adapt |
| oh-my-agent | `.agents/` SSOT 投射多 runtime;fs-link 的 `ssotBase` realpath 路径穿越守卫;"同一项目只用一种分发方式以免 drift" | init/doctor 的 source→runtime 投射 + drift reason_code | adopt |
| gstack | SKILL frontmatter 声明式 `context_queries`(glob/tail/sort/render_as)确定性拉取知识;learnings.jsonl + timeline.jsonl append-only 本地证据流 | Context 节点 + docs/solutions 检索;Knowledge 机读证据 | adapt |
| Symphony | in-repo `WORKFLOW.md` 契约;严格模板未知变量 fail;错误分类 + 分级 gating(配置错误阻断 vs 单次降级);handoff 终态 | Tasks/contract 校验;reason_code 两级化 | adapt(只借契约与分级,拒 daemon) |
| Archon | 每 run 独立 worktree isolation(resolver/pr-state);loop node `fresh_context:true` | git-worktree skill;spec-work fresh subagent | reference-only(借隔离,拒 YAML 引擎) |
| Chorus | 双信号条件激活(目录 + CLI on PATH 都在才开)+ `*_MODE=off` 显式 opt-out | readiness gate / degraded mode | reference-only(拒 RBAC/DB 平台) |
| ECC | provenance.schema(learned skill 必带 source/created_at/confidence/author);governance-capture opt-in hook | Knowledge 证据可信度标注 | adapt |
| Gas Town | MessageDeduplicator check-and-set 幂等;gt prime 上下文恢复 | 可重放脚本事实采集;compaction 后恢复 | reference-only(借幂等,拒 Go daemon) |
| Addy's Agent Skills | sdd-cache 的 HTTP 304-revalidate(缓存但每次向源 revalidate,只在 304 用缓存) | framework-docs/web-researcher 文档缓存 | adapt |
| deepagents | 能力拆成正交 middleware(planning/fs/subagent/memory/HITL)各管一件、可单独 override | 最小 durable mechanism + 正交 skill 边界 | reference-only(语言绑定 SDK,不搬码) |
| hankweave | zod discriminatedUnion event journal;failureReason{retriable,sentinelRefs};checkpointSha 绑定状态转移 | 证据 schema + reason_code | reference-only(借 schema,拒 sentinel daemon) |

### 2.2 Context & Working-State Engineering

| 项目 | 可借机制(clone 深读) | 映射 spec-first | verdict |
|---|---|---|---|
| Trellis | 单一 workflow source + 平台标记块 `[platform,...]` 按宿主过滤投影;`.template-hashes.json` 文件级 sha256 drift map;脚本产 machine-readable 工作态事实 | init/doctor;dual-host;Context 注入 | adapt |
| sd0x-dev-flow | compaction 恢复:小 JSON 状态文件 + SessionStart(compact) hook + git porcelain 单向 stale 重对账 + 注入"下一步必做命令";fail-closed sidecar;mkdir 可移植锁 | Context 节点 compaction 恢复;已装 Codex SessionStart hook | adapt(拒 durable state-machine gates) |
| context-mode | retrieve-not-dump(compaction 后只召回相关条目而非 dump 历史);"think in code"(一次脚本执行代替几十次 Read) | spec-sessions 召回;spec-work 执行准则 | adapt(拒 MCP server/sandbox) |
| CCPM | Script-First Rule 显式分工表;Task frontmatter `conflicts_with`(文件级冲突)+ `parallel` + `depends_on` | spec-write-tasks task pack schema | adapt(拒"GitHub issues 即数据库") |
| Beads | ready-work 确定性谓词(无 blocker + 状态 + 非 pinned/ephemeral);内容哈希渐进 ID(hash[:6→8])多分支零冲突;PROJECT_CHARTER 反膨胀自限条款 | tasks CLI 确定性 fact;角色契约自限写法 | adapt(拒 Dolt 图数据库) |
| Acontext | "Progressive disclosure, not search":先给 `<available_skills>`(name+desc),LLM 推理决定调 get_skill 取全文,产物纯 markdown | docs/solutions 两段式召回索引 | adapt(拒 pgvector/RabbitMQ/S3 server) |
| agentic-stack | delegation.md(goal/constraints/return-format/budget + memory 隔离 + 递归深度上限)与 permissions.md 三级权限作纯文件契约;transfer scope 分级(core 可移植 vs sensitive 默认不带) | sub-agent handoff 契约;dual-host 投影安全默认 | adapt(拒 dashboard/flywheel) |
| claude-mem | `<tag>...</tag>` 幂等替换的 context 注入块;toBmpSafe 剥离 astral 码点防 compaction 截断 brick;TokenCalculator token economics | managed block 写入;注入可度量 | reference-only(拒 worker server/Chroma) |
| agentmemory | confidence-scored 召回排序 score=(项目匹配)*confidence;applyDecay 记忆老化;`<fact confidence=>` 显式结构 | docs/solutions 排序;compound-refresh 老化 | reference-only(作外部 provider) |

### 2.3 Execution Substrates(19/25 越界,仅 1 项可参照)

| 项目 | 可借机制 | verdict |
|---|---|---|
| Sandbox Agent | UniversalEvent 稳定 envelope 归一化多宿主异构事件(一组语义枚举);degraded 不丢数据双轨(native_id + raw_hash + `AgentUnparsed` + `synthetic` 标注);ContentPart tagged-union 把 file/reasoning 建模为可审计证据单元 | reference-only(借 schema 哲学,拒 Rust SSE server/sandbox VM/SessionPersistDriver) |

> 其余 24 项(Daytona/E2B/Microsandbox/CubeSandbox/Judge0/Tensorlake/AgentScope Runtime/SWE-ReX/Capsule 等)全部为 sandbox/VM/runtime 执行底座,角色契约明确 non-goal,**spec-first 不拥有执行层,只消费 provider readiness facts**。

### 2.4 Protocols, Tool Interfaces & Agent Contracts

| 项目 | 可借机制(clone 深读) | verdict |
|---|---|---|
| Anthropic Agent Skills | progressive-disclosure 三层加载(frontmatter ~100t → body <5000t → scripts/references 按需);mcp-builder 三段式(SKILL.md 导航 + scripts/ 确定性逻辑 + reference/ 按需文档) | adapt |
| Agent Skills Specification | validator.py 纯 script-owned facts(返回 error list 而非抛异常,字段白名单/长度/命名/目录-name 一致性全机器判定);prompt.py 投影 `<available_skills>` XML;allowed-tools 能力声明 | adapt |
| GitHub Spec Kit | `analyze` 非破坏性跨 spec/plan/tasks 一致性分析(requirement inventory + task coverage mapping + 术语漂移 + coverage% + 50 行 finding 上限,READ-ONLY 不自动改);specify 内嵌 quality checklist 量化门 + NEEDS CLARIFICATION 上限 3;check-prerequisites.sh emit JSON facts | adapt(拒 constitution 硬 gate 规则引擎) |
| Serena | LSP symbol 级检索(FindSymbol name_path+depth+include_body+max_answer_chars / FindReferencingSymbols 影响面);memory `mem:` 前缀交叉引用 + RenameMemory 自动传播 | reference-only(必须作 MCP provider 消费,内建即变 IDE 基础设施越界) |
| AGENTS.md | 约定优于配置的极简开放标准:repo 根一个可预测位置的 markdown,无 frontmatter/schema 强制,60k+ 仓库采用 | adopt(校准:managed block 保持极简不膨胀成准 schema) |
| Claude Code Plugins Directory | policy/schema.json 把供应链安全审查结构化成 LLM-fillable schema(passes + violations 必引具体 file/hook + 逐 hook 标注 gated/ungated/network);marketplace.json pin ref/sha 具体 commit | adapt(借 schema 协作模式,拒做 marketplace 平台) |
| GitAgentProtocol | knowledge/index.yaml 检索提示(path+tags+priority+always_load);memory.yaml rotation/archive_policy + MEMORY.md 行数上限 | reject-out-of-bounds(主体:compliance/SOD/financial_governance/model_risk 全塞 manifest = 中心化规则引擎,整块拒绝;仅轻量检索/轮转元数据可吸收) |

### 2.5 Evaluation Harnesses(17/27 越界)

| 项目 | 可借机制 | verdict |
|---|---|---|
| auto-harness | gate-as-deterministic-fact(gating.py 只产 exit code + pass_rate/val_score,不替 LLM 判断);file-guard allowlist(git diff 把"本轮允许触碰的文件"固化成确定性边界,越界即 fail,conservative-by-default);self-maintained 回归套件 suite.json 自增长 + learnings.md 强制追加 | adapt(高价值,但膨胀风险最高) |
| Meta-Harness | ONBOARDING 契约(所有字段填满或标 unknown 才出 spec;每次只问 1-2 个聚焦问题;显式筛 poor-fit / 数据泄漏 / budget);anti-parameter-tuning 自检(候选须改变根本机制非调参) | adapt |
| Promptfoo（README/设计层） | deterministic 断言(脚本可复算)作硬门 + model-graded(LLM-judge)作软门并用 pin model/低温/多次重复/聚合通过率抑制不可复现性 | reference-only(原则确认,不引断言 DSL/runner) |

### 2.6 Observability(11/14 越界)

| 项目 | 可借机制(clone 深读) | verdict |
|---|---|---|
| claude-code-reverse | parser.js 的 stableStringify 内容寻址去重 + refcount + 把频率推断显式命名为 `promptKindGuess`(guess 后缀,只产 advisory fact) | adapt(借脚本侧事实纪律;**拒 cli.js.patch 宿主二进制拦截 + visualize.html 可视化**) |

### 2.7 Guardrails, Security & Governance

| 项目 | 可借机制(clone 深读) | verdict |
|---|---|---|
| Haft | falsifiable decision contract gate(invariants/rollback/weakest_link + 可证伪 predictions[observable/threshold/verify_after],kernel 写入前逐字段校验返回 {field,hint});audit-visible explicit skip(`_skips`+`_skip_reason` 持久化);evidence decay / R_eff(formality+congruence+valid_until,过期触发 refresh);派生 projection 只读纪律(.haft/*.md 从 DB 重生、禁止手改) | adapt(全链路同域;拒把 BEAM runtime/embedding sidecar/FPF 本体塞单 binary 的膨胀) |
| Sponsio | pure-verdict/enforcement 彻底分离(Verdict 无副作用纯事实,enforcement 决策另一层);observe vs enforce 双模(shadow mode);assume/enforce 不对称(if=描述性 trigger 只评估,then=obligation 才 enforce) | reference-only(借设计词汇,拒 agent hot-path 拦截器 + LTL 引擎) |

---

## 三、跨类 gap 优先级清单

12 个跨类机制 gap。`边界安全`列指是否经核验不触碰 spec-first non-goal。

| # | gap | 证据项目 | value | cost | 边界安全 | 建议动作 |
|---|---|---|---|---|---|---|
| G1 | **工作态连续性**:轻量 state 文件 + SessionStart 重注入 + 脚本算 ready/next,专治 compaction 后丢失"在做什么/下一步" | sd0x / Trellis / Gas Town / claude-mem | high | low | ✅ | plan-next |
| G2 | **Knowledge provenance + 衰减元数据**:docs/solutions 每条加 source/confidence/author/time 头 + 保鲜期 refresh-trigger | ECC / Haft / gstack / agentmemory | high | low | ✅ | plan-next |
| G3 | **requirement 覆盖映射确定性 pass**:脚本提取 FR-/SC- key 与 task 引用、算 coverage%/术语漂移,LLM 判语义覆盖 | Spec Kit / auto-harness / Haft | high | medium | ✅ | plan-next |
| G4 | **brainstorm/PRD poor-fit 早筛 + budget/边界硬约束逼问 + "标 unknown 或保守默认"收口** | Meta-Harness / Spec Kit / auto-harness | high | low | ✅ | plan-next |
| G5 | **轻量可复跑自增长 regression 成功标准 artifact**:spec-work/debug 收尾固化可执行验证,下次必复跑 | auto-harness / Haft / Promptfoo | high | medium | ⚠️ | **dogfood-first** |
| G6 | **skill 三段式重构**:SKILL.md 导航 + scripts/ 确定性逻辑 + reference/ 按需文档 | Anthropic Skills / Agent Skills Spec / gstack | medium | medium | ✅ | plan-next |
| G7 | **reviewer 最小 structured verdict schema**:LLM 填 passes + 必引证据 file/line + 风险维度布尔位 | Claude Plugins / Haft / Promptfoo | medium | medium | ✅ | plan-next |
| G8 | **task pack schema 增 conflicts_with + parallel + ready 谓词** | CCPM / Beads / Archon | medium | medium | ✅ | plan-next |
| G9 | **init 写 runtime 前 realpath 路径穿越守卫 + 单分发方式 drift reason_code + BMP-safe 幂等块替换** | oh-my-agent / Trellis / claude-mem | medium | low | ✅ | **do-now** |
| G10 | **跨宿主归一化 session 事件 schema + 解析失败显式降级(raw_hash + synthetic + native_id 双轨)** | Sandbox Agent / hankweave / gstack | medium | medium | ✅ | plan-next |
| G11 | **session skeleton 全局内容寻址去重 registry**:重复大段 prompt/system-reminder/tool 定义抽 registry + ID 引用,refcount 作 advisory | claude-code-reverse / Sandbox Agent | medium | low | ✅ | plan-next |
| G12 | **readiness 失败两级化**:阻断后续 workflow vs 仅当前步降级两类 reason_code + 双信号条件激活 + 显式 opt-out | Symphony / Chorus / Serena | medium | low | ✅ | plan-next(随 v1.16) |

**与基线报告三缺口的合并去重**:基线报告的 ① per-需求 dossier 视图归入 G1 工作态连续性的 advisory 视图侧(非强制目录);② CI 反空测试条件归入 G3 覆盖映射 / G7 verdict schema 的确定性断言层;③ failure-mode→gate 显式映射表归入 G7 + 角色契约/治理文档侧。本文不重复展开,仅标注归属。

---

## 四、anti-patterns 防膨胀清单(拒绝形态)

10 类形态,**借机制可、引形态拒**。每条配越界理由。

1. **Knowledge/记忆做成常驻 memory server + 向量库 + dashboard**(claude-mem / Acontext / agentmemory):Knowledge 节点是 human-in-the-loop markdown + 轻量索引,已天然 progressive-disclosure。需此能力只能作外部 provider 经 ref 消费。
2. **Tasks/工作态做成图数据库或中心化存储引擎**(Beads Dolt / Chorus PGlite / CCPM "GitHub issues 即数据库"):只需 ready 谓词 + hash-ID,文件/轻量索引可实现,引 DB 即 storage 形态越界。
3. **worktree 编排/lifecycle 升级成 YAML 状态机引擎或强制 gate stop 阻塞**(Archon / sd0x / Symphony):spec-first 用 skill + LLM judgment,非刚性 YAML 引擎或 round/max_rounds 强制 stop。只借 worktree 隔离 + fresh_context。
4. **中心化 observability/trace/flywheel 平台**(agentic-stack / hankweave / ECC):event schema/failure 分类可借为 machine-readable facts,dashboard/flywheel/sentinel daemon/全量 observe-runner 越界。ECC continuous-learning 须限 opt-in 窄事件。
5. **运行 agent 的 sandbox VM / 执行底座 / HTTP 控制服务器 / session 持久化 replay 运行时**(Sandbox Agent / context-mode / Execution Substrates 19/25):spec-first 做 workflow harness 与证据闭环,不做执行底座。
6. **eval/benchmark 平台 + 断言 DSL 运行器**(Promptfoo / agentmemory / Sponsio):借"门 + 成功标准 + 判断分层 advisory 纪律",**regression artifact 必须保持单文件级 git-tracked,不得泛化成跑分平台**(G5 dogfood-first 的核心约束)。
7. **agent 执行热路径运行时拦截器 / guardrail 层 / 宿主二进制 patch 拦截**(Sponsio / claude-code-reverse):不在 tool_call 热路径拦截,不 patch 宿主二进制(版本耦合、init/update 即坏)。
8. **compliance/SOD/financial-governance/model-risk/A2A/delegation router 全塞中心 manifest**(GitAgentProtocol):会推成中心化规则引擎 + 硬编码专家系统,直接违反 Light contract。
9. **fork 或重造 SKILL/AGENTS 开放格式;自建 LSP/symbol 索引;多人多 agent RBAC 协作平台**(Anthropic Skills / Serena / Chorus):开放格式已标准化应作 consumer + generator;LSP 须作 MCP provider 消费;RBAC 是协作平台属性 spec-first 不需要。
10. **常驻多 agent team runtime / daemon / 进程基础设施**(Gas Town / Symphony / hankweave):护城河不在"能编排多 agent",借幂等/恢复/handoff 机制,拒 daemon/proxy/orchestrator state。

---

## 五、spec-first 已领先点(被对照确认)

1. **source-of-truth ↔ generated-runtime 投射边界 + init/doctor drift 检测是真护城河**:Trellis 同构 peer、oh-my-agent 近 1:1,且 spec-first 更克制(无常驻 server、无 14 平台铺张)。
2. **`Scripts prepare facts, LLM decides` 经得起对照**:auto-harness gate-as-fact / Sponsio pure-verdict / Haft SpecCoverage 三条独立收敛到这条分工。
3. **Light contract 的克制是优势**:对照 GitAgentProtocol manifest 膨胀,spec-first 拒 manifest schema 化是正确反过度工程姿势。
4. **覆盖 Codebase→Spec→Plan→Tasks→Code→Review→Knowledge 全链路是独特性**:Sponsio 只管 Code 执行一刻、Haft 同构却把全套塞单 binary,spec-first 以 prose+script projection 覆盖全链路且不膨胀。
5. **双宿主 prose+script projection 无 daemon/server**:优于 deepagents(语言绑定 SDK)、gastown/Symphony(常驻进程),是宿主无关的正确抽象层。
6. **作为开放格式 consumer + 双宿主 generator 而非 fork**:AGENTS.md 几乎 zero-gap adopt,managed block 注入治理锚点方向完全正确。
7. **spec-compound human-in-the-loop markdown 知识沉淀已天然 progressive-disclosure**,比 Acontext/agentmemory 托管 server 更克制。
8. **preview-first 优于 silent-write、source-first 优于 runtime-patch**:被 claude-code-reverse 的 cli.js.patch(宿主二进制拦截 init/update 即坏)反向印证为正确边界。
9. **拒绝中心化 server/DB/dashboard 本身是护城河**:236 项高 oob 比例集中在 spec-first 明确不做的形态,反证"克制即差异化"。
10. **confidence-gated findings / "advisory facts 不是 confirmed truth"**:被 Promptfoo 的 LLM-judge 复现性纪律(pin/低温/多次聚合)正面确认为成熟做法。

---

## 六、最小落地顺序建议

按"边界安全 + 成本/价值 + 哲学契合"排序,严守抗膨胀分级。

### do-now(1 项,无边界争议,立即可做最小版本)
- **G9 init/doctor 加固**:oh-my-agent 的 `ssotBase` realpath 守卫(投射前校验目标 realpath 等于或前缀于 SSOT 根)+ claude-mem 的 BMP-safe 幂等块替换 + Trellis 文件级 hash drift map。纯确定性、安全正向、低成本,直接收敛多宿主维护并加固投射安全。

### plan-next(各自走 brainstorm/plan,中型任务)
- **第一梯队(high value / low cost,最痛最合哲学)**:G1 工作态连续性(承载点为已装 Codex SessionStart hook,需补 Claude 侧对等投射)、G2 Knowledge provenance+衰减、G4 brainstorm poor-fit 早筛。
  - ⚠️ G4 触碰 `Requirements Readiness Gate`(MEMORY 记录:两条优化线合并去重产物,**改动前必读现状增量改,不重写**)。
- **第二梯队(high value / medium cost)**:G3 requirement 覆盖映射(脚本提取 key + LLM 判语义,**保留 LLM 判断空间,拒 constitution 硬 gate**)。
- **第三梯队(medium value)**:G6 skill 三段式、G7 reviewer verdict schema、G8 task pack 增字段、G10 跨宿主 session schema、G11 session skeleton 全局去重。
- **随 v1.16 排**:G12 readiness 两级化(与 capability-aware provider 既有方向一致,挂现有 reason_code 不新建)。

### dogfood-first(1 项,膨胀风险最高,先自仓验证守得住边界)
- **G5 regression 成功标准 artifact**:auto-harness 证明可极轻(单文件 gating.py + git-tracked suite.json + file-guard allowlist),但**一旦泛化成 runner/断言 DSL/eval 平台立刻越界**。必须先在 spec-first 自身仓库 dogfood 验证"单文件 + git-tracked"形态守得住,再考虑外推。

### defer
- G10/G12 中依赖 v1.16 capability-aware provider 与 MCP readiness 落地的部分,随 v1.16 节奏推进,不提前。

### reject(明确非目标,见第四节 10 类形态)
- 所有 server/DB/daemon/runner/sandbox/benchmark 平台/运行时拦截器/中心 manifest 规则引擎形态。**GitAgentProtocol 的 compliance/SOD/financial-governance 整块 reject**;Serena LSP 检索内建 reject(须作 provider 消费);Chorus RBAC reject。

---

## 七、诚实标注

- **⚠️ 覆盖缺口(关键,2026-06-07 补标)**:第 8 类 **Reference Harness Implementations(68 项目,占 236 的 29%,最大一类)的 deepdive 阶段在 workflow 中 6 次尝试全部 stall 失败**(每次 180s 无进展),其结构化 deepdive 结果**未纳入**本报告。因此本文第二节只有 2.1–2.7 共 7 类的可借机制表,**缺 Reference 类专章**;该类项目(Claude Code / OpenClaw / aider / SWE-agent / oh-my-codex / Cline 等同类 coding-agent harness)恰是 spec-first 最该对标的"同域参考实现",此缺口对结论完整性有实质影响。**已补跑**:Reference 类 16 个 high 项的 deepdive 已重跑(拆 4 路并行避免 stall,全部 clone 成功),增量发现见配套报告 [`2026-06-07-awesome-agent-harness-Reference类补充深读.md`](./2026-06-07-awesome-agent-harness-Reference类补充深读.md)(新增 R1-R6 共 6 个 gap,其中 R1 STRATEGY.md/CONCEPTS.md 揭示 Compound Engineering 是 spec-first 直系上游;补充报告结论:**未动摇本报告"克制即差异化"核心判断,反而强化**)。本报告第二节其余 7 类与跨类 gap 综合、anti-pattern、已领先点结论**不受影响**(均基于已成功的 33 项深读)。
- **证据强度**:本文所有可借 mechanism 均出自 33 个 `cloned:true` 项目的源码深读(evidence 字段有文件/行号);Promptfoo 因 clone 超时仅 README/设计层,其结论保守标注。triage 层项目不作机制依据。
- **覆盖口径**:236 全部经 relevance/boundary 分层,但 triage 名单是各簇 clone-worthy + 边界代表样本,非逐条枚举;低 relevance 项未单独取证。
- **gap 价值/成本是判断而非实测**:value/cost 列基于源码核验 + spec-first 现状对照的工程判断,各 gap 真实落地成本须在对应 brainstorm/plan 中重估。痛点量级(尤其 G1 compaction 续作、G5 regression)未做用户侧量化,故 G5 dogfood-first。
- **边界判断主观性**:`borrowable mechanism vs out-of-bounds form` 的切分依据 CLAUDE.md 角色契约,属架构判断;若角色契约演化,部分 reference-only 与 reject 判定需重评。
- **未验证**:236 中 out-of-bounds 项只验证形态越界,未深究实现;ECC README 的 star 数等营销数据已剔除,只采源码事实。
- **不替代既有排位**:本文 roadmap 建议是机制级输入,SCALE v1.15/v1.16/v1.17 既有排位与 brownfield onboarding 的 dogfood-first 裁决(见基线报告第八-十节)优先。
