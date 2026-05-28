---
title: Comprehensive Skill / Agent Review
date: 2026-05-05
host: codex
author: leokuang
scope: spec-first source skills and agents
status: completed-source-review
---

# Comprehensive Skill / Agent Review

## 结论

本轮审查的结论是：现有 skill / agent 体系足以承载当前 self-reflection capability upgrade，不需要新增 `spec-evolve`，也不需要新增 agent。真实能力缺口不是缺少专家角色，而是 workflow-owned dispatch 在部分 skill / runtime projection 中被错误表达成额外用户确认 gate，导致 Codex host 即使拥有 `spawn_agent` 也可能降级为 single-agent fallback。该根因已按 source-first 修复，并补了跨 Claude / Codex 的防回归测试。

当前状态不是“所有 skill 已最优”。最新机器审计显示 42 个 source skills 中 P0 为 0，P1 为 193，P2 为 120，平均分 63；其中大量 P1/P2 是标准 section、eval readiness、runtime drift、security signal 的结构性债务。语义判断后，本轮必须完成的 P0/P1 行为缺陷是 dispatch 授权边界和 scanner 误报治理；剩余问题进入后续 roadmap，不能由脚本自动 rewrite。

## 审查依据

- 角色契约：`docs/10-prompt/结构化项目角色契约.md`
- 机器事实：`.spec-first/audits/skill-audit/latest/*`
- 修复日志：`docs/2026-05-05-skill-agent-audit/fix-log.md`
- 变更验证：`tests/unit/spec-dispatch-boundary-contracts.test.js`、相关 workflow contract tests
- Source truth：`skills/`、`agents/`、`AGENTS.md`、`CLAUDE.md`、`src/cli/adapters/codex.js`

本报告把 `.spec-first/audits/` 当作执行证据，不当作 source truth。脚本只准备 facts；是否构成能力缺口、是否接受升级、是否需要进入 plan / review / compound，由 LLM / reviewer 判断。

## 双宿主 Dispatch Rule

统一规则如下：

- Claude Code 使用 `Agent` / `Task` 等宿主 dispatch primitive。
- Codex 使用 `spawn_agent`。
- 直接进入当前 host 的公开 workflow 时，workflow 文档中明确的 reviewer / researcher / resolver / helper phase 默认由 workflow invocation 授权，不再要求第二次“是否使用 subagents”的确认。
- fallback 只允许来自：dispatch primitive 不存在、runtime 无法调用、用户显式 `no-agents` / `report-only` / 禁用 delegation、mutating overlap 或安全边界不满足、并发容量 backpressure。
- 不允许因为“当前 host 是 Codex”而自动 single-agent 降级。
- 不允许看到 agent profile 就盲目 dispatch；必须处在 documented workflow phase 或明确用户请求的 bounded delegation 中。
- 不允许让脚本决定语义 dispatch 范围；脚本只能发现文件、重叠、facts、hash、readiness 和 reason_code。

## Skill 全量审查

