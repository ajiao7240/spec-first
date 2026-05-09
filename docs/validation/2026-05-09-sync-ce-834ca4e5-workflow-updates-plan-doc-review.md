---
title: CE 834ca4e5 增量同步方案综合审查
date: 2026-05-09
type: doc-review
status: needs-revision
target: docs/plans/2026-05-09-004-sync-ce-834ca4e5-workflow-updates-plan.md
origin: docs/solutions/architecture-patterns/upstream-ce-sync-upgrade-methodology-2026-04-26.md
mode: single-agent-report-only-fallback
---

# CE 834ca4e5 增量同步方案综合审查

## 结论

目标计划的方向是对的：它没有机械复制 CE `06a7cee0..834ca4e5` 的 118 个文件变更，而是把范围收敛到当前 `spec-first` 仍缺的 10 个 workflow / skill / agent / script 质量改进单元。

但该计划还不能直接作为实施依据。主要问题不是“少列了 CE 文件”，而是几个实施单元没有把 CE 改动背后的运行场景钻透：

- U1 `spec-sessions` 的核心场景是 subagent skill-tool deadlock，不是普通文案瘦身。primitive skill delivery 是 source/governance 决策，不能写成条件性 cleanup。
- U2 PR feedback 分页是确定性 fact layer 修复，必须有多页 GraphQL `--paginate --slurp` fixture 证明 JSON shape 合并正确。
- U7 `spec-debug` 要同步的是 debug discipline，包括 observed-value data-flow tracing、项目测试约定、minimal fix、逐行 self-review，不只是 trivial fast-path。
- U8 Codex delegation 需要负向 contract 防止 stale `--full-auto` 和 direct `delegate_effort` passthrough 残留。
- U10 `git-worktree` 的 `allowed-tools` 是 runtime 可用性约束，当前 source 已有同类 frontmatter 用法，不应写成模糊可选项。

结论：计划应先按本审查的 P1/P2 findings 修订，再进入 implementation。实施时仍应保持当前计划已写明的核心边界：语义适配，不整文件覆盖，不复制 CE `tests/**`，不手改 generated runtime assets。

## 审查模式

- mode: single-agent report-only fallback
- helper agents: not used
- 审查阶段未修改目标计划、skill、agent、script 或 tests，未运行测试。
- 本文档落地阶段仅新增本审查文档，并按仓库治理追加 `CHANGELOG.md` 记录。
- source boundary: 只把 `skills/`、`agents/`、`src/cli/`、`tests/`、`docs/` 等 source 文件作为当前项目事实；`.claude/`、`.codex/`、`.agents/skills/` 不作为 source-of-truth。
- upstream boundary: CE 仓库按 `/Users/kuang/xiaobu/compound-engineering-plugin` 的 `834ca4e58a82c4e06040ff448bc4bd97551f4be9` 审查，range 为 `06a7cee0..834ca4e5`。

## 覆盖范围

本次综合审查合并了两轮材料：

- 针对目标计划 10 个实施单元的逐项 source/test/reference 核对。
- 对 CE 对应改动背后场景的深挖分析，包括 skill 节点职责、agent 专家能力、script fact layer 意图、runtime delivery 与治理边界。

主要覆盖路径：

- 目标计划：`docs/plans/2026-05-09-004-sync-ce-834ca4e5-workflow-updates-plan.md`
- 角色契约：`docs/10-prompt/结构化项目角色契约.md`
- U1：`skills/spec-sessions/`、`agents/spec-session-historian.agent.md`、`skills/spec-compound/SKILL.md`、`skills/spec-session-inventory/`、`skills/spec-session-extract/`、`src/cli/plugin.js`、`src/cli/contracts/dual-host-governance/skills-governance.json`、相关 runtime capability / smoke / unit tests
- U2：`skills/resolve-pr-feedback/`、`tests/unit/resolve-pr-feedback-contracts.test.js`
- U3/U4：`skills/spec-plan/`、`skills/spec-code-review/`、`skills/spec-doc-review/`、相关 reviewer agents、相关 unit tests
- U5：`skills/spec-ideate/`、`tests/unit/spec-ideate-contracts.test.js`
- U6：`skills/spec-compound-refresh/`、`tests/unit/spec-compound-contracts.test.js`
- U7：`skills/spec-debug/`、`tests/unit/spec-debug-contracts.test.js`
- U8：`skills/spec-work-beta/`、`tests/unit/spec-work-beta-contracts.test.js`
- U9：`skills/agent-native-architecture/`、`tests/unit/agent-native-architecture-contracts.test.js`
- U10：`skills/git-worktree/`、`tests/unit/`

