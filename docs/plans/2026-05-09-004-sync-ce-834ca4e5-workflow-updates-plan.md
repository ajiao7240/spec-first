---
title: 将 CE 834ca4e5 工作流更新同步到 Spec-First
type: refactor
status: active
date: 2026-05-09
origin: docs/solutions/architecture-patterns/upstream-ce-sync-upgrade-methodology-2026-04-26.md
spec_id: SYNC-CE-834CA4E5
---

# 将 CE 834ca4e5 工作流更新同步到 Spec-First

## 结论

本方案已按当前 `spec-first` 源码和后续审查报告二次收紧 CE `06a7cee0..834ca4e5` 增量，只保留当前项目仍缺且能提升 workflow 质量的修改内容。同步方式是语义适配，不整文件覆盖，不复制 CE `tests/**`，不手改 generated runtime assets。

本轮修订把审查报告中会影响执行正确性的弱约束升级为明确约束：

- U1 不再把 primitive skill delivery 视为条件性 cleanup，而是显式选择迁移脚本并移除 primitive internal runtime delivery。
- U2 不再只要求 `bash -n` 和 contract 字符串检查，必须补分页 JSON fixture / shape merge 验证。
- U3/U4 增加 writer/reader 联合验证，确保新 plan heading 能被 review 读取。
- U5 把 `warrant` -> `basis` 视为 artifact schema contract 迁移，必须做 consumer inventory。
- U6/U9 的 reference 拆分必须验证 routeability / reference index，而不是只移动文本。
- U8 增加 stale Codex flag 与 `delegate_effort` 直通的负向 contract。
- U10 不再只修 Claude `${CLAUDE_SKILL_DIR}` 路径，而是先修 `git-worktree` internal delivery、runtime path rewrite、inspect/doctor 同源投影与可执行路径 fixture，再同步窄 `allowed-tools`。

最终保留 10 个实施单元：

1. `spec-sessions` 编排重构
2. `resolve-pr-feedback` GraphQL 分页与模式引用拆分
3. `spec-plan` 模板拆分、实施单元标题与 handoff 调整
4. `spec-code-review` / `spec-doc-review` 降噪与 findings 表格管道符转义
5. `spec-ideate` 主题轴、basis 与根目录 markdown 约束
6. `spec-compound-refresh` 按 action 拆分 flows reference
7. `spec-debug` 轻量快路径与 observed-value hypothesis 约束
8. `spec-work-beta` Codex sandbox flags 与按 batch 推理强度
9. `agent-native-architecture` checklist reference 拆分
10. `git-worktree` bundled script 路径修复

## 范围边界

- 真相源只改 `skills/`、`agents/`、`src/cli/`、`tests/`、`docs/`、`CHANGELOG.md` 等 source 文件。
- 不手改 `.claude/`、`.codex/`、`.agents/skills/`。
- CE `tests/**` 只作为上游意图证据读取。落地时为保留单元新增或更新当前仓库的 `tests/unit/**` 合约测试。
- 不引入 CE-only 命名、路径、badge、plugin metadata 或 `ce-*` command surface。
- 不扩展当前项目产品边界到本方案未列入的新增入口或宿主平台。
- 脚本只负责确定性事实和 machine-readable output。LLM/skill 负责语义筛选、审查判断和 synthesis。
- 明确不纳入本批同步：CE `docs/skills/**` 技能目录页、release/plugin metadata、`ce-riffrec-feedback-analysis` 新 skill、`lfg` 调整、demo reel / polish beta 产品化内容、README/agent description 的纯文案瘦身，以及未被本方案列入的 CE 测试文件。
- `tests/` 在本仓库是 source contract 的一部分。上游 CE `tests/**` 不直接复制，但本方案保留的行为变化必须在当前 `tests/unit/**`、必要的 `tests/smoke/**` 中落成可验证断言。

## 当前源码证据

本次收敛基于以下当前源码事实：

- `skills/spec-sessions/SKILL.md` 仍只 dispatch `spec-session-historian`，未拥有 discovery、ranking、scratch extraction。
- `agents/spec-session-historian.agent.md` 仍要求调用 `session-inventory` / `session-extract` primitive skills。
- `skills/spec-session-inventory/**` 与 `skills/spec-session-extract/**` 仍存在，scripts 尚未迁入 `spec-sessions`。
- `src/cli/plugin.js` 仍通过 `AGENT_FACING_INTERNAL_SKILLS` 显式 delivery `spec-session-extract` / `spec-session-inventory`。
- `src/cli/contracts/dual-host-governance/skills-governance.json` 仍登记两个 primitive internal-only skills；`src/cli/instruction-bootstrap.js`、`skills/using-spec-first/SKILL.md` 和多处 tests 仍把它们当作 internal runtime surface。
- `skills/resolve-pr-feedback/scripts/get-pr-comments` 与 `get-thread-for-comment` 仍使用单页 GraphQL connection。
- `skills/spec-plan/SKILL.md` 仍内联计划模板，实施单元仍使用 `- U1. **[Name]**` 列表项。
- `skills/spec-code-review/**` 与 `skills/spec-doc-review/**` 尚未统一 pipe escaping、origin slot、content-shape document classification、heading-style unit parsing，以及内容形态到 persona prompt 的传递。
- `skills/spec-ideate/**` 仍使用 `warrant`，尚无 topic axes、basis、axis recovery 和 user-named root markdown contract。
- `skills/spec-compound-refresh/SKILL.md` 仍内联 Keep/Update/Consolidate/Replace/Delete flow，`references/per-action-flows.md` 不存在。
- `skills/spec-debug/SKILL.md` 尚无 CE 的 trivial-bug fast-path、grounding observation requirement、failed-fix invalidation 规则。
- `skills/spec-work-beta/references/codex-delegation-workflow.md` 已有 yolo 的 current flag，但 `full-auto` 仍映射到 stale `--full-auto`，且缺 per-batch effort resolution。
- `skills/agent-native-architecture/SKILL.md` 仍内联 checklist、anti-patterns、success criteria，`references/checklists.md` 不存在。
- `skills/git-worktree/SKILL.md` 仍使用 bare `bash scripts/worktree-manager.sh`，在 Claude Code runtime skill directory 与用户 cwd 分离时会找不到 bundled script。
- `skills/resolve-pr-feedback/SKILL.md` 与 `skills/proof/SKILL.md` 已证明当前 source frontmatter 可表达 `allowed-tools`，因此 `git-worktree` 的 bundled script allow pattern 属于 source contract，不是 runtime patch。
- `git-worktree` 在 `src/cli/contracts/dual-host-governance/skills-governance.json` 中是 `internal_only` + dual-host `internal`，但 `src/cli/plugin.js` 当前 delivered internal allowlist 只包含两个 session primitive，因此 workflow prose 已引用它，runtime delivery 却没有真正交付它。
- Claude/Codex adapters 当前只在 `isWorkflowSkill` 时 rewrite `skills/<skill>/...` source path；`git-worktree` 作为 internal skill 不会获得 runtime skill dir rewrite，因此仅使用 `${CLAUDE_SKILL_DIR:-.}` 会漏掉 Codex 场景。
- `docs/catalog/runtime-capabilities.md`、`README.md`、`README.zh-CN.md` 写有 bundled skills 与 agent-facing internal skills 数量；U1 退役 session primitives、U10 交付 `git-worktree` 会改变这些用户可见能力计数。

