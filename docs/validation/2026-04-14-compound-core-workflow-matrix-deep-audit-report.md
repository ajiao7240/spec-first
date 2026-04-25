# Compound Core Workflow 基于同步矩阵的逐文件深度审查报告

- 审查日期：`2026-04-14`
- 审查分支：`feat/sync-compound-core-workflow-updates`
- 审查基线：
  - 本地矩阵：`docs/业界分析/8.核心链路逐commit同步矩阵-v1.md`
  - 上游基线：`/Users/kuang/xiaobu/compound-engineering-plugin/plugins/compound-engineering`
- 审查对象：`spec-first` 核心工作流批次 A-D
- 审查方式：逐文件对照，不抽样

## 1. 最终结论

本轮基于同步矩阵对 `spec-first` 核心工作流升级结果做了逐文件深度审查，结论如下：

1. `spec-first` 已成功完成 `compound-engineering-plugin` 核心链路批次 A-D 的同步。
2. 本次审查共核对：
   - `54` 个有上游对应文件的 source-of-truth 文件
   - `2` 个 discoverability write-back 文件：`AGENTS.md`、`CLAUDE.md`
   - `1` 个本地保留文件：`agents/workflow/bug-reproduction-validator.md`
   - 合计 `57` 个逐文件审查表项
3. `54` 个上游对应文件中：
   - `19` 个与上游完全一致
   - `5` 个在命名空间/品牌/路径映射后语义一致
   - `30` 个存在可解释的本地分叉，且已逐项核对为“有意保留”或“宿主/产品适配”
4. 审查过程中发现 `1` 个真实 blocker，并已在审查期修复：
   - `skills/spec-plan/references/plan-handoff.md` 残留 `spec-doc-review mode:headless`
   - 该指令与当前本地 `spec-doc-review` 非 headless contract 冲突
   - 已修正为“若调用方能承接交互 review，则以普通 `spec-doc-review` 继续；否则返回 `Interactive spec-doc-review still required before execution handoff.`”
5. 当前仍有 `1` 个非阻断治理说明项：
   - `skills/spec-work/references/shipping-workflow.md`
   - `skills/spec-work-beta/references/shipping-workflow.md`
   - 仍保留显式 `spec-code-review mode:autofix` 指导
   - 这不影响功能正确性，而且该写法与上游当前 shipping reference 一致
   - 真正需要记录的是：`949bdef` 的“dispatch 省略显式 mode”语义不能被外推成“所有 execution reference 文本都移除显式 mode”

结论判断：**升级成功，且在本次审查中补齐了 1 个真实 blocker；剩余 1 个治理说明项为非阻断，不影响当前进入后续开发。**

## 2. 审查方法

本轮不是基于 commit subject 复述，而是按矩阵逐文件核实：

1. 以 `docs/业界分析/8.核心链路逐commit同步矩阵-v1.md` 为主索引，锁定批次 A-D 的 source-of-truth 文件。
2. 逐个打开 `spec-first` 与 `compound-engineering-plugin` 对应文件做 diff 审查。
3. 对差异逐一分类：
   - `Exact`：与上游完全一致
   - `Namespace equal`：仅存在 `compound-engineering -> spec-first`、`ce: -> spec:`、路径/品牌映射差异
   - `Intentional divergence`：本地产品/宿主/Stage-0 适配导致的有意分叉
   - `Write-back`：无直接上游对应文件，但由 discoverability check 合理写回
   - `Local-only keep`：上游已缺失，本地基于产品需要保留
4. 对矩阵里的 shared commit 额外核实：
   - owner 是否只承担语义裁决
   - file-affinity 批次是否承担真实落点
   - notes / 审查报告 / 实际文件三者是否一致
5. 对 `54` 个有上游对应的文件额外做了一轮机械对照复核：
   - 原文完全相等
   - 仅做 `compound-engineering -> spec-first`、`ce-* -> spec-*`、命名空间/路径映射后相等
   - 映射后仍有差异，需要进入“有意分叉/宿主适配”人工审查
6. 对关键合同重新做机械验证与运行时验证，不只复用旧报告：
   - `git diff --check`
   - `bash tests/unit/lang-policy.sh`
   - `npm run test:smoke`
   - 针对 review / spec-doc-review / resolve-pr-feedback / plan / work / compound 的 `rg` 合同检查