| Skill | Agent / Dispatch 方式 | 内部逻辑判断 | Agent 决策判断 | 状态 |
|---|---|---|---|---|
| `agent-native-architecture` | 不 dispatch；方法论参考。 | agent-native 原则有价值，但缺标准 `When To Use` / `Outputs` / `Workflow` 结构。 | 无下游 agent 决策；作为判断框架可用。 | 后续补结构和 eval。 |
| `agent-native-audit` | 8 个 read-only explorer subagents；Claude 用 `Agent`，Codex 用 `spawn_agent`。 | 已修为 host capability gate，顺序 fallback 清楚。 | subagents 只查事实，orchestrator 打分，边界正确。 | FIX-006 覆盖；仍需补标准 sections。 |
| `changelog` | inline-only。 | 范围窄，适合作内部 helper。 | 无 agent 决策。 | 结构 debt；非本轮阻塞。 |
| `feature-video` | 不 dispatch；使用脚本 / browser proof。 | 目标清楚，依赖视觉证据；缺标准 sections。 | 无 agent 决策。 | 后续补 eval / failure modes。 |
| `frontend-design` | inline-only。 | 作为设计执行辅助可用，但没有 I/O contract。 | 无 agent 决策。 | 后续结构化。 |
| `gemini-imagegen` | inline + script。 | API 调用边界需要继续保留人工/credential 安全判断。 | 无 agent 决策。 | security signals 需逐项 triage。 |
| `git-clean-gone-branches` | script-only。 | 确定性清理任务，适合脚本。 | 无 agent 决策。 | 可保留内部 helper。 |
| `git-commit` | inline-only。 | 与 `git-commit-push-pr` 有边界重叠但可接受。 | 无 agent 决策。 | 后续明确 When Not To Use。 |
| `git-commit-push-pr` | inline-only；用户确认用于 PR 文案，不是 dispatch gate。 | 工作流完整但较长；确认点服务外部发布安全。 | 无 subagent 决策。 | 保留，后续拆 reference。 |
| `git-worktree` | script-only；为 parallel work 准备隔离目录。 | 适合确定性封装；`.env` 类 security P1 需要语义复核。 | 不直接调 agent。 | 后续 security triage。 |
| `lfg` | legacy orchestration shim，不直接 spawn。 | 作为旧 pipeline 兼容层可以保留 internal-only。 | 下游 workflow 决策由被调用 workflow 负责。 | 不应公开。 |
| `proof` | API ops，无 agent dispatch。 | 协作编辑协议清楚，但 credential / header 信号需复核。 | 无 agent 决策。 | 后续安全说明补强。 |
| `report-bug` | inline-only。 | bug report 收集边界简单。 | 无 agent 决策。 | 可保留。 |
| `resolve-pr-feedback` | mutating `spec-pr-comment-resolver` dispatch；按 file overlap / batch 安全调度。 | 已修为 direct invocation authorizes resolver dispatch；orchestrator owns commit / push / resolve。 | resolver 可判断反馈有效性并改局部文件；最终集成由 orchestrator，正确。 | FIX-006 覆盖。 |
| `spec-app-consistency-audit` | 专家 lens / scripts；MVP 不复制 app-specific experts 到 `agents/`。 | 质量矩阵较成熟；mode gate 和 evidence gate 正确。 | 专家判断被限定在 artifact evidence 内，正确。 | 得分较高；补 eval readiness。 |
| `spec-brainstorm` | Slack researcher 仅在用户要求组织上下文时 opt-in；其余主要 inline。 | WHAT 澄清边界合理；Slack opt-in 不是同类 dispatch 缺陷。 | Slack agent 只做组织上下文研究，正确。 | 保持。 |
| `spec-code-review` | 多 persona reviewer、Spec-First agents、validator、fixer；bounded parallel。 | 已修：Codex `spawn_agent` 是可用 dispatch primitive；不再要求二次 subagent 确认。 | reviewer 输出结构化 findings；orchestrator gate / dedup / fixes，正确但 skill 过长。 | FIX-006/008/009 覆盖；后续拆 reference / eval。 |
| `spec-compound` | Context Analyzer / Solution Extractor / Related Docs Finder + 可选 `spec-session-historian`。 | Phase 1 subagents read-only，orchestrator 写 docs，边界正确。 | session historian 只补历史上下文，不覆盖当前证据。 | 保持；注意不要自动问太多。 |
| `spec-compound-refresh` | investigation subagents read-only；replacement subagents 串行写单个 learning。 | 对 stale docs 的替换/合并/删除分层清楚。 | subagents 不删源文档，orchestrator 合并，正确。 | 保持。 |
| `spec-debug` | 可选 read-only hypothesis subagents。 | 并行仅用于独立 evidence probes，正确。 | subagents 不改代码，最终修复由当前 workflow 决定。 | 保持。 |
| `spec-dhh-rails-style` | inline style guide。 | 内部别名已由 linter 白名单治理。 | 无 agent 决策。 | FIX-003 覆盖别名。 |
| `spec-doc-review` | document persona reviewers；bounded parallel；safe_auto 后四选项。 | 已修：doc-review invocation 默认授权 documented persona phase；Codex 不再降级。 | reviewer 判断语义问题，orchestrator synthesis / safe_auto，正确。 | FIX-006/008/009 覆盖。 |
| `spec-graph-bootstrap` | scripts compile readiness facts；不 dispatch。 | 严格符合 Scripts prepare facts。 | 无 agent 决策；下游 LLM 消费 facts。 | 当前最健康之一。 |
| `spec-ideate` | grounding / ideation subagents；Slack opt-in。 | 已修 optional read-only dispatch 边界；问题澄清上限合理。 | ideation agents 生成想法，orchestrator 评估/去重，正确。 | FIX-006 覆盖。 |
| `spec-mcp-setup` | scripts / tools；不 dispatch。 | 能力范围大、最低分；已修远程脚本建议与 Serena language 边界。 | 无 agent 决策；LLM 选择语言，脚本 fail-fast。 | FIX-001；后续拆分/补 eval。 |
| `spec-optimize` | approved spec 后可并行 experiment / judge subagents 或 Codex delegation。 | 有 baseline hard gate 和 worktree probe，不是默认高成本入口。 | experiment agents 在隔离范围试方案，orchestrator 选择；正确但复杂。 | 保持 gated。 |
| `spec-plan` | read-only research agents：repo / learnings / framework / Slack opt-in。 | 已修：direct plan workflow invocation 授权 documented research phase。 | agents 查证据，plan 由 orchestrator 决策，正确。 | FIX-006 覆盖。 |
| `spec-polish-beta` | agent-browser / dev server，不 dispatch。 | beta 范围窄，依赖浏览器验证。 | 无 subagent 决策。 | 保持 beta。 |
| `spec-release-notes` | script-only。 | release query 范围清楚。 | 无 agent 决策。 | 可保留。 |
| `spec-session-extract` | agent-facing primitive，不 dispatch。 | 作为 historian 的 helper 正确；内部 alias 已治理。 | 不做语义相关性判断。 | FIX-003 覆盖别名。 |
| `spec-session-inventory` | agent-facing primitive，不 dispatch。 | 只列 session facts，正确。 | 不抽取内容、不判定结论。 | FIX-003 覆盖别名。 |
| `spec-sessions` | dispatch `spec-session-historian`。 | public query 到 historian 的边界清楚。 | historian 判断相关历史，不能替代当前证据，正确。 | 保持。 |
| `spec-skill-audit` | 不通过 subagent 调用；script artifacts + LLM review。 | 职责非常符合角色契约；本轮修复了 scanner false positives。 | LLM 负责语义 triage，正确。 | 当前健康。 |
| `spec-slack-research` | dispatch `spec-slack-researcher`。 | 入口窄，只处理 Slack org context。 | researcher 输出 digest，不替代 code evidence，正确。 | 保持。 |
| `spec-standards` | scripts；`--deep` 或 large-project 才 multi-agent。 | standards baseline 与 graph facts 边界清楚。 | review 判断由 downstream workflow 做。 | 保持。 |
| `spec-update` | scripts / CLI；不 dispatch。 | update/runtime repair 正确走 source->init。 | 无 agent 决策。 | 保持。 |
| `spec-work` | 可 inline / serial / parallel subagents；Codex 可用 `spawn_agent` forked workspace。 | Parallel Safety Check 和 orchestrator ownership 已明确。 | worker agents 可改 disjoint scope；orchestrator 集成验证，正确。 | 已被 dispatch tests 覆盖。 |
| `spec-work-beta` | external Codex delegation + subagents；显式 opt-in。 | beta 不作为默认 route，正确。 | delegate / worker 改局部，orchestrator 集成，正确。 | 保持 beta。 |
| `spec-write-tasks` | 不执行 code，不 dispatch。 | task pack contract 清晰，适合 plan->work handoff。 | 无 agent 决策。 | 当前健康。 |
| `test-browser` | agent-browser CLI，不 dispatch。 | 浏览器验证工作流清楚；端口/截图边界合理。 | 无 subagent 决策。 | 保持。 |
| `test-xcode` | XcodeBuildMCP / xcodebuild；可被 code-review 派发为 iOS check。 | 作为测试 helper 可用。 | 当被 reviewer 调用时，只报告验证结果。 | 保持。 |
| `using-spec-first` | 不 dispatch；entry routing meta skill。 | 入口治理正确；不把 brainstorm 当默认。 | 路由由当前 agent 语义判断，不由脚本决定。 | 保持。 |

