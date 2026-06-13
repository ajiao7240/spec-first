# SCALE Engine 融合路线版本拆分

> 日期：2026-06-03
> 状态：superseded（2026-06-13 收敛；v1.11–v1.17 已落地，v2.0 归 live 父方案 Phase F）
> 来源计划：`docs/plans/2026-06-03-003-feat-scale-engine-fusion-roadmap-plan.md`（同步标记 superseded）
> Live source-of-truth：`docs/01-需求分析/13.scale-integration/spec-first内化集成scale-project-scaffold技术方案.md` + 同目录 `README.md`（权威逐版本进度台账）
> 输入材料：`docs/01-需求分析/13.scale-integration/bak/scale-engine-能力清单与集成建议.md`、`.../bak/project-scaffold-依赖安装逻辑分析.md`、`.../bak/scale-os-config-claude-code-依赖安装面分析.md`（旧 `docs/09-业界借鉴/` 路径已失效，bak/ 仅作历史输入）

> **Superseded：本拆分文档不再作为 active 发布管理入口，仅作历史快照。** 其版本拆分原则、波次（Wave A–D）和准入条件的方向判断成立，但逐版本明细已被实现期的窄 plan 超越。注意：本文的 v1.14/v1.15 映射（v1.14 Governance Lens、v1.15 Knowledge Harness）是**正确的**权威映射——与之冲突的是来源 roadmap 文档自身的 stale 标签，不是本文。逐版本落地证据见 README 台账。

本文是面向发布管理和工程执行的版本拆分文档。它不替代具体 implementation plan，也不直接承诺某个 npm 版本号的发布日期；它定义每个版本的独立价值、交付边界、准入条件、验收口径和依赖关系，供后续 `spec-plan` / `spec-write-tasks` / `spec-work` 拆解执行。

---

## 1. 拆分原则

本轮融合的目标不是复制 SCALE Engine，而是把 SCALE 生态中已经验证过的治理能力，按 spec-first 的边界重写为自有机制。

版本拆分遵循 6 条原则：

1. **先事实后自动化**：先让 setup/doctor/init 能诚实说明缺什么、会调用什么、哪些未运行，再考虑一键安装。
2. **先 source contract 后 runtime projection**：先定义 source-of-truth，再生成 Claude/Codex runtime；不手改 `.claude/`、`.codex/`、`.agents/skills/`。
3. **先 minimal 后 provider**：默认 minimal 不安装 GBrain / Graphify / CodeGraph；recommended/platform profile 才提升能力上限。
4. **先文件化记忆后外部记忆**：长期知识先落 `docs/solutions/`、sessions、review/validation docs，再接外部 memory provider。
5. **先双宿主稳态后多宿主扩展**：Claude + Codex 是默认支持面；其他 host 进入 platform profile，而不是默认矩阵。
6. **先 advisory 后 blocking**：检测器、规则、provider facts、verification profile 默认产 evidence 和 reason_code；blocking 必须经过 RuleMaturity。

---

## 2. 版本总览

| 版本 | 名称 | 一句话目标 | 用户可见变化 | 发布性质 |
|------|------|------------|--------------|----------|
| v1.11 | Dependency Readiness Baseline | 让用户知道 runtime 会调用什么、缺什么、哪些只是推荐 | `doctor` / `mcp-setup` 输出依赖 readiness、install plan、degraded reason | additive / default check-only |
| v1.12 | Host Projection & Capability Matrix | 让 Claude/Codex runtime 生成物和宿主能力可观察 | `init` / `doctor` 输出 host capability 和 generation report | additive / runtime-report |
| v1.13 | Skill Registry & Verification Profile | 让 skill/tool/验证命令从 prose 变成 metadata + evidence | closeout 能记录 tool/skill used/skipped/not-run；verification profile 有 required/optional 语义 | additive / evidence-contract |
| v1.14 | Governance Lens Foundation | 建立 task/resource/gate/rule maturity 的轻量治理事实层 | `spec-plan` 消费 candidate depth；`spec-work` / `spec-code-review` 展示 resource advisory | governance / advisory |
| v1.15 | Knowledge Harness | 建立统一的知识六层语言，并强化文件化记忆召回、冲突和升级 | workflow skill 明确六层读写纪律；plan/debug/compound 可召回 stale/conflict/out-of-scope rationale | knowledge / advisory |
| v1.16 | Optional Provider Pack | 以 opt-in 方式接入 GBrain / Graphify / CodeGraph | recommended/platform 可推荐 provider，minimal 不受影响 | optional / experimental |
| v1.17 | Governance Maturity | 让规则成熟度、交付证据和治理 ROI 可审计 | required-evidence/blocking 只在误报证据、人审和 rollback 策略齐备后候选启用 | governance / evaluation |
| v2.0 | Platform Profile | 提供企业级 platform profile 和多 host adapter contract | optional platform profile 支持更多 host/provider/policy | advanced / platform |