## 3. 审查中修复的 blocker

### 3.1 已修复：`spec-plan` handoff 残留不存在的 headless 模式

**问题文件**

- `skills/spec-plan/references/plan-handoff.md`

**问题描述**

- 文件原先要求在 pipeline mode 中以 `spec-doc-review mode:headless` 运行计划审查。
- 当前本地 `skills/spec-doc-review/SKILL.md` 已明确不支持 `mode:headless`。
- 这会让 planning handoff 在自动化/`disable-model-invocation` 场景下引用不存在的模式，属于真实 contract 冲突。

**修复结果**

- 删除 `mode:headless` 指令
- 明确两种合法路径：
  - 调用方能承接交互式 `spec-doc-review` 时，按普通 `spec-doc-review` 继续
  - 调用方不能承接交互时，返回 `Interactive spec-doc-review still required before execution handoff.`
- 同步补充：
  - `CHANGELOG.md`
  - `docs/08-版本更新/README.md`

**修复后验证**

- `rg -n "spec-doc-review.*mode:headless|mode:headless.*spec-doc-review" skills/spec-plan skills/spec-brainstorm skills/spec-doc-review -S`
  - 无剩余错误调用
- `npm run test:smoke`
  - 通过

## 4. 当前仍保留的本地分叉

以下差异经逐文件核对后确认是**有意保留**，不是漏迁：

1. `spec-code-review`
   - 不接入上游 `headless`
   - 保留本地 Stage-0 预载块
2. `spec-doc-review`
   - 保留本地 `batch_confirm`
   - 保留 `Promote Residual Concerns`
   - 保留 `Resolve Contradictions`
   - 保留 `Route by Autofix Class`
   - 条件 persona 中 `design-lens-reviewer` / `scope-guardian-reviewer` / `security-lens-reviewer` 继续使用 `model: inherit`
3. `spec-plan`
   - 保持 repo-grounded technical planning，不回退到上游“任意非软件任务通用计划器”
   - 保留本地 Stage-0 预载块
4. `spec-work` / `spec-work-beta`
   - 不放开 bare prompt 路径
   - 保留本地 Stage-0 预载块
   - `spec-work-beta` 增加宿主无关的 Codex delegation 适配与 `.spec-first/config.local.yaml` 路径
5. `spec-compound`
   - 保持默认 full-mode
   - 仅在用户明确要求时进入 compact-safe
   - 不引入上游“默认先问 full/lightweight + 可选 session historian”交互
6. `spec-compound-refresh`
   - 沿用本地 `spec:brainstorm` / `spec:compound` 命名空间与说明语气
7. `agents/workflow/bug-reproduction-validator.md`
   - 上游缺失，本地保留

## 5. 非阻断治理说明项

### 5.1 `949bdef` 在 execution shipping reference 上应按“语义边界”理解，而不是过度外推

**涉及文件**

- `skills/spec-work/references/shipping-workflow.md`
- `skills/spec-work-beta/references/shipping-workflow.md`

**现状**

- 两个 shipping reference 仍显式写出：
  - `Invoke the spec-code-review skill with mode:autofix`
  - `Invoke spec-code-review mode:autofix`
- 上游当前对应文件也保留同样的显式 `mode:autofix` 文本。

**审查判断**

- 这不是运行时 blocker，因为 `spec-code-review` 确实支持 `mode:autofix`
- 这也不是本地升级遗漏，因为上游 shipping reference 当前就是这样写的
- 真正的治理结论是：
  - `949bdef` 约束的是 dispatch / 调用姿态，不应被泛化成“所有后续 reference 文本都必须删除显式 mode”
  - 后续矩阵与审查报告必须把 execution shipping guidance 记为“显式 autofix 仍存在，且与上游一致”

## 6. 验证证据

### 6.1 机械验证

已执行并通过：

```bash
git diff --check
bash tests/unit/lang-policy.sh
npm run test:smoke
```

### 6.1a 逐文件机械对照统计

基于本报告第 8 节文件映射，额外对 `54` 个有上游对应的文件做了逐文件机械对照。对照规则分三层：

