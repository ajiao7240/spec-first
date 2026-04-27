---
title: 同步 CE 4b5f28da workflow 更新到 spec-first 技术方案
date: 2026-04-27
status: active
type: plan
source: ce-sync
ce_range: e8c118e2..4b5f28da
ce_head: 4b5f28da9746aae8f2c5dd715d7029d0ab2758a6
---

# 同步 CE 4b5f28da workflow 更新到 spec-first 技术方案

## 背景

用户提供的 CE 更新输出为 `Updating e8c118e2..4b5f28da`，包含 18 个文件变化：17 个非测试文件修改、1 个新增测试文件。按 `docs/solutions/architecture-patterns/upstream-ce-sync-upgrade-methodology-2026-04-26.md`，本计划只定义同步技术方案，不直接实施 patch。

本轮同步继续遵循 `docs/10-prompt/项目角色.md` 的边界：脚本负责列文件、取 diff、查引用、跑测试和残留扫描；LLM 负责逐文件判断是否同步、如何适配、是否保留分叉和是否延后。

## 输入与过滤

- CE range：`e8c118e2..4b5f28da`
- CE head：`4b5f28da9746aae8f2c5dd715d7029d0ab2758a6`
- CE repo：`CE_REPO`，即本地 compound-engineering-plugin checkout
- spec-first repo：`SPEC_REPO`，即当前仓库
- 默认过滤：`docs/**` 和 `tests/**` 不作为直接迁移目标；测试文件作为上游意图证据读取，再在 spec-first 中按现有测试风格重写。

实施前必须先处理或确认当前 dirty worktree。本计划编写时 `SPEC_REPO` 已有未提交改动，集中在 `CHANGELOG.md`、`package.json`、`.claude-plugin/plugin.json`、README、`skills/spec-mcp-setup/**`、`skills/spec-graph-bootstrap/**`、`skills/using-spec-first/SKILL.md`、`src/cli/contracts/dual-host-governance/skills-governance.json`、`src/cli/instruction-bootstrap.js`、`templates/claude/commands/spec/**` 和部分 tests。执行同步时不得覆盖这些改动；若目标文件重叠，先读当前内容再局部合并，并在实施记录中写明每个重叠文件的 merge 判断。

## 上游 commit 事实

实施前必须重新从 CE repo 验证本节事实，不能把本计划摘要当作 source evidence。

| Commit | 上游主题 | 同步影响 |
|---|---|---|
| `5952b20d` | `fix(skills): replace case statements blocked by permission check (#701)` | shell `case ... esac` 预解析移除、config fallback guard、shell safety test |
| `17961203` | `chore: release main (#684)` | CE `3.2.0` release metadata，只用于不同步判定 |
| `dd080943` | `fix(ce-doc-review): tighten suggested_fix and why_it_matters rules (#702)` | doc-review subagent template 规则收紧 |
| `4b5f28da` | `fix(ce-work-beta): defer model and reasoning effort to Codex config (#704)` | delegation model/effort optional semantics 和 conditional CLI flags |

实施时必须先运行：

```bash
git -C "$CE_REPO" rev-parse HEAD
git -C "$CE_REPO" log --oneline e8c118e2..4b5f28da
git -C "$CE_REPO" diff --name-status e8c118e2..4b5f28da
```

如果 `HEAD` 不等于或不包含 `4b5f28da9746aae8f2c5dd715d7029d0ab2758a6`，先停止同步并更新 CE repo。对每个进入同步的文件，还必须在实施前重读对应 diff：

```bash
git -C "$CE_REPO" diff --unified=3 e8c118e2..4b5f28da -- <ce-file>
```

本计划的逐文件摘要只作为实施指导；权威事实以实施时的 CE diff 为准。

## CE 文件清单

