# skills / agents 目录收敛审查执行计划

> **给 Claude：** 执行本计划时，必须逐任务推进，不要跳步，不要把源码层问题和运行态适配问题混在一起处理。

**目标：** 对 `skills/` 与 `agents/` 目录下全部 canonical 资产做一次完整收敛审查，确保当前 `spec-first` 主流程、自定义辅助技能、历史 `ce:*` 遗留内容、agent 调用链、附属脚本与引用资料都能和当前 `/spec:*` 入口模型保持一致，并为后续多平台适配保留 canonical source 结构。

**架构原则：** `skills/` 与 `agents/` 都是 canonical source 层，不直接按 Claude 当前运行态去污染源码。审查顺序按依赖和风险推进：先看 5 个核心 `spec-*` workflow，再看 legacy/orchestration，再看 helper，再看 specialist/domain，最后逐组审查 `agents/`。每一批都要把“应该改源码的东西”和“未来应该交给 adapter 处理的东西”分开记录。

**技术栈：** Markdown skills、shell 脚本、JSON/YAML schema、Node.js CLI（`src/cli/*`）、`rg`、`npm test`

---

### 任务 1：锁定审查范围

**文件：**
- 修改：`docs/plans/2026-03-29-skills-convergence-audit.md`
- 审查：`skills/*/SKILL.md`
- 审查：`skills/**/references/*`
- 审查：`skills/**/scripts/*`
- 审查：`skills/**/assets/*`
- 审查：`skills/**/templates/*`
- 审查：`agents/**/*.md`

**步骤 1：锁定 41 个主 skill 文件**

本轮必须覆盖以下全部入口文件：

- `skills/agent-browser/SKILL.md`
- `skills/agent-native-architecture/SKILL.md`
- `skills/agent-native-audit/SKILL.md`
- `skills/andrew-kane-gem-writer/SKILL.md`
- `skills/ce-compound-refresh/SKILL.md`
- `skills/ce-ideate/SKILL.md`
- `skills/ce-work-beta/SKILL.md`
- `skills/changelog/SKILL.md`
- `skills/claude-permissions-optimizer/SKILL.md`
- `skills/deploy-docs/SKILL.md`
- `skills/dhh-rails-style/SKILL.md`
- `skills/document-review/SKILL.md`
- `skills/dspy-ruby/SKILL.md`
- `skills/every-style-editor/SKILL.md`
- `skills/feature-video/SKILL.md`
- `skills/frontend-design/SKILL.md`
- `skills/gemini-imagegen/SKILL.md`
- `skills/git-clean-gone-branches/SKILL.md`
- `skills/git-commit/SKILL.md`
- `skills/git-commit-push-pr/SKILL.md`
- `skills/git-worktree/SKILL.md`
- `skills/lfg/SKILL.md`
- `skills/onboarding/SKILL.md`
- `skills/orchestrating-swarms/SKILL.md`
- `skills/proof/SKILL.md`
- `skills/rclone/SKILL.md`
- `skills/report-bug-ce/SKILL.md`
- `skills/reproduce-bug/SKILL.md`
- `skills/resolve-pr-feedback/SKILL.md`
- `skills/setup/SKILL.md`
- `skills/slfg/SKILL.md`
- `skills/spec-brainstorm/SKILL.md`
- `skills/spec-compound/SKILL.md`
- `skills/spec-plan/SKILL.md`
- `skills/spec-review/SKILL.md`
- `skills/spec-work/SKILL.md`
- `skills/test-browser/SKILL.md`
- `skills/test-xcode/SKILL.md`
- `skills/todo-create/SKILL.md`
- `skills/todo-resolve/SKILL.md`
- `skills/todo-triage/SKILL.md`

**步骤 2：锁定所有附属资源**

主 skill 审查时，必须连带检查这些附属文件：

- `skills/**/references/*`
- `skills/**/scripts/*`
- `skills/**/assets/*`
- `skills/**/templates/*`

**步骤 3：锁定全部 agent 文件**

本轮还必须覆盖以下 47 个 agent 文件，按 6 个分组审查：

