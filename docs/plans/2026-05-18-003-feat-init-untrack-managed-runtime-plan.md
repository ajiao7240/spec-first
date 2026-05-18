---
title: "feat: spec-first init 一次性解除已被跟踪的 generated runtime 路径"
type: feat
status: active
date: 2026-05-18
spec_id: 2026-05-18-003-init-untrack-managed-runtime
---

# feat: spec-first init 一次性解除已被跟踪的 generated runtime 路径

## Summary

为 `spec-first init` 增加一项 source-of-truth 治理能力：当受管 generated runtime 路径（`.claude/`、`.codex/`、`.agents/skills/` 与 `.gitignore` managed block 中声明的所有 spec-first runtime 子路径）已经被 git index 跟踪时，init 在写 `.gitignore` managed block 之后，一次性运行 `git rm --cached` 把这些路径从索引解除，工作区文件保留以保证 runtime 仍可用。预期效果：迁移到 spec-first 治理的历史仓库，未来 `spec-first init` 升级 developer profile 版本号或重写 runtime 入口时，不再因为索引里残留的 `.codex/spec-first/.developer`、`.claude/spec-first/.developer` 等历史跟踪文件冒出 noisy diff，进而不再污染 `$spec-graph-bootstrap` 的 worktree 干净度判断、code-review-graph 的 PR diff 评审上下文。

## Origin

无独立 brainstorm 文档；本 plan 由当前会话产生，源于用户在 `/Users/kuang/ops/code/9627_KAZ展业项目-MVP版本-CRM需求_中台开发` 跑 `$spec-graph-bootstrap` 时 8 个 child repo 全部以 `reason_code=dirty-refresh-non-canonical` 阻断的现场观察。其中 `hs-kaz-crm-basic-service/.codex/spec-first/.developer` 是历史上被 `git add` 进索引的 generated runtime 文件，`.gitignore` 对已跟踪文件不生效，每次 `spec-first init --codex` 升级版本号都会反复冒出同一条 noisy diff。

## Graph Readiness

- target_repo: spec-first（当前 cwd 所在仓库）
- status: stale
- source_revision: 4db7aaed1a78fa2ad7d6e28610348002cd85a531
- current_revision: 29caa62af9ba35ed1e98f8d444c9ab440ffbbff6
- stale: true
- primary_providers: code-review-graph, gitnexus（上次 cold-run 全部 ready，但 fingerprint 已不匹配当前 HEAD）
- degraded_providers: 无
- fallback_capabilities: bounded direct repo reads
- runtime_mcp_evidence: not-attempted（plan 阶段不需要语义图证据，本次只读 source-of-truth 的 init/state 模块）
- confidence: medium-high
- limitations: 当前 plan 主要修改面是 init/gitignore source-of-truth，且影响范围已通过直接代码阅读完整覆盖；不依赖 graph evidence 做 impact 判断。如后续 spec-work 需要做 review autofix 或大范围影响分析，需要重跑 `$spec-graph-bootstrap` 后再消费 graph facts。

## Goals

- G1：让 `spec-first init` 在写 `.gitignore` managed block 之后，自动解除已被 git index 跟踪、且命中 spec-first managed runtime 路径的所有文件。
- G2：完整保留现有 init 的 plan→preview→apply 三段式：`--dry-run` 必须可看到将要 untrack 的文件清单，不写任何变更；apply 阶段才真正执行 `git rm --cached`。
- G3：仅解除索引跟踪，**不删工作区文件**。runtime 仍由生成器写出/维护。
- G4：在 init 输出（人类可读 stdout）和 workspace 模式的 `init-summary.json` 里，新增一段 untrack 摘要：未发现 / 已解除 / 失败的文件计数与样例路径，便于用户和 LLM 复查。
- G5：能力一次性、幂等：同一个 init 重复跑两次，第二次 untrack 计数应为 0；非 git 仓库或 git 不可用时，untrack 阶段降级为 advisory no-op，不影响其他 init 步骤。

