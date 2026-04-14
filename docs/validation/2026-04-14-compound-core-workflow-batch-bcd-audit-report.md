# Compound Core Workflow 批次 B/C/D 最终审查报告

- 审查日期：`2026-04-14`
- 分支：`feat/sync-compound-core-workflow-updates`
- 计划文件：[docs/plans/2026-04-13-006-feat-sync-compound-core-workflow-updates-plan.md](/Users/kuang/xiaobu/spec-first/docs/plans/2026-04-13-006-feat-sync-compound-core-workflow-updates-plan.md)
- 上游基线：`/Users/kuang/xiaobu/compound-engineering-plugin/plugins/compound-engineering`
- 审查范围：批次 B `spec-plan/spec-brainstorm`、批次 C `spec-work/spec-work-beta/testing-reviewer`、批次 D `spec-compound/spec-compound-refresh`

## 1. 总结结论

本轮已完成批次 B/C/D 的实现、逐文件核对与全量验证，结论如下：

1. `spec-plan`、`spec-brainstorm`、`spec-work`、`spec-work-beta`、`testing-reviewer`、`spec-compound`、`spec-compound-refresh` 均已与上游当前基线做“逐文件、非抽样”对照。
2. 批次 B 把 planning 链路收口为 repo-relative path、mandatory `document-review`、reference 化 late-sequence 内容；批次 C 把 execution 链路收口为默认 code review、test discovery/testing-gap 约束与 beta delegation 路线；批次 D 把 compound 链路收口为 discoverability、stack-aware reviewer routing 与阻塞式后续选择。
3. owner-batch / shared-batch 的约束已被显式回写到同步矩阵：
   - A owner 的 `949bdef` handoff 已被 C/D 消费并核查
   - B owner 的 `9caaf07` / `35678b8` / `31b0686` 语义已在 C 的 work/work-beta 落点中完成闭环，并在矩阵 notes 中写清 handoff 关系
4. 本地有价值分叉仍被保留，没有发生机械回退：
   - 不放开 bare prompt 到 `spec-work` / `spec-work-beta`
   - `spec-compound` 保持默认 full-mode，`compact-safe` 仍是显式选择而非起始问答
   - `spec-review` 不引入上游 headless
   - `document-review` 保留本地四项增强

## 2. 对上游项目意图的理解

批次 B/C/D 对应的上游更新，本质上不是“新增更多 workflow”，而是把现有主链路的三类能力做标准化：

1. **Planning 标准化**：用 repo-relative path、output structure、document-review handoff 把 plan/requirements 文档从“可读”提升到“可执行、可审查、可移交”。
2. **Execution 标准化**：把 review/testing/delegation 三条执行门禁改成默认契约，而不是临时提示；同时通过 reference 抽取降低主 skill 的上下文压力。
3. **Knowledge 标准化**：让 `docs/solutions/` 作为知识库被明确发现、明确使用，并让 compound 的 reviewer 路由更贴近真实主栈，而不是依赖固定示例或不存在的 reviewer。

这三类收敛与 `spec-first` 当前“workflow 即产品 contract”的定位高度一致，因此批次 B/C/D 适合高保真迁移。

## 3. 审查方法

本轮继续遵循“主题组 -> 文件组 -> 实际落点”的方法，而不是按 commit message 机械套用：

1. 先以同步计划和半结构化矩阵为主索引，识别 B/C/D 各批次文件
2. 逐个打开 `spec-first` 与上游 `compound-engineering-plugin` 对应文件
3. 区分：
   - 必须直接迁移的文本 contract
   - 需要 reference 抽取的长段落
   - 需要保留的本地分叉
   - 共享 commit 只做 handoff 消费、不可重复裁决的落点
4. 每完成一组修改，立即做针对性 grep / smoke 验证，避免把文档 drift 带到批次末尾

## 4. 文件级审查结果

### 批次 B