- `agents/design/design-implementation-reviewer.md`
- `agents/design/design-iterator.md`
- `agents/design/figma-design-sync.md`
- `agents/docs/ankane-readme-writer.md`
- `agents/document-review/adversarial-document-reviewer.md`
- `agents/document-review/coherence-reviewer.md`
- `agents/document-review/design-lens-reviewer.md`
- `agents/document-review/feasibility-reviewer.md`
- `agents/document-review/product-lens-reviewer.md`
- `agents/document-review/scope-guardian-reviewer.md`
- `agents/document-review/security-lens-reviewer.md`
- `agents/research/best-practices-researcher.md`
- `agents/research/framework-docs-researcher.md`
- `agents/research/git-history-analyzer.md`
- `agents/research/issue-intelligence-analyst.md`
- `agents/research/learnings-researcher.md`
- `agents/research/repo-research-analyst.md`
- `agents/review/adversarial-reviewer.md`
- `agents/review/agent-native-reviewer.md`
- `agents/review/api-contract-reviewer.md`
- `agents/review/architecture-strategist.md`
- `agents/review/cli-agent-readiness-reviewer.md`
- `agents/review/code-simplicity-reviewer.md`
- `agents/review/correctness-reviewer.md`
- `agents/review/data-integrity-guardian.md`
- `agents/review/data-migration-expert.md`
- `agents/review/data-migrations-reviewer.md`
- `agents/review/deployment-verification-agent.md`
- `agents/review/dhh-rails-reviewer.md`
- `agents/review/julik-frontend-races-reviewer.md`
- `agents/review/kieran-python-reviewer.md`
- `agents/review/kieran-rails-reviewer.md`
- `agents/review/kieran-typescript-reviewer.md`
- `agents/review/maintainability-reviewer.md`
- `agents/review/pattern-recognition-specialist.md`
- `agents/review/performance-oracle.md`
- `agents/review/performance-reviewer.md`
- `agents/review/project-standards-reviewer.md`
- `agents/review/reliability-reviewer.md`
- `agents/review/schema-drift-detector.md`
- `agents/review/security-reviewer.md`
- `agents/review/security-sentinel.md`
- `agents/review/testing-reviewer.md`
- `agents/workflow/bug-reproduction-validator.md`
- `agents/workflow/lint.md`
- `agents/workflow/pr-comment-resolver.md`
- `agents/workflow/spec-flow-analyzer.md`

**步骤 4：确认 inventory**

运行：
```bash
find skills -maxdepth 2 -name 'SKILL.md' | sort
find skills -mindepth 2 \( -path '*/scripts/*' -o -path '*/references/*' -o -path '*/assets/*' -o -path '*/templates/*' \) | sort
find agents -maxdepth 2 -type f | sort
```

预期：看到 41 个 `SKILL.md`、全部附属资源文件，以及 47 个 agent 文件。

### 任务 2：统一审查维度

**文件：**
- 审查：`skills/*/SKILL.md`
- 审查：`src/cli/plugin.js`
- 审查：`.claude-plugin/plugin.json`

**步骤 1：每个 skill 都按同一套维度审查**

每个 skill 至少回答以下问题：

1. 身份是否正确  
   - `name:` 是否仍然合理？
   - `description:` 是否符合当前产品口径？

2. 工作流命名是否过时  
   - 是否还残留 `ce:*`？
   - 是否还在引用已退场的旧入口？

3. agent 调用是否合理  
   - 是否存在 `spec-first:<group>:<agent>`？
   - 这是 canonical source 合理保留，还是误把运行态假设写进了源码？

4. skill 之间的引用是否正确  
   - 引用的 skill 是否仍存在？
   - 当前用户应该运行的入口是否还是它写的那个命令？

5. 输入输出和产物路径是否正确  
   - 是否仍引用当前正确的产物路径，例如：
     - `docs/brainstorms/`
     - `docs/plans/`
     - `docs/solutions/`
     - `.claude/commands/spec/`
     - `.claude/skills/`
     - `.claude/agents/`
   - 是否还残留 `.claude/tasks/`、`task.yaml` 之类旧模型？

6. 运行态假设是否越界  
   - 是否假设了当前代码还没实现的 plugin namespace？
   - 是否错误依赖运行态生成物而不是源码约定？

7. 附属资源是否一致  
   - scripts、references、assets、templates 是否都还存在？
   - 文件名、路径、schema 是否和正文一致？

8. agent 调用映射是否清晰
   - 当前 skill 调用了哪些 agent？
   - 调用形式是否和当前 canonical 命名约定一致？
   - 哪些问题要留到后续 agent 审查阶段再判断，而不是在 skill 审查阶段提前下结论？

**步骤 2：对照当前生成器实现**

运行：
```bash
sed -n '1,240p' src/cli/plugin.js
sed -n '1,240p' .claude-plugin/plugin.json
```

