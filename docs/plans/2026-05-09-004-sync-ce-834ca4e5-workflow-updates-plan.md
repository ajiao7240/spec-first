---
title: Sync CE 834ca4e5 Workflow Updates Into Spec-First
type: refactor
status: active
date: 2026-05-09
origin: docs/solutions/architecture-patterns/upstream-ce-sync-upgrade-methodology-2026-04-26.md
spec_id: SYNC-CE-834CA4E5
---

# Sync CE 834ca4e5 Workflow Updates Into Spec-First

## Conclusion

本方案已按当前 `spec-first` 源码重新审查 CE `06a7cee0..834ca4e5` 增量，只保留当前项目仍缺的修改内容。同步方式是语义适配，不整文件覆盖，不复制 CE `tests/**`，不手改 generated runtime assets。

最终保留 10 个实施单元：

1. `spec-sessions` 编排重构
2. `resolve-pr-feedback` GraphQL pagination 与 mode reference 拆分
3. `spec-plan` 模板拆分、Implementation Units heading 与 handoff 调整
4. `spec-code-review` / `spec-doc-review` 降噪与 findings table pipe escaping
5. `spec-ideate` topic axes、basis 与 root markdown 约束
6. `spec-compound-refresh` per-action flows reference 拆分
7. `spec-debug` trivial fast path 与 observed-value hypothesis discipline
8. `spec-work-beta` Codex sandbox flags 与 per-batch effort
9. `agent-native-architecture` checklist reference 拆分
10. `git-worktree` bundled script path 修复

## Scope Boundaries

- Source-of-truth 只改 `skills/`、`agents/`、`src/cli/`、`tests/`、`docs/`、`CHANGELOG.md` 等 source 文件。
- 不手改 `.claude/`、`.codex/`、`.agents/skills/`。
- CE `tests/**` 只作为上游意图证据读取。落地时为保留单元新增或更新当前仓库的 `tests/unit/**` 合约测试。
- 不引入 CE-only 命名、路径、badge、plugin metadata 或 `ce-*` command surface。
- 不扩展当前项目产品边界到本方案未列入的新增入口或宿主平台。
- 脚本只负责确定性事实和 machine-readable output。LLM/skill 负责语义筛选、审查判断和 synthesis。

## Review Evidence

本次收敛基于以下当前源码事实：

- `skills/spec-sessions/SKILL.md` 仍只 dispatch `spec-session-historian`，未拥有 discovery、ranking、scratch extraction。
- `agents/spec-session-historian.agent.md` 仍要求调用 `session-inventory` / `session-extract` primitive skills。
- `skills/spec-session-inventory/**` 与 `skills/spec-session-extract/**` 仍存在，scripts 尚未迁入 `spec-sessions`。
- `skills/resolve-pr-feedback/scripts/get-pr-comments` 与 `get-thread-for-comment` 仍使用单页 GraphQL connection。
- `skills/spec-plan/SKILL.md` 仍内联 plan template，Implementation Units 仍是 `- U1. **[Name]**` 列表项。
- `skills/spec-code-review/**` 与 `skills/spec-doc-review/**` 尚未统一 pipe escaping、origin slot、content-shape document classification 和 heading-style unit parsing。
- `skills/spec-ideate/**` 仍使用 `warrant`，尚无 topic axes、basis、axis recovery 和 user-named root markdown contract。
- `skills/spec-compound-refresh/SKILL.md` 仍内联 Keep/Update/Consolidate/Replace/Delete flow，`references/per-action-flows.md` 不存在。
- `skills/spec-debug/SKILL.md` 尚无 CE 的 trivial-bug fast-path、grounding observation requirement、failed-fix invalidation 规则。
- `skills/spec-work-beta/references/codex-delegation-workflow.md` 已有 yolo 的 current flag，但 `full-auto` 仍映射到 stale `--full-auto`，且缺 per-batch effort resolution。
- `skills/agent-native-architecture/SKILL.md` 仍内联 checklist、anti-patterns、success criteria，`references/checklists.md` 不存在。
- `skills/git-worktree/SKILL.md` 仍使用 bare `bash scripts/worktree-manager.sh`，在 Claude Code runtime skill directory 与用户 cwd 分离时会找不到 bundled script。

## Test Sync Rule

需要同步测试，但不同步 CE `tests/**` 目录本身。

