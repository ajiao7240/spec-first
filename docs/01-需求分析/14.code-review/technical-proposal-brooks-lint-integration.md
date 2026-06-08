---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: a88644969371398a873cabeac0a028ab_a723f56c629611f1832e5254006c9bbf
    ReservedCode1: Xyb8MKr5vxFiXuTNR0kjcK3wLeuFpKXObLuEpIbK0VKk3oPvPs17SHYZjYlnb7ynLqCR8HIKRVYBVzJ5CCxdpLtnS35VsJuV5XMhsLHV8K8RNo2qxtirXSC2qiDTZc7cR7kXzFxXTzEN8mXeoiUsKeWP6hpSKgnMrxwLBpHSLhZpMsXl4Zn31kjwbb4=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: a88644969371398a873cabeac0a028ab_a723f56c629611f1832e5254006c9bbf
    ReservedCode2: Xyb8MKr5vxFiXuTNR0kjcK3wLeuFpKXObLuEpIbK0VKk3oPvPs17SHYZjYlnb7ynLqCR8HIKRVYBVzJ5CCxdpLtnS35VsJuV5XMhsLHV8K8RNo2qxtirXSC2qiDTZc7cR7kXzFxXTzEN8mXeoiUsKeWP6hpSKgnMrxwLBpHSLhZpMsXl4Zn31kjwbb4=
---

# spec-doc-review + spec-code-review 借鉴 brooks-lint 守卫纪律技术方案

> 版本:v2.0
> 日期:2026-06-08
> 状态:取代 v1.0 新增 agent / Health Score 路线
> 上游 requirements:[brooks-lint-integration-two-skills-requirements.md](../../brainstorms/2026-06-08-002-brooks-lint-integration-two-skills-requirements.md)

---

## 0. Review Findings 修复映射

本版逐项修复上一轮方案审查发现:

| finding | 修复 |
|---|---|
| 技术方案与新版 requirements 的统一否决项冲突 | 删除新增 `spec-test-decay-reviewer`、`spec-architecture-decay-reviewer`、`spec-decay-tagger`、`spec-health-calculator`、Health Score、schema、`.yaml`、history、CI Action 设计 |
| 技术方案漏掉两 skill 通吃主线 | 主线改为对现有 code-review/doc-review personas 增补 over-flag 守卫纪律与 advisory 出处引用 |
| `spec-architecture-strategist` 被误认为 code-review 现有覆盖面 | 本方案不把 standalone agent 当作已接入 reviewer;若后续要接入,必须另开 catalog 边界决策 |
| requirements 引用不存在的 `impact` 字段 | 本方案统一使用现有 `why_it_matters` 字段承载 Consequence / impact explanation |
| 守卫密度缺少可复核证据 | 本方案把证据复核列为实施前置步骤,计划阶段必须对最终目标 reviewer 集运行 bounded `rg` 并记录命中 |

---

## 1. 方案概述

### 1.1 Goals

- 将 brooks-lint `source-coverage.md` 中最可迁移的 **over-flag 守卫纪律** 融入 spec-first 现有 `spec-code-review` 与 `spec-doc-review` reviewer prose。
- 在两个 skill 的 reviewer 输出说明中加入 **advisory 出处引用** 指引:当发现清晰匹配经典工程原则时,可在 `why_it_matters` 中短句引用,格式为 `<原则名> (<作者>, <书>)`;不确定时不引用。
- 给 `spec-scope-guardian-reviewer` 增加 doc-review 专属的 **文档债子镜头**:识别已承诺但未偿还、会被下游继承的范围/设计债,用 Pain × Spread 辅助映射到现有 severity/confidence。
- 保持现有 review-finding schema、confidence anchors、verdict 和 safe_auto 路由不变。

### 1.2 Non-Goals

- 不新增独立 agent。
- 不新增 `decay_risk` schema 字段,不把 R1-R6/T1-T6 做成强制维度。
- 不引入 Health Score、就绪度心算分、门禁或历史趋势。
- 不新增 `.spec-review.yaml`、`.spec-review-history.json`、CI workflow 或 Mermaid 依赖图。
- 不手改 generated runtime mirrors;source 改完后由 `spec-first init` 同步。

---

## 2. Source / Runtime 边界

### 2.1 Source-of-truth

