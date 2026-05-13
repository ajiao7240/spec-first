---
title: feat: graph-bootstrap 双档增量刷新
type: feat
status: active
date: 2026-05-12
spec_id: 2026-05-12-003-graph-bootstrap-incremental-refresh
deepened: 2026-05-12
---

# feat: graph-bootstrap 双档增量刷新

## Summary

为 `spec-graph-bootstrap` 引入两档刷新模型：`incremental`（显式 `--incremental` flag 触发，委托 provider 原生增量命令）与 `full`（默认）。**速度目标和默认切换仅适用于 single-repo 场景**：把 single-repo `commit` 后的 canonical readiness 刷新耗时从 ~25 秒降到 ~3-5 秒（实测在 U4 benchmark 中核验并写回 validation doc）。`--all-repos` 多仓 bootstrap 保持 `DEFAULT_REFRESH_MODE_ALL_REPOS=full` 不变，多仓优化属独立 validation 计划。

**Rollout 策略**：本计划交付**incremental flag-gated opt-in**；U4 benchmark 是 **opt-in 正确性基线**，**不** 自动触发默认切换。Default 切换到 incremental 需要独立的 rollout plan（含连续增量链 A→B→C→D 测试 / rename benchmark / parser degradation fuzz 等更宽 gate）来支撑。本计划只覆盖 bootstrap 自身的两档模型，不捆绑其他 workflow 的治理或披露改动。

### At a Glance

| 维度 | 说明 |
|---|---|
| **问题** | commit 后 `.spec-first/graph/graph-facts.json` 立即 stale，脱困路径目前仅有 ~25 秒全量重跑 |
| **核心机制** | bootstrap 按 fingerprint 决策 `incremental`（委托 `gitnexus analyze` / `code-review-graph update --base`）vs `full`；incremental 失败自动 fallback 到 full |
| **已闭环的实施级 bug** | R6 `last_indexed_commit` carry-forward 避免原子 rewrite 擦除；R6 `^[0-9a-f]{40}$` 格式校验防 argv injection；R7 dirty worktree 强制降级 full（无 opt-in，避免索引 / base ref 错位） |
| **验收 gate**（U4） | A→B 差分对照在 disposable temp clone 跑，per-provider pass matrix 全绿 → **incremental flag-gated opt-in 上线**；**default 切换需独立更宽 rollout plan**（A→B→C→D 链 / rename / parser degradation 等） |
| **速度目标范围** | single-repo only；`--all-repos` 仍走 full 默认，不在本计划速度承诺内 |
| **实施前必做** | A4 协调（`2026-05-09-003` 串行 / 并行 ack） + A3 sanity check（`uvx code-review-graph@2.3.3 --help`） |
| **显式 Scope 剥离** | dirty incremental opt-in / `spec-work` 披露契约 / 统一 redaction helper / `--all-repos` 多仓默认切换 → 全部 follow-up plan |
| **回滚成本** | 单行修改 `DEFAULT_REFRESH_MODE_*` 常量即可，不需回滚 schema / flag |

---

## Problem Frame

`2026-05-09-003-feat-graph-bootstrap-fast-reuse-plan.md` 已铺好 `bootstrap_fingerprint` / `worktree_status_hash` 失效基础设施，`2026-05-12-002-feat-gitnexus-refresh-trigger-policy-plan.md` 已把 refresh trigger policy 收敛为"freshness-check 自动、refresh 显式、repair preview"三节点契约。核心缺口是：**commit 之后 canonical `.spec-first/graph/graph-facts.json` 的 `source_revision` 立刻 stale，现在唯一脱困路径是花 ~25 秒全量重跑**。

通过 context7 查询两个 provider 的官方文档已确认：GitNexus `analyze` 内部自动判断增量 / 全量，`--force` 强制全量；code-review-graph 提供独立的 `update [--base <ref>]` 增量命令和 `build` 全量命令。spec-first 不需要自建增量算法，只要在 bootstrap 脚本里按 fingerprint 决策 incremental vs full、委托 provider 原生命令、失败时 fallback。

---

## Requirements

- R1. `spec-graph-bootstrap` 必须支持两档刷新模式：`incremental`（显式 `--incremental` flag 触发）与 `full`（默认、显式 `--force` / `--full`、fingerprint 非 repo-snapshot 部分变化、dirty worktree 强制降级、`requires_clean_full_refresh=true`、或 U4 benchmark 不达标时保留）。默认值由两个独立常量控制：`DEFAULT_REFRESH_MODE_SINGLE_REPO` 与 `DEFAULT_REFRESH_MODE_ALL_REPOS`，初始均为 `full`；本计划交付 incremental flag-gated opt-in，**不**自动切换默认（rollout plan 独立）。**运行时分流规则（含 all-repos child propagation）**：
  - 父 `--all-repos` 流程拆成 child-scoped invocation 时，必须向 child 进程传入 env var `SPEC_FIRST_ALL_REPOS_SCOPE=1`（PowerShell 同名环境变量）；child bootstrap 读到该 env 即解析为 ALL_REPOS 常量，**不**再走 SINGLE_REPO 分支。
  - 单仓直接调用（无 `--all-repos`，无该 env，无 parent workspace 下的 `workspace-graph-targets.v1`）→ 走 `DEFAULT_REFRESH_MODE_SINGLE_REPO`。
  - 检测顺序：CLI flag `--all-repos` > env `SPEC_FIRST_ALL_REPOS_SCOPE=1` > parent workspace `workspace-graph-targets.v1` 存在 > 单仓默认。
  - 测试矩阵（U2/U3）：(a) 直接 `--all-repos` 走 ALL_REPOS；(b) child-scoped invocation 带 env 走 ALL_REPOS；(c) 同一 child-scoped invocation 不带 env 走 SINGLE_REPO（证明 env 是关键传播路径）。
  - `--all-repos` 默认切换需独立多仓 validation（Deferred to Follow-Up），不在本计划范围。
- R2. `incremental` 模式必须委托给 provider 原生增量接口：GitNexus 使用 `analyze`（无 `--force`），code-review-graph 使用 `update --base <last_indexed_commit>`。
- R3. `full` 模式保持现有行为不变：GitNexus 使用 `analyze --force`，code-review-graph 使用 `build`。
- R4. fingerprint 的非 repo-snapshot 部分（`spec_first.*`、`provider_projection.*`、`provider.*`）任一变化时必须强制 `full`。
- R5. incremental 命令失败时必须自动降级到 full 一次，canonical artifacts 记录 `readiness_source=incremental-fallback-full`、`reason_code=incremental-refresh-failed-fallback-full`。
- R6. `last_indexed_commit` 的**来源、写入时机与合法性**（U2 Approach 复用本条，不重复展开）：
  - **来源（消费时）**：per-provider `.spec-first/providers/<id>/status.json.last_indexed_commit`（上一次 readiness 三级证据全过 + clean worktree 时写入）；**不是** aggregate `graph-facts.json.source_revision`。
  - **写入时机（dirty-aware + carry-forward）**：当前 `write_provider_status()` 用 `jq -n | write_file_atomic` 原子重写整个 status.json。本计划必须**先读旧 status.json** 捕获 `$prior_last_indexed_commit` / `$prior_requires_clean_full_refresh`，最终字段 emit 表达式：
    - **`last_indexed_commit`**：`if (graph_ready and query_ready and worktree_dirty == false) then <current_HEAD_sha> else $prior_last_indexed_commit end`——只有 **clean worktree + readiness 三级证据全过** 才推进；否则保留旧值（transient 失败不擦除，dirty 场景不污染）。
    - **`requires_clean_full_refresh`**（**新字段**）：`if (worktree_dirty == true and (refresh_mode == "incremental" or refresh_mode == "full")) then true else if (worktree_dirty == false and refresh_mode == "full" and graph_ready and query_ready) then false else $prior_requires_clean_full_refresh end`——dirty 跑任何刷新都置 `true`；只有 clean worktree + 完成 full + readiness 通过才清除。
  - **R7 P0 修复（dirty full 也会污染索引）**：dirty worktree 下不论 incremental 还是 full，`gitnexus analyze` / `code-review-graph build` 都会从 filesystem 读 working tree 包括未提交修改。所以 dirty 场景**任何刷新都不推进 `last_indexed_commit`**，避免下次 incremental 用错位的 base。`requires_clean_full_refresh=true` 强制下一次 incremental preflight 降级为 full，直到一次 clean full 跑通才解锁。
  - **合法性**（消费前 preflight 校验，任一不过即走 full）：
    - per-provider status 不存在或未记录 `last_indexed_commit` → `reason_code=incremental-base-ref-unset`
    - **`requires_clean_full_refresh=true`** → `reason_code=clean-full-refresh-required`（强制 full 直到一次 clean full 跑通清除标记）
    - **格式校验**：值不匹配 `^[0-9a-f]{40}$` → `reason_code=incremental-base-ref-invalid-format`（防止 `.spec-first/` 被 CI / 恶意 PR 污染为 `"--other-flag"` / `" --output=/tmp/evil"` 等 argv-injection payload；现有 `safe_args` 只过滤 shell metacharacters，不过滤 flag-shaped 字符串）
    - commit 在 git 中不存在 → `reason_code=incremental-base-ref-missing`
    - commit 存在但不是当前 HEAD 祖先 → `reason_code=incremental-base-ref-not-ancestor`（用 `git merge-base --is-ancestor` 判定）