预期：后续审查结论能明确区分“源码层”和“生成后的运行态层”。

**步骤 3：对照 skills -> agents 调用链**

运行：
```bash
rg -n "spec-first:[a-z-]+:[a-z-]+" skills
find agents -maxdepth 2 -type f | sort
```

预期：后续 agent 审查可以明确知道哪些 agent 已被 skill 引用，哪些还只是资产存在但未接入主链路。

### 任务 3：先审 5 个核心 Spec-First workflow

**文件：**
- 审查：`skills/spec-brainstorm/SKILL.md`
- 审查：`skills/spec-plan/SKILL.md`
- 审查：`skills/spec-work/SKILL.md`
- 审查：`skills/spec-review/SKILL.md`
- 审查：`skills/spec-compound/SKILL.md`
- 审查：`skills/spec-review/references/*`
- 审查：`skills/spec-compound/references/*`
- 审查：`skills/spec-compound/assets/*`

**步骤 1：先检查公开流程是否一致**

重点确认：

- 当前对外主入口是不是都已经统一到 `/spec:*`
- 这些核心 workflow 中残留的 `ce:*` 是历史说明、内部兼容，还是实际错误
- 五阶段 handoff 是否一致：
  - `brainstorm -> plan`
  - `plan -> work`
  - `work -> review`
  - `review -> compound`

**步骤 2：检查产物约定**

重点确认这些 skill 的输入输出路径是否符合当前设计：

- `docs/brainstorms/*.md`
- `docs/plans/*.md`
- `docs/solutions/*.md`
- 只有真正需要时才提到 `.claude/*`

**步骤 3：检查 agent / reviewer 引用**

对每个 `spec-first:*` 引用做分类：

- canonical source 应保留
- 未来应该交给 adapter 做运行态转换
- 纯历史残留应直接收敛

**步骤 4：运行定向扫描**

运行：
```bash
rg -n "ce:[a-z-]+" skills/spec-*
rg -n "spec-first:[a-z-]+:[a-z-]+" skills/spec-*
```

预期：得到核心 5 个 workflow 的完整问题清单。

### 任务 4：审查 legacy 和 orchestration 技能

**文件：**
- 审查：`skills/ce-ideate/SKILL.md`
- 审查：`skills/ce-work-beta/SKILL.md`
- 审查：`skills/ce-compound-refresh/SKILL.md`
- 审查：`skills/lfg/SKILL.md`
- 审查：`skills/slfg/SKILL.md`
- 审查：`skills/orchestrating-swarms/SKILL.md`
- 审查：`skills/setup/SKILL.md`
- 审查：`skills/todo-create/SKILL.md`
- 审查：`skills/todo-resolve/SKILL.md`
- 审查：`skills/todo-triage/SKILL.md`
- 审查：`skills/document-review/SKILL.md`

**步骤 1：给每个 skill 定位**

每个文件都要归到以下之一：

- 当前仍是有效内部能力
- 保留但标记为 legacy / compatibility
- 后续应从运行态移除
- 仅保留为源码资产，不对外暴露

**步骤 2：检查它和当前 `/spec:*` 主链路的关系**

重点看：

- 哪些 `ce:*` 还被当前 `spec:*` 流程显式依赖
- 哪些 orchestrator 还强依赖旧入口
- 哪些 todo / review / document-review 仍是当前主链路的一部分

**步骤 3：检查附属资源**

重点检查：

- `skills/ce-compound-refresh/references/*`
- `skills/ce-compound-refresh/assets/*`
- `skills/document-review/references/*`
- `skills/todo-create/assets/*`

**步骤 4：运行定向扫描**

运行：
```bash
rg -n "ce:[a-z-]+" skills/{ce-ideate,ce-work-beta,ce-compound-refresh,lfg,slfg,orchestrating-swarms,setup,todo-create,todo-resolve,todo-triage,document-review}/
rg -n "spec-first:[a-z-]+:[a-z-]+" skills/{ce-ideate,document-review,orchestrating-swarms,todo-resolve,setup}/
```

预期：把 legacy/orchestration 相关 skill 的定位全部定清楚。

### 任务 5：审查 operational/helper 技能