| CE 文件 | 状态 | 默认实施判定 |
|---|---:|---|
| `.compound-engineering/config.local.example.yaml` | M | 语义适配后同步 |
| `.github/.release-please-manifest.json` | M | 不同步 |
| `CHANGELOG.md` | M | 不同步 |
| `package.json` | M | 不同步 |
| `plugins/compound-engineering/.claude-plugin/plugin.json` | M | 不同步 |
| `plugins/compound-engineering/.codex-plugin/plugin.json` | M | 不同步 |
| `plugins/compound-engineering/.cursor-plugin/plugin.json` | M | 不同步 |
| `plugins/compound-engineering/AGENTS.md` | M | 语义适配后同步 |
| `plugins/compound-engineering/CHANGELOG.md` | M | 不同步 |
| `plugins/compound-engineering/agents/ce-session-historian.agent.md` | M | 直接同步，替换命名 |
| `plugins/compound-engineering/skills/ce-compound/SKILL.md` | M | 直接同步，替换命名 |
| `plugins/compound-engineering/skills/ce-doc-review/references/subagent-template.md` | M | 语义适配后同步 |
| `plugins/compound-engineering/skills/ce-sessions/SKILL.md` | M | 直接同步，替换命名 |
| `plugins/compound-engineering/skills/ce-setup/references/config-template.yaml` | M | 语义适配后同步 |
| `plugins/compound-engineering/skills/ce-update/SKILL.md` | M | 语义适配后同步 |
| `plugins/compound-engineering/skills/ce-work-beta/SKILL.md` | M | 语义适配后同步 |
| `plugins/compound-engineering/skills/ce-work-beta/references/codex-delegation-workflow.md` | M | 语义适配后同步 |
| `tests/skill-shell-safety.test.ts` | A | 语义适配后同步为本仓库测试 |

## 路径映射

| CE 路径 | spec-first 目标 |
|---|---|
| `.compound-engineering/config.local.example.yaml` | `.spec-first/config.local.example.yaml` |
| `plugins/compound-engineering/AGENTS.md` 中 config fallback guidance | `skills/spec-work-beta/SKILL.md` 的 config pre-resolution block；本轮不修改 `AGENTS.md` |
| `plugins/compound-engineering/agents/ce-session-historian.agent.md` | `agents/spec-session-historian.agent.md` |
| `plugins/compound-engineering/skills/ce-compound/SKILL.md` | `skills/spec-compound/SKILL.md` |
| `plugins/compound-engineering/skills/ce-sessions/SKILL.md` | `skills/spec-sessions/SKILL.md` |
| `plugins/compound-engineering/skills/ce-doc-review/references/subagent-template.md` | `skills/spec-doc-review/references/subagent-template.md` |
| `plugins/compound-engineering/skills/ce-setup/references/config-template.yaml` | `skills/spec-setup/references/config-template.yaml`，并检查 `.spec-first/config.local.example.yaml`、`skills/spec-mcp-setup/references/config-template.yaml` 是否需要同步 |
| `plugins/compound-engineering/skills/ce-update/SKILL.md` | `skills/spec-update/SKILL.md` |
| `plugins/compound-engineering/skills/ce-work-beta/SKILL.md` | `skills/spec-work-beta/SKILL.md` |
| `plugins/compound-engineering/skills/ce-work-beta/references/codex-delegation-workflow.md` | `skills/spec-work-beta/references/codex-delegation-workflow.md` |
| `tests/skill-shell-safety.test.ts` | `tests/unit/skill-shell-safety.test.js` |
| CE release/version files | 不映射到 spec-first release 文件 |

## 逐文件 diff 依据与同步判定

### 1. Delegation config 默认值改为 defer-to-user-config

CE 文件：

- `.compound-engineering/config.local.example.yaml`
- `plugins/compound-engineering/skills/ce-setup/references/config-template.yaml`

修改前关键文案：

- `work_delegate_model: gpt-5.4` 注释为 `default: gpt-5.4`
- `work_delegate_effort: high` 注释为 `default: high`

修改后关键文案：

- model 注释改为 `omit to use ~/.codex/config.toml default`
- effort 注释改为 `omit to use ~/.codex/config.toml default`