本方案只允许修改 source:

- `agents/spec-*-reviewer.agent.md`
- `skills/spec-code-review/references/subagent-template.md`
- `skills/spec-doc-review/references/subagent-template.md`
- 必要时 `skills/spec-code-review/references/persona-catalog.md` 或 `skills/spec-code-review/SKILL.md` 只补说明,不新增 pipeline stage
- `CHANGELOG.md`

### 2.2 Generated runtime

`.claude/`、`.codex/`、`.agents/skills/` 是 generated runtime mirrors。实现后如需同步,运行 `spec-first init`;不要直接编辑 runtime mirror 来制造通过。

### 2.3 Script vs LLM

- Scripts/tools 只负责 facts:路径、命中数、schema/contract 测试、runtime drift。
- LLM/reviewer 负责语义判断:是否误报、是否有正当上下文、是否需要压低 confidence、是否引用经典原则。
- 任何分数、趋势、门禁都不进入本切片。

---

## 3. 实施单元

### U0. 证据复核与目标 reviewer 集确认

实施前先运行 bounded `rg` 复核目标 reviewer 中的守卫密度,并把命令与结论写入计划或实现 closeout:

```bash
rg -n "What you don't flag|Do not flag|over-flag|false positive|suppress|Anchor 25|Anchor 50" agents/spec-*-reviewer.agent.md skills/spec-code-review/references/subagent-template.md skills/spec-doc-review/references/subagent-template.md
rg -n "spec-architecture-strategist" skills/spec-code-review agents/spec-architecture-strategist.agent.md
```

默认目标 reviewer 集:

- code-review P0: `spec-correctness-reviewer`、`spec-testing-reviewer`、`spec-maintainability-reviewer`、`spec-project-standards-reviewer`
- code-review P1 conditional: `spec-security-reviewer`、`spec-performance-reviewer`、`spec-api-contract-reviewer`、`spec-data-migrations-reviewer`、`spec-reliability-reviewer`、`spec-adversarial-reviewer`、`spec-cli-readiness-reviewer`
- doc-review P0: `spec-coherence-reviewer`、`spec-feasibility-reviewer`、`spec-scope-guardian-reviewer`
- doc-review P1 conditional: `spec-product-lens-reviewer`、`spec-adversarial-document-reviewer`、`spec-security-lens-reviewer`、`spec-design-lens-reviewer`

`spec-architecture-strategist` 只在另行决定接入 code-review catalog 后才纳入本切片;本方案不默认接入。

### U1. 两个 subagent template 增补 citation 指引

在 `skills/spec-code-review/references/subagent-template.md` 与 `skills/spec-doc-review/references/subagent-template.md` 的 `why_it_matters` 写作段附近加入同一原则:

- 出处引用是 advisory,不是 schema 字段。
- 只在原则匹配清晰且 reviewer 确认出处时使用。
- 引用必须短,服务 failure mode 解释,不能替代直接 evidence。
- 禁止编造作者、书名、章节或把出处当 confirmed source truth。

### U2. code-review reviewer prose 增补 "Do not over-flag"

对 U0 确认的实际 code-review reviewers,在各自 `What you don't flag` / confidence calibration 附近补最小守卫:

- threshold crossing 是 hint,不是 verdict。
- 必须检查 context、intent、blast radius。
- 有正当上下文时压低到 confidence 0/25,或作为 residual risk/testing gap,不要升级成 finding。
- 示例必须绑定 persona 领域,不要复制 brooks-lint 原文。

示例方向:

| reviewer | 守卫重点 |
|---|---|
| maintainability | 不把 bounded context 内合理重复、稳定公共 API、一次性脚本默认判为 DRY/Hyrum/抽象债 |
| testing | 不把 deliberately broad integration tests、稳定 fixture duplication、framework idiom 默认判为测试衰减 |
| correctness | 不把防御性分支、明确 unreachable guard、已有上游 validation 的路径当 bug |
| security | 不把不可达输入、已验证 middleware guard、internal-only path 当 exploit |
| performance | 不把缺少 baseline 的理论 10x 增长当 confirmed performance finding |

### U3. doc-review reviewer prose 增补 "Do not over-flag"

对 doc-review reviewers 补同类守卫,重点是避免把合理的 planning tradeoff 当成文档错误:

