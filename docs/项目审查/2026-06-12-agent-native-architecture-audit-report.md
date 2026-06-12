---
doc_role: review-report
authority: review-evidence
status: current
review_date: 2026-06-12
review_method: agent-native-audit rubric + bounded parallel explorer reviewers + sequential fallback
note: 本文是对 spec-first 当前仓库的 agent-native architecture audit 报告。发现与建议是 review evidence，不是已拍板实施计划；落地前仍需回源核对当前 source。
---

# 2026-06-12 spec-first agent-native architecture audit 报告

## 0. 结论先行

**总体判断：spec-first 已接近 agent-native harness 形态，公开 workflow 在 Claude/Codex 双宿主上基本具备 action parity，核心能力主要通过 `skills/`、`agents/`、`templates/` 的 prompt/prose 交付，CLI/scripts 多数承担确定性事实准备；当前主要差距集中在 runtime UI 同步、能力发现口径漂移、少数 legacy script 语义硬编码，以及动态上下文注入不够统一。**

本次总分为 **79%**。计算口径是 8 个原则百分比的简单平均，不按各原则分母加权。状态分布为 4 项 Excellent、4 项 Partial、0 项 Needs Work。

最重要的整改方向不是新增更多 agent，而是把现有 agent-native 形态的边界做实：统一 `update`/`init`/runtime refresh 口径，收敛能力发现面，清理 legacy semantic scripts，把高频 workflow 的动态上下文压成稳定 suffix，并让 doctor/runtime catalog 能明确反映 source/runtime freshness。

---

## 1. 审计方式与边界

### 1.1 执行方式

本次按 `skills/agent-native-audit/SKILL.md` 的 8 项原则执行完整审计，并加载 `skills/agent-native-architecture/SKILL.md` 的核心原则作为解释基线。

本次会话支持 sub-agent dispatch，因此先按 skill 要求并行派发 8 项只读 explorer 审计。并行阶段完成 5 项：

- Action Parity
- Tools as Primitives
- Context Injection
- UI Integration
- Capability Discovery

3 项 explorer 超时后被关闭，由当前 agent 顺序 fallback 完成：

- Shared Workspace
- CRUD Completeness
- Prompt-Native Features

因此，本报告不是“无法并行时的全量顺序执行”，而是 **bounded parallel first + 3 项 sequential fallback**。fallback 已在报告中作为局限记录。

### 1.2 适配口径

`spec-first` 不是传统带前端 UI 的业务应用，而是 Node.js CLI + 双宿主 workflow harness。因此本次 agent-native 术语按仓库实际形态适配：

| Agent-native 术语 | 本仓库审计映射 |
| --- | --- |
| UI/user action | 用户可见 CLI、公开 `$spec-*` / `/spec:*` workflow、README/doctor/help 引导、source docs 中的操作路径 |
| Agent tool | skills、agents、workflow prompts、CLI/scripts、host runtime adapters、MCP/provider readiness |
| UI integration | source 变更到 host runtime mirror、doctor/init/update 提示、runtime drift 可见性、workflow 输出反馈 |
| Shared workspace | 用户与 agent 共同操作的 git worktree、source-of-truth 文件、generated runtime mirror 边界 |
| CRUD entity | skills、agents、runtime assets、contracts、docs/review artifacts、provider readiness facts 等治理实体 |

### 1.3 非目标

- 不审计业务安全、性能或发布流程。
- 不把 generated runtime mirrors（`.claude/`、`.codex/`、`.agents/skills/`）当作 source 修复目标。
- 不运行 `spec-first init`、`clean`、`update` 等 state-changing runtime 修复命令。
- 不生成 `.spec-first/audits/**` 审计 artifact；本文是 `docs/项目审查/` 下的 durable review report。

---

## 2. 总评分表

| Core Principle | Score | Percentage | Status |
| --- | ---: | ---: | --- |
| Action Parity | 29/30 | 97% | Excellent |
| Tools as Primitives | 20/23 | 87% | Excellent |
| Context Injection | 10.5/15 | 70% | Partial |
| Shared Workspace | 8/10 | 80% | Excellent |
| CRUD Completeness | 6/8 | 75% | Partial |
| UI Integration | 6/10 | 60% | Partial |
| Capability Discovery | 5.5/7 | 78.6% | Partial |
| Prompt-Native Features | 18/22 | 82% | Excellent |