spec-first 目标：

- `.spec-first/config.local.example.yaml`
- `skills/spec-setup/references/config-template.yaml`
- `skills/spec-mcp-setup/references/config-template.yaml`，该文件当前已有未提交改动，执行时必须局部合并。

判定：语义适配后同步。spec-first 应使用 `.spec-first` 路径和 Spec-First 命名，但语义应跟随 CE：optional delegate model/effort 不再暗示硬默认。

验证断言：

- 三个 config 模板都不再出现 `work_delegate_model` 的 `default: gpt-5.4`。
- 三个 config 模板都不再出现 `work_delegate_effort` 的 `default: high`。
- 保留 `work_delegate_sandbox` 的 `yolo` 默认和 `work_delegate_decision` 的 `auto` 默认。

### 2. CE release/version bump 不同步

CE 文件：

- `.github/.release-please-manifest.json`
- `CHANGELOG.md`
- `package.json`
- `plugins/compound-engineering/.claude-plugin/plugin.json`
- `plugins/compound-engineering/.codex-plugin/plugin.json`
- `plugins/compound-engineering/.cursor-plugin/plugin.json`
- `plugins/compound-engineering/CHANGELOG.md`

修改前关键文案：CE 版本 `3.1.0`。

修改后关键文案：CE 版本 `3.2.0`，并新增 CE release notes。

spec-first 目标：无直接目标。

判定：不同步。spec-first 当前版本和 release cadence 独立，不能把 CE `3.2.0`、CE GitHub URL、CE changelog 或 plugin metadata 复制到 spec-first。后续实施只需在 `CHANGELOG.md` 添加 spec-first 自己的同步记录。

验证断言：

- `package.json` 不被改成 CE 版本。
- `.claude-plugin/plugin.json` 不被改成 CE 版本或 CE metadata。
- `CHANGELOG.md` 只新增 spec-first 本轮同步记录，不粘贴 CE changelog 段落。
- 残留扫描允许历史 changelog 中出现 CE commit 背景，不允许当前 source truth 出现 CE plugin metadata。

### 3. Config fallback guard 防止 CWD stray config

CE 文件：`plugins/compound-engineering/AGENTS.md`

修改前关键文案：

- 直接 `cat "$(git rev-parse --show-toplevel ...)/.compound-engineering/config.local.yaml"`
- fallback 直接 `cat "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir ...)")/..."`

修改后关键文案：

- 用 subshell 保存 `top` 和 `common`。
- 在读取前检查 `[ -n "$top" ]` 和 `[ -n "$common" ]`。
- 明确说明不在 git repo 时不能让空路径退化为 CWD-relative stray file。

spec-first 目标：

- `skills/spec-work-beta/SKILL.md` 中 `Config (pre-resolved)` block。
- 本轮明确不修改 `AGENTS.md`，避免为本地 config guidance 新增第二真相源。

判定：语义适配后同步。CE 修改的是仓库指导文案；spec-first 的同构风险实际存在于 `spec-work-beta` 预解析命令中，目标应改 source skill，不机械复制 AGENTS 段落。

验证断言：

- `skills/spec-work-beta/SKILL.md` 的 config 读取命令使用 `.spec-first/config.local.yaml`。
- 命令读取 `top` 和 `common` 前均有 non-empty guard。
- 不在 git repo 时最终落到 `__NO_CONFIG__`，不会读取当前目录下的 stray `.spec-first/config.local.yaml`。

### 4. session repo-name 预解析移除 `case ... esac`

CE 文件：

- `plugins/compound-engineering/agents/ce-session-historian.agent.md`
- `plugins/compound-engineering/skills/ce-compound/SKILL.md`
- `plugins/compound-engineering/skills/ce-sessions/SKILL.md`

修改前关键文案：

- `common=$(git rev-parse --git-common-dir ...)`
- `case "$common" in /*) ... ;; *) ... ;; esac`

修改后关键文案：