## Findings

### P1-1. U1 把 primitive skill delivery 写成条件项，但它是 load-bearing source/governance 决策

目标计划在 U1 的修改范围里写：

- `Runtime asset filtering / cleanup 相关 source，仅当 primitive skill delivery 发生变化时修改`
- 测试也写成只有 delivery 发生 source 层变化时才补 runtime cleanup / asset filter tests

这太弱。CE 的实际改动不是单纯把文档搬进 `ce-sessions`，而是修复 subagent 里调用 Skill tool 的 deadlock。CE 新结构中：

- `ce-sessions` 负责 discovery、filter/rank、scratch extraction、historian dispatch。
- `ce-session-historian` 只接收 pre-extracted file paths，并明确禁止 Skill tool、Bash extraction、discovery primitive。
- `ce-session-inventory` / `ce-session-extract` 的 `SKILL.md` 被删除，脚本迁入 `ce-sessions/scripts/`。

当前 `spec-first` 则仍显式把 primitive skills 当作 agent-facing internal runtime skills：

- `src/cli/plugin.js:35-38` 定义 `AGENT_FACING_INTERNAL_SKILLS`，包含 `spec-session-extract` 与 `spec-session-inventory`。
- `src/cli/plugin.js:603-607` 会把 allowlist 中的 `internal_only` skill 放入 `internalSkills` runtime delivery。
- `src/cli/contracts/dual-host-governance/skills-governance.json:325-344` 明确记录两个 primitive 的 dual-host internal delivery。
- `src/cli/instruction-bootstrap.js:158`、`:189` 明确提醒不要直接暴露 internal-only skills。
- `tests/unit/runtime-capability-catalog.test.js:38` 断言 delivered agent-facing internal skills。
- `tests/unit/spec-sessions-contracts.test.js:64-69` 断言 primitive skills 作为 internal runtime skills delivery。
- `tests/smoke/cli.sh:125-130` 与 `:194-199` 断言 Claude/Codex runtime 生成这两个 internal skill。

如果 U1 的目标是让 historian 不再依赖 Skill tool，那么是否继续 delivery primitive skills 必须成为 U1 的显式设计决策，而不是“如果发生变化再考虑”的附带项。

**要求修订：**

- U1 修改范围必须增加：
  - `src/cli/plugin.js`
  - `src/cli/contracts/dual-host-governance/skills-governance.json`
  - `src/cli/instruction-bootstrap.js`
  - `tests/unit/runtime-capability-catalog.test.js`
  - `tests/unit/dual-host-governance-contracts.test.js`
  - `tests/unit/spec-sessions-contracts.test.js`
  - `tests/smoke/cli.sh`
  - `docs/catalog/runtime-capabilities.md` 或其 generator 相关验证
- U1 必须明确选择两种设计之一：
  - A. primitive skills 仍作为 internal skills delivery，但 historian 不再依赖它们，并解释保留 delivery 的 consumer。
  - B. primitive scripts 迁入 `spec-sessions` 后，primitive skill runtime delivery 同步移除，并更新 governance/runtime tests。
- U1 验证不能只跑 `spec-sessions-contracts` 和 script tests，必须覆盖 runtime capability、dual-host governance、smoke delivery。

### P1-2. U2 分页实现的验证计划不足，无法证明 `--paginate --slurp` JSON shape 合并正确

目标计划要求 `get-pr-comments` 用独立 paginated queries 读取 `reviewThreads`、`comments`、`reviews`，再用 `jq` 合并稳定 JSON shape。这个方向正确。

当前脚本确实仍是单页读取：

- `skills/resolve-pr-feedback/scripts/get-pr-comments:53` 使用 `reviewThreads(first: 50)`。
- `skills/resolve-pr-feedback/scripts/get-pr-comments:64` 使用 thread comments `first: 10`。
- `skills/resolve-pr-feedback/scripts/get-pr-comments:76` 使用 PR comments `first: 100`。
- `skills/resolve-pr-feedback/scripts/get-pr-comments:83` 使用 reviews `first: 50`。
- `skills/resolve-pr-feedback/scripts/get-thread-for-comment:35` 使用 `reviewThreads(first: 100)`。
- 当前脚本没有 `--paginate`、`--slurp`、`pageInfo` / cursor pagination。