**Overall Agent-Native Score: 79%**

状态口径：

- Excellent：80% 及以上
- Partial：50% 到 79%
- Needs Work：低于 50%

---

## 3. 八项原则审计摘要

### 3.1 Action Parity: 29/30, 97%, Excellent

`spec-first` 的 action parity 很强。公开 workflow、CLI 命令、doctor/init/clean/update 生命周期、source docs 与 host runtime projection 之间大体有可追踪路径。用户可通过终端或 host workflow 做的主要操作，agent 基本也能通过同一 source/workflow/CLI 面完成。

主要缺口是能力发现口径存在漂移：`spec-first update` 当前是 package upgrade，而 runtime refresh 应指向 `spec-first init`；部分历史 `/spec:update` 或 `runtime-setup` alias 口径仍可能在文档、help 或 workflow map 中遗留。该问题不破坏核心 parity，但会让用户和 agent 对“下一步该运行什么”产生不一致理解。

### 3.2 Tools as Primitives: 20/23, 87%, Excellent

大多数 CLI/scripts 符合“tools prepare facts, LLM decides”：它们负责文件发现、runtime drift、schema/contract 校验、readiness facts、exit code 和 reason_code，而不替代 LLM 做架构判断。

主要例外集中在 legacy scripts：

- `scripts/review-judge.sh`
- `scripts/stage-gate.sh`
- `scripts/task-manager.sh`

这些脚本仍带有 review/gate/task 语义裁决味道，容易越过角色契约中 script-owned facts 与 LLM-owned judgment 的边界。建议要么退役为 legacy fixture，要么收敛为 primitive validators：只输出 schema/existence/freshness 等确定性事实，不输出语义 pass/fail 结论。

### 3.3 Context Injection: 10.5/15, 70%, Partial

仓库已经有较成熟的上下文治理：host instruction blocks、`context-bundle.v1`、provider readiness、startup reminder、session/workflow handoff、excluded context 等都在不同层面提供动态上下文。

缺口在于高频 workflow 还缺统一的轻量 dynamic suffix。当前可用事实分散在多个文档和 helper 中，但没有稳定注入一组最小运行态摘要，例如：

- `target_repo`
- branch
- dirty sample
- diff summary
- setup freshness
- `provider_untrusted`
- `excluded_context`

这导致不同 workflow 对同一运行态事实的消费密度不一致，容易出现有些路径能诚实降级、有些路径只能依赖模型记忆或临时 grep 的情况。

### 3.4 Shared Workspace: 8/10, 80%, Excellent

source/runtime 边界总体清楚：source-of-truth 在 `skills/`、`agents/`、`templates/`、`src/cli/`、`docs/`、README/CHANGELOG/package 等；generated runtime mirrors 不作为 source。用户和 agent 共享同一 git worktree 与同一 source 资产，而不是各自维护隐藏工作区。

主要风险不是共享 workspace 缺失，而是 runtime mirror 与 source 的新鲜度不能即时可见。source 改动后通常需要 `spec-first init` 并开启新 session 才能影响 host runtime；如果 doctor/runtime catalog 对漂移提示不够精确，用户会以为“source 已改即 runtime 已改”。

### 3.5 CRUD Completeness: 6/8, 75%, Partial

核心实体大多具备 create/read/update/delete 或等价生命周期：

- skill/agent source：可新增、读取、修改、删除，并通过 governance/tests/init 投影。
- runtime mirrors：可 init 生成、doctor 读取、clean 删除，但不应手工 update 作为 source。
- docs/review artifacts：可新增、读取、修订、退役，CHANGELOG 提供外部可见记录。
- provider readiness facts：可生成、读取、刷新、降级。

缺口在于 runtime catalog freshness 和 capability discovery 的“read/update”关系不够统一；某些实体的删除/退役路径依赖文档纪律或人工判断，而不是轻量 deterministic preview。

### 3.6 UI Integration: 6/10, 60%, Partial