每个保留实施单元必须有当前仓库风格的窄验证：

- 用 `spec-*`、`git-*` 当前命名，不保留 `ce-*` 断言。
- 使用现有 CommonJS/Jest `tests/unit/**` contract test 风格。
- 对 script 资产补 `bash -n` 或 fixture-level unit tests。
- 对 prose/skill contract 补字符串和负向断言，尤其是 CE-only branding、stale CLI flags、runtime delivery、skill-tool deadlock 等风险。
- 不为未同步 source 能力迁入 CE 测试。

## Implementation Units

### U1. Rework Session History Into Orchestrator-Owned Extraction

**Goal:** 让 `spec-sessions` 负责 session discovery、filter/rank、scratch extraction 和 historian dispatch；`spec-session-historian` 只综合已抽取文件，禁止再调用 Skill tool。

**Current gap:** 当前 `spec-sessions` 是薄 wrapper；historian 仍直接调用 `session-inventory` / `session-extract`；primitive skills 仍作为 agent-facing runtime skills 存在，形成 Claude Code/Codex 场景下的 subagent skill-tool deadlock 风险。

**Modify:**

- `skills/spec-sessions/SKILL.md`
- `agents/spec-session-historian.agent.md`
- `skills/spec-compound/SKILL.md`
- `skills/spec-session-inventory/**`
- `skills/spec-session-extract/**`
- Runtime asset filtering / cleanup 相关 source，仅当 primitive skill delivery 发生变化时修改

**Required behavior:**

- `spec-sessions` 预解析 repo name 和 scan window。
- discovery 只覆盖 Claude Code 与 Codex。不要引入 Cursor、Gemini、Pi。
- 先按 branch/keyword 过滤再 extraction；`files_matched: 0` 时直接返回 no relevant prior sessions。
- scratch dir 用 OS temp；`extract-skeleton.py` / `extract-errors.py` 支持 `--output` 并输出 machine-readable status。
- historian input contract 只接收 `problem_topic`、`scratch_dir`、selected sessions 和 extracted file paths。
- historian 明确禁止 Skill tool、discovery、raw session extraction。
- `spec-compound` 的 session enrichment 调用 `spec-sessions`，不再直接 dispatch historian primitive flow。

**Tests:**

- `tests/unit/spec-sessions-contracts.test.js`
- `tests/unit/session-history-scripts.test.js`
- Runtime cleanup / asset filter tests only if source primitive skill delivery changes

**Verification:**

```bash
npx jest tests/unit/spec-sessions-contracts.test.js tests/unit/session-history-scripts.test.js --runInBand
npm run lint:skill-entrypoints
```

### U2. Sync Resolve PR Feedback Pagination And Mode References

**Goal:** 修复 reviewThreads、comments、reviews 单页读取导致漏评论的问题，并把 full/targeted mode prose 从主 skill 拆到 references。

**Current gap:** 当前 scripts 仍是单页 GraphQL connection；`SKILL.md` 仍内联 full/targeted 大段流程；targeted comment 查 parent thread 时超过第一页会漏。

**Modify:**

- `skills/resolve-pr-feedback/SKILL.md`
- `skills/resolve-pr-feedback/references/full-mode.md`
- `skills/resolve-pr-feedback/references/targeted-mode.md`
- `skills/resolve-pr-feedback/scripts/get-pr-comments`
- `skills/resolve-pr-feedback/scripts/get-thread-for-comment`
- `tests/unit/resolve-pr-feedback-contracts.test.js`

**Required behavior:**

- `get-pr-comments` 用独立 paginated queries 读取 review threads、issue comments、reviews。
- 使用 `gh api graphql --paginate --slurp`，再由 `jq` 合并稳定 JSON shape。
- `get-thread-for-comment` 对 `reviewThreads(first:100, after:$endCursor)` 分页。
- 保留 `isOutdated` 作为 relocation signal，不当作 resolution signal。
- 主 skill 负责 mode routing；脚本只负责事实抓取。

**Verification:**

```bash
npx jest tests/unit/resolve-pr-feedback-contracts.test.js --runInBand
bash -n skills/resolve-pr-feedback/scripts/get-pr-comments skills/resolve-pr-feedback/scripts/get-thread-for-comment
```

### U3. Sync Plan Template Extraction And Implementation Unit Headings