---

## 3. 发布波次

### Wave A: 安装与 runtime 可观察性

包含版本：v1.11、v1.12、v1.13。

目标：解决用户最直接的 setup 可信度问题，让 spec-first 能解释“为什么工作流可用或不可用”，而不是让用户猜 MCP、hook、provider、skill 是否真的准备好了。

交付价值：

- 新用户 onboarding 更清楚。
- 旧用户 runtime drift 更容易定位。
- optional provider 缺失不会被误报为 setup 成功或验证通过。
- 后续 provider / memory / multi-host 扩展有可靠事实底座。

Wave A 完成后，才允许进入 provider 安装和 platform profile 的实现。

### Wave B: 知识与记忆内核

包含版本：v1.14、v1.15。

目标：先把治理 lens foundation 接进 plan/work/review 的 advisory 路径，再把 SCALE 的六层知识体系重写为 spec-first 的 source-first 知识模型，并强化不依赖外部 provider 的文件化记忆能力。

交付价值：

- workflow 对上下文、记忆、代码理解、能力选择、沉淀治理有统一语言。
- `spec-plan`、`spec-debug`、`spec-compound` 能更稳地利用历史知识。
- out-of-scope / rejected rationale 可被召回，减少重复争论。
- stale/conflict 的知识不再静默污染下一次任务。

Wave B 完成后，才允许把 GBrain / Graphify / CodeGraph facts 接进 workflow 消费面。

### Wave C: Optional provider 与治理成熟度

包含版本：v1.16、v1.17。

目标：把更强能力接入为 optional/provider-advisory，同时补 evidence ledger、honest delivery 和 RuleMaturity，防止强工具带来强误导。

交付价值：

- recommended/platform 用户可获取更强代码理解和跨会话记忆。
- provider stale/missing/partial/fallback 变成一等事实。
- final closeout 不再混淆 dry-run、skipped、not-run 和 verified。
- 新规则先 shadow 收集误报，再决定是否升级。

### Wave D: Platform profile

包含版本：v2.0。

目标：把 spec-first 从个人/项目级 harness 扩展到团队级 platform profile，但仍保持 minimal 默认路径。

交付价值：

- 企业团队可以预设 provider pack、host adapters、permission policy、verification profile。
- Claude/Codex 稳态不被多宿主矩阵拖垮。
- 组织可按 profile opt-in，而不是让所有用户承担复杂度。

---

## 4. 版本明细

### v1.11 Dependency Readiness Baseline

**发布目标**

让 `spec-mcp-setup`、`doctor`、`init` 能区分：

- installed：工具真的存在。
- configured：runtime 已配置会调用。
- allowed：host permission 允许但未必安装。
- recommended：建议安装但不影响 minimal。
- optional：场景触发才需要。
- unsupported：当前 host 不支持。
- degraded / fallback：缺失后用了什么替代。
- not-run：没有运行，不能声称通过。

**核心交付**

- `runtime-dependency-readiness.v1`
- `provider-install-profile.v1`
- `minimal` / `recommended` / `platform` / `surface-ui` / `surface-data-security` profile 文档。
- configured MCP / hooks / commands 依赖扫描。
- install plan 与 install apply 明确分离。

**主要文件面**