## Agent 全量审查

| Agent | 主要调用者 | 决策边界判断 | 状态 |
|---|---|---|---|
| `spec-correctness-reviewer` | `spec-code-review` | 查逻辑错误和边界条件，anchored confidence 输出，正确。 | 保留。 |
| `spec-maintainability-reviewer` | `spec-code-review` | 查复杂度、耦合、死代码，避免越界到性能/安全，正确。 | 保留。 |
| `spec-testing-reviewer` | `spec-code-review` | 查测试缺口和断言质量，正确。 | 保留。 |
| `spec-project-standards-reviewer` | `spec-code-review` | 对 AGENTS/CLAUDE/project standards 做审查，适合守 source/runtime 边界。 | 保留。 |
| `spec-security-reviewer` | `spec-code-review` | 代码级安全漏洞，和 plan-level security-lens 分工清楚。 | 保留。 |
| `spec-reliability-reviewer` | `spec-code-review` | 错误处理、重试、超时等可靠性，正确。 | 保留。 |
| `spec-performance-reviewer` | `spec-code-review` | diff 级性能问题，正确。 | 保留。 |
| `spec-api-contract-reviewer` | `spec-code-review` | API shape / version / consumer impact，正确。 | 保留。 |
| `spec-data-migrations-reviewer` | `spec-code-review` | migration / rollback / data transform，正确。 | 保留。 |
| `spec-previous-comments-reviewer` | `spec-code-review` | prior review feedback memory，正确。 | 保留。 |
| `spec-cli-readiness-reviewer` | `spec-code-review` | CLI diff readiness，正确。 | 保留。 |
| `spec-cli-agent-readiness-reviewer` | code/doc review special lens | agent-optimized CLI 审查，和 project-standards 有相邻但不重叠。 | 保留。 |
| `spec-adversarial-reviewer` | `spec-code-review` | 组合性 failure / emergent risk，默认 advisory，正确。 | 保留。 |
| `spec-dhh-rails-reviewer` | `spec-code-review` | Rails architecture style lens，正确。 | 保留。 |
| `spec-kieran-rails-reviewer` | `spec-code-review` | Rails strict reviewer，正确。 | 保留。 |
| `spec-kieran-python-reviewer` | `spec-code-review` | Python strict reviewer，正确。 | 保留。 |
| `spec-kieran-typescript-reviewer` | `spec-code-review` | TypeScript strict reviewer，正确。 | 保留。 |
| `spec-julik-frontend-races-reviewer` | `spec-code-review` | async UI / Turbo / DOM race lens，正确。 | 保留。 |
| `spec-swift-ios-reviewer` | `spec-code-review` | Swift / iOS lifecycle / concurrency lens，正确。 | 保留。 |
| `spec-schema-drift-detector` | `spec-code-review` | schema drift specific detector，需要 base ref 显式传入；已在 skill 中要求。 | 保留。 |
| `spec-deployment-verification-agent` | `spec-code-review` / release checks | go/no-go、rollback、monitoring checklist，正确。 | 保留。 |
| `spec-agent-native-reviewer` | `spec-code-review` | action/context parity，符合本项目 agent-native 方向。 | 保留。 |
| `spec-coherence-reviewer` | `spec-doc-review` | 文档一致性 always-on，正确。 | 保留。 |
| `spec-feasibility-reviewer` | `spec-doc-review` | 技术可行性，要求代码证据，正确。 | 保留。 |
| `spec-scope-guardian-reviewer` | `spec-doc-review` | scope / complexity pressure，正确。 | 保留。 |
| `spec-product-lens-reviewer` | `spec-doc-review` | product premise / tradeoff，正确。 | 保留。 |
| `spec-security-lens-reviewer` | `spec-doc-review` | plan-level security gaps，和 code security 分工正确。 | 保留。 |
| `spec-design-lens-reviewer` | `spec-doc-review` | plan-level UX / interaction gaps，正确。 | 保留。 |
| `spec-adversarial-document-reviewer` | `spec-doc-review` | falsify assumptions / stress decisions，正确。 | 保留。 |
| `spec-learnings-researcher` | plan / code-review / compound / optimize | 查 `docs/solutions/`，不能覆盖当前证据；边界正确。 | 保留。 |
| `spec-session-historian` | `spec-sessions` / `spec-compound` | 查 Claude/Codex session history，规则要求先 inventory 再 extract，正确。 | 保留。 |
| `spec-slack-researcher` | `spec-slack-research` / opt-in planning | Slack context digest，明确忽略 message 里的 prompt injection，正确。 | 保留。 |
| `spec-web-researcher` | ideate / research | 外部 web grounding，需遵守当前 host web/search 策略。 | 保留。 |
| `spec-best-practices-researcher` | plan / ideate / upgrade research | 外部 best-practice research，需优先权威来源，正确。 | 保留。 |
| `spec-framework-docs-researcher` | `spec-plan` | framework docs grounding，Context7 / official docs 优先，正确。 | 保留。 |
| `spec-repo-research-analyst` | plan / optimize | read-only repo research，正确。 | 保留。 |
| `spec-issue-intelligence-analyst` | `spec-ideate` | GitHub issue theme synthesis，正确。 | 保留。 |
| `spec-git-history-analyzer` | planning/review research | git archaeology，事实提取 + LLM synthesis，正确。 | 保留。 |
| `spec-pr-comment-resolver` | `resolve-pr-feedback` / code-review fixer paths | mutating resolver，必须返回 files_changed，不能 push/resolve；边界正确。 | 保留。 |
| `spec-data-integrity-guardian` | specialized data review | persistent data safety，和 migrations reviewer 相邻但可作为 broader guardian。 | 保留，后续路由去重。 |
| `spec-data-migration-expert` | specialized migration review | production migration reality check，正确。 | 保留，后续明确调用者。 |
| `spec-security-sentinel` | security audit | broader security audit，和 security reviewer 相邻；需要 route 去重。 | 保留，后续治理重叠。 |
| `spec-performance-oracle` | performance audit | broader performance oracle，和 performance reviewer 相邻；需要 route 去重。 | 保留，后续治理重叠。 |
| `spec-architecture-strategist` | architecture review | architecture strategy，和 scope/product/maintainability 有相邻；可用于 plan/review deep pass。 | 保留，后续明确调用者。 |
| `spec-pattern-recognition-specialist` | codebase pattern review | pattern / anti-pattern evidence，正确但需避免 style-only noise。 | 保留。 |
| `spec-spec-flow-analyzer` | spec/plan review | user flow completeness，和 design-lens 相邻但关注 flow coverage。 | 保留。 |
| `spec-ankane-readme-writer` | README writing | writer，不是 reviewer；适合 narrow docs generation。 | 保留，明确触发。 |
| `spec-design-implementation-reviewer` | visual QA | live UI vs Figma review；需要 browser/figma evidence。 | 保留。 |
| `spec-design-iterator` | visual polish | iterative screenshot loop；应保持 beta / explicit context。 | 保留。 |
| `spec-figma-design-sync` | Figma sync | detects/fixes visual differences；mutating scope需由 orchestrator约束。 | 保留。 |