**Goal:** 把 plan template 拆到 reference，统一 Implementation Units 为 `### U1. [Name]` heading，并让 handoff 默认执行 headless doc-review。

**Current gap:** 当前模板仍内联在 `skills/spec-plan/SKILL.md`；Implementation Units 仍是列表项；handoff 已有 headless review 文字，但还缺 CE 的 actionable-findings 才展示 deeper review 的完整约束。

**Modify:**

- `skills/spec-plan/SKILL.md`
- `skills/spec-plan/references/plan-template.md`
- `skills/spec-plan/references/plan-handoff.md`
- `skills/spec-plan/references/deepening-workflow.md` if section references drift
- `tests/unit/spec-plan-contracts.test.js`
- `tests/unit/runtime-plan-contracts.test.js` if rendered runtime output changes

**Required behavior:**

- Plan authoring读取 `references/plan-template.md`，不再在主 skill 内联完整模板。
- Generated plans 使用 `### U1. [Name]` heading。
- 兼容 legacy `- U1. **[Name]**` 读取，避免旧计划失效。
- Handoff 默认运行 `spec-doc-review mode:headless <plan>`。
- 只有 actionable findings 时展示 deeper review 入口；FYI-only 不制造额外菜单。

**Verification:**

```bash
npx jest tests/unit/spec-plan-contracts.test.js tests/unit/runtime-plan-contracts.test.js --runInBand
```

### U4. Reduce Review Noise And Harden Findings Tables

**Goal:** 同步 CE review 降噪：doc type classification、origin slot、plan-origin suppression、visual aid preservation、prior-round suppression，以及 findings table literal pipe escaping。

**Current gap:** 当前 doc-review 已有 headless 与 decision primer，但仍按路径分类 document type，未传 `Origin` slot；persona 缺少完整 doc-type adaptation；code-review 尚未识别 `### U1.` units；output templates 未明确 escape literal `|`。

**Modify:**

- `skills/spec-code-review/SKILL.md`
- `skills/spec-code-review/references/review-output-template.md`
- `skills/spec-doc-review/SKILL.md`
- `skills/spec-doc-review/references/review-output-template.md`
- `skills/spec-doc-review/references/subagent-template.md`
- `skills/spec-doc-review/references/synthesis-and-presentation.md`
- `skills/spec-doc-review/references/walkthrough.md`
- `agents/spec-adversarial-document-reviewer.agent.md`
- `agents/spec-coherence-reviewer.agent.md`
- `agents/spec-design-lens-reviewer.agent.md`
- `agents/spec-feasibility-reviewer.agent.md`
- `agents/spec-product-lens-reviewer.agent.md`
- `agents/spec-scope-guardian-reviewer.agent.md`
- `agents/spec-security-lens-reviewer.agent.md`
- `tests/unit/spec-code-review-contracts.test.js`
- `tests/unit/spec-doc-review-contracts.test.js`

**Required behavior:**

- Orchestrator 基于内容 shape 分类 `requirements` / `plan` / `task-pack`，不只看路径。
- Reviewer prompt 接收 `Document type` 与 `Origin`。
- `origin:` plan 不常规重审 WHAT/WHY，除非 plan 引入新战略/架构风险。
- Prior-round Apply/Skip/Defer/Acknowledge 不重复出 findings。
- Diagram/visual aid 不因 redundancy 被建议删除；需要时更新不一致的图。
- Markdown findings tables 中所有 cell 内 literal `|` 必须 escape。
- Walkthrough regular menu 保留 `Auto-resolve with best judgment on the rest`，只有 advisory-only finding 才出现 Acknowledge 替代。
- Code review requirements completeness 同时读取 Requirements 和 heading-style Implementation Units。

**Verification:**

```bash
npx jest tests/unit/spec-code-review-contracts.test.js tests/unit/spec-doc-review-contracts.test.js --runInBand
```

### U5. Sync Ideate Topic Axes And Basis Contract

**Goal:** 给 `spec-ideate` 增加 topic-surface decomposition、axis coverage/recovery、`basis` terminology 和 user-named root markdown handling。

**Current gap:** 当前 `spec-ideate` 仍使用 `warrant`；没有 Phase 1.5 topic axes；没有 axis gaps / recovery；没有 user-named root `.md` 作为 constraint 的明确规则。