问题是目标计划的验证只写：

```bash
npx jest tests/unit/resolve-pr-feedback-contracts.test.js --runInBand
bash -n skills/resolve-pr-feedback/scripts/get-pr-comments skills/resolve-pr-feedback/scripts/get-thread-for-comment
```

现有 `tests/unit/resolve-pr-feedback-contracts.test.js` 主要覆盖 verdict、dispatch boundary、shell safety 等 prose contract。`bash -n` 只能证明 shell 语法正确，不能证明多页 GraphQL 结果合并正确，也不能证明旧 consumer 仍能读取 edge-wrapped `review_threads` shape。

**要求修订：**

- U2 测试必须新增 fixture-level script tests，至少覆盖：
  - `reviewThreads` 两页合并。
  - PR issue comments 两页合并。
  - reviews 两页合并。
  - `get-thread-for-comment` 目标 comment 在第二页 thread 时仍能找到。
  - 输出 JSON shape 与旧 consumer 兼容，尤其是 `review_threads: [{ node: ... }]`。
  - `isOutdated` 保留为 relocation signal，不当作 resolution signal。
  - thread 内 comments 超过第一页时的处理策略明确记录，若仍 capped at 100，要写明非目标。
- 如果采用 `gh api graphql --paginate --slurp`，测试应模拟 slurp 后数组 shape，而不是只断言脚本文本包含 `--paginate`。
- U2 文案应强调当前本地 bot filtering、cross-invocation、`isOutdated` semantics 必须保留，不能用 CE 脚本整文件覆盖。

### P1-3. U7 漏掉 CE debug discipline 的多个关键场景

目标计划 U7 只覆盖：

- trivial-bug fast-path
- grounding observation requirement
- failed-fix invalidation

CE `ce-debug` 的实际质量改进更完整。它解决的是 debug workflow 容易跳过因果链、凭代码形状猜测、修症状不修根因的问题。关键纪律包括：

- trivial-bug fast-path 仍要经过 Phase 2 的 `Fix it now` / `Diagnosis only` choice gate。
- fast-path 编辑前仍必须执行 workspace/branch check。
- Phase 1.3 从 symptom 向上追 data flow，先读 code shape，再用 observed values 验证。
- 复现测试要遵循项目测试约定；没有约定时再写 minimal isolated test。
- 每个 hypothesis 必须有 concrete observation，例如 runtime value、log、instrumented boundary、working comparison 或具体 code reference。
- Phase 3 minimal fix 禁止 drive-by refactor、formatting、unrelated cleanup。
- Phase 3 完成前 self-review every changed line；非平凡修复运行 host lightweight review tool，而不是完整 PR-tier code-review。
- failed fix 后必须显式 invalidate 当前 hypothesis，再形成新的 grounded hypothesis。

当前 `skills/spec-debug/SKILL.md` 已有一些基础能力：choice gate、workspace/branch check、causal chain gate。但缺少 CE 这次新增的 observed-value tracing、完整 failed-fix invalidation 和 minimal-fix/self-review 纪律。

**要求修订：**

- U7 必要行为补齐：
  - observed-value data-flow tracing。
  - project testing convention before reproduction test。
  - minimal fix, no unrelated refactor/formatting/cleanup。
  - every changed line self-review。
  - non-trivial fix uses lightweight harness review, not full `spec-code-review` multi-agent flow。
  - failed fix must state invalidated evidence before new hypothesis。
- U7 测试增加负向边界：
  - trivial fast-path 只适用于单文件 typo、missing import、obvious null deref、off-by-one 这类明确链路。
  - 非 trivial bug 仍默认完整 investigation。
  - fast-path 不能绕过 user choice gate 或 branch check。

### P1-4. U8 stale Codex flags 与 effort 迁移需要负向 contract，当前计划测试描述不够精确

当前缺口属实：

- `skills/spec-work-beta/references/codex-delegation-workflow.md:71` 仍描述 full-auto 为 `--full-auto`。
- `skills/spec-work-beta/references/codex-delegation-workflow.md:226-229` 仍把 full-auto 映射到 `SANDBOX_FLAG="--full-auto"`。
- `skills/spec-work-beta/references/codex-delegation-workflow.md:242` 仍直接把 `delegate_effort` 插入 `model_reasoning_effort="<delegate_effort>"`。
- `skills/spec-work-beta/SKILL.md:65-76` 仍把 `work_delegate_effort` 解析为 session-level `delegate_effort`，没有 per-batch `effective_effort`。