- R7. Dirty worktree 下 incremental **强制降级到 full**（`reason_code=dirty-worktree-incremental-not-allowed`），**无 opt-in 逃生路径**。**但 dirty 场景 full 也不推进 `last_indexed_commit`**——`gitnexus analyze` / `code-review-graph build` 从 filesystem 读 working tree，dirty 修改会被一并索引；如果推进 base ref，下次 incremental 用错位 base 重现污染问题。所以本计划保护机制是组合：
  - dirty incremental → 强制降级 full（本条）
  - dirty 任何刷新 → 不推进 `last_indexed_commit`（R6 写入时机）
  - dirty 任何刷新 → 写 `requires_clean_full_refresh=true`，下次 incremental preflight 见到此标记即降级 full（R6 合法性 + 决策流），直到一次 clean full 跑通才清除
  - 该状态位由本计划承担（不再 defer 到 follow-up plan）；`--allow-dirty` opt-in 仍不引入。
- R8. Readiness 三级证据契约（build/update/analyze + status + query-surface proof）在 incremental 模式下保持不变。
- R9. `readiness_source` 枚举扩展（per-provider `provider-status.v1`）必须向后兼容：
  - 现有值保持不变：
    - `cold-run`（**所有 full 模式场景都填此值**：首次 bootstrap、显式 `--force` / `--full`、fingerprint 变化触发的强制 full、dirty worktree 默认降级的 full。语义= "本次跑了完整 provider commands"；"cold" 不等于"首次"）
    - `skipped`、`preflight-blocked`
  - 新增值：`incremental-update`（**指本次用 incremental 命令形式调用 provider；provider 内部是否真走增量由 provider 决定，不由本字段断言；下游不得据此推论 graph 只含 diff**）、`incremental-fallback-full`（incremental 失败后已重跑 full 并成功）
  - `docs/contracts/graph-provider-consumption.md` 的 enum 声明必须一并列出全部 5 个值（本计划不引入新 JSON schema 文件，"schema" 在本计划全文指 consumption contract 的 prose 断言 + Jest 契约测试）。
- R10. Aggregate `graph-facts.v1` 顶层**不使用单值 `refresh_mode`**（mixed provider 场景会被压扁）。改为：
  - `refresh_modes_by_provider: { "<id>": "full | incremental | incremental-fallback-full | failed" }`（per-provider truth map；`failed` 表示该 provider incremental + fallback full 都失败，补齐混合失败语义）
  - 可选 `refresh_mode_summary ∈ { full, incremental, incremental-fallback-full, mixed }`（**计算规则**：所有 provider 值相同且不存在 `failed` → 该值；任一不同或存在 `failed` → `mixed`。consumer 读到 `mixed` 必须回 per-provider 读精确事实）
  - **派生路径**：aggregate writer（`bootstrap-providers.sh` L1904-1957 的 graph-facts 段）用 `$providers | map({(.provider): .refresh_mode}) | add` 从 per-provider status 聚合；per-provider `provider-status.v1.refresh_mode` 始终 emit（`skipped` / `cold-run` 场景也填 `full`），保证 aggregate map 键完整。
  - per-provider `provider-status.v1.refresh_mode` 仍为单值，是 truth source。
- R11. 文档/契约/测试同步：`docs/contracts/graph-provider-consumption.md` 补 truth table 与 downstream 使用策略；`docs/contracts/graph-evidence-policy.md` Refresh Trigger Policy 表下方加**一行两档刷新直接相关的 usage note**（见 Scope Boundaries 边界）；`README.md` / `README.zh-CN.md` / `docs/05-用户手册/` 说明两档模型；`CHANGELOG.md` 按仓库格式登记；contract tests 覆盖 fingerprint 决策矩阵、fallback 路径和字段/枚举向后兼容。

---

## Assumptions

- A1. 用户关心 commit 后的刷新体验，不是首次 cold run 耗时。
- A2. GitNexus `analyze` 的内部增量判断是可信的；本计划不自行判断文件变更集。
- A3. `code-review-graph update --base <commit>` 在 pinned 2.3.3 版本下可用且与 `build` 在当前仓库语法覆盖范围内近似等价。**实施前用 `uvx code-review-graph@2.3.3 --help` 做 2 分钟 sanity check**；若不支持则评估升级 pin（走 `2026-05-09-005-fix-code-review-graph-uvx-pin` 流程）或只对 GitNexus 启用 incremental。
- A4. 本计划与 `2026-05-09-003-feat-graph-bootstrap-fast-reuse-plan.md`（fast-reuse，status: active 但未落地）**按 fingerprint 层级分工共存**：完全未变 → reuse（若 fast-reuse 落地）；非 repo-snapshot 未变 → incremental；核心变化 → full。本计划假设 fast-reuse 未落地，`resolve_refresh_mode` 只实现两层决策，reuse 分支保留 hook 点 TODO。若两计划并行，合并顺序与函数 ownership 在实施前显式确认（**这是本计划唯一 P0 blocker**）。

---

## Scope Boundaries

- 不改变 refresh ownership 模型；刷新仍只属于 `$spec-graph-bootstrap`。
- 不新增 git hook / watcher / daemon / CI 自动触发。
- 不修改 provider 内部的 build/analyze/update 算法。
- 不改变 `graph-facts.v1`、`graph-provider-status.v1`、`provider-status.v1`、`bootstrap-impact-capabilities.v1` 的 schema 版本；仅扩展 `readiness_source` 枚举 + 新增可选字段。
- 不回写 setup-owned config（`graph-providers.json` / `runtime-capabilities.json` / `provider-artifacts.json`）。
- 不取消 query probe；readiness 三级证据两档都必须满足。
- 不手改 `.claude/` / `.codex/` / `.agents/skills/` generated runtime。
- **Secret redaction 边界（accepted debt，不扩本计划 scope）**：现有 `analyze.log` / `build.log` / `status.log` / `query.log` 对 provider stdout/stderr 不做 redaction helper 处理；本计划**新增的 `update.log` / `fallback-analyze.log`（GitNexus fallback） / `fallback-build.log`（CRG fallback）** 有意与现有 log surface **采取相同态度**——不引入新 redaction helper，也不做 fake secret output 测试。风险面判断：`npx` / `uvx` 首次下载的 registry URL 可能含 token（私有 registry 场景），provider runtime stdout/stderr 的 error 诊断可能泄露 credentialed URL。本计划主动接受此 debt（非"继承现状" hand-wave），理由是它不是 incremental 刷新本身引入的新问题；统一 redaction helper 覆盖全部 log surface 作为独立 security plan 处理。provider id allowlist（`bootstrap-providers.sh` L726-729 的 `gitnexus|code-review-graph`）仍保证日志路径安全。
- **incremental 新增 argv position 攻击面**：`--base <sha>` 携带 `.spec-first/providers/<id>/status.json.last_indexed_commit` 值，属于新增 user-influenced 攻击面，由 R6 的 40-hex 格式校验治理——这是本计划**显式闭环**的新攻击面，与上条 log redaction debt 性质不同（前者是本计划引入所以必须治理，后者是预先存在的现状延续）。
- 不捆绑其他 workflow 的治理或披露改动：`spec-work` completion 披露契约属于独立计划。`graph-evidence-policy.md` 本计划**只允许添加一行两档刷新直接相关的 usage note**（post-commit 刷新建议），不做 broader policy 细化（后者属独立计划）。

