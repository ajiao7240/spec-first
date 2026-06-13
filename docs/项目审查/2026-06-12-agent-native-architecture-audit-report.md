---
doc_role: review-report
authority: review-evidence
status: current
review_date: 2026-06-12
last_updated: 2026-06-13
review_method: agent-native-audit rubric + 10-lens bounded parallel explorers + adversarial verification (43 agents) + source re-confirmation; consolidates the 2026-06-12 8-principle pass
note: 本文是对 spec-first 当前仓库的 agent-native architecture audit 报告。2026-06-13 用更严格的 10-lens + 对抗验证重跑并与 2026-06-12 首轮发现汇总收敛。发现与建议是 review evidence，不是已拍板实施计划；落地前仍需回源核对当前 source。
---

# spec-first agent-native architecture audit 报告（2026-06-12 首轮 + 2026-06-13 收敛）

## 0. 结论先行

**spec-first 本身就是一个高度成熟的 agent-native 系统，并且是同类中的范本级实现。** 它把 agent-native taxonomy 几乎 1:1 落到自身工程哲学上：核心信条 **"Scripts prepare, LLM decides / Light contract + Explicit boundaries / Gate the exits, not the thinking"** 正是 "primitive tools + prompt-native judgment" 的精确表述。

递归映射（spec-first 作为被审计的 agent-native 系统）：

| Taxonomy 概念 | spec-first 对应物 |
| --- | --- |
| Users | 开发者（驱动 Claude/Codex 的人） |
| Agents | 执行 `/spec:*` / `$spec-*` workflow 的 Claude/Codex（在 loop 中运行） |
| Primitive tools | CLI（init/doctor/clean/update/tasks/session）+ skill scripts + MCP provider |
| Prompt-native features | SKILL.md / agent profile / template prose |
| Shared workspace | git repo + `.spec-first/**` artifacts |
| Context injection | SessionStart 注入 + CLAUDE.md/AGENTS.md managed blocks |
| Production guardrails | mutation gate、redaction、honest-closeout、source/runtime 边界 |

**两轮综合判断：10-lens 简单平均 74%；剔除两个 Partial 维度（CRUD 广度、Eval 覆盖）后为 82%。** 这个差值本身就是结论：**8 个架构核心 lens 全部 ≥71%（其中 6 个 ≥83%），只有 CRUD 广度(50%) 与 Eval 覆盖(30%) 两项把均值拖低。** 短板集中在覆盖广度，而非架构。架构层面（parity / prompt-native / shared-workspace / source-runtime 边界）已是范本级，无需结构性改动。

**对抗验证的价值在本轮非常显著：** 2026-06-13 重跑的初判 10 Critical / 21 Warning 中，**6 个被证伪 drop、约 13 个从 Critical/Warning 降级为 Observation**——因为它们把 spec-first 的**有意设计**误判为缺陷（内部 helper 故意隐藏、脚本故意不做语义决策、generated mirror 故意非 source、light-contract 故意不硬化语义层）。**只有 6 个 Warning 经得起推敲，且全部是加固级别，无一是架构缺陷。**

---

## 1. 审计方式与边界

### 1.1 两轮执行方式

| 轮次 | 日期 | 方法 | 覆盖 |
| --- | --- | --- | --- |
| 首轮 | 2026-06-12 | 8-principle rubric，bounded parallel first（5 项）+ 3 项 sequential fallback | `skills/agent-native-audit/SKILL.md` 8 原则 |
| 收敛轮 | 2026-06-13 | 10-lens（8 原则 + production-guardrails + eval-readiness），全并行 explorer + **对抗式二次验证**（43 agents，2.2M tokens），高分发现回源独立复核 | canonical taxonomy 全量 |

收敛轮把 Critical/Warning 全部送入对抗 reviewer（默认证伪立场），并对其中 W3（clean 确认门）、W5（check-health URL 重复）做了我本人的源码独立复核。

### 1.2 适配口径