- `skills/spec-mcp-setup/SKILL.md`
- `skills/spec-mcp-setup/mcp-tools.json`
- `skills/spec-mcp-setup/scripts/detect-tools.sh`
- `skills/spec-mcp-setup/scripts/detect-tools.ps1`
- `skills/spec-mcp-setup/scripts/verify-tools.sh`
- `skills/spec-mcp-setup/scripts/verify-tools.ps1`
- `skills/spec-mcp-setup/scripts/install-helpers.sh`
- `skills/spec-mcp-setup/scripts/install-helpers.ps1`
- `docs/contracts/runtime-dependency-readiness.md`
- `docs/contracts/provider-install-profile.md`
- `docs/catalog/runtime-capabilities.md`

**不包含**

- 不安装 GBrain / Graphify / CodeGraph。
- 不改 provider 消费路径。
- 不新增 multi-host adapter。

**准入条件**

- GitNexus active integration 删除面已稳定。
- 当前 `spec-mcp-setup` Bash/PowerShell parity 测试可跑。
- runtime generated mirrors 无手改需求。

**验收门槛**

- `spec-first doctor --claude|--codex` 能输出 configured-required / optional / recommended / unsupported / degraded。
- 没有 `--install` 或 explicit profile 时，不执行 npm/pip/go install。
- configured hook 依赖缺失时不会被隐藏成 MCP 缺失。
- optional provider 缺失不能被表示为 provider verified。

**建议验证**

- `npm run test:mcp-setup`
- `npm run typecheck`
- focused unit tests for readiness schema
- `git diff --check`

---

### v1.12 Host Projection & Capability Matrix

**发布目标**

把 `init` / `doctor` / `update` 的 runtime 生成与检查结果变成可读、可验证、可降级的 host capability report。

**核心交付**

- `host-capability-summary.v1`
- `runtime-generation-report.v1`
- `host-policy-projection.v1`
- Claude/Codex capability matrix。
- generated runtime self-test。

**主要文件面**

- `src/cli/commands/init.js`
- `src/cli/commands/doctor.js`
- `src/cli/commands/clean.js`
- `src/cli/commands/internal.js`
- `src/cli/contracts/dual-host-governance/**`
- `docs/contracts/dual-host-governance/README.md`
- `docs/contracts/source-runtime-customization-boundary.md`
- `docs/contracts/context-governance.md`
- `templates/`
- `CLAUDE.md`
- `AGENTS.md`

**不包含**

- 不新增 Aider/Windsurf/Devin 等默认 runtime generation。
- 不复制 SCALE `.claude/settings.json` inline shell hooks。
- 不把 generated report 当 source truth。

**准入条件**

- v1.11 dependency readiness 已能列出 configured runtime dependency。
- source/runtime boundary tests 仍通过。

**验收门槛**

- Claude/Codex report 能分别列出 hooks、permissions、MCP、skills、memory files、unsupported reason。
- `spec-first init` 能报告生成了哪些 runtime assets、哪些检查未运行。
- runtime self-test 可发现 malformed JSON/TOML、脚本权限缺失、不可调度 hook。

**建议验证**

- `npm run typecheck`
- focused init/doctor tests
- fixture-based `spec-first init` for Claude/Codex
- `spec-first doctor --claude`
- `spec-first doctor --codex`

---

### v1.13 Skill Registry & Verification Profile

**发布目标**

让 skill/tool/验证命令从长 prompt 或口头建议，变成轻量 metadata 和 evidence contract。

**核心交付**

- `skill-tool-registry-metadata.v1`
- `tool-skill-evidence.v1`
- `verification-profile.v1`
- `verification-run-summary.v1`
- closeout 中的 skill/tool used/skipped/not-run/fallback summary。

**主要文件面**

- `docs/contracts/workflows/skill-agent-quality-governance.md`
- `src/cli/contracts/dual-host-governance/skills-governance.json`
- `src/cli/contracts/dual-host-governance/skills-governance.schema.json`
- `src/cli/contracts/dual-host-governance/agents-governance.json`
- `src/cli/contracts/dual-host-governance/agents-governance.schema.json`
- `docs/contracts/verifiers/verification-evidence.schema.json`
- `skills/spec-work/SKILL.md`
- `skills/spec-code-review/SKILL.md`
- `skills/spec-doc-review/SKILL.md`
- `skills/spec-plan/SKILL.md`
- `skills/spec-mcp-setup/SKILL.md`