**Modify:**

- `skills/spec-ideate/SKILL.md`
- `skills/spec-ideate/references/post-ideation-workflow.md`
- `skills/spec-ideate/references/universal-ideation.md`
- `tests/unit/spec-ideate-contracts.test.js`

**Required behavior:**

- Phase 1 后做 topic-surface decomposition，产出有限 axes。
- Surprise-me mode 与 atomic subject 可跳过 decomposition。
- Axis recovery 最多 dispatch 2 个 recovery agents，不无限扩展。
- `warrant` 统一迁移为 `basis`，下游 artifact 和测试同步更新。
- User explicitly named root `.md` 文件作为 constraint 全量读取；其他 root markdown 仅作为 background。
- 不重新引入 `STRATEGY.md` 必读 anchor。

**Verification:**

```bash
npx jest tests/unit/spec-ideate-contracts.test.js --runInBand
```

### U6. Extract Compound Refresh Per-Action Flows

**Goal:** 把 `spec-compound-refresh` 的 Phase 4 action flows 下沉到 `references/per-action-flows.md`，减少主 skill 上下文负担。

**Current gap:** 当前主 skill 仍内联 Keep/Update/Consolidate/Replace/Delete 详细步骤；reference 文件不存在。

**Modify:**

- `skills/spec-compound-refresh/SKILL.md`
- `skills/spec-compound-refresh/references/per-action-flows.md`
- `tests/unit/spec-compound-contracts.test.js`

**Required behavior:**

- 主 skill 只说明 Phase 4 根据分类读取 reference 中对应 flow。
- Reference 保留五类 flow 的完整 criteria、examples 和 step-by-step。
- 保留当前 spec-first 已有增强：`validate-frontmatter.py` 从 `skills/spec-compound-refresh/` 目录运行，并且 validation 通过前不得删除旧 learning。
- Delete flow 保留 final inbound-link check。

**Verification:**

```bash
npx jest tests/unit/spec-compound-contracts.test.js --runInBand
```

### U7. Sync Debug Triage And Hypothesis Discipline

**Goal:** 把 CE debug 的轻量快路径和更强 hypothesis discipline 同步到 `spec-debug`。

**Current gap:** 当前 `spec-debug` 没有 trivial-bug fast-path；hypothesis 不要求 grounding observation；失败修复后只说回 Phase 2，没有要求显式 invalidation。

**Modify:**

- `skills/spec-debug/SKILL.md`
- `tests/unit/spec-debug-contracts.test.js`

**Required behavior:**

- 明显单文件 typo、missing import、null deref、off-by-one 可走 trivial-bug fast-path。
- Fast path 仍必须经过 Phase 2 的 Fix it now / Diagnosis only choice gate。
- 编辑前仍运行 workspace/branch check。
- 每个 hypothesis 至少包含一个 concrete observation，例如 runtime value、log、instrumented boundary、working comparison 或具体 code reference。
- Fix 失败后先明确 invalidated evidence，再形成新 hypothesis。
- 非 trivial bug 仍默认完整 investigation。

**Verification:**

```bash
npx jest tests/unit/spec-debug-contracts.test.js --runInBand
```

### U8. Sync Work-Beta Codex Flags And Per-Batch Effort

**Goal:** 更新 `spec-work-beta` 的 Codex CLI invocation contract，避免 stale sandbox flags，并按 batch complexity 选择 reasoning effort。

**Current gap:** 当前 yolo 已使用 `--dangerously-bypass-approvals-and-sandbox`，但 full-auto 仍写 `--full-auto`；consent 文案仍旧；`delegate_effort` 直接作为全局 flag，没有 per-batch `effective_effort`。

**Modify:**

- `skills/spec-work-beta/SKILL.md`
- `skills/spec-work-beta/references/codex-delegation-workflow.md`
- `tests/unit/spec-work-beta-contracts.test.js`

**Required behavior:**

- yolo mode 使用 `--dangerously-bypass-approvals-and-sandbox`。
- full-auto mode 使用 `-s workspace-write`，并说明 network 需由 Codex config 启用。
- `delegate_effort` 是 config floor，不直接传给 `codex exec`。
- 每个 batch 计算 `effective_effort`：`default | medium | high | xhigh`。
- `effective_effort=default` 时省略 `-c`；永不传 literal `"default"`。
- Config floor 只能抬高不能降低 picked effort。
- 保留 beta opt-in、consent 和 `~/.codex/config.toml` default deferral。