### Deferred to Follow-Up Work

- 跨 session fast-path 命中率 metrics / observability dashboard。
- `--all-repos` 多仓场景 incremental default switch 的正式验证；本计划保持 `DEFAULT_REFRESH_MODE_ALL_REPOS=full`，直到独立多仓 validation 完成。
- 其他 provider 的增量接口探测策略。
- 基于 semantic commit 自动推荐 `--force`。
- runtime mirror drift 修复（直接跑 `spec-first init --claude && spec-first init --codex` 即可，不入本计划）。
- `spec-work` completion 输出披露契约（R13 的原始需求）—— 属于 spec-work 的独立改进。

---

## Graph Readiness

- target_repo: spec-first
- status: stale (acceptable; 本计划为 prose/script 设计，已由直接源码阅读和 context7 核验充分覆盖)
- source_revision: ad4d2a9a9fe90591522f3aeebbf0e04cc20840bf
- current_revision: 5d7367a81aa316703e76c3d67f962527a314b321
- stale: true
- primary_providers: [gitnexus, code-review-graph]
- runtime_mcp_evidence: not-attempted
- confidence: high
- limitations: compiled facts stale；bootstrap 行为设计段已通过直接读取 source 核验

---

## Context & Research

### Relevant Code and Patterns

- `skills/spec-graph-bootstrap/SKILL.md` — source-of-truth，`## Freshness, Timing, And Reuse Facts` 段定义 fingerprint 语义。
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh` — 关键函数 `provider_reuse_decision()`（~981 行）、`provider_bootstrap_fingerprint()`（~996 行）、provider 执行段（~1510-1800 行）。
- `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1` — PowerShell parity。
- `skills/spec-mcp-setup/mcp-tools.json` — provider 包版本 pin。
- projection 逻辑入口已确认在 `skills/spec-mcp-setup/scripts/write-provider-config.sh` 与 `skills/spec-mcp-setup/scripts/write-provider-config.ps1`；相关断言位于 `tests/unit/mcp-setup.sh`。`src/cli/setup/graph-providers-projector.js` 当前不存在，不作为实施入口。
- `docs/contracts/graph-provider-consumption.md` 与 `tests/unit/graph-provider-consumption-contracts.test.js` —— canonical artifact contract 扩展点；本计划不新增 `src/cli/contracts/graph/` JSON schema 文件。
- `docs/contracts/graph-evidence-policy.md`、`docs/contracts/graph-provider-consumption.md` — 契约文档。
- `tests/unit/graph-provider-consumption-contracts.test.js` — 现有契约测试，扩展 `readiness_source` 枚举验证。

### Institutional Learnings

- `docs/plans/2026-05-09-003-feat-graph-bootstrap-fast-reuse-plan.md` — fingerprint 基础设施来源（见 A4 协调决策）。
- `docs/plans/2026-05-12-002-feat-gitnexus-refresh-trigger-policy-plan.md` — refresh trigger 节点治理框架。
- `docs/plans/2026-05-09-005-fix-code-review-graph-uvx-pin-plan.md` — CRG uvx pin。

### External References（context7 核验）

- **code-review-graph** (`/tirth8205/code-review-graph`)：`update [--base <ref>]` 增量更新；`build` 全量。
- **GitNexus** (`/abhigyanpatwari/gitnexus`)：`analyze` 内部自动增量；`--force` 强制全量。

---

## Key Technical Decisions

- 委托 provider 原生增量，不自建。
- 以 fingerprint 决策刷新模式，`repo_snapshot.*` 变化不触发 full。
- incremental 失败自动 fallback 到 full 一次，不重试 incremental。
- Readiness 三级证据契约不松动。
- Setup 投影扩展为独立 `commands.incremental` argv 数组，不用 flag。
- `DEFAULT_REFRESH_MODE_SINGLE_REPO` 与 `DEFAULT_REFRESH_MODE_ALL_REPOS` 是脚本顶部**两个独立常量**，初始均为 `full`；本计划范围内**不**自动切换默认（U4 benchmark 是 opt-in 正确性基线）；future default 切换由独立 follow-up rollout plan 承载，单行常量 PR 即可。回滚同样单行改回。

---

## Open Questions

### Resolved During Planning

- GitNexus `analyze` 增量需要额外 flag？否，文档表明内部自动。
- CRG `update --base` 的 ref 从哪里取？从 per-provider `.spec-first/providers/code-review-graph/status.json.last_indexed_commit`（上一次 `graph_ready=true` 且 `query_ready=true` 成功时写入）；不是 aggregate `graph-facts.json.source_revision`。不存在/非祖先/未记录 → 走 full（R6）。
- Readiness 三级证据 incremental 下是否仍必要？必要。

### Deferred to Implementation

- `provider_reuse_decision()` 与新 `resolve_refresh_mode()` 合并或独立：按代码清晰度决定。
- benchmark 差异阈值：实测后写入 validation doc，不预设。
- placeholder sentinel 形式：推荐 ASCII-only 字符串（如 `__SPEC_FIRST_LAST_INDEXED_COMMIT__`），由实施者确认不与现有 template token 冲突即可。

### P0 Blocker（实施前必须 resolve，在 PR 描述里 ack）

**2026-05-09-003 fast-reuse 落地状态协调**：SKILL.md L210 仍写 "This phase does not skip provider commands"，表明未落地。两个计划是**串行**（本计划先 → fast-reuse 后续合并 reuse 分支）还是**并行**（指定 `resolve_refresh_mode` 函数 ownership 与合并 PR 顺序）需显式决定。默认假设串行；采用默认只需 PR 描述标注 "Assumed serial with 2026-05-09-003"。

> CRG 2.3.3 `update --base` 可用性核验见 A3；属于 sanity check，不作为独立 P0 blocker。

---

## High-Level Technical Design

> *Directional guidance, not implementation specification.*

### Refresh Mode 决策流

```text
spec-graph-bootstrap [--incremental | --full | (default)]
  │
  ├─ Phase 0: 读取 setup inputs + 计算当前 fingerprint
  │
  ├─ Phase 1: 决策 refresh_mode
  │    flag --full / --force?           → full
  │    flag --incremental?              → 走 incremental preflight
  │    flag 未指定 (default)?           → 使用对应 DEFAULT_REFRESH_MODE_*（详见 R1）
  │
  │    若期望 = incremental, 依次 preflight（reason_code 见 R6 / R9；readiness_source 见 R9）:
  │      canonical artifacts 缺失?                         → full (readiness_source=cold-run, 无 reason_code)
  │      fingerprint.spec_first.* 变化?                    → full (reason_code=fingerprint-spec-first-changed)
  │      fingerprint.provider_projection.* 变化?           → full (reason_code=fingerprint-projection-changed)
  │      fingerprint.provider.* 变化?                      → full (reason_code=fingerprint-provider-changed)
  │      dirty worktree?                                    → full (reason_code=dirty-worktree-incremental-not-allowed, R7)
  │      per-provider status 未记录 last_indexed_commit?   → full (reason_code=incremental-base-ref-unset)
  │      last_indexed_commit 格式不匹配 ^[0-9a-f]{40}$?    → full (reason_code=incremental-base-ref-invalid-format)
  │      last_indexed_commit commit 在 git 中不存在?       → full (reason_code=incremental-base-ref-missing)
  │      last_indexed_commit 不是 HEAD 祖先?               → full (reason_code=incremental-base-ref-not-ancestor)
  │      otherwise                                          → incremental
  │
  ├─ Phase 2: 执行 provider commands (按 refresh_mode 选择 argv)
  │    gitnexus:          incremental → analyze  |  full → analyze --force
  │    code-review-graph: incremental → update --base <last_commit>  |  full → build
  │
  ├─ Phase 3: Fallback
  │    incremental 命令 exit != 0?
  │      → 重跑 full 一次；record fallback_from_incremental=true；readiness_source=incremental-fallback-full
  │    incremental 成功但 query probe 失败?
  │      → 现有 status=query-unverified 路径，不触发 fallback
  │    full 也失败?
  │      → workflow_mode=degraded-fallback；保留上一次 artifacts
  │
  └─ Phase 4: 写 canonical artifacts
       readiness_source：enum 见 R9（cold-run / incremental-update / incremental-fallback-full / skipped / preflight-blocked）
       per-provider refresh_mode ∈ {full, incremental, incremental-fallback-full, failed}
       command_results[].refresh_mode ∈ {full, incremental}（仅 kind=bootstrap）；attempt_role ∈ {primary, fallback}
       aggregate: refresh_modes_by_provider 映射 + 可选 refresh_mode_summary（R10）
       last_indexed_commit：readiness 三级证据全过时按 R6 写入当前 HEAD
       所有 freshness 字段更新到当前；readiness 三级证据契约保持不变