**不包含**

- 不建立第三方 skill marketplace。
- 不把 177 个外部 registry 条目写入默认上下文。
- 不让 verification profile 取代 package scripts 或用户明确命令。

**准入条件**

- v1.11 能说明 tool availability。
- v1.12 能说明 host capability，避免 skill/tool evidence 假设宿主能力。

**验收门槛**

- registry metadata 包含 id/category/tier/trigger/source/risk/recommendedAction。
- installer-script、global-install、unknown-source 标记为 manual-review。
- closeout 能区分 tool available、selected、executed、skipped、unavailable。
- required check skipped 与 optional check skipped 语义不同。

**建议验证**

- `npm run lint:skill-entrypoints`
- focused governance contract tests
- `npm run test:unit -- skill-agent-quality`
- `git diff --check`

---

### v1.14 Governance Lens Foundation

**发布目标**

把 SCALE 的 task level、G0-G22 gate、resource policy 和 RuleMaturity 思路改写为 spec-first 自有的轻量 advisory facts，让 plan/work/review 获得更好的治理输入，但不引入中心 gate 引擎。

**核心交付**

- `task-governance-signals.v1`
- `gate-lens-taxonomy.v1`
- `resource-governance-lens.v1`
- `rule-maturity.v1` schema/docs-only 边界。
- `spec-plan` 消费 `candidate_level`，LLM 保留最终 depth 判断。
- `spec-work` closeout 与 `spec-code-review` 展示 resource advisory。

**主要文件面**

- `docs/contracts/governance/*.md`
- `docs/contracts/governance/*.schema.json`
- `src/cli/helpers/task-governance-signals.js`
- `src/cli/helpers/resource-governance-lens.js`
- `src/cli/helpers/git-diff-signals.js`
- `src/cli/commands/internal.js`
- `skills/spec-plan/SKILL.md`
- `skills/spec-work/references/shipping-workflow.md`
- `skills/spec-code-review/SKILL.md`

**不包含**

- 不复制 SCALE 的 `S/M/L/CRITICAL` 终局等级。
- 不输出折叠 `score` 或伪数值 `confidence`。
- 不把 `.scale/resource-policy.json` 当 spec-first source-of-truth。
- 不注册 `rule-maturity` producer/helper。
- 不启用 blocking gate、pre-commit hook 或自动 promotion。

**准入条件**

- v1.13 verification / honest-closeout 已建立 evidence 与 closeout 边界。
- `spec-plan` / `spec-work` / `spec-code-review` 有明确 consumer surface。

**验收门槛**

- `task-governance-signals` 只产 `lightweight` / `standard` / `deep` candidate。
- `plan-declared` 来源只消费 planning context，不依赖尚未写出的 Implementation Units。
- `resource-governance-lens` 区分 `subject_path` 与 `evidence_ref`，generated runtime 不进入 evidence ref。
- `rule-maturity` 在 v1.14 只保留 shadow/advisory 边界，无 required-evidence/blocking producer。

**建议验证**

- focused governance contract/helper tests
- focused consumer prose contract tests
- `npm run typecheck`
- `git diff --check`

---

### v1.15 Knowledge Harness

**发布目标**

把 SCALE 的六层知识体系改写为 spec-first 自有的 Knowledge Harness contract，统一 workflow 对知识的读写边界，并在不引入外部 memory brain 的前提下强化文件化记忆召回、冲突检测和升级机制。

**六层**