**文件：**
- 审查：`skills/git-worktree/SKILL.md`
- 审查：`skills/git-clean-gone-branches/SKILL.md`
- 审查：`skills/git-commit/SKILL.md`
- 审查：`skills/git-commit-push-pr/SKILL.md`
- 审查：`skills/onboarding/SKILL.md`
- 审查：`skills/proof/SKILL.md`
- 审查：`skills/report-bug-ce/SKILL.md`
- 审查：`skills/reproduce-bug/SKILL.md`
- 审查：`skills/resolve-pr-feedback/SKILL.md`
- 审查：`skills/rclone/SKILL.md`
- 审查：`skills/changelog/SKILL.md`
- 审查：`skills/deploy-docs/SKILL.md`
- 审查：`skills/claude-permissions-optimizer/SKILL.md`

**步骤 1：检查它们对主流程的引用**

这些 skill 很容易遗留旧命名，重点看：

- 是否还在指导用户运行旧的 `ce:*`
- 是否还在引用过时的 review/work/task 模型
- 是否对当前 `spec:*` 用户路径给出错误指导

**步骤 2：检查脚本是否和正文一致**

重点对照：

- `skills/git-worktree/scripts/worktree-manager.sh`
- `skills/git-clean-gone-branches/scripts/clean-gone`
- `skills/onboarding/scripts/inventory.mjs`
- `skills/resolve-pr-feedback/scripts/*`
- `skills/rclone/scripts/check_setup.sh`
- `skills/claude-permissions-optimizer/scripts/*`

**步骤 3：运行定向扫描**

运行：
```bash
rg -n "ce:[a-z-]+" skills/{git-worktree,git-clean-gone-branches,git-commit,git-commit-push-pr,onboarding,proof,report-bug-ce,reproduce-bug,resolve-pr-feedback,rclone,changelog,deploy-docs,claude-permissions-optimizer}/
rg -n "spec-first:[a-z-]+:[a-z-]+" skills/{resolve-pr-feedback,proof,report-bug-ce,reproduce-bug}/
```

预期：helper 层全部明确归位，不再成为主链路漂移源。

### 任务 6：审查 specialist/domain 技能

**文件：**
- 审查：`skills/agent-browser/SKILL.md`
- 审查：`skills/agent-native-architecture/SKILL.md`
- 审查：`skills/agent-native-audit/SKILL.md`
- 审查：`skills/andrew-kane-gem-writer/SKILL.md`
- 审查：`skills/dhh-rails-style/SKILL.md`
- 审查：`skills/dspy-ruby/SKILL.md`
- 审查：`skills/every-style-editor/SKILL.md`
- 审查：`skills/feature-video/SKILL.md`
- 审查：`skills/frontend-design/SKILL.md`
- 审查：`skills/gemini-imagegen/SKILL.md`
- 审查：`skills/test-browser/SKILL.md`
- 审查：`skills/test-xcode/SKILL.md`

**步骤 1：检查这些 skill 是否保持平台中立**

重点确认：

- 它们是 canonical multi-platform source，还是已经掺了 Claude-only 假设
- 是否意外依赖旧的 `ce:*` 命名
- 是否对当前 `spec-first` 运行模型做了错误假设

**步骤 2：附带审查 references / assets / templates / scripts**

至少覆盖：

- `skills/agent-browser/references/*`
- `skills/agent-browser/templates/*`
- `skills/agent-native-architecture/references/*`
- `skills/andrew-kane-gem-writer/references/*`
- `skills/dhh-rails-style/references/*`
- `skills/dspy-ruby/references/*`
- `skills/dspy-ruby/assets/*`
- `skills/gemini-imagegen/scripts/*`

**步骤 3：运行定向扫描**

运行：
```bash
rg -n "ce:[a-z-]+" skills/{agent-browser,agent-native-architecture,agent-native-audit,andrew-kane-gem-writer,dhh-rails-style,dspy-ruby,every-style-editor,feature-video,frontend-design,gemini-imagegen,test-browser,test-xcode}/
rg -n "spec-first:[a-z-]+:[a-z-]+" skills/{frontend-design,test-browser,test-xcode}/
```

预期：specialist/domain 层的问题被单独归档，不和主 workflow 混在一起。

### 任务 7：形成 skills / agents 收敛矩阵

**文件：**
- 新增：`docs/06-待办事项/03-skills-agents收敛矩阵.md`
- 审查：前面所有批次的结果

**步骤 1：每个 skill 一行**

矩阵至少记录：

- 当前状态：current / legacy / internal / deprecate
- 是否和公开入口直接相关：direct / indirect / none
- 是否残留 `ce:*`
- 是否含 canonical `spec-first:*`
- 是否依赖运行态 adapter
- 是否有附属脚本/模板/引用需要后续处理