## 逐项核对结论

| 单元 | CE 增量意图 | 当前 spec-first 状态 | spec-first 最佳实践判断 |
|---|---|---|---|
| U1 sessions | CE 把 discovery/extraction 上移到 `ce-sessions`，historian 只读 scratch 文件且禁止 Skill tool。 | 当前 `spec-sessions` 仍是薄 dispatch，historian 仍依赖 `session-inventory` / `session-extract` skill。 | 同步语义，不复制 CE 的 Cursor 范围；迁移脚本到 `spec-sessions/scripts/`，删除 primitive runtime delivery，并与 U10 同批处理 delivered internal surface。 |
| U2 resolve-pr-feedback | CE 用三个独立 `--paginate --slurp` query 修复 top-level connection 截断。 | 当前脚本仍单页，且 shell strictness 低于项目脚本规范。 | 采用分页策略，但按本仓库补 `set -euo pipefail`、fixture 级 slurp shape tests；thread 内 comments 若不完整分页，必须暴露 truncation/unsupported fact，不能报告 confirmed absence。 |
| U3 spec-plan | CE 将模板拆到 reference，Implementation Units 改为 `### U1. [Name]`。 | 当前模板内联，unit 仍是 legacy list item。 | 同步 writer 格式，但必须保留 legacy reader；U3 完成条件依赖 U4 reader/parser contract 通过。 |
| U4 review | CE 加 `Origin`、文档类型适配、pipe escaping、视觉辅助保留和上一轮决策抑制。 | 当前已有 `Document type` 和 decision primer 基础，但缺 `Origin` slot、heading-style unit parsing 与 pipe escaping。 | 把分类、origin、presentation、walkthrough 放 shared template/synthesis；persona 只消费上下文做语义判断；保留 spec-first 的 CLI readiness reviewer 边界，不因 CE 没有而删除。 |
| U5 ideate | CE 从 `warrant` 迁到 `basis`，增加 topic axes / recovery 和 root markdown 约束。 | 当前 `warrant` 是字段级 contract，root markdown 和 axis recovery 未落地。 | 当作 artifact schema 迁移处理：先做 consumer inventory，再改 source/references/tests，普通 prose 用法也优先改写以免混淆。 |
| U6 compound-refresh | CE 把五类 action flow 移入 `references/per-action-flows.md`。 | 当前五个 flow 仍内联，安全规则已有但和 inline flow 绑定。 | 同步 reference 拆分，同时测试 routeability；保留 validate-frontmatter 与 inbound-link-before-delete 两条现有 spec-first 安全增强。 |
| U7 debug | CE 增加 trivial fast-path、concrete observation 和 failed-fix invalidation。 | 当前已有 choice gate、branch check 和部分轻量表达，但无完整 fast-path 边界。 | 同步 fast-path，但用负向边界防止跳过调查；非 trivial bug 仍走完整 framework。 |
| U8 work-beta | CE 更新 Codex sandbox flags，并把 `delegate_effort` 改为 per-batch `effective_effort` floor。 | 当前 `full-auto` 仍用过期 `--full-auto`，测试还断言旧直通行为。 | 同步 flag 和 effort 语义；`delegate_effort` 只作 floor，`default` 永不作为 literal CLI 值，`minimal`/`low` 只兼容解析且不得降低 batch-picked effort。 |
| U9 agent-native | CE 将 checklist/anti-patterns/success criteria 拆到 reference，并新增 review/checklists 路由。 | 当前主 skill 仍内联长 checklist。 | 以 reference index 为默认；只有现有 intake table 需要编号入口时才新增 route 14，避免为拆文件扩大 public route surface。 |
| U10 git-worktree | CE 用 `${CLAUDE_SKILL_DIR:-.}` 和 `allowed-tools` 修 Claude bundled script path。 | 当前 bare path 会失败；更关键是 `git-worktree` 没有 delivered internal runtime，adapter 也不会 rewrite internal skill self path。 | 不照搬 CE 单行 fallback；采用 `CLAUDE_SKILL_DIR` 分支 + 可被 adapter 改写的 source fallback，并让 sync/plan/inspect/doctor 使用同源 projection context。 |

## 测试同步规则

需要同步测试，但不同步 CE `tests/**` 目录本身。

每个保留实施单元必须有当前仓库风格的窄验证：