| 层 | 名称 | spec-first 形态 |
|----|------|-----------------|
| L1 | 项目上下文 / 术语层 | README、AGENTS、CLAUDE、docs/contracts、domain glossary、PRD glossary |
| L2 | Context Pack / 预算层 | context bundle、included/omitted、reason_code、degraded reason |
| L3 | 记忆召回 / 冲突层 | docs/solutions、sessions、git history、review/validation docs、out-of-scope |
| L4 | 代码理解 / 影响层 | bounded source reads、rg、ast-grep、diff、tests、optional provider |
| L5 | 能力选择 / Agent 路由层 | using-spec-first、workflow phase、reviewer/skill selection metadata |
| L6 | 沉淀治理 / 知识升级层 | CHANGELOG、docs/solutions、contracts、README、follow-up plans |

**核心交付**

- `docs/contracts/knowledge-harness.md`
- 六层读写纪律。
- `knowledge-recall-summary.v1`
- `out-of-scope-memory.v1`
- `learning-candidate.v1`
- workflow prose 对六层的消费者/生产者说明。
- candidate -> review -> promote 纪律。

**主要文件面**

- `docs/contracts/knowledge-harness.md`
- `docs/contracts/ai-coding-harness.md`
- `docs/contracts/context-bundle.md`
- `docs/contracts/domain-glossary.md`
- `docs/contracts/sessions/spec-first-session.md`
- `docs/workflow-skill-agent-map.md`
- `skills/using-spec-first/SKILL.md`
- `skills/spec-prd/SKILL.md`
- `skills/spec-plan/SKILL.md`
- `skills/spec-work/SKILL.md`
- `skills/spec-debug/SKILL.md`
- `skills/spec-code-review/SKILL.md`
- `skills/spec-compound/SKILL.md`
- `skills/spec-compound-refresh/SKILL.md`
- `skills/spec-sessions/SKILL.md`
- `docs/solutions/`

**不包含**

- 不要求固定 `CONTEXT.md`。
- 不引入 `.scale/GLOSSARY.md`。
- 不写外部 memory provider。
- 不让 session-local guess 自动进入项目规则。
- 不引入 SQLite memory、向量数据库或 provider router。

**准入条件**

- v1.14 governance lens 已明确 advisory facts 与 workflow judgment 边界。
- 现有 `docs/contracts/context-bundle.md`、`domain-glossary.md` 边界清楚。
- compound/refresh 现有流程能区分 stale/outdated/overlap。

**验收门槛**

- 每个 public workflow 明确读哪些层、写哪些层。
- 长期写入只允许在 ship/compound/review-backed 场景。
- provider facts 在 L4 只能 advisory。
- 召回项必须带 provenance、freshness、confidence。
- conflict 不能被静默 newest-wins。
- out-of-scope rationale 可被 plan/work/debug 消费为 advisory boundary。
- promotion 必须声明目标文档和证据。

**建议验证**

- docs contract tests
- focused session/compound tests
- synthetic stale/conflict fixture
- focused `rg` negative check for provider-as-truth wording
- `git diff --check`

---

### v1.16 Optional Provider Pack

**发布目标**

在 v1.11-v1.15 的事实和知识边界稳定后，把 GBrain / Graphify / CodeGraph 接成 optional provider pack。

**核心交付**

- `provider-readiness.v1`
- `provider-install-plan.v1`
- GBrain 或等价 memory provider readiness。
- Graphify artifact readiness。
- CodeGraph CLI readiness。
- provider fallback / stale / permission-denied / not-aligned 状态。

**主要文件面**

- `skills/spec-mcp-setup/mcp-tools.json`
- `skills/spec-mcp-setup/SKILL.md`
- `skills/spec-mcp-setup/scripts/detect-tools.*`
- `skills/spec-mcp-setup/scripts/install-helpers.*`
- `skills/spec-mcp-setup/scripts/verify-tools.*`
- `docs/contracts/provider-readiness.md`
- `docs/contracts/provider-install-profile.md`
- `skills/spec-plan/SKILL.md`
- `skills/spec-work/SKILL.md`
- `skills/spec-code-review/SKILL.md`
- `skills/spec-debug/SKILL.md`

**不包含**

- 不恢复 graph-bootstrap。
- 不让 provider impact summary 直接成为 review finding。
- 不默认安装 provider。
- 不写 provider memory。

**准入条件**