```

Fingerprint 分层语义复用 `2026-05-09-003` 的定义（`repo_snapshot.*` 可变 / `spec_first.*` + `provider_projection.*` + `provider.*` 不可变）；本计划只消费不重定义。

---

## Implementation Roadmap

关键路径串行，总工期 ~4-5 天；实施顺序和里程碑：

```text
Pre-flight   (~5 min)     A4 ack（与 2026-05-09-003 协调决策）
                          A3 sanity check（uvx code-review-graph@2.3.3 --help）
    │
    ▼
U1           (~0.5 d)     write-provider-config.sh/.ps1 扩展 provider_commands()
                          加入 incremental argv；sentinel 原样落地 graph-providers.json
    │
    ▼
U2           (~2-3 d)     bootstrap-providers.sh 核心改造：
                          - shape gate 分层校验（必需 kind 无条件 / incremental 按需）
                          - mkdir repo-scoped 原子锁（覆盖 provider 执行 + aggregate 写入）
                          - jq carry-forward payload（R6 写入时机 + 40-hex 校验）
                          - command_results[] 扩展 refresh_mode/attempt_role + fallback 分支 + 独立 log 路径
                          - resolve_refresh_mode() + fingerprint preflight
    │
    ▼
U3           (~1 d)       PowerShell parity：
                          - bootstrap-providers.ps1 镜像 U2 全部行为
                          - write-provider-config.ps1 镜像 U1
                          - System.Threading.Mutex 替代 mkdir lock
    │
    ▼
U4           (~1.5-2 d)   文档同步 + opt-in 正确性基线 benchmark（disposable temp clone）：
                          - README / 用户手册 / contract doc truth table
                          - 写 benchmark-only graph extraction helper（从 provider 原生
                            存储 .gitnexus/ / .code-review-graph/ 提取 node/edge anchor JSON）
                          - 三类 diff（intra-file / cross-file / file lifecycle）
                          - 两个独立比对：(i) A_full vs B_incremental = A→B delta
                            (ii) B_incremental vs B_full = ∅
                          - Per-provider pass matrix 全绿（含 absolute ≤ 5s）→ 计划完成
                          - validation doc 记录原始命令 / 耗时 / diff / 决策
    │
    ▼
计划完成（~0 min）        incremental flag-gated opt-in 上线，本计划交付完成。
                          DEFAULT_REFRESH_MODE_* 保持 full 不变。
                          **Default 切换到 incremental 不在本计划范围**——
                          需独立 follow-up rollout plan（A→B→C→D 链 / rename /
                          parser degradation fuzz 等更宽 gate）支撑后再单行 PR 切换。
```

**回滚**：incremental flag 出问题 → 用户停止使用 `--incremental`（本计划不切默认，无回滚动作）。未来 default 切换后回滚 → 单行反向修改 `DEFAULT_REFRESH_MODE_SINGLE_REPO` 常量，不回滚 schema / flag / canonical artifact 字段。

**关键 blocker**：整个路径的唯一真 blocker 是 A4（P0 协调 2026-05-09-003）；A3 sanity check 已通过（CRG 2.3.3 支持 `update --base`）。

---

## Implementation Units

### U1. `graph-providers.json` 投影扩展 incremental 命令 slot

**Goal:** 把 `mcp-tools.json` 的 provider pin 投影到 `.spec-first/config/graph-providers.json.providers.<id>.commands.incremental`。

**Precondition:** Open Questions / P0 Blocker 段的 fast-reuse 协调决策已在 PR 描述中被显式 ack（默认假设亦算 ack）；A3 的 CRG `update --base` sanity check 结果在进入 U2 前记录。

**Requirements:** R2

**Dependencies:** None

**Files:**
- Modify: `skills/spec-mcp-setup/scripts/write-provider-config.sh`（`provider_commands()` 函数 ~L580 新增 `incremental` argv 构造；这是 commands 的实际构造点，**commands 不在 `mcp-tools.json` 里**——后者只是 package/version pin）
- Modify: `skills/spec-mcp-setup/scripts/write-provider-config.ps1`（`Get-ProviderCommands` 等价函数，PowerShell parity）
- Test: `tests/unit/mcp-setup.sh`（扩展 L1102 区域 "provider commands are config-defined arrays" 断言，加 `commands.incremental` argv 精确形状）
- Test: `tests/unit/mcp-setup-powershell-contracts.test.js`（断言 PowerShell projection 生成同等 `commands.incremental` argv）

**Non-files（显式说明，避免实施者走错路）：**
- **不改** `skills/spec-mcp-setup/mcp-tools.json`：它只含 package/version pin，不是 commands source；本计划 pin 版本不变。
- **不新建** `src/cli/contracts/graph-providers.v1.schema.json`：该目录当前不存在，本计划 canonical 验证面是 `tests/unit/mcp-setup.sh` + `tests/unit/graph-provider-consumption-contracts.test.js` 的 Jest / Bash 断言，不引入 JSON schema 文件。

**Approach:**
- `write-provider-config.sh` 的 `provider_commands()` 新增 `incremental` 键：
  - gitnexus: `["npx","-y","<pinned-package>","analyze"]`（无 `--force`；package 仍来自 mcp-tools.json pin）
  - code-review-graph: `["uvx","<pinned-package>","update","--base","<ASCII sentinel>"]`（sentinel 原样写入）
- Projector 把 sentinel **原样**写入 `.spec-first/config/graph-providers.json.providers.code-review-graph.commands.incremental`。argv safety allowlist 只校验 executable / package / subcommand shape，不校验参数字面值（sentinel 字符串通过）。
- **sentinel 运行时替换与合法性校验是 U2 的职责**，U1 不涉及；U1 只保证 projection 把 incremental argv 正确落地到 `graph-providers.json`。
- `commands.incremental` 作为可选字段，老 runtime（未升级的 graph-providers.json）向后兼容——缺失走 full 降级（见 U2 R2b 处理）。

**Test scenarios:**
- Happy: `npm run test:mcp-setup` 覆盖 source-checkout projection，断言生成的 `graph-providers.json` 中两个 provider 均有 `commands.incremental`；`$spec-mcp-setup` 仅作为用户可见 workflow 名称出现在文档中。
- Happy: `tests/unit/mcp-setup-powershell-contracts.test.js` 覆盖 PowerShell projection parity，断言 GitNexus incremental 为 `npx -y <package> analyze`，CRG incremental 为 `uvx <package> update --base <sentinel>`。
- Edge: 老版本无 `incremental` 字段仍通过 schema 校验。
- Error: 模板缺失时 projection 输出 null，bootstrap 自动降级为 full。

**Verification:**
- `graph-providers.json` 含两个 provider 的 incremental argv。
- safety allowlist 校验通过。

---

### U2. Bootstrap 脚本 Bash 实现两档刷新

**Goal:** 在 `bootstrap-providers.sh` 实现 fingerprint 决策、incremental 执行、fallback、canonical artifacts 字段扩展。

**Requirements:** R1, R2, R3, R4, R5, R6, R7, R8, R9, R10

**Dependencies:** U1

**Files:**
- Modify: `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`
- Modify: `skills/spec-graph-bootstrap/SKILL.md`（新增 `## Refresh Modes` 小节；Freshness 段说明 incremental 消费）
- Modify: `docs/contracts/graph-provider-consumption.md`（**本计划决策：不新增 JSON schema 文件**；`src/cli/contracts/graph/` 目录当前不存在，canonical 验证面维持 prose contract + Jest assertion；在 consumption 契约中新增 truth table 列出所有新字段：`readiness_source` 全枚举值、顶层 `refresh_mode` / `fallback_from_incremental` / `last_indexed_commit` / `requires_clean_full_refresh`、`command_results[]` 扩展的 `refresh_mode` + `attempt_role`、`refresh_modes_by_provider`、`refresh_mode_summary` + consumer 使用规则）
- Test: `tests/unit/graph-provider-consumption-contracts.test.js`（扩展字段/枚举断言）
- Test (new): `tests/unit/spec-graph-bootstrap.sh`（bash 行为测试新增 incremental 决策矩阵、fallback 路径、carry-forward 写入；沿用仓库既有 .sh 测试模式）