- 用 `spec-*`、`git-*` 当前命名，不保留 `ce-*` 断言。
- 使用现有 CommonJS/Jest `tests/unit/**` contract test 风格。
- 对 script 资产补 `bash -n` 和 fixture-level unit tests；涉及 GraphQL `--paginate --slurp` 时，必须模拟 slurp 后数组 shape，而不是只断言命令字符串。
- 对 prose/skill contract 补字符串和负向断言，尤其是 CE-only branding、stale CLI flags、runtime delivery、skill-tool deadlock 等风险。
- 对 artifact schema 字段迁移补 consumer inventory 和负向断言，避免旧字段残留。
- 对 source/runtime delivery、governance、frontmatter delivery 字段变化补 runtime capability / dual-host governance / smoke 级验证。
- 对 runtime projection rewrite 变化补 `sync` / `plan` / `inspect` / `doctor` 同源验证，避免 init 后立刻被 drift 检查误判。
- 不为未同步 source 能力迁入 CE 测试。

## 实施单元

### U1. 将会话历史改为编排器负责抽取

**目标：** 让 `spec-sessions` 负责 session discovery、filter/rank、scratch extraction 和 historian dispatch；`spec-session-historian` 只综合已抽取文件，禁止再调用 Skill tool。

**当前缺口：** 当前 `spec-sessions` 是薄 wrapper；historian 仍直接调用 `session-inventory` / `session-extract`；primitive skills 仍作为 agent-facing runtime skills 存在，形成 Claude Code/Codex 场景下的 subagent skill-tool deadlock 风险。

**设计决策：** 选择迁移并退役 primitive skill delivery。`discover-sessions.sh`、`extract-metadata.py`、`extract-skeleton.py`、`extract-errors.py` 迁入 `skills/spec-sessions/scripts/`，由 `spec-sessions` orchestrator 直接调用；`spec-session-inventory` / `spec-session-extract` 不再作为 internal runtime skills delivery。这样把确定性 extraction 留给脚本，把 session relevance 和 synthesis 留给 LLM/historian，并移除 subagent 依赖 Skill tool 的死锁面。

**修改范围：**

- `skills/spec-sessions/SKILL.md`
- `skills/spec-sessions/scripts/discover-sessions.sh`
- `skills/spec-sessions/scripts/extract-metadata.py`
- `skills/spec-sessions/scripts/extract-skeleton.py`
- `skills/spec-sessions/scripts/extract-errors.py`
- `agents/spec-session-historian.agent.md`
- `skills/spec-compound/SKILL.md`
- `skills/spec-session-inventory/**`，删除或迁移后清空 source ownership
- `skills/spec-session-extract/**`，删除或迁移后清空 source ownership
- `src/cli/plugin.js`
- `src/cli/contracts/dual-host-governance/skills-governance.json`
- `src/cli/instruction-bootstrap.js`
- `skills/using-spec-first/SKILL.md`，如仍提到 primitive internal skills
- `skills/spec-skill-audit/scripts/lint-skill-structure.js`，如仍内置 primitive name mapping
- `docs/catalog/runtime-capabilities.md`
- `README.md`
- `README.zh-CN.md`
- `tests/unit/spec-sessions-contracts.test.js`
- `tests/unit/session-history-scripts.test.js`
- `tests/unit/runtime-capability-catalog.test.js`
- `tests/unit/dual-host-governance-contracts.test.js`
- `tests/unit/using-spec-first-contracts.test.js`，如 bootstrap prose 改动
- `tests/unit/skill-audit-scripts.test.js`，如 lint mapping 改动
- `tests/smoke/cli.sh`

**必要行为：**

- `spec-sessions` 预解析 repo name 和 scan window。
- discovery 只覆盖 Claude Code 与 Codex。不要引入 Cursor、Gemini、Pi。
- 先按 branch/keyword 过滤再 extraction；`files_matched: 0` 时直接返回 no relevant prior sessions。
- scratch dir 用 OS temp；`extract-skeleton.py` / `extract-errors.py` 支持 `--output` 并输出 machine-readable status。
- historian input contract 只接收 `problem_topic`、`scratch_dir`、selected sessions 和 extracted file paths。
- historian 明确禁止 Skill tool、discovery、raw session extraction。
- `spec-compound` 的 session enrichment 调用 `spec-sessions`，不再直接 dispatch historian primitive flow。
- runtime asset set、dual-host governance、instruction bootstrap 和 smoke tests 不再把 `spec-session-inventory` / `spec-session-extract` 当作 delivered internal skills。
- 旧 primitive 名称只可作为 migration/compatibility prose 出现，不能作为新的 agent-facing runtime dependency。
- 删除 primitive source skill 目录时，必须同步删除 governance records；不能只把 delivery 改成 `none`，因为 governance validator 要求每条 record 指向存在的 bundled skill。
- 与 U10 同批更新 delivered internal surface：两个 session primitives 退出，`git-worktree` 进入。最终 agent-facing internal skill count 以同批变更后的 runtime catalog 为准，避免 README/catalog 反复抖动。
- 运行或等价执行 `npm run docs:runtime-catalog`，使 `docs/catalog/runtime-capabilities.md` 从当前 governance 和 source 重新派生。
- `README.md` / `README.zh-CN.md` 中 runtime capability 摘要必须与 catalog 计数一致。

**测试：**

- `tests/unit/spec-sessions-contracts.test.js`
- `tests/unit/session-history-scripts.test.js`
- `tests/unit/runtime-capability-catalog.test.js`
- `tests/unit/dual-host-governance-contracts.test.js`
- `tests/smoke/cli.sh`
- 如清理 `using-spec-first` 或 skill-audit 引用，同步更新对应 unit tests。
- stale cleanup 聚焦测试：构造旧 managed state 含 `spec-session-inventory` / `spec-session-extract`，断言 `planObsoleteManagedAssetRemoval()` 在 Claude 和 Codex 上会移除旧 runtime skill 目录。

**验证：**

```bash
npx jest tests/unit/spec-sessions-contracts.test.js tests/unit/session-history-scripts.test.js tests/unit/runtime-capability-catalog.test.js tests/unit/dual-host-governance-contracts.test.js --runInBand
npm run docs:runtime-catalog
npm run lint:skill-entrypoints
npm run test:smoke
```

### U2. 同步 PR 反馈分页与模式引用