- `git rev-parse --path-format=absolute --git-common-dir`
- `[ -n "$common" ] && basename "$(dirname "$common")"`
- 不在 repo 内时保持空失败路径。

spec-first 目标：

- `agents/spec-session-historian.agent.md`
- `skills/spec-compound/SKILL.md`
- `skills/spec-sessions/SKILL.md`
- `tests/unit/spec-sessions-contracts.test.js`

判定：直接同步，替换 `ce-*` 为 `spec-*`。这是 shell permission safety 修复，且 spec-first 当前同样含有 `case ... esac`。

验证断言：

- 三个目标文件不再含有 `case "$common" in /*)`。
- 三个目标文件都含有 `git rev-parse --path-format=absolute --git-common-dir`。
- `tests/unit/spec-sessions-contracts.test.js` 的旧断言改为断言无 `case ... esac`，且断言空 `common` guard。

### 5. doc-review subagent template 收紧 autofix / suggested_fix / why_it_matters

CE 文件：`plugins/compound-engineering/skills/ce-doc-review/references/subagent-template.md`

修改前关键文案：

- 示例 suggested fix 是二选一：`Require Units 1-4 to land in a single atomic PR, or define the sequence explicitly.`
- `safe_auto` / `gated_auto` 规则没有要求按实际写出的 `suggested_fix` 分类。
- `why_it_matters` 只要求不以 section reference 开头。

修改后关键文案：

- 示例 suggested fix 收敛为单一推荐：`Require Units 1-4 to land in a single atomic PR.`
- 新增规则：按写出的 `suggested_fix` 分类，而不是按最小可修复问题分类。
- 新增规则：`suggested_fix` 只能提交一个推荐，不能给 Apply 阶段留下菜单式选择。
- 新增规则：`why_it_matters` 不能用 quote sandwich 开头，嵌入 quote 合计约 30 词以内。

spec-first 目标：

- `skills/spec-doc-review/references/subagent-template.md`
- `tests/unit/spec-doc-review-contracts.test.js`

判定：语义适配后同步。CE 方向与 spec-doc-review 的 best-judgment / bulk-preview 模型一致，但必须保留 spec-first 当前 task-pack review、headless 和 routing 文案，不整文件覆盖。

验证断言：

- subagent template 中示例不再含 `or define the sequence explicitly`。
- 模板含有 `Classify your suggested_fix by what's written` 的等价规则。
- 模板含有 `suggested_fix commits to one recommendation` 的等价规则。
- 模板含有 quote sandwich 禁止和约 30 words quote cap 的等价规则。
- `spec-doc-review-contracts.test.js` 增加对以上规则的 contract 断言。

### 6. spec-update 预解析移除 `case ... esac`

CE 文件：`plugins/compound-engineering/skills/ce-update/SKILL.md`

修改前关键文案：

- 用 shell `case "${CLAUDE_SKILL_DIR}" in */plugins/cache/*/compound-engineering/*/skills/ce-update) ... ;; *) ... ;; esac` 判断 marketplace cache。

修改后关键文案：

- 用 `echo "${CLAUDE_SKILL_DIR}" | grep -q "/plugins/cache/.*/compound-engineering/.*/skills/ce-update$" && ... || sentinel` 替换 `case`。

spec-first 目标：

- `skills/spec-update/SKILL.md`
- `tests/unit/spec-update-contracts.test.js`

判定：语义适配后同步。目标路径必须使用 `spec-first` 和 `spec-update`；同时修正当前 sentinel 拼写 `__SPEC_UPDATE_NOT_MARKETPLASPEC__`，统一为 `__SPEC_UPDATE_NOT_MARKETPLACE__`，避免在本次触碰时保留明显 typo。

验证断言：

- `skills/spec-update/SKILL.md` 的 pre-resolution backtick block 不含 `case ... esac`。
- marketplace grep pattern 为 `/plugins/cache/.*/spec-first/.*/skills/spec-update$`。
- 所有 sentinel 使用 `__SPEC_UPDATE_NOT_MARKETPLACE__`。
- `tests/unit/spec-update-contracts.test.js` 增加 shell safety 和 sentinel 断言。