## Non-Goals

- 不删工作区文件：runtime 文件仍要在磁盘上存在，host runtime 才能加载。
- 不做"持续 untrack"：不监听后续手动 `git add`、不写 hook、不在 doctor 里默默二次执行；只在 init 一次性处理。
- 不接管 source-of-truth 路径（CLAUDE.md、AGENTS.md、`src/cli/`、`docs/`、`templates/` 等）的跟踪状态。
- 不强制扩展 managed runtime 路径列表；继续使用 `getSpecFirstGitignorePatterns()` 作为唯一 source。
- 不引入 `simple-git` 等额外依赖；用 child_process 调用本机 `git`。
- 不在 workspace 模式下做"父级 advisory 跨子仓 untrack"：init 已经按子仓 fan-out 调用 `runInitForProject`，子仓 untrack 自然在每个 child 内执行；父级 advisory 只汇总。
- 不改 `gitignore-policy.js` 的现有 markers 或行为；untrack 是新增独立步骤。

## Requirements Traceability

| ID | 需求 | 来源 | 验收锚点 |
|----|------|------|----------|
| R1 | init 写 `.gitignore` 后，自动 untrack 受管 runtime 路径 | 用户现场（KAZ workspace basic-service） | unit test：构造被跟踪 `.codex/spec-first/.developer` → init 后索引中移除、工作区文件保留 |
| R2 | dry-run 不写变更，但摘要必须列出将要 untrack 的文件 | 现有 init plan→preview→apply 契约 | dry-run 测试：assert stdout 含计划 untrack 路径，assert `git status` 索引未变 |
| R3 | 非 git 仓库 / git 不可用 → advisory no-op | spec-first 角色契约：脚本失败应返回 reason_code，不阻塞 LLM 决策 | unit test：用纯目录跑 init，untrack 阶段 status=`skipped`，reason=`not-a-git-repo`，init 整体仍成功 |
| R4 | 重复运行幂等 | 减少 LLM 困惑、避免 noisy diff 复发 | unit test：连跑两次，第二次 `untracked_count=0` |
| R5 | 输出结构稳定，方便 LLM 与 doctor 消费 | spec-first 输出标准 | init stdout 行格式固定；workspace `init-summary.json` 里 child result 增加 `runtime_untrack` 字段 |
| R6 | 能力对 Claude 与 Codex 双宿主一致 | spec-first 双宿主治理 | smoke test：分别 `init --claude` / `init --codex` 都能解除（managed runtime 路径列表本就跨双宿主） |
| R7 | CHANGELOG 必填，行为变更对用户可见 | CLAUDE.md 强制基线 | CHANGELOG.md 新增条目带 `(user-visible)` 标记 |

## Architecture & Boundaries

- **Source-of-truth 边界**：受管 runtime 路径列表唯一来源是 `src/cli/gitignore-policy.js` 的 `getSpecFirstGitignorePatterns()`。新增能力**消费**它，不复制、不引入第二份列表。
- **职责分工**：
  - 脚本职责（确定性）：用 `git ls-files -- <pattern>` 收集候选；用 `git rm --cached --quiet -- <files>` 解除跟踪；产出 reason_code、计数、路径样例。
  - LLM 职责（语义）：本能力**不需要 LLM 判断**，是一个纯确定性步骤。所以放在 init 主流程 apply 阶段，不进入任何 advisory 决策路径。
- **operation 抽象选择**：复用现有 `operation.kind` 体系会带来语义混乱（`remove_file` 会真正删工作区文件）。决定**新增一个 `kind=untrack_index` 的 operation 类型**，由 `applyOperationPlan` 路由到一个独立 handler，handler 在执行前再检查目标文件是否仍被跟踪（防 TOCTOU）。
- **写顺序**：`destructiveResetPlan` → `preSyncPlan` → `initWritePlan(含 gitignore + untrack)` 是当前顺序。untrack operation 必须**位于 gitignore write 之后**，否则即便用户没有 managed block 也强行解跟踪会让 `.gitignore` 无规则兜底，下次手动 `git add` 又会重新被跟踪。
- **Workspace 模式**：父 workspace 不写子仓 git；不需改动 `runInitForWorkspace` 主体。仅在 child 结果里新增 `runtime_untrack` 摘要字段，并在父级 `init-summary.json` 总计数里聚合 `runtime_untrack_total`。