目标计划的必要行为正确：full-auto 应使用 `-s workspace-write`，network 由 `~/.codex/config.toml` 的 `[sandbox_workspace_write] network_access = true` 控制，`delegate_effort` 应成为 config floor，每个 batch 计算 `effective_effort`，`effective_effort=default` 时省略 `-c`。

问题是计划只列一个 broad contract test。现有 `tests/unit/spec-work-beta-contracts.test.js:189-196` 还断言 reference 包含 `If delegate_effort is set`，这会与目标行为冲突。

**要求修订：**

- U8 测试条目明确新增负向断言：
  - reference 不包含 `--full-auto`。
  - full-auto 使用 `-s workspace-write`。
  - yolo 使用 `--dangerously-bypass-approvals-and-sandbox`。
  - 不出现 literal `model_reasoning_effort="default"`。
  - 不出现 direct `<delegate_effort>` passthrough 到 `codex exec`。
  - `delegate_effort` 被描述为 config floor，只能 raise，不能 lower。
  - 每个 batch 使用 `effective_effort`。
- 计划应要求更新现有旧断言，而不是只“新增 contract”。
- CE `5139ff13` 的 config pre-resolution 单命令修复不应照搬 `.compound-engineering` 路径。当前 `spec-first` 已使用 `.spec-first/config.local.yaml` 的 single-command form，这部分应作为“已满足事实”记录，不进入修改范围。

### P2-1. U3/U4 标题迁移有顺序说明，但缺少 writer/reader 兼容的集成验证

目标计划已把 U3 排在 U4 前，并说明 U3 先于 U4，因为 code-review 需要识别新的实施单元标题。这个顺序判断正确。

当前 source 证据：

- `skills/spec-plan/SKILL.md:446` 仍要求 implementation unit 使用 legacy `- U1. **[Name]**`。
- `skills/spec-plan/SKILL.md:525` 仍内联 `#### 4.2 Core Plan Template`。
- `skills/spec-plan/SKILL.md:703` 模板仍有 `- U1. **[Name]**`。
- `tests/unit/spec-plan-contracts.test.js:226` 仍通过 `skill.split('#### 4.2 Core Plan Template')` 读取内联模板。
- `skills/spec-work/SKILL.md:175-176` 和 `skills/spec-work-beta/SKILL.md:224-225` 依赖 implementation units 和 U-ID 派生任务。
- `skills/spec-write-tasks/references/task-pack-schema.md:245` 依赖 plan 中的 clear implementation units 编译 task pack。
- `skills/spec-code-review/SKILL.md:633-636` 会在 requirements completeness 中读取 plan requirements 和 implementation units。

问题是计划把 U3 和 U4 分别验证，缺少一个强制集成 checkpoint 来证明 `spec-plan` 新生成的 heading-style unit 能被 `spec-code-review`、`spec-work`、`spec-work-beta`、`spec-write-tasks` 读取。

**要求修订：**

- 在 U3 或 U4 增加联合验证：
  - 一个 fixture plan 使用 `### U1. [Name]`。
  - code-review contract 能识别 `## Requirements` + heading-style `## Implementation Units`。
  - work / work-beta / write-tasks 至少有 prose contract 或 fixture 证明 U-ID 读取兼容。
  - legacy `- U1. **[Name]**` 继续可读。
- 最终验证前增加 checkpoint：U3 不能在 U4/downstream reader tests 之前单独视为完成。

### P2-2. U4 需要把 doc-review 降噪拆成具体 reviewer 场景

目标计划 U4 方向正确，但还应更明确地描述哪些规则属于 orchestrator，哪些属于 shared template / synthesis，哪些属于 persona agent。

当前 `spec-doc-review` 已经有 headless、decision primer、task-pack review、FYI routing、prior-round suppression 的一部分。因此“尚未分类”不能写得过满，更准确的缺口是：

- 尚未统一按内容形态做 document classification，当前仍 path-first。
- 尚未把 `Origin` slot 传给 reviewer prompt。
- adversarial reviewer 尚未按 `Document type` + `Origin` 抑制 plan 的 premise re-litigation。
- subagent template 尚未完整抑制“上一轮 Apply 已解决”的 no-action observation。
- code-review 尚未明确识别 `### U1.` heading-style units。
- review output template 尚未要求 findings table cells 中的 literal `|` 转义。