`spec-first` 不是传统带前端 UI 的业务应用，而是 Node.js CLI + 双宿主 workflow harness。agent-native 术语按仓库实际形态适配：

| Agent-native 术语 | 本仓库审计映射 |
| --- | --- |
| UI/user action | 用户可见 CLI、公开 `$spec-*` / `/spec:*` workflow、README/doctor/help 引导、source docs 中的操作路径 |
| Agent tool | skills、agents、workflow prompts、CLI/scripts、host runtime adapters、MCP/provider readiness |
| UI integration | source 变更到 host runtime mirror、preview-first 写入、doctor/init/update 提示、workflow 输出反馈 |
| Shared workspace | 用户与 agent 共同操作的 git worktree、source-of-truth 文件、generated runtime mirror 边界、`.spec-first/**` artifacts |
| CRUD entity | spec/plan/tasks/review/knowledge、runtime assets、contracts、provider readiness facts、changelog、developer profile |

### 1.3 非目标

- 不审计业务安全、性能或发布流程。
- 不把 generated runtime mirrors（`.claude/`、`.codex/`、`.agents/skills/`）当作 source 修复目标。
- 不运行 `spec-first init`、`clean`、`update` 等 state-changing runtime 修复命令。
- 不生成 `.spec-first/audits/**` 审计 artifact；本文是 `docs/项目审查/` 下的 durable review report。
- 未运行 fresh-source eval：本轮为只读源码审查，未触发 agent/skill prose 变更，无会话缓存风险；如需对 reviewer agent 行为做行为级验证，应另跑 fresh-source eval。

---

## 2. 总评分表（2026-06-13 对抗验证后）

| Core Principle (canonical lens) | Score | 状态 | 说明 |
| --- | ---: | --- | --- |
| Action Parity | 27/30 (90%) | ✅ Excellent | 全生命周期可达；3 个 CLI-only（init/clean/repair-worktree）是有意边界 |
| Primitive Tools | 34/48 (71%) | ✅ Good | 验证后绝大多数"违规"是误判；真实残留 2 处小问题 + 3 个 dead legacy 脚本 |
| Context Injection | 13/17 (76%) | ✅ Good | 注入机制健全；可强化显式能力图/readiness facts 注入 |
| Shared Workspace | 8/9 (88%) | ✅ Excellent | 单一 source-of-truth，无 sandbox/sync-layer 反模式 |
| CRUD Completeness | 5/10 (50%) | ⚠️ Partial | 验证后多数"缺 DELETE"被证伪；唯一真实点：Plan 无 agent 可达归档/删除 |
| UI Integration（no silent write） | 15/18 (83%) | ✅ Excellent | preview-first + 路径播报，无 silent action |
| Capability Discovery | 18/21 (86%) | ✅ Excellent | 路由表 + README + guide mode + 故意隐藏 internal helper |
| Prompt-Native Features | 18/20 (90%) | ✅ Excellent | workflow 逻辑全在 prose，CLI 仅做确定性 prep——**零降级发现** |
| Production Guardrails | 6/8 (75%) | ✅ Good | redaction/tracing/checkpoint/completion 齐备；2 处可加固 |
| Eval Readiness | 11/37 (30%) | ⚠️ Partial | **唯一系统性短板**：高频 workflow 缺 boundary/failure eval fixture |

**综合 agent-native 成熟度：10-lens 简单平均 74%；剔除 CRUD/Eval 两个 Partial 维度后 82%。** 计算口径：10 项百分比简单平均（不按分母加权）= 73.9%；若只看 8 个架构核心 lens（剔除 CRUD 50%、Eval 30%）= 82.4%。状态分布：8 项 Excellent/Good，2 项 Partial（CRUD、Eval）。短板集中在覆盖广度，非架构。

> 与 2026-06-12 首轮（8 原则简单平均 79%）方向一致。本轮 10-lens 全平均（74%）低于首轮，主要因为新增的 Eval Readiness(30%) 是首轮未单列的维度，且对抗验证对 CRUD 做了保守降级；架构核心 lens 两轮均为高分。两轮无方向性冲突。