1. 原文完全相等
2. 仅做 `compound-engineering -> spec-first`、`ce-* -> spec-*`、命名空间/路径映射后相等
3. 映射后仍有差异，进入人工逐文件审查并归类为有意分叉

机械对照结果与本报告分类完全一致：

- `19` 个 `Exact`
- `5` 个 `Namespace equal`
- `30` 个 `Intentional divergence`
- `0` 个分类错配

这意味着本报告的分类不是主观归纳，而是先经过机械对照，再对剩余差异逐个做人工语义裁决。

### 6.2 核心合同 grep 验证

已执行并确认：

```bash
rg -n "mode:headless|report-only|\\.spec-first/workflows/spec-code-review|docs/solutions|run artifact|autofix_class|resolve-base" skills/spec-code-review/SKILL.md skills/spec-code-review/references/* -S
rg -n "batch_confirm|Promote Residual Concerns|Resolve Contradictions|Route by Autofix Class|pattern-resolved|synthesis-and-presentation" skills/spec-doc-review/SKILL.md skills/spec-doc-review/references/* -S
rg -n "untrusted input|PR comment text|cross_invocation|cluster-brief|prior-resolutions|spec-first:workflow:pr-comment-resolver" skills/resolve-pr-feedback/SKILL.md agents/workflow/pr-comment-resolver.md -S
rg -n "repo-relative|Output Structure|Deferred to Separate Tasks|spec-doc-review|deepening-workflow|plan-handoff|Execution target: external-delegate" skills/spec-plan/SKILL.md skills/spec-plan/references/* skills/spec-brainstorm/SKILL.md skills/spec-brainstorm/references/* -S
rg -n "Test Discovery|shipping-workflow|Code Review \\(REQUIRED\\)|spec-code-review|delegate:codex|codex-delegation-workflow|Behavioral changes with no test additions|mode:autofix" skills/spec-work/SKILL.md skills/spec-work/references/shipping-workflow.md skills/spec-work-beta/SKILL.md skills/spec-work-beta/references/shipping-workflow.md skills/spec-work-beta/references/codex-delegation-workflow.md agents/review/testing-reviewer.md -S
rg -n "Discoverability Check|docs/solutions/|What's next\\?|blocking question tool|kieran-python-reviewer|kieran-typescript-reviewer|code-simplicity-reviewer|compact-safe|full mode" skills/spec-compound/SKILL.md skills/spec-compound-refresh/SKILL.md AGENTS.md CLAUDE.md -S
```

### 6.3 运行时验证结论

1. CLI `init` / `doctor` / `clean` 仍通过 smoke。
2. runtime 生成资产仍使用当前 `spec-first` 命名空间、workflow scratch path 与 canonical agent rewrite 规则。
3. `lang-policy` 单元测试通过，说明 `AGENTS.md` / `CLAUDE.md` write-back 没有破坏治理注入。

## 7. shared commit 审查结论

当前基线已经统一到：

1. `owner-batch` 负责 shared commit 的语义裁决、迁移边界、保留分叉和 handoff。
2. `file-affinity` 批次负责真实文件落点与验证。
3. 矩阵、批次审查报告、最终审查报告已同步切换到这套口径。

审查确认：

- `f4e0904`
  - A 定义 review/ideate token 收敛语义
  - B 负责 `spec-ideate` 真实落点
- `9caaf07`
  - B 定义 mandatory review 总契约
  - C 负责 work/work-beta execution 真实落点
- `35678b8`
  - B 定义 testing gap 总契约
  - C 负责 work/work-beta/testing-reviewer 真实落点
- `31b0686`
  - B 定义 delegation posture / planning posture
  - C 负责 beta delegation 主落点
- `949bdef`
  - A 定义“dispatch 省略显式 mode 参数”的 shared 语义
  - C/D 按 file-affinity 落地 execution / compound-refresh 侧文件
  - execution shipping reference 保留显式 `mode:autofix`，且与上游当前文本一致；这里应理解为 shared commit 语义边界，而不是本地漏迁

## 8. 逐文件核对清单

### 8.1 批次 A：Review / Document Review / Feedback