## 已确认并修复的问题

| ID | 问题 | 决策 | 修复证据 |
|---|---|---|---|
| FIX-001 | setup dependency suggestion 暴露远程脚本直通 shell 建议 | confirmed safety issue | `check-deps.*` 与 mcp setup tests |
| FIX-002 | runtime mirror 写入 P0 误报 | scanner issue | `security-patterns.js` |
| FIX-003 | internal skill runtime alias 被误判 frontmatter drift | scanner / governance issue | `lint-skill-structure.js` |
| FIX-004 | `process.env` 被误判为 `.env` 文件读取 | scanner issue | `security-patterns.js` |
| FIX-005 | app audit redaction 误报 / scanner 噪音 | scanner issue | fix log 记录 |
| FIX-006 | Codex / Claude workflow-owned dispatch 被写成额外确认 gate | confirmed capability issue | `spec-doc-review`、`spec-code-review`、`spec-plan`、`spec-ideate`、`resolve-pr-feedback`、`agent-native-audit` |
| FIX-007 | Codex adapter 把 Task profile rewrite 成 inline-only fallback | confirmed runtime projection issue | `src/cli/adapters/codex.js`、runtime-plan tests |
| FIX-008 | durable learning 残留旧 dispatch 口径 | confirmed stale knowledge issue | `docs/solutions/workflow-issues/...`、dispatch tests |
| FIX-009 | docs/plans 残留旧 dispatch 口径 | confirmed stale planning-doc issue | `docs/plans/...`、dispatch tests |
| FIX-010 | `resolve-pr-feedback` Targeted Mode 默认假设 resolver dispatch 存在 | confirmed edge-path dispatch issue | `resolve-pr-feedback` skill、contract test |
| FIX-011 | `spec-code-review` 末尾 Fallback 混淆 sequential dispatch 与 no-dispatch fallback | confirmed fallback wording issue | `spec-code-review` skill、contract test |
| FIX-012 | `spec-plan` deepening reference 缺 inline current-agent fallback | confirmed reference drift issue | deepening reference、contract test |
| FIX-013 | `agent-native-audit` Success Criteria 与 sequential fallback 不一致 | confirmed criteria wording issue | `agent-native-audit` skill、dispatch test |
| FIX-014 | 历史 dispatch plan 复述旧 Codex anti-dispatch 原文 | confirmed historical-doc contamination issue | dispatch plan、docs/plans regression test |
| FIX-015 | 历史 plan 与修复日志保留旧 dispatch 精确短语 | confirmed source-doc contamination issue | dispatch plan、fix log、local audit docs regression test |