CE 对应场景：

- content-shape classification 防止 brainstorm-style doc 放在 `docs/plans/` 或 plan-shaped doc 放在 `docs/brainstorms/` 时 reviewer 误判。
- `Origin` slot 告诉 adversarial reviewer：带 origin 的 plan 是 HOW 文档，WHAT/WHY 已在 origin 处理，常规 premise challenge 会制造噪音。
- prior-round resolution suppression 防止 reviewer 把“已应用修复已经落地”作为新 finding。
- visual aid false-positive 规则防止 reviewer 因“prose 已覆盖”建议删除 diagram/table。

**要求修订：**

- U4 必要行为拆分为：
  - Orchestrator: content-shape classification、origin extraction、template variable injection。
  - Shared subagent template: `Document type` / `Origin` / prior-round resolution suppression / visual-aid false-positive / literal pipe escaping rules。
  - Persona agents: adversarial doc-type adaptation，必要时 product/scope/security/design/coherence 文案微调。
  - Code-review: heading-style U-ID parser。
- 明确保留 spec-first 本地增强：task-pack review boundary、Codex `spawn_agent` fallback、headless envelope、decision primer。

### P2-3. U10 把 `allowed-tools` 写成可选，但当前 source 已支持同类 frontmatter

当前 `skills/git-worktree/SKILL.md` 仍使用 bare script path：

- `skills/git-worktree/SKILL.md:18` 使用 `bash scripts/worktree-manager.sh create <branch-name> [from-branch]`。
- `skills/git-worktree/SKILL.md:27-28` examples 仍用 bare path。
- `skills/git-worktree/SKILL.md:73` integration section 仍要求 bare path。
- `tests/unit/git-worktree-contracts.test.js` 不存在。

CE 修复说明了真实 runtime 场景：Claude Code runtime Bash CWD 是用户项目，不是 skill dir，所以 bare `bash scripts/worktree-manager.sh` 会找不到 bundled script；`${CLAUDE_SKILL_DIR:-.}` 在 Claude runtime 指向 skill dir，在其他 harness unset 时 fallback 到当前路径。

目标计划把 `allowed-tools` 写成“如 source frontmatter 支持 allowed tools，可加”。这不够。当前仓库其他 source 已存在 `allowed-tools` 用法，例如 `skills/resolve-pr-feedback/SKILL.md:5`。因此这里应先做 source/generator 能力确认；若可消费，就必须作为 U10 的一部分同步窄 pattern，而不是模糊可选。

**要求修订：**

- U10 必要行为改为：
  - 命令、examples、integration section 都使用 `bash "${CLAUDE_SKILL_DIR:-.}/scripts/worktree-manager.sh" create ...`。
  - 确认 `git-worktree` source frontmatter 可消费 `allowed-tools`。
  - 若可消费，加入窄 pattern，例如 `Bash(bash *worktree-manager.sh)` 或项目当前约定的等价形式。
  - 若不可消费，必须写明 source 证据，并保持“不为此单独扩展 runtime governance”的边界。
- 新增 `tests/unit/git-worktree-contracts.test.js`：
  - 不再出现 bare `bash scripts/worktree-manager.sh`。
  - examples / integration 都使用 `${CLAUDE_SKILL_DIR:-.}`。
  - 如启用 `allowed-tools`，断言 pattern 不退化为 `Bash(bash *)`。

### P2-4. U5 `warrant` -> `basis` 是 artifact contract 迁移，计划应补 consumer inventory

当前缺口属实：

- `skills/spec-ideate/SKILL.md:322-340` 仍使用 per-idea `warrant`。
- `skills/spec-ideate/references/universal-ideation.md:44-63` 仍使用 `warrant`。
- `skills/spec-ideate/references/post-ideation-workflow.md:21-43`、`:96-97`、`:230` 仍使用 `warrant`。

CE 的改动不是普通术语替换。`basis` 是 per-idea output contract 字段，影响 generation、critique、presentation、persistence、handoff。计划只写“下游 artifact 和测试同步更新”过于笼统。

**要求修订：**

- U5 增加 consumer inventory：
  - `skills/spec-ideate/SKILL.md`
  - `skills/spec-ideate/references/universal-ideation.md`
  - `skills/spec-ideate/references/post-ideation-workflow.md`
  - `tests/unit/spec-ideate-contracts.test.js`
  - 任何 ideation artifact template 或 persistence/handoff 段落