**目标：** 修复 reviewThreads、comments、reviews 单页读取导致漏评论的问题，并把 full/targeted mode prose 从主 skill 拆到 references。

**当前缺口：** 当前 scripts 仍是单页 GraphQL connection；`SKILL.md` 仍内联 full/targeted 大段流程；targeted comment 查 parent thread 时超过第一页会漏。

**修改范围：**

- `skills/resolve-pr-feedback/SKILL.md`
- `skills/resolve-pr-feedback/references/full-mode.md`
- `skills/resolve-pr-feedback/references/targeted-mode.md`
- `skills/resolve-pr-feedback/scripts/get-pr-comments`
- `skills/resolve-pr-feedback/scripts/get-thread-for-comment`
- `tests/unit/resolve-pr-feedback-contracts.test.js`
- 新增 `tests/unit/resolve-pr-feedback-pagination.test.js` 或等价 fixture-level script test

**必要行为：**

- `get-pr-comments` 用独立 paginated queries 读取 review threads、issue comments、reviews。
- 使用 `gh api graphql --paginate --slurp`，再由 `jq` 合并稳定 JSON shape。
- `get-thread-for-comment` 对 `reviewThreads(first:100, after:$endCursor)` 分页。
- 保留 `isOutdated` 作为 relocation signal，不当作 resolution signal。
- 主 skill 负责 mode routing；脚本只负责事实抓取。
- 输出 JSON shape 必须兼容旧 consumer；分页实现不能把 `--slurp` 顶层数组泄漏给调用方。
- 两个脚本必须使用项目 shell 基线 `set -euo pipefail`；可选位置参数用 `${2:-}` / `${3:-}` 等形式读取，避免 strict mode 下 unbound variable。
- thread 内 comments 超过第一页时必须有明确策略：要么分页完整读取，要么选择 `comments(first: 100)` 时同时读取 `comments.pageInfo` 并在输出或错误中暴露 truncation/unsupported fact，让 LLM 不把缺失当作 confirmed absence。`get-thread-for-comment` 若目标 comment 未命中且存在截断 thread，不得报普通 "No thread found"。

**测试必须覆盖：**

- `reviewThreads` 两页合并。
- issue comments 两页合并。
- reviews 两页合并。
- thread 内 comments 超过第一页时的处理策略，包括未完整分页时的 truncation/unsupported 输出。
- `get-thread-for-comment` 的目标 comment 在第二页 thread 时仍能定位。
- `get-thread-for-comment` 在未命中但存在 truncated comments thread 时不输出 confirmed absence。
- `isOutdated` 保留为 relocation signal。
- slurp 后数组 shape 被归一成旧 consumer 兼容 JSON。
- strict-mode shell 语法和可选参数读取不触发 unbound variable。

**验证：**

```bash
npx jest tests/unit/resolve-pr-feedback-contracts.test.js tests/unit/resolve-pr-feedback-pagination.test.js --runInBand
bash -n skills/resolve-pr-feedback/scripts/get-pr-comments
bash -n skills/resolve-pr-feedback/scripts/get-thread-for-comment
```

### U3. 同步计划模板拆分与实施单元标题

**目标：** 把计划模板拆到 reference，把实施单元统一为 `### U1. [Name]` 标题，并让交接默认执行 headless doc-review。

**当前缺口：** 当前模板仍内联在 `skills/spec-plan/SKILL.md`；实施单元仍是列表项；交接已有 headless review 文字，但还缺 CE 的仅在存在 actionable findings 时才展示 deeper review 的完整约束。

**修改范围：**

- `skills/spec-plan/SKILL.md`
- `skills/spec-plan/references/plan-template.md`
- `skills/spec-plan/references/plan-handoff.md`
- `skills/spec-plan/references/deepening-workflow.md`，仅当 section references drift 时修改
- `tests/unit/spec-plan-contracts.test.js`
- `tests/unit/runtime-plan-contracts.test.js`，仅当 rendered runtime output 变化时修改

**必要行为：**

- 计划编写阶段读取 `references/plan-template.md`，不再在主 skill 内联完整模板。
- 生成的计划使用 `### U1. [Name]` 标题。
- 兼容 legacy `- U1. **[Name]**` 读取，避免旧计划失效。
- 交接默认运行 `spec-doc-review mode:headless <plan>`。
- 只有 actionable findings 时展示 deeper review 入口；仅 FYI 的内容不制造额外菜单。
- U3 不能在 U4 reader/parser contract 通过前单独视为完成；新 writer 格式和 review reader 必须作为一个兼容链路验证。

**联合验证场景：**

- 一个 fixture plan 使用 `### U1. [Name]`。
- `spec-code-review` 需求完整性检查能识别 Requirements 与 heading-style Implementation Units。
- legacy `- U1. **[Name]**` 旧计划仍可读取。

**验证：**

```bash
npx jest tests/unit/spec-plan-contracts.test.js tests/unit/spec-code-review-contracts.test.js tests/unit/runtime-plan-contracts.test.js --runInBand
```

### U4. 降低审查噪音并加固发现项表格

**目标：** 同步 CE review 降噪规则：文档类型分类、origin slot、plan-origin 抑制、视觉辅助保留、上一轮处理结果抑制，以及发现项表格中的字面管道符转义。

**当前缺口：** 当前 doc-review 已有 headless、decision primer、部分 requirements/plan/task-pack 识别，并已把 `Document type` 传入 subagent prompt；但尚未统一按内容形态分类并把 `Origin` slot 传入 persona prompt，persona 对 requirements / plan / task-pack 的审查重点仍不完整；code-review 尚未稳定识别 `### U1.` 实施单元标题；输出模板未明确要求转义字面 `|`。

**修改范围：**

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

**必要行为：**