## 剩余优化点

1. Runtime drift 仍存在：最新 runtime-drift report 只剩 Claude `code-review.md` / `spec-code-review` 与 Codex `spec-code-review` 漂移。修复方式只能是 source 验证后运行 `spec-first init --claude` / `spec-first init --codex`，不能手改 `.claude/`、`.codex/`、`.agents/skills/`。
2. 结构债务：大量内部 helper 缺 `When To Use`、`When Not To Use`、`Outputs`、`Workflow`、`Failure Modes`。这会降低 skill discovery precision，但不是本轮 dispatch 根因。
3. Eval readiness：除 `spec-graph-bootstrap`、`spec-skill-audit`、`spec-write-tasks` 等少数 skill 外，大多数 skill 缺 trigger / boundary / failure eval fixtures。
4. Security P1：当前 P0 为 0，P1 仍有 47 个 credential / privileged-command / exfiltration 信号。它们必须逐项语义 triage，不能由 scanner 自动定罪或自动修复。
5. 长 skill 可维护性：`spec-code-review`、`spec-work-beta`、`spec-optimize`、`spec-plan` 过长，后续应把稳定模板和细节下沉到 references，但不能改变 workflow contract。
6. Agent overlap：security/performance/data/architecture 类 broad agents 与 code-review persona 有重叠。当前不是缺陷，但需要 ECC Agent 重叠治理 V1 的 registry / routing / finding-core 去重能力逐步吸收。