**Approach:**
- CLI flag：新增 `--incremental` / `--full` / `--force`（`--force` 是 `--full` 别名；dirty worktree 按 R7 强制降级 full，**无 --allow-dirty opt-in**）。
- 新 helper `resolve_refresh_mode()` 返回 `refresh_mode` + `reason_code`。
- **扩展 `command_shape_supported()` 与分层校验策略**（关键实施约束，避免破坏向后兼容）：
  - 当前 `bootstrap-providers.sh` L638-699 的 `command_shape_supported()` jq 函数仅覆盖 `bootstrap / status / query_probe` 三个 kind；L732-738 校验循环同样硬编码这三个 kind。
  - **校验分层（必须严格遵守）**：
    - **必需 kinds（`bootstrap` / `status` / `query_probe`）**：保持现有无条件校验语义——启动前循环遍历，任一 shape 非法即 `emit_blocked unsupported-provider-command`。
    - **可选 kind（`incremental`）**：**不**加入启动前无条件循环；仅在 `resolve_refresh_mode()` 决议为 `incremental` 并准备执行时校验。处理分支：
      - 字段缺失 / `null` → refresh_mode 降级为 `full`，`reason_code=incremental-command-unavailable`（**不** `emit_blocked`；新增 reason_code 加入 R9/consumption contract / System-Wide Impact）
      - 字段存在但 shape 非法 → `emit_blocked unsupported-provider-command`（与必需 kinds 同等严格）
    - 这个分层保证**老 graph-providers.json（无 `commands.incremental`）仍能 full 模式跑通**，不会因缺字段被 blocked。
  - `incremental` kind 的精确 argv shape：
    - gitnexus incremental: `["npx", "-y", "gitnexus@<pin>", "analyze"]`（4 元素，与现有 bootstrap 的 4 元素 analyze 分支同构）
    - code-review-graph incremental: `["uvx", "code-review-graph@<pin>", "update", "--base", "<sentinel-or-sha>"]`（5 元素）
  - **jq alternation 规范**（现有 crg_shape 用 exact equality tail 匹配，必须扩展为 alternation）：
    ```jq
    $kind == "incremental" and $provider == "code-review-graph" then
      $tail[0] == "update" and $tail[1] == "--base" and
      ($tail[2] | test("^__SPEC_FIRST_[A-Z_]+__$") or test("^[0-9a-f]{40}$"))
    ```
    Shape gate 在 bootstrap 执行期运行：读取已投影 config 后、sentinel 替换与命令执行前完成校验；bootstrap 脚本的 sentinel 替换发生在 shape gate 之后，替换前后 argv 都必须通过 R6 的格式校验（仅 40-hex 合法）。
  - Contract test 必须覆盖三个分支：(a) 字段缺失 → `full + incremental-command-unavailable`；(b) 字段存在合法 → 执行；(c) 字段存在但 shape 非法（`bash -c` / 未知 subcommand / shell metacharacters / 非 hex base）→ `emit_blocked`。
- Provider 执行按 refresh_mode 选 argv；失败进 fallback 重跑 full。
- **CRG base ref 来源与 carry-forward 写入语义**：按 R6 执行（来源、写入时机 + 旧值 carry-forward + dirty-aware + `requires_clean_full_refresh` 状态位、合法性含 40-hex 格式校验）。U2 实施要点：
  - `write_provider_status()` 的 `jq -n` payload 必须改为先读旧 `status.json`（如 `prior=$(jq -c '.' "$status_path" 2>/dev/null || echo null)`），然后按 R6 写入时机 emit `last_indexed_commit` 与 `requires_clean_full_refresh` 两个字段。
  - **Sentinel 内存替换路径**（关键实施约束）：bootstrap 脚本读取 `.spec-first/config/graph-providers.json` 后，**仅在内存中**用 `jq -c --arg sha "$last_indexed_commit" '.providers["code-review-graph"].commands.incremental | map(if . == "__SPEC_FIRST_LAST_INDEXED_COMMIT__" then $sha else . end)'` 产出 resolved argv，传给 `run_configured_command`；**不回写** `graph-providers.json`（违反 Scope Boundaries 的 setup-owned config 只读规则）。
  - argv sentinel 替换前后都校验 `last_indexed_commit` 匹配 `^[0-9a-f]{40}$`，不匹配 emit `reason_code=incremental-base-ref-invalid-format` 走 full。
- **Incremental package pin enforcement**：现有 `provider-projection-stale` gate（reason_code `gitnexus-provider-projection-stale` / `code-review-graph-provider-projection-stale`）只覆盖 `bootstrap / status / query_probe` 三个 kind 的 bundled-vs-projected pin 比对。本 unit 必须把 `incremental` kind 也纳入同一 gate——projected `commands.incremental` argv 中的 package spec 与 `mcp-tools.json` bundled pin 不一致 → 同样 `provider-projection-stale` 失败前置阻断；contract test 必须覆盖 tampered incremental package 场景（如手工把 `graph-providers.json.providers.<id>.commands.incremental[2]` 改为非 pin package 名）。
- **并发保护（portable + repo-scoped）**：同一仓库并发跑 bootstrap（两个 terminal / spec-work 间接触发）会互相覆盖 per-provider status.json 与 aggregate `.spec-first/graph/provider-status.json` / `graph-facts.json`。
  - **不用 `flock`**：macOS 系统 shell 默认不提供 `flock(1)` 命令（Linux util-linux 专属），spec-first 目标 cross-platform。
  - **锁机制**：原子 `mkdir "$SPEC_FIRST_DIR/.graph-bootstrap.lock.d"`（POSIX `mkdir` 对已存在目录会失败，天然原子跨平台）。入口获取锁、退出（trap EXIT）rmdir 释放。
  - **锁粒度**：**repo-scoped 单锁**（单个 `.graph-bootstrap.lock.d`），覆盖整个 bootstrap run 的全部临界区：provider 命令执行 + per-provider status.json 写入 + aggregate `provider-status.json` / `graph-facts.json` / `bootstrap-impact-capabilities.json` 写入。per-provider lock 无法保护 aggregate 写入，粒度必须提升到 repo 级。
  - 获取锁失败（另一进程正在跑）→ **non-mutating 退出路径**：直接 stdout 输出结构化 JSON `{"workflow_mode":"blocked","reason_code":"bootstrap-concurrent-run","stderr_message":"..."}` + 非零 exit code；**不**调用 `emit_blocked` 现有 helper（避免它写 `.spec-first/graph/bootstrap-report.md` / aggregate status，覆盖正在运行进程的 artifacts）；**不**写任何 `.spec-first/` 文件。
  - PowerShell parity（U3）用 `System.Threading.Mutex`（本身 cross-user / cross-process 原生 portable）+ 同样的 non-mutating 失败退出路径。
- **Raw log 路径扩展与 attempt ledger 契约**（**收敛到现有 `command_results[]`，不引入 double ledger**）：
  - 现有 `command_results[]` 已是 attempt array（每条目含 `kind` / `command` / `exit_code` / `diagnostic` / `raw_log` / 时间戳）。本计划**扩展**该字段加可选 `refresh_mode` + `attempt_role`，承载 incremental + fallback 两次 bootstrap attempt——**不再新增独立的 `bootstrap_attempts[]` 数组**（避免 schema double ledger）。
  - 扩展后的 `kind=bootstrap` 元素 schema：
    ```jsonc
    {
      "kind": "bootstrap",                               // 现有
      "refresh_mode": "incremental" | "full",             // 新增（仅 kind=bootstrap 时填）
      "attempt_role": "primary" | "fallback",             // 新增（incremental 失败后的 full 重跑标记 fallback）
      "command": "...", "exit_code": 0,
      "raw_log": "...", "diagnostic": "...",
      "started_at": "...", "finished_at": "...", "duration_ms": 12345
    }
    ```
  - 现有日志路径保持不变：`analyze.log` / `build.log` / `status.log` / `query.log` / `query-2.log`
  - 新增日志路径：`update.log`（CRG incremental update 输出）、`fallback-analyze.log`（GitNexus incremental 失败后 fallback `analyze --force` 输出）、`fallback-build.log`（CRG incremental 失败后 fallback build 输出）
  - 现有 `raw_logs` 顶层对象保持 backward-compat：按 kind 为 key 指向**最近一次 attempt** 的 log（语义不变）；完整 attempt 历史从 `command_results[]` 读取（filter `kind=bootstrap` + 按 array index 时序）。
  - 必须满足：incremental 失败 + fallback full 成功时，`command_results[]` 保留两条 `kind=bootstrap` 条目（一条 `refresh_mode=incremental, attempt_role=primary`，一条 `refresh_mode=full, attempt_role=fallback`）；GitNexus 两条分别指向 `analyze.log` 与 `fallback-analyze.log`，CRG 两条分别指向 `update.log` 与 `fallback-build.log`，不互相覆盖。