## Implementation Units

### IU-1：在 gitignore-policy 旁新增 untrack helper（纯函数 + 边界）

- 文件：`src/cli/runtime-untrack.js`（新增）
- 职责：
  - 导出 `planRuntimeUntrack({ projectRoot, runGit })`：用注入的 `runGit` 跑 `git ls-files -z -- <patterns>`，返回 `{ status: 'planned' | 'skipped' | 'failed', operations: [...], reason_code, diagnostic, sample_paths }`。
  - 导出 `applyRuntimeUntrack({ projectRoot, operations, runGit })`：批量 `git rm --cached -- <files>`，回写计数；执行前对每条 operation `git ls-files -- <file>` 二次确认仍被跟踪，避免与并发的 git 操作打架。
  - 内部 `runGit` 默认实现：`child_process.spawnSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })`，所有路径走 `--` 分隔符防 git argument injection；patterns 全部从 `getSpecFirstGitignorePatterns()` 来。
- reason_code 集合：
  - `not-a-git-repo`：`git rev-parse --is-inside-work-tree` 不是 `true`
  - `git-binary-missing`：spawn ENOENT
  - `git-command-failed`：非零退出（带 stderr 摘要）
  - `none-tracked`：候选为空
  - `untracked-runtime`：成功执行
- 不直接修改 `gitignore-policy.js`；保留它作为"声明 patterns 的轻量纯函数"。

### IU-2：init 主流程接入 untrack plan

- 文件：`src/cli/commands/init.js`
- 改动点：
  - 新增 `buildInitUntrackPlan(projectRoot)`：调用 `planRuntimeUntrack`，把每条候选包装成 `{ kind: 'untrack_index', path, reason: 'managed_runtime_untrack' }` 写入 plan；如果 status 是 `skipped`/`failed`/`none-tracked`，返回空 operation plan + 一个 sidecar `untrackDiagnostic` 对象，单独保留并在 dry-run/apply 输出里读取（避免污染 plan.summary）。
  - `buildInitWritePlan(...)` 返回值新增 `untrackDiagnostic`；调用方（`runInitForProject`）合并到主流程。
  - `printInitDryRun` 增加 untrack 段落：写 `Would untrack N managed runtime path(s):` 与样例最多 10 条；如有 diagnostic 也打印 reason_code。
  - apply 后的 stdout 增加一行：`🧯 Untracked N managed runtime path(s) from git index (work tree files preserved).`；reason=`none-tracked` 时打印 `🧯 No managed runtime paths require untracking.`；其它非成功 reason 打印 advisory 警告但不返回非零 exit code。
  - workspace 模式：在 per-child `results[].runtime_untrack` 里写 `{ status, count, reason_code, sample_paths, diagnostic }`，并在 `summary.counts` 增加 `runtime_untrack_total` 与 `runtime_untrack_action_required`。

### IU-3：state 层支持 `untrack_index` operation kind

- 文件：`src/cli/state.js`
- 改动点：
  - 在 `applyOperationPlan` 的 kind 路由中新增分支：`if (operation.kind === 'untrack_index') { runtimeUntrack.applyOne(projectRoot, operation); continue; }`。
  - 在 `summarizeOperations` 自然支持新 kind（已经是泛型计数）。
  - 在 `mergeOperationPlans` 自然支持新 kind（去重 key 已用 `${kind}:${path}`）。
  - `resolveOperationTarget` 不需要改：path 仍是项目相对路径，不写文件系统，但仍应通过 `isPathWithin` 安全检查。