| 本地文件 | 上游对应 | 状态 | 审查结论 |
|---|---|---|---|
| `skills/spec-code-review/SKILL.md` | `skills/ce-review/SKILL.md` | `Intentional divergence` | 对齐 compact returns / artifact / base 解析；保留本地 Stage-0 与非 headless 路线 |
| `skills/spec-code-review/references/findings-schema.json` | `skills/ce-review/references/findings-schema.json` | `Intentional divergence` | 已同步 schema 主体；仍含本地 `spec-first` 命名空间与 contract 口径 |
| `skills/spec-code-review/references/persona-catalog.md` | `skills/ce-review/references/persona-catalog.md` | `Intentional divergence` | 已同步 persona 结构；保留本地命名空间与 reviewer catalog 口径 |
| `skills/spec-code-review/references/resolve-base.sh` | `skills/ce-review/references/resolve-base.sh` | `Intentional divergence` | 已吸收上游 base 解析稳态修复；保留本地仓库/remote 口径 |
| `skills/spec-code-review/references/review-output-template.md` | `skills/ce-review/references/review-output-template.md` | `Intentional divergence` | 已同步 review 输出模板；保留 `spec-first` learnings / docs/solutions 引用 |
| `skills/spec-code-review/references/subagent-template.md` | `skills/ce-review/references/subagent-template.md` | `Intentional divergence` | 已同步 compact return / recursion guard；artifact 路径改写为 `.spec-first/workflows/spec-code-review/` |
| `skills/spec-ideate/SKILL.md` | `skills/ce-ideate/SKILL.md` | `Intentional divergence` | 已同步 token/latency 思路；保留本地 ideate 产品结构 |
| `skills/spec-ideate/references/post-ideation-workflow.md` | `skills/ce-ideate/references/post-ideation-workflow.md` | `Intentional divergence` | 语义已吸收，主要是命名空间/品牌映射 |
| `skills/spec-doc-review/SKILL.md` | `skills/spec-doc-review/SKILL.md` | `Intentional divergence` | 已同步 auto route / pattern-resolved；明确保留本地非 headless 与四项增强 |
| `skills/spec-doc-review/references/findings-schema.json` | `skills/spec-doc-review/references/findings-schema.json` | `Intentional divergence` | 与本地 `batch_confirm` / `auto` 路由口径一致 |
| `skills/spec-doc-review/references/subagent-template.md` | `skills/spec-doc-review/references/subagent-template.md` | `Intentional divergence` | 已同步 recursion guard，并保留本地 `batch_confirm` contract |
| `skills/spec-doc-review/references/synthesis-and-presentation.md` | `skills/spec-doc-review/references/synthesis-and-presentation.md` | `Intentional divergence` | 已吸收上游拆分 reference，并保留本地 synthesis 增强 |
| `agents/spec-doc-review/adversarial-document-reviewer.md` | `agents/spec-doc-review/adversarial-document-reviewer.md` | `Exact` | 与上游一致 |
| `agents/spec-doc-review/design-lens-reviewer.md` | `agents/spec-doc-review/design-lens-reviewer.md` | `Intentional divergence` | 唯一差异为 `model: inherit`，属本地宿主设置 |
| `agents/spec-doc-review/scope-guardian-reviewer.md` | `agents/spec-doc-review/scope-guardian-reviewer.md` | `Intentional divergence` | 唯一差异为 `model: inherit`，属本地宿主设置 |
| `agents/spec-doc-review/security-lens-reviewer.md` | `agents/spec-doc-review/security-lens-reviewer.md` | `Intentional divergence` | 唯一差异为 `model: inherit`，属本地宿主设置 |
| `skills/resolve-pr-feedback/SKILL.md` | `skills/resolve-pr-feedback/SKILL.md` | `Intentional divergence` | 已同步 untrusted input / cluster gate / cross-invocation；差异仅为本地命名空间和少量措辞 |
| `agents/workflow/pr-comment-resolver.md` | `agents/workflow/pr-comment-resolver.md` | `Intentional divergence` | 已同步 untrusted input 与 cluster workflow；差异仅为本地措辞与标点 |

### 8.2 批次 A：Agent Hygiene