**步骤 2：为 agents 增加并行矩阵**

新增一份 agent 视角字段，至少记录：

- 分组：`design` / `docs` / `document-review` / `research` / `review` / `workflow`
- 当前状态：current / legacy / internal / deprecate
- 是否被当前 skill 实际引用
- 引用形式是否统一
- 是否需要运行态 adapter 支持
- 是否存在重叠或可合并 agent

**步骤 3：按优先级分类**

分成：

- P0：会直接破坏当前 `/spec:*` 主链路
- P1：会造成错误提示、错误 guidance 或运行态歧义
- P2：历史残留、低风险措辞、文档债务

**步骤 4：用全量扫描兜底**

运行：
```bash
rg -n "ce:[a-z-]+" skills
rg -n "spec-first:[a-z-]+:[a-z-]+" skills
```

再运行：
```bash
find agents -maxdepth 2 -type f | sort
```

预期：每一条命中、每一个 agent 文件，都能在矩阵里找到归属和处理策略。

### 任务 8：逐组审查 agents

**文件：**
- 审查：`agents/design/*.md`
- 审查：`agents/docs/*.md`
- 审查：`agents/document-review/*.md`
- 审查：`agents/research/*.md`
- 审查：`agents/review/*.md`
- 审查：`agents/workflow/*.md`

**步骤 1：先审 research / workflow**

这两组优先，因为它们直接支撑当前 `spec-plan`、`resolve-pr-feedback`、`todo-resolve` 等主链路。

重点检查：

- `agents/research/*.md`
- `agents/workflow/*.md`

核对它们是否和 skill 里的调用名、职责描述、输入输出一致。

**步骤 2：再审 review / document-review**

这两组次优先，因为它们直接影响 `spec-review` 和 `document-review` 的 reviewer 组合。

重点检查：

- 同组 agent 是否职责重叠
- 名称是否和 `skills/spec-review/SKILL.md`、`skills/document-review/SKILL.md` 的表格与列表一致
- 是否还保留旧命名、旧 persona、旧工具链假设

**步骤 3：最后审 design / docs**

这两组对当前主流程影响较小，但仍要确认：

- 是否被当前 skill 正确引用
- 是否因为历史二开保留了过时描述

**步骤 4：运行定向扫描**

运行：
```bash
rg -n "spec-first:[a-z-]+:[a-z-]+" skills
find agents -maxdepth 2 -type f | sort
```

预期：

- `skills` 中出现的 agent type 都能在 `agents/` 里找到对应文件
- `agents/` 中的每个文件都能被归类为“已接入 / 待接入 / 历史残留”
- 不依赖名称片段匹配，确保 `ankane-readme-writer`、`performance-oracle`、`security-sentinel`、`data-integrity-guardian`、`data-migration-expert`、`pattern-recognition-specialist`、`schema-drift-detector` 这类文件不会漏掉

### 任务 9：规划回归验证

**文件：**
- 审查：`tests/smoke/cli.sh`
- 审查：`src/cli/plugin.js`

**步骤 1：为后续收敛补测试目标**

后续修复完成后，至少要验证：

- 生成后的 `.claude/commands/spec/*.md` 仍正常存在
- 生成后的 `.claude/skills/` 仍包含当前应保留的 workflow
- 如果后续加了 adapter，生成后的 skill 不再残留当前不支持的运行态 agent type
- 核心 `spec-*` skill 中不再保留不该出现的 `ce:*` 公共 guidance

**步骤 2：保留当前基线**

运行：
```bash
npm test
```

预期：在开始实际收敛前，先确认当前基线是绿的。

---

执行顺序建议：

1. 先做任务 3  
   先清 5 个核心 `spec-*` workflow，因为它们直接影响 `/spec:*`

2. 再做任务 4  
   把 legacy/orchestration 层和主流程的关系理顺

3. 再做任务 5  
   清 helper 技能的旧命名和旧 guidance

4. 最后做任务 6  
   specialist/domain 层放最后，不让它们阻塞主链路

5. 再做任务 8  
   逐组审查 agents，补齐 skills -> agents 调用链和 agent 自身职责判断

6. 再做任务 7  
   基于前面已经完成的 skills 与 agents 审查结果，输出收敛矩阵

7. 最后做任务 9  
   把所有结果沉淀成测试补强点

计划已保存到 `docs/plans/2026-03-29-skills-convergence-audit.md`。如果继续执行，建议先从 `skills/spec-plan/SKILL.md` 开始。 