本仓库没有传统 UI，因此本项主要审计“agent/source actions 是否能及时反映到用户可见 runtime surface”。当前 init/doctor/clean/update 能覆盖大部分生命周期，但不是即时联动。

子审计中实际运行过 `doctor --json`，发现当前 runtime 存在 drift warning。该事实说明 UI/runtime integration 具备检测面，但也暴露出一个产品体验问题：source 改动、runtime 投影、host session 缓存三者之间的状态必须更显式，否则用户不容易判断当前 host 正在使用哪一版能力。

建议增加 runtime catalog freshness 到 `doctor --json` 或能力 surface 中，并在 skill/agent/source 变更 closeout 固定报告 runtime impact：无需刷新 / run init for Claude / run init for Codex / both。

### 3.7 Capability Discovery: 5.5/7, 78.6%, Partial

能力发现已有多个入口：README、README.zh-CN、AGENTS/CLAUDE bootstrap、using-spec-first route map、CLI help、doctor help、skill descriptions、workflow docs。整体覆盖高，但多 surface 口径漂移风险也高。

当前最需要收敛的是 canonical capability surface。建议新增或强化类似 `spec-first capabilities` 的只读命令，从治理 catalog 同源展示：

- public workflows
- standalone skills
- CLI commands
- host-specific entrypoint
- generated runtime availability
- deprecated/legacy/internal-only 标记

这会把 README、bootstrap、runtime catalog、CLI help 和 doctor help 的发现面接到同一事实源，减少“某处还推荐旧入口”的漂移。

### 3.8 Prompt-Native Features: 18/22, 82%, Excellent

`spec-first` 的核心能力高度 prompt-native：workflow 行为、review rubric、planning posture、debug discipline、source/runtime governance、provider evidence boundary 等主要写在 skills/agents/templates 的 prose 中，而不是硬编码到中心化状态机里。CLI/scripts 多数只提供 deterministic facts。

主要扣分点仍是 legacy semantic scripts 和少数 contract/help prose 漂移。它们不会推翻 prompt-native 主体形态，但会产生“源码哲学说 LLM decides，旧脚本却在局部替 LLM 判定”的自指不一致。

---

## 4. 高置信问题

### 4.1 Runtime UI 不即时同步

source 改动需要 `spec-first init` 投影，再由新 host session 读取。这个边界本身合理，但用户可见反馈仍不够强。当前 doctor 能报告 drift warning，但 runtime catalog freshness、host session cache impact、是否需要 Claude/Codex 单侧刷新，仍需要更结构化地出现在 closeout 和 doctor 输出中。

影响：用户或 agent 可能误以为 source 变更已经在当前 runtime 生效，尤其是 skill/agent prose 改动。

### 4.2 能力发现面漂移

`update` 语义、`runtime-setup` alias、历史 `/spec:update` 说法、README/doctor help/workflow map/CLI help 的一致性需要继续钉牢。该类问题会直接降低 action parity 的实际可用性，因为用户和 agent 可能在不同 surface 上获得不同入口建议。

影响：下一步指引可能错误，agent 可能建议不存在或语义已变的入口。

### 4.3 Legacy scripts 仍在做语义判断

`scripts/review-judge.sh`、`scripts/stage-gate.sh`、`scripts/task-manager.sh` 与当前角色契约的 script/LLM 分工不完全一致。它们应被降级为 legacy fixture 或 primitive validators。

影响：旧测试或旧路径可能继续强化“脚本输出 review/gate 结论”的反模式。

### 4.4 动态上下文注入不统一

`context-bundle.v1` 与相关 helper 已经存在，但高频 workflow 没有统一、轻量、稳定的 dynamic suffix 注入面。当前更多靠各 workflow 自己读取、总结和声明。

影响：降级状态、provider 不可信、dirty worktree、target repo、runtime freshness 等关键事实在不同 workflow 中显隐不一。

---

## 5. Top 10 recommendations by impact