---

## 3. 真正成立的发现（6 个 Warning，按优先级）

### W1 · Eval readiness 是唯一系统性短板 ⚠️ 最高优先级
**Lens:** eval-readiness · **验证:** partially-confirmed（从 Critical 降级）

- **事实：** 18 个 public workflow 中 14 个没有 `evals/` fixture（spec-plan、spec-code-review、spec-compound、spec-debug、spec-optimize、spec-mcp-setup 等高频在列）。仅 6 个有结构化 eval（spec-work、spec-write-tasks、spec-prd、spec-doc-review、using-spec-first、spec-skill-audit）。
- **为何降级而非 Critical：** `eval-readiness-rubric.md` 明确 eval 是 **"recommended for high-traffic"** 而非全量强制；`skill-agent-quality-governance.md:77` 显式豁免 optional/internal skill。"14 个全算 Critical"是过度判定。
- **真实差距：** 高频、决策关键的 workflow（**spec-plan / spec-code-review / spec-compound / spec-debug**）应有 `trigger-cases.json` + `boundary-cases.json` 防路由/范围回归，当前与 spec-write-tasks 的完备 eval 形成可见不对称。
- **建议：** Phase-1 仅补这 4 个高频 workflow 的 boundary/trigger fixture，复用 `spec-work/evals/examples.json` 结构。**不要**给全部 14 个补——会违反 light-contract。

### W2 · Plan 实体缺 agent 可达的 DELETE/归档 ⚠️
**Lens:** crud-completeness · **验证:** partially-confirmed（从 Critical 降级）

- **事实：** `docs/plans/*.md` 有 CREATE（spec-plan）、READ（work/review/write-tasks）、UPDATE（plan deepening），但只有 status 标记（completed/superseded/backlog），**无 workflow 级删除/归档**（`docs/validation/2026-05-12-plan-lifecycle-cleanup.md` 佐证）。
- **对比：** Knowledge/solutions 实体有完整 CRUD（spec-compound-refresh 支持 consolidate/replace/stale-mark/delete + 入链安全检查）——这是正确范式，Plan 未对齐。
- **建议：** 提供 agent 可达的 plan 归档路径（如 `spec-plan --archive <path>` 或统一 `spec-archive` 退役 plan/旧 solution）。优先级中等：status frontmatter 已是"可接受的 metadata-only 生命周期"，但归档缺失会让 `docs/plans/` 持续累积。

### W3 · 破坏性 mutation 缺强制确认门 ⚠️
**Lens:** production-guardrails · **验证:** partially-confirmed（已从源码独立复核确认）

- **事实（源码确认）：** `src/cli/commands/clean.js:107` 在非 `--dry-run` 时直接 `applyOperationPlan` 删除 managed assets，**没有 confirm 门**。对比 `clean --workspace-orphans` 走 `--confirm` 显式确认（行 196-200）——同一命令内两条路径确认强度不一致。
- **细节：** `src/cli/prompts/index.js` 已提供 `confirm()` 基础设施，但 `clean --claude/--codex` 主路径未调用。
- **为何只是 Warning：** clean 仅移除 spec-first **managed** assets（可由 `spec-first init` 重建），可逆性高；且有 `--dry-run` 预览。按 guardrails "approval by stakes/reversibility"，属"低 stakes 但应快速确认"档。
- **建议：** 给 `clean --claude/--codex` 主路径加一次显式确认（或要求 `--yes`），与 `--workspace-orphans` 对齐。

### W4 · schema-validator 错误缺机器可读 reason_code ⚠️
**Lens:** primitive-tools · **验证:** partially-confirmed