- 区分 field-level `warrant` 和普通英文 `warranted`。建议字段级统一迁移，普通 prose 如容易混淆也改写。
- 测试增加负向断言：source/references/tests 不再出现字段级 `**warrant**`、`Warrant:` 或 `warrant strength`。

### P2-5. U9 的 route 14 需要证明不是新增复杂路由负担

当前缺口属实：

- `skills/agent-native-architecture/SKILL.md` 仍内联 architecture checklist、anti-patterns、success criteria。
- `skills/agent-native-architecture/references/checklists.md` 不存在。
- `tests/unit/agent-native-architecture-contracts.test.js:45` 仍断言主 skill 包含 `## Architecture Review Checklist`。

CE 将主 skill 瘦身为 overview、intake、routing、reference index，并新增 route 14 指向 `references/checklists.md`。这个方向符合 progressive disclosure，但在 `spec-first` 中仍要遵守 Light contract。新增 route 14 是否必要，需要说明用户如何触发、与现有 route 是否重叠。

**要求修订：**

- U9 明确 `review/checklists` 的消费场景：
  - 用户要求审查 agent-native architecture。
  - 设计完成后要跑 checklist。
  - refactor/migration 需要 anti-pattern scan。
- 如果只是 reference index，不必强称为新 route；可以写成 “reference index item”。
- 测试迁移为：
  - 主 skill 不再内联 checklist 长内容。
  - `references/checklists.md` 包含 checklist / anti-patterns / success criteria。
  - 主 skill 可路由或索引到该 reference。
  - runtime transform 不含 `compound-engineering`。

### P2-6. 明确不保留项缺少逐项排除理由

目标计划的范围边界写了“不引入 CE-only 命名、路径、badge、plugin metadata 或未列入口”，但没有解释本轮 CE diff 中哪些大块不应同步。后续实施者会在 118 文件 diff 中反复误判漏项。

**要求修订：新增“明确不保留项”章节，至少列出：**

- `docs/skills/**`：CE 用户文档站，当前 spec-first 没有同类产品文档面。若未来建设，应单独做产品/文档方案，不属于本轮质量同步。
- `ce-riffrec-feedback-analysis`：CE-only Riffrec domain skill，当前 spec-first 产品边界和 skill set 不包含该 domain。
- `lfg`：当前 spec-first 将 `lfg` 治理为 legacy/internal shim，`tests/unit/lfg-contracts.test.js` 明确禁止公开 workflow path；不应同步 CE 允许 model invocation 和 CI autofix loop 的 public/autonomous 方向。
- `ce-commit-push-pr` trim：当前 `git-commit-push-pr` 已有更强本地安全边界，包括 temp file / `--body-file` / no broad `git add -A` / description-only flow。CE trim 不应覆盖。
- skill/agent description trim：主要是 marketplace/frontmatter discovery 文案瘦身，不是当前核心质量缺口。
- Codex hooks：CE 是 TypeScript plugin writer 的 `.codex/hooks.json` target；当前 spec-first 是 CommonJS CLI 和 source/runtime projection，不应直接引入。
- plugin metadata、package release、manifest、CHANGELOG：版本与产品发布面不同步。
- CE `tests/**`：只作为 intent evidence，不复制测试目录；应在本仓库按 CommonJS/Jest/smoke 风格新增或更新测试。

### P3-1. U6 方向正确，但测试描述应覆盖 reference routeability

当前缺口属实：

- `skills/spec-compound-refresh/SKILL.md` 仍内联 Keep / Update / Consolidate / Replace / Delete flow。
- `skills/spec-compound-refresh/references/per-action-flows.md` 不存在。
- 当前安全规则存在：Replace flow 要从 `skills/spec-compound-refresh/` 目录运行 `validate-frontmatter.py`，验证通过前不得删除旧 learning；Delete flow 要 final inbound-link check。

目标计划已经要求保留这些安全增强。缺口在测试描述：不能只复用旧 contract test，要证明主 skill 从 inline flow 切换到 reference routeability。

**要求修订：**

- U6 测试增加：
  - 主 skill 不再内联五个完整 flow heading。
  - 主 skill 明确 Phase 4 按 action 读取 `references/per-action-flows.md`。
  - reference 文件包含五类 flow。
  - `validate-frontmatter.py` 与 inbound-link 规则保留。