| 本地文件 | 上游对应 | 状态 | 审查结论 |
|---|---|---|---|
| `agents/review/cli-agent-readiness-reviewer.md` | `agents/review/cli-agent-readiness-reviewer.md` | `Exact` | 与上游一致 |
| `agents/design/design-implementation-reviewer.md` | `agents/design/design-implementation-reviewer.md` | `Exact` | 与上游一致 |
| `agents/design/design-iterator.md` | `agents/design/design-iterator.md` | `Exact` | 与上游一致 |
| `agents/design/figma-design-sync.md` | `agents/design/figma-design-sync.md` | `Exact` | 与上游一致 |
| `agents/docs/ankane-readme-writer.md` | `agents/docs/ankane-readme-writer.md` | `Exact` | 与上游一致 |
| `agents/research/best-practices-researcher.md` | `agents/research/best-practices-researcher.md` | `Namespace equal` | 仅保留 `spec-first` 命名空间映射 |
| `agents/research/framework-docs-researcher.md` | `agents/research/framework-docs-researcher.md` | `Exact` | 与上游一致 |
| `agents/research/git-history-analyzer.md` | `agents/research/git-history-analyzer.md` | `Namespace equal` | 仅保留 `spec-first` 命名空间映射 |
| `agents/research/issue-intelligence-analyst.md` | `agents/research/issue-intelligence-analyst.md` | `Namespace equal` | 仅保留 `spec-first` 命名空间映射 |
| `agents/research/learnings-researcher.md` | `agents/research/learnings-researcher.md` | `Namespace equal` | 仅保留 `spec-first` 命名空间映射 |
| `agents/research/repo-research-analyst.md` | `agents/research/repo-research-analyst.md` | `Exact` | 与上游一致 |
| `agents/review/agent-native-reviewer.md` | `agents/review/agent-native-reviewer.md` | `Exact` | 与上游一致 |
| `agents/review/architecture-strategist.md` | `agents/review/architecture-strategist.md` | `Exact` | 与上游一致 |
| `agents/review/code-simplicity-reviewer.md` | `agents/review/code-simplicity-reviewer.md` | `Namespace equal` | 仅保留 `spec-first` 命名空间映射 |
| `agents/review/data-integrity-guardian.md` | `agents/review/data-integrity-guardian.md` | `Exact` | 与上游一致 |
| `agents/review/data-migration-expert.md` | `agents/review/data-migration-expert.md` | `Exact` | 与上游一致 |
| `agents/review/deployment-verification-agent.md` | `agents/review/deployment-verification-agent.md` | `Exact` | 与上游一致 |
| `agents/review/pattern-recognition-specialist.md` | `agents/review/pattern-recognition-specialist.md` | `Exact` | 与上游一致 |
| `agents/review/performance-oracle.md` | `agents/review/performance-oracle.md` | `Exact` | 与上游一致 |
| `agents/review/schema-drift-detector.md` | `agents/review/schema-drift-detector.md` | `Exact` | 与上游一致 |
| `agents/review/security-sentinel.md` | `agents/review/security-sentinel.md` | `Exact` | 与上游一致 |
| `agents/workflow/spec-flow-analyzer.md` | `agents/workflow/spec-flow-analyzer.md` | `Exact` | 与上游一致 |
| `agents/workflow/bug-reproduction-validator.md` | 上游缺失 | `Local-only keep` | 上游已删除，本地仍保留且本轮未机械回退 |

### 8.3 批次 B：Plan / Brainstorm / Ideate

| 本地文件 | 上游对应 | 状态 | 审查结论 |
|---|---|---|---|
| `skills/spec-plan/SKILL.md` | `skills/ce-plan/SKILL.md` | `Intentional divergence` | 已同步 repo-relative / output structure / mandatory spec-doc-review / external-delegate 姿态；保留 repo-grounded planning 与 Stage-0 |
| `skills/spec-plan/references/deepening-workflow.md` | `skills/ce-plan/references/deepening-workflow.md` | `Intentional divergence` | 已同步深度化流程；保留本地 product boundary 与 pipeline 口径 |
| `skills/spec-plan/references/plan-handoff.md` | `skills/ce-plan/references/plan-handoff.md` | `Intentional divergence` | 已同步 handoff 结构；审查期修复 `spec-doc-review mode:headless` 残留 blocker |
| `skills/spec-brainstorm/SKILL.md` | `skills/ce-brainstorm/SKILL.md` | `Intentional divergence` | 已同步 repo-relative / mandatory spec-doc-review / reference 抽取；保留本地 WHAT/HOW 边界与产品定位 |
| `skills/spec-brainstorm/references/handoff.md` | `skills/ce-brainstorm/references/handoff.md` | `Intentional divergence` | 已同步 handoff；保留 `spec-first` 命名空间与本地 calling 口径 |
| `skills/spec-brainstorm/references/requirements-capture.md` | `skills/ce-brainstorm/references/requirements-capture.md` | `Intentional divergence` | 已同步 requirements capture；差异主要为命名空间与本地 product 口径 |