| Priority | Action | Principle | Effort |
| ---: | --- | --- | --- |
| 1 | 统一 `update` 合同：`spec-first update` 表示 package upgrade；runtime refresh 统一指向 `spec-first init`。 | Action Parity / Capability Discovery | Small |
| 2 | 收敛 `runtime-setup` 命名；alias 未真正落地前，不把它作为当前用户入口推荐。 | Capability Discovery | Small |
| 3 | 新增或强化 canonical capability surface，例如 `spec-first capabilities`，从治理 catalog 同源展示 public workflows、standalone skills、CLI commands 和 host entrypoints。 | Capability Discovery | Medium |
| 4 | 将 `review-judge.sh`、`stage-gate.sh`、`task-manager.sh` 改成 primitive validators 或标记为 legacy fixture。 | Tools as Primitives / Prompt-Native Features | Medium |
| 5 | 为高频 workflow 统一 dynamic context suffix：`target_repo`、branch、dirty sample、diff summary、setup freshness、`provider_untrusted`、`excluded_context`。 | Context Injection | Medium |
| 6 | `doctor --json` 增加 runtime catalog freshness 与 host-side refresh guidance。 | UI Integration / Shared Workspace | Medium |
| 7 | 修复 runtime drift false-positive：排除 `__pycache__/**/*.pyc` 等不应参与 skill support integrity 的文件。 | UI Integration | Small |
| 8 | skill/agent/source 变更 closeout 固定报告 runtime impact：无需刷新 / run init for Claude / run init for Codex / both。 | Shared Workspace / UI Integration | Small |
| 9 | 在 `using-spec-first` 增加“能力自描述模式”，用于回答“我本地能用哪些能力、如何调用”。 | Capability Discovery | Medium |
| 10 | 为 README、bootstrap、runtime catalog、CLI help、doctor help 增加一致性测试，防止入口漂移复发。 | Action Parity / Capability Discovery | Medium |

---

## 6. 亮点清单

1. **Source/runtime 边界清晰。** 仓库反复强调 source-of-truth 与 generated runtime mirrors 分离，且常规修复路径指向 source + `spec-first init`，不是手改 runtime。
2. **Prompt-native 主体强。** 核心 workflow 行为主要由 SKILL/agent/template prose 表达，符合“features are prompts defining outcomes”的方向。
3. **Tool primitive 意识成熟。** 多数 CLI/scripts 输出 deterministic facts、reason_code、exit code、schema validation，而不是替 LLM 做最终语义判断。
4. **双宿主 parity 基础好。** Claude/Codex 入口治理、runtime projection、doctor/init/clean 生命周期都有明确映射。
5. **诚实降级文化稳定。** `provider_untrusted`、degraded mode、excluded context、readiness facts 等概念已经成为多处 contract 的共同语言。

---

## 7. 证据、局限与后续使用

### 7.1 直接证据路径

本报告使用的主要 source 路径包括：

- `skills/agent-native-audit/SKILL.md`
- `skills/agent-native-architecture/SKILL.md`
- `skills/using-spec-first/SKILL.md`
- `skills/spec-work/SKILL.md`
- `skills/spec-work/references/shipping-workflow.md`
- `docs/10-prompt/结构化项目角色契约.md`
- `AGENTS.md`
- `CHANGELOG.md`
- `docs/项目审查/2026-06-10-全项目综合审查报告.md`

### 7.2 局限声明

- 5 项原则由并行 explorer 完成，3 项原则因 explorer 超时改由当前 agent 顺序完成；该 fallback 不影响 8 项覆盖，但会降低跨 reviewer 独立性。
- 原始 explorer 输出存在于会话上下文中，未写入 `.spec-first/audits/**`。本文是收敛后的审查报告，不是机器可复放的审计 artifact。
- `doctor --json` 的 runtime drift warning 来自 UI Integration 子审计运行结果；本文没有再次执行 runtime 修复命令。
- 分数是 LLM-owned judgment，依赖 source 证据和 audit rubric；不是 deterministic script verdict。

### 7.3 建议消费方式

本报告可作为后续 `$spec-plan` 或 `$spec-work` 的输入证据，但不应被直接当作实施计划。若要落地整改，建议按第 5 节拆成小切片，每个切片重新回源确认：

- 目标和非目标
- source-of-truth 与 generated runtime 边界
- script-owned facts 与 LLM-owned judgment 分工
- README/docs/CHANGELOG 是否同步
- Claude/Codex runtime impact
- focused tests 或 doc-contract checks