- 已明确 deferred / non-goal / outside scope 的内容不当缺口报。
- requirements/plan/task-pack 的文档类型不同,不要把 task-pack 压缩上下文误判为 plan 缺失。
- 低影响的组织偏好走 confidence 50 或 suppression,不进入 actionable finding。

### U4. scope-guardian 增加文档债子镜头

在 `agents/spec-scope-guardian-reviewer.agent.md` 的 scope/complexity 分析后新增子镜头:

```text
Document debt lens:
- 已承诺但未关闭:open question、"先这样以后再说"、推测性范围、下游必须继承的未决选择
- Pain:若不偿还,会不会阻塞实现、诱发错误实现、扩大 review/fix 成本
- Spread:影响一个段落、一个 plan、多个 downstream workflow,还是多个 skill/agent
- 输出:仍用现有 severity/confidence/autofix_class,不新增债务分类字段
```

映射建议:

| Pain × Spread | 现有体系映射 |
|---|---|
| 高 Pain + 高 Spread,会让 implementer 做关键设计选择 | P1/P2,confidence 75,manual 或 gated_auto |
| 中 Pain 或局部 Spread,会造成返工但不阻塞 | P2/P3,confidence 50/75 |
| 低 Pain,仅记录上下文 | residual risk / FYI,不强制 finding |

### U5. 可选 shared field guide

默认不新增共享 `decay-risk-field-guide.md`。只有当 U2/U3 实现时出现明显重复且 reviewer prose 变长,才新增一份小型 advisory guide,并满足:

- 明确不是 schema、不是 mandatory classifier、不是 verdict source。
- 只提供 examples and guardrails。
- 两个 skill 通过 reference 使用,不要在每个 agent 内复制长表。

---

## 4. 验证计划

### 4.1 Source 检查

- `rg -n "spec-test-decay-reviewer|spec-architecture-decay-reviewer|spec-decay-tagger|spec-health-calculator|Health Score|decay_risk|\\.spec-review|history.json|Mermaid" agents skills docs/01-需求分析/14.code-review docs/brainstorms`
- 期望:除历史否决说明外,不出现作为实施项的新增 agent/schema/score/config/history。

### 4.2 Fresh-source eval

agent prose 变更受会话缓存影响,必须用 fresh-source eval 验证:

- code-review 场景:组合根依赖具体实现但属于合理 composition root,对应 reviewer 不应误报 DIP violation。
- code-review 场景:CRUD transaction script 是当前需求的最小实现,maintainability 不应强推 domain model。
- doc-review 场景:plan 显式 deferred 的 future work 不应被 coherence/feasibility 当缺失项。
- doc-review 场景:plan 留下会被 task-pack 继承的 open question,scope-guardian 应作为文档债标出偿还优先级。

### 4.3 Contract / unit checks

按实际改动选择最窄验证:

- `npm run lint:skill-entrypoints`
- 与 agent/template 输出 schema 相关的 focused unit tests
- `npm run typecheck` 仅在修改脚本或 CLI 时需要

### 4.4 Runtime sync

source 变更通过后运行:

```bash
spec-first init
spec-first doctor --codex
spec-first doctor --claude
```

若本机 host 环境无法完成双宿主 doctor,closeout 必须说明 not-run reason;不得声称 runtime 已验证。

---

## 5. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 守卫 prose 过长,增加 reviewer 上下文噪声 | 每个 reviewer 只补 3-5 条本领域 false-positive guard;重复内容放入可选 shared guide |
| 出处引用变成装饰性背书 | subagent-template 明确引用只服务 `why_it_matters`,必须低成本、可省略、不可替代 direct evidence |
| 文档债与 scope-guardian 过度设计发现重复 | 放在同一 agent 内,要求先合并同源发现;一个 finding 只保留当前状态或未偿债中的主导问题 |
| standalone `spec-architecture-strategist` 被误接成现有 reviewer | 本方案默认不接入;接入必须另开 catalog 决策并说明 reviewer overlap |

---

## 6. CHANGELOG 与用户可见性

本方案落地会改变 reviewer 行为与输出措辞,属于用户可见变更。任何 source 改动都必须更新 `CHANGELOG.md`,并标 `(user-visible)`。若只保留本方案文档、不进入 agent/skill source 实现,也需要记录本 docs source 变更。