### IU-4：单元测试

- 文件：`tests/unit/runtime-untrack.test.js`（新增）
  - 用 `child_process.spawnSync` 真实初始化临时 git 仓库（`git init` + `git add` + `git commit -m bootstrap`，带 `-c user.email=t@e -c user.name=t -c commit.gpgsign=false`）。
  - 场景 A：仓库内已 commit 一份 `.codex/spec-first/.developer` → `planRuntimeUntrack` 返回 `untracked-runtime`，operations 含该路径；`applyRuntimeUntrack` 后 `git ls-files .codex/spec-first/.developer` 为空，工作区文件仍存在。
  - 场景 B：仓库内有 `.claude/spec-first/.developer` 但 .gitignore 已生效，从未被 add → `none-tracked`，operations 空。
  - 场景 C：纯目录无 git → `not-a-git-repo`，advisory，无副作用。
  - 场景 D：连续两次 apply，第二次 `untracked-runtime` 但 operations 空（幂等）。
- 文件：`tests/unit/init-dry-run.test.js`（更新）
  - 新增测试：在临时 git 仓库里 `git add .codex/spec-first/.developer` 后 `git commit`，跑 `runInit(['--codex', '--dry-run', '-u', 't', '--lang', 'zh'])`，断言 stdout 含 `Would untrack 1 managed runtime path` 和 `.codex/spec-first/.developer`，断言 `git ls-files` 仍包含该路径。
  - 新增测试：apply 路径（去掉 `--dry-run`）后断言 `git ls-files` 不再含该路径，工作区文件仍存在；stdout 含 `🧯 Untracked 1` 一行。
  - 新增测试：非 git 临时目录跑 init，断言 untrack 阶段不阻塞 init 主流程，整体 exit code 仍为 0；stdout 不出现 `🧯 Untracked` 而是 `🧯 No managed runtime paths require untracking.`（reason=`not-a-git-repo` 时按 advisory 处理：仅日志）。
- 文件：`tests/unit/gitignore-policy.test.js`（不改）：保持现有断言。

### IU-5：smoke / integration 触点

- `npm run test:unit` 必须覆盖 IU-4 全部用例。
- `npm run test:smoke`（已有 `init` smoke）：抽样验证 dry-run 输出包含新增段落（即便临时仓库里没有需要 untrack 的文件，也应有 "No managed runtime paths require untracking." 这一行的稳定 footprint）。
- 不增加新的 e2e 套件。

### IU-6：文档与 CHANGELOG

- `CHANGELOG.md`：根目录新增一行（按当前格式 `- v<x.y.z> YYYY-MM-DD HH:MM:SS 作者: ... (user-visible)`）。`<x.y.z>` 由 release 时决定，本 plan 留 placeholder。
- `README.md` / `README.zh-CN.md`：在 init 章节追加一句"`spec-first init` 现在会一次性解除已被跟踪的 generated runtime 路径，避免历史仓库迁移后 noisy diff"。
- `skills/spec-mcp-setup/SKILL.md`：不改（不属于 setup 职责）。
- `skills/spec-graph-bootstrap/SKILL.md`：不改契约，但在 `dirty-refresh-non-canonical` 条目附近增加一段"如果 dirty 来源是历史被跟踪的 generated runtime 文件，先在子仓重跑 `spec-first init` 让 untrack 步骤接管"；属于 advisory note，不改 reason_code 集合。
- `docs/00-版本路线/版本规划.md`：补一行 changelog 引用，按现有格式。

## Test Scenarios

### IU-1 / IU-3（runtime-untrack helper + state kind）