## Capability Upgrade Decision

Cycle 0 决策：现有 skills 足够，不新增 `spec-evolve`，不新增 agent。接受的升级是：

- 把 workflow-owned dispatch 从“额外用户确认 gate”升级为“host capability + safety gate”。
- 在 Codex runtime projection 中把 legacy `Task` 语义转成 `spawn_agent` dispatch，而不是 inline-only profile application。
- 将旧口径从 durable learning 和 planning docs 中清除，避免下一轮自我审视复发。
- 用 contract tests 固化跨 Claude / Codex 的默认 dispatch 行为。

拒绝的升级：

- 不做自动 rewrite 系统。
- 不让 scripts 做语义 reviewer / capability gap 决策。
- 不添加新 agents 来解决文案治理问题。
- 不手改 generated runtime mirrors。

## Completion Audit

| 用户要求 | 覆盖情况 | 证据 |
|---|---|---|
| 持续自我审视、能力缺口、升级决策 | 已完成本轮 Cycle 0 判断 | 本报告 `Capability Upgrade Decision` |
| 不假设必须新增 `spec-evolve` | 已拒绝 | 本报告结论与拒绝升级列表 |
| Cycle 0 决定现有 skill 是否足够 | 已决定：足够 | 本报告结论 |
| 不构建 auto-rewrite system | 已遵守 | 仅 source patch + tests，无 rewrite 脚本 |
| 不无名新增 agents | 已遵守 | `agents/` 无新增 |
| scripts 不做语义决策 | 已遵守 | skill-audit artifacts 只作为 facts |
| 不绕过 spec-plan / review / compound | 已遵守 | plan docs、review artifact、solution learning、fix log |
| 不手改 runtime generated copies | 已遵守 | `.claude/`、`.codex/`、`.agents/skills/` 无 diff |
| 每个修复追加本地文档 | 已遵守 | `docs/2026-05-05-skill-agent-audit/fix-log.md` FIX-001..015 |
| 全量核实其他 skill 是否有同类问题 | 已覆盖 42 个 skills | 本报告 Skill 全量审查 + grep / tests |
| Claude / Codex host 都遵循默认 dispatch 规则 | 已 source 化并测试 | `AGENTS.md`、`CLAUDE.md`、workflow SKILL、Codex adapter、dispatch tests |

## 后续 Handoff

下一轮优先级：

1. 运行 `spec-first init --claude` 和 `spec-first init --codex` 修复 runtime drift，前提是当前 source 验证通过并且用户接受 runtime regeneration。
2. 用 `spec-skill-audit --target` 分批处理最低分 skills：`spec-mcp-setup`、`spec-work`、`spec-work-beta`、`spec-optimize`、`spec-brainstorm`。
3. 为 dispatch-bearing skills 增加 eval fixtures：doc-review、code-review、plan、ideate、work、resolve-pr-feedback。
4. 用 ECC Agent 重叠治理 V1 处理 broad security/performance/data/architecture agents 的 routing / finding 去重，不新增平行专家集合。