### 7. work-beta delegation model/effort 改为 optional flags

CE 文件：

- `plugins/compound-engineering/skills/ce-work-beta/SKILL.md`
- `plugins/compound-engineering/skills/ce-work-beta/references/codex-delegation-workflow.md`

修改前关键文案：

- `work_delegate_model` 默认 `gpt-5.4`。
- `work_delegate_effort` 默认 `high`。
- `codex exec` 固定传 `-m "<delegate_model>"` 和 `-c 'model_reasoning_effort="<delegate_effort>"'`。

修改后关键文案：

- model/effort unset 或 unparseable 时 defer to `~/.codex/config.toml`。
- `delegate_model` 和 `delegate_effort` 允许 unset。
- `codex exec` 只在对应 skill-state value set 时插入 `-m` 或 `-c` 行。
- 不允许用 placeholder string 替代 unset values。

spec-first 目标：

- `skills/spec-work-beta/SKILL.md`
- `skills/spec-work-beta/references/codex-delegation-workflow.md`
- `tests/unit/spec-work-beta-contracts.test.js`

判定：语义适配后同步。spec-first 应保留自己的 CRG 删除后 direct-read context posture、task-pack identity contract 和 dual-host language；只局部替换 delegation config semantics 与 codex invocation template。

验证断言：

- `skills/spec-work-beta/SKILL.md` 不再说 model default `gpt-5.4` 或 effort default `high`。
- `delegate_model` / `delegate_effort` 状态说明为 string from config or unset。
- codex delegation reference 的 invocation template 不固定包含 `-m "<delegate_model>"` 和 `-c 'model_reasoning_effort="<delegate_effort>"'`。
- reference 明确 conditional flags 插入规则，并禁止 placeholder string。
- `tests/unit/spec-work-beta-contracts.test.js` 增加 optional flag / config default contract。

### 8. 新增 shell safety contract test

CE 文件：`tests/skill-shell-safety.test.ts`

新增文件职责：

- 扫描 plugin skill markdown 里的 `!` backtick pre-resolution commands。
- 禁止 `case ... esac`，因为 Claude Code permission checker 会拒绝 `case_statement`。

spec-first 目标：

- `tests/unit/skill-shell-safety.test.js`

判定：语义适配后同步。spec-first 测试栈是 CommonJS/Jest 风格，不能照搬 Bun/TypeScript；扫描范围也应改成 spec-first source truth。

验证断言：

- 测试扫描 `skills/**/*.md` 和 `agents/*.md`；`templates/**/*.md` 由残留扫描覆盖。
- 测试只分析 `!` backtick pre-resolution commands，不把普通 prose 里的 `case` 误判为失败。
- 测试失败信息说明 Claude Code 会拒绝 `case ... esac`；替代方案为 `if` / `&&` / `||` 或 `git rev-parse --path-format=absolute --git-common-dir`。
- 新测试随 `npm run test:unit -- skill-shell-safety` 或仓库现有 unit 命令通过。

## 实施单元

### U1：shell pre-resolution safety

文件：

- `agents/spec-session-historian.agent.md`
- `skills/spec-compound/SKILL.md`
- `skills/spec-sessions/SKILL.md`
- `skills/spec-update/SKILL.md`
- `tests/unit/spec-sessions-contracts.test.js`
- `tests/unit/spec-update-contracts.test.js`
- `tests/unit/skill-shell-safety.test.js`

决策：

- 所有 `!` pre-resolution command 都避免 `case ... esac`。
- repo name derivation 统一使用 absolute git-common-dir，并显式 guard empty output。
- `spec-update` 同步 grep pattern，同时修正 marketplace sentinel 拼写。

测试场景：