- Orchestrator 基于内容形态分类 `requirements` / `plan` / `task-pack`，不只看路径。
- Reviewer prompt 接收 `Document type` 与 `Origin`。
- `origin:` plan 不常规重审 WHAT/WHY，除非 plan 引入新战略/架构风险。
- 上一轮 Apply/Skip/Defer/Acknowledge 处理过的内容不重复输出 findings。
- Diagram/visual aid 不因 redundancy 被建议删除；需要时更新不一致的图。
- Markdown 发现项表格中所有 cell 内的字面 `|` 必须转义。
- Walkthrough 常规菜单保留 `Auto-resolve with best judgment on the rest`，只有 advisory-only finding 才出现 Acknowledge 替代。
- Code review 的需求完整性检查同时读取 Requirements 和标题式实施单元。
- 规则分层：document classification、origin slot、finding presentation 和 walkthrough 归 shared template / synthesis；persona agent 只消费这些上下文字段并给出本 lens 的语义判断，避免把同一 markdown/分类规则复制进每个 persona。

**测试必须覆盖：**

- `Document type` 继续传入 reviewer prompt，并且 persona 文案按 requirements / plan / task-pack 区分审查重点。
- plan frontmatter `origin:` 被提取为 `Origin` slot 并进入 reviewer prompt。
- `origin:` plan 不常规重审 WHAT/WHY；只有 plan 自身引入新战略、架构风险或范围扩展时才允许相关 findings。
- Markdown findings table cell 内的字面 `|` 被转义，不破坏 pipe-delimited table。
- Diagram / visual aid 不因 redundancy 被建议删除；不一致时优先更新内容。
- 常规 walkthrough 菜单保留 `Auto-resolve with best judgment on the rest`；`Acknowledge` 只在 advisory-only 或缺少 `suggested_fix` 的 no-apply 场景出现。

**验证：**

```bash
npx jest tests/unit/spec-code-review-contracts.test.js tests/unit/spec-doc-review-contracts.test.js --runInBand
```

### U5. 同步 Ideate 主题轴与依据契约

**目标：** 给 `spec-ideate` 增加主题表面拆解、axis coverage/recovery、`basis` 术语和用户命名根目录 markdown 处理规则。

**当前缺口：** 当前 `spec-ideate` 仍使用 `warrant`；没有 Phase 1.5 topic axes；没有 axis gaps / recovery；没有 user-named root `.md` 作为 constraint 的明确规则。

**修改范围：**

- `skills/spec-ideate/SKILL.md`
- `skills/spec-ideate/references/post-ideation-workflow.md`
- `skills/spec-ideate/references/universal-ideation.md`
- `tests/unit/spec-ideate-contracts.test.js`

**必要行为：**

- Phase 1 后做主题表面拆解，产出有限 axes。
- Surprise-me mode 与 atomic subject 可跳过 decomposition。
- Axis recovery 最多 dispatch 2 个 recovery agents，不无限扩展。
- `warrant` 统一迁移为 `basis`，下游 artifact 和测试同步更新。
- User explicitly named root `.md` 文件作为 constraint 全量读取；其他 root markdown 仅作为 background。
- 不重新引入 `STRATEGY.md` 必读 anchor。
- 实施前做 consumer inventory：列出所有消费 per-idea output contract 的 source/references/tests，区分字段级 `warrant` 与普通英文 prose `warranted`。
- 字段级 `warrant` 不得残留；若保留普通 prose 用法，必须没有 schema 字段歧义，优先改写以降低误读。

**测试必须覆盖：**

- source/references/tests 不再出现字段级 `warrant`。
- per-idea artifact 使用 `basis`。
- axis gaps / recovery 有上限。
- user-named root markdown 被作为 constraint，全量读取规则不扩展到所有 root markdown。

**验证：**

```bash
npx jest tests/unit/spec-ideate-contracts.test.js --runInBand
```

### U6. 拆分 Compound Refresh 按 Action 执行流程

**目标：** 把 `spec-compound-refresh` 的 Phase 4 按 action 执行流程下沉到 `references/per-action-flows.md`，减少主 skill 上下文负担。

**当前缺口：** 当前主 skill 仍内联 Keep/Update/Consolidate/Replace/Delete 详细步骤；reference 文件不存在。

**修改范围：**

- `skills/spec-compound-refresh/SKILL.md`
- `skills/spec-compound-refresh/references/per-action-flows.md`
- `tests/unit/spec-compound-contracts.test.js`

**必要行为：**

- 主 skill 只说明 Phase 4 根据分类读取 reference 中对应 flow。
- Reference 保留五类流程的完整判断标准、示例和逐步步骤。
- 保留当前 spec-first 已有增强：`validate-frontmatter.py` 从 `skills/spec-compound-refresh/` 目录运行，并且校验通过前不得删除旧 learning。
- Delete flow 保留最终 inbound-link 检查。
- 主 skill 不再内联五个完整 flow heading；但必须有明确 reference index / routeability，让执行者知道按 action 读取 `references/per-action-flows.md` 的对应段落。

**测试必须覆盖：**

- 主 skill 不再内联 Keep/Update/Consolidate/Replace/Delete 五个完整 flow。
- `references/per-action-flows.md` 包含五类 flow。
- 主 skill Phase 4 能路由到该 reference。
- `validate-frontmatter.py` 与 inbound-link-before-delete 安全规则保留。

**验证：**

```bash
npx jest tests/unit/spec-compound-contracts.test.js --runInBand
```

### U7. 同步 Debug 分诊与假设约束

**目标：** 把 CE debug 的轻量快路径和更强假设纪律同步到 `spec-debug`。

**当前缺口：** 当前 `spec-debug` 没有 trivial-bug fast-path；假设不要求 grounding observation；失败修复后只说回 Phase 2，没有要求显式 invalidation。

**修改范围：**

- `skills/spec-debug/SKILL.md`
- `tests/unit/spec-debug-contracts.test.js`

**必要行为：**