| 场景 | 前置 | 操作 | 期望 |
|------|------|------|------|
| 已跟踪 `.codex/spec-first/.developer` | 临时 git 仓库已 commit 该文件 | `applyRuntimeUntrack` | `git ls-files` 不含该路径；工作区文件仍存在；返回 `count=1` |
| 已跟踪 `.claude/spec-first/.developer` | 同上 | 同上 | 同上（覆盖另一宿主路径） |
| 未跟踪但工作区有 | gitignore 已生效，从未 add | plan | reason=`none-tracked`，operations 空 |
| 非 git 目录 | 纯 fs.mkdtemp | plan | reason=`not-a-git-repo`，operations 空 |
| git 不在 PATH | 注入 mock runGit ENOENT | plan | reason=`git-binary-missing`，advisory |
| 连续两次 apply | 已 commit 该文件 | apply ×2 | 第一次 count=1，第二次 count=0 |
| 路径含特殊字符 | 临时仓库 commit `.claude/agents/带 空格.md` 类似路径 | apply | 仍能解除（说明 `--` 与 `-z` ls-files 正常工作） |

### IU-2（init 主流程）

| 场景 | 前置 | 操作 | 期望 |
|------|------|------|------|
| dry-run + 有跟踪 | 临时 git 仓库 commit 历史 runtime | `runInit ['--codex','--dry-run','-u','t','--lang','zh']` | exit 0；stdout 含 `Would untrack 1 ...` 和路径；`git ls-files` 不变 |
| apply + 有跟踪 | 同上 | 去掉 --dry-run | exit 0；stdout 含 `🧯 Untracked 1 ...`；`git ls-files` 不再含；工作区文件保留 |
| apply + 无跟踪 | 干净临时 git 仓库（`.gitignore` 中已有 managed block，从未 add runtime） | 同上 | stdout 含 `🧯 No managed runtime paths require untracking.` |
| 非 git 目录 | 纯 fs.mkdtemp | apply | exit 0；stdout 含 advisory `runtime untrack skipped: not-a-git-repo`；其它 init 步骤完成 |
| Claude 适配器 | 同 dry-run，参数 `--claude` | dry-run | 输出与 codex 等价，managed runtime 列表覆盖 `.claude/`、`.codex/`、`.agents/skills/` 等所有路径 |
| 重复 apply | 第一次 apply 后再次 apply | apply ×2 | 第二次 stdout 仍 `🧯 No managed runtime paths require untracking.`；exit 0 |
| Workspace 模式（parent + 1 child） | 临时 parent 目录 + 一个 child git 仓库（含被跟踪 runtime 文件） | `runInit ['--codex','--all-repos',...]` | 每个 child 完成自己的 untrack；父级 `init-summary.json` 含 `counts.runtime_untrack_total >= 1`，child result 含 `runtime_untrack` 字段 |

## Sequencing & Dependencies

- 依赖：仅 Node 内置 `child_process`、`fs`、`path` 与现有 `gitignore-policy.js`。
- 顺序：IU-1 → IU-3 → IU-2 → IU-4 / IU-5（测试可与 IU-2 并行）→ IU-6。
- 与最近其它 plan 关系：与 `2026-05-18-001`（CRG/GitNexus 边界收敛）、`2026-05-18-002`（agent-browser 非阻塞）无功能耦合，但本能力会**减小** `$spec-graph-bootstrap` 触发 `dirty-refresh-non-canonical` 的概率，对 001 的边界没有副作用。

## Risks & Mitigations

| 风险 | 影响 | 缓解 |
|------|------|------|
| `git rm --cached` 误伤源文件（path 解析错） | source-of-truth 文件被解除跟踪 | 候选只来自 `getSpecFirstGitignorePatterns()`，且每条命令传 `--` 与具体相对路径；apply 前再次 `git ls-files -- <path>` 二次确认 |
| TOCTOU：plan→apply 之间用户手动 `git add` 了一个冲突文件 | apply 时 ls-files 二次确认会过滤掉新加项 | 不为该项执行 untrack；diagnostic 记录 `skipped-now-untracked` |
| Windows 子进程编码与路径分隔符 | sample_paths 显示乱码 | 用 `git ls-files -z` + `Buffer` 分割；plan 内部统一存 POSIX `/` 路径（与 `normalizeOperationPath` 一致） |
| 临时 git 仓库 CI 环境无 user.email | `git commit` 失败导致测试 flaky | 测试 helper 显式 `-c user.email=t@e -c user.name=t -c commit.gpgsign=false` |
| LFS / submodule 的特殊文件 | `git rm --cached` 行为 | 受管 runtime 路径里没有 LFS / submodule，patterns 集合排除了它们 |
| 父 workspace 模式下"看起来跨子仓"操作 | 治理不清 | 不在 parent 层做任何 git 操作；untrack 只在 `runInitForProject(child)` 内部进行；父级 advisory 只汇总，与现有 multi-actor 治理一致 |