- Canonical artifacts 写入按 schema 层级：
  - `.spec-first/providers/<id>/status.json`（`provider-status.v1`，per-provider）顶层：
    - `refresh_mode`（始终 emit；值域 = `{full, incremental, incremental-fallback-full, failed}`；表示该 provider 本轮最终结果，含 fallback 语义）
    - `fallback_from_incremental`（布尔）
    - `last_indexed_commit`（按 R6 carry-forward）
    - `requires_clean_full_refresh`（布尔；R6/R7 dirty 保护机制，dirty 跑任何刷新置 true，clean full 成功清除）
    - 现有 `command_results[]` 顶层数组的 `kind=bootstrap` 元素扩展 `refresh_mode` ∈ `{full, incremental}` 与 `attempt_role` ∈ `{primary, fallback}`（**不新增独立 `bootstrap_attempts[]`**）
  - `.spec-first/graph/provider-status.json`（`graph-provider-status.v1`，aggregate）的 `providers[]` 继承上述字段
  - `.spec-first/graph/graph-facts.json`（`graph-facts.v1`）顶层新增字段由 aggregate writer（L1904-1957）派生：`refresh_modes_by_provider = $providers | map({(.provider): .refresh_mode}) | add`；`refresh_mode_summary` 按 R10 计算规则
  - Raw log / fallback 命名（按 provider 区分）：GitNexus fallback 产 `fallback-analyze.log`，CRG fallback 产 `fallback-build.log`（provider id 由 bootstrap-providers.sh L726-729 的 allowlist 保证路径安全）
- Readiness 三级证据在 incremental 下仍必过；不达标走现有 `query-unverified` 路径。
- **Dirty worktree 处理**：按 R7 执行——强制降级 full，`reason_code=dirty-worktree-incremental-not-allowed`，不读取任何 opt-in flag（R7 无 opt-in 路径）。
- 脚本顶部声明 `DEFAULT_REFRESH_MODE_SINGLE_REPO=full` 和 `DEFAULT_REFRESH_MODE_ALL_REPOS=full` 两个常量（见 R1 与 Rollout）。

**Execution note:** 先写 contract test（断言字段 + 决策矩阵），再改脚本；fallback 路径用 mock exit code 隔离验证。

**Test scenarios:**
- Happy: fingerprint repo_snapshot 仅 commit 变化 + `--incremental` flag → `refresh_mode=incremental`，`readiness_source=incremental-update`。
- Happy: 首次 bootstrap → `full`，`readiness_source=cold-run`。
- Happy: `--force` → `full`。
- Happy: 初始期 `DEFAULT_REFRESH_MODE_SINGLE_REPO=full` 且无 flag → `full`（即使 fingerprint 非 repo-snapshot 未变）；`--all-repos` 覆盖 `DEFAULT_REFRESH_MODE_ALL_REPOS=full`。
- Edge: per-provider `last_indexed_commit` 未记录 → `full`，`reason_code=incremental-base-ref-unset`。
- Edge: `last_indexed_commit` 格式不匹配 `^[0-9a-f]{40}$`（模拟污染值 `"--output=/tmp/evil"` 或 `" foo"`） → `full`，`reason_code=incremental-base-ref-invalid-format`；argv 不会被执行。
- Edge: `last_indexed_commit` 在 git 中不存在 → `full`，`reason_code=incremental-base-ref-missing`。
- Edge: `last_indexed_commit` 非 HEAD 祖先 → `full`，`reason_code=incremental-base-ref-not-ancestor`。
- Edge: carry-forward — full 成功 → incremental 失败（query-unverified）→ 下次跑 → per-provider status.json 的 `last_indexed_commit` 仍为**首次 full 时的 HEAD**（不被中间失败擦除），下次 `--incremental` 可启动。
- Edge: 并发 bootstrap — 第二个进程获取不到 repo-scoped lock（`mkdir "$SPEC_FIRST_DIR/.graph-bootstrap.lock.d"`）→ emit `reason_code=bootstrap-concurrent-run`，不执行 provider 命令。
- Edge: fingerprint.spec_first.mcp_tools_hash 变化 → `full`，`reason_code=fingerprint-spec-first-changed`。
- Edge: dirty worktree + `--incremental` → `full`，`reason_code=dirty-worktree-incremental-not-allowed`（无 opt-in 逃生路径）。
- Edge: full 成功（cold-run）后再跑 incremental → per-provider status.json 已有 last_indexed_commit（指向首次 full 时的 HEAD），incremental 可启动；否则 `reason_code=incremental-base-ref-unset`（证明 R6 写入时机正确）。
- Shape gate: 扩展后的 `command_shape_supported()` 拒绝 incremental kind 的非法 argv（`bash -c` / 未知 subcommand / 含 shell metacharacters）→ `emit_blocked blocked unsupported-provider-command`。
- Raw log: incremental 失败后 fallback full 成功 → `command_results[]` 保留两条 `kind=bootstrap` 条目（一条 `refresh_mode=incremental, attempt_role=primary`，一条 `refresh_mode=full, attempt_role=fallback`）；GitNexus 两条 `raw_log` 分别指向 `analyze.log` 与 `fallback-analyze.log`，CRG 两条 `raw_log` 分别指向 `update.log` 与 `fallback-build.log`；`raw_logs` 仅保持现有 backward-compat latest-kind alias，不新增 `raw_logs.incremental` / `raw_logs.fallback` 子键。
- Aggregate: 两个 provider 一个 incremental 一个 fallback-full → `graph-facts.refresh_modes_by_provider` 反映差异；`refresh_mode_summary=mixed`。
- Aggregate: 一个 provider incremental 成功 + 一个 provider incremental+full 都失败 → `refresh_modes_by_provider.<failed-id>=failed`；`refresh_mode_summary=mixed`；workflow_mode=degraded-fallback。
- Error: incremental 命令 exit != 0 → 重跑 full，`fallback_from_incremental=true`，`readiness_source=incremental-fallback-full`。
- Error: incremental 成功但 query probe 失败 → `status=query-unverified`，不 fallback。
- Error: incremental + full 都失败 → `workflow_mode=degraded-fallback`，`reason_code=incremental-and-full-failed`。

**Verification:**
- 同 HEAD 下 `--incremental` 与 `--force` 跑出的 artifacts 核心 readiness 字段（status=ready, query_ready=true）一致。A→B 差分对照在 U4 benchmark 中做。
- canonical artifacts 字段扩展符合 consumption contract（含 `refresh_modes_by_provider`、`requires_clean_full_refresh`、`command_results[]` 扩展字段）。
- fingerprint 决策矩阵全分支在 contract test 覆盖（含 dirty-worktree-incremental-not-allowed、base-ref-unset 新分支）。
- **last_indexed_commit 写入时机测试**：首次 full 成功后 per-provider status.json 包含当前 HEAD 的 `last_indexed_commit`；再跑 incremental 能读到并通过 preflight。
- `DEFAULT_REFRESH_MODE_SINGLE_REPO` 与 `DEFAULT_REFRESH_MODE_ALL_REPOS` 两个常量在 Bash/PowerShell 脚本顶部均可 grep，初始值均为 `full`。
- 扩展后的 `command_shape_supported()` 在 contract test 中被明确断言拒绝非法 incremental argv。

---

### U3. PowerShell parity

**Goal:** `bootstrap-providers.ps1` 与 Bash 脚本同 U2 行为全对齐。

**Requirements:** R1, R2, R3, R4, R5, R6, R7, R8, R9, R10（通过 Bash parity 镜像 U2 契约）