- 明显单文件 typo、missing import、null deref、off-by-one 可走 trivial-bug fast-path。
- Fast path 仍必须经过 Phase 2 的 Fix it now / Diagnosis only choice gate。
- 编辑前仍运行 workspace/branch check。
- 每个假设至少包含一个 concrete observation，例如 runtime value、log、instrumented boundary、working comparison 或具体 code reference。
- Fix 失败后先明确 invalidated evidence，再形成新假设。
- 非 trivial bug 仍默认完整 investigation。
- Negative boundary：fast-path 只适用于链路已明确的小型问题，不能用于多文件因果链、架构回归、状态竞争、权限/环境问题或无法直接定位的失败。

**测试必须覆盖：**

- fast-path 仍保留 choice gate 与 branch check。
- 非 trivial bug 仍要求完整 investigation。
- hypothesis 必须带 concrete observation。
- failed fix 后必须先记录 invalidated evidence。

**验证：**

```bash
npx jest tests/unit/spec-debug-contracts.test.js --runInBand
```

### U8. 同步 Work-Beta Codex 参数与按批次推理强度

**目标：** 更新 `spec-work-beta` 的 Codex CLI 调用契约，避免过期 sandbox 参数，并按批次复杂度选择 reasoning effort。

**当前缺口：** 当前 yolo 已使用 `--dangerously-bypass-approvals-and-sandbox`，但 full-auto 仍写 `--full-auto`；consent 文案仍旧；`delegate_effort` 直接作为全局参数，没有按批次计算 `effective_effort`。

**修改范围：**

- `skills/spec-work-beta/SKILL.md`
- `skills/spec-work-beta/references/codex-delegation-workflow.md`
- `tests/unit/spec-work-beta-contracts.test.js`

**必要行为：**

- yolo mode 使用 `--dangerously-bypass-approvals-and-sandbox`。
- full-auto mode 使用 `-s workspace-write`，并说明 network 需由 Codex config 启用。
- `delegate_effort` 是 config floor，不直接传给 `codex exec`。
- 每个批次计算 `effective_effort`：`default | medium | high | xhigh`。
- `effective_effort=default` 时省略 `-c`；永不传 literal `"default"`。
- Config floor 只能抬高不能降低已选择的 effort。
- `work_delegate_effort=minimal|low` 仅作为历史/用户配置兼容输入解析；它们不得让 batch-picked effort 低于当前选择，也不得生成 `model_reasoning_effort="minimal"` 或 `"low"`。需要更低默认时交给 `~/.codex/config.toml`，本 workflow 不主动下调。
- 保留 beta opt-in、consent 和 `~/.codex/config.toml` default deferral。
- 更新现有旧断言，不能只新增 contract；当前断言 `If delegate_effort is set` 的旧行为必须迁移为 floor/effective effort 表达。

**测试必须覆盖：**

- `spec-work-beta` source/reference 不再出现 `--full-auto`。
- full-auto 映射为 `-s workspace-write`。
- yolo 映射为 `--dangerously-bypass-approvals-and-sandbox`。
- 不出现 literal `model_reasoning_effort="default"`。
- 不出现 direct `<delegate_effort>` passthrough 到 `codex exec`。
- `delegate_effort` 被描述为 config floor，只能 raise 不能 lower。
- 每个 batch 使用 `effective_effort`。
- `minimal` / `low` 配置不会作为 `model_reasoning_effort` literal 发给 `codex exec`。

**验证：**

```bash
npx jest tests/unit/spec-work-beta-contracts.test.js --runInBand
```

### U9. 瘦身 Agent-Native Architecture 主 Skill

**目标：** 把 `agent-native-architecture` 的 checklist、anti-patterns、success criteria 移到 reference，主 skill 只保留 overview、intake、routing 和 reference index。

**当前缺口：** 当前主 skill 仍内联 400+ 行长内容，`references/checklists.md` 不存在，tests 也仍断言主 skill 内联 checklist。

**修改范围：**

- `skills/agent-native-architecture/SKILL.md`
- `skills/agent-native-architecture/references/checklists.md`
- `tests/unit/agent-native-architecture-contracts.test.js`

**必要行为：**

- 保留当前 skill name `agent-native-architecture`，不引入 CE branding。
- 默认把 checklist 文件作为 reference index item，而不是新增 public entry surface；只有现有 intake routing table 必须枚举编号时，才新增 route 14：`review/checklists`。
- 若新增 route 14，必须说明消费场景：用户要求按架构 checklist 审查、或现有 route 将任务分流到 checklist-based review；不得为了文件拆分制造额外 route surface。
- `references/checklists.md` 包含 architecture checklist、anti-patterns、success criteria。
- 现有 references 保持可路由。
- 主 skill 不再内联 checklist 长内容，只保留 overview、intake、routing、reference index。
- Runtime transform 仍不得包含 `compound-engineering`。

**测试必须覆盖：**

- 主 skill 不再内联 checklist / anti-patterns / success criteria 长内容。
- `references/checklists.md` 包含 checklist、anti-patterns、success criteria。
- 主 skill 能路由或索引到该 reference。
- runtime transform 不含 `compound-engineering`。

**验证：**

```bash
npx jest tests/unit/agent-native-architecture-contracts.test.js --runInBand
```

### U10. 修复 Git Worktree Bundled Script 路径

**目标：** 让 `git-worktree` 作为真正交付的 dual-host internal helper，在 Claude Code、Codex 和本地开发 source 场景都能找到 bundled `scripts/worktree-manager.sh`。

**当前缺口：** 当前 docs/examples 使用 `bash scripts/worktree-manager.sh`。Claude Code runtime Bash cwd 是用户项目，不是 skill dir，bare relative path 会失败。更深一层，`git-worktree` 虽在 governance 里声明为 dual-host internal，但当前 filtered asset set 不交付它；即使交付，adapter 也只对 workflow skills 做 `skills/<skill>/...` path rewrite，internal skill 的 source path 不会被改成 runtime skill dir。

**设计决策：** 不使用 `${CLAUDE_SKILL_DIR}` 作为唯一机制，也不放弃它。采用“Claude skill dir 优先 + host-neutral fallback + adapter runtime rewrite”：Claude marketplace/global skill 优先使用 host 提供的 `CLAUDE_SKILL_DIR`；fallback 使用可被 adapter 精确改写的 source path。推荐 source 形态是显式两分支，而不是把 `skills/git-worktree` 塞进 `${VAR:-...}` 路径展开里：