- **事实：** `src/contracts/schema-validator.js:47-199` 的 `validateAgainstSchema()` 输出 prose 错误串（"value did not match anyOf"），**非结构化 reason_code**。角色契约 §4 明确要求 scripts 输出 "machine-readable facts / reason_code / exit code"。
- **影响：** downstream workflow 无法编程式区分"type_mismatch 可恢复"vs"required_missing 不可恢复"，只能重解析 prose。
- **建议：** 给每个 error 对象加 `reason_code`（`type_mismatch`/`enum_violation`/`required_missing`/`pattern_mismatch`），逻辑不变，仅补字段。

### W5 · check-health 残留硬编码 helper URL（与 registry 双份维护）⚠️
**Lens:** primitive-tools · **验证:** confirmed（已从源码独立复核确认）

- **事实（源码确认）：** `skills/spec-mcp-setup/scripts/check-health:56-68` 的 `build_project_url()` 仍把 helper URL（agent-browser、gh、jq、vhs、silicon、ffmpeg、ast-grep）**内联在 case 语句里**——而**同一文件**的 install-command 路径（行 48-53）已委派给 `lib-helper-registry.sh`，且 `helper-tools.json` registry 里就有 `safety.source_repo`。一处真实、孤立的双份维护漂移。
- **建议：** 让 `build_project_url()` 也从 `lib-helper-registry.sh`/`helper-tools.json` 读 `source_repo`，消除内联 case。低风险、纯收敛。

### W6 · agent-native-architecture 的 guardrail 映射缺下游可发现性 ⚠️
**Lens:** eval-readiness · **验证:** partially-confirmed

- **事实：** guardrail 约束**确实存在**于各 workflow（spec-work 的 `review_gate`/`stop_if`/secret-deny；spec-code-review 的 `sensitive_diff`；spec-mcp-setup 的显式 opt-in consent），但**没有一处索引**把 `runtime-production-guardrails.md` 的 8 类 guardrail 映射到"哪个 workflow 应用哪条"。
- **本质：** 可审计性/可发现性差距，非 enforcement 或正确性缺陷——guardrail 在跑，只是审计者/新贡献者要逐个读 SKILL.md prose 才能拼全图。
- **建议：** 在 `agent-native-architecture/references/` 加一张 "Guardrail Capability Index"（workflow × guardrail 矩阵）。纯文档，不改行为。

---

## 4. 首轮（2026-06-12）独有的仍然成立发现

收敛轮的 lens 聚焦 `src/cli/` + `skills/*/scripts/`，未扫到顶层 `scripts/*.sh` 与命名口径漂移。首轮以下发现经本次回源复核**仍然成立**，与上面 6 项互补：

### L1 · Legacy semantic scripts 仍在仓库（dead fixture，应退役）⚠️
- **回源确认：** `scripts/review-judge.sh`、`scripts/stage-gate.sh`、`scripts/task-manager.sh` 仍存在。`review-judge.sh` 直接在脚本里输出 `pass: false / reason: 关键维度低于底线` 等**语义裁决**，违反角色契约 script/LLM 分工。
- **新事实（降低紧迫度）：** 三者仅被 `docs/01-需求分析`、`docs/03-实施方案`、`docs/09-业界借鉴` 等旧设计文档引用，**未被任何 live `src/cli/` 或活跃 skill wire**——是孤立 legacy fixture，不是生产路径上的反模式。
- **建议：** 退役为 legacy fixture（移入归档目录或标注 deprecated header），或收敛为只输出 schema/existence/freshness 的 primitive validator。优先级低，因无活跃消费者。

### L2 · `/spec:runtime-setup` alias 口径漂移 ⚠️
- **回源确认：** `templates/claude/commands/spec/mcp-setup.md:10` 写明 "recommended future user-facing entrypoint is `/spec:runtime-setup`; this template remains until the alias contract is implemented." 该 alias 尚未落地，但已作为"推荐未来入口"出现在 template prose。
- **建议：** alias 未真正实现前，不在文档/help/workflow map 中把它当当前用户入口推荐，避免 capability discovery 漂移。