**Dependencies:** U2

**Files:**
- Modify: `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`
- Test: `tests/unit/mcp-setup-powershell-contracts.test.js` 或等价 parity 测试

**Approach:** 逐项对齐 U2 的 flag 解析、`resolve_refresh_mode` 等价函数、fallback 分支、字段写入。

**Verification:** parity 测试通过；核心常量（`refresh_mode`、`incremental-update`、`incremental-fallback-full`、`incremental-base-ref-missing`、`incremental-base-ref-unset`、`incremental-base-ref-not-ancestor`、`dirty-worktree-incremental-not-allowed`、`DEFAULT_REFRESH_MODE_SINGLE_REPO`、`DEFAULT_REFRESH_MODE_ALL_REPOS`）在两个脚本中都存在；`command_shape_supported` 的 incremental kind 分支 parity 对齐。

---

### U4. 文档 / benchmark / rollout

**Goal:** 同步 README、用户手册、契约文档；跑一次 benchmark 决定是否切换默认；登记 CHANGELOG。

**Requirements:** R11（外加 rollout 决策）

**Dependencies:** U2, U3

**Files:**
- Modify: `docs/contracts/graph-provider-consumption.md`（readiness_source truth table）
- Modify: `docs/contracts/graph-evidence-policy.md`（Refresh Trigger Policy 表下加一行 post-commit 运维建议）
- Modify: `docs/05-用户手册/02-核心概念.md` / `04-workflows-artifacts-map.md` / `05-最佳实践.md`（两档刷新一句话心智模型）
- Modify: `README.md` / `README.zh-CN.md`（`$spec-graph-bootstrap` 使用段增加两档说明）
- Modify: `CHANGELOG.md`
- Create: `docs/validation/2026-05-12-graph-bootstrap-incremental-benchmark.md`

**Approach (benchmark)：**

A→B 差分对照（证明 post-commit 正确性，不是 warm-path 空操作）：

**隔离边界**（basic hygiene）：benchmark 必须在 **disposable temp clone 或 isolated git worktree** 中执行（`git clone --local . /tmp/bench-$$` 或 `git worktree add /tmp/bench-$$`），不得污染当前仓库 canonical artifacts / working tree / 历史。Validation doc 记录 clone/worktree 路径与 teardown 步骤。

**前置检查清单**（缺一则 benchmark 无效）：
- 在 temp clone 内 `.spec-first/config/` 由 `spec-mcp-setup` 重新生成一次，保持与主 repo 配置一致
- 记录并锁定 `skills/spec-mcp-setup/mcp-tools.json` hash（benchmark 期间不变）
- commit B 必须是 A 的 fast-forward 追加（禁止 amend / rebase；commit sha 稳定）
- benchmark 每步跑完后断言 `readiness_source` 匹配预期（A_full=cold-run / B_incremental=incremental-update / B_full=cold-run）；若 preflight 意外降级到 full，benchmark 作废重来

**执行步骤**：

1. **基线 A**：在 temp clone / worktree 的 commit A 上跑 `--force`，保存 A_full artifacts（anchor-normalized node/edge set、flow/community count、query probe result_class、耗时）。
2. **Controlled commit A→B（三类 diff 各一个，必须覆盖 cross-file）**：
   - (a) **单文件内修改**：新增一个函数、改一个函数签名、删一个函数（测 intra-file 语义）
   - (b) **跨文件 import/call 变化**：修改 A 文件的函数签名，同时 B 文件 import/call 该函数（测 IMPORTS/CALLS 边的级联更新——provider silent partial drift 的典型高风险场景）
   - (c) **文件新增/删除**：新增一个 .py/.js 文件并被另一文件 import；删除一个未被引用的文件（测 file-level 节点生命周期）
   - 记录**预期的新增/删除/移动符号集合 + 受影响的 dependent files + 预期的边集合变化**（提前列出，不是跑完再看）
3. **增量路径**：在 temp clone 的 commit B checkout 上，基于 step 1 的 A_full artifacts 跑 `--incremental`，保存 B_incremental artifacts 与耗时。
4. **基准对照**：在 temp clone 的 commit B 上再次清理 artifacts 后跑 `--force`，保存 B_full artifacts。
5. **Provider 原生 graph 提取（benchmark-only helper）**：normalized artifact（`architecture-facts.json` / `impact-capabilities.json`）当前是 readiness envelope，**不含**完整 node/edge facts。U4 实施前先写 `tests/benchmark/extract-graph-anchors.sh`（或等价 helper），从 provider 原生存储提取 anchor JSON：

   | Provider | 原生存储路径 | 提取方式 |
   |---|---|---|
   | GitNexus | `.gitnexus/` SQLite database | `sqlite3` 查询 nodes / edges 表，输出 anchor JSON |
   | CRG | `.code-review-graph/` 数据库 / serialized facts | CRG 提供的 `code-review-graph status --json` 或直接读其内部存储 |

   helper 输出 schema：
   ```jsonc
   {
     "nodes": [{"path":"...","kind":"function","name":"...","start_line":N,"end_line":M}, ...],
     "edges": [{"type":"CALLS","from":<anchor>,"to":<anchor>}, ...],
     "query_probe": {"result_class":"...","results":[<anchor>, ...]},
     "impact": {"radius":N,"affected":[<anchor>, ...]}  // CRG only
   }
   ```

   benchmark 比对在该 helper 输出上做（不依赖 normalized envelope 的 node id），保证 anchor 归一化 + 跨 build 稳定。

6. **对照（拆成两个独立比对）**：

   benchmark 产出 3 份 artifact 对应的 anchor JSON：`A_full_anchors`、`B_incremental_anchors`、`B_full_anchors`。两个独立比对：

   - **比对 (i) — Incremental capture correctness**：`A_full_anchors` vs `B_incremental_anchors` 的 node anchor 对称差集 = step 2 预先列出的 A→B delta（验证 incremental 捕捉了变化）
   - **比对 (ii) — Incremental equivalence**：`B_incremental_anchors` vs `B_full_anchors` 的 node anchor 对称差集 = **∅**（验证 incremental 与同 commit 的 full 结果等价；任何非空差集都视为 incremental 漏索引或多索引）

   两个比对相互独立，必须**都**通过；任一失败 benchmark FAIL。

   Flow / community count 允许抖动（±1% 或实测 baseline 后定的阈值）。

7. **Per-provider pass matrix**：

   | Provider | (i) Capture correctness (A_full vs B_incr = A→B delta) | (ii) Equivalence (B_incr vs B_full = ∅) | readiness_source 未 fallback | Query probe no degradation | Duration ratio (B_incr ≤ B_full / 3) |
   |---|---|---|---|---|---|
   | gitnexus | 必过 | 必过 | 必过 | 必过 | 必过 |
   | code-review-graph | 必过 | 必过 | 必过 | 必过 | 必过 |

   - **readiness_source 未 fallback**：B_incremental 的 `readiness_source=incremental-update`（**不是** `incremental-fallback-full`，**不是** `cold-run`）。**注意**：此字段仅证明 spec-first 调用时未触发 fallback（即 `--incremental` 命令形式跑通且未降级），**不**断言 provider 内部真正走了 diff 索引——后者由 `Duration ratio` 间接支撑（如果 provider 内部全量重建，duration 不会显著低于 full）。这与 R9 的字段语义定义一致。
   - **Absolute duration**（对齐 Summary 的 ~3-5 秒承诺）：**所有 provider 累计** `B_incremental_total_duration ≤ 5s`

8. **Rollout 决策**：本计划 U4 的角色是 **opt-in 正确性基线**（incremental 开关功能可用、对一组合成 diff 表现等价）；
   - **不**自动触发默认切换。所有 criteria + absolute ≤ 5s 全绿 → incremental flag 上线为可选模式，Plan 视为完成。
   - **Default 切换到 incremental** 需独立的 follow-up rollout plan，覆盖更宽场景（A→B→C→D 连续增量链 / 文件 rename / parser degradation fuzz / 大规模重命名 / 长 commit 链累积误差等）+ 多次重复 benchmark 收集 baseline。本计划 U4 的成功 ≠ 默认切换的充分证据。
   - 任一 criterion 不过 → 保留 `full` 默认，validation doc 记录失败行（哪个 provider / 哪个 criterion / 实测值），且 follow-up rollout plan 必须先解决该失败模式。