| 本地文件 | 上游对应 | 处理方式 | 结果 |
|---|---|---|---|
| `skills/spec-plan/SKILL.md` | `skills/ce-plan/SKILL.md` | 吸收 repo-relative 路径约束、Output Structure、Deferred to Separate Tasks、mandatory document-review handoff、late-sequence reference 抽取 | 已完成 |
| `skills/spec-plan/references/deepening-workflow.md` | `skills/ce-plan/references/deepening-workflow.md` | 新增 reference，承接 confidence/deepening 流程 | 已完成 |
| `skills/spec-plan/references/plan-handoff.md` | `skills/ce-plan/references/plan-handoff.md` | 新增 reference，承接 handoff/document-review/final checks | 已完成 |
| `skills/spec-brainstorm/SKILL.md` | `skills/ce-brainstorm/SKILL.md` | 吸收 repo-relative、requirements capture/handoff reference、mandatory document-review 路由 | 已完成 |
| `skills/spec-brainstorm/references/requirements-capture.md` | `skills/ce-brainstorm/references/requirements-capture.md` | 新增 reference | 已完成 |
| `skills/spec-brainstorm/references/handoff.md` | `skills/ce-brainstorm/references/handoff.md` | 新增 reference | 已完成 |

### 批次 C

| 本地文件 | 上游对应 | 处理方式 | 结果 |
|---|---|---|---|
| `skills/spec-work/SKILL.md` | `skills/ce-work/SKILL.md` | 吸收 `Test Discovery`、测试覆盖评估、默认 review 强制、shipping reference 路由；保留本地 Stage-0 预载与非 bare-prompt 入口 | 已完成 |
| `skills/spec-work/references/shipping-workflow.md` | `skills/ce-work/references/shipping-workflow.md` | 新增 reference，承接 Phase 3-4 shipping 流程 | 已完成 |
| `skills/spec-work-beta/SKILL.md` | `skills/ce-work-beta/SKILL.md` | 吸收 delegation 参数解析、config resolution、routing gate、Test Discovery、shipping/delegation 双 reference 路由；删除旧的长篇 external delegate 文本 | 已完成 |
| `skills/spec-work-beta/references/shipping-workflow.md` | `skills/ce-work-beta/references/shipping-workflow.md` | 新增 shipping reference | 已完成 |
| `skills/spec-work-beta/references/codex-delegation-workflow.md` | `skills/ce-work-beta/references/codex-delegation-workflow.md` | 新增 Codex delegation reference，并将路径/命名空间改写为 `spec-first` 口径 | 已完成 |
| `agents/review/testing-reviewer.md` | `agents/review/testing-reviewer.md` | 增加“行为变化但没有任何测试变更”的审查项 | 已完成 |

### 批次 D

| 本地文件 | 上游对应 | 处理方式 | 结果 |
|---|---|---|---|
| `skills/spec-compound/SKILL.md` | `skills/ce-compound/SKILL.md` | 吸收 discoverability check、stack-aware reviewer routing、blocking question tool 版 `"What's next?"`；移除不存在 reviewer 的引用 | 已完成 |
| `skills/spec-compound-refresh/SKILL.md` | `skills/ce-compound-refresh/SKILL.md` | 吸收 discoverability check，并明确 instruction file 回写的 follow-up commit 策略 | 已完成 |
| `AGENTS.md` | discoverability 回写目标 | 新增 `docs/solutions/` 可发现性说明 | 已完成 |
| `CLAUDE.md` | discoverability 回写目标 | 新增 `docs/solutions/` 可发现性说明；同步 compound 批次 A-D 基线说明 | 已完成 |

## 5. 共享 commit 闭环说明

### A -> B

- `f4e0904`
  - owner 为 A
  - B 只消费 `spec-ideate` 落点结论，不重复裁决
  - 当前矩阵已回写 owner handoff 与 B 消费状态

### A -> C/D

- `949bdef`
  - owner 为 A，负责 shared 语义裁决与 A 范围内真实文件落点
  - C 按 file-affinity 承接 `spec-work` / `spec-work-beta` 的真实文件落点与核查
  - D 按 file-affinity 承接 `spec-compound-refresh` 的真实文件落点与核查
  - 当前主 `SKILL.md` 未重新引入调用层硬编码 `mode` 指导；shipping reference 仍保留显式 `mode:autofix` 的 review 流程说明，且这与上游当前文本一致

### B -> C

- `9caaf07`
  - B owner 负责 mandatory review 总契约与 planning 侧 handoff
  - C 按 file-affinity 负责 work/work-beta 的真实文本落点与验证