### L3 · `update` 语义与 runtime refresh 口径需钉牢
- `spec-first update` 当前是 check-only 版本/freshness 检查（`src/cli/index.js:56` → `runUpdate`，从不自动升级），runtime refresh 实际指向 `spec-first init`。README/doctor help/CLI help/workflow map 应保持这一口径一致，防止"下一步该运行什么"漂移。

### L4 · runtime drift 可见性可加强
- 首轮 `doctor --json` 子审计观测到 runtime drift warning（含 `__pycache__/**/*.pyc` 之类不应参与 skill support integrity 的 false-positive 候选）。建议：(a) 排除非源文件；(b) 在 `doctor --json` 暴露 runtime catalog freshness + host-side refresh guidance；(c) skill/agent/source 变更 closeout 固定报告 runtime impact（无需刷新 / run init for Claude / run init for Codex / both）。

---

## 5. 被对抗验证证伪 / 降级的发现（审查诚实度记录）

以下 2026-06-13 初判**不应进入待办**，因为误读了有意设计：

| 初判 | 结论 | 为何被推翻 |
| --- | --- | --- |
| `instruction-bootstrap.js` 做"策略判断"（Critical） | misframed→Observation | marker-based 块管理是确定性文本操作，非语义决策 |
| `task-pack.js deriveValidity()` 做"语义分类"（Warning） | misframed→Observation | 是 schema 校验输出 validity，非架构判断 |
| readiness facts 未在 SessionStart 注入（Critical） | misframed→Observation | 故意：setup 产 facts，workflow 按需消费，非启动期强注入 |
| Requirements/TaskPack/Review/Changelog "缺 DELETE" | refuted→drop | TaskPack 故意 derived/ephemeral；Changelog 是 append-only 设计；均非真实缺口 |
| public workflow "无 Failure Modes section"（Critical） | refuted→drop | 测试用 case-insensitive 文本匹配，所有 20 个 skill 实际都有（表格或 h3 形式），测试 PASS |
| fresh-source eval "未强制执行"（Critical） | refuted→Observation | 故意 conditional：dispatch 不可用时记录 `not_run` + fallback evidence，强制化会违反 light-contract |
| "无单一清单列出隐藏 skill"（Warning） | refuted→drop | 每个 internal skill 自带 `disable-model-invocation`/internal notice，分布式标记有效 |

---

## 6. 做得卓越的地方（Top 7）

1. **Prompt-native 纯度满分（零降级发现）：** workflow 逻辑 100% 在 SKILL.md prose，`src/cli/adapters` 只做确定性路径改写，**无 workflow 状态机硬编码**——完美贯彻 "gate the exits, not the thinking"。
2. **Shared-workspace 无反模式：** 单一 source-of-truth（repo + `.spec-first/`），source/runtime split 由 contract test 机械强制，**无 sandbox 隔离、无 sync-layer、无 dual-write**。
3. **Source/runtime 边界是教科书级 guardrail：** generated mirror（`.claude/.codex/.agents/skills`）被测试套件阻止当 source 改，唯一再生路径是 `spec-first init`。
4. **honest-closeout 完成语义：** closeout claim 必须指向结构化 evidence；诚实上报 `not-run/failed/degraded` 会降级 verdict 而非伪造通过——直击 "completion semantics + tracing" 两大 guardrail。
5. **Preview-first 落地：** init 强制 diagnostics→preview→confirm→apply→announce，artifact 路径带 emoji 播报，atomic write 防半写，**无 silent action**。
6. **Context governance 显式化：** 默认排除 runtime/audit/mirror，summary-first + reason_code，cache-friendly prompt layout（稳定前缀 + 动态后缀）。
7. **双宿主对称 + 路由成熟：** Claude/Codex 特性对等，using-spec-first 路由表覆盖全意图且不强制 brainstorm-first，internal helper 正确隐藏。

---

## 7. 行动清单（按 ROI 排序）