**Verification:**

```bash
npx jest tests/unit/spec-work-beta-contracts.test.js --runInBand
```

### U9. Slim Agent-Native Architecture Main Skill

**Goal:** 把 `agent-native-architecture` 的 checklist、anti-patterns、success criteria 移到 reference，主 skill 只保留 overview、intake、routing 和 reference index。

**Current gap:** 当前主 skill 仍内联 400+ 行长内容，`references/checklists.md` 不存在，tests 也仍断言主 skill 内联 checklist。

**Modify:**

- `skills/agent-native-architecture/SKILL.md`
- `skills/agent-native-architecture/references/checklists.md`
- `tests/unit/agent-native-architecture-contracts.test.js`

**Required behavior:**

- 保留当前 skill name `agent-native-architecture`，不引入 CE branding。
- 新增 route 14: review/checklists。
- `references/checklists.md` 包含 architecture checklist、anti-patterns、success criteria。
- Existing references 保持可路由。
- Runtime transform 仍不得包含 `compound-engineering`。

**Verification:**

```bash
npx jest tests/unit/agent-native-architecture-contracts.test.js --runInBand
```

### U10. Fix Git Worktree Bundled Script Path

**Goal:** 让 `git-worktree` 在 Claude Code marketplace/plugin runtime 和本地开发 runtime 都能找到 bundled `scripts/worktree-manager.sh`。

**Current gap:** 当前 docs/examples 使用 `bash scripts/worktree-manager.sh`。Claude Code runtime Bash cwd 是用户项目，不是 skill dir，bare relative path 会失败。

**Modify:**

- `skills/git-worktree/SKILL.md`
- Add focused test, for example `tests/unit/git-worktree-contracts.test.js`

**Required behavior:**

- 命令改为 `bash "${CLAUDE_SKILL_DIR:-.}/scripts/worktree-manager.sh" create <branch-name> [from-branch]`。
- Examples 和 Integration section 同步更新。
- 如 source frontmatter 支持 allowed tools，可加等价 Bash allow pattern；若当前 generator 不消费该字段，不为此单独改 runtime governance。
- 不改 `scripts/worktree-manager.sh`，当前脚本自身已按 main worktree root 解析。

**Verification:**

```bash
npx jest tests/unit/git-worktree-contracts.test.js --runInBand
npm run lint:skill-entrypoints
```

## Implementation Order

按风险和依赖顺序落地：

1. U1 sessions deadlock fix
2. U2 PR feedback pagination
3. U3 plan headings/template
4. U4 review contract updates
5. U5 ideate basis/axes
6. U8 work-beta Codex flags
7. U7 debug discipline
8. U6 compound-refresh reference split
9. U10 git-worktree path fix
10. U9 agent-native reference split

U3 先于 U4，因为 code-review 需要识别新的 Implementation Units heading。其余单元可独立实施，但每个单元都必须先更新或新增 focused tests，再改 source。

## Final Verification

每个单元运行对应 focused tests。全部完成后再运行：

```bash
git diff --check
npm run test:unit
npm run typecheck
npm run lint:skill-entrypoints
```

只有当 runtime delivery 或 managed host entry docs 发生变化时，才在 source tests 通过后运行：

```bash
spec-first init --claude
spec-first init --codex
```

运行后必须审查 `CLAUDE.md`、`AGENTS.md` 和 generated runtime diffs，确认它们来自 source/generator，而不是手写 runtime patch。

## CHANGELOG

本计划文档已追加当前 batch 的 `CHANGELOG.md` 记录。后续实施每批 source 变更仍必须追加独立 changelog 行，作者使用当前 Codex developer profile `leokuang`。

## Sources

- Sync methodology: `docs/solutions/architecture-patterns/upstream-ce-sync-upgrade-methodology-2026-04-26.md`
- Role baseline: `docs/10-prompt/结构化项目角色契约.md`
- CE repo: `/Users/kuang/xiaobu/compound-engineering-plugin`
- CE range: `06a7cee0..834ca4e5`
- Current plan reviewed: `docs/plans/2026-05-09-004-sync-ce-834ca4e5-workflow-updates-plan.md`