- v1.11 readiness contract 已落地。
- v1.15 Knowledge Harness 已定义 provider advisory 边界。
- v1.15 Knowledge Harness 已能承接长期知识。

**验收门槛**

- minimal profile 无 provider install step。
- recommended profile 只生成 install plan，不自动执行。
- platform profile 可声明 expected provider，但 facts 仍 advisory。
- stale provider 输出不能写成 “impact checked”。

**建议验证**

- `npm run test:mcp-setup`
- provider readiness fixture tests
- no-provider minimal profile regression
- stale/fallback fixture tests

---

### v1.17 Governance Maturity

**发布目标**

让规则成熟度、交付证据和治理 ROI 可审计，避免强工具、强规则带来错误阻塞或错误完成声明。

**核心交付**

- `runtime-evidence-ledger.v1`
- `honest-delivery-summary.v1`
- `rule-maturity.v1`
- `command-output-summary.v1`
- `affected-test-selection.v1`
- 第一批 advisory detector。

**主要文件面**

- `docs/contracts/artifact-summary.md`
- `docs/contracts/verifiers/verification-evidence.schema.json`
- `docs/contracts/workflows/spec-work-run-artifact.schema.json`
- `skills/spec-work/SKILL.md`
- `skills/spec-code-review/SKILL.md`
- `skills/spec-debug/SKILL.md`
- `src/cli/contracts/quality-gates/**`
- `src/cli/contracts/security/**`
- `tests/unit/**`

**不包含**

- 不默认启用 blocking detector。
- 不把 model self-eval 当质量真相。
- 不引入 central workflow engine。

**准入条件**

- v1.13 verification profile 能提供 command/not-run facts。
- v1.14 Governance Lens Foundation 已运行 shadow/advisory 规则。
- v1.15 Knowledge Harness 已明确 evidence 与 knowledge promotion 关系。

**验收门槛**

- final closeout 能区分 completed、verified、unverified、blocked、not-run。
- redaction 在 durable evidence 前执行。
- 新 detector 默认 shadow。
- RuleMaturity 需要 evidence + false-positive tracking + human approval 才能 blocking。

**建议验证**

- evidence schema tests
- redaction tests
- detector shadow fixture tests
- focused spec-work closeout tests

---

### v2.0 Platform Profile

**发布目标**

在 minimal/recommended 稳定后，提供企业级 platform profile，支持更多 host、provider、policy 和 team defaults。

**核心交付**

- `host-adapter-capability.v1`
- `platform-profile.v1`
- `org-provider-policy.v1`
- `runtime-projection-drift.v1`
- optional cost/usage/adoption ledger。
- multi-host adapter registry。

**主要文件面**

- `src/cli/contracts/dual-host-governance/**`
- `docs/contracts/dual-host-governance/README.md`
- `docs/contracts/platform-profile.md`
- `src/cli/commands/init.js`
- `src/cli/commands/doctor.js`
- `skills/spec-mcp-setup/**`
- `skills/spec-update/SKILL.md`
- `README.md`
- `README.zh-CN.md`

**不包含**

- 不把 platform profile 设为默认。
- 不保证所有 host 都有同等能力。
- 不在没有 adapter self-test 的情况下生成 runtime。

**准入条件**

- v1.11-v1.17 已稳定。
- Claude/Codex dual-host contract 无 regressions。
- provider optional pack 有明确 stale/fallback 语义。

**验收门槛**

- Claude/Codex 仍是一等默认宿主。
- 其他 host 仅在 platform profile 选择后进入 runtime generation。
- unsupported capability 必须明确说明，不阻塞无关 workflow。
- rollback 能移除 optional generated assets，不触碰 source truth。

**建议验证**

- dual-host governance tests
- platform profile fixture
- init/doctor generated runtime tests
- package/tarball assertions

---

## 5. 版本依赖图