### P3-2. 最终验证的 runtime projection gating 写得偏窄

目标计划写：只有 runtime delivery 或 managed host entry docs 发生变化时，才运行：

```bash
spec-first init --claude
spec-first init --codex
```

边界方向正确，但 gating 应更可操作。U1、U3、U8、U10 都可能影响 runtime projection 或 host-facing skill docs：

- U1 可能改变 internal skill delivery/governance。
- U3 改 plan template 与 references。
- U8 改 Codex delegation workflow。
- U10 改 skill bundled script invocation 和可能的 `allowed-tools` frontmatter。

**要求修订：**

- 若改动触及 `skills/**/SKILL.md`、`skills/**/references/**` 且这些会被 runtime sync，至少运行 source contract tests。
- 若改动触及 `src/cli/plugin.js`、governance contract、host entry docs、skill frontmatter delivery 字段，则运行 `spec-first init --claude` / `spec-first init --codex` 并审查 generated diffs。
- 继续保留不手改 generated runtime assets 的边界。

## 逐单元审查备注

### U1. sessions

主要缺口属实。当前 `spec-sessions` 仍是薄 dispatch；historian 仍直接要求 `session-inventory` / `session-extract`；`spec-compound` 仍直接 dispatch historian，并让 historian 自己决定 keyword search。

场景判断：CE 修的是“orchestrator 做确定性 extraction，historian 做语义 synthesis”的边界。脚本负责 session discovery / metadata / skeleton / error extraction，LLM agent 只读已抽取文件并综合。这符合 `Scripts prepare, LLM decides`。

文档问题：runtime delivery 是显式 governance，不应作为条件性 cleanup。U1 应升级为包含 dual-host governance/source delivery 的实施单元。

### U2. resolve-pr-feedback

主要缺口属实。脚本仍是单页 GraphQL connection；targeted 查 thread 也只读第一页。

场景判断：这是 PR feedback fact layer 修复。脚本必须完整抓 facts，LLM/skill 再判断 actionability、resolution、relocation。分页漏评论会让 resolver 基于不完整事实做错判断。

文档问题：必要行为正确，但测试计划不足。需要多页 fixture 和 JSON shape merge 验证。

### U3. spec-plan

主要缺口属实。模板仍内联；unit heading 仍是 legacy list item；`plan-template.md` 不存在。

场景判断：CE 的标题式 U-ID 不是样式偏好，而是让 implementation units 成为更稳定的 document anchors，方便 review、work、task-pack handoff 和长期追踪。

文档问题：要增加与 U4/downstream reader 的 compatibility checkpoint，避免 plan 先生成新格式但 review/work/tasks 读不到。

### U4. code-review / doc-review

方向基本正确。当前 doc-review 已经有 requirements / plan / task-pack 分类、headless、decision primer、部分 prior-round suppression。因此目标计划应从“完全没有”改成“尚未统一按内容形态分类并传递 `Document type` / `Origin` 到 persona prompt，且未完整实现本轮 CE 降噪规则”。

场景判断：doc-review 是专家能力编排。orchestrator 分类错误会让专家在错误语境下审查，尤其 adversarial reviewer 会在带 origin 的 plan 上重审 WHAT/WHY，制造噪音。

文档问题：U4 范围大，计划应更明确哪些规则放 shared template/synthesis，哪些才需要逐 persona 改。

### U5. ideate

主要缺口属实。`warrant` 仍是核心 output contract；axis / basis / root markdown 规则未落地。

场景判断：CE 的 topic-surface decomposition 是为了防止多 frame ideation 只在同一显著方向上重复发散。`basis` 是为了让每个 idea 的依据可审查，避免“听起来合理但不可验证”的 AI-slop。

文档问题：应补 consumer inventory 与字段迁移负向断言。

### U6. compound-refresh

主要缺口属实。五个 action flow 仍内联，`per-action-flows.md` 不存在。

场景判断：这是 progressive disclosure 优化。主 skill 应保留分类和何时加载 reference 的决策，per-action reference 保存长流程细节。不能削弱当前 spec-first 已有的 frontmatter validation 与 Delete inbound-link safety。

文档问题：测试应从旧 inline-flow 断言迁移到 reference routeability 断言，同时保留安全规则。

### U7. debug

主要缺口属实。已有部分轻量因果链表达、choice gate、branch check，但没有 CE 目标中的完整 trivial fast-path、observed-value hypothesis、invalidated evidence、minimal fix/self-review contract。