```bash
if [ -n "${CLAUDE_SKILL_DIR:-}" ]; then
  bash "${CLAUDE_SKILL_DIR}/scripts/worktree-manager.sh" create <branch-name> [from-branch]
else
  (cd "$(git rev-parse --show-toplevel)" && bash skills/git-worktree/scripts/worktree-manager.sh create <branch-name> [from-branch])
fi
```

这让本地源码 fallback 继续指向 source `skills/git-worktree/`，同时让 adapter 能把 `bash skills/git-worktree/scripts/...` 改写成当前 host 的 runtime skill dir。若实现者坚持单行参数展开，例如 `${CLAUDE_SKILL_DIR:-$(git rev-parse --show-toplevel)/skills/git-worktree}/...`，必须同步扩展 rewrite 正则并用 exact-string regression 证明该形态会被正确改写；不能只凭 prose 断言 rewrite 会发生。

**修改范围：**

- `skills/git-worktree/SKILL.md`
- `src/cli/plugin.js`
- `src/cli/adapters/claude.js`
- `src/cli/adapters/codex.js`
- `src/cli/commands/doctor.js` 或 `src/cli` drift/inspect 消费链路，仅当同源 projection context 需要贯通到 doctor 输出时修改
- `src/cli/contracts/dual-host-governance/skills-governance.json`，仅在 delivery semantics 需要更准确注释或 record 调整时修改
- `docs/catalog/runtime-capabilities.md`
- `README.md`
- `README.zh-CN.md`
- `tests/unit/runtime-capability-catalog.test.js`
- `tests/unit/dual-host-governance-contracts.test.js`
- 新增聚焦测试，例如 `tests/unit/git-worktree-contracts.test.js`
- `tests/smoke/cli.sh`

**必要行为：**

- 将 `AGENT_FACING_INTERNAL_SKILLS` 改名或重构为语义更准确的 delivered internal allowlist，例如 `DELIVERED_INTERNAL_SKILLS`，并加入 `git-worktree`。
- adapter path rewrite 不再只服务 workflow skills；`syncSkills()` / `planSkillsSync()` 应把实际 target dir 作为 `runtimeSkillRoot` 传给 adapter，让 standalone/internal/workflow 都可按同一规则 rewrite 当前 skill 自己的 `skills/<skillName>/...` source path。
- `inspectSkills()` / `inspectSkillIntegrity()` / doctor 间接调用的 expected-content 渲染必须使用与 `syncSkills()`、`planSkillsSync()` 相同的 `runtimeSkillRoot` 计算。否则 `spec-first init` 刚写出的 `git-worktree` runtime 会因为 expected content 没有同样 rewrite 而被误报 `content_mismatch`。
- `git-worktree` source 命令使用“`CLAUDE_SKILL_DIR` 分支 + `cd "$(git rev-parse --show-toplevel)" && bash skills/git-worktree/scripts/worktree-manager.sh ...` fallback”的推荐形态，或使用经过 exact rewrite regression 证明的等价实现。adapter 只 rewrite fallback 中的 `skills/git-worktree/`，runtime 中分别得到 `.claude/skills/git-worktree/` 或 `.agents/skills/git-worktree/` fallback。
- Examples 和 Integration section 同步更新。
- 当前 source 已有 `allowed-tools` 用法，因此 `git-worktree` 必须加窄 Bash allow pattern，例如 `Bash(bash *worktree-manager.sh*)` 或项目 frontmatter/generator 支持的等价最窄形式。
- 不允许把 allow pattern 退化成 `Bash(bash *)`。
- 不改 `scripts/worktree-manager.sh`，当前脚本自身已按 main worktree root 解析。
- `git-worktree` 进入 delivered internal runtime 后，catalog/README 的 agent-facing internal skill count 必须与 U1 同批后的结果一致。

**测试必须覆盖：**

- 不再出现 bare `bash scripts/worktree-manager.sh`。
- Creating / Examples / Integration 都使用 `CLAUDE_SKILL_DIR` 优先、repo-root `skills/git-worktree/` fallback 的 source path，或其经过 adapter rewrite 后的 host runtime fallback path。
- exact rewrite regression：把 `SKILL.md` 中实际出现的 git-worktree 命令片段交给 Claude/Codex adapter，断言 source fallback `bash skills/git-worktree/scripts/worktree-manager.sh` 会被改写为 host runtime path；同时断言不会残留不可改写形态，例如 `/skills/git-worktree}` 或其他被参数展开包住、当前 regex 无法命中的 path segment。
- Claude planned runtime 包含 `.claude/skills/git-worktree/scripts/worktree-manager.sh`。
- Codex planned runtime 包含 `.agents/skills/git-worktree/scripts/worktree-manager.sh`。
- `buildFilteredAssetSet('claude')` 与 `buildFilteredAssetSet('codex')` 的 `internalSkills` 包含 `git-worktree`。
- `allowed-tools` 存在且不退化成宽泛 Bash allow。
- `syncBundledAssets()` 后立即 `inspectInstalledAssets()`，Claude/Codex 均不出现 `git-worktree` drift；必要时再覆盖 `spec-first doctor --claude|--codex --json` 的 runtime asset health。
- adapter regression：既有 workflow skill 的 self path rewrite 保持不变；非目标 standalone/internal skill 不被错误 rewrite；`using-spec-first` 这类双宿主安装说明不产生 path rewrite drift；Codex 的 shared path rewrite 与 skill-name rewrite 顺序不被破坏。
- runtime command 可执行 fixture：在临时 git repo 内生成 Claude/Codex runtime 后，分别验证 fallback path 和 `CLAUDE_SKILL_DIR` path 能执行 `worktree-manager.sh --help`，证明命令字符串、adapter rewrite、shell quoting 与 runtime copy 闭环成立。该 fixture 只跑 help/usage，不创建 worktree。

**验证：**