- session contract 验证 `spec-sessions` 使用 absolute git-common-dir 且无 `case`。
- spec-update contract 验证 cache path 检测不使用 `case`，sentinel 拼写一致。
- shell safety test 能捕获任意 skill/agent pre-resolution 中的 `case ... esac`。

### U2：work-beta delegation config and invocation

文件：

- `.spec-first/config.local.example.yaml`
- `skills/spec-setup/references/config-template.yaml`
- `skills/spec-mcp-setup/references/config-template.yaml`
- `skills/spec-work-beta/SKILL.md`
- `skills/spec-work-beta/references/codex-delegation-workflow.md`
- `tests/unit/spec-work-beta-contracts.test.js`

决策：

- model/effort 不再由 skill 硬编码默认值；unset 时交给 Codex 用户配置。
- config fallback 必须 guard empty repo roots，避免读取 stray local config。
- `skills/spec-mcp-setup/references/config-template.yaml` 当前处于 dirty worktree 涉及范围，执行时必须先确认本地改动语义。

测试场景：

- work-beta contract 验证 model/effort optional semantics。
- contract 验证 codex invocation 只条件插入 `-m` / `-c`。
- config 模板扫描验证不再写硬默认值。
- `CHANGELOG.md` 的本轮同步记录必须标记 `(user-visible)`，并明确 `work_delegate_model` / `work_delegate_effort` 在 omitted 时 defer 到 `~/.codex/config.toml`，且不会向 `codex exec` 传 placeholder flags。

### U3：doc-review finding quality contract

文件：

- `skills/spec-doc-review/references/subagent-template.md`
- `tests/unit/spec-doc-review-contracts.test.js`

决策：

- suggested fix 只能提交一个可执行推荐，不给 Apply 阶段留下二选一菜单。
- autofix_class 按实际写出的 fix scope 分类。
- why_it_matters 先写 consequence，避免 quote sandwich，并限制嵌入 quote 长度。

测试场景：

- doc-review contract 验证新三类规则存在。
- 保持现有 best-judgment、bulk-preview 和 task-pack review contract 不退化。

### U4：release metadata 不同步与收尾记录

文件：

- `CHANGELOG.md`

决策：

- 不同步 CE `3.2.0` 版本号、CE changelog、CE plugin manifest 或 CE release-please manifest。
- 只添加 spec-first 自己的本轮同步记录。
- 该记录必须标记 `(user-visible)`，并点明 `spec-work-beta` delegation 的用户可见行为变化：omitted `work_delegate_model` / `work_delegate_effort` defer 到 `~/.codex/config.toml`，unset 时不传 `-m` / `-c` placeholder flags。

测试场景：

- `node -p "require('./package.json').version"` 保持 spec-first 当前版本。
- `rg -n 'compound-engineering-v3.2.0|cli-v3.2.0|EveryInc/compound-engineering-plugin/compare' package.json .claude-plugin CHANGELOG.md skills agents src templates README.md README.zh-CN.md` 只允许历史背景或计划文档命中，不能出现在当前 source truth 中。
- `rg -n 'work_delegate_model|work_delegate_effort|~/.codex/config.toml|placeholder' CHANGELOG.md` 能命中本轮 user-visible 记录。

## 执行顺序

1. 验证 CE repo 和上游 diff：确认 `HEAD` 等于或包含 `4b5f28da9746aae8f2c5dd715d7029d0ab2758a6`，重跑 `log --oneline`、`diff --name-status`，并对每个同步文件重读 `git diff --unified=3`。
2. 执行 target-overlap audit：运行 `git status --short`，将 dirty paths 与 U1-U4 所有目标文件逐项求交集；对每个重叠文件写明当前本地 diff、保留策略和局部合并点。覆盖范围包括 `CHANGELOG.md`、package/plugin metadata、tests、skills、agents、`.spec-first/config.local.example.yaml`、`skills/spec-setup/references/config-template.yaml` 和 `skills/spec-mcp-setup/references/config-template.yaml`。
3. 实施 U1 shell safety，因为它修复会阻断 skill load 的 deterministic shell permission 问题。
4. 实施 U2 delegation config 和 invocation，因为它影响 `spec-work-beta` 实际执行命令。
5. 实施 U3 doc-review prompt contract，避免和 U1/U2 文件冲突。
6. 添加或更新 U4 changelog 记录。
7. 运行验证矩阵。
8. 如果涉及 runtime asset source、skill、agent 或 command template，最后重建 runtime；若 runtime 目录不是提交范围，只记录验证动作，不手改生成资产。