## Assumptions

- 用户期望 untrack 是 init 默认行为，不需要额外 flag。如果未来需要"opt-out"开关（例如 CI 环境），可加 `--no-untrack-runtime`，本 plan 不预先实现。
- 工作区里命中 patterns 但已被跟踪的文件**全都**应当解除（不区分用户原意）。如果存在罕见的"故意 add 进 runtime 子路径作为 source"的边角，那本身违反 spec-first 角色契约；plan 不为这种边角做特殊兜底。
- 当前 init 已经能在没有 `git` 二进制的环境运行（其他步骤不依赖 git）；untrack 阶段失败应保持 init 整体可用。

## Open Questions（暂存 spec-work 时复核）

1. 父 workspace 的 `init-summary.json` 加入 `runtime_untrack_total` 是否需要走 schema 版本号 bump？现 schema 是 `workspace-init-summary.v1`，新增字段属于 backward-compatible 添加；倾向不 bump，但需在 CHANGELOG 注明字段新增。
2. CHANGELOG 行的版本号占位：建议 spec-work 阶段读取 `package.json` 当时的版本，本 plan 保留 `<release-version>` 字符串待替换。

## Verification Plan

- 必跑（spec-work 完成后）：`npm run typecheck`、`npm run test:unit`、`npm run test:smoke`。
- 选跑（如改了 setup 投影或 graph readiness 输出）：`npm run test:integration`、`npm run test:graph-bootstrap`。本 plan 没改这些路径，默认不跑。
- 手验：`spec-first init --codex --dry-run` 在 spec-first 自身仓库里运行，输出应有 `🧯 No managed runtime paths require untracking.`（spec-first 自己一直把 `.codex/` 视为 runtime mirror，不会有跟踪文件）。
- 现场验证（用户授权后）：在 `/Users/kuang/ops/code/9627_KAZ展业项目-MVP版本-CRM需求_中台开发/hs-kaz-crm-basic-service` 跑 `spec-first init --codex --dry-run`，断言 dry-run 列出 `.codex/spec-first/.developer`；apply 后再跑 `$spec-graph-bootstrap` 看 `dirty-refresh-non-canonical` 是否消失（其它 7 个 child 的 `.gitignore`/`AGENTS.md` 还需要按 commit 流程提交，这是另一类 dirty 不在本 plan 范围）。

## Handoff

下一步建议（按优先级）：

1. **首选**：`spec-write-tasks` 把本 plan 拆成 ≤6 个原子任务（IU-1～IU-6）。理由：本 plan 触及 source-of-truth（`src/cli/commands/init.js` + 新增 `runtime-untrack.js`），有跨文件、跨测试层的依赖，独立任务能让 spec-work 控制 commit 粒度并便于后续 review。
2. **次选**：直接进 `$spec-work --plan docs/plans/2026-05-18-003-feat-init-untrack-managed-runtime-plan.md`，让 work 自己按 IU 顺序执行。适合用户对 task pack 不感兴趣的情况。
3. **不推荐**：把本能力直接合并到任意 in-flight plan。它是新增的独立 source 行为，混入会破坏 commit 历史的可追溯性。

Doc-review 不必要：plan 范围窄、决策不可逆性低、只触及一个 source 文件 + 一个新文件 + 三个测试文件。