```bash
npx jest tests/unit/git-worktree-contracts.test.js tests/unit/runtime-capability-catalog.test.js tests/unit/dual-host-governance-contracts.test.js --runInBand
npm run docs:runtime-catalog
npm run lint:skill-entrypoints
npm run test:smoke
```

## 实施顺序

按批次和依赖顺序落地；下列是执行批次，不重新编号 implementation units：

1. U1/U10 shared runtime foundation：重命名或重构 delivered internal allowlist，支持 internal/standalone/workflow 共用 `runtimeSkillRoot` path rewrite，并贯通 `sync` / `plan` / `inspect` / `doctor` expected-content 渲染，补 stale cleanup、planned runtime 与 no-drift tests。
2. U1 sessions migration：迁移 session scripts，退役 `spec-session-inventory` / `spec-session-extract` source/governance/runtime delivery，更新 catalog/README/smoke。
3. U10 git-worktree delivery：交付 `git-worktree` internal skill，更新 skill prose、script path、allowed-tools、catalog/README/smoke。
4. U2 PR feedback 分页。
5. U3 plan 标题与模板。
6. U4 review contract 更新，并完成 U3/U4 writer-reader 联合验证。
7. U8 work-beta Codex 参数。
8. U7 debug 约束。
9. U5 ideate basis/axes。
10. U6 compound-refresh reference 拆分。
11. U9 agent-native reference 拆分。

U1 与 U10 的前三个批次应尽量同一个 PR/commit group 落地：U1 会移除两个 delivered internal primitives，U10 会新增一个 delivered internal helper；合批能避免 catalog/README 计数多次漂移，并一次性验证 stale cleanup 与 fresh install。U3 先于 U4，因为 code-review 需要识别新的实施单元标题；但 U3 不能在 U4 reader/parser contract 通过前单独视为完成。U1/U10、U8 是 runtime 可用性或 deadlock 风险，优先级高于纯 prose 瘦身。每个单元都必须先更新或新增聚焦测试，再改 source。

## 逐步执行检查清单

每个批次按同一节奏执行：

1. 读取当前 source 与 CE 对应 source，只把 CE 行为翻译成 `spec-*` / 当前宿主边界，不整文件覆盖。
2. 先写或更新最窄 contract test，包含正向、负向和 stale regression；确认测试在当前 source 下能暴露缺口。
3. 修改 source-of-truth 文件；不手改 `.claude/`、`.codex/`、`.agents/skills/`。
4. 运行该批次的聚焦测试与 `git diff --check`；涉及脚本时补 `bash -n`，涉及 runtime projection 时补 dry-run / inspect no-drift。
5. 更新 `CHANGELOG.md`；用户可见 runtime/README/catalog 变化标注 `(user-visible)`。
6. 进入下一批次前复查 diff，确认没有 CE-only branding、无关 refactor、generated runtime patch 或旧字段残留。

U1/U10 shared runtime foundation 的具体顺序：

1. 先补 runtime capability / governance / path rewrite / inspect no-drift tests，冻结当前缺口。
2. 重构 delivered internal allowlist 和 adapter transform context，让实际 runtime target dir 成为 path rewrite 输入。
3. 贯通 `syncSkills()`、`planSkillsSync()`、`inspectSkills()`、`inspectSkillIntegrity()` 和 doctor 消费链路，保证写入与预期内容同源。
4. 再分别迁移 U1 session scripts、退役 primitives，并交付 U10 `git-worktree`；最后统一生成 catalog/README 计数。

## 最终验证

每个单元运行对应聚焦测试。全部完成后再运行：

```bash
git diff --check
npm run test:unit
npm run test:smoke
npm run typecheck
npm run lint:skill-entrypoints
```

当改动触及 `skills/**/SKILL.md`、`skills/**/references/**` 且这些内容会被 runtime sync，至少运行对应 source contract tests。若改动触及 `src/cli/plugin.js`、`src/cli/contracts/dual-host-governance/**`、`src/cli/instruction-bootstrap.js`、host entry docs、或 skill frontmatter delivery 字段，则在 source tests 通过后先 preview：

```bash
spec-first init --claude --dry-run
spec-first init --codex --dry-run
```

审查 dry-run planned operations 后，再运行真实 projection：

```bash
spec-first init --claude
spec-first init --codex
```

U1 和 U10 预计会触发 runtime projection 验证。运行后必须审查 `CLAUDE.md`、`AGENTS.md` 和 generated runtime diffs，确认它们来自 source/generator，而不是手写 runtime patch；随后运行或等价覆盖 `doctor --json` / `inspectInstalledAssets()` no-drift 检查，确认刚生成的 runtime 不会被自身 drift 检查误判。

U1/U10 的 runtime surface 批次还必须证明两类路径：

- fresh install：新 `spec-first init --claude|--codex` 不再生成 session primitive runtime skills，并生成 `git-worktree` internal skill。
- stale upgrade：旧 managed state 中已记录的 `spec-session-inventory` / `spec-session-extract` 会经 `planObsoleteManagedAssetRemoval()` 清理，而不是残留在用户 runtime。

## 变更记录

本计划文档及本轮审查修订均需追加 `CHANGELOG.md` 记录。后续实施每批 source 变更仍必须追加独立 changelog 行，作者使用当前 Codex developer profile `leokuang`。

## 来源

- 同步方法论：`docs/solutions/architecture-patterns/upstream-ce-sync-upgrade-methodology-2026-04-26.md`
- 角色基线：`docs/10-prompt/结构化项目角色契约.md`
- 综合审查文档：`docs/validation/2026-05-09-sync-ce-834ca4e5-workflow-updates-plan-doc-review.md`
- 用户补充审查报告：本轮对 U1-U10 的逐单元源码核对与修订建议
- CE 仓库：`/Users/kuang/xiaobu/compound-engineering-plugin`
- CE range：`06a7cee0..834ca4e5`
- 本次审查的方案：`docs/plans/2026-05-09-004-sync-ce-834ca4e5-workflow-updates-plan.md`