## 验证矩阵

| 变更类型 | 验证命令 / 检查 |
|---|---|
| shell pre-resolution safety | `npm run test:unit -- skill-shell-safety` 或等价 unit scope |
| session skill / agent contract | `npm run test:unit -- spec-sessions-contracts` |
| spec-update contract | `npm run test:unit -- spec-update-contracts` |
| doc-review prompt contract | `npm run test:unit -- spec-doc-review-contracts` |
| work-beta delegation contract | `npm run test:unit -- spec-work-beta-contracts` |
| skill entrypoint / prose safety | `npm run lint:skill-entrypoints` |
| syntax check | `npm run typecheck` |
| patch hygiene | `git diff --check` |
| release metadata non-sync | targeted `rg` scan for CE version URLs and CE plugin names |
| user-visible delegation note | `rg -n 'work_delegate_model|work_delegate_effort|~/.codex/config.toml|placeholder' CHANGELOG.md` |
| broad confidence after all units | `npm test`，若发布物受影响再跑 `npm run build` |

## 残留扫描

本轮至少执行：

```bash
rg -n 'case .*esac|case "\\$common"|git rev-parse --git-common-dir|__SPEC_UPDATE_NOT_MARKETPLASPEC__|default: gpt-5.4|default: high|or define the sequence explicitly|compound-engineering-v3.2.0|cli-v3.2.0' skills agents templates src tests README.md README.zh-CN.md AGENTS.md CHANGELOG.md .spec-first/config.local.example.yaml .claude-plugin
```

允许命中：

- 历史 changelog。
- 本计划文档。
- 负向 contract test 中刻意构造的样例。
- `.spec-first/config.local.yaml` 是 gitignored 机器本地状态，不作为本轮 source truth 残留扫描目标；若它保留旧注释，只在最终回复中作为 local config drift 提醒，不作为同步失败。

不允许命中：

- source skill / agent pre-resolution command 的 `case ... esac`。
- 当前 config 模板的 model/effort 硬默认。
- `spec-update` 的 typo sentinel。
- 当前 plugin metadata 或 package version 中的 CE `3.2.0`。

## Runtime 重建

如果实施同步实际修改了 `skills/`、`agents/`、`templates/` 或 governance source，执行后需要重建 runtime：

```bash
node bin/spec-first.js init --codex
node bin/spec-first.js init --claude -u leokuang --lang zh
```

约束：

- 不手改 `.claude/`、`.codex/`、`.agents/skills/`。
- 若 runtime 目录不属于本次提交范围，只把重建作为验证动作和 PR 描述说明。

## Done Criteria

- 17 个非测试 CE 文件 100% 有同步判定。
- 1 个 CE 新增测试已转化为 spec-first 测试计划，不照搬 Bun/TS。
- 所有目标文件采用 spec-first 命名、`.spec-first` 路径、Spec-First update sentinel 和本仓库测试风格。
- 不同步 CE release metadata 的决定被验证。
- `case ... esac` 不再存在于 skill / agent pre-resolution commands。
- delegation model/effort unset 时不会传 placeholder CLI flag。
- 本轮 user-visible changelog 记录说明 delegation model/effort defer 到 Codex config 的行为变化。
- doc-review suggested_fix 规则不再让 Apply 阶段做二次选择。
- `CHANGELOG.md` 有 spec-first 记录。
- 验证矩阵通过，未运行项和剩余风险在最终回复中列明。