场景判断：debug skill 的核心不是“快”，而是避免错因果链。fast-path 只节省明显 bug 的流程成本，不能成为绕过 evidence 的捷径。

文档问题：补 negative boundary，防止 trivial fast-path 扩大化。

### U8. work-beta

主要缺口属实。`--full-auto` 和 direct `delegate_effort` 仍在 reference 中。

场景判断：这是 Codex delegation 的 runtime compatibility 与 resource allocation 修复。sandbox flag 错误会直接导致 delegate execution 失败；per-batch effort 防止复杂批次被低 effort 执行，也防止文档/typo 批次被过度配置。

文档问题：必须明确更新旧 tests，并加入负向断言；否则 stale CLI flag 很容易残留。

### U9. agent-native-architecture

主要缺口属实。主 skill 仍内联 checklist，`checklists.md` 不存在。

场景判断：这是 agent-native 专家 skill 的 progressive disclosure。主入口应帮助用户选择问题面，reference 承载长 checklist 和 anti-patterns。

文档问题：route 14 需要解释为何是 route 而不是仅 reference index，避免为拆文件引入额外 route surface。

### U10. git-worktree

主要缺口属实。skill 仍用 bare `bash scripts/worktree-manager.sh`，新测试不存在。

场景判断：这是 bundled script runtime path 修复。Claude Code marketplace/plugin runtime 的 Bash CWD 是用户项目，必须用 `${CLAUDE_SKILL_DIR}` 定位 skill 自身目录。`allowed-tools` 是同一 runtime 可用性的权限约束，不应模糊为可选。

文档问题：`allowed-tools` 应先基于 source/frontmatter/generator 能力做明确判断，支持则作为必改 runtime contract，不支持则写明证据和非目标。

## 测试同步结论

需要同步测试意图，但不同步 CE `tests/**` 目录本身。

原因：

- CE 使用自身 plugin/runtime/test harness，当前 `spec-first` 是 Node.js CommonJS CLI，测试布局、命名、runtime projection、governance contract 不同。
- 上游 CE tests 是 intent evidence，用于理解 bug / behavior / regression surface。
- 落地时应在当前仓库新增或更新 `tests/unit/**`、`tests/smoke/**` 或现有 contract tests，使用 `spec-*` / `git-*` 命名和当前 source/runtime 边界。

每个实施单元至少应有一个当前仓库风格的窄验证；脚本类变更必须有 fixture-level 或 executable-level 验证，不能只做字符串断言和 `bash -n`。

## 修订后建议实施顺序

建议保持目标计划的总体顺序，但在 P1 修订后按以下 checkpoint 执行：

1. U1 sessions deadlock 修复，同时明确 runtime delivery/governance 决策。
2. U2 PR feedback 分页，同时补多页 fixture 和 shape merge tests。
3. U3 plan template/title 写入，先更新 writer contract。
4. U4 review reader compatibility 与 doc-review 降噪，必须证明能读 U3 新格式。
5. U8 work-beta Codex flags 与 per-batch effort，清理 stale tests。
6. U7 debug discipline，补 observed-value/minimal-fix/self-review。
7. U5 ideate axes/basis，按 consumer inventory 完成字段迁移。
8. U6 compound-refresh reference 拆分，保留安全规则。
9. U10 git-worktree path + allowed-tools。
10. U9 agent-native reference 拆分。

U3 不能在 U4/downstream reader compatibility 之前视为完成。U1 如果选择移除 primitive runtime delivery，则必须和 governance/runtime catalog/smoke tests 同批完成。

## Verdict

Needs revision.

目标计划已经完成了最重要的第一步：没有盲目追上游，而是按当前 `spec-first` 产品边界保留 10 个高价值同步单元。修订重点不是增加更多 CE 变更，而是把已保留单元写得足够可执行、可验证、可治理。

实施前必须先处理 P1 findings；P2 findings 应在对应单元开工前写回计划；P3 findings 可作为实施 checklist 或测试补强项。

## 未执行验证

本次审查未运行：

```bash
npx jest ...
npm run test:unit
npm run typecheck
npm run lint:skill-entrypoints
```

原因：当前任务是汇总审查文档并写入本地，不是实施 CE 同步改动。后续修改目标计划或 source 后，应按对应单元运行聚焦 tests，再按影响面扩大验证。