```text
v1.11 Dependency Readiness
  ├─> v1.12 Host Projection
  ├─> v1.13 Skill/Verification Metadata
  └─> v1.16 Optional Provider Pack

v1.14 Governance Lens Foundation
  ├─> v1.15 Knowledge Harness
  └─> v1.17 Governance Maturity

v1.13 Skill/Verification Metadata
  ├─> v1.14 Governance Lens Foundation
  └─> v1.17 Governance Maturity

v1.15 Knowledge Harness
  └─> v1.16 Optional Provider Pack

v1.11 + v1.12 + v1.16 + v1.17
  └─> v2.0 Platform Profile
```

关键 gate：

- v1.16 不得早于 v1.11 和 v1.15。
- v2.0 不得早于 v1.11、v1.12、v1.16、v1.17。
- blocking guardrail 不得早于 v1.17 RuleMaturity。

---

## 6. 并行策略

| 可并行项 | 条件 | 风险 |
|----------|------|------|
| v1.11 contract docs 与 script detection 原型 | 不改 install apply | 低 |
| v1.12 host capability docs 与 self-test fixture | 不改 runtime generator 主路径 | 中 |
| v1.13 skill metadata contract 与 verification profile schema | 不接 workflow closeout 前可并行 | 中 |
| v1.14 Governance Lens Foundation | 可与 v1.11-v1.13 的后半段并行，但 consumer 接入要等 v1.13 closeout 边界清楚 | 中 |
| v1.15 Knowledge Harness / recall prototype | 必须等 v1.14 advisory facts 与 workflow judgment 边界确定 | 中 |
| v1.16 provider pack | 必须等 v1.11 + v1.15 | 高 |
| v1.17 Governance Maturity | 可与 v1.15 并行设计，但 required-evidence/blocking 接入要等 v1.14 误报证据 | 中 |

建议执行顺序：

1. v1.11 U1-U3。
2. v1.13 metadata/evidence closeout。
3. v1.12 runtime projection report。
4. v1.14 Governance Lens Foundation。
5. v1.15 Knowledge Harness / memory recall。
6. v1.17 Governance Maturity。
7. v1.16 optional provider pack。
8. v2.0 platform profile。

---

## 7. 发布验收总门槛

每个版本发布前必须满足：

- `CHANGELOG.md` 有 user-visible 记录。
- 用户可见行为变化同步 `README.md` / `README.zh-CN.md` 或 `docs/`。
- schema/contract 变化有 focused tests。
- source/runtime generation 变化同时覆盖 Claude/Codex。
- 不手改 generated runtime mirrors。
- 未运行验证必须明确 not-run reason。
- optional provider 缺失不能被包装成 passed。
- no provider facts are treated as confirmed truth。

建议通用命令：

```bash
npm run typecheck
npm run test:unit
npm run test:mcp-setup
npm run test:smoke
npm run build
git diff --check
```

实际执行可按影响面收窄，但 final closeout 必须说明为什么没有跑全量。

---

## 8. 决策摘要

| 问题 | 决策 |
|------|------|
| 是否直接融合 SCALE Engine runtime？ | 否。只摘取能力、contract 和治理形态，用 spec-first source 重写。 |
| 是否默认安装 GBrain / Graphify / CodeGraph？ | 否。minimal 不装；recommended 计划安装；platform 可默认但仍 advisory。 |
| 是否恢复 graph provider 核心路径？ | 否。GitNexus 已退役，Graphify/CodeGraph 只做 optional orientation provider。 |
| 是否扩展所有 host adapter？ | 否。Claude/Codex 优先；其他 host 进入 v2.0 platform profile。 |
| 是否引入 blocking gates？ | 默认否。规则必须 shadow -> advisory -> required-evidence -> blocking。 |
| 长期 memory 写入由谁决定？ | workflow/LLM 提 candidate，脚本校验 shape，compound/review/human 才 promote。 |

---

## 9. 下一步

1. 对本版本拆分文档和来源 roadmap 运行 `spec-doc-review`。
2. 将 v1.11 拆成独立 implementation plan，范围限制在 dependency readiness contract + `spec-mcp-setup` check-only/reporting。
3. v1.11 执行完成并通过 mcp-setup tests 后，再拆 v1.14 Governance Lens Foundation。
4. v1.16 provider pack 暂缓，直到 v1.11 和 v1.15 都合并。