| 优先级 | 行动 | 来源 | Lens / Principle | Effort |
| ---: | --- | --- | --- | --- |
| P1 | 给 spec-plan/code-review/compound/debug 补 `trigger`+`boundary` eval fixture（仅这 4 个高频） | W1 | eval-readiness | 中 |
| P2 | `clean --claude/--codex` 主路径加确认门，与 `--workspace-orphans` 对齐 | W3 | guardrails | 小 |
| P2 | `check-health` 的 `build_project_url()` 改读 registry，消除双份维护 | W5 | primitive | 小 |
| P2 | 统一 `update` 合同 + 钉牢 `/spec:runtime-setup` alias 口径，未落地前不作当前入口推荐 | L2/L3 | capability-discovery | 小 |
| P3 | 提供 Plan 归档/退役的 agent 可达路径（对齐 solutions CRUD 范式） | W2 | crud | 中 |
| P3 | schema-validator error 加 `reason_code` 字段 | W4 | primitive | 小 |
| P3 | 加 "Guardrail Capability Index"（workflow×guardrail 矩阵）参考文档 | W6 | eval-readiness | 小 |
| P3 | 退役 `review-judge.sh`/`stage-gate.sh`/`task-manager.sh`（dead legacy）为 fixture 或 primitive validator | L1 | primitive | 中 |
| P4 | `doctor --json` 增 runtime catalog freshness + host refresh guidance；排除 `__pycache__/*.pyc` false-positive；closeout 固定报告 runtime impact | L4 | ui-integration | 中 |

**一句话总结：** spec-first 在 agent-native 7 大原则上已是范本级实现，真正的提升空间只剩一个维度——把已经很强的 eval/guardrail **可发现性与高频 workflow 覆盖**补齐；架构层面无需改动。

---

## 8. 证据、局限与后续使用

### 8.1 直接证据路径

- `skills/agent-native-architecture/SKILL.md` + `references/checklists.md` + `references/runtime-production-guardrails.md`（rubric）
- `skills/agent-native-audit/SKILL.md`、`agents/spec-agent-native-reviewer.agent.md`
- `skills/using-spec-first/SKILL.md`（router = capability discovery + context injection）
- `src/cli/index.js`、`src/cli/instruction-bootstrap.js`、`src/cli/commands/clean.js`
- `src/contracts/schema-validator.js`、`skills/spec-mcp-setup/scripts/check-health`
- `docs/contracts/context-governance.md`、`docs/contracts/workflows/honest-closeout.md`
- `docs/10-prompt/结构化项目角色契约.md`、`templates/claude/commands/spec/mcp-setup.md`
- `skills/agent-native-architecture/evals/examples.json`、`tests/unit/agent-native-architecture-eval-readiness.test.js`
- `docs/validation/2026-05-12-plan-lifecycle-cleanup.md`
- 前序：`docs/项目审查/2026-06-10-全项目综合审查报告.md`、本文 2026-06-12 首轮

### 8.2 局限声明

- 收敛轮 10 lens 全并行 + 对抗验证（43 agents，2.2M tokens）；W3/W5 由审查者本人回源复核确认，其余 Warning 依赖对抗 reviewer 的 source_check。
- 首轮 8 项中 3 项为 sequential fallback，跨 reviewer 独立性较低；收敛轮已用全并行覆盖。
- 原始 explorer/verifier 输出在会话上下文中，未写入 `.spec-first/audits/**`。本文是收敛后的 durable review report，不是机器可复放的审计 artifact。
- 分数是 LLM-owned judgment，依赖 source 证据与 audit rubric；不是 deterministic script verdict。
- 未运行 runtime 修复命令；未运行 fresh-source eval（本轮无 prose 变更）。

### 8.3 建议消费方式

本报告可作为后续 `/spec:plan` 或 `/spec:work` 的输入证据，但不应被直接当作实施计划。落地整改建议按第 7 节拆成小切片，每个切片重新回源确认：目标/非目标、source-of-truth 与 generated runtime 边界、script-owned facts 与 LLM-owned judgment 分工、README/docs/CHANGELOG 是否同步、Claude/Codex runtime impact、focused tests 或 doc-contract checks。