### 8.4 批次 C：Work / Work Beta / Testing

| 本地文件 | 上游对应 | 状态 | 审查结论 |
|---|---|---|---|
| `skills/spec-work/SKILL.md` | `skills/ce-work/SKILL.md` | `Intentional divergence` | 已同步 Test Discovery / review mandatory / reference 路由；保留无 bare prompt 与 Stage-0 / swarm 补充说明 |
| `skills/spec-work/references/shipping-workflow.md` | `skills/ce-work/references/shipping-workflow.md` | `Intentional divergence` | 已同步 shipping reference；当前仍保留显式 `spec-code-review mode:autofix`，属非阻断治理残余 |
| `skills/spec-work-beta/SKILL.md` | `skills/ce-work-beta/SKILL.md` | `Intentional divergence` | 已同步 delegation 解析/路由；保留无 bare prompt、本地 config 路径、宿主无关描述与 swarm 补充说明 |
| `skills/spec-work-beta/references/shipping-workflow.md` | `skills/ce-work-beta/references/shipping-workflow.md` | `Intentional divergence` | 已同步 shipping reference；当前仍保留显式 `spec-code-review mode:autofix`，属非阻断治理残余 |
| `skills/spec-work-beta/references/codex-delegation-workflow.md` | `skills/ce-work-beta/references/codex-delegation-workflow.md` | `Intentional divergence` | 已同步 delegation contract；路径、宿主表述、config 位置已按 `spec-first` 本地化 |
| `agents/review/testing-reviewer.md` | `agents/review/testing-reviewer.md` | `Exact` | 与上游一致 |

### 8.5 批次 D：Compound / Compound Refresh

| 本地文件 | 上游对应 | 状态 | 审查结论 |
|---|---|---|---|
| `skills/spec-compound/SKILL.md` | `skills/ce-compound/SKILL.md` | `Intentional divergence` | 已同步 discoverability / stack-aware reviewer / blocking question tool；保留默认 full-mode、compact-safe 显式选择、不引入 session historian |
| `skills/spec-compound-refresh/SKILL.md` | `skills/ce-compound-refresh/SKILL.md` | `Intentional divergence` | 已同步 discoverability 与 refresh contract；保留本地措辞与 `spec:*` 命名空间 |

### 8.6 Governance / Write-back

| 本地文件 | 上游对应 | 状态 | 审查结论 |
|---|---|---|---|
| `AGENTS.md` | 无直接对应 | `Write-back` | `docs/solutions/` discoverability 已写回，内容与 compound discoverability check 一致 |
| `CLAUDE.md` | 无直接对应 | `Write-back` | `docs/solutions/` discoverability 已写回；同时固化 compound 批次 A-D 本地分叉基线 |

## 9. 成功判定

满足以下条件，因此判定本轮升级成功：

1. 矩阵覆盖的核心 source-of-truth 文件已逐个核实，不抽样。
2. 本地保留分叉都有明确产品/宿主/Stage-0 理由，没有“看起来像遗漏”的隐性漂移。
3. 审查期间发现的唯一真实 blocker 已修复并复验通过。
4. shared commit 规则已统一到“owner 定语义，file-affinity 落地”。
5. 机械验证与 smoke 均通过，说明 source-of-truth 更新未破坏 runtime 资产生成。

最终判断：

**`spec-first` 已成功完成对 `compound-engineering-plugin` 核心工作流矩阵范围内的升级，同步结果可作为后续继续追上游的稳定基线。**