9. **Teardown**：删除 temp clone / worktree 和附带的 branch。

**Verification:**
- 用户文档一致使用术语（`incremental` / `full`，中文「增量」/「全量」）。
- README 中英一致。
- validation doc 包含两次运行的原始命令、耗时、readiness 字段、差异观察和 rollout 决策。
- CHANGELOG 按仓库现行格式登记。

---

## System-Wide Impact

- **Canonical artifact 扩展：** `readiness_source` enum 增加 2 个值；`refresh_mode`（值域 `{full, incremental, incremental-fallback-full, failed}`）/ `fallback_from_incremental` / `last_indexed_commit` / `requires_clean_full_refresh` 为新可选字段（per-provider 顶层）；现有 `command_results[]` 元素扩展可选 `refresh_mode` + `attempt_role`（不引入独立 `bootstrap_attempts[]`，避免 schema double ledger）；`refresh_modes_by_provider` 映射、可选 `refresh_mode_summary` 为 aggregate graph-facts 新字段。所有现有 consumer 对 `readiness_source` 无硬分支，新值透明。
- **Error propagation：** incremental 失败自动 fallback full；full 失败按现有 `workflow_mode=degraded-fallback` 处理。**不新增 workflow-level error category**（workflow_mode 仍是现有 `primary` / `degraded-fallback` / `blocked` / `no-source` / `action-required`）；**新增若干 incremental 相关 reason_code**（`incremental-refresh-failed-fallback-full`、`incremental-base-ref-missing`、`incremental-base-ref-unset`、`incremental-base-ref-invalid-format`、`incremental-base-ref-not-ancestor`、`incremental-and-full-failed`、`incremental-command-unavailable`、`dirty-worktree-incremental-not-allowed`、`clean-full-refresh-required`、`bootstrap-concurrent-run`、`fingerprint-spec-first-changed`、`fingerprint-projection-changed`、`fingerprint-provider-changed`），由 consumption 契约 + contract test 扩展声明（不新增 JSON schema 文件，沿用 prose + Jest 验证模式）。
- **API surface：** CLI 新增 `--incremental` / `--full` / `--force`；PowerShell `-Incremental` / `-Full` / `-Force`。
- **Unchanged invariants：** schema 版本不 bump；refresh ownership / readiness 三级证据 / source-runtime 边界 / setup-owned config 只读等既有约束全部保持。

---

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| `code-review-graph update --base` 在 pinned 2.3.3 下不可用或语义不等价 | 实施前 sanity check；必要时走 `2026-05-09-005` pin 升级流程或只对 GitNexus 启用 incremental。 |
| GitNexus `analyze`（不带 `--force`）实际退化为全量 | benchmark 核验耗时；如耗时未显著下降，保留 full 默认；`readiness_source=incremental-update` 的字段语义已在 R9 限定为"调用形式"，不声称 graph diff。 |
| incremental 失败率高导致体验变差（fallback 耗时叠加） | `fallback_from_incremental` 字段可观测；>10% 频率可随时单行回滚默认值。 |
| `--all-repos` 多仓场景未经 benchmark 验证 | 本计划保持 `DEFAULT_REFRESH_MODE_ALL_REPOS=full`；`--all-repos` incremental default switch 需要独立多仓 validation，`--force` 只是显式运行的 operator escape hatch，不是未验证默认切换的 mitigation。 |
| 与 `2026-05-09-003` fast-reuse 的 `resolve_refresh_mode` ownership 冲突 | Open Questions / P0 Blocker 段显式 resolve，进入 U1/U2 依赖链。 |
| 现有 `command_shape_supported()` 硬编码 3 个 kind，未扩展 incremental 会打开未校验 CLI 执行边界或直接 emit_blocked | U2 Approach 显式要求扩展 shape gate + 校验循环；contract test 断言 incremental argv 的 shape 校验。 |
| incremental 失败后 raw log 按 kind 覆盖，审计证据丢失 | U2 扩展现有 `command_results[]` 加 `refresh_mode` / `attempt_role`（不引入独立 `bootstrap_attempts[]`），配合 provider-specific 独立 log 路径（GitNexus: `fallback-analyze.log`；CRG: `update.log` / `fallback-build.log`）；Scope Boundaries 明确松绑该约束。 |
| dirty worktree 下索引含未提交内容但 last_indexed_commit 推进到 clean HEAD，造成下次 diff 窗口错位（incremental + full 都会触发） | R7 修复：(1) dirty incremental 强制降级 full；(2) dirty 任何刷新都不推进 last_indexed_commit；(3) 写入 requires_clean_full_refresh=true 状态位，强制下次 incremental preflight 降级直到 clean full 跑通才清除。状态机由本计划承担。 |
| 并发 bootstrap 运行（双 terminal / spec-work 间接触发）覆盖 per-provider status.json 造成 last_indexed_commit 撕裂 | U2 Approach 加 repo-scoped `mkdir "$SPEC_FIRST_DIR/.graph-bootstrap.lock.d"` lock 保护（PowerShell Mutex parity）；获取不到锁 emit `reason_code=bootstrap-concurrent-run`。 |
| 混合失败语义：GitNexus 成功 / CRG 全失败时 refresh_modes_by_provider 值域不含 failed | R10 扩展值域加 `failed`；summary 规则把含 failed 的情况归为 `mixed`。 |
| Silent partial index drift：provider 在部分 parse 失败时仍 exit=0，readiness 三级证据通过但索引不完整 | A2/A3 的 "provider 增量可信" 假设依赖 provider 自身的 fail-fast；长期兜底靠 A→B benchmark + 用户定期 `--force`；若 drift 显著，Rollout 段的回滚单行常量改动立即生效。 |
| `last_indexed_commit` 被 CI / 恶意 PR 污染为 flag-shaped 字符串造成 argv injection | R6 合法性校验加 `^[0-9a-f]{40}$` 格式断言（现有 `safe_args` 只过滤 shell metacharacters）；shape gate 扩展接受 sentinel 或 40-hex alternation。 |

---

## Documentation / Operational Notes

- **Rollout 范围（critical 边界）：** 本计划只交付 **incremental flag-gated opt-in**。U4 benchmark 是 **opt-in 正确性基线**（验证 incremental 在合成 diff 上正确且等价于 full），不是 default 切换的充分条件。**Default 切换到 incremental** 需独立 follow-up rollout plan（覆盖 A→B→C→D 连续增量链 / 文件 rename / parser degradation fuzz / 长 commit 链累积误差等更宽 gate）。`DEFAULT_REFRESH_MODE_*` 在本计划范围内保持 `full` 不变。
- **回滚：** 单行修改相应 `DEFAULT_REFRESH_MODE_*` 常量即可，不回滚 schema/flag。
- **监控：** canonical artifacts 的 `readiness_source` 分布和 `fallback_from_incremental` 频率是运行期判断依据；跨 session 聚合属于 follow-up。
- **用户沟通：** README / 用户手册一句话心智模型；`$spec-graph-bootstrap --help` 含 flag 文档。

---

## Sources & References

- **上游计划：**
  - `docs/plans/2026-05-09-003-feat-graph-bootstrap-fast-reuse-plan.md`
  - `docs/plans/2026-05-12-002-feat-gitnexus-refresh-trigger-policy-plan.md`
  - `docs/plans/2026-05-09-005-fix-code-review-graph-uvx-pin-plan.md`
- **契约文档：** `docs/contracts/graph-evidence-policy.md`, `docs/contracts/graph-provider-consumption.md`
- **Skill source：** `skills/spec-graph-bootstrap/SKILL.md`, `skills/spec-graph-bootstrap/scripts/bootstrap-providers.sh`, `skills/spec-graph-bootstrap/scripts/bootstrap-providers.ps1`, `skills/spec-mcp-setup/mcp-tools.json`
- **External docs (context7)：**
  - code-review-graph `/tirth8205/code-review-graph` — `update` / `build`
  - GitNexus `/abhigyanpatwari/gitnexus` — `analyze` / `analyze --force`
- **实施证据：**
  - `.spec-first/graph/provider-status.json`（`reuse_eligible=true`，`readiness_source=cold-run`）
  - `diff skills/spec-graph-bootstrap/SKILL.md .agents/skills/spec-graph-bootstrap/SKILL.md` 证明 runtime prose drift（修法：直接跑 `spec-first init`，不入本计划）