- `35678b8`
  - B owner 负责 testing gap 总契约与 planning 侧 handoff
  - C 按 file-affinity 负责 testing-reviewer 与 execution 层的真实落点
- `31b0686`
  - B owner 负责 delegation posture / planning posture 的语义裁决与 `spec-plan` 落点
  - C 按 file-affinity 负责 beta delegation 主落点

这里没有回避 shared commit 的真实落点问题，而是把“owner 的裁决责任”和“file-affinity 的实施位置”都写进矩阵 notes，保证后续继续升级时能知道谁定义了语义、谁完成了落点。

## 6. 验证记录

### 机械验证

已执行并通过：

```bash
git diff --check
bash tests/unit/lang-policy.sh
npm run test:smoke
```

### 定向语义验证

已执行并确认：

```bash
rg -n "repo-relative|Output Structure|Deferred to Separate Tasks|document-review|deepening-workflow|plan-handoff" skills/spec-plan/SKILL.md skills/spec-plan/references/deepening-workflow.md skills/spec-plan/references/plan-handoff.md
rg -n "requirements-capture|document-review|verify before claiming|defer design decisions to planning|repo-relative" skills/spec-brainstorm/SKILL.md skills/spec-brainstorm/references/requirements-capture.md skills/spec-brainstorm/references/handoff.md
rg -n "Test Discovery|shipping-workflow|Code Review \\(REQUIRED\\)|spec-review|Review every change|delegate:codex|codex-delegation-workflow|Behavioral changes with no test additions" skills/spec-work/SKILL.md skills/spec-work/references/shipping-workflow.md skills/spec-work-beta/SKILL.md skills/spec-work-beta/references/shipping-workflow.md skills/spec-work-beta/references/codex-delegation-workflow.md agents/review/testing-reviewer.md
rg -n "Discoverability Check|docs/solutions/|What's next\\?|blocking question tool|kieran-python-reviewer|kieran-typescript-reviewer|code-simplicity-reviewer" skills/spec-compound/SKILL.md skills/spec-compound-refresh/SKILL.md AGENTS.md CLAUDE.md
```

审查结论：

1. 批次 B 的 planning/requirements contract 已齐。
2. 批次 C 的 execution/review/testing/delegation contract 已齐。
3. 批次 D 的 knowledge/discoverability/reviewer-routing contract 已齐。
4. 运行时 smoke 通过，说明这些改动没有破坏 `init` / runtime asset 生成 / doctor / clean 链路。

## 7. 有意保留的本地分叉

以下分叉依然是显式保留：

1. `spec-work` / `spec-work-beta`
   - 不放开 bare prompt 入口
   - 只吸收 `6dabae6` 的 test discovery 部分
2. `spec-compound`
   - 保持默认 full-mode，`compact-safe` 仅在用户明确要求时进入
   - 不引入上游 explicit mode prompt 路径
3. `spec-review`
   - 不接入上游 headless
4. `document-review`
   - 保留 `batch_confirm`
   - 保留 `Promote Residual Concerns`
   - 保留 `Resolve Contradictions`
   - 保留 `Route by Autofix Class`

## 8. 剩余风险

当前剩余风险已经从“功能未同步”降到“后续继续追上游时的策略一致性”：

1. `spec-work-beta` 的 Codex delegation 目前是 workflow contract 层同步，还没有在本仓库里与具体 executor 做端到端演练。
2. `spec-compound` 的 stack-aware reviewer routing 目前是文档合同级落地；如果后续 agent 集合继续变化，需要连带刷新这里的可用 reviewer 列表。
3. 同步矩阵虽然已回写状态与 handoff，但如果后续再追加批次 E/F，建议延续当前“owner 语义 + file-affinity 落点 + 审查报告”三件套，不要回退到只看 commit subject 的方式。

## 9. 最终判断

批次 B/C/D 已达到“可作为后续同步工作的稳定基线”的质量标准：

- 目标文件已逐个审查
- 共享 commit 的 owner / handoff / real-file 落点关系已说清
- 关键验证命令已执行并通过
- 本地保留分叉是有意识的产品/架构决策，而不是遗漏

从这一步开始，`spec-first` 对 `compound-engineering-plugin` 的核心工作流同步，已经不再是零散修补，而是一套可持续维护的升级基线。
